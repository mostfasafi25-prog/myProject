const viteApiBase = import.meta.env.VITE_API_BASE_URL;
const apiOrigin = (viteApiBase || "http://127.0.0.1:8000").replace(/\/$/, "");

if (import.meta.env.PROD && !viteApiBase) {
  console.error(
    "[صيدلية] لم يُعرّف VITE_API_BASE_URL عند البناء. أضفه في Vercel → Environment Variables ثم أعد النشر — وإلا الطلبات تذهب إلى localhost وتفشل.",
  );
}

export const baseURL = `${apiOrigin}/api/`;
