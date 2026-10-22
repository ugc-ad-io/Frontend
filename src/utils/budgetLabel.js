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

// A saved draft often carries only the per-video figure, so the header total falls back to
// per-video x deliverables x creators instead of Rs. 0 (same rule as the app). 0 = not set yet.
export function draftTotalBudget(c) {
  const total = Number(c?.budget || c?.total_budget) || 0;
  if (total > 0) return total;
  const perVideo = Number(c?.per_video_budget || c?.budget_max) || 0;
  const items = Array.isArray(c?.deliverable_items) ? c.deliverable_items : [];
  const quantity = items.reduce((sum, d) => sum + Math.max(1, Number(d?.quantity) || 1), 0);
  const creators = Math.max(1, Number(c?.creators_wanted) || 1);
  return perVideo * Math.max(1, quantity) * creators;
}
