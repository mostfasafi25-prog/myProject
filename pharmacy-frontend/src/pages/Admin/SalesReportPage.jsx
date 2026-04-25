import {
  Add,
  Assessment,
  Close,
  Print,
  ReceiptLong,
  Replay,
  ShoppingCart,
  TrendingUp,
  Search,
  Person,
  Payments,
  RestartAlt,
  Inventory,
  Visibility,
  FilterList,
  Category,
  CreditScore,
  TrendingDown,
  AccountBalanceWallet,
  CheckCircle, // أيقونة جديدة للأصناف
} from "@mui/icons-material";
import {
  Alert,
  alpha,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  MenuItem,
  Pagination,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useTheme,
  InputAdornment,
  Tooltip,
  Avatar,
  Menu,
  CardContent, // لقائمة الأصناف
} from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Axios } from "../../Api/Axios";
import { adminPageContainerSx, adminPageSubtitleSx } from "../../utils/adminPageLayout";
import AdminLayout from "./AdminLayout";

const ROWS_PER_PAGE = 10;

function fmt(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return "0.0";
  return x.toFixed(1);
}

// حساب إحصائيات الصنف المبحوث عنه (مستخدم للإحصائيات العلوية)
function getProductStats(orders, searchTerm) {
  if (!searchTerm || searchTerm.trim() === "") {
    return null;
  }
  
  const term = searchTerm.trim().toLowerCase();
  let totalQuantity = 0;
  let totalRevenue = 0;
  let totalProfit = 0;
  let invoicesCount = 0;
  
  orders.forEach(order => {
    let hasProduct = false;
    let orderProductQuantity = 0;
    let orderProductRevenue = 0;
    let orderProductProfit = 0;
    
    if (Array.isArray(order.items)) {
      order.items.forEach(item => {
        const itemName = String(item.name || "").toLowerCase();
        if (itemName.includes(term)) {
          hasProduct = true;
          const qty = Number(item.qty || 0);
          const revenue = Number(item.total || 0);
          const profit = Number(item.profit || 0);
          
          orderProductQuantity += qty;
          orderProductRevenue += revenue;
          orderProductProfit += profit;
        }
      });
    }
    
    if (hasProduct) {
      invoicesCount++;
      totalQuantity += orderProductQuantity;
      totalRevenue += orderProductRevenue;
      totalProfit += orderProductProfit;
    }
  });
  
  return {
    quantity: totalQuantity,
    revenue: totalRevenue,
    profit: totalProfit,
    invoicesCount: invoicesCount,
    averagePrice: totalQuantity > 0 ? totalRevenue / totalQuantity : 0
  };
}

// دالة للحصول على أصناف الفاتورة التي تطابق البحث
function getMatchingItems(order, searchTerm) {
  if (!searchTerm || !Array.isArray(order.items)) return [];
  const term = searchTerm.trim().toLowerCase();
  return order.items.filter(item => 
    String(item.name || "").toLowerCase().includes(term)
  );
}

// ✅ دالة جديدة: تحويل قائمة الفواتير إلى قائمة مبيعات مفصلة لكل صنف
// هذا يحول البيانات من "فاتورة تحتوي أصناف" إلى "صف لكل صنف مباع مع تفاصيل الفاتورة"
function getProductSalesDetails(orders, productName) {
  if (!productName || productName.trim() === "") return [];
  
  const term = productName.trim().toLowerCase();
  const salesDetails = [];
  
  orders.forEach(order => {
    // نتخطى الفواتير الملغاة أو المرتجعة
    if (order.status === "cancelled" || order.status === "returned") return;
    
    if (Array.isArray(order.items)) {
      order.items.forEach(item => {
        const itemName = String(item.name || "").toLowerCase();
        if (itemName.includes(term)) {
          // لكل صنف مباع نضيف سجل تفصيلي
          salesDetails.push({
            id: `${order.id}_${Date.now()}_${Math.random()}`, // id فريد للصف
            invoiceNumber: order.orderNumber,
            invoiceId: order.id,
            productName: item.name,
            quantity: Number(item.qty || 0),
            price: Number(item.price || 0), // سعر الوحدة
            total: Number(item.total || 0),
            profit: Number(item.profit || 0),
            soldAt: order.soldAt,
            cashier: order.soldBy,
            customerName: order.customerName || "زبون نقدي",
            paymentMethod: order.paymentMethod,
            status: order.status,
          });
        }
      });
    }
  });
  
  // ترتيب حسب التاريخ الأحدث أولاً
  return salesDetails.sort((a, b) => new Date(b.soldAt || 0).getTime() - new Date(a.soldAt || 0).getTime());
}

function paymentLabel(m) {
  if (m === "app") return "تطبيق";
  if (m === "credit") return "آجل";
  if (m === "mixed") return "مختلط";
  return "كاش";
}

function mapCreditCustomerFromApi(row) {
  const rawBalance = Number(row?.balance ?? NaN);
  const rawDue = Number(row?.total_due ?? row?.debt_amount ?? 0);
  const rawCredit = Number(row?.available_credit ?? row?.credit_amount ?? 0);
  const balance = Number.isFinite(rawBalance) ? rawBalance : rawDue - rawCredit;
  return {
    id: row.customer_id || row.id || row.key || row.name,
    rowKey: row.key || row.customer_id || row.id || row.name,
    customerId: row.customer_id || row.id || null,
    name: row.name || "—",
    phone: row.phone || "",
    creditLimit: Number(row.credit_limit || 0),
    balance,
    totalPaid: Number(row.total_paid || 0),
    totalSales: Number(row.total_sales || 0),
    invoicesCount: Number(row.invoices_count || 0),
    availableCredit: Number.isFinite(rawCredit) ? rawCredit : Math.max(0, -balance),
    totalDue: Number.isFinite(rawDue) ? rawDue : Math.max(0, balance),
    notes: row.notes || "", // ✅ أضف هذا السطر إذا لم يكن موجوداً

  };
}

function statusLabel(s) {
  if (s === "paid") return "مدفوع";
  if (s === "partially_paid") return "جزئي";
  if (s === "pending") return "معلق";
  if (s === "cancelled") return "ملغى";
  if (s === "returned") return "مرجع";
  return s || "—";
}

function statusColor(s) {
  if (s === "paid") return "success";
  if (s === "partially_paid") return "warning";
  if (s === "pending") return "info";
  if (s === "cancelled" || s === "returned") return "error";
  return "default";
}

async function fetchAllOrdersApi(http) {
  const all = [];
  let page = 1;
  let lastPage = 1;
  for (let g = 0; g < 40; g += 1) {
    const { data } = await http.get("orders", { params: { per_page: 100, page } });
    if (!data?.success || !Array.isArray(data.data?.orders)) break;
    all.push(...data.data.orders);
    lastPage = Number(data.data?.pagination?.last_page || 1);
    if (page >= lastPage) break;
    page += 1;
  }
  return all;
}

async function fetchOrderItems(http, orderId) {
  const { data } = await http.get(`orders/${orderId}`);
  if (!data?.success) return [];
  const order = data.data;
  const items = Array.isArray(order.items) ? order.items : [];
  return items.map((it) => ({
    orderItemId: it.id,
    name: it.item_name || it.name || "—",
    qty: Number(it.quantity ?? it.qty ?? 0),
    price: Number(it.unit_price ?? it.price ?? 0),
    cost: Number(it.unit_cost ?? 0),
    total: Number(it.total_price ?? it.total ?? 0),
    profit: Number(it.item_profit ?? 0),
  }));
}

async function fetchAllOrdersWithItems(http) {
  const allOrders = [];
  let page = 1;
  let lastPage = 1;
  
  for (let g = 0; g < 40; g += 1) {
    const { data } = await http.get("orders", { params: { per_page: 100, page } });
    if (!data?.success || !Array.isArray(data.data?.orders)) break;
    
    for (const order of data.data.orders) {
      const inlineItems = Array.isArray(order?.items)
        ? order.items.map((it) => ({
            orderItemId: it.id,
            name: it.name || it.product_name || "—",
            qty: Number(it.quantity ?? 0),
            price: Number(it.unit_price ?? 0),
            cost: Number(it.unit_cost ?? 0),
            total: Number(it.total_price ?? 0),
            profit: Number(it.item_profit ?? 0),
          }))
        : [];
      const items = inlineItems.length ? inlineItems : await fetchOrderItems(http, order.id);
      allOrders.push({
        ...mapOrder(order),
        items: items,
        itemsLoaded: true
      });
    }
    
    lastPage = Number(data.data?.pagination?.last_page || 1);
    if (page >= lastPage) break;
    page += 1;
  }
  return allOrders;
}

async function fetchAllUsers(http) {
  try {
    const { data } = await http.get("users");
    if (data?.success && Array.isArray(data.data)) {
      return data.data.map(user => ({
        id: user.id,
        name: user.name || user.username || `User ${user.id}`,
        username: user.username,
        role: user.role
      }));
    }
    return [];
  } catch (error) {
    console.warn("Failed to fetch users:", error);
    return [];
  }
}

