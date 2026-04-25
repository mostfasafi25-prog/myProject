import { Axios } from "../Api/Axios";

export const PHARMACY_ADMIN_CATEGORIES_SYNCED = "pharmacy-admin-categories-synced";

const ADMIN_CATEGORIES_KEY = "adminCategories";

/** قراءة أقسام المبيعات المحفوظة بعد المزامنة مع الخادم */
export function readAdminCategoriesFromStorage() {
  try {
    const raw = JSON.parse(localStorage.getItem(ADMIN_CATEGORIES_KEY));
    if (Array.isArray(raw) && raw.length) return raw;
  } catch {
    // ignore
  }
  return null;
}

/**
 * حفظ أقسام المبيعات في localStorage بصيغة متوافقة مع صفحة الأقسام والمخزون.
 * @param {Array<{ id?: number|string; name?: string; is_active?: boolean; active?: boolean; manager?: string; productsCount?: number; status?: string; createdAt?: string }>} rows
 */
export function persistSalesCategories(rows) {
  if (!Array.isArray(rows) || !rows.length) return;
  const normalized = rows
    .map((c) => ({
      id: c.id,
      name: String(c.name || "").trim(),
      active: c.is_active !== false && c.active !== false,
      manager: String(c.manager || "").trim() || "—",
      productsCount: Number(c.products_count ?? c.productsCount ?? 0),
      status: String(c.status || "نشط"),
      createdAt: c.createdAt || c.created_at || new Date().toISOString(),
    }))
    .filter((c) => c.name);
  if (!normalized.length) return;
  localStorage.setItem(ADMIN_CATEGORIES_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(PHARMACY_ADMIN_CATEGORIES_SYNCED));
}

/** جلب أقسام الصيدلية من الـ API وتحديث التخزين المحلي */
export async function fetchAndPersistSalesCategories() {
  try {
    let payload = null;
    const purchaseRes = await Axios.get("categories/main", { params: { scope: "purchase" } });
    if (purchaseRes?.data?.success && Array.isArray(purchaseRes.data.data) && purchaseRes.data.data.length) {
      payload = purchaseRes.data.data;
    } else {
      const salesRes = await Axios.get("categories/main", { params: { scope: "sales" } });
      if (salesRes?.data?.success && Array.isArray(salesRes.data.data) && salesRes.data.data.length) {
        payload = salesRes.data.data;
      }
    }
    if (!Array.isArray(payload) || !payload.length) return null;
    const rows = payload.map((c) => ({
      id: c.id,
      name: c.name,
      is_active: c.is_active,
    }));
    persistSalesCategories(rows);
    return readAdminCategoriesFromStorage();
  } catch {
    return null;
  }
}
