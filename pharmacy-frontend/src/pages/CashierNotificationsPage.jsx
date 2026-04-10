import { ArrowBack, DarkMode, DeleteForever, LightMode, LocalPharmacy, Notifications } from "@mui/icons-material";
import {
  alpha,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PHARMACY_DISPLAY_NAME } from "../config/appBranding";
import { isNotificationVisibleToCurrentUser } from "../utils/notificationVisibility";

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

export default function CashierNotificationsPage({ mode, onToggleMode }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(getStoredNotifications);
  const [activeNotification, setActiveNotification] = useState(null);
  const [notifyPrefsTick, setNotifyPrefsTick] = useState(0);
  const currentUsername = useMemo(() => resolveCurrentUsername(), []);

  useEffect(() => {
    const on = () => setNotifyPrefsTick((n) => n + 1);
    window.addEventListener("pharmacy-notification-prefs-changed", on);
    return () => window.removeEventListener("pharmacy-notification-prefs-changed", on);
  }, []);

  const unreadCount = useMemo(() => {
    void notifyPrefsTick;
    return notifications.filter((n) => {
      if (!isNotificationVisibleToCurrentUser(n)) return false;
      return !isNotificationRead(n, currentUsername);
    }).length;
  }, [notifications, currentUsername, notifyPrefsTick]);

  const visibleNotifications = useMemo(() => {
    void notifyPrefsTick;
    return notifications.filter((n) => isNotificationVisibleToCurrentUser(n));
  }, [notifications, notifyPrefsTick]);

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
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", color: "text.primary", p: 2 }}>
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
          borderRadius: 4,
          overflow: "hidden",
          background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.secondary.main, 0.05)})`,
          mb: 2,
        }}
      >
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          flexWrap="wrap"
          sx={{ px: 3, py: 2, gap: 1.5 }}
        >
          <Stack direction="row" alignItems="center" sx={{ gap: 1 }}>
            <IconButton onClick={onToggleMode} color="primary">
              {mode === "dark" ? <LightMode /> : <DarkMode />}
            </IconButton>
            <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.2), color: "primary.main", width: 36, height: 36 }}>
              <LocalPharmacy fontSize="small" />
            </Avatar>
            <Box>
              <Typography fontWeight={900} color="primary.main">
                إشعاراتي
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {PHARMACY_DISPLAY_NAME} — الكاشير
              </Typography>
            </Box>
          </Stack>

          <Button
            variant="contained"
            startIcon={<ArrowBack />}
            onClick={() => navigate("/cashier")}
            sx={{ textTransform: "none", fontWeight: 800 }}
          >
            العودة إلى صفحة البيع
          </Button>

          <Stack direction="row" alignItems="center" sx={{ gap: 0.5 }}>
            <Badge color="error" badgeContent={unreadCount} invisible={!unreadCount}>
              <Notifications color="action" />
            </Badge>
          </Stack>
        </Stack>
      </Paper>

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          غير مقروء: <b>{unreadCount}</b> | المعروض لك: <b>{visibleNotifications.length}</b>
        </Typography>
        <Button
          color="error"
          variant="outlined"
          size="small"
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
          حذف كل إشعاراتي
        </Button>
      </Stack>

      <Stack sx={{ gap: 1 }}>
        {visibleNotifications.length === 0 ? (
          <Card sx={{ p: 2.2, borderRadius: 3, textAlign: "center" }}>
            <Notifications sx={{ color: "text.secondary", fontSize: 34 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.8 }}>
              لا توجد إشعارات لك حالياً
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
                <Box sx={{ cursor: "pointer", flex: 1 }} onClick={() => openDetails(n)}>
                  <Stack direction="row" alignItems="center" sx={{ gap: 0.75, flexWrap: "wrap", mb: 0.25 }}>
                    <Typography fontWeight={isNotificationRead(n, currentUsername) ? 700 : 900}>{n.title}</Typography>
                    {n.fromManagement ? (
                      <Chip size="small" color="secondary" variant="filled" label={n.managementLabel || "إدارة النظام"} />
                    ) : null}
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    {n.message}
                  </Typography>
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

      <Dialog open={Boolean(activeNotification)} onClose={() => setActiveNotification(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ textAlign: "right" }}>
          <Stack direction="row" alignItems="center" sx={{ gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <span>{activeNotification?.title}</span>
            {activeNotification?.fromManagement ? (
              <Chip size="small" color="secondary" variant="filled" label={activeNotification.managementLabel || "إدارة النظام"} />
            ) : null}
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ textAlign: "right" }}>
          <Typography variant="body2" color="text.secondary">
            {activeNotification?.message}
          </Typography>
          <Divider sx={{ my: 1.2 }} />
          <Typography sx={{ whiteSpace: "pre-wrap" }}>{activeNotification?.details || "لا توجد تفاصيل إضافية"}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            التاريخ: {activeNotification?.createdAt ? new Date(activeNotification.createdAt).toLocaleString("en-GB") : "-"}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
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
          >
            حذف
          </Button>
          <Button variant="contained" onClick={() => setActiveNotification(null)}>
            إغلاق
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
