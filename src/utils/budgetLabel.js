const inr = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

// Budget text for a campaign card / header. GET /campaigns has no escrow figure, so the old
// "spent / total" pair printed budget_min as money already spent. Show the budget itself:
// one amount when fixed (min === max), otherwise the range.
export function budgetLabel(min, max) {
  const lo = Number(min || 0);
  const hi = Number(max || 0);
  if (!lo || !hi || lo === hi) return inr(lo || hi);
  return `${inr(lo)} - ${inr(hi)}`;
}
