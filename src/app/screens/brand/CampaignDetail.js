import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation, matchPath } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  MoreHorizontal, Play, Truck, MessageCircle, Send, Star, Download, RefreshCw, Copy, FileText, Info, Plus,
  Pencil, Trash2, Clock, ShieldCheck, Check, BadgeCheck, ChevronRight, ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../../App';
import { useLiveEffect } from '../../../lib/liveUpdates';
import { findCreatorDeal, getDealMessages } from '../../../utils/dealMessages';
import { downloadDeliverable } from '../../../utils/downloadDeliverable';
import { campaignStage, STAGE_LABELS } from '../../../utils/campaignStage';
import { draftTotalBudget } from '../../../utils/budgetLabel';
import { selectedCreators, creatorsWanted, slotsLeft, bidSplitLabel } from '../../../utils/campaignCreators';
import { creatorFirstName } from '../../../utils/displayName';
import { apiErrorMessage } from '../../../utils/apiError';
import { MAX_REVISION_ITEMS, revisionItemCount, buildRevisionPayload, revisionFeeNotice } from '../../../utils/revisionPayload';
import withBrandGate from '../../brandkit/withBrandGate';
import AppShell from '../../shell/AppShell';
import BottomSheet from '../../shell/BottomSheet';
import {
  API, ROUTES, inr, fmtDate, fmtDay, assetUrl, isVideoUrl, campaignThumb, bidFirstName, backOr,
  Thumb, Avatar, StageBar, Row, SkelCards, ErrorState, OfflineStrip, useBidActions, useWalletBalance,
} from './campaignKit';

// Campaign status -> header badge (a rejected / pending campaign must never read "Live").
const STATUS_BADGE = {
  active: { label: 'Live', tone: 'ok' },
  in_progress: { label: 'Live', tone: 'ok' },
  work_submitted: { label: 'In review', tone: 'warn' },
  completed: { label: 'Completed', tone: 'ok' },
  pending_approval: { label: 'Pending approval', tone: 'muted' },
  awaiting_brand_confirmation: { label: 'Script ready', tone: 'warn' },
  rejected: { label: 'Rejected', tone: 'bad' },
  cancelled: { label: 'Cancelled', tone: 'bad' },
  paused: { label: 'On hold', tone: 'muted' },
  banned: { label: 'Removed', tone: 'bad' },
  draft: { label: 'Draft', tone: 'muted' },
};
const statusBadge = (s) => STATUS_BADGE[s] || { label: 'Live', tone: 'ok' };

const WS_STATUS = {
  approved: { tone: 'ok', label: 'Approved' },
  pending_review: { tone: 'warn', label: 'To review' },
  revision_requested: { tone: 'warn', label: 'Revision' },
  awaiting_edited: { tone: 'muted', label: 'Creator editing' },
  awaiting_edit: { tone: 'muted', label: 'With UGC.ad editors' },
};
// Who cuts the edited video: 'creator', 'ugc', or null (no edited file on the brief).
const editModeOf = (c) => {
  const items = Array.isArray(c?.deliverable_items) ? c.deliverable_items : [];
  if (items.some((d) => d?.edited_required && d?.edited_by !== 'ugc')) return 'creator';
  if (items.some((d) => d?.edited_required && d?.edited_by === 'ugc')) return 'ugc';
  return null;
};
const DEAL_ORDER = ['Accepted - Awaiting Shipment', 'Shipped - In Transit', 'Delivered - Awaiting Receipt Confirmation', 'Received - Content in Progress', 'Content Submitted - Awaiting Review', 'Approved - Payment Processing', 'Paid - Complete'];
const EDIT_STATES = ['Raw Approved - Edited Video Due', 'Raw Approved - UGC.ad Editing'];
// The backend emits em-dashes while the list above uses hyphens; without normalising indexOf() is always -1.
const normalizeDash = (v) => String(v || '').replace(/\s*(?:—|–|-)\s*/g, ' - ');
const dealStateIndex = (state) => {
  const key = normalizeDash(state);
  if (EDIT_STATES.some((s) => normalizeDash(s) === key)) return DEAL_ORDER.indexOf('Content Submitted - Awaiting Review');
  return DEAL_ORDER.findIndex((s) => normalizeDash(s) === key);
};
const dealStateText = (state) => normalizeDash(state).replace(' - ', ' · ');

