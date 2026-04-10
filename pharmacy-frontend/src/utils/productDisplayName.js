/** اسم العرض: الاسم الأساسي + وصف الفرع/التركيز (مثل باراسيتامول — 500 مجم) */
export function productDisplayName(p) {
  if (!p) return "—";
  const v = String(p.variantLabel ?? "").trim();
  const n = String(p.name ?? "").trim();
  return v ? `${n} — ${v}` : n || "—";
}
