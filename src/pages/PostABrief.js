import { useEffect, useMemo, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import publishPrivateBrief from '../utils/publishPrivateBrief';
import { uploadMedia } from '../utils/upload';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { digitsOnly, blockNonDigitKey } from '../utils/inputValidators';
import { AlertTriangle, Check, ChevronLeft, Info, Plus, Trash2, Upload } from 'lucide-react';
import { useAuth } from '../App';
import '../styles/brand-ui-postbrief.css';
import '../styles/brand-ui-mobile-b.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

// Browser storage can throw (blocked site data, in-app browsers, private tabs, full quota).
// The brief form read it during render and in effects, so one SecurityError/QuotaExceeded
// blanked the whole form on phones. Drafts are a convenience — the form must load without.
const safeStore = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* draft just isn't kept locally */ } },
  remove: (k) => { try { localStorage.removeItem(k); } catch { /* nothing to clear */ } },
};
// A reference that we hosted ourselves (came from /upload/file) rather than a
// pasted third-party link — used to label the button "Replace" and to render it
// as playable media instead of a bare link.
const isUploadedUrl = (v) => typeof v === 'string' && /\/uploads?\//i.test(v);

const DRAFT_KEY = 'ugcad-brand-brief-draft-v2';
const DRAFT_ID_KEY = 'ugcad-brand-brief-draft-id-v2';
// Which account the local draft belongs to. Browsers get shared / accounts get
// switched, and a draft left behind by another brand can't be saved by this one
// (the server 403s "You can only edit your own campaigns") and carries the wrong
// brand name — so a draft from a different user is dropped, not loaded.
const DRAFT_OWNER_KEY = 'ugcad-brand-brief-draft-owner-v2';
const COMMISSION_RATE = 0.20;

// Listing fee, tiered by the size of the brief. `creators` is creators_wanted and
// `deliverables` is the TOTAL number of assets asked for (the sum of every row's
// quantity), so 1 creator x 3 Reels counts as 3 deliverables, not 1.
//   1 creator,  1 deliverable      -> Rs. 500
//   1 creator,  2+ deliverables    -> Rs. 1,500
//   2–10 creators                  -> Rs. 1,500
//   11+ creators                   -> Rs. 3,000
// Mirrors campaign_listing_fee() in the backend's server.py — keep the two in sync;
// the backend is what actually debits the wallet.
function listingFeeFor(creators, deliverables) {
  // Charged ONCE per brief — it never multiplies by the number of creators hired.
  const c = Math.max(1, Number(creators) || 1);
  const d = Math.max(1, Number(deliverables) || 1);
  if (c >= 11) return 3000;   // large multi-creator campaign
  if (c > 1) return 1500;     // multi-creator campaign (2–10)
  return d > 1 ? 1500 : 500;  // single creator: 1 deliverable vs 2+
}


// What the brand is promoting. Only a PHYSICAL product needs shipping — everything
// else skips the address/shipping/receipt steps of the deal entirely.
const PRODUCT_TYPES = [
  { value: 'physical', label: 'Physical product', hint: 'You ship an item to the creator', ships: true },
  { value: 'digital',  label: 'Digital / App',    hint: 'App, software or download - nothing to ship' },
  { value: 'service',  label: 'Service',          hint: 'A service, subscription or experience' },
  { value: 'other',    label: 'Other',            hint: 'Describe it yourself' },
];
const typeNeedsShipping = (t) => t === 'physical';

// Campaign categories. Grouped only so the <select> stays readable — CATEGORIES
// (the flat list) is what validation and matching use. Picking OTHER_CATEGORY
// opens a free-text box (form.customCategory) so a brand is never blocked by a
// niche this list doesn't cover.
const CATEGORY_GROUPS = [
  { group: 'Beauty & Personal Care', items: ['Beauty', 'Skincare', 'Haircare', 'Makeup', 'Personal Care', 'Fragrance'] },
  { group: 'Fashion & Accessories', items: ['Fashion', 'Footwear', 'Jewellery & Accessories', 'Watches & Eyewear', 'Bags & Luggage'] },
  { group: 'Health & Fitness', items: ['Fitness', 'Wellness', 'Health & Supplements', 'Sports & Outdoors', 'Healthcare & Clinics'] },
  { group: 'Food & Beverage', items: ['Food', 'Beverages', 'Restaurants & Cafes', 'Packaged Food & Snacks'] },
  { group: 'Home & Living', items: ['Home Decor', 'Kitchen & Appliances', 'Furniture', 'Cleaning & Household', 'Garden & Outdoor'] },
  { group: 'Tech & Digital', items: ['Tech', 'Mobile & Gadgets', 'Apps & Software', 'SaaS & B2B', 'Gaming', 'AI Tools'] },
  { group: 'Money & Learning', items: ['Finance & Fintech', 'Insurance', 'Education & Edtech', 'Courses & Coaching', 'Books & Stationery', 'Jobs & Careers'] },
  { group: 'Travel & Auto', items: ['Travel', 'Hotels & Stays', 'Automotive', 'Bikes & EV'] },
  { group: 'Family & Pets', items: ['Baby & Kids', 'Parenting', 'Toys & Games', 'Pets'] },
  { group: 'Lifestyle & Services', items: ['Lifestyle', 'Entertainment & Media', 'Events & Experiences', 'Real Estate', 'Astrology & Spiritual', 'NGO & Social Causes', 'Local Services'] },
];
const OTHER_CATEGORY = 'Other';
const CATEGORIES = [...CATEGORY_GROUPS.flatMap((g) => g.items), OTHER_CATEGORY];
// What actually gets stored / sent: the typed text when "Other" is picked.
const resolvedCategory = (f) => (f.category === OTHER_CATEGORY ? f.customCategory.trim() : f.category);

// The one place that decides which name a campaign is published under. Mirrors
// the backend (create_campaign reads profile.business_name), so what the wizard
// shows is what creators will see on the brief.
const brandNameOf = (profile, user) => String(
  (profile || {}).brand_name
  || (user?.profile || {}).business_name
  || user?.business_name
  || user?.full_name
  || user?.nickname
  || ''
).trim().replace(/^@+/, '');
// Map a stored category (any case / phrasing) to one of CATEGORIES so the <select>
// pre-selects it. e.g. "beauty" / "Beauty & Skincare" -> "Beauty".
const matchCategory = (...raws) => {
  const pool = CATEGORIES.filter((c) => c !== OTHER_CATEGORY);
  for (const raw of raws) {
    const s = String(raw || '').trim().toLowerCase();
    if (!s) continue;
    const hit = pool.find((c) => c.toLowerCase() === s)
      // Fuzzy-match only on something long enough to be meaningful, else a very
      // short stored value latches onto an unrelated category.
      || (s.length >= 3 && pool.find((c) => s.includes(c.toLowerCase()) || c.toLowerCase().includes(s)));
    if (hit) return hit;
  }
  return '';
};
const OBJECTIVES = ['Awareness', 'Product launch', 'Seasonal push', 'Testimonial', 'Tutorial', 'Unboxing', 'Comparison', 'Sale promotion', 'Customer education', 'Lead generation', 'Other'];
const DELIVERABLE_TYPES = ['Reel (9:16, under 30s)', 'Short-form (30-60s)', 'YouTube Short (9:16, 60s max)', 'Long-form video (2+ minutes)', 'Static post', 'Carousel post', 'Story set (3-5 frames)', 'Amazon listing video'];
const ASPECTS = ['9:16', '1:1', '16:9', '4:5'];
const CTAS = ['Visit website', 'Use code', 'Swipe up', 'Follow brand', 'None'];
// CTAs that need a link/handle value (Use code has its own promoCode field; None needs nothing).
const CTA_INPUT = {
  'Visit website': { label: 'Website link', ph: 'https://yourbrand.com', type: 'url' },
  'Swipe up': { label: 'Swipe-up link', ph: 'https://yourbrand.com/offer', type: 'url' },
  'Follow brand': { label: 'Brand handle to follow', ph: '@yourbrand', type: 'handle' },
};
// Only proper links / handles allowed — no random text.
const CTA_URL_RE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/[^\s]*)?$/i;
const CTA_HANDLE_RE = /^@?[a-z0-9._]{2,30}$/i;
const ctaLinkValid = (cta, v) => {
  const s = String(v || '').trim();
  if (!s) return false;
  const t = CTA_INPUT[cta]?.type;
  if (t === 'url') return CTA_URL_RE.test(s);
  if (t === 'handle') return CTA_HANDLE_RE.test(s) || CTA_URL_RE.test(s);
  return true;
};
// Same list the private brief (PlanBrief) offers.
const LANGUAGES = ['Hinglish', 'Hindi', 'English', 'Tamil', 'Telugu', 'Marathi', 'Bengali'];
const TONES = ['Casual', 'Energetic', 'Informative', 'Humorous', 'Aspirational', 'Authentic', 'Educational', 'Trustworthy'];
// "Any" is the no-minimum option: the brief accepts bids from every level.
// Listed first because it is the widest reach, and the field is required — so
// without it a brand with no level preference had to invent one.
const CREATOR_LEVELS = ['Any', 'New', 'Verified', 'L1', 'L2', 'Elite'];
const QUALITY_TIERS = ['A', 'A+', 'A++'];
const GENDER_OPTIONS = ['No Preference', 'Female', 'Male', 'Non-binary'];
const CITIES = ['Any City', 'Mumbai', 'Delhi NCR', 'Bengaluru', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Surat', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal', 'Visakhapatnam', 'Patna', 'Vadodara', 'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik', 'Faridabad', 'Meerut', 'Rajkot', 'Varanasi', 'Srinagar', 'Aurangabad', 'Amritsar', 'Navi Mumbai', 'Prayagraj', 'Ranchi', 'Coimbatore', 'Jabalpur', 'Gwalior', 'Vijayawada', 'Jodhpur', 'Madurai', 'Raipur', 'Kota', 'Guwahati', 'Chandigarh', 'Noida', 'Gurugram', 'Thiruvananthapuram', 'Kochi', 'Mysuru', 'Bhubaneswar', 'Dehradun', 'Mangaluru', 'Tiruchirappalli', 'Jamshedpur', 'Panaji (Goa)', 'Puducherry', 'Udaipur', 'Salem', 'Warangal', 'Guntur', 'Bhilai', 'Jalandhar', 'Bikaner', 'Siliguri', 'Nellore', 'Ajmer', 'Shimla', 'Other'];
// Picking "Any" means the brief is not niche-restricted. Stored as the only tag
// rather than as an empty list so the choice is explicit — "they didn't pick"
// and "they picked anyone" read the same otherwise.
const ANY_NICHE = 'Any';
// Niches follow the same taxonomy as the campaign category above, so a brand
// targeting "Skincare" creators and a brief filed under "Skincare" use one
// vocabulary. Keep in step with NICHE_TAGS in the app's BrandPostBrief.tsx.
const NICHE_TAGS = [ANY_NICHE, ...CATEGORY_GROUPS.flatMap((g) => g.items)];
const VIDEO_DELIVERABLES = ['Reel', 'Short-form', 'YouTube Short', 'Long-form video', 'Amazon listing video'];
const PLATFORMS = [
  "Brand's own Instagram",
  "Brand's own TikTok / Reels",
  "Brand's own YouTube",
  "Brand's own website",
  "Brand's email marketing",
  'Paid ads on Meta platforms',
  'Paid ads on Google / YouTube',
  'Paid ads on other platforms',
  'Out-of-home (billboards, print)',
  'B2B sales materials (pitch decks, demos)',
  'Third-party aggregators / marketplaces'
];

