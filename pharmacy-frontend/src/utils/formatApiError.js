/**
 * استخراج رسالة خطأ واضحة من استجابة axios (Laravel، CORS، شبكة، إلخ)
 * @param {unknown} err
 * @param {string} [actionLabel] سطر اختياري يصف العملية (مثل: تسجيل الدخول)
 */
export function formatApiError(err, actionLabel = "") {
  const lines = [];
  if (actionLabel) lines.push(actionLabel);

  const response = err?.response;
  const status = response?.status;
  let data = response?.data;

  if (typeof data === "string") {
    const t = data.trim();
    if (t.startsWith("<")) {
      lines.push("السيرفر أرجع HTML بدل JSON.");
      lines.push(`مقتطف: ${t.slice(0, 160).replace(/\s+/g, " ")}…`);
      if (status != null) lines.push(`HTTP ${status}`);
      return lines.filter(Boolean).join("\n");
    }
    try {
      data = JSON.parse(data);
    } catch {
      lines.push(t.slice(0, 400));
      if (status != null) lines.push(`HTTP ${status}`);
      return lines.filter(Boolean).join("\n");
    }
  }

  if (data && typeof data === "object") {
    if (typeof data.message === "string" && data.message.trim()) {
      lines.push(data.message.trim());
    }
    if (typeof data.error === "string" && data.error.trim()) {
      lines.push(data.error.trim());
    }
    if (data.errors && typeof data.errors === "object") {
      for (const [field, msgs] of Object.entries(data.errors)) {
        if (Array.isArray(msgs)) {
          for (const m of msgs) {
            if (typeof m === "string" && m.trim()) lines.push(`${field}: ${m.trim()}`);
          }
        } else if (typeof msgs === "string" && msgs.trim()) {
          lines.push(`${field}: ${msgs.trim()}`);
        }
      }
    }
  }

  if (response != null && status != null) {
    lines.push(`HTTP ${status}`);
  }

  if (!response) {
    const code = err?.code;
    const msg = err?.message || "";
    if (msg === "Network Error" || code === "ERR_NETWORK") {
      lines.push(
        "Network Error — المتصفح لم يستلم رداً صالحاً. غالباً: CORS على الخادم، السيرفر متوقف، أو إضافة تعترض الطلبات (مثل Postman Interceptor / ajaxRequestInterceptor).",
      );
    } else if (msg) {
      lines.push(msg);
    } else {
      lines.push("لا يوجد رد من الخادم.");
    }
    const cfg = err?.config;
    const url = [cfg?.baseURL, cfg?.url].filter(Boolean).join("");
    if (url) lines.push(`عنوان الطلب: ${url}`);
    return dedupeLines(lines).join("\n");
  }

  if (lines.length <= (actionLabel ? 1 : 0)) {
    lines.push(err?.message || "فشل الطلب.");
  }

  return dedupeLines(lines).join("\n");
}

function dedupeLines(lines) {
  const out = [];
  const seen = new Set();
  for (const line of lines) {
    const s = String(line).trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/**
 * عند نجاح HTTP لكن جسم تسجيل الدخول لا يحتوي token/user (تشخيص للمستخدم)
 */
export function formatIncompleteLoginResponse(response) {
  const status = response?.status;
  const headers = response?.headers || {};
  const ct =
    headers["content-type"] ||
    headers["Content-Type"] ||
    (typeof headers.get === "function" ? headers.get("content-type") : "") ||
    "";
  let d = response?.data;
  if (typeof d === "string") {
    try {
      d = JSON.parse(d);
    } catch {
      // يبقى نصاً
    }
  }
  const preview =
    typeof d === "object" && d !== null
      ? JSON.stringify(d, null, 0).slice(0, 600)
      : String(d ?? "").slice(0, 600);
  return [
    "استجابة تسجيل الدخول غير مكتملة (لا يوجد token أو user.role).",
    `HTTP ${status ?? "?"}`,
    `Content-Type: ${ct || "(غير معروف)"}`,
    `جسم الاستجابة: ${preview}${String(preview).length >= 600 ? "…" : ""}`,
  ].join("\n");
}
