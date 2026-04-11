/** خطأ امتلاء مساحة localStorage في المتصفحات الشائعة */
export function isQuotaExceededError(e) {
  return Boolean(
    e &&
      (e.name === "QuotaExceededError" ||
        e.code === 22 ||
        (typeof e.message === "string" && e.message.toLowerCase().includes("quota"))),
  );
}

export function safeLocalStorageSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e, quota: isQuotaExceededError(e) };
  }
}

function stripLargeDataUrls(value, minLen) {
  if (Array.isArray(value)) return value.map((x) => stripLargeDataUrls(x, minLen));
  if (value && typeof value === "object") {
    const out = { ...value };
    for (const k of Object.keys(out)) {
      const v = out[k];
      if (typeof v === "string" && v.startsWith("data:") && v.length >= minLen) {
        out[k] = "";
      } else if (v && typeof v === "object") {
        out[k] = stripLargeDataUrls(v, minLen);
      }
    }
    return out;
  }
  return value;
}

/**
 * يحفظ JSON؛ عند امتلاء المساحة يحاول مرة ثانية بعد إزالة سلاسل data: الطويلة (صور مضمنة).
 * @returns {{ ok: boolean; stripped?: boolean; data?: unknown; error?: unknown }}
 */
export function safeLocalStorageSetJsonWithDataUrlFallback(key, serializable) {
  const json = JSON.stringify(serializable);
  const trySet = (s) => {
    try {
      localStorage.setItem(key, s);
      return true;
    } catch (e) {
      return e;
    }
  };
  const first = trySet(json);
  if (first === true) return { ok: true };
  if (!isQuotaExceededError(first)) return { ok: false, error: first };
  try {
    const parsed = JSON.parse(json);
    const slim = stripLargeDataUrls(parsed, 4000);
    const slimJson = JSON.stringify(slim);
    const second = trySet(slimJson);
    if (second === true) return { ok: true, stripped: true, data: slim };
    if (isQuotaExceededError(second)) {
      const slimmer = stripLargeDataUrls(parsed, 200);
      const third = trySet(JSON.stringify(slimmer));
      if (third === true) return { ok: true, stripped: true, data: slimmer };
      return { ok: false, error: third };
    }
    return { ok: false, error: second };
  } catch (e) {
    return { ok: false, error: e };
  }
}
