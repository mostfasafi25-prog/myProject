/**
 * خيارات بيع اختيارية للصنف (مثل حجم الحبة) — تُخزَّن في المنتج كـ saleOptions[]
 * @typedef {{ id: string, label: string, priceDelta: number }} SaleOption
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
      const d = Number(o.priceDelta ?? o.price_delta ?? 0);
      const priceDelta = Number.isFinite(d) ? d : 0;
      return { id, label, priceDelta };
    })
    .filter(Boolean);
}

/** @param {unknown} product */
export function productHasSaleOptions(product) {
  return normalizeSaleOptions(product).length > 0;
}
