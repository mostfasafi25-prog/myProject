import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Alert,
  Paper,
  TextField,
  Button,
  CircularProgress,
  Chip,
  IconButton,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  CardContent,
  CardMedia,
  Card,
  useTheme,
  Grid,
  Stack,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CheckCircleIcon from "@mui/icons-material/CheckCircle"; // تم التصحيح هنا
import FavoriteBorder from "@mui/icons-material/FavoriteBorder";
import AddAPhoto from "@mui/icons-material/AddAPhoto";
import axios from "axios";
import Cookies from "universal-cookie";
import { showAppToast } from "../../../utils/appToast";
import { baseURL } from "../../../Api/Api";
import { motion, AnimatePresence } from "framer-motion";

// مجموعة الألوان للدارك مود
const COLORS = {
  primary: "#43c8ff",
  secondary: "#44c8ff",
  accent1: "#2ab4f0",
  accent2: "#a3e4ff",
  accent3: "#118AB2",
  accent4: "#073B4C",
  accent5: "#4ECDC4",
  success: "#06D6A0",
  warning: "#FFD166",
  error: "#EF476F",
  background: "#121212",
  surface: "#1E1E1E",
  textPrimary: "#FFFFFF",
  textSecondary: "#B0B0B0",
};

const UpdateProduct = ({ productId, onClose, onCreated }) => {
  const cookies = new Cookies();
  const token = cookies.get("userToken"); // تم نقل تعريف token هنا
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === "dark";

  // حالة التقسيط
  const [installmentWays, setInstallmentWays] = useState([]);
  const [selectedInstallments, setSelectedInstallments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: "", msg: "" });

  // حالة المنتج
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [formData, setFormData] = useState({
    name_ar: "",
    name_en: "",
    description_ar: "",
    description_en: "",
    price: "",
    price_offer: "",
    link: "",
    category_id: "",
    status: "1",
  });

  const [installmentInput, setInstallmentInput] = useState("");
  const [images, setImages] = useState([]);
  const [newImages, setNewImages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [Catagory, setCatagory] = useState([]);

  // دالة مساعدة للحصول على المعرف بشكل موحد
  const getWayId = (way) => way?.id || way?.installment_id;

  const fetchData = useCallback(async () => {
    if (!token || !productId) return;

    try {
      setLoading(true);

      // تنفيذ الطلبين بالتوازي لسرعة الأداء
      const [waysRes, productRes] = await Promise.all([
        axios.get(`${baseURL}market/get_installment_ways`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.post(
          `${baseURL}market/product/show`,
          (() => {
            const fd = new FormData();
            fd.append("id", productId);
            return fd;
          })(),
          { headers: { Authorization: `Bearer ${token}` } },
        ),
      ]);

      // معالجة طرق التقسيط المتاحة
      let ways = [];
      if (waysRes.data) {
        ways =
          waysRes.data.data?.installment_ways ||
          waysRes.data.installment_ways ||
          waysRes.data.data ||
          [];
      }
      setInstallmentWays(ways);

      // معالجة التقسيط المختار للمنتج
      let productInstallments = [];
      if (productRes.data?.data?.installment_ways) {
        productInstallments = productRes.data.data.installment_ways;
      } else if (
        formData.installment_ways &&
        Array.isArray(formData.installment_ways)
      ) {
        productInstallments = formData.installment_ways;
      }

      // إزالة التكرارات
      const uniqueInstallments = productInstallments.filter(
        (item, index, self) =>
          index === self.findIndex((t) => getWayId(t) === getWayId(item)),
      );
      setSelectedInstallments(uniqueInstallments);
    } catch (err) {
      console.error("❌ خطأ في تحميل بيانات التقسيط:", err);
      setStatus({ type: "error", msg: "فشل في تحميل بيانات التقسيط" });
    } finally {
      setLoading(false);
    }
  }, [productId, token, formData.installment_ways]);

  const fetchProductData = async () => {
    if (!token || !productId) return;

    setIsLoading(true);
    setError(null);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("id", productId);

      const res = await axios.post(
        `${baseURL}market/product/show`,
        formDataToSend,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (res.data) {
        const product = res.data.data || res.data;

        // معالجة الصور من السيرفر
        let serverImages = [];
        if (product.images && Array.isArray(product.images)) {
          serverImages = product.images
            .map((img) => {
              if (typeof img === "string") {
                return {
                  id: `server_${Date.now()}_${Math.random()}`,
                  url: img,
                  isNew: false,
                };
              } else if (img && typeof img === "object") {
                return {
                  id: `server_${img.id || Date.now()}_${Math.random()}`,
                  url: img.image || img.url || "",
                  isNew: false,
                  originalData: img,
                };
              }
              return null;
            })
            .filter(Boolean);
        }

        setImages(serverImages);
        setSelectedImageIndex(serverImages.length > 0 ? 0 : -1);

        // تحديث formData مع جميع بيانات المنتج
        const updatedFormData = {
          name_ar: product.name_ar || "",
          name_en: product.name_en || "",
          description_ar: product.description_ar || "",
          description_en: product.description_en || "",
          price: product.price || "",
          price_offer: product.price_offer || "",
          link: product.link || "",
          category_id: product.category_id || "",
          status: product.status?.toString() || "1",
          market: product.market || {},
          installment_ways: product.installment_ways || [],
        };

        setFormData(updatedFormData);

        // تحديث installmentIds إذا كانت موجودة
        if (
          product.installment_ways &&
          Array.isArray(product.installment_ways)
        ) {
          setSelectedInstallments(product.installment_ways);
        }

        // جلب بيانات التقسيط بعد تحميل بيانات المنتج
        await fetchData();
      }
    } catch (err) {
      console.error("❌ خطأ في جلب بيانات المنتج:", err);
      setError(err.response?.data?.message || "حدث خطأ في جلب البيانات");
    } finally {
      setIsLoading(false);
    }
  };

  // دالة جلب التصنيفات
  const fetchCatagory = async () => {
    try {
      const res = await axios.get(
        `${baseURL}customer/categories/get_categories`,
      );
      if (res.data && res.data.data) {
        setCatagory(res.data.data);
      }
    } catch (err) {
      console.error("❌ خطأ في جلب التصنيفات:", err);
    }
  };

  useEffect(() => {
    fetchCatagory();
    if (productId && token) {
      fetchProductData();
    }
  }, [productId, token]);

  // تحديث حقل في النموذج
  const handleInputChange = (field) => (e) => {
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  // إضافة تقسيط جديد من حقل النص
  const handleAddInstallment = () => {
    if (
      installmentInput.trim() &&
      !installmentIds.includes(installmentInput.trim())
    ) {
      setInstallmentIds([...installmentIds, installmentInput.trim()]);
      setInstallmentInput("");
    }
  };

  // إزالة تقسيط من حقل النص
  const handleRemoveInstallmentById = (id) => {
    setInstallmentIds(installmentIds.filter((item) => item !== id));
  };

  // إزالة طريقة تقسيط من المربعات
  const handleRemoveInstallmentWay = (wayIdToRemove) => {
    setSelectedInstallments((prev) =>
      prev.filter((way) => {
        const currentWayId = getWayId(way);
        return currentWayId !== wayIdToRemove;
      }),
    );
  };

  // حفظ طرق التقسيط
  // حفظ طرق التقسيط
  /*   const handleSaveInstallments = async () => {
    setSaving(true);
    setStatus({ type: "", msg: "" });

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("product_id", productId);

      selectedInstallments.forEach((item, index) => {
        const id = getWayId(item);
        if (id) {
          formDataToSend.append("installment_ids[]", id);
        }
      });

      const res = await axios.post(
        `${baseURL}market/add_installment_product`,
        formDataToSend,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (res.data?.status === true || res.data?.success === true) {
        setStatus({ type: "success", msg: "تم حفظ التغييرات بنجاح" });
        setTimeout(() => setStatus({ type: "", msg: "" }), 3000);
      } else {
        setStatus({
          type: "error",
          msg: res.data?.message || "حدث خطأ أثناء الحفظ",
        });
      }
    } catch (err) {
      console.error("❌ خطأ في الحفظ:", err);
      setStatus({
        type: "error",
        msg: "حدث خطأ أثناء الحفظ: " + (err.message || "خطأ غير معروف"),
      });
    } finally {
      setSaving(false);
    }
  }; */

  const toggleInstallment = (way) => {
    const wayId = getWayId(way);
    const isSelected = selectedInstallments.some(
      (item) => getWayId(item) === wayId,
    );

    if (isSelected) {
      setSelectedInstallments((prev) =>
        prev.filter((item) => getWayId(item) !== wayId),
      );
    } else {
      setSelectedInstallments((prev) => [...prev, way]);
    }
  };

  // إضافة صور جديدة
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    const newImageObjects = files.map((file, index) => ({
      id: `new_${Date.now()}_${index}_${Math.random()}`,
      file: file,
      preview: URL.createObjectURL(file),
      isNew: true,
    }));

    setNewImages([...newImages, ...newImageObjects]);

    if (selectedImageIndex === -1 && newImageObjects.length > 0) {
      setSelectedImageIndex(images.length);
    }
  };

  // إزالة صورة جديدة
  const handleRemoveNewImage = (index, imageId) => {
    const imageToRemove = newImages[index];
    if (imageToRemove && imageToRemove.preview) {
      URL.revokeObjectURL(imageToRemove.preview);
    }

    const updatedNewImages = newImages.filter((_, i) => i !== index);
    setNewImages(updatedNewImages);

    const globalIndex = images.length + index;
    if (selectedImageIndex === globalIndex) {
      const allImages = [...images, ...updatedNewImages];
      if (allImages.length > 0) {
        setSelectedImageIndex(0);
      } else {
        setSelectedImageIndex(-1);
      }
    } else if (selectedImageIndex > globalIndex) {
      setSelectedImageIndex(selectedImageIndex - 1);
    }
  };

  // إزالة صورة موجودة
  const handleRemoveExistingImage = (index, imageId) => {
    const updatedImages = images.filter((_, i) => i !== index);
    setImages(updatedImages);

    if (selectedImageIndex === index) {
      const allImages = [...updatedImages, ...newImages];
      if (allImages.length > 0) {
        setSelectedImageIndex(0);
      } else {
        setSelectedImageIndex(-1);
      }
    } else if (selectedImageIndex > index) {
      setSelectedImageIndex(selectedImageIndex - 1);
    }
  };

  // دالة للحصول على الصورة المعروضة
  const getDisplayedImage = () => {
    const allImages = [...images, ...newImages];

    if (allImages.length === 0) {
      return "/323.jpg";
    }

    if (selectedImageIndex >= 0 && selectedImageIndex < allImages.length) {
      const selectedImage = allImages[selectedImageIndex];
      return selectedImage.isNew ? selectedImage.preview : selectedImage.url;
    }

    const firstImage = allImages[0];
    return firstImage.isNew ? firstImage.preview : firstImage.url;
  };

  // اختيار صورة للعرض
  const handleSelectImage = (index) => {
    setSelectedImageIndex(index);
  };

  // دالة تحديث المنتج
  // دالة تحديث المنتج
  const handleUpdateProduct = async () => {
    if (!token) {
      showAppToast("الرجاء تسجيل الدخول أولاً", "warning");
      return;
    }

    setIsUpdating(true);
    setError(null);
    setSuccess(false);

    try {
      const dataToSend = new FormData();

      // إضافة الحقول الأساسية
      dataToSend.append("id", productId);
      Object.keys(formData).forEach((key) => {
        if (
          formData[key] !== undefined &&
          formData[key] !== null &&
          key !== "market" &&
          key !== "installment_ways"
        ) {
          dataToSend.append(key, formData[key]);
        }
      });

      // إضافة الصور الجديدة كملفات
      newImages.forEach((imageObj) => {
        if (imageObj.file) {
          dataToSend.append("images[]", imageObj.file);
        }
      });

      selectedInstallments.forEach((item) => {
        const id = getWayId(item);
        if (id) dataToSend.append("installment_ids[]", id.toString());
      });

      const res = await axios.post(
        `${baseURL}market/product/update`,
        dataToSend,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${token}`,
          },
        },
      );

      setSuccess(true);
      const updatedProduct = res.data?.data || res.data;

      if (onCreated) {
        onCreated(updatedProduct);
      }

      if (onClose) {
        setTimeout(() => onClose(), 2000);
      }
    } catch (err) {
      console.error("❌ خطأ في التحديث:", err);
      setError(err.response?.data?.message || "حدث خطأ أثناء التحديث");
      showAppToast(err.response?.data?.message || "حدث خطأ", "error");
    } finally {
      setIsUpdating(false);
    }
  };

  // إذا كان في حالة تحميل
  if (isLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "80vh",
          flexDirection: "column",
          bgcolor: COLORS.background,
        }}
      >
        <CircularProgress
          size={60}
          sx={{
            mb: 3,
            color: COLORS.primary,
          }}
        />
        <Typography
          variant="h6"
          sx={{
            color: COLORS.textPrimary,
          }}
        >
          جاري تحميل بيانات المنتج...
        </Typography>
      </Box>
    );
  }

  const allImages = [...images, ...newImages];

  return (
    <Box
      sx={{
        p: 3,
        width: "100%",
        bgcolor: isDarkMode ? COLORS.background : "#ffffff",
        minHeight: "100vh",
      }}
    >
      <Stack
        direction={{ md: "row", sm: "column", xs: "column" }}
        justifyContent={"center"}
        spacing={{ md: 14, sm: 1, xs: 1 }}
        py={2}
      >
        {/* Card Preview Section - Right Side */}
        <Box
          sx={{
            width: { xs: "100%", md: "30%" },
            position: { md: "sticky" },
            top: { md: 0 },
            height: { md: "fit-content" },
            alignSelf: { md: "flex-start" },
            mb: { xs: 3, md: 0 },
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Card
              sx={{
                height: "auto",
                p: 3,
                overflow: "hidden",
                position: "relative",
                background: isDarkMode ? COLORS.surface : "transparent",
                boxShadow: isDarkMode ? "0 8px 32px rgba(0,0,0,0.4)" : "none",
                textDecoration: "none",
                borderRadius: "26px",
                border: isDarkMode ? `1px solid ${COLORS.accent3}` : "none",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: "26px",
                  padding: "3px",
                  background:
                    "linear-gradient(to bottom, #43c8ff 0%, transparent 100%)",
                  WebkitMask:
                    "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                  WebkitMaskComposite: "xor",
                  maskComposite: "exclude",
                  pointerEvents: "none",
                },
                transition: "all 0.3s ease",
                "&:hover": {
                  boxShadow: isDarkMode
                    ? "0 16px 48px rgba(0,0,0,0.6)"
                    : "0 16px 48px rgba(0,0,0,0.15)",
                  transform: "translateY(-4px)",
                },
              }}
            >
              {/* زر المفضلة */}
              <Box sx={{ position: "absolute", top: 12, left: 12, zIndex: 2 }}>
                <IconButton
                  sx={{
                    width: 40,
                    height: 40,
                    bgcolor: isDarkMode
                      ? "rgba(255, 255, 255, 0.15)"
                      : "rgba(255, 255, 255, 0.9)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    "&:hover": {
                      bgcolor: isDarkMode
                        ? "rgba(255, 255, 255, 0.25)"
                        : "rgba(255, 255, 255, 1)",
                    },
                  }}
                >
                  <FavoriteBorder
                    sx={{
                      color: isDarkMode ? COLORS.textPrimary : "#666",
                      fontSize: 24,
                    }}
                  />
                </IconButton>
              </Box>

              {/* الصورة الرئيسية */}
              <Box
                sx={{
                  position: "relative",
                  borderRadius: "26px 26px 0 0",
                  overflow: "hidden",
                }}
              >
                <CardMedia
                  component="img"
                  image={getDisplayedImage()}
                  alt={formData.name_ar || "منتج"}
                  sx={{
                    width: "100%",
                    objectFit: "cover",
                    transition: "transform 0.5s ease",
                    "&:hover": {
                      transform: "scale(1.05)",
                    },
                  }}
                  onError={(e) => {
                    console.error("❌ خطأ في تحميل الصورة:", e.target.src);
                    e.target.src = "/323.jpg";
                  }}
                />
              </Box>

              <CardContent sx={{ p: 3 }}>
                <Stack direction={"column"} spacing={2}>
                  {/* اسم المنتج */}
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 600,
                      fontSize: "1.2rem",
                      lineHeight: 1.4,
                      textAlign: "right",
                      color: isDarkMode ? COLORS.textPrimary : "#1a1a1a",
                    }}
                  >
                    {formData.name_ar || "منتج"}
                  </Typography>

                  {/* السعر */}
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 1,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography
                        variant="h5"
                        sx={{
                          fontWeight: 800,
                          color: COLORS.primary,
                          fontSize: "1.9rem",
                        }}
                      >
                        {formData.price_offer || formData.price || "0.00"}
                        {isDarkMode ? (
                          <img
                            src="/loogo.png"
                            alt=""
                            width={"20px"}
                            style={{ marginRight: 4 }}
                          />
                        ) : (
                          <img
                            src="/11.svg"
                            alt=""
                            width={"20px"}
                            style={{ marginRight: 4 }}
                          />
                        )}
                      </Typography>

                      {formData.price_offer && formData.price && (
                        <Typography
                          variant="body2"
                          sx={{
                            textDecoration: "line-through",
                            color: isDarkMode ? COLORS.textSecondary : "#999",
                          }}
                        >
                          {formData.price}
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  {/* الوصف */}
                  <Typography
                    sx={{
                      color: isDarkMode ? COLORS.textSecondary : "#666",
                      fontSize: "0.95rem",
                      lineHeight: 1.6,
                      textAlign: "right",
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 4,
                      WebkitBoxOrient: "vertical",
                    }}
                  >
                    {formData.description_ar || "وصف المنتج سيظهر هنا"}
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
          </motion.div>
        </Box>

        {/* Form Section - Left Side */}
        <Box
          sx={{
            width: { xs: "100%", md: "70%" },
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          {/* Form Grid */}
          <Grid container spacing={3} sx={{ mt: 0, direction: "rtl" }}>
            {/* First Column - Basic Info */}
            <Grid size={{ xs: 12, md: 6 }} xs={12} md={6}>
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                <Paper
                  sx={{
                    p: 4,
                    borderRadius: "20px",
                    background: isDarkMode
                      ? COLORS.surface
                      : "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
                    boxShadow: isDarkMode
                      ? "0 10px 30px rgba(0,0,0,0.2)"
                      : "0 10px 30px rgba(0,0,0,0.04)",
                    border: isDarkMode
                      ? `1px solid ${COLORS.accent3}`
                      : "1px solid rgba(0,0,0,0.05)",
                    transition: "all 0.3s ease",
                    "&:hover": {
                      boxShadow: isDarkMode
                        ? "0 15px 40px rgba(0,0,0,0.3)"
                        : "0 15px 40px rgba(0,0,0,0.08)",
                    },
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{
                      mb: 3,
                      fontWeight: 700,
                      color: isDarkMode ? COLORS.textPrimary : "#1a1a1a",
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    📝 المعلومات الأساسية
                  </Typography>

                  <TextField
                    fullWidth
                    label="الاسم بالعربية *"
                    value={formData.name_ar}
                    onChange={handleInputChange("name_ar")}
                    placeholder="أدخل اسم المنتج بالعربية"
                    sx={{
                      mb: 3,
                      // 1. محاذاة النص المدخل
                      "& .MuiInputBase-input": {
                        textAlign: "right",
                        direction: "rtl",
                        color: isDarkMode ? COLORS.textPrimary : "#1a1a1a",
                        fontWeight: 700,
                      },

                      // 2. تعديل الليبل (التسمية)
                      "& .MuiInputLabel-root": {
                        left: "unset",
                        right: "34px",
                        transformOrigin: "right",
                        color: isDarkMode ? COLORS.textSecondary : "#666",
                        fontFamily: "'Tajawal', sans-serif",
                        fontSize: 18,
                        fontWeight: 700,
                      },

                      // 3. تعديل الليبل عند التقلص (Shrunk/Focused)
                      "& .MuiInputLabel-shrink": {
                        transform: "translate(14px, -9px) scale(0.75)",
                        transformOrigin: "right",
                      },

                      // 4. تنسيق حقل الإدخال نفسه
                      "& .MuiOutlinedInput-root": {
                        borderRadius: "12px",
                        transition: "all 0.3s ease",
                        backgroundColor: isDarkMode
                          ? "rgba(255, 255, 255, 0.05)"
                          : "rgba(67, 200, 255, 0.02)",
                        textAlign: "right",
                        direction: "rtl",

                        // 5. البوردر العادي
                        "& fieldset": {
                          borderColor: isDarkMode
                            ? COLORS.accent3
                            : "rgba(0,0,0,0.1)",
                          transition: "all 0.3s ease",
                          textAlign: "right",
                          direction: "rtl",
                        },

                        // البوردر عند التركيز
                        "&.Mui-focused fieldset": {
                          borderColor: COLORS.primary,
                          borderWidth: "2px",
                          boxShadow: `0 0 0 3px ${COLORS.primary}20`,
                        },

                        // البوردر عند التحويم
                        "&:hover fieldset": {
                          borderColor: COLORS.primary,
                        },

                        "& .MuiInputBase-input": {
                          padding: "14px 14px",
                          fontFamily: "'Tajawal', sans-serif",
                          textAlign: "right",
                          direction: "rtl",
                          alignItems: "flex-start",
                        },
                      },

                      // 6. تعديل الـ notch (الخط الذي يقطع البوردر)
                      "& .MuiOutlinedInput-notchedOutline": {
                        textAlign: "right",
                        "& legend": {
                          textAlign: "right",
                          "& span": {
                            paddingRight: "4px",
                          },
                        },
                      },
                    }}
                  />

                  <TextField
                    fullWidth
                    label="الاسم بالإنجليزية"
                    value={formData.name_en}
                    onChange={handleInputChange("name_en")}
                    placeholder="Enter product name in English"
                    sx={{
                      mb: 3,
                      // 1. محاذاة النص المدخل
                      "& .MuiInputBase-input": {
                        textAlign: "right",
                        direction: "rtl",
                        color: isDarkMode ? COLORS.textPrimary : "#1a1a1a",
                        fontWeight: 700,
                      },

                      // 2. تعديل الليبل (التسمية)
                      "& .MuiInputLabel-root": {
                        left: "unset",
                        right: "34px",
                        transformOrigin: "right",
                        color: isDarkMode ? COLORS.textSecondary : "#666",
                        fontFamily: "'Tajawal', sans-serif",
                        fontSize: 18,
                        fontWeight: 700,
                      },

                      // 3. تعديل الليبل عند التقلص (Shrunk/Focused)
                      "& .MuiInputLabel-shrink": {
                        transform: "translate(14px, -9px) scale(0.75)",
                        transformOrigin: "right",
                      },

                      // 4. تنسيق حقل الإدخال نفسه
                      "& .MuiOutlinedInput-root": {
                        borderRadius: "12px",
                        transition: "all 0.3s ease",
                        backgroundColor: isDarkMode
                          ? "rgba(255, 255, 255, 0.05)"
                          : "rgba(67, 200, 255, 0.02)",
                        textAlign: "right",
                        direction: "rtl",

                        // 5. البوردر العادي
                        "& fieldset": {
                          borderColor: isDarkMode
                            ? COLORS.accent3
                            : "rgba(0,0,0,0.1)",
                          transition: "all 0.3s ease",
                          textAlign: "right",
                          direction: "rtl",
                        },

                        // البوردر عند التركيز
                        "&.Mui-focused fieldset": {
                          borderColor: COLORS.primary,
                          borderWidth: "2px",
                          boxShadow: `0 0 0 3px ${COLORS.primary}20`,
                        },

                        // البوردر عند التحويم
                        "&:hover fieldset": {
                          borderColor: COLORS.primary,
                        },

                        "& .MuiInputBase-input": {
                          padding: "14px 14px",
                          fontFamily: "'Tajawal', sans-serif",
                          textAlign: "right",
                          direction: "rtl",
                          alignItems: "flex-start",
                        },
                      },

                      // 6. تعديل الـ notch (الخط الذي يقطع البوردر)
                      "& .MuiOutlinedInput-notchedOutline": {
                        textAlign: "right",
                        "& legend": {
                          textAlign: "right",
                          "& span": {
                            paddingRight: "4px",
                          },
                        },
                      },
                    }}
                  />

                  <TextField
                    fullWidth
                    label="الوصف بالعربية"
                    multiline
                    rows={3}
                    value={formData.description_ar}
                    onChange={handleInputChange("description_ar")}
                    placeholder="أدخل وصف المنتج بالعربية"
                    sx={{
                      mb: 3,
                      // 1. محاذاة النص المدخل
                      "& .MuiInputBase-input": {
                        textAlign: "right",
                        direction: "rtl",
                        color: isDarkMode ? COLORS.textPrimary : "#1a1a1a",
                        fontWeight: 700,
                      },

                      // 2. تعديل الليبل (التسمية)
                      "& .MuiInputLabel-root": {
                        left: "unset",
                        right: "34px",
                        transformOrigin: "right",
                        color: isDarkMode ? COLORS.textSecondary : "#666",
                        fontFamily: "'Tajawal', sans-serif",
                        fontSize: 18,
                        fontWeight: 700,
                      },

                      // 3. تعديل الليبل عند التقلص (Shrunk/Focused)
                      "& .MuiInputLabel-shrink": {
                        transform: "translate(14px, -9px) scale(0.75)",
                        transformOrigin: "right",
                      },

                      // 4. تنسيق حقل الإدخال نفسه
                      "& .MuiOutlinedInput-root": {
                        borderRadius: "12px",
                        transition: "all 0.3s ease",
                        backgroundColor: isDarkMode
                          ? "rgba(255, 255, 255, 0.05)"
                          : "rgba(67, 200, 255, 0.02)",
                        textAlign: "right",
                        direction: "rtl",

                        // 5. البوردر العادي
                        "& fieldset": {
                          borderColor: isDarkMode
                            ? COLORS.accent3
                            : "rgba(0,0,0,0.1)",
                          transition: "all 0.3s ease",
                          textAlign: "right",
                          direction: "rtl",
                        },

                        // البوردر عند التركيز
                        "&.Mui-focused fieldset": {
                          borderColor: COLORS.primary,
                          borderWidth: "2px",
                          boxShadow: `0 0 0 3px ${COLORS.primary}20`,
                        },

                        // البوردر عند التحويم
                        "&:hover fieldset": {
                          borderColor: COLORS.primary,
                        },

                        "& .MuiInputBase-input": {
                          padding: "14px 14px",
                          fontFamily: "'Tajawal', sans-serif",
                          textAlign: "right",
                          direction: "rtl",
                          alignItems: "flex-start",
                        },
                      },

                      // 6. تعديل الـ notch (الخط الذي يقطع البوردر)
                      "& .MuiOutlinedInput-notchedOutline": {
                        textAlign: "right",
                        "& legend": {
                          textAlign: "right",
                          "& span": {
                            paddingRight: "4px",
                          },
                        },
                      },
                    }}
                  />

                  <TextField
                    fullWidth
                    label="الوصف بالإنجليزية"
                    multiline
                    rows={3}
                    value={formData.description_en}
                    onChange={handleInputChange("description_en")}
                    placeholder="Enter product description in English"
                    sx={{
                      mb: 3,
                      // 1. محاذاة النص المدخل
                      "& .MuiInputBase-input": {
                        textAlign: "right",
                        direction: "rtl",
                        color: isDarkMode ? COLORS.textPrimary : "#1a1a1a",
                        fontWeight: 700,
                      },

                      // 2. تعديل الليبل (التسمية)
                      "& .MuiInputLabel-root": {
                        left: "unset",
                        right: "34px",
                        transformOrigin: "right",
                        color: isDarkMode ? COLORS.textSecondary : "#666",
                        fontFamily: "'Tajawal', sans-serif",
                        fontSize: 18,
                        fontWeight: 700,
                      },

                      // 3. تعديل الليبل عند التقلص (Shrunk/Focused)
                      "& .MuiInputLabel-shrink": {
                        transform: "translate(14px, -9px) scale(0.75)",
                        transformOrigin: "right",
                      },

                      // 4. تنسيق حقل الإدخال نفسه
                      "& .MuiOutlinedInput-root": {
                        borderRadius: "12px",
                        transition: "all 0.3s ease",
                        backgroundColor: isDarkMode
                          ? "rgba(255, 255, 255, 0.05)"
                          : "rgba(67, 200, 255, 0.02)",
                        textAlign: "right",
                        direction: "rtl",

                        // 5. البوردر العادي
                        "& fieldset": {
                          borderColor: isDarkMode
                            ? COLORS.accent3
                            : "rgba(0,0,0,0.1)",
                          transition: "all 0.3s ease",
                          textAlign: "right",
                          direction: "rtl",
                        },

                        // البوردر عند التركيز
                        "&.Mui-focused fieldset": {
                          borderColor: COLORS.primary,
                          borderWidth: "2px",
                          boxShadow: `0 0 0 3px ${COLORS.primary}20`,
                        },

                        // البوردر عند التحويم
                        "&:hover fieldset": {
                          borderColor: COLORS.primary,
                        },

                        "& .MuiInputBase-input": {
                          padding: "14px 14px",
                          fontFamily: "'Tajawal', sans-serif",
                          textAlign: "right",
                          direction: "rtl",
                          alignItems: "flex-start",
                        },
                      },

                      // 6. تعديل الـ notch (الخط الذي يقطع البوردر)
                      "& .MuiOutlinedInput-notchedOutline": {
                        textAlign: "right",
                        "& legend": {
                          textAlign: "right",
                          "& span": {
                            paddingRight: "4px",
                          },
                        },
                      },
                    }}
                  />

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }} xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="السعر"
                        type="number"
                        value={formData.price}
                        onChange={handleInputChange("price")}
                        placeholder="0.00"
                        sx={{
                          mb: 3,
                          // 1. محاذاة النص المدخل
                          "& .MuiInputBase-input": {
                            textAlign: "right",
                            direction: "rtl",
                            color: isDarkMode ? COLORS.textPrimary : "#1a1a1a",
                            fontWeight: 700,
                          },

                          // 2. تعديل الليبل (التسمية)
                          "& .MuiInputLabel-root": {
                            left: "unset",
                            right: "34px",
                            transformOrigin: "right",
                            color: isDarkMode ? COLORS.textSecondary : "#666",
                            fontFamily: "'Tajawal', sans-serif",
                            fontSize: 18,
                            fontWeight: 700,
                          },

                          // 3. تعديل الليبل عند التقلص (Shrunk/Focused)
                          "& .MuiInputLabel-shrink": {
                            transform: "translate(14px, -9px) scale(0.75)",
                            transformOrigin: "right",
                          },

                          // 4. تنسيق حقل الإدخال نفسه
                          "& .MuiOutlinedInput-root": {
                            borderRadius: "12px",
                            transition: "all 0.3s ease",
                            backgroundColor: isDarkMode
                              ? "rgba(255, 255, 255, 0.05)"
                              : "rgba(67, 200, 255, 0.02)",
                            textAlign: "right",
                            direction: "rtl",

                            // 5. البوردر العادي
                            "& fieldset": {
                              borderColor: isDarkMode
                                ? COLORS.accent3
                                : "rgba(0,0,0,0.1)",
                              transition: "all 0.3s ease",
                              textAlign: "right",
                              direction: "rtl",
                            },

                            // البوردر عند التركيز
                            "&.Mui-focused fieldset": {
                              borderColor: COLORS.primary,
                              borderWidth: "2px",
                              boxShadow: `0 0 0 3px ${COLORS.primary}20`,
                            },

                            // البوردر عند التحويم
                            "&:hover fieldset": {
                              borderColor: COLORS.primary,
                            },

                            "& .MuiInputBase-input": {
                              padding: "14px 14px",
                              fontFamily: "'Tajawal', sans-serif",
                              textAlign: "right",
                              direction: "rtl",
                            },
                          },

                          // 6. تعديل الـ notch (الخط الذي يقطع البوردر)
                          "& .MuiOutlinedInput-notchedOutline": {
                            textAlign: "right",
                            "& legend": {
                              textAlign: "right",
                              "& span": {
                                paddingRight: "4px",
                              },
                            },
                          },
                        }}
                        InputProps={{
                          inputProps: { min: 0, step: 0.01 },
                        }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }} xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="سعر العرض  (اختياري)"
                        type="number"
                        value={formData.price_offer}
                        onChange={handleInputChange("price_offer")}
                        placeholder="0.00"
                        sx={{
                          mb: 3,
                          // 1. محاذاة النص المدخل
                          "& .MuiInputBase-input": {
                            textAlign: "right",
                            direction: "rtl",
                            color: isDarkMode ? COLORS.textPrimary : "#1a1a1a",
                            fontWeight: 700,
                          },

                          // 2. تعديل الليبل (التسمية)
                          "& .MuiInputLabel-root": {
                            left: "unset",
                            right: "34px",
                            transformOrigin: "right",
                            color: isDarkMode ? COLORS.textSecondary : "#666",
                            fontFamily: "'Tajawal', sans-serif",
                            fontSize: 18,
                            fontWeight: 700,
                          },

                          // 3. تعديل الليبل عند التقلص (Shrunk/Focused)
                          "& .MuiInputLabel-shrink": {
                            transform: "translate(14px, -9px) scale(0.75)",
                            transformOrigin: "right",
                          },

                          // 4. تنسيق حقل الإدخال نفسه
                          "& .MuiOutlinedInput-root": {
                            borderRadius: "12px",
                            transition: "all 0.3s ease",
                            backgroundColor: isDarkMode
                              ? "rgba(255, 255, 255, 0.05)"
                              : "rgba(67, 200, 255, 0.02)",
                            textAlign: "right",
                            direction: "rtl",

                            // 5. البوردر العادي
                            "& fieldset": {
                              borderColor: isDarkMode
                                ? COLORS.accent3
                                : "rgba(0,0,0,0.1)",
                              transition: "all 0.3s ease",
                              textAlign: "right",
                              direction: "rtl",
                            },

                            // البوردر عند التركيز
                            "&.Mui-focused fieldset": {
                              borderColor: COLORS.primary,
                              borderWidth: "2px",
                              boxShadow: `0 0 0 3px ${COLORS.primary}20`,
                            },

                            // البوردر عند التحويم
                            "&:hover fieldset": {
                              borderColor: COLORS.primary,
                            },

                            "& .MuiInputBase-input": {
                              padding: "14px 14px",
                              fontFamily: "'Tajawal', sans-serif",
                              textAlign: "right",
                              direction: "rtl",
                            },
                          },

                          // 6. تعديل الـ notch (الخط الذي يقطع البوردر)
                          "& .MuiOutlinedInput-notchedOutline": {
                            textAlign: "right",
                            "& legend": {
                              textAlign: "right",
                              "& span": {
                                paddingRight: "4px",
                              },
                            },
                          },
                        }}
                        InputProps={{
                          inputProps: { min: 0, step: 0.01 },
                        }}
                      />
                    </Grid>
                  </Grid>
                </Paper>
              </motion.div>
            </Grid>

            {/* Second Column - Additional Info */}
            <Grid size={{ xs: 12, md: 6 }} xs={12} md={6}>
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <Paper
                  sx={{
                    p: 4,
                    borderRadius: "20px",
                    background: isDarkMode
                      ? COLORS.surface
                      : "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
                    boxShadow: isDarkMode
                      ? "0 10px 30px rgba(0,0,0,0.2)"
                      : "0 10px 30px rgba(0,0,0,0.04)",
                    border: isDarkMode
                      ? `1px solid ${COLORS.accent3}`
                      : "1px solid rgba(0,0,0,0.05)",
                    transition: "all 0.3s ease",
                    "&:hover": {
                      boxShadow: isDarkMode
                        ? "0 15px 40px rgba(0,0,0,0.3)"
                        : "0 15px 40px rgba(0,0,0,0.08)",
                    },
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{
                      mb: 3,
                      fontWeight: 700,
                      color: isDarkMode ? COLORS.textPrimary : "#1a1a1a",
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    ⚙️ المعلومات الإضافية
                  </Typography>

                  <TextField
                    fullWidth
                    label="رابط المنتج"
                    value={formData.link}
                    onChange={handleInputChange("link")}
                    placeholder="https://example.com/product"
                    sx={{
                      mb: 3,
                      // 1. محاذاة النص المدخل
                      "& .MuiInputBase-input": {
                        textAlign: "right",
                        direction: "rtl",
                        color: isDarkMode ? COLORS.textPrimary : "#1a1a1a",
                        fontWeight: 700,
                      },

                      // 2. تعديل الليبل (التسمية)
                      "& .MuiInputLabel-root": {
                        left: "unset",
                        right: "34px",
                        transformOrigin: "right",
                        color: isDarkMode ? COLORS.textSecondary : "#666",
                        fontFamily: "'Tajawal', sans-serif",
                        fontSize: 18,
                        fontWeight: 700,
                      },

                      // 3. تعديل الليبل عند التقلص (Shrunk/Focused)
                      "& .MuiInputLabel-shrink": {
                        transform: "translate(14px, -9px) scale(0.75)",
                        transformOrigin: "right",
                      },

                      // 4. تنسيق حقل الإدخال نفسه
                      "& .MuiOutlinedInput-root": {
                        borderRadius: "12px",
                        transition: "all 0.3s ease",
                        backgroundColor: isDarkMode
                          ? "rgba(255, 255, 255, 0.05)"
                          : "rgba(67, 200, 255, 0.02)",
                        textAlign: "right",
                        direction: "rtl",

                        // 5. البوردر العادي
                        "& fieldset": {
                          borderColor: isDarkMode
                            ? COLORS.accent3
                            : "rgba(0,0,0,0.1)",
                          transition: "all 0.3s ease",
                          textAlign: "right",
                          direction: "rtl",
                        },

                        // البوردر عند التركيز
                        "&.Mui-focused fieldset": {
                          borderColor: COLORS.primary,
                          borderWidth: "2px",
                          boxShadow: `0 0 0 3px ${COLORS.primary}20`,
                        },

                        // البوردر عند التحويم
                        "&:hover fieldset": {
                          borderColor: COLORS.primary,
                        },

                        "& .MuiInputBase-input": {
                          padding: "14px 14px",
                          fontFamily: "'Tajawal', sans-serif",
                          textAlign: "right",
                          direction: "rtl",
                          alignItems: "flex-start",
                        },
                      },

                      // 6. تعديل الـ notch (الخط الذي يقطع البوردر)
                      "& .MuiOutlinedInput-notchedOutline": {
                        textAlign: "right",
                        "& legend": {
                          textAlign: "right",
                          "& span": {
                            paddingRight: "4px",
                          },
                        },
                      },
                    }}
                  />

                  {/* Categories */}
                  <FormControl
                    fullWidth
                    sx={{
                      mb: 3,
                      // 1. محاذاة النص المدخل
                      "& .MuiInputBase-input": {
                        textAlign: "right",
                        direction: "rtl",
                        color: isDarkMode ? COLORS.textPrimary : "#1a1a1a",
                        fontWeight: 700,
                      },

                      // 2. تعديل الليبل (التسمية)
                      "& .MuiInputLabel-root": {
                        left: "unset",
                        right: "34px",
                        transformOrigin: "right",
                        color: isDarkMode ? COLORS.textSecondary : "#666",
                        fontFamily: "'Tajawal', sans-serif",
                        fontSize: 18,
                        fontWeight: 700,
                      },

                      // 3. تعديل الليبل عند التقلص (Shrunk/Focused)
                      "& .MuiInputLabel-shrink": {
                        transform: "translate(14px, -9px) scale(0.75)",
                        transformOrigin: "right",
                      },

                      // 4. تنسيق حقل الإدخال نفسه
                      "& .MuiOutlinedInput-root": {
                        borderRadius: "12px",
                        transition: "all 0.3s ease",
                        backgroundColor: isDarkMode
                          ? "rgba(255, 255, 255, 0.05)"
                          : "rgba(67, 200, 255, 0.02)",
                        textAlign: "right",
                        direction: "rtl",

                        // 5. البوردر العادي
                        "& fieldset": {
                          borderColor: isDarkMode
                            ? COLORS.accent3
                            : "rgba(0,0,0,0.1)",
                          transition: "all 0.3s ease",
                          textAlign: "right",
                          direction: "rtl",
                        },

                        // البوردر عند التركيز
                        "&.Mui-focused fieldset": {
                          borderColor: COLORS.primary,
                          borderWidth: "2px",
                          boxShadow: `0 0 0 3px ${COLORS.primary}20`,
                        },

                        // البوردر عند التحويم
                        "&:hover fieldset": {
                          borderColor: COLORS.primary,
                        },

                        "& .MuiInputBase-input": {
                          padding: "14px 14px",
                          fontFamily: "'Tajawal', sans-serif",
                          textAlign: "right",
                          direction: "ltr",
                          alignItems: "flex-start",
                          mx: 2,
                        },
                      },

                      // 6. تعديل الـ notch (الخط الذي يقطع البوردر)
                      "& .MuiOutlinedInput-notchedOutline": {
                        textAlign: "right",
                        "& legend": {
                          textAlign: "right",
                          "& span": {
                            paddingRight: "4px",
                          },
                        },
                      },
                    }}
                  >
                    <InputLabel
                      sx={{
                        color: isDarkMode ? COLORS.textSecondary : "#666",
                      }}
                    >
                      التصنيف *
                    </InputLabel>
                    <Select
                      value={formData.category_id}
                      onChange={handleInputChange("category_id")}
                      label="التصنيف"
                      required
                      disabled={isLoading}
                      sx={{
                        color: isDarkMode ? COLORS.textPrimary : "#1a1a1a",
                      }}
                    >
                      <MenuItem
                        value=""
                        sx={{
                          justifyContent: "flex-end",
                          direction: "rtl",
                          color: isDarkMode ? COLORS.textSecondary : "#666",
                        }}
                      >
                        اختر تصنيف المنتج
                      </MenuItem>

                      {Catagory && Catagory.length > 0 && Catagory[0] ? (
                        Catagory[0].map((category) => (
                          <MenuItem
                            key={category.id}
                            value={category.id}
                            sx={{
                              justifyContent: "flex-start",
                              direction: "rtl",
                              display: "flex",
                              alignItems: "center",
                              gap: 2,
                              padding: "12px 16px",
                              transition: "all 0.2s ease",
                              "&:hover": {
                                bgcolor: isDarkMode
                                  ? "rgba(255, 255, 255, 0.1)"
                                  : "rgba(67, 200, 255, 0.08)",
                              },
                            }}
                          >
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1.5,
                                flexDirection: "row-reverse",
                              }}
                            >
                              <Box>
                                <Typography
                                  sx={{
                                    fontWeight: 600,
                                    color: isDarkMode
                                      ? COLORS.textPrimary
                                      : "#1a1a1a",
                                    textAlign: "right",
                                  }}
                                >
                                  {category.name_ar || "بدون اسم"}
                                </Typography>
                              </Box>
                            </Box>
                          </MenuItem>
                        ))
                      ) : (
                        <MenuItem
                          disabled
                          sx={{
                            justifyContent: "center",
                            direction: "rtl",
                            color: isDarkMode ? COLORS.textSecondary : "#999",
                            padding: "20px",
                          }}
                        >
                          {isLoading ? (
                            <>
                              <CircularProgress
                                size={20}
                                sx={{
                                  mr: 1,
                                  color: isDarkMode
                                    ? COLORS.primary
                                    : "#43c8ff",
                                }}
                              />
                              جاري تحميل التصنيفات...
                            </>
                          ) : (
                            "لا توجد تصنيفات متاحة"
                          )}
                        </MenuItem>
                      )}
                    </Select>
                  </FormControl>

                  {/* Installment Ways Section */}
                  <Box
                    sx={{
                      p: 3,
                      bgcolor:
                        theme.palette.mode === "dark" ? " black" : "white",
                      borderRadius: 4,
                      mb: 3,
                    }}
                  >
                    <Typography
                      variant="h6"
                      fontWeight="700"
                      sx={{
                        mb: 3,
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        color:
                          theme.palette.mode === "dark" ? "  white" : "black",
                      }}
                    >
                      💳 طرق التقسيط المتاحة
                    </Typography>

                    {status.msg && (
                      <Alert
                        severity={status.type}
                        sx={{ mb: 2, borderRadius: 2 }}
                        icon={
                          status.type === "success" ? <CheckCircleIcon /> : null
                        }
                      >
                        {status.msg}
                      </Alert>
                    )}

                    {loading ? (
                      <Box sx={{ textAlign: "center", py: 5 }}>
                        <CircularProgress size={30} />
                      </Box>
                    ) : installmentWays.length > 0 ? (
                      <>
                        <Box sx={{ mb: 3 }}>
                          <Typography
                            variant="subtitle1"
                            fontWeight={700}
                            sx={{ mb: 2 }}
                          >
                            اختر طريقة التقسيط:
                          </Typography>

                          <Grid container spacing={2} justifyContent="center">
                            {installmentWays.map((way, index) => {
                              const wayId =
                                getWayId(way) || `installment-${index}`;
                              const isSelected = selectedInstallments.some(
                                (item) => getWayId(item) === wayId,
                              );

                              return (
                                <Grid item key={wayId}>
                                  <motion.div
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                  >
                                    <Box
                                      onClick={() => toggleInstallment(way)}
                                      sx={{
                                        width: 120,
                                        height: 120,
                                        borderRadius: "20px",
                                        overflow: "hidden",
                                        cursor: "pointer",
                                        transition: "all 0.3s ease",
                                        border: isSelected
                                          ? "3px solid #43c8ff"
                                          : "2px solid rgba(0,0,0,0.1)",
                                        boxShadow: isSelected
                                          ? "0 10px 30px rgba(67, 200, 255, 0.3)"
                                          : "0 4px 15px rgba(0,0,0,0.08)",
                                        transform: isSelected
                                          ? "translateY(-4px)"
                                          : "translateY(0)",
                                        "&:hover": {
                                          transform: "translateY(-4px)",
                                          boxShadow:
                                            "0 15px 40px rgba(0,0,0,0.15)",
                                        },
                                      }}
                                    >
                                      <Box
                                        component="img"
                                        src={
                                          way.image ||
                                          "/placeholder-installment.png"
                                        }
                                        alt={
                                          way.name_ar ||
                                          way.name ||
                                          `تقسيط ${index + 1}`
                                        }
                                        sx={{
                                          width: "100%",
                                          height: "100%",
                                          objectFit: "cover",
                                        }}
                                        onError={(e) => {
                                          e.target.src =
                                            "/placeholder-installment.png";
                                          e.target.style.objectFit = "contain";
                                        }}
                                      />

                                      {isSelected && (
                                        <Box
                                          sx={{
                                            position: "absolute",
                                            top: 8,
                                            right: 8,
                                            width: 28,
                                            height: 28,
                                            bgcolor: "#43c8ff",
                                            color: "white",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            borderRadius: "50%",
                                            boxShadow:
                                              "0 4px 12px rgba(67, 200, 255, 0.4)",
                                          }}
                                        >
                                          <CheckCircleIcon
                                            sx={{ fontSize: 18 }}
                                          />
                                        </Box>
                                      )}

                                      <Box
                                        sx={{
                                          position: "absolute",
                                          bottom: 0,
                                          left: 0,
                                          right: 0,
                                          bgcolor: "rgba(0,0,0,0.7)",
                                          color: "white",
                                          padding: "8px",
                                          textAlign: "center",
                                          fontSize: "0.8rem",
                                          fontWeight: 600,
                                        }}
                                      >
                                        {way.name_ar ||
                                          way.name ||
                                          `تقسيط ${index + 1}`}
                                      </Box>
                                    </Box>
                                  </motion.div>
                                </Grid>
                              );
                            })}
                          </Grid>
                        </Box>

                        <AnimatePresence>
                          {selectedInstallments.length > 0 && (
                            <motion.div
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -20 }}
                              transition={{ duration: 0.3 }}
                            >
                              <Typography
                                variant="subtitle1"
                                gutterBottom
                                fontWeight={700}
                                sx={{
                                  mb: 2,
                                  color:
                                    theme.palette.mode === "dark"
                                      ? "  white"
                                      : "black",
                                }}
                              >
                                طرق التقسيط المختارة (
                                {selectedInstallments.length})
                              </Typography>

                              <Box
                                sx={{
                                  display: "flex",
                                  flexWrap: "wrap",
                                  gap: 2,
                                  mb: 3,
                                }}
                              >
                                {selectedInstallments.map((way, index) => {
                                  const wayId = getWayId(way) || index;
                                  return (
                                    <Box
                                      key={`selected-${wayId}-${index}`} // أضف index ليكون المفتاح فريد
                                      sx={{
                                        position: "relative",
                                        flexShrink: 0,
                                        width: 80,
                                        height: 80,
                                        borderRadius: "12px",
                                        overflow: "hidden",
                                        border: "2px solid #43c8ff",
                                        boxShadow:
                                          "0 4px 10px rgba(67, 200, 255, 0.2)",
                                      }}
                                    >
                                      <Box
                                        component="img"
                                        src={
                                          way.image ||
                                          "/placeholder-installment.png"
                                        }
                                        alt={
                                          way.name_ar ||
                                          way.name ||
                                          `تقسيط ${index + 1}`
                                        }
                                        sx={{
                                          width: "100%",
                                          height: "100%",
                                          objectFit: "cover",
                                        }}
                                        onError={(e) => {
                                          e.target.src =
                                            "/placeholder-installment.png";
                                          e.target.style.objectFit = "contain";
                                        }}
                                      />
                                      <IconButton
                                        size="small"
                                        onClick={() =>
                                          handleRemoveInstallmentWay(wayId)
                                        }
                                        sx={{
                                          position: "absolute",
                                          top: 4,
                                          right: 4,
                                          width: 24,
                                          height: 24,
                                          bgcolor: "error.main",
                                          color: "white",
                                          "&:hover": {
                                            bgcolor: "error.dark",
                                            transform: "scale(1.1)",
                                          },
                                        }}
                                      >
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Box>
                                  );
                                })}
                              </Box>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/*     <Box
                          sx={{
                            display: "flex",
                            gap: 2,
                            justifyContent: "flex-end",
                            mt: 3,
                          }}
                        >
                          <Button
                            variant="outlined"
                            color="secondary"
                            onClick={() => setSelectedInstallments([])}
                            disabled={
                              selectedInstallments.length === 0 || saving
                            }
                          >
                            مسح الكل
                          </Button>

                          <Button
                            variant="contained"
                            color="primary"
                            onClick={handleSaveInstallments}
                            disabled={saving}
                            startIcon={
                              saving ? (
                                <CircularProgress size={20} />
                              ) : (
                                <SaveIcon />
                              )
                            }
                            sx={{
                              background:
                                "linear-gradient(135deg, #43c8ff 0%, #2a9dff 100%)",
                              boxShadow: "0 4px 15px rgba(67, 200, 255, 0.3)",
                              "&:hover": {
                                boxShadow: "0 8px 25px rgba(67, 200, 255, 0.4)",
                              },
                            }}
                          >
                            {saving ? "جاري الحفظ..." : "حفظ طرق التقسيط"}
                          </Button>
                        </Box> */}
                      </>
                    ) : (
                      <Alert
                        severity="info"
                        sx={{ mb: 2, borderRadius: "12px" }}
                      >
                        لا توجد طرق تقسيط متاحة حالياً
                      </Alert>
                    )}
                  </Box>
                </Paper>
              </motion.div>
            </Grid>
          </Grid>

          {/* Images Section */}
          <Grid item xs={12}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Paper
                sx={{
                  p: 4,
                  borderRadius: "20px",
                  background: isDarkMode
                    ? COLORS.surface
                    : "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
                  boxShadow: isDarkMode
                    ? "0 10px 30px rgba(0,0,0,0.2)"
                    : "0 10px 30px rgba(0,0,0,0.04)",
                  border: isDarkMode
                    ? `1px solid ${COLORS.accent3}`
                    : "1px solid rgba(0,0,0,0.05)",
                }}
              >
                <Typography
                  variant="h6"
                  sx={{
                    mb: 3,
                    fontWeight: 700,
                    color: isDarkMode ? COLORS.textPrimary : "#1a1a1a",
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  🖼️ صور المنتج
                </Typography>

                {/* Images Grid */}
                {allImages.length > 0 && (
                  <Box
                    sx={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 2,
                      mb: 4,
                    }}
                  >
                    <AnimatePresence>
                      {images.map((img, index) => (
                        <motion.div
                          key={img.id}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          layout
                        >
                          <Box
                            sx={{
                              position: "relative",
                              borderRadius: "16px",
                              overflow: "hidden",
                              cursor: "pointer",
                              transition: "all 0.3s ease",
                              border:
                                selectedImageIndex === index
                                  ? `3px solid ${COLORS.primary}`
                                  : `2px solid ${
                                      isDarkMode
                                        ? COLORS.accent3
                                        : "rgba(0,0,0,0.1)"
                                    }`,
                              boxShadow:
                                selectedImageIndex === index
                                  ? `0 10px 30px ${COLORS.primary}30`
                                  : "0 4px 15px rgba(0,0,0,0.08)",
                              transform:
                                selectedImageIndex === index
                                  ? "translateY(-4px)"
                                  : "translateY(0)",
                              "&:hover": {
                                transform: "translateY(-4px)",
                                boxShadow: "0 15px 40px rgba(0,0,0,0.15)",
                              },
                            }}
                            onClick={() => handleSelectImage(index)}
                          >
                            <img
                              src={img.url}
                              alt={`صورة ${index + 1}`}
                              style={{
                                width: 120,
                                height: 120,
                                objectFit: "cover",
                              }}
                              onError={(e) => {
                                e.target.src = "/323.jpg";
                              }}
                            />
                            <IconButton
                              size="small"
                              sx={{
                                position: "absolute",
                                top: 8,
                                right: 8,
                                bgcolor: COLORS.error,
                                color: "white",
                                "&:hover": {
                                  bgcolor: COLORS.error,
                                  opacity: 0.9,
                                  transform: "scale(1.1)",
                                },
                                transition: "all 0.2s ease",
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveExistingImage(index, img.id);
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </motion.div>
                      ))}

                      {newImages.map((img, index) => (
                        <motion.div
                          key={img.id}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          layout
                        >
                          <Box
                            sx={{
                              position: "relative",
                              borderRadius: "16px",
                              overflow: "hidden",
                              cursor: "pointer",
                              transition: "all 0.3s ease",
                              border:
                                selectedImageIndex === images.length + index
                                  ? `3px solid ${COLORS.success}`
                                  : `2px solid ${
                                      isDarkMode
                                        ? COLORS.accent3
                                        : "rgba(0,0,0,0.1)"
                                    }`,
                              boxShadow:
                                selectedImageIndex === images.length + index
                                  ? `0 10px 30px ${COLORS.success}30`
                                  : "0 4px 15px rgba(0,0,0,0.08)",
                              transform:
                                selectedImageIndex === images.length + index
                                  ? "translateY(-4px)"
                                  : "translateY(0)",
                              "&:hover": {
                                transform: "translateY(-4px)",
                                boxShadow: "0 15px 40px rgba(0,0,0,0.15)",
                              },
                            }}
                            onClick={() =>
                              handleSelectImage(images.length + index)
                            }
                          >
                            <img
                              src={img.preview}
                              alt={`صورة جديدة ${index + 1}`}
                              style={{
                                width: 120,
                                height: 120,
                                objectFit: "cover",
                              }}
                            />
                            <IconButton
                              size="small"
                              sx={{
                                position: "absolute",
                                top: 8,
                                right: 8,
                                bgcolor: COLORS.error,
                                color: "white",
                                "&:hover": {
                                  bgcolor: COLORS.error,
                                  opacity: 0.9,
                                  transform: "scale(1.1)",
                                },
                                transition: "all 0.2s ease",
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveNewImage(index, img.id);
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                            <Box
                              sx={{
                                position: "absolute",
                                bottom: 8,
                                left: 8,
                                bgcolor: COLORS.success,
                                color: "white",
                                px: 1.5,
                                py: 0.5,
                                borderRadius: "8px",
                                fontSize: "0.7rem",
                                fontWeight: 600,
                                boxShadow: `0 2px 8px ${COLORS.success}30`,
                              }}
                            >
                              جديد
                            </Box>
                          </Box>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </Box>
                )}

                {/* Upload Area */}
                <Box
                  sx={{
                    position: "relative",
                    borderRadius: "20px",
                    border: `2px dashed ${COLORS.primary}30`,
                    backgroundColor: isDarkMode
                      ? "rgba(255, 255, 255, 0.05)"
                      : "rgba(67, 200, 255, 0.03)",
                    minHeight: 200,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    overflow: "hidden",
                    "&:hover": {
                      borderColor: COLORS.primary,
                      backgroundColor: isDarkMode
                        ? "rgba(255, 255, 255, 0.08)"
                        : "rgba(67, 200, 255, 0.06)",
                      transform: "translateY(-2px)",
                      boxShadow: `0 20px 40px ${COLORS.primary}10`,
                    },
                  }}
                  onClick={() =>
                    document.getElementById("image-upload").click()
                  }
                  onMouseEnter={() => setIsHovered(true)}
                  onMouseLeave={() => setIsHovered(false)}
                >
                  <input
                    id="image-upload"
                    type="file"
                    onChange={handleImageUpload}
                    accept="image/*"
                    multiple
                    style={{ display: "none" }}
                  />

                  <motion.div
                    animate={{ scale: isHovered ? 1.1 : 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Box
                      sx={{
                        width: 80,
                        height: 80,
                        borderRadius: "20px",
                        backgroundColor: isDarkMode
                          ? "rgba(255, 255, 255, 0.1)"
                          : "rgba(67, 200, 255, 0.1)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        mb: 3,
                        border: `2px solid ${COLORS.primary}20`,
                      }}
                    >
                      <AddAPhoto
                        sx={{
                          color: COLORS.primary,
                          fontSize: 40,
                        }}
                      />
                    </Box>
                  </motion.div>

                  <Typography
                    variant="h6"
                    color="primary"
                    fontWeight="700"
                    gutterBottom
                    sx={{
                      background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.accent1} 100%)`,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    انقر أو اسحب الصور هنا
                  </Typography>

                  <Typography
                    variant="body2"
                    sx={{
                      mb: 3,
                      color: isDarkMode ? COLORS.textSecondary : "#666",
                    }}
                  >
                    PNG, JPG, GIF يصل حجمها إلى 10MB
                  </Typography>

                  <Button
                    variant="outlined"
                    size="medium"
                    startIcon={<CloudUploadIcon />}
                    sx={{
                      borderColor: COLORS.primary,
                      color: COLORS.primary,
                      fontWeight: 600,
                      borderRadius: "12px",
                      px: 4,
                      py: 1,
                      "&:hover": {
                        borderColor: COLORS.accent1,
                        backgroundColor: isDarkMode
                          ? "rgba(67, 200, 255, 0.1)"
                          : "rgba(67, 200, 255, 0.1)",
                        transform: "translateY(-2px)",
                      },
                      transition: "all 0.3s ease",
                    }}
                  >
                    اختر من الجهاز
                  </Button>
                </Box>
              </Paper>
            </motion.div>
          </Grid>

          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
          >
            <Box
              sx={{
                mt: 4,
                display: "flex",
                justifyContent: "center",
                gap: 3,
                pt: 3,
                borderTop: `1px solid ${
                  isDarkMode ? COLORS.accent3 : "rgba(0,0,0,0.1)"
                }`,
              }}
            >
              <Button
                variant="outlined"
                color="secondary"
                onClick={onClose}
                sx={{
                  px: 6,
                  py: 1.5,
                  borderRadius: "12px",
                  borderWidth: 2,
                  fontWeight: 600,
                  fontSize: "1rem",
                  borderColor: isDarkMode ? COLORS.accent3 : "#ccc",
                  color: isDarkMode ? COLORS.textPrimary : "#666",
                  "&:hover": {
                    borderWidth: 2,
                    transform: "translateY(-2px)",
                    borderColor: isDarkMode ? COLORS.primary : "#999",
                    backgroundColor: isDarkMode
                      ? "rgba(67, 200, 255, 0.1)"
                      : "rgba(0,0,0,0.04)",
                  },
                  transition: "all 0.3s ease",
                }}
              >
                إلغاء
              </Button>

              <Button
                variant="contained"
                color="primary"
                onClick={handleUpdateProduct}
                disabled={isUpdating}
                startIcon={
                  isUpdating ? (
                    <CircularProgress size={20} sx={{ color: "white" }} />
                  ) : (
                    <SaveIcon />
                  )
                }
                sx={{
                  px: 8,
                  py: 1.5,
                  borderRadius: "12px",
                  fontWeight: 700,
                  fontSize: "1rem",
                  background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.accent1} 100%)`,
                  boxShadow: `0 10px 30px ${COLORS.primary}40`,
                  "&:hover": {
                    background: `linear-gradient(135deg, ${COLORS.accent1} 0%, ${COLORS.primary} 100%)`,
                    boxShadow: `0 15px 40px ${COLORS.primary}60`,
                    transform: "translateY(-3px)",
                  },
                  "&:disabled": {
                    background: `linear-gradient(135deg, #666 0%, #999 100%)`,
                    boxShadow: "none",
                  },
                  transition: "all 0.3s ease",
                }}
              >
                {isUpdating ? "جاري التحديث..." : "💾 حفظ التعديلات"}
              </Button>
            </Box>
          </motion.div>
        </Box>
      </Stack>

      {/* Error & Success Messages */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Alert
            severity="error"
            sx={{
              position: "fixed",
              top: 20,
              right: 20,
              zIndex: 9999,
              borderRadius: "12px",
              boxShadow: `0 10px 30px ${COLORS.error}20`,
              bgcolor: isDarkMode ? COLORS.surface : "white",
            }}
            onClose={() => setError(null)}
          >
            {error}
          </Alert>
        </motion.div>
      )}

      {success && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Alert
            severity="success"
            sx={{
              position: "fixed",
              top: 20,
              right: 20,
              zIndex: 9999,
              borderRadius: "12px",
              boxShadow: `0 10px 30px ${COLORS.success}20`,
              bgcolor: isDarkMode ? COLORS.surface : "white",
            }}
          >
            ✅ تم تحديث المنتج بنجاح!
          </Alert>
        </motion.div>
      )}
    </Box>
  );
};

export default UpdateProduct;