const createDeliverable = () => ({
  id: crypto.randomUUID?.() || String(Date.now()),
  type: '',
  quantity: 1,
  duration: '',
  aspectRatios: ['9:16'],
  // Raw footage is NOT a question: creators hand it over on every brief, so there is
  // nothing for the brand to choose and the old "Raw file delivery required" toggle
  // only ever produced a wrong answer. The single real question is whether a finished
  // CUT is owed on top, and that is what opens the second upload slot at submission.
  editedRequired: false,
  editedBy: 'creator'
});

const initialForm = {
  campaignName: '',
  image: '',
  brandName: '',
  category: '',
  customCategory: '',         // free text when category === 'Other'
  productType: 'physical',     // physical | digital | service | promo | other
  customProductType: '',       // free text when productType === 'other'
  productName: '',
  productDescription: '',
  campaignHook: '',
  keyMessage: '',
  objectives: [],
  targetAudience: '',
  language: 'Hinglish',
  budgetVisible: true,
  deliverables: [createDeliverable()],
  scriptProvider: 'brand',
  scriptText: '',
  productVisible: true,
  visibilitySeconds: '',
  verbalMention: true,
  productNames: '',
  requiredPhrases: [''],
  requiredShots: [''],
  callToAction: 'Visit website',
  promoCode: '',
  ctaLink: '',
  hashtags: '',
  brandHandleTag: true,
  noCompetitors: true,
  competitors: '',
  noOtherProducts: true,
  noProfanity: true,
  noPolitical: true,
  avoidFilters: false,
  filterTypes: '',
  avoidText: '',
  tones: [],
  pacing: 'No preference',
  moodImages: [],
  referenceVideos: [''],
  musicPreference: 'No preference',
  platforms: [],
  rightsDuration: '',
  exclusivity: 'None',
  whitelisting: false,
  modificationRights: '',
  productShippingBy: '',
  draftDeliveryBy: '',
  revisions: 2,
  // How many creators this brief wants to hire. The brief stays open for
  // selection until this many are picked; each pick is charged at that moment.
  creatorsWanted: 1,
  finalDeliveryBy: '',
  budgetMode: 'fixed',
  fixedBudget: '',
  editingFee: '',
  budgetMin: '',
  budgetMax: '',
  creatorLevel: '',
  qualityTier: '',
  genderPreference: 'No Preference',
  cityFilter: 'Any City',
  nicheTags: []
};

const isVideoDeliverable = (type = '') => VIDEO_DELIVERABLES.some(label => type.startsWith(label));

const parseDurationSeconds = (value = '') => {
  const match = String(value).match(/\d+/);
  return match ? Number(match[0]) : 30;
};

const addDays = (dateString, days) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};

// Best-effort restore of a server-saved draft into the rich brief form.
// localStorage holds full fidelity on the same device; this fills the key
// top-level fields so a draft can be resumed from the dashboard / another device.
function mapCampaignToForm(c) {
  if (!c || typeof c !== 'object') return {};
  const out = {};
  const put = (key, value) => { if (value !== undefined && value !== null && value !== '') out[key] = value; };
  put('campaignName', c.title);
  put('brandName', c.brand_name);
  // A stored category that isn't one of ours (older campaign, or an "Other"
  // free-text one) still has to round-trip — park it in the Other box.
  const storedCategory = String(c.product_category || c.category || '').trim();
  if (storedCategory) {
    const known = CATEGORIES.find((x) => x.toLowerCase() === storedCategory.toLowerCase() && x !== OTHER_CATEGORY);
    if (known) { out.category = known; out.customCategory = ''; }
    else { out.category = OTHER_CATEGORY; out.customCategory = storedCategory; }
  }
  if (PRODUCT_TYPES.some(p => p.value === c.product_type)) put('productType', c.product_type);
  if (c.product_type_detail) put('customProductType', c.product_type_detail);
  put('productName', c.product_name);
  put('productDescription', c.product_description);
  put('campaignHook', c.campaign_hook);
  put('keyMessage', c.key_message);
  put('pacing', c.pacing || c.tone_reference);
  put('targetAudience', c.target_audience);
  put('language', c.language);
  if (Array.isArray(c.objectives) && c.objectives.length) out.objectives = c.objectives;

  const putBool = (key, value) => { if (typeof value === 'boolean') out[key] = value; };
  const putArr = (key, value) => { if (Array.isArray(value) && value.length) out[key] = value; };

  // Must-Include
  putBool('productVisible', c.product_visible);
  put('visibilitySeconds', c.product_visible_seconds);
  putBool('verbalMention', c.verbal_mention);
  put('productNames', c.verbal_mention_text);
  putArr('requiredPhrases', c.required_phrases);
  putArr('requiredShots', c.required_shots);
  put('callToAction', c.call_to_action);
  put('ctaLink', c.cta_link);
  put('promoCode', c.promo_code);
  put('hashtags', c.hashtags);
  putBool('brandHandleTag', c.brand_handle_tag);
  // Must-Avoid
  putBool('noCompetitors', c.no_competitors);
  put('competitors', c.competitors_text);
  putBool('noOtherProducts', c.no_other_products);
  putBool('noProfanity', c.no_profanity);
  putBool('noPolitical', c.no_political);
  putBool('avoidFilters', c.avoid_filters);
  put('filterTypes', c.filter_types_text);
  put('avoidText', c.avoid_text);
  // Style Guidance
  put('musicPreference', c.music_preference);
  putArr('referenceVideos', c.reference_videos);
  putArr('moodImages', c.mood_images);
  // Usage Rights
  putArr('platforms', c.usage_platforms);
  put('rightsDuration', c.rights_duration);
  put('exclusivity', c.exclusivity);
  putBool('whitelisting', c.whitelisting);
  put('modificationRights', c.modification_rights);
  // Timeline — never carry an elapsed date into a copy/resume. Past dates are
  // dropped; shipping defaults to tomorrow (the earliest allowed) so the field
  // shows a valid date instead of a stale past one from the source brief.
  const tomorrow = addDays(new Date().toISOString().slice(0, 10), 1);
  const futureOnly = (d) => (d && String(d) >= tomorrow ? d : '');
  put('productShippingBy', futureOnly(c.product_shipping_by) || tomorrow);
  put('draftDeliveryBy', futureOnly(c.draft_delivery_by));
  putBool('budgetVisible', c.budget_visible);

  // Deliverables — prefer the structured list; fall back to the primary
  // fields + "N x Type" additional strings for older briefs.
  if (Array.isArray(c.deliverable_items) && c.deliverable_items.length) {
    out.deliverables = c.deliverable_items.map((d) => ({
      ...createDeliverable(),
      type: d.type || '',
      quantity: d.quantity || 1,
      duration: d.duration || '',
      aspectRatios: Array.isArray(d.aspect_ratios) && d.aspect_ratios.length ? d.aspect_ratios : ['9:16'],
      editedRequired: Boolean(d.edited_required),
      editedBy: d.edited_by === 'ugc' ? 'ugc' : 'creator',
    }));
  } else {
    const primaryType = c.brief_type || c.video_format;
    if (primaryType) {
      const primary = {
        ...createDeliverable(),
        type: primaryType,
        aspectRatios: c.aspect_ratio ? [c.aspect_ratio] : ['9:16'],
        duration: c.duration_seconds ? `${c.duration_seconds} seconds` : '',
      };
      const extra = (Array.isArray(c.additional_deliverables) ? c.additional_deliverables : []).map((str) => {
        const m = String(str).match(/^\s*(\d+)\s*x\s*(.+)$/i);
        return { ...createDeliverable(), quantity: m ? Number(m[1]) : 1, type: m ? m[2].trim() : String(str).trim() };
      });
      out.deliverables = [primary, ...extra];
    }
  }
  put('scriptProvider', c.script_provider === 'ugc' ? 'ugc' : 'brand');
  put('scriptText', c.script_text);
  put('finalDeliveryBy', futureOnly(c.final_delivery_by || c.due_date || c.deadline));
  put('creatorLevel', c.creator_level);
  put('qualityTier', c.content_quality_tier);
  put('genderPreference', c.gender_preference);
  put('cityFilter', c.city_filter);
  if (Array.isArray(c.creator_niche_tags) && c.creator_niche_tags.length) out.nicheTags = c.creator_niche_tags;
  if (Array.isArray(c.tone_tags) && c.tone_tags.length) out.tones = c.tone_tags;
  const revisions = c.free_revisions ?? c.revision_limit;
  if (revisions !== undefined && revisions !== null) out.revisions = Number(revisions) || 0;
  if (c.creators_wanted !== undefined && c.creators_wanted !== null) {
    out.creatorsWanted = Math.max(1, Number(c.creators_wanted) || 1);
  }
  const bMin = Number(c.budget_min || 0);
  out.editingFee = String(c.editing_fee_per_video || '');
  const bMax = Number(c.per_video_budget || c.budget_max || 0);
  if (bMax > 0) {
    if (bMin && bMin !== bMax) {
      out.budgetMode = 'range';
      out.budgetMin = String(bMin);
      out.budgetMax = String(bMax);
    } else {
      out.budgetMode = 'fixed';
      out.fixedBudget = String(bMax);
    }
  }
  return out;
}

/**
 * Live length hint under a text field. Every field with an enforced limit shows
 * one, so "Review & publish" can never block on a rule the brand couldn't see.
 * Counts trimmed length - the same thing the validation checks.
 */
function FieldCount({ value, min = 0, max = null }) {
  const len = String(value || '').trim().length;
  const need = min - len;
  if (need > 0) {
    return <small className="bui-pb-hint need">{need} more character{need === 1 ? '' : 's'} needed</small>;
  }
  return <small className="bui-pb-hint">{max ? `${len}/${max} characters` : `${len} characters`}</small>;
}

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmtDay = (d) => {
  if (!d) return '';
  const t = new Date(`${d}T00:00:00`);
  return Number.isNaN(t.getTime()) ? d : t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

// Small presentational pieces. Defined at module level on purpose: declaring them
// inside the form component would remount every input (and drop focus) on each keystroke.
function Chip({ on, onClick, children, title }) {
  return (
    <button type="button" className={`bui-pb-chip${on ? ' on' : ''}`} aria-pressed={!!on} title={title} onClick={onClick}>
      {on && <Check size={14} />}{children}
    </button>
  );
}

function CheckRow({ on, onChange, hint, children }) {
  return (
    <label className="bui-pb-check">
      <input type="checkbox" checked={!!on} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}{hint && <small className="bui-pb-hint"> {hint}</small>}</span>
    </label>
  );
}

// A label + its control(s). `group` renders a div (chip rows) instead of a <label>
// so clicking a chip never gets forwarded to a different control.
function Field({ label, req, group, children }) {
  const caption = <span className="bui-pb-lab">{label}{req && <em> *</em>}</span>;
  return group
    ? <div className="bui-pb-field" role="group" aria-label={label}>{caption}{children}</div>
    : <label className="bui-pb-field">{caption}{children}</label>;
}

