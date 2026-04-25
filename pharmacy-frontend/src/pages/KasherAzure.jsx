import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Box,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Card,
  Paper,
  alpha,
  TextField,
  InputAdornment,
} from "@mui/material";
import Add from "@mui/icons-material/Add";
import Remove from "@mui/icons-material/Remove";
import LunchDining from "@mui/icons-material/LunchDining";
import Egg from "@mui/icons-material/Egg";
import LocalBar from "@mui/icons-material/LocalBar";
import Icecream from "@mui/icons-material/Icecream";
import RestaurantMenu from "@mui/icons-material/RestaurantMenu";
import Print from "@mui/icons-material/Print";
import LocalOffer from "@mui/icons-material/LocalOffer";
import Payment from "@mui/icons-material/Payment";
import PhoneAndroid from "@mui/icons-material/PhoneAndroid";
import Search from "@mui/icons-material/Search";
import axios from "axios";
import { confirmApp, showAppAlert, showAppToast } from "../utils/appToast";

const API_BASE_URL = "http://127.0.0.1:8000/api";

/** Azure Nocturne — من تصميم Stitch */
const COL = {
  primary: "#42A5F5",
  bg: "#0B0E14",
  surface: "#161B22",
  surfaceLight: "#21262D",
  outline: "#30363D",
  secondary: "#8B949E",
  textMain: "#F0F6FC",
  onPrimary: "#0B0E14",
};

const neonGlow = {
  boxShadow: "0 0 15px rgba(66, 165, 245, 0.3)",
};
const neonText = {
  textShadow: "0 0 8px rgba(66, 165, 245, 0.4)",
};

const PLACEHOLDER_IMAGES = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCQUUyAQa45PgdX3revN_DFVgnCnqxINBPNeZqdb_smRT46aszJPtHDsyQc6D7OnGPLpmli9rTFgjPoSLLCE8UUXmYXSgvJqttRJYYwQKRAUB_Wxh8XF3slR4uAKvmnlR2AeXx6zW_pGTulGGvYlUgYSCPE9EoujrJgdnLV--RDrPCOYO_J_lBs04Rm4aQhHiYaBcaYPl20-ipyUolQ2BqapbWyaI3RMp5JFa1P0W9vZcMKIflAoeLteXSI9uujmtRY3qBWlxEzJlM",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCsem_2Q1486SH2ir6YJQqcsjT7y0bR5Hu4D8HfOoHkCXEUsHxTI6onJCDvPvb9EeXbEpybDjQdZulWjtggzJqjrsmyMY2MvOXmQB2GOMHGK5YKDbtedWx6dw0orHd4OMqi83lYhHEOcWOf_5sDVwHLP5CllrVeCACAPfR14-q-kGmi0l3G8QfeMKb5t21qNsSIA4IOWYUSBBQEgUq9OqQoRjovcAJDsMfNwVGYf8QWL8uJIzWWkBGUeq63F6kVgFxjIastgH3i-ZU",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBuWkOzX7pdukYyFo4KQOLyOu5s2BgRxXg7wZ4hiibrNcCxQIB2CY9MNWT0qxyV9zwqDgzPy-tKn3I8T2VXIDTUbQiM4AlDOB8CYMIIqtPMaIvroJf2dLf8YFmKNrHMAEAEtCwBNK5zHrtmaEbfYnccay9ljqVi1XGg6uqgjYzN6d8cVPVU3_mnjS86PN3CyuWvN5Cr6eRENjVfdLrTCohyhtla8DnXH8NiAB83sLm31ts5qU4k4zFARnp5pGhrQvxl9yeEemnCvJg",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDelHwq4m1jHKWEqaB-uSz5ijgftrM3ZFX8fl779bjdqvrvqZhHZg7einxXmrRJB4qSMsYhHvocQJJVHQ4NkuyshrRFj6UbJpc-iQ1xXVevrK8Q2aK-SYOdXrd4SGaxxQzqzH3_uycV9t_mzJm7GOAoCtm064fZOdzCMduz8SQ3L3w3a_BaPYwJvpykXIqy2CTeHtLIUAzuPau-KglpR7OyxY2blSW5Kk35XH7sJd0yJgUteVpIf4mz4BbXuIknHAwNOYTMtSqxdZc",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCs91dpKn6s0q6qA2fgHCZ2rHzpqMaw0GePaQOhlHSzqNpF7lOWbyHeqs6_u-oSV-oh4sUZZ9grXT73LK3jiKz0Lpd43PRmZVREE5GHjGnArEMasuvtEhhbujvDMd4YjRqH_wnCPhCUAdKvhslmzYwp8u4AAw1aPJdXKhsk1zHo0xQYf66tC-Y5cV42S54Z3n897RLaubvCeFJisc22FM4bIggeV3YWa-IUoRZsZWQz_hEFRy_SAGrYQQK6Y6ttDLYd16YSwVDNsdc",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAQtOLSlOpyjRR6Hl_71ew34ESe2_wENZtTWEZ9Ogb0SK3oqV63V5ur-dInW2yz1SivBYKfaBrKL_vHuHvjfma4AxcXsD4HKFhUrJiN4Ll9NJrwXOhNRCp1zrj2cVoV3JmbyM-Vt-De2aTM7xslP6f_b0f0pOmR9iwCeMftWAaXGcRSQiP1A_uK4Ysdh1aCz0WyeFskkupN1lubw4K8-BPpJSCzwN49sogOnbWvU3Dd60Wx_scfyXIQsVRckBT9he1xMxawCyvcn-M",
];

