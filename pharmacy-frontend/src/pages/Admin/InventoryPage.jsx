import {
  Add,
  Close,
  DeleteOutline,
  Inventory2,
  LocalShipping,
  WarningAmber,
} from "@mui/icons-material";
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
  Grid,
  IconButton,
  LinearProgress,
  MenuItem,
  Pagination,
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
import { keyframes } from "@mui/system";
import { useEffect, useMemo, useRef, useState } from "react";
import FilterBarRow from "../../components/FilterBarRow";
import { adminPageContainerSx, adminPageSubtitleSx, adminPageTitleRowSx } from "../../utils/adminPageLayout";
import { negativeAmountTextSx } from "../../utils/negativeAmountStyle";
import AdminLayout from "./AdminLayout";
import { showAppToast } from "../../utils/appToast";
import { productDisplayName } from "../../utils/productDisplayName";
import { appendAudit } from "../../utils/auditLog";
import { buildInitialDemoProducts } from "../../data/pharmacyDemoCatalog";
import { fetchAndPersistSalesCategories, PHARMACY_ADMIN_CATEGORIES_SYNCED } from "../../utils/backendCategoriesSync";
import { normalizeSaleOptions, productHasSaleOptions } from "../../utils/productSaleOptions";
import { debitStoreBalanceForPurchase, notifyStoreBalanceChanged } from "../../utils/storeBalanceSync";
import { compressImageFileToDataUrl } from "../../utils/imageCompress";
import { isAdmin, isSuperCashier, purchaserDisplayName } from "../../utils/userRoles";

const inventoryDialogPaperSx = { borderRadius: 3, overflow: "hidden" };
const inventoryDialogTitleSx = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 48,
  px: { xs: 1, sm: 2 },
  pt: { xs: 2, md: 2.5 },
  pb: 1.25,
  borderBottom: "1px solid",
  borderColor: "divider",
};
const inventoryDialogCloseBtnSx = {
  position: "absolute",
  insetInlineStart: 8,
  top: "50%",
  transform: "translateY(-50%)",
};

