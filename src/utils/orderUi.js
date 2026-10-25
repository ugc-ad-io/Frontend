// Small display helpers shared by the creator Orders list and the order room (design boards C04-C05, C22-C24).

export const inr = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const key = (s) => String(s || '').replace(/\s*(?:—|–|-)\s*/g, ' - ').toLowerCase();

// Tinted tile colours for a brand without a logo (picked from the brand name, stable per brand).
const TILES = [
  ['#FCE9CF', '#07074E'], ['#F3E1F7', '#6D28D9'], ['#D9F2EC', '#0F766E'], ['#E3E7FF', '#2A3AB8'], ['#F6E3D3', '#9D174D'],
];
export function brandTile(name) {
  const s = String(name || 'B');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) % 997;
  const [bg, fg] = TILES[h % TILES.length];
  return { bg, fg };
}

// Short, single-line status for a deal (list pill + room header): { label, tone }.
export function orderStatus(deal) {
  const s = key(deal?.current_state);
  if (s.includes('paid')) return { label: 'Paid', tone: 'ok' };
  if (s.includes('cancel')) return { label: 'Cancelled', tone: 'muted' };
  if (s.includes('dispute')) return { label: 'Disputed', tone: 'bad' };
  if (s.includes('damaged')) return { label: 'Issue reported', tone: 'bad' };
  if (s.includes('raw approved') && s.includes('editing')) return { label: 'Being edited', tone: 'info' };
  if (s.includes('raw approved')) return { label: 'Edit due', tone: 'info' };
  if (s.includes('approved')) return { label: 'Approved', tone: 'ok' };
  if (s.includes('revision')) return { label: 'Changes asked', tone: 'warn' };
  if (s.includes('content submitted') || s.includes('awaiting review')) return { label: 'In review', tone: 'info' };
  if (s.includes('delivered')) return { label: 'Product arrived', tone: 'warn' };
  if (s.includes('content in progress') || s.includes('received')) return { label: 'Filming', tone: 'info' };
  if (s.includes('shipped') || s.includes('transit')) return { label: 'Shipped', tone: 'info' };
  if (s.includes('awaiting creator')) return { label: 'Awaiting you', tone: 'warn' };
  if (s.includes('accepted')) return { label: 'Awaiting shipment', tone: 'info' };
  return { label: deal?.current_state || 'Active', tone: 'info' };
}

export const isPaidDeal = (d) => key(d?.current_state) === 'paid - complete';
export const isInReview = (d) => /content submitted|approved - payment|raw approved - ugc/.test(key(d?.current_state));

// "Due in 2 days" / "Due in 5h" / "Overdue" from the backend's deadline_countdown_hours. null when there is nothing to show.
export function dueLabel(deal) {
  const h = deal?.deadline_countdown_hours;
  if (typeof h !== 'number' || isPaidDeal(deal) || key(deal?.current_state).includes('cancel')) return null;
  if (deal.active_party === 'creator') {
    if (h < 0) return { text: 'Overdue', tone: 'bad' };
    if (h < 24) return { text: `Due in ${Math.max(1, Math.round(h))}h`, tone: 'warn' };
    return { text: `Due in ${Math.ceil(h / 24)} days`, tone: h < 72 ? 'warn' : 'muted' };
  }
  if (isInReview(deal) && h >= 0) return { text: `Auto-approves in ${h < 24 ? `${Math.max(1, Math.round(h))}h` : `${Math.ceil(h / 24)} days`}`, tone: 'muted' };
  return null;
}

export const shortDate = (v) => (v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '');
