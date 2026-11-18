'use strict';
// CT-I01 a CT-I05 — testes de integração contra a API HTTP em execução.
// Exige o servidor no ar: node server.js (padrão http://127.0.0.1:3000).
const test = require('node:test');
const assert = require('node:assert/strict');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3000';

async function chamar(rota, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(BASE + rota, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const texto = await r.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* corpo vazio */ }
  return { status: r.status, json };
}

async function entrar(email = 'cliente-a@loja.test') {
  const r = await chamar('/api/auth/login', { method: 'POST', body: { email, password: 'SenhaDidatica123!' } });
  assert.equal(r.status, 200, 'pre-condicao: login deve funcionar');
  return r.json.token;
}

const endereco = { street: 'Rua Teste', number: '10', district: 'Centro', city: 'Maricá', state: 'RJ', zip: '24900000' };

test('CT-I01 — checkout reduz o estoque e grava o pedido (RN-08)', async () => {
  const token = await entrar();
  const antes = await chamar('/api/products/produto-teste');
  assert.equal(antes.status, 200);
  const estoque = antes.json.stock;
  assert.ok(estoque >= 1, 'base precisa ter estoque para o teste');

  const compra = await chamar('/api/checkout', {
    method: 'POST', token, body: { items: [{ productId: 'produto-teste', quantity: 1 }], address: endereco },
  });
  assert.equal(compra.status, 201);
  assert.ok(compra.json.order.id, 'pedido precisa ter identificador');

  const depois = await chamar('/api/products/produto-teste');
  assert.equal(depois.json.stock, estoque - 1);
});

test('CT-I02 — pedido criado continua consultável pela API (RN-08)', async () => {
  const token = await entrar();
  const compra = await chamar('/api/checkout', {
    method: 'POST', token, body: { items: [{ productId: 'produto-teste', quantity: 1 }], address: endereco },
  });
  assert.equal(compra.status, 201);
  const id = compra.json.order.id;

  const consulta = await chamar('/api/orders/' + id, { token });
  assert.equal(consulta.status, 200);
  assert.equal(consulta.json.id, id);

  const lista = await chamar('/api/orders', { token });
  assert.equal(lista.status, 200);
  assert.ok(lista.json.some((p) => p.id === id), 'pedido deve aparecer no historico do cliente');
});

test('CT-I03 — checkout recusa endereço incompleto (RN-13)', async () => {
  const token = await entrar();
  const r = await chamar('/api/checkout', {
    method: 'POST', token, body: { items: [{ productId: 'produto-teste', quantity: 1 }], address: { street: 'Rua Teste' } },
  });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /incompleto/i);
});

test('CT-I04 — checkout recusa cupom vencido (RN-04)', async () => {
  const token = await entrar();
  const r = await chamar('/api/checkout', {
    method: 'POST', token,
    body: { items: [{ productId: 'produto-teste', quantity: 1 }], address: endereco, couponCode: 'ANTIGO' },
  });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /vencido/i);
});

test('CT-I05 — cupom válido não acumula com o desconto automático (RN-05)', async () => {
  const r = await chamar('/api/cart/quote', {
    method: 'POST', body: { items: [{ productId: 'produto-teste', quantity: 2 }], couponCode: 'VINTE' },
  });
  assert.equal(r.status, 200);
  assert.equal(r.json.subtotal, 300);
  assert.equal(r.json.discount, 60);
  assert.equal(r.json.shipping, 0);
  assert.equal(r.json.total, 240);
});
