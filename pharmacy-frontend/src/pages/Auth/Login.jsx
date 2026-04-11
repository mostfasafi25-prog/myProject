import { useEffect, useState } from "react";
import {
  Alert,
  alpha,
  Avatar,
  Box,
  Button,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  useTheme,
} from "@mui/material";
import {
  Badge,
  HelpOutline,
  Language,
  Lock,
  Visibility,
  VisibilityOff,
  Login as LoginIcon,
  LocalPharmacy,
  Person,
  PointOfSale,
  AutoAwesome,
} from "@mui/icons-material";
import { keyframes } from "@mui/system";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Cookies from "universal-cookie";
import { Axios } from "../../Api/Axios";
import { PHARMACY_DISPLAY_NAME } from "../../config/appBranding";
import { SITE_OG_DESCRIPTION } from "../../config/siteSeo";
import { appendUserLoginNotification } from "../../utils/cashierShiftNotification";
import {
  mergeUserWithProfileExtras,
  persistSessionUser,
} from "../../utils/staffProfileExtras";
import {
  evictAllLocalStorageExceptSessionAndOfflineQueue,
  evictHeavyCachesBeforeLogin,
  evictLocalBusinessCachesSecondPass,
} from "../../utils/localStorageEviction";
import { formatLoginCatchError, loginFailureUserMessage } from "../../utils/formatApiError";

const welcomeContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.14, delayChildren: 0.12 },
  },
};

const welcomeItem = {
  hidden: { opacity: 0, y: 28, filter: "blur(8px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring", stiffness: 380, damping: 28 },
  },
};

const loginRingPulse = keyframes`
  0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.35; }
  50% { transform: translate(-50%, -50%) scale(1.07); opacity: 0.82; }
`;

