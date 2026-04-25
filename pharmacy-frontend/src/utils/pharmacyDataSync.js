/**
 * مزامنة اختيارية مع خادم محلي (Node) — انظر مجلد pharmacy-sync-server
 * عرّف VITE_SYNC_API_URL مثلاً: http://127.0.0.1:3847
 */
const DEFAULT_URL = typeof import.meta !== "undefined" && import.meta.env?.VITE_SYNC_API_URL
  ? String(import.meta.env.VITE_SYNC_API_URL).replace(/\/$/, "")
  : "";

export const SYNC_COLLECTION_KEYS = [
  "adminProducts",
  "salesInvoices",
  "purchaseInvoices",
  "salesReturns",
  "adminCategories",
  "storeBalance",
  "adminStaffAccounts",
  "adminUsersLocal",
  "pharmacySecurityAuditLog_v1",
  "pharmacyDebtCustomers_v1",
  "pharmacyDebtCustomerLedger_v1",
  "cashierShiftActivityLog",
  "pharmacyStocktakeSession_v1",
  "cashierCartDrafts_v1",
];

export function getSyncBaseUrl() {
  return DEFAULT_URL;
}

export async function pushCollectionToServer(key, data) {
  const base = getSyncBaseUrl();
  if (!base) return { ok: false, skipped: true, message: "لم يُعرَّف VITE_SYNC_API_URL" };
  const res = await fetch(`${base}/api/sync/${encodeURIComponent(key)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { ok: true };
}

export async function pullCollectionFromServer(key) {
  const base = getSyncBaseUrl();
  if (!base) return { ok: false, skipped: true };
  const res = await fetch(`${base}/api/sync/${encodeURIComponent(key)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return { ok: true, data };
}

export async function pushAllLocalCollections(getUser) {
  const base = getSyncBaseUrl();
  if (!base) return { ok: false, skipped: true, message: "عنوان المزامنة غير مضبوط" };
  const bulk = {};
  for (const key of SYNC_COLLECTION_KEYS) {
    try {
      const raw = localStorage.getItem(key === "pharmacyDebtCustomers_v1" ? "pharmacyDebtCustomers_v1" : key);
      if (raw == null) continue;
      bulk[key] = JSON.parse(raw);
    } catch {
      bulk[key] = null;
    }
  }
  const res = await fetch(`${base}/api/sync/bulk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ collections: bulk, pushedAt: new Date().toISOString(), by: getUser?.()?.username || "" }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { ok: true };
}

export async function pullAllToLocal(setItem = (k, v) => localStorage.setItem(k, v)) {
  const base = getSyncBaseUrl();
  if (!base) return { ok: false, skipped: true };
  const res = await fetch(`${base}/api/sync/bulk`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  const cols = body.collections || body;
  if (!cols || typeof cols !== "object") return { ok: false, message: "بيانات غير صالحة" };
  for (const key of SYNC_COLLECTION_KEYS) {
    if (cols[key] == null) continue;
    setItem(key, typeof cols[key] === "string" ? cols[key] : JSON.stringify(cols[key]));
  }
  return { ok: true };
}
