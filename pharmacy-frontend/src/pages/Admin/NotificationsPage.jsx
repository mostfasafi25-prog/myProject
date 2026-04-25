import { DeleteForever, Notifications } from "@mui/icons-material";
import {
  alpha,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { adminPageContainerSx, adminPageSubtitleSx } from "../../utils/adminPageLayout";
import AdminLayout from "./AdminLayout";
import { isNotificationVisibleToCurrentUser } from "../../utils/notificationVisibility";

const NOTIFICATIONS_KEY = "systemNotifications";

function getStoredNotifications() {
  try {
    const raw = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function resolveCurrentUsername() {
  try {
    const user = JSON.parse(localStorage.getItem("user"));
    return user?.username || "";
  } catch {
    return "";
  }
}

function isNotificationRead(notification, username) {
  if (Array.isArray(notification?.readBy)) return notification.readBy.includes(username);
  return Boolean(notification?.read);
}

export default function NotificationsPage({ mode, onToggleMode }) {
  const theme = useTheme();
  const [notifications, setNotifications] = useState(getStoredNotifications);
  const [activeNotification, setActiveNotification] = useState(null);
  const [notifyPrefsTick, setNotifyPrefsTick] = useState(0);
  const currentUsername = useMemo(resolveCurrentUsername, []);

  useEffect(() => {
    const on = () => setNotifyPrefsTick((n) => n + 1);
    window.addEventListener("pharmacy-notification-prefs-changed", on);
    return () => window.removeEventListener("pharmacy-notification-prefs-changed", on);
  }, []);

  const visibleNotifications = useMemo(() => {
    void notifyPrefsTick;
    return notifications.filter((n) => isNotificationVisibleToCurrentUser(n));
  }, [notifications, notifyPrefsTick]);

  const unreadCount = useMemo(
    () => visibleNotifications.filter((n) => !isNotificationRead(n, currentUsername)).length,
    [visibleNotifications, currentUsername],
  );
  const persist = (next) => {
    setNotifications(next);
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(next));
  };

  const openDetails = (notification) => {
    setActiveNotification(notification);
    if (!isNotificationRead(notification, currentUsername)) {
      const next = notifications.map((n) =>
        n.id === notification.id
          ? { ...n, read: true, readBy: Array.from(new Set([...(Array.isArray(n.readBy) ? n.readBy : []), currentUsername])) }
          : n,
      );
      persist(next);
    }
  };

  return (
    <AdminLayout mode={mode} onToggleMode={onToggleMode}>
      <Box sx={adminPageContainerSx}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "center" }}
          sx={{ mb: 2, gap: 1.5 }}
        >
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" fontWeight={900} sx={{ fontSize: { xs: "1.2rem", sm: "1.5rem" } }}>
              الإشعارات
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={adminPageSubtitleSx}>
              كل إشعارات البيع والشراء تظهر هنا بالتفاصيل الكاملة
            </Typography>
          </Box>
          <Button
            color="error"
            variant="outlined"
            startIcon={<DeleteForever />}
            onClick={() => {
              const next = notifications.map((n) => ({
                ...n,
                deletedBy: Array.from(new Set([...(Array.isArray(n.deletedBy) ? n.deletedBy : []), currentUsername])),
              }));
              persist(next);
            }}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            حذف كل الإشعارات
          </Button>
        </Stack>

        <Card sx={{ p: 1.2, borderRadius: 3, mb: 1.5 }}>
          <Typography variant="body2" color="text.secondary">
            غير مقروء: <b>{unreadCount}</b> | الإجمالي: <b>{visibleNotifications.length}</b>
          </Typography>
        </Card>

        <Stack sx={{ gap: 1 }}>
          {visibleNotifications.length === 0 ? (
            <Card sx={{ p: 2.2, borderRadius: 3, textAlign: "center" }}>
              <Notifications sx={{ color: "text.secondary", fontSize: 34 }} />
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8 }}>
                لا توجد إشعارات حالياً
              </Typography>
            </Card>
          ) : (
            visibleNotifications.map((n) => (
              <Card
                key={n.id}
                sx={{
                  p: 1.2,
                  borderRadius: 3,
                  border: `1px solid ${alpha(theme.palette.primary.main, isNotificationRead(n, currentUsername) ? 0.15 : 0.35)}`,
                  bgcolor: isNotificationRead(n, currentUsername) ? "background.paper" : alpha(theme.palette.primary.main, 0.06),
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ gap: 1 }}>
                  <Box sx={{ cursor: "pointer" }} onClick={() => openDetails(n)}>
                    <Stack direction="row" alignItems="center" sx={{ gap: 0.75, flexWrap: "wrap", mb: 0.25 }}>
                      <Typography fontWeight={isNotificationRead(n, currentUsername) ? 700 : 900}>{n.title}</Typography>
                      {n.fromManagement ? (
                        <Chip size="small" color="primary" variant="outlined" label={n.managementLabel || "إدارة النظام"} />
                      ) : null}
                    </Stack>
                    <Typography variant="body2" color="text.secondary">{n.message}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {n.createdAt ? new Date(n.createdAt).toLocaleString("en-GB") : "-"}
                    </Typography>
                  </Box>
                  <IconButton
                    color="error"
                    onClick={() => {
                      const next = notifications.map((x) =>
                        x.id === n.id
                          ? { ...x, deletedBy: Array.from(new Set([...(Array.isArray(x.deletedBy) ? x.deletedBy : []), currentUsername])) }
                          : x,
                      );
                      persist(next);
                    }}
                  >
                    <DeleteForever fontSize="small" />
                  </IconButton>
                </Stack>
              </Card>
            ))
          )}
        </Stack>

        <Dialog 
  open={Boolean(activeNotification)} 
  onClose={() => setActiveNotification(null)} 
  fullWidth 
  maxWidth="sm"
  PaperProps={{ sx: { borderRadius: 4 } }}
