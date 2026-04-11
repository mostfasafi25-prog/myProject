export function parseNonNegativeNumber(n) {
  const x = Number(n);
  return Number.isFinite(x) && x >= 0 ? x : 0;
}

/** متوسط تكلفة الوحدة بعد دمج مخزون قديم + مشترى + بونص (البونص بتكلفة 0). */
export function weightedAverageUnitCost(prevQty, prevUnitCost, paidQty, purchaseUnitCost, bonusQty) {
  const pq = parseNonNegativeNumber(prevQty);
  const pc = parseNonNegativeNumber(prevUnitCost);
  const nq = parseNonNegativeNumber(paidQty);
  const nu = parseNonNegativeNumber(purchaseUnitCost);
  const bq = parseNonNegativeNumber(bonusQty);
  const totalQty = pq + nq + bq;
  if (totalQty <= 0) return 0;
  const value = pq * pc + nq * nu + bq * 0;
  return Number((value / totalQty).toFixed(4));
}

/** تكلفة وحدة المخزون (شراء) — تُفضّل costPrice المحفوظة؛ للأصناف القديمة بدون تكلفة تُستخدم سعر البيع كتقريب فقط. */
export function unitInventoryCost(p) {
  if (!p || typeof p !== "object") return 0;
  const raw = p.costPrice ?? p.cost_price ?? p.purchaseUnitPrice ?? p.purchase_unit_price;
  const c = Number(raw);
  if (Number.isFinite(c) && c >= 0) return c;
  return parseNonNegativeNumber(p.price);
}
