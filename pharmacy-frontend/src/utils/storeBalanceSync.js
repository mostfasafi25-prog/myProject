/** يُبث بعد أي تعديل على localStorage `storeBalance` حتى تتحدث لوحات مثل الرئيسية دون انتظار focus */
import { readCriticalJson, writeCriticalJson } from "./criticalSyncStorage";

export const STORE_BALANCE_CHANGED = "pharmacy-store-balance-changed";
export const STORE_BALANCE_KEY = "storeBalance";

export function notifyStoreBalanceChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(STORE_BALANCE_CHANGED));
}

export function readStoreBalance() {
  const parsed = readCriticalJson(STORE_BALANCE_KEY, null);
  if (parsed && typeof parsed === "object") {
    return {
      total: Number(parsed.total || 0),
      cash: Number(parsed.cash || 0),
      app: Number(parsed.app || 0),
      ...parsed,
    };
  }
  return { total: 0, cash: 0, app: 0 };
}

export function writeStoreBalance(nextBalance) {
  writeCriticalJson(STORE_BALANCE_KEY, nextBalance);
  notifyStoreBalanceChanged();
}

/** مزامنة رصيد الخزنة من الباك اند (جدول treasury) إلى التخزين المحلي المستخدم في صفحة المخزون */
export async function syncStoreBalanceFromTreasuryApi(http) {
  try {
    const { data } = await http.get("treasury-balance");
    if (!data?.success) return null;
    const balance = Number(data?.data?.balance ?? 0);
    const prev = readStoreBalance();
    const next = {
      ...prev,
      total: balance,
      cash: balance,
      app: 0,
      updatedAt: new Date().toISOString(),
    };
    writeStoreBalance(next);
    return next;
  } catch {
    return null;
  }
}

/**
 * خصم تكلفة شراء/توريد من رصيد المحل المحلي.
 * @param {{ total?: number; cash: number; app: number; [k: string]: unknown }} balance
 * @param {number} cost
 * @param {{ allowNegativeTreasury?: boolean, preferredPaymentMethod?: "cash"|"app"|"mixed_auto" }} opts
 * - allowNegativeTreasury: سوبر كاشير يُسمح بعجز في الخزنة
 * - preferredPaymentMethod: طريقة الخصم المرغوبة للشراء/التزويد
 */
export function debitStoreBalanceForPurchase(balance, cost, opts = {}) {
  const allow = Boolean(opts.allowNegativeTreasury);
  const preferred = String(opts.preferredPaymentMethod || "mixed_auto");
  const cash = Number(balance.cash || 0);
  const app = Number(balance.app || 0);
  const prevTotal = Number(balance.total != null ? balance.total : cash + app);
  if (allow) {
    const debitFromApp = preferred === "app";
    const nextCash = debitFromApp ? cash : cash - cost;
    const nextApp = debitFromApp ? app - cost : app;
    return {
      nextBalance: {
        ...balance,
        cash: nextCash,
        app: nextApp,
        total: prevTotal - cost,
        lastOperation: "purchase",
        updatedAt: new Date().toISOString(),
      },
      paidFromCash: Number((debitFromApp ? 0 : cost).toFixed(2)),
      paidFromApp: Number((debitFromApp ? cost : 0).toFixed(2)),
    };
  }
  if (preferred === "cash") {
    const nextCash = Math.max(0, cash - cost);
    return {
      nextBalance: {
        ...balance,
        total: Math.max(0, prevTotal - cost),
        cash: nextCash,
        app,
        lastOperation: "purchase",
        updatedAt: new Date().toISOString(),
      },
      paidFromCash: Number((cash - nextCash).toFixed(2)),
      paidFromApp: 0,
    };
  }
  if (preferred === "app") {
    const nextApp = Math.max(0, app - cost);
    return {
      nextBalance: {
        ...balance,
        total: Math.max(0, prevTotal - cost),
        cash,
        app: nextApp,
        lastOperation: "purchase",
        updatedAt: new Date().toISOString(),
      },
      paidFromCash: 0,
      paidFromApp: Number((app - nextApp).toFixed(2)),
    };
  }
  const remainingAfterCash = Math.max(0, cost - cash);
  const nextCash = Math.max(0, cash - cost);
  const nextApp = Math.max(0, app - remainingAfterCash);
  return {
    nextBalance: {
      ...balance,
      total: Math.max(0, prevTotal - cost),
      cash: nextCash,
      app: nextApp,
      lastOperation: "purchase",
      updatedAt: new Date().toISOString(),
    },
    paidFromCash: Number((cash - nextCash).toFixed(2)),
    paidFromApp: Number((app - nextApp).toFixed(2)),
  };
}
