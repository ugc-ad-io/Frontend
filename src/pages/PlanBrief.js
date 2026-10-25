import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import BriefOverlay from '../components/BriefOverlay';
import { uploadMedia } from '../utils/upload';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { payWithRazorpay, isPaymentCancelled } from '../utils/razorpay';
import { X, Check, Info, Plus, Minus, UploadCloud, FileText, ChevronDown, Wallet } from 'lucide-react';
import '../styles/brand-ui-privbrief.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const DURATIONS = ['15 Sec', '30 Sec', '45 Sec', '60 Sec', '90 Sec'];
const LANGUAGES = ['Hinglish', 'Hindi', 'English', 'Tamil', 'Telugu', 'Marathi', 'Bengali'];
const ORIENTATIONS = ['Portrait', 'Landscape', 'Square'];
const BACKGROUNDS = ['Green Screen', 'Home', 'Studio', 'Outdoor', 'Office', 'Plain Wall'];
const PRODUCTS = ['Yes', 'No'];
const SLOTS = ['11:00 - 17:00', '17:00 - 23:00'];
// Same canonical list as PostABrief's Usage Rights > Platforms chips - both forms
// feed the same `usage_platforms` backend field, so they should share one vocabulary.
const PLATFORM_OPTIONS = [
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
  'Third-party aggregators / marketplaces',
];

// Derive the campaign fields the review flow needs from the plan's video specs, so the
// brand doesn't re-enter them. Mirrors PostABrief's proven payload shape.
const ASPECT_BY_ORIENTATION = { Portrait: '9:16', Landscape: '16:9', Square: '1:1' };
const durationToSeconds = (d) => parseInt(String(d).replace(/\D/g, ''), 10) || 30;
const CTA_OPTIONS = ['None', 'Visit website', 'Use code', 'Follow brand', 'Swipe up'];
// CTAs that need a value the brand types (website link, promo code, handle, swipe-up link).
const CTA_INPUT = {
  'Visit website': { label: 'Website link', ph: 'https://yourbrand.com' },
  'Use code': { label: 'Promo code', ph: 'SUMMER20' },
  'Follow brand': { label: 'Brand handle to follow', ph: '@yourbrand' },
  'Swipe up': { label: 'Swipe-up link', ph: 'https://yourbrand.com/offer' },
};
const RIGHTS_OPTIONS = ['Organic social', '30 days paid', '90 days paid', '6 months', '1 year', 'Perpetual'];
const REVISION_OPTIONS = ['0', '1', '2', '3', '4', '5'];

// Delivery date: Today, Tomorrow, or a custom date the brand picks. Dates are
// computed live (never hardcoded).
const isoDay = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const dayAfter = (n) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
const prettyDay = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const buildDateOptions = () => ([
  { key: isoDay(dayAfter(0)), label: 'Today', sub: prettyDay(dayAfter(0)) },
  { key: isoDay(dayAfter(1)), label: 'Tomorrow', sub: prettyDay(dayAfter(1)) },
  { key: 'custom', label: 'Custom', sub: 'Pick a date' },
]);

// Private briefs have no GST. The brand pays the creator's price + the platform
// fee (the commission the backend adds on top when funding). This is the
// fallback if the live rate can't be fetched - the real one comes from the API.
const DEFAULT_PLATFORM_FEE_PERCENT = 20;

const newVideo = () => ({
  name: '',
  duration: '30 Sec',
  language: 'Hinglish',
  orientation: 'Portrait',
  background: 'Green Screen',
  product: '',
  guidelinesOpen: false,
  pronunciation: '',
  files: [],
  links: '',
  notes: '',
});

function Field({ label, children, hint }) {
  return (
    <label className="bui-pv-field">
      <span className="bui-pv-field-lbl">
        {label}
        {hint && <em className="bui-pv-field-hint">{hint}</em>}
      </span>
      {children}
    </label>
  );
}

// options: plain strings, or [value, label] pairs when the shown text differs from the stored value.
function Select({ value, onChange, options, placeholder }) {
  return (
    <div className="bui-pv-sel">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => { const [val, lbl] = Array.isArray(o) ? o : [o, o]; return <option key={val} value={val}>{lbl}</option>; })}
      </select>
      <ChevronDown size={16} />
    </div>
  );
}