const creatorPhoto = (c) => {
  const p = c?.profile || {};
  return c?.profile_photo || c?.profile_picture || p.profile_photo || p.profile_picture || c?.photo || '';
};
const fmtLevel = (v) => String(v || '').replace(/^l(\d+)$/i, (_, n) => `L${n}`);
const safeText = (v, fb = '') => (v == null || v === '' || typeof v === 'object' ? fb : String(v));
const fmtDur = (s) => { if (!s || !Number.isFinite(s)) return ''; const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${String(sec).padStart(2, '0')}`; };
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /\+?\d[\d\s().-]{5,}\d/g;
// Keep the deal on-platform: no phone numbers / emails in a revision request (the server rejects them too).
const hasContactInfo = (text) => {
  const s = String(text || '');
  if (EMAIL_RE.test(s)) return true;
  return (s.match(PHONE_RE) || []).some((m) => m.replace(/\D/g, '').length >= 7);
};

function parseRevisionItem(s) {
  const str = String(s || '').trim();
  const sev = str.match(/^\[([^\]]+)\]\s*/);
  const rest = sev ? str.slice(sev[0].length) : str;
  const ref = rest.match(/\(ref:\s*([^)]*)\)/i);
  const text = rest.replace(/\(ref:\s*[^)]*\)/i, '').replace(/\s+-\s*$/, '').trim();
  return { severity: sev ? sev[1].trim() : '', ref: ref ? ref[1].trim() : '', text };
}
function revisionItems(rev) {
  const raw = (rev.requested_changes && rev.requested_changes.length) ? rev.requested_changes : String(rev.latest_feedback || '').split(/\n+/);
  const seen = new Set();
  const out = [];
  raw.map((s) => String(s || '').trim()).filter(Boolean).forEach((s) => {
    if (/^notes\s*:/i.test(s)) return;
    const parsed = parseRevisionItem(s);
    const key = parsed.text.toLowerCase();
    if (!parsed.text || seen.has(key)) return;
    seen.add(key);
    out.push(parsed);
  });
  return out;
}

// The brief is stored as newline-separated "Label: value" lines: show them as a readable list.
function BriefRows({ text }) {
  if (!text) return <p className="ap-cp-p">No description provided.</p>;
  const out = [];
  let skip = false; // inside the "Deliverables" block: shown in its own card
  String(text).split('\n').forEach((line, i) => {
    const t = line.trim();
    if (!t) return;
    if (/^\d+\.\s/.test(t)) { if (!skip) out.push(<p key={i} className="ap-cp-brief-item">{t}</p>); return; }
    const idx = t.indexOf(':');
    if (idx > 0 && idx <= 28) {
      const label = t.slice(0, idx);
      const val = t.slice(idx + 1).trim();
      if (!val) {
        if (/^deliverables$/i.test(label)) { skip = true; return; }
        skip = false;
        out.push(<h3 key={i} className="ap-cp-brief-h">{label}</h3>);
        return;
      }
      skip = false;
      out.push(<div key={i} className="ap-cp-brief-kv"><span>{label}</span><b>{val.split(/\s*;\s*/).filter(Boolean).join('\n')}</b></div>);
      return;
    }
    skip = false;
    out.push(<p key={i} className="ap-cp-p">{t}</p>);
  });
  return <>{out}</>;
}
function extractDeliverables(text) {
  if (!text) return [];
  const items = [];
  let inBlock = false;
  String(text).split('\n').forEach((line) => {
    const t = line.trim();
    if (!t) return;
    const idx = t.indexOf(':');
    const label = idx > 0 && idx <= 28 ? t.slice(0, idx) : '';
    const val = idx > 0 ? t.slice(idx + 1).trim() : '';
    if (label && !val) { inBlock = /^deliverables$/i.test(label); return; }
    if (inBlock && /^\d+\.\s/.test(t)) { items.push(t.replace(/^\d+\.\s*/, '')); return; }
    if (label) inBlock = false;
  });
  return items;
}

// ── Script gate: UGC.ad wrote the script, nothing reaches creators until the brand confirms ──
function ScriptSheet({ campaign, open, onClose, onDone }) {
  const [busy, setBusy] = useState(false);
  const [changes, setChanges] = useState(false);
  const [note, setNote] = useState('');
  useEffect(() => { if (!open) { setChanges(false); setNote(''); } }, [open]);
  const lines = String(campaign?.script_text || '').split(/\n+/).map((l) => l.trim()).filter(Boolean).map((l) => {
    const m = l.match(/^(\d+\s*[–-]\s*\d+\s*s?(?:\s*[·-]\s*[A-Za-z ]{2,14})?)\s*[:—-]\s*(.+)$/);
    return m ? { tag: m[1].trim(), text: m[2].trim() } : { tag: '', text: l };
  });
  const act = async (action) => {
    if (busy) return;
    if (action === 'request_changes' && !note.trim()) { toast.error('Tell the team what to change in the script.'); return; }
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/campaigns/${campaign.id}/script-confirmation`, { action, note: note.trim() || undefined });
      toast.success(data?.message || 'Done');
      onClose();
      onDone?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not submit - try again.');
    } finally { setBusy(false); }
  };
  return (
    <BottomSheet
      open={open}
      onClose={() => !busy && onClose()}
      tall
      title="Your script is ready"
      subtitle="Creators can start bidding once you confirm."
      footer={changes ? (
        <>
          <button type="button" className="ap-btn ap-btn--ghost ap-cp-lg" style={{ flex: 1 }} onClick={() => { setChanges(false); setNote(''); }} disabled={busy}>Back</button>
          <button type="button" className="ap-btn ap-cp-lg" style={{ flex: 1 }} onClick={() => act('request_changes')} disabled={busy}>{busy ? 'Sending…' : 'Send to our team'}</button>
        </>
      ) : (
        <>
          <button type="button" className="ap-btn ap-btn--ghost ap-cp-lg" style={{ flex: 1 }} onClick={() => setChanges(true)} disabled={busy}>Ask for changes</button>
          <button type="button" className="ap-btn ap-cp-lg ap-cp-grad" style={{ flex: 1 }} onClick={() => act('confirm')} disabled={busy}><Check size={18} /> {busy ? 'Publishing…' : 'Looks good'}</button>
        </>
      )}
    >
      {changes ? (
        <label className="ap-label">
          What should change?
          <textarea className="ap-input" rows={5} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Be specific: tone, hook, product points…" />
          <small className="ap-cp-hint">Changes are free. Our team usually updates the script the same day.</small>
        </label>
      ) : (
        <div className="ap-cp-script">
          <p className="ap-cp-p">Our team wrote this script for your brief. Check it, then confirm to send it to creators.</p>
          {lines.length === 0 ? <p className="ap-cp-p">No script text attached. Please contact support.</p> : lines.map((l, i) => (
            <div key={i} className="ap-cp-script-row">
              {l.tag ? <span className="ap-cp-script-tag">{l.tag}</span> : <span className="ap-cp-script-dot" />}
              <div className="ap-card"><div className="ap-cp-script-t">{l.text}</div></div>
            </div>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}

// ── Direct booking, brand side: price proposals and sending the brief ──
function BookingBlock({ campaign, onDone }) {
  const c = campaign;
  const status = c.booking_status;
  const [busy, setBusy] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [brief, setBrief] = useState('');
  const [wallet] = useWalletBalance(status === 'price_revision');
  if (!status || status === 'declined') return null;
  if (status === 'accepted' && c.brief_sent) return null;
  const id = c.id;
  const subtotal = Number(c.budget_max || c.budget_min || 0);
  const proposed = Number(c.proposed_amount || 0);
  const pct = Number(c.fee_percent || 20);

  const call = async (fn) => {
    if (busy) return;
    setBusy(true);
    try { await fn(); onDone?.(); } catch (e) {
      const d = e?.response?.data;
      if (e?.response?.status === 402 && d?.shortfall) toast.error(`${d.detail} Add ${inr(d.shortfall)} to your wallet first.`);
      else toast.error(apiErrorMessage(e, 'Something went wrong'));
    } finally { setBusy(false); }
  };
  const decide = (action) => call(async () => {
    const res = await axios.post(`${API}/bookings/${id}/price`, { action });
    if (action === 'accept') {
      const diff = Number(res.data?.difference_charged || 0);
      toast.success(diff > 0 ? `New price accepted - ${inr(diff)} more was charged from your credits.` : (diff < 0 ? `New price accepted - ${inr(-diff)} was refunded to your wallet.` : 'New price accepted.'));
    } else toast.success('Booking cancelled - you have been refunded in full.');
  });
  const sendBrief = () => call(async () => {
    await axios.post(`${API}/bookings/${id}/brief`, { brief_text: brief });
    toast.success('Brief sent - the work has started.');
    setBriefOpen(false);
  });

  if (status === 'pending_creator') {
    return <div className="ap-cp-note"><Clock size={18} /><span>{inr(Number(c.amount_paid || 0))} is held in escrow. Waiting for the creator to accept. You&rsquo;re refunded in full if they decline.</span></div>;
  }
  if (status === 'price_revision') {
    const diff = Math.round((proposed - subtotal) * (1 + pct / 100));
    return (
      <section className="ap-card ap-cp-price">
        <div className="ap-cp-eyebrow">Price proposal</div>
        <b className="ap-cp-price-t">The creator asked for a new price</b>
        <div className="ap-cp-was">
          <div><small>Was</small><s>{inr(subtotal)}</s></div>
          <ArrowRight size={18} color="#7387ff" aria-hidden="true" />
          <div className="is-now"><small>Now</small><b>{inr(proposed)}</b></div>
        </div>
        {c.proposed_message && <div className="ap-cp-quote"><strong>Why:</strong> &ldquo;{c.proposed_message}&rdquo;</div>}
        <div className="ap-cp-kvs">
          <Row label="New price" value={inr(proposed)} />
          <Row label={`Platform fee ${pct}%`} value={inr(Math.round(proposed * pct / 100))} />
          <Row label={diff >= 0 ? 'Extra from wallet' : 'Refunded to wallet'} value={inr(Math.abs(diff))} />
          {wallet != null && <Row strong label="Wallet after" value={inr(wallet - diff)} />}
        </div>
        <div className="ap-cp-btnrow">
          <button type="button" className="ap-btn ap-btn--ghost ap-cp-lg" style={{ flex: 1 }} onClick={() => decide('reject')} disabled={busy}>Cancel &amp; refund</button>
          <button type="button" className="ap-btn ap-cp-lg" style={{ flex: 1 }} onClick={() => decide('accept')} disabled={busy}>{busy ? 'Working…' : `Accept ${inr(proposed)}`}</button>
        </div>
      </section>
    );
  }
  if (status === 'accepted' && !c.brief_sent) {
    return (
      <>
        <section className="ap-card ap-cp-price">
          <div className="ap-cp-eyebrow">Accepted</div>
          <b className="ap-cp-price-t">Send your brief to start the work</b>
          <p className="ap-cp-p">The creator accepted and is waiting. They can&rsquo;t start until the brief arrives.</p>
          <button type="button" className="ap-btn ap-cp-lg ap-btn--block" onClick={() => { setBrief(c.brief_draft?.brief_text || ''); setBriefOpen(true); }}><FileText size={18} /> Write the brief</button>
        </section>
        <BottomSheet open={briefOpen} onClose={() => !busy && setBriefOpen(false)} title="The brief" tall
          footer={(
            <>
              <button type="button" className="ap-btn ap-btn--ghost ap-cp-lg" style={{ flex: 1 }} onClick={() => setBriefOpen(false)} disabled={busy}>Back</button>
              <button type="button" className="ap-btn ap-cp-lg" style={{ flex: 1 }} onClick={sendBrief} disabled={busy || !brief.trim()}><Send size={16} /> {busy ? 'Sending…' : 'Send brief'}</button>
            </>
          )}>
          <label className="ap-label">
            What should the creator make?
            <textarea className="ap-input" rows={10} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="What should the creator make?" />
            <small className="ap-cp-hint">Pre-filled from what you wrote at checkout. Contact details are not allowed.</small>
          </label>
        </BottomSheet>
      </>
    );
  }
  return null;
}

// ── Videos tab pieces ──
const filesOf = (ws) => {
  if (!ws) return [];
  const labeled = ws.files || [
    ...(ws.edited_files || []).map((url) => ({ kind: 'edited', label: 'Edited video', url })),
    ...(ws.raw_files || []).map((url) => ({ kind: 'raw', label: 'Raw video', url })),
  ];
  if (labeled.length) return labeled;
  return (ws.work_files || []).map((url, i) => ({ kind: `file${i}`, label: (ws.work_files || []).length > 1 ? `File ${i + 1}` : 'Video', url }));
};

function VideoRow({ item, onOpen }) {
  const { ws, st, creator, statusKey } = item;
  const first = filesOf(ws)[0];
  const src = first ? assetUrl(first.url) : '';
  const [dur, setDur] = useState('');
  const name = creator ? creatorFirstName(creator).replace(/^@+/, '') : 'Creator';
  const sub = [ws.stage === 'raw' ? 'Raw cut' : ws.stage === 'edited' ? 'Edited cut' : '', ws.version > 1 ? `v${ws.version}` : '', ws.submitted_at ? fmtDay(ws.submitted_at) : ''].filter(Boolean).join(' · ');
  return (
    <div className="ap-row ap-cp-vrow">
      <button type="button" className="ap-cp-vthumb" onClick={() => onOpen(item)} aria-label={`Open ${name}'s video`}>
        {src ? (isVideoUrl(src)
          ? <video src={`${src}#t=0.5`} muted playsInline preload="metadata" onLoadedMetadata={(e) => setDur(fmtDur(e.target.duration))} />
          : <img src={src} alt="" />) : <FileText size={22} />}
        {src && isVideoUrl(src) && <span className="ap-cp-vplay"><Play size={13} fill="currentColor" /></span>}
        {dur && <span className="ap-cp-vdur">{dur}</span>}
      </button>
      <div className="ap-row-t">
        <b>{name}</b>
        <small>{sub || 'Submitted'}</small>
        <span className={`ap-pill ap-pill--${st.tone}`} style={{ marginTop: 5 }}>{st.label}</span>
      </div>
      {statusKey === 'pending_review' && <button type="button" className="ap-btn ap-btn--sm" onClick={() => onOpen(item)}>Review</button>}
      {statusKey === 'approved' && <button type="button" className="ap-btn ap-btn--sm ap-cp-soft" onClick={() => onOpen(item)}>Open</button>}
      {!['pending_review', 'approved'].includes(statusKey) && <button type="button" className="ap-btn ap-btn--sm ap-cp-soft" onClick={() => onOpen(item)}>View</button>}
    </div>
  );
}

function DealChat({ deal, onSent }) {
  const { user } = useAuth();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const messages = getDealMessages(deal, 'brand', user?.id);
  const listRef = useRef(null);
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages.length]);
  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await axios.post(`${API}/deals/${deal.deal_id}/chat`, { message: body, attachment_urls: [] });
      setText('');
      await onSent?.();
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Could not send message');
    } finally { setSending(false); }
  };
  return (
    <section className="ap-card">
      <h2 className="ap-card-h">Deal chat</h2>
      <p className="ap-cp-hint">Shared with the creator. Status updates from the platform appear here too.</p>
      <div className="ap-cp-chat" ref={listRef}>
        {messages.length ? messages.map((m) => (
          <div key={m.id} className={`ap-cp-msg ${m.sender_type === 'system' ? 'is-system' : m.sender_type === 'creator' ? 'is-creator' : 'is-brand'}`}>
            {m.sender_type !== 'system' && <small>{m.sender_name}</small>}
            <p>{m.message}</p>
          </div>
        )) : <p className="ap-cp-hint" style={{ textAlign: 'center', padding: '14px 0' }}>No messages yet. Say hello, or answer the creator&rsquo;s questions about the brief.</p>}
      </div>
      <div className="ap-cp-chatin">
        <input className="ap-input" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder="Type a message" aria-label="Message" />
        <button type="button" className="ap-btn" onClick={send} disabled={sending || !text.trim()} aria-label="Send"><Send size={18} /></button>
      </div>
    </section>
  );
}

function CampaignDetail() {
  // The app layer renders this screen outside a <Route>, so :id is read from the URL when useParams has none.
  const { pathname } = useLocation();
  const params = useParams();
  const id = params.id || matchPath('/dashboard/business/campaign/:id', pathname)?.params.id;
  const [searchParams] = useSearchParams();
  const requestedCreatorId = searchParams.get('creator');
  const { user } = useAuth();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [deals, setDeals] = useState([]);
  const [creators, setCreators] = useState([]);
  const [activeCreatorId, setActiveCreatorId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('overview');
  const [menu, setMenu] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [myReviews, setMyReviews] = useState({});   // creator id -> this brand's review
  const [rateFor, setRateFor] = useState(null);
  const [works, setWorks] = useState({});           // multi-creator: creator id -> work submission
  const [viewing, setViewing] = useState(null);     // a video item open in the review sheet
  const [fileIdx, setFileIdx] = useState(0);
  const [approveAsk, setApproveAsk] = useState(false);
  const [approving, setApproving] = useState(false);
  const [reviseFor, setReviseFor] = useState(null);

  const creator = creators.find((c) => String(c?.id) === String(activeCreatorId)) || creators[0] || null;
  const deal = findCreatorDeal(deals, id, creator?.id);

  const load = useCallback(async () => {
    try {
      const cRes = await axios.get(`${API}/campaigns/${id}`);
      setCampaign(cRes.data);
      setLoadError('');
      // Brands read /deals/business (one deal PER hired creator); /deals/my is the creator's list.
      const dRes = await axios.get(`${API}/deals/business`).catch(() => ({ data: [] }));
      setDeals((dRes.data || []).filter((x) => String(x.campaign?.id) === String(id)));
      const ids = selectedCreators(cRes.data);
      if (ids.length) {
        const profiles = await Promise.all(ids.map((cid) => axios.get(`${API}/profile/${cid}`).then((r) => ({ id: cid, ...r.data })).catch(() => ({ id: cid }))));
        setCreators(profiles);
        setActiveCreatorId((prev) => (requestedCreatorId && ids.includes(requestedCreatorId) ? requestedCreatorId : prev && ids.includes(prev) ? prev : profiles[0]?.id || null));
      } else { setCreators([]); setActiveCreatorId(null); }
    } catch (err) {
      setLoadError(err?.response?.status === 404 || err?.response?.status === 403 ? 'notfound' : (apiErrorMessage(err, '') || 'network'));
    } finally { setLoading(false); }
  }, [id, requestedCreatorId]);

  useLiveEffect(() => { load(); }, [load]);

  // This brand's review of each hired creator ("Rate" vs "You rated 5").
  const creatorKey = creators.map((c) => c.id).join(',');
  useLiveEffect(() => {
    if (!creators.length) { setMyReviews({}); return undefined; }
    let live = true;
    Promise.all(creators.map((c) => axios.get(`${API}/reviews/creator/${c.id}`).then((r) => r.data).catch(() => [])
      .then((revs) => [c.id, (Array.isArray(revs) ? revs : []).find((rv) => String(rv.campaign_id) === String(id) && String(rv.reviewer_id) === String(user?.id)) || null])))
      .then((pairs) => { if (live) setMyReviews(Object.fromEntries(pairs.filter(([, v]) => v))); });
    return () => { live = false; };
  }, [creatorKey, id, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Multi-creator: each creator has their own submission. Single creator uses campaign.work_submission.
  useLiveEffect(() => {
    if (creators.length <= 1) { setWorks({}); return undefined; }
    let live = true;
    Promise.all(creators.map((c) => axios.get(`${API}/work/campaign/${id}?creator_id=${encodeURIComponent(c.id)}`).then((r) => r.data).catch(() => null)
      .then((w) => [c.id, w && w.id ? w : null])))
      .then((pairs) => { if (live) setWorks(Object.fromEntries(pairs.filter(([, v]) => v))); });
    return () => { live = false; };
  }, [creatorKey, id]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = useBidActions(() => load());

  const refresh = async () => { try { const r = await axios.get(`${API}/campaigns/${id}`); setCampaign(r.data); } catch { /* keep what is on screen */ } };

  if (loading) {
    return (
      <AppShell title="Campaign" back={backOr(ROUTES.campaigns)}>
        <div className="ap-cp-page"><SkelCards n={1} h={150} /><SkelCards n={1} h={130} /><SkelCards n={2} h={100} /></div>
      </AppShell>
    );
  }
  if (!campaign) {
    return (
      <AppShell title="Campaign" back={backOr(ROUTES.campaigns)}>
        <div className="ap-cp-page">
          {loadError === 'notfound' ? (
            <div className="ap-empty">
              <h3>Campaign not found</h3>
              <p>It may have been removed, or it belongs to a different brand account.</p>
              <button type="button" className="ap-btn" onClick={() => navigate(ROUTES.campaigns)}>Back to campaigns</button>
            </div>
          ) : <ErrorState title={'Couldn’t load this campaign'} message={loadError && loadError !== 'network' ? loadError : 'Check your connection and try again.'} onRetry={() => { setLoading(true); load(); }} />}
        </div>
      </AppShell>
    );
  }

  const isDraft = campaign.status === 'draft';
  const bids = Array.isArray(campaign.bids) ? campaign.bids : [];
  const hiredIds = selectedCreators(campaign);
  const wanted = creatorsWanted(campaign);
  const openSlots = slotsLeft(campaign);
  const openBids = bids.filter((b) => !hiredIds.includes(String(b.creator_id)) && !['declined', 'rejected'].includes(String(b.status || '').toLowerCase()));
  const ship = deal?.shipment || {};
  const rec = deal?.receipt || {};
  const shipped = !!(ship.shipped_at || ['shipped', 'in_transit', 'delivered'].includes(ship.courier_status));
  const delivered = !!(rec.received_at || ship.delivered_at || ship.courier_status === 'delivered');
  const creatorSelected = !!(campaign.selected_creator || creator?.id || deal?.creator?.id);
  const shippingAllowed = !['rejected', 'cancelled', 'banned'].includes(campaign.status) && campaign.booking_status !== 'declined';
  const requiresShipHere = Boolean(campaign.requires_shipment || ship.required);
  const dealIdxNow = deal ? dealStateIndex(deal.current_state) : -1;
  const baseStage = campaignStage(campaign, shipped);
  const stageIdx = dealIdxNow >= 6 ? 5 : dealIdxNow >= 4 ? 4 : dealIdxNow >= 3 ? 3 : dealIdxNow >= 1 ? 2 : baseStage.idx;
  const badge = statusBadge(campaign.status);
  const creatorName = creator ? creatorFirstName(creator).replace(/^@+/, '') : 'the creator';
  const budgetMax = Number(campaign.budget_max || campaign.per_video_budget || 0);
  const deliverList = (() => {
    const own = String(campaign.deliverables || '').split(/[\n;]+/).map((s) => s.trim()).filter(Boolean);
    return own.length ? own : extractDeliverables(campaign.brief_text);
  })();
  const dealFor = (cid) => findCreatorDeal(deals, id, cid);
  const escrowOf = (d) => Number(d?.escrow_amount ?? d?.escrow?.held_amount ?? d?.escrow?.amount ?? 0) || 0;

  // Submissions per creator (multi) or the campaign-level one (single).
  const wsOf = (c) => (creators.length > 1 ? works[c.id] : campaign.work_submission) || null;
  const statusOfWs = (ws) => (!ws ? null
    : ws.status === 'awaiting_edit' ? 'awaiting_edit'
    : ws.status === 'approved' && ws.stage === 'raw' && editModeOf(campaign) === 'creator' ? 'awaiting_edited'
    : (ws.status || (campaign.status === 'completed' ? 'approved' : 'pending_review')));
  const videoItems = (creators.length ? creators : [null]).map((c) => {
    const ws = c ? wsOf(c) : campaign.work_submission;
    if (!ws) return null;
    const statusKey = statusOfWs(ws);
    return { ws, creator: c, statusKey, st: WS_STATUS[statusKey] || WS_STATUS.pending_review };
  }).filter(Boolean);
  const pendingReview = videoItems.filter((v) => v.statusKey === 'pending_review');
  const dealCompletedFor = (c) => {
    const ws = c ? wsOf(c) : null;
    return statusOfWs(ws) === 'approved' || campaign.status === 'completed' || dealStateIndex(dealFor(c?.id)?.current_state) >= 6;
  };

  // "Your turn" banner
  let turn = null;
  if (campaign.status === 'awaiting_brand_confirmation') {
    turn = { title: 'Your script is ready', sub: 'Creators can start bidding once you confirm.', cta: 'Review script', run: () => setScriptOpen(true), icon: FileText };
  } else if (!isDraft) {
    if (stageIdx === 1 && openBids.length > 0) {
      turn = { title: 'Pick a creator', sub: `${openBids.length} creator${openBids.length === 1 ? '' : 's'} applied. You’re only charged when you pick someone.`, cta: 'Compare bids', run: () => navigate(ROUTES.bids), icon: Star };
    } else if (stageIdx === 2 && requiresShipHere && creatorSelected && !shipped) {
      turn = { title: `Ship the product to ${creatorName}`, sub: 'Filming starts as soon as it arrives.', cta: 'Ship product', run: () => navigate(`${ROUTES.shipments}?campaign=${encodeURIComponent(id)}`), icon: Truck };
    } else if (stageIdx === 4 && pendingReview.length) {
      turn = { title: 'Review the delivery', sub: 'Approve to release payment, or ask for changes.', cta: 'Review', run: () => { setTab('videos'); setViewing(pendingReview[0]); setFileIdx(0); }, icon: Play };
    }
  }

  // ── actions ──
  const resolveWorkId = async (cid) => {
    const qs = creators.length > 1 && cid ? `?creator_id=${encodeURIComponent(cid)}` : '';
    const r = await axios.get(`${API}/work/campaign/${id}${qs}`).catch(() => null);
    return r?.data?.id || null;
  };
  const approveWork = async () => {
    if (!viewing || approving) return;
    setApproving(true);
    try {
      const wid = await resolveWorkId(viewing.creator?.id);
      if (!wid) { toast.error('No submitted work to approve yet'); return; }
      const { data } = await axios.post(`${API}/work/${wid}/approve`);
      toast.success(data?.payout_status === 'awaiting_edited'
        ? 'Raw video approved - the creator will submit the edited video next'
        : viewing.ws?.stage === 'raw' && editModeOf(campaign) === 'ugc'
          ? 'Raw video approved - creator paid, UGC.ad is editing it'
          : 'Approved - payment released to the creator');
      setApproveAsk(false); setViewing(null);
      await load();
    } catch (e) { toast.error(apiErrorMessage(e, 'Failed to approve')); } finally { setApproving(false); }
  };
  const downloadWork = async (item, asset) => {
    try {
      const wid = await resolveWorkId(item.creator?.id);
      if (!wid) { toast.error('No submitted work to download yet'); return; }
      await downloadDeliverable(API, wid, campaign.title, asset);
    } catch (e) {
      toast.error(e?.response?.status === 403 ? 'Download unlocks after you approve the work' : 'Could not download the deliverable');
    }
  };
  const submitReview = async ({ rating, review }) => {
    const cid = rateFor?.id;
    if (!cid) { toast.error('No creator to review'); return false; }
    try {
      await axios.post(`${API}/reviews`, { campaign_id: id, creator_id: cid, rating, review });
      setMyReviews((p) => ({ ...p, [cid]: { campaign_id: id, creator_id: cid, reviewer_id: user?.id, rating, review } }));
      setRateFor(null);
      toast.success('Review submitted - thanks for the feedback!');
      return true;
    } catch (e) { toast.error(apiErrorMessage(e, 'Could not submit your review')); return false; }
  };

  const tabs = [
    ['overview', 'Overview', null],
    ['bids', 'Bids', openBids.length || null],
    ['creators', 'Creators', creators.length || null],
    ['videos', 'Videos', videoItems.length || null],
    ['about', 'Brief', null],
  ];
  const headSub = [
    wanted > 1 ? `${wanted} creators` : '1 creator',
    budgetMax ? `up to ${inr(budgetMax)} per video` : '',
  ].filter(Boolean).join(' · ');
  const endsOn = fmtDay(campaign.due_date || campaign.deadline);
  const fileList = viewing ? filesOf(viewing.ws) : [];
  const curFile = fileList[Math.min(fileIdx, Math.max(0, fileList.length - 1))];
  const curSrc = curFile ? assetUrl(curFile.url) : '';

  return (
    <AppShell
      title={campaign.title || 'Campaign'}
      back={backOr(ROUTES.campaigns)}
      right={<button type="button" className="ap-bar-btn" aria-label="More actions" onClick={() => setMenu(true)}><MoreHorizontal size={22} /></button>}
    >
      <div className="ap-cp-page">
        <OfflineStrip />

        {/* header + progress */}
        <section className="ap-card ap-cp-dhead">
          <div className="ap-cp-dhead-top">
            <Thumb src={campaignThumb(campaign)} name={campaign.title} w={56} h={72} r={14} />
            <div className="ap-cp-grow">
              <b>{campaign.title}</b>
              <small>{isDraft ? (draftTotalBudget(campaign) ? `Budget ${inr(draftTotalBudget(campaign))}` : 'Budget not set yet') : headSub}</small>
              <small>CMP-{String(campaign.id || '').slice(-6).toUpperCase()} &middot; {isDraft ? 'Created' : 'Launched'} {fmtDate(campaign.createdAt || campaign.created_at)}</small>
            </div>
            <span className={`ap-pill ap-pill--${badge.tone}`}>{badge.label}</span>
          </div>
          {!isDraft && (
            <>
              <div className="ap-cp-stephead">
                <strong>Step {stageIdx + 1} of {STAGE_LABELS.length} &middot; {campaign.status === 'completed' ? 'Done' : STAGE_LABELS[stageIdx]}</strong>
                {endsOn && <span>Ends {endsOn}</span>}
              </div>
              <StageBar idx={stageIdx} completed={campaign.status === 'completed'} label="Campaign progress" />
            </>
          )}
        </section>

        {isDraft && (
          <section className="ap-card">
            <h2 className="ap-card-h">This campaign is a draft</h2>
            <p className="ap-cp-p">Edit it to finish the brief, then publish it to send it to our team for review and on to creators.</p>
            <button type="button" className="ap-btn ap-cp-lg" style={{ marginTop: 14 }} onClick={() => navigate(`${ROUTES.post}?draft=${encodeURIComponent(id)}`)} data-testid="edit-draft-btn"><Pencil size={16} /> Edit draft</button>
          </section>
        )}

        {turn && (
          <section className="ap-hero ap-cp-turn" style={{ borderRadius: 22, padding: 18 }}>
            <div className="ap-cp-eyebrow ap-cp-eyebrow--light">{campaign.status === 'awaiting_brand_confirmation' ? 'NEEDS YOUR OK' : 'YOUR TURN'}</div>
            <div className="ap-cp-turn-row">
              <span className="ap-cp-turn-ic"><turn.icon size={20} /></span>
              <div><b>{turn.title}</b><small>{turn.sub}</small></div>
            </div>
            <button type="button" className="ap-btn ap-btn--light ap-cp-lg ap-btn--block" onClick={turn.run}>{turn.cta}</button>
          </section>
        )}

        <BookingBlock campaign={deal?.campaign || campaign} onDone={load} />

        {/* underline tabs */}
        <div className="ap-cp-tabs" role="tablist" aria-label="Campaign sections">
          {tabs.map(([k, l, n]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'is-on' : ''} onClick={() => setTab(k)}>
              {l}{n ? <span>{n}</span> : null}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <>
            <div className="ap-sec-h"><h2>{creators.length > 1 ? 'Hired creators' : 'Hired creator'}</h2>{creators.length > 0 && <span className="ap-cp-aside">{hiredIds.length} of {wanted}</span>}</div>
            {creators.length ? creators.map((c) => {
              const d = dealFor(c.id);
              const nm = creatorFirstName(c).replace(/^@+/, '');
              const bid = bids.find((b) => String(b.creator_id) === String(c.id));
              const sub = [d?.current_state ? dealStateText(d.current_state) : '', bid?.estimated_delivery_days ? `${bid.estimated_delivery_days}-day delivery` : ''].filter(Boolean).join(' · ');
              return (
                <div key={c.id} className="ap-card ap-cp-hcard">
                  <button type="button" className="ap-cp-hcard-main" onClick={() => { setActiveCreatorId(c.id); setTab('creators'); }}>
                    <Avatar src={creatorPhoto(c)} name={nm} size={46} />
                    <span className="ap-cp-grow">
                      <b>{nm}{c.kyc_verified && <BadgeCheck size={15} color="#4e60e6" aria-label="Identity verified" />}</b>
                      <small>{sub || 'Hired'}</small>
                    </span>
                  </button>
                  <button type="button" className="ap-cp-circ" aria-label={`Chat with ${nm}`} onClick={() => navigate(ROUTES.chat(c.id))}><MessageCircle size={18} /></button>
                </div>
              );
            }) : (
              <div className="ap-card"><p className="ap-cp-p" style={{ margin: 0 }}>{openBids.length ? 'No creator picked yet.' : 'No creator selected yet, and no bids have come in.'}</p></div>
            )}

            {openSlots > 0 && !isDraft && (openBids.length > 0 || hiredIds.length > 0) && (
              <section className="ap-card">
                <div className="ap-cp-slot">
                  <div className="ap-cp-grow">
                    <div className="ap-cp-eyebrow ap-cp-eyebrow--warn">{openSlots} SLOT{openSlots === 1 ? '' : 'S'} LEFT</div>
                    <b>{openBids.length ? `${openBids.length} bid${openBids.length === 1 ? '' : 's'}${Math.min(...openBids.map((b) => Number(b.amount) || Infinity)) < Infinity ? ` · from ${inr(Math.min(...openBids.map((b) => Number(b.amount) || Infinity)))}` : ''}` : 'Waiting for more creators to apply'}</b>
                  </div>
                  <span className="ap-cp-stack">{openBids.slice(0, 3).map((b) => <Avatar key={b.id || b.creator_id} src={b.creator_photo || b.profile_photo} name={bidFirstName(b)} size={30} />)}</span>
                </div>
                <div className="ap-cp-btnrow">
                  {openBids.length > 0 && <button type="button" className="ap-btn ap-cp-lg" style={{ flex: 1 }} onClick={() => navigate(ROUTES.bids)}>Compare bids</button>}
                  {hiredIds.length > 0 && <button type="button" className="ap-btn ap-btn--ghost ap-cp-lg" style={{ flex: 1 }} onClick={() => act.finish(campaign)} data-testid="finish-hiring-btn">Finish with {hiredIds.length}</button>}
                </div>
              </section>
            )}

            {shippingAllowed && requiresShipHere && !isDraft && (
              <section className="ap-card">
                <div className="ap-cp-cardh">
                  <h2 className="ap-card-h" style={{ margin: 0 }}>Shipping</h2>
                  <span className={`ap-pill ap-pill--${delivered ? 'ok' : shipped ? '' : 'warn'}`}>{delivered ? 'Delivered' : shipped ? 'In transit' : 'Ready to ship'}</span>
                </div>
                <div className="ap-cp-kvs">
                  <Row label="Courier" value={ship.courier || '—'} />
                  <Row label="Ship by" value={ship.ship_by || campaign.ship_by ? fmtDate(ship.ship_by || campaign.ship_by) : '—'} />
                  <Row label="Tracking ID" value={ship.tracking_id || '—'} />
                  {delivered && <Row label="Delivered on" value={fmtDate(rec.received_at || ship.delivered_at)} />}
                </div>
                {!delivered && (creatorSelected
                  ? <button type="button" className="ap-btn ap-btn--ghost ap-btn--block" data-testid="add-shipment-btn" onClick={() => navigate(`${ROUTES.shipments}?campaign=${encodeURIComponent(id)}`)}><Truck size={16} /> {shipped ? 'Update shipment details' : 'Add shipment details'}</button>
                  : <p className="ap-cp-hint">Select a creator to add shipment details.</p>)}
                <p className="ap-cp-hint">We create a pre-paid label for you. The creator&rsquo;s address stays private.</p>
              </section>
            )}

            <section className="ap-card">
              <h2 className="ap-card-h">Deliverables</h2>
              <ol className="ap-cp-dl">
                {(deliverList.length ? deliverList : ['1 UGC video as described in the brief']).map((d, i) => <li key={i}><span>{i + 1}</span><b>{d}</b></li>)}
              </ol>
            </section>

            {!isDraft && creators.length > 0 && campaign.status !== 'completed' && (
              <div className="ap-cp-note ap-cp-note--ok"><ShieldCheck size={20} /><span>
                <b>{escrowOf(deal) ? `${inr(escrowOf(deal))} held safely${creators.length === 1 ? ` for ${creatorName}` : ''}` : 'Payment is held safely in escrow'}</b>
                <br />Released only when you approve the video
              </span></div>
            )}
          </>
        )}

        {tab === 'bids' && (
          <>
            {openBids.length === 0 ? (
              <div className="ap-empty">
                <h3>{hiredIds.length ? 'No more pending bids' : 'No bids yet'}</h3>
                <p>{openSlots > 0 ? `Creators usually start bidding within a day. ${openSlots} slot${openSlots === 1 ? '' : 's'} still open.` : 'This brief is fully staffed.'}</p>
                {hiredIds.length > 0 && openSlots > 0 && <button type="button" className="ap-btn ap-btn--ghost" onClick={() => act.finish(campaign)}>Finish with {hiredIds.length}</button>}
              </div>
            ) : (
              <>
                <p className="ap-cp-hint">{hiredIds.length > 0 ? `${hiredIds.length} of ${wanted} hired · ${openSlots} slot${openSlots === 1 ? '' : 's'} left · ` : `Pick up to ${wanted} · `}you&rsquo;re only charged when you pick someone.</p>
                <div className="ap-card ap-cp-bidlist">
                  {openBids.map((b) => {
                    const nm = bidFirstName(b);
                    const split = bidSplitLabel(b);
                    return (
                      <div key={b.id || b.creator_id} className="ap-row">
                        <Avatar src={b.creator_photo || b.profile_photo} name={nm} size={40} />
                        <div className="ap-row-t">
                          <b><button type="button" className="ap-cp-namebtn" onClick={() => navigate(ROUTES.creator(b.creator_id))}>{nm}</button></b>
                          <small>{b.estimated_delivery_days ? `${b.estimated_delivery_days}-day delivery` : 'Delivery not specified'}{split ? ` · ${split}` : ''}</small>
                        </div>
                        <div className="ap-cp-bidamt"><b>{inr(b.amount)}</b>
                          <span>
                            <button type="button" className="ap-cp-textbtn" onClick={() => act.decline(campaign, b)}>Decline</button>
                            <button type="button" className="ap-btn ap-btn--sm" onClick={() => act.hire(campaign, b)}>Accept</button>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <button type="button" className="ap-btn ap-btn--ghost ap-btn--block" onClick={() => navigate(ROUTES.bids)}>Compare all bids</button>
              </>
            )}
          </>
        )}

        {tab === 'creators' && (
          creators.length === 0 ? (
            <div className="ap-empty"><h3>No creators hired yet</h3><p>Once you accept a bid, the creator shows up here with their deal status.</p>{openBids.length > 0 && <button type="button" className="ap-btn" onClick={() => navigate(ROUTES.bids)}>Compare bids</button>}</div>
          ) : creators.map((c) => {
            const nm = creatorFirstName(c).replace(/^@+/, '');
            const cp = c.profile || {};
            const bid = bids.find((b) => String(b.creator_id) === String(c.id));
            const d = dealFor(c.id);
            const rating = Number(c.avg_rating || c.rating || 0);
            const reviews = Number(c.review_count || 0);
            const line = [(cp.category || c.primary_category || '').replace(/_/g, ' '), Array.isArray(cp.languages) && cp.languages.length ? cp.languages.slice(0, 2).join(', ') : '', safeText(cp.city || cp.location_region || c.city_tier)].filter(Boolean).join(' · ') || 'UGC creator';
            const mine = myReviews[c.id];
            return (
              <section key={c.id} className="ap-card ap-cp-ccard">
                <div className="ap-cp-ccard-top">
                  <Avatar src={creatorPhoto(c)} name={nm} size={56} />
                  <div className="ap-cp-grow">
                    <b>{nm}</b>
                    <small>{c.ugcad_approved ? 'UGCAD.IO Choice' : fmtLevel(safeText(c.level_label || c.level, 'New'))}</small>
                    {rating > 0 && reviews > 0 && <small><Star size={12} fill="currentColor" /> <strong>{rating.toFixed(1)}</strong> ({reviews})</small>}
                    <small>{line}</small>
                  </div>
                </div>
                <div className="ap-cp-kvs">
                  {d?.current_state && <Row label="Status" value={dealStateText(d.current_state)} />}
                  {bid?.amount ? <Row label="Agreed" value={`${inr(bid.amount)} / video`} /> : null}
                </div>
                <div className="ap-cp-btnrow">
                  <button type="button" className="ap-btn ap-btn--ghost" style={{ flex: 1 }} onClick={() => c.id && navigate(ROUTES.creator(c.id))}>View profile</button>
                  <button type="button" className="ap-btn" style={{ flex: 1 }} onClick={() => navigate(ROUTES.chat(c.id))}><MessageCircle size={16} /> Chat</button>
                </div>
                {dealCompletedFor(c) && (mine
                  ? <p className="ap-cp-rated"><Star size={15} fill="#f5b301" color="#f5b301" /> You rated {mine.rating}&#9733;</p>
                  : <button type="button" className="ap-btn ap-btn--ghost ap-btn--block" onClick={() => setRateFor(c)}><Star size={16} /> Add a review</button>)}
              </section>
            );
          })
        )}

        {tab === 'videos' && (
          <>
            {videoItems.length === 0 ? (
              <div className="ap-empty">
                <h3>Nothing to review yet</h3>
                <p>Once the creator submits their content, it will appear here for you to review and approve.</p>
              </div>
            ) : (
              <>
                <div className="ap-cp-vsum"><span><strong>{videoItems.length} of {creators.length || 1}</strong> video{videoItems.length === 1 ? '' : 's'} in{pendingReview.length ? ` · ${pendingReview.length} to review` : ''}</span></div>
                <div className="ap-card ap-cp-vlist">
                  {videoItems.map((it) => <VideoRow key={it.creator?.id || 'one'} item={it} onOpen={(item) => { setViewing(item); setFileIdx(0); }} />)}
                </div>
              </>
            )}
            {videoItems.map((it) => {
              const d = dealFor(it.creator?.id) || deal;
              const rev = d?.revision_tracker || {};
              if (!(rev.latest_feedback || rev.requested_changes?.length)) return null;
              const items = revisionItems(rev);
              const ANSWER = {
                accepted: { cls: 'ok', text: 'Creator accepted the revision and is reworking the content.' },
                scope_creep: { cls: 'bad', text: 'Creator says these changes go beyond the brief. Nothing is disputed yet. Reply in the deal chat below to agree what is in scope.' },
                partial_dispute: { cls: 'bad', text: 'Creator accepted some changes and pushed back on the rest. Nothing is disputed yet. Reply in the deal chat below to settle the remaining items.' },
              };
              const a = ANSWER[rev.creator_response];
              return (
                <section key={`rev-${it.creator?.id || 'one'}`} className="ap-card">
                  <div className="ap-cp-cardh"><h2 className="ap-card-h" style={{ margin: 0 }}><RefreshCw size={15} /> Revision requested</h2><span className="ap-pill ap-pill--muted">{rev.revision_count_used || 0} of {rev.revision_limit || 0} used</span></div>
                  <p className="ap-cp-eyebrow">CHANGES YOU ASKED FOR</p>
                  {items.length ? <ul className="ap-cp-revlist">{items.map((r, i) => <li key={i}>{r.severity && <span className="ap-pill ap-pill--warn">{r.severity}</span>}<span>{r.text}</span>{r.ref && <em>ref: {r.ref}</em>}</li>)}</ul> : <p className="ap-cp-hint">No specific items were listed.</p>}
                  <div className="ap-cp-kvs"><Row label="New deadline" value={rev.new_deadline_at ? new Date(rev.new_deadline_at).toLocaleString() : 'Not scheduled'} /></div>
                  <p className={`ap-cp-ans ${a ? a.cls : 'wait'}`}>{a ? a.text : 'Waiting for the creator to respond to this revision request.'}</p>
                </section>
              );
            })}
            {deal?.deal_id && <DealChat key={`${deal.deal_id}:${creator?.id}`} deal={deal} onSent={load} />}
            {(campaign.rights_duration || (campaign.usage_platforms || []).length > 0) && (
              <section className="ap-card">
                <h2 className="ap-card-h">Usage rights</h2>
                <p className="ap-cp-p" style={{ margin: 0 }}>
                  {campaign.rights_duration ? <><strong>{campaign.rights_duration}</strong> of use</> : 'Usage'}
                  {(campaign.usage_platforms || []).length ? ` on ${(campaign.usage_platforms || []).join(', ')}` : ''}.
                  {campaign.exclusivity && campaign.exclusivity !== 'None' ? ` Exclusivity: ${campaign.exclusivity}.` : ''}
                </p>
              </section>
            )}
          </>
        )}

        {tab === 'about' && (
          <section className="ap-card ap-cp-brief" aria-label="About campaign">
            <BriefRows text={campaign.brief_text} />
          </section>
        )}
      </div>

      {act.node}

      {/* more actions */}
      <BottomSheet open={menu} onClose={() => setMenu(false)} title="Campaign">
        <div className="ap-more">
          <button type="button" className="ap-more-row" onClick={() => { setMenu(false); setTab('about'); }}><FileText size={20} /> <span>View brief</span></button>
          <button type="button" className="ap-more-row" onClick={() => { setMenu(false); setDupOpen(true); }}><Copy size={20} /> <span>Duplicate campaign</span></button>
          {openBids.length > 0 && <button type="button" className="ap-more-row" onClick={() => { setMenu(false); navigate(ROUTES.bids); }}><ChevronRight size={20} /> <span>Compare bids</span></button>}
          {creator && <button type="button" className="ap-more-row" onClick={() => { setMenu(false); navigate(ROUTES.chat(creator.id)); }}><MessageCircle size={20} /> <span>Message {creatorName}</span></button>}
        </div>
      </BottomSheet>

      <BottomSheet
        open={dupOpen}
        onClose={() => setDupOpen(false)}
        title="Duplicate this campaign?"
        subtitle="We copy the brief, deliverables and budget into a new brief you can edit before publishing."
        footer={(
          <>
            <button type="button" className="ap-btn ap-cp-soft ap-cp-lg" style={{ flex: 1 }} onClick={() => setDupOpen(false)}>Cancel</button>
            <button type="button" className="ap-btn ap-cp-lg" style={{ flex: 1 }} onClick={() => { setDupOpen(false); navigate(`${ROUTES.post}?duplicate=${encodeURIComponent(id)}`); }}><Plus size={16} /> Open copy</button>
          </>
        )}
      >
        <div className="ap-cp-note"><Info size={18} /><span>Nothing is created until you publish the copy. The original stays as it is.</span></div>
      </BottomSheet>

      <ScriptSheet campaign={campaign} open={scriptOpen} onClose={() => setScriptOpen(false)} onDone={load} />

      {/* video review */}
      <BottomSheet
        open={!!viewing && !reviseFor}
        onClose={() => { if (!approving) { setViewing(null); setApproveAsk(false); } }}
        tall
        title={viewing ? `${viewing.creator ? creatorFirstName(viewing.creator).replace(/^@+/, '') : 'Creator'}’s video` : ''}
        subtitle={viewing?.ws?.submitted_at ? `Submitted ${fmtDate(viewing.ws.submitted_at)}${viewing.ws.version > 1 ? ` · version ${viewing.ws.version}` : ''}` : undefined}
        footer={viewing ? (viewing.statusKey === 'pending_review' ? (
          <>
            <button type="button" className="ap-btn ap-btn--ghost ap-cp-lg" style={{ flex: 1 }} onClick={() => setReviseFor(viewing)}>Ask for changes</button>
            <button type="button" className="ap-btn ap-cp-lg ap-cp-grad" style={{ flex: 1 }} onClick={() => setApproveAsk(true)}><Check size={18} /> {viewing.ws.stage === 'raw' && editModeOf(campaign) ? 'Approve raw' : 'Approve & pay'}</button>
          </>
        ) : viewing.statusKey === 'approved' ? (
          <>
            <button type="button" className="ap-btn ap-btn--ghost ap-cp-lg" style={{ flex: 1 }} onClick={() => viewing.creator && navigate(ROUTES.chat(viewing.creator.id))}>Message</button>
            <button type="button" className="ap-btn ap-cp-lg" style={{ flex: 1 }} onClick={() => downloadWork(viewing, fileList.length > 1 ? curFile?.kind : undefined)}><Download size={18} /> Download</button>
          </>
        ) : (
          <button type="button" className="ap-btn ap-btn--ghost ap-cp-lg ap-btn--block" onClick={() => viewing.creator && navigate(ROUTES.chat(viewing.creator.id))}>Message creator</button>
        )) : null}
      >
        {viewing && (
          <>
            <div className="ap-cp-player">
              {curSrc ? (isVideoUrl(curSrc) ? <video key={curSrc} src={curSrc} controls playsInline preload="metadata" /> : <img src={curSrc} alt="" />) : <div className="ap-cp-noplay"><FileText size={32} /><span>No file attached</span></div>}
              {viewing.statusKey !== 'approved' && curSrc && <span className="ap-cp-wm" aria-hidden="true">UGC.ad preview</span>}
            </div>
            {fileList.length > 1 && (
              <div className="ap-chips" style={{ marginTop: 10 }}>
                {fileList.map((f, i) => <button key={`${f.kind}-${i}`} type="button" className={`ap-chip${i === fileIdx ? ' is-on' : ''}`} onClick={() => setFileIdx(i)}>{f.label}</button>)}
              </div>
            )}
            <div className="ap-cp-kvs" style={{ marginTop: 12 }}>
              <Row label="Status" value={viewing.st.label} />
              {viewing.ws.stage && <Row label="Stage" value={viewing.ws.stage === 'raw' ? 'Raw cut' : 'Edited cut'} />}
            </div>
            {viewing.statusKey !== 'approved' && <p className="ap-cp-hint">The watermark disappears after you approve. Downloads unlock after approval.</p>}
          </>
        )}
      </BottomSheet>

      <BottomSheet
        open={approveAsk}
        onClose={() => !approving && setApproveAsk(false)}
        title="Approve & release payment?"
        footer={(
          <>
            <button type="button" className="ap-btn ap-cp-soft ap-cp-lg" style={{ flex: 1 }} onClick={() => setApproveAsk(false)} disabled={approving}>Not yet</button>
            <button type="button" className="ap-btn ap-cp-lg" style={{ flex: 1 }} onClick={approveWork} disabled={approving}>{approving ? 'Approving…' : 'Approve'}</button>
          </>
        )}
      >
        <p className="ap-cp-p">{viewing?.ws?.stage === 'raw' && editModeOf(campaign) ? 'You approve the raw video; the edited cut comes next.' : 'The creator is paid from escrow and you can download the clean video.'}</p>
      </BottomSheet>

      <RevisionSheet
        key={reviseFor ? `rev-${reviseFor.creator?.id || 'one'}` : 'rev-none'}
        open={!!reviseFor}
        onClose={() => setReviseFor(null)}
        fees={(() => {
          const t = (dealFor(reviseFor?.creator?.id) || deal)?.revision_tracker;
          return { freeRemaining: t?.free_revisions_remaining, nextFee: t?.next_revision_fee, paidFee: t?.paid_revision_fee };
        })()}
        onSubmit={async (payload) => {
          const wid = await resolveWorkId(reviseFor?.creator?.id);
          if (!wid) throw new Error('No submitted work to revise');
          const { data } = await axios.post(`${API}/work/${wid}/request-revision`, payload);
          toast.success(data?.paid ? `Revision requested - ₹${data.fee_charged} charged. Wallet balance: ₹${Math.round(data.new_balance)}.` : 'Revision requested');
          setReviseFor(null); setViewing(null);
          refresh(); load();
        }}
      />

      <RateSheet key={rateFor ? `rate-${rateFor.id}` : 'rate-none'} open={!!rateFor} name={rateFor ? creatorFirstName(rateFor).replace(/^@+/, '') : ''} onClose={() => setRateFor(null)} onSubmit={submitReview} />
    </AppShell>
  );
}

// ── Revision request (1-5 items + note + timeline), same payload as the website ──
function RevisionSheet({ open, onClose, onSubmit, fees }) {
  const [items, setItems] = useState(['']);
  const [notes, setNotes] = useState('');
  const [timeline, setTimeline] = useState('48h');
  const [busy, setBusy] = useState(false);
  const used = revisionItemCount(items.length, notes);
  const contactHit = items.some(hasContactInfo) || hasContactInfo(notes);
  const filled = items.map((s) => s.trim()).filter(Boolean);
  const canSubmit = filled.length > 0 && revisionItemCount(filled.length, notes) <= MAX_REVISION_ITEMS && !contactHit;
  const notice = revisionFeeNotice(fees || {});
  const submit = async () => {
    if (!canSubmit || busy) return;
    setBusy(true);
    try {
      const deadline = new Date(Date.now() + (timeline === '24h' ? 24 : 48) * 3600 * 1000).toISOString();
      await onSubmit(buildRevisionPayload(filled.map((description) => ({ description })), notes, deadline));
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message || 'Failed to request revision');
    } finally { setBusy(false); }
  };
  return (
    <BottomSheet
      open={open}
      onClose={() => !busy && onClose()}
      tall
      title="Ask for changes"
      subtitle="Add 1 to 5 specific changes for the creator."
      footer={(
        <>
          <button type="button" className="ap-btn ap-cp-soft ap-cp-lg" style={{ flex: 1 }} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="ap-btn ap-cp-lg" style={{ flex: 1 }} onClick={submit} disabled={!canSubmit || busy}>{busy ? 'Sending…' : 'Send request'}</button>
        </>
      )}
    >
      {notice && <div className={`ap-cp-note${notice.kind === 'fee' ? ' ap-cp-note--warn' : ''}`}><Info size={18} /><span>{notice.text}</span></div>}
      {contactHit && <div className="ap-cp-note ap-cp-note--bad"><Info size={18} /><span>Please remove phone numbers and email addresses. Keep all communication on-platform.</span></div>}
      <div className="ap-cp-form">
        {items.map((it, i) => (
          <label key={i} className="ap-label">
            Change {i + 1}
            <span className="ap-cp-inrow">
              <textarea className="ap-input" rows={2} value={it} onChange={(e) => setItems((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))} placeholder="e.g. Show the label in the first 3 seconds" />
              {items.length > 1 && <button type="button" className="ap-cp-iconbtn" aria-label={`Remove change ${i + 1}`} onClick={() => setItems((arr) => arr.filter((_, j) => j !== i))}><Trash2 size={18} /></button>}
            </span>
          </label>
        ))}
        {used < MAX_REVISION_ITEMS && <button type="button" className="ap-link ap-cp-addlink" onClick={() => setItems((arr) => [...arr, ''])}><Plus size={14} /> Add another change</button>}
        <label className="ap-label">
          Notes (optional)
          <textarea className="ap-input" rows={3} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything else the creator should know" />
        </label>
        <div className="ap-label">
          Creator should resubmit within
          <div className="ap-chips">
            {['24h', '48h'].map((t) => <button key={t} type="button" className={`ap-chip${timeline === t ? ' is-on' : ''}`} onClick={() => setTimeline(t)}>{t === '24h' ? '24 hours' : '48 hours'}</button>)}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}

function RateSheet({ open, name, onClose, onSubmit }) {
  const [rating, setRating] = useState(5);
  const [review, setReview] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const submit = async () => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await onSubmit({ rating, review: review.trim() }); } finally { lock.current = false; setBusy(false); }
  };
  return (
    <BottomSheet
      open={open}
      onClose={() => !busy && onClose()}
      title="Rate this creator"
      subtitle={name ? `How was working with ${name}?` : undefined}
      footer={(
        <>
          <button type="button" className="ap-btn ap-cp-soft ap-cp-lg" style={{ flex: 1 }} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="ap-btn ap-cp-lg" style={{ flex: 1 }} onClick={submit} disabled={busy}>{busy ? 'Submitting…' : 'Submit review'}</button>
        </>
      )}
    >
      <div className="ap-cp-stars" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} onClick={() => setRating(n)}>
            <Star size={34} fill={rating >= n ? '#f5b301' : 'none'} color={rating >= n ? '#f5b301' : '#c7cbe0'} />
          </button>
        ))}
      </div>
      <label className="ap-label" style={{ marginTop: 12 }}>
        Review (optional)
        <textarea className="ap-input" rows={4} value={review} onChange={(e) => setReview(e.target.value)} placeholder="Share how the collaboration went" />
      </label>
    </BottomSheet>
  );
}

export default withBrandGate(CampaignDetail);
