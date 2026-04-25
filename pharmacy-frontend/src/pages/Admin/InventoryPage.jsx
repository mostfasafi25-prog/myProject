import {
  Add,
  Close,
  DeleteOutline,
  FactCheck,
  Inventory2,
  LocalShipping,
  WarningAmber,
  Search,
  RestartAlt,
  Edit,
  Storefront,
  ReceiptLong,
  Payments,
  Person,
  Print,
  CheckCircle,
  PlayArrow,
  Save,
  Category,
  TrendingUp,
} from "@mui/icons-material";
import {
  Alert,
  alpha,
  Avatar,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Pagination,
  Paper,
  Select,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useTheme,
  CircularProgress,
} from "@mui/material";
import { keyframes } from "@mui/system";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Axios } from "../../Api/Axios";
import { baseURL } from "../../Api/Api";
import { uploadProductImage, validateImageFile } from "../../Api/ImageUploadApi";
import { adminPageContainerSx, adminPageSubtitleSx, adminPageTitleRowSx } from "../../utils/adminPageLayout";
import { negativeAmountTextSx } from "../../utils/negativeAmountStyle";
import AdminLayout from "./AdminLayout";
import { showAppToast } from "../../utils/appToast";
import { productDisplayName } from "../../utils/productDisplayName";
import { appendAudit } from "../../utils/auditLog";
import { normalizeSaleOptions, productHasSaleOptions } from "../../utils/productSaleOptions";
import { productImageForLocalStorage } from "../../utils/imageCompress";
import { isAdmin, isSuperAdmin, isSuperCashier, purchaserDisplayName } from "../../utils/userRoles";
import { parseNonNegativeNumber, unitInventoryCost, weightedAverageUnitCost } from "../../utils/inventoryCost";
import { getProductImageFallback } from "../../utils/productImageFallback";
import { getCashierSystemSettings } from "../../utils/cashierSystemSettings";
import { readStoreBalance, syncStoreBalanceFromTreasuryApi } from "../../utils/storeBalanceSync";
import {
  clearStocktakeSession,
  readStocktakeSession,
  startNewStocktakeSession,
  writeStocktakeSession,
} from "../../utils/stocktakeStorage";
import { confirmApp } from "../../utils/appToast";
import { getStoredUser } from "../../utils/userRoles";
const inventoryDialogPaperSx = { borderRadius: 3, overflow: "hidden" };
const inventoryDialogTitleSx = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 48,
  px: { xs: 1, sm: 2 },
  pt: { xs: 2, md: 2.5 },
  pb: 1.25,
  borderBottom: "1px solid",
  borderColor: "divider",
};
const inventoryDialogCloseBtnSx = {
  position: "absolute",
  insetInlineStart: 8,
  top: "50%",
  transform: "translateY(-50%)",
};
const addDialogSectionTitleSx = {
  fontWeight: 900,
  color: "primary.main",
  letterSpacing: 0.2,
};
const addDialogSectionDividerSx = {
  mt: 0.6,
  mb: 0.4,
  borderColor: alpha("#1976d2", 0.35),
};
const float = keyframes`
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-6px); }
`;

const ROWS_PER_PAGE = 5;
const CATEGORY_ROWS_PER_PAGE = 5;
const API_ORIGIN = String(baseURL || "").replace(/\/api\/?$/i, "");

const formatCurrency = (n) => {
  const x = Number(n);
  if (Number.isNaN(x)) return "0.00";
  return x.toFixed(2);
};

const formatOneDecimal = (n) => {
  const x = Number(n);
  if (Number.isNaN(x)) return "0.0";
  return x.toFixed(1);
};

const normalizeImageUrl = (raw) => {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/^(data:|blob:)/i.test(s)) return s;
  if (/^https?:/i.test(s)) {
    try {
      const u = new URL(s);
      const api = new URL(API_ORIGIN);
      const isLocalHost = ["localhost", "127.0.0.1"].includes(String(u.hostname || "").toLowerCase());
      const apiIsLocalHost = ["localhost", "127.0.0.1"].includes(String(api.hostname || "").toLowerCase());
      // لو السيرفر رجّع localhost/127 لكن التطبيق يعمل على Origin آخر، نستخدم نفس Origin الخاص بالـ API الحقيقي
      if (isLocalHost && !apiIsLocalHost) {
        return `${API_ORIGIN}${u.pathname}${u.search || ""}${u.hash || ""}`;
      }
    } catch {
      return s;
    }
    return s;
  }
  if (s.startsWith("/")) return `${API_ORIGIN}${s}`;
  return `${API_ORIGIN}/${s}`;
};

function legacyPiecesCountFromRow(row) {
  const stored = row?.pieces_count;
  if (stored != null && Number(stored) > 0) return Number(stored);
  const s = Number(row?.strips_per_box ?? 0);
  const p = Number(row?.pieces_per_strip ?? row?.strip_unit_count ?? 0);
  if (s > 0 && p > 0) return s * p;
  if (p > 0) return p;
  return 0;
}

function buildPackagingRequestBody({
  allowSplitSales,
  fullUnitName,
  divideInto,
  allowSmallPieces,
  piecesCount,
}) {
  const div = Math.max(0, parseInt(String(divideInto ?? "").replace(/[^\d]/g, ""), 10) || 0);
  const pc = Math.max(0, parseInt(String(piecesCount ?? "").replace(/[^\d]/g, ""), 10) || 0);
  return {
    allow_split_sales: !!allowSplitSales,
    full_unit_name: String(fullUnitName || "").trim() || null,
    divide_into: allowSplitSales ? div : null,
    allow_small_pieces: !!(allowSplitSales && allowSmallPieces),
    pieces_count: allowSplitSales && allowSmallPieces && pc > 0 ? pc : null,
    unit: "box",
    purchase_unit: "box",
    sale_unit: "box",
  };
}

const buildCustomSplitOptions = ({
  allowSplitSales,
  fullUnitName,
  divideInto,
  allowSmallPieces,
  piecesCount,
  price,  // سعر الوحدة الكاملة
  splitLevel1Name,
  splitLevel2Name,
  customChildPrice,  // ⭐ أضف هذا - سعر مخصص للقطعة الصغيرة
  
}) => {
  if (!allowSplitSales) return null;
  const basePrice = inventoryNumOrNull(price);
  if (basePrice == null || basePrice <= 0) return null;
  const div = Math.max(0, parseInt(String(divideInto ?? "").replace(/[^\d]/g, ""), 10) || 0);
  if (div < 1) return null;
  
  const lvl1Price = Number((basePrice / div).toFixed(2));
  const lvl1Name = String(splitLevel1Name || "").trim() || "جزء";
  const fullName = String(fullUnitName || "").trim() || "وحدة كاملة";
  
  const options = [
    { id: "full", label: fullName, price: Number(basePrice.toFixed(2)), saleType: "box" },
    { id: "level1", label: lvl1Name, price: lvl1Price, saleType: "strip" },
  ];
  
  if (allowSmallPieces) {
    const pc = Math.max(0, parseInt(String(piecesCount ?? "").replace(/[^\d]/g, ""), 10) || 0);
    if (pc > 0) {
      const perPart = Math.max(1, Math.round(pc / div));
      // ⭐⭐ إذا كان هناك سعر مخصص للقطعة الصغيرة استخدمه، وإلا احسبه تلقائياً
      let childPrice;
      const customChildNum = inventoryNumOrNull(customChildPrice);
      if (customChildNum != null && customChildNum > 0) {
        childPrice = Number(customChildNum.toFixed(2));
      } else {
        childPrice = Number((lvl1Price / perPart).toFixed(2));
      }
      
      const lvl2Name = String(splitLevel2Name || "").trim() || "حبة";
      options.push({
        id: "level2",
        label: lvl2Name,
        price: childPrice,
        saleType: "pill",
      });
    }
  }
  return options;
};

function mapBackendUnitToInventorySaleType(unit) {
  const u = String(unit || "").toLowerCase();
  if (u === "box" || u === "pack") return "box";
  return "box";
}

function resolvePurchaseCategoryId(item, categoriesList) {
  if (item?.categoryId != null && Number(item.categoryId) > 0) return Number(item.categoryId);
  const name = String(item?.category || "").trim();
  const row = categoriesList.find((c) => String(c.name || "").trim() === name);
  if (row?.id != null) return Number(row.id);
  const first = categoriesList[0];
  return first?.id != null ? Number(first.id) : "";
}

