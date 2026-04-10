import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Grid,
  Alert,
  CircularProgress,
  InputAdornment,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  TablePagination,
  DialogContent,
  DialogActions,
  MenuItem,
  Tabs,
  Tab,
  Stack,
  Avatar,
  LinearProgress,
  Tooltip,
} from "@mui/material";
import {
  AccountBalance,
  AttachMoney,
  CheckCircle,
  History,
  Receipt,
  Add,
  Close,
  Description,
  Category,
  Payment,
  People,
  Dashboard,
  TrendingUp,
  Business,
  Inventory,
  TrendingDown,
  Person,
  ShoppingCart,
  MonetizationOn,
  BarChart,
  PeopleAlt,
  FilterList,
  DeleteOutline,
  Warning,
  AccountBalanceWallet,
  MoneyOff,
  Refresh,
  Download,
  Print,
  RestaurantMenu,
  ExpandMore,
} from "@mui/icons-material";
import axios from "axios";
import { formatMoney } from "../../utils/currency";
import { confirmApp, showAppAlert, showAppDialog } from "../../utils/appToast";

const API_BASE_URL = "http://127.0.0.1:8000/api";

/** بطاقة فلاتر موحّدة لجميع التبويبات */
const FilterSectionCard = ({ title, children }) => (
  <Paper
    elevation={0}
    sx={{
      p: 2.5,
      mb: 3,
      borderRadius: 2,
      border: "1px solid",
      borderColor: "divider",
      width: "100%",
    }}
  >
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
      <FilterList color="primary" sx={{ fontSize: 26 }} />
      <Typography variant="h6" fontWeight="600" color="text.primary">
        {title}
      </Typography>
    </Box>
    {children}
  </Paper>
);

