import { Add, DeleteOutline, LocalShipping, ReceiptLong, Storefront } from "@mui/icons-material";
import {
  Alert,
  alpha,
  Avatar,
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
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Pagination,
  Select,
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
import { useCallback, useMemo, useState } from "react";
import FilterBarRow from "../../components/FilterBarRow";
import { adminPageContainerSx, adminPageSubtitleSx } from "../../utils/adminPageLayout";
import AdminLayout from "./AdminLayout";
import { confirmApp, showAppToast } from "../../utils/appToast";
import { productDisplayName } from "../../utils/productDisplayName";
import { getStoredUser, isSuperCashier, purchaserDisplayName } from "../../utils/userRoles";

const ROWS_PER_PAGE = 5;
const PURCHASE_INVOICES_KEY = "purchaseInvoices";
const PRODUCTS_KEY = "adminProducts";
const STORE_BALANCE_KEY = "storeBalance";
const NOTIFICATIONS_KEY = "systemNotifications";

function normalizeOneDecimal(value) {
  const cleaned = String(value ?? "").replace(/[^\d.]/g, "");
  const num = Number(cleaned);
  if (Number.isNaN(num)) return "";
  return (Math.round(num * 10) / 10).toString();
}

const saleTypeLabelMap = {
  pill: "بالحبة",
  strip: "شريط كامل",
  bottle: "قزازة",
  box: "علبة",
  sachet: "كيس",
};

function formatOneDecimal(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return "0.0";
  return x.toFixed(1);
}

export default function PurchasesPage({ mode, onToggleMode }) {
  const theme = useTheme();
  const superCashier = isSuperCashier(getStoredUser());
  const currentUser = getStoredUser();
  const [page, setPage] = useState(1);
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailPurchase, setDetailPurchase] = useState(null);
  const [listVersion, setListVersion] = useState(0);
  const [newPurchaseOpen, setNewPurchaseOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("all");
  const [purchaseLines, setPurchaseLines] = useState([]);
  const [newPurchaseError, setNewPurchaseError] = useState("");
  const purchaseRows = useMemo(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(PURCHASE_INVOICES_KEY));
      if (Array.isArray(raw) && raw.length) return raw;
    } catch {
      // ignore malformed storage
    }
    return [];
  }, [listVersion]);

  const purchaseStats = useMemo(() => {
    const rows = purchaseRows;
    const suppliers = new Set(rows.map((r) => String(r.supplier || "").trim()).filter(Boolean));
    const review = rows.filter((r) => String(r.status || "") === "مراجعة").length;
    const returned = rows.filter((r) => String(r.status || "") === "مرجع").length;
    return { count: rows.length, suppliers: suppliers.size, review, returned };
  }, [purchaseRows]);

  const processPurchaseReturn = useCallback(
    async (row) => {
      if (!row?.id) return;
      if (String(row.status || "") === "مرجع") {
        showAppToast("هذه القسيمة مُرجَعة مسبقًا", "info");
        return;
      }
      const msg = superCashier
        ? `تأكيد إرجاع قسيمة الشراء ${row.id}؟ سيتم عكس الكميات من المخزون (يُحدَّث الصندوق من النظام دون عرض المبلغ هنا).`
        : `تأكيد إرجاع قسيمة الشراء ${row.id}؟ سيتم خصم الكميات من المخزون وإعادة المبلغ للصندوق.`;
      const ok = await confirmApp({
        title: "إرجاع قسيمة الشراء",
        text: msg,
        icon: "question",
        confirmText: "نعم، إرجاع",
      });
      if (!ok) return;
      try {
        const list = JSON.parse(localStorage.getItem(PURCHASE_INVOICES_KEY));
        if (!Array.isArray(list)) throw new Error("no list");
        const idx = list.findIndex((p) => p.id === row.id);
        if (idx < 0) throw new Error("not found");
        const inv = list[idx];
        if (String(inv.status || "") === "مرجع") return;

        const productsRaw = localStorage.getItem(PRODUCTS_KEY);
        let products = [];
        try {
          const parsed = JSON.parse(productsRaw || "[]");
          products = Array.isArray(parsed) ? parsed : [];
        } catch {
          products = [];
        }
        const nextProducts = products.map((p) => {
          const line = (Array.isArray(inv.items) ? inv.items : []).find((it) => {
            const pid = Number(it.productId);
            if (Number.isFinite(pid) && pid > 0 && Number(p.id) === pid) return true;
            if (String(it.name || "").trim() === productDisplayName(p)) return true;
            if (
              !String((it.variantLabel ?? "").trim()) &&
              String(it.name || "").trim() === String(p.name || "").trim()
            )
              return true;
            return false;
          });
          if (!line) return p;
          const q = Number(line.qty ?? line.qtyPaid ?? 0) + Number(line.qtyBonus ?? 0);
          if (!q) return p;
          const newQty = Math.max(0, Number((Number(p.qty || 0) - q).toFixed(1)));
          return { ...p, qty: newQty };
        });
        localStorage.setItem(PRODUCTS_KEY, JSON.stringify(nextProducts));

        let balance = { total: 0, cash: 0, app: 0 };
        try {
          const parsed = JSON.parse(localStorage.getItem(STORE_BALANCE_KEY));
          if (parsed && typeof parsed === "object") {
            balance = {
              total: Number(parsed.total || 0),
              cash: Number(parsed.cash || 0),
              app: Number(parsed.app || 0),
            };
          }
        } catch {
          // ignore
        }
        const refund = Number(inv.total || 0);
        const nextBal = {
          ...balance,
          total: Number((balance.total + refund).toFixed(2)),
          cash: Number((balance.cash + refund).toFixed(2)),
          lastOperation: "purchase_return",
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(STORE_BALANCE_KEY, JSON.stringify(nextBal));

        list[idx] = {
          ...inv,
          status: "مرجع",
          returnedAt: new Date().toISOString(),
          returnedBy: purchaserDisplayName(currentUser),
        };
        localStorage.setItem(PURCHASE_INVOICES_KEY, JSON.stringify(list));
        setListVersion((v) => v + 1);
        setDetailPurchase(null);
        showAppToast(
          superCashier ? "تم إرجاع القسيمة وتحديث المخزون" : "تم إرجاع القسيمة وتحديث المخزون والصندوق",
          "success",
        );
      } catch {
        showAppToast("تعذر إرجاع القسيمة", "error");
      }
    },
    [currentUser, superCashier],
  );
  const filteredRows = useMemo(() => {
    const q = purchaseSearch.trim().toLowerCase();
    const now = Date.now();
    return purchaseRows
      .filter((row) => {
        const matchesSearch =
          !q ||
          String(row.id).toLowerCase().includes(q) ||
          String(row.purchasedBy || "").toLowerCase().includes(q) ||
          String(row.supplier || "").toLowerCase().includes(q);
        const matchesStatus = statusFilter === "all" || String(row.status || "مكتمل") === statusFilter;
        if (dateFilter === "all") return matchesSearch && matchesStatus;
        const atMs = new Date(row.purchasedAt || 0).getTime();
        if (!atMs) return false;
        const diffMs = now - atMs;
        const dayMs = 24 * 60 * 60 * 1000;
        const matchesDate =
          (dateFilter === "today" && diffMs <= dayMs) ||
          (dateFilter === "7d" && diffMs <= 7 * dayMs) ||
          (dateFilter === "30d" && diffMs <= 30 * dayMs);
        return matchesSearch && matchesStatus && matchesDate;
      })
      .sort((a, b) => new Date(b.purchasedAt || 0).getTime() - new Date(a.purchasedAt || 0).getTime());
  }, [purchaseRows, purchaseSearch, dateFilter, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const rows = useMemo(() => {
    const start = (safePage - 1) * ROWS_PER_PAGE;
    return filteredRows.slice(start, start + ROWS_PER_PAGE);
  }, [filteredRows, safePage]);

  const catalogProducts = useMemo(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(PRODUCTS_KEY));
      return Array.isArray(raw) ? raw.filter((p) => p.active !== false) : [];
    } catch {
      return [];
    }
  }, [listVersion, newPurchaseOpen]);

  const catalogCategories = useMemo(() => {
    const s = new Set();
    catalogProducts.forEach((p) => {
      const c = String(p.category || "").trim();
      if (c) s.add(c);
    });
    return [...s].sort((a, b) => a.localeCompare(b, "ar"));
  }, [catalogProducts]);

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    return catalogProducts.filter((p) => {
      const catOk = catalogCategory === "all" || String(p.category || "") === catalogCategory;
      if (!catOk) return false;
      if (!q) return true;
      const dn = productDisplayName(p).toLowerCase();
      return (
        dn.includes(q) ||
        String(p.name || "").toLowerCase().includes(q) ||
        String(p.variantLabel || "").toLowerCase().includes(q) ||
        String(p.category || "").toLowerCase().includes(q) ||
        String(p.id).includes(q)
      );
    });
  }, [catalogProducts, catalogSearch, catalogCategory]);

  const newPurchaseTreasury = useMemo(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_BALANCE_KEY));
      if (raw && typeof raw === "object") return Number(raw.total || 0);
    } catch {
      // ignore
    }
    return 0;
  }, [listVersion, newPurchaseOpen]);

  const newPurchaseTotalCost = useMemo(() => {
    let sum = 0;
    for (const line of purchaseLines) {
      const paid = Number(normalizeOneDecimal(line.paidQty)) || Number(line.paidQty) || 0;
      const unit = Number(normalizeOneDecimal(line.unitPrice)) || Number(line.unitPrice) || 0;
      sum += paid * unit;
    }
    return sum;
  }, [purchaseLines]);

  const openNewPurchaseDialog = () => {
    setCatalogSearch("");
    setCatalogCategory("all");
    setPurchaseLines([]);
    setNewPurchaseError("");
    setNewPurchaseOpen(true);
  };

  const addProductToPurchaseLines = (product) => {
    setNewPurchaseError("");
    setPurchaseLines((prev) => {
      if (prev.some((l) => Number(l.productId) === Number(product.id))) {
        showAppToast("الصنف مضاف بالفعل — عدّل الكمية من الجدول", "info");
        return prev;
      }
      return [
        ...prev,
        {
          lineKey: `L-${product.id}-${Date.now()}`,
          productId: product.id,
          paidQty: "1",
          bonusQty: "",
          unitPrice: String(product.price ?? ""),
        },
      ];
    });
  };

  const updatePurchaseLine = (lineKey, patch) => {
    setPurchaseLines((prev) => prev.map((l) => (l.lineKey === lineKey ? { ...l, ...patch } : l)));
  };

  const removePurchaseLine = (lineKey) => {
    setPurchaseLines((prev) => prev.filter((l) => l.lineKey !== lineKey));
  };

  const confirmNewPurchase = () => {
    setNewPurchaseError("");
    if (!purchaseLines.length) {
      setNewPurchaseError("أضف صنفًا واحدًا على الأقل من القائمة");
      return;
    }
    let products = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(PRODUCTS_KEY));
      products = Array.isArray(parsed) ? parsed : [];
    } catch {
      products = [];
    }
    const invoiceItems = [];
    let totalCost = 0;
    for (const line of purchaseLines) {
      const p = products.find((x) => Number(x.id) === Number(line.productId));
      if (!p) {
        setNewPurchaseError(`صنف غير موجود في المخزون (معرّف ${line.productId})`);
        return;
      }
      const paid = Number(normalizeOneDecimal(line.paidQty)) || 0;
      const bonus = Number(normalizeOneDecimal(line.bonusQty)) || 0;
      const unit = Number(normalizeOneDecimal(line.unitPrice)) || 0;
      if (paid <= 0 && bonus <= 0) {
        setNewPurchaseError(`أدخل كمية مشتراة لـ ${productDisplayName(p)}`);
        return;
      }
      if (paid <= 0 && bonus > 0) {
        setNewPurchaseError(`البونص مع مشتراة فقط — ${productDisplayName(p)}`);
        return;
      }
      if (unit <= 0) {
        setNewPurchaseError(`أدخل سعر شراء وحدة صحيح لـ ${productDisplayName(p)}`);
        return;
      }
      const lineCost = paid * unit;
      totalCost += lineCost;
      const stockAdd = paid + bonus;
      const vLabel = String(p.variantLabel || "").trim();
      invoiceItems.push({
        productId: p.id,
        name: productDisplayName(p),
        ...(vLabel ? { variantLabel: vLabel } : {}),
        category: p.category,
        saleType: p.saleType,
        qtyPaid: paid,
        qtyBonus: bonus,
        qty: stockAdd,
        unitPrice: unit,
        total: Number(lineCost.toFixed(2)),
      });
    }
    if (totalCost <= 0) {
      setNewPurchaseError("إجمالي الشراء غير صالح");
      return;
    }
    if (newPurchaseTreasury < totalCost) {
      setNewPurchaseError(
        superCashier
          ? "لا يمكن إتمام العملية — راجع المدير لتغذية الصندوق."
          : "لا يكفي المال في الخزنة لإتمام الشراء",
      );
      return;
    }
    const buyerLabel = purchaserDisplayName(currentUser);
    const nextProducts = products.map((p) => {
      const line = purchaseLines.find((l) => Number(l.productId) === Number(p.id));
      if (!line) return p;
      const paid = Number(normalizeOneDecimal(line.paidQty)) || 0;
      const bonus = Number(normalizeOneDecimal(line.bonusQty)) || 0;
      const add = paid + bonus;
      if (!add) return p;
      return { ...p, qty: Number((Number(p.qty || 0) + add).toFixed(1)) };
    });
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(nextProducts));

    let balance = { total: 0, cash: 0, app: 0 };
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_BALANCE_KEY));
      if (parsed && typeof parsed === "object") {
        balance = {
          total: Number(parsed.total || 0),
          cash: Number(parsed.cash || 0),
          app: Number(parsed.app || 0),
        };
      }
    } catch {
      // ignore
    }
    const remainingAfterCash = Math.max(0, totalCost - balance.cash);
    const nextCash = Math.max(0, balance.cash - totalCost);
    const nextApp = Math.max(0, balance.app - remainingAfterCash);
    const nextBalance = {
      ...balance,
      total: Math.max(0, balance.total - totalCost),
      cash: nextCash,
      app: nextApp,
      lastOperation: "purchase",
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORE_BALANCE_KEY, JSON.stringify(nextBalance));

    const purchaseInvoice = {
      id: `PO-${Date.now()}`,
      purchasedBy: buyerLabel,
      purchasedByUsername: currentUser?.username || "",
      purchasedByRole: currentUser?.role || "admin",
      supplier: "مورد عام",
      status: "مكتمل",
      paymentMethod: "cash",
      purchasedAt: new Date().toISOString(),
      total: Number(totalCost.toFixed(2)),
      items: invoiceItems,
    };
    try {
      const existing = JSON.parse(localStorage.getItem(PURCHASE_INVOICES_KEY));
      const nextPurchases = Array.isArray(existing) ? [purchaseInvoice, ...existing] : [purchaseInvoice];
      localStorage.setItem(PURCHASE_INVOICES_KEY, JSON.stringify(nextPurchases));
    } catch {
      localStorage.setItem(PURCHASE_INVOICES_KEY, JSON.stringify([purchaseInvoice]));
    }
    const notification = {
      id: `NTF-${Date.now()}`,
      type: "purchase",
      prefCategory: "purchase",
      read: false,
      title: "تم تسجيل شراء جديد",
      message: superCashier
        ? `توريد من المخزون بواسطة ${buyerLabel} — ${invoiceItems.length} صنف`
        : `فاتورة ${purchaseInvoice.id} بقيمة ${purchaseInvoice.total.toFixed(1)} شيكل`,
      details: invoiceItems.map((it) => it.name).join("، "),
      createdAt: new Date().toISOString(),
      fromManagement: true,
      managementLabel:
        currentUser?.role === "admin"
          ? "إدارة النظام"
          : currentUser?.role === "super_cashier"
            ? "إدارة التوريد (سوبر كاشير)"
            : "النظام",
    };
    try {
      const existingNotifications = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY));
      const nextNotifications = Array.isArray(existingNotifications)
        ? [notification, ...existingNotifications]
        : [notification];
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(nextNotifications));
    } catch {
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify([notification]));
    }
    setListVersion((v) => v + 1);
    setNewPurchaseOpen(false);
    showAppToast("تم تسجيل عملية الشراء وتحديث المخزون", "success");
  };

  return (
    <AdminLayout mode={mode} onToggleMode={onToggleMode}>
      <Box sx={adminPageContainerSx}>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "flex-start" }}
          sx={{ mb: 2, gap: 1.5 }}
        >
          <Box>
            <Typography variant="h5" fontWeight={900}>
              إدارة المشتريات
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={adminPageSubtitleSx}>
              لوحة منظمة لمتابعة طلبات الشراء والموردين وتكلفة التوريد
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={openNewPurchaseDialog}
            sx={{ textTransform: "none", fontWeight: 800, alignSelf: { xs: "stretch", sm: "center" } }}
          >
            شراء من أصناف المخزون
          </Button>
        </Stack>
        <Card
          sx={{
            p: 1.6,
            mb: 2,
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
              placeholder="ابحث برقم فاتورة الشراء أو اسم المنفذ..."
              value={purchaseSearch}
              onChange={(e) => {
                setPurchaseSearch(e.target.value);
                setPage(1);
              }}
              sx={{ flex: "1 1 200px", minWidth: 160 }}
            />
            <Select
              size="small"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setPage(1);
              }}
              sx={{ minWidth: 148, flex: "0 0 auto" }}
            >
              <MenuItem value="all">كل التواريخ</MenuItem>
              <MenuItem value="today">اليوم</MenuItem>
              <MenuItem value="7d">آخر 7 أيام</MenuItem>
              <MenuItem value="30d">آخر 30 يوم</MenuItem>
            </Select>
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
              <MenuItem value="مكتمل">مكتمل</MenuItem>
              <MenuItem value="مراجعة">مراجعة</MenuItem>
            </Select>
            <Button
              variant="outlined"
              onClick={() => {
                setPurchaseSearch("");
                setDateFilter("all");
                setStatusFilter("all");
                setPage(1);
              }}
              sx={{ textTransform: "none", fontWeight: 700, flex: "0 0 auto", whiteSpace: "nowrap" }}
            >
              إعادة الضبط
            </Button>
          </FilterBarRow>
        </Card>

        <Grid container spacing={2}>
          {(superCashier
            ? [
                { title: "إجمالي القسائم المسجّلة", value: String(purchaseStats.count), icon: <ReceiptLong /> },
                { title: "موردين مختلفين", value: String(purchaseStats.suppliers), icon: <Storefront /> },
                { title: "قسائم مُرجَعة", value: String(purchaseStats.returned), icon: <LocalShipping /> },
              ]
            : [
                { title: "طلبات هذا الأسبوع", value: "24", icon: <ReceiptLong /> },
                { title: "موردين نشطين", value: "9", icon: <Storefront /> },
                { title: "شحنات قيد الوصول", value: "5", icon: <LocalShipping /> },
              ]
          ).map((item) => (
            <Grid key={item.title} size={{ xs: 12, md: 4 }}>
              <Card sx={{ p: 2, borderRadius: 3, border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}` }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="body2" color="text.secondary">{item.title}</Typography>
                    <Typography variant="h5" fontWeight={900}>{item.value}</Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: "primary.main" }}>
                    {item.icon}
                  </Avatar>
                </Stack>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Card sx={{ mt: 2, borderRadius: 3, p: 1.2 }}>
          <TableContainer>
            <Table size="small" sx={{ tableLayout: "fixed" }}>
              <TableHead>
                <TableRow>
                  <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>رقم الطلب</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>المنفذ / المورد</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>التاريخ</TableCell>
                  {!superCashier ? (
                    <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>القيمة</TableCell>
                  ) : null}
                  <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>الحالة</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>تفاصيل</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>إرجاع</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell align="center" sx={{ fontWeight: 700, color: "primary.main" }}>{row.id}</TableCell>
                    <TableCell align="center">
                      {row.purchasedBy || "-"}
                      <Typography variant="caption" display="block" color="text.secondary">
                        {row.supplier || "مورد عام"}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">{row.purchasedAt ? new Date(row.purchasedAt).toLocaleString("en-GB") : "-"}</TableCell>
                    {!superCashier ? (
                      <TableCell align="center">{formatOneDecimal(row.total)} شيكل</TableCell>
                    ) : null}
                    <TableCell align="center">
                      <Chip
                        size="small"
                        label={row.status || "مكتمل"}
                        color={
                          (row.status || "مكتمل") === "مكتمل"
                            ? "success"
                            : (row.status || "مكتمل") === "مراجعة"
                              ? "warning"
                              : (row.status || "مكتمل") === "مرجع"
                                ? "default"
                                : "info"
                        }
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setDetailPurchase(row)}
                        sx={{ textTransform: "none", fontWeight: 700 }}
                      >
                        عرض
                      </Button>
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        color="warning"
                        variant="outlined"
                        disabled={String(row.status || "") === "مرجع"}
                        onClick={() => processPurchaseReturn(row)}
                        sx={{ textTransform: "none", fontWeight: 700 }}
                      >
                        إرجاع القسيمة
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack direction="row" justifyContent="center" sx={{ mt: 1.5 }}>
            <Pagination count={pageCount} page={safePage} onChange={(_, value) => setPage(value)} color="primary" shape="rounded" />
          </Stack>
        </Card>

        <Dialog open={newPurchaseOpen} onClose={() => setNewPurchaseOpen(false)} fullWidth maxWidth="md">
          <DialogTitle sx={{ textAlign: "right" }}>شراء من أصناف المخزون</DialogTitle>
          <DialogContent sx={{ textAlign: "right" }}>
            {newPurchaseError ? (
              <Alert severity="error" sx={{ mb: 1.5 }}>
                {newPurchaseError}
              </Alert>
            ) : null}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              صفِّ الأصناف بالبحث أو القسم، ثم اضغط على الصنف لإضافته. كل تركيز (مثل 100 مجم و500 مجم) يُسجَّل كصنف منفصل في المخزون
              ليميّز الفرع عن الآخر.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1, mb: 1.5 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="بحث بالاسم، الفرع، القسم، أو رقم الصنف..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
              />
              <Select
                size="small"
                value={catalogCategory}
                onChange={(e) => setCatalogCategory(e.target.value)}
                displayEmpty
                sx={{ minWidth: { xs: "100%", sm: 200 } }}
              >
                <MenuItem value="all">كل الأقسام</MenuItem>
                {catalogCategories.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </Select>
            </Stack>
            <Card variant="outlined" sx={{ maxHeight: 280, overflow: "auto", mb: 2, borderRadius: 2 }}>
              <List dense disablePadding>
                {filteredCatalog.length === 0 ? (
                  <ListItemText primary="لا توجد أصناف مطابقة" secondary="جرّب تغيير البحث أو القسم" sx={{ px: 2, py: 1.5 }} />
                ) : (
                  filteredCatalog.slice(0, 100).map((p) => (
                    <ListItemButton
                      key={p.id}
                      onClick={() => addProductToPurchaseLines(p)}
                      sx={{ alignItems: "flex-start", gap: 1, py: 1.1 }}
                    >
                      <ListItemText
                        primary={productDisplayName(p)}
                        primaryTypographyProps={{ fontWeight: 700 }}
                        secondary={`${p.category || "—"} · مخزون ${formatOneDecimal(p.qty)} · بيع ${formatOneDecimal(p.price)} شيكل`}
                      />
                      <Add fontSize="small" color="primary" sx={{ mt: 0.5 }} />
                    </ListItemButton>
                  ))
                )}
              </List>
            </Card>
            <Divider sx={{ my: 1 }} />
            <Typography fontWeight={800} sx={{ mb: 1 }}>
              بنود الشراء
            </Typography>
            {purchaseLines.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                اختر أصنافًا من القائمة أعلاه
              </Typography>
            ) : (
              <TableContainer component={Card} variant="outlined" sx={{ borderRadius: 2, mb: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
                      <TableCell align="center" sx={{ fontWeight: 800 }}>
                        الصنف
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800 }}>
                        مشتراة
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800 }}>
                        بونص
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800 }}>
                        سعر الشراء
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800 }}>
                        حذف
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {purchaseLines.map((line) => {
                      const prod = catalogProducts.find((x) => Number(x.id) === Number(line.productId));
                      return (
                        <TableRow key={line.lineKey}>
                          <TableCell align="center" sx={{ fontWeight: 700, maxWidth: 200 }}>
                            {prod ? productDisplayName(prod) : `#${line.productId}`}
                          </TableCell>
                          <TableCell align="center">
                            <TextField
                              size="small"
                              type="text"
                              inputMode="decimal"
                              value={line.paidQty}
                              onChange={(e) =>
                                updatePurchaseLine(line.lineKey, { paidQty: normalizeOneDecimal(e.target.value) })
                              }
                              sx={{ width: 88 }}
                              inputProps={{ style: { textAlign: "center" } }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <TextField
                              size="small"
                              type="text"
                              inputMode="decimal"
                              value={line.bonusQty}
                              onChange={(e) =>
                                updatePurchaseLine(line.lineKey, { bonusQty: normalizeOneDecimal(e.target.value) })
                              }
                              sx={{ width: 88 }}
                              inputProps={{ style: { textAlign: "center" } }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <TextField
                              size="small"
                              type="text"
                              inputMode="decimal"
                              value={line.unitPrice}
                              onChange={(e) =>
                                updatePurchaseLine(line.lineKey, { unitPrice: normalizeOneDecimal(e.target.value) })
                              }
                              sx={{ width: 100 }}
                              inputProps={{ style: { textAlign: "center" } }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <IconButton size="small" color="error" onClick={() => removePurchaseLine(line.lineKey)} aria-label="حذف">
                              <DeleteOutline fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            {superCashier ? (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
                يُتحقق من الصندوق تلقائيًا. إذا رُفضت العملية فالمطلوب تغذية الصندوق من المدير.
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                رصيد الخزنة الحالي: <b>{newPurchaseTreasury.toFixed(2)}</b> شيكل — إجمالي هذا الشراء:{" "}
                <b>{newPurchaseTotalCost.toFixed(2)}</b> شيكل
              </Typography>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
            <Button onClick={() => setNewPurchaseOpen(false)} sx={{ textTransform: "none" }}>
              إلغاء
            </Button>
            <Button variant="contained" onClick={confirmNewPurchase} sx={{ textTransform: "none", fontWeight: 800 }}>
              تأكيد الشراء
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(detailPurchase)} onClose={() => setDetailPurchase(null)} fullWidth maxWidth="md">
          <DialogTitle sx={{ textAlign: "right" }}>
            تفاصيل فاتورة الشراء — {detailPurchase?.id}
          </DialogTitle>
          <DialogContent sx={{ textAlign: "right" }}>
            <Stack sx={{ gap: 1, mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                المنفذ: <b>{detailPurchase?.purchasedBy || "-"}</b>
                {!superCashier ? <> ({detailPurchase?.purchasedByRole || "admin"})</> : null}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                المورد: <b>{detailPurchase?.supplier || "مورد عام"}</b>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                التاريخ والوقت:{" "}
                <b>{detailPurchase?.purchasedAt ? new Date(detailPurchase.purchasedAt).toLocaleString("en-GB") : "-"}</b>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                طريقة الدفع: <b>{detailPurchase?.paymentMethod === "app" ? "تطبيق" : detailPurchase?.paymentMethod === "cash" ? "كاش" : detailPurchase?.paymentMethod || "كاش"}</b>
                {" — "}
                الحالة: <b>{detailPurchase?.status || "مكتمل"}</b>
              </Typography>
            </Stack>
            <TableContainer component={Card} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>#</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>الصنف</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>القسم</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>طريقة البيع</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>الكمية</TableCell>
                    {!superCashier ? (
                      <>
                        <TableCell align="center" sx={{ fontWeight: 800 }}>سعر الوحدة</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800 }}>الإجمالي</TableCell>
                      </>
                    ) : null}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(Array.isArray(detailPurchase?.items) && detailPurchase.items.length
                    ? detailPurchase.items
                    : []
                  ).map((it, i) => {
                    const qty = Number(it.qty ?? Number(it.qtyPaid ?? 0) + Number(it.qtyBonus ?? 0));
                    const unit = Number(it.unitPrice ?? it.price ?? 0);
                    const lineTotal = Number(it.total ?? qty * unit);
                    return (
                      <TableRow key={`${it.name}-${i}`}>
                        <TableCell align="center">{i + 1}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600 }}>{it.name || "-"}</TableCell>
                        <TableCell align="center">{it.category || "-"}</TableCell>
                        <TableCell align="center">{saleTypeLabelMap[it.saleType] || "-"}</TableCell>
                        <TableCell align="center">
                          {formatOneDecimal(qty)}
                          {Number(it.qtyBonus) > 0 ? (
                            <Typography variant="caption" display="block" color="success.main">
                              منها بونص {formatOneDecimal(it.qtyBonus)}
                            </Typography>
                          ) : null}
                        </TableCell>
                        {!superCashier ? (
                          <>
                            <TableCell align="center">{formatOneDecimal(unit)} شيكل</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700 }}>{formatOneDecimal(lineTotal)} شيكل</TableCell>
                          </>
                        ) : null}
                      </TableRow>
                    );
                  })}
                  {(!detailPurchase?.items || !detailPurchase.items.length) ? (
                    <TableRow>
                      <TableCell colSpan={superCashier ? 5 : 7} align="center">
                        <Typography variant="body2" color="text.secondary">لا توجد بنود مسجلة لهذه الفاتورة</Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
            {!superCashier ? (
              <Stack sx={{ mt: 2, alignItems: "flex-end" }}>
                <Typography variant="subtitle1" fontWeight={900}>
                  إجمالي الفاتورة: {formatOneDecimal(detailPurchase?.total)} شيكل
                </Typography>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                تفاصيل المبالغ متاحة لمدير النظام فقط.
              </Typography>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
            <Button variant="contained" onClick={() => setDetailPurchase(null)} sx={{ textTransform: "none" }}>
              إغلاق
            </Button>
            {String(detailPurchase?.status || "") !== "مرجع" ? (
              <Button
                variant="outlined"
                color="warning"
                onClick={() => processPurchaseReturn(detailPurchase)}
                sx={{ textTransform: "none", fontWeight: 800 }}
              >
                إرجاع القسيمة
              </Button>
            ) : null}
          </DialogActions>
        </Dialog>
      </Box>
    </AdminLayout>
  );
}