function mapOrder(o) {
  return {
    id: o.id,
    orderNumber: o.order_number || `ORD-${o.id}`,
    soldAt: o.created_at,
    soldBy: o.created_by_name || o.created_by || "—",
    customerId: o.customer_id,
    customerName: o.customer_name || o.customer?.name || null,
    paymentMethod: o.payment_method || "cash",
    status: o.status || "paid",
    subtotal: Number(o.subtotal ?? 0),
    discount: Number(o.discount ?? 0),
    total: Number(o.total ?? 0),
    paidAmount: Number(o.paid_amount ?? 0),
    dueAmount: Number(o.due_amount ?? 0),
    totalProfit: Number(o.total_profit ?? 0),
    notes: String(o.notes || ""),
    items: [],
    itemsLoaded: false,
  };
}

const dialogPaperSx = { borderRadius: 3, overflow: "hidden" };
const dialogTitleSx = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 48,
  px: { xs: 1, sm: 2 },
  pt: { xs: 2, md: 2.5 },
  pb: 1.25,
  borderBottom: "1px solid",
  borderColor: "divider",
};
const dialogCloseBtnSx = {
  position: "absolute",
  insetInlineStart: 8,
  top: "50%",
  transform: "translateY(-50%)",
};

export default function SalesReportPage({ mode, onToggleMode }) {
  const theme = useTheme();
  const printRef = useRef(null);

  // --- State variables for filters and data ---
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");// أضف هذه الـ state مع بقية الـ states (حوالي سطر 200)
  const [movementDetailsOpen, setMovementDetailsOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState(null);
  const [movementOrderDetails, setMovementOrderDetails] = useState(null);
  const [movementDetailsLoading, setMovementDetailsLoading] = useState(false);
  const [toDate, setToDate] = useState("");
  const [newCreditLimit, setNewCreditLimit] = useState("");
const [newCreditNotes, setNewCreditNotes] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [cashierFilter, setCashierFilter] = useState("all");
  const [creditCustomerFilter, setCreditCustomerFilter] = useState("all");
  const [selectedLedger, setSelectedLedger] = useState([]);

  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailOrder, setDetailOrder] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [printOrder, setPrintOrder] = useState(null);
  const [dataTick, setDataTick] = useState(0);
  
  // ✅ حالات جديدة لعرض الأصناف
  const [productMenuAnchor, setProductMenuAnchor] = useState(null);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [selectedProductForSearch, setSelectedProductForSearch] = useState(null);
  const [productSalesDetails, setProductSalesDetails] = useState([]);
  const [productSearchInput, setProductSearchInput] = useState("");
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [creditCustomers, setCreditCustomers] = useState([]);
  const [creditBackendLoading, setCreditBackendLoading] = useState(false);
  const [creditMovements, setCreditMovements] = useState([]);
  const [creditMovementsLoading, setCreditMovementsLoading] = useState(false);
  const [creditSearch, setCreditSearch] = useState("");
  const [newCreditName, setNewCreditName] = useState("");
  const [newCreditPhone, setNewCreditPhone] = useState("");
  const [creatingCreditCustomer, setCreatingCreditCustomer] = useState(false);

  const [returnDialog, setReturnDialog] = useState({
    open: false,
    order: null,
    mode: "partial",
    reason: "",
    qtyById: {},
  });
  // أضف هذه الدالة بعد الـ states
const openMovementDetails = async (movement) => {
  // إذا كانت الحركة من نوع بيع (sale) ولها reference_order_id
  if ((movement.type === 'sale' || movement.movement_type === 'credit_sale') && movement.reference_order_id) {
    setSelectedMovement(movement);
    setMovementDetailsOpen(true);
    setMovementDetailsLoading(true);
    
    try {
      // جلب تفاصيل الفاتورة من API
      const { data } = await Axios.get(`orders/${movement.reference_order_id}`);
      if (data?.success) {
        setMovementOrderDetails(data.data);
      } else {
        setMovementOrderDetails(null);
      }
    } catch (error) {
      console.error("Error fetching order details:", error);
      setMovementOrderDetails(null);
    } finally {
      setMovementDetailsLoading(false);
    }
  } else {
    // إذا كانت الحركة تسديد، يمكن عرض رسالة أو لا تفعل شيء
    alert("هذه الحركة هي عملية تسديد، لا توجد فاتورة مرتبطة");
  }
};

const closeMovementDetails = () => {
  setMovementDetailsOpen(false);
  setSelectedMovement(null);
  setMovementOrderDetails(null);
};
  // ✅ قائمة فريدة بكل الأصناف من أجل البحث (يتم استخراجها من الأوردرات)
  const allUniqueProducts = useMemo(() => {
    const productsSet = new Set();
    orders.forEach(order => {
      if (Array.isArray(order.items)) {
        order.items.forEach(item => {
          if (item.name && item.name.trim() !== "") {
            productsSet.add(item.name);
          }
        });
      }
    });
    return Array.from(productsSet).sort();
  }, [orders]);

  // ✅ عرض مبيعات الصنف المختار
  const handleProductSelect = (productName) => {
    if (!productName) return;
    const details = getProductSalesDetails(orders, productName);
    setProductSalesDetails(details);
    setSelectedProductForSearch(productName);
    setProductDialogOpen(true);
    setProductMenuAnchor(null);
  };

  const closeProductDialog = () => {
    setProductDialogOpen(false);
    setSelectedProductForSearch(null);
    setProductSalesDetails([]);
    setProductSearchInput("");
  };

  const openCreditDialog = useCallback(() => {
    setCreditDialogOpen(true);
  }, []);

  // إحصائيات الصنف (للتبويب العلوي في وضع البحث العادي)
  const productStats = useMemo(() => {
    if (search && search.trim() !== "") {
      return getProductStats(orders, search);
    }
    return null;
  }, [search, orders]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [ordersData, usersData] = await Promise.all([
          fetchAllOrdersWithItems(Axios),
          fetchAllUsers(Axios)
        ]);
        if (!cancelled) {
          setOrders(ordersData);
          setUsers(usersData);
        }
      } catch (e) {
        console.warn("[SalesReportPage] load", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [dataTick]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCreditBackendLoading(true);
      try {
        const { data } = await Axios.get("orders/credit-customers");
        if (!cancelled && data?.success && Array.isArray(data?.data)) {
          const mapped = data.data.map(mapCreditCustomerFromApi);
          setCreditCustomers(mapped);
        }
      } catch {
        // fallback
      } finally {
        if (!cancelled) setCreditBackendLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dataTick]);

  const openDetail = useCallback(async (row) => {
    if (row.itemsLoaded) { setDetailOrder(row); return; }
    setDetailLoading(true);
    setDetailOrder({ ...row, items: [], itemsLoaded: false });
    try {
      const items = await fetchOrderItems(Axios, row.id);
      const updated = { ...row, items, itemsLoaded: true };
      setOrders((prev) => prev.map((o) => o.id === row.id ? updated : o));
      setDetailOrder(updated);
    } catch {
      setDetailOrder({ ...row, items: [], itemsLoaded: true });
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // فلترة الأوردرات في الوضع العادي (عرض الفواتير)
  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders
      .filter((o) => {
        let matchSearch = !q;
        if (!matchSearch && q) {
          matchSearch =
            String(o.orderNumber).toLowerCase().includes(q) ||
            String(o.soldBy).toLowerCase().includes(q) ||
            String(o.customerName || "").toLowerCase().includes(q) ||
            String(o.id).includes(q) ||
            statusLabel(o.status).includes(q) ||
            paymentLabel(o.paymentMethod).toLowerCase().includes(q);
          
          if (!matchSearch && Array.isArray(o.items) && o.items.length > 0) {
            matchSearch = o.items.some(item => 
              String(item.name || "").toLowerCase().includes(q)
            );
          }
        }
        
        const matchPay = paymentFilter === "all" || o.paymentMethod === paymentFilter;
        const matchStatus = statusFilter === "all" || o.status === statusFilter;
        const matchCashier = cashierFilter === "all" || String(o.soldBy) === cashierFilter;
        const selectedCreditCustomer = creditCustomers.find((c) => String(c.id) === String(creditCustomerFilter));
        const orderCustomerName = String(o.customerName || "").trim();
        const matchCreditCustomer =
          creditCustomerFilter === "all" ||
          (selectedCreditCustomer &&
            orderCustomerName &&
            orderCustomerName.toLowerCase() === String(selectedCreditCustomer.name || "").trim().toLowerCase());
        const rowMs = new Date(o.soldAt || 0).getTime();
        const fromMs = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : 0;
        const toMs = toDate ? new Date(`${toDate}T23:59:59`).getTime() : 0;
        const matchRange = (!fromMs || rowMs >= fromMs) && (!toMs || rowMs <= toMs);
        
        return matchSearch && matchPay && matchStatus && matchCashier && matchCreditCustomer && matchRange;
      })
      .sort((a, b) => new Date(b.soldAt || 0).getTime() - new Date(a.soldAt || 0).getTime());
  }, [orders, search, fromDate, toDate, paymentFilter, statusFilter, cashierFilter, creditCustomerFilter, creditCustomers]);

  // إحصائيات عامة للفواتير (غير الأصناف)
  const stats = useMemo(() => {
    const active = filteredOrders.filter((o) => o.status !== "cancelled" && o.status !== "returned");
    const total = active.reduce((s, o) => s + o.total, 0);
    const profit = active.reduce((s, o) => s + o.totalProfit, 0);
    const customers = new Set(active.filter((o) => o.customerId).map((o) => o.customerId));
    return { count: active.length, total, profit, customers: customers.size };
  }, [filteredOrders]);

  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const pageRows = useMemo(() => {
    const start = (safePage - 1) * ROWS_PER_PAGE;
    return filteredOrders.slice(start, start + ROWS_PER_PAGE);
  }, [filteredOrders, safePage]);

  useEffect(() => {
    if (!printOrder) return;
    const t = window.setTimeout(() => window.print(), 200);
    const done = () => setPrintOrder(null);
    window.addEventListener("afterprint", done);
    return () => { window.clearTimeout(t); window.removeEventListener("afterprint", done); };
  }, [printOrder]);

  const resetFilters = () => {
    setSearch("");
    setFromDate("");
    setToDate("");
    setPaymentFilter("all");
    setStatusFilter("all");
    setCashierFilter("all");
    setCreditCustomerFilter("all");
    setPage(1);
  };

  const selectedCreditCustomerObj = useMemo(
    () => {
        const customer = creditCustomers.find((c) => String(c.id) === String(creditCustomerFilter)) || null;
        if (customer) {
            return {
                ...customer,
                total_due: customer.balance > 0 ? customer.balance : 0,
                available_credit: customer.availableCredit || 0,
                balance: customer.balance || 0
            };
        }
        return null;
    },
    [creditCustomers, creditCustomerFilter]
);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const customerId = selectedCreditCustomerObj?.customerId || selectedCreditCustomerObj?.id;
      if (!customerId) {
        setSelectedLedger([]);
        return;
      }
      
      try {
        const { data } = await Axios.get(`orders/credit-customers/${customerId}/movements`);
        if (!cancelled && data?.success && Array.isArray(data?.data)) {
          setSelectedLedger(data.data);
        } else {
          setSelectedLedger([]);
        }
      } catch (error) {
        console.error("Error fetching ledger:", error);
        setSelectedLedger([]);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedCreditCustomerObj]);
  const selectedCreditCustomerOrders = useMemo(() => {
    if (!selectedCreditCustomerObj) return [];
    const name = String(selectedCreditCustomerObj.name || "").trim().toLowerCase();
    return filteredOrders.filter((o) => String(o.customerName || "").trim().toLowerCase() === name);
  }, [filteredOrders, selectedCreditCustomerObj]);

  const selectedCreditCustomerOrdersTotal = useMemo(
    () => selectedCreditCustomerOrders.reduce((sum, o) => sum + Number(o.total || 0), 0),
    [selectedCreditCustomerOrders]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // ✅ استخدم id مباشرة
      const customerId = selectedCreditCustomerObj?.id || selectedCreditCustomerObj?.customerId;
      if (!customerId) {
        setCreditMovements([]);
        return;
      }
      
      setCreditMovementsLoading(true);
      try {
        // ✅ تأكد من أن الرقم هو id صحيح
        console.log("Fetching movements for customer ID:", customerId);
        const { data } = await Axios.get(`orders/credit-customers/${customerId}/movements`);
        
        if (!cancelled && data?.success) {
          // ✅ تأكد من معالجة البيانات بشكل صحيح
          const movements = Array.isArray(data?.data) ? data.data : [];
          
          // ✅ أضف balance_after إذا لم يكن موجوداً
          let runningBalance = 0;
          const movementsWithBalance = movements.map(m => {
            const delta = Number(m.delta_amount || 0);
            runningBalance += delta;
            return {
              ...m,
              balance_after: m.balance_after || runningBalance
            };
          });
          
          setCreditMovements(movementsWithBalance);
          console.log("Movements loaded:", movementsWithBalance.length);
        } else {
          setCreditMovements([]);
        }
      } catch (error) {
        console.error("Error fetching movements:", error);
        if (!cancelled) setCreditMovements([]);
      } finally {
        if (!cancelled) setCreditMovementsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCreditCustomerObj]);
  const openPartialReturnDialog = (order) => {
    const qtyById = {};
    (order.items || []).forEach((it, idx) => {
      qtyById[String(it.orderItemId || idx)] = "";
    });
    setReturnDialog({
      open: true,
      order,
      mode: "partial",
      reason: "",
      qtyById,
    });
  };

  const openFullReturnDialog = (order) => {
    setReturnDialog({
      open: true,
      order,
      mode: "full",
      reason: "",
      qtyById: {},
    });
  };

  const closeReturnDialog = () => {
    setReturnDialog({ open: false, order: null, mode: "partial", reason: "", qtyById: {} });
  };

  const submitReturnOrder = async () => {
    if (!returnDialog.order) return;
    const reason = returnDialog.reason.trim() || "مرتجع من شاشة التقارير";
    try {
      if (returnDialog.mode === "full") {
        const { data } = await Axios.post(`orders/${returnDialog.order.id}/return-full`, { reason });
        if (!data?.success) throw new Error(data?.message || "فشل إرجاع الفاتورة");
      } else {
        const items = [];
        (returnDialog.order.items || []).forEach((it, idx) => {
          const key = String(it.orderItemId || idx);
          const q = Number(returnDialog.qtyById[key] || 0);
          if (q > 0 && Number(it.qty || 0) >= q && it.orderItemId) {
            items.push({ order_item_id: it.orderItemId, quantity: q });
          }
        });
        if (items.length === 0) {
          window.alert("اختر كمية مرتجعة صحيحة على الأقل لصنف واحد.");
          return;
        }
        const refundAmount = items.reduce((sum, row) => {
          const item = (returnDialog.order.items || []).find((x) => Number(x.orderItemId) === Number(row.order_item_id));
          const unitPrice = Number(item?.price || 0);
          return sum + unitPrice * Number(row.quantity || 0);
        }, 0);
        const { data } = await Axios.post(`orders/${returnDialog.order.id}/return`, {
          reason,
          items,
          refund_amount: refundAmount,
        });
        if (!data?.success) throw new Error(data?.message || "فشل إرجاع الصنف");
      }
      closeReturnDialog();
      setDetailOrder(null);
      setDataTick((v) => v + 1);
    } catch (e) {
      window.alert(e?.response?.data?.message || e?.message || "حدث خطأ أثناء تنفيذ المرتجع");
    }
  };

  const filteredCreditCustomers = useMemo(() => {
    const q = creditSearch.trim().toLowerCase();
    if (!q) return creditCustomers;
    return creditCustomers.filter((c) => {
      const name = String(c.name || "").toLowerCase();
      const phone = String(c.phone || "").toLowerCase();
      const notes = String(c.notes || "").toLowerCase();
      return name.includes(q) || phone.includes(q) || notes.includes(q);
    });
  }, [creditCustomers, creditSearch]);


  const isSearchingForProduct = search.trim() !== "" && productStats !== null;

  if (loading) {
    return (
      <AdminLayout mode={mode} onToggleMode={onToggleMode}>
        <Box sx={{ ...adminPageContainerSx, display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh", gap: 2 }}>
          <CircularProgress />
          <Typography>جاري تحميل المبيعات...</Typography>
        </Box>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout mode={mode} onToggleMode={onToggleMode}>
      <Box sx={adminPageContainerSx}>
        
        {/* ============= العنوان مع زر الأصناف الجديد ============= */}
        <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "stretch", sm: "center" }} sx={{ mb: 3, gap: 1.5 }}>
          <Box>
            <Typography variant="h5" fontWeight={900}>تقارير المبيعات</Typography>
            <Typography variant="body2" color="text.secondary" sx={adminPageSubtitleSx}>
              عرض شامل لكل الفواتير مع تصفية متقدمة وتفاصيل الأصناف
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} gap={1}>
            {/* ✅ زر الأصناف الجديد */}
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<Category />}
              onClick={(e) => setProductMenuAnchor(e.currentTarget)}
              sx={{ textTransform: "none", fontWeight: 800, px: 3 }}
            >
              الأصناف
            </Button>
         
            <Button
              variant="contained"
              color="secondary"
              startIcon={<Print />}
              onClick={() => setPrintOrder({ all: true })}
              disabled={!filteredOrders.length}
              sx={{ textTransform: "none", fontWeight: 800, px: 3 }}
            >
              طباعة التقرير
            </Button>
          </Stack>
        </Stack>

        {/* قائمة الأصناف المنبثقة (Menu) */}
        <Menu
          anchorEl={productMenuAnchor}
          open={Boolean(productMenuAnchor)}
          onClose={() => setProductMenuAnchor(null)}
          PaperProps={{
            sx: { width: 280, maxHeight: 400, p: 1, borderRadius: 2 }
          }}
        >
          <Box sx={{ p: 1 }}>
            <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1, px: 1 }}>
              اختر صنفاً لعرض تفاصيل مبيعاته
            </Typography>
            <TextField
              fullWidth
              size="small"
              placeholder="ابحث عن صنف..."
              value={productSearchInput}
              onChange={(e) => setProductSearchInput(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search fontSize="small" />
                  </InputAdornment>
                ),
              }}
              sx={{ mb: 1 }}
            />
            <Divider sx={{ my: 1 }} />
            <Box sx={{ maxHeight: 280, overflow: "auto" }}>
              {allUniqueProducts
                .filter(p => p.toLowerCase().includes(productSearchInput.toLowerCase()))
                .map((product) => (
                  <MenuItem
                    key={product}
                    onClick={() => handleProductSelect(product)}
                    sx={{ borderRadius: 1, mb: 0.5 }}
                  >
                    <Inventory fontSize="small" sx={{ mr: 1, color: "primary.main" }} />
                    {product}
                  </MenuItem>
                ))}
              {allUniqueProducts.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
                  لا توجد أصناف متاحة
                </Typography>
              )}
            </Box>
          </Box>
        </Menu>
 {/* ============= بطاقات الإحصائيات (بحث عادي أو عام) ============= */}
 {productStats && isSearchingForProduct ? (
          <>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <Inventory color="primary" />
              <Typography variant="subtitle1" fontWeight={800}>
                إحصائيات الصنف: "{search}"
              </Typography>
            </Stack>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              {[
                { title: "الكمية المباعة", value: fmt(productStats.quantity), icon: <ShoppingCart />, color: "success" },
                { title: "إجمالي المبيعات", value: `${fmt(productStats.revenue)} ش`, icon: <ReceiptLong />, color: "info" },
                { title: "إجمالي الربح", value: `${fmt(productStats.profit)} ش`, icon: <TrendingUp />, color: "warning" },
                { title: "عدد الفواتير", value: String(productStats.invoicesCount), icon: <Assessment />, color: "secondary" },
              ].map((item) => (
                <Grid key={item.title} size={{ xs: 12, sm: 6, md: 3 }}>
                  <Card sx={{ 
                    p: 2.5, 
                    borderRadius: 3,
                    border: `1px solid ${alpha(theme.palette[item.color].main, 0.3)}`,
                    background: `linear-gradient(135deg, ${alpha(theme.palette[item.color].main, 0.08)}, ${alpha(theme.palette.background.paper, 0.95)})`,
                  }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="body2" color="text.secondary" fontWeight={600}>{item.title}</Typography>
                        <Typography variant="h5" fontWeight={900} color={`${item.color}.main`}>
                          {item.value}
                        </Typography>
                      </Box>
                      <Avatar sx={{ bgcolor: alpha(theme.palette[item.color].main, 0.14), color: `${item.color}.main` }}>
                        {item.icon}
                      </Avatar>
                    </Stack>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </>
        ) : (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {[
              { title: "عدد الفواتير", value: String(stats.count), icon: <ReceiptLong />, color: "primary" },
              { title: "إجمالي المبيعات", value: `${fmt(stats.total)} ش`, icon: <ShoppingCart />, color: "success" },
              { title: "إجمالي الربح", value: `${fmt(stats.profit)} ش`, icon: <TrendingUp />, color: "warning" },
              { title: "زبائن مختلفين", value: String(stats.customers), icon: <Person />, color: "info" },
            ].map((item) => (
              <Grid key={item.title} size={{ xs: 12, sm: 6, md: 3 }}>
                <Card sx={{ p: 2.5, borderRadius: 3, border: `1px solid ${alpha(theme.palette[item.color].main, 0.2)}` }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" color="text.secondary" fontWeight={600}>{item.title}</Typography>
                      <Typography variant="h5" fontWeight={900} color={`${item.color}.main`}>{item.value}</Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: alpha(theme.palette[item.color].main, 0.14), color: `${item.color}.main` }}>
                      {item.icon}
                    </Avatar>
                  </Stack>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
        {/* ============= شريط التصفية ============= */}
        <Card 
          elevation={0} 
          sx={{ 
            p: 2.5, 
            mb: 3,
            borderRadius: 4, 
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
            bgcolor: alpha(theme.palette.background.paper, 0.8),
            backdropFilter: 'blur(8px)'
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <FilterList color="primary" />
            <Typography variant="subtitle1" fontWeight={800}>الفلاتر والبحث</Typography>
          </Stack>
          
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 2.5 }}>
              <TextField 
                fullWidth 
                size="small" 
                placeholder="ابحث عن فاتورة، زبون، أو صنف..." 
                value={search} 
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
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
            <Grid size={{ xs: 12, sm: 6, md: 1.5 }}>
              <Select
                fullWidth
                size="small"
                value={paymentFilter}
                onChange={(e) => { setPaymentFilter(e.target.value); setPage(1); }}
                displayEmpty
                sx={{ borderRadius: 2.5 }}
              >
                <MenuItem value="all">كل طرق الدفع</MenuItem>
                <MenuItem value="cash">كاش</MenuItem>
                <MenuItem value="app">تطبيق</MenuItem>
                <MenuItem value="credit">آجل</MenuItem>
                <MenuItem value="mixed">مختلط</MenuItem>
              </Select>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 1.5 }}>
              <Select
                fullWidth
                size="small"
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                displayEmpty
                sx={{ borderRadius: 2.5 }}
              >
                <MenuItem value="all">كل الحالات</MenuItem>
                <MenuItem value="paid">مدفوع</MenuItem>
                <MenuItem value="partially_paid">جزئي</MenuItem>
                <MenuItem value="pending">معلق</MenuItem>
                <MenuItem value="cancelled">ملغى</MenuItem>
                <MenuItem value="returned">مرجع</MenuItem>
              </Select>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 1.5 }}>
              <Select
                fullWidth
                size="small"
                value={cashierFilter}
                onChange={(e) => { setCashierFilter(e.target.value); setPage(1); }}
                displayEmpty
                sx={{ borderRadius: 2.5 }}
              >
                <MenuItem value="all">كل الكاشيرين</MenuItem>
                {users.map((user) => (
                  <MenuItem key={user.id} value={user.name}>
                    {user.name}
                  </MenuItem>
                ))}
              </Select>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 2 }}>
              <Select
                fullWidth
                size="small"
                value={creditCustomerFilter}
                onChange={(e) => { setCreditCustomerFilter(e.target.value); setPage(1); }}
                displayEmpty
                sx={{ borderRadius: 2.5 }}
              >
                <MenuItem value="all">كل زبائن الآجل</MenuItem>
                {creditCustomers.map((customer) => (
                  <MenuItem key={customer.id} value={customer.id}>
                    {customer.name}
                  </MenuItem>
                ))}
              </Select>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 1 }}>
  <TextField 
    fullWidth 
    size="small" 
    type="date" 
    label="من" 
    value={fromDate} 
    onChange={(e) => { setFromDate(e.target.value); setPage(1); }} 
    InputLabelProps={{ shrink: true }}
    onClick={(e) => e.target.showPicker && e.target.showPicker()}
    sx={{ 
      '& .MuiInputBase-root': { 
        cursor: 'pointer',
        borderRadius: 2.5 
      },
      '& .MuiInputBase-input': { 
        cursor: 'pointer' 
      }
    }}
  />
