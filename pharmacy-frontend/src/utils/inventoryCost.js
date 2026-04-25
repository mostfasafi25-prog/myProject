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

/**
 * تحويل كمية البيع إلى حبات (مخزون) — نفس منطق الباك اند Product::saleQuantityToInventoryPieces.
 * @param {object} product
 * @param {number} quantity
 * @param {string} [saleType]
 */
export function saleQuantityToInventoryPieces(product, quantity, saleType) {
  if (!product || typeof product !== "object") return Math.max(0, Number(quantity) || 0);
  const qty = Math.max(0, Number(quantity) || 0);
  let unit = String(
    saleType ?? product.saleType ?? product.sale_unit ?? product.unit ?? "pill",
  ).toLowerCase();
  if (unit === "piece") unit = "pill";
  const pps = Math.max(
    1,
    Number(
      product.piecesPerStrip ??
        product.pieces_per_strip ??
        product.stripUnitCount ??
        product.strip_unit_count ??
        0,
    ) || 1,
  );
  const spb = Math.max(1, Number(product.stripsPerBox ?? product.strips_per_box ?? 0) || 1);
  if (unit === "box") return qty * spb * pps;
  if (unit === "strip" || unit === "pack") return qty * pps;
  return qty;
}

/**
 * تكلفة الشراء لكل وحدة بيع (شريط/حبة/علبة) عندما تكون cost_price لوحدة المنتج الأساسية (مثل العلبة).
 */
export function unitInventoryCostForSaleType(product, saleType) {
  if (!product || typeof product !== "object") return 0;
  const baseCost = parseNonNegativeNumber(
    product.costPrice ?? product.cost_price ?? product.purchaseUnitPrice ?? product.purchase_unit_price,
  );
  if (baseCost <= 0) return parseNonNegativeNumber(product.price);
  const allowSplit = !!(product.allowSplitSales ?? product.allow_split_sales);
  if (!allowSplit) return baseCost;

  let baseType = String(product.saleType ?? product.sale_unit ?? product.unit ?? "strip").toLowerCase();
  if (baseType === "piece") baseType = "pill";
  let lineType = String(saleType ?? baseType).toLowerCase();
  if (lineType === "piece") lineType = "pill";

  const piecesRef = saleQuantityToInventoryPieces(product, 1, baseType);
  const piecesLine = saleQuantityToInventoryPieces(product, 1, lineType);
  if (piecesRef <= 0) return baseCost;
  return Number(((baseCost * piecesLine) / piecesRef).toFixed(4));
}
