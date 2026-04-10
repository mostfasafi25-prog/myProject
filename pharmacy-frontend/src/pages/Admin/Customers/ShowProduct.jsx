import React from "react";
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Typography,
  IconButton,
  Stack,
  useTheme,
} from "@mui/material";
import { FavoriteBorder } from "@mui/icons-material";

// مجموعة الألوان للدارك مود (نفس ألوان الكوبونات)
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

export default function ShowProduct({ product, theme }) {
  if (!product) {
    return null;
  }

  const isDarkMode = theme.palette.mode === "dark";

  return (
    <Box
      sx={{
        py: 4,
        display: "flex",
        justifyContent: "center",
        bgcolor: isDarkMode ? COLORS.background : "#ffffff",
      }}
    >
      <Card
        sx={{
          height: "100%",
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
          }}
        >
          <CardMedia
            component="img"
            height="400"
            src={
              product.images && product.images.length > 0
                ? product.images[0].image
                : "/323.jpg"
            }
            alt={product.name_ar || product.name || "منتج"}
            sx={{
              overflow: "hidden",
              borderRadius: "26px 26px 0 0",
              width: "100%",
              height: 270,
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
          <Stack direction={"column"} justifyContent={"space-between"}>
            {/* السعر */}
            <Stack
              direction={"row"}
              justifyContent={"space-between"}
              sx={{
                direction: "ltr",
                display: "flex",
                alignItems: "center",
              }}
            >
              {" "}
              {/* اسم المنتج */}
              <Stack direction={"row"} alignItems={"center"} gap={1}>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 800,
                    color: COLORS.primary,
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
                  {product.price}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{
                    textDecoration: "line-through",
                    color: isDarkMode ? COLORS.textSecondary : "#999",
                    textAlign: "left",
                  }}
                >
                  {product.price_offer}
                </Typography>{" "}
              </Stack>{" "}
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 600,
                  fontSize: "1.2rem",
                  lineHeight: 1.4,
                  overflow: "hidden",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  color: isDarkMode ? COLORS.textPrimary : "#1a1a1a",
                }}
              >
                {product.name_ar || product.name || "منتج"}
              </Typography>
            </Stack>
            <Box sx={{ justifyItems: "end", pt: 4 }}>
              <Typography
                sx={{
                  mt: 1,
                  flexWrap: "wrap",
                  maxWidth: 233,
                  color: isDarkMode ? COLORS.textSecondary : "#666",
                  fontSize: "0.95rem",
                  mb: 2,
                  overflow: "hidden",
                  textAlign: "end",
                }}
              >
                {product.description_ar || "لا يوجد وصف"}
              </Typography>{" "}
            </Box>
          </Stack>
        </CardContent>
      </Card>{" "}
    </Box>
  );
}