// Dropdown checklist for picking multiple platforms. Stores a real array - some
// option labels contain literal commas ("Out-of-home (billboards, print)"), so a
// comma-joined string can't round-trip through split(',') without corrupting them.
function PlatformSelect({ value, onChange, options, placeholder }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = value || [];
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  const toggle = (opt) => {
    onChange(selected.includes(opt) ? selected.filter((p) => p !== opt) : [...selected, opt]);
  };
  return (
    <div className="bui-pv-msel" ref={ref}>
      <button type="button" className={`bui-pv-msel-btn${open ? ' is-open' : ''}`} onClick={() => setOpen((v) => !v)}>
        <span className={selected.length ? '' : 'bui-pv-msel-ph'}>{selected.length ? selected.join(', ') : (placeholder || 'Select')}</span>
        <ChevronDown size={16} />
      </button>
      {open && (
        <div className="bui-pv-msel-menu" role="listbox">
          {options.map((o) => {
            const on = selected.includes(o);
            return (
              <button key={o} type="button" role="option" aria-selected={on}
                className={`bui-pv-msel-opt${on ? ' is-on' : ''}`} onClick={() => toggle(o)}>
                <span className="bui-pv-msel-box">{on && <Check size={12} />}</span>
                {o}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PlanBrief({ creatorId, creatorName = 'Creator', onClose, onPublished }) {
  const navigate = useNavigate();
  const [moreOpen, setMoreOpen] = useState(false); // optional "Content rules & brand guidelines"
  const [photo, setPhoto] = useState('');
  const [productType, setProductType] = useState('physical');
  const [deliveryType, setDeliveryType] = useState('raw');
  const [editedBy, setEditedBy] = useState('creator');
  const [scriptProvider, setScriptProvider] = useState('brand');
  const [scriptText, setScriptText] = useState('');
  const [targeting, setTargeting] = useState({ level: 'Any', quality: 'A', gender: 'No Preference', city: '' });
  const [basePlan, setPlan] = useState(null); // the creator's single plan, fetched from their profile
  const plan = basePlan && { ...basePlan, price: basePlan.price + (deliveryType !== 'raw' && editedBy === 'creator' ? basePlan.editingPrice || 0 : 0) };
  const [planLoading, setPlanLoading] = useState(true);
  const [dateChoice, setDateChoice] = useState(isoDay(dayAfter(0)));   // Today by default
  const [customDate, setCustomDate] = useState(isoDay(dayAfter(2)));   // used when "Custom" is picked
  const [slot, setSlot] = useState(SLOTS[1]);
  const [videoCount, setVideoCount] = useState(1);
  const [videos, setVideos] = useState([newVideo()]);
  const [activeVideo, setActiveVideo] = useState(0);
  // Brief basics - REQUIRED so the brief can go through the same admin-review flow as
  // Post a Campaign (the campaign validator needs product/description/hook/message).
  const [brief, setBrief] = useState({
    // Basics
    productName: '', productDescription: '', hook: '', keyMessage: '', targetAudience: '',
    // Must-include
    productVisibleSecs: '', cta: 'None', ctaValue: '', hashtags: '', brandTag: true,
    // Must-avoid
    noCompetitors: false, competitors: '', noOtherProducts: false, noProfanity: true, avoidText: '',
    // Usage rights + timeline
    platforms: [], rightsDuration: 'Organic social', exclusivity: false, revisions: '1',
  });
  const setBriefField = (k) => (e) => setBrief((b) => ({ ...b, [k]: e.target.value }));
  const setBriefVal = (k, val) => setBrief((b) => ({ ...b, [k]: val }));
  const toggleBrief = (k) => setBrief((b) => ({ ...b, [k]: !b[k] }));
  const briefComplete = brief.productName.trim().length > 0
    && brief.productDescription.trim().length >= 10
    && brief.hook.trim().length > 0
    && brief.keyMessage.trim().length > 0;
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [resolvedName, setResolvedName] = useState('');   // brand-facing handle from the profile
  // Live platform-fee % (Admin → Settings → Commission rate). Fetched so the
  // quote always matches what the backend actually charges.
  const [feePercent, setFeePercent] = useState(DEFAULT_PLATFORM_FEE_PERCENT);
  // Prepaid credits the brand can spend. Checkout debits this, so it has to be the
  // real balance - it used to be hardcoded to 0 on screen.
  const [wallet, setWallet] = useState(null);
  const [shortfall, setShortfall] = useState(0);

  // Inline top-up - a short balance shouldn't force the brand out of the booking
  // flow (navigating to the Wallet page unmounts this modal and loses the brief).
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupAmount, setTopupAmount] = useState('');
  const [recharging, setRecharging] = useState(false);
  const [minTopup, setMinTopup] = useState(0); // server's minimum recharge, if it sends one

  useEffect(() => {
    let active = true;
    axios.get(`${API}/business/settings/billing`)
      .then((res) => {
        const rate = Number(res.data?.commission_rate);
        if (active && Number.isFinite(rate) && rate > 0) setFeePercent(rate);
      })
      .catch(() => { /* keep the default */ });
    axios.get(`${API}/business/wallet`)
      .then((res) => {
        if (!active) return;
        setWallet(Number(res.data?.available_balance) || 0);
        setMinTopup(Number(res.data?.minimum_chat_balance) || 0);
      })
      .catch(() => { if (active) setWallet(0); });
    return () => { active = false; };
  }, []);

  // Fetch the creator's plan (price set during their signup → profile.rate_card).
  useEffect(() => {
    let active = true;
    setPlanLoading(true);
    axios.get(`${API}/profile/${creatorId}`)
      .then((res) => {
        if (!active) return;
        // Brands see the creator's name (no @username handle).
        const d = res.data || {};
        const handle = String(d.nickname || d.full_name || d.public_creator_id || '').trim().replace(/^@/, '');
        if (handle) setResolvedName(handle);
        const pic = d.profile_photo || d.profile_picture || d.profile?.profile_photo || d.profile?.profile_picture;
        if (pic) setPhoto(/^https?:\/\//i.test(pic) ? pic : `${BACKEND_URL}/${String(pic).replace(/^\//, '')}`);
        const p = res.data?.profile || {};
        const rc = p.rate_card || {};
        // Prefer the flat rate_card; fall back to the cheapest portfolio-card price -
        // web-onboarded creators only have per-card prices, no rate_card (matches the
        // backend creator_plan_price fallback).
        const digits = (v) => parseInt(String(v ?? '').replace(/[^0-9]/g, ''), 10) || 0;
        let price = digits(rc.raw_payout || rc.expected_payout || rc.last_salary);
        if (!price) {
          const cards = res.data?.portfolio || p.portfolio_items || p.portfolio || [];
          const cardPrices = (Array.isArray(cards) ? cards : [])
            .map((c) => digits(c?.price || c?.price_per_video))
            .filter((n) => n > 0);
          if (cardPrices.length) price = Math.min(...cardPrices);
        }
        const humanize = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const tags = Array.isArray(p.tags) && p.tags.length
          ? p.tags.slice(0, 3).join(', ')
          : (humanize(p.niche) || humanize(p.category) || 'UGC Content');
        setPlan({
          id: 'creator-plan',
          // The creator's own category is deliberately NOT used here. It used to
          // become the plan name ("Fashion Content") and that name was appended to
          // the brief's title, so every private brief ended up carrying the
          // creator's niche instead of the brand's own product name.
          name: p.plan_name || 'Creator Plan',
          price,
          editingPrice: digits(rc.editing_payout) || 0,
          tags,
        });
      })
      .catch(() => { if (active) setPlan({ id: 'creator-plan', name: 'Creator Plan', price: 0, tags: 'UGC Content' }); })
      .finally(() => { if (active) setPlanLoading(false); });
    return () => { active = false; };
  }, [creatorId]);

  const dateOptions = useMemo(() => buildDateOptions(), []);
  const selectedDate = dateOptions.find((o) => o.key === dateChoice) || dateOptions[0];
  // The actual date sent to the backend - the custom pick when "Custom" is selected.
  const deliveryDate = dateChoice === 'custom' ? customDate : dateChoice;
  const dateLabel = dateChoice === 'custom'
    ? (customDate ? prettyDay(new Date(`${customDate}T00:00:00`)) : 'Pick a date')
    : `${selectedDate.label}, ${selectedDate.sub}`;
  // Brands see the creator's handle, never their real name.
  const displayName = (creatorName && creatorName !== 'Creator') ? creatorName : (resolvedName || 'Creator');
  const avatarInitial = (String(displayName).replace(/^@/, '') || 'C').charAt(0).toUpperCase();

  // A private brief carries no GST - the brand pays the creator's price plus the
  // platform fee. This is the same commission the backend adds on top when the
  // deal is funded, so this quote matches what's actually debited from the wallet.
  const subtotal = (plan?.price || 0) * videoCount;
  const platformFee = Math.round(subtotal * (feePercent / 100) * 100) / 100;
  const total = Math.round((subtotal + platformFee) * 100) / 100;
  // The creator never published a rate (profile shows "On Request"). Booking at
  // ₹0 would create a worthless deal, so block it and point the brand to chat.
  const priceMissing = !planLoading && !((plan?.price || 0) > 0);
  const inr = (n) => `₹${Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const videoName = (v, i) => (v.name && v.name.trim()) || `Video ${i + 1}`;
  // Only judge the balance once we've actually loaded it - `null` means "unknown",
  // and warning "you're short" while the fetch is in flight would be a lie.
  const insufficient = wallet !== null && total > 0 && wallet < total;
  // How much they're actually short. Trust the server's figure when it gave us one.
  const gap = Math.max(shortfall, total - (wallet || 0), 0);

  // Suggested top-up: cover the gap, rounded up to a clean ₹500, but never below
  // the server's minimum recharge (else the request would just bounce).
  const suggestedTopup = Math.max(Math.ceil(gap / 500) * 500, minTopup, 500);

  const openTopup = () => {
    setTopupAmount(String(suggestedTopup));
    setTopupOpen(true);
  };

  // Creates the payment order and re-reads the balance. When the balance clears the
  // total, the footer flips back to "Pay …" on its own - the brief is never lost.
  const doTopup = async () => {
    const amount = Number(topupAmount);
    if (!amount || amount <= 0) return toast.error('Enter an amount to add');
    if (minTopup && amount < minTopup) return toast.error(`Minimum recharge is ${inr(minTopup)}`);
    setRecharging(true);
    try {
      const { data: order } = await axios.post(`${API}/business/wallet/recharge`, { amount, gateway: 'razorpay' });
      const result = await payWithRazorpay(order, { description: `Wallet recharge - ${inr(order?.amount || amount)}` });
      toast.success(result?.message || 'Payment successful - wallet credited.');
      const w = await axios.get(`${API}/business/wallet`);
      const bal = Number(w.data?.available_balance) || 0;
      setWallet(bal);
      setShortfall(Math.max(total - bal, 0));
      if (bal >= total) {
        setTopupOpen(false);
        toast.success('Credits added - you can complete the booking now.');
      }
    } catch (e) {
      if (isPaymentCancelled(e)) toast.message('Payment cancelled.');
      else toast.error(apiErrorMessage(e, 'Wallet recharge failed'));
    } finally {
      setRecharging(false);
    }
  };

  const setCount = (next) => {
    const n = Math.max(1, Math.min(10, next));
    setVideoCount(n);
    setVideos((cur) => {
      const arr = [...cur];
      while (arr.length < n) arr.push(newVideo());
      arr.length = n;
      return arr;
    });
    if (activeVideo >= n) setActiveVideo(n - 1);
  };

  const updateVideo = (patch) => {
    setVideos((cur) => {
      const arr = cur.map((v, i) => (i === activeVideo ? { ...v, ...patch } : v));
      return arr;
    });
  };

  const renameVideo = (i) => {
    const next = window.prompt('Rename this video', videoName(videos[i], i));
    if (next === null) return;
    setVideos((cur) => cur.map((v, idx) => (idx === i ? { ...v, name: next.slice(0, 40) } : v)));
  };

  const deleteVideo = (i) => {
    if (videoCount <= 1) { toast.error('At least one video is required'); return; }
    setVideos((cur) => cur.filter((_, idx) => idx !== i));
    setVideoCount((c) => c - 1);
    setActiveVideo(0);
  };

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = [];
      for (const file of files) {
        const data = await uploadMedia(file, API);
        urls.push({ name: file.name, url: data.file_url });
      }
      updateVideo({ files: [...(videos[activeVideo].files || []), ...urls] });
      toast.success('Files uploaded');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Upload failed'));
    } finally {
      setUploading(false);
    }
  };

  const composeBrief = () => {
    const lines = [];
    lines.push(`Plan: ₹${plan?.price}/video - ${plan?.tags}`);
    lines.push(`Videos: ${videoCount}`);
    lines.push(`Delivery: ${dateLabel}, ${slot}`);
    videos.forEach((v, i) => {
      lines.push('');
      lines.push(`- Video ${i + 1} -`);
      lines.push(`Duration: ${v.duration} | Language: ${v.language} | Orientation: ${v.orientation} | Background: ${v.background}`);
      if (v.product) lines.push(`Features a product: ${v.product}`);
      if (v.pronunciation) lines.push(`Brand name pronunciation: ${v.pronunciation}`);
      if ((v.files || []).length) lines.push(`Brand files: ${v.files.map((f) => f.url).join(', ')}`);
      if (v.links) lines.push(`Links: ${v.links}`);
      if (v.notes) lines.push(`Notes: ${v.notes}`);
    });
    return lines.join('\n');
  };

  // Booking the creator SPENDS the brand's wallet credits - the money leaves the
  // wallet and is held in the deal's escrow until they approve the content. The
  // server re-prices the brief from the creator's rate card and its own commission
  // setting, so no amount is sent from here; the figures on screen are a quote.
  const proceed = async () => {
    if (!briefComplete) {
      toast.error('Add the product, a short description, the hook and the key message first.');
      return;
    }
    setSubmitting(true);
    try {
      // SAME AS POST A CAMPAIGN: create the brief as a campaign that goes to ADMIN REVIEW
      // (status pending_approval). The backend holds the budget on the wallet and releases
      // it to the creator when the deal completes - no charge/pay step here. selected_creator
      // ties it to this specific creator. Enum fields mirror PostABrief's proven payload.
      const v0 = videos[0] || newVideo();
      const aspect = ASPECT_BY_ORIENTATION[v0.orientation] || '9:16';
      const hasProduct = productType === 'physical';
      // Just the product. Appending the plan name put the creator's category in the
      // title of every private brief (see the plan fetch above).
      const title = brief.productName.trim() || 'Private brief';
      await axios.post(`${API}/campaigns`, {
        title,
        status: 'pending_approval',
        selected_creator: creatorId,
        // Sent to ONE creator. The backend keeps a private brief out of the public
        // browse list even after an admin approves it and it turns active, and 404s a
        // direct fetch by any other creator - so it surfaces only in this creator's
        // messages and deals. See PRIVATE_VISIBILITY in server.py.
        visibility: 'private',
        product_name: brief.productName.trim(),
        product_type: productType,
        product_type_detail: productType === 'other' ? (brief.customProductType || '').trim() : '',
        category: 'Other',
        product_category: 'Other',
        product_description: brief.productDescription.trim(),
        campaign_hook: brief.hook.trim(),
        key_message: brief.keyMessage.trim(),
        brief_text: composeBrief(),
        video_format: 'Reel',
        aspect_ratio: aspect,
        duration_seconds: durationToSeconds(v0.duration),
        creator_level: targeting.level,
        content_quality_tier: targeting.quality,
        gender_preference: targeting.gender,
        city_filter: targeting.city.trim(),
        script_provider: scriptProvider,
        script_text: scriptProvider === 'brand' ? scriptText.trim() : '',
        deliverable_items: [{ type: 'Reel', quantity: videoCount, duration: v0.duration, aspect_ratios: [aspect], raw_required: deliveryType !== 'edited', edited_required: deliveryType !== 'raw', edited_by: editedBy }],
        budget_min: plan?.price || 0,
        budget_max: plan?.price || 0,
        per_video_budget: plan?.price || 0,
        editing_fee_per_video: deliveryType !== 'raw' && editedBy === 'creator' ? basePlan?.editingPrice || 0 : 0,
        raw_payout_per_video: basePlan?.price || 0,
        // Basics
        target_audience: brief.targetAudience.trim(),
        // Must-include
        product_visible: !!Number(brief.productVisibleSecs),
        product_visible_seconds: Number(brief.productVisibleSecs) || 0,
        call_to_action: brief.cta,
        cta_link: (CTA_INPUT[brief.cta] ? brief.ctaValue.trim() : ''),
        hashtags: brief.hashtags.trim(),
        brand_handle_tag: brief.brandTag,
        // Must-avoid
        no_competitors: brief.noCompetitors,
        competitors_text: brief.competitors.trim(),
        no_other_products: brief.noOtherProducts,
        no_profanity: brief.noProfanity,
        avoid_text: brief.avoidText.trim(),
        // Usage rights + timeline
        usage_platforms: brief.platforms,
        rights_duration: brief.rightsDuration,
        exclusivity: brief.exclusivity,
        revision_limit: Number(brief.revisions) || 0,
        free_revisions: Number(brief.revisions) || 0,
        requires_shipment: hasProduct,
        shipment_option: hasProduct ? 'yes' : 'no',
        due_date: deliveryDate,
        deadline: deliveryDate,
        delivery_slot: slot,
      });
      // Nothing reaches the creator yet. The Private Invitation card they accept or
      // decline on is written by the BACKEND when an ADMIN APPROVES this brief
      // (deliver_private_invitation in server.py) - not on publish, and not from here.
      // Not from here because publishing holds the budget on the wallet and POST
      // /chat/action-cards refuses a brand whose balance is under
      // MIN_BRAND_CHAT_BALANCE, which is exactly where the balance sits the instant
      // after a publish. Not on publish because the card IS the accept button: sending
      // it at submit time let a creator start a deal on a brief no admin had cleared.
      toast.success('Brief sent for review - once our team approves it, it goes to the creator to accept. Funds are held on your wallet and released to the creator when the deal completes.');
      if (onPublished) onPublished();
    } catch (e) {
      // Wallet too short to hold the budget → open the inline top-up sheet (no pay screen
      // to fall back to). The campaign publish holds the budget the moment it's submitted.
      if (e?.response?.status === 402) {
        const d = e.response.data || {};
        setWallet(Number(d.available) || 0);
        setShortfall(Number(d.shortfall) || 0);
        toast.error(d.detail || 'Not enough credits to hold this brief.');
        setTopupOpen(true);
      } else {
        toast.error(apiErrorMessage(e, 'Could not send the brief for review'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const v = videos[activeVideo] || newVideo();
  const firstName = String(displayName).replace(/^@/, '').trim().split(/\s+/)[0] || 'Creator';
  const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  // Cost breakdown for the escrow card. `plan.price` already folds the creator's own editing
  // fee in (see above), so the editing line is just the difference to the base rate.
  const basePrice = basePlan?.price || 0;
  const editingFee = basePlan?.editingPrice || 0;
  const editingTotal = Math.max(subtotal - basePrice * videoCount, 0);
  const DELIVERY = [
    { key: 'raw', label: 'Raw video only', sub: `${firstName} films, you edit` },
    { key: 'creator', label: `Edited by ${firstName}`, sub: editingFee ? `+${money(editingFee)} per video` : 'Edited by the creator' },
    { key: 'ugc', label: 'Edited by UGC.ad', sub: 'Raw footage is approved, then our editors cut it' },
  ];
  const deliveryPick = deliveryType === 'raw' ? 'raw' : (editedBy === 'ugc' ? 'ugc' : 'creator');
  const pickDelivery = (key) => {
    if (key === 'raw') { setDeliveryType('raw'); return; }
    setEditedBy(key);
    if (deliveryType === 'raw') setDeliveryType('edited');
  };
  const sendLabel = submitting ? 'Sending…' : `Send brief to ${firstName}`;

  return (
    <BriefOverlay className="bui-pv-ov" onClick={onClose} role="dialog" aria-modal="true" aria-label="Private brief">
      <div className="bui-pv" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="bui-pv-x" aria-label="Close" onClick={onClose}><X size={18} /></button>

        <div className="bui-pv-scroll">
          <nav className="bui-pv-crumb" aria-label="Breadcrumb">
            <button type="button" onClick={onClose}>{firstName}</button>
            <span aria-hidden="true">/</span>
            <strong aria-current="page">Send a brief</strong>
          </nav>

          <div className="bui-pv-grid">
            <div className="bui-pv-col">
              <div className="bui-pv-who">
                <span className="bui-pv-ava">{photo ? <img src={photo} alt="" onError={() => setPhoto('')} /> : avatarInitial}</span>
                <div>
                  <h1 className="bui-pv-h1">Brief for {firstName}</h1>
                  <p className="bui-pv-sub">
                    {planLoading ? 'Loading price…' : (priceMissing
                      ? `Only ${firstName} sees this.`
                      : `Only ${firstName} sees this. Their price: ${money(basePrice)} per video${editingFee ? ` · +${money(editingFee)} if they edit` : ''}`)}
                  </p>
                </div>
              </div>

              {/* The creator hasn't published a rate - don't let a ₹0 brief go out. */}
              {priceMissing && (
                <p className="bui-pv-warn">
                  This creator hasn't set a price yet. Send them a message to agree on a rate before booking.
                </p>
              )}

              <section className="bui-pv-card">
                <h2>1 · How many videos?</h2>
                <div className="bui-pv-count">
                  <button type="button" className="bui-pv-step" aria-label="Fewer videos" onClick={() => setCount(videoCount - 1)} disabled={videoCount <= 1}><Minus size={16} /></button>
                  <span className="bui-pv-num" aria-live="polite">{videoCount}</span>
                  <button type="button" className="bui-pv-step" aria-label="More videos" onClick={() => setCount(videoCount + 1)} disabled={videoCount >= 10}><Plus size={16} /></button>
                  <span className="bui-pv-hint">1–10 videos</span>
                </div>
                {videoCount > 1 && (
                  <div className="bui-pv-vtabs" role="group" aria-label="Choose which video to set up">
                    {videos.map((_, i) => (
                      <button key={i} type="button" className={`bui-pv-vtab${i === activeVideo ? ' is-on' : ''}`} onClick={() => setActiveVideo(i)}>Video {i + 1}</button>
                    ))}
                  </div>
                )}
                <div className="bui-pv-g3">
                  <Field label="Length"><Select value={v.duration} onChange={(val) => updateVideo({ duration: val })} options={DURATIONS} /></Field>
                  <Field label="Shape"><Select value={v.orientation} onChange={(val) => updateVideo({ orientation: val })} options={ORIENTATIONS.map((o) => [o, `${o} ${ASPECT_BY_ORIENTATION[o]}`])} /></Field>
                  <Field label="Language"><Select value={v.language} onChange={(val) => updateVideo({ language: val })} options={LANGUAGES} /></Field>
                </div>
                <div className="bui-pv-g2">
                  <Field label="Background"><Select value={v.background} onChange={(val) => updateVideo({ background: val })} options={BACKGROUNDS} /></Field>
                  <Field label="Does it feature a product?"><Select value={v.product} onChange={(val) => updateVideo({ product: val })} options={PRODUCTS} placeholder="Select" /></Field>
                </div>
                {videoCount > 1 && <p className="bui-pv-hint">These settings are for Video {activeVideo + 1}. Pick another video above to set it up.</p>}
              </section>

              <section className="bui-pv-card">
                <h2>2 · What should {firstName} make?</h2>
                <div className="bui-pv-g2">
                  <Field label="Product / brand name *"><input type="text" value={brief.productName} onChange={setBriefField('productName')} placeholder="e.g. Nova Running Shoes" /></Field>
                  <Field label="Product type"><Select value={productType} onChange={setProductType} options={[['physical', 'Physical product - shipment required'], ['digital', 'Digital / App - no shipment'], ['service', 'Service - no shipment'], ['other', 'Other - no shipment']]} /></Field>
                </div>
                {productType === 'other' && <Field label="Describe the product type"><input value={brief.customProductType || ''} onChange={setBriefField('customProductType')} /></Field>}
                <Field label="What are you promoting? *" hint="min 10 characters"><textarea rows={2} value={brief.productDescription} onChange={setBriefField('productDescription')} placeholder="Describe the product/service in a line or two" /></Field>
                <div className="bui-pv-g2">
                  <Field label="Hook / main idea *"><input type="text" value={brief.hook} onChange={setBriefField('hook')} placeholder="The angle that grabs attention in the first 3s" /></Field>
                  <Field label="Key message *"><input type="text" value={brief.keyMessage} onChange={setBriefField('keyMessage')} placeholder="The one thing the viewer must take away" /></Field>
                </div>
              </section>

              <section className="bui-pv-card">
                <h2>3 · Delivery</h2>
                <div role="radiogroup" aria-label="Who edits the video" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {DELIVERY.map((d) => (
                    <button key={d.key} type="button" role="radio" aria-checked={deliveryPick === d.key}
                      className={`bui-pv-radio${deliveryPick === d.key ? ' is-on' : ''}`} onClick={() => pickDelivery(d.key)}>
                      <span className="bui-pv-dot" />
                      <span><b>{d.label}</b><small>{d.sub}</small></span>
                    </button>
                  ))}
                </div>
                {deliveryType !== 'raw' && (
                  <label className="bui-pv-check">
                    <input type="checkbox" checked={deliveryType === 'both'} onChange={(e) => setDeliveryType(e.target.checked ? 'both' : 'edited')} />
                    Also send me the raw footage
                  </label>
                )}
                <div className="bui-pv-g2">
                  <Field label="Deliver by">
                    <Select value={dateChoice} onChange={setDateChoice} options={dateOptions.map((o) => [o.key, `${o.label} · ${o.sub}`])} />
                  </Field>
                  <Field label="Delivery slot"><Select value={slot} onChange={setSlot} options={SLOTS} /></Field>
                  {dateChoice === 'custom' && (
                    <Field label="Pick a date">
                      <input type="date" className="bui-pv-date" value={customDate} min={isoDay(dayAfter(0))} onChange={(e) => setCustomDate(e.target.value)} />
                    </Field>
                  )}
                  <Field label="Usage rights"><Select value={brief.rightsDuration} onChange={(val) => setBriefVal('rightsDuration', val)} options={RIGHTS_OPTIONS} /></Field>
                </div>
              </section>

              <button type="button" className="bui-pv-opt" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)}>
                <span><strong>Content rules &amp; brand guidelines</strong><small>Must include, must avoid, CTA, hashtags, script, files — optional</small></span>
                <em>{moreOpen ? 'Hide' : 'Add +'}</em>
              </button>

              {moreOpen && (
                <section className="bui-pv-card bui-pv-more">
                  <h2>Script &amp; who you want</h2>
                  <div className="bui-pv-g2">
                    <Field label="Who writes the script?"><Select value={scriptProvider} onChange={setScriptProvider} options={[['brand', 'Brand'], ['ugc', 'UGC.ad']]} /></Field>
                    <Field label="Target audience"><input type="text" value={brief.targetAudience} onChange={setBriefField('targetAudience')} placeholder="Who is this for? (age, interests, region)" /></Field>
                  </div>
                  {scriptProvider === 'brand' && <Field label="Script"><textarea rows={3} value={scriptText} onChange={(e) => setScriptText(e.target.value)} placeholder="Script for the creator to follow" /></Field>}
                  <div className="bui-pv-g2">
                    <Field label="Creator level"><Select value={targeting.level} onChange={(val) => setTargeting((t) => ({ ...t, level: val }))} options={['Any', 'New', 'Verified', 'L1', 'L2', 'Elite']} /></Field>
                    <Field label="Content quality"><Select value={targeting.quality} onChange={(val) => setTargeting((t) => ({ ...t, quality: val }))} options={['A', 'A+', 'A++']} /></Field>
                    <Field label="Gender preference"><Select value={targeting.gender} onChange={(val) => setTargeting((t) => ({ ...t, gender: val }))} options={['No Preference', 'Female', 'Male', 'Other']} /></Field>
                    <Field label="Creator location"><input value={targeting.city} onChange={(e) => setTargeting((t) => ({ ...t, city: e.target.value }))} placeholder="City, or leave blank for any location" /></Field>
                  </div>

                  <div className="bui-pv-hr" />
                  <h2>Must include</h2>
                  <div className="bui-pv-g2">
                    <Field label="Product on screen (seconds)"><input type="number" min="0" value={brief.productVisibleSecs} onChange={setBriefField('productVisibleSecs')} placeholder="e.g. 5" /></Field>
                    <Field label="Call to action"><Select value={brief.cta} onChange={(val) => setBriefVal('cta', val)} options={CTA_OPTIONS} /></Field>
                    {CTA_INPUT[brief.cta] && (
                      <Field label={CTA_INPUT[brief.cta].label}>
                        <input type="text" value={brief.ctaValue} onChange={setBriefField('ctaValue')} placeholder={CTA_INPUT[brief.cta].ph} />
                      </Field>
                    )}
                    <Field label="Hashtags"><input type="text" value={brief.hashtags} onChange={setBriefField('hashtags')} placeholder="#brand #launch" /></Field>
                  </div>
                  <label className="bui-pv-check"><input type="checkbox" checked={brief.brandTag} onChange={() => toggleBrief('brandTag')} /> Tag the brand handle</label>

                  <div className="bui-pv-hr" />
                  <h2>Must avoid</h2>
                  <label className="bui-pv-check"><input type="checkbox" checked={brief.noCompetitors} onChange={() => toggleBrief('noCompetitors')} /> No competitor brands</label>
                  {brief.noCompetitors && <Field label="Competitors to avoid"><input type="text" value={brief.competitors} onChange={setBriefField('competitors')} placeholder="Brand A, Brand B" /></Field>}
                  <label className="bui-pv-check"><input type="checkbox" checked={brief.noOtherProducts} onChange={() => toggleBrief('noOtherProducts')} /> No other products on screen</label>
                  <label className="bui-pv-check"><input type="checkbox" checked={brief.noProfanity} onChange={() => toggleBrief('noProfanity')} /> No profanity</label>
                  <Field label="Anything else to avoid"><textarea rows={2} value={brief.avoidText} onChange={setBriefField('avoidText')} placeholder="Optional" /></Field>

                  <div className="bui-pv-hr" />
                  <h2>Usage &amp; revisions</h2>
                  <Field label="Platforms where content can be posted"><PlatformSelect value={brief.platforms} onChange={(val) => setBriefVal('platforms', val)} options={PLATFORM_OPTIONS} placeholder="Select platforms" /></Field>
                  <div className="bui-pv-g2">
                    <Field label="Revisions included"><Select value={String(brief.revisions)} onChange={(val) => setBriefVal('revisions', val)} options={REVISION_OPTIONS} /></Field>
                  </div>
                  <label className="bui-pv-check"><input type="checkbox" checked={brief.exclusivity} onChange={() => toggleBrief('exclusivity')} /> Exclusive (creator can’t post similar for competitors)</label>

                  <div className="bui-pv-hr" />
                  <h2>Brand guidelines{videoCount > 1 ? ` · Video ${activeVideo + 1}` : ''}</h2>
                  <label className="bui-pv-drop" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}>
                    <UploadCloud size={22} />
                    <b>Choose a file or drag &amp; drop here</b>
                    <small>JPEG, PNG, PDF, and MP4 formats, up to 500MB</small>
                    <span className="bui-pv-browse">{uploading ? 'Uploading…' : 'Browse'}</span>
                    <input type="file" multiple hidden accept="image/*,application/pdf,video/mp4" onChange={(e) => handleFiles(e.target.files)} />
                  </label>
                  {(v.files || []).length > 0 && (
                    <div className="bui-pv-files">
                      {v.files.map((f, i) => <span key={i} className="bui-pv-file"><FileText size={13} /> {f.name}</span>)}
                    </div>
                  )}
                  <Field label="Supporting links"><input type="text" value={v.links} onChange={(e) => updateVideo({ links: e.target.value })} placeholder="Paste reference / asset links" /></Field>
                  <Field label="Brand name pronunciation (optional)"><input type="text" value={v.pronunciation} onChange={(e) => updateVideo({ pronunciation: e.target.value })} placeholder="Type how the brand name is pronounced" /></Field>
                  <Field label="Additional instructions (optional)"><textarea value={v.notes} onChange={(e) => updateVideo({ notes: e.target.value })} rows={3} placeholder="Add notes and additional details to be noted of.." /></Field>
                </section>
              )}
            </div>

            <aside className="bui-pv-side" aria-label="Cost summary">
              <section className="bui-pv-esc">
                <div className="bui-pv-esc-top">
                  <small>Total · held in escrow</small>
                  <b>{planLoading ? '…' : money(total)}</b>
                </div>
                <div className="bui-pv-esc-body">
                  <div className="bui-pv-line"><span>{videoCount} video{videoCount > 1 ? 's' : ''} × {money(basePrice)}</span><strong>{money(basePrice * videoCount)}</strong></div>
                  <div className="bui-pv-line"><span>Editing</span><strong>{editingTotal ? money(editingTotal) : '—'}</strong></div>
                  <div className="bui-pv-line"><span>Platform fee {feePercent}%</span><strong>{money(platformFee)}</strong></div>
                  {wallet !== null && (insufficient ? (
                    <div className="bui-pv-wallet bui-pv-wallet--short" role="status">
                      <Info size={15} /> Wallet {money(wallet)} — you're {money(gap)} short
                    </div>
                  ) : (
                    <div className="bui-pv-wallet" role="status">
                      <Check size={15} /> Wallet {money(wallet)} — enough for this brief
                    </div>
                  ))}
                  {insufficient ? (
                    <button type="button" className="bui-pv-send bui-pv-send--funds" onClick={openTopup} disabled={submitting} title={`You're ${inr(gap)} short`}>
                      <Wallet size={16} /> Add funds
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="bui-pv-send"
                      onClick={proceed}
                      disabled={submitting || priceMissing || !(total > 0) || !briefComplete}
                      title={priceMissing ? "This creator hasn't set a price yet" : (!briefComplete ? 'Fill the product, description, hook and key message first' : undefined)}
                    >
                      {sendLabel}
                    </button>
                  )}
                  {!briefComplete && !priceMissing && <p className="bui-pv-fine">Add the product, a short description (10+ characters), the hook and the key message to send.</p>}
                  <p className="bui-pv-fine">Our team takes a quick look first, then {firstName} gets it to accept or decline. Funds are held on your wallet and released when the deal completes.</p>
                </div>
              </section>
            </aside>
          </div>
        </div>

        {/* Inline top-up sheet - keeps the brief alive while they add credits. */}
        {topupOpen && (
          <div className="bui-pv-topback" onClick={() => !recharging && setTopupOpen(false)}>
            <div className="bui-pv-top" role="dialog" aria-label="Add credits" onClick={(e) => e.stopPropagation()}>
              <div className="bui-pv-top-h">
                <h3><Wallet size={18} /> Add credits</h3>
                <button type="button" className="bui-pv-top-x" aria-label="Close" onClick={() => setTopupOpen(false)} disabled={recharging}><X size={16} /></button>
              </div>

              <div className="bui-pv-top-gap">
                <div><span>Order total</span><strong>{inr(total)}</strong></div>
                <div><span>Available credits</span><strong>{inr(wallet || 0)}</strong></div>
                <div className="short"><span>You&apos;re short</span><strong>{inr(gap)}</strong></div>
              </div>

              <label className="bui-pv-field">
                Amount to add
                <input
                  type="number"
                  min={minTopup || 1}
                  value={topupAmount}
                  autoFocus
                  onChange={(e) => setTopupAmount(e.target.value)}
                />
              </label>

              <div className="bui-pv-top-chips">
                {[suggestedTopup, suggestedTopup + 2000, suggestedTopup + 5000].map((amt) => (
                  <button key={amt} type="button" className={Number(topupAmount) === amt ? 'on' : ''} onClick={() => setTopupAmount(String(amt))}>
                    {inr(amt).replace('.00', '')}
                  </button>
                ))}
              </div>

              {minTopup > 0 && <p className="bui-pv-fine">Minimum recharge is {inr(minTopup)}.</p>}

              <button type="button" className="bui-pv-send" onClick={doTopup} disabled={recharging}>
                {recharging ? 'Creating payment order…' : `Add ${inr(Number(topupAmount) || 0)}`}
              </button>
              <button type="button" className="bui-pv-top-alt" onClick={() => navigate('/dashboard/business/wallet')} disabled={recharging}>
                Open full wallet instead
              </button>
            </div>
          </div>
        )}
      </div>
    </BriefOverlay>
  );
}
