import { Add, CheckCircle, Close, DeleteOutline, LocalShipping, Payments, Person, Print, ReceiptLong, RestartAlt, Search, ShoppingCart, Storefront } from "@mui/icons-material";
import {
  Alert,
  alpha,
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  InputAdornment,
  InputLabel,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useTheme,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {    Edit,  } from "@mui/icons-material";
import { useLocation, useNavigate } from "react-router-dom";
import { Axios } from "../../Api/Axios";
import FilterBarRow from "../../components/FilterBarRow";
import { adminPageContainerSx, adminPageSubtitleSx } from "../../utils/adminPageLayout";
import { negativeAmountTextSx } from "../../utils/negativeAmountStyle";
import AdminLayout from "./AdminLayout";
import { confirmApp, showAppToast } from "../../utils/appToast";
import { appendAudit } from "../../utils/auditLog";

const ROWS_PER_PAGE = 10;
const LOCAL_SUPPLIERS_KEY = "pharmacySuppliers_v1";
const LOCAL_PURCHASES_KEY = "purchaseInvoices";
const NOTIFICATIONS_KEY = "systemNotifications";

// Utility functions
const normalizeOneDecimal = (value) => {
  const cleaned = String(value ?? "").replace(/[^\d.]/g, "");
  const num = Number(cleaned);
  if (Number.isNaN(num)) return "";
  return (Math.round(num * 10) / 10).toString();
};

const formatOneDecimal = (n) => {
  const x = Number(n);
  if (Number.isNaN(x)) return "0.0";
  return x.toFixed(1);
};

const formatCurrency = (n) => {
  const x = Number(n);
  if (Number.isNaN(x)) return "0.00";
  return x.toFixed(2);
};

const getProductPurchasePrice = (product) => {
  const purchasePrice = Number(product?.purchase_price);
  if (!Number.isNaN(purchasePrice) && purchasePrice > 0) return purchasePrice;

  const costPrice = Number(product?.cost_price);
  if (!Number.isNaN(costPrice) && costPrice > 0) return costPrice;

  const fallbackPrice = Number(product?.price);
  if (!Number.isNaN(fallbackPrice) && fallbackPrice > 0) return fallbackPrice;

  return 0;
};

const normalizePurchaseStatus = (status) => {
  const s = String(status || "").trim().toLowerCase();
  if (s === "completed" || s === "مكتمل" || s === "مدفوع") return "completed";
  if (s === "partially_paid" || s === "جزئي") return "partially_paid";
  if (s === "pending" || s === "معلق" || s === "مراجعة") return "pending";
  if (s === "مرجع" || s === "returned") return "returned";
  return s || "pending";
};

const normalizePurchasesPayload = (payload) => {
  if (Array.isArray(payload?.data)) {
    return { rows: payload.data, lastPage: Number(payload?.last_page || payload?.meta?.last_page || 1) };
  }
  if (Array.isArray(payload)) return { rows: payload, lastPage: 1 };
  return { rows: [], lastPage: 1 };
};

const mapLocalPurchaseInvoice = (row) => ({
  id: row.id || `LOCAL-${Date.now()}`,
  invoice_number: row.id || row.invoice_number || "",
  supplier_id: row.supplierId || row.supplier_id || "",
  supplier: { name: row.supplier || "مورد عام" },
  purchase_date: row.purchasedAt || row.purchase_date || "",
  total_amount: Number(row.total || row.total_amount || 0),
  paid_amount: Number(row.total || row.paid_amount || 0),
  remaining_amount: Number(row.remaining_amount || 0),
  status: normalizePurchaseStatus(row.status),
  payment_method: row.paymentMethod || row.payment_method || "cash",
  cash_amount: Number(row.treasuryDebit?.cash || row.cash_amount || 0),
  app_amount: Number(row.treasuryDebit?.app || row.app_amount || 0),
  items: Array.isArray(row.items) ? row.items : [],
});

export default function EnhancedPurchasesPage({ mode, onToggleMode }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const printRef = useRef(null);
// داخل EnhancedPurchasesPage component, بعد تعريف useNavigate
const handleCardNavigate = (path) => {
  navigate(path);
};
  // Pagination and filters
  const [page, setPage] = useState(1);
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // all, completed, partially_paid, pending
  const [purchases, setPurchases] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // Payment dialog for debt
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethodDialog, setPaymentMethodDialog] = useState("cash");
  const [cashAmountDialog, setCashAmountDialog] = useState("");
  const [appAmountDialog, setAppAmountDialog] = useState("");
// ========== دوال Tabs (انقلها إلى هنا) ==========

const [activeTabId, setActiveTabId] = useState('tab-1');
const [nextTabNumber, setNextTabNumber] = useState(2);
const [purchaseTabs, setPurchaseTabs] = useState([
  {
    id: 'tab-1',
    name: 'طلب شراء 1',
    isEditingName: false,
    catalogSearch: '',
    catalogCategory: 'all',
    catalogQuickFilter: 'all',
    purchaseLines: [],
    selectedSupplierId: '',
    paymentMethod: 'cash',
    cashAmount: '',
    appAmount: '',
  }
]);

// Create new tab
const createNewPurchaseTab = () => {
  if (purchaseTabs.length >= 10) {
    showAppToast("لا يمكن فتح أكثر من 10 نوافذ شراء في نفس الوقت", "warning");
    return;
  }
  
  const newId = `tab-${Date.now()}`;
  const newTab = {
    id: newId,
    name: `طلب شراء ${nextTabNumber}`,
    isEditingName: false,
    catalogSearch: '',
    catalogCategory: 'all',
    catalogQuickFilter: 'all',
    purchaseLines: [],
    selectedSupplierId: '',
    paymentMethod: 'cash',
    cashAmount: '',
    appAmount: '',
  };
  
  setPurchaseTabs(prev => [...prev, newTab]);
  setActiveTabId(newId);
  setNextTabNumber(prev => prev + 1);
};

// Get current active tab data
const currentTab = useMemo(() => {
  return purchaseTabs.find(tab => tab.id === activeTabId) || purchaseTabs[0];
}, [purchaseTabs, activeTabId]);

// Update current active tab
const updateCurrentTab = (updates) => {
  setPurchaseTabs(prev => prev.map(tab => 
    tab.id === activeTabId ? { ...tab, ...updates } : tab
  ));
};

// Update specific tab
const updateTab = (tabId, updates) => {
  setPurchaseTabs(prev => prev.map(tab => 
    tab.id === tabId ? { ...tab, ...updates } : tab
  ));
};

// Create new tab


// Close tab
// Close tab - تعديل: السماح بإغلاق النافذة الوحيدة
const closePurchaseTab = (tabId) => {
  // ❌ إزالة هذا الشرط
  // if (purchaseTabs.length === 1) {
  //   showAppToast("لا يمكن إغلاق النافذة الوحيدة", "info");
  //   return;
  // }
  
  const tabIndex = purchaseTabs.findIndex(t => t.id === tabId);
  const newTabs = purchaseTabs.filter(t => t.id !== tabId);
  
  // إذا كانت هذه النافذة الوحيدة وكانت ستُغلق، نقوم بإنشاء نافذة جديدة أولاً
  if (newTabs.length === 0) {
    // إنشاء نافذة جديدة قبل إغلاق القديمة
    const newId = `tab-${Date.now()}`;
    const newTab = {
      id: newId,
      name: `طلب شراء ${nextTabNumber}`,
      isEditingName: false,
      catalogSearch: '',
      catalogCategory: 'all',
      catalogQuickFilter: 'all',
      purchaseLines: [],
      selectedSupplierId: '',
      paymentMethod: 'cash',
      cashAmount: '',
      appAmount: '',
    };
    setPurchaseTabs([newTab]);
    setActiveTabId(newId);
    setNextTabNumber(prev => prev + 1);
    return;
  }
  
  if (activeTabId === tabId) {
    const newActiveIndex = Math.min(tabIndex, newTabs.length - 1);
    setActiveTabId(newTabs[newActiveIndex]?.id);
  }
  
  setPurchaseTabs(newTabs);
};

// Edit tab name
const startEditingTabName = (tabId, e) => {
  e.stopPropagation();
  updateTab(tabId, { isEditingName: true });
};

// Save tab name
const saveTabName = (tabId, newName) => {
  if (newName.trim()) {
    updateTab(tabId, { name: newName.trim(), isEditingName: false });
  } else {
    updateTab(tabId, { isEditingName: false });
    showAppToast("اسم التاب لا يمكن أن يكون فارغاً", "warning");
  }
};

// Add product to current tab
const addProductToLines = (product) => {
  const exists = currentTab.purchaseLines.some((l) => Number(l.product_id) === Number(product.id));
  if (exists) {
    showAppToast("الصنف مضاف بالفعل", "info");
    return;
  }

  const newLine = {
    lineKey: `L-${product.id}-${Date.now()}`,
    product_id: product.id,
    product_name: product.name,
    quantity: "1",
    unit_price: String(getProductPurchasePrice(product)),
    total_price: String(getProductPurchasePrice(product)),
    purchase_unit: String(product.purchase_unit || "strip"),
  };

  updateCurrentTab({ purchaseLines: [...currentTab.purchaseLines, newLine] });
  showAppToast(`تم إضافة: ${product.name}`, "success");
};

// Update line in current tab
const updateLineInCurrentTab = (lineKey, updates) => {
  const updatedLines = currentTab.purchaseLines.map((l) => {
    if (l.lineKey !== lineKey) return l;
    const updated = { ...l, ...updates };
    const qty = Number(updated.quantity) || 0;
    const price = Number(updated.unit_price) || 0;
    updated.total_price = (qty * price).toFixed(2);
    return updated;
  });
  updateCurrentTab({ purchaseLines: updatedLines });
};

// Remove line from current tab
const removeLineFromCurrentTab = (lineKey) => {
  updateCurrentTab({ 
    purchaseLines: currentTab.purchaseLines.filter((l) => l.lineKey !== lineKey) 
  });
};

// Calculate totals
const calculateTabTotal = (lines) => {
  let total = 0;
  lines.forEach((line) => {
    const qty = Number(line.quantity) || 0;
    const price = Number(line.unit_price) || 0;
    total += qty * price;
  });
  return total.toFixed(2);
};

const calculateTabRemaining = (tab) => {
  const total = Number(calculateTabTotal(tab.purchaseLines));
  let paid = 0;
  if (tab.paymentMethod === "cash") paid = Number(tab.cashAmount) || 0;
  else if (tab.paymentMethod === "app") paid = Number(tab.appAmount) || 0;
  else if (tab.paymentMethod === "mixed") {
    paid = (Number(tab.cashAmount) || 0) + (Number(tab.appAmount) || 0);
  }
  return Math.max(0, total - paid);
};

  // New Purchase Dialog
  const [newPurchaseOpen, setNewPurchaseOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [newPurchaseError, setNewPurchaseError] = useState("");
  const [shouldPrint, setShouldPrint] = useState(false);
  const [completedPurchase, setCompletedPurchase] = useState(null);

  // Supplier Dialog
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: "", phone: "", email: "", address: "" });
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [productSubmitting, setProductSubmitting] = useState(false);
  const [productSubmitError, setProductSubmitError] = useState("");
  const [newProduct, setNewProduct] = useState({
    name: "",
    categoryId: "",
    allowSplitSales: false,
    fullUnitName: "",
    divideInto: "",
    allowSmallPieces: false,
    piecesCount: "",
    // للتوافق مع الكود القديم
    purchaseUnit: "box",
    saleUnit: "box",
    piecesPerStrip: "",
    stripsPerBox: "",
  });

  // Detail Dialog
  const [detailPurchase, setDetailPurchase] = useState(null);

  // Treasury balance
  const [treasuryBalance, setTreasuryBalance] = useState(0);
  const [initTreasuryDialogOpen, setInitTreasuryDialogOpen] = useState(false);
  const [initialTreasuryData, setInitialTreasuryData] = useState({ name: "الخزنة الرئيسية", initial_balance: "" });

  // Return dialogs
  const [returnItemsDialog, setReturnItemsDialog] = useState({ open: false, purchase: null, items: [] });
  const [fullReturnConfirm, setFullReturnConfirm] = useState({ open: false, purchase: null });
