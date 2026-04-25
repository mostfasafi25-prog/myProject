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
  ShowChart,
  AttachMoney,
  ShoppingCart,
  Inventory,
} from "@mui/icons-material";
import {
  alpha,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
  Fade,
  Zoom,
  Slide,
  TextField,
  IconButton,
  Menu,
  MenuItem,
  InputAdornment,
  Tabs,
  Tab,
} from "@mui/material";
import { CalendarToday, Clear, FilterList, DateRange } from "@mui/icons-material";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.min.css";
import { keyframes } from "@mui/system";
import { useEffect, useMemo, useState, useRef } from "react";
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
  Line,
  LineChart,
  Area,
  AreaChart,
  PieChart,
  Pie,
  Cell as PieCell,
} from "recharts";
import { Axios } from "../../Api/Axios";
import { productDisplayName } from "../../utils/productDisplayName";
import { showAppToast } from "../../utils/appToast";
import { daysUntilExpiry } from "../../utils/productExpiry";
import { adminPageContainerSx } from "../../utils/adminPageLayout";
import { chipColorForBalance, negativeAmountTextSx } from "../../utils/negativeAmountStyle";
import AdminLayout from "./AdminLayout";
const LOW_STOCK_CARD_LIMIT = 3;

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
// أضف هذا useEffect للتجريب مؤقتاً

const float = keyframes`
  0%,100% { transform: translateY(0px); }
  50% { transform: translateY(-10px); }
`;

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.85; transform: scale(1.02); }
`;

const slideIn = keyframes`
  0% { opacity: 0; transform: translateX(-20px); }
  100% { opacity: 1; transform: translateX(0); }
`;

const glow = keyframes`
  0%, 100% { box-shadow: 0 0 20px ${alpha('#1976d2', 0.3)}; }
  50% { box-shadow: 0 0 40px ${alpha('#1976d2', 0.6)}; }
