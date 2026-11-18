"use strict";

const FIELDS = ["street", "number", "district", "city", "state", "zip"];

function normalizeAddress(input) {
  const source = input && typeof input === "object" ? input : {};
  const address = {};
  const missing = [];
  for (const field of FIELDS) {
    address[field] = String(source[field] ?? "").trim();
    if (!address[field]) missing.push(field);
  }
  if (missing.length > 0) {
    return { ok: false, message: `Endereço de entrega incompleto: informe ${missing.join(", ")}.` };
  }
  return { ok: true, address };
}

module.exports = {
  normalizeAddress,
  FIELDS,
};