const THUMB_IMAGES = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuCOLhvCOUB1DB40-JujffPV7edXD8HP9b0W2ckpREMBTX1Y1zszWTq6ea28DH1Zv-_KGbGenlAxfVOEXEka0CYpgMmP2Dz0L9y1vmEqm7vatFew9cKBJ_hb_MEvBitv7-NW6jk_HqBnIchqxn6DP774-3C9D64iPS-cxYLjCl5h8r_Fp4CejH3j4tIWMNWgd1lj2d6d8it7bVtzSomYiMKaxYB5kkfinJIIUSd-SZ5jynLY2dErssenER7j-gw895onkVICLP-QmwU",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuBVBtyc7wK-cn50aECohZaHVLz9xBpOV-qetK6kjd3u_i_uUXYwrgniaxwb8MdpGmA5EWrch2WchpOSkih9UjI9Nf5QLacFtxLp0J35fXKolrxQ2-hbKBc1Kd0MzGqt2uqOul_ZtIfUqDVYbBcSBIsBBaIDlvS3zk6pq7QuWpG6f2kVS8QUUK1STw8GWCAYmZ96bjqYmuSHd0vPDDnuSW5VyD_qxfT03U_Z3FILX6TlSwXEuQIZGg6tuzCynLd3KIlah_Lu8C5fRek",
];

const CATEGORY_ICONS = [LunchDining, Egg, LocalBar, Icecream];
const COLOR_MAP = { default: "#8B949E" };

const calculateItemTotal = (item) => (item.price || 0) * (item.quantity || 1);
const calculateCartTotal = (items) =>
  items.reduce((sum, item) => sum + calculateItemTotal(item), 0);

const arPrice = (n) =>
  n != null && !Number.isNaN(Number(n))
    ? Number(n).toLocaleString("ar-SA", {
        minimumFractionDigits: Number(n) % 1 !== 0 ? 2 : 0,
        maximumFractionDigits: 2,
      })
    : "0";

function getMealImage(meal, idx) {
  const u = meal?.image_url || meal?.image || meal?.photo;
  if (u && String(u).startsWith("http")) return u;
  return PLACEHOLDER_IMAGES[Math.abs(idx) % PLACEHOLDER_IMAGES.length];
}

function getThumbForItem(item, idx) {
  if (item.imageUrl) return item.imageUrl;
  return THUMB_IMAGES[idx % THUMB_IMAGES.length];
}

