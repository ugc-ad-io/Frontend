// Turn a raw campaign document into the normalized "brief" shape the creator
// marketplace renders (cards + BriefDetailDrawer). Shared by Browse Campaigns
// and Saved Campaigns so both show identical data for the same campaign.

const formatMoney = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

// "11 min ago" style relative time for the card header. Takes a ms timestamp.
export function timeAgo(ms) {
  if (!ms) return '';
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60); if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30); if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export const getCampaignBudget = (c) => {
  if (!c) return 'Rs. 0';
  const min = c.budget_min ?? c.budget ?? 0;
  const max = c.budget_max ?? min;
  return min === max ? formatMoney(min) : `${formatMoney(min)} - ${formatMoney(max)}`;
};

// The card preview should read like a sentence — not the raw "Label: value" brief
// dump. Prefer the product description, else pull the "Product description:" line
// out of the brief, else a generic line.
export function cardDescription(c) {
  if (c.product_description && c.product_description.trim()) return c.product_description.trim();
  const text = String(c.brief_text || '');
  const m = text.match(/product description:\s*([^\n]+)/i)
    || text.match(/key message:\s*([^\n]+)/i)
    || text.match(/hook:\s*([^\n]+)/i);
  if (m) return m[1].trim();
  // If the brief isn't the structured label format, use its first real line.
  const firstLine = text.split('\n').map((l) => l.trim()).find(Boolean);
  if (firstLine && !/^[a-z ]{2,28}:/i.test(firstLine)) return firstLine;
  return 'Create engaging UGC content for this brand.';
}

// A short, human line describing what the creator must deliver — e.g.
// "1× Reel · 9:16 · under 30s". Prefers an explicit deliverables field/items,
// else composes one from the campaign's format fields.
export function summarizeDeliverables(c) {
  if (!c) return '';
  if (Array.isArray(c.deliverable_items) && c.deliverable_items.length) {
    const parts = c.deliverable_items
      .map((d) => (typeof d === 'string' ? d : (d.label || d.type || d.name || '')))
      .filter(Boolean);
    if (parts.length) return parts.slice(0, 2).join(', ');
  }
  if (c.deliverables && String(c.deliverables).trim()) {
    return String(c.deliverables).split(/[\n;]+/).map((s) => s.trim()).filter(Boolean)[0] || '';
  }
  const qty = c.video_count || c.quantity || c.deliverable_count || 1;
  const fmt = c.video_format || c.content_format || c.deliverable_type;
  const aspect = c.aspect_ratio;
  const secs = Number(c.duration_seconds);
  const dur = secs ? (secs < 60 ? `under ${secs}s` : `${Math.round(secs / 60)} min`) : (c.duration || '');
  const parts = [];
  if (fmt) parts.push(`${qty}× ${fmt}`);
  if (aspect) parts.push(aspect);
  if (dur) parts.push(dur);
  return parts.join(' · ');
}

export default function normalizeBrief(c, index = 0, myBids = []) {
  const objectives = Array.isArray(c.objectives) ? c.objectives.filter(Boolean) : [];
  const hasBid = myBids.some((b) => b.id === c.id);
  const budgetMax = Number(c.budget_max ?? c.budget ?? 0);
  const matchScore = Math.min(98, 76 + objectives.length * 4 + (c.requires_shipment ? 3 : 0) + (index % 3) * 2);
  const d = c.estimated_delivery_days || c.delivery_days;
  return {
    campaign: c,
    id: c.id || c._id,
    title: c.title,
    description: cardDescription(c),
    // Creators see the brand's COMPANY name (as entered on the form) — never the
    // auto-generated "@nickname" handle. Prefer the real business/brand name and
    // always strip a leading "@" so a nickname-only brand still reads as a name.
    brand: String(
      c.brand_name || c.business_name || c.company_name || c.business_nickname || c.brand_handle || 'Brand'
    ).replace(/^@+/, '').trim() || 'Brand',
    logo: c.brand_logo,
    image_url: c.image_url || c.cover_image || '',
    tags: objectives.length ? objectives.slice(0, 2) : [(c.industry_type || 'UGC'), 'UGC Video'],
    budget: getCampaignBudget(c),
    budgetMax,
    deliveryLabel: d ? `${d} Days` : '3 - 5 Days',
    deliveryDays: Number(d) || 5,
    deliverables: summarizeDeliverables(c),
    matchScore,
    hasBid,
    createdAt: c.created_at ? new Date(c.created_at).getTime() : 0,
    industryType: (c.industry_type || '').toLowerCase(),
  };
}
