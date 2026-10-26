import { useEffect, useMemo, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Check, ChevronRight, ChevronDown, Info, Plus, Minus, Trash2, Upload, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth } from '../../../App';
import { apiErrorMessage } from '../../../utils/apiError';
import { digitsOnly, blockNonDigitKey } from '../../../utils/inputValidators';
import publishPrivateBrief from '../../../utils/publishPrivateBrief';
import { uploadMedia } from '../../../utils/upload';
import withBrandGate from '../../brandkit/withBrandGate';
import AppShell from '../../shell/AppShell';
import BottomSheet from '../../shell/BottomSheet';
import './postbids.css';
import { API, BACKEND_URL, ROUTES, inr, backOr, Thumb, OfflineStrip, useWalletBalance } from './campaignKit';

// Phone version of the "Post a campaign" wizard. Same fields, validation, payload, draft keys and
// endpoints as src/pages/PostABrief.js - only the layout changed (3 essential cards, optional groups in sheets,
// pinned "Review & publish" bar, review screen).

const safeStore = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* draft just isn't kept locally */ } },
  remove: (k) => { try { localStorage.removeItem(k); } catch { /* nothing to clear */ } },
};
const isUploadedUrl = (v) => typeof v === 'string' && /\/uploads?\//i.test(v);

const DRAFT_KEY = 'ugcad-brand-brief-draft-v2';
const DRAFT_ID_KEY = 'ugcad-brand-brief-draft-id-v2';
const DRAFT_OWNER_KEY = 'ugcad-brand-brief-draft-owner-v2';
const COMMISSION_RATE = 0.20;

// Mirrors campaign_listing_fee() in the backend (charged once per brief).
function listingFeeFor(creators, deliverables) {
  const c = Math.max(1, Number(creators) || 1);
  const d = Math.max(1, Number(deliverables) || 1);
  if (c >= 11) return 3000;
  if (c > 1) return 1500;
  return d > 1 ? 1500 : 500;
}

const PRODUCT_TYPES = [
  { value: 'physical', label: 'Physical product', hint: 'You ship an item to the creator' },
  { value: 'digital', label: 'Digital / App', hint: 'App, software or download - nothing to ship' },
  { value: 'service', label: 'Service', hint: 'A service, subscription or experience' },
  { value: 'other', label: 'Other', hint: 'Describe it yourself' },
];
const typeNeedsShipping = (t) => t === 'physical';

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
const resolvedCategory = (f) => (f.category === OTHER_CATEGORY ? f.customCategory.trim() : f.category);

const brandNameOf = (profile, user) => String(
  (profile || {}).brand_name || (user?.profile || {}).business_name || user?.business_name || user?.full_name || user?.nickname || ''
).trim().replace(/^@+/, '');
const matchCategory = (...raws) => {
  const pool = CATEGORIES.filter((c) => c !== OTHER_CATEGORY);
  for (const raw of raws) {
    const s = String(raw || '').trim().toLowerCase();
    if (!s) continue;
    const hit = pool.find((c) => c.toLowerCase() === s)
      || (s.length >= 3 && pool.find((c) => s.includes(c.toLowerCase()) || c.toLowerCase().includes(s)));
    if (hit) return hit;
  }
  return '';
};
const OBJECTIVES = ['Awareness', 'Product launch', 'Seasonal push', 'Testimonial', 'Tutorial', 'Unboxing', 'Comparison', 'Sale promotion', 'Customer education', 'Lead generation', 'Other'];
const DELIVERABLE_TYPES = ['Reel (9:16, under 30s)', 'Short-form (30-60s)', 'YouTube Short (9:16, 60s max)', 'Long-form video (2+ minutes)', 'Static post', 'Carousel post', 'Story set (3-5 frames)', 'Amazon listing video'];
const ASPECTS = ['9:16', '1:1', '16:9', '4:5'];
const CTAS = ['Visit website', 'Use code', 'Swipe up', 'Follow brand', 'None'];
const CTA_INPUT = {
  'Visit website': { label: 'Website link', ph: 'https://yourbrand.com', type: 'url' },
  'Swipe up': { label: 'Swipe-up link', ph: 'https://yourbrand.com/offer', type: 'url' },
  'Follow brand': { label: 'Brand handle to follow', ph: '@yourbrand', type: 'handle' },
};
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
const LANGUAGES = ['Hinglish', 'Hindi', 'English', 'Tamil', 'Telugu', 'Marathi', 'Bengali'];
const TONES = ['Casual', 'Energetic', 'Informative', 'Humorous', 'Aspirational', 'Authentic', 'Educational', 'Trustworthy'];
const CREATOR_LEVELS = ['Any', 'New', 'Verified', 'L1', 'L2', 'Elite'];
const QUALITY_TIERS = ['A', 'A+', 'A++'];
const GENDER_OPTIONS = ['No Preference', 'Female', 'Male', 'Non-binary'];
const CITIES = ['Any City', 'Mumbai', 'Delhi NCR', 'Bengaluru', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Surat', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal', 'Visakhapatnam', 'Patna', 'Vadodara', 'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik', 'Faridabad', 'Meerut', 'Rajkot', 'Varanasi', 'Srinagar', 'Aurangabad', 'Amritsar', 'Navi Mumbai', 'Prayagraj', 'Ranchi', 'Coimbatore', 'Jabalpur', 'Gwalior', 'Vijayawada', 'Jodhpur', 'Madurai', 'Raipur', 'Kota', 'Guwahati', 'Chandigarh', 'Noida', 'Gurugram', 'Thiruvananthapuram', 'Kochi', 'Mysuru', 'Bhubaneswar', 'Dehradun', 'Mangaluru', 'Tiruchirappalli', 'Jamshedpur', 'Panaji (Goa)', 'Puducherry', 'Udaipur', 'Salem', 'Warangal', 'Guntur', 'Bhilai', 'Jalandhar', 'Bikaner', 'Siliguri', 'Nellore', 'Ajmer', 'Shimla', 'Other'];
const ANY_NICHE = 'Any';
const NICHE_TAGS = [ANY_NICHE, ...CATEGORY_GROUPS.flatMap((g) => g.items)];
const VIDEO_DELIVERABLES = ['Reel', 'Short-form', 'YouTube Short', 'Long-form video', 'Amazon listing video'];
const PLATFORMS = [
  "Brand's own Instagram", "Brand's own TikTok / Reels", "Brand's own YouTube", "Brand's own website", "Brand's email marketing",
  'Paid ads on Meta platforms', 'Paid ads on Google / YouTube', 'Paid ads on other platforms', 'Out-of-home (billboards, print)',
  'B2B sales materials (pitch decks, demos)', 'Third-party aggregators / marketplaces',
];

const createDeliverable = () => ({
  id: globalThis.crypto?.randomUUID?.() || String(Date.now() + Math.random()),
  type: '', quantity: 1, duration: '', aspectRatios: ['9:16'], editedRequired: false, editedBy: 'creator',
});

const initialForm = {
  campaignName: '', image: '', brandName: '', category: '', customCategory: '', productType: 'physical', customProductType: '',
  productName: '', productDescription: '', campaignHook: '', keyMessage: '', objectives: [], targetAudience: '', language: 'Hinglish',
  budgetVisible: true, deliverables: [createDeliverable()], scriptProvider: 'brand', scriptText: '', productVisible: true,
  visibilitySeconds: '', verbalMention: true, productNames: '', requiredPhrases: [''], requiredShots: [''], callToAction: 'Visit website',
  promoCode: '', ctaLink: '', hashtags: '', brandHandleTag: true, noCompetitors: true, competitors: '', noOtherProducts: true,
  noProfanity: true, noPolitical: true, avoidFilters: false, filterTypes: '', avoidText: '', tones: [], pacing: 'No preference',
  moodImages: [], referenceVideos: [''], musicPreference: 'No preference', platforms: [], rightsDuration: '', exclusivity: 'None',
  whitelisting: false, modificationRights: '', productShippingBy: '', draftDeliveryBy: '', revisions: 2, creatorsWanted: 1,
  finalDeliveryBy: '', budgetMode: 'fixed', fixedBudget: '', editingFee: '', budgetMin: '', budgetMax: '', creatorLevel: '',
  qualityTier: '', genderPreference: 'No Preference', cityFilter: 'Any City', nicheTags: [],
};

const isVideoDeliverable = (type = '') => VIDEO_DELIVERABLES.some((label) => type.startsWith(label));
const parseDurationSeconds = (value = '') => { const m = String(value).match(/\d+/); return m ? Number(m[0]) : 30; };
const addDays = (dateString, days) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
};
const fmtShort = (d) => { if (!d) return ''; const t = new Date(`${d}T00:00:00`); return Number.isNaN(t.getTime()) ? d : t.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }); };

