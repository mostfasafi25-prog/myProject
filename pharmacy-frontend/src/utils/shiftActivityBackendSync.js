import { Axios } from "../Api/Axios";

/**
 * يرسل ملخص إنهاء الدوام إلى السيرفر (لا يُرمى خطأ للمستخدم — يُسجّل في الكونسول فقط).
 */
export async function pushCashierShiftCloseToBackend(row) {
  if (!row?.id) return;
  try {
    await Axios.post("cashier-shifts", {
      client_row_id: row.id,
      username: row.username,
      display_name: row.displayName,
      shift_started_at: row.shiftStartedAt || null,
      shift_ended_at: row.shiftEndedAt,
      invoice_count: row.invoiceCount,
      total: row.total,
      cash: row.cash,
      app: row.app,
      credit: row.credit ?? 0,
      invoices: Array.isArray(row.invoices) ? row.invoices : [],
    });
  } catch (e) {
    console.warn("[cashier-shifts] تعذر المزامنة", e?.response?.status, e?.response?.data || e?.message);
  }
}

/** جلب سجلات إنهاء الدوام المحفوظة في السيرفر */
export async function fetchCashierShiftClosesFromBackend() {
  try {
    const { data, status } = await Axios.get("cashier-shifts");
    if (status < 200 || status >= 300) return [];
    return Array.isArray(data?.data) ? data.data : [];
  } catch {
    return [];
  }
}
