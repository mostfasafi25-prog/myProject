import { safeLocalStorageSetItem, safeLocalStorageSetJsonWithDataUrlFallback } from "./safeLocalStorage";

const PROFILE_EXTRAS_KEY = "staffProfileExtras";

/** حقول الجلسة فقط — بدون صور base64 (تسبب QuotaExceededError في localStorage). */
const SESSION_USER_KEYS = ["id", "username", "role", "approval_status", "is_active", "name", "email"];

export function sanitizeUserForLocalStorage(user) {
  if (!user || typeof user !== "object") return {};
  const out = {};
  for (const k of SESSION_USER_KEYS) {
    if (user[k] == null || user[k] === "") continue;
    const v = user[k];
    if (typeof v === "string" && v.startsWith("data:")) continue;
    if (typeof v === "string" && v.length > 2000) continue;
    out[k] = v;
  }
  return out;
}

/**
 * حفظ المستخدم في localStorage بشكل آمن من امتلاء المساحة.
 * @returns {{ ok: boolean; usedMinimal?: boolean; error?: unknown }}
 */
export function persistSessionUser(user) {
  const lean = sanitizeUserForLocalStorage(user);
  const minimalJson = JSON.stringify({
    id: lean.id,
    username: lean.username,
    role: lean.role,
    approval_status: lean.approval_status,
    is_active: lean.is_active,
  });
  const full = JSON.stringify(lean);
  const r1 = safeLocalStorageSetItem("user", full);
  if (r1.ok) return { ok: true };
  if (!r1.quota) return { ok: false, error: r1.error };
  const r2 = safeLocalStorageSetItem("user", minimalJson);
  if (r2.ok) return { ok: true, usedMinimal: true };
  return { ok: false, error: r2.error };
}

export function readStaffProfileExtras() {
  try {
    const raw = JSON.parse(localStorage.getItem(PROFILE_EXTRAS_KEY));
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

export function writeStaffProfileExtras(map) {
  safeLocalStorageSetJsonWithDataUrlFallback(PROFILE_EXTRAS_KEY, map || {});
}

export function mergeUserWithProfileExtras(user) {
  if (!user?.username) return user;
  const ex = readStaffProfileExtras()[user.username];
  if (!ex) return user;
  return {
    ...user,
    ...(ex.name ? { name: ex.name } : {}),
    ...(ex.avatarDataUrl ? { avatarDataUrl: ex.avatarDataUrl } : {}),
  };
}

/** يحفظ صورة الملف الشخصي بمفتاح اسم المستخدم لتُدمج عند تسجيل الدخول (انظر mergeUserWithProfileExtras). */
export function persistUserAvatarForLogin(username, avatarDataUrl) {
  if (!username) return;
  const map = readStaffProfileExtras();
  const prev = map[username] && typeof map[username] === "object" ? map[username] : {};
  if (!avatarDataUrl) {
    const next = { ...prev };
    delete next.avatarDataUrl;
    if (Object.keys(next).length === 0) {
      delete map[username];
    } else {
      map[username] = next;
    }
  } else {
    map[username] = { ...prev, avatarDataUrl };
  }
  writeStaffProfileExtras(map);
}
