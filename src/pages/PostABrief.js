import { useEffect, useMemo, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { digitsOnly, blockNonDigitKey } from '../utils/inputValidators';
import { AlertTriangle, Check, ChevronLeft, ChevronRight, FileText, Info, Plus, Save, Send, Trash2, Upload } from 'lucide-react';
import { useAuth } from '../App';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
// A reference that we hosted ourselves (came from /upload/file) rather than a
// pasted third-party link — used to label the button "Replace" and to render it
// as playable media instead of a bare link.
const isUploadedUrl = (v) => typeof v === 'string' && /\/uploads?\//i.test(v);

const DRAFT_KEY = 'ugcad-brand-brief-draft-v2';
const DRAFT_ID_KEY = 'ugcad-brand-brief-draft-id-v2';
const COMMISSION_RATE = 0.20;

// Listing fee is tiered by the size of the brief. `deliverables` is the number of
// deliverable rows (the wizard caps this at 5); `creators` is creators_wanted.
//   1 creator,  1 deliverable      -> Rs. 500
//   1 creator,  2–5 deliverables   -> Rs. 1,500
//   2–10 creators                  -> Rs. 1,500
//   11+ creators                   -> Rs. 3,000
function listingFeeFor(creators, deliverables) {
  // Flat listing fee — it does NOT multiply by the number of creators hired (the
  // backend charges a single flat listing_fee setting). Only the deliverable count
  // nudges it, matching the platform's one-time listing charge.
  const d = Math.max(1, Number(deliverables) || 1);
  return d <= 1 ? 500 : 1500;
}

const STEPS = [
  'Campaign Basics',
  'Deliverables',
  'Must-Include',
  'Must-Avoid',
  'Style Guidance',
  'Usage Rights',
  'Timeline & Budget',
  'Review & Publish'
];

// Each step is split into short sub-sections shown as the top tabs (keeps each card short).
// Steps without an entry fall back to a single section named after the step.
const SUBSECTIONS = {
  1: ['Basics', 'Product Description', 'Objective & Audience'],
  3: ['Product Visibility', 'Phrases, CTA & Tags'],
  4: ['Checklist', 'Competitors & Avoid'],
  5: ['Tone & Pacing', 'References'],
  6: ['Platforms', 'Rights & Licensing'],
  7: ['Creator Targeting', 'Timeline', 'Budget'],
};
const subsFor = (s) => SUBSECTIONS[s] || [STEPS[s - 1]];

// What the brand is promoting. Only a PHYSICAL product needs shipping — everything
// else skips the address/shipping/receipt steps of the deal entirely.
const PRODUCT_TYPES = [
  { value: 'physical', label: 'Physical product', hint: 'You ship an item to the creator', ships: true },
  { value: 'digital',  label: 'Digital / App',    hint: 'App, software or download — nothing to ship' },
  { value: 'service',  label: 'Service',          hint: 'A service, subscription or experience' },
  { value: 'other',    label: 'Other',            hint: 'Describe it yourself' },
];
const typeNeedsShipping = (t) => t === 'physical';

const CATEGORIES = ['Beauty', 'Tech', 'Fitness', 'Fashion', 'Travel', 'Food', 'Gaming', 'Lifestyle', 'Home Decor', 'Wellness'];
// Map a stored category (any case / phrasing) to one of CATEGORIES so the <select>
// pre-selects it. e.g. "beauty" / "Beauty & Skincare" -> "Beauty".
const matchCategory = (...raws) => {
  for (const raw of raws) {
    const s = String(raw || '').trim().toLowerCase();
    if (!s) continue;
    const hit = CATEGORIES.find((c) => c.toLowerCase() === s)
      || CATEGORIES.find((c) => s.includes(c.toLowerCase()) || c.toLowerCase().includes(s));
    if (hit) return hit;
  }
  return '';
};
const OBJECTIVES = ['Awareness', 'Product launch', 'Seasonal push', 'Testimonial', 'Tutorial', 'Unboxing', 'Comparison', 'Sale promotion', 'Customer education', 'Other'];
const DELIVERABLE_TYPES = ['Reel (9:16, under 30s)', 'Short-form (30-60s)', 'YouTube Short (9:16, 60s max)', 'Long-form video (2+ minutes)', 'Static post', 'Carousel post', 'Story set (3-5 frames)'];
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
const TONES = ['Casual', 'Energetic', 'Informative', 'Humorous', 'Aspirational', 'Authentic', 'Educational', 'Trustworthy'];
const CREATOR_LEVELS = ['New', 'Verified', 'L1', 'L2', 'Elite'];
const QUALITY_TIERS = ['A', 'A+', 'A++'];
const GENDER_OPTIONS = ['No Preference', 'Female', 'Male', 'Non-binary'];
const CITIES = ['Any City', 'Mumbai', 'Delhi NCR', 'Bengaluru', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad', 'Jaipur', 'Surat', 'Lucknow', 'Kanpur', 'Nagpur', 'Indore', 'Thane', 'Bhopal', 'Visakhapatnam', 'Patna', 'Vadodara', 'Ghaziabad', 'Ludhiana', 'Agra', 'Nashik', 'Faridabad', 'Meerut', 'Rajkot', 'Varanasi', 'Srinagar', 'Aurangabad', 'Amritsar', 'Navi Mumbai', 'Prayagraj', 'Ranchi', 'Coimbatore', 'Jabalpur', 'Gwalior', 'Vijayawada', 'Jodhpur', 'Madurai', 'Raipur', 'Kota', 'Guwahati', 'Chandigarh', 'Noida', 'Gurugram', 'Thiruvananthapuram', 'Kochi', 'Mysuru', 'Bhubaneswar', 'Dehradun', 'Mangaluru', 'Tiruchirappalli', 'Jamshedpur', 'Panaji (Goa)', 'Puducherry', 'Udaipur', 'Salem', 'Warangal', 'Guntur', 'Bhilai', 'Jalandhar', 'Bikaner', 'Siliguri', 'Nellore', 'Ajmer', 'Shimla', 'Other'];
const NICHE_TAGS = ['Beauty', 'Skincare', 'Fashion', 'Fitness', 'Food', 'Lifestyle', 'Tech', 'Travel', 'Home Decor', 'Wellness', 'Parenting', 'Gaming'];
const VIDEO_DELIVERABLES = ['Reel', 'Short-form', 'YouTube Short', 'Long-form video'];
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
  rawRequired: false
});

const initialForm = {
  campaignName: '',
  image: '',
  brandName: '',
  category: '',
  productType: 'physical',     // physical | digital | service | promo | other
  customProductType: '',       // free text when productType === 'other'
  productName: '',
  productDescription: '',
  campaignHook: '',
  keyMessage: '',
  objectives: [],
  targetAudience: '',
  budgetVisible: true,
  deliverables: [createDeliverable()],
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
  budgetMin: '',
  budgetMax: '',
  creatorLevel: '',
  qualityTier: '',
  genderPreference: 'No Preference',
  cityFilter: 'Any City',
  nicheTags: []
};

const ToggleChip = ({ active, children, onClick }) => (
  <button type="button" className={`brief-chip ${active ? 'active' : ''}`} onClick={onClick}>
    {children}
  </button>
);

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
  put('category', c.product_category || c.category);
  if (PRODUCT_TYPES.some(p => p.value === c.product_type)) put('productType', c.product_type);
  if (c.product_type_detail) put('customProductType', c.product_type_detail);
  put('productName', c.product_name);
  put('productDescription', c.product_description);
  put('campaignHook', c.campaign_hook);
  put('keyMessage', c.key_message);
  put('pacing', c.pacing || c.tone_reference);
  put('targetAudience', c.target_audience);
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
      rawRequired: Boolean(d.raw_required),
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
 * one, so "Next" can never block on a rule the brand couldn't see.
 * Counts trimmed length — the same thing the step validation checks.
 */
function FieldCount({ value, min = 0, max = null }) {
  const len = String(value || '').trim().length;
  const need = min - len;
  if (need > 0) {
    return <small className="brief-need">{need} more character{need === 1 ? '' : 's'} needed</small>;
  }
  return <small>{max ? `${len}/${max} characters` : `${len} characters`}</small>;
}

