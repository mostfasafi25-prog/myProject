/** تاريخ صلاحية الصنف: حقل expiryDate = "YYYY-MM-DD" */

export function parseExpiryDate(isoDate) {
  if (!isoDate) return null;
  const s = String(isoDate).trim();
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

/** عدد الأيام حتى الانتهاء (سالب = منتهي) */
export function daysUntilExpiry(isoDate, ref = new Date()) {
  const d = parseExpiryDate(isoDate);
  if (!d) return null;
  const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((end - start) / 86400000);
}

export function expiryStatus(isoDate) {
  const days = daysUntilExpiry(isoDate);
  if (days == null) return "none";
  if (days < 0) return "expired";
  if (days <= 30) return "soon";
  return "ok";
}
