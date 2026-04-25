import {
  AccountBalance,
  Add,
  AdminPanelSettings,
  AppShortcut,
  AttachMoney,
  BookmarkBorder,
  DarkMode,
  Dashboard,
  DeleteOutline,
  CheckCircle,
  EventAvailable,
  InfoOutlined,
  LightMode,
  ListAlt,
  LocalPharmacy,
  Logout,
  Notifications,
  Today,
  WifiOff,
  Close,
  AccountBalanceWallet,
  CreditScoreOutlined,
  PaymentsOutlined,
  ReceiptLongOutlined,
  ShoppingCartCheckout,
  TrendingUpOutlined,
} from "@mui/icons-material";
import {
  Alert,
  alpha,
  Autocomplete,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  Divider,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  LinearProgress,
  Pagination,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Cookies from "universal-cookie";
import { PHARMACY_DISPLAY_NAME } from "../config/appBranding";
import {
  appendAdminSaleNotification,
  appendCashierShiftEndNotification,
} from "../utils/cashierShiftNotification";
import { appendShiftActivityRecord } from "../utils/shiftActivityLog";
import { isNotificationUnreadForCurrentUser } from "../utils/notificationVisibility";
import { appendSalesReturn } from "../utils/salesReturnsStorage";
import { Axios } from "../Api/Axios";
import { performFullLogout } from "../utils/fullSessionLogout";
import { confirmApp, showAppToast } from "../utils/appToast";
import { productDisplayName } from "../utils/productDisplayName";
import { appendAudit } from "../utils/auditLog";
import { negativeAmountTextSx } from "../utils/negativeAmountStyle";
import { unitInventoryCostForSaleType, saleQuantityToInventoryPieces } from "../utils/inventoryCost";
import {
  deleteCashierDraft,
  readDraftsForCashier,
  saveCashierDraft,
} from "../utils/cashierDraftInvoices";
import ProductPatientInfoDialog from "../components/ProductPatientInfoDialog";
import { normalizeSaleOptions, productHasSaleOptions } from "../utils/productSaleOptions";
import {
  readDebtCustomers,
} from "../utils/pharmacyDebtCustomers";
import { persistSalesCategories, PHARMACY_ADMIN_CATEGORIES_SYNCED } from "../utils/backendCategoriesSync";
import { isSuperCashier, purchaserDisplayName, PHARMACY_USER_STORAGE_EVENT } from "../utils/userRoles";
import { mergeUserWithProfileExtras } from "../utils/staffProfileExtras";
import { safeLocalStorageSetJsonWithDataUrlFallback } from "../utils/safeLocalStorage";
import { getProductImageFallback } from "../utils/productImageFallback";
import { createApprovalRequest } from "../utils/approvalRequests";
import {
  getCashierPrintReceiptPref,
  getCashierSystemSettings,
  setCashierPrintReceiptPref,
} from "../utils/cashierSystemSettings";
const SALES_INVOICES_KEY = "salesInvoices";
const NOTIFICATIONS_KEY = "systemNotifications";
const OFFLINE_MODE_KEY = "cashierOfflineModeEnabled";
const OFFLINE_PENDING_INVOICES_KEY = "cashierOfflinePendingInvoices";
const ADMIN_PRODUCTS_KEY = "adminProducts";
const INVOICE_PRINT_COUNTS_KEY = "cashierInvoicePrintCounts_v1";

/** تبويب «الكل» — قيمة لا تتعارض مع id قسم قد يكون 0 من الخادم */
const CASHIER_ALL_CATEGORIES_TAB = "__all__";

const roundOneDecimal = (n) => Math.round(Number(n) * 10) / 10;
const NON_PHARMACY_CATEGORY_HINTS = [
  "مطعم",
  "مطبخ",
  "وجبات",
  "مشروبات",
  "حلويات",
  "برجر",
  "بيتزا",
  "شاورما",
  "ساندويتش",
];
const isPharmacyLikeCategoryName = (name) => {
  return true;  // مؤقتاً لاختبار عرض جميع المنتجات
  // const n = String(name || "").trim().toLowerCase();
  // if (!n) return false;
  // return !NON_PHARMACY_CATEGORY_HINTS.some((hint) => n.includes(hint));
};

const TODAY_SALES_ROWS = 6;

function isSameLocalDay(isoString, refDate = new Date()) {
  if (!isoString) return false;
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return false;
  return (
    d.getFullYear() === refDate.getFullYear() &&
    d.getMonth() === refDate.getMonth() &&
    d.getDate() === refDate.getDate()
  );
}

const saleTypeLabelMap = {
  pill: "بالحبة",
  strip: "شريط كامل",
  bottle: "قزازة",
  box: "علبة",
  sachet: "كيس",
  optional: "اختياري",
};

function normalizeSplitSaleOptions(raw, fallback = "strip") {
  const list = Array.isArray(raw) ? raw : [];
  const allowed = ["pill", "strip", "box", "bottle", "sachet"];
  const normalized = list.map((x) => String(x || "").toLowerCase()).filter((x) => allowed.includes(x));
  if (!normalized.length) return [fallback];
  return Array.from(new Set(normalized));
}

function normalizeCustomSplitOptions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((row) => row && typeof row === "object")
    .map((row, i) => {
      const label = String(row.label || "").trim();
      const price = Number(row.price);
      if (!label || !Number.isFinite(price)) return null;
      return {
        id: String(row.id || `opt-${i}`),
        label,
        price,
        saleType: String(row.saleType || "").trim() || null,
      };
    })
    .filter(Boolean);
}

function saleTypeUnitPrice(product, saleType) {
  const targetType = String(saleType || product?.saleType || "strip");
  const baseType = String(product?.saleType || "strip");
  const basePrice = Number(product?.price ?? 0);
  const splitPrice = Number(product?.splitSalePrice ?? 0);
  const piecesPerStrip = Number(product?.piecesPerStrip || product?.stripUnitCount || 0);
  const stripsPerBox = Number(product?.stripsPerBox || 0);

  if (!product?.allowSplitSales) return basePrice;
  if (targetType === baseType) return basePrice;

  if (baseType === "box" && targetType === "strip") {
    if (splitPrice > 0) return splitPrice;
    return stripsPerBox > 0 ? basePrice / stripsPerBox : basePrice;
  }
  if (baseType === "box" && targetType === "pill") {
    if (splitPrice > 0 && piecesPerStrip > 0) return splitPrice / piecesPerStrip;
    const denom = stripsPerBox > 0 && piecesPerStrip > 0 ? stripsPerBox * piecesPerStrip : 1;
    return basePrice / denom;
  }
  if (baseType === "strip" && targetType === "pill") {
    if (splitPrice > 0) return splitPrice;
    return piecesPerStrip > 0 ? basePrice / piecesPerStrip : basePrice;
  }
  return basePrice;
}

function mapBackendUnitToSaleType(unit) {
  const u = String(unit || "").toLowerCase();
  if (u === "bottle" || u === "ml" || u === "liter") return "bottle";
  if (u === "box" || u === "pack") return "box";
  if (u === "piece" || u === "gram" || u === "kg" || u === "meter" || u === "cm") return "pill";
  if (u === "sachet") return "sachet";
  return "strip";
}

function mapApiProductRow(row) {
  const cats = row.categories || [];
  const first = cats[0];
  const catName = first?.name || row.category?.name || "بدون قسم";
  const catId = first?.id ?? row.category_id ?? null;
  const uh = String(row.usage_how_to || row.usageHowTo || "").trim();
  const uf = String(row.usage_frequency || row.usageFrequency || "").trim();
  const ut = String(row.usage_tips || row.usageTips || "").trim();
  const costRaw = row.cost_price ?? row.costPrice ?? row.purchase_price ?? row.purchasePrice;
  const costNum = Number(costRaw);
  const saleUnitRaw = row.sale_unit || row.saleUnit || row.unit;
  const saleType = mapBackendUnitToSaleType(saleUnitRaw);
  const allowSplitSales = !!row.allow_split_sales;
  const piecesPerStrip = Number(row.pieces_per_strip || row.strip_unit_count || 0);
  const stripsPerBox = Number(row.strips_per_box || 0);
  const splitSalePrice = Number(row.split_sale_price || 0);
  const customSplitOptions = normalizeCustomSplitOptions(row.split_sale_options);
  const saleTypeOptions = (() => {
    if (!allowSplitSales) return [saleType];
    if (saleType === "box") return ["box", "strip", "pill"];
    if (saleType === "strip") return ["strip", "pill"];
    return normalizeSplitSaleOptions(row.split_sale_options, saleType);
  })();
  return {
    id: row.id,
    name: row.name,
    desc: row.description || "",
    price: Number(row.price || 0),
    ...(Number.isFinite(costNum) && costNum >= 0 ? { costPrice: costNum } : {}),
    category: catName,
    categoryId: catId,
    qty: Number(row.stock ?? 0),
    saleType,
    allowSplitSales,
    stripUnitCount: Number(row.strip_unit_count || 0),
    piecesPerStrip,
    stripsPerBox,
    splitSalePrice,
    splitItemName: String(row.split_item_name || "حبة"),
    saleTypeOptions,
    active: row.is_active !== false,
    image: row.image_url || row.imageUrl || getProductImageFallback(row?.name, catName),
    barcode: row.barcode || "",
    createdAt: row.created_at || row.createdAt,
    saleOptions: customSplitOptions.length ? customSplitOptions : (row.sale_options ?? row.saleOptions),
    ...(uh ? { usageHowTo: uh } : {}),
    ...(uf ? { usageFrequency: uf } : {}),
    ...(ut ? { usageTips: ut } : {}),
  };
}

async function fetchAllSalesProductsPages(axiosInstance) {
  const all = [];
  let page = 1;
  let lastPage = 1;
  const perPage = 100;
  for (let guard = 0; guard < 40; guard += 1) {
    const { data } = await axiosInstance.get("products", {
      params: { per_page: perPage, page },  // 🔴 حذف scope: "sales"
    });
    if (!data?.success) break;
    const chunk = Array.isArray(data.data) ? data.data : [];
    all.push(...chunk);
    lastPage = Number(data.pagination?.last_page || 1);
    if (page >= lastPage) break;
    page += 1;
  }
  return all;
}

function readStoredUser() {
  try {
    const raw = localStorage.getItem("user");
    if (!raw) return null;
    const u = JSON.parse(raw);
    return mergeUserWithProfileExtras(u);
  } catch {
    return null;
  }
}

export default function CashierPage({ mode = "light", onToggleMode }) {
  const theme = useTheme();
  const cashierDlgPaperSx = useMemo(() => ({ borderRadius: 3, overflow: "hidden" }), []);
  const cashierDlgSlotProps = useMemo(() => ({ paper: { sx: cashierDlgPaperSx } }), [cashierDlgPaperSx]);
  const cashierDlgTitleSx = useMemo(
    () => ({
      textAlign: "right",
      pt: 2.25,
      pb: 1.5,
      px: { xs: 2, sm: 2.5 },
      borderBottom: "1px solid",
      borderColor: "divider",
    }),
    [],
  );
  const cashierDlgContentSx = useMemo(
    () => ({ textAlign: "right", px: { xs: 2, sm: 2.5 }, py: 2 }),
    [],
  );
  const cashierDlgActionsSx = useMemo(
    () => ({
      px: 2.5,
      py: 2,
      gap: 1,
      flexWrap: "wrap",
      bgcolor: alpha(theme.palette.action.hover, 0.08),
    }),
    [theme],
  );
  const isSmDown = useMediaQuery(theme.breakpoints.down("sm"));
  const isMdDown = useMediaQuery(theme.breakpoints.down("md"));
  const navigate = useNavigate();
  const cookies = new Cookies();
  const [currentUser, setCurrentUser] = useState(() => readStoredUser());
  useEffect(() => {
    const sync = () => setCurrentUser(readStoredUser());
    const onStorage = (e) => {
      if (e.key === "user" || e.key === null) sync();
    };
    window.addEventListener(PHARMACY_USER_STORAGE_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PHARMACY_USER_STORAGE_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  const cashierAvatarSrc = useMemo(() => {
    const u = currentUser;
    if (!u) return undefined;
    const s = u.avatar_url || u.avatarDataUrl || u.avatar;
    return typeof s === "string" && s.trim() ? s.trim() : undefined;
  }, [currentUser]);
  const cashierAvatarLetter = useMemo(() => {
    const raw = String(currentUser?.username || currentUser?.name || "?").trim() || "?";
    return raw.charAt(0).toUpperCase();
  }, [currentUser]);
  const canOpenCashierSettings =
    currentUser?.role === "cashier" || currentUser?.role === "super_cashier";
  const showAdminCashierHeaderActions =
    currentUser?.role === "admin" || currentUser?.role === "super_admin";
  const canOpenAdminDashboard =
    currentUser?.role === "cashier" ||
    currentUser?.role === "super_cashier" ||
    currentUser?.role === "admin" ||
    currentUser?.role === "super_admin";
  const [activeCategory, setActiveCategory] = useState(CASHIER_ALL_CATEGORIES_TAB);
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [customerMode, setCustomerMode] = useState("walkin");
  const [creditPaidNow, setCreditPaidNow] = useState("0");
  const [mixedCashAmount, setMixedCashAmount] = useState("");
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
const [newCustomerName, setNewCustomerName] = useState("");
const [newCustomerPhone, setNewCustomerPhone] = useState("");
const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [mixedAppAmount, setMixedAppAmount] = useState("");
  const [insuranceCoveragePct, setInsuranceCoveragePct] = useState("80");
  const [shiftStartedAt, setShiftStartedAt] = useState(() => new Date().toISOString());
  const [endShiftOpen, setEndShiftOpen] = useState(false);
  const [shiftFeedback, setShiftFeedback] = useState("");
  const [thankYouOpen, setThankYouOpen] = useState(false);
  const skipNextLogoutShiftNotifyRef = useRef(false);
  const [todaySalesOpen, setTodaySalesOpen] = useState(false);  // ✅
  


  const [todayTransactions, setTodayTransactions] = useState([]);
  
  const [todayStats, setTodayStats] = useState({});
  const [todaySalesPage, setTodaySalesPage] = useState(1);
  const [detailTodayInvoice, setDetailTodayInvoice] = useState(null);
  const [repeatInvoiceFeedback, setRepeatInvoiceFeedback] = useState("");
  const [invoiceStoreTick, setInvoiceStoreTick] = useState(0);
  /** كتالوج المبيعات من الـ API (أقسام + أصناف) عند نجاح الجلب */
  const [apiCatalog, setApiCatalog] = useState(null);
  const [categoryStorageTick, setCategoryStorageTick] = useState(0);
  useEffect(() => {
    const bump = () => setCategoryStorageTick((t) => t + 1);
    window.addEventListener(PHARMACY_ADMIN_CATEGORIES_SYNCED, bump);
    return () => window.removeEventListener(PHARMACY_ADMIN_CATEGORIES_SYNCED, bump);
  }, []);
  const [offlineModeEnabled, setOfflineModeEnabled] = useState(() => localStorage.getItem(OFFLINE_MODE_KEY) === "1");
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof navigator === "undefined") return true;
    return navigator.onLine;
  });
  const [pendingOfflineCount, setPendingOfflineCount] = useState(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem(OFFLINE_PENDING_INVOICES_KEY));
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  });
  const [productSortMode, setProductSortMode] = useState("default");
  const [saleOptionPickerOpen, setSaleOptionPickerOpen] = useState(false);
  const [selectedProductForSaleType, setSelectedProductForSaleType] = useState(null);
  const [productInfoOpen, setProductInfoOpen] = useState(false);
  const [productInfoTarget, setProductInfoTarget] = useState(null);
  const [syncConfirmOpen, setSyncConfirmOpen] = useState(false);
  const [isCheckoutSubmitting, setIsCheckoutSubmitting] = useState(false);
  const [isSyncSubmitting, setIsSyncSubmitting] = useState(false);
  const [productFilter, setProductFilter] = useState("");
  const [cartDiscountFixed, setCartDiscountFixed] = useState("");
  const [cartDiscountPercent, setCartDiscountPercent] = useState("");
  const [creditCustomerId, setCreditCustomerId] = useState("");// بعد الـ states الموجودة (مثل creditCustomerId)
  const [selectedCreditCustomerInfo, setSelectedCreditCustomerInfo] = useState(null);
  const [creditMovementsOpen, setCreditMovementsOpen] = useState(false);
  const [creditMovements, setCreditMovements] = useState([]);
  const [creditMovementsLoading, setCreditMovementsLoading] = useState(false);
  const [walkInCustomerName, setWalkInCustomerName] = useState("");
  const [debtPayOpen, setDebtPayOpen] = useState(false);
  const [debtPayCustomerId, setDebtPayCustomerId] = useState("");
  const [debtPayAmount, setDebtPayAmount] = useState("");
  const [holdLabelOpen, setHoldLabelOpen] = useState(false);
  const [holdLabelDraft, setHoldLabelDraft] = useState("");
  const [heldListOpen, setHeldListOpen] = useState(false);
  const [heldRefresh, setHeldRefresh] = useState(0);
  const [editingTabId, setEditingTabId] = useState(null);  // ✅ أضف هذا
  const [editingTabValue, setEditingTabValue] = useState("");  // ✅ أضف هذا
  const [printInvoice, setPrintInvoice] = useState(null);
  const [backendCreditCustomers, setBackendCreditCustomers] = useState([]);
  const debtCustomers = useMemo(() => {
    if (Array.isArray(backendCreditCustomers) && backendCreditCustomers.length) {
      return backendCreditCustomers;
    }
    return readDebtCustomers();
  }, [backendCreditCustomers, invoiceStoreTick, heldRefresh]);
  const currentUsername = useMemo(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      return user?.username || "";
    } catch {
      return "";
    }
  }, []);
  // بعد الـ states الموجودة
const [activeTabId, setActiveTabId] = useState(() => `tab_${Date.now()}`);
const [orderTabs, setOrderTabs] = useState(() => [
  {
    id: `tab_${Date.now()}`,
    label: `طلب ${new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}`,
    cart: [],
    paymentMethod: "cash",
    customerMode: "walkin",
    creditCustomerId: "",
    creditPaidNow: "0",
    mixedCashAmount: "",
    mixedAppAmount: "",
    walkInCustomerName: "",
    cartDiscountFixed: "",
    cartDiscountPercent: "",
    createdAt: Date.now(),
  },
]);

const mapCreditCustomerFromApi = (row) => {
  const rawBalance = Number(row?.balance ?? NaN);
  const rawDue = Number(row?.total_due ?? row?.debt_amount ?? 0);
  const rawCredit = Number(row?.available_credit ?? row?.credit_amount ?? 0);
  const balance = Number.isFinite(rawBalance) ? rawBalance : rawDue - rawCredit;
  return {
    id: row.customer_id || row.id || row.key,
    name: row.name || "—",
    phone: row.phone || "",
    balance,
    totalPaid: Number(row.total_paid || 0),
    totalSales: Number(row.total_sales || 0),
    creditLimit: Number(row.credit_limit || 0),
    availableCredit: Number.isFinite(rawCredit) ? rawCredit : Math.max(0, -balance),
    totalDue: Number.isFinite(rawDue) ? rawDue : Math.max(0, balance),
  };
};

