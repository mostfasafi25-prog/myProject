import Cookies from "universal-cookie";

export const AUTH_TOKEN_COOKIE_NAME = "token";

/** مدة بقاء كوكي التوكن بالثواني (افتراضي 14 يوم) */
export function authTokenCookieMaxAgeSec() {
  const raw = import.meta.env.VITE_AUTH_TOKEN_MAX_AGE_SEC;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return 60 * 60 * 24 * 14;
}

/** خيارات كوكي التوكن — تُخزَّن في `document.cookie` عبر universal-cookie */
export function getAuthTokenCookieSetOptions() {
  const secure = typeof window !== "undefined" && window.location?.protocol === "https:";
  return {
    path: "/",
    sameSite: "lax",
    maxAge: authTokenCookieMaxAgeSec(),
    ...(secure ? { secure: true } : {}),
  };
}

/** حفظ التوكن في الكوكي بعد تسجيل الدخول */
export function persistAuthTokenInCookie(token) {
  const value = token != null ? String(token).trim() : "";
  if (!value) return;
  const cookies = new Cookies();
  cookies.set(AUTH_TOKEN_COOKIE_NAME, value, getAuthTokenCookieSetOptions());
}

/** إزالة كوكي التوكن (نفس المسار المستخدم عند الإنشاء) */
export function removeAuthTokenCookie() {
  try {
    const cookies = new Cookies();
    cookies.remove(AUTH_TOKEN_COOKIE_NAME, { path: "/" });
  } catch {
    // ignore
  }
}
