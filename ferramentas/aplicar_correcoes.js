'use strict';
// Aplica as correcoes da campanha P2 sobre a copia 'corrigido'.
// Cada patch falha se o trecho original nao existir exatamente uma vez.
const fs = require('fs');
const path = require('path');

const ROOT = process.argv[2];
if (!ROOT) { console.error('uso: node aplicar_correcoes.js <pasta-projeto>'); process.exit(1); }

const log = [];
let falhas = 0;

function patch(rel, oldStr, newStr, rotulo) {
  const file = path.join(ROOT, rel);
  const src = fs.readFileSync(file, 'utf8');
  const n = src.split(oldStr).length - 1;
  if (n !== 1) {
    falhas += 1;
    log.push(`FALHA  ${rotulo} | ${rel} | ocorrencias=${n}`);
    return;
  }
  fs.writeFileSync(file, src.replace(oldStr, newStr));
  log.push(`ok     ${rotulo} | ${rel}`);
}

function patchRegex(rel, re, newStr, rotulo) {
  const file = path.join(ROOT, rel);
  const src = fs.readFileSync(file, 'utf8');
  const m = src.match(re);
  if (!m) {
    falhas += 1;
    log.push(`FALHA  ${rotulo} | ${rel} | trecho nao encontrado`);
    return;
  }
  fs.writeFileSync(file, src.replace(re, newStr));
  log.push(`ok     ${rotulo} | ${rel}`);
}

// ---------- BUG-02 ----------
patch('src/domain/discount.js',
  'if (!(Number(subtotal) > AUTO_DISCOUNT_MIN_SUBTOTAL)) {',
  'if (!(Number(subtotal) >= AUTO_DISCOUNT_MIN_SUBTOTAL)) {',
  'BUG-02 desconto no limite de 200');

// ---------- BUG-03 ----------
patch('src/domain/money.js',
  'const resultCents = Math.trunc((cents * Number(percent)) / 100);',
  'const resultCents = Math.round((cents * Number(percent)) / 100);',
  'BUG-03 arredondamento half-up');

// ---------- BUG-01 ----------
patch('src/domain/shipping.js',
  '  const considered = Math.trunc((cents * 9) / 10);\n  if (considered >= toCents(FREE_SHIPPING_MIN_SUBTOTAL)) {',
  '  if (cents >= toCents(FREE_SHIPPING_MIN_SUBTOTAL)) {',
  'BUG-01 frete gratis a partir de 300');

// ---------- BUG-05 ----------
patch('src/domain/quantity.js',
  '  if (value === 0) {',
  '  if (value <= 0) {',
  'BUG-05 quantidade negativa');

// ---------- BUG-04 ----------
patch('src/domain/orderTotals.js',
  'total: fromCents(toCents(subtotal) + toCents(shipping)),',
  'total: fromCents(toCents(subtotal) - toCents(discount) + toCents(shipping)),',
  'BUG-04 total subtrai o desconto');

// ---------- BUG-10 ----------
patch('src/domain/coupon.js',
  'const { toCents, fromCents, percentOf } = require("./money");',
  'const { toCents, fromCents, percentOf } = require("./money");\nconst { now } = require("./clock");\n\nfunction endOfDay(value) {\n  const date = new Date(value);\n  if (Number.isNaN(date.getTime())) return new Date(0);\n  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));\n}',
  'BUG-10 importa clock e fim do dia');

patchRegex('src/domain/coupon.js',
  /function evaluateCoupon\(coupon\) \{[\s\S]*?\n\}/,
  [
    'function evaluateCoupon(coupon) {',
    '  if (!coupon || coupon.active === false) {',
    '    return { ok: false, message: "Cupom inv\u00e1lido." };',
    '  }',
    '  if (coupon.expiresAt) {',
    '    const limit = endOfDay(coupon.expiresAt);',
    '    if (now().getTime() > limit.getTime()) {',
    '      return { ok: false, message: "Cupom vencido." };',
    '    }',
    '  }',
    '  return { ok: true };',
    '}',
  ].join('\n'),
  'BUG-10 validade do cupom');

// ---------- BUG-09 ----------
patchRegex('src/domain/address.js',
  /function normalizeAddress\(input\) \{[\s\S]*?\n\}/,
  [
    'function normalizeAddress(input) {',
    '  const source = input && typeof input === "object" ? input : {};',
    '  const address = {};',
    '  const missing = [];',
    '  for (const field of FIELDS) {',
    '    address[field] = String(source[field] ?? "").trim();',
    '    if (!address[field]) missing.push(field);',
    '  }',
    '  if (missing.length > 0) {',
    '    return { ok: false, message: `Endere\u00e7o de entrega incompleto: informe ${missing.join(", ")}.` };',
    '  }',
    '  return { ok: true, address };',
    '}',
  ].join('\n'),
  'BUG-09 endereco completo');

