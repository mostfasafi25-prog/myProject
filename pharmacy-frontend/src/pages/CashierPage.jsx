import {
  AccountBalance,
  Add,
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
  ShoppingCart,
  Today,
  WifiOff,
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
import { confirmApp, showAppToast } from "../utils/appToast";
import { productDisplayName } from "../utils/productDisplayName";
import { appendAudit } from "../utils/auditLog";
import { negativeAmountTextSx } from "../utils/negativeAmountStyle";
import { notifyStoreBalanceChanged } from "../utils/storeBalanceSync";
import { unitInventoryCost } from "../utils/inventoryCost";
import {
  deleteCashierDraft,
  readDraftsForCashier,
  saveCashierDraft,
} from "../utils/cashierDraftInvoices";
import ProductPatientInfoDialog from "../components/ProductPatientInfoDialog";
import { normalizeSaleOptions, productHasSaleOptions } from "../utils/productSaleOptions";
import {
  adjustCustomerBalance,
  canAddCreditSale,
  readDebtCustomers,
} from "../utils/pharmacyDebtCustomers";
import { persistSalesCategories, PHARMACY_ADMIN_CATEGORIES_SYNCED } from "../utils/backendCategoriesSync";
import { isSuperCashier, purchaserDisplayName, PHARMACY_USER_STORAGE_EVENT } from "../utils/userRoles";
import { mergeUserWithProfileExtras } from "../utils/staffProfileExtras";
import { safeLocalStorageSetJsonWithDataUrlFallback } from "../utils/safeLocalStorage";
import {
  getCashierPrintReceiptPref,
  getCashierSystemSettings,
  setCashierPrintReceiptPref,
} from "../utils/cashierSystemSettings";
const STORE_BALANCE_KEY = "storeBalance";
const SALES_INVOICES_KEY = "salesInvoices";
const NOTIFICATIONS_KEY = "systemNotifications";
const OFFLINE_MODE_KEY = "cashierOfflineModeEnabled";
const OFFLINE_PENDING_INVOICES_KEY = "cashierOfflinePendingInvoices";
const ADMIN_PRODUCTS_KEY = "adminProducts";

const defaultAdminCategories = [
  { id: 1, name: "مسكنات", active: true },
  { id: 2, name: "مضادات حيوية", active: true },
  { id: 3, name: "فيتامينات", active: true },
  { id: 4, name: "اطفال", active: true },
  { id: 5, name: "عناية", active: true },
  { id: 6, name: "هضمية", active: true },
];

const products = [
  { id: 1, name: "باراسيتامول 500", desc: "مسكن وخافض حرارة", price: 12, category: "مسكنات", saleType: "strip", active: true, image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=600&q=80" },
  { id: 2, name: "اموكسيسيلين شراب", desc: "مضاد حيوي للأطفال", price: 28, category: "مضادات حيوية", saleType: "bottle", active: true, image: "https://images.unsplash.com/photo-1471864190281-a93a3070b6de?auto=format&fit=crop&w=600&q=80" },
  { id: 3, name: "فيتامين C 1000", desc: "مقوي مناعة", price: 18, category: "فيتامينات", saleType: "strip", active: true, image: "https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?auto=format&fit=crop&w=600&q=80" },
  { id: 4, name: "أوميبرازول 20", desc: "لعلاج الحموضة", price: 16, category: "هضمية", saleType: "box", active: true, image: "https://images.unsplash.com/photo-1576602976047-174e57a47881?auto=format&fit=crop&w=600&q=80" },
  { id: 5, name: "إيبوبروفين 400", desc: "مضاد التهاب", price: 14, category: "مسكنات", saleType: "pill", active: true, image: "https://images.unsplash.com/photo-1550572017-edd951b55104?auto=format&fit=crop&w=600&q=80" },
  { id: 6, name: "شراب كحة أطفال", desc: "لطرد البلغم", price: 24, category: "اطفال", saleType: "bottle", active: true, image: "https://images.unsplash.com/photo-1628771065518-0d82f1938462?auto=format&fit=crop&w=600&q=80" },
  { id: 7, name: "ديكلوفيناك 50", desc: "مسكن سريع", price: 11, category: "مسكنات", saleType: "strip", active: true, image: "https://images.unsplash.com/photo-1612532275214-e4ca76d0e4d1?auto=format&fit=crop&w=600&q=80" },
  { id: 8, name: "أزيثروميسين 500", desc: "مضاد حيوي", price: 35, category: "مضادات حيوية", saleType: "strip", active: true, image: "https://images.unsplash.com/photo-1512069772995-ec65ed45afd6?auto=format&fit=crop&w=600&q=80" },
  { id: 9, name: "كالسيوم + D3", desc: "عظام ومناعة", price: 22, category: "فيتامينات", saleType: "box", active: true, image: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=600&q=80" },
  { id: 10, name: "فوار فيتامين C", desc: "مكمل يومي", price: 19, category: "فيتامينات", saleType: "box", active: true, image: "https://images.unsplash.com/photo-1494390248081-4e521a5940db?auto=format&fit=crop&w=600&q=80" },
  { id: 11, name: "لوراتادين 10", desc: "مضاد حساسية", price: 13, category: "عناية", saleType: "strip", active: true, image: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=600&q=80" },
  { id: 12, name: "نقط أنف ملحي", desc: "احتقان وانسداد", price: 9, category: "عناية", saleType: "bottle", active: true, image: "https://images.unsplash.com/photo-1631549916768-4119b4123a1c?auto=format&fit=crop&w=600&q=80" },
];
const roundOneDecimal = (n) => Math.round(Number(n) * 10) / 10;

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
  return {
    id: row.id,
    name: row.name,
    desc: row.description || "",
    price: Number(row.price || 0),
    ...(Number.isFinite(costNum) && costNum >= 0 ? { costPrice: costNum } : {}),
    category: catName,
    categoryId: catId,
    qty: Number(row.stock ?? 0),
    saleType: mapBackendUnitToSaleType(row.unit),
    active: row.is_active !== false,
    image: row.image_url || row.imageUrl || "",
    barcode: row.barcode || "",
    createdAt: row.created_at || row.createdAt,
    saleOptions: row.sale_options ?? row.saleOptions,
    ...(uh ? { usageHowTo: uh } : {}),
    ...(uf ? { usageFrequency: uf } : {}),
    ...(ut ? { usageTips: ut } : {}),
  };
}

function mergeCashierProductsWithLocalStorage(apiList) {
  let local = [];
  try {
    const parsed = JSON.parse(localStorage.getItem(ADMIN_PRODUCTS_KEY));
    local = Array.isArray(parsed) ? parsed : [];
  } catch {
    local = [];
  }
  if (!local.length) return apiList;
  return apiList.map((p) => {
    const loc = local.find((l) => Number(l.id) === Number(p.id));
    if (!loc) return p;
    const lHow = String(loc.usageHowTo || "").trim();
    const lFreq = String(loc.usageFrequency || "").trim();
    const lTips = String(loc.usageTips || "").trim();
    const localCostRaw = loc.costPrice ?? loc.cost_price;
    const localCostNum = Number(localCostRaw);
    const mergedCost =
      localCostRaw != null && localCostRaw !== "" && Number.isFinite(localCostNum) && localCostNum >= 0
        ? localCostNum
        : p.costPrice != null
          ? Number(p.costPrice)
          : undefined;
    return {
      ...p,
      qty: loc.qty != null ? Number(loc.qty) : p.qty,
      price: loc.price != null ? Number(loc.price) : p.price,
      min: loc.min != null ? loc.min : p.min,
      saleOptions: loc.saleOptions ?? p.saleOptions,
      saleType: loc.saleType || p.saleType,
      active: loc.active !== false,
      ...(mergedCost != null && Number.isFinite(mergedCost) ? { costPrice: mergedCost } : {}),
      ...(lHow ? { usageHowTo: lHow } : {}),
      ...(lFreq ? { usageFrequency: lFreq } : {}),
      ...(lTips ? { usageTips: lTips } : {}),
    };
  });
}

async function fetchAllSalesProductsPages(axiosInstance) {
  const all = [];
  let page = 1;
  let lastPage = 1;
  const perPage = 100;
  for (let guard = 0; guard < 40; guard += 1) {
    const { data } = await axiosInstance.get("products", {
      params: { per_page: perPage, page, scope: "sales" },
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
    const s = u.avatarDataUrl || u.avatar;
    return typeof s === "string" && s.trim() ? s.trim() : undefined;
  }, [currentUser]);
  const cashierAvatarLetter = useMemo(() => {
    const raw = String(currentUser?.username || currentUser?.name || "?").trim() || "?";
    return raw.charAt(0).toUpperCase();
  }, [currentUser]);
  const canOpenCashierSettings =
    currentUser?.role === "cashier" || currentUser?.role === "super_cashier";
  const [activeCategory, setActiveCategory] = useState(0);
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [shiftStartedAt, setShiftStartedAt] = useState(() => new Date().toISOString());
  const [endShiftOpen, setEndShiftOpen] = useState(false);
  const [shiftFeedback, setShiftFeedback] = useState("");
  const [thankYouOpen, setThankYouOpen] = useState(false);
  const skipNextLogoutShiftNotifyRef = useRef(false);
  const [todaySalesOpen, setTodaySalesOpen] = useState(false);
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
  const [creditCustomerId, setCreditCustomerId] = useState("");
  const [debtPayOpen, setDebtPayOpen] = useState(false);
  const [debtPayCustomerId, setDebtPayCustomerId] = useState("");
  const [debtPayAmount, setDebtPayAmount] = useState("");
  const [holdLabelOpen, setHoldLabelOpen] = useState(false);
  const [holdLabelDraft, setHoldLabelDraft] = useState("");
  const [heldListOpen, setHeldListOpen] = useState(false);
  const [heldRefresh, setHeldRefresh] = useState(0);
  const [printInvoice, setPrintInvoice] = useState(null);
  const debtCustomers = useMemo(() => readDebtCustomers(), [invoiceStoreTick, heldRefresh]);
  const currentUsername = useMemo(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user"));
      return user?.username || "";
    } catch {
      return "";
    }
  }, []);
  const heldDrafts = useMemo(() => readDraftsForCashier(currentUsername), [currentUsername, heldRefresh]);
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
    if (paymentMethod === "credit" && !cashierSys.creditEnabled) setPaymentMethod("cash");
    if (paymentMethod === "app" && !cashierSys.appPaymentEnabled) setPaymentMethod("cash");
  }, [cashierSys.creditEnabled, cashierSys.appPaymentEnabled, paymentMethod]);

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
        const catRes = await Axios.get("categories/main", { params: { scope: "sales" } });
        const rawRows = await fetchAllSalesProductsPages(Axios);
        if (cancelled) return;
        let cats =
          catRes.data?.success && Array.isArray(catRes.data.data)
            ? catRes.data.data.map((c) => ({ id: c.id, name: c.name, active: true }))
            : [];
        const mapped = rawRows.map(mapApiProductRow);
        if (!cats.length && mapped.length) {
          const byId = new Map();
          for (const p of mapped) {
            if (p.categoryId != null) {
              byId.set(p.categoryId, { id: p.categoryId, name: p.category, active: true });
            }
          }
          cats = [...byId.values()].sort((a, b) => String(a.name).localeCompare(String(b.name), "ar"));
        }
        if (!mapped.length) return;
        setApiCatalog({ categories: cats, products: mapped });
        if (cats.length) {
          persistSalesCategories(cats.map((c) => ({ id: c.id, name: c.name, is_active: c.active !== false })));
        }
        setActiveCategory(0);
      } catch (e) {
        console.warn("[كاشير] تعذر جلب الأقسام/الأصناف من الخادم — يُستخدم المحلي", e);
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

  const readStoreBalance = () => {
    let balance = { total: 0, cash: 0, app: 0 };
    try {
      const parsed = JSON.parse(localStorage.getItem(STORE_BALANCE_KEY));
      if (parsed && typeof parsed === "object") {
        balance = {
          total: Number(parsed.total || 0),
          cash: Number(parsed.cash || 0),
          app: Number(parsed.app || 0),
        };
      }
    } catch {
      // ignore malformed localStorage value
    }
    return balance;
  };

  const applyInvoiceToBalance = (invoice) => {
    if (invoice?.paymentMethod === "credit") return;
    const balance = readStoreBalance();
    const totalAmount = Number(invoice?.total || 0);
    const method = invoice?.paymentMethod;
    const next = {
      ...balance,
      total: balance.total + totalAmount,
      cash: method === "cash" ? balance.cash + totalAmount : balance.cash,
      app: method === "app" ? balance.app + totalAmount : balance.app,
      lastPaymentMethod: method || "",
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(STORE_BALANCE_KEY, JSON.stringify(next));
    notifyStoreBalanceChanged();
  };

  const appendInvoiceToSales = (invoice) => {
    try {
      const existing = JSON.parse(localStorage.getItem(SALES_INVOICES_KEY));
      const nextInvoices = Array.isArray(existing) ? [invoice, ...existing] : [invoice];
      localStorage.setItem(SALES_INVOICES_KEY, JSON.stringify(nextInvoices));
    } catch {
      localStorage.setItem(SALES_INVOICES_KEY, JSON.stringify([invoice]));
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
    localStorage.setItem(OFFLINE_PENDING_INVOICES_KEY, JSON.stringify(list));
    setPendingOfflineCount(list.length);
  };

  const submitInvoiceToBackend = async (invoice) => {
    const normalizedItems = (invoice?.items || [])
      .map((it) => ({
        product_id: Number(it.productId ?? it.id),
        name: String(it.name || ""),
        quantity: Number(it.qty),
        price: Number(it.price),
      }))
      .filter((it) => Number.isFinite(it.product_id) && it.product_id > 0 && it.quantity > 0);
    const payload = {
      items: normalizedItems,
      subtotal: Number(invoice?.subTotal || 0),
      total: Number(invoice?.total || 0),
      payment_method: invoice?.paymentMethod || "cash",
      paid_amount: Number(invoice?.total || 0),
      notes: `POS:${invoice?.id || "UNKNOWN"}`,
    };
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
        appendInvoiceToSales(invoice);
        applyInvoiceToBalance(invoice);
        appendAdminSaleNotification(invoice);
        if (invoice.paymentMethod === "credit" && invoice.creditCustomerId) {
          adjustCustomerBalance(invoice.creditCustomerId, Number(invoice.total || 0), {
            type: "credit_sale",
            source: "offline_sync",
            invoiceId: invoice.id,
            username: currentUser?.username || "",
          });
        }
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
    if (!isOnline || !offlineModeEnabled || pendingOfflineCount === 0) return;
    setShiftFeedback("تم رجوع الإنترنت. يمكنك مراجعة الطلبات المحفوظة ثم حفظها في النظام.");
    const timer = window.setTimeout(() => setShiftFeedback(""), 4500);
    return () => window.clearTimeout(timer);
  }, [isOnline, offlineModeEnabled, pendingOfflineCount]);

  const allSalesInvoices = useMemo(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(SALES_INVOICES_KEY));
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }, [invoiceStoreTick, todaySalesOpen]);

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
      return apiCatalog.categories.filter((c) => c.active !== false);
    }
    try {
      const stored = JSON.parse(localStorage.getItem("adminCategories"));
      if (Array.isArray(stored) && stored.length) {
        return stored.filter((c) => c.active !== false).map((c) => ({ id: c.id, name: c.name }));
      }
    } catch {
      // ignore
    }
    return defaultAdminCategories.filter((c) => c.active !== false);
  }, [apiCatalog, categoryStorageTick]);

  const visibleProducts = useMemo(() => {
    if (apiCatalog?.products?.length) {
      return mergeCashierProductsWithLocalStorage(apiCatalog.products).filter((p) => p.active !== false);
    }
    try {
      const stored = JSON.parse(localStorage.getItem("adminProducts"));
      if (Array.isArray(stored) && stored.length) {
        return stored.filter((p) => p.active !== false);
      }
    } catch {
      // ignore
    }
    return products.filter((p) => p.active !== false);
  }, [apiCatalog, invoiceStoreTick]);

  const categoryTabs = useMemo(
    () => [{ id: 0, name: "الكل" }, ...visibleCategories],
    [visibleCategories],
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
    const activeCat = visibleCategories.find((c) => c.id === activeCategory);
    const activeCategoryName = activeCat?.name;
    let list = visibleProducts.filter((p) => {
      if (!activeCategory || activeCategory === 0) return true;
      if (p.categoryId != null && activeCat != null && Number(p.categoryId) === Number(activeCat.id)) return true;
      return activeCategoryName ? String(p.category || "") === String(activeCategoryName) : true;
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
    if (f) {
      list = list.filter(
        (p) =>
          String(p.name || "").toLowerCase().includes(f) ||
          String(productDisplayName(p)).toLowerCase().includes(f) ||
          String(p.barcode || "").toLowerCase().includes(f) ||
          String(p.barcode || "").trim() === productFilter.trim(),
      );
    }
    return list;
  }, [activeCategory, visibleCategories, visibleProducts, productSortMode, salesCountByProductId, productFilter]);

  const applySaleToLocalStock = (soldItems) => {
    try {
      const stored = JSON.parse(localStorage.getItem(ADMIN_PRODUCTS_KEY));
      if (!Array.isArray(stored) || !stored.length) return;
      const next = stored.map((p) => {
        const soldQty = soldItems
          .filter((it) => Number(it.productId) === Number(p.id))
          .reduce((sum, it) => sum + Number(it.qty || 0), 0);
        if (!soldQty) return p;
        const currentQty = Number(p.qty || 0);
        return { ...p, qty: Number((currentQty - soldQty).toFixed(1)) };
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

  const subTotalBeforeDiscount = useMemo(
    () => cart.reduce((s, i) => s + Number(i.price) * roundCartQty(i.qty), 0),
    [cart],
  );
  const discountPct = cashierSys.discountEnabled
    ? Math.min(100, Math.max(0, Number(cartDiscountPercent) || 0))
    : 0;
  const discountFix = cashierSys.discountEnabled ? Math.max(0, Number(cartDiscountFixed) || 0) : 0;
  const discountFromPercent = roundOneDecimal(subTotalBeforeDiscount * (discountPct / 100));
  const discountAmount = roundOneDecimal(
    Math.min(subTotalBeforeDiscount, discountFromPercent + discountFix),
  );
  const subTotal = subTotalBeforeDiscount;
  const total = roundOneDecimal(Math.max(0, subTotalBeforeDiscount - discountAmount));

  const tryBarcodeQuickAdd = useCallback(
    (raw) => {
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
    const activeSaleType = chosenSaleType || product.saleType || "strip";
    const activeSaleTypeLabel = saleTypeLabelMap[activeSaleType] || saleTypeLabelMap.optional;
    const optId = saleOptionChoice?.id != null ? String(saleOptionChoice.id) : "_";
    const rowId = `${product.id}::${activeSaleType}::${optId}`;
    const basePrice = Number(product.price || 0);
    const delta = saleOptionChoice ? Number(saleOptionChoice.priceDelta || 0) : 0;
    const linePrice = roundOneDecimal(basePrice + delta);
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
          ...(saleOptionChoice && String(saleOptionChoice.id || "").trim()
            ? {
                saleOptionId: String(saleOptionChoice.id).trim(),
                saleOptionLabel: String(saleOptionChoice.label || "").trim(),
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

  const addFromProductPatientInfo = () => {
    const p = productInfoTarget;
    if (!p) return;
    setProductInfoOpen(false);
    setProductInfoTarget(null);
    setSelectedProductForSaleType(p);
    if (productHasSaleOptions(p)) {
      setSaleOptionPickerOpen(true);
    } else {
      addToCart(p, p.saleType || "strip", null);
      setSelectedProductForSaleType(null);
    }
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
    const t = window.setTimeout(() => window.print(), 280);
    const done = () => setPrintInvoice(null);
    window.addEventListener("afterprint", done);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("afterprint", done);
    };
  }, [printInvoice]);

  const finalizeLogout = () => {
    cookies.remove("token", { path: "/" });
    localStorage.removeItem("user");
    setThankYouOpen(false);
    navigate("/login", { replace: true });
  };

  const confirmDebtPayment = () => {
    if (!debtPayCustomerId) {
      showAppToast("اختر زبون الآجل", "warning");
      return;
    }
    const amt = Number(debtPayAmount);
    if (!Number.isFinite(amt) || amt <= 0) {
      showAppToast("أدخل مبلغ تسديد صحيح", "error");
      return;
    }
    adjustCustomerBalance(debtPayCustomerId, -amt, {
      type: "payment",
      source: "cashier",
      username: currentUser?.username || "",
    });
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

  const handleCheckout = async () => {
    if (isCheckoutSubmitting) return;
    if (!cart.length) return;
    if (paymentMethod === "credit" && !cashierSys.creditEnabled) {
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
    if (paymentMethod === "credit") {
      if (!creditCustomerId) {
        showAppToast("اختر زبوناً للبيع الآجل", "warning");
        return;
      }
      const chk = canAddCreditSale(creditCustomerId, total);
      if (!chk.ok) {
        showAppToast(chk.reason || "لا يمكن البيع الآجل", "error");
        return;
      }
    }
    setIsCheckoutSubmitting(true);
    const creditCust = debtCustomers.find((c) => String(c.id) === String(creditCustomerId));
    const discountAllocFactor = subTotalBeforeDiscount > 0 ? total / subTotalBeforeDiscount : 0;
    const builtItems = cart.map((item) => {
      const src = visibleProducts.find((p) => Number(p.id) === Number(item.id)) || {};
      const qty = roundCartQty(item.qty);
      const sellUnit = Number(item.price);
      const uc = unitInventoryCost(src);
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
      paymentMethod,
      subTotal: Number(subTotalBeforeDiscount.toFixed(2)),
      discountAmount: Number(discountAmount.toFixed(2)),
      discountPercent: discountPct,
      discountFixed: discountFix,
      total: Number(total.toFixed(2)),
      totalCost: invoiceTotalCost,
      totalProfit: invoiceTotalProfit,
      status: "مكتمل",
      soldAt: new Date().toISOString(),
      ...(paymentMethod === "credit" && creditCust
        ? { creditCustomerId: creditCust.id, creditCustomerName: creditCust.name }
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
        appendInvoiceToSales(invoice);
        applyInvoiceToBalance(invoice);
        appendAdminSaleNotification(invoice);
        if (paymentMethod === "credit" && creditCustomerId) {
          adjustCustomerBalance(creditCustomerId, total, {
            type: "credit_sale",
            source: "cashier",
            invoiceId: invoice.id,
            username: currentUser?.username || "",
          });
        }
        try {
          await submitInvoiceToBackend(invoice);
        } catch {
          // fallback to local-only mode if backend unavailable
        }
      }
      applySaleToLocalStock(invoice.items);

      skipNextLogoutShiftNotifyRef.current = false;

      appendAudit({
        action: "cashier_sale",
        details: JSON.stringify({
          invoiceId: invoice.id,
          total: invoice.total,
          paymentMethod,
          ...(paymentMethod === "credit" && creditCust
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
      setPaymentMethod("cash");
      if (!shouldQueueOffline) {
        showAppToast("تم تأكيد الطلب بنجاح", "success");
      }
    } finally {
      setIsCheckoutSubmitting(false);
    }
  };

  const repeatInvoiceToCart = (invoice) => {
    if (!invoice || !Array.isArray(invoice.items) || !invoice.items.length) return;
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
    setPaymentMethod("cash");
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
    setCreditCustomerId(d.creditCustomerId || "");
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
                <Tooltip title="الوضع الليلي / النهاري">
                  <IconButton onClick={onToggleMode} color="primary" size="small" aria-label="تبديل الوضع" edge="end">
                    {mode === "dark" ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
                  </IconButton>
                </Tooltip>
              </Stack>
              <Box
                role="toolbar"
                aria-label="اختصارات الكاشير"
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(52px, 1fr))",
                  gap: { xs: 0.75, sm: 1 },
                  width: "100%",
                  maxWidth: "100%",
                  py: 0.5,
                  px: 0.25,
                  justifyItems: "stretch",
                  alignItems: "stretch",
                }}
              >
                {(() => {
                  const cellBtn = (extra = {}) => ({
                    width: "100%",
                    minHeight: 44,
                    maxHeight: 48,
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
                        <Tooltip title="بيع اليوم">
                          <span style={{ display: "block", width: "100%", minWidth: 0 }}>
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => {
                                setTodaySalesPage(1);
                                setTodaySalesOpen(true);
                              }}
                              aria-label="بيع اليوم"
                              sx={cellBtn()}
                            >
                              <Today sx={{ fontSize: 22 }} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      ) : null}
                      <Tooltip title="الإشعارات">
                        <span style={{ display: "block", width: "100%", minWidth: 0 }}>
                          <IconButton
                            onClick={() => navigate("/cashier/notifications")}
                            color="primary"
                            size="small"
                            aria-label="الإشعارات"
                            sx={cellBtn()}
                          >
                            <Badge color="error" badgeContent={unreadNotifications} invisible={!unreadNotifications}>
                              <Notifications sx={{ fontSize: 22 }} />
                            </Badge>
                          </IconButton>
                        </span>
                      </Tooltip>
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
              sx={{ px: { sm: 2, md: 3 }, py: 2, gap: 2, flexWrap: "wrap" }}
            >
              <Stack direction="row" alignItems="center" sx={{ gap: 1.25, flexWrap: "wrap", minWidth: 0 }}>
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
                <IconButton onClick={onToggleMode} color="primary" size="small" aria-label="تبديل الوضع">
                  {mode === "dark" ? <LightMode /> : <DarkMode />}
                </IconButton>
              </Stack>

              <Stack
                direction="row"
                alignItems="center"
                justifyContent="flex-end"
                flexWrap="wrap"
                sx={{ gap: 1, columnGap: 1.25, rowGap: 1 }}
              >
                {cashierSys.todaySalesButtonEnabled ? (
                  <Button
                    variant="outlined"
                    color="primary"
                    size="small"
                    startIcon={<Today />}
                    onClick={() => {
                      setTodaySalesPage(1);
                      setTodaySalesOpen(true);
                    }}
                    sx={{ textTransform: "none", fontWeight: 800 }}
                  >
                    بيع اليوم
                  </Button>
                ) : null}
                <IconButton onClick={() => navigate("/cashier/notifications")} color="primary" aria-label="الإشعارات">
                  <Badge color="error" badgeContent={unreadNotifications} invisible={!unreadNotifications}>
                    <Notifications />
                  </Badge>
                </IconButton>
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
                    {offlineModeEnabled ? "وضع عدم الاتصال: مفعّل" : "وضع عدم الاتصال"}
                  </Button>
                ) : null}

                {isSuperCashier(currentUser) ? (
                  <Button
                    variant="contained"
                    color="secondary"
                    size="small"
                    startIcon={<Dashboard fontSize="small" />}
                    onClick={() => navigate("/cashier/dashboard")}
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
          maxWidth="md"
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
              <Table size="small" sx={{ tableLayout: "fixed", minWidth: 720 }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>
                      رقم الفاتورة
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>
                      التاريخ
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>
                      الدفع
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>
                      الإجمالي
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>
                      الحالة
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>
                      تفاصيل
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>
                      إعادة الفاتورة
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedTodaySales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} align="center">
                        <Typography variant="body2" color="text.secondary">
                          لا توجد فواتير لهذا اليوم
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedTodaySales.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell align="center" sx={{ fontWeight: 800, color: "primary.main" }}>
                          {row.id}
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2">{row.soldAt ? new Date(row.soldAt).toLocaleDateString("en-GB") : "-"}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {row.soldAt ? new Date(row.soldAt).toLocaleTimeString("en-GB") : "-"}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">{row.paymentMethod === "app" ? "تطبيق" : "كاش"}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>
                          {roundOneDecimal(row.total).toFixed(1)} شيكل
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            label={row.status || "مكتمل"}
                            color={(row.status || "مكتمل") === "مكتمل" ? "success" : "info"}
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => setDetailTodayInvoice(row)}
                            sx={{ textTransform: "none", fontWeight: 700 }}
                          >
                            عرض
                          </Button>
                        </TableCell>
                        <TableCell align="center">
                          <Button
                            size="small"
                            variant="contained"
                            color="secondary"
                            onClick={() => repeatInvoiceToCart(row)}
                            disabled={!row.items?.length}
                            sx={{ textTransform: "none", fontWeight: 800 }}
                          >
                            إعادة الفاتورة
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
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
          </DialogActions>
        </Dialog>

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
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  sx={{
                    minWidth: 0,
                    width: "100%",
                    py: 1.2,
                    borderRadius: 2,
                    textTransform: "none",
                    color: activeCategory === cat.id ? "primary.main" : "text.secondary",
                    bgcolor:
                      activeCategory === cat.id ? alpha(theme.palette.primary.main, 0.15) : "transparent",
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
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  variant={activeCategory === cat.id ? "contained" : "outlined"}
                  color={activeCategory === cat.id ? "primary" : "inherit"}
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
                placeholder="بحث بالاسم أو أدخل الباركود ثم Enter"
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    tryBarcodeQuickAdd(productFilter);
                  }
                }}
                inputProps={{ dir: "rtl" }}
              />
            </Stack>

            <Grid container spacing={{ xs: 1.5, sm: 2 }}>
              {shownProducts.map((item) => (
                <Grid key={item.id} size={{ xs: 12, sm: 6, md: 6, lg: 4, xl: 3 }}>
                  <Card
                    onClick={() => openProductPatientInfo(item)}
                    sx={{
                      borderRadius: 3,
                      border: `1px solid ${theme.palette.divider}`,
                      cursor: "pointer",
                      transition: "box-shadow 0.15s, transform 0.15s",
                      "&:hover": { boxShadow: `0 6px 20px ${alpha(theme.palette.common.black, 0.08)}` },
                    }}
                  >
                    <Box
                      sx={{
                        height: 120,
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        display: "grid",
                        placeItems: "center",
                        backgroundImage: item.image ? `url(${item.image})` : "none",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                        pointerEvents: "none",
                      }}
                    >
                      {!item.image ? <ShoppingCart color="primary" /> : null}
                    </Box>
                    <CardContent>
                      <Typography fontWeight={700}>{productDisplayName(item)}</Typography>
                      <Typography variant="body2" color="text.secondary" mb={1.5}>
                        {item.desc}
                      </Typography>
                      <Stack
                        direction={{ xs: "column", sm: "row" }}
                        justifyContent="space-between"
                        alignItems={{ xs: "stretch", sm: "center" }}
                        spacing={{ xs: 1.25, sm: 1 }}
                      >
                        <Stack direction="row" alignItems="center" sx={{ gap: 0.8, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography color="primary.main" fontWeight={800}>
                              {item.price} شيكل
                            </Typography>
                            {productHasSaleOptions(item) ? (
                              <Typography variant="caption" color="text.secondary" sx={{ display: "block", fontWeight: 600 }}>
                                أساسي — يتغيّر حسب الخيار
                              </Typography>
                            ) : null}
                          </Box>
                          <Chip size="small" label={saleTypeLabelMap[item.saleType] || "شريط كامل"} variant="outlined" />
                          {productHasSaleOptions(item) ? (
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
                            alignSelf: { xs: "flex-end", sm: "center" },
                            flexShrink: 0,
                            bgcolor: "primary.main",
                            color: "primary.contrastText",
                            "&:hover": { bgcolor: "primary.dark" },
                            borderRadius: 2,
                          }}
                        >
                          <InfoOutlined />
                        </IconButton>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
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
              // xs: بدون سقف — عرض كل الأصناف بالسلة ثم التمرير للأسفل للمنتجات (تجنب ارتفاع 0 للمنطقة الوسطى)
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
                {cashierSys.holdCartEnabled ? (
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
                <Grid size={{ xs: 12, sm: cashierSys.holdCartEnabled ? 4 : 12 }}>
                  <Button
                    fullWidth
                    size="small"
                    color="error"
                    variant="outlined"
                    onClick={clearCart}
                    disabled={!cart.length}
                    sx={{ textTransform: "none", fontWeight: 700, py: 0.65 }}
                  >
                    حذف الكل
                  </Button>
                </Grid>
              </Grid>
              <Box sx={{ mt: 1.2 }}>
                <Typography variant="caption" color="text.secondary">
                  طريقة الدفع
                </Typography>
                <ToggleButtonGroup
                  value={paymentMethod}
                  exclusive
                  orientation="horizontal"
                  onChange={(_, value) => {
                    if (!value) return;
                    setPaymentMethod(value);
                    if (value !== "credit") setCreditCustomerId("");
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
                  {cashierSys.creditEnabled ? (
                    <ToggleButton value="credit" sx={{ px: 1 }}>
                      <Stack direction="row" alignItems="center" sx={{ gap: 0.5 }}>
                        <AccountBalance fontSize="small" />
                        <span>آجل</span>
                      </Stack>
                    </ToggleButton>
                  ) : null}
                </ToggleButtonGroup>
                {paymentMethod === "credit" ? (
                  <Autocomplete
                    size="small"
                    sx={{ mt: 1.25 }}
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
                            هاتف: {c.phone || "—"} — الرصيد (دين):{" "}
                            <Box component="span" sx={negativeAmountTextSx(Number(c.balance || 0))}>
                              {roundOneDecimal(Number(c.balance || 0)).toFixed(1)} شيكل
                            </Box>{" "}
                            — السقف: {roundOneDecimal(Number(c.creditLimit || 0)).toFixed(1)}
                          </Typography>
                        </Box>
                      </li>
                    )}
                    renderInput={(params) => (
                      <TextField {...params} label="زبون الآجل" placeholder="ابحث بالاسم أو الهاتف…" />
                    )}
                  />
                ) : null}
                {paymentMethod === "credit" && !debtCustomers.length ? (
                  <Alert severity="warning" sx={{ mt: 1, py: 0.5 }}>
                    لا يوجد زبائن آجل. أضفهم من لوحة المدير (زبائن الآجل).
                  </Alert>
                ) : null}
              </Box>
              {cashierSys.discountEnabled ? (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mt: 1.5 }}>
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
              ) : null}
            </Box>

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
                {cart.length === 0 ? (
                  <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ py: 2 }}>
                    السلة فارغة — أضف أصنافًا من القائمة
                  </Typography>
                ) : null}
                {cart.map((item) => (
                  <Paper key={item.rowId || item.id} variant="outlined" sx={{ p: { xs: 1, sm: 1.2 }, borderRadius: 2 }}>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      alignItems={{ xs: "stretch", sm: "center" }}
                      justifyContent="space-between"
                      spacing={1.25}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={700}>
                          {item.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          {item.saleTypeLabel || saleTypeLabelMap.optional}
                          {item.saleOptionLabel ? ` · ${item.saleOptionLabel}` : ""}
                        </Typography>
                        <Typography variant="caption" color="primary.main" fontWeight={700} display="block" sx={{ mt: 0.5 }}>
                          {item.price} شيكل
                        </Typography>
                      </Box>
                      <Stack
                        direction="row"
                        alignItems="center"
                        spacing={1}
                        sx={{ flexShrink: 0, flexWrap: "nowrap", justifyContent: { xs: "space-between", sm: "flex-end" } }}
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
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography color="text.secondary" variant="body2">
                    المجموع
                  </Typography>
                  <Typography variant="body2" fontWeight={700}>
                    {subTotalBeforeDiscount.toFixed(2)} شيكل
                  </Typography>
                </Stack>
                {discountAmount > 0 ? (
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography color="text.secondary" variant="body2">
                      الخصم
                    </Typography>
                    <Typography variant="body2" fontWeight={700} color="error.main">
                      −{discountAmount.toFixed(2)} شيكل
                    </Typography>
                  </Stack>
                ) : null}
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography fontWeight={800}>الصافي</Typography>
                  <Typography
                    fontWeight={900}
                    sx={{ ...negativeAmountTextSx(total, { color: "primary.main" }) }}
                  >
                    {total.toFixed(2)} شيكل
                  </Typography>
                </Stack>
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  justifyContent="space-between"
                  spacing={1}
                  sx={{ width: "100%" }}
                >
                  <Typography variant="body2" fontWeight={700} sx={{ flex: 1, lineHeight: 1.35, pr: { sm: 1 } }}>
                    طباعة الوصل بعد إتمام البيع
                  </Typography>
                  <Switch
                    checked={printReceiptAfterSale}
                    onChange={(_, v) => {
                      setPrintReceiptAfterSale(v);
                      setCashierPrintReceiptPref(currentUsername, v);
                    }}
                    disabled={!currentUsername}
                    sx={{ alignSelf: { xs: "flex-start", sm: "center" } }}
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
                    (paymentMethod === "credit" && (!creditCustomerId || !debtCustomers.length))
                  }
                  sx={{ py: 1.2, textTransform: "none", fontWeight: 800 }}
                >
                  {isCheckoutSubmitting ? (
                    <Stack direction="row" alignItems="center" justifyContent="center" sx={{ gap: 1 }}>
                      <CircularProgress size={18} color="inherit" />
                      <span>جاري حفظ الطلب...</span>
                    </Stack>
                  ) : (
                    "تاكيد الطلب والدفع"
                  )}
                </Button>
              </Stack>
            </Box>
          </Paper>
        </Stack>
      </Stack>

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
            {selectedProductForSaleType
              ? normalizeSaleOptions(selectedProductForSaleType).map((opt) => {
                  const base = Number(selectedProductForSaleType.price || 0);
                  const line = roundOneDecimal(base + Number(opt.priceDelta || 0));
                  return (
                    <Button
                      key={opt.id}
                      variant="outlined"
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
                      <Typography variant="body1" fontWeight={900} color="primary.main" sx={{ whiteSpace: "nowrap" }}>
                        {line.toFixed(1)} شيكل
                      </Typography>
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
            sx={{ mt: 0.5 }}
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
                    هاتف: {c.phone || "—"} — الرصيد:{" "}
                    <Box component="span" sx={negativeAmountTextSx(Number(c.balance || 0))}>
                      {roundOneDecimal(Number(c.balance || 0)).toFixed(1)}
                    </Box>{" "}
                    — السقف: {roundOneDecimal(Number(c.creditLimit || 0)).toFixed(1)}
                  </Typography>
                </Box>
              </li>
            )}
            renderInput={(params) => <TextField {...params} label="الزبون" placeholder="ابحث بالاسم أو الهاتف…" />}
          />
          {(() => {
            const sel = debtCustomers.find((c) => String(c.id) === String(debtPayCustomerId));
            if (!sel) return null;
            return (
              <TableContainer component={Paper} variant="outlined" sx={{ mt: 2, borderRadius: 2 }}>
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell
                        sx={{
                          fontWeight: 800,
                          width: "40%",
                          bgcolor: alpha(theme.palette.primary.main, 0.06),
                          borderRight: `1px solid ${theme.palette.divider}`,
                        }}
                      >
                        الهاتف
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{sel.phone || "—"}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell
                        sx={{
                          fontWeight: 800,
                          bgcolor: alpha(theme.palette.primary.main, 0.06),
                          borderRight: `1px solid ${theme.palette.divider}`,
                        }}
                      >
                        الرصيد الحالي
                      </TableCell>
                      <TableCell sx={{ fontWeight: 900, ...negativeAmountTextSx(Number(sel.balance || 0)) }}>
                        {roundOneDecimal(Number(sel.balance || 0)).toFixed(1)} شيكل
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
                        سقف الآجل
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>{roundOneDecimal(Number(sel.creditLimit || 0)).toFixed(1)} شيكل</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            );
          })()}
          <TextField
            fullWidth
            label="المبلغ (شيكل)"
            value={debtPayAmount}
            onChange={(e) => setDebtPayAmount(e.target.value)}
            sx={{ mt: 2 }}
            inputProps={{ style: { textAlign: "right" } }}
          />
          <Alert severity="info" variant="outlined" sx={{ mt: 1.5, borderRadius: 2, textAlign: "right" }}>
            يُخصم من رصيد الزبون فقط. لإضافة المبلغ للصندوق استخدم إعداد المال عند الحاجة.
          </Alert>
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

      {currentUser?.role === "admin" || currentUser?.role === "super_admin" ? (
        <Paper
          elevation={14}
          sx={{
            position: "fixed",
            bottom: "max(12px, env(safe-area-inset-bottom))",
            insetInlineStart: 12,
            zIndex: theme.zIndex.snackbar,
            p: 1,
            borderRadius: 2.5,
            display: "flex",
            flexDirection: "column",
            gap: 0.75,
            minWidth: 0,
            maxWidth: "min(280px, calc(100vw - 24px))",
            bgcolor: alpha(theme.palette.background.paper, 0.98),
            backdropFilter: "blur(10px)",
            border: `1px solid ${alpha(theme.palette.primary.main, 0.22)}`,
            boxShadow: `0 8px 32px ${alpha(theme.palette.common.black, 0.16)}`,
          }}
        >
          <Button
            variant="contained"
            color="primary"
            size="small"
            startIcon={<Dashboard fontSize="small" />}
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
            تسجيل الخروج
          </Button>
        </Paper>
      ) : null}

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
