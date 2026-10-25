import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Bookmark, ChevronLeft, Check, X, Play, ShieldCheck, CheckCircle2 } from 'lucide-react';
import BottomSheet from '../../shell/BottomSheet';
import { brandColor, initialOf, assetUrl, inr, briefFacts, briefPay, bidCount, dueLabel } from '../../../components/briefUi';
import briefDeliveryLabel from '../../../utils/briefDeliveryLabel';
import { timeAgo } from '../../../utils/normalizeBrief';
import { creatorsWanted, slotsLeft, needsEditSplit } from '../../../utils/campaignCreators';
import { maxCampaignBid, bidOverBudgetMessage } from '../../../utils/bidBudget';
import { apiErrorMessage } from '../../../utils/apiError';
import { getProfileMissing } from '../../../utils/creatorProfileCompletion';
import { DEFAULT_COMMISSION_PERCENT, feeBreakdown, inr as inr2, pctLabel } from '../../../utils/bidFee';
import { mediaUrl } from '../../../utils/mediaUrl';
import './briefs.css';

export const API = `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api`;
export const OFFLINE = "You're offline. Check your connection and try again.";
export const failText = (e, text) => (e?.response ? text : OFFLINE);

// Invites = direct bookings / custom-priced requests the creator still has to answer (same rule as the Orders hub).
export const isInviteDeal = (d) => ['pending_creator', 'price_revision'].includes(d?.campaign?.booking_status) && !d?.campaign?.brief_sent;

export function Logo({ name, src, size = '' }) {
  return (
    <span className={`ap-bf-logo${size ? ` ap-bf-logo--${size}` : ''}`} style={src ? undefined : { background: brandColor(name) }}>
      {src ? <img src={assetUrl(src)} alt="" /> : initialOf(name)}
    </span>
  );
}

/* ---------- tabs shared by Find briefs / Saved / Applied ---------- */
const TAB_TO = { all: '/browse-briefs', invites: '/browse-briefs?tab=invites', saved: '/saved', applied: '/browse-briefs?tab=applied' };
export function BriefTabs({ active, counts = {} }) {
  const navigate = useNavigate();
  const items = [['all', 'For you'], ['invites', 'Invites'], ['saved', 'Saved'], ['applied', 'Applied']];
  return (
    <div className="ap-bf-tabs" role="tablist" aria-label="Find briefs">
      {items.map(([key, label]) => (
        <button key={key} type="button" role="tab" aria-selected={active === key} className={`ap-bf-tab${active === key ? ' is-on' : ''}`} onClick={() => active !== key && navigate(TAB_TO[key], { replace: true })}>
          {label}{counts[key] != null && <i>{counts[key]}</i>}
        </button>
      ))}
    </div>
  );
}

/* ---------- brief card ---------- */
export function BriefCard({ brief: b, saved, onOpen, onToggleSave, busy = false, cta }) {
  const facts = briefFacts(b);
  const n = bidCount(b);
  const due = dueLabel(b);
  const closing = b.deliveryDays != null && b.deliveryDays <= 1;
  const open = () => onOpen(b);
  return (
    <article
      className={`ap-bf-card${busy ? ' is-busy' : ''}`}
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(); } }}
    >
      <div className="ap-bf-ctop">
        <Logo name={b.brand} src={b.logo} />
        <div className="ap-bf-cbrand"><b>{b.brand}</b>{b.industryType ? <small>{b.industryType}</small> : null}</div>
        <button type="button" className={`ap-bf-save${saved ? ' is-on' : ''}`} aria-label={saved ? 'Remove from saved' : 'Save brief'} aria-pressed={saved} onClick={(e) => { e.stopPropagation(); onToggleSave(b); }}>
          <span><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} /></span>
        </button>
      </div>
      <div className="ap-bf-cbody">
        {b.createdAt ? <div className="ap-bf-posted">Posted {timeAgo(b.createdAt)}</div> : null}
        <h3>{b.title}</h3>
        {b.description ? <p>{b.description}</p> : null}
      </div>
      {facts.length > 0 && (
        <div className="ap-bf-facts">{facts.map(([k, v]) => <div key={k}><small>{k}</small><b title={v}>{v}</b></div>)}</div>
      )}
      <div className="ap-bf-cfoot">
        <div className="ap-bf-price">
          <b>{briefPay(b)}</b>
          <span>Bid your price{n != null ? ` · ${n} ${n === 1 ? 'bid' : 'bids'}` : ''}{due ? <> · {closing ? <em>{due}</em> : due}</> : null}</span>
        </div>
        <button type="button" className={`ap-bf-cta${b.hasBid ? ' is-soft' : ''}`} onClick={(e) => { e.stopPropagation(); open(); }}>{cta || (b.hasBid ? 'Applied' : 'Apply')}</button>
      </div>
    </article>
  );
}

