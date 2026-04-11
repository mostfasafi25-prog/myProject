import { safeLocalStorageSetJsonWithDataUrlFallback } from "./safeLocalStorage";
import { pushCashierShiftCloseToBackend } from "./shiftActivityBackendSync";

export const SHIFT_ACTIVITY_LOG_KEY = "cashierShiftActivityLog";

/** دمج سجلات السيرفر مع المحلية (نفس المفتاح id = client_row_id) */
export function mergeShiftActivityRows(serverRows, localRows) {
  const byId = new Map();
  for (const r of serverRows || []) {
    if (r?.id) byId.set(r.id, { ...r, fromServer: r.fromServer !== false });
  }
  for (const r of localRows || []) {
    if (r?.id && !byId.has(r.id)) {
      byId.set(r.id, { ...r, fromServer: false });
    }
  }
  return [...byId.values()].sort(
    (a, b) =>
      new Date(b.shiftEndedAt || b.createdAt || 0).getTime() -
      new Date(a.shiftEndedAt || a.createdAt || 0).getTime(),
  );
}

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
  let list = [];
  try {
    const raw = localStorage.getItem(SHIFT_ACTIVITY_LOG_KEY);
    list = Array.isArray(JSON.parse(raw || "[]")) ? JSON.parse(raw || "[]") : [];
  } catch {
    list = [];
  }
  const next = [row, ...list];
  let r = safeLocalStorageSetJsonWithDataUrlFallback(SHIFT_ACTIVITY_LOG_KEY, next);
  if (!r.ok || r.stripped) {
    const slimRow = { ...row, invoices: [] };
    r = safeLocalStorageSetJsonWithDataUrlFallback(SHIFT_ACTIVITY_LOG_KEY, [slimRow, ...list]);
  }
  if (!r.ok) {
    console.warn("[shiftActivityLog] تعذر حفظ السجل محلياً", r.error);
  }
  void pushCashierShiftCloseToBackend(row);
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
  safeLocalStorageSetJsonWithDataUrlFallback(SHIFT_ACTIVITY_LOG_KEY, []);
}