`;

const rotate = keyframes`
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
`;

// مكون Counter Animation للأرقام
const CounterAnimation = ({ value, duration = 2000, suffix = "" }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (!hasAnimated && value !== 0) {
      setHasAnimated(true);
      const startTime = performance.now();
      const targetValue = Number(value);
      
      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth animation
        const easeOutQuart = 1 - Math.pow(1 - progress, 4);
        const currentValue = targetValue * easeOutQuart;
        
        setDisplayValue(currentValue);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setDisplayValue(targetValue);
        }
      };
      
      requestAnimationFrame(animate);
    } else if (value === 0) {
      setDisplayValue(0);
    }
  }, [value, duration, hasAnimated]);

  return (
    <span>
      {displayValue.toLocaleString('ar-EG', { maximumFractionDigits: 1 })}{suffix}
    </span>
  );
};

// مكون Flatpickr مخصص مع أسماء الأشهر العربية
const DateRangePicker = ({ startDate, endDate, onChange, onClear }) => {
  const startRef = useRef(null);
  const endRef = useRef(null);
  const theme = useTheme();

  useEffect(() => {
    const arabicMonths = [
      "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
      "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
    ];
    const arabicDays = ["أحد", "اثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"];

    if (startRef.current) {
      const startPicker = flatpickr(startRef.current, {
        locale: {
          months: arabicMonths,
          weekdays: arabicDays,
          firstDayOfWeek: 0,
        },
        dateFormat: "Y-m-d",
        onChange: (selectedDates) => {
          if (selectedDates[0]) {
            onChange({ start: selectedDates[0], end: endDate });
          }
        },
      });
      if (startDate) {
        startPicker.setDate(startDate);
      }
    }

    if (endRef.current) {
      const endPicker = flatpickr(endRef.current, {
        locale: {
          months: arabicMonths,
          weekdays: arabicDays,
          firstDayOfWeek: 0,
        },
        dateFormat: "Y-m-d",
        minDate: startDate,
        onChange: (selectedDates) => {
          if (selectedDates[0]) {
            onChange({ start: startDate, end: selectedDates[0] });
          }
        },
      });
      if (endDate) {
        endPicker.setDate(endDate);
      }
    }

    return () => {
      if (startRef.current && startRef.current._flatpickr) {
        startRef.current._flatpickr.destroy();
      }
      if (endRef.current && endRef.current._flatpickr) {
        endRef.current._flatpickr.destroy();
      }
    };
  }, [startDate, endDate, onChange]);

  return (
    <Stack direction="row" alignItems="center" sx={{ gap: 1 }}>
      <TextField
        inputRef={startRef}
        size="small"
        placeholder="من"
        sx={{ width: 140 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <CalendarToday sx={{ fontSize: 18, color: "text.secondary" }} />
            </InputAdornment>
          ),
        }}
      />
      <TextField
        inputRef={endRef}
        size="small"
        placeholder="إلى"
        sx={{ width: 140 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <CalendarToday sx={{ fontSize: 18, color: "text.secondary" }} />
            </InputAdornment>
          ),
        }}
      />
      <IconButton
        onClick={onClear}
        size="small"
        sx={{ color: "text.secondary" }}
      >
        <Clear />
      </IconButton>
    </Stack>
  );
};

export default function HomeDashboard({ mode = "light", onToggleMode }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const [periodView, setPeriodView] = useState("day");
  const [filterType, setFilterType] = useState("preset"); // preset | custom
  const [customStartDate, setCustomStartDate] = useState(null);
  const [customEndDate, setCustomEndDate] = useState(null);
  const [filterMenuAnchor, setFilterMenuAnchor] = useState(null);
  const [chartTab, setChartTab] = useState("sales"); // sales | purchases
  const [summary, setSummary] = useState(null);
  const [apiProducts, setApiProducts] = useState([]);
  const [apiOrders, setApiOrders] = useState([]);
  const [apiPurchases, setApiPurchases] = useState([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryErr, setSummaryErr] = useState("");
  const [localTick, setLocalTick] = useState(0);
  const isDark = theme.palette.mode === "dark";
  const [lowStockDialogOpen, setLowStockDialogOpen] = useState(false);
  const [storeBalance, setStoreBalance] = useState({ total: 0, cash: 0, app: 0 });
  const refreshBalance = async () => {
    try {
      const { data } = await Axios.get("treasury-balance");
      if (data?.success) {
        setStoreBalance({
          total: Number(data?.data?.balance || 0),
          cash: Number(data?.data?.balance_cash || 0),   // ✅ التصحيح
          app: Number(data?.data?.balance_app || 0),     // ✅ التصحيح
        });
        return;
      }
    } catch {
      // ignore and keep previous balance
    }
    setStoreBalance((prev) => ({ ...prev, total: Number(prev.total || 0) }));
  };
  useEffect(() => {
    const onFocus = async () => {
      await refreshBalance();
      setLocalTick((t) => t + 1);
    };
    window.addEventListener("focus", onFocus);
    onFocus();
    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSummaryLoading(true);
      setSummaryErr("");
      try {
        const [{ data }, productsRes, ordersRes, purchasesRes] = await Promise.all([
          Axios.get("dashboard/summary"),
          Axios.get("products", { params: { per_page: 100, include_inactive: 1, scope: "all" } }),
          Axios.get("orders", { params: { per_page: 200 } }),
          Axios.get("purchases", { params: { per_page: 200 } }),
        ]);
        if (!cancelled && data?.success && data?.data) setSummary(data.data);
        if (!cancelled && productsRes?.data?.success) {
          setApiProducts(Array.isArray(productsRes.data.data) ? productsRes.data.data : []);
        }
        if (!cancelled && ordersRes?.data?.success) {
          // البيانات قد تكون في data.data أو data.data.orders
          const ordersData = ordersRes.data.data;
          const ordersArray = Array.isArray(ordersData) 
            ? ordersData 
            : (ordersData?.orders ? ordersData.orders : []);
          setApiOrders(ordersArray);
        }
        if (!cancelled && purchasesRes?.data?.success) {
          const purchasesData = purchasesRes.data.data;
          const purchasesArray = Array.isArray(purchasesData) 
            ? purchasesData 
            : (purchasesData?.purchases ? purchasesData.purchases : []);
          setApiPurchases(purchasesArray);
        }
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
  useEffect(() => {
    const testAPIs = async () => {
      console.log("========== اختبار APIs ==========");
      
      // 1. اختبار dashboard/summary
      try {
        const summaryRes = await Axios.get("dashboard/summary");
        console.log("📊 Dashboard Summary:", summaryRes.data);
      } catch(e) {
        console.error("❌ Dashboard Summary Error:", e);
      }
      
      // 2. اختبار products
      try {
        const productsRes = await Axios.get("products", { params: { per_page: 100, include_inactive: 1, scope: "all" } });
        console.log("📦 Products:", productsRes.data);
        console.log("📦 Products Count:", productsRes.data?.data?.length);
        if (productsRes.data?.data?.length > 0) {
          console.log("📦 First Product Sample:", productsRes.data.data[0]);
        }
      } catch(e) {
        console.error("❌ Products Error:", e);
      }
      
      // 3. اختبار orders (الأهم للمبيعات)
      try {
        const ordersRes = await Axios.get("orders", { params: { per_page: 200 } });
        console.log("🧾 Orders:", ordersRes.data);
        console.log("🧾 Orders Count:", ordersRes.data?.data?.length);
        if (ordersRes.data?.data?.length > 0) {
          console.log("🧾 First Order Sample:", ordersRes.data.data[0]);
          console.log("🧾 Order items:", ordersRes.data.data[0]?.items);
        } else {
          console.warn("⚠️ لا توجد طلبات/مبيعات في النظام!");
        }
      } catch(e) {
        console.error("❌ Orders Error:", e);
      }
      
      // 4. اختبار purchases
      try {
        const purchasesRes = await Axios.get("purchases", { params: { per_page: 200 } });
        console.log("📥 Purchases:", purchasesRes.data);
        console.log("📥 Purchases Count:", purchasesRes.data?.data?.length);
      } catch(e) {
        console.error("❌ Purchases Error:", e);
      }
      
      // 5. اختبار treasury-balance
      try {
        const treasuryRes = await Axios.get("treasury-balance");
        console.log("💰 Treasury Balance:", treasuryRes.data);
      } catch(e) {
        console.error("❌ Treasury Error:", e);
      }
    };
    
    testAPIs();
  }, []);
  const salesInvoicesLocal = useMemo(
    () =>
      apiOrders.map((o) => ({
        id: o.id,
        soldAt: o.created_at,
        total: Number(o.total || 0),
        paymentMethod: o.payment_method || "cash",
        items: Array.isArray(o.items) ? o.items : [],
      })),
    [apiOrders],
  );

  const adminProducts = useMemo(
    () =>
      apiProducts.map((p) => ({
        id: p.id,
        name: p.name,
        qty: Number(p.stock || 0),
        min: Number(p.reorder_point || p.min_stock || 0),
        active: p.is_active !== false,
      })),
    [apiProducts],
  );

  const purchaseInvoicesLocal = useMemo(
    () =>
      apiPurchases.map((p) => ({
        id: p.id,
        purchasedAt: p.purchase_date || p.created_at,
        total: Number(p.total_amount || p.total || 0),
        status: p.status || "مكتمل",
      })),
    [apiPurchases],
  );

  const lowStockCount = useMemo(
    () =>
      adminProducts.filter(
        (p) =>
          p.active !== false &&
          p.excludeFromLowStock !== true &&
          Number(p.qty || 0) < Number(p.min || 0),
      ).length,
    [adminProducts],
  );

  const lowStockItems = useMemo(
    () =>
      adminProducts
        .filter(
          (p) =>
            p.active !== false &&
            p.excludeFromLowStock !== true &&
            Number(p.qty || 0) < Number(p.min || 0),
        )
        .sort((a, b) => Number(a.qty || 0) - Number(b.qty || 0)),
    [adminProducts],
  );
  const lowStockPreviewItems = useMemo(
    () => lowStockItems.slice(0, LOW_STOCK_CARD_LIMIT),
    [lowStockItems],
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
      let profit = 0;
      for (const inv of salesInvoicesLocal) {
        const d = new Date(inv.soldAt || 0);
        if (Number.isNaN(d.getTime()) || d < from || d > to) continue;
        sales += Number(inv.total || 0);
        count += 1;
        const invoiceProfit = Number(inv.totalProfit);
        if (Number.isFinite(invoiceProfit)) {
          profit += invoiceProfit;
        } else if (Array.isArray(inv.items)) {
          const itemsProfit = inv.items.reduce((s, it) => {
            const p = Number(it?.lineProfit);
            if (Number.isFinite(p)) return s + p;
            const q = Number(it?.qty ?? 0);
            const unitSell = Number(it?.price ?? it?.unitPrice ?? 0);
            const gross = Number(it?.total ?? q * unitSell);
            const unitCost = Number(it?.unit_cost ?? it?.unitCost ?? 0);
            const lineCost = Number.isFinite(Number(it?.lineCost)) ? Number(it.lineCost) : q * unitCost;
            return s + (gross - lineCost);
          }, 0);
          profit += Number(itemsProfit || 0);
        }
      }
      return { sales, count, profit: Number(profit.toFixed(2)) };
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
      return { sales: local.sales, orders: local.count, profit: local.profit, label: "اليوم" };
    }
    if (periodView === "week") {
      const w = sumRange(weekStart, dayEnd);
      return { sales: w.sales, orders: w.count, profit: w.profit, label: "آخر 7 أيام" };
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
      profit: localM.profit,
      label: "الشهر الحالي",
    };
  }, [periodView, summary, summaryErr, salesInvoicesLocal]);

  const kpis = useMemo(
    () => [
      {
        title: "السيولة (الصندوق المحلي)",
        value: `${storeBalance.total.toFixed(1)} شيكل`,
        amountForColor: storeBalance.total,
        icon: <AccountBalanceWallet />,
        liquiditySplit: true,
        progress: Math.min(100, 30 + (Math.abs(storeBalance.total) % 50)),
        navigateTo: "/admin/settings/money",
      },
      {
        title: "صافي الربح (تقريبي)",
        value: kpiValues.profit != null ? `${kpiValues.profit.toFixed(1)} شيكل` : "—",
        amountForColor: kpiValues.profit != null ? kpiValues.profit : null,
        icon: <TrendingUp />,
        delta: summary && !summaryErr ? "من الخادم" : "محسوب محلياً",
        progress: kpiValues.profit != null ? Math.min(100, 25 + (Number(kpiValues.profit) % 60)) : 12,
        navigateTo: "/admin/reports",
      },
      {
        title: `مشتريات (${purchasePeriodStats.label})`,
        value: `${purchasePeriodStats.total.toFixed(1)} شيكل`,
        amountForColor: purchasePeriodStats.total,
        icon: <LocalShipping />,
        delta: `${purchasePeriodStats.count} عملية شراء`,
        progress: Math.min(100, purchasePeriodStats.total > 0 ? 18 + (purchasePeriodStats.count % 45) : 10),
        navigateTo: "/admin/purchases",
      },
      {
        title: `مبيعات (${kpiValues.label})`,
        value: `${kpiValues.sales.toFixed(1)} شيكل`,
        amountForColor: kpiValues.sales,
        icon: <PointOfSale />,
        delta: `${kpiValues.orders} طلب`,
        progress: Math.min(100, kpiValues.sales > 0 ? Math.min(100, 12 + (kpiValues.orders % 40)) : 8),
        navigateTo: "/admin/reports/sales",
      },
    ],
    [kpiValues, purchasePeriodStats, storeBalance],
  );

  const chartDays = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    
    // Custom date range filter
    if (filterType === "custom" && customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999);
      
      const days = [];
      const currentDate = new Date(start);
      const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
      
      while (currentDate <= end) {
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;
        days.push({
          date: dateStr,
          label: `${String(currentDate.getDate()).padStart(2, "0")}/${String(currentDate.getMonth() + 1).padStart(2, "0")}`,
          dayName: dayNames[currentDate.getDay()],
          sales: 0,
          count: 0,
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      for (const inv of salesInvoicesLocal) {
        const sold = inv.soldAt ? new Date(inv.soldAt) : null;
        if (!sold || Number.isNaN(sold.getTime())) continue;
        const soldDate = new Date(sold);
        if (soldDate >= start && soldDate <= end) {
          const dateStr = `${soldDate.getFullYear()}-${String(soldDate.getMonth() + 1).padStart(2, "0")}-${String(soldDate.getDate()).padStart(2, "0")}`;
          const idx = days.findIndex(d => d.date === dateStr);
          if (idx !== -1) {
            days[idx].sales += Number(inv.total || 0);
            days[idx].count += 1;
          }
        }
      }
      return days;
    }
    
    if (periodView === "day") {
      // عرض ساعات اليوم
      const hours = Array.from({ length: 24 }, (_, h) => ({
        date: `${y}-${String(m + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
        label: `${String(h).padStart(2, "0")}:00`,
        sales: 0,
        count: 0,
      }));
      
      for (const inv of salesInvoicesLocal) {
        const sold = inv.soldAt ? new Date(inv.soldAt) : null;
        if (!sold || Number.isNaN(sold.getTime())) continue;
        const soldDate = new Date(sold);
        if (soldDate.getDate() !== now.getDate() || soldDate.getMonth() !== m || soldDate.getFullYear() !== y) continue;
        const hour = soldDate.getHours();
        if (hours[hour]) {
          hours[hour].sales += Number(inv.total || 0);
          hours[hour].count += 1;
        }
      }
      return hours;
    }
    
    if (periodView === "week") {
      // عرض آخر 7 أيام
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
        days.push({
          date: dateStr,
          label: dayNames[d.getDay()],
          sales: 0,
          count: 0,
        });
      }
      
      for (const inv of salesInvoicesLocal) {
        const sold = inv.soldAt ? new Date(inv.soldAt) : null;
        if (!sold || Number.isNaN(sold.getTime())) continue;
        const soldDate = new Date(sold);
        const diffTime = now - soldDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays < 7) {
          const idx = 6 - diffDays;
          if (days[idx]) {
            days[idx].sales += Number(inv.total || 0);
            days[idx].count += 1;
          }
        }
      }
      return days;
    }
    
    // month view - عرض أيام الشهر
    if (summary?.monthly_days?.length) return summary.monthly_days;
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
  }, [summary, salesInvoicesLocal, periodView, filterType, customStartDate, customEndDate]);

  // بيانات المشتريات للشارت
  const purchaseChartDays = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    
    if (filterType === "custom" && customStartDate && customEndDate) {
      const start = new Date(customStartDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(customEndDate);
      end.setHours(23, 59, 59, 999);
      
      const days = [];
      const currentDate = new Date(start);
      const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
      
      while (currentDate <= end) {
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`;
        days.push({
          date: dateStr,
          label: `${String(currentDate.getDate()).padStart(2, "0")}/${String(currentDate.getMonth() + 1).padStart(2, "0")}`,
          dayName: dayNames[currentDate.getDay()],
          purchases: 0,
          count: 0,
        });
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      for (const inv of purchaseInvoicesLocal) {
        const purchased = inv.purchasedAt ? new Date(inv.purchasedAt) : null;
        if (!purchased || Number.isNaN(purchased.getTime())) continue;
        if (purchased >= start && purchased <= end) {
          const dateStr = `${purchased.getFullYear()}-${String(purchased.getMonth() + 1).padStart(2, "0")}-${String(purchased.getDate()).padStart(2, "0")}`;
          const idx = days.findIndex(d => d.date === dateStr);
          if (idx !== -1) {
            days[idx].purchases += Number(inv.total || 0);
            days[idx].count += 1;
          }
        }
      }
      return days;
    }
    
    if (periodView === "day") {
      const hours = Array.from({ length: 24 }, (_, h) => ({
        date: `${y}-${String(m + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
        label: `${String(h).padStart(2, "0")}:00`,
        purchases: 0,
        count: 0,
      }));
      
      for (const inv of purchaseInvoicesLocal) {
        const purchased = inv.purchasedAt ? new Date(inv.purchasedAt) : null;
        if (!purchased || Number.isNaN(purchased.getTime())) continue;
        const purchasedDate = new Date(purchased);
        if (purchasedDate.getDate() !== now.getDate() || purchasedDate.getMonth() !== m || purchasedDate.getFullYear() !== y) continue;
        const hour = purchasedDate.getHours();
        if (hours[hour]) {
          hours[hour].purchases += Number(inv.total || 0);
          hours[hour].count += 1;
        }
      }
      return hours;
    }
    
    if (periodView === "week") {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
        days.push({
          date: dateStr,
          label: dayNames[d.getDay()],
          purchases: 0,
          count: 0,
        });
      }
      
      for (const inv of purchaseInvoicesLocal) {
        const purchased = inv.purchasedAt ? new Date(inv.purchasedAt) : null;
        if (!purchased || Number.isNaN(purchased.getTime())) continue;
        const purchasedDate = new Date(purchased);
        const diffTime = now - purchasedDate;
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays >= 0 && diffDays < 7) {
          const idx = 6 - diffDays;
          if (days[idx]) {
            days[idx].purchases += Number(inv.total || 0);
            days[idx].count += 1;
          }
        }
      }
      return days;
    }
    
    // month view
    const dim = new Date(y, m + 1, 0).getDate();
    const days = [];
    for (let d = 1; d <= dim; d++) {
      const ds = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({ date: ds, label: String(d), purchases: 0, count: 0 });
    }
    for (const inv of purchaseInvoicesLocal) {
      const purchased = inv.purchasedAt ? new Date(inv.purchasedAt) : null;
      if (!purchased || Number.isNaN(purchased.getTime()) || purchased.getMonth() !== m || purchased.getFullYear() !== y) continue;
      const idx = purchased.getDate() - 1;
      if (days[idx]) {
        days[idx].purchases += Number(inv.total || 0);
        days[idx].count += 1;
      }
    }
    return days;
  }, [purchaseInvoicesLocal, periodView, filterType, customStartDate, customEndDate]);

  const maxChartSales = Math.max(1, ...chartDays.map((d) => Number(d.sales || 0)));
  const maxChartPurchases = Math.max(1, ...purchaseChartDays.map((d) => Number(d.purchases || 0)));

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
      console.log("Processing invoice:", inv.id, "items:", inv.items);
      
      for (const it of inv.items || []) {
        // 🔥 جرب كل الاحتمالات الممكنة لاسم المنتج
        const productName = it.product_name 
          || it.name 
          || it.product?.name 
          || it.productName 
          || `منتج #${it.product_id || it.id}`;
        
        // 🔥 جرب كل الاحتمالات الممكنة للكمية
        const quantity = Number(it.quantity || it.qty || 0);
        
        if (quantity > 0 && productName !== "غير معروف") {
          const currentQty = qtyByName.get(productName) || 0;
          qtyByName.set(productName, currentQty + quantity);
          console.log(`Added: ${productName} +${quantity} = ${currentQty + quantity}`);
        }
      }
    }
    
    const sorted = [...qtyByName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    console.log("🏆 Top sellers result:", sorted);
    return sorted;
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

  const openRestockFromDashboard = (p) => {
    if (!p?.id) return;
    setLowStockDialogOpen(false);
    navigate(`/admin/inventory?restock=${encodeURIComponent(String(p.id))}`);
  };
  const dismissLowStockItem = (p) => {
    if (!p?.id) return;
    showAppToast("إخفاء عناصر النواقص محلياً تم تعطيله. الإدارة من الباك اند فقط.", "info");
  };

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
        {/* شريط التصفية في أعلى الصفحة */}
        <Paper
          elevation={0}
          sx={{
            mb: 2,
            p: 1.5,
            borderRadius: 2.5,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.04)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 1.5,
          }}
        >
          <Stack direction="row" alignItems="center" sx={{ gap: 1.5, flexWrap: "wrap" }}>
            <Stack direction="row" alignItems="center" sx={{ gap: 0.75 }}>
              <FilterList sx={{ color: "primary.main", fontSize: 20 }} />
              <Typography variant="subtitle2" fontWeight={700} color="text.primary">
                تصفية
              </Typography>
            </Stack>
            <ToggleButtonGroup
              value={filterType === "custom" ? "custom" : periodView}
              exclusive
              size="small"
              onChange={(e, newView) => {
                if (newView === "custom") {
                  setFilterType("custom");
                } else if (newView) {
                  setFilterType("preset");
                  setPeriodView(newView);
                }
              }}
              sx={{
                bgcolor: alpha(theme.palette.primary.main, 0.06),
                borderRadius: 2,
                p: 0.25,
                "& .MuiToggleButton-root": {
                  border: "none",
                  borderRadius: 1.5,
                  px: 1.25,
                  py: 0.5,
                  fontWeight: 700,
                  fontSize: "0.8rem",
                  textTransform: "none",
                  color: "text.secondary",
                  transition: "all 0.2s ease",
                  "&.Mui-selected": {
                    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
                    color: "#fff",
                    boxShadow: `0 2px 8px ${alpha(theme.palette.primary.main, 0.25)}`,
                  },
                },
              }}
            >
              <ToggleButton value="day">اليوم</ToggleButton>
              <ToggleButton value="week">7 أيام</ToggleButton>
              <ToggleButton value="month">الشهر</ToggleButton>
              <ToggleButton value="custom">مخصص</ToggleButton>
            </ToggleButtonGroup>
            {filterType === "custom" && (
              <DateRangePicker
                startDate={customStartDate}
                endDate={customEndDate}
                onChange={({ start, end }) => {
                  setCustomStartDate(start);
                  setCustomEndDate(end);
                }}
                onClear={() => {
                  setFilterType("preset");
                  setCustomStartDate(null);
                  setCustomEndDate(null);
                }}
              />
            )}
          </Stack>
          {summaryLoading && <CircularProgress size={20} />}
        </Paper>

        {summaryErr ? (
          <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
            {summaryErr}
          </Typography>
        ) : null}
        <Grid container spacing={{ xs: 2, md: 3 }} mt={{ xs: 1, md: 1.5 }} alignItems="stretch">
          {kpis.map((item, idx) => {
            const kpiClickable = Boolean(item.navigateTo);
            const cardGradient = idx === 0 
              ? `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.15)} 0%, ${alpha(theme.palette.background.paper, 0.95)} 100%)`
              : idx === 1
              ? `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.12)} 0%, ${alpha(theme.palette.background.paper, 0.95)} 100%)`
              : idx === 2
              ? `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.1)} 0%, ${alpha(theme.palette.background.paper, 0.95)} 100%)`
              : `linear-gradient(135deg, ${alpha(theme.palette.info.main, 0.1)} 0%, ${alpha(theme.palette.background.paper, 0.95)} 100%)`;
            return (
            <Grid key={item.title} size={{ xs: 12, sm: 6, lg: 3 }}>
              <Fade in={true} timeout={600 + idx * 100}>
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
                    borderRadius: 3.5,
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
                    background: cardGradient,
                    transition: "transform .3s cubic-bezier(0.4, 0, 0.2, 1), box-shadow .3s cubic-bezier(0.4, 0, 0.2, 1), border-color .3s ease",
                    animation: `${float} ${3 + idx * 0.5}s ease-in-out infinite`,
                    position: "relative",
                    overflow: "hidden",
                    "&::before": {
                      content: '""',
                      position: "absolute",
                      top: -50,
                      right: -50,
                      width: 100,
                      height: 100,
                      borderRadius: "50%",
                      background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.15)} 0%, transparent 70%)`,
                      pointerEvents: "none",
                    },
                    ...(kpiClickable
                      ? { cursor: "pointer", "&:focus-visible": { outline: `2px solid ${theme.palette.primary.main}`, outlineOffset: 2 } }
                      : {}),
                    "&:hover": {
                      transform: { xs: "none", sm: "translateY(-6px) scale(1.02)" },
                      boxShadow: { xs: "none", sm: `0 20px 40px ${alpha(theme.palette.primary.main, 0.25)}` },
                      borderColor: alpha(theme.palette.primary.main, 0.35),
                    },
                  }}
                >
                  <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5} sx={{ gap: 1, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
                    <Avatar 
                      sx={{ 
                        bgcolor: alpha(theme.palette.primary.main, 0.18), 
                        color: "primary.main",
                        width: 56,
                        height: 56,
                        boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.25)}`,
                        transition: "transform 0.3s ease, box-shadow 0.3s ease",
                        "&:hover": {
                          transform: "scale(1.1) rotate(5deg)",
                          boxShadow: `0 12px 32px ${alpha(theme.palette.primary.main, 0.35)}`,
                        },
                      }}
                    >
                      {item.icon}
                    </Avatar>
                    {item.liquiditySplit ? (
                      <Stack direction="row" alignItems="center" sx={{ gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <Chip
                          size="small"
                          label={`كاش ${storeBalance.cash.toFixed(0)}`}
                          color={chipColorForBalance(storeBalance.cash, "success")}
                          variant="filled"
                          sx={{ fontWeight: 800 }}
                        />
                        <Chip
                          size="small"
                          label={`تطبيق ${storeBalance.app.toFixed(0)}`}
                          color={chipColorForBalance(storeBalance.app, "info")}
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
                  <Typography variant="body2" color="text.secondary" sx={{ position: "relative", zIndex: 1, fontWeight: 600 }}>
                    {item.title}
                  </Typography>
                  <Typography
                    variant="h5"
                    fontWeight={900}
                    mb={1}
                    sx={{
                      position: "relative",
                      zIndex: 1,
                      ...item.amountForColor != null ? negativeAmountTextSx(item.amountForColor) : undefined,
                      background: "linear-gradient(135deg, currentColor 0%, currentColor 100%)",
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                      backgroundClip: "text",
                    }}
                  >
                    <CounterAnimation 
                      value={parseFloat(item.value.replace(/[^\d.-]/g, '')) || 0} 
                      duration={2000}
                      suffix={item.value.includes("شيكل") ? " شيكل" : item.value.includes("طلب") ? " طلب" : ""}
                    />
                  </Typography>
                  <Box sx={{ position: "relative", zIndex: 1 }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={item.progress} 
                      sx={{ 
                        borderRadius: 99, 
                        height: 8,
                        background: alpha(theme.palette.primary.main, 0.1),
                        "& .MuiLinearProgress-bar": {
                          background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
                          borderRadius: 99,
                          transition: "width 1s ease-in-out",
                        },
                      }} 
                    />
                  </Box>
                </Card>
              </Fade>
            </Grid>
            );
          })}
        </Grid>

        <Grid container spacing={{ xs: 2, md: 3 }} mt={{ xs: 1, md: 1.5 }} alignItems="stretch">
          <Grid size={{ xs: 12, lg: 8 }}>
            <Zoom in={true} timeout={800} style={{ transitionDelay: '200ms' }}>
              <Card
                sx={{
                  p: { xs: 2, sm: 2.5 },
                  height: "100%",
                  borderRadius: 3.5,
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
                  background: `linear-gradient(165deg, ${alpha(theme.palette.primary.main, 0.06)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
                  boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.12)}`,
                  transition: "transform 0.3s ease, box-shadow 0.3s ease",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: `0 16px 48px ${alpha(theme.palette.primary.main, 0.2)}`,
                  },
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
                    <Typography fontWeight={900} variant="h6" sx={{ fontSize: { xs: "1.1rem", sm: "1.25rem" } }}>
                      تحليل {chartTab === "sales" ? "المبيعات" : "المشتريات"}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      {filterType === "custom" && customStartDate && customEndDate
                        ? `من ${customStartDate.toLocaleDateString("ar-EG")} إلى ${customEndDate.toLocaleDateString("ar-EG")}`
                        : periodView === "day"
                        ? "ساعات اليوم الحالي"
                        : periodView === "week"
                        ? "آخر 7 أيام"
                        : "أيام الشهر الحالي"} — مرّر المؤشر لعرض المبلغ وعدد {chartTab === "sales" ? "الفواتير" : "عمليات الشراء"}
                      {summary?.monthly_days?.length && periodView === "month" && filterType !== "custom" && chartTab === "sales" ? " (من الخادم)" : " (محلي)"}
                    </Typography>
                  </Box>
                  <Tabs
                    value={chartTab}
                    onChange={(e, newValue) => setChartTab(newValue)}
                    sx={{
                      minHeight: 40,
                      "& .MuiTab-root": {
                        minHeight: 40,
                        px: 2,
                        fontWeight: 700,
                        fontSize: "0.9rem",
                        textTransform: "none",
                        color: "text.secondary",
                        transition: "all 0.3s ease",
                      },
                      "& .MuiTab-root.Mui-selected": {
                        color: "primary.main",
                      },
                      "& .MuiTabs-indicator": {
                        height: 3,
                        borderRadius: "3px 3px 0 0",
                      },
                    }}
                  >
                    <Tab value="sales" label="المبيعات" />
                    <Tab value="purchases" label="المشتريات" />
                  </Tabs>
               
                </Stack>

                <Box sx={{ width: "100%", height: { xs: 280, sm: 320, md: 360 } }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartTab === "sales" ? chartDays : purchaseChartDays} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                      <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={chartTab === "sales" ? theme.palette.primary.main : theme.palette.secondary.main} stopOpacity={0.9} />
                          <stop offset="50%" stopColor={chartTab === "sales" ? theme.palette.primary.main : theme.palette.secondary.main} stopOpacity={0.6} />
                          <stop offset="100%" stopColor={chartTab === "sales" ? theme.palette.primary.main : theme.palette.secondary.main} stopOpacity={0.3} />
                        </linearGradient>
                        <filter id="glow">
                          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                          <feMerge>
                            <feMergeNode in="coloredBlur"/>
                            <feMergeNode in="SourceGraphic"/>
                          </feMerge>
                        </filter>
                      </defs>
                      <CartesianGrid 
                        strokeDasharray="3 3" 
                        vertical={false}
                        stroke={alpha(theme.palette.divider, isDark ? 0.4 : 0.8)}
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: theme.palette.text.secondary, fontSize: 11, fontWeight: 600 }}
                        tickLine={false}
                        axisLine={{ stroke: alpha(theme.palette.divider, 0.6) }}
                        interval={Math.ceil((chartTab === "sales" ? chartDays : purchaseChartDays).length / 15)}
                      />
                      <YAxis
                        tick={{ fill: theme.palette.text.secondary, fontSize: 11, fontWeight: 600 }}
                        tickLine={false}
                        axisLine={false}
                        width={45}
                        tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
                      />
                      <RechartsTooltip
                        cursor={{ fill: alpha(chartTab === "sales" ? theme.palette.primary.main : theme.palette.secondary.main, 0.08) }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const data = payload[0].payload;
                          return (
                            <Box
                              sx={{
                                bgcolor: "background.paper",
                                border: `1px solid ${alpha(chartTab === "sales" ? theme.palette.primary.main : theme.palette.secondary.main, 0.2)}`,
                                borderRadius: 2.5,
                                px: 1.5,
                                py: 1.25,
                                boxShadow: `0 8px 24px ${alpha(chartTab === "sales" ? theme.palette.primary.main : theme.palette.secondary.main, 0.2)}`,
                                backdropFilter: "blur(8px)",
                              }}
                            >
                              <Typography variant="subtitle2" fontWeight={900} sx={{ mb: 0.5 }}>
                                {data.label}
                              </Typography>
                              <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 0.5 }}>
                                {data.date}
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {chartTab === "sales" ? "المبيعات" : "المشتريات"}: <b style={{ color: chartTab === "sales" ? theme.palette.primary.main : theme.palette.secondary.main }}>{Number(chartTab === "sales" ? data.sales : data.purchases).toFixed(1)}</b> شيكل
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {chartTab === "sales" ? "فواتير" : "عمليات"}: {data.count}
                              </Typography>
                            </Box>
                          );
                        }}
                      />
                      <Bar 
                        dataKey={chartTab === "sales" ? "sales" : "purchases"} 
                        radius={[6, 6, 0, 0]} 
                        maxBarSize={28}
                        fill="url(#barGradient)"
                        animationDuration={1000}
                        animationEasing="ease-out"
                      >
                        {(chartTab === "sales" ? chartDays : purchaseChartDays).map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={(chartTab === "sales" ? entry.sales : entry.purchases) > 0 ? "url(#barGradient)" : alpha(theme.palette.action.disabled, 0.3)}
                            style={{
                              filter: (chartTab === "sales" ? entry.sales : entry.purchases) > 0 ? "url(#glow)" : "none",
                              transition: "all 0.3s ease",
                            }}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Card>
            </Zoom>
          </Grid>

          <Grid size={{ xs: 12, lg: 4 }}>
            <Zoom in={true} timeout={800} style={{ transitionDelay: '300ms' }}>
              <Card
                sx={{
                  p: { xs: 2, sm: 2.5 },
                  height: "100%",
                  borderRadius: 3.5,
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
                  background: `linear-gradient(165deg, ${alpha(theme.palette.secondary.main, 0.06)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
                  boxShadow: `0 8px 32px ${alpha(theme.palette.secondary.main, 0.12)}`,
                  transition: "transform 0.3s ease, box-shadow 0.3s ease",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: `0 16px 48px ${alpha(theme.palette.secondary.main, 0.2)}`,
                  },
                }}
              >
                <Typography fontWeight={900} variant="h6" mb={0.5} sx={{ fontSize: { xs: "1.1rem", sm: "1.2rem" } }}>
                  توزيع المخزون
                </Typography>
                <Typography variant="body2" color="text.secondary" mb={2}>
                  حسب التصنيف
                </Typography>

                {categoryShare.length === 0 ? (
                  <Box sx={{ py: 4, textAlign: "center" }}>
                    <Typography variant="body2" color="text.secondary">
                      لا بيانات مخزون محلية — أضف أصناف من صفحة المخزون
                    </Typography>
                  </Box>
                ) : (
                  <>
                    <Box sx={{ width: "100%", height: 200, mb: 2 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={categoryShare}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={70}
                            paddingAngle={2}
                            dataKey="pct"
                            animationDuration={1000}
                            animationEasing="ease-out"
                          >
                            {categoryShare.map((entry, index) => (
                              <PieCell 
                                key={`cell-${index}`} 
                                fill={[
                                  theme.palette.primary.main,
                                  theme.palette.secondary.main,
                                  theme.palette.success.main,
                                  theme.palette.warning.main,
                                  theme.palette.info.main,
                                  theme.palette.error.main,
                                ][index % 6]}
                                stroke={theme.palette.background.paper}
                                strokeWidth={2}
                              />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const data = payload[0].payload;
                              return (
                                <Box
                                  sx={{
                                    bgcolor: "background.paper",
                                    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                                    borderRadius: 2,
                                    px: 1.25,
                                    py: 1,
                                    boxShadow: 3,
                                  }}
                                >
                                  <Typography variant="body2" fontWeight={800}>
                                    {data.name}: {data.pct}%
                                  </Typography>
                                </Box>
                              );
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                    {categoryShare.map(({ name, pct }, idx) => (
                      <Box key={name} mb={1.5} sx={{ animation: `${slideIn} 0.5s ease-out ${idx * 0.1}s both` }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                          <Stack direction="row" alignItems="center" sx={{ gap: 1 }}>
                            <Box
                              sx={{
                                width: 12,
                                height: 12,
                                borderRadius: "50%",
                                bgcolor: [
                                  theme.palette.primary.main,
                                  theme.palette.secondary.main,
                                  theme.palette.success.main,
                                  theme.palette.warning.main,
                                  theme.palette.info.main,
                                  theme.palette.error.main,
                                ][idx % 6],
                              }}
                            />
                            <Typography variant="body2" fontWeight={600}>{name}</Typography>
                          </Stack>
                          <Typography variant="body2" fontWeight={800} color="primary">
                            {pct}%
                          </Typography>
                        </Stack>
                        <LinearProgress 
                          variant="determinate" 
                          value={pct} 
                          sx={{ 
                            borderRadius: 99, 
                            height: 8,
                            background: alpha(theme.palette.primary.main, 0.1),
                            "& .MuiLinearProgress-bar": {
                              background: [
                                theme.palette.primary.main,
                                theme.palette.secondary.main,
                                theme.palette.success.main,
                                theme.palette.warning.main,
                                theme.palette.info.main,
                                theme.palette.error.main,
                              ][idx % 6],
                              borderRadius: 99,
                              transition: "width 1s ease-in-out",
                            },
                          }} 
                        />
                      </Box>
                    ))}
                  </>
                )}
              </Card>
            </Zoom>
          </Grid>
        </Grid>

        <Grid container spacing={{ xs: 2, md: 3 }} mt={{ xs: 1, md: 1.5 }} alignItems="stretch">
          <Grid size={{ xs: 12, lg: 6 }}>
            <Slide in={true} direction="up" timeout={800} style={{ transitionDelay: '400ms' }}>
              <Card
                sx={{
                  p: { xs: 2, sm: 2.5 },
                  height: "100%",
                  borderRadius: 3.5,
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
                  background: `linear-gradient(165deg, ${alpha(theme.palette.primary.main, 0.05)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
                  boxShadow: `0 8px 32px ${alpha(theme.palette.primary.main, 0.1)}`,
                  transition: "transform 0.3s ease, box-shadow 0.3s ease",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: `0 16px 48px ${alpha(theme.palette.primary.main, 0.18)}`,
                  },
                }}
              >
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  alignItems={{ xs: "stretch", sm: "flex-start" }}
                  justifyContent="space-between"
                  sx={{ gap: 1.5, mb: 1.5 }}
                >
                  <Box>
                    <Typography fontWeight={900} variant="h6" sx={{ fontSize: { xs: "1.1rem", sm: "1.2rem" } }}>
                      أفضل أوقات البيع
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      توزيع المبيعات حسب ساعة اليوم من فواتير الكاشير المحفوظة محلياً
                    </Typography>
                  </Box>
                  {peakHoursInfo.maxSales > 0 ? (
                    <Chip
                      label={`أقوى ساعة: ${peakHoursInfo.hours.map((h) => `${h}:00`).join("، ")} · ${peakHoursInfo.maxSales.toFixed(1)} شيكل`}
                      color="secondary"
                      sx={{ 
                        fontWeight: 800, 
                        alignSelf: { xs: "flex-start", sm: "center" },
                        background: `linear-gradient(135deg, ${theme.palette.secondary.main} 0%, ${theme.palette.secondary.dark} 100%)`,
                        "&:hover": {
                          transform: "scale(1.05)",
                        },
                      }}
                    />
                  ) : (
                    <Chip label="لا بيانات بعد" variant="outlined" sx={{ fontWeight: 700 }} />
                  )}
                </Stack>

                {salesInvoicesLocal.length === 0 ? (
                  <Box sx={{ py: 4, textAlign: "center" }}>
                    <Typography variant="body2" color="text.secondary">
                      لا فواتير مبيعات محفوظة — يظهر المخطط بعد تسجيل مبيعات من الكاشير
                    </Typography>
                  </Box>
                ) : (
                  <Box sx={{ width: "100%", height: { xs: 280, sm: 320 }, mt: 0.5 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={hourlySalesChartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                        <defs>
                          <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={theme.palette.primary.main} stopOpacity={0.5} />
                            <stop offset="100%" stopColor={theme.palette.primary.main} stopOpacity={0.05} />
                          </linearGradient>
                          <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor={theme.palette.primary.main} />
                            <stop offset="100%" stopColor={theme.palette.secondary.main} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke={alpha(theme.palette.divider, isDark ? 0.4 : 0.7)}
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fill: theme.palette.text.secondary, fontSize: 10, fontWeight: 600 }}
                          tickLine={false}
                          axisLine={{ stroke: alpha(theme.palette.divider, 0.5) }}
                          interval={2}
                        />
                        <YAxis
                          tick={{ fill: theme.palette.text.secondary, fontSize: 10, fontWeight: 600 }}
                          tickLine={false}
                          axisLine={false}
                          width={40}
                          tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v)}
                        />
                        <RechartsTooltip
                          cursor={{ fill: alpha(theme.palette.primary.main, 0.08) }}
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null;
                            const row = payload[0].payload;
                            return (
                              <Box
                                sx={{
                                  bgcolor: "background.paper",
                                  border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                                  borderRadius: 2.5,
                                  px: 1.5,
                                  py: 1.25,
                                  boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.2)}`,
                                  backdropFilter: "blur(8px)",
                                }}
                              >
                                <Typography variant="caption" fontWeight={900} display="block">
                                  الساعة {row.label}
                                </Typography>
                                <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 700 }}>
                                  مبيعات: <b style={{ color: theme.palette.primary.main }}>{Number(row.sales).toFixed(1)}</b> شيكل
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  فواتير: {row.count}
                                </Typography>
                              </Box>
                            );
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="sales"
                          stroke="url(#lineGradient)"
                          strokeWidth={3}
                          fill="url(#areaGradient)"
                          animationDuration={1500}
                          animationEasing="ease-out"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </Box>
                )}
              </Card>
            </Slide>
          </Grid>

          <Grid size={{ xs: 12, lg: 6 }}>
            <Slide in={true} direction="up" timeout={800} style={{ transitionDelay: '500ms' }}>
              <Card
                sx={{
                  p: { xs: 2, sm: 2.5 },
                  height: "100%",
                  borderRadius: 3.5,
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
                  background: `linear-gradient(165deg, ${alpha(theme.palette.success.main, 0.05)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
                  boxShadow: `0 8px 32px ${alpha(theme.palette.success.main, 0.1)}`,
                  transition: "transform 0.3s ease, box-shadow 0.3s ease",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: `0 16px 48px ${alpha(theme.palette.success.main, 0.18)}`,
                  },
                }}
              >
                <Typography fontWeight={900} variant="h6" mb={2} sx={{ fontSize: { xs: "1.1rem", sm: "1.2rem" } }}>
                  الأصناف الأكثر مبيعاً (محلي)
                </Typography>
                {topSellers.length === 0 ? (
                  <Box sx={{ py: 4, textAlign: "center" }}>
                    <Typography variant="body2" color="text.secondary">
                      لا فواتير مبيعات محفوظة بعد
                    </Typography>
                  </Box>
                ) : (
                  <>
                    <Box sx={{ width: "100%", height: 280, mb: 2 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <defs>
                            <linearGradient id="pieGradient1" x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor="#FFD700" stopOpacity={0.9} />
                              <stop offset="100%" stopColor="#FFA500" stopOpacity={0.7} />
                            </linearGradient>
                            <linearGradient id="pieGradient2" x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor="#C0C0C0" stopOpacity={0.9} />
                              <stop offset="100%" stopColor="#A0A0A0" stopOpacity={0.7} />
                            </linearGradient>
                            <linearGradient id="pieGradient3" x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor="#CD7F32" stopOpacity={0.9} />
                              <stop offset="100%" stopColor="#8B4513" stopOpacity={0.7} />
                            </linearGradient>
                            <linearGradient id="pieGradient4" x1="0" y1="0" x2="1" y2="1">
                              <stop offset="0%" stopColor={theme.palette.primary.main} stopOpacity={0.9} />
                              <stop offset="100%" stopColor={theme.palette.primary.dark} stopOpacity={0.7} />
                            </linearGradient>
                          </defs>
                          <Pie
                            data={topSellers.map(([name, qty], idx) => ({ name, qty, idx }))}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={90}
                            paddingAngle={3}
                            dataKey="qty"
                            animationDuration={1200}
                            animationEasing="ease-out"
                            label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                            labelLine={false}
                            labelStyle={{
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              fill: theme.palette.text.primary,
                            }}
                          >
                            {topSellers.map((entry, index) => (
                              <PieCell 
                                key={`cell-${index}`} 
                                fill={[
                                  "url(#pieGradient1)",
                                  "url(#pieGradient2)",
                                  "url(#pieGradient3)",
                                  "url(#pieGradient4)",
                                ][index % 4]}
                                stroke={theme.palette.background.paper}
                                strokeWidth={2}
                              />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const data = payload[0].payload;
                              return (
                                <Box
                                  sx={{
                                    bgcolor: "background.paper",
                                    border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
                                    borderRadius: 2,
                                    px: 1.25,
                                    py: 1,
                                    boxShadow: 3,
                                  }}
                                >
                                  <Typography variant="body2" fontWeight={800}>
                                    {data.name}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {data.qty} وحدة
                                  </Typography>
                                </Box>
                              );
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </Box>
                    <Stack direction="row" flexWrap="wrap" sx={{ gap: 1.5, justifyContent: "center" }}>
                      {topSellers.map(([name, qty], idx) => {
                        const medalColors = ["#FFD700", "#C0C0C0", "#CD7F32", theme.palette.primary.main];
                        return (
                          <Stack key={name} direction="row" alignItems="center" sx={{ gap: 0.75 }}>
                            <Avatar
                              sx={{
                                width: 28,
                                height: 28,
                                bgcolor: medalColors[idx],
                                color: idx < 3 ? "#000" : "#fff",
                                fontWeight: 900,
                                fontSize: "0.8rem",
                              }}
                            >
                              {idx + 1}
                            </Avatar>
                            <Typography variant="caption" fontWeight={700}>
                              {name}
                            </Typography>
                            <Typography variant="caption" color="primary" fontWeight={800}>
                              {qty}
                            </Typography>
                          </Stack>
                        );
                      })}
                    </Stack>
                  </>
                )}
              </Card>
            </Slide>
          </Grid>
        </Grid>

     

        <Grid container spacing={{ xs: 2, md: 3 }} mt={{ xs: 2, md: 2.5 }} alignItems="stretch">
          <Grid size={{ xs: 12, md: 6 }}>
            <Slide in={true} direction="up" timeout={800} style={{ transitionDelay: '700ms' }}>
              <Card
                onClick={() => {
                  if (lowStockCount > 0) setLowStockDialogOpen(true);
                }}
                role={lowStockCount > 0 ? "button" : undefined}
                tabIndex={lowStockCount > 0 ? 0 : undefined}
                onKeyDown={
                  lowStockCount > 0
                    ? (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setLowStockDialogOpen(true);
                        }
                      }
                    : undefined
                }
                sx={{
                  height: "100%",
                  borderRadius: 3.5,
                  overflow: "hidden",
                  border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
                  background: `linear-gradient(165deg, ${alpha(theme.palette.primary.main, 0.06)} 0%, ${alpha(theme.palette.background.paper, 0.98)} 100%)`,
                  boxShadow: `0 12px 32px ${alpha(theme.palette.primary.main, 0.12)}`,
                  display: "flex",
                  flexDirection: "column",
                  cursor: lowStockCount > 0 ? "pointer" : "default",
                  transition: "transform 0.3s ease, box-shadow 0.3s ease",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: `0 20px 48px ${alpha(theme.palette.primary.main, 0.2)}`,
                  },
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
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate("/admin/inventory");
                  }}
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
                <Box sx={{ p: { xs: 1.25, sm: 1.5 }, flex: 1, overflow: "hidden" }}>
                  <Grid container spacing={1}>
                    {lowStockPreviewItems.map((p) => {
                      const q = Number(p.qty || 0);
                      return (
                        <Grid key={p.id} size={{ xs: 12 }}>
                          <Paper
                            elevation={0}
                            sx={{
                              p: 1,
                              height: "100%",
                              borderRadius: 2,
                              border: `1px solid ${alpha(theme.palette.primary.main, 0.18)}`,
                              bgcolor: alpha(theme.palette.background.paper, 0.9),
                              transition: "box-shadow .2s ease, border-color .2s ease",
                              "&:hover": {
                                borderColor: alpha(theme.palette.primary.main, 0.35),
                                boxShadow: `0 8px 22px ${alpha(theme.palette.primary.main, 0.12)}`,
                              },
                            }}
                          >
                            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ gap: 1 }}>
                              <Typography fontWeight={800} sx={{ lineHeight: 1.35, minWidth: 0, flex: 1 }} noWrap>
                                {productDisplayName(p)}
                              </Typography>
                              <Chip
                                size="small"
                                label={`متاح ${q.toFixed(1)}`}
                                color="primary"
                                variant="outlined"
                                sx={{ fontWeight: 700, flexShrink: 0 }}
                              />
                              <Chip
                                size="small"
                                label={`الحد ${Number(p.min || 0).toFixed(1)}`}
                                color="secondary"
                                variant="outlined"
                                sx={{ fontWeight: 700, flexShrink: 0 }}
                              />
                            </Stack>
                          </Paper>
                        </Grid>
                      );
                    })}
                  </Grid>
                  {lowStockItems.length > lowStockPreviewItems.length ? (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 1.2, display: "block", textAlign: "center", fontWeight: 700 }}
                    >
                      +{lowStockItems.length - lowStockPreviewItems.length} عنصر إضافي — اضغط لعرض الكل
                    </Typography>
                  ) : (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ mt: 1.2, display: "block", textAlign: "center", fontWeight: 700 }}
                    >
                      اضغط على الكارد لعرض التفاصيل كاملة
                    </Typography>
                  )}
                </Box>
              )}
            </Card>
            </Slide>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Slide in={true} direction="up" timeout={800} style={{ transitionDelay: '800ms' }}>
              <Card
                sx={{
                  height: "100%",
                  borderRadius: 3.5,
                  overflow: "hidden",
                  position: "relative",
                  border: `1px solid ${alpha(theme.palette.secondary.main, 0.25)}`,
                  background: `linear-gradient(135deg, ${alpha(theme.palette.secondary.main, 0.15)} 0%, ${alpha(
                    theme.palette.primary.main,
                    0.08,
                  )} 38%, ${alpha(theme.palette.background.paper, 0.98)} 72%, ${alpha(
                    theme.palette.secondary.main,
                    0.1,
                  )} 100%)`,
                  boxShadow: `0 16px 48px ${alpha(theme.palette.primary.main, 0.15)}, inset 0 1px 0 ${alpha(
                    theme.palette.common.white,
                    0.5,
                  )}`,
                  display: "flex",
                  flexDirection: "column",
                  transition: "transform 0.3s ease, box-shadow 0.3s ease",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: `0 24px 64px ${alpha(theme.palette.secondary.main, 0.25)}`,
                  },
                  "&::before": {
                    content: '""',
                    position: "absolute",
                    top: -40,
                    left: -40,
                    width: 120,
                    height: 120,
                    borderRadius: "50%",
                    background: `radial-gradient(circle, ${alpha(theme.palette.secondary.main, 0.3)} 0%, transparent 70%)`,
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
                    background: `radial-gradient(circle, ${alpha(theme.palette.primary.main, 0.25)} 0%, transparent 70%)`,
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
            </Slide>
          </Grid>
        </Grid>

        <Dialog open={lowStockDialogOpen} onClose={() => setLowStockDialogOpen(false)} fullWidth maxWidth="md">
          <DialogTitle sx={{ textAlign: "right", fontWeight: 900 }}>
            عناصر نواقص المخزون ({lowStockItems.length})
          </DialogTitle>
          <DialogContent sx={{ textAlign: "right" }}>
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>الصنف</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>القسم</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>المتاح</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>الحد الأدنى</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>سعر البيع</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>إجراءات</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lowStockItems.map((p) => (
                    <TableRow
                      key={`ls-${p.id}`}
                      hover
                      onClick={() => openRestockFromDashboard(p)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell align="center" sx={{ fontWeight: 700 }}>{productDisplayName(p)}</TableCell>
                      <TableCell align="center">{String(p.category || "—")}</TableCell>
                      <TableCell align="center">{Number(p.qty || 0).toFixed(1)}</TableCell>
                      <TableCell align="center">{Number(p.min || 0).toFixed(1)}</TableCell>
                      <TableCell align="center">{Number(p.price || 0).toFixed(2)} شيكل</TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.7} justifyContent="center">
                          <Button
                            size="small"
                            variant="outlined"
                            sx={{ textTransform: "none" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openRestockFromDashboard(p);
                            }}
                          >
                            زيادة الكمية
                          </Button>
                          <Button
                            size="small"
                            color="warning"
                            variant="text"
                            sx={{ textTransform: "none" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              dismissLowStockItem(p);
                            }}
                          >
                            إخفاء من النواقص
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setLowStockDialogOpen(false)} sx={{ textTransform: "none" }}>
              إغلاق
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </AdminLayout>
  );
}