</Grid>
<Grid size={{ xs: 12, sm: 6, md: 1 }}>
  <TextField 
    fullWidth 
    size="small" 
    type="date" 
    label="إلى" 
    value={toDate} 
    onChange={(e) => { setToDate(e.target.value); setPage(1); }} 
    InputLabelProps={{ shrink: true }}
    onClick={(e) => e.target.showPicker && e.target.showPicker()}
    sx={{ 
      '& .MuiInputBase-root': { 
        cursor: 'pointer',
        borderRadius: 2.5 
      },
      '& .MuiInputBase-input': { 
        cursor: 'pointer' 
      }
    }}
  />
</Grid>
            <Grid size={{ xs: 12, md: 1 }}>
              <Tooltip title="إعادة ضبط الفلاتر">
                <Button 
                  fullWidth
                  variant="outlined" 
                  color="error"
                  onClick={resetFilters}
                  sx={{ 
                    height: 40, 
                    borderRadius: 2.5,
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

       

{selectedCreditCustomerObj && creditCustomerFilter !== "all" && (
  <Card sx={{ borderRadius: 3, p: 2, mb: 3, border: `1px solid ${alpha(theme.palette.warning.main, 0.25)}` }}>
    <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems={{ md: "center" }} sx={{ mb: 2 }}>
      <Typography variant="subtitle1" fontWeight={900} display="flex" alignItems="center" gap={1}>
        <Person color="primary" />
        حركات زبون الآجل: {selectedCreditCustomerObj.name}
      </Typography>
      
      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
        {/* المدفوع */}
        <Card sx={{ borderRadius: 2, overflow: "hidden", minWidth: 100 }}>
          <Box sx={{ display: "flex", alignItems: "center", p: 1.5, gap: 1.5 }}>
            <Avatar sx={{ bgcolor: alpha(theme.palette.success.main, 0.12), color: "success.main", width: 40, height: 40 }}>
              <Payments />
            </Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>المدفوع</Typography>
              <Typography variant="h6" fontWeight={900} color="success.main" lineHeight={1.2}>
                {fmt(selectedCreditCustomerObj.totalPaid || 0)} ش
              </Typography>
            </Box>
          </Box>
        </Card>
        
        {/* سقف الآجل */}
        <Card sx={{ borderRadius: 2, overflow: "hidden", minWidth: 100 }}>
          <Box sx={{ display: "flex", alignItems: "center", p: 1.5, gap: 1.5 }}>
            <Avatar sx={{ bgcolor: alpha(theme.palette.warning.main, 0.12), color: "warning.main", width: 40, height: 40 }}>
              <AccountBalanceWallet />
            </Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>سقف الآجل</Typography>
              <Typography variant="h6" fontWeight={900} color="warning.main" lineHeight={1.2}>
                {fmt(selectedCreditCustomerObj.creditLimit)} ش
              </Typography>
            </Box>
          </Box>
        </Card>

        {/* إجمالي الشراء */}
        <Card sx={{ borderRadius: 2, overflow: "hidden", minWidth: 110 }}>
          <Box sx={{ display: "flex", alignItems: "center", p: 1.5, gap: 1.5 }}>
            <Avatar sx={{ bgcolor: alpha(theme.palette.info.main, 0.12), color: "info.main", width: 40, height: 40 }}>
              <ShoppingCart />
            </Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>إجمالي الشراء</Typography>
              <Typography variant="h6" fontWeight={900} color="info.main" lineHeight={1.2}>
                {fmt(selectedCreditCustomerOrdersTotal)} ش
              </Typography>
            </Box>
          </Box>
        </Card>

        {/* المبلغ المطلوب من الزبون */}
        <Card sx={{ 
          borderRadius: 2, 
          overflow: "hidden", 
          minWidth: 130,
          bgcolor: (selectedCreditCustomerObj.balance || 0) > 0 
            ? alpha(theme.palette.error.main, 0.08)
            : alpha(theme.palette.success.main, 0.08),
          border: `1px solid ${(selectedCreditCustomerObj.balance || 0) > 0 
            ? alpha(theme.palette.error.main, 0.3)
            : alpha(theme.palette.success.main, 0.3)}`
        }}>
          <Box sx={{ display: "flex", alignItems: "center", p: 1.5, gap: 1.5 }}>
            <Avatar sx={{ 
              bgcolor: (selectedCreditCustomerObj.balance || 0) > 0 
                ? alpha(theme.palette.error.main, 0.12)
                : alpha(theme.palette.success.main, 0.12),
              color: (selectedCreditCustomerObj.balance || 0) > 0 ? "error.main" : "success.main", 
              width: 40, 
              height: 40 
            }}>
              {(selectedCreditCustomerObj.balance || 0) > 0 ? <TrendingUp /> : <CheckCircle />}
            </Avatar>
            <Box>
              <Typography variant="caption" color="text.secondary" fontWeight={500}>المبلغ المطلوب من الزبون</Typography>
              <Typography variant="h6" fontWeight={900} 
                color={(selectedCreditCustomerObj.balance || 0) > 0 ? "error.main" : "success.main"} 
                lineHeight={1.2}>
                {fmt(Math.max(0, selectedCreditCustomerObj.balance || 0))} ش
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {(selectedCreditCustomerObj.balance || 0) > 0 ? "يجب تحصيله" : "لا دين"}
              </Typography>
            </Box>
          </Box>
        </Card>

        {/* رصيد السحب (دائن) - يظهر فقط إذا كان هناك رصيد دائن */}
        {(selectedCreditCustomerObj.available_credit || 0) > 0 && (
          <Card sx={{ 
            borderRadius: 2, 
            overflow: "hidden", 
            minWidth: 130,
            bgcolor: alpha(theme.palette.secondary.main, 0.08),
            border: `1px solid ${alpha(theme.palette.secondary.main, 0.3)}`
          }}>
            <Box sx={{ display: "flex", alignItems: "center", p: 1.5, gap: 1.5 }}>
              <Avatar sx={{ bgcolor: alpha(theme.palette.secondary.main, 0.12), color: "secondary.main", width: 40, height: 40 }}>
                <CreditScore />
              </Avatar>
              <Box>
                <Typography variant="caption" color="text.secondary" fontWeight={500}>رصيد السحب (دائن)</Typography>
                <Typography variant="h6" fontWeight={900} color="secondary.main" lineHeight={1.2}>
                  {fmt(selectedCreditCustomerObj.available_credit)} ش
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  الزبون دفع زيادة - يمكنه سحبها
                </Typography>
              </Box>
            </Box>
          </Card>
        )}
      </Stack>
    </Stack>

    {/* جدول الحركات - مرة واحدة فقط */}
    <TableContainer sx={{ mt: 2 }}>
      <Table size="small">
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
  {creditMovements.length === 0 ? (
    <TableRow>
      <TableCell colSpan={8} align="center">لا توجد حركات لهذا الزبون</TableCell>
    </TableRow>
  ) : (
    creditMovements.map((m) => (
      <TableRow 
        key={`mov-${m.id}`} 
        hover 
        sx={{ cursor: (m.type === 'sale' || m.movement_type === 'credit_sale') ? 'pointer' : 'default' }}
        onClick={() => openMovementDetails(m)}
      >
        <TableCell align="center">
          <Chip
            size="small"
            color={Number(m.delta_amount || 0) >= 0 ? "warning" : "success"}
            label={Number(m.delta_amount || 0) >= 0 ? "بيع آجل" : "تسديد"}
          />
        </TableCell>
        <TableCell align="center">{m.occurred_at ? new Date(m.occurred_at).toLocaleString("ar-SA") : "—"}</TableCell>
        <TableCell align="center">{m.cashier_name || "—"}</TableCell>
        <TableCell align="center">
          {m.reference_order_id ? (
            <Typography 
              color="primary.main" 
              fontWeight={600}
              sx={{ textDecoration: 'underline', cursor: 'pointer' }}
            >
              {m.order_number || `ORD-${m.reference_order_id}`}
            </Typography>
          ) : "—"}
        </TableCell>
        <TableCell align="center">{m.payment_method ? paymentLabel(m.payment_method) : "—"}</TableCell>
        <TableCell align="center" sx={{ fontWeight: 800, color: Number(m.delta_amount || 0) >= 0 ? "error.main" : "success.main" }}>
          {fmt(Math.abs(m.delta_amount))} ش
        </TableCell>
        <TableCell align="center" sx={{ fontWeight: 800 }}>{fmt(m.balance_after || 0)} ش</TableCell>
        <TableCell align="center" sx={{ maxWidth: 180 }}>
          <Typography variant="caption" color="text.secondary">
            {String(m.note || "").slice(0, 70) || "—"}
          </Typography>
        </TableCell>
      </TableRow>
    ))
  )}
</TableBody>
      </Table>
    </TableContainer>
    
    {creditBackendLoading && (
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
        جاري مزامنة بيانات زبائن الآجل من الخادم...
      </Typography>
    )}
    {creditMovementsLoading && (
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
        جاري تحميل كشف حركات الزبون...
      </Typography>
    )}
  </Card>
)}
        {/* ============= الجدول الرئيسي (عرض الفواتير) ============= */}
        {creditCustomerFilter === "all" && filteredOrders.length > 0 && (          
          
          
          <Card sx={{ borderRadius: 3, p: 1.2 }}>
  <TableContainer>
    <Table size="small" stickyHeader>
      <TableHead>
        <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
          <TableCell align="center" sx={{ fontWeight: 800 }}>رقم الفاتورة</TableCell>
          <TableCell align="center" sx={{ fontWeight: 800 }}>الكاشير</TableCell>
          <TableCell align="center" sx={{ fontWeight: 800 }}>الزبون</TableCell>
          {isSearchingForProduct && (
            <TableCell align="center" sx={{ fontWeight: 800 }}>الأصناف المطابقة</TableCell>
          )}
          <TableCell align="center" sx={{ fontWeight: 800 }}>التاريخ</TableCell>
          <TableCell align="center" sx={{ fontWeight: 800 }}>الدفع</TableCell>
          <TableCell align="center" sx={{ fontWeight: 800 }}>الحالة</TableCell>
          <TableCell align="center" sx={{ fontWeight: 800 }}>الإجمالي</TableCell>
          <TableCell align="center" sx={{ fontWeight: 800 }}>الإجراءات</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {pageRows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={isSearchingForProduct ? 9 : 8} align="center">
              <Typography color="text.secondary" sx={{ py: 4 }}>
                لا توجد فواتير مطابقة للفلاتر
              </Typography>
            </TableCell>
          </TableRow>
        ) : pageRows.map((row) => {
          const matchingItems = isSearchingForProduct ? getMatchingItems(row, search) : [];
          
          return (
            <TableRow
              key={row.id}
              hover
              sx={{
                "&:nth-of-type(odd)": { bgcolor: alpha(theme.palette.primary.main, 0.015) },
              }}
            >
              <TableCell align="center">
                <Typography fontWeight={800} color="primary.main">
                  {row.orderNumber}
                </Typography>
              </TableCell>
              <TableCell align="center">{row.soldBy || "—"}</TableCell>
              <TableCell align="center">{row.customerName || "—"}</TableCell>
              
              {isSearchingForProduct && (
                <TableCell align="center">
                  {matchingItems.length > 0 ? (
                    <Stack spacing={0.5}>
                      {matchingItems.map((item, idx) => (
                        <Chip
                          key={idx}
                          label={`${item.name} (${fmt(item.qty)})`}
                          size="small"
                          color="secondary"
                          variant="outlined"
                          sx={{ fontWeight: 600 }}
                        />
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="caption" color="text.secondary">—</Typography>
                  )}
                </TableCell>
              )}
              
              <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                <Typography variant="body2">
                  {row.soldAt ? new Date(row.soldAt).toLocaleString("ar-SA") : "—"}
                </Typography>
              </TableCell>
              
              <TableCell align="center">
                <Chip 
                  size="small" 
                  label={paymentLabel(row.paymentMethod)} 
                  variant="outlined"
                  sx={{ fontWeight: 600 }}
                />
              </TableCell>
              
              <TableCell align="center">
                <Chip 
                  size="small" 
                  color={statusColor(row.status)} 
                  label={statusLabel(row.status)} 
                  sx={{ fontWeight: 700 }} 
                />
              </TableCell>
              
              <TableCell align="center">
                <Stack spacing={0.2} alignItems="center">
                
                  <Typography variant="caption" color="success.main" fontWeight={700}>
                    مباع: {fmt(row.paidAmount)} ش
                  </Typography>
                  <Typography variant="caption" color="warning.main" fontWeight={700}>
                    ربح: {fmt(row.totalProfit)} ش
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    تكلفة: {fmt(Number(row.total || 0) - Number(row.totalProfit || 0))} ش
                  </Typography>
                </Stack>
              </TableCell>
              
              <TableCell align="center">
                <Stack direction="row" spacing={0.7} justifyContent="center" flexWrap="wrap">
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<Visibility />}
                    onClick={() => openDetail(row)}
                    sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2 }}
                  >
                    التفاصيل
                  </Button>
               
                </Stack>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  </TableContainer>
  
  {filteredOrders.length > 0 && (
    <Stack direction="row" justifyContent="center" sx={{ mt: 2 }}>
      <Pagination 
        count={pageCount} 
        page={safePage} 
        onChange={(_, v) => setPage(v)} 
        color="primary" 
        shape="rounded"
        showFirstButton
        showLastButton
      />
    </Stack>
  )}
</Card>
)}

        {/* ============= نافذة التفاصيل (فاتورة) ============= */}
        <Dialog 
          open={Boolean(detailOrder)} 
          onClose={() => setDetailOrder(null)} 
          fullWidth 
          maxWidth="md" 
          slotProps={{ paper: { sx: dialogPaperSx } }}
        >
          <DialogTitle sx={dialogTitleSx}>
            <IconButton size="small" onClick={() => setDetailOrder(null)} sx={dialogCloseBtnSx}>
              <Close />
            </IconButton>
            <Typography variant="h6" fontWeight={800}>
              تفاصيل الفاتورة — {detailOrder?.orderNumber}
            </Typography>
          </DialogTitle>
          
          <DialogContent dividers sx={{ textAlign: "right" }}>
            {detailOrder && (
              <Stack spacing={1} sx={{ mb: 2, p: 2, bgcolor: alpha(theme.palette.primary.main, 0.04), borderRadius: 2 }}>
                <Typography variant="body2"><strong>الكاشير:</strong> {detailOrder.soldBy || "—"}</Typography>
                {detailOrder.customerName && (
                  <Typography variant="body2"><strong>الزبون:</strong> {detailOrder.customerName}</Typography>
                )}
                <Typography variant="body2">
                  <strong>التاريخ:</strong> {detailOrder.soldAt ? new Date(detailOrder.soldAt).toLocaleString("ar-SA") : "—"}
                </Typography>
                <Typography variant="body2">
                  <strong>طريقة الدفع:</strong> {paymentLabel(detailOrder.paymentMethod)} — 
                  <strong> الحالة:</strong> {statusLabel(detailOrder.status)}
                </Typography>
                {detailOrder.discount > 0 && (
                  <Typography variant="body2" color="warning.main">
                    <strong>الخصم:</strong> {fmt(detailOrder.discount)} شيكل
                  </Typography>
                )}
                {detailOrder.dueAmount > 0 && (
                  <Typography variant="body2" color="error.main">
                    <strong>المتبقي:</strong> {fmt(detailOrder.dueAmount)} شيكل
                  </Typography>
                )}
              </Stack>
            )}
            
            {detailLoading ? (
              <Stack alignItems="center" spacing={2} sx={{ py: 4 }}>
                <CircularProgress />
                <Typography variant="body2" color="text.secondary">جاري تحميل الأصناف...</Typography>
              </Stack>
            ) : (
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
                    {(detailOrder?.items || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                            لا توجد أصناف
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ) : (detailOrder?.items || []).map((it, i) => (
                      <TableRow key={i}>
                        <TableCell align="center">{i + 1}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600 }}>{it.name}</TableCell>
                        <TableCell align="center">{fmt(it.qty)}</TableCell>
                        <TableCell align="center">{fmt(it.price)} ش</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700 }}>{fmt(it.total)} ش</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            
            {detailOrder && !detailLoading && (
              <Stack spacing={0.5} sx={{ mt: 2, p: 2, bgcolor: alpha(theme.palette.success.main, 0.04), borderRadius: 2 }}>
                <Typography variant="h6" fontWeight={900}>
                  الإجمالي: {fmt(detailOrder.total)} شيكل
                </Typography>
                {detailOrder.totalProfit > 0 && (
                  <Typography variant="body2" color="success.main" fontWeight={700}>
                    الربح: {fmt(detailOrder.totalProfit)} شيكل
                  </Typography>
                )}
              </Stack>
            )}
          </DialogContent>
          
          <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
            <Button onClick={() => setDetailOrder(null)}>إغلاق</Button>
            <Button
              variant="outlined"
              color="warning"
              startIcon={<Replay />}
              onClick={() => openPartialReturnDialog(detailOrder)}
              disabled={
                !detailOrder ||
                detailOrder.status === "cancelled" ||
                detailOrder.status === "returned" ||
                !String(detailOrder.orderNumber || "").startsWith("ORD-")
              }
            >
              مرتجع صنف
            </Button>
            <Button
              variant="outlined"
              color="error"
              startIcon={<Replay />}
              onClick={() => openFullReturnDialog(detailOrder)}
              disabled={!detailOrder || detailOrder.status === "cancelled" || detailOrder.status === "returned"}
            >
              مرتجع فاتورة كاملة
            </Button>
            <Button 
              variant="contained" 
              startIcon={<Print />} 
              onClick={() => setPrintOrder(detailOrder)}
              sx={{ textTransform: "none", fontWeight: 800 }}
            >
              طباعة
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={returnDialog.open} onClose={closeReturnDialog} fullWidth maxWidth="md" slotProps={{ paper: { sx: dialogPaperSx } }}>
          <DialogTitle sx={dialogTitleSx}>
            <IconButton size="small" onClick={closeReturnDialog} sx={dialogCloseBtnSx}>
              <Close />
            </IconButton>
            <Typography variant="h6" fontWeight={800}>
              {returnDialog.mode === "full" ? "مرتجع فاتورة كاملة" : "مرتجع أصناف من الفاتورة"}
            </Typography>
          </DialogTitle>
          <DialogContent dividers>
            {returnDialog.mode === "full" ? (
              <Alert severity="warning" sx={{ mb: 2 }}>
                سيتم إرجاع الفاتورة بالكامل وتحديث حالتها.
              </Alert>
            ) : (
              <Stack spacing={1.25} sx={{ mb: 2 }}>
                {(returnDialog.order?.items || []).map((it, idx) => {
                  const key = String(it.orderItemId || idx);
                  return (
                    <Stack key={key} direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ sm: "center" }}>
                      <Typography sx={{ minWidth: 220, fontWeight: 700 }}>{it.name}</Typography>
                      <Typography variant="body2" color="text.secondary">المباع: {fmt(it.qty)}</Typography>
                      <TextField
                        size="small"
                        type="number"
                        label="كمية الإرجاع"
                        value={returnDialog.qtyById[key] ?? ""}
                        onChange={(e) =>
                          setReturnDialog((prev) => ({
                            ...prev,
                            qtyById: { ...prev.qtyById, [key]: e.target.value },
                          }))
                        }
                        inputProps={{ min: 0, max: Number(it.qty || 0), step: "0.01" }}
                        sx={{ width: 150 }}
                      />
                    </Stack>
                  );
                })}
              </Stack>
            )}
            <TextField
              fullWidth
              size="small"
              label="سبب المرتجع"
              value={returnDialog.reason}
              onChange={(e) => setReturnDialog((prev) => ({ ...prev, reason: e.target.value }))}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeReturnDialog}>إلغاء</Button>
            <Button variant="contained" color="error" onClick={submitReturnOrder}>
              تنفيذ المرتجع
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog 
  open={creditDialogOpen} 
  onClose={() => setCreditDialogOpen(false)} 
  fullWidth 
  maxWidth="sm" 
  slotProps={{ paper: { sx: { ...dialogPaperSx, borderRadius: 4 } } }}
>
  <DialogTitle sx={dialogTitleSx}>
    <IconButton size="small" onClick={() => setCreditDialogOpen(false)} sx={dialogCloseBtnSx}>
      <Close />
    </IconButton>
    <Typography variant="h6" fontWeight={800}>إضافة زبون آجل جديد</Typography>
  </DialogTitle>
  
  <DialogContent dividers>
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 1 }}>
      {/* الاسم الكامل */}
      <TextField
        fullWidth
        label="الاسم الكامل"
        value={newCreditName}
        onChange={(e) => setNewCreditName(e.target.value)}
        placeholder="أدخل اسم الزبون"
        required
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Person color="primary" />
            </InputAdornment>
          ),
          sx: { borderRadius: 2 }
        }}
      />

      {/* رقم الهاتف */}
      <TextField
        fullWidth
        label="رقم الهاتف"
        value={newCreditPhone}
        onChange={(e) => setNewCreditPhone(e.target.value)}
        placeholder="05xxxxxxxx"
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Person color="primary" />
            </InputAdornment>
          ),
          sx: { borderRadius: 2 }
        }}
      />

 


      {/* معلومات إضافية للعرض فقط (سيتم حسابها تلقائياً) */}
      <Alert severity="info" icon={<ReceiptLong />} sx={{ borderRadius: 2 }}>
        <Typography variant="body2" fontWeight={600}>معلومات تلقائية:</Typography>
        <Typography variant="caption" display="block">• سيتم حساب الرصيد تلقائياً بعد أول عملية شراء</Typography>
      </Alert>
    </Box>
  </DialogContent>
  
  <DialogActions sx={{ px: 3, py: 2, gap: 1.5 }}>
    <Button 
      onClick={() => setCreditDialogOpen(false)} 
      variant="outlined"
      color="error"
      sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, px: 3 }}
    >
      إلغاء
    </Button>
    <Button 
      variant="contained" 
      onClick={async () => {
        const name = String(newCreditName || "").trim();
        if (!name) {
          window.alert("الرجاء إدخال اسم الزبون");
          return;
        }
        
        setCreatingCreditCustomer(true);
        try {
          // إرسال جميع البيانات إلى الباك إند
          const { data } = await Axios.post("orders/credit-customers", { 
            name: name,
            phone: newCreditPhone || "",
            credit_limit: parseFloat(newCreditLimit) || 0,
            notes: newCreditNotes || ""
          });
          
          if (!data?.success) throw new Error(data?.message || "فشل إضافة الزبون");
          
          const pickedId = data?.data?.id;
          if (pickedId && !creditCustomers.some((c) => String(c.id) === String(pickedId))) {
            setCreditCustomers((prev) => [
              {
                id: pickedId,
                rowKey: `id:${pickedId}`,
                customerId: pickedId,
                name: name,
                phone: newCreditPhone || "",
                creditLimit: parseFloat(newCreditLimit) || 0,
                balance: 0,
                totalPaid: 0,
                totalSales: 0,
                invoicesCount: 0,
                notes: newCreditNotes || "",
              },
              ...prev,
            ]);
          }
          
          // إعادة تعيين الحقول
          setNewCreditName("");
          setNewCreditPhone("");
          setNewCreditLimit("");
          setNewCreditNotes("");
          setDataTick((v) => v + 1);
          
          // إغلاق النافذة
          setCreditDialogOpen(false);
          
          // عرض رسالة نجاح
          window.alert("تم إضافة الزبون بنجاح");
          
        } catch (e) {
          window.alert(e?.response?.data?.message || e?.message || "فشل إضافة زبون الآجل");
        } finally {
          setCreatingCreditCustomer(false);
        }
      }}
      disabled={creatingCreditCustomer || !newCreditName.trim()}
      sx={{ textTransform: "none", fontWeight: 700, borderRadius: 2, px: 3 }}
    >
      {creatingCreditCustomer ? <CircularProgress size={24} /> : "إضافة زبون"}
    </Button>
  </DialogActions>
