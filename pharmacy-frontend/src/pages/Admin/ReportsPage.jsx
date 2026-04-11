import { Add, Assessment, Print, TrendingUp } from "@mui/icons-material";
import FilterBarRow from "../../components/FilterBarRow";
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
  Divider,
  Grid,
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
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { PHARMACY_DISPLAY_NAME } from "../../config/appBranding";
import { adminPageContainerSx, adminPageSubtitleSx, adminPageTitleRowSx } from "../../utils/adminPageLayout";
import AdminLayout from "./AdminLayout";
import { displayCashierName } from "./InvoicesPage";

const ROWS_PER_PAGE = 5;
const SALES_INVOICES_KEY = "salesInvoices";
const PURCHASE_INVOICES_KEY = "purchaseInvoices";

function formatOneDecimal(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return "0.0";
  return x.toFixed(1);
}

function salePaymentLabel(m) {
  if (m === "app") return "تطبيق";
  if (m === "credit") return "آجل";
  return "كاش";
}

function readSalesInvoices() {
  try {
    const raw = JSON.parse(localStorage.getItem(SALES_INVOICES_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function readPurchaseInvoices() {
  try {
    const raw = JSON.parse(localStorage.getItem(PURCHASE_INVOICES_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export default function ReportsPage({ mode, onToggleMode }) {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const isPurchasesReport = location.pathname.includes("/reports/purchases");

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [cashierFilter, setCashierFilter] = useState("all");
  const [detailRow, setDetailRow] = useState(null);
  const [printNonce, setPrintNonce] = useState(0);

  const salesInvoices = useMemo(() => readSalesInvoices(), [location.pathname]);
  const purchaseInvoices = useMemo(() => readPurchaseInvoices(), [location.pathname]);

  const cashierOptions = useMemo(() => {
    const set = new Set();
    salesInvoices.forEach((inv) => {
      const key = String(inv.soldByUsername || inv.soldBy || "").trim();
      if (key) set.add(key);
    });
    return Array.from(set).sort();
  }, [salesInvoices]);

  const filteredSales = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    return salesInvoices
      .filter((inv) => {
        const matchesSearch =
          !q ||
          String(inv.id || "")
            .toLowerCase()
            .includes(q) ||
          String(inv.soldBy || "")
            .toLowerCase()
            .includes(q) ||
          String(inv.soldByUsername || "")
            .toLowerCase()
            .includes(q);
        const matchesPay =
          paymentFilter === "all" || String(inv.paymentMethod || "cash") === paymentFilter;
        const matchesCashier =
          cashierFilter === "all" || String(inv.soldByUsername || inv.soldBy || "") === cashierFilter;
        if (dateFilter === "all") return matchesSearch && matchesPay && matchesCashier;
        const t = new Date(inv.soldAt || 0).getTime();
        if (!t) return false;
        const diff = now - t;
        const day = 86400000;
        const okDate =
          (dateFilter === "today" && diff <= day) ||
          (dateFilter === "7d" && diff <= 7 * day) ||
          (dateFilter === "30d" && diff <= 30 * day);
        return matchesSearch && matchesPay && matchesCashier && okDate;
      })
      .sort((a, b) => new Date(b.soldAt || 0).getTime() - new Date(a.soldAt || 0).getTime());
  }, [salesInvoices, search, dateFilter, paymentFilter, cashierFilter]);

  const filteredPurchases = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    return purchaseInvoices
      .filter((row) => {
        const matchesSearch =
          !q ||
          String(row.id || "")
            .toLowerCase()
            .includes(q) ||
          String(row.purchasedBy || "")
            .toLowerCase()
            .includes(q) ||
          String(row.supplier || "")
            .toLowerCase()
            .includes(q);
        if (dateFilter === "all") return matchesSearch;
        const t = new Date(row.purchasedAt || 0).getTime();
        if (!t) return false;
        const diff = now - t;
        const day = 86400000;
        const okDate =
          (dateFilter === "today" && diff <= day) ||
          (dateFilter === "7d" && diff <= 7 * day) ||
          (dateFilter === "30d" && diff <= 30 * day);
        return matchesSearch && okDate;
      })
      .sort((a, b) => new Date(b.purchasedAt || 0).getTime() - new Date(a.purchasedAt || 0).getTime());
  }, [purchaseInvoices, search, dateFilter]);

  const activeList = isPurchasesReport ? filteredPurchases : filteredSales;
  const pageCount = Math.max(1, Math.ceil(activeList.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const rows = useMemo(() => {
    const start = (safePage - 1) * ROWS_PER_PAGE;
    return activeList.slice(start, start + ROWS_PER_PAGE);
  }, [activeList, safePage]);

  const salesTotals = useMemo(() => {
    const t = filteredSales.reduce((s, inv) => s + Number(inv.total || 0), 0);
    return { count: filteredSales.length, total: t };
  }, [filteredSales]);

  const purchaseTotals = useMemo(() => {
    const active = filteredPurchases.filter((r) => String(r.status || "") !== "مرجع");
    const t = active.reduce((s, r) => s + Number(r.total || 0), 0);
    return { count: active.length, total: t };
  }, [filteredPurchases]);

  useEffect(() => {
    if (!printNonce) return;
    const t = window.setTimeout(() => window.print(), 120);
    return () => window.clearTimeout(t);
  }, [printNonce]);

  const monthlyBars = useMemo(() => {
    const y = new Date().getFullYear();
    const m = new Date().getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const dayTotals = Array.from({ length: daysInMonth }, () => 0);
    salesInvoices.forEach((inv) => {
      const d = new Date(inv.soldAt || 0);
      if (d.getFullYear() !== y || d.getMonth() !== m) return;
      const day = d.getDate() - 1;
      dayTotals[day] += Number(inv.total || 0);
    });
    const max = Math.max(...dayTotals, 1);
    return dayTotals.map((v, i) => ({
      label: String(i + 1),
      value: v,
      heightPct: Math.max(6, Math.round((v / max) * 100)),
    }));
  }, [salesInvoices]);

  const salesAvgAfterFilter = useMemo(() => {
    const n = filteredSales.length;
    if (!n) return 0;
    return salesTotals.total / n;
  }, [filteredSales.length, salesTotals.total]);

  const purchaseAvgAfterFilter = useMemo(() => {
    const n = purchaseTotals.count;
    if (!n) return 0;
    return purchaseTotals.total / n;
  }, [purchaseTotals.count, purchaseTotals.total]);

  const salesMonthBest = useMemo(() => {
    let max = 0;
    let day = "—";
    monthlyBars.forEach((b) => {
      if (b.value > max) {
        max = b.value;
        day = b.label;
      }
    });
    return { max, day };
  }, [monthlyBars]);

  return (
    <AdminLayout mode={mode} onToggleMode={onToggleMode}>
      <Box sx={adminPageContainerSx}>
        <Stack sx={{ ...adminPageTitleRowSx, alignItems: { xs: "stretch", sm: "flex-start" } }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" fontWeight={900}>
              {isPurchasesReport ? "تقارير المشتريات" : "تقارير المبيعات"}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={adminPageSubtitleSx}>
              بيانات فعلية من فواتير النظام المحلية مع تصفية وتحليل شهري
            </Typography>
          </Box>
          {isPurchasesReport ? (
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => navigate("/admin/inventory")}
              sx={{ textTransform: "none", fontWeight: 800, alignSelf: { xs: "stretch", sm: "auto" } }}
            >
              إضافة عملية شراء (صنف جديد)
            </Button>
          ) : null}
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
              placeholder={isPurchasesReport ? "بحث برقم الطلب أو المنفذ أو المورد…" : "بحث برقم الفاتورة أو الكاشير…"}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
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
            {!isPurchasesReport ? (
              <>
                <Select
                  size="small"
                  value={paymentFilter}
                  onChange={(e) => {
                    setPaymentFilter(e.target.value);
                    setPage(1);
                  }}
                  sx={{ minWidth: 132, flex: "0 0 auto" }}
                >
                  <MenuItem value="all">كل الدفع</MenuItem>
                  <MenuItem value="cash">كاش</MenuItem>
                  <MenuItem value="app">تطبيق</MenuItem>
                  <MenuItem value="credit">آجل</MenuItem>
                </Select>
                <Select
                  size="small"
                  value={cashierFilter}
                  onChange={(e) => {
                    setCashierFilter(e.target.value);
                    setPage(1);
                  }}
                  sx={{ minWidth: 156, flex: "0 0 auto" }}
                >
                  <MenuItem value="all">كل الكاشيرين</MenuItem>
                  {cashierOptions.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </Select>
              </>
            ) : null}
            <Button
              variant="outlined"
              onClick={() => {
                setSearch("");
                setDateFilter("all");
                setPaymentFilter("all");
                setCashierFilter("all");
                setPage(1);
              }}
              sx={{ textTransform: "none", fontWeight: 700, flex: "0 0 auto", whiteSpace: "nowrap" }}
            >
              إعادة الضبط
            </Button>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<Print />}
              onClick={() => setPrintNonce((n) => n + 1)}
              disabled={!activeList.length}
              sx={{ textTransform: "none", fontWeight: 800, flex: "0 0 auto", whiteSpace: "nowrap" }}
            >
              طباعة التقرير
            </Button>
          </FilterBarRow>
        </Card>

        {!isPurchasesReport ? (
          <Card sx={{ p: 2, mb: 2, borderRadius: 3, border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}` }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" sx={{ gap: 1, mb: 1.5 }}>
              <Stack direction="row" alignItems="center" sx={{ gap: 1 }}>
                <TrendingUp color="primary" />
                <Box>
                  <Typography fontWeight={800}>تحليل المبيعات — الشهر الحالي</Typography>
                  <Typography variant="caption" color="text.secondary">
                    الأعمدة تمتد على كامل العرض — كل عمود يوم من الشهر (شيكل)
                  </Typography>
                </Box>
              </Stack>
              {salesMonthBest.max > 0 ? (
                <Chip
                  size="small"
                  color="secondary"
                  variant="outlined"
                  label={`أعلى يوم: ${salesMonthBest.day} · ${formatOneDecimal(salesMonthBest.max)} شيكل`}
                  sx={{ fontWeight: 800 }}
                />
              ) : null}
            </Stack>
            <Box sx={{ width: "100%", height: 240, display: "flex", alignItems: "flex-end", gap: 0.35, px: 0.25 }}>
              {monthlyBars.map((b) => (
                <Tooltip
                  key={b.label}
                  title={
                    <Box sx={{ p: 0.5, textAlign: "right" }}>
                      <Typography fontWeight={800}>يوم {b.label}</Typography>
                      <Typography variant="body2">المبيعات: {formatOneDecimal(b.value)} شيكل</Typography>
                    </Box>
                  }
                  arrow
                  placement="top"
                >
                  <Box
                    sx={{
                      flex: "1 1 0",
                      minWidth: 0,
                      height: `${b.heightPct}%`,
                      minHeight: 8,
                      borderRadius: "6px 6px 2px 2px",
                      bgcolor: alpha(theme.palette.primary.main, 0.5),
                      cursor: "default",
                      transition: "background-color 0.15s ease, transform 0.15s ease",
                      "&:hover": {
                        bgcolor: theme.palette.primary.main,
                        transform: "scaleY(1.02)",
                      },
                    }}
                  />
                </Tooltip>
              ))}
            </Box>
          </Card>
        ) : null}

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Card sx={{ p: 2, borderRadius: 3 }}>
              <Typography variant="caption" color="text.secondary">
                {isPurchasesReport ? "عدد القسائم (بعد التصفية)" : "عدد الفواتير"}
              </Typography>
              <Typography variant="h5" fontWeight={900}>
                {isPurchasesReport ? purchaseTotals.count : salesTotals.count}
              </Typography>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Card sx={{ p: 2, borderRadius: 3 }}>
              <Typography variant="caption" color="text.secondary">
                {isPurchasesReport ? "إجمالي المشتريات" : "إجمالي المبيعات"}
              </Typography>
              <Typography variant="h5" fontWeight={900}>
                {formatOneDecimal(isPurchasesReport ? purchaseTotals.total : salesTotals.total)} شيكل
              </Typography>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Card sx={{ p: 2, borderRadius: 3 }}>
              <Typography variant="caption" color="text.secondary">
                {isPurchasesReport ? "متوسط قيمة الطلب (بعد التصفية)" : "متوسط قيمة الفاتورة (بعد التصفية)"}
              </Typography>
              <Typography variant="h5" fontWeight={900}>
                {formatOneDecimal(isPurchasesReport ? purchaseAvgAfterFilter : salesAvgAfterFilter)} شيكل
              </Typography>
              {!isPurchasesReport && salesMonthBest.max > 0 ? (
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.75 }}>
                  أعلى يوم هذا الشهر: يوم {salesMonthBest.day} ({formatOneDecimal(salesMonthBest.max)} شيكل)
                </Typography>
              ) : null}
            </Card>
          </Grid>
        </Grid>

        <Card sx={{ borderRadius: 3, border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}` }}>
          <Stack direction="row" alignItems="center" sx={{ p: 2, gap: 1 }}>
            <Assessment color="primary" />
            <Typography fontWeight={800}>{isPurchasesReport ? "جدول مشتريات" : "جدول مبيعات"}</Typography>
          </Stack>
          <Divider />
          <Box sx={{ p: 1.2 }}>
            <TableContainer>
              <Table size="small" sx={{ tableLayout: "fixed" }}>
                <TableHead>
                  <TableRow>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>
                      الرقم
                    </TableCell>
                    {!isPurchasesReport ? (
                      <TableCell align="center" sx={{ fontWeight: 800 }}>
                        الكاشير
                      </TableCell>
                    ) : (
                      <TableCell align="center" sx={{ fontWeight: 800 }}>
                        المنفذ
                      </TableCell>
                    )}
                    <TableCell align="center" sx={{ fontWeight: 800 }}>
                      التاريخ والوقت
                    </TableCell>
                    {!isPurchasesReport ? (
                      <TableCell align="center" sx={{ fontWeight: 800 }}>
                        الدفع
                      </TableCell>
                    ) : null}
                    <TableCell align="center" sx={{ fontWeight: 800 }}>
                      الإجمالي
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>
                      تفاصيل
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isPurchasesReport ? 5 : 6} align="center">
                        <Typography color="text.secondary" sx={{ py: 3 }}>
                          لا توجد بيانات مطابقة
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : isPurchasesReport ? (
                    rows.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell align="center" sx={{ fontWeight: 800, color: "primary.main" }}>
                          {row.id}
                        </TableCell>
                        <TableCell align="center">{row.purchasedBy || "—"}</TableCell>
                        <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                          {row.purchasedAt ? new Date(row.purchasedAt).toLocaleString("en-GB") : "—"}
                        </TableCell>
                        <TableCell align="center">{formatOneDecimal(row.total)} شيكل</TableCell>
                        <TableCell align="center">
                          <Button size="small" variant="outlined" onClick={() => setDetailRow(row)} sx={{ textTransform: "none" }}>
                            عرض
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell align="center" sx={{ fontWeight: 800, color: "primary.main" }}>
                          {row.id}
                        </TableCell>
                        <TableCell align="center">{displayCashierName(row.soldBy)}</TableCell>
                        <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                          {row.soldAt ? new Date(row.soldAt).toLocaleString("en-GB") : "—"}
                        </TableCell>
                        <TableCell align="center">{salePaymentLabel(row.paymentMethod)}</TableCell>
                        <TableCell align="center">{formatOneDecimal(row.total)} شيكل</TableCell>
                        <TableCell align="center">
                          <Button size="small" variant="outlined" onClick={() => setDetailRow(row)} sx={{ textTransform: "none" }}>
                            عرض
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            {activeList.length > 0 ? (
              <Stack direction="row" justifyContent="center" sx={{ mt: 1 }}>
                <Pagination count={pageCount} page={safePage} onChange={(_, v) => setPage(v)} color="primary" shape="rounded" />
              </Stack>
            ) : null}
          </Box>
        </Card>

        <Dialog open={Boolean(detailRow)} onClose={() => setDetailRow(null)} fullWidth maxWidth="md">
          <DialogTitle sx={{ textAlign: "right" }}>
            {isPurchasesReport ? "تفاصيل شراء" : "تفاصيل فاتورة"} — {detailRow?.id}
          </DialogTitle>
          <DialogContent sx={{ textAlign: "right" }}>
            {!isPurchasesReport && detailRow ? (
              <Stack sx={{ gap: 0.5, mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  الكاشير: <b>{displayCashierName(detailRow.soldBy)}</b>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  الوقت: <b>{detailRow.soldAt ? new Date(detailRow.soldAt).toLocaleString("en-GB") : "—"}</b>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  الدفع: <b>{salePaymentLabel(detailRow.paymentMethod)}</b> — الإجمالي:{" "}
                  <b>{formatOneDecimal(detailRow.total)} شيكل</b>
                  {Number(detailRow.discountAmount || 0) > 0 ? (
                    <>
                      {" "}
                      — خصم: <b>{formatOneDecimal(detailRow.discountAmount)} شيكل</b>
                    </>
                  ) : null}
                </Typography>
              </Stack>
            ) : null}
            {isPurchasesReport && detailRow ? (
              <Stack sx={{ gap: 0.5, mb: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  المنفذ: <b>{detailRow.purchasedBy || "—"}</b>
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  الوقت: <b>{detailRow.purchasedAt ? new Date(detailRow.purchasedAt).toLocaleString("en-GB") : "—"}</b>
                </Typography>
              </Stack>
            ) : null}
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell align="center">#</TableCell>
                  <TableCell align="center">الصنف</TableCell>
                  <TableCell align="center">الكمية</TableCell>
                  <TableCell align="center">السعر</TableCell>
                  <TableCell align="center">الإجمالي</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(Array.isArray(detailRow?.items) ? detailRow.items : []).map((it, i) => {
                  const qty = Number(it.qty ?? 0);
                  const price = Number(it.price ?? it.unitPrice ?? 0);
                  const line = Number(it.total ?? qty * price);
                  return (
                    <TableRow key={i}>
                      <TableCell align="center">{i + 1}</TableCell>
                      <TableCell align="center">{it.name || "—"}</TableCell>
                      <TableCell align="center">{formatOneDecimal(qty)}</TableCell>
                      <TableCell align="center">{formatOneDecimal(price)}</TableCell>
                      <TableCell align="center">{formatOneDecimal(line)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button variant="contained" onClick={() => setDetailRow(null)} sx={{ textTransform: "none" }}>
              إغلاق
            </Button>
          </DialogActions>
        </Dialog>

        <div className="pharmacy-print-reports" dir="rtl">
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10 }}>
            {PHARMACY_DISPLAY_NAME} — {isPurchasesReport ? "تقرير مشتريات" : "تقرير مبيعات"}
          </div>
          <div style={{ fontSize: 11, marginBottom: 12, color: "#333" }}>
            {new Date().toLocaleString("ar-EG")} — عدد السجلات بعد التصفية: {activeList.length}
          </div>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 10,
            }}
          >
            <thead>
              <tr style={{ borderBottom: "2px solid #000" }}>
                <th style={{ textAlign: "right", padding: "6px 4px" }}>الرقم</th>
                {!isPurchasesReport ? <th style={{ textAlign: "right", padding: "6px 4px" }}>الكاشير</th> : null}
                {!isPurchasesReport ? null : <th style={{ textAlign: "right", padding: "6px 4px" }}>المنفذ</th>}
                <th style={{ textAlign: "right", padding: "6px 4px" }}>التاريخ</th>
                {!isPurchasesReport ? <th style={{ textAlign: "right", padding: "6px 4px" }}>الدفع</th> : null}
                <th style={{ textAlign: "right", padding: "6px 4px" }}>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {activeList.map((row) => (
                <tr key={row.id} style={{ borderBottom: "1px solid #ccc" }}>
                  <td style={{ padding: "5px 4px" }}>{row.id}</td>
                  {!isPurchasesReport ? (
                    <td style={{ padding: "5px 4px" }}>{displayCashierName(row.soldBy)}</td>
                  ) : (
                    <td style={{ padding: "5px 4px" }}>{row.purchasedBy || "—"}</td>
                  )}
                  <td style={{ padding: "5px 4px", whiteSpace: "nowrap" }}>
                    {isPurchasesReport
                      ? row.purchasedAt
                        ? new Date(row.purchasedAt).toLocaleString("en-GB")
                        : "—"
                      : row.soldAt
                        ? new Date(row.soldAt).toLocaleString("en-GB")
                        : "—"}
                  </td>
                  {!isPurchasesReport ? (
                    <td style={{ padding: "5px 4px" }}>{salePaymentLabel(row.paymentMethod)}</td>
                  ) : null}
                  <td style={{ padding: "5px 4px", fontWeight: 700 }}>
                    {formatOneDecimal(row.total)} شيكل
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ marginTop: 14, fontSize: 12, fontWeight: 800 }}>
            إجمالي المبلغ المعروض: {formatOneDecimal(isPurchasesReport ? purchaseTotals.total : salesTotals.total)} شيكل
          </div>
        </div>
      </Box>
    </AdminLayout>
  );
}
