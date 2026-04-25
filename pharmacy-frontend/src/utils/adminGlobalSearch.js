import { productDisplayName } from "./productDisplayName";
import { normalizeSaleOptions } from "./productSaleOptions";
import { readSalesReturns } from "./salesReturnsStorage";

const PRODUCTS_KEY = "adminProducts";
const CATEGORIES_KEY = "adminCategories";
const SALES_INVOICES_KEY = "salesInvoices";
const PURCHASE_INVOICES_KEY = "purchaseInvoices";
const STAFF_KEY = "adminStaffAccounts";
const NOTIFICATIONS_KEY = "systemNotifications";

export function normalizeSearchText(text = "") {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
}

function safeParseArray(key) {
  try {
    const raw = localStorage.getItem(key);
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function fieldMatches(nq, ...fields) {
  return fields.some((f) => normalizeSearchText(String(f ?? "")).includes(nq));
}

/** عدد النتائج الأقصى لكل قسم — زد القيمة هنا إذا احتجت المزيد */
export const ADMIN_SEARCH_MAX_PER_SECTION = 40;

function dedupeBy(arr, keyFn) {
  const seen = new Set();
  return arr.filter((row) => {
    const k = keyFn(row);
    if (k === undefined || k === null || k === "") return true;
    const key = String(k);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * @param {string} rawQuery
 * @param {{ label: string, path: string }[]} navPages
 */
export function runAdminGlobalSearch(rawQuery, navPages = []) {
  const nq = normalizeSearchText(rawQuery);
  if (!nq) {
    return {
      empty: true,
      query: "",
      presence: null,
      sections: [],
      totalCount: 0,
    };
  }

  const products = safeParseArray(PRODUCTS_KEY);
  const categories = safeParseArray(CATEGORIES_KEY);
  const salesInvoices = safeParseArray(SALES_INVOICES_KEY);
  const purchaseInvoices = safeParseArray(PURCHASE_INVOICES_KEY);
  const staff = safeParseArray(STAFF_KEY);
  const notifications = safeParseArray(NOTIFICATIONS_KEY);
  const salesReturns = readSalesReturns();

  const productHits = dedupeBy(
    products.filter((p) =>
      fieldMatches(
        nq,
        p.name,
        p.desc,
        p.category,
        p.id,
        p.barcode,
        p.variantLabel,
        productDisplayName(p),
        normalizeSaleOptions(p)
          .map((o) => o.label)
          .join(" "),
      ),
    ),
    (p) => p.id,
  );

  const invoiceHits = dedupeBy(
    salesInvoices.filter(
      (inv) =>
        fieldMatches(nq, inv.id, inv.soldBy, inv.soldByUsername, inv.soldByRole, inv.paymentMethod, inv.status) ||
        (Array.isArray(inv.items) && inv.items.some((it) => fieldMatches(nq, it.name, it.productId))),
    ),
    (inv) => inv.id,
  );

  const purchaseHits = dedupeBy(
    purchaseInvoices.filter(
      (po) =>
        fieldMatches(nq, po.id, po.supplier, po.purchasedBy, po.purchasedByRole, po.status) ||
        (Array.isArray(po.items) && po.items.some((it) => fieldMatches(nq, it.name, it.category))),
    ),
    (po) => po.id,
  );

  const returnHits = dedupeBy(
    salesReturns.filter(
      (r) =>
        fieldMatches(nq, r.id, r.originalInvoiceId, r.restoredBy, r.kind) ||
        (Array.isArray(r.items) && r.items.some((it) => fieldMatches(nq, it.name, it.productId))),
    ),
    (r) => r.id,
  );

  const staffHits = dedupeBy(
    staff.filter((u) => fieldMatches(nq, u.name, u.username, u.email, u.role, u.status)),
    (u) => u.id ?? u.username,
  );

  const notificationHits = dedupeBy(
    notifications.filter((n) => fieldMatches(nq, n.title, n.message, n.type, n.id)),
    (n) => n.id,
  );

  const navHits = dedupeBy(
    navPages.filter(
      (p) => fieldMatches(nq, p.label, p.path) || normalizeSearchText(p.path).includes(nq.replace(/^\//, "")),
    ),
    (p) => p.path,
  );

  const presence = {
    inventory: productHits.length > 0,
    sales: invoiceHits.length > 0,
    returns: returnHits.length > 0,
    purchases: purchaseHits.length > 0,
  };

  const sections = [];

  if (navHits.length) {
    sections.push({
      id: "nav",
      title: "صفحات وقوائم",
      pathHint: "انتقال سريع",
      items: navHits.slice(0, ADMIN_SEARCH_MAX_PER_SECTION).map((p) => ({
        title: p.label,
        subtitle: p.path,
        path: p.path,
        meta: "قائمة",
      })),
    });
  }

  if (productHits.length) {
    sections.push({
      id: "inventory",
      title: "أصناف المخزن",
      pathHint: "/admin/inventory",
      items: productHits.slice(0, ADMIN_SEARCH_MAX_PER_SECTION).map((p) => ({
        title: productDisplayName(p) || `صنف #${p.id}`,
        subtitle: [p.category, p.price != null ? `${p.price} شيكل` : null, p.active === false ? "غير نشط" : null]
          .filter(Boolean)
          .join(" · "),
        path: "/admin/inventory",
        meta: "مخزن",
      })),
    });
  }

  if (categories.length) {
    const catHits = dedupeBy(
      categories.filter((c) => fieldMatches(nq, c.name, c.id)),
      (c) => c.id,
    );
    if (catHits.length) {
      sections.push({
        id: "categories",
        title: "الأقسام",
        pathHint: "/admin/inventory?section=categories",
        items: catHits.slice(0, ADMIN_SEARCH_MAX_PER_SECTION).map((c) => ({
          title: c.name || `قسم #${c.id}`,
          subtitle: c.active === false ? "غير مفعّل" : "قسم نشط",
          path: "/admin/inventory?section=categories",
          meta: "قسم",
        })),
      });
    }
  }

  if (invoiceHits.length) {
    sections.push({
      id: "sales",
      title: "فواتير المبيعات",
      pathHint: "/admin/invoices",
      items: invoiceHits.slice(0, ADMIN_SEARCH_MAX_PER_SECTION).map((inv) => ({
        title: String(inv.id),
        subtitle: `${inv.soldBy || "-"} · ${inv.soldAt ? new Date(inv.soldAt).toLocaleString("en-GB") : ""} · ${Number(inv.total || 0).toFixed(1)} شيكل`,
        path: "/admin/invoices",
        meta: "بيع",
      })),
    });
  }

  if (purchaseHits.length) {
    sections.push({
      id: "purchases",
      title: "فواتير المشتريات",
      pathHint: "/admin/purchases",
      items: purchaseHits.slice(0, ADMIN_SEARCH_MAX_PER_SECTION).map((po) => ({
        title: String(po.id),
        subtitle: `${po.supplier || "-"} · ${po.purchasedAt ? new Date(po.purchasedAt).toLocaleString("en-GB") : ""} · ${Number(po.total || 0).toFixed(1)} شيكل`,
        path: "/admin/purchases",
        meta: "شراء",
      })),
    });
  }

  if (returnHits.length) {
    sections.push({
      id: "returns",
      title: "مرتجعات المبيعات",
      pathHint: "/admin/returns/sales",
      items: returnHits.slice(0, ADMIN_SEARCH_MAX_PER_SECTION).map((r) => ({
        title: String(r.id),
        subtitle: `من فاتورة ${r.originalInvoiceId || "-"} · ${r.createdAt ? new Date(r.createdAt).toLocaleString("en-GB") : ""}`,
        path: "/admin/returns/sales",
        meta: "مرتجع",
      })),
    });
  }

  if (staffHits.length) {
    sections.push({
      id: "staff",
      title: "الموظفون",
      pathHint: "/admin/staff",
      items: staffHits.slice(0, ADMIN_SEARCH_MAX_PER_SECTION).map((u) => ({
        title: u.name || u.username,
        subtitle: `@${u.username} · ${u.role || ""} · ${u.status || ""}`,
        path: "/admin/staff",
        meta: "موظف",
      })),
    });
  }

  if (notificationHits.length) {
    sections.push({
      id: "notifications",
      title: "الإشعارات",
      pathHint: "/admin/notifications",
      items: notificationHits.slice(0, ADMIN_SEARCH_MAX_PER_SECTION).map((n) => ({
        title: n.title || "إشعار",
        subtitle: (n.message || "").slice(0, 120) + ((n.message || "").length > 120 ? "…" : ""),
        path: "/admin/notifications",
        meta: "إشعار",
      })),
    });
  }

  const totalCount = sections.reduce((s, sec) => s + sec.items.length, 0);

  return {
    empty: false,
    query: rawQuery.trim(),
    presence,
    sections,
    totalCount,
    productHitsCount: productHits.length,
  };
}
