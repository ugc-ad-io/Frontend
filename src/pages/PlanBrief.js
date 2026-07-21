import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { payWithRazorpay, isPaymentCancelled } from '../utils/razorpay';
import { X, Check, Info, Pencil, Plus, Minus, UploadCloud, Mic, FileText, Link2, ChevronDown, Trash2, Tag, Wallet } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const DURATIONS = ['15 Sec', '30 Sec', '45 Sec', '60 Sec', '90 Sec'];
const LANGUAGES = ['Hinglish', 'Hindi', 'English', 'Tamil', 'Telugu', 'Marathi', 'Bengali'];
const ORIENTATIONS = ['Portrait', 'Landscape', 'Square'];
const BACKGROUNDS = ['Green Screen', 'Home', 'Studio', 'Outdoor', 'Office', 'Plain Wall'];
const PRODUCTS = ['Yes', 'No'];
const LOGO_POSITIONS = ['No Preference', 'Top Left', 'Top Right', 'Bottom Left', 'Bottom Right', 'Center'];
const SLOTS = ['11:00 - 17:00', '17:00 - 23:00'];

// Derive the campaign fields the review flow needs from the plan's video specs, so the
// brand doesn't re-enter them. Mirrors PostABrief's proven payload shape.
const ASPECT_BY_ORIENTATION = { Portrait: '9:16', Landscape: '16:9', Square: '1:1' };
const durationToSeconds = (d) => parseInt(String(d).replace(/\D/g, ''), 10) || 30;
const CTA_OPTIONS = ['None', 'Visit website', 'Use code', 'Follow brand', 'Swipe up'];
const RIGHTS_OPTIONS = ['Organic social', '30 days paid', '90 days paid', '6 months', '1 year', 'Perpetual'];

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
// fallback if the live rate can't be fetched — the real one comes from the API.
const DEFAULT_PLATFORM_FEE_PERCENT = 20;

const newVideo = () => ({
  name: '',
  duration: '30 Sec',
  language: 'Hinglish',
  orientation: 'Portrait',
  background: 'Green Screen',
  product: '',
  guidelinesOpen: false,
  logoPosition: 'No Preference',
  pronunciation: '',
  files: [],
  links: '',
  notes: '',
});