>
  <DialogTitle sx={{ borderBottom: '1px solid #eee', mb: 1, pb: 1 }}>
    <Stack direction="row" alignItems="center" justifyContent="space-between">
      <Typography fontWeight={800} variant="h6">تفاصيل الإشعار</Typography>
      {activeNotification?.fromManagement && (
        <Chip 
          size="small" 
          color="primary" 
          label={activeNotification.managementLabel || "إدارة النظام"} 
          sx={{ fontWeight: 700 }}
        />
      )}
    </Stack>
  </DialogTitle>

  <DialogContent>
    <Stack spacing={2} sx={{ mt: 1 }}>
      {/* جدول البيانات البسيط */}
      <Box sx={{ border: '1px solid #eee', borderRadius: 3, overflow: 'hidden' }}>
        {[
          { label: "العنوان", value: activeNotification?.title },
          { label: "الرسالة", value: activeNotification?.message },
          { label: "التفاصيل", value: activeNotification?.details || "---" },
          { 
            label: "التاريخ", 
            value: activeNotification?.createdAt ? new Date(activeNotification.createdAt).toLocaleString("ar-SA") : "-" 
          },
        ].map((row, index) => (
          <Box 
            key={index} 
            sx={{ 
              display: 'flex', 
              p: 2, 
              borderBottom: index !== 3 ? '1px solid #f5f5f5' : 'none',
              bgcolor: index % 2 === 0 ? '#fff' : '#fafafa'
            }}
          >
            <Typography variant="body2" sx={{ width: '30%', color: 'text.secondary', fontWeight: 700 }}>
              {row.label}
            </Typography>
            <Typography variant="body2" sx={{ width: '70%', fontWeight: 600 }}>
              {row.value}
            </Typography>
          </Box>
        ))}
      </Box>
    </Stack>
  </DialogContent>

  <DialogActions sx={{ p: 3, bgcolor: '#fbfbfb' }}>
    <Button 
      color="error" 
      onClick={() => {
        if (activeNotification) {
          const next = notifications.map((x) =>
            x.id === activeNotification.id
              ? { ...x, deletedBy: Array.from(new Set([...(Array.isArray(x.deletedBy) ? x.deletedBy : []), currentUsername])) }
              : x,
          );
          persist(next);
        }
        setActiveNotification(null);
      }}
      sx={{ px: 3 }}
    >
      حذف الإشعار
    </Button>
    <Button variant="contained" onClick={() => setActiveNotification(null)} sx={{ px: 4, borderRadius: 2 }}>
      إغلاق
    </Button>
  </DialogActions>
</Dialog>
      </Box>
    </AdminLayout>
  );
}