// Best-effort restore of a server-saved draft / duplicate source into the form (same mapping as the website).
function mapCampaignToForm(c) {
  if (!c || typeof c !== 'object') return {};
  const out = {};
  const put = (key, value) => { if (value !== undefined && value !== null && value !== '') out[key] = value; };
  put('campaignName', c.title);
  put('brandName', c.brand_name);
  const storedCategory = String(c.product_category || c.category || '').trim();
  if (storedCategory) {
    const known = CATEGORIES.find((x) => x.toLowerCase() === storedCategory.toLowerCase() && x !== OTHER_CATEGORY);
    if (known) { out.category = known; out.customCategory = ''; } else { out.category = OTHER_CATEGORY; out.customCategory = storedCategory; }
  }
  if (PRODUCT_TYPES.some((p) => p.value === c.product_type)) put('productType', c.product_type);
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
  putBool('noCompetitors', c.no_competitors);
  put('competitors', c.competitors_text);
  putBool('noOtherProducts', c.no_other_products);
  putBool('noProfanity', c.no_profanity);
  putBool('noPolitical', c.no_political);
  putBool('avoidFilters', c.avoid_filters);
  put('filterTypes', c.filter_types_text);
  put('avoidText', c.avoid_text);
  put('musicPreference', c.music_preference);
  putArr('referenceVideos', c.reference_videos);
  putArr('moodImages', c.mood_images);
  putArr('platforms', c.usage_platforms);
  put('rightsDuration', c.rights_duration);
  put('exclusivity', c.exclusivity);
  putBool('whitelisting', c.whitelisting);
  put('modificationRights', c.modification_rights);
  // Never carry an elapsed date into a copy/resume.
  const tomorrow = addDays(new Date().toISOString().slice(0, 10), 1);
  const futureOnly = (d) => (d && String(d) >= tomorrow ? d : '');
  put('productShippingBy', futureOnly(c.product_shipping_by) || tomorrow);
  put('draftDeliveryBy', futureOnly(c.draft_delivery_by));
  putBool('budgetVisible', c.budget_visible);
  if (Array.isArray(c.deliverable_items) && c.deliverable_items.length) {
    out.deliverables = c.deliverable_items.map((d) => ({
      ...createDeliverable(), type: d.type || '', quantity: d.quantity || 1, duration: d.duration || '',
      aspectRatios: Array.isArray(d.aspect_ratios) && d.aspect_ratios.length ? d.aspect_ratios : ['9:16'],
      editedRequired: Boolean(d.edited_required), editedBy: d.edited_by === 'ugc' ? 'ugc' : 'creator',
    }));
  } else {
    const primaryType = c.brief_type || c.video_format;
    if (primaryType) {
      const primary = { ...createDeliverable(), type: primaryType, aspectRatios: c.aspect_ratio ? [c.aspect_ratio] : ['9:16'], duration: c.duration_seconds ? `${c.duration_seconds} seconds` : '' };
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
  if (c.creators_wanted !== undefined && c.creators_wanted !== null) out.creatorsWanted = Math.max(1, Number(c.creators_wanted) || 1);
  const bMin = Number(c.budget_min || 0);
  out.editingFee = String(c.editing_fee_per_video || '');
  const bMax = Number(c.per_video_budget || c.budget_max || 0);
  if (bMax > 0) {
    if (bMin && bMin !== bMax) { out.budgetMode = 'range'; out.budgetMin = String(bMin); out.budgetMax = String(bMax); } else { out.budgetMode = 'fixed'; out.fixedBudget = String(bMax); }
  }
  return out;
}

// ── small presentational pieces (module level so inputs keep focus while typing) ──
function Chip({ on, onClick, children, title }) {
  return <button type="button" className={`ap-chip ap-cp-pick${on ? ' is-on' : ''}`} aria-pressed={!!on} title={title} onClick={onClick}>{on && <Check size={14} />}{children}</button>;
}
function Chips({ children }) { return <div className="ap-cp-chips">{children}</div>; }
function Field({ label, req, hint, group, children, error }) {
  const cap = <span className="ap-cp-flab">{label}{req && <em> *</em>}</span>;
  return group
    ? <div className="ap-cp-field" role="group" aria-label={label}>{cap}{children}{error ? <small className="ap-cp-err">{error}</small> : null}{hint ? <small className="ap-cp-hint">{hint}</small> : null}</div>
    : <label className="ap-cp-field">{cap}{children}{error ? <small className="ap-cp-err">{error}</small> : null}{hint ? <small className="ap-cp-hint">{hint}</small> : null}</label>;
}
function Count({ value, min = 0, max = null }) {
  const len = String(value || '').trim().length;
  const need = min - len;
  if (need > 0) return <small className="ap-cp-hint is-need">{need} more character{need === 1 ? '' : 's'} needed</small>;
  return <small className="ap-cp-hint">{max ? `${len}/${max} characters` : `${len} characters`}</small>;
}
function Stepper({ value, onChange, min = 0, max = 99, label }) {
  return (
    <span className="ap-cp-step" role="group" aria-label={label}>
      <button type="button" aria-label={`Fewer ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}><Minus size={16} /></button>
      <strong aria-live="polite">{value}</strong>
      <button type="button" className="is-plus" aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}><Plus size={16} /></button>
    </span>
  );
}
function Check2({ on, onChange, children, hint }) {
  return (
    <label className="ap-cp-check">
      <input type="checkbox" checked={!!on} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}{hint && <small className="ap-cp-hint"> {hint}</small>}</span>
    </label>
  );
}

function EssentialCard({ n, title, done, open, onToggle, issues, summary, id, children }) {
  return (
    <section className="ap-card ap-cp-ess" id={id}>
      <button type="button" className="ap-cp-esshead" aria-expanded={open} onClick={onToggle}>
        <span className={`ap-cp-num${done ? ' is-done' : ''}`}>{done ? <Check size={14} strokeWidth={3} /> : n}</span>
        <span className="ap-cp-esst">{title}</span>
        {done && !open ? <span className="ap-cp-ok">Done</span> : issues > 0 ? <span className="ap-cp-need">{issues} to fill</span> : null}
        <ChevronDown size={18} className={`ap-cp-chev${open ? ' is-open' : ''}`} aria-hidden="true" />
      </button>
      {!open && done && summary && <div className="ap-cp-esssum">{summary}</div>}
      {open && <div className="ap-cp-essbody">{children}</div>}
    </section>
  );
}

function PostCampaign() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const privateCreatorId = searchParams.get('creator');
  // Read once: changing ?step= for the review screen must not re-trigger loading a draft / duplicate.
  const [resumeId] = useState(() => searchParams.get('draft'));
  const [dupId] = useState(() => searchParams.get('duplicate'));
  const reviewing = searchParams.get('step') === 'review';

  const [form, setForm] = useState(initialForm);
  const [openCard, setOpenCard] = useState('s1');
  const [group, setGroup] = useState(null);       // open optional sheet: details | include | style | rights
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState('');
  const [draftId, setDraftId] = useState(() => safeStore.get(DRAFT_ID_KEY) || null);
  const [savingDraft, setSavingDraft] = useState(false);
  const [privateRates, setPrivateRates] = useState(null);
  const [moodUploading, setMoodUploading] = useState(false);
  const [uploadingKey, setUploadingKey] = useState('');
  const [wallet] = useWalletBalance(reviewing);
  const brandFromProfile = useRef('');
  const lastAutoSaveRef = useRef('');
  const publishedRef = useRef(false);
  const submitLock = useRef(false);

  const set = (field, value) => setForm((cur) => ({ ...cur, [field]: value }));
  const toggleArray = (field, value) => setForm((cur) => {
    const values = cur[field] || [];
    return { ...cur, [field]: values.includes(value) ? values.filter((v) => v !== value) : [...values, value] };
  });
  const toggleNiche = (value) => setForm((cur) => {
    const values = cur.nicheTags || [];
    if (value === ANY_NICHE) return { ...cur, nicheTags: values.includes(value) ? [] : [ANY_NICHE] };
    const without = values.filter((v) => v !== value && v !== ANY_NICHE);
    return { ...cur, nicheTags: values.includes(value) ? without : [...without, value] };
  });

  // Private brief for one creator (?creator=): the creator's own rates fix the price.
  useEffect(() => {
    if (!privateCreatorId) return undefined;
    let active = true;
    setPrivateRates(null);
    axios.get(`${API}/profile/${encodeURIComponent(privateCreatorId)}`).then(({ data }) => {
      const profile = data.profile || data;
      const rates = profile.rate_card || {};
      const flat = Number(String(rates.raw_payout || rates.expected_payout || profile.expectedPayout || '').replace(/[^0-9.]/g, ''));
      const samples = data.portfolio || profile.portfolio_items || profile.portfolio || [];
      const prices = (Array.isArray(samples) ? samples : []).map((s) => Number(s?.price || s?.price_per_video || 0)).filter((p) => p > 0);
      const raw = flat || (prices.length ? Math.min(...prices) : 0);
      if (!active) return;
      setPrivateRates({ raw, editing: Number(rates.editing_payout || 0) });
      setForm((cur) => ({ ...cur, creatorsWanted: 1, budgetMode: 'fixed', fixedBudget: String(raw || ''), editingFee: String(rates.editing_payout || 0) }));
    }).catch(() => { if (active) toast.error('Unable to load creator rates. Reopen the brief to retry.'); });
    return () => { active = false; };
  }, [privateCreatorId]);

  // Local draft + brand profile (name and default category).
  useEffect(() => {
    const owner = safeStore.get(DRAFT_OWNER_KEY);
    const foreignDraft = !!(user?.id && owner && owner !== String(user.id));
    if (foreignDraft) {
      safeStore.remove(DRAFT_KEY); safeStore.remove(DRAFT_ID_KEY); safeStore.remove(DRAFT_OWNER_KEY);
      setDraftId(null); setForm(initialForm);
    }
    if (user?.id) safeStore.set(DRAFT_OWNER_KEY, String(user.id));
    const saved = foreignDraft || dupId ? null : safeStore.get(DRAFT_KEY);
    if (saved) {
      try { setForm({ ...initialForm, ...JSON.parse(saved) }); } catch { safeStore.remove(DRAFT_KEY); }
    }
    axios.get(`${API}/business/settings/profile`)
      .then((res) => {
        const profile = res.data || {};
        const up = user?.profile || {};
        const fromProfile = brandNameOf(profile, user);
        brandFromProfile.current = fromProfile;
        setForm((cur) => ({
          ...cur,
          brandName: fromProfile || cur.brandName,
          category: cur.category || matchCategory(profile.primary_category, profile.business_category, profile.industry_category, profile.category, profile.product_type, up.industry_category, up.business_category, up.category),
        }));
      })
      .catch(() => {
        const fallback = brandNameOf(null, user);
        brandFromProfile.current = fallback;
        setForm((cur) => ({ ...cur, brandName: fallback || cur.brandName }));
      });
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Resume a server draft (?draft=<id>): saving / publishing then PATCHes that same draft.
  useEffect(() => {
    if (!resumeId) return;
    setDraftId(resumeId);
    safeStore.set(DRAFT_ID_KEY, resumeId);
    axios.get(`${API}/campaigns/${resumeId}`)
      .then((res) => {
        const mapped = mapCampaignToForm(res.data);
        if (Object.keys(mapped).length) {
          setForm((cur) => ({ ...cur, ...mapped, brandName: brandFromProfile.current || mapped.brandName || cur.brandName }));
          toast.success('Draft loaded - continue where you left off');
        }
      })
      .catch(() => toast.error('Could not load that draft'));
  }, [resumeId]);

  // Duplicate an existing campaign (?duplicate=<id>): no draftId, so publishing creates a new copy.
  useEffect(() => {
    if (!dupId) return;
    setDraftId(null);
    safeStore.remove(DRAFT_ID_KEY);
    axios.get(`${API}/campaigns/${dupId}`)
      .then((res) => {
        const mapped = mapCampaignToForm(res.data);
        const n = Object.keys(mapped).length;
        setForm((cur) => ({ ...cur, ...mapped, brandName: brandFromProfile.current || mapped.brandName || cur.brandName }));
        toast.success(`Copied brief loaded - ${n} field${n === 1 ? '' : 's'} carried over. Edit and publish.`);
      })
      .catch(() => toast.error('Could not load that brief to duplicate'));
  }, [dupId]);

  useEffect(() => {
    if (form === initialForm) return; // untouched: don't overwrite a saved local draft before it is restored (StrictMode re-runs effects)
    safeStore.set(DRAFT_KEY, JSON.stringify(form));
    setDraftSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }, [form]);

  // ── money ──
  const budget = privateCreatorId ? (privateRates?.raw || 0) : Number(form.budgetMode === 'fixed' ? form.fixedBudget : form.budgetMax) || 0;
  const creatorsCount = privateCreatorId ? 1 : Math.max(1, Number(form.creatorsWanted) || 1);
  const totalDeliverables = form.deliverables.reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0);
  const totalVideos = totalDeliverables * creatorsCount;
  const editedQuantity = form.deliverables.reduce((sum, item) => sum + (item.editedRequired && item.editedBy !== 'ugc' ? Number(item.quantity) || 1 : 0), 0);
  const editingRate = privateCreatorId ? (privateRates?.editing || 0) : Math.max(0, Number(form.editingFee) || 0);
  const editingTotal = editingRate * editedQuantity * creatorsCount;
  const totalBudget = budget * totalVideos + editingTotal;
  const commission = Math.round(totalBudget * COMMISSION_RATE);
  const anyEdited = form.deliverables.some((item) => item.editedRequired && item.editedBy !== 'ugc');
  const listingFee = listingFeeFor(creatorsCount, totalDeliverables);
  const totalDebit = totalBudget + commission + listingFee;
  const paidAdsSelected = form.platforms.some((p) => p.toLowerCase().includes('paid ads'));
  const needsShipping = typeNeedsShipping(form.productType);
  const tomorrowStr = addDays(new Date().toISOString().slice(0, 10), 1);
  const draftDeliverySuggestion = useMemo(() => addDays(form.productShippingBy, 7), [form.productShippingBy]);
  const finalDeliverySuggestion = useMemo(() => addDays(form.draftDeliveryBy, Math.max(1, Number(form.revisions || 0) * 2)), [form.draftDeliveryBy, form.revisions]);
  const pricingLifts = [
    form.rightsDuration === 'Perpetual' ? 'Perpetual rights: +40% suggested' : '',
    form.whitelisting ? 'Whitelisting enabled: +30% suggested' : '',
    form.exclusivity === '90 days' ? '90-day exclusivity: +25% suggested' : '',
    paidAdsSelected ? 'Paid ads allowed: +20% suggested' : '',
  ].filter(Boolean);

  useEffect(() => { if (!form.draftDeliveryBy && draftDeliverySuggestion) set('draftDeliveryBy', draftDeliverySuggestion); }, [draftDeliverySuggestion]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!form.finalDeliveryBy && finalDeliverySuggestion) set('finalDeliveryBy', finalDeliverySuggestion); }, [finalDeliverySuggestion]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateDeliverable = (id, patch) => set('deliverables', form.deliverables.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const addDeliverable = () => {
    if (form.deliverables.length >= 5) { toast.error('You can add up to 5 deliverables'); return; }
    set('deliverables', [...form.deliverables, createDeliverable()]);
  };
  const removeDeliverable = (id) => { if (form.deliverables.length > 1) set('deliverables', form.deliverables.filter((it) => it.id !== id)); };
  const addTextItem = (field, max) => { if ((form[field] || []).length < max) set(field, [...(form[field] || []), '']); };
  const updateTextItem = (field, index, value) => set(field, form[field].map((it, i) => (i === index ? value : it)));
  const removeTextItem = (field, index) => { const next = form[field].filter((_, i) => i !== index); set(field, next.length ? next : ['']); };

  // ── uploads ──
  const uploadMoodImages = async (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
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
    } catch (err) { toast.error(apiErrorMessage(err, 'Could not upload mood board image')); } finally { setMoodUploading(false); }
  };
  const uploadRefVideo = async (index, file) => {
    if (!file) return;
    setUploadingKey(`ref-${index}`);
    try {
      const data = await uploadMedia(file, API);
      const url = data.file_url || data.url || '';
      if (!url) throw new Error('No URL returned');
      updateTextItem('referenceVideos', index, url);
      toast.success('Reference video uploaded');
    } catch (error) { toast.error(apiErrorMessage(error, 'Could not upload that video')); } finally { setUploadingKey(''); }
  };

  // ── validation: identical rules to the website ──
  const issues = (() => {
    const m = [];
    const add = (g, msg) => m.push({ g, msg });
    if (form.campaignName.trim().length < 3) add('s1', 'Campaign name (min 3 chars)');
    if (form.productType === 'other' && !form.customProductType.trim()) add('s1', 'Describe your product type');
    if (!form.productName.trim()) add('s1', needsShipping ? 'Product name' : 'What you’re promoting (name)');
    if (form.campaignHook.trim().length < 10) add('s1', 'Campaign hook (min 10 chars)');
    if (!form.category) add('s1', 'Category');
    else if (form.category === OTHER_CATEGORY && !form.customCategory.trim()) add('s1', 'Type your category');
    if (form.productDescription.trim().length < 20) add('details', 'Product description (min 20 chars)');
    if (form.keyMessage.trim().length < 10) add('details', 'Key message (min 10 chars)');
    if (form.objectives.length === 0) add('details', 'Campaign objective');
    const ta = form.targetAudience.trim().length;
    if (ta < 50 || ta > 200) add('details', 'Target audience (50–200 chars)');
    if (!(form.deliverables.length > 0 && form.deliverables.every((i) => i.type && i.quantity >= 1 && i.quantity <= 5 && i.aspectRatios.length > 0 && (!isVideoDeliverable(i.type) || i.duration)))) add('s2', 'Each video: type, quantity 1–5, aspect ratio (+ length for video)');
    if (form.productVisible && !form.visibilitySeconds) add('include', 'Product visibility seconds');
    if (form.verbalMention && !form.productNames) add('include', 'Product names to mention');
    if (!form.callToAction) add('include', 'Call to action');
    if (form.callToAction === 'Use code' && !form.promoCode) add('include', 'Promo code');
    if (CTA_INPUT[form.callToAction] && !ctaLinkValid(form.callToAction, form.ctaLink)) add('include', `${CTA_INPUT[form.callToAction].label} (valid ${CTA_INPUT[form.callToAction].type === 'handle' ? 'handle or link' : 'link'})`);
    if (form.tones.length === 0) add('style', 'Tone tags');
    if (!form.pacing) add('style', 'Pacing reference');
    if (form.platforms.length === 0) add('rights', 'Platforms');
    if (!form.rightsDuration) add('rights', 'Rights duration');
    if (!form.exclusivity) add('rights', 'Exclusivity');
    if (!form.modificationRights) add('rights', 'Modification rights');
    if (!form.creatorLevel) add('rights', 'Creator level');
    if (!form.qualityTier) add('rights', 'Quality tier');
    if (needsShipping && (!form.productShippingBy || form.productShippingBy < tomorrowStr)) add('s3', 'Product shipping date (tomorrow or later)');
    const draftMin = needsShipping && form.productShippingBy ? form.productShippingBy : tomorrowStr;
    if (!form.draftDeliveryBy || form.draftDeliveryBy < draftMin) add('s3', needsShipping ? 'Draft delivery date (on or after shipping)' : 'Draft delivery date (tomorrow or later)');
    if (anyEdited && (!form.finalDeliveryBy || form.finalDeliveryBy < form.draftDeliveryBy)) add('s3', 'Edited video date (on or after the raw video date)');
    if (!(budget > 0)) add('s3', 'Budget');
    return m;
  })();
  const need = (g) => issues.filter((i) => i.g === g).length;
  const essentialsDone = ['s1', 's2', 's3'].filter((g) => need(g) === 0).length;

  const goForm = () => { if (reviewing) navigate(-1); };

  const reviewAndPublish = () => {
    setAttempted(true);
    if (issues.length) {
      toast.error(`Complete to continue: ${issues.slice(0, 3).map((i) => i.msg).join(', ')}${issues.length > 3 ? ` and ${issues.length - 3} more` : ''}`);
      const first = issues[0].g;
      if (['s1', 's2', 's3'].includes(first)) setOpenCard(first); else setGroup(first);
      setTimeout(() => document.getElementById(`ap-cp-${first}`)?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }), 80);
      return;
    }
    setSearchParams((prev) => { const n = new URLSearchParams(prev); n.set('step', 'review'); return n; });
  };
  // Review screen without a complete form (deep link / reload): fall back to the form.
  useEffect(() => { if (reviewing && issues.length) setSearchParams((prev) => { const n = new URLSearchParams(prev); n.delete('step'); return n; }, { replace: true }); }, [reviewing, issues.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── drafts ──
  const avoidRules = [
    form.noCompetitors ? `No competitor brands visible${form.competitors ? `: ${form.competitors}` : ''}` : '',
    form.noOtherProducts ? 'No other products in frame' : '',
    form.noProfanity ? 'No profanity or adult language' : '',
    form.noPolitical ? 'No political or religious content' : '',
    form.avoidFilters ? `Avoid filters / effects${form.filterTypes ? `: ${form.filterTypes}` : ''}` : '',
    form.avoidText ? `Specific avoid: ${form.avoidText}` : '',
  ].filter(Boolean).join('; ') || 'None';

  const briefText = () => [
    `Campaign: ${form.campaignName}`, `Brand: ${form.brandName}`, `Category: ${resolvedCategory(form)}`, `Product: ${form.productName}`,
    `Product description: ${form.productDescription}`, `Hook: ${form.campaignHook}`, `Key message: ${form.keyMessage}`,
    `Objectives: ${form.objectives.join(', ')}`, `Target audience: ${form.targetAudience}`, `Video language: ${form.language}`,
    `Budget visibility: ${form.budgetVisible ? 'Visible to creators' : 'Hidden from creators - admin flag'}`, '', 'Deliverables:',
    ...form.deliverables.map((item, index) => `${index + 1}. ${item.quantity} x ${item.type}; duration ${item.duration || 'n/a'}; ratios ${item.aspectRatios.join(', ')}; deliver ${item.editedRequired ? `raw footage + an edited cut (edited by ${item.editedBy === 'ugc' ? 'UGC.ad' : 'creator'})` : 'raw footage only'}`),
    '', `Script: ${form.scriptProvider === 'ugc' ? 'Provided by UGC.ad (added during brief review)' : (form.scriptText.trim() || 'none')}`, '',
    `Must include: product visible ${form.productVisible ? `${form.visibilitySeconds}s minimum` : 'no'}; verbal mention ${form.verbalMention ? form.productNames : 'no'}; CTA ${form.callToAction}; promo ${form.promoCode || 'n/a'}; hashtags ${form.hashtags || 'n/a'}; brand tag ${form.brandHandleTag ? 'yes' : 'no'}`,
    `Required phrases: ${form.requiredPhrases.filter(Boolean).join(', ') || 'none'}`,
    `Required shots: ${form.requiredShots.filter(Boolean).join(', ') || 'none'}`,
    `Must avoid: competitors ${form.noCompetitors ? form.competitors || 'listed competitors' : 'not specified'}; other products ${form.noOtherProducts ? 'no' : 'allowed'}; profanity ${form.noProfanity ? 'no' : 'allowed'}; political/religious ${form.noPolitical ? 'no' : 'allowed'}; filters ${form.avoidFilters ? form.filterTypes || 'avoid' : 'allowed'}; specific avoid ${form.avoidText || 'none'}`,
    `Style guidance: tones ${form.tones.join(', ')}; pacing ${form.pacing}; music ${form.musicPreference}; references ${form.referenceVideos.filter(Boolean).join(', ') || 'none'}`,
    `Usage rights: platforms ${form.platforms.join(', ')}; duration ${form.rightsDuration}; exclusivity ${form.exclusivity}; whitelisting ${form.whitelisting ? 'yes' : 'no'}; modification ${form.modificationRights}`,
    `Creator targeting: level ${form.creatorLevel}; quality ${form.qualityTier}; gender ${form.genderPreference}; city ${form.cityFilter}; niches ${form.nicheTags.join(', ') || 'none'}`,
    `Timeline: ${needsShipping ? `ship by ${form.productShippingBy}; ` : ''}${anyEdited ? 'raw video' : 'delivery'} by ${form.draftDeliveryBy}; revisions ${form.revisions}${anyEdited ? `; edited video by ${form.finalDeliveryBy}` : ''}`,
    `Budget: ${form.budgetMode === 'fixed' ? `fixed Rs. ${form.fixedBudget}` : `range Rs. ${form.budgetMin} - Rs. ${form.budgetMax}`}`,
    `Commission: platform 20%, total wallet debit Rs. ${totalDebit} (Rs. ${budget} per raw video x ${totalVideos} videos, editing Rs. ${editingTotal}), each creator receives Rs. ${budget * totalDeliverables + editingTotal / creatorsCount} pre-tax`,
  ].join('\n');

  const buildPayload = () => {
    const primary = form.deliverables[0] || {};
    return {
      title: form.campaignName, image_url: form.image || '', brief_text: briefText(),
      budget_min: form.budgetMode === 'fixed' ? budget : Number(form.budgetMin || 0), budget_max: budget,
      objectives: form.objectives, requires_shipment: needsShipping, shipment_required: needsShipping, shipment_option: needsShipping ? 'yes' : 'no',
      product_type: form.productType, product_type_detail: form.productType === 'other' ? form.customProductType.trim() : '',
      due_date: anyEdited ? form.finalDeliveryBy : form.draftDeliveryBy, deadline: anyEdited ? form.finalDeliveryBy : form.draftDeliveryBy,
      revision_limit: Number(form.revisions || 0), creators_wanted: Math.max(1, Number(form.creatorsWanted) || 1),
      product_name: form.productName, category: resolvedCategory(form), product_category: resolvedCategory(form),
      product_description: form.productDescription, brief_type: primary.type, campaign_hook: form.campaignHook, key_message: form.keyMessage,
      what_not_to_do: avoidRules, tone_reference: form.pacing, tone_tags: form.tones, video_format: primary.type,
      aspect_ratio: primary.aspectRatios?.[0], duration_seconds: parseDurationSeconds(primary.duration),
      additional_deliverables: form.deliverables.slice(1).map((item) => `${item.quantity} x ${item.type}`),
      free_revisions: Number(form.revisions || 0), creator_level: form.creatorLevel, content_quality_tier: form.qualityTier,
      gender_preference: form.genderPreference, city_filter: form.cityFilter, creator_niche_tags: form.nicheTags,
      per_video_budget: budget, editing_fee_per_video: editingRate,
      ...(privateCreatorId ? { selected_creator: privateCreatorId, visibility: 'private', creators_wanted: 1 } : {}),
      total_budget: totalBudget, currency: 'INR',
      target_audience: form.targetAudience, language: form.language, budget_visible: form.budgetVisible, budget_mode: form.budgetMode,
      deliverable_items: form.deliverables.map((item) => ({
        type: item.type, quantity: item.quantity, duration: item.duration, aspect_ratios: item.aspectRatios, raw_required: true,
        edited_required: item.editedRequired, edited_by: item.editedBy,
      })),
      script_provider: form.scriptProvider, script_text: form.scriptProvider === 'ugc' ? '' : form.scriptText,
      product_visible: form.productVisible, product_visible_seconds: form.visibilitySeconds, verbal_mention: form.verbalMention,
      verbal_mention_text: form.productNames, required_phrases: form.requiredPhrases, required_shots: form.requiredShots,
      call_to_action: form.callToAction, cta_link: form.ctaLink, promo_code: form.promoCode, hashtags: form.hashtags,
      brand_handle_tag: form.brandHandleTag, no_competitors: form.noCompetitors, competitors_text: form.competitors,
      no_other_products: form.noOtherProducts, no_profanity: form.noProfanity, no_political: form.noPolitical,
      avoid_filters: form.avoidFilters, filter_types_text: form.filterTypes, avoid_text: form.avoidText, pacing: form.pacing,
      music_preference: form.musicPreference, reference_videos: form.referenceVideos, mood_images: form.moodImages,
      usage_platforms: form.platforms, rights_duration: form.rightsDuration, exclusivity: form.exclusivity,
      whitelisting: form.whitelisting, modification_rights: form.modificationRights,
      product_shipping_by: needsShipping ? form.productShippingBy : '', draft_delivery_by: form.draftDeliveryBy,
      final_delivery_by: anyEdited ? form.finalDeliveryBy : form.draftDeliveryBy,
    };
  };

  // Update the server draft when we have one; a stale id (deleted / another account) creates a fresh draft.
  const pushDraft = async (payload) => {
    if (draftId) {
      try { await axios.patch(`${API}/campaigns/${draftId}`, payload); return draftId; } catch (err) {
        const code = err?.response?.status;
        if (code !== 403 && code !== 404) throw err;
        setDraftId(null); safeStore.remove(DRAFT_ID_KEY);
      }
    }
    const res = await axios.post(`${API}/campaigns/draft`, payload);
    const newId = res.data?.campaign_id || res.data?.id || res.data?._id;
    if (newId) {
      setDraftId(newId); safeStore.set(DRAFT_ID_KEY, newId);
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
      lastAutoSaveRef.current = JSON.stringify(form);
      toast.success('Draft saved to your account');
    } catch (error) {
      // Local copy is safe, but do not call this a success.
      toast.warning('Saved on this device only', { description: apiErrorMessage(error, "We couldn't save it to your account - it won't show in Drafts until it saves.") });
    } finally { setSavingDraft(false); }
  };

  // Silent account draft a moment after the user stops editing, and when leaving.
  const briefHasContent = (f) => (f.campaignName || '').trim().length >= 2 || (f.productName || '').trim().length >= 2 || (f.productDescription || '').trim().length >= 10;
  const autoSave = async () => {
    if (publishedRef.current || savingDraft || submitting) return;
    if (!briefHasContent(form)) return;
    const snapshot = JSON.stringify(form);
    if (snapshot === lastAutoSaveRef.current) return;
    lastAutoSaveRef.current = snapshot;
    try { await pushDraft(buildPayload()); setDraftSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })); } catch { lastAutoSaveRef.current = ''; }
  };
  const autoSaveRef = useRef(autoSave);
  autoSaveRef.current = autoSave;
  useEffect(() => {
    if (!briefHasContent(form)) return undefined;
    const t = setTimeout(() => autoSaveRef.current(), 1500);
    return () => clearTimeout(t);
  }, [form]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { autoSaveRef.current(); }, []);

  const clearDraftStorage = () => {
    publishedRef.current = true;
    safeStore.remove(DRAFT_KEY); safeStore.remove(DRAFT_ID_KEY); safeStore.remove(DRAFT_OWNER_KEY);
    setDraftId(null);
  };

  const publish = async () => {
    if (submitLock.current) return;
    if (privateCreatorId && (!privateRates || privateRates.raw <= 0)) { toast.error('The creator must set their raw video rate before sending a brief.'); return; }
    submitLock.current = true;
    setSubmitting(true);
    try {
      if (privateCreatorId) {
        await publishPrivateBrief(axios, API, draftId, { ...buildPayload(), selected_creator: privateCreatorId, visibility: 'private' });
        clearDraftStorage();
        toast.success('Private brief submitted for approval');
        navigate('/dashboard/business/sent-briefs', { replace: true });
        return;
      }
      // "Request Matches": ops curates a shortlist (website default).
      const payload = { ...buildPayload(), match_requested: true };
      let promoted = false;
      if (draftId) {
        try {
          await axios.patch(`${API}/campaigns/${draftId}`, payload);
          await axios.post(`${API}/campaigns/${draftId}/submit`);
          promoted = true;
        } catch (err) {
          const code = err?.response?.status;
          if (code !== 404 && code !== 403) throw err;
        }
      }
      if (!promoted) await axios.post(`${API}/campaigns`, { ...payload, status: 'pending_approval' });
      clearDraftStorage();
      toast.success('Brief submitted for review - creators can see it once our team approves it');
      navigate(ROUTES.campaigns, { replace: true });
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to publish brief'));
    } finally { submitLock.current = false; setSubmitting(false); }
  };

  const retryRates = useCallback(() => window.location.reload(), []);

  // ── fields ──
  const handleHashtags = (value) => {
    const tags = value.split(/\s+/).filter(Boolean);
    set('hashtags', tags.length > 10 ? tags.slice(0, 10).join(' ') : value);
  };
  const textList = (field, max, placeholder) => (
    <div className="ap-cp-list2">
      {form[field].map((item, index) => (
        <div key={index} className="ap-cp-inrow">
          <input className="ap-input" value={item} onChange={(e) => updateTextItem(field, index, e.target.value)} placeholder={placeholder} aria-label={`${placeholder} ${index + 1}`} />
          {(form[field].length > 1 || item) && <button type="button" className="ap-cp-iconbtn" aria-label="Remove" onClick={() => removeTextItem(field, index)}><Trash2 size={18} /></button>}
        </div>
      ))}
      {form[field].length < max && <button type="button" className="ap-link ap-cp-addlink" onClick={() => addTextItem(field, max)}><Plus size={14} /> Add item</button>}
    </div>
  );

  const productTypeLabel = form.productType === 'other' ? (form.customProductType.trim() || 'Other') : (PRODUCT_TYPES.find((p) => p.value === form.productType)?.label || '');
  const shortType = (t) => String(t || '').replace(/\s*\(.*\)\s*$/, '');
  const firstVideo = form.deliverables.find((d) => d.type);
  const typedCount = form.deliverables.filter((d) => d.type).length;
  const videoSummary = firstVideo ? `${firstVideo.quantity} × ${shortType(firstVideo.type)}${firstVideo.duration ? ` · ${firstVideo.duration}` : ''}${typedCount > 1 ? ` +${typedCount - 1} more` : ''}` : '—';
  const payPreview = (() => {
    if (!(budget > 0)) return '—';
    const lo = Number(form.budgetMin || 0);
    if (!privateCreatorId && form.budgetMode === 'range' && lo > 0 && lo < budget) return `${inr(lo)}–${budget.toLocaleString('en-IN')}`;
    return inr(budget);
  })();
  const rawDueLabel = anyEdited ? 'Raw cut due' : 'Delivery due';
  const brandLine = [form.brandName, resolvedCategory(form)].filter(Boolean).join(' · ');

  const GROUPS = [
    { id: 'details', title: 'Product details', desc: 'Description, key message, audience' },
    { id: 'include', title: 'Must include & avoid', desc: 'CTA, phrases, shots, no-go list' },
    { id: 'style', title: 'Style & references', desc: 'Script, tone, pacing, mood' },
    { id: 'rights', title: 'Usage rights & creators', desc: 'Platforms, duration, level, city' },
  ];

  /* ───────────────────────── review screen ───────────────────────── */
  if (reviewing && !issues.length) {
    const short = wallet != null && wallet < totalDebit;
    return (
      <AppShell title="Review & publish" subtitle="Step 3 of 3 · Review" back tabs={false}>
        <div className="ap-cp-page ap-cp-pad">
          <OfflineStrip />
          <div className="ap-cp-bar3" aria-hidden="true"><i className="is-on" /><i className="is-on" /><i className="is-on" /></div>
          <section className="ap-card">
            <div className="ap-cp-sumhead">
              <Thumb src={form.image} name={form.campaignName} w={52} h={52} r={14} />
              <div className="ap-cp-grow"><b>{form.campaignName}</b><small>{[resolvedCategory(form), privateCreatorId ? 'private brief' : 'public brief'].filter(Boolean).join(' · ')}</small></div>
              <button type="button" className="ap-link" style={{ minHeight: 44 }} onClick={goForm}>Edit</button>
            </div>
            <div className="ap-cp-kvs">
              <div className="ap-cp-kv"><span>Videos</span><b>{creatorsCount} creator{creatorsCount === 1 ? '' : 's'} &times; {totalDeliverables} video{totalDeliverables === 1 ? '' : 's'}</b></div>
              {firstVideo?.duration && <div className="ap-cp-kv"><span>Length</span><b>{firstVideo.duration}</b></div>}
              <div className="ap-cp-kv"><span>Language</span><b>{form.language}</b></div>
              <div className="ap-cp-kv"><span>Budget</span><b>{payPreview} per video</b></div>
              <div className="ap-cp-kv"><span>Product</span><b>{form.productName}{needsShipping ? ' · you ship it' : ` · ${productTypeLabel}`}</b></div>
              {needsShipping && <div className="ap-cp-kv"><span>Ship by</span><b>{fmtShort(form.productShippingBy)}</b></div>}
              <div className="ap-cp-kv"><span>{rawDueLabel}</span><b>{fmtShort(form.draftDeliveryBy)}</b></div>
              {anyEdited && <div className="ap-cp-kv"><span>Edited cut due</span><b>{fmtShort(form.finalDeliveryBy)}</b></div>}
            </div>
          </section>

          <section className="ap-card">
            <b className="ap-cp-h15">You pay</b>
            <div className="ap-cp-kvs">
              <div className="ap-cp-kv"><span>{creatorsCount} creator{creatorsCount === 1 ? '' : 's'} &times; {totalDeliverables} video{totalDeliverables === 1 ? '' : 's'}</span><b>{inr(budget * totalVideos)}</b></div>
              {editedQuantity > 0 && <div className="ap-cp-kv"><span>Creator editing</span><b>{inr(editingTotal)}</b></div>}
              <div className="ap-cp-kv"><span>Platform fee (20%)</span><b>{inr(commission)}</b></div>
              <div className="ap-cp-kv"><span>Listing fee</span><b>{inr(listingFee)}</b></div>
              <div className="ap-cp-kv is-total"><span>Max total &middot; held in escrow</span><b>{inr(totalDebit)}</b></div>
            </div>
            <p className="ap-cp-hint"><strong>{inr(totalDebit)}</strong> will be placed on hold in your wallet, locked in secure escrow. It is held, not spent. Unfilled slots are refunded.</p>
            {wallet != null && (
              <div className={`ap-cp-note${short ? ' ap-cp-note--warn' : ''}`}>
                {short ? <AlertTriangle size={18} /> : <Info size={18} />}
                <span>Your wallet: <strong>{inr(wallet)}</strong>.{short ? <> That is {inr(totalDebit - wallet)} short. <button type="button" className="ap-link" onClick={() => navigate('/dashboard/business/wallet?view=recharge')}>Add funds</button></> : null}</span>
              </div>
            )}
          </section>

          <section className="ap-card ap-cp-prev">
            <div className="ap-cp-eyebrow">WHAT CREATORS WILL SEE</div>
            <div className="ap-cp-prev-brand">{brandLine || 'Your brand'}</div>
            <b className="ap-cp-h15">{form.campaignName.trim() || 'Your campaign title'}</b>
            <div className="ap-cp-kvs">
              <div className="ap-cp-kv"><span>Pay per video</span><b>{payPreview}</b></div>
              <div className="ap-cp-kv"><span>Video</span><b>{videoSummary}</b></div>
            </div>
            {form.campaignHook.trim() && <div className="ap-cp-quote">&ldquo;{form.campaignHook.trim()}&rdquo;</div>}
          </section>

          <div className="ap-cp-note"><Info size={18} /><span>Our team checks every brief first, usually within a few hours, then creators can see it.</span></div>
        </div>
        <div className="ap-cp-pin">
          <div className="ap-cp-pin-in is-col">
            <button type="button" className="ap-btn ap-cp-lg ap-cp-grad ap-btn--block" onClick={publish} disabled={submitting}>{submitting ? <><Loader2 size={18} className="ap-cp-spin" /> Publishing{'…'}</> : (privateCreatorId ? 'Send private brief' : 'Publish brief')}</button>
            <small>You can edit or close it any time</small>
          </div>
        </div>
      </AppShell>
    );
  }

  /* ───────────────────────── form ───────────────────────── */
  const summaryS1 = <><b>{form.productName}</b> &middot; {form.campaignName}<br /><small>{[resolvedCategory(form), productTypeLabel].filter(Boolean).join(' · ')}</small></>;
  const summaryS2 = <><b>{creatorsCount} creator{creatorsCount === 1 ? '' : 's'} &times; {totalDeliverables} video{totalDeliverables === 1 ? '' : 's'}</b><br /><small>{videoSummary}</small></>;
  const summaryS3 = <><b>{payPreview} per video</b><br /><small>{rawDueLabel} {fmtShort(form.draftDeliveryBy)}</small></>;

  return (
    <AppShell
      title={privateCreatorId ? 'Send a private brief' : 'Post a campaign'}
      subtitle={draftSavedAt ? '✓ Draft saved' : undefined}
      back={backOr(ROUTES.campaigns)}
      tabs={false}
      hideActions
      right={<button type="button" className="ap-btn ap-btn--sm ap-btn--ghost" aria-label="Save draft" onClick={saveDraft} disabled={savingDraft}>{savingDraft ? 'Saving…' : 'Save'}</button>}
    >
      <div className="ap-cp-page ap-cp-pad">
        <OfflineStrip />
        {privateCreatorId && !privateRates && <div className="ap-cp-note"><Loader2 size={18} className="ap-cp-spin" /><span>Loading the creator&rsquo;s rates{'…'} <button type="button" className="ap-link" onClick={retryRates}>Reload</button></span></div>}
        <div>
          <div className="ap-cp-progress"><span>3 essentials</span><span>{essentialsDone} of 3 done</span></div>
          <div className="ap-cp-bar3" aria-hidden="true">{[0, 1, 2].map((i) => <i key={i} className={i < essentialsDone ? 'is-on' : ''} />)}</div>
        </div>

        {/* 1 */}
        <EssentialCard id="ap-cp-s1" n={1} title={'What you’re promoting'} done={need('s1') === 0} open={openCard === 's1'} onToggle={() => setOpenCard(openCard === 's1' ? null : 's1')} issues={attempted ? need('s1') : 0} summary={summaryS1}>
          <Field label="Campaign name" req>
            <input className="ap-input" value={form.campaignName} onChange={(e) => set('campaignName', e.target.value.slice(0, 80))} placeholder="Summer Launch - Unboxing 2" />
            <Count value={form.campaignName} min={3} max={80} />
          </Field>
          <Field group label="Product type" req>
            <Chips>{PRODUCT_TYPES.map((pt) => <Chip key={pt.value} on={form.productType === pt.value} title={pt.hint} onClick={() => set('productType', pt.value)}>{pt.label}</Chip>)}</Chips>
            {form.productType === 'other' && <input className="ap-input" style={{ marginTop: 10 }} aria-label="Describe what you're promoting" placeholder="Describe what you're promoting (e.g. Podcast, Event, NGO cause)" value={form.customProductType} onChange={(e) => set('customProductType', e.target.value)} />}
            {!needsShipping && <small className="ap-cp-hint"><Info size={13} /> No physical product: shipping and delivery-address steps are skipped.</small>}
          </Field>
          <Field label={needsShipping ? 'Product' : 'What are you promoting? (name)'} req>
            <input className="ap-input" value={form.productName} onChange={(e) => set('productName', e.target.value)} placeholder={needsShipping ? 'Glow Serum 30ml' : 'e.g. FitTrack App, City Cafe, Summer Sale'} />
          </Field>
          <Field label="Hook: the first line of the video" req>
            <input className="ap-input" value={form.campaignHook} onChange={(e) => set('campaignHook', e.target.value)} placeholder="Start with a morning routine problem-solution moment" />
            <Count value={form.campaignHook} min={10} />
          </Field>
          <Field label="Brand name" hint={form.brandName ? 'Comes from your brand profile. Every campaign is published under this name.' : 'No brand name on your profile yet.'}>
            <input className="ap-input" value={form.brandName} disabled aria-label="Brand name" />
            <button type="button" className="ap-link ap-cp-addlink" onClick={() => navigate('/settings')}>{form.brandName ? 'Change it in Brand profile' : 'Add it in Brand profile'}</button>
          </Field>
          <Field label="Category" req>
            <select className="ap-input" value={form.category} onChange={(e) => set('category', e.target.value)}>
              <option value="">Select category</option>
              {CATEGORY_GROUPS.map((g) => <optgroup key={g.group} label={g.group}>{g.items.map((item) => <option key={item} value={item}>{item}</option>)}</optgroup>)}
              <option value={OTHER_CATEGORY}>Other (type your own)</option>
            </select>
            {form.category === OTHER_CATEGORY && <input className="ap-input" style={{ marginTop: 10 }} maxLength={40} aria-label="Your category" placeholder="Your category (e.g. Drones, Stationery, Solar)" value={form.customCategory} onChange={(e) => set('customCategory', e.target.value)} />}
          </Field>
          <button type="button" className="ap-btn ap-btn--block" onClick={() => setOpenCard('s2')}>Next: the video <ChevronRight size={16} /></button>
        </EssentialCard>

        {/* 2 */}
        <EssentialCard id="ap-cp-s2" n={2} title="What video do you need?" done={need('s2') === 0 && form.deliverables.every((d) => d.type)} open={openCard === 's2'} onToggle={() => setOpenCard(openCard === 's2' ? null : 's2')} issues={attempted ? need('s2') : 0} summary={summaryS2}>
          {form.deliverables.map((item, index) => {
            const editMode = item.editedRequired ? (item.editedBy === 'ugc' ? 'ugc' : 'creator') : 'raw';
            return (
              <div className={`ap-cp-deliv${form.deliverables.length > 1 ? ' is-multi' : ''}`} key={item.id}>
                {form.deliverables.length > 1 && (
                  <div className="ap-cp-delhead"><b>Video {index + 1}</b><button type="button" className="ap-link" style={{ minHeight: 44 }} onClick={() => removeDeliverable(item.id)}><Trash2 size={14} /> Remove</button></div>
                )}
                <Field group label="Video type" req>
                  <Chips>{DELIVERABLE_TYPES.map((type) => <Chip key={type} on={item.type === type} onClick={() => updateDeliverable(item.id, { type })}>{type}</Chip>)}</Chips>
                </Field>
                <div className="ap-cp-steprow"><span>Videos per creator</span><Stepper label="videos" value={Number(item.quantity) || 1} min={1} max={5} onChange={(v) => updateDeliverable(item.id, { quantity: v })} /></div>
                <Field label="Length" req={isVideoDeliverable(item.type)}>
                  <input className="ap-input" value={item.duration} onChange={(e) => updateDeliverable(item.id, { duration: e.target.value })} placeholder="15-20 seconds" />
                </Field>
                <Field group label="Who edits" req hint={editMode === 'raw' ? 'The creator delivers raw footage only.' : editMode === 'creator' ? 'The creator edits and delivers the finished cut as well as the raw footage.' : "UGC.ad's team edits this video. Our admin team is notified once you submit the brief."}>
                  <Chips>
                    <Chip on={editMode === 'raw'} onClick={() => updateDeliverable(item.id, { editedRequired: false })}>Raw only</Chip>
                    <Chip on={editMode === 'creator'} onClick={() => updateDeliverable(item.id, { editedRequired: true, editedBy: 'creator' })}>Creator</Chip>
                    <Chip on={editMode === 'ugc'} onClick={() => updateDeliverable(item.id, { editedRequired: true, editedBy: 'ugc' })}>UGC.ad</Chip>
                  </Chips>
                </Field>
                <Field group label="Aspect ratio" req>
                  <Chips>{ASPECTS.map((r) => <Chip key={r} on={item.aspectRatios.includes(r)} onClick={() => updateDeliverable(item.id, { aspectRatios: item.aspectRatios.includes(r) ? item.aspectRatios.filter((x) => x !== r) : [...item.aspectRatios, r] })}>{r}</Chip>)}</Chips>
                </Field>
              </div>
            );
          })}
          <button type="button" className="ap-link ap-cp-addlink" onClick={addDeliverable}><Plus size={14} /> Add another video type ({form.deliverables.length}/5)</button>
          <div className="ap-cp-steprow"><span>Creators</span><Stepper label="creators" value={privateCreatorId ? 1 : creatorsCount} min={1} max={privateCreatorId ? 1 : 20} onChange={(v) => set('creatorsWanted', v)} /></div>
          <small className="ap-cp-hint">The budget for all {creatorsCount} creator{creatorsCount === 1 ? '' : 's'} is placed on hold in your wallet when the brief is published. If you finish hiring early, unused slots are refunded.</small>
          <button type="button" className="ap-btn ap-btn--block" onClick={() => setOpenCard('s3')}>Next: budget &amp; dates <ChevronRight size={16} /></button>
        </EssentialCard>

        {/* 3 */}
        <EssentialCard id="ap-cp-s3" n={3} title="Budget & dates" done={need('s3') === 0} open={openCard === 's3'} onToggle={() => setOpenCard(openCard === 's3' ? null : 's3')} issues={attempted ? need('s3') : 0} summary={summaryS3}>
          <Field group label="Budget per video" req hint="This is the amount for ONE video. The total for all videos, the 20% platform fee and the listing fee are added up at the bottom.">
            {form.budgetMode === 'fixed' ? (
              <div className="ap-cp-money"><span>&#8377;</span><input className="ap-input" type="text" inputMode="numeric" aria-label="Budget per video" placeholder="5000" readOnly={Boolean(privateCreatorId)} value={form.fixedBudget} onKeyDown={blockNonDigitKey} onChange={(e) => set('fixedBudget', digitsOnly(e.target.value))} /></div>
            ) : (
              <div className="ap-cp-range">
                <div className="ap-cp-money"><span>&#8377;</span><input className="ap-input" type="text" inputMode="numeric" placeholder="Min" aria-label="Min budget per video" value={form.budgetMin} onKeyDown={blockNonDigitKey} onChange={(e) => set('budgetMin', digitsOnly(e.target.value))} /></div>
                <i>&ndash;</i>
                <div className="ap-cp-money"><span>&#8377;</span><input className="ap-input" type="text" inputMode="numeric" placeholder="Max" aria-label="Max budget per video" value={form.budgetMax} onKeyDown={blockNonDigitKey} onChange={(e) => set('budgetMax', digitsOnly(e.target.value))} /></div>
              </div>
            )}
            <div className="ap-cp-seg2">
              <button type="button" className={form.budgetMode === 'fixed' ? 'is-on' : ''} onClick={() => set('budgetMode', 'fixed')}>Fixed amount</button>
              <button type="button" className={form.budgetMode === 'range' ? 'is-on' : ''} onClick={() => set('budgetMode', 'range')}>Range</button>
            </div>
          </Field>
          {needsShipping && (
            <Field label="Ship product by" req hint="Cannot be today. Earliest is tomorrow.">
              <input className="ap-input" type="date" min={tomorrowStr} value={form.productShippingBy} onChange={(e) => set('productShippingBy', e.target.value)} />
            </Field>
          )}
          <Field label={rawDueLabel} req hint={needsShipping ? (draftDeliverySuggestion ? `Suggested from shipping date: ${draftDeliverySuggestion}` : 'Suggested as product shipping + 7 days.') : 'No product to ship. The creator starts as soon as they accept.'}>
            <input className="ap-input" type="date" min={form.productShippingBy || tomorrowStr} value={form.draftDeliveryBy} onChange={(e) => set('draftDeliveryBy', e.target.value)} />
          </Field>
          {anyEdited && (
            <Field label="Edited cut due" req hint="The creator edits after you approve the raw video.">
              <input className="ap-input" type="date" min={form.draftDeliveryBy || form.productShippingBy || tomorrowStr} value={form.finalDeliveryBy} onChange={(e) => set('finalDeliveryBy', e.target.value)} />
            </Field>
          )}
          <div className="ap-cp-steprow"><span>Revisions included<small className="ap-cp-hint">Extra revisions: &#8377;500 each (&#8377;300 to the creator)</small></span><Stepper label="revisions" value={Number(form.revisions) || 0} min={0} max={20} onChange={(v) => set('revisions', v)} /></div>
          {editedQuantity > 0 && (
            <Field label="Editing payout per video (₹)">
              <input className="ap-input" type="text" inputMode="numeric" readOnly={Boolean(privateCreatorId)} value={form.editingFee} onKeyDown={blockNonDigitKey} onChange={(e) => set('editingFee', digitsOnly(e.target.value))} />
            </Field>
          )}
          <Check2 on={form.budgetVisible} onChange={(v) => set('budgetVisible', v)} hint="Hidden budgets are flagged to admin.">Show budget to creators</Check2>
        </EssentialCard>

        <div className="ap-cp-opt">OPTIONAL &mdash; ADD IF YOU WANT</div>
        <div className="ap-card ap-cp-grows">
          {GROUPS.map((g) => (
            <button key={g.id} type="button" id={`ap-cp-${g.id}`} className="ap-cp-grow-btn" onClick={() => setGroup(g.id)}>
              <span className="ap-cp-gt"><b>{g.title}</b><small>{g.desc}</small></span>
              {need(g.id) > 0 ? <span className="ap-cp-need">{need(g.id)} required</span> : <span className="ap-cp-ok">Added</span>}
              <span className="ap-cp-plus"><Plus size={16} /></span>
            </button>
          ))}
        </div>
      </div>

      <div className="ap-cp-pin">
        <div className="ap-cp-pin-in">
          <div className="ap-cp-pin-t"><small>Max &middot; {totalVideos} video{totalVideos === 1 ? '' : 's'}</small><strong>{inr(totalDebit)}</strong></div>
          <button type="button" className="ap-btn ap-cp-lg ap-cp-grad" style={{ flex: 1 }} onClick={reviewAndPublish} disabled={submitting}>{privateCreatorId ? 'Review & send' : 'Review & publish'}</button>
        </div>
      </div>

      {/* optional groups */}
      <BottomSheet open={group === 'details'} onClose={() => setGroup(null)} tall title="Product details" subtitle="Description, key message, objectives, audience, language" footer={<button type="button" className="ap-btn ap-cp-lg ap-btn--block" onClick={() => setGroup(null)}>Done</button>}>
        <div className="ap-cp-form">
          <Field label="Product description" req>
            <textarea className="ap-input" rows={4} value={form.productDescription} onChange={(e) => set('productDescription', e.target.value)} placeholder="Describe the product, who it helps, and what creators should understand before filming." />
            <Count value={form.productDescription} min={20} />
          </Field>
          <Field label="Key message" req>
            <input className="ap-input" value={form.keyMessage} onChange={(e) => set('keyMessage', e.target.value)} placeholder="The one message every video should communicate" />
            <Count value={form.keyMessage} min={10} />
          </Field>
          <Field group label="Objective" req><Chips>{OBJECTIVES.map((o) => <Chip key={o} on={form.objectives.includes(o)} onClick={() => set('objectives', [o])}>{o}</Chip>)}</Chips></Field>
          <Field label="Target audience" req>
            <textarea className="ap-input" rows={3} value={form.targetAudience} onChange={(e) => set('targetAudience', e.target.value.slice(0, 200))} placeholder="Urban women 25-35 interested in clean skincare." />
            <Count value={form.targetAudience} min={50} max={200} />
          </Field>
          <Field group label="Language" req><Chips>{LANGUAGES.map((l) => <Chip key={l} on={form.language === l} onClick={() => set('language', l)}>{l}</Chip>)}</Chips></Field>
        </div>
      </BottomSheet>

      <BottomSheet open={group === 'include'} onClose={() => setGroup(null)} tall title="Must include & avoid" subtitle="Phrases, shots, CTA, things to keep out" footer={<button type="button" className="ap-btn ap-cp-lg ap-btn--block" onClick={() => setGroup(null)}>Done</button>}>
        <div className="ap-cp-form">
          <Check2 on={form.productVisible} onChange={(v) => set('productVisible', v)}>Product visible on camera</Check2>
          {form.productVisible && <Field label="Minimum seconds visible" req><input className="ap-input" value={form.visibilitySeconds} onChange={(e) => set('visibilitySeconds', e.target.value)} placeholder="5 sec min" /></Field>}
          <Check2 on={form.verbalMention} onChange={(v) => set('verbalMention', v)}>Verbal brand mention</Check2>
          {form.verbalMention && <Field label="Exact product name(s) to say" req><input className="ap-input" value={form.productNames} onChange={(e) => set('productNames', e.target.value)} placeholder="Exact product name(s)" /></Field>}
          <Field group label="Required phrases" hint="Up to 5">{textList('requiredPhrases', 5, 'Perfect for oily skin')}</Field>
          <Field group label="Required shots" hint="Up to 5">{textList('requiredShots', 5, 'Close-up of label')}</Field>
          <Field group label="Call to action" req><Chips>{CTAS.map((c) => <Chip key={c} on={form.callToAction === c} onClick={() => set('callToAction', c)}>{c}</Chip>)}</Chips></Field>
          {form.callToAction === 'Use code' && <Field label="Promo code" req><input className="ap-input" value={form.promoCode} onChange={(e) => set('promoCode', e.target.value)} /></Field>}
          {CTA_INPUT[form.callToAction] && (
            <Field label={CTA_INPUT[form.callToAction].label} req error={form.ctaLink && !ctaLinkValid(form.callToAction, form.ctaLink) ? (CTA_INPUT[form.callToAction].type === 'handle' ? 'Enter a valid @handle or profile link.' : 'Enter a valid link (e.g. https://yourbrand.com).') : ''}>
              <input className="ap-input" inputMode="url" autoCapitalize="none" placeholder={CTA_INPUT[form.callToAction].ph} value={form.ctaLink} onChange={(e) => set('ctaLink', e.target.value)} />
            </Field>
          )}
          <Field label="Hashtags" hint="Max 10"><input className="ap-input" value={form.hashtags} onChange={(e) => handleHashtags(e.target.value)} placeholder="#brand #launch" /></Field>
          <Check2 on={form.brandHandleTag} onChange={(v) => set('brandHandleTag', v)}>Creator tags the brand handle</Check2>
          {[['noCompetitors', 'No competitor brands visible'], ['noOtherProducts', 'No other products in frame'], ['noProfanity', 'No profanity or adult language'], ['noPolitical', 'No political or religious content'], ['avoidFilters', 'Avoid filters / effects']].map(([f, l]) => <Check2 key={f} on={form[f]} onChange={(v) => set(f, v)}>{l}</Check2>)}
          {form.noCompetitors && <Field label="Competitor list"><input className="ap-input" value={form.competitors} onChange={(e) => set('competitors', e.target.value)} placeholder="Minimalist, The Derma Co" /></Field>}
          {form.avoidFilters && <Field label="Which filters/effects?"><input className="ap-input" value={form.filterTypes} onChange={(e) => set('filterTypes', e.target.value)} /></Field>}
          <Field label="Anything else to avoid?"><textarea className="ap-input" rows={3} value={form.avoidText} onChange={(e) => set('avoidText', e.target.value.slice(0, 200))} /><Count value={form.avoidText} max={200} /></Field>
        </div>
      </BottomSheet>

      <BottomSheet open={group === 'style'} onClose={() => setGroup(null)} tall title="Style & references" subtitle="Script, tone, pacing, music, mood images" footer={<button type="button" className="ap-btn ap-cp-lg ap-btn--block" onClick={() => setGroup(null)}>Done</button>}>
        <div className="ap-cp-form">
          <Field group label="Who writes the script?" req hint={form.scriptProvider === 'ugc' ? "UGC.ad's team writes the script during brief review. You confirm it before creators see the brief." : 'Enter the script below. It will be shown to the creator as part of the brief.'}>
            <Chips><Chip on={form.scriptProvider !== 'ugc'} onClick={() => set('scriptProvider', 'brand')}>Brand</Chip><Chip on={form.scriptProvider === 'ugc'} onClick={() => set('scriptProvider', 'ugc')}>UGC.ad</Chip></Chips>
          </Field>
          {form.scriptProvider !== 'ugc' && <Field label="Script"><textarea className="ap-input" rows={5} value={form.scriptText} onChange={(e) => set('scriptText', e.target.value)} placeholder="Write out the script for the creator to follow..." /></Field>}
          <Field group label="Tone" req hint="Style is guidance, not grounds for dispute."><Chips>{TONES.map((t) => <Chip key={t} on={form.tones.includes(t)} onClick={() => toggleArray('tones', t)}>{t}</Chip>)}</Chips></Field>
          <Field group label="Pacing" req><Chips>{['Fast-cut', 'Medium', 'Slow & reflective', 'No preference'].map((p) => <Chip key={p} on={form.pacing === p} onClick={() => set('pacing', p)}>{p}</Chip>)}</Chips></Field>
          <Field group label="Music"><Chips>{['Original creator audio', 'Trending sound', 'Brand-provided audio file', 'No preference'].map((p) => <Chip key={p} on={form.musicPreference === p} onClick={() => set('musicPreference', p)}>{p}</Chip>)}</Chips></Field>
          <Field group label="Mood images (up to 5)" hint={`${form.moodImages.length}/5 added`}>
            <div className="ap-cp-mood">
              {form.moodImages.map((item, index) => {
                const src = item.startsWith('http') ? item : `${BACKEND_URL}${item}`;
                const viewable = item.startsWith('http') || item.startsWith('/');
                return (
                  <div className="ap-cp-mthumb" key={`${item}-${index}`}>
                    {viewable ? <img src={src} alt={`Mood board ${index + 1}`} /> : <span>{item}</span>}
                    <button type="button" onClick={() => set('moodImages', form.moodImages.filter((_, i) => i !== index))} aria-label="Remove image"><Trash2 size={13} /></button>
                  </div>
                );
              })}
              {form.moodImages.length < 5 && (
                <label className={`ap-cp-mthumb is-add${moodUploading ? ' is-busy' : ''}`} title="Upload references">
                  {moodUploading ? <Loader2 size={18} className="ap-cp-spin" /> : <Plus size={20} />}
                  <span className="ap-cp-sr">Add mood images</span>
                  <input type="file" multiple accept="image/*" disabled={moodUploading} onChange={uploadMoodImages} />
                </label>
              )}
            </div>
          </Field>
          <Field group label="Reference videos (up to 3)" hint="Paste a link, or upload a video file. Creators see uploaded clips inline.">
            <div className="ap-cp-list2">
              {form.referenceVideos.map((item, index) => {
                const busy = uploadingKey === `ref-${index}`;
                return (
                  <div key={index} className="ap-cp-refrow">
                    <input className="ap-input" value={item} onChange={(e) => updateTextItem('referenceVideos', index, e.target.value)} placeholder="Paste reference video link" aria-label={`Reference video ${index + 1}`} />
                    <label className={`ap-btn ap-btn--sm ap-btn--ghost ap-cp-up${busy ? ' is-busy' : ''}`}>
                      <Upload size={14} /> {busy ? 'Uploading…' : (isUploadedUrl(item) ? 'Replace' : 'Upload')}
                      <input type="file" accept="video/*" disabled={busy} onChange={(e) => { uploadRefVideo(index, e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                    {(form.referenceVideos.length > 1 || item) && <button type="button" className="ap-cp-iconbtn" aria-label="Remove" onClick={() => removeTextItem('referenceVideos', index)}><Trash2 size={18} /></button>}
                  </div>
                );
              })}
              {form.referenceVideos.length < 3 && <button type="button" className="ap-link ap-cp-addlink" onClick={() => addTextItem('referenceVideos', 3)}><Plus size={14} /> Add item</button>}
            </div>
          </Field>
        </div>
      </BottomSheet>

      <BottomSheet open={group === 'rights'} onClose={() => setGroup(null)} tall title="Usage rights & creators" subtitle="Platforms, duration, level, city, gender" footer={<button type="button" className="ap-btn ap-cp-lg ap-btn--block" onClick={() => setGroup(null)}>Done</button>}>
        <div className="ap-cp-form">
          <Field group label="Platforms where content can be posted" req><Chips>{PLATFORMS.map((p) => <Chip key={p} on={form.platforms.includes(p)} onClick={() => toggleArray('platforms', p)}>{p}</Chip>)}</Chips></Field>
          <Field group label="Rights duration" req><Chips>{['1 month', '3 months', '6 months', '1 year', '2 years', 'Perpetual'].map((p) => <Chip key={p} on={form.rightsDuration === p} onClick={() => set('rightsDuration', p)}>{p}</Chip>)}</Chips></Field>
          <Field group label="Exclusivity" req><Chips>{['None', '15 days', '30 days', '60 days', '90 days'].map((p) => <Chip key={p} on={form.exclusivity === p} onClick={() => set('exclusivity', p)}>{p}</Chip>)}</Chips></Field>
          <Field group label="Modification rights" req><Chips>{['Yes (full rights)', 'Limited (minor edits only)', 'No (use as-is)'].map((p) => <Chip key={p} on={form.modificationRights === p} onClick={() => set('modificationRights', p)}>{p}</Chip>)}</Chips></Field>
          <Check2 on={form.whitelisting} onChange={(v) => set('whitelisting', v)}>Whitelisting / allowlisting (+30%)</Check2>
          {pricingLifts.length > 0 && <div className="ap-cp-note ap-cp-note--warn"><AlertTriangle size={18} /><span>Suggested pricing lifts: {pricingLifts.join('; ')}</span></div>}
          <Field group label="Minimum creator level" req><Chips>{CREATOR_LEVELS.map((p) => <Chip key={p} on={form.creatorLevel === p} onClick={() => set('creatorLevel', p)}>{p}</Chip>)}</Chips></Field>
          <Field group label="Content quality tier" req><Chips>{QUALITY_TIERS.map((p) => <Chip key={p} on={form.qualityTier === p} onClick={() => set('qualityTier', p)}>{p}</Chip>)}</Chips></Field>
          <Field group label="Gender preference"><Chips>{GENDER_OPTIONS.map((p) => <Chip key={p} on={form.genderPreference === p} onClick={() => set('genderPreference', p)}>{p}</Chip>)}</Chips></Field>
          <Field label="City"><select className="ap-input" value={form.cityFilter} onChange={(e) => set('cityFilter', e.target.value)}>{CITIES.map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field group label="Creator niche tags" hint="Pick as many as fit, or Any to accept every niche."><Chips>{NICHE_TAGS.map((p) => <Chip key={p} on={form.nicheTags.includes(p)} onClick={() => toggleNiche(p)}>{p}</Chip>)}</Chips></Field>
        </div>
      </BottomSheet>
    </AppShell>
  );
}

export default withBrandGate(PostCampaign);
