import {
  ArrowOutward,
  DeleteOutline,
  LocalOffer,
  Payments,
  RestaurantMenu,
  Timeline,
} from "@mui/icons-material";
import {
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
  LinearProgress,
  MenuItem,
  Pagination,
  Select,
  Stack,
  Tooltip,
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
import { useMemo, useState } from "react";
import FilterBarRow from "../../components/FilterBarRow";
import { adminPageContainerSx } from "../../utils/adminPageLayout";
import AdminLayout from "./AdminLayout";
import { appendAudit } from "../../utils/auditLog";
import { confirmApp, showAppToast } from "../../utils/appToast";
import { adjustCustomerBalance } from "../../utils/pharmacyDebtCustomers";
import { notifyStoreBalanceChanged } from "../../utils/storeBalanceSync";

const ROWS_PER_PAGE = 5;
const SALES_INVOICES_KEY = "salesInvoices";
const ADMIN_PRODUCTS_KEY = "adminProducts";
const STORE_BALANCE_KEY = "storeBalance";

function formatOneDecimal(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return "0.0";
  return x.toFixed(1);
}

export function displayCashierName(s) {
  if (s == null || s === "") return "-";
  const t = String(s).trim();
  const at = t.indexOf("@");
  if (at > 0) {
    const local = t.slice(0, at).trim();
    return local || "-";
  }
  return t || "-";
}

const float = keyframes`
  0%,100% { transform: translateY(0px); }
  50% { transform: translateY(-8px); }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

function paymentMethodLabel(m) {
  if (m === "app") return "تطبيق";
  if (m === "credit") return "آجل";
  return "كاش";
}

export default function InvoicesPage({ mode, onToggleMode }) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [periodView, setPeriodView] = useState("week");
  const [page, setPage] = useState(1);
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [detailInvoice, setDetailInvoice] = useState(null);
  const [invoiceStoreTick, setInvoiceStoreTick] = useState(0);
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch {
      return null;
    }
  }, []);
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "super_admin";

  const periodLabels = {
    day: "اليوم",
    week: "هذا الأسبوع",
    month: "هذا الشهر",
  };

  const stats = [
    { title: "اجمالي المبيعات", value: "142,580 شيكل", delta: "+12.5%", icon: <Payments />, color: "success" },
    { title: "عدد الطلبات", value: "1,248", delta: "+4.2%", icon: <RestaurantMenu />, color: "info" },
    { title: "متوسط الفاتورة", value: "114.2 شيكل", delta: "ثابت", icon: <Timeline />, color: "default" },
  ];

  const topItems = [
    {
      name: "مجموعة الفيتامينات اليومية",
      orders: "342 طلب",
      share: "15%",
      image: "https://images.unsplash.com/photo-1584017911766-d451b3d0e843?q=80&w=400&auto=format&fit=crop",
    },
    {
      name: "باقة العناية المتكاملة",
      orders: "285 طلب",
      share: "12%",
      image: "https://images.unsplash.com/photo-1612532275214-e4ca76d0e4d1?q=80&w=400&auto=format&fit=crop",
    },
    {
      name: "منتجات المناعة السريعة",
      orders: "210 طلب",
      share: "10%",
      image: "https://images.unsplash.com/photo-1626716493137-b67fe9501e76?q=80&w=400&auto=format&fit=crop",
    },
  ];

  const salesInvoices = useMemo(() => {
    void invoiceStoreTick;
    try {
      const raw = JSON.parse(localStorage.getItem(SALES_INVOICES_KEY));
      if (Array.isArray(raw) && raw.length) return raw;
    } catch {
      // ignore malformed storage
    }
    return [];
  }, [invoiceStoreTick]);
  const filteredInvoices = useMemo(() => {
    const q = invoiceSearch.trim().toLowerCase();
    const now = Date.now();
    return salesInvoices
      .filter((inv) => {
        const matchesSearch =
          !q ||
          String(inv.id).toLowerCase().includes(q) ||
          String(displayCashierName(inv.soldBy)).toLowerCase().includes(q) ||
          String(inv.soldBy || "").toLowerCase().includes(q) ||
          String(inv.soldByUsername || "").toLowerCase().includes(q) ||
          String(inv.paymentMethod || "").toLowerCase().includes(q);
        const matchesPayment =
          paymentFilter === "all" || String(inv.paymentMethod || "cash") === paymentFilter;
        if (dateFilter === "all") return matchesSearch && matchesPayment;
        const soldAtMs = new Date(inv.soldAt || 0).getTime();
        if (!soldAtMs) return false;
        const diffMs = now - soldAtMs;
        const dayMs = 24 * 60 * 60 * 1000;
        const matchesDate =
          (dateFilter === "today" && diffMs <= dayMs) ||
          (dateFilter === "7d" && diffMs <= 7 * dayMs) ||
          (dateFilter === "30d" && diffMs <= 30 * dayMs);
        return matchesSearch && matchesPayment && matchesDate;
      })
      .sort((a, b) => new Date(b.soldAt || 0).getTime() - new Date(a.soldAt || 0).getTime());
  }, [salesInvoices, invoiceSearch, dateFilter, paymentFilter]);
  const pageCount = Math.max(1, Math.ceil(filteredInvoices.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const paginatedTransactions = useMemo(() => {
    const start = (safePage - 1) * ROWS_PER_PAGE;
    return filteredInvoices.slice(start, start + ROWS_PER_PAGE);
  }, [filteredInvoices, safePage]);

  const voidSalesInvoice = async (inv) => {
    if (!inv || !isAdmin) return;
    const ok = await confirmApp({
      title: "إلغاء فاتورة البيع",
      message: `سيتم حذف الفاتورة ${inv.id} من السجل وعكس المخزون، والصندوق أو رصيد زبون الآجل إن وُجد. لا يمكن التراجع تلقائياً.`,
      confirmText: "تنفيذ الإلغاء",
    });
    if (!ok) return;
    try {
      const raw = JSON.parse(localStorage.getItem(ADMIN_PRODUCTS_KEY));
      if (Array.isArray(raw)) {
        const next = raw.map((p) => {
          let add = 0;
          for (const it of inv.items || []) {
            if (Number(it.productId) === Number(p.id)) add += Number(it.qty || 0);
          }
          if (!add) return p;
          return { ...p, qty: Number((Number(p.qty || 0) + add).toFixed(1)) };
        });
        localStorage.setItem(ADMIN_PRODUCTS_KEY, JSON.stringify(next));
      }
    } catch {
      // ignore
    }
    if (inv.paymentMethod !== "credit") {
      try {
        const bal = JSON.parse(localStorage.getItem(STORE_BALANCE_KEY));
        if (bal && typeof bal === "object") {
          const t = Number(inv.total || 0);
          const next = {
            ...bal,
            total: Math.max(0, Number(bal.total || 0) - t),
            cash:
              inv.paymentMethod === "cash" ? Math.max(0, Number(bal.cash || 0) - t) : Number(bal.cash || 0),
            app: inv.paymentMethod === "app" ? Math.max(0, Number(bal.app || 0) - t) : Number(bal.app || 0),
            updatedAt: new Date().toISOString(),
          };
          localStorage.setItem(STORE_BALANCE_KEY, JSON.stringify(next));
          notifyStoreBalanceChanged();
        }
      } catch {
        // ignore
      }
    } else if (inv.creditCustomerId) {
      adjustCustomerBalance(inv.creditCustomerId, -Number(inv.total || 0), {
        type: "invoice_void_reversal",
        source: "admin",
        invoiceId: inv.id,
        username: currentUser?.username || "",
        note: "إلغاء فاتورة آجل — خصم من الدين",
      });
    }
    try {
      const existing = JSON.parse(localStorage.getItem(SALES_INVOICES_KEY));
      const next = (Array.isArray(existing) ? existing : []).filter((x) => x.id !== inv.id);
      localStorage.setItem(SALES_INVOICES_KEY, JSON.stringify(next));
    } catch {
      localStorage.setItem(SALES_INVOICES_KEY, JSON.stringify([]));
    }
    appendAudit({
      action: "invoice_void",
      details: JSON.stringify({ id: inv.id, total: inv.total, paymentMethod: inv.paymentMethod }),
      username: currentUser?.username || "",
      role: currentUser?.role || "",
    });
    setInvoiceStoreTick((x) => x + 1);
    setDetailInvoice(null);
    showAppToast("تم إلغاء الفاتورة وعكس التأثيرات المحلية", "success");
  };

  const chartBarsByPeriod = {
    day: [38, 45, 51, 49, 62, 74, 68],
    week: [45, 58, 49, 67, 62, 73, 86],
    month: [52, 61, 57, 70, 66, 79, 92],
  };
  const chartBars = chartBarsByPeriod[periodView];

  return (
    <AdminLayout mode={mode} onToggleMode={onToggleMode}>
      <Box sx={adminPageContainerSx}>
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="h5" fontWeight={900} sx={{ mb: 0.6 }}>
            نظرة عامة على المبيعات
          </Typography>
          <Box
            sx={{
              width: 56,
              height: 4,
              borderRadius: 99,
              bgcolor: "primary.main",
              boxShadow: `0 0 16px ${alpha(theme.palette.primary.main, 0.6)}`,
              display: { xs: "none", sm: "block" },
            }}
          />
        </Box>
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
              placeholder="ابحث برقم الفاتورة أو اسم الكاشير..."
              value={invoiceSearch}
              onChange={(e) => {
                setInvoiceSearch(e.target.value);
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
              value={paymentFilter}
              onChange={(e) => {
                setPaymentFilter(e.target.value);
                setPage(1);
              }}
              sx={{ minWidth: 140, flex: "0 0 auto" }}
            >
              <MenuItem value="all">كل طرق الدفع</MenuItem>
              <MenuItem value="cash">كاش</MenuItem>
              <MenuItem value="app">تطبيق</MenuItem>
              <MenuItem value="credit">آجل</MenuItem>
            </Select>
            <Button
              variant="outlined"
              onClick={() => {
                setInvoiceSearch("");
                setDateFilter("all");
                setPaymentFilter("all");
                setPage(1);
              }}
              sx={{ textTransform: "none", fontWeight: 700, flex: "0 0 auto", whiteSpace: "nowrap" }}
            >
              إعادة الضبط
            </Button>
          </FilterBarRow>
        </Card>

        <Grid container spacing={2}>
          {stats.map((item, idx) => (
            <Grid key={item.title} size={{ xs: 12, md: 4 }}>
              <Card
                sx={{
                  p: 2.2,
                  borderRadius: 3,
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                  bgcolor: alpha(theme.palette.background.paper, 0.75),
                  backdropFilter: "blur(8px)",
                  transition: "transform .25s ease, box-shadow .25s ease",
                  animation: `${float} ${3 + idx * 0.45}s ease-in-out infinite`,
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: `0 14px 30px ${alpha(theme.palette.primary.main, 0.2)}`,
                  },
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                  <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.16), color: "primary.main" }}>{item.icon}</Avatar>
                  <Chip size="small" color={item.color} label={item.delta} variant="outlined" />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {item.title}
                </Typography>
                <Typography variant="h5" fontWeight={900} sx={{ mt: 0.5 }}>
                  {item.value}
                </Typography>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Grid container spacing={2} sx={{ mt: 0.5 }}>
          <Grid size={{ xs: 12, lg: 8 }}>
            <Card
              sx={{
                p: 2.5,
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
                bgcolor: alpha(theme.palette.background.paper, 0.72),
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
                <Box>
                  <Typography fontWeight={800}>تحليل المبيعات - {periodLabels[periodView]}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    الأداء خلال آخر 7 أيام
                  </Typography>
                </Box>
                <Stack direction="row" sx={{ gap: 1 }}>
                  {[
                    { key: "day", label: "يوم" },
                    { key: "week", label: "أسبوع" },
                    { key: "month", label: "شهر" },
                  ].map((period) => (
                    <Button
                      key={period.key}
                      onClick={() => setPeriodView(period.key)}
                      variant={periodView === period.key ? "contained" : "text"}
                      sx={{ minWidth: 82, textTransform: "none", borderRadius: 2, fontWeight: 700 }}
                    >
                      {period.label}
                    </Button>
                  ))}
                  <Button variant="outlined" endIcon={<ArrowOutward />} sx={{ textTransform: "none" }}>
                    تقرير مفصل
                  </Button>
                </Stack>
              </Stack>

              <Stack direction="row" alignItems="end" sx={{ height: 220, gap: 1 }}>
                {chartBars.map((bar, idx) => (
                  <Box
                    key={idx}
                    sx={{
                      flex: 1,
                      height: `${bar}%`,
                      borderRadius: "12px 12px 4px 4px",
                      background: `linear-gradient(180deg, ${alpha(theme.palette.primary.main, isDark ? 0.98 : 0.88)}, ${alpha(theme.palette.primary.main, isDark ? 0.42 : 0.24)})`,
                      backgroundSize: "200% 100%",
                      animation: `${shimmer} 3.5s linear infinite`,
                      boxShadow:
                        idx === 6
                          ? `0 0 18px ${alpha(theme.palette.primary.main, isDark ? 0.58 : 0.45)}`
                          : isDark
                            ? `0 0 8px ${alpha(theme.palette.primary.main, 0.24)}`
                            : "none",
                    }}
                  />
                ))}
              </Stack>
              <LinearProgress
                value={periodView === "day" ? 74 : periodView === "week" ? 86 : 92}
                variant="determinate"
                sx={{ mt: 2, borderRadius: 99, height: 7 }}
              />
            </Card>
          </Grid>

          <Grid size={{ xs: 12, lg: 4 }}>
            <Card
              sx={{
                p: 2.5,
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
                bgcolor: alpha(theme.palette.background.paper, 0.72),
                height: "100%",
              }}
            >
              <Typography fontWeight={800} sx={{ mb: 2.2 }}>
                الأصناف الأكثر طلبًا
              </Typography>
              <Stack sx={{ gap: 1.5 }}>
                {topItems.map((item) => (
                  <Stack key={item.name} direction="row" alignItems="center" sx={{ gap: 1.25 }}>
                    <Avatar src={item.image} variant="rounded" sx={{ width: 46, height: 46, borderRadius: 1.8 }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight={700}>
                        {item.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {item.orders}
                      </Typography>
                    </Box>
                    <Typography color="primary.main" fontWeight={800}>
                      {item.share}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
              <Button fullWidth variant="outlined" sx={{ mt: 2, textTransform: "none" }}>
                عرض التقرير الكامل
              </Button>
            </Card>
          </Grid>
        </Grid>

        <Card
          sx={{
            mt: 2,
            borderRadius: 3,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
            bgcolor: alpha(theme.palette.background.paper, 0.72),
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2.2 }}>
            <Typography fontWeight={800}>آخر العمليات</Typography>
            <Button size="small" startIcon={<LocalOffer />} sx={{ textTransform: "none" }}>
              تصدير البيانات
            </Button>
          </Stack>
          <Divider />
          <Box sx={{ p: 1.2 }}>
            <TableContainer>
              <Table size="small" sx={{ tableLayout: "fixed" }}>
                <TableHead>
                  <TableRow>
                    <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>رقم الفاتورة</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>البائع</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>التاريخ</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>الدفع</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>الإجمالي</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>الحالة</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>تفاصيل</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>حذف</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedTransactions.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell align="center" sx={{ fontWeight: 800, color: "primary.main" }}>{row.id}</TableCell>
                      <TableCell align="center">
                        <Typography variant="body2">{displayCashierName(row.soldBy)}</Typography>
                      </TableCell>
                      <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                        {row.soldAt ? new Date(row.soldAt).toLocaleString("en-GB") : "-"}
                      </TableCell>
                      <TableCell align="center">{paymentMethodLabel(row.paymentMethod)}</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>{formatOneDecimal(row.total)} شيكل</TableCell>
                      <TableCell align="center">
                        <Chip
                          size="small"
                          label={row.status || "مكتمل"}
                          color={(row.status || "مكتمل") === "مكتمل" ? "success" : "info"}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setDetailInvoice(row)}
                          sx={{ textTransform: "none", fontWeight: 700 }}
                        >
                          عرض
                        </Button>
                      </TableCell>
                      <TableCell align="center">
                        {isAdmin ? (
                          <Tooltip title="إلغاء الفاتورة وعكس التأثيرات">
                            <IconButton
                              size="small"
                              color="error"
                              aria-label="حذف"
                              onClick={() => void voidSalesInvoice(row)}
                            >
                              <DeleteOutline fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Typography variant="caption" color="text.disabled">
                            —
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            <Stack direction="row" justifyContent="center" sx={{ mt: 1 }}>
              <Pagination
                count={pageCount}
                page={safePage}
                onChange={(_, value) => setPage(value)}
                color="primary"
                shape="rounded"
              />
            </Stack>
          </Box>
        </Card>

        <Dialog open={Boolean(detailInvoice)} onClose={() => setDetailInvoice(null)} fullWidth maxWidth="md">
          <DialogTitle sx={{ textAlign: "right" }}>
            تفاصيل فاتورة البيع — {detailInvoice?.id}
          </DialogTitle>
          <DialogContent sx={{ textAlign: "right" }}>
            <Stack sx={{ gap: 1, mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                البائع: <b>{displayCashierName(detailInvoice?.soldBy)}</b>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                التاريخ والوقت:{" "}
                <b>{detailInvoice?.soldAt ? new Date(detailInvoice.soldAt).toLocaleString("en-GB") : "-"}</b>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                طريقة الدفع: <b>{paymentMethodLabel(detailInvoice?.paymentMethod)}</b>
                {detailInvoice?.paymentMethod === "credit" && detailInvoice?.creditCustomerName ? (
                  <>
                    {" "}
                    (<b>{detailInvoice.creditCustomerName}</b>)
                  </>
                ) : null}
                {" — "}
                الحالة: <b>{detailInvoice?.status || "مكتمل"}</b>
              </Typography>
              {Number(detailInvoice?.discountAmount || 0) > 0 ? (
                <Typography variant="body2" color="text.secondary">
                  خصم: <b>{formatOneDecimal(detailInvoice.discountAmount)} شيكل</b>
                  {detailInvoice?.subTotal != null ? (
                    <>
                      {" "}
                      (قبل الخصم: {formatOneDecimal(detailInvoice.subTotal)} شيكل)
                    </>
                  ) : null}
                </Typography>
              ) : null}
            </Stack>
            <TableContainer component={Card} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>#</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>الصنف</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>الكمية</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>سعر الوحدة</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>الإجمالي</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(Array.isArray(detailInvoice?.items) && detailInvoice.items.length ? detailInvoice.items : []).map((it, i) => {
                    const qty = Number(it.qty ?? 0);
                    const unit = Number(it.price ?? 0);
                    const lineTotal = Number(it.total ?? qty * unit);
                    return (
                      <TableRow key={`${it.productId ?? it.name}-${i}`}>
                        <TableCell align="center">{i + 1}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600 }}>{it.name || "-"}</TableCell>
                        <TableCell align="center">{formatOneDecimal(qty)}</TableCell>
                        <TableCell align="center">{formatOneDecimal(unit)} شيكل</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>{formatOneDecimal(lineTotal)} شيكل</TableCell>
                      </TableRow>
                    );
                  })}
                  {(!detailInvoice?.items || !detailInvoice.items.length) ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <Typography variant="body2" color="text.secondary">لا توجد بنود مسجلة لهذه الفاتورة</Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
            <Stack sx={{ mt: 2, gap: 0.5, alignItems: "flex-end" }}>
              {detailInvoice?.subTotal != null ? (
                <Typography variant="body2" color="text.secondary">
                  المجموع الفرعي: <b>{formatOneDecimal(detailInvoice.subTotal)} شيكل</b>
                </Typography>
              ) : null}
              {detailInvoice?.vat != null && Number(detailInvoice.vat) > 0 ? (
                <Typography variant="body2" color="text.secondary">
                  الضريبة (15%): <b>{formatOneDecimal(detailInvoice.vat)} شيكل</b>
                </Typography>
              ) : null}
              <Typography variant="subtitle1" fontWeight={900}>
                صافي الفاتورة: {formatOneDecimal(detailInvoice?.total)} شيكل
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
            {isAdmin ? (
              <Button
                color="error"
                variant="outlined"
                onClick={() => voidSalesInvoice(detailInvoice)}
                sx={{ textTransform: "none", fontWeight: 800 }}
              >
                إلغاء الفاتورة (مدير)
              </Button>
            ) : null}
            <Button variant="contained" onClick={() => setDetailInvoice(null)} sx={{ textTransform: "none" }}>
              إغلاق
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </AdminLayout>
  );
}
