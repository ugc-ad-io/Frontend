import { matchPath } from 'react-router-dom';

// Phone screens live in src/app/screens/<role>/<Name>.js (default export = the screen).
// A screen is used only when its file exists AND the route below points at it, so unfinished
// screens simply fall back to the website page.
// Only <role>/<CapitalisedName>.js files are screens: helpers (campaignKit.js) and *.test.js stay out of the bundle.
// jest has no require.context, so tests that import App get an empty screen list.
let ctx;
try {
  ctx = require.context('./screens', true, /^\.\/(brand|creator|shared)\/[A-Z][A-Za-z]*\.js$/, 'lazy');
} catch (e) {
  ctx = Object.assign(() => Promise.reject(new Error('no app screens in this environment')), { keys: () => [] });
}
const available = new Set(ctx.keys().map((k) => k.replace(/^\.\//, '').replace(/\.js$/, '')));

export const loadAppScreen = (name) => ctx(`./${name}.js`);

const BRAND = ['business'];
const CREATOR = ['creator'];
const BOTH = ['creator', 'business'];

// [path pattern, screen name, roles that get this screen (null = public)]
export const APP_ROUTES = [
  // Brand
  ['/brand-home', 'brand/Home', BRAND],
  ['/dashboard/business/browse-creator', 'brand/Creators', BRAND],
  ['/dashboard/business/creator/:id', 'brand/CreatorProfile', BRAND],
  ['/dashboard/business/saved-creators', 'brand/Saved', BRAND],
  ['/dashboard/business/all-campaigns', 'brand/Campaigns', BRAND],
  ['/dashboard/business/campaign/:id', 'brand/CampaignDetail', BRAND],
  ['/dashboard/business/pending-bids', 'brand/Bids', BRAND],
  ['/dashboard/business/work-review', 'brand/WorkReview', BRAND],
  ['/dashboard/business/wallet', 'brand/Wallet', BRAND],
  ['/dashboard/business/shipments', 'brand/Shipments', BRAND],
  ['/dashboard/business/sent-briefs', 'brand/SentBriefs', BRAND],
  ['/dashboard/business/reviews', 'brand/Reviews', BRAND],
  ['/dashboard/business/post-brief', 'brand/PostCampaign', BRAND],
  ['/dashboard/business/multi-brief', 'brand/MultiBrief', BRAND],
  ['/profile-setup/business', 'brand/Signup', BRAND],
  ['/dashboard/business/plans', 'brand/Plans', BRAND],
  ['/dashboard/business/edit-addon', 'brand/EditAddon', BRAND],
  ['/dashboard/business/invoice/:id', 'brand/Invoice', BRAND],
  // Creator
  ['/dashboard/creator', 'creator/Home', CREATOR],
  ['/browse-briefs', 'creator/Briefs', CREATOR],
  ['/saved', 'creator/SavedBriefs', CREATOR],
  ['/my-bids', 'creator/Bids', CREATOR],
  ['/portfolio', 'creator/Profile', CREATOR],
  ['/my-deals', 'creator/Orders', CREATOR],
  ['/my-active-work', 'creator/Orders', CREATOR],
  ['/withdrawal', 'creator/Earnings', CREATOR],
  ['/profile', 'creator/Profile', CREATOR],
  ['/reviews', 'creator/Reviews', CREATOR],
  ['/kyc', 'creator/Kyc', CREATOR],
  ['/profile-setup/creator', 'creator/Setup', CREATOR],
  ['/creator/signup', 'creator/Signup', null],
  // Shared by both roles (the screen reads the role itself)
  ['/messages', 'shared/Messages', BOTH],
  ['/notifications', 'shared/Notifications', BOTH],
  ['/settings', 'shared/Settings', BOTH],
  ['/auth', 'shared/Auth', null],
  ['/campaign/:id', 'shared/CampaignView', BOTH],
  ['/shipment', 'shared/Shipment', BOTH],
  ['/disputes/:id', 'shared/Dispute', BOTH],
  ['/team/accept', 'shared/TeamAccept', null],
  ['/terms', 'shared/Legal', null],
  ['/privacy-policy', 'shared/Legal', null],
  ['/cookie-policy', 'shared/Legal', null],
  ['/community-guidelines', 'shared/Legal', null],
  ['/creator-brand-agreement', 'shared/Legal', null],
];

// The screen for this URL, or null (fall back to the website page).
export function findAppScreen(pathname, role) {
  for (const [pattern, name, roles] of APP_ROUTES) {
    if (!available.has(name)) continue;
    if (!matchPath({ path: pattern, end: true }, pathname)) continue;
    if (roles && !roles.includes(role)) continue;
    return { name, roles };
  }
  return null;
}
