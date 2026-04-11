import { CssBaseline, ThemeProvider, createTheme, alpha } from "@mui/material";
import { darken, getContrastRatio, lighten } from "@mui/material/styles";
import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Cookies from "universal-cookie";
import { Axios } from "./Api/Axios";
import { logHealthResult } from "./Api/apiDebugLog";
import SiteSeo from "./components/SiteSeo";
import Login from "./pages/Auth/Login";
import HomeDashboard from "./pages/Admin/HomeDashboard";
import CashierPage from "./pages/CashierPage";
import CashierNotificationsPage from "./pages/CashierNotificationsPage";
import InventoryPage from "./pages/Admin/InventoryPage";
import CategoriesPage from "./pages/Admin/CategoriesPage";
import InvoicesPage from "./pages/Admin/InvoicesPage";
import ReturnsPage from "./pages/Admin/ReturnsPage";
import ReportsPage from "./pages/Admin/ReportsPage";
import StaffPage from "./pages/Admin/StaffPage";
import ActivityLogPage from "./pages/Admin/ActivityLogPage";
import SettingsPage from "./pages/Admin/SettingsPage";
import AIAssistantPage from "./pages/Admin/AIAssistantPage";
import PurchasesPage from "./pages/Admin/PurchasesPage";
import DebtCustomersPage from "./pages/Admin/DebtCustomersPage";
import StocktakePage from "./pages/Admin/StocktakePage";
import NotificationsPage from "./pages/Admin/NotificationsPage";
import SuperCashierDashboardPage from "./pages/SuperCashierDashboardPage";
import { mergeUserWithProfileExtras } from "./utils/staffProfileExtras";

/** true = دخول مباشر للإدارة بدون تسجيل دخول. عطّل للإنتاج: false */
const TEMP_BYPASS_AUTH_TO_ADMIN = false;

const cookies = new Cookies();
const UI_SETTINGS_KEY = "uiSettings";
const CHATBASE_BOT_ID = "fELicw62nCAmG-UO2a7Ub";
const defaultUiSettings = {
  primaryColor: "#00464d",
  secondaryColor: "#006a63",
  fontFamily: "playpen",
  borderRadius: 10,
  density: "comfortable",
};
const fontFamilyMap = {
  playpen: '"Playpen Sans Arabic","Tajawal","Cairo","Arial",sans-serif',
  cairo: '"Cairo","Tajawal","Arial",sans-serif',
  tajawal: '"Tajawal","Cairo","Arial",sans-serif',
  inter: '"Inter","Tajawal","Cairo","Arial",sans-serif',
};

function hexLuminance(hex) {
  const h = String(hex).replace("#", "");
  if (h.length !== 6) return 0;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** لون العلامة على الخلفيات الداكنة: يفتّح اللون الأصلي حتى يُقرأ النص والأيقونات */
function brandPaletteForMode(hex, mode) {
  const raw = typeof hex === "string" && hex.startsWith("#") ? hex : "#00464d";
  try {
    if (mode === "light") {
      const main = raw;
      return {
        main,
        light: lighten(main, 0.16),
        dark: darken(main, 0.18),
        contrastText: getContrastRatio("#ffffff", main) >= 3 ? "#ffffff" : "#0a1214",
      };
    }
    const deep = raw;
    const L = hexLuminance(deep);
    const main = L > 0.42 ? deep : lighten(deep, 0.34);
    const light = L > 0.42 ? lighten(deep, 0.12) : lighten(deep, 0.48);
    const dark = darken(main, 0.14);
    const contrastText = getContrastRatio("#ffffff", main) >= 4.5 ? "#ffffff" : "#050a0c";
    return { main, light, dark, contrastText };
  } catch {
    return mode === "light"
      ? { main: "#006a63", light: "#26a69a", dark: "#004a43", contrastText: "#ffffff" }
      : { main: "#5eead4", light: "#99f6e4", dark: "#2dd4bf", contrastText: "#050a0c" };
  }
}

function tempBypassAdminUser() {
  return {
    id: 0,
    username: "admin",
    role: "admin",
    approval_status: "approved",
    name: "مدير (وضع مؤقت)",
  };
}

function getStoredUser() {
  if (TEMP_BYPASS_AUTH_TO_ADMIN) return tempBypassAdminUser();
  try {
    const raw = JSON.parse(localStorage.getItem("user"));
    return mergeUserWithProfileExtras(raw);
  } catch {
    return null;
  }
}

/** مدير النظام أو سوبر أدمن — نفس مسارات لوحة الإدارة */
function isAdminPanelRole(role) {
  return role === "admin" || role === "super_admin";
}

function isAuthenticated() {
  if (TEMP_BYPASS_AUTH_TO_ADMIN) return true;
  const user = getStoredUser();
  const token = cookies.get("token");
  return Boolean(user?.role && token);
}

function ProtectedRoleRoute({ allowRoles, children }) {
  const user = getStoredUser();
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  if (!allowRoles.includes(user.role)) {
    if (isAdminPanelRole(user.role)) return <Navigate to="/admin" replace />;
    if (user.role === "super_cashier") return <Navigate to="/cashier" replace />;
    return <Navigate to="/cashier" replace />;
  }
  return children;
}

function RootRedirect() {
  if (TEMP_BYPASS_AUTH_TO_ADMIN) return <Navigate to="/admin" replace />;
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  const user = getStoredUser();
  if (isAdminPanelRole(user?.role)) return <Navigate to="/admin" replace />;
  if (user?.role === "cashier" || user?.role === "super_cashier") return <Navigate to="/cashier" replace />;
  return <Navigate to="/login" replace />;
}

function getStoredUiSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(UI_SETTINGS_KEY));
    if (!raw) return defaultUiSettings;
    return { ...defaultUiSettings, ...raw };
  } catch {
    return defaultUiSettings;
  }
}

