import { getSyncBaseUrl, pullCollectionFromServer, pushCollectionToServer } from "./pharmacyDataSync";

const inflight = new Map();

function safeParse(raw) {
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function readCriticalJson(key, fallback) {
  const parsed = safeParse(localStorage.getItem(key));
  return parsed == null ? fallback : parsed;
}

export function removeCriticalKey(key) {
  localStorage.removeItem(key);
  void pushCollectionToServer(key, null).catch(() => {});
}

export function writeCriticalJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  void pushCollectionToServer(key, value).catch(() => {});
}

export async function hydrateCriticalKeys(keys) {
  const base = getSyncBaseUrl();
  if (!base || !Array.isArray(keys) || !keys.length) return { ok: false, skipped: true };
  const out = {};
  for (const key of keys) {
    if (!key || inflight.get(key)) continue;
    const p = pullCollectionFromServer(key)
      .then((res) => {
        if (res?.ok && res.data != null) {
          const value = typeof res.data === "string" ? safeParse(res.data) : res.data;
          if (value != null) {
            localStorage.setItem(key, JSON.stringify(value));
            out[key] = true;
          }
        }
      })
      .catch(() => {})
      .finally(() => {
        inflight.delete(key);
      });
    inflight.set(key, p);
    await p;
  }
  return { ok: true, updated: out };
}