export function BriefCardSkeleton() {
  return (
    <div className="ap-bf-sk" aria-hidden="true">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <span className="ap-skel" style={{ width: 32, height: 32, borderRadius: 9 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="ap-skel" style={{ width: '50%', height: 10 }} />
          <span className="ap-skel" style={{ width: '34%', height: 10 }} />
        </div>
      </div>
      <span className="ap-skel" style={{ width: '80%', height: 16 }} />
      <span className="ap-skel" style={{ width: '100%', height: 10 }} />
      <span className="ap-skel" style={{ width: '100%', height: 46 }} />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span className="ap-skel" style={{ width: '40%', height: 22 }} />
        <span className="ap-skel" style={{ width: 90, height: 44, borderRadius: 999 }} />
      </div>
    </div>
  );
}

export function ErrorBanner({ text, onRetry }) {
  return (
    <div className="ap-bf-err" role="alert">
      <span>{text}</span>
      <button type="button" onClick={onRetry}>Retry</button>
    </div>
  );
}

/* ---------- full-screen brief detail ---------- */
const CTA_LINK_LABEL = { 'Visit website': 'Website link', 'Swipe up': 'Swipe-up link', 'Follow brand': 'Brand handle to follow' };
const fmtDay = (d) => {
  const ms = d ? new Date(d).getTime() : NaN;
  return Number.isFinite(ms) ? new Date(ms).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
};
const listVal = (v) => (Array.isArray(v) ? v.filter(Boolean).join(', ') : (v || ''));
const filled = (rows) => rows.filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '');

export function BriefDetail({ brief: b, saved, onToggleSave, onClose, onApply, applying = false }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const c = b.campaign || {};
  const objectives = Array.isArray(c.objectives) ? c.objectives.filter(Boolean) : [];
  const deliverables = Array.isArray(c.deliverable_items) ? c.deliverable_items : [];
  const groups = [
    { h: 'Product', rows: [
      ['Product', c.product_name],
      ['Product type', [c.product_type, c.product_type_detail].filter(Boolean).join(' - ')],
      ['Category', c.product_category || c.category],
      ['Description', c.product_description],
      ['Hook', c.campaign_hook],
      ['Key message', c.key_message],
      ['Target audience', c.target_audience],
      ['Video language', c.language],
    ] },
    { h: 'Deliverables', rows: deliverables.map((d, i) => [
      `Deliverable ${i + 1}`,
      `${d.quantity || 1} x ${d.type || ''}${d.duration ? `; ${d.duration}` : ''}${d.aspect_ratios?.length ? `; ${d.aspect_ratios.join(', ')}` : ''}; deliver ${briefDeliveryLabel(d)}`,
    ]) },
    { h: 'Script', rows: [
      ['Script provider', c.script_provider === 'ugc' ? 'UGC.ad' : c.script_provider === 'brand' ? 'Brand' : ''],
      ['Script', c.script_text || (c.script_provider === 'ugc' ? 'UGC.ad is preparing the script - check back before you start.' : '')],
    ] },
    { h: 'Creator targeting', rows: [
      ['Creator level', c.creator_level], ['Quality tier', c.content_quality_tier],
      ['Gender preference', c.gender_preference], ['Location', c.city_filter || 'Any location'],
    ] },
    { h: 'Style guidance', rows: [['Tone', listVal(c.tone_tags)], ['Pacing', c.pacing], ['Music', c.music_preference]] },
    { h: 'Usage rights', rows: [
      ['Platforms', listVal(c.usage_platforms)], ['Rights duration', c.rights_duration], ['Exclusivity', c.exclusivity],
      ['Whitelisting', c.whitelisting ? 'Yes' : ''], ['Modification', c.modification_rights],
    ] },
  ].map((s) => ({ ...s, rows: filled(s.rows) })).filter((s) => s.rows.length);
  const include = filled([
    ['Product visible', c.product_visible ? `${c.product_visible_seconds || ''}s minimum` : ''],
    ['Verbal mention', c.verbal_mention ? (c.verbal_mention_text || 'Yes') : ''],
    ['Required phrases', listVal(c.required_phrases)],
    ['Required shots', listVal(c.required_shots)],
    ['Call to action', c.call_to_action],
    [CTA_LINK_LABEL[c.call_to_action] || 'CTA link', c.cta_link],
    ['Promo code', c.promo_code], ['Hashtags', c.hashtags], ['Brand tag', c.brand_handle_tag ? 'Yes' : ''],
  ]);
  const avoid = filled([
    ['Competitors', c.no_competitors ? (c.competitors_text || 'No competitor brands') : ''],
    ['Other products', c.no_other_products ? 'Not allowed' : ''],
    ['Profanity', c.no_profanity ? 'Not allowed' : ''],
    ['Political/religious', c.no_political ? 'Not allowed' : ''],
    ['Filters/effects', c.avoid_filters ? (c.filter_types_text || 'Avoid') : ''],
    ['Other', c.avoid_text],
  ]);
  const dates = [
    ['Product ships by', c.product_shipping_by],
    ['First draft', c.draft_delivery_by],
    ['Final delivery', c.final_delivery_by || c.due_date || c.deadline],
  ].map(([k, v]) => [k, fmtDay(v)]).filter(([, v]) => v);
  const moodImages = (Array.isArray(c.mood_images) ? c.mood_images : [])
    .filter((u) => typeof u === 'string' && (u.startsWith('http') || u.startsWith('/'))).map((u) => assetUrl(u));
  const refVideos = (Array.isArray(c.reference_videos) ? c.reference_videos : [])
    .filter((u) => typeof u === 'string' && u.trim())
    .map((u) => { const raw = u.trim(); const hosted = /\/uploads?\//i.test(raw); return { hosted, url: hosted ? mediaUrl(raw) : raw }; });

  const needed = creatorsWanted(c);
  const open = slotsLeft(c);
  const length = deliverables.map((d) => d?.duration).find(Boolean) || '';
  const lang = Array.isArray(c.language) ? c.language.join(' / ') : c.language;
  const n = bidCount(b);
  const maximum = maxCampaignBid(b);
  const pay = briefPay(b);
  const due = b.deliveryDays != null ? (b.deliveryDays === 0 ? 'Today' : `${b.deliveryDays} ${b.deliveryDays === 1 ? 'day' : 'days'}`) : '';
  const cells = [
    ['Make', deliverables.length ? b.deliverables : ''],
    ['Length', length], ['Language', lang],
    ['Creators', open < needed ? `${open} of ${needed} open` : `${needed} needed`],
  ].filter(([, v]) => v);

  return createPortal(
    <div className="ap-bf-detail" role="dialog" aria-modal="true" aria-label={b.title}>
      <div className="ap-bf-dbar">
        <button type="button" className="ap-bf-dbtn" aria-label="Back to briefs" onClick={onClose}><ChevronLeft size={22} /></button>
        <h2>{b.title}</h2>
        <button type="button" className={`ap-bf-dbtn${saved ? ' is-on' : ''}`} aria-label={saved ? 'Remove from saved' : 'Save brief'} aria-pressed={saved} onClick={() => onToggleSave(b)}>
          <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="ap-bf-dscroll">
        <div className="ap-bf-ticket">
          <div className="ap-bf-ticket-t">
            <div className="ap-bf-ticket-b">
              <Logo name={b.brand} src={b.logo} size="lg" />
              <div><b>{b.brand}</b>{b.industryType ? <small>{b.industryType}</small> : null}</div>
              {n != null ? <span className="ap-pill ap-pill--muted">{n} applied</span> : null}
            </div>
            <h1>{b.title}</h1>
            {b.description && b.description !== 'Create engaging UGC content for this brand.' ? <p>{b.description}</p> : null}
          </div>
          <div className="ap-bf-tear" />
          <div className="ap-bf-ticket-p">
            <div>
              <small>Per video</small>
              <b>{pay}</b>
              <em>{maximum ? `Bid your price · up to ${inr(maximum)}` : 'Bid your price'}</em>
            </div>
            <div>
              <small>{due ? 'Deliver in' : 'Creators'}</small>
              <b>{due || (open < needed ? `${open} of ${needed}` : needed)}</b>
              {c.requires_shipment === true ? <em className="ok">Product shipped to you</em> : c.requires_shipment === false ? <em>No product shipment</em> : <em />}
            </div>
          </div>
        </div>

        {cells.length > 0 && <div className="ap-bf-grid2">{cells.map(([k, v]) => <div key={k}><small>{k}</small><b>{v}</b></div>)}</div>}
        {objectives.length > 0 && <div className="ap-bf-tags">{objectives.map((o, i) => <span className="ap-pill" key={i}>{o}</span>)}</div>}

        {dates.length > 0 && (
          <div className="ap-card ap-bf-dcard">
            <h3>Dates</h3>
            <div className="ap-bf-dates" style={{ '--n': dates.length }}>
              {dates.map(([k, v], i) => <div key={k} className={i === 0 ? 'is-first' : ''}><i /><small>{k}</small><b>{v}</b></div>)}
            </div>
            {c.revision_limit ? <p className="ap-bf-hint" style={{ marginTop: 12 }}>Revisions included: {c.revision_limit}</p> : null}
          </div>
        )}

        {include.length > 0 && (
          <div className="ap-card ap-bf-dcard">
            <h3>What the brand wants</h3>
            <ul className="ap-bf-ul">{include.map(([k, v]) => <li key={k}><i><Check size={12} strokeWidth={3} /></i><span><b>{k}:</b> {String(v)}</span></li>)}</ul>
          </div>
        )}
        {avoid.length > 0 && (
          <div className="ap-card ap-bf-dcard">
            <h3>Please don’t</h3>
            <ul className="ap-bf-ul ap-bf-ul--bad">{avoid.map(([k, v]) => <li key={k}><i><X size={12} strokeWidth={3} /></i><span><b>{k}:</b> {String(v)}</span></li>)}</ul>
          </div>
        )}

        {(moodImages.length > 0 || refVideos.length > 0) && (
          <div className="ap-card ap-bf-dcard">
            <h3>Example videos <small>shared by the brand</small></h3>
            <div className="ap-bf-media">
              {refVideos.filter((v) => v.hosted).map((v, i) => <video key={`${v.url}-${i}`} src={v.url} controls preload="metadata" playsInline />)}
              {moodImages.map((src, i) => <a key={`${src}-${i}`} href={src} target="_blank" rel="noreferrer"><img src={src} alt={`Mood board ${i + 1}`} /></a>)}
            </div>
            {refVideos.filter((v) => !v.hosted).map((v, i) => <a key={`${v.url}-${i}`} href={v.url} target="_blank" rel="noreferrer" className="ap-bf-reflink"><Play size={14} /> {v.url}</a>)}
          </div>
        )}

        {groups.map((s) => (
          <div className="ap-card ap-bf-dcard" key={s.h}>
            <h3>{s.h}</h3>
            <div className="ap-bf-rows">{s.rows.map(([k, v]) => <div key={k}><span>{k}</span><span>{String(v)}</span></div>)}</div>
          </div>
        ))}
        {groups.length === 0 && !include.length && !avoid.length && b.description ? (
          <div className="ap-card ap-bf-dcard"><h3>Brief</h3>{String(b.description).split('\n').filter((l) => l.trim()).map((l, i) => <p className="ap-bf-line" key={i}>{l}</p>)}</div>
        ) : null}
        <div className="ap-bf-safe"><ShieldCheck size={16} /> Payment is held safely by UGCad until you deliver</div>
      </div>

      <div className="ap-bf-dfoot">
        <div><small>Pay per video</small><strong>{pay}</strong></div>
        <button type="button" className="ap-btn" disabled={applying} onClick={() => onApply(b)}>{b.hasBid ? 'View your bid' : applying ? 'Checking…' : 'Apply with a bid'}</button>
      </div>
    </div>,
    document.body,
  );
}

/* ---------- apply flow: profile check -> KYC -> fee notice -> bid form (same gates + payload as BrowseBriefs) ---------- */
export function useApply(user, onApplied) {
  const navigate = useNavigate();
  const [step, setStep] = useState(null); // { type: 'missing'|'fee'|'form'|'bid', brief, missing? }
  const [percent, setPercent] = useState(DEFAULT_COMMISSION_PERCENT);
  const [checking, setChecking] = useState(false);
  const [form, setForm] = useState({ amount: '', days: '', proposal: '' });
  const [submitting, setSubmitting] = useState(false);
  const lock = useRef(false);
  const checkLock = useRef(false);

  const start = async (b) => {
    if (b.hasBid) { setStep({ type: 'bid', brief: b }); return; }
    if (checkLock.current) return;
    checkLock.current = true; setChecking(true);
    try {
      // An incomplete profile can't bid: ask the server, else fall back to the website's own checklist.
      let answer;
      try {
        answer = (await axios.get(`${API}/creator/bid-readiness`)).data;
      } catch {
        const local = getProfileMissing(user);
        answer = { can_bid: local.length === 0, missing: local, commission_percent: DEFAULT_COMMISSION_PERCENT };
      }
      if (answer.commission_percent != null) setPercent(Number(answer.commission_percent));
      if (!answer.can_bid) { setStep({ type: 'missing', brief: b, missing: answer.missing || [] }); return; }
      // KYC gate: unverified creators can't bid.
      if (user?.kyc?.status !== 'verified' && !user?.kyc_verified) {
        toast.error('Verify your KYC before submitting a bid.');
        navigate('/kyc');
        return;
      }
      setStep({ type: 'fee', brief: b });
    } finally {
      checkLock.current = false; setChecking(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (lock.current || step?.type !== 'form') return;
    const b = step.brief;
    const maximum = maxCampaignBid(b);
    if (maximum && Number(form.amount) > maximum) { toast.error(bidOverBudgetMessage(maximum)); return; }
    lock.current = true; setSubmitting(true);
    try {
      await axios.post(`${API}/campaigns/${b.id}/bid`, {
        campaign_id: b.id,
        amount: parseFloat(form.amount),
        proposal: form.proposal,
        estimated_delivery_days: parseInt(form.days, 10),
      });
      toast.success('Bid submitted successfully!');
      setStep(null);
      onApplied?.(b);
    } catch (error) {
      toast.error(error?.response ? apiErrorMessage(error, 'Failed to submit bid') : OFFLINE);
    } finally {
      lock.current = false; setSubmitting(false);
    }
  };

  const close = () => { if (!submitting) setStep(null); };
  const b = step?.brief;
  const c = b?.campaign || {};
  const split = b ? needsEditSplit(b.campaign || b) : false;
  const maximum = b ? maxCampaignBid(b) : 0;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: k === 'amount' && split ? e.target.value.replace(/[^0-9]/g, '') : e.target.value }));
  const pct = pctLabel(percent);

  const ui = (
    <>
      <BottomSheet
        open={step?.type === 'missing'}
        onClose={close}
        title="Complete your profile to bid"
        subtitle="Brands choose creators from their profile, so you can bid once these are filled in."
        footer={(
          <>
            <button type="button" className="ap-btn ap-btn--ghost" style={{ flex: 1 }} onClick={close}>Not now</button>
            <button type="button" className="ap-btn" style={{ flex: 1 }} onClick={() => { setStep(null); navigate('/settings?tab=profile'); }}>Complete profile</button>
          </>
        )}
      >
        <ul className="ap-bf-ul2" data-testid="bgate-missing">{(step?.missing || []).map((m) => <li key={m}>{m}</li>)}</ul>
      </BottomSheet>

      <BottomSheet
        open={step?.type === 'fee'}
        onClose={close}
        title={`Platform fee: ${pct}%`}
        footer={(
          <>
            <button type="button" className="ap-btn ap-btn--ghost" style={{ flex: 1 }} onClick={close}>Cancel</button>
            <button type="button" className="ap-btn" style={{ flex: 1 }} onClick={() => { setForm({ amount: '', days: '', proposal: '' }); setStep({ type: 'form', brief: step.brief }); }}>Continue to bid</button>
          </>
        )}
      >
        <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: '#3a3a6a' }}>
          UGC.ad keeps <strong>{pct}%</strong> of your bid as its platform fee. It is deducted from your payout when the brand approves your work.
        </p>
        <p className="ap-bf-example">Example: bid {inr2(1000)} → fee {inr2(feeBreakdown(1000, percent)?.fee ?? 0)} → you receive {inr2(feeBreakdown(1000, percent)?.net ?? 1000)}.</p>
      </BottomSheet>

      <BottomSheet
        open={step?.type === 'form'}
        onClose={close}
        tall
        title="Apply to this brief"
        subtitle={b ? `${b.title || 'Campaign'} · ${b.brand || 'Brand'}` : ''}
        footer={<button type="submit" form="ap-apply-form" className="ap-btn ap-btn--block" style={{ height: 52 }} disabled={submitting}>{submitting ? 'Sending…' : 'Send application'}</button>}
      >
        <form id="ap-apply-form" onSubmit={submit}>
          <div className="ap-bf-fld">
            <div className="ap-bf-step"><i>1</i>{split ? 'Combined payout per video (₹)' : 'Your price per video (₹)'}</div>
            <input
              className="ap-input" required aria-label="Your price per video"
              type={split ? 'text' : 'number'} inputMode="numeric" min="1" max={!split && maximum ? maximum : undefined}
              value={form.amount} onChange={set('amount')} placeholder={split ? 'e.g. 1000' : 'Enter your bid amount'}
            />
            <p className="ap-bf-hint">
              {split ? 'One bid includes both the raw video and the edited video. ' : ''}
              {maximum ? `Up to ${inr(maximum)} per video.` : 'Set your own price.'}
            </p>
          </div>
          <div className="ap-bf-fee" data-testid="bid-fee-notice">
            <strong>UGC.ad platform fee: {pct}%</strong>
            <span>Deducted from your payout when the brand approves your work.</span>
          </div>
          <div className="ap-bf-fld">
            <div className="ap-bf-step"><i>2</i>Estimated delivery (days)</div>
            <input className="ap-input" required aria-label="Estimated delivery in days" type="number" inputMode="numeric" step="1" min="1" value={form.days} onChange={set('days')} placeholder="How many days to complete?" />
          </div>
          <div className="ap-bf-fld">
            <div className="ap-bf-step"><i>3</i>Why you? <span style={{ fontWeight: 400, color: 'var(--ap-muted)', fontSize: 12 }}>(the brand sees this)</span></div>
            <textarea className="ap-input" required aria-label="Why you" rows={4} value={form.proposal} onChange={set('proposal')} placeholder="Describe your approach, experience, and why you're the right fit..." />
          </div>
        </form>
      </BottomSheet>

      <BottomSheet open={step?.type === 'bid'} onClose={close} title="Your bid" subtitle={b ? `${b.title || 'Campaign'} · ${b.brand || 'Brand'}` : ''} footer={<button type="button" className="ap-btn ap-btn--ghost ap-btn--block" onClick={close}>Close</button>}>
        {b && (() => {
          const bid = (c.bids || []).find((item) => String(item.creator_id) === String(user?.id)) || {};
          const status = String(bid.status || 'pending').replace(/_/g, ' ');
          return (
            <>
              <span className="ap-pill ap-pill--ok"><CheckCircle2 size={14} /> Bid already submitted</span>
              <div className="ap-bf-stats">
                <div><small>Your bid</small><b>{inr(bid.amount)}</b></div>
                <div><small>Estimated delivery</small><b>{bid.estimated_delivery_days || '-'} days</b></div>
                <div><small>Status</small><b style={{ textTransform: 'capitalize' }}>{status}</b></div>
              </div>
              <div className="ap-bf-sec"><h4>Your proposal</h4><p>{bid.proposal || 'No proposal added.'}</p></div>
            </>
          );
        })()}
      </BottomSheet>
    </>
  );

  return { start, checking, ui };
}
