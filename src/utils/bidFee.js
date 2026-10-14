// What UGC.ad keeps from a creator's bid. The rate is the server's (GET /creator/bid-readiness
// → commission_percent); this default is only the display fallback when that call fails.
export const DEFAULT_COMMISSION_PERCENT = 20;

// { gross, fee, net } in rupees (2 dp), or null when there's no usable amount yet.
export function feeBreakdown(amount, percent = DEFAULT_COMMISSION_PERCENT) {
  const gross = Number(amount);
  const pct = Number(percent);
  if (!Number.isFinite(gross) || gross <= 0 || !Number.isFinite(pct) || pct < 0) return null;
  const fee = Math.round(gross * pct) / 100;
  return { gross, fee, net: Math.round((gross - fee) * 100) / 100 };
}

export const inr = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

// "20" for 20, "12.5" for 12.5 — no trailing zeros in the copy.
export const pctLabel = (percent) => String(Number(percent));