// Multi-window (tabs) states - أضف هذه الأسطر


  const appendAdminPurchaseNotification = useCallback((purchasePayload) => {
    try {
      const currentUser = JSON.parse(localStorage.getItem("user") || "null");
      const actor = currentUser?.username || currentUser?.name || "مستخدم";
      const items = Array.isArray(purchasePayload?.items) ? purchasePayload.items : [];
      const details = items.slice(0, 8).map((it) => `${it.product_name || it.name || "—"} ×${Number(it.quantity || 0)}`).join("\n");
      const more = items.length > 8 ? `\n... و${items.length - 8} صنف آخر` : "";
      const notification = {
        id: `NTF-PURCHASE-${Date.now()}`,
        type: "purchase",
        prefCategory: "purchase",
        read: false,
        readBy: [],
        deletedBy: [],
        title: "تم تسجيل شراء جديد",
        message: `${actor} سجّل فاتورة ${purchasePayload?.invoice_number || purchasePayload?.id || "-"} بقيمة ${formatCurrency(purchasePayload?.total || purchasePayload?.total_amount || 0)} شيكل`,
        details: `المورد: ${purchasePayload?.supplier_name || purchasePayload?.supplier?.name || "غير محدد"}\nالمدفوع: ${formatCurrency(purchasePayload?.paid_amount || 0)} شيكل\nالمتبقي: ${formatCurrency(purchasePayload?.remaining_amount || 0)} شيكل\nعدد الأصناف: ${items.length}\n\n${details}${more}`,
        createdAt: new Date().toISOString(),
        fromManagement: true,
        managementLabel: "إدارة النظام",
        recipients: "admin_only",
      };
      const existing = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || "[]");
      const next = Array.isArray(existing) ? [notification, ...existing] : [notification];
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(next.slice(0, 80)));
    } catch {
      // ignore
    }
  }, []);

  // Fetch purchases from backend
  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    try {
      const supplierFilterIsNumeric = /^[0-9]+$/.test(String(supplierFilter || "").trim());
      const params = {
        page,
        per_page: ROWS_PER_PAGE,
        search: purchaseSearch || undefined,
        start_date: fromDate || undefined,
        end_date: toDate || undefined,
        supplier_id: supplierFilter && supplierFilterIsNumeric ? supplierFilter : undefined,
        status: statusFilter || undefined,
      };

      const { data } = await Axios.get("purchases", { params });
      if (data?.success) {
        const normalized = normalizePurchasesPayload(data.data);
        setPurchases(normalized.rows || []);
        setTotalPages(Number(data?.pagination?.last_page || normalized.lastPage || 1));
      }
    } catch (error) {
      console.error("Error fetching purchases:", error);
      // Fallback #1:
      // بعض قواعد البيانات القديمة لا تحتوي عمود supplier_id بعد.
      // إذا فشل الطلب مع فلتر المورد، نجلب بدون الفلتر ثم نفلتر في الواجهة.
      if (supplierFilter) {
        try {
          const selectedSupplier = suppliers.find((s) => String(s.id) === String(supplierFilter));
          const retryParams = {
            page: 1,
            per_page: 100,
            search: purchaseSearch || undefined,
            start_date: fromDate || undefined,
            end_date: toDate || undefined,
            status: statusFilter || undefined,
          };
          const { data: retryData } = await Axios.get("purchases", { params: retryParams });
          if (retryData?.success) {
            const normalizedRetry = normalizePurchasesPayload(retryData.data);
            const sourceRows = normalizedRetry.rows || [];
            const clientFiltered = sourceRows.filter((row) => {
              const byId = String(row.supplier_id || row.supplier?.id || "") === String(supplierFilter);
              const byName = String(row.supplier?.name || row.supplier_name || "").trim() === String(selectedSupplier?.name || "").trim();
              return byId || byName;
            });
            const start = (page - 1) * ROWS_PER_PAGE;
            const end = start + ROWS_PER_PAGE;
            setPurchases(clientFiltered.slice(start, end));
            setTotalPages(Math.max(1, Math.ceil(clientFiltered.length / ROWS_PER_PAGE)));
            showAppToast("تم تطبيق فلترة المورد محليًا (توافق مؤقت مع قاعدة البيانات)", "info");
            return;
          }
        } catch (retryError) {
          console.error("Retry purchases fetch without supplier filter failed:", retryError);
        }
      }

      // Fallback #2: localStorage cache
      try {
        const localRaw = JSON.parse(localStorage.getItem(LOCAL_PURCHASES_KEY));
        const list = Array.isArray(localRaw) ? localRaw.map(mapLocalPurchaseInvoice) : [];
        const filtered = list.filter((row) => {
          const q = String(purchaseSearch || "").trim().toLowerCase();
          const rowDate = String(row.purchase_date || "");
          const supplierOk = !supplierFilter || String(row.supplier_id || "") === String(supplierFilter);
          const statusOk = !statusFilter || normalizePurchaseStatus(row.status) === normalizePurchaseStatus(statusFilter);
          const fromOk = !fromDate || !rowDate || rowDate.slice(0, 10) >= fromDate;
          const toOk = !toDate || !rowDate || rowDate.slice(0, 10) <= toDate;
          const searchOk =
            !q ||
            String(row.invoice_number || row.id || "").toLowerCase().includes(q) ||
            String(row.supplier?.name || "").toLowerCase().includes(q);
          return supplierOk && statusOk && fromOk && toOk && searchOk;
        });
        const start = (page - 1) * ROWS_PER_PAGE;
        const end = start + ROWS_PER_PAGE;
        setPurchases(filtered.slice(start, end));
        setTotalPages(Math.max(1, Math.ceil(filtered.length / ROWS_PER_PAGE)));
        showAppToast("تعذر جلب المشتريات من السيرفر، تم عرض البيانات المحلية", "warning");
      } catch {
        setPurchases([]);
        setTotalPages(1);
        showAppToast("فشل في جلب المشتريات", "error");
      }
    } finally {
      setLoading(false);
    }
  }, [page, purchaseSearch, fromDate, toDate, supplierFilter, statusFilter]);

  const supplierStats = useMemo(() => {
    const scoped = supplierFilter
      ? purchases.filter((p) => String(p.supplier_id || p.supplier?.id || "") === String(supplierFilter))
      : purchases;
    const totalAmount = scoped.reduce((sum, p) => sum + Number(p.total_amount || 0), 0);
    const paidAmount = scoped.reduce((sum, p) => sum + Number(p.paid_amount || 0), 0);
    const remainingAmount = scoped.reduce((sum, p) => sum + Number(p.remaining_amount || 0), 0);
    const completedCount = scoped.filter((p) => normalizePurchaseStatus(p.status) === "completed").length;
    const partialCount = scoped.filter((p) => normalizePurchaseStatus(p.status) === "partially_paid").length;
    const pendingCount = scoped.filter((p) => normalizePurchaseStatus(p.status) === "pending").length;
    return {
      totalPurchases: scoped.length,
      totalAmount,
      paidAmount,
      remainingAmount,
      completedCount,
      partialCount,
      pendingCount,
      supplierName: supplierFilter ? suppliers.find((s) => String(s.id) === String(supplierFilter))?.name || "" : "كل الموردين",
    };
  }, [supplierFilter, purchases, suppliers]);

  // Fetch products for catalog
  const fetchProducts = useCallback(async () => {
    try {
      const { data } = await Axios.get("products", { params: { per_page: 100, scope: "purchase" } });
      if (data.success) {
        setProducts(data.data?.data || data.data || []);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
    }
  }, []);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const { data } = await Axios.get("categories", { params: { scope: "purchase" } });
      if (data.success) {
        setCategories(data.data || []);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  }, []);

  // Fetch suppliers
  const fetchSuppliers = useCallback(async () => {
    const loadLocalSuppliers = () => {
      try {
        const raw = JSON.parse(localStorage.getItem(LOCAL_SUPPLIERS_KEY));
        const list = Array.isArray(raw) ? raw.filter((s) => s && s.active !== false) : [];
        return list.map((s) => ({
          id: s.id,
          name: s.name,
          phone: s.phone || null,
          email: s.email || null,
          address: s.address || null,
        }));
      } catch {
        return [];
      }
    };
    try {
      const { data } = await Axios.get("suppliers");
      if (data.success) {
        const remote = Array.isArray(data.data) ? data.data : [];
        const merged = remote.length ? remote : loadLocalSuppliers();
        setSuppliers(merged);
        // ❌ إزالة هذا السطر - لا نريد اختيار مورد تلقائياً
        // if (merged.length > 0 && !selectedSupplierId) {
        //   setSelectedSupplierId(String(merged[0].id));
        // }
      }
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      const local = loadLocalSuppliers();
      setSuppliers(local);
      // ❌ إزالة هذا السطر أيضاً
      // if (local.length > 0 && !selectedSupplierId) {
      //   setSelectedSupplierId(String(local[0].id));
      // }
    }
  }, []); // يمكنك إزالة selectedSupplierId من dependencies إذا لم تعد تستخدمه
  // Fetch treasury balance
  const fetchTreasuryBalance = useCallback(async () => {
    try {
      const { data } = await Axios.get("treasury-balance");
      if (data.success) {
        const balance = data.data?.balance ?? 0;
        setTreasuryBalance(balance);
        
        // If treasury doesn't exist, initialize it
        if (!data.data?.exists) {
          showAppToast("تحذير: الخزنة غير مُهيأة - أضف رصيداً أولاً", "warning");
        }
      }
    } catch (error) {
      console.error("Error fetching treasury:", error);
      showAppToast("فشل في جلب رصيد الخزنة", "error");
    }
  }, []);

  const refreshPageData = useCallback(() => {
    fetchPurchases();
    fetchSuppliers();
    fetchTreasuryBalance();
  }, [fetchPurchases, fetchSuppliers, fetchTreasuryBalance]);

  // Initial load
  useEffect(() => {
    refreshPageData();
  }, [refreshPageData]);

  // Load catalog data when dialog opens
  useEffect(() => {
    if (newPurchaseOpen) {
      fetchProducts();
      fetchCategories();
      fetchSuppliers();
      fetchTreasuryBalance();
    }
  }, [newPurchaseOpen, fetchProducts, fetchCategories, fetchSuppliers, fetchTreasuryBalance]);

  // Filter products
  const topSellingProductIds = useMemo(() => {
    const counts = new Map();
    (Array.isArray(purchases) ? purchases : []).forEach((purchase) => {
      (Array.isArray(purchase?.items) ? purchase.items : []).forEach((item) => {
        if (!item?.product_id) return;
        counts.set(String(item.product_id), (counts.get(String(item.product_id)) || 0) + Number(item.quantity || 0));
      });
    });
    return new Set(
      Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([id]) => id),
    );
  }, [purchases]);

  const filteredProducts = useMemo(() => {
    const q = currentTab.catalogSearch.trim().toLowerCase();  // ← استخدم currentTab
    return products.filter((p) => {
      const catOk = currentTab.catalogCategory === "all" || String(p.category_id) === currentTab.catalogCategory || p.categories?.some(c => String(c.id) === currentTab.catalogCategory);
      if (!catOk) return false;
      if (currentTab.catalogQuickFilter === "top_selling" && topSellingProductIds.size > 0 && !topSellingProductIds.has(String(p.id))) return false;
      if (!q) return true;
      return (
        String(p.name || "").toLowerCase().includes(q) ||
        String(p.code || "").toLowerCase().includes(q) ||
        String(p.barcode || "").toLowerCase().includes(q) ||
        String(p.sku || "").toLowerCase().includes(q)
      );
    });
  }, [products, currentTab.catalogSearch, currentTab.catalogCategory, currentTab.catalogQuickFilter, topSellingProductIds]);




  


  // Add new supplier
  const handleAddSupplier = async () => {
    if (!newSupplier.name.trim()) {
      showAppToast("اسم المورد مطلوب", "error");
      return;
    }

    try {
      const { data } = await Axios.post("suppliers", {
        name: newSupplier.name,
        phone: newSupplier.phone || null,
        email: newSupplier.email || null,
        address: newSupplier.address || null,
      });

      if (data.success) {
        showAppToast("تم إضافة المورد بنجاح", "success");
        setSuppliers((prev) => [...prev, data.data]);
        setSupplierDialogOpen(false);
        setNewSupplier({ name: "", phone: "", email: "", address: "" });
      }
    } catch (error) {
      console.error("Error adding supplier:", error);
      showAppToast("فشل في إضافة المورد", "error");
    }
  };

  const handleAddProductInline = async () => {
    if (productSubmitting) return;
    setProductSubmitError("");
    
    const name = String(newProduct.name || "").trim();
    const catId = Number(newProduct.categoryId);
    const allowSplitSales = Boolean(newProduct.allowSplitSales);
    
    // حقول التجزئة الجديدة
    const fullUnitName = String(newProduct.fullUnitName || "").trim();
    const divideInto = Number(newProduct.divideInto || 0);
    const allowSmallPieces = Boolean(newProduct.allowSmallPieces);
    const piecesCount = Number(newProduct.piecesCount || 0);
    
    // التحقق
    if (!name) {
      setProductSubmitError("اسم الصنف مطلوب");
      return;
    }
    if (!Number.isFinite(catId) || catId <= 0) {
      setProductSubmitError("اختر قسمًا صحيحًا");
      return;
    }
    
    if (allowSplitSales && divideInto <= 0) {
      setProductSubmitError("أدخل عدد الأجزاء المتساوية (مثال: 2 لنصف، 3 لثلث)");
      return;
    }
    
    if (allowSplitSales && allowSmallPieces && piecesCount <= 0) {
      setProductSubmitError("أدخل عدد القطع الصغيرة في الوحدة الكاملة");
      return;
    }
    
    try {
      setProductSubmitting(true);
      const response = await Axios.post("products", {
        name,
        category_id: catId,
        categories: [catId],
        price: null,
        purchase_price: 0,
        cost_price: 0,
        is_active: true,
        
        // ✅ حقول التجزئة الجديدة
        allow_split_sales: allowSplitSales,
        full_unit_name: fullUnitName,        // ← جديد
        divide_into: divideInto,              // ← جديد
        allow_small_pieces: allowSmallPieces, // ← جديد
        pieces_count: piecesCount,            // ← جديد
        
        // وحدات موحّدة مع المخزون/الكاشير (علبة كوحدة أساس)
        unit: "box",
        purchase_unit: "box",
        sale_unit: "box",
      });
  
      showAppToast("تمت إضافة الصنف بنجاح", "success");
      setProductDialogOpen(false);
      setProductSubmitError("");
      setNewProduct({
        name: "",
        categoryId: "",
        allowSplitSales: false,
        fullUnitName: "",
        divideInto: "",
        allowSmallPieces: false,
        piecesCount: "",
      });
      await fetchProducts();
      
    } catch (error) {
      console.error("Product add error:", error.response?.data || error);
      let errorMsg = "فشل إضافة الصنف";
      if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error.message) {
        errorMsg = error.message;
      }
      setProductSubmitError(errorMsg);
      showAppToast(errorMsg, "error");
    } finally {
      setProductSubmitting(false);
    }
  };


  const confirmCurrentTabPurchase = async () => {
    setNewPurchaseError("");
  
    const supplier = suppliers.find((s) => String(s.id) === String(currentTab.selectedSupplierId));
    if (!supplier) {
      setNewPurchaseError("اختر مورداً من القائمة");
      return;
    }
  
    if (currentTab.purchaseLines.length === 0) {
      setNewPurchaseError("أضف صنفًا واحدًا على الأقل");
      return;
    }
  
    for (const line of currentTab.purchaseLines) {
      const qty = Number(line.quantity) || 0;
      const price = Number(line.unit_price) || 0;
      if (qty <= 0) {
        setNewPurchaseError(`أدخل كمية صحيحة لـ ${line.product_name}`);
        return;
      }
      if (price <= 0) {
        setNewPurchaseError(`أدخل سعر شراء صحيح لـ ${line.product_name}`);
        return;
      }
    }
  
    const totalAmount = Number(calculateTabTotal(currentTab.purchaseLines));
    const remainingAmount = calculateTabRemaining(currentTab);
    
    let paidAmount = 0;
    if (currentTab.paymentMethod === "cash") paidAmount = Number(currentTab.cashAmount) || 0;
    else if (currentTab.paymentMethod === "app") paidAmount = Number(currentTab.appAmount) || 0;
    else if (currentTab.paymentMethod === "mixed") {
      paidAmount = (Number(currentTab.cashAmount) || 0) + (Number(currentTab.appAmount) || 0);
    }
  
    if (paidAmount > totalAmount + 0.01) {
      setNewPurchaseError("المبلغ المدفوع لا يمكن أن يكون أكبر من إجمالي الفاتورة");
      return;
    }
  
    const items = currentTab.purchaseLines.map((line) => ({
      product_id: line.product_id,
      product_name: line.product_name,
      quantity: Number(line.quantity),
      unit_price: Number(line.unit_price),
      total_price: Number(line.total_price),
      purchase_unit: line.purchase_unit || "strip",
    }));
  
    let status = "completed";
    if (remainingAmount > 0) {
      status = paidAmount > 0 ? "partially_paid" : "pending";
    }
  
    try {
      const invoiceNumber = `PO-${Date.now()}`;
      const { data } = await Axios.post("purchases", {
        invoice_number: invoiceNumber,
        supplier_id: supplier.id,
        items,
        total_amount: totalAmount,
        paid_amount: paidAmount,
        remaining_amount: remainingAmount,
        status: status,
        purchase_date: new Date().toISOString().split("T")[0],
        payment_method: currentTab.paymentMethod,
        cash_amount: currentTab.paymentMethod === "mixed" ? Number(currentTab.cashAmount) || 0 : (currentTab.paymentMethod === "cash" ? paidAmount : 0),
        app_amount: currentTab.paymentMethod === "mixed" ? Number(currentTab.appAmount) || 0 : (currentTab.paymentMethod === "app" ? paidAmount : 0),
      });
  
      if (data.success) {
        showAppToast("تم تسجيل عملية الشراء بنجاح", "success");
        
        appendAudit({
          action: "purchase_created",
          details: JSON.stringify({
            purchase_id: data.data.id,
            invoice_number: invoiceNumber,
            supplier: supplier.name,
            total: totalAmount,
          }),
        });
  
        closePurchaseTab(activeTabId);
        refreshPageData();
      }
    } catch (error) {
      console.error("Error creating purchase:", error);
      setNewPurchaseError(error.response?.data?.message || "فشل في إنشاء عملية الشراء");
    }
  };
  // Initialize treasury
  const handleInitTreasury = async () => {
    try {
      const { data } = await Axios.post("treasury-init", {
        name: initialTreasuryData.name,
        initial_balance: Number(initialTreasuryData.initial_balance) || 0,
      });

      if (data.success) {
        showAppToast(data.data?.created ? "تم إنشاء الخزنة بنجاح" : "الخزنة موجودة بالفعل", "success");
        setInitTreasuryDialogOpen(false);
        fetchTreasuryBalance();
      }
    } catch (error) {
      console.error("Error initializing treasury:", error);
      showAppToast("فشل في إنشاء الخزنة", "error");
    }
  };

  // Handle supplier debt payment
