/** إعدادات الكاشير التي يضبطها المدير — تُطبَّق على واجهة الكاشير */
const SETTINGS_KEY = "pharmacyCashierSystemSettings_v1";
const PRINT_PREF_KEY = "pharmacyCashierPrintReceiptPref_v1";

export const CASHIER_SYSTEM_SETTINGS_DEFAULT = {
  discountEnabled: true,
  creditEnabled: true,
  appPaymentEnabled: true,
  holdCartEnabled: true,
  debtPayFromCashierEnabled: true,
  productSortFiltersEnabled: true,
  offlineModeToggleEnabled: true,
  todaySalesButtonEnabled: true,
  /** عند عدم وجود تفضيل محفوظ للمستخدم على هذا الجهاز */
  defaultPrintReceiptAfterSale: false,
};

export function getCashierSystemSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    if (!raw || typeof raw !== "object") return { ...CASHIER_SYSTEM_SETTINGS_DEFAULT };
    return { ...CASHIER_SYSTEM_SETTINGS_DEFAULT, ...raw };
  } catch {
    return { ...CASHIER_SYSTEM_SETTINGS_DEFAULT };
  }
}

export function setCashierSystemSettings(patch) {
  const next = { ...getCashierSystemSettings(), ...patch };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("pharmacy-cashier-system-settings-changed"));
}

/**
 * @param {string} username
 * @param {boolean} adminDefault
 */
export function getCashierPrintReceiptPref(username, adminDefault) {
  if (!username) return Boolean(adminDefault);
  try {
    const all = JSON.parse(localStorage.getItem(PRINT_PREF_KEY));
    if (all && typeof all === "object" && Object.prototype.hasOwnProperty.call(all, username)) {
      return Boolean(all[username]);
    }
  } catch {
    // ignore
  }
  return Boolean(adminDefault);
}

export function setCashierPrintReceiptPref(username, value) {
  if (!username) return;
  try {
    const all = JSON.parse(localStorage.getItem(PRINT_PREF_KEY)) || {};
    all[username] = Boolean(value);
    localStorage.setItem(PRINT_PREF_KEY, JSON.stringify(all));
  } catch {
    localStorage.setItem(PRINT_PREF_KEY, JSON.stringify({ [username]: Boolean(value) }));
  }
}
