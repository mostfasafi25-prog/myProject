import { safeLocalStorageSetItem, safeLocalStorageSetJsonWithDataUrlFallback } from "./safeLocalStorage";

const PROFILE_EXTRAS_KEY = "staffProfileExtras";
/** صور الملف الشخصي للعرض فقط خلال الجلسة — لا تُكتب في localStorage (تجنباً لامتلاء المساحة) */
const SESSION_AVATAR_PREFIX = "pharmacy_sess_avatar:";
const SESSION_USER_KEY = "pharmacy_session_user_v1";

/** حقول الجلسة فقط — بدون صور base64 (تسبب QuotaExceededError في localStorage). */
const SESSION_USER_KEYS = ["id", "username", "role", "approval_status", "is_active", "name", "email", "avatar_url"];

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
  try {
    sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(lean));
  } catch {
    // ignore and continue to localStorage fallback
  }
  const r1 = safeLocalStorageSetItem("user", minimalJson);
  if (r1.ok) return { ok: true, usedMinimal: true };
  if (!r1.quota) return { ok: false, error: r1.error };
  const r2 = safeLocalStorageSetItem("user", minimalJson);
  if (r2.ok) return { ok: true, usedMinimal: true };
  return { ok: false, error: r2.error };
}

export function readSessionUser() {
  try {
    const raw = JSON.parse(sessionStorage.getItem(SESSION_USER_KEY));
    if (raw && typeof raw === "object") return raw;
  } catch {
    // ignore
  }
  try {
    return JSON.parse(localStorage.getItem("user")) || null;
  } catch {
    return null;
  }
}

export function readStaffProfileExtras() {
  try {
    const raw = JSON.parse(localStorage.getItem(PROFILE_EXTRAS_KEY));
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

/** إزالة أي صور مضمّنة من extras المحفوظة (قديمة) — الأسماء تبقى */
export function stripAvatarsFromStaffProfileExtrasDisk() {
  const map = readStaffProfileExtras();
  let changed = false;
  for (const u of Object.keys(map)) {
    const row = map[u];
    if (row && typeof row === "object" && row.avatarDataUrl) {
      delete row.avatarDataUrl;
      changed = true;
    }
  }
  if (changed) {
    safeLocalStorageSetJsonWithDataUrlFallback(PROFILE_EXTRAS_KEY, map);
  }
}

export function writeStaffProfileExtras(map) {
  const clean = { ...(map || {}) };
  for (const u of Object.keys(clean)) {
    const row = clean[u];
    if (row && typeof row === "object" && row.avatarDataUrl) {
      const { avatarDataUrl, ...rest } = row;
      clean[u] = Object.keys(rest).length ? rest : {};
    }
  }
  safeLocalStorageSetJsonWithDataUrlFallback(PROFILE_EXTRAS_KEY, clean);
}

export function mergeUserWithProfileExtras(user) {
  if (!user?.username) return user;
  let sessionAvatar;
  try {
    sessionAvatar = sessionStorage.getItem(SESSION_AVATAR_PREFIX + user.username);
  } catch {
    sessionAvatar = null;
  }
  const ex = readStaffProfileExtras()[user.username];
  const backendAvatar = typeof user.avatar_url === "string" ? user.avatar_url : "";
  return {
    ...user,
    ...(ex?.name ? { name: ex.name } : {}),
    ...(sessionAvatar
      ? { avatarDataUrl: sessionAvatar }
      : backendAvatar
        ? { avatarDataUrl: backendAvatar, avatar: backendAvatar }
        : {}),
  };
}

/**
 * صورة الملف الشخصي للعرض في الجلسة الحالية فقط (sessionStorage).
 * لا تُخزّن في localStorage.
 */
export function persistUserAvatarForLogin(username, avatarDataUrl) {
  if (!username) return;
  const key = SESSION_AVATAR_PREFIX + username;
  try {
    if (!avatarDataUrl) {
      sessionStorage.removeItem(key);
      return;
    }
    if (typeof avatarDataUrl === "string" && avatarDataUrl.length > 120_000) {
      return;
    }
    sessionStorage.setItem(key, avatarDataUrl);
  } catch {
    // تجاهل — مساحة sessionStorage أو وضع خاص
  }
}

export function getSessionAvatarDataUrl(username) {
  if (!username) return "";
  try {
    return sessionStorage.getItem(SESSION_AVATAR_PREFIX + username) || "";
  } catch {
    return "";
  }
}
