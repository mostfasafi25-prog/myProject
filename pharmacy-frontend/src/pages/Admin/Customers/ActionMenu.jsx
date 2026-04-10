import React, { useState, useEffect } from "react";
import {
  Box,
  IconButton,
  Tooltip,
  alpha,
  Typography,
  Paper,
} from "@mui/material";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import CloseIcon from "@mui/icons-material/Close";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

const ActionMenu = ({
  product,
  setViewDialog,
  setDeleteDialog,
  navigate,
  setUpateProct,
  colors,
  isDarkMode,
}) => {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState(false);
  let timeoutId;

  useEffect(() => {
    if (open && !hovered) {
      timeoutId = setTimeout(() => {
        setOpen(false);
      }, 3000);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [open, hovered]);

  const menuItems = [
    {
      id: 1,
      icon: <VisibilityIcon fontSize="small" />,
      label: "عرض التفاصيل",
      color: "#44c8ff",
      onClick: () => {
        setOpen(false);
        setViewDialog({ open: true, product });
      },
      leftrr: -40, // -20%
    },
    {
      id: 2,
      icon: <EditIcon fontSize="small" />,
      label: "تعديل المنتج",
      color: "#44c8ff",
      onClick: () => {
        setOpen(false);
        setUpateProct({
          open: true,
          productId: product.id, // 🔑
        });
      },
      leftrr: 5, // -5%
    },
    {
      id: 3,
      icon: <DeleteIcon fontSize="small" />,
      label: "حذف المنتج",
      color: "#9c9c9c",
      onClick: () => {
        setOpen(false);
        setDeleteDialog({ open: true, product });
      },
      leftrr: -40, // -20%
    },
  ];

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        position: "relative",
      }}
    >
      {/* الزر الرئيسي */}
      <Tooltip title="خيارات سريعة" arrow>
        <IconButton
          onClick={() => {
            setOpen(!open);
            setHovered(false);
            if (timeoutId) clearTimeout(timeoutId);
          }}
          size="small"
          sx={{
            color: open ? colors.blue : colors.gray,
            borderRadius: "50%",
            width: 36,
            height: 36,
            transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
            border: `1px solid ${alpha(colors.blue, open ? 0.3 : 0.1)}`,
            "&:hover": {
              backgroundColor: alpha(colors.blue, 0.15),
              transform: "rotate(90deg)",
              border: `1px solid ${colors.blue}`,
            },
          }}
        >
          {open ? (
            <CloseIcon fontSize="small" />
          ) : (
            <MoreVertIcon fontSize="small" />
          )}
        </IconButton>
      </Tooltip>

      {/* القائمة العمودية على اليمين */}
      {open && (
        <Box
          elevation={8}
          onMouseEnter={() => {
            setHovered(true);
            if (timeoutId) clearTimeout(timeoutId);
          }}
          onMouseLeave={() => {
            setHovered(false);
          }}
          sx={{
            position: "absolute",
            left: "calc(100% + 12px)",
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            gap: 1,
            padding: "12px 8px",
            minWidth: "140px",
            animation: "slideInRight 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
            "@keyframes slideInRight": {
              "0%": {
                opacity: 0,
                transform: "translateY(-50%) translateX(-20px) scale(0.9)",
              },
              "100%": {
                opacity: 1,
                transform: "translateY(-50%) translateX(0) scale(1)",
              },
            },
            // تصميم الذيل للمثلث الصغير
            "&::before": {
              content: '""',
              position: "absolute",
              right: "100%",
              top: "50%",
              transform: "translateY(-50%)",
            },
            "&::after": {
              content: '""',
              position: "absolute",
              right: "100%",
              top: "50%",
              transform: "translateY(-50%)",

              zIndex: -1,
            },
          }}
        >
          {menuItems.map((item, index) => (
            <Box
              key={item.id}
              onClick={item.onClick}
              sx={{
                bgcolor: item.color,
                display: "flex",
                alignItems: "center",
                transform: `translateX(${item.leftrr}px)`, // استخدم %

                borderRadius: 8,
                gap: 1.5,
                padding: "8px 12px",
                cursor: "pointer",
                transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                animation: `fadeIn 0.3s ease-out ${index * 0.1}s both`,
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                  color: "white",
                  transition: "all 0.3s ease",
                  "&:hover": {
                    backgroundColor: alpha(item.color, 0.25),
                    transform: "scale(1.1)",
                  },
                }}
              >
                {item.icon}
              </Box>
              <Typography
                variant="body2"
                sx={{
                  color: "white",
                  fontWeight: "500",
                  fontSize: "0.9rem",
                  letterSpacing: "0.3px",
                  whiteSpace: "nowrap", // منع الانتقال لسطر جديد

                  textShadow: "0 1px 2px rgba(0,0,0,0.05)",
                }}
              >
                {item.label}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default ActionMenu;
