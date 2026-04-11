/** تمييز الأرقام السالبة (خزنة، أرصدة، أرباح…) باللون الأحمر للفت الانتباه */

export function isNegativeAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) && n < 0;
}

/** لدمجها في `sx` على Typography أو Box — عند سالب يطغى اللون الأحمر على `extra` */
export function negativeAmountTextSx(value, extra = {}) {
  if (!isNegativeAmount(value)) return extra;
  return { ...extra, color: "error.main", fontWeight: 900 };
}

/** لـ Chip: لون الخلفية عند العجز */
export function chipColorForBalance(value, positiveColor = "success") {
  return isNegativeAmount(value) ? "error" : positiveColor;
}