function SecHead({ n, title, sub }) {
  return (
    <div className="bui-pb-sechead">
      <span className="bui-pb-num">{n}</span>
      <div><div className="bui-pb-sectitle">{title}</div><div className="bui-pb-secsub">{sub}</div></div>
    </div>
  );
}

// One collapsible "optional - add if you need" row.
function Group({ id, title, desc, open, need, onToggle, children }) {
  return (
    <section className="bui-pb-card bui-pb-group" id={`bui-pb-${id}`}>
      <button type="button" className="bui-pb-ghead" aria-expanded={open} onClick={onToggle}>
        <span className="bui-pb-gtext"><b>{title}</b><small>{desc}</small></span>
        {need > 0 && <span className="bui-pb-need">{need} required</span>}
        <span className="bui-pb-gact">{open ? 'Hide' : 'Add'}</span>
        <Plus size={18} className={`bui-pb-gplus${open ? ' open' : ''}`} />
      </button>
      {open && <div className="bui-pb-gbody">{children}</div>}
    </section>
  );
}

const PostABrief = forwardRef(function PostABrief({ embeddedCreatorId = null, onClose = null, onPublished = null, onDraftSaved = null, duplicateId = null, resumeDraftId = null } = {}, ref) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  // Which optional groups are expanded (details / include / style / rights).
  const [openGroups, setOpenGroups] = useState({});
  const [form, setForm] = useState(initialForm);
  const privateCreatorId = embeddedCreatorId || searchParams.get('creator');
  const [privateRates, setPrivateRates] = useState(null);
  useEffect(() => {
    if (!privateCreatorId) return;
    let active = true;
    setPrivateRates(null);
    axios.get(`${API}/profile/${encodeURIComponent(privateCreatorId)}`).then(({ data }) => {
      const profile = data.profile || data;
      const rates = profile.rate_card || {};
      const flat = Number(String(rates.raw_payout || rates.expected_payout || profile.expectedPayout || '').replace(/[^0-9.]/g, ''));
      const samples = data.portfolio || profile.portfolio_items || profile.portfolio || [];
      const prices = (Array.isArray(samples) ? samples : []).map(sample => Number(sample?.price || sample?.price_per_video || 0)).filter(price => price > 0);
      const raw = flat || (prices.length ? Math.min(...prices) : 0);
      if (!active) return;
      setPrivateRates({ raw, editing: Number(rates.editing_payout || 0) });
      setForm(current => ({ ...current, creatorsWanted: 1, budgetMode: 'fixed', fixedBudget: String(raw || ''), editingFee: String(rates.editing_payout || 0) }));
    }).catch(() => { if (active) toast.error('Unable to load creator rates. Reopen the brief to retry.'); });
    return () => { active = false; };
  }, [privateCreatorId]);
  // Name pulled from the brand profile; kept in a ref so the draft-resume effect
  // can re-assert it over anything an older draft saved.
  const brandFromProfile = useRef('');
  const [moodUploading, setMoodUploading] = useState(false);
  // Mood board: uploads to the server and APPENDS to the existing list (max 5),
  // so picking files a second time adds instead of replacing.
  const uploadMoodImages = async (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';                       // allow re-picking the same file later
    if (!picked.length) return;
    const room = 5 - form.moodImages.length;
    if (room <= 0) { toast.error('You can add up to 5 mood board images.'); return; }
    const files = picked.slice(0, room);
    if (picked.length > room) toast.error(`Only ${room} more image${room > 1 ? 's' : ''} can be added.`);
    setMoodUploading(true);
    try {
      for (const file of files) {
        if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} is too large. Max 5MB.`); continue; }
        const fd = new FormData();
        fd.append('file', file);
        const { data } = await axios.post(`${API}/upload/file`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        const url = data.file_url || data.url || '';
        if (url) setForm((f) => ({ ...f, moodImages: [...f.moodImages, url].slice(0, 5) }));
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not upload mood board image'));
    } finally {
      setMoodUploading(false);
    }
  };
  const removeMoodImage = (index) => setForm((f) => ({ ...f, moodImages: f.moodImages.filter((_, i) => i !== index) }));

  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [publishMode, setPublishMode] = useState('matches');
  const [draftSavedAt, setDraftSavedAt] = useState('');
  const [draftId, setDraftId] = useState(() => safeStore.get(DRAFT_ID_KEY) || null);
  const [savingDraft, setSavingDraft] = useState(false);

  useEffect(() => {
    const owner = safeStore.get(DRAFT_OWNER_KEY);
    const foreignDraft = !!(user?.id && owner && owner !== String(user.id));
    if (foreignDraft) {
      safeStore.remove(DRAFT_KEY);
      safeStore.remove(DRAFT_ID_KEY);
      safeStore.remove(DRAFT_OWNER_KEY);
      setDraftId(null);
      setForm(initialForm);
    }
    if (user?.id) safeStore.set(DRAFT_OWNER_KEY, String(user.id));

    const saved = foreignDraft ? null : safeStore.get(DRAFT_KEY);
    if (saved) {
      try {
        setForm({ ...initialForm, ...JSON.parse(saved) });
      } catch {
        safeStore.remove(DRAFT_KEY);
      }
    }

    axios.get(`${API}/business/settings/profile`)
      .then(res => {
        const profile = res.data || {};
        const up = user?.profile || {};
        // Brand name is not a free field: the published campaign always carries
        // the brand profile's name (the server sets brand_name from
        // profile.business_name and re-cascades it on every profile save). So the
        // live profile value wins over whatever a stale localStorage draft holds —
        // that mismatch is what used to show a different brand name here.
        const fromProfile = brandNameOf(profile, user);
        brandFromProfile.current = fromProfile;
        setForm(current => ({
          ...current,
          brandName: fromProfile || current.brandName,
          // Pre-select the brand's category by default (still changeable).
          category: current.category || matchCategory(
            profile.primary_category, profile.business_category, profile.industry_category,
            profile.category, profile.product_type,
            up.industry_category, up.business_category, up.category
          )
        }));
      })
      .catch(() => {
        const fallback = brandNameOf(null, user);
        brandFromProfile.current = fallback;
        setForm(current => ({ ...current, brandName: fallback || current.brandName }));
      });
  }, [user?.id]);

  // Resume a server-saved draft — either from the URL (?draft=<id>) or from the
  // Campaigns page opening this wizard in a modal (resumeDraftId prop). draftId
  // is set, so saving/publishing PATCHes that same draft instead of forking a copy.
  useEffect(() => {
    const resumeId = resumeDraftId || searchParams.get('draft');
    if (!resumeId) return;
    setDraftId(resumeId);
    safeStore.set(DRAFT_ID_KEY, resumeId);
    axios.get(`${API}/campaigns/${resumeId}`)
      .then(res => {
        const mapped = mapCampaignToForm(res.data);
        if (Object.keys(mapped).length) {
          // Same rule as above: a draft's saved brand name never overrides the
          // brand profile, which is what the published campaign will show.
          setForm(current => ({ ...current, ...mapped, brandName: brandFromProfile.current || mapped.brandName || current.brandName }));
          toast.success('Draft loaded - continue where you left off');
        }
      })
      .catch(() => toast.error('Could not load that draft'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, resumeDraftId]);

  // Duplicate an existing campaign into a fresh, editable brief (?duplicate=<id>).
  // We do NOT set draftId, so publishing creates a brand-new copy — the source
  // brief is untouched.
  useEffect(() => {
    const dupId = duplicateId || searchParams.get('duplicate');
    if (!dupId) return;
    setDraftId(null);
    safeStore.remove(DRAFT_ID_KEY);
    axios.get(`${API}/campaigns/${dupId}`)
      .then(res => {
        const mapped = mapCampaignToForm(res.data);
        const n = Object.keys(mapped).length;
        // Brand name stays the profile's, never the copied campaign's.
        setForm(current => ({ ...current, ...mapped, brandName: brandFromProfile.current || mapped.brandName || current.brandName }));
        toast.success(`Copied brief loaded - ${n} field${n === 1 ? '' : 's'} carried over. Edit and publish.`);
      })
      .catch(() => toast.error('Could not load that brief to duplicate'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, duplicateId]);

  useEffect(() => {
    safeStore.set(DRAFT_KEY, JSON.stringify(form));
    setDraftSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }, [form]);

  const set = (field, value) => setForm(current => ({ ...current, [field]: value }));
  const toggleArray = (field, value) => {
    setForm(current => {
      const values = current[field] || [];
      return { ...current, [field]: values.includes(value) ? values.filter(item => item !== value) : [...values, value] };
    });
  };

  // Niches, where "Any" cannot coexist with a specific pick: choosing it clears
  // the rest, and choosing anything else clears it.
  const toggleNiche = (value) => {
    setForm(current => {
      const values = current.nicheTags || [];
      if (value === ANY_NICHE) {
        return { ...current, nicheTags: values.includes(value) ? [] : [ANY_NICHE] };
      }
      const without = values.filter(item => item !== value && item !== ANY_NICHE);
      return { ...current, nicheTags: values.includes(value) ? without : [...without, value] };
    });
  };

  // `budget` is the per-creator figure (what one creator is paid) — it feeds the
  // per_video_budget / budget_max payload fields. The wallet holds it for EVERY
  // creator the brief hires, so the money shown on hold multiplies by that count.
  const budget = privateCreatorId ? (privateRates?.raw || 0) : Number(form.budgetMode === 'fixed' ? form.fixedBudget : form.budgetMax) || 0;
  const creatorsCount = privateCreatorId ? 1 : Math.max(1, Number(form.creatorsWanted) || 1);
  // Total assets the brief asks for = sum of every deliverable row's quantity. Same
  // count the backend uses for escrow, so the fee tier shown here matches the debit.
  const totalDeliverables = form.deliverables.reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0);
  // `budget` is per VIDEO: the backend holds it for every video of every creator
  // (campaign_slot_budget x creators_wanted). Leaving out the quantity understated
  // the hold, e.g. Rs. 5,000 x 3 videos showed Rs. 5,000 but Rs. 15,000 was held.
  const totalVideos = totalDeliverables * creatorsCount;
  const editedQuantity = form.deliverables.reduce((sum, item) => sum + (item.editedRequired && item.editedBy !== 'ugc' ? Number(item.quantity) || 1 : 0), 0);
  const editingRate = privateCreatorId ? (privateRates?.editing || 0) : Math.max(0, Number(form.editingFee) || 0);
  const editingTotal = editingRate * editedQuantity * creatorsCount;
  const totalBudget = budget * totalVideos + editingTotal;
  const commission = Math.round(totalBudget * COMMISSION_RATE); // commission on the overall total
  // Only a deliverable that needs an edited cut has a separate "final" hand-off.
  // Two dates only when the CREATOR edits: raw first, then the edited cut after the raw is
  // approved. Raw-only or UGC.ad-edited briefs need just one date from the creator.
  const anyEdited = form.deliverables.some(item => item.editedRequired && item.editedBy !== 'ugc');
  const listingFee = listingFeeFor(creatorsCount, totalDeliverables); // charged once — not per creator
  const totalDebit = totalBudget + commission + listingFee;
  const paidAdsSelected = form.platforms.some(platform => platform.toLowerCase().includes('paid ads'));
  // Only a physical product ships. Everything else skips shipping date + address + receipt.
  const needsShipping = typeNeedsShipping(form.productType);
  // Earliest allowed timeline date. ISO yyyy-mm-dd strings compare chronologically,
  // so date validation below is plain string comparison against this.
  const tomorrowStr = addDays(new Date().toISOString().slice(0, 10), 1);
  const draftDeliverySuggestion = useMemo(() => addDays(form.productShippingBy, 7), [form.productShippingBy]);
  const pricingLifts = [
    form.rightsDuration === 'Perpetual' ? 'Perpetual rights: +40% suggested' : '',
    form.whitelisting ? 'Whitelisting enabled: +30% suggested' : '',
    form.exclusivity === '90 days' ? '90-day exclusivity: +25% suggested' : '',
    paidAdsSelected ? 'Paid ads allowed: +20% suggested' : ''
  ].filter(Boolean);

  const finalDeliverySuggestion = useMemo(() => {
    return addDays(form.draftDeliveryBy, Math.max(1, Number(form.revisions || 0) * 2));
  }, [form.draftDeliveryBy, form.revisions]);

  useEffect(() => {
    if (!form.draftDeliveryBy && draftDeliverySuggestion) {
      set('draftDeliveryBy', draftDeliverySuggestion);
    }
  }, [draftDeliverySuggestion]);

  useEffect(() => {
    if (!form.finalDeliveryBy && finalDeliverySuggestion) {
      set('finalDeliveryBy', finalDeliverySuggestion);
    }
  }, [finalDeliverySuggestion]);

  const updateDeliverable = (id, patch) => {
    set('deliverables', form.deliverables.map(item => item.id === id ? { ...item, ...patch } : item));
  };

  const addDeliverable = () => {
    if (form.deliverables.length >= 5) {
      toast.error('You can add up to 5 deliverables');
      return;
    }
    set('deliverables', [...form.deliverables, createDeliverable()]);
  };

  const removeDeliverable = (id) => {
    if (form.deliverables.length === 1) return;
    if (window.confirm('Remove this deliverable from the brief?')) {
      set('deliverables', form.deliverables.filter(item => item.id !== id));
    }
  };

  const addTextItem = (field, max) => {
    if ((form[field] || []).length >= max) return;
    set(field, [...(form[field] || []), '']);
  };

  const updateTextItem = (field, index, value) => {
    set(field, form[field].map((item, idx) => idx === index ? value : item));
  };

  const removeTextItem = (field, index) => {
    const next = form[field].filter((_, idx) => idx !== index);
    set(field, next.length ? next : ['']);   // keep at least one empty input
  };

  // ── Reference video upload ─────────────────────────────────────────────────
  // A reference video row accepts EITHER a pasted link or a real upload, so the
  // creator gets a playable clip instead of only a third-party URL. Mirrors the
  // mood-board uploader above and shares the /upload/file endpoint.
  const [uploadingKey, setUploadingKey] = useState('');

  const uploadRefVideo = async (index, file) => {
    if (!file) return;
    setUploadingKey(`ref-${index}`);
    try {
      const data = await uploadMedia(file, API);
      const url = data.file_url || data.url || '';
      if (!url) throw new Error('No URL returned');
      updateTextItem('referenceVideos', index, url);
      toast.success('Reference video uploaded');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not upload that video'));
    } finally {
      setUploadingKey('');
    }
  };

  // Everything still blocking publish. Each issue is tagged with the card it lives in
  // (s1/s2/s3 = the three essentials; details/include/style/rights = the optional
  // groups) so "Review & publish" can open the right group and say what is missing.
  // Same rules as the old per-step checks - only the grouping changed.
  const collectIssues = () => {
    const m = [];
    const add = (g, msg) => m.push({ g, msg });
    // Essential 1: what are you promoting
    if (form.campaignName.trim().length < 3) add('s1', 'Campaign name (min 3 chars)');
    if (form.productType === 'other' && !form.customProductType.trim()) add('s1', 'Describe your product type');
    if (!form.productName.trim()) add('s1', needsShipping ? 'Product name' : 'What you’re promoting (name)');
    if (form.campaignHook.trim().length < 10) add('s1', 'Campaign hook (min 10 chars)');
    if (!form.category) add('s1', 'Category');
    else if (form.category === OTHER_CATEGORY && !form.customCategory.trim()) add('s1', 'Type your category');
    // Optional group: product details
    if (form.productDescription.trim().length < 20) add('details', 'Product description (min 20 chars)');
    if (form.keyMessage.trim().length < 10) add('details', 'Key message (min 10 chars)');
    if (form.objectives.length === 0) add('details', 'Campaign objective');
    const ta = form.targetAudience.trim().length;
    if (ta < 50 || ta > 200) add('details', 'Target audience (50–200 chars)');
    // Essential 2: what video
    if (!(form.deliverables.length > 0 && form.deliverables.every(i => i.type && i.quantity >= 1 && i.quantity <= 5 && i.aspectRatios.length > 0 && (!isVideoDeliverable(i.type) || i.duration)))) add('s2', 'Each video: type, quantity 1–5, aspect ratio (+ length for video)');
    // Optional group: must include / avoid
    if (form.productVisible && !form.visibilitySeconds) add('include', 'Product visibility seconds');
    if (form.verbalMention && !form.productNames) add('include', 'Product names to mention');
    if (!form.callToAction) add('include', 'Call to action');
    if (form.callToAction === 'Use code' && !form.promoCode) add('include', 'Promo code');
    if (CTA_INPUT[form.callToAction] && !ctaLinkValid(form.callToAction, form.ctaLink)) add('include', `${CTA_INPUT[form.callToAction].label} (valid ${CTA_INPUT[form.callToAction].type === 'handle' ? 'handle or link' : 'link'})`);
    // Optional group: style
    if (form.tones.length === 0) add('style', 'Tone tags');
    if (!form.pacing) add('style', 'Pacing reference');
    // Optional group: rights & creator filters
    if (form.platforms.length === 0) add('rights', 'Platforms');
    if (!form.rightsDuration) add('rights', 'Rights duration');
    if (!form.exclusivity) add('rights', 'Exclusivity');
    if (!form.modificationRights) add('rights', 'Modification rights');
    if (!form.creatorLevel) add('rights', 'Creator level');
    if (!form.qualityTier) add('rights', 'Quality tier');
    // Essential 3: budget & dates
    if (needsShipping && (!form.productShippingBy || form.productShippingBy < tomorrowStr)) add('s3', 'Product shipping date (tomorrow or later)');
    const draftMin = needsShipping && form.productShippingBy ? form.productShippingBy : tomorrowStr;
    if (!form.draftDeliveryBy || form.draftDeliveryBy < draftMin) add('s3', needsShipping ? 'Draft delivery date (on or after shipping)' : 'Draft delivery date (tomorrow or later)');
    if (anyEdited && (!form.finalDeliveryBy || form.finalDeliveryBy < form.draftDeliveryBy)) add('s3', 'Edited video date (on or after the raw video date)');
    if (!(budget > 0)) add('s3', 'Budget');
    return m;
  };
  const issues = collectIssues();
  const needCount = (g) => issues.filter(i => i.g === g).length;
  const toggleGroup = (k) => setOpenGroups(current => ({ ...current, [k]: !current[k] }));

  // The only gate before the confirm dialog: open every optional group that still has
  // something missing and scroll to the first one, instead of failing silently.
  const reviewAndPublish = () => {
    if (issues.length) {
      toast.error(`Complete to continue: ${issues.map(i => i.msg).join(', ')}`);
      const groups = [...new Set(issues.map(i => i.g))];
      setOpenGroups(current => {
        const next = { ...current };
        groups.forEach((g) => { if (!['s1', 's2', 's3'].includes(g)) next[g] = true; });
        return next;
      });
      setTimeout(() => document.getElementById(`bui-pb-${groups[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
      return;
    }
    setPublishMode('matches');
    setShowConfirm(true);
  };

  // Push the brief to the account as a draft. Updates the existing server draft
  // when we have one, but a stale id — deleted draft, or one left in this browser
  // by another account (403 "You can only edit your own campaigns") — creates a
  // fresh draft instead of failing the save.
  const pushDraft = async (payload) => {
    if (draftId) {
      try {
        await axios.patch(`${API}/campaigns/${draftId}`, payload);
        return draftId;
      } catch (err) {
        const code = err?.response?.status;
        if (code !== 403 && code !== 404) throw err;
        setDraftId(null);
        safeStore.remove(DRAFT_ID_KEY);
      }
    }
    const res = await axios.post(`${API}/campaigns/draft`, payload);
    const newId = res.data?.campaign_id || res.data?.id || res.data?._id;
    if (newId) {
      setDraftId(newId);
      safeStore.set(DRAFT_ID_KEY, newId);
      if (user?.id) safeStore.set(DRAFT_OWNER_KEY, String(user.id));
    }
    return newId;
  };

  const saveDraft = async () => {
    safeStore.set(DRAFT_KEY, JSON.stringify(form));
    if (savingDraft) return;
    setSavingDraft(true);
    try {
      await pushDraft(buildPayload());
      toast.success('Draft saved to your account');
      if (onDraftSaved) onDraftSaved();
    } catch (error) {
      // The local copy is safe, so the brand can keep working — but do NOT call this
      // a success. A 403 ("profile must be approved first") used to raise a green
      // "Draft saved" toast, so the brand thought it was on their account when the
      // server had rejected it outright. That's half of "I saved it and it's gone".
      toast.warning('Saved on this device only', {
        description: apiErrorMessage(error, "We couldn't save it to your account - it won't show in Drafts until it saves."),
      });
    } finally {
      setSavingDraft(false);
    }
  };

  // ── Auto-draft ─────────────────────────────────────────────────────────────
  // The form is already mirrored to localStorage on every change (below). On top
  // of that, silently save it as an ACCOUNT draft a few seconds after the user
  // stops editing — so nothing is lost if they hit Cancel, switch tabs, or close
  // the tab. Reuses draftId, so it keeps updating one draft (no duplicates).
  const briefHasContent = (f) =>
    (f.campaignName || '').trim().length >= 2 ||
    (f.productName || '').trim().length >= 2 ||
    (f.productDescription || '').trim().length >= 10;

  const lastAutoSaveRef = useRef('');
  const publishedRef = useRef(false);   // set once the brief is published/cleared — stop auto-saving
  const autoSaveDraftSilent = async () => {
    if (publishedRef.current || savingDraft || submitting) return;
    if (!briefHasContent(form)) return;
    const snapshot = JSON.stringify(form);
    if (snapshot === lastAutoSaveRef.current) return;   // nothing changed
    lastAutoSaveRef.current = snapshot;
    try {
      await pushDraft(buildPayload());
      setDraftSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch {
      // Server save failed — the localStorage copy still has everything.
      lastAutoSaveRef.current = '';   // retry on next change
    }
  };

  // Keep a ref to the latest auto-save closure so the unmount handler saves the
  // CURRENT form (not a stale one from first render).
  const autoSaveRef = useRef(autoSaveDraftSilent);
  autoSaveRef.current = autoSaveDraftSilent;

  // Debounce: auto-save ~1.5s after the last edit (only once there's real content).
  useEffect(() => {
    if (!briefHasContent(form)) return undefined;
    const t = setTimeout(() => autoSaveRef.current(), 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  // Save on leave — fires when the form unmounts (Cancel, tab switch, navigate),
  // so work isn't lost even if you leave before the debounce runs.
  useEffect(() => () => { autoSaveRef.current(); }, []);

  // Closing by clicking outside the modal is the easiest way to lose work by
  // accident. The unmount auto-save above does fire, but only AFTER the form is
  // gone and entirely silently — so a failed save was invisible. The parent calls
  // this first instead: it saves, waits, and says what happened.
  useImperativeHandle(ref, () => ({
    async saveDraftNow() {
      if (publishedRef.current || !briefHasContent(form)) return false;  // nothing worth keeping
      try {
        await pushDraft(buildPayload());
        // Stop the unmount handler re-sending the identical payload a tick later.
        lastAutoSaveRef.current = JSON.stringify(form);
        toast.success('Draft saved - pick it up from the Drafts tab.');
        if (onDraftSaved) onDraftSaved();
        return true;
      } catch (error) {
        toast.warning('Saved on this device only', {
          description: apiErrorMessage(error, "We couldn't save it to your account - it won't show in Drafts."),
        });
        return false;
      }
    },
  }));

  // Warn before closing/refreshing the tab if there are unsaved edits in flight.
  useEffect(() => {
    const onBeforeUnload = (e) => {
      if (briefHasContent(form) && JSON.stringify(form) !== lastAutoSaveRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form]);

  const handleHashtagsChange = (value) => {
    // Keep the raw typed value (including trailing spaces) so the spacebar
    // works while typing; only normalise when the 10-hashtag cap is exceeded.
    const tags = value.split(/\s+/).filter(Boolean);
    set('hashtags', tags.length > 10 ? tags.slice(0, 10).join(' ') : value);
  };

  const briefText = () => {
    return [
      `Campaign: ${form.campaignName}`,
      `Brand: ${form.brandName}`,
      `Category: ${resolvedCategory(form)}`,
      `Product: ${form.productName}`,
      `Product description: ${form.productDescription}`,
      `Hook: ${form.campaignHook}`,
      `Key message: ${form.keyMessage}`,
      `Objectives: ${form.objectives.join(', ')}`,
      `Target audience: ${form.targetAudience}`,
      `Video language: ${form.language}`,
      `Budget visibility: ${form.budgetVisible ? 'Visible to creators' : 'Hidden from creators - admin flag'}`,
      '',
      'Deliverables:',
      ...form.deliverables.map((item, index) => `${index + 1}. ${item.quantity} x ${item.type}; duration ${item.duration || 'n/a'}; ratios ${item.aspectRatios.join(', ')}; deliver ${item.editedRequired ? `raw footage + an edited cut (edited by ${item.editedBy === 'ugc' ? 'UGC.ad' : 'creator'})` : 'raw footage only'}`),
      '',
      `Script: ${form.scriptProvider === 'ugc' ? 'Provided by UGC.ad (added during brief review)' : (form.scriptText.trim() || 'none')}`,
      '',
      `Must include: product visible ${form.productVisible ? `${form.visibilitySeconds}s minimum` : 'no'}; verbal mention ${form.verbalMention ? form.productNames : 'no'}; CTA ${form.callToAction}; promo ${form.promoCode || 'n/a'}; hashtags ${form.hashtags || 'n/a'}; brand tag ${form.brandHandleTag ? 'yes' : 'no'}`,
      `Required phrases: ${form.requiredPhrases.filter(Boolean).join(', ') || 'none'}`,
      `Required shots: ${form.requiredShots.filter(Boolean).join(', ') || 'none'}`,
      `Must avoid: competitors ${form.noCompetitors ? form.competitors || 'listed competitors' : 'not specified'}; other products ${form.noOtherProducts ? 'no' : 'allowed'}; profanity ${form.noProfanity ? 'no' : 'allowed'}; political/religious ${form.noPolitical ? 'no' : 'allowed'}; filters ${form.avoidFilters ? form.filterTypes || 'avoid' : 'allowed'}; specific avoid ${form.avoidText || 'none'}`,
      `Style guidance: tones ${form.tones.join(', ')}; pacing ${form.pacing}; music ${form.musicPreference}; references ${form.referenceVideos.filter(Boolean).join(', ') || 'none'}`,
      `Usage rights: platforms ${form.platforms.join(', ')}; duration ${form.rightsDuration}; exclusivity ${form.exclusivity}; whitelisting ${form.whitelisting ? 'yes' : 'no'}; modification ${form.modificationRights}`,
      `Creator targeting: level ${form.creatorLevel}; quality ${form.qualityTier}; gender ${form.genderPreference}; city ${form.cityFilter}; niches ${form.nicheTags.join(', ') || 'none'}`,
      `Timeline: ${needsShipping ? `ship by ${form.productShippingBy}; ` : ''}${anyEdited ? 'raw video' : 'delivery'} by ${form.draftDeliveryBy}; revisions ${form.revisions}${anyEdited ? `; edited video by ${form.finalDeliveryBy}` : ''}`,
      `Budget: ${form.budgetMode === 'fixed' ? `fixed Rs. ${form.fixedBudget}` : `range Rs. ${form.budgetMin} - Rs. ${form.budgetMax}`}`,
      `Commission: platform 20%, total wallet debit Rs. ${totalDebit} (Rs. ${budget} per raw video x ${totalVideos} videos, editing Rs. ${editingTotal}), each creator receives Rs. ${budget * totalDeliverables + editingTotal / creatorsCount} pre-tax`
    ].join('\n');
  };

  const buildPayload = () => {
    const primaryDeliverable = form.deliverables[0] || {};
    return {
      title: form.campaignName,
      image_url: form.image || '',
      brief_text: briefText(),
      budget_min: form.budgetMode === 'fixed' ? budget : Number(form.budgetMin || 0),
      budget_max: budget,
      objectives: form.objectives,
      // Only a physical product ships — everything else skips address/shipping/receipt.
      requires_shipment: needsShipping,
      shipment_required: needsShipping,
      shipment_option: needsShipping ? 'yes' : 'no',
      product_type: form.productType,
      product_type_detail: form.productType === 'other' ? form.customProductType.trim() : '',
      due_date: anyEdited ? form.finalDeliveryBy : form.draftDeliveryBy,
      deadline: anyEdited ? form.finalDeliveryBy : form.draftDeliveryBy,
      revision_limit: Number(form.revisions || 0),
      creators_wanted: Math.max(1, Number(form.creatorsWanted) || 1),
      product_name: form.productName,
      category: resolvedCategory(form),
      product_category: resolvedCategory(form),
      product_description: form.productDescription,
      brief_type: primaryDeliverable.type,
      campaign_hook: form.campaignHook,
      key_message: form.keyMessage,
      what_not_to_do: avoidRules,
      tone_reference: form.pacing,
      tone_tags: form.tones,
      video_format: primaryDeliverable.type,
      aspect_ratio: primaryDeliverable.aspectRatios?.[0],
      duration_seconds: parseDurationSeconds(primaryDeliverable.duration),
      additional_deliverables: form.deliverables.slice(1).map(item => `${item.quantity} x ${item.type}`),
      free_revisions: Number(form.revisions || 0),
      creator_level: form.creatorLevel,
      content_quality_tier: form.qualityTier,
      gender_preference: form.genderPreference,
      city_filter: form.cityFilter,
      creator_niche_tags: form.nicheTags,
      per_video_budget: budget,
      editing_fee_per_video: editingRate,
      ...(privateCreatorId ? { selected_creator: privateCreatorId, visibility: 'private', creators_wanted: 1 } : {}),
      total_budget: totalBudget,
      currency: 'INR',

      // Full structured brief so a duplicate can be rebuilt exactly (the backend
      // persists all of these via BriefSectionsMixin).
      target_audience: form.targetAudience,
      language: form.language,
      budget_visible: form.budgetVisible,
      budget_mode: form.budgetMode,
      deliverable_items: form.deliverables.map(item => ({
        type: item.type,
        quantity: item.quantity,
        duration: item.duration,
        aspect_ratios: item.aspectRatios,
        // Always true - every brief gets the raw footage. Kept in the payload because
        // the backend model and the creator-facing brief still read this field.
        raw_required: true,
        edited_required: item.editedRequired,
        edited_by: item.editedBy,
      })),
      script_provider: form.scriptProvider,
      script_text: form.scriptProvider === 'ugc' ? '' : form.scriptText,
      product_visible: form.productVisible,
      product_visible_seconds: form.visibilitySeconds,
      verbal_mention: form.verbalMention,
      verbal_mention_text: form.productNames,
      required_phrases: form.requiredPhrases,
      required_shots: form.requiredShots,
      call_to_action: form.callToAction,
      cta_link: form.ctaLink,
      promo_code: form.promoCode,
      hashtags: form.hashtags,
      brand_handle_tag: form.brandHandleTag,
      no_competitors: form.noCompetitors,
      competitors_text: form.competitors,
      no_other_products: form.noOtherProducts,
      no_profanity: form.noProfanity,
      no_political: form.noPolitical,
      avoid_filters: form.avoidFilters,
      filter_types_text: form.filterTypes,
      avoid_text: form.avoidText,
      pacing: form.pacing,
      music_preference: form.musicPreference,
      reference_videos: form.referenceVideos,
      mood_images: form.moodImages,
      usage_platforms: form.platforms,
      rights_duration: form.rightsDuration,
      exclusivity: form.exclusivity,
      whitelisting: form.whitelisting,
      modification_rights: form.modificationRights,
      product_shipping_by: needsShipping ? form.productShippingBy : '',
      draft_delivery_by: form.draftDeliveryBy,
      final_delivery_by: anyEdited ? form.finalDeliveryBy : form.draftDeliveryBy,
    };
  };

  const clearDraftStorage = () => {
    publishedRef.current = true;   // brief published — don't auto-save on unmount
    safeStore.remove(DRAFT_KEY);
    safeStore.remove(DRAFT_ID_KEY);
    safeStore.remove(DRAFT_OWNER_KEY);
    setDraftId(null);
  };

  const publish = async () => {
    try {
      if (privateCreatorId && (!privateRates || privateRates.raw <= 0)) { toast.error('The creator must set their raw video rate before sending a brief.'); return; }
      setSubmitting(true);

      // Direct brief for a creator who accepted a private invitation: skip the
      // matches/approval path — publish straight to a deal with that creator.
      const directCreator = embeddedCreatorId || searchParams.get('creator');
      if (directCreator) {
        const privatePayload = { ...buildPayload(), selected_creator: directCreator, visibility: 'private' };
        await publishPrivateBrief(axios, API, draftId, privatePayload);
        clearDraftStorage();
        toast.success('Private brief submitted for approval');
        if (onPublished) onPublished(); else navigate('/dashboard/business');
        return;
      }

      // PRD 5.2 Path B: "Request Matches" asks ops for a curated shortlist.
      const payload = { ...buildPayload(), match_requested: publishMode === 'matches' };
      let promoted = false;
      if (draftId) {
        // Promote the existing server draft instead of creating a duplicate.
        try {
          await axios.patch(`${API}/campaigns/${draftId}`, payload);
          await axios.post(`${API}/campaigns/${draftId}/submit`);
          promoted = true;
        } catch (err) {
          // Stale/missing draft (already submitted, deleted, or left behind by
          // another account) — fall back to publishing a fresh brief.
          const code = err?.response?.status;
          if (code !== 404 && code !== 403) throw err;
        }
      }
      if (!promoted) {
        await axios.post(`${API}/campaigns`, { ...payload, status: 'pending_approval' });
      }
      clearDraftStorage();
      // It lands as pending_approval: creators only see it once the team approves it.
      toast.success('Brief submitted for review - creators can see it once our team approves it');
      // Close whatever modal hosted the wizard, then land on the campaigns list where the new
      // brief shows as Pending (/dashboard/business just redirects to Browse Creators).
      if (onPublished) onPublished();
      navigate(publishMode === 'invite' ? '/dashboard/business/pending-bids' : '/dashboard/business/all-campaigns');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to publish brief'));
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  };

  const renderTextList = (field, max, placeholder) => (
    <div className="bui-pb-list">
      {form[field].map((item, index) => (
        <div key={index} className="bui-pb-list-row">
          <input className="bui-pb-input" value={item} onChange={(event) => updateTextItem(field, index, event.target.value)} placeholder={placeholder} />
          {(form[field].length > 1 || item) && (
            <button type="button" className="bui-pb-icon-btn danger" aria-label="Remove" onClick={() => removeTextItem(field, index)}><Trash2 size={15} /></button>
          )}
        </div>
      ))}
      {form[field].length < max && <button type="button" className="bui-pb-link" onClick={() => addTextItem(field, max)}><Plus size={15} /> Add item</button>}
    </div>
  );

  // Reference videos: each row accepts EITHER a pasted link OR a direct upload.
  const renderRefVideos = (max = 3) => (
    <div className="bui-pb-list">
      {form.referenceVideos.map((item, index) => {
        const busy = uploadingKey === `ref-${index}`;
        const uploaded = isUploadedUrl(item);
        return (
          <div key={index} className="bui-pb-list-row">
            <input
              className="bui-pb-input"
              value={item}
              onChange={(event) => updateTextItem('referenceVideos', index, event.target.value)}
              placeholder="Paste reference video link"
            />
            <label className={`bui-pb-upload${busy ? ' busy' : ''}`} title="Upload a video file instead">
              <Upload size={15} /> {busy ? 'Uploading…' : (uploaded ? 'Replace' : 'Upload')}
              <input
                type="file"
                accept="video/*"
                disabled={busy}
                onChange={(event) => { uploadRefVideo(index, event.target.files?.[0]); event.target.value = ''; }}
              />
            </label>
            {(form.referenceVideos.length > 1 || item) && (
              <button type="button" className="bui-pb-icon-btn danger" aria-label="Remove" onClick={() => removeTextItem('referenceVideos', index)}><Trash2 size={15} /></button>
            )}
          </div>
        );
      })}
      {form.referenceVideos.length < max && <button type="button" className="bui-pb-link" onClick={() => addTextItem('referenceVideos', max)}><Plus size={15} /> Add item</button>}
    </div>
  );

  const avoidRules = [
    form.noCompetitors ? `No competitor brands visible${form.competitors ? `: ${form.competitors}` : ''}` : '',
    form.noOtherProducts ? 'No other products in frame' : '',
    form.noProfanity ? 'No profanity or adult language' : '',
    form.noPolitical ? 'No political or religious content' : '',
    form.avoidFilters ? `Avoid filters / effects${form.filterTypes ? `: ${form.filterTypes}` : ''}` : '',
    form.avoidText ? `Specific avoid: ${form.avoidText}` : ''
  ].filter(Boolean).join('; ') || 'None';

  // ── "What creators will see" preview + cost summary ─────────────────────────
  const productTypeLabel = form.productType === 'other'
    ? (form.customProductType.trim() || 'Other')
    : (PRODUCT_TYPES.find(p => p.value === form.productType)?.label || '');
  const shortType = (t) => String(t || '').replace(/\s*\(.*\)\s*$/, '');
  const firstVideo = form.deliverables.find(d => d.type);
  const videoSummary = firstVideo
    ? `${firstVideo.quantity} × ${shortType(firstVideo.type)}${firstVideo.duration ? ` · ${firstVideo.duration}` : ''}${firstVideo.aspectRatios?.[0] ? ` · ${firstVideo.aspectRatios[0]}` : ''}${form.deliverables.filter(d => d.type).length > 1 ? ` +${form.deliverables.filter(d => d.type).length - 1} more` : ''}`
    : '—';
  const payPreview = (() => {
    if (!(budget > 0)) return '—';
    const lo = Number(form.budgetMin || 0);
    if (!privateCreatorId && form.budgetMode === 'range' && lo > 0 && lo < budget) return `${inr(lo)}–${budget.toLocaleString('en-IN')}`;
    return inr(budget);
  })();
  const productPreview = form.productName.trim()
    ? `${form.productName.trim()}${needsShipping ? ' · shipped to you' : ''}`
    : (productTypeLabel || '—');
  const brandLine = [form.brandName, resolvedCategory(form)].filter(Boolean).join(' · ');
  const rawDue = fmtDay(form.draftDeliveryBy);
  const rawDueLabel = anyEdited ? 'Raw cut due' : 'Delivery due';

  return (
    <div className="bui-pb">
      <header className="bui-pb-head">
        <div>
          {!onClose && (
            <button
              type="button"
              className="bui-pb-back"
              onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/dashboard/business/all-campaigns', { replace: true }))}
            >
              <ChevronLeft size={16} /> Back
            </button>
          )}
          <h1>{privateCreatorId ? 'Send a private brief' : 'Post a campaign'}</h1>
          <p>3 quick sections. Add more detail only if you want to.</p>
        </div>
        <div className="bui-pb-head-act">
          <span className="bui-pb-saved"><Check size={15} /> Draft saved{draftSavedAt ? ` · ${draftSavedAt}` : ''}</span>
          <button type="button" className="bui-pb-btn ghost" onClick={saveDraft} disabled={savingDraft}>{savingDraft ? 'Saving…' : 'Save draft'}</button>
        </div>
      </header>

      <div className="bui-pb-layout">
        <div className="bui-pb-main">
          {/* ───────── 1. What are you promoting? ───────── */}
          <section className="bui-pb-card bui-pb-sec" id="bui-pb-s1">
            <SecHead n={1} title="What are you promoting?" sub="Product, hook and category" />
            <div className="bui-pb-grid2">
              <Field label="Campaign name" req>
                <input className="bui-pb-input" value={form.campaignName} onChange={e => set('campaignName', e.target.value.slice(0, 80))} placeholder="Summer Launch - Unboxing 2" />
                <FieldCount value={form.campaignName} min={3} max={80} />
              </Field>
              <Field label={needsShipping ? 'Product' : 'What are you promoting? (name)'} req>
                <input className="bui-pb-input" value={form.productName} onChange={e => set('productName', e.target.value)} placeholder={needsShipping ? 'Glow Serum 30ml' : 'e.g. FitTrack App, City Cafe, Summer Sale'} />
              </Field>
            </div>
            <Field label="Hook — the first line of the video" req>
              <input className="bui-pb-input" value={form.campaignHook} onChange={e => set('campaignHook', e.target.value)} placeholder="Start with a morning routine problem-solution moment" />
              <FieldCount value={form.campaignHook} min={10} />
            </Field>
            <Field group label="Product type" req>
              <div className="bui-pb-chips">
                {PRODUCT_TYPES.map(pt => (
                  <Chip key={pt.value} on={form.productType === pt.value} title={pt.hint} onClick={() => set('productType', pt.value)}>{pt.label}</Chip>
                ))}
              </div>
              {form.productType === 'other' && (
                <input className="bui-pb-input" style={{ marginTop: 10 }}
                  placeholder="Describe what you're promoting (e.g. Podcast, Event, NGO cause)"
                  value={form.customProductType} onChange={e => set('customProductType', e.target.value)} />
              )}
              {!needsShipping && (
                <span className="bui-pb-note"><Info size={14} /> No physical product - shipping &amp; delivery-address steps are skipped.</span>
              )}
            </Field>
            <div className="bui-pb-grid2">
              <Field label="Brand name">
                <input className="bui-pb-input" value={form.brandName} disabled />
                <small className="bui-pb-hint">
                  {form.brandName
                    ? 'Comes from your brand profile - every campaign is published under this name. '
                    : 'No brand name on your profile yet. '}
                  <button type="button" className="bui-pb-inline-link" onClick={() => navigate('/settings')}>
                    {form.brandName ? 'Change it in Brand profile' : 'Add it in Brand profile'}
                  </button>
                </small>
              </Field>
              <Field label="Category" req>
                <select className="bui-pb-input bui-pb-select" value={form.category} onChange={e => set('category', e.target.value)}>
                  <option value="">Select category</option>
                  {CATEGORY_GROUPS.map(g => (
                    <optgroup key={g.group} label={g.group}>
                      {g.items.map(item => <option key={item} value={item}>{item}</option>)}
                    </optgroup>
                  ))}
                  <option value={OTHER_CATEGORY}>Other (type your own)</option>
                </select>
                {form.category === OTHER_CATEGORY && (
                  <input className="bui-pb-input" style={{ marginTop: 10 }} maxLength={40}
                    placeholder="Your category (e.g. Drones, Stationery, Solar)"
                    value={form.customCategory} onChange={e => set('customCategory', e.target.value)} />
                )}
              </Field>
            </div>
          </section>

          {/* ───────── 2. What video do you need? ───────── */}
          <section className="bui-pb-card bui-pb-sec" id="bui-pb-s2">
            <SecHead n={2} title="What video do you need?" sub="Type, length and how many" />
            {form.deliverables.map((item, index) => {
              const editMode = item.editedRequired ? (item.editedBy === 'ugc' ? 'ugc' : 'creator') : 'raw';
              return (
                <div className={`bui-pb-deliv${form.deliverables.length > 1 ? ' multi' : ''}`} key={item.id}>
                  {form.deliverables.length > 1 && (
                    <div className="bui-pb-delhead">
                      <b>Video {index + 1}</b>
                      <button type="button" className="bui-pb-link danger" onClick={() => removeDeliverable(item.id)}><Trash2 size={14} /> Remove</button>
                    </div>
                  )}
                  <Field group label="Video type" req>
                    <div className="bui-pb-chips">
                      {DELIVERABLE_TYPES.map(type => (
                        <Chip key={type} on={item.type === type} onClick={() => updateDeliverable(item.id, { type })}>{type}</Chip>
                      ))}
                    </div>
                  </Field>
                  <div className="bui-pb-grid3">
                    <Field label="Videos per creator" req>
                      <input className="bui-pb-input" type="number" min="1" max="5" value={item.quantity} onChange={e => updateDeliverable(item.id, { quantity: Number(e.target.value) })} />
                    </Field>
                    <Field label="Length" req={isVideoDeliverable(item.type)}>
                      <input className="bui-pb-input" value={item.duration} onChange={e => updateDeliverable(item.id, { duration: e.target.value })} placeholder="15-20 seconds" />
                    </Field>
                    <Field group label="Who edits" req>
                      <div className="bui-pb-chips tight">
                        <Chip on={editMode === 'raw'} onClick={() => updateDeliverable(item.id, { editedRequired: false })}>Raw only</Chip>
                        <Chip on={editMode === 'creator'} onClick={() => updateDeliverable(item.id, { editedRequired: true, editedBy: 'creator' })}>Creator</Chip>
                        <Chip on={editMode === 'ugc'} onClick={() => updateDeliverable(item.id, { editedRequired: true, editedBy: 'ugc' })}>UGC.ad</Chip>
                      </div>
                    </Field>
                  </div>
                  <small className="bui-pb-hint">
                    {editMode === 'raw' && 'The creator delivers raw footage only.'}
                    {editMode === 'creator' && 'The creator edits and delivers the finished cut as well as the raw footage (a second upload slot opens at submission).'}
                    {editMode === 'ugc' && "UGC.ad's team edits this video - our admin team is notified once you submit the brief."}
                  </small>
                  <Field group label="Aspect ratio" req>
                    <div className="bui-pb-chips">
                      {ASPECTS.map(ratio => (
                        <Chip key={ratio} on={item.aspectRatios.includes(ratio)} onClick={() => updateDeliverable(item.id, { aspectRatios: item.aspectRatios.includes(ratio) ? item.aspectRatios.filter(r => r !== ratio) : [...item.aspectRatios, ratio] })}>{ratio}</Chip>
                      ))}
                    </div>
                  </Field>
                </div>
              );
            })}
            <div>
              <button type="button" className="bui-pb-link" onClick={addDeliverable}><Plus size={15} /> Add another video type ({form.deliverables.length}/5)</button>
            </div>
            <div className="bui-pb-grid3">
              <Field label="Creators" req>
                <input
                  className="bui-pb-input"
                  type="number"
                  min="1"
                  max="20"
                  disabled={Boolean(privateCreatorId)}
                  value={privateCreatorId ? 1 : form.creatorsWanted}
                  onChange={e => set('creatorsWanted', Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
                />
              </Field>
            </div>
            <small className="bui-pb-hint">
              The budget for all {creatorsCount} creator{creatorsCount === 1 ? '' : 's'} is placed on hold in your wallet when the
              brief is published. If you finish hiring early, the unused slots are refunded.
            </small>
          </section>

          {/* ───────── 3. Budget & dates ───────── */}
          <section className="bui-pb-card bui-pb-sec" id="bui-pb-s3">
            <SecHead n={3} title="Budget & dates" sub="What you pay per video and when you need it" />
            <div className="bui-pb-grid3">
              <Field label="Budget per video" req>
                {form.budgetMode === 'fixed' ? (
                  <div className="bui-pb-money"><span>₹</span><input className="bui-pb-input" type="text" inputMode="numeric" placeholder="5000" readOnly={Boolean(privateCreatorId)} value={form.fixedBudget} onKeyDown={blockNonDigitKey} onChange={e => set('fixedBudget', digitsOnly(e.target.value))} /></div>
                ) : (
                  <div className="bui-pb-range">
                    <div className="bui-pb-money"><span>₹</span><input className="bui-pb-input" type="text" inputMode="numeric" placeholder="Min" aria-label="Min budget per video" value={form.budgetMin} onKeyDown={blockNonDigitKey} onChange={e => set('budgetMin', digitsOnly(e.target.value))} /></div>
                    <i>–</i>
                    <div className="bui-pb-money"><span>₹</span><input className="bui-pb-input" type="text" inputMode="numeric" placeholder="Max" aria-label="Max budget per video" value={form.budgetMax} onKeyDown={blockNonDigitKey} onChange={e => set('budgetMax', digitsOnly(e.target.value))} /></div>
                  </div>
                )}
                <div className="bui-pb-mode">
                  <button type="button" className={form.budgetMode === 'fixed' ? 'on' : ''} onClick={() => set('budgetMode', 'fixed')}>Fixed amount</button>
                  <button type="button" className={form.budgetMode === 'range' ? 'on' : ''} onClick={() => set('budgetMode', 'range')}>Range</button>
                </div>
              </Field>
              {needsShipping && (
                <Field label="Ship product by" req>
                  <input className="bui-pb-input" type="date" min={tomorrowStr} value={form.productShippingBy} onChange={e => set('productShippingBy', e.target.value)} />
                  <small className="bui-pb-hint">Cannot be today - earliest is tomorrow.</small>
                </Field>
              )}
              <Field label={rawDueLabel} req>
                <input className="bui-pb-input" type="date" min={form.productShippingBy || tomorrowStr} value={form.draftDeliveryBy} onChange={e => set('draftDeliveryBy', e.target.value)} />
                <small className="bui-pb-hint">{needsShipping ? (draftDeliverySuggestion ? `Suggested from shipping date: ${draftDeliverySuggestion}` : 'Suggested as product shipping + 7 days.') : 'No product to ship - the creator starts as soon as they accept.'}</small>
              </Field>
              {anyEdited && (
                <Field label="Edited cut due" req>
                  <input className="bui-pb-input" type="date" min={form.draftDeliveryBy || form.productShippingBy || tomorrowStr} value={form.finalDeliveryBy} onChange={e => set('finalDeliveryBy', e.target.value)} />
                  <small className="bui-pb-hint">The creator edits after you approve the raw video.</small>
                </Field>
              )}
              <Field label="Revisions included" req>
                <input className="bui-pb-input" type="number" min="0" value={form.revisions} onChange={e => set('revisions', Number(e.target.value))} />
                <small className="bui-pb-hint">Extra revisions: ₹500 each (₹300 to the creator)</small>
              </Field>
              {editedQuantity > 0 && (
                <Field label="Editing payout per video (₹)">
                  <input className="bui-pb-input" type="number" min="0" readOnly={Boolean(privateCreatorId)} value={form.editingFee} onChange={e => set('editingFee', digitsOnly(e.target.value))} />
                </Field>
              )}
            </div>
            <small className="bui-pb-hint">This is the amount for ONE video. The total for all videos, the 20% platform fee and the listing fee are added up on the right.</small>
            <CheckRow on={form.budgetVisible} onChange={v => set('budgetVisible', v)} hint="Hidden budgets are flagged to admin.">Show budget to creators</CheckRow>
          </section>

          <div className="bui-pb-opt-title">Optional — add if you need</div>

          {/* ───────── Optional: product details ───────── */}
          <Group id="details" title="Product details" desc="Description, key message, objectives, audience, language — recommended" open={!!openGroups.details} need={needCount('details')} onToggle={() => toggleGroup('details')}>
            <Field label="Product description" req>
              <textarea className="bui-pb-input bui-pb-textarea" value={form.productDescription} onChange={e => set('productDescription', e.target.value)} placeholder="Describe the product, who it helps, and what creators should understand before filming." rows={4} />
              <FieldCount value={form.productDescription} min={20} />
            </Field>
            <Field label="Key message" req>
              <input className="bui-pb-input" value={form.keyMessage} onChange={e => set('keyMessage', e.target.value)} placeholder="The one message every video should communicate" />
              <FieldCount value={form.keyMessage} min={10} />
            </Field>
            <Field group label="Objectives" req>
              <div className="bui-pb-chips">{OBJECTIVES.map(item => <Chip key={item} on={form.objectives.includes(item)} onClick={() => set('objectives', [item])}>{item}</Chip>)}</div>
            </Field>
            <Field label="Target audience" req>
              <textarea className="bui-pb-input bui-pb-textarea" value={form.targetAudience} onChange={e => set('targetAudience', e.target.value.slice(0, 200))} placeholder="Urban women 25-35 interested in clean skincare." rows={3} />
              <FieldCount value={form.targetAudience} min={50} max={200} />
            </Field>
            <Field group label="Language" req>
              <div className="bui-pb-chips">{LANGUAGES.map(item => <Chip key={item} on={form.language === item} onClick={() => set('language', item)}>{item}</Chip>)}</div>
            </Field>
          </Group>

          {/* ───────── Optional: must include & must avoid ───────── */}
          <Group id="include" title="Must include & must avoid" desc="Phrases, shots, CTA code, things to keep out" open={!!openGroups.include} need={needCount('include')} onToggle={() => toggleGroup('include')}>
            <div className="bui-pb-grid2">
              <div className="bui-pb-inline">
                <CheckRow on={form.productVisible} onChange={v => set('productVisible', v)}>Product visible on camera</CheckRow>
                {form.productVisible && <input className="bui-pb-input sm" aria-label="Minimum visibility seconds" value={form.visibilitySeconds} onChange={e => set('visibilitySeconds', e.target.value)} placeholder="5 sec min" />}
              </div>
              <div className="bui-pb-inline">
                <CheckRow on={form.verbalMention} onChange={v => set('verbalMention', v)}>Verbal brand mention</CheckRow>
                {form.verbalMention && <input className="bui-pb-input sm" aria-label="Exact product names to say" value={form.productNames} onChange={e => set('productNames', e.target.value)} placeholder="Exact product name(s)" />}
              </div>
            </div>
            <div className="bui-pb-grid2">
              <Field group label="Required phrases"><>{renderTextList('requiredPhrases', 5, 'Perfect for oily skin')}<small className="bui-pb-hint">Up to 5</small></></Field>
              <Field group label="Required shots"><>{renderTextList('requiredShots', 5, 'Close-up of label')}<small className="bui-pb-hint">Up to 5</small></></Field>
            </div>
            <Field group label="Call to action" req>
              <div className="bui-pb-chips">{CTAS.map(item => <Chip key={item} on={form.callToAction === item} onClick={() => set('callToAction', item)}>{item}</Chip>)}</div>
            </Field>
            <div className="bui-pb-grid2">
              {form.callToAction === 'Use code' && (
                <Field label="Promo code" req>
                  <input className="bui-pb-input" value={form.promoCode} onChange={e => set('promoCode', e.target.value)} />
                </Field>
              )}
              {CTA_INPUT[form.callToAction] && (
                <Field label={CTA_INPUT[form.callToAction].label} req>
                  <input className="bui-pb-input" placeholder={CTA_INPUT[form.callToAction].ph} value={form.ctaLink} onChange={e => set('ctaLink', e.target.value)} />
                  {form.ctaLink && !ctaLinkValid(form.callToAction, form.ctaLink) && <small className="bui-pb-err">{CTA_INPUT[form.callToAction].type === 'handle' ? 'Enter a valid @handle or profile link - no random text.' : 'Enter a valid link (e.g. https://yourbrand.com) - no random text.'}</small>}
                </Field>
              )}
              <Field label="Hashtags">
                <input className="bui-pb-input" value={form.hashtags} onChange={e => handleHashtagsChange(e.target.value)} placeholder="#brand #launch" />
                <small className="bui-pb-hint">Max 10</small>
              </Field>
            </div>
            <CheckRow on={form.brandHandleTag} onChange={v => set('brandHandleTag', v)}>Creator tags the brand handle</CheckRow>
            <div className="bui-pb-checks">
              {[
                ['noCompetitors', 'No competitor brands visible'],
                ['noOtherProducts', 'No other products in frame'],
                ['noProfanity', 'No profanity or adult language'],
                ['noPolitical', 'No political or religious content'],
                ['avoidFilters', 'Avoid filters / effects']
              ].map(([field, label]) => <CheckRow key={field} on={form[field]} onChange={v => set(field, v)}>{label}</CheckRow>)}
            </div>
            {form.noCompetitors && (
              <Field label="Competitor list"><input className="bui-pb-input" value={form.competitors} onChange={e => set('competitors', e.target.value)} placeholder="Minimalist, The Derma Co" /></Field>
            )}
            {form.avoidFilters && (
              <Field label="Which filters/effects?"><input className="bui-pb-input" value={form.filterTypes} onChange={e => set('filterTypes', e.target.value)} /></Field>
            )}
            <Field label="Anything else to avoid?">
              <textarea className="bui-pb-input bui-pb-textarea" rows={3} value={form.avoidText} onChange={e => set('avoidText', e.target.value.slice(0, 200))} />
              <FieldCount value={form.avoidText} max={200} />
            </Field>
          </Group>

          {/* ───────── Optional: style & references ───────── */}
          <Group id="style" title="Style & references" desc="Script, tone, pacing, music, mood images" open={!!openGroups.style} need={needCount('style')} onToggle={() => toggleGroup('style')}>
            <Field group label="Who writes the script?" req>
              <div className="bui-pb-chips">
                <Chip on={form.scriptProvider !== 'ugc'} onClick={() => set('scriptProvider', 'brand')}>Brand</Chip>
                <Chip on={form.scriptProvider === 'ugc'} onClick={() => set('scriptProvider', 'ugc')}>UGC.ad</Chip>
              </div>
              <small className="bui-pb-hint">{form.scriptProvider === 'ugc' ? "UGC.ad's team writes the script during brief review - our admin team is notified once you submit the brief, and the script will appear in the brief before the creator starts." : 'Enter the script below. It will be shown to the creator as part of the brief.'}</small>
            </Field>
            {form.scriptProvider !== 'ugc' && (
              <Field label="Script">
                <textarea className="bui-pb-input bui-pb-textarea" rows={5} value={form.scriptText} onChange={e => set('scriptText', e.target.value)} placeholder="Write out the script for the creator to follow..." />
              </Field>
            )}
            <small className="bui-pb-hint">Style is guidance, not grounds for dispute. Creators are expected to interpret it flexibly.</small>
            <Field group label="Tone" req>
              <div className="bui-pb-chips">{TONES.map(item => <Chip key={item} on={form.tones.includes(item)} onClick={() => toggleArray('tones', item)}>{item}</Chip>)}</div>
            </Field>
            <div className="bui-pb-grid2">
              <Field group label="Pacing" req>
                <div className="bui-pb-chips">{['Fast-cut', 'Medium', 'Slow & reflective', 'No preference'].map(item => <Chip key={item} on={form.pacing === item} onClick={() => set('pacing', item)}>{item}</Chip>)}</div>
              </Field>
              <Field group label="Music">
                <div className="bui-pb-chips">{['Original creator audio', 'Trending sound', 'Brand-provided audio file', 'No preference'].map(item => <Chip key={item} on={form.musicPreference === item} onClick={() => set('musicPreference', item)}>{item}</Chip>)}</div>
              </Field>
            </div>
            <Field group label="Mood images (up to 5)">
              <div className="bui-pb-mood">
                {form.moodImages.map((item, index) => {
                  const src = item.startsWith('http') ? item : `${BACKEND_URL}${item}`;
                  const viewable = item.startsWith('http') || item.startsWith('/');
                  return (
                    <div className="bui-pb-thumb" key={`${item}-${index}`}>
                      {viewable
                        ? <a href={src} target="_blank" rel="noreferrer"><img src={src} alt={`Mood board ${index + 1}`} /></a>
                        : <span className="name">{item}</span>}
                      <button type="button" onClick={() => removeMoodImage(index)} aria-label="Remove image"><Trash2 size={13} /></button>
                    </div>
                  );
                })}
                {form.moodImages.length < 5 && (
                  <label className={`bui-pb-thumb add${moodUploading ? ' busy' : ''}`} title="Upload references">
                    {moodUploading ? <span className="name">Uploading…</span> : <Plus size={20} />}
                    <input type="file" multiple accept="image/*" disabled={moodUploading} onChange={uploadMoodImages} />
                  </label>
                )}
              </div>
              <small className="bui-pb-hint">{form.moodImages.length}/5 added · click an image to view it full size</small>
            </Field>
            <Field group label="Reference videos (up to 3)">
              {renderRefVideos(3)}
              <small className="bui-pb-hint">Paste a link, or upload a video file (max 200MB) - creators see uploaded clips inline.</small>
            </Field>
          </Group>

          {/* ───────── Optional: usage rights & creator filters ───────── */}
          <Group id="rights" title="Usage rights & creator filters" desc="Platforms, duration, level, city, gender" open={!!openGroups.rights} need={needCount('rights')} onToggle={() => toggleGroup('rights')}>
            <Field group label="Platforms where content can be posted" req>
              <div className="bui-pb-chips">{PLATFORMS.map(item => <Chip key={item} on={form.platforms.includes(item)} onClick={() => toggleArray('platforms', item)}>{item}</Chip>)}</div>
            </Field>
            <div className="bui-pb-grid2">
              <Field group label="Rights duration" req>
                <div className="bui-pb-chips">{['1 month', '3 months', '6 months', '1 year', '2 years', 'Perpetual'].map(item => <Chip key={item} on={form.rightsDuration === item} onClick={() => set('rightsDuration', item)}>{item}</Chip>)}</div>
              </Field>
              <Field group label="Exclusivity" req>
                <div className="bui-pb-chips">{['None', '15 days', '30 days', '60 days', '90 days'].map(item => <Chip key={item} on={form.exclusivity === item} onClick={() => set('exclusivity', item)}>{item}</Chip>)}</div>
              </Field>
            </div>
            <Field group label="Modification rights" req>
              <div className="bui-pb-chips">{['Yes (full rights)', 'Limited (minor edits only)', 'No (use as-is)'].map(item => <Chip key={item} on={form.modificationRights === item} onClick={() => set('modificationRights', item)}>{item}</Chip>)}</div>
            </Field>
            <CheckRow on={form.whitelisting} onChange={v => set('whitelisting', v)}>Whitelisting / allowlisting (+30%)</CheckRow>
            {pricingLifts.length > 0 && <div className="bui-pb-warn"><AlertTriangle size={16} /> Suggested pricing lifts: {pricingLifts.join('; ')}</div>}
            <div className="bui-pb-grid2">
              <Field group label="Minimum creator level" req>
                <div className="bui-pb-chips">{CREATOR_LEVELS.map(item => <Chip key={item} on={form.creatorLevel === item} onClick={() => set('creatorLevel', item)}>{item}</Chip>)}</div>
              </Field>
              <Field group label="Content quality tier" req>
                <div className="bui-pb-chips">{QUALITY_TIERS.map(item => <Chip key={item} on={form.qualityTier === item} onClick={() => set('qualityTier', item)}>{item}</Chip>)}</div>
              </Field>
            </div>
            <div className="bui-pb-grid2">
              <Field group label="Gender preference">
                <div className="bui-pb-chips">{GENDER_OPTIONS.map(item => <Chip key={item} on={form.genderPreference === item} onClick={() => set('genderPreference', item)}>{item}</Chip>)}</div>
              </Field>
              <Field label="City">
                <select className="bui-pb-input bui-pb-select" value={form.cityFilter} onChange={e => set('cityFilter', e.target.value)}>{CITIES.map(item => <option key={item}>{item}</option>)}</select>
              </Field>
            </div>
            <Field group label="Creator niche tags">
              <div className="bui-pb-chips scroll">{NICHE_TAGS.map(item => <Chip key={item} on={form.nicheTags.includes(item)} onClick={() => toggleNiche(item)}>{item}</Chip>)}</div>
              <small className="bui-pb-hint">Pick as many as fit, or Any to accept every niche.</small>
            </Field>
          </Group>

          <div className="bui-pb-submit">
            <span className="bui-pb-submit-total"><small>Max total</small><b>{inr(totalDebit)}</b></span>
            <button type="button" className="bui-pb-btn primary lg" onClick={reviewAndPublish} disabled={submitting}>{privateCreatorId ? 'Review & send' : 'Review & publish'}</button>
          </div>
        </div>

        {/* ───────── Right: what creators will see + cost ───────── */}
        <aside className="bui-pb-aside">
          <div className="bui-pb-aside-title">What creators will see</div>
          <div className="bui-pb-card bui-pb-preview">
            <div className="bui-pb-prev-head">
              <span className="glow" aria-hidden="true" />
              <div className="brand">{brandLine || 'Your brand'}</div>
              <div className="title">{form.campaignName.trim() || 'Your campaign title'}</div>
            </div>
            <div className="bui-pb-prev-body">
              <div className="row"><span>Pay per video</span><strong>{payPreview}</strong></div>
              <div className="row"><span>Video</span><strong>{videoSummary}</strong></div>
              <div className="row"><span>Product</span><strong>{productPreview}</strong></div>
              <div className="row"><span>{rawDueLabel}</span><strong>{rawDue || '—'}</strong></div>
              {form.campaignHook.trim() && <p className="quote">“{form.campaignHook.trim()}”</p>}
            </div>
          </div>
          <div className="bui-pb-card bui-pb-cost">
            <div className="row"><span>{creatorsCount} creator{creatorsCount === 1 ? '' : 's'} × {totalDeliverables} video{totalDeliverables === 1 ? '' : 's'}</span><span>{inr(budget * totalVideos)}</span></div>
            {editedQuantity > 0 && <div className="row"><span>Creator editing</span><span>{inr(editingTotal)}</span></div>}
            <div className="row"><span>Platform fee 20% + listing</span><span>{inr(commission + listingFee)}</span></div>
            <div className="row total"><span>Max total · held in escrow</span><span>{inr(totalDebit)}</span></div>
          </div>
        </aside>
      </div>

      {showConfirm && createPortal(
        <div className="bui-pb-confirm-bg">
          <div className="bui-pb-confirm" role="dialog" aria-modal="true" aria-labelledby="bui-pb-pubt">
            <div className="bui-pb-confirm-head">
              <span className="glow" aria-hidden="true" />
              <div className="c">{form.campaignName.trim() || 'Your campaign'}</div>
              <h2 id="bui-pb-pubt">{privateCreatorId ? 'Ready to send?' : 'Ready to publish?'}</h2>
            </div>
            <div className="bui-pb-confirm-body">
              <div className="row"><span>Held in escrow from your wallet</span><strong>{inr(totalDebit)}</strong></div>
              <p className="callout">
                <strong>{inr(totalDebit)} will be placed ON HOLD</strong> in your wallet, locked in secure escrow - this money is <strong>held, not spent</strong>.
              </p>
              <p className="breakdown">
                {inr(budget)} per raw video × {totalVideos} videos = {inr(budget * totalVideos)}
                {editedQuantity > 0 && <> + {inr(editingTotal)} creator editing</>}
                {' '}+ {inr(commission)} platform commission (20%) + {inr(listingFee)} listing fee.
              </p>
              <div className="info"><Info size={16} /><span>Our team checks every brief first - usually within a few hours - then creators can see it. Unfilled slots are refunded.</span></div>
              <div className="actions">
                <button type="button" className="bui-pb-btn ghost" onClick={() => setShowConfirm(false)}>Keep editing</button>
                <button type="button" className="bui-pb-btn primary" onClick={publish} disabled={submitting}>{submitting ? 'Publishing...' : (privateCreatorId ? 'Send private brief' : 'Publish campaign')}</button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
});

export default PostABrief;
