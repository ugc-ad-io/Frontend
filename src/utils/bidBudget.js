const moneyNumber = (value) => {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = String(value).trim().toLowerCase().replace(/,/g, '');
  const match = text.match(/(\d+(?:\.\d+)?)\s*(k|l|lac|lakh)?/);
  if (!match) return 0;
  const amount = Number(match[1]);
  if (match[2] === 'k') return amount * 1000;
  if (['l', 'lac', 'lakh'].includes(match[2])) return amount * 100000;
  return amount;
};

export const maxCampaignBid = (brief) => {
  const campaign = brief?.campaign || brief || {};
  const explicit = [
    campaign.budget_max,
    campaign.max_budget,
    campaign.budget?.max,
    brief?.budgetMax,
  ].map(moneyNumber).find((value) => value > 0);
  if (explicit) return explicit;

  const raw = campaign.budget_range ?? campaign.budget ?? brief?.budget ?? '';
  const amounts = String(raw)
    .split(/\s*(?:-|–|—|to)\s*/i)
    .map(moneyNumber)
    .filter((value) => value > 0);
  return amounts.length ? Math.max(...amounts) : 0;
};

export const bidOverBudgetMessage = (maximum) => (
  `Your bid cannot exceed the campaign budget of ₹${Number(maximum).toLocaleString('en-IN')}.`
);