export default function KasherAzure() {
  const [meals, setMeals] = useState([]);
  const [cartItems, setCartItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [filterTab, setFilterTab] = useState("all");
  const [serviceType, setServiceType] = useState("dine-in");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [searchTerm, setSearchTerm] = useState("");
  const [optionDialog, setOptionDialog] = useState({ open: false, meal: null, quantity: 1 });

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${API_BASE_URL}/meals/all-with-details`);
        if (data.success) {
          setMeals((data.data.meals || []).map((m) => ({ ...m, isAvailable: m.is_available ?? true })));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const categories = useMemo(() => {
    if (!meals.length) return [];
    const grouped = meals.reduce((acc, meal) => {
      const name = meal.category?.name || "أخرى";
      if (!acc[name]) acc[name] = [];
      acc[name].push(meal);
      return acc;
    }, {});
    return Object.entries(grouped)
      .map(([name, ms]) => ({
        id: name,
        name,
        meals: ms,
        color: COLOR_MAP[name] || COLOR_MAP.default,
      }))
      .sort((a, b) => b.meals.length - a.meals.length);
  }, [meals]);

  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categories;
    const t = searchTerm.toLowerCase();
    return categories
      .map((c) => ({
        ...c,
        meals: c.meals.filter((m) => m.name.toLowerCase().includes(t)),
      }))
      .filter((c) => c.meals.length > 0);
  }, [categories, searchTerm]);

  useEffect(() => {
    if (categories.length && selectedCategoryId == null) setSelectedCategoryId(categories[0].id);
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    if (!filteredCategories.length) return;
    const ok = filteredCategories.some((c) => c.id === selectedCategoryId);
    if (!ok) setSelectedCategoryId(filteredCategories[0].id);
  }, [filteredCategories, selectedCategoryId]);

  const activeCategory = filteredCategories.find((c) => c.id === selectedCategoryId);

  const displayMeals = useMemo(() => {
    if (!activeCategory) return [];
    let list = activeCategory.meals;
    if (filterTab === "bestsellers") list = [...list].slice(0, Math.min(8, list.length));
    else if (filterTab === "new") list = [...list].slice(-Math.min(6, list.length));
    return list;
  }, [activeCategory, filterTab]);

  const subtotal = calculateCartTotal(cartItems);
  const tax = subtotal * 0.15;
  const totalWithTax = subtotal + tax;

  const handleAddToCart = useCallback((meal, options = [], quantity = 1) => {
    const qty = parseFloat(quantity) || 1;
    if (qty <= 0) return;
    const optionsTotal = options.reduce((s, o) => s + (parseFloat(o.price) || 0), 0);
    const finalPrice = parseFloat(meal.sale_price) + optionsTotal;
    const imageUrl = getMealImage(meal, meal.id);

    setCartItems((prev) => {
      const existing = prev.findIndex(
        (item) =>
          item.mealId === meal.id &&
          JSON.stringify((item.options || []).map((o) => o.id).sort()) ===
            JSON.stringify(options.map((o) => o.id).sort()),
      );
      if (existing !== -1) {
        const u = [...prev];
        const q = u[existing].quantity + qty;
        u[existing] = { ...u[existing], quantity: q, total: q * finalPrice };
        return u;
      }
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
          options,
          imageUrl,
        },
      ];
    });
  }, []);

  const handleQuickAdd = useCallback(
    (meal) => {
      if (meal.options?.length) setOptionDialog({ open: true, meal, quantity: 1 });
      else handleAddToCart(meal, [], 1);
    },
    [handleAddToCart],
  );

  const handleUpdateQty = useCallback((id, delta) => {
    setCartItems((prev) => {
      const next = prev
        .map((item) => {
          if (item.id !== id) return item;
          const q = item.quantity + delta;
          if (q <= 0) return null;
          return { ...item, quantity: q, total: q * item.price };
        })
        .filter(Boolean);
      return next;
    });
  }, []);

  const clearCart = useCallback(async () => {
    if (!cartItems.length) return;
    const ok = await confirmApp({
      title: "مسح السلة",
      text: "هل تريد مسح كل العناصر من السلة؟",
      icon: "warning",
      confirmText: "نعم، امسح",
    });
    if (ok) setCartItems([]);
  }, [cartItems.length]);

  const handleCheckout = async () => {
    if (!cartItems.length) return;
    try {
      const pm = paymentMethod === "app" ? "app" : "cash";
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
        paid_amount: subtotal,
        payment_method: pm,
        cash_amount: pm === "app" ? 0 : subtotal,
        app_amount: pm === "app" ? subtotal : 0,
      });
      showAppToast("تم تأكيد الطلب بنجاح", "success");
      setCartItems([]);
    } catch (e) {
      showAppToast(e.response?.data?.message || "حدث خطأ", "error");
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 280,
          bgcolor: COL.bg,
          color: COL.textMain,
          fontFamily: '"Plus Jakarta Sans", sans-serif',
        }}
      >
        جاري التحميل...
      </Box>
    );
  }

  return (
    <Box
      sx={{
        fontFamily: '"Plus Jakarta Sans", "Inter", sans-serif',
        m: -3,
        width: "calc(100% + 48px)",
        maxWidth: "100vw",
        minHeight: { xs: "auto", md: "calc(100vh - 64px - 48px)" },
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
        bgcolor: COL.bg,
        color: COL.textMain,
        overflow: { md: "hidden" },
      }}
    >
      {/* أقسام */}
      <Box
        component="aside"
        sx={{
          width: { xs: "100%", md: 128 },
          flexShrink: 0,
          bgcolor: COL.surface,
          borderLeft: { md: `1px solid ${COL.outline}` },
          borderBottom: { xs: `1px solid ${COL.outline}`, md: "none" },
          display: "flex",
          flexDirection: { xs: "row", md: "column" },
          alignItems: "center",
          py: { xs: 1.5, md: 3 },
          gap: { xs: 1, md: 2 },
          overflowX: { xs: "auto", md: "hidden" },
          justifyContent: { xs: "center", md: "flex-start" },
        }}
      >
        {filteredCategories.map((cat, idx) => {
          const Icon = CATEGORY_ICONS[idx % CATEGORY_ICONS.length];
          const sel = selectedCategoryId === cat.id;
          return (
            <Button
              key={cat.id}
              onClick={() => setSelectedCategoryId(cat.id)}
              sx={{
                flexDirection: "column",
                gap: 1,
                minWidth: 72,
                color: sel ? COL.primary : COL.secondary,
                opacity: sel ? 1 : 0.75,
                "&:hover": { opacity: 1 },
              }}
            >
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  bgcolor: sel ? COL.primary : COL.bg,
                  color: sel ? COL.onPrimary : COL.secondary,
                  border: sel ? "none" : `1px solid ${COL.outline}`,
                  ...(sel ? neonGlow : {}),
                  transition: "transform 0.2s",
                  "&:hover": { transform: "scale(1.05)" },
                }}
              >
                <Icon sx={{ fontSize: 26 }} />
              </Box>
              <Typography variant="caption" sx={{ fontWeight: sel ? 800 : 600, fontSize: "0.7rem" }}>
                {cat.name}
              </Typography>
            </Button>
          );
        })}
      </Box>

      {/* وسط: بحث + شبكة */}
      <Box
        component="section"
        sx={{
          flex: 1,
          bgcolor: COL.bg,
          p: { xs: 2, md: 3 },
          overflowY: "auto",
          minWidth: 0,
        }}
      >
        <TextField
          fullWidth
          size="small"
          placeholder="البحث عن صنف..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ color: COL.secondary, fontSize: 22 }} />
              </InputAdornment>
            ),
          }}
          sx={{
            mb: 3,
            maxWidth: 400,
            "& .MuiOutlinedInput-root": {
              bgcolor: COL.bg,
              borderRadius: 2,
              color: COL.textMain,
              "& fieldset": { borderColor: COL.outline },
              "&:hover fieldset": { borderColor: alpha(COL.primary, 0.5) },
              "&.Mui-focused fieldset": { borderColor: COL.primary },
            },
            "& input::placeholder": { color: COL.secondary },
          }}
        />

        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 3, flexWrap: "wrap", gap: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 800, display: "flex", alignItems: "center", gap: 1, color: "#e2e8f0" }}>
            <RestaurantMenu sx={{ color: COL.primary, ...neonText, fontSize: 28 }} />
            {activeCategory ? `قائمة ${activeCategory.name}` : "المنتجات"}
          </Typography>
          <Stack direction="row" spacing={1}>
            {[
              { key: "bestsellers", label: "الأكثر مبيعاً" },
              { key: "new", label: "جديد" },
            ].map(({ key, label }) => (
              <Button
                key={key}
                size="small"
                onClick={() => setFilterTab((prev) => (prev === key ? "all" : key))}
                sx={{
                  px: 2,
                  py: 1,
                  borderRadius: 1,
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  bgcolor: COL.surface,
                  color: "#cbd5e1",
                  border: `1px solid ${COL.outline}`,
                  ...(filterTab === key && {
                    borderColor: alpha(COL.primary, 0.5),
                    color: COL.primary,
                  }),
                }}
              >
                {label}
              </Button>
            ))}
          </Stack>
        </Box>

        {displayMeals.length === 0 ? (
          <Typography sx={{ color: COL.secondary, textAlign: "center", py: 6 }}>لا توجد أصناف</Typography>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2,1fr)", lg: "repeat(3,1fr)", xl: "repeat(4,1fr)" },
              gap: 3,
            }}
          >
            {displayMeals.map((meal, i) => {
              const img = getMealImage(meal, meal.id + i);
              const desc = meal.description || meal.desc || "طبق من قائمة المطعم";
              const popular = i === 0 || meal.is_popular;
              return (
                <Card
                  key={meal.id}
                  elevation={0}
                  sx={{
                    bgcolor: COL.surface,
                    border: `1px solid ${COL.outline}`,
                    borderRadius: 3,
                    p: 2,
                    transition: "all 0.2s",
                    "&:hover": {
                      borderColor: alpha(COL.primary, 0.5),
                      boxShadow: `0 12px 40px ${alpha(COL.primary, 0.08)}`,
                      "& .meal-img": { filter: "grayscale(0)" },
                    },
                  }}
                >
                  <Box
                    sx={{
                      position: "relative",
                      aspectRatio: "16/10",
                      borderRadius: 2,
                      overflow: "hidden",
                      mb: 2,
                      border: `1px solid ${COL.outline}`,
                    }}
                  >
                    <Box
                      component="img"
                      className="meal-img"
                      src={img}
                      alt=""
                      sx={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        filter: "grayscale(20%)",
                        transition: "filter 0.3s",
                      }}
                    />
                    {popular && (
                      <Box
                        sx={{
                          position: "absolute",
                          top: 8,
                          left: 8,
                          bgcolor: COL.primary,
                          color: COL.onPrimary,
                          fontSize: "0.65rem",
                          fontWeight: 800,
                          px: 1,
                          py: 0.25,
                          borderRadius: 1,
                          ...neonGlow,
                        }}
                      >
                        شائع
                      </Box>
                    )}
                  </Box>
                  <Typography sx={{ fontWeight: 800, fontSize: "1.05rem", mb: 0.5, color: "#e2e8f0" }}>{meal.name}</Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      color: COL.secondary,
                      display: "-webkit-box",
                      WebkitLineClamp: 1,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      mb: 2,
                      fontSize: "0.75rem",
                    }}
                  >
                    {desc}
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <Typography sx={{ color: COL.primary, fontWeight: 800, fontSize: "1.25rem", ...neonText }}>
                      {arPrice(meal.sale_price)} <Box component="span" sx={{ fontSize: "0.75rem" }}>ر.س</Box>
                    </Typography>
                    <IconButton
                      onClick={() => handleQuickAdd(meal)}
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        bgcolor: COL.primary,
                        color: COL.onPrimary,
                        ...neonGlow,
                        "&:hover": { bgcolor: alpha(COL.primary, 0.9), filter: "brightness(1.1)" },
                      }}
                    >
                      <Add />
                    </IconButton>
                  </Box>
                </Card>
              );
            })}
          </Box>
        )}
      </Box>

      {/* طلب حالي */}
      <Box
        component="aside"
        sx={{
          width: { xs: "100%", md: 380 },
          flexShrink: 0,
          bgcolor: COL.surface,
          borderRight: { md: `1px solid ${COL.outline}` },
          display: "flex",
          flexDirection: "column",
          boxShadow: { md: "-4px 0 24px rgba(0,0,0,0.4)" },
        }}
      >
        <Box sx={{ p: 2.5, borderBottom: `1px solid ${COL.outline}` }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
            <Typography sx={{ fontWeight: 800, fontSize: "1.15rem" }}>الطلب الحالي</Typography>
            <Button size="small" onClick={clearCart} sx={{ color: COL.secondary, fontSize: "0.7rem", fontWeight: 700 }}>
              مسح الكل
            </Button>
          </Box>
          <Box sx={{ display: "flex", gap: 1, p: 0.5, bgcolor: COL.bg, borderRadius: 2, border: `1px solid ${COL.outline}` }}>
            <Button
              fullWidth
              onClick={() => setServiceType("dine-in")}
              sx={{
                py: 1,
                borderRadius: 1.5,
                fontWeight: 800,
                fontSize: "0.85rem",
                bgcolor: serviceType === "dine-in" ? COL.primary : "transparent",
                color: serviceType === "dine-in" ? COL.onPrimary : COL.secondary,
                boxShadow: serviceType === "dine-in" ? "0 4px 14px rgba(66,165,245,0.35)" : "none",
              }}
            >
              محلي
            </Button>
            <Button
              fullWidth
              onClick={() => setServiceType("takeaway")}
              sx={{
                py: 1,
                borderRadius: 1.5,
                fontWeight: 800,
                fontSize: "0.85rem",
                bgcolor: serviceType === "takeaway" ? COL.primary : "transparent",
                color: serviceType === "takeaway" ? COL.onPrimary : COL.secondary,
              }}
            >
              سفري
            </Button>
          </Box>
        </Box>

        <Box sx={{ flex: 1, overflowY: "auto", p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
          {cartItems.length === 0 ? (
            <Typography sx={{ color: COL.secondary, textAlign: "center", py: 4 }}>السلة فارغة</Typography>
          ) : (
            cartItems.map((item, idx) => (
              <Box
                key={item.id}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                  p: 1,
                  borderRadius: 2,
                  border: "1px solid transparent",
                  "&:hover": { borderColor: COL.outline, bgcolor: alpha(COL.bg, 0.3) },
                }}
              >
                <Box sx={{ width: 56, height: 56, borderRadius: 2, overflow: "hidden", border: `1px solid ${COL.outline}`, flexShrink: 0 }}>
                  <Box component="img" src={getThumbForItem(item, idx)} alt="" sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={700} noWrap>
                    {item.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: COL.primary, fontWeight: 800 }}>
                    {arPrice(item.price)} ر.س
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, bgcolor: COL.bg, border: `1px solid ${COL.outline}`, borderRadius: 1.5, p: 0.5 }}>
                  <IconButton size="small" onClick={() => handleUpdateQty(item.id, -1)} sx={{ width: 26, height: 26, color: "#cbd5e1" }}>
                    <Remove sx={{ fontSize: 16 }} />
                  </IconButton>
                  <Typography sx={{ width: 28, textAlign: "center", fontWeight: 800, fontSize: "0.85rem" }}>
                    {Number(item.quantity).toLocaleString("ar-SA")}
                  </Typography>
                  <IconButton size="small" onClick={() => handleUpdateQty(item.id, 1)} sx={{ width: 26, height: 26, color: "#cbd5e1" }}>
                    <Add sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
              </Box>
            ))
          )}
        </Box>

        <Paper
          elevation={0}
          sx={{
            p: 2.5,
            bgcolor: alpha(COL.bg, 0.5),
            borderTop: `1px solid ${COL.outline}`,
            borderRadius: 0,
          }}
        >
          <Stack spacing={1.5}>
            <Box sx={{ display: "flex", justifyContent: "space-between", color: COL.secondary, fontSize: "0.9rem" }}>
              <span>المجموع الفرعي:</span>
              <span style={{ color: "#cbd5e1" }}>{arPrice(subtotal)} ر.س</span>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", color: COL.secondary, fontSize: "0.9rem" }}>
              <span>الضريبة (١٥٪):</span>
              <span style={{ color: "#cbd5e1" }}>{arPrice(tax)} ر.س</span>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", pt: 2, borderTop: `1px solid ${COL.outline}` }}>
              <Typography sx={{ fontWeight: 800 }}>الإجمالي:</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: "1.6rem", color: COL.primary, ...neonText }}>
                {arPrice(totalWithTax)} ر.س
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<Print sx={{ fontSize: 18 }} />}
              onClick={() => window.print()}
              sx={{ borderColor: COL.outline, color: "#cbd5e1", py: 1.5, fontSize: "0.75rem", fontWeight: 700 }}
            >
              طباعة المسودة
            </Button>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<LocalOffer sx={{ fontSize: 18 }} />}
              onClick={() =>
                showAppAlert("ميزة الخصم قيد التطوير وستُفعَّل قريباً.", "info", "قريباً")
              }
              sx={{ borderColor: COL.outline, color: "#cbd5e1", py: 1.5, fontSize: "0.75rem", fontWeight: 700 }}
            >
              خصم
            </Button>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
            <Button
              fullWidth
              size="small"
              variant={paymentMethod === "cash" ? "contained" : "outlined"}
              startIcon={<Payment />}
              onClick={() => setPaymentMethod("cash")}
              sx={{
                bgcolor: paymentMethod === "cash" ? COL.primary : "transparent",
                color: paymentMethod === "cash" ? COL.onPrimary : COL.secondary,
                borderColor: COL.outline,
              }}
            >
              كاش
            </Button>
            <Button
              fullWidth
              size="small"
              variant={paymentMethod === "app" ? "contained" : "outlined"}
              startIcon={<PhoneAndroid />}
              onClick={() => setPaymentMethod("app")}
              sx={{
                bgcolor: paymentMethod === "app" ? COL.primary : "transparent",
                color: paymentMethod === "app" ? COL.onPrimary : COL.secondary,
                borderColor: COL.outline,
              }}
            >
              تطبيق
            </Button>
          </Stack>

          <Button
            fullWidth
            onClick={handleCheckout}
            disabled={!cartItems.length}
            sx={{
              mt: 2,
              py: 2,
              borderRadius: 2,
              fontWeight: 800,
              fontSize: "1.05rem",
              bgcolor: COL.primary,
              color: COL.onPrimary,
              boxShadow: "0 8px 24px rgba(66,165,245,0.25)",
              "&:hover": { bgcolor: alpha(COL.primary, 0.92), filter: "brightness(1.08)" },
              "&:disabled": { bgcolor: alpha(COL.outline, 0.5) },
            }}
          >
            تأكيد الطلب والدفع
          </Button>
        </Paper>
      </Box>

      <Dialog
        open={optionDialog.open}
        onClose={() => setOptionDialog((p) => ({ ...p, open: false }))}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { bgcolor: COL.surface, border: `1px solid ${COL.outline}` } }}
      >
        <DialogTitle sx={{ color: COL.textMain, fontWeight: 800 }}>اختر الإضافات — {optionDialog.meal?.name}</DialogTitle>
        <DialogContent>
          {optionDialog.meal?.options?.length > 0 &&
            Object.entries(
              optionDialog.meal.options.reduce((groups, opt) => {
                const g = opt.group_name || "أخرى";
                if (!groups[g]) groups[g] = [];
                groups[g].push(opt);
                return groups;
              }, {}),
            ).map(([groupName, options]) => (
              <Box key={groupName} sx={{ mb: 2 }}>
                <Typography sx={{ color: COL.primary, fontWeight: 700, mb: 1 }}>{groupName}</Typography>
                <Stack spacing={1}>
                  {options.map((opt) => {
                    const finalPrice = parseFloat(optionDialog.meal.sale_price) + parseFloat(opt.price || 0);
                    return (
                      <Paper
                        key={opt.id}
                        elevation={0}
                        onClick={() => {
                          handleAddToCart(optionDialog.meal, [opt], optionDialog.quantity || 1);
                          setOptionDialog((p) => ({ ...p, open: false }));
                        }}
                        sx={{
                          p: 2,
                          cursor: "pointer",
                          bgcolor: COL.bg,
                          border: `1px solid ${COL.outline}`,
                          borderRadius: 2,
                          "&:hover": { borderColor: COL.primary },
                        }}
                      >
                        <Box sx={{ display: "flex", justifyContent: "space-between" }}>
                          <Typography fontWeight={600}>{opt.name}</Typography>
                          <Typography sx={{ color: COL.primary, fontWeight: 800 }}>{arPrice(finalPrice)} ر.س</Typography>
                        </Box>
                      </Paper>
                    );
                  })}
                </Stack>
              </Box>
            ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOptionDialog((p) => ({ ...p, open: false }))} sx={{ color: COL.secondary }}>
            إلغاء
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
