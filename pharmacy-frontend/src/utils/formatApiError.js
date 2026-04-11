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
 * رسالة قصيرة لتسجيل الدخول فقط (بدون HTTP / Content-Type / عنوان الطلب).
 * يدعم حالات يعيد فيها البروكسي 200 مع JSON خطأ أو Content-Type خاطئ.
 */
export function loginFailureUserMessage(status, rawData) {
  let p = rawData;
  if (typeof p === "string") {
    const t = p.trim();
    if (t.startsWith("<")) {
      return "تعذر الاتصال بالسيرفر. تحقق من أن واجهة الـ API تعمل.";
    }
    try {
      p = JSON.parse(p);
    } catch {
      return "تعذر تسجيل الدخول. تحقق من البيانات.";
    }
  }

  if (p && typeof p === "object") {
    const errStr = typeof p.error === "string" ? p.error.trim() : "";
    if (errStr === "اسم المستخدم غير صحيح" || errStr === "كلمة المرور غير صحيحة") {
      return "اسم المستخدم أو كلمة المرور غير صحيحة.";
    }
    if (errStr === "يجب إدخال اسم المستخدم وكلمة المرور") return errStr;
    if (errStr.includes("موافقة الأدمن")) return errStr;
    if (errStr.includes("غير مفعّل")) return errStr;
    if (errStr) return errStr;

    if (p.errors && typeof p.errors === "object") {
      for (const msgs of Object.values(p.errors)) {
        if (Array.isArray(msgs) && typeof msgs[0] === "string") return msgs[0];
        if (typeof msgs === "string") return msgs;
      }
    }
    const m = typeof p.message === "string" ? p.message.trim() : "";
    if (m) return m;
  }

  if (status === 429) return "محاولات كثيرة. انتظر قليلاً ثم أعد المحاولة.";
  if (status >= 500) return "السيرفر غير متاح مؤقتاً. حاول لاحقاً.";

  return "تعذر تسجيل الدخول. تحقق من اسم المستخدم وكلمة المرور.";
}

/** أخطاء axios لصفحة الدخول (شبكة، إلخ) — نفس أسلوب الرسائل القصيرة */
export function formatLoginCatchError(err) {
  const res = err?.response;
  if (res) {
    return loginFailureUserMessage(res.status ?? 0, res.data);
  }
  if (err?.message === "Network Error" || err?.code === "ERR_NETWORK") {
    return "لا يوجد اتصال بالسيرفر. تحقق من الإنترنت، من تشغيل الخادم، ومن ضبط عنوان الـ API (مثل VITE_API_BASE_URL) إن كنت على الإنتاج.";
  }
  const code = err?.code;
  const msg = typeof err?.message === "string" ? err.message.trim() : "";
  if (code === "ECONNABORTED" || /timeout/i.test(msg)) {
    return "انتهت مهلة الاتصال بالسيرفر. حاول مرة أخرى.";
  }
  if (msg) {
    return `تعذر تسجيل الدخول: ${msg}`;
  }
  if (code) {
    return `تعذر تسجيل الدخول (رمز: ${code}). تحقق من أن الخادم يعمل وعنوان الـ API صحيح.`;
  }
  return "تعذر تسجيل الدخول. حاول مرة أخرى.";
}
