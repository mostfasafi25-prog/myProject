import { Add, Close, DeleteOutline, LocalShipping, ReceiptLong, Storefront } from "@mui/icons-material";
import {
  Alert,
  alpha,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
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
} from "@mui/material";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Axios } from "../../Api/Axios";
import FilterBarRow from "../../components/FilterBarRow";
import { adminPageContainerSx, adminPageSubtitleSx } from "../../utils/adminPageLayout";
import { negativeAmountTextSx } from "../../utils/negativeAmountStyle";
import AdminLayout from "./AdminLayout";
import { confirmApp, showAppToast } from "../../utils/appToast";
import { productDisplayName } from "../../utils/productDisplayName";
import { normalizeSaleOptions, productHasSaleOptions } from "../../utils/productSaleOptions";
import { getStoredUser, isAdmin, isSuperCashier, purchaserDisplayName } from "../../utils/userRoles";
import { appendAudit } from "../../utils/auditLog";
import { fetchAndPersistSalesCategories, PHARMACY_ADMIN_CATEGORIES_SYNCED } from "../../utils/backendCategoriesSync";

const ROWS_PER_PAGE = 5;
const NOTIFICATIONS_KEY = "systemNotifications";

function normalizeOneDecimal(value) {
  const cleaned = String(value ?? "").replace(/[^\d.]/g, "");
  const num = Number(cleaned);
  if (Number.isNaN(num)) return "";
  return (Math.round(num * 10) / 10).toString();
}

const saleTypeLabelMap = {
  pill: "بالحبة",
  strip: "شريط كامل",
  bottle: "قزازة",
  box: "علبة",
  sachet: "كيس",
};

