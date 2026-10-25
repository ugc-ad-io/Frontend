// Small shared helpers for the creator "Find briefs" screens (cards, detail, applied, invites).
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

const LOGO_COLORS = ['#07074E', '#B45309', '#9D174D', '#0F766E', '#2A3AB8', '#6D28D9'];

/** Same brand name -> same logo colour (stable, no data needed). */
export const brandColor = (name) => {
  let h = 0;
  for (const ch of String(name || 'B')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return LOGO_COLORS[h % LOGO_COLORS.length];
};

export const initialOf = (name) => (name || 'B').trim().charAt(0).toUpperCase();
export const assetUrl = (u) => (!u ? '' : (String(u).startsWith('http') ? u : `${BACKEND_URL}${u}`));
export const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

/** "₹5,000–12,000" or a single "₹5,000". */
export const budgetRange = (c) => {
  const min = Number(c?.budget_min ?? c?.budget ?? 0);
  const max = Number(c?.budget_max ?? min);
  return min === max || !min ? inr(max || min) : `${inr(min)}–${inr(max)}`;
};

/** Price line for a normalized brief (saved snapshots have no raw campaign, only the old "Rs." text). */
export const briefPay = (b) => (b?.campaign
  ? budgetRange(b.campaign)
  : (String(b?.budget || '').replace(/Rs\.\s?/g, '₹').replace(/\s-\s/g, '–') || inr(b?.budgetMax)));

/** Brand logo tile: uploaded logo if there is one, else a coloured initial. */
export function BriefLogo({ name, src, className = 'cui-b-logo' }) {
  return (
    <span className={className} style={src ? undefined : { background: brandColor(name) }}>
      {src ? <img src={assetUrl(src)} alt="" /> : initialOf(name)}
    </span>
  );
}

/** Real facts for the 4-cell strip on a card. Cells with no data are dropped by the caller. */
export function briefFacts(b) {
  const c = b?.campaign || {};
  const items = Array.isArray(c.deliverable_items) ? c.deliverable_items : [];
  const qty = items.reduce((s, d) => s + Math.max(1, Number(d?.quantity) || 1), 0);
  const type = items.map((d) => d?.type).find(Boolean);
  const format = items.length ? `${qty} ${type || 'video'}${qty > 1 && type && !/s$/i.test(type) ? 's' : ''}` : (b?.deliverables || '');
  const length = items.map((d) => d?.duration).find(Boolean) || '';
  const lang = Array.isArray(c.language) ? c.language.join(' / ') : (c.language || '');
  const product = c.requires_shipment === true ? 'Shipped to you' : (c.requires_shipment === false ? 'No shipment' : '');
  return [['Format', format], ['Length', length], ['Language', lang], ['Product', product]].filter(([, v]) => v);
}

/** "Due in 3 days" from the brief's real delivery deadline; '' when it states none. */
export const dueLabel = (b) => {
  const d = b?.deliveryDays;
  if (d == null) return '';
  return d === 0 ? 'Due today' : `Due in ${d} ${d === 1 ? 'day' : 'days'}`;
};

export const bidCount = (b) => (Array.isArray(b?.campaign?.bids) ? b.campaign.bids.length : null);
