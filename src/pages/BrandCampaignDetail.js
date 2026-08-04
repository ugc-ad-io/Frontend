import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ArrowLeft, ChevronRight, Check, FileText, Send, MessageSquare, User, CheckCircle, Download,
  Play, Clock, Calendar, FileVideo, CheckCircle2, Hourglass, RefreshCw, MoreHorizontal, Copy, Truck, Star,
} from 'lucide-react';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import { Skeleton } from '../components/Skeleton';
import PageModal from '../components/PageModal';
import ShipmentTracking from './ShipmentTracking';
import PostABrief from './PostABrief';
import ChatPopup from '../components/ChatPopup';
import CreatorProfileModal from '../components/CreatorProfileModal';
import VideoReviewModal from '../components/VideoReviewModal';
import ReviewModal from '../components/ReviewModal';
import CampaignDetails from './CampaignDetails';
import BookingCard from '../components/BookingCard';
import '../styles/creator-marketplace.css';
import EmptyState from '../components/EmptyState';
import { selectedCreators, creatorsWanted, slotsLeft } from '../utils/campaignCreators';
import { creatorFirstName } from '../utils/displayName';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const inr = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const assetUrl = (u) => (!u ? '' : (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}${String(u).startsWith('/') ? '' : '/'}${u}`));
// The /profile endpoint stores the photo under several keys (top-level or nested
// under `profile`), so a single `.profile_photo` check missed most creators and
// fell back to the initial. Resolve it the same way CreatorProfileModal does.
const creatorPhoto = (c) => {
  const p = c?.profile || {};
  return assetUrl(c?.profile_photo || c?.profile_picture || p.profile_photo || p.profile_picture || c?.photo || '');
};
const isVideo = (u) => /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(String(u || '').split('?')[0]);
const fmtDur = (s) => { if (!s || !isFinite(s)) return ''; const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${String(sec).padStart(2, '0')}`; };
const fileExt = (f) => (f ? (String(f).split('?')[0].split('.').pop() || '').toUpperCase() : '');
// Levels are stored as codes like "l1"/"l2"; show them capitalised ("L1"/"L2").
// Word labels ("New", "Elite", "Verified") are left as-is.
const fmtLevel = (v) => String(v || '').replace(/^l(\d+)$/i, (_, n) => `L${n}`);
// Campaign status → header badge. Previously everything non-completed read "Live",
// so a REJECTED (or pending) campaign still showed a green LIVE badge.
const STATUS_BADGE = {
  active: { label: 'Live', cls: 'live' },
  in_progress: { label: 'Live', cls: 'live' },
  work_submitted: { label: 'In Review', cls: 'review' },
  completed: { label: 'Completed', cls: 'done' },
  pending_approval: { label: 'Pending Approval', cls: 'pending' },
  rejected: { label: 'Rejected', cls: 'rejected' },
  cancelled: { label: 'Cancelled', cls: 'rejected' },
  draft: { label: 'Draft', cls: 'pending' },
};
const statusBadge = (s) => STATUS_BADGE[s] || { label: 'Live', cls: 'live' };

const WS_STATUS = {
  approved: { cls: 'ok', label: 'Approved', icon: CheckCircle2 },
  pending_review: { cls: 'pending', label: 'Pending Review', icon: Hourglass },
  revision_requested: { cls: 'warn', label: 'Revision', icon: RefreshCw },
};
const DEAL_ORDER = ['Accepted - Awaiting Shipment', 'Shipped - In Transit', 'Delivered - Awaiting Receipt Confirmation', 'Received - Content in Progress', 'Content Submitted - Awaiting Review', 'Approved - Payment Processing', 'Paid - Complete'];
// The backend emits these states with an EM-dash ("Shipped — In Transit") while the
// list above uses a hyphen. Without normalising, indexOf() is always -1 and the
// progress tracker never advances. (AdminDeals/MyDealsPage do the same.)
const normalizeDash = (v) => String(v || '').replace(/\s*(?:—|–|-)\s*/g, ' - ');
const dealStateIndex = (state) => {
  const key = normalizeDash(state);
  return DEAL_ORDER.findIndex((s) => normalizeDash(s) === key);
};
// Revision items are stored as flat strings like "[must-fix] change the dress
// (ref: 0:12)". Parse them into { severity, text, ref } so the panel can render a
// clean list with badges instead of a wall of duplicated raw text.
function parseRevisionItem(s) {
  const str = String(s || '').trim();
  const sev = str.match(/^\[([^\]]+)\]\s*/);
  let rest = sev ? str.slice(sev[0].length) : str;
  const ref = rest.match(/\(ref:\s*([^)]*)\)/i);
  const text = rest.replace(/\(ref:\s*[^)]*\)/i, '').replace(/\s+-\s*$/, '').trim();
  return { severity: sev ? sev[1].trim() : '', ref: ref ? ref[1].trim() : '', text };
}
// Build a de-duplicated item list from the requested-changes array (preferred) or
// the flattened feedback string, dropping repeats and any leftover "Notes:" line.
function revisionItems(rev) {
  const raw = (rev.requested_changes && rev.requested_changes.length)
    ? rev.requested_changes
    : String(rev.latest_feedback || '').split(/\n+/);
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
const FALLBACK_WORK = ['/creator/video_01.mp4', '/creator/video_08.mp4', '/creator/video_27.mp4', '/creator/video_28.mp4'];
const pfUrlOf = (it) => (typeof it === 'string' ? it : (it?.videoUrl || it?.url || (Array.isArray(it?.urls) && it.urls[0]) || it?.original_url || it?.video || ''));

// Small playable portfolio thumbnail for the creator card.
function WorkTile({ url }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const src = assetUrl(url);
  const toggle = () => { const v = ref.current; if (!v) return; if (v.paused) { v.play().then(() => setPlaying(true)).catch(() => {}); } else { v.pause(); setPlaying(false); } };
  return (
    <div className="bcd-work-tile" onClick={toggle}>
      {isVideo(src) ? <video ref={ref} src={`${src}#t=0.5`} muted loop playsInline preload="metadata" /> : <img src={src} alt="" />}
      {!playing && <span className="bcd-work-play"><Play size={13} fill="currentColor" /></span>}
    </div>
  );
}

// Some profile fields (e.g. followers) are objects — never render those directly.
const safeText = (v, fb = '—') => {
  if (v == null || v === '') return fb;
  if (typeof v === 'object') return fb;
  return String(v);
};

// The brief is stored as newline-separated "Label: value" lines. Render it as a
// readable definition list so labels (sub-headings) stand apart from the values
// instead of collapsing into one grey wall of text.
function normalizeBriefPart(item) {
  const trimmed = String(item).trim();
  if (!trimmed || trimmed.includes(' - ') || trimmed.includes(':')) return trimmed;
  const firstSpace = trimmed.search(/\s+/);
  if (firstSpace < 0) return trimmed;
  const key = trimmed.slice(0, firstSpace);
  const rest = trimmed.slice(firstSpace + 1).trim();
  if (!rest) return trimmed;
  if (/^(https?:\/\/|www\.|\d+)/i.test(rest) || /^[A-Z]/.test(rest) || /^[0-9]/.test(rest)) {
    return `${key} - ${rest}`;
  }
  return trimmed;
}

function renderBriefValue(val) {
  const text = String(val).trim();
  const parts = text.split(/\s*;\s*/).filter((item) => item);
  const normalized = parts.map(normalizeBriefPart);
  if (normalized.length <= 1) {
    return <span className="bcd-bl-val">{normalized[0] || ''}</span>;
  }

  return (
    <div className="bcd-bl-val-list">
      {normalized.map((item, idx) => (
        <div key={idx} className="bcd-bl-val-item">{item}</div>
      ))}
    </div>
  );
}

function renderBrief(text) {
  if (!text) return [<p key="none" className="bcd-bl">No description provided.</p>];
  const out = [];
  let skip = false; // inside the "Deliverables" block — shown in its own card, so drop it here
  String(text).split('\n').forEach((line, i) => {
    const t = line.trim();
    if (!t) return; // spacing handled via CSS margins, not blank rows
    if (/^\d+\.\s/.test(t)) { if (!skip) out.push(<p key={i} className="bcd-bl bcd-bl-item">{t}</p>); return; }
    const idx = t.indexOf(':');
    if (idx > 0 && idx <= 28) {
      const label = t.slice(0, idx);
      const val = t.slice(idx + 1).trim();
      if (!val) {
        if (/^deliverables$/i.test(label)) { skip = true; return; }
        skip = false;
        out.push(<p key={i} className="bcd-bsub">{label}</p>);
        return;
      }
      skip = false;
      out.push(
        <div key={i} className="bcd-bl">
          <span className="bcd-blab">{label}:</span>
          {renderBriefValue(val)}
        </div>
      );
      return;
    }
    skip = false;
    out.push(<p key={i} className="bcd-bl">{t}</p>);
  });
  return out;
}

// Pull the numbered deliverable lines out of the brief's "Deliverables:" block so
// they can live in the dedicated Deliverables card instead of the About section.
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
    if (label) inBlock = false; // a new labelled line ends the block
  });
  return items;
}

