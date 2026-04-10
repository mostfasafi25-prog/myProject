import { Add, Category, Inventory2, TrendingUp } from "@mui/icons-material";
import {
  alpha,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Pagination,
  Switch,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { useMemo, useState } from "react";
import FilterBarRow from "../../components/FilterBarRow";
import { adminPageContainerSx, adminPageSubtitleSx, adminPageTitleRowSx } from "../../utils/adminPageLayout";
import AdminLayout from "./AdminLayout";
import { confirmApp, showAppToast } from "../../utils/appToast";
import { getStoredUser, isSuperCashier } from "../../utils/userRoles";
const unifiedToggleSx = {
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
};

const CATEGORIES_KEY = "adminCategories";
const ROWS_PER_PAGE = 5;
const initialCategories = [
  { id: 1, name: "مسكنات", productsCount: 42, status: "نشط", manager: "أحمد", active: true },
  { id: 2, name: "مضادات حيوية", productsCount: 28, status: "نشط", manager: "ليث", active: true },
  { id: 3, name: "فيتامينات", productsCount: 33, status: "نشط", manager: "سارة", active: true },
  { id: 4, name: "عناية", productsCount: 16, status: "متوسط", manager: "محمد", active: true },
  { id: 5, name: "أطفال", productsCount: 9, status: "منخفض", manager: "رهف", active: true },
];

function getStoredCategories() {
  try {
    const raw = JSON.parse(localStorage.getItem(CATEGORIES_KEY));
    if (Array.isArray(raw) && raw.length) return raw;
  } catch {
    // ignore
  }
  return initialCategories;
}

export default function CategoriesPage({ mode, onToggleMode }) {
  const theme = useTheme();
  const superCashier = isSuperCashier(getStoredUser());
  const [categories, setCategories] = useState(getStoredCategories);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: "", manager: "" });
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", manager: "" });
  const [editError, setEditError] = useState("");

  const addCategory = () => {
    setError("");
    if (!newCategory.name || !newCategory.manager) {
      setError("يرجى إدخال اسم القسم والمسؤول");
      return;
    }
    if (categories.some((c) => c.name === newCategory.name)) {
      setError("اسم القسم موجود مسبقًا");
      return;
    }

    const next = [
      {
        id: Date.now(),
        name: newCategory.name,
        manager: newCategory.manager,
        productsCount: 0,
        status: "جديد",
        active: true,
        createdAt: new Date().toISOString(),
      },
      ...categories,
    ];
    setCategories(next);
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(next));
    setNewCategory({ name: "", manager: "" });
    setOpenAddDialog(false);
    showAppToast("تم إضافة القسم بنجاح", "success");
  };

  const toggleCategoryActive = (id, checked) => {
    const next = categories.map((c) => (c.id === id ? { ...c, active: checked } : c));
    setCategories(next);
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(next));
    showAppToast(checked ? "تم تفعيل القسم" : "تم تعطيل القسم", "info");
  };

  const saveCategoryEdit = () => {
    setEditError("");
    if (!editTarget) return;
    const name = editForm.name.trim();
    const manager = editForm.manager.trim();
    if (!name || !manager) {
      setEditError("اسم القسم والمسؤول مطلوبان");
      return;
    }
    if (categories.some((c) => c.id !== editTarget.id && c.name === name)) {
      setEditError("اسم القسم مستخدم مسبقًا");
      return;
    }
    const next = categories.map((c) =>
      c.id === editTarget.id ? { ...c, name, manager, status: c.status || "نشط" } : c,
    );
    setCategories(next);
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(next));
    setEditTarget(null);
    showAppToast("تم حفظ تعديل القسم", "success");
  };

  const deleteCategory = async (id) => {
    const target = categories.find((c) => c.id === id);
    if (!target) return;
    const ok = await confirmApp({
      title: "حذف القسم",
      text: `حذف القسم «${target.name}»؟ لا يمكن التراجع عن هذا الإجراء.`,
      icon: "warning",
      danger: true,
      confirmText: "نعم، احذف",
    });
    if (!ok) return;
    const next = categories.filter((c) => c.id !== id);
    setCategories(next);
    localStorage.setItem(CATEGORIES_KEY, JSON.stringify(next));
    showAppToast("تم حذف القسم بنجاح", "success");
  };

  const filteredSortedCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = categories.filter((cat) => {
      const matchesSearch =
        !q ||
        String(cat.name || "").toLowerCase().includes(q) ||
        String(cat.manager || "").toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && cat.active) ||
        (statusFilter === "inactive" && !cat.active);
      return matchesSearch && matchesStatus;
    });
    return [...filtered].sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      if (bTime !== aTime) return bTime - aTime;
      return Number(b.id || 0) - Number(a.id || 0);
    });
  }, [categories, search, statusFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredSortedCategories.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const paginatedCategories = useMemo(() => {
    const start = (safePage - 1) * ROWS_PER_PAGE;
    return filteredSortedCategories.slice(start, start + ROWS_PER_PAGE);
  }, [filteredSortedCategories, safePage]);
  const stats = useMemo(() => {
    const totalProducts = filteredSortedCategories.reduce((sum, c) => sum + c.productsCount, 0);
    return {
      totalCategories: filteredSortedCategories.length,
      totalProducts,
      avgPerCategory: filteredSortedCategories.length ? Math.round(totalProducts / filteredSortedCategories.length) : 0,
    };
  }, [filteredSortedCategories]);

  return (
    <AdminLayout mode={mode} onToggleMode={onToggleMode}>
      <Box sx={adminPageContainerSx}>
        <Stack sx={adminPageTitleRowSx}>
          <Box>
            <Typography variant="h5" fontWeight={900}>
              الأقسام
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={adminPageSubtitleSx}>
              متابعة الأقسام وعدد الأصناف في كل قسم بشكل منظم
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<Add />} onClick={() => setOpenAddDialog(true)} sx={{ textTransform: "none", fontWeight: 800 }}>
            إضافة قسم
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
                mb: 0.2,
              }}
            >
              <FilterBarRow alignItems="center">
                <TextField
                  size="small"
                  placeholder="ابحث باسم القسم أو المسؤول..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  sx={{ flex: "1 1 200px", minWidth: 160 }}
                />
                <TextField
                  size="small"
                  select
                  value={statusFilter}
                  onChange={(e) => {
                    setStatusFilter(e.target.value);
                    setPage(1);
                  }}
                  sx={{ minWidth: 160, flex: "0 0 auto" }}
                >
                  <MenuItem value="all">كل الحالات</MenuItem>
                  <MenuItem value="active">نشط فقط</MenuItem>
                  <MenuItem value="inactive">غير نشط فقط</MenuItem>
                </TextField>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                    setPage(1);
                  }}
                  sx={{ textTransform: "none", fontWeight: 700, flex: "0 0 auto", whiteSpace: "nowrap" }}
                >
                  إعادة الضبط
                </Button>
              </FilterBarRow>
            </Card>
          </Grid>
          <Grid size={{ xs: 4, md: 4 }}>
            <Card sx={{ p: { xs: 1.25, sm: 2 }, borderRadius: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={0.75}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: { xs: "block", sm: "none" } }}>
                    أقسام
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
                    عدد الأقسام
                  </Typography>
                  <Typography variant="h5" fontWeight={900} sx={{ fontSize: { xs: "1.1rem", sm: undefined } }}>
                    {stats.totalCategories}
                  </Typography>
                </Box>
                <Category color="primary" sx={{ fontSize: { xs: 22, sm: 28 }, flexShrink: 0 }} />
              </Stack>
            </Card>
          </Grid>
          <Grid size={{ xs: 4, md: 4 }}>
            <Card sx={{ p: { xs: 1.25, sm: 2 }, borderRadius: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={0.75}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: { xs: "block", sm: "none" } }}>
                    أصناف
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
                    إجمالي الأصناف
                  </Typography>
                  <Typography variant="h5" fontWeight={900} sx={{ fontSize: { xs: "1.1rem", sm: undefined } }}>
                    {stats.totalProducts}
                  </Typography>
                </Box>
                <Inventory2 color="primary" sx={{ fontSize: { xs: 22, sm: 28 }, flexShrink: 0 }} />
              </Stack>
            </Card>
          </Grid>
          <Grid size={{ xs: 4, md: 4 }}>
            <Card sx={{ p: { xs: 1.25, sm: 2 }, borderRadius: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={0.75}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: { xs: "block", sm: "none" } }}>
                    متوسط
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
                    متوسط الأصناف/قسم
                  </Typography>
                  <Typography variant="h5" fontWeight={900} sx={{ fontSize: { xs: "1.1rem", sm: undefined } }}>
                    {stats.avgPerCategory}
                  </Typography>
                </Box>
                <TrendingUp color="primary" sx={{ fontSize: { xs: 22, sm: 28 }, flexShrink: 0 }} />
              </Stack>
            </Card>
          </Grid>
        </Grid>

        <Card sx={{ mt: 2, borderRadius: 3, p: 1.5 }}>
          <Grid
            container
            sx={{
              display: { xs: "none", md: "flex" },
              px: 1,
              py: 1,
              mb: 0.6,
              bgcolor: alpha(theme.palette.primary.main, 0.06),
              borderRadius: 2,
            }}
          >
            <Grid size={{ xs: 12, md: 3 }}>
              <Typography variant="caption" fontWeight={800} color="text.secondary">
                القسم
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <Typography variant="caption" fontWeight={800} color="text.secondary">
                عدد الأصناف
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <Typography variant="caption" fontWeight={800} color="text.secondary">
                الحالة
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Typography variant="caption" fontWeight={800} color="text.secondary">
                نشط / غير نشط
              </Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 2 }}>
              <Typography variant="caption" fontWeight={800} color="text.secondary">
                حذف
              </Typography>
            </Grid>
          </Grid>

          <Stack sx={{ gap: 1 }}>
            {paginatedCategories.map((cat) => (
              <Card
                key={cat.id}
                variant="outlined"
                onClick={() => {
                  setEditTarget(cat);
                  setEditForm({ name: cat.name || "", manager: cat.manager || "" });
                  setEditError("");
                }}
                sx={{
                  borderRadius: 2,
                  p: { xs: 1, md: 1.2 },
                  cursor: "pointer",
                  overflow: "hidden",
                  "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.04) },
                }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={1}
                  sx={{
                    display: { xs: "flex", md: "none" },
                    flexWrap: "nowrap",
                    overflowX: "auto",
                    WebkitOverflowScrolling: "touch",
                    scrollbarWidth: "thin",
                    mx: -0.5,
                    px: 0.5,
                  }}
                >
                  <Box sx={{ minWidth: 96, flex: "1 1 auto", minHeight: 0 }}>
                    <Typography fontWeight={800} variant="body2" noWrap>
                      {cat.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {cat.productsCount} صنف
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={cat.status}
                    color={cat.status === "نشط" ? "success" : cat.status === "منخفض" ? "warning" : "info"}
                    variant="outlined"
                    sx={{ flexShrink: 0 }}
                  />
                  <Stack direction="row" alignItems="center" sx={{ gap: 0.25, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <Switch
                      checked={Boolean(cat.active)}
                      onChange={(e) => toggleCategoryActive(cat.id, e.target.checked)}
                      sx={unifiedToggleSx}
                    />
                    <Typography variant="caption" color={cat.active ? "success.main" : "text.secondary"} sx={{ whiteSpace: "nowrap" }}>
                      {cat.active ? "نشط" : "معطّل"}
                    </Typography>
                  </Stack>
                  <Box onClick={(e) => e.stopPropagation()} sx={{ flexShrink: 0 }}>
                    {superCashier ? (
                      <Typography variant="caption" color="text.disabled">
                        —
                      </Typography>
                    ) : (
                      <Button color="error" size="small" variant="outlined" onClick={() => deleteCategory(cat.id)} sx={{ textTransform: "none", minWidth: 0, px: 1 }}>
                        حذف
                      </Button>
                    )}
                  </Box>
                </Stack>
                <Grid container alignItems="center" sx={{ display: { xs: "none", md: "flex" } }}>
                  <Grid size={{ xs: 12, md: 3 }}>
                    <Typography fontWeight={800}>{cat.name}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, md: 2 }}>
                    <Typography>{cat.productsCount}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, md: 2 }}>
                    <Chip
                      size="small"
                      label={cat.status}
                      color={cat.status === "نشط" ? "success" : cat.status === "منخفض" ? "warning" : "info"}
                      variant="outlined"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 3 }} onClick={(e) => e.stopPropagation()}>
                    <Stack direction="row" alignItems="center" sx={{ gap: 0.5 }}>
                      <Switch
                        checked={Boolean(cat.active)}
                        onChange={(e) => toggleCategoryActive(cat.id, e.target.checked)}
                        sx={unifiedToggleSx}
                      />
                      <Typography variant="caption" color={cat.active ? "success.main" : "text.secondary"}>
                        {cat.active ? "نشط" : "غير نشط"}
                      </Typography>
                    </Stack>
                  </Grid>
                  <Grid size={{ xs: 12, md: 2 }} onClick={(e) => e.stopPropagation()}>
                    {superCashier ? (
                      <Typography variant="caption" color="text.disabled">
                        —
                      </Typography>
                    ) : (
                      <Button color="error" size="small" variant="outlined" onClick={() => deleteCategory(cat.id)} sx={{ textTransform: "none" }}>
                        حذف
                      </Button>
                    )}
                  </Grid>
                </Grid>
              </Card>
            ))}
          </Stack>
          <Stack direction="row" justifyContent="center" sx={{ mt: 1.5 }}>
            <Pagination
              count={pageCount}
              page={safePage}
              onChange={(_, value) => setPage(value)}
              color="primary"
              shape="rounded"
            />
          </Stack>
        </Card>

        <Dialog open={Boolean(editTarget)} onClose={() => setEditTarget(null)} fullWidth maxWidth="sm">
          <DialogTitle sx={{ textAlign: "right" }}>تعديل القسم</DialogTitle>
          <DialogContent sx={{ textAlign: "right" }}>
            <Stack sx={{ gap: 1.2, mt: 1 }}>
              {editError ? <Typography variant="body2" color="error.main">{editError}</Typography> : null}
              <TextField
                label="اسم القسم"
                value={editForm.name}
                onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                fullWidth
                inputProps={{ style: { textAlign: "right" } }}
              />
              <TextField
                label="اسم المسؤول"
                value={editForm.manager}
                onChange={(e) => setEditForm((p) => ({ ...p, manager: e.target.value }))}
                fullWidth
                inputProps={{ style: { textAlign: "right" } }}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setEditTarget(null)} sx={{ textTransform: "none" }}>إلغاء</Button>
            <Button variant="contained" onClick={saveCategoryEdit} sx={{ textTransform: "none", fontWeight: 800 }}>حفظ</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={openAddDialog} onClose={() => setOpenAddDialog(false)} fullWidth maxWidth="sm">
          <DialogTitle sx={{ textAlign: "right" }}>إضافة قسم جديد</DialogTitle>
          <DialogContent sx={{ textAlign: "right" }}>
            <Stack sx={{ gap: 1.2, mt: 1 }}>
              {error ? <Typography variant="body2" color="error.main">{error}</Typography> : null}
              <TextField
                label="اسم القسم"
                value={newCategory.name}
                onChange={(e) => setNewCategory((p) => ({ ...p, name: e.target.value }))}
                fullWidth
                inputProps={{ style: { textAlign: "right" } }}
              />
              <TextField
                label="اسم المسؤول"
                value={newCategory.manager}
                onChange={(e) => setNewCategory((p) => ({ ...p, manager: e.target.value }))}
                fullWidth
                inputProps={{ style: { textAlign: "right" } }}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setOpenAddDialog(false)} sx={{ textTransform: "none" }}>إلغاء</Button>
            <Button variant="contained" onClick={addCategory} sx={{ textTransform: "none", fontWeight: 800 }}>إضافة القسم</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </AdminLayout>
  );
}
