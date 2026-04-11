export const SHIFT_ACTIVITY_LOG_KEY = "cashierShiftActivityLog";

/**
 * @param {object} p
 * @param {string} p.username
 * @param {string} p.displayName
 * @param {string} p.shiftStartedAt
 * @param {string} p.shiftEndedAt
 * @param {number} p.invoiceCount
 * @param {number} p.total
 * @param {number} p.cash
 * @param {number} p.app
 * @param {number} [p.credit]
 * @param {object[]} p.invoices — لقطة فواتير الجلسة (نسخ مبسّطة)
 */
export function appendShiftActivityRecord(p) {
  const row = {
    id: `ACT-${Date.now()}`,
    username: p.username,
    displayName: p.displayName || p.username,
    shiftStartedAt: p.shiftStartedAt,
    shiftEndedAt: p.shiftEndedAt,
    invoiceCount: p.invoiceCount,
    total: p.total,
    cash: p.cash,
    app: p.app,
    credit: Number(p.credit || 0),
    invoices: Array.isArray(p.invoices) ? p.invoices : [],
    createdAt: new Date().toISOString(),
  };
  try {
    const raw = localStorage.getItem(SHIFT_ACTIVITY_LOG_KEY);
    const list = Array.isArray(JSON.parse(raw || "[]")) ? JSON.parse(raw || "[]") : [];
    localStorage.setItem(SHIFT_ACTIVITY_LOG_KEY, JSON.stringify([row, ...list]));
  } catch {
    localStorage.setItem(SHIFT_ACTIVITY_LOG_KEY, JSON.stringify([row]));
  }
}

export function readShiftActivityLog() {
  try {
    const raw = JSON.parse(localStorage.getItem(SHIFT_ACTIVITY_LOG_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function clearShiftActivityLog() {
  try {
    localStorage.setItem(SHIFT_ACTIVITY_LOG_KEY, "[]");
  } catch {
    // ignore
  }
}
