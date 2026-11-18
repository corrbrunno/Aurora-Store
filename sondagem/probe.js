'use strict';
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://127.0.0.1:3000';
const FASE = (process.argv[2] || '').toLowerCase();
const STATE = path.join(__dirname, 'estado.json');

function load() {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { return {}; }
}
function save(s) { fs.writeFileSync(STATE, JSON.stringify(s, null, 1)); }

let seq = 0;
async function call(desc, method, route, { body, token } = {}) {
  seq += 1;
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  let res, text, json = null;
  try {
    res = await fetch(BASE + route, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    text = await res.text();
    try { json = JSON.parse(text); } catch { /* corpo nao-JSON */ }
  } catch (e) {
    console.log(`\n### ${desc}`);
    console.log(`${method} ${route} -> ERRO DE REDE: ${e.message}`);
    return { status: 0, json: null, text: '' };
  }
  const corpo = text.length > 700 ? text.slice(0, 700) + ` ...[+${text.length - 700} bytes]` : text;
  console.log(`\n### ${desc}`);
  console.log(`${method} ${route} -> ${res.status}`);
  console.log(`corpo: ${corpo}`);
  return { status: res.status, json, text };
}

async function login(email, senha) {
  const r = await call(`login ${email}`, 'POST', '/api/auth/login', { body: { email, password: senha } });
  return r.json && r.json.token ? r.json.token : null;
}

const enderecoCompleto = {
  street: 'Rua Teste', number: '10', district: 'Centro',
  city: 'Maricá', state: 'RJ', zip: '24900000',
};
const SENHA = 'SenhaDidatica123!';

(async () => {
  console.log(`SONDAGEM — fase ${FASE.toUpperCase()} — base ${BASE}`);
  console.log(`executado em ${new Date().toISOString()}`);

  if (FASE === 'f1') {
    const emailNovo = `probe.${Date.now()}@loja.test`;
    await call('cadastro valido', 'POST', '/api/auth/register', {
      body: { name: 'Cliente Probe', email: emailNovo, password: 'SenhaProbe123' },
    });
    await call('cadastro com e-mail ja existente', 'POST', '/api/auth/register', {
      body: { name: 'Cliente Probe', email: emailNovo, password: 'SenhaProbe123' },
    });
    await call('cadastro com senha curta (3 caracteres)', 'POST', '/api/auth/register', {
      body: { name: 'Cliente Probe', email: `p2.${Date.now()}@loja.test`, password: '123' },
    });
    await call('cadastro com nome de 2 letras', 'POST', '/api/auth/register', {
      body: { name: 'Jo', email: `p3.${Date.now()}@loja.test`, password: 'SenhaProbe123' },
    });
    await call('cadastro com e-mail sem arroba', 'POST', '/api/auth/register', {
      body: { name: 'Cliente Probe', email: 'invalido', password: 'SenhaProbe123' },
    });
    const t = await login('cliente-a@loja.test', SENHA);
    await call('login com senha errada', 'POST', '/api/auth/login', {
      body: { email: 'cliente-a@loja.test', password: 'errada' },
    });
    await call('login de usuario inexistente', 'POST', '/api/auth/login', {
      body: { email: 'naoexiste@loja.test', password: SENHA },
    });
    if (t) {
      await call('me com token valido', 'GET', '/api/auth/me', { token: t });
      await call('logout', 'POST', '/api/auth/logout', { token: t });
      await call('me depois do logout (token deve ser invalidado)', 'GET', '/api/auth/me', { token: t });
    }
  }

  if (FASE === 'f2') {
    const r = await call('catalogo publico', 'GET', '/api/products');
    if (Array.isArray(r.json)) {
      console.log(`>>> itens: ${r.json.length}`);
      console.log(`>>> campos do 1o item: ${Object.keys(r.json[0] || {}).join(', ')}`);
      console.log(`>>> tamanho da resposta: ${r.text.length} bytes`);
    }
    const b = await call('busca por texto (busca=papelaria)', 'GET', '/api/products?busca=papelaria');
    if (Array.isArray(b.json)) console.log(`>>> itens com ?busca=papelaria: ${b.json.length}`);
    const c = await call('filtro por categoria (categoria=Papelaria)', 'GET', '/api/products?categoria=Papelaria');
    if (Array.isArray(c.json)) console.log(`>>> itens com ?categoria=Papelaria: ${c.json.length}`);
    await call('produto-teste por id', 'GET', '/api/products/produto-teste');
    await call('produto inexistente', 'GET', '/api/products/nao-existe');
  }

  if (FASE === 'f3') {
    await call('cotacao de 2 x produto-teste (subtotal 300)', 'POST', '/api/cart/quote', {
      body: { items: [{ productId: 'produto-teste', quantity: 2 }] },
    });
    const t = await login('cliente-a@loja.test', SENHA);
    await call('estoque antes da compra', 'GET', '/api/products/produto-teste');
    if (t) {
      await call('checkout de 2 unidades', 'POST', '/api/checkout', {
        token: t, body: { items: [{ productId: 'produto-teste', quantity: 2 }], address: enderecoCompleto },
      });
      await call('estoque depois da compra', 'GET', '/api/products/produto-teste');
      await call('checkout de 6 unidades com estoque 5', 'POST', '/api/checkout', {
        token: t, body: { items: [{ productId: 'produto-teste', quantity: 6 }], address: enderecoCompleto },
      });
      await call('checkout com quantidade 0', 'POST', '/api/checkout', {
        token: t, body: { items: [{ productId: 'produto-teste', quantity: 0 }], address: enderecoCompleto },
      });
      await call('checkout com quantidade -1', 'POST', '/api/checkout', {
        token: t, body: { items: [{ productId: 'produto-teste', quantity: -1 }], address: enderecoCompleto },
      });
      await call('checkout com quantidade fracionaria 1.5', 'POST', '/api/checkout', {
        token: t, body: { items: [{ productId: 'produto-teste', quantity: 1.5 }], address: enderecoCompleto },
      });
      await call('checkout acima do estoque: estoque final', 'GET', '/api/products/produto-teste');
    }
  }

  if (FASE === 'f4') {
    const t = await login('cliente-a@loja.test', SENHA);
    if (t) {
      await call('checkout so com a rua (endereco incompleto)', 'POST', '/api/checkout', {
        token: t, body: { items: [{ productId: 'produto-teste', quantity: 1 }], address: { street: 'Rua Teste' } },
      });
      await call('checkout com endereco completo', 'POST', '/api/checkout', {
        token: t, body: { items: [{ productId: 'produto-teste', quantity: 1 }], address: enderecoCompleto },
      });
    }
  }

  if (FASE === 'f5') {
    await call('cotacao com cupom ANTIGO (vencido em 06/10/2026)', 'POST', '/api/cart/quote', {
      body: { items: [{ productId: 'produto-teste', quantity: 2 }], couponCode: 'ANTIGO' },
    });
    await call('cotacao com cupom VINTE (20% valido)', 'POST', '/api/cart/quote', {
      body: { items: [{ productId: 'produto-teste', quantity: 2 }], couponCode: 'VINTE' },
    });
    await call('cotacao com cupom CINCO (5% valido)', 'POST', '/api/cart/quote', {
      body: { items: [{ productId: 'produto-teste', quantity: 2 }], couponCode: 'CINCO' },
    });
    await call('cotacao com cupom inexistente', 'POST', '/api/cart/quote', {
      body: { items: [{ productId: 'produto-teste', quantity: 2 }], couponCode: 'NAOEXISTE' },
    });
    const t = await login('cliente-a@loja.test', SENHA);
    if (t) {
      await call('checkout aceitando cupom vencido ANTIGO', 'POST', '/api/checkout', {
        token: t,
        body: { items: [{ productId: 'produto-teste', quantity: 2 }], address: enderecoCompleto, couponCode: 'ANTIGO' },
      });
    }
  }

  if (FASE === 'f6') {
    const a = await login('cliente-a@loja.test', SENHA);
    const b = await login('cliente-b@loja.test', SENHA);
    if (a) {
      const compra = await call('checkout do cliente-a para gerar pedido', 'POST', '/api/checkout', {
        token: a, body: { items: [{ productId: 'produto-teste', quantity: 1 }], address: enderecoCompleto },
      });
      const id = compra.json && compra.json.order ? compra.json.order.id : null;
      console.log(`>>> pedido criado: ${id}`);
      const st = load(); st[FASE] = { pedido: id }; save(st);

      if (b) {
        await call('cliente-b consulta o pedido do cliente-a (RN-10)', 'GET', `/api/orders/${id}`, { token: b });
        await call('historico do cliente-b', 'GET', '/api/orders', { token: b });
        await call('historico do cliente-a', 'GET', '/api/orders', { token: a });
      }
      await call('pedido sem token', 'GET', `/api/orders/${id}`);
      const preco = await call('checkout enviando unitPrice 1 para produto de 150', 'POST', '/api/checkout', {
        token: a,
        body: {
          items: [{ productId: 'produto-teste', quantity: 1, unitPrice: 1 }],
          address: enderecoCompleto,
        },
      });
      console.log(`>>> total gravado pelo servidor: ${preco.json && preco.json.order ? preco.json.order.total : 'n/a'}`);
    }
  }

  if (FASE === 'f7a') {
    const a = await login('cliente-a@loja.test', SENHA);
    if (a) {
      const compra = await call('cria pedido para testar persistencia', 'POST', '/api/checkout', {
        token: a, body: { items: [{ productId: 'produto-teste', quantity: 1 }], address: enderecoCompleto },
      });
      const id = compra.json && compra.json.order ? compra.json.order.id : null;
      const st = load(); st.persistencia = { pedido: id }; save(st);
      console.log(`>>> guardado para consulta pos-restart: ${id}`);
    }
  }

  if (FASE === 'f7b') {
    const st = load();
    const id = st.persistencia ? st.persistencia.pedido : null;
    console.log(`>>> pedido guardado antes do restart: ${id}`);
    const a = await login('cliente-a@loja.test', SENHA);
    if (a && id) {
      await call('consulta do pedido depois de reiniciar o servidor (sem reset)', 'GET', `/api/orders/${id}`, { token: a });
      await call('historico do cliente-a depois do restart', 'GET', '/api/orders', { token: a });
    }
  }


  if (FASE === 'f8') {
    // autorizacao com pedido que existe no arquivo (nao depende de persistir pedido novo)
    const a = await login('cliente-a@loja.test', SENHA);
    const b = await login('cliente-b@loja.test', SENHA);
    const admin = await login('admin@loja.test', SENHA);
    if (b) await call('controle: cliente-b consulta o proprio pedido do dataset', 'GET', '/api/orders/pedido-cliente-b', { token: b });
    if (a) await call('cliente-a consulta o pedido do cliente-b (RN-10)', 'GET', '/api/orders/pedido-cliente-b', { token: a });

    // RN-01: limite exato de R$ 200,00
    await call('cotacao de 1 x produto-0001 (R$ 200,00 exatos) — desconto deve ser 20', 'POST', '/api/cart/quote', {
      body: { items: [{ productId: 'produto-0001', quantity: 1 }] },
    });
    await call('cotacao de 1 x produto abaixo do limite (produto-teste R$ 150)', 'POST', '/api/cart/quote', {
      body: { items: [{ productId: 'produto-teste', quantity: 1 }] },
    });

    // RN-06: arredondamento half-up com meio centavo
    if (admin) {
      const novo = await call('admin cria produto de R$ 200,05 para o teste de arredondamento', 'POST', '/api/admin/products', {
        token: admin, body: { name: 'Produto Arredondamento', price: 200.05, stock: 10 },
      });
      const pid = novo.json && novo.json.id ? novo.json.id : 'produto-arredondamento';
      console.log(`>>> produto criado: ${pid}`);
      await call('cotacao de 1 unidade de R$ 200,05 — desconto de 10% deve ser 20,01', 'POST', '/api/cart/quote', {
        body: { items: [{ productId: pid, quantity: 1 }] },
      });
    }
  }

  console.log(`\nFIM DA FASE ${FASE.toUpperCase()}`);
})();
