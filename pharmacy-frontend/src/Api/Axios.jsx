import axios from "axios";
import { baseURL } from "./Api";
import Cookies from "universal-cookie";
import { performFullLogout } from "../utils/fullSessionLogout";
import {
  apiDebugEnabled,
  logAxiosError,
  logAxiosRequest,
  logAxiosResponse,
} from "./apiDebugLog";

const cookies = new Cookies();

/** يمنع تعدد استدعاءات تسجيل الخروج عند عدة طلبات فاشلة بـ 401 معاً */
let sessionExpiredLogoutStarted = false;

function normalizedApiPath(config) {
  const raw = String(config?.url || "");
  try {
    if (/^https?:\/\//i.test(raw)) {
      const { pathname } = new URL(raw);
      return pathname.replace(/^\/api\/?/i, "").replace(/^\/+/, "") || "";
    }
  } catch {
    // ignore
  }
  let path = raw.replace(/^\/+/, "");
  const q = path.indexOf("?");
  if (q >= 0) path = path.slice(0, q);
  return path;
}

/**
 * طلبات تعيد 401 لأسباب تشغيلية (ليست «انتهاء الجلسة») — لا نخرج المستخدم بسببها.
 * تسجيل الدخول يستخدم غالباً validateStatus لكن نبقي الاستثناء للأمان.
 */
function shouldSkipSessionExpiredLogout(config) {
  if (config?.__skipSessionExpiredLogout) return true;
  const path = normalizedApiPath(config);
  const exact = new Set(["login", "login/verify-otp", "change-password", "logout"]);
  if (exact.has(path)) return true;
  return ["login/", "login/verify-otp/", "change-password/", "logout/"].some((p) =>
    path.startsWith(p),
  );
}

export const Axios = axios.create({
  baseURL: baseURL,
  timeout: 15000,
  // false: API على دومين مختلف (Render) — التوكن يُرسل عبر Authorization وليس كوكيز cross-site.
  // true يكسر CORS مع Allow-Origin: * على Laravel.
  withCredentials: false,
  headers: {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
  },
});

// الحصول على التوكن عند كل طلب
Axios.interceptors.request.use((config) => {
  const token = cookies.get("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const method = (config.method || "get").toUpperCase();
  const path = config.url || "";
  console.info("[صيدلية][→]", method, path, token ? "(مع توكن)" : "(بدون توكن)");
  if (apiDebugEnabled()) logAxiosRequest(config);
  return config;
});

Axios.interceptors.response.use(
  (response) => {
    if (apiDebugEnabled()) logAxiosResponse(response);
    return response;
  },
  async (error) => {
    const config = error?.config || {};
    const method = String(config.method || "get").toLowerCase();
    const canRetryMethod = ["get", "head", "options"].includes(method);
    const status = Number(error?.response?.status || 0);
    const isRetryableStatus = status >= 500 || status === 429;
    const isNetworkOrTimeout = !status || error?.code === "ECONNABORTED";
    const shouldRetry = canRetryMethod && (isRetryableStatus || isNetworkOrTimeout);
    const currentRetry = Number(config.__retryCount || 0);
    if (shouldRetry && currentRetry < 2) {
      config.__retryCount = currentRetry + 1;
      await new Promise((resolve) => setTimeout(resolve, 400 * config.__retryCount));
      return Axios(config);
    }
    if (status === 401 && !shouldSkipSessionExpiredLogout(config) && !sessionExpiredLogoutStarted) {
      sessionExpiredLogoutStarted = true;
      performFullLogout(Axios);
    }
    logAxiosError(error);
    return Promise.reject(error);
  },
);
