/** أدوار النظام: admin | super_cashier | cashier */
import { mergeUserWithProfileExtras, readSessionUser } from "./staffProfileExtras";

/** يُرسل عند تعديل كائن المستخدم في localStorage (مثل صورة الملف الشخصي) لتحديث الهيدر */
export const PHARMACY_USER_STORAGE_EVENT = "pharmacy-user-updated";

export const ROLE_ADMIN = "admin";
export const ROLE_SUPER_ADMIN = "super_admin";
export const ROLE_SUPER_CASHIER = "super_cashier";
export const ROLE_CASHIER = "cashier";

export function getStoredUser() {
  try {
    const u = readSessionUser();
    return u ? mergeUserWithProfileExtras(u) : null;
  } catch {
    return null;
  }
}

export function isAdmin(user = getStoredUser()) {
  return user?.role === ROLE_ADMIN || user?.role === ROLE_SUPER_ADMIN;
}

export function isSuperAdmin(user = getStoredUser()) {
  return user?.role === ROLE_SUPER_ADMIN;
}

export function isSuperCashier(user = getStoredUser()) {
  return user?.role === ROLE_SUPER_CASHIER;
}

export function isCashierOnly(user = getStoredUser()) {
  return user?.role === ROLE_CASHIER;
}

/** كاشير عادي أو سوبر كاشير (شاشة البيع) */
export function isCashierRole(user = getStoredUser()) {
  return user?.role === ROLE_CASHIER || user?.role === ROLE_SUPER_CASHIER;
}

/** اسم للعرض في الفواتير والمشتريات */
export function purchaserDisplayName(user = getStoredUser()) {
  if (!user) return "—";
  const n = String(user.name || "").trim();
  if (n) return n;
  return String(user.username || "").trim() || "—";
}
