import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  Input,
  MenuItem,
  Select,
  CardContent,
  CardMedia,
  Card,
  useTheme,
  Grid,
  Stack,
  FormControlLabel,
  Switch,
  CardActionArea,
  alpha,
  Fade,
  Zoom,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import DeleteIcon from "@mui/icons-material/Delete";
import PhotoCameraIcon from "@mui/icons-material/PhotoCamera";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import axios from "axios";
import Cookies from "universal-cookie";
import { showAppToast } from "../../../utils/appToast";
import { baseURL } from "../../../Api/Api";
import {
  ArrowUpward,
  FavoriteBorder,
  AddAPhoto,
  CheckCircle,
} from "@mui/icons-material";
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

const CreatProductPage = ({ onClose, onCreated }) => {
  const navigate = useNavigate();
  const cookies = new Cookies();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === "dark";
  const [selectedImageIndex, setSelectedImageIndex] = useState(-1);
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

  const [installmentIds, setInstallmentIds] = useState([]);
  const [installmentInput, setInstallmentInput] = useState("");
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [installmentWays, setInstallmentWays] = useState([]);
  const [Catagory, setCatagory] = useState([]);
  const [selectedInstallments, setSelectedInstallments] = useState([]);
  const [isHovered, setIsHovered] = useState(false);
  const token = cookies.get("userToken");

  // ألوان حسب وضع الدارك مود
  const colors = {
    primary: isDarkMode ? COLORS.primary : "#43c8ff",
    primaryLight: isDarkMode
      ? alpha(COLORS.primary, 0.1)
      : "rgba(67, 200, 255, 0.1)",
    primaryDark: isDarkMode ? COLORS.accent1 : "#2a9dff",
    background: isDarkMode ? COLORS.background : "#ffffff",
    surface: isDarkMode ? COLORS.surface : "#ffffff",
    cardBg: isDarkMode ? COLORS.surface : "#f8fafc",
    text: isDarkMode ? COLORS.textPrimary : "#1a1a1a",
    textSecondary: isDarkMode ? COLORS.textSecondary : "#666",
    border: isDarkMode ? alpha(COLORS.primary, 0.2) : "rgba(0,0,0,0.1)",
    hoverBorder: isDarkMode
      ? alpha(COLORS.primary, 0.4)
      : "rgba(67, 200, 255, 0.3)",
    shadow: isDarkMode
      ? "0 10px 30px rgba(0,0,0,0.3)"
      : "0 10px 30px rgba(0,0,0,0.04)",
    hoverShadow: isDarkMode
      ? "0 15px 40px rgba(0,0,0,0.4)"
      : "0 15px 40px rgba(0,0,0,0.08)",
  };

  const fetchInstallmentWays = async () => {
    try {
      const res = await axios.get(`${baseURL}market/get_installment_ways`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.data && res.data.data) {
        const ways = Array.isArray(res.data.data) ? res.data.data : [];
        setInstallmentWays(ways);
      }
    } catch (err) {
      console.error("❌ خطأ في جلب أنواع التقسيط:", err);
    }
  };

  const handleInstallmentClick = useCallback(
    (way) => {
      const isCurrentlySelected = selectedInstallments.some(
        (item) =>
          (way.id && item.id === way.id) ||
          (way.installment_id && item.installment_id === way.installment_id),
      );

      if (isCurrentlySelected) {
        setSelectedInstallments((prev) =>
          prev.filter(
            (item) =>
              !(
                (way.id && item.id === way.id) ||
                (way.installment_id &&
                  item.installment_id === way.installment_id)
              ),
          ),
        );
      } else {
        setSelectedInstallments((prev) => [...prev, way]);
      }
    },
    [selectedInstallments],
  );

  const isInstallmentSelected = (way) => {
    return selectedInstallments.some(
      (item) =>
        item.id === way.id || item.installment_id === way.installment_id,
    );
  };

  const fetchCatagory = async () => {
    try {
      const res = await axios.get(`${baseURL}categories`);

      if (res.data && res.data.data) {
        setCatagory(res.data.data);
      }
    } catch (err) {
      console.error("❌ خطأ في جلب التصنيفات:", err);
    }
  };

  useEffect(() => {
    fetchCatagory();
  }, []);

  const handleAddProduct = async () => {
    if (!token) {
      showAppToast("الرجاء تسجيل الدخول أولاً", "warning");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      if (!formData.name_ar) {
        showAppToast("يرجى إدخال اسم المنتج بالعربية", "warning");
        setIsLoading(false);
        return;
      }

      if (!formData.price) {
        showAppToast("يرجى إدخال سعر المنتج", "warning");
        setIsLoading(false);
        return;
      }

      if (!formData.category_id) {
        showAppToast("يرجى اختيار تصنيف للمنتج", "warning");
        setIsLoading(false);
        return;
      }

      const dataToSend = new FormData();

      dataToSend.append("name", formData.name_ar);
      dataToSend.append("name_en", formData.name_en || "");
      dataToSend.append("description_ar", formData.description_ar || "");
      dataToSend.append("description_en", formData.description_en || "");
      dataToSend.append("price", formData.price);
      dataToSend.append("price_offer", formData.price_offer || "");
      dataToSend.append("link", formData.link || "");
      dataToSend.append("category_id", formData.category_id);
      dataToSend.append("status", formData.status);

      if (selectedInstallments.length > 0) {
        selectedInstallments.forEach((installment) => {
          const installmentId = installment.id || installment.installment_id;
          if (installmentId) {
            dataToSend.append("installment_ids[]", installmentId);
          }
        });
      }

      if (images.length > 0) {
        images.forEach((imageObj) => {
          if (imageObj.file) {
            dataToSend.append("images[]", imageObj.file);
          }
        });
      } else {
        const defaultImage = await createDefaultImage();
        dataToSend.append("images[]", defaultImage);
      }

      const createRes = await axios.post(`${baseURL}customers`, dataToSend, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      });

      const responseData = createRes.data;

      if (
        responseData.success === true ||
        responseData.status === "success" ||
        (responseData.message && responseData.message.includes("success"))
      ) {
        setSuccess(true);
        const successMessage = responseData.message || "تم إضافة المنتج بنجاح!";

        setTimeout(() => {
          const newProduct =
            responseData.data || responseData.product || responseData;

          if (onCreated) {
            onCreated(newProduct);
          }

          onClose();
        }, 2000);
      } else if (responseData.error || responseData.errors) {
        const errorMsg =
          responseData.message ||
          responseData.error ||
          "حدث خطأ أثناء إضافة المنتج";
        throw new Error(errorMsg);
      } else if (typeof responseData === "string") {
        if (
          responseData.toLowerCase().includes("success") ||
          responseData.toLowerCase().includes("stored") ||
          responseData.toLowerCase().includes("created")
        ) {
          setSuccess(true);
          setTimeout(() => {
            if (onCreated) {
              onCreated({
                id: Date.now(),
                name_ar: formData.name_ar,
                price: formData.price,
                status: formData.status,
              });
            }
            onClose();
          }, 2000);
        } else {
          throw new Error(responseData);
        }
      } else {
        setSuccess(true);
        setTimeout(() => {
          if (onCreated) {
            onCreated(responseData);
          }
          onClose();
        }, 2000);
      }
    } catch (err) {
      console.error("❌ خطأ في الإضافة:", err);
      let errorMessage = "حدث خطأ أثناء إضافة المنتج";

      if (err.response) {
        if (err.response.data) {
          if (typeof err.response.data === "string") {
            errorMessage = err.response.data;
          } else if (err.response.data.message) {
            errorMessage = err.response.data.message;
          } else if (err.response.data.errors) {
            const errors = err.response.data.errors;
            errorMessage = Object.values(errors).flat().join(", ");
          }
        }
      } else if (err.request) {
        errorMessage = "لا يوجد اتصال بالخادم";
      } else {
        errorMessage = err.message;
      }

      setError(errorMessage);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchInstallmentWays();
    }
  }, [token]);

  const handleInputChange = (field) => (e) => {
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }));
  };

  const createDefaultImage = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");

    const gradient = ctx.createLinearGradient(0, 0, 400, 400);
    gradient.addColorStop(0, colors.primary);
    gradient.addColorStop(1, colors.primaryDark);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 400, 400);

    ctx.fillStyle = isDarkMode
      ? "rgba(30, 30, 30, 0.9)"
      : "rgba(255, 255, 255, 0.9)";
    ctx.fillRect(50, 50, 300, 300);

    ctx.fillStyle = isDarkMode ? "#FFFFFF" : "#333333";
    ctx.font = "bold 32px Arial";
    ctx.textAlign = "center";
    ctx.fillText("New Product", 200, 180);

    ctx.font = "20px Arial";
    ctx.fillText("Add Your Image", 200, 220);

    ctx.fillStyle = colors.primary;
    ctx.beginPath();
    ctx.arc(200, 280, 30, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = isDarkMode ? "#1E1E1E" : "white";
    ctx.beginPath();
    ctx.arc(200, 280, 15, 0, Math.PI * 2);
    ctx.fill();

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        const file = new File([blob], "default_product.png", {
          type: "image/png",
        });

        const imageObject = {
          id: `default_${Date.now()}`,
          file: file,
          preview: URL.createObjectURL(file),
          isNew: true,
        };

        setImages([imageObject]);
        setSelectedImageIndex(0);
        resolve(file);
      }, "image/png");
    });
  };

  const handleAddInstallment = () => {
    if (
      installmentInput.trim() &&
      !installmentIds.includes(installmentInput.trim())
    ) {
      setInstallmentIds([...installmentIds, installmentInput.trim()]);
      setInstallmentInput("");
    }
  };

  const handleRemoveInstallment = (id) => {
    setInstallmentIds(installmentIds.filter((item) => item !== id));
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    const newImageObjects = files.map((file, index) => ({
      id: `new_${Date.now()}_${index}_${Math.random()}`,
      file: file,
      preview: URL.createObjectURL(file),
      isNew: true,
    }));

    setImages([...images, ...newImageObjects]);

    if (selectedImageIndex === -1 && newImageObjects.length > 0) {
      setSelectedImageIndex(0);
    }
  };

  const handleRemoveImage = (index) => {
    const imageToRemove = images[index];
    if (imageToRemove && imageToRemove.preview && imageToRemove.isNew) {
      URL.revokeObjectURL(imageToRemove.preview);
    }

    const updatedImages = images.filter((_, i) => i !== index);
    setImages(updatedImages);

    if (selectedImageIndex === index) {
      if (updatedImages.length > 0) {
        setSelectedImageIndex(0);
      } else {
        setSelectedImageIndex(-1);
      }
    } else if (selectedImageIndex > index) {
      setSelectedImageIndex(selectedImageIndex - 1);
    }
  };

  const getDisplayedImage = () => {
    if (images.length === 0) {
      return "/323.jpg";
    }

    if (selectedImageIndex >= 0 && selectedImageIndex < images.length) {
      const selectedImage = images[selectedImageIndex];
      return selectedImage.preview;
    }

    const firstImage = images[0];
    return firstImage.preview;
  };

  const handleSelectImage = (index) => {
    setSelectedImageIndex(index);
  };

  return (
    <Box sx={{ p: 3, width: "100%", bgcolor: colors.background }}>
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
                background: "transparent",
                boxShadow: "none",
                textDecoration: "none",
                borderRadius: "26px",
                "&::before": {
                  content: '""',
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: "26px",
                  padding: "3px",
                  background: `linear-gradient(to bottom, ${colors.primary} 0%, transparent 100%)`,
                  WebkitMask:
                    "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                  WebkitMaskComposite: "xor",
                  maskComposite: "exclude",
                  pointerEvents: "none",
                },
                transition: "all 0.3s ease",
                "&:hover": {
                  boxShadow: colors.hoverShadow,
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
                      ? alpha(COLORS.surface, 0.9)
                      : "rgba(255, 255, 255, 0.9)",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    "&:hover": {
                      bgcolor: isDarkMode
                        ? COLORS.surface
                        : "rgba(255, 255, 255, 1)",
                    },
                  }}
                >
                  <FavoriteBorder
                    sx={{ color: colors.textSecondary, fontSize: 24 }}
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
                  alt={formData.name_ar || "منتج جديد"}
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

              <CardContent sx={{ p: 3, bgcolor: colors.surface }}>
                <Stack direction={"column"} spacing={2}>
                  {/* اسم المنتج */}
                  <Typography
                    variant="h6"
                    sx={{
                      fontWeight: 600,
                      fontSize: "1.2rem",
                      lineHeight: 1.4,
                      textAlign: "right",
                      color: colors.text,
                    }}
                  >
                    {formData.name_ar || "منتج جديد"}
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
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                    >
                      {/* السعر النهائي (إذا كان هناك عرض فهو السعر، وإلا فهو السعر الأساسي) */}
                      <Typography
                        variant="h5"
                        sx={{
                          fontWeight: 800,
                          color: colors.primary,
                          fontSize: "1.9rem",
                        }}
                      >
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
                        {formData.price_offer || formData.price || "0.00"}
                      </Typography>

                      {/* إذا كان هناك عرض، اعرض السعر الأساسي مشطوباً */}
                      {formData.price_offer && formData.price && (
                        <Typography
                          variant="body2"
                          sx={{
                            textDecoration: "line-through",
                            color: colors.textSecondary,
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
                      color: colors.textSecondary,
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
                      ? `linear-gradient(145deg, ${COLORS.surface} 0%, ${alpha(
                          COLORS.surface,
                          0.8,
                        )} 100%)`
                      : "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
                    boxShadow: colors.shadow,
                    border: `1px solid ${colors.border}`,
                    transition: "all 0.3s ease",
                    "&:hover": {
                      boxShadow: colors.hoverShadow,
                    },
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{
                      mb: 3,
                      fontWeight: 700,
                      color: colors.text,
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    📝 المعلومات الأساسية
                  </Typography>

                  <TextField
                    fullWidth
                    label="الاسم بالعربية"
                    value={formData.name_ar}
                    onChange={handleInputChange("name_ar")}
                    placeholder="أدخل اسم المنتج بالعربية"
                    sx={{
                      mb: 3,
                      // 1. محاذاة النص المدخل
                      "& .MuiInputBase-input": {
                        textAlign: "right",
                        direction: "rtl",
                        color: colors.text,
                        fontWeight: 700,
                      },

                      // 2. تعديل الليبل (التسمية)
                      "& .MuiInputLabel-root": {
                        left: "unset",
                        right: "34px",
                        transformOrigin: "right",
                        color: colors.textSecondary,
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
                        backgroundColor: colors.primaryLight,
                        borderRadius: "12px",
                        transition: "all 0.3s ease",
                        textAlign: "right",
                        direction: "rtl",

                        // 5. البوردر العادي
                        "& fieldset": {
                          borderColor: colors.border,
                          transition: "all 0.3s ease",
                          textAlign: "right",
                          direction: "rtl",
                        },

                        // البوردر عند التركيز
                        "&.Mui-focused fieldset": {
                          borderColor: colors.primary,
                          borderWidth: "2px",
                          boxShadow: `0 0 0 3px ${alpha(colors.primary, 0.1)}`,
                        },

                        // البوردر عند التحويم
                        "&:hover fieldset": {
                          borderColor: colors.hoverBorder || colors.primary,
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
                        color: colors.text,
                        fontWeight: 700,
                      },

                      // 2. تعديل الليبل (التسمية)
                      "& .MuiInputLabel-root": {
                        left: "unset",
                        right: "34px",
                        transformOrigin: "right",
                        color: colors.textSecondary,
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
                        backgroundColor: colors.primaryLight,
                        borderRadius: "12px",
                        transition: "all 0.3s ease",
                        textAlign: "right",
                        direction: "rtl",

                        // 5. البوردر العادي
                        "& fieldset": {
                          borderColor: colors.border,
                          transition: "all 0.3s ease",
                          textAlign: "right",
                          direction: "rtl",
                        },

                        // البوردر عند التركيز
                        "&.Mui-focused fieldset": {
                          borderColor: colors.primary,
                          borderWidth: "2px",
                          boxShadow: `0 0 0 3px ${alpha(colors.primary, 0.1)}`,
                        },

                        // البوردر عند التحويم
                        "&:hover fieldset": {
                          borderColor: colors.hoverBorder || colors.primary,
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
                        color: colors.text,
                        fontWeight: 700,
                      },

                      // 2. تعديل الليبل (التسمية)
                      "& .MuiInputLabel-root": {
                        left: "unset",
                        right: "34px",
                        transformOrigin: "right",
                        color: colors.textSecondary,
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
                        backgroundColor: colors.primaryLight,
                        borderRadius: "12px",
                        transition: "all 0.3s ease",
                        textAlign: "right",
                        direction: "rtl",

                        // 5. البوردر العادي
                        "& fieldset": {
                          borderColor: colors.border,
                          transition: "all 0.3s ease",
                          textAlign: "right",
                          direction: "rtl",
                        },

                        // البوردر عند التركيز
                        "&.Mui-focused fieldset": {
                          borderColor: colors.primary,
                          borderWidth: "2px",
                          boxShadow: `0 0 0 3px ${alpha(colors.primary, 0.1)}`,
                        },

                        // البوردر عند التحويم
                        "&:hover fieldset": {
                          borderColor: colors.hoverBorder || colors.primary,
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
                    sx={{
                      mb: 3,
                      // 1. محاذاة النص المدخل
                      "& .MuiInputBase-input": {
                        textAlign: "right",
                        direction: "rtl",
                        color: colors.text,
                        fontWeight: 700,
                      },

                      // 2. تعديل الليبل (التسمية)
                      "& .MuiInputLabel-root": {
                        left: "unset",
                        right: "34px",
                        transformOrigin: "right",
                        color: colors.textSecondary,
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
                        backgroundColor: colors.primaryLight,
                        borderRadius: "12px",
                        transition: "all 0.3s ease",
                        textAlign: "right",
                        direction: "rtl",

                        // 5. البوردر العادي
                        "& fieldset": {
                          borderColor: colors.border,
                          transition: "all 0.3s ease",
                          textAlign: "right",
                          direction: "rtl",
                        },

                        // البوردر عند التركيز
                        "&.Mui-focused fieldset": {
                          borderColor: colors.primary,
                          borderWidth: "2px",
                          boxShadow: `0 0 0 3px ${alpha(colors.primary, 0.1)}`,
                        },

                        // البوردر عند التحويم
                        "&:hover fieldset": {
                          borderColor: colors.hoverBorder || colors.primary,
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
                        label="السعر *"
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
                            color: colors.text,
                            fontWeight: 700,
                          },

                          // 2. تعديل الليبل (التسمية)
                          "& .MuiInputLabel-root": {
                            left: "unset",
                            right: "34px",
                            transformOrigin: "right",
                            color: colors.textSecondary,
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
                            backgroundColor: colors.primaryLight,
                            borderRadius: "12px",
                            transition: "all 0.3s ease",
                            textAlign: "right",
                            direction: "rtl",

                            // 5. البوردر العادي
                            "& fieldset": {
                              borderColor: colors.border,
                              transition: "all 0.3s ease",
                              textAlign: "right",
                              direction: "rtl",
                            },

                            // البوردر عند التركيز
                            "&.Mui-focused fieldset": {
                              borderColor: colors.primary,
                              borderWidth: "2px",
                              boxShadow: `0 0 0 3px ${alpha(
                                colors.primary,
                                0.1,
                              )}`,
                            },

                            // البوردر عند التحويم
                            "&:hover fieldset": {
                              borderColor: colors.hoverBorder || colors.primary,
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
                        InputProps={{
                          inputProps: { min: 0, step: 0.01 },
                        }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, md: 6 }} xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="سعر العرض (اختياري)"
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
                            color: colors.text,
                            fontWeight: 700,
                          },

                          // 2. تعديل الليبل (التسمية)
                          "& .MuiInputLabel-root": {
                            left: "unset",
                            right: "34px",
                            transformOrigin: "right",
                            color: colors.textSecondary,
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
                            backgroundColor: colors.primaryLight,
                            borderRadius: "12px",
                            transition: "all 0.3s ease",
                            textAlign: "right",
                            direction: "rtl",

                            // 5. البوردر العادي
                            "& fieldset": {
                              borderColor: colors.border,
                              transition: "all 0.3s ease",
                              textAlign: "right",
                              direction: "rtl",
                            },

                            // البوردر عند التركيز
                            "&.Mui-focused fieldset": {
                              borderColor: colors.primary,
                              borderWidth: "2px",
                              boxShadow: `0 0 0 3px ${alpha(
                                colors.primary,
                                0.1,
                              )}`,
                            },

                            // البوردر عند التحويم
                            "&:hover fieldset": {
                              borderColor: colors.hoverBorder || colors.primary,
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
                      ? `linear-gradient(145deg, ${COLORS.surface} 0%, ${alpha(
                          COLORS.surface,
                          0.8,
                        )} 100%)`
                      : "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
                    boxShadow: colors.shadow,
                    border: `1px solid ${colors.border}`,
                    transition: "all 0.3s ease",
                    "&:hover": {
                      boxShadow: colors.hoverShadow,
                    },
                  }}
                >
                  <Typography
                    variant="h6"
                    sx={{
                      mb: 3,
                      fontWeight: 700,
                      color: colors.text,
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
                        color: colors.text,
                        fontWeight: 700,
                      },

                      // 2. تعديل الليبل (التسمية)
                      "& .MuiInputLabel-root": {
                        left: "unset",
                        right: "34px",
                        transformOrigin: "right",
                        color: colors.textSecondary,
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
                        backgroundColor: colors.primaryLight,
                        borderRadius: "12px",
                        transition: "all 0.3s ease",
                        textAlign: "right",
                        direction: "rtl",

                        // 5. البوردر العادي
                        "& fieldset": {
                          borderColor: colors.border,
                          transition: "all 0.3s ease",
                          textAlign: "right",
                          direction: "rtl",
                        },

                        // البوردر عند التركيز
                        "&.Mui-focused fieldset": {
                          borderColor: colors.primary,
                          borderWidth: "2px",
                          boxShadow: `0 0 0 3px ${alpha(colors.primary, 0.1)}`,
                        },

                        // البوردر عند التحويم
                        "&:hover fieldset": {
                          borderColor: colors.hoverBorder || colors.primary,
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
                        color: colors.text,
                        fontWeight: 700,
                      },

                      // 2. تعديل الليبل (التسمية)
                      "& .MuiInputLabel-root": {
                        left: "unset",
                        right: "34px",
                        transformOrigin: "right",
                        color: colors.textSecondary,
                        fontFamily: "'Tajawal', sans-serif",
                        fontSize: 18,
                        fontWeight: 700,
                        mx: 1,
                      },

                      // 3. تعديل الليبل عند التقلص (Shrunk/Focused)
                      "& .MuiInputLabel-shrink": {
                        transform: "translate(14px, -9px) scale(0.75)",
                        transformOrigin: "right",
                      },

                      // 4. تنسيق حقل الإدخال نفسه
                      "& .MuiOutlinedInput-root": {
                        backgroundColor: colors.primaryLight,
                        borderRadius: "12px",
                        transition: "all 0.3s ease",
                        textAlign: "right",
                        direction: "rtl",

                        // 5. البوردر العادي
                        "& fieldset": {
                          borderColor: colors.border,
                          transition: "all 0.3s ease",
                          textAlign: "right",
                          direction: "rtl",
                        },

                        // البوردر عند التركيز
                        "&.Mui-focused fieldset": {
                          borderColor: colors.primary,
                          borderWidth: "2px",
                          boxShadow: `0 0 0 3px ${alpha(colors.primary, 0.1)}`,
                        },

                        // البوردر عند التحويم
                        "&:hover fieldset": {
                          borderColor: colors.hoverBorder || colors.primary,
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
                  >
                    <InputLabel sx={{ color: colors.textSecondary }}>
                      التصنيف
                    </InputLabel>
                    <Select
                      value={formData.category_id}
                      onChange={handleInputChange("category_id")}
                      label="التصنيف "
                      required
                      disabled={isLoading}
                      sx={{ color: colors.text }}
                    >
                      <MenuItem
                        value=""
                        sx={{
                          justifyContent: "flex-end",
                          direction: "rtl",
                          color: colors.textSecondary,
                        }}
                      >
                        اختر تصنيف المنتج
                      </MenuItem>

                      {Catagory && Catagory.length > 0 ? (
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
                                bgcolor: colors.primaryLight,
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
                                    color: colors.text,
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
                            color: colors.textSecondary,
                            padding: "20px",
                          }}
                        >
                          {isLoading ? (
                            <>
                              <CircularProgress size={20} sx={{ mr: 1 }} />
                              جاري تحميل التصنيفات...
                            </>
                          ) : (
                            "لا توجد تصنيفات متاحة"
                          )}
                        </MenuItem>
                      )}
                    </Select>
                  </FormControl>

                  {/* Installment Ways */}
                  <Box sx={{ mb: 3 }}>
                    <Typography
                      variant="h6"
                      gutterBottom
                      fontWeight="700"
                      sx={{
                        color: colors.text,
                        mb: 3,
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                      }}
                    >
                      💳 طرق التقسيط المتاحة
                    </Typography>

                    {installmentWays.length > 0 ? (
                      <Box sx={{ mb: 3 }}>
                        <Box
                          sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            justifyContent: "center",
                            gap: 2,
                            mb: 4,
                          }}
                        >
                          {installmentWays.map((way, index) => {
                            const uniqueKey =
                              way.id ||
                              way.installment_id ||
                              `installment-${index}`;

                            const isSelected = selectedInstallments.some(
                              (item) => {
                                return (
                                  (item.id && way.id && item.id === way.id) ||
                                  (item.installment_id &&
                                    way.installment_id &&
                                    item.installment_id ===
                                      way.installment_id) ||
                                  (item.id &&
                                    way.installment_id &&
                                    item.id === way.installment_id) ||
                                  (item.installment_id &&
                                    way.id &&
                                    item.installment_id === way.id)
                                );
                              },
                            );
                            return (
                              <motion.div
                                key={uniqueKey}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                <Box
                                  onClick={() => handleInstallmentClick(way)}
                                  sx={{
                                    position: "relative",
                                    width: 100,
                                    height: 100,
                                    borderRadius: "20px",
                                    overflow: "hidden",
                                    cursor: "pointer",
                                    transition:
                                      "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                                    border: isSelected
                                      ? `3px solid ${colors.primary}`
                                      : `2px solid ${colors.border}`,
                                    boxShadow: isSelected
                                      ? `0 10px 30px ${alpha(
                                          colors.primary,
                                          0.3,
                                        )}, 0 0 0 3px ${alpha(
                                          colors.primary,
                                          0.1,
                                        )}`
                                      : "0 4px 15px rgba(0,0,0,0.08)",
                                    transform: isSelected
                                      ? "translateY(-4px)"
                                      : "translateY(0)",
                                    "&:hover": {
                                      transform: "translateY(-4px)",
                                      boxShadow: "0 15px 40px rgba(0,0,0,0.15)",
                                    },
                                  }}
                                >
                                  <Box
                                    component="img"
                                    src={
                                      way.image ||
                                      "/placeholder-installment.png"
                                    }
                                    alt={way.name_ar || way.name}
                                    sx={{
                                      width: "100%",
                                      height: "100%",
                                      objectFit: "cover",
                                      transition: "all 0.3s ease",
                                    }}
                                    onError={(e) => {
                                      e.target.src =
                                        "/placeholder-installment.png";
                                      e.target.style.objectFit = "contain";
                                    }}
                                  />

                                  {isSelected && (
                                    <>
                                      <Box
                                        sx={{
                                          position: "absolute",
                                          top: 0,
                                          left: 0,
                                          right: 0,
                                          bottom: 0,
                                          bgcolor: alpha(colors.primary, 0.15),
                                        }}
                                      />

                                      <Box
                                        sx={{
                                          position: "absolute",
                                          top: 8,
                                          right: 8,
                                          width: 28,
                                          height: 28,
                                          bgcolor: colors.primary,
                                          color: "white",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          borderRadius: "50%",
                                          boxShadow: `0 4px 12px ${alpha(
                                            colors.primary,
                                            0.4,
                                          )}`,
                                        }}
                                      >
                                        <CheckCircle sx={{ fontSize: 18 }} />
                                      </Box>
                                    </>
                                  )}

                                  <Box
                                    sx={{
                                      position: "absolute",
                                      bottom: 0,
                                      left: 0,
                                      right: 0,
                                      bgcolor: "rgba(0,0,0,0.8)",
                                      color: "white",
                                      padding: "8px 4px",
                                      textAlign: "center",
                                      fontSize: "0.75rem",
                                      fontWeight: 600,
                                      opacity: 0,
                                      transition: "opacity 0.3s ease",
                                      "&:hover": {
                                        opacity: 1,
                                      },
                                    }}
                                  >
                                    {way.name_ar ||
                                      way.name ||
                                      `تقسيط ${way.id}`}
                                  </Box>
                                </Box>
                              </motion.div>
                            );
                          })}
                        </Box>

                        {selectedInstallments.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                          >
                            <Typography
                              variant="subtitle1"
                              gutterBottom
                              fontWeight={700}
                              sx={{ mb: 2, color: colors.text }}
                            >
                              طرق التقسيط المختارة (
                              {selectedInstallments.length})
                            </Typography>

                            <Box
                              sx={{
                                display: "flex",
                                flexWrap: "nowrap",
                                overflowX: "auto",
                                gap: 2,
                                pb: 2,
                                "&::-webkit-scrollbar": {
                                  height: 8,
                                },
                                "&::-webkit-scrollbar-track": {
                                  background: alpha(colors.primary, 0.05),
                                  borderRadius: 10,
                                },
                                "&::-webkit-scrollbar-thumb": {
                                  background: alpha(colors.primary, 0.5),
                                  borderRadius: 10,
                                },
                              }}
                            >
                              {selectedInstallments.map((way, index) => (
                                <Box
                                  key={way.id || way.installment_id || index}
                                  sx={{
                                    position: "relative",
                                    flexShrink: 0,
                                    width: 80,
                                    height: 80,
                                    borderRadius: "18px",
                                    overflow: "hidden",
                                    border: `3px solid ${colors.primary}`,
                                    boxShadow: `0 8px 20px ${alpha(
                                      colors.primary,
                                      0.25,
                                    )}`,
                                  }}
                                >
                                  <Box
                                    component="img"
                                    src={
                                      way.image ||
                                      "/placeholder-installment.png"
                                    }
                                    alt={way.name_ar || way.name}
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

                                  <Box
                                    sx={{
                                      position: "absolute",
                                      top: 4,
                                      left: 4,
                                      width: 24,
                                      height: 24,
                                      bgcolor: colors.primary,
                                      color: "white",
                                      fontSize: "0.75rem",
                                      fontWeight: "bold",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      borderRadius: "8px",
                                      boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
                                    }}
                                  >
                                    {index + 1}
                                  </Box>

                                  <IconButton
                                    size="small"
                                    onClick={() => {
                                      setSelectedInstallments(
                                        selectedInstallments.filter(
                                          (item) =>
                                            item.id !== way.id &&
                                            item.installment_id !==
                                              way.installment_id,
                                        ),
                                      );
                                    }}
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
                                      transition: "all 0.2s ease",
                                    }}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Box>
                              ))}
                            </Box>
                          </motion.div>
                        )}
                      </Box>
                    ) : (
                      <Alert
                        severity="info"
                        sx={{
                          mb: 2,
                          borderRadius: "12px",
                          bgcolor: isDarkMode
                            ? alpha(COLORS.accent3, 0.1)
                            : undefined,
                        }}
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
          <Grid size={{ xs: 12 }} xs={12} md={6}>
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
                    ? `linear-gradient(145deg, ${COLORS.surface} 0%, ${alpha(
                        COLORS.surface,
                        0.8,
                      )} 100%)`
                    : "linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)",
                  boxShadow: colors.shadow,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <Typography
                  variant="h6"
                  sx={{
                    mb: 3,
                    fontWeight: 700,
                    color: colors.text,
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                  }}
                >
                  🖼️ صور المنتج
                </Typography>

                {/* Images Grid */}
                {images.length > 0 && (
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
                                  ? `3px solid ${colors.primary}`
                                  : `2px solid ${colors.border}`,
                              boxShadow:
                                selectedImageIndex === index
                                  ? `0 10px 30px ${alpha(colors.primary, 0.3)}`
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
                              src={img.preview}
                              alt={`صورة ${index + 1}`}
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
                                bgcolor: "error.main",
                                color: "white",
                                "&:hover": {
                                  bgcolor: "error.dark",
                                  transform: "scale(1.1)",
                                },
                                transition: "all 0.2s ease",
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveImage(index);
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
                                boxShadow: `0 2px 8px ${alpha(
                                  COLORS.success,
                                  0.3,
                                )}`,
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
                    border: `2px dashed ${alpha(colors.primary, 0.3)}`,
                    backgroundColor: alpha(colors.primary, 0.03),
                    minHeight: 200,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    overflow: "hidden",
                    "&:hover": {
                      borderColor: colors.primary,
                      backgroundColor: alpha(colors.primary, 0.06),
                      transform: "translateY(-2px)",
                      boxShadow: `0 20px 40px ${alpha(colors.primary, 0.1)}`,
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
                        backgroundColor: alpha(colors.primary, 0.1),
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        mb: 3,
                        border: `2px solid ${alpha(colors.primary, 0.2)}`,
                      }}
                    >
                      <AddAPhoto sx={{ color: colors.primary, fontSize: 40 }} />
                    </Box>
                  </motion.div>

                  <Typography
                    variant="h6"
                    color="primary"
                    fontWeight="700"
                    gutterBottom
                    sx={{
                      background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
                      WebkitBackgroundClip: "text",
                      WebkitTextFillColor: "transparent",
                    }}
                  >
                    انقر أو اسحب الصور هنا
                  </Typography>

                  <Typography
                    variant="body2"
                    color={colors.textSecondary}
                    sx={{ mb: 3 }}
                  >
                    PNG, JPG, GIF يصل حجمها إلى 10MB
                  </Typography>

                  <Button
                    variant="outlined"
                    size="medium"
                    startIcon={<CloudUploadIcon />}
                    sx={{
                      borderColor: colors.primary,
                      color: colors.primary,
                      fontWeight: 600,
                      borderRadius: "12px",
                      px: 4,
                      py: 1,
                      "&:hover": {
                        borderColor: colors.primaryDark,
                        backgroundColor: colors.primaryLight,
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
                borderTop: `1px solid ${colors.border}`,
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
                  "&:hover": {
                    borderWidth: 2,
                    transform: "translateY(-2px)",
                  },
                  transition: "all 0.3s ease",
                }}
              >
                إلغاء
              </Button>

              <Button
                variant="contained"
                color="primary"
                onClick={handleAddProduct}
                disabled={isLoading}
                startIcon={
                  isLoading ? <CircularProgress size={20} /> : <SaveIcon />
                }
                sx={{
                  px: 8,
                  py: 1.5,
                  borderRadius: "12px",
                  fontWeight: 700,
                  fontSize: "1rem",
                  background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%)`,
                  boxShadow: `0 10px 30px ${alpha(colors.primary, 0.4)}`,
                  "&:hover": {
                    background: `linear-gradient(135deg, ${colors.primaryDark} 0%, ${colors.primary} 100%)`,
                    boxShadow: `0 15px 40px ${alpha(colors.primary, 0.6)}`,
                    transform: "translateY(-3px)",
                  },
                  "&:disabled": {
                    background: `linear-gradient(135deg, ${
                      colors.textSecondary
                    } 0%, ${alpha(colors.textSecondary, 0.5)} 100%)`,
                    boxShadow: "none",
                  },
                  transition: "all 0.3s ease",
                }}
              >
                {isLoading ? "جاري الإضافة..." : "✨ إضافة المنتج"}
              </Button>
            </Box>
          </motion.div>
        </Box>
      </Stack>
    </Box>
  );
};

export default CreatProductPage;