export default function Login() {
  const theme = useTheme();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [roleView, setRoleView] = useState("admin");
  const [showPassword, setShowPassword] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(true);
  const navigate = useNavigate();
  const cookies = new Cookies();

  useEffect(() => {
    const t = setTimeout(() => setWelcomeOpen(false), 3400);
    return () => clearTimeout(t);
  }, []);

  const dismissWelcome = () => setWelcomeOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("يرجى إدخال اسم المستخدم وكلمة المرور");
      return;
    }

    try {
      setLoading(true);
      evictHeavyCachesBeforeLogin();
      const response = await Axios.post(
        "login",
        { username: username.trim(), password },
        { validateStatus: () => true },
      );

      const status = response?.status ?? 0;
      let payload = response?.data;
      if (typeof payload === "string") {
        try {
          payload = JSON.parse(payload);
        } catch {
          // يبقى نصاً (مثلاً HTML)
        }
      }

      const token = payload && typeof payload === "object" ? payload.token : undefined;
      let user = payload && typeof payload === "object" ? payload.user : undefined;

      console.info("[صيدلية][تسجيل دخول] بعد الرد", {
        username,
        roleSelectedInUi: roleView,
        serverRole: user?.role,
        hasToken: Boolean(token),
        status,
      });

      const looksOk =
        status >= 200 &&
        status < 400 &&
        Boolean(token) &&
        user &&
        typeof user === "object" &&
        Boolean(user.role) &&
        !(payload && typeof payload === "object" && typeof payload.error === "string");

      if (!looksOk) {
        setError(loginFailureUserMessage(status, payload));
        return;
      }

      try {
        const staffRaw = localStorage.getItem("adminStaffAccounts");
        const staff = JSON.parse(staffRaw);
        if (Array.isArray(staff)) {
          const row = staff.find(
            (s) => String(s.username || "").toLowerCase() === String(user.username || "").toLowerCase(),
          );
          if (row?.name) user = { ...user, name: row.name };
        }
      } catch {
        // ignore
      }

      user = mergeUserWithProfileExtras(user);

      if (roleView === "admin" && user.role !== "admin" && user.role !== "super_admin") {
        setError("تم اختيار «مدير» — هذا الحساب ليس حساب مدير نظام.");
        return;
      }
      if (roleView === "cashier" && !["cashier", "super_cashier"].includes(user.role)) {
        setError("تم اختيار «كاشير» — استخدم حساب كاشير أو سوبر كاشير.");
        return;
      }

      let sessionSave = persistSessionUser(user);
      if (!sessionSave.ok) {
        evictLocalBusinessCachesSecondPass();
        sessionSave = persistSessionUser(user);
      }
      if (!sessionSave.ok) {
        evictAllLocalStorageExceptSessionAndOfflineQueue();
        sessionSave = persistSessionUser(user);
      }
      if (!sessionSave.ok) {
        setError(
          "تعذر حفظ جلسة المستخدم بعد محاولة تفريغ التخزين المحلي. امسح بيانات الموقع للنطاق من إعدادات المتصفح أو زر «تفريغ التخزين» من إعدادات المدير ثم أعد المحاولة.",
        );
        return;
      }
      cookies.set("token", token, { path: "/" });
      appendUserLoginNotification({ username: user.username, role: user.role });

      if (user.role === "admin" || user.role === "super_admin") {
        navigate("/admin", { replace: true });
      } else if (user.role === "cashier" || user.role === "super_cashier") {
        navigate("/cashier", { replace: true });
      } else {
        setError("نوع المستخدم غير مدعوم");
      }
    } catch (err) {
      console.warn("[صيدلية][تسجيل دخول] فشل", err?.response?.status, err?.response?.data, err);
      setError(formatLoginCatchError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        position: "relative",
        display: "grid",
        placeItems: "center",
        px: { xs: 1.5, sm: 2 },
        py: { xs: 8, sm: 10 },
        pt: { xs: 10, sm: 12 },
        overflow: "hidden",
        bgcolor: "background.default",
      }}
    >
      <AnimatePresence>
        {welcomeOpen ? (
          <motion.div
            key="welcome-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.02, transition: { duration: 0.45, ease: [0.4, 0, 0.2, 1] } }}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 30,
              display: "grid",
              placeItems: "center",
              padding: 16,
            }}
          >
            <Box
              onClick={dismissWelcome}
              sx={{
                position: "absolute",
                inset: 0,
                cursor: "pointer",
                background: `linear-gradient(145deg, ${alpha(theme.palette.primary.dark, 0.92)} 0%, ${alpha(
                  theme.palette.secondary.dark,
                  0.88,
                )} 45%, ${alpha("#0f766e", 0.9)} 100%)`,
              }}
            />
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                opacity: 0.35,
                background:
                  "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.25) 0%, transparent 45%), radial-gradient(circle at 80% 70%, rgba(167,243,208,0.35) 0%, transparent 40%)",
                pointerEvents: "none",
              }}
            />
            {[0, 1, 2].map((i) => (
              <Box
                key={i}
                sx={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  width: 280 + i * 120,
                  height: 280 + i * 120,
                  borderRadius: "50%",
                  border: `1px solid ${alpha("#fff", 0.12 - i * 0.03)}`,
                  animation: `${loginRingPulse} ${4 + i * 0.7}s ease-in-out infinite`,
                  animationDelay: `${i * 0.4}s`,
                  pointerEvents: "none",
                }}
              />
            ))}

            <motion.div
              variants={welcomeContainer}
              initial="hidden"
              animate="show"
              style={{
                position: "relative",
                zIndex: 2,
                maxWidth: 520,
                textAlign: "center",
                pointerEvents: "none",
              }}
            >
              <motion.div variants={welcomeItem}>
                <AutoAwesome sx={{ fontSize: 40, color: alpha("#fef9c3", 0.95), mb: 1, filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.25))" }} />
              </motion.div>
              <motion.div variants={welcomeItem}>
                <Typography
                  sx={{
                    fontSize: { xs: "1.85rem", sm: "2.35rem" },
                    fontWeight: 900,
                    lineHeight: 1.25,
                    letterSpacing: "-0.02em",
                    background: `linear-gradient(110deg, #ecfdf5 0%, #a7f3d0 35%, #fef9c3 70%, #fff 100%)`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    textShadow: "0 8px 32px rgba(0,0,0,0.15)",
                  }}
                >
                  مرحباً بكم
                </Typography>
              </motion.div>
              <motion.div variants={welcomeItem}>
                <Typography
                  sx={{
                    mt: 1.25,
                    fontSize: { xs: "1.05rem", sm: "1.2rem" },
                    fontWeight: 800,
                    color: alpha("#fff", 0.95),
                    lineHeight: 1.65,
                    textShadow: "0 2px 16px rgba(0,0,0,0.2)",
                  }}
                >
                  في نظام {PHARMACY_DISPLAY_NAME}
                </Typography>
              </motion.div>
              <motion.div variants={welcomeItem}>
                <Typography
                  sx={{
                    mt: 2,
                    fontSize: { xs: "0.9rem", sm: "0.98rem" },
                    fontWeight: 600,
                    color: alpha("#fff", 0.88),
                    lineHeight: 1.75,
                    maxWidth: 440,
                    mx: "auto",
                    px: 1,
                  }}
                >
                  {SITE_OG_DESCRIPTION}
                </Typography>
              </motion.div>
            </motion.div>

            <Box
              sx={{
                position: "absolute",
                bottom: { xs: 28, sm: 40 },
                left: 0,
                right: 0,
                zIndex: 3,
                display: "flex",
                justifyContent: "center",
                pointerEvents: "auto",
              }}
            >
              <Button
                variant="contained"
                size="large"
                onClick={(e) => {
                  e.stopPropagation();
                  dismissWelcome();
                }}
                sx={{
                  textTransform: "none",
                  fontWeight: 900,
                  px: 4,
                  py: 1.25,
                  borderRadius: 99,
                  bgcolor: alpha("#fff", 0.98),
                  color: "primary.dark",
                  boxShadow: `0 12px 40px ${alpha("#000", 0.25)}`,
                  "&:hover": { bgcolor: "#fff" },
                }}
              >
                متابعة إلى تسجيل الدخول
              </Button>
            </Box>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <Box
        sx={{
          position: "absolute",
          top: -120,
          left: -120,
          width: 360,
          height: 360,
          borderRadius: "50%",
          bgcolor: alpha(theme.palette.primary.main, 0.08),
          filter: "blur(60px)",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          bottom: -120,
          right: -120,
          width: 360,
          height: 360,
          borderRadius: "50%",
          bgcolor: alpha(theme.palette.secondary.main, 0.08),
          filter: "blur(60px)",
        }}
      />

      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ position: "fixed", top: 0, left: 0, right: 0, px: { xs: 2, sm: 3 }, py: { xs: 1.5, sm: 2 }, zIndex: 2 }}
      >
        <Typography fontWeight={900} color="primary.main" sx={{ fontSize: { xs: "0.95rem", sm: "1.35rem" }, lineHeight: 1.3, maxWidth: "72%" }}>
          {PHARMACY_DISPLAY_NAME}
        </Typography>
        <Stack direction="row" sx={{ gap: 1 }}>
          <IconButton size="small">
            <Language />
          </IconButton>
          <IconButton size="small">
            <HelpOutline />
          </IconButton>
        </Stack>
      </Stack>

      <Box sx={{ width: "100%", maxWidth: 460, zIndex: 1 }}>
        <Paper
          sx={{
            p: { xs: 3, sm: 4 },
            borderRadius: 3,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
            boxShadow: `0 12px 40px ${alpha(theme.palette.common.black, 0.08)}`,
          }}
        >
          <Stack component="form" onSubmit={handleSubmit} sx={{ gap: 2.25 }}>
            <Box sx={{ textAlign: "center", mb: 0.5 }}>
              <Avatar
                sx={{
                  bgcolor: alpha(theme.palette.primary.main, 0.14),
                  color: "primary.main",
                  width: 64,
                  height: 64,
                  marginInline: "auto",
                  mb: 1.5,
                }}
              >
                <LocalPharmacy sx={{ fontSize: 36 }} />
              </Avatar>
              <Typography variant="h5" fontWeight={900}>
                تسجيل الدخول
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                مرحبًا بك في نظام {PHARMACY_DISPLAY_NAME}
              </Typography>
            </Box>

            <Box>
              <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ mr: 0.5 }}>
                نوع المستخدم
              </Typography>
              <ToggleButtonGroup
                value={roleView}
                exclusive
                fullWidth
                onChange={(_, val) => {
                  if (val) setRoleView(val);
                }}
                sx={{
                  mt: 0.8,
                  p: 0.5,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.06),
                  "& .MuiToggleButton-root": {
                    border: 0,
                    borderRadius: 1.5,
                    py: 1,
                    textTransform: "none",
                    fontWeight: 700,
                    color: "text.secondary",
                  },
                  "& .Mui-selected": {
                    bgcolor: "background.paper !important",
                    color: "primary.main !important",
                    boxShadow: `0 4px 14px ${alpha(theme.palette.primary.main, 0.18)}`,
                  },
                }}
              >
                <ToggleButton value="admin">
                  <Stack direction="row" alignItems="center" sx={{ gap: 0.75 }}>
                    <Badge sx={{ fontSize: 18 }} />
                    <span>مدير</span>
                  </Stack>
                </ToggleButton>
                <ToggleButton value="cashier">
                  <Stack direction="row" alignItems="center" sx={{ gap: 0.75 }}>
                    <PointOfSale sx={{ fontSize: 18 }} />
                    <span>كاشير / سوبر كاشير</span>
                  </Stack>
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>

            {error ? (
              <Alert severity="error" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {error}
              </Alert>
            ) : null}

            <TextField
              label="اسم المستخدم"
              placeholder={roleView === "admin" ? "admin" : "cashier"}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Person fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="كلمة المرور"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              fullWidth
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPassword((s) => !s)}>
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              endIcon={!loading ? <LoginIcon sx={{ fontSize: 22 }} /> : null}
              sx={{
                py: 1.35,
                textTransform: "none",
                fontWeight: 800,
                borderRadius: 2,
                boxShadow: `0 10px 24px ${alpha(theme.palette.primary.main, 0.28)}`,
                columnGap: "3px",
                "& .MuiButton-endIcon": {
                  marginInlineStart: "3px",
                  marginInlineEnd: 0,
                },
              }}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : "تسجيل الدخول"}
            </Button>
            <Typography variant="caption" color="text.disabled" textAlign="center" sx={{ display: "block", mt: 0.5 }}>
              نشر الواجهة: {__APP_DEPLOY_REF__}
            </Typography>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
