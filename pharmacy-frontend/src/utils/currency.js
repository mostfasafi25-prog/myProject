/** كلمة العملة المعروضة بجانب كل رقم مالي في الموقع */
export const CURRENCY_LABEL = "شيكل";

/**
 * تنسيق مبلغ مالي مع كلمة «شيكل»
 * @param {number|string|null|undefined} amount
 * @param {{ locale?: string }} [opts]
 */
export function formatMoney(amount, opts = {}) {
  const locale = opts.locale ?? "en-US";
  if (amount == null || amount === "") return `0.00 ${CURRENCY_LABEL}`;
  const n = parseFloat(amount);
  if (Number.isNaN(n)) return `0.00 ${CURRENCY_LABEL}`;
  return `${n.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${CURRENCY_LABEL}`;
}
