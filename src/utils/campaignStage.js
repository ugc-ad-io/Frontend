// Campaign lifecycle shown as a 6-step bar (design boards 01 / 04 / 05).
export const STAGE_LABELS = ['Brief', 'Bids', 'Shipped', 'Filming', 'Review', 'Done'];

const has = (v) => Array.isArray(v) ? v.length > 0 : Boolean(v);

// Campaigns with nothing to ship (digital product, service, app) skip the "Shipped" step: 5 steps, not 6.
export const stageLabelsFor = (requiresShip) => (requiresShip ? STAGE_LABELS : STAGE_LABELS.filter((l) => l !== 'Shipped'));
// Position of a full 6-step index (idx) inside the labels that are actually shown.
export const stageIndexFor = (idx, requiresShip) => (requiresShip || idx <= 2 ? idx : idx - 1);

// `shipped` is true once a tracking record exists for the hired creator; callers that
// haven't loaded shipments pass undefined and a shipping campaign sits on "Shipped".
export function campaignStage(c, shipped) {
  const requiresShip = Boolean(c.requires_shipment || c.shipment_option === 'yes');
  const hired = has(c.selected_creator) || has(c.selected_creators);
  const status = c.status;
  let idx = 0;
  if (['draft', 'pending_approval', 'rejected', 'paused', 'cancelled'].includes(status)) idx = 0;
  else if (status === 'completed') idx = 5;
  else if (status === 'work_submitted' || status === 'awaiting_brand_confirmation') idx = 4;
  else if (hired) idx = requiresShip && !shipped ? 2 : 3;
  else if ((c.bids || []).length > 0) idx = 1;
  // idx stays the full 6-step position (pills / CTAs rely on it); labels / shownIdx / step / total are what to draw.
  const labels = stageLabelsFor(requiresShip);
  const shownIdx = stageIndexFor(idx, requiresShip);
  return { idx, label: labels[shownIdx], step: shownIdx + 1, total: labels.length, labels, shownIdx };
}

// Status pill (label + palette) as drawn on the boards.
export function campaignPill(c, shipped) {
  const { idx } = campaignStage(c, shipped);
  const bids = (c.bids || []).length;
  if (c.status === 'completed') return { text: 'Completed', tone: 'ok' };
  if (c.status === 'draft') return { text: 'Draft', tone: 'muted' };
  if (c.status === 'pending_approval') return { text: 'In review', tone: 'muted' };
  if (idx === 4) return { text: 'Delivered', tone: 'warn' };
  if (idx === 2) return { text: 'Awaiting shipment', tone: 'bad' };
  if (idx === 3) return { text: 'In progress', tone: 'info' };
  return { text: bids ? `${bids} bid${bids === 1 ? '' : 's'}` : 'Choosing creator', tone: 'info' };
}

export function campaignCta(c, shipped) {
  const { idx } = campaignStage(c, shipped);
  if (c.status === 'completed') return { label: 'Download', to: '/dashboard/business/work-review' };
  if (idx === 4) return { label: 'Review video', to: '/dashboard/business/work-review' };
  if (idx === 2) return { label: 'Add tracking', to: '/dashboard/business/shipments' };
  if (idx === 1) return { label: 'Compare bids', to: '/dashboard/business/pending-bids' };
  return { label: 'View', to: `/dashboard/business/campaign/${c.id}` };
}

export const budgetText = (c) => {
  const lo = Number(c.budget_min || c.per_video_budget || 0);
  const hi = Number(c.budget_max || 0);
  const k = (n) => (n >= 1000 ? `${+(n / 1000).toFixed(1)}k` : String(n));
  if (lo && hi && lo !== hi) return `₹${k(lo)}–${k(hi)}`;
  const one = lo || hi || Number(c.total_budget || 0);
  return one ? `₹${one.toLocaleString('en-IN')}` : '';
};
