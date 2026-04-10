import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Cookies from "universal-cookie";
import axios from "axios";
import Login from "./pages/Auth/Login";
import Register from "./pages/Auth/Register";
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
import SuperCashierSupplyPage from "./pages/SuperCashierSupplyPage";
import { baseURL } from "./Api/Api";

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

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
}

function isAuthenticated() {
  const user = getStoredUser();
  const token = cookies.get("token");
  return Boolean(user?.role && token);
}

function ProtectedRoleRoute({ allowRoles, children }) {
  const user = getStoredUser();
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  if (!allowRoles.includes(user.role)) {
    if (user.role === "admin") return <Navigate to="/admin" replace />;
    if (user.role === "super_cashier") return <Navigate to="/cashier" replace />;
    return <Navigate to="/cashier" replace />;
  }
  return children;
}

function RootRedirect() {
  if (!isAuthenticated()) return <Navigate to="/login" replace />;
  const user = getStoredUser();
  if (user?.role === "admin") return <Navigate to="/admin" replace />;
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
        const { data } = await axios.get(`${baseURL}chatbase/identity-token`, {
          headers: { Authorization: `Bearer ${token}` },
        });
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
          primary: { main: uiSettings.primaryColor, contrastText: "#ffffff" },
          secondary: { main: uiSettings.secondaryColor, contrastText: "#ffffff" },
          error: { main: "#ba1a1a" },
          text:
            mode === "dark"
              ? { primary: "#eff1f0", secondary: "#bec8c9" }
              : { primary: "#191c1c", secondary: "#3f4949" },
          divider: mode === "dark" ? "#3f4949" : "#d8dada",
          background:
            mode === "dark"
              ? { default: "#121616", paper: "#1f2526" }
              : { default: "#f8faf9", paper: "#ffffff" },
        },
        shape: { borderRadius: Number(uiSettings.borderRadius) || 10 },
        typography: { fontFamily: fontFamilyMap[uiSettings.fontFamily] || fontFamilyMap.playpen },
        components: {
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
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoleRoute allowRoles={["admin"]}>
                <HomeDashboard mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/inventory"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "super_cashier"]}>
                <InventoryPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/categories"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "super_cashier"]}>
                <CategoriesPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/stocktake"
            element={
              <ProtectedRoleRoute allowRoles={["admin"]}>
                <StocktakePage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/debt-customers"
            element={
              <ProtectedRoleRoute allowRoles={["admin"]}>
                <DebtCustomersPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/invoices"
            element={
              <ProtectedRoleRoute allowRoles={["admin"]}>
                <InvoicesPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/returns"
            element={
              <ProtectedRoleRoute allowRoles={["admin"]}>
                <ReturnsPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/returns/sales"
            element={
              <ProtectedRoleRoute allowRoles={["admin"]}>
                <ReturnsPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/returns/purchases"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "super_cashier"]}>
                <ReturnsPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <ProtectedRoleRoute allowRoles={["admin"]}>
                <ReportsPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/reports/sales"
            element={
              <ProtectedRoleRoute allowRoles={["admin"]}>
                <ReportsPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/reports/purchases"
            element={
              <ProtectedRoleRoute allowRoles={["admin"]}>
                <ReportsPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/purchases"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "super_cashier"]}>
                <PurchasesPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/staff"
            element={
              <ProtectedRoleRoute allowRoles={["admin"]}>
                <StaffPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/activity-log"
            element={
              <ProtectedRoleRoute allowRoles={["admin"]}>
                <ActivityLogPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/notifications"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "cashier"]}>
                <NotificationsPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoleRoute allowRoles={["admin"]}>
                <Navigate to="/admin/settings/account" replace />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/admin/settings/account"
            element={
              <ProtectedRoleRoute allowRoles={["admin"]}>
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
              <ProtectedRoleRoute allowRoles={["admin"]}>
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
              <ProtectedRoleRoute allowRoles={["admin"]}>
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
              <ProtectedRoleRoute allowRoles={["admin"]}>
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
              <ProtectedRoleRoute allowRoles={["admin"]}>
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
              <ProtectedRoleRoute allowRoles={["admin"]}>
                <AIAssistantPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/cashier"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "cashier", "super_cashier"]}>
                <CashierPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/cashier/supply"
            element={
              <ProtectedRoleRoute allowRoles={["super_cashier"]}>
                <SuperCashierSupplyPage mode={mode} onToggleMode={toggleMode} />
              </ProtectedRoleRoute>
            }
          />
          <Route
            path="/cashier/notifications"
            element={
              <ProtectedRoleRoute allowRoles={["admin", "cashier", "super_cashier"]}>
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