function inventoryNumOrNull(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function toCleanMoneyString(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "";
  return String(Number(n.toFixed(2)));
}

function applyInventoryFormChange(prev, key, rawValue) {
  const next = { ...prev, [key]: rawValue };
  const cost = inventoryNumOrNull(next.costPrice);
  const profit = inventoryNumOrNull(next.profitAmount);
  const price = inventoryNumOrNull(next.price);
  const divide = Math.max(0, parseInt(String(next.divideInto ?? "").replace(/[^\d]/g, ""), 10) || 0);

  if (key === "costPrice" || key === "profitAmount") {
    if (cost != null && profit != null) next.price = toCleanMoneyString(cost + profit);
  }
  if (key === "price" && cost != null && price != null) {
    next.profitAmount = toCleanMoneyString(price - cost);
  }
  if (next.allowSplitSales && divide > 0 && price != null) {
    next.splitSalePrice = toCleanMoneyString(price / divide);
  } else if (!next.allowSplitSales && key === "allowSplitSales") {
    next.splitSalePrice = "";
    next.allowSmallPieces = false;
    next.piecesCount = "";
    next.customChildPrice = "";
  }

  if (
    next.allowSplitSales &&
    next.allowSmallPieces &&
    (key === "splitSalePrice" || key === "piecesCount" || key === "divideInto" || key === "allowSmallPieces")
  ) {
    const split = inventoryNumOrNull(next.splitSalePrice);
    const pc = Math.max(0, parseInt(String(next.piecesCount ?? "").replace(/[^\d]/g, ""), 10) || 0);
    if (split != null && divide > 0 && pc > 0) {
      const perPart = Math.max(1, Math.round(pc / divide));
      if (!String(next.customChildPrice || "").trim()) {
        next.customChildPrice = toCleanMoneyString(split / perPart);
      }
    }
  }
  return next;
}

function resolveInventorySalePrice(row) {
  if (!row) return null;
  const v = row.price ?? row.sale_price;
  if (v === undefined || v === null || v === "") return null;
  return inventoryNumOrNull(v);
}

function resolveInventoryUnitCost(row) {
  const c = inventoryNumOrNull(row?.cost_price ?? row?.costPrice);
  const p = inventoryNumOrNull(row?.purchase_price ?? row?.purchasePrice);
  const avg = inventoryNumOrNull(row?.purchase_stats?.average_purchase_price);
  if (c != null && c > 0) return c;
  if (p != null && p > 0) return p;
  if (avg != null && avg > 0) return avg;
  if (c != null) return c;
  if (p != null) return p;
  if (avg != null) return avg;
  return 0;
}

/** ربح وحدة البيع من البيانات أو من السعر − التكلفة */
function resolveRowProfit(row, salePrice, unitCost) {
  const stored = inventoryNumOrNull(row?.profit_amount ?? row?.profitAmount);
  if (stored != null && Number.isFinite(stored)) return stored;
  if (salePrice != null && Number.isFinite(Number(salePrice)) && Number.isFinite(Number(unitCost))) {
    return Number(salePrice) - Number(unitCost);
  }
  return null;
}

function mapApiProductToInventoryRow(row) {
  const categoryName = String(row?.categories?.[0]?.name || row?.category?.name || "أصناف متنوعة");
  const categoryIdRaw = row?.category_id ?? row?.category?.id ?? row?.categories?.[0]?.id ?? null;
  const categoryId = categoryIdRaw != null ? Number(categoryIdRaw) : null;
  const stock = Number(row?.stock || 0);
  const saleNum = resolveInventorySalePrice(row);
  const cost = resolveInventoryUnitCost(row);
  const saleType = mapBackendUnitToInventorySaleType(row?.sale_unit || row?.saleUnit || row?.unit);
  const piecesTotal = legacyPiecesCountFromRow(row);
  const divideRaw = row?.divide_into ?? row?.strips_per_box;
  const divideNum = divideRaw != null && divideRaw !== "" ? Number(divideRaw) : 0;
  const profitVal = resolveRowProfit(row, saleNum, cost);
  const splitOptionObjects = Array.isArray(row?.split_sale_options)
    ? row.split_sale_options.filter((x) => x && typeof x === "object")
    : [];
  const level1Opt = splitOptionObjects.find((x) => String(x?.id || "") === "level1");
  const level2Opt = splitOptionObjects.find((x) => String(x?.id || "") === "level2");
  return {
    id: Number(row?.id || Date.now()),
    name: String(row?.name || "صنف"),
    code: String(row?.code ?? "").trim(),
    sku: String(row?.sku ?? "").trim(),
    barcode: String(row?.barcode ?? "").trim(),
    description: String(row?.description ?? "").trim(),
    category: categoryName,
    categoryId: Number.isFinite(categoryId) ? categoryId : null,
    saleType,
    allowSplitSales: !!row?.allow_split_sales,
    fullUnitName: String(row?.full_unit_name ?? ""),
    divideInto: divideNum > 0 ? String(divideNum) : "",
    allowSmallPieces: Boolean(row?.allow_small_pieces),
    piecesCount: piecesTotal > 0 ? String(Math.round(piecesTotal)) : "",
    splitLevel1Name: String(level1Opt?.label || "").trim(),
    splitLevel2Name: String(level2Opt?.label || "").trim(),
    customChildPrice: String(row?.custom_child_price ?? level2Opt?.price ?? ""),

    splitSalePrice: row?.split_sale_price != null ? Number(row.split_sale_price) : null,
    purchasePriceRaw: inventoryNumOrNull(row?.purchase_price),
    qty: Number(stock.toFixed ? stock.toFixed(1) : stock),
    min: Number(row?.reorder_point || row?.min_stock || 0),
    costPrice: Number(Number(cost || 0).toFixed(4)),
    cost_price: Number(Number(cost || 0).toFixed(4)),
    price: saleNum != null ? Number(Number(saleNum).toFixed(2)) : null,
    profitAmount: profitVal != null && Number.isFinite(profitVal) ? Number(Number(profitVal).toFixed(2)) : null,
    variantLabel: String(row?.variant_label ?? row?.variantLabel ?? ""),
    usageHowTo: String(row?.usage_how_to ?? row?.usageHowTo ?? "").trim(),
    usageFrequency: String(row?.usage_frequency ?? row?.usageFrequency ?? "").trim(),
    usageTips: String(row?.usage_tips ?? row?.usageTips ?? "").trim(),
    expiryDate: String(row?.expiry_date ?? row?.expiryDate ?? "").slice(0, 10),
    saleOptions: row?.sale_options ?? row?.saleOptions,
    active: row?.is_active !== false,
    image: productImageForLocalStorage(
      normalizeImageUrl(String(row?.image_url || getProductImageFallback(row?.name, categoryName))),
    ),
    createdAt: row?.created_at || new Date().toISOString(),
  };
}

function sanitizeMappedProducts(rows) {
  return rows.map((row) => {
    const mapped = mapApiProductToInventoryRow(row);
    return {
      ...mapped,
      image: productImageForLocalStorage(mapped?.image),
    };
  });
}

/** حقول إضافة/تعديل صنف متوافقة مع ProductController (store/update) */
// أصلح توقيع الدالة (function signature)
function InventoryProductFormFields({ 
  values, 
  onChange, 
  showCodeField = true, 
  onImageUpload,
  purchaseCategories 
}) {
  const ch = (key) => (e) => onChange(key, e.target.value);
  const chBool = (key) => (e) => onChange(key, e.target.checked);
  const imageInputRef = useRef(null);
  const theme = useTheme(); // استخدم useTheme() هنا فقط
  
  return (
    <Grid container spacing={1.5}>
      
      {/* ============= الصورة + الاسم والقسم ============= */}
      <Grid size={{ xs: 12, sm: 6 }}>
        <Box
          onClick={() => imageInputRef.current?.click()}
          sx={{
            height: 140,
            borderRadius: 2,
            border: `1.5px dashed ${alpha(theme.palette.primary.main, 0.5)}`,
            bgcolor: alpha(theme.palette.primary.main, 0.08),
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundImage: values.imageUrl ? `url(${values.imageUrl})` : "none",
            backgroundSize: "cover",
            backgroundPosition: "center",
            transition: "all .15s ease",
            "&:hover": { bgcolor: alpha(theme.palette.primary.main, 0.14) },
          }}
        >
          {!values.imageUrl ? (
            <Stack spacing={0.5} alignItems="center">
              <Inventory2 fontSize="large" color="primary" />
              <Typography variant="caption" color="text.secondary">
                اضغط لرفع صورة
              </Typography>
            </Stack>
          ) : null}
        </Box>
        <input
  ref={imageInputRef}
  type="file"
  accept="image/*"
  style={{ display: "none" }}
  onChange={async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (onImageUpload) {
      const imageUrl = await onImageUpload(file);
      if (imageUrl) onChange("imageUrl", imageUrl);
    }
    e.target.value = "";
  }}
/>
      </Grid>
      
      <Grid size={{ xs: 12, sm: 6 }}>
        <Stack spacing={1.5}>
          <TextField 
            label="اسم الصنف *" 
            value={values.name || ""} 
            onChange={ch("name")} 
            fullWidth 
            size="small" 
            required 
          />
          <FormControl fullWidth size="small">
            <InputLabel>القسم *</InputLabel>
            <Select
              label="القسم *"
              value={values.categoryId || ""}
              onChange={ch("categoryId")}
            >
              {purchaseCategories?.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Grid>

      {/* ============= الأسعار والمخزون ============= */}
      <Grid size={{ xs: 12 }}>
        <Divider sx={addDialogSectionDividerSx} />
        <Typography variant="caption" fontWeight={800} color="primary.main">الأسعار والمخزون</Typography>
      </Grid>

      <Grid size={{ xs: 12, sm: 4 }}>
        <TextField 
          label="تكلفة الوحدة" 
          type="number" 
          value={values.costPrice || ""} 
          onChange={ch("costPrice")} 
          fullWidth 
          size="small" 
          inputProps={{ step: "0.01" }} 
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 4 }}>
        <TextField 
          label="ربح الوحدة" 
          type="number" 
          value={values.profitAmount || ""} 
          onChange={ch("profitAmount")} 
          fullWidth 
          size="small" 
          inputProps={{ step: "0.01" }} 
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 4 }}>
        <TextField 
          label="سعر البيع" 
          type="number" 
          value={values.price || ""} 
          onChange={ch("price")} 
          fullWidth 
          size="small" 
          inputProps={{ step: "0.01" }} 
        />
      </Grid>
      <Grid size={{ xs: 12 }}>
        <Alert severity="info" sx={{ py: 0.4 }}>
          يتم الحساب تلقائياً: <strong>سعر البيع = التكلفة + الربح</strong> و <strong>الربح = سعر البيع - التكلفة</strong>.
        </Alert>
      </Grid>

      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField 
          label="حد إعادة الطلب" 
          type="number" 
          value={values.min || ""} 
          onChange={ch("min")} 
          fullWidth 
          size="small" 
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <FormControlLabel 
          control={<Switch checked={values.isActive !== false} onChange={chBool("isActive")} size="small" />} 
          label="نشط" 
          sx={{ mr: 0 }} 
        />
      </Grid>

      {/* ============= التجزئة والتعبئة ============= */}
      <Grid size={{ xs: 12 }}>
        <Divider sx={addDialogSectionDividerSx} />
        <Typography variant="caption" fontWeight={800} color="primary.main">التجزئة والتعبئة</Typography>
      </Grid>

      <Grid size={{ xs: 12 }}>
        <FormControlLabel 
          control={<Switch checked={!!values.allowSplitSales} onChange={chBool("allowSplitSales")} size="small" />} 
          label="البيع بالتجزئة (تقسيم الوحدة)" 
        />
      </Grid>

      {values.allowSplitSales && (
        <>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField 
              label="اسم الوحدة الكاملة" 
              value={values.fullUnitName || ""} 
              onChange={ch("fullUnitName")} 
              fullWidth 
              size="small" 
              placeholder="مثال: علبة، شريط" 
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField 
              label="تقسيم الوحدة (عدد الأجزاء)" 
              type="number" 
              value={values.divideInto || ""} 
              onChange={ch("divideInto")} 
              fullWidth 
              size="small" 
              helperText="2 = نصف، 3 = ثلث، 4 = ربع"
              inputProps={{ min: 2, step: 1 }}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField
              label="اسم التجزئة الأولى"
              value={values.splitLevel1Name || ""}
              onChange={ch("splitLevel1Name")}
              fullWidth
              size="small"
              helperText="مثال: شريط / نصف علبة / ربع"
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField 
              label="سعر بيع الجزء" 
              type="number" 
              value={values.splitSalePrice || ""} 
              onChange={ch("splitSalePrice")} 
              fullWidth 
              size="small" 
              inputProps={{ step: "0.01" }}
              helperText="يُحسب تلقائيًا من سعر بيع الوحدة ÷ عدد الأجزاء"
            />
          </Grid>
          <Grid size={{ xs: 12 }}>
            <Alert severity="success" sx={{ py: 0.4 }}>
              ربح الجزء: {(() => {
                const split = inventoryNumOrNull(values.splitSalePrice);
                const cost = inventoryNumOrNull(values.costPrice);
                const divide = Math.max(0, parseInt(String(values.divideInto ?? "").replace(/[^\d]/g, ""), 10) || 0);
                if (split == null || cost == null || divide < 1) return "—";
                return `${formatCurrency(split - (cost / divide))} ش`;
              })()}
            </Alert>
          </Grid>
          <Grid size={{ xs: 12 }}>
            <FormControlLabel 
              control={<Switch checked={!!values.allowSmallPieces} onChange={chBool("allowSmallPieces")} size="small" />} 
              label="قطع صغيرة داخل الوحدة" 
            />
          </Grid>
          {values.allowSmallPieces && (
            <>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField 
                  label="عدد القطع داخل الوحدة" 
                  type="number" 
                  value={values.piecesCount || ""} 
                  onChange={ch("piecesCount")} 
                  fullWidth 
                  size="small" 
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="اسم التجزئة الثانية"
                  value={values.splitLevel2Name || ""}
                  onChange={ch("splitLevel2Name")}
                  fullWidth
                  size="small"
                  helperText="مثال: حبة / كبسولة"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="السعر التلقائي للقطعة الصغيرة"
                  value={(() => {
                    const split = inventoryNumOrNull(values.splitSalePrice);
                    const divide = Math.max(0, parseInt(String(values.divideInto ?? "").replace(/[^\d]/g, ""), 10) || 0);
                    const pc = Math.max(0, parseInt(String(values.piecesCount ?? "").replace(/[^\d]/g, ""), 10) || 0);
                    if (split == null || divide < 1 || pc < 1) return "";
                    const perPart = Math.max(1, Math.round(pc / divide));
                    return toCleanMoneyString(split / perPart);
                  })()}
                  fullWidth
                  size="small"
                  InputProps={{ readOnly: true }}
                  helperText="محسوب تلقائيًا من سعر الجزء وعدد القطع"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="سعر القطعة الصغيرة (اختياري)"
                  type="number"
                  value={values.customChildPrice || ""}
                  onChange={ch("customChildPrice")}
                  fullWidth
                  size="small"
                  inputProps={{ step: "0.01", min: 0 }}
                  helperText="إذا تركته فارغًا سيتم استخدام السعر التلقائي"
                />
              </Grid>
            </>
          )}
        </>
      )}
    </Grid>
  );
}