const PostABrief = forwardRef(function PostABrief({ embeddedCreatorId = null, onClose = null, onPublished = null, onDraftSaved = null, duplicateId = null, resumeDraftId = null } = {}, ref) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [subStep, setSubStep] = useState(0);
  const [reviewTab, setReviewTab] = useState(0);   // active section on Review & Publish
  const [form, setForm] = useState(initialForm);
  const subs = subsFor(step);
  useEffect(() => { setSubStep(0); }, [step]);
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
  const [draftId, setDraftId] = useState(() => localStorage.getItem(DRAFT_ID_KEY) || null);
  const [savingDraft, setSavingDraft] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        setForm({ ...initialForm, ...JSON.parse(saved) });
      } catch {
        localStorage.removeItem(DRAFT_KEY);
      }
    }

    axios.get(`${API}/business/settings/profile`)
      .then(res => {
        const profile = res.data || {};
        const up = user?.profile || {};
        setForm(current => ({
          ...current,
          brandName: current.brandName || profile.brand_name || user?.nickname || user?.full_name || '',
          // Pre-select the brand's category by default (still changeable).
          category: current.category || matchCategory(
            profile.primary_category, profile.business_category, profile.industry_category,
            profile.category, profile.product_type,
            up.industry_category, up.business_category, up.category
          )
        }));
      })
      .catch(() => {
        setForm(current => ({ ...current, brandName: current.brandName || user?.business_name || user?.full_name || String(user?.nickname || '').replace(/^@+/, '') || '' }));
      });
  }, [user?.id]);

  // Resume a server-saved draft — either from the URL (?draft=<id>) or from the
  // Campaigns page opening this wizard in a modal (resumeDraftId prop). draftId
  // is set, so saving/publishing PATCHes that same draft instead of forking a copy.
  useEffect(() => {
    const resumeId = resumeDraftId || searchParams.get('draft');
    if (!resumeId) return;
    setDraftId(resumeId);
    localStorage.setItem(DRAFT_ID_KEY, resumeId);
    axios.get(`${API}/campaigns/${resumeId}`)
      .then(res => {
        const mapped = mapCampaignToForm(res.data);
        if (Object.keys(mapped).length) {
          setForm(current => ({ ...current, ...mapped }));
          toast.success('Draft loaded — continue where you left off');
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
    localStorage.removeItem(DRAFT_ID_KEY);
    axios.get(`${API}/campaigns/${dupId}`)
      .then(res => {
        const mapped = mapCampaignToForm(res.data);
        const n = Object.keys(mapped).length;
        // Diagnostic: how many fields actually carried over. If this is ~1–3, the
        // source campaign was saved WITHOUT the structured brief (backend wasn't
        // running the strict:false Campaign model when it was created).
        console.log('[Duplicate] fields copied:', n, mapped, '\nraw campaign:', res.data);
        setForm(current => ({ ...current, ...mapped }));
        toast.success(`Copied brief loaded — ${n} field${n === 1 ? '' : 's'} carried over. Edit and publish.`);
      })
      .catch(() => toast.error('Could not load that brief to duplicate'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, duplicateId]);

  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    setDraftSavedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }, [form]);

  const set = (field, value) => setForm(current => ({ ...current, [field]: value }));
  const toggleArray = (field, value) => {
    setForm(current => {
      const values = current[field] || [];
      return { ...current, [field]: values.includes(value) ? values.filter(item => item !== value) : [...values, value] };
    });
  };

  // `budget` is the per-creator figure (what one creator is paid) — it feeds the
  // per_video_budget / budget_max payload fields. The wallet holds it for EVERY
  // creator the brief hires, so the money shown on hold multiplies by that count.
  const budget = Number(form.budgetMode === 'fixed' ? form.fixedBudget : form.budgetMax) || 0;
  const creatorsCount = Math.max(1, Number(form.creatorsWanted) || 1);
  const totalBudget = budget * creatorsCount;                 // e.g. ₹3,000 × 4 = ₹12,000
  const commission = Math.round(totalBudget * COMMISSION_RATE); // commission on the overall total
  const listingFee = listingFeeFor(form.creatorsWanted, form.deliverables.length); // flat — not per creator
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
    if (file.size > 200 * 1024 * 1024) { toast.error(`${file.name} is too large. Max 200MB.`); return; }
    setUploadingKey(`ref-${index}`);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await axios.post(`${API}/upload/file`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
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

  const isStepValid = (target = step) => {
    if (target === 1) return form.campaignName.trim().length >= 3 && form.campaignName.trim().length <= 80 && (form.productType !== 'other' || form.customProductType.trim().length > 0) && form.productName.trim().length > 0 && form.productDescription.trim().length >= 20 && form.campaignHook.trim().length >= 10 && form.keyMessage.trim().length >= 10 && form.category && form.objectives.length > 0 && form.targetAudience.trim().length >= 50 && form.targetAudience.trim().length <= 200;
    if (target === 2) return form.deliverables.length > 0 && form.deliverables.every(item => item.type && item.quantity >= 1 && item.quantity <= 5 && item.aspectRatios.length > 0 && (!isVideoDeliverable(item.type) || item.duration));
    if (target === 3) return (!form.productVisible || form.visibilitySeconds) && (!form.verbalMention || form.productNames) && form.callToAction && (form.callToAction !== 'Use code' || form.promoCode) && (!CTA_INPUT[form.callToAction] || ctaLinkValid(form.callToAction, form.ctaLink));
    if (target === 4) return form.avoidText.length <= 200;
    if (target === 5) return form.tones.length > 0 && form.pacing;
    if (target === 6) return form.platforms.length > 0 && form.rightsDuration && form.exclusivity && form.modificationRights;
    if (target === 7) {
      const shipOk = !needsShipping || (form.productShippingBy && form.productShippingBy >= tomorrowStr);
      const draftMin = needsShipping && form.productShippingBy ? form.productShippingBy : tomorrowStr;
      const draftOk = form.draftDeliveryBy && form.draftDeliveryBy >= draftMin;
      const finalOk = form.finalDeliveryBy && form.finalDeliveryBy >= form.draftDeliveryBy;
      return shipOk && draftOk && finalOk && budget > 0 && form.creatorLevel && form.qualityTier;
    }
    return true;
  };

  // Overall completion across the whole brief — fills continuously toward 100% and
  // never resets between steps.
  const stepFillPct = () => {
    const f = form;
    const all = [
      f.campaignName.trim().length >= 3, !!f.category, f.productName.trim().length > 0, f.campaignHook.trim().length >= 10,
      f.productDescription.trim().length >= 20, f.keyMessage.trim().length >= 10,
      f.objectives.length > 0, f.targetAudience.trim().length >= 50,
      f.deliverables.length > 0 && f.deliverables.every(d => d.type), f.deliverables.every(d => d.aspectRatios.length > 0),
      !f.productVisible || !!f.visibilitySeconds, !f.verbalMention || !!f.productNames, !!f.callToAction,
      f.tones.length > 0, !!f.pacing,
      f.platforms.length > 0, !!f.rightsDuration, !!f.exclusivity, !!f.modificationRights,
      !!f.creatorLevel, !!f.qualityTier, (!typeNeedsShipping(f.productType) || !!f.productShippingBy), !!f.draftDeliveryBy, !!f.finalDeliveryBy, budget > 0,
    ];
    return Math.round((all.filter(Boolean).length / all.length) * 100);
  };

  // Human-readable list of what's still blocking the current section.
  const stepIssues = (target = step) => {
    const m = [];
    if (target === 1) {
      if (form.campaignName.trim().length < 3) m.push('Campaign name (min 3 chars)');
      if (form.productType === 'other' && !form.customProductType.trim()) m.push('Describe your product type');
      if (!form.productName.trim()) m.push(needsShipping ? 'Product name' : 'What you’re promoting (name)');
      if (form.productDescription.trim().length < 20) m.push('Product description (min 20 chars)');
      if (form.campaignHook.trim().length < 10) m.push('Campaign hook (min 10 chars)');
      if (form.keyMessage.trim().length < 10) m.push('Key message (min 10 chars)');
      if (!form.category) m.push('Category');
      if (form.objectives.length === 0) m.push('Campaign objective');
      const ta = form.targetAudience.trim().length;
      if (ta < 50 || ta > 200) m.push('Target audience (50–200 chars)');
    } else if (target === 2) {
      if (!(form.deliverables.length > 0 && form.deliverables.every(i => i.type && i.quantity >= 1 && i.quantity <= 5 && i.aspectRatios.length > 0 && (!isVideoDeliverable(i.type) || i.duration)))) m.push('Each deliverable: type, quantity 1–5, aspect ratio (+ duration for video)');
    } else if (target === 3) {
      if (form.productVisible && !form.visibilitySeconds) m.push('Product visibility seconds');
      if (form.verbalMention && !form.productNames) m.push('Product names to mention');
      if (!form.callToAction) m.push('Call to action');
      if (form.callToAction === 'Use code' && !form.promoCode) m.push('Promo code');
      if (CTA_INPUT[form.callToAction] && !ctaLinkValid(form.callToAction, form.ctaLink)) m.push(`${CTA_INPUT[form.callToAction].label} (valid ${CTA_INPUT[form.callToAction].type === 'handle' ? 'handle or link' : 'link'})`);
    } else if (target === 5) {
      if (form.tones.length === 0) m.push('Tone tags');
      if (!form.pacing) m.push('Pacing reference');
    } else if (target === 6) {
      if (form.platforms.length === 0) m.push('Platforms');
      if (!form.rightsDuration) m.push('Rights duration');
      if (!form.exclusivity) m.push('Exclusivity');
      if (!form.modificationRights) m.push('Modification rights');
    } else if (target === 7) {
      if (needsShipping && (!form.productShippingBy || form.productShippingBy < tomorrowStr)) m.push('Product shipping date (tomorrow or later)');
      const draftMin = needsShipping && form.productShippingBy ? form.productShippingBy : tomorrowStr;
      if (!form.draftDeliveryBy || form.draftDeliveryBy < draftMin) m.push(needsShipping ? 'Draft delivery date (on or after shipping)' : 'Draft delivery date (tomorrow or later)');
      if (!form.finalDeliveryBy || form.finalDeliveryBy < form.draftDeliveryBy) m.push('Final delivery date (on or after draft delivery)');
      if (!(budget > 0)) m.push('Budget');
      if (!form.creatorLevel) m.push('Creator level');
      if (!form.qualityTier) m.push('Quality tier');
    }
    return m;
  };

  const goNext = () => {
    const issues = stepIssues();
    if (issues.length) {
      toast.error(`Complete to continue: ${issues.join(', ')}`);
      return;
    }
    setStep(Math.min(8, step + 1));
  };

  // Jump straight to a step from the sidebar. Going back is always allowed; jumping
  // forward requires every step in between to be complete (same rule as Next), so
  // the wizard can't be skipped past a half-filled step.
  const goToStep = (target) => {
    if (target === step) return;
    if (target < step) { setStep(target); return; }
    for (let s = step; s < target; s += 1) {
      const issues = stepIssues(s);
      if (issues.length) {
        toast.error(`Complete step ${s} first: ${issues.join(', ')}`);
        setStep(s);
        return;
      }
    }
    setStep(target);
  };

  const saveDraft = async () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    if (savingDraft) return;
    setSavingDraft(true);
    try {
      const payload = buildPayload();
      if (draftId) {
        await axios.patch(`${API}/campaigns/${draftId}`, payload);
      } else {
        const res = await axios.post(`${API}/campaigns/draft`, payload);
        const newId = res.data?.campaign_id || res.data?.id || res.data?._id;
        if (newId) {
          setDraftId(newId);
          localStorage.setItem(DRAFT_ID_KEY, newId);
        }
      }
      toast.success('Draft saved to your account');
      if (onDraftSaved) onDraftSaved();
    } catch (error) {
      // The local copy is safe, so the brand can keep working — but do NOT call this
      // a success. A 403 ("profile must be approved first") used to raise a green
      // "Draft saved" toast, so the brand thought it was on their account when the
      // server had rejected it outright. That's half of "I saved it and it's gone".
      toast.warning('Saved on this device only', {
        description: apiErrorMessage(error, "We couldn't save it to your account — it won't show in Drafts until it saves."),
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
      const payload = buildPayload();
      if (draftId) {
        await axios.patch(`${API}/campaigns/${draftId}`, payload);
      } else {
        const res = await axios.post(`${API}/campaigns/draft`, payload);
        const newId = res.data?.campaign_id || res.data?.id || res.data?._id;
        if (newId) { setDraftId(newId); localStorage.setItem(DRAFT_ID_KEY, newId); }
      }
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
        const payload = buildPayload();
        if (draftId) {
          await axios.patch(`${API}/campaigns/${draftId}`, payload);
        } else {
          const res = await axios.post(`${API}/campaigns/draft`, payload);
          const newId = res.data?.campaign_id || res.data?.id || res.data?._id;
          if (newId) { setDraftId(newId); localStorage.setItem(DRAFT_ID_KEY, newId); }
        }
        // Stop the unmount handler re-sending the identical payload a tick later.
        lastAutoSaveRef.current = JSON.stringify(form);
        toast.success('Draft saved — pick it up from the Drafts tab.');
        if (onDraftSaved) onDraftSaved();
        return true;
      } catch (error) {
        toast.warning('Saved on this device only', {
          description: apiErrorMessage(error, "We couldn't save it to your account — it won't show in Drafts."),
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
      `Category: ${form.category}`,
      `Product: ${form.productName}`,
      `Product description: ${form.productDescription}`,
      `Hook: ${form.campaignHook}`,
      `Key message: ${form.keyMessage}`,
      `Objectives: ${form.objectives.join(', ')}`,
      `Target audience: ${form.targetAudience}`,
      `Budget visibility: ${form.budgetVisible ? 'Visible to creators' : 'Hidden from creators - admin flag'}`,
      '',
      'Deliverables:',
      ...form.deliverables.map((item, index) => `${index + 1}. ${item.quantity} x ${item.type}; duration ${item.duration || 'n/a'}; ratios ${item.aspectRatios.join(', ')}; raw files ${item.rawRequired ? 'required' : 'not required'}`),
      '',
      `Must include: product visible ${form.productVisible ? `${form.visibilitySeconds}s minimum` : 'no'}; verbal mention ${form.verbalMention ? form.productNames : 'no'}; CTA ${form.callToAction}; promo ${form.promoCode || 'n/a'}; hashtags ${form.hashtags || 'n/a'}; brand tag ${form.brandHandleTag ? 'yes' : 'no'}`,
      `Required phrases: ${form.requiredPhrases.filter(Boolean).join(', ') || 'none'}`,
      `Required shots: ${form.requiredShots.filter(Boolean).join(', ') || 'none'}`,
      `Must avoid: competitors ${form.noCompetitors ? form.competitors || 'listed competitors' : 'not specified'}; other products ${form.noOtherProducts ? 'no' : 'allowed'}; profanity ${form.noProfanity ? 'no' : 'allowed'}; political/religious ${form.noPolitical ? 'no' : 'allowed'}; filters ${form.avoidFilters ? form.filterTypes || 'avoid' : 'allowed'}; specific avoid ${form.avoidText || 'none'}`,
      `Style guidance: tones ${form.tones.join(', ')}; pacing ${form.pacing}; music ${form.musicPreference}; references ${form.referenceVideos.filter(Boolean).join(', ') || 'none'}`,
      `Usage rights: platforms ${form.platforms.join(', ')}; duration ${form.rightsDuration}; exclusivity ${form.exclusivity}; whitelisting ${form.whitelisting ? 'yes' : 'no'}; modification ${form.modificationRights}`,
      `Creator targeting: level ${form.creatorLevel}; quality ${form.qualityTier}; gender ${form.genderPreference}; city ${form.cityFilter}; niches ${form.nicheTags.join(', ') || 'none'}`,
      `Timeline: ${needsShipping ? `ship by ${form.productShippingBy}; ` : ''}draft by ${form.draftDeliveryBy}; revisions ${form.revisions}; final by ${form.finalDeliveryBy}`,
      `Budget: ${form.budgetMode === 'fixed' ? `fixed Rs. ${form.fixedBudget}` : `range Rs. ${form.budgetMin} - Rs. ${form.budgetMax}`}`,
      `Commission: platform 20%, total wallet debit Rs. ${totalDebit}, creator receives Rs. ${budget} pre-tax`
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
      due_date: form.finalDeliveryBy,
      deadline: form.finalDeliveryBy,
      revision_limit: Number(form.revisions || 0),
      creators_wanted: Math.max(1, Number(form.creatorsWanted) || 1),
      product_name: form.productName,
      category: form.category,
      product_category: form.category,
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
      total_budget: totalBudget,
      currency: 'INR',

      // Full structured brief so a duplicate can be rebuilt exactly (the backend
      // persists all of these via BriefSectionsMixin).
      target_audience: form.targetAudience,
      budget_visible: form.budgetVisible,
      budget_mode: form.budgetMode,
      deliverable_items: form.deliverables.map(item => ({
        type: item.type,
        quantity: item.quantity,
        duration: item.duration,
        aspect_ratios: item.aspectRatios,
        raw_required: item.rawRequired,
      })),
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
      final_delivery_by: form.finalDeliveryBy,
    };
  };

  const clearDraftStorage = () => {
    publishedRef.current = true;   // brief published — don't auto-save on unmount
    localStorage.removeItem(DRAFT_KEY);
    localStorage.removeItem(DRAFT_ID_KEY);
    setDraftId(null);
  };

  const publish = async () => {
    try {
      setSubmitting(true);

      // Direct brief for a creator who accepted a private invitation: skip the
      // matches/approval path — publish straight to a deal with that creator.
      const directCreator = embeddedCreatorId || searchParams.get('creator');
      if (directCreator) {
        await axios.post(`${API}/campaigns`, { ...buildPayload(), selected_creator: directCreator });
        clearDraftStorage();
        toast.success('Brief sent — the deal has started with the creator');
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
          // Stale/missing draft (e.g. already submitted) — fall back to a fresh brief.
          if (err?.response?.status !== 404) throw err;
        }
      }
      if (!promoted) {
        await axios.post(`${API}/campaigns`, { ...payload, status: 'pending_approval' });
      }
      clearDraftStorage();
      toast.success('Brief published — creators can see it now');
      navigate(publishMode === 'invite' ? '/dashboard/business/pending-bids' : '/dashboard/business');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to publish brief'));
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  };

  const renderTextList = (field, max, placeholder) => (
    <div className="brief-list-inputs">
      {form[field].map((item, index) => (
        <div key={index} className="brief-list-row">
          <input value={item} onChange={(event) => updateTextItem(field, index, event.target.value)} placeholder={placeholder} />
          {(form[field].length > 1 || item) && (
            <button type="button" className="brief-list-del" aria-label="Remove" onClick={() => removeTextItem(field, index)}><Trash2 size={15} /></button>
          )}
        </div>
      ))}
      {form[field].length < max && <button type="button" className="brief-list-add" onClick={() => addTextItem(field, max)}><Plus size={15} /> Add item</button>}
    </div>
  );

  // Reference videos: each row accepts EITHER a pasted link OR a direct upload.
  const renderRefVideos = (max = 3) => (
    <div className="brief-list-inputs">
      {form.referenceVideos.map((item, index) => {
        const busy = uploadingKey === `ref-${index}`;
        const uploaded = isUploadedUrl(item);
        return (
          <div key={index} className="brief-list-row">
            <input
              value={item}
              onChange={(event) => updateTextItem('referenceVideos', index, event.target.value)}
              placeholder="Paste reference video link"
            />
            <label className={`brief-list-up${busy ? ' is-busy' : ''}`} title="Upload a video file instead">
              <Upload size={15} /> {busy ? 'Uploading…' : (uploaded ? 'Replace' : 'Upload')}
              <input
                type="file"
                accept="video/*"
                disabled={busy}
                onChange={(event) => { uploadRefVideo(index, event.target.files?.[0]); event.target.value = ''; }}
              />
            </label>
            {(form.referenceVideos.length > 1 || item) && (
              <button type="button" className="brief-list-del" aria-label="Remove" onClick={() => removeTextItem('referenceVideos', index)}><Trash2 size={15} /></button>
            )}
          </div>
        );
      })}
      {form.referenceVideos.length < max && <button type="button" className="brief-list-add" onClick={() => addTextItem('referenceVideos', max)}><Plus size={15} /> Add item</button>}
    </div>
  );

  const requiredPhrases = form.requiredPhrases.filter(Boolean).join(', ') || 'None';
  const requiredShots = form.requiredShots.filter(Boolean).join(', ') || 'None';
  const referenceVideos = form.referenceVideos.filter(Boolean).join(', ') || 'None';
  const avoidRules = [
    form.noCompetitors ? `No competitor brands visible${form.competitors ? `: ${form.competitors}` : ''}` : '',
    form.noOtherProducts ? 'No other products in frame' : '',
    form.noProfanity ? 'No profanity or adult language' : '',
    form.noPolitical ? 'No political or religious content' : '',
    form.avoidFilters ? `Avoid filters / effects${form.filterTypes ? `: ${form.filterTypes}` : ''}` : '',
    form.avoidText ? `Specific avoid: ${form.avoidText}` : ''
  ].filter(Boolean).join('; ') || 'None';

  return (
    <div className="pab-page brief-builder-page">
      <div className="pab-back-row">
        <button
          type="button"
          className="btn-secondary"
          onClick={() => (onClose ? onClose() : navigate(-1))}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <ChevronLeft size={18} /> Back
        </button>
      </div>
      <div className="pab-stepper brief-stepper">
        <div className="stepper-track">
          {STEPS.map((label, index) => {
            const number = index + 1;
            const active = step === number;
            const done = step > number;
            return (
              <button key={label} type="button" className={`brief-step ${active ? 'active' : ''} ${done ? 'done' : ''}`} onClick={() => goToStep(number)}>
                <span>{done ? <Check size={15} /> : number}</span>
                <small>{label}</small>
              </button>
            );
          })}
        </div>
      </div>

      <div className="pab-body brief-body">
        <div className="pab-form-panel brief-panel">
          <div className="pab-mobile-step-row">
            <button
              type="button"
              className="pab-mobile-back"
              aria-label="Back"
              onClick={() => (onClose ? onClose() : navigate(-1))}
            >
              <ChevronLeft size={21} />
            </button>
            <span className="pab-mobile-step-count">{step}/{STEPS.length}</span>
          </div>
          <div className="pab-tabs">
            <div className="pab-tabs-row">
              {subs.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  className={`pab-tab ${subStep === i ? 'active' : ''} ${subStep > i ? 'done' : ''}`}
                  onClick={() => setSubStep(i)}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="pab-approx">Approx Time: 3 Mins</span>
          </div>
          <div className="step-content">
            <div className="step-header">
              <h2>{subs[subStep] || STEPS[step - 1]}</h2>
            </div>

            <div className="step-fields">
            {step === 1 && subStep === 0 && (
              <>
                <div className="form-group"><label>Campaign name * (3-80 characters)</label><input className="input-field" value={form.campaignName} onChange={e => set('campaignName', e.target.value.slice(0, 80))} placeholder="Summer Launch - Unboxing 2" /><FieldCount value={form.campaignName} min={3} max={80} /></div>

                <div className="form-group">
                  <label>What are you promoting? *</label>
                  <div className="pab-type-grid">
                    {PRODUCT_TYPES.map(pt => {
                      const on = form.productType === pt.value;
                      return (
                        <button type="button" key={pt.value} onClick={() => set('productType', pt.value)}
                          className={`pab-type-card${on ? ' on' : ''}`}>
                          <strong>{pt.label}</strong>
                          <small>{pt.hint}</small>
                        </button>
                      );
                    })}
                  </div>
                  {form.productType === 'other' && (
                    <input className="input-field" style={{ marginTop: 10 }}
                      placeholder="Describe what you're promoting (e.g. Podcast, Event, NGO cause)"
                      value={form.customProductType} onChange={e => set('customProductType', e.target.value)} />
                  )}
                  {!needsShipping && (
                    <small style={{ display: 'block', marginTop: 8, color: '#0891b2', fontWeight: 600, fontSize: 12 }}>
                      ℹ No physical product — shipping &amp; delivery-address steps are skipped.
                    </small>
                  )}
                </div>

                <div className="form-row">
                  <div className="form-group"><label>Brand name</label><input className="input-field" value={form.brandName} disabled /></div>
                  <div className="form-group"><label>Category *</label><select className="input-field" value={form.category} onChange={e => set('category', e.target.value)}><option value="">Select category</option>{CATEGORIES.map(item => <option key={item}>{item}</option>)}</select></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>{needsShipping ? 'Product name *' : 'What are you promoting? (name) *'}</label><input className="input-field" value={form.productName} onChange={e => set('productName', e.target.value)} placeholder={needsShipping ? 'Glow Serum 30ml' : 'e.g. FitTrack App, City Cafe, Summer Sale'} /></div>
                  <div className="form-group"><label>Campaign hook * (10+ characters)</label><input className="input-field" value={form.campaignHook} onChange={e => set('campaignHook', e.target.value)} placeholder="Start with a morning routine problem-solution moment" /><FieldCount value={form.campaignHook} min={10} /></div>
                </div>
              </>
            )}
            {step === 1 && subStep === 1 && (
              <>
                <div className="form-group">
                  <label>Product description * (20+ characters)</label>
                  <textarea className="textarea-field" value={form.productDescription} onChange={e => set('productDescription', e.target.value)} placeholder="Describe the product, who it helps, and what creators should understand before filming." rows={4} />
                  <FieldCount value={form.productDescription} min={20} />
                </div>
                <div className="form-group"><label>Key message * (10+ characters)</label><input className="input-field" value={form.keyMessage} onChange={e => set('keyMessage', e.target.value)} placeholder="The one message every video should communicate" /><FieldCount value={form.keyMessage} min={10} /></div>
              </>
            )}
            {step === 1 && subStep === 2 && (
              <>
                <div className="form-group"><label>Campaign objective *</label><div className="brief-chip-grid">{OBJECTIVES.map(item => <ToggleChip key={item} active={form.objectives.includes(item)} onClick={() => set('objectives', [item])}>{item}</ToggleChip>)}</div></div>
                <div className="form-group"><label>Target audience * (50-200 characters)</label><textarea className="textarea-field" value={form.targetAudience} onChange={e => set('targetAudience', e.target.value.slice(0, 200))} placeholder="Urban women 25-35 interested in clean skincare." rows={3} /><FieldCount value={form.targetAudience} min={50} max={200} /></div>
                <div className="brief-switch-row"><div><strong>Budget visibility</strong><p>Show or hide budget from creators. Hidden budgets are flagged to admin.</p></div><button type="button" className={form.budgetVisible ? 'is-on' : ''} onClick={() => set('budgetVisible', !form.budgetVisible)}>{form.budgetVisible ? 'Show' : 'Hide'}</button></div>
              </>
            )}

            {step === 2 && (
              <>
                {form.deliverables.map((item, index) => (
                  <div className="deliverable-card" key={item.id}>
                    <div className="deliverable-head"><strong>Deliverable {index + 1}</strong>{form.deliverables.length > 1 && <button type="button" onClick={() => removeDeliverable(item.id)}><Trash2 size={16} /> Remove</button>}</div>
                    <div className="form-row">
                      <div className="form-group"><label>Deliverable type *</label><select className="input-field" value={item.type} onChange={e => updateDeliverable(item.id, { type: e.target.value })}><option value="">Select type</option>{DELIVERABLE_TYPES.map(type => <option key={type}>{type}</option>)}</select></div>
                      <div className="form-group"><label>Quantity *</label><input className="input-field" type="number" min="1" max="5" value={item.quantity} onChange={e => updateDeliverable(item.id, { quantity: Number(e.target.value) })} /></div>
                    </div>
                    <div className="form-row">
                      <div className="form-group"><label>Duration {isVideoDeliverable(item.type) ? '*' : ''}</label><input className="input-field" value={item.duration} onChange={e => updateDeliverable(item.id, { duration: e.target.value })} placeholder="15-20 seconds" /></div>
                      <div className="form-group"><label>Raw file delivery required *</label><div className="brief-segment"><button type="button" className={item.rawRequired ? 'active' : ''} onClick={() => updateDeliverable(item.id, { rawRequired: true })}>Yes</button><button type="button" className={!item.rawRequired ? 'active' : ''} onClick={() => updateDeliverable(item.id, { rawRequired: false })}>No</button></div></div>
                    </div>
                    <div className="form-group"><label>Aspect ratio *</label><div className="brief-chip-grid compact">{ASPECTS.map(ratio => <ToggleChip key={ratio} active={item.aspectRatios.includes(ratio)} onClick={() => updateDeliverable(item.id, { aspectRatios: item.aspectRatios.includes(ratio) ? item.aspectRatios.filter(r => r !== ratio) : [...item.aspectRatios, ratio] })}>{ratio}</ToggleChip>)}</div></div>
                  </div>
                ))}
                <button type="button" className="brief-add-btn" onClick={addDeliverable}><Plus size={17} /> Add deliverable ({form.deliverables.length}/5)</button>
              </>
            )}

            {step === 3 && subStep === 0 && (
              <>
                <div className="brief-switch-row"><div><strong>Product visible on camera *</strong><p>If yes, specify minimum visibility duration.</p></div><button type="button" className={form.productVisible ? 'is-on' : ''} onClick={() => set('productVisible', !form.productVisible)}>{form.productVisible ? 'Yes' : 'No'}</button></div>
                {form.productVisible && <div className="form-group"><label>Minimum visibility duration (seconds)</label><input className="input-field" value={form.visibilitySeconds} onChange={e => set('visibilitySeconds', e.target.value)} placeholder="5" /></div>}
                <div className="brief-switch-row"><div><strong>Verbal product mention *</strong><p>List exact product names to be spoken.</p></div><button type="button" className={form.verbalMention ? 'is-on' : ''} onClick={() => set('verbalMention', !form.verbalMention)}>{form.verbalMention ? 'Yes' : 'No'}</button></div>
                {form.verbalMention && <div className="form-group"><label>Exact product name(s)</label><input className="input-field" value={form.productNames} onChange={e => set('productNames', e.target.value)} /></div>}
              </>
            )}
            {step === 3 && subStep === 1 && (
              <>
                <div className="form-row"><div className="form-group"><label>Required phrases (up to 5)</label>{renderTextList('requiredPhrases', 5, 'Perfect for oily skin')}</div><div className="form-group"><label>Required visual shots (up to 5)</label>{renderTextList('requiredShots', 5, 'Close-up of label')}</div></div>
                <div className="form-row"><div className="form-group"><label>Call to action *</label><select className="input-field" value={form.callToAction} onChange={e => set('callToAction', e.target.value)}>{CTAS.map(item => <option key={item}>{item}</option>)}</select></div>{form.callToAction === 'Use code' && <div className="form-group"><label>Promo code *</label><input className="input-field" value={form.promoCode} onChange={e => set('promoCode', e.target.value)} /></div>}{CTA_INPUT[form.callToAction] && <div className="form-group"><label>{CTA_INPUT[form.callToAction].label} *</label><input className="input-field" placeholder={CTA_INPUT[form.callToAction].ph} value={form.ctaLink} onChange={e => set('ctaLink', e.target.value)} />{form.ctaLink && !ctaLinkValid(form.callToAction, form.ctaLink) && <small style={{ color: '#ef4444', fontSize: 12, marginTop: 4, display: 'block' }}>{CTA_INPUT[form.callToAction].type === 'handle' ? 'Enter a valid @handle or profile link — no random text.' : 'Enter a valid link (e.g. https://yourbrand.com) — no random text.'}</small>}</div>}</div>
                <div className="form-row"><div className="form-group"><label>Required hashtags</label><input className="input-field" value={form.hashtags} onChange={e => handleHashtagsChange(e.target.value)} placeholder="#brand #launch" /><small>Up to 10 hashtags.</small></div><div className="form-group"><label>Brand handle tag *</label><div className="brief-segment"><button className={form.brandHandleTag ? 'active' : ''} type="button" onClick={() => set('brandHandleTag', true)}>Yes</button><button className={!form.brandHandleTag ? 'active' : ''} type="button" onClick={() => set('brandHandleTag', false)}>No</button></div></div></div>
              </>
            )}

            {step === 4 && subStep === 0 && (
              <>
                {[
                  ['noCompetitors', 'No competitor brands visible'],
                  ['noOtherProducts', 'No other products in frame'],
                  ['noProfanity', 'No profanity or adult language'],
                  ['noPolitical', 'No political or religious content'],
                  ['avoidFilters', 'Avoid filters / effects']
                ].map(([field, label]) => <label key={field} className="brief-check"><input type="checkbox" checked={form[field]} onChange={e => set(field, e.target.checked)} /> {label}</label>)}
                {form.avoidFilters && <div className="form-group"><label>Which filters/effects?</label><input className="input-field" value={form.filterTypes} onChange={e => set('filterTypes', e.target.value)} /></div>}
              </>
            )}

            {step === 4 && subStep === 1 && (
              <>
                {form.noCompetitors && <div className="form-group"><label>Competitor list</label><input className="input-field" value={form.competitors} onChange={e => set('competitors', e.target.value)} /></div>}
                <div className="form-group"><label>Specific things to avoid (200 max)</label><textarea className="textarea-field" rows={3} value={form.avoidText} onChange={e => set('avoidText', e.target.value.slice(0, 200))} /><FieldCount value={form.avoidText} max={200} /></div>
              </>
            )}

            {step === 5 && subStep === 0 && (
              <>
                <div className="brief-note"><Info size={18} /> This section is guidance, not grounds for dispute. Creators are expected to interpret style flexibly.</div>
                <div className="form-group"><label>Tone *</label><div className="brief-chip-grid">{TONES.map(item => <ToggleChip key={item} active={form.tones.includes(item)} onClick={() => toggleArray('tones', item)}>{item}</ToggleChip>)}</div></div>
                <div className="form-row"><div className="form-group"><label>Pacing preference *</label><select className="input-field" value={form.pacing} onChange={e => set('pacing', e.target.value)}>{['Fast-cut', 'Medium', 'Slow & reflective', 'No preference'].map(item => <option key={item}>{item}</option>)}</select></div><div className="form-group"><label>Music preference</label><select className="input-field" value={form.musicPreference} onChange={e => set('musicPreference', e.target.value)}>{['Original creator audio', 'Trending sound', 'Brand-provided audio file', 'No preference'].map(item => <option key={item}>{item}</option>)}</select></div></div>
              </>
            )}
            {step === 5 && subStep === 1 && (
              <>
                <div className="form-group">
                  <label>Mood board images (up to 5)</label>
                  <label className="mini-upload">
                    <Upload size={18} /> {moodUploading ? 'Uploading…' : 'Upload references'}
                    <input type="file" multiple accept="image/*" disabled={moodUploading || form.moodImages.length >= 5} onChange={uploadMoodImages} />
                  </label>
                  {form.moodImages.length > 0 && (
                    <div className="mood-grid">
                      {form.moodImages.map((item, index) => {
                        const src = item.startsWith('http') ? item : `${BACKEND_URL}${item}`;
                        const viewable = item.startsWith('http') || item.startsWith('/');
                        return (
                          <div className="mood-thumb" key={`${item}-${index}`}>
                            {viewable
                              ? <a href={src} target="_blank" rel="noreferrer"><img src={src} alt={`Mood board ${index + 1}`} /></a>
                              : <span className="mood-thumb-name">{item}</span>}
                            <button type="button" onClick={() => removeMoodImage(index)} aria-label="Remove image"><Trash2 size={13} /></button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <small>{form.moodImages.length}/5 added · click an image to view it full size</small>
                </div>
                <div className="form-group">
                  <label>Reference videos (up to 3)</label>
                  {renderRefVideos(3)}
                  <small>Paste a link, or upload a video file (max 200MB) — creators see uploaded clips inline.</small>
                </div>
              </>
            )}

            {step === 6 && subStep === 0 && (
              <div className="form-group"><label>Platforms where content can be posted *</label><div className="brief-chip-grid">{PLATFORMS.map(item => <ToggleChip key={item} active={form.platforms.includes(item)} onClick={() => toggleArray('platforms', item)}>{item}</ToggleChip>)}</div></div>
            )}
            {step === 6 && subStep === 1 && (
              <>
                <div className="form-row"><div className="form-group"><label>Duration of rights *</label><select className="input-field" value={form.rightsDuration} onChange={e => set('rightsDuration', e.target.value)}><option value="">Select duration</option>{['1 month', '3 months', '6 months', '1 year', '2 years', 'Perpetual'].map(item => <option key={item}>{item}</option>)}</select></div><div className="form-group"><label>Exclusivity period *</label><select className="input-field" value={form.exclusivity} onChange={e => set('exclusivity', e.target.value)}>{['None', '15 days', '30 days', '60 days', '90 days'].map(item => <option key={item}>{item}</option>)}</select></div></div>
                <div className="form-row"><div className="form-group"><label>Whitelisting / allowlisting *</label><div className="brief-segment"><button className={form.whitelisting ? 'active' : ''} type="button" onClick={() => set('whitelisting', true)}>Yes (+30%)</button><button className={!form.whitelisting ? 'active' : ''} type="button" onClick={() => set('whitelisting', false)}>No</button></div></div><div className="form-group"><label>Modification rights *</label><select className="input-field" value={form.modificationRights} onChange={e => set('modificationRights', e.target.value)}><option value="">Select rights</option>{['Yes (full rights)', 'Limited (minor edits only)', 'No (use as-is)'].map(item => <option key={item}>{item}</option>)}</select></div></div>
                {pricingLifts.length > 0 && <div className="brief-note warning"><AlertTriangle size={18} /> Suggested pricing lifts: {pricingLifts.join('; ')}</div>}
              </>
            )}

            {step === 7 && subStep === 0 && (
              <>
                <div className="form-row">
                  <div className="form-group"><label>Minimum creator level *</label><select className="input-field" value={form.creatorLevel} onChange={e => set('creatorLevel', e.target.value)}><option value="">Select level</option>{CREATOR_LEVELS.map(item => <option key={item}>{item}</option>)}</select></div>
                  <div className="form-group"><label>Content quality tier *</label><select className="input-field" value={form.qualityTier} onChange={e => set('qualityTier', e.target.value)}><option value="">Select tier</option>{QUALITY_TIERS.map(item => <option key={item}>{item}</option>)}</select></div>
                </div>
                <div className="form-row">
                  <div className="form-group"><label>Gender preference</label><select className="input-field" value={form.genderPreference} onChange={e => set('genderPreference', e.target.value)}>{GENDER_OPTIONS.map(item => <option key={item}>{item}</option>)}</select></div>
                  <div className="form-group"><label>City filter</label><select className="input-field" value={form.cityFilter} onChange={e => set('cityFilter', e.target.value)}>{CITIES.map(item => <option key={item}>{item}</option>)}</select></div>
                </div>
                <div className="form-group"><label>Creator niche tags</label><div className="brief-chip-grid">{NICHE_TAGS.map(item => <ToggleChip key={item} active={form.nicheTags.includes(item)} onClick={() => toggleArray('nicheTags', item)}>{item}</ToggleChip>)}</div></div>
              </>
            )}
            {step === 7 && subStep === 1 && (
              <>
                <div className="form-row">
                  {needsShipping && (
                    <div className="form-group"><label>Product shipping by *</label><input className="input-field" type="date" min={addDays(new Date().toISOString().slice(0, 10), 1)} value={form.productShippingBy} onChange={e => set('productShippingBy', e.target.value)} /><small>Cannot be today — earliest is tomorrow.</small></div>
                  )}
                  <div className="form-group"><label>Content draft delivery by *</label><input className="input-field" type="date" min={form.productShippingBy || addDays(new Date().toISOString().slice(0, 10), 1)} value={form.draftDeliveryBy} onChange={e => set('draftDeliveryBy', e.target.value)} /><small>{needsShipping ? (draftDeliverySuggestion ? `Suggested from shipping date: ${draftDeliverySuggestion}` : 'Suggested as product shipping + 7 days.') : 'No product to ship — the creator starts as soon as they accept.'}</small></div>
                </div>
                <div className="form-row"><div className="form-group"><label>Revisions included *</label><input className="input-field" type="number" min="0" value={form.revisions} onChange={e => set('revisions', Number(e.target.value))} /><small>Extra revisions: Rs. 500 each</small></div><div className="form-group"><label>Final content delivery by</label><input className="input-field" type="date" min={form.draftDeliveryBy || form.productShippingBy || addDays(new Date().toISOString().slice(0, 10), 1)} value={form.finalDeliveryBy} onChange={e => set('finalDeliveryBy', e.target.value)} /></div></div>
              </>
            )}
            {step === 7 && subStep === 2 && (
              <>
                <div className="form-group">
                  <label>How many creators do you want? *</label>
                  <input
                    className="input-field"
                    type="number"
                    min="1"
                    max="20"
                    value={form.creatorsWanted}
                    onChange={e => set('creatorsWanted', Math.min(20, Math.max(1, Number(e.target.value) || 1)))}
                  />
                  <small>
                    You’re charged per creator, only when you select them — nothing is held
                    when you post this brief. The brief stays open until all {Math.max(1, Number(form.creatorsWanted) || 1)} are picked.
                  </small>
                </div>
                <div className="form-group"><label>Budget *</label><div className="brief-segment"><button className={form.budgetMode === 'fixed' ? 'active' : ''} type="button" onClick={() => set('budgetMode', 'fixed')}>Fixed amount</button><button className={form.budgetMode === 'range' ? 'active' : ''} type="button" onClick={() => set('budgetMode', 'range')}>Range</button></div></div>
                {form.budgetMode === 'fixed' ? <div className="form-group"><label>Fixed budget (Rs.)</label><input className="input-field" type="text" inputMode="numeric" value={form.fixedBudget} onKeyDown={blockNonDigitKey} onChange={e => set('fixedBudget', digitsOnly(e.target.value))} /></div> : <div className="form-row"><div className="form-group"><label>Min budget (Rs.)</label><input className="input-field" type="text" inputMode="numeric" value={form.budgetMin} onKeyDown={blockNonDigitKey} onChange={e => set('budgetMin', digitsOnly(e.target.value))} /></div><div className="form-group"><label>Max budget (Rs.)</label><input className="input-field" type="text" inputMode="numeric" value={form.budgetMax} onKeyDown={blockNonDigitKey} onChange={e => set('budgetMax', digitsOnly(e.target.value))} /></div></div>}
                <div className="commission-card">
                  <p>Budget per creator <strong>Rs. {budget.toLocaleString('en-IN')}</strong></p>
                  {creatorsCount > 1 && <p>Creators wanted <strong>× {creatorsCount}</strong></p>}
                  <p>Total budget{creatorsCount > 1 ? ` (${budget.toLocaleString('en-IN')} × ${creatorsCount})` : ''} <strong>Rs. {totalBudget.toLocaleString('en-IN')}</strong></p>
                  <p>Platform commission (20%) <strong>Rs. {commission.toLocaleString('en-IN')}</strong></p>
                  <p>Listing fee (flat) <strong>Rs. {listingFee.toLocaleString('en-IN')}</strong></p>
                  <p>Total wallet debit <strong>Rs. {totalDebit.toLocaleString('en-IN')}</strong></p>
                </div>
              </>
            )}

            {step === 8 && (() => {
              const reviewSections = [
                { title: 'Campaign Basics', rows: [['Campaign', form.campaignName], ['Brand', form.brandName], ['Category', form.category], ['Type', form.productType === 'other' ? (form.customProductType || 'Other') : (PRODUCT_TYPES.find(p => p.value === form.productType)?.label || form.productType)], ['Product', form.productName], ['Product description', form.productDescription], ['Hook', form.campaignHook], ['Key message', form.keyMessage], ['Objectives', form.objectives.join(', ')], ['Audience', form.targetAudience], ['Budget visibility', form.budgetVisible ? 'Visible to creators' : 'Hidden from creators; flagged to admin']] },
                { title: 'Deliverables', rows: form.deliverables.map((item, index) => [`Deliverable ${index + 1}`, `${item.quantity} x ${item.type}; ${item.duration || 'no duration'}; ${item.aspectRatios.join(', ')}; raw files ${item.rawRequired ? 'required' : 'not required'}`]) },
                { title: 'Must-Include Checklist', rows: [['Product visible', form.productVisible ? `${form.visibilitySeconds}s minimum` : 'No'], ['Verbal mention', form.verbalMention ? form.productNames : 'No'], ['Required phrases', requiredPhrases], ['Required shots', requiredShots], ['CTA', form.callToAction], ...(CTA_INPUT[form.callToAction] ? [[CTA_INPUT[form.callToAction].label, form.ctaLink || 'None']] : []), ['Promo code', form.promoCode || 'None'], ['Required hashtags', form.hashtags || 'None'], ['Brand tag', form.brandHandleTag ? 'Yes' : 'No']] },
                { title: 'Must-Avoid Checklist', rows: [['Restrictions', avoidRules]] },
                { title: 'Style Guidance', rows: [['Tone', form.tones.join(', ')], ['Pacing', form.pacing], ['Mood board images', form.moodImages.join(', ') || 'None'], ['Reference videos', referenceVideos], ['Music preference', form.musicPreference], ['Note', 'Guidance only; not grounds for dispute.']] },
                { title: 'Usage Rights', rows: [['Platforms', form.platforms.join(', ')], ['Rights duration', form.rightsDuration], ['Exclusivity', form.exclusivity], ['Whitelisting', form.whitelisting ? 'Yes' : 'No'], ['Modification', form.modificationRights]] },
                { title: 'Creator Targeting', rows: [['Minimum level', form.creatorLevel], ['Quality tier', form.qualityTier], ['Gender preference', form.genderPreference], ['City filter', form.cityFilter], ['Niche tags', form.nicheTags.join(', ') || 'None']] },
                { title: 'Timeline & Budget', rows: [...(needsShipping ? [['Ship by', form.productShippingBy]] : []), ['Draft by', form.draftDeliveryBy], ['Revisions included', form.revisions], ['Final by', form.finalDeliveryBy], ['Budget per creator', form.budgetMode === 'fixed' ? `Rs. ${budget.toLocaleString('en-IN')}` : `Rs. ${Number(form.budgetMin || 0).toLocaleString('en-IN')} - Rs. ${budget.toLocaleString('en-IN')}`], ['Creators wanted', `${creatorsCount}`], ['Total budget', `Rs. ${totalBudget.toLocaleString('en-IN')}`], ['Platform commission', `Rs. ${commission.toLocaleString('en-IN')}`], ['Listing fee', `Rs. ${listingFee.toLocaleString('en-IN')}`], ['Total wallet debit', `Rs. ${totalDebit.toLocaleString('en-IN')}`]] },
              ];
              const activeIdx = Math.min(reviewTab, reviewSections.length - 1);
              const active = reviewSections[activeIdx];
              return (
                <div className="review-summary">
                  <div className="review-tabs" role="tablist">
                    {reviewSections.map((s, i) => (
                      <button key={s.title} type="button" role="tab" aria-selected={i === activeIdx} className={i === activeIdx ? 'on' : ''} onClick={() => setReviewTab(i)}>{s.title}</button>
                    ))}
                  </div>
                  <Summary title={active.title} rows={active.rows} />
                </div>
              );
            })()}
            </div>
          </div>

          <div className="pab-footer">
            <div className="pab-progress">
              <div className="pab-progress-track"><i style={{ width: `${Math.round((step / STEPS.length) * 100)}%` }} /></div>
              <span>{100 - Math.round((step / STEPS.length) * 100)}% Left</span>
            </div>
            <div className="pab-footer-actions">
              <button type="button" className="btn-secondary" onClick={saveDraft} disabled={savingDraft}><Save size={16} /> {savingDraft ? 'Saving…' : 'Save Draft'}</button>
              {(step > 1 || subStep > 0) && <button type="button" className="btn-secondary" onClick={() => { if (subStep > 0) setSubStep(s => s - 1); else setStep(step - 1); }}><ChevronLeft size={18} /> Previous</button>}
              {step < 8 ? (
                <button type="button" className="btn-primary" onClick={() => { if (subStep < subs.length - 1) setSubStep(s => s + 1); else goNext(); }}>Next <ChevronRight size={18} /></button>
              ) : (embeddedCreatorId || searchParams.get('creator')) ? (
                <button type="button" className="btn-primary" onClick={() => setShowConfirm(true)} disabled={submitting}><Send size={16} /> Publish & Start Deal</button>
              ) : (
                <button type="button" className="btn-primary" onClick={() => { setPublishMode('matches'); setShowConfirm(true); }} disabled={submitting}><Send size={16} /> Publish Campaign</button>
              )}
            </div>
          </div>
        </div>

      </div>

      {showConfirm && createPortal(
        <div className="brief-modal-backdrop">
          <div className="brief-modal">
            <h3>Confirm publishing</h3>
            <p className="brief-hold-callout">
              <strong>Rs. {totalDebit.toLocaleString('en-IN')} will be placed ON HOLD</strong> in your wallet, locked in secure escrow — this money is <strong>held, not spent</strong>.
            </p>
            <div>
              <button type="button" className="btn-secondary" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button type="button" className="btn-primary" onClick={publish} disabled={submitting}>{submitting ? 'Publishing...' : 'Continue'}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        /* "N more characters needed" — amber until the minimum length is met */
        .brief-need{color:#b45309;font-weight:600}
        /* top step-tabs (General / Address … style) */
        .pab-tabs{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid #eef0f6;padding:0 4px 0 0;margin-bottom:18px}
        .pab-tabs-row{display:flex;gap:26px;overflow-x:auto;scrollbar-width:none;flex:1;min-width:0}
        .pab-tabs-row::-webkit-scrollbar{display:none}
        .pab-tab{background:none;border:none;padding:14px 2px;font-family:inherit;font-size:14.5px;font-weight:700;color:#9aa0c2;white-space:nowrap;cursor:default;border-bottom:2.5px solid transparent;margin-bottom:-1px}
        .pab-tab.done{color:#5b6bff;cursor:pointer}
        .pab-tab.active{color:#3730a3;border-bottom-color:#4452f0}
        .pab-approx{flex:none;font-size:11.5px;font-weight:700;color:#9aa0c2;text-transform:uppercase;letter-spacing:.4px}
        /* bottom progress bar */
        .pab-progress{display:flex;align-items:center;gap:14px;flex:1;min-width:120px;max-width:340px}
        .pab-progress-track{flex:1;height:8px;border-radius:6px;background:#eceefb;overflow:hidden}
        .pab-progress-track i{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,#5b6bff,#4452f0);transition:width .3s}
        .pab-progress span{flex:none;font-size:12.5px;font-weight:700;color:#9aa0c2}
        /* small circular step-progress ring (top-left of the content) */
        .pab-ring{position:relative;width:48px;height:48px;display:grid;place-items:center}
        .pab-ring svg{width:48px;height:48px}
        .pab-ring-bg{fill:none;stroke:#eceefb;stroke-width:3}
        .pab-ring-fg{fill:none;stroke:#4452f0;stroke-width:3;stroke-linecap:round;transition:stroke-dasharray .35s}
        .pab-ring span{position:absolute;font-size:12px;font-weight:800;color:#3730a3}
        /* ring placed on the purple sidebar */
        .pab-ring-side{width:76px;height:76px;margin:0 22px 22px 6px;align-self:flex-start}
        .pab-ring-side svg{width:76px;height:76px}
        .pab-ring-side .pab-ring-bg{stroke:rgba(255,255,255,0.25)}
        .pab-ring-side .pab-ring-fg{stroke:#34d399}
        .pab-ring-side span{color:#fff;font-size:16px}
        /* compact cost strip below the step */
        .pab-cost{display:flex;flex-wrap:wrap;align-items:center;gap:8px 20px;margin-top:22px;padding:12px 16px;border:1px solid #eceefb;border-radius:12px;background:#f7f8ff;font-size:13px;color:#9aa0c2;font-weight:600}
        .pab-cost b{color:#07074e;font-weight:800;margin-left:4px}
        .pab-cost-total{margin-left:auto}
        .pab-cost-total b{color:#4452f0}
        /* per-step field-completion bar above the form */
        .pab-fill{display:flex;align-items:center;gap:12px;margin:6px 0 22px}
        .pab-fill-track{flex:1;height:6px;border-radius:6px;background:#eceefb;overflow:hidden}
        .pab-fill-track i{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,#34d399,#10b981);transition:width .3s}
        .pab-fill span{flex:none;font-size:11.5px;font-weight:700;color:#9aa0c2}

        .brief-builder-page {
          color: #07074E;
          display: grid;
          grid-template-columns: 252px minmax(0, 1fr);
          gap: 0;
          align-items: stretch;
        }

        .brief-stepper {
          padding: 0;
        }

        .brief-stepper .stepper-track {
          position: relative;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          gap: 14px;
          padding: 44px 0 30px 22px;
          background: linear-gradient(165deg, #4f46e5 0%, #4338ca 55%, #3730a3 100%);
          border: none;
          border-radius: 24px 0 0 24px;
          overflow: visible;
        }
        /* connector line segment between consecutive numbers (sits on the divider) */
        .brief-step::before {
          content: '';
          position: absolute;
          right: 0;
          top: -14px;
          bottom: 50%;
          width: 2px;
          transform: translateX(50%);
          background: rgba(255, 255, 255, 0.28);
          z-index: 0;
        }
        .brief-step:first-child::before { display: none; }

        .brief-step {
          position: relative;
          display: block;
          padding: 16px 42px 16px 8px;
          border: 0;
          background: transparent;
          color: rgba(255, 255, 255, 0.72);
          font-weight: 600;
          text-align: left;
          cursor: pointer;
        }

        .brief-step small { display: block; font-size: 15.5px; line-height: 1.3; font-weight: 700; }
        .brief-step span {
          position: absolute;
          right: 0;
          top: 50%;
          transform: translate(50%, -50%);
          z-index: 2;
          display: grid;
          place-items: center;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: 2px solid #6b63e8;
          background: #5b54e0;
          color: #fff;
          font-weight: 700;
          font-size: 15px;
        }

        @media (max-width: 980px) {
          .brief-builder-page { grid-template-columns: minmax(0, 1fr); }
          .brief-stepper .stepper-track { flex-direction: row; overflow-x: auto; padding: 14px; border-radius: 18px; justify-content: flex-start; }
          .brief-stepper .stepper-track::after { display: none; }
          .brief-step { display: flex; flex-direction: column; gap: 8px; min-width: 104px; text-align: center; padding: 8px; }
          .brief-step span { position: static; transform: none; }
          .brief-step small { padding-right: 0; }
          .brief-panel { border-radius: 18px; border-left: 1px solid #E9EBFF; padding: 28px; }
        }

        .brief-step small {
          font-size: 17.5px;
          line-height: 1.3;
          text-align: left;
          font-weight: 700;
        }

        .brief-step:hover { background: rgba(255, 255, 255, 0.08); }

        .brief-step.active {
          color: #fff;
          font-weight: 800;
        }

        .brief-step.active span {
          border-color: #fff;
          background: #fff;
          color: #4338ca;
          box-shadow: 0 0 0 3px #34d399;
        }

        .brief-step.done {
          color: #fff;
        }

        .brief-step.done span {
          border-color: #c7d2fe;
          background: #c7d2fe;
          color: #4338ca;
        }

        .pab-type-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 10px;
          margin-top: 4px;
        }

        .pab-type-card {
          text-align: left;
          padding: 11px 13px;
          border-radius: 12px;
          cursor: pointer;
          border: 1.5px solid #e5e8fb;
          background: #fff;
          color: #15163a;
          font-family: inherit;
        }

        .pab-type-card.on { border-color: #07074e; background: #f2f3ff; }
        .pab-type-card strong { display: block; font-size: 13.5px; }
        .pab-type-card small { color: #8a90a6; font-size: 11.5px; }

        @media (max-width: 1280px) {
          .brief-body { grid-template-columns: 1fr; }
        }

        /* ---- Mobile (must stay after the desktop rules above so it wins) ---- */
        @media (max-width: 640px) {
          /* minmax(0,..) not 1fr — plain 1fr lets the wide tab row/stepper
             stretch the column past the viewport instead of scrolling. */
          .brief-builder-page { grid-template-columns: minmax(0, 1fr); }
          .brief-panel, .step-content, .pab-tabs { min-width: 0; max-width: 100%; }

          /* Purple stepper becomes a compact horizontal scroller */
          .brief-stepper .stepper-track {
            padding: 12px 10px;
            gap: 4px;
            border-radius: 16px;
          }
          .brief-step {
            min-width: 76px;
            padding: 6px 4px;
            gap: 6px;
          }
          .brief-step small { font-size: 11.5px; text-align: center; }
          .brief-step span { width: 30px; height: 30px; font-size: 13px; }

          .brief-panel { padding: 18px 14px; }

          /* Tab row: let it scroll instead of pushing the page wide */
          .pab-tabs {
            flex-direction: column;
            align-items: flex-start;
            gap: 6px;
            margin-bottom: 14px;
          }
          .pab-tabs-row {
            width: 100%;
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 6px;
            justify-content: center;
            -webkit-overflow-scrolling: touch;
          }

          .pab-tab {
            width: 100%;
            padding-left: 2px;
            padding-right: 2px;
            text-align: center;
            white-space: nowrap;
            font-size: 11px;
          }
          .pab-tab { font-size: 13px; padding: 11px 2px; }

          .step-header h2 { font-size: 22px; }

          /* Two-column field rows stack */
          .form-row { grid-template-columns: 1fr; }

          /* One promoting-type card per row so text never clips */
          .pab-type-grid { grid-template-columns: 1fr; }

          .pab-img-preview { height: 120px; }
          .pab-img-empty { padding: 18px 12px; }
        }

        .brief-body {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 26px;
          padding: 0;
        }
        /* Reference layout is two-column (sidebar + content); the cost rail is hidden here. */
        .brief-rail { display: none; }

        .brief-panel {
          background: white;
          border: 1px solid #E9EBFF;
          border-left: none;
          border-radius: 0 22px 22px 0;
          padding: 34px 36px 34px 44px;
          box-shadow: 0 18px 40px rgba(7, 7, 78, 0.05);
          /* Flex column with a stable height so the footer can sit pinned to the bottom. */
          display: flex;
          flex-direction: column;
          min-height: 560px;
        }

        .step-content {
          display: flex;
          flex-direction: column;
          gap: 18px;
          padding-bottom: 20px;
          position: relative;   /* anchor for the top-right logo float */
        }
        /* Fields flow naturally; the CARD itself scrolls (see .cmk-brief-modal),
           so there's a single scrollbar inside the card, not on the page. */
        .step-fields {
          min-height: 280px;
          overflow: visible;
          display: flex;
          flex-direction: column;
          gap: 18px;
          padding-right: 8px;
        }

        .step-badge {
          width: fit-content;
          padding: 8px 14px;
          border-radius: 999px;
          background: #F3F3FF;
          color: #07074e;
          font-size: 12px;
          font-weight: 400;
          text-transform: uppercase;
        }

        .step-header h2 {
          margin: 0 0 8px;
          color: #07074E;
          font-size: 30px;
        }

        .step-header p {
          margin: 0;
          color: #9F9FD1;
          font-weight: 400;
        }

        .form-row {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .pab-img-drop { display: block; position: relative; cursor: pointer; border-radius: 14px; overflow: hidden;
          border: 1.5px dashed #cdd2f3; background: linear-gradient(140deg, #f7f8ff, #f2f3ff); transition: border-color .15s, background .15s; }
        .pab-img-drop:hover { border-color: #5b6bff; background: #eef0ff; }
        .pab-img-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; padding: 24px 18px; color: #5b6bff; }
        .pab-img-empty strong { color: #07074e; font-size: 14.5px; }
        .pab-img-empty small { color: #8a8fc0; font-weight: 500; font-size: 12.5px; }
        .pab-img-preview { display: block; width: 100%; height: 150px; object-fit: cover; }
        .pab-img-change { position: absolute; bottom: 10px; right: 12px; background: rgba(7,7,78,.72); color: #fff;
          font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 20px; backdrop-filter: blur(4px); }

        .form-group label {
          color: #07074E;
          font-size: 13px;
          font-weight: 400;
          text-transform: uppercase;
        }

        .form-group small {
          color: #9F9FD1;
          font-weight: 400;
        }

        .input-field,
        .textarea-field,
        .brief-list-inputs input {
          width: 100%;
          border: 1px solid #E2E4F0;
          border-radius: 13px;
          background: #FAFAFE;
          color: #07074E;
          font: inherit;
          font-size: 15px;
          font-weight: 400;
          padding: 14px 16px;
          outline: 0;
        }

        .textarea-field {
          resize: vertical;
        }
        /* selects: custom chevron sitting a bit left of the edge (not flush) */
        select.input-field {
          -webkit-appearance: none;
          -moz-appearance: none;
          appearance: none;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%2307074E' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M4 6l4 4 4-4'/></svg>");
          background-repeat: no-repeat;
          background-position: right 18px center;
          padding-right: 44px;
        }

        .brief-chip-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .brief-chip {
          min-height: 38px;
          padding: 0 14px;
          border: 1px solid #E2E4F0;
          border-radius: 999px;
          background: white;
          color: #7777B7;
          font-weight: 400;
          cursor: pointer;
        }

        .brief-chip.active {
          border-color: #07074e;
          background: #07074e;
          color: white;
        }

        .brief-chip-grid.compact .brief-chip {
          min-width: 72px;
        }

        .brief-switch-row,
        .brief-note,
        .commission-card,
        .deliverable-card {
          padding: 18px;
          border: 1px solid #E9EBFF;
          border-radius: 18px;
          background: #F9F9FF;
        }

        .brief-switch-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
        }

        .brief-switch-row p {
          margin: 5px 0 0;
          color: #9F9FD1;
          font-weight: 400;
        }

        .brief-switch-row > button {
          min-width: 82px;
          height: 38px;
          border: 0;
          border-radius: 999px;
          background: #DCDDFA;
          color: #07074E;
          font-weight: 400;
          cursor: pointer;
        }

        .brief-switch-row > button.is-on {
          background: #07074e;
          color: white;
        }

        .brief-segment {
          display: flex;
          padding: 5px;
          border-radius: 13px;
          background: #EEF0FF;
        }

        .brief-segment button {
          flex: 1;
          min-height: 38px;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: #7777B7;
          font-weight: 400;
          cursor: pointer;
        }

        .brief-segment button.active {
          background: white;
          color: #07074E;
          box-shadow: 0 6px 14px rgba(7, 7, 78, 0.06);
        }

        .deliverable-card {
          display: flex;
          flex-direction: column;
          gap: 18px;
          background: white;
        }

        .deliverable-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .deliverable-head button,
        .brief-list-inputs button,
        .brief-add-btn,
        .mini-upload {
          width: fit-content;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 0;
          border-radius: 11px;
          background: #EEF0FF;
          color: #07074e;
          font-weight: 400;
          padding: 10px 13px;
          cursor: pointer;
        }

        .mini-upload input {
          display: none;
        }

        .mood-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 9px;
          margin-top: 9px;
        }

        .mood-thumb {
          position: relative;
          width: 84px;
          height: 84px;
          border-radius: 11px;
          overflow: hidden;
          background: #EEF0FF;
        }

        .mood-thumb img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .mood-thumb-name {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          padding: 6px;
          font-size: 10px;
          color: #07074e;
          text-align: center;
          word-break: break-all;
        }

        .mood-thumb button {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 21px;
          height: 21px;
          padding: 0;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 7px;
          background: rgba(7, 7, 78, 0.72);
          color: #fff;
          cursor: pointer;
        }

        .brief-list-inputs {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .brief-list-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .brief-list-row input { flex: 1; min-width: 0; }
        /* Per-row "upload a video instead of a link" control */
        .brief-list-up {
          flex: none;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          height: 42px;
          padding: 0 13px;
          border-radius: 11px;
          background: #EEF0FF;
          color: #07074e;
          font-size: 13px;
          font-weight: 500;
          white-space: nowrap;
          cursor: pointer;
        }
        .brief-list-up:hover { background: #e2e6ff; }
        .brief-list-up.is-busy { opacity: 0.6; cursor: progress; }
        .brief-list-up input { display: none; }
        .brief-list-inputs button.brief-list-del {
          flex: none;
          width: 42px;
          height: 42px;
          padding: 0;
          display: grid;
          place-items: center;
          background: #fdeeee;
          color: #d64545;
          border-radius: 11px;
        }
        .brief-list-inputs button.brief-list-del:hover { background: #fbdcdc; }

        .brief-check {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          border: 1px solid #E9EBFF;
          border-radius: 14px;
          background: white;
          color: #07074E;
          font-weight: 400;
        }

        .brief-check input {
          width: 18px;
          height: 18px;
        }

        .brief-note {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          color: #07074e;
          font-weight: 400;
        }

        .brief-note.warning {
          background: #FFF8E8;
          color: #C47A00;
        }

        .commission-card {
          display: grid;
          gap: 12px;
        }

        .commission-card p {
          display: flex;
          justify-content: space-between;
          margin: 0;
          color: #7777B7;
          font-weight: 400;
        }

        .commission-card strong {
          color: #07074E;
        }

        .review-summary {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .review-tabs {
          display: flex;
          gap: 4px;
          overflow-x: auto;
          overflow-y: hidden;
          border-bottom: 1px solid #E9EBFF;
          scrollbar-width: thin;
        }
        .review-tabs::-webkit-scrollbar { height: 4px; }
        .review-tabs::-webkit-scrollbar-thumb { background: #D8DBFF; border-radius: 4px; }
        .review-tabs button {
          flex: 0 0 auto;
          border: 0;
          background: transparent;
          padding: 10px 14px;
          font-size: 0.9rem;
          font-weight: 600;
          color: #9F9FD1;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          margin-bottom: -1px;
          white-space: nowrap;
          transition: color 0.15s ease, border-color 0.15s ease;
        }
        .review-tabs button:hover { color: #5B6BFF; }
        .review-tabs button.on {
          color: #07074E;
          border-bottom-color: #4F46E5;
        }

        .summary-box {
          border: 1px solid #E9EBFF;
          border-radius: 16px;
          overflow: hidden;
        }

        .summary-box h3 {
          margin: 0;
          padding: 14px 16px;
          background: #F8F9FF;
          color: #07074E;
        }

        .summary-box div {
          display: grid;
          grid-template-columns: 150px minmax(0, 1fr);
          gap: 16px;
          padding: 12px 16px;
          border-top: 1px solid #EEF0FF;
        }

        .summary-box span {
          color: #9F9FD1;
          font-weight: 400;
        }

        .summary-box strong {
          min-width: 0;
          word-break: break-word;
          overflow-wrap: anywhere;
        }

        .summary-box strong {
          color: #07074E;
          font-weight: 400;
        }

        .pab-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          margin: auto -36px -34px;
          padding: 22px 36px;
          border-top: 1px solid #EEF0FF;
          background: white;
          border-radius: 0 0 22px 22px;
        }

        .pab-footer-actions {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .btn-primary,
        .btn-secondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          min-height: 44px;
          padding: 0 22px;
          border: 0;
          border-radius: 11px;
          font-weight: 400;
          cursor: pointer;
        }

        .btn-primary {
          background: #07074e;
          color: white;
          box-shadow: 0 12px 22px rgba(7, 7, 78, 0.24);
        }

        .btn-secondary {
          border: 1px solid #E2E4F0;
          background: white;
          color: #7777B7;
        }

        .brief-rail {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .rail-card {
          background: white;
          border: 1px solid #E9EBFF;
          border-radius: 22px;
          padding: 24px;
          box-shadow: 0 18px 40px rgba(7, 7, 78, 0.05);
        }

        .rail-card h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0 0 16px;
          color: #07074e;
          font-size: 13px;
          text-transform: uppercase;
        }

        .brief-progress-ring {
          display: grid;
          place-items: center;
          gap: 4px;
          min-height: 130px;
          border-radius: 20px;
          background: #F3F3FF;
          text-align: center;
        }

        .brief-progress-ring strong {
          font-size: 30px;
          color: #07074E;
        }

        .brief-progress-ring span,
        .preview-type {
          color: #9F9FD1;
          font-weight: 400;
        }

        .tip-card {
          background: linear-gradient(135deg, rgba(7, 7, 78, 0.12), rgba(159, 159, 209, 0.11));
        }

        .tip-head {
          display: flex;
          gap: 12px;
        }

        .tip-head span {
          display: grid;
          place-items: center;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: rgba(7, 7, 78, 0.16);
          color: #07074e;
        }

        .tip-head h3 {
          color: #07074E;
          text-transform: none;
          margin: 4px 0 0;
        }

        .tip-card p {
          color: #7777B7;
          font-weight: 400;
          line-height: 1.55;
        }

        .summary-items {
          display: grid;
          gap: 12px;
        }

        .summary-item {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          color: #9F9FD1;
          font-weight: 400;
        }

        .summary-item strong {
          color: #07074E;
        }

        .brief-modal-backdrop {
          position: fixed;
          inset: 0;
          z-index: 5000;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(15, 18, 40, 0.45);
          backdrop-filter: blur(3px);
          -webkit-backdrop-filter: blur(3px);
        }

        .brief-modal {
          max-width: 520px;
          width: 100%;
          padding: 28px;
          border-radius: 22px;
          background: white;
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.35);
          transform: translateY(48px);
        }

        .brief-modal h3 {
          margin: 0 0 10px;
          color: #07074E;
          font-size: 24px;
        }

        .brief-modal p {
          color: #7777B7;
          font-weight: 400;
          line-height: 1.55;
        }
        .brief-modal .brief-hold-callout {
          background: #eef0ff;
          border: 1px solid #d7dbff;
          border-left: 4px solid #4452f0;
          border-radius: 12px;
          padding: 12px 14px;
          color: #23236a;
        }
        .brief-modal .brief-hold-callout strong { color: #07074e; }

        .brief-modal div {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 22px;
        }

        @media (max-width: 1100px) {
          .brief-body,
          .form-row {
            grid-template-columns: 1fr;
          }
        }

        .pab-back-row {
          display: flex;
          margin-bottom: 14px;
          grid-column: 1 / -1;
        }

        .pab-mobile-step-row,
        .pab-mobile-back,
        .pab-mobile-step-count { display: none; }

        @media (max-width: 640px) {
          /* On phones the builder is an edge-to-edge page, not a card within a page. */
          .brief-builder-page {
            display: block;
            width: calc(100% + 28px);
            max-width: none;
            margin: 0 -14px -40px;
            overflow-x: hidden;
            background: #fff;
          }

          .pab-back-row {
            display: none;
          }

          /* The compact counter replaces the large purple step strip on mobile. */
          .brief-stepper { display: none; }

          .brief-body { display: block; }

          .brief-panel {
            min-height: calc(100dvh - 70px);
            padding: 12px 26px 28px;
            border: 0;
            border-radius: 0;
            box-shadow: none;
          }

          .pab-mobile-step-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            min-height: 44px;
            margin-bottom: 12px;
          }

          .pab-mobile-back {
            display: grid;
            flex: none;
            place-items: center;
            width: 42px;
            height: 42px;
            padding: 0;
            border: 1px solid #e2e4f5;
            border-radius: 50%;
            background: #fff;
            color: #07074e;
            box-shadow: 0 3px 10px rgba(7, 7, 78, 0.08);
            cursor: pointer;
          }

          .pab-mobile-step-count {
            display: grid;
            flex: none;
            place-items: center;
            width: 42px;
            height: 42px;
            padding: 0;
            border: 2px solid #786fff;
            border-radius: 50%;
            background: #4f46e5;
            color: #fff;
            font-size: 13px;
            font-weight: 800;
            box-shadow: 0 0 0 4px #eeecff;
          }

          .pab-progress { display: none; }
          .pab-footer { justify-content: flex-end; }

          .brief-panel .pab-tabs-row {
            grid-template-columns: .65fr 1.2fr 1.35fr;
            column-gap: 3px;
          }

          .brief-panel .pab-tabs-row .pab-tab {
            min-width: 0;
            padding: 11px 0;
            font-size: 10.5px;
            letter-spacing: -0.15px;
            white-space: nowrap;
          }
        }
      `}</style>
    </div>
  );
});

export default PostABrief;

function Summary({ title, rows }) {
  return (
    <section className="summary-box">
      <h3>{title}</h3>
      {rows.map(([label, value]) => (
        <div key={`${title}-${label}`}>
          <span>{label}</span>
          <strong>{value || '-'}</strong>
        </div>
      ))}
    </section>
  );
}
