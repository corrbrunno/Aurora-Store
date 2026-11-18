"use strict";

const { toCents, fromCents, percentOf } = require("./money");
const { now } = require("./clock");

function endOfDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date(0);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function evaluateCoupon(coupon) {
  if (!coupon || coupon.active === false) {
    return { ok: false, message: "Cupom inválido." };
  }
  if (coupon.expiresAt) {
    const limit = endOfDay(coupon.expiresAt);
    if (now().getTime() > limit.getTime()) {
      return { ok: false, message: "Cupom vencido." };
    }
  }
  return { ok: true };
}

function couponBenefit(subtotal, coupon) {
  if (!coupon) return 0;

  if (coupon.type === "percent") {
    return percentOf(subtotal, coupon.value);
  }

  if (coupon.type === "fixed") {
    const benefitCents = toCents(coupon.value);
    const subtotalCents = toCents(subtotal);
    return fromCents(Math.min(benefitCents, subtotalCents));
  }

  return 0;
}

module.exports = {
  evaluateCoupon,
  couponBenefit,
};
