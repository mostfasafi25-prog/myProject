import { useState } from "react";
import {
  Alert,
  alpha,
  Avatar,
  Box,
  Button,
  Card,
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
} from "@mui/icons-material";
import { Link, useNavigate } from "react-router-dom";
import Cookies from "universal-cookie";
import { Axios } from "../../Api/Axios";
import { PHARMACY_DISPLAY_NAME } from "../../config/appBranding";
import { appendUserLoginNotification } from "../../utils/cashierShiftNotification";
import { mergeUserWithProfileExtras } from "../../utils/staffProfileExtras";

export default function Login() {
  const theme = useTheme();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [roleView, setRoleView] = useState("admin");
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const cookies = new Cookies();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("يرجى إدخال اسم المستخدم وكلمة المرور");
      return;
    }

    try {
      setLoading(true);
      const response = await Axios.post("login", { username, password });

      const token = response?.data?.token;
      let user = response?.data?.user;

      console.info("[صيدلية][تسجيل دخول] بعد الرد", {
        username,
        roleSelectedInUi: roleView,
        serverRole: user?.role,
        hasToken: Boolean(token),
      });

      if (!token || !user?.role) {
        setError("استجابة تسجيل الدخول غير مكتملة");
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
          if (row?.avatarDataUrl) user = { ...user, avatarDataUrl: row.avatarDataUrl };
        }
      } catch {
        // ignore
      }

      user = mergeUserWithProfileExtras(user);

      if (roleView === "admin" && user.role !== "admin") {
        setError("تم اختيار «مدير» — هذا الحساب ليس حساب مدير نظام.");
        return;
      }
      if (roleView === "cashier" && !["cashier", "super_cashier"].includes(user.role)) {
        setError("تم اختيار «كاشير» — استخدم حساب كاشير أو سوبر كاشير.");
        return;
      }

      cookies.set("token", token, { path: "/" });
      localStorage.setItem("user", JSON.stringify(user));
      appendUserLoginNotification({ username: user.username, role: user.role });

      if (user.role === "admin") {
        navigate("/admin", { replace: true });
      } else if (user.role === "cashier" || user.role === "super_cashier") {
        navigate("/cashier", { replace: true });
      } else {
        setError("نوع المستخدم غير مدعوم");
      }
    } catch (err) {
      console.warn("[صيدلية][تسجيل دخول] فشل", err?.response?.status, err?.response?.data?.error || err?.message);
      setError(err?.response?.data?.error || "فشل تسجيل الدخول");
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

            {error ? <Alert severity="error">{error}</Alert> : null}

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
              endIcon={!loading ? <LoginIcon /> : null}
              sx={{
                py: 1.35,
                textTransform: "none",
                fontWeight: 800,
                borderRadius: 2,
                boxShadow: `0 10px 24px ${alpha(theme.palette.primary.main, 0.28)}`,
              }}
            >
              {loading ? <CircularProgress size={22} color="inherit" /> : "تسجيل الدخول"}
            </Button>
            <Typography variant="body2" color="text.secondary" textAlign="center">
              لا تملك حسابًا؟{" "}
              <Button component={Link} to="/register" sx={{ p: 0, minWidth: 0, textTransform: "none", fontWeight: 800 }}>
                إنشاء حساب جديد
              </Button>
            </Typography>
            <Typography variant="caption" color="text.disabled" textAlign="center" sx={{ display: "block", mt: 0.5 }}>
              نشر الواجهة: {__APP_DEPLOY_REF__}
            </Typography>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
