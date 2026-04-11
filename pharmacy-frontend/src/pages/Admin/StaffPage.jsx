import {
  CheckCircle,
  Close,
  DeleteOutline,
  HourglassTop,
  ToggleOff,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";
import {
  alpha,
  Avatar,
  Box,
  Button,
  Card,
  CircularProgress,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Switch,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";
import FilterBarRow from "../../components/FilterBarRow";
import { adminPageContainerSx, adminPageSubtitleSx, adminPageTitleRowSx } from "../../utils/adminPageLayout";
import AdminLayout from "./AdminLayout";
import { Axios } from "../../Api/Axios";
import { showAppToast } from "../../utils/appToast";
import { compressImageFileToDataUrl } from "../../utils/imageCompress";
import { readStaffProfileExtras, writeStaffProfileExtras } from "../../utils/staffProfileExtras";

const ROWS_PER_PAGE = 5;
const STAFF_STORAGE_KEY = "adminStaffAccounts";
const SUPER_ADMIN_USERNAME = "admin";

const initialStaff = [
  {
    id: 1,
    name: "أحمد الشامي",
    username: "admin",
    email: "",
    password: "admin123",
    role: "admin",
    status: "active",
    createdAt: "2026-04-04T08:00:00Z",
  },
  {
    id: 2,
    name: "محمود زكي",
    username: "cashier",
    email: "",
    password: "cashier123",
    role: "cashier",
    status: "active",
    createdAt: "2026-04-05T08:00:00Z",
  },
  {
    id: 5,
    name: "سوبر كاشير",
    username: "cashier_special",
    email: "",
    password: "special123",
    role: "super_cashier",
    status: "active",
    createdAt: "2026-04-08T08:00:00Z",
  },
  {
    id: 3,
    name: "سارة عمر",
    username: "cashier2",
    email: "",
    password: "cashier2123",
    role: "cashier",
    status: "pending",
    createdAt: "2026-04-06T08:00:00Z",
  },
  {
    id: 4,
    name: "ليث خالد",
    username: "admin2",
    email: "",
    password: "admin2123",
    role: "admin",
    status: "inactive",
    createdAt: "2026-04-07T08:00:00Z",
  },
];

function loadStaffFromStorage() {
  const defaultsByUsername = Object.fromEntries(initialStaff.map((s) => [s.username, s]));
  try {
    const raw = localStorage.getItem(STAFF_STORAGE_KEY);
    if (!raw) return initialStaff;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return initialStaff;
    return parsed.map((row) => {
      const def = defaultsByUsername[row.username];
      return {
        ...row,
        email: row.email ?? def?.email ?? "",
        password: row.password ?? def?.password ?? "",
      };
    });
  } catch {
    return initialStaff;
  }
}

function mapApiUserToStaff(user) {
  const pending = user.approval_status === "pending";
  const inactive = !pending && (user.is_active === false || user.is_active === 0);
  let status = "active";
  if (pending) status = "pending";
  else if (inactive) status = "inactive";

  return {
    id: user.id,
    name: user.username,
    username: user.username,
    email: "",
    password: "",
    role:
      user.role === "admin" ? "admin" : user.role === "super_cashier" ? "super_cashier" : "cashier",
    status,
    createdAt: user.created_at || new Date().toISOString(),
  };
}

const emptyEditForm = () => ({
  name: "",
  username: "",
  password: "",
  role: "cashier",
  status: "active",
  avatarDataUrl: "",
});

export default function StaffPage({ mode, onToggleMode }) {
  const theme = useTheme();
  const newUserAvatarInputRef = useRef(null);
  const editUserAvatarInputRef = useRef(null);
  const [staff, setStaff] = useState(loadStaffFromStorage);
  const [newUser, setNewUser] = useState({
    name: "",
    username: "",
    role: "cashier",
    password: "",
    avatarDataUrl: "",
  });
  const [error, setError] = useState("");
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState(emptyEditForm);
  const [editError, setEditError] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STAFF_STORAGE_KEY, JSON.stringify(staff));
    } catch {
      // ignore quota / private mode
    }
  }, [staff]);

  useEffect(() => {
    const loadUsersFromApi = async () => {
      setLoadingUsers(true);
      try {
        const { data } = await Axios.get("users");
        const apiUsers = Array.isArray(data?.data) ? data.data : [];
        if (apiUsers.length) {
          const extras = readStaffProfileExtras();
          setStaff(
            apiUsers.map((u) => {
              const base = mapApiUserToStaff(u);
              const e = extras[base.username] || {};
              return {
                ...base,
                name: e.name || base.name,
                avatarDataUrl: e.avatarDataUrl || base.avatarDataUrl,
              };
            }),
          );
        }
      } catch {
        // fallback to local data
      } finally {
        setLoadingUsers(false);
      }
    };
    loadUsersFromApi();
  }, []);

  const setActiveState = async (id, isActive) => {
    const row = staff.find((u) => u.id === id);
    if (!row) return;
    if (String(row.username || "").toLowerCase() === SUPER_ADMIN_USERNAME) {
      showAppToast("لا يمكن تعطيل حساب المدير الأساسي", "error");
      return;
    }
    if (row.status === "pending") return;

    const prevStaff = staff;
    const nextStatus = isActive ? "active" : "inactive";
    setStaff((p) => p.map((u) => (u.id === id ? { ...u, status: nextStatus } : u)));

    try {
      await Axios.put(`users/${id}`, { is_active: isActive });
      showAppToast(isActive ? "تم تفعيل الحساب" : "تم إيقاف الحساب — لن يستطيع تسجيل الدخول", "success");
    } catch (err) {
      setStaff(prevStaff);
      showAppToast(err?.response?.data?.message || err?.response?.data?.error || "فشل تحديث حالة التفعيل", "error");
    }
  };

  const approveUser = async (id) => {
    try {
      await Axios.post(`users/${id}/approve`);
      setStaff((prev) => prev.map((u) => (u.id === id ? { ...u, status: "active" } : u)));
      showAppToast("تمت الموافقة على الدخول", "success");
    } catch (err) {
      showAppToast(err?.response?.data?.message || err?.response?.data?.error || "فشلت الموافقة", "error");
    }
  };

  const addUser = async () => {
    setError("");
    if (!newUser.name || !newUser.username || !newUser.password) {
      setError("يرجى تعبئة الاسم واسم المستخدم وكلمة المرور");
      return;
    }
    if (String(newUser.password).length < 6) {
      setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    if (staff.some((u) => u.username.toLowerCase() === newUser.username.toLowerCase())) {
      setError("اسم المستخدم مستخدم مسبقًا");
      return;
    }
    const uname = newUser.username.trim();
    setAddSaving(true);
    try {
      const { data } = await Axios.post("users", {
        username: uname,
        password: newUser.password,
        role: newUser.role,
        approval_status: "approved",
      });
      const created = data?.data;
      if (!created?.id) {
        setError("استجابة غير متوقعة من الخادم");
        return;
      }
      const extras = readStaffProfileExtras();
      extras[uname] = {
        ...extras[uname],
        name: newUser.name.trim(),
        ...(newUser.avatarDataUrl ? { avatarDataUrl: newUser.avatarDataUrl } : {}),
      };
      writeStaffProfileExtras(extras);

      const row = {
        id: created.id,
        name: newUser.name.trim(),
        username: created.username,
        email: "",
        password: "",
        role: created.role,
        status: "active",
        createdAt: new Date().toISOString(),
        avatarDataUrl: newUser.avatarDataUrl || "",
      };
      setStaff((prev) => [row, ...prev.filter((u) => u.id !== created.id)]);
      setNewUser({ name: "", username: "", password: "", role: "cashier", avatarDataUrl: "" });
      setShowNewUserPassword(false);
      setOpenAddDialog(false);
      showAppToast(data?.message || "تم إنشاء الحساب", "success");
    } catch (err) {
      const msg =
        err?.response?.data?.errors?.username?.[0] ||
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "فشل إنشاء الحساب";
      setError(msg);
      showAppToast("فشل إنشاء الحساب", "error");
    } finally {
      setAddSaving(false);
    }
  };

  const confirmDeleteUser = async () => {
    if (!deleteTarget) return;
    if (String(deleteTarget.username || "").toLowerCase() === SUPER_ADMIN_USERNAME) {
      showAppToast("لا يمكن حذف حساب مدير النظام الأساسي", "error");
      setDeleteTarget(null);
      return;
    }
    try {
      await Axios.delete(`users/${deleteTarget.id}`);
      setStaff((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      showAppToast("تم حذف الحساب", "success");
    } catch (err) {
      showAppToast(err?.response?.data?.message || err?.response?.data?.error || "فشل حذف الحساب", "error");
    } finally {
      setDeleteTarget(null);
    }
  };

  const openEditEmployee = (row) => {
    setEditTarget(row);
    setEditForm({
      name: row.name || "",
      username: row.username || "",
      password: row.password || "",
      role: row.role || "cashier",
      status: row.status || "active",
      avatarDataUrl: row.avatarDataUrl || "",
    });
    setEditError("");
    setShowEditPassword(false);
  };

  const closeEditEmployee = () => {
    setEditTarget(null);
    setEditForm(emptyEditForm());
    setEditError("");
  };

  const saveEditEmployee = async () => {
    if (!editTarget) return;
    setEditError("");
    const name = editForm.name.trim();
    const username = editForm.username.trim();
    if (!name || !username) {
      setEditError("الاسم واسم المستخدم مطلوبان");
      return;
    }
    const dup = staff.some(
      (u) => u.id !== editTarget.id && u.username.toLowerCase() === username.toLowerCase(),
    );
    if (dup) {
      setEditError("اسم المستخدم مستخدم مسبقًا");
      return;
    }
    const nextPassword = editForm.password.trim() ? editForm.password : editTarget.password;
    if (!nextPassword) {
      setEditError("كلمة المرور مطلوبة (أدخل كلمة مرور جديدة أو اترك الحقل كما هو إن وُجدت سابقًا)");
      return;
    }
    setEditSaving(true);
    try {
      await Axios.put(`users/${editTarget.id}`, {
        username,
        password: nextPassword,
        role: editForm.role,
        approval_status: editForm.status === "pending" ? "pending" : "approved",
        is_active: editForm.status !== "inactive",
      });

      const extras = readStaffProfileExtras();
      const oldU = editTarget.username;
      if (oldU !== username) delete extras[oldU];
      const prevEx = extras[username] || {};
      extras[username] = { ...prevEx, name };
      if (editForm.avatarDataUrl) extras[username].avatarDataUrl = editForm.avatarDataUrl;
      else delete extras[username].avatarDataUrl;
      writeStaffProfileExtras(extras);

      setStaff((prev) =>
        prev.map((u) =>
          u.id === editTarget.id
            ? {
                ...u,
                name,
                username,
                email: "",
                password: nextPassword,
                role: editForm.role,
                status: editForm.status,
                avatarDataUrl: editForm.avatarDataUrl,
              }
            : u,
        ),
      );
      showAppToast("تم تعديل الموظف بنجاح", "success");
      closeEditEmployee();
    } catch (err) {
      setEditError(err?.response?.data?.message || err?.response?.data?.error || "فشل تعديل بيانات الموظف");
      showAppToast("فشل تعديل بيانات الموظف", "error");
    } finally {
      setEditSaving(false);
    }
  };

  const filteredSortedStaff = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = staff.filter((u) => {
      if (String(u.username || "").toLowerCase() === SUPER_ADMIN_USERNAME) return false;
      const matchesSearch =
        !q ||
        String(u.name || "").toLowerCase().includes(q) ||
        String(u.username || "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || u.status === statusFilter;
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      return matchesSearch && matchesStatus && matchesRole;
    });
    return [...filtered].sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      if (bTime !== aTime) return bTime - aTime;
      return Number(b.id || 0) - Number(a.id || 0);
    });
  }, [staff, search, statusFilter, roleFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredSortedStaff.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const paginatedStaff = useMemo(() => {
    const start = (safePage - 1) * ROWS_PER_PAGE;
    return filteredSortedStaff.slice(start, start + ROWS_PER_PAGE);
  }, [filteredSortedStaff, safePage]);
  const counts = useMemo(() => {
    const active = filteredSortedStaff.filter((u) => u.status === "active").length;
    const inactive = filteredSortedStaff.filter((u) => u.status === "inactive").length;
    const pending = filteredSortedStaff.filter((u) => u.status === "pending").length;
    return { total: filteredSortedStaff.length, active, inactive, pending };
  }, [filteredSortedStaff]);

  return (
    <AdminLayout mode={mode} onToggleMode={onToggleMode}>
      <Box sx={adminPageContainerSx}>
        <Stack sx={adminPageTitleRowSx}>
          <Box>
            <Typography variant="h5" fontWeight={900}>
              إدارة الموظفين والتفعيل
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={adminPageSubtitleSx}>
              راقب الموظفين: مفعل، غير مفعل، أو بانتظار موافقة دخول
            </Typography>
            {loadingUsers ? (
              <Typography variant="caption" color="text.secondary">
                جاري تحميل المستخدمين من النظام...
              </Typography>
            ) : null}
          </Box>
          <Button variant="contained" onClick={() => setOpenAddDialog(true)} sx={{ textTransform: "none", fontWeight: 800 }}>
            إضافة جديد
          </Button>
        </Stack>

        <Grid container spacing={2}>
          <Grid size={{ xs: 12 }}>
            <Card
              sx={{
                p: 1.6,
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha(
                  theme.palette.secondary.main,
                  0.08,
                )})`,
              }}
            >
              <FilterBarRow>
                <TextField
                  size="small"
                  placeholder="ابحث بالاسم أو اسم المستخدم..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  sx={{ flex: "1 1 200px", minWidth: 160 }}
                />
                <Select
                  size="small"
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  sx={{ minWidth: 148, flex: "0 0 auto" }}
                >
                  <MenuItem value="all">كل الحالات</MenuItem>
                  <MenuItem value="active">مفعل</MenuItem>
                  <MenuItem value="inactive">غير مفعل</MenuItem>
                  <MenuItem value="pending">بانتظار الموافقة</MenuItem>
                </Select>
                <Select
                  size="small"
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value);
                    setPage(1);
                  }}
                  sx={{ minWidth: 140, flex: "0 0 auto" }}
                >
                  <MenuItem value="all">كل الأدوار</MenuItem>
                  <MenuItem value="admin">Admin</MenuItem>
                  <MenuItem value="cashier">Cashier</MenuItem>
                  <MenuItem value="super_cashier">سوبر كاشير</MenuItem>
                </Select>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                    setRoleFilter("all");
                    setPage(1);
                  }}
                  sx={{ textTransform: "none", fontWeight: 700, flex: "0 0 auto", whiteSpace: "nowrap" }}
                >
                  إعادة الضبط
                </Button>
              </FilterBarRow>
            </Card>
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Card sx={{ p: { xs: 1.25, sm: 2 }, borderRadius: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: "0.75rem", sm: undefined } }}>
                إجمالي الحسابات
              </Typography>
              <Typography variant="h5" fontWeight={900} sx={{ fontSize: { xs: "1.2rem", sm: undefined } }}>
                {counts.total}
              </Typography>
            </Card>
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Card sx={{ p: { xs: 1.25, sm: 2 }, borderRadius: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: "0.75rem", sm: undefined } }}>
                مفعل
              </Typography>
              <Typography variant="h5" fontWeight={900} color="success.main" sx={{ fontSize: { xs: "1.2rem", sm: undefined } }}>
                {counts.active}
              </Typography>
            </Card>
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Card sx={{ p: { xs: 1.25, sm: 2 }, borderRadius: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: "0.75rem", sm: undefined } }}>
                غير مفعل
              </Typography>
              <Typography variant="h5" fontWeight={900} color="warning.main" sx={{ fontSize: { xs: "1.2rem", sm: undefined } }}>
                {counts.inactive}
              </Typography>
            </Card>
          </Grid>
          <Grid size={{ xs: 6, md: 3 }}>
            <Card sx={{ p: { xs: 1.25, sm: 2 }, borderRadius: 3 }}>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: { xs: "0.75rem", sm: undefined } }}>
                بانتظار الموافقة
              </Typography>
              <Typography variant="h5" fontWeight={900} color="info.main" sx={{ fontSize: { xs: "1.2rem", sm: undefined } }}>
                {counts.pending}
              </Typography>
            </Card>
          </Grid>
        </Grid>

        <Card sx={{ mt: 2, borderRadius: 3, overflow: "hidden" }}>
          <Box sx={{ px: { xs: 1.5, sm: 2 }, py: 1.5, bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
            <Typography fontWeight={800}>جدول الموظفين</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
              انقر على صف الموظف للتعديل — التمرير الأفقي على الشاشة الضيقة
            </Typography>
          </Box>
          <Divider />
          <TableContainer
            component={Paper}
            elevation={0}
            sx={{
              maxWidth: "100%",
              overflowX: "auto",
              WebkitOverflowScrolling: "touch",
              borderRadius: 0,
            }}
          >
            <Table size="small" stickyHeader sx={{ minWidth: 720, tableLayout: "fixed" }}>
              <TableHead>
                <TableRow>
                  <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary", width: "26%" }}>
                    الموظف
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary", width: "14%" }}>
                    الدور
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary", width: "18%" }}>
                    الحالة
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary", width: "26%" }}>
                    التفعيل
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary", width: "16%" }}>
                    حذف
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedStaff.map((row) => (
                  <TableRow
                    key={row.id}
                    hover
                    onClick={() => openEditEmployee(row)}
                    sx={{ cursor: "pointer", "&:last-child td": { borderBottom: 0 } }}
                  >
                    <TableCell align="center" sx={{ verticalAlign: "middle" }}>
                      <Typography fontWeight={700} sx={{ wordBreak: "break-word" }}>
                        {row.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        @{row.username}
                      </Typography>
                    </TableCell>
                    <TableCell align="center" sx={{ verticalAlign: "middle" }}>
                      <Chip
                        size="small"
                        label={row.role === "admin" ? "Admin" : row.role === "super_cashier" ? "سوبر كاشير" : "Cashier"}
                        color={row.role === "admin" ? "primary" : row.role === "super_cashier" ? "info" : "secondary"}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center" sx={{ verticalAlign: "middle" }}>
                      <Chip
                        size="small"
                        icon={
                          row.status === "active" ? (
                            <CheckCircle fontSize="small" />
                          ) : row.status === "inactive" ? (
                            <ToggleOff fontSize="small" />
                          ) : (
                            <HourglassTop fontSize="small" />
                          )
                        }
                        label={row.status === "active" ? "مفعل" : row.status === "inactive" ? "غير مفعل" : "بانتظار الموافقة"}
                        color={row.status === "active" ? "success" : row.status === "inactive" ? "warning" : "info"}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center" sx={{ verticalAlign: "middle" }} onClick={(e) => e.stopPropagation()}>
                      {row.status === "pending" ? (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => approveUser(row.id)}
                          sx={{ textTransform: "none", fontWeight: 800 }}
                        >
                          موافقة
                        </Button>
                      ) : (
                        <Stack direction="row" alignItems="center" justifyContent="center" sx={{ gap: 0.75, flexWrap: "wrap" }}>
                          <Switch
                            checked={row.status === "active"}
                            disabled={String(row.username || "").toLowerCase() === SUPER_ADMIN_USERNAME}
                            onChange={(e) => setActiveState(row.id, e.target.checked)}
                            sx={{
                              direction: "ltr",
                              width: 54,
                              height: 30,
                              p: 0.5,
                              "& .MuiSwitch-switchBase": {
                                p: 0.5,
                                transform: "translateX(0px)",
                              },
                              "& .MuiSwitch-switchBase.Mui-checked": {
                                transform: "translateX(24px)",
                                color: "#fff",
                              },
                              "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                                backgroundColor: "#2e7d32",
                                opacity: 1,
                              },
                              "& .MuiSwitch-track": {
                                borderRadius: 30,
                                backgroundColor: "#9e9e9e",
                                opacity: 1,
                              },
                              "& .MuiSwitch-thumb": {
                                width: 22,
                                height: 22,
                                boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                              },
                            }}
                          />
                          <Typography variant="caption" fontWeight={700} color={row.status === "active" ? "success.main" : "text.secondary"}>
                            {row.status === "active" ? "مفعل" : "غير مفعل"}
                          </Typography>
                        </Stack>
                      )}
                    </TableCell>
                    <TableCell align="center" sx={{ verticalAlign: "middle" }} onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="small"
                        color="error"
                        variant="outlined"
                        startIcon={<DeleteOutline fontSize="small" />}
                        disabled={String(row.username || "").toLowerCase() === SUPER_ADMIN_USERNAME}
                        onClick={() => setDeleteTarget(row)}
                        sx={{ textTransform: "none", minWidth: 0, px: 1 }}
                      >
                        حذف
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack direction="row" justifyContent="center" sx={{ py: 1.5 }}>
            <Pagination
              count={pageCount}
              page={safePage}
              onChange={(_, value) => setPage(value)}
              color="primary"
              shape="rounded"
            />
          </Stack>
        </Card>

        <Dialog
          open={Boolean(editTarget)}
          onClose={closeEditEmployee}
          fullWidth
          maxWidth="sm"
          slotProps={{ paper: { sx: { borderRadius: 3, overflow: "hidden" } } }}
        >
          <DialogTitle
            sx={{
              position: "relative",
              textAlign: "center",
              borderBottom: "1px solid",
              borderColor: "divider",
              pt: 2.5,
              pb: 1.5,
            }}
          >
            <IconButton
              aria-label="إغلاق"
              size="small"
              onClick={closeEditEmployee}
              sx={{ position: "absolute", insetInlineStart: 8, top: "50%", transform: "translateY(-50%)" }}
            >
              <Close />
            </IconButton>
            <Typography variant="h6" fontWeight={800} sx={{ px: { xs: 5, sm: 7 } }}>
              تعديل حساب الموظف
            </Typography>
          </DialogTitle>
          <DialogContent dividers sx={{ textAlign: "right", px: { xs: 2, sm: 3 }, py: 2 }}>
            <Stack sx={{ gap: 1.4 }}>
              {editError ? (
                <Typography variant="body2" color="error.main">
                  {editError}
                </Typography>
              ) : null}
              <Typography variant="caption" color="text.secondary">
                معرّف السجل: {editTarget?.id} — تاريخ الإنشاء:{" "}
                {editTarget?.createdAt ? new Date(editTarget.createdAt).toLocaleString("en-GB") : "—"}
              </Typography>
              <TextField
                label="الاسم الظاهر"
                value={editForm.name}
                onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                fullWidth
                inputProps={{ style: { textAlign: "right" } }}
              />
              <TextField
                label="اسم المستخدم (لتسجيل الدخول)"
                value={editForm.username}
                onChange={(e) => setEditForm((p) => ({ ...p, username: e.target.value }))}
                fullWidth
                inputProps={{ style: { textAlign: "right" } }}
              />
              <TextField
                label="كلمة المرور"
                type={showEditPassword ? "text" : "password"}
                value={editForm.password}
                onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
                helperText="اتركها كما هي أو غيّرها؛ إذا مسحت الحقل يُحفظ آخر كلمة مرور محفوظة"
                fullWidth
                inputProps={{ style: { textAlign: "right" } }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="إظهار كلمة المرور"
                        onClick={() => setShowEditPassword((v) => !v)}
                        edge="end"
                        size="small"
                      >
                        {showEditPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Select
                fullWidth
                displayEmpty
                value={editForm.role}
                onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value }))}
              >
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="cashier">Cashier</MenuItem>
                <MenuItem value="super_cashier">سوبر كاشير</MenuItem>
              </Select>
              <Select
                fullWidth
                value={editForm.status}
                onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
              >
                <MenuItem value="active">مفعل</MenuItem>
                <MenuItem
                  value="inactive"
                  disabled={String(editTarget?.username || "").toLowerCase() === SUPER_ADMIN_USERNAME}
                >
                  غير مفعل
                </MenuItem>
                <MenuItem value="pending">بانتظار الموافقة</MenuItem>
              </Select>
              <Typography variant="caption" color="text.secondary">
                صورة تظهر في هيدر لوحة الأدمن عند تسجيل دخول هذا الحساب
              </Typography>
              <Stack direction="row" alignItems="center" sx={{ gap: 1, flexWrap: "wrap" }}>
                <input
                  ref={editUserAvatarInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f?.type?.startsWith("image/")) return;
                    try {
                      const dataUrl = await compressImageFileToDataUrl(f);
                      setEditForm((p) => ({ ...p, avatarDataUrl: dataUrl }));
                    } catch {
                      const r = new FileReader();
                      r.onload = () => setEditForm((p) => ({ ...p, avatarDataUrl: String(r.result || "") }));
                      r.readAsDataURL(f);
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outlined"
                  sx={{ textTransform: "none" }}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    editUserAvatarInputRef.current?.click();
                  }}
                >
                  رفع صورة من الجهاز
                </Button>
                {editForm.avatarDataUrl ? (
                  <Avatar src={editForm.avatarDataUrl} sx={{ width: 48, height: 48 }} variant="rounded" />
                ) : null}
                {editForm.avatarDataUrl ? (
                  <Button size="small" onClick={() => setEditForm((p) => ({ ...p, avatarDataUrl: "" }))} sx={{ textTransform: "none" }}>
                    إزالة الصورة
                  </Button>
                ) : null}
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, gap: 1, bgcolor: (t) => alpha(t.palette.action.hover, 0.06) }}>
            <Button onClick={closeEditEmployee} sx={{ textTransform: "none" }}>
              إلغاء
            </Button>
            <Button
              onClick={saveEditEmployee}
              variant="contained"
              disabled={editSaving}
              sx={{ textTransform: "none", fontWeight: 800, minWidth: 150 }}
            >
              {editSaving ? (
                <Stack direction="row" alignItems="center" sx={{ gap: 1 }}>
                  <CircularProgress size={16} color="inherit" />
                  <span>جاري الحفظ...</span>
                </Stack>
              ) : (
                "حفظ التعديلات"
              )}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={openAddDialog}
          onClose={() => {
            setOpenAddDialog(false);
            setError("");
            setShowNewUserPassword(false);
          }}
          fullWidth
          maxWidth="sm"
          slotProps={{ paper: { sx: { borderRadius: 3, overflow: "hidden" } } }}
        >
          <DialogTitle
            sx={{
              position: "relative",
              textAlign: "center",
              borderBottom: "1px solid",
              borderColor: "divider",
              pt: 2.5,
              pb: 1.5,
            }}
          >
            <IconButton
              aria-label="إغلاق"
              size="small"
              onClick={() => {
                setOpenAddDialog(false);
                setError("");
                setShowNewUserPassword(false);
              }}
              sx={{ position: "absolute", insetInlineStart: 8, top: "50%", transform: "translateY(-50%)" }}
            >
              <Close />
            </IconButton>
            <Typography variant="h6" fontWeight={800} sx={{ px: { xs: 5, sm: 7 } }}>
              إضافة موظف جديد
            </Typography>
          </DialogTitle>
          <DialogContent dividers sx={{ textAlign: "right", px: { xs: 2, sm: 3 }, py: 2 }}>
            <Stack sx={{ gap: 1.4 }}>
              {error ? (
                <Typography variant="body2" color="error.main">
                  {error}
                </Typography>
              ) : null}
              <TextField
                label="الاسم"
                value={newUser.name}
                onChange={(e) => setNewUser((p) => ({ ...p, name: e.target.value }))}
                fullWidth
                inputProps={{ style: { textAlign: "right" } }}
              />
              <TextField
                label="اسم المستخدم"
                value={newUser.username}
                onChange={(e) => setNewUser((p) => ({ ...p, username: e.target.value }))}
                fullWidth
                inputProps={{ style: { textAlign: "right" } }}
              />
              <TextField
                label="كلمة المرور"
                type={showNewUserPassword ? "text" : "password"}
                value={newUser.password || ""}
                onChange={(e) => setNewUser((p) => ({ ...p, password: e.target.value }))}
                fullWidth
                inputProps={{ style: { textAlign: "right" } }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="إظهار كلمة المرور"
                        onClick={() => setShowNewUserPassword((v) => !v)}
                        edge="end"
                        size="small"
                      >
                        {showNewUserPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
              <Select
                fullWidth
                value={newUser.role}
                onChange={(e) => setNewUser((p) => ({ ...p, role: e.target.value }))}
              >
                <MenuItem value="admin">Admin</MenuItem>
                <MenuItem value="cashier">Cashier</MenuItem>
                <MenuItem value="super_cashier">سوبر كاشير</MenuItem>
              </Select>
              <Typography variant="caption" color="text.secondary">
                صورة اختيارية تظهر في الهيدر بعد تفعيل الحساب وتسجيل الدخول
              </Typography>
              <Stack direction="row" alignItems="center" sx={{ gap: 1, flexWrap: "wrap" }}>
                <input
                  ref={newUserAvatarInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f?.type?.startsWith("image/")) return;
                    try {
                      const dataUrl = await compressImageFileToDataUrl(f);
                      setNewUser((p) => ({ ...p, avatarDataUrl: dataUrl }));
                    } catch {
                      const r = new FileReader();
                      r.onload = () => setNewUser((p) => ({ ...p, avatarDataUrl: String(r.result || "") }));
                      r.readAsDataURL(f);
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outlined"
                  sx={{ textTransform: "none" }}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    newUserAvatarInputRef.current?.click();
                  }}
                >
                  رفع صورة من الجهاز
                </Button>
                {newUser.avatarDataUrl ? (
                  <Avatar src={newUser.avatarDataUrl} sx={{ width: 48, height: 48 }} variant="rounded" />
                ) : null}
                {newUser.avatarDataUrl ? (
                  <Button size="small" onClick={() => setNewUser((p) => ({ ...p, avatarDataUrl: "" }))} sx={{ textTransform: "none" }}>
                    إزالة الصورة
                  </Button>
                ) : null}
              </Stack>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, gap: 1, bgcolor: (t) => alpha(t.palette.action.hover, 0.06) }}>
            <Button
              onClick={() => {
                setOpenAddDialog(false);
                setError("");
                setShowNewUserPassword(false);
              }}
              sx={{ textTransform: "none" }}
            >
              إلغاء
            </Button>
            <Button
              onClick={addUser}
              variant="contained"
              disabled={addSaving}
              sx={{ textTransform: "none", fontWeight: 800, minWidth: 140 }}
            >
              {addSaving ? (
                <Stack direction="row" alignItems="center" sx={{ gap: 1 }}>
                  <CircularProgress size={16} color="inherit" />
                  <span>جاري الإنشاء...</span>
                </Stack>
              ) : (
                "إضافة الحساب"
              )}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
          <DialogTitle>تأكيد الحذف</DialogTitle>
          <DialogContent>
            <Typography>
              هل أنت متأكد من حذف الحساب
              {" "}
              <b>{deleteTarget?.username ? `@${deleteTarget.username}` : ""}</b>
              {" "}
              ؟
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setDeleteTarget(null)} sx={{ textTransform: "none" }}>
              إلغاء
            </Button>
            <Button color="error" variant="contained" onClick={confirmDeleteUser} sx={{ textTransform: "none", fontWeight: 800 }}>
              تأكيد الحذف
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </AdminLayout>
  );
}