</Dialog>


        {/* ============= ✅ نافذة عرض مبيعات الصنف (الجديدة) ============= */}
        <Dialog
          open={productDialogOpen}
          onClose={closeProductDialog}
          fullWidth
          maxWidth="lg"
          slotProps={{ paper: { sx: { borderRadius: 3, overflow: "hidden" } } }}
        >
          <DialogTitle sx={dialogTitleSx}>
            <IconButton size="small" onClick={closeProductDialog} sx={dialogCloseBtnSx}>
              <Close />
            </IconButton>
            <Typography variant="h6" fontWeight={800}>
              تفاصيل مبيعات الصنف: {selectedProductForSearch}
            </Typography>
          </DialogTitle>
          <DialogContent dividers>
            {productSalesDetails.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 6 }}>
                <Typography color="text.secondary">لا توجد مبيعات لهذا الصنف</Typography>
              </Box>
            ) : (
              <>
                {/* بطاقات إحصائيات سريعة للصنف داخل النافذة */}
                <Grid container spacing={2} sx={{ mb: 3 }}>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <Card sx={{ p: 2, textAlign: "center", bgcolor: alpha(theme.palette.info.main, 0.08) }}>
                      <Typography variant="body2" color="text.secondary">إجمالي الكمية</Typography>
                      <Typography variant="h6" fontWeight={800}>
                        {fmt(productSalesDetails.reduce((sum, s) => sum + s.quantity, 0))}
                      </Typography>
                    </Card>
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <Card sx={{ p: 2, textAlign: "center", bgcolor: alpha(theme.palette.success.main, 0.08) }}>
                      <Typography variant="body2" color="text.secondary">إجمالي المبيعات</Typography>
                      <Typography variant="h6" fontWeight={800} color="success.main">
                        {fmt(productSalesDetails.reduce((sum, s) => sum + s.total, 0))} ش
                      </Typography>
                    </Card>
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <Card sx={{ p: 2, textAlign: "center", bgcolor: alpha(theme.palette.warning.main, 0.08) }}>
                      <Typography variant="body2" color="text.secondary">إجمالي الربح</Typography>
                      <Typography variant="h6" fontWeight={800} color="warning.main">
                        {fmt(productSalesDetails.reduce((sum, s) => sum + s.profit, 0))} ش
                      </Typography>
                    </Card>
                  </Grid>
                  <Grid size={{ xs: 6, md: 3 }}>
                    <Card sx={{ p: 2, textAlign: "center", bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
                      <Typography variant="body2" color="text.secondary">عدد العمليات</Typography>
                      <Typography variant="h6" fontWeight={800}>
                        {productSalesDetails.length}
                      </Typography>
                    </Card>
                  </Grid>
                </Grid>

                <TableContainer component={Card} variant="outlined">
                  <Table size="small" dir="rtl">
                    <TableHead>
                      <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
                        <TableCell align="center" sx={{ fontWeight: 800 }}>رقم الفاتورة</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800 }}>التاريخ والساعة</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800 }}>الكاشير (من باع)</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800 }}>الزبون (من اشترى)</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800 }}>الكمية</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800 }}>سعر الوحدة</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800 }}>الإجمالي</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800 }}>الربح</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {productSalesDetails.map((sale) => (
                        <TableRow key={sale.id} hover>
                          <TableCell align="center">
                            <Typography fontWeight={600} color="primary.main">
                              {sale.invoiceNumber}
                            </Typography>
                          </TableCell>
                          <TableCell align="center" sx={{ whiteSpace: "nowrap" }}>
                            {sale.soldAt ? new Date(sale.soldAt).toLocaleString("ar-SA") : "—"}
                          </TableCell>
                          <TableCell align="center">{sale.cashier || "—"}</TableCell>
                          <TableCell align="center">{sale.customerName}</TableCell>
                          <TableCell align="center">{fmt(sale.quantity)}</TableCell>
                          <TableCell align="center">{fmt(sale.price)} ش</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 700 }}>{fmt(sale.total)} ش</TableCell>
                          <TableCell align="center" sx={{ color: "success.main", fontWeight: 600 }}>{fmt(sale.profit)} ش</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={closeProductDialog}>إغلاق</Button>
            <Button 
              variant="contained" 
              startIcon={<Print />}
              onClick={() => {
                // طباعة التقرير التفصيلي للصنف (يمكن تنفيذها لاحقاً)
                alert("طباعة تقرير الصنف قيد التطوير");
              }}
            >
              طباعة التقرير
            </Button>
          </DialogActions>
        </Dialog>

        {/* ============= قسم الطباعة (كما هو) ============= */}
        {printOrder && !printOrder.all && (
          <Box sx={{ display: "none", "@media print": { display: "block", p: 2, color: "#000", direction: "rtl" } }}>
            <Typography fontWeight={900} sx={{ mb: 1 }}>فاتورة مبيعات</Typography>
            <Typography variant="body2">رقم: {printOrder.orderNumber}</Typography>
            {printOrder.customerName && <Typography variant="body2">الزبون: {printOrder.customerName}</Typography>}
            <Typography variant="body2">الكاشير: {printOrder.soldBy}</Typography>
            <Typography variant="body2">التاريخ: {printOrder.soldAt ? new Date(printOrder.soldAt).toLocaleString("ar-SA") : "—"}</Typography>
            <Divider sx={{ my: 1 }} />
            {(printOrder.items || []).map((it, i) => (
              <Typography key={i} variant="body2">
                {i + 1}. {it.name} — {fmt(it.qty)} × {fmt(it.price)} = {fmt(it.total)} شيكل
              </Typography>
            ))}
            <Divider sx={{ my: 1 }} />
            <Typography fontWeight={800}>الإجمالي: {fmt(printOrder.total)} شيكل</Typography>
          </Box>
        )}
{/* ============= نافذة تفاصيل حركة الزبون ============= */}
<Dialog
  open={movementDetailsOpen}
  onClose={closeMovementDetails}
  fullWidth
  maxWidth="md"
  slotProps={{ paper: { sx: dialogPaperSx } }}
>
  <DialogTitle sx={dialogTitleSx}>
    <IconButton size="small" onClick={closeMovementDetails} sx={dialogCloseBtnSx}>
      <Close />
    </IconButton>
    <Typography variant="h6" fontWeight={800}>
      تفاصيل الفاتورة — {selectedMovement?.order_number || `ORD-${selectedMovement?.reference_order_id}`}
    </Typography>
  </DialogTitle>
  
  <DialogContent dividers sx={{ textAlign: "right" }}>
    {movementDetailsLoading ? (
      <Stack alignItems="center" spacing={2} sx={{ py: 4 }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">جاري تحميل تفاصيل الفاتورة...</Typography>
      </Stack>
    ) : movementOrderDetails ? (
      <>
        {/* معلومات أساسية */}
        <Stack spacing={1.5} sx={{ mb: 3, p: 2, bgcolor: alpha(theme.palette.primary.main, 0.04), borderRadius: 2 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <Typography variant="body2">
                <strong>رقم الفاتورة:</strong> {movementOrderDetails.order_number}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Typography variant="body2">
                <strong>التاريخ:</strong> {movementOrderDetails.created_at ? new Date(movementOrderDetails.created_at).toLocaleString("ar-SA") : "—"}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Typography variant="body2">
                <strong>الكاشير:</strong> {movementOrderDetails.created_by_name || movementOrderDetails.created_by || "—"}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Typography variant="body2">
                <strong>الزبون:</strong> {movementOrderDetails.customer_name || movementOrderDetails.customer?.name || "زبون نقدي"}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Typography variant="body2">
                <strong>طريقة الدفع:</strong> {paymentLabel(movementOrderDetails.payment_method)}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Typography variant="body2">
                <strong>الحالة:</strong> {statusLabel(movementOrderDetails.status)}
              </Typography>
            </Grid>
          </Grid>
        </Stack>

        {/* المبالغ */}
        <Stack spacing={1} sx={{ mb: 3, p: 2, bgcolor: alpha(theme.palette.info.main, 0.04), borderRadius: 2 }}>
          <Typography variant="subtitle1" fontWeight={800}>المبالغ</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 4 }}>
              <Card sx={{ p: 1.5, textAlign: "center", bgcolor: alpha(theme.palette.success.main, 0.08) }}>
                <Typography variant="caption" color="text.secondary">إجمالي الفاتورة</Typography>
                <Typography variant="h6" fontWeight={800} color="success.main">
                  {fmt(movementOrderDetails.total)} ش
                </Typography>
              </Card>
            </Grid>
            <Grid size={{ xs: 4 }}>
              <Card sx={{ p: 1.5, textAlign: "center", bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
                <Typography variant="caption" color="text.secondary">المبلغ المدفوع</Typography>
                <Typography variant="h6" fontWeight={800} color="primary.main">
                  {fmt(movementOrderDetails.paid_amount)} ش
                </Typography>
              </Card>
            </Grid>
            <Grid size={{ xs: 4 }}>
              <Card sx={{ p: 1.5, textAlign: "center", bgcolor: alpha(theme.palette.warning.main, 0.08) }}>
                <Typography variant="caption" color="text.secondary">المبلغ المتبقي</Typography>
                <Typography variant="h6" fontWeight={800} color="warning.main">
                  {fmt(movementOrderDetails.due_amount)} ش
                </Typography>
              </Card>
            </Grid>
          </Grid>
        </Stack>

        {/* جدول الأصناف */}
        <Typography variant="subtitle1" fontWeight={800} sx={{ mb: 1 }}>الأصناف المشتراة</Typography>
        <TableContainer component={Card} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
                <TableCell align="center" sx={{ fontWeight: 800 }}>#</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>الصنف</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>الكمية</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>سعر الوحدة</TableCell>
                <TableCell align="center" sx={{ fontWeight: 800 }}>الإجمالي</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(movementOrderDetails.items || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
                      لا توجد أصناف
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                (movementOrderDetails.items || []).map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell align="center">{idx + 1}</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>{item.name || item.item_name || item.product_name}</TableCell>
                    <TableCell align="center">{fmt(item.quantity || item.qty)}</TableCell>
                    <TableCell align="center">{fmt(item.unit_price || item.price)} ش</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 700 }}>{fmt(item.total_price || item.total)} ش</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* ملاحظات */}
        {movementOrderDetails.notes && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, p: 1, bgcolor: alpha(theme.palette.grey[500], 0.08), borderRadius: 1 }}>
            <strong>ملاحظات:</strong> {movementOrderDetails.notes}
          </Typography>
        )}
      </>
    ) : (
      <Typography color="error.main" sx={{ textAlign: "center", py: 4 }}>
        تعذر تحميل تفاصيل الفاتورة
      </Typography>
    )}
  </DialogContent>
  
  <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
    <Button onClick={closeMovementDetails} variant="contained" sx={{ textTransform: "none" }}>
      إغلاق
    </Button>
    {selectedMovement?.reference_order_id && (
      <Button 
        variant="outlined" 
        startIcon={<Print />}
        onClick={() => {
          // طباعة الفاتورة
          const orderToPrint = movementOrderDetails;
          if (orderToPrint) {
            setPrintOrder({
              id: orderToPrint.id,
              orderNumber: orderToPrint.order_number,
              customerName: orderToPrint.customer_name,
              soldBy: orderToPrint.created_by_name,
              soldAt: orderToPrint.created_at,
              total: orderToPrint.total,
              items: (orderToPrint.items || []).map(item => ({
                name: item.name || item.item_name,
                qty: item.quantity || item.qty,
                price: item.unit_price || item.price,
                total: item.total_price || item.total
              }))
            });
          }
        }}
      >
        طباعة
      </Button>
    )}
  </DialogActions>