function Field({ label, children }) {
  return (
    <label className="pb-field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Select({ value, onChange, options, placeholder }) {
  return (
    <div className="pb-select">
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={16} />
    </div>
  );
}

export default function PlanBrief({ creatorId, creatorName = 'Creator', onClose, onPublished }) {
  const navigate = useNavigate();
  const [stage, setStage] = useState('setup'); // 'setup' | 'payment'
  const [plan, setPlan] = useState(null); // the creator's single plan, fetched from their profile
  const [planLoading, setPlanLoading] = useState(true);
  const [dateChoice, setDateChoice] = useState(isoDay(dayAfter(0)));   // Today by default
  const [customDate, setCustomDate] = useState(isoDay(dayAfter(2)));   // used when "Custom" is picked
  const [slot, setSlot] = useState(SLOTS[1]);
  const [videoCount, setVideoCount] = useState(1);
  const [videos, setVideos] = useState([newVideo()]);
  const [activeVideo, setActiveVideo] = useState(0);
  // Brief basics — REQUIRED so the brief can go through the same admin-review flow as
  // Post a Campaign (the campaign validator needs product/description/hook/message).
  const [brief, setBrief] = useState({
    // Basics
    productName: '', productDescription: '', hook: '', keyMessage: '', targetAudience: '',
    // Must-include
    productVisibleSecs: '', cta: 'None', hashtags: '', brandTag: true,
    // Must-avoid
    noCompetitors: false, competitors: '', noOtherProducts: false, noProfanity: true, avoidText: '',
    // Usage rights + timeline
    platforms: '', rightsDuration: 'Organic social', exclusivity: false, revisions: '1',
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
  // real balance — it used to be hardcoded to 0 on screen.
  const [wallet, setWallet] = useState(null);
  const [shortfall, setShortfall] = useState(0);

  // Inline top-up — a short balance shouldn't force the brand out of the booking
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
        const p = res.data?.profile || {};
        const rc = p.rate_card || {};
        const price = parseInt(String(rc.expected_payout || rc.last_salary || '').replace(/[^0-9]/g, ''), 10) || 0;
        const humanize = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
        const tags = Array.isArray(p.tags) && p.tags.length
          ? p.tags.slice(0, 3).join(', ')
          : (humanize(p.niche) || humanize(p.category) || 'UGC Content');
        setPlan({
          id: 'creator-plan',
          name: p.plan_name || (p.category ? `${humanize(p.category)} Content` : 'Creator Plan'),
          price,
          tags,
        });
      })
      .catch(() => { if (active) setPlan({ id: 'creator-plan', name: 'Creator Plan', price: 0, tags: 'UGC Content' }); })
      .finally(() => { if (active) setPlanLoading(false); });
    return () => { active = false; };
  }, [creatorId]);

  const dateOptions = useMemo(() => buildDateOptions(), []);
  const selectedDate = dateOptions.find((o) => o.key === dateChoice) || dateOptions[0];
  // The actual date sent to the backend — the custom pick when "Custom" is selected.
  const deliveryDate = dateChoice === 'custom' ? customDate : dateChoice;
  const dateLabel = dateChoice === 'custom'
    ? (customDate ? prettyDay(new Date(`${customDate}T00:00:00`)) : 'Pick a date')
    : `${selectedDate.label}, ${selectedDate.sub}`;
  // Brands see the creator's handle, never their real name.
  const displayName = (creatorName && creatorName !== 'Creator') ? creatorName : (resolvedName || 'Creator');
  const avatarInitial = (String(displayName).replace(/^@/, '') || 'C').charAt(0).toUpperCase();

  // A private brief carries no GST — the brand pays the creator's price plus the
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
  // Only judge the balance once we've actually loaded it — `null` means "unknown",
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
  // total, the footer flips back to "Pay …" on its own — the brief is never lost.
  const doTopup = async () => {
    const amount = Number(topupAmount);
    if (!amount || amount <= 0) return toast.error('Enter an amount to add');
    if (minTopup && amount < minTopup) return toast.error(`Minimum recharge is ${inr(minTopup)}`);
    setRecharging(true);
    try {
      const { data: order } = await axios.post(`${API}/business/wallet/recharge`, { amount, gateway: 'razorpay' });
      const result = await payWithRazorpay(order, { description: `Wallet recharge — ${inr(order?.amount || amount)}` });
      toast.success(result?.message || 'Payment successful — wallet credited.');
      const w = await axios.get(`${API}/business/wallet`);
      const bal = Number(w.data?.available_balance) || 0;
      setWallet(bal);
      setShortfall(Math.max(total - bal, 0));
      if (bal >= total) {
        setTopupOpen(false);
        toast.success('Credits added — you can complete the booking now.');
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

  const modifyVideo = (i) => { setActiveVideo(i); setStage('setup'); };

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await axios.post(`${API}/upload/file`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        urls.push({ name: file.name, url: res.data.file_url });
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
    lines.push(`Plan: ${plan?.name} (₹${plan?.price}/video) — ${plan?.tags}`);
    lines.push(`Videos: ${videoCount}`);
    lines.push(`Delivery: ${dateLabel}, ${slot}`);
    videos.forEach((v, i) => {
      lines.push('');
      lines.push(`— Video ${i + 1} —`);
      lines.push(`Duration: ${v.duration} | Language: ${v.language} | Orientation: ${v.orientation} | Background: ${v.background}`);
      if (v.product) lines.push(`Features a product: ${v.product}`);
      if (v.logoPosition && v.logoPosition !== 'No Preference') lines.push(`Logo position: ${v.logoPosition}`);
      if (v.pronunciation) lines.push(`Brand name pronunciation: ${v.pronunciation}`);
      if ((v.files || []).length) lines.push(`Brand files: ${v.files.map((f) => f.url).join(', ')}`);
      if (v.links) lines.push(`Links: ${v.links}`);
      if (v.notes) lines.push(`Notes: ${v.notes}`);
    });
    return lines.join('\n');
  };

  // Booking the creator SPENDS the brand's wallet credits — the money leaves the
  // wallet and is held in the deal's escrow until they approve the content. The
  // server re-prices the brief from the creator's rate card and its own commission
  // setting, so no amount is sent from here; the figures on screen are a quote.
  const proceed = async () => {
    if (!briefComplete) {
      toast.error('Add the brief basics (product, description, hook, key message) first.');
      setStage('setup');
      return;
    }
    setSubmitting(true);
    try {
      // SAME AS POST A CAMPAIGN: create the brief as a campaign that goes to ADMIN REVIEW
      // (status pending_approval). The backend holds the budget on the wallet and releases
      // it to the creator when the deal completes — no charge/pay step here. selected_creator
      // ties it to this specific creator. Enum fields mirror PostABrief's proven payload.
      const v0 = videos[0] || newVideo();
      const aspect = ASPECT_BY_ORIENTATION[v0.orientation] || '9:16';
      const hasProduct = videos.some((vd) => vd.product === 'Yes');
      await axios.post(`${API}/campaigns`, {
        title: `${brief.productName.trim()} — ${plan?.name || 'Creator Plan'}`,
        status: 'pending_approval',
        selected_creator: creatorId,
        product_name: brief.productName.trim(),
        category: 'Other',
        product_category: 'Other',
        product_description: brief.productDescription.trim(),
        campaign_hook: brief.hook.trim(),
        key_message: brief.keyMessage.trim(),
        brief_text: composeBrief(),
        video_format: 'Reel',
        aspect_ratio: aspect,
        duration_seconds: durationToSeconds(v0.duration),
        creator_level: 'New',
        deliverable_items: [{ type: 'Reel', quantity: videoCount, duration: v0.duration, aspect_ratios: [aspect], raw_required: false }],
        budget_min: plan?.price || 0,
        budget_max: plan?.price || 0,
        per_video_budget: plan?.price || 0,
        // Basics
        target_audience: brief.targetAudience.trim(),
        // Must-include
        product_visible: !!Number(brief.productVisibleSecs),
        product_visible_seconds: Number(brief.productVisibleSecs) || 0,
        call_to_action: brief.cta,
        hashtags: brief.hashtags.trim(),
        brand_handle_tag: brief.brandTag,
        // Must-avoid
        no_competitors: brief.noCompetitors,
        competitors_text: brief.competitors.trim(),
        no_other_products: brief.noOtherProducts,
        no_profanity: brief.noProfanity,
        avoid_text: brief.avoidText.trim(),
        // Usage rights + timeline
        usage_platforms: brief.platforms.split(',').map((p) => p.trim()).filter(Boolean),
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
      toast.success('Brief sent for review — our team approves it shortly. Funds are held on your wallet and released to the creator when the deal completes.');
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

  // Condensed 5-tab wizard covering the Post-a-Campaign sections (Basics, Deliverables,
  // Must-Include/Avoid, Usage Rights, Guidelines) — each SHORT — then submit for admin
  // review. No Payment step: the brief books straight from wallet credits like a campaign.
  const STEP_LIST = [
    { key: 'setup', label: 'Plan & Videos' },
    { key: 'basics', label: 'Basics' },
    { key: 'rules', label: 'Content Rules' },
    { key: 'usage', label: 'Usage & Timeline' },
    { key: 'guidelines', label: 'Brand Guidelines' },
  ];
  const stepIdx = Math.max(0, STEP_LIST.findIndex((s) => s.key === stage));
  const isLastStep = stepIdx === STEP_LIST.length - 1;
  const goNext = () => setStage(STEP_LIST[Math.min(stepIdx + 1, STEP_LIST.length - 1)].key);
  const goBack = () => setStage(STEP_LIST[Math.max(stepIdx - 1, 0)].key);
  // Basics carries the review flow's required fields — can't move past it until filled.
  const nextBlocked = stage === 'basics' && !briefComplete;
  // Clicking a step in the stepper jumps to it. Going back is always fine; jumping PAST
  // Basics (index 1) needs the required fields, so it bounces to Basics with a nudge.
  const goToStep = (i) => {
    if (i > 1 && !briefComplete) { setStage('basics'); toast.error('Fill the brief basics first.'); return; }
    setStage(STEP_LIST[i].key);
  };

  // The money-holding action, shared by both possible last steps (setup when there are
  // no guidelines, otherwise the guidelines step). A short balance opens the inline
  // top-up sheet instead of a dead-end; otherwise it books + holds the funds.
  const holdMoneyBtn = insufficient ? (
    <button type="button" className="pb-proceed pb-addfunds" onClick={openTopup} disabled={submitting} title={`You're ${inr(gap)} short`}>
      <Wallet size={15} /> Add Funds
    </button>
  ) : (
    <button
      type="button"
      className="pb-proceed"
      onClick={proceed}
      disabled={submitting || priceMissing || !(total > 0) || !briefComplete}
      title={priceMissing ? "This creator hasn't set a price yet" : (!briefComplete ? 'Fill the brief basics first' : undefined)}
    >
      {submitting ? 'Sending…' : 'Send Brief for Review'}
    </button>
  );

  return (
    <div className="pb-overlay" onClick={onClose}>
      <div className="pb-modal" onClick={(e) => e.stopPropagation()}>
        {/* Left rail */}
        <aside className="pb-rail">
          <div className="pb-tabs">
            <button className="active" type="button">Plan</button>
          </div>

          <div className="pb-rail-body">
            {planLoading ? (
              <div className="pb-plan pb-plan-loading">Loading creator’s plan…</div>
            ) : (
              <div className="pb-plan is-selected">
                <div className="pb-plan-top">
                  <strong>{plan?.name || 'Creator Plan'}</strong>
                </div>
                <div className="pb-price">₹{(plan?.price || 0).toLocaleString('en-IN')} <small>/ video</small></div>
                <div className="pb-plan-tags">{plan?.tags}</div>
                <span className="pb-plan-check"><Check size={14} /></span>
              </div>
            )}

            <div className="pb-rail-section">
              <p className="pb-rail-label">Selected Creator</p>
              <div className="pb-creator"><span className="pb-creator-avatar">{avatarInitial}</span><strong>{displayName}</strong></div>
            </div>

            <div className="pb-rail-section">
              <p className="pb-rail-label">Date</p>
              <div className="pb-date-row">
                {dateOptions.map((o) => (
                  <button
                    type="button"
                    key={o.key}
                    className={dateChoice === o.key ? 'active' : ''}
                    onClick={() => setDateChoice(o.key)}
                  >
                    <span>{o.label}</span>
                    <small>{o.sub}</small>
                  </button>
                ))}
              </div>
              {dateChoice === 'custom' && (
                <input
                  type="date"
                  className="pb-date-input"
                  value={customDate}
                  min={isoDay(dayAfter(0))}
                  onChange={(e) => setCustomDate(e.target.value)}
                />
              )}
            </div>

            <div className="pb-rail-section">
              <p className="pb-rail-label">Delivery Slot</p>
              <Select value={slot} onChange={setSlot} options={SLOTS} />
            </div>
          </div>

          <div className="pb-rail-total">
            <span>Estimated total</span>
            <strong>₹{total.toLocaleString('en-IN')}</strong>
          </div>

          {/* The creator hasn't published a rate — don't let a ₹0 brief go out. */}
          {priceMissing && (
            <p className="pb-noprice">
              <Info size={13} /> This creator hasn't set a price yet. Send them a message to agree on a rate before booking.
            </p>
          )}
        </aside>

        {/* Right content */}
        <section className="pb-content">
          <button className="pb-close" aria-label="Close" onClick={onClose}><X size={18} /></button>

          {/* Progress stepper — reflects whether a Brand Guidelines step exists */}
          <div className="pb-stepper">
            {STEP_LIST.map((s, i) => (
              <button
                type="button"
                key={s.key}
                className={`pb-stepper-item ${i === stepIdx ? 'active' : ''} ${i > 1 && !briefComplete ? 'is-locked' : ''}`}
                onClick={() => goToStep(i)}
                title={i > 1 && !briefComplete ? 'Fill the brief basics first' : `Go to ${s.label}`}
              >
                <span className="pb-stepper-num">{i + 1}</span>
                <span className="pb-stepper-label">{s.label}</span>
              </button>
            ))}
          </div>

          {stage === 'setup' ? (
          <>
          <div className="pb-head">
            <h2>Choose your plan &amp; set up your videos</h2>
            <p>Start fast — select a plan and basic preferences so we can tailor your project instantly.</p>
          </div>

          <div className="pb-scroll">
            <div className="pb-counter-row">
              <span>How many <strong>videos</strong> do you need?</span>
              <div className="pb-counter">
                <button type="button" onClick={() => setCount(videoCount - 1)}><Minus size={16} /></button>
                <span>{videoCount}</span>
                <button type="button" onClick={() => setCount(videoCount + 1)}><Plus size={16} /></button>
              </div>
            </div>

            {videoCount > 1 && (
              <div className="pb-video-tabs">
                {videos.map((_, i) => (
                  <button key={i} type="button" className={i === activeVideo ? 'active' : ''} onClick={() => setActiveVideo(i)}>
                    Video {i + 1}
                  </button>
                ))}
              </div>
            )}

            <div className="pb-video-title"><Check size={16} className="pb-video-title-check" /> Video {activeVideo + 1} Details <Pencil size={14} /></div>

            <div className="pb-grid">
              <Field label="Duration"><Select value={v.duration} onChange={(val) => updateVideo({ duration: val })} options={DURATIONS} /></Field>
              <Field label="Language"><Select value={v.language} onChange={(val) => updateVideo({ language: val })} options={LANGUAGES} /></Field>
              <Field label="Video Orientation"><Select value={v.orientation} onChange={(val) => updateVideo({ orientation: val })} options={ORIENTATIONS} /></Field>
              <Field label="Video Background"><Select value={v.background} onChange={(val) => updateVideo({ background: val })} options={BACKGROUNDS} /></Field>
              <Field label="Does it feature a product"><Select value={v.product} onChange={(val) => updateVideo({ product: val })} options={PRODUCTS} placeholder="Select" /></Field>
            </div>

          </div>
          </>
          ) : stage === 'basics' ? (
          <>
          <div className="pb-head">
            <h2>Tell us about your brief</h2>
            <p>The essentials our team reviews before it goes live.</p>
          </div>
          <div className="pb-scroll">
            <div className="pb-brief-fields">
              <Field label="Product / brand name *"><input type="text" value={brief.productName} onChange={setBriefField('productName')} placeholder="e.g. Nova Running Shoes" /></Field>
              <Field label="What are you promoting? *"><textarea rows={2} value={brief.productDescription} onChange={setBriefField('productDescription')} placeholder="Describe the product/service in a line or two (min 10 characters)" /></Field>
              <Field label="Hook / main idea *"><input type="text" value={brief.hook} onChange={setBriefField('hook')} placeholder="The angle that grabs attention in the first 3s" /></Field>
              <Field label="Key message *"><input type="text" value={brief.keyMessage} onChange={setBriefField('keyMessage')} placeholder="The one thing the viewer must take away" /></Field>
              <Field label="Target audience"><textarea rows={2} value={brief.targetAudience} onChange={setBriefField('targetAudience')} placeholder="Who is this for? (age, interests, region)" /></Field>
            </div>
          </div>
          </>
          ) : stage === 'rules' ? (
          <>
          <div className="pb-head">
            <h2>Content rules</h2>
            <p>What the video must include — and must avoid.</p>
          </div>
          <div className="pb-scroll">
            <div className="pb-video-title">Must include</div>
            <div className="pb-brief-fields">
              <Field label="Product on screen (seconds)"><input type="number" min="0" value={brief.productVisibleSecs} onChange={setBriefField('productVisibleSecs')} placeholder="e.g. 5" /></Field>
              <Field label="Call to action"><Select value={brief.cta} onChange={(val) => setBriefVal('cta', val)} options={CTA_OPTIONS} /></Field>
              <Field label="Hashtags"><input type="text" value={brief.hashtags} onChange={setBriefField('hashtags')} placeholder="#brand #launch" /></Field>
              <label className="pb-check"><input type="checkbox" checked={brief.brandTag} onChange={() => toggleBrief('brandTag')} /> Tag the brand handle</label>
            </div>
            <div className="pb-video-title">Must avoid</div>
            <div className="pb-brief-fields">
              <label className="pb-check"><input type="checkbox" checked={brief.noCompetitors} onChange={() => toggleBrief('noCompetitors')} /> No competitor brands</label>
              {brief.noCompetitors && <Field label="Competitors to avoid"><input type="text" value={brief.competitors} onChange={setBriefField('competitors')} placeholder="Brand A, Brand B" /></Field>}
              <label className="pb-check"><input type="checkbox" checked={brief.noOtherProducts} onChange={() => toggleBrief('noOtherProducts')} /> No other products on screen</label>
              <label className="pb-check"><input type="checkbox" checked={brief.noProfanity} onChange={() => toggleBrief('noProfanity')} /> No profanity</label>
              <Field label="Anything else to avoid"><textarea rows={2} value={brief.avoidText} onChange={setBriefField('avoidText')} placeholder="Optional" /></Field>
            </div>
          </div>
          </>
          ) : stage === 'usage' ? (
          <>
          <div className="pb-head">
            <h2>Usage &amp; timeline</h2>
            <p>Where you can use the content, and delivery terms.</p>
          </div>
          <div className="pb-scroll">
            <div className="pb-brief-fields">
              <Field label="Platforms"><input type="text" value={brief.platforms} onChange={setBriefField('platforms')} placeholder="Instagram, TikTok, YouTube…" /></Field>
              <Field label="Rights duration"><Select value={brief.rightsDuration} onChange={(val) => setBriefVal('rightsDuration', val)} options={RIGHTS_OPTIONS} /></Field>
              <label className="pb-check"><input type="checkbox" checked={brief.exclusivity} onChange={() => toggleBrief('exclusivity')} /> Exclusive (creator can’t post similar for competitors)</label>
              <Field label="Revisions included"><input type="number" min="0" value={brief.revisions} onChange={setBriefField('revisions')} /></Field>
            </div>
            <p className="pb-usage-note"><Info size={13} /> Delivery date &amp; slot are set on the left. Budget is the plan rate ({inr(plan?.price || 0)}/video).</p>
          </div>
          </>
          ) : (
          <>
          <div className="pb-head">
            <h2>Brand Guidelines</h2>
            <p>Upload your brand files: logo, assets, visuals, and supporting links.</p>
          </div>

          <div className="pb-scroll">
            <div className="pb-guidelines">
              <label className="pb-dropzone" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}>
                <span className="pb-dropzone-icon"><UploadCloud size={22} /></span>
                <strong>Choose a file or drag &amp; drop here</strong>
                <small>JPEG, PNG, PDF, and MP4 formats, up to 500MB</small>
                <span className="pb-browse">{uploading ? 'Uploading…' : 'Browse'}</span>
                <input type="file" multiple hidden accept="image/*,application/pdf,video/mp4" onChange={(e) => handleFiles(e.target.files)} />
              </label>
              {(v.files || []).length > 0 && (
                <div className="pb-files">
                  {v.files.map((f, i) => <span key={i} className="pb-file-chip"><FileText size={13} /> {f.name}</span>)}
                </div>
              )}

              <div className="pb-or"><span>or</span></div>
              <Field label="Supporting links"><input type="text" value={v.links} onChange={(e) => updateVideo({ links: e.target.value })} placeholder="Paste reference / asset links" /></Field>

              <Field label="Preferred logo position in Video"><Select value={v.logoPosition} onChange={(val) => updateVideo({ logoPosition: val })} options={LOGO_POSITIONS} /></Field>

              <div className="pb-field">
                <span>Add Brand Name Pronunciation (Optional)</span>
                <div className="pb-pronounce">
                  <input type="text" value={v.pronunciation} onChange={(e) => updateVideo({ pronunciation: e.target.value })} placeholder="Type how the brand name is pronounced" />
                  <span className="pb-mic" title="Type the pronunciation"><Mic size={15} /></span>
                </div>
              </div>

              <div className="pb-field">
                <span>Additional Instructions (Optional)</span>
                <div className="pb-notes-tabs"><span className="active"><FileText size={13} /> Add Notes</span><span><Link2 size={13} /> Upload files &amp; Links</span></div>
                <textarea value={v.notes} onChange={(e) => updateVideo({ notes: e.target.value })} rows={3} placeholder="Add notes and additional details to be noted of.." />
              </div>
            </div>
          </div>

          </>
          )}

          {/* Shared footer — Back through the tabs, Next until the last step, then submit. */}
          <div className="pb-footer">
            {stepIdx > 0 && (
              <button type="button" className="pb-goback" onClick={goBack} disabled={submitting}>Back</button>
            )}
            {isLastStep ? holdMoneyBtn : (
              <button
                type="button"
                className="pb-proceed"
                onClick={goNext}
                disabled={submitting || priceMissing || nextBlocked}
                title={priceMissing ? "This creator hasn't set a price yet" : (nextBlocked ? 'Fill the brief basics first' : undefined)}
              >
                Next
              </button>
            )}
          </div>
        </section>

        {/* Inline top-up sheet — keeps the brief alive while they add credits. */}
        {topupOpen && (
          <div className="pb-topup-back" onClick={() => !recharging && setTopupOpen(false)}>
            <div className="pb-topup" onClick={(e) => e.stopPropagation()}>
              <div className="pb-topup-head">
                <h3><Wallet size={16} /> Add credits</h3>
                <button type="button" className="pb-topup-x" onClick={() => setTopupOpen(false)} disabled={recharging}><X size={16} /></button>
              </div>

              <div className="pb-topup-gap">
                <div><span>Order total</span><strong>{inr(total)}</strong></div>
                <div><span>Available credits</span><strong>{inr(wallet || 0)}</strong></div>
                <div className="short"><span>You&apos;re short</span><strong>{inr(gap)}</strong></div>
              </div>

              <label className="pb-topup-field">
                Amount to add
                <input
                  type="number"
                  min={minTopup || 1}
                  value={topupAmount}
                  autoFocus
                  onChange={(e) => setTopupAmount(e.target.value)}
                />
              </label>

              <div className="pb-topup-chips">
                {[suggestedTopup, suggestedTopup + 2000, suggestedTopup + 5000].map((amt) => (
                  <button key={amt} type="button" className={Number(topupAmount) === amt ? 'on' : ''} onClick={() => setTopupAmount(String(amt))}>
                    {inr(amt).replace('.00', '')}
                  </button>
                ))}
              </div>

              {minTopup > 0 && <p className="pb-topup-min">Minimum recharge is {inr(minTopup)}.</p>}

              <button type="button" className="pb-topup-go" onClick={doTopup} disabled={recharging}>
                {recharging ? 'Creating payment order…' : `Add ${inr(Number(topupAmount) || 0)}`}
              </button>
              <button type="button" className="pb-topup-alt" onClick={() => navigate('/dashboard/business/wallet')} disabled={recharging}>
                Open full wallet instead
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .pb-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 18px; }
        .pb-modal { width: min(840px, calc(100% - 32px)); height: min(560px, 88vh); background: #fff; border-radius: 18px; display: grid; grid-template-columns: 250px 1fr; overflow: hidden; box-shadow: 0 30px 70px rgba(15,23,42,0.35); font-family: inherit; }
        @media (max-width: 760px) { .pb-modal { width: 100%; } }
        .pb-rail { background: #fafbfd; border-right: 1px solid #eef0f6; padding: 16px; display: flex; flex-direction: column; gap: 14px; overflow: auto; }
        .pb-tabs { display: flex; gap: 18px; border-bottom: 1px solid #eef0f6; }
        .pb-tabs button { background: none; border: 0; padding: 6px 2px 10px; font-weight: 700; color: #94a3b8; cursor: pointer; border-bottom: 2px solid transparent; }
        .pb-tabs button.active { color: #0f172a; border-bottom-color: #07074e; }
        .pb-rail-body { display: flex; flex-direction: column; gap: 14px; }
        .pb-plan { position: relative; text-align: left; border: 1px solid #eef0f6; background: #fff; border-radius: 14px; padding: 12px; cursor: pointer; }
        .pb-plan.is-selected { background: #f1f3ff; border-color: #c3cbff; }
        .pb-plan-loading { color: #94a3b8; font-weight: 600; text-align: center; }
        /* Leave room for the absolutely-positioned check so long plan names wrap
           instead of running underneath it. */
        .pb-plan-top { display: flex; align-items: flex-start; gap: 8px; padding-right: 30px; }
        .pb-plan-top strong { color: #0f172a; font-size: 0.98rem; line-height: 1.3; overflow-wrap: anywhere; }
        .pb-sample { display: inline-flex; align-items: center; gap: 3px; font-size: 11px; color: #07074e; border: 1px solid #c3cbff; border-radius: 999px; padding: 1px 7px; font-weight: 700; }
        .pb-price { font-size: 1.5rem; font-weight: 800; color: #07074e; margin-top: 4px; }
        .pb-price small { font-size: 0.8rem; color: #94a3b8; font-weight: 600; }
        .pb-plan-tags { color: #94a3b8; font-size: 0.78rem; font-weight: 600; margin-top: 2px; }
        .pb-plan-check { position: absolute; top: 12px; right: 12px; width: 22px; height: 22px; flex: none; border-radius: 7px; display: grid; place-items: center; background: #07074e; color: #fff; opacity: 0; }
        .pb-plan.is-selected .pb-plan-check { opacity: 1; }
        .pb-rail-section { display: grid; gap: 8px; }
        .pb-rail-label { color: #94a3b8; font-size: 0.78rem; font-weight: 800; margin: 0; }
        .pb-creator { display: flex; align-items: center; gap: 8px; }
        .pb-creator-avatar { width: 34px; height: 34px; border-radius: 999px; background: #e0e7ff; color: #4f46e5; display: grid; place-items: center; font-weight: 800; }
        .pb-creator strong { color: #0f172a; }
        .pb-date-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .pb-date-row button { display: flex; flex-direction: column; align-items: center; gap: 2px;
          border: 1px solid #e2e8f0; background: #fff; border-radius: 12px; padding: 9px 6px; font-weight: 700; color: #475569; cursor: pointer; font-size: 0.8rem; }
        .pb-date-row button small { font-weight: 600; font-size: 0.68rem; color: #94a3b8; }
        .pb-date-row button.active { border-color: #07074e; color: #07074e; background: #f1f3ff; }
        .pb-date-row button.active small { color: #4452f0; }
        .pb-date-input { width: 100%; margin-top: 8px; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 12px;
          font-family: inherit; font-weight: 700; color: #0f172a; background: #fff; }
        .pb-date-input:focus { outline: none; border-color: #07074e; }
        .pb-addon { display: flex; align-items: center; gap: 8px; border: 1px solid #eef0f6; background: #fff; border-radius: 12px; padding: 10px 12px; cursor: pointer; text-align: left; }
        .pb-addon.is-selected { border-color: #c3cbff; background: #f1f3ff; }
        .pb-addon-check { width: 18px; height: 18px; border-radius: 6px; border: 1px solid #cbd5e1; display: grid; place-items: center; background: #fff; }
        .pb-addon.is-selected .pb-addon-check { background: #07074e; border-color: #07074e; color: #fff; }
        .pb-addon-name { flex: 1; font-weight: 700; color: #0f172a; font-size: 0.85rem; }
        .pb-addon-price { font-weight: 800; color: #07074e; font-size: 0.85rem; }
        .pb-rail-total { margin-top: auto; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #eef0f6; padding-top: 12px; }
        .pb-rail-total span { color: #94a3b8; font-weight: 700; font-size: 0.82rem; }
        .pb-rail-total strong { color: #0f172a; font-size: 1.15rem; }

        .pb-content { position: relative; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
        .pb-close { position: absolute; top: 14px; right: 14px; width: 36px; height: 36px; border: 0; border-radius: 999px; background: #f1f5f9; color: #0f172a; cursor: pointer; display: grid; place-items: center; z-index: 2; }
        .pb-head { padding: 22px 28px 14px; border-bottom: 1px solid #f1f5f9; }
        /* progress stepper */
        .pb-stepper { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 20px 28px 0; }
        .pb-stepper-item { display: inline-flex; align-items: center; gap: 8px; padding: 6px 14px 6px 8px; border-radius: 999px; background: #f1f2fb; color: #8a8fc0; font-weight: 700; font-size: 0.8rem; border: none; font-family: inherit; cursor: pointer; transition: background .15s, color .15s; }
        .pb-stepper-item:hover:not(.active):not(.is-locked) { background: #e6e8ff; color: #5b6bff; }
        .pb-stepper-item.is-locked { cursor: not-allowed; opacity: 0.55; }
        .pb-stepper-item + .pb-stepper-item { position: relative; margin-left: 10px; }
        .pb-stepper-item + .pb-stepper-item::before { content: "›"; position: absolute; left: -14px; color: #c3cbff; font-weight: 800; }
        .pb-stepper-num { width: 22px; height: 22px; flex: none; border-radius: 50%; display: grid; place-items: center; background: #d7d9f2; color: #fff; font-size: 0.72rem; font-weight: 800; }
        .pb-stepper-item.active { background: #07074e; color: #fff; }
        .pb-stepper-item.active .pb-stepper-num { background: #5b6bff; color: #fff; }
        .pb-stepper-item.done { background: #eafaf1; color: #15a35b; }
        .pb-stepper-item.done .pb-stepper-num { background: #15a35b; color: #fff; }
        .pb-head h2 { margin: 0; color: #0f172a; font-size: 1.3rem; }
        .pb-head p { margin: 6px 0 0; color: #94a3b8; font-size: 0.88rem; }
        .pb-scroll { flex: 1; min-height: 0; overflow-y: auto; padding: 18px 28px; }
        .pb-counter-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
        .pb-counter-row span { color: #334155; }
        .pb-counter { display: flex; align-items: center; gap: 4px; border: 1px solid #e2e8f0; border-radius: 999px; padding: 4px; }
        .pb-counter button { width: 30px; height: 30px; border: 0; background: #f1f5f9; border-radius: 999px; cursor: pointer; display: grid; place-items: center; color: #0f172a; }
        .pb-counter > span { min-width: 28px; text-align: center; font-weight: 800; }
        .pb-video-tabs { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 12px; }
        .pb-video-tabs button { border: 1px solid #e2e8f0; background: #fff; border-radius: 999px; padding: 6px 12px; font-weight: 700; color: #64748b; cursor: pointer; font-size: 0.82rem; }
        .pb-video-tabs button.active { border-color: #07074e; color: #07074e; background: #f1f3ff; }
        .pb-video-title { display: flex; align-items: center; gap: 6px; font-weight: 800; color: #0f172a; padding-bottom: 10px; border-bottom: 2px solid #07074e; width: fit-content; margin-bottom: 18px; }
        .pb-video-title-check { color: #16a34a; }
        .pb-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 24px; }
        .pb-brief-fields { display: flex; flex-direction: column; gap: 14px; margin-top: 6px; margin-bottom: 8px; }
        .pb-brief-fields textarea { resize: vertical; min-height: 46px; }
        .pb-check { display: flex; align-items: center; gap: 9px; font-size: 0.9rem; color: #334155; cursor: pointer; }
        .pb-check input { width: 16px; height: 16px; accent-color: #12124f; cursor: pointer; }
        .pb-usage-note { display: flex; align-items: center; gap: 6px; margin-top: 12px; font-size: 0.8rem; color: #64748b; }
        .pb-field { display: grid; gap: 7px; font-size: 0.85rem; font-weight: 700; color: #334155; }
        .pb-field > span { color: #334155; }
        .pb-field input[type=text], .pb-field textarea { border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; font: inherit; color: #0f172a; background: #fff; resize: vertical; }
        .pb-field input:focus, .pb-field textarea:focus { outline: none; border-color: #07074e; }
        .pb-select { position: relative; }
        .pb-select select { width: 100%; appearance: none; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 34px 10px 12px; font: inherit; color: #0f172a; background: #fff; cursor: pointer; font-weight: 600; }
        .pb-select svg { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; pointer-events: none; }
        .pb-guidelines-toggle { margin-top: 18px; background: none; border: 0; color: #07074e; font-weight: 800; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; padding: 0; }
        .pb-guidelines-toggle.is-added { color: #15a35b; }
        .pb-guidelines { margin-top: 16px; display: grid; gap: 16px; }
        .pb-guidelines-help { margin: 0; color: #475569; font-size: 0.88rem; }
        .pb-dropzone { border: 1.5px dashed #cbd5e1; border-radius: 14px; padding: 22px; display: grid; place-items: center; gap: 6px; text-align: center; cursor: pointer; background: #fbfcff; }
        .pb-dropzone-icon { width: 44px; height: 44px; border-radius: 999px; background: #eef2ff; color: #6366f1; display: grid; place-items: center; }
        .pb-dropzone strong { color: #334155; font-size: 0.9rem; }
        .pb-dropzone small { color: #94a3b8; font-size: 0.78rem; }
        .pb-browse { border: 1px solid #e2e8f0; border-radius: 9px; padding: 6px 16px; font-weight: 700; color: #334155; margin-top: 4px; }
        .pb-files { display: flex; flex-wrap: wrap; gap: 8px; }
        .pb-file-chip { display: inline-flex; align-items: center; gap: 5px; background: #f1f5f9; border-radius: 999px; padding: 5px 10px; font-size: 0.78rem; color: #334155; font-weight: 600; }
        .pb-or { text-align: center; position: relative; color: #94a3b8; font-weight: 700; }
        .pb-or::before, .pb-or::after { content: ''; position: absolute; top: 50%; width: 42%; height: 1px; background: #eef0f6; }
        .pb-or::before { left: 0; } .pb-or::after { right: 0; }
        .pb-pronounce { display: flex; gap: 8px; align-items: center; }
        .pb-pronounce input { flex: 1; }
        .pb-mic { width: 40px; height: 40px; border-radius: 999px; border: 1px solid #fecaca; color: #ef4444; display: grid; place-items: center; flex: 0 0 auto; }
        .pb-notes-tabs { display: flex; gap: 8px; }
        .pb-notes-tabs span { display: inline-flex; align-items: center; gap: 5px; font-size: 0.8rem; font-weight: 700; color: #94a3b8; padding: 5px 10px; border-radius: 8px; }
        .pb-notes-tabs span.active { background: #f1f3ff; color: #07074e; }
        .pb-footer { display: flex; align-items: center; justify-content: flex-end; gap: 12px; padding: 14px 28px; border-top: 1px solid #f1f5f9; }
        .pb-proceed { background: linear-gradient(100deg,#12124f,#07074e); color: #fff; border: 0; border-radius: 11px; padding: 13px 34px; font-weight: 800; cursor: pointer; box-shadow: 0 12px 26px -12px rgba(7,7,78,.7); }
        .pb-proceed:disabled { opacity: 0.6; cursor: not-allowed; }
        .pb-goback { background: #f1f5f9; color: #475569; border: 0; border-radius: 11px; padding: 13px 28px; font-weight: 800; cursor: pointer; }

        /* Payment step */
        .pb-pay-body { display: grid; grid-template-columns: 1fr 300px; gap: 20px; align-items: start; }
        .pb-pay-videos { display: grid; gap: 16px; }
        .pb-pay-card { border: 1px solid #eef0f6; border-radius: 14px; padding: 16px; }
        .pb-pay-card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .pb-pay-card-head strong { color: #0f172a; }
        .pb-rename { display: inline-flex; align-items: center; gap: 5px; border: 1px solid #e2e8f0; background: #fff; border-radius: 8px; padding: 5px 10px; font-size: 0.78rem; font-weight: 700; color: #475569; cursor: pointer; }
        .pb-pay-specs { color: #94a3b8; font-size: 0.82rem; font-weight: 600; margin: 10px 0 4px; }
        .pb-pay-actor { color: #64748b; font-size: 0.82rem; margin: 0 0 12px; }
        .pb-pay-actions { display: flex; gap: 22px; border-top: 1px solid #f1f5f9; padding-top: 12px; }
        .pb-pay-del, .pb-pay-mod { display: inline-flex; align-items: center; gap: 6px; background: none; border: 0; font-weight: 700; cursor: pointer; font-size: 0.85rem; }
        .pb-pay-del { color: #ef4444; }
        .pb-pay-mod { color: #6366f1; }
        .pb-summary { border: 1px solid #eef0f6; border-radius: 14px; padding: 14px; position: sticky; top: 0; }
        .pb-summary-rows { display: grid; gap: 12px; border-bottom: 1px solid #f1f5f9; padding-bottom: 12px; }
        .pb-summary-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
        .pb-summary-row > span { color: #334155; font-weight: 600; font-size: 0.88rem; }
        .pb-summary-row > div { text-align: right; }
        .pb-summary-row strong { color: #0f172a; display: block; }
        .pb-summary-row small { color: #07074e; font-size: 0.72rem; font-weight: 700; }
        .pb-summary-foot { display: grid; gap: 8px; padding-top: 12px; }
        .pb-credits { display: flex; align-items: center; gap: 6px; color: #07074e; font-size: 0.78rem; font-weight: 700; margin: 0 0 4px; }
        .pb-shortfall { margin: 10px 0 0; padding: 8px 10px; border-radius: 8px; background: #fef2f2; color: #b91c1c; font-size: 0.78rem; font-weight: 700; line-height: 1.35; }
        .pb-addfunds { display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(100deg,#f0a13a,#e0851b); box-shadow: 0 12px 26px -12px rgba(224,133,27,.75); }
        .pb-addfunds:hover { background: linear-gradient(100deg,#e0851b,#c9740f); }

        /* inline top-up sheet (lives inside the modal so the brief isn't lost) */
        .pb-modal { position: relative; }
        .pb-topup-back { position: absolute; inset: 0; background: rgba(15,23,42,.45); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; z-index: 5; padding: 18px; }
        .pb-topup { width: min(360px, 100%); background: #fff; border-radius: 14px; padding: 18px; box-shadow: 0 24px 50px rgba(15,23,42,.3); display: flex; flex-direction: column; gap: 12px; max-height: 100%; overflow: auto; }
        .pb-topup-head { display: flex; align-items: center; justify-content: space-between; }
        .pb-topup-head h3 { margin: 0; display: flex; align-items: center; gap: 7px; font-size: 1rem; color: #07074e; }
        .pb-topup-x { background: none; border: 0; cursor: pointer; color: #64748b; padding: 2px; }
        .pb-topup-gap { border: 1px solid #eef0f6; border-radius: 10px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
        .pb-topup-gap div { display: flex; justify-content: space-between; font-size: 0.82rem; color: #64748b; }
        .pb-topup-gap strong { color: #07074e; }
        .pb-topup-gap .short { border-top: 1px dashed #e2e8f0; padding-top: 6px; color: #b91c1c; font-weight: 700; }
        .pb-topup-gap .short strong { color: #b91c1c; }
        .pb-topup-field { display: flex; flex-direction: column; gap: 6px; font-size: 0.8rem; font-weight: 700; color: #2d3748; }
        .pb-topup-field input { padding: 10px 12px; border: 1.5px solid #e2e8f0; border-radius: 9px; font-size: 0.95rem; font-family: inherit; font-weight: 700; color: #07074e; }
        .pb-topup-field input:focus { outline: none; border-color: #e0851b; }
        .pb-topup-chips { display: flex; gap: 6px; flex-wrap: wrap; }
        .pb-topup-chips button { flex: 1; min-width: 84px; background: #f7f8fc; border: 1.5px solid #eef0f6; border-radius: 999px; padding: 6px 8px; font-size: 0.76rem; font-weight: 700; color: #4a5568; cursor: pointer; }
        .pb-topup-chips button.on, .pb-topup-chips button:hover { border-color: #e0851b; color: #07074e; background: #fff7ed; }
        .pb-topup-min { margin: 0; font-size: 0.72rem; color: #94a3b8; }
        .pb-topup-go { background: linear-gradient(100deg,#f0a13a,#e0851b); color: #fff; border: 0; border-radius: 10px; padding: 12px; font-weight: 800; cursor: pointer; }
        .pb-topup-go:disabled { opacity: .6; cursor: not-allowed; }
        .pb-topup-alt { background: none; border: 0; color: #64748b; font-size: 0.78rem; font-weight: 700; cursor: pointer; text-decoration: underline; }
        .pb-proceed:disabled { opacity: 0.55; cursor: not-allowed; }
        .pb-noprice { display: flex; align-items: flex-start; gap: 6px; margin: 12px 0 0; padding: 10px 12px; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; color: #9a3412; font-size: 12.5px; line-height: 1.5; }
        .pb-summary-line { display: flex; align-items: center; justify-content: space-between; color: #475569; font-weight: 600; font-size: 0.9rem; }
        .pb-summary-line em { background: #f1f5f9; border-radius: 6px; padding: 1px 6px; font-style: normal; font-size: 0.72rem; }
        .pb-summary-total { border-top: 1px solid #f1f5f9; padding-top: 8px; color: #0f172a; font-size: 1.05rem; }
        .pb-summary-total strong { color: #0f172a; }
        @media (max-width: 760px) { .pb-pay-body { grid-template-columns: 1fr; } }
        @media (max-width: 760px) { .pb-modal { grid-template-columns: 1fr; height: 94vh; } .pb-rail { display: none; } .pb-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
