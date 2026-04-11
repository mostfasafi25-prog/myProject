import { Close, LocalPharmacy, Medication, Schedule, TipsAndUpdates } from "@mui/icons-material";
import {
  alpha,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { productDisplayName } from "../utils/productDisplayName";

function Section({ icon, title, children, emptyHint }) {
  const theme = useTheme();
  const hasBody = Boolean(String(children || "").trim());
  return (
    <Box
      component="section"
      sx={{
        borderRadius: 2.5,
        border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
        bgcolor: alpha(theme.palette.primary.main, 0.03),
        p: { xs: 1.35, sm: 1.75 },
        textAlign: "right",
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: hasBody ? 1 : 0.5 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            display: "grid",
            placeItems: "center",
            bgcolor: alpha(theme.palette.primary.main, 0.14),
            color: "primary.main",
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
        <Typography variant="subtitle1" fontWeight={900} sx={{ flex: 1, minWidth: 0 }}>
          {title}
        </Typography>
      </Stack>
      {hasBody ? (
        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.65, color: "text.primary" }}>
          {children}
        </Typography>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: "italic", lineHeight: 1.6 }}>
          {emptyHint}
        </Typography>
      )}
    </Box>
  );
}

/**
 * نافذة معلومات الدواء للكاشير — مُحسّنة للشاشات الصغيرة (ملء الشاشة على الهاتف).
 */
export default function ProductPatientInfoDialog({ open, product, onClose, onAddToCart, saleTypeLabel }) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  if (!product) return null;

  const title = productDisplayName(product);
  const img = typeof product.image === "string" && product.image.trim() ? product.image.trim() : "";
  const how = String(product.usageHowTo || "").trim();
  const freq = String(product.usageFrequency || "").trim();
  const tips = String(product.usageTips || "").trim();
  const legacyDesc = String(product.desc || "").trim();
  const showLegacy = legacyDesc && !how && !freq && !tips;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      fullScreen={fullScreen}
      scroll="paper"
      slotProps={{
        paper: {
          sx: {
            borderRadius: fullScreen ? 0 : 3,
            overflow: "hidden",
            maxHeight: fullScreen ? "100%" : "92vh",
          },
        },
      }}
    >
      <DialogTitle
        sx={{
          position: "relative",
          py: { xs: 1.75, sm: 2 },
          px: { xs: 5, sm: 6 },
          textAlign: "center",
          borderBottom: `1px solid ${theme.palette.divider}`,
          fontWeight: 900,
          fontSize: { xs: "1rem", sm: "1.1rem" },
          lineHeight: 1.35,
        }}
      >
        <IconButton
          aria-label="إغلاق"
          onClick={onClose}
          size="small"
          sx={{
            position: "absolute",
            top: "50%",
            transform: "translateY(-50%)",
            insetInlineStart: 8,
          }}
        >
          <Close />
        </IconButton>
        معلومات الصنف
      </DialogTitle>
      <DialogContent
        dividers
        sx={{
          px: { xs: 1.5, sm: 2.25 },
          py: { xs: 1.5, sm: 2 },
          bgcolor: alpha(theme.palette.background.default, 0.5),
        }}
      >
        <Stack spacing={1.75}>
          <Box
            sx={{
              position: "relative",
              borderRadius: 3,
              overflow: "hidden",
              minHeight: { xs: 160, sm: 200 },
              bgcolor: alpha(theme.palette.primary.main, 0.12),
              backgroundImage: img ? `url(${img})` : "none",
              backgroundSize: "cover",
              backgroundPosition: "center",
              border: `1px solid ${alpha(theme.palette.divider, 0.8)}`,
            }}
          >
            {!img ? (
              <Stack
                alignItems="center"
                justifyContent="center"
                sx={{ minHeight: { xs: 160, sm: 200 }, color: "primary.main", gap: 0.5 }}
              >
                <LocalPharmacy sx={{ fontSize: 48, opacity: 0.85 }} />
                <Typography variant="caption" fontWeight={700} color="text.secondary">
                  لا توجد صورة
                </Typography>
              </Stack>
            ) : null}
          </Box>

          <Stack spacing={0.5} sx={{ px: 0.25 }}>
            <Typography variant="h6" fontWeight={900} sx={{ fontSize: { xs: "1.05rem", sm: "1.2rem" }, lineHeight: 1.35 }}>
              {title}
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={0.75} justifyContent="flex-start" sx={{ flexDirection: "row-reverse" }}>
              {product.category ? (
                <Box
                  component="span"
                  sx={{
                    px: 1,
                    py: 0.35,
                    borderRadius: 99,
                    bgcolor: alpha(theme.palette.secondary.main, 0.15),
                    color: "secondary.dark",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                  }}
                >
                  {product.category}
                </Box>
              ) : null}
              {saleTypeLabel ? (
                <Box
                  component="span"
                  sx={{
                    px: 1,
                    py: 0.35,
                    borderRadius: 99,
                    bgcolor: alpha(theme.palette.info.main, 0.12),
                    color: "info.dark",
                    fontSize: "0.75rem",
                    fontWeight: 800,
                  }}
                >
                  {saleTypeLabel}
                </Box>
              ) : null}
              <Box
                component="span"
                sx={{
                  px: 1,
                  py: 0.35,
                  borderRadius: 99,
                  bgcolor: alpha(theme.palette.success.main, 0.14),
                  color: "success.dark",
                  fontSize: "0.75rem",
                  fontWeight: 900,
                }}
              >
                {Number(product.price || 0).toFixed(1)} شيكل
              </Box>
            </Stack>
          </Stack>

          <Section
            icon={<Medication sx={{ fontSize: 20 }} />}
            title="كيفية الاستعمال"
            emptyHint="لم تُسجَّل تعليمات بعد — يمكن إضافتها من «المخزون» عند تعديل الصنف."
          >
            {how || (showLegacy ? legacyDesc : "")}
          </Section>

          <Section
            icon={<Schedule sx={{ fontSize: 20 }} />}
            title="عدد المرات والتوقيت"
            emptyHint="مثال: ثلاث مرات يومياً بعد الأكل — يُضاف من شاشة المخزون."
          >
            {freq}
          </Section>

          <Section
            icon={<TipsAndUpdates sx={{ fontSize: 20 }} />}
            title="نصائح وملاحظات"
            emptyHint="تحذيرات، تداخلات، أو نصائح تخزين — اختياري من المخزون."
          >
            {tips}
          </Section>
        </Stack>
      </DialogContent>
      <DialogActions
        sx={{
          px: { xs: 1.5, sm: 2 },
          py: { xs: 1.5, sm: 2 },
          gap: 1,
          flexWrap: "wrap",
          justifyContent: "stretch",
          borderTop: `1px solid ${theme.palette.divider}`,
          bgcolor: alpha(theme.palette.background.paper, 1),
        }}
      >
        <Button fullWidth={fullScreen} onClick={onClose} sx={{ textTransform: "none", fontWeight: 700, flex: fullScreen ? 1 : "0 1 auto" }}>
          إغلاق
        </Button>
        <Button
          fullWidth={fullScreen}
          variant="contained"
          onClick={onAddToCart}
          sx={{ textTransform: "none", fontWeight: 900, flex: fullScreen ? 2 : "1 1 auto", minWidth: { sm: 200 } }}
        >
          إضافة للسلة
        </Button>
      </DialogActions>
    </Dialog>
  );
}
