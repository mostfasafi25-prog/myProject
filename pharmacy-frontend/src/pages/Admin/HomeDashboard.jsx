import {
  AccountBalanceWallet,
  AutoAwesome,
  EventAvailable,
  FormatQuote,
  Lightbulb,
  LocalShipping,
  PointOfSale,
  TrendingUp,
  WarningAmber,
} from "@mui/icons-material";
import {
  alpha,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Grid,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { keyframes } from "@mui/system";
import axios from "axios";
import Cookies from "universal-cookie";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { baseURL } from "../../Api/Api";
import { productDisplayName } from "../../utils/productDisplayName";
import { daysUntilExpiry } from "../../utils/productExpiry";
import { adminPageContainerSx } from "../../utils/adminPageLayout";
import AdminLayout from "./AdminLayout";
const STORE_BALANCE_KEY = "storeBalance";
const PURCHASE_INVOICES_KEY = "purchaseInvoices";

/** نصائح عملية تتغير يومياً (نفس اليوم = نفس النصيحة) */
const PHARMACY_DAILY_TIPS = [
  "راجع أصناف قرب انتهاء الصلاحية أسبوعياً ورتّب العروض عليها قبل الخسارة.",
  "ثبّت الحد الأدنى لكل صنف حسب معدل البيع الفعلي وليس تقديراً عشوائياً.",
  "افتح الصندوق/الكاشير بمبلغ صغير ثابت وسجّل أي زيادة كإيداع لسهولة المراجعة.",
  "فضّل البيع حسب تاريخ الانتهاء (FIFO) خصوصاً للأدوية والمواد الحساسة.",
  "وحّد أسماء الأصناف في النظام لتفادي ازدواجية نفس المنتج تحت عناوين مختلفة.",
  "اعرض الأصناف الأكثر طلباً في متناول اليد والرؤية لتقليل وقت انتظار الزبون.",
  "سجّل مرتجعات المبيعات فوراً مع السبب لتحليل أسباب الرفض لاحقاً.",
  "قارن فواتير المورد مع الكميات المستلمة قبل اعتماد الدفع.",
  "فعّل تنبيهات نواقص المخزون ولا تنتظر نفاد الكمية بالكامل.",
  "احتفظ بنسخة احتياطية من بيانات الفواتير والمخزون بشكل دوري.",
  "درّب الكاشير على البحث السريع بالاسم أو الباركود لتقليل الأخطاء.",
  "راقب الفرق بين المبيعات النقدية وتطبيق الدفع يومياً.",
  "نظّم الرفوف حسب التصنيف ثم حسب الحركة لتسريع الجرد.",
  "حدّث أسعار البيع عند تغيّر تكلفة الشراء لتثبيت هامش معقول.",
  "سجّل ملاحظات على الزبائن الدائمين (حساسية، أدوية ممنوعة) بما يتوافق الخصوصية.",
  "افصل واجهة الكاشير عن شاشة الإدارة لتقليل الضجيج والأخطاء.",
  "راجع تقرير المبيعات أسبوعياً لاكتشاف انخفاض مفاجئ في صنف معيّن.",
  "ضع سياسة واضحة للعروض والخصومات ولا تتركها لاجتهاد فردي.",
  "تأكد من تطابق رصيد الصندوق المحلي مع إجمالي المقبوض قبل إغلاق الدوام.",
  "استخدم فئات واضحة في المخزون لتسهيل التقارير وليس فقط للعرض.",
  "ذكّر الفريق بغسل اليدين والنظافة عند التعامل مع المنتجات المفتوحة.",
  "تابع المنتجات الموسمية مبكراً (شتاء/صيف) قبل ذروة الطلب.",
  "وثّق أي تلف أو كسر فور حدوثه لربطه بالجرد وليس لاحقاً من الذاكرة.",
  "قلّل الأصناف الراكدة: خصم خفيف أفضل من ركود طويل في الرف.",
  "اختصر مسار «بحث → إضافة للسلة → دفع» في شاشة الكاشير قدر الإمكان.",
];

function dailyTipIndexForDate(d = new Date()) {
  const y = d.getFullYear();
  const start = new Date(y, 0, 0);
  const doy = Math.floor((d - start) / 86400000);
  return (y * 372 + doy) % PHARMACY_DAILY_TIPS.length;
}

const float = keyframes`
  0%,100% { transform: translateY(0px); }
  50% { transform: translateY(-8px); }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

export default function HomeDashboard({ mode = "light", onToggleMode }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const cookies = new Cookies();
  const [periodView, setPeriodView] = useState("day");
  const [summary, setSummary] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryErr, setSummaryErr] = useState("");
  const [localTick, setLocalTick] = useState(0);
  const isDark = theme.palette.mode === "dark";
  const [storeBalance, setStoreBalance] = useState(() => {
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
      // ignore malformed storage
    }
    return { total: 0, cash: 0, app: 0 };
  });
  const refreshBalance = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_BALANCE_KEY));
      if (raw && typeof raw === "object") {
        setStoreBalance({
          total: Number(raw.total || 0),
          cash: Number(raw.cash || 0),
          app: Number(raw.app || 0),
        });
        return;
      }
    } catch {
      // ignore malformed storage
    }
    setStoreBalance({ total: 0, cash: 0, app: 0 });
  };
  useEffect(() => {
    const onFocus = () => {
      refreshBalance();
      setLocalTick((t) => t + 1);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSummaryLoading(true);
      setSummaryErr("");
      try {
        const token = cookies.get("token");
        const { data } = await axios.get(`${baseURL}dashboard/summary`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!cancelled && data?.success && data?.data) setSummary(data.data);
      } catch {
        if (!cancelled) setSummaryErr("تعذر تحميل ملخص الخادم — تُستخدم البيانات المحلية حيث أمكن");
      } finally {
        if (!cancelled) setSummaryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const salesInvoicesLocal = useMemo(() => {
    void localTick;
    try {
      const raw = JSON.parse(localStorage.getItem("salesInvoices"));
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }, [localTick]);

  const adminProducts = useMemo(() => {
    void localTick;
    try {
      const raw = JSON.parse(localStorage.getItem("adminProducts"));
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }, [localTick]);

  const purchaseInvoicesLocal = useMemo(() => {
    void localTick;
    try {
      const raw = JSON.parse(localStorage.getItem(PURCHASE_INVOICES_KEY));
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }, [localTick]);

  const lowStockCount = useMemo(
    () => adminProducts.filter((p) => p.active !== false && Number(p.qty || 0) < Number(p.min || 0)).length,
    [adminProducts],
  );

  const lowStockItems = useMemo(
    () =>
      adminProducts
        .filter((p) => p.active !== false && Number(p.qty || 0) < Number(p.min || 0))
        .sort((a, b) => Number(a.qty || 0) - Number(b.qty || 0))
        .slice(0, 15),
    [adminProducts],
  );

  const expirySummary = useMemo(() => {
    const expired = [];
    const soon = [];
    for (const p of adminProducts) {
      if (p.active === false) continue;
      if (!p.expiryDate) continue;
      const days = daysUntilExpiry(p.expiryDate);
      if (days == null) continue;
      if (Number(p.qty || 0) <= 0) continue;
      const row = { p, days };
      if (days < 0) expired.push(row);
      else if (days <= 30) soon.push(row);
    }
    expired.sort((a, b) => a.days - b.days);
    soon.sort((a, b) => a.days - b.days);
    return {
      expiredCount: expired.length,
      soonCount: soon.length,
      expiredTop: expired.slice(0, 14),
      soonTop: soon.slice(0, 14),
    };
  }, [adminProducts]);

  const purchasePeriodStats = useMemo(() => {
    const now = new Date();
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(dayStart);
    weekStart.setDate(weekStart.getDate() - 6);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    let from = dayStart;
    let to = dayEnd;
    let label = "اليوم";
    if (periodView === "week") {
      from = weekStart;
      to = dayEnd;
      label = "آخر 7 أيام";
    } else if (periodView === "month") {
      from = monthStart;
      to = monthEnd;
      label = "الشهر الحالي";
    }
    let total = 0;
    let count = 0;
    for (const inv of purchaseInvoicesLocal) {
      if (String(inv.status || "") === "مرجع") continue;
      const d = new Date(inv.purchasedAt || 0);
      if (Number.isNaN(d.getTime()) || d < from || d > to) continue;
      total += Number(inv.total || 0);
      count += 1;
    }
    return { total, count, label };
  }, [purchaseInvoicesLocal, periodView]);

  const kpiValues = useMemo(() => {
    const now = new Date();
    const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(dayStart);
    weekStart.setDate(weekStart.getDate() - 6);
    const sumRange = (from, to) => {
      let sales = 0;
      let count = 0;
      for (const inv of salesInvoicesLocal) {
        const d = new Date(inv.soldAt || 0);
        if (Number.isNaN(d.getTime()) || d < from || d > to) continue;
        sales += Number(inv.total || 0);
        count += 1;
      }
      return { sales, count };
    };
    if (periodView === "day") {
      const local = sumRange(dayStart, dayEnd);
      if (summary && !summaryErr) {
        return {
          sales: Number(summary.today?.total_sales ?? local.sales),
          orders: Number(summary.today?.orders_count ?? local.count),
          profit: summary.today?.total_profit != null ? Number(summary.today.total_profit) : null,
          label: "اليوم",
        };
      }
      return { sales: local.sales, orders: local.count, profit: null, label: "اليوم" };
    }
    if (periodView === "week") {
      const w = sumRange(weekStart, dayEnd);
      return { sales: w.sales, orders: w.count, profit: null, label: "آخر 7 أيام" };
    }
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const localM = sumRange(monthStart, monthEnd);
    const apiM = summary?.this_month;
    if (summary && !summaryErr && apiM) {
      return {
        sales: Number(apiM.total_sales ?? localM.sales),
        orders: Number(apiM.orders_count ?? localM.count),
        profit: apiM.total_profit != null ? Number(apiM.total_profit) : null,
        label: "الشهر الحالي",
      };
    }
    return {
      sales: localM.sales,
      orders: localM.count,
      profit: null,
      label: "الشهر الحالي",
    };
  }, [periodView, summary, summaryErr, salesInvoicesLocal]);

  const kpis = useMemo(
    () => [
      {
        title: `مبيعات (${kpiValues.label})`,
        value: `${kpiValues.sales.toFixed(1)} شيكل`,
        icon: <PointOfSale />,
        delta: `${kpiValues.orders} طلب`,
        progress: Math.min(100, kpiValues.sales > 0 ? Math.min(100, 12 + (kpiValues.orders % 40)) : 8),
        navigateTo: "/admin/reports/sales",
      },
      {
        title: "صافي الربح (تقريبي)",
        value: kpiValues.profit != null ? `${kpiValues.profit.toFixed(1)} شيكل` : "— (محلي فقط)",
        icon: <TrendingUp />,
        delta: kpiValues.profit != null ? "من الخادم" : "غير متوفر للفترة",
        progress: kpiValues.profit != null ? Math.min(100, 25 + (Number(kpiValues.profit) % 60)) : 12,
        navigateTo: "/admin/reports",
      },
      {
        title: `مشتريات (${purchasePeriodStats.label})`,
        value: `${purchasePeriodStats.total.toFixed(1)} شيكل`,
        icon: <LocalShipping />,
        delta: `${purchasePeriodStats.count} عملية شراء`,
        progress: Math.min(100, purchasePeriodStats.total > 0 ? 18 + (purchasePeriodStats.count % 45) : 10),
        navigateTo: "/admin/purchases",
      },
      {
        title: "السيولة (الصندوق المحلي)",
        value: `${storeBalance.total.toFixed(1)} شيكل`,
        icon: <AccountBalanceWallet />,
        liquiditySplit: true,
        progress: Math.min(100, 30 + (storeBalance.total % 50)),
        navigateTo: "/admin/settings/money",
      },
    ],
    [kpiValues, purchasePeriodStats, storeBalance],
  );

  const chartDays = useMemo(() => {
    if (summary?.monthly_days?.length) return summary.monthly_days;
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const dim = new Date(y, m + 1, 0).getDate();
    const days = [];
    for (let d = 1; d <= dim; d++) {
      const ds = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({ date: ds, label: String(d), sales: 0, count: 0 });
    }
    for (const inv of salesInvoicesLocal) {
      const sold = inv.soldAt ? new Date(inv.soldAt) : null;
      if (!sold || Number.isNaN(sold.getTime()) || sold.getMonth() !== m || sold.getFullYear() !== y) continue;
      const idx = sold.getDate() - 1;
      if (days[idx]) {
        days[idx].sales += Number(inv.total || 0);
        days[idx].count += 1;
      }
    }
    return days;
  }, [summary, salesInvoicesLocal]);

  const maxChartSales = Math.max(1, ...chartDays.map((d) => Number(d.sales || 0)));

  const categoryShare = useMemo(() => {
    const m = new Map();
    let total = 0;
    for (const p of adminProducts) {
      if (p.active === false) continue;
      const c = p.category || "أخرى";
      const q = Number(p.qty || 0);
      m.set(c, (m.get(c) || 0) + q);
      total += q;
    }
    return [...m.entries()]
      .map(([name, qty]) => ({ name, pct: total > 0 ? Math.round((qty / total) * 100) : 0 }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 6);
  }, [adminProducts]);

  const topSellers = useMemo(() => {
    const qtyByName = new Map();
    for (const inv of salesInvoicesLocal) {
      for (const it of inv.items || []) {
        const k = it.name || "—";
        qtyByName.set(k, (qtyByName.get(k) || 0) + Number(it.qty || 0));
      }
    }
    return [...qtyByName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [salesInvoicesLocal]);

  const hourlySalesChartData = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, sales: 0, count: 0 }));
    for (const inv of salesInvoicesLocal) {
      const d = new Date(inv.soldAt || 0);
      if (Number.isNaN(d.getTime())) continue;
      const h = d.getHours();
      buckets[h].sales += Number(inv.total || 0);
      buckets[h].count += 1;
    }
    const maxSales = Math.max(0, ...buckets.map((b) => b.sales));
    return buckets.map((b) => ({
      ...b,
      label: `${String(b.hour).padStart(2, "0")}:00`,
      isPeak: maxSales > 0 && b.sales === maxSales,
    }));
  }, [salesInvoicesLocal]);

  const peakHoursInfo = useMemo(() => {
    const maxSales = Math.max(0, ...hourlySalesChartData.map((b) => b.sales));
    if (maxSales <= 0) return { maxSales: 0, hours: [] };
    const hours = hourlySalesChartData.filter((b) => b.sales === maxSales).map((b) => b.hour);
    return { maxSales, hours };
  }, [hourlySalesChartData]);

  const dailyTipText = useMemo(() => {
    void localTick;
    return PHARMACY_DAILY_TIPS[dailyTipIndexForDate(new Date())];
  }, [localTick]);

  const dailyTipDateLabel = useMemo(() => {
    void localTick;
    return new Date().toLocaleDateString("ar", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [localTick]);

  return (
    <AdminLayout mode={mode} onToggleMode={onToggleMode}>
      <Box
        sx={{
          ...adminPageContainerSx,
          flex: 1,
          minWidth: 0,
          px: { xs: 0, sm: 0.5 },
          pt: { xs: 0.5, sm: 0.5 },
          pb: { xs: 1, md: 0 },
        }}
      >
        <Stack direction="row" justifyContent="flex-start" sx={{ mt: { xs: 0.5, md: 1.5 }, mb: 1, gap: 1, flexWrap: "wrap" }}>
          {[
            { key: "day", label: "يوم" },
            { key: "week", label: "أسبوع" },
            { key: "month", label: "شهر" },
          ].map((period) => (
            <Button
              key={period.key}
              onClick={() => setPeriodView(period.key)}
              variant={periodView === period.key ? "contained" : "text"}
              sx={{ minWidth: 84, textTransform: "none", borderRadius: 2, fontWeight: 700 }}
            >
              {period.label}
            </Button>
          ))}
        </Stack>

        {summaryErr ? (
          <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
            {summaryErr}
          </Typography>
        ) : null}
        <Grid container spacing={{ xs: 2, md: 3 }} mt={{ xs: 1, md: 1.5 }} alignItems="stretch">
          {kpis.map((item, idx) => {
            const kpiClickable = Boolean(item.navigateTo);
            return (
            <Grid key={item.title} size={{ xs: 12, sm: 6, lg: 3 }}>
              <Card
                onClick={kpiClickable ? () => navigate(item.navigateTo) : undefined}
                role={kpiClickable ? "button" : undefined}
                tabIndex={kpiClickable ? 0 : undefined}
                onKeyDown={
                  kpiClickable
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(item.navigateTo);
                        }
                      }
                    : undefined
                }
                sx={{
                  p: { xs: 1.5, sm: 2 },
                  height: "100%",
                  borderRadius: 3,
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                  background: alpha(theme.palette.background.paper, 0.9),
                  transition: "transform .25s ease, box-shadow .25s ease",
                  animation: `${float} ${3 + idx * 0.4}s ease-in-out infinite`,
                  ...(kpiClickable
                    ? { cursor: "pointer", "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 } }
                    : {}),
                  "&:hover": {
                    transform: { xs: "none", sm: "translateY(-4px)" },
                    boxShadow: { xs: "none", sm: `0 14px 30px ${alpha(theme.palette.primary.main, 0.18)}` },
                  },
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5} sx={{ gap: 1, flexWrap: "wrap" }}>
                  <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.14), color: "primary.main" }}>
                    {item.icon}
                  </Avatar>
                  {item.liquiditySplit ? (
                    <Stack direction="row" alignItems="center" sx={{ gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <Chip
                        size="small"
                        label={`كاش ${storeBalance.cash.toFixed(0)}`}
                        color="success"
                        variant="filled"
                        sx={{ fontWeight: 800 }}
                      />
                      <Chip
                        size="small"
                        label={`تطبيق ${storeBalance.app.toFixed(0)}`}
                        color="info"
                        variant="filled"
                        sx={{ fontWeight: 800 }}
                      />
                    </Stack>
                  ) : (
                    <Chip
                      size="small"
                      label={item.delta}
                      color={
                        item.delta.includes("+")
                          ? "success"
                          : item.delta.includes("يحتاج") || item.delta.includes("حرج")
                            ? "warning"
                            : item.navigateTo === "/admin/purchases"
                              ? "secondary"
                              : "primary"
                      }
                      variant="outlined"
                    />
                  )}
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  {item.title}
                </Typography>
                <Typography variant="h6" fontWeight={800} mb={1}>
                  {item.value}
                </Typography>
                <LinearProgress variant="determinate" value={item.progress} sx={{ borderRadius: 99, height: 7 }} />
              </Card>
            </Grid>
            );
          })}
        </Grid>

        <Grid container spacing={{ xs: 2, md: 3 }} mt={{ xs: 1, md: 1.5 }} alignItems="stretch">
          <Grid size={{ xs: 12, lg: 8 }}>
            <Card
              sx={{
                p: { xs: 2, sm: 2.5 },
                height: "100%",
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
              }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", sm: "center" }}
                mb={2}
                sx={{ gap: 2 }}
              >
                <Box>
                  <Typography fontWeight={800}>تحليل المبيعات الشهري</Typography>
                  <Typography variant="body2" color="text.secondary">
                    كل عمود = يوم من الشهر الحالي — مرّر المؤشر لعرض المبلغ وعدد الفواتير
                    {summary?.monthly_days?.length ? " (من الخادم)" : " (محلي من فواتير الكاشير)"}
                  </Typography>
                </Box>
                <Stack direction="row" alignItems="center" sx={{ gap: 1 }}>
                  {summaryLoading ? <CircularProgress size={22} /> : null}
                  <Button
                    variant="contained"
                    onClick={() => navigate("/admin/reports")}
                    sx={{ textTransform: "none", alignSelf: { xs: "stretch", sm: "auto" } }}
                  >
                    تقارير المبيعات
                  </Button>
                </Stack>
              </Stack>

              <Stack
                direction="row"
                alignItems="end"
                sx={{
                  height: { xs: 200, sm: 220, md: 240 },
                  gap: { xs: 0.5, sm: 1 },
                  overflowX: "auto",
                  pb: 1,
                  mx: { xs: -1, sm: 0 },
                  px: { xs: 1, sm: 0 },
                  scrollbarWidth: "thin",
                  "&::-webkit-scrollbar": { height: 6 },
                }}
              >
                {chartDays.map((day, i) => {
                  const sales = Number(day.sales || 0);
                  const cnt = Number(day.count || 0);
                  const pct = Math.round((sales / maxChartSales) * 100);
                  const h = Math.max(6, pct);
                  return (
                    <Tooltip
                      key={day.date || i}
                      arrow
                      placement="top"
                      title={
                        <Box sx={{ py: 0.25, textAlign: "right" }}>
                          <Typography variant="subtitle2" fontWeight={800}>
                            يوم {day.label}
                          </Typography>
                          <Typography variant="caption" display="block" color="grey.200">
                            {day.date}
                          </Typography>
                          <Typography variant="body2" sx={{ mt: 0.5 }}>
                            إجمالي المبيعات: <b>{sales.toFixed(1)}</b> شيكل
                          </Typography>
                          <Typography variant="caption">عدد الفواتير: {cnt}</Typography>
                        </Box>
                      }
                    >
                      <Box
                        sx={{
                          flex: { xs: "1 1 0", sm: "1 1 0" },
                          minWidth: { xs: 3, sm: 0 },
                          borderRadius: "10px 10px 4px 4px",
                          height: `${h}%`,
                          cursor: "default",
                          background:
                            sales > 0
                              ? `linear-gradient(180deg, ${alpha(theme.palette.primary.main, isDark ? 0.95 : 0.85)}, ${alpha(theme.palette.primary.main, isDark ? 0.5 : 0.28)})`
                              : alpha(theme.palette.action.hover, 0.35),
                          backgroundSize: "200% 100%",
                          animation: sales > 0 ? `${shimmer} 3.5s linear infinite` : "none",
                          boxShadow:
                            isDark && sales > 0 ? `0 0 10px ${alpha(theme.palette.primary.main, 0.28)}` : "none",
                        }}
                      />
                    </Tooltip>
                  );
                })}
              </Stack>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, lg: 4 }}>
            <Card
              sx={{
                p: { xs: 2, sm: 2.5 },
                height: "100%",
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
              }}
            >
              <Typography fontWeight={800} mb={0.5}>
                توزيع المخزون
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                حسب التصنيف
              </Typography>

              {categoryShare.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  لا بيانات مخزون محلية — أضف أصناف من صفحة المخزون
                </Typography>
              ) : (
                categoryShare.map(({ name, pct }) => (
                  <Box key={name} mb={1.5}>
                    <Stack direction="row" justifyContent="space-between">
                      <Typography variant="body2">{name}</Typography>
                      <Typography variant="body2" fontWeight={700}>
                        {pct}%
                      </Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={pct} sx={{ borderRadius: 99, height: 7, mt: 0.6 }} />
                  </Box>
                ))
              )}
            </Card>
          </Grid>
        </Grid>

        <Grid container spacing={{ xs: 2, md: 3 }} mt={{ xs: 1, md: 1.5 }} alignItems="stretch">
          <Grid size={{ xs: 12, lg: 6 }}>
            <Card
              sx={{
                p: { xs: 2, sm: 2.5 },
                height: "100%",
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                background: alpha(theme.palette.background.paper, 0.95),
              }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                alignItems={{ xs: "stretch", sm: "flex-start" }}
                justifyContent="space-between"
                sx={{ gap: 1.5, mb: 1.5 }}
              >
                <Box>
                  <Typography fontWeight={800}>أفضل أوقات البيع</Typography>
                  <Typography variant="body2" color="text.secondary">
                    توزيع المبيعات حسب ساعة اليوم من فواتير الكاشير المحفوظة محلياً
                  </Typography>
                </Box>
                {peakHoursInfo.maxSales > 0 ? (
                  <Chip
                    label={`أقوى ساعة: ${peakHoursInfo.hours.map((h) => `${h}:00`).join("، ")} · ${peakHoursInfo.maxSales.toFixed(1)} شيكل`}
                    color="secondary"
                    sx={{ fontWeight: 800, alignSelf: { xs: "flex-start", sm: "center" } }}
                  />
                ) : (
                  <Chip label="لا بيانات بعد" variant="outlined" sx={{ fontWeight: 700 }} />
                )}
              </Stack>

              {salesInvoicesLocal.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                  لا فواتير مبيعات محفوظة — يظهر المخطط بعد تسجيل مبيعات من الكاشير
                </Typography>
              ) : (
                <Box sx={{ width: "100%", height: { xs: 260, sm: 280 }, mt: 0.5 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourlySalesChartData} margin={{ top: 6, right: 6, left: -18, bottom: 4 }}>
                      <defs>
                        <linearGradient id="hourBarFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={theme.palette.primary.main} stopOpacity={isDark ? 0.95 : 0.88} />
                          <stop offset="100%" stopColor={theme.palette.primary.main} stopOpacity={isDark ? 0.35 : 0.22} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="4 4"
                        vertical={false}
                        stroke={alpha(theme.palette.divider, isDark ? 0.5 : 0.9)}
                      />
                      <XAxis
                        dataKey="hour"
                        tick={{ fill: theme.palette.text.secondary, fontSize: 10 }}
                        tickLine={false}
                        axisLine={{ stroke: alpha(theme.palette.divider, 0.8) }}
                        interval={2}
                      />
                      <YAxis
                        tick={{ fill: theme.palette.text.secondary, fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                        width={36}
                        tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
                      />
                      <RechartsTooltip
                        cursor={{ fill: alpha(theme.palette.primary.main, 0.06) }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const row = payload[0].payload;
                          return (
                            <Box
                              sx={{
                                bgcolor: "background.paper",
                                border: 1,
                                borderColor: "divider",
                                borderRadius: 2,
                                px: 1.25,
                                py: 1,
                                boxShadow: 3,
                              }}
                            >
                              <Typography variant="caption" fontWeight={800} display="block">
                                الساعة {row.label}
                              </Typography>
                              <Typography variant="body2" sx={{ mt: 0.5 }}>
                                مبيعات: <b>{Number(row.sales).toFixed(1)}</b> شيكل
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                فواتير: {row.count}
                              </Typography>
                            </Box>
                          );
                        }}
                      />
                      <Bar dataKey="sales" radius={[8, 8, 0, 0]} maxBarSize={18}>
                        {hourlySalesChartData.map((entry) => (
                          <Cell
                            key={entry.hour}
                            fill={
                              entry.isPeak
                                ? theme.palette.secondary.main
                                : "url(#hourBarFill)"
                            }
                            stroke={
                              entry.isPeak
                                ? alpha(theme.palette.secondary.dark, 0.5)
                                : alpha(theme.palette.primary.dark, 0.2)
                            }
                            strokeWidth={entry.isPeak ? 1.5 : 0}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </Card>
          </Grid>

          <Grid size={{ xs: 12, lg: 6 }}>
            <Card
              sx={{
                p: { xs: 2, sm: 2.5 },
                height: "100%",
                borderRadius: 3,
                border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
              }}
            >
              <Typography fontWeight={800} mb={2}>
                الأصناف الأكثر مبيعاً (محلي)
              </Typography>
              {topSellers.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  لا فواتير مبيعات محفوظة بعد
                </Typography>
              ) : (
                topSellers.map(([name, qty], idx) => {
                  const maxQ = topSellers[0][1] || 1;
                  const bar = Math.min(100, Math.round((qty / maxQ) * 100));
                  return (
                    <Box key={name} mb={1.5}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" fontWeight={700}>
                          #{idx + 1} {name}
                        </Typography>
                        <Typography variant="caption" color="primary" fontWeight={800}>
                          {qty} وحدة
                        </Typography>
                      </Stack>
                      <LinearProgress variant="determinate" value={bar} sx={{ borderRadius: 99, height: 7, mt: 0.6 }} />
                    </Box>
                  );
                })
              )}
            </Card>
          </Grid>
        </Grid>

        <Card
          sx={{
            mt: { xs: 2, md: 2.5 },
            mb: 0,
            borderRadius: 3,
            overflow: "hidden",
            border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
            background: `linear-gradient(165deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(
              theme.palette.background.paper,
              0.98,
            )} 40%, ${alpha(theme.palette.secondary.main, 0.04)} 100%)`,
            boxShadow: `0 12px 36px ${alpha(theme.palette.primary.main, 0.1)}`,
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent="space-between"
            sx={{
              gap: 1.5,
              px: { xs: 2, sm: 2.5 },
              py: 2,
              borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
              bgcolor: alpha(theme.palette.primary.main, 0.06),
            }}
          >
            <Stack direction="row" alignItems="center" sx={{ gap: 1.25, flexWrap: "wrap" }}>
              <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.14), color: "primary.main" }}>
                <EventAvailable />
              </Avatar>
              <Box>
                <Typography fontWeight={900} variant="h6" sx={{ fontSize: { xs: "1.05rem", sm: "1.2rem" } }}>
                  صلاحية الأصناف (كمية &gt; 0)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  منتهية أو ضمن 30 يوماً — رتّب البيع حسب الأقرب انتهاءً
                </Typography>
              </Box>
              <Chip
                label={
                  expirySummary.expiredCount + expirySummary.soonCount === 0
                    ? "لا تنبيهات"
                    : `${expirySummary.expiredCount} منتهي · ${expirySummary.soonCount} قريب`
                }
                color={expirySummary.expiredCount > 0 ? "error" : expirySummary.soonCount > 0 ? "warning" : "success"}
                variant="outlined"
                sx={{ fontWeight: 800, borderColor: alpha(theme.palette.primary.main, 0.35) }}
              />
            </Stack>
            <Button
              variant="contained"
              color="primary"
              onClick={() => navigate("/admin/inventory")}
              sx={{ textTransform: "none", fontWeight: 800, alignSelf: { xs: "stretch", sm: "center" } }}
            >
              المخزون وتواريخ الصلاحية
            </Button>
          </Stack>
          {expirySummary.expiredCount + expirySummary.soonCount === 0 ? (
            <Box sx={{ py: 3, px: 2, textAlign: "center" }}>
              <Typography color="text.secondary" fontWeight={700}>
                لا أصناف لها تاريخ صلاحية مسجّل تحتاج تنبيهاً، أو المخزون صفر لكل ما له تاريخ.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
              <Grid container spacing={1.25}>
                {[...expirySummary.expiredTop, ...expirySummary.soonTop].map(({ p, days }) => (
                  <Grid key={`${p.id}-${days}`} size={{ xs: 12, sm: 6, md: 4 }}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 1.25,
                        borderRadius: 2,
                        border: `1px solid ${alpha(
                          days < 0 ? theme.palette.error.main : theme.palette.warning.main,
                          0.28,
                        )}`,
                        bgcolor:
                          days < 0
                            ? alpha(theme.palette.error.main, 0.04)
                            : alpha(theme.palette.warning.main, 0.06),
                        borderRight: `3px solid ${
                          days < 0 ? theme.palette.error.main : theme.palette.warning.main
                        }`,
                      }}
                    >
                      <Typography fontWeight={800} sx={{ lineHeight: 1.35 }}>
                        {productDisplayName(p)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        ينتهي: {p.expiryDate} — متاح {Number(p.qty || 0).toFixed(1)}
                      </Typography>
                      <Chip
                        size="small"
                        sx={{ mt: 1, fontWeight: 800 }}
                        color={days < 0 ? "error" : "warning"}
                        label={days < 0 ? `منتهي منذ ${Math.abs(days)} يوم` : `يتبقى ${days} يوم`}
                      />
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}
        </Card>

        <Grid container spacing={{ xs: 2, md: 3 }} mt={{ xs: 2, md: 2.5 }} alignItems="stretch">
          <Grid size={{ xs: 12, md: 6 }}>
            <Card
              sx={{
                height: "100%",
                borderRadius: 3,
                overflow: "hidden",
                border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                background: alpha(theme.palette.background.paper, 0.92),
                boxShadow: `0 12px 32px ${alpha(theme.palette.primary.main, 0.1)}`,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Stack
                direction={{ xs: "column", sm: "row" }}
                alignItems={{ xs: "stretch", sm: "center" }}
                justifyContent="space-between"
                sx={{
                  gap: 1.5,
                  px: { xs: 2, sm: 2.5 },
                  py: 2,
                  borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                  bgcolor: alpha(theme.palette.primary.main, 0.06),
                }}
              >
                <Stack direction="row" alignItems="center" sx={{ gap: 1.25, flexWrap: "wrap" }}>
                  <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.14), color: "primary.main" }}>
                    <WarningAmber />
                  </Avatar>
                  <Box>
                    <Typography fontWeight={900} variant="h6" sx={{ fontSize: { xs: "1.05rem", sm: "1.2rem" } }}>
                      نواقص المخزون
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      أصناف تحت الحد الأدنى — مرتبة حسب الأقل كمية
                    </Typography>
                  </Box>
                  <Chip
                    label={lowStockCount === 0 ? "لا نواقص" : `${lowStockCount} صنف`}
                    color="primary"
                    variant={lowStockCount === 0 ? "filled" : "outlined"}
                    sx={{ fontWeight: 800 }}
                  />
                </Stack>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => navigate("/admin/inventory")}
                  sx={{ textTransform: "none", fontWeight: 800, alignSelf: { xs: "stretch", sm: "center" } }}
                >
                  فتح المخزون
                </Button>
              </Stack>

              {lowStockCount === 0 ? (
                <Box sx={{ py: 4, px: 2, textAlign: "center", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Typography color="primary" fontWeight={800}>
                    لا توجد نواقص — كل الأصناف النشطة فوق الحد الأدنى
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ p: { xs: 1.5, sm: 2 }, flex: 1 }}>
                  <Grid container spacing={1.5}>
                    {lowStockItems.map((p) => {
                      const q = Number(p.qty || 0);
                      const mn = Math.max(Number(p.min || 0), 0.001);
                      const urgency = Math.min(100, Math.round((q / mn) * 100));
                      return (
                        <Grid key={p.id} size={{ xs: 12 }}>
                          <Paper
                            elevation={0}
                            sx={{
                              p: 1.5,
                              height: "100%",
                              borderRadius: 2.5,
                              border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
                              bgcolor: alpha(theme.palette.background.paper, 0.9),
                              transition: "box-shadow .2s ease, border-color .2s ease",
                              "&:hover": {
                                borderColor: alpha(theme.palette.primary.main, 0.35),
                                boxShadow: `0 8px 22px ${alpha(theme.palette.primary.main, 0.12)}`,
                              },
                            }}
                          >
                            <Typography fontWeight={800} sx={{ lineHeight: 1.35 }}>
                              {productDisplayName(p)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.3 }}>
                              {p.category || "—"}
                            </Typography>
                            <Stack direction="row" sx={{ gap: 0.75, flexWrap: "wrap", mt: 1.25 }}>
                              <Chip
                                size="small"
                                label={`متاح ${q.toFixed(1)}`}
                                color="primary"
                                variant="outlined"
                                sx={{ fontWeight: 700 }}
                              />
                              <Chip
                                size="small"
                                label={`الحد ${Number(p.min || 0).toFixed(1)}`}
                                color="secondary"
                                variant="outlined"
                                sx={{ fontWeight: 700 }}
                              />
                            </Stack>
                            <Typography variant="caption" color="text.secondary" fontWeight={700} display="block" sx={{ mt: 1 }}>
                              نسبة التغطية {urgency}%
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={urgency}
                              color="primary"
                              sx={{ mt: 0.5, borderRadius: 99, height: 8 }}
                            />
                          </Paper>
                        </Grid>
                      );
                    })}
                  </Grid>
                </Box>
              )}
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Card
              sx={{
                height: "100%",
                borderRadius: 3,
                overflow: "hidden",
                position: "relative",
                border: `1px solid ${alpha(theme.palette.secondary.main, 0.22)}`,
                background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.12)} 0%, ${alpha(
                  theme.palette.primary.main,
                  0.06,
                )} 38%, ${alpha(theme.palette.background.paper, 0.97)} 72%, ${alpha(
                  theme.palette.secondary.main,
                  0.08,
                )} 100%)`,
                boxShadow: `0 16px 48px ${alpha(theme.palette.primary.main, 0.12)}, inset 0 1px 0 ${alpha(
                  theme.palette.common.white,
                  0.45,
                )}`,
                display: "flex",
                flexDirection: "column",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  top: -40,
                  left: -40,
                  width: 120,
                  height: 120,
                  borderRadius: "50%",
                  background: `radial-gradient(circle, ${alpha(theme.palette.secondary.main, 0.25)} 0%, transparent 70%)`,
                  pointerEvents: "none",
                },
                "&::after": {
                  content: '""',
                  position: "absolute",
                  bottom: -24,
                  right: -24,
                  width: 100,
                  height: 100,
                  borderRadius: "50%",
                  background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.2)} 0%, transparent 70%)`,
                  pointerEvents: "none",
                },
              }}
            >
              <Box
                sx={{
                  position: "absolute",
                  top: 12,
                  left: 16,
                  opacity: 0.12,
                  pointerEvents: "none",
                  animation: `${float} 5s ease-in-out infinite`,
                }}
              >
                <FormatQuote sx={{ fontSize: 120, color: "secondary.main" }} />
              </Box>
              <Stack
                direction="row"
                alignItems="center"
                sx={{
                  gap: 1.5,
                  px: { xs: 2, sm: 2.5 },
                  py: 2,
                  position: "relative",
                  zIndex: 1,
                  borderBottom: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                  background: `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.08)} 0%, transparent 100%)`,
                }}
              >
                <Avatar
                  sx={{
                    bgcolor: alpha(theme.palette.secondary.main, 0.25),
                    color: "secondary.dark",
                    width: 52,
                    height: 52,
                    boxShadow: `0 8px 20px ${alpha(theme.palette.secondary.main, 0.35)}`,
                    animation: `${float} 4s ease-in-out infinite`,
                  }}
                >
                  <Lightbulb />
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Stack direction="row" alignItems="center" gap={0.75} flexWrap="wrap">
                    <Typography fontWeight={900} variant="h6" sx={{ fontSize: { xs: "1.05rem", sm: "1.25rem" } }}>
                      نصيحة اليوم
                    </Typography>
                    <Chip
                      icon={<AutoAwesome sx={{ "&&": { fontSize: 16 } }} />}
                      label="مختارة لك"
                      size="small"
                      color="secondary"
                      variant="filled"
                      sx={{ fontWeight: 800, height: 26 }}
                    />
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.35 }}>
                    {dailyTipDateLabel} — تتجدد تلقائياً مع كل يوم جديد
                  </Typography>
                </Box>
              </Stack>
              <Box
                sx={{
                  p: { xs: 2, sm: 2.75 },
                  flex: 1,
                  display: "flex",
                  alignItems: "center",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <Paper
                  elevation={0}
                  sx={{
                    width: "100%",
                    p: { xs: 2, sm: 2.25 },
                    borderRadius: 2.5,
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                    borderRight: `4px solid ${theme.palette.secondary.main}`,
                    background: alpha(theme.palette.background.paper, 0.85),
                    backdropFilter: "blur(8px)",
                    boxShadow: `inset 0 0 0 1px ${alpha(theme.palette.common.white, 0.06)}`,
                  }}
                >
                  <Typography
                    variant="body1"
                    sx={{
                      lineHeight: 1.95,
                      fontWeight: 600,
                      color: "text.primary",
                      fontSize: { xs: "1rem", sm: "1.08rem" },
                      letterSpacing: 0.2,
                    }}
                  >
                    {dailyTipText}
                  </Typography>
                </Paper>
              </Box>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </AdminLayout>
  );
}