export default function InventoryPage({ mode, onToggleMode }) {
  const theme = useTheme();
  const unifiedToggleSx = useMemo(
    () => ({
      direction: "ltr",
      width: 54,
      height: 30,
      p: 0.5,
      "& .MuiSwitch-switchBase": {
        p: 0.5,
        transform: "translateX(0px)",
      },
      "& .MuiSwitch-switchBase.Mui-checked": {
        transform: "translateX(24px)",
        color: theme.palette.common.white,
      },
      "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
        backgroundColor: theme.palette.success.main,
        opacity: 1,
      },
      "& .MuiSwitch-track": {
        borderRadius: 30,
        backgroundColor: theme.palette.action.disabledBackground,
        opacity: 1,
      },
      "& .MuiSwitch-thumb": {
        width: 22,
        height: 22,
        boxShadow: `0 1px 3px ${alpha(theme.palette.common.black, 0.28)}`,
      },
    }),
    [theme],
  );
  
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch {
      return null;
    }
  }, []);
  
  const superCashier = isSuperCashier(currentUser);
  const [cashierSys, setCashierSys] = useState(() => getCashierSystemSettings());
  const showProductImages = cashierSys.showProductImages !== false;
  
  // Products state
  const [items, setItems] = useState([]);
  const [purchaseCategories, setPurchaseCategories] = useState([]);
  // أضف هذا مع باقي الـ states (حوالي السطر 300-350)
const [newProduct, setNewProduct] = useState({
  name: "",
  categoryId: "",
  imageUrl: "",
  allowSplitSales: false,
  fullUnitName: "",
  divideInto: "",
  allowSmallPieces: false,
  piecesCount: "",
  splitLevel1Name: "",
  splitLevel2Name: "",
  customChildPrice: "",

});
// أضف هذه الدوال
const fetchProducts = async () => {
  try {
    const { data } = await Axios.get("products", { params: { per_page: 100, scope: "purchase" } });
    if (data.success) {
      // تحديث قائمة المنتجات إذا لزم الأمر
    }
  } catch (error) {
    console.error("Error fetching products:", error);
  }
};

const handleAddProductInline = async () => {
  if (productSubmitting) return;
  setProductSubmitError("");
  
  const name = String(newProduct.name || "").trim();
  const catId = Number(newProduct.categoryId);
  const allowSplitSales = Boolean(newProduct.allowSplitSales);
  const fullUnitName = String(newProduct.fullUnitName || "").trim();
  const divideInto = Number(newProduct.divideInto || 0);
  const allowSmallPieces = Boolean(newProduct.allowSmallPieces);
  const piecesCount = Number(newProduct.piecesCount || 0);
  const splitLevel1Name = String(newProduct.splitLevel1Name || "").trim();
  const splitLevel2Name = String(newProduct.splitLevel2Name || "").trim();
  const imageUrl = String(newProduct.imageUrl || "").trim();
  
  // التحقق
  if (!name) {
    setProductSubmitError("اسم الصنف مطلوب");
    return;
  }
  if (!Number.isFinite(catId) || catId <= 0) {
    setProductSubmitError("اختر قسمًا صحيحًا");
    return;
  }
  
  // فقط إذا كان التجزئة مفعل نتحقق
  if (allowSplitSales) {
    if (divideInto <= 0) {
      setProductSubmitError("أدخل عدد الأجزاء المتساوية (مثال: 2 لنصف، 3 لثلث)");
      return;
    }
    if (allowSmallPieces && piecesCount <= 0) {
      setProductSubmitError("أدخل عدد القطع الصغيرة في الوحدة الكاملة");
      return;
    }
  }
  
  try {
    setProductSubmitting(true);
    
    // ⭐⭐⭐ بناء البيانات الأساسية فقط
    const productData = {
      name,
      category_id: catId,
      categories: [catId],
      image_url: imageUrl || null,
      price: null,
      purchase_price: 0,
      cost_price: 0,
      stock: Number(0),  // تأكد
      min_stock: Number(0),
      reorder_point: Number(0),
      is_active: true,
      allow_split_sales: allowSplitSales,
      unit: "box",
      purchase_unit: "box",
      sale_unit: "box",
    };
    
    // ⭐ فقط إذا كان التجزئة مفعل، أضف الحقول الإضافية
    if (allowSplitSales) {
      productData.full_unit_name = fullUnitName || null;
      productData.divide_into = divideInto;
      productData.allow_small_pieces = allowSmallPieces;
      if (allowSmallPieces && piecesCount > 0) {
        productData.pieces_count = piecesCount;
      }
      if (splitLevel2Name) {
        productData.split_item_name = splitLevel2Name;
      }
      
      const saleOptions = buildCustomSplitOptions({
        allowSplitSales,
        fullUnitName,
        divideInto,
        allowSmallPieces,
        piecesCount,
        price: null,
        splitLevel1Name,
        splitLevel2Name,
        customChildPrice: newProduct.customChildPrice,  // ⭐ أضف هذا

      });
      if (saleOptions) {
        productData.split_sale_options = saleOptions;
      }
    }
    
    const response = await Axios.post("products", productData);

    showAppToast("تمت إضافة الصنف بنجاح", "success");
    setOpenAddDialog(false);
    setProductSubmitError("");
    setNewProduct({
      name: "",
      categoryId: "",
      imageUrl: "",
      allowSplitSales: false,
      fullUnitName: "",
      divideInto: "",
      allowSmallPieces: false,
      piecesCount: "",
      splitLevel1Name: "",
      splitLevel2Name: "",
    });
    await refetchProductsList();
    
  } catch (error) {
    console.error("Product add error:", error.response?.data || error);
    let errorMsg = "فشل إضافة الصنف";
    if (error.response?.data?.message) {
      errorMsg = error.response.data.message;
    } else if (error.message) {
      errorMsg = error.message;
    }
    setProductSubmitError(errorMsg);
    showAppToast(errorMsg, "error");
  } finally {
    setProductSubmitting(false);
  }
};

