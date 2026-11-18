'use strict';
// CT-B01 e CT-B02 — caixa-preta por particao de equivalencia e analise de valor-limite.
// Cria produtos com preco exato nas fronteiras e cota 1 unidade de cada um.
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const EV = path.join(__dirname, '..', 'evidencias');

async function api(method, route, { body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(BASE + route, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const t = await r.text();
  let j = null;
  try { j = JSON.parse(t); } catch { /* sem corpo json */ }
  return { status: r.status, json: j, text: t };
}

(async () => {
  const login = await api('POST', '/api/auth/login', { body: { email: 'admin@loja.test', password: 'SenhaDidatica123!' } });
  const token = login.json.token;

  const precos = [199.99, 200.0, 200.01, 299.99, 300.0, 300.01];
  const criados = {};
  for (const p of precos) {
    const r = await api('POST', '/api/admin/products', {
      token,
      body: { name: `Fronteira ${p.toFixed(2)}`, price: p, stock: 10 },
    });
    criados[p] = r.json.id;
    console.log(`criado ${p.toFixed(2)} -> ${r.json.id} (HTTP ${r.status})`);
  }

  const cotar = async (p) => {
    const r = await api('POST', '/api/cart/quote', { body: { items: [{ productId: criados[p], quantity: 1 }] } });
    const q = r.json || {};
    return { preco: p, status: r.status, subtotal: q.subtotal, desconto: q.discount, frete: q.shipping, total: q.total };
  };

  const desconto = [];
  for (const p of [199.99, 200.0, 200.01]) desconto.push(await cotar(p));
  const frete = [];
  for (const p of [299.99, 300.0, 300.01]) frete.push(await cotar(p));

  console.log('\n--- CT-B02 desconto (fronteira de R$ 200,00)');
  for (const d of desconto) console.log(`${d.preco.toFixed(2)} -> desconto ${d.desconto} | total ${d.total}`);
  console.log('\n--- CT-B01 frete (fronteira de R$ 300,00)');
  for (const f of frete) console.log(`${f.preco.toFixed(2)} -> frete ${f.frete} | total ${f.total}`);

  const escrever = (id, dados, tecnica, observacao) => {
    const dir = path.join(EV, id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'resultado.json'), JSON.stringify({ tecnica, dados }, null, 1));
    fs.writeFileSync(path.join(dir, 'observacao.txt'),
      `tecnica: ${tecnica}\n` +
      dados.map((d) => `${d.preco.toFixed(2)} -> desconto ${d.desconto}, frete ${d.frete}, total ${d.total} (HTTP ${d.status})`).join('\n') +
      `\n${observacao}\n`);
  };

  escrever('CT-B01', frete, 'analise de valor-limite na particao do frete (abaixo / exatamente / acima de R$ 300,00)',
    'Esperado: 299,99 paga 18,50; 300,00 e 300,01 com frete zero.');
  escrever('CT-B02', desconto, 'particao de equivalencia com valor-limite na fronteira do desconto (abaixo / exatamente / acima de R$ 200,00)',
    'Esperado: 199,99 sem desconto; 200,00 e 200,01 com 10%.');
})();