// The deal-room thread, brand side. Reads deal.chat_summary.messages (db.deal_messages)
// — the same thread the creator writes to in My Deals, including the backend's system
// lines. Posting goes to POST /deals/{deal_id}/chat, which accepts either party.
function DealChatPanel({ deal, onSent }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const messages = deal?.chat_summary?.messages || [];
  const listRef = useRef(null);

  // Keep the newest message in view as the thread grows.
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

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
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bcd-card bcd-dchat">
      <h3><MessageSquare size={16} /> Deal chat</h3>
      <p className="bcd-dchat-sub">Shared with the creator. Status updates from the platform appear here too.</p>
      <div className="bcd-dchat-list" ref={listRef}>
        {messages.length ? messages.map((m) => (
          <div key={m.id} className={`bcd-dmsg ${m.sender_type === 'system' ? 'is-system' : m.sender_type === 'creator' ? 'is-creator' : 'is-brand'}`}>
            {m.sender_type !== 'system' && <small>{m.sender_name}</small>}
            <p>{m.message}</p>
          </div>
        )) : <p className="bcd-dchat-empty">No messages yet. Say hello, or answer the creator's questions about the brief.</p>}
      </div>
      <div className="bcd-dchat-input">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Type a message..."
        />
        <button type="button" onClick={send} disabled={sending || !text.trim()} aria-label="Send">
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}

export default function BrandCampaignDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [deals, setDeals] = useState([]);          // one deal per hired creator on this brief
  const [creators, setCreators] = useState([]);    // every creator hired on this brief
  const [activeCreatorId, setActiveCreatorId] = useState(null); // which creator's room is open
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [chatOpen, setChatOpen] = useState(false);
  const [profOpen, setProfOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [wsDur, setWsDur] = useState('');
  const [wsMenu, setWsMenu] = useState(false);
  const [videoModal, setVideoModal] = useState(null);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revSubmitting, setRevSubmitting] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const dupRef = useRef(null);
  const closeDup = async () => {
    await dupRef.current?.saveDraftNow();
    setDupOpen(false);
  };
  const [shipmentOpen, setShipmentOpen] = useState(false);
  const [selecting, setSelecting] = useState(null); // creator_id being accepted
  const [finishing, setFinishing] = useState(false); // closing hiring early
  const [myReview, setMyReview] = useState(null);    // this brand's review of the creator (or null)
  const [activeWork, setActiveWork] = useState(null); // multi-creator: active creator's own work submission
  const [reviewOpen, setReviewOpen] = useState(false);
  // Mobile: the Campaign Progress card collapses to a start/end summary bar with
  // a position marker; tapping it reveals the full step-by-step timeline.
  const [progressExpanded, setProgressExpanded] = useState(false);

  // The brand can switch between hired creators; `creator`/`deal` always reflect the
  // one currently selected (defaulting to the first pick). Deriving them keeps every
  // per-creator panel — Creator card, chat, work review, review — pointed at the same
  // creator without threading a prop through each one.
  const creator = creators.find((c) => String(c?.id) === String(activeCreatorId)) || creators[0] || null;
  const deal = deals.find((d) => String(d?.creator?.id) === String(activeCreatorId))
    || deals.find((d) => String(d?.campaign?.id) === String(id)) || deals[0] || null;

  const load = async () => {
    try {
      const cRes = await axios.get(`${API}/campaigns/${id}`);
      setCampaign(cRes.data);
      // Brands must read /deals/business — /deals/my is the creator's list and
      // returns 403/[] here, which left `deal` permanently null on this page.
      const dRes = await axios.get(`${API}/deals/business`).catch(() => ({ data: [] }));
      // /deals/business now returns one deal PER hired creator — keep every deal for
      // this campaign so the switcher can open each creator's room.
      const campaignDeals = (dRes.data || []).filter((x) => String(x.campaign?.id) === String(id));
      setDeals(campaignDeals);
      // A brief can hire several creators — load every one, not just the first.
      const ids = selectedCreators(cRes.data);
      if (ids.length) {
        const profiles = await Promise.all(
          ids.map((cid) => axios.get(`${API}/profile/${cid}`)
            .then((r) => ({ id: cid, ...r.data }))
            .catch(() => ({ id: cid })))
        );
        setCreators(profiles);
        // Keep the brand's current selection across reloads; default to the first pick.
        setActiveCreatorId((prev) => (prev && ids.includes(prev) ? prev : profiles[0]?.id || null));
      } else {
        setCreators([]);
        setActiveCreatorId(null);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Whose review am I looking at? Re-fetch when the brand switches creators so the
  // "Add a review" vs "Rated ★" state on a completed deal follows the active creator.
  useEffect(() => {
    if (!activeCreatorId) { setMyReview(null); return; }
    let live = true;
    axios.get(`${API}/reviews/creator/${activeCreatorId}`)
      .then((r) => r.data).catch(() => [])
      .then((revs) => {
        if (!live) return;
        const mine = (Array.isArray(revs) ? revs : []).find(
          (rv) => String(rv.campaign_id) === String(id) && String(rv.reviewer_id) === String(user?.id)
        );
        setMyReview(mine || null);
      });
    return () => { live = false; };
  }, [activeCreatorId, id, user?.id]);

  // Multi-creator: pull the ACTIVE creator's own work submission so the Work Review
  // tab and approve/revise/download follow the switcher. Single-creator keeps using
  // the campaign-level work_submission untouched.
  useEffect(() => {
    if (creators.length <= 1 || !activeCreatorId) { setActiveWork(null); return; }
    let live = true;
    axios.get(`${API}/work/campaign/${id}?creator_id=${encodeURIComponent(activeCreatorId)}`)
      .then((r) => r.data).catch(() => null)
      .then((w) => { if (live) setActiveWork(w && w.id ? w : null); });
    return () => { live = false; };
  }, [activeCreatorId, id, creators.length]);

  const steps = useMemo(() => {
    const idx = deal ? dealStateIndex(deal.current_state) : -1;
    const ship = deal?.shipment || {};
    const rec = deal?.receipt || {};
    const defs = [
      { label: 'Brief Sent', date: campaign?.createdAt || campaign?.created_at, done: true },
      { label: 'Product Shipped', date: ship.shipped_at, done: idx >= 1 },
      { label: 'Product Received', date: rec.received_at, done: idx >= 3 },
      { label: 'Content Submitted', date: campaign?.work_submission?.submitted_at, done: idx >= 4 },
      { label: 'Under Review', date: null, done: idx >= 5 },
      { label: 'Completed', date: deal?.escrow?.released_at, done: idx >= 6 },
    ];
    const firstTodo = defs.findIndex((s) => !s.done);
    return defs.map((s, i) => ({ ...s, current: i === firstTodo }));
  }, [deal, campaign]);

  // Where the mobile mini-bar's marker sits along the track (0–100%).
  const progressIdx = useMemo(() => {
    const cur = steps.findIndex((s) => s.current);
    if (cur >= 0) return cur;
    const doneCount = steps.filter((s) => s.done).length;
    return Math.min(doneCount, steps.length - 1);
  }, [steps]);
  const progressPct = steps.length > 1 ? (progressIdx / (steps.length - 1)) * 100 : 0;

  if (loading) return (
    <BrandTopNavLayout>
      <div className="bcd" aria-hidden="true">
        {/* Breadcrumb */}
        <div className="bcd-bc" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Skeleton width={110} height={14} />
          <Skeleton width={90} height={14} />
        </div>

        {/* Title / budget / actions row */}
        <div className="bcd-top">
          <div className="bcd-title-wrap">
            <Skeleton width={92} height={22} radius={999} style={{ display: 'block' }} />
            <Skeleton width="60%" height={28} style={{ display: 'block', marginTop: 12 }} />
            <Skeleton width={280} height={13} style={{ display: 'block', marginTop: 10 }} />
          </div>
          <div className="bcd-budget">
            <Skeleton width={80} height={12} style={{ display: 'block' }} />
            <Skeleton width={140} height={20} style={{ display: 'block', marginTop: 8 }} />
          </div>
          <div className="bcd-actions" style={{ display: 'flex', gap: 10 }}>
            <Skeleton width={110} height={38} radius={10} />
            <Skeleton width={110} height={38} radius={10} />
          </div>
        </div>

        {/* Tab strip */}
        <div className="bcd-tabs" style={{ display: 'flex', gap: 22, margin: '22px 0' }}>
          <Skeleton width={80} height={16} />
          <Skeleton width={120} height={16} />
          <Skeleton width={100} height={16} />
        </div>

        {/* Content cards */}
        <div style={{ display: 'grid', gap: 16 }}>
          <Skeleton height={150} radius={16} />
          <Skeleton height={220} radius={16} />
        </div>
      </div>
    </BrandTopNavLayout>
  );
  if (!campaign) return <BrandTopNavLayout><div className="cmk-empty">Campaign not found.</div></BrandTopNavLayout>;

  const refresh = async () => {
    try { const r = await axios.get(`${API}/campaigns/${id}`); setCampaign(r.data); } catch { /* ignore */ }
  };
  // /work/:id/* is keyed by the WORK SUBMISSION id, not the campaign id. This page only
  // has the campaign id in its URL, and it was passing that straight through — which
  // 404'd every approve / request-revision / download. Resolve the real one first.
  const resolveWorkId = async () => {
    // On a multi-creator brief, resolve the ACTIVE creator's work so approve/revise/
    // download act on the creator the brand is currently viewing.
    const qs = creators.length > 1 && activeCreatorId ? `?creator_id=${encodeURIComponent(activeCreatorId)}` : '';
    const r = await axios.get(`${API}/work/campaign/${id}${qs}`).catch(() => null);
    return r?.data?.id || null;
  };
  const approveWork = async () => {
    try {
      const wid = await resolveWorkId();
      if (!wid) return toast.error('No submitted work to approve yet');
      await axios.post(`${API}/work/${wid}/approve`);
      toast.success('Approved — payment released to the creator');
      refresh();
    } catch (e) { toast.error(e?.response?.data?.detail || 'Failed to approve'); }
  };
  // Bids waiting on this campaign. Only meaningful while nobody is selected yet.
  const bids = Array.isArray(campaign?.bids) ? campaign.bids : [];

  // Accepting a bid funds the deal from the brand's wallet (the backend converts the
  // campaign's budget reservation into escrow), so a short balance comes back as 402.
  const selectCreator = async (bid) => {
    setSelecting(bid.creator_id);
    try {
      const { data } = await axios.post(`${API}/campaigns/${id}/select-creator?creator_id=${encodeURIComponent(bid.creator_id)}`);
      const who = String(bid.creator_name || bid.creator_nickname || 'Creator').replace(/^@/, '').trim().split(/\s+/)[0] || 'Creator';
      const left = Number(data?.slots_left ?? 0);
      toast.success(
        left > 0
          ? `${who} selected — the deal has started. ${left} slot${left === 1 ? '' : 's'} still open.`
          : `${who} selected — the deal has started. This brief is now fully staffed.`
      );
      await load();
    } catch (e) {
      if (e?.response?.status === 402) {
        const d = e.response.data || {};
        toast.error(d.detail || 'Not enough credits to fund this deal.');
      } else {
        toast.error(e?.response?.data?.detail || 'Failed to select creator');
      }
    } finally { setSelecting(null); }
  };

  // Close a multi-creator brief early with whoever's already hired. The backend
  // refunds the budget reserved for the slots you're not filling.
  const finishHiring = async () => {
    if (!window.confirm('Close hiring with the creators you’ve already picked? The reserved budget for the remaining slots will be refunded to your wallet.')) return;
    setFinishing(true);
    try {
      const { data } = await axios.post(`${API}/campaigns/${id}/finish-hiring`);
      const back = Number(data?.refunded || 0);
      toast.success(
        back > 0
          ? `Hiring closed with ${data.creators_hired} creator${data.creators_hired === 1 ? '' : 's'} — ₹${Math.round(back).toLocaleString('en-IN')} refunded to your wallet.`
          : `Hiring closed with ${data.creators_hired} creator${data.creators_hired === 1 ? '' : 's'}.`
      );
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not close hiring');
    } finally { setFinishing(false); }
  };

  const requestRevision = () => setRevisionOpen(true);
  const submitRevision = async (payload) => {
    setRevSubmitting(true);
    try {
      const wid = await resolveWorkId();
      if (!wid) throw new Error('No submitted work to revise');
      const { data } = await axios.post(`${API}/work/${wid}/request-revision`, payload);
      // Say so when money actually moved — a bare "Revision requested" hid the debit.
      toast.success(data?.paid
        ? `Revision requested — ₹${data.fee_charged} charged. Wallet balance: ₹${Math.round(data.new_balance)}.`
        : 'Revision requested');
      setRevisionOpen(false);
      refresh();
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message || 'Failed to request revision');
    } finally { setRevSubmitting(false); }
  };
  const downloadWork = async () => {
    try {
      const wid = await resolveWorkId();
      if (!wid) return toast.error('No submitted work to download yet');
      const res = await axios.get(`${API}/work/${wid}/download`, { responseType: 'blob' });
      // Derive the real extension from the blob type (deliverables may be mp4/mov/png/pdf).
      const type = res.data?.type || '';
      const ext = type.includes('/') ? type.split('/')[1].split(';')[0] : 'mp4';
      const u = window.URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = u; a.download = `${campaign.title || 'deliverable'}.${ext}`;
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(u);
    } catch (e) {
      toast.error(e?.response?.status === 403 ? 'Download unlocks after you approve the work' : 'Could not download the deliverable');
    }
  };

  const spent = campaign.escrow_amount || campaign.budget_min || 0;
  const total = campaign.budget_max || campaign.budget_min || 0;
  const handle = creator ? creatorFirstName(creator) : null;
  const cp = creator?.profile || {};
  const ship = deal?.shipment || {};
  const rec = deal?.receipt || {};
  const shipped = !!(ship.shipped_at || ['shipped', 'in_transit', 'delivered'].includes(ship.courier_status));
  const delivered = !!(rec.received_at || ship.delivered_at || ship.courier_status === 'delivered');
  const unboxingUrl = assetUrl(rec.unboxing_video_url || ship.unboxing_video || '');
  // There is nobody to ship to until a creator is on the campaign — and the label
  // flow reads the creator's address server-side — so shipping is gated on this.
  const creatorSelected = !!(campaign.selected_creator || creator?.id || deal?.creator?.id);
  // Multi-creator hiring: who's already on the brief, how many slots remain, and
  // which bids are still up for grabs (a hired creator shouldn't be re-selectable).
  const hiredIds = selectedCreators(campaign);
  const wanted = creatorsWanted(campaign);
  const openSlots = slotsLeft(campaign);
  const openBids = bids.filter((b) => !hiredIds.includes(String(b.creator_id)));
  const campaignDeliver = String(campaign.deliverables || '').split(/[\n;]+/).map((s) => s.trim()).filter(Boolean);
  const briefDeliver = extractDeliverables(campaign.brief_text);
  const deliverList = campaignDeliver.length ? campaignDeliver : briefDeliver;

  // Multi-creator: the active creator's own submission drives the Work Review tab.
  const ws = creators.length > 1 ? activeWork : campaign.work_submission;
  const wsStatus = ws ? (ws.status || (campaign.status === 'completed' ? 'approved' : 'pending_review')) : null;
  // The deal is done however it got there — brand approval OR a dispute ruling —
  // so the review CTA doesn't depend on the approve button being the last step.
  const dealCompleted = wsStatus === 'approved'
    || campaign.status === 'completed'
    || dealStateIndex(deal?.current_state) >= 6;

  const submitReview = async ({ rating, review }) => {
    const creatorId = creator?.id || deal?.creator?.id;
    if (!creatorId) { toast.error('No creator to review'); return; }
    try {
      await axios.post(`${API}/reviews`, { campaign_id: id, creator_id: creatorId, rating, review });
      setMyReview({ campaign_id: id, creator_id: creatorId, reviewer_id: user?.id, rating, review });
      setReviewOpen(false);
      toast.success('Review submitted — thanks for the feedback!');
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not submit your review');
    }
  };

  const wsFiles = ws?.work_files || [];
  const wsFirst = wsFiles[0];
  const wsMedia = assetUrl(wsFirst);
  const openWork = () => {
    const f = wsFiles.find((x) => isVideo(x)) || wsFirst;
    if (!f) return;
    const url = assetUrl(f);
    if (isVideo(url)) setVideoModal({ src: url, watermark: wsStatus !== 'approved', title: campaign.title });
    else window.open(url, '_blank');
  };

  // Open the brief form (as a modal card on this page) pre-filled with this
  // campaign's details so the brand can edit before publishing the copy.
  const duplicateBrief = () => setDupOpen(true);

  // Multi-creator brief: one tab per hired creator. Switching drives the whole
  // panel — progress, profile, chat, work review, review — for that creator.
  // Shared between the Overview creator card and the Work Review tab, so both
  // places let the brand pick whose deal they're looking at.
  const CreatorTabs = () => (
    <div className="bcd-cre-tabs" role="tablist">
      {creators.map((c) => {
        const nm = creatorFirstName(c) || 'Creator';
        const on = String(c.id) === String(activeCreatorId);
        return (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={on}
            className={`bcd-cre-tab${on ? ' is-active' : ''}`}
            onClick={() => setActiveCreatorId(c.id)}
            data-testid={`creator-tab-${c.id}`}
          >
            <span className="bcd-cre-tab-ava">{creatorPhoto(c) ? <img src={creatorPhoto(c)} alt="" /> : nm.replace('@', '').charAt(0).toUpperCase()}</span>
            {nm.replace(/^@+/, '')}
          </button>
        );
      })}
    </div>
  );

  return (
    <BrandTopNavLayout>
      <div className="bcd">
        <div className="bcd-bc">
          <button onClick={() => navigate('/dashboard/business/all-campaigns')}><ArrowLeft size={16} /> Campaigns</button>
          <ChevronRight size={15} color="#9296ba" />
          <strong>{campaign.title}</strong>
        </div>

        <div className="bcd-top">
          <div className="bcd-title-wrap">
            <span className={`bcd-badge ${statusBadge(campaign.status).cls}`}>{statusBadge(campaign.status).label}</span>
            <h1>{campaign.title}</h1>
            <span className="bcd-sub">Campaign ID: CMP-{String(campaign.id || campaign._id || '').slice(-6).toUpperCase()} · Launched on {fmtDate(campaign.createdAt || campaign.created_at)}</span>
          </div>
          <div className="bcd-budget">
            <label>Total Budget</label>
            <strong>{inr(spent)} <small>/ {inr(total)}</small></strong>
          </div>
          <div className="bcd-actions">
            <button className="cmk-btn-ghost-sm" onClick={duplicateBrief}><Copy size={16} /> Duplicate</button>
            <button className="cmk-btn-ghost-sm bcd-action-details" onClick={() => setDetailsOpen(true)}>View Details</button>
          </div>
        </div>

        {/* Direct booking: answer the creator's price, or send the brief once accepted. */}
        <BookingCard deal={deal || { campaign }} role="brand" onDone={load} />

        <div className="bcd-tabs">
          {[['overview', 'Overview'], ['about', 'About Campaign'], ['work', `Work Review${ws ? ' (1)' : ''}`]].map(([k, l]) => (
            <button key={k} className={`${tab === k ? 'is-active' : ''}${k === 'work' ? ' bcd-tab-right' : ''}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {tab === 'work' ? (
          <>
            {/* Multi-creator: pick whose submission to review — without this the
                tab just showed whichever creator was last active on Overview, with
                no way to tell (or change) whose work you were looking at. */}
            {creators.length > 1 && <CreatorTabs />}
          {ws ? (
            <div className="bwr-list">
              {(() => {
                const st = WS_STATUS[wsStatus] || WS_STATUS.pending_review;
                const StIcon = st.icon;
                const creatorLabel = handle ? handle.replace(/^@/, '') : 'Creator';
                const photo = creatorPhoto(creator);
                return (
                  <article className="bwr-card">
                    <div className="bwr-thumb" onClick={openWork}>
                      {wsMedia ? (isVideo(wsMedia)
                        ? <video src={`${wsMedia}#t=0.5`} muted playsInline preload="metadata" onLoadedMetadata={(e) => setWsDur(fmtDur(e.target.duration))} />
                        : <img src={wsMedia} alt="" />)
                        : <div className="bwr-thumb-fb"><FileText size={26} /></div>}
                      {wsStatus !== 'approved' && <span className="bwr-wm" aria-hidden="true" />}
                      <span className="bwr-play"><Play size={20} fill="currentColor" /></span>
                      {wsDur && <span className="bwr-dur">{wsDur}</span>}
                    </div>

                    <div className="bwr-body">
                      <h3 className="bwr-title">
                        {campaign.title}
                        {/* Without this the brand can't tell a revised cut from the original —
                            the card looked identical every round, so revisions read as "never arrived". */}
                        {ws.version > 1 && <span className="bwr-ver">Revision v{ws.version}</span>}
                      </h3>
                      <div className="bwr-by">
                        <span className="bwr-by-ava">{photo ? <img src={photo} alt="" /> : '@'}</span>
                        by <b>{creatorLabel}</b>
                        <i className="bwr-by-dot" />
                        <Calendar size={14} /> Submitted on {fmtDate(ws.submitted_at)}
                      </div>

                      <div className="bwr-cbox">
                        <span className="bwr-cbox-ic"><FileText size={18} /></span>
                        <div><label>Campaign</label><strong>{campaign.title}</strong></div>
                      </div>

                      <div className="bwr-meta">
                        <div className="bwr-meta-item"><Clock size={16} /><div><label>Duration</label><span>{wsDur || '—'}</span></div></div>
                        <div className="bwr-meta-item"><FileVideo size={16} /><div><label>File Type</label><span>{fileExt(wsFirst) || '—'}</span></div></div>
                        <div className="bwr-meta-item"><Calendar size={16} /><div><label>Submitted</label><span>{fmtDate(ws.submitted_at)}</span></div></div>
                      </div>
                    </div>

                    <div className="bwr-side">
                      <div className="bwr-side-top">
                        <span className={`bwr-pill ${st.cls}`}><StIcon size={14} /> {st.label}</span>
                        <div className="bwr-more-wrap">
                          <button type="button" className="bwr-more" aria-label="More actions" onClick={() => setWsMenu((v) => !v)}>
                            <MoreHorizontal size={18} />
                          </button>
                          {wsMenu && (
                            <>
                              <div className="bwr-menu-backdrop" onClick={() => setWsMenu(false)} />
                              <div className="bwr-menu">
                                <button type="button" onClick={() => { setWsMenu(false); openWork(); }}><Play size={15} /> Open file</button>
                                {wsStatus !== 'approved' && <button type="button" onClick={() => { setWsMenu(false); requestRevision(); }}><RefreshCw size={15} /> Request revision</button>}
                                {wsStatus === 'pending_review' && <button type="button" onClick={() => { setWsMenu(false); approveWork(); }}><CheckCircle2 size={15} /> Approve</button>}
                                <button type="button" onClick={() => { setWsMenu(false); if (creator) setChatOpen(true); }}><MessageSquare size={15} /> Message creator</button>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {wsStatus === 'approved' && (
                        <button type="button" className="bwr-btn primary" onClick={downloadWork}><Download size={16} /> Download</button>
                      )}
                      {/* Review CTA — shows once the deal is complete (approval OR a
                          dispute ruling). Reviewed already? Show it's done instead. */}
                      {dealCompleted && (myReview
                        ? <span className="bwr-reviewed"><Star size={15} fill="#f5b301" color="#f5b301" /> You rated {myReview.rating}★</span>
                        : <button type="button" className="bwr-btn" onClick={() => setReviewOpen(true)}><Star size={16} /> Add a review</button>
                      )}
                      {wsStatus === 'pending_review' && (<>
                        <button type="button" className="bwr-btn approve" onClick={approveWork}><CheckCircle2 size={16} /> Approve</button>
                        <button type="button" className="bwr-btn" onClick={requestRevision}><RefreshCw size={16} /> Request Revision</button>
                      </>)}
                      {wsStatus === 'revision_requested' && (
                        <button type="button" className="bwr-btn" disabled><RefreshCw size={16} /> Awaiting resubmit</button>
                      )}
                      <button type="button" className="bwr-btn" onClick={() => { if (creator) setChatOpen(true); }}><MessageSquare size={16} /> Message Creator</button>
                    </div>
                  </article>
                );
              })()}

              {/* Revision status — the feedback you sent and how the creator answered. */}
              {(() => {
                const rev = deal?.revision_tracker || {};
                const hasRevision = Boolean(rev.latest_feedback || rev.requested_changes?.length);
                if (!hasRevision) return null;
                const answer = rev.creator_response;
                const ANSWER = {
                  accepted: { cls: 'ok', text: 'Creator accepted the revision and is reworking the content.' },
                  // A pushback is NOT an automatic dispute — the backend deliberately
                  // returns dispute_id: None and asks the two of you to settle it in the
                  // deal chat first. Saying "a dispute was opened" made brands sit and
                  // wait for an admin who was never coming.
                  scope_creep: { cls: 'bad', text: 'Creator says these changes go beyond the brief. Nothing is disputed yet — reply in the deal chat below to agree what is in scope.' },
                  partial_dispute: { cls: 'bad', text: 'Creator accepted some changes and pushed back on the rest. Nothing is disputed yet — reply in the deal chat below to settle the remaining items.' },
                };
                const a = ANSWER[answer];
                const items = revisionItems(rev);
                const sevClass = (s) => {
                  const k = String(s || '').toLowerCase();
                  if (/must|high|critical/.test(k)) return 'must';
                  if (/nice|low|pref/.test(k)) return 'nice';
                  return 'med';
                };
                return (
                  <div className="bcd-card bcd-revcard">
                    <div className="bcd-revcard-head">
                      <h3><RefreshCw size={16} /> Revision requested</h3>
                      <span className="bcd-revcard-count">{rev.revision_count_used || 0} of {rev.revision_limit || 0} used</span>
                    </div>

                    <p className="bcd-revcard-lbl">Changes you asked for</p>
                    {items.length ? (
                      <ul className="bcd-revlist">
                        {items.map((it, i) => (
                          <li key={i}>
                            {it.severity && <span className={`bcd-revsev ${sevClass(it.severity)}`}>{it.severity}</span>}
                            <span className="bcd-revtext">{it.text}</span>
                            {it.ref && <span className="bcd-revref">ref: {it.ref}</span>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="bcd-revempty">No specific items were listed.</p>
                    )}

                    <div className="bcd-revcard-foot">
                      <span><small>New deadline</small><strong>{rev.new_deadline_at ? new Date(rev.new_deadline_at).toLocaleString() : 'Not scheduled'}</strong></span>
                    </div>

                    <p className={`bcd-revcard-answer ${a ? a.cls : 'wait'}`}>
                      {a ? a.text : 'Waiting for the creator to respond to this revision request.'}
                    </p>
                  </div>
                );
              })()}

              {/* Deal chat. The creator's deal room and the brand's DM popup were two
                  separate threads (deal_messages vs messages), so every system line
                  ("Creator flagged the revision request…") and every message the creator
                  typed here was invisible to the brand. This reads the same thread. */}
              {deal?.deal_id && <DealChatPanel deal={deal} onSent={load} />}
            </div>
          ) : (
            <EmptyState
              title="Nothing to review yet"
              message={
                creators.length > 1 && handle
                  ? `Once ${handle.replace(/^@/, '')} submits their content, it will appear here for you to review and approve.`
                  : "Once the creator submits their content, it will appear here for you to review and approve."
              }
            />
          )}
          </>
        ) : tab === 'about' ? (
          <div className="bcd-card bcd-about-card">
            <h3>About Campaign</h3>
            <div className="bcd-about">{renderBrief(campaign.brief_text)}</div>
          </div>
        ) : (
        <>
        <div className="bcd-row-main">
        <div className="bcd-col-left">
        {/* Campaign Progress — horizontal; shipment folded in */}
        <div className="bcd-card bcd-progress-card">
          <div className="bcd-progress-head">
            <h3>Campaign Progress{creators.length > 1 && handle ? ` — ${handle.replace(/^@/, '')}` : ''}</h3>
            {(campaign.requires_shipment || ship.required) && (delivered || shipped) && (
              <div className="bcd-progress-ship">
                <span className={`bcd-pill ${delivered ? 'ok' : 'info'}`}>{delivered ? 'Delivered' : 'Shipped'}</span>
                {unboxingUrl && <button type="button" className="bcd-pill-btn" onClick={() => setVideoModal({ src: unboxingUrl, title: 'Unboxing Video' })}><Play size={13} /> Unboxing</button>}
              </div>
            )}
          </div>
          {/* Desktop: full horizontal stepper. Hidden on mobile — replaced by the
              collapsed summary bar + tap-to-expand timeline below. */}
          <div className="bcd-hsteps">
            {steps.map((s, i) => (
              <div key={i} className={`bcd-hstep ${s.done ? 'done' : ''} ${s.current ? 'current' : ''} ${!s.done && !s.current ? 'todo' : ''}`}>
                <span className="bcd-hstep-dot">{s.done ? <Check size={13} /> : null}</span>
                <strong>{s.label}</strong>
                <small>{s.date ? fmtDate(s.date) : (s.current ? 'In progress' : '—')}</small>
              </div>
            ))}
          </div>

          {/* Mobile only: collapsed to start/end + a position marker on the track
              (mirrors a shipment-tracker bar). Tap to reveal the full timeline. */}
          <button
            type="button"
            className="bcd-progress-mini"
            onClick={() => setProgressExpanded((v) => !v)}
            aria-expanded={progressExpanded}
          >
            <div className="bcd-progress-mini-top">
              <div className="bcd-progress-mini-end">
                <strong>{steps[0].label}</strong>
                <small>{steps[0].date ? fmtDate(steps[0].date) : '—'}</small>
              </div>
              <div className="bcd-progress-mini-end right">
                <strong>{steps[steps.length - 1].label}</strong>
                <small>{steps[steps.length - 1].date ? fmtDate(steps[steps.length - 1].date) : '—'}</small>
              </div>
            </div>
            <div className="bcd-progress-mini-track">
              <span className="bcd-progress-mini-fill" style={{ width: `${progressPct}%` }} />
              <span className="bcd-progress-mini-dot start" />
              <span className="bcd-progress-mini-marker" style={{ left: `${progressPct}%` }}><Truck size={14} /></span>
              <span className="bcd-progress-mini-dot end" />
            </div>
            <div className="bcd-progress-mini-foot">
              <span>{steps[progressIdx]?.current ? `${steps[progressIdx].label} — in progress` : steps[progressIdx]?.label}</span>
              <ChevronRight size={15} className="bcd-progress-mini-chev" />
            </div>
          </button>

          {progressExpanded && (
            <div className="bcd-vsteps">
              {steps.map((s, i) => (
                <div key={i} className={`bcd-vstep ${s.done ? 'done' : ''} ${s.current ? 'current' : ''}`}>
                  <span className="bcd-vstep-dot">{s.done ? <Check size={12} /> : null}</span>
                  <div className="bcd-vstep-body">
                    <strong>{s.label}</strong>
                    <small>{s.date ? fmtDate(s.date) : (s.current ? 'In progress' : '—')}</small>
                  </div>
                </div>
              ))}
            </div>
          )}
          {(campaign.requires_shipment || ship.required) && (
            <div className="bcd-ship-detail">
              <div className="bcd-kv"><label>Status</label><strong>{delivered ? 'Delivered' : shipped ? 'Shipped' : 'Pending'}</strong></div>
              <div className="bcd-kv"><label>Tracking ID</label><strong>{ship.tracking_id || '—'}</strong></div>
              <div className="bcd-kv"><label>Courier</label><strong>{ship.courier || '—'}</strong></div>
              {delivered && <div className="bcd-kv"><label>Delivered on</label><strong>{fmtDate(rec.received_at || ship.delivered_at)}</strong></div>}

              {/* This panel was read-only: it showed "Pending / — / —" with no way
                  to act on it, so the brand had to hunt for the Shipments page to
                  enter a tracking number. Same drawer, opened from here.

                  Only once a creator is on the campaign: there is nobody to ship
                  to before that, and the label flow needs the creator's address. */}
              {!delivered && (
                creatorSelected ? (
                  <button
                    type="button"
                    className="bcd-ship-btn"
                    onClick={() => setShipmentOpen(true)}
                    data-testid="add-shipment-btn"
                  >
                    <Truck size={15} /> {shipped ? 'Update shipment details' : 'Add shipment details'}
                  </button>
                ) : (
                  <span className="bcd-ship-wait">Select a creator to add shipment details</span>
                )
              )}
            </div>
          )}
        </div>
        <div className="bcd-card bcd-deliver-card">
          <h3>Deliverables</h3>
          {(deliverList.length ? deliverList : ['1 UGC video as described in the brief']).map((d, i) => (
            <div key={i} className="bcd-deliver"><CheckCircle size={16} /> {d}</div>
          ))}
        </div>
        </div>

        {/* Creator */}
        <div className="bcd-card bcd-creator-card">
          <h3>{creators.length > 1 ? `Creators (${creators.length})` : 'Creator'}</h3>
            {creators.length > 1 && <CreatorTabs />}
            {creator ? (
              <>
                <div className="bcd-creator">
                  <span className="bcd-cre-ava">{creatorPhoto(creator) ? <img src={creatorPhoto(creator)} alt="" /> : (handle || 'C').replace('@', '').charAt(0).toUpperCase()}</span>
                  <div><strong>{handle}</strong><small>{(cp.category || 'UGC Creator').replace(/_/g, ' ')}</small></div>
                </div>
                <div className="bcd-kv-row">
                  <div className="bcd-kv"><label>Category</label><strong>{(cp.category || creator.primary_category || 'UGC').replace(/_/g, ' ')}</strong></div>
                  <div className="bcd-kv"><label>Content Type</label><strong>{safeText(cp.content_type, 'Reels')}</strong></div>
                  <div className="bcd-kv"><label>Platform</label><strong>{safeText(cp.platform, 'Instagram')}</strong></div>
                </div>
                <div className="bcd-kv-row">
                  <div className="bcd-kv"><label>Languages</label><strong>{Array.isArray(cp.languages) && cp.languages.length ? cp.languages.slice(0, 2).join(', ') : safeText(cp.languages, 'English')}</strong></div>
                  <div className="bcd-kv"><label>Location</label><strong>{safeText(cp.city || cp.location_region || creator.city_tier, 'India')}</strong></div>
                  <div className="bcd-kv"><label>Level</label><strong>{fmtLevel(safeText(creator.level_label || creator.level, 'New'))}</strong></div>
                </div>
                <div className="bcd-kv-row">
                  <div className="bcd-kv"><label>Deliverables</label><strong>{safeText(creator.deliverables_completed, '0')} done</strong></div>
                  <div className="bcd-kv"><label>Starting Rate</label><strong>{safeText((cp.rate_card && cp.rate_card.expected_payout) || cp.expectedPayout || creator.budget_range, 'On request')}</strong></div>
                  <div className="bcd-kv"><label>Skills</label><strong>{Array.isArray(cp.skills) && cp.skills.length ? cp.skills.slice(0, 2).join(', ') : safeText(creator.content_style, '—')}</strong></div>
                </div>
                {cp.bio && <p className="bcd-cre-bio">{cp.bio}</p>}
                <div className="bcd-cre-actions">
                  <button className="bcd-cta" onClick={() => creator.id && navigate(`/dashboard/business/creator/${creator.id}`)}><User size={14} /> View Profile</button>
                  <button className="bcd-cta primary" onClick={() => setChatOpen(true)}><MessageSquare size={14} /> Chat</button>
                  {/* Review CTA lives here too so it's reachable even when the deal
                      completed via a dispute (no work-submission card to hang it on). */}
                  {dealCompleted && (myReview
                    ? <span className="bcd-reviewed"><Star size={14} fill="#f5b301" color="#f5b301" /> Rated {myReview.rating}★</span>
                    : <button className="bcd-cta" onClick={() => setReviewOpen(true)}><Star size={14} /> Review</button>
                  )}
                </div>
              </>
            ) : null}

            {/* A brief hires `creators_wanted` creators, so this section stays open
                until every slot is filled — it used to vanish once every pending bid
                was either accepted or the bid list ran dry, which meant a 5-creator
                brief with only 2 bids (both accepted) had no way to close its 3
                permanently-unfillable slots. "Finish hiring" now shows any time slots
                are still open and at least one creator is hired, whether or not any
                bids are left to review. Creators already hired are dropped from the
                bid list below. */}
            {openSlots > 0 && (openBids.length > 0 || hiredIds.length > 0) && (
              <div className="bcd-bids">
                <p className="bcd-bids-h">
                  {hiredIds.length > 0
                    ? `${hiredIds.length} of ${wanted} hired — ${openSlots} slot${openSlots === 1 ? '' : 's'} left. You're only charged when you pick someone.`
                    : `${openBids.length} creator${openBids.length === 1 ? '' : 's'} applied — pick up to ${wanted}. You're only charged when you pick someone.`}
                </p>
                {/* Hired at least one but don't want to fill every slot? Close hiring
                    now and get the unused slots' budget back. */}
                {hiredIds.length > 0 && (
                  <button type="button" className="bcd-finish-hiring" onClick={finishHiring} disabled={finishing} data-testid="finish-hiring-btn">
                    <Check size={14} /> {finishing ? 'Closing…' : `Finish hiring with ${hiredIds.length} — refund ${openSlots} slot${openSlots === 1 ? '' : 's'}`}
                  </button>
                )}
                {openBids.map((b) => (
                  <div key={b.id || b.creator_id} className="bcd-bid">
                    <div className="bcd-bid-top">
                      <span className="bcd-cre-ava sm">{String(b.creator_name || b.creator_nickname || 'C').replace(/^@+/, '').charAt(0).toUpperCase()}</span>
                      <div className="bcd-bid-who">
                        <strong>{String(b.creator_name || b.creator_nickname || 'Creator').replace(/^@+/, '').trim().split(/\s+/)[0]}</strong>
                        <small>{b.estimated_delivery_days ? `${b.estimated_delivery_days} day delivery` : 'Delivery not specified'}</small>
                      </div>
                      <b className="bcd-bid-amt">{inr(b.amount)}</b>
                    </div>
                    {b.proposal && <p className="bcd-bid-msg">{b.proposal}</p>}
                    <div className="bcd-bid-actions">
                      <button className="bcd-cta" onClick={() => navigate(`/dashboard/business/creator/${b.creator_id}`)}>
                        <User size={14} /> View profile
                      </button>
                      <button
                        className="bcd-cta primary"
                        disabled={selecting === b.creator_id}
                        onClick={() => selectCreator(b)}
                      >
                        <Check size={14} /> {selecting === b.creator_id ? 'Selecting…' : `Accept ${inr(b.amount)}`}
                      </button>
                    </div>
                  </div>
                ))}
                {openBids.length === 0 && hiredIds.length > 0 && (
                  <p className="bcd-muted">No more pending bids — waiting for more creators to apply for the remaining {openSlots} slot{openSlots === 1 ? '' : 's'}, or finish hiring above.</p>
                )}
              </div>
            )}

            {!creator && openBids.length === 0 && (
              <p className="bcd-muted">No creator selected yet, and no bids have come in.</p>
            )}
        </div>
        </div>
        </>
        )}
      </div>

      {chatOpen && creator && <ChatPopup user={{ id: creator.id, name: (handle || '').replace('@', ''), photo: creatorPhoto(creator) }} onClose={() => setChatOpen(false)} />}
      {profOpen && creator && <CreatorProfileModal id={creator.id} fallbackName={handle} photo={creatorPhoto(creator)} onClose={() => setProfOpen(false)} onMessage={() => { setProfOpen(false); setChatOpen(true); }} />}
      {detailsOpen && (
        <div className="bcd-drawer-overlay" onClick={() => setDetailsOpen(false)}>
          <aside className="bcd-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="bcd-drawer-head">
              <strong>Campaign Details</strong>
              <button type="button" className="bcd-drawer-close" aria-label="Close" onClick={() => setDetailsOpen(false)}>✕</button>
            </div>
            <div className="bcd-drawer-body">
              <CampaignDetails embedId={id} onClose={() => setDetailsOpen(false)} />
            </div>
          </aside>
        </div>
      )}
      {/* Feed the modal the live fee/allowance so a ₹500 debit is never a surprise —
          these props existed but were never passed, so the warning banner never showed. */}
      {revisionOpen && (
        <VideoReviewModal
          src={assetUrl(wsFiles.find((x) => isVideo(x)) || wsFirst)}
          title={campaign.title}
          watermark={wsStatus !== 'approved'}
          onClose={() => setRevisionOpen(false)}
          onSubmit={submitRevision}
          submitting={revSubmitting}
          freeRemaining={deal?.revision_tracker?.free_revisions_remaining}
          nextFee={deal?.revision_tracker?.next_revision_fee}
        />
      )}

      {reviewOpen && (
        <ReviewModal
          title="Rate this creator"
          subtitle={handle ? `How was working with ${handle.replace(/^@/, '')}?` : undefined}
          onSubmit={submitReview}
          onClose={() => setReviewOpen(false)}
        />
      )}

      {/* Same shipment drawer the dashboard uses — reload on close so the panel's
          tracking id / courier reflect whatever was just entered. */}
      {shipmentOpen && (
        <PageModal drawer maxWidth={560} onClose={() => { setShipmentOpen(false); load(); }}>
          <ShipmentTracking
            embedCampaignId={campaign.id || campaign._id}
            onClose={() => { setShipmentOpen(false); load(); }}
          />
        </PageModal>
      )}

      {videoModal && (
        <div className="bwr-vid-overlay" onClick={() => setVideoModal(null)}>
          <div className="bwr-vid-card" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="bwr-vid-close" aria-label="Close" onClick={() => setVideoModal(null)}>✕</button>
            <div className="bwr-vid-frame">
              <video src={videoModal.src} controls autoPlay playsInline className="bwr-vid-el" />
              {videoModal.watermark && <span className="bwr-wm" aria-hidden="true" />}
            </div>
            {videoModal.title && <div className="bwr-vid-name">{videoModal.title}</div>}
          </div>
        </div>
      )}

      <style>{`
        /* Deal chat — shared thread with the creator */
        .bcd-dchat h3{display:flex;align-items:center;gap:7px;margin:0;font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:16px;color:#15163a}
        .bcd-dchat-sub{margin:4px 0 12px;color:#8b90b0;font-size:13px}
        .bcd-dchat-list{max-height:320px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;padding:4px 2px}
        .bcd-dmsg{max-width:76%;display:flex;flex-direction:column;gap:3px}
        .bcd-dmsg small{font-size:11px;color:#9296ba;font-weight:600}
        .bcd-dmsg p{margin:0;font-size:14px;line-height:1.5;padding:9px 13px;border-radius:13px}
        .bcd-dmsg.is-creator{align-self:flex-start}
        .bcd-dmsg.is-creator p{background:#f1f3fa;color:#2b2f52;border-bottom-left-radius:5px}
        .bcd-dmsg.is-brand{align-self:flex-end;align-items:flex-end}
        .bcd-dmsg.is-brand p{background:#15163a;color:#fff;border-bottom-right-radius:5px}
        .bcd-dmsg.is-system{align-self:center;max-width:90%;text-align:center}
        .bcd-dmsg.is-system p{background:#eef0ff;color:#5b6070;font-size:12.5px;line-height:1.4;padding:7px 15px;border-radius:999px;border:1px solid #e0e4ff}
        .bcd-dchat-empty{margin:0;padding:18px 0;text-align:center;color:#9296ba;font-size:13px}
        .bcd-dchat-input{display:flex;gap:9px;margin-top:12px;padding-top:12px;border-top:1px solid #eef0f6}
        .bcd-dchat-input input{flex:1;min-width:0;border:1px solid #e4e7f2;border-radius:11px;padding:11px 14px;font-family:inherit;font-size:14px;color:#15163a;outline:none}
        .bcd-dchat-input input:focus{border-color:#5b6bff}
        .bcd-dchat-input button{flex:none;width:42px;border:0;border-radius:11px;background:#15163a;color:#fff;cursor:pointer;display:grid;place-items:center}
        .bcd-dchat-input button:disabled{opacity:.45;cursor:not-allowed}

        /* View Details — right-side slide-in drawer */
        .bcd-drawer-overlay{position:fixed;inset:0;z-index:1000;background:rgba(15,22,58,.45);backdrop-filter:blur(2px);display:flex;justify-content:flex-end}
        .bcd-drawer{width:min(680px,100%);height:100%;background:#fff;display:flex;flex-direction:column;box-shadow:-24px 0 60px rgba(15,22,58,.28);animation:bcd-slide .3s cubic-bezier(.2,.7,.2,1)}
        @keyframes bcd-slide{from{transform:translateX(48px);opacity:.5}to{transform:none;opacity:1}}
        .bcd-drawer-head{flex:none;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:18px 24px;border-bottom:1px solid #eef0f6}
        .bcd-drawer-head strong{font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:16px;color:#15163a}
        .bcd-drawer-close{border:0;background:#f1f3fa;color:#15163a;width:34px;height:34px;border-radius:10px;cursor:pointer;font-size:14px;flex:none}
        .bcd-drawer-close:hover{background:#e7eaf6}
        .bcd-drawer-body{flex:1;min-height:0;overflow-y:auto;overflow-x:hidden;padding:22px 24px}
        @media (max-width:600px){.bcd-drawer{width:100%}.bcd-action-details{display:none!important;}}
        .bcd-bc{display:flex;align-items:center;gap:8px;margin-bottom:16px}
        .bcd-bc button{display:inline-flex;align-items:center;gap:6px;color:#5b6bff;font-weight:600;background:none;border:none;cursor:pointer;font-family:inherit;font-size:14px}
        .bcd-bc strong{color:#15163a;font-weight:700;font-size:14px}
        .bcd-top{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;flex-wrap:wrap;padding-bottom:18px;border-bottom:1px solid #eef0f6}
        .bcd-title-wrap{display:flex;flex-direction:column;gap:6px;flex:1;min-width:240px}
        .bcd-badge{align-self:flex-start;font-size:11px;font-weight:800;padding:4px 12px;border-radius:20px;text-transform:uppercase}
        .bcd-badge.live{background:#dcfce7;color:#15a35b}.bcd-badge.done{background:#dcfce7;color:#15a35b}
        .bcd-badge.review{background:#eef0ff;color:#4452f0}
        .bcd-badge.pending{background:#fff7ed;color:#b45309}
        .bcd-badge.rejected{background:#fef2f2;color:#dc2626}
        .bcd-title-wrap h1{margin:0;font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:26px;font-weight:800;color:#15163a}
        .bcd-sub{color:#9296ba;font-size:13px}
        .bcd-budget{display:flex;flex-direction:column;gap:5px;min-width:230px}
        .bcd-budget label{color:#9296ba;font-size:12px;font-weight:600}
        .bcd-budget strong{font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:18px;color:#15163a}
        .bcd-budget strong small{color:#9296ba;font-weight:600;font-size:13px}
        .bcd-budget-bar{height:7px;border-radius:6px;background:#e7e9f7;overflow:hidden}
        .bcd-budget-bar i{display:block;height:100%;background:linear-gradient(90deg,#5b6bff,#23236a)}
        .bcd-pct{color:#585c7e;font-weight:700;font-size:13px;align-self:flex-end}
        .bcd-actions{display:flex;align-items:center;gap:10px}
        .bcd-tabs{display:flex;gap:26px;border-bottom:1px solid #eef0f6;margin:18px 0 22px;flex-wrap:wrap}
        .bcd-tabs button{background:none;border:none;cursor:pointer;font-family:inherit;font-size:15px;font-weight:600;color:#585c7e;padding:0 0 14px;position:relative;white-space:nowrap}
        .bcd-tabs button.is-active{color:#5b6bff}
        .bcd-tabs button.is-active::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:3px;border-radius:3px 3px 0 0;background:linear-gradient(90deg,#5b6bff,#23236a)}
        .bcd-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;align-items:stretch}
        .bcd-grid2{display:grid;grid-template-columns:1.3fr 1fr;gap:20px;margin-top:20px;align-items:start}
        .bcd-card{background:#fff;border:1px solid #eef0f6;border-radius:18px;padding:20px;box-shadow:0 10px 30px -12px rgba(28,30,80,.10)}
        .bcd-revcard{margin-top:16px}
        .bcd-revcard-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
        .bcd-revcard-head h3{margin:0;display:flex;align-items:center;gap:8px}
        .bcd-revcard-count{font-size:12.5px;font-weight:700;color:#7777b7;background:#f3f4fb;border-radius:999px;padding:4px 11px}
        .bcd-revcard-lbl{margin:0 0 8px;font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#9a9ab8}
        .bcd-revlist{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
        .bcd-revlist li{display:flex;align-items:flex-start;gap:9px;flex-wrap:wrap;background:#f8f9fd;border:1px solid #eef0f6;border-radius:11px;padding:11px 13px}
        .bcd-revsev{flex:none;font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.03em;padding:3px 8px;border-radius:6px}
        .bcd-revsev.must{background:#fee2e2;color:#b42318}
        .bcd-revsev.med{background:#fff3d6;color:#b54708}
        .bcd-revsev.nice{background:#e6ecff;color:#3730a3}
        .bcd-revtext{flex:1;min-width:120px;font-size:13.5px;color:#15163a;font-weight:600;line-height:1.45;word-break:break-word}
        .bcd-revref{flex:none;font-size:11.5px;font-weight:700;color:#5b6bff;background:#eef0ff;border-radius:6px;padding:3px 8px;align-self:center}
        .bcd-revempty{margin:0;color:#9a9ab8;font-size:13px}
        .bcd-revcard-foot{margin-top:14px;display:flex;gap:24px;flex-wrap:wrap}
        .bcd-revcard-foot span{display:flex;flex-direction:column;gap:4px}
        .bcd-revcard-foot small{font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:#9a9ab8}
        .bcd-revcard-foot strong{font-size:13.5px;color:#15163a;font-weight:600}
        .bcd-revcard-answer{margin:14px 0 0;padding:11px 14px;border-radius:10px;font-size:13px;font-weight:600;line-height:1.45}
        .bcd-revcard-answer.ok{background:#e7f7ee;border:1px solid #b7e6cd;color:#067647}
        .bcd-revcard-answer.bad{background:#fff4f2;border:1px solid #ffd2c9;color:#b42318}
        .bcd-revcard-answer.wait{background:#fff8e8;border:1px solid #fbe3b4;color:#b54708}
        .bcd-card h3{margin:0 0 16px;font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:16px;font-weight:700;color:#15163a}
        .bcd-step{display:flex;gap:12px;position:relative;padding-bottom:18px}
        .bcd-step:last-child{padding-bottom:0}
        .bcd-step::before{content:"";position:absolute;left:10px;top:22px;bottom:0;width:2px;background:#e7e9f7}
        .bcd-step:last-child::before{display:none}
        .bcd-step.done::before{background:#15a35b}
        .bcd-step-dot{width:22px;height:22px;border-radius:50%;border:2px solid #dfe2f0;background:#fff;flex:none;display:grid;place-items:center;z-index:2;color:#fff}
        .bcd-step.done .bcd-step-dot{background:#15a35b;border-color:#15a35b}
        .bcd-step.current .bcd-step-dot{border-color:#5b6bff;box-shadow:0 0 0 3px rgba(91,107,255,.2)}
        .bcd-step-info strong{display:block;font-size:14px;color:#15163a}
        .bcd-step-info small{color:#9296ba;font-size:12.5px}
        .bcd-step.todo .bcd-step-info strong{color:#9296ba}
        .bcd-pill{display:inline-block;font-size:11.5px;font-weight:800;padding:5px 12px;border-radius:20px;text-transform:uppercase}
        .bcd-pill.ok{background:#dcfce7;color:#15a35b}.bcd-pill.info{background:#e0e7ff;color:#4452f0}.bcd-pill.warn{background:#fdf2e0;color:#d98314}
        /* Left column (Progress + Deliverables stacked) beside the Creator card */
        /* Shipment details always show, so the layout is static — both columns
           stretch to equal height and Deliverables fills the left column. */
        .bcd-row-main{display:grid;grid-template-columns:1.4fr 1fr;gap:20px;align-items:stretch}
        /* min-width:0 lets the columns shrink instead of a wide child (the horizontal
           stepper / long deliverables text) forcing the whole page off-screen. */
        .bcd-row-main > *,.bcd-col-left,.bcd-col-left > *,.bcd-card{min-width:0;max-width:100%}
        .bcd-col-left{display:flex;flex-direction:column;gap:20px}
        .bcd-col-left .bcd-deliver-card{flex:1}
        .bcd-creator-card{display:flex;flex-direction:column}
        .bcd-creator-card .bcd-creator{margin-bottom:4px}
        .bcd-creator-card .bcd-cre-actions{margin-top:auto}
        .bcd-cre-tabs{display:flex;flex-wrap:wrap;gap:8px;margin:2px 0 14px}
        .bcd-cre-tab{display:inline-flex;align-items:center;gap:7px;padding:5px 12px 5px 6px;border:1px solid #e2e6ff;background:#fff;color:#4a4f78;font-size:13px;font-weight:600;border-radius:999px;cursor:pointer}
        .bcd-cre-tab:hover{border-color:#c3caff;background:#f6f7ff}
        .bcd-cre-tab.is-active{border-color:#4452f0;background:#eef0ff;color:#2a34b8}
        .bcd-cre-tab-ava{width:26px;height:26px;border-radius:50%;flex:none;overflow:hidden;display:grid;place-items:center;background:linear-gradient(135deg,#5b6bff,#23236a);color:#fff;font-weight:800;font-size:12px}
        .bcd-cre-tab-ava img{width:100%;height:100%;object-fit:cover}
        /* inline shipment detail panel */
        .bcd-pill-btn.on{background:#eef0ff;border-color:#cdd2f3}
        .bcd-ship-detail{display:flex;flex-wrap:wrap;gap:16px 32px;align-items:flex-end;margin-top:22px;padding-top:18px;border-top:1px solid #eef0f6}
        .bcd-ship-detail .bcd-kv{margin-top:0}
        .bcd-ship-full{margin-left:auto;border:1px solid #dfe2ff;background:#eef0ff;color:#5b6bff;border-radius:10px;padding:8px 16px;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer}
        .bcd-ship-full:hover{background:#e2e5ff}
        .bcd-ship-btn{margin-left:auto;display:inline-flex;align-items:center;gap:7px;border:0;background:#5b6bff;color:#fff;border-radius:10px;padding:9px 16px;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer}
        .bcd-ship-btn:hover{background:#4452f0}
        .bcd-ship-wait{margin-left:auto;color:#8a90a6;font-size:12.5px;font-weight:600}
        @media (max-width:980px){.bcd-row-main{grid-template-columns:1fr;align-items:start}}
        @media (max-width:760px){
          .bcd-top{align-items:center;flex-wrap:wrap;}
          .bcd-title-wrap{flex:1 1 100%;min-width:0;}
          .bcd-budget{flex:1 1 auto;min-width:0;max-width:calc(100% - 150px);}
          .bcd-actions{flex:none;margin-left:auto;}
          .bcd-actions button{flex:none;}
        }
        /* horizontal campaign progress */
        .bcd-progress-card{margin-bottom:0}
        .bcd-progress-head{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:4px}
        .bcd-progress-head h3{margin:0}
        .bcd-progress-ship{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .bcd-pill-btn{display:inline-flex;align-items:center;gap:6px;border:1px solid #e0e3f0;background:#fff;color:#5b6bff;border-radius:20px;padding:5px 12px;font-size:12.5px;font-weight:700;cursor:pointer;font-family:inherit}
        .bcd-pill-btn:hover{border-color:#cdd2f3;background:#f7f8ff}
        .bcd-hsteps{display:flex;align-items:flex-start;margin-top:20px}
        .bcd-hstep{flex:1;display:flex;flex-direction:column;align-items:center;text-align:center;position:relative;padding:0 6px}
        .bcd-hstep::before{content:"";position:absolute;top:13px;left:-50%;width:100%;height:2px;background:#e7e9f7;z-index:0}
        .bcd-hstep:first-child::before{display:none}
        .bcd-hstep.done::before{background:#15a35b}
        .bcd-hstep-dot{width:28px;height:28px;border-radius:50%;border:2px solid #dfe2f0;background:#fff;display:grid;place-items:center;z-index:1;color:#fff}
        .bcd-hstep.done .bcd-hstep-dot{background:#15a35b;border-color:#15a35b}
        .bcd-hstep.current .bcd-hstep-dot{border-color:#5b6bff;box-shadow:0 0 0 3px rgba(91,107,255,.2)}
        .bcd-hstep strong{display:block;margin-top:9px;font-size:13px;color:#15163a;line-height:1.25}
        .bcd-hstep small{color:#9296ba;font-size:11.5px;margin-top:2px}
        .bcd-hstep.todo strong{color:#9296ba}
        /* Mobile: the mini summary bar replaces the full horizontal stepper. */
        .bcd-progress-mini{display:none}
        .bcd-vsteps{display:none}
        @media (max-width:720px){
          .bcd-hsteps{display:none}

          .bcd-progress-mini{
            display:flex;flex-direction:column;gap:16px;width:100%;margin-top:16px;
            background:#f6f7ff;border:1px solid #e6e9ff;border-radius:16px;padding:16px;
            font-family:inherit;text-align:left;cursor:pointer;
          }
          .bcd-progress-mini-top{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
          .bcd-progress-mini-end{display:flex;flex-direction:column;gap:2px}
          .bcd-progress-mini-end.right{align-items:flex-end;text-align:right}
          .bcd-progress-mini-end strong{font-size:13px;color:#15163a;font-weight:700}
          .bcd-progress-mini-end small{font-size:11px;color:#9296ba}
          .bcd-progress-mini-track{position:relative;height:28px}
          .bcd-progress-mini-track::before{content:"";position:absolute;left:0;right:0;top:50%;height:2px;background:#dfe2f7;transform:translateY(-50%)}
          .bcd-progress-mini-fill{position:absolute;left:0;top:50%;height:2px;background:#5b6bff;transform:translateY(-50%);transition:width .3s ease}
          .bcd-progress-mini-dot{position:absolute;top:50%;width:9px;height:9px;border-radius:50%;background:#5b6bff;transform:translate(-50%,-50%);z-index:1}
          .bcd-progress-mini-dot.start{left:0}
          .bcd-progress-mini-dot.end{left:100%}
          .bcd-progress-mini-marker{
            position:absolute;top:50%;width:30px;height:30px;border-radius:50%;
            background:#5b6bff;color:#fff;display:grid;place-items:center;z-index:2;
            transform:translate(-50%,-50%);box-shadow:0 6px 14px -4px rgba(91,107,255,.6);
            transition:left .3s ease;
          }
          .bcd-progress-mini-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:12.5px;font-weight:700;color:#5b6bff}
          .bcd-progress-mini-foot span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
          .bcd-progress-mini-chev{flex:none;transition:transform .2s ease}
          .bcd-progress-mini[aria-expanded="true"] .bcd-progress-mini-chev{transform:rotate(90deg)}

          /* Full timeline, revealed on tap — a vertical dot-and-line list. */
          .bcd-vsteps{display:flex;flex-direction:column;margin-top:14px;padding:2px 4px 0}
          .bcd-vstep{display:flex;gap:12px;position:relative;padding-bottom:22px}
          .bcd-vstep:last-child{padding-bottom:0}
          .bcd-vstep::before{content:"";position:absolute;left:10px;top:22px;bottom:0;width:2px;background:#e7e9f7}
          .bcd-vstep:last-child::before{display:none}
          .bcd-vstep.done::before{background:#15a35b}
          .bcd-vstep-dot{flex:none;width:21px;height:21px;border-radius:50%;border:2px solid #dfe2f0;background:#fff;display:grid;place-items:center;color:#fff;z-index:1}
          .bcd-vstep.done .bcd-vstep-dot{background:#15a35b;border-color:#15a35b}
          .bcd-vstep.current .bcd-vstep-dot{border-color:#5b6bff;box-shadow:0 0 0 3px rgba(91,107,255,.2)}
          .bcd-vstep-body strong{display:block;font-size:13.5px;color:#15163a;font-weight:700}
          .bcd-vstep-body small{color:#9296ba;font-size:12px}
          .bcd-vstep:not(.done):not(.current) .bcd-vstep-body strong{color:#9296ba}
        }
        .bcd-ship-on{color:#585c7e;font-size:13px;margin:12px 0 2px}
        .bcd-ship-date{font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:20px;font-weight:800;color:#15163a;margin-bottom:8px}
        .bcd-kv{display:flex;flex-direction:column;gap:2px;margin-top:12px}
        .bcd-kv label{color:#9296ba;font-size:12px;font-weight:600}
        .bcd-kv strong{color:#15163a;font-size:15px}
        /* creator detail fields side by side */
        .bcd-kv-row{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:14px;padding:14px 0 0 14px;border-top:1px solid #eef0f6}
        .bcd-kv-row + .bcd-kv-row{border-top:none;padding-top:0;margin-top:16px}
        .bcd-kv-row .bcd-kv{margin-top:0}
        .bcd-cre-bio{margin:18px 0 0;color:#585c7e;font-size:13.5px;line-height:1.55}
        .bcd-cre-work{margin-top:16px}
        .bcd-cre-work > label{display:block;color:#9296ba;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;margin-bottom:8px}
        .bcd-cre-work-row{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
        .bcd-work-tile{position:relative;aspect-ratio:3/4;border-radius:10px;overflow:hidden;background:#0b1020;cursor:pointer}
        .bcd-work-tile video,.bcd-work-tile img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
        .bcd-work-play{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,.9);display:grid;place-items:center;color:#5b6bff;pointer-events:none}
        .bcd-reviewed,.bwr-reviewed{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:#15803d;padding:6px 2px}
        .bcd-cre-actions{display:flex;gap:8px;margin-top:18px;flex-wrap:nowrap}
        .bcd-cre-actions .bcd-cta{margin-top:0;flex:1 1 0;min-width:0;width:auto;padding:8px 10px;font-size:12.5px;gap:6px}
        @media (max-width:520px){.bcd-kv-row{grid-template-columns:1fr 1fr}.bcd-cre-actions{flex-direction:column}}
        .bcd-cta{width:100%;margin-top:14px;display:inline-flex;align-items:center;justify-content:center;gap:8px;border:1px solid #e9ebf4;background:#fff;color:#5b6bff;border-radius:12px;padding:10px;font-weight:700;font-size:13.5px;cursor:pointer;font-family:inherit;white-space:nowrap}
        .bcd-cta:hover{border-color:#cdd2f3}
        .bcd-cta.primary{background:#07074e;border-color:#07074e;color:#fff}
        .bcd-cta.primary:hover{background:linear-gradient(100deg,#2e2e94,#1e1e70);border-color:#2e2e94}
        .bcd-cta-ship{margin-top:10px}
        .bcd-bids{display:flex;flex-direction:column;gap:10px}
        .bcd-bids-h{margin:0 0 2px;font-size:13px;color:#6b6f95;font-weight:600}
        .bcd-finish-hiring{display:inline-flex;align-items:center;gap:6px;align-self:flex-start;margin:0 0 4px;padding:8px 12px;border:1px solid #cdd4ff;background:#f2f4ff;color:#4452f0;font-size:12.5px;font-weight:700;border-radius:10px;cursor:pointer}
        .bcd-finish-hiring:hover{background:#e8ecff}
        .bcd-finish-hiring:disabled{opacity:.6;cursor:default}
        .bcd-bid{border:1px solid #e8ecff;border-radius:12px;padding:12px 14px;background:#fbfcff}
        .bcd-bid-top{display:flex;align-items:center;gap:10px}
        .bcd-bid-who{flex:1;min-width:0}
        .bcd-bid-who strong{display:block;font-size:14px;color:#15163a}
        .bcd-bid-who small{color:#9296ba;font-size:12px}
        .bcd-bid-amt{font-size:15px;color:#07074e;white-space:nowrap}
        .bcd-bid-msg{margin:8px 0 0;font-size:13px;color:#5c608a;line-height:1.5;
          display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
        .bcd-bid-actions{display:flex;gap:8px;margin-top:10px}
        .bcd-bid-actions .bcd-cta{flex:1;justify-content:center;padding:8px 10px;font-size:13px}
        .bcd-cre-ava.sm{width:34px;height:34px;font-size:13px;flex:none}
        .bcd-creator{display:flex;align-items:center;gap:12px;margin-bottom:6px}
        .bcd-cre-ava{width:48px;height:48px;border-radius:50%;flex:none;overflow:hidden;display:grid;place-items:center;background:linear-gradient(135deg,#5b6bff,#23236a);color:#fff;font-weight:800;font-size:18px}
        .bcd-cre-ava img{width:100%;height:100%;object-fit:cover}
        .bcd-creator strong{display:block;font-size:15.5px;color:#15163a}
        .bcd-creator small{color:#9296ba;font-size:13px;text-transform:capitalize}
        .bcd-about-card h3{color:#5b6bff}
        /* About details laid out in two columns (each "Label: value" is one cell) */
        .bcd-about{margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px 48px;align-content:start;min-width:0}
        .bcd-bl{color:#585c7e;font-size:14px;line-height:1.6;margin:0;padding:10px 0;border-bottom:1px solid #f3f4fb;word-break:break-word;overflow-wrap:anywhere;min-width:0}
        .bcd-blab{display:block;color:#15163a;font-weight:700;margin-bottom:3px;white-space:normal}
        .bcd-bl-val{display:block;color:#4b4f7e;line-height:1.7;white-space:normal;word-break:break-word;overflow-wrap:anywhere;margin-top:6px}
        .bcd-bl-val-list{display:flex;flex-direction:column;gap:6px;margin-top:6px}
        .bcd-bl-val-item{padding:10px 12px;border-radius:16px;background:#f6f7ff;color:#364072;font-size:14px;line-height:1.6;word-break:break-word;overflow-wrap:anywhere}
        .bcd-bl-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;min-width:0}
        .bcd-bl-list-item{display:inline-flex;padding:6px 10px;border-radius:999px;background:#eef0ff;color:#30356a;font-size:13px;line-height:1.4;word-break:break-word;overflow-wrap:anywhere;max-width:100%}
        .bcd-bsub{grid-column:1/-1;color:#5b6bff;font-weight:800;font-size:12.5px;text-transform:uppercase;letter-spacing:.5px;margin:14px 0 2px}
        .bcd-bl-item{grid-column:1/-1;padding-left:14px;position:relative}
        @media (max-width:760px){.bcd-about{grid-template-columns:1fr;gap:0}}
        .bcd-bl-item::before{content:"";position:absolute;left:2px;top:9px;width:5px;height:5px;border-radius:50%;background:#cdd2f3}
        .bcd-bgap{height:4px}
        .bcd-more{display:inline-flex;align-items:center;gap:5px;margin-top:12px;padding:8px 16px;border-radius:30px;border:1px solid #dfe2ff;background:#eef0ff;color:#5b6bff;font-family:inherit;font-weight:700;font-size:13px;cursor:pointer;transition:.18s}
        .bcd-more:hover{background:#e2e5ff}
        .bcd-more-down{transform:rotate(90deg)}
        .bcd-more-up{transform:rotate(-90deg)}
        .bcd-deliver{display:flex;align-items:flex-start;gap:9px;color:#585c7e;font-size:14px;line-height:1.5;padding:7px 0;min-width:0;overflow-wrap:anywhere}
        .bcd-deliver svg{color:#15a35b;flex:none;margin-top:2px}
        .bcd-muted{color:#9296ba;font-size:14px;margin:0}
        @media (max-width:980px){.bcd-grid{grid-template-columns:1fr}.bcd-grid2{grid-template-columns:1fr}}
        @media (max-width:600px){
          .bcd-top{gap:14px;align-items:center;}
          .bcd-title-wrap{flex:1 1 100%;min-width:0}
          .bcd-title-wrap h1{font-size:22px;word-break:break-word}
          .bcd-budget{min-width:0;flex:1 1 auto;max-width:calc(100% - 140px)}
          .bcd-actions{flex:none;margin-left:auto;gap:8px}
          .bcd-actions button{flex:none;justify-content:center;min-width:120px}
          /* Spread the three tabs evenly across the row on mobile. */
          .bcd-tabs{gap:18px;overflow-x:auto;-webkit-overflow-scrolling:touch;flex-wrap:nowrap;justify-content:flex-start;padding-left:16px}
          .bcd-tabs .bcd-tab-right{margin-left:0}
          .bcd-revcard-foot{gap:16px}
        }
      `}</style>

      {dupOpen && (
        // Save the duplicated brief as a draft on the way out, so an accidental
        // backdrop click doesn't discard it.
        <div className="cmk-brief-overlay" onClick={closeDup}>
          <div className="cmk-brief-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="cmk-brief-close" aria-label="Close" onClick={closeDup}>✕</button>
            <PostABrief
              ref={dupRef}
              duplicateId={campaign.id || campaign._id}
              onClose={closeDup}
              onPublished={() => { setDupOpen(false); navigate('/dashboard/business/all-campaigns'); }}
            />
          </div>
        </div>
      )}
    </BrandTopNavLayout>
  );
}
