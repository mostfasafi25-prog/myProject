import { appendAudit, clearAuditLog } from "./auditLog";
import { notifyStoreBalanceChanged } from "./storeBalanceSync";
import { clearShiftActivityLog } from "./shiftActivityLog";

/** يجب كتابتها حرفياً (أحرف إنجليزية كبيرة) لتفعيل زر التنفيذ */
export const CONFIRM_DANGER_PHRASE = "I UNDERSTAND RESET";

export function dangerPhraseUnlocked(value) {
  return String(value || "").trim() === CONFIRM_DANGER_PHRASE;
}

const STORE_BALANCE_KEY = "storeBalance";
const SALES_INVOICES_KEY = "salesInvoices";
const PURCHASE_INVOICES_KEY = "purchaseInvoices";
const PRODUCTS_KEY = "adminProducts";
const CATEGORIES_KEY = "adminCategories";
const NOTIFICATIONS_KEY = "systemNotifications";
const SALES_RETURNS_KEY = "salesReturns";
const STOCKTAKE_SESSION_KEY = "pharmacyStocktakeSession_v1";
const OFFLINE_PENDING_KEY = "cashierOfflinePendingInvoices";
const CART_DRAFTS_KEY = "cashierCartDrafts_v1";
const DEBT_CUSTOMERS_KEY = "pharmacyDebtCustomers_v1";
const DEBT_LEDGER_KEY = "pharmacyDebtCustomerLedger_v1";
const STAFF_PROFILE_EXTRAS_KEY = "staffProfileExtras";

/** عدد السجلات التي تُبقى عند «التقليص» */
export const DANGER_TRIM_KEEP = 30;

function readJsonArray(key) {
  try {
    const raw = localStorage.getItem(key);
    const p = JSON.parse(raw || "null");
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

function writeJsonArray(key, arr) {
  localStorage.setItem(key, JSON.stringify(arr));
}

function sortByDateDesc(rows, dateFields) {
  const score = (row) =>
    Math.max(
      0,
      ...dateFields.map((f) => {
        const t = new Date(row?.[f] || 0).getTime();
        return Number.isNaN(t) ? 0 : t;
      }),
    );
  return [...rows].sort((a, b) => score(b) - score(a));
}

/** يبقي أحدث `keep` سجلات حسب الحقول الزمنية */
function trimStorageByDate(key, keep, dateFields) {
  const list = readJsonArray(key);
  const before = list.length;
  if (before === 0) return null;
  if (before <= keep) return { skipped: true, before, after: before };
  const next = sortByDateDesc(list, dateFields).slice(0, keep);
  writeJsonArray(key, next);
  return { skipped: false, before, after: next.length };
}

/**
 * @param {{
 *   treasury?: boolean,
 *   sales?: boolean,
 *   trimSales?: boolean,
 *   purchases?: boolean,
 *   trimPurchases?: boolean,
 *   catalog?: boolean,
 *   shiftLog?: boolean,
 *   auditLog?: boolean,
 *   returns?: boolean,
 *   trimReturns?: boolean,
 *   notifications?: boolean,
 *   stocktake?: boolean,
 *   offlinePending?: boolean,
 *   cartDrafts?: boolean,
 *   debtCustomers?: boolean,
 *   staffProfileExtras?: boolean,
 * }} flags
 * @param {{ username?: string, role?: string }} meta للتسجيل في سجل التدقيق
 * @returns {string[]} تسميات عربية لما نُفّذ
 */
export function applySystemDangerResets(flags, meta = {}) {
  const done = [];

  if (flags.treasury) {
    const next = {
      total: 0,
      cash: 0,
      app: 0,
      lastOperation: "reset",
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORE_BALANCE_KEY, JSON.stringify(next));
    notifyStoreBalanceChanged();
    done.push("تصفير الخزنة بالكامل");
  }

  if (flags.sales) {
    localStorage.setItem(SALES_INVOICES_KEY, JSON.stringify([]));
    done.push("تصفير المبيعات بالكامل");
  } else if (flags.trimSales) {
    const r = trimStorageByDate(SALES_INVOICES_KEY, DANGER_TRIM_KEEP, ["soldAt", "createdAt", "id"]);
    if (r && !r.skipped) done.push(`تقليص المبيعات — أُبقي ${r.after} من ${r.before} فاتورة`);
    else if (r?.skipped) done.push("تقليص المبيعات — لا حاجة (العدد ≤ حد التقليص)");
  }

  if (flags.purchases) {
    localStorage.setItem(PURCHASE_INVOICES_KEY, JSON.stringify([]));
    done.push("تصفير المشتريات بالكامل");
  } else if (flags.trimPurchases) {
    const r = trimStorageByDate(PURCHASE_INVOICES_KEY, DANGER_TRIM_KEEP, ["purchasedAt", "createdAt", "id"]);
    if (r && !r.skipped) done.push(`تقليص المشتريات — أُبقي ${r.after} من ${r.before} فاتورة`);
    else if (r?.skipped) done.push("تقليص المشتريات — لا حاجة (العدد ≤ حد التقليص)");
  }

  if (flags.catalog) {
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify([]));
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify([]));
    done.push("تصفير الأقسام والأصناف المحلية");
  }

  if (flags.shiftLog) {
    clearShiftActivityLog();
    done.push("مسح سجل دوام الكاشير");
  }

  if (flags.auditLog) {
    clearAuditLog();
    done.push("مسح سجل التدقيق");
  }


  if (flags.returns) {
    localStorage.setItem(SALES_RETURNS_KEY, JSON.stringify([]));
    done.push("تصفير المرتجعات بالكامل");
  } else if (flags.trimReturns) {
    const r = trimStorageByDate(SALES_RETURNS_KEY, DANGER_TRIM_KEEP, ["createdAt", "id"]);
    if (r && !r.skipped) done.push(`تقليص المرتجعات — أُبقي ${r.after} من ${r.before}`);
    else if (r?.skipped) done.push("تقليص المرتجعات — لا حاجة (العدد ≤ حد التقليص)");
  }

  if (flags.staffProfileExtras) {
    try {
      localStorage.removeItem(STAFF_PROFILE_EXTRAS_KEY);
    } catch {
      // ignore
    }
    done.push("مسح إضافات ملفات الموظفين المحلية (أسماء/صور)");
  }

  if (flags.notifications) {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify([]));
    done.push("مسح الإشعارات");
  }

  if (flags.stocktake) {
    localStorage.removeItem(STOCKTAKE_SESSION_KEY);
    done.push("مسح جلسة الجرد المعلّقة");
  }

  if (flags.offlinePending) {
    localStorage.setItem(OFFLINE_PENDING_KEY, JSON.stringify([]));
    done.push("مسح فواتير الكاشير غير المتصلة المعلّقة");
  }

  if (flags.cartDrafts) {
    localStorage.setItem(CART_DRAFTS_KEY, JSON.stringify([]));
    done.push("مسح سلال الكاشير المعلّقة");
  }

  if (flags.debtCustomers) {
    localStorage.setItem(DEBT_CUSTOMERS_KEY, JSON.stringify([]));
    localStorage.setItem(DEBT_LEDGER_KEY, JSON.stringify([]));
    done.push("مسح زبائن الآجل وسجل حركاتهم");
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("pharmacy-system-data-reset"));
  }

  if (done.length) {
    appendAudit({
      action: "system_data_reset",
      details: JSON.stringify({ applied: flags, doneLabels: done }),
      username: String(meta.username || ""),
      role: String(meta.role || ""),
    });
  }

  return done;
}
