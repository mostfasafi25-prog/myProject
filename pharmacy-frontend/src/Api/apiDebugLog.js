/** تسجيل تشخيصي للـ API — Console في المتصفح */

const TAG = "[صيدلية]";

export function apiDebugEnabled() {
  return import.meta.env.DEV || import.meta.env.VITE_DEBUG_CONSOLE === "true";
}

export function logApiBootstrap(info) {
  console.info(`${TAG}[تهيئة]`, info);
}

export function redactSensitiveBody(data) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return data;
  const keys = new Set([
    "password",
    "current_password",
    "new_password",
    "confirmNewPassword",
    "password_confirmation",
    "currentPassword",
  ]);
  const out = { ...data };
  for (const k of Object.keys(out)) {
    if (keys.has(k)) out[k] = "[مخفي]";
  }
  return out;
}

export function logAxiosRequest(config) {
  const method = (config.method || "get").toUpperCase();
  const url = config.baseURL ? `${config.baseURL}${config.url || ""}` : config.url;
  const entry = {
    method,
    url,
    hasAuthHeader: Boolean(config.headers?.Authorization),
  };
  if (config.data != null && typeof config.data === "object") {
    if (typeof FormData !== "undefined" && config.data instanceof FormData) {
      entry.body = "[FormData]";
    } else {
      const raw =
        typeof config.data === "string"
          ? (() => {
              try {
                return JSON.parse(config.data);
              } catch {
                return {};
              }
            })()
          : config.data;
      entry.body = redactSensitiveBody(raw);
    }
  }
  console.info(`${TAG}[طلب]`, entry);
}

export function logAxiosResponse(response) {
  const method = (response.config?.method || "").toUpperCase();
  const path = response.config?.url || "";
  console.info(`${TAG}[استجابة OK]`, {
    status: response.status,
    method,
    path,
    hasData: Boolean(response.data),
    keys: response.data && typeof response.data === "object" ? Object.keys(response.data).slice(0, 12) : [],
  });
}

export function logAxiosError(error) {
  const status = error.response?.status;
  const data = error.response?.data;
  const path = error.config?.url || "";
  const base = error.config?.baseURL || "";
  console.warn(`${TAG}[خطأ شبكة/API]`, {
    message: error.message,
    code: error.code,
    status,
    url: base && path ? `${base}${path}` : path || error.config?.url,
    serverError: typeof data?.error === "string" ? data.error : data?.message,
    hint:
      status === undefined && !error.response
        ? "غالباً CORS، إضافة متصفح، أو السيرفر غير متاح — جرّب نافذة خاصة بدون إضافات."
        : undefined,
  });
}

export function logHealthResult(ok, payload, err) {
  if (ok && payload) {
    console.info(`${TAG}[فحص الخادم /health]`, {
      app: payload.app,
      status: payload.status,
      database: payload.database,
      time: payload.time,
      database_message: payload.database_message,
    });
  } else {
    console.warn(`${TAG}[فحص الخادم /health فشل]`, err?.message || err);
  }
}
