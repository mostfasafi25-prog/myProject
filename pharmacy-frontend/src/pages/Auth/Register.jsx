import { useState } from "react";
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
  LocalPharmacy,
  Person,
  PointOfSale,
  PersonAddAlt1,
} from "@mui/icons-material";
import { Link, useNavigate } from "react-router-dom";
import { Axios } from "../../Api/Axios";
import { PHARMACY_DISPLAY_NAME } from "../../config/appBranding";

export default function Register() {
  const theme = useTheme();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  /** يطابق تسجيل الدخول: مدير = admin فقط، كاشير = تسجيل ككاشير */
  const [roleView, setRoleView] = useState("cashier");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [step, setStep] = useState("register");
  const [otpCode, setOtpCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [otpChannel, setOtpChannel] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!username || !password || !fullName) {
      setError("يرجى تعبئة جميع الحقول");
      return;
    }

    try {
      setLoading(true);
      const role = roleView === "admin" ? "admin" : "cashier";
      const response = await Axios.post("register", { username, password, role, full_name: fullName });
      if (response?.data?.requires_verification) {
        setChallengeId(response?.data?.challenge_id || "");
        setOtpChannel(response?.data?.channel || "");
        setStep("otp");
        setSuccess("تم إرسال رمز التحقق إلى البريد");
        return;
      }
      setSuccess("تم إنشاء الحساب بنجاح. يمكنك تسجيل الدخول الآن.");
      setTimeout(() => navigate("/login", { replace: true }), 1100);
    } catch (err) {
      setError(err?.response?.data?.error || err?.response?.data?.message || "فشل إنشاء الحساب");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!challengeId || otpCode.length !== 4) {
      setError("أدخل رمز التحقق المكون من 4 أرقام");
      return;
    }

    try {
      setLoading(true);
      await Axios.post("register/verify-otp", {
        challenge_id: challengeId,
        code: otpCode,
      });
      setSuccess("تم تأكيد البريد. الحساب بانتظار موافقة الأدمن.");
      setTimeout(() => navigate("/login", { replace: true }), 1200);
    } catch (err) {
      setError(err?.response?.data?.error || "فشل تأكيد الرمز");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2, bgcolor: "background.default", position: "relative", overflow: "hidden" }}>
      <Box sx={{ position: "absolute", top: -120, left: -120, width: 360, height: 360, borderRadius: "50%", bgcolor: alpha(theme.palette.primary.main, 0.08), filter: "blur(60px)" }} />
      <Box sx={{ position: "absolute", bottom: -120, right: -120, width: 360, height: 360, borderRadius: "50%", bgcolor: alpha(theme.palette.secondary.main, 0.08), filter: "blur(60px)" }} />

      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ position: "fixed", top: 0, left: 0, right: 0, px: 3, py: 2, zIndex: 2 }}>
        <Typography fontWeight={900} color="primary.main" sx={{ fontSize: { xs: 18, sm: 24 }, lineHeight: 1.35, textAlign: "center", px: 1 }}>
          {PHARMACY_DISPLAY_NAME}
        </Typography>
        <Stack direction="row" sx={{ gap: 1 }}>
          <IconButton size="small"><Language /></IconButton>
          <IconButton size="small"><HelpOutline /></IconButton>
        </Stack>
      </Stack>

      <Box sx={{ width: "100%", maxWidth: 480, zIndex: 1 }}>
        <Paper sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3, border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}` }}>
          <Stack component="form" onSubmit={step === "register" ? handleSubmit : handleVerifyOtp} sx={{ gap: 2.2 }}>
            <Box sx={{ textAlign: "center" }}>
              <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.14), color: "primary.main", width: 64, height: 64, marginInline: "auto", mb: 1.5 }}>
                <LocalPharmacy sx={{ fontSize: 36 }} />
              </Avatar>
              <Typography variant="h5" fontWeight={900}>تسجيل حساب جديد</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>إنشاء حساب مدير أو كاشير للنظام</Typography>
            </Box>

            {error ? <Alert severity="error">{error}</Alert> : null}
            {success ? <Alert severity="success">{success}</Alert> : null}

            {step === "register" ? (
            <>
            <TextField
              label="الاسم الكامل"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start"><Person fontSize="small" /></InputAdornment> }}
            />
            <TextField
              label="اسم المستخدم"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start"><Badge fontSize="small" /></InputAdornment> }}
            />
            <TextField
              label="كلمة المرور"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              InputProps={{
                startAdornment: <InputAdornment position="start"><Lock fontSize="small" /></InputAdornment>,
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setShowPassword((s) => !s)}>
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            </>
            ) : (
              <Card sx={{ p: 1.3, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
                <Typography variant="body2">
                  تم إرسال رمز تحقق التسجيل إلى: <b>{otpChannel || "Hotmail"}</b>
                </Typography>
              </Card>
            )}

            {step === "register" ? (
            <Box>
              <Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ mr: 0.5 }}>نوع الحساب</Typography>
              <ToggleButtonGroup
                value={roleView}
                exclusive
                fullWidth
                onChange={(_, val) => val && setRoleView(val)}
                sx={{
                  mt: 0.8,
                  p: 0.5,
                  borderRadius: 2,
                  bgcolor: alpha(theme.palette.primary.main, 0.06),
                  "& .MuiToggleButton-root": { border: 0, borderRadius: 1.5, py: 1, textTransform: "none", fontWeight: 700 },
                }}
              >
                <ToggleButton value="admin"><Stack direction="row" alignItems="center" sx={{ gap: 0.75 }}><Badge sx={{ fontSize: 18 }} /><span>مدير</span></Stack></ToggleButton>
                <ToggleButton value="cashier"><Stack direction="row" alignItems="center" sx={{ gap: 0.75 }}><PointOfSale sx={{ fontSize: 18 }} /><span>كاشير</span></Stack></ToggleButton>
              </ToggleButtonGroup>
            </Box>
            ) : (
              <TextField
                label="رمز التحقق"
                placeholder="0000"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                fullWidth
              />
            )}

            <Button type="submit" variant="contained" disabled={loading} endIcon={!loading ? <PersonAddAlt1 /> : null} sx={{ py: 1.3, textTransform: "none", fontWeight: 800 }}>
              {loading ? <CircularProgress size={22} color="inherit" /> : step === "register" ? "إرسال رمز التحقق" : "تأكيد التسجيل"}
            </Button>
            {step === "otp" ? (
              <Button
                variant="text"
                onClick={() => {
                  setStep("register");
                  setOtpCode("");
                  setChallengeId("");
                  setOtpChannel("");
                }}
                sx={{ textTransform: "none" }}
              >
                رجوع
              </Button>
            ) : null}

            <Typography variant="body2" color="text.secondary" textAlign="center">
              لديك حساب بالفعل؟ <Button component={Link} to="/login" sx={{ textTransform: "none", p: 0, minWidth: 0, fontWeight: 800 }}>تسجيل الدخول</Button>
            </Typography>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
