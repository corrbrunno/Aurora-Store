'use strict';
// CT-U01 a CT-U04 — testes unitários das regras de negócio (funções isoladas).
const test = require('node:test');
const assert = require('node:assert/strict');
const { automaticDiscount } = require('../../src/domain/discount');
const { percentOf } = require('../../src/domain/money');
const { validateQuantity } = require('../../src/domain/quantity');
const { shippingCost } = require('../../src/domain/shipping');

test('CT-U01 — desconto automatico respeita a fronteira de R$ 200,00 (RN-01)', () => {
  assert.equal(automaticDiscount(199.99), 0);
  assert.equal(automaticDiscount(200), 20);
  assert.equal(automaticDiscount(300), 30);
});

test('CT-U02 — percentual arredonda meio centavo para cima (RN-06)', () => {
  assert.equal(percentOf(200.05, 10), 20.01);
  assert.equal(percentOf(200.04, 10), 20);
});

test('CT-U03 — quantidade precisa ser inteira e positiva (RN-03)', () => {
  assert.equal(validateQuantity(0).ok, false);
  assert.equal(validateQuantity(-1).ok, false);
  assert.equal(validateQuantity(1.5).ok, false);
  assert.equal(validateQuantity(2).ok, true);
});

test('CT-U04 — frete gratis a partir de R$ 300,00 do subtotal (RN-02)', () => {
  assert.equal(shippingCost(299.99), 18.5);
  assert.equal(shippingCost(300), 0);
  assert.equal(shippingCost(300.01), 0);
});