</Dialog>
        {printOrder?.all && (
          <Box sx={{ display: "none", "@media print": { display: "block", p: 2, color: "#000", direction: "rtl" } }}>
            <Typography fontWeight={900} sx={{ mb: 1 }}>تقرير المبيعات الشامل</Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {new Date().toLocaleString("ar-SA")} — عدد الفواتير: {filteredOrders.length}
            </Typography>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
              <thead>
                <tr style={{ borderBottom: "2px solid #000" }}>
                  <th style={{ textAlign: "right", padding: "4px" }}>الفاتورة</th>
                  <th style={{ textAlign: "right", padding: "4px" }}>الكاشير</th>
                  <th style={{ textAlign: "right", padding: "4px" }}>الزبون</th>
                  <th style={{ textAlign: "right", padding: "4px" }}>التاريخ</th>
                  <th style={{ textAlign: "right", padding: "4px" }}>الدفع</th>
                  <th style={{ textAlign: "right", padding: "4px" }}>الحالة</th>
                  <th style={{ textAlign: "right", padding: "4px" }}>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((o) => (
                  <tr key={o.id} style={{ borderBottom: "1px solid #ccc" }}>
                    <td style={{ padding: "4px" }}>{o.orderNumber}</td>
                    <td style={{ padding: "4px" }}>{o.soldBy}</td>
                    <td style={{ padding: "4px" }}>{o.customerName || "—"}</td>
                    <td style={{ padding: "4px" }}>{o.soldAt ? new Date(o.soldAt).toLocaleString("ar-SA") : "—"}</td>
                    <td style={{ padding: "4px" }}>{paymentLabel(o.paymentMethod)}</td>
                    <td style={{ padding: "4px" }}>{statusLabel(o.status)}</td>
                    <td style={{ padding: "4px", fontWeight: 700 }}>{fmt(o.total)} ش</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 16, fontWeight: 800 }}>
              الإجمالي: {fmt(stats.total)} شيكل — الربح: {fmt(stats.profit)} شيكل
            </div>
          </Box>
        )}
      </Box>
    </AdminLayout>
  );
}