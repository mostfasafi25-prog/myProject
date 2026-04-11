import { PHARMACY_DISPLAY_NAME } from "./appBranding";

/** وصف جذاب لمشاركة الرابط (Open Graph / Twitter / محركات البحث) */
export const SITE_OG_DESCRIPTION =
  "هل تبحث عن طريقة سهلة ودقيقة لإدارة مبيعات ومخزون صيدليتك؟ منصة متكاملة للكاشير، المخزون، المشتريات، والتقارير — منظومة واحدة تُسهّل يومك وتُبقي أرصدتك واضحة.";

export const SITE_KEYWORDS =
  "صيدلية, نظام صيدلية, برنامج صيدلية, كاشير صيدلية, مخزون أدوية, فواتير, تقارير مبيعات, مشتريات صيدلية, إدارة صيدلية, صندوق صيدلية";

const DEFAULT_TITLE = PHARMACY_DISPLAY_NAME;

const RULES = [
  {
    test: (p) => p === "/login" || p === "/register",
    title: `تسجيل الدخول — ${PHARMACY_DISPLAY_NAME}`,
    description: `الدخول الآمن لنظام ${PHARMACY_DISPLAY_NAME}. ${SITE_OG_DESCRIPTION}`,
  },
  {
    test: (p) => p === "/admin" || p === "/admin/",
    title: `لوحة التحكم — ${PHARMACY_DISPLAY_NAME}`,
    description: `ملخص المبيعات، المخزون، والتنبيهات في لوحة واحدة. ${SITE_OG_DESCRIPTION}`,
  },
  {
    test: (p) => p.startsWith("/admin/inventory"),
    title: `المخزون والأصناف — ${PHARMACY_DISPLAY_NAME}`,
    description: "متابعة الكميات، التنبيهات، والتوريد لكل صنف.",
  },
  {
    test: (p) => p.startsWith("/admin/categories"),
    title: `أقسام المبيعات — ${PHARMACY_DISPLAY_NAME}`,
    description: "تنظيم أقسام العرض والمبيعات بما يتوافق مع عمل الصيدلية.",
  },
  {
    test: (p) => p.startsWith("/admin/purchases"),
    title: `المشتريات — ${PHARMACY_DISPLAY_NAME}`,
    description: "تسجيل فواتير الشراء وربطها بالمخزون والخزنة.",
  },
  {
    test: (p) => p.startsWith("/admin/staff"),
    title: `الموظفين — ${PHARMACY_DISPLAY_NAME}`,
    description: "إدارة حسابات الكاشير والمدير والصلاحيات.",
  },
  {
    test: (p) => p.startsWith("/admin/settings"),
    title: `الإعدادات — ${PHARMACY_DISPLAY_NAME}`,
    description: "المظهر، المال، الإشعارات، وخيارات النظام.",
  },
  {
    test: (p) => p.startsWith("/admin/reports"),
    title: `التقارير — ${PHARMACY_DISPLAY_NAME}`,
    description: "تحليل المبيعات والأداء لفترات زمنية مختلفة.",
  },
  {
    test: (p) => p.startsWith("/cashier"),
    title: `الكاشير — ${PHARMACY_DISPLAY_NAME}`,
    description: "واجهة بيع سريعة، سلة، دفع، وطباعة وصل.",
  },
];

export function siteAbsoluteOrigin() {
  const v = typeof import.meta !== "undefined" ? import.meta.env?.VITE_PUBLIC_SITE_URL : "";
  const s = String(v || "").trim().replace(/\/$/, "");
  if (s && /^https?:\/\//i.test(s)) return s;
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return "";
}

export function resolveRouteSeo(pathname) {
  const path = pathname.endsWith("/") && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  for (const r of RULES) {
    if (r.test(path)) return { title: r.title, description: r.description };
  }
  return {
    title: DEFAULT_TITLE,
    description: SITE_OG_DESCRIPTION,
  };
}
