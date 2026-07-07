// Admin role structure (PRD 11) — frontend mirror of the backend matrix in
// ugc-b/Backend/utils/adminRoles.js. Used to gate sidebar tabs and action
// buttons. Keep the two in sync.

export const ADMIN_ROLES = ['founder', 'ops_senior', 'ops_regular', 'finance', 'custom'];

export const ROLE_LABELS = {
  founder: 'Founder / Admin',
  ops_senior: 'Ops (Senior)',
  ops_regular: 'Ops (Regular)',
  finance: 'Finance',
  custom: 'Custom Admin',
};

export const DISPUTE_CAP = {
  founder: Infinity,
  ops_senior: 100000,
  ops_regular: 25000,
  finance: 0,
  custom: 25000,
};

// Human labels for every grantable capability (the custom-admin toggle list).
export const CAP_LABELS = {
  review_applications: 'Review applications',
  manage_deals: 'Manage deals',
  rule_disputes: 'Rule disputes',
  manage_shipping: 'Manage shipping',
  release_payouts: 'Release payouts',
  adjust_wallet: 'Adjust wallet balances',
  warn_suspend_users: 'Warn / suspend users',
  ban_users: 'Ban users',
  view_financials: 'View financials',
  generate_reports: 'Generate reports',
  export_tax: 'Export tax docs',
  user_management: 'User management',
  content_moderation: 'Content moderation',
  view_audit: 'View audit log',
  manage_roles: 'Manage team & roles',
};
export const ALL_CAPS = Object.keys(CAP_LABELS);

// Data-scope options for a custom admin.
export const SCOPE_LABELS = {
  all: 'All users (creators & brands)',
  creator: 'Creators only',
  business: 'Brands only',
};

const CAPS = {
  founder: ['*'],
  ops_senior: [
    'review_applications', 'manage_deals', 'rule_disputes', 'manage_shipping',
    'release_payouts', 'adjust_wallet', 'warn_suspend_users', 'view_financials',
    'generate_reports', 'user_management', 'content_moderation', 'view_audit',
  ],
  ops_regular: [
    'review_applications', 'manage_deals', 'rule_disputes', 'manage_shipping',
    'release_payouts', 'generate_reports', 'content_moderation', 'view_audit',
  ],
  finance: ['view_financials', 'generate_reports', 'export_tax', 'view_audit'],
  custom: [], // resolved from the user's own admin_caps
};

// Admins with no explicit admin_role resolve to founder (legacy single-admin installs).
export const normalizeRole = (role) => (ADMIN_ROLES.includes(role) ? role : 'founder');

// `user` may be the auth user object or a raw admin_role string. Custom admins
// carry their own capability list on the object (user.admin_caps).
export const can = (user, capability) => {
  const isObj = user && typeof user === 'object';
  const role = normalizeRole(isObj ? user.admin_role : user);
  if (role === 'custom') return isObj ? (user.admin_caps || []).includes(capability) : false;
  const caps = CAPS[role] || [];
  return caps.includes('*') || caps.includes(capability);
};

export const isFounder = (user) => normalizeRole(typeof user === 'string' ? user : user?.admin_role) === 'founder';

// Data scope helpers ('all' | 'creator' | 'business').
export const scopeOf = (user) => (user && user.admin_role === 'custom' ? (user.admin_scope || 'all') : 'all');

// Reference matrix for the Role structure UI (mirrors the PRD table).
export const ROLE_MATRIX = [
  {
    role: 'ops_regular',
    canDo: 'Review applications, resolve disputes up to ₹25K, manage shipping, release standard payouts',
    cannotDo: 'Edit commission rates, modify T&Cs, ban users, override dispute rulings',
  },
  {
    role: 'ops_senior',
    canDo: 'All Regular Ops + disputes up to ₹1L, warn/suspend users, adjust wallet balances',
    cannotDo: 'Ban users, edit platform settings, modify financial policies',
  },
  {
    role: 'founder',
    canDo: 'All operations with no restrictions, audit trail override, platform settings',
    cannotDo: '—',
  },
  {
    role: 'finance',
    canDo: 'View all financial data, generate reports, export tax docs',
    cannotDo: 'User management, dispute rulings, content moderation',
  },
  {
    role: 'custom',
    canDo: 'Exactly the features you enable, limited to the chosen data scope (all / creators / brands)',
    cannotDo: 'Anything you leave unchecked, or the other side of the marketplace when scoped',
  },
];
