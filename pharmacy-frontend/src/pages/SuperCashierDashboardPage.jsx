import {
  AccountBalanceWallet,
  Category,
  Inventory,
  LocalShipping,
  PointOfSale,
  Replay,
  Settings,
} from "@mui/icons-material";
import { alpha, Box, Card, Chip, CircularProgress, Grid, Stack, Typography, useTheme } from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Axios } from "../Api/Axios";
import { adminPageContainerSx } from "../utils/adminPageLayout";
import { negativeAmountTextSx } from "../utils/negativeAmountStyle";
import { STORE_BALANCE_CHANGED } from "../utils/storeBalanceSync";
import AdminLayout from "./Admin/AdminLayout";

const STORE_BALANCE_KEY = "storeBalance";
const PURCHASE_INVOICES_KEY = "purchaseInvoices";

const LINKS = [
  {
    title: "الكاشير",
    desc: "البيع والسلة",
    path: "/cashier",
    icon: <PointOfSale sx={{ fontSize: 36 }} />,
    color: "primary",
  },
  {
    title: "الأصناف والمخزون",
    desc: "عرض وتعديل الكميات",
    path: "/admin/inventory",
    icon: <Inventory sx={{ fontSize: 36 }} />,
    color: "primary",
  },
  {
    title: "الأقسام",
    desc: "من الخادم — أقسام المبيعات",
    path: "/admin/inventory?section=categories",
    icon: <Category sx={{ fontSize: 36 }} />,
    color: "secondary",
  },
  {
    title: "المشتريات",
    desc: "تسجيل توريد للمخزون",
    path: "/admin/purchases",
    icon: <LocalShipping sx={{ fontSize: 36 }} />,
    color: "secondary",
  },
  {
    title: "مرتجعات المشتريات",
    desc: "إدارة المرتجعات",
    path: "/admin/returns/purchases",
    icon: <Replay sx={{ fontSize: 36 }} />,
    color: "warning",
  },
  {
    title: "زبائن الآجل",
    desc: "حسابات الزبائن",
    path: "/admin/debt-customers",
    icon: <AccountBalanceWallet sx={{ fontSize: 36 }} />,
    color: "info",
  },
  {
    title: "إعداداتي",
    desc: "الحساب، الصورة، كلمة المرور، مظهر الموقع",
    path: "/cashier/settings/account",
    icon: <Settings sx={{ fontSize: 36 }} />,
    color: "success",
  },
];

export default function SuperCashierDashboardPage({ mode = "light", onToggleMode }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryErr, setSummaryErr] = useState("");
  const [localTick, setLocalTick] = useState(0);

  const storeBalance = useMemo(() => {
    void localTick;
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_BALANCE_KEY));
      if (raw && typeof raw === "object") {
        return {
          total: Number(raw.total || 0),
          cash: Number(raw.cash || 0),
          app: Number(raw.app || 0),
        };
      }
    } catch {
      // ignore
    }
    return { total: 0, cash: 0, app: 0 };
  }, [localTick]);

  const purchaseToday = useMemo(() => {
    void localTick;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    let rows = [];
    try {
      const raw = JSON.parse(localStorage.getItem(PURCHASE_INVOICES_KEY));
      rows = Array.isArray(raw) ? raw : [];
    } catch {
      rows = [];
    }
    let sum = 0;
    let n = 0;
    for (const inv of rows) {
      if (String(inv.status || "") === "مرجع") continue;
      const d = new Date(inv.purchasedAt || 0);
      if (Number.isNaN(d.getTime()) || d < start) continue;
      sum += Number(inv.total || 0);
      n += 1;
    }
    return { sum, n };
  }, [localTick]);

  useEffect(() => {
    const onBal = () => setLocalTick((t) => t + 1);
    window.addEventListener(STORE_BALANCE_CHANGED, onBal);
    return () => window.removeEventListener(STORE_BALANCE_CHANGED, onBal);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSummaryLoading(true);
      setSummaryErr("");
      try {
        const { data } = await Axios.get("dashboard/summary");
        if (!cancelled && data?.success && data?.data) setSummary(data.data);
      } catch {
        if (!cancelled) setSummaryErr("ملخص الخادم غير متاح — تُعرض أرقام محلية فقط");
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AdminLayout mode={mode} onToggleMode={onToggleMode}>
      <Box sx={adminPageContainerSx}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1} sx={{ mb: 2 }}>
          <Typography variant="h5" fontWeight={900}>
            لوحة التوريد — سوبر كاشير
          </Typography>
          <Chip size="small" color="secondary" label="صلاحية محدودة" sx={{ fontWeight: 800 }} />
        </Stack>

        <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Card variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>
                الخزنة (محلي)
              </Typography>
              <Typography variant="h6" fontWeight={900} sx={negativeAmountTextSx(storeBalance.total)}>
                {storeBalance.total.toFixed(1)} شيكل
              </Typography>
              <Typography variant="caption" component="div" color="text.secondary" sx={{ mt: 0.25 }}>
                <Box component="span" sx={negativeAmountTextSx(storeBalance.cash, {})}>
                  نقد: {storeBalance.cash.toFixed(1)}
                </Box>
                {" · "}
                <Box component="span" sx={negativeAmountTextSx(storeBalance.app, {})}>
                  تطبيق: {storeBalance.app.toFixed(1)}
                </Box>
              </Typography>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Card variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>
                مشتريات اليوم (محلي)
              </Typography>
              <Typography variant="h6" fontWeight={900}>
                {purchaseToday.sum.toFixed(1)} شيكل
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {purchaseToday.n} عملية
              </Typography>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Card variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary" fontWeight={700}>
                مبيعات اليوم (خادم)
              </Typography>
              {summaryLoading ? (
                <CircularProgress size={22} sx={{ mt: 0.5 }} />
              ) : (
                <Typography variant="h6" fontWeight={900}>
                  {summary ? Number(summary.today?.total_sales ?? 0).toFixed(1) : "—"} شيكل
                </Typography>
              )}
              <Typography variant="caption" color="text.secondary">
                {summaryErr || (summary ? `${summary.today?.orders_count ?? 0} طلب` : "")}
              </Typography>
            </Card>
          </Grid>
        </Grid>

        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 700 }}>
          الصفحات المتاحة لك
        </Typography>
        <Grid container spacing={1.5}>
          {LINKS.map((item) => (
            <Grid key={item.path} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card
                onClick={() => navigate(item.path)}
                sx={{
                  p: 2,
                  borderRadius: 2,
                  cursor: "pointer",
                  height: "100%",
                  border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
                  transition: "0.15s ease",
                  "&:hover": {
                    boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, 0.08)}`,
                    borderColor: alpha(theme.palette.primary.main, 0.35),
                  },
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="flex-start">
                  <Box
                    sx={{
                      color: `${item.color}.main`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {item.icon}
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography fontWeight={900}>{item.title}</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                      {item.desc}
                    </Typography>
                  </Box>
                </Stack>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </AdminLayout>
  );
}
