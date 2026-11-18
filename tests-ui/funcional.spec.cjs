'use strict';
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const RAIZ = path.join(__dirname, '..');
const limpa = (s) => String(s).replace(/\s/g, ' ').trim();
function ev(id) {
  const d = path.join(RAIZ, 'evidencias', id);
  fs.mkdirSync(d, { recursive: true });
  return d;
}
function anotar(dir, nome, texto) {
  fs.writeFileSync(path.join(dir, nome), texto.endsWith('\n') ? texto : texto + '\n');
}

async function entrar(page, email = 'cliente-a@loja.test') {
  await page.goto('/#entrar');
  await expect(page.locator('#view-login')).toBeVisible();
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill('SenhaDidatica123!');
  await page.locator('#login-form').getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('#view-catalog')).toBeVisible();
}

test('CT-F04 — busca e filtro restringem o catálogo', async ({ page }) => {
  const dir = ev('CT-F04');
  await page.goto('/#catalogo');
  const cards = page.locator('[data-testid="product-card"]');
  await expect(cards.first()).toBeVisible({ timeout: 30000 });
  const total = await cards.count();

  await page.fill('#search', 'papelaria');
  await page.waitForTimeout(600);
  const visiveis = await page.locator('[data-testid="product-card"]:not([hidden])').count();
  const nomes = await page.locator('[data-testid="product-card"]:not([hidden]) h2').allTextContents();
  await page.screenshot({ path: path.join(dir, 'print-busca.png') });

  await page.fill('#search', '');
  const opcoes = await page.locator('#category-filter option').evaluateAll((os) =>
    os.map((o) => o.value).filter(Boolean));
  const alvo = opcoes.includes('Papelaria') ? 'Papelaria' : opcoes[0];
  await page.selectOption('#category-filter', alvo);
  await page.waitForTimeout(600);
  const visCat = await page.locator('[data-testid="product-card"]:not([hidden])').count();
  const catsVisiveis = await page.locator('[data-testid="product-card"]:not([hidden]) .category').allTextContents();
  await page.screenshot({ path: path.join(dir, 'print-filtro.png') });

  anotar(dir, 'observacao.txt', [
    `catalogo total de cards: ${total}`,
    `busca "papelaria": ${visiveis} cards visiveis`,
    `primeiros nomes visiveis: ${nomes.slice(0, 4).join(' | ')}`,
    `filtro categoria "${alvo}": ${visCat} cards visiveis`,
    `categorias visiveis: ${[...new Set(catsVisiveis)].join(', ')}`,
  ].join('\n'));

  expect(visiveis).toBeGreaterThan(0);
  expect(visiveis).toBeLessThan(total);
  for (const n of nomes) expect(n.toLowerCase()).toContain('papelaria');
  expect(visCat).toBeGreaterThan(0);
  expect(visCat).toBeLessThan(total);
  for (const c of new Set(catsVisiveis)) expect(c).toBe(alvo);
});

test('CT-F05 — carrinho inclui, altera quantidade e remove item', async ({ page }) => {
  const dir = ev('CT-F05');
  await page.addInitScript(() => localStorage.clear());
  await entrar(page);

  const add = page.locator('[data-testid="add-to-cart"][data-product-id="produto-teste"]');
  await expect(add).toBeVisible();
  await add.click();
  await add.click();
  await page.getByTestId('nav-cart').click();
  await expect(page.locator('#view-cart')).toBeVisible();
  const sub2 = limpa(await page.getByTestId('cart-subtotal').textContent());
  const qtd2 = await page.locator('[data-qty][data-product-id="produto-teste"]').inputValue();
  await page.screenshot({ path: path.join(dir, 'print-2-unidades.png') });

  await page.locator('[data-qty][data-product-id="produto-teste"]').fill('1');
  await page.locator('[data-qty][data-product-id="produto-teste"]').dispatchEvent('change');
  await page.waitForTimeout(800);
  const sub1 = limpa(await page.getByTestId('cart-subtotal').textContent());
  await page.screenshot({ path: path.join(dir, 'print-1-unidade.png') });

  await page.locator('[data-remove="produto-teste"]').click();
  await page.waitForTimeout(800);
  const conteudo = (await page.locator('#cart-content').innerText()).trim();
  const badge = (await page.locator('#cart-count').textContent()).trim();
  await page.screenshot({ path: path.join(dir, 'print-carrinho-vazio.png') });

  anotar(dir, 'observacao.txt', [
    `subtotal com 2 unidades: ${sub2} (campo quantidade = ${qtd2})`,
    `subtotal com 1 unidade: ${sub1}`,
    `carrinho apos remover: contador=${badge}, texto do conteudo="${conteudo}"`,
  ].join('\n'));

  expect(sub2).toBe('R$ 300,00');
  expect(sub1).toBe('R$ 150,00');
  expect(badge).toBe('0');
});