useEffect(() => {
  let cancelled = false;
  (async () => {
    try {
      const { data } = await Axios.get("orders/credit-customers");
      if (!cancelled && data?.success && Array.isArray(data?.data)) {
        setBackendCreditCustomers(data.data.map(mapCreditCustomerFromApi));
      }
    } catch {
      // fallback to local cached debt customers
    }
  })();
  return () => {
    cancelled = true;
  };
}, [invoiceStoreTick]);
const allSalesInvoices = useMemo(() => {
  try {
    const raw = JSON.parse(localStorage.getItem(SALES_INVOICES_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}, [invoiceStoreTick, todaySalesOpen]);

const fetchCreditMovements = useCallback(async (customerId) => {
  if (!customerId) {
    setCreditMovements([]);
    return;
  }
  setCreditMovementsLoading(true);
  try {
    const { data } = await Axios.get(`orders/credit-customers/${customerId}/movements`);
    if (data?.success && Array.isArray(data?.data)) {
      setCreditMovements(data.data);
    } else {
      setCreditMovements([]);
    }
  } catch (error) {
    console.error("Error fetching credit movements:", error);
    setCreditMovements([]);
  } finally {
    setCreditMovementsLoading(false);
  }
}, []);
// متابعة اختيار الزبون لعرض معلوماته التفصيلية وجلب حركاته
useEffect(() => {
  if (creditCustomerId) {
    const customer = debtCustomers.find(c => String(c.id) === String(creditCustomerId));
    setSelectedCreditCustomerInfo(customer || null);
    // جلب حركات الزبون تلقائياً عند اختياره
    fetchCreditMovements(String(creditCustomerId));
  } else {
    setSelectedCreditCustomerInfo(null);
    setCreditMovements([]);
  }
}, [creditCustomerId, debtCustomers, fetchCreditMovements]);
// إنشاء تبويب جديد
const createNewOrderTab = () => {
  const newId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const newTab = {
    id: newId,
    label: `طلب ${new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}`,
    cart: [],
    paymentMethod: "cash",
    customerMode: "walkin",
    creditCustomerId: "",
    creditPaidNow: "0",
    mixedCashAmount: "",
    mixedAppAmount: "",
    walkInCustomerName: "",
    cartDiscountFixed: "",
    cartDiscountPercent: "",
    createdAt: Date.now(),
  };
  setOrderTabs(prev => [...prev, newTab]);
  setActiveTabId(newId);
  showAppToast("تم فتح طلب جديد", "success");
};

// استبدل دالة fetchTodayTransactions الحالية بهذه النسخة المحسنة
const fetchTodayTransactions = useCallback(async () => {
  try {
    console.log("🔄 جاري جلب بيانات اليوم...");
    
    const { data } = await Axios.get('orders/today-transactions');
    console.log("📦 البيانات من API:", data);
    
    if (data?.success) {
      const transactions = data.data.transactions.map(transaction => ({
        id: transaction.id,
        type: transaction.type,
        type_label: transaction.type_label,
        reference_number: transaction.reference_number,
        customer_name: transaction.customer_name,
        payment_method: transaction.payment_method,
        total_amount: Math.abs(transaction.total_amount),
        paid_amount: transaction.paid_amount,
        due_amount: transaction.due_amount,
        cashier_name: transaction.cashier_name,
        status: transaction.status,
        items_count: transaction.items_count || 0,
        occurred_at: transaction.occurred_at,
        icon: transaction.icon,
        color: transaction.color,
        note: transaction.note || ''
      }));
      
      setTodayTransactions(transactions);
      setTodayStats({
        total_sales: data.data.stats.total_sales || 0,
        total_paid: data.data.stats.total_paid || 0,
        total_debt_paid: data.data.stats.total_debt_paid || 0,
        total_purchases: data.data.stats.total_purchases || 0,
        total_expenses: data.data.stats.total_expenses || 0,
        total_income: data.data.stats.total_income || 0,
        total_orders: data.data.stats.total_orders || 0,
        total_payments: data.data.stats.total_payments || 0,
        net_cash_flow: data.data.stats.net_cash_flow || 0
      });
      
      console.log(`✅ تم جلب ${transactions.length} حركة لليوم`);
      
      if (transactions.length === 0) {
        showAppToast("لا توجد حركات مسجلة لهذا اليوم", "info");
      }
    } else {
      console.warn("⚠️ API لم يعد success:", data);
      // استخدام البيانات المحلية كـ fallback
      loadLocalTransactions();
    }
  } catch (error) {
    console.error('❌ Error fetching today transactions:', error);
    console.error('Error details:', error.response?.data || error.message);
    
    // ✅ استخدام البيانات المحلية كـ fallback
    loadLocalTransactions();
  }
}, []); // ✅ إزالة الاعتماد على allSalesInvoices
// دالة لجلب تفاصيل فاتورة محددة
const fetchInvoiceDetails = useCallback(async (orderId, referenceNumber) => {
  try {
    console.log("🔄 جاري جلب تفاصيل الفاتورة:", orderId);
    
    // محاولة جلب التفاصيل من الـ API
    const { data } = await Axios.get(`orders/${orderId}`);
    
    if (data?.success && data?.data) {
      const invoice = data.data;
      
      // تحويل البيانات إلى التنسيق المطلوب
      const formattedInvoice = {
        id: invoice.order_number || referenceNumber,
        soldBy: invoice.created_by_name || invoice.cashier_name || '—',
        soldByRole: invoice.created_by_role,
        soldAt: invoice.created_at,
        paymentMethod: invoice.payment_method,
        customerName: invoice.customer_name,
        subTotal: invoice.subtotal || invoice.total,
        total: invoice.total,
        discountAmount: invoice.discount || 0,
        dueAmount: invoice.due_amount,
        paidAmount: invoice.paid_amount,
        items: invoice.items?.map(item => ({
          id: item.id,
          productId: item.product_id,
          name: item.name,
          qty: item.quantity,
          price: item.unit_price,
          total: item.total_price || (item.quantity * item.unit_price)
        })) || []
      };
      
      setDetailTodayInvoice(formattedInvoice);
    } else {
      // إذا فشل الـ API، حاول من localStorage
      loadInvoiceFromLocalStorage(referenceNumber);
    }
  } catch (error) {
    console.error('❌ Error fetching invoice details:', error);
    // حاول من localStorage كـ fallback
    loadInvoiceFromLocalStorage(referenceNumber);
  }
}, []);

// دالة لتحميل الفاتورة من localStorage
const loadInvoiceFromLocalStorage = useCallback((referenceNumber) => {
  try {
    console.log("📂 البحث عن الفاتورة في localStorage:", referenceNumber);
    
    const storedInvoices = JSON.parse(localStorage.getItem(SALES_INVOICES_KEY) || "[]");
    
    // البحث عن الفاتورة برقمها
    const invoice = storedInvoices.find(inv => 
      inv.invoiceNumber === referenceNumber || 
      inv.id === referenceNumber ||
      inv.order_number === referenceNumber
    );
    
    if (invoice) {
      console.log("✅ تم العثور على الفاتورة:", invoice);
      
      // تحويل البيانات إلى التنسيق المطلوب
      const formattedInvoice = {
        id: invoice.invoiceNumber || invoice.id,
        soldBy: invoice.soldBy || invoice.soldByUsername,
        soldByRole: invoice.soldByRole,
        soldAt: invoice.soldAt,
        paymentMethod: invoice.paymentMethod,
        customerName: invoice.customerName,
        subTotal: invoice.subTotal,
        total: invoice.total,
        discountAmount: invoice.discountAmount,
        dueAmount: invoice.dueAmount,
        paidAmount: invoice.customerPaid,
        items: invoice.items?.map(item => ({
          id: item.productId,
          productId: item.productId,
          name: item.name,
          qty: item.qty,
          price: item.price,
          total: item.total || (item.qty * item.price)
        })) || []
      };
      
      setDetailTodayInvoice(formattedInvoice);
    } else {
      console.warn("⚠️ لم يتم العثور على الفاتورة في localStorage");
      showAppToast("لا توجد تفاصيل لهذه الفاتورة", "warning");
    }
  } catch (error) {
    console.error('❌ Error loading invoice from localStorage:', error);
    showAppToast("حدث خطأ في تحميل تفاصيل الفاتورة", "error");
  }
}, []);
// دالة منفصلة لتحميل البيانات المحلية
const loadLocalTransactions = useCallback(() => {
  try {
    console.log("📂 جاري تحميل البيانات من localStorage...");
    
    // قراءة الفواتير من localStorage
    const storedInvoices = JSON.parse(localStorage.getItem(SALES_INVOICES_KEY) || "[]");
    console.log(`📋 عدد الفواتير المخزنة: ${storedInvoices.length}`);
    
    const invoices = storedInvoices.filter(inv => {
      if (!inv.soldAt) return false;
      return isSameLocalDay(inv.soldAt);
    });
    
    console.log(`📅 فواتير اليوم: ${invoices.length}`);
    
    const fallbackTransactions = invoices.map(inv => ({
      id: inv.id,
      type: 'sale',
      type_label: 'فاتورة بيع',
      reference_number: inv.invoiceNumber || inv.id,
      customer_name: inv.customerName || 'زبون عابر',
      payment_method: inv.paymentMethod,
      total_amount: Math.abs(inv.total || 0),
      paid_amount: inv.customerPaid || inv.total || 0,
      due_amount: inv.customerMode === 'credit' ? (inv.dueAmount || 0) : 0,
      cashier_name: inv.soldByUsername || inv.soldBy,
      status: 'completed',
      items_count: inv.items?.length || 0,
      occurred_at: inv.soldAt,
      icon: 'receipt',
      color: 'primary'
    }));
    
    setTodayTransactions(fallbackTransactions);
    setTodayStats({
      total_sales: fallbackTransactions.reduce((sum, t) => sum + t.total_amount, 0),
      total_paid: fallbackTransactions.reduce((sum, t) => sum + t.paid_amount, 0),
      total_orders: fallbackTransactions.length,
      total_debt_paid: 0,
      total_purchases: 0,
      total_expenses: 0,
      total_income: 0,
      total_payments: 0,
      net_cash_flow: fallbackTransactions.reduce((sum, t) => sum + t.total_amount, 0)
    });
    
    if (fallbackTransactions.length === 0) {
      showAppToast("لا توجد فواتير مسجلة لهذا اليوم", "info");
    } else {
      console.log(`✅ تم تحميل ${fallbackTransactions.length} فاتورة من localStorage`);
    }
  } catch (error) {
    console.error('❌ Fallback error:', error);
    setTodayTransactions([]);
    setTodayStats({});
    showAppToast('حدث خطأ في تحميل بيانات اليوم', 'error');
  }
}, []);
const openTodaySales = () => {

  setTodaySalesPage(1);
  fetchTodayTransactions();
  setTodaySalesOpen(true);
};

const todayTransactionsPageCount = Math.max(1, Math.ceil(todayTransactions.length / TODAY_SALES_ROWS));
const safeTransactionsPage = Math.min(todaySalesPage, todayTransactionsPageCount);
// استدعاء الدالة عند فتح الـ Dialog

// حذف تبويب
const closeOrderTab = (tabId) => {
  if (orderTabs.length === 1) {
    showAppToast("لا يمكن إغلاق الطلب الوحيد، يمكنك تفريغ السلة بدلاً من ذلك", "warning");
    return;
  }
  
  const tabToClose = orderTabs.find(t => t.id === tabId);
  if (tabToClose?.cart?.length > 0) {
    const confirmClose = window.confirm("السلة ليست فارغة. هل تريد إغلاق الطلب وفقدان المحتويات؟");
    if (!confirmClose) return;
  }
  
  setOrderTabs(prev => prev.filter(t => t.id !== tabId));
  if (activeTabId === tabId) {
    const remaining = orderTabs.filter(t => t.id !== tabId);
    if (remaining.length) setActiveTabId(remaining[0].id);
  }
  showAppToast("تم إغلاق الطلب", "info");
};

// تحديث بيانات التبويب النشط
const updateCurrentTab = (updates) => {
  setOrderTabs(prev => prev.map(tab => 
    tab.id === activeTabId ? { ...tab, ...updates } : tab
  ));
};

// الحصول على التبويب النشط
const currentTab = useMemo(() => {
  return orderTabs.find(tab => tab.id === activeTabId) || orderTabs[0];
}, [orderTabs, activeTabId]);

// استخدام useRef لمنع الحلقات اللانهائية
const isSyncingFromTab = useRef(false);
const isSyncingToTab = useRef(false);

// مزامنة المتغيرات مع التبويب النشط (من التبويب إلى الـ states)
useEffect(() => {
  if (!currentTab) return;
  if (isSyncingToTab.current) return;
  
  isSyncingFromTab.current = true;
  
  // مزامنة السلة
  if (JSON.stringify(cart) !== JSON.stringify(currentTab.cart)) {
    setCart(currentTab.cart);
  }
  // مزامنة طريقة الدفع
  if (paymentMethod !== currentTab.paymentMethod) {
    setPaymentMethod(currentTab.paymentMethod);
  }
  if (customerMode !== (currentTab.customerMode || "walkin")) {
    setCustomerMode(currentTab.customerMode || "walkin");
  }
  // مزامنة خصم الزبون الآجل
  if (creditCustomerId !== currentTab.creditCustomerId) {
    setCreditCustomerId(currentTab.creditCustomerId);
  }
  if (creditPaidNow !== currentTab.creditPaidNow) {
    setCreditPaidNow(currentTab.creditPaidNow);
  }
  if (walkInCustomerName !== currentTab.walkInCustomerName) {
    setWalkInCustomerName(currentTab.walkInCustomerName);
  }
  if ((mixedCashAmount || "") !== (currentTab.mixedCashAmount || "")) {
    setMixedCashAmount(currentTab.mixedCashAmount || "");
  }
  if ((mixedAppAmount || "") !== (currentTab.mixedAppAmount || "")) {
    setMixedAppAmount(currentTab.mixedAppAmount || "");
  }
  if (cartDiscountFixed !== currentTab.cartDiscountFixed) {
    setCartDiscountFixed(currentTab.cartDiscountFixed);
  }
  if (cartDiscountPercent !== currentTab.cartDiscountPercent) {
    setCartDiscountPercent(currentTab.cartDiscountPercent);
  }
  
  setTimeout(() => { isSyncingFromTab.current = false; }, 0);
}, [currentTab?.id]); // ✅ استخدم id فقط بدلاً من currentTab كاملاً

// حفظ تغييرات الـ states في التبويب النشط (من الـ states إلى التبويب)
useEffect(() => {
  if (isSyncingFromTab.current) return;
  if (currentTab && JSON.stringify(currentTab.cart) !== JSON.stringify(cart)) {
    isSyncingToTab.current = true;
    updateCurrentTab({ cart });
    setTimeout(() => { isSyncingToTab.current = false; }, 0);
  }
}, [cart]);

useEffect(() => {
  if (isSyncingFromTab.current) return;
  updateCurrentTab({ paymentMethod });
}, [paymentMethod]);

useEffect(() => {
  if (isSyncingFromTab.current) return;
  updateCurrentTab({ customerMode });
}, [customerMode]);

useEffect(() => {
  if (isSyncingFromTab.current) return;
  updateCurrentTab({ creditCustomerId });
}, [creditCustomerId]);

useEffect(() => {
  if (isSyncingFromTab.current) return;
  updateCurrentTab({ creditPaidNow });
}, [creditPaidNow]);

useEffect(() => {
  if (isSyncingFromTab.current) return;
  updateCurrentTab({ walkInCustomerName });
}, [walkInCustomerName]);

useEffect(() => {
  if (isSyncingFromTab.current) return;
  updateCurrentTab({ mixedCashAmount });
}, [mixedCashAmount]);

useEffect(() => {
  if (isSyncingFromTab.current) return;
  updateCurrentTab({ mixedAppAmount });
}, [mixedAppAmount]);

useEffect(() => {
  if (isSyncingFromTab.current) return;
  updateCurrentTab({ cartDiscountFixed });
}, [cartDiscountFixed]);

useEffect(() => {
  if (isSyncingFromTab.current) return;
  updateCurrentTab({ cartDiscountPercent });
}, [cartDiscountPercent]);
// حفظ تغييرات السلة في التبويب النشط

  const heldDrafts = useMemo(() => readDraftsForCashier(currentUsername), [currentUsername, heldRefresh]);
  const holdFeatureEnabled = false;
  const [cashierSys, setCashierSys] = useState(() => getCashierSystemSettings());
  const [printReceiptAfterSale, setPrintReceiptAfterSale] = useState(false);
  const [notifyPrefsTick, setNotifyPrefsTick] = useState(0);

  useEffect(() => {
    const sync = () => setCashierSys(getCashierSystemSettings());
    window.addEventListener("pharmacy-cashier-system-settings-changed", sync);
    const onStorage = (e) => {
      if (e.key === "pharmacyCashierSystemSettings_v1") sync();
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("pharmacy-cashier-system-settings-changed", sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    const s = getCashierSystemSettings();
    setPrintReceiptAfterSale(getCashierPrintReceiptPref(currentUsername, s.defaultPrintReceiptAfterSale));
  }, [currentUsername, cashierSys.defaultPrintReceiptAfterSale]);

  useEffect(() => {
    if (!cashierSys.discountEnabled) {
      setCartDiscountFixed("");
      setCartDiscountPercent("");
    }
  }, [cashierSys.discountEnabled]);

  useEffect(() => {
    if (paymentMethod === "app" && !cashierSys.appPaymentEnabled) setPaymentMethod("cash");
    if (paymentMethod === "card" && !cashierSys.cardPaymentEnabled) setPaymentMethod("cash");
    if (paymentMethod === "insurance" && !cashierSys.insurancePaymentEnabled) setPaymentMethod("cash");
  }, [
    cashierSys.creditEnabled,
    cashierSys.appPaymentEnabled,
    cashierSys.cardPaymentEnabled,
    cashierSys.insurancePaymentEnabled,
    paymentMethod,
  ]);

  useEffect(() => {
    if (!cashierSys.productSortFiltersEnabled && productSortMode !== "default") {
      setProductSortMode("default");
    }
  }, [cashierSys.productSortFiltersEnabled, productSortMode]);

  useEffect(() => {
    if (!cashierSys.offlineModeToggleEnabled && offlineModeEnabled) {
      setOfflineModeEnabled(false);
    }
  }, [cashierSys.offlineModeToggleEnabled, offlineModeEnabled]);
 
  useEffect(() => {
    if (!isOnline && !offlineModeEnabled) {
      setShiftFeedback(
        cashierSys.offlineModeToggleEnabled
          ? "انقطع الإنترنت. فعّل وضع عدم الاتصال حتى لا تفقد أي عملية بيع."
          : "انقطع الإنترنت. انتظر عودة الاتصال لإتمام البيع.",
      );
    }
  }, [isOnline, offlineModeEnabled, cashierSys.offlineModeToggleEnabled]);
  useEffect(() => {
    const on = () => setNotifyPrefsTick((n) => n + 1);
    window.addEventListener("pharmacy-notification-prefs-changed", on);
    return () => window.removeEventListener("pharmacy-notification-prefs-changed", on);
  }, []);

  useEffect(() => {
    const token = cookies.get("token");
    if (!token) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const catRes = await Axios.get("categories/main", { params: { scope: "purchase" } });
        
        const rawRows = await fetchAllSalesProductsPages(Axios);
        
        if (cancelled) return;
        let cats =
          catRes.data?.success && Array.isArray(catRes.data.data)
            ? catRes.data.data.map((c) => ({ id: c.id, name: c.name, active: true }))
            : [];
        const mapped = rawRows.map(mapApiProductRow);
        
        // 🔴 تأكد من أن setApiCatalog يتم استدعاؤه
        setApiCatalog({ categories: cats, products: mapped });
        
        if (cats.length) {
          persistSalesCategories(cats.map((c) => ({ id: c.id, name: c.name, is_active: c.active !== false })));
        }
        setActiveCategory(CASHIER_ALL_CATEGORIES_TAB);
      } catch (e) {
        if (!cancelled) {
          setApiCatalog({ categories: [], products: [] });
        }
        console.error("❌ خطأ جلب البيانات:", e);
        console.error("❌ Response status:", e.response?.status);
        console.error("❌ Response data:", e.response?.data);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const unreadNotifications = useMemo(() => {
    void notifyPrefsTick;
    try {
      const raw = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY));
      const list = Array.isArray(raw) ? raw : [];
      return list.filter((n) => isNotificationUnreadForCurrentUser(n)).length;
    } catch {
      return 0;
    }
  }, [cart, currentUsername, invoiceStoreTick, notifyPrefsTick]);

  const appendInvoiceToSales = (invoice) => {
    try {
      const existing = JSON.parse(localStorage.getItem(SALES_INVOICES_KEY));
      const nextInvoices = Array.isArray(existing) ? [invoice, ...existing] : [invoice];
      localStorage.setItem(SALES_INVOICES_KEY, JSON.stringify(nextInvoices));
    } catch {
      localStorage.setItem(SALES_INVOICES_KEY, JSON.stringify([invoice]));
    }
  };
  const readInvoicePrintCount = (invoiceId) => {
    if (!invoiceId) return 0;
    try {
      const parsed = JSON.parse(localStorage.getItem(INVOICE_PRINT_COUNTS_KEY));
      const map = parsed && typeof parsed === "object" ? parsed : {};
      return Math.max(0, Number(map[String(invoiceId)] || 0));
    } catch {
      return 0;
    }
  };
  const bumpInvoicePrintCount = (invoiceId) => {
    if (!invoiceId) return;
    try {
      const parsed = JSON.parse(localStorage.getItem(INVOICE_PRINT_COUNTS_KEY));
      const map = parsed && typeof parsed === "object" ? parsed : {};
      const key = String(invoiceId);
      map[key] = Math.max(0, Number(map[key] || 0)) + 1;
      localStorage.setItem(INVOICE_PRINT_COUNTS_KEY, JSON.stringify(map));
    } catch {
      // ignore
    }
  };

  const readPendingOfflineInvoices = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(OFFLINE_PENDING_INVOICES_KEY));
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  const pendingOfflineInvoices = useMemo(() => readPendingOfflineInvoices(), [pendingOfflineCount]);
  const pendingOfflineTotal = useMemo(
    () => pendingOfflineInvoices.reduce((s, inv) => s + Number(inv?.total || 0), 0),
    [pendingOfflineInvoices],
  );

  const writePendingOfflineInvoices = (list) => {
    if (!Array.isArray(list) || list.length === 0) {
      localStorage.removeItem(OFFLINE_PENDING_INVOICES_KEY);
      setPendingOfflineCount(0);
      return;
    }
    localStorage.setItem(OFFLINE_PENDING_INVOICES_KEY, JSON.stringify(list));
    setPendingOfflineCount(list.length);
  };

  const submitInvoiceToBackend = async (invoice) => {
    const isCreditSale = String(invoice?.customerMode || "walkin") === "credit";
    const rawPm = String(invoice?.paymentMethod || "cash");
    const backendPaymentMethod = ["cash", "app", "card", "bank_transfer", "mixed"].includes(rawPm)
      ? rawPm
      : "cash";
    const normalizedItems = (invoice?.items || [])
      .map((it) => ({
        product_id: Number(it.productId ?? it.id),
        name: String(it.name || ""),
        quantity: Number(it.qty),
        price: Number(it.price),
        unit_cost: Number(it.unitCost ?? 0),
        sale_type: String(it.saleType ?? it.sale_type ?? "strip").toLowerCase(),
        ...(it?.saleOptionId != null && String(it.saleOptionId).trim() !== ""
          ? { sale_option_id: String(it.saleOptionId).trim() }
          : {}),
      }))
      .filter((it) => Number.isFinite(it.product_id) && it.product_id > 0 && it.quantity > 0);
    const paidRaw = isCreditSale ? Number(invoice?.customerPaid ?? 0) : Number(invoice?.total || 0);
    const paidNum = Math.max(0, Math.min(Number(invoice?.total || 0), paidRaw));
    const payload = {
      items: normalizedItems,
      subtotal: Number(invoice?.subTotal || 0),
      total: Number(invoice?.total || 0),
      payment_method: backendPaymentMethod,
      paid_amount: paidNum,
      discount: Number(invoice?.discountAmount || 0),
      notes: `POS:${invoice?.id || "UNKNOWN"}`,
      customer_name:
        String(invoice?.customerName || invoice?.creditCustomerName || "").trim() || "زبون عابر",
      cashier_name: String(invoice?.soldByUsername || "").trim() || null,
    };
    if (isCreditSale && invoice?.creditCustomerId) {
      const cid = Number(invoice.creditCustomerId);
      if (Number.isFinite(cid) && cid > 0) {
        payload.customer_id = cid;
      }
    }
    if (paidNum > 0) {
      if (backendPaymentMethod === "app") {
        payload.cash_amount = 0;
        payload.app_amount = paidNum;
      } else if (backendPaymentMethod === "cash") {
        payload.cash_amount = paidNum;
        payload.app_amount = 0;
      } else if (backendPaymentMethod === "mixed") {
        payload.cash_amount = Number(invoice?.cashPaid ?? invoice?.cashAmount ?? 0);
        payload.app_amount = Number(invoice?.appPaid ?? invoice?.appAmount ?? 0);
      }
    }
    if (!payload.items.length) {
      throw new Error("لا يمكن حفظ الطلب لأن عناصر الفاتورة غير صالحة");
    }
    await Axios.post("orders", payload);
  };

  const flushPendingOfflineInvoices = async () => {
    const pending = readPendingOfflineInvoices();
    if (!pending.length) return { syncedCount: 0, failedCount: 0, lastErrorMessage: "" };
    const failed = [];
    let lastErrorMessage = "";
    for (const invoice of pending) {
      try {
        await submitInvoiceToBackend(invoice);
        applySaleToLocalStock(invoice.items || []);
      } catch (error) {
        failed.push(invoice);
        lastErrorMessage =
          error?.response?.data?.message || error?.message || "تعذر الوصول للخادم حالياً";
      }
    }
    writePendingOfflineInvoices(failed);
    setInvoiceStoreTick((t) => t + 1);
    return {
      syncedCount: pending.length - failed.length,
      failedCount: failed.length,
      lastErrorMessage,
    };
  };

  useEffect(() => {
    localStorage.setItem(OFFLINE_MODE_KEY, offlineModeEnabled ? "1" : "0");
  }, [offlineModeEnabled]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await Axios.get("orders/credit-customers");
        if (!cancelled && data?.success && Array.isArray(data?.data)) {
          setBackendCreditCustomers(data.data.map(mapCreditCustomerFromApi));
        }
      } catch {
        // fallback to local cached debt customers
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invoiceStoreTick]);
// دالة لجلب حركات الزبون (كشف الحساب)

  useEffect(() => {
    if (!isOnline || !offlineModeEnabled || pendingOfflineCount === 0) return;
    setShiftFeedback("تم رجوع الإنترنت. يمكنك مراجعة الطلبات المحفوظة ثم حفظها في النظام.");
    const timer = window.setTimeout(() => setShiftFeedback(""), 4500);
    return () => window.clearTimeout(timer);
  }, [isOnline, offlineModeEnabled, pendingOfflineCount]);

 
  const todaySalesForCashier = useMemo(() => {
    const me = currentUser?.username || "";
    const isAdminPreview = currentUser?.role === "admin" || currentUser?.role === "super_admin";
    return [...allSalesInvoices]
      .filter((inv) => {
        if (!isSameLocalDay(inv.soldAt)) return false;
        if (isAdminPreview) return true;
        return String(inv.soldByUsername || inv.soldBy || "") === me;
      })
      .sort((a, b) => new Date(b.soldAt || 0).getTime() - new Date(a.soldAt || 0).getTime());
  }, [allSalesInvoices, currentUser?.role, currentUser?.username]);

  /** نفس منطق «بيع اليوم» حتى يتطابق ملخص إنهاء الدوام بعد التحديث أو فتح الصفحة من جديد */
  const shiftStats = useMemo(() => {
    let total = 0;
    let cash = 0;
    let app = 0;
    let credit = 0;
    for (const inv of todaySalesForCashier) {
      const saleTotal = roundOneDecimal(Number(inv.total || 0));
      total += saleTotal;
      const pm = inv.paymentMethod;
      if (pm === "cash") cash += saleTotal;
      else if (pm === "app") app += saleTotal;
      else if (pm === "credit") credit += saleTotal;
    }
    return {
      invoiceCount: todaySalesForCashier.length,
      total: roundOneDecimal(total),
      cash: roundOneDecimal(cash),
      app: roundOneDecimal(app),
      credit: roundOneDecimal(credit),
    };
  }, [todaySalesForCashier]);

  const shiftInvoices = useMemo(
    () =>
      todaySalesForCashier.map((inv) => ({
        id: inv.id,
        soldAt: inv.soldAt,
        paymentMethod: inv.paymentMethod,
        total: inv.total,
        pendingOffline: Boolean(inv.pendingOffline),
        items: (inv.items || []).map((it) => ({ name: it.name, qty: it.qty })),
      })),
    [todaySalesForCashier],
  );

  const todaySalesPageCount = Math.max(1, Math.ceil(todaySalesForCashier.length / TODAY_SALES_ROWS));
  const safeTodayPage = Math.min(todaySalesPage, todaySalesPageCount);
  const paginatedTodaySales = useMemo(() => {
    const start = (safeTodayPage - 1) * TODAY_SALES_ROWS;
    return todaySalesForCashier.slice(start, start + TODAY_SALES_ROWS);
  }, [todaySalesForCashier, safeTodayPage]);

  const visibleCategories = useMemo(() => {
    if (apiCatalog?.categories?.length) {
      return apiCatalog.categories
        .filter((c) => c.active !== false && isPharmacyLikeCategoryName(c.name))
        .map((c) => ({ id: c.id, name: c.name, active: c.active !== false }));
    }
    try {
      const stored = JSON.parse(localStorage.getItem("adminCategories"));
      if (Array.isArray(stored) && stored.length) {
        return stored
          .filter((c) => c.active !== false && isPharmacyLikeCategoryName(c.name))
          .map((c) => ({ id: c.id, name: c.name, active: c.active !== false }));
      }
    } catch {
      // ignore
    }
    return [];
  }, [apiCatalog, categoryStorageTick]);

  /** أقسام بدون تعارض مع تبويب «الكل» (__all__) وبدون تكرار id */
  const visibleCategoriesForTabs = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const c of visibleCategories) {
      if (!c || c.name == null) continue;
      const sid = String(c.id);
      if (sid === CASHIER_ALL_CATEGORIES_TAB) continue;
      /** قسم من الخادم اسمه «الكل» يُربك مع تبويب «الكل» الحقيقي — نعرضه فقط ضمن «الكل» وليس كتبويب منفصل */
      if (String(c.name).trim() === "الكل") continue;
      if (seen.has(sid)) continue;
      seen.add(sid);
      out.push(c);
    }
    return out;
  }, [visibleCategories]);

  const visibleProducts = useMemo(() => {
    if (apiCatalog?.products?.length) {
      // جلب IDs الأقسام المفعلة
      const activeCategoryIds = new Set(
        apiCatalog.categories
          .filter(cat => cat.active !== false)
          .map(cat => String(cat.id))
      );
      
      return apiCatalog.products.filter(product => {
        // إذا كان المنتج معطل (is_active = false) لا يظهر
        if (product.active === false) return false;
        // إذا لم يكن للمنتج قسم، لا يظهر
        if (!product.categoryId) return false;
        // فقط إذا كان القسم مفعلاً
        return activeCategoryIds.has(String(product.categoryId));
      });
    }
    try {
      const stored = JSON.parse(localStorage.getItem(ADMIN_PRODUCTS_KEY));
      if (Array.isArray(stored) && stored.length) {
        const activeCategoryIds = new Set(
          (apiCatalog?.categories || [])
            .filter(cat => cat.active !== false)
            .map(cat => String(cat.id))
        );
        return stored.filter(product => {
          if (product.active === false) return false;
          if (!product.categoryId) return false;
          return activeCategoryIds.has(String(product.categoryId));
        });
      }
    } catch {
      // ignore
    }
    return [];
  }, [apiCatalog, invoiceStoreTick]);


  const categoryTabs = useMemo(
    () => [{ id: CASHIER_ALL_CATEGORIES_TAB, name: "الكل" }, ...visibleCategoriesForTabs],
    [visibleCategoriesForTabs],
  );

  const salesCountByProductId = useMemo(() => {
    const m = new Map();
    for (const inv of allSalesInvoices) {
      for (const it of inv.items || []) {
        const id = Number(it.productId);
        if (!id) continue;
        m.set(id, (m.get(id) || 0) + Number(it.qty || 0));
      }
    }
    return m;
  }, [allSalesInvoices]);

  const shownProducts = useMemo(() => {
    
    const isAll = String(activeCategory) === String(CASHIER_ALL_CATEGORIES_TAB);
    const activeCat = isAll
      ? null
      : visibleCategoriesForTabs.find((c) => String(c.id) === String(activeCategory));
    const activeCategoryName = activeCat?.name;
    
    let list = visibleProducts.filter((p) => {
      if (isAll) return true;
      if (!activeCat) return true;
      if (p.categoryId != null && activeCat.id != null && Number(p.categoryId) === Number(activeCat.id)) return true;
      return activeCategoryName
        ? String(p.category || "").trim() === String(activeCategoryName).trim()
        : true;
    });
    
    
    if (productSortMode === "top") {
      list = [...list].sort((a, b) => {
        const ca = salesCountByProductId.get(Number(a.id)) || 0;
        const cb = salesCountByProductId.get(Number(b.id)) || 0;
        return cb - ca;
      });
    } else if (productSortMode === "new") {
      list = [...list].sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
      );
    }
    
    const f = productFilter.trim().toLowerCase();
    const barcodeOn = cashierSys.barcodeScanEnabled !== false;
    if (f) {
      list = list.filter((p) => {
        const nameMatch =
          String(p.name || "").toLowerCase().includes(f) ||
          String(productDisplayName(p)).toLowerCase().includes(f);
        if (!barcodeOn) return nameMatch;
        return (
          nameMatch ||
          String(p.barcode || "").toLowerCase().includes(f) ||
          String(p.barcode || "").trim() === productFilter.trim()
        );
      });
    }
    
    
    return list;
  }, [activeCategory, visibleCategoriesForTabs, visibleProducts, productSortMode, salesCountByProductId, productFilter, cashierSys.barcodeScanEnabled]);
  const applySaleToLocalStock = (soldItems) => {
    try {
      const stored = JSON.parse(localStorage.getItem(ADMIN_PRODUCTS_KEY));
      if (!Array.isArray(stored) || !stored.length) return;
      const readOptionQty = (opt) => {
        const candidates = [opt?.qty, opt?.quantity, opt?.stock];
        for (const value of candidates) {
          const parsed = Number(value);
          if (Number.isFinite(parsed)) return parsed;
        }
        return null;
      };
      const writeOptionQty = (opt, nextQty) => {
        if (Object.prototype.hasOwnProperty.call(opt, "qty")) return { ...opt, qty: nextQty };
        if (Object.prototype.hasOwnProperty.call(opt, "quantity")) return { ...opt, quantity: nextQty };
        if (Object.prototype.hasOwnProperty.call(opt, "stock")) return { ...opt, stock: nextQty };
        return { ...opt, qty: nextQty };
      };
      const next = stored.map((p) => {
        const productSales = soldItems.filter((it) => Number(it.productId) === Number(p.id));
        const soldQty = productSales.reduce((sum, it) => sum + Number(it.qty || 0), 0);
        if (!soldQty) return p;
        let nextProduct = { ...p };
        if (Array.isArray(nextProduct.saleOptions) && nextProduct.saleOptions.length) {
          const soldByOption = productSales.reduce((acc, it) => {
            const key =
              it?.saleOptionId != null && String(it.saleOptionId).trim() !== ""
                ? String(it.saleOptionId).trim()
                : "";
            if (!key) return acc;
            acc.set(key, (acc.get(key) || 0) + Number(it.qty || 0));
            return acc;
          }, new Map());
          if (soldByOption.size > 0) {
            nextProduct.saleOptions = nextProduct.saleOptions.map((opt) => {
              const optId = String(opt?.id ?? "").trim();
              const soldForThisOption = soldByOption.get(optId);
              if (!soldForThisOption) return opt;
              const currentOptionQty = readOptionQty(opt);
              if (currentOptionQty == null) return opt;
              const updatedOptionQty = Number((currentOptionQty - soldForThisOption).toFixed(1));
              return writeOptionQty(opt, updatedOptionQty);
            });
          }
        }
        // خصم المخزون بالحبات حسب نوع البيع (شريط/حبة/علبة)، لا بكمية السطر الخام فقط.
        let baseInventoryPieces = 0;
        for (const it of productSales) {
          if (it?.saleOptionId != null && String(it.saleOptionId).trim() !== "") continue;
          const shape = {
            saleType: nextProduct.saleType ?? nextProduct.sale_unit,
            sale_unit: nextProduct.sale_unit,
            unit: nextProduct.unit,
            piecesPerStrip: nextProduct.piecesPerStrip ?? nextProduct.pieces_per_strip,
            stripUnitCount: nextProduct.stripUnitCount ?? nextProduct.strip_unit_count,
            stripsPerBox: nextProduct.stripsPerBox ?? nextProduct.strips_per_box,
            allowSplitSales: nextProduct.allowSplitSales ?? nextProduct.allow_split_sales,
          };
          baseInventoryPieces += saleQuantityToInventoryPieces(
            shape,
            Number(it.qty || 0),
            it.saleType || it.sale_type,
          );
        }
        if (baseInventoryPieces > 0) {
          const currentQty = Number(nextProduct.qty || 0);
          nextProduct.qty = Number((currentQty - baseInventoryPieces).toFixed(1));
        }
        return nextProduct;
      });
      safeLocalStorageSetJsonWithDataUrlFallback(ADMIN_PRODUCTS_KEY, next);
    } catch {
      // ignore
    }
  };

  const roundCartQty = (n) => {
    const x = Number(n);
    if (!Number.isFinite(x)) return 0.1;
    return Math.max(0.1, Math.round(x * 10) / 10);
  };

