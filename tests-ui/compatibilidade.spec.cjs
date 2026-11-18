'use strict';
const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const RAIZ = path.join(__dirname, '..');
const limpa = (s) => String(s).replace(/\s/g, ' ').trim();
const dir = () => {
  const d = path.join(RAIZ, 'evidencias', 'CT-C01');
  fs.mkdirSync(d, { recursive: true });
  return d;
};

test('CT-C01 — mesma tarefa nos dois navegadores', async ({ page }, testInfo) => {
  const d = dir();
  const projeto = testInfo.project.name;
  await page.addInitScript(() => localStorage.clear());

  // tarefa: entrar, adicionar 2 unidades, aplicar cupom VINTE, ler os totais
  await page.goto('/#entrar');
  await expect(page.locator('#view-login')).toBeVisible();
  await page.getByTestId('login-email').fill('cliente-a@loja.test');
  await page.getByTestId('login-password').fill('SenhaDidatica123!');
  await page.locator('#login-form').getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.locator('#view-catalog')).toBeVisible();

  const layoutCatalogo = await page.evaluate(() => {
    const grid = document.getElementById('catalog-grid');
    const card = document.querySelector('[data-testid="product-card"]');
    const cs = card ? getComputedStyle(card) : null;
    return {
      larguraGrid: grid ? Math.round(grid.getBoundingClientRect().width) : null,
      colunasGrid: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : null,
      alturaCard: card ? Math.round(card.getBoundingClientRect().height) : null,
      fonteCard: cs ? cs.fontFamily : null,
      cardsNoCatalogo: document.querySelectorAll('[data-testid="product-card"]').length,
      overflowHorizontal: document.documentElement.scrollWidth > window.innerWidth,
    };
  });

  const add = page.locator('[data-testid="add-to-cart"][data-product-id="produto-teste"]');
  await add.click();
  await add.click();
  await page.getByTestId('nav-cart').click();
  await expect(page.locator('#view-cart')).toBeVisible();
  await page.getByTestId('coupon-code').fill('VINTE');
  await page.getByTestId('apply-coupon').click();
  await page.waitForTimeout(1200);

  const ler = async (id) => limpa(await page.getByTestId(id).textContent());
  const totais = {
    subtotal: await ler('cart-subtotal'),
    desconto: await ler('cart-discount'),
    frete: await ler('cart-shipping'),
    total: await ler('cart-total'),
  };

  const ambiente = {
    userAgent: await page.evaluate(() => navigator.userAgent),
    larguraJanela: page.viewportSize().width,
    alturaJanela: page.viewportSize().height,
    alturaDocumento: await page.evaluate(() => document.documentElement.scrollHeight),
    ...layoutCatalogo,
  };

  const dados = { projeto, totais, ambiente };
  fs.writeFileSync(path.join(d, `compat-${projeto}.json`), JSON.stringify(dados, null, 1));
  await page.screenshot({ path: path.join(d, `print-${projeto}.png`), fullPage: false });

  // o resultado da tarefa tem de ser o mesmo nos dois navegadores
  expect(totais.subtotal).toBe('R$ 300,00');
  expect(totais.desconto).toBe('R$ 60,00');
  expect(totais.frete).toBe('R$ 0,00');
  expect(totais.total).toBe('R$ 240,00');
  expect(ambiente.overflowHorizontal).toBe(false);
});
