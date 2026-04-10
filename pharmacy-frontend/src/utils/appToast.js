import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

const CONFIRM_COLOR = "#2e7d32";
const DANGER_COLOR = "#c62828";
const CANCEL_COLOR = "#546e7a";

const customClass = {
  popup: "app-swal-popup",
  title: "app-swal-title",
  htmlContainer: "app-swal-html",
  confirmButton: "app-swal-confirm",
  cancelButton: "app-swal-cancel",
  actions: "app-swal-actions",
  toast: "app-swal-toast",
};

function rtlPopup(popup) {
  if (!popup) return;
  popup.setAttribute("dir", "rtl");
  popup.setAttribute("lang", "ar");
}

function mapSeverityToIcon(severity) {
  if (severity === "error") return "error";
  if (severity === "warning") return "warning";
  if (severity === "info") return "info";
  return "success";
}

function titleForSeverity(severity) {
  if (severity === "error") return "حدث خطأ";
  if (severity === "warning") return "تنبيه";
  if (severity === "info") return "معلومة";
  return "تم بنجاح";
}

/** إشعار خفيف (توست) للرسائل القصيرة */
export function showAppToast(message, severity = "success") {
  const icon = mapSeverityToIcon(severity);
  Swal.fire({
    icon,
    title: String(message || ""),
    toast: true,
    position: "top-end",
    showConfirmButton: false,
    timer: severity === "error" ? 3400 : 2600,
    timerProgressBar: true,
    width: "26em",
    customClass: {
      ...customClass,
      title: "app-swal-title app-swal-toast-title",
    },
    didOpen: (popup) => rtlPopup(popup),
  });
}

/** نافذة بزر «حسناً» — نص بسيط */
export function showAppAlert(message, severity = "info", title) {
  const icon = mapSeverityToIcon(severity);
  return Swal.fire({
    icon,
    title: title ?? titleForSeverity(severity),
    text: String(message ?? ""),
    confirmButtonText: "حسناً",
    confirmButtonColor: CONFIRM_COLOR,
    customClass,
    didOpen: (popup) => rtlPopup(popup),
  });
}

/** نافذة غنية (HTML) مع زر واحد */
export function showAppDialog({
  title = "",
  text,
  html,
  icon = "info",
  confirmButtonText = "حسناً",
  confirmButtonColor = CONFIRM_COLOR,
}) {
  return Swal.fire({
    icon,
    title: title || undefined,
    ...(html != null && html !== ""
      ? { html }
      : { text: text != null ? String(text) : "" }),
    confirmButtonText,
    confirmButtonColor,
    customClass,
    didOpen: (popup) => rtlPopup(popup),
  });
}

/**
 * تأكيد بزرين — يعيد Promise<boolean> (true إذا اختار التأكيد).
 * استخدم html للنصوص متعددة الأسطر أو القوائم.
 */
export function confirmApp({
  title = "تأكيد الإجراء",
  text,
  html,
  confirmText = "تأكيد",
  cancelText = "إلغاء",
  icon = "question",
  danger = false,
}) {
  return Swal.fire({
    icon,
    title,
    ...(html != null && html !== ""
      ? { html }
      : { text: text != null ? String(text) : "" }),
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText,
    confirmButtonColor: danger ? DANGER_COLOR : CONFIRM_COLOR,
    cancelButtonColor: CANCEL_COLOR,
    reverseButtons: true,
    focusCancel: !danger,
    customClass,
    didOpen: (popup) => rtlPopup(popup),
  }).then((r) => r.isConfirmed);
}
