/** يُبث بعد أي تعديل على localStorage `storeBalance` حتى تتحدث لوحات مثل الرئيسية دون انتظار focus */
export const STORE_BALANCE_CHANGED = "pharmacy-store-balance-changed";

export function notifyStoreBalanceChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(STORE_BALANCE_CHANGED));
}

/**
 * خصم تكلفة شراء/توريد من رصيد المحل المحلي.
 * @param {{ total?: number; cash: number; app: number; [k: string]: unknown }} balance
 * @param {number} cost
 * @param {{ allowNegativeTreasury?: boolean }} opts — سوبر كاشير: يُسمح بعجز في النقد ليظهر للمدير في الخزنة
 */
export function debitStoreBalanceForPurchase(balance, cost, opts = {}) {
  const allow = Boolean(opts.allowNegativeTreasury);
  const cash = Number(balance.cash || 0);
  const app = Number(balance.app || 0);
  const prevTotal = Number(balance.total != null ? balance.total : cash + app);
  if (allow) {
    const nextCash = cash - cost;
    return {
      nextBalance: {
        ...balance,
        cash: nextCash,
        app,
        total: prevTotal - cost,
        lastOperation: "purchase",
        updatedAt: new Date().toISOString(),
      },
      paidFromCash: Number(cost.toFixed(2)),
      paidFromApp: 0,
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