// استبدل const subTotalBeforeDiscount = useMemo(...)
const subTotalBeforeDiscount = useMemo(() => {
  const currentCart = currentTab?.cart || cart;
  return currentCart.reduce((s, i) => s + Number(i.price) * roundCartQty(i.qty), 0);
}, [currentTab, cart]);
  const discountPct = cashierSys.discountEnabled
    ? Math.min(100, Math.max(0, Number(cartDiscountPercent) || 0))
    : 0;
  const discountFix = cashierSys.discountEnabled ? Math.max(0, Number(cartDiscountFixed) || 0) : 0;
  const discountFromPercent = roundOneDecimal(subTotalBeforeDiscount * (discountPct / 100));
  const discountAmount = roundOneDecimal(
    Math.min(subTotalBeforeDiscount, discountFromPercent + discountFix),
  );
  const subTotal = subTotalBeforeDiscount;
  const preTaxTotal = roundOneDecimal(Math.max(0, subTotalBeforeDiscount - discountAmount));
  const taxRate = cashierSys.taxEnabled ? Math.max(0, Number(cashierSys.defaultTaxRate || 0)) : 0;
  const taxAmount = roundOneDecimal(preTaxTotal * (taxRate / 100));
  const total = roundOneDecimal(preTaxTotal + taxAmount);

  const tryBarcodeQuickAdd = useCallback(
    (raw) => {
      if (!getCashierSystemSettings().barcodeScanEnabled) {
        showAppToast("الباركود معطّل من إعدادات المدير → إعدادات الكاشير", "info");
        return;
      }
      const code = String(raw || "").trim();
      if (!code) return;
      const exact = visibleProducts.find((p) => String(p.barcode || "").trim() === code);
      if (!exact) {
        showAppToast("لا صنف بهذا الباركود", "warning");
        return;
      }
      setProductInfoTarget(exact);
      setProductInfoOpen(true);
      setProductFilter("");
    },
    [visibleProducts],
  );

  const addToCart = (product, chosenSaleType = null, saleOptionChoice = null) => {
    const activeSaleType =
      String(saleOptionChoice?.saleType || "").trim() ||
      chosenSaleType ||
      product.saleType ||
      "strip";
    const activeSaleTypeLabel = saleTypeLabelMap[activeSaleType] || saleTypeLabelMap.optional;
    const optId = saleOptionChoice?.id != null ? String(saleOptionChoice.id) : "_";
    const rowId = `${product.id}::${activeSaleType}::${optId}`;
    const basePrice = Number(saleTypeUnitPrice(product, activeSaleType) || 0);
    const optionPrice = saleOptionChoice ? Number(saleOptionChoice.price ?? saleOptionChoice.priceDelta) : NaN;
    const linePrice = roundOneDecimal(
      saleOptionChoice && Number.isFinite(optionPrice) ? optionPrice : basePrice,
    );
    const baseDisplay = productDisplayName(product);
    const lineName =
      saleOptionChoice && String(saleOptionChoice.label || "").trim()
        ? `${baseDisplay} — ${String(saleOptionChoice.label).trim()}`
        : baseDisplay;
    setCart((prev) => {
      const found = prev.find((x) => x.rowId === rowId);
      if (found) {
        return prev.map((x) => (x.rowId === rowId ? { ...x, qty: roundCartQty(Number(x.qty) + 1) } : x));
      }
      return [
        ...prev,
        {
          rowId,
          id: product.id,
          name: lineName,
          qty: 1,
          price: linePrice,
          saleType: activeSaleType,
          saleTypeLabel: activeSaleTypeLabel,
          ...(product?.allowSplitSales ? { allowSplitSales: true } : {}),
          ...(Number(product?.stripUnitCount || 0) > 0 ? { stripUnitCount: Number(product.stripUnitCount) } : {}),
          ...(product?.splitItemName ? { splitItemName: product.splitItemName } : {}),
          ...(saleOptionChoice && String(saleOptionChoice.id || "").trim()
            ? {
                saleOptionId: String(saleOptionChoice.id).trim(),
                saleOptionLabel: String(saleOptionChoice.label || "").trim(),
                ...(saleOptionChoice.qty != null ? { saleOptionQty: Number(saleOptionChoice.qty) } : {}),
              }
            : {}),
        },
      ];
    });
    showAppToast(`تمت إضافة «${lineName}» للسلة`, "success");
  };

  const openProductPatientInfo = (product) => {
    if (!product) return;
    setProductInfoTarget(product);
    setProductInfoOpen(true);
  };

  const closeProductPatientInfo = () => {
    setProductInfoOpen(false);
    setProductInfoTarget(null);
  };

  const addProductFromCatalogCard = (product) => {
    const p = product;
    if (!p) return;
    setSelectedProductForSaleType(p);
    if (productHasSaleOptions(p) || p.allowSplitSales) {
      setSaleOptionPickerOpen(true);
    } else {
      addToCart(p, p.saleType || "strip", null);
      setSelectedProductForSaleType(null);
    }
  };

  const addFromProductPatientInfo = () => {
    const p = productInfoTarget;
    if (!p) return;
    setProductInfoOpen(false);
    setProductInfoTarget(null);
    addProductFromCatalogCard(p);
  };

  const updateQty = (rowId, op) => {
    setCart((prev) =>
      prev.map((x) => {
        if (x.rowId !== rowId) return x;
        const step = 0.5;
        const next = op === "+" ? Number(x.qty) + step : Number(x.qty) - step;
        return { ...x, qty: roundCartQty(next) };
      }),
    );
  };
  const setQty = (rowId, value) => {
    const cleaned = String(value ?? "").replace(/[^\d.]/g, "");
    if (cleaned === "" || cleaned === ".") return;
    const num = Number(cleaned);
    if (Number.isNaN(num)) return;
    const qty = roundCartQty(num);
    setCart((prev) => prev.map((x) => (x.rowId === rowId ? { ...x, qty } : x)));
  };

  const removeCartItem = (rowId) => {
    setCart((prev) => prev.filter((x) => (x.rowId || x.id) !== rowId));
    showAppToast("تم حذف الصنف من السلة", "info");
  };

  const clearCart = () => {
    if (!cart.length) return;
    setCart([]);
    showAppToast("تم تفريغ السلة بالكامل", "info");
  };

  useEffect(() => {
    if (!printInvoice) return;
    bumpInvoicePrintCount(printInvoice?.id);
    const t = window.setTimeout(() => window.print(), 280);
    const done = () => setPrintInvoice(null);
    window.addEventListener("afterprint", done);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("afterprint", done);
    };
  }, [printInvoice]);

  const finalizeLogout = () => {
    setThankYouOpen(false);
    performFullLogout(Axios);
  };

  const confirmDebtPayment = async () => {
    if (!debtPayCustomerId) {
      showAppToast("اختر زبون الآجل", "warning");
      return;
    }
    const amt = Number(debtPayAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      showAppToast("أدخل مبلغ تسديد صحيح", "error");
      return;
    }
    try {
      const { data } = await Axios.post(`orders/credit-customers/${debtPayCustomerId}/pay`, {
        amount: amt,
        note: `تسديد من الكاشير ${currentUser?.username || ""}`,
      });
      if (!data?.success) {
        showAppToast(data?.message || "تعذر تسجيل التسديد", "error");
        return;
      }
    } catch (error) {
      showAppToast(error?.response?.data?.message || "تعذر تسجيل التسديد", "error");
      return;
    }
    const cust = debtCustomers.find((c) => String(c.id) === String(debtPayCustomerId));
    appendAudit({
      action: "debt_customer_payment",
      details: JSON.stringify({
        id: debtPayCustomerId,
        name: cust?.name,
        amount: amt,
        source: "cashier",
      }),
      username: currentUser?.username || "",
      role: currentUser?.role || "",
    });
    setDebtPayOpen(false);
    setDebtPayCustomerId("");
    setDebtPayAmount("");
    setInvoiceStoreTick((t) => t + 1);
    showAppToast("تم تسجيل التسديد", "success");
  };
  const addNewCreditCustomer = async () => {
    if (!newCustomerName.trim()) {
      showAppToast("الرجاء إدخال اسم الزبون", "warning");
      return;
    }
    
    setIsAddingCustomer(true);
    try {
      const { data } = await Axios.post("orders/credit-customers", {
        name: newCustomerName.trim(),
        phone: newCustomerPhone.trim() || null,
      });
      
      if (data?.success) {
        showAppToast("تم إضافة زبون الآجل بنجاح", "success");
        setAddCustomerOpen(false);
        setNewCustomerName("");
        setNewCustomerPhone("");
        // تحديث قائمة الزبائن
        const { data: customersData } = await Axios.get("orders/credit-customers");
        if (customersData?.success && Array.isArray(customersData?.data)) {
          setBackendCreditCustomers(customersData.data.map(mapCreditCustomerFromApi));
        }
        setInvoiceStoreTick((t) => t + 1);
      } else {
        showAppToast(data?.message || "فشل إضافة الزبون", "error");
      }
    } catch (error) {
      console.error("Error adding customer:", error);
      showAppToast(error?.response?.data?.message || "حدث خطأ أثناء إضافة الزبون", "error");
    } finally {
      setIsAddingCustomer(false);
    }
  };
  const handleCheckout = async () => {
    if (isCheckoutSubmitting) return;
    if (!cart.length) return;
    if (customerMode === "credit" && !cashierSys.creditEnabled) {
      showAppToast("البيع الآجل معطّل من إعدادات المدير", "warning");
      return;
    }
    if (paymentMethod === "app" && !cashierSys.appPaymentEnabled) {
      showAppToast("الدفع عبر التطبيق معطّل من إعدادات المدير", "warning");
      return;
    }
    if (!isOnline && !offlineModeEnabled) {
      setShiftFeedback("الإنترنت مقطوع. فعّل وضع عدم الاتصال أولاً ثم أكمل البيع.");
      return;
    }
    const creditCust = debtCustomers.find((c) => String(c.id) === String(creditCustomerId));
    if (customerMode === "credit") {
      if (!creditCustomerId) {
        showAppToast("اختر زبوناً للبيع الآجل", "warning");
        return;
      }
      const paidNow = Number(creditPaidNow || 0);
      if (!Number.isFinite(paidNow) || paidNow < 0) {
        showAppToast("مبلغ المدفوع في الآجل غير صحيح", "error");
        return;
      }
    }
    const paidTarget = customerMode === "credit" ? Number(creditPaidNow || 0) : Number(total || 0);
    const paidAppliedTarget = customerMode === "credit" ? Math.min(Number(total || 0), Math.max(0, paidTarget)) : Number(total || 0);
    const mixedCash = Number(mixedCashAmount || 0);
    const mixedApp = Number(mixedAppAmount || 0);
 // تحديد المبلغ المستهدف للدفع المختلط
let mixedPaymentTarget = total;
if (customerMode === "credit") {
    mixedPaymentTarget = Number(creditPaidNow || 0);
}

if (paymentMethod === "mixed" && Math.abs((mixedCash + mixedApp) - mixedPaymentTarget) > 0.01) {
    showAppToast(`في الدفع المختلط: مجموع الكاش + التطبيق يجب أن يساوي ${mixedPaymentTarget.toFixed(2)} شيكل`, "error");
    return;
}
    const effectiveDiscountPercent =
      subTotalBeforeDiscount > 0 ? (Number(discountAmount || 0) / Number(subTotalBeforeDiscount)) * 100 : 0;
    const pendingInvoiceDraft = {
      soldBy: currentUser?.username || "cashier",
      soldByRole: currentUser?.role || "cashier",
      customerMode,
      paymentMethod,
      subTotal: Number(subTotalBeforeDiscount.toFixed(2)),
      discountAmount: Number(discountAmount.toFixed(2)),
      discountPercent: Number(effectiveDiscountPercent.toFixed(2)),
      discountFixed: Number(discountFix || 0),
      total: Number(total.toFixed(2)),
      taxRate: cashierSys.taxEnabled ? Number(cashierSys.defaultTaxRate || 0) : 0,
      taxAmount: cashierSys.taxEnabled ? Number(taxAmount.toFixed(2)) : 0,
      insuranceCoverage: paymentMethod === "insurance" ? Number(insuranceCoveragePct || 0) : 0,
      insuranceAmount:
        paymentMethod === "insurance"
          ? Number((((Math.max(0, Math.min(100, Number(insuranceCoveragePct || 0))) / 100) * Number(total.toFixed(2))).toFixed(2)))
          : 0,
      customerPaid:
        paymentMethod === "insurance"
          ? Number(
              (
                Number(total.toFixed(2)) -
                (Math.max(0, Math.min(100, Number(insuranceCoveragePct || 0))) / 100) * Number(total.toFixed(2))
              ).toFixed(2),
            )
          : customerMode === "credit"
            ? Number(Number(creditPaidNow || 0).toFixed(2))
            : Number(total.toFixed(2)),
      cashAmount:
        paymentMethod === "mixed"
          ? Number(mixedCash.toFixed(2))
          : paymentMethod === "cash"
            ? Number(paidAppliedTarget.toFixed(2))
            : 0,
      appAmount:
        paymentMethod === "mixed"
          ? Number(mixedApp.toFixed(2))
          : paymentMethod === "app"
            ? Number(paidAppliedTarget.toFixed(2))
            : 0,
      creditCustomerId: customerMode === "credit" ? creditCustomerId || null : null,
      creditCustomerName: customerMode === "credit" ? creditCust?.name || "" : "",
      items: cart.map((item) => ({
        productId: item.id,
        id: item.id,
        name: item.name,
        qty: roundCartQty(item.qty),
        price: Number(item.price || 0),
        total: Number((roundCartQty(item.qty) * Number(item.price || 0)).toFixed(2)),
        saleType: item.saleType || "strip",
        ...(item.saleOptionId ? { saleOptionId: item.saleOptionId } : {}),
        ...(item.saleOptionLabel ? { saleOptionLabel: item.saleOptionLabel } : {}),
      })),
    };
    if (
      cashierSys.approvalWorkflowEnabled &&
      cashierSys.discountApprovalEnabled &&
      cashierSys.discountEnabled &&
      currentUser?.role === "cashier" &&
      Number(effectiveDiscountPercent || 0) > Number(cashierSys.maxDiscountPercentNoApproval || 10)
    ) {
      createApprovalRequest({
        requestType: "discount",
        requestedBy: currentUser?.username || "",
        requestData: {
          requestedDiscountPercent: Number(effectiveDiscountPercent || 0),
          allowedWithoutApproval: Number(cashierSys.maxDiscountPercentNoApproval || 10),
          subTotalBeforeDiscount: Number(subTotalBeforeDiscount || 0),
          discountAmount: Number(discountAmount || 0),
          pendingInvoice: pendingInvoiceDraft,
        },
        reason: "خصم أعلى من الحد المسموح بدون موافقة",
      });
      showAppToast("تم إرسال طلب موافقة على الخصم للمشرف", "warning");
      return;
    }
    if (
      cashierSys.approvalWorkflowEnabled &&
      cashierSys.creditApprovalEnabled &&
      customerMode === "credit" &&
      cashierSys.requireCreditApproval &&
      currentUser?.role === "cashier" &&
      Number(total || 0) > Number(cashierSys.creditLimitNoApproval || 500)
    ) {
      createApprovalRequest({
        requestType: "credit_debt",
        requestedBy: currentUser?.username || "",
        requestData: {
          requestedCreditAmount: Number(total || 0),
          allowedWithoutApproval: Number(cashierSys.creditLimitNoApproval || 500),
          customerId: creditCustomerId || null,
          customerName: creditCust?.name || "",
          pendingInvoice: pendingInvoiceDraft,
        },
        reason: "بيع آجل أعلى من الحد المسموح بدون موافقة",
      });
      showAppToast("تم إرسال طلب موافقة على البيع الآجل للمشرف", "warning");
      return;
    }
    setIsCheckoutSubmitting(true);
    const discountAllocFactor = subTotalBeforeDiscount > 0 ? total / subTotalBeforeDiscount : 0;
    const builtItems = cart.map((item) => {
      const src = visibleProducts.find((p) => Number(p.id) === Number(item.id)) || {};
      const qty = roundCartQty(item.qty);
      const sellUnit = Number(item.price);
      const optionCost =
        item.saleOptionId != null && Array.isArray(src?.saleOptions)
          ? Number(
              (src.saleOptions.find((o) => String(o?.id ?? "") === String(item.saleOptionId))?.costPrice ?? NaN),
            )
          : NaN;
      const lineSaleType = item.saleType || item.sale_type || "strip";
      const uc =
        Number.isFinite(optionCost) && optionCost >= 0
          ? optionCost
          : unitInventoryCostForSaleType(src, lineSaleType);
      const lineGross = Number((qty * sellUnit).toFixed(2));
      const lineCost = Number((qty * uc).toFixed(2));
      const lineNetRevenue = Number((lineGross * discountAllocFactor).toFixed(2));
      const lineProfit = Number((lineNetRevenue - lineCost).toFixed(2));
      return {
        productId: item.id,
        name: item.name,
        qty,
        price: sellUnit,
        total: lineGross,
        unitCost: Number(Number(uc).toFixed(4)),
        lineCost,
        lineProfit,
        saleType: item.saleType || "strip",
        sale_type: item.saleType || "strip",
        saleTypeLabel: item.saleTypeLabel || saleTypeLabelMap[item.saleType] || saleTypeLabelMap.optional,
        ...(item.saleOptionId ? { saleOptionId: item.saleOptionId } : {}),
        ...(item.saleOptionLabel ? { saleOptionLabel: item.saleOptionLabel } : {}),
      };
    });
    const invoiceTotalCost = Number(builtItems.reduce((s, it) => s + Number(it.lineCost || 0), 0).toFixed(2));
    const invoiceTotalProfit = Number(builtItems.reduce((s, it) => s + Number(it.lineProfit || 0), 0).toFixed(2));
    const invoice = {
      id: `INV-${Date.now()}`,
      soldBy: purchaserDisplayName(currentUser),
      soldByUsername: currentUser?.username || "cashier",
      soldByRole: currentUser?.role || "cashier",
      customerName:
        customerMode === "credit"
          ? String(creditCust?.name || "")
          : String(walkInCustomerName || "").trim() || "زبون عابر",
      customerMode,
      paymentMethod,
      invoiceNumber: `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-6)}`,
      subTotal: Number(subTotalBeforeDiscount.toFixed(2)),
      discountAmount: Number(discountAmount.toFixed(2)),
      discountPercent: discountPct,
      discountFixed: discountFix,
      taxRate: Number(taxRate.toFixed(2)),
      taxAmount: Number(taxAmount.toFixed(2)),
      total: Number(total.toFixed(2)),
      customerPaid:
        customerMode === "credit"
          ? Number(Number(creditPaidNow || 0).toFixed(2))
          : Number(total.toFixed(2)),
      dueAmount:
        customerMode === "credit"
          ? Number((Number(total.toFixed(2)) - Number(Number(creditPaidNow || 0).toFixed(2))).toFixed(2))
          : 0,
      totalCost: invoiceTotalCost,
      totalProfit: invoiceTotalProfit,
      status: "مكتمل",
      soldAt: new Date().toISOString(),
      ...(customerMode === "credit" && creditCust
        ? { creditCustomerId: creditCust.id, creditCustomerName: creditCust.name }
        : {}),
      ...(paymentMethod === "mixed"
        ? { cashPaid: Number(mixedCash.toFixed(2)), appPaid: Number(mixedApp.toFixed(2)) }
        : {}),
      ...(paymentMethod === "insurance"
        ? {
            insuranceCoverage: Math.max(0, Math.min(100, Number(insuranceCoveragePct || 0))),
            insuranceAmount: Number(
              (
                (Math.max(0, Math.min(100, Number(insuranceCoveragePct || 0))) / 100) *
                Number(total.toFixed(2))
              ).toFixed(2),
            ),
            customerPaid: Number(
              (
                Number(total.toFixed(2)) -
                (Math.max(0, Math.min(100, Number(insuranceCoveragePct || 0))) / 100) * Number(total.toFixed(2))
              ).toFixed(2),
            ),
          }
        : {}),
      items: builtItems,
    };

    try {
      const shouldQueueOffline = offlineModeEnabled && !isOnline;
      if (shouldQueueOffline) {
        const pending = readPendingOfflineInvoices();
        writePendingOfflineInvoices([invoice, ...pending]);
        setShiftFeedback("تم تأكيد الطلب وحفظ الطلبية لحين الاتصال بالإنترنت.");
        window.setTimeout(() => setShiftFeedback(""), 4500);
        showAppToast("تم تأكيد الطلب وحفظ الطلبية لحين الاتصال بالإنترنت", "success");
      } else {
        try {
          await submitInvoiceToBackend(invoice);
          if (
            customerMode === "credit" &&
            creditCustomerId &&
            Number(invoice.customerPaid || 0) > Number(invoice.total || 0)
          ) {
            const extraAmount = Number(invoice.customerPaid || 0) - Number(invoice.total || 0);
            if (extraAmount > 0.0001) {
              await Axios.post(`orders/credit-customers/${creditCustomerId}/pay`, {
                amount: Number(extraAmount.toFixed(2)),
                note: `تسديد زيادة مع فاتورة ${invoice.invoiceNumber || invoice.id}`,
              });
            }
          }
        } catch (err) {
          showAppToast(err?.response?.data?.message || "فشل حفظ الفاتورة على السيرفر", "error");
          setIsCheckoutSubmitting(false);
          return;
        }
        appendInvoiceToSales(invoice);
        appendAdminSaleNotification(invoice);
      }
      applySaleToLocalStock(invoice.items);

      skipNextLogoutShiftNotifyRef.current = false;

      appendAudit({
        action: "cashier_sale",
        details: JSON.stringify({
          invoiceId: invoice.id,
          total: invoice.total,
          paymentMethod,
          ...(customerMode === "credit" && creditCust
            ? { creditCustomerId: creditCust.id, creditCustomerName: creditCust.name }
            : {}),
        }),
        username: currentUser?.username || "",
        role: currentUser?.role || "",
      });

      setInvoiceStoreTick((t) => t + 1);
      if (printReceiptAfterSale) {
        window.setTimeout(() => setPrintInvoice(invoice), 80);
      }
      setCart([]);
      setCartDiscountFixed("");
      setCartDiscountPercent("");
      setCreditCustomerId("");
      setCreditPaidNow("0");
      setWalkInCustomerName("");
      setPaymentMethod("cash");
      setCustomerMode("walkin");
      setMixedCashAmount("");
      setMixedAppAmount("");
    // بعد إتمام الطلب بنجاح
if (!shouldQueueOffline) {
  showAppToast("تم تأكيد الطلب بنجاح", "success");
  
  // ✅ إضافة: مسح التبويب الحالي وفتح تبويب جديد
  const currentTabIndex = orderTabs.findIndex(t => t.id === activeTabId);
  if (orderTabs.length > 1) {
    // إذا كان هناك أكثر من تبويب، أغلق التبويب الحالي
    closeOrderTab(activeTabId);
  } else {
    // إذا كان تبويب واحد فقط، امسح محتوياته
    updateCurrentTab({
      cart: [],
      cartDiscountFixed: "",
      cartDiscountPercent: "",
      creditCustomerId: "",
      creditPaidNow: "0",
      walkInCustomerName: "",
      label: `طلب ${new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}`,
    });
  }
  // افتح تبويب جديد للطلب التالي
  createNewOrderTab();
}
    } finally {
      setIsCheckoutSubmitting(false);
    }
  };

  const repeatInvoiceToCart = (invoice) => {
    if (!invoice || !Array.isArray(invoice.items) || !invoice.items.length) return;
    const soldAtMs = new Date(invoice?.soldAt || 0).getTime();
    const minutesSinceSale = soldAtMs ? (Date.now() - soldAtMs) / 60000 : 0;
    const cashierWindow = Number(cashierSys.returnWindowMinutesCashier || 30);
    const supervisorWindow = Number(cashierSys.returnWindowMinutesSupervisor || 1440);
    if (
      cashierSys.approvalWorkflowEnabled &&
      cashierSys.returnApprovalEnabled &&
      currentUser?.role === "cashier" &&
      soldAtMs &&
      minutesSinceSale > cashierWindow
    ) {
      createApprovalRequest({
        requestType: "refund",
        requestedBy: currentUser?.username || "",
        invoiceId: invoice?.id || null,
        requestData: {
          minutesSinceSale: Number(minutesSinceSale.toFixed(2)),
          allowedWindowMinutes: cashierWindow,
          invoiceTotal: Number(invoice?.total || 0),
        },
        reason: "طلب مرتجع خارج النافذة الزمنية للكاشير",
      });
      showAppToast("تم إرسال طلب موافقة على المرتجع للمشرف", "warning");
      return;
    }
    if (
      cashierSys.approvalWorkflowEnabled &&
      cashierSys.returnApprovalEnabled &&
      currentUser?.role === "super_cashier" &&
      soldAtMs &&
      minutesSinceSale > supervisorWindow
    ) {
      createApprovalRequest({
        requestType: "refund",
        requestedBy: currentUser?.username || "",
        invoiceId: invoice?.id || null,
        requestData: {
          minutesSinceSale: Number(minutesSinceSale.toFixed(2)),
          allowedWindowMinutes: supervisorWindow,
          invoiceTotal: Number(invoice?.total || 0),
        },
        reason: "طلب مرتجع خارج النافذة الزمنية لسوبر كاشير",
      });
      showAppToast("تم إرسال طلب موافقة على المرتجع للإدارة", "warning");
      return;
    }
    setCart((prev) => {
      const map = new Map(
        prev.map((x) => [x.rowId || `${x.id}::${x.saleType || "strip"}::_`, { ...x }]),
      );
      for (const it of invoice.items) {
        const id = it.productId ?? it.id;
        const name = it.name;
        const qty = Math.max(1, Number(it.qty) || 1);
        const price = Number(it.price) || 0;
        const saleType = it.saleType || "strip";
        const optKey =
          it.saleOptionId != null && String(it.saleOptionId).trim() !== ""
            ? String(it.saleOptionId).trim()
            : "_";
        const rowId = `${id}::${saleType}::${optKey}`;
        if (id == null || !name) continue;
        if (map.has(rowId)) {
          const cur = map.get(rowId);
          map.set(rowId, { ...cur, qty: cur.qty + qty, price });
        } else {
          map.set(rowId, {
            rowId,
            id,
            name,
            qty,
            price,
            saleType,
            saleTypeLabel: saleTypeLabelMap[saleType] || saleTypeLabelMap.optional,
            ...(it.saleOptionId ? { saleOptionId: it.saleOptionId } : {}),
            ...(it.saleOptionLabel ? { saleOptionLabel: it.saleOptionLabel } : {}),
          });
        }
      }
      return Array.from(map.values());
    });
    appendSalesReturn({
      originalInvoiceId: invoice.id,
      restoredBy: currentUser?.username || "cashier",
      items: invoice.items.map((it) => ({
        productId: it.productId ?? it.id,
        name: it.name,
        qty: Number(it.qty),
        price: Number(it.price),
        total: Number(it.total ?? Number(it.qty) * Number(it.price)),
      })),
      invoiceTotal: Number(invoice.total) || 0,
      paymentMethod: invoice.paymentMethod,
    });
    setRepeatInvoiceFeedback(`تمت إعادة بنود الفاتورة ${invoice.id} إلى السلة وسُجّلت في مرتجعات المبيعات.`);
    try {
      const existing = JSON.parse(localStorage.getItem(SALES_INVOICES_KEY));
      const nextInvoices = (Array.isArray(existing) ? existing : []).filter((x) => x.id !== invoice.id);
      localStorage.setItem(SALES_INVOICES_KEY, JSON.stringify(nextInvoices));
      setInvoiceStoreTick((t) => t + 1);
    } catch {
      // ignore
    }
    showAppToast("تم استرجاع الفاتورة وحذفها من بيع اليوم", "success");
    window.setTimeout(() => setRepeatInvoiceFeedback(""), 5000);
    setTodaySalesOpen(false);
    setDetailTodayInvoice(null);
    if (invoice.discountFixed != null && Number(invoice.discountFixed) > 0) {
      setCartDiscountFixed(String(invoice.discountFixed));
    } else {
      setCartDiscountFixed("");
    }
    if (invoice.discountPercent != null && Number(invoice.discountPercent) > 0) {
      setCartDiscountPercent(String(invoice.discountPercent));
    } else {
      setCartDiscountPercent("");
    }
  };

  const openHoldSave = () => {
    if (!cashierSys.holdCartEnabled) {
      showAppToast("تعليق السلة معطّل من إعدادات المدير", "warning");
      return;
    }
    if (!cart.length) {
      showAppToast("السلة فارغة", "warning");
      return;
    }
    setHoldLabelDraft("");
    setHoldLabelOpen(true);
  };

  const confirmHoldSave = () => {
    saveCashierDraft(currentUsername, {
      label: holdLabelDraft,
      cart,
      discountFixed: discountFix,
      discountPercent: discountPct,
      paymentMethod,
      creditCustomerId,
    });
    setHoldLabelOpen(false);
    setCart([]);
    setCartDiscountFixed("");
    setCartDiscountPercent("");
    setCreditCustomerId("");
    setCreditPaidNow("0");
    setPaymentMethod("cash");
    setCustomerMode("walkin");
    setMixedCashAmount("");
    setMixedAppAmount("");
    setHeldRefresh((x) => x + 1);
    showAppToast("تم حفظ السلة كمعلّقة لهذا الحساب", "success");
    appendAudit({
      action: "cashier_hold_save",
      details: JSON.stringify({ label: holdLabelDraft || "—" }),
      username: currentUser?.username || "",
      role: currentUser?.role || "",
    });
  };

  const restoreDraft = (d) => {
    if (!d?.cart?.length) return;
    setCart(d.cart);
    setCartDiscountFixed(d.discountFixed != null && Number(d.discountFixed) > 0 ? String(d.discountFixed) : "");
    setCartDiscountPercent(
      d.discountPercent != null && Number(d.discountPercent) > 0 ? String(d.discountPercent) : "",
    );
    setPaymentMethod(d.paymentMethod || "cash");
    setCustomerMode(d.customerMode || "walkin");
    setCreditCustomerId(d.creditCustomerId || "");
    setCreditPaidNow(String(d.customerPaid ?? 0));
    setMixedCashAmount(String(d.cashPaid ?? ""));
    setMixedAppAmount(String(d.appPaid ?? ""));
    setHeldListOpen(false);
    showAppToast(`تم استرجاع: ${d.label}`, "success");
  };

  const removeDraft = async (d) => {
    const ok = await confirmApp({
      title: "حذف معلّق",
      message: `حذف السلة المعلّقة «${d.label}»؟`,
      confirmText: "حذف",
    });
    if (!ok) return;
    deleteCashierDraft(currentUsername, d.id);
    setHeldRefresh((x) => x + 1);
    showAppToast("تم الحذف", "info");
    appendAudit({
      action: "cashier_hold_delete",
      details: JSON.stringify({ draftId: d.id, label: d.label }),
      username: currentUser?.username || "",
      role: currentUser?.role || "",
    });
  };

  const confirmEndShift = () => {
    const username = currentUser?.username || "cashier";
    const label = username === "cashier_special" ? "كاشير مميز" : "كاشير";
    const endedAt = new Date().toISOString();
    appendShiftActivityRecord({
      username,
      displayName: purchaserDisplayName(currentUser),
      shiftStartedAt,
      shiftEndedAt: endedAt,
      invoiceCount: shiftStats.invoiceCount,
      total: shiftStats.total,
      cash: shiftStats.cash,
      app: shiftStats.app,
      credit: shiftStats.credit || 0,
      invoices: [...shiftInvoices].reverse(),
    });
    appendCashierShiftEndNotification({
      username,
      label,
      shiftStartedAt,
      invoiceCount: shiftStats.invoiceCount,
      total: shiftStats.total,
      cash: shiftStats.cash,
      app: shiftStats.app,
      credit: shiftStats.credit || 0,
    });
    skipNextLogoutShiftNotifyRef.current = true;

    setShiftStartedAt(new Date().toISOString());
    setEndShiftOpen(false);
    setShiftFeedback("تم إرسال ملخص الدوام إلى المدير، وسيتم تسجيل الخروج تلقائياً.");
    window.setTimeout(() => {
      setShiftFeedback("");
      finalizeLogout();
    }, 1100);
  };

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
        color: "text.primary",
        px: { xs: 0.5, sm: 1.25, md: 0 },
        pb: { xs: "max(8px, env(safe-area-inset-bottom))", md: 0 },
        maxWidth: "100%",
        minWidth: 0,
        overflowX: "hidden",
        boxSizing: "border-box",
      }}
    >
      <Stack sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <Paper
          elevation={0}
          sx={{
            width: "100%",
            border: `1px solid ${alpha(theme.palette.primary.main, 0.16)}`,
            borderRadius: { xs: 3, md: 4 },
            overflow: "hidden",
            mb: { xs: 1, md: 1.5 },
            boxShadow: { xs: `0 2px 12px ${alpha(theme.palette.common.black, 0.08)}`, md: "none" },
            ...(isMdDown
              ? {
                  bgcolor: "background.paper",
                  borderBottom: `1px solid ${theme.palette.divider}`,
                }
              : {
                  background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.08)}, ${alpha(theme.palette.secondary.main, 0.05)})`,
                }),
          }}
        >
          {isMdDown ? (
            <Stack spacing={0.75} sx={{ px: { xs: 1, sm: 1.25 }, py: { xs: 0.85, sm: 1 }, width: "100%", minWidth: 0 }}>
              <Stack
                direction="row"
                alignItems="center"
                sx={{
                  gap: 1,
                  width: "100%",
                  minWidth: 0,
                  pb: 0.5,
                  borderBottom: `1px solid ${alpha(theme.palette.divider, 0.85)}`,
                }}
              >
                <Tooltip title={canOpenCashierSettings ? "الحساب والإعدادات" : "معاينة المدير"}>
                  <IconButton
                    size="small"
                    onClick={() => {
                      if (canOpenCashierSettings) navigate("/cashier/settings/account");
                    }}
                    sx={{
                      p: 0.25,
                      flexShrink: 0,
                      borderRadius: 2,
                      ...(canOpenCashierSettings
                        ? { "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.08) } }
                        : { cursor: "default" }),
                    }}
                    aria-label={canOpenCashierSettings ? "الحساب والإعدادات" : "صورة المستخدم"}
                  >
                    <Avatar
                      src={cashierAvatarSrc}
                      variant="rounded"
                      imgProps={{ decoding: "async" }}
                      sx={{
                        width: 40,
                        height: 40,
                        fontWeight: 800,
                        fontSize: "1rem",
                        bgcolor: alpha(theme.palette.primary.main, 0.14),
                        color: "primary.main",
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
                      }}
                    >
                      {cashierAvatarSrc ? null : cashierAvatarLetter}
                    </Avatar>
                  </IconButton>
                </Tooltip>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={800} sx={{ fontSize: { xs: "0.88rem", sm: "0.95rem" }, lineHeight: 1.35 }}>
                    {PHARMACY_DISPLAY_NAME}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, lineHeight: 1.2 }} noWrap>
                    الكاشير
                  </Typography>
                </Box>
                <Stack direction="row" alignItems="center" spacing={0.25} sx={{ flexShrink: 0, marginInlineStart: "auto" }}>
                  <Tooltip title="الإشعارات">
                    <IconButton
                      onClick={() => navigate("/cashier/notifications")}
                      color="primary"
                      size="small"
                      aria-label="الإشعارات"
                      sx={{
                        borderRadius: 2,
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                        bgcolor: alpha(theme.palette.primary.main, 0.06),
                        "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.12) },
                      }}
                    >
                      <Badge color="error" badgeContent={unreadNotifications} invisible={!unreadNotifications}>
                        <Notifications sx={{ fontSize: 20 }} />
                      </Badge>
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="الوضع الليلي / النهاري">
                    <IconButton
                      onClick={onToggleMode}
                      color="primary"
                      size="small"
                      aria-label="تبديل الوضع"
                      sx={{
                        borderRadius: 2,
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                        bgcolor: alpha(theme.palette.primary.main, 0.06),
                        "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.12) },
                      }}
                    >
                      {mode === "dark" ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
              <Box
                role="toolbar"
                aria-label="اختصارات الكاشير"
                sx={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "flex-end",
                  gap: { xs: 0.75, sm: 1 },
                  width: "100%",
                  maxWidth: "100%",
                  py: 0.5,
                  px: 0.25,
                  alignItems: "center",
                }}
              >
                {(() => {
                  const cellBtn = (extra = {}) => ({
                    width: 44,
                    height: 44,
                    borderRadius: 2,
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.14)}`,
                    bgcolor: alpha(theme.palette.primary.main, 0.06),
                    "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.12) },
                    ...extra,
                  });
                  return (
                    <>
                      {isSuperCashier(currentUser) ? (
                        <Tooltip title="لوحة التحكم">
                          <span style={{ display: "block", width: "100%", minWidth: 0 }}>
                            <IconButton
                              size="small"
                              onClick={() => navigate("/cashier/dashboard")}
                              aria-label="لوحة التحكم"
                              sx={cellBtn({
                                color: "secondary.main",
                                bgcolor: alpha(theme.palette.secondary.main, 0.1),
                                borderColor: alpha(theme.palette.secondary.main, 0.25),
                                "&:hover": { bgcolor: alpha(theme.palette.secondary.main, 0.2) },
                              })}
                            >
                              <Dashboard sx={{ fontSize: 22 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      ) : null}
{cashierSys.todaySalesButtonEnabled ? (
  <Button
    variant="outlined"
    color="primary"
    size="small"
    startIcon={<Today />}
    onClick={openTodaySales}  // ✅ استخدم openTodaySales بدلاً من الدالة المجهولة
    sx={{ textTransform: "none", fontWeight: 800 }}
  >
    بيع اليوم
  </Button>
) : null}
                      {cashierSys.debtPayFromCashierEnabled ? (
                        <Tooltip title="تسديد آجل">
                          <span style={{ display: "block", width: "100%", minWidth: 0 }}>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => {
                                setDebtPayOpen(true);
                                setDebtPayCustomerId("");
                                setDebtPayAmount("");
                              }}
                              aria-label="تسديد آجل"
                              sx={cellBtn()}
                            >
                              <AccountBalance sx={{ fontSize: 22 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      ) : null}
                      {cashierSys.offlineModeToggleEnabled ? (
                        <Tooltip title={offlineModeEnabled ? "أوفلاين مفعّل — اضغط للمزامنة أو الإيقاف" : "وضع عدم الاتصال"}>
                          <span style={{ display: "block", width: "100%", minWidth: 0 }}>
                            <IconButton
                              size="small"
                              color={offlineModeEnabled ? "warning" : "primary"}
                              onClick={() => {
                                if (offlineModeEnabled && pendingOfflineCount > 0 && isOnline) {
                                  setSyncConfirmOpen(true);
                                  return;
                                }
                                setOfflineModeEnabled((v) => !v);
                              }}
                              aria-label="وضع عدم الاتصال"
                              sx={cellBtn(
                                offlineModeEnabled
                                  ? {
                                      bgcolor: alpha(theme.palette.warning.main, 0.16),
                                      borderColor: alpha(theme.palette.warning.main, 0.35),
                                      "&:hover": { bgcolor: alpha(theme.palette.warning.main, 0.26) },
                                    }
                                  : {},
                              )}
                            >
                              <Badge color="warning" variant="dot" invisible={!offlineModeEnabled}>
                                <WifiOff sx={{ fontSize: 22 }} />
                              </Badge>
                            </IconButton>
                          </span>
                        </Tooltip>
                      ) : null}
                      {canOpenAdminDashboard ? (
                        <Tooltip title="لوحة التحكم">
                          <span style={{ display: "block", width: "100%", minWidth: 0 }}>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => navigate("/admin")}
                              aria-label="لوحة التحكم"
                              sx={cellBtn()}
                            >
                              <Dashboard sx={{ fontSize: 22 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      ) : null}
                      {showAdminCashierHeaderActions ? (
                        <>
                          <Tooltip title="تسجيل الخروج">
                            <span style={{ display: "block", width: "100%", minWidth: 0 }}>
                              <IconButton
                                size="small"
                                color="error"
                                onClick={finalizeLogout}
                                aria-label="تسجيل الخروج"
                                sx={cellBtn({
                                  color: "error.main",
                                  bgcolor: alpha(theme.palette.error.main, 0.08),
                                  borderColor: alpha(theme.palette.error.main, 0.28),
                                  "&:hover": { bgcolor: alpha(theme.palette.error.main, 0.16) },
                                })}
                              >
                                <Logout sx={{ fontSize: 22 }} />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </>
                      ) : null}
                      {currentUser?.role === "cashier" || currentUser?.role === "super_cashier" ? (
                        <Tooltip title="إنهاء الدوام">
                          <span style={{ display: "block", width: "100%", minWidth: 0 }}>
                            <IconButton
                              size="small"
                              onClick={() => setEndShiftOpen(true)}
                              aria-label="إنهاء الدوام"
                              sx={cellBtn({
                                color: "secondary.contrastText",
                                bgcolor: "secondary.main",
                                borderColor: "secondary.dark",
                                "&:hover": { bgcolor: "secondary.dark" },
                              })}
                            >
                              <EventAvailable sx={{ fontSize: 22 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      ) : null}
                    </>
                  );
                })()}
              </Box>
            </Stack>
          ) : (
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              sx={{ px: { sm: 2, md: 3 }, py: 2, gap: 2, flexWrap: "wrap", rowGap: 1.5 }}
            >
              <Stack direction="row" alignItems="center" sx={{ gap: 1.25, flexWrap: "wrap", minWidth: 0, flex: 1 }}>
                <Tooltip title={canOpenCashierSettings ? "الحساب والإعدادات" : "معاينة المدير"}>
                  <IconButton
                    size="small"
                    onClick={() => {
                      if (canOpenCashierSettings) navigate("/cashier/settings/account");
                    }}
                    sx={{
                      p: 0.25,
                      ...(canOpenCashierSettings
                        ? { "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.08) } }
                        : { cursor: "default" }),
                    }}
                    aria-label={canOpenCashierSettings ? "الحساب والإعدادات" : "صورة المستخدم"}
                  >
                    <Avatar
                      src={cashierAvatarSrc}
                      imgProps={{ decoding: "async" }}
                      sx={{
                        width: 44,
                        height: 44,
                        fontWeight: 800,
                        bgcolor: alpha(theme.palette.primary.main, 0.14),
                        color: "primary.main",
                        border: `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
                      }}
                    >
                      {cashierAvatarSrc ? null : cashierAvatarLetter}
                    </Avatar>
                  </IconButton>
                </Tooltip>
                <Box sx={{ minWidth: 0 }}>
                  <Typography fontWeight={900} color="primary.main" noWrap sx={{ maxWidth: { sm: 480 } }}>
                    {PHARMACY_DISPLAY_NAME} — الكاشير
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {currentUser?.username ? `@${currentUser.username}` : "الكاشير"}
                  </Typography>
                </Box>
              </Stack>

              <Stack
                direction="row"
                alignItems="center"
                justifyContent="flex-end"
                flexWrap="wrap"
                sx={{ gap: 1.25, columnGap: 1.5, rowGap: 1.25, minWidth: 0, flex: 1 }}
              >
                <Stack
                  direction="row"
                  alignItems="center"
                  flexWrap="wrap"
                  sx={{
                    gap: 1,
                    justifyContent: "flex-end",
                    px: 1,
                    py: 0.5,
                    borderRadius: 2,
                    bgcolor: alpha(theme.palette.primary.main, 0.04),
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
                  }}
                >
                  {cashierSys.todaySalesButtonEnabled ? (
                    <Button
                      variant="outlined"
                      color="primary"
                      size="small"
                      startIcon={<Today />}
                      onClick={openTodaySales}  // ✅ تغيير هنا

                      sx={{ textTransform: "none", fontWeight: 800 }}
                    >
                      بيع اليوم
                    </Button>
                  ) : null}
                  {cashierSys.debtPayFromCashierEnabled ? (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AccountBalance sx={{ fontSize: 18 }} />}
                      onClick={() => {
                        setDebtPayOpen(true);
                        setDebtPayCustomerId("");
                        setDebtPayAmount("");
                      }}
                      sx={{ textTransform: "none", fontWeight: 800 }}
                    >
                      تسديد آجل
                    </Button>
                  ) : null}
                  {cashierSys.offlineModeToggleEnabled ? (
                    <Button
                      variant={offlineModeEnabled ? "contained" : "outlined"}
                      color={offlineModeEnabled ? "warning" : "primary"}
                      size="small"
                      onClick={() => {
                        if (offlineModeEnabled && pendingOfflineCount > 0 && isOnline) {
                          setSyncConfirmOpen(true);
                          return;
                        }
                        setOfflineModeEnabled((v) => !v);
                      }}
                      sx={{ textTransform: "none", fontWeight: 800 }}
                    >
                      {offlineModeEnabled ? "أوفلاين: مفعّل" : "أوفلاين"}
                    </Button>
                  ) : null}
                </Stack>

                <Divider
                  orientation="vertical"
                  flexItem
                  sx={{
                    alignSelf: "stretch",
                    borderColor: alpha(theme.palette.divider, 0.9),
                    display: { xs: "none", md: "block" },
                  }}
                />

                <Stack direction="row" alignItems="center" flexWrap="wrap" sx={{ gap: 1, justifyContent: "flex-end" }}>
                  {canOpenAdminDashboard ? (
                    <Button
                      variant="contained"
                      color="secondary"
                      size="small"
                      startIcon={<Dashboard fontSize="small" />}
                      onClick={() => navigate("/admin")}
                      sx={{ textTransform: "none", fontWeight: 800 }}
                    >
                      لوحة التحكم
                    </Button>
                  ) : null}
                  {currentUser?.role === "cashier" || currentUser?.role === "super_cashier" ? (
                    <Button
                      variant="contained"
                      color="secondary"
                      size="small"
                      startIcon={<EventAvailable />}
                      onClick={() => setEndShiftOpen(true)}
                      sx={{ textTransform: "none", fontWeight: 800 }}
                    >
                      إنهاء الدوام
                    </Button>
                  ) : null}
                  {showAdminCashierHeaderActions ? (
                    <>
                      <Button
                        variant="outlined"
                        color="primary"
                        size="small"
                        startIcon={<AdminPanelSettings fontSize="small" />}
                        onClick={() => navigate("/admin")}
                        sx={{ textTransform: "none", fontWeight: 800 }}
                      >
                        لوحة الإدارة
                      </Button>
                      <Button
                        variant="outlined"
                        color="error"
                        size="small"
                        startIcon={<Logout fontSize="small" />}
                        onClick={finalizeLogout}
                        sx={{ textTransform: "none", fontWeight: 700 }}
                      >
                        خروج
                      </Button>
                    </>
                  ) : null}
                </Stack>

                <Divider
                  orientation="vertical"
                  flexItem
                  sx={{
                    alignSelf: "stretch",
                    borderColor: alpha(theme.palette.divider, 0.9),
                    display: { xs: "none", md: "block" },
                  }}
                />

                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={0.5}
                  sx={{
                    flexShrink: 0,
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 2,
                    border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                    bgcolor: alpha(theme.palette.primary.main, 0.03),
                  }}
                >
                  <Tooltip title="الإشعارات">
                    <IconButton onClick={() => navigate("/cashier/notifications")} color="primary" aria-label="الإشعارات" size="small">
                      <Badge color="error" badgeContent={unreadNotifications} invisible={!unreadNotifications}>
                        <Notifications fontSize="small" />
                      </Badge>
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="الوضع الليلي / النهاري">
                    <IconButton onClick={onToggleMode} color="primary" size="small" aria-label="تبديل الوضع">
                      {mode === "dark" ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
            </Stack>
          )}
        </Paper>

        {shiftFeedback ? (
          <Typography variant="body2" color="success.main" fontWeight={700} sx={{ px: 1, mb: 0.5 }}>
            {shiftFeedback}
          </Typography>
        ) : null}
        <Typography
          variant="caption"
          color={isOnline ? "success.main" : "warning.main"}
          fontWeight={700}
          sx={{ px: 1, mb: 0.5, display: "block" }}
        >
          {isOnline ? "حالة الإنترنت: متصل" : "حالة الإنترنت: غير متصل"}
          {pendingOfflineCount > 0 ? ` · فواتير بانتظار المزامنة: ${pendingOfflineCount}` : ""}
        </Typography>
        {repeatInvoiceFeedback ? (
          <Typography variant="body2" color="info.main" fontWeight={700} sx={{ px: 1, mb: 0.5 }}>
            {repeatInvoiceFeedback}
          </Typography>
        ) : null}

<Dialog
  open={todaySalesOpen}
  onClose={() => setTodaySalesOpen(false)}
  fullWidth
  maxWidth="lg" // 👈 changed from 'md' to 'lg' to accommodate more columns
  fullScreen={isSmDown}
  slotProps={cashierDlgSlotProps}
>
  <DialogTitle sx={cashierDlgTitleSx}>
    <Typography component="div" variant="h6" fontWeight={900}>
      بيع اليوم
    </Typography>
    <Typography component="div" variant="body2" color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.55, fontWeight: 500 }}>
      {currentUser?.role === "admin" || currentUser?.role === "super_admin"
        ? "جميع فواتير اليوم (معاينة المدير)."
        : "فواتيرك المسجّلة اليوم فقط. إعادة الفاتورة تضيف البنود للسلة وتُسجَّل في مرتجعات المبيعات."}
    </Typography>
  </DialogTitle>
  <DialogContent dividers sx={{ ...cashierDlgContentSx, px: { xs: 1, sm: 2.5 } }}>
    <TableContainer
      component={Paper}
      variant="outlined"
      sx={{ borderRadius: 2, maxWidth: "100%", overflowX: "auto" }}
    >
      <Table size="small" sx={{ tableLayout: "fixed", minWidth: 900 }}> {/* 👈 increased min-width */}
      <TableHead>
  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
    <TableCell align="center" sx={{ fontWeight: 800, width: "8%" }}>
      النوع
    </TableCell>
  
    <TableCell align="center" sx={{ fontWeight: 800, width: "12%" }}>
      التاريخ والوقت
    </TableCell>
    <TableCell align="center" sx={{ fontWeight: 800, width: "12%" }}>
      الزبون
    </TableCell>
    <TableCell align="center" sx={{ fontWeight: 800, width: "10%" }}>
      طريقة الدفع
    </TableCell>
    <TableCell align="center" sx={{ fontWeight: 800, width: "10%" }}>
      الإجمالي
    </TableCell>
    <TableCell align="center" sx={{ fontWeight: 800, width: "10%" }}>
      💰 دفع
    </TableCell>
    <TableCell align="center" sx={{ fontWeight: 800, width: "10%" }}>
      📌 متبقي
    </TableCell>
    <TableCell align="center" sx={{ fontWeight: 800, width: "6%" }}>
      تفاصيل
    </TableCell>
  </TableRow>
</TableHead>


<TableBody>
  {todayTransactions.length === 0 ? (
    <TableRow>
      <TableCell colSpan={9} align="center">
        <Typography variant="body2" color="text.secondary">
          لا توجد حركات لهذا اليوم
        </Typography>
      </TableCell>
    </TableRow>
  ) : (
    todayTransactions
      .slice((safeTransactionsPage - 1) * TODAY_SALES_ROWS, safeTransactionsPage * TODAY_SALES_ROWS)
      .map((row) => {
          const isDebtPayment = row.type === 'debt_payment';
          
          return (
            <TableRow key={row.id} hover>
              {/* عمود النوع */}
              <TableCell align="center">
                {isDebtPayment ? (
                  <Chip 
                    size="small" 
                    label="تسديد دين"
                    color="success" 
                    variant="outlined"
                    icon={<PaymentsOutlined sx={{ fontSize: 14 }} />}
                  />
                ) : (
                  <Chip 
                    size="small" 
                    label="فاتورة"
                    color="primary" 
                    variant="outlined"
                    icon={<ReceiptLongOutlined sx={{ fontSize: 14 }} />}
                  />
                )}
              </TableCell>
              
          
              
              {/* التاريخ والوقت */}
              <TableCell align="center">
                <Typography variant="body2">
                  {row.occurred_at ? new Date(row.occurred_at).toLocaleDateString("ar-EG") : "-"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {row.occurred_at ? new Date(row.occurred_at).toLocaleTimeString("ar-EG") : "-"}
                </Typography>
              </TableCell>
              
              {/* الزبون */}
              <TableCell align="center">
                <Tooltip title={row.customer_name} arrow>
                  <Typography 
                    variant="body2" 
                    fontWeight={600} 
                    sx={{ 
                      maxWidth: 140, 
                      overflow: "hidden", 
                      textOverflow: "ellipsis", 
                      whiteSpace: "nowrap" 
                    }}
                  >
                    {row.customer_name}
                  </Typography>
                </Tooltip>
              </TableCell>
              
              {/* طريقة الدفع */}
              <TableCell align="center">
                {row.payment_method === "app" ? (
                  <Chip size="small" label="تطبيق" color="info" variant="outlined" />
                ) : row.payment_method === "credit" ? (
                  <Chip size="small" label="آجل" color="warning" variant="outlined" />
                ) : row.payment_method === "card" ? (
                  <Chip size="small" label="بطاقة" color="secondary" variant="outlined" />
                ) : (
                  <Chip size="small" label="كاش" color="success" variant="outlined" />
                )}
              </TableCell>
              
              {/* الإجمالي */}
              <TableCell align="center" sx={{ fontWeight: 700 }}>
                {row.total_amount.toFixed(1)} شيكل
              </TableCell>
              
              {/* المبلغ المدفوع */}
              <TableCell align="center">
                <Typography variant="body2" fontWeight={800} sx={{ color: "success.main" }}>
                  {row.paid_amount.toFixed(1)} شيكل
                </Typography>
              </TableCell>
              
              {/* المبلغ المتبقي */}
              <TableCell align="center">
                <Typography variant="body2" fontWeight={800} sx={{ color: row.due_amount > 0 ? "error.main" : "success.main" }}>
                  {row.due_amount > 0 ? `${row.due_amount.toFixed(1)} شيكل` : "✔ مدفوع"}
                </Typography>
              </TableCell>
              
              {/* تفاصيل - فقط للفواتير */}
              <TableCell align="center">
                {!isDebtPayment && (
                 // استبدل Button في TableBody بهذا:

<Button
  size="small"
  variant="outlined"
  onClick={() => {
    // استخراج رقم الفاتورة من المرجع
    const orderId = row.id?.replace('order_', '');
    const referenceNumber = row.reference_number;
    fetchInvoiceDetails(orderId, referenceNumber);
  }}
  sx={{ textTransform: "none", fontWeight: 700 }}
>
  عرض
</Button>
                )}
              </TableCell>
            </TableRow>
          );
        })

  )}
</TableBody>



      </Table>
    </TableContainer>
    {todaySalesForCashier.length > TODAY_SALES_ROWS ? (
      <Stack direction="row" justifyContent="center" sx={{ mt: 1.5 }}>
        <Pagination
          count={todaySalesPageCount}
          page={safeTodayPage}
          onChange={(_, v) => setTodaySalesPage(v)}
          color="primary"
          shape="rounded"
        />
      </Stack>
    ) : null}
  </DialogContent>
  <DialogActions sx={cashierDlgActionsSx}>
    <Button onClick={() => setTodaySalesOpen(false)} variant="contained" sx={{ textTransform: "none" }}>
      إغلاق
    </Button>
  </DialogActions>
</Dialog>


        <Dialog
          open={Boolean(detailTodayInvoice)}
          onClose={() => setDetailTodayInvoice(null)}
          fullWidth
          maxWidth="md"
          fullScreen={isSmDown}
          slotProps={cashierDlgSlotProps}
        >
          <DialogTitle sx={cashierDlgTitleSx}>
            <Typography component="div" variant="h6" fontWeight={900}>
              تفاصيل الفاتورة
            </Typography>
            <Typography component="div" variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
              رقم الفاتورة:{" "}
              <Box component="span" fontWeight={800} color="text.primary">
                {detailTodayInvoice?.id ?? "—"}
              </Box>
            </Typography>
          </DialogTitle>
          <DialogContent dividers sx={cashierDlgContentSx}>
            <Typography variant="overline" color="text.secondary" fontWeight={800} sx={{ display: "block", mb: 1, letterSpacing: 0.5 }}>
              بيانات الفاتورة
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell
                      sx={{
                        fontWeight: 800,
                        width: "38%",
                        bgcolor: alpha(theme.palette.primary.main, 0.06),
                        borderRight: `1px solid ${theme.palette.divider}`,
                      }}
                    >
                      البائع
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {detailTodayInvoice?.soldBy || "—"}
                      {detailTodayInvoice?.soldByRole ? (
                        <Typography component="span" variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                          ({detailTodayInvoice.soldByRole})
                        </Typography>
                      ) : null}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell
                      sx={{
                        fontWeight: 800,
                        bgcolor: alpha(theme.palette.primary.main, 0.06),
                        borderRight: `1px solid ${theme.palette.divider}`,
                      }}
                    >
                      التاريخ والوقت
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {detailTodayInvoice?.soldAt ? new Date(detailTodayInvoice.soldAt).toLocaleString("en-GB") : "—"}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell
                      sx={{
                        fontWeight: 800,
                        bgcolor: alpha(theme.palette.primary.main, 0.06),
                        borderRight: `1px solid ${theme.palette.divider}`,
                      }}
                    >
                      طريقة الدفع
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>
                      {detailTodayInvoice?.paymentMethod === "app"
                        ? "تطبيق"
                        : detailTodayInvoice?.paymentMethod === "credit"
                          ? `آجل${detailTodayInvoice?.creditCustomerName ? ` — ${detailTodayInvoice.creditCustomerName}` : ""}`
                          : "كاش"}
                    </TableCell>
                  </TableRow>
                  {Number(detailTodayInvoice?.discountAmount || 0) > 0 ? (
                    <TableRow>
                      <TableCell
                        sx={{
                          fontWeight: 800,
                          bgcolor: alpha(theme.palette.primary.main, 0.06),
                          borderRight: `1px solid ${theme.palette.divider}`,
                        }}
                      >
                        الخصم
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontWeight={700}>
                          قبل الخصم: {roundOneDecimal(Number(detailTodayInvoice?.subTotal || 0)).toFixed(1)} شيكل
                        </Typography>
                        <Typography variant="body2" color="error.main" fontWeight={800} sx={{ mt: 0.25 }}>
                          خصم: {roundOneDecimal(Number(detailTodayInvoice.discountAmount)).toFixed(1)} شيكل
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
            <Typography variant="overline" color="text.secondary" fontWeight={800} sx={{ display: "block", mb: 1, letterSpacing: 0.5 }}>
              بنود الفاتورة
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
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
                      السعر
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>
                      الإجمالي
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(Array.isArray(detailTodayInvoice?.items) && detailTodayInvoice.items.length
                    ? detailTodayInvoice.items
                    : []
                  ).map((it, i) => {
                    const qty = Number(it.qty ?? 0);
                    const unit = Number(it.price ?? 0);
                    const lineTotal = Number(it.total ?? qty * unit);
                    return (
                      <TableRow key={`${it.productId ?? it.name}-${i}`}>
                        <TableCell align="center">{i + 1}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600 }}>
                          {it.name || "-"}
                        </TableCell>
                        <TableCell align="center">{roundOneDecimal(qty).toFixed(1)}</TableCell>
                        <TableCell align="center">{roundOneDecimal(unit).toFixed(1)} شيكل</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>
                          {roundOneDecimal(lineTotal).toFixed(1)} شيكل
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            <Paper variant="outlined" sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: alpha(theme.palette.success.main, 0.06) }}>
              <Typography variant="subtitle1" fontWeight={900} textAlign="center">
                إجمالي الفاتورة: {roundOneDecimal(detailTodayInvoice?.total).toFixed(1)} شيكل
              </Typography>
            </Paper>
          </DialogContent>
          <DialogActions sx={{ ...cashierDlgActionsSx, flexWrap: "wrap" }}>
            <Button onClick={() => setDetailTodayInvoice(null)} sx={{ textTransform: "none" }}>
              إغلاق
            </Button>
            <Button
              variant="contained"
              color="secondary"
              disabled={!detailTodayInvoice?.items?.length}
              onClick={() => repeatInvoiceToCart(detailTodayInvoice)}
              sx={{ textTransform: "none", fontWeight: 800 }}
            >
              إعادة الفاتورة للسلة
            </Button>
            <Button
              variant="outlined"
              disabled={!detailTodayInvoice?.items?.length}
              onClick={() => {
                const maxPrints = Math.max(1, Number(cashierSys.reprintMaxCashier || 1));
                const currentCount = readInvoicePrintCount(detailTodayInvoice?.id);
                if (
                  cashierSys.approvalWorkflowEnabled &&
                  cashierSys.reprintApprovalEnabled &&
                  cashierSys.reprintRestricted &&
                  currentUser?.role === "cashier" &&
                  currentCount >= maxPrints
                ) {
                  createApprovalRequest({
                    requestType: "reprint",
                    requestedBy: currentUser?.username || "",
                    invoiceId: detailTodayInvoice?.id || null,
                    requestData: {
                      printCount: currentCount,
                      maxPrints,
                    },
                    reason: "تجاوز حد إعادة الطباعة للكاشير",
                  });
                  showAppToast("تم إرسال طلب موافقة لإعادة الطباعة", "warning");
                  return;
                }
                setPrintInvoice(detailTodayInvoice);
              }}
              sx={{ textTransform: "none", fontWeight: 800 }}
            >
              إعادة طباعة
            </Button>
          </DialogActions>
        </Dialog>
{/* ============= تبويبات الطلبات المتعددة ============= */}
<Paper
  elevation={0}
  sx={{
    mb: 1.5,
    p: 0.75,
    borderRadius: 2,
    bgcolor: alpha(theme.palette.primary.main, 0.04),
    border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
    overflowX: "auto",
    whiteSpace: "nowrap",
    display: "flex",
    alignItems: "center",
    gap: 0.5,
    "&::-webkit-scrollbar": { height: 3 },
  }}
>
  {orderTabs.map((tab) => (
    <Box
      key={tab.id}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.25,
        borderRadius: 1.5,
        px: 0.75,
        py: 0.25,
        bgcolor: activeTabId === tab.id ? "primary.main" : "transparent",
        color: activeTabId === tab.id ? "white" : "text.primary",
        cursor: "pointer",
        transition: "all 0.15s",
        "&:hover": {
          bgcolor: activeTabId === tab.id 
            ? alpha(theme.palette.primary.main, 0.85)
            : alpha(theme.palette.primary.main, 0.08),
        },
      }}
      onClick={() => setActiveTabId(tab.id)}
    >
      {editingTabId === tab.id ? (
        <TextField
          autoFocus
          size="small"
          value={editingTabValue}
          onChange={(e) => setEditingTabValue(e.target.value)}
          onBlur={() => {
            if (editingTabValue.trim()) {
              setOrderTabs(prev => prev.map(t => 
                t.id === tab.id ? { ...t, label: editingTabValue.trim() } : t
              ));
            }
            setEditingTabId(null);
            setEditingTabValue("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              if (editingTabValue.trim()) {
                setOrderTabs(prev => prev.map(t => 
                  t.id === tab.id ? { ...t, label: editingTabValue.trim() } : t
                ));
              }
              setEditingTabId(null);
              setEditingTabValue("");
            }
            if (e.key === "Escape") {
              setEditingTabId(null);
              setEditingTabValue("");
            }
          }}
          sx={{
            width: 110,
            "& .MuiInputBase-root": {
              fontSize: "0.7rem",
              fontWeight: 600,
              py: 0,
              px: 0.5,
              bgcolor: "background.paper",
            },
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <Typography
          variant="body2"
          fontWeight={600}
          sx={{
            px: 0.5,
            py: 0.25,
            fontSize: "0.7rem",
            userSelect: "none",
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditingTabId(tab.id);
            setEditingTabValue(tab.label);
          }}
        >
          {tab.label}
        </Typography>
      )}
      
      <Typography
        variant="caption"
        sx={{
          fontSize: "0.6rem",
          fontWeight: 500,
          color: activeTabId === tab.id ? alpha("#fff", 0.8) : "text.secondary",
        }}
      >
        ({tab.cart?.length || 0})
      </Typography>
      
      {orderTabs.length > 1 && (
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            closeOrderTab(tab.id);
          }}
          sx={{
            p: 0.25,
            ml: 0.25,
            color: activeTabId === tab.id ? alpha("#fff", 0.7) : "text.secondary",
            "&:hover": {
              color: activeTabId === tab.id ? "#fff" : "error.main",
              bgcolor: alpha(theme.palette.error.main, 0.1),
            },
          }}
        >
          <Close sx={{ fontSize: 11 }} />
        </IconButton>
      )}
    </Box>
  ))}
  
  <Tooltip title="طلب جديد">
    <IconButton
      size="small"
      onClick={createNewOrderTab}
      sx={{
        p: 0.5,
        ml: 0.25,
        bgcolor: alpha(theme.palette.success.main, 0.1),
        borderRadius: 1.5,
        "&:hover": { bgcolor: alpha(theme.palette.success.main, 0.2) },
      }}
    >
      <Add sx={{ fontSize: 15 }} />
    </IconButton>
  </Tooltip>
</Paper>
        <Dialog
          open={thankYouOpen}
          onClose={finalizeLogout}
          fullWidth
          maxWidth="xs"
          slotProps={cashierDlgSlotProps}
        >
          <DialogTitle sx={cashierDlgTitleSx}>
            <Stack direction="row" alignItems="center" gap={1.25} flexWrap="wrap">
              <Avatar sx={{ bgcolor: alpha(theme.palette.success.main, 0.15), color: "success.main" }}>
                <CheckCircle />
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" fontWeight={900}>
                  شكراً لجهدك
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                  تم إنهاء الدوام بنجاح
                </Typography>
              </Box>
            </Stack>
          </DialogTitle>
          <DialogContent dividers sx={cashierDlgContentSx}>
            <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1.5 }}>
              يعطيك الف عافية
            </Typography>
            <Stack component="ul" sx={{ m: 0, pl: 2.25, listStyle: "disc", "& li": { display: "list-item" } }} spacing={1}>
              <Typography component="li" variant="body2" color="text.secondary">
                تم إنهاء الدوام على هذا الجهاز.
              </Typography>
              <Typography component="li" variant="body2" color="text.secondary">
                يُبلَّغ المدير بملخص الجلسة عند تفعيل الإشعارات.
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions sx={cashierDlgActionsSx}>
            <Button variant="contained" onClick={finalizeLogout} sx={{ textTransform: "none", fontWeight: 800 }}>
              متابعة
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog
          open={endShiftOpen}
          onClose={() => setEndShiftOpen(false)}
          fullWidth
          maxWidth="sm"
          slotProps={cashierDlgSlotProps}
        >
          <DialogTitle sx={cashierDlgTitleSx}>
            <Stack direction="row" alignItems="center" gap={1.25} flexWrap="wrap">
              <Avatar sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.15), color: "secondary.main" }}>
                <EventAvailable />
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" fontWeight={900}>
                  تأكيد إنهاء الدوام
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.25 }}>
                  راجع الأرقام ثم أرسل ملخص الجلسة للمدير
                </Typography>
              </Box>
            </Stack>
          </DialogTitle>
          <DialogContent dividers sx={cashierDlgContentSx}>
            <Alert severity="info" icon={<InfoOutlined />} sx={{ mb: 2, borderRadius: 2, textAlign: "right" }}>
              يُرسل للمدير إشعار واحد يتضمن ملخص هذه الجلسة فقط، وليس بعد كل فاتورة.
            </Alert>
            <Typography variant="overline" color="text.secondary" fontWeight={800} sx={{ display: "block", mb: 1, letterSpacing: 0.5 }}>
              ملخص المبيعات (الجلسة الحالية)
            </Typography>
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableBody>
                  <TableRow>
                    <TableCell
                      sx={{
                        fontWeight: 800,
                        width: "42%",
                        bgcolor: alpha(theme.palette.primary.main, 0.06),
                        borderRight: `1px solid ${theme.palette.divider}`,
                      }}
                    >
                      عدد الفواتير
                    </TableCell>
                    <TableCell sx={{ fontWeight: 900 }}>{shiftStats.invoiceCount}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell
                      sx={{
                        fontWeight: 800,
                        bgcolor: alpha(theme.palette.primary.main, 0.06),
                        borderRight: `1px solid ${theme.palette.divider}`,
                      }}
                    >
                      إجمالي المبيعات
                    </TableCell>
                    <TableCell sx={{ fontWeight: 900, ...negativeAmountTextSx(shiftStats.total) }}>
                      {roundOneDecimal(shiftStats.total).toFixed(1)} شيكل
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell
                      sx={{
                        fontWeight: 800,
                        bgcolor: alpha(theme.palette.primary.main, 0.06),
                        borderRight: `1px solid ${theme.palette.divider}`,
                      }}
                    >
                      كاش
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800, ...negativeAmountTextSx(shiftStats.cash) }}>
                      {roundOneDecimal(shiftStats.cash).toFixed(1)} شيكل
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell
                      sx={{
                        fontWeight: 800,
                        bgcolor: alpha(theme.palette.primary.main, 0.06),
                        borderRight: `1px solid ${theme.palette.divider}`,
                      }}
                    >
                      تطبيق
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800, ...negativeAmountTextSx(shiftStats.app) }}>
                      {roundOneDecimal(shiftStats.app).toFixed(1)} شيكل
                    </TableCell>
                  </TableRow>
                  {roundOneDecimal(shiftStats.credit || 0) > 0 ? (
                    <TableRow>
                      <TableCell
                        sx={{
                          fontWeight: 800,
                          bgcolor: alpha(theme.palette.primary.main, 0.06),
                          borderRight: `1px solid ${theme.palette.divider}`,
                        }}
                      >
                        آجل
                      </TableCell>
                      <TableCell sx={{ fontWeight: 800, ...negativeAmountTextSx(shiftStats.credit || 0) }}>
                        {roundOneDecimal(shiftStats.credit || 0).toFixed(1)} شيكل
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
          </DialogContent>
          <DialogActions sx={cashierDlgActionsSx}>
            <Button onClick={() => setEndShiftOpen(false)} sx={{ textTransform: "none" }}>
              إلغاء
            </Button>
            <Button variant="contained" color="secondary" onClick={confirmEndShift} sx={{ textTransform: "none", fontWeight: 800 }}>
              تأكيد وإرسال للمدير
            </Button>
          </DialogActions>
        </Dialog>

        <Stack
          direction={{ xs: "column", md: "row" }}
          sx={{
            flex: 1,
            minHeight: 0,
            overflow: { xs: "auto", md: "hidden" },
            width: "100%",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <Paper
            elevation={0}
            sx={{
              width: { md: 110 },
              p: 1,
              display: { xs: "none", md: "block" },
              order: { xs: 0, md: 0 },
              borderLeft: { md: `1px solid ${theme.palette.divider}` },
              bgcolor: alpha(theme.palette.background.paper, 0.8),
            }}
          >
            <Stack spacing={1.5} alignItems="center">
              {categoryTabs.map((cat) => (
                <Button
                  key={cat.id === CASHIER_ALL_CATEGORIES_TAB ? "cashier-cat-all" : `cashier-cat-${String(cat.id)}`}
                  onClick={() => setActiveCategory(cat.id)}
                  sx={{
                    minWidth: 0,
                    width: "100%",
                    py: 1.2,
                    borderRadius: 2,
                    textTransform: "none",
                    color: String(activeCategory) === String(cat.id) ? "primary.main" : "text.secondary",
                    bgcolor:
                      String(activeCategory) === String(cat.id) ? alpha(theme.palette.primary.main, 0.15) : "transparent",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {cat.name}
                </Button>
              ))}
            </Stack>
          </Paper>

          <Box
            sx={{
              display: { xs: "block", md: "none" },
              order: { xs: 2, md: 0 },
              px: { xs: 1, sm: 1.5 },
              py: 1.25,
              borderTop: { xs: `1px solid ${theme.palette.divider}`, md: "none" },
              borderBottom: { xs: "none", md: `1px solid ${theme.palette.divider}` },
              bgcolor: alpha(theme.palette.background.paper, 0.98),
            }}
          >
            <Stack
              direction="row"
              sx={{
                gap: 1,
                overflowX: "auto",
                pb: 0.5,
                mx: -0.5,
                px: 0.5,
                scrollbarWidth: "thin",
                "&::-webkit-scrollbar": { height: 5 },
                "&::-webkit-scrollbar-thumb": {
                  borderRadius: 99,
                  bgcolor: alpha(theme.palette.primary.main, 0.35),
                },
              }}
            >
              {categoryTabs.map((cat) => (
                <Button
                  key={cat.id === CASHIER_ALL_CATEGORIES_TAB ? "cashier-cat-all" : `cashier-cat-${String(cat.id)}`}
                  onClick={() => setActiveCategory(cat.id)}
                  variant={String(activeCategory) === String(cat.id) ? "contained" : "outlined"}
                  color={String(activeCategory) === String(cat.id) ? "primary" : "inherit"}
                  size="small"
                  sx={{
                    flexShrink: 0,
                    borderRadius: 99,
                    textTransform: "none",
                    fontWeight: 800,
                    px: 2,
                    minWidth: "auto",
                    borderColor: alpha(theme.palette.primary.main, 0.35),
                  }}
                >
                  {cat.name}
                </Button>
              ))}
            </Stack>
          </Box>

          <Box
            sx={{
              flex: { xs: 1, md: 1 },
              order: { xs: 1, md: 0 },
              minHeight: { xs: 0, md: 0 },
              p: { xs: 1.5, sm: 2, md: 2.5 },
              overflow: "auto",
              minWidth: 0,
              WebkitOverflowScrolling: "touch",
            }}
          >
            <Stack spacing={1.25} sx={{ mb: 2 }}>
              <Typography
                variant="overline"
                color="text.secondary"
                sx={{ display: { xs: "block", md: "none" }, fontWeight: 800, letterSpacing: 0.5 }}
              >
                تصفّح الأصناف والبحث — أسفل الطلب الحالي
              </Typography>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                justifyContent="space-between"
                alignItems={{ xs: "stretch", sm: "center" }}
                flexWrap="wrap"
                gap={1}
              >
                <Typography variant="h6" fontWeight={800}>
                  اصناف الصيدلية
                </Typography>
                {cashierSys.productSortFiltersEnabled ? (
                  <Stack direction="row" spacing={2} sx={{ gap: 1, flexWrap: "wrap" }}>
                    <Button
                      size="small"
                      variant={productSortMode === "top" ? "contained" : "outlined"}
                      onClick={() => setProductSortMode((m) => (m === "top" ? "default" : "top"))}
                      sx={{ textTransform: "none", fontWeight: 800 }}
                    >
                      الأكثر مبيعاً
                    </Button>
                    <Button
                      size="small"
                      variant={productSortMode === "new" ? "contained" : "outlined"}
                      onClick={() => setProductSortMode((m) => (m === "new" ? "default" : "new"))}
                      sx={{ textTransform: "none", fontWeight: 800 }}
                    >
                      الأحدث
                    </Button>
                  </Stack>
                ) : null}
              </Stack>
              <TextField
                fullWidth
                size="small"
                placeholder={
                  cashierSys.barcodeScanEnabled
                    ? "بحث بالاسم أو أدخل الباركود ثم Enter"
                    : "بحث بالاسم أو القسم (الباركود معطّل من الإعدادات)"
                }
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && cashierSys.barcodeScanEnabled) {
                    e.preventDefault();
                    tryBarcodeQuickAdd(productFilter);
                  }
                }}
                inputProps={{ dir: "rtl" }}
              />
            </Stack>

            <Grid container spacing={{ xs: 1.5, sm: 2 }}>
              {shownProducts.map((item) => {
                const compactTextOnly = !(cashierSys.showProductImages !== false && item.image);
                return (
                <Grid
                  key={`${item.id}::${String(item.variantLabel || "").slice(0, 48)}`}
                  size={compactTextOnly ? { xs: 12, sm: 6, md: 4, lg: 2, xl: 2 } : { xs: 12, sm: 6, md: 6, lg: 4, xl: 3 }}
                >
                  <Card
                    onClick={() => addProductFromCatalogCard(item)}
                    sx={{
                      borderRadius: 3,
                      border: `1px solid ${theme.palette.divider}`,
                      cursor: "pointer",
                      transition: "box-shadow 0.15s, transform 0.15s",
                      "&:hover": { boxShadow: `0 6px 20px ${alpha(theme.palette.common.black, 0.08)}` },
                    }}
                  >
                    {cashierSys.showProductImages !== false && item.image ? (
                      <Box
                        sx={{
                          height: 120,
                          bgcolor: alpha(theme.palette.primary.main, 0.1),
                          display: "grid",
                          placeItems: "center",
                          backgroundImage: `url(${item.image})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          pointerEvents: "none",
                        }}
                      />
                    ) : null}
                    <CardContent
                      sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: compactTextOnly ? 0.45 : 0.75,
                        pt: cashierSys.showProductImages !== false && item.image ? 2 : 1.5,
                        height: "100%",
                      }}
                    >
                      <Typography
                        fontWeight={700}
                        sx={{
                          lineHeight: compactTextOnly ? 1.2 : 1.35,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: compactTextOnly ? 1 : 2,
                          WebkitBoxOrient: "vertical",
                          wordBreak: "break-word",
                          textAlign: compactTextOnly ? "center" : "inherit",
                        }}
                      >
                        {productDisplayName(item)}
                      </Typography>
                      {!compactTextOnly ? (
                        <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          lineHeight: 1.3,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          wordBreak: "break-word",
                        }}
                      >
                        {item.desc}
                      </Typography>
                      ) : null}
                      {!compactTextOnly && (String(item.usageHowTo || "").trim() || String(item.usageFrequency || "").trim()) ? (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{
                            lineHeight: 1.25,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            bgcolor: alpha(theme.palette.info.main, 0.08),
                            border: `1px solid ${alpha(theme.palette.info.main, 0.25)}`,
                            borderRadius: 1.25,
                            px: 0.9,
                            py: 0.45,
                          }}
                        >
                          {String(item.usageHowTo || "").trim() || "—"} • {String(item.usageFrequency || "").trim() || "—"}
                        </Typography>
                      ) : null}
                      <Stack
                        direction="row"
                        justifyContent={compactTextOnly ? "center" : "space-between"}
                        alignItems="center"
                        spacing={1}
                        sx={{ mt: compactTextOnly ? "auto" : 0 }}
                      >
                        <Stack
                          direction="row"
                          alignItems="center"
                          justifyContent={compactTextOnly ? "center" : "flex-start"}
                          sx={{ gap: 0.8, flexWrap: compactTextOnly ? "nowrap" : "wrap", flex: 1, minWidth: 0 }}
                        >
                          {!productHasSaleOptions(item) ? (
                            compactTextOnly ? (
                              <Button
                                size="small"
                                variant="contained"
                                disableElevation
                                onClick={(e) => {
                                  e.stopPropagation();
                                  addProductFromCatalogCard(item);
                                }}
                                sx={{ minWidth: "auto", px: 1.1, py: 0.35, borderRadius: 1.5, fontWeight: 800 }}
                              >
                                {item.price} شيكل
                              </Button>
                            ) : (
                              <Box sx={{ minWidth: 0 }}>
                                <Typography color="primary.main" fontWeight={800}>
                                  {item.price} شيكل
                                </Typography>
                              </Box>
                            )
                          ) : (
                            compactTextOnly ? (
                          <></>
                            ) : (
<></>                            )
                          )}
                          {!compactTextOnly && productHasSaleOptions(item) ? (
                            <Chip size="small" label="خيارات" color="secondary" variant="outlined" sx={{ fontWeight: 700 }} />
                          ) : null}
                        </Stack>
                        <IconButton
                          aria-label="معلومات الصنف"
                          onClick={(e) => {
                            e.stopPropagation();
                            openProductPatientInfo(item);
                          }}
                          sx={{
                            flexShrink: 0,
                            bgcolor: "primary.main",
                            color: "primary.contrastText",
                            "&:hover": { bgcolor: "primary.dark" },
                            borderRadius: 1.5,
                            width: compactTextOnly ? 28 : 36,
                            height: compactTextOnly ? 28 : 36,
                          }}
                          size={compactTextOnly ? "small" : "medium"}
                        >
                          <InfoOutlined sx={{ fontSize: compactTextOnly ? 16 : 20 }} />
                        </IconButton>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              )})}
            </Grid>
          </Box>

          <Paper
  elevation={0}
  sx={{
    width: { xs: "100%", md: 360 },
    maxWidth: "100%",
    order: { xs: -1, md: 0 },
    alignSelf: { xs: "stretch", md: "stretch" },
    borderRight: { md: `1px solid ${theme.palette.divider}` },
    borderBottom: { xs: `1px solid ${theme.palette.divider}`, md: "none" },
    borderTop: { xs: "none", md: "none" },
    borderRadius: { xs: "0 0 16px 16px", md: 0 },
    boxShadow: {
      xs: `0 4px 20px ${alpha(theme.palette.common.black, 0.1)}`,
      md: "none",
    },
    display: "flex",
    flexDirection: "column",
    bgcolor: alpha(theme.palette.background.paper, 0.98),
    flexShrink: { xs: 0, md: 0 },
    height: { md: "100%" },
    maxHeight: { xs: "none", md: "none" },
    minHeight: 0,
    overflow: { xs: "visible", md: "hidden" },
  }}