const [productDialogOpen, setProductDialogOpen] = useState(false);
const [productSubmitting, setProductSubmitting] = useState(false);
const [productSubmitError, setProductSubmitError] = useState("");
const [imageUploading, setImageUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [displayMode, setDisplayMode] = useState("products"); // 'products' or 'categories'
  const [dataVersion, setDataVersion] = useState(0);
  const bumpDataVersion = useCallback(() => setDataVersion((v) => v + 1), []);

  // Product dialogs
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [page, setPage] = useState(1);
  const [newItem, setNewItem] = useState({
    name: "",
    code: "",
    sku: "",
    barcode: "",
    description: "",
    variantLabel: "",
    categoryId: "",
    hasVariantOptions: false,
    saleType: "box",
    allowSplitSales: false,
    fullUnitName: "",
    divideInto: "",
    allowSmallPieces: false,
    piecesCount: "",
    splitLevel1Name: "",
    splitLevel2Name: "",
    splitSalePrice: "",
    qty: "",
    min: "",
    costPrice: "",
    purchasePrice: "",
    profitAmount: "",
    price: "",
    imageUrl: "",
    bonusQty: "",
    expiryDate: "",
    saleOptionRows: [],
    usageHowTo: "",
    usageFrequency: "",
    usageTips: "",
    purchaseMethod: "cash",
    isActive: true,
  });
  
  const [purchaseFieldErrors, setPurchaseFieldErrors] = useState({});
  const [purchaseSuccess, setPurchaseSuccess] = useState("");
  const addImageInputRef = useRef(null);
  const editImageInputRef = useRef(null);
  const [deleteDialogProduct, setDeleteDialogProduct] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [searchScope, setSearchScope] = useState("all");
  const [searchMatchType, setSearchMatchType] = useState("contains");
  const [splitFilter, setSplitFilter] = useState("all");
  const [stockLevelFilter, setStockLevelFilter] = useState("all");
  const [editTarget, setEditTarget] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    code: "",
    sku: "",
    barcode: "",
    description: "",
    variantLabel: "",
    categoryId: "",
    saleType: "box",
    allowSplitSales: false,
    fullUnitName: "",
    divideInto: "",
    allowSmallPieces: false,
    piecesCount: "",
    splitLevel1Name: "",
    splitLevel2Name: "",
    splitSalePrice: "",
    qty: "",
    min: "",
    costPrice: "",
    purchasePrice: "",
    profitAmount: "",
    price: "",
    imageUrl: "",
    expiryDate: "",
    saleOptionRows: [],
    usageHowTo: "",
    usageFrequency: "",
    usageTips: "",
    isActive: true,
    customChildPrice: "",

  });
  const [editHasVariantOptions, setEditHasVariantOptions] = useState(false);
  
  // Categories state
  const [categories, setCategories] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [openAddCategoryDialog, setOpenAddCategoryDialog] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryError, setCategoryError] = useState("");
  const [categoryPage, setCategoryPage] = useState(1);
  const [categorySearch, setCategorySearch] = useState("");
  const [categoryStatusFilter, setCategoryStatusFilter] = useState("all");
  const [editCategoryTarget, setEditCategoryTarget] = useState(null);
  const [editCategoryForm, setEditCategoryForm] = useState({ name: "" });
  const [editCategoryError, setEditCategoryError] = useState("");
  
  // Stocktake state
  const [stocktakeDialogOpen, setStocktakeDialogOpen] = useState(false);
  const [stocktakeTick, setStocktakeTick] = useState(0);
  const [stocktakeTitle, setStocktakeTitle] = useState("جرد يومي");
  const [stocktakeFetchError, setStocktakeFetchError] = useState("");
  
  const stocktakeSession = useMemo(() => readStocktakeSession(), [stocktakeTick]);
  
  const categoryOptions = useMemo(
    () => [...new Set(purchaseCategories.map((c) => c.name))].filter(Boolean).sort((a, b) => a.localeCompare(b, "ar")),
    [purchaseCategories],
  );

  // Categories helpers
  const categoryProductCountMap = useMemo(() => {
    const map = new Map();
    for (const cat of categories) {
      map.set(cat.id, 0);
    }
    for (const p of allProducts) {
      if (p.category_id && map.has(p.category_id)) {
        map.set(p.category_id, (map.get(p.category_id) || 0) + 1);
      }
    }
    return map;
  }, [allProducts, categories]);
  
  const productsInEditCategory = useMemo(() => {
    if (!editCategoryTarget?.id) return [];
    return allProducts.filter((p) => String(p.category_id) === String(editCategoryTarget.id));
  }, [allProducts, editCategoryTarget]);

  const fetchCategories = async () => {
    try {
      const catsRes = await Axios.get("categories/main", { 
        params: { scope: "purchase", include_inactive: 1 }
      });
      const productsRes = await Axios.get("products", { params: { per_page: 100, include_inactive: 1, scope: "all" } });
      
      const cats = catsRes?.data?.success && Array.isArray(catsRes.data.data)
        ? catsRes.data.data.map((c) => ({
            id: c.id,
            name: c.name,
            productsCount: Number(c.products_count ?? 0),
            status: c.is_active === false ? "معطّل" : "نشط",
            active: c.is_active !== false,
            createdAt: c.created_at || new Date().toISOString(),
          }))
        : [];
      const products = productsRes?.data?.success && Array.isArray(productsRes.data.data) ? productsRes.data.data : [];
      setCategories(cats);
      setAllProducts(products);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const addNewCategory = async () => {
    setCategoryError("");
    if (!newCategoryName.trim()) {
      setCategoryError("يرجى إدخال اسم القسم");
      return;
    }
    if (categories.some((c) => c.name === newCategoryName.trim())) {
      setCategoryError("اسم القسم موجود مسبقًا");
      return;
    }
    try {
      await Axios.post("categories", {
        name: newCategoryName.trim(),
        scope: "purchase",
        is_main: true,
        parent_id: null,
        is_active: true,
      });
      await fetchCategories();
      const categoriesRes = await Axios.get("categories/main", {
        params: { scope: "purchase", include_inactive: 1 }
      });
      if (categoriesRes?.data?.success) {
        const categoriesRows = Array.isArray(categoriesRes.data.data) ? categoriesRes.data.data : [];
        const normalized = categoriesRows
          .map((c) => ({
            id: Number(c?.id),
            name: String(c?.name || "").trim(),
          }))
          .filter((c) => c.name && Number.isFinite(c.id));
        normalized.sort((a, b) => a.name.localeCompare(b.name, "ar"));
        setPurchaseCategories(normalized);
      }
      setNewCategoryName("");
      setOpenAddCategoryDialog(false);
      showAppToast("تم إضافة القسم بنجاح", "success");
      bumpDataVersion();
    } catch (error) {
      showAppToast("تعذر إضافة القسم", "error");
    }
  };

  const toggleCategoryActive = async (id, checked) => {
    await Axios.put(`categories/${id}`, { is_active: checked });
    await fetchCategories();
    bumpDataVersion();
    showAppToast(checked ? "تم تفعيل القسم" : "تم تعطيل القسم", "info");
  };

  const saveCategoryEdit = async () => {
    setEditCategoryError("");
    if (!editCategoryTarget) return;
    const name = editCategoryForm.name.trim();
    if (!name) {
      setEditCategoryError("اسم القسم مطلوب");
      return;
    }
    if (categories.some((c) => c.id !== editCategoryTarget.id && c.name === name)) {
      setEditCategoryError("اسم القسم مستخدم مسبقًا");
      return;
    }
    await Axios.put(`categories/${editCategoryTarget.id}`, { name });
    await fetchCategories();
    bumpDataVersion();
    setEditCategoryTarget(null);
    showAppToast("تم حفظ تعديل القسم", "success");
  };

  const deleteCategory = async (id) => {
    const target = categories.find((c) => c.id === id);
    if (!target) return;
    const ok = await confirmApp({
      title: "حذف القسم",
      text: `حذف القسم «${target.name}»؟ لا يمكن التراجع عن هذا الإجراء.`,
      icon: "warning",
      danger: true,
      confirmText: "نعم، احذف",
    });
    if (!ok) return;
    await Axios.delete(`categories/${id}`);
    await fetchCategories();
    bumpDataVersion();
    showAppToast("تم حذف القسم بنجاح", "success");
  };

  const filteredSortedCategories = useMemo(() => {
    const q = categorySearch.trim().toLowerCase();
    const filtered = categories.filter((cat) => {
      const matchesSearch = !q || String(cat.name || "").toLowerCase().includes(q);
      const matchesStatus =
        categoryStatusFilter === "all" ||
        (categoryStatusFilter === "active" && cat.active) ||
        (categoryStatusFilter === "inactive" && !cat.active);
      return matchesSearch && matchesStatus;
    });
    return [...filtered].sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      if (bTime !== aTime) return bTime - aTime;
      return Number(b.id || 0) - Number(a.id || 0);
    });
  }, [categories, categorySearch, categoryStatusFilter]);
  
  const categoryPageCount = Math.max(1, Math.ceil(filteredSortedCategories.length / CATEGORY_ROWS_PER_PAGE));
  const safeCategoryPage = Math.min(categoryPage, categoryPageCount);
  const paginatedCategories = useMemo(() => {
    const start = (safeCategoryPage - 1) * CATEGORY_ROWS_PER_PAGE;
    return filteredSortedCategories.slice(start, start + CATEGORY_ROWS_PER_PAGE);
  }, [filteredSortedCategories, safeCategoryPage]);
  
  const categoryStats = useMemo(() => {
    let totalProducts = 0;
    for (const cat of filteredSortedCategories) {
      totalProducts += categoryProductCountMap.get(cat.id) || 0;
    }
    return {
      totalCategories: filteredSortedCategories.length,
      totalProducts,
      avgPerCategory: filteredSortedCategories.length ? Math.round(totalProducts / filteredSortedCategories.length) : 0,
    };
  }, [filteredSortedCategories, categoryProductCountMap]);

  // Stocktake functions
  const fetchStocktakeProducts = async () => {
    setLoading(true);
    setStocktakeFetchError("");
    try {
      const { data } = await Axios.get("products", {
        params: { per_page: 100, include_inactive: 1, scope: "all" }
      });
      if (data?.success) {
        const apiRows = Array.isArray(data.data) ? data.data : [];
        setItems(sanitizeMappedProducts(apiRows));
      } else {
        setStocktakeFetchError("فشل في جلب البيانات من الخادم");
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      setStocktakeFetchError("خطأ في الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  const startStocktake = () => {
    const activeProducts = items.filter((p) => p.active !== false);
    if (!activeProducts.length) {
      showAppToast("لا أصناف في المخزون", "warning");
      return;
    }
    startNewStocktakeSession(stocktakeTitle, activeProducts);
    setStocktakeTick((t) => t + 1);
    showAppToast("تم بدء جولة الجرد", "success");
  };

  const updateStocktakeLine = (productId, countedQty) => {
    const s = readStocktakeSession();
    if (!s) return;
    const lines = s.lines.map((ln) =>
      String(ln.productId) === String(productId) ? { ...ln, countedQty } : ln,
    );
    writeStocktakeSession({ ...s, lines });
    setStocktakeTick((t) => t + 1);
  };

  const updateProductStockInApi = async (productId, newQty) => {
    try {
      await Axios.put(`products/${productId}`, { stock: newQty });
      return true;
    } catch (error) {
      console.error(`Error updating product ${productId}:`, error);
      return false;
    }
  };

  const applyStocktake = async () => {
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

    const updates = [];
    for (const ln of s.lines) {
      const counted = Number(String(ln.countedQty).replace(/[^\d.-]/g, ""));
      if (!Number.isFinite(counted) || counted < 0) continue;
      const sys = Number(ln.systemQty || 0);
      if (Math.abs(sys - counted) > 0.0001) {
        updates.push({ id: ln.productId, qty: counted });
      }
    }

    if (updates.length === 0) {
      showAppToast("لا توجد تغييرات في الكميات", "info");
      return;
    }

    let successCount = 0;
    for (const update of updates) {
      const success = await updateProductStockInApi(update.id, update.qty);
      if (success) successCount++;
    }

    await fetchStocktakeProducts();
    
    const u = getStoredUser();
    appendAudit({
      action: "stocktake_apply",
      details: JSON.stringify({ sessionId: s.id, title: s.title, changes: updates.length }),
      username: u?.username || "",
      role: u?.role || "",
    });

    clearStocktakeSession();
    setStocktakeTick((t) => t + 1);
    showAppToast(`تم تطبيق الجرد — ${successCount} صنف تغيّر`, "success");
    setStocktakeDialogOpen(false);
  };

  const cancelStocktakeSession = () => {
    clearStocktakeSession();
    setStocktakeTick((t) => t + 1);
    showAppToast("أُلغيت جلسة الجرد", "info");
    setStocktakeDialogOpen(false);
  };

  useEffect(() => {
    const mode = searchParams.get("mode");
    setDisplayMode(mode === "categories" ? "categories" : "products");
  }, [searchParams]);

  const handleDisplayMode = useCallback(
    (_, value) => {
      if (!value) return;
      setDisplayMode(value);
      const next = new URLSearchParams(searchParams);
      if (value === "categories") next.set("mode", "categories");
      else next.delete("mode");
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  const setDisplayModeFromFilter = useCallback(
    (e) => {
      const value = e.target.value;
      handleDisplayMode(null, value);
    },
    [handleDisplayMode],
  );

  const optStrOrNull = (v) => {
    const t = String(v ?? "").trim();
    return t.length ? t : null;
  };

  const buildProductApiBodyFromForm = (form, { isCreate }) => {
    const catId = Number(form.categoryId);
    const packaging = buildPackagingRequestBody({
      allowSplitSales: form.allowSplitSales,
      fullUnitName: form.fullUnitName,
      divideInto: form.divideInto,
      allowSmallPieces: form.allowSmallPieces,
      piecesCount: form.piecesCount,
    });
    const cost = inventoryNumOrNull(form.costPrice);
    const purchase = inventoryNumOrNull(form.purchasePrice);
    const profit = inventoryNumOrNull(form.profitAmount);
    let price = inventoryNumOrNull(form.price);
    if (profit != null && cost != null) {
      price = cost + profit;
    }
    const body = {
      name: String(form.name || "").trim(),
      description: optStrOrNull(form.description),
      image_url: optStrOrNull(form.imageUrl),
      sku: optStrOrNull(form.sku),
      barcode: optStrOrNull(form.barcode),
      category_id: Number.isFinite(catId) && catId > 0 ? catId : undefined,
      categories: Number.isFinite(catId) && catId > 0 ? [catId] : undefined,
      stock: inventoryNumOrNull(form.qty) ?? 0,
      reorder_point: inventoryNumOrNull(form.min) ?? 0,
      min_stock: inventoryNumOrNull(form.min) ?? 0,
      cost_price: cost,
      purchase_price: purchase ?? cost,
      price: price ?? null,
      profit_amount: profit,
      unit: "box",
      is_active: form.isActive !== false,
      
      ...packaging,
    };
    const saleOptions = buildCustomSplitOptions({
      allowSplitSales: form.allowSplitSales,
      fullUnitName: form.fullUnitName,
      divideInto: form.divideInto,
      allowSmallPieces: form.allowSmallPieces,
      piecesCount: form.piecesCount,
      price,
      splitLevel1Name: form.splitLevel1Name,
      splitLevel2Name: form.splitLevel2Name,
      customChildPrice: form.customChildPrice,  // ⭐ أضف هذا

    });
    if (saleOptions) body.split_sale_options = saleOptions;
    if (form.allowSmallPieces && String(form.splitLevel2Name || "").trim()) {
      body.split_item_name = String(form.splitLevel2Name || "").trim();
    }
    const codeTrim = String(form.code || "").trim();
    if (codeTrim) body.code = codeTrim;
    if (form.allowSplitSales && form.splitSalePrice !== "" && form.splitSalePrice != null) {
      const ssp = inventoryNumOrNull(form.splitSalePrice);
      if (ssp != null) body.split_sale_price = ssp;
    }
    if (isCreate && !form.allowSplitSales) {
      delete body.split_sale_price;
    }
    return body;
  };

  const formatApiValidationErrors = (errors) => {
    if (!errors || typeof errors !== "object") return "";
    const parts = [];
    for (const k of Object.keys(errors)) {
      const arr = errors[k];
      if (Array.isArray(arr) && arr[0]) parts.push(String(arr[0]));
    }
    return parts.slice(0, 4).join(" — ");
  };

  const validateProductForm = (form) => {
    if (!String(form.name || "").trim()) return "اسم الصنف مطلوب";
    const catId = Number(form.categoryId);
    if (!Number.isFinite(catId) || catId < 1) return "اختر قسماً من أقسام المشتريات";
    if (form.allowSplitSales) {
      const div = Math.max(0, parseInt(String(form.divideInto ?? "").replace(/[^\d]/g, ""), 10) || 0);
      if (div < 1) return "أدخل عدد أجزاء التجزئة (مثال: 2، 4)";
      if (form.allowSmallPieces) {
        const pc = Math.max(0, parseInt(String(form.piecesCount ?? "").replace(/[^\d]/g, ""), 10) || 0);
        if (pc < 1) return "أدخل عدد القطع داخل الوحدة عند تفعيل القطع الصغيرة";
      }
    }
    return "";
  };

  const refetchProductsList = async () => {
    const res = await Axios.get("products", {
      params: { per_page: 100, include_inactive: 1, scope: "all" },
    });
    if (res?.data?.success) {
      const apiRows = Array.isArray(res.data.data) ? res.data.data : [];
      setItems(sanitizeMappedProducts(apiRows));
    }
  };

  const submitNewProduct = async () => {
    const err = validateProductForm(newItem);
    if (err) {
      showAppToast(err, "error");
      return;
    }
    try {
      const body = buildProductApiBodyFromForm(newItem, { isCreate: true });
      const { data } = await Axios.post("products", body);
      if (!data?.success) {
        showAppToast(data?.message || "تعذر إضافة الصنف", "error");
        return;
      }
      setOpenAddDialog(false);
      await refetchProductsList();
      await fetchCategories();
      showAppToast(data?.message || "تم إنشاء الصنف", "success");
    } catch (e) {
      const msg = formatApiValidationErrors(e?.response?.data?.errors);
      showAppToast(msg || e?.response?.data?.message || "تعذر إضافة الصنف", "error");
    }
  };

  const submitEditProduct = async () => {
    if (!editTarget?.id) return;
    const err = validateProductForm(editForm);
    if (err) {
      showAppToast(err, "error");
      return;
    }
    try {
      const body = buildProductApiBodyFromForm(editForm, { isCreate: false });
      const { data } = await Axios.put(`products/${editTarget.id}`, body);
      if (!data?.success) {
        showAppToast(data?.message || "تعذر حفظ التعديلات", "error");
        return;
      }
      setEditTarget(null);
      await refetchProductsList();
      await fetchCategories();
      showAppToast(data?.message || "تم حفظ التعديلات", "success");
    } catch (e) {
      const msg = formatApiValidationErrors(e?.response?.data?.errors);
      showAppToast(msg || e?.response?.data?.message || "تعذر تعديل الصنف", "error");
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [productsRes, categoriesRes] = await Promise.all([
          Axios.get("products", {
            params: { per_page: 100, include_inactive: 1, scope: "all" },
          }),
          Axios.get("categories/main", {
            params: { scope: "purchase" },
          }),
        ]);
        if (cancelled) return;
        await syncStoreBalanceFromTreasuryApi(Axios);
        if (cancelled) return;
        
        if (productsRes?.data?.success) {
          const apiRows = Array.isArray(productsRes.data.data) ? productsRes.data.data : [];
          setItems(sanitizeMappedProducts(apiRows));
        }
        if (categoriesRes?.data?.success) {
          const categoriesRows = Array.isArray(categoriesRes.data.data) ? categoriesRes.data.data : [];
          const normalized = categoriesRows
            .map((c) => ({
              id: Number(c?.id),
              name: String(c?.name || "").trim(),
            }))
            .filter((c) => c.name && Number.isFinite(c.id));
          normalized.sort((a, b) => a.name.localeCompare(b.name, "ar"));
          setPurchaseCategories(normalized);
        }
        await fetchCategories();
        await fetchStocktakeProducts();
      } catch (error) {
        if (!cancelled) showAppToast("تعذر تحميل بيانات المخزون", "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dataVersion]);

  const toggleItemActive = (id, checked) => {
    const next = items.map((item) => (item.id === id ? { ...item, active: checked } : item));
    setItems(next);
    showAppToast(checked ? "تم تفعيل الصنف" : "تم تعطيل الصنف", "info");
  };

  const stockCreditForProduct = (p) => {
    const q = parseNonNegativeNumber(p?.qty);
    const unit = unitInventoryCost(p);
    return Number((q * unit).toFixed(2));
  };

  const openDeleteDialog = (id) => {
    const target = items.find((x) => x.id === id);
    if (!target) return;
    setDeleteDialogProduct(target);
  };

  const confirmDeleteProduct = async (withRefund) => {
    const target = deleteDialogProduct;
    if (!target) return;
    
    try {
      await Axios.delete(`products/${target.id}`);
      const res = await Axios.get("products", {
        params: { per_page: 100, include_inactive: 1, scope: "all" },
      });
      if (res?.data?.success) {
        const apiRows = Array.isArray(res.data.data) ? res.data.data : [];
        setItems(sanitizeMappedProducts(apiRows));
      } else {
        setItems((prev) => prev.filter((x) => x.id !== target.id));
      }
      setDeleteDialogProduct(null);
    } catch {
      showAppToast("تعذر حذف الصنف من الباك اند", "error");
      return;
    }
    
    if (withRefund) {
      showAppToast(`تم حذف الصنف`, "success");
    } else {
      showAppToast("تم حذف الصنف بنجاح", "success");
    }
  };

  const filteredSortedItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byScope = (item) => {
      const fields = {
        name: String(item.name || ""),
        code: String(item.code || item.sku || ""),
        barcode: String(item.barcode || ""),
        category: String(item.category || ""),
      };
      if (searchScope !== "all") return [String(fields[searchScope] || "").toLowerCase()];
      return [
        fields.name,
        fields.code,
        fields.barcode,
        fields.category,
        String(item.variantLabel || ""),
        String(productDisplayName(item)),
      ].map((v) => v.toLowerCase());
    };
    const filtered = items.filter((item) => {
      const pool = byScope(item);
      const matchesSearch = !q || (
        searchMatchType === "exact"
          ? pool.some((v) => v === q)
          : pool.some((v) => v.includes(q))
      );
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && item.active) ||
        (statusFilter === "inactive" && !item.active);
      const matchesCategory = categoryFilter === "all" || String(item.category || "") === categoryFilter;
      const qty = Number(item.qty || 0);
      const min = Number(item.min || 0);
      const matchesSplit =
        splitFilter === "all" ||
        (splitFilter === "split" && item.allowSplitSales) ||
        (splitFilter === "full" && !item.allowSplitSales);
      const matchesStockLevel =
        stockLevelFilter === "all" ||
        (stockLevelFilter === "low" && qty < min) ||
        (stockLevelFilter === "ok" && qty >= min) ||
        (stockLevelFilter === "zero" && qty <= 0);
      return matchesSearch && matchesStatus && matchesCategory && matchesSplit && matchesStockLevel;
    });
    return [...filtered].sort((a, b) => {
      const aTime = new Date(a.createdAt || 0).getTime();
      const bTime = new Date(b.createdAt || 0).getTime();
      if (bTime !== aTime) return bTime - aTime;
      return Number(b.id || 0) - Number(a.id || 0);
    });
  }, [items, search, statusFilter, categoryFilter, searchScope, searchMatchType, splitFilter, stockLevelFilter]);
  
  const pageCount = Math.max(1, Math.ceil(filteredSortedItems.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * ROWS_PER_PAGE;
    return filteredSortedItems.slice(start, start + ROWS_PER_PAGE);
  }, [filteredSortedItems, safePage]);

  const inventoryStats = useMemo(() => {
    const total = filteredSortedItems.length;
    const low = filteredSortedItems.filter((i) => Number(i.qty || 0) < Number(i.min || 0)).length;
    const active = filteredSortedItems.filter((i) => i.active).length;
    return { total, low, active };
  }, [filteredSortedItems]);

  const inventoryRowToEditForm = (mapped) => ({
    name: mapped.name || "",
    code: String(mapped.code ?? ""),
    sku: String(mapped.sku ?? ""),
    barcode: String(mapped.barcode ?? ""),
    description: String(mapped.description ?? ""),
    variantLabel: String(mapped.variantLabel ?? ""),
    categoryId: resolvePurchaseCategoryId(mapped, purchaseCategories),
    saleType: mapped.saleType || "box",
    allowSplitSales: Boolean(mapped.allowSplitSales),
    fullUnitName: String(mapped.fullUnitName ?? ""),
    divideInto: String(mapped.divideInto ?? ""),
    allowSmallPieces: Boolean(mapped.allowSmallPieces),
    piecesCount: String(mapped.piecesCount ?? ""),
    splitSalePrice:
      mapped.splitSalePrice != null && Number.isFinite(Number(mapped.splitSalePrice))
        ? String(Number(mapped.splitSalePrice))
        : "",
    splitLevel1Name: String(mapped.splitLevel1Name ?? ""),
    splitLevel2Name: String(mapped.splitLevel2Name ?? ""),
    customChildPrice: String(mapped.customChildPrice ?? ""),  // ⭐ أضف هذا السطر

    qty: String(mapped.qty ?? ""),
    min: String(mapped.min ?? ""),
    costPrice:
      mapped.costPrice != null && mapped.costPrice !== "" && Number.isFinite(Number(mapped.costPrice))
        ? String(Number(mapped.costPrice))
        : "",
    purchasePrice:
      mapped.purchasePriceRaw != null && Number.isFinite(Number(mapped.purchasePriceRaw))
        ? String(Number(mapped.purchasePriceRaw))
        : "",
    profitAmount:
      mapped.profitAmount != null && Number.isFinite(Number(mapped.profitAmount))
        ? String(Number(mapped.profitAmount))
        : "",
    price:
      mapped.price != null && mapped.price !== "" && Number.isFinite(Number(mapped.price))
        ? String(Number(mapped.price))
        : "",
    imageUrl: typeof mapped.image === "string" ? mapped.image : "",
    expiryDate: String(mapped.expiryDate ?? "").slice(0, 10),
    saleOptionRows: [],
    usageHowTo: String(mapped.usageHowTo ?? ""),
    usageFrequency: String(mapped.usageFrequency ?? ""),
    usageTips: String(mapped.usageTips ?? ""),
    isActive: mapped.active !== false,
  });

  const uploadProductImageFile = async (file) => {
    const validation = validateImageFile(file);
    if (!validation.isValid) {
      showAppToast(validation.errors[0] || "ملف الصورة غير صالح", "error");
      return "";
    }
    try {
      setImageUploading(true);
      const response = await uploadProductImage(file);
      const imageUrl = normalizeImageUrl(String(response?.data?.image_url || "").trim());
      if (!imageUrl) {
        showAppToast("تعذر قراءة رابط الصورة بعد الرفع", "error");
        return "";
      }
      showAppToast("تم رفع الصورة بنجاح", "success");
      return imageUrl;
    } catch (error) {
      showAppToast(error?.response?.data?.message || "فشل رفع الصورة", "error");
      return "";
    } finally {
      setImageUploading(false);
    }
  };

  return (
    <AdminLayout mode={mode} onToggleMode={onToggleMode}>
      <Box sx={adminPageContainerSx}>
        
        {/* ============= العنوان والأزرار ============= */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems="center"
          sx={{
            mb: 1.5,
            gap: 1,
            p: 1.5,
            borderRadius: 3,
            bgcolor: "background.paper",
            boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.05)",
            border: "1px solid",
            borderColor: "divider",
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography
              variant="h5"
              fontWeight={800}
              sx={{
                background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)",
                backgroundClip: "text",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                letterSpacing: "-0.02em",
              }}
            >
              إدارة المخزون
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontSize: "0.75rem", fontWeight: 500, mt: 0.25 }}
            >
              الأصناف، الأقسام، والجرد في صفحة واحدة
            </Typography>
          </Box>

          <Stack direction="row" spacing={0.75} alignItems="center" sx={{ flexShrink: 0 }} gap={1}>
            <Button
              variant="outlined"
              color="primary"
              startIcon={<FactCheck />}
              onClick={() => setStocktakeDialogOpen(true)}
              sx={{
                textTransform: "none",
                fontWeight: 700,
                whiteSpace: "nowrap",
                borderRadius: "20px",
                px: 1.8,
                py: 0.6,
                fontSize: "0.8rem",
                borderWidth: "1.5px",
              }}
            >
              جرد المخزون
            </Button>

              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => {
                  setPurchaseFieldErrors({});
                  setPurchaseSuccess("");
                  setNewItem({
                    name: "",
                    code: "",
                    sku: "",
                    barcode: "",
                    description: "",
                    variantLabel: "",
                    categoryId: purchaseCategories[0]?.id ?? "",
                    hasVariantOptions: false,
                    saleType: "box",
                    allowSplitSales: false,
                    fullUnitName: "",
                    divideInto: "",
                    allowSmallPieces: false,
                    piecesCount: "",
                    splitSalePrice: "",
                    qty: "",
                    bonusQty: "",
                    min: "",
                    costPrice: "",
                    purchasePrice: "",
                    profitAmount: "",
                    price: "",
                    imageUrl: "",
                    expiryDate: "",
                    saleOptionRows: [],
                    usageHowTo: "",
                    usageFrequency: "",
                    usageTips: "",
                    purchaseMethod: "cash",
                    isActive: true,
                  });
                  setNewProduct({
                    name: "",
                    categoryId: String(purchaseCategories[0]?.id ?? ""),
                    imageUrl: "",
                    allowSplitSales: false,
                    fullUnitName: "",
                    divideInto: "",
                    allowSmallPieces: false,
                    piecesCount: "",
                    splitLevel1Name: "",
                    splitLevel2Name: "",
                  });
                  setOpenAddDialog(true);
                }}
                sx={{
                  textTransform: "none",
                  fontWeight: 700,
                  borderRadius: "20px",
                  px: 1.8,
                  py: 0.6,
                  fontSize: "0.8rem",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                }}
              >
                 صنف 
              </Button>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => {
                  setNewCategoryName("");
                  setCategoryError("");
                  setOpenAddCategoryDialog(true);
                }}
                sx={{
                  textTransform: "none",
                  fontWeight: 700,
                  borderRadius: "20px",
                  px: 1.8,
                  py: 0.6,
                  fontSize: "0.8rem",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
                }}
              >
                 قسم 
              </Button>
          </Stack>
        </Stack>

     {/* ============= شريط التصفية الموحّد ============= */}
     <Card sx={{ p: 1.5, mb: 3, borderRadius: 4, border: "1px solid", borderColor: "divider" }}>
  <Grid container spacing={1.5} alignItems="center">
    {/* حقل البحث */}
    <Grid size={{ xs: 12, md: 4, lg: 2.5 }}>
      <TextField
        fullWidth
        size="small"
        placeholder={displayMode === "products" ? "ابحث باسم الصنف أو القسم..." : "ابحث باسم القسم..."}
        value={displayMode === "products" ? search : categorySearch}
        onChange={(e) => {
          if (displayMode === "products") {
            setSearch(e.target.value);
            setPage(1);
          } else {
            setCategorySearch(e.target.value);
            setCategoryPage(1);
          }
        }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <Search fontSize="small" color="primary" />
            </InputAdornment>
          ),
        }}
      />
    </Grid>
    
    {/* وضع العرض */}
    <Grid size={{ xs: 12, md: 2, lg: 1.5 }}>
      <FormControl fullWidth size="small">
        <Select value={displayMode} onChange={setDisplayModeFromFilter} displayEmpty>
          <MenuItem value="products">الأصناف</MenuItem>
          <MenuItem value="categories">الأقسام</MenuItem>
        </Select>
      </FormControl>
    </Grid>
    
    {displayMode === "products" && (
      <>
        <Grid size={{ xs: 12, md: 2, lg: 1.5 }}>
          <FormControl fullWidth size="small">
            <Select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} displayEmpty>
              <MenuItem value="all">كل الحالات</MenuItem>
              <MenuItem value="active">نشط</MenuItem>
              <MenuItem value="inactive">غير نشط</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        
        <Grid size={{ xs: 12, md: 2, lg: 1.5 }}>
          <FormControl fullWidth size="small">
            <Select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} displayEmpty>
              <MenuItem value="all">كل الأقسام</MenuItem>
              {categoryOptions.map((n) => (
                <MenuItem key={n} value={n}>{n}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        
        <Grid size={{ xs: 12, md: 2, lg: 1.5 }}>
          <FormControl fullWidth size="small">
            <Select value={searchMatchType} onChange={(e) => { setSearchMatchType(e.target.value); setPage(1); }} displayEmpty>
              <MenuItem value="contains">تحتوي</MenuItem>
              <MenuItem value="exact">مطابقة تامة</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        
        <Grid size={{ xs: 12, md: 2, lg: 1.5 }}>
          <FormControl fullWidth size="small">
            <Select value={stockLevelFilter} onChange={(e) => { setStockLevelFilter(e.target.value); setPage(1); }} displayEmpty>
              <MenuItem value="all">المخزون</MenuItem>
              <MenuItem value="low">أقل من الحد</MenuItem>
              <MenuItem value="ok">طبيعي</MenuItem>
              <MenuItem value="zero">منتهي</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        
        {/* زر المسح */}
        <Grid size={{ xs: 12, md: "auto", lg: "auto" }}>
          <Button
            fullWidth
            variant="outlined"
            color="error"
            onClick={() => {
              setSearch("");
              setStatusFilter("all");
              setCategoryFilter("all");
              setSearchScope("all");
              setSearchMatchType("contains");
              setSplitFilter("all");
              setStockLevelFilter("all");
              setPage(1);
            }}
            startIcon={<RestartAlt />}
            size="small"
          >
            مسح
          </Button>
        </Grid>
      </>
    )}
    
    {displayMode === "categories" && (
      <>
        <Grid size={{ xs: 12, md: 3, lg: 2.5 }}>
          <FormControl fullWidth size="small">
            <Select value={categoryStatusFilter} onChange={(e) => { setCategoryStatusFilter(e.target.value); setCategoryPage(1); }} displayEmpty>
              <MenuItem value="all">كل الحالات</MenuItem>
              <MenuItem value="active">نشط</MenuItem>
              <MenuItem value="inactive">غير نشط</MenuItem>
            </Select>
          </FormControl>
        </Grid>
        
        <Grid size={{ xs: 12, md: "auto", lg: "auto" }}>
          <Button
            fullWidth
            variant="outlined"
            color="error"
            onClick={() => {
              setCategorySearch("");
              setCategoryStatusFilter("all");
              setCategoryPage(1);
            }}
            startIcon={<RestartAlt />}
            size="small"
          >
            مسح
          </Button>
        </Grid>
      </>
    )}
  </Grid>
</Card>

        {/* ============= الكاردات الإحصائية ============= */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {displayMode === "products" ? (
            <>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Card sx={{ p: 2, borderRadius: 3, border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}` }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" color="text.secondary" fontWeight={700}>إجمالي الأصناف</Typography>
                      <Typography variant="h5" fontWeight={900} color="primary.main">{inventoryStats.total}</Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: "primary.main", width: 56, height: 56 }}>
                      <Inventory2 />
                    </Avatar>
                  </Stack>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
  <Card sx={{ p: 2, borderRadius: 3, border: `1px solid ${alpha(theme.palette.error.main, 0.15)}` }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Box>
        <Typography variant="body2" color="text.secondary" fontWeight={700}>أصناف حرجة</Typography>
        <Typography variant="h5" fontWeight={900} color="#b71c1c">{inventoryStats.low}</Typography>
      </Box>
      <Avatar sx={{ bgcolor: alpha(theme.palette.error.main, 0.12), color: "error.main", width: 56, height: 56 }}>
        <WarningAmber />
      </Avatar>
    </Stack>
  </Card>
</Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Card sx={{ p: 2, borderRadius: 3, border: `1px solid ${alpha(theme.palette.success.main, 0.15)}` }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" color="text.secondary" fontWeight={700}>أصناف نشطة</Typography>
                      <Typography variant="h5" fontWeight={900} color="success.main">{inventoryStats.active}</Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: alpha(theme.palette.success.main, 0.12), color: "success.main", width: 56, height: 56 }}>
                      <LocalShipping />
                    </Avatar>
                  </Stack>
                </Card>
              </Grid>
            </>
          ) : (
            <>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Card sx={{ p: 2, borderRadius: 3, border: `1px solid ${alpha(theme.palette.primary.main, 0.15)}` }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" color="text.secondary" fontWeight={700}>عدد الأقسام</Typography>
                      <Typography variant="h5" fontWeight={900} color="primary.main">{categoryStats.totalCategories}</Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.12), color: "primary.main", width: 56, height: 56 }}>
                      <Category />
                    </Avatar>
                  </Stack>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Card sx={{ p: 2, borderRadius: 3, border: `1px solid ${alpha(theme.palette.info.main, 0.15)}` }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" color="text.secondary" fontWeight={700}>إجمالي الأصناف</Typography>
                      <Typography variant="h5" fontWeight={900} color="info.main">{categoryStats.totalProducts}</Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: alpha(theme.palette.info.main, 0.12), color: "info.main", width: 56, height: 56 }}>
                      <Inventory2 />
                    </Avatar>
                  </Stack>
                </Card>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Card sx={{ p: 2, borderRadius: 3, border: `1px solid ${alpha(theme.palette.success.main, 0.15)}` }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" color="text.secondary" fontWeight={700}>متوسط الأصناف/قسم</Typography>
                      <Typography variant="h5" fontWeight={900} color="success.main">{categoryStats.avgPerCategory}</Typography>
                    </Box>
                    <Avatar sx={{ bgcolor: alpha(theme.palette.success.main, 0.12), color: "success.main", width: 56, height: 56 }}>
                      <TrendingUp />
                    </Avatar>
                  </Stack>
                </Card>
              </Grid>
            </>
          )}
        </Grid>

        {/* ============= جدول الأصناف ============= */}
        {displayMode === "products" && (
          <Card sx={{ borderRadius: 3, p: 1.2 }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                    {showProductImages && <TableCell align="center" sx={{ fontWeight: 800 }}>الصورة</TableCell>}
                    <TableCell align="center" sx={{ fontWeight: 800 }}>الصنف</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>القسم</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>طريقة البيع</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>الكمية</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>الأسعار</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>الحالة</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>الإجراءات</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedItems.map((item) => {
                    const displayQty = Number(item.qty || 0);
                    const isLow = displayQty < Number(item.min || 0);
                    const stockPercent = Math.min(100, Math.round((displayQty / Math.max(Number(item.min || 1), 1)) * 100));
                    
                    return (
                      <TableRow
                        key={item.id}
                        hover
                        onClick={async () => {
                          setEditTarget(item);
                          setEditHasVariantOptions(false);
                          setEditForm(inventoryRowToEditForm(mapApiProductToInventoryRow(item)));
                          try {
                            const { data } = await Axios.get(`products/${item.id}`);
                            if (data?.success && data?.data) {
                              const mapped = mapApiProductToInventoryRow(data.data);
                              setEditTarget({ ...item, ...mapped });
                              setEditForm(inventoryRowToEditForm(mapped));
                            }
                          } catch {
                            void 0;
                          }
                        }}
                        sx={{ cursor: "pointer" }}
                      >
                        {showProductImages && (
                          <TableCell align="center">
                            <Avatar src={item.image || ""} variant="rounded" sx={{ width: 44, height: 44, mx: "auto" }}>
                              <Inventory2 fontSize="small" />
                            </Avatar>
                          </TableCell>
                        )}
                        <TableCell align="center">
                          <Typography fontWeight={800}>{productDisplayName(item)}</Typography>
                          <LinearProgress variant="determinate" value={stockPercent} color={isLow ? "error" : "primary"} sx={{ mt: 0.6, height: 6, borderRadius: 99 }} />
                        </TableCell>
                        <TableCell align="center"><Chip size="small" label={item.category} variant="outlined" /></TableCell>
                        <TableCell align="center">
                          <Chip size="small" label={item.allowSplitSales ? "تجزئة" : "كامل"} color={item.allowSplitSales ? "secondary" : "info"} variant="outlined" />
                        </TableCell>
                        <TableCell align="center"><Typography fontWeight={700}>{Number(displayQty || 0).toFixed(1)}</Typography></TableCell>
                        <TableCell align="center">
                          <Stack spacing={0.2} alignItems="center">
                            <Typography variant="caption" fontWeight={800}>تكلفة: {formatOneDecimal(item.costPrice || 0)} ش</Typography>
                            <Typography variant="caption" fontWeight={800}>بيع: {item.price != null ? `${formatOneDecimal(item.price)} ش` : "—"}</Typography>
                            {(() => {
                              const p =
                                item.profitAmount != null && Number.isFinite(Number(item.profitAmount))
                                  ? Number(item.profitAmount)
                                  : resolveRowProfit(item, item.price, item.costPrice);
                              return (
                                <Typography variant="caption" fontWeight={800} color="success.main">
                                  ربح: {p != null && Number.isFinite(p) ? `${formatOneDecimal(p)} ش` : "—"}
                                </Typography>
                              );
                            })()}
                          </Stack>
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" justifyContent="center" alignItems="center" sx={{ gap: 0.5 }}>
                            <Switch checked={item.active} onClick={(e) => e.stopPropagation()} onChange={(e) => toggleItemActive(item.id, e.target.checked)} sx={unifiedToggleSx} />
                            <Typography variant="caption" color={item.active ? "success.main" : "text.secondary"}>{item.active ? "نشط" : "غير نشط"}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell align="center">
                          {!superCashier && (
                            <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); openDeleteDialog(item.id); }}>
                              <DeleteOutline fontSize="small" />
                            </IconButton>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            {pageCount > 1 && (
              <Stack direction="row" justifyContent="center" sx={{ mt: 2 }}>
                <Pagination count={pageCount} page={safePage} onChange={(_, value) => setPage(value)} color="primary" shape="rounded" />
              </Stack>
            )}
          </Card>
        )}

        {/* ============= جدول الأقسام ============= */}
        {displayMode === "categories" && (
          <Card sx={{ borderRadius: 3, p: 1.2 }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05) }}>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>اسم القسم</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>عدد الأصناف</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>الحالة</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>التفعيل</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>إجراءات</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedCategories.map((cat) => (
                    <TableRow
                      key={cat.id}
                      hover
                      sx={{ cursor: "pointer" }}
                      onClick={() => {
                        setEditCategoryTarget(cat);
                        setEditCategoryForm({ name: cat.name || "" });
                        setEditCategoryError("");
                      }}
                    >
                      <TableCell align="center">
                        <Typography fontWeight={800}>{cat.name}</Typography>
                      </TableCell>
                      <TableCell align="center">{categoryProductCountMap.get(cat.id) || 0}</TableCell>
                      <TableCell align="center">
                        <Chip size="small" label={cat.status} color={cat.status === "نشط" ? "success" : "default"} variant="outlined" />
                      </TableCell>
                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        <Stack direction="row" justifyContent="center" alignItems="center" sx={{ gap: 0.5 }}>
                          <Switch checked={Boolean(cat.active)} onChange={(e) => toggleCategoryActive(cat.id, e.target.checked)} sx={unifiedToggleSx} />
                          <Typography variant="caption" color={cat.active ? "success.main" : "text.secondary"}>{cat.active ? "نشط" : "معطّل"}</Typography>
                        </Stack>
                      </TableCell>
                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        {!superCashier && (
                          <Button color="error" size="small" variant="outlined" onClick={() => deleteCategory(cat.id)}>حذف</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            {categoryPageCount > 1 && (
              <Stack direction="row" justifyContent="center" sx={{ mt: 2 }}>
                <Pagination count={categoryPageCount} page={safeCategoryPage} onChange={(_, value) => setCategoryPage(value)} color="primary" shape="rounded" />
              </Stack>
            )}
          </Card>
        )}

        {/* ============= نافذة الجرد ============= */}
        <Dialog open={stocktakeDialogOpen} onClose={() => setStocktakeDialogOpen(false)} fullWidth maxWidth="md" PaperProps={{ sx: { borderRadius: 3 } }}>
          <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: 1, borderColor: "divider", py: 1.5 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <FactCheck color="primary" />
              <Typography variant="h6" fontWeight={800}>جرد المخزون</Typography>
            </Stack>
            <IconButton size="small" onClick={() => setStocktakeDialogOpen(false)}><Close /></IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <TextField size="small" placeholder="اسم الجولة" value={stocktakeTitle} onChange={(e) => setStocktakeTitle(e.target.value)} sx={{ minWidth: 150 }} />
                <Button variant="contained" startIcon={<PlayArrow />} onClick={startStocktake} disabled={loading || items.length === 0}>بدء جرد جديد</Button>
                {stocktakeSession && (
                  <>
                    <Button variant="outlined" color="error" onClick={cancelStocktakeSession}>إلغاء الجلسة</Button>
                    <Button variant="contained" color="secondary" startIcon={<Save />} onClick={applyStocktake}>تطبيق على المخزون</Button>
                  </>
                )}
              </Stack>
              
              {stocktakeSession && (
                <Box>
                  <Typography variant="caption" color="text.secondary">{stocktakeSession.title} — {new Date(stocktakeSession.startedAt).toLocaleString("ar")}</Typography>
                  <TableContainer sx={{ mt: 1, maxHeight: 400 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          <TableCell align="center" sx={{ fontWeight: 800 }}>الصنف</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 800 }}>النظام</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 800 }}>الفعلي</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 800 }}>الفرق</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {stocktakeSession.lines.map((ln) => {
                          const sys = Number(ln.systemQty || 0);
                          const cnt = Number(String(ln.countedQty).replace(/[^\d.-]/g, ""));
                          const c = Number.isFinite(cnt) ? cnt : sys;
                          const diff = c - sys;
                          return (
                            <TableRow key={ln.productId}>
                              <TableCell align="center">{ln.name}</TableCell>
                              <TableCell align="center">{sys.toFixed(1)}</TableCell>
                              <TableCell align="center" sx={{ width: 140 }}>
                                <TextField size="small" value={ln.countedQty || ""} onChange={(e) => updateStocktakeLine(ln.productId, e.target.value)} inputProps={{ style: { textAlign: "center" } }} />
                              </TableCell>
                              <TableCell align="center" sx={{ fontWeight: 800, color: diff === 0 ? "text.secondary" : "warning.main" }}>{diff >= 0 ? "+" : ""}{diff.toFixed(1)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Stack>
          </DialogContent>
        </Dialog>

        {/* ============= بقية النوافذ ============= */}
        
        {/* نافذة إضافة قسم جديد */}
        <Dialog open={openAddCategoryDialog} onClose={() => setOpenAddCategoryDialog(false)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3 } }}>
          <DialogTitle sx={{ textAlign: "center", fontWeight: 800 }}>إضافة قسم جديد</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ pt: 1 }}>
              {categoryError && <Typography variant="body2" color="error.main">{categoryError}</Typography>}
              <TextField fullWidth label="اسم القسم" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} autoFocus />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button onClick={() => setOpenAddCategoryDialog(false)}>إلغاء</Button>
            <Button variant="contained" onClick={addNewCategory}>إضافة القسم</Button>
          </DialogActions>
        </Dialog>

        {/* نافذة تعديل القسم */}
        <Dialog open={Boolean(editCategoryTarget)} onClose={() => setEditCategoryTarget(null)} fullWidth maxWidth="sm">
          <DialogTitle>تعديل القسم</DialogTitle>
          <DialogContent>
            <Stack sx={{ gap: 1.2, mt: 1 }}>
              {editCategoryError && <Typography variant="body2" color="error.main">{editCategoryError}</Typography>}
              <TextField label="اسم القسم" value={editCategoryForm.name} onChange={(e) => setEditCategoryForm((p) => ({ ...p, name: e.target.value }))} fullWidth />
              <Card variant="outlined" sx={{ p: 1.2, borderRadius: 2, bgcolor: alpha(theme.palette.primary.main, 0.04) }}>
                <Typography variant="subtitle2" fontWeight={900}>الأصناف داخل هذا القسم ({productsInEditCategory.length})</Typography>
                <Stack sx={{ mt: 0.8, maxHeight: 180, overflowY: "auto", gap: 0.5 }}>
                  {productsInEditCategory.length === 0 ? (
                    <Typography variant="caption" color="text.secondary">لا توجد أصناف مرتبطة بهذا القسم حالياً.</Typography>
                  ) : (
                    productsInEditCategory.map((p) => <Typography key={p.id} variant="caption">• {String(p.name || "صنف")}</Typography>)
                  )}
                </Stack>
              </Card>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditCategoryTarget(null)}>إلغاء</Button>
            <Button variant="contained" onClick={saveCategoryEdit}>حفظ</Button>
          </DialogActions>
        </Dialog>

        {/* نافذة الحذف */}
        <Dialog open={Boolean(deleteDialogProduct)} onClose={() => setDeleteDialogProduct(null)} fullWidth maxWidth="sm" PaperProps={{ sx: inventoryDialogPaperSx }}>
          <DialogTitle sx={inventoryDialogTitleSx}>
            <IconButton size="small" onClick={() => setDeleteDialogProduct(null)} sx={inventoryDialogCloseBtnSx}><Close /></IconButton>
            <Typography variant="h6" fontWeight={800}>حذف صنف من المخزون</Typography>
          </DialogTitle>
          <DialogContent dividers>
            <Stack sx={{ gap: 1.5 }}>
              <Typography>هل تريد حذف <strong>{deleteDialogProduct ? productDisplayName(deleteDialogProduct) : ""}</strong>؟</Typography>
              <Alert severity="info">قيمة المخزون تُحسب: الكمية × متوسط تكلفة الوحدة.</Alert>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogProduct(null)}>إلغاء</Button>
            <Button color="warning" onClick={() => void confirmDeleteProduct(false)}>حذف بدون إرجاع</Button>
            <Button variant="contained" color="error" onClick={() => void confirmDeleteProduct(true)}>حذف مع إرجاع للخزنة</Button>
          </DialogActions>
        </Dialog>

    {/* ============= نافذة إضافة صنف جديد (مطابقة لصفحة المشتريات) ============= */}
<Dialog 
  open={openAddDialog} 
  onClose={() => setOpenAddDialog(false)} 
  fullWidth 
  maxWidth="sm"
  PaperProps={{ sx: { borderRadius: 4 } }}
>
  <DialogTitle sx={{ textAlign: "center", fontWeight: 800 }}>
    إضافة صنف جديد
  </DialogTitle>
  
  <DialogContent dividers sx={{ textAlign: "right", px: { xs: 2, sm: 2.5 }, py: 2 }}>
    <Stack spacing={2} sx={{ pt: 1 }}>
  
      
    {String(newProduct.imageUrl || "").trim() ? (
  <Box sx={{ mt: 2, width: "100%", height: 180, borderRadius: 2, overflow: "hidden", border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}` }}>
    <img 
      src={newProduct.imageUrl} 
      alt="صورة الصنف"
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        display: "block"
      }}
    />
  </Box>
) : null}
      {/* اسم الصنف */}
      <TextField
        fullWidth
        label="اسم الصنف *"
        value={newProduct.name}
        onChange={(e) => setNewProduct((prev) => ({ ...prev, name: e.target.value }))}
      />
      
      {/* القسم */}
      <TextField
        select
        fullWidth
        label="القسم *"
        value={newProduct.categoryId}
        onChange={(e) => setNewProduct((prev) => ({ ...prev, categoryId: e.target.value }))}
      >
        <MenuItem value="">
          <em>-- اختر القسم --</em>
        </MenuItem>
        {purchaseCategories.map((c) => (
          <MenuItem key={c.id} value={String(c.id)}>
            {c.name}
          </MenuItem>
        ))}
      </TextField>
      
      {/* تفعيل خاصية البيع بالتجزئة */}
      <FormControlLabel
        control={
          <Switch
            checked={Boolean(newProduct.allowSplitSales)}
            onChange={(e) =>
              setNewProduct((prev) => {
                const on = e.target.checked;
                const nextName =
                  on && !String(prev.fullUnitName || "").trim() ? "علبة" : prev.fullUnitName;
                return {
                  ...prev,
                  allowSplitSales: on,
                  fullUnitName: nextName,
                };
              })
            }
          />
        }
        label="هذا الصنف يُباع بأجزاء (تجزئة)"
      />

      

      {/* تفاصيل التجزئة (تظهر فقط إذا فعّل المستخدم التجزئة) */}
      {newProduct.allowSplitSales && (
        <>
          <Alert severity="info" sx={{ fontSize: '0.75rem' }}>
            💡 <strong>نظام التجزئة:</strong><br />
            • الوحدة الكاملة = {newProduct.fullUnitName || "المنتج كاملاً"}<br />
            • يمكن البيع: نصف، ثلث، ربع، أو حسب الأجزاء التي تحددها
          </Alert>

          {/* عدد الأجزاء المتساوية التي يمكن تقسيم الوحدة الكاملة إليها */}
          <TextField
            fullWidth
            type="number"
            label="كم جزء متساوٍ تريد تقسيم الوحدة الكاملة؟"
            value={newProduct.divideInto || ""}
            onChange={(e) => setNewProduct((prev) => ({ 
              ...prev, 
              divideInto: e.target.value 
            }))}
            placeholder="مثال: 2 (نصف)، 3 (ثلث)، 4 (ربع)"
            helperText="مثال: 2 = نصف، 3 = ثلث، 4 = ربع"
            inputProps={{ min: 2, step: 1 }}
          />
          <TextField
            fullWidth
            label="اسم التجزئة الأولى (يظهر بالكاشير)"
            value={newProduct.splitLevel1Name || ""}
            onChange={(e) => setNewProduct((prev) => ({
              ...prev,
              splitLevel1Name: e.target.value
            }))}
            placeholder="مثال: شريط / نصف علبة / ربع"
          />

          {/* هل تريد بيع وحدات أصغر (مثل الحبات)؟ */}
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(newProduct.allowSmallPieces)}
                onChange={(e) => setNewProduct((prev) => ({ 
                  ...prev, 
                  allowSmallPieces: e.target.checked 
                }))}
              />
            }
            label="أريد بيع وحدات أصغر داخل الجزء (مثل: حبة من الشريط)"
          />

