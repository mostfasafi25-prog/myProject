/** تفضيلات استقبال الإشعار — مدير + لكل كاشير */

const KEY = "pharmacyNotificationPrefs_v1";

export const ADMIN_PREF_DEFAULTS = {
  shiftEnd: true,
  userLogin: true,
  saleComplete: false,
  purchases: true,
};

export const CASHIER_PREF_DEFAULTS = {
  purchases: true,
  managementManual: true,
  other: true,
};

function readRoot() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

function writeRoot(root) {
  localStorage.setItem(KEY, JSON.stringify(root));
  window.dispatchEvent(new Event("pharmacy-notification-prefs-changed"));
}

export function getAdminPrefs() {
  const root = readRoot();
  return { ...ADMIN_PREF_DEFAULTS, ...(root.admin || {}) };
}

export function setAdminPrefs(partial) {
  const root = readRoot();
  root.admin = { ...getAdminPrefs(), ...partial };
  writeRoot(root);
}

export function getCashierPrefs(username) {
  const u = String(username || "").trim();
  const root = readRoot();
  const row = root.cashierUsers?.[u] || {};
  return { ...CASHIER_PREF_DEFAULTS, ...row };
}

export function setCashierPrefs(username, partial) {
  const u = String(username || "").trim();
  if (!u) return;
  const root = readRoot();
  if (!root.cashierUsers) root.cashierUsers = {};
  root.cashierUsers[u] = { ...getCashierPrefs(u), ...partial };
  writeRoot(root);
}

/** تصنيف من نوع الإشعار إن لم يُضف prefCategory */
export function inferPrefCategory(notification) {
  if (notification?.prefCategory) return notification.prefCategory;
  const t = String(notification?.type || "");
  if (t === "shift_end") return "shift_end";
  if (t === "user_login") return "user_login";
  if (t === "sale_admin") return "sale_admin";
  if (t === "purchase") return "purchase";
  if (t === "manual") return "management_manual";
  return null;
}

const ADMIN_PREF_KEY = {
  shift_end: "shiftEnd",
  user_login: "userLogin",
  sale_admin: "saleComplete",
  purchase: "purchases",
};

const CASHIER_PREF_KEY = {
  purchase: "purchases",
  management_manual: "managementManual",
};

/**
 * هل يُسمح بعرض الإشعار للمستخدم الحالي حسب التفضيلات؟
 * يُستدعى بعد التحقق من المستلمين (recipients).
 */
export function isNotificationAllowedByPrefs(notification) {
  const cat = inferPrefCategory(notification);
  if (!cat) return true;

  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("user")) || null;
  } catch {
    user = null;
  }
  const role = user?.role || "";
  const username = user?.username || "";

  if (role === "admin" || role === "super_admin") {
    const k = ADMIN_PREF_KEY[cat];
    if (!k) return true;
    return getAdminPrefs()[k] !== false;
  }

  if (role === "cashier" || role === "super_cashier") {
    const k = CASHIER_PREF_KEY[cat];
    if (!k) {
      if (cat === "shift_end" || cat === "user_login" || cat === "sale_admin") return true;
      return getCashierPrefs(username).other !== false;
    }
    return getCashierPrefs(username)[k] !== false;
  }

  return true;
}
