import { LocalOffer, Payments, ReceiptLong, Replay, Timeline } from "@mui/icons-material";
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
import { keyframes } from "@mui/system";
import { useEffect, useMemo, useState } from "react";
import FilterBarRow from "../../components/FilterBarRow";
import { useLocation } from "react-router-dom";
import { readSalesReturns } from "../../utils/salesReturnsStorage";
import { adminPageContainerSx, adminPageSubtitleSx } from "../../utils/adminPageLayout";
import AdminLayout from "./AdminLayout";

const ROWS_PER_PAGE = 5;

function formatOneDecimal(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return "0.0";
  return x.toFixed(1);
}

/** يعرض اسم الكاشير فقط دون جزء البريد بعد @ */
function displayCashierName(s) {
  if (s == null || s === "") return "—";
  const t = String(s).trim();
  const at = t.indexOf("@");
  if (at > 0) {
    const local = t.slice(0, at).trim();
    return local || "—";
  }
  return t || "—";
}

const float = keyframes`
  0%,100% { transform: translateY(0px); }
  50% { transform: translateY(-8px); }
`;

export default function ReturnsPage({ mode, onToggleMode }) {
  const theme = useTheme();
  const location = useLocation();
  const isPurchasesReturns = location.pathname.includes("/returns/purchases");
  const [returnsTick, setReturnsTick] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [detailReturn, setDetailReturn] = useState(null);

  useEffect(() => {
    const onFocus = () => setReturnsTick((t) => t + 1);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const salesReturns = useMemo(() => readSalesReturns(), [returnsTick, isPurchasesReturns]);

  const filteredReturns = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();
    return salesReturns
      .filter((r) => {
        const matchesSearch =
          !q ||
          String(r.originalInvoiceId || "")
            .toLowerCase()
            .includes(q) ||
          String(displayCashierName(r.restoredBy))
            .toLowerCase()
            .includes(q) ||
          String(r.paymentMethod || "")
            .toLowerCase()
            .includes(q);
        const matchesPayment = paymentFilter === "all" || String(r.paymentMethod || "") === paymentFilter;
        if (dateFilter === "all") return matchesSearch && matchesPayment;
        const t = new Date(r.createdAt || 0).getTime();
        if (!t) return false;
        const diffMs = now - t;
        const dayMs = 24 * 60 * 60 * 1000;
        const matchesDate =
          (dateFilter === "today" && diffMs <= dayMs) ||
          (dateFilter === "7d" && diffMs <= 7 * dayMs) ||
          (dateFilter === "30d" && diffMs <= 30 * dayMs);
        return matchesSearch && matchesPayment && matchesDate;
      })
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [salesReturns, search, dateFilter, paymentFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredReturns.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const paginatedRows = useMemo(() => {
    const start = (safePage - 1) * ROWS_PER_PAGE;
    return filteredReturns.slice(start, start + ROWS_PER_PAGE);
  }, [filteredReturns, safePage]);

  const stats = useMemo(() => {
    const count = filteredReturns.length;
    const total = filteredReturns.reduce((s, r) => s + Number(r.invoiceTotal || 0), 0);
    const avg = count ? total / count : 0;
    return [
      { title: "عدد المرتجعات (بعد التصفية)", value: String(count), delta: "—", icon: <ReceiptLong />, color: "info" },
      { title: "إجمالي القيمة", value: `${formatOneDecimal(total)} شيكل`, delta: "—", icon: <Payments />, color: "success" },
      { title: "متوسط قيمة المرتجع", value: `${formatOneDecimal(avg)} شيكل`, delta: "—", icon: <Timeline />, color: "default" },
    ];
  }, [filteredReturns]);

  if (isPurchasesReturns) {
    return (
      <AdminLayout mode={mode} onToggleMode={onToggleMode}>
        <Box sx={adminPageContainerSx}>
          <Box sx={{ mb: 2.5 }}>
            <Typography variant="h5" fontWeight={900} sx={{ mb: 0.6 }}>
              مرتجعات المشتريات
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
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, ...adminPageSubtitleSx }}>
              إدارة مرتجعات الموردين وتأثيرها على التكلفة والمخزون — قريبًا مع ربط البيانات.
            </Typography>
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
              <TextField size="small" placeholder="بحث برقم أمر أو مورد…" disabled sx={{ flex: "1 1 180px", minWidth: 140 }} />
              <Select size="small" value="all" disabled sx={{ minWidth: 148, flex: "0 0 auto" }}>
                <MenuItem value="all">كل التواريخ</MenuItem>
              </Select>
              <Button variant="outlined" disabled sx={{ textTransform: "none", fontWeight: 700, flex: "0 0 auto", whiteSpace: "nowrap" }}>
                إعادة الضبط
              </Button>
            </FilterBarRow>
          </Card>
          <Card
            sx={{
              borderRadius: 3,
              border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
              bgcolor: alpha(theme.palette.background.paper, 0.72),
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2.2 }}>
              <Typography fontWeight={800}>سجل مرتجعات المشتريات</Typography>
              <Button size="small" startIcon={<LocalOffer />} sx={{ textTransform: "none" }} disabled>
                تصدير
              </Button>
            </Stack>
            <Divider />
            <Box sx={{ p: 3, textAlign: "center" }}>
              <Replay sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
              <Typography color="text.secondary">لا توجد بيانات مرتبطة بعد — نفس تصميم صفحة المبيعات عند التفعيل.</Typography>
            </Box>
          </Card>
        </Box>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout mode={mode} onToggleMode={onToggleMode}>
      <Box sx={adminPageContainerSx}>
        <Box sx={{ mb: 2.5 }}>
          <Typography variant="h5" fontWeight={900} sx={{ mb: 0.6 }}>
            مرتجعات المبيعات
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
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, ...adminPageSubtitleSx }}>
            سجل «إعادة الفاتورة» من الكاشير مع ربط الفاتورة الأصلية والتصفية بنفس أسلوب فواتير المبيعات.
          </Typography>
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
              placeholder="ابحث برقم الفاتورة الأصلية أو اسم الكاشير…"
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
            </Select>
            <Button
              variant="outlined"
              onClick={() => {
                setSearch("");
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

        <Card
          sx={{
            mt: 2,
            borderRadius: 3,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
            bgcolor: alpha(theme.palette.background.paper, 0.72),
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ p: 2.2 }}>
            <Typography fontWeight={800}>سجل إعادة الفاتورة</Typography>
            <Typography variant="caption" color="text.secondary">
              {filteredReturns.length} سجل · {ROWS_PER_PAGE} صفوف لكل صفحة
            </Typography>
          </Stack>
          <Divider />
          <Box sx={{ p: 1.2 }}>
            <TableContainer>
              <Table size="small" sx={{ tableLayout: "fixed" }}>
                <TableHead>
                  <TableRow>
                    <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>
                      تاريخ التسجيل
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>
                      الفاتورة الأصلية
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>
                      الكاشير
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>
                      الدفع
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>
                      الإجمالي
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>
                      تفاصيل
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                          لا توجد مرتجعات مطابقة للتصفية
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedRows.map((r) => (
                      <TableRow key={r.id} hover>
                        <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                          {r.createdAt ? new Date(r.createdAt).toLocaleString("en-GB") : "—"}
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800, color: "primary.main" }}>
                          {r.originalInvoiceId || "—"}
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2">{displayCashierName(r.restoredBy)}</Typography>
                        </TableCell>
                        <TableCell align="center">{r.paymentMethod === "app" ? "تطبيق" : "كاش"}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>
                          {formatOneDecimal(r.invoiceTotal)} شيكل
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setDetailReturn(r)}
                            sx={{ textTransform: "none", fontWeight: 700 }}
                          >
                            عرض
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            {filteredReturns.length > 0 ? (
              <Stack direction="row" justifyContent="center" sx={{ mt: 1 }}>
                <Pagination
                  count={pageCount}
                  page={safePage}
                  onChange={(_, value) => setPage(value)}
                  color="primary"
                  shape="rounded"
                />
              </Stack>
            ) : null}
          </Box>
        </Card>

        <Dialog open={Boolean(detailReturn)} onClose={() => setDetailReturn(null)} fullWidth maxWidth="md">
          <DialogTitle sx={{ textAlign: "right" }}>
            تفاصيل المرتجع — فاتورة {detailReturn?.originalInvoiceId || "—"}
          </DialogTitle>
          <DialogContent sx={{ textAlign: "right" }}>
            <Stack sx={{ gap: 1, mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                الكاشير: <b>{displayCashierName(detailReturn?.restoredBy)}</b>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                التاريخ:{" "}
                <b>{detailReturn?.createdAt ? new Date(detailReturn.createdAt).toLocaleString("en-GB") : "—"}</b>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                الدفع: <b>{detailReturn?.paymentMethod === "app" ? "تطبيق" : "كاش"}</b>
                {" — "}
                الإجمالي: <b>{formatOneDecimal(detailReturn?.invoiceTotal)} شيكل</b>
              </Typography>
            </Stack>
            <TableContainer component={Card} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>
                      #
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>
                      الصنف
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>
                      الكمية
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>
                      سعر الوحدة
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>
                      الإجمالي
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(Array.isArray(detailReturn?.items) && detailReturn.items.length ? detailReturn.items : []).map((it, i) => {
                    const qty = Number(it.qty ?? 0);
                    const unit = Number(it.price ?? 0);
                    const lineTotal = Number(it.total ?? qty * unit);
                    return (
                      <TableRow key={`${it.name}-${i}`}>
                        <TableCell align="center">{i + 1}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600 }}>
                          {it.name || "—"}
                        </TableCell>
                        <TableCell align="center">{formatOneDecimal(qty)}</TableCell>
                        <TableCell align="center">{formatOneDecimal(unit)} شيكل</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>
                          {formatOneDecimal(lineTotal)} شيكل
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!detailReturn?.items || !detailReturn.items.length ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">
                        <Typography variant="body2" color="text.secondary">
                          لا توجد بنود مسجّلة
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button variant="contained" onClick={() => setDetailReturn(null)} sx={{ textTransform: "none" }}>
              إغلاق
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </AdminLayout>
  );
}