{newProduct.allowSmallPieces && (
  <>
    <TextField
      fullWidth
      type="number"
      label="عدد القطع داخل الوحدة"
      value={newProduct.piecesCount || ""}
      onChange={(e) => setNewProduct((prev) => ({
        ...prev,
        piecesCount: e.target.value
      }))}
      placeholder="مثال: شريط فيه 9 حبات ← أدخل 9"
      helperText="هذا يسمح ببيع الحبة بمفردها"
      inputProps={{ min: 2, step: 1 }}
    />
    <TextField
      fullWidth
      label="اسم التجزئة الثانية (يظهر بالكاشير)"
      value={newProduct.splitLevel2Name || ""}
      onChange={(e) => setNewProduct((prev) => ({
        ...prev,
        splitLevel2Name: e.target.value
      }))}
      placeholder="مثال: حبة / كبسولة"
    />
    
    {/* ⭐ حقل السعر المخصص */}
    <TextField
      fullWidth
      type="number"
      label="سعر القطعة الصغيرة (اختياري)"
      value={newProduct.customChildPrice || ""}
      onChange={(e) => setNewProduct((prev) => ({
        ...prev,
        customChildPrice: e.target.value
      }))}
      placeholder="اتركه فارغاً للحساب التلقائي"
      helperText={`الحساب التلقائي: سعر ${newProduct.splitLevel2Name || "القطعة"} = سعر ${newProduct.splitLevel1Name || "الجزء"} ÷ (${newProduct.piecesCount || "?"} ÷ ${newProduct.divideInto || "?"})`}
      inputProps={{ step: 0.01, min: 0 }}
    />
  </>
)}

          {/* شرح مبسط للحسبة */}
          <Paper sx={{ p: 2, bgcolor: '#f5f5f5', borderRadius: 2 }}>
            <Typography variant="caption" fontWeight={600} display="block" gutterBottom>
              🧮 كيف ستحسب الأسعار تلقائياً:
            </Typography>
            <Typography variant="caption" display="block" color="text.secondary">
              • سعر شراء الوحدة الكاملة = المدخل أثناء الشراء<br />
              • سعر بيع الجزء = سعر الوحدة الكاملة ÷ عدد الأجزاء<br />
              • سعر بيع القطعة الصغيرة = سعر الجزء ÷ عدد القطع فيه
            </Typography>
          </Paper>
        </>
      )}

      <Alert severity="info" sx={{ mt: 1 }}>
        ✅ <strong>ملاحظة:</strong> سعر الشراء سيتم إضافته من خلال سلة الشراء،<br />
        وسعر الببيع سيتم حسابه تلقائياً حسب الأجزاء التي تبيعها.
      </Alert>
    </Stack>
  </DialogContent>
  
  <DialogActions sx={{ px: 3, py: 2 }}>
    <Button onClick={() => setOpenAddDialog(false)} sx={{ textTransform: "none" }}>
      إلغاء
    </Button>
    <Button
      variant="contained"
      onClick={handleAddProductInline}
      disabled={productSubmitting || !String(newProduct.name || "").trim() || !String(newProduct.categoryId || "").trim()}
      sx={{ textTransform: "none", fontWeight: 800 }}
    >
      {productSubmitting ? "جاري الحفظ..." : "حفظ الصنف"}
    </Button>
  </DialogActions>
