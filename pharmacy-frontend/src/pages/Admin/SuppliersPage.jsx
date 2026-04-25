import { Add, DeleteOutline, EditOutlined, LocalShipping } from "@mui/icons-material";
import {
  Alert,
  alpha,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  Switch,
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
import { useMemo, useState } from "react";
import FilterBarRow from "../../components/FilterBarRow";
import { adminPageContainerSx, adminPageSubtitleSx } from "../../utils/adminPageLayout";
import { confirmApp, showAppToast } from "../../utils/appToast";
import AdminLayout from "./AdminLayout";

const SUPPLIERS_KEY = "pharmacySuppliers_v1";
const PURCHASE_INVOICES_KEY = "purchaseInvoices";

function readSuppliers() {
  try {
    const raw = JSON.parse(localStorage.getItem(SUPPLIERS_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeSuppliers(list) {
  localStorage.setItem(SUPPLIERS_KEY, JSON.stringify(Array.isArray(list) ? list : []));
}

function readPurchases() {
  try {
    const raw = JSON.parse(localStorage.getItem(PURCHASE_INVOICES_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export default function SuppliersPage({ mode, onToggleMode }) {
  const theme = useTheme();
  const [tick, setTick] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [openDialog, setOpenDialog] = useState(false);
  const [editId, setEditId] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    contactPerson: "",
    address: "",
    notes: "",
    active: true,
  });

  const suppliers = useMemo(() => {
    return readSuppliers().sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ar"));
  }, [tick]);

  const purchases = useMemo(() => readPurchases(), [tick]);

  const supplierReport = useMemo(() => {
    const map = new Map();
    for (const s of suppliers) {
      map.set(String(s.id), {
        supplierId: String(s.id),
        name: String(s.name || "—"),
        purchasesCount: 0,
        totalAmount: 0,
        lastPurchaseAt: "",
      });
    }
    for (const row of purchases) {
      const sid = String(row.supplierId || "");
      const nameFallback = String(row.supplier || "مورد غير محدد");
      const key = sid || `name:${nameFallback}`;
      if (!map.has(key)) {
        map.set(key, { supplierId: sid, name: nameFallback, purchasesCount: 0, totalAmount: 0, lastPurchaseAt: "" });
      }
      const r = map.get(key);
      r.purchasesCount += 1;
      r.totalAmount += Number(row.total || 0);
      const dt = String(row.purchasedAt || "");
      if (dt && (!r.lastPurchaseAt || dt > r.lastPurchaseAt)) r.lastPurchaseAt = dt;
    }
    return [...map.values()].sort((a, b) => b.totalAmount - a.totalAmount);
  }, [suppliers, purchases]);

  const filteredSuppliers = useMemo(() => {
    const q = String(search || "").trim().toLowerCase();
    return suppliers.filter((s) => {
      if (statusFilter === "active" && s.active === false) return false;
      if (statusFilter === "inactive" && s.active !== false) return false;
      if (!q) return true;
      return [s.name, s.phone, s.contactPerson, s.address, s.notes].some((f) => String(f || "").toLowerCase().includes(q));
    });
  }, [suppliers, search, statusFilter]);

  const stats = useMemo(() => {
    const activeSuppliers = suppliers.filter((s) => s.active !== false).length;
    const linkedInvoices = purchases.filter((p) => String(p.supplier || "").trim() || String(p.supplierId || "").trim()).length;
    const totalPurchaseSpend = purchases.reduce((sum, p) => sum + Number(p.total || 0), 0);
    const top = supplierReport[0] || null;
    return { total: suppliers.length, active: activeSuppliers, linkedInvoices, totalPurchaseSpend, top };
  }, [suppliers, purchases, supplierReport]);

  const resetForm = () => {
    setEditId("");
    setError("");
    setForm({ name: "", phone: "", contactPerson: "", address: "", notes: "", active: true });
  };

  const openAddDialog = () => {
    resetForm();
    setOpenDialog(true);
  };

  const openEditDialog = (supplier) => {
    setError("");
    setEditId(String(supplier.id));
    setForm({
      name: String(supplier.name || ""),
      phone: String(supplier.phone || ""),
      contactPerson: String(supplier.contactPerson || ""),
      address: String(supplier.address || ""),
      notes: String(supplier.notes || ""),
      active: supplier.active !== false,
    });
    setOpenDialog(true);
  };

  const saveSupplier = () => {
    setError("");
    const name = String(form.name || "").trim();
    if (!name) {
      setError("اسم المورد مطلوب");
      return;
    }
    const list = readSuppliers();
    const duplicate = list.find((s) => String(s.name || "").trim().toLowerCase() === name.toLowerCase() && String(s.id) !== String(editId));
    if (duplicate) {
      setError("اسم المورد موجود مسبقاً");
      return;
    }
    const now = new Date().toISOString();
    const payload = {
      name,
      phone: String(form.phone || "").trim(),
      contactPerson: String(form.contactPerson || "").trim(),
      address: String(form.address || "").trim(),
      notes: String(form.notes || "").trim(),
      active: form.active !== false,
      updatedAt: now,
    };
    const next =
      editId
        ? list.map((s) => (String(s.id) === String(editId) ? { ...s, ...payload } : s))
        : [{ id: `SUP-${Date.now()}`, createdAt: now, ...payload }, ...list];
    writeSuppliers(next);
    setTick((x) => x + 1);
    setOpenDialog(false);
    showAppToast(editId ? "تم تحديث المورد" : "تم إضافة المورد", "success");
  };

  const deleteSupplier = async (supplier) => {
    const ok = await confirmApp({
      title: "حذف المورد",
      text: `هل تريد حذف المورد ${supplier.name}؟`,
      icon: "warning",
      confirmText: "نعم، حذف",
    });
    if (!ok) return;
    const list = readSuppliers();
    writeSuppliers(list.filter((s) => String(s.id) !== String(supplier.id)));
    setTick((x) => x + 1);
    showAppToast("تم حذف المورد", "success");
  };

  return (
    <AdminLayout mode={mode} onToggleMode={onToggleMode}>
      <Box sx={adminPageContainerSx}>
        <Stack direction={{ xs: "column", md: "row" }} alignItems={{ xs: "flex-start", md: "center" }} justifyContent="space-between" sx={{ mb: 2, gap: 1 }}>
          <Box>
            <Typography variant="h5" fontWeight={900}>
              الموردين
            </Typography>
            <Typography sx={adminPageSubtitleSx}>إدارة الموردين وربط كل عمليات الشراء بهم بشكل رسمي.</Typography>
          </Box>
          <Button variant="contained" startIcon={<Add />} onClick={openAddDialog} sx={{ textTransform: "none", fontWeight: 800 }}>
            إضافة مورد
          </Button>
        </Stack>

        <Grid container spacing={1.2} sx={{ mb: 1.5 }}>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined" sx={{ p: 1.2, borderRadius: 2.5 }}>
              <Typography variant="caption" color="text.secondary">إجمالي الموردين</Typography>
              <Typography fontWeight={900} variant="h6">{stats.total}</Typography>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined" sx={{ p: 1.2, borderRadius: 2.5 }}>
              <Typography variant="caption" color="text.secondary">الموردون النشطون</Typography>
              <Typography fontWeight={900} variant="h6">{stats.active}</Typography>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined" sx={{ p: 1.2, borderRadius: 2.5 }}>
              <Typography variant="caption" color="text.secondary">فواتير شراء مرتبطة</Typography>
              <Typography fontWeight={900} variant="h6">{stats.linkedInvoices}</Typography>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Card variant="outlined" sx={{ p: 1.2, borderRadius: 2.5 }}>
              <Typography variant="caption" color="text.secondary">إجمالي مشتريات</Typography>
              <Typography fontWeight={900} variant="h6">{stats.totalPurchaseSpend.toFixed(2)} ش</Typography>
            </Card>
          </Grid>
        </Grid>

        {stats.top ? (
          <Alert icon={<LocalShipping />} severity="info" sx={{ mb: 1.5, borderRadius: 2 }}>
            أعلى مورد حسب المشتريات: <b>{stats.top.name}</b> — {Number(stats.top.totalAmount || 0).toFixed(2)} شيكل
          </Alert>
        ) : null}

        <FilterBarRow sx={{ mb: 1.2 }}>
          <TextField size="small" fullWidth placeholder="بحث باسم المورد، الهاتف، الشخص المسؤول..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <TextField size="small" select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ minWidth: 170 }}>
            <MenuItem value="all">كل الحالات</MenuItem>
            <MenuItem value="active">نشط فقط</MenuItem>
            <MenuItem value="inactive">غير نشط فقط</MenuItem>
          </TextField>
        </FilterBarRow>

        <TableContainer component={Card} variant="outlined" sx={{ borderRadius: 2.5, mb: 1.5 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
                <TableCell align="center" sx={{ fontWeight: 900 }}>المورد</TableCell>
                <TableCell align="center" sx={{ fontWeight: 900 }}>الهاتف</TableCell>
                <TableCell align="center" sx={{ fontWeight: 900 }}>المسؤول</TableCell>
                <TableCell align="center" sx={{ fontWeight: 900 }}>الحالة</TableCell>
                <TableCell align="center" sx={{ fontWeight: 900 }}>عدد الفواتير</TableCell>
                <TableCell align="center" sx={{ fontWeight: 900 }}>إجمالي الشراء</TableCell>
                <TableCell align="center" sx={{ fontWeight: 900 }}>إجراءات</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredSuppliers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 3 }}>
                    <Typography color="text.secondary">لا يوجد موردون مطابقون</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredSuppliers.map((s) => {
                  const rep = supplierReport.find((r) => r.supplierId && String(r.supplierId) === String(s.id))
                    || supplierReport.find((r) => !r.supplierId && String(r.name || "").trim() === String(s.name || "").trim());
                  const count = Number(rep?.purchasesCount || 0);
                  const total = Number(rep?.totalAmount || 0);
                  return (
                    <TableRow key={s.id} hover>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>{s.name}</TableCell>
                      <TableCell align="center">{s.phone || "—"}</TableCell>
                      <TableCell align="center">{s.contactPerson || "—"}</TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          color={s.active === false ? "default" : "success"}
                          label={s.active === false ? "غير نشط" : "نشط"}
                          variant={s.active === false ? "outlined" : "filled"}
                        />
                      </TableCell>
                      <TableCell align="center">{count}</TableCell>
                      <TableCell align="center">{total.toFixed(2)} ش</TableCell>
                      <TableCell align="center">
                        <Stack direction="row" justifyContent="center" spacing={0.6}>
                          <IconButton size="small" color="primary" onClick={() => openEditDialog(s)} aria-label="تعديل">
                            <EditOutlined fontSize="small" />
                          </IconButton>
                          <IconButton size="small" color="error" onClick={() => deleteSupplier(s)} aria-label="حذف">
                            <DeleteOutline fontSize="small" />
                          </IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <Card variant="outlined" sx={{ borderRadius: 2.5, p: 1.5 }}>
          <Typography fontWeight={900} sx={{ mb: 1 }}>تقرير الموردين</Typography>
          <Divider sx={{ mb: 1 }} />
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>المورد</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>عدد الفواتير</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>الإجمالي</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>آخر شراء</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {supplierReport.length === 0 ? (
                  <TableRow>
                    <TableCell align="center" colSpan={4} sx={{ py: 2.5 }}>
                      <Typography color="text.secondary">لا توجد بيانات شراء لعرض التقرير</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  supplierReport.map((r, idx) => (
                    <TableRow key={`${r.supplierId || r.name}-${idx}`}>
                      <TableCell align="center">{r.name}</TableCell>
                      <TableCell align="center">{r.purchasesCount}</TableCell>
                      <TableCell align="center">{Number(r.totalAmount || 0).toFixed(2)} شيكل</TableCell>
                      <TableCell align="center">
                        {r.lastPurchaseAt ? new Date(r.lastPurchaseAt).toLocaleString("en-GB") : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>

        <Dialog open={openDialog} onClose={() => setOpenDialog(false)} fullWidth maxWidth="sm">
          <DialogTitle sx={{ textAlign: "right" }}>{editId ? "تعديل المورد" : "إضافة مورد جديد"}</DialogTitle>
          <DialogContent sx={{ textAlign: "right" }}>
            {error ? (
              <Alert severity="error" sx={{ mb: 1.2 }}>{error}</Alert>
            ) : null}
            <Grid container spacing={1.1} sx={{ mt: 0.1 }}>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="اسم المورد"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="رقم الهاتف"
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="الشخص المسؤول"
                  value={form.contactPerson}
                  onChange={(e) => setForm((p) => ({ ...p, contactPerson: e.target.value }))}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="العنوان"
                  value={form.address}
                  onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="ملاحظات"
                  multiline
                  minRows={2}
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="body2">الحالة (نشط)</Typography>
                  <Switch checked={form.active !== false} onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))} />
                </Stack>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setOpenDialog(false)} sx={{ textTransform: "none" }}>إلغاء</Button>
            <Button variant="contained" onClick={saveSupplier} sx={{ textTransform: "none", fontWeight: 800 }}>
              حفظ
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </AdminLayout>
  );
}
