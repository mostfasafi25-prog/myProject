import { Category, DarkMode, Dashboard, Inventory2, LightMode, LocalShipping, Replay } from "@mui/icons-material";
import { alpha, Box, Button, Card, IconButton, Stack, Typography, useTheme } from "@mui/material";
import { useNavigate } from "react-router-dom";

/**
 * لوحة التوريد للسوبر كاشير — روابط سريعة للمخزون والمشتريات (بدون بقية لوحة الأدمن).
 */
export default function SuperCashierSupplyPage({ mode = "light", onToggleMode }) {
  const theme = useTheme();
  const navigate = useNavigate();

  const cards = [
    {
      title: "الأصناف والمخزون",
      desc: "إضافة صنف، استلام كميات، البونص",
      icon: <Inventory2 sx={{ fontSize: 40 }} />,
      path: "/admin/inventory",
      color: theme.palette.primary.main,
    },
    {
      title: "الأقسام",
      desc: "تنظيم أقسام الأصناف",
      icon: <Category sx={{ fontSize: 40 }} />,
      path: "/admin/categories",
      color: theme.palette.secondary.main,
    },
    {
      title: "فواتير الشراء",
      desc: "متابعة قسائم التوريد المسجّلة",
      icon: <LocalShipping sx={{ fontSize: 40 }} />,
      path: "/admin/purchases",
      color: theme.palette.info.main,
    },
    {
      title: "مرتجعات المشتريات",
      desc: "إرجاع قسيمة شرائية مسجّلة",
      icon: <Replay sx={{ fontSize: 40 }} />,
      path: "/admin/returns/purchases",
      color: theme.palette.warning.main,
    },
  ];

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "background.default",
        p: { xs: 2, sm: 3 },
        background: `linear-gradient(160deg, ${alpha(theme.palette.primary.main, 0.07)}, ${alpha(theme.palette.secondary.main, 0.05)})`,
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3, flexWrap: "wrap", gap: 1.5 }}>
        <Stack direction="row" alignItems="center" sx={{ gap: 1.25 }}>
          <Dashboard color="primary" sx={{ fontSize: 36 }} />
          <Box>
            <Typography variant="h5" fontWeight={900}>
              لوحة التوريد
            </Typography>
            <Typography variant="body2" color="text.secondary">
              سوبر كاشير — وصول سريع للمخزون والمشتريات دون عرض الصندوق العام
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" alignItems="center" sx={{ gap: 1 }}>
          {onToggleMode ? (
            <IconButton onClick={onToggleMode} color="primary" aria-label="تبديل الوضع">
              {mode === "dark" ? <LightMode /> : <DarkMode />}
            </IconButton>
          ) : null}
          <Button variant="contained" onClick={() => navigate("/cashier")} sx={{ textTransform: "none", fontWeight: 800 }}>
            العودة للكاشير
          </Button>
        </Stack>
      </Stack>

      <Stack sx={{ gap: 2, maxWidth: 720, mx: "auto" }}>
        {cards.map((c) => (
          <Card
            key={c.path}
            elevation={0}
            sx={{
              p: 2.5,
              borderRadius: 3,
              border: `1px solid ${alpha(c.color, 0.25)}`,
              cursor: "pointer",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
              "&:hover": {
                transform: "translateY(-3px)",
                boxShadow: `0 12px 28px ${alpha(c.color, 0.18)}`,
              },
            }}
            onClick={() => navigate(c.path)}
          >
            <Stack direction="row" alignItems="center" sx={{ gap: 2 }}>
              <Box sx={{ color: c.color }}>{c.icon}</Box>
              <Box sx={{ flex: 1 }}>
                <Typography fontWeight={900}>{c.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {c.desc}
                </Typography>
              </Box>
              <Button variant="outlined" size="small" sx={{ textTransform: "none", fontWeight: 800 }}>
                فتح
              </Button>
            </Stack>
          </Card>
        ))}
      </Stack>
    </Box>
  );
}