</Dialog>

        {/* نافذة تعديل الصنف */}
   {/* نافذة تعديل الصنف - استخدم editForm بدلاً من newItem */}
{/* نافذة تعديل الصنف */}
<Dialog open={Boolean(editTarget)} onClose={() => setEditTarget(null)} fullWidth maxWidth="md" slotProps={{ paper: { sx: inventoryDialogPaperSx } }}>
  <DialogTitle sx={inventoryDialogTitleSx}>
    <IconButton onClick={() => setEditTarget(null)} sx={inventoryDialogCloseBtnSx}><Close /></IconButton>
    <Typography variant="h6" fontWeight={800}>تعديل الصنف</Typography>
  </DialogTitle>
  <DialogContent dividers>
    <Stack spacing={2} sx={{ pt: 0.5 }}>
      <InventoryProductFormFields
        values={editForm}  
        onChange={(k, v) => setEditForm((p) => applyInventoryFormChange(p, k, v))}
        onImageUpload={uploadProductImageFile}
        purchaseCategories={purchaseCategories}
      />
    </Stack>
  </DialogContent>
  <DialogActions sx={{ px: 2, py: 1.5 }}>
    <Button onClick={() => setEditTarget(null)}>إلغاء</Button>
    <Button variant="contained" onClick={() => void submitEditProduct()}>حفظ</Button>
  </DialogActions>
</Dialog>
      </Box>
    </AdminLayout>
  );
}