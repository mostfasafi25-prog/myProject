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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Badge,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import {
  RestaurantMenu,
  ShoppingCart,
  ExpandMore,
  Inventory,
  Delete,
  Lock,
  Undo,
  Payment,
  PhoneAndroid,
} from "@mui/icons-material";
import axios from "axios";
import { formatMoney } from "../utils/currency";
import { confirmApp, showAppToast } from "../utils/appToast";

// ===== Constants =====
const API_BASE_URL = "http://127.0.0.1:8000/api";
const COLOR_MAP = { default: "#6B7280" };
const groupCartItemsByName = (items) => {
  const grouped = items.reduce((acc, item) => {
    if (!acc[item.name]) {
      acc[item.name] = {
        name: item.name,
        items: [],
        totalQuantity: 0,
        totalPrice: 0,
      };
    }
    acc[item.name].items.push(item);
    acc[item.name].totalQuantity += item.quantity;
    acc[item.name].totalPrice += item.total;
    return acc;
  }, {});

  return Object.values(grouped);
};

// تعديل CartItem ليصبح GroupedCartItem
const GroupedCartItem = React.memo(({ group, onUpdateQuantity, onRemove }) => (
  <>
    <Box
      sx={{
        p: 1.5,
        borderBottom: "2px solid #4cc9f0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <Typography variant="subtitle1" fontWeight="bold" color="#4cc9f0">
        {group.name}
      </Typography>
      <Chip
        label={`إجمالي الكمية:  ${group.totalQuantity} `}
        size="medium"
        sx={{ color: "white" }}
      />
    </Box>
    {/* قائمة العناصر داخل المجموعة */}
    <Box sx={{ p: 1 }}>
      {group.items.map((item, index) => (
        <Box key={item.id}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              p: 0.5, // تقليل padding
              borderRadius: 1,
            }}
          >
            <Box sx={{ flex: 1 }}>
              {/* عرض الخيارات */}
              {item.options?.length > 0 && (
                <Box
                  sx={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1.3, // تقليل المسافة بين الـ Chips
                    mb: 1.3, // تقليل المسافة السفلية
                  }}
                >
                  {item.options.map((opt) => (
                    <Chip
                      key={opt.id}
                      label={`${opt.name}+${opt.price} شيكل`}
                      size="small"
                      sx={{
                        fontSize: "17px", // تصغير الخط
                        height: 18, // تصغير الارتفاع
                        color: "#1976d2",
                        fontWeight: "bold",
                        "& .MuiChip-label": {
                          px: 0.5, // تقليل padding الداخلي
                        },
                      }}
                    />
                  ))}
                </Box>
              )}

              {/* تفاصيل السعر والكمية */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5, // تقليل المسافة بين العناصر
                  flexWrap: "wrap",
                }}
              >
                <Chip
                  label={`${item.price} شيكل`} // تبسيط النص
                  size="small"
                  sx={{
                    height: 22, // تصغير الارتفاع
                    fontSize: "16px",
                    "& .MuiChip-label": {
                      px: 0.7,
                    },
                  }}
                />

                <Box sx={{ display: "flex", alignItems: "center", gap: 0.3 }}>
                  <Typography variant="caption" sx={{ fontSize: "11px" }}>
                    ك:
                  </Typography>
                  <TextField
                    size="small"
                    type="number"
                    value={item.quantity}
                    onChange={(e) =>
                      onUpdateQuantity(item.id, Math.max(0.01, parseFloat(e.target.value) || 0.01))
                    }
                    inputProps={{
                      min: 0.01,
                      step: 0.01,
                      style: {
                        width: 35,
                        padding: "2px 2px",
                        fontSize: "11px",
                        textAlign: "center",
                      },
                    }}
                    sx={{
                      "& .MuiInputBase-root": {
                        height: 22, // تصغير الارتفاع
                        fontSize: "11px",
                      },
                    }}
                  />
                </Box>

                <Chip
                  label={`${item.total} شيكل`} // تبسيط النص
                  size="small"
                  color="primary"
                  sx={{
                    height: 22, // تصغير الارتفاع
                    fontSize: "11px",
                    fontWeight: "bold",
                    "& .MuiChip-label": {
                      px: 0.7,
                    },
                  }}
                />
              </Box>
            </Box>

            <IconButton
              size="small"
              color="error"
              onClick={() => onRemove(item.id)}
              sx={{
                ml: 0.5,
                p: 0.5, // تقليل padding الزر
                "& .MuiSvgIcon-root": {
                  fontSize: "16px", // تصغير الأيقونة
                },
              }}
            >
              <Delete fontSize="small" />
            </IconButton>
          </Box>
          {index < group.items.length - 1 && <Divider sx={{ my: 0.5 }} />}
        </Box>
      ))}
    </Box>{" "}
  </>
));
// ===== Helper Functions =====
const calculateItemTotal = (item) => (item.price || 0) * (item.quantity || 1);
const calculateCartTotal = (items) =>
  items.reduce((sum, item) => sum + calculateItemTotal(item), 0);

