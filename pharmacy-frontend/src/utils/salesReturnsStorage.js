export const SALES_RETURNS_KEY = "salesReturns";

/**
 * @param {object} entry
 * @param {string} entry.originalInvoiceId
 * @param {string} entry.restoredBy
 * @param {Array} entry.items
 * @param {number} [entry.invoiceTotal]
 * @param {string} [entry.paymentMethod]
 */
export function appendSalesReturn(entry) {
  const row = {
    id: `RET-${Date.now()}`,
    kind: "اعادة_فاتورة",
    createdAt: new Date().toISOString(),
    ...entry,
  };
  let list = [];
  try {
    const raw = localStorage.getItem(SALES_RETURNS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
    }
  } catch {
    list = [];
  }
  localStorage.setItem(SALES_RETURNS_KEY, JSON.stringify([row, ...list]));
  return row;
}

export function readSalesReturns() {
  try {
    const raw = localStorage.getItem(SALES_RETURNS_KEY);
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}