/**
 * معالجة تسديد دين المورد
 * تقوم هذه الدالة بإرسال طلب للخادم لتسديد جزء أو كل دين المورد
 */
const handleSupplierPayment = async () => {
  // ✅ التحقق من صحة المدخلات
  if (!paymentAmount || Number(paymentAmount) <= 0 || !supplierFilter) {
    showAppToast("يرجى إدخال مبلغ صحيح للتسديد", "warning");
    return;
  }
  
  // ✅ التحقق من عدم تجاوز المبلغ المسدد للدين المتبقي
  if (Number(paymentAmount) > supplierStats.remainingAmount) {
    showAppToast(`المبلغ المسدد (${formatCurrency(Number(paymentAmount))}) يتجاوز قيمة الدين (${formatCurrency(supplierStats.remainingAmount)})`, "error");
    return;
  }
  
  // ✅ التحقق من صحة الدفع المختلط (كاش + تطبيق)
  if (paymentMethodDialog === 'mixed') {
    const cashAmount = Number(cashAmountDialog) || 0;
    const appAmount = Number(appAmountDialog) || 0;
    const total = cashAmount + appAmount;
    
    // التأكد أن مجموع الكاش والتطبيق يساوي المبلغ الإجمالي
    if (Math.abs(total - Number(paymentAmount)) > 0.01) {
      showAppToast("مجموع الكاش والتطبيق يجب أن يساوي إجمالي مبلغ التسديد", "error");
      return;
    }
    
    // التأكد أن كلا المبلغين موجبين عند استخدام الدفع المختلط
    if (cashAmount <= 0 && appAmount <= 0) {
      showAppToast("يرجى إدخال مبلغ في أحد الحقول على الأقل للدفع المختلط", "error");
      return;
    }
  }
  
  // ✅ التحقق من صحة الدفع النقدي
  if (paymentMethodDialog === 'cash') {
    const cashAmount = Number(cashAmountDialog) || 0;
    if (cashAmount <= 0) {
      showAppToast("يرجى إدخال مبلغ نقدي صحيح", "error");
      return;
    }
    if (Math.abs(cashAmount - Number(paymentAmount)) > 0.01) {
      showAppToast("المبلغ النقدي يجب أن يساوي إجمالي مبلغ التسديد", "error");
      return;
    }
  }
  
  // ✅ التحقق من صحة دفع التطبيق
  if (paymentMethodDialog === 'app') {
    const appAmount = Number(appAmountDialog) || 0;
    if (appAmount <= 0) {
      showAppToast("يرجى إدخال مبلغ تطبيق صحيح", "error");
      return;
    }
    if (Math.abs(appAmount - Number(paymentAmount)) > 0.01) {
      showAppToast("مبلغ التطبيق يجب أن يساوي إجمالي مبلغ التسديد", "error");
      return;
    }
  }
  
  try {
    // ✅ إرسال طلب التسديد للخادم
    const { data } = await Axios.post(`suppliers/${supplierFilter}/pay-debt`, {
      amount: Number(paymentAmount),
      payment_method: paymentMethodDialog,
      cash_amount: paymentMethodDialog === 'cash' 
        ? Number(paymentAmount) 
        : paymentMethodDialog === 'mixed' 
          ? Number(cashAmountDialog) || 0 
          : 0,
      app_amount: paymentMethodDialog === 'app' 
        ? Number(paymentAmount) 
        : paymentMethodDialog === 'mixed' 
          ? Number(appAmountDialog) || 0 
          : 0,
      notes: `تسديد دين - ${new Date().toLocaleDateString('ar-SA')} - ${new Date().toLocaleTimeString('ar-SA')}`,
      paid_by: JSON.parse(localStorage.getItem("user") || "{}")?.name || "مستخدم النظام"
    });
    
    // ✅ معالجة الاستجابة الناجحة
    if (data.success) {
      // عرض رسالة نجاح مع تفاصيل المبلغ
      const successMessage = `تم تسديد ${formatCurrency(Number(paymentAmount))} شيكل بنجاح`;
      showAppToast(successMessage, "success");
      
      // إعادة تعيين جميع الحقول
      setPaymentDialogOpen(false);
      setPaymentAmount("");
      setCashAmountDialog("");
      setAppAmountDialog("");
      
      // تحديث البيانات (المشتريات والموردين والخزنة)
      refreshPageData();
      
      // إذا كان هناك تفاصيل مفتوحة، قم بتحديثها
      if (detailPurchase?.id) {
        await handleOpenPurchaseDetails({ id: detailPurchase.id });
      }
      
      // تسجيل عملية التسديد في سجل المراجعة (Audit Log)
      appendAudit({
        action: "supplier_debt_payment",
        details: JSON.stringify({
          supplier_id: supplierFilter,
          supplier_name: supplierStats.supplierName,
          amount: Number(paymentAmount),
          payment_method: paymentMethodDialog,
          cash_amount: paymentMethodDialog === 'mixed' ? Number(cashAmountDialog) : (paymentMethodDialog === 'cash' ? Number(paymentAmount) : 0),
          app_amount: paymentMethodDialog === 'mixed' ? Number(appAmountDialog) : (paymentMethodDialog === 'app' ? Number(paymentAmount) : 0),
          remaining_debt: supplierStats.remainingAmount - Number(paymentAmount)
        })
      });
    } else {
      // ✅ معالجة فشل الطلب من الخادم
      showAppToast(data.message || "فشل في تسديد الدين", "error");
    }
    
  } catch (error) {
    // ✅ معالجة أخطاء الشبكة أو الخادم
    console.error("Error paying supplier debt:", error);
    
    // استخراج رسالة الخطأ من استجابة الخادم إن وجدت
    let errorMessage = "فشل في تسديد الدين";
    
    if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.response?.data?.error) {
      errorMessage = error.response.data.error;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    // عرض رسالة خطأ مفصلة
    showAppToast(errorMessage, "error");
    
    // إذا كان الخطأ بسبب رصيد الخزنة غير كافٍ
    if (error.response?.data?.insufficient_balance) {
      showAppToast("رصيد الخزنة غير كافٍ لإتمام عملية التسديد", "warning");
      setInitTreasuryDialogOpen(true);
    }
  }
};

  // Handle return items
  const handleReturnItems = async () => {
    const itemsToReturn = returnItemsDialog.items.filter(i => i.returnQty > 0);
    if (itemsToReturn.length === 0) return;

    try {
      const { data } = await Axios.post(`purchases/${returnItemsDialog.purchase.id}/return-items`, {
        items: itemsToReturn.map(item => ({
          purchase_item_id: item.id,
          quantity: item.returnQty
        })),
        reason: 'إرجاع أصناف محددة'
      });

      if (data.success) {
        showAppToast(`تم إرجاع ${itemsToReturn.length} صنف بنجاح`, "success");
        setReturnItemsDialog({ open: false, purchase: null, items: [] });
        if (detailPurchase?.id) {
          await handleOpenPurchaseDetails({ id: detailPurchase.id });
        }
        refreshPageData();
      }
    } catch (error) {
      console.error("Error returning items:", error);
      showAppToast(error.response?.data?.message || "فشل في إرجاع الأصناف", "error");
    }
  };

  const handleOpenPurchaseDetails = async (purchase) => {
    if (!purchase?.id) return;
    try {
      const { data } = await Axios.get(`purchases/${purchase.id}`);
      if (data?.success && data?.data) {
        setDetailPurchase(data.data);
        return;
      }
    } catch (error) {
      console.error("Error fetching purchase details:", error);
    }
    setDetailPurchase(purchase);
  };

  // Handle full return
  const handleFullReturn = async () => {
    if (!fullReturnConfirm.purchase) return;

    try {
      const { data } = await Axios.post(`purchases/${fullReturnConfirm.purchase.id}/full-return`, {
        reason: 'إرجاع فاتورة كاملة'
      });

      if (data.success) {
        showAppToast("تم إرجاع الفاتورة بالكامل بنجاح", "success");
        setFullReturnConfirm({ open: false, purchase: null });
        setDetailPurchase(null);
        refreshPageData();
      }
    } catch (error) {
      console.error("Error returning purchase:", error);
      showAppToast(error.response?.data?.message || "فشل في إرجاع الفاتورة", "error");
    }
  };

  // Handle print
  const handlePrint = (purchaseToPrint = null) => {
    const purchaseData = purchaseToPrint || completedPurchase;
    if (!purchaseData) return;
    
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      showAppToast("تم حظر النافذة المنبثقة — اسمح بالنوافذ المنبثقة", "error");
      return;
    }

    const html = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>فاتورة شراء #${purchaseData.invoice_number || purchaseData.id}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
          .header h1 { margin: 0; font-size: 24px; }
          .info { margin-bottom: 20px; }
          .info-row { display: flex; justify-content: space-between; margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: center; }
          th { background-color: #f5f5f5; font-weight: bold; }
          .total { text-align: left; font-size: 18px; font-weight: bold; margin-top: 20px; }
          .footer { margin-top: 40px; text-align: center; font-size: 12px; color: #666; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>فاتورة شراء</h1>
          <p>رقم الفاتورة: ${purchaseData.invoice_number || purchaseData.id}</p>
        </div>
        
        <div class="info">
          <div class="info-row"><span>المورد:</span><strong>${purchaseData.supplier_name || purchaseData?.supplier?.name || "مورد عام"}</strong></div>
          <div class="info-row"><span>التاريخ:</span><strong>${new Date().toLocaleString("ar-SA")}</strong></div>
          <div class="info-row"><span>عدد الأصناف:</span><strong>${purchaseData.items?.length || 0}</strong></div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>الصنف</th>
              <th>الكمية</th>
              <th>سعر الوحدة</th>
              <th>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${(purchaseData.items || []).map((item, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${item.product_name || item.name || "-"}</td>
                <td>${formatOneDecimal(item.quantity || item.qty || 0)}</td>
                <td>${formatCurrency(item.unit_price || 0)} شيكل</td>
                <td>${formatCurrency(item.total_price || (item.quantity * item.unit_price) || 0)} شيكل</td>
              </tr>
            `).join("")}
          </tbody>
        </table>
        
        <div class="total">
          الإجمالي: ${formatCurrency(purchaseData.total || purchaseData.total_amount || 0)} شيكل
        </div>
        
        <div class="footer">
          <p>تم إنشاء هذه الفاتورة بواسطة نظام الصيدلية</p>
          <button class="no-print" onclick="window.print()" style="padding: 10px 20px; font-size: 16px; cursor: pointer;">
            طباعة الفاتورة
          </button>
        </div>
        
        <script>
          window.onload = function() {
            setTimeout(() => window.print(), 500);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const openReturnItemsDialog = (purchase) => {
    const seededItems = Array.isArray(purchase?.items)
      ? purchase.items.map((it) => ({
          ...it,
          returnQty: "",
        }))
      : [];
    setReturnItemsDialog({ open: true, purchase, items: seededItems });
    setDetailPurchase(null);
  };

  const openNewPurchase = () => {
    setNewPurchaseOpen(true);
  };

 

  return (
    <AdminLayout mode={mode} onToggleMode={onToggleMode}>
      <Box sx={adminPageContainerSx}>
        {/* Header */}
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "flex-start" }} sx={{ mb: 2, gap: 1.5 }}>
          <Box>
            <Typography variant="h5" fontWeight={900}>إدارة المشتريات</Typography>
            <Typography variant="body2" color="text.secondary" sx={adminPageSubtitleSx}>
              تسجيل المشتريات وإدارة الموردين والمخزون
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<Add />} onClick={openNewPurchase} sx={{ textTransform: "none", fontWeight: 800 }}>
            شراء جديد
          </Button>
        </Stack>

    {/* Stats Row */}
{/* Stats Row - السطر الأول: معلومات عامة */}
{/* Stats Row - السطر الأول: معلومات عامة */}
<Grid container spacing={2} sx={{ mb: 2 }}>  {/* رصيد الخزنة - يذهب إلى إعدادات المال */}
  <Grid size={{ xs: 6, sm: 6, md: 3 }}>
    <Card 
      sx={{ 
        p: 2, 
        borderRadius: 3, 
        border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`, 
        height: '100%',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: 4,
          borderColor: 'primary.main'
        }
      }}
      onClick={() => handleCardNavigate('/admin/settings/money')}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="body2" color="text.secondary">رصيد الخزنة</Typography>
          <Typography variant="h5" fontWeight={900}>{formatCurrency(treasuryBalance)} شيكل</Typography>
        </Box>
        <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: "primary.main" }}>
          <LocalShipping />
        </Avatar>
      </Stack>
    </Card>
  </Grid>
  {/* الموردين - يذهب إلى صفحة الموردين */}
  <Grid size={{ xs: 6, sm: 6, md: 3 }}>
    <Card 
      sx={{ 
        p: 2, 
        borderRadius: 3, 
        border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}`, 
        height: '100%',
        transition: 'all 0.2s ease',
       
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="body2" color="text.secondary">الموردين</Typography>
          <Typography variant="h5" fontWeight={900}>{suppliers.length}</Typography>
        </Box>
        <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: "primary.main" }}>
          <Storefront />
        </Avatar>
      </Stack>
    </Card>
  </Grid>



  {/* إجمالي المشتريات - يذهب إلى تقارير المشتريات */}
  <Grid size={{ xs: 6, sm: 6, md: 3 }}>
    <Card 
      sx={{ 
        p: 2, 
        borderRadius: 2, 
        height: '100%',
        transition: 'all 0.2s ease',
      
      }}
    >
      <Typography variant="body2" color="text.secondary">إجمالي المشتريات</Typography>
      <Typography variant="h5" fontWeight={700} color="primary.main">{formatCurrency(supplierStats.totalAmount)} شيكل</Typography>
      <Typography variant="caption">{supplierStats.totalPurchases} فاتورة</Typography>
    </Card>
  </Grid>

  {/* المبلغ المدفوع */}
  <Grid size={{ xs: 6, sm: 6, md: 3 }}>
    <Card 
      sx={{ 
        p: 2, 
        borderRadius: 2, 
        height: '100%'
      }}
      // هذا الكارد ليس له صفحة محددة، يبقى بدون onClick أو يمكن أن يذهب لتقارير المدفوعات
    >
      <Typography variant="body2" color="text.secondary">المبلغ المدفوع</Typography>
      <Typography variant="h5" fontWeight={700} color="success.main">{formatCurrency(supplierStats.paidAmount)} شيكل</Typography>
      <Typography variant="caption">{supplierStats.completedCount} مدفوع بالكامل</Typography>
    </Card>
  </Grid>
</Grid>

{/* Stats Row - السطر الثاني: معلومات الدين (تظهر فقط إذا فيه دين) */}
{/* Stats Row - السطر الثاني: معلومات الدين (تظهر فقط إذا فيه دين وتم اختيار مورد محدد) */}
{/* Stats Row - السطر الثاني: معلومات الدين (تظهر فقط إذا فيه دين وتم اختيار مورد محدد) */}
{supplierFilter && supplierStats.remainingAmount > 0 && (
  <Grid container spacing={2} sx={{ mb: 2 }}>
    {/* المبلغ المتبقي (الدين) - يذهب لصفحة الموردين مع فلتر المورد الحالي */}
    <Grid size={{ xs: 12, sm: 6, md: 6 }}>
      <Card 
        sx={{ 
          p: 2, 
          bgcolor: alpha(theme.palette.warning.main, 0.05), 
          borderRadius: 2, 
          height: '100%',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: 4,
            bgcolor: alpha(theme.palette.warning.main, 0.1)
          }
        }}
        onClick={() => handleCardNavigate(`/admin/suppliers?debt=${supplierFilter}`)}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="body2" color="text.secondary">المبلغ المتبقي (الدين)</Typography>
            <Typography variant="h5" fontWeight={700} color="warning.main">{formatCurrency(supplierStats.remainingAmount)} شيكل</Typography>
            <Typography variant="caption">{supplierStats.partialCount} جزئي + {supplierStats.pendingCount} معلق</Typography>
          </Box>
          <Button 
            variant="contained" 
            size="small" 
            color="warning" 
            onClick={(e) => {
              e.stopPropagation(); // لمنع التنقل عند الضغط على الزر
              setPaymentDialogOpen(true);
            }} 
            sx={{ textTransform: "none", whiteSpace: 'nowrap' }}
          >
            تسديد دين
          </Button>
        </Stack>
      </Card>
    </Grid>

    {/* حالة حسابات المورد - يذهب لصفحة الموردين */}
    <Grid size={{ xs: 12, sm: 6, md: 6 }}>
      <Card 
        sx={{ 
          p: 2, 
          bgcolor: alpha(theme.palette.info.main, 0.05), 
          borderRadius: 2, 
          height: '100%',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: 4,
            bgcolor: alpha(theme.palette.info.main, 0.1)
          }
        }}
        onClick={() => handleCardNavigate(`/admin/suppliers?view=${supplierFilter}`)}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="body2" color="text.secondary">حالة حسابات المورد</Typography>
            <Typography variant="body1" fontWeight={600}>
              {supplierStats.totalPurchases} فاتورة
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {supplierStats.completedCount} مدفوعة · {supplierStats.partialCount + supplierStats.pendingCount} عليها دين
            </Typography>
          </Box>
          <Avatar sx={{ bgcolor: alpha(theme.palette.info.main, 0.12), color: "info.main" }}>
            <ReceiptLong />
          </Avatar>
        </Stack>
      </Card>
    </Grid>
  </Grid>
)}

     {/* شريط التصفية المطور */}
<Card 
  elevation={0} 
  sx={{ 
    p: 2, 
    mb: 3, 
    borderRadius: 4, 
    border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
    bgcolor: alpha(theme.palette.background.paper, 0.8),
    backdropFilter: 'blur(8px)'
  }}
>
  <Grid container spacing={2} alignItems="center">
    
    {/* 1. قسم البحث العام */}
    <Grid size={{ xs: 12, md: 3 }}>
      <TextField 
        fullWidth 
        size="small" 
        placeholder="بحث برقم الفاتورة..." 
        value={purchaseSearch} 
        onChange={(e) => { setPurchaseSearch(e.target.value); setPage(1); }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search fontSize="small" color="primary" />
            </InputAdornment>
          ),
          sx: { borderRadius: 2.5 }
        }}
      />
    </Grid>

    {/* 2. قسم المورد */}
    <Grid size={{ xs: 12, sm: 6, md: 2 }}>
      <TextField 
        select 
        fullWidth 
        size="small" 
        label="المورد" 
        value={supplierFilter} 
        onChange={(e) => { setSupplierFilter(e.target.value); setPage(1); }}
        SelectProps={{ native: true }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Person fontSize="small" sx={{ color: 'text.secondary', mr: 0.5 }} />
            </InputAdornment>
          ),
          sx: { borderRadius: 2.5 }
        }}
      >
        <option value="">كل الموردين</option>
        {suppliers.map((s) => (<option key={s.id} value={String(s.id)}>{s.name}</option>))}
      </TextField>
    </Grid>

    {/* 3. قسم الحالة */}
    <Grid size={{ xs: 12, sm: 6, md: 2 }}>
      <TextField 
        select 
        fullWidth 
        size="small" 
        label="الحالة" 
        value={statusFilter} 
        onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        SelectProps={{ native: true }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Payments fontSize="small" sx={{ color: 'text.secondary', mr: 0.5 }} />
            </InputAdornment>
          ),
          sx: { borderRadius: 2.5 }
        }}
      >
        <option value="">كل الحالات</option>
        <option value="completed">مدفوع بالكامل</option>
        <option value="partially_paid">دفع جزئي</option>
        <option value="pending">معلق (دين)</option>
        <option value="returned">مرجع</option>
      </TextField>
    </Grid>

    {/* 4. قسم النطاق الزمني */}
    {/* حقل تاريخ البدء */}
<Grid size={{ xs: 12, sm: 6, md: 2 }}>
  <TextField 
    fullWidth 
    size="small" 
    type="date" 
    label="من تاريخ" 
    value={fromDate} 
    onChange={(e) => { setFromDate(e.target.value); setPage(1); }} 
    InputLabelProps={{ shrink: true }}
    // التعديل هنا: عند النقر على الحقل يتم فتح التقويم تلقائياً
    onClick={(e) => {
      if (e.target.showPicker) {
        e.target.showPicker();
      }
    }}
    InputProps={{ 
      sx: { 
        borderRadius: 2.5,
        cursor: 'pointer', // تغيير شكل الماوس ليشعر المستخدم أنه قابل للنقر
        "& input": { cursor: 'pointer' } // التأكد من أن الماوس يتغير حتى فوق النص
      } 
    }}
  />
</Grid>

{/* حقل تاريخ الانتهاء */}
<Grid size={{ xs: 12, sm: 6, md: 2 }}>
  <TextField 
    fullWidth 
    size="small" 
    type="date" 
    label="إلى تاريخ" 
    value={toDate} 
    onChange={(e) => { setToDate(e.target.value); setPage(1); }} 
    InputLabelProps={{ shrink: true }}
    // التعديل هنا أيضاً
    onClick={(e) => {
      if (e.target.showPicker) {
        e.target.showPicker();
      }
    }}
    InputProps={{ 
      sx: { 
        borderRadius: 2.5,
        cursor: 'pointer',
        "& input": { cursor: 'pointer' }
      } 
    }}
  />
</Grid>
    {/* 5. أزرار التحكم */}
    <Grid size={{ xs: 12, md: 1 }}>
      <Tooltip title="إعادة ضبط الفلاتر">
        <Button 
          fullWidth
          variant="outlined" 
          color="error"
          onClick={() => { 
            setPurchaseSearch(""); setSupplierFilter(""); 
            setStatusFilter(""); setFromDate(""); 
            setToDate(""); setPage(1); 
          }}
          sx={{ 
            height: 40, 
            borderRadius: 2.5, 
            minWidth: 40,
            borderColor: alpha(theme.palette.error.main, 0.3),
            '&:hover': { bgcolor: alpha(theme.palette.error.main, 0.05) }
          }}
        >
          <RestartAlt />
        </Button>
      </Tooltip>
    </Grid>

  </Grid>
</Card>

        {/* Purchases Table */}
        <Card sx={{ borderRadius: 3, p: 1.2 }}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>رقم الفاتورة</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>المورد</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>التاريخ</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>القيمة</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>الحالة</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>تفاصيل</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>جاري تحميل بيانات المشتريات...</Typography>
                    </TableCell>
                  </TableRow>
                )}
                {purchases.map((row) => (
                  <TableRow key={row.id} hover>
                    <TableCell align="center" sx={{ fontWeight: 700, color: "primary.main" }}>{row.invoice_number || row.id}</TableCell>
                    <TableCell align="center">{row.supplier?.name || "مورد عام"}</TableCell>
                    <TableCell align="center">{row.purchase_date ? new Date(row.purchase_date).toLocaleDateString("ar-SA") : "-"}</TableCell>
                    <TableCell align="center">{formatCurrency(row.total_amount)} شيكل</TableCell>
                    <TableCell align="center">
                      <Chip size="small" 
                        label={row.status === "completed" ? "مدفوع" : row.status === "partially_paid" ? "جزئي" : row.status === "pending" ? "معلق" : row.status === "returned" ? "مرجع" : row.status} 
                        color={row.status === "completed" ? "success" : row.status === "partially_paid" ? "warning" : row.status === "returned" ? "error" : "default"} 
                        variant="outlined" 
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={1} justifyContent="center">
                        <Button size="small" variant="outlined" onClick={() => handleOpenPurchaseDetails(row)} sx={{ textTransform: "none" }}>عرض</Button>
                        <Button size="small" variant="outlined" color="primary" startIcon={<Print />} onClick={() => { setCompletedPurchase(row); setTimeout(() => handlePrint(row), 100); }} sx={{ textTransform: "none" }}>طباعة</Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
                {purchases.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>لا توجد مشتريات مسجلة</Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {totalPages > 1 && (
            <Stack direction="row" justifyContent="center" sx={{ mt: 1.5 }}>
              <Pagination count={totalPages} page={page} onChange={(_, value) => setPage(value)} color="primary" shape="rounded" />
            </Stack>
          )}
        </Card>
      </Box>

  
      <Dialog 
  open={newPurchaseOpen} 
  onClose={() => setNewPurchaseOpen(false)} 
  fullWidth 
  maxWidth="lg" 
  PaperProps={{ sx: { borderRadius: 4, minHeight: '90vh' } }}
>
  {/* Header */}
  <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
  <Typography variant="h6" component="span" fontWeight={700}>
    إضافة عملية شراء جديدة
  </Typography>
  <Stack direction="row" spacing={2} gap={1}>
    <Button
      variant="contained"
      color="primary"
      startIcon={<Add />}
      onClick={() => setProductDialogOpen(true)}
      sx={{ textTransform: "none", borderRadius: 2 }}
    >
       صنف 
    </Button>
    <Button 
      variant="contained" 
      color="secondary"
      startIcon={<Add />}
      onClick={() => setSupplierDialogOpen(true)}
      sx={{ textTransform: "none", borderRadius: 2 }}
    >
       مورد 
    </Button>
  </Stack>
</DialogTitle>
  
  <Box sx={{ borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`, bgcolor: '#f8f9fa', px: 2, pt: 1 }}>
    <Box sx={{ display: 'flex', gap: 0.5, overflowX: 'auto', pb: 1 }}>
      <Tooltip title="فتح نافذة جديدة">
        <IconButton size="small" onClick={createNewPurchaseTab}>
          <Add fontSize="small" />
        </IconButton>
      </Tooltip>
      {purchaseTabs.map((tab) => (
        <Box
          key={tab.id}
          onClick={() => setActiveTabId(tab.id)}
          sx={{
            display: 'inline-flex', alignItems: 'center', gap: 0.5, px: 2, py: 1,
            borderRadius: '12px 12px 0 0', cursor: 'pointer',
            bgcolor: activeTabId === tab.id ? 'white' : alpha(theme.palette.grey[200], 0.6),
            color: activeTabId === tab.id ? 'primary.main' : 'text.secondary',
            borderBottom: activeTabId === tab.id ? `2px solid ${theme.palette.primary.main}` : 'none',
          }}
        >
          {tab.isEditingName ? (
            <TextField size="small" autoFocus defaultValue={tab.name}
              onBlur={(e) => saveTabName(tab.id, e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveTabName(tab.id, e.target.value)}
              onClick={(e) => e.stopPropagation()} sx={{ width: 100 }}
            />
          ) : (
            <>
              <Typography variant="body2" fontWeight={600} noWrap sx={{ maxWidth: 130 }}>{tab.name}</Typography>
              <IconButton size="small" onClick={(e) => startEditingTabName(tab.id, e)} sx={{ p: 0.5 }}>
                <Edit fontSize="inherit" sx={{ fontSize: 14 }} />
              </IconButton>
            </>
          )}
          {purchaseTabs.length > 1 && (
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); closePurchaseTab(tab.id); }} sx={{ p: 0.5 }}>
              <Close fontSize="inherit" sx={{ fontSize: 14 }} />
            </IconButton>
          )}
        </Box>
      ))}
    </Box>
  </Box>
  
  <DialogContent sx={{ p: 3, pt: 1, bgcolor: '#f8f9fa' }}>
    {/* أزرار الإضافة خارج الكارد - صف واحد */}
   

    <Grid container spacing={3}>
      {/* العمود الأيسر: البحث واختيار الأصناف */}
      <Grid size={{ xs: 12, md: 8 }}>
        {/* سطر التصفية الواحد */}
        <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #e0e0e0', mb: 2, bgcolor: 'white' }}>
  <Grid container spacing={2} alignItems="center">
    <Grid size={{ xs: 12, sm: 3 }}>
      <TextField 
        fullWidth 
        size="small" 
        label="البحث عن الصنف"
        placeholder="ابحث باسم الصنف، الكود، أو الباركود..." 
        value={currentTab.catalogSearch}
        onChange={(e) => updateCurrentTab({ catalogSearch: e.target.value })}  
        InputProps={{ 
          startAdornment: <Search sx={{ color: 'text.secondary', mr: 1 }} fontSize="small" />,
          sx: { borderRadius: 2 }
        }}
      />
    </Grid>
    <Grid size={{ xs: 12, sm: 3 }}>
      <FormControl fullWidth size="small">
        <InputLabel>القسم</InputLabel>
        <Select
          value={currentTab.catalogCategory}
          onChange={(e) => updateCurrentTab({ catalogCategory: e.target.value })}
          label="القسم"
          sx={{ borderRadius: 2 }}
        >
          <MenuItem value="all">كل الأقسام</MenuItem>
          {categories.map((c) => (
            <MenuItem key={c.id} value={String(c.id)}>{c.name}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </Grid>
    <Grid size={{ xs: 12, sm: 3 }}>
      <FormControl fullWidth size="small">
        <InputLabel>الترتيب</InputLabel>
        <Select
          value={currentTab.catalogQuickFilter}
          onChange={(e) => updateCurrentTab({ catalogQuickFilter: e.target.value })}
          label="الترتيب"
          sx={{ borderRadius: 2 }}
        >
          <MenuItem value="all">كل الأصناف</MenuItem>
          <MenuItem value="top_selling">الأكثر شراء</MenuItem>
        </Select>
      </FormControl>
    </Grid>
    <Grid size={{ xs: 12, sm: 3 }}>
      <FormControl fullWidth size="small">
        <InputLabel>المورد</InputLabel>
        <Select
          value={currentTab.selectedSupplierId || ""}
          onChange={(e) => updateCurrentTab({ selectedSupplierId: e.target.value || "" })}
          label="المورد"
          sx={{ borderRadius: 2 }}
        >
          <MenuItem value="">
            <em>-- اختر المورد --</em>
          </MenuItem>
          {suppliers.map((s) => (
            <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>
          ))}
        </Select>
      </FormControl>
    </Grid>
  </Grid>
</Paper>
      
        {/* شبكة الأصناف - مع تمييز المخزون المنتهي */}
        <Box sx={{ 
          maxHeight: 450, 
          overflowY: 'auto', 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
          gap: 2 
        }}>
          {filteredProducts.map((p) => {
            const stock = Number(p.stock ?? p.qty ?? p.quantity ?? 0);
            const isLowStock = stock <= 0;
            
            return (
              <Card 
                key={p.id} 
                sx={{ 
                  borderRadius: 3, 
                  border: '1px solid #eee',
                  bgcolor: isLowStock ? alpha(theme.palette.error.main, 0.08) : 'white',
                  borderColor: isLowStock ? theme.palette.error.main : '#eee',
                  '&:hover': { 
                    boxShadow: 4, 
                    borderColor: isLowStock ? theme.palette.error.dark : 'primary.main', 
                    transform: 'translateY(-3px)' 
                  },
                  transition: 'all 0.2s ease-in-out',
                  cursor: 'pointer',
                  position: 'relative',
                  ...(isLowStock && {
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      bgcolor: theme.palette.error.main,
                    }
                  })
                }}
                onClick={() => addProductToLines(p)}
              >
                <CardActionArea sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600}>{p.category_name}</Typography>
                  <Typography variant="body2" fontWeight={800} sx={{ my: 1, height: 35, overflow: 'hidden' }}>{p.name}</Typography>
                  <Typography 
                    variant="caption" 
                    display="block" 
                    sx={{ mb: 0.5, fontWeight: 600 }}
                    color={isLowStock ? 'error.main' : 'text.secondary'}
                  >
                    المخزون: {formatOneDecimal(stock)}
                    {isLowStock && stock === 0 && " (منتهي)"}
                    {isLowStock && stock < 0 && " (سالب)"}
                  </Typography>
                  <Typography variant="subtitle2" color="primary.main" fontWeight={900}>{formatCurrency(getProductPurchasePrice(p))}</Typography>
                </CardActionArea>
              </Card>
            );
          })}
        </Box>
      </Grid>

      {/* العمود الأيمن: السلة والدفع */}
      <Grid size={{ xs: 12, md: 4 }}>
        <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #e0e0e0', height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'white' }}>
          <Typography variant="subtitle1" fontWeight={800} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main' }}>
            <ShoppingCart /> ملخص الفاتورة - {currentTab.name}
          </Typography>

          {/* رأس الجدول */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.5, bgcolor: 'grey.100', borderRadius: 2, mb: 1 }}>
            <Typography variant="caption" fontWeight={800} sx={{ flex: 2 }}>الصنف</Typography>
            <Typography variant="caption" fontWeight={800} sx={{ flex: 0.8, textAlign: 'center' }}>الكمية</Typography>
            <Typography variant="caption" fontWeight={800} sx={{ flex: 0.95, textAlign: 'center' }}>السعر</Typography>
            <Typography variant="caption" fontWeight={800} sx={{ flex: 1, textAlign: 'left' }}>الإجمالي</Typography>
            <Box sx={{ width: 28 }} />
          </Box>

          <Box sx={{ flexGrow: 1, overflowY: 'auto', mt: 1, mb: 2 }}>
            <Stack spacing={1}>
              {currentTab.purchaseLines.map((line) => (
                <Stack 
                  key={line.lineKey} 
                  direction="row" 
                  alignItems="center" 
                  spacing={1}
                  sx={{ p: 1, borderRadius: 2, borderBottom: '1px solid #f5f5f5', '&:hover': { bgcolor: 'grey.50' } }}
                >
                  <Typography variant="body2" fontWeight={700} sx={{ flex: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {line.product_name}
                  </Typography>
                  
                  <TextField 
                    size="small" 
                    variant="outlined" 
                    type="number"
                    value={line.quantity} 
                    onChange={(e) => updateLineInCurrentTab(line.lineKey, { quantity: e.target.value })}
                    sx={{ flex: 0.8 }}
                    inputProps={{ 
                      style: { textAlign: 'center', fontSize: '0.8rem', padding: '6px 4px' },
                      min: 0,
                      step: 1
                    }}
                  />
                  
                  <TextField
                    size="small"
                    variant="outlined"
                    type="number"
                    value={line.unit_price}
                    onChange={(e) => updateLineInCurrentTab(line.lineKey, { unit_price: e.target.value })}
                    sx={{ flex: 0.95 }}
                    inputProps={{ 
                      style: { textAlign: "center", fontSize: "0.8rem", padding: '6px 4px' }, 
                      min: 0, 
                      step: 0.01 
                    }}
                  />
                  
                  <Typography variant="body2" fontWeight={800} sx={{ flex: 1, textAlign: 'left', color: 'primary.main' }}>
                    {formatCurrency(line.total_price)}
                  </Typography>
                  
                  <IconButton size="small" color="error" onClick={() => removeLineFromCurrentTab(line.lineKey)} sx={{ p: 0.5 }}>  
                    <DeleteOutline fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
            
            {currentTab.purchaseLines.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography variant="body2" color="text.secondary">
                  🛒 السلة فارغة
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  اضغط على أي صنف لإضافته
                </Typography>
              </Box>
            )}
          </Box>

          <Divider sx={{ my: 2 }} />

          <Stack spacing={2}>
            <Box>
              <Typography variant="caption" fontWeight={800} sx={{ mb: 1, display: 'block' }}>طريقة السداد:</Typography>
              <ToggleButtonGroup
                value={currentTab.paymentMethod}
                exclusive
                onChange={(e, val) => val && updateCurrentTab({ paymentMethod: val })}
                fullWidth
                sx={{ 
                  gap: 1.5,
                  '& .MuiToggleButton-root': {
                    border: '1px solid #e0e0e0 !important',
                    borderRadius: '8px !important',
                    fontWeight: 700,
                    '&.Mui-selected': {
                      bgcolor: '#e8f5e9',
                      color: '#2e7d32',
                      borderColor: '#2e7d32 !important',
                      '&:hover': { bgcolor: '#c8e6c9' }
                    }
                  }
                }}
              >
                <ToggleButton value="cash">كاش</ToggleButton>
                <ToggleButton value="app">تطبيق</ToggleButton>
                <ToggleButton value="mixed">مختلط</ToggleButton>
              </ToggleButtonGroup>
            </Box>

            <Stack direction="row" spacing={1}>
              {currentTab.paymentMethod !== 'app' && 
                <TextField 
                  fullWidth 
                  size="small" 
                  label="المبلغ نقداً" 
                  type="number" 
                  value={currentTab.cashAmount}
                  onChange={(e) => updateCurrentTab({ cashAmount: e.target.value })}
                  placeholder="اتركه فارغاً للدين"
                  InputProps={{ startAdornment: <InputAdornment position="start">₪</InputAdornment> }}
                />
              }
              {currentTab.paymentMethod !== 'cash' && 
                <TextField 
                  fullWidth 
                  size="small" 
                  label="عبر التطبيق" 
                  type="number" 
                  value={currentTab.appAmount}
                  onChange={(e) => updateCurrentTab({ appAmount: e.target.value })}
                  placeholder="اتركه فارغاً للدين"
                  InputProps={{ startAdornment: <InputAdornment position="start">₪</InputAdornment> }}
                />
              }
            </Stack>

            <Box sx={{ p: 2, bgcolor: 'grey.50', borderRadius: 3, border: '1px dashed #ccc' }}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="body2" fontWeight={600}>الإجمالي:</Typography>
                <Typography variant="h6" fontWeight={900} color="primary.main">{formatCurrency(calculateTabTotal(currentTab.purchaseLines))}</Typography>
              </Stack>
              
              {(() => {
                const paid = (Number(currentTab.cashAmount) || 0) + (Number(currentTab.appAmount) || 0);
                const remaining = calculateTabTotal(currentTab.purchaseLines) - paid;
                
                return (
                  <>
                    {paid > 0 && (
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                        <Typography variant="caption" fontWeight={600} color="success.main">المدفوع:</Typography>
                        <Typography variant="body2" fontWeight={700} color="success.main">{formatCurrency(paid)}</Typography>
                      </Stack>
                    )}
                    {remaining > 0 && (
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" fontWeight={700} color="error.main">المتبقي (دين):</Typography>
                        <Typography variant="body2" fontWeight={900} color="error.main">{formatCurrency(remaining)}</Typography>
                      </Stack>
                    )}
                    {remaining === 0 && paid > 0 && (
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="caption" fontWeight={700} color="success.main">✓ مدفوع بالكامل</Typography>
                      </Stack>
                    )}
                  </>
                );
              })()}
            </Box>
          </Stack>
        </Paper>
      </Grid>
    </Grid>
  </DialogContent>

  <DialogActions sx={{ p: 3, bgcolor: '#f1f1f1' }}>
    <Button onClick={() => setNewPurchaseOpen(false)} color="inherit">إلغاء</Button>
    <Button 
      variant="contained" 
      size="large"
      startIcon={<CheckCircle />}
      onClick={confirmCurrentTabPurchase}
      disabled={currentTab.purchaseLines.length === 0 || !currentTab.selectedSupplierId}
      sx={{ px: 8, borderRadius: 2, fontWeight: 900 }}
    >
      إتمام الشراء ({currentTab.name})
    </Button>
  </DialogActions>
</Dialog>
 

  
      {/* New Supplier Dialog */}
      <Dialog open={supplierDialogOpen} onClose={() => setSupplierDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ textAlign: "center", fontWeight: 800 }}>إضافة مورد جديد</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField fullWidth label="اسم المورد *" value={newSupplier.name} onChange={(e) => setNewSupplier({ ...newSupplier, name: e.target.value })} />
            <TextField fullWidth label="رقم الهاتف" value={newSupplier.phone} onChange={(e) => setNewSupplier({ ...newSupplier, phone: e.target.value })} />
            <TextField fullWidth label="البريد الإلكتروني" value={newSupplier.email} onChange={(e) => setNewSupplier({ ...newSupplier, email: e.target.value })} />
            <TextField fullWidth label="العنوان" multiline rows={2} value={newSupplier.address} onChange={(e) => setNewSupplier({ ...newSupplier, address: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setSupplierDialogOpen(false)} sx={{ textTransform: "none" }}>إلغاء</Button>
          <Button variant="contained" onClick={handleAddSupplier} disabled={!newSupplier.name.trim()} sx={{ textTransform: "none", fontWeight: 800 }}>حفظ المورد</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={productDialogOpen} onClose={() => setProductDialogOpen(false)} fullWidth maxWidth="sm">
  <DialogTitle sx={{ textAlign: "center", fontWeight: 800 }}>إضافة صنف جديد</DialogTitle>
  <DialogContent dividers>
    <Stack spacing={2} sx={{ pt: 1 }}>
      {productSubmitError ? (
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          {productSubmitError}
        </Alert>
      ) : null}
      
      {/* اسم الصنف */}
      <TextField
        fullWidth
        label="اسم الصنف *"
        value={newProduct.name}
        onChange={(e) => setNewProduct((prev) => ({ ...prev, name: e.target.value }))}
      />
      
      {/* القسم */}
      <TextField
        select
        fullWidth
        label="القسم *"
        value={newProduct.categoryId}
        onChange={(e) => setNewProduct((prev) => ({ ...prev, categoryId: e.target.value }))}
      >
        <MenuItem value="">
          <em>-- اختر القسم --</em>
        </MenuItem>
        {categories.map((c) => (
          <MenuItem key={c.id} value={String(c.id)}>
            {c.name}
          </MenuItem>
        ))}
      </TextField>
      
      {/* تفعيل خاصية البيع بالتجزئة */}
      <FormControlLabel
        control={
          <Switch
            checked={Boolean(newProduct.allowSplitSales)}
            onChange={(e) =>
              setNewProduct((prev) => {
                const on = e.target.checked;
                const nextName =
                  on && !String(prev.fullUnitName || "").trim() ? "علبة" : prev.fullUnitName;
                return {
                  ...prev,
                  allowSplitSales: on,
                  fullUnitName: nextName,
                };
              })
            }
          />
        }
        label="هذا الصنف يُباع بأجزاء (تجزئة)"
      />

      {/* وحدة الشراء من المورد */}
      <TextField
        fullWidth
        label="وحدة الشراء من المورد (الوحدة الكاملة)"
        value={newProduct.fullUnitName || ""}
        onChange={(e) => setNewProduct((prev) => ({ 
          ...prev, 
          fullUnitName: e.target.value 
        }))}
        placeholder="علبة"
        helperText="في الصيدلية عادةً تشتري «علبة» من المورد — لا تكتب «شريطين» هنا؛ الشريط يُضبط بعدد القطع / التقسيم لاحقاً."
      />

      {/* تفاصيل التجزئة (تظهر فقط إذا فعّل المستخدم التجزئة) */}
      {newProduct.allowSplitSales && (
        <>
          <Alert severity="info" sx={{ fontSize: '0.75rem' }}>
            💡 <strong>نظام التجزئة:</strong><br />
            • الوحدة الكاملة = {newProduct.fullUnitName || "المنتج كاملاً"}<br />
            • يمكن البيع: نصف، ثلث، ربع، أو حسب الأجزاء التي تحددها
          </Alert>

          {/* عدد الأجزاء المتساوية التي يمكن تقسيم الوحدة الكاملة إليها */}
          <TextField
            fullWidth
            type="number"
            label="كم جزء متساوٍ تريد تقسيم الوحدة الكاملة؟"
            value={newProduct.divideInto || ""}
            onChange={(e) => setNewProduct((prev) => ({ 
              ...prev, 
              divideInto: e.target.value 
            }))}
            placeholder="مثال: 2 (نصف)، 3 (ثلث)، 4 (ربع)"
            helperText="مثال: 2 = نصف، 3 = ثلث، 4 = ربع"
            inputProps={{ min: 2, step: 1 }}
          />

          {/* هل تريد بيع وحدات أصغر (مثل الحبات)؟ */}
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(newProduct.allowSmallPieces)}
                onChange={(e) => setNewProduct((prev) => ({ 
                  ...prev, 
                  allowSmallPieces: e.target.checked 
                }))}
              />
            }
            label="أريد بيع وحدات أصغر داخل الجزء (مثل: حبة من الشريط)"
          />

          {newProduct.allowSmallPieces && (
            <TextField
              fullWidth
              type="number"
              label="الوحدة الكاملة تتكون من كم قطعة صغيرة؟"
              value={newProduct.piecesCount || ""}
              onChange={(e) => setNewProduct((prev) => ({ 
                ...prev, 
                piecesCount: e.target.value 
              }))}
              placeholder="مثال: شريط فيه 9 حبات ← أدخل 9"
              helperText="هذا يسمح ببيع الحبة بمفردها"
              inputProps={{ min: 2, step: 1 }}
            />
          )}

          {/* شرح مبسط للحسبة */}
          <Paper sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
            <Typography variant="caption" fontWeight={600} display="block" gutterBottom>
              🧮 كيف ستحسب الأسعار تلقائياً:
            </Typography>
            <Typography variant="caption" display="block" color="text.secondary">
              • سعر شراء الوحدة الكاملة = المدخل أثناء الشراء<br />
              • سعر بيع الجزء = سعر الوحدة الكاملة ÷ عدد الأجزاء<br />
              • سعر بيع القطعة الصغيرة = سعر الجزء ÷ عدد القطع فيه
            </Typography>
          </Paper>
        </>
      )}

      <Alert severity="info" sx={{ mt: 1 }}>
        ✅ <strong>ملاحظة:</strong> سعر الشراء سيتم إضافته من خلال سلة الشراء،<br />
        وسعر الببيع سيتم حسابه تلقائياً حسب الأجزاء التي تبيعها.
      </Alert>
    </Stack>
  </DialogContent>
  <DialogActions sx={{ px: 3, py: 2 }}>
    <Button onClick={() => setProductDialogOpen(false)} sx={{ textTransform: "none" }}>
      إلغاء
    </Button>
    <Button
      variant="contained"
      onClick={handleAddProductInline}
      disabled={productSubmitting || !String(newProduct.name || "").trim() || !String(newProduct.categoryId || "").trim()}
      sx={{ textTransform: "none", fontWeight: 800 }}
    >
      {productSubmitting ? "جاري الحفظ..." : "حفظ الصنف"}
    </Button>
  </DialogActions>
</Dialog>

      {/* Detail Dialog */}
      <Dialog open={Boolean(detailPurchase)} onClose={() => setDetailPurchase(null)} fullWidth maxWidth="md">
        <DialogTitle sx={{ textAlign: "center", fontWeight: 900 }}>فاتورة شراء — {detailPurchase?.invoice_number || detailPurchase?.id}</DialogTitle>
        <DialogContent sx={{ textAlign: "right" }}>
          <Card variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 2 }}>
            <Box sx={{ textAlign: "center", borderBottom: `2px solid ${alpha(theme.palette.text.primary, 0.22)}`, pb: 1, mb: 1.2 }}>
              <Typography variant="h6" fontWeight={900}>فاتورة شراء</Typography>
              <Typography variant="body2" color="text.secondary">رقم الفاتورة: {detailPurchase?.invoice_number || detailPurchase?.id}</Typography>
            </Box>
            <Stack sx={{ gap: 0.7 }}>
              <Typography variant="body2">المورد: <strong>{detailPurchase?.supplier?.name || "مورد عام"}</strong></Typography>
              <Typography variant="body2">التاريخ: <strong>{detailPurchase?.purchase_date ? new Date(detailPurchase.purchase_date).toLocaleString("ar-SA") : "-"}</strong></Typography>
              <Typography variant="body2">طريقة الدفع: <strong>{detailPurchase?.payment_method === "cash" ? "كاش" : detailPurchase?.payment_method === "app" ? "تطبيق" : detailPurchase?.payment_method === "mixed" ? "مختلط" : detailPurchase?.payment_method || "-"}</strong></Typography>
              <Typography variant="body2">الحالة: <strong>{detailPurchase?.status === "completed" ? "مدفوع" : detailPurchase?.status === "partially_paid" ? "جزئي" : detailPurchase?.status === "pending" ? "معلق" : detailPurchase?.status === "returned" ? "مرجع" : detailPurchase?.status}</strong></Typography>
            </Stack>
          </Card>
          <TableContainer component={Card} variant="outlined" sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>#</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>الصنف</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>الكمية</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>السعر</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800 }}>الإجمالي</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(detailPurchase?.items || [])
                  .filter((item) => Math.max(0, Number(item.quantity || 0) - Number(item.returned_quantity || 0)) > 0)
                  .map((item, i) => (
                  <TableRow key={i}>
                    <TableCell align="center">{i + 1}</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>{item.product_name || item.name || "-"}</TableCell>
                    <TableCell align="center">
                      {formatOneDecimal(Math.max(0, Number(item.quantity || item.qty || 0) - Number(item.returned_quantity || 0)))}
                    </TableCell>
                    <TableCell align="center">{formatCurrency(item.unit_price || 0)} شيكل</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>
                      {formatCurrency(
                        (Math.max(0, Number(item.quantity || 0) - Number(item.returned_quantity || 0)) * Number(item.unit_price || 0))
                      )} شيكل
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack sx={{ mt: 2, alignItems: "flex-end", gap: 0.25 }}>
            <Typography variant="body2">المدفوع: <strong>{formatCurrency(detailPurchase?.paid_amount || 0)} شيكل</strong></Typography>
            <Typography variant="body2" color={(detailPurchase?.remaining_amount || 0) > 0 ? "warning.main" : "success.main"}>
              المتبقي: <strong>{formatCurrency(detailPurchase?.remaining_amount || 0)} شيكل</strong>
            </Typography>
            <Typography variant="subtitle1" fontWeight={900}>الإجمالي: {formatCurrency(detailPurchase?.total_amount || 0)} شيكل</Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
          <Button onClick={() => setDetailPurchase(null)} sx={{ textTransform: "none" }}>إغلاق</Button>
          <Button variant="outlined" color="warning" onClick={() => openReturnItemsDialog(detailPurchase)} sx={{ textTransform: "none" }}>إرجاع صنف/كمية</Button>
          <Button variant="outlined" color="error" onClick={() => { setFullReturnConfirm({ open: true, purchase: detailPurchase }); setDetailPurchase(null); }} sx={{ textTransform: "none" }}>إرجاع الفاتورة كاملة</Button>
        </DialogActions>
      </Dialog>

      {/* Payment Dialog for Supplier Debt */}
      <Dialog open={paymentDialogOpen} onClose={() => setPaymentDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ textAlign: "center", fontWeight: 800 }}>تسديد دين المورد</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>
            المورد: <strong>{supplierStats?.supplierName}</strong><br />
            إجمالي الدين: <strong>{formatCurrency(supplierStats?.remainingAmount)} شيكل</strong>
          </Alert>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField 
              fullWidth 
              label="إجمالي مبلغ التسديد (شيكل)" 
              type="number" 
              value={paymentAmount} 
              onChange={(e) => {
                const val = e.target.value;
                setPaymentAmount(val);
                // Auto-fill based on payment method
                if (paymentMethodDialog === 'cash') {
                  setCashAmountDialog(val);
                  setAppAmountDialog("");
                } else if (paymentMethodDialog === 'app') {
                  setAppAmountDialog(val);
                  setCashAmountDialog("");
                }
              }} 
              inputProps={{ min: 0.01, step: 0.01, max: supplierStats?.remainingAmount }}
              helperText={`الحد الأقصى: ${formatCurrency(supplierStats?.remainingAmount)} شيكل`}
            />
            <TextField 
              select 
              fullWidth 
              label="طريقة الدفع" 
              value={paymentMethodDialog} 
              onChange={(e) => {
                const method = e.target.value;
                setPaymentMethodDialog(method);
                // Reset amounts when changing method
                if (method === 'cash') {
                  setCashAmountDialog(paymentAmount);
                  setAppAmountDialog("");
                } else if (method === 'app') {
                  setAppAmountDialog(paymentAmount);
                  setCashAmountDialog("");
                } else if (method === 'mixed') {
                  // Split equally by default
                  const half = paymentAmount ? (Number(paymentAmount) / 2).toFixed(2) : "";
                  setCashAmountDialog(half);
                  setAppAmountDialog(half);
                }
              }}
              SelectProps={{ native: true }}
            >
              <option value="cash">كاش</option>
              <option value="app">تطبيق</option>
              <option value="mixed">مختلط (كاش + تطبيق)</option>
            </TextField>
            
            {/* Mixed payment inputs */}
            {paymentMethodDialog === 'mixed' && (
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="مبلغ الكاش"
                    type="number"
                    value={cashAmountDialog}
                    onChange={(e) => setCashAmountDialog(e.target.value)}
                    inputProps={{ min: 0, step: 0.01 }}
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="مبلغ التطبيق"
                    type="number"
                    value={appAmountDialog}
                    onChange={(e) => setAppAmountDialog(e.target.value)}
                    inputProps={{ min: 0, step: 0.01 }}
                  />
                </Grid>
              </Grid>
            )}
            
            {paymentMethodDialog === 'mixed' && (
              <Alert severity={Number(cashAmountDialog) + Number(appAmountDialog) === Number(paymentAmount) ? "success" : "warning"}>
                المجموع: {formatCurrency(Number(cashAmountDialog) + Number(appAmountDialog))} / {formatCurrency(Number(paymentAmount))} شيكل
              </Alert>
            )}
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setPaymentDialogOpen(false)} sx={{ textTransform: "none" }}>إلغاء</Button>
          <Button 
            variant="contained" 
            onClick={handleSupplierPayment} 
            disabled={!paymentAmount || Number(paymentAmount) <= 0 || Number(paymentAmount) > (supplierStats?.remainingAmount || 0)}
            sx={{ textTransform: "none", fontWeight: 800 }}
          >
            تسديد
          </Button>
        </DialogActions>
      </Dialog>

      {/* Treasury Init Dialog */}
      <Dialog open={initTreasuryDialogOpen} onClose={() => setInitTreasuryDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ textAlign: "center", fontWeight: 800 }}>إنشاء الخزنة وإضافة رصيد</DialogTitle>
        <DialogContent dividers>
          <Alert severity="info" sx={{ mb: 2 }}>أنشئ الخزنة وأضف رصيداً افتتاحياً للسماح بإجراء المشتريات</Alert>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField fullWidth label="اسم الخزنة" value={initialTreasuryData.name} onChange={(e) => setInitialTreasuryData({ ...initialTreasuryData, name: e.target.value })} />
            <TextField fullWidth label="الرصيد الافتتاحي (شيكل)" type="number" value={initialTreasuryData.initial_balance} onChange={(e) => setInitialTreasuryData({ ...initialTreasuryData, initial_balance: e.target.value })} inputProps={{ min: 0, step: 0.01 }} helperText="أدخل مبلغاً كافياً لتغطية المشتريات المتوقعة" />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setInitTreasuryDialogOpen(false)} sx={{ textTransform: "none" }}>إلغاء</Button>
          <Button variant="contained" onClick={handleInitTreasury} disabled={!initialTreasuryData.initial_balance || Number(initialTreasuryData.initial_balance) <= 0} sx={{ textTransform: "none", fontWeight: 800 }}>إنشاء الخزنة</Button>
        </DialogActions>
      </Dialog>

      {/* Return Items Dialog */}
      <Dialog open={returnItemsDialog.open} onClose={() => setReturnItemsDialog({ open: false, purchase: null, items: [] })} fullWidth maxWidth="md">
        <DialogTitle sx={{ textAlign: "center", fontWeight: 800 }}>إرجاع أصناف من فاتورة: {returnItemsDialog.purchase?.invoice_number}</DialogTitle>
        <DialogContent dividers>
          <Alert severity="warning" sx={{ mb: 2 }}>اختر الأصناف والكميات التي تريد إرجاعها</Alert>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell align="center">الصنف</TableCell>
                  <TableCell align="center">الكمية المشتراة</TableCell>
                  <TableCell align="center">الكمية المراد إرجاعها</TableCell>
                  <TableCell align="center">سعر الوحدة</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(returnItemsDialog.purchase?.items || []).map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell align="center">{item.product?.name || item.product_name || item.name || "-"}</TableCell>
                    <TableCell align="center">{item.quantity}</TableCell>
                    <TableCell align="center">
                      <TextField
                        type="number"
                        size="small"
                        value={returnItemsDialog.items[idx]?.returnQty || ""}
                        onChange={(e) => {
                          const maxQty = Math.max(0, Number(item.quantity || 0) - Number(item.returned_quantity || 0));
                          const val = Math.min(Number(e.target.value), maxQty);
                          const newItems = [...returnItemsDialog.items];
                          newItems[idx] = { ...item, returnQty: val > 0 ? val : "" };
                          setReturnItemsDialog(prev => ({ ...prev, items: newItems }));
                        }}
                        inputProps={{ min: 0, max: Math.max(0, Number(item.quantity || 0) - Number(item.returned_quantity || 0)), step: 1 }}
                        placeholder="0"
                        sx={{ width: 100 }}
                      />
                    </TableCell>
                    <TableCell align="center">{formatCurrency(item.unit_price)} شيكل</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ mt: 2, p: 2, bgcolor: alpha(theme.palette.warning.main, 0.1), borderRadius: 1 }}>
            <Typography variant="subtitle2">
              إجمالي المبلغ المسترجع: <strong>{formatCurrency(
                returnItemsDialog.items.reduce((sum, item) => sum + (item.returnQty || 0) * (item.unit_price || 0), 0)
              )} شيكل</strong>
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setReturnItemsDialog({ open: false, purchase: null, items: [] })} sx={{ textTransform: "none" }}>إلغاء</Button>
          <Button 
            variant="contained" 
            color="warning"
            onClick={handleReturnItems}
            disabled={!returnItemsDialog.items.some(i => i.returnQty > 0)}
            sx={{ textTransform: "none", fontWeight: 800 }}
          >
            تأكيد الإرجاع
          </Button>
        </DialogActions>
      </Dialog>

      {/* Full Return Confirmation Dialog */}
      <Dialog open={fullReturnConfirm.open} onClose={() => setFullReturnConfirm({ open: false, purchase: null })} fullWidth maxWidth="sm">
        <DialogTitle sx={{ textAlign: "center", fontWeight: 800, color: "error.main" }}>تأكيد إرجاع الفاتورة كاملة</DialogTitle>
        <DialogContent dividers>
          <Alert severity="error" sx={{ mb: 2 }}>هل أنت متأكد من إرجاع الفاتورة بالكامل؟ لا يمكن التراجع عن هذا الإجراء.</Alert>
          <Box sx={{ p: 2, bgcolor: alpha(theme.palette.error.main, 0.05), borderRadius: 1 }}>
            <Typography variant="body2"><strong>رقم الفاتورة:</strong> {fullReturnConfirm.purchase?.invoice_number}</Typography>
            <Typography variant="body2"><strong>المورد:</strong> {fullReturnConfirm.purchase?.supplier?.name || "مورد عام"}</Typography>
            <Typography variant="body2"><strong>الإجمالي:</strong> {formatCurrency(fullReturnConfirm.purchase?.total_amount)} شيكل</Typography>
            <Typography variant="body2"><strong>تاريخ الشراء:</strong> {fullReturnConfirm.purchase?.purchase_date ? new Date(fullReturnConfirm.purchase.purchase_date).toLocaleDateString('ar-SA') : '-'}</Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setFullReturnConfirm({ open: false, purchase: null })} sx={{ textTransform: "none" }}>إلغاء</Button>
          <Button variant="contained" color="error" onClick={handleFullReturn} sx={{ textTransform: "none", fontWeight: 800 }}>
            تأكيد إرجاع الفاتورة
          </Button>
        </DialogActions>
      </Dialog>
    </AdminLayout>
  );
}
