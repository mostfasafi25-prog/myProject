/** فواتير معلّقة (سلة) لكل كاشير */
const KEY = "cashierCartDrafts_v1";

function readAll() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function writeAll(obj) {
  localStorage.setItem(KEY, JSON.stringify(obj));
}

export function readDraftsForCashier(username) {
  const u = String(username || "guest").trim() || "guest";
  const all = readAll();
  return Array.isArray(all[u]) ? all[u] : [];
}

/**
 * @param {string} username
 * @param {{ label: string, cart: unknown[], discountFixed: number, discountPercent: number, paymentMethod: string, creditCustomerId?: string }} payload
 */
export function saveCashierDraft(username, payload) {
  const u = String(username || "guest").trim() || "guest";
  const all = readAll();
  const list = Array.isArray(all[u]) ? [...all[u]] : [];
  const id = `HOLD-${Date.now()}`;
  const row = {
    id,
    label: String(payload.label || "بدون اسم").trim() || "بدون اسم",
    savedAt: new Date().toISOString(),
    cart: Array.isArray(payload.cart) ? payload.cart : [],
    discountFixed: Number(payload.discountFixed) || 0,
    discountPercent: Number(payload.discountPercent) || 0,
    paymentMethod: String(payload.paymentMethod || "cash"),
    creditCustomerId: payload.creditCustomerId || "",
  };
  list.unshift(row);
  all[u] = list.slice(0, 30);
  writeAll(all);
  return row;
}

export function deleteCashierDraft(username, draftId) {
  const u = String(username || "guest").trim() || "guest";
  const all = readAll();
  const list = Array.isArray(all[u]) ? all[u] : [];
  all[u] = list.filter((d) => d.id !== draftId);
  writeAll(all);
}
