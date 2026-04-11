import {
  AccessTime,
  Gavel,
  History,
  Person,
  PointOfSale,
  Refresh,
  Timeline,
  Visibility,
} from "@mui/icons-material";
import {
  alpha,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Pagination,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { keyframes } from "@mui/system";
import { useEffect, useMemo, useState } from "react";
import FilterBarRow from "../../components/FilterBarRow";
import { adminPageContainerSx } from "../../utils/adminPageLayout";
import AdminLayout from "./AdminLayout";
import { readAuditLog } from "../../utils/auditLog";
import { AUDIT_ACTION_LABELS, AuditDetailsRich } from "../../utils/auditLogDisplay";
import { readShiftActivityLog } from "../../utils/shiftActivityLog";
import { displayCashierName } from "./InvoicesPage";

const ROWS_PER_PAGE = 6;
const AUDIT_ROWS_PER_PAGE = 8;

const shimmer = keyframes`
  0% { opacity: 0.55; }
  50% { opacity: 1; }
  100% { opacity: 0.55; }
`;

function auditActionColor(action, theme) {
  const a = String(action || "");
  if (a.includes("treasury") || a.includes("reset")) return theme.palette.warning.main;
  if (a.includes("sale") || a.includes("cashier")) return theme.palette.success.main;
  if (a.includes("void") || a.includes("delete")) return theme.palette.error.main;
  if (a.includes("price") || a.includes("stocktake")) return theme.palette.info.main;
  return theme.palette.secondary.main;
}

export default function ActivityLogPage({ mode, onToggleMode }) {
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up("md"));
  const [dataTick, setDataTick] = useState(0);
  const [mainTab, setMainTab] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState(null);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditPage, setAuditPage] = useState(1);

  useEffect(() => {
    const on = () => setDataTick((t) => t + 1);
    window.addEventListener("pharmacy-system-data-reset", on);
    return () => window.removeEventListener("pharmacy-system-data-reset", on);
  }, []);

  const rows = useMemo(() => {
    void dataTick;
    const q = search.trim().toLowerCase();
    return readShiftActivityLog().filter((r) => {
      if (!q) return true;
      return (
        String(r.username || "")
          .toLowerCase()
          .includes(q) ||
        String(r.displayName || "")
          .toLowerCase()
          .includes(q)
      );
    });
  }, [search, dataTick]);

  const pageCount = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * ROWS_PER_PAGE;
    return rows.slice(start, start + ROWS_PER_PAGE);
  }, [rows, safePage]);

  const metrics = useMemo(() => {
    void dataTick;
    const all = readShiftActivityLog();
    const inv = all.reduce((s, r) => s + (r.invoiceCount || 0), 0);
    const totalSales = all.reduce((s, r) => s + Number(r.total || 0), 0);
    return { sessions: all.length, invoices: inv, totalSales };
  }, [dataTick]);

  const auditFiltered = useMemo(() => {
    void dataTick;
    const q = auditSearch.trim().toLowerCase();
    const all = readAuditLog();
    if (!q) return all;
    return all.filter(
      (r) =>
        String(r.action || "")
          .toLowerCase()
          .includes(q) ||
        String(r.username || "")
          .toLowerCase()
          .includes(q) ||
        String(r.details || "")
          .toLowerCase()
          .includes(q) ||
        String(r.role || "")
          .toLowerCase()
          .includes(q),
    );
  }, [auditSearch, dataTick]);

  const auditPageCount = Math.max(1, Math.ceil(auditFiltered.length / AUDIT_ROWS_PER_PAGE));
  const safeAuditPage = Math.min(auditPage, auditPageCount);
  const auditRows = useMemo(() => {
    const start = (safeAuditPage - 1) * AUDIT_ROWS_PER_PAGE;
    return auditFiltered.slice(start, start + AUDIT_ROWS_PER_PAGE);
  }, [auditFiltered, safeAuditPage]);

  return (
    <AdminLayout mode={mode} onToggleMode={onToggleMode}>
      <Box sx={adminPageContainerSx}>
        <Paper
          elevation={0}
          sx={{
            mb: 2,
            p: { xs: 2, sm: 2.5 },
            borderRadius: 3,
            overflow: "hidden",
            position: "relative",
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            background: `linear-gradient(125deg, ${alpha(theme.palette.primary.main, 0.14)} 0%, ${alpha(
              theme.palette.secondary.main,
              0.1,
            )} 42%, ${alpha(theme.palette.background.paper, 0.96)} 100%)`,
          }}
        >
          <Box
            sx={{
              position: "absolute",
              width: 180,
              height: 180,
              borderRadius: "50%",
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              top: -60,
              left: -40,
              pointerEvents: "none",
            }}
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }} sx={{ position: "relative" }}>
            <Avatar
              sx={{
                width: 56,
                height: 56,
                bgcolor: alpha(theme.palette.primary.main, 0.2),
                color: "primary.main",
                animation: `${shimmer} 3.5s ease-in-out infinite`,
              }}
            >
              <Timeline sx={{ fontSize: 32 }} />
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h5" fontWeight={900}>
                سجل النشاط
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                دوام الكاشير، الفواتير، وسجل التدقيق — يتحدّث تلقائياً بعد تصفير البيانات من الإعدادات
              </Typography>
            </Box>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Refresh />}
              onClick={() => setDataTick((t) => t + 1)}
              sx={{ textTransform: "none", fontWeight: 800, flexShrink: 0, alignSelf: { xs: "stretch", sm: "center" } }}
            >
              تحديث العرض
            </Button>
          </Stack>

          <Grid container spacing={1.5} sx={{ mt: 2 }}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card variant="outlined" sx={{ borderRadius: 2.5, bgcolor: alpha(theme.palette.background.paper, 0.75) }}>
                <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    جلسات دوام
                  </Typography>
                  <Typography variant="h4" fontWeight={900} color="primary.main">
                    {metrics.sessions}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card variant="outlined" sx={{ borderRadius: 2.5, bgcolor: alpha(theme.palette.background.paper, 0.75) }}>
                <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    فواتير في الجلسات
                  </Typography>
                  <Typography variant="h4" fontWeight={900} color="success.main">
                    {metrics.invoices}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card variant="outlined" sx={{ borderRadius: 2.5, bgcolor: alpha(theme.palette.background.paper, 0.75) }}>
                <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    إجمالي مبيعات الجلسات
                  </Typography>
                  <Typography variant="h4" fontWeight={900} color="secondary.main">
                    {metrics.totalSales.toFixed(0)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    شيكل تقريباً
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Paper>

        <Card sx={{ borderRadius: 3, mb: 2, overflow: "hidden" }}>
          <Tabs
            value={mainTab}
            onChange={(_, v) => setMainTab(v)}
            variant="fullWidth"
            sx={{
              minHeight: 48,
              bgcolor: alpha(theme.palette.primary.main, 0.06),
              "& .MuiTab-root": { textTransform: "none", fontWeight: 800, py: 1.5 },
            }}
          >
            <Tab icon={<History sx={{ mb: 0.25 }} />} iconPosition="start" label="دوام الكاشير" />
            <Tab icon={<Gavel sx={{ mb: 0.25 }} />} iconPosition="start" label="سجل التدقيق" />
          </Tabs>
        </Card>

        {mainTab === 0 ? (
          <Stack sx={{ gap: 2 }}>
            <Card sx={{ p: 1.5, borderRadius: 3 }}>
              <FilterBarRow>
                <TextField
                  size="small"
                  placeholder="بحث باسم المستخدم أو الاسم المعروض…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  sx={{ flex: "1 1 100%", minWidth: 0 }}
                  InputProps={{
                    startAdornment: (
                      <Person sx={{ ml: 1, color: "text.secondary", fontSize: 20 }} />
                    ),
                  }}
                />
              </FilterBarRow>
            </Card>

            {pageRows.length === 0 ? (
              <Card sx={{ p: 4, borderRadius: 3, textAlign: "center" }}>
                <PointOfSale sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
                <Typography color="text.secondary" fontWeight={700}>
                  لا يوجد سجل بعد
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  يُملأ عند «إنهاء الدوام» من شاشة الكاشير
                </Typography>
              </Card>
            ) : (
              <Stack sx={{ gap: 1.5 }}>
                {pageRows.map((r) => (
                  <Card
                    key={r.id}
                    sx={{
                      borderRadius: 3,
                      overflow: "hidden",
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`,
                      borderInlineStart: `4px solid ${theme.palette.primary.main}`,
                      transition: "transform 0.15s, box-shadow 0.15s",
                      "&:hover": {
                        boxShadow: `0 8px 28px ${alpha(theme.palette.primary.main, 0.12)}`,
                        transform: "translateY(-1px)",
                      },
                    }}
                  >
                    <CardContent sx={{ py: 2 }}>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1.5}
                        alignItems={{ xs: "stretch", sm: "center" }}
                        justifyContent="space-between"
                      >
                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0 }}>
                          <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.15), color: "primary.main" }}>
                            {(r.displayName || r.username || "?")[0]}
                          </Avatar>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography fontWeight={900} noWrap>
                              {displayCashierName(r.displayName || r.username)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              @{r.username}
                            </Typography>
                          </Box>
                        </Stack>
                        <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ justifyContent: { xs: "flex-start", sm: "center" } }}>
                          <Chip size="small" variant="outlined" label={`${r.invoiceCount ?? 0} فاتورة`} />
                          <Chip size="small" color="success" variant="outlined" label={`${Number(r.total || 0).toFixed(1)} شيكل`} />
                        </Stack>
                        <Stack direction={{ xs: "row", sm: "column" }} spacing={0.5} sx={{ flexShrink: 0, alignItems: { sm: "flex-end" } }}>
                          <Stack direction="row" spacing={0.5} alignItems="center" color="text.secondary">
                            <AccessTime fontSize="inherit" />
                            <Typography variant="caption" noWrap>
                              {r.shiftStartedAt ? new Date(r.shiftStartedAt).toLocaleString("en-GB") : "—"}
                            </Typography>
                          </Stack>
                          <Button
                            size="small"
                            variant="contained"
                            startIcon={<Visibility />}
                            onClick={() => setDetail(r)}
                            sx={{ textTransform: "none", fontWeight: 800 }}
                          >
                            تفاصيل الجلسة
                          </Button>
                        </Stack>
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}

            {rows.length > ROWS_PER_PAGE ? (
              <Stack direction="row" justifyContent="center" sx={{ py: 1 }}>
                <Pagination count={pageCount} page={safePage} onChange={(_, v) => setPage(v)} color="primary" shape="rounded" />
              </Stack>
            ) : null}
          </Stack>
        ) : (
          <Stack sx={{ gap: 2 }}>
            <Card sx={{ p: 1.5, borderRadius: 3 }}>
              <FilterBarRow>
                <TextField
                  size="small"
                  placeholder="تصفية: إجراء، مستخدم، تفاصيل…"
                  value={auditSearch}
                  onChange={(e) => {
                    setAuditSearch(e.target.value);
                    setAuditPage(1);
                  }}
                  sx={{ flex: "1 1 100%", minWidth: 0 }}
                  InputProps={{
                    startAdornment: <Gavel sx={{ ml: 1, color: "text.secondary", fontSize: 20 }} />,
                  }}
                />
              </FilterBarRow>
            </Card>

            {auditFiltered.length === 0 ? (
              <Card sx={{ p: 4, borderRadius: 3, textAlign: "center" }}>
                <Gavel sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
                <Typography color="text.secondary" fontWeight={700}>
                  لا سجلات تدقيق
                </Typography>
              </Card>
            ) : mdUp ? (
              <Card sx={{ borderRadius: 3, border: `1px solid ${alpha(theme.palette.secondary.main, 0.2)}` }}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.1) }}>
                        <TableCell align="center" sx={{ fontWeight: 800 }}>
                          الوقت
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800 }}>
                          الإجراء
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800 }}>
                          المستخدم
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800 }}>
                          التفاصيل
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {auditRows.map((r) => (
                        <TableRow key={r.id} hover>
                          <TableCell align="center" sx={{ whiteSpace: "nowrap", fontSize: 12, verticalAlign: "top" }}>
                            {r.at ? new Date(r.at).toLocaleString("en-GB") : "—"}
                          </TableCell>
                          <TableCell align="center" sx={{ verticalAlign: "top", py: 1.25 }}>
                            <Tooltip title={r.action} placement="top">
                              <Chip
                                size="small"
                                sx={{
                                  fontWeight: 800,
                                  maxWidth: 220,
                                  borderColor: auditActionColor(r.action, theme),
                                  color: auditActionColor(r.action, theme),
                                }}
                                variant="outlined"
                                label={AUDIT_ACTION_LABELS[r.action] || r.action}
                              />
                            </Tooltip>
                          </TableCell>
                          <TableCell align="center" sx={{ verticalAlign: "top", py: 1.25 }}>
                            <Typography variant="body2">{r.username || "—"}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {r.role || ""}
                            </Typography>
                          </TableCell>
                          <TableCell align="right" sx={{ verticalAlign: "top", py: 1.25, maxWidth: 480 }}>
                            <AuditDetailsRich action={r.action} details={r.details} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Card>
            ) : (
              <Stack sx={{ gap: 1.25 }}>
                {auditRows.map((r) => {
                  const ac = auditActionColor(r.action, theme);
                  return (
                    <Card
                      key={r.id}
                      sx={{
                        borderRadius: 3,
                        borderInlineStart: `4px solid ${ac}`,
                        bgcolor: alpha(ac, 0.06),
                      }}
                    >
                      <CardContent sx={{ py: 1.5 }}>
                        <Stack spacing={1}>
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ gap: 1 }}>
                            <Chip
                              size="small"
                              label={AUDIT_ACTION_LABELS[r.action] || r.action}
                              sx={{ fontWeight: 800, borderColor: ac, color: ac }}
                              variant="outlined"
                            />
                            <Typography variant="caption" color="text.secondary" sx={{ textAlign: "left", flexShrink: 0 }}>
                              {r.at ? new Date(r.at).toLocaleString("en-GB") : "—"}
                            </Typography>
                          </Stack>
                          <Typography variant="body2" fontWeight={700}>
                            {r.username || "—"}{" "}
                            <Typography component="span" variant="caption" color="text.secondary">
                              {r.role ? `· ${r.role}` : ""}
                            </Typography>
                          </Typography>
                          <AuditDetailsRich action={r.action} details={r.details} />
                        </Stack>
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            )}

            {auditFiltered.length > AUDIT_ROWS_PER_PAGE ? (
              <Stack direction="row" justifyContent="center" sx={{ py: 1 }}>
                <Pagination
                  count={auditPageCount}
                  page={safeAuditPage}
                  onChange={(_, v) => setAuditPage(v)}
                  color="secondary"
                  shape="rounded"
                />
              </Stack>
            ) : null}
          </Stack>
        )}

        <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} fullWidth maxWidth="md">
          <DialogTitle sx={{ textAlign: "right", fontWeight: 900 }}>
            فواتير الجلسة — {detail?.displayName || detail?.username}
          </DialogTitle>
          <DialogContent dividers sx={{ textAlign: "right" }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              من {detail?.shiftStartedAt ? new Date(detail.shiftStartedAt).toLocaleString("en-GB") : "—"} إلى{" "}
              {detail?.shiftEndedAt ? new Date(detail.shiftEndedAt).toLocaleString("en-GB") : "—"}
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell align="center">الفاتورة</TableCell>
                  <TableCell align="center">الوقت</TableCell>
                  <TableCell align="center">الدفع</TableCell>
                  <TableCell align="center">الإجمالي</TableCell>
                  <TableCell align="center">البنود</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(Array.isArray(detail?.invoices) ? detail.invoices : []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      لا فواتير في هذه الجلسة
                    </TableCell>
                  </TableRow>
                ) : (
                  detail.invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell align="center" sx={{ fontWeight: 700 }}>
                        {inv.id}
                        {inv.pendingOffline ? (
                          <Typography variant="caption" color="warning.main" display="block">
                            بانتظار المزامنة
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                        {inv.soldAt ? new Date(inv.soldAt).toLocaleString("en-GB") : "—"}
                      </TableCell>
                      <TableCell align="center">
                        {inv.paymentMethod === "app" ? "تطبيق" : inv.paymentMethod === "credit" ? "آجل" : "كاش"}
                      </TableCell>
                      <TableCell align="center">{Number(inv.total || 0).toFixed(1)} شيكل</TableCell>
                      <TableCell align="right" sx={{ maxWidth: 280 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            display: "-webkit-box",
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            lineHeight: 1.45,
                          }}
                        >
                          {(inv.items || []).map((it) => `${it.name} ×${it.qty}`).join(" · ") || "—"}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button variant="contained" onClick={() => setDetail(null)} sx={{ textTransform: "none", fontWeight: 800 }}>
              إغلاق
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </AdminLayout>
  );
}