const TreasuryDeposit = () => {
  const TREASURY_API = `${API_BASE_URL}/treasury`;

  // ===== الحالات الأساسية =====
  const [treasuryData, setTreasuryData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [activeTab, setActiveTab] = useState(0);
  const [depositDialogOpen, setDepositDialogOpen] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositNotes, setDepositNotes] = useState(""); // ===== حالات تقرير الوجبات =====
  const [mealReport, setMealReport] = useState(null);
  const [mealReportLoading, setMealReportLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const [employeesPage, setEmployeesPage] = useState(0);
  const [purchasesPage, setPurchasesPage] = useState(0);
  const [ordersPage, setOrdersPage] = useState(0);
  const [mealsPage, setMealsPage] = useState(0);
  const [mealFilters, setMealFilters] = useState({
    period: "daily", // daily, weekly, monthly, custom
    start_date: "",
    end_date: "",
    meal_id: "",
    category_id: "",
    search: "",
  });
  const [selectedMealForDetails, setSelectedMealForDetails] = useState(null);
  const [mealDetailsDialogOpen, setMealDetailsDialogOpen] = useState(false);
  const [salesReport, setSalesReport] = useState(null);
  const [salesReportLoading, setSalesReportLoading] = useState(false);
  const [salesFilters, setSalesFilters] = useState({
    period: "daily",
    start_date: "",
    end_date: "",
    type: "all",
    status: "",
    payment_method: "",
  });
  const [employeesList, setEmployeesList] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [employeeSummary, setEmployeeSummary] = useState(null);
  const [employeeFilters, setEmployeeFilters] = useState({
    period: "daily", // daily, weekly, monthly, custom
    start_date: "",
    end_date: "",
    department: "",
    status: "all",
  });
  const [salaryDetailsDialog, setSalaryDetailsDialog] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  // ===== حالات نافذة تفاصيل الطلب =====
  const [orderDetailsDialog, setOrderDetailsDialog] = useState(false);
  // ===== دوال الترقيم =====
  const handleChangePage = (event, newPage, type) => {
    switch (type) {
      case "employees":
        setEmployeesPage(newPage);
        break;
      case "purchases":
        setPurchasesPage(newPage);
        break;
      case "orders":
        setOrdersPage(newPage);
        break;
      case "meals":
        setMealsPage(newPage);
        break;
      default:
        setPage(newPage);
    }
  };

  const handleChangeRowsPerPage = (event, type) => {
    const newRowsPerPage = parseInt(event.target.value, 10);
    setRowsPerPage(newRowsPerPage);

    // إعادة تعيين الصفحة إلى 0
    switch (type) {
      case "employees":
        setEmployeesPage(0);
        break;
      case "purchases":
        setPurchasesPage(0);
        break;
      case "orders":
        setOrdersPage(0);
        break;
      case "meals":
        setMealsPage(0);
        break;
      default:
        setPage(0);
    }
  };
  const [selectedOrder, setSelectedOrder] = useState(null); // ===== فتح نافذة تفاصيل الطلب =====
  const handleOpenOrderDetails = (order) => {
    // تأكد من أن كل عنصر فيه الخيارات المختارة
    const processedOrder = {
      ...order,
      items: order.items.map((item) => ({
        ...item,
        // تأكد من وجود مصفوفة options
        options: item.options || item.selected_options || [],
        // تأكد من وجود has_options
        has_options:
          item.options?.length > 0 ||
          item.selected_options?.length > 0 ||
          false,
      })),
    };
    setSelectedOrder(processedOrder);
    setOrderDetailsDialog(true);
  };
  // ===== جلب تقرير المبيعات المفصل =====
  // ===== جلب تقرير المبيعات المفصل =====
  const fetchSalesDetailedReport = async () => {
    try {
      setSalesReportLoading(true);

      const params = new URLSearchParams();
      params.append("period", salesFilters.period || "daily");

      if (salesFilters.period === "custom") {
        if (salesFilters.start_date) {
          params.append("start_date", salesFilters.start_date);
        }
        if (salesFilters.end_date) {
          params.append("end_date", salesFilters.end_date);
        }
      }

      if (salesFilters.type && salesFilters.type !== "all") {
        params.append("type", salesFilters.type);
      }

      if (salesFilters.status) {
        params.append("status", salesFilters.status);
      }

      if (salesFilters.payment_method) {
        params.append("payment_method", salesFilters.payment_method);
      }

      // أضف هذا للتأكد من تضمين الخيارات
      params.append("include_options", "true");

      console.log("🔍 جلب التقرير بالمعاملات:", params.toString());

      const response = await axios.get(
        `${API_BASE_URL}/orders/sales-detailed-report?${params.toString()}`,
      );

      if (response.data.success) {
        setSalesReport(response.data.data);
      }
    } catch (err) {
      console.error("❌ خطأ في جلب تقرير المبيعات:", err);
      if (err.response?.data?.errors) {
        setError(
          `خطأ في البيانات: ${JSON.stringify(err.response.data.errors)}`,
        );
      } else {
        setError(err.response?.data?.message || "فشل في جلب تقرير المبيعات");
      }
    } finally {
      setSalesReportLoading(false);
    }
  };

  // ===== إعادة تعيين فلاتر المبيعات =====
  // ===== إعادة تعيين فلاتر المبيعات =====
  const resetSalesFilters = () => {
    setSalesFilters({
      period: "daily", // ✅ قيمة افتراضية
      start_date: "",
      end_date: "",
      type: "all",
      status: "",
      payment_method: "",
    });
    // إعادة تحميل التقرير بعد إعادة التعيين
    setTimeout(() => fetchSalesDetailedReport(), 100);
  };
  // ===== حالات تقرير المشتريات =====
  const [purchasesReport, setPurchasesReport] = useState(null);
  const [purchasesReportLoading, setPurchasesReportLoading] = useState(false);
  const [purchasesFilters, setPurchasesFilters] = useState({
    period: "daily",
    start_date: "",
    end_date: "",
    category_id: "",
  });
  const [purchasesDetailsDialog, setPurchasesDetailsDialog] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);

  // ===== جلب تقرير المشتريات المفصل =====
  const fetchPurchasesDetailedReport = async () => {
    try {
      setPurchasesReportLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append("period", purchasesFilters.period || "daily");
      if (purchasesFilters.period === "custom") {
        if (purchasesFilters.start_date) params.append("start_date", purchasesFilters.start_date);
        if (purchasesFilters.end_date) params.append("end_date", purchasesFilters.end_date);
      }
      if (purchasesFilters.category_id) params.append("category_id", purchasesFilters.category_id);

      // استخدام تقرير المشتريات من جدول المشتريات (يعرض الفواتير الفعلية)
      const response = await axios.get(
        `${API_BASE_URL}/purchases/report?${params.toString()}`,
      );

      if (response.data.success) {
        setPurchasesReport(response.data.data);
      }
    } catch (err) {
      console.error("❌ خطأ في جلب تقرير المشتريات:", err);
      setError(err.response?.data?.message || "فشل في جلب تقرير المشتريات");
    } finally {
      setPurchasesReportLoading(false);
    }
  };

  // ===== إعادة تعيين فلاتر المشتريات =====
  const resetPurchasesFilters = () => {
    setPurchasesFilters({
      period: "daily",
      start_date: "",
      end_date: "",
      category_id: "",
    });
    setTimeout(() => fetchPurchasesDetailedReport(), 100);
  };

  // ===== فتح نافذة تفاصيل الشراء =====
  const handleOpenPurchaseDetails = (purchase) => {
    setSelectedPurchase(purchase);
    setPurchasesDetailsDialog(true);
  };
  // ===== تصدير تقرير المبيعات =====
  const exportSalesReport = (format) => {
    showAppAlert(
      `جاري تجهيز تقرير المبيعات ${format === "pdf" ? "PDF" : "Excel"}... سيتم تفعيله قريباً`,
      "info",
      "قريباً",
    );
  };
  const [mealsList, setMealsList] = useState([]);
  const [categories, setCategories] = useState([]); // ===== جلب قائمة الوجبات للفلتر =====
  const fetchMealsList = async () => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/meals/all-with-details?limit=1000`,
      );
      if (response.data.success) {
        setMealsList(response.data.data.meals);
      }
    } catch (err) {
      console.error("خطأ في جلب الوجبات:", err);
    }
  };

  // ===== جلب الأقسام للفلتر =====
  const fetchCategories = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/categories/main`);
      if (response.data.success) {
        setCategories(response.data.data);
      }
    } catch (err) {
      console.error("خطأ في جلب الأقسام:", err);
    }
  };

  // ===== جلب تقرير الوجبات =====
  // ===== جلب تقرير الوجبات المفصل =====
  const fetchMealReport = async () => {
    try {
      setMealReportLoading(true);

      // بناء query string
      const params = new URLSearchParams();
      if (mealFilters.start_date)
        params.append("start_date", mealFilters.start_date);
      if (mealFilters.end_date) params.append("end_date", mealFilters.end_date);
      if (mealFilters.meal_id) params.append("meal_id", mealFilters.meal_id);
      if (mealFilters.category_id)
        params.append("category_id", mealFilters.category_id);
      if (mealFilters.search) params.append("search", mealFilters.search);

      // عدد العناصر في الصفحة
      params.append("per_page", 100);

      const response = await axios.get(
        `${API_BASE_URL}/meals/detailed-report?${params.toString()}`,
      );

      if (response.data.success) {
        setMealReport(response.data.data);
      }
    } catch (err) {
      console.error("خطأ في جلب تقرير الوجبات:", err);
      setError("فشل في جلب تقرير الوجبات");
    } finally {
      setMealReportLoading(false);
    }
  };

  // ===== تصدير تقرير PDF =====
  const exportMealReportPDF = () => {
    showAppAlert("جاري تجهيز تقرير PDF... سيتم تفعيله قريباً", "info", "قريباً");
  };

  // ===== تصدير Excel =====
  const exportMealReportExcel = () => {
    showAppAlert("جاري تجهيز ملف Excel... سيتم تفعيله قريباً", "info", "قريباً");
  };

  // ===== إعادة تعيين الفلاتر =====
  const resetMealFilters = () => {
    setMealFilters({
      period: "daily",
      start_date: "",
      end_date: "",
      meal_id: "",
      category_id: "",
      search: "",
    });
    setTimeout(() => fetchMealReport(), 100);
  };

  // تطبيق الفترة السريعة (يومي / أسبوعي / شهري)
  const applyMealPeriod = (period) => {
    const today = new Date();
    let start = new Date(today);
    let end = new Date(today);
    if (period === "daily") {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (period === "weekly") {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (period === "monthly") {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    }
    const fmt = (d) => d.toISOString().split("T")[0];
    const startStr = fmt(start);
    const endStr = fmt(end);
    setMealFilters((prev) => ({ ...prev, period, start_date: startStr, end_date: endStr }));
    fetchMealReportWithDates(startStr, endStr);
  };

  const fetchMealReportWithDates = (startDate, endDate) => {
    setMealReportLoading(true);
    const params = new URLSearchParams();
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);
    if (mealFilters.meal_id) params.append("meal_id", mealFilters.meal_id);
    if (mealFilters.category_id) params.append("category_id", mealFilters.category_id);
    if (mealFilters.search) params.append("search", mealFilters.search);
    params.append("per_page", 100);
    axios
      .get(`${API_BASE_URL}/meals/detailed-report?${params.toString()}`)
      .then((res) => {
        if (res.data.success) setMealReport(res.data.data);
      })
      .catch(() => setError("فشل في جلب تقرير المنتجات"))
      .finally(() => setMealReportLoading(false));
  };
  console.log(treasuryData, "treasuryData");

  // ===== حالات الفلاتر =====
  const [filters, setFilters] = useState({
    start_date: "",
    end_date: "",
    category: "",
    department: "",
  });
  useEffect(() => {
    fetchTreasuryData();
    fetchMealsList(); // 👈 أضف هذا
    fetchCategories(); // 👈 أضف هذا
  }, []);
  // ===== جلب بيانات الخزنة =====
  const fetchTreasuryData = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(TREASURY_API);

      if (response.data && response.data.success) {
        const data = response.data.data;
        setTreasuryData(data);
      } else {
        setError("فشل في جلب البيانات");
      }
    } catch (err) {
      console.error("خطأ في جلب بيانات الخزنة:", err);
      setError(err.response?.data?.message || "تعذر جلب بيانات الخزنة");
    } finally {
      setLoading(false);
    }
  };

  const handleResetExpenses = async () => {
    const ok = await confirmApp({
      title: "تصفير المصروفات",
      text: "هل أنت متأكد من تصفير إجمالي المصروفات؟ هذا الإجراء سيضيف المبلغ للخزنة ويصفر المصروفات!",
      icon: "warning",
      danger: true,
      confirmText: "نعم، صفّر",
    });
    if (!ok) return;

    try {
      setLoading(true);
      setError(null);

      const response = await axios.post(`${TREASURY_API}/reset-expenses`);

      if (response.data && response.data.success) {
        setSuccess(response.data.message || "تم تصفير إجمالي المصروفات بنجاح");

        // تحديث البيانات مباشرة
        if (treasuryData) {
          // تحديث رصيد الخزنة في الـ state
          const updatedTreasury = {
            ...treasuryData.treasury,
            balance: response.data.data.new_balance,
          };

          setTreasuryData({
            ...treasuryData,
            treasury: updatedTreasury,
          });
        }

        // إعادة تحميل البيانات
        fetchTreasuryData();
      } else {
        setError(response.data?.message || "فشل في تصفير المصروفات");
      }
    } catch (err) {
      console.error("خطأ في تصفير المصروفات:", err);
      setError(err.response?.data?.message || "تعذر تصفير المصروفات");
    } finally {
      setLoading(false);
    }
  }; // ===== جلب بيانات الموظفين والرواتب =====
  const fetchEmployeesData = async () => {
    try {
      setEmployeesLoading(true);
      setError(null);

      const params = new URLSearchParams();

      // إضافة الفترة
      if (employeeFilters.period) {
        params.append("period", employeeFilters.period);
      }

      // إضافة التواريخ فقط إذا كانت الفترة مخصصة
      if (employeeFilters.period === "custom") {
        if (employeeFilters.start_date)
          params.append("start_date", employeeFilters.start_date);
        if (employeeFilters.end_date)
          params.append("end_date", employeeFilters.end_date);
      }

      if (employeeFilters.department)
        params.append("department", employeeFilters.department);
      if (employeeFilters.status && employeeFilters.status !== "all") {
        params.append("status", employeeFilters.status);
      }

      const response = await axios.get(
        `${API_BASE_URL}/treasury/status/employees?${params.toString()}`,
      );

      if (response.data && response.data.success) {
        const data = response.data.data || {};
        setEmployeesList(data.employees || []);
        setEmployeeSummary(data.summary || null);
      } else {
        setError("فشل في جلب بيانات الموظفين");
      }
    } catch (err) {
      console.error("خطأ في جلب بيانات الموظفين:", err);
      setError(err.response?.data?.message || "تعذر جلب بيانات الموظفين");
    } finally {
      setEmployeesLoading(false);
    }
  };
  const resetEmployeeFilters = () => {
    setEmployeeFilters({
      period: "daily",
      start_date: "",
      end_date: "",
      department: "",
      status: "all",
    });
    setTimeout(() => fetchEmployeesData(), 100);
  };
  // ===== جلب حالة الموظفين =====
  const fetchEmployeesStatus = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${TREASURY_API}/status/employees`);
      if (response.data && response.data.success) {
        setTreasuryData(response.data.data);
      }
    } catch (err) {
      console.error("خطأ في جلب حالة الموظفين:", err);
    } finally {
      setLoading(false);
    }
  };

  // أضف هذه الدالة بعد handleResetIncome مباشرة:
  const handleResetEverything = async () => {
    const ok = await confirmApp({
      title: "تحذير شديد",
      html: `<div class="app-swal-html" style="text-align:right">
        <p style="margin-bottom:12px;font-weight:600">أنت على وشك تصفير النظام بالكامل!</p>
        <p style="margin-bottom:6px">سيتم حذف:</p>
        <ul style="margin:0;padding-right:1.15rem;line-height:1.85">
          <li>جميع الطلبات</li>
          <li>جميع المشتريات</li>
          <li>جميع المعاملات</li>
          <li>تصفير الخزنة</li>
          <li>تصفير كميات المنتجات</li>
        </ul>
        <p style="margin-top:14px;color:#b71c1c;font-weight:700">هذا الإجراء لا يمكن التراجع عنه. هل أنت متأكد تماماً؟</p>
      </div>`,
      icon: "warning",
      danger: true,
      confirmText: "نعم، صفّر النظام",
    });
    if (!ok) return;

    try {
      setLoading(true);
      setError(null);

      const response = await axios.post(`${TREASURY_API}/resetEverything`);

      if (response.data && response.data.success) {
        setSuccess("✅ تم تصفير النظام بالكامل بنجاح");

        // إعادة تحميل البيانات
        fetchTreasuryData();

        const st = response.data.data?.stats_before_reset;
        await showAppDialog({
          icon: "success",
          title: "تم التصفير بنجاح",
          html: `<div class="app-swal-html" style="text-align:right;line-height:1.8">
            <p style="font-weight:600;margin-bottom:8px">المعطيات المصفرة:</p>
            <ul style="margin:0;padding-right:1.1rem">
              <li>الطلبات: ${st?.orders_count ?? 0}</li>
              <li>المشتريات: ${st?.purchases_count ?? 0}</li>
              <li>المعاملات: ${st?.transactions_count ?? 0}</li>
              <li>رصيد الخزنة: ${st?.treasury_balance ?? 0} شيكل</li>
              <li>كميات المنتجات: جميعها = 0</li>
            </ul>
          </div>`,
        });
      } else {
        setError(response.data?.message || "فشل في تصفير النظام");
      }
    } catch (err) {
      console.error("خطأ في تصفير النظام:", err);
      setError(err.response?.data?.message || "تعذر تصفير النظام");
    } finally {
      setLoading(false);
    }
  };

  // ===== جلب حالة المشتريات =====
  const fetchExpensesStatus = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${TREASURY_API}/status/expenses`);
      if (response.data && response.data.success) {
        setTreasuryData(response.data.data);
      }
    } catch (err) {
      console.error("خطأ في جلب حالة المشتريات:", err);
    } finally {
      setLoading(false);
    }
  };
  console.log(treasuryData, "TreasuryData");

  // ===== جلب حالة المبيعات =====
  const fetchSalesStatus = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${TREASURY_API}/status/sales`);
      if (response.data && response.data.success) {
        setTreasuryData(response.data.data);
      }
    } catch (err) {
      console.error("خطأ في جلب حالة المبيعات:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetIncome = async () => {
    const ok = await confirmApp({
      title: "تصفير إجمالي الدخل",
      text: "هل أنت متأكد من تصفير إجمالي الدخل؟ هذا الإجراء سيجعل إجمالي الدخل صفر!",
      icon: "warning",
      danger: true,
      confirmText: "نعم، صفّر",
    });
    if (!ok) return;

    try {
      setLoading(true);
      setError(null);

      const response = await axios.post(`${TREASURY_API}/reset-income`);

      if (response.data && response.data.success) {
        setSuccess(response.data.message || "تم تصفير إجمالي الدخل بنجاح");

        // تحديث البيانات في الـ state
        if (treasuryData) {
          const updatedTreasury = {
            ...treasuryData.treasury,
            total_income: 0,
          };

          setTreasuryData({
            ...treasuryData,
            treasury: updatedTreasury,
          });
        }

        // إعادة تحميل البيانات
        fetchTreasuryData();
      } else {
        setError(response.data?.message || "فشل في تصفير الدخل");
      }
    } catch (err) {
      console.error("خطأ في تصفير الدخل:", err);
      setError(err.response?.data?.message || "تعذر تصفير الدخل");
    } finally {
      setLoading(false);
    }
  };
  const renderSelectedOptions = (options) => {
    if (!options || options.length === 0) return null;

    return (
      <Box sx={{ p: 1, minWidth: 200 }}>
        <Typography variant="subtitle2" color="warning.main" gutterBottom>
          الخيارات المختارة:
        </Typography>
        {options.map((opt, idx) => (
          <Box
            key={idx}
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 0.5,
              borderBottom:
                idx < options.length - 1 ? "1px dashed #e0e0e0" : "none",
              pb: 0.5,
            }}
          >
            <Typography variant="body2">{opt.name}</Typography>
            <Typography variant="body2" color="warning.main" fontWeight="bold">
              +{opt.price} شيكل
            </Typography>
          </Box>
        ))}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            mt: 1,
            pt: 1,
            borderTop: "1px solid #FF9800",
          }}
        >
          <Typography variant="body2" fontWeight="bold">
            الإجمالي مع الخيارات:
          </Typography>
          <Typography variant="body2" color="success.main" fontWeight="bold">
            {options.reduce(
              (sum, opt) => sum + (parseFloat(opt.price) || 0),
              0,
            )}{" "}
            شيكل
          </Typography>
        </Box>
      </Box>
    );
  };
  // ===== إيداع مبلغ في الخزنة =====
  // ===== إيداع مبلغ في الخزنة =====
  const handleDeposit = async () => {
    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      setError("يرجى إدخال مبلغ صحيح");
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(`${TREASURY_API}/manual-deposit`, {
        amount: parseFloat(depositAmount),
        description: depositNotes || "إيداع نقدي في الخزنة", // غير من notes إلى description
        type: "deposit",
      });

      if (response.data && response.data.success) {
        setSuccess("تم إيداع المبلغ بنجاح");
        setDepositDialogOpen(false);
        setDepositAmount("");
        setDepositNotes("");
        fetchTreasuryData();
      } else {
        setError("فشل في إيداع المبلغ");
      }
    } catch (err) {
      console.error("خطأ في الإيداع:", err);
      setError(err.response?.data?.message || "تعذر إيداع المبلغ");
    } finally {
      setLoading(false);
    }
  };

  // ===== تصفير الخزنة =====
  // ===== تصفير الخزنة =====
  const handleResetTreasury = async () => {
    const ok = await confirmApp({
      title: "تصفير الخزنة",
      text: "هل أنت متأكد من تصفير الخزنة؟ هذا الإجراء لا يمكن التراجع عنه!",
      icon: "warning",
      danger: true,
      confirmText: "نعم، صفّر الخزنة",
    });
    if (!ok) return;

    try {
      setLoading(true);

      // يمكنك الحصول على اسم المستخدم من الـ auth أو localStorage
      const userName = localStorage.getItem("user_name") || "المسؤول";

      const response = await axios.post(`${TREASURY_API}/reset`, {
        notes: "تم تصفير الخزنة بواسطة النظام",
        performed_by: userName,
      });

      if (response.data && response.data.success) {
        setSuccess("تم تصفير الخزنة بنجاح");
        setResetDialogOpen(false);
        fetchTreasuryData();
      } else {
        setError(response.data?.message || "فشل في تصفير الخزنة");
      }
    } catch (err) {
      console.error("خطأ في تصفير الخزنة:", err);
      setError(err.response?.data?.message || "تعذر تصفير الخزنة");
    } finally {
      setLoading(false);
    }
  };

  // ===== التعامل مع تغيير التبويبات =====
  // ===== التعامل مع تغيير التبويبات =====
  // ===== التعامل مع تغيير التبويبات =====
  // ===== التعامل مع تغيير التبويبات =====
  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    switch (newValue) {
      case 0:
        fetchTreasuryData();
        break;
      case 1:
        fetchEmployeesData(); // ✅ تغيير من fetchEmployeesStatus إلى fetchEmployeesData
        break;
      case 2:
        fetchPurchasesDetailedReport();
        break;
      case 3:
        if (!salesFilters.period) {
          setSalesFilters((prev) => ({ ...prev, period: "daily" }));
        }
        fetchSalesDetailedReport();
        break;
      case 4:
        if (!mealFilters.start_date || !mealFilters.end_date) {
          const today = new Date();
          const start = new Date(today);
          const end = new Date(today);
          start.setHours(0, 0, 0, 0);
          end.setHours(23, 59, 59, 999);
          const fmt = (d) => d.toISOString().split("T")[0];
          setMealFilters((prev) => ({ ...prev, period: "daily", start_date: fmt(start), end_date: fmt(end) }));
          fetchMealReportWithDates(fmt(start), fmt(end));
        } else {
          fetchMealReport();
        }
        break;
      default:
        fetchTreasuryData();
    }
  };

  // ===== تنسيق العملة (مع كلمة شيكل) =====
  const formatCurrency = (amount) => formatMoney(amount);
  /** أرقام بالإنجليزي فقط (للعدادات والنسب) */
  const formatNumEn = (num) => {
    const n = Number(num);
    if (Number.isNaN(n)) return "0";
    return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  };
  // ===== التحميل الأولي =====
  useEffect(() => {
    fetchTreasuryData();
  }, []);

  // ===== حالة التحميل =====
  if (loading && !treasuryData) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="400px"
      >
        <CircularProgress size={60} />
        <Typography variant="h6" sx={{ ml: 2 }}>
          جاري تحميل بيانات الخزنة...
        </Typography>
      </Box>
    );
  }

  // ===== عرض المحتوى حسب التبويب =====
  const renderTabContent = () => {
    switch (activeTab) {
      case 0: // ملخص
        return renderSummary();
      case 1: // الموظفين
        return renderEmployees();
      case 2: // المشتريات
        return renderExpenses();
      case 3: // المبيعات
        return renderSales();
      case 4:
        return renderMealReport(); // 👈 أضف هذا
      default:
        return renderSummary();
    }
  };

  // ===== تبويب الملخص =====
  const renderSummary = () => {
    return (
      <Box sx={{ width: "100%" }}>
        {treasuryData && (
        <>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid size={{ xs: 12, md: 3 }}>
              <Card sx={{ boxShadow: 3, height: "100%" }}>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                    <AccountBalanceWallet color="primary" sx={{ mr: 1 }} />
                    <Typography variant="h6" color="text.secondary">
                      رصيد الخزنة
                    </Typography>
                  </Box>
                  <Typography variant="h3" color="primary" sx={{ fontWeight: "bold", mb: 1 }}>
                    {formatCurrency(treasuryData.treasury.balance || 0)}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    آخر تحديث: {new Date().toLocaleDateString("ar-EG")}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Card sx={{ boxShadow: 3, height: "100%" }}>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                    <TrendingUp color="success" sx={{ mr: 1 }} />
                    <Typography variant="h6" color="text.secondary">
                      إجمالي الدخل
                    </Typography>
                  </Box>
                  <Typography variant="h3" color="success.main" sx={{ fontWeight: "bold" }}>
                    {formatCurrency(treasuryData.treasury.total_income || 0)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Card sx={{ boxShadow: 3, height: "100%" }}>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                    <TrendingDown color="error" sx={{ mr: 1 }} />
                    <Typography variant="h6" color="text.secondary">
                      إجمالي المصروفات
                    </Typography>
                  </Box>
                  <Typography variant="h3" color="error.main" sx={{ fontWeight: "bold" }}>
                    {formatCurrency(treasuryData.stats.monthly_expenses || 0)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Card sx={{ boxShadow: 3, height: "100%" }}>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                    <TrendingUp sx={{ mr: 1, color: "success.main" }} />
                    <Typography variant="h6" color="text.secondary">
                      صافي التدفق
                    </Typography>
                  </Box>
                  <Typography variant="h3" sx={{ fontWeight: "bold", color: "success.main" }}>
                    {formatCurrency((treasuryData.treasury.total_income || 0) - (treasuryData.stats.monthly_expenses || 0))}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    الدخل − المصروفات
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* آخر المعاملات */}
          {treasuryData.recent_transactions && treasuryData.recent_transactions.length > 0 && (
            <Card sx={{ boxShadow: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  آخر المعاملات
                </Typography>
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>التاريخ</TableCell>
                        <TableCell>النوع</TableCell>
                        <TableCell>المبلغ</TableCell>
                        <TableCell>الوصف</TableCell>
                        <TableCell>الرصيد بعد</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {treasuryData.recent_transactions.map((transaction, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            {new Date(transaction.created_at).toLocaleDateString("ar-EG")}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={transaction.type === "deposit" ? "إيداع" : "سحب"}
                              color={transaction.type === "deposit" ? "success" : "error"}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography
                              color={transaction.type === "deposit" ? "success.main" : "error.main"}
                              fontWeight="bold"
                            >
                              {formatCurrency(transaction.amount)}
                            </Typography>
                          </TableCell>
                          <TableCell>{transaction.notes || "بدون وصف"}</TableCell>
                          <TableCell>{formatCurrency(transaction.balance_after)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
        {/* إدارة الخزنة - بوكسات منظمة بعرض كامل */}
        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            mb: 3,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            width: "100%",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <AccountBalanceWallet color="primary" sx={{ fontSize: 28 }} />
            <Typography variant="h6" fontWeight="600" color="text.primary">
              إدارة الخزنة
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, display: "block" }}>
            إيداع مبلغ، تصفير الرصيد أو المصروفات أو الدخل، أو تصفير النظام بالكامل.
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
              gap: 2,
              width: "100%",
            }}
          >
            <Tooltip title="إضافة مبلغ للخزنة">
              <Button
                variant="contained"
                color="primary"
                startIcon={<Add />}
                onClick={() => setDepositDialogOpen(true)}
                fullWidth
                sx={{ py: 1.5, borderRadius: 2 }}
              >
                إيداع مبلغ
              </Button>
            </Tooltip>
            <Tooltip title="تصفير الخزنة - إرجاع الرصيد للصفر">
              <Button
                variant="contained"
                color="error"
                startIcon={<DeleteOutline />}
                onClick={() => setResetDialogOpen(true)}
                fullWidth
                sx={{ py: 1.5, borderRadius: 2 }}
              >
                تصفير الخزنة
              </Button>
            </Tooltip>
            <Tooltip title="تصفير إجمالي مصروفات المشتريات وإضافة المبلغ للخزنة">
              <Button
                variant="contained"
                color="warning"
                startIcon={<MoneyOff />}
                onClick={handleResetExpenses}
                disabled={loading}
                fullWidth
                sx={{ py: 1.5, borderRadius: 2 }}
              >
                تصفير المصروفات
              </Button>
            </Tooltip>
            <Tooltip title="تصفير إجمالي الدخل (جعل إجمالي الدخل صفر)">
              <Button
                variant="contained"
                color="info"
                startIcon={<TrendingUp />}
                onClick={handleResetIncome}
                disabled={loading}
                fullWidth
                sx={{ py: 1.5, borderRadius: 2 }}
              >
                تصفير الدخل
              </Button>
            </Tooltip>
          </Box>
          <Box sx={{ mt: 2 }}>
            <Tooltip title="تصفير النظام بالكامل - حذف كل شيء!">
              <Button
                variant="contained"
                startIcon={<DeleteOutline />}
                onClick={handleResetEverything}
                disabled={loading}
                fullWidth
                sx={{
                  py: 1.5,
                  borderRadius: 2,
                  bgcolor: "#9c27b0",
                  "&:hover": { bgcolor: "#7b1fa2" },
                }}
              >
                تصفير النظام
              </Button>
            </Tooltip>
          </Box>
        </Paper>

      
      </Box>
    );
  };
  // ===== تبويب تقرير الوجبات =====
  // ===== تبويب تقرير الوجبات المفصل =====
  const renderMealReport = () => {
    if (mealReportLoading) {
      return (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="400px"
        >
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>جاري تحميل تقرير المنتجات...</Typography>
        </Box>
      );
    }

    return (
      <Box>
        <FilterSectionCard title="فلاتر التقرير">
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }} xs={12}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  فترة التقرير
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 2 }}>
                  <Button
                    size="small"
                    variant={mealFilters.period === "daily" ? "contained" : "outlined"}
                    onClick={() => applyMealPeriod("daily")}
                  >
                    يومي
                  </Button>
                  <Button
                    size="small"
                    variant={mealFilters.period === "weekly" ? "contained" : "outlined"}
                    onClick={() => applyMealPeriod("weekly")}
                  >
                    أسبوعي
                  </Button>
                  <Button
                    size="small"
                    variant={mealFilters.period === "monthly" ? "contained" : "outlined"}
                    onClick={() => applyMealPeriod("monthly")}
                  >
                    شهري
                  </Button>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  fullWidth
                  label="من تاريخ"
                  type="date"
                  value={mealFilters.start_date}
                  onChange={(e) =>
                    setMealFilters({
                      ...mealFilters,
                      start_date: e.target.value,
                    })
                  }
                  InputLabelProps={{ shrink: true }}
                  size="small"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <TextField
                  fullWidth
                  label="إلى تاريخ"
                  type="date"
                  value={mealFilters.end_date}
                  onChange={(e) =>
                    setMealFilters({ ...mealFilters, end_date: e.target.value })
                  }
                  InputLabelProps={{ shrink: true }}
                  size="small"
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="بحث"
                  placeholder="ابحث باسم الوجبة..."
                  value={mealFilters.search || ""}
                  onChange={(e) =>
                    setMealFilters({ ...mealFilters, search: e.target.value })
                  }
                  size="small"
                />
              </Grid>
            </Grid>

            <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", mt: 2 }}>
              <Button variant="outlined" onClick={resetMealFilters} size="small">
                إعادة تعيين
              </Button>
              <Button variant="contained" onClick={fetchMealReport} startIcon={<Refresh />} size="small">
                تطبيق الفلاتر
              </Button>
              <Button variant="outlined" color="success" onClick={exportMealReportExcel} startIcon={<Download />} size="small">
                Excel
              </Button>
              <Button variant="outlined" color="error" onClick={exportMealReportPDF} startIcon={<Print />} size="small">
                PDF
              </Button>
            </Box>
        </FilterSectionCard>

        {!mealReport ? (
          <Box sx={{ textAlign: "center", py: 5 }}>
            <RestaurantMenu
              sx={{ fontSize: 80, color: "text.disabled", mb: 2 }}
            />
            <Typography variant="h6" color="text.secondary">
              اختر نطاق زمني لعرض تقرير المنتجات
            </Typography>
          </Box>
        ) : (
          <>
            {/* بطاقات الإحصائيات */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
              <Grid size={{ xs: 12, md: 3 }}>
                <Card sx={{ boxShadow: 3, height: "100%" }}>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      إجمالي المنتجات
                    </Typography>
                    <Typography
                      variant="h3"
                      color="primary.main"
                      sx={{ fontWeight: "bold", my: 1 }}
                    >
                      {mealReport.stats?.total_meals || 0}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 3 }}>
                <Card sx={{ boxShadow: 3, height: "100%" }}>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      إجمالي التكلفة
                    </Typography>
                    <Typography
                      variant="h3"
                      color="warning.main"
                      sx={{ fontWeight: "bold", my: 1 }}
                    >
                      {formatCurrency(mealReport.stats?.total_cost_value || 0)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 3 }}>
                <Card sx={{ boxShadow: 3, height: "100%" }}>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      إجمالي المبيعات
                    </Typography>
                    <Typography
                      variant="h3"
                      color="success.main"
                      sx={{ fontWeight: "bold", my: 1 }}
                    >
                      {formatCurrency(mealReport.stats?.total_sale_value || 0)}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, md: 3 }}>
                <Card sx={{ boxShadow: 3, height: "100%" }}>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      إجمالي الأرباح
                    </Typography>
                    <Typography
                      variant="h3"
                      color="info.main"
                      sx={{ fontWeight: "bold", my: 1 }}
                    >
                      {formatCurrency(mealReport.stats?.total_profit || 0)}
                    </Typography>
                    {mealFilters.start_date && mealFilters.end_date && (
                      <Typography variant="caption" color="text.secondary">
                        الكمية المباعة في الفترة: {formatNumEn(mealReport.stats?.total_quantity_sold ?? 0)}
                      </Typography>
                    )}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* الجدول الرئيسي */}
            <Card sx={{ boxShadow: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
                  قائمة المنتجات مع المكونات
                </Typography>

                <TableContainer sx={{ maxHeight: 600 }}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>#</TableCell>
                        <TableCell>اسم المنتج</TableCell>
                        <TableCell>القسم</TableCell>
                        <TableCell>تاريخ الإنشاء</TableCell>
                        <TableCell align="center">الكمية المباعة</TableCell>
                        <TableCell align="right">تكلفة المكونات</TableCell>
                        <TableCell align="right">سعر البيع</TableCell>
                        <TableCell align="right">الربح</TableCell>
                        <TableCell>عدد المكونات</TableCell>
                        <TableCell align="center">تفاصيل</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {mealReport.meals
                        ?.slice(
                          mealsPage * rowsPerPage,
                          mealsPage * rowsPerPage + rowsPerPage,
                        )
                        .map((meal, index) => (
                          <TableRow key={meal.id} hover>
                            <TableCell>
                              {mealsPage * rowsPerPage + index + 1}
                            </TableCell>
                            <TableCell>
                              <Typography fontWeight="bold">
                                {meal.name}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {meal.code}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={meal.category}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>{meal.created_date}</TableCell>
                            <TableCell align="center">
                              <Chip
                                label={formatNumEn(meal.quantity_sold ?? 0)}
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell align="right">
                              <Typography
                                color="warning.main"
                                fontWeight="bold"
                              >
                                {formatCurrency(meal.total_ingredients_cost ?? meal.cost_price ?? 0)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography
                                color="success.main"
                                fontWeight="bold"
                              >
                                {formatCurrency(meal.sale_price)}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography
                                color={
                                  (meal.profit_amount ?? 0) > 0
                                    ? "success.main"
                                    : "error.main"
                                }
                                fontWeight="bold"
                              >
                                {formatCurrency(meal.profit_amount ?? 0)}
                                <Typography variant="caption" display="block">
                                  ({(meal.profit_margin ?? 0)}%)
                                </Typography>
                              </Typography>
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                label={meal.ingredients_count ?? 0}
                                size="small"
                                color={
                                  (meal.ingredients_count ?? 0) > 0
                                    ? "info"
                                    : "default"
                                }
                              />
                            </TableCell>
                            <TableCell align="center">
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<Description />}
                                onClick={() => {
                                  setSelectedMealForDetails(meal);
                                  setMealDetailsDialogOpen(true);
                                }}
                              >
                                تفاصيل
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>

                {/* إضافة TablePagination هنا */}
                <TablePagination
                  rowsPerPageOptions={[5, 10, 25]}
                  component="div"
                  count={mealReport.meals?.length || 0}
                  rowsPerPage={rowsPerPage}
                  page={mealsPage}
                  onPageChange={(e, p) => handleChangePage(e, p, "meals")}
                  onRowsPerPageChange={(e) =>
                    handleChangeRowsPerPage(e, "meals")
                  }
                  labelRowsPerPage="عدد العناصر في الصفحة"
                  labelDisplayedRows={({ from, to, count }) =>
                    `${from}-${to} من ${count}`
                  }
                  sx={{
                    mt: 2,
                    "& .MuiTablePagination-selectLabel": {
                      mb: 0,
                    },
                    "& .MuiTablePagination-displayedRows": {
                      mb: 0,
                    },
                  }}
                />

                {/* معلومات التقسيم */}
                {mealReport.pagination && (
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mt: 2,
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      عرض {mealReport.meals?.length || 0} من أصل{" "}
                      {mealReport.pagination.total} منتج
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </Box>
    );
  };
  // ===== تبويب الموظفين =====
  // ===== تبويب الموظفين =====
  // ===== تبويب الموظفين (نسخة مبسطة مع فلترة) =====
  const renderEmployees = () => {
    if (employeesLoading) {
      return (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="400px"
        >
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>جاري تحميل بيانات الموظفين...</Typography>
        </Box>
      );
    }

    return (
      <Box>
        <FilterSectionCard title="فلاتر الموظفين">
            <Grid container spacing={2}>
              {/* فترة التقرير */}
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  select
                  label="الفترة"
                  value={employeeFilters.period || "daily"}
                  onChange={(e) =>
                    setEmployeeFilters({
                      ...employeeFilters,
                      period: e.target.value,
                      // إعادة تعيين التواريخ إذا تم تغيير الفترة
                      start_date: "",
                      end_date: "",
                    })
                  }
                  size="small"
                >
                  <MenuItem value="daily">يومي</MenuItem>
                  <MenuItem value="weekly">أسبوعي</MenuItem>
                  <MenuItem value="monthly">شهري</MenuItem>
                  <MenuItem value="custom">مخصص</MenuItem>
                </TextField>
              </Grid>

              {/* حقول التاريخ المخصص */}
              {employeeFilters.period === "custom" && (
                <>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      label="من تاريخ"
                      type="date"
                      value={employeeFilters.start_date}
                      onChange={(e) =>
                        setEmployeeFilters({
                          ...employeeFilters,
                          start_date: e.target.value,
                        })
                      }
                      InputLabelProps={{ shrink: true }}
                      size="small"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      label="إلى تاريخ"
                      type="date"
                      value={employeeFilters.end_date}
                      onChange={(e) =>
                        setEmployeeFilters({
                          ...employeeFilters,
                          end_date: e.target.value,
                        })
                      }
                      InputLabelProps={{ shrink: true }}
                      size="small"
                    />
                  </Grid>
                </>
              )}
            </Grid>

            <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", mt: 2 }}>
              <Button variant="outlined" onClick={resetEmployeeFilters} size="small">
                إعادة تعيين
              </Button>
              <Button variant="contained" onClick={fetchEmployeesData} startIcon={<Refresh />} size="small">
                تطبيق الفلاتر
              </Button>
              <Button
                variant="outlined"
                color="success"
                onClick={() =>
                  showAppAlert("جاري تجهيز تقرير Excel...", "info", "قريباً")
                }
                startIcon={<Download />}
                size="small"
              >
                Excel
              </Button>
              <Button
                variant="outlined"
                color="error"
                onClick={() => showAppAlert("جاري تجهيز PDF...", "info", "قريباً")}
                startIcon={<Print />}
                size="small"
              >
                PDF
              </Button>
            </Box>
        </FilterSectionCard>

        {/* إحصائيات الموظفين */}
        {employeeSummary && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper elevation={0} sx={{ height: "100%", borderRadius: 2, border: "1px solid", borderColor: "divider", p: 2 }}>
                <Typography variant="body2" color="text.secondary">إجمالي الرواتب</Typography>
                <Typography variant="h5" fontWeight="bold" color="primary.main">{formatCurrency(employeeSummary.total_monthly_salaries)}</Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper elevation={0} sx={{ height: "100%", borderRadius: 2, border: "1px solid", borderColor: "divider", p: 2 }}>
                <Typography variant="body2" color="text.secondary">المبلغ المدفوع</Typography>
                <Typography variant="h5" fontWeight="bold" color="success.main">{formatCurrency(employeeSummary.total_paid_salaries)}</Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper elevation={0} sx={{ height: "100%", borderRadius: 2, border: "1px solid", borderColor: "divider", p: 2 }}>
                <Typography variant="body2" color="text.secondary">المبلغ المتبقي</Typography>
                <Typography variant="h5" fontWeight="bold" color="error.main">{formatCurrency(employeeSummary.remaining_salary_liability)}</Typography>
              </Paper>
            </Grid>
          </Grid>
        )}

        {/* جدول الموظفين */}
        <Card sx={{ boxShadow: 3 }}>
          <CardContent>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
              }}
            >
              <Typography
                variant="h6"
                sx={{ display: "flex", alignItems: "center", gap: 1 }}
              >
                <PeopleAlt /> قائمة الموظفين ({formatNumEn(employeesList.length)})
              </Typography>
            </Box>

            <TableContainer sx={{ maxHeight: 500 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>الموظف</TableCell>
                    <TableCell>رقم الجوال</TableCell>
                    <TableCell>القسم</TableCell>
                    <TableCell align="right">الراتب الشهري</TableCell>
                    <TableCell align="right">المبلغ المدفوع</TableCell>
                    <TableCell align="right">المبلغ المتبقي</TableCell>
                    <TableCell align="center">تاريخ آخر استلام</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {employeesList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} align="center" sx={{ py: 5 }}>
                        <People
                          sx={{ fontSize: 60, color: "text.disabled", mb: 2 }}
                        />
                        <Typography variant="body1" color="text.secondary">
                          لا يوجد موظفين لعرضهم
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    employeesList
                      .slice(
                        employeesPage * rowsPerPage,
                        employeesPage * rowsPerPage + rowsPerPage,
                      )
                      .map((employee, index) => (
                        <TableRow key={employee.id || index} hover>
                          <TableCell>
                            {formatNumEn(employeesPage * rowsPerPage + index + 1)}
                          </TableCell>
                          <TableCell>
                            <Box>
                              <Typography fontWeight="bold">
                                {employee.name}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {employee.phone || "لا يوجد رقم"}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={employee.shift || "غير محدد"}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Typography fontWeight="bold" color="primary.main">
                              {formatCurrency(employee.monthly_salary)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography color="success.main">
                              {formatCurrency(employee.total_paid || 0)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography
                              color={
                                (employee.remaining_due || 0) > 0
                                  ? "error.main"
                                  : "success.main"
                              }
                              fontWeight="bold"
                            >
                              {formatCurrency(employee.remaining_due || 0)}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            {employee.last_payment_date ? (
                              <Box>
                                <Typography variant="body2">
                                  {new Date(
                                    employee.last_payment_date,
                                  ).toLocaleDateString("ar-EG")}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {new Date(
                                    employee.last_payment_date,
                                  ).toLocaleTimeString("ar-EG")}
                                </Typography>
                              </Box>
                            ) : (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                لم يستلم بعد
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            {/* TablePagination خارج TableContainer */}
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={employeesList.length}
              rowsPerPage={rowsPerPage}
              page={employeesPage}
              onPageChange={(e, p) => handleChangePage(e, p, "employees")}
              onRowsPerPageChange={(e) =>
                handleChangeRowsPerPage(e, "employees")
              }
              labelRowsPerPage="عدد العناصر في الصفحة"
              labelDisplayedRows={({ from, to, count }) =>
                `${from}-${to} من ${count}`
              }
              sx={{
                mt: 2,
                "& .MuiTablePagination-selectLabel": {
                  mb: 0,
                },
                "& .MuiTablePagination-displayedRows": {
                  mb: 0,
                },
              }}
            />
          </CardContent>
        </Card>

        {/* نافذة تفاصيل الراتب */}
        <Dialog
          open={salaryDetailsDialog}
          onClose={() => setSalaryDetailsDialog(false)}
          maxWidth="sm"
          fullWidth
        >
          {selectedEmployee && (
            <>
              <DialogTitle>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Person color="primary" />
                  <Typography variant="h6">
                    تفاصيل راتب {selectedEmployee.name}
                  </Typography>
                </Box>
              </DialogTitle>
              <DialogContent dividers>
                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <Paper sx={{ p: 2, textAlign: "center" }}>
                      <Typography variant="body2" color="text.secondary">
                        الراتب الشهري
                      </Typography>
                      <Typography
                        variant="h5"
                        color="primary.main"
                        fontWeight="bold"
                      >
                        {formatCurrency(selectedEmployee.monthly_salary)}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={6}>
                    <Paper sx={{ p: 2, textAlign: "center" }}>
                      <Typography variant="body2" color="text.secondary">
                        المبلغ المدفوع
                      </Typography>
                      <Typography
                        variant="h5"
                        color="success.main"
                        fontWeight="bold"
                      >
                        {formatCurrency(selectedEmployee.total_paid || 0)}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid item xs={12}>
                    <Paper sx={{ p: 2, textAlign: "center", bgcolor: "transparent", border: "1px solid", borderColor: "divider" }}>
                      <Typography variant="body2" color="text.secondary">
                        المبلغ المتبقي
                      </Typography>
                      <Typography
                        variant="h4"
                        color={
                          (selectedEmployee.remaining_due || 0) > 0
                            ? "error.main"
                            : "success.main"
                        }
                        fontWeight="bold"
                      >
                        {formatCurrency(selectedEmployee.remaining_due || 0)}
                      </Typography>
                    </Paper>
                  </Grid>

                  <Grid item xs={12}>
                    <Typography variant="subtitle2" gutterBottom sx={{ mt: 1 }}>
                      سجل المدفوعات السابقة
                    </Typography>
                    {selectedEmployee.payment_history &&
                    selectedEmployee.payment_history.length > 0 ? (
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>التاريخ</TableCell>
                              <TableCell align="right">المبلغ</TableCell>
                              <TableCell>ملاحظات</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {selectedEmployee.payment_history.map(
                              (payment, idx) => (
                                <TableRow key={idx}>
                                  <TableCell>
                                    {new Date(payment.date).toLocaleDateString(
                                      "ar-EG",
                                    )}
                                  </TableCell>
                                  <TableCell align="right">
                                    {formatCurrency(payment.amount)}
                                  </TableCell>
                                  <TableCell>{payment.notes || "-"}</TableCell>
                                </TableRow>
                              ),
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    ) : (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        align="center"
                        sx={{ py: 2 }}
                      >
                        لا يوجد سجل مدفوعات سابقة
                      </Typography>
                    )}
                  </Grid>
                </Grid>
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={() => setSalaryDetailsDialog(false)}
                  variant="outlined"
                >
                  إغلاق
                </Button>
                {!selectedEmployee.is_salary_paid && (
                  <Button
                    variant="contained"
                    color="success"
                    startIcon={<Payment />}
                    onClick={() => handlePaySalary(selectedEmployee.id)}
                  >
                    دفع الراتب
                  </Button>
                )}
              </DialogActions>
            </>
          )}
        </Dialog>
      </Box>
    );
  };

  // ===== تبويب المشتريات (تقرير مفصّل) =====
  const renderExpenses = () => {
    if (purchasesReportLoading) {
      return (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="400px"
        >
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>جاري تحميل تقرير المشتريات...</Typography>
        </Box>
      );
    }

    if (!purchasesReport) {
      return (
        <Box sx={{ textAlign: "center", py: 5 }}>
          <ShoppingCart sx={{ fontSize: 80, color: "text.disabled", mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            اختر فترة لعرض تقرير المشتريات
          </Typography>
          <Button
            variant="contained"
            sx={{ mt: 2 }}
            onClick={() => fetchPurchasesDetailedReport()}
          >
            عرض مشتريات اليوم
          </Button>
        </Box>
      );
    }

    const { stats, purchases, analysis } = purchasesReport;

    return (
      <Box>
        <FilterSectionCard title="فلاتر تقرير المشتريات">
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }} xs={12} md={3}>
                <TextField
                  fullWidth
                  select
                  label="الفترة"
                  value={purchasesFilters.period}
                  onChange={(e) =>
                    setPurchasesFilters({
                      ...purchasesFilters,
                      period: e.target.value,
                    })
                  }
                  size="small"
                >
                  <MenuItem value="daily">يومي</MenuItem>
                  <MenuItem value="weekly">أسبوعي</MenuItem>
                  <MenuItem value="monthly">شهري</MenuItem>
                  <MenuItem value="custom">مخصص</MenuItem>
                </TextField>
              </Grid>

              {purchasesFilters.period === "custom" && (
                <>
                  <Grid size={{ xs: 12, md: 4 }} xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="من تاريخ"
                      type="date"
                      value={purchasesFilters.start_date}
                      onChange={(e) =>
                        setPurchasesFilters({
                          ...purchasesFilters,
                          start_date: e.target.value,
                        })
                      }
                      InputLabelProps={{ shrink: true }}
                      size="small"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }} xs={12} md={3}>
                    <TextField
                      fullWidth
                      label="إلى تاريخ"
                      type="date"
                      value={purchasesFilters.end_date}
                      onChange={(e) =>
                        setPurchasesFilters({
                          ...purchasesFilters,
                          end_date: e.target.value,
                        })
                      }
                      InputLabelProps={{ shrink: true }}
                      size="small"
                    />
                  </Grid>
                </>
              )}
            </Grid>

            <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", mt: 2 }}>
              <Button variant="outlined" onClick={resetPurchasesFilters} size="small">
                إعادة تعيين
              </Button>
              <Button variant="contained" onClick={fetchPurchasesDetailedReport} startIcon={<Refresh />} size="small">
                تطبيق الفلاتر
              </Button>
            </Box>
        </FilterSectionCard>

        {/* بطاقات الإحصائيات */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ boxShadow: 3, height: "100%" }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  عدد المشتريات
                </Typography>
                <Typography
                  variant="h3"
                  color="primary"
                  sx={{ fontWeight: "bold", mb: 1 }}
                >
                  {formatNumEn(stats.summary.total_purchases)}
                </Typography>
                <Typography variant="caption">
                  {formatNumEn(stats.period.days)} يوم
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ boxShadow: 3, height: "100%" }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  إجمالي المشتريات
                </Typography>
                <Typography
                  variant="h3"
                  color="error.main"
                  sx={{ fontWeight: "bold", my: 1 }}
                >
                  {formatCurrency(stats.summary.total_amount)}
                </Typography>
                <Typography variant="caption">
                  {formatNumEn(stats.summary.total_items)} عنصر
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ boxShadow: 3, height: "100%" }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  متوسط قيمة الشراء
                </Typography>
                <Typography
                  variant="h3"
                  color="info.main"
                  sx={{ fontWeight: "bold", my: 1 }}
                >
                  {formatCurrency(stats.summary.average_purchase)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* الجدول الرئيسي */}
        <Card sx={{ boxShadow: 3, mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
              تفاصيل المشتريات ({formatNumEn(purchases.length)})
            </Typography>

            <TableContainer sx={{ maxHeight: 500 }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>#</TableCell>
                    <TableCell>رقم المعاملة</TableCell>
                    <TableCell>التاريخ</TableCell>
                    <TableCell>الوقت</TableCell>
                    <TableCell align="right">المبلغ</TableCell>
                    <TableCell align="center">عدد العناصر</TableCell>
                    <TableCell>طريقة الدفع</TableCell>
                    <TableCell>التفاصيل</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {purchases
                    .slice(
                      purchasesPage * rowsPerPage,
                      purchasesPage * rowsPerPage + rowsPerPage,
                    )
                    .map((purchase, index) => (
                      <TableRow key={purchase.id} hover>
                        <TableCell>
                          {purchasesPage * rowsPerPage + index + 1}
                        </TableCell>
                        <TableCell>
                          <Typography fontWeight="bold" color="error.main">
                            {purchase.transaction_number}
                          </Typography>
                        </TableCell>
                        <TableCell>{purchase.date}</TableCell>
                        <TableCell> {purchase.time}</TableCell>
                        <TableCell align="right">
                          <Typography fontWeight="bold" color="error.main">
                            {formatCurrency(purchase.amount)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip label={formatNumEn(purchase.items_count)} color="primary" size="small" />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={
                              purchase.payment_method === "cash"
                                ? "كاش"
                                : purchase.payment_method === "app"
                                  ? "تطبيق"
                                  : purchase.payment_method === "card"
                                    ? "بطاقة"
                                    : purchase.payment_method === "bank_transfer"
                                      ? "تحويل"
                                      : purchase.payment_method === "credit"
                                        ? "أجل"
                                        : purchase.payment_method === "check"
                                          ? "شيك"
                                          : purchase.payment_method || "—"
                            }
                            size="small"
                            sx={{
                              bgcolor:
                                purchase.payment_method === "cash"
                                  ? "success.light"
                                  : purchase.payment_method === "app"
                                    ? "info.light"
                                    : "grey.200",
                              fontWeight: 600,
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleOpenPurchaseDetails(purchase)}
                          >
                            <Description fontSize="small" />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* إضافة TablePagination هنا */}
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={purchases.length}
              rowsPerPage={rowsPerPage}
              page={purchasesPage}
              onPageChange={(e, p) => handleChangePage(e, p, "purchases")}
              onRowsPerPageChange={(e) =>
                handleChangeRowsPerPage(e, "purchases")
              }
              labelRowsPerPage="عدد العناصر في الصفحة"
              labelDisplayedRows={({ from, to, count }) =>
                `${from}-${to} من ${count}`
              }
              sx={{
                mt: 2,
                "& .MuiTablePagination-selectLabel": {
                  mb: 0,
                },
                "& .MuiTablePagination-displayedRows": {
                  mb: 0,
                },
              }}
            />
          </CardContent>
        </Card>

        {/* أكثر الأقسام شراءً */}
        {analysis.top_categories && analysis.top_categories.length > 0 && (
          <Card sx={{ boxShadow: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                الأكثر شراءً
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>القسم</TableCell>
                      <TableCell align="center">عدد مرات الشراء</TableCell>
                      <TableCell align="center">الكمية المشتراة</TableCell>
                      <TableCell align="right">إجمالي التكلفة</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analysis.top_categories.map((category, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <Typography fontWeight="bold">
                            {category.category_name}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          {category.purchases_count}
                        </TableCell>
                        <TableCell align="center">
                          {category.total_quantity}
                        </TableCell>
                        <TableCell align="right">
                          <Typography color="error.main">
                            {formatCurrency(category.total_cost)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        )}

        {/* نافذة تفاصيل الشراء */}
        <Dialog
          open={purchasesDetailsDialog}
          onClose={() => setPurchasesDetailsDialog(false)}
          maxWidth="md"
          fullWidth
        >
          {selectedPurchase && (
            <>
              <DialogTitle>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <ShoppingCart color="error" />
                  <Typography variant="h6">
                    تفاصيل الشراء #{selectedPurchase.transaction_number}
                  </Typography>
                </Box>
              </DialogTitle>
              <DialogContent dividers>
                {/* معلومات أساسية */}
                <Paper sx={{ p: 2, mb: 3 }}>
                  <Grid container spacing={2} alignItems="center">
                    {/* التاريخ */}
                    <Grid size={{ xs: 4 }} xs={4}>
                      <Typography variant="body2" color="text.secondary">
                        التاريخ
                      </Typography>
                      <Box
                        sx={{ display: "flex", alignItems: "baseline", gap: 1 }}
                      >
                        <Typography variant="body1" fontWeight="bold">
                          {selectedPurchase.date}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {selectedPurchase.time}
                        </Typography>
                      </Box>
                    </Grid>

                    {/* إجمالي المبلغ */}
                    <Grid size={{ xs: 4 }} xs={4}>
                      <Typography variant="body2" color="text.secondary">
                        إجمالي المبلغ
                      </Typography>
                      <Typography
                        variant="h6"
                        color="error.main"
                        fontWeight="bold"
                      >
                        {formatCurrency(selectedPurchase.amount)}
                      </Typography>
                    </Grid>

                    {/* عدد العناصر */}
                    <Grid size={{ xs: 4 }} xs={4}>
                      <Typography variant="body2" color="text.secondary">
                        عدد العناصر
                      </Typography>
                      <Typography
                        variant="h6"
                        color="primary.main"
                        fontWeight="bold"
                      >
                        {selectedPurchase.items_count}
                      </Typography>
                    </Grid>

                    {/* طريقة الدفع */}
                    <Grid size={{ xs: 12 }} xs={12} sx={{ mt: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        طريقة الدفع
                      </Typography>
                      <Chip
                        size="small"
                        label={
                          selectedPurchase.payment_method === "cash"
                            ? "كاش"
                            : selectedPurchase.payment_method === "app"
                              ? "تطبيق"
                              : selectedPurchase.payment_method === "card"
                                ? "بطاقة"
                                : selectedPurchase.payment_method === "bank_transfer"
                                  ? "تحويل"
                                  : selectedPurchase.payment_method === "credit"
                                    ? "أجل"
                                    : selectedPurchase.payment_method === "check"
                                      ? "شيك"
                                      : selectedPurchase.payment_method || "—"
                        }
                        sx={{
                          bgcolor:
                            selectedPurchase.payment_method === "cash"
                              ? "success.light"
                              : selectedPurchase.payment_method === "app"
                                ? "info.light"
                                : "grey.200",
                          fontWeight: 600,
                        }}
                      />
                    </Grid>
                  </Grid>
                </Paper>

                {/* قائمة العناصر المشتراة */}
                <Typography variant="h6" gutterBottom>
                  العناصر المشتراة ({selectedPurchase.items_count})
                </Typography>

                <TableContainer component={Paper} sx={{ maxHeight: 400 }}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        <TableCell>#</TableCell>
                        <TableCell>الاسم</TableCell>
                        <TableCell align="center">الكمية</TableCell>
                        <TableCell align="right">سعر الوحدة</TableCell>
                        <TableCell align="right">الإجمالي</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {selectedPurchase.items.map((item, index) => (
                        <TableRow key={index} hover>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            <Typography fontWeight="bold">
                              {item.category_name}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">{item.quantity}</TableCell>
                          <TableCell align="right">
                            {formatCurrency(item.cost_price)}
                          </TableCell>
                          <TableCell align="right">
                            <Typography fontWeight="bold" color="error.main">
                              {formatCurrency(item.total_cost)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </DialogContent>
              <DialogActions>
                <Button
                  onClick={() => setPurchasesDetailsDialog(false)}
                  variant="outlined"
                >
                  إغلاق
                </Button>
              </DialogActions>
            </>
          )}
        </Dialog>
      </Box>
    );
  };

  // ===== تبويب المبيعات =====
  // ===== تبويب المبيعات =====
  // ===== تبويب المبيعات (تقرير مفصّل) =====
  const renderSales = () => {
    if (salesReportLoading) {
      return (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="400px"
        >
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>جاري تحميل تقرير المبيعات...</Typography>
        </Box>
      );
    }

    if (!salesReport) {
      return (
        <Box sx={{ textAlign: "center", py: 5 }}>
          <TrendingUp sx={{ fontSize: 80, color: "text.disabled", mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            اختر فترة لعرض تقرير المبيعات
          </Typography>
          <Button
            variant="contained"
            sx={{ mt: 2 }}
            onClick={() => fetchSalesDetailedReport()}
          >
            عرض تقرير اليوم
          </Button>
        </Box>
      );
    }

    const { stats, orders, analysis } = salesReport;

    return (
      <Box>
        <FilterSectionCard title="فلاتر تقرير المبيعات">
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  select
                  label="الفترة"
                  value={salesFilters.period}
                  onChange={(e) =>
                    setSalesFilters({ ...salesFilters, period: e.target.value })
                  }
                  size="small"
                >
                  <MenuItem value="daily">يومي</MenuItem>
                  <MenuItem value="weekly">أسبوعي</MenuItem>
                  <MenuItem value="monthly">شهري</MenuItem>
                  <MenuItem value="custom">مخصص</MenuItem>
                </TextField>
              </Grid>

              {salesFilters.period === "custom" && (
                <>
                  <Grid size={{ xs: 12, md: 4 }} xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="من تاريخ"
                      type="date"
                      value={salesFilters.start_date}
                      onChange={(e) =>
                        setSalesFilters({
                          ...salesFilters,
                          start_date: e.target.value,
                        })
                      }
                      InputLabelProps={{ shrink: true }}
                      size="small"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      label="إلى تاريخ"
                      type="date"
                      value={salesFilters.end_date}
                      onChange={(e) =>
                        setSalesFilters({
                          ...salesFilters,
                          end_date: e.target.value,
                        })
                      }
                      InputLabelProps={{ shrink: true }}
                      size="small"
                    />
                  </Grid>
                </>
              )}
            </Grid>

            <Box
              sx={{
                display: "flex",
                gap: 1,
                justifyContent: "flex-end",
                mt: 2,
              }}
            >
              <Button
                variant="outlined"
                onClick={resetSalesFilters}
                size="small"
              >
                إعادة تعيين
              </Button>
              <Button
                variant="contained"
                onClick={fetchSalesDetailedReport}
                startIcon={<Refresh />}
                size="small"
              >
                تطبيق الفلاتر
              </Button>
              <Button
                variant="outlined"
                color="success"
                onClick={() => exportSalesReport("excel")}
                startIcon={<Download />}
                size="small"
              >
                Excel
              </Button>
              <Button
                variant="outlined"
                color="error"
                onClick={() => exportSalesReport("pdf")}
                startIcon={<Print />}
                size="small"
              >
                PDF
              </Button>
            </Box>
        </FilterSectionCard>

        {/* بطاقات الإحصائيات */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ boxShadow: 3, height: "100%" }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  إجمالي المبيعات
                </Typography>
                <Typography
                  variant="h3"
                  color="success.main"
                  sx={{ fontWeight: "bold", my: 1 }}
                >
                  {formatCurrency(stats.summary.total_sales)}
                </Typography>
                <Typography variant="caption">
                  {stats.period.days} يوم • {stats.summary.total_orders} طلب
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ boxShadow: 3, height: "100%" }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  إجمالي الأرباح
                </Typography>
                <Typography
                  variant="h3"
                  color="warning.main"
                  sx={{ fontWeight: "bold", my: 1 }}
                >
                  {formatCurrency(stats.summary.total_profit)}
                </Typography>
                <Typography variant="caption">
                  هامش ربح {stats.summary.profit_margin}%
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Card sx={{ boxShadow: 3, height: "100%" }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  متوسط قيمة الطلب
                </Typography>
                <Typography
                  variant="h3"
                  color="info.main"
                  sx={{ fontWeight: "bold", my: 1 }}
                >
                  {formatCurrency(stats.summary.average_order_value)}
                </Typography>
                <Typography variant="caption">
                  ربح متوسط{" "}
                  {formatCurrency(stats.summary.average_profit_per_order)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* الجدول الرئيسي */}
        <Card sx={{ boxShadow: 3, mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
              تفاصيل الطلبات ({formatNumEn(orders.length)})
            </Typography>

            <TableContainer sx={{ maxHeight: 500 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "primary.dark", "& .MuiTableCell-head": { color: "white", fontWeight: "bold" } }}>
                    <TableCell>#</TableCell>
                    <TableCell>التاريخ</TableCell>
                    <TableCell align="center">طريقة الدفع</TableCell>
                    <TableCell align="right">المبلغ</TableCell>
                    <TableCell align="right">التكلفة</TableCell>
                    <TableCell align="right">الربح</TableCell>
                    <TableCell align="center">العناصر</TableCell>
                    <TableCell align="center"></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {orders
                    .slice(
                      ordersPage * rowsPerPage,
                      ordersPage * rowsPerPage + rowsPerPage,
                    )
                    .map((order, index) => (
                      <TableRow key={order.id} hover sx={{ "&:nth-of-type(even)": { bgcolor: "action.hover" } }}>
                        <TableCell>{formatNumEn(ordersPage * rowsPerPage + index + 1)}</TableCell>

                        <TableCell>
                          {order.date}
                          <Typography
                            variant="caption"
                            display="block"
                            color="text.secondary"
                          >
                            {order.time}
                          </Typography>
                        </TableCell>

                        <TableCell align="center">
                          <Chip
                            size="small"
                            label={
                              order.payment_method === "cash"
                                ? "كاش"
                                : order.payment_method === "app"
                                  ? "تطبيق"
                                  : order.payment_method === "card"
                                    ? "بطاقة"
                                    : order.payment_method || "—"
                            }
                            sx={{
                              bgcolor: order.payment_method === "cash" ? "success.light" : order.payment_method === "app" ? "info.light" : "grey.200",
                              fontWeight: 600,
                            }}
                          />
                        </TableCell>

                        <TableCell align="right">
                          <Typography fontWeight="bold">
                            {formatCurrency(order.total)}
                          </Typography>
                        </TableCell>

                        <TableCell align="right">
                          <Typography color="warning.main">
                            {formatCurrency(order.total_cost)}
                          </Typography>
                        </TableCell>

                        <TableCell align="right">
                          <Typography color="success.main" fontWeight="bold">
                            {formatCurrency(order.total_profit)}
                          </Typography>
                          <Typography variant="caption">
                            {order.profit_margin}%
                          </Typography>
                        </TableCell>

                        <TableCell align="center">
                          <Chip
                            label={formatNumEn(order.items_count)}
                            size="small"
                            color="primary"
                          />
                        </TableCell>

                        <TableCell align="center">
                          <Tooltip title="عرض التفاصيل والمكونات">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => handleOpenOrderDetails(order)}
                            >
                              <Description fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>

            {/* إضافة TablePagination هنا */}
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={orders.length}
              rowsPerPage={rowsPerPage}
              page={ordersPage}
              onPageChange={(e, p) => handleChangePage(e, p, "orders")}
              onRowsPerPageChange={(e) => handleChangeRowsPerPage(e, "orders")}
              labelRowsPerPage="عدد العناصر في الصفحة"
              labelDisplayedRows={({ from, to, count }) =>
                `${from}-${to} من ${count}`
              }
              sx={{
                mt: 2,
                "& .MuiTablePagination-selectLabel": {
                  mb: 0,
                },
                "& .MuiTablePagination-displayedRows": {
                  mb: 0,
                },
              }}
            />
          </CardContent>
        </Card>

        {/* تحليلات إضافية */}
        <Grid container spacing={3}>
          {/* أفضل المنتجات */}
          <Grid size={{ xs: 12, md: 6 }} xs={12} md={6}>
            <Card sx={{ boxShadow: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  أفضل العناصر مبيعاً
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>العنصر</TableCell>
                        <TableCell align="center">النوع</TableCell>
                        <TableCell align="center">الكمية</TableCell>
                        <TableCell align="right">الإيرادات</TableCell>
                        <TableCell align="right">الربح</TableCell>
                        <TableCell align="center">الخيارات</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {analysis.top_items.slice(0, 10).map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Typography fontWeight="bold">
                              {item.name}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={item.type === "meal" ? "وجبة" : "منتج"}
                              color={item.type === "meal" ? "info" : "default"}
                              size="small"
                            />
                          </TableCell>
                          <TableCell align="center">
                            {item.total_quantity}
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(item.total_revenue)}
                          </TableCell>
                          <TableCell align="right">
                            <Typography color="success.main">
                              {formatCurrency(item.total_profit)}
                            </Typography>
                          </TableCell>
                          <TableCell align="center">
                            {item.has_options ? (
                              <Chip
                                label="مع خيارات"
                                size="small"
                                color="warning"
                                variant="outlined"
                              />
                            ) : (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                -
                              </Typography>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* أفضل العملاء */}
          <Grid size={{ xs: 12, md: 6 }} xs={12} md={6}>
            <Card sx={{ boxShadow: 3 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  أفضل العملاء
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>العميل</TableCell>
                        <TableCell align="center">الطلبات</TableCell>
                        <TableCell align="right">المشتريات</TableCell>
                        <TableCell align="right">المدفوع</TableCell>
                        <TableCell align="right">المتبقي</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {analysis.top_customers.map((customer, index) => (
                        <TableRow key={index}>
                          <TableCell>{customer.customer_name}</TableCell>
                          <TableCell align="center">
                            {customer.orders_count}
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(customer.total_spent)}
                          </TableCell>
                          <TableCell align="right">
                            {formatCurrency(customer.total_paid)}
                          </TableCell>
                          <TableCell align="right">
                            <Typography color="error.main">
                              {formatCurrency(customer.total_due)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    );
  };

  return (
    <Box sx={{ p: 3, bgcolor: "transparent" }}>
      {/* العنوان الرئيسي */}
      <Box
        sx={{
          mb: 4,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box>
          <Typography
            variant="h4"
            sx={{
              color: "#1976d2",
              display: "flex",
              alignItems: "center",
              gap: 2,
              mb: 1,
            }}
          >
            <AccountBalance fontSize="large" />
            ادارة المعلومات{" "}
          </Typography>
          <Typography variant="body1" color="text.secondary">
            ادارة واشراف لكل مطعم بلال
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Refresh sx={{ ml: 1 }} />}
            onClick={fetchTreasuryData}
          >
            تحديث
          </Button>
        </Box>
      </Box>
      {/* رسائل التنبيه */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert
          severity="success"
          sx={{ mb: 3 }}
          onClose={() => setSuccess(null)}
        >
          {success}
        </Alert>
      )}
      {/* التبويبات */}
      <Paper sx={{ p: 2, mb: 3, boxShadow: 2, bgcolor: "transparent" }}>
        <Tabs value={activeTab} onChange={handleTabChange} variant="fullWidth">
          <Tab label="الملخص" icon={<Dashboard />} iconPosition="start" />
          <Tab label="الموظفين" icon={<People />} iconPosition="start" />
          <Tab label="المشتريات" icon={<ShoppingCart />} iconPosition="start" />
          <Tab
            label="المبيعات"
            icon={<TrendingUp />}
            iconPosition="start"
          />{" "}
          <Tab label="المنتجات" icon={<RestaurantMenu />} iconPosition="start" />
          {/* 👈 أضف هذا */}
        </Tabs>
      </Paper>
      {/* المحتوى */}
      {loading ? (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="200px"
        >
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>جاري تحميل البيانات...</Typography>
        </Box>
      ) : (
        renderTabContent()
      )}
      {/* دايالوج إيداع المبلغ */}
      <Dialog
        open={depositDialogOpen}
        onClose={() => setDepositDialogOpen(false)}
      >
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Add color="primary" />
            إيداع مبلغ في الخزنة
          </Box>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="المبلغ"
            type="number"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            margin="normal"
            inputProps={{ min: 0.01, step: 0.01 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">شيكل</InputAdornment>
              ),
            }}
            required
          />
          <TextField
            fullWidth
            label="ملاحظات (اختياري)"
            multiline
            rows={3}
            value={depositNotes}
            onChange={(e) => setDepositNotes(e.target.value)}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDepositDialogOpen(false)}>إلغاء</Button>
          <Button
            onClick={handleDeposit}
            variant="contained"
            color="primary"
            disabled={!depositAmount || parseFloat(depositAmount) <= 0}
          >
            تأكيد الإيداع
          </Button>
        </DialogActions>
      </Dialog>
      {/* دايالوج تأكيد تصفير الخزنة */}
      <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)}>
        <DialogTitle>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              color: "error.main",
            }}
          >
            <Warning />
            تأكيد تصفير الخزنة
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body1" fontWeight="bold">
              ⚠️ تحذير: هذا الإجراء لا يمكن التراجع عنه!
            </Typography>
          </Alert>

          <Typography variant="body1" paragraph>
            أنت على وشك تصفير الخزنة وإرجاع الرصيد الحالي إلى الصفر.
          </Typography>

          <Card sx={{ bgcolor: "transparent", p: 2, mb: 2, border: "1px solid", borderColor: "warning.main" }}>
            <Typography variant="h6" align="center" color="error">
              الرصيد الحالي:{" "}
              {formatCurrency(treasuryData?.treasury?.balance || 0)}
            </Typography>
          </Card>

          <Typography variant="body2" color="text.secondary">
            ملاحظة: سيتم الاحتفاظ بجميع السجلات التاريخية للمعاملات.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetDialogOpen(false)} variant="outlined">
            إلغاء
          </Button>
          <Button
            onClick={handleResetTreasury}
            variant="contained"
            color="error"
            startIcon={<DeleteOutline />}
          >
            تأكيد التصفير
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={orderDetailsDialog}
        onClose={() => setOrderDetailsDialog(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedOrder && (
          <>
            <DialogTitle>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Receipt color="primary" />
                <Typography variant="h6">
                  تفاصيل الطلب #{selectedOrder.order_number}
                </Typography>
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              {/* معلومات أساسية عن الطلب */}
              <Paper sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" color="text.secondary">
                      التاريخ
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {selectedOrder.date}
                    </Typography>
                    <Typography variant="caption">
                      {selectedOrder.time}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" color="text.secondary">
                      العميل
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {selectedOrder.customer}
                    </Typography>
                    {selectedOrder.customer_phone && (
                      <Typography variant="caption">
                        {selectedOrder.customer_phone}
                      </Typography>
                    )}
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" color="text.secondary">
                      الموظف
                    </Typography>
                    <Typography variant="body1" fontWeight="bold">
                      {selectedOrder.employee}
                    </Typography>
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Typography variant="body2" color="text.secondary">
                      طريقة الدفع
                    </Typography>
                    <Chip
                      label={
                        selectedOrder.payment_method === "cash"
                          ? "كاش"
                          : selectedOrder.payment_method === "app"
                            ? "تطبيق"
                            : selectedOrder.payment_method === "card"
                              ? "بطاقة"
                              : selectedOrder.payment_method || "—"
                      }
                      size="small"
                      color="primary"
                    />
                  </Grid>
                </Grid>
              </Paper>

              {/* قائمة العناصر */}
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                العناصر المباعة ({formatNumEn(selectedOrder.items_count)})
              </Typography>

              <TableContainer component={Paper} sx={{ maxHeight: 520 }} elevation={0}>
                <Table stickyHeader size="small" sx={{ "& .MuiTableCell-root": { py: 1 } }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: "primary.main" }}>
                      <TableCell sx={{ color: "white", fontWeight: "bold", width: 40 }}>#</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>الاسم</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>القسم</TableCell>
                      <TableCell align="center" sx={{ color: "white", fontWeight: "bold", width: 56 }}>الكمية</TableCell>
                      <TableCell align="right" sx={{ color: "white", fontWeight: "bold" }}>كلف</TableCell>
                      <TableCell align="right" sx={{ color: "white", fontWeight: "bold" }}>بيع</TableCell>
                      <TableCell align="right" sx={{ color: "white", fontWeight: "bold" }}>ربح</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>الخيارات</TableCell>
                      <TableCell sx={{ color: "white", fontWeight: "bold" }}>المكونات</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedOrder.items.map((item, index) => {
                      const costFromIngredients = item.ingredients?.length
                        ? item.ingredients.reduce((sum, ing) => sum + Number(ing.total_cost || 0), 0)
                        : 0;
                      const cost = (Number(item.total_cost) > 0)
                        ? Number(item.total_cost)
                        : (costFromIngredients > 0 ? costFromIngredients : (Number(item.unit_cost || 0) * Number(item.quantity || 0)));
                      const sell = item.total_price ?? (Number(item.unit_price || 0) * Number(item.quantity || 0));
                      const profit = item.total_profit ?? (sell - cost);
                      return (
                      <React.Fragment key={index}>
                        <TableRow hover sx={{ "&:nth-of-type(4n+2)": { bgcolor: "action.hover" } }}>
                          <TableCell>{formatNumEn(index + 1)}</TableCell>
                          <TableCell>
                            <Typography fontWeight="bold" variant="body2">
                              {item.name || "غير معروف"}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={item.category || "—"} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell align="center">{formatNumEn(item.quantity)}</TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color="warning.main">
                              {formatCurrency(cost)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography fontWeight="bold" variant="body2">
                              {formatCurrency(sell)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Typography variant="body2" color="success.main" fontWeight="bold">
                              {formatCurrency(profit)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {item.options && item.options.length > 0 ? (
                              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                                {item.options.map((opt, i) => (
                                  <Chip key={i} label={`${opt.name} +${formatCurrency(opt.price)}`} size="small" color="warning" sx={{ fontSize: "0.7rem", height: 22 }} />
                                ))}
                              </Box>
                            ) : (
                              <Typography variant="caption" color="text.secondary">—</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {item.ingredients && item.ingredients.length > 0 ? (
                              <Typography variant="caption" color="info.main" fontWeight="medium">
                                {formatNumEn(item.ingredients.length)} مكون
                              </Typography>
                            ) : (
                              <Typography variant="caption" color="text.secondary">—</Typography>
                            )}
                          </TableCell>
                        </TableRow>
                        {/* صف المكونات: جدول منظم */}
                        {item.ingredients && item.ingredients.length > 0 && (
                          <TableRow sx={{ bgcolor: "action.hover" }}>
                            <TableCell colSpan={9} sx={{ py: 1.5, borderBottom: "1px solid", borderColor: "divider", verticalAlign: "top" }}>
                              <Typography variant="caption" fontWeight="bold" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                                المكونات المستخدمة:
                              </Typography>
                              <Table size="small" sx={{ "& .MuiTableCell-root": { py: 0.5, px: 1, borderColor: "divider" } }}>
                                <TableHead>
                                  <TableRow>
                                    <TableCell sx={{ fontWeight: "bold", width: "40%" }}>المكون</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: "bold", width: "20%" }}>الكمية</TableCell>
                                    <TableCell sx={{ fontWeight: "bold", width: "15%" }}>الوحدة</TableCell>
                                    <TableCell align="right" sx={{ fontWeight: "bold" }}>التكلفة</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {item.ingredients.map((ing, i) => (
                                    <TableRow key={i}>
                                      <TableCell>{ing.name}</TableCell>
                                      <TableCell align="center">{formatNumEn(ing.quantity_used)}</TableCell>
                                      <TableCell>{ing.unit || "وحدة"}</TableCell>
                                      <TableCell align="right">{formatCurrency(ing.total_cost)}</TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );})}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* ملخص الطلب: كلف • بيع • ربح */}
              <Paper sx={{ p: 2, mt: 2, bgcolor: "transparent", border: "1px solid", borderColor: "divider" }}>
                <Grid container spacing={3}>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary">إجمالي التكلفة</Typography>
                    <Typography variant="h6" color="warning.main">{formatCurrency(selectedOrder.total_cost)}</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary">إجمالي البيع</Typography>
                    <Typography variant="h6" fontWeight="bold">{formatCurrency(selectedOrder.total)}</Typography>
                  </Grid>
                  <Grid item xs={4}>
                    <Typography variant="body2" color="text.secondary">إجمالي الربح</Typography>
                    <Typography variant="h6" color="success.main" fontWeight="bold">{formatCurrency(selectedOrder.total_profit)}</Typography>
                  </Grid>
                </Grid>
              </Paper>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => setOrderDetailsDialog(false)}
                variant="outlined"
              >
                إغلاق
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* نافذة تفاصيل المنتج (من تبويب المنتجات) */}
      <Dialog
        open={mealDetailsDialogOpen}
        onClose={() => { setMealDetailsDialogOpen(false); setSelectedMealForDetails(null); }}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        {selectedMealForDetails && (
          <>
            <DialogTitle sx={{ borderBottom: 1, borderColor: "divider", py: 1.5 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <RestaurantMenu color="primary" />
                <Typography variant="h6" fontWeight="bold">تفاصيل المنتج: {selectedMealForDetails.name}</Typography>
              </Box>
            </DialogTitle>
            <DialogContent dividers sx={{ py: 2 }}>
              {/* صف واحد: قسمين جنب بعض */}
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>معلومات أساسية</Typography>
                  <Box sx={{ bgcolor: "action.hover", borderRadius: 1, px: 1.5, py: 1.5, border: "1px solid", borderColor: "divider" }}>
                    <Typography variant="caption" color="text.secondary" display="block">الكود</Typography>
                    <Typography variant="body1" fontWeight="bold">{selectedMealForDetails.code || "—"}</Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>القسم</Typography>
                    <Typography variant="body1" fontWeight="bold">{selectedMealForDetails.category}</Typography>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>تاريخ الإنشاء</Typography>
                    <Typography variant="body1">{selectedMealForDetails.created_date}</Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>المبيعات في الفترة</Typography>
                  <Box sx={{ bgcolor: "action.hover", borderRadius: 1, px: 1.5, py: 1.5, border: "1px solid", borderColor: "divider" }}>
                    <Typography variant="caption" color="text.secondary" display="block">إجمالي الكمية المباعة</Typography>
                    <Typography variant="body1" fontWeight="bold" color="primary.main">{formatNumEn(selectedMealForDetails.quantity_sold ?? 0)}</Typography>
                    <Box sx={{ display: "flex", gap: 1.5, mt: 1.5, flexWrap: "wrap" }}>
                      <Box sx={{ flex: "1 1 100px", minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary">كاش</Typography>
                        <Typography variant="body2" fontWeight="bold">كمية: {formatNumEn(selectedMealForDetails.quantity_sold_cash ?? 0)}</Typography>
                        <Typography variant="caption" color="success.dark">مبلغ: {formatCurrency(selectedMealForDetails.amount_sold_cash ?? 0)}</Typography>
                      </Box>
                      <Box sx={{ flex: "1 1 100px", minWidth: 0 }}>
                        <Typography variant="caption" color="text.secondary">تطبيق</Typography>
                        <Typography variant="body2" fontWeight="bold">كمية: {formatNumEn(selectedMealForDetails.quantity_sold_app ?? 0)}</Typography>
                        <Typography variant="caption" color="success.dark">مبلغ: {formatCurrency(selectedMealForDetails.amount_sold_app ?? 0)}</Typography>
                      </Box>
                    </Box>
                  </Box>
                </Grid>
              </Grid>

              {/* قسم الأسعار والربح: بوكسات بعرض كامل */}
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>الأسعار والربح</Typography>
              <Grid container spacing={1.5} sx={{ mb: 2 }}>
                <Grid size={4}>
                  <Box sx={{ bgcolor: "action.hover", borderRadius: 1, px: 1.5, py: 1.5, border: "1px solid", borderColor: "divider", textAlign: "center" }}>
                    <Typography variant="caption" color="text.secondary" display="block">تكلفة المكونات</Typography>
                    <Typography variant="body2" fontWeight="bold" color="warning.main">{formatCurrency(selectedMealForDetails.total_ingredients_cost ?? selectedMealForDetails.cost_price ?? 0)}</Typography>
                  </Box>
                </Grid>
                <Grid size={4}>
                  <Box sx={{ bgcolor: "action.hover", borderRadius: 1, px: 1.5, py: 1.5, border: "1px solid", borderColor: "divider", textAlign: "center" }}>
                    <Typography variant="caption" color="text.secondary" display="block">سعر البيع</Typography>
                    <Typography variant="body2" fontWeight="bold" color="success.main">{formatCurrency(selectedMealForDetails.sale_price)}</Typography>
                  </Box>
                </Grid>
                <Grid size={4}>
                  <Box sx={{ bgcolor: "action.hover", borderRadius: 1, px: 1.5, py: 1.5, border: "1px solid", borderColor: "divider", textAlign: "center" }}>
                    <Typography variant="caption" color="text.secondary" display="block">الربح</Typography>
                    <Typography variant="body2" fontWeight="bold" color="info.main">{formatCurrency(selectedMealForDetails.profit_amount ?? 0)} ({(selectedMealForDetails.profit_margin ?? 0)}%)</Typography>
                  </Box>
                </Grid>
              </Grid>

              {/* جدول المكونات */}
              {selectedMealForDetails.ingredients && selectedMealForDetails.ingredients.length > 0 && (
                <Box>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>المكونات وتكلفتها</Typography>
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ bgcolor: "action.hover" }}>
                          <TableCell sx={{ fontWeight: "bold" }}>المكون</TableCell>
                          <TableCell align="center" sx={{ fontWeight: "bold" }}>الكمية</TableCell>
                          <TableCell sx={{ fontWeight: "bold" }}>الوحدة</TableCell>
                          <TableCell align="right" sx={{ fontWeight: "bold" }}>التكلفة (شيكل)</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {selectedMealForDetails.ingredients.map((ing, i) => (
                          <TableRow key={i}>
                            <TableCell>{ing.name}</TableCell>
                            <TableCell align="center">{ing.quantity}</TableCell>
                            <TableCell>{ing.unit || "وحدة"}</TableCell>
                            <TableCell align="right">{formatCurrency(ing.total_cost)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, py: 1.5, borderTop: 1, borderColor: "divider" }}>
              <Button onClick={() => { setMealDetailsDialogOpen(false); setSelectedMealForDetails(null); }} variant="contained">
                إغلاق
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default TreasuryDeposit;
