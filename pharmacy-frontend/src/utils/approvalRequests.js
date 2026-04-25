import { appendSalesReturn } from "./salesReturnsStorage";

const APPROVAL_REQUESTS_KEY = "pharmacyApprovalRequests_v1";
const APPROVAL_REQUESTS_EVENT = "pharmacy-approval-requests-changed";
const SALES_INVOICES_KEY = "salesInvoices";
const ADMIN_PRODUCTS_KEY = "adminProducts";
const PRINT_LOG_KEY = "pharmacyInvoicePrintLog_v1";

function readList(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistRequests(list) {
  localStorage.setItem(APPROVAL_REQUESTS_KEY, JSON.stringify(Array.isArray(list) ? list : []));
  window.dispatchEvent(new Event(APPROVAL_REQUESTS_EVENT));
}

function createInvoiceNumber() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const rand = String(Math.floor(Math.random() * 1000000)).padStart(6, "0");
  return `INV-${yyyy}${mm}${dd}-${rand}`;
}

function adjustStockByInvoiceItems(items, direction) {
  const products = readList(ADMIN_PRODUCTS_KEY);
  if (!products.length || !Array.isArray(items) || !items.length) return;
  const next = products.map((p) => {
    const rows = items.filter((it) => Number(it.productId ?? it.id) === Number(p.id));
    if (!rows.length) return p;
    const base = { ...p };
    const deltaForBase = rows.reduce((sum, row) => {
      const qty = Number(row.qty || 0);
      const optId = String(row.saleOptionId ?? "").trim();
      if (!optId) return sum + qty;
      return sum;
    }, 0);
    if (deltaForBase > 0) {
      const currentQty = Number(base.qty || 0);
      base.qty = Number((currentQty + direction * deltaForBase).toFixed(1));
    }
    if (Array.isArray(base.saleOptions) && base.saleOptions.length) {
      base.saleOptions = base.saleOptions.map((opt) => {
        const id = String(opt?.id ?? "").trim();
        if (!id) return opt;
        const byOption = rows
          .filter((row) => String(row.saleOptionId ?? "").trim() === id)
          .reduce((sum, row) => sum + Number(row.qty || 0), 0);
        if (!byOption) return opt;
        const cur = Number(opt.qty ?? opt.quantity ?? opt.stock ?? 0);
        const val = Number((cur + direction * byOption).toFixed(1));
        if (Object.prototype.hasOwnProperty.call(opt, "qty")) return { ...opt, qty: val };
        if (Object.prototype.hasOwnProperty.call(opt, "quantity")) return { ...opt, quantity: val };
        if (Object.prototype.hasOwnProperty.call(opt, "stock")) return { ...opt, stock: val };
        return { ...opt, qty: val };
      });
    }
    return base;
  });
  localStorage.setItem(ADMIN_PRODUCTS_KEY, JSON.stringify(next));
}

