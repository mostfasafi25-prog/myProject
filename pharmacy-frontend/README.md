import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Grid,
  Card,
  Typography,
  Box,
  TextField,
  Paper,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  CircularProgress,
  Fab,
  Tooltip,
  Divider,
  Alert,
  Snackbar,
  InputAdornment,
  Tabs,
  Tab,
} from "@mui/material";
import {
  RestaurantMenu,
  Add,
  Delete,
  ExpandMore,
  Edit,
  Close,
  Info,
  Kitchen,
  Search,
  AttachMoney,
  Inventory,
  TrendingUp,
} from "@mui/icons-material";
import axios from "axios";

// ===== Constants =====
const API_BASE_URL = "http://127.0.0.1:8000/api";
const CATEGORY_COLORS = {
  الوجبات: "#8B4513",
  السلطات: "#2E7D32",
  اللحوم: "#8B0000",
  البهارات: "#FF5722",
  الخضراوات: "#4CAF50",
  المشروبات: "#2196F3",
  default: "#6B7280",
};

const UNITS = [
  { value: "kg", label: "كيلو" },
  { value: "g", label: "جرام" },
  { value: "l", label: "لتر" },
  { value: "ml", label: "ملليتر" },
  { value: "piece", label: "قطعة" },
];

export default function Wagabat() {
  // ===== States =====
  const [meals, setMeals] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState(0);
  const [dialogSearchTerm, setDialogSearchTerm] = useState(""); // ⬅️ أضف هذا

  const [expandedMeals, setExpandedMeals] = useState({});
  const [expandedIngredients, setExpandedIngredients] = useState({});
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  // Meal Form State
  const [mealForm, setMealForm] = useState({
    name: "",
    category_id: "",
    profit_margin: "",
    ingredients: [],
  });

  // Dialog States
  const [dialogs, setDialogs] = useState({
    create: false,
    editPrice: false,
    mealDetails: false,
  });

  const [editPriceData, setEditPriceData] = useState({
    mealId: null,
    sale_price: "",
    update_profit_margin: true,
    reason: "",
  });

  const [selectedMeal, setSelectedMeal] = useState(null);

  // ===== Fetch Data =====
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [mealsRes, categoriesRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/meals/all-with-details`),
        axios.get(`${API_BASE_URL}/categories/getCompleteTree`),
      ]);

      if (mealsRes.data.success) {
        const sortedMeals = mealsRes.data.data.meals.sort(
          (a, b) => new Date(b.created_at) - new Date(a.created_at),
        );
        setMeals(sortedMeals);
      }

      if (categoriesRes.data.success) {
        const tree = categoriesRes.data.data.tree;
        const allIngredients = tree.flatMap((cat) =>
          (cat.sub_categories || []).map((sub) => ({
            id: sub.id,
            name: sub.name,
            category_name: cat.name,
            sale_price: sub.sale_price || 0,
            quantity: sub.quantity || 0,
            unit: sub.unit || "kg",
          })),
        );
        setCategories(tree);
        setIngredients(allIngredients);
      }
    } catch (error) {
      console.error("خطأ:", error);
      showSnackbar("فشل في تحميل البيانات", "error");
    } finally {
      setLoading(false);
    }
  };

  // ===== Helpers =====
  const getCategoryColor = (name) =>
    CATEGORY_COLORS[name] || CATEGORY_COLORS.default;

  const calculateProfit = (cost, sale) =>
    parseFloat(sale || 0) - parseFloat(cost || 0);

  const calculateProfitPercentage = (cost, sale) =>
    cost > 0 ? (((sale - cost) / cost) * 100).toFixed(1) : 0;

  const showSnackbar = (message, severity = "success") => {
    setSnackbar({ open: true, message, severity });
  };

  const closeSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  // Memoized calculations
  const filteredMeals = useMemo(() => {
    if (!searchTerm) return meals;
    const term = searchTerm.toLowerCase();
    return meals.filter(
      (meal) =>
        meal.name.toLowerCase().includes(term) ||
        meal.category?.name.toLowerCase().includes(term),
    );
  }, [meals, searchTerm]);

  const filteredIngredients = useMemo(() => {
    if (!searchTerm) return ingredients;
    const term = searchTerm.toLowerCase();
    return ingredients.filter(
      (ing) =>
        ing.name.toLowerCase().includes(term) ||
        ing.category_name.toLowerCase().includes(term),
    );
  }, [ingredients, searchTerm]);
  const dialogFilteredIngredients = useMemo(() => {
    if (!dialogSearchTerm) return ingredients;
    const term = dialogSearchTerm.toLowerCase();
    return ingredients.filter(
      (ing) =>
        ing.name.toLowerCase().includes(term) ||
        ing.category_name.toLowerCase().includes(term),
    );
  }, [ingredients, dialogSearchTerm]);
  const mealsByCategory = useMemo(() => {
    const grouped = {};
    filteredMeals.forEach((meal) => {
      const catId = meal.category_id;
      if (!grouped[catId]) grouped[catId] = [];
      grouped[catId].push(meal);
    });
    return grouped;
  }, [filteredMeals]);

  const ingredientsByCategory = useMemo(() => {
    const grouped = {};
    filteredIngredients.forEach((ing) => {
      const catName = ing.category_name;
      if (!grouped[catName]) grouped[catName] = [];
      grouped[catName].push(ing);
    });
    return grouped;
  }, [filteredIngredients]);

  const stats = useMemo(() => {
    const totalMeals = meals.length;
    const totalIngredients = ingredients.length;
    const totalCost = meals.reduce(
      (sum, meal) => sum + parseFloat(meal.cost_price || 0),
      0,
    );
    const totalSales = meals.reduce(
      (sum, meal) => sum + parseFloat(meal.sale_price || 0),
      0,
    );
    const totalProfit = totalSales - totalCost;
    const avgProfitMargin =
      meals.length > 0
        ? (
            meals.reduce(
              (sum, meal) => sum + parseFloat(meal.profit_margin || 0),
              0,
            ) / meals.length
          ).toFixed(1)
        : 0;

    return {
      totalMeals,
      totalIngredients,
      totalCost: totalCost.toFixed(2),
      totalSales: totalSales.toFixed(2),
      totalProfit: totalProfit.toFixed(2),
      avgProfitMargin,
    };
  }, [meals, ingredients]);

  // ===== Meal Management =====
  const openDialog = useCallback((type, data = null) => {
    if (type === "create") {
      setMealForm({
        name: "",
        category_id: "",
        profit_margin: "30", // Default profit margin
        ingredients: [],
      });
      setDialogs((prev) => ({ ...prev, create: true }));
    } else if (type === "editPrice") {
      setEditPriceData({
        mealId: data.id,
        sale_price: data.sale_price || "",
        update_profit_margin: true,
        reason: "",
      });
      setDialogs((prev) => ({ ...prev, editPrice: true }));
    } else if (type === "mealDetails") {
      setSelectedMeal(data);
      setDialogs((prev) => ({ ...prev, mealDetails: true }));
    }
  }, []);

  const closeDialog = useCallback((type) => {
    setDialogs((prev) => ({ ...prev, [type]: false }));
  }, []);

  const addIngredient = useCallback(
    (ingredient) => {
      if (
        mealForm.ingredients.some((i) => i.sub_category_id === ingredient.id)
      ) {
        showSnackbar("هذا المكون مضاف بالفعل", "warning");
        return;
      }
      setMealForm((prev) => ({
        ...prev,
        ingredients: [
          ...prev.ingredients,
          {
            sub_category_id: ingredient.id,
            ingredient_name: ingredient.name,
            category_name: ingredient.category_name,
            quantity_needed: "1",
            unit: ingredient.unit || "kg",
            notes: "",
            current_price: ingredient.sale_price,
          },
        ],
      }));
    },
    [mealForm.ingredients],
  );

  const removeIngredient = useCallback((index) => {
    setMealForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.filter((_, i) => i !== index),
    }));
  }, []);

  const updateIngredient = useCallback((index, field, value) => {
    setMealForm((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((ing, i) =>
        i === index ? { ...ing, [field]: value } : ing,
      ),
    }));
  }, []);

  const calculateMealCost = useCallback(() => {
    return mealForm.ingredients
      .reduce((total, ing) => {
        const quantity = parseFloat(ing.quantity_needed) || 0;
        const price = parseFloat(ing.current_price) || 0;
        return total + quantity * price;
      }, 0)
      .toFixed(2);
  }, [mealForm.ingredients]);

  const calculateSuggestedPrice = useCallback(() => {
    const cost = parseFloat(calculateMealCost());
    const margin = parseFloat(mealForm.profit_margin) || 0;
    return (cost * (1 + margin / 100)).toFixed(2);
  }, [calculateMealCost, mealForm.profit_margin]);

  const saveMeal = async () => {
    if (!mealForm.name || !mealForm.category_id || !mealForm.profit_margin) {
      showSnackbar("الرجاء ملء جميع الحقول المطلوبة", "error");
      return;
    }

    if (mealForm.ingredients.length === 0) {
      showSnackbar("الرجاء إضافة مكونات للوجبة", "error");
      return;
    }

    try {
      const response = await axios.post(`${API_BASE_URL}/meals`, {
        name: mealForm.name,
        category_id: mealForm.category_id,
        profit_margin: parseFloat(mealForm.profit_margin),
        ingredients: mealForm.ingredients.map((ing) => ({
          sub_category_id: ing.sub_category_id,
          quantity_needed: parseFloat(ing.quantity_needed) || 0,
          unit: ing.unit,
          notes: ing.notes,
        })),
      });

      if (response.data.success) {
        showSnackbar("✅ تم إنشاء الوجبة بنجاح");
        closeDialog("create");
        fetchData();
      }
    } catch (error) {
      console.error("خطأ:", error);
      showSnackbar("❌ فشل في حفظ الوجبة", "error");
    }
  };

  const updatePrice = async () => {
    if (
      !editPriceData.sale_price ||
      parseFloat(editPriceData.sale_price) <= 0
    ) {
      showSnackbar("الرجاء إدخال سعر صحيح", "error");
      return;
    }

    try {
      const response = await axios.put(
        `${API_BASE_URL}/meals/${editPriceData.mealId}/sale-price`,
        {
          sale_price: parseFloat(editPriceData.sale_price),
          update_profit_margin: editPriceData.update_profit_margin,
          reason: editPriceData.reason || "تحديث يدوي",
        },
      );

      if (response.data.success) {
        showSnackbar("✅ تم تحديث السعر بنجاح");
        setMeals((prev) =>
          prev.map((m) =>
            m.id === editPriceData.mealId
              ? {
                  ...m,
                  sale_price: response.data.data.meal.new_sale_price,
                  profit_margin: response.data.data.meal.new_profit_margin,
                }
              : m,
          ),
        );
        closeDialog("editPrice");
      }
    } catch (error) {
      showSnackbar("❌ فشل في تحديث السعر", "error");
    }
  };

  // ===== UI Components =====
  const MealCard = ({ meal }) => (
    <Card
      sx={{
        p: 2,
        position: "relative",
        height: "100%",
        transition: "transform 0.2s, box-shadow 0.2s",
        "&:hover": {
          transform: "translateY(-4px)",
          boxShadow: 3,
          cursor: "pointer",
        },
      }}
      onClick={() => openDialog("mealDetails", meal)}
    >
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          openDialog("editPrice", meal);
        }}
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          bgcolor: "#4CAF50",
          color: "white",
          "&:hover": { bgcolor: "#388E3C" },
        }}
      >
        <Edit fontSize="small" />
      </IconButton>

      <Typography
        variant="h6"
        sx={{ fontWeight: "bold", color: "#4CAF50", pr: 4, mb: 1 }}
      >
        {meal.name}
      </Typography>

      <Box sx={{ display: "flex", gap: 1, mb: 1 }}>
        <Chip label={meal.code} size="small" color="primary" />
        <Chip
          label={meal.category?.name || "غير محدد"}
          size="small"
          sx={{ bgcolor: getCategoryColor(meal.category?.name) }}
        />
      </Box>

      <Divider sx={{ my: 1 }} />

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="body2" color="text.secondary">
            التكلفة:
          </Typography>
          <Typography variant="body2" fontWeight="bold">
            {meal.cost_price} ₪
          </Typography>
        </Box>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="body2" color="text.secondary">
            البيع:
          </Typography>
          <Typography variant="body2" fontWeight="bold" color="#4CAF50">
            {meal.sale_price} ₪
          </Typography>
        </Box>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="body2" color="text.secondary">
            الربح:
          </Typography>
          <Typography variant="body2" fontWeight="bold" color="#2E7D32">
            {calculateProfit(meal.cost_price, meal.sale_price).toFixed(2)} ₪
          </Typography>
        </Box>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="body2" color="text.secondary">
            النسبة:
          </Typography>
          <Chip
            label={`${meal.profit_margin}%`}
            size="small"
            color="primary"
            variant="outlined"
          />
        </Box>
      </Box>

      <Divider sx={{ my: 1 }} />

      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography variant="caption" color="text.secondary">
          <Inventory
            fontSize="small"
            sx={{ verticalAlign: "middle", mr: 0.5 }}
          />
          {meal.ingredients?.length || 0} مكون
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {new Date(meal.created_at).toLocaleDateString("ar-EG")}
        </Typography>
      </Box>
    </Card>
  );

  const IngredientCard = ({ ingredient, inDialog = false }) => (
    <Card
      sx={{
        p: 2,
        textAlign: "center",
        border: "1px solid #e0e0e0",
        transition: "all 0.2s",
        "&:hover": {
          borderColor: "#4CAF50",
          boxShadow: 2,
          transform: "translateY(-2px)",
        },
      }}
    >
      <Typography variant="subtitle2" fontWeight="bold" mb={1} noWrap>
        {ingredient.name}
      </Typography>
      <Chip
        label={ingredient.category_name}
        size="small"
        sx={{
          mb: 1,
          bgcolor: getCategoryColor(ingredient.category_name),
          color: "white",
          fontSize: "0.7rem",
        }}
      />
      <Box sx={{ display: "flex", justifyContent: "center", gap: 1, mb: 1 }}>
        <Chip
          icon={<AttachMoney fontSize="small" />}
          label={`${ingredient.sale_price} ₪`}
          size="small"
          variant="outlined"
          color="success"
        />
        <Chip
          icon={<Inventory fontSize="small" />}
          label={ingredient.quantity}
          size="small"
          variant="outlined"
          color="info"
        />
      </Box>
      {inDialog && (
        <Button
          variant="contained"
          size="small"
          fullWidth
          onClick={() => addIngredient(ingredient)}
          disabled={mealForm.ingredients.some(
            (i) => i.sub_category_id === ingredient.id,
          )}
          startIcon={<Add />}
          sx={{ mt: 1 }}
        >
          {mealForm.ingredients.some((i) => i.sub_category_id === ingredient.id)
            ? "مضاف ✓"
            : "إضافة"}
        </Button>
      )}
    </Card>
  );

  const StatsCard = ({ icon: Icon, title, value, color }) => (
    <Card sx={{ p: 2, textAlign: "center", bgcolor: `${color}10` }}>
      <Icon sx={{ fontSize: 40, color, mb: 1 }} />
      <Typography variant="h4" fontWeight="bold" color={color}>
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>
    </Card>
  );

  // ===== Loading =====
  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          gap: 2,
        }}
      >
        <CircularProgress size={60} />
        <Typography variant="h6" color="text.secondary">
          جاري تحميل البيانات...
        </Typography>
      </Box>
    );
  }

  // ===== Main UI =====
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={closeSnackbar}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      >
        <Alert onClose={closeSnackbar} severity={snackbar.severity}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Floating Action Button */}
      <Tooltip title="إنشاء وجبة جديدة">
        <Fab
          color="primary"
          onClick={() => openDialog("create")}
          sx={{
            position: "fixed",
            left: 24,
            bottom: 24,
            bgcolor: "#4CAF50",
            "&:hover": { bgcolor: "#388E3C" },
            zIndex: 1000,
          }}
        >
          <Add />
        </Fab>
      </Tooltip>

      {/* Header */}
      <Box sx={{ textAlign: "center", mb: 4 }}>
        <Typography
          variant="h3"
          fontWeight="bold"
          gutterBottom
          sx={{ color: "#2E7D32" }}
        >
          <RestaurantMenu
            sx={{
              fontSize: 48,
              verticalAlign: "middle",
              mr: 2,
              color: "#4CAF50",
            }}
          />
          نظام إدارة الوجبات
        </Typography>
        <Typography variant="h6" color="text.secondary">
          إدارة الوجبات والمكونات والأسعار
        </Typography>
      </Box>

      {/* Statistics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            icon={RestaurantMenu}
            title="عدد الوجبات"
            value={stats.totalMeals}
            color="#4CAF50"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            icon={Kitchen}
            title="عدد المكونات"
            value={stats.totalIngredients}
            color="#2196F3"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            icon={TrendingUp}
            title="إجمالي الربح"
            value={`${stats.totalProfit} ₪`}
            color="#2E7D32"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatsCard
            icon={AttachMoney}
            title="متوسط الربحية"
            value={`${stats.avgProfitMargin}%`}
            color="#FF9800"
          />
        </Grid>
      </Grid>

      {/* Tabs for Navigation */}
      <Paper sx={{ mb: 3, borderRadius: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          variant="fullWidth"
        >
          <Tab
            icon={<RestaurantMenu />}
            label={`الوجبات (${meals.length})`}
            iconPosition="start"
            sx={{ fontSize: "1rem" }}
          />
          <Tab
            icon={<Kitchen />}
            label={`المكونات (${ingredients.length})`}
            iconPosition="start"
            sx={{ fontSize: "1rem" }}
          />
        </Tabs>
      </Paper>

      {/* Meals Section */}
      {/* Meals Section */}
      {activeTab === 0 && (
        <Box>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 3,
              flexWrap: "wrap",
              gap: 2,
            }}
          >
            <TextField
              placeholder="🔍 ابحث عن وجبة..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ width: 300 }}
              size="small"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search />
                  </InputAdornment>
                ),
              }}
            />
            <Box sx={{ display: "flex", gap: 1 }}>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => openDialog("create")}
                sx={{ bgcolor: "#4CAF50", "&:hover": { bgcolor: "#388E3C" } }}
              >
                وجبة جديدة
              </Button>
              <Button
                variant="outlined"
                startIcon={<Info />}
                onClick={() => {
                  setExpandedMeals({});
                  Object.keys(mealsByCategory).forEach((catId) => {
                    setExpandedMeals((prev) => ({ ...prev, [catId]: true }));
                  });
                }}
              >
                فتح الكل
              </Button>
              <Button
                variant="outlined"
                startIcon={<Close />}
                onClick={() => setExpandedMeals({})}
              >
                غلق الكل
              </Button>
            </Box>
          </Box>

          {/* إحصائيات سريعة */}
          {searchTerm && (
            <Alert
              severity="info"
              sx={{ mb: 2, borderRadius: 2 }}
              icon={<Search />}
            >
              <Typography variant="body2">
                عرض {filteredMeals.length} من أصل {meals.length} وجبة
                {searchTerm && ` (نتائج بحث: "${searchTerm}")`}
              </Typography>
            </Alert>
          )}

          {/* عرض حسب الفئات */}
          {Object.keys(mealsByCategory).length > 0 ? (
            categories
              .filter((category) => mealsByCategory[category.id]?.length > 0)
              .map((category) => {
                const categoryMeals = mealsByCategory[category.id] || [];
                const categoryColor = getCategoryColor(category.name);

                // حساب إحصائيات الفئة
                const categoryStats = categoryMeals.reduce(
                  (acc, meal) => {
                    const profit = calculateProfit(
                      meal.cost_price,
                      meal.sale_price,
                    );
                    acc.totalCost += parseFloat(meal.cost_price || 0);
                    acc.totalSales += parseFloat(meal.sale_price || 0);
                    acc.totalProfit += profit;
                    acc.avgMargin += parseFloat(meal.profit_margin || 0);
                    return acc;
                  },
                  { totalCost: 0, totalSales: 0, totalProfit: 0, avgMargin: 0 },
                );

                return (
                  <Accordion
                    key={category.id}
                    expanded={expandedMeals[category.id] || false}
                    onChange={(e, isExpanded) =>
                      setExpandedMeals((prev) => ({
                        ...prev,
                        [category.id]: isExpanded,
                      }))
                    }
                    sx={{
                      mb: 2,
                      borderLeft: `4px solid ${categoryColor}`,
                      "&:before": { display: "none" },
                      borderRadius: "8px !important",
                      overflow: "hidden",
                    }}
                  >
                    <AccordionSummary
                      expandIcon={<ExpandMore />}
                      sx={{
                        backgroundColor: `${categoryColor}15`,
                        "&:hover": { backgroundColor: `${categoryColor}25` },
                        borderBottom: expandedMeals[category.id]
                          ? `1px solid ${categoryColor}30`
                          : "none",
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
                              width: 40,
                              height: 40,
                              borderRadius: "50%",
                              bgcolor: categoryColor,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <RestaurantMenu
                              sx={{ color: "white", fontSize: 20 }}
                            />
                          </Box>
                          <Box>
                            <Typography
                              variant="h6"
                              fontWeight="bold"
                              color={categoryColor}
                            >
                              {category.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {categoryMeals.length} وجبة
                            </Typography>
                          </Box>
                        </Box>

                        <Box
                          sx={{ display: "flex", gap: 3, alignItems: "center" }}
                        >
                          <Box sx={{ textAlign: "center" }}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              إجمالي الربح
                            </Typography>
                            <Typography
                              variant="body2"
                              fontWeight="bold"
                              color="#2E7D32"
                            >
                              {categoryStats.totalProfit.toFixed(2)} ₪
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: "center" }}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              متوسط الربحية
                            </Typography>
                            <Typography
                              variant="body2"
                              fontWeight="bold"
                              color="#FF9800"
                            >
                              {(
                                categoryStats.avgMargin / categoryMeals.length
                              ).toFixed(1)}
                              %
                            </Typography>
                          </Box>
                          <Box sx={{ textAlign: "center" }}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              إجمالي المبيعات
                            </Typography>
                            <Typography
                              variant="body2"
                              fontWeight="bold"
                              color="#4CAF50"
                            >
                              {categoryStats.totalSales.toFixed(2)} ₪
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                    </AccordionSummary>

                    <AccordionDetails sx={{ p: 3, backgroundColor: "#fafafa" }}>
                      {/* شريط إحصائيات الفئة */}
                      <Paper
                        sx={{
                          p: 2,
                          mb: 3,
                          bgcolor: "#f5f5f5",
                          borderRadius: 2,
                          display: "flex",
                          justifyContent: "space-around",
                          flexWrap: "wrap",
                          gap: 2,
                        }}
                      >
                        <Box sx={{ textAlign: "center" }}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                          >
                            التكلفة الإجمالية
                          </Typography>
                          <Typography variant="body1" fontWeight="bold">
                            {categoryStats.totalCost.toFixed(2)} ₪
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: "center" }}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                          >
                            المبيعات الإجمالية
                          </Typography>
                          <Typography
                            variant="body1"
                            fontWeight="bold"
                            color="#4CAF50"
                          >
                            {categoryStats.totalSales.toFixed(2)} ₪
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: "center" }}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                          >
                            صافي الربح
                          </Typography>
                          <Typography
                            variant="body1"
                            fontWeight="bold"
                            color="#2E7D32"
                          >
                            {categoryStats.totalProfit.toFixed(2)} ₪
                          </Typography>
                        </Box>
                        <Box sx={{ textAlign: "center" }}>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                          >
                            متوسط الربحية
                          </Typography>
                          <Typography
                            variant="body1"
                            fontWeight="bold"
                            color="#FF9800"
                          >
                            {(
                              categoryStats.avgMargin / categoryMeals.length
                            ).toFixed(1)}
                            %
                          </Typography>
                        </Box>
                      </Paper>

                      {/* عرض الوجبات */}
                      {categoryMeals.length > 0 ? (
                        <Grid container spacing={2}>
                          {categoryMeals.map((meal) => (
                            <Grid
                              item
                              xs={12}
                              sm={6}
                              md={4}
                              lg={3}
                              key={meal.id}
                            >
                              <MealCard meal={meal} />
                            </Grid>
                          ))}
                        </Grid>
                      ) : (
                        <Alert severity="warning" sx={{ borderRadius: 2 }}>
                          لا توجد وجبات في هذا القسم
                        </Alert>
                      )}
                    </AccordionDetails>
                  </Accordion>
                );
              })
          ) : (
            <Box>
              {filteredMeals.length > 0 ? (
                <Grid container spacing={2}>
                  {filteredMeals.map((meal) => (
                    <Grid item xs={12} sm={6} md={4} lg={3} key={meal.id}>
                      <MealCard meal={meal} />
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Box sx={{ textAlign: "center", py: 8 }}>
                  <RestaurantMenu
                    sx={{ fontSize: 60, color: "#e0e0e0", mb: 2 }}
                  />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    {searchTerm ? "لا توجد نتائج للبحث" : "لا توجد وجبات"}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 3 }}
                  >
                    {searchTerm
                      ? `لم يتم العثور على وجبات تطابق "${searchTerm}"`
                      : "ابدأ بإضافة وجبات جديدة باستخدام زر 'وجبة جديدة'"}
                  </Typography>
                  {!searchTerm && (
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={() => openDialog("create")}
                      sx={{
                        bgcolor: "#4CAF50",
                        "&:hover": { bgcolor: "#388E3C" },
                      }}
                    >
                      إنشاء أول وجبة
                    </Button>
                  )}
                </Box>
              )}
            </Box>
          )}

          {/* ملخص النتائج */}
          {filteredMeals.length > 0 && (
            <Paper
              sx={{
                p: 2,
                mt: 3,
                bgcolor: "#f5f5f5",
                borderRadius: 2,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 2,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Inventory />
                <Typography variant="body2" color="text.secondary">
                  إجمالي الوجبات المعروضة:{" "}
                  <strong>{filteredMeals.length}</strong> من أصل{" "}
                  <strong>{meals.length}</strong>
                </Typography>
              </Box>
              <Box sx={{ display: "flex", gap: 2 }}>
                <Chip
                  icon={<AttachMoney />}
                  label={`إجمالي المبيعات: ${stats.totalSales} ₪`}
                  color="success"
                  variant="outlined"
                />
                <Chip
                  icon={<TrendingUp />}
                  label={`إجمالي الربح: ${stats.totalProfit} ₪`}
                  color="primary"
                  variant="outlined"
                />
              </Box>
            </Paper>
          )}
        </Box>
      )}

      {/* Ingredients Section */}
      {activeTab === 1 && (
        <Box>
          <TextField
            fullWidth
            placeholder="🔍 ابحث عن مكون بالاسم أو القسم..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ mb: 3 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />

          {Object.keys(ingredientsByCategory).length === 0 ? (
            <Alert severity="info">لا توجد مكونات تطابق البحث</Alert>
          ) : (
            Object.keys(ingredientsByCategory).map((catName) => {
              const categoryIngredients = ingredientsByCategory[catName];
              return (
                <Accordion
                  key={catName}
                  expanded={expandedIngredients[catName] || false}
                  onChange={(e, isExpanded) =>
                    setExpandedIngredients((prev) => ({
                      ...prev,
                      [catName]: isExpanded,
                    }))
                  }
                  sx={{ mb: 2, borderLeft: "4px solid #4CAF50" }}
                >
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                      <Kitchen sx={{ color: "#2196F3" }} />
                      <Typography
                        variant="h5"
                        fontWeight="bold"
                        color="#2196F3"
                      >
                        {catName} ({categoryIngredients.length})
                      </Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      {categoryIngredients.map((ing) => (
                        <Grid item xs={12} sm={6} md={4} lg={3} key={ing.id}>
                          <IngredientCard ingredient={ing} />
                        </Grid>
                      ))}
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              );
            })
          )}
        </Box>
      )}

      {/* Create Meal Dialog */}
      <Dialog
        open={dialogs.create}
        onClose={() => closeDialog("create")}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle
          sx={{
            bgcolor: "#4CAF50",
            color: "white",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            py: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <RestaurantMenu />
            <Typography variant="h6">إنشاء وجبة جديدة</Typography>
          </Box>
          <IconButton
            onClick={() => closeDialog("create")}
            sx={{ color: "white" }}
          >
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          <Grid container spacing={3}>
            {/* Left: Form */}
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 2, height: "100%", borderRadius: 2 }}>
                <Typography variant="h6" color="#4CAF50" mb={2}>
                  معلومات الوجبة
                </Typography>
                <TextField
                  fullWidth
                  label="اسم الوجبة"
                  value={mealForm.name}
                  onChange={(e) =>
                    setMealForm({ ...mealForm, name: e.target.value })
                  }
                  sx={{ mb: 2 }}
                  required
                />
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel>القسم</InputLabel>
                  <Select
                    value={mealForm.category_id}
                    onChange={(e) =>
                      setMealForm({ ...mealForm, category_id: e.target.value })
                    }
                    label="القسم"
                    required
                  >
                    {categories.map((cat) => (
                      <MenuItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  fullWidth
                  label="هامش الربح %"
                  type="number"
                  value={mealForm.profit_margin}
                  onChange={(e) =>
                    setMealForm({ ...mealForm, profit_margin: e.target.value })
                  }
                  sx={{ mb: 2 }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">%</InputAdornment>
                    ),
                  }}
                  required
                />

                {/* Cost Calculation */}
                <Paper
                  sx={{ p: 2, bgcolor: "#f5f5f5", mb: 2, borderRadius: 1 }}
                >
                  <Typography variant="subtitle2" fontWeight="bold" mb={1}>
                    التكلفة والحسابات
                  </Typography>
                  <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 1 }}
                  >
                    <Box
                      sx={{ display: "flex", justifyContent: "space-between" }}
                    >
                      <Typography variant="body2">تكلفة المكونات:</Typography>
                      <Typography variant="body2" fontWeight="bold">
                        {calculateMealCost()} ₪
                      </Typography>
                    </Box>
                    <Box
                      sx={{ display: "flex", justifyContent: "space-between" }}
                    >
                      <Typography variant="body2">هامش الربح:</Typography>
                      <Typography
                        variant="body2"
                        fontWeight="bold"
                        color="#4CAF50"
                      >
                        {mealForm.profit_margin || 0}%
                      </Typography>
                    </Box>
                    <Divider />
                    <Box
                      sx={{ display: "flex", justifyContent: "space-between" }}
                    >
                      <Typography variant="body2" fontWeight="bold">
                        السعر المقترح:
                      </Typography>
                      <Typography
                        variant="body2"
                        fontWeight="bold"
                        color="#2E7D32"
                      >
                        {calculateSuggestedPrice()} ₪
                      </Typography>
                    </Box>
                  </Box>
                </Paper>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" fontWeight="bold" mb={1}>
                  المكونات المضافة ({mealForm.ingredients.length})
                </Typography>
                {mealForm.ingredients.length === 0 ? (
                  <Alert
                    severity="info"
                    icon={<Info />}
                    sx={{ borderRadius: 1 }}
                  >
                    لم تضف مكونات بعد
                  </Alert>
                ) : (
                  <List dense sx={{ maxHeight: 300, overflow: "auto" }}>
                    {mealForm.ingredients.map((ing, idx) => (
                      <ListItem
                        key={idx}
                        sx={{
                          bgcolor: idx % 2 === 0 ? "#f9f9f9" : "white",
                          mb: 1,
                          borderRadius: 1,
                          border: "1px solid #e0e0e0",
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box>
                              <Typography variant="body2" fontWeight="bold">
                                {ing.ingredient_name}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {ing.category_name} | {ing.current_price} ₪
                              </Typography>
                            </Box>
                          }
                          secondary={
                            <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
                              <TextField
                                size="small"
                                label="الكمية"
                                value={ing.quantity_needed}
                                onChange={(e) =>
                                  updateIngredient(
                                    idx,
                                    "quantity_needed",
                                    e.target.value,
                                  )
                                }
                                sx={{ width: 100 }}
                                type="number"
                                required
                              />
                              <FormControl sx={{ width: 100 }} size="small">
                                <InputLabel>الوحدة</InputLabel>
                                <Select
                                  value={ing.unit}
                                  onChange={(e) =>
                                    updateIngredient(
                                      idx,
                                      "unit",
                                      e.target.value,
                                    )
                                  }
                                  label="الوحدة"
                                >
                                  {UNITS.map((unit) => (
                                    <MenuItem
                                      key={unit.value}
                                      value={unit.value}
                                    >
                                      {unit.label}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                              <TextField
                                size="small"
                                label="ملاحظات"
                                value={ing.notes}
                                onChange={(e) =>
                                  updateIngredient(idx, "notes", e.target.value)
                                }
                                sx={{ flex: 1 }}
                              />
                            </Box>
                          }
                        />
                        <ListItemSecondaryAction>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => removeIngredient(idx)}
                            sx={{ ml: 1 }}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                )}
              </Paper>
            </Grid>

            {/* Right: Ingredients */}
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 2, height: "100%", borderRadius: 2 }}>
                <Typography variant="h6" color="#2196F3" mb={2}>
                  المكونات المتاحة ({filteredIngredients.length})
                </Typography>
                <TextField
                  fullWidth
                  placeholder="🔍 ابحث عن مكون..."
                  value={dialogSearchTerm}
                  onChange={(e) => setDialogSearchTerm(e.target.value)}
                  sx={{ mb: 3 }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <Search />
                      </InputAdornment>
                    ),
                  }}
                />

                {filteredIngredients.length === 0 ? (
                  <Alert severity="info">لا توجد مكونات تطابق البحث</Alert>
                ) : (
                  <Box sx={{ maxHeight: 500, overflow: "auto", pr: 1 }}>
                    <Grid container spacing={2}>
                      {filteredIngredients.map((ing) => (
                        <Grid item xs={12} sm={6} md={4} key={ing.id}>
                          <IngredientCard ingredient={ing} inDialog />
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 2, bgcolor: "#f5f5f5" }}>
          <Button
            onClick={() => closeDialog("create")}
            variant="outlined"
            sx={{ mr: 1 }}
          >
            إلغاء
          </Button>
          <Button
            onClick={saveMeal}
            variant="contained"
            color="success"
            disabled={
              !mealForm.name ||
              !mealForm.category_id ||
              mealForm.ingredients.length === 0
            }
            startIcon={<Add />}
            sx={{ px: 3 }}
          >
            حفظ الوجبة
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Price Dialog */}
      <Dialog
        open={dialogs.editPrice}
        onClose={() => closeDialog("editPrice")}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        <DialogTitle
          sx={{
            bgcolor: "#4CAF50",
            color: "white",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            py: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Edit />
            <Typography variant="h6">تعديل سعر الوجبة</Typography>
          </Box>
          <IconButton
            onClick={() => closeDialog("editPrice")}
            sx={{ color: "white" }}
          >
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="سعر البيع الجديد"
                type="number"
                value={editPriceData.sale_price}
                onChange={(e) =>
                  setEditPriceData({
                    ...editPriceData,
                    sale_price: e.target.value,
                  })
                }
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">₪</InputAdornment>
                  ),
                  startAdornment: (
                    <InputAdornment position="start">
                      <AttachMoney />
                    </InputAdornment>
                  ),
                }}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="سبب التعديل"
                value={editPriceData.reason}
                onChange={(e) =>
                  setEditPriceData({ ...editPriceData, reason: e.target.value })
                }
                multiline
                rows={2}
                placeholder="مثال: تغيير سعر المكونات، عرض خاص..."
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={editPriceData.update_profit_margin}
                    onChange={(e) =>
                      setEditPriceData({
                        ...editPriceData,
                        update_profit_margin: e.target.checked,
                      })
                    }
                    color="primary"
                  />
                }
                label="تحديث هامش الربح تلقائياً بناءً على السعر الجديد"
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 2, bgcolor: "#f5f5f5" }}>
          <Button
            onClick={() => closeDialog("editPrice")}
            variant="outlined"
            sx={{ mr: 1 }}
          >
            إلغاء
          </Button>
          <Button
            onClick={updatePrice}
            variant="contained"
            color="primary"
            startIcon={<Edit />}
          >
            تحديث السعر
          </Button>
        </DialogActions>
      </Dialog>

      {/* Meal Details Dialog */}
      <Dialog
        open={dialogs.mealDetails}
        onClose={() => closeDialog("mealDetails")}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 2 } }}
      >
        {selectedMeal && (
          <>
            <DialogTitle
              sx={{
                bgcolor: "#4CAF50",
                color: "white",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                py: 2,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <RestaurantMenu />
                <Typography variant="h6">تفاصيل الوجبة</Typography>
              </Box>
              <IconButton
                onClick={() => closeDialog("mealDetails")}
                sx={{ color: "white" }}
              >
                <Close />
              </IconButton>
            </DialogTitle>

            <DialogContent sx={{ pt: 3 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="h6" color="#4CAF50" mb={2}>
                      المعلومات الأساسية
                    </Typography>
                    <Box
                      sx={{ display: "flex", flexDirection: "column", gap: 2 }}
                    >
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          اسم الوجبة
                        </Typography>
                        <Typography variant="h6" fontWeight="bold">
                          {selectedMeal.name}
                        </Typography>
                      </Box>
                      <Box sx={{ display: "flex", gap: 2 }}>
                        <Box>
                          <Typography
                            variant="subtitle2"
                            color="text.secondary"
                          >
                            الكود
                          </Typography>
                          <Chip label={selectedMeal.code} color="primary" />
                        </Box>
                        <Box>
                          <Typography
                            variant="subtitle2"
                            color="text.secondary"
                          >
                            القسم
                          </Typography>
                          <Chip
                            label={selectedMeal.category?.name}
                            sx={{
                              bgcolor: getCategoryColor(
                                selectedMeal.category?.name,
                              ),
                            }}
                          />
                        </Box>
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary">
                          تاريخ الإنشاء
                        </Typography>
                        <Typography>
                          {new Date(selectedMeal.created_at).toLocaleDateString(
                            "ar-EG",
                            {
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            },
                          )}
                        </Typography>
                      </Box>
                    </Box>
                  </Paper>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Paper sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="h6" color="#4CAF50" mb={2}>
                      الحسابات المالية
                    </Typography>
                    <Box
                      sx={{ display: "flex", flexDirection: "column", gap: 2 }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <Typography>تكلفة الإنتاج:</Typography>
                        <Typography fontWeight="bold">
                          {selectedMeal.cost_price} ₪
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <Typography>سعر البيع:</Typography>
                        <Typography fontWeight="bold" color="#4CAF50">
                          {selectedMeal.sale_price} ₪
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <Typography>صافي الربح:</Typography>
                        <Typography fontWeight="bold" color="#2E7D32">
                          {calculateProfit(
                            selectedMeal.cost_price,
                            selectedMeal.sale_price,
                          ).toFixed(2)}{" "}
                          ₪
                        </Typography>
                      </Box>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <Typography>نسبة الربحية:</Typography>
                        <Chip
                          label={`${selectedMeal.profit_margin}%`}
                          color="primary"
                          variant="outlined"
                        />
                      </Box>
                    </Box>
                  </Paper>
                </Grid>

                <Grid item xs={12}>
                  <Paper sx={{ p: 2, borderRadius: 2 }}>
                    <Typography variant="h6" color="#4CAF50" mb={2}>
                      المكونات ({selectedMeal.ingredients?.length || 0})
                    </Typography>
                    {selectedMeal.ingredients &&
                    selectedMeal.ingredients.length > 0 ? (
                      <Grid container spacing={2}>
                        {selectedMeal.ingredients.map((ing, idx) => (
                          <Grid item xs={12} sm={6} md={4} key={idx}>
                            <Card sx={{ p: 1.5, borderRadius: 2 }}>
                              <Typography variant="subtitle2" fontWeight="bold">
                                {ing.sub_category?.name}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {ing.quantity_needed} {ing.unit}
                              </Typography>
                              <Typography variant="caption" display="block">
                                السعر: {ing.sub_category?.sale_price || 0} ₪
                              </Typography>
                            </Card>
                          </Grid>
                        ))}
                      </Grid>
                    ) : (
                      <Alert severity="info">لا توجد مكونات</Alert>
                    )}
                  </Paper>
                </Grid>
              </Grid>
            </DialogContent>

            <DialogActions sx={{ p: 2, bgcolor: "#f5f5f5" }}>
              <Button
                onClick={() => closeDialog("mealDetails")}
                variant="outlined"
                sx={{ mr: 1 }}
              >
                إغلاق
              </Button>
              <Button
                onClick={() => {
                  closeDialog("mealDetails");
                  openDialog("editPrice", selectedMeal);
                }}
                variant="contained"
                color="primary"
                startIcon={<Edit />}
              >
                تعديل السعر
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}