>
  <Box
    sx={{
      p: { xs: 1.25, sm: 2 },
      borderBottom: `1px solid ${theme.palette.divider}`,
      flexShrink: 0,
    }}
  >
    <Typography variant="h6" fontWeight={800} sx={{ mb: 1.25, letterSpacing: -0.2 }}>
      الطلب الحالي
    </Typography>
    <Grid container spacing={1} sx={{ width: "100%" }}>
      {holdFeatureEnabled ? (
        <>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Button
              fullWidth
              size="small"
              variant="outlined"
              color="primary"
              onClick={openHoldSave}
              disabled={!cart.length}
              startIcon={<BookmarkBorder sx={{ fontSize: 18 }} />}
              sx={{ textTransform: "none", fontWeight: 700, py: 0.65 }}
            >
              تعليق
            </Button>
          </Grid>
          <Grid size={{ xs: 12, sm: 4 }}>
            <Button
              fullWidth
              size="small"
              variant="outlined"
              color="inherit"
              onClick={() => setHeldListOpen(true)}
              startIcon={<ListAlt sx={{ fontSize: 18 }} />}
              sx={{
                textTransform: "none",
                fontWeight: 700,
                borderColor: alpha(theme.palette.text.primary, 0.22),
                py: 0.65,
              }}
            >
              معلّقات ({heldDrafts.length})
            </Button>
          </Grid>
        </>
      ) : null}
   
    </Grid>
    <Box sx={{ mt: 1.2 }}>
      <Typography variant="caption" color="text.secondary">
        نوع الزبون
      </Typography>
      <ToggleButtonGroup
        value={customerMode}
        exclusive
        onChange={(_, value) => {
          if (!value) return;
          setCustomerMode(value);
          if (value !== "credit") {
            setCreditCustomerId("");
            setCreditPaidNow("0");
          }
        }}
        size="small"
        fullWidth
        sx={{ mt: 0.8, p: 0.35, borderRadius: 2, bgcolor: alpha(theme.palette.secondary.main, 0.06) }}
      >
        <ToggleButton value="walkin" sx={{ textTransform: "none", fontWeight: 800 }}>
          زبون عادي
        </ToggleButton>
        <ToggleButton value="credit" sx={{ textTransform: "none", fontWeight: 800 }}>
          زبون آجل
        </ToggleButton>
      </ToggleButtonGroup>
      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
        طريقة الدفع
      </Typography>
      <ToggleButtonGroup
        value={paymentMethod}
        exclusive
        orientation="horizontal"
        onChange={(_, value) => {
          if (!value) return;
          setPaymentMethod(value);
        }}
        size="small"
        fullWidth
        sx={{
          mt: 0.8,
          p: 0.4,
          borderRadius: 2,
          bgcolor: alpha(theme.palette.primary.main, 0.06),
          flexWrap: "wrap",
          rowGap: 0.5,
          "& .MuiToggleButton-root": {
            flex: { xs: "1 1 calc(50% - 6px)", sm: "1 1 30%" },
            minWidth: { xs: "calc(50% - 6px)", sm: 0 },
            maxWidth: { xs: "100%", sm: "none" },
            textTransform: "none",
            border: 0,
            borderRadius: 1.5,
            py: { xs: 0.65, sm: 0.85 },
            fontWeight: 800,
            color: "text.secondary",
            fontSize: { xs: 11, sm: 12 },
          },
          "& .Mui-selected": {
            bgcolor: "background.paper !important",
            color: "primary.main !important",
            boxShadow: `0 6px 16px ${alpha(theme.palette.primary.main, 0.18)}`,
          },
        }}
      >
        <ToggleButton value="cash" sx={{ px: 1 }}>
          <Stack direction="row" alignItems="center" sx={{ gap: 0.5 }}>
            <AttachMoney fontSize="small" />
            <span>كاش</span>
          </Stack>
        </ToggleButton>
        {cashierSys.appPaymentEnabled ? (
          <ToggleButton value="app" sx={{ px: 1 }}>
            <Stack direction="row" alignItems="center" sx={{ gap: 0.5 }}>
              <AppShortcut fontSize="small" />
              <span>تطبيق</span>
            </Stack>
          </ToggleButton>
        ) : null}
        <ToggleButton value="mixed" sx={{ px: 1 }}>
          <Stack direction="row" alignItems="center" sx={{ gap: 0.5 }}>
            <AttachMoney fontSize="small" />
            <span>مختلط</span>
          </Stack>
        </ToggleButton>
        {cashierSys.cardPaymentEnabled ? (
          <ToggleButton value="card" sx={{ px: 1 }}>
            <Stack direction="row" alignItems="center" sx={{ gap: 0.5 }}>
              <AttachMoney fontSize="small" />
              <span>بطاقة</span>
            </Stack>
          </ToggleButton>
        ) : null}
        {cashierSys.insurancePaymentEnabled ? (
          <ToggleButton value="insurance" sx={{ px: 1 }}>
            <Stack direction="row" alignItems="center" sx={{ gap: 0.5 }}>
              <AccountBalance fontSize="small" />
              <span>تأمين</span>
            </Stack>
          </ToggleButton>
        ) : null}
      </ToggleButtonGroup>

      {/* ------ قسم الزبون الآجل ------- */}
      {customerMode === "credit" ? (
        <>
          {/* صف اختيار الزبون + زر الإضافة */}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.25 }}>
            <Autocomplete
              size="small"
              sx={{ flex: 1 }}
              options={debtCustomers}
              getOptionLabel={(c) => c?.name || ""}
              value={debtCustomers.find((c) => String(c.id) === String(creditCustomerId)) || null}
              onChange={(_, v) => setCreditCustomerId(v?.id != null ? String(v.id) : "")}
              isOptionEqualToValue={(a, b) => String(a?.id) === String(b?.id)}
              disabled={!debtCustomers.length}
              filterOptions={(opts, { inputValue }) => {
                const q = inputValue.trim().toLowerCase();
                if (!q) return opts;
                return opts.filter(
                  (c) =>
                    String(c.name || "").toLowerCase().includes(q) ||
                    String(c.phone || "").toLowerCase().includes(q),
                );
              }}
              renderOption={(props, c) => (
                <li {...props} key={c.id}>
                  <Typography fontWeight={800}>{c.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    هاتف: {c.phone || "—"} — الدين: {roundOneDecimal(Number(c.balance || 0)).toFixed(1)} ش
                  </Typography>
                </li>
              )}
              renderInput={(params) => (
                <TextField {...params} label="زبون الآجل" placeholder="ابحث بالاسم أو الهاتف…" />
              )}
            />
            <Tooltip title="إضافة زبون جديد">
              <IconButton
                color="primary"
                onClick={() => setAddCustomerOpen(true)}
                sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), borderRadius: 2 }}
              >
                <Add />
              </IconButton>
            </Tooltip>
          </Stack>

          {/* حقل المبلغ المدفوع الآن */}
          <TextField
            size="small"
            type="number"
            label="المبلغ المدفوع الآن"
            value={creditPaidNow}
            onChange={(e) => setCreditPaidNow(e.target.value)}
            inputProps={{ min: 0, step: 0.5 }}
            fullWidth
            sx={{ mt: 1.5 }}
          />

          {/* ** تم إزالة الـ Paper الأوسط الذي يعرض معلومات الدين والرصيد ** */}

          {/* رسالة في حال عدم وجود زبائن آجل */}
          {!debtCustomers.length && (
            <Alert severity="warning" sx={{ mt: 1, py: 0.5 }}>
              لا يوجد زبائن آجل. أضفهم من لوحة المدير (زبائن الآجل).
            </Alert>
          )}
        </>
      ) : (
        <TextField
          size="small"
          label="اسم الزبون (اختياري)"
          value={walkInCustomerName}
          onChange={(e) => setWalkInCustomerName(e.target.value)}
          placeholder="مثال: أحمد محمد"
          sx={{ mt: 1.25 }}
          fullWidth
        />
      )}

      {/* باقي الحقول الشرطية */}
      {paymentMethod === "mixed" && (
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1 }}>
          <TextField
            size="small"
            type="number"
            label="جزء الكاش"
            value={mixedCashAmount}
            onChange={(e) => setMixedCashAmount(e.target.value)}
            inputProps={{ min: 0, step: 0.5 }}
            fullWidth
          />
          <TextField
            size="small"
            type="number"
            label="جزء التطبيق"
            value={mixedAppAmount}
            onChange={(e) => setMixedAppAmount(e.target.value)}
            inputProps={{ min: 0, step: 0.5 }}
            fullWidth
          />
        </Stack>
      )}
      {paymentMethod === "insurance" && (
        <TextField
          size="small"
          type="number"
          label="نسبة تغطية التأمين %"
          value={insuranceCoveragePct}
          onChange={(e) => setInsuranceCoveragePct(e.target.value)}
          inputProps={{ min: 0, max: 100, step: 1 }}
          sx={{ mt: 1.25 }}
          fullWidth
        />
      )}
    </Box>

    {cashierSys.discountEnabled && (
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5 }} gap={1}>
        <TextField
          label="خصم ثابت (شيكل)"
          size="small"
          type="number"
          value={cartDiscountFixed}
          onChange={(e) => setCartDiscountFixed(e.target.value)}
          fullWidth
          inputProps={{ min: 0, step: 0.5 }}
        />
        <TextField
          label="خصم %"
          size="small"
          type="number"
          value={cartDiscountPercent}
          onChange={(e) => setCartDiscountPercent(e.target.value)}
          fullWidth
          inputProps={{ min: 0, max: 100, step: 1 }}
        />
      </Stack>
    )}
  </Box>

  {/* قائمة المنتجات */}
  <Box
    sx={{
      p: { xs: 1.25, sm: 2 },
      flex: { xs: "0 0 auto", md: 1 },
      overflow: { xs: "visible", md: "auto" },
      minHeight: { xs: "auto", md: 0 },
      WebkitOverflowScrolling: "touch",
    }}
  >
    <Stack spacing={1.5}>
      {cart.length === 0 && (
        <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 2 }}>
          السلة فارغة — أضف أصنافًا من القائمة
        </Typography>
      )}
      {cart.map((item) => (
        <Paper
          key={item.rowId || item.id}
          variant="outlined"
          sx={{
            px: { xs: 1, sm: 1.25 },
            py: { xs: 0.9, sm: 1 },
            borderRadius: 2,
          }}
        >
          <Stack direction="column" alignItems="stretch" spacing={0.8}>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                variant="body2"
                fontWeight={700}
                sx={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  wordBreak: "break-word",
                  lineHeight: 1.35,
                }}
              >
                {item.name}
              </Typography>
            
              <Typography
                variant="caption"
                color="primary.main"
                fontWeight={800}
                display="inline-block"
                sx={{
                  mt: 0.45,
                  px: 0.75,
                  py: 0.15,
                  borderRadius: 1,
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                }}
              >
                {item.price} شيكل
              </Typography>
            </Box>
            <Stack
              direction="row"
              alignItems="center"
              spacing={0.45}
              sx={{
                flexShrink: 0,
                flexWrap: "nowrap",
                justifyContent: "space-between",
                pt: 0.2,
              }}
            >
              <Button size="small" onClick={() => updateQty(item.rowId, "-")} aria-label="نقصان نصف">
                -
              </Button>
              <TextField
                size="small"
                type="text"
                inputMode="decimal"
                value={Number(item.qty) % 1 === 0 ? String(item.qty) : Number(item.qty).toFixed(1)}
                onChange={(e) => setQty(item.rowId, e.target.value)}
                sx={{ width: { xs: 72, sm: 80 } }}
                inputProps={{ style: { textAlign: "center" } }}
              />
              <Button size="small" onClick={() => updateQty(item.rowId, "+")} aria-label="زيادة نصف">
                +
              </Button>
              <IconButton color="error" size="small" onClick={() => removeCartItem(item.rowId)}>
                <DeleteOutline fontSize="small" />
              </IconButton>
            </Stack>
          </Stack>
        </Paper>
      ))}
    </Stack>
  </Box>

  {/* Footer Section - عرض الخلاصة المالية */}
  <Box
    sx={{
      flexShrink: 0,
      p: { xs: 1.25, sm: 2 },
      pt: { xs: 1.25, sm: 1.75 },
      borderTop: `1px solid ${theme.palette.divider}`,
      bgcolor: alpha(theme.palette.background.paper, 0.98),
      boxShadow: `0 -10px 28px ${alpha(theme.palette.common.black, 0.08)}`,
      backdropFilter: "blur(8px)",
    }}
  >
    <Stack spacing={1}>
     
  {discountAmount > 0 && (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography color="text.secondary" variant="body2">
        الخصم
      </Typography>
      <Typography variant="body2" fontWeight={700} color="error.main">
        −{discountAmount.toFixed(2)} شيكل
      </Typography>
    </Stack>
  )}
  
  <Stack direction="row" justifyContent="space-between" alignItems="center">
    <Typography fontWeight={800}>المجموع</Typography>
    <Typography fontWeight={900} sx={negativeAmountTextSx(total, { color: "primary.main" })}>
      {total.toFixed(2)} شيكل
    </Typography>
  </Stack>
      {/* عرض معلومات الزبون الآجل في الفوتر (مرة واحدة فقط) */}
   {/* عرض معلومات الزبون الآجل في الفوتر - نسخة مدموجة */}
{/* عرض معلومات الزبون الآجل في الفوتر - نسخة مدموجة */}
{customerMode === "credit" && selectedCreditCustomerInfo && (
  <>
    <Divider sx={{ my: 0.5 }} />
    
    {(() => {
      // ✅ استخدم نفس المنطق المستخدم في Autocomplete
      const balance = Number(selectedCreditCustomerInfo.balance || 0);
      
      if (balance < 0) {
        // رصيد دائن (الزبون دفع زيادة)
        const creditAmount = Math.abs(balance);
        return (
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" color="success.main" fontWeight={700}>
              💰 الرصيد الدائن (له)
            </Typography>
            <Typography variant="body2" fontWeight={900} color="success.main" fontSize="1.1rem">
              {creditAmount.toFixed(1)} ش
            </Typography>
          </Stack>
        );
      } else if (balance > 0) {
        // دين على الزبون
        return (
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" color="error.main" fontWeight={700}>
              ⚠️ المتبقي (دين عليه)
            </Typography>
            <Typography variant="body2" fontWeight={900} color="error.main" fontSize="1.1rem">
              {balance.toFixed(1)} ش
            </Typography>
          </Stack>
        );
      } else {
        return (
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="body2" color="text.secondary">💳 حالة الحساب</Typography>
            <Typography variant="body2" fontWeight={900} color="text.secondary">
              بدون دين
            </Typography>
          </Stack>
        );
      }
    })()}
    
    <Divider sx={{ my: 0.5 }} />

    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="body2" color="text.secondary">المدفوع الآن</Typography>
      <Typography variant="body2" fontWeight={800} color="success.main">
        {Number(creditPaidNow || 0).toFixed(2)} شيكل
      </Typography>
    </Stack>
  </>
)}



      <Stack direction={{ xs: "column", sm: "row" }} alignItems="center" justifyContent="space-between" spacing={1}>
        <Typography variant="body2" fontWeight={700} sx={{ textAlign: { xs: "right", sm: "left" }, width: "100%" }}>
          طباعة الوصل بعد إتمام البيع
        </Typography>
        <Switch
          checked={printReceiptAfterSale}
          onChange={(_, v) => {
            setPrintReceiptAfterSale(v);
            setCashierPrintReceiptPref(currentUsername, v);
          }}
          disabled={!currentUsername}
        />
      </Stack>
      
      <LinearProgress variant="determinate" value={Math.min((cart.length / 10) * 100, 100)} />
      
      <Button
        variant="contained"
        fullWidth
        onClick={handleCheckout}
        disabled={
          isCheckoutSubmitting ||
          !cart.length ||
          (customerMode === "credit" &&
            (!creditCustomerId || !debtCustomers.length || Number(creditPaidNow || 0) < 0)) ||
          (paymentMethod === "mixed" &&
            Math.abs(
              (Number(mixedCashAmount || 0) + Number(mixedAppAmount || 0)) -
              (customerMode === "credit" ? Number(creditPaidNow || 0) : Number(total || 0))
            ) > 0.01)
        }
        sx={{ py: 1.2, textTransform: "none", fontWeight: 800 }}
      >
        {isCheckoutSubmitting ? (
          <Stack direction="row" alignItems="center" justifyContent="center" sx={{ gap: 1 }}>
            <CircularProgress size={18} color="inherit" />
            <span>جاري حفظ الطلب...</span>
          </Stack>
        ) : (
          "تأكيد الطلب والدفع"
        )}
      </Button>
    </Stack>
  </Box>