const float = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-6px); }
`;
const saleTypeLabelMap = {
  pill: "بالحبة",
  strip: "شريط كامل",
  bottle: "قزازة",
  box: "علبة",
  sachet: "كيس",
};

const PRODUCTS_KEY = "adminProducts";
const CATEGORIES_KEY = "adminCategories";
const STORE_BALANCE_KEY = "storeBalance";
const PURCHASE_INVOICES_KEY = "purchaseInvoices";
const NOTIFICATIONS_KEY = "systemNotifications";
const ROWS_PER_PAGE = 5;
function getStoredProducts() {
  try {
    const raw = JSON.parse(localStorage.getItem(PRODUCTS_KEY));
    if (Array.isArray(raw) && raw.length) return raw;
  } catch {
    // ignore
  }
  return buildInitialDemoProducts();
}

export default function InventoryPage({ mode, onToggleMode }) {
  const theme = useTheme();
  const newItemImageInputRef = useRef(null);
  const editItemImageInputRef = useRef(null);
  const unifiedToggleSx = useMemo(
    () => ({
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
        color: theme.palette.common.white,
      },
      "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
        backgroundColor: theme.palette.success.main,
        opacity: 1,
      },
      "& .MuiSwitch-track": {
        borderRadius: 30,
        backgroundColor: theme.palette.action.disabledBackground,
        opacity: 1,
      },
      "& .MuiSwitch-thumb": {
        width: 22,
        height: 22,
        boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, 0.28)}`,
      },
    }),
    [theme],
  );
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch {
      return null;
    }
  }, []);
  const superCashier = isSuperCashier(currentUser);
  const [items, setItems] = useState(getStoredProducts);
  const [categoriesSyncTick, setCategoriesSyncTick] = useState(0);
  useEffect(() => {
    const bump = () => setCategoriesSyncTick((t) => t + 1);
    window.addEventListener(PHARMACY_ADMIN_CATEGORIES_SYNCED, bump);
    let cancelled = false;
    fetchAndPersistSalesCategories().finally(() => {
      if (!cancelled) bump();
    });
    return () => {
      cancelled = true;
      window.removeEventListener(PHARMACY_ADMIN_CATEGORIES_SYNCED, bump);
    };
  }, []);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [page, setPage] = useState(1);
  const [newItem, setNewItem] = useState({
    name: "",
    variantLabel: "",
    category: "مسكنات",
    saleType: "strip",
    qty: "",
    min: "",
    price: "",
    imageUrl: "",
    bonusQty: "",
    barcode: "",
    expiryDate: "",
    saleOptionRows: [],
    usageHowTo: "",
    usageFrequency: "",
    usageTips: "",
  });
  const [purchaseError, setPurchaseError] = useState("");
  const [purchaseSuccess, setPurchaseSuccess] = useState("");
  const [restockTarget, setRestockTarget] = useState(null);
  const [restockForm, setRestockForm] = useState({ paidQty: "", bonusQty: "", unitPrice: "" });
  const [restockError, setRestockError] = useState("");
  const [restockSuccess, setRestockSuccess] = useState("");
  const [deleteDialogProduct, setDeleteDialogProduct] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    variantLabel: "",
    category: "مسكنات",
    saleType: "strip",
    qty: "",
    min: "",
    price: "",
    imageUrl: "",
    barcode: "",
    expiryDate: "",
    saleOptionRows: [],
    usageHowTo: "",
    usageFrequency: "",
    usageTips: "",
  });
  const categoryOptions = useMemo(() => {
    const names = new Set();
    try {
      const raw = JSON.parse(localStorage.getItem(CATEGORIES_KEY));
      if (Array.isArray(raw) && raw.length) {
        raw.filter((c) => c.active !== false).forEach((c) => names.add(String(c.name || "").trim()));
      }
    } catch {
      // ignore
    }
    items.forEach((p) => {
      const c = String(p.category || "").trim();
      if (c) names.add(c);
    });
    return [...names].filter(Boolean).sort((a, b) => a.localeCompare(b, "ar"));
  }, [items, categoriesSyncTick]);
  const normalizeOneDecimal = (value) => {
    const cleaned = String(value ?? "").replace(/[^\d.]/g, "");
    const num = Number(cleaned);
    if (Number.isNaN(num)) return "";
    return (Math.round(num * 10) / 10).toString();
  };

  const buildPersistedSaleOptions = (rows, idBase) => {
    if (!Array.isArray(rows)) return [];
    return rows
      .map((r, i) => ({
        id: String(r?.id || "").trim() || `opt-${idBase}-${i}`,
        label: String(r?.label || "").trim(),
        priceDelta: (() => {
          const n = Number(String(r?.priceDelta ?? "").replace(/[^\d.-]/g, ""));
          return Number.isFinite(n) ? Math.round(n * 10) / 10 : 0;
        })(),
      }))
      .filter((o) => o.label);
  };

  const saleOptionRowsFromProduct = (product) =>
    normalizeSaleOptions(product).map((o) => ({
      id: o.id,
      label: o.label,
      priceDelta: String(o.priceDelta),
    }));

  const persistProducts = (next) => {
    setItems(next);
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(next));
  };

  const toggleItemActive = (id, checked) => {
    const next = items.map((item) => (item.id === id ? { ...item, active: checked } : item));
    persistProducts(next);
    showAppToast(checked ? "تم تفعيل الصنف" : "تم تعطيل الصنف", "info");
  };

  const stockCreditForProduct = (p) => {
    const q = Number(p?.qty || 0);
    const unit = Number(p?.price || 0);
    return Number((q * unit).toFixed(2));
  };

  const creditTreasuryFromDelete = (amount) => {
    const refund = Number(amount);
    if (!refund || refund <= 0) return;
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
    const nextBal = {
      ...balance,
      total: Number((balance.total + refund).toFixed(2)),
      cash: Number((balance.cash + refund).toFixed(2)),
      lastOperation: "inventory_delete_refund",
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORE_BALANCE_KEY, JSON.stringify(nextBal));
    notifyStoreBalanceChanged();
  };

  const openDeleteDialog = (id) => {
    const target = items.find((x) => x.id === id);
    if (!target) return;
    setDeleteDialogProduct(target);
  };

  const confirmDeleteProduct = (withRefund) => {
    const target = deleteDialogProduct;
    if (!target) return;
    const credit = stockCreditForProduct(target);
    if (withRefund && credit > 0) {
      creditTreasuryFromDelete(credit);
    }
    const next = items.filter((x) => x.id !== target.id);
    persistProducts(next);
    setDeleteDialogProduct(null);
    if (withRefund && credit > 0) {
      showAppToast(`تم حذف الصنف وإضافة ${credit.toFixed(2)} شيكل للخزنة`, "success");
    } else {
      showAppToast("تم حذف الصنف بنجاح", "success");
    }
  };

  const filteredSortedItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = items.filter((item) => {
      const matchesSearch =
        !q ||
        String(item.name || "").toLowerCase().includes(q) ||
        String(item.variantLabel || "").toLowerCase().includes(q) ||
        String(productDisplayName(item)).toLowerCase().includes(q) ||
        String(item.category || "").toLowerCase().includes(q) ||
        String(item.barcode || "").toLowerCase().includes(q) ||
        normalizeSaleOptions(item).some((o) => o.label.toLowerCase().includes(q));
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && item.active) ||
        (statusFilter === "inactive" && !item.active);
      const matchesCategory = categoryFilter === "all" || String(item.category || "") === categoryFilter;
      return matchesSearch && matchesStatus && matchesCategory;
    });
    return [...filtered].sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      if (bTime !== aTime) return bTime - aTime;
      return Number(b.id || 0) - Number(a.id || 0);
    });
  }, [items, search, statusFilter, categoryFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredSortedItems.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * ROWS_PER_PAGE;
    return filteredSortedItems.slice(start, start + ROWS_PER_PAGE);
  }, [filteredSortedItems, safePage]);
  const paidPurchaseQty = Number(newItem.qty || 0);
  const bonusStockQty = Number(newItem.bonusQty || 0);
  const stockQtyTotal = Math.max(0, paidPurchaseQty + bonusStockQty);
  const purchasePrice = Number(newItem.price || 0);
  const purchaseCost = Math.max(0, paidPurchaseQty * purchasePrice);
  const treasuryBalance = useMemo(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_BALANCE_KEY));
      if (raw && typeof raw === "object") return Number(raw.total || 0);
    } catch {
      // ignore malformed value
    }
    return 0;
  }, [openAddDialog, restockTarget]);
  const restockPaidQty = Number(restockForm.paidQty || 0);
  const restockBonusQty = Number(restockForm.bonusQty || 0);
  const restockStockTotal = Math.max(0, restockPaidQty + restockBonusQty);
  const restockUnitPrice = Number(restockForm.unitPrice || 0);
  const restockPurchaseCost = Math.max(0, restockPaidQty * restockUnitPrice);
  const inventoryStats = useMemo(() => {
    const total = filteredSortedItems.length;
    const low = filteredSortedItems.filter((i) => Number(i.qty || 0) < Number(i.min || 0)).length;
    const active = filteredSortedItems.filter((i) => i.active).length;
    return { total, low, active };
  }, [filteredSortedItems]);

  return (
    <AdminLayout mode={mode} onToggleMode={onToggleMode}>
      <Box sx={adminPageContainerSx}>
        <Stack sx={adminPageTitleRowSx}>
          <Box>
            <Typography variant="h5" fontWeight={900}>
              الأصناف - المخزون
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={adminPageSubtitleSx}>
              لوحة متقدمة لمتابعة كل صنف وحالة التوفر بشكل لحظي
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {
              setPurchaseError("");
              setPurchaseSuccess("");
              setNewItem({
                name: "",
                variantLabel: "",
                category: "مسكنات",
                saleType: "strip",
                qty: "",
                bonusQty: "",
                min: "",
                price: "",
                imageUrl: "",
                barcode: "",
                expiryDate: "",
                saleOptionRows: [],
                usageHowTo: "",
                usageFrequency: "",
                usageTips: "",
              });
              setOpenAddDialog(true);
            }}
            sx={{ textTransform: "none", fontWeight: 800, px: 2.2, py: 1.1 }}
          >
            إضافة صنف جديد
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
              <FilterBarRow alignItems="center">
                <TextField
                  size="small"
                  placeholder="ابحث باسم الصنف أو القسم..."
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
                  sx={{ minWidth: 160, flex: "0 0 auto" }}
                >
                  <MenuItem value="all">كل الحالات</MenuItem>
                  <MenuItem value="active">نشط فقط</MenuItem>
                  <MenuItem value="inactive">غير نشط فقط</MenuItem>
                </Select>
                <Select
                  size="small"
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    setPage(1);
                  }}
                  sx={{ minWidth: 148, flex: "0 0 auto" }}
                  displayEmpty
                >
                  <MenuItem value="all">كل الأقسام</MenuItem>
                  {categoryOptions.map((n) => (
                    <MenuItem key={n} value={n}>
                      {n}
                    </MenuItem>
                  ))}
                </Select>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("all");
                    setCategoryFilter("all");
                    setPage(1);
                  }}
                  sx={{ textTransform: "none", fontWeight: 700, flex: "0 0 auto", whiteSpace: "nowrap" }}
                >
                  إعادة الضبط
                </Button>
              </FilterBarRow>
            </Card>
          </Grid>
          {[
            { title: "إجمالي الأصناف", value: `${inventoryStats.total}`, icon: <Inventory2 /> },
            { title: "أصناف حرجة", value: `${inventoryStats.low}`, icon: <WarningAmber /> },
            { title: "أصناف نشطة", value: `${inventoryStats.active}`, icon: <LocalShipping /> },
          ].map((card, idx) => (
            <Grid key={card.title} size={{ xs: 4, md: 4 }}>
              <Card
                sx={{
                  p: { xs: 1.25, sm: 2 },
                  borderRadius: 3,
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                  animation: `${float} ${2.8 + idx * 0.4}s ease-in-out infinite`,
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={0.75}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: { xs: "block", sm: "none" } }}>
                      {card.title === "إجمالي الأصناف" ? "إجمالي" : card.title === "أصناف حرجة" ? "حرجة" : "نشطة"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
                      {card.title}
                    </Typography>
                    <Typography variant="h5" fontWeight={900} sx={{ fontSize: { xs: "1.1rem", sm: undefined } }}>
                      {card.value}
                    </Typography>
                  </Box>
                  <Avatar
                    sx={{
                      bgcolor: alpha(theme.palette.primary.main, 0.14),
                      color: "primary.main",
                      width: { xs: 36, sm: 40 },
                      height: { xs: 36, sm: 40 },
                      flexShrink: 0,
                    }}
                  >
                    {card.icon}
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
                  <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>الصورة</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>الصنف / باركود</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>القسم</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>طريقة البيع</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>الكمية</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>السعر</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>الحالة</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>تزويد</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>حذف</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedItems.map((item) => {
                  const stockPercent = Math.min(100, Math.round((item.qty / Math.max(item.min, 1)) * 100));
                  const isLow = item.qty < item.min;
                  return (
                    <TableRow
                      key={item.id}
                      hover
                      onClick={() => {
                        setEditTarget(item);
                        setEditForm({
                          name: item.name || "",
                          variantLabel: String(item.variantLabel ?? ""),
                          category: item.category || categoryOptions[0] || "مسكنات",
                          saleType: item.saleType || "strip",
                          qty: String(item.qty ?? ""),
                          min: String(item.min ?? ""),
                          price: String(item.price ?? ""),
                          imageUrl: typeof item.image === "string" ? item.image : "",
                          barcode: String(item.barcode ?? ""),
                          expiryDate: String(item.expiryDate ?? "").slice(0, 10),
                          saleOptionRows: saleOptionRowsFromProduct(item),
                          usageHowTo: String(item.usageHowTo ?? ""),
                          usageFrequency: String(item.usageFrequency ?? ""),
                          usageTips: String(item.usageTips ?? ""),
                        });
                      }}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell align="center">
                        <Avatar
                          src={item.image || ""}
                          variant="rounded"
                          sx={{ width: 44, height: 44, mx: "auto", bgcolor: alpha(theme.palette.primary.main, 0.12) }}
                        >
                          <Inventory2 fontSize="small" />
                        </Avatar>
                      </TableCell>
                      <TableCell align="center">
                        <Box>
                          <Stack direction="row" alignItems="center" justifyContent="center" sx={{ gap: 0.5, flexWrap: "wrap" }}>
                            <Typography fontWeight={800}>{productDisplayName(item)}</Typography>
                            {productHasSaleOptions(item) ? (
                              <Chip size="small" label="خيارات بيع" color="secondary" variant="outlined" sx={{ fontWeight: 700 }} />
                            ) : null}
                          </Stack>
                          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.4 }}>
                            {item.barcode ? `باركود: ${item.barcode}` : ""}
                            {item.expiryDate
                              ? ` ${item.barcode ? "·" : ""} انتهاء: ${item.expiryDate}`
                              : ""}
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={stockPercent}
                            color={isLow ? "warning" : "primary"}
                            sx={{ mt: 0.6, height: 6, borderRadius: 99 }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Chip size="small" label={item.category} variant="outlined" />
                      </TableCell>
                      <TableCell align="center">
                        <Chip size="small" label={saleTypeLabelMap[item.saleType] || "شريط كامل"} color="info" variant="outlined" />
                      </TableCell>
                      <TableCell align="center">
                        <Typography fontWeight={700}>{Number(item.qty || 0).toFixed(1)}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Typography color="text.secondary">{Number(item.price || 0).toFixed(1)} شيكل</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" justifyContent="center" alignItems="center" sx={{ gap: 0.5 }}>
                          <Switch
                            checked={item.active}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => toggleItemActive(item.id, e.target.checked)}
                            sx={unifiedToggleSx}
                          />
                          <Typography variant="caption" color={item.active ? "success.main" : "text.secondary"}>
                            {item.active ? "نشط" : "غير نشط"}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          size="small"
                          variant="outlined"
                          color="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRestockTarget(item);
                            setRestockForm({
                              paidQty: "",
                              bonusQty: "",
                              unitPrice: String(item.price ?? ""),
                            });
                            setRestockError("");
                            setRestockSuccess("");
                          }}
                          sx={{ textTransform: "none", minWidth: 0, px: 1 }}
                        >
                          تزويد
                        </Button>
                      </TableCell>
                      <TableCell align="center">
                        {superCashier ? (
                          <Typography variant="caption" color="text.disabled">
                            —
                          </Typography>
                        ) : (
                          <Button
                            color="error"
                            size="small"
                            variant="outlined"
                            onClick={(e) => {
                              e.stopPropagation();
                              openDeleteDialog(item.id);
                            }}
                            sx={{ textTransform: "none", minWidth: 0, px: 1 }}
                          >
                            حذف
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
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

        <Dialog
          open={openAddDialog}
          onClose={() => setOpenAddDialog(false)}
          fullWidth
          maxWidth="md"
          slotProps={{ paper: { sx: inventoryDialogPaperSx } }}
        >
          <DialogTitle sx={inventoryDialogTitleSx}>
            <IconButton aria-label="إغلاق" size="small" onClick={() => setOpenAddDialog(false)} sx={inventoryDialogCloseBtnSx}>
              <Close />
            </IconButton>
            <Typography component="div" variant="h6" fontWeight={800} sx={{ textAlign: "center", width: "100%", px: { xs: 4, sm: 8 } }}>
              إضافة صنف جديد
            </Typography>
          </DialogTitle>
          <DialogContent dividers sx={{ textAlign: "right", px: { xs: 2, sm: 2.5 }, py: 2 }}>
            <Grid container spacing={1.5}>
              {purchaseError ? (
                <Grid size={{ xs: 12 }}>
                  <Alert severity="error">{purchaseError}</Alert>
                </Grid>
              ) : null}
              {purchaseSuccess ? (
                <Grid size={{ xs: 12 }}>
                  <Alert severity="success">{purchaseSuccess}</Alert>
                </Grid>
              ) : null}
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="اسم الصنف (مثال: باراسيتامول)"
                  value={newItem.name}
                  onChange={(e) => setNewItem((p) => ({ ...p, name: e.target.value }))}
                  fullWidth
                  size="small"
                  inputProps={{ style: { textAlign: "right" } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="الباركود (اختياري)"
                  value={newItem.barcode}
                  onChange={(e) => setNewItem((p) => ({ ...p, barcode: e.target.value }))}
                  fullWidth
                  size="small"
                  placeholder="للبحث السريع في الكاشير"
                  inputProps={{ style: { textAlign: "right" } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="تاريخ انتهاء الصلاحية (اختياري)"
                  type="date"
                  value={newItem.expiryDate}
                  onChange={(e) => setNewItem((p) => ({ ...p, expiryDate: e.target.value }))}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Select
                  fullWidth
                  size="small"
                  displayEmpty
                  value={newItem.category}
                  onChange={(e) => setNewItem((p) => ({ ...p, category: e.target.value }))}
                >
                  {categoryOptions.map((n) => (
                    <MenuItem key={n} value={n}>
                      {n}
                    </MenuItem>
                  ))}
                </Select>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Select
                  fullWidth
                  size="small"
                  value={newItem.saleType}
                  onChange={(e) => setNewItem((p) => ({ ...p, saleType: e.target.value }))}
                >
                  <MenuItem value="strip">شريط كامل</MenuItem>
                  <MenuItem value="pill">بالحبة</MenuItem>
                  <MenuItem value="bottle">قزازة</MenuItem>
                  <MenuItem value="box">علبة</MenuItem>
                  <MenuItem value="sachet">كيس</MenuItem>
                </Select>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="كمية المشتراة (تُضاف للمخزون وتُحسب تكلفتها من الصندوق)"
                  type="text"
                  inputMode="decimal"
                  value={newItem.qty}
                  onChange={(e) => setNewItem((p) => ({ ...p, qty: normalizeOneDecimal(e.target.value) }))}
                  fullWidth
                  size="small"
                  inputProps={{ style: { textAlign: "right" } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="بونص — كمية مجانية للمخزون (بدون تكلفة)"
                  type="text"
                  inputMode="decimal"
                  value={newItem.bonusQty}
                  onChange={(e) => setNewItem((p) => ({ ...p, bonusQty: normalizeOneDecimal(e.target.value) }))}
                  fullWidth
                  size="small"
                  helperText="تُضاف للمخزون دون خصم من الصندوق"
                  inputProps={{ style: { textAlign: "right" } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="الحد الأدنى للتنبيه"
                  type="text"
                  inputMode="decimal"
                  value={newItem.min}
                  onChange={(e) => setNewItem((p) => ({ ...p, min: normalizeOneDecimal(e.target.value) }))}
                  fullWidth
                  size="small"
                  inputProps={{ style: { textAlign: "right" } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="سعر البيع (شيكل)"
                  type="text"
                  inputMode="decimal"
                  value={newItem.price}
                  onChange={(e) => setNewItem((p) => ({ ...p, price: normalizeOneDecimal(e.target.value) }))}
                  fullWidth
                  size="small"
                  inputProps={{ style: { textAlign: "right" } }}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <input
                  ref={newItemImageInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f?.type?.startsWith("image/")) return;
                    try {
                      const dataUrl = await compressImageFileToDataUrl(f);
                      setNewItem((p) => ({ ...p, imageUrl: dataUrl }));
                    } catch {
                      const r = new FileReader();
                      r.onload = () => setNewItem((p) => ({ ...p, imageUrl: String(r.result || "") }));
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
                    newItemImageInputRef.current?.click();
                  }}
                >
                  رفع صورة من الجهاز
                </Button>
                {newItem.imageUrl && String(newItem.imageUrl).startsWith("data:") ? (
                  <Typography variant="caption" color="success.main" sx={{ display: "block", mt: 0.75 }}>
                    تم اختيار صورة من الجهاز
                  </Typography>
                ) : null}
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Card variant="outlined" sx={{ p: 1.5, borderRadius: 2.5, borderColor: alpha(theme.palette.info.main, 0.35) }}>
                  <Typography variant="subtitle2" fontWeight={900} color="info.dark" sx={{ mb: 0.5 }}>
                    معلومات توجيهية (تظهر للكاشير قبل البيع)
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.25, lineHeight: 1.5 }}>
                    تعليمات الاستعمال والجرعة — للإرشاد فقط؛ المريض يتبع وصفة الطبيب.
                  </Typography>
                  <Stack spacing={1.25}>
                    <TextField
                      label="كيفية الاستعمال"
                      value={newItem.usageHowTo}
                      onChange={(e) => setNewItem((p) => ({ ...p, usageHowTo: e.target.value }))}
                      fullWidth
                      size="small"
                      multiline
                      minRows={2}
                      inputProps={{ style: { textAlign: "right" } }}
                    />
                    <TextField
                      label="عدد المرات باليوم / التوقيت (مثال: 3 مرات بعد الأكل)"
                      value={newItem.usageFrequency}
                      onChange={(e) => setNewItem((p) => ({ ...p, usageFrequency: e.target.value }))}
                      fullWidth
                      size="small"
                      multiline
                      minRows={2}
                      inputProps={{ style: { textAlign: "right" } }}
                    />
                    <TextField
                      label="نصائح، تحذيرات، أو تخزين"
                      value={newItem.usageTips}
                      onChange={(e) => setNewItem((p) => ({ ...p, usageTips: e.target.value }))}
                      fullWidth
                      size="small"
                      multiline
                      minRows={2}
                      inputProps={{ style: { textAlign: "right" } }}
                    />
                  </Stack>
                </Card>
              </Grid>
              <Grid size={{ xs: 12 }}>
              <Card variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                <Typography variant="subtitle2" fontWeight={800}>
                  خيارات البيع (اختياري)
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, mb: 1.2 }}>
                  مثل: حبة كبيرة / حبة صغيرة. إن وُجدت خيارات، يختار الكاشير واحداً قبل إضافة الصنف للسلة. «فرق السعر» يُضاف إلى سعر الصنف
                  (+ أو −).
                </Typography>
                {(newItem.saleOptionRows || []).map((row, idx) => (
                  <Stack
                    key={row.id || `new-opt-${idx}`}
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{ mb: 1 }}
                    alignItems={{ sm: "center" }}
                  >
                    <TextField
                      size="small"
                      label="اسم الخيار"
                      value={row.label}
                      onChange={(e) => {
                        const v = e.target.value;
                        setNewItem((p) => {
                          const rows = [...(p.saleOptionRows || [])];
                          rows[idx] = { ...rows[idx], label: v };
                          return { ...p, saleOptionRows: rows };
                        });
                      }}
                      fullWidth
                      inputProps={{ style: { textAlign: "right" } }}
                    />
                    <TextField
                      size="small"
                      label="فرق السعر ±"
                      value={row.priceDelta}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setNewItem((p) => {
                          const rows = [...(p.saleOptionRows || [])];
                          rows[idx] = { ...rows[idx], priceDelta: raw };
                          return { ...p, saleOptionRows: rows };
                        });
                      }}
                      sx={{ width: { xs: "100%", sm: 140 } }}
                      inputProps={{ style: { textAlign: "right" } }}
                    />
                    <IconButton
                      aria-label="حذف خيار"
                      color="error"
                      size="small"
                      onClick={() =>
                        setNewItem((p) => ({
                          ...p,
                          saleOptionRows: (p.saleOptionRows || []).filter((_, i) => i !== idx),
                        }))
                      }
                    >
                      <DeleteOutline />
                    </IconButton>
                  </Stack>
                ))}
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Add />}
                  onClick={() =>
                    setNewItem((p) => ({
                      ...p,
                      saleOptionRows: [
                        ...(p.saleOptionRows || []),
                        { id: `tmp-${Date.now()}`, label: "", priceDelta: "0" },
                      ],
                    }))
                  }
                  sx={{ textTransform: "none", mt: 0.5 }}
                >
                  إضافة خيار
                </Button>
              </Card>
              </Grid>
              <Grid size={{ xs: 12 }}>
              <Card variant="outlined" sx={{ p: 1.2, borderRadius: 2 }}>
                {superCashier ? (
                  <Typography variant="body2" color="text.secondary">
                    يُسجَّل التوريد باسمك. يُسمح بإتمام الشراء حتى مع عجز مؤقت في الخزنة ليظهر للمدير ويُغذّي الصندوق.
                  </Typography>
                ) : (
                  <>
                    <Typography variant="body2" color="text.secondary">
                      رصيد الخزنة الحالي:{" "}
                      <Box component="span" sx={negativeAmountTextSx(treasuryBalance)}>
                        {treasuryBalance.toFixed(2)} شيكل
                      </Box>
                    </Typography>
                    <Typography variant="body2" fontWeight={800} color={purchaseCost > 0 ? "warning.main" : "text.secondary"} sx={{ mt: 0.4 }}>
                      {purchaseCost > 0
                        ? `هذه الإضافة ستخصم من الخزنة: ${purchaseCost.toFixed(2)} شيكل`
                        : "أدخل كمية المشتراة والسعر لحساب الخصم المتوقع"}
                    </Typography>
                  </>
                )}
                {stockQtyTotal > 0 ? (
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
                    إجمالي ما يُدخل للمخزون: {stockQtyTotal.toFixed(1)} (مشتراة {paidPurchaseQty.toFixed(1)}
                    {bonusStockQty > 0 ? ` + بونص ${bonusStockQty.toFixed(1)}` : ""})
                  </Typography>
                ) : null}
              </Card>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: "wrap", bgcolor: alpha(theme.palette.action.hover, 0.06) }}>
            <Button onClick={() => setOpenAddDialog(false)} sx={{ textTransform: "none" }}>
              إلغاء
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                setPurchaseError("");
                setPurchaseSuccess("");
                if (!String(newItem.name || "").trim()) {
                  setPurchaseError("يرجى إدخال اسم الصنف");
                  return;
                }
                if (String(newItem.price || "").trim() === "" || Number(newItem.price) <= 0) {
                  setPurchaseError("يرجى إدخال سعر بيع صحيح أكبر من صفر");
                  return;
                }
                if (paidPurchaseQty <= 0 && bonusStockQty <= 0) {
                  setPurchaseError("أدخل كمية مشتراة أو بونص");
                  return;
                }
                if (paidPurchaseQty <= 0 && bonusStockQty > 0) {
                  setPurchaseError("البونص يُضاف مع كمية مشتراة؛ أدخل كمية المشتراة الأساسية");
                  return;
                }
                if (purchaseCost <= 0) {
                  setPurchaseError("قيمة الشراء غير صحيحة");
                  return;
                }
                if (!superCashier && treasuryBalance < purchaseCost) {
                  setPurchaseError("لا يكفي المال في الخزنة لإتمام الشراء");
                  return;
                }
                const buyerLabel = purchaserDisplayName(currentUser);
                const newId = Date.now();
                const variantTrim = String(newItem.variantLabel || "").trim();
                const baseName = String(newItem.name || "").trim();
                const saleOpts = buildPersistedSaleOptions(newItem.saleOptionRows, newId);
                const newRow = {
                  id: newId,
                  name: baseName,
                  ...(variantTrim ? { variantLabel: variantTrim } : {}),
                  category: newItem.category,
                  saleType: newItem.saleType,
                  qty: stockQtyTotal,
                  min: Number(newItem.min || 0),
                  price: Number(newItem.price || 0),
                  active: true,
                  image: newItem.imageUrl?.trim() || "",
                  createdAt: new Date().toISOString(),
                  ...(saleOpts.length ? { saleOptions: saleOpts } : {}),
                  ...(String(newItem.barcode || "").trim() ? { barcode: String(newItem.barcode).trim() } : {}),
                  ...(String(newItem.expiryDate || "").trim() ? { expiryDate: String(newItem.expiryDate).trim() } : {}),
                  ...(String(newItem.usageHowTo || "").trim() ? { usageHowTo: String(newItem.usageHowTo).trim() } : {}),
                  ...(String(newItem.usageFrequency || "").trim()
                    ? { usageFrequency: String(newItem.usageFrequency).trim() }
                    : {}),
                  ...(String(newItem.usageTips || "").trim() ? { usageTips: String(newItem.usageTips).trim() } : {}),
                };
                const next = [newRow, ...items];
                persistProducts(next);
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
                  // ignore malformed value
                }
                const { nextBalance, paidFromCash, paidFromApp } = debitStoreBalanceForPurchase(balance, purchaseCost, {
                  allowNegativeTreasury: superCashier,
                });
                localStorage.setItem(STORE_BALANCE_KEY, JSON.stringify(nextBalance));
                notifyStoreBalanceChanged();
                const currentUser = (() => {
                  try {
                    return JSON.parse(localStorage.getItem("user")) || null;
                  } catch {
                    return null;
                  }
                })();
                const purchaseInvoice = {
                  id: `PO-${Date.now()}`,
                  purchasedBy: buyerLabel,
                  purchasedByUsername: currentUser?.username || "",
                  purchasedByRole: currentUser?.role || "admin",
                  supplier: "مورد عام",
                  status: "مكتمل",
                  paymentMethod: paidFromApp > 0 ? "mixed" : "cash",
                  purchasedAt: new Date().toISOString(),
                  total: Number(purchaseCost.toFixed(2)),
                  treasuryDebit: {
                    total: Number(purchaseCost.toFixed(2)),
                    cash: paidFromCash,
                    app: paidFromApp,
                  },
                  bonusQty: bonusStockQty > 0 ? bonusStockQty : undefined,
                  items: [
                    {
                      productId: newId,
                      name: productDisplayName(newRow),
                      variantLabel: variantTrim || undefined,
                      category: newItem.category,
                      saleType: newItem.saleType,
                      qtyPaid: paidPurchaseQty,
                      qtyBonus: bonusStockQty,
                      qty: stockQtyTotal,
                      unitPrice: Number(newItem.price || 0),
                      total: Number(purchaseCost.toFixed(2)),
                    },
                  ],
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
                    ? `توريد جديد بواسطة ${buyerLabel} — ${productDisplayName(newRow)}`
                    : `فاتورة ${purchaseInvoice.id} بقيمة ${purchaseInvoice.total.toFixed(1)} شيكل بواسطة ${purchaseInvoice.purchasedBy}`,
                  details: `الصنف: ${productDisplayName(newRow)} | المخزون: ${stockQtyTotal.toFixed(1)} (مشتراة ${paidPurchaseQty.toFixed(1)}${
                    bonusStockQty > 0 ? ` + بونص ${bonusStockQty.toFixed(1)}` : ""
                  }) | السعر: ${Number(newItem.price || 0).toFixed(1)} شيكل`,
                  createdAt: new Date().toISOString(),
                  fromManagement: true,
                  managementLabel:
                    currentUser?.role === "admin" || currentUser?.role === "super_admin"
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
                setNewItem({
                  name: "",
                  variantLabel: "",
                  category: "مسكنات",
                  saleType: "strip",
                  qty: "",
                  bonusQty: "",
                  min: "",
                  price: "",
                  imageUrl: "",
                  barcode: "",
                  expiryDate: "",
                  saleOptionRows: [],
                  usageHowTo: "",
                  usageFrequency: "",
                  usageTips: "",
                });
                setPurchaseSuccess(
                  superCashier
                    ? `تمت إضافة الصنف للمخزون وتسجيل التوريد باسمك`
                    : `تمت إضافة الصنف وخصم ${purchaseCost.toFixed(2)} شيكل من الخزنة`,
                );
                showAppToast("تم إضافة الصنف بنجاح", "success");
                setTimeout(() => {
                  setOpenAddDialog(false);
                  setPurchaseSuccess("");
                }, 600);
              }}
              sx={{ textTransform: "none", fontWeight: 800 }}
            >
              حفظ الصنف
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={Boolean(restockTarget)}
          onClose={() => {
            setRestockTarget(null);
            setRestockError("");
            setRestockSuccess("");
          }}
          fullWidth
          maxWidth="md"
          slotProps={{ paper: { sx: inventoryDialogPaperSx } }}
        >
          <DialogTitle sx={inventoryDialogTitleSx}>
            <IconButton
              aria-label="إغلاق"
              size="small"
              onClick={() => {
                setRestockTarget(null);
                setRestockError("");
                setRestockSuccess("");
              }}
              sx={inventoryDialogCloseBtnSx}
            >
              <Close />
            </IconButton>
            <Typography component="div" variant="h6" fontWeight={800} sx={{ textAlign: "center", width: "100%", px: { xs: 4, sm: 8 } }}>
              تزويد مخزون — صنف موجود
            </Typography>
          </DialogTitle>
          <DialogContent dividers sx={{ textAlign: "right", px: { xs: 2, sm: 2.5 }, py: 1.5 }}>
            <Grid container spacing={1.25}>
              {restockError ? (
                <Grid size={12}>
                  <Alert severity="error" sx={{ py: 0.25 }}>
                    {restockError}
                  </Alert>
                </Grid>
              ) : null}
              {restockSuccess ? (
                <Grid size={12}>
                  <Alert severity="success" sx={{ py: 0.25 }}>
                    {restockSuccess}
                  </Alert>
                </Grid>
              ) : null}
              <Grid size={12}>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.45 }}>
                  <b>{restockTarget ? productDisplayName(restockTarget) : ""}</b>
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ mr: 0.75 }}>
                    — مخزون حالي {Number(restockTarget?.qty || 0).toFixed(1)}
                  </Typography>
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="كمية المشتراة"
                  type="text"
                  inputMode="decimal"
                  size="small"
                  fullWidth
                  value={restockForm.paidQty}
                  onChange={(e) => setRestockForm((p) => ({ ...p, paidQty: normalizeOneDecimal(e.target.value) }))}
                  helperText="تُخصم الخزنة حسب السعر"
                  inputProps={{ style: { textAlign: "right" } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="بونص (مجاني)"
                  type="text"
                  inputMode="decimal"
                  size="small"
                  fullWidth
                  value={restockForm.bonusQty}
                  onChange={(e) => setRestockForm((p) => ({ ...p, bonusQty: normalizeOneDecimal(e.target.value) }))}
                  helperText="بدون خصم من الخزنة"
                  inputProps={{ style: { textAlign: "right" } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="سعر شراء الوحدة (شيكل)"
                  type="text"
                  inputMode="decimal"
                  size="small"
                  fullWidth
                  value={restockForm.unitPrice}
                  onChange={(e) => setRestockForm((p) => ({ ...p, unitPrice: normalizeOneDecimal(e.target.value) }))}
                  helperText="للخصم من الخزنة فقط — سعر البيع من تعديل الصنف"
                  inputProps={{ style: { textAlign: "right" } }}
                />
              </Grid>
              <Grid size={12}>
                <Card variant="outlined" sx={{ p: 1, borderRadius: 2 }}>
                  {superCashier ? (
                    <Typography variant="caption" color="text.secondary" display="block">
                      يُسجَّل التوريد باسمك. يُسمح بعجز مؤقت في الخزنة ليظهر للمدير.
                    </Typography>
                  ) : (
                    <Stack spacing={0.35}>
                      <Typography variant="caption" color="text.secondary">
                        رصيد الخزنة:{" "}
                        <Box component="span" sx={negativeAmountTextSx(treasuryBalance)}>
                          {treasuryBalance.toFixed(2)} شيكل
                        </Box>
                      </Typography>
                      <Typography
                        variant="caption"
                        fontWeight={800}
                        color={restockPurchaseCost > 0 ? "warning.main" : "text.secondary"}
                      >
                        {restockPurchaseCost > 0
                          ? `خصم متوقع: ${restockPurchaseCost.toFixed(2)} شيكل`
                          : "أدخل كمية وسعر الشراء"}
                      </Typography>
                    </Stack>
                  )}
                  {restockStockTotal > 0 ? (
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                      +{restockStockTotal.toFixed(1)} للمخزون (مشتراة {restockPaidQty.toFixed(1)}
                      {restockBonusQty > 0 ? ` + بونص ${restockBonusQty.toFixed(1)}` : ""})
                    </Typography>
                  ) : null}
                </Card>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: "wrap", bgcolor: alpha(theme.palette.action.hover, 0.06) }}>
            <Button
              onClick={() => {
                setRestockTarget(null);
                setRestockError("");
                setRestockSuccess("");
              }}
              sx={{ textTransform: "none" }}
            >
              إلغاء
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                setRestockError("");
                setRestockSuccess("");
                if (!restockTarget) return;
                if (restockPaidQty <= 0 && restockBonusQty <= 0) {
                  setRestockError("أدخل كمية مشتراة أو بونص");
                  return;
                }
                if (restockPaidQty <= 0 && restockBonusQty > 0) {
                  setRestockError("البونص يُضاف مع كمية مشتراة؛ أدخل كمية المشتراة الأساسية");
                  return;
                }
                if (restockPurchaseCost <= 0) {
                  setRestockError("قيمة الشراء غير صحيحة");
                  return;
                }
                if (!superCashier && treasuryBalance < restockPurchaseCost) {
                  setRestockError("لا يكفي المال في الخزنة لإتمام الشراء");
                  return;
                }
                const buyerLabel = purchaserDisplayName(currentUser);
                const nextItems = items.map((it) =>
                  it.id === restockTarget.id
                    ? { ...it, qty: Number(it.qty || 0) + restockStockTotal }
                    : it,
                );
                persistProducts(nextItems);
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
                  // ignore malformed value
                }
                const { nextBalance, paidFromCash, paidFromApp } = debitStoreBalanceForPurchase(balance, restockPurchaseCost, {
                  allowNegativeTreasury: superCashier,
                });
                localStorage.setItem(STORE_BALANCE_KEY, JSON.stringify(nextBalance));
                notifyStoreBalanceChanged();
                const purchaseInvoice = {
                  id: `PO-${Date.now()}`,
                  purchasedBy: buyerLabel,
                  purchasedByUsername: currentUser?.username || "",
                  purchasedByRole: currentUser?.role || "admin",
                  supplier: "مورد عام",
                  status: "مكتمل",
                  paymentMethod: paidFromApp > 0 ? "mixed" : "cash",
                  purchasedAt: new Date().toISOString(),
                  total: Number(restockPurchaseCost.toFixed(2)),
                  treasuryDebit: {
                    total: Number(restockPurchaseCost.toFixed(2)),
                    cash: paidFromCash,
                    app: paidFromApp,
                  },
                  bonusQty: restockBonusQty > 0 ? restockBonusQty : undefined,
                  items: [
                    {
                      productId: restockTarget.id,
                      name: productDisplayName(restockTarget),
                      variantLabel: String(restockTarget.variantLabel || "").trim() || undefined,
                      category: restockTarget.category,
                      saleType: restockTarget.saleType,
                      qtyPaid: restockPaidQty,
                      qtyBonus: restockBonusQty,
                      qty: restockStockTotal,
                      unitPrice: restockUnitPrice,
                      total: Number(restockPurchaseCost.toFixed(2)),
                      note: "تزويد مخزون",
                    },
                  ],
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
                    ? `توريد مخزون بواسطة ${buyerLabel} — ${productDisplayName(restockTarget)}`
                    : `فاتورة ${purchaseInvoice.id} بقيمة ${purchaseInvoice.total.toFixed(1)} شيكل بواسطة ${purchaseInvoice.purchasedBy}`,
                  details: `تزويد: ${productDisplayName(restockTarget)} | +${restockStockTotal.toFixed(1)} (مشتراة ${restockPaidQty.toFixed(1)}${
                    restockBonusQty > 0 ? ` + بونص ${restockBonusQty.toFixed(1)}` : ""
                  }) | شراء ${restockUnitPrice.toFixed(1)} شيكل/وحدة`,
                  createdAt: new Date().toISOString(),
                  fromManagement: true,
                  managementLabel:
                    currentUser?.role === "admin" || currentUser?.role === "super_admin"
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
                setRestockForm({ paidQty: "", bonusQty: "", unitPrice: String(restockTarget.price ?? "") });
                setRestockSuccess(
                  superCashier
                    ? `تم تزويد المخزون وتسجيل التوريد باسمك`
                    : `تم التزويد وخصم ${restockPurchaseCost.toFixed(2)} شيكل من الخزنة`,
                );
                showAppToast("تم تزويد المخزون", "success");
                setTimeout(() => {
                  setRestockTarget(null);
                  setRestockSuccess("");
                }, 600);
              }}
              sx={{ textTransform: "none", fontWeight: 800 }}
            >
              تأكيد التزويد
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={Boolean(deleteDialogProduct)}
          onClose={() => setDeleteDialogProduct(null)}
          fullWidth
          maxWidth="sm"
          slotProps={{ paper: { sx: inventoryDialogPaperSx } }}
        >
          <DialogTitle sx={inventoryDialogTitleSx}>
            <IconButton aria-label="إغلاق" size="small" onClick={() => setDeleteDialogProduct(null)} sx={inventoryDialogCloseBtnSx}>
              <Close />
            </IconButton>
            <Typography component="div" variant="h6" fontWeight={800} sx={{ textAlign: "center", width: "100%", px: { xs: 4, sm: 8 } }}>
              حذف صنف من المخزون
            </Typography>
          </DialogTitle>
          <DialogContent dividers sx={{ textAlign: "right", px: { xs: 2, sm: 3 }, py: 2 }}>
            <Stack sx={{ gap: 1.5 }}>
              <Typography variant="body1">
                هل تريد حذف{" "}
                <strong>{deleteDialogProduct ? productDisplayName(deleteDialogProduct) : ""}</strong>؟
              </Typography>
              <Alert severity="info" sx={{ textAlign: "right" }}>
                قيمة المخزون الحالية تُحسب تقريباً: الكمية × سعر البيع. عند اختيار «إرجاع للخزنة» تُضاف هذه القيمة إلى رصيد الصندوق
                (كاش).
              </Alert>
              <Typography variant="h6" fontWeight={800} color="primary.main">
                {deleteDialogProduct
                  ? `${stockCreditForProduct(deleteDialogProduct).toFixed(2)} شيكل`
                  : "—"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                الكمية الحالية: {deleteDialogProduct ? Number(deleteDialogProduct.qty || 0) : "—"} — سعر البيع:{" "}
                {deleteDialogProduct ? Number(deleteDialogProduct.price || 0).toFixed(2) : "—"} شيكل
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions
            sx={{
              px: 3,
              py: 2,
              flexWrap: "wrap",
              gap: 1,
              justifyContent: "flex-start",
              bgcolor: alpha(theme.palette.action.hover, 0.06),
            }}
          >
            <Button onClick={() => setDeleteDialogProduct(null)} sx={{ textTransform: "none" }}>
              إلغاء
            </Button>
            <Button color="warning" onClick={() => confirmDeleteProduct(false)} sx={{ textTransform: "none" }}>
              حذف بدون إرجاع للخزنة
            </Button>
            <Button variant="contained" color="error" onClick={() => confirmDeleteProduct(true)} sx={{ textTransform: "none", fontWeight: 800 }}>
              حذف مع إرجاع للخزنة
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={Boolean(editTarget)}
          onClose={() => setEditTarget(null)}
          fullWidth
          maxWidth="md"
          slotProps={{ paper: { sx: inventoryDialogPaperSx } }}
        >
          <DialogTitle sx={inventoryDialogTitleSx}>
            <IconButton aria-label="إغلاق" size="small" onClick={() => setEditTarget(null)} sx={inventoryDialogCloseBtnSx}>
              <Close />
            </IconButton>
            <Typography component="div" variant="h6" fontWeight={800} sx={{ textAlign: "center", width: "100%", px: { xs: 4, sm: 8 } }}>
              تعديل الصنف
            </Typography>
          </DialogTitle>
          <DialogContent dividers sx={{ textAlign: "right", px: { xs: 2, sm: 2.5 }, py: 2 }}>
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="اسم الصنف"
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                  fullWidth
                  size="small"
                  inputProps={{ style: { textAlign: "right" } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="الباركود"
                  value={editForm.barcode}
                  onChange={(e) => setEditForm((p) => ({ ...p, barcode: e.target.value }))}
                  fullWidth
                  size="small"
                  inputProps={{ style: { textAlign: "right" } }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="تاريخ انتهاء الصلاحية"
                  type="date"
                  value={editForm.expiryDate}
                  onChange={(e) => setEditForm((p) => ({ ...p, expiryDate: e.target.value }))}
                  fullWidth
                  size="small"
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Select
                  fullWidth
                  size="small"
                  value={editForm.category}
                  onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))}
                >
                  {categoryOptions.map((n) => (
                    <MenuItem key={n} value={n}>
                      {n}
                    </MenuItem>
                  ))}
                </Select>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <Select
                  fullWidth
                  size="small"
                  value={editForm.saleType}
                  onChange={(e) => setEditForm((p) => ({ ...p, saleType: e.target.value }))}
                >
                  <MenuItem value="strip">شريط كامل</MenuItem>
                  <MenuItem value="pill">بالحبة</MenuItem>
                  <MenuItem value="bottle">قزازة</MenuItem>
                  <MenuItem value="box">علبة</MenuItem>
                  <MenuItem value="sachet">كيس</MenuItem>
                </Select>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="الكمية في المخزون"
                  type="number"
                  value={editForm.qty}
                  onChange={(e) => setEditForm((p) => ({ ...p, qty: normalizeOneDecimal(e.target.value) }))}
                  fullWidth
                  size="small"
                  inputProps={{ style: { textAlign: "right" }, step: "0.1", min: "0" }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="الحد الأدنى"
                  type="number"
                  value={editForm.min}
                  onChange={(e) => setEditForm((p) => ({ ...p, min: normalizeOneDecimal(e.target.value) }))}
                  fullWidth
                  size="small"
                  inputProps={{ style: { textAlign: "right" }, step: "0.1", min: "0" }}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="سعر البيع"
                  type="number"
                  value={editForm.price}
                  onChange={(e) => setEditForm((p) => ({ ...p, price: normalizeOneDecimal(e.target.value) }))}
                  fullWidth
                  size="small"
                  disabled={!isAdmin(currentUser)}
                  helperText={!isAdmin(currentUser) ? "تعديل السعر للمدير فقط — راجع المدير" : ""}
                  inputProps={{ style: { textAlign: "right" }, step: "0.1", min: "0" }}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <input
                  ref={editItemImageInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (!f?.type?.startsWith("image/")) return;
                    try {
                      const dataUrl = await compressImageFileToDataUrl(f);
                      setEditForm((p) => ({ ...p, imageUrl: dataUrl }));
                    } catch {
                      const r = new FileReader();
                      r.onload = () => setEditForm((p) => ({ ...p, imageUrl: String(r.result || "") }));
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
                    editItemImageInputRef.current?.click();
                  }}
                >
                  رفع صورة من الجهاز
                </Button>
                {editForm.imageUrl && String(editForm.imageUrl).startsWith("data:") ? (
                  <Typography variant="caption" color="success.main" sx={{ display: "block", mt: 0.75 }}>
                    تم اختيار صورة من الجهاز
                  </Typography>
                ) : null}
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Card variant="outlined" sx={{ p: 1.5, borderRadius: 2.5, borderColor: alpha(theme.palette.info.main, 0.35) }}>
                  <Typography variant="subtitle2" fontWeight={900} color="info.dark" sx={{ mb: 0.5 }}>
                    معلومات توجيهية (تظهر للكاشير قبل البيع)
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.25, lineHeight: 1.5 }}>
                    تعليمات الاستعمال والجرعة — للإرشاد فقط؛ المريض يتبع وصفة الطبيب.
                  </Typography>
                  <Stack spacing={1.25}>
                    <TextField
                      label="كيفية الاستعمال"
                      value={editForm.usageHowTo}
                      onChange={(e) => setEditForm((p) => ({ ...p, usageHowTo: e.target.value }))}
                      fullWidth
                      size="small"
                      multiline
                      minRows={2}
                      inputProps={{ style: { textAlign: "right" } }}
                    />
                    <TextField
                      label="عدد المرات باليوم / التوقيت"
                      value={editForm.usageFrequency}
                      onChange={(e) => setEditForm((p) => ({ ...p, usageFrequency: e.target.value }))}
                      fullWidth
                      size="small"
                      multiline
                      minRows={2}
                      inputProps={{ style: { textAlign: "right" } }}
                    />
                    <TextField
                      label="نصائح، تحذيرات، أو تخزين"
                      value={editForm.usageTips}
                      onChange={(e) => setEditForm((p) => ({ ...p, usageTips: e.target.value }))}
                      fullWidth
                      size="small"
                      multiline
                      minRows={2}
                      inputProps={{ style: { textAlign: "right" } }}
                    />
                  </Stack>
                </Card>
              </Grid>
              <Grid size={{ xs: 12 }}>
              <Card variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                <Typography variant="subtitle2" fontWeight={800}>
                  خيارات البيع (اختياري)
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, mb: 1.2 }}>
                  نفس منطق إضافة صنف جديد — الكاشير يختار خياراً عند البيع إن وُجدت خيارات هنا.
                </Typography>
                {(editForm.saleOptionRows || []).map((row, idx) => (
                  <Stack
                    key={row.id || `ed-opt-${idx}`}
                    direction={{ xs: "column", sm: "row" }}
                    spacing={1}
                    sx={{ mb: 1 }}
                    alignItems={{ sm: "center" }}
                  >
                    <TextField
                      size="small"
                      label="اسم الخيار"
                      value={row.label}
                      onChange={(e) => {
                        const v = e.target.value;
                        setEditForm((p) => {
                          const rows = [...(p.saleOptionRows || [])];
                          rows[idx] = { ...rows[idx], label: v };
                          return { ...p, saleOptionRows: rows };
                        });
                      }}
                      fullWidth
                      inputProps={{ style: { textAlign: "right" } }}
                    />
                    <TextField
                      size="small"
                      label="فرق السعر ±"
                      value={row.priceDelta}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setEditForm((p) => {
                          const rows = [...(p.saleOptionRows || [])];
                          rows[idx] = { ...rows[idx], priceDelta: raw };
                          return { ...p, saleOptionRows: rows };
                        });
                      }}
                      sx={{ width: { xs: "100%", sm: 140 } }}
                      inputProps={{ style: { textAlign: "right" } }}
                    />
                    <IconButton
                      aria-label="حذف خيار"
                      color="error"
                      size="small"
                      onClick={() =>
                        setEditForm((p) => ({
                          ...p,
                          saleOptionRows: (p.saleOptionRows || []).filter((_, i) => i !== idx),
                        }))
                      }
                    >
                      <DeleteOutline />
                    </IconButton>
                  </Stack>
                ))}
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<Add />}
                  onClick={() =>
                    setEditForm((p) => ({
                      ...p,
                      saleOptionRows: [
                        ...(p.saleOptionRows || []),
                        { id: `tmp-${Date.now()}`, label: "", priceDelta: "0" },
                      ],
                    }))
                  }
                  sx={{ textTransform: "none", mt: 0.5 }}
                >
                  إضافة خيار
                </Button>
              </Card>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, gap: 1, flexWrap: "wrap", bgcolor: alpha(theme.palette.action.hover, 0.06) }}>
            <Button onClick={() => setEditTarget(null)} sx={{ textTransform: "none" }}>
              إلغاء
            </Button>
            <Button
              variant="contained"
              onClick={() => {
                if (!editTarget || !editForm.name.trim()) {
                  showAppToast("اسم الصنف مطلوب", "error");
                  return;
                }
                const q = Number(normalizeOneDecimal(editForm.qty));
                const mn = Number(normalizeOneDecimal(editForm.min));
                const pr = Number(normalizeOneDecimal(editForm.price));
                if (Number.isNaN(q) || q < 0 || Number.isNaN(mn) || mn < 0 || Number.isNaN(pr) || pr < 0) {
                  showAppToast("تحقق من الكمية والحد الأدنى والسعر", "error");
                  return;
                }
                const img = editForm.imageUrl?.trim() || editTarget.image || "";
                const variantTrim = String(editForm.variantLabel || "").trim();
                const saleOpts = buildPersistedSaleOptions(editForm.saleOptionRows, editTarget.id);
                const barcodeTrim = String(editForm.barcode || "").trim();
                const expTrim = String(editForm.expiryDate || "").trim().slice(0, 10);
                const usageHowTrim = String(editForm.usageHowTo || "").trim();
                const usageFreqTrim = String(editForm.usageFrequency || "").trim();
                const usageTipsTrim = String(editForm.usageTips || "").trim();
                const next = items.map((it) => {
                  if (it.id !== editTarget.id) return it;
                  const row = {
                    ...it,
                    name: editForm.name.trim(),
                    category: editForm.category,
                    saleType: editForm.saleType,
                    qty: q,
                    min: mn,
                    price: isAdmin(currentUser) ? pr : Number(it.price) || pr,
                    image: img,
                  };
                  if (variantTrim) row.variantLabel = variantTrim;
                  else delete row.variantLabel;
                  if (saleOpts.length) row.saleOptions = saleOpts;
                  else delete row.saleOptions;
                  if (barcodeTrim) row.barcode = barcodeTrim;
                  else delete row.barcode;
                  if (expTrim) row.expiryDate = expTrim;
                  else delete row.expiryDate;
                  if (usageHowTrim) row.usageHowTo = usageHowTrim;
                  else delete row.usageHowTo;
                  if (usageFreqTrim) row.usageFrequency = usageFreqTrim;
                  else delete row.usageFrequency;
                  if (usageTipsTrim) row.usageTips = usageTipsTrim;
                  else delete row.usageTips;
                  return row;
                });
                if (isAdmin(currentUser) && Number(editTarget.price) !== Number(pr)) {
                  appendAudit({
                    action: "inventory_price_change",
                    details: JSON.stringify({
                      productId: editTarget.id,
                      name: editForm.name.trim(),
                      from: editTarget.price,
                      to: pr,
                    }),
                    username: currentUser?.username || "",
                    role: currentUser?.role || "",
                  });
                }
                persistProducts(next);
                setEditTarget(null);
                showAppToast("تم حفظ تعديلات الصنف", "success");
              }}
              sx={{ textTransform: "none", fontWeight: 800 }}
            >
              حفظ التعديلات
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </AdminLayout>
  );
}
