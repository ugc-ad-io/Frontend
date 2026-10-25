// Maps a notification onto the brand tabs (Campaigns / Payments / Messages) and picks
// the row button label. `type` is only a tone (info|success|warning|error|message), so
// we use, in order: the backend `category` (set on some rows), type 'message', then the
// route the notification links to (the only signal present on every row).
// Returns 'campaign' | 'payment' | 'message' | 'other'.
const BY_CATEGORY = {
  payments: 'payment',
  messages: 'message',
  deal_updates: 'campaign',
  applications: 'campaign',
  delivery_address: 'campaign',
};

const pathOf = (link) => String(link || '').split(/[?#]/)[0].toLowerCase();

export const notificationCategory = (n) => {
  if (!n) return 'other';
  if (BY_CATEGORY[n.category]) return BY_CATEGORY[n.category];
  if (n.type === 'message') return 'message';
  const p = pathOf(n.link);
  if (p === '/messages' || p.startsWith('/messages/')) return 'message';
  if (/wallet|withdraw|payout|payment/.test(p)) return 'payment';
  if (/campaign|bids|work-review|shipments|\/my-deals|browse-briefs|brief/.test(p)) return 'campaign';
  return 'other';
};

// Row button label; stays "Open" unless the destination clearly implies a verb.
export const notificationAction = (n) => {
  const p = pathOf(n?.link);
  if (!p) return 'Open';
  if (p === '/messages' || p.startsWith('/messages/')) return 'Reply';
  if (p.includes('work-review')) return 'Review';
  if (p.includes('pending-bids')) return 'Compare';
  if (/wallet|withdraw|campaign|shipments/.test(p)) return 'View';
  return 'Open';
};

export const NOTIFICATION_TABS = [
  ['all', 'All'],
  ['unread', 'Unread'],
  ['campaign', 'Campaigns'],
  ['payment', 'Payments'],
  ['message', 'Messages'],
];

export const matchesNotificationTab = (n, tab) => (
  tab === 'all' || (tab === 'unread' ? !n.read : notificationCategory(n) === tab)
);
