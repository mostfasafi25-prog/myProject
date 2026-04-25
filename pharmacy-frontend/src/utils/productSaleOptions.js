/**
 * خيارات بيع اختيارية للصنف (مثل حجم الحبة) — تُخزَّن في المنتج كـ saleOptions[]
 * @typedef {{ id: string, label: string, price: number, costPrice: number, qty: number|null, qtyPaid: number|null, qtyBonus: number|null, min: number|null, priceDelta: number, expiryDate: string }} SaleOption
 */

/** @param {unknown} product */
export function normalizeSaleOptions(product) {
  const raw = product?.saleOptions;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((o, i) => {
      if (!o || typeof o !== "object") return null;
      const id = String(o.id ?? `opt-${i}`).trim() || `opt-${i}`;
      const label = String(o.label ?? "").trim();
      if (!label) return null;
      const p = Number(o.price);
      const c = Number(o.costPrice ?? o.cost_price);
      const d = Number(o.priceDelta ?? o.price_delta ?? 0);
      const priceDelta = Number.isFinite(d) ? d : 0;
      const price = Number.isFinite(p) ? p : priceDelta;
      const costPrice = Number.isFinite(c) ? c : 0;
      const qTotalRaw = o.qty ?? o.quantity ?? o.stock;
      const qPaidRaw = o.qtyPaid ?? o.qty_paid ?? qTotalRaw;
      const qBonusRaw = o.qtyBonus ?? o.qty_bonus ?? 0;
      const minRaw = o.min ?? o.minimum ?? o.min_qty ?? 0;
      const qPaidNum = Number(qPaidRaw);
      const qBonusNum = Number(qBonusRaw);
      const qTotalNum = Number(qTotalRaw);
      const qtyPaid = Number.isFinite(qPaidNum) ? qPaidNum : null;
      const qtyBonus = Number.isFinite(qBonusNum) ? qBonusNum : 0;
      const qty = Number.isFinite(qPaidNum)
        ? qPaidNum + (Number.isFinite(qBonusNum) ? qBonusNum : 0)
        : Number.isFinite(qTotalNum)
          ? qTotalNum
          : null;
      const minNum = Number(minRaw);
      const min = Number.isFinite(minNum) ? minNum : 0;
      const expiryDate = String(o.expiryDate || "").slice(0, 10);
      return { id, label, price, costPrice, qty, qtyPaid, qtyBonus, min, priceDelta, expiryDate };
    })
    .filter(Boolean);
}

/** @param {unknown} product */
export function productHasSaleOptions(product) {
  return normalizeSaleOptions(product).length > 0;
}
