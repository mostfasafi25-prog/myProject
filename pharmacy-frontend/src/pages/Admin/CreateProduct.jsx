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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Grid,
  Card,
  Divider,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CategoryIcon from "@mui/icons-material/Category";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InventoryIcon from "@mui/icons-material/Inventory";
import LunchDiningIcon from "@mui/icons-material/LunchDining";
import DeleteIcon from "@mui/icons-material/Delete";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import PointOfSaleIcon from "@mui/icons-material/PointOfSale";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import RestaurantIcon from "@mui/icons-material/Restaurant";
import axios from "axios";
import { formatMoney, CURRENCY_LABEL } from "../../utils/currency";

const API_BASE_URL = "http://127.0.0.1:8000/api";
const PAGE_COLOR = "#4CC9F0";
const CARD_RADIUS = 2;
const ACCORDION_RADIUS = 2;

const UNIT_OPTIONS = [
  { value: "gram", label: "غرام" },
  { value: "kg", label: "كيلو" },
  { value: "piece", label: "حبة" },
  { value: "box", label: "صندوق" },
];

/** بطاقة صنف: تعرض الصنف مع كمية للإضافة لمكونات المنتج - شكل قريب من كروت الكاشير */
const RecipeProductCard = React.memo(
  ({ product, unitLabel, onAddToRecipe }) => {
    const stock = Number(product.stock) ?? 0;
    const [qty, setQty] = useState(() => (stock > 0 ? Math.min(1, stock) : 1));
    const handleAdd = (e) => {
      e.stopPropagation();
      const quantity = Math.min(parseFloat(qty) || 0, stock);
      if (quantity <= 0) return;
      onAddToRecipe(product, quantity);
    };
    return (
      <Card
        sx={{
          p: 1,
          minHeight: 128,
          width: "100%",
          maxWidth: 140,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          borderRadius: CARD_RADIUS,
          border: `1px solid ${PAGE_COLOR}40`,
          boxShadow: "none",
          transition: "all 0.2s ease",
          "&:hover": {
            borderColor: PAGE_COLOR,
            boxShadow: `0 4px 12px ${PAGE_COLOR}30`,
            transform: "translateY(-2px)",
          },
        }}
      >
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 700,
            textAlign: "center",
            fontSize: "0.9rem",
            mb: 0.25,
            color: "text.primary",
            lineHeight: 1.25,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {product.name}
        </Typography>
        <Chip
          label={unitLabel}
          size="small"
          sx={{
            alignSelf: "center",
            mb: 0.25,
            bgcolor: `${PAGE_COLOR}25`,
            color: PAGE_COLOR,
            fontWeight: 600,
            fontSize: "0.7rem",
            height: 20,
          }}
        />
        <Typography
          variant="caption"
          sx={{
            fontSize: "0.7rem",
            color: "text.secondary",
            textAlign: "center",
          }}
        >
          متوفر: {(Number(product.stock) ?? 0).toFixed(2)}
        </Typography>
        <Box sx={{ display: "flex", gap: 0.5, mb: 0.25 }}>
          <TextField
            type="number"
            size="small"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            inputProps={{
              min: 0.001,
              max: stock,
              step: 0.001,
              style: {
                textAlign: "center",
                padding: "2px 4px",
                fontSize: "0.8rem",
              },
            }}
            sx={{
              flex: 1,
              "& .MuiInputBase-root": { fontSize: "0.8rem", minHeight: 28 },
            }}
          />
        </Box>
        <Button
          variant="contained"
          size="small"
          fullWidth
          onClick={handleAdd}
          disabled={stock <= 0}
          sx={{
            py: 0.5,
            fontSize: "0.8rem",
            fontWeight: 700,
            bgcolor: PAGE_COLOR,
            borderRadius: 0.75,
            minHeight: 32,
            "&:hover": { bgcolor: "#0097BD" },
          }}
        >
          أضف للمكونات
        </Button>
      </Card>
    );
  },
);

