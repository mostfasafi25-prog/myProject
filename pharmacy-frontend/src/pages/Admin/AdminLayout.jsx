import {
  Category,
  DarkMode,
  Dashboard,
  FactCheck,
  Groups,
  Inventory,
  KeyboardArrowDown,
  KeyboardArrowLeft,
  Lens,
  LightMode,
  Menu as MenuOpenIcon,
  LocalPharmacy,
  LocalShipping,
  Logout,
  Notifications,
  PointOfSale,
  Replay,
  Settings,
  ShoppingCart,
} from "@mui/icons-material";
import {
  Badge,
  alpha,
  Avatar,
  Box,
  Button,
  Collapse,
  Divider,
  Drawer,
  IconButton,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Cookies from "universal-cookie";
import { PHARMACY_DISPLAY_NAME } from "../../config/appBranding";
import { isNotificationUnreadForCurrentUser } from "../../utils/notificationVisibility";
import { getStoredUser, isSuperCashier, PHARMACY_USER_STORAGE_EVENT } from "../../utils/userRoles";

const ADMIN_SIDE_MENU = [
  { label: "لوحة التحكم", icon: <FactCheck fontSize="small" />, path: "/admin", type: "item" },
  {
    label: "المخزون",
    key: "inventory",
    icon: <Inventory fontSize="small" />,
    type: "group",
    children: [
      { label: "الاصناف", path: "/admin/inventory" },
      { label: "الاقسام", path: "/admin/categories", icon: <Category fontSize="inherit" /> },
      { label: "جرد المخزون", path: "/admin/stocktake" },
      { label: "زبائن الآجل", path: "/admin/debt-customers" },
    ],
  },
  {
    label: "المبيعات",
    key: "sales",
    icon: <ShoppingCart fontSize="small" />,
    type: "group",
    children: [
      { label: "تقارير المبيعات", path: "/admin/reports/sales" },
      { label: "مرتجعات المبيعات", path: "/admin/returns/sales" },
    ],
  },
  {
    label: "المشتريات",
    key: "purchases",
    icon: <ShoppingCart fontSize="small" />,
    type: "group",
    children: [
      { label: "تقارير المشتريات", path: "/admin/reports/purchases" },
      { label: "مرتجعات المشتريات", path: "/admin/returns/purchases" },
    ],
  },
  {
    label: "الصلاحيات",
    key: "users",
    icon: <Groups fontSize="small" />,
    type: "group",
    children: [
      { label: "الموظفين", path: "/admin/staff" },
      { label: "سجل النشاط", path: "/admin/activity-log" },
    ],
  },
  {
    label: "الاعدادات",
    key: "settings",
    icon: <Settings fontSize="small" />,
    type: "group",
    children: [
      { label: "إعداد الحساب", path: "/admin/settings/account" },
      { label: "مظهر الموقع", path: "/admin/settings/appearance" },
      { label: "إعداد المال", path: "/admin/settings/money" },
      { label: "إعداد الإشعارات", path: "/admin/settings/notifications" },
      { label: "إعدادات الكاشير", path: "/admin/settings/cashier" },
    ],
  },
];

/** سوبر كاشير: لوحة توريد + مخزون + مشتريات */
const SUPER_CASHIER_SIDE_MENU = [
  { label: "لوحة التحكم", icon: <Dashboard fontSize="small" />, path: "/cashier/dashboard", type: "item" },
  {
    label: "المخزون",
    key: "inventory",
    icon: <Inventory fontSize="small" />,
    type: "group",
    children: [
      { label: "الاصناف", path: "/admin/inventory" },
      { label: "الاقسام", path: "/admin/categories", icon: <Category fontSize="inherit" /> },
      { label: "زبائن الآجل", path: "/admin/debt-customers" },
    ],
  },
  {
    label: "المشتريات",
    key: "purchases",
    icon: <LocalShipping fontSize="small" />,
    type: "group",
    children: [
      { label: "إدارة المشتريات", path: "/admin/purchases" },
      { label: "مرتجعات المشتريات", path: "/admin/returns/purchases" },
    ],
  },
];

function AdminSidebarNav({
  menuItems,
  openSections,
  setOpenSections,
  onItemNavigate,
  onLogout,
  /** false = يتمدد الشريط بكل البنود دون تمرير داخلي (سطح المكتب) */
  scrollable = true,
  /** على سطح المكتب يُعرض الخروج من الشريط العلوي فقط */
  showSidebarLogout = true,
}) {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const isActivePath = (path) => location.pathname === path;
  const hasActiveChild = (children = []) => children.some((child) => isActivePath(child.path));
  const cashierLike = (() => {
    const r = getStoredUser()?.role;
    return r === "cashier" || r === "super_cashier";
  })();
  const bottomMenu = {
    label: cashierLike ? "العودة لصفحة البيع" : "معاينة الكاشير",
    icon: <PointOfSale fontSize="small" />,
    path: "/cashier",
  };

  const go = (path) => {
    navigate(path);
    onItemNavigate?.();
  };

  return (
    <Stack
      sx={{
        width: "100%",
        maxWidth: "100%",
        minHeight: scrollable ? 0 : "auto",
        flex: scrollable ? 1 : "none",
        minWidth: 0,
      }}
    >
      <Stack direction="row" alignItems="center" mb={2} sx={{ gap: 1.5, flexShrink: 0 }}>
        <Avatar sx={{ bgcolor: "primary.main", width: 36, height: 36 }}>
          <LocalPharmacy fontSize="small" />
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography fontWeight={800} fontSize={14} noWrap color="text.primary">
            {PHARMACY_DISPLAY_NAME}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {isSuperCashier(getStoredUser()) ? "مخزون وتوريد" : "Admin Panel"}
          </Typography>
        </Box>
      </Stack>

      <Stack
        sx={{
          gap: 1,
          flex: scrollable ? 1 : "none",
          minHeight: scrollable ? 0 : "auto",
          overflowX: "hidden",
          overflowY: scrollable ? "auto" : "visible",
          overscrollBehavior: scrollable ? "contain" : undefined,
          scrollbarWidth: scrollable ? "none" : undefined,
          msOverflowStyle: scrollable ? "none" : undefined,
          ...(scrollable ? { "&::-webkit-scrollbar": { display: "none" } } : {}),
        }}
      >
        {menuItems.map((item) => {
          if (item.type === "item") {
            const active = isActivePath(item.path);
            return (
              <Button
                key={item.label}
                startIcon={item.icon}
                onClick={() => go(item.path)}
                sx={{
                  justifyContent: "flex-start",
                  textTransform: "none",
                  borderRadius: 2,
                  py: 1,
                  px: 1,
                  color: active ? "primary.main" : "text.secondary",
                  bgcolor: active ? alpha(theme.palette.primary.main, 0.12) : "transparent",
                  fontWeight: active ? 800 : 600,
                  "& .MuiButton-startIcon": { marginInlineStart: 0, marginInlineEnd: 6 },
                }}
              >
                {item.label}
              </Button>
            );
          }

          const isOpen = openSections[item.key];
          const groupActive = hasActiveChild(item.children);
          return (
            <Box key={item.label}>
              <Button
                startIcon={item.icon}
                endIcon={isOpen ? <KeyboardArrowDown fontSize="small" /> : <KeyboardArrowLeft fontSize="small" />}
                onClick={() => setOpenSections((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                sx={{
                  width: "100%",
                  justifyContent: "space-between",
                  textTransform: "none",
                  borderRadius: 2,
                  py: 1,
                  px: 1,
                  color: groupActive ? "primary.main" : "text.secondary",
                  bgcolor: groupActive ? alpha(theme.palette.primary.main, 0.12) : "transparent",
                  fontWeight: groupActive ? 800 : 600,
                  "& .MuiButton-startIcon": { marginInlineStart: 0, marginInlineEnd: 6 },
                  "& .MuiButton-endIcon": { marginInlineStart: 4, marginInlineEnd: 0 },
                }}
              >
                {item.label}
              </Button>
              <Collapse in={isOpen} timeout={0} unmountOnExit>
                <Stack sx={{ gap: 0.5, mt: 0.5, pl: 1 }}>
                  {item.children.map((child) => {
                    const active = isActivePath(child.path);
                    return (
                      <Button
                        key={child.label}
                        size="small"
                        onClick={() => go(child.path)}
                        startIcon={child.icon || <Lens sx={{ fontSize: 9 }} />}
                        sx={{
                          justifyContent: "flex-start",
                          textTransform: "none",
                          color: active ? "primary.main" : "text.secondary",
                          borderRadius: 1.5,
                          py: 0.75,
                          px: 1,
                          bgcolor: active
                            ? alpha(theme.palette.primary.main, 0.16)
                            : alpha(theme.palette.primary.main, 0.04),
                          fontWeight: active ? 800 : 500,
                          textAlign: "right",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          "& .MuiButton-startIcon": { marginInlineStart: 0, marginInlineEnd: 4 },
                        }}
                      >
                        {child.label}
                      </Button>
                    );
                  })}
                </Stack>
              </Collapse>
            </Box>
          );
        })}
      </Stack>

      <Box sx={{ pt: 1.5, flexShrink: 0, mt: scrollable ? "auto" : 1.5 }}>
        <Divider sx={{ mb: 1.5 }} />
        <Button
          fullWidth
          startIcon={bottomMenu.icon}
          onClick={() => go(bottomMenu.path)}
          sx={{
            justifyContent: "center",
            textTransform: "none",
            borderRadius: 2,
            py: 1,
            color: "primary.main",
            bgcolor: alpha(theme.palette.primary.main, 0.12),
            fontWeight: 800,
            textAlign: "center",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            "& .MuiButton-startIcon": { marginInlineStart: 0, marginInlineEnd: 6 },
          }}
        >
          {bottomMenu.label}
        </Button>
        {showSidebarLogout ? (
          <Button
            fullWidth
            startIcon={<Logout fontSize="small" />}
            onClick={() => {
              onLogout();
              onItemNavigate?.();
            }}
            color="error"
            variant="outlined"
            sx={{
              justifyContent: "center",
              textTransform: "none",
              borderRadius: 2,
              py: 1,
              mt: 1,
              fontWeight: 700,
              textAlign: "center",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              "& .MuiButton-startIcon": { marginInlineStart: 0, marginInlineEnd: 6 },
            }}
          >
            تسجيل الخروج
          </Button>
        ) : null}
      </Box>
    </Stack>
  );
}

export default function AdminLayout({ mode = "light", onToggleMode, children, embeddedTopBar = null }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const cookies = new Cookies();
  const isMdDown = useMediaQuery(theme.breakpoints.down("md"));
  const effectiveMenu = isSuperCashier(getStoredUser()) ? SUPER_CASHIER_SIDE_MENU : ADMIN_SIDE_MENU;
  const superCashierUi = isSuperCashier(getStoredUser());
  const [, setUserRefresh] = useState(0);
  useEffect(() => {
    const onUserStorage = () => setUserRefresh((n) => n + 1);
    window.addEventListener(PHARMACY_USER_STORAGE_EVENT, onUserStorage);
    return () => window.removeEventListener(PHARMACY_USER_STORAGE_EVENT, onUserStorage);
  }, []);
  const headerUser = getStoredUser();
  const headerAvatarSrc = headerUser?.avatarDataUrl || headerUser?.avatar || undefined;
  const headerDisplayName =
    headerUser?.name || (headerUser?.username ? String(headerUser.username) : "") || "—";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [openSections, setOpenSections] = useState(() => {
    const menu = isSuperCashier(getStoredUser()) ? SUPER_CASHIER_SIDE_MENU : ADMIN_SIDE_MENU;
    const o = {};
    menu.forEach((item) => {
      if (item.type === "group") o[item.key] = true;
    });
    return o;
  });
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const NOTIFICATIONS_KEY = "systemNotifications";

  const isActivePath = (path) => location.pathname === path;
  const hasActiveChild = (children = []) => children.some((child) => isActivePath(child.path));

  useEffect(() => {
    const menu = isSuperCashier(getStoredUser()) ? SUPER_CASHIER_SIDE_MENU : ADMIN_SIDE_MENU;
    const next = {};
    menu.forEach((item) => {
      if (item.type === "group") next[item.key] = hasActiveChild(item.children);
    });
    setOpenSections(next);
  }, [location.pathname]);

  useEffect(() => {
    const refreshUnread = () => {
      try {
        const raw = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY));
        const list = Array.isArray(raw) ? raw : [];
        const unread = list.filter((n) => isNotificationUnreadForCurrentUser(n)).length;
        setUnreadNotifications(unread);
      } catch {
        setUnreadNotifications(0);
      }
    };
    refreshUnread();
    window.addEventListener("focus", refreshUnread);
    window.addEventListener("pharmacy-notification-prefs-changed", refreshUnread);
    return () => {
      window.removeEventListener("focus", refreshUnread);
      window.removeEventListener("pharmacy-notification-prefs-changed", refreshUnread);
    };
  }, [location.pathname]);

  const handleLogout = () => {
    cookies.remove("token", { path: "/" });
    localStorage.removeItem("user");
    navigate("/login", { replace: true });
  };

  const adminMainContentSx = {
    flex: 1,
    minWidth: 0,
    width: "100%",
    maxWidth: "100%",
    overflowX: "auto",
    WebkitOverflowScrolling: "touch",
    "& .MuiTableContainer-root": {
      overflowX: "auto",
      maxWidth: "100%",
      WebkitOverflowScrolling: "touch",
    },
    [theme.breakpoints.down("md")]: {
      "& .MuiTableContainer-root": {
        overflowX: "auto",
        maxWidth: "100%",
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 2,
        scrollbarWidth: "thin",
        "&::-webkit-scrollbar": { height: 8 },
        "&::-webkit-scrollbar-thumb": {
          borderRadius: 4,
          bgcolor: alpha(theme.palette.text.primary, 0.22),
        },
      },
      "& .MuiTableContainer-root table.MuiTable-root": {
        width: "max-content !important",
        minWidth: "100%",
        tableLayout: "auto !important",
      },
    },
  };

  if (embeddedTopBar) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          bgcolor: "background.default",
          color: "text.primary",
        }}
      >
        {embeddedTopBar}
        <Box sx={{ width: "100%", ...adminMainContentSx }}>{children}</Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        color: "text.primary",
        p: { xs: 0.75, sm: 1.25, md: 2 },
        pb: { xs: "max(10px, env(safe-area-inset-bottom))", md: 2 },
        overflowX: "hidden",
        maxWidth: "100%",
        boxSizing: "border-box",
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
          borderRadius: { xs: 3, md: 4 },
          overflow: "hidden",
          mb: { xs: 1.5, md: 2 },
          boxShadow: { xs: `0 2px 12px ${alpha(theme.palette.common.black, 0.08)}`, md: "none" },
          ...(isMdDown
            ? {
                bgcolor: "background.paper",
              }
            : {
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.secondary.main, 0.05)})`,
              }),
        }}
      >
        {isMdDown ? (
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{
              px: { xs: 1.25, sm: 1.75 },
              py: { xs: 1.25, sm: 1.5 },
              gap: 1,
              minHeight: 52,
              borderBottom: `1px solid ${theme.palette.divider}`,
              bgcolor: alpha(theme.palette.primary.main, theme.palette.mode === "dark" ? 0.12 : 0.06),
            }}
          >
            <IconButton
              color="primary"
              onClick={() => setMobileNavOpen(true)}
              aria-label="فتح القائمة"
              edge="start"
              sx={{
                flexShrink: 0,
                bgcolor: alpha(theme.palette.primary.main, 0.14),
                border: `1px solid ${alpha(theme.palette.primary.main, 0.28)}`,
                color: "primary.main",
                "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.22) },
              }}
            >
              <MenuOpenIcon />
            </IconButton>
            <Typography
              fontWeight={900}
              color="text.primary"
              noWrap
              sx={{
                flex: 1,
                minWidth: 0,
                textAlign: "center",
                fontSize: { xs: "0.92rem", sm: "1rem" },
                px: 0.5,
              }}
            >
              {superCashierUi ? "المخزون والتوريد" : "لوحة الإدارة"}
            </Typography>
            <Stack direction="row" alignItems="center" sx={{ gap: 0.25, flexShrink: 0 }}>
              <IconButton onClick={onToggleMode} color="primary" size="small" aria-label="تبديل الوضع">
                {mode === "dark" ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
              </IconButton>
              {!superCashierUi ? (
                <IconButton
                  onClick={() => navigate("/admin/notifications")}
                  size="small"
                  color="primary"
                  aria-label="الإشعارات"
                >
                  <Badge color="error" badgeContent={unreadNotifications} invisible={!unreadNotifications}>
                    <Notifications fontSize="small" />
                  </Badge>
                </IconButton>
              ) : null}
              <IconButton
                size="small"
                color="error"
                aria-label="تسجيل الخروج"
                onClick={handleLogout}
                sx={{ border: `1px solid ${alpha(theme.palette.error.main, 0.35)}` }}
              >
                <Logout fontSize="small" />
              </IconButton>
              <Avatar
                src={headerAvatarSrc}
                sx={{
                  width: 36,
                  height: 36,
                  border: `2px solid ${alpha(theme.palette.primary.main, 0.35)}`,
                }}
              >
                {!headerAvatarSrc ? (headerDisplayName?.[0] || "?").toUpperCase() : null}
              </Avatar>
            </Stack>
          </Stack>
        ) : (
          <Stack
            direction="row"
            alignItems="center"
            justifyContent="space-between"
            sx={{ px: { xs: 2, sm: 3 }, py: 2, gap: 1.5, minWidth: 0, overflow: "hidden" }}
          >
            <Stack direction="row" alignItems="center" sx={{ gap: 1.5, flex: 1, minWidth: 0, overflow: "hidden" }}>
              <Typography
                fontWeight={800}
                color="primary.main"
                noWrap
                sx={{ pt: 0.75, minWidth: 0 }}
              >
                {superCashierUi ? `${PHARMACY_DISPLAY_NAME} — المخزون والتوريد` : `${PHARMACY_DISPLAY_NAME} — لوحة الإدارة`}
              </Typography>
            </Stack>

            <Stack direction="row" alignItems="center" sx={{ gap: 1.25, flexShrink: 0 }}>
              <IconButton onClick={onToggleMode} color="primary">
                {mode === "dark" ? <LightMode /> : <DarkMode />}
              </IconButton>
              {!superCashierUi ? (
                <IconButton onClick={() => navigate("/admin/notifications")}>
                  <Badge color="error" badgeContent={unreadNotifications} invisible={!unreadNotifications}>
                    <Notifications />
                  </Badge>
                </IconButton>
              ) : null}
              <IconButton color="error" aria-label="تسجيل الخروج" onClick={handleLogout}>
                <Logout />
              </IconButton>
              <Divider orientation="vertical" flexItem />
              <Stack direction="row" alignItems="center" sx={{ gap: 1 }}>
                <Box textAlign="right" sx={{ display: { xs: "none", sm: "block" } }}>
                  <Typography variant="caption" fontWeight={700}>
                    {superCashierUi ? "سوبر كاشير" : headerDisplayName}
                  </Typography>
                  <Typography variant="caption" display="block" color="text.secondary">
                    {superCashierUi ? "توريد بدون عرض الصندوق" : headerUser?.role === "admin" ? "مدير النظام" : "موظف"}
                  </Typography>
                </Box>
                <Avatar src={headerAvatarSrc} sx={{ width: 40, height: 40 }}>
                  {!headerAvatarSrc ? (headerDisplayName?.[0] || "?").toUpperCase() : null}
                </Avatar>
              </Stack>
            </Stack>
          </Stack>
        )}
      </Paper>

      <Drawer
        anchor="right"
        open={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: "block", md: "none" } }}
        PaperProps={{
          sx: {
            width: { xs: "min(100%, 300px)", sm: 280 },
            maxWidth: "100vw",
            p: 2,
            boxSizing: "border-box",
            borderRadius: "16px 0 0 16px",
            borderLeft: `1px solid ${theme.palette.divider}`,
            bgcolor: "background.paper",
            backgroundImage: "none",
            boxShadow: `-4px 0 24px ${alpha(theme.palette.common.black, 0.12)}`,
            display: "flex",
            flexDirection: "column",
            height: "100%",
            maxHeight: "100%",
            minHeight: 0,
          },
        }}
      >
        <AdminSidebarNav
          menuItems={effectiveMenu}
          openSections={openSections}
          setOpenSections={setOpenSections}
          onItemNavigate={() => setMobileNavOpen(false)}
          onLogout={handleLogout}
        />
      </Drawer>

      <Stack direction="row" alignItems="flex-start" sx={{ gap: { xs: 0, sm: 1.5, md: 2 } }}>
        <Paper
          elevation={0}
          sx={{
            width: { md: 248 },
            flexShrink: 0,
            alignSelf: "flex-start",
            p: 2,
            borderRadius: 4,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
            background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, 0.10)}, ${alpha(theme.palette.primary.main, 0.03)})`,
            display: { xs: "none", md: "flex" },
            flexDirection: "column",
            position: { md: "sticky" },
            top: { md: 12 },
            maxHeight: { md: "calc(100vh - 96px)" },
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          <AdminSidebarNav
            menuItems={effectiveMenu}
            openSections={openSections}
            setOpenSections={setOpenSections}
            onLogout={handleLogout}
            scrollable
            showSidebarLogout={false}
          />
        </Paper>

        <Box sx={{ ...adminMainContentSx, minHeight: { md: "calc(100vh - 112px)" } }}>{children}</Box>
      </Stack>
    </Box>
  );
}
