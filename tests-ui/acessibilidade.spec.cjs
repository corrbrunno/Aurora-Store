'use strict';
const { test, expect } = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const path = require('path');
const fs = require('fs');

const RAIZ = path.join(__dirname, '..');
function ev(id) {
  const d = path.join(RAIZ, 'evidencias', id);
  fs.mkdirSync(d, { recursive: true });
  return d;
}

// CT-A01 — mensagem de erro do cadastro indica o campo (RNF-04)
test('CT-A01 — mensagem de erro do cadastro identifica o campo', async ({ page }) => {
  const dir = ev('CT-A01');
  const casos = [
    { campo: 'nome', dados: { name: 'Jo', email: 'a1@loja.test', password: 'SenhaForte123' }, esperado: /nome/i },
    { campo: 'email', dados: { name: 'Cliente Um', email: 'invalido', password: 'SenhaForte123' }, esperado: /email/i },
    { campo: 'senha', dados: { name: 'Cliente Um', email: 'a2@loja.test', password: '123' }, esperado: /senha/i },
  ];
  const obtidos = [];
  for (const c of casos) {
    await page.goto('/#cadastro');
    await expect(page.locator('#view-register')).toBeVisible();
    await page.getByTestId('register-name').fill(c.dados.name);
    await page.getByTestId('register-email').fill(c.dados.email);
    await page.getByTestId('register-password').fill(c.dados.password);
    await page.locator('#register-form').getByRole('button').click();
    await page.waitForTimeout(400);
    const msg = (await page.locator('#register-error').innerText()).trim();
    obtidos.push(`${c.campo}: "${msg}"`);
    await page.screenshot({ path: path.join(dir, `print-${c.campo}.png`) });
    expect(msg).toMatch(c.esperado);
  }
  fs.writeFileSync(path.join(dir, 'observacao.txt'), obtidos.join('\n') + '\n');
});

// CT-A02 — cada campo tem rótulo associado (RNF-01)
test('CT-A02 — campos do cadastro têm rótulo associado', async ({ page }) => {
  const dir = ev('CT-A02');
  await page.goto('/#cadastro');
  await expect(page.locator('#view-register')).toBeVisible();
  const porRotulo = await page.getByLabel('Nome', { exact: true }).count();
  const porRotuloEmail = await page.getByLabel('E-mail', { exact: true }).count();
  const labels = await page.locator('#register-form label').count();
  const campos = await page.locator('#register-form input').count();
  await page.screenshot({ path: path.join(dir, 'print-cadastro.png') });
  fs.writeFileSync(path.join(dir, 'observacao.txt'),
    `getByLabel("Nome") encontrou ${porRotulo} elemento(s)\n` +
    `getByLabel("E-mail") encontrou ${porRotuloEmail} elemento(s)\n` +
    `elementos <label> no formulário: ${labels} para ${campos} campos\n`);
  expect(porRotulo).toBeGreaterThan(0);
  expect(porRotuloEmail).toBeGreaterThan(0);
});

// CT-A03 — ações principais alcançáveis pelo teclado (RNF-02)
test('CT-A03 — adicionar ao carrinho recebe foco por Tab', async ({ page }) => {
  const dir = ev('CT-A03');
  await page.goto('/#catalogo');
  const alvo = page.locator('[data-testid="add-to-cart"][data-product-id="produto-teste"]');
  await expect(alvo).toBeVisible({ timeout: 30000 });
  await page.locator('#refresh-catalog').focus();
  await page.keyboard.press('Tab');
  await page.waitForTimeout(300);
  const ativo = await page.evaluate(() => {
    const el = document.activeElement;
    return { tag: el.tagName, testid: el.dataset ? el.dataset.testid : null, texto: (el.textContent || '').slice(0, 40) };
  });
  const focado = await alvo.evaluate((el) => el === document.activeElement);
  await page.screenshot({ path: path.join(dir, 'print-tab.png') });
  fs.writeFileSync(path.join(dir, 'observacao.txt'),
    `elemento ativo depois do Tab: <${ativo.tag}> testid="${ativo.testid}" texto="${ativo.texto}"\n` +
    `é o botão Adicionar ao carrinho? ${focado}\n`);
  expect(focado).toBe(true);
});

// CT-A04 — inspeção automatizada com axe (WCAG 2.0 A/AA)
test('CT-A04 — inspeção axe no cadastro e no catálogo', async ({ page }) => {
  const dir = ev('CT-A04');
  const resumo = {};
  for (const [nome, rota] of [['cadastro', '/#cadastro'], ['catalogo', '/#catalogo']]) {
    await page.goto(rota);
    await page.waitForTimeout(1200);
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    resumo[nome] = r.violations.map((v) => ({
      id: v.id, impacto: v.impact, ajuda: v.help, alvos: v.nodes.map((n) => n.target.join(' ')).slice(0, 3),
    }));
    await page.screenshot({ path: path.join(dir, `print-${nome}.png`), fullPage: false });
  }
  fs.writeFileSync(path.join(dir, 'axes.json'), JSON.stringify(resumo, null, 1));
  fs.writeFileSync(path.join(dir, 'observacao.txt'),
    Object.entries(resumo).map(([tela, vs]) =>
      `${tela}: ${vs.length} violação(ões)` + (vs.length ? ' -> ' + vs.map((v) => `${v.id} (${v.impacto})`).join(', ') : '')).join('\n') + '\n');
  expect(resumo.cadastro.length).toBe(0);
  expect(resumo.catalogo.length).toBe(0);
});

// CT-A05 — carrinho vazio explica a situação e oferece caminho de volta (RNF-05)
test('CT-A05 — carrinho vazio orienta o usuário', async ({ page }) => {
  const dir = ev('CT-A05');
  await page.addInitScript(() => localStorage.clear());
  await page.goto('/#carrinho');
  await expect(page.locator('#view-cart')).toBeVisible();
  await page.waitForTimeout(600);
  const texto = (await page.locator('#view-cart').innerText()).trim();
  const links = await page.locator('#view-cart a[href*="catalogo"], #view-cart a[href="#catalogo"]').count();
  await page.screenshot({ path: path.join(dir, 'print-carrinho-vazio.png') });
  fs.writeFileSync(path.join(dir, 'observacao.txt'),
    `texto exibido no carrinho vazio:\n${texto}\n\nlinks de volta ao catálogo: ${links}\n`);
  expect(texto.toLowerCase()).toMatch(/vazi|nenhum|sem itens/);
  expect(links).toBeGreaterThan(0);
});
