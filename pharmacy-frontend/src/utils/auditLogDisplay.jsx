import {
  alpha,
  Box,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from "@mui/material";

export const AUDIT_ACTION_LABELS = {
  stocktake_apply: "تطبيق جرد مخزون",
  debt_customer_payment: "تسديد دين زبون",
  debt_customer_upsert: "حفظ بيانات زبون آجل",
  debt_customer_delete: "حذف زبون آجل",
  cashier_sale: "بيع من الكاشير",
  cashier_hold_save: "تعليق سلة",
  cashier_hold_delete: "حذف سلة معلّقة",
  invoice_void: "إلغاء فاتورة",
  inventory_price_change: "تغيير سعر صنف",
  treasury_deposit: "إيداع خزنة",
  treasury_withdraw: "سحب من الخزنة",
  treasury_reset: "تصفير الخزنة",
  system_data_reset: "تصفير بيانات من الإعدادات",
};

export function parseAuditDetailsJson(details) {
  if (details == null || details === "") return null;
  try {
    const o = JSON.parse(String(details));
    return o && typeof o === "object" ? o : null;
  } catch {
    return null;
  }
}

/** خلية غنية لعرض تفاصيل سجل التدقيق بدل نص JSON خام */
export function AuditDetailsRich({ action, details }) {
  const theme = useTheme();
  const parsed = parseAuditDetailsJson(details);
  const raw = String(details || "");

  if (action === "stocktake_apply" && parsed && Array.isArray(parsed.diffs)) {
    return (
      <Stack spacing={1} alignItems="stretch" sx={{ textAlign: "right", minWidth: 260 }}>
        <Stack direction="row" flexWrap="wrap" gap={0.75}>
          {parsed.sessionId ? (
            <Chip size="small" variant="outlined" label={`جلسة: ${parsed.sessionId}`} sx={{ fontWeight: 700 }} />
          ) : null}
          {parsed.title ? (
            <Chip size="small" color="primary" variant="outlined" label={String(parsed.title)} sx={{ fontWeight: 700 }} />
          ) : null}
          <Chip
            size="small"
            color="secondary"
            label={`${parsed.diffs.length} صنف معدّل`}
            sx={{ fontWeight: 800 }}
          />
        </Stack>
        <Table size="small" sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1, overflow: "hidden" }}>
          <TableHead>
            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
              <TableCell align="center" sx={{ fontWeight: 800, py: 0.75 }}>
                الصنف
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 800, py: 0.75 }}>
                قبل
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 800, py: 0.75 }}>
                بعد
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 800, py: 0.75 }}>
                الفرق
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {parsed.diffs.map((d) => {
              const before = Number(d.before);
              const after = Number(d.after);
              const diff = after - before;
              return (
                <TableRow key={`${d.id}-${d.name}`}>
                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                    {d.name || `#${d.id}`}
                  </TableCell>
                  <TableCell align="center">{Number.isFinite(before) ? before.toFixed(1) : "—"}</TableCell>
                  <TableCell align="center">{Number.isFinite(after) ? after.toFixed(1) : "—"}</TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      fontWeight: 800,
                      color: diff > 0 ? "success.main" : diff < 0 ? "error.main" : "text.secondary",
                    }}
                  >
                    {diff > 0 ? `+${diff.toFixed(1)}` : diff < 0 ? diff.toFixed(1) : "0"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Stack>
    );
  }

  if (action === "debt_customer_payment" && parsed) {
    return (
      <Stack spacing={0.5} sx={{ textAlign: "right" }}>
        <Typography variant="body2">
          زبون: <b>{parsed.name || parsed.id || "—"}</b>
        </Typography>
        <Typography variant="body2" color="primary.main" fontWeight={800}>
          تسديد: {Number(parsed.amount || 0).toFixed(2)} شيكل
        </Typography>
        {parsed.source ? (
          <Typography variant="caption" color="text.secondary">
            المصدر: {parsed.source === "cashier" ? "كاشير" : parsed.source}
          </Typography>
        ) : null}
      </Stack>
    );
  }

  if (action === "cashier_sale" && parsed) {
    return (
      <Stack spacing={0.25} sx={{ textAlign: "right" }}>
        <Typography variant="body2" fontWeight={700}>
          فاتورة {parsed.invoiceId || "—"} — {Number(parsed.total || 0).toFixed(2)} شيكل
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {parsed.paymentMethod === "credit"
            ? "آجل"
            : parsed.paymentMethod === "app"
              ? "تطبيق"
              : "كاش"}
          {parsed.creditCustomerName ? ` · ${parsed.creditCustomerName}` : ""}
        </Typography>
      </Stack>
    );
  }

  if (action === "invoice_void" && parsed) {
    return (
      <Typography variant="body2" sx={{ textAlign: "right" }}>
        إلغاء <b>{parsed.id}</b> — {Number(parsed.total || 0).toFixed(2)} شيكل —{" "}
        {parsed.paymentMethod === "credit" ? "آجل" : parsed.paymentMethod === "app" ? "تطبيق" : "كاش"}
      </Typography>
    );
  }

  if (action === "system_data_reset" && parsed) {
    const labels = Array.isArray(parsed.doneLabels) ? parsed.doneLabels : [];
    return (
      <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ justifyContent: "flex-end" }}>
        {labels.length ? (
          labels.map((t) => (
            <Chip key={t} size="small" label={t} color="warning" variant="outlined" sx={{ fontWeight: 700 }} />
          ))
        ) : (
          <Typography variant="caption" color="text.secondary">
            (لا تفاصيل)
          </Typography>
        )}
      </Stack>
    );
  }

  if (parsed && typeof parsed === "object") {
    return (
      <Box
        component="pre"
        sx={{
          m: 0,
          p: 1,
          borderRadius: 1,
          bgcolor: alpha(theme.palette.divider, 0.12),
          fontSize: 11,
          maxHeight: 160,
          overflow: "auto",
          textAlign: "right",
          direction: "ltr",
          unicodeBidi: "plaintext",
        }}
      >
        {JSON.stringify(parsed, null, 2)}
      </Box>
    );
  }

  return (
    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word", textAlign: "right" }}>
      {raw || "—"}
    </Typography>
  );
}
