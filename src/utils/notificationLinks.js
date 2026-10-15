const LEGACY_LINK_MAP = {
  '/deals': '/my-deals',
  '/payouts': '/withdrawal',
  '/creator-dashboard': '/dashboard/creator',
  '/dashboard/creator/inbox': '/messages',
  '/dashboard/business/deals': '/dashboard/business/all-campaigns',
  '/admin/match-queue': '/dashboard/admin/campaigns',
  '/admin/campaigns': '/dashboard/admin/campaigns',
  '/dashboard/admin/flagged-messages': '/dashboard/admin/flagged',
};
export const resolveNotifLink = (link) => {
  if (!link) return null;
  const [path, rest] = String(link).split(/(?=[?#])/);
  const campaign = path.match(/^\/(?:dashboard\/business\/campaigns|campaigns)\/([^/]+)$/);
  const target = campaign ? `/dashboard/business/campaign/${campaign[1]}` : LEGACY_LINK_MAP[path] || path;
  return target + (rest || '');
};