function App() {
  const [mode, setMode] = useState(() => localStorage.getItem("themeMode") || "light");
  const [uiSettings, setUiSettings] = useState(getStoredUiSettings);

  useEffect(() => {
    if (TEMP_BYPASS_AUTH_TO_ADMIN) {
      cookies.set("token", "__TEMP_BYPASS_AUTH__", { path: "/" });
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.themeMode = mode;
  }, [mode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await Axios.get("health");
        if (!cancelled) logHealthResult(true, data, null);
      } catch (e) {
        if (!cancelled) logHealthResult(false, null, e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let identified = false;
    let failedIdentityCalls = 0;

    const ensureProxy = () => {
      if (!window.chatbase || window.chatbase("getState") !== "initialized") {
        window.chatbase = (...args) => {
          if (!window.chatbase.q) window.chatbase.q = [];
          window.chatbase.q.push(args);
        };
        window.chatbase = new Proxy(window.chatbase, {
          get(target, prop) {
            if (prop === "q") return target.q;
            return (...args) => target(prop, ...args);
          },
        });
      }
    };

    const identifyUser = async () => {
      if (identified) return;
      if (failedIdentityCalls >= 3) return;
      const token = cookies.get("token");
      if (!token) return;
      try {
        const { data } = await Axios.get("chatbase/identity-token");
        if (data?.token) {
          window.chatbase?.("identify", { token: data.token });
          identified = true;
        }
      } catch {
        failedIdentityCalls += 1;
        // keep widget available even when identity endpoint is not ready
      }
    };

    const initChatbase = () => {
      ensureProxy();
      if (!document.getElementById(CHATBASE_BOT_ID)) {
        const script = document.createElement("script");
        script.src = "https://www.chatbase.co/embed.min.js";
        script.id = CHATBASE_BOT_ID;
        script.domain = "www.chatbase.co";
        script.onload = identifyUser;
        document.body.appendChild(script);
      } else {
        identifyUser();
      }
    };

    initChatbase();
    const intervalId = window.setInterval(() => {
      identifyUser();
    }, 4000);
    const onFocus = () => {
      failedIdentityCalls = 0;
      identifyUser();
    };
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const theme = useMemo(
    () =>
      createTheme({
        direction: "rtl",
        spacing: uiSettings.density === "compact" ? 7 : 8,
        palette: {
          mode,
          primary: brandPaletteForMode(uiSettings.primaryColor, mode),
          secondary: brandPaletteForMode(uiSettings.secondaryColor, mode),
          error: {
            main: mode === "dark" ? "#f2b8b5" : "#ba1a1a",
            light: mode === "dark" ? "#ffdad6" : "#ffdad6",
            dark: mode === "dark" ? "#601410" : "#93000a",
            contrastText: mode === "dark" ? "#601410" : "#ffffff",
          },
          success: {
            main: mode === "dark" ? "#84cdb0" : "#1b6b4f",
            contrastText: mode === "dark" ? "#0a1f16" : "#ffffff",
          },
          warning: {
            main: mode === "dark" ? "#f5d088" : "#7c5e10",
            contrastText: mode === "dark" ? "#221a05" : "#ffffff",
          },
          info: {
            main: mode === "dark" ? "#8ec9ff" : "#1565c0",
            contrastText: mode === "dark" ? "#051320" : "#ffffff",
          },
          text:
            mode === "dark"
              ? { primary: "#eef4f5", secondary: "#b9c9cc", disabled: "rgba(255,255,255,0.38)" }
              : { primary: "#191c1c", secondary: "#3f4949" },
          divider: mode === "dark" ? "rgba(255,255,255,0.14)" : "#d8dada",
          background:
            mode === "dark"
              ? { default: "#0f1416", paper: "#1a2124" }
              : { default: "#f8faf9", paper: "#ffffff" },
          action:
            mode === "dark"
              ? {
                  active: "rgba(255,255,255,0.78)",
                  hover: "rgba(255,255,255,0.08)",
                  selected: "rgba(255,255,255,0.12)",
                  disabled: "rgba(255,255,255,0.32)",
                  disabledBackground: "rgba(255,255,255,0.08)",
                }
              : {},
        },
        shape: { borderRadius: Number(uiSettings.borderRadius) || 10 },
        typography: { fontFamily: fontFamilyMap[uiSettings.fontFamily] || fontFamilyMap.playpen },
        components: {
          MuiCssBaseline: {
            styleOverrides: {
              body: {
                ...(mode === "dark"
                  ? {
                      colorScheme: "dark",
                    }
                  : { colorScheme: "light" }),
              },
            },
          },
          MuiTableContainer: {
            styleOverrides: {
              root: {
                maxWidth: "100%",
                overflowX: "auto",
              },
            },
          },
          MuiDialog: {
            styleOverrides: {
              paper: ({ theme: t }) => ({
                [t.breakpoints.down("sm")]: {
                  margin: t.spacing(1),
                  width: `calc(100% - ${t.spacing(2)})`,
                  maxHeight: `calc(100% - ${t.spacing(2)})`,
                },
              }),
            },
          },
          MuiIconButton: {
            styleOverrides: {
              root: ({ theme: t, ownerState }) => {
                if (t.palette.mode !== "dark") return {};
                const c = ownerState.color;
                if (c === "primary" || c === "secondary" || c === "error" || c === "info" || c === "success" || c === "warning") {
                  return {};
                }
                return {
                  color: t.palette.action.active,
                  "&:hover": { bgcolor: alpha(t.palette.primary.main, 0.12) },
                };
              },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: ({ theme: t }) => ({
                transition: "all 180ms ease",
                "&.Mui-disabled": {
                  opacity: 0.72,
                  filter: "grayscale(0.08)",
                  boxShadow: "none",
                  backgroundColor:
                    t.palette.mode === "dark" ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
                },
              }),
              outlinedPrimary: ({ theme: t }) =>
                t.palette.mode === "dark"
                  ? {
                      borderColor: alpha(t.palette.primary.main, 0.5),
                      color: t.palette.primary.light,
                      "&:hover": {
                        borderColor: alpha(t.palette.primary.main, 0.72),
                        bgcolor: alpha(t.palette.primary.main, 0.1),
                      },
                    }
                  : {},
              outlinedSecondary: ({ theme: t }) =>
                t.palette.mode === "dark"
                  ? {
                      borderColor: alpha(t.palette.secondary.main, 0.5),
                      color: t.palette.secondary.light,
                      "&:hover": {
                        borderColor: alpha(t.palette.secondary.main, 0.72),
                        bgcolor: alpha(t.palette.secondary.main, 0.1),
                      },
                    }
                  : {},
              outlinedError: ({ theme: t }) =>
                t.palette.mode === "dark"
                  ? {
                      borderColor: alpha(t.palette.error.main, 0.55),
                      color: t.palette.error.light,
                    }
                  : {},
            },
          },
          MuiToggleButton: {
            styleOverrides: {
              root: ({ theme: t }) =>
                t.palette.mode === "dark"
                  ? {
                      color: t.palette.text.secondary,
                      borderColor: alpha(t.palette.divider, 0.9),
                      "&.Mui-selected": {
                        color: t.palette.primary.light,
                        bgcolor: alpha(t.palette.primary.main, 0.18),
                        borderColor: alpha(t.palette.primary.main, 0.45),
                      },
                    }
                  : {},
            },
          },
          MuiChip: {
            styleOverrides: {
              outlined: ({ theme: t, ownerState }) => {
                if (t.palette.mode !== "dark") return {};
                if (ownerState.color && ownerState.color !== "default") return {};
                return {
                  borderColor: alpha(t.palette.text.primary, 0.32),
                  color: t.palette.text.primary,
                };
              },
            },
          },
        },
      }),
    [mode, uiSettings],
  );

  const toggleMode = () => {
    const next = mode === "dark" ? "light" : "dark";
    setMode(next);
    localStorage.setItem("themeMode", next);
  };

  const setThemeMode = (next) => {
    if (next !== "light" && next !== "dark") return;
    setMode(next);
    localStorage.setItem("themeMode", next);
  };

  const updateUiSettings = (nextSettings) => {
    setUiSettings(nextSettings);
    localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(nextSettings));
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <SiteSeo />
        <Routes>
          <Route
            path="/login"
            element={
              TEMP_BYPASS_AUTH_TO_ADMIN ? (
                <Navigate to="/admin" replace />
              ) : isAuthenticated() ? (
                <Navigate to={isAdminPanelRole(getStoredUser()?.role) ? "/admin" : "/cashier"} replace />
              ) : (
                <Login />
              )
            }
          />
          <Route path="/register" element={<Navigate to="/login" replace />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "super_admin"]}>
                <HomeDashboard mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/inventory"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "super_admin", "super_cashier"]}>
                <InventoryPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/categories"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "super_admin", "super_cashier"]}>
                <CategoriesPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/stocktake"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "super_admin"]}>
                <StocktakePage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/debt-customers"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "super_admin", "super_cashier"]}>
                <DebtCustomersPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/invoices"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "super_admin"]}>
                <InvoicesPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/returns"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "super_admin"]}>
                <ReturnsPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/returns/sales"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "super_admin"]}>
                <ReturnsPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/returns/purchases"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "super_admin", "super_cashier"]}>
                <ReturnsPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "super_admin"]}>
                <ReportsPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/reports/sales"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "super_admin"]}>
                <ReportsPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/reports/purchases"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "super_admin"]}>
                <ReportsPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/purchases"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "super_admin", "super_cashier"]}>
                <PurchasesPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/staff"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "super_admin"]}>
                <StaffPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/activity-log"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "super_admin"]}>
                <ActivityLogPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/notifications"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "super_admin", "cashier"]}>
                <NotificationsPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "super_admin"]}>
                <Navigate to="/admin/settings/account" replace />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/settings/account"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "super_admin"]}>
                <SettingsPage
                  mode={mode}
                  onToggleMode={toggleMode}
                  onThemeModeChange={setThemeMode}
                  uiSettings={uiSettings}
                  onUiSettingsChange={updateUiSettings}
                  defaultUiSettings={defaultUiSettings}
                />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/settings/appearance"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "super_admin"]}>
                <SettingsPage
                  mode={mode}
                  onToggleMode={toggleMode}
                  onThemeModeChange={setThemeMode}
                  uiSettings={uiSettings}
                  onUiSettingsChange={updateUiSettings}
                  defaultUiSettings={defaultUiSettings}
                />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/settings/money"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "super_admin"]}>
                <SettingsPage
                  mode={mode}
                  onToggleMode={toggleMode}
                  onThemeModeChange={setThemeMode}
                  uiSettings={uiSettings}
                  onUiSettingsChange={updateUiSettings}
                  defaultUiSettings={defaultUiSettings}
                />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/settings/notifications"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "super_admin"]}>
                <SettingsPage
                  mode={mode}
                  onToggleMode={toggleMode}
                  onThemeModeChange={setThemeMode}
                  uiSettings={uiSettings}
                  onUiSettingsChange={updateUiSettings}
                  defaultUiSettings={defaultUiSettings}
                />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/settings/cashier"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "super_admin"]}>
                <SettingsPage
                  mode={mode}
                  onToggleMode={toggleMode}
                  onThemeModeChange={setThemeMode}
                  uiSettings={uiSettings}
                  onUiSettingsChange={updateUiSettings}
                  defaultUiSettings={defaultUiSettings}
                />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/ai-assistant"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "super_admin"]}>
                <AIAssistantPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/cashier"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "super_admin", "cashier", "super_cashier"]}>
                <CashierPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/cashier/dashboard"
            element={
              <ProtectedRoleRoute allowRoles={["super_cashier"]}>
                <SuperCashierDashboardPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/cashier/supply"
            element={
              <ProtectedRoleRoute allowRoles={["super_cashier"]}>
                <Navigate to="/cashier/dashboard" replace />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/cashier/notifications"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "super_admin", "cashier", "super_cashier"]}>
                <CashierNotificationsPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/cashier/settings"
            element={
              <ProtectedRoleRoute allowRoles={["cashier", "super_cashier"]}>
                <Navigate to="/cashier/settings/account" replace />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/cashier/settings/account"
            element={
              <ProtectedRoleRoute allowRoles={["cashier", "super_cashier"]}>
                <SettingsPage
                  mode={mode}
                  onToggleMode={toggleMode}
                  onThemeModeChange={setThemeMode}
                  uiSettings={uiSettings}
                  onUiSettingsChange={updateUiSettings}
                  defaultUiSettings={defaultUiSettings}
                />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/cashier/settings/appearance"
            element={
              <ProtectedRoleRoute allowRoles={["cashier", "super_cashier"]}>
                <SettingsPage
                  mode={mode}
                  onToggleMode={toggleMode}
                  onThemeModeChange={setThemeMode}
                  uiSettings={uiSettings}
                  onUiSettingsChange={updateUiSettings}
                  defaultUiSettings={defaultUiSettings}
                />
              </ProtectedRoleRoute>
            }
          />
          <Route path="/" element={<RootRedirect />} />
          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
