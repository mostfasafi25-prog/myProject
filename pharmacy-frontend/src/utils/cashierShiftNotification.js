const NOTIFICATIONS_KEY = "systemNotifications";

const roundOneDecimal = (n) => Math.round(Number(n) * 10) / 10;

/**
 * يُرسل للمدير فقط (admin_only). لا يمس حالة React.
 */
export function appendCashierShiftEndNotification({
  username,
  label,
  shiftStartedAt,
  invoiceCount,
  total,
  cash,
  app,
  credit = 0,
}) {
  const endedAt = new Date().toISOString();
  const cr = roundOneDecimal(Number(credit) || 0);
  const detailsLines =
    invoiceCount === 0
      ? [
          `بداية الدوام: ${new Date(shiftStartedAt).toLocaleString("en-GB")}`,
          `نهاية الدوام: ${new Date(endedAt).toLocaleString("en-GB")}`,
          "لم تُسجَّل أي فاتورة مبيعات خلال هذه الجلسة.",
        ]
      : [
          `بداية الدوام: ${new Date(shiftStartedAt).toLocaleString("en-GB")}`,
          `نهاية الدوام: ${new Date(endedAt).toLocaleString("en-GB")}`,
          `عدد الفواتير: ${invoiceCount}`,
          `إجمالي المبيعات: ${roundOneDecimal(total).toFixed(1)} شيكل`,
          `منها كاش: ${roundOneDecimal(cash).toFixed(1)} شيكل`,
          `منها تطبيق: ${roundOneDecimal(app).toFixed(1)} شيكل`,
          ...(cr > 0 ? [`منها آجل: ${cr.toFixed(1)} شيكل`] : []),
        ];

  const notification = {
    id: `NTF-${Date.now()}`,
    type: "shift_end",
    prefCategory: "shift_end",
    read: false,
    readBy: [],
    deletedBy: [],
    title: `انتهاء دوام — ${label} (${username})`,
    message:
      invoiceCount === 0
        ? `${label} أنهى الدوام بدون مبيعات مسجلة في الجلسة.`
        : `${label} أنهى الدوام: ${invoiceCount} فاتورة، إجمالي ${roundOneDecimal(total).toFixed(1)} شيكل.`,
    details: detailsLines.join("\n"),
    createdAt: endedAt,
    recipients: "admin_only",
  };

  try {
    const existingNotifications = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY));
    const nextNotifications = Array.isArray(existingNotifications)
      ? [notification, ...existingNotifications]
      : [notification];
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(nextNotifications));
  } catch {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify([notification]));
  }
}

export function appendUserLoginNotification({ username, role }) {
  const at = new Date().toISOString();
  const roleLabel =
    role === "admin" ? "مدير" : role === "super_admin" ? "سوبر أدمن" : "كاشير";
  const notification = {
    id: `NTF-LOGIN-${Date.now()}`,
    type: "user_login",
    prefCategory: "user_login",
    read: false,
    readBy: [],
    deletedBy: [],
    title: `تسجيل دخول جديد — ${username}`,
    message: `تم تسجيل دخول ${roleLabel} (${username})`,
    details: `المستخدم: ${username}\nالدور: ${roleLabel}\nالوقت: ${new Date(at).toLocaleString("en-GB")}`,
    createdAt: at,
    recipients: "admin_only",
    fromManagement: true,
    managementLabel: "إدارة النظام",
  };

  try {
    const existing = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY));
    const next = Array.isArray(existing) ? [notification, ...existing] : [notification];
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(next));
  } catch {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify([notification]));
  }
}

/** إشعار للمدير عند كل بيع (يُصفّى حسب تفضيل «إشعار عند كل بيع») */
export function appendAdminSaleNotification(invoice) {
  if (!invoice?.id) return;
  const items = Array.isArray(invoice.items) ? invoice.items : [];
  const lines = items
    .slice(0, 8)
    .map((it) => `${it.name || "—"} ×${Number(it.qty || 0)}`)
    .join("\n");
  const more = items.length > 8 ? `\n… و${items.length - 8} بند آخر` : "";
  const pay =
    invoice.paymentMethod === "app"
      ? "تطبيق"
      : invoice.paymentMethod === "credit"
        ? `آجل${invoice.creditCustomerName ? ` (${invoice.creditCustomerName})` : ""}`
        : "كاش";
  const disc = Number(invoice.discountAmount || 0) > 0 ? ` | خصم ${Number(invoice.discountAmount).toFixed(1)}` : "";
  const at = new Date().toISOString();
  const notification = {
    id: `NTF-SALE-${Date.now()}`,
    type: "sale_admin",
    prefCategory: "sale_admin",
    read: false,
    readBy: [],
    deletedBy: [],
    title: `بيع — ${invoice.id}`,
    message: `${invoice.soldBy || invoice.soldByUsername || "كاشير"} — ${Number(invoice.total || 0).toFixed(1)} شيكل (${pay})`,
    details: `الوقت: ${new Date(at).toLocaleString("en-GB")}\nالدفع: ${pay}${disc}\nالصافي: ${Number(invoice.total || 0).toFixed(2)} شيكل\n\n${lines}${more}`,
    createdAt: at,
    recipients: "admin_only",
  };
  try {
    const existing = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY));
    const next = Array.isArray(existing) ? [notification, ...existing] : [notification];
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(next));
  } catch {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify([notification]));
  }
}