</Paper>

        </Stack>
      </Stack>
{/* ✅ نافذة كشف الحساب - حركات الزبون (مثل صفحة التقارير) */}
<Dialog
  open={creditMovementsOpen}
  onClose={() => setCreditMovementsOpen(false)}
  fullWidth
  maxWidth="lg"
  slotProps={{ paper: { sx: { borderRadius: 3 } } }}
>
  <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid", borderColor: "divider" }}>
    <Typography variant="h6" fontWeight={800}>
      كشف حساب زبون الآجل: {selectedCreditCustomerInfo?.name || ""}
    </Typography>
    <IconButton onClick={() => setCreditMovementsOpen(false)}>
      <Close />
    </IconButton>
  </DialogTitle>
  <DialogContent dividers>
    {creditMovementsLoading ? (
      <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
        <CircularProgress />
      </Box>
    ) : creditMovements.length === 0 ? (
      <Typography color="text.secondary" sx={{ textAlign: "center", p: 4 }}>
        لا توجد حركات مسجلة لهذا الزبون
      </Typography>
    ) : (
      <TableContainer>
        <Table size="small" dir="rtl">
          <TableHead>
            <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
              <TableCell align="center" sx={{ fontWeight: 800 }}>النوع</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800 }}>التاريخ والوقت</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800 }}>الكاشير</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800 }}>رقم الفاتورة</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800 }}>طريقة الدفع</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800 }}>الحركة</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800 }}>الرصيد بعد الحركة</TableCell>
              <TableCell align="center" sx={{ fontWeight: 800 }}>ملاحظات</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {creditMovements.map((movement) => (
              <TableRow key={movement.id} hover>
                <TableCell align="center">
                  <Chip
                    size="small"
                    color={Number(movement.delta_amount || 0) >= 0 ? "warning" : "success"}
                    label={Number(movement.delta_amount || 0) >= 0 ? "بيع آجل" : "تسديد"}
                  />
                </TableCell>
                <TableCell align="center">
                  {movement.occurred_at ? new Date(movement.occurred_at).toLocaleString("ar-SA") : "—"}
                </TableCell>
                <TableCell align="center">{movement.cashier_name || "—"}</TableCell>
                <TableCell align="center">
                  {movement.reference_order_id ? `ORD-${movement.reference_order_id}` : "—"}
                </TableCell>
                <TableCell align="center">
                  {movement.payment_method === "cash" ? "كاش" : movement.payment_method === "app" ? "تطبيق" : movement.payment_method === "mixed" ? "مختلط" : "—"}
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 800, color: Number(movement.delta_amount || 0) >= 0 ? "error.main" : "success.main" }}>
                  {Math.abs(movement.delta_amount || 0).toFixed(1)} ش
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>
                  {(movement.balance_after || 0).toFixed(1)} ش
                </TableCell>
                <TableCell align="center">
                  <Typography variant="caption" color="text.secondary">
                    {movement.note || "—"}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    )}
  </DialogContent>
  <DialogActions>
    <Button onClick={() => setCreditMovementsOpen(false)} variant="contained">
      إغلاق
    </Button>
  </DialogActions>