const purchaseDialogPaperSx = { borderRadius: 3, overflow: "hidden" };
const purchaseDialogTitleSx = {
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
const purchaseDialogCloseBtnSx = {
  position: "absolute",
  insetInlineStart: 8,
  top: "50%",
  transform: "translateY(-50%)",
};

function formatOneDecimal(n) {
  const x = Number(n);
  if (Number.isNaN(x)) return "0.0";
  return x.toFixed(1);
}

async function fetchAllPurchasesApi(http) {
  const all = [];
  let page = 1;
  let lastPage = 1;
  for (let g = 0; g < 40; g += 1) {
    const { data } = await http.get("purchases", { params: { per_page: 100, page } });
    if (!data?.success || !Array.isArray(data.data)) break;
    all.push(...data.data);
    lastPage = Number(data.pagination?.last_page || 1);
    if (page >= lastPage) break;
    page += 1;
  }
  return all;
}

async function fetchAllProductsForPurchaseCatalog(http) {
  const all = [];
  let page = 1;
  let lastPage = 1;
  for (let g = 0; g < 40; g += 1) {
    const { data } = await http.get("products", {
      params: { per_page: 100, page, include_inactive: 1, scope: "purchase" },
    });
    if (!data?.success || !Array.isArray(data.data)) break;
    all.push(...data.data);
    lastPage = Number(data.pagination?.last_page || 1);
    if (page >= lastPage) break;
    page += 1;
  }
  return all;
}

async function fetchAllSuppliersApi(http) {
  const all = [];
  let page = 1;
  let lastPage = 1;
  for (let g = 0; g < 20; g += 1) {
    const { data } = await http.get("suppliers", { params: { per_page: 100, page } });
    if (!data?.success || !Array.isArray(data.data)) break;
    all.push(...data.data);
    lastPage = Number(data.pagination?.last_page || 1);
    if (page >= lastPage) break;
    page += 1;
  }
  return all;
}

function mapApiPurchaseToDisplayRow(p) {
  const inv = p.invoice_number || `P-${p.id}`;
  const supplierName = p.supplier?.name || "—";
  const statusAr =
    p.status === "returned"
      ? "مرجع"
      : p.status === "pending" || p.status === "partially_paid"
        ? "مراجعة"
        : p.status === "cancelled"
          ? "ملغى"
          : "مكتمل";
  const items = (p.items || []).map((it) => ({
    productId: it.product_id,
    name: it.product_name,
    qtyPaid: Number(it.quantity),
    qtyBonus: 0,
    qty: Number(it.quantity),
    unitPrice: Number(it.unit_price),
    total: Number(it.total_price),
    category: "—",
    saleType: "strip",
  }));
  const purchasedAt = p.purchase_date
    ? new Date(p.purchase_date).toISOString()
    : p.created_at
      ? new Date(p.created_at).toISOString()
      : new Date().toISOString();
  return {
    id: inv,
    apiId: p.id,
    purchasedBy: "—",
    purchasedByUsername: "",
    purchasedByRole: "admin",
    supplier: supplierName,
    supplierId: p.supplier_id,
    status: statusAr,
    statusRaw: p.status,
    paymentMethod: p.payment_method || "cash",
    purchasedAt,
    total: Number(p.paid_amount ?? p.grand_total ?? p.total_amount ?? 0),
    treasuryDebit: {
      total: Number(p.paid_amount ?? 0),
      cash: Number(p.cash_amount ?? p.paid_amount ?? 0),
      app: Number(p.app_amount ?? 0),
    },
    items,
  };
}

function mapApiProductToCatalogRow(row) {
  const categoryName = String(row?.categories?.[0]?.name || row?.category?.name || "أصناف متنوعة");
  const stock = Number(row?.stock || 0);
  const salePrice = Number(row?.price || 0);
  const cost = Number(row?.purchase_price ?? row?.cost_price ?? 0);
  return {
    id: Number(row?.id),
    name: String(row?.name || "صنف"),
    variantLabel: "",
    category: categoryName,
    saleType: "strip",
    qty: stock,
    min: Number(row?.reorder_point ?? row?.min_stock ?? 0),
    costPrice: cost,
    price: salePrice,
    active: row?.is_active !== false,
    image: String(row?.image_url || ""),
    saleOptions: Array.isArray(row?.sale_options)
      ? row.sale_options
      : Array.isArray(row?.saleOptions)
        ? row.saleOptions
        : undefined,
  };
}

export default function PurchasesPage({ mode, onToggleMode }) {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const superCashier = isSuperCashier(getStoredUser());
  const currentUser = getStoredUser();
  const strictTreasuryGuard = isAdmin(currentUser);
  const [catalogCatsTick, setCatalogCatsTick] = useState(0);
  useEffect(() => {
    const bump = () => setCatalogCatsTick((t) => t + 1);
    window.addEventListener(PHARMACY_ADMIN_CATEGORIES_SYNCED, bump);
    let cancelled = false;
    fetchAndPersistSalesCategories().finally(() => {
      if (!cancelled) bump();
    });
    return () => {
      cancelled = true;
      window.removeEventListener(PHARMACY_ADMIN_CATEGORIES_SYNCED, bump);
    };
  }, []);
  const [page, setPage] = useState(1);
  const [purchaseSearch, setPurchaseSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailPurchase, setDetailPurchase] = useState(null);
  const [dataTick, setDataTick] = useState(0);
  const [purchaseRows, setPurchaseRows] = useState([]);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [supplierList, setSupplierList] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [purchaseSubmitting, setPurchaseSubmitting] = useState(false);
  const purchaseSubmitGuardRef = useRef(false);
  const [newPurchaseOpen, setNewPurchaseOpen] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("all");
  const [purchaseLines, setPurchaseLines] = useState([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [purchasePaymentMethod, setPurchasePaymentMethod] = useState("cash");
  const [newPurchaseError, setNewPurchaseError] = useState("");
  const [treasuryBalance, setTreasuryBalance] = useState(0);
  const [printPurchase, setPrintPurchase] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDataLoading(true);
      try {
        const [rawPurchases, rawProducts, rawSuppliers] = await Promise.all([
          fetchAllPurchasesApi(Axios),
          fetchAllProductsForPurchaseCatalog(Axios),
          fetchAllSuppliersApi(Axios),
        ]);
        if (cancelled) return;
        setPurchaseRows(rawPurchases.map(mapApiPurchaseToDisplayRow));
        setCatalogProducts(rawProducts.map(mapApiProductToCatalogRow).filter((p) => Number.isFinite(p.id)));
        setSupplierList(Array.isArray(rawSuppliers) ? rawSuppliers : []);
      } catch (e) {
        console.warn("[PurchasesPage] load", e);
        if (!cancelled) {
          showAppToast("تعذر تحميل المشتريات أو الأصناف من الخادم", "error");
        }
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dataTick]);

  const purchaseStats = useMemo(() => {
    const rows = purchaseRows;
    const suppliers = new Set(rows.map((r) => String(r.supplier || "").trim()).filter(Boolean));
    const review = rows.filter((r) => String(r.status || "") === "مراجعة").length;
    const returned = rows.filter((r) => String(r.status || "") === "مرجع").length;
    return { count: rows.length, suppliers: suppliers.size, review, returned };
  }, [purchaseRows]);
  const supplierOptions = useMemo(() => {
    const list = Array.isArray(supplierList) ? supplierList : [];
    return list
      .filter((s) => s && s.is_active !== false)
      .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ar"));
  }, [supplierList]);

  const processPurchaseReturn = useCallback(
    async (row) => {
      const apiId = row?.apiId;
      if (!apiId) {
        showAppToast("لا يمكن إرجاع هذه القسيمة — سجّل المشتريات من الخادم فقط", "warning");
        return;
      }
      if (String(row.status || "") === "مرجع" || row.statusRaw === "returned") {
        showAppToast("هذه القسيمة مُرجَعة مسبقًا", "info");
        return;
      }
      const msg = superCashier
        ? `تأكيد إرجاع قسيمة الشراء ${row.id}؟ سيتم عكس الكميات والخزنة عبر السيرفر.`
        : `تأكيد إرجاع قسيمة الشراء ${row.id}؟ سيتم عكس الكميات من المخزون وإعادة المبلغ للخزنة حسب النظام.`;
      const ok = await confirmApp({
        title: "إرجاع قسيمة الشراء",
        text: msg,
        icon: "question",
        confirmText: "نعم، إرجاع",
      });
      if (!ok) return;
      try {
        const { data } = await Axios.post(`purchases/${apiId}/full-return`, {});
        if (!data?.success) {
          showAppToast(data?.message || "تعذر إرجاع القسيمة", "error");
          return;
        }
        appendAudit({
          action: "purchase_return",
          details: JSON.stringify({
            purchaseId: apiId,
            invoice: row.id,
          }),
          username: currentUser?.username || "",
          role: currentUser?.role || "",
        });
        setDataTick((t) => t + 1);
        setDetailPurchase(null);
        showAppToast("تم إرجاع القسيمة عبر الخادم", "success");
      } catch (e) {
        showAppToast(e?.response?.data?.message || "تعذر إرجاع القسيمة", "error");
      }
    },
    [currentUser, superCashier],
  );


const filteredRows = useMemo(() => {
  const q = purchaseSearch.trim().toLowerCase();
  const now = Date.now();
  return purchaseRows
    .filter((row) => {
      // بحث شامل في كل الحقول
      let matchesSearch = !q;
      if (!matchesSearch && q) {
        // البحث في رقم الفاتورة
        matchesSearch = matchesSearch || String(row.id || "").toLowerCase().includes(q);
        // البحث في اسم المورد
        matchesSearch = matchesSearch || String(row.supplier || "").toLowerCase().includes(q);
        // البحث في اسم المنفذ (البائع)
        matchesSearch = matchesSearch || String(row.purchasedBy || "").toLowerCase().includes(q);
        // البحث في الأصناف (المنتجات)
        if (Array.isArray(row.items)) {
          matchesSearch = matchesSearch || row.items.some(item => 
            String(item.name || "").toLowerCase().includes(q)
          );
        }
        // البحث في الحالة
        matchesSearch = matchesSearch || String(row.status || "").toLowerCase().includes(q);
        // البحث في طريقة الدفع
        matchesSearch = matchesSearch || String(row.paymentMethod || "").toLowerCase().includes(q);
        // البحث في التاريخ
        if (row.purchasedAt) {
          const dateStr = new Date(row.purchasedAt).toLocaleDateString("ar-EG");
          matchesSearch = matchesSearch || dateStr.includes(q);
        }
      }
      
      const matchesStatus = statusFilter === "all" || String(row.status || "مكتمل") === statusFilter;
      const rowMs = new Date(row.purchasedAt || 0).getTime();
      const fromMs = fromDate ? new Date(`${fromDate}T00:00:00`).getTime() : 0;
      const toMs = toDate ? new Date(`${toDate}T23:59:59`).getTime() : 0;
      const matchesRange =
        (!fromMs || rowMs >= fromMs) &&
        (!toMs || rowMs <= toMs);
      if (!matchesRange) return false;
      if (dateFilter === "all") return matchesSearch && matchesStatus;
      const atMs = new Date(row.purchasedAt || 0).getTime();
      if (!atMs) return false;
      const diffMs = now - atMs;
      const dayMs = 24 * 60 * 60 * 1000;
      const matchesDate =
        (dateFilter === "today" && diffMs <= dayMs) ||
        (dateFilter === "7d" && diffMs <= 7 * dayMs) ||
        (dateFilter === "30d" && diffMs <= 30 * dayMs);
      return matchesSearch && matchesStatus && matchesDate;
    })
    .sort((a, b) => new Date(b.purchasedAt || 0).getTime() - new Date(a.purchasedAt || 0).getTime());
}, [purchaseRows, purchaseSearch, dateFilter, statusFilter, fromDate, toDate]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const rows = useMemo(() => {
    const start = (safePage - 1) * ROWS_PER_PAGE;
    return filteredRows.slice(start, start + ROWS_PER_PAGE);
  }, [filteredRows, safePage]);

  const catalogCategories = useMemo(() => {
    const s = new Set();
    catalogProducts.forEach((p) => {
      const c = String(p.category || "").trim();
      if (c) s.add(c);
    });
    return [...s].sort((a, b) => a.localeCompare(b, "ar"));
  }, [catalogProducts, catalogCatsTick]);

  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    return catalogProducts.filter((p) => {
      const catOk = catalogCategory === "all" || String(p.category || "") === catalogCategory;
      if (!catOk) return false;
      if (!q) return true;
      const dn = productDisplayName(p).toLowerCase();
      return (
        dn.includes(q) ||
        String(p.name || "").toLowerCase().includes(q) ||
        String(p.variantLabel || "").toLowerCase().includes(q) ||
        String(p.category || "").toLowerCase().includes(q) ||
        String(p.id).includes(q)
      );
    });
  }, [catalogProducts, catalogSearch, catalogCategory]);

  const newPurchaseTreasury = useMemo(() => Number(treasuryBalance || 0), [treasuryBalance]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await Axios.get("treasury-balance");
        if (!cancelled && data?.success) {
          setTreasuryBalance(Number(data?.data?.balance || 0));
        }
      } catch {
        if (!cancelled) setTreasuryBalance(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dataTick, newPurchaseOpen]);

  const newPurchaseTotalCost = useMemo(() => {
    let sum = 0;
    for (const line of purchaseLines) {
      const paid = Number(normalizeOneDecimal(line.paidQty)) || Number(line.paidQty) || 0;
      const unit = Number(normalizeOneDecimal(line.unitPrice)) || Number(line.unitPrice) || 0;
      sum += paid * unit;
    }
    return sum;
  }, [purchaseLines]);

  const openNewPurchaseDialog = () => {
    setCatalogSearch("");
    setCatalogCategory("all");
    setPurchaseLines([]);
    setSelectedSupplierId(String(supplierOptions[0]?.id || ""));
    setPurchasePaymentMethod("cash");
    setNewPurchaseError("");
    setPurchaseSubmitting(false);
    purchaseSubmitGuardRef.current = false;

    setNewPurchaseOpen(true);
  };

  const addProductToPurchaseLines = (product) => {
    setNewPurchaseError("");
    setPurchaseLines((prev) => {
      if (prev.some((l) => Number(l.productId) === Number(product.id))) {
        showAppToast("الصنف مضاف بالفعل — عدّل الكمية من الجدول", "info");
        return prev;
      }
      return [
        ...prev,
        {
          lineKey: `L-${product.id}-${Date.now()}`,
          productId: product.id,
          saleOptionId: "",
          paidQty: "1",
          bonusQty: "",
          unitPrice: String(product.costPrice ?? product.price ?? ""),
        },
      ];
    });
  };
  useEffect(() => {
    const wantedId = (() => {
      try {
        return new URLSearchParams(location.search).get("restock") || "";
      } catch {
        return "";
      }
    })();
    if (!wantedId) return;
    const p = catalogProducts.find((x) => String(x.id) === String(wantedId));
    if (!p) return;
    openNewPurchaseDialog();
    addProductToPurchaseLines(p);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("restock");
      const nextQuery = url.searchParams.toString();
      navigate(`${url.pathname}${nextQuery ? `?${nextQuery}` : ""}${url.hash}`, { replace: true });
    } catch {
      // ignore
    }
  }, [location.search, catalogProducts]);

  const updatePurchaseLine = (lineKey, patch) => {
    setPurchaseLines((prev) => prev.map((l) => (l.lineKey === lineKey ? { ...l, ...patch } : l)));
  };

  const removePurchaseLine = (lineKey) => {
    setPurchaseLines((prev) => prev.filter((l) => l.lineKey !== lineKey));
  };

  const confirmNewPurchase = async () => {
    
    if (purchaseSubmitGuardRef.current) return;
    setNewPurchaseError("");

    const selectedSupplier = supplierOptions.find((s) => String(s.id) === String(selectedSupplierId));
    const supplierName = String(selectedSupplier?.name || "").trim();
    if (!supplierName || !selectedSupplier) {
      setNewPurchaseError("اختر مورداً من القائمة قبل إتمام عملية الشراء");
      return;
    }
    if (!purchaseLines.length) {
      setNewPurchaseError("أضف صنفًا واحدًا على الأقل من القائمة");
      return;
    }

    const products = catalogProducts;
    const invoiceItems = [];
    let totalCost = 0;
    for (const line of purchaseLines) {
      const p = products.find((x) => Number(x.id) === Number(line.productId));
      if (!p) {
        setNewPurchaseError(`صنف غير موجود في القائمة (معرّف ${line.productId}) — حدّث الصفحة`);
        return;
      }
      const paid = Number(normalizeOneDecimal(line.paidQty)) || Number(line.paidQty) || 0;
      const bonus = Number(normalizeOneDecimal(line.bonusQty)) || Number(line.bonusQty) || 0;
      const unit = Number(normalizeOneDecimal(line.unitPrice)) || Number(line.unitPrice) || 0;
      if (paid <= 0 && bonus <= 0) {
        setNewPurchaseError(`أدخل كمية مشتراة لـ ${productDisplayName(p)}`);
        return;
      }
      if (paid <= 0 && bonus > 0) {
        setNewPurchaseError(`البونص مع مشتراة فقط — ${productDisplayName(p)}`);
        return;
      }
      const lineCost = paid * unit;
      totalCost += lineCost;
      const stockAdd = paid + bonus;
      const hasOptions = productHasSaleOptions(p);
      const options = hasOptions ? normalizeSaleOptions(p) : [];
      const selectedOption = hasOptions
        ? options.find((o) => String(o.id) === String(line.saleOptionId || ""))
        : null;
      if (hasOptions && !selectedOption) {
        setNewPurchaseError(`اختر خيار الصنف قبل الحفظ: ${productDisplayName(p)}`);
        return;
      }
      const displayName =
        productDisplayName(p) + (selectedOption ? ` (${selectedOption.label})` : "");
      invoiceItems.push({
        productId: p.id,
        name: displayName,
        ...(selectedOption ? { saleOptionId: String(selectedOption.id), saleOptionLabel: selectedOption.label } : {}),
        category: p.category,
        saleType: p.saleType,
        qtyPaid: paid,
        qtyBonus: bonus,
        qty: stockAdd,
        unitPrice: unit,
        total: Number(lineCost.toFixed(2)),
      });
    }

    const totalRounded = Number(totalCost.toFixed(2));
    const supplierPrepaid = Math.max(0, Number(selectedSupplier.balance || 0));
    const treasuryDue = Math.max(0, Number((totalRounded - Math.min(totalRounded, supplierPrepaid)).toFixed(2)));
    if (!superCashier && treasuryDue > 0 && newPurchaseTreasury < treasuryDue) {
      setNewPurchaseError(
        strictTreasuryGuard
          ? "لا يكفي المال في الخزنة (بعد احتساب أي رصيد مسبق للمورد) — زوّد الخزنة ثم أعد المحاولة"
          : "لا يكفي المال في الخزنة لإتمام هذا الجزء النقدي من الشراء",
      );
      return;
    }

    const apiItems = invoiceItems.map((it) => ({
      product_id: it.productId,
      product_name: it.name,
      quantity: it.qty,
      unit_price: it.unitPrice,
      total_price: Number((it.qty * it.unitPrice).toFixed(2)),
    }));

    const invoiceNumber = `PO-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const buyerLabel = purchaserDisplayName(currentUser);

    purchaseSubmitGuardRef.current = true;
    setPurchaseSubmitting(true);
    try {
      const pm = purchasePaymentMethod === "app" ? "app" : "cash";
      const { data } = await Axios.post("purchases", {
        invoice_number: invoiceNumber,
        supplier_id: selectedSupplier.id,
        items: apiItems,
        total_amount: totalRounded,
        paid_amount: totalRounded,
        remaining_amount: 0,
        status: "completed",
        purchase_date: new Date().toISOString().split("T")[0],
        payment_method: pm,
        cash_amount: pm === "app" ? 0 : totalRounded,
        app_amount: pm === "app" ? totalRounded : 0,
        treasury_note: `شراء من ${supplierName} — ${invoiceItems.length} بند`,
      });

      if (!data?.success) {
        setNewPurchaseError(data?.message || "فشل تسجيل الشراء في الخادم");
        return;
      }

      appendAudit({
        action: "purchase_created",
        details: JSON.stringify({
          purchase_id: data.data?.id,
          invoice_number: invoiceNumber,
          supplier: supplierName,
          total: totalRounded,
          items: invoiceItems.length,
        }),
        username: currentUser?.username || "",
        role: currentUser?.role || "",
      });

      try {
        const notification = {
          id: `NTF-${Date.now()}`,
          type: "purchase",
          prefCategory: "purchase",
          read: false,
          title: "تم تسجيل شراء جديد",
          message: superCashier
            ? `توريد من المخزون بواسطة ${buyerLabel} — ${invoiceItems.length} صنف`
            : `فاتورة ${invoiceNumber} بقيمة ${totalRounded.toFixed(1)} شيكل`,
          details: invoiceItems.map((it) => it.name).join("، "),
          createdAt: new Date().toISOString(),
          fromManagement: true,
          managementLabel:
            currentUser?.role === "admin" || currentUser?.role === "super_admin"
              ? "إدارة النظام"
              : currentUser?.role === "super_cashier"
                ? "سوبر كاشير"
                : "النظام",
        };
        const existing = JSON.parse(localStorage.getItem(NOTIFICATIONS_KEY) || "[]");
        const next = Array.isArray(existing) ? [notification, ...existing] : [notification];
        localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(next.slice(0, 80)));
      } catch {
        // ignore
      }

      setDataTick((t) => t + 1);
      setNewPurchaseOpen(false);
      setPurchaseLines([]);
      showAppToast(superCashier ? "تم تسجيل التوريد" : "تم تسجيل الشراء في الخادم", "success");
    } catch (e) {
      setNewPurchaseError(
        e?.response?.data?.message || e?.message || "تعذر إرسال الشراء — تحقق من الاتصال والخادم",
      );
    } finally {
      purchaseSubmitGuardRef.current = false;
      setPurchaseSubmitting(false);
    }
  };

  useEffect(() => {
    if (!printPurchase) return;
    const t = window.setTimeout(() => window.print(), 200);
    const done = () => setPrintPurchase(null);
    window.addEventListener("afterprint", done);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("afterprint", done);
    };
  }, [printPurchase]);

  return (
    <AdminLayout mode={mode} onToggleMode={onToggleMode}>
      <Box sx={adminPageContainerSx}>
        {dataLoading ? (
          <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
            جاري تحميل المشتريات والأصناف من الخادم...
          </Alert>
        ) : null}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "stretch", sm: "flex-start" }}
          sx={{ mb: 2, gap: 1.5 }}
        >
          <Box>
            <Typography variant="h5" fontWeight={900}>
              إدارة المشتريات
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={adminPageSubtitleSx}>
              لوحة منظمة لمتابعة طلبات الشراء والموردين وتكلفة التوريد
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={openNewPurchaseDialog}
            sx={{ textTransform: "none", fontWeight: 800, alignSelf: { xs: "stretch", sm: "center" } }}
          >
            شراء من أصناف المخزون
          </Button>
        </Stack>
        <Card
          sx={{
            p: 1.6,
            mb: 2,
            borderRadius: 3,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha(
              theme.palette.secondary.main,
              0.08,
            )})`,
          }}
        >
          <FilterBarRow>
            <TextField
              size="small"
              placeholder="بحث شامل: رقم الفاتورة، المورد، الصنف، الحالة..."
              value={purchaseSearch}
              onChange={(e) => {
                setPurchaseSearch(e.target.value);
                setPage(1);
              }}
              sx={{ flex: "1 1 200px", minWidth: 160 }}
            />
            <Select
              size="small"
              value={dateFilter}
              onChange={(e) => {
                setDateFilter(e.target.value);
                setPage(1);
              }}
              sx={{ minWidth: 148, flex: "0 0 auto" }}
            >
              <MenuItem value="all">كل التواريخ</MenuItem>
              <MenuItem value="today">اليوم</MenuItem>
              <MenuItem value="7d">آخر 7 أيام</MenuItem>
              <MenuItem value="30d">آخر 30 يوم</MenuItem>
            </Select>
            <Select
              size="small"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              sx={{ minWidth: 148, flex: "0 0 auto" }}
            >
              <MenuItem value="all">كل الحالات</MenuItem>
              <MenuItem value="مكتمل">مكتمل</MenuItem>
              <MenuItem value="مراجعة">مراجعة</MenuItem>
            </Select>
            <TextField
              size="small"
              type="date"
              label="من تاريخ"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setPage(1);
              }}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 150, flex: "0 0 auto" }}
            />
            <TextField
              size="small"
              type="date"
              label="إلى تاريخ"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setPage(1);
              }}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 150, flex: "0 0 auto" }}
            />
            <Button
              variant="outlined"
              onClick={() => {
                setPurchaseSearch("");
                setDateFilter("all");
                setStatusFilter("all");
                setFromDate("");
                setToDate("");
                setPage(1);
              }}
              sx={{ textTransform: "none", fontWeight: 700, flex: "0 0 auto", whiteSpace: "nowrap" }}
            >
              إعادة الضبط
            </Button>
          </FilterBarRow>
        </Card>

        <Grid container spacing={2}>
          {(superCashier
            ? [
                { title: "إجمالي القسائم المسجّلة", value: String(purchaseStats.count), icon: <ReceiptLong /> },
                { title: "موردين مختلفين", value: String(purchaseStats.suppliers), icon: <Storefront /> },
                { title: "قسائم مُرجَعة", value: String(purchaseStats.returned), icon: <LocalShipping /> },
              ]
            : [
                { title: "طلبات هذا الأسبوع", value: "24", icon: <ReceiptLong /> },
                { title: "موردين نشطين", value: "9", icon: <Storefront /> },
                { title: "شحنات قيد الوصول", value: "5", icon: <LocalShipping /> },
              ]
          ).map((item) => (
            <Grid key={item.title} size={{ xs: 12, md: 4 }}>
              <Card sx={{ p: 2, borderRadius: 3, border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}` }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Box>
                    <Typography variant="body2" color="text.secondary">{item.title}</Typography>
                    <Typography variant="h5" fontWeight={900}>{item.value}</Typography>
                  </Box>
                  <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: "primary.main" }}>
                    {item.icon}
                  </Avatar>
                </Stack>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Card sx={{ mt: 2, borderRadius: 3, p: 1.2 }}>
          <TableContainer>
            <Table size="small" sx={{ tableLayout: "fixed" }}>
              <TableHead>
                <TableRow>
                  <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>رقم الطلب</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>المنفذ / المورد</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>التاريخ</TableCell>
                  {!superCashier ? (
                    <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>القيمة</TableCell>
                  ) : null}
                  <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>الحالة</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>تفاصيل</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 800, color: "text.secondary" }}>إرجاع</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.apiId != null ? `p-${row.apiId}` : row.id} hover>
                    <TableCell align="center" sx={{ fontWeight: 700, color: "primary.main" }}>{row.id}</TableCell>
                    <TableCell align="center">
                      {row.purchasedBy || "-"}
                      <Typography variant="caption" display="block" color="text.secondary">
                        {row.supplier || "مورد عام"}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">{row.purchasedAt ? new Date(row.purchasedAt).toLocaleString("en-GB") : "-"}</TableCell>
                    {!superCashier ? (
                      <TableCell align="center">{formatOneDecimal(row.total)} شيكل</TableCell>
                    ) : null}
                    <TableCell align="center">
                      <Chip
                        size="small"
                        label={row.status || "مكتمل"}
                        color={
                          (row.status || "مكتمل") === "مكتمل"
                            ? "success"
                            : (row.status || "مكتمل") === "مراجعة"
                              ? "warning"
                              : (row.status || "مكتمل") === "مرجع"
                                ? "default"
                                : "info"
                        }
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setDetailPurchase(row)}
                        sx={{ textTransform: "none", fontWeight: 700 }}
                      >
                        عرض
                      </Button>
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        color="warning"
                        variant="outlined"
                        disabled={String(row.status || "") === "مرجع"}
                        onClick={() => processPurchaseReturn(row)}
                        sx={{ textTransform: "none", fontWeight: 700 }}
                      >
                        إرجاع القسيمة
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Stack direction="row" justifyContent="center" sx={{ mt: 1.5 }}>
            <Pagination count={pageCount} page={safePage} onChange={(_, value) => setPage(value)} color="primary" shape="rounded" />
          </Stack>
        </Card>

        <Dialog
          open={newPurchaseOpen}
          onClose={() => setNewPurchaseOpen(false)}
          fullWidth
          maxWidth="md"
          slotProps={{ paper: { sx: purchaseDialogPaperSx } }}
        >

<DialogTitle sx={purchaseDialogTitleSx}>
  <IconButton aria-label="إغلاق" size="small" onClick={() => setNewPurchaseOpen(false)} sx={purchaseDialogCloseBtnSx}>
    <Close />
  </IconButton>
  <Typography 
    component="div"
    sx={{ 
      textAlign: "center", 
      width: "100%", 
      px: { xs: 4, sm: 8 },
      fontWeight: 800,
      fontSize: "1.25rem"
    }}
  >
    إضافة عملية شراء جديدة
  </Typography>
</DialogTitle>

          <DialogContent dividers sx={{ textAlign: "right", px: { xs: 2, sm: 2.5 }, py: 1.5 }}>
            {newPurchaseError ? (
              <Alert severity="error" sx={{ mb: 1.5 }}>
                {newPurchaseError}
              </Alert>
            ) : null}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              صفِّ الأصناف بالبحث أو القسم، ثم اضغط على الصنف لإضافته. كل تركيز (مثل 100 مجم و500 مجم) يُسجَّل كصنف منفصل في المخزون
              ليميّز الفرع عن الآخر.
            </Typography>
            <Card variant="outlined" sx={{ p: 1.1, mb: 1.25, borderRadius: 2 }}>
              {supplierOptions.length === 0 ? (
                <Alert severity="warning" sx={{ borderRadius: 2 }}>
                  لا يوجد موردون نشطون. أضف موردًا أولاً من صفحة الموردين.
                  <Button
                    size="small"
                    variant="outlined"
                    sx={{ ml: 1, textTransform: "none" }}
                    onClick={() => {
                      setNewPurchaseOpen(false);
                      navigate("/admin/suppliers");
                    }}
                  >
                    فتح الموردين
                  </Button>
                </Alert>
              ) : (
                <Select
                  size="small"
                  fullWidth
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  displayEmpty
                >
                  <MenuItem value="" disabled>
                    اختر المورد
                  </MenuItem>
                  {supplierOptions.map((s) => (
                    <MenuItem key={s.id} value={String(s.id)}>
                      {s.name}
                      {Number(s.balance) > 0
                        ? ` — رصيد مسبق ${Number(s.balance).toFixed(2)} شيكل`
                        : Number(s.balance) < 0
                          ? ` — دين ${Math.abs(Number(s.balance)).toFixed(2)} شيكل`
                          : ""}
                    </MenuItem>
                  ))}
                </Select>
              )}
            </Card>
            {supplierOptions.length > 0 ? (
              <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1, mb: 1.5 }} alignItems={{ sm: "center" }}>
                <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                  طريقة الدفع (تسجيل الخزنة)
                </Typography>
                <Select
                  size="small"
                  value={purchasePaymentMethod}
                  onChange={(e) => setPurchasePaymentMethod(e.target.value)}
                  sx={{ minWidth: { xs: "100%", sm: 260 } }}
                >
                  <MenuItem value="cash">كاش</MenuItem>
                  <MenuItem value="app">تطبيق</MenuItem>
                </Select>
              </Stack>
            ) : null}
            <Stack direction={{ xs: "column", sm: "row" }} sx={{ gap: 1, mb: 1.5 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="بحث شامل: اسم الصنف، الفرع، القسم، رقم الصنف..."
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
              />
              <Select
                size="small"
                value={catalogCategory}
                onChange={(e) => setCatalogCategory(e.target.value)}
                displayEmpty
                sx={{ minWidth: { xs: "100%", sm: 200 } }}
              >
                <MenuItem value="all">كل الأقسام</MenuItem>
                {catalogCategories.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </Select>
            </Stack>
            <Card variant="outlined" sx={{ maxHeight: 280, overflow: "auto", mb: 2, borderRadius: 2 }}>
              <List dense disablePadding>
                {filteredCatalog.length === 0 ? (
                  <ListItemText primary="لا توجد أصناف مطابقة" secondary="جرّب تغيير البحث أو القسم" sx={{ px: 2, py: 1.5 }} />
                ) : (
                  filteredCatalog.slice(0, 100).map((p) => (
                    <ListItemButton
                      key={p.id}
                      onClick={() => addProductToPurchaseLines(p)}
                      sx={{ alignItems: "flex-start", gap: 1, py: 1.1 }}
                    >
                      <ListItemText
                        primary={productDisplayName(p)}
                        primaryTypographyProps={{ fontWeight: 700 }}
                        secondary={`${p.category || "—"} · مخزون ${formatOneDecimal(p.qty)} · بيع ${formatOneDecimal(p.price)} شيكل`}
                      />
                      <Add fontSize="small" color="primary" sx={{ mt: 0.5 }} />
                    </ListItemButton>
                  ))
                )}
              </List>
            </Card>
            <Divider sx={{ my: 1 }} />
            <Typography fontWeight={800} sx={{ mb: 1 }}>
              بنود الشراء
            </Typography>
            {purchaseLines.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                اختر أصنافًا من القائمة أعلاه
              </Typography>
            ) : (
              <TableContainer component={Card} variant="outlined" sx={{ borderRadius: 2, mb: 1 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.06) }}>
                      <TableCell align="center" sx={{ fontWeight: 800 }}>
                        الصنف
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800 }}>
                        الفرع/الخيار
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800 }}>
                        مشتراة
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800 }}>
                        بونص
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800 }}>
                        سعر الشراء
                      </TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800 }}>
                        حذف
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {purchaseLines.map((line) => {
                      const prod = catalogProducts.find((x) => Number(x.id) === Number(line.productId));
                      return (
                        <TableRow key={line.lineKey}>
                          <TableCell align="center" sx={{ fontWeight: 700, maxWidth: 200 }}>
                            {prod ? productDisplayName(prod) : `#${line.productId}`}
                          </TableCell>
                          <TableCell align="center">
                            {prod && productHasSaleOptions(prod) ? (
                              <Select
                                size="small"
                                value={line.saleOptionId || ""}
                                onChange={(e) => updatePurchaseLine(line.lineKey, { saleOptionId: e.target.value })}
                                sx={{ minWidth: 170 }}
                                displayEmpty
                              >
                                <MenuItem value="" disabled>
                                  اختر الخيار
                                </MenuItem>
                                {normalizeSaleOptions(prod).map((opt) => (
                                  <MenuItem key={String(opt.id)} value={String(opt.id)}>
                                    {opt.label || `خيار ${opt.id}`}
                                  </MenuItem>
                                ))}
                              </Select>
                            ) : (
                              <Typography variant="caption" color="text.secondary">
                                الصنف الأساسي
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell align="center">
                            <TextField
                              size="small"
                              type="text"
                              inputMode="decimal"
                              value={line.paidQty}
                              onChange={(e) =>
                                updatePurchaseLine(line.lineKey, { paidQty: normalizeOneDecimal(e.target.value) })
                              }
                              sx={{ width: 88 }}
                              inputProps={{ style: { textAlign: "center" } }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <TextField
                              size="small"
                              type="text"
                              inputMode="decimal"
                              value={line.bonusQty}
                              onChange={(e) =>
                                updatePurchaseLine(line.lineKey, { bonusQty: normalizeOneDecimal(e.target.value) })
                              }
                              sx={{ width: 88 }}
                              inputProps={{ style: { textAlign: "center" } }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <TextField
                              size="small"
                              type="text"
                              inputMode="decimal"
                              value={line.unitPrice}
                              onChange={(e) =>
                                updatePurchaseLine(line.lineKey, { unitPrice: normalizeOneDecimal(e.target.value) })
                              }
                              sx={{ width: 100 }}
                              inputProps={{ style: { textAlign: "center" } }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <IconButton size="small" color="error" onClick={() => removePurchaseLine(line.lineKey)} aria-label="حذف">
                              <DeleteOutline fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            {superCashier ? (
              <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
                يُسمح بإتمام الشراء حتى مع عجز مؤقت في الخزنة؛ يظهر العجز للمدير لتغذية الصندوق.
              </Typography>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                رصيد الخزنة الحالي:{" "}
                <Box component="span" fontWeight={700} sx={negativeAmountTextSx(newPurchaseTreasury)}>
                  {newPurchaseTreasury.toFixed(2)}
                </Box>{" "}
                شيكل — إجمالي الشراء:{" "}
                <Box component="span" fontWeight={700}>
                  {newPurchaseTotalCost.toFixed(2)}
                </Box>{" "}
                شيكل. رصيد موجب في «balance» = دفعة مسبقة تُخصم من المبلغ قبل الخزنة؛ رصيد سالب = دين سابق يُسدَّد من المبلغ المدفوع (كامل المبلغ يُخصم من الخزنة نقداً).
              </Typography>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2, flexWrap: "wrap", gap: 1, bgcolor: alpha(theme.palette.action.hover, 0.06) }}>
            <Button type="button" onClick={() => setNewPurchaseOpen(false)} sx={{ textTransform: "none" }}>
              إلغاء
            </Button>
            <Button
              type="button"
              variant="contained"
              onClick={() => void confirmNewPurchase()}
              disabled={purchaseSubmitting}
              sx={{ textTransform: "none", fontWeight: 800 }}
            >
              {purchaseSubmitting ? "جاري الحفظ..." : "تأكيد الشراء"}
            </Button>
          </DialogActions>
        </Dialog>

        <Dialog open={Boolean(detailPurchase)} onClose={() => setDetailPurchase(null)} fullWidth maxWidth="md">
          <DialogTitle sx={{ textAlign: "right" }}>
            تفاصيل فاتورة الشراء — {detailPurchase?.id}
          </DialogTitle>
          <DialogContent sx={{ textAlign: "right" }}>
            <Stack sx={{ gap: 1, mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                المنفذ: <b>{detailPurchase?.purchasedBy || "-"}</b>
                {!superCashier ? <> ({detailPurchase?.purchasedByRole || "admin"})</> : null}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                المورد: <b>{detailPurchase?.supplier || "مورد عام"}</b>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                التاريخ والوقت:{" "}
                <b>{detailPurchase?.purchasedAt ? new Date(detailPurchase.purchasedAt).toLocaleString("en-GB") : "-"}</b>
              </Typography>
              <Typography variant="body2" color="text.secondary">
                طريقة الدفع: <b>{detailPurchase?.paymentMethod === "app" ? "تطبيق" : detailPurchase?.paymentMethod === "cash" ? "كاش" : detailPurchase?.paymentMethod || "كاش"}</b>
                {" — "}
                الحالة: <b>{detailPurchase?.status || "مكتمل"}</b>
              </Typography>
            </Stack>
            <TableContainer component={Card} variant="outlined" sx={{ borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.08) }}>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>#</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>الصنف</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>القسم</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>طريقة البيع</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>الكمية</TableCell>
                    {!superCashier ? (
                      <>
                        <TableCell align="center" sx={{ fontWeight: 800 }}>سعر الوحدة</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800 }}>الإجمالي</TableCell>
                      </>
                    ) : null}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(Array.isArray(detailPurchase?.items) && detailPurchase.items.length
                    ? detailPurchase.items
                    : []
                  ).map((it, i) => {
                    const qty = Number(it.qty ?? Number(it.qtyPaid ?? 0) + Number(it.qtyBonus ?? 0));
                    const unit = Number(it.unitPrice ?? it.price ?? 0);
                    const lineTotal = Number(it.total ?? qty * unit);
                    return (
                      <TableRow key={`${it.name}-${i}`}>
                        <TableCell align="center">{i + 1}</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 600 }}>{it.name || "-"}</TableCell>
                        <TableCell align="center">{it.category || "-"}</TableCell>
                        <TableCell align="center">{saleTypeLabelMap[it.saleType] || "-"}</TableCell>
                        <TableCell align="center">
                          {formatOneDecimal(qty)}
                          {Number(it.qtyBonus) > 0 ? (
                            <Typography variant="caption" display="block" color="success.main">
                              منها بونص {formatOneDecimal(it.qtyBonus)}
                            </Typography>
                          ) : null}
                        </TableCell>
                        {!superCashier ? (
                          <>
                            <TableCell align="center">{formatOneDecimal(unit)} شيكل</TableCell>
                            <TableCell align="center" sx={{ fontWeight: 700 }}>{formatOneDecimal(lineTotal)} شيكل</TableCell>
                          </>
                        ) : null}
                      </TableRow>
                    );
                  })}
                  {(!detailPurchase?.items || !detailPurchase.items.length) ? (
                    <TableRow>
                      <TableCell colSpan={superCashier ? 5 : 7} align="center">
                        <Typography variant="body2" color="text.secondary">لا توجد بنود مسجلة لهذه الفاتورة</Typography>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </TableContainer>
            {!superCashier ? (
              <Stack sx={{ mt: 2, alignItems: "flex-end" }}>
                <Typography variant="subtitle1" fontWeight={900}>
                  إجمالي الفاتورة: {formatOneDecimal(detailPurchase?.total)} شيكل
                </Typography>
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                تفاصيل المبالغ متاحة لمدير النظام فقط.
              </Typography>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2, flexWrap: "wrap", gap: 1 }}>
            <Button variant="contained" onClick={() => setDetailPurchase(null)} sx={{ textTransform: "none" }}>
              إغلاق
            </Button>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => setPrintPurchase(detailPurchase)}
              sx={{ textTransform: "none", fontWeight: 800 }}
            >
              طباعة الفاتورة
            </Button>
            {String(detailPurchase?.status || "") !== "مرجع" ? (
              <Button
                variant="outlined"
                color="warning"
                onClick={() => processPurchaseReturn(detailPurchase)}
                sx={{ textTransform: "none", fontWeight: 800 }}
              >
                إرجاع القسيمة
              </Button>
            ) : null}
          </DialogActions>
        </Dialog>
        {printPurchase ? (
          <Box
            sx={{
              display: "none",
              "@media print": {
                display: "block",
                p: 1.25,
                color: "#000",
                direction: "rtl",
                fontFamily: "Arial, sans-serif",
              },
            }}
          >
            <Typography fontWeight={900}>فاتورة شراء</Typography>
            <Typography variant="body2">رقم الفاتورة: {printPurchase.id}</Typography>
            <Typography variant="body2">المورد: {printPurchase.supplier || "مورد عام"}</Typography>
            <Typography variant="body2">
              التاريخ: {printPurchase.purchasedAt ? new Date(printPurchase.purchasedAt).toLocaleString("en-GB") : "-"}
            </Typography>
            <Typography variant="body2">المنفذ: {printPurchase.purchasedBy || "-"}</Typography>
            <Divider sx={{ my: 1 }} />
            {(printPurchase.items || []).map((it, i) => (
              <Typography key={`${it.name}-${i}`} variant="body2">
                {i + 1}. {it.name || "-"} — كمية {formatOneDecimal(Number(it.qty || 0))} — سعر {formatOneDecimal(Number(it.unitPrice || 0))}
              </Typography>
            ))}
            <Divider sx={{ my: 1 }} />
            <Typography fontWeight={800}>الإجمالي: {formatOneDecimal(printPurchase.total)} شيكل</Typography>
          </Box>
        ) : null}
      </Box>
    </AdminLayout>
  );
}
