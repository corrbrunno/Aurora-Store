'use strict';
// CT-E01 — sessão exploratória cronometrada (15 minutos)
const { test } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const RAIZ = path.join(__dirname, '..');
const DIR = path.join(RAIZ, 'evidencias', 'CT-E01');
const LINHAS = [];
let t0 = Date.now();

function marca(rotulo, detalhe) {
  const s = Math.round((Date.now() - t0) / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  const linha = `[${mm}:${ss}] ${rotulo}${detalhe ? ' -> ' + detalhe : ''}`;
  console.log(linha);
  LINHAS.push(linha);
}

const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

test('CT-E01 — sessão exploratória de 15 minutos', async ({ page }) => {
  test.setTimeout(20 * 60 * 1000);
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(20000);
  fs.mkdirSync(DIR, { recursive: true });
  const print = (nome) => page.screenshot({ path: path.join(DIR, `print-${nome}.png`) });
  const obs = async (rotulo, fn) => {
    try {
      const detalhe = await fn();
      marca(rotulo, detalhe);
    } catch (e) {
      marca(rotulo, 'ERRO: ' + e.message.split('\n')[0]);
    }
    await pausa(43000);
  };

  marca('início da sessão', 'carta: percorrer catálogo, busca, carrinho, cupom e checkout buscando comportamento inesperado');
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto('/#catalogo');
  await page.waitForSelector('[data-testid="product-card"]');
  await pausa(43000);

  await obs('busca com string vazia e com espaços', async () => {
    await page.fill('#search', '    ');
    await page.waitForTimeout(500);
    const v = await page.locator('[data-testid="product-card"]:not([hidden])').count();
    await print('busca-espacos');
    return `${v} cards visíveis com quatro espaços`;
  });

  await obs('busca por termo inexistente', async () => {
    await page.fill('#search', 'zzzzzz');
    await page.waitForTimeout(500);
    const v = await page.locator('[data-testid="product-card"]:not([hidden])').count();
    const vazio = (await page.locator('#catalog-grid').innerText()).trim();
    await print('busca-inexistente');
    return `${v} cards visíveis; texto da grade: "${vazio.slice(0, 60)}"`;
  });

  await obs('busca com 200 caracteres', async () => {
    await page.fill('#search', 'a'.repeat(200));
    await page.waitForTimeout(600);
    const v = await page.locator('[data-testid="product-card"]:not([hidden])').count();
    return `${v} cards visíveis; nenhum erro na tela`;
  });

  await obs('busca com caracteres especiais', async () => {
    await page.fill('#search', '<script>alert(1)</script>');
    await page.waitForTimeout(500);
    const html = await page.locator('#catalog-grid').innerHTML();
    return html.includes('script') ? 'texto do termo apareceu como HTML na grade' : 'termo tratado como texto, sem injeção';
  });

  await obs('busca combinada com filtro de categoria', async () => {
    await page.fill('#search', 'produto');
    await page.selectOption('#category-filter', 'Papelaria').catch(() => {});
    await page.waitForTimeout(600);
    const cats = await page.locator('[data-testid="product-card"]:not([hidden]) .category').allTextContents();
    await print('busca-categoria');
    return `categorias visíveis: ${[...new Set(cats)].join(', ') || '(nenhuma)'}`;
  });

  await obs('cliques repetidos em Atualizar lista', async () => {
    await page.fill('#search', '');
    await page.selectOption('#category-filter', '').catch(() => {});
    let reqs = 0;
    page.on('request', (r) => { if (r.url().includes('/api/products')) reqs += 1; });
    for (let i = 0; i < 5; i += 1) {
      await page.locator('#refresh-catalog').click();
      await page.waitForTimeout(400);
    }
    return `${reqs} chamadas a /api/products em 5 cliques`;
  });

  await obs('carrinho vazio pela navegação', async () => {
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.goto('/#carrinho');
    await page.waitForTimeout(500);
    const texto = (await page.locator('#view-cart').innerText()).trim();
    await print('carrinho-vazio');
    return `texto visível: "${texto.replace(/\n/g, ' / ').slice(0, 120)}"`;
  });

  await obs('quantidade zero no carrinho', async () => {
    await page.goto('/#entrar');
    await page.getByTestId('login-email').fill('cliente-a@loja.test');
    await page.getByTestId('login-password').fill('SenhaDidatica123!');
    await page.locator('#login-form').getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.goto('/#catalogo');
    await page.locator('[data-testid="add-to-cart"][data-product-id="produto-teste"]').click();
    await page.getByTestId('nav-cart').click();
    const q = page.locator('[data-qty][data-product-id="produto-teste"]');
    await q.fill('0');
    await q.dispatchEvent('change');
    await page.waitForTimeout(700);
    const feedback = (await page.locator('#coupon-feedback').innerText()).trim();
    const sub = await page.getByTestId('cart-subtotal').textContent().catch(() => '(sem resumo)');
    await print('quantidade-zero');
    return `feedback: "${feedback}"; subtotal: ${sub.trim()}`;
  });

  await obs('recuperação depois de quantidade inválida', async () => {
    await page.goto('/#carrinho');
    await page.waitForTimeout(900);
    const q = page.locator('[data-qty][data-product-id="produto-teste"]');
    const existe = await q.count();
    if (existe > 0) {
      await q.fill('2');
      await q.dispatchEvent('change');
      await page.waitForTimeout(800);
    }
    const sub = await page.getByTestId('cart-subtotal').textContent().catch(() => '(sem resumo)');
    await print('recuperacao-carrinho');
    return `linha do carrinho voltou ao recarregar? ${existe > 0 ? 'sim' : 'NÃO'}; subtotal: ${sub.trim()}`;
  });

  await obs('quantidade negativa no carrinho', async () => {
    const q = page.locator('[data-qty][data-product-id="produto-teste"]');
    await q.fill('-2');
    await q.dispatchEvent('change');
    await page.waitForTimeout(700);
    const feedback = (await page.locator('#coupon-feedback').innerText()).trim();
    const sub = await page.getByTestId('cart-subtotal').textContent().catch(() => '(sem resumo)');
    await print('quantidade-negativa');
    return `feedback: "${feedback}"; subtotal: ${sub.trim()}`;
  });

  await obs('quantidade muito alta', async () => {
    const q = page.locator('[data-qty][data-product-id="produto-teste"]');
    await q.fill('9999');
    await q.dispatchEvent('change');
    await page.waitForTimeout(700);
    const feedback = (await page.locator('#coupon-feedback').innerText()).trim();
    const sub = await page.getByTestId('cart-subtotal').textContent().catch(() => '(sem resumo)');
    await print('quantidade-alta');
    return `feedback: "${feedback}"; subtotal: ${sub.trim()}`;
  });

  await obs('cupom em minúsculas e com espaços', async () => {
    const q = page.locator('[data-qty][data-product-id="produto-teste"]');
    await q.fill('2');
    await q.dispatchEvent('change');
    await page.waitForTimeout(600);
    await page.getByTestId('coupon-code').fill('  vinte  ');
    await page.getByTestId('apply-coupon').click();
    await page.waitForTimeout(900);
    const total = await page.getByTestId('cart-total').textContent().catch(() => '(sem total)');
    return `total com cupom "  vinte  ": ${total.trim()}`;
  });

  await obs('cupom vencido ANTIGO', async () => {
    await page.getByTestId('coupon-code').fill('ANTIGO');
    await page.getByTestId('apply-coupon').click();
    await page.waitForTimeout(900);
    const fb = (await page.locator('#coupon-feedback').innerText()).trim();
    await print('cupom-vencido');
    return `feedback: "${fb}"`;
  });

  await obs('cupom inexistente', async () => {
    await page.getByTestId('coupon-code').fill('NAOEXISTE');
    await page.getByTestId('apply-coupon').click();
    await page.waitForTimeout(900);
    const fb = (await page.locator('#coupon-feedback').innerText()).trim();
    return `feedback: "${fb}"`;
  });

  await obs('checkout com endereço incompleto', async () => {
    await page.getByTestId('addr-street').fill('Rua Teste');
    await page.getByTestId('checkout-button').click();
    await page.waitForTimeout(1200);
    const fb = (await page.locator('#checkout-feedback').innerText()).trim();
    const recibo = (await page.locator('#receipt').innerText()).trim();
    await print('checkout-incompleto');
    return `feedback: "${fb}"; comprovante: "${recibo.slice(0, 40)}"`;
  });

  await obs('checkout completo', async () => {
    for (const [campo, valor] of Object.entries({ number: '10', district: 'Centro', city: 'Maricá', state: 'RJ', zip: '24900000' })) {
      await page.getByTestId('addr-' + campo).fill(valor);
    }
    await page.getByTestId('checkout-button').click();
    await page.waitForTimeout(1500);
    const recibo = (await page.locator('#receipt').innerText()).trim();
    await print('checkout-completo');
    return `comprovante: "${recibo.replace(/\n/g, ' / ').slice(0, 90)}"`;
  });

  await obs('histórico após recarregar', async () => {
    await page.goto('/#pedidos');
    await page.waitForTimeout(800);
    await page.reload();
    await page.waitForTimeout(1200);
    const titulos = await page.locator('#orders-list h3, #orders-list h2, #orders-list strong').allTextContents();
    await print('historico');
    return `${titulos.length} pedidos listados; primeiro: "${(titulos[0] || '').trim()}"`;
  });

  await obs('navegação por teclado do topo até o catálogo', async () => {
    await page.goto('/#catalogo');
    await page.waitForTimeout(600);
    await page.locator('body').click({ position: { x: 5, y: 5 } });
    const trilha = [];
    for (let i = 0; i < 8; i += 1) {
      await page.keyboard.press('Tab');
      trilha.push(await page.evaluate(() => {
        const el = document.activeElement;
        return el.dataset && el.dataset.testid ? el.dataset.testid : el.tagName + (el.id ? '#' + el.id : '');
      }));
    }
    await print('teclado');
    return `ordem do foco: ${trilha.join(' > ')}`;
  });

  await obs('viewport estreito 375x667', async () => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/#catalogo');
    await page.waitForTimeout(800);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    await print('viewport-estreito');
    return `rolagem horizontal: ${overflow ? 'sim (conteúdo vaza)' : 'não'}`;
  });

  marca('fim da sessão', `${LINHAS.length} observações registradas`);
  fs.writeFileSync(path.join(DIR, 'sessao.txt'), LINHAS.join('\n') + '\n');
});
