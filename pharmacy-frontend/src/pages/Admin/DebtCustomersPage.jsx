import { Add, DeleteOutline, Person } from "@mui/icons-material";
import {
  Box,
  Button,
  Card,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";

const LEDGER_TYPE_AR = {
  payment: "تسديد دين",
  credit_sale: "بيع آجل (زيادة دين)",
  invoice_void_reversal: "عكس إلغاء فاتورة",
  balance_edit: "تعديل رصيد يدوي",
  opening_balance: "رصيد عند الإضافة",
  adjust: "حركة",
};
import { adminPageContainerSx, adminPageSubtitleSx, adminPageTitleRowSx } from "../../utils/adminPageLayout";
import { negativeAmountTextSx } from "../../utils/negativeAmountStyle";
import AdminLayout from "./AdminLayout";
import { appendAudit } from "../../utils/auditLog";
import {
  adjustCustomerBalance,
  deleteDebtCustomer,
  readDebtCustomers,
  readDebtLedgerForCustomer,
  upsertDebtCustomer,
} from "../../utils/pharmacyDebtCustomers";
import { getStoredUser } from "../../utils/userRoles";
import { confirmApp, showAppToast } from "../../utils/appToast";

export default function DebtCustomersPage({ mode, onToggleMode }) {
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [ledgerCustomer, setLedgerCustomer] = useState(null);
  const [form, setForm] = useState({
    id: "",
    name: "",
    phone: "",
    creditLimit: "",
    balance: "",
    notes: "",
  });

  const rows = useMemo(() => readDebtCustomers(), [tick]);

  const ledgerRows = useMemo(() => {
    if (!ledgerCustomer?.id) return [];
    return readDebtLedgerForCustomer(ledgerCustomer.id);
  }, [ledgerCustomer, tick]);

  useEffect(() => {
    if (!ledgerCustomer?.id) return;
    const fresh = readDebtCustomers().find((c) => c.id === ledgerCustomer.id);
    if (fresh) setLedgerCustomer(fresh);
  }, [tick]);

  const openNew = () => {
    setForm({ id: "", name: "", phone: "", creditLimit: "5000", balance: "0", notes: "" });
    setOpen(true);
  };

  const openEdit = (c) => {
    setForm({
      id: c.id,
      name: c.name,
      phone: c.phone || "",
      creditLimit: String(c.creditLimit ?? ""),
      balance: String(c.balance ?? ""),
      notes: c.notes || "",
    });
    setOpen(true);
  };

  const save = () => {
    const r = upsertDebtCustomer(form);
    if (!r.ok) {
      showAppToast(r.error || "خطأ", "error");
      return;
    }
    const u = getStoredUser();
    appendAudit({
      action: "debt_customer_upsert",
      details: JSON.stringify({ id: r.customer.id, name: r.customer.name }),
      username: u?.username || "",
      role: u?.role || "",
    });
    setOpen(false);
    setTick((t) => t + 1);
    showAppToast("تم حفظ بيانات الزبون", "success");
  };

  const remove = async (c) => {
    const ok = await confirmApp({
      title: "حذف الزبون",
      text: `حذف ${c.name}؟`,
      icon: "warning",
      danger: true,
      confirmText: "نعم، احذف",
    });
    if (!ok) return;
    deleteDebtCustomer(c.id);
    const u = getStoredUser();
    appendAudit({
      action: "debt_customer_delete",
      details: c.id,
      username: u?.username || "",
      role: u?.role || "",
    });
    setTick((t) => t + 1);
    showAppToast("تم الحذف", "info");
  };

  const applyPayment = () => {
    if (!payOpen) return;
    const amt = Number(payAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      showAppToast("أدخل مبلغ تسديد صحيح", "error");
      return;
    }
    adjustCustomerBalance(payOpen.id, -amt, {
      type: "payment",
      source: "admin",
      username: u?.username || "",
    });
    const u = getStoredUser();
    appendAudit({
      action: "debt_customer_payment",
      details: JSON.stringify({ id: payOpen.id, amount: amt }),
      username: u?.username || "",
      role: u?.role || "",
    });
    setPayOpen(null);
    setPayAmount("");
    setTick((t) => t + 1);
    showAppToast("تم تسجيل التسديد", "success");
  };

  return (
    <AdminLayout mode={mode} onToggleMode={onToggleMode}>
      <Box sx={adminPageContainerSx}>
        <Stack sx={{ ...adminPageTitleRowSx, alignItems: { xs: "stretch", sm: "center" } }}>
          <Stack direction="row" alignItems="center" sx={{ gap: 1, minWidth: 0 }}>
            <Person color="primary" sx={{ flexShrink: 0 }} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h5" fontWeight={900}>
                زبائن البيع الآجل
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={adminPageSubtitleSx}>
                سقف دين لكل زبون — اضغط على صف الزبون لعرض سجل التسديدات والمبيعات الآجلة
              </Typography>
            </Box>
          </Stack>
          <Button variant="contained" startIcon={<Add />} onClick={openNew} sx={{ textTransform: "none", fontWeight: 800 }}>
            زبون جديد
          </Button>
        </Stack>

        <Card sx={{ borderRadius: 3, overflow: "hidden" }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>
                    الاسم
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>
                    الهاتف
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>
                    الرصيد (دين)
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>
                    السقف
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>
                    تعديل
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>
                    تسديد
                  </TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>
                    حذف
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((c) => (
                  <TableRow
                    key={c.id}
                    hover
                    onClick={() => setLedgerCustomer(c)}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell align="center" sx={{ fontWeight: 700 }}>
                      {c.name}
                    </TableCell>
                    <TableCell align="center">{c.phone || "—"}</TableCell>
                    <TableCell
                      align="center"
                      sx={{ fontWeight: 800, ...negativeAmountTextSx(Number(c.balance || 0)) }}
                    >
                      {Number(c.balance || 0).toFixed(2)} شيكل
                    </TableCell>
                    <TableCell align="center">{Number(c.creditLimit || 0).toFixed(2)}</TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(c);
                        }}
                        sx={{ textTransform: "none" }}
                      >
                        تعديل
                      </Button>
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        color="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPayOpen(c);
                          setPayAmount("");
                        }}
                        sx={{ textTransform: "none" }}
                      >
                        تسديد
                      </Button>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          remove(c);
                        }}
                        aria-label="حذف"
                      >
                        <DeleteOutline fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {!rows.length ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      <Typography color="text.secondary">لا زبائن بعد — أضف من «زبون جديد»</Typography>
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>

        <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
          <DialogTitle sx={{ textAlign: "right" }}>{form.id ? "تعديل زبون" : "زبون جديد"}</DialogTitle>
          <DialogContent sx={{ textAlign: "right", pt: 1 }}>
            <Stack spacing={1.5} sx={{ mt: 1 }}>
              <TextField
                label="الاسم"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                fullWidth
                inputProps={{ style: { textAlign: "right" } }}
              />
              <TextField
                label="الهاتف"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                fullWidth
                inputProps={{ style: { textAlign: "right" } }}
              />
              <TextField
                label="سقف الدين (شيكل)"
                value={form.creditLimit}
                onChange={(e) => setForm((p) => ({ ...p, creditLimit: e.target.value }))}
                fullWidth
                inputProps={{ style: { textAlign: "right" } }}
              />
              <TextField
                label="الرصيد الحالي (دين)"
                value={form.balance}
                onChange={(e) => setForm((p) => ({ ...p, balance: e.target.value }))}
                fullWidth
                helperText="يمكن ضبطه يدوياً عند الإعداد أو يزيد تلقائياً من مبيعات آجل"
                inputProps={{ style: { textAlign: "right" } }}
              />
              <TextField
                label="ملاحظات"
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                fullWidth
                multiline
                minRows={2}
                inputProps={{ style: { textAlign: "right" } }}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setOpen(false)} sx={{ textTransform: "none" }}>
              إلغاء
            </Button>
            <Button variant="contained" onClick={save} sx={{ textTransform: "none", fontWeight: 800 }}>
              حفظ
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(ledgerCustomer)} onClose={() => setLedgerCustomer(null)} fullWidth maxWidth="md">
          <DialogTitle sx={{ textAlign: "right" }}>
            سجل حركة الزبون — {ledgerCustomer?.name}
          </DialogTitle>
          <DialogContent dividers sx={{ textAlign: "right" }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              الرصيد الحالي (دين):{" "}
              <Box
                component="span"
                fontWeight={700}
                sx={ledgerCustomer ? negativeAmountTextSx(Number(ledgerCustomer.balance || 0)) : {}}
              >
                {ledgerCustomer ? Number(ledgerCustomer.balance || 0).toFixed(2) : "—"} شيكل
              </Box>{" "}
              — السقف:{" "}
              <b>{ledgerCustomer ? Number(ledgerCustomer.creditLimit || 0).toFixed(2) : "—"}</b>
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.5 }}>
              يُسجّل تلقائياً: تسديد من الكاشير أو اللوحة، بيع آجل، عكس إلغاء فاتورة، وتعديل الرصيد من النموذج.
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>
                      التاريخ والوقت
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>
                      النوع
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>
                      التغيير
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>
                      الرصيد بعد
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>
                      المصدر / المستخدم
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>
                      ملاحظات
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ledgerRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        <Typography color="text.secondary" sx={{ py: 3 }}>
                          لا حركات مسجّلة بعد لهذا الزبون (ستظهر مع أول بيع آجل أو تسديد)
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    ledgerRows.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell align="center" sx={{ whiteSpace: "nowrap", fontSize: 12 }}>
                          {row.at ? new Date(row.at).toLocaleString("en-GB") : "—"}
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>
                          {LEDGER_TYPE_AR[row.type] || row.type}
                        </TableCell>
                        <TableCell
                          align="center"
                          sx={{
                            fontWeight: 800,
                            color: row.delta < 0 ? "success.main" : row.delta > 0 ? "error.main" : "text.secondary",
                          }}
                        >
                          {row.delta > 0 ? `+${Number(row.delta).toFixed(2)}` : Number(row.delta).toFixed(2)} شيكل
                        </TableCell>
                        <TableCell
                          align="center"
                          sx={{ fontWeight: 800, ...negativeAmountTextSx(Number(row.balanceAfter || 0)) }}
                        >
                          {Number(row.balanceAfter || 0).toFixed(2)}
                        </TableCell>
                        <TableCell align="center" sx={{ fontSize: 12 }}>
                          {row.source === "cashier"
                            ? "كاشير"
                            : row.source === "admin" || row.source === "admin_panel"
                              ? "لوحة المدير"
                              : row.source === "offline_sync"
                                ? "مزامنة أوفلاين"
                                : row.source === "admin_form"
                                  ? "نموذج الزبون"
                                  : row.source || "—"}
                          {row.username ? (
                            <Typography variant="caption" display="block" color="text.secondary">
                              {row.username}
                            </Typography>
                          ) : null}
                        </TableCell>
                        <TableCell align="right" sx={{ fontSize: 12, maxWidth: 220 }}>
                          {row.invoiceId ? (
                            <Typography variant="body2" display="block" fontWeight={700}>
                              فاتورة {row.invoiceId}
                            </Typography>
                          ) : null}
                          {row.note ? (
                            <Typography variant="caption" display="block" color="text.secondary">
                              {row.note}
                            </Typography>
                          ) : null}
                          {!row.invoiceId && !row.note ? "—" : null}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setLedgerCustomer(null)} sx={{ textTransform: "none" }} variant="contained">
              إغلاق
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(payOpen)} onClose={() => setPayOpen(null)} fullWidth maxWidth="xs">
          <DialogTitle sx={{ textAlign: "right" }}>تسديد دين — {payOpen?.name}</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="المبلغ (شيكل)"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              sx={{ mt: 1 }}
              inputProps={{ style: { textAlign: "right" } }}
            />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              يُخصم من رصيد الزبون فقط — أضف يدوياً للصندوق من إعداد المال إن لزم.
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPayOpen(null)} sx={{ textTransform: "none" }}>
              إلغاء
            </Button>
            <Button variant="contained" onClick={applyPayment} sx={{ textTransform: "none" }}>
              تأكيد التسديد
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </AdminLayout>
  );
}
