// A creator's own price per video, read from GET /api/profile/{id}. This is the SAME derivation
// PlanBrief uses for a private brief (flat rate card first, then the cheapest portfolio card,
// since web-onboarded creators only have per-card prices), so a brief sent from the
// multi-creator page is priced exactly like one sent from the creator's profile.
const digits = (v) => parseInt(String(v ?? '').replace(/[^0-9]/g, ''), 10) || 0;

export function creatorRateFromProfile(data) {
  const p = data?.profile || {};
  const rc = p.rate_card || {};
  let price = digits(rc.raw_payout || rc.expected_payout || rc.last_salary);
  if (!price) {
    const cards = data?.portfolio || p.portfolio_items || p.portfolio || [];
    const prices = (Array.isArray(cards) ? cards : [])
      .map((c) => digits(c?.price || c?.price_per_video))
      .filter((n) => n > 0);
    if (prices.length) price = Math.min(...prices);
  }
  return { price, editing: digits(rc.editing_payout) || 0 };
}