// ---------- BUG-11 ----------
patch('src/services/checkout.js',
  'function resolveUnitPrice(product, requested) {\n  if (requested !== undefined && requested !== null && requested !== "") {\n    const price = Number(requested);\n    if (Number.isFinite(price)) return price;\n  }\n  return Number(product.price);\n}',
  'function resolveUnitPrice(product) {\n  return Number(product.price);\n}',
  'BUG-11 ignora preco enviado pelo cliente');

// ---------- BUG-06 ----------
patch('src/services/checkout.js',
  '    const unitPrice = resolveUnitPrice(product, item.unitPrice);',
  '    if (Number(item.quantity) > Number(product.stock)) {\n      return { ok: false, status: 400, error: `Estoque insuficiente: dispon\u00edvel ${product.stock}.` };\n    }\n    const unitPrice = resolveUnitPrice(product);',
  'BUG-06 valida estoque no checkout');

// ---------- BUG-09 (uso no checkout) ----------
patch('src/services/checkout.js',
  '  const addressResult = normalizeAddress(body.address);\n  const totals = totalsForOrder(quote);',
  '  const addressResult = normalizeAddress(body.address);\n  if (!addressResult.ok) {\n    return { ok: false, status: 400, error: addressResult.message };\n  }\n  const totals = totalsForOrder(quote);',
  'BUG-09 recusa endereco incompleto');

// ---------- BUG-07 ----------
patch('src/services/checkout.js',
  '  db.addOrder(order);',
  '  db.addOrder(order);\n\n  const quantities = new Map();\n  for (const item of order.items) {\n    quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);\n  }\n  for (const [productId, quantity] of quantities) {\n    const product = db.findProduct(productId);\n    db.updateProduct(productId, { stock: Number(product.stock) - quantity });\n  }',
  'BUG-07 baixa o estoque na finalizacao');

// ---------- BUG-08 ----------
patch('src/persistence/database.js',
  '  function persist() {\n    const onDisk = readFile(filePath);\n    const next = {\n      users: state.users,\n      products: state.products,\n      coupons: state.coupons,\n      sessions: state.sessions,\n      orders: onDisk.orders,\n    };',
  '  function persist() {\n    const next = {\n      users: state.users,\n      products: state.products,\n      coupons: state.coupons,\n      sessions: state.sessions,\n      orders: state.orders,\n    };',
  'BUG-08 persist grava os pedidos do estado');

patch('src/persistence/database.js',
  '    addOrder(order) {\n      state.orders.push(order);\n    },',
  '    addOrder(order) {\n      state.orders.push(order);\n      persist();\n    },',
  'BUG-08 addOrder persiste');

// ---------- BUG-12 ----------
patch('src/routes/api.js',
  '    const order = db.findOrder(decodeURIComponent(orderMatch[1]));\n    if (!order) {',
  '    const order = db.findOrder(decodeURIComponent(orderMatch[1]));\n    if (!order || (order.userId !== user.id && user.role !== "admin")) {',
  'BUG-12 pedido so do proprio dono');

// ---------- BUG-13 (solucao do autor) ----------
patch('src/routes/api.js',
  '  if (name.length < 3 || !emailOk || password.length < 6 || duplicate) {\n    return { ok: false };\n  }',
  '  if (name.length < 3) {\n    return { ok: false, message: "Nome de usu\u00e1rio deve ter 3 ou mais caracteres" };\n  }\n  if (!emailOk) {\n    return { ok: false, message: "Digite um email v\u00e1lido" };\n  }\n  if (duplicate) {\n    return { ok: false, message: "Email j\u00e1 cadastrado" };\n  }\n  if (password.length < 6) {\n    return { ok: false, message: "Senha deve ter 6 ou mais caracteres" };\n  }',
  'BUG-13 canRegister com mensagem por campo');

patchRegex('src/routes/api.js',
  /send\(res, 400, \{ error: "Dados inv[^"]*" \}\);/,
  'send(res, 400, { error: result.message });',
  'BUG-13 rota devolve a mensagem do campo');

// ---------- verificacao de quem usa evaluateCoupon ----------
const pricing = fs.readFileSync(path.join(ROOT, 'src/domain/pricing.js'), 'utf8');
log.push(`info   pricing.js referencia evaluateCoupon: ${/evaluateCoupon/.test(pricing)}`);

log.push('');
log.push(falhas === 0 ? 'RESULTADO: todos os patches aplicados' : `RESULTADO: ${falhas} patch(es) falharam`);
const texto = log.join('\n');
console.log(texto);
fs.writeFileSync(path.join(__dirname, 'relatorio_correcoes.txt'), texto + '\n');
process.exit(falhas === 0 ? 0 : 2);
