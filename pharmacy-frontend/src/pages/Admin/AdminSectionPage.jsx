import { ArrowForward, AutoAwesome } from "@mui/icons-material";
import {
  alpha,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import { adminPageContainerSx } from "../../utils/adminPageLayout";
import AdminLayout from "./AdminLayout";

export default function AdminSectionPage({
  mode,
  onToggleMode,
  title,
  subtitle,
  image,
  icon,
  metrics = [],
  highlights = [],
  extraContent = null,
}) {
  const theme = useTheme();

  return (
    <AdminLayout mode={mode} onToggleMode={onToggleMode}>
      <Box sx={adminPageContainerSx}>
      <Card
        sx={{
          borderRadius: { xs: 3, md: 4 },
          mb: { xs: 1.5, md: 2 },
          border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            position: "relative",
            minHeight: { xs: 160, sm: 200, md: 220 },
            backgroundImage: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.65)}, ${alpha(theme.palette.secondary.main, 0.4)}), url(${image})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            display: "flex",
            alignItems: "end",
            p: { xs: 2, sm: 2.5, md: 3 },
          }}
        >
          <Stack direction="row" alignItems="center" sx={{ gap: { xs: 1, sm: 1.5 } }}>
            <Avatar
              sx={{
                bgcolor: alpha("#fff", 0.22),
                color: "#fff",
                width: { xs: 44, sm: 52 },
                height: { xs: 44, sm: 52 },
              }}
            >
              {icon}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h5" fontWeight={800} color="#fff" sx={{ fontSize: { xs: "1.15rem", sm: "1.5rem" } }}>
                {title}
              </Typography>
              <Typography color={alpha("#fff", 0.9)} variant="body2" sx={{ mt: 0.25, display: { xs: "none", sm: "block" } }}>
                {subtitle}
              </Typography>
            </Box>
          </Stack>
        </Box>
      </Card>

      <Grid container spacing={{ xs: 1.5, sm: 2 }} alignItems="stretch">
        {metrics.map((m) => (
          <Grid key={m.label} size={{ xs: 12, sm: 6, lg: 3 }}>
            <Card sx={{ height: "100%", borderRadius: 3 }}>
              <CardContent>
                <Typography variant="body2" color="text.secondary">
                  {m.label}
                </Typography>
                <Typography variant="h6" fontWeight={800} mt={0.5}>
                  {m.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={{ xs: 1.5, sm: 2 }} mt={{ xs: 0.25, sm: 0.5 }}>
        {highlights.map((item) => (
          <Grid key={item.title} size={{ xs: 12, md: 6 }}>
            <Card sx={{ borderRadius: 3, height: "100%" }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography fontWeight={800}>{item.title}</Typography>
                  <AutoAwesome color="primary" fontSize="small" />
                </Stack>
                <Typography color="text.secondary" variant="body2">
                  {item.description}
                </Typography>
                <Button endIcon={<ArrowForward />} sx={{ mt: 1.5, textTransform: "none" }}>
                  فتح القسم
                </Button>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
      {extraContent}
      </Box>
    </AdminLayout>
  );
}
