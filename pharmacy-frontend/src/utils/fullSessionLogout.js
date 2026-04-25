import { removeAuthTokenCookie } from "./authTokenCookie";

function loginUrlAfterLogout() {
  const base = import.meta.env.BASE_URL || "/";
  const trimmed = base.endsWith("/") ? base.slice(0, -1) : base;
  if (!trimmed) return "/login";
  return `${trimmed}/login`;
}

export async function revokeSessionOnServer(http) {
  if (!http?.post) return;
  try {
    await http.post("logout", {}, { timeout: 12000 });
  } catch {
    // السيرفر غير متاح أو الجلسة منتهية — نكمل التنظيف المحلي
  }
}

export function wipeAllClientStorageAndToken() {
  removeAuthTokenCookie();
  try {
    localStorage.clear();
  } catch {
    // ignore
  }
  try {
    sessionStorage.clear();
  } catch {
    // ignore
  }
}

/**
 * تسجيل خروج كامل: إبطال الجلسة في السيرفر (إن وُجد طلب)، مسح التوكن وكل localStorage/sessionStorage،
 * ثم إعادة تحميل صفحة الدخول لتفادي أي حالة React قديمة أو بيانات مختلطة.
 *
 * @param {import("axios").AxiosInstance | null | undefined} http
 */
export function performFullLogout(http) {
  void (async () => {
    await revokeSessionOnServer(http);
    wipeAllClientStorageAndToken();
    window.location.replace(loginUrlAfterLogout());
  })();
}
