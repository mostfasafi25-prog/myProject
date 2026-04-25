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
  CircularProgress,
  Alert,
} from "@mui/material";
import { useMemo, useState, useEffect } from "react";
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
import { Axios } from "../../Api/Axios";

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

// تحويل بيانات API إلى نفس شكل localStorage
function mapApiProductToLocal(row) {
  return {
    id: row.id,
    name: row.name,
    qty: Number(row.stock || 0),
    active: row.is_active !== false,
    category: row.category?.name || row.categories?.[0]?.name || "",
    categoryId: row.category_id || row.categories?.[0]?.id || null,
  };
}

export default function StocktakePage({ mode, onToggleMode, embedded = false, onApplied }) {
  const [tick, setTick] = useState(0);
  const [title, setTitle] = useState("جرد يومي");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");

  // جلب المنتجات من API
  const fetchProducts = async () => {
    setLoading(true);
    setFetchError("");
    try {
      const { data } = await Axios.get("products", {
        params: { per_page: 100, include_inactive: 1, scope: "all" }
      });
      if (data?.success) {
        const apiRows = Array.isArray(data.data) ? data.data : [];
        const mapped = apiRows.map(mapApiProductToLocal);
        setProducts(mapped);
        // تحديث localStorage للمزامنة
        persistProducts(mapped);
      } else {
        setFetchError("فشل في جلب البيانات من الخادم");
        // fallback إلى localStorage
        const local = readProducts();
        setProducts(local);
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      setFetchError("خطأ في الاتصال بالخادم، يتم عرض البيانات المحلية");
      // fallback إلى localStorage
      const local = readProducts();
      setProducts(local);
    } finally {
      setLoading(false);
    }
  };

  // تحميل البيانات عند فتح الصفحة
  useEffect(() => {
    fetchProducts();
  }, []);

  const session = useMemo(() => readStocktakeSession(), [tick]);

  const start = () => {
    const activeProducts = products.filter((p) => p.active !== false);
    if (!activeProducts.length) {
      showAppToast("لا أصناف في المخزون", "warning");
      return;
    }
    startNewStocktakeSession(title, activeProducts);
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

  // تحديث كمية منتج واحد في API
  const updateProductStockInApi = async (productId, newQty) => {
    try {
      await Axios.put(`products/${productId}`, { stock: newQty });
      return true;
    } catch (error) {
      console.error(`Error updating product ${productId}:`, error);
      return false;
    }
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

    // حساب التغييرات
    const diffs = [];
    const updates = [];

    for (const ln of s.lines) {
      const counted = Number(String(ln.countedQty).replace(/[^\d.-]/g, ""));
      if (!Number.isFinite(counted) || counted < 0) continue;
      const sys = Number(ln.systemQty || 0);
      if (Math.abs(sys - counted) > 0.0001) {
        diffs.push({ 
          id: ln.productId, 
          name: ln.name, 
          before: sys, 
          after: counted 
        });
        updates.push({ id: ln.productId, qty: counted });
      }
    }

    if (updates.length === 0) {
      showAppToast("لا توجد تغييرات في الكميات", "info");
      return;
    }

    // تحديث المنتجات في API
    let successCount = 0;
    let failCount = 0;

    for (const update of updates) {
      const success = await updateProductStockInApi(update.id, update.qty);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    // تحديث localStorage
    const currentProducts = [...products];
    for (const diff of diffs) {
      const productIndex = currentProducts.findIndex(p => String(p.id) === String(diff.id));
      if (productIndex !== -1) {
        currentProducts[productIndex].qty = diff.after;
      }
    }
    setProducts(currentProducts);
    persistProducts(currentProducts);

    const u = getStoredUser();
    appendAudit({
      action: "stocktake_apply",
      details: JSON.stringify({ 
        sessionId: s.id, 
        title: s.title, 
        changes: diffs.length, 
        diffs,
        apiSuccess: successCount,
        apiFailed: failCount
      }),
      username: u?.username || "",
      role: u?.role || "",
    });

    clearStocktakeSession();
    setTick((t) => t + 1);

    if (failCount === 0) {
      showAppToast(`تم تطبيق الجرد — ${diffs.length} صنف تغيّر`, "success");
    } else {
      showAppToast(`تم تطبيق الجرد — ${successCount} صنف نجح، ${failCount} فشل`, "warning");
    }
    onApplied?.();
  };

  const cancelSession = () => {
    clearStocktakeSession();
    setTick((t) => t + 1);
    showAppToast("أُلغيت جلسة الجرد", "info");
  };

  const inner = (
      <Box sx={embedded ? { width: "100%", minWidth: 0 } : adminPageContainerSx}>
        {!embedded ? (
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
        ) : null}

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
              disabled={loading || products.length === 0}
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

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>جاري تحميل الأصناف...</Typography>
          </Box>
        ) : fetchError ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {fetchError}
          </Alert>
        ) : null}

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
                            value={ln.countedQty || ""}
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
        ) : !loading && !fetchError ? (
          <Typography color="text.secondary" sx={{ textAlign: "center", py: 4 }}>
            ابدأ جولة جرد جديدة لعرض الأصناف.
          </Typography>
        ) : null}
      </Box>
  );

  if (embedded) {
    return inner;
  }
  return (
    <AdminLayout mode={mode} onToggleMode={onToggleMode}>
      {inner}
    </AdminLayout>
  );
}