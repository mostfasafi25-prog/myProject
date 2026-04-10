import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableContainer,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Card,
  Badge,
  Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import DeleteIcon from "@mui/icons-material/Delete";
import CategoryIcon from "@mui/icons-material/Category";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InventoryIcon from "@mui/icons-material/Inventory";
import Payment from "@mui/icons-material/Payment";
import PhoneAndroid from "@mui/icons-material/PhoneAndroid";
import { Axios } from "../../Api/Axios";
import { formatMoney } from "../../utils/currency";

const CATEGORY_COLOR = "#2e7d32";
const CARD_RADIUS = 2;
const ACCORDION_RADIUS = 2;

const UNIT_OPTIONS = [
  { value: "gram", label: "بالوقية / غرام" },
  { value: "kg", label: "كيلو" },
  { value: "piece", label: "حبة" },
  { value: "box", label: "صندوق" },
];

const ProductCard = React.memo(({ product, unitLabel, onAddToCart, onDelete }) => {
  const stock = Number(product.stock) ?? 0;
  const [qty, setQty] = useState(() => (stock > 0 ? Math.min(1, stock) : 1));
  const [price, setPrice] = useState(() => parseFloat(product.purchase_price) || 0);

  const handleAdd = (e) => {
    e.stopPropagation();
    const quantity = Math.max(0.01, parseFloat(qty) || 1);
    const unitPrice = parseFloat(price) || 0;
    if (quantity <= 0 || unitPrice < 0) return;
    onAddToCart(product, quantity, unitPrice);
  };

  return (
    <Card
      sx={{
        p: 1,
        minHeight: 132,
        maxWidth: 128,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        borderRadius: CARD_RADIUS,
        border: `1px solid ${CATEGORY_COLOR}30`,
        boxShadow: "none",
        transition: "all 0.2s ease",
        "&:hover": {
          borderColor: CATEGORY_COLOR,
          boxShadow: "0 4px 12px rgba(46,125,50,0.2)",
          transform: "translateY(-2px)",
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 0.5 }}>
        <Typography
          variant="caption"
          sx={{
            flex: 1,
            fontWeight: 600,
            textAlign: "center",
            fontSize: "0.88rem",
            mb: 0.25,
            color: "white",
            lineHeight: 1.25,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {product.name}
        </Typography>
        {onDelete && (
          <Tooltip title="حذف الصنف">
            <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); onDelete(product.id, product.name); }} sx={{ p: 0.25, minWidth: 0 }}>
              <DeleteIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <Chip
        label={unitLabel}
        size="small"
        sx={{
          alignSelf: "center",
          mb: 0.5,
          bgcolor: `${CATEGORY_COLOR}20`,
          color: CATEGORY_COLOR,
          fontWeight: 600,
          fontSize: "0.62rem",
          height: 20,
        }}
      />
      <Box sx={{ display: "flex", gap: 0.5, mb: 0.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" sx={{ display: "block", mb: 0.25, fontSize: "0.65rem", color: "text.secondary" }}>الكمية</Typography>
          <TextField
            type="number"
            size="small"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            inputProps={{ min: 0.01, step: 0.01, style: { textAlign: "center", padding: "2px 4px", fontSize: "0.7rem" } }}
            sx={{ width: "100%", "& .MuiInputBase-root": { fontSize: "0.7rem", minHeight: 26 } }}
          />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" sx={{ display: "block", mb: 0.25, fontSize: "0.65rem", color: "text.secondary" }}>السعر</Typography>
          <TextField
            type="number"
            size="small"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            inputProps={{ min: 0, step: 0.01, style: { textAlign: "center", padding: "2px 4px", fontSize: "0.7rem" } }}
            sx={{ width: "100%", "& .MuiInputBase-root": { fontSize: "0.7rem", minHeight: 26 } }}
          />
        </Box>
      </Box>
      <Button
        variant="contained"
        size="small"
        fullWidth
        onClick={handleAdd}
        sx={{
          py: 0.35,
          fontSize: "0.72rem",
          fontWeight: 600,
          bgcolor: CATEGORY_COLOR,
          borderRadius: 0.5,
          minHeight: 26,
          "&:hover": { bgcolor: "#1b5e20" },
        }}
      >
        أضف للسلة
      </Button>
    </Card>
  );
});

const Purchases = () => {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [openAddItem, setOpenAddItem] = useState(false);
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [addItemForm, setAddItemForm] = useState({
    name: "",
    unit: "gram",
    category_id: "",
  });
  const [addItemErrors, setAddItemErrors] = useState({});

  const [cart, setCart] = useState([]);
  const [openCart, setOpenCart] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [loadingPurchase, setLoadingPurchase] = useState(false);
  const [purchaseError, setPurchaseError] = useState(null);

  const [recentPurchases, setRecentPurchases] = useState([]);

  // إضافة قسم جديد (مشتريات)
  const [openAddCategory, setOpenAddCategory] = useState(false);
  const [loadingAddCategory, setLoadingAddCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [addCategoryError, setAddCategoryError] = useState(null);

  const [expandedCategories, setExpandedCategories] = useState({});
  const [searchTerm, setSearchTerm] = useState("");

  /** حذف قسم أو صنف: نافذة تأكيد */
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const fetchMainCategories = useCallback(async () => {
    try {
      const res = await Axios.get("categories/main", {
        params: { scope: "purchase" },
      });
      if (res.data?.success) setCategories(res.data.data || []);
    } catch (e) {
      console.error("جلب الأقسام:", e);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await Axios.get("products", {
        params: { per_page: 500, include_inactive: 0, scope: "purchase" },
      });
      if (res.data?.success) setProducts(res.data.data || []);
    } catch (e) {
      console.error("جلب المنتجات:", e);
      setError("تعذر جلب الأصناف");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRecentPurchases = useCallback(async () => {
    try {
      const res = await Axios.get("purchases?per_page=5");
      if (res.data?.success) setRecentPurchases(res.data.data || []);
    } catch (e) {
      console.error("جلب المشتريات:", e);
    }
  }, []);

  useEffect(() => {
    fetchMainCategories();
  }, [fetchMainCategories]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const productsByCategory = React.useMemo(() => {
    const map = {};
    categories.forEach((c) => {
      map[c.name] = [];
    });
    products.forEach((p) => {
      const catName = p.categories?.[0]?.name || p.category?.name || "بدون قسم";
      if (!map[catName]) map[catName] = [];
      map[catName].push(p);
    });
    if (products.some((p) => !(p.categories?.[0] || p.category))) {
      if (!map["بدون قسم"]) map["بدون قسم"] = [];
    }
    return Object.entries(map).sort((a, b) => (a[0] === "بدون قسم" ? 1 : b[0] === "بدون قسم" ? -1 : a[0].localeCompare(b[0])));
  }, [categories, products]);

  const categoriesWithProducts = useMemo(() => {
    return productsByCategory.map(([name, items]) => {
      const realIdFromProduct = items[0]
        ? (items[0].category_id ?? items[0].categories?.[0]?.id ?? items[0].category?.id)
        : null;
      const realIdFromMain = categories.find((c) => c.name === name)?.id ?? null;
      return {
        id: name,
        name,
        products: items,
        count: items.length,
        realId: realIdFromProduct ?? realIdFromMain,
      };
    });
  }, [productsByCategory, categories]);

  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categoriesWithProducts;
    const q = searchTerm.toLowerCase();
    return categoriesWithProducts
      .map((cat) => ({
        ...cat,
        products: cat.products.filter((p) => p.name.toLowerCase().includes(q)),
      }))
      .filter((cat) => cat.products.length > 0);
  }, [categoriesWithProducts, searchTerm]);

  useEffect(() => {
    if (categoriesWithProducts.length > 0 && Object.keys(expandedCategories).length === 0) {
      setExpandedCategories({ [categoriesWithProducts[0].id]: true });
    }
  }, [categoriesWithProducts.length]);

  const handleAccordionChange = useCallback((categoryId) => {
    setExpandedCategories((prev) => ({ ...prev, [categoryId]: !prev[categoryId] }));
  }, []);

  const expandAll = useCallback(() => {
    setExpandedCategories(
      categoriesWithProducts.reduce((acc, cat) => ({ ...acc, [cat.id]: true }), {})
    );
  }, [categoriesWithProducts]);

  const collapseAll = useCallback(() => setExpandedCategories({}), []);

  const handleOpenAddItem = () => {
    setAddItemForm({ name: "", unit: "gram", category_id: categories[0]?.id || "" });
    setAddItemErrors({});
    setOpenAddItem(true);
  };

  const handleCloseAddItem = () => {
    setOpenAddItem(false);
    setAddItemErrors({});
  };

  const handleOpenAddCategory = () => {
    setNewCategoryName("");
    setAddCategoryError(null);
    setOpenAddCategory(true);
  };

  const handleCloseAddCategory = () => {
    setOpenAddCategory(false);
    setNewCategoryName("");
    setAddCategoryError(null);
  };

  const handleAddCategorySubmit = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      setAddCategoryError("اسم القسم مطلوب");
      return;
    }
    setLoadingAddCategory(true);
    setAddCategoryError(null);
    try {
      const res = await Axios.post("categories", {
        name,
        scope: "purchase",
        is_main: true,
        parent_id: null,
        is_active: true,
      });
      if (res.data?.success && res.data?.data) {
        await fetchMainCategories();
        handleCloseAddCategory();
        setAddItemForm((prev) => ({ ...prev, category_id: res.data.data.id }));
      } else {
        setAddCategoryError(res.data?.message || "فشل في إضافة القسم");
      }
    } catch (e) {
      const msg =
        e.response?.data?.errors?.name?.[0] ||
        e.response?.data?.message ||
        "فشل في إضافة القسم";
      setAddCategoryError(msg);
    } finally {
      setLoadingAddCategory(false);
    }
  };

  const handleAddItemSubmit = async () => {
    const err = {};
    if (!addItemForm.name.trim()) err.name = "اسم الصنف مطلوب";
    if (!addItemForm.category_id) err.category_id = "اختر القسم";
    setAddItemErrors(err);
    if (Object.keys(err).length > 0) return;

    setLoadingAdd(true);
    try {
      await Axios.post("products", {
        name: addItemForm.name.trim(),
        unit: addItemForm.unit,
        category_id: addItemForm.category_id,
        categories: [addItemForm.category_id],
        price: 0,
        purchase_price: 0,
        stock: 0,
        is_active: true,
      });
      await fetchProducts();
      handleCloseAddItem();
    } catch (e) {
      setAddItemErrors({
        submit: e.response?.data?.message || e.response?.data?.errors?.name?.[0] || "فشل في إضافة الصنف",
      });
    } finally {
      setLoadingAdd(false);
    }
  };

  const addToCart = (product, quantity, unitPrice) => {
    setCart((prev) => {
      const q = Math.max(0.01, parseFloat(quantity) || 1);
      const p = Math.max(0, parseFloat(unitPrice) || 0);
      if (q <= 0) return prev;
      const unitLabel = UNIT_OPTIONS.find((u) => u.value === (product.unit || "piece"))?.label || "حبة";
      const total = (q * p).toFixed(2);
      const foundIndex = prev.findIndex((c) => c.product_id === product.id);
      const next = foundIndex >= 0 ? prev.filter((_, i) => i !== foundIndex) : prev;
      return [
        ...next,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: q,
          unit_price: p,
          total_price: total,
          unit_label: unitLabel,
        },
      ];
    });
    setOpenCart(true);
  };

  const updateCartItem = (index, field, value) => {
    setCart((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      if (field === "quantity" || field === "unit_price") {
        let q = parseFloat(next[index].quantity) || 0;
        const p = parseFloat(next[index].unit_price) || 0;
        const product = products.find((pr) => pr.id === next[index].product_id);
        const stock = product ? (Number(product.stock) ?? 0) : Infinity;
        if (field === "quantity") q = Math.min(q, stock);
        next[index].quantity = q;
        next[index].total_price = (q * p).toFixed(2);
      }
      return next;
    });
  };

  const removeFromCart = (index) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const cartTotal = cart.reduce((sum, i) => sum + parseFloat(i.total_price || 0), 0);

  const generateInvoiceNumber = () => {
    const d = new Date();
    const y = d.getFullYear().toString().slice(-2);
    const m = (d.getMonth() + 1).toString().padStart(2, "0");
    const day = d.getDate().toString().padStart(2, "0");
    const r = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    return `PUR-${y}${m}${day}-${r}`;
  };

  const handlePurchase = async () => {
    if (cart.length === 0) {
      setPurchaseError("السلة فارغة. أضف أصنافاً ثم اضغط شراء.");
      return;
    }
    const invalid = cart.find(
      (c) => !c.quantity || parseFloat(c.quantity) <= 0 || !c.unit_price || parseFloat(c.unit_price) < 0
    );
    if (invalid) {
      setPurchaseError("تأكد من إدخال الكمية والسعر لكل صنف.");
      return;
    }

    setLoadingPurchase(true);
    setPurchaseError(null);
    try {
      const items = cart.map((c) => ({
        product_id: c.product_id,
        product_name: c.product_name,
        quantity: parseFloat(c.quantity),
        unit_price: parseFloat(c.unit_price),
        total_price: parseFloat(c.total_price),
      }));
      const totalAmount = items.reduce((s, i) => s + i.total_price, 0);
      await Axios.post("purchases", {
        invoice_number: generateInvoiceNumber(),
        items,
        total_amount: totalAmount,
        paid_amount: totalAmount,
        status: "completed",
        purchase_date: new Date().toISOString().split("T")[0],
        notes: "",
        payment_method: paymentMethod,
        treasury_note: `شراء ${items.length} صنف`,
      });
      setCart([]);
      setOpenCart(false);
      await fetchProducts();
      await fetchRecentPurchases();
    } catch (e) {
      setPurchaseError(
        e.response?.data?.message || "فشل في تنفيذ الشراء. تحقق من رصيد الخزنة."
      );
    } finally {
      setLoadingPurchase(false);
    }
  };

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const { type, id } = deleteConfirm;
      const path = type === "category" ? `categories/${id}` : `products/${id}`;
      const res = await Axios.delete(path);
      if (res.data?.success) {
        setDeleteConfirm(null);
        await fetchMainCategories();
        await fetchProducts();
      } else {
        setDeleteError(res.data?.message || "فشل في الحذف");
      }
    } catch (e) {
      setDeleteError(e.response?.data?.message || e.message || "حدث خطأ أثناء الحذف");
    } finally {
      setDeleting(false);
    }
  }, [deleteConfirm, fetchMainCategories, fetchProducts]);

  const formatCurrency = (n) => formatMoney(n);
  const formatDecimal = (n) => (n != null && !isNaN(Number(n)) ? Number(n).toFixed(2) : "0.00");

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, pl: cart.length > 0 ? { xs: 2, sm: "256px" } : undefined, maxWidth: 1600, mx: "auto" }}>
      {/* سلة جانبية */}
      {cart.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            width: 240,
            maxHeight: "55vh",
            minHeight: 180,
            position: "fixed",
            zIndex: 11,
            top: 70,
            left: 12,
            display: "flex",
            flexDirection: "column",
            borderRadius: 2,
            overflow: "hidden",
            direction: "rtl",
            border: "1px solid rgba(46,125,50,0.35)",
          }}
        >
          <Box sx={{ py: 1, px: 1.5, display: "flex", alignItems: "center", justifyContent: "space-between", bgcolor: CATEGORY_COLOR, color: "white" }}>
            <Typography variant="subtitle2" fontWeight="600">السلة</Typography>
            <Badge badgeContent={cart.length} color="error" sx={{ "& .MuiBadge-badge": { fontSize: "0.7rem", minWidth: 18, height: 18 } }}>
              <ShoppingCartIcon sx={{ fontSize: 20 }} />
            </Badge>
          </Box>
          <Box sx={{ flex: 1, overflowY: "auto", overflowX: "hidden", p: 1 }}>
            <TableContainer sx={{ overflowX: "auto", WebkitOverflowScrolling: "touch", maxWidth: "100%" }}>
              <Table size="small" sx={{ tableLayout: "fixed", width: "100%", minWidth: 280 }}>
                <TableBody>
                  {cart.map((row, index) => (
                    <TableRow key={row.product_id} sx={{ "& td": { py: 0.35, px: 0.5, borderBottom: "1px solid", borderColor: "divider" } }}>
                      <TableCell sx={{ fontSize: "0.75rem", width: 72, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={row.product_name}>
                        {row.product_name}
                      </TableCell>
                      <TableCell sx={{ width: 42 }}>
                        <TextField type="number" size="small" value={row.quantity !== undefined && row.quantity !== null && row.quantity !== "" ? Number(row.quantity).toFixed(2) : ""}
                          onChange={(e) => updateCartItem(index, "quantity", e.target.value)}
                          inputProps={{ min: 0.01, step: 0.01, style: { width: 38, padding: "2px 4px", fontSize: "0.75rem", textAlign: "center" } }}
                          sx={{ "& .MuiInputBase-root": { minHeight: 28 } }} />
                      </TableCell>
                      <TableCell sx={{ width: 44 }}>
                        <TextField type="number" size="small" value={row.unit_price !== undefined && row.unit_price !== null && row.unit_price !== "" ? Number(row.unit_price).toFixed(2) : ""}
                          onChange={(e) => updateCartItem(index, "unit_price", e.target.value)}
                          inputProps={{ min: 0, step: 0.01, style: { width: 40, padding: "2px 4px", fontSize: "0.75rem", textAlign: "center" } }}
                          sx={{ "& .MuiInputBase-root": { minHeight: 28 } }} />
                      </TableCell>
                      <TableCell sx={{ width: 48, fontSize: "0.75rem", fontWeight: 600 }}>{formatCurrency(row.total_price)}</TableCell>
                      <TableCell sx={{ width: 28, p: 0.25 }}>
                        <IconButton size="small" color="error" onClick={() => removeFromCart(index)} sx={{ p: 0.25 }}>
                          <DeleteIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
          <Box sx={{ p: 1.25, borderTop: 1, borderColor: "divider" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
              <Typography variant="body2" fontWeight="600">المجموع</Typography>
              <Typography variant="subtitle2" fontWeight="600" sx={{ color: CATEGORY_COLOR }}>{formatCurrency(cartTotal)}</Typography>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>طريقة الدفع</Typography>
            <Box sx={{ display: "flex", gap: 0.75, mb: 1 }}>
              <Button
                size="small"
                variant={paymentMethod === "cash" ? "contained" : "outlined"}
                startIcon={<Payment />}
                onClick={() => setPaymentMethod("cash")}
                fullWidth
                sx={{
                  py: 0.5,
                  fontSize: "0.75rem",
                  bgcolor: paymentMethod === "cash" ? CATEGORY_COLOR : undefined,
                  borderColor: CATEGORY_COLOR,
                  color: paymentMethod === "cash" ? "white" : CATEGORY_COLOR,
                  "&:hover": { bgcolor: paymentMethod === "cash" ? "#1b5e20" : "rgba(46,125,50,0.08)", borderColor: "#1b5e20" },
                }}
              >
                كاش
              </Button>
              <Button
                size="small"
                variant={paymentMethod === "app" ? "contained" : "outlined"}
                startIcon={<PhoneAndroid />}
                onClick={() => setPaymentMethod("app")}
                fullWidth
                sx={{
                  py: 0.5,
                  fontSize: "0.75rem",
                  bgcolor: paymentMethod === "app" ? CATEGORY_COLOR : undefined,
                  borderColor: CATEGORY_COLOR,
                  color: paymentMethod === "app" ? "white" : CATEGORY_COLOR,
                  "&:hover": { bgcolor: paymentMethod === "app" ? "#1b5e20" : "rgba(46,125,50,0.08)", borderColor: "#1b5e20" },
                }}
              >
                تطبيق
              </Button>
            </Box>
            <Button fullWidth variant="contained" size="small" onClick={handlePurchase} disabled={loadingPurchase}
              sx={{ bgcolor: CATEGORY_COLOR, fontWeight: 600, borderRadius: 1.5, py: 0.75, fontSize: "0.8rem", "&:hover": { bgcolor: "#1b5e20" } }}>
              {loadingPurchase ? <CircularProgress size={20} color="inherit" /> : "تنفيذ الشراء"}
            </Button>
            {purchaseError && <Alert severity="error" sx={{ mt: 1, py: 0.5, "& .MuiAlert-message": { fontSize: "0.75rem" } }} onClose={() => setPurchaseError(null)}>{purchaseError}</Alert>}
          </Box>
        </Paper>
      )}


      <Paper elevation={0} sx={{ p: 2.5, mb: 3, borderRadius: 2, border: "1px solid", borderColor: "divider", width: "100%" }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, display: "block" }}>
          اختر الأصناف من الأقسام أدناه، ثم عدّل الكمية والسعر في السلة واضغط «تنفيذ الشراء».
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "auto 1fr auto" },
            gap: 2,
            alignItems: "center",
            width: "100%",
          }}
        >
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
            <Button
              variant="outlined"
              size="medium"
              startIcon={<AddCircleOutlineIcon />}
              onClick={handleOpenAddCategory}
              sx={{ borderColor: CATEGORY_COLOR, color: CATEGORY_COLOR, "&:hover": { borderColor: "#1b5e20", bgcolor: "rgba(46,125,50,0.06)" } }}
            >
              إضافة قسم
            </Button>
            <Button
              variant="contained"
              size="medium"
              startIcon={<AddIcon />}
              onClick={handleOpenAddItem}
              sx={{ bgcolor: CATEGORY_COLOR, "&:hover": { bgcolor: "#1b5e20" } }}
            >
              إضافة صنف
            </Button>
          </Box>
          <TextField
            placeholder="بحث عن صنف..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            fullWidth
            sx={{ minWidth: 0, "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
          />
          <Box sx={{ display: "flex", gap: 1, justifyContent: { xs: "flex-start", sm: "flex-end" } }}>
            <Button size="small" variant="outlined" onClick={expandAll} sx={{ borderRadius: 2 }}>
              فتح الكل
            </Button>
            <Button size="small" variant="outlined" onClick={collapseAll} sx={{ borderRadius: 2 }}>
              غلق الكل
            </Button>
          </Box>
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}><CircularProgress /></Box>
      ) : filteredCategories.length === 0 ? (
        <Paper elevation={0} sx={{ p: 6, textAlign: "center", borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
          <InventoryIcon sx={{ fontSize: 56, color: "text.secondary", mb: 2, opacity: 0.7 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {searchTerm ? "لا توجد نتائج للبحث" : "لا توجد أقسام أو أصناف"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {searchTerm ? "غيّر كلمة البحث." : "أضف قسماً من الزر أعلاه ثم أضف أصنافاً."}
          </Typography>
        </Paper>
      ) : (
        filteredCategories.map((category) => (
          <Accordion
            key={category.id}
            expanded={expandedCategories[category.id] || false}
            onChange={() => handleAccordionChange(category.id)}
            sx={{
              mb: 2,
              borderRadius: `${ACCORDION_RADIUS}px !important`,
              border: "1px solid",
              borderColor: "divider",
              "&:before": { display: "none" },
              overflow: "hidden",
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                minHeight: 64,
                bgcolor: `${CATEGORY_COLOR}08`,
                "&:hover": { bgcolor: `${CATEGORY_COLOR}12` },
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", pr: 2 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: "50%", bgcolor: CATEGORY_COLOR, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CategoryIcon sx={{ color: "white", fontSize: 22 }} />
                  </Box>
                  <Box>
                    <Typography variant="subtitle1" fontWeight="600" sx={{ color: CATEGORY_COLOR }}>{category.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{category.count} صنف</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <Tooltip title="حذف القسم">
                    <IconButton
                      size="small"
                      color="error"
                      disabled={!category.realId}
                      onClick={(e) => { e.stopPropagation(); if (category.realId) setDeleteConfirm({ type: "category", id: category.realId, name: category.name }); }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Chip icon={<InventoryIcon sx={{ fontSize: 14 }} />} label={category.count} size="small" sx={{ bgcolor: `${CATEGORY_COLOR}20`, color: CATEGORY_COLOR, fontWeight: 600 }} />
                </Box>
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 2, pt: 0 }}>
              {category.products.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>لا أصناف في هذا القسم. استخدم «إضافة صنف» واختر هذا القسم.</Typography>
              ) : (
                <Grid container spacing={1}>
                  {category.products.map((p) => {
                    const unitLabel = UNIT_OPTIONS.find((u) => u.value === (p.unit || "piece"))?.label || "حبة";
                    return (
                      <Grid item xs={6} sm={4} md={3} lg={2} xl={1} key={p.id}>
                        <ProductCard
                          product={p}
                          unitLabel={unitLabel}
                          onAddToCart={addToCart}
                          onDelete={(id, name) => setDeleteConfirm({ type: "product", id, name })}
                        />
                      </Grid>
                    );
                  })}
                </Grid>
              )}
            </AccordionDetails>
          </Accordion>
        ))
      )}

      {/* نافذة تأكيد الحذف */}
      <Dialog open={!!deleteConfirm} onClose={() => { if (!deleting) { setDeleteConfirm(null); setDeleteError(null); } }} maxWidth="xs" fullWidth>
        <DialogTitle>تأكيد الحذف</DialogTitle>
        <DialogContent>
          {deleteConfirm && (
            <>
              <Typography>
                هل تريد حذف <strong>{deleteConfirm.name}</strong>؟
                {deleteConfirm.type === "category" && " (القسم)"}
                {deleteConfirm.type === "product" && " (الصنف)"}
              </Typography>
              {deleteConfirm.type === "category" && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>
                  ملاحظة: لا يمكن حذف قسم يحتوي على أصناف. احذف الأصناف من القسم أولاً ثم احذف القسم.
                </Typography>
              )}
            </>
          )}
          {deleteError && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setDeleteError(null)}>{deleteError}</Alert>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => { setDeleteConfirm(null); setDeleteError(null); }} disabled={deleting}>إلغاء</Button>
          <Button variant="contained" color="error" onClick={handleConfirmDelete} disabled={deleting}>
            {deleting ? <CircularProgress size={24} color="inherit" /> : "حذف"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* نافذة إضافة صنف */}
      <Dialog open={openAddItem} onClose={handleCloseAddItem} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 600 }}>إضافة صنف جديد</DialogTitle>
        <DialogContent>
          {addItemErrors.submit && (
            <Alert severity="error" sx={{ mb: 2 }}>{addItemErrors.submit}</Alert>
          )}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}>
            <TextField
              label="اسم الصنف"
              value={addItemForm.name}
              onChange={(e) => setAddItemForm((p) => ({ ...p, name: e.target.value }))}
              fullWidth
              error={!!addItemErrors.name}
              helperText={addItemErrors.name}
              placeholder="مثال: بهار جاج"
              size="small"
            />
            <FormControl fullWidth error={!!addItemErrors.unit} size="small">
              <InputLabel>النوع</InputLabel>
              <Select
                value={addItemForm.unit}
                label="النوع"
                onChange={(e) => setAddItemForm((p) => ({ ...p, unit: e.target.value }))}
              >
                {UNIT_OPTIONS.map((u) => (
                  <MenuItem key={u.value} value={u.value}>{u.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth error={!!addItemErrors.category_id} size="small">
              <InputLabel>القسم</InputLabel>
              <Select
                value={addItemForm.category_id}
                label="القسم"
                onChange={(e) => setAddItemForm((p) => ({ ...p, category_id: e.target.value }))}
              >
                {categories.map((c) => (
                  <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                ))}
              </Select>
              {addItemErrors.category_id && (
                <Typography variant="caption" color="error" sx={{ mt: 0.5, display: "block" }}>{addItemErrors.category_id}</Typography>
              )}
            </FormControl>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseAddItem}>إلغاء</Button>
          <Button variant="contained" onClick={handleAddItemSubmit} disabled={loadingAdd} sx={{ bgcolor: CATEGORY_COLOR, "&:hover": { bgcolor: "#1b5e20" } }}>
            {loadingAdd ? <CircularProgress size={24} /> : "إضافة"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* نافذة إضافة قسم جديد */}
      <Dialog open={openAddCategory} onClose={handleCloseAddCategory} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ fontWeight: 600 }}>قسم مشتريات جديد</DialogTitle>
        <DialogContent>
          {addCategoryError && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setAddCategoryError(null)}>
              {addCategoryError}
            </Alert>
          )}
          <Box sx={{ pt: 1 }}>
            <TextField
              autoFocus
              label="اسم القسم"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddCategorySubmit()}
              fullWidth
              size="small"
              placeholder="مثال: بهارات، لحوم، خضار"
              disabled={loadingAddCategory}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseAddCategory} disabled={loadingAddCategory}>إلغاء</Button>
          <Button
            variant="contained"
            onClick={handleAddCategorySubmit}
            disabled={loadingAddCategory || !newCategoryName.trim()}
            sx={{ bgcolor: CATEGORY_COLOR, "&:hover": { bgcolor: "#1b5e20" } }}
          >
            {loadingAddCategory ? <CircularProgress size={24} /> : "إضافة"}
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  );
};

export default Purchases;
