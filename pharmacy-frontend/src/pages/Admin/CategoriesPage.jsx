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
import { useEffect, useMemo, useState, useRef } from "react";
import { Axios } from "../../Api/Axios";
import FilterBarRow from "../../components/FilterBarRow";
import { adminPageContainerSx, adminPageSubtitleSx, adminPageTitleRowSx } from "../../utils/adminPageLayout";
import AdminLayout from "./AdminLayout";
import { confirmApp, showAppToast } from "../../utils/appToast";
import { getStoredUser, isSuperCashier } from "../../utils/userRoles";
import {
  PHARMACY_ADMIN_CATEGORIES_SYNCED,
  persistSalesCategories,
} from "../../utils/backendCategoriesSync";

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

const ROWS_PER_PAGE = 5;

function getStoredCategories() {
  return [];
}

export default function CategoriesPage({ mode, onToggleMode, embedded = false, onDataChanged }) {
  const theme = useTheme();
  const superCashier = isSuperCashier(getStoredUser());
  const [categories, setCategories] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const isMounted = useRef(false);
  
  const fetchApiData = async () => {
    try {
      const [catsRes, productsRes] = await Promise.all([
        Axios.get("categories/main", { 
          params: { 
            scope: "purchase",
            include_inactive: 1  // ← أضف هذا لجلب الأقسام المعطلة أيضاً
          } 
        }),
        Axios.get("products", { params: { per_page: 100, include_inactive: 1, scope: "all" } }),
      ]);
      const cats = catsRes?.data?.success && Array.isArray(catsRes.data.data)
        ? catsRes.data.data.map((c) => ({
            id: c.id,
            name: c.name,
            productsCount: Number(c.products_count ?? 0),
            status: c.is_active === false ? "معطّل" : "نشط",
            active: c.is_active !== false,
            createdAt: c.created_at || new Date().toISOString(),
          }))
        : [];
      const products = productsRes?.data?.success && Array.isArray(productsRes.data.data) ? productsRes.data.data : [];
      setCategories(cats);
      setAllProducts(products);
      persistSalesCategories(cats);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };
  
  // ✅ الحل: استخدام useRef لمنع التكرار + إزالة المستمع لتجنب الحلقة اللانهائية
  useEffect(() => {
    if (isMounted.current) return;
    isMounted.current = true;
    
    // جلب البيانات مرة واحدة عند تحميل الصفحة
    fetchApiData();
    
    // ✅ اختيارياً: إذا أردت الاستماع للتغييرات من مكان آخر، استخدم setTimeout لتجنب الحلقة
    const handleReload = () => {
      setTimeout(() => fetchApiData(), 100);
    };
    
    window.addEventListener(PHARMACY_ADMIN_CATEGORIES_SYNCED, handleReload);
    
    return () => {
      window.removeEventListener(PHARMACY_ADMIN_CATEGORIES_SYNCED, handleReload);
    };
  }, []);
  
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: "" });
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({ name: "" });
  const [editError, setEditError] = useState("");
  
  const categoryProductCountMap = useMemo(() => {
    const map = new Map();
    for (const cat of categories) {
      map.set(cat.id, 0);
    }
    for (const p of allProducts) {
      if (p.category_id && map.has(p.category_id)) {
        map.set(p.category_id, (map.get(p.category_id) || 0) + 1);
      }
    }
    return map;
  }, [allProducts, categories]);
  
  const productsInEditCategory = useMemo(() => {
    if (!editTarget?.id) return [];
    return allProducts.filter((p) => String(p.category_id) === String(editTarget.id));
  }, [allProducts, editTarget]);

  const addCategory = async () => {
    setError("");
    if (!newCategory.name) {
      setError("يرجى إدخال اسم القسم");
      return;
    }
    if (categories.some((c) => c.name === newCategory.name)) {
      setError("اسم القسم موجود مسبقًا");
      return;
    }
    await Axios.post("categories", {
      name: newCategory.name,
      scope: "purchase",
      is_main: true,
      parent_id: null,
      is_active: true,
    });
    await fetchApiData();
    onDataChanged?.();
    setNewCategory({ name: "" });
    setOpenAddDialog(false);
    showAppToast("تم إضافة القسم بنجاح", "success");
  };

  const toggleCategoryActive = async (id, checked) => {
    await Axios.put(`categories/${id}`, { is_active: checked });
    await fetchApiData();
    onDataChanged?.();
    showAppToast(checked ? "تم تفعيل القسم" : "تم تعطيل القسم", "info");
  };

  const saveCategoryEdit = async () => {
    setEditError("");
    if (!editTarget) return;
    const name = editForm.name.trim();
    if (!name) {
      setEditError("اسم القسم مطلوب");
      return;
    }
    if (categories.some((c) => c.id !== editTarget.id && c.name === name)) {
      setEditError("اسم القسم مستخدم مسبقًا");
      return;
    }
    await Axios.put(`categories/${editTarget.id}`, { name });
    await fetchApiData();
    onDataChanged?.();
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
    await Axios.delete(`categories/${id}`);
    await fetchApiData();
    onDataChanged?.();
    showAppToast("تم حذف القسم بنجاح", "success");
  };

  const filteredSortedCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = categories.filter((cat) => {
      const matchesSearch = !q || String(cat.name || "").toLowerCase().includes(q);
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
    let totalProducts = 0;
    for (const cat of filteredSortedCategories) {
      totalProducts += categoryProductCountMap.get(cat.id) || 0;
    }
    return {
      totalCategories: filteredSortedCategories.length,
      totalProducts,
      avgPerCategory: filteredSortedCategories.length ? Math.round(totalProducts / filteredSortedCategories.length) : 0,
    };
  }, [filteredSortedCategories, categoryProductCountMap]);

  const inner = (
      <Box sx={embedded ? { width: "100%", minWidth: 0 } : adminPageContainerSx}>
        {!embedded ? (
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
        ) : (
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1.5 }}>
            <Button variant="contained" startIcon={<Add />} onClick={() => setOpenAddDialog(true)} sx={{ textTransform: "none", fontWeight: 800 }}>
              إضافة قسم
            </Button>
          </Stack>
        )}

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
                  placeholder="ابحث باسم القسم..."
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
            <Grid size={{ xs: 12, md: 4 }}>
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
            <Grid size={{ xs: 12, md: 2 }}>
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
                  setEditForm({ name: cat.name || "" });
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
                      {categoryProductCountMap.get(cat.id) || 0} صنف
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
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Typography fontWeight={800}>{cat.name}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12, md: 2 }}>
                    {categoryProductCountMap.get(cat.id) || 0}
                  </Grid>
                  <Grid size={{ xs: 12, md: 2 }}>
                    <Chip
                      size="small"
                      label={cat.status}
                      color={cat.status === "نشط" ? "success" : cat.status === "منخفض" ? "warning" : "info"}
                      variant="outlined"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 2}} onClick={(e) => e.stopPropagation()}>
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
              <Card
                variant="outlined"
                sx={{
                  p: 1.2,
                  borderRadius: 2,
                  borderColor: alpha(theme.palette.primary.main, 0.25),
                  bgcolor: alpha(theme.palette.primary.main, 0.04),
                }}
              >
                <Typography variant="subtitle2" fontWeight={900}>
                  الأصناف داخل هذا القسم ({productsInEditCategory.length})
                </Typography>
                <Stack sx={{ mt: 0.8, maxHeight: 180, overflowY: "auto", gap: 0.5 }}>
                  {productsInEditCategory.length === 0 ? (
                    <Typography variant="caption" color="text.secondary">
                      لا توجد أصناف مرتبطة بهذا القسم حالياً.
                    </Typography>
                  ) : (
                    productsInEditCategory.map((p) => (
                      <Typography key={`${p.id}-${p.name}`} variant="caption" sx={{ fontWeight: 700 }}>
                        • {String(p.name || "صنف")}
                      </Typography>
                    ))
                  )}
                </Stack>
              </Card>
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
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setOpenAddDialog(false)} sx={{ textTransform: "none" }}>إلغاء</Button>
            <Button variant="contained" onClick={addCategory} sx={{ textTransform: "none", fontWeight: 800 }}>إضافة القسم</Button>
          </DialogActions>
        </Dialog>
      </Box>
  );

  if (embedded) {
    return inner;
  }
  return (
    <AdminLayout mode={mode} onToggleMode={onToggleMode}>
      {inner}
    </AdminLayout>
  );
}