// ===== Sub Components =====
const CartItem = React.memo(({ item, onUpdateQuantity, onRemove }) => (
  <>
    <ListItem sx={{ py: 0.5, px: 1 }}>
      <ListItemText
        primary={
          <Typography variant="body2" fontWeight="bold">
            {item.name}
          </Typography>
        }
        secondary={
          <Box>
            {item.options?.length > 0 && (
              <Box
                sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 0.5 }}
              >
                {item.options.map((opt) => (
                  <Chip
                    key={opt.id}
                    label={`${opt.name}: +${opt.price} شيكل`}
                    size="small"
                    sx={{
                      fontSize: "10px",
                      height: 20,
                      bgcolor: "#4cc9f020",
                      color: "#4cc9f0",
                      fontWeight: "bold",
                    }}
                  />
                ))}
              </Box>
            )}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                flexWrap: "wrap",
              }}
            >
              <Typography
                variant="caption"
                sx={{ bgcolor: "#f0f0f0", p: "2px 6px", borderRadius: 1 }}
              >
                السعر: {item.price} شيكل
              </Typography>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                <Typography variant="caption">الكمية:</Typography>
                <TextField
                  size="small"
                  type="number"
                  value={item.quantity}
                  onChange={(e) =>
                    onUpdateQuantity(item.id, parseFloat(e.target.value) || 0.01)
                  }
                  inputProps={{
                    min: 0.01,
                    step: 0.01,
                    style: {
                      width: 50,
                      padding: "2px 4px",
                      fontSize: "0.75rem",
                      textAlign: "center",
                    },
                  }}
                  sx={{
                    "& .MuiInputBase-root": { height: 24, fontSize: "0.75rem" },
                  }}
                />
              </Box>
              <Typography
                variant="caption"
                color="primary"
                fontWeight="bold"
                sx={{ mr: "auto" }}
              >
                المجموع: {formatMoney(calculateItemTotal(item))}
              </Typography>
            </Box>
          </Box>
        }
      />
      <ListItemSecondaryAction>
        <IconButton
          edge="end"
          size="small"
          color="error"
          onClick={() => onRemove(item.id)}
        >
          <Delete fontSize="small" />
        </IconButton>
      </ListItemSecondaryAction>
    </ListItem>
    <Divider sx={{ my: 0.5 }} />
  </>
));

