/**
 * 6 نماذج ألوان — لكل نموذج وضع فاتح وداكن (primary + secondary + borderRadius)
 */
export const THEME_PRESETS = [
  {
    id: "teal_lagoon",
    name: "تركواز البحر",
    hint: "هادئ ومناسب للصيدلية",
    light: { primaryColor: "#0d9488", secondaryColor: "#0f766e", borderRadius: 12 },
    dark: { primaryColor: "#2dd4bf", secondaryColor: "#14b8a6", borderRadius: 12 },
  },
  {
    id: "indigo_nova",
    name: "نوفا نيلي",
    hint: "حديث وواضح",
    light: { primaryColor: "#4f46e5", secondaryColor: "#7c3aed", borderRadius: 14 },
    dark: { primaryColor: "#818cf8", secondaryColor: "#a78bfa", borderRadius: 14 },
  },
  {
    id: "amber_sun",
    name: "شمس كهرمان",
    hint: "دافئ ومريح",
    light: { primaryColor: "#d97706", secondaryColor: "#ea580c", borderRadius: 10 },
    dark: { primaryColor: "#fbbf24", secondaryColor: "#fb923c", borderRadius: 10 },
  },
  {
    id: "rose_clinic",
    name: "عيادة وردية",
    hint: "ناعم ونظيف",
    light: { primaryColor: "#db2777", secondaryColor: "#be185d", borderRadius: 16 },
    dark: { primaryColor: "#f472b6", secondaryColor: "#ec4899", borderRadius: 16 },
  },
  {
    id: "slate_pro",
    name: "سلِيت احترافي",
    hint: "رمادي أنيق للإدارة",
    light: { primaryColor: "#334155", secondaryColor: "#475569", borderRadius: 8 },
    dark: { primaryColor: "#94a3b8", secondaryColor: "#cbd5e1", borderRadius: 8 },
  },
  {
    id: "violet_pulse",
    name: "نبض بنفسجي",
    hint: "جريء ومميز",
    light: { primaryColor: "#7c3aed", secondaryColor: "#c026d3", borderRadius: 12 },
    dark: { primaryColor: "#a78bfa", secondaryColor: "#e879f9", borderRadius: 12 },
  },
];
