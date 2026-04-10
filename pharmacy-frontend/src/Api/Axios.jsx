import axios from "axios";
import { baseURL } from "./Api";
import Cookies from "universal-cookie";

const cookies = new Cookies();

export const Axios = axios.create({
  baseURL: baseURL,
  // false: API على دومين مختلف (Render) — التوكن يُرسل عبر Authorization وليس كوكيز cross-site.
  // true يكسر CORS مع Allow-Origin: * على Laravel.
  withCredentials: false,
});

// الحصول على التوكن عند كل طلب
Axios.interceptors.request.use((config) => {
  const token = cookies.get("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