const MealCard = React.memo(
  ({
    meal,
    categoryColor,
    tempQuantity,
    onQuantityChange,
    onAddToCart,
    onOpenOptions,
  }) => {
    const hasOptions = meal.options?.length > 0;

    return (
      <Card
        sx={{
          p: 1.5,
          minHeight: hasOptions ? 160 : 140,
          display: "flex",
          flexDirection: "column",
          position: "relative",
          transition: "transform 0.2s",
          cursor: hasOptions ? "pointer" : "default",
          border: hasOptions ? `2px solid ${categoryColor}` : "none",
          "&:hover": {
            transform: hasOptions ? "translateY(-4px)" : "none",
            boxShadow: hasOptions ? 3 : 1,
          },
        }}
        onClick={() => hasOptions && onOpenOptions(meal)}
      >
        <Typography
          variant="h6"
          sx={{
            fontWeight: "bold",
            textAlign: "center",
            fontSize: "25px",
            mb: 0.5,
            color: "white",
            lineHeight: 1.2,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {meal.name}
        </Typography>

        {!hasOptions ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "baseline",
              gap: 0.5,
              mb: 0.5,
            }}
          >
            <Typography
              variant="h5"
              color="primary"
              fontWeight="bold"
              fontSize="16px"
            >
              {formatMoney(meal.sale_price)}
            </Typography>
            {meal.fixed_price && (
              <Lock sx={{ fontSize: 14, color: "text.secondary", ml: 0.5 }} titleAccess="سعر ثابت - لا يمكن تغييره" />
            )}
          </Box>
        ) : (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "baseline",
              gap: 0.5,
              mb: 0.5,
            }}
          >
            <Typography
              variant="h5"
              color="primary"
              fontWeight="bold"
              fontSize="16px"
            >
              يوجد اكثر من صنف
            </Typography>{" "}
          </Box>
        )}
        <Box
          sx={{ display: "flex", gap: 0.5, alignItems: "center", mt: "10px" }}
        >
          <TextField
            size="small"
            type="number"
            placeholder="كمية"
            value={tempQuantity || ""}
            onChange={(e) => {
              e.stopPropagation();
              onQuantityChange(meal.id, e.target.value);
            }}
            onClick={(e) => e.stopPropagation()}
            sx={{
              width: 80,
              "& .MuiInputBase-root": { height: 32, fontSize: "0.9rem" },
            }}
            inputProps={{
              style: {
                textAlign: "center",
                padding: "0 5px",
                fontSize: "14px",
              },
              min: 0.01,
              step: 0.01,
            }}
          />
          <Button
            variant="contained"
            size="small"
            fullWidth
            onClick={(e) => {
              e.stopPropagation();
              if (hasOptions) {
                onOpenOptions(meal, parseFloat(tempQuantity) || 1);
              } else {
                onAddToCart(meal, [], parseFloat(tempQuantity) || 1);
              }
            }}
            disabled={!tempQuantity || parseFloat(tempQuantity) <= 0}
            sx={{
              p: 0.5,
              fontSize: "14px",
              fontWeight: "bold",
              color: "white",
              bgcolor: categoryColor,
              "&:hover": { bgcolor: categoryColor, opacity: 0.9 },
              "&:disabled": { bgcolor: "#131212" },
            }}
          >
            {hasOptions ? "اختر" : "أضف"}
          </Button>
        </Box>
      </Card>
    );
  },
);

