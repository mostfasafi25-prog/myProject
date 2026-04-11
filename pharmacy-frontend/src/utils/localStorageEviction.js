/**
 * سياسة تخفيف امتلاء localStorage: لا نُبقي إلا الجلسة + طابور الكاشير غير المتصل.
 * باقي البيانات يُفضّل أن تأتي من الخادم عند الاتصال.
 */

import { stripAvatarsFromStaffProfileExtrasDisk } from "./staffProfileExtras";

export const OFFLINE_CASHIER_STORAGE_KEYS = ["cashierOfflinePendingInvoices", "cashierOfflineModeEnabled"];

/** مفاتيح يجب ألا تُحذف عند تفريغ «عدواني» قبل إعادة حفظ المستخدم */
export const SESSION_CRITICAL_KEYS = ["user", ...OFFLINE_CASHIER_STORAGE_KEYS];

/** بيانات ثقيلة يُزال أولاً لتفريغ مساحة دون كسر الجلسة */
const HEAVY_KEYS_FIRST_PASS = [
  "staffProfileExtras",
  "systemNotifications",
  "pharmacySecurityAuditLog_v1",
  "cashierShiftActivityLog",
  "pharmacyStocktakeSession_v1",
  "salesReturns",
  "pharmacyDebtCustomerLedger_v1",
];

/** ثانياً: نسخ محلية كبيرة (يُستخدم فقط إذا فشل حفظ الجلسة بعد المرّة الأولى) */
const CACHE_KEYS_SECOND_PASS = [
  "salesInvoices",
  "purchaseInvoices",
  "adminProducts",
  "adminCategories",
  "adminStaffAccounts",
  "storeBalance",
  "pharmacyDebtCustomers_v1",
  "cashierCartDrafts_v1",
  "pharmacyCashierSystemSettings_v1",
  "pharmacyCashierPrintReceiptPref_v1",
];

function safeRemove(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function removeKeys(keys) {
  let n = 0;
  for (const k of keys) {
    if (safeRemove(k)) n += 1;
  }
  return n;
}

/** إزالة الطبقات الثقيلة الشائعة (إشعارات، سجلات، إلخ) — آمن قبل تسجيل الدخول */
export function evictHeavyCachesBeforeLogin() {
  stripAvatarsFromStaffProfileExtrasDisk();
  return removeKeys(HEAVY_KEYS_FIRST_PASS);
}

/**
 * تفريغ شبه كامل: يبقى فقط user + طابور عدم الاتصال للكاشير.
 * يُستدعى بعد فشل حفظ الجلسة بسبب QuotaExceeded.
 */
export function evictAllLocalStorageExceptSessionAndOfflineQueue() {
  const keep = new Set(SESSION_CRITICAL_KEYS);
  const all = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) all.push(k);
    }
  } catch {
    return 0;
  }
  let removed = 0;
  for (const k of all) {
    if (keep.has(k)) continue;
    if (safeRemove(k)) removed += 1;
  }
  return removed;
}

/** إزالة نسخ المبيعات/المخزون المحلية فقط (بعد فشل أخف) */
export function evictLocalBusinessCachesSecondPass() {
  return removeKeys(CACHE_KEYS_SECOND_PASS);
}
