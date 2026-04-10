import {
  AdminPanelSettings,
  Badge,
  DeleteOutline,
  PersonAddAlt1,
  PointOfSale,
  Shield,
} from "@mui/icons-material";
import {
  alpha,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  Divider,
  Grid,
  IconButton,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { useMemo, useState } from "react";
import { adminPageContainerSx, adminPageSubtitleSx, adminPageTitleRowSx } from "../../utils/adminPageLayout";
import AdminLayout from "./AdminLayout";

const STORE_KEY = "adminUsersLocal";

function getStoredUsers() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    if (Array.isArray(raw) && raw.length) return raw;
  } catch {
    // ignore parse errors
  }
  return [
    { id: "su1", fullName: "السوبر ادمن", username: "superadmin", role: "super_admin", status: "نشط" },
    { id: "u1", fullName: "مالك الصيدلية", username: "admin", role: "admin", status: "نشط" },
    { id: "u2", fullName: "كاشير رئيسي", username: "cashier", role: "cashier", status: "نشط" },
  ];
}

export default function RolesPage({ mode, onToggleMode }) {
  const theme = useTheme();
  const [users, setUsers] = useState(getStoredUsers);
  const [adminForm, setAdminForm] = useState({ fullName: "", username: "", password: "" });
  const [cashierForm, setCashierForm] = useState({ fullName: "", username: "", password: "" });
  const [error, setError] = useState("");

  const counts = useMemo(() => {
    const admins = users.filter((u) => u.role === "admin" || u.role === "super_admin").length;
    const cashiers = users.filter((u) => u.role === "cashier").length;
    return { admins, cashiers, total: users.length };
  }, [users]);

  const persist = (next) => {
    setUsers(next);
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
  };

  const addUser = (role) => {
    const form = role === "admin" ? adminForm : cashierForm;
    setError("");

    if (!form.fullName || !form.username || !form.password) {
      setError("يرجى تعبئة كل الحقول قبل الإضافة");
      return;
    }
    if (form.password.length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    if (users.some((u) => u.username.toLowerCase() === form.username.toLowerCase())) {
      setError("اسم المستخدم مستخدم مسبقًا");
      return;
    }

    const next = [
      {
        id: `${Date.now()}`,
        fullName: form.fullName,
        username: form.username,
        role,
        status: "نشط",
      },
      ...users,
    ];
    persist(next);

    if (role === "admin") setAdminForm({ fullName: "", username: "", password: "" });
    if (role === "cashier") setCashierForm({ fullName: "", username: "", password: "" });
  };

  const removeUser = (id) => {
    const target = users.find((u) => u.id === id);
    if (target?.role === "super_admin") {
      setError("لا يمكن حذف حساب السوبر ادمن");
      return;
    }
    const next = users.filter((u) => u.id !== id);
    persist(next);
  };

  return (
    <AdminLayout mode={mode} onToggleMode={onToggleMode}>
      <Box sx={adminPageContainerSx}>
        <Stack sx={adminPageTitleRowSx}>
          <Box>
            <Typography variant="h5" fontWeight={900}>
              إدارة الأدوار والمستخدمين
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={adminPageSubtitleSx}>
              أضف مدير أو كاشير بسرعة وتحكم بصلاحيات الدخول بشكل آمن
            </Typography>
          </Box>
          <Chip
            icon={<Shield />}
            label="نظام صلاحيات ذكي"
            color="primary"
            variant="outlined"
            sx={{ display: { xs: "none", sm: "flex" }, alignSelf: { sm: "center" } }}
          />
        </Stack>

        {error ? (
          <Card sx={{ p: 1.2, mb: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.error.main, 0.1) }}>
            <Typography variant="body2" color="error.main" fontWeight={700}>
              {error}
            </Typography>
          </Card>
        ) : null}

        <Grid container spacing={2}>
          <Grid size={{ xs: 4, md: 4 }}>
            <Card sx={{ p: { xs: 1.25, sm: 2 }, borderRadius: 3, border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}` }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: { xs: "block", sm: "none" } }}>
                الإجمالي
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
                إجمالي الحسابات
              </Typography>
              <Typography variant="h5" fontWeight={900} mt={{ xs: 0.25, sm: 0.5 }} sx={{ fontSize: { xs: "1.1rem", sm: undefined } }}>
                {counts.total}
              </Typography>
            </Card>
          </Grid>
          <Grid size={{ xs: 4, md: 4 }}>
            <Card sx={{ p: { xs: 1.25, sm: 2 }, borderRadius: 3, border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}` }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: { xs: "block", sm: "none" } }}>
                مدراء
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
                عدد المدراء
              </Typography>
              <Typography variant="h5" fontWeight={900} mt={{ xs: 0.25, sm: 0.5 }} sx={{ fontSize: { xs: "1.1rem", sm: undefined } }}>
                {counts.admins}
              </Typography>
            </Card>
          </Grid>
          <Grid size={{ xs: 4, md: 4 }}>
            <Card sx={{ p: { xs: 1.25, sm: 2 }, borderRadius: 3, border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}` }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: { xs: "block", sm: "none" } }}>
                كاشير
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
                عدد الكاشير
              </Typography>
              <Typography variant="h5" fontWeight={900} mt={{ xs: 0.25, sm: 0.5 }} sx={{ fontSize: { xs: "1.1rem", sm: undefined } }}>
                {counts.cashiers}
              </Typography>
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12, lg: 6 }}>
            <Card sx={{ p: 2.2, borderRadius: 3 }}>
              <Stack direction="row" alignItems="center" sx={{ gap: 1, mb: 1.5 }}>
                <AdminPanelSettings color="primary" />
                <Typography fontWeight={800}>إضافة مدير جديد</Typography>
              </Stack>
              <Stack sx={{ gap: 1.2 }}>
                <TextField
                  label="الاسم الكامل"
                  value={adminForm.fullName}
                  onChange={(e) => setAdminForm((p) => ({ ...p, fullName: e.target.value }))}
                  fullWidth
                />
                <TextField
                  label="اسم المستخدم"
                  value={adminForm.username}
                  onChange={(e) => setAdminForm((p) => ({ ...p, username: e.target.value }))}
                  fullWidth
                />
                <TextField
                  label="كلمة المرور"
                  type="password"
                  value={adminForm.password}
                  onChange={(e) => setAdminForm((p) => ({ ...p, password: e.target.value }))}
                  fullWidth
                />
                <Button startIcon={<PersonAddAlt1 />} onClick={() => addUser("admin")} variant="contained" sx={{ textTransform: "none", fontWeight: 800 }}>
                  إضافة Admin
                </Button>
              </Stack>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, lg: 6 }}>
            <Card sx={{ p: 2.2, borderRadius: 3 }}>
              <Stack direction="row" alignItems="center" sx={{ gap: 1, mb: 1.5 }}>
                <PointOfSale color="primary" />
                <Typography fontWeight={800}>إضافة كاشير جديد</Typography>
              </Stack>
              <Stack sx={{ gap: 1.2 }}>
                <TextField
                  label="الاسم الكامل"
                  value={cashierForm.fullName}
                  onChange={(e) => setCashierForm((p) => ({ ...p, fullName: e.target.value }))}
                  fullWidth
                />
                <TextField
                  label="اسم المستخدم"
                  value={cashierForm.username}
                  onChange={(e) => setCashierForm((p) => ({ ...p, username: e.target.value }))}
                  fullWidth
                />
                <TextField
                  label="كلمة المرور"
                  type="password"
                  value={cashierForm.password}
                  onChange={(e) => setCashierForm((p) => ({ ...p, password: e.target.value }))}
                  fullWidth
                />
                <Button startIcon={<PersonAddAlt1 />} onClick={() => addUser("cashier")} variant="contained" sx={{ textTransform: "none", fontWeight: 800 }}>
                  إضافة Cashier
                </Button>
              </Stack>
            </Card>
          </Grid>
        </Grid>

        <Card sx={{ mt: 2, borderRadius: 3, overflow: "hidden" }}>
          <Box sx={{ p: { xs: 1.25, sm: 1.5, md: 2 } }}>
            <Typography fontWeight={800}>قائمة الحسابات</Typography>
          </Box>
          <Divider />
          <Stack>
            {users.map((u, idx) => (
              <Box key={u.id}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ p: 1.5 }}>
                  <Stack direction="row" alignItems="center" sx={{ gap: 1.2 }}>
                    <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: "primary.main" }}>
                      <Badge fontSize="small" />
                    </Avatar>
                    <Box>
                      <Typography fontWeight={700}>{u.fullName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        @{u.username}
                      </Typography>
                    </Box>
                  </Stack>

                  <Stack direction="row" alignItems="center" sx={{ gap: 1 }}>
                    <Chip
                      size="small"
                      label={u.role === "super_admin" ? "Super Admin" : u.role === "admin" ? "Admin" : "Cashier"}
                      color={u.role === "cashier" ? "secondary" : "primary"}
                      variant="outlined"
                    />
                    <Chip size="small" label={u.status} color="success" variant="outlined" />
                    <IconButton color="error" disabled={u.role === "super_admin"} onClick={() => removeUser(u.id)}>
                      <DeleteOutline fontSize="small" />
                    </IconButton>
                  </Stack>
                </Stack>
                {idx !== users.length - 1 && <Divider />}
              </Box>
            ))}
          </Stack>
        </Card>
      </Box>
    </AdminLayout>
  );
}
