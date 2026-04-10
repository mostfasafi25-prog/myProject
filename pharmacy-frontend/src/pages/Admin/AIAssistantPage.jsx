import { AutoAwesome, Psychology } from "@mui/icons-material";
import {
  Alert,
  alpha,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  Stack,
  Typography,
  useTheme,
} from "@mui/material";
import { useEffect, useState } from "react";
import axios from "axios";
import Cookies from "universal-cookie";
import { baseURL } from "../../Api/Api";
import { adminPageContainerSx } from "../../utils/adminPageLayout";
import AdminLayout from "./AdminLayout";

const CHATBASE_BOT_ID = "fELicw62nCAmG-UO2a7Ub";

export default function AIAssistantPage({ mode, onToggleMode }) {
  const theme = useTheme();
  const [identityError, setIdentityError] = useState("");
  const [chatReady, setChatReady] = useState(false);

  useEffect(() => {
    const cookies = new Cookies();

    const identifyUser = async () => {
      try {
        const token = cookies.get("token");
        if (!token) return;

        const { data } = await axios.get(`${baseURL}chatbase/identity-token`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!data?.token) return;

        window.chatbase("identify", { token: data.token });
        setIdentityError("");
        setChatReady(true);
      } catch {
        setIdentityError("تعذر توثيق المستخدم مع Chatbase. تأكد من إعداد CHATBOT_IDENTITY_SECRET في الباك إند.");
      }
    };

    const initChatbase = () => {
      if (!window.chatbase || window.chatbase("getState") !== "initialized") {
        window.chatbase = (...args) => {
          if (!window.chatbase.q) window.chatbase.q = [];
          window.chatbase.q.push(args);
        };
        window.chatbase = new Proxy(window.chatbase, {
          get(target, prop) {
            if (prop === "q") return target.q;
            return (...args) => target(prop, ...args);
          },
        });
      }

      if (document.getElementById(CHATBASE_BOT_ID)) {
        identifyUser();
        return;
      }
      const script = document.createElement("script");
      script.src = "https://www.chatbase.co/embed.min.js";
      script.id = CHATBASE_BOT_ID;
      script.domain = "www.chatbase.co";
      script.onload = async () => {
        await identifyUser();
        setChatReady(true);
      };
      document.body.appendChild(script);

      // If script already initialized very fast, identify immediately too.
      setTimeout(() => identifyUser(), 500);
    };

    if (document.readyState === "complete") {
      initChatbase();
    } else {
      window.addEventListener("load", initChatbase);
    }

    return () => window.removeEventListener("load", initChatbase);
  }, []);

  return (
    <AdminLayout mode={mode} onToggleMode={onToggleMode}>
      <Box sx={adminPageContainerSx}>
        <Card
          sx={{
            p: 2,
            borderRadius: 3,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.14)}, ${alpha(theme.palette.secondary.main, 0.1)})`,
          }}
        >
          <Stack
            direction={{ xs: "column", sm: "row" }}
            alignItems={{ xs: "stretch", sm: "center" }}
            justifyContent="space-between"
            sx={{ gap: 1.5 }}
          >
            <Stack direction="row" alignItems="center" sx={{ gap: 1, minWidth: 0 }}>
              <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.18), color: "primary.main", flexShrink: 0 }}>
                <Psychology />
              </Avatar>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h6" fontWeight={900}>
                  الذكاء الصناعي
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
                  تم ربط الصفحة مع Chatbase مباشرة
                </Typography>
              </Box>
            </Stack>
            <Chip
              icon={<AutoAwesome />}
              label="Chatbase Live"
              color="primary"
              variant="outlined"
              sx={{ display: { xs: "none", sm: "flex" }, alignSelf: { sm: "center" } }}
            />
          </Stack>
        </Card>

        <Card
          sx={{
            mt: 1.5,
            p: 2.2,
            borderRadius: 3,
            minHeight: 220,
            border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
            background: `linear-gradient(135deg, ${alpha(theme.palette.primary.main, 0.1)}, ${alpha(
              theme.palette.secondary.main,
              0.08,
            )})`,
          }}
        >
          {identityError ? (
            <Alert severity="warning" sx={{ mb: 1.2 }}>
              {identityError}
            </Alert>
          ) : null}
          <Stack direction={{ xs: "column", md: "row" }} alignItems="center" justifyContent="space-between" sx={{ gap: 2 }}>
            <Box>
              <Typography variant="h6" fontWeight={900} sx={{ mb: 0.5 }}>
                نقدّم لك حلول واستشارات مجانية
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 560 }}>
                اسأل عن المبيعات، إدارة المخزون، التسعير، وتحسين أداء الكاشير، وخذ اقتراحات ذكية مباشرة من المساعد.
              </Typography>
              <Stack direction="row" sx={{ gap: 1, mt: 1.4, flexWrap: "wrap" }}>
                <Chip label="استشارات مجانية" color="success" />
                <Chip label="حلول فورية" color="primary" variant="outlined" />
                <Chip label="دعم تشغيلي يومي" color="secondary" variant="outlined" />
              </Stack>
            </Box>
            <Button
              variant="contained"
              onClick={() => window.chatbase?.("open")}
              disabled={!chatReady}
              sx={{ textTransform: "none", fontWeight: 900, px: 3, py: 1.1, borderRadius: 2 }}
            >
              {chatReady ? "ابدأ المحادثة الآن" : "جار تجهيز الشات..."}
            </Button>
          </Stack>
        </Card>
      </Box>
    </AdminLayout>
  );
}
