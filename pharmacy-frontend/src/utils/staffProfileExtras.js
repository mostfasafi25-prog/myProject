const PROFILE_EXTRAS_KEY = "staffProfileExtras";

export function readStaffProfileExtras() {
  try {
    const raw = JSON.parse(localStorage.getItem(PROFILE_EXTRAS_KEY));
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

export function writeStaffProfileExtras(map) {
  try {
    localStorage.setItem(PROFILE_EXTRAS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
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
