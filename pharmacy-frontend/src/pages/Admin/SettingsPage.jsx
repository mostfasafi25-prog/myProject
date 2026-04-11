import {
  AccountBalanceWallet,
  AddCircleOutline,
  AdminPanelSettings,
  AppShortcut,
  ArrowBack,
  AutoAwesome,
  AttachMoney,
  Campaign,
  ColorLens,
  DarkMode,
  FilterList,
  DeleteForever,
  FontDownload,
  Gavel,
  History,
  Inventory2,
  LightMode,
  Lock,
  NotificationsActive,
  Payments,
  PhotoCamera,
  PointOfSale,
  ReceiptLong,
  Replay,
  ShoppingCart,
  SyncDisabled,
  WarningAmber,
  RemoveCircleOutline,
  RestartAlt,
  Save,
  Smartphone,
  Tune,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";
import {
  Alert,
  alpha,
  Avatar,
  Box,
  Button,
  Card,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Axios } from "../../Api/Axios";
import { persistSessionUser, persistUserAvatarForLogin } from "../../utils/staffProfileExtras";
import { compressImageFileForUpload } from "../../utils/imageCompress";
import { PHARMACY_USER_STORAGE_EVENT } from "../../utils/userRoles";
import { adminPageContainerSx } from "../../utils/adminPageLayout";
import AdminLayout from "./AdminLayout";
import {
  CASHIER_PREF_DEFAULTS,
  getAdminPrefs,
  getCashierPrefs,
  setAdminPrefs,
  setCashierPrefs,
} from "../../utils/notificationPrefs";
import { appendAudit } from "../../utils/auditLog";
import { confirmApp, showAppToast } from "../../utils/appToast";
import {
  applySystemDangerResets,
  CONFIRM_DANGER_PHRASE,
  DANGER_TRIM_KEEP,
  dangerPhraseUnlocked,
} from "../../utils/systemDangerReset";
import {
  evictAllLocalStorageExceptSessionAndOfflineQueue,
  evictHeavyCachesBeforeLogin,
  evictLocalBusinessCachesSecondPass,
} from "../../utils/localStorageEviction";
import { THEME_PRESETS } from "../../utils/themePresets";
import { chipColorForBalance, negativeAmountTextSx } from "../../utils/negativeAmountStyle";
import { notifyStoreBalanceChanged } from "../../utils/storeBalanceSync";
import {
  getCashierSystemSettings,
  setCashierSystemSettings,
} from "../../utils/cashierSystemSettings";
const STORE_BALANCE_KEY = "storeBalance";
const MAX_AVATAR_FILE_BYTES = 2 * 1024 * 1024;
const NOTIFICATIONS_KEY = "systemNotifications";

const fonts = [
  { value: "playpen", label: "Playpen Sans Arabic" },
  { value: "cairo", label: "Cairo" },
  { value: "tajawal", label: "Tajawal" },
  { value: "inter", label: "Inter" },
];

export default function SettingsPage({
  mode,
  onToggleMode,
  onThemeModeChange = () => {},
  uiSettings,
  onUiSettingsChange,
  defaultUiSettings,
}) {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(uiSettings);
  const [savedMsg, setSavedMsg] = useState("");
  const [accountMsg, setAccountMsg] = useState({ type: "", text: "" });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [showCurrentPwd, setShowCurrentPwd] = useState(false);
  const [showNewPwd, setShowNewPwd] = useState(false);
  const [showConfirmPwd, setShowConfirmPwd] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmNewPassword: "",
  });
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch {
      return null;
    }
  }, []);
  /** تصفير الخزنة / النظام الكامل — للحساب الأساسي admin فقط */
  const isSuperAdminMoneyControls =
    (currentUser?.role === "admin" || currentUser?.role === "super_admin") &&
    String(currentUser?.username || "").toLowerCase() === "admin";
  const canManageBrowserStorage =
    currentUser?.role === "admin" || currentUser?.role === "super_admin";
  const isAccountSettings = location.pathname.includes("/settings/account");
  const isAppearanceSettings = location.pathname.includes("/settings/appearance");
  const isMoneySettings = location.pathname.includes("/settings/money");
  const isNotificationSettings = location.pathname.includes("/settings/notifications");
  const isCashierSystemSettings =
    location.pathname.includes("/settings/cashier") && !location.pathname.startsWith("/cashier/settings");
  const cashierSettings = location.pathname.startsWith("/cashier/settings");
  const [moneyAmount, setMoneyAmount] = useState("");
  const [moneyMethod, setMoneyMethod] = useState("cash");
  const [moneyWithdrawAmount, setMoneyWithdrawAmount] = useState("");
  const [moneyWithdrawMethod, setMoneyWithdrawMethod] = useState("cash");
  const [moneyMsg, setMoneyMsg] = useState({ type: "", text: "" });
  const emptyResetSelection = () => ({
    treasury: false,
    sales: false,
    trimSales: false,
    purchases: false,
    trimPurchases: false,
    catalog: false,
    shiftLog: false,
    auditLog: false,
    returns: false,
    trimReturns: false,
    notifications: false,
    stocktake: false,
    offlinePending: false,
    cartDrafts: false,
    debtCustomers: false,
    staffProfileExtras: false,
  });
  const [resetSelection, setResetSelection] = useState(emptyResetSelection);
  const [dangerPhrase, setDangerPhrase] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [storeBalance, setStoreBalance] = useState({ total: 0, cash: 0, app: 0 });
  const [notifyForm, setNotifyForm] = useState({
    title: "",
    message: "",
    sendToAll: true,
    recipients: [],
  });
  const [notifyMsg, setNotifyMsg] = useState({ type: "", text: "" });
  const [adminNotifyPrefs, setAdminNotifyPrefs] = useState(() => getAdminPrefs());
  const [cashierNotifyTarget, setCashierNotifyTarget] = useState("");
  const [cashierNotifyPrefs, setCashierNotifyPrefs] = useState(() => ({ ...CASHIER_PREF_DEFAULTS }));
  const [cashierSysDraft, setCashierSysDraft] = useState(() => getCashierSystemSettings());
  const avatarInputRef = useRef(null);
  const [avatarPreview, setAvatarPreview] = useState(() => {
    try {
      const u = JSON.parse(localStorage.getItem("user"));
      return u?.avatarDataUrl || u?.avatar || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    setDraft(uiSettings);
  }, [uiSettings]);
  useEffect(() => {
    if (!isNotificationSettings) return;
    setAdminNotifyPrefs(getAdminPrefs());
  }, [isNotificationSettings]);

  useEffect(() => {
    if (!cashierNotifyTarget) {
      setCashierNotifyPrefs({ ...CASHIER_PREF_DEFAULTS });
      return;
    }
    setCashierNotifyPrefs(getCashierPrefs(cashierNotifyTarget));
  }, [cashierNotifyTarget, isNotificationSettings]);

  useEffect(() => {
    const on = () => {
      setAdminNotifyPrefs(getAdminPrefs());
      if (cashierNotifyTarget) setCashierNotifyPrefs(getCashierPrefs(cashierNotifyTarget));
    };
    window.addEventListener("pharmacy-notification-prefs-changed", on);
    return () => window.removeEventListener("pharmacy-notification-prefs-changed", on);
  }, [cashierNotifyTarget]);

  useEffect(() => {
    if (!cashierSettings) return;
    if (isMoneySettings || isNotificationSettings) {
      navigate("/cashier/settings/account", { replace: true });
    }
  }, [cashierSettings, isMoneySettings, isNotificationSettings, navigate]);

  useEffect(() => {
    if (!isCashierSystemSettings) return;
    setCashierSysDraft(getCashierSystemSettings());
  }, [isCashierSystemSettings, location.pathname]);

  useEffect(() => {
    if (!isMoneySettings) return;
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_BALANCE_KEY));
      if (raw && typeof raw === "object") {
        setStoreBalance({
          total: Number(raw.total || 0),
          cash: Number(raw.cash || 0),
          app: Number(raw.app || 0),
        });
        return;
      }
    } catch {
      // ignore malformed value
    }
    setStoreBalance({ total: 0, cash: 0, app: 0 });
  }, [isMoneySettings]);

  const hasChanges = useMemo(() => JSON.stringify(draft) !== JSON.stringify(uiSettings), [draft, uiSettings]);

  const handleSave = () => {
    onUiSettingsChange(draft);
    setSavedMsg("تم حفظ الإعدادات بنجاح");
    setTimeout(() => setSavedMsg(""), 1600);
  };

  const saveCashierSysSettings = () => {
    setCashierSystemSettings(cashierSysDraft);
    setSavedMsg("تم حفظ إعدادات الكاشير بنجاح");
    setTimeout(() => setSavedMsg(""), 1800);
  };

  const handleReset = () => {
    setDraft(defaultUiSettings);
    onUiSettingsChange(defaultUiSettings);
    setSavedMsg("تمت إعادة الضبط الافتراضي");
    setTimeout(() => setSavedMsg(""), 1600);
  };

  const handleChangePassword = async () => {
    setAccountMsg({ type: "", text: "" });
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmNewPassword) {
      setAccountMsg({ type: "error", text: "يرجى تعبئة جميع حقول كلمة المرور" });
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setAccountMsg({ type: "error", text: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل" });
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      setAccountMsg({ type: "error", text: "تأكيد كلمة المرور غير مطابق" });
      return;
    }

    try {
      setPwdLoading(true);
      await Axios.post("change-password", {
        current_password: passwordForm.currentPassword,
        new_password: passwordForm.newPassword,
      });
      setAccountMsg({ type: "success", text: "تم تحديث كلمة المرور بنجاح" });
      setPasswordForm({ currentPassword: "", newPassword: "", confirmNewPassword: "" });
    } catch (err) {
      setAccountMsg({ type: "error", text: err?.response?.data?.error || "فشل تحديث كلمة المرور" });
    } finally {
      setPwdLoading(false);
    }
  };
  const handleMoneyDeposit = () => {
    setMoneyMsg({ type: "", text: "" });
    const amount = Number(moneyAmount);
    if (!amount || amount <= 0) {
      setMoneyMsg({ type: "error", text: "أدخل مبلغ صحيح أكبر من صفر" });
      return;
    }
    const next = {
      total: storeBalance.total + amount,
      cash: moneyMethod === "cash" ? storeBalance.cash + amount : storeBalance.cash,
      app: moneyMethod === "app" ? storeBalance.app + amount : storeBalance.app,
      lastOperation: "deposit",
      lastDepositMethod: moneyMethod,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORE_BALANCE_KEY, JSON.stringify(next));
    notifyStoreBalanceChanged();
    setStoreBalance(next);
    setMoneyAmount("");
    setMoneyMsg({ type: "success", text: "تم تزويد الخزنة بنجاح" });
    appendAudit({
      action: "treasury_deposit",
      details: JSON.stringify({ amount, method: moneyMethod }),
      username: currentUser?.username || "",
      role: currentUser?.role || "",
    });
  };

  const handleMoneyWithdraw = async () => {
    setMoneyMsg({ type: "", text: "" });
    const amount = Number(moneyWithdrawAmount);
    if (!amount || amount <= 0) {
      setMoneyMsg({ type: "error", text: "أدخل مبلغ صحيح أكبر من صفر" });
      return;
    }
    const available = moneyWithdrawMethod === "cash" ? storeBalance.cash : storeBalance.app;
    if (available <= 0) {
      setMoneyMsg({
        type: "error",
        text: moneyWithdrawMethod === "cash" ? "لا يوجد رصيد في الكاش" : "لا يوجد رصيد في التطبيق",
      });
      return;
    }
    const take = Math.min(amount, available);
    const ok = await confirmApp({
      title: "خصم من الخزنة",
      message: `سيتم خصم ${take.toFixed(2)} شيكل من ${moneyWithdrawMethod === "cash" ? "رصيد الكاش" : "رصيد التطبيق"} (المطلوب: ${amount.toFixed(2)} شيكل، المتاح: ${available.toFixed(2)} شيكل).`,
      confirmText: "تنفيذ الخصم",
    });
    if (!ok) return;
    const next = {
      total: Math.max(0, storeBalance.total - take),
      cash:
        moneyWithdrawMethod === "cash" ? Math.max(0, storeBalance.cash - take) : storeBalance.cash,
      app: moneyWithdrawMethod === "app" ? Math.max(0, storeBalance.app - take) : storeBalance.app,
      lastOperation: "withdraw",
      lastWithdrawMethod: moneyWithdrawMethod,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORE_BALANCE_KEY, JSON.stringify(next));
    notifyStoreBalanceChanged();
    setStoreBalance(next);
    setMoneyWithdrawAmount("");
    setMoneyMsg({ type: "success", text: "تم خصم المبلغ بنجاح" });
    appendAudit({
      action: "treasury_withdraw",
      details: JSON.stringify({ amount: take, method: moneyWithdrawMethod }),
      username: currentUser?.username || "",
      role: currentUser?.role || "",
    });
  };

  const anyResetSelected = useMemo(
    () => Object.values(resetSelection).some(Boolean),
    [resetSelection],
  );
  const phraseOk = dangerPhraseUnlocked(dangerPhrase);

  const handleDangerZoneExecute = async () => {
    setMoneyMsg({ type: "", text: "" });
    if (!phraseOk || !anyResetSelected) {
      showAppToast("حدد خياراً واحداً على الأقل واكتب جملة التأكيد بالضبط", "error");
      return;
    }
    const ok = await confirmApp({
      title: "تنفيذ تصفير البيانات",
      message: `سيتم تنفيذ العمليات المحددة ولا يمكن التراجع. هل أنت متأكد؟`,
      confirmText: "تنفيذ نهائي",
    });
    if (!ok) return;
    setResetBusy(true);
    try {
      const done = applySystemDangerResets(resetSelection, {
        username: currentUser?.username || "",
        role: currentUser?.role || "",
      });
      if (resetSelection.treasury) {
        setStoreBalance({ total: 0, cash: 0, app: 0 });
      }
      setResetSelection(emptyResetSelection());
      setDangerPhrase("");
      setMoneyMsg({
        type: "success",
        text: done.length ? `تم: ${done.join(" — ")}` : "لم يُنفَّذ شيء",
      });
      showAppToast("اكتمل التصفير. يُفضّل تحديث الصفحات المفتوحة (كاشير / مخزون).", "success");
    } finally {
      setResetBusy(false);
    }
  };

  const applyThemePreset = (preset, nextMode) => {
    const patch = nextMode === "dark" ? preset.dark : preset.light;
    onUiSettingsChange({
      ...uiSettings,
      primaryColor: patch.primaryColor,
      secondaryColor: patch.secondaryColor,
      borderRadius: patch.borderRadius ?? uiSettings.borderRadius,
    });
    onThemeModeChange(nextMode);
  };
  const normalizeOneDecimal = (value) => {
    const cleaned = String(value ?? "").replace(/[^\d.]/g, "");
    const num = Number(cleaned);
    if (Number.isNaN(num)) return "";
    return (Math.round(num * 10) / 10).toString();
  };
  const selectableUsers = useMemo(() => {
    const defaults = ["admin", "cashier", "cashier2", "admin2"];
    const current = currentUser?.username ? [currentUser.username] : [];
    const fromInvoices = (() => {
      try {
        const sales = JSON.parse(localStorage.getItem("salesInvoices"));
        const purchases = JSON.parse(localStorage.getItem("purchaseInvoices"));
        const names = [
          ...(Array.isArray(sales) ? sales.map((s) => s.soldBy) : []),
          ...(Array.isArray(purchases) ? purchases.map((p) => p.purchasedBy) : []),
        ].filter(Boolean);
        return names;
      } catch {
        return [];
      }
    })();
    return [...new Set([...defaults, ...current, ...fromInvoices])];
  }, [currentUser?.username]);
  const handleSendManualNotification = () => {
    setNotifyMsg({ type: "", text: "" });
    if (!notifyForm.title.trim() || !notifyForm.message.trim()) {
      setNotifyMsg({ type: "error", text: "يرجى إدخال عنوان ووصف الإشعار" });
      return;
    }
    if (!notifyForm.sendToAll && notifyForm.recipients.length === 0) {
      setNotifyMsg({ type: "error", text: "اختر مستخدمًا واحدًا على الأقل" });
      return;
    }
    const notification = {
      id: `NTF-${Date.now()}`,
      type: "manual",
      prefCategory: "management_manual",
      title: notifyForm.title.trim(),
      message: notifyForm.message.trim(),
      details: `مرسل بواسطة: ${currentUser?.username || "admin"}`,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.username || "admin",
      recipients: notifyForm.sendToAll ? "all" : notifyForm.recipients,
      readBy: [],
      deletedBy: [],
    };
    try {
      const existing = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY));
      const next = Array.isArray(existing) ? [notification, ...existing] : [notification];
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(next));
    } catch {
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify([notification]));
    }
    setNotifyForm({ title: "", message: "", sendToAll: true, recipients: [] });
    setNotifyMsg({ type: "success", text: "تم إرسال الإشعار بنجاح" });
  };

  const persistUserAvatar = (avatarDataUrl) => {
    try {
      const raw = localStorage.getItem("user");
      const u = raw ? JSON.parse(raw) : {};
      const uname = typeof u.username === "string" ? u.username : "";
      if (uname) persistUserAvatarForLogin(uname, avatarDataUrl || null);
      const next = { ...u };
      delete next.avatarDataUrl;
      delete next.avatar;
      const saved = persistSessionUser(next);
      if (!saved.ok) {
        setAccountMsg({ type: "error", text: "تعذر حفظ الجلسة — الذاكرة المحلية ممتلئة. امسح بيانات الموقع أو قلّل حجم الصور." });
        return;
      }
      setAvatarPreview(avatarDataUrl || null);
      window.dispatchEvent(new Event(PHARMACY_USER_STORAGE_EVENT));
    } catch {
      setAccountMsg({ type: "error", text: "تعذر حفظ الصورة" });
    }
  };

  const handleAvatarFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setAccountMsg({ type: "", text: "" });
    if (!file.type.startsWith("image/")) {
      setAccountMsg({ type: "error", text: "يرجى اختيار ملف صورة (PNG أو JPG وغيرها)" });
      return;
    }
    if (file.size > MAX_AVATAR_FILE_BYTES) {
      setAccountMsg({ type: "error", text: "حجم الصورة كبير جدًا — الحد الأقصى 2 ميجابايت" });
      return;
    }
    try {
      const dataUrl = await compressImageFileForUpload(file);
      persistUserAvatar(dataUrl);
      setAccountMsg({ type: "success", text: "تم حفظ صورة الملف الشخصي" });
    } catch {
      setAccountMsg({ type: "error", text: "تعذر ضغط الصورة. جرّب صورة أصغر (JPG/PNG)." });
    }
  };

  const handleRemoveAvatar = () => {
    setAccountMsg({ type: "", text: "" });
    persistUserAvatar(null);
    setAccountMsg({ type: "success", text: "تمت إزالة صورة الملف الشخصي" });
  };

  const cashierTopBar = cashierSettings ? (
    <Paper
      elevation={0}
      square
      sx={{
        borderBottom: 1,
        borderColor: "divider",
        px: 2,
        py: 1.25,
        position: "sticky",
        top: 0,
        zIndex: 20,
        bgcolor: "background.paper",
      }}
    >
      <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
        <IconButton onClick={() => navigate("/cashier")} aria-label="العودة لصفحة البيع" size="small" title="العودة لصفحة البيع">
          <ArrowBack />
        </IconButton>
        <Typography fontWeight={900}>إعداداتي</Typography>
        <Button
          size="small"
          variant={isAccountSettings ? "contained" : "outlined"}
          onClick={() => navigate("/cashier/settings/account")}
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          حسابي
        </Button>
        <Button
          size="small"
          variant={isAppearanceSettings ? "contained" : "outlined"}
          onClick={() => navigate("/cashier/settings/appearance")}
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          مظهر الموقع
        </Button>
        <Box sx={{ flex: "1 1 8px" }} />
        <IconButton onClick={onToggleMode} color="primary" size="small" aria-label="تبديل الوضع">
          {mode === "dark" ? <LightMode /> : <DarkMode />}
        </IconButton>
      </Stack>
    </Paper>
  ) : null;

  return (
    <AdminLayout mode={mode} onToggleMode={onToggleMode} embeddedTopBar={cashierTopBar}>
      <Box sx={adminPageContainerSx}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2, gap: 1.5 }}>
          <Box>
            <Typography variant="h5" fontWeight={900}>
              {isAccountSettings
                ? "إعدادات الحساب"
                : isAppearanceSettings
                  ? "مظهر الموقع"
                  : isMoneySettings
                    ? "إعداد المال"
                    : isCashierSystemSettings
                      ? "إعدادات الكاشير"
                      : isNotificationSettings
                        ? "إعداد الإشعارات"
                        : "الإعدادات"}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {isAccountSettings
                ? "صورة الملف الشخصي، وتحديث كلمة المرور"
                : isAppearanceSettings
                  ? "تحكم كامل بالألوان والخطوط والهيكل العام للموقع"
                  : isMoneySettings
                    ? "إدارة المال العام للخزنة وتوزيعه بين كاش وتطبيق"
                    : isCashierSystemSettings
                      ? "ما يظهر للكاشيرين: خصم، آجل، تعليق، طباعة، وغيرها — يُحفظ على أجهزة المتصفح"
                      : isNotificationSettings
                        ? "تفعيل أنواع الإشعارات للمدير وللكاشيرين، ثم إرسال رسائل يدوية"
                        : ""}
            </Typography>
          </Box>
          {isAppearanceSettings ? (
            <Stack direction="row" sx={{ gap: 1 }}>
              <Button startIcon={<RestartAlt />} variant="outlined" onClick={handleReset} sx={{ textTransform: "none" }}>
                إعادة ضبط
              </Button>
              <Button
                startIcon={<Save />}
                variant="contained"
                onClick={handleSave}
                disabled={!hasChanges}
                sx={{ textTransform: "none", fontWeight: 800 }}
              >
                حفظ التغييرات
              </Button>
            </Stack>
          ) : null}
        </Stack>

        {(isAppearanceSettings || isCashierSystemSettings) && savedMsg ? (
          <Card sx={{ p: 1.2, mb: 2, borderRadius: 2, bgcolor: alpha(theme.palette.success.main, 0.12) }}>
            <Typography variant="body2" color="success.main" fontWeight={700}>
              {savedMsg}
            </Typography>
          </Card>
        ) : null}

        <Stack sx={{ gap: 2 }}>
          {isNotificationSettings ? (
          <>
          <Card sx={{ p: 2.2, borderRadius: 3, border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`, mb: 2 }}>
            <Typography fontWeight={900} sx={{ mb: 0.5 }}>
              ما يستقبله حساب المدير
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              ينطبق عند دخولك كمدير. الإشعارات الموجّهة للمدير فقط (بيع، دوام، دخول) تُصفّى هنا.
            </Typography>
            <Divider sx={{ mb: 1 }} />
            {[
              {
                key: "saleComplete",
                title: "إشعار عند كل بيع من الكاشير",
                hint: "ملخص: البائع، الصافي، طريقة الدفع، وبنود مختصرة",
              },
              {
                key: "userLogin",
                title: "عند تسجيل دخول أي مستخدم",
                hint: "كاشير أو مدير — يظهر في إشعارات المدير",
              },
              {
                key: "shiftEnd",
                title: "عند انتهاء دوام كاشير",
                hint: "ملخص الفواتير والمبالغ لنهاية الجلسة",
              },
              {
                key: "purchases",
                title: "توريدات ومشتريات المخزون",
                hint: "إضافة صنف، تزويد مخزون، فواتير الشراء",
              },
            ].map((row) => (
              <Stack
                key={row.key}
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                sx={{ gap: 2, py: 1.25, borderBottom: `1px solid ${theme.palette.divider}` }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={800}>{row.title}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {row.hint}
                  </Typography>
                </Box>
                <Switch
                  checked={Boolean(adminNotifyPrefs[row.key])}
                  onChange={() => {
                    const v = !adminNotifyPrefs[row.key];
                    setAdminNotifyPrefs((p) => ({ ...p, [row.key]: v }));
                    setAdminPrefs({ [row.key]: v });
                  }}
                  inputProps={{ "aria-label": row.title }}
                />
              </Stack>
            ))}
          </Card>

          <Card sx={{ p: 2.2, borderRadius: 3, border: `1px solid ${alpha(theme.palette.secondary.main, 0.22)}`, mb: 2 }}>
            <Typography fontWeight={900} sx={{ mb: 0.5 }}>
              ما يستقبله كل كاشير
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              اختر اسم المستخدم ثم فعّل ما يناسب عمله: كاشير يريد متابعة كل التوريدات، وآخر يكتفي برسائل الإدارة فقط.
            </Typography>
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>المستخدم</InputLabel>
              <Select
                label="المستخدم"
                value={cashierNotifyTarget}
                onChange={(e) => setCashierNotifyTarget(e.target.value)}
              >
                <MenuItem value="">
                  <em>— اختر كاشيراً —</em>
                </MenuItem>
                {selectableUsers.map((username) => (
                  <MenuItem key={username} value={username}>
                    {username}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            {cashierNotifyTarget ? (
              <>
                {[
                  {
                    key: "purchases",
                    title: "توريدات ومشتريات المخزون",
                    hint: "يُنصح بتفعيله للمسؤول عن استلام البضاعة",
                  },
                  {
                    key: "managementManual",
                    title: "رسائل الإدارة اليدوية",
                    hint: "ما يُرسل من «إرسال إشعار» أدناه عندما يشملك الإرسال",
                  },
                  {
                    key: "other",
                    title: "باقي الإشعارات العامة",
                    hint: "أي إشعار بدون تصنيف محدد يظهر للجميع",
                  },
                ].map((row) => (
                  <Stack
                    key={row.key}
                    direction="row"
                    alignItems="center"
                    justifyContent="space-between"
                    sx={{ gap: 2, py: 1.25, borderBottom: `1px solid ${theme.palette.divider}` }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography fontWeight={800}>{row.title}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {row.hint}
                      </Typography>
                    </Box>
                    <Switch
                      checked={Boolean(cashierNotifyPrefs[row.key])}
                      onChange={() => {
                        const v = !cashierNotifyPrefs[row.key];
                        setCashierNotifyPrefs((p) => ({ ...p, [row.key]: v }));
                        setCashierPrefs(cashierNotifyTarget, { [row.key]: v });
                      }}
                      inputProps={{ "aria-label": row.title }}
                    />
                  </Stack>
                ))}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                اختر مستخدماً لتعديل تفضيلاته.
              </Typography>
            )}
          </Card>

          <Card sx={{ p: 2.2, borderRadius: 3, border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}` }}>
            <Stack direction="row" alignItems="center" sx={{ gap: 1, mb: 1.4 }}>
              <Campaign color="primary" />
              <Typography fontWeight={900}>إرسال إشعار يدوي</Typography>
            </Stack>

            {notifyMsg.text ? (
              <Alert severity={notifyMsg.type === "success" ? "success" : "error"} sx={{ mb: 1.5 }}>
                {notifyMsg.text}
              </Alert>
            ) : null}

            <Stack sx={{ gap: 1.25 }}>
              <TextField
                label="العنوان الرئيسي"
                value={notifyForm.title}
                onChange={(e) => setNotifyForm((p) => ({ ...p, title: e.target.value }))}
                fullWidth
                inputProps={{ style: { textAlign: "right" } }}
              />
              <TextField
                label="الوصف / الشرح"
                value={notifyForm.message}
                onChange={(e) => setNotifyForm((p) => ({ ...p, message: e.target.value }))}
                multiline
                minRows={3}
                fullWidth
                inputProps={{ style: { textAlign: "right" } }}
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={notifyForm.sendToAll}
                    onChange={(e) => setNotifyForm((p) => ({ ...p, sendToAll: e.target.checked }))}
                  />
                }
                label="إرسال إلى جميع المستخدمين (بما فيهم حسابي)"
              />
              {!notifyForm.sendToAll ? (
                <FormControl fullWidth>
                  <InputLabel>اختر المستخدمين</InputLabel>
                  <Select
                    label="اختر المستخدمين"
                    multiple
                    value={notifyForm.recipients}
                    onChange={(e) => setNotifyForm((p) => ({ ...p, recipients: e.target.value }))}
                    renderValue={(selected) => selected.join("، ")}
                  >
                    {selectableUsers.map((username) => (
                      <MenuItem key={username} value={username}>
                        {username}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : null}
              <Button
                variant="contained"
                onClick={handleSendManualNotification}
                sx={{ textTransform: "none", fontWeight: 800, alignSelf: "flex-start" }}
              >
                إرسال الإشعار
              </Button>
            </Stack>
          </Card>
          </>
          ) : null}

          {isMoneySettings ? (
          <Stack sx={{ gap: 2 }}>
            <Card
              sx={{
                p: 2.2,
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
                background: `linear-gradient(145deg, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha(
                  theme.palette.secondary.main,
                  0.06,
                )})`,
                boxShadow: `0 12px 40px ${alpha(theme.palette.primary.main, 0.12)}`,
              }}
            >
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ gap: 1.2, flexWrap: "wrap", mb: 2 }}>
                <Stack direction="row" alignItems="center" sx={{ gap: 1.25 }}>
                  <Avatar
                    sx={{
                      bgcolor: alpha(theme.palette.success.main, 0.2),
                      color: "success.main",
                      width: 48,
                      height: 48,
                    }}
                  >
                    <AccountBalanceWallet />
                  </Avatar>
                  <Box>
                    <Typography fontWeight={900} variant="h6">
                      إعداد المال والخزنة
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      عرض الأرصدة، التزويد، الخصم، أو التصفير الكامل
                    </Typography>
                  </Box>
                </Stack>
                <Chip
                  label={`الإجمالي: ${storeBalance.total.toFixed(2)} شيكل`}
                  color={chipColorForBalance(storeBalance.total, "success")}
                  sx={{ fontWeight: 800, px: 0.5 }}
                />
              </Stack>

              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Card
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      height: "100%",
                      borderRadius: 2.5,
                      borderColor: alpha(theme.palette.success.main, 0.4),
                      background: `linear-gradient(160deg, ${alpha(theme.palette.success.main, 0.12)}, transparent)`,
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={700}>
                          الإجمالي
                        </Typography>
                        <Typography
                          variant="h6"
                          fontWeight={900}
                          sx={{ mt: 0.3, ...negativeAmountTextSx(storeBalance.total, { color: "success.main" }) }}
                        >
                          {storeBalance.total.toFixed(2)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          شيكل
                        </Typography>
                      </Box>
                      <Avatar sx={{ bgcolor: alpha(theme.palette.success.main, 0.2), color: "success.main", width: 40, height: 40 }}>
                        <Payments fontSize="small" />
                      </Avatar>
                    </Stack>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Card
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      height: "100%",
                      borderRadius: 2.5,
                      borderColor: alpha(theme.palette.primary.main, 0.35),
                      background: `linear-gradient(160deg, ${alpha(theme.palette.primary.main, 0.1)}, transparent)`,
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={700}>
                          الكاش
                        </Typography>
                        <Typography
                          variant="h6"
                          fontWeight={900}
                          sx={{ mt: 0.3, ...negativeAmountTextSx(storeBalance.cash, { color: "primary.main" }) }}
                        >
                          {storeBalance.cash.toFixed(2)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          شيكل
                        </Typography>
                      </Box>
                      <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.18), color: "primary.main", width: 40, height: 40 }}>
                        <AttachMoney fontSize="small" />
                      </Avatar>
                    </Stack>
                  </Card>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <Card
                    variant="outlined"
                    sx={{
                      p: 1.5,
                      height: "100%",
                      borderRadius: 2.5,
                      borderColor: alpha(theme.palette.secondary.main, 0.35),
                      background: `linear-gradient(160deg, ${alpha(theme.palette.secondary.main, 0.1)}, transparent)`,
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                      <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight={700}>
                          التطبيق
                        </Typography>
                        <Typography
                          variant="h6"
                          fontWeight={900}
                          sx={{ mt: 0.3, ...negativeAmountTextSx(storeBalance.app, { color: "secondary.main" }) }}
                        >
                          {storeBalance.app.toFixed(2)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          شيكل
                        </Typography>
                      </Box>
                      <Avatar sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.18), color: "secondary.main", width: 40, height: 40 }}>
                        <Smartphone fontSize="small" />
                      </Avatar>
                    </Stack>
                  </Card>
                </Grid>
              </Grid>
            </Card>

            {moneyMsg.text ? (
              <Alert severity={moneyMsg.type === "success" ? "success" : "error"}>{moneyMsg.text}</Alert>
            ) : null}

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card
                  sx={{
                    p: 2.2,
                    height: "100%",
                    borderRadius: 3,
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                  }}
                >
                  <Stack direction="row" alignItems="center" sx={{ gap: 1, mb: 1.5 }}>
                    <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.14), color: "primary.main", width: 40, height: 40 }}>
                      <AddCircleOutline />
                    </Avatar>
                    <Box>
                      <Typography fontWeight={900}>تزويد الخزنة</Typography>
                      <Typography variant="caption" color="text.secondary">
                        إضافة مبلغ إلى الكاش أو التطبيق
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack sx={{ gap: 1.25 }}>
                    <TextField
                      label="المبلغ المراد تزويده"
                      type="number"
                      value={moneyAmount}
                      onChange={(e) => setMoneyAmount(normalizeOneDecimal(e.target.value))}
                      fullWidth
                      placeholder="مثال: 250"
                      inputProps={{ style: { textAlign: "right" }, step: "0.1", min: "0" }}
                    />
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.8 }}>
                        طريقة التزويد
                      </Typography>
                      <ToggleButtonGroup
                        value={moneyMethod}
                        exclusive
                        onChange={(_, value) => value && setMoneyMethod(value)}
                        size="small"
                        sx={{
                          p: 0.4,
                          borderRadius: 2.5,
                          bgcolor: alpha(theme.palette.primary.main, 0.08),
                          "& .MuiToggleButton-root": { border: "none", borderRadius: 2, px: 2.2, fontWeight: 700 },
                          "& .Mui-selected": { bgcolor: alpha(theme.palette.primary.main, 0.22), color: "primary.main" },
                        }}
                      >
                        <ToggleButton value="cash" sx={{ textTransform: "none", px: 2 }}>
                          <Stack direction="row" alignItems="center" sx={{ gap: 0.6 }}>
                            <AttachMoney fontSize="small" />
                            <span>كاش</span>
                          </Stack>
                        </ToggleButton>
                        <ToggleButton value="app" sx={{ textTransform: "none", px: 2 }}>
                          <Stack direction="row" alignItems="center" sx={{ gap: 0.6 }}>
                            <AppShortcut fontSize="small" />
                            <span>تطبيق</span>
                          </Stack>
                        </ToggleButton>
                      </ToggleButtonGroup>
                    </Box>
                    <Button variant="contained" onClick={handleMoneyDeposit} sx={{ textTransform: "none", fontWeight: 900, alignSelf: "flex-start" }}>
                      تنفيذ التزويد
                    </Button>
                  </Stack>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card
                  sx={{
                    p: 2.2,
                    height: "100%",
                    borderRadius: 3,
                    border: `1px solid ${alpha(theme.palette.secondary.main, 0.28)}`,
                    bgcolor: alpha(theme.palette.secondary.main, 0.05),
                  }}
                >
                  <Stack direction="row" alignItems="center" sx={{ gap: 1, mb: 1.5 }}>
                    <Avatar sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.16), color: "secondary.main", width: 40, height: 40 }}>
                      <RemoveCircleOutline />
                    </Avatar>
                    <Box>
                      <Typography fontWeight={900}>خصم من الخزنة</Typography>
                      <Typography variant="caption" color="text.secondary">
                        سحب مبلغ من الكاش أو التطبيق (حتى حد الرصيد المتاح)
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack sx={{ gap: 1.25 }}>
                    <TextField
                      label="المبلغ المراد خصمه"
                      type="number"
                      value={moneyWithdrawAmount}
                      onChange={(e) => setMoneyWithdrawAmount(normalizeOneDecimal(e.target.value))}
                      fullWidth
                      placeholder="مثال: 100"
                      inputProps={{ style: { textAlign: "right" }, step: "0.1", min: "0" }}
                    />
                    <Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 0.8 }}>
                        مصدر الخصم
                      </Typography>
                      <ToggleButtonGroup
                        value={moneyWithdrawMethod}
                        exclusive
                        onChange={(_, value) => value && setMoneyWithdrawMethod(value)}
                        size="small"
                        sx={{
                          p: 0.4,
                          borderRadius: 2.5,
                          bgcolor: alpha(theme.palette.secondary.main, 0.08),
                          "& .MuiToggleButton-root": { border: "none", borderRadius: 2, px: 2.2, fontWeight: 700 },
                          "& .Mui-selected": { bgcolor: alpha(theme.palette.secondary.main, 0.22), color: "secondary.main" },
                        }}
                      >
                        <ToggleButton value="cash" sx={{ textTransform: "none", px: 2 }}>
                          <Stack direction="row" alignItems="center" sx={{ gap: 0.6 }}>
                            <AttachMoney fontSize="small" />
                            <span>كاش</span>
                          </Stack>
                        </ToggleButton>
                        <ToggleButton value="app" sx={{ textTransform: "none", px: 2 }}>
                          <Stack direction="row" alignItems="center" sx={{ gap: 0.6 }}>
                            <Smartphone fontSize="small" />
                            <span>تطبيق</span>
                          </Stack>
                        </ToggleButton>
                      </ToggleButtonGroup>
                    </Box>
                    <Button
                      variant="contained"
                      color="secondary"
                      onClick={() => void handleMoneyWithdraw()}
                      sx={{ textTransform: "none", fontWeight: 900, alignSelf: "flex-start" }}
                    >
                      تنفيذ الخصم
                    </Button>
                  </Stack>
                </Card>
              </Grid>
              <Grid size={{ xs: 12 }}>
                {isSuperAdminMoneyControls ? (
                <Card
                  sx={{
                    p: { xs: 1.75, sm: 2.5 },
                    borderRadius: 3,
                    border: `2px solid ${alpha(theme.palette.error.main, 0.35)}`,
                    bgcolor: alpha(theme.palette.error.main, 0.04),
                    overflow: "hidden",
                  }}
                >
                  <Stack direction="row" alignItems="flex-start" sx={{ gap: 1.25, mb: 2 }}>
                    <Avatar sx={{ bgcolor: alpha(theme.palette.error.main, 0.15), color: "error.main", width: 44, height: 44 }}>
                      <WarningAmber />
                    </Avatar>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography fontWeight={900} color="error.dark">
                        منطقة خطرة — تصفير النظام والبيانات المحلية
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        اختر ما تريد مسحه أو إعادته. لا يؤثر على حسابات الموظفين على الخادم. للأمان: اكتب الجملة الإنجليزية بالأحرف
                        الكبيرة كما هي، ثم أكّد من النافذة المنبثقة.
                      </Typography>
                    </Box>
                  </Stack>

                  <Alert severity="warning" sx={{ mb: 2, textAlign: "right" }}>
                    «تصفير بالكامل» يحذف كل السجل. «تقليص» يحتفظ بأحدث {DANGER_TRIM_KEEP} سجلًا فقط (حسب التاريخ). إن اخترت التصفير والتقليص معًا يُنفَّذ التصفير فقط. إعادة
                    الأقسام والأصناف تستبدل المخزون بتجريبي جاهز لتجنّب كسر الكاشير.
                  </Alert>

                  <Typography variant="subtitle2" fontWeight={900} sx={{ mb: 1 }}>
                    أهم التصفيرات (اختر اختصاراً ثم راجع الخانات أو نفّذ مباشرة بعد جملة التأكيد)
                  </Typography>
                  <Grid container spacing={1.25} sx={{ mb: 2 }}>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <Button
                        fullWidth
                        variant="outlined"
                        color="error"
                        startIcon={<Payments />}
                        onClick={() => {
                          const base = emptyResetSelection();
                          setResetSelection({ ...base, treasury: true });
                        }}
                        sx={{ textTransform: "none", fontWeight: 800, py: 1.25, alignItems: "flex-start", textAlign: "right" }}
                      >
                        <Box component="span" sx={{ display: "block", width: "100%" }}>
                          <Box component="span" sx={{ display: "block", fontWeight: 900 }}>
                            ١ — تصفير الخزنة
                          </Box>
                          <Box component="span" sx={{ display: "block", fontSize: 12, fontWeight: 600, opacity: 0.9, mt: 0.35 }}>
                            كاش وتطبيق وإجمالي إلى صفر
                          </Box>
                        </Box>
                      </Button>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <Button
                        fullWidth
                        variant="outlined"
                        color="error"
                        startIcon={<ReceiptLong />}
                        onClick={() => {
                          const base = emptyResetSelection();
                          setResetSelection({
                            ...base,
                            treasury: true,
                            sales: true,
                            purchases: true,
                            returns: true,
                          });
                        }}
                        sx={{ textTransform: "none", fontWeight: 800, py: 1.25, alignItems: "flex-start", textAlign: "right" }}
                      >
                        <Box component="span" sx={{ display: "block", width: "100%" }}>
                          <Box component="span" sx={{ display: "block", fontWeight: 900 }}>
                            ٢ — تصفير المال والسجلات المالية
                          </Box>
                          <Box component="span" sx={{ display: "block", fontSize: 12, fontWeight: 600, opacity: 0.9, mt: 0.35 }}>
                            خزنة + مبيعات + مشتريات + مرتجعات (بالكامل)
                          </Box>
                        </Box>
                      </Button>
                    </Grid>
                    <Grid size={{ xs: 12, md: 4 }}>
                      <Button
                        fullWidth
                        variant="contained"
                        color="error"
                        startIcon={<DeleteForever />}
                        onClick={() => {
                          const all = emptyResetSelection();
                          Object.keys(all).forEach((k) => {
                            all[k] = true;
                          });
                          setResetSelection(all);
                        }}
                        sx={{ textTransform: "none", fontWeight: 900, py: 1.25, alignItems: "flex-start", textAlign: "right" }}
                      >
                        <Box component="span" sx={{ display: "block", width: "100%" }}>
                          <Box component="span" sx={{ display: "block" }}>
                            ٣ — تصفير النظام بالكامل
                          </Box>
                          <Box component="span" sx={{ display: "block", fontSize: 12, fontWeight: 700, opacity: 0.95, mt: 0.35 }}>
                            تفعيل كل خيارات التصفير أدناه (من الصفر)
                          </Box>
                        </Box>
                      </Button>
                    </Grid>
                  </Grid>

                  <FormGroup sx={{ mb: 2 }}>
                    <Grid container spacing={1.25}>
                      {[
                        {
                          key: "sales",
                          label: "تصفير المبيعات بالكامل",
                          hint: "حذف كل فواتير المبيعات من التخزين المحلي",
                          icon: <ReceiptLong fontSize="small" />,
                        },
                        {
                          key: "trimSales",
                          label: "تقليص سجل المبيعات",
                          hint: `الإبقاء على أحدث ${DANGER_TRIM_KEEP} فاتورة فقط`,
                          icon: <FilterList fontSize="small" />,
                        },
                        {
                          key: "purchases",
                          label: "تصفير المشتريات بالكامل",
                          hint: "حذف كل فواتير الشراء والتوريد",
                          icon: <ShoppingCart fontSize="small" />,
                        },
                        {
                          key: "trimPurchases",
                          label: "تقليص سجل المشتريات",
                          hint: `الإبقاء على أحدث ${DANGER_TRIM_KEEP} عملية شراء`,
                          icon: <FilterList fontSize="small" />,
                        },
                        {
                          key: "returns",
                          label: "تصفير المرتجعات بالكامل",
                          hint: "مسح كل مرتجعات المبيعات المسجّلة",
                          icon: <Replay fontSize="small" />,
                        },
                        {
                          key: "trimReturns",
                          label: "تقليص المرتجعات",
                          hint: `الإبقاء على أحدث ${DANGER_TRIM_KEEP} مرتجعًا`,
                          icon: <FilterList fontSize="small" />,
                        },
                        {
                          key: "catalog",
                          label: "إعادة الأقسام والأصناف (تجريبي)",
                          hint: "استبدال المخزون والأقسام بنسخة افتراضية",
                          icon: <Inventory2 fontSize="small" />,
                        },
                        {
                          key: "shiftLog",
                          label: "تصفير سجل دوام الكاشير",
                          hint: "جلسات بداية/نهاية الدوام والملخصات",
                          icon: <History fontSize="small" />,
                        },
                        {
                          key: "auditLog",
                          label: "تصفير سجل التدقيق",
                          hint: "يُضاف بعد التنفيذ سطر واحد يوثّق العملية",
                          icon: <Gavel fontSize="small" />,
                        },
                        {
                          key: "notifications",
                          label: "تصفير الإشعارات",
                          hint: "كل الإشعارات في الصندوق",
                          icon: <NotificationsActive fontSize="small" />,
                        },
                        {
                          key: "stocktake",
                          label: "تصفير جلسة الجرد",
                          hint: "جرد معلّق غير مُطبَّق",
                          icon: <Inventory2 fontSize="small" />,
                        },
                        {
                          key: "offlinePending",
                          label: "تصفير فواتير غير متصلة",
                          hint: "قائمة انتظار مزامنة الكاشير",
                          icon: <SyncDisabled fontSize="small" />,
                        },
                        {
                          key: "cartDrafts",
                          label: "تصفير السلال المعلّقة",
                          hint: "سلال محفوظة من الكاشير",
                          icon: <PointOfSale fontSize="small" />,
                        },
                        {
                          key: "debtCustomers",
                          label: "تصفير زبائن الآجل",
                          hint: "الزبائن وسجل حركات الدين",
                          icon: <AccountBalanceWallet fontSize="small" />,
                        },
                        {
                          key: "staffProfileExtras",
                          label: "مسح إضافات الموظفين المحلية",
                          hint: "أسماء ظاهرة وصور رفعت للهيدر (محلي فقط)",
                          icon: <AdminPanelSettings fontSize="small" />,
                        },
                      ].map((row) => (
                        <Grid key={row.key} size={{ xs: 12, sm: 6, md: 4 }}>
                          <Card
                            variant="outlined"
                            onClick={() =>
                              setResetSelection((p) => ({ ...p, [row.key]: !p[row.key] }))
                            }
                            sx={{
                              p: 1.25,
                              height: "100%",
                              cursor: "pointer",
                              borderRadius: 2,
                              borderColor: resetSelection[row.key] ? "error.main" : "divider",
                              bgcolor: resetSelection[row.key] ? alpha(theme.palette.error.main, 0.08) : "background.paper",
                              transition: "border-color 0.15s, background 0.15s",
                            }}
                          >
                            <FormControlLabel
                              sx={{ m: 0, alignItems: "flex-start", width: "100%" }}
                              control={
                                <Checkbox
                                  checked={Boolean(resetSelection[row.key])}
                                  onChange={(e) =>
                                    setResetSelection((p) => ({ ...p, [row.key]: e.target.checked }))
                                  }
                                  color="error"
                                  size="small"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              }
                              label={
                                <Stack sx={{ gap: 0.25, pr: 0.5 }}>
                                  <Stack direction="row" alignItems="center" sx={{ gap: 0.75 }}>
                                    <Box sx={{ color: "error.main", display: "flex" }}>{row.icon}</Box>
                                    <Typography fontWeight={800} variant="body2">
                                      {row.label}
                                    </Typography>
                                  </Stack>
                                  <Typography variant="caption" color="text.secondary" display="block">
                                    {row.hint}
                                  </Typography>
                                </Stack>
                              }
                            />
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  </FormGroup>

                  <Divider sx={{ my: 2 }} />

                  <Stack sx={{ gap: 1.5 }}>
                    <Typography variant="subtitle2" fontWeight={800}>
                      جملة التأكيد (بالإنجليزية، أحرف كبيرة)
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="div">
                      انسخها كما هي في الحقل، ثم يتفعّل زر التنفيذ:
                      <Box
                        component="code"
                        sx={{
                          display: "block",
                          mt: 0.75,
                          p: 1,
                          borderRadius: 1,
                          bgcolor: alpha(theme.palette.common.black, 0.06),
                          fontFamily: "ui-monospace, monospace",
                          letterSpacing: 0.5,
                          fontWeight: 800,
                        }}
                      >
                        {CONFIRM_DANGER_PHRASE}
                      </Box>
                    </Typography>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder={CONFIRM_DANGER_PHRASE}
                      value={dangerPhrase}
                      onChange={(e) => setDangerPhrase(e.target.value)}
                      autoComplete="off"
                      inputProps={{
                        dir: "ltr",
                        style: { fontFamily: "ui-monospace, monospace", letterSpacing: 0.5 },
                      }}
                      error={dangerPhrase.length > 0 && !phraseOk}
                      helperText={
                        phraseOk
                          ? "جاهز للتنفيذ بعد الضغط على الزر والتأكيد في النافذة"
                          : "اكتب الجملة أعلاه حرفياً (أحرف إنجليزية كبيرة)"
                      }
                    />
                    <Button
                      variant="contained"
                      color="error"
                      disabled={!phraseOk || !anyResetSelected || resetBusy}
                      onClick={() => void handleDangerZoneExecute()}
                      startIcon={<DeleteForever />}
                      sx={{ textTransform: "none", fontWeight: 900, alignSelf: { xs: "stretch", sm: "flex-start" }, py: 1.1 }}
                    >
                      {resetBusy ? "جاري التنفيذ…" : "تنفيذ التصفير المحدد"}
                    </Button>
                  </Stack>
                </Card>
                ) : (
                  <Alert severity="info" sx={{ borderRadius: 2, py: 1.5 }}>
                    تصفير الخزنة أو النظام بالكامل يظهر هنا للمدير الأساسي فقط (اسم المستخدم <b>admin</b>).
                  </Alert>
                )}
              </Grid>
            </Grid>
          </Stack>
          ) : null}

          {canManageBrowserStorage && (isMoneySettings || isCashierSystemSettings) ? (
            <Card
              sx={{
                p: 2,
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.info.main, 0.35)}`,
                bgcolor: alpha(theme.palette.info.main, 0.04),
                mb: 2,
              }}
            >
              <Typography fontWeight={900}>مساحة المتصفح (localStorage)</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
                المصدر الرسمي للبيانات هو الخادم. يُبقى محلياً فقط: جلسة الدخول + طابور فواتير الكاشير عند انقطاع الشبكة. استخدم الأزرار إذا
                امتلأ التخزين وتعذّر الدخول.
              </Typography>
              <Stack direction={{ xs: "column", sm: "row" }} flexWrap="wrap" sx={{ gap: 1 }}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    const n = evictHeavyCachesBeforeLogin();
                    showAppToast(`تفريغ خفيف — أُزيلت طبقات ثقيلة (${n} مفتاح)`, "success");
                  }}
                  sx={{ textTransform: "none", fontWeight: 700 }}
                >
                  تفريغ خفيف (سجلات وإشعارات)
                </Button>
                <Button
                  variant="outlined"
                  color="warning"
                  onClick={() => {
                    const n = evictLocalBusinessCachesSecondPass();
                    showAppToast(`حُذفت نسخ المبيعات/المخزون المحلية (${n} مفتاح)`, "warning");
                  }}
                  sx={{ textTransform: "none", fontWeight: 700 }}
                >
                  حذف نسخ المبيعات والمخزون المحلية
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  onClick={async () => {
                    const ok = await confirmApp({
                      title: "مسح التخزين المحلي بالكامل؟",
                      message:
                        "سيُحذف كل ما في localStorage ما عدا: المستخدم الحالي + طابور الكاشير غير المتصل. ستحتاج إعادة تحميل الصفحة واسترجاع البيانات من الخادم.",
                      confirmText: "مسح الكل",
                    });
                    if (!ok) return;
                    const removed = evictAllLocalStorageExceptSessionAndOfflineQueue();
                    showAppToast(`تم — أُزيلت ${removed} مفتاحاً. أعد تحميل الصفحة.`, "success");
                  }}
                  sx={{ textTransform: "none", fontWeight: 800 }}
                >
                  مسح شبه كامل (ما عدا الجلسة والطابور)
                </Button>
              </Stack>
            </Card>
          ) : null}

          {isCashierSystemSettings ? (
            <Card
              sx={{
                p: 2.2,
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.secondary.main, 0.22)}`,
                mb: 2,
              }}
            >
              <Stack direction="row" alignItems="center" sx={{ gap: 1, mb: 1.5 }}>
                <Avatar sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.18), color: "secondary.main", width: 44, height: 44 }}>
                  <PointOfSale />
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={900}>سلوك شاشة الكاشير</Typography>
                  <Typography variant="body2" color="text.secondary">
                    يُطبَّق فور الحفظ على جميع جلسات الكاشير في هذا المتصفح.
                  </Typography>
                </Box>
              </Stack>
              <Divider sx={{ mb: 1 }} />
              {[
                {
                  key: "discountEnabled",
                  title: "الخصم على السلة",
                  hint: "حقول الخصم الثابت والنسبة بجانب طريقة الدفع",
                },
                {
                  key: "creditEnabled",
                  title: "البيع الآجل",
                  hint: "خيار «آجل» واختيار زبون الدين",
                },
                {
                  key: "appPaymentEnabled",
                  title: "الدفع عبر التطبيق",
                  hint: "خيار «تطبيق» في مجموعة طريقة الدفع",
                },
                {
                  key: "holdCartEnabled",
                  title: "تعليق السلة والمعلّقات",
                  hint: "أزرار تعليق السلة وقائمة المعلّقات",
                },
                {
                  key: "debtPayFromCashierEnabled",
                  title: "تسديد دين من الكاشير",
                  hint: "زر «تسديد آجل» في شريط الكاشير العلوي",
                },
                {
                  key: "barcodeScanEnabled",
                  title: "الباركود في الكاشير",
                  hint: "عند التعطيل: لا يُستخدم الباركود في البحث ولا الإضافة السريعة بمفتاح Enter",
                },
                {
                  key: "productSortFiltersEnabled",
                  title: "فرز الأصناف (الأكثر مبيعاً / الأحدث)",
                  hint: "الأزرار فوق قائمة المنتجات",
                },
                {
                  key: "offlineModeToggleEnabled",
                  title: "وضع عدم الاتصال",
                  hint: "تفعيل حفظ الفواتير محلياً عند انقطاع الشبكة",
                },
                {
                  key: "todaySalesButtonEnabled",
                  title: "زر بيع اليوم",
                  hint: "عرض فواتير اليوم من شريط الكاشير",
                },
                {
                  key: "defaultPrintReceiptAfterSale",
                  title: "افتراضي: طباعة الوصل بعد البيع",
                  hint: "للمستخدمين الذين لم يغيّروا المفتاح في الكاشير — يبقى لكل كاشير تفضيله على جهازه",
                },
              ].map((row) => (
                <Stack
                  key={row.key}
                  direction="row"
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ gap: 2, py: 1.25, borderBottom: `1px solid ${theme.palette.divider}` }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography fontWeight={800}>{row.title}</Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {row.hint}
                    </Typography>
                  </Box>
                  <Switch
                    checked={Boolean(cashierSysDraft[row.key])}
                    onChange={() =>
                      setCashierSysDraft((p) => ({ ...p, [row.key]: !p[row.key] }))
                    }
                    inputProps={{ "aria-label": row.title }}
                  />
                </Stack>
              ))}
              <Button
                variant="contained"
                startIcon={<Save />}
                onClick={saveCashierSysSettings}
                sx={{ textTransform: "none", fontWeight: 800, mt: 2 }}
              >
                حفظ إعدادات الكاشير
              </Button>
            </Card>
          ) : null}

          {isAccountSettings ? (
          <Card sx={{ p: 2.2, borderRadius: 3, border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}` }}>
            <Stack direction="row" alignItems="center" sx={{ gap: 1, mb: 1.4 }}>
              <AdminPanelSettings color="primary" />
              <Typography fontWeight={900}>
                {cashierSettings ? "إعدادات حسابي" : "إعدادات حساب السوبر أدمن"}
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              هذا القسم خاص بحسابك الحالي: <b>{currentUser?.username || "superadmin"}</b>
            </Typography>

            {accountMsg.text ? (
              <Alert severity={accountMsg.type === "success" ? "success" : "error"} sx={{ mb: 1.5 }}>
                {accountMsg.text}
              </Alert>
            ) : null}

            <Stack sx={{ gap: 1.25 }}>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleAvatarFile}
              />
              <Stack
                direction={{ xs: "column", sm: "row" }}
                alignItems={{ xs: "center", sm: "center" }}
                sx={{ gap: 2, py: 0.5 }}
              >
                <Avatar
                  src={avatarPreview || undefined}
                  sx={{
                    width: 88,
                    height: 88,
                    fontSize: "2rem",
                    fontWeight: 800,
                    border: `2px solid ${alpha(theme.palette.primary.main, 0.35)}`,
                  }}
                >
                  {!avatarPreview ? (currentUser?.username?.[0] || "A").toUpperCase() : null}
                </Avatar>
                <Stack sx={{ gap: 1, alignItems: { xs: "center", sm: "flex-start" }, flex: 1 }}>
                  <Typography variant="body2" color="text.secondary" textAlign={{ xs: "center", sm: "right" }}>
                    تظهر الصورة في أعلى لوحة الإدارة. تُحفظ على هذا الجهاز مع الجلسة الحالية.
                  </Typography>
                  <Stack direction="row" flexWrap="wrap" sx={{ gap: 1, justifyContent: { xs: "center", sm: "flex-start" } }}>
                    <Button
                      variant="outlined"
                      startIcon={<PhotoCamera />}
                      onClick={() => avatarInputRef.current?.click()}
                      sx={{ textTransform: "none", fontWeight: 700 }}
                    >
                      رفع صورة
                    </Button>
                    {avatarPreview ? (
                      <Button
                        variant="text"
                        color="inherit"
                        onClick={handleRemoveAvatar}
                        sx={{ textTransform: "none", fontWeight: 700 }}
                      >
                        إزالة الصورة
                      </Button>
                    ) : null}
                  </Stack>
                </Stack>
              </Stack>
              <Divider sx={{ my: 0.5 }} />
              <TextField label="اسم المستخدم الحالي" value={currentUser?.username || "superadmin"} fullWidth disabled />
              <TextField
                label="كلمة المرور الحالية"
                type={showCurrentPwd ? "text" : "password"}
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowCurrentPwd((s) => !s)}>
                        {showCurrentPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="كلمة المرور الجديدة"
                type={showNewPwd ? "text" : "password"}
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowNewPwd((s) => !s)}>
                        {showNewPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <TextField
                label="تأكيد كلمة المرور الجديدة"
                type={showConfirmPwd ? "text" : "password"}
                value={passwordForm.confirmNewPassword}
                onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmNewPassword: e.target.value }))}
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton size="small" onClick={() => setShowConfirmPwd((s) => !s)}>
                        {showConfirmPwd ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Button
                variant="contained"
                onClick={handleChangePassword}
                disabled={pwdLoading}
                sx={{ textTransform: "none", fontWeight: 800, alignSelf: "flex-start" }}
              >
                {pwdLoading ? "جارِ التحديث..." : "تحديث كلمة المرور"}
              </Button>
            </Stack>
          </Card>
          ) : null}

          {isAppearanceSettings ? (
          <Card sx={{ p: 2.2, borderRadius: 3, border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}` }}>
            <Stack direction="row" alignItems="center" sx={{ gap: 1, mb: 1 }}>
              <AutoAwesome color="primary" />
              <Box>
                <Typography fontWeight={900}>نماذج ألوان جاهزة</Typography>
                <Typography variant="body2" color="text.secondary">
                  6 أنماط مميزة — لكل نموذج وضع فاتح أو داكن بنقرة واحدة
                </Typography>
              </Box>
            </Stack>
            <Grid container spacing={1.5}>
              {THEME_PRESETS.map((preset) => (
                <Grid key={preset.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card
                    variant="outlined"
                    sx={{
                      p: 1.6,
                      height: "100%",
                      borderRadius: 2.5,
                      overflow: "hidden",
                      transition: "box-shadow 0.2s, transform 0.2s",
                      "&:hover": { boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, 0.08)}` },
                    }}
                  >
                    <Box
                      sx={{
                        height: 6,
                        borderRadius: 99,
                        mb: 1.2,
                        background: `linear-gradient(90deg, ${preset.light.primaryColor}, ${preset.light.secondaryColor})`,
                      }}
                    />
                    <Typography fontWeight={900} variant="subtitle1">
                      {preset.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.25, minHeight: 32 }}>
                      {preset.hint}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                      <Button
                        fullWidth
                        size="small"
                        variant="contained"
                        onClick={() => applyThemePreset(preset, "light")}
                        sx={{ textTransform: "none", fontWeight: 800 }}
                      >
                        وضع فاتح
                      </Button>
                      <Button
                        fullWidth
                        size="small"
                        variant="contained"
                        color="secondary"
                        onClick={() => applyThemePreset(preset, "dark")}
                        sx={{ textTransform: "none", fontWeight: 800 }}
                      >
                        وضع داكن
                      </Button>
                    </Stack>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Card>
          ) : null}

          {isAppearanceSettings ? (
          <Card sx={{ p: 2.2, borderRadius: 3 }}>
            <Stack direction="row" alignItems="center" sx={{ gap: 1, mb: 1.5 }}>
              <ColorLens color="primary" />
              <Typography fontWeight={800}>ألوان النظام (يدوي)</Typography>
            </Stack>
            <Stack direction={{ xs: "column", md: "row" }} sx={{ gap: 2 }}>
              <TextField
                label="اللون الرئيسي"
                type="color"
                value={draft.primaryColor}
                onChange={(e) => setDraft((prev) => ({ ...prev, primaryColor: e.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
              <TextField
                label="اللون الثانوي"
                type="color"
                value={draft.secondaryColor}
                onChange={(e) => setDraft((prev) => ({ ...prev, secondaryColor: e.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
          </Card>
          ) : null}

          {isAppearanceSettings ? (
          <Card sx={{ p: 2.2, borderRadius: 3 }}>
            <Stack direction="row" alignItems="center" sx={{ gap: 1, mb: 1.5 }}>
              <FontDownload color="primary" />
              <Typography fontWeight={800}>نوع الخط</Typography>
            </Stack>
            <FormControl fullWidth>
              <InputLabel>الخط الأساسي</InputLabel>
              <Select
                label="الخط الأساسي"
                value={draft.fontFamily}
                onChange={(e) => setDraft((prev) => ({ ...prev, fontFamily: e.target.value }))}
              >
                {fonts.map((font) => (
                  <MenuItem key={font.value} value={font.value}>
                    {font.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Card>
          ) : null}

          {isAppearanceSettings ? (
          <Card sx={{ p: 2.2, borderRadius: 3 }}>
            <Stack direction="row" alignItems="center" sx={{ gap: 1, mb: 1.5 }}>
              <Tune color="primary" />
              <Typography fontWeight={800}>الهيكل والشكل</Typography>
            </Stack>
            <Stack sx={{ gap: 2 }}>
              <Box>
                <Typography variant="body2" color="text.secondary" mb={0.5}>
                  تدوير الزوايا ({draft.borderRadius}px)
                </Typography>
                <Slider
                  value={draft.borderRadius}
                  min={4}
                  max={24}
                  step={1}
                  valueLabelDisplay="auto"
                  onChange={(_, value) => setDraft((prev) => ({ ...prev, borderRadius: Number(value) }))}
                />
              </Box>

              <FormControl fullWidth>
                <InputLabel>كثافة الواجهة</InputLabel>
                <Select
                  label="كثافة الواجهة"
                  value={draft.density}
                  onChange={(e) => setDraft((prev) => ({ ...prev, density: e.target.value }))}
                >
                  <MenuItem value="comfortable">مريحة</MenuItem>
                  <MenuItem value="compact">مضغوطة</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </Card>
          ) : null}

          {isAppearanceSettings ? (
          <Card
            sx={{
              p: 2.2,
              borderRadius: 3,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
              background: `linear-gradient(135deg, ${alpha(draft.primaryColor, 0.18)}, ${alpha(draft.secondaryColor, 0.16)})`,
            }}
          >
            <Stack direction="row" alignItems="center" sx={{ gap: 1, mb: 1.5 }}>
              <AutoAwesome color="primary" />
              <Typography fontWeight={900}>معاينة مباشرة</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" mb={1.6}>
              الشكل التالي يعكس إعداداتك الحالية قبل الحفظ
            </Typography>

            <Stack direction={{ xs: "column", md: "row" }} sx={{ gap: 1.5 }}>
              <Card
                sx={{
                  flex: 1,
                  p: 1.8,
                  borderRadius: `${draft.borderRadius}px`,
                  border: `1px solid ${alpha(draft.primaryColor, 0.25)}`,
                }}
              >
                <Typography fontWeight={800} sx={{ color: draft.primaryColor }}>
                  بطاقة رئيسية
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  لون رئيسي: {draft.primaryColor}
                </Typography>
              </Card>

              <Card
                sx={{
                  flex: 1,
                  p: 1.8,
                  borderRadius: `${draft.borderRadius}px`,
                  border: `1px solid ${alpha(draft.secondaryColor, 0.25)}`,
                }}
              >
                <Typography fontWeight={800} sx={{ color: draft.secondaryColor }}>
                  بطاقة ثانوية
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  اللون الثانوي: {draft.secondaryColor}
                </Typography>
              </Card>
            </Stack>

            <Divider sx={{ my: 1.6 }} />
            <Typography variant="body2" sx={{ fontFamily: theme.typography.fontFamily }}>
              تجربة الخط الحالي: واجهة أنيقة وواضحة تناسب شاشات الإدارة والكاشير.
            </Typography>
          </Card>
          ) : null}
        </Stack>
      </Box>
    </AdminLayout>
  );
}
