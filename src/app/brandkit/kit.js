// Non-visual helpers shared by the brand discovery screens (Home, Creators, Creator profile, Saved).
// Ported 1:1 from src/pages/BrandCreators.js (the website page is not imported: it pulls in global css).
import { s3Preview } from '../../utils/mediaPreview';
import { creatorFirstName } from '../../utils/displayName';

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
export const API = `${BACKEND_URL}/api`;

export const assetUrl = (u) => (!u ? '' : (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}/${String(u).replace(/^\//, '')}`));
export const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
export const titleCase = (v) => String(v || '').replace(/_/g, ' ').replace(/^./, (m) => m.toUpperCase());

// The directory has shipped with a few response envelopes across backend versions.
export const creatorListFrom = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const key of ['creators', 'items', 'results', 'data']) {
    if (Array.isArray(payload[key])) return payload[key];
    if (payload[key] && typeof payload[key] === 'object') {
      const nested = creatorListFrom(payload[key]);
      if (nested.length) return nested;
    }
  }
  return [];
};

// One sentence for a failed request: offline wording when there was no response at all.
export const loadErrorText = (err, fallback) => {
  if (err && !err.response) return "You're offline or the server can't be reached. Check your connection and try again.";
  const d = err?.response?.data;
  return (typeof d?.detail === 'string' && d.detail) || d?.message || fallback;
};

export const isVideo = (u) => {
  const path = String(u || '').split(/[?#]/, 1)[0];
  if (/\.(jpe?g|png|gif|webp|avif|svg|bmp|heic)$/i.test(path)) return false;
  return /\.(mp4|webm|mov|m4v|avi|mkv|3gp)$/i.test(path) || /\/video\/upload\//i.test(path);
};
// Anything a <video> can take: a known clip extension, or an extensionless CDN url. Images and blob: urls are out.
export const playable = (u) => {
  const s = String(u || '');
  if (!s || s.startsWith('blob:')) return false;
  return !/\.(jpe?g|png|gif|webp|avif|svg|bmp|heic)$/i.test(s.split('?')[0]);
};
// Portfolio items may be plain URL strings or rich objects ({ urls, videoUrl, ... }).
export const pfUrl = (it) => {
  if (!it) return '';
  if (typeof it === 'string') return it;
  return it.video_url || it.videoUrl || it.link || it.original_url
    || (Array.isArray(it.urls) && it.urls.find(isVideo))
    || it.url || (typeof it.video === 'string' && /^(https?:\/\/|\/)/i.test(it.video) ? it.video : '') || '';
};
export const creatorVideoUrl = (c) => {
  if (c?.portfolio_video && playable(c.portfolio_video)) return c.portfolio_video;
  const clips = (Array.isArray(c?.portfolio) ? c.portfolio : []).map(pfUrl).filter((u) => u && (isVideo(u) || playable(u)));
  if (clips.length) return clips[0];
  const preview = c?.portfolio_preview;
  return preview && isVideo(preview) ? preview : '';
};
const cloudinaryPoster = (url) => {
  const m = String(url || '').match(/^(https?:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/)(.*)$/i);
  return m ? `${m[1]}so_0/${m[2].replace(/\.(mp4|mov|webm|m4v|avi|mkv|3gp)(\?.*)?$/i, '.jpg')}` : '';
};
export const videoPoster = (url) => s3Preview(url, 'jpg') || cloudinaryPoster(url);
export const browserCompatibleVideoUrl = (url) => {
  const media = assetUrl(url);
  if (!/^https?:\/\/res\.cloudinary\.com\//i.test(media) || !/\/video\/upload\//i.test(media)
    || /\/video\/upload\/f_mp4,vc_h264,/i.test(media)) return media;
  return media.replace('/video/upload/', '/video/upload/f_mp4,vc_h264,q_auto:good,h_480,c_scale,ac_none,du_2/');
};
export const previewVideoUrl = (url) => s3Preview(url, 'mp4') || browserCompatibleVideoUrl(url);

// Brands never see a creator's real name: show the brand-facing handle (nickname) or public id.
export const nameOf = (c) => creatorFirstName(c).replace('@', '');
export const initialOf = (c) => (nameOf(c).charAt(0) || 'C').toUpperCase();
export const catOf = (c) => (c.primary_category || c.category || c.niche || 'UGC').replace(/_/g, ' ');
export const catsOf = (c) => (c.categories?.length ? c.categories : [c.primary_category])
  .map((v) => String(v || '').trim().toLowerCase()).filter(Boolean);

export const CATEGORIES = ['Beauty', 'Skincare', 'Fashion', 'Fitness', 'Food & Drinks', 'Tech & Gadgets', 'Lifestyle', 'Travel', 'Home', 'Pets', 'Apps'];
const CATEGORY_ALIASES = {
  'food & drinks': ['food', 'drink', 'beverage'],
  'tech & gadgets': ['tech', 'gadget', 'electronic'],
  skincare: ['skin', 'beauty'],
  apps: ['app'],
  pets: ['pet'],
};
export const matchesCategory = (cats, label) => {
  const key = String(label || '').toLowerCase();
  const tokens = CATEGORY_ALIASES[key] || [key];
  return cats.some((cat) => tokens.some((t) => cat.includes(t)));
};

export const budgetOf = (c) => {
  const raw = c.budget_range || c.price || c.rate || c.expected_payout || (c.rate_card || {}).expected_payout || '';
  const n = parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
// Delivery time in days; null (nothing shown) until the directory reports it.
export const deliveryDaysOf = (c) => {
  const n = Math.round(Number(c.delivery_days ?? c.turnaround_days ?? c.profile?.delivery_days ?? c.profile?.rate_card?.delivery_days));
  return n > 0 ? n : null;
};

export const BUDGET_OPTIONS = [
  { key: 'any', label: 'Any', test: () => true },
  { key: 'u3', label: 'Under ₹3,000', test: (n) => n > 0 && n < 3000 },
  { key: '3-6', label: '₹3,000–6,000', test: (n) => n >= 3000 && n < 6000 },
  { key: '6-10', label: '₹6,000–10,000', test: (n) => n >= 6000 && n < 10000 },
  { key: '10+', label: '₹10,000+', test: (n) => n >= 10000 },
];
const LEVEL_RANK = { new: 0, verified: 0, l1: 1, l2: 2, elite: 3 };
export const DETAIL_OPTIONS = [
  { key: 'any', label: 'Any', test: () => true },
  { key: 'verified', label: 'Verified', test: (c) => !!c.kyc_verified },
  { key: 'l1', label: 'Level 1+', test: (c) => (LEVEL_RANK[String(c.level).toLowerCase()] || 0) >= 1 },
  { key: 'l2', label: 'Level 2+', test: (c) => (LEVEL_RANK[String(c.level).toLowerCase()] || 0) >= 2 },
  { key: 'elite', label: 'Elite', test: (c) => String(c.level).toLowerCase() === 'elite' },
  { key: 'choice', label: 'UGCAD.IO Choice', test: (c) => !!c.ugcad_approved },
];

// Level -> badge (UGCAD.IO Choice outranks the creator's level).
export const REEL_BADGE = { choice: 'UGCAD.IO Choice', elite: 'Elite', l2: 'Level 2', l1: 'Level 1', verified: 'Verified', new: 'New' };
export const reelBadgeKey = (c) => {
  if (c.ugcad_approved) return 'choice';
  const k = String(c.level || '').toLowerCase();
  return REEL_BADGE[k] ? k : 'new';
};
