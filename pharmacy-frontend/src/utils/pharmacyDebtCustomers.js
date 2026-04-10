/** زبائن بيع آجل — رصيد = المبلغ المستحق على الزبون */
const KEY = "pharmacyDebtCustomers_v1";
const LEDGER_KEY = "pharmacyDebtCustomerLedger_v1";
const MAX_LEDGER_ROWS = 2000;

function readLedgerAll() {
  try {
    const raw = JSON.parse(localStorage.getItem(LEDGER_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeLedgerAll(rows) {
  try {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(rows.slice(0, MAX_LEDGER_ROWS)));
  } catch {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(rows.slice(0, 500)));
  }
}

/**
 * @param {{
 *   customerId: string,
 *   customerName?: string,
 *   delta: number,
 *   balanceAfter: number,
 *   type: string,
 *   source?: string,
 *   username?: string,
 *   invoiceId?: string,
 *   note?: string,
 * }} row
 */
export function appendDebtLedgerEntry(row) {
  const entry = {
    id: `DL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date().toISOString(),
    customerId: String(row.customerId || ""),
    customerName: String(row.customerName || ""),
    delta: Number(row.delta) || 0,
    balanceAfter: Math.max(0, Number(row.balanceAfter) || 0),
    type: String(row.type || "adjust"),
    source: String(row.source || ""),
    username: String(row.username || ""),
    invoiceId: String(row.invoiceId || ""),
    note: String(row.note || ""),
  };
  if (!entry.customerId) return;
  writeLedgerAll([entry, ...readLedgerAll()]);
}

/** حركة زبون واحد (الأحدث أولاً) */
export function readDebtLedgerForCustomer(customerId) {
  const id = String(customerId || "");
  return readLedgerAll().filter((r) => String(r.customerId) === id);
}

export function readDebtCustomers() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function writeAll(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function upsertDebtCustomer(row) {
  const list = readDebtCustomers();
  const id = row.id || `CUST-${Date.now()}`;
  const next = {
    id,
    name: String(row.name || "").trim(),
    phone: String(row.phone || "").trim(),
    creditLimit: Math.max(0, Number(row.creditLimit) || 0),
    balance: Math.max(0, Number(row.balance) || 0),
    notes: String(row.notes || "").trim(),
  };
  if (!next.name) return { ok: false, error: "اسم الزبون مطلوب" };
  const idx = list.findIndex((c) => c.id === id);
  if (idx >= 0) {
    const prevBal = Number(list[idx].balance || 0);
    list[idx] = { ...list[idx], ...next };
    const newBal = Number(list[idx].balance || 0);
    const diff = newBal - prevBal;
    if (Math.abs(diff) > 1e-9) {
      appendDebtLedgerEntry({
        customerId: id,
        customerName: list[idx].name || "",
        delta: diff,
        balanceAfter: newBal,
        type: "balance_edit",
        source: "admin_form",
        note: "تعديل الرصيد من نموذج الزبون",
      });
    }
  } else {
    list.unshift(next);
    const ob = Number(next.balance || 0);
    if (ob > 1e-9) {
      appendDebtLedgerEntry({
        customerId: id,
        customerName: next.name || "",
        delta: ob,
        balanceAfter: ob,
        type: "opening_balance",
        source: "admin_form",
        note: "زبون جديد",
      });
    }
  }
  writeAll(list);
  return { ok: true, customer: next };
}

export function deleteDebtCustomer(id) {
  const list = readDebtCustomers().filter((c) => c.id !== id);
  writeAll(list);
}

/**
 * زيادة الدين عند بيع آجل (delta موجب) أو تخفيض عند تسديد
 * @param {string} id
 * @param {number} delta
 * @param {false|{
 *   type?: string,
 *   source?: string,
 *   username?: string,
 *   invoiceId?: string,
 *   note?: string,
 * }=} meta — مرّر `false` لتعطيل تسجيل السطر في سجل الزبون
 */
export function adjustCustomerBalance(id, delta, meta) {
  const list = readDebtCustomers();
  const idx = list.findIndex((c) => c.id === id);
  if (idx < 0) return { ok: false };
  const d = Number(delta) || 0;
  const b = Math.max(0, Number(list[idx].balance || 0) + d);
  list[idx] = { ...list[idx], balance: b };
  writeAll(list);
  if (meta !== false && Math.abs(d) > 1e-9) {
    appendDebtLedgerEntry({
      customerId: id,
      customerName: list[idx].name || "",
      delta: d,
      balanceAfter: b,
      type: meta?.type || (d < 0 ? "payment" : "credit_sale"),
      source: meta?.source || "",
      username: meta?.username || "",
      invoiceId: meta?.invoiceId || "",
      note: meta?.note || "",
    });
  }
  return { ok: true, balance: b };
}

export function getDebtCustomer(id) {
  return readDebtCustomers().find((c) => c.id === id) || null;
}

/** هل يُسمح ببيع جديد بالمبلغ total؟ */
export function canAddCreditSale(customerId, total) {
  const c = getDebtCustomer(customerId);
  if (!c) return { ok: false, reason: "الزبون غير موجود" };
  const t = Number(total) || 0;
  const lim = Number(c.creditLimit) || 0;
  const bal = Number(c.balance) || 0;
  if (bal + t > lim + 0.0001) return { ok: false, reason: "يتجاوز سقف الدين المسموح" };
  return { ok: true };
}
