/** سجل أحداث أمني — يُعرض للمدير فقط */
const KEY = "pharmacySecurityAuditLog_v1";
const MAX_ROWS = 600;

export function readAuditLog() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

/**
 * @param {{ action: string, details?: string, username?: string, role?: string }} entry
 */
export function clearAuditLog() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function appendAudit(entry) {
  const row = {
    id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    action: String(entry.action || "event"),
    details: String(entry.details || ""),
    username: String(entry.username || ""),
    role: String(entry.role || ""),
  };
  try {
    const prev = readAuditLog();
    const next = [row, ...prev].slice(0, MAX_ROWS);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    localStorage.setItem(KEY, JSON.stringify([row]));
  }
}