function executeApprovedRequest(req, actorUsername) {
  const type = String(req?.requestType || "");
  if (type === "discount" || type === "credit_debt") {
    const draft = req?.requestData?.pendingInvoice;
    if (!draft || !Array.isArray(draft.items) || !draft.items.length) {
      throw new Error("لا توجد بيانات فاتورة لتنفيذ الطلب");
    }
    const invoice = {
      ...draft,
      id: createInvoiceNumber(),
      soldAt: new Date().toISOString(),
      approvedBy: actorUsername || "",
      approvalRequestId: req.id,
      status: "مكتمل",
    };
    const sales = readList(SALES_INVOICES_KEY);
    localStorage.setItem(SALES_INVOICES_KEY, JSON.stringify([invoice, ...sales]));
    adjustStockByInvoiceItems(invoice.items, -1);
    return { ok: true, message: `تم تنفيذ الفاتورة ${invoice.id}` };
  }
  if (type === "refund") {
    const invId = String(req?.invoiceId || "");
    const sales = readList(SALES_INVOICES_KEY);
    const invoice = sales.find((x) => String(x.id) === invId);
    if (!invoice) throw new Error("الفاتورة غير موجودة");
    const nextSales = sales.filter((x) => String(x.id) !== invId);
    localStorage.setItem(SALES_INVOICES_KEY, JSON.stringify(nextSales));
    appendSalesReturn({
      originalInvoiceId: invoice.id,
      restoredBy: actorUsername || "admin",
      items: (invoice.items || []).map((it) => ({
        productId: it.productId ?? it.id,
        name: it.name,
        qty: Number(it.qty || 0),
        price: Number(it.price || 0),
        total: Number(it.total ?? Number(it.qty || 0) * Number(it.price || 0)),
      })),
      invoiceTotal: Number(invoice.total || 0),
      paymentMethod: invoice.paymentMethod,
      approvalId: req.id,
    });
    adjustStockByInvoiceItems(invoice.items || [], +1);
    return { ok: true, message: `تم تنفيذ مرتجع الفاتورة ${invoice.id}` };
  }
  if (type === "reprint") {
    const logs = readList(PRINT_LOG_KEY);
    const row = {
      id: `PRN-${Date.now()}`,
      invoiceId: req?.invoiceId || null,
      printedBy: actorUsername || "",
      printReason: "approved_reprint",
      printedAt: new Date().toISOString(),
      approvalId: req.id,
    };
    localStorage.setItem(PRINT_LOG_KEY, JSON.stringify([row, ...logs]));
    return { ok: true, message: "تم اعتماد إعادة الطباعة" };
  }
  return { ok: true, message: "تم اعتماد الطلب" };
}

export function readApprovalRequests() {
  return readList(APPROVAL_REQUESTS_KEY);
}

export function createApprovalRequest(input) {
  const now = Date.now();
  const req = {
    id: `apr-${now}-${Math.floor(Math.random() * 10000)}`,
    requestType: String(input?.requestType || "generic"),
    requestedBy: String(input?.requestedBy || ""),
    invoiceId: input?.invoiceId || null,
    requestData: input?.requestData || {},
    reason: String(input?.reason || ""),
    status: "pending",
    assignedTo: input?.assignedTo || null,
    approvedBy: null,
    approvedAt: null,
    rejectedReason: "",
    executionResult: "",
    expiresAt: new Date(now + 5 * 60 * 1000).toISOString(),
    createdAt: new Date(now).toISOString(),
  };
  persistRequests([req, ...readApprovalRequests()]);
  return req;
}

export function expireOldApprovalRequests() {
  const now = Date.now();
  const list = readApprovalRequests();
  const next = list.map((r) => {
    if (r.status !== "pending") return r;
    const exp = new Date(r.expiresAt || 0).getTime();
    if (!exp || exp > now) return r;
    return { ...r, status: "expired", executionResult: "انتهت صلاحية الطلب بدون رد" };
  });
  persistRequests(next);
  return next;
}

export function approveApprovalRequest(requestId, actorUsername) {
  const list = readApprovalRequests();
  const idx = list.findIndex((r) => String(r.id) === String(requestId));
  if (idx < 0) return { ok: false, message: "الطلب غير موجود" };
  const req = list[idx];
  if (req.status !== "pending") return { ok: false, message: "تمت معالجة الطلب سابقاً" };
  const execution = executeApprovedRequest(req, actorUsername);
  list[idx] = {
    ...req,
    status: "approved",
    approvedBy: actorUsername || "",
    approvedAt: new Date().toISOString(),
    executionResult: execution.message || "",
  };
  persistRequests(list);
  return { ok: true, message: execution.message || "تمت الموافقة" };
}

export function rejectApprovalRequest(requestId, actorUsername, rejectedReason) {
  const list = readApprovalRequests();
  const idx = list.findIndex((r) => String(r.id) === String(requestId));
  if (idx < 0) return { ok: false, message: "الطلب غير موجود" };
  const req = list[idx];
  if (req.status !== "pending") return { ok: false, message: "تمت معالجة الطلب سابقاً" };
  list[idx] = {
    ...req,
    status: "rejected",
    approvedBy: actorUsername || "",
    approvedAt: new Date().toISOString(),
    rejectedReason: String(rejectedReason || "").trim(),
    executionResult: "تم رفض الطلب",
  };
  persistRequests(list);
  return { ok: true, message: "تم رفض الطلب" };
}

export { APPROVAL_REQUESTS_EVENT, APPROVAL_REQUESTS_KEY };