export default function SalesManagement() {
  const [tabValue, setTabValue] = useState(0);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState({});

  /** أقسام الكاشير (المبيعات) - تُجلب عند الفتح وتُحدَّث بعد إضافة قسم */
  const [salesCategories, setSalesCategories] = useState([]);
  const [openAddSalesCategory, setOpenAddSalesCategory] = useState(false);
  const [newSalesCategoryName, setNewSalesCategoryName] = useState("");
  const [loadingAddCategory, setLoadingAddCategory] = useState(false);
  const [addCategoryError, setAddCategoryError] = useState(null);

  /** مكونات المنتج الحالي (قبل إنشاء المنتج) */
  const [recipe, setRecipe] = useState([]);

  /** نافذة إنشاء المنتج */
  const [createDialog, setCreateDialog] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createCategoryId, setCreateCategoryId] = useState("");
  const [createSalePrice, setCreateSalePrice] = useState("");
  const [createImage, setCreateImage] = useState(null);
  const [loadingCreate, setLoadingCreate] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [createSuccess, setCreateSuccess] = useState(null);
  /** أحجام/خيارات المنتج (صحن كبير، صحن صغير...) - كل واحد له سعره */
  const [createOptions, setCreateOptions] = useState([]);
  /** نسبة ربح % لحساب السعر المقترح من تكلفة المكونات */
  const [createMarginPercent, setCreateMarginPercent] = useState(30);

  /** حذف: نافذة تأكيد { type: 'category'|'meal'|'product', id, name } */
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

  /** مخزون المنتجات (للتبويب مخزون المنتجات) */
  const [meals, setMeals] = useState([]);
  const [loadingMeals, setLoadingMeals] = useState(false);

  const formatCurrency = (n) => formatMoney(n);
  const formatDecimal = (n) =>
    n != null && !isNaN(Number(n)) ? Number(n).toFixed(2) : "0.00";

  const fetchMeals = useCallback(async () => {
    try {
      setLoadingMeals(true);
      const res = await axios.get(`${API_BASE_URL}/meals/all-with-details`, {
        params: { limit: 500 },
      });
      if (res.data?.success && res.data?.data?.meals)
        setMeals(res.data.data.meals);
      else setMeals([]);
    } catch (e) {
      console.error("جلب المنتجات:", e);
      setMeals([]);
    } finally {
      setLoadingMeals(false);
    }
  }, []);

  const mealsByCategory = useMemo(() => {
    const map = {};
    meals.forEach((m) => {
      const catName = m.category?.name || "بدون قسم";
      if (!map[catName]) map[catName] = [];
      map[catName].push(m);
    });
    return Object.entries(map).sort((a, b) =>
      a[0] === "بدون قسم"
        ? 1
        : b[0] === "بدون قسم"
          ? -1
          : a[0].localeCompare(b[0]),
    );
  }, [meals]);

  useEffect(() => {
    if (tabValue === 2) fetchMeals();
  }, [tabValue, fetchMeals]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/categories/main`, {
        params: { scope: "purchase" },
      });
      if (res.data?.success) setCategories(res.data.data || []);
    } catch (e) {
      console.error("جلب الأقسام:", e);
    }
  }, []);

  const productsByCategory = useMemo(() => {
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
    return Object.entries(map).sort((a, b) =>
      a[0] === "بدون قسم"
        ? 1
        : b[0] === "بدون قسم"
          ? -1
          : a[0].localeCompare(b[0]),
    );
  }, [categories, products]);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE_URL}/products`, {
        params: { per_page: 500, scope: "purchase" },
      });
      if (res.data?.success) setProducts(res.data.data || res.data?.data || []);
      else setProducts([]);
    } catch (e) {
      console.error("جلب الأصناف:", e);
      setError("تعذر جلب الأصناف");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSalesCategories = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/categories/main`, {
        params: { scope: "sales" },
      });
      if (res.data?.success) setSalesCategories(res.data.data || []);
    } catch (e) {
      console.error("جلب أقسام المبيعات:", e);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    fetchSalesCategories();
  }, [fetchSalesCategories]);

  const categoriesWithProducts = useMemo(() => {
    return productsByCategory.map(([name, items]) => ({
      id: name,
      name,
      products: items,
      count: items.length,
    }));
  }, [productsByCategory]);

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
    if (
      categoriesWithProducts.length > 0 &&
      Object.keys(expandedCategories).length === 0
    ) {
      setExpandedCategories({ [categoriesWithProducts[0].id]: true });
    }
  }, [categoriesWithProducts.length]);

  const handleAccordionChange = useCallback((categoryId) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  }, []);

  const expandAll = useCallback(() => {
    setExpandedCategories(
      categoriesWithProducts.reduce(
        (acc, cat) => ({ ...acc, [cat.id]: true }),
        {},
      ),
    );
  }, [categoriesWithProducts]);

  const collapseAll = useCallback(() => setExpandedCategories({}), []);

  const handleOpenAddSalesCategory = () => {
    setNewSalesCategoryName("");
    setAddCategoryError(null);
    setOpenAddSalesCategory(true);
  };

  const handleCloseAddSalesCategory = () => {
    setOpenAddSalesCategory(false);
    setNewSalesCategoryName("");
    setAddCategoryError(null);
  };

  const handleAddSalesCategorySubmit = async () => {
    const name = newSalesCategoryName.trim();
    if (!name) {
      setAddCategoryError("اسم القسم مطلوب");
      return;
    }
    setLoadingAddCategory(true);
    setAddCategoryError(null);
    try {
      const res = await axios.post(`${API_BASE_URL}/categories`, {
        name,
        scope: "sales",
        is_main: true,
        parent_id: null,
        is_active: true,
      });
      if (res.data?.success) {
        await fetchSalesCategories();
        handleCloseAddSalesCategory();
      } else {
        setAddCategoryError(res.data?.message || "فشل في إضافة القسم");
      }
    } catch (e) {
      setAddCategoryError(
        e.response?.data?.message ||
          e.response?.data?.errors?.name?.[0] ||
          "فشل في إضافة القسم (ربما الاسم مستخدم مسبقاً)",
      );
    } finally {
      setLoadingAddCategory(false);
    }
  };

  const addToRecipe = useCallback((product, quantity) => {
    const stock = Number(product.stock) ?? 0;
    setRecipe((prev) => {
      const existing = prev.find((r) => r.product_id === product.id);
      const currentTotal = existing ? existing.quantity : 0;
      const available = Math.max(0, stock - currentTotal);
      const toAdd = Math.min(quantity, available);
      if (toAdd <= 0) return prev;
      if (existing) {
        return prev.map((r) =>
          r.product_id === product.id
            ? { ...r, quantity: r.quantity + toAdd }
            : r,
        );
      }
      return [...prev, { product_id: product.id, product, quantity: toAdd }];
    });
  }, []);

  const removeFromRecipe = useCallback((productId) => {
    setRecipe((prev) => prev.filter((r) => r.product_id !== productId));
  }, []);

  /** تحديث كمية صنف في السلة (من واجهة السلة) - لا تتجاوز الكمية المتوفرة */
  const updateRecipeQuantity = useCallback((productId, newQuantity) => {
    const q = parseFloat(newQuantity);
    if (isNaN(q) || q <= 0) {
      setRecipe((prev) => prev.filter((r) => r.product_id !== productId));
      return;
    }
    setRecipe((prev) =>
      prev.map((r) => {
        if (r.product_id !== productId) return r;
        const stock = Number(r.product?.stock) ?? 0;
        const capped = Math.min(q, stock);
        return { ...r, quantity: capped };
      }),
    );
  }, []);

  const openCreateDialog = useCallback(() => {
    if (recipe.length === 0) return;
    setCreateName("");
    setCreateCategoryId(salesCategories[0]?.id || "");
    setCreateSalePrice("");
    setCreateError(null);
    setCreateSuccess(null);
    setCreateOptions([]);
    fetchSalesCategories();
    setCreateDialog(true);
  }, [recipe.length, salesCategories, fetchSalesCategories]);

  const closeCreateDialog = useCallback(() => {
    setCreateDialog(false);
    setCreateError(null);
    setCreateName("");
    setCreateCategoryId(salesCategories[0]?.id || "");
    setCreateSalePrice("");
    setCreateImage(null);
    setCreateOptions([]);
  }, [salesCategories]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    setCreateError(null);
    try {
      const { type, id, name } = deleteConfirm;
      let url = "";
      if (type === "category") url = `${API_BASE_URL}/categories/${id}`;
      else if (type === "meal") url = `${API_BASE_URL}/meals/${id}`;
      else if (type === "product") url = `${API_BASE_URL}/products/${id}`;
      else return;
      const res = await axios.delete(url);
      if (res.data?.success) {
        setDeleteConfirm(null);
        const msg =
          res.data?.message ||
          (type === "product"
            ? "تم حذف الصنف. تم استرجاع الكمية من المخزون وإرجاع المبلغ للخزنة."
            : "تم الحذف بنجاح");
        setCreateSuccess(msg);
        setTimeout(() => setCreateSuccess(null), 6000);
        if (type === "category") fetchSalesCategories();
        else if (type === "meal") fetchMeals();
        else {
          fetchProducts();
          fetchCategories();
        }
      } else {
        const reasons = res.data?.reasons;
        setCreateError(
          reasons && Array.isArray(reasons)
            ? reasons.join(" ")
            : res.data?.message || "فشل في الحذف",
        );
      }
    } catch (e) {
      const data = e.response?.data;
      const reasons = data?.reasons;
      const msg =
        reasons && Array.isArray(reasons)
          ? reasons.join(" ")
          : data?.message || e.message || "حدث خطأ أثناء الحذف";
      setCreateError(msg);
    } finally {
      setDeleting(false);
    }
  }, [
    deleteConfirm,
    fetchSalesCategories,
    fetchMeals,
    fetchProducts,
    fetchCategories,
  ]);

  /** تكلفة المكونات = مجموع (سعر تكلفة الصنف × الكمية) */
  const ingredientsCost = useMemo(() => {
    return recipe.reduce((sum, r) => {
      const unitCost =
        Number(r.product?.cost_price ?? r.product?.purchase_price ?? 0) || 0;
      const qty = Number(r.quantity) || 0;
      return sum + unitCost * qty;
    }, 0);
  }, [recipe]);

  /** السعر المقترح = تكلفة المكونات + نسبة ربح */
  const suggestedSalePrice = useMemo(() => {
    const margin = Number(createMarginPercent) || 0;
    return ingredientsCost * (1 + margin / 100);
  }, [ingredientsCost, createMarginPercent]);

  const submitCreateMeal = useCallback(async () => {
    setCreateError(null);
    if (!createName.trim()) {
      setCreateError("اسم المنتج مطلوب");
      return;
    }
    if (!createCategoryId) {
      setCreateError("اختر قسم الكاشير (قسم المبيعات)");
      return;
    }
    const hasOptions =
      createOptions.filter(
        (o) =>
          o.name.trim() &&
          !isNaN(parseFloat(o.price)) &&
          parseFloat(o.price) >= 0,
      ).length > 0;
    const salePrice = hasOptions ? 0 : parseFloat(createSalePrice);
    if (!hasOptions && (isNaN(salePrice) || salePrice < 0)) {
      setCreateError("أدخل سعر بيع صحيح أو أضف أحجاماً بأسعار");
      return;
    }
    const ingredients = recipe.map((r) => ({
      product_id: r.product_id,
      quantity: parseFloat(r.quantity),
    }));
    const optionsPayload = hasOptions
      ? createOptions
          .filter(
            (o) =>
              o.name.trim() &&
              !isNaN(parseFloat(o.price)) &&
              parseFloat(o.price) >= 0,
          )
          .map((o) => ({ name: o.name.trim(), price: parseFloat(o.price) }))
      : [];
    setLoadingCreate(true);
    try {
      const formData = new FormData();
      formData.append("name", createName.trim());
      formData.append("category_id", createCategoryId);
      formData.append("sale_price", salePrice);
      formData.append("ingredients", JSON.stringify(ingredients));
      if (optionsPayload.length > 0) {
        formData.append("options", JSON.stringify(optionsPayload));
      }
      if (createImage) {
        formData.append("image", createImage);
      }

      const res = await axios.post(
        `${API_BASE_URL}/meals/create-from-products`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );
      if (res.data?.success) {
        const meal = res.data?.data?.meal;
        const costStored =
          meal?.cost_price != null
            ? formatCurrency(meal.cost_price)
            : formatCurrency(ingredientsCost);
        const saleStored =
          meal?.sale_price != null
            ? formatCurrency(meal.sale_price)
            : formatCurrency(createSalePrice);
        setCreateSuccess(
          meal
            ? `تم إنشاء المنتج مع مكوناته. التكلفة المخزنة = ${costStored}، سعر البيع = ${saleStored}. يظهر في الكاشير.`
            : res.data.message ||
                "تم إنشاء المنتج بنجاح. تم تخزين المنتج مع المكونات ويظهر في الكاشير بسعر ثابت.",
        );
        setRecipe([]);
        setTimeout(() => {
          closeCreateDialog();
          setCreateSuccess(null);
        }, 1500);
      } else {
        setCreateError(res.data?.message || "فشل في إنشاء المنتج");
      }
    } catch (e) {
      const msg =
        e.response?.data?.message ||
        (e.response?.data?.errors &&
          Object.values(e.response.data.errors).flat().join(" ")) ||
        "حدث خطأ أثناء إنشاء المنتج";
      setCreateError(msg);
    } finally {
      setLoadingCreate(false);
    }
  }, [
    createName,
    createCategoryId,
    createSalePrice,
    createOptions,
    recipe,
    closeCreateDialog,
  ]);

  return (
    <Box sx={{ width: "100%", minHeight: "100vh" }}>
      <Box sx={{ p: 2, maxWidth: 1400, mx: "auto", width: "100%" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
          <PointOfSaleIcon sx={{ color: PAGE_COLOR, fontSize: 32 }} />
          <Typography variant="h5" fontWeight="700" sx={{ color: PAGE_COLOR }}>
            إدارة المبيعات
          </Typography>
        </Box>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 2, display: "block" }}
        >
          إدارة أقسام الكاشير، إنشاء المنتجات، وعرض مخزون المنتجات والأصناف.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}
        {createSuccess && (
          <Alert
            severity="success"
            sx={{ mb: 2 }}
            onClose={() => setCreateSuccess(null)}
          >
            {createSuccess}
          </Alert>
        )}

        <Paper
          elevation={0}
          sx={{
            width: "100%",
            mb: 3,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            overflow: "hidden",
            bgcolor: "transparent",
          }}
        >
          <Tabs
            value={tabValue}
            onChange={(_, v) => setTabValue(v)}
            variant="fullWidth"
            sx={{
              minHeight: 56,
              "& .MuiTabs-flexContainer": {
                justifyContent: "center",
                gap: 0,
              },
              "& .MuiTab-root": {
                fontWeight: 600,
                textTransform: "none",
                fontSize: "1rem",
                minHeight: 56,
                py: 1.5,
              },
              "& .MuiTabs-indicator": {
                bgcolor: PAGE_COLOR,
                height: 3,
                borderRadius: "3px 3px 0 0",
              },
              "& .Mui-selected": {
                color: PAGE_COLOR,
              },
            }}
          >
            <Tab
              icon={<LunchDiningIcon />}
              iconPosition="start"
              label="إنشاء منتج"
            />
            <Tab
              icon={<AddCircleOutlineIcon />}
              iconPosition="start"
              label="إنشاء قسم بالكاشير"
            />
            <Tab
              icon={<RestaurantIcon />}
              iconPosition="start"
              label="مخزون المنتجات"
            />
            <Tab
              icon={<WarehouseIcon />}
              iconPosition="start"
              label="مخزون الأصناف"
            />
          </Tabs>
        </Paper>

        {tabValue === 0 && (
          <>
            {recipe.length > 0 && (
              <Paper
                sx={{
                  width: 300,
                  height: "85vh",
                  position: "fixed",
                  zIndex: 11,
                  top: 70,
                  left: 10,
                  display: "flex",
                  flexDirection: "column",
                  borderRadius: 3,
                  boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                  overflow: "hidden",
                  direction: "rtl",
                  border: "1px solid",
                  borderColor: `${PAGE_COLOR}50`,
                  bgcolor: "transparent",
                }}
              >
                <Box
                  sx={{
                    bgcolor: PAGE_COLOR,
                    color: "white",
                    py: 1.5,
                    px: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Typography variant="subtitle1" fontWeight="bold">
                    مكونات المنتج
                  </Typography>
                  <Chip
                    label={recipe.length}
                    size="small"
                    sx={{ color: "white", bgcolor: "rgba(255,255,255,0.25)" }}
                  />
                </Box>
                <Box sx={{ flex: 1, overflowY: "auto", p: 1.5 }}>
                  {recipe.map((r, index) => {
                    const unitCost =
                      Number(
                        r.product?.cost_price ?? r.product?.purchase_price ?? 0,
                      ) || 0;
                    const qty = Number(r.quantity) || 0;
                    const lineTotal = (unitCost * qty).toFixed(2);
                    return (
                      <Box key={r.product_id}>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            p: 1,
                            borderRadius: 1,
                          }}
                        >
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography
                              variant="body2"
                              fontWeight="bold"
                              sx={{ color: PAGE_COLOR }}
                            >
                              {r.product?.name || `صنف #${r.product_id}`}
                            </Typography>
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1.5,
                                mt: 0.5,
                                flexWrap: "wrap",
                              }}
                            >
                              <Box
                                sx={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 0.5,
                                }}
                              >
                                <Typography
                                  variant="caption"
                                  sx={{
                                    fontSize: "11px",
                                    color: "text.secondary",
                                  }}
                                >
                                  الكمية:
                                </Typography>
                                <TextField
                                  size="small"
                                  type="number"
                                  value={r.quantity}
                                  onChange={(e) =>
                                    updateRecipeQuantity(
                                      r.product_id,
                                      e.target.value,
                                    )
                                  }
                                  inputProps={{
                                    min: 0.01,
                                    step: 0.01,
                                    style: {
                                      width: 48,
                                      padding: "2px 4px",
                                      fontSize: "12px",
                                      textAlign: "center",
                                    },
                                  }}
                                  sx={{
                                    "& .MuiInputBase-root": { height: 28 },
                                  }}
                                />
                              </Box>
                              <Typography
                                variant="caption"
                                sx={{
                                  fontSize: "11px",
                                  color: "text.secondary",
                                }}
                              >
                                سعر الوحدة: {formatMoney(unitCost)}
                              </Typography>
                              <Typography
                                variant="caption"
                                fontWeight="600"
                                sx={{ color: "warning.main" }}
                              >
                                الإجمالي: {formatMoney(lineTotal)}
                              </Typography>
                            </Box>
                          </Box>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => removeFromRecipe(r.product_id)}
                            sx={{ "& .MuiSvgIcon-root": { fontSize: 18 } }}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                        {index < recipe.length - 1 && (
                          <Divider sx={{ my: 0.5 }} />
                        )}
                      </Box>
                    );
                  })}
                </Box>
                <Box sx={{ p: 2, borderTop: `2px solid ${PAGE_COLOR}` }}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      mb: 1.5,
                    }}
                  >
                    <Typography variant="body2">عدد المكونات</Typography>
                    <Typography fontWeight="bold">{recipe.length}</Typography>
                  </Box>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      mb: 1.5,
                    }}
                  >
                    <Typography variant="body2">تكلفة المكونات</Typography>
                    <Typography fontWeight="bold" color="warning.main">
                      {formatCurrency(ingredientsCost)}
                    </Typography>
                  </Box>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<LunchDiningIcon />}
                    onClick={openCreateDialog}
                    disabled={recipe.length === 0}
                    sx={{
                      bgcolor: PAGE_COLOR,
                      fontWeight: "bold",
                      borderRadius: 2,
                      py: 1.2,
                      "&:hover": { bgcolor: "#0097BD" },
                    }}
                  >
                    إنشاء منتج من هذه المكونات
                  </Button>
                </Box>
              </Paper>
            )}

            <Box sx={{ pl: recipe.length > 0 ? "320px" : 0, mt: 3, mb: 0 }}>
              <Paper
                elevation={0}
                sx={{
                  width: "100%",
                  p: 2,
                  mb: 2,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "transparent",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1.5,
                    alignItems: "center",
                  }}
                >
                  <TextField
                    placeholder="بحث عن صنف..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    size="small"
                    sx={{
                      width: { xs: "100%", sm: 260 },
                      "& .MuiOutlinedInput-root": { borderRadius: 2 },
                    }}
                  />
                  {filteredCategories.length > 0 && !searchTerm && (
                    <>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={expandAll}
                        sx={{ borderRadius: 2 }}
                      >
                        فتح الكل
                      </Button>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={collapseAll}
                        sx={{ borderRadius: 2 }}
                      >
                        غلق الكل
                      </Button>
                    </>
                  )}
                </Box>
              </Paper>

              {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                  <CircularProgress />
                </Box>
              ) : filteredCategories.length === 0 ? (
                <Paper
                  elevation={0}
                  sx={{
                    p: 6,
                    textAlign: "center",
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    bgcolor: "transparent",
                  }}
                >
                  <InventoryIcon
                    sx={{
                      fontSize: 56,
                      color: "text.secondary",
                      mb: 2,
                      opacity: 0.7,
                    }}
                  />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    {searchTerm
                      ? "لا توجد نتائج للبحث"
                      : "لا توجد أقسام أو أصناف"}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {searchTerm
                      ? "غيّر كلمة البحث."
                      : "أضف أقساماً وأصنافاً من صفحة المشتريات أولاً."}
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
                        bgcolor: `${PAGE_COLOR}12`,
                        "&:hover": { bgcolor: `${PAGE_COLOR}18` },
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          width: "100%",
                          pr: 2,
                        }}
                      >
                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 2 }}
                        >
                          <Box
                            sx={{
                              width: 44,
                              height: 44,
                              borderRadius: "50%",
                              bgcolor: PAGE_COLOR,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <CategoryIcon
                              sx={{ color: "white", fontSize: 22 }}
                            />
                          </Box>
                          <Box>
                            <Typography
                              variant="subtitle1"
                              fontWeight="600"
                              sx={{ color: PAGE_COLOR }}
                            >
                              {category.name}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {category.count} صنف
                            </Typography>
                          </Box>
                        </Box>
                        <Chip
                          icon={<InventoryIcon sx={{ fontSize: 14 }} />}
                          label={category.count}
                          size="small"
                          sx={{
                            bgcolor: `${PAGE_COLOR}25`,
                            color: PAGE_COLOR,
                            fontWeight: 600,
                          }}
                        />
                      </Box>
                    </AccordionSummary>
                    <AccordionDetails sx={{ p: 2, pt: 0 }}>
                      {category.products.length === 0 ? (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{ py: 2 }}
                        >
                          لا أصناف في هذا القسم.
                        </Typography>
                      ) : (
                        <Grid container spacing={2} sx={{ width: "100%" }}>
                          {category.products.map((p) => {
                            const unitLabel =
                              UNIT_OPTIONS.find(
                                (u) => u.value === (p.unit || "piece"),
                              )?.label || "حبة";
                            return (
                              <Grid
                                size={{ xs: 12, sm: 6, md: 4, lg: 3, xl: 2 }}
                                key={p.id}
                              >
                                <RecipeProductCard
                                  product={p}
                                  unitLabel={unitLabel}
                                  onAddToRecipe={addToRecipe}
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
            </Box>
          </>
        )}

        {tabValue === 1 && (
          <Paper
            elevation={0}
            sx={{
              p: 2,
              mb: 2,
              borderRadius: 2,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "transparent",
            }}
          >
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
                mb: 2,
              }}
            >
              <Typography
                variant="subtitle1"
                fontWeight="600"
                sx={{ color: PAGE_COLOR }}
              >
                أقسام الكاشير
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddCircleOutlineIcon />}
                onClick={handleOpenAddSalesCategory}
                sx={{ bgcolor: PAGE_COLOR, "&:hover": { bgcolor: "#0097BD" } }}
              >
                إنشاء قسم
              </Button>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              الأقسام التي تظهر في صفحة الكاشير. عند إنشاء منتج تختار أحد هذه
              الأقسام فيُدرج الصنف تحته في الكاشير.
            </Typography>
            {salesCategories.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                لا توجد أقسام للكاشير بعد. اضغط «إنشاء قسم» لإضافة قسم (مثل:
                لحوم، عصائر، سلطات).
              </Typography>
            ) : (
              <Grid container spacing={2} sx={{ width: "100%" }}>
                {salesCategories.map((c) => (
                  <Grid
                    size={{ xs: 12, sm: 6, md: 4, lg: 3, xl: 2 }}
                    key={c.id}
                  >
                    <Paper
                      elevation={0}
                      sx={{
                        width: "100%",
                        aspectRatio: "1",
                        minHeight: 120,
                        borderRadius: 2,
                        border: "1px solid",
                        borderColor: "divider",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        position: "relative",
                        p: 2,
                        bgcolor: "background.paper",
                        transition: "all 0.2s ease",
                        "&:hover": {
                          borderColor: PAGE_COLOR,
                          boxShadow: `0 4px 12px ${PAGE_COLOR}25`,
                        },
                      }}
                    >
                      <CategoryIcon
                        sx={{ fontSize: 36, color: PAGE_COLOR, mb: 1 }}
                      />
                      <Typography
                        variant="subtitle1"
                        fontWeight="600"
                        sx={{ color: "text.primary", textAlign: "center" }}
                      >
                        {c.name}
                      </Typography>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() =>
                          setDeleteConfirm({
                            type: "category",
                            id: c.id,
                            name: c.name,
                          })
                        }
                        sx={{ position: "absolute", top: 8, left: 8 }}
                        title="حذف القسم"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            )}
          </Paper>
        )}

        {tabValue === 2 && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              عرض المنتجات المجهزة في جدول.
            </Typography>
            {loadingMeals ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                <CircularProgress />
              </Box>
            ) : meals.length === 0 ? (
              <Paper
                elevation={0}
                sx={{
                  p: 6,
                  textAlign: "center",
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "transparent",
                }}
              >
                <RestaurantIcon
                  sx={{
                    fontSize: 56,
                    color: "text.secondary",
                    mb: 2,
                    opacity: 0.7,
                  }}
                />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  لا توجد منتجات
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  أنشئ منتجات من تبويب «إنشاء منتج».
                </Typography>
              </Paper>
            ) : (
              <TableContainer
                component={Paper}
                elevation={0}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  bgcolor: "transparent",
                }}
              >
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ bgcolor: `${PAGE_COLOR}18` }}>
                      <TableCell sx={{ fontWeight: "bold", color: PAGE_COLOR }}>
                        اسم المنتج
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold", color: PAGE_COLOR }}>
                        القسم
                      </TableCell>
                      <TableCell
                        sx={{ fontWeight: "bold", color: PAGE_COLOR }}
                        align="left"
                      >
                        سعر البيع ({CURRENCY_LABEL})
                      </TableCell>
                      <TableCell
                        sx={{ fontWeight: "bold", color: PAGE_COLOR }}
                        align="left"
                      >
                        الكمية
                      </TableCell>
                      <TableCell
                        sx={{ fontWeight: "bold", color: PAGE_COLOR }}
                        align="center"
                        width={80}
                      >
                        حذف
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {meals.map((m) => (
                      <TableRow
                        key={m.id}
                        hover
                        sx={{
                          "&:nth-of-type(even)": { bgcolor: "action.hover" },
                        }}
                      >
                        <TableCell>{m.name}</TableCell>
                        <TableCell>{m.category?.name || "—"}</TableCell>
                        <TableCell align="left">
                          {m.sale_price != null
                            ? formatMoney(m.sale_price)
                            : "—"}
                        </TableCell>
                        <TableCell align="left">
                          {m.quantity != null
                            ? Number(m.quantity).toFixed(2)
                            : "—"}
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="حذف المنتج">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() =>
                                setDeleteConfirm({
                                  type: "meal",
                                  id: m.id,
                                  name: m.name,
                                })
                              }
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}

        {tabValue === 3 && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              عرض أصناف المشتريات والمخزون في جدول.
            </Typography>
            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
                <CircularProgress />
              </Box>
            ) : products.length === 0 ? (
              <Paper
                elevation={0}
                sx={{
                  p: 6,
                  textAlign: "center",
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "transparent",
                }}
              >
                <WarehouseIcon
                  sx={{
                    fontSize: 56,
                    color: "text.secondary",
                    mb: 2,
                    opacity: 0.7,
                  }}
                />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  لا توجد أصناف في المخزون
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  أضف أصنافاً من صفحة المشتريات.
                </Typography>
              </Paper>
            ) : (
              <TableContainer
                component={Paper}
                elevation={0}
                sx={{
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  bgcolor: "transparent",
                }}
              >
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow sx={{ bgcolor: `${PAGE_COLOR}18` }}>
                      <TableCell sx={{ fontWeight: "bold", color: PAGE_COLOR }}>
                        اسم الصنف
                      </TableCell>
                      <TableCell sx={{ fontWeight: "bold", color: PAGE_COLOR }}>
                        القسم
                      </TableCell>
                      <TableCell
                        sx={{ fontWeight: "bold", color: PAGE_COLOR }}
                        align="left"
                      >
                        الوحدة
                      </TableCell>
                      <TableCell
                        sx={{ fontWeight: "bold", color: PAGE_COLOR }}
                        align="left"
                      >
                        الكمية
                      </TableCell>
                      <TableCell
                        sx={{ fontWeight: "bold", color: PAGE_COLOR }}
                        align="left"
                      >
                        السعر ({CURRENCY_LABEL})
                      </TableCell>
                      <TableCell
                        sx={{ fontWeight: "bold", color: PAGE_COLOR }}
                        align="center"
                        width={80}
                      >
                        حذف
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {categoriesWithProducts.flatMap((cat) =>
                      cat.products.map((p) => {
                        const unitLabel =
                          UNIT_OPTIONS.find(
                            (u) => u.value === (p.unit || "piece"),
                          )?.label || "حبة";
                        const price =
                          p.purchase_price != null
                            ? p.purchase_price
                            : p.cost_price;
                        return (
                          <TableRow
                            key={p.id}
                            hover
                            sx={{
                              "&:nth-of-type(even)": {
                                bgcolor: "action.hover",
                              },
                            }}
                          >
                            <TableCell>{p.name}</TableCell>
                            <TableCell>{cat.name}</TableCell>
                            <TableCell align="left">{unitLabel}</TableCell>
                            <TableCell align="left">
                              {formatDecimal(p.stock)}
                            </TableCell>
                            <TableCell align="left">
                              {price != null ? formatMoney(price) : "—"}
                            </TableCell>
                            <TableCell align="center">
                              <Tooltip title="حذف الصنف">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() =>
                                    setDeleteConfirm({
                                      type: "product",
                                      id: p.id,
                                      name: p.name,
                                    })
                                  }
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          </TableRow>
                        );
                      }),
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </>
        )}

        {/* نافذة إنشاء المنتج: اسم، قسم الكاشير، سعر البيع */}
        <Dialog
          open={createDialog}
          onClose={closeCreateDialog}
          maxWidth="sm"
          fullWidth
          PaperProps={{ sx: { borderRadius: 2 } }}
        >
          <DialogTitle sx={{ fontWeight: 600 }}>إنشاء منتج</DialogTitle>
          <DialogContent>
            {createError && (
              <Alert
                severity="error"
                sx={{ mb: 2 }}
                onClose={() => setCreateError(null)}
              >
                {createError}
              </Alert>
            )}
            {createSuccess && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {createSuccess}
              </Alert>
            )}
            <Box
              sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1 }}
            >
              <TextField
                label="اسم المنتج"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                fullWidth
                size="small"
                placeholder="مثال: شاورما لحم"
              />
              <FormControl fullWidth size="small" required>
                <InputLabel>قسم الكاشير (قسم المبيعات)</InputLabel>
                <Select
                  value={createCategoryId}
                  label="قسم الكاشير (قسم المبيعات)"
                  onChange={(e) => setCreateCategoryId(e.target.value)}
                >
                  {salesCategories.map((c) => (
                    <MenuItem key={c.id} value={c.id}>
                      {c.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  flexWrap: "wrap",
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  تكلفة المكونات:
                </Typography>
                <Typography
                  variant="body2"
                  fontWeight="bold"
                  color="warning.main"
                >
                  {formatCurrency(ingredientsCost)}
                </Typography>
              </Box>
              <TextField
                label={`سعر البيع (${CURRENCY_LABEL})`}
                type="number"
                value={createSalePrice}
                onChange={(e) => setCreateSalePrice(e.target.value)}
                fullWidth
                size="small"
                inputProps={{ min: 0, step: 0.01 }}
              />
              <Box>
                <input
                  accept="image/*"
                  style={{ display: "none" }}
                  id="image-upload"
                  type="file"
                  onChange={(e) => setCreateImage(e.target.files[0])}
                />
                <label htmlFor="image-upload">
                  <Button
                    variant="outlined"
                    component="span"
                    fullWidth
                    size="small"
                    sx={{ textTransform: "none" }}
                  >
                    {createImage
                      ? `تم اختيار: ${createImage.name}`
                      : "اختر صورة المنتج (اختياري)"}
                  </Button>
                </label>
                {createImage && (
                  <Button
                    size="small"
                    color="error"
                    onClick={() => setCreateImage(null)}
                    sx={{ mt: 1 }}
                  >
                    إزالة الصورة
                  </Button>
                )}
              </Box>
              <Typography variant="caption" color="text.secondary">
                المكونات المختارة:{" "}
                {recipe
                  .map(
                    (r) => `${r.product?.name} (${formatDecimal(r.quantity)})`,
                  )
                  .join("، ")}
              </Typography>
            </Box>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={closeCreateDialog}>إلغاء</Button>
            <Button
              variant="contained"
              onClick={submitCreateMeal}
              disabled={loadingCreate}
              sx={{ bgcolor: PAGE_COLOR, "&:hover": { bgcolor: "#0097BD" } }}
            >
              {loadingCreate ? (
                <CircularProgress size={24} />
              ) : (
                "إنشاء المنتج وخصم المخزون"
              )}
            </Button>
          </DialogActions>
        </Dialog>

        {/* نافذة تأكيد الحذف */}
        <Dialog
          open={!!deleteConfirm}
          onClose={() => {
            if (!deleting) {
              setDeleteConfirm(null);
              setCreateError(null);
            }
          }}
          maxWidth="xs"
          fullWidth
        >
          <DialogTitle>تأكيد الحذف</DialogTitle>
          <DialogContent>
            {deleteConfirm && (
              <>
                <Typography>
                  هل تريد حذف <strong>{deleteConfirm.name}</strong>؟
                  {deleteConfirm.type === "category" && " (قسم الكاشير)"}
                  {deleteConfirm.type === "meal" && " (المنتج)"}
                  {deleteConfirm.type === "product" && " (الصنف)"}
                </Typography>
                {deleteConfirm.type === "category" && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 1.5 }}
                  >
                    ملاحظة: لا يمكن حذف قسم يحتوي على منتجات. احذف المنتجات من
                    تبويب «مخزون المنتجات» أولاً.
                  </Typography>
                )}
                {deleteConfirm.type === "product" && (
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 1.5 }}
                  >
                    سيتم استرجاع الكمية من المخزون وإرجاع المبلغ المدفوع لهذا
                    الصنف إلى الخزنة.
                  </Typography>
                )}
              </>
            )}
            {createError && (
              <Alert
                severity="error"
                sx={{ mt: 2 }}
                onClose={() => setCreateError(null)}
              >
                {createError}
              </Alert>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={() => {
                setDeleteConfirm(null);
                setCreateError(null);
              }}
              disabled={deleting}
            >
              إلغاء
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleConfirmDelete}
              disabled={deleting}
            >
              {deleting ? <CircularProgress size={24} /> : "حذف"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* نافذة إنشاء قسم كاشير */}
        <Dialog
          open={openAddSalesCategory}
          onClose={handleCloseAddSalesCategory}
          maxWidth="xs"
          fullWidth
          PaperProps={{ sx: { borderRadius: 2 } }}
        >
          <DialogTitle sx={{ fontWeight: 600 }}>
            إنشاء قسم خاص بالكاشير
          </DialogTitle>
          <DialogContent>
            {addCategoryError && (
              <Alert
                severity="error"
                sx={{ mb: 2 }}
                onClose={() => setAddCategoryError(null)}
              >
                {addCategoryError}
              </Alert>
            )}
            <TextField
              autoFocus
              fullWidth
              label="اسم القسم"
              value={newSalesCategoryName}
              onChange={(e) => setNewSalesCategoryName(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && handleAddSalesCategorySubmit()
              }
              placeholder="مثال: لحوم، عصائر، سلطات"
              size="small"
              sx={{ mt: 1 }}
              disabled={loadingAddCategory}
            />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button
              onClick={handleCloseAddSalesCategory}
              disabled={loadingAddCategory}
            >
              إلغاء
            </Button>
            <Button
              variant="contained"
              onClick={handleAddSalesCategorySubmit}
              disabled={loadingAddCategory || !newSalesCategoryName.trim()}
              sx={{ bgcolor: PAGE_COLOR, "&:hover": { bgcolor: "#0097BD" } }}
            >
              {loadingAddCategory ? (
                <CircularProgress size={24} />
              ) : (
                "إضافة القسم"
              )}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Box>
  );
}