</Dialog>

{/* ✅ ديالوج إضافة زبون آجل جديد */}
<Dialog
  open={addCustomerOpen}
  onClose={() => {
    setAddCustomerOpen(false);
    setNewCustomerName("");
    setNewCustomerPhone("");
  }}
  fullWidth
  maxWidth="xs"
  slotProps={cashierDlgSlotProps}
>
  <DialogTitle sx={cashierDlgTitleSx}>
    <Typography variant="h6" fontWeight={900}>
      إضافة زبون آجل جديد
    </Typography>
  </DialogTitle>
  <DialogContent dividers sx={cashierDlgContentSx}>
    <Stack spacing={2}>
      <TextField
        fullWidth
        label="اسم الزبون *"
        value={newCustomerName}
        onChange={(e) => setNewCustomerName(e.target.value)}
        placeholder="مثال: محمد أحمد"
        required
      />
      <TextField
        fullWidth
        label="رقم الهاتف (اختياري)"
        value={newCustomerPhone}
        onChange={(e) => setNewCustomerPhone(e.target.value)}
        placeholder="مثال: 0599123456"
        type="tel"
      />
     
    </Stack>
  </DialogContent>
  <DialogActions sx={cashierDlgActionsSx}>
    <Button 
      onClick={() => {
        setAddCustomerOpen(false);
        setNewCustomerName("");
        setNewCustomerPhone("");
      }}
      sx={{ textTransform: "none" }}
    >
      إلغاء
    </Button>
    <Button
      variant="contained"
      onClick={addNewCreditCustomer}
      disabled={isAddingCustomer || !newCustomerName.trim()}
      sx={{ textTransform: "none", fontWeight: 800 }}
    >
      {isAddingCustomer ? <CircularProgress size={24} /> : "إضافة الزبون"}
    </Button>
  </DialogActions>
