import { isNotificationAllowedByPrefs } from "./notificationPrefs";

function getCurrentUserFromStorage() {
  try {
    return JSON.parse(localStorage.getItem("user")) || null;
  } catch {
    return null;
  }
}

/** من يستطيع رؤية الإشعار حسب المستخدم الحالي (localStorage). */
export function isNotificationVisibleToCurrentUser(notification) {
  const user = getCurrentUserFromStorage();
  const username = user?.username || "";
  const role = user?.role || "";
  const deletedBy = Array.isArray(notification?.deletedBy) ? notification.deletedBy : [];
  if (username && deletedBy.includes(username)) return false;

  const recipients = notification?.recipients;
  if (recipients === "admin_only") {
    if (role !== "admin") return false;
    return isNotificationAllowedByPrefs(notification);
  }
  if (recipients === "all" || recipients == null) {
    if (!isNotificationAllowedByPrefs(notification)) return false;
    return true;
  }
  if (Array.isArray(recipients)) {
    if (!recipients.includes(username)) return false;
    return isNotificationAllowedByPrefs(notification);
  }
  return isNotificationAllowedByPrefs(notification);
}

export function isNotificationUnreadForCurrentUser(notification) {
  if (!isNotificationVisibleToCurrentUser(notification)) return false;
  const user = getCurrentUserFromStorage();
  const username = user?.username || "";
  if (Array.isArray(notification?.readBy)) return !notification.readBy.includes(username);
  return !notification?.read;
}
