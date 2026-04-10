import { Gavel, History, Visibility } from "@mui/icons-material";
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
  Pagination,
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
import { useMemo, useState } from "react";
import FilterBarRow from "../../components/FilterBarRow";
import { adminPageContainerSx, adminPageSubtitleSx } from "../../utils/adminPageLayout";
import AdminLayout from "./AdminLayout";
import { readAuditLog } from "../../utils/auditLog";
import { AUDIT_ACTION_LABELS, AuditDetailsRich } from "../../utils/auditLogDisplay";
import { readShiftActivityLog } from "../../utils/shiftActivityLog";
import { displayCashierName } from "./InvoicesPage";

const ROWS_PER_PAGE = 6;

export default function ActivityLogPage({ mode, onToggleMode }) {
  const theme = useTheme();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState(null);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditRefresh, setAuditRefresh] = useState(0);

  const rows = useMemo(() => {
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
  }, [search]);

  const pageCount = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * ROWS_PER_PAGE;
    return rows.slice(start, start + ROWS_PER_PAGE);
  }, [rows, safePage]);

  const metrics = useMemo(() => {
    const all = readShiftActivityLog();
    const inv = all.reduce((s, r) => s + (r.invoiceCount || 0), 0);
    return { sessions: all.length, invoices: inv };
  }, [search, page]);

  const auditRows = useMemo(() => {
    void auditRefresh;
    const q = auditSearch.trim().toLowerCase();
    const all = readAuditLog();
    const filtered = !q
      ? all
      : all.filter(
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
    return filtered.slice(0, 100);
  }, [auditSearch, auditRefresh]);

  return (
    <AdminLayout mode={mode} onToggleMode={onToggleMode}>
      <Box sx={adminPageContainerSx}>
        <Stack direction="row" alignItems="center" sx={{ gap: 1, mb: 2, flexWrap: "wrap" }}>
          <History color="primary" sx={{ flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" fontWeight={900}>
              سجل النشاط — دوام الكاشير
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={adminPageSubtitleSx}>
              يُسجَّل تلقائياً عند «إنهاء الدوام»: بداية ونهاية الجلسة، الفواتير، والمجاميع
            </Typography>
          </Box>
        </Stack>

        <FilterBarRow
          sx={{
            gap: 2,
            mb: 2,
            flexDirection: { xs: "row", sm: "row" },
            "& > *": { flex: { xs: "1 1 calc(50% - 8px)", sm: "1 1 0" }, minWidth: { xs: 0, sm: 160 } },
          }}
        >
          <Card sx={{ p: { xs: 1.25, sm: 2 }, borderRadius: 3 }}>
            <Typography variant="caption" color="text.secondary">
              جلسات مسجّلة
            </Typography>
            <Typography variant="h5" fontWeight={900} sx={{ fontSize: { xs: "1.25rem", sm: undefined } }}>
              {metrics.sessions}
            </Typography>
          </Card>
          <Card sx={{ p: { xs: 1.25, sm: 2 }, borderRadius: 3 }}>
            <Typography variant="caption" color="text.secondary">
              فواتير ضمن الجلسات
            </Typography>
            <Typography variant="h5" fontWeight={900} sx={{ fontSize: { xs: "1.25rem", sm: undefined } }}>
              {metrics.invoices}
            </Typography>
          </Card>
        </FilterBarRow>

        <Card sx={{ p: 1.5, mb: 2, borderRadius: 3 }}>
          <FilterBarRow>
            <TextField
              size="small"
              placeholder="بحث باسم المستخدم أو الاسم المعروض…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              sx={{ flex: "1 1 100%", minWidth: 200 }}
            />
          </FilterBarRow>
        </Card>

        <Card sx={{ borderRadius: 3, border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}` }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>
                    الكاشير
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>
                    بداية الدوام
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>
                    نهاية الدوام
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>
                    فواتير
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>
                    إجمالي البيع
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>
                    كاش / تطبيق
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>
                    تفاصيل
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography color="text.secondary" sx={{ py: 4 }}>
                        لا يوجد سجل بعد. يُملأ عند إنهاء دوام من شاشة الكاشير.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  pageRows.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell align="center">
                        <Typography fontWeight={700}>{displayCashierName(r.displayName || r.username)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {r.username}
                        </Typography>
                      </TableCell>
                      <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                        {r.shiftStartedAt ? new Date(r.shiftStartedAt).toLocaleString("en-GB") : "—"}
                      </TableCell>
                      <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                        {r.shiftEndedAt ? new Date(r.shiftEndedAt).toLocaleString("en-GB") : "—"}
                      </TableCell>
                      <TableCell align="center">{r.invoiceCount ?? 0}</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800 }}>
                        {Number(r.total || 0).toFixed(1)} شيكل
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="caption" display="block">
                          كاش {Number(r.cash || 0).toFixed(1)}
                        </Typography>
                        <Typography variant="caption" display="block">
                          تطبيق {Number(r.app || 0).toFixed(1)}
                        </Typography>
                        {Number(r.credit || 0) > 0 ? (
                          <Typography variant="caption" display="block" color="warning.main" fontWeight={700}>
                            آجل {Number(r.credit || 0).toFixed(1)}
                          </Typography>
                        ) : null}
                      </TableCell>
                      <TableCell align="center">
                        <Button
                          size="small"
                          startIcon={<Visibility />}
                          variant="outlined"
                          onClick={() => setDetail(r)}
                          sx={{ textTransform: "none" }}
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
          {rows.length > 0 ? (
            <Stack direction="row" justifyContent="center" sx={{ p: 1.5 }}>
              <Pagination count={pageCount} page={safePage} onChange={(_, v) => setPage(v)} color="primary" shape="rounded" />
            </Stack>
          ) : null}
        </Card>

        <Dialog open={Boolean(detail)} onClose={() => setDetail(null)} fullWidth maxWidth="md">
          <DialogTitle sx={{ textAlign: "right" }}>فواتير الجلسة — {detail?.displayName || detail?.username}</DialogTitle>
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
                        {inv.paymentMethod === "app"
                          ? "تطبيق"
                          : inv.paymentMethod === "credit"
                            ? "آجل"
                            : "كاش"}
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
            <Button variant="contained" onClick={() => setDetail(null)} sx={{ textTransform: "none" }}>
              إغلاق
            </Button>
          </DialogActions>
        </Dialog>

        <Stack direction="row" alignItems="center" sx={{ gap: 1, mt: 3, mb: 1.5 }}>
          <Gavel color="secondary" />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6" fontWeight={900}>
              سجل التدقيق (مدير)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              إلغاء فواتير، تغيير أسعار، تعليق سلال، مبيعات كاشير، جرد…
            </Typography>
          </Box>
          <Button variant="outlined" size="small" onClick={() => setAuditRefresh((x) => x + 1)} sx={{ textTransform: "none" }}>
            تحديث
          </Button>
        </Stack>
        <Card sx={{ p: 1.5, mb: 2, borderRadius: 3 }}>
          <FilterBarRow>
            <TextField
              size="small"
              placeholder="تصفية حسب الإجراء أو المستخدم أو التفاصيل…"
              value={auditSearch}
              onChange={(e) => setAuditSearch(e.target.value)}
              sx={{ flex: "1 1 100%", minWidth: 200 }}
            />
          </FilterBarRow>
        </Card>
        <Card sx={{ borderRadius: 3, border: `1px solid ${alpha(theme.palette.secondary.main, 0.2)}` }}>
          <TableContainer sx={{ overflowX: "auto" }}>
            <Table size="small" sx={{ minWidth: 720 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.08) }}>
                  <TableCell align="center" sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>
                    الوقت
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>
                    الإجراء
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>
                    المستخدم
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, minWidth: 320 }}>
                    التفاصيل
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {auditRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                      <Typography color="text.secondary">لا سجلات تدقيق بعد</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  auditRows.map((r) => (
                    <TableRow key={r.id} hover>
                      <TableCell align="center" sx={{ whiteSpace: "nowrap", fontSize: 12, verticalAlign: "top" }}>
                        {r.at ? new Date(r.at).toLocaleString("en-GB") : "—"}
                      </TableCell>
                      <TableCell align="center" sx={{ verticalAlign: "top", py: 1.25 }}>
                        <Tooltip title={r.action} placement="top">
                          <Chip
                            size="small"
                            color="secondary"
                            variant="outlined"
                            label={AUDIT_ACTION_LABELS[r.action] || r.action}
                            sx={{ fontWeight: 800, maxWidth: 200 }}
                          />
                        </Tooltip>
                      </TableCell>
                      <TableCell align="center" sx={{ verticalAlign: "top", py: 1.25 }}>
                        <Typography variant="body2">{r.username || "—"}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {r.role || ""}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ verticalAlign: "top", py: 1.25, maxWidth: 520 }}>
                        <AuditDetailsRich action={r.action} details={r.details} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      </Box>
    </AdminLayout>
  );
}
