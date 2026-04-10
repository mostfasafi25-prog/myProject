import { FactCheck, PlayArrow, Save } from "@mui/icons-material";
import {
  Box,
  Button,
  Card,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useMemo, useState } from "react";
import FilterBarRow from "../../components/FilterBarRow";
import { adminPageContainerSx, adminPageSubtitleSx } from "../../utils/adminPageLayout";
import AdminLayout from "./AdminLayout";
import { appendAudit } from "../../utils/auditLog";
import { confirmApp, showAppToast } from "../../utils/appToast";
import { productDisplayName } from "../../utils/productDisplayName";
import { getStoredUser } from "../../utils/userRoles";
import {
  clearStocktakeSession,
  readStocktakeSession,
  startNewStocktakeSession,
  writeStocktakeSession,
} from "../../utils/stocktakeStorage";

const PRODUCTS_KEY = "adminProducts";

function readProducts() {
  try {
    const raw = JSON.parse(localStorage.getItem(PRODUCTS_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function persistProducts(next) {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(next));
}

export default function StocktakePage({ mode, onToggleMode }) {
  const [tick, setTick] = useState(0);
  const [title, setTitle] = useState("جرد يومي");

  const session = useMemo(() => readStocktakeSession(), [tick]);

  const start = () => {
    const products = readProducts().filter((p) => p.active !== false);
    if (!products.length) {
      showAppToast("لا أصناف في المخزون", "warning");
      return;
    }
    startNewStocktakeSession(title, products);
    setTick((t) => t + 1);
    showAppToast("تم بدء جولة الجرد", "success");
  };

  const updateLine = (productId, countedQty) => {
    const s = readStocktakeSession();
    if (!s) return;
    const lines = s.lines.map((ln) =>
      String(ln.productId) === String(productId) ? { ...ln, countedQty } : ln,
    );
    writeStocktakeSession({ ...s, lines });
    setTick((t) => t + 1);
  };

  const apply = async () => {
    const s = readStocktakeSession();
    if (!s?.lines?.length) {
      showAppToast("لا توجد جلسة جرد", "warning");
      return;
    }
    const ok = await confirmApp({
      title: "تطبيق الجرد على المخزون",
      text: "سيتم تحديث كميات الأصناف لتطابق العدد المُدخل. لا يمكن التراجع تلقائياً.",
      icon: "warning",
      confirmText: "نعم، طبّق",
    });
    if (!ok) return;

    const products = readProducts();
    const map = new Map(products.map((p) => [String(p.id), { ...p }]));
    const diffs = [];
    for (const ln of s.lines) {
      const counted = Number(String(ln.countedQty).replace(/[^\d.-]/g, ""));
      if (!Number.isFinite(counted) || counted < 0) continue;
      const row = map.get(String(ln.productId));
      if (!row) continue;
      const sys = Number(row.qty || 0);
      if (Math.abs(sys - counted) > 0.0001) {
        diffs.push({ id: row.id, name: productDisplayName(row), before: sys, after: counted });
      }
      row.qty = counted;
    }
    persistProducts(Array.from(map.values()));
    const u = getStoredUser();
    appendAudit({
      action: "stocktake_apply",
      details: JSON.stringify({ sessionId: s.id, title: s.title, changes: diffs.length, diffs }),
      username: u?.username || "",
      role: u?.role || "",
    });
    clearStocktakeSession();
    setTick((t) => t + 1);
    showAppToast(`تم تطبيق الجرد — ${diffs.length} صنف تغيّر`, "success");
  };

  const cancelSession = () => {
    clearStocktakeSession();
    setTick((t) => t + 1);
    showAppToast("أُلغيت جلسة الجرد", "info");
  };

  return (
    <AdminLayout mode={mode} onToggleMode={onToggleMode}>
      <Box sx={adminPageContainerSx}>
        <Stack direction="row" alignItems="center" sx={{ gap: 1, mb: 2, flexWrap: "wrap" }}>
          <FactCheck color="primary" sx={{ flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="h5" fontWeight={900}>
              جرد المخزون
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={adminPageSubtitleSx}>
              أدخل الكمية الفعلية لكل صنف ثم طبّق التحديث على النظام (للمدير)
            </Typography>
          </Box>
        </Stack>

        <Card sx={{ p: 2, mb: 2, borderRadius: 3 }}>
          <FilterBarRow sx={{ gap: 1.5 }}>
            <TextField
              size="small"
              label="اسم الجولة"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              sx={{ minWidth: 180, flex: "1 1 160px" }}
              inputProps={{ style: { textAlign: "right" } }}
            />
            <Button
              variant="contained"
              startIcon={<PlayArrow />}
              onClick={start}
              sx={{ textTransform: "none", fontWeight: 800, flex: "0 0 auto", whiteSpace: "nowrap" }}
            >
              بدء جرد جديد
            </Button>
            {session ? (
              <>
                <Button
                  variant="outlined"
                  color="error"
                  onClick={cancelSession}
                  sx={{ textTransform: "none", flex: "0 0 auto", whiteSpace: "nowrap" }}
                >
                  إلغاء الجلسة
                </Button>
                <Button
                  variant="contained"
                  color="secondary"
                  startIcon={<Save />}
                  onClick={apply}
                  sx={{ textTransform: "none", fontWeight: 800, flex: "0 0 auto", whiteSpace: "nowrap" }}
                >
                  تطبيق على المخزون
                </Button>
              </>
            ) : null}
          </FilterBarRow>
        </Card>

        {session ? (
          <Card sx={{ borderRadius: 3 }}>
            <Box sx={{ p: 1.5, borderBottom: 1, borderColor: "divider" }}>
              <Typography fontWeight={800}>
                {session.title} — {new Date(session.startedAt).toLocaleString("ar")}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
                الفرق = الفعلي − النظام
              </Typography>
            </Box>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>
                      الصنف
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>
                      النظام
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>
                      الفعلي
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>
                      الفرق
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {session.lines.map((ln) => {
                    const sys = Number(ln.systemQty || 0);
                    const cnt = Number(String(ln.countedQty).replace(/[^\d.-]/g, ""));
                    const c = Number.isFinite(cnt) ? cnt : sys;
                    const diff = c - sys;
                    return (
                      <TableRow key={ln.productId}>
                        <TableCell align="center" sx={{ fontWeight: 600 }}>
                          {ln.name}
                        </TableCell>
                        <TableCell align="center">{sys.toFixed(1)}</TableCell>
                        <TableCell align="center" sx={{ width: 140 }}>
                          <TextField
                            size="small"
                            value={ln.countedQty}
                            onChange={(e) => updateLine(ln.productId, e.target.value)}
                            inputProps={{ style: { textAlign: "center" } }}
                          />
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 800, color: diff === 0 ? "text.secondary" : "warning.main" }}>
                          {diff >= 0 ? "+" : ""}
                          {diff.toFixed(1)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Card>
        ) : (
          <Typography color="text.secondary">ابدأ جولة جرد جديدة لعرض الأصناف.</Typography>
        )}
      </Box>
    </AdminLayout>
  );
}
