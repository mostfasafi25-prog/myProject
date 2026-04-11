/** يُبث بعد أي تعديل على localStorage `storeBalance` حتى تتحدث لوحات مثل الرئيسية دون انتظار focus */
export const STORE_BALANCE_CHANGED = "pharmacy-store-balance-changed";

export function notifyStoreBalanceChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(STORE_BALANCE_CHANGED));
}