</Dialog>


      <ProductPatientInfoDialog
        open={productInfoOpen}
        product={productInfoTarget}
        onClose={closeProductPatientInfo}
        onAddToCart={addFromProductPatientInfo}
        saleTypeLabel={
          productInfoTarget ? saleTypeLabelMap[productInfoTarget.saleType] || saleTypeLabelMap.optional : ""
        }
      />

      <Dialog
        open={saleOptionPickerOpen}
        onClose={() => {
          setSaleOptionPickerOpen(false);
          setSelectedProductForSaleType(null);
        }}
        fullWidth
        maxWidth="xs"
        slotProps={cashierDlgSlotProps}
      >
        <DialogTitle sx={cashierDlgTitleSx}>
          <Typography component="div" variant="h6" fontWeight={900}>
            اختر خيار الصنف
          </Typography>
          <Typography component="div" variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.5 }}>
            {selectedProductForSaleType ? productDisplayName(selectedProductForSaleType) : ""}
          </Typography>
        </DialogTitle>
        <DialogContent dividers sx={cashierDlgContentSx}>
          <Stack sx={{ gap: 1, mt: 0.5 }}>
            {selectedProductForSaleType?.allowSplitSales && !productHasSaleOptions(selectedProductForSaleType) ? (
              <>
                {normalizeSplitSaleOptions(
                  selectedProductForSaleType.saleTypeOptions,
                  selectedProductForSaleType.saleType || "strip",
                ).map((saleType) => {
                  const line = roundOneDecimal(saleTypeUnitPrice(selectedProductForSaleType, saleType));
                  const isPill = saleType === "pill";
                  const stripCount = Number(selectedProductForSaleType?.stripUnitCount || 0);
                  return (
                    <Button
                      key={`sale-type-${saleType}`}
                      variant="outlined"
                      onClick={() => {
                        const p = selectedProductForSaleType;
                        if (!p) return;
                        setSaleOptionPickerOpen(false);
                        addToCart(p, saleType, null);
                        setSelectedProductForSaleType(null);
                      }}
                      sx={{ justifyContent: "space-between", textTransform: "none", fontWeight: 700, py: 1.25, flexWrap: "wrap", gap: 1 }}
                    >
                      <Typography component="span" fontWeight={800} sx={{ textAlign: "right" }}>
                        {saleTypeLabelMap[saleType] || saleType}
                      </Typography>
                      <Stack alignItems="flex-end" spacing={0.15}>
                        <Typography variant="body1" fontWeight={900} color="primary.main" sx={{ whiteSpace: "nowrap" }}>
                          {line.toFixed(2)} شيكل
                        </Typography>
                        {isPill && stripCount > 0 ? (
                          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>
                            الشريط = {stripCount} {selectedProductForSaleType?.splitItemName || "حبة"}
                          </Typography>
                        ) : null}
                      </Stack>
                    </Button>
                  );
                })}
                <Divider />
              </>
            ) : null}
            {selectedProductForSaleType
              ? normalizeSaleOptions(selectedProductForSaleType).map((opt) => {
                  const line = roundOneDecimal(
                    Number((opt.price ?? opt.priceDelta ?? selectedProductForSaleType.price) || 0),
                  );
                  const hasTrackedQty = opt.qty != null && opt.qty !== "";
                  const optionQty = Number(opt.qty ?? 0);
                  const outOfStock = hasTrackedQty && Number.isFinite(optionQty) && optionQty <= 0;
                  return (
                    <Button
                      key={opt.id}
                      variant="outlined"
                      disabled={outOfStock}
                      onClick={() => {
                        const p = selectedProductForSaleType;
                        setSaleOptionPickerOpen(false);
                        if (p) {
                          addToCart(p, p.saleType || "strip", opt);
                        }
                        setSelectedProductForSaleType(null);
                      }}
                      sx={{ justifyContent: "space-between", textTransform: "none", fontWeight: 700, py: 1.25, flexWrap: "wrap", gap: 1 }}
                    >
                      <Typography component="span" fontWeight={800} sx={{ textAlign: "right" }}>
                        {opt.label}
                      </Typography>
                      <Stack alignItems="flex-end" spacing={0.15}>
                        <Typography variant="body1" fontWeight={900} color="primary.main" sx={{ whiteSpace: "nowrap" }}>
                          {line.toFixed(1)} شيكل
                        </Typography>
                        {hasTrackedQty && outOfStock ? (
                          <Typography variant="caption" color="error.main" sx={{ whiteSpace: "nowrap" }}>
                            غير متاح حالياً
                          </Typography>
                        ) : null}
                      </Stack>
                    </Button>
                  );
                })
              : null}
          </Stack>
        </DialogContent>
        <DialogActions sx={cashierDlgActionsSx}>
          <Button
            onClick={() => {
              setSaleOptionPickerOpen(false);
              setSelectedProductForSaleType(null);
            }}
            sx={{ textTransform: "none" }}
          >
            إلغاء
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={holdLabelOpen}
        onClose={() => setHoldLabelOpen(false)}
        fullWidth
        maxWidth="xs"
        slotProps={cashierDlgSlotProps}
      >
        <DialogTitle sx={cashierDlgTitleSx}>
          <Typography variant="h6" fontWeight={900}>
            تعليق السلة
          </Typography>
        </DialogTitle>
        <DialogContent dividers sx={cashierDlgContentSx}>
          <Alert severity="info" sx={{ mb: 2, borderRadius: 2, textAlign: "right" }}>
            يُحفظ المعلّق لحسابك فقط ({currentUsername || "ضيف"}) ويمكن استرجاعه لاحقاً من قائمة السلال المعلّقة.
          </Alert>
          <TextField
            fullWidth
            size="small"
            label="اسم أو رقم للتعريف"
            value={holdLabelDraft}
            onChange={(e) => setHoldLabelDraft(e.target.value)}
            placeholder="مثال: أحمد — وصفة"
          />
        </DialogContent>
        <DialogActions sx={cashierDlgActionsSx}>
          <Button onClick={() => setHoldLabelOpen(false)} sx={{ textTransform: "none" }}>
            إلغاء
          </Button>
          <Button variant="contained" onClick={confirmHoldSave} sx={{ textTransform: "none", fontWeight: 800 }}>
            حفظ
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={heldListOpen}
        onClose={() => setHeldListOpen(false)}
        fullWidth
        maxWidth="sm"
        slotProps={cashierDlgSlotProps}
      >
        <DialogTitle sx={cashierDlgTitleSx}>
          <Typography component="div" variant="h6" fontWeight={900}>
            سلال معلّقة
          </Typography>
          <Typography component="div" variant="body2" color="text.secondary" sx={{ mt: 0.35 }}>
            الحساب: <Box component="span" fontWeight={800}>{currentUsername || "ضيف"}</Box>
          </Typography>
        </DialogTitle>
        <DialogContent dividers sx={cashierDlgContentSx}>
          {!heldDrafts.length ? (
            <Typography variant="body2" color="text.secondary">
              لا توجد سلال معلّقة.
            </Typography>
          ) : (
            <Stack spacing={1.25} sx={{ mt: 0.5 }}>
              {heldDrafts.map((d) => (
                <Paper key={d.id} variant="outlined" sx={{ p: 1.25, borderRadius: 2 }}>
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1} flexWrap="wrap">
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography fontWeight={800}>{d.label}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {d.savedAt ? new Date(d.savedAt).toLocaleString("ar-EG") : ""} — {Array.isArray(d.cart) ? d.cart.length : 0}{" "}
                        صنف
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.75}>
                      <Button size="small" variant="contained" onClick={() => restoreDraft(d)} sx={{ textTransform: "none" }}>
                        استرجاع
                      </Button>
                      <Button size="small" color="error" variant="outlined" onClick={() => removeDraft(d)} sx={{ textTransform: "none" }}>
                        حذف
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={cashierDlgActionsSx}>
          <Button onClick={() => setHeldListOpen(false)} variant="contained" sx={{ textTransform: "none" }}>
            إغلاق
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={syncConfirmOpen}
        onClose={() => setSyncConfirmOpen(false)}
        fullWidth
        maxWidth="sm"
        slotProps={cashierDlgSlotProps}
      >
        <DialogTitle sx={cashierDlgTitleSx}>
          <Typography variant="h6" fontWeight={900}>
            تأكيد مزامنة مبيعات عدم الاتصال
          </Typography>
        </DialogTitle>
        <DialogContent dividers sx={cashierDlgContentSx}>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
            <Table size="small">
              <TableBody>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, width: "42%", bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
                    عدد الفواتير المعلّقة
                  </TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>{pendingOfflineCount}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800, bgcolor: alpha(theme.palette.primary.main, 0.06) }}>إجمالي المبالغ</TableCell>
                  <TableCell sx={{ fontWeight: 900 }}>{pendingOfflineTotal.toFixed(2)} شيكل</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
          <Alert severity="warning" sx={{ mb: 2, borderRadius: 2, textAlign: "right" }}>
            راجع الطلبيات في الجدول أدناه، ثم اضغط «حفظ الطلبيات في النظام».
          </Alert>
          <Typography variant="overline" color="text.secondary" fontWeight={800} sx={{ display: "block", mb: 1, letterSpacing: 0.5 }}>
            الطلبيات المحفوظة محلياً
          </Typography>
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>
                    رقم الطلب
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>
                    المبلغ
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800 }}>
                    وقت الحفظ
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pendingOfflineInvoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell align="right">{inv.id}</TableCell>
                    <TableCell align="right">{Number(inv.total || 0).toFixed(2)}</TableCell>
                    <TableCell align="right">
                      {inv?.soldAt ? new Date(inv.soldAt).toLocaleString("ar-EG") : "-"}
                    </TableCell>
                  </TableRow>
                ))}
                {!pendingOfflineInvoices.length && (
                  <TableRow>
                    <TableCell align="center" colSpan={3}>
                      لا توجد طلبيات محفوظة حالياً.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions sx={cashierDlgActionsSx}>
          <Button onClick={() => setSyncConfirmOpen(false)} sx={{ textTransform: "none" }}>
            إلغاء
          </Button>
          <Button
            variant="contained"
            disabled={isSyncSubmitting}
            onClick={async () => {
              if (isSyncSubmitting) return;
              setIsSyncSubmitting(true);
              try {
                const beforeCount = pendingOfflineInvoices.length;
                const { syncedCount, failedCount, lastErrorMessage } = await flushPendingOfflineInvoices();
                setSyncConfirmOpen(false);
                if (failedCount === 0 && beforeCount > 0) {
                  setOfflineModeEnabled(false);
                  setShiftFeedback(`تمت مزامنة ${syncedCount} فاتورة وتخزينها بشكل نظامي.`);
                  window.setTimeout(() => setShiftFeedback(""), 4500);
                  showAppToast(`تم حفظ ${syncedCount} طلب بالنظام بنجاح`, "success");
                } else if (syncedCount > 0 && failedCount > 0) {
                  showAppToast(`تم حفظ ${syncedCount} طلب وبقي ${failedCount} طلب قيد المحاولة`, "warning");
                } else if (beforeCount > 0) {
                  showAppToast(`فشل الحفظ: ${lastErrorMessage}`, "error");
                }
              } finally {
                setIsSyncSubmitting(false);
              }
            }}
            sx={{ textTransform: "none", fontWeight: 800 }}
          >
            {isSyncSubmitting ? (
              <Stack direction="row" alignItems="center" justifyContent="center" sx={{ gap: 1 }}>
                <CircularProgress size={18} color="inherit" />
                <span>جاري الحفظ بالنظام...</span>
              </Stack>
            ) : (
              "حفظ الطلبيات في النظام"
            )}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
  open={debtPayOpen}
  onClose={() => setDebtPayOpen(false)}
  fullWidth
  maxWidth="xs"
  slotProps={cashierDlgSlotProps}
>
  <DialogTitle sx={cashierDlgTitleSx}>
    <Typography variant="h6" fontWeight={900}>
      تسديد دين — زبون آجل
    </Typography>
  </DialogTitle>
  <DialogContent dividers sx={{ ...cashierDlgContentSx, pt: 2 }}>
    <Autocomplete
      size="small"
      sx={{ mt: 1.25 }}
      options={debtCustomers}
      getOptionLabel={(c) => c?.name || ""}
      value={debtCustomers.find((c) => String(c.id) === String(debtPayCustomerId)) || null}
      onChange={(_, v) => setDebtPayCustomerId(v?.id != null ? String(v.id) : "")}
      isOptionEqualToValue={(a, b) => String(a?.id) === String(b?.id)}
      disabled={!debtCustomers.length}
      filterOptions={(opts, { inputValue }) => {
        const q = inputValue.trim().toLowerCase();
        if (!q) return opts;
        return opts.filter(
          (c) =>
            String(c.name || "")
              .toLowerCase()
              .includes(q) ||
            String(c.phone || "")
              .toLowerCase()
              .includes(q),
        );
      }}
      renderOption={(props, c) => (
        <li {...props} key={c.id}>
          <Box sx={{ width: "100%", py: 0.25 }}>
            <Typography fontWeight={800}>{c.name}</Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              هاتف: {c.phone || "—"} — المتبقي:{" "}
              <Box component="span" sx={negativeAmountTextSx(Number(c.balance || 0))}>
                {roundOneDecimal(Number(c.balance || 0)).toFixed(1)} شيكل
              </Box>
            </Typography>
          </Box>
        </li>
      )}
      renderInput={(params) => (
        <TextField {...params} label="زبون الآجل" placeholder="ابحث بالاسم أو الهاتف…" />
      )}
    />

    <TextField
      fullWidth
      label="المبلغ (شيكل)"
      value={debtPayAmount}
      onChange={(e) => setDebtPayAmount(e.target.value)}
      sx={{ mt: 2 }}
      inputProps={{ style: { textAlign: "right" } }}
    />
  </DialogContent>
  <DialogActions sx={cashierDlgActionsSx}>
    <Button onClick={() => setDebtPayOpen(false)} sx={{ textTransform: "none" }}>
      إلغاء
    </Button>
    <Button variant="contained" onClick={confirmDebtPayment} sx={{ textTransform: "none", fontWeight: 800 }}>
      تأكيد التسديد
    </Button>
  </DialogActions>
</Dialog>

      {printInvoice ? (
        <div className="pharmacy-print-root" dir="rtl">
          <div className="pharmacy-receipt-meta" style={{ fontWeight: 800, fontSize: "11pt" }}>
            {PHARMACY_DISPLAY_NAME}
          </div>
          <div className="pharmacy-receipt-meta">
            {printInvoice.soldAt ? new Date(printInvoice.soldAt).toLocaleString("ar-EG") : ""}
          </div>
          <div className="pharmacy-receipt-meta" style={{ fontWeight: 600 }}>
            {printInvoice.id}
          </div>
          <table className="pharmacy-receipt-table">
            <thead>
              <tr>
                <th className="pharmacy-receipt-num">#</th>
                <th>الصنف</th>
                <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>كمية</th>
                <th style={{ textAlign: "center", whiteSpace: "nowrap" }}>سعر</th>
                <th className="pharmacy-receipt-total">الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {(printInvoice.items || []).map((it, i) => {
                const qty = Number(it.qty ?? 0);
                const unit = Number(it.price ?? 0);
                const line = Number(it.total ?? qty * unit);
                return (
                  <tr key={`${it.productId}-${i}`}>
                    <td className="pharmacy-receipt-num">{i + 1}</td>
                    <td>{it.name || "—"}</td>
                    <td style={{ textAlign: "center" }}>{qty % 1 ? qty.toFixed(1) : String(qty)}</td>
                    <td style={{ textAlign: "center" }}>{unit.toFixed(1)}</td>
                    <td className="pharmacy-receipt-total">{line.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="pharmacy-receipt-footer">
            <div className="pharmacy-receipt-footer-row">
              <span>المجموع</span>
              <span>{Number(printInvoice.subTotal || 0).toFixed(2)}</span>
            </div>
            {Number(printInvoice.discountAmount || 0) > 0 ? (
              <div className="pharmacy-receipt-footer-row">
                <span>الخصم</span>
                <span>−{Number(printInvoice.discountAmount).toFixed(2)}</span>
              </div>
            ) : null}
            <div className="pharmacy-receipt-total-line">
              <span>الصافي</span>
              <span>{Number(printInvoice.total || 0).toFixed(2)} شيكل</span>
            </div>
            <div className="pharmacy-receipt-meta" style={{ marginTop: 6, textAlign: "right", fontWeight: 600 }}>
              الدفع:{" "}
              {printInvoice.paymentMethod === "app"
                ? "تطبيق"
                : printInvoice.paymentMethod === "credit"
                  ? `آجل${printInvoice.creditCustomerName ? ` (${printInvoice.creditCustomerName})` : ""}`
                  : printInvoice.paymentMethod === "card"
                    ? "بطاقة"
                    : printInvoice.paymentMethod === "insurance"
                      ? "تأمين"
                  : "كاش"}
            </div>
            <div className="pharmacy-receipt-meta" style={{ marginTop: 8, fontWeight: 600 }}>
              شكراً لزيارتكم
            </div>
          </div>
        </div>
      ) : null}
    </Box>
  );
}
