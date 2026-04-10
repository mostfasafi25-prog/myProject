import React, { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Button,
  Menu,
  MenuItem,
  TextField,
  IconButton,
  Box,
  Stack,
  Typography,
  Paper,
  CircularProgress,
  Alert,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import Collapse from "@mui/material/Collapse";
import { showAppToast } from "../utils/appToast";

const API_BASE_URL = "http://127.0.0.1:8000/api";

export default function Test() {
  const [anchorEl, setAnchorEl] = useState(null);
  const [currentCell, setCurrentCell] = useState(null);
  const [data, setData] = useState({});
  const [categories, setCategories] = useState([]);
  const [categoryProducts, setCategoryProducts] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [productsLoading, setProductsLoading] = useState({});
  const [openMeal, setOpenMeal] = useState(null);
  const [openCategory, setOpenCategory] = useState({});

  const toggleCategory = (meal, categoryId) => {
    const key = `${meal}-${categoryId}`;
    setOpenCategory((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // جلب الأقسام عند التحميل
  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/categories`);
      const result = await response.json();

      if (result.success) {
        setCategories(result.data);
      } else {
        setError("فشل في جلب الأقسام");
      }
    } catch (err) {
      setError("حدث خطأ في الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  // جلب منتجات قسم معين
  const fetchCategoryProducts = async (categoryId) => {
    setProductsLoading((prev) => ({ ...prev, [categoryId]: true }));

    try {
      const response = await fetch(
        `${API_BASE_URL}/categories/${categoryId}/all-products`,
      );
      const result = await response.json();

      if (result.success) {
        setCategoryProducts((prev) => ({
          ...prev,
          [categoryId]: result.data.products,
        }));
        return result.data.products;
      } else {
        console.error("فشل في جلب المنتجات:", result.message);
        return [];
      }
    } catch (err) {
      console.error("حدث خطأ في الاتصال:", err);
      return [];
    } finally {
      setProductsLoading((prev) => ({ ...prev, [categoryId]: false }));
    }
  };

  const openMenu = async (e, meal, categoryId) => {
    setAnchorEl(e.currentTarget);
    // إضافة sub1 هنا
    setCurrentCell({
      meal,
      categoryId,
      fullKey: `${meal}-${categoryId}-sub1`, // 👈 المفتاح الكامل
    });

    // إذا لم تكن المنتجات محملة لهذا القسم، جلبها
    if (!categoryProducts[categoryId]) {
      await fetchCategoryProducts(categoryId);
    }
  };

  const addItem = (product) => {
    if (!currentCell) return;

    // استخدام fullKey بدلاً من بناء المفتاح
    const key = currentCell.fullKey;
    const items = data[key] || [];

    // التحقق من عدم وجود المنتج مسبقاً
    if (items.find((i) => i.id === product.id)) return;

    setData({
      ...data,
      [key]: [
        ...items,
        {
          id: product.id,
          name: product.name,
          qty: 0,
          price: parseFloat(product.price) || 0,
          available: parseInt(product.stock) || 0,
        },
      ],
    });

    setAnchorEl(null);
  };

  const updateQty = (key, index, value) => {
    const updated = [...data[key]];
    const maxAvailable = updated[index].available;
    const newQty = Math.max(0, Math.min(value, maxAvailable));
    updated[index].qty = newQty;
    setData({ ...data, [key]: updated });
  };

  const removeItem = (key, index) => {
    const updated = [...data[key]];
    updated.splice(index, 1);
    setData({ ...data, [key]: updated });
  };

  const mealTotal = (meal) => {
    let total = 0;
    categories.forEach((category) => {
      const key = `${meal}-${category.id}`;
      (data[key] || []).forEach((item) => {
        total += item.qty * item.price;
      });
    });
    return total.toFixed(2);
  };

  const completeOrder = (meal) => {
    const mealItems = [];
    categories.forEach((category) => {
      const key = `${meal}-${category.id}`;
      (data[key] || []).forEach((item) => {
        mealItems.push({
          product_id: item.id,
          product_name: item.name,
          quantity: item.qty,
          unit_price: item.price,
          total_price: item.qty * item.price,
        });
      });
    });

    console.log(`طلبات الوجبة: ${meal}`, mealItems);
    showAppToast(`تم إرسال طلب ${meal} بـ ${mealItems.length} منتج`, "success");

    // مسح بيانات هذه الوجبة
    const newData = { ...data };
    categories.forEach((category) => {
      const key = `${meal}-${category.id}`;
      delete newData[key];
    });
    setData(newData);
  };

  if (loading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="200px"
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box p={3}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  if (categories.length === 0) {
    return (
      <Box p={3}>
        <Alert severity="info">لا توجد أقسام متاحة</Alert>
      </Box>
    );
  }

  // قائمة الوجبات (نفس الوجبات الأصلية)
  const meals = ["لحوم", "سلطات", "بهارات", "الوجبات السريعة", "اخرى"];
  const toggleMeal = (meal) => {
    setOpenMeal((prev) => (prev === meal ? null : meal));
  };
  return (
    <Box sx={{ overflowX: "auto" }}>
      <Table sx={{ minWidth: 800 }}>
        <TableHead align="center">
          <TableRow align="center">
            <TableCell align="center">القسم الرئيسي</TableCell>
            <TableCell align="center"> </TableCell>
          </TableRow>
        </TableHead>

        <TableBody>
          {meals.map((meal) => (
            <React.Fragment key={meal}>
              {/* صف العنوان */}
              <TableRow>
                <TableCell
                  align="center"
                  sx={{
                    cursor: "pointer",
                    fontWeight: "bold",
                    transition: "background 0.3s",
                  }}
                  onClick={() => toggleMeal(meal)}
                >
                  {meal}
                </TableCell>

                <TableCell colSpan={categories.length + 1}></TableCell>
              </TableRow>
              {/* صف التفاصيل */}
              <TableRow>
                <TableCell
                  colSpan={categories.length + 2}
                  sx={{ p: 0, border: 0 }}
                >
                  <Collapse in={openMeal === meal} timeout={500} unmountOnExit>
                    <Box sx={{ p: 1 }}>
                      {/* الجدول المضمّن - نسخة من الجدول الرئيسي */}
                      <Table
                        size="small"
                        sx={{
                          minWidth: 800,
                          borderRadius: 1,
                          boxShadow: 1,
                        }}
                      >
                        <TableHead>
                          <TableRow>
                            <TableCell>القسم الفرعي</TableCell>
                            {categories.map((category) => (
                              <TableCell key={`sub-${category.id}`}>
                                {category.name}
                              </TableCell>
                            ))}
                            <TableCell>إجمالي التكلفة</TableCell>
                          </TableRow>
                        </TableHead>

                        <TableBody>
                          <TableRow>
                            <TableCell>{meal} - فرعي 1</TableCell>
                            {categories.map((category) => {
                              const key = `${meal}-${category.id}-sub1`;
                              return (
                                <TableCell
                                  key={`${category.id}-sub1`}
                                  sx={{ p: 1, width: "18%" }}
                                >
                                  <Stack direction="column" spacing={0.5}>
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      onClick={(e) =>
                                        openMenu(e, meal, category.id)
                                      }
                                    >
                                      إضافة
                                    </Button>
                                    {(data[key] || []).map((item, index) => (
                                      <Paper
                                        key={item.id}
                                        variant="outlined"
                                        sx={{ p: 0.5 }}
                                      >
                                        <Stack
                                          direction="column"
                                          spacing={1}
                                          gap={1}
                                          alignItems="center"
                                        >
                                          <Stack
                                            direction={"row"}
                                            alignItems={"center"}
                                            gap={1}
                                          >
                                            {/* اسم المنتج */}
                                            <Typography
                                              variant="body2"
                                              sx={{ flex: 1 }}
                                            >
                                              {item.name}
                                            </Typography>
                                            {/* السعر */}
                                            <Typography variant="caption">
                                              {(item.qty * item.price).toFixed(
                                                2,
                                              )}
                                            </Typography>
                                            {/* حذف */}
                                            <IconButton
                                              size="small"
                                              color="error"
                                              onClick={() =>
                                                removeItem(key, index)
                                              }
                                            >
                                              <DeleteIcon fontSize="small" />
                                            </IconButton>
                                          </Stack>
                                          <Stack direction={"row"} gap={1}>
                                            <TextField
                                              label="الكمية"
                                              size="small"
                                              value={item.qty}
                                              onChange={(e) =>
                                                updateQty(
                                                  key,
                                                  index,
                                                  +e.target.value,
                                                )
                                              }
                                              sx={{ width: 60 }}
                                              inputProps={{
                                                min: 0,
                                                max: item.available,
                                              }}
                                            />{" "}
                                            <TextField
                                              label="الوزن"
                                              size="small"
                                              value={item.qty}
                                              onChange={(e) =>
                                                updateQty(
                                                  key,
                                                  index,
                                                  +e.target.value,
                                                )
                                              }
                                              sx={{ width: 60 }}
                                              inputProps={{
                                                min: 0,
                                                max: item.available,
                                              }}
                                            />
                                          </Stack>
                                          {/* الكمية */}
                                        </Stack>
                                      </Paper>
                                    ))}
                                  </Stack>
                                </TableCell>
                              );
                            })}
                            <TableCell>{/* إجمالي القسم الفرعي */}</TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </Box>
                  </Collapse>
                </TableCell>
              </TableRow>
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        sx={{ maxHeight: 300 }}
      >
        {currentCell &&
          categoryProducts[currentCell.categoryId]?.map((product) => (
            <MenuItem
              key={product.id}
              onClick={() => addItem(product)}
              disabled={!product.is_active || product.stock <= 0}
            >
              <Stack direction="column" spacing={0.5}>
                <Typography variant="body2" fontWeight="bold">
                  {product.name}
                </Typography>
                <Stack direction="row" spacing={2}>
                  <Typography variant="caption">
                    السعر: {parseFloat(product.price).toFixed(2)} شيكل
                  </Typography>
                  <Typography
                    variant="caption"
                    color={product.stock > 0 ? "success.main" : "error.main"}
                  >
                    المخزون: {product.stock}
                  </Typography>
                </Stack>
              </Stack>
            </MenuItem>
          ))}
      </Menu>
    </Box>
  );
}
