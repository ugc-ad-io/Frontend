// Turn a raw campaign document into the normalized "brief" shape the creator
// marketplace renders (cards + BriefDetailDrawer). Shared by Browse Campaigns
// and Saved Campaigns so both show identical data for the same campaign.

const formatMoney = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

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
    matchScore,
    hasBid,
    createdAt: c.created_at ? new Date(c.created_at).getTime() : 0,
    industryType: (c.industry_type || '').toLowerCase(),
  };
}
