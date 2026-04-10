/** جلسة جرد نشطة (واحدة) للمدير */
const SESSION_KEY = "pharmacyStocktakeSession_v1";

export function readStocktakeSession() {
  try {
    const raw = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (raw && typeof raw === "object" && raw.id) return raw;
  } catch {
    // ignore
  }
  return null;
}

export function clearStocktakeSession() {
  localStorage.removeItem(SESSION_KEY);
}

/**
 * @param {{ id: string, title: string, startedAt: string, lines: { productId: number|string, name: string, systemQty: number, countedQty: string }[] }} session
 */
export function writeStocktakeSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function startNewStocktakeSession(title, products) {
  const id = `ST-${Date.now()}`;
  const lines = (Array.isArray(products) ? products : []).map((p) => ({
    productId: p.id,
    name: String(p.name || ""),
    systemQty: Number(p.qty || 0),
    countedQty: String(Number(p.qty || 0)),
  }));
  const session = {
    id,
    title: String(title || "جرد").trim() || "جرد",
    startedAt: new Date().toISOString(),
    lines,
  };
  writeStocktakeSession(session);
  return session;
}