// ===== Main Component =====
export default function Cashier() {
  // ===== States =====
  const [meals, setMeals] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [tempQuantities, setTempQuantities] = useState({});
  const [optionDialog, setOptionDialog] = useState({
    open: false,
    meal: null,
    quantity: 1,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [salesOrders, setSalesOrders] = useState([]);
  const [loadingSales, setLoadingSales] = useState(false);
  const [returningId, setReturningId] = useState(null);

  // ===== Fetch Data =====
  useEffect(() => {
    const fetchMeals = async () => {
      try {
        const { data } = await axios.get(
          `${API_BASE_URL}/meals/all-with-details`,
        );
        if (data.success) {
          setMeals(
            data.data.meals.map((meal) => ({
              ...meal,
              isAvailable: meal.is_available ?? true,
            })),
          );
        }
      } catch (error) {
        console.error("خطأ في جلب المنتجات:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchMeals();
  }, []);

  const fetchSalesOrders = useCallback(async () => {
    setLoadingSales(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data } = await axios.get(`${API_BASE_URL}/orders`, {
        params: { per_page: 25, status: "paid", start_date: today, end_date: today },
      });
      if (data.success && data.data?.orders) {
        setSalesOrders(data.data.orders);
      }
    } catch (err) {
      console.error("خطأ في جلب المبيعات:", err);
    } finally {
      setLoadingSales(false);
    }
  }, []);

  useEffect(() => {
    fetchSalesOrders();
  }, [fetchSalesOrders]);

  // ===== Memoized Categories =====
  const categories = useMemo(() => {
    if (meals.length === 0) return [];

    const grouped = meals.reduce((acc, meal) => {
      const categoryName = meal.category?.name || "أخرى";
      if (!acc[categoryName]) acc[categoryName] = [];
      acc[categoryName].push(meal);
      return acc;
    }, {});

    return Object.entries(grouped)
      .map(([name, meals]) => ({
        id: name,
        name,
        meals,
        count: meals.length,
        color: COLOR_MAP[name] || COLOR_MAP.default,
      }))
      .sort((a, b) => b.count - a.count);
  }, [meals]);

  // ===== Filtered Categories =====
  const filteredCategories = useMemo(() => {
    if (!searchTerm) return categories;
    return categories
      .map((cat) => ({
        ...cat,
        meals: cat.meals.filter((m) =>
          m.name.toLowerCase().includes(searchTerm.toLowerCase()),
        ),
      }))
      .filter((cat) => cat.meals.length > 0);
  }, [categories, searchTerm]);

  // ===== Auto Expand First Category =====
  useEffect(() => {
    if (categories.length > 0 && Object.keys(expandedCategories).length === 0) {
      setExpandedCategories({ [categories[0].id]: true });
    }
  }, [categories]);

  // ===== Search Effect =====
  useEffect(() => {
    if (searchTerm && filteredCategories.length > 0) {
      setExpandedCategories(
        filteredCategories.reduce(
          (acc, cat) => ({ ...acc, [cat.id]: true }),
          {},
        ),
      );
    } else if (!searchTerm && categories.length > 0) {
      setExpandedCategories({ [categories[0]?.id]: true });
    }
  }, [searchTerm, filteredCategories, categories]);

  // ===== Handlers =====
  const handleAddToCart = useCallback(
    (meal, options = [], quantity = 1) => {
      const qty = parseFloat(quantity) || parseFloat(tempQuantities[meal.id]) || 1;
      if (qty <= 0) {
        showAppToast("الرجاء إدخال كمية صحيحة", "warning");
        return;
      }

      const optionsTotal = options.reduce(
        (sum, opt) => sum + (parseFloat(opt.price) || 0),
        0,
      );
      const finalPrice = parseFloat(meal.sale_price) + optionsTotal;

      // إنشاء معرف فريد للخيارات
      const optionsString = options
        .map((opt) => `${opt.id}`)
        .sort()
        .join(",");

      setCartItems((prev) => {
        // البحث عن عنصر بنفس المنتج ونفس الخيارات بالضبط
        const existingItemIndex = prev.findIndex(
          (item) =>
            item.mealId === meal.id &&
            JSON.stringify(item.options.map((o) => o.id).sort()) ===
              JSON.stringify(options.map((o) => o.id).sort()),
        );

        if (existingItemIndex !== -1) {
          // إذا وجد نفس العنصر بنفس الخيارات، نزيد الكمية
          const updatedItems = [...prev];
          updatedItems[existingItemIndex] = {
            ...updatedItems[existingItemIndex],
            quantity: updatedItems[existingItemIndex].quantity + qty,
            total:
              (updatedItems[existingItemIndex].quantity + qty) * finalPrice,
          };
          return updatedItems;
        } else {
          // إذا كانت خيارات مختلفة، نضيف عنصر جديد
          return [
            ...prev,
            {
              id: `${meal.id}-${Date.now()}-${Math.random()}`,
              mealId: meal.id,
              name: meal.name,
              price: finalPrice,
              basePrice: meal.sale_price,
              quantity: qty,
              total: finalPrice * qty,
              category: meal.category?.name || "أخرى",
              options,
            },
          ];
        }
      });

      setTempQuantities((prev) => ({ ...prev, [meal.id]: "" }));
    },
    [tempQuantities],
  );

  const handleRemoveFromCart = useCallback((id) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleUpdateQuantity = useCallback((id, newQuantity) => {
    setCartItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity: Math.max(0.01, parseFloat(newQuantity) || 0.01),
              total: Math.max(0.01, parseFloat(newQuantity) || 0.01) * item.price,
            }
          : item,
      ),
    );
  }, []);

  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      showAppToast("السلة فارغة!", "warning");
      return;
    }

    try {
      await axios.post(`${API_BASE_URL}/orders/sell-ready-meal`, {
        items: cartItems.map((item) => ({
          meal_id: item.mealId,
          quantity: item.quantity,
          price: item.price,
          base_price: item.basePrice,
          options:
            item.options?.map((opt) => ({
              id: opt.id,
              name: opt.name,
              price: opt.price,
              group_name: opt.group_name || undefined,
            })) || [],
        })),
        paid_amount: calculateCartTotal(cartItems),
        payment_method: paymentMethod,
      });

      showAppToast("تم إتمام عملية البيع بنجاح", "success");
      setCartItems([]);
      fetchSalesOrders();
    } catch (error) {
      console.error("خطأ في إتمام البيع:", error);
      showAppToast(
        error.response?.data?.message || "حدث خطأ أثناء إتمام البيع",
        "error",
      );
    }
  };

  const handleAccordionChange = useCallback((categoryId) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  }, []);

  const expandAll = useCallback(() => {
    setExpandedCategories(
      categories.reduce((acc, cat) => ({ ...acc, [cat.id]: true }), {}),
    );
  }, [categories]);

  const collapseAll = useCallback(() => setExpandedCategories({}), []);

  const handleReturnOrder = useCallback(async (orderId) => {
    const ok = await confirmApp({
      title: "إرجاع الطلب",
      text: "هل تريد إرجاع هذا الطلب واسترداد المبلغ من الخزنة؟",
      icon: "question",
      confirmText: "نعم، أرجع الطلب",
    });
    if (!ok) return;
    setReturningId(orderId);
    try {
      const { data } = await axios.post(
        `${API_BASE_URL}/orders/${orderId}/return-full`,
        { reason: "مرتجع من صفحة الكاشير" }
      );
      if (data.success) {
        showAppToast(data.message || "تم إرجاع الطلب بنجاح", "success");
        fetchSalesOrders();
      } else {
        showAppToast(data.message || "فشل إرجاع الطلب", "error");
      }
    } catch (err) {
      showAppToast(
        err.response?.data?.message || "حدث خطأ أثناء إرجاع الطلب",
        "error",
      );
    } finally {
      setReturningId(null);
    }
  }, [fetchSalesOrders]);

  const updateTempQuantity = useCallback((mealId, value) => {
    setTempQuantities((prev) => ({ ...prev, [mealId]: value }));
  }, []);

  const openOptionDialog = useCallback((meal, quantity = 1) => {
    setOptionDialog({ open: true, meal, quantity });
  }, []);

  // ===== Loading =====
  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <Typography>جاري تحميل المنتجات...</Typography>
      </Box>
    );
  }

  // ===== Render =====
  return (
    <Box sx={{ p: 2, pl: cartItems.length > 0 ? "230px" : 2 }}>
      {/* Cart Sidebar */}
      {cartItems.length > 0 && (
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
          }}
        >
          {/* Header */}
          <Box
            sx={{
              color: "white",
              py: 1.5,
              px: 3,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Typography variant="h6" fontWeight="bold">
              السلة
            </Typography>

            <Badge badgeContent={cartItems.length} color="error">
              <ShoppingCart />
            </Badge>
          </Box>

          {/* Items */}
          <Box
            sx={{
              flex: 1,
              overflowY: "auto",
              p: 1.5,
            }}
          >
            {groupCartItemsByName(cartItems).map((group) => (
              <Paper
                key={group.name}
                sx={{
                  mb: 1,
                  p: 1,
                  borderRadius: 2,
                }}
              >
                <GroupedCartItem
                  group={group}
                  onUpdateQuantity={handleUpdateQuantity}
                  onRemove={handleRemoveFromCart}
                />
              </Paper>
            ))}
          </Box>

          {/* Footer */}
          <Box
            sx={{
              p: 2,
              borderTop: "1px solid #0986e0",
            }}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                mb: 1,
              }}
            >
              <Typography variant="body2">عدد الأصناف</Typography>
              <Typography fontWeight="bold">{cartItems.length}</Typography>
            </Box>

            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                mb: 2,
              }}
            >
              <Typography variant="h6">الإجمالي</Typography>
              <Typography
                variant="h6"
                fontWeight="bold"
                sx={{ color: "#4cc9f0" }}
              >
                {formatMoney(calculateCartTotal(cartItems))}
              </Typography>
            </Box>

            <Typography variant="body2" sx={{ mb: 1 }}>
              طريقة الدفع
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              <Button
                variant={paymentMethod === "cash" ? "contained" : "outlined"}
                size="small"
                startIcon={<Payment />}
                onClick={() => setPaymentMethod("cash")}
                sx={{
                  flex: 1,
                  bgcolor: paymentMethod === "cash" ? "#4cc9f0" : undefined,
                  "&:hover": { bgcolor: paymentMethod === "cash" ? "#3bb3d8" : undefined },
                }}
              >
                كاش
              </Button>
              <Button
                variant={paymentMethod === "app" ? "contained" : "outlined"}
                size="small"
                startIcon={<PhoneAndroid />}
                onClick={() => setPaymentMethod("app")}
                sx={{
                  flex: 1,
                  bgcolor: paymentMethod === "app" ? "#4cc9f0" : undefined,
                  "&:hover": { bgcolor: paymentMethod === "app" ? "#3bb3d8" : undefined },
                }}
              >
                تطبيق
              </Button>
            </Stack>

            <Button
              fullWidth
              variant="contained"
              onClick={handleCheckout}
              sx={{
                bgcolor: "#4cc9f0",
                fontWeight: "bold",
                borderRadius: 2,
                py: 1.2,
                "&:hover": {
                  bgcolor: "#3bb3d8",
                },
              }}
            >
              إتمام البيع
            </Button>
          </Box>
        </Paper>
      )}

      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h3"
          sx={{
            fontWeight: "bold",
            color: "#4cc9f0",
            mb: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          <RestaurantMenu sx={{ fontSize: 45 }} /> صفحة الكاشير
        </Typography>
        <Typography
          variant="h6"
          color="text.secondary"
          textAlign="center"
          sx={{ mb: 3 }}
        >
          أهلاً بك في نظام نقاط البيع
        </Typography>

        <Paper sx={{ p: 2, mb: 3, display: "flex", justifyContent: "center" }}>
          <TextField
            fullWidth
            placeholder="🔍 ابحث عن منتج..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ maxWidth: 500 }}
          />
        </Paper>
      </Box>

      {/* Controls */}
      {categories.length > 0 && !searchTerm && (
        <Box
          sx={{ display: "flex", gap: 1, mb: 2, justifyContent: "flex-end" }}
        >
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
        </Box>
      )}

      {/* Categories */}
      {filteredCategories.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <RestaurantMenu sx={{ fontSize: 60, color: "#e0e0e0", mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            {searchTerm ? "لا توجد نتائج" : "لا توجد منتجات"}
          </Typography>
        </Box>
      ) : (
        filteredCategories.map((category) => (
          <Accordion
            key={category.id}
            expanded={expandedCategories[category.id] || false}
            onChange={() => handleAccordionChange(category.id)}
            sx={{
              mb: 2,
              borderRadius: "8px !important",
              border: `1px solid ${category.color}30`,
              "&:before": { display: "none" },
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMore />}
              sx={{
                bgcolor: `${category.color}10`,
                "&:hover": { bgcolor: `${category.color}20` },
                minHeight: 70,
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
                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: "50%",
                      bgcolor: category.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <RestaurantMenu sx={{ color: "white", fontSize: 24 }} />
                  </Box>
                  <Box>
                    <Typography
                      variant="h6"
                      fontWeight="bold"
                      color={category.color}
                    >
                      {category.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {category.meals.length} منتج
                    </Typography>
                  </Box>
                </Box>
                <Chip
                  icon={<Inventory sx={{ fontSize: 16 }} />}
                  label={`${category.meals.length}`}
                  size="small"
                  sx={{ bgcolor: `${category.color}20`, color: category.color }}
                />
              </Box>
            </AccordionSummary>

            <AccordionDetails sx={{ p: 2 }}>
              <Grid container spacing={2}>
                {category.meals.map((meal) => (
                  <Grid
                    size={{ xs: 12, lg: 2 }}
                    xs={12}
                    sm={6}
                    md={4}
                    lg={1.5}
                    key={meal.id}
                  >
                    <MealCard
                      meal={meal}
                      categoryColor={category.color}
                      tempQuantity={tempQuantities[meal.id]}
                      onQuantityChange={updateTempQuantity}
                      onAddToCart={handleAddToCart}
                      onOpenOptions={openOptionDialog}
                    />
                  </Grid>
                ))}
              </Grid>
            </AccordionDetails>
          </Accordion>
        ))
      )}

      {/* جدول المبيعات */}
      <Paper sx={{ mt: 4, p: 2, overflow: "auto" }}>
        <Typography variant="h6" sx={{ mb: 2, color: "#4cc9f0", display: "flex", alignItems: "center", gap: 1 }}>
          <ShoppingCart /> جدول المبيعات (اليوم)
        </Typography>
        {loadingSales ? (
          <Typography color="text.secondary">جاري التحميل...</Typography>
        ) : salesOrders.length === 0 ? (
          <Typography color="text.secondary">لا توجد مبيعات اليوم</Typography>
        ) : (
          <TableContainer>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow sx={{ bgcolor: "#4cc9f020" }}>
                  <TableCell><strong>رقم الطلب</strong></TableCell>
                  <TableCell><strong>التاريخ والوقت</strong></TableCell>
                  <TableCell><strong>المبلغ</strong></TableCell>
                  <TableCell><strong>طريقة الدفع</strong></TableCell>
                  <TableCell align="center"><strong>إرجاع الطلب</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {salesOrders.map((order) => (
                  <TableRow key={order.id} hover>
                    <TableCell>{order.order_number}</TableCell>
                    <TableCell>
                      {order.created_at
                        ? new Date(order.created_at).toLocaleString("ar-EG", {
                            dateStyle: "short",
                            timeStyle: "short",
                          })
                        : "—"}
                    </TableCell>
                    <TableCell>{formatMoney(order.paid_amount ?? order.total ?? 0)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={order.payment_method === "app" ? "تطبيق" : "كاش"}
                        icon={order.payment_method === "app" ? <PhoneAndroid sx={{ fontSize: 16 }} /> : <Payment sx={{ fontSize: 16 }} />}
                        sx={{ bgcolor: order.payment_method === "app" ? "#e3f2fd" : "#e8f5e9" }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        startIcon={<Undo />}
                        disabled={returningId === order.id}
                        onClick={() => handleReturnOrder(order.id)}
                      >
                        {returningId === order.id ? "جاري..." : "إرجاع الطلب"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Options Dialog */}
      <Dialog
        open={optionDialog.open}
        onClose={() => setOptionDialog({ ...optionDialog, open: false })}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: "#4ccaf04d", color: "white" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <RestaurantMenu />
            <Typography variant="h6">اختر الاصناف</Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ mt: 3 }}>
          {optionDialog.meal && (
            <Box>
              <Stack direction={"row"} justifyContent={"space-between"} gap={2}>
                <Box
                  sx={{ mb: 3, display: "flex", alignItems: "center", gap: 2 }}
                >
                  <Typography variant="body1">الكمية:</Typography>
                  <TextField
                    size="small"
                    type="number"
                    value={optionDialog.quantity ?? 1}
                    onChange={(e) =>
                      setOptionDialog((prev) => ({
                        ...prev,
                        quantity: parseFloat(e.target.value) || 0.01,
                      }))
                    }
                    inputProps={{
                      min: 0.01,
                      step: 0.01,
                      style: { width: 80, textAlign: "center" },
                    }}
                  />
                </Box>{" "}
                <Typography
                  variant="h5"
                  fontWeight="bold"
                  color="#4cc9f0"
                  gutterBottom
                >
                  {optionDialog.meal.name}
                </Typography>
              </Stack>
              {Object.entries(
                optionDialog.meal.options?.reduce((groups, opt) => {
                  const group = opt.group_name || "أخرى";
                  if (!groups[group]) groups[group] = [];
                  groups[group].push(opt);
                  return groups;
                }, {}) || {},
              ).map(([groupName, options]) => (
                <Paper key={groupName} sx={{ p: 2, mb: 2 }}>
                  <Typography
                    variant="subtitle1"
                    fontWeight="bold"
                    sx={{ mb: 1 }}
                  >
                    {groupName}
                  </Typography>
                  <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 1 }}
                  >
                    {options.map((opt) => {
                      const finalPrice =
                        parseFloat(optionDialog.meal.sale_price) +
                        parseFloat(opt.price);
                      return (
                        <Card
                          key={opt.id}
                          sx={{
                            p: 1,
                            cursor: "pointer",
                            border: "1px solid #e0e0e0",
                            transition: "all 0.2s",
                            "&:hover": {
                              transform: "translateX(-4px)",
                              boxShadow: 2,
                            },
                          }}
                          onClick={() => {
                            handleAddToCart(
                              optionDialog.meal,
                              [opt],
                              optionDialog.quantity || 1,
                            );
                            setOptionDialog({ ...optionDialog, open: false });
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <Box>
                              <Typography variant="body1" fontWeight="medium">
                                {opt.name}
                              </Typography>
                              {opt.additional_cost > 0 && (
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  تكلفة إضافية: +{opt.additional_cost} شيكل
                                </Typography>
                              )}
                            </Box>
                            <Box sx={{ textAlign: "left" }}>
                              <Typography
                                variant="body1"
                                fontWeight="bold"
                                color="#4cc9f0"
                              >
                                {formatMoney(finalPrice)}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                (أساسي + {opt.price})
                              </Typography>
                            </Box>
                          </Box>
                        </Card>
                      );
                    })}
                  </Box>
                </Paper>
              ))}
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setOptionDialog({ ...optionDialog, open: false })}
            variant="outlined"
          >
            إلغاء
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
