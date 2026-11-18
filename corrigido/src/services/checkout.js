"use strict";

const { isListedInCatalog } = require("../domain/catalog");
const { quoteLines } = require("../domain/pricing");
const { totalsForOrder } = require("../domain/orderTotals");
const { normalizeAddress } = require("../domain/address");

const recentCheckouts = new Map();
const CHECKOUT_WINDOW_MS = 5000;

function fingerprint(userId, body) {
  const items = (body.items || [])
    .map((item) => `${item.productId}:${item.quantity}:${item.unitPrice ?? ""}`)
    .sort()
    .join(",");
  const address = JSON.stringify(body.address || {});
  return `${userId}|${items}|${body.couponCode || ""}|${address}`;
}

function resolveUnitPrice(product) {
  return Number(product.price);
}

function placeOrder(db, user, body) {
  const key = fingerprint(user.id, body || {});
  const previous = recentCheckouts.get(key);
  if (previous && Date.now() - previous.at < CHECKOUT_WINDOW_MS) {
    return previous.result;
  }

  const itemsInput = Array.isArray(body.items) ? body.items : [];
  const lines = [];

  for (const item of itemsInput) {
    const product = db.findProduct(item.productId);
    if (!isListedInCatalog(product)) {
      return { ok: false, status: 400, error: "Produto não encontrado." };
    }

    if (Number(item.quantity) > Number(product.stock)) {
      return { ok: false, status: 400, error: `Estoque insuficiente: disponível ${product.stock}.` };
    }
    const unitPrice = resolveUnitPrice(product);
    lines.push({
      productId: product.id,
      name: product.name,
      unitPrice,
      quantity: item.quantity,
    });
  }

  let coupon = null;
  if (body.couponCode) {
    coupon = db.findCoupon(body.couponCode);
    if (!coupon) {
      return { ok: false, status: 400, error: "Cupom inválido." };
    }
  }

  const quote = quoteLines({ lines, coupon });
  if (!quote.ok) {
    return { ok: false, status: 400, error: quote.message };
  }

  const addressResult = normalizeAddress(body.address);
  if (!addressResult.ok) {
    return { ok: false, status: 400, error: addressResult.message };
  }
  const totals = totalsForOrder(quote);
  const order = {
    id: db.nextOrderId(),
    userId: user.id,
    createdAt: new Date().toISOString(),
    items: quote.items,
    subtotal: totals.subtotal,
    discount: totals.discount,
    shipping: totals.shipping,
    total: totals.total,
    couponCode: coupon ? coupon.code : null,
    benefit: quote.benefit,
    address: addressResult.address,
    status: "confirmado",
  };

  db.addOrder(order);

  const quantities = new Map();
  for (const item of order.items) {
    quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
  }
  for (const [productId, quantity] of quantities) {
    const product = db.findProduct(productId);
    db.updateProduct(productId, { stock: Number(product.stock) - quantity });
  }

  const result = { ok: true, status: 201, order };
  recentCheckouts.set(key, { at: Date.now(), result });
  return result;
}

module.exports = {
  placeOrder,
};
