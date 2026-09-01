import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import BookingCard from '../components/BookingCard';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Archive,
  Bookmark,
  Briefcase,
  CheckCheck,
  CheckCircle,
  ChevronDown,
  Clock,
  FileCheck,
  FileText,
  Headphones,
  Image,
  IndianRupee,
  LayoutDashboard,
  MessageSquare,
  MoreHorizontal,
  Package,
  Paperclip,
  Play,
  RotateCcw,
  Send,
  Settings,
  ShieldAlert,
  Smile,
  Star,
  ClipboardList,
  Upload,
  User,
  X,
  Zap
} from 'lucide-react';
import { EmptyPanel, formatMoney, getInitial } from '../components/CreatorComponents';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import { openHelpDialog } from '../components/HoverSideRail';
import ReviewModal from '../components/ReviewModal';
import VideoReviewModal from '../components/VideoReviewModal';
import ShippingDetailsCard from '../components/ShippingDetailsCard';
import { Skeleton } from '../components/Skeleton';
import './CreatorDashboard.css';
import './MyDealsPage.css';
import '../styles/creator-marketplace.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const DEAL_STATES = [
  'Accepted - Awaiting Shipment',
  'Shipped - In Transit',
  'Delivered - Awaiting Receipt Confirmation',
  'Received - Content in Progress',
  'Content Submitted - Awaiting Review',
  'Revision Requested',
  'Approved - Payment Processing',
  'Paid - Complete'
];

const EXCEPTION_STATES = ['Disputed', 'Damaged/Wrong Product Reported'];

const ACTION_CARD_TYPES = {
  'Milestone Update': 'milestone_update',
  'Add Evidence': 'damage_report',
  'Damage Report': 'damage_report',
  'Escalate to Admin': 'escalate_to_admin',
  'Raise Dispute': 'raise_dispute',
  'Message Support': 'escalate_to_admin'
};

function DealCard({ children, className = '' }) {
  return <section className={`deal-card ${className}`}>{children}</section>;
}

function UploadZone({ icon: Icon, label, accept, uploaded, onClick, disabled, previewUrl, previewType, watermark }) {
  const showPreview = uploaded && previewUrl;
  return (
    <button type="button" className={`deal-upload ${uploaded ? 'is-uploaded' : ''} ${showPreview ? 'has-preview' : ''}`} onClick={onClick} disabled={disabled}>
      {showPreview ? (
        <div className="deal-upload-preview">
          {previewType === 'video' ? (
            // #t=0.5 nudges the browser to render a real frame instead of a black poster
            <video src={`${getAssetUrl(previewUrl)}#t=0.5`} muted playsInline preload="metadata" />
          ) : (
            <img src={getAssetUrl(previewUrl)} alt="Uploaded preview" />
          )}
          {watermark && <span className="deal-upload-watermark" aria-hidden="true" />}
        </div>
      ) : (
        <>
          <span><Icon size={22} strokeWidth={1.6} /></span>
          <strong>{uploaded ? 'File uploaded successfully' : label}</strong>
          <small>{uploaded ? 'Ready for submission' : accept}</small>
        </>
      )}
    </button>
  );
}

// Render a brief blob nicely: every "Label: value" line gets a consistent bold
// label, so the dense brief text becomes scannable instead of one flat paragraph.
function BriefContent({ content }) {
  if (!content) return <p className="cmk-dr-brief-row">Not specified</p>;
  const lines = String(content).split(/\r?\n/);
  return (
    <>
      {lines.map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} className="cmk-dr-brief-gap" />;
        // Budget visibility is a brand-only setting — never surface it to creators.
        if (/^budget visibility\s*:/i.test(t)) return null;
        const m = t.match(/^([A-Z][^:]{0,40}):\s*(.*)$/);
        if (m && m[2]) return <p key={i} className="cmk-dr-brief-row"><strong>{m[1]}:</strong> {m[2]}</p>;
        if (m) return <p key={i} className="cmk-dr-brief-row"><strong>{m[1]}:</strong></p>;
        return <p key={i} className="cmk-dr-brief-row">{t}</p>;
      })}
    </>
  );
}

function normalizeDash(value) {
  return String(value || '').replace(/\s*(?:\u2014|\u2013|-)\s*/g, ' - ');
}

function stateKey(value) {
  return normalizeDash(value).toLowerCase();
}

function getState(deal) {
  return normalizeDash(deal?.current_state || deal?.campaign_status || deal?.campaign?.status || 'Status unavailable');
}

function isDamageState(dealOrState) {
  const value = typeof dealOrState === 'string' ? dealOrState : getState(dealOrState);
  return stateKey(value) === stateKey('Damaged/Wrong Product Reported');
}

function getBrandHandle(deal) {
  // Company name from the form — never the "@nickname" handle. Strip any "@".
  const raw = deal?.brand?.name || deal?.campaign?.brand_name || deal?.campaign?.business_name
    || deal?.brand?.handle || deal?.campaign?.brand_handle || deal?.campaign?.business_nickname || '';
  return String(raw).replace(/^@+/, '').trim() || 'Brand';
}

function getDealTitle(deal) {
  return deal?.campaign?.title || 'Untitled campaign';
}

function getDealDeadline(deal) {
  return deal?.deadline || deal?.next_deadline_at || deal?.state_started_at || null;
}

function getCountdownLabel(deal) {
  if (isDamageState(deal)) return 'Creator timeline paused';
  const hours = deal?.deadline_countdown_hours;
  if (typeof hours === 'number') return `${Math.max(0, Math.round(hours))} hrs left`;
  return 'Deadline pending';
}

function formatDateTime(dateValue) {
  if (!dateValue) return 'Not scheduled';
  return new Date(dateValue).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function formatDate(dateValue) {
  if (!dateValue) return 'Not available';
  return new Date(dateValue).toLocaleDateString('en-IN');
}

// Humanize a version/submission status into a label + color tone for the badge.
const VERSION_STATUS_LABELS = {
  submitted: 'Submitted',
  approved: 'Approved',
  revision_requested: 'Revision requested',
  superseded: 'Superseded',   // replaced by a newer cut — never got its own verdict
};

function versionStatusMeta(status) {
  const raw = (status || '').toLowerCase();
  const label = VERSION_STATUS_LABELS[raw] || (status || 'Pending').replace(/_/g, ' ');
  let tone = 'warn';
  if (raw === 'superseded') return { label, tone: 'muted' };
  if (raw.includes('approv')) tone = 'ok';
  else if (raw.includes('reject') || raw.includes('revision') || raw.includes('declin')) tone = 'bad';
  else if (raw.includes('await') || raw.includes('pending') || raw.includes('review')) tone = 'warn';
  return { label, tone };
}

function getEscrowAmount(deal) {
  return Number(deal?.escrow?.held_amount ?? deal?.escrow?.amount ?? deal?.my_bid?.amount ?? 0);
}

function getDealId(deal) {
  return deal?.deal_id || deal?.campaign?.deal_id || deal?.campaign?.id || 'Deal ID unavailable';
}

function getRequiredAssets(deal) {
  return deal?.content_submission?.required_assets || {};
}

function getDamageReport(deal) {
  const receipt = deal?.receipt || {};
  const damageCards = (deal?.action_cards || []).filter((card) => card.type === 'damage_report');
  const damageCard = damageCards[damageCards.length - 1];
  const damageEvent = (deal?.activity_feed || []).find((event) => event.event_type === 'dispute_raised' || event.event_type === 'damage_report');
  const evidence = [
    ...damageCards.flatMap((card) => card.attachment_urls || []),
    receipt.unboxing_video_url
  ].filter(Boolean);

  return {
    submittedOn: damageCard?.created_at || damageEvent?.timestamp || receipt.received_at,
    reason: damageCard?.title || 'Damaged / Wrong Product Reported',
    description: damageCard?.message || receipt.damage_report || 'Damage report submitted by creator.',
    evidenceUrls: evidence,
    evidenceCount: evidence.length,
    hasUnboxing: Boolean(receipt.unboxing_video_url),
    status: damageCard?.status === 'resolved' ? 'Resolved' : 'Under Admin Review'
  };
}

function isState(dealOrState, state) {
  const value = typeof dealOrState === 'string' ? dealOrState : getState(dealOrState);
  return stateKey(value) === stateKey(state);
}

function getAssetUrl(url) {
  if (!url) return '';
  return url.startsWith('http') ? url : `${BACKEND_URL}${url}`;
}

function canSubmitUploadedAssets(deal, uploads) {
  const required = getRequiredAssets(deal);
  if (!uploads.finalVideoUrl) return false;
  if (required.caption_script && !uploads.captionUrl) return false;
  if (required.thumbnail && !uploads.thumbnailUrl) return false;
  if (required.raw_footage && !uploads.rawFootageUrl) return false;
  return Boolean(deal?.can_submit_content);
}

function isCancelledDeal(deal) {
  const status = stateKey(deal?.status || deal?.campaign_status || deal?.campaign?.status || '');
  return status === 'cancelled' || isState(deal, 'Cancelled');
}

function getPrimaryActionConfig(deal, uploads, submitting) {
  if (!deal) return { label: 'No deal selected', disabled: true, type: 'none' };
  // A deal cancelled by the brand is terminal — never offer "Submit Content" (or any
  // active action) on it, even if a stale response still reports a content-stage state.
  if (isCancelledDeal(deal)) return { label: 'Deal Cancelled', disabled: true, type: 'passive' };
  if (isDamageState(deal)) return { label: 'Add Evidence', disabled: false, type: 'add_evidence' };
  if (isState(deal, 'Paid - Complete')) return { label: 'Archive Deal', disabled: false, type: 'archive' };
  if (isState(deal, 'Delivered - Awaiting Receipt Confirmation')) {
    return {
      label: 'Mark Received',
      disabled: !deal.can_mark_received || !uploads.unboxingVideoUrl,
      type: 'receipt'
    };
  }
  if (isState(deal, 'Received - Content in Progress') || isState(deal, 'Revision Requested')) {
    return {
      label: submitting ? 'Submitting...' : isState(deal, 'Revision Requested') ? 'Submit Revision' : 'Submit Content',
      disabled: submitting || !canSubmitUploadedAssets(deal, uploads),
      type: 'content'
    };
  }
  // Deal just accepted and a product has to be shipped. The backend's
  // primary_next_action here is "Upload shipment tracking" — that's the BRAND's job,
  // and showing it to the creator as a dead, greyed-out button is just confusing.
  // The creator's real job is to confirm where the product should be sent.
  if (isState(deal, 'Accepted - Awaiting Shipment')) {
    const needsShipping = deal?.shipment?.required || deal?.campaign?.requires_shipment;
    if (needsShipping) {
      // Once the creator has saved their address there is nothing left for them to do
      // here — the ball is with the brand. Keeping the "Confirm" call-to-action live
      // made it look like the submission never registered.
      if (deal?.shipment?.creator_address_confirmed) {
        return { label: 'Delivery Address Submitted', disabled: true, type: 'ship_address_done' };
      }
      return { label: 'Confirm Delivery Address', disabled: false, type: 'ship_address' };
    }
  }
  // The product is on its way to (or back from) the creator and the backend's next
  // action is "Track shipment". As a passive button it was dead — make it live and open
  // the courier's tracking page. Only enable it once the brand has attached a tracking URL.
  if (stateKey(deal.primary_next_action || '').includes('track')) {
    return {
      label: deal.primary_next_action || 'Track shipment',
      disabled: !deal?.shipment?.courier_tracking_url,
      type: 'track_shipment'
    };
  }
  return {
    label: deal.primary_next_action || 'Waiting',
    disabled: true,
    type: 'passive'
  };
}

// Deal Room tab keys (also the URL `?tab=` values).
const TAB_KEYS = ['overview', 'brief', 'deliverables', 'timeline', 'payments'];

// Which tab holds the task for the current status, so the status pill can jump
// straight to it. Prefer the primary action's type (it already encodes the next
// task); fall back to the state string for passive/waiting states.
const TASK_TAB_BY_ACTION = {
  content: 'deliverables',        // submit content / submit revision (RevisionTracker + ContentSubmission)
  add_evidence: 'deliverables',   // dispute — upload damage evidence
  receipt: 'deliverables',        // mark received / unboxing (ShippingBlock)
  ship_address: 'overview',       // confirm delivery address — that block lives in Overview
  ship_address_done: 'overview',
  track_shipment: 'timeline',
  archive: 'payments',
};
function taskTabFor(primaryAction, state) {
  const byAction = TASK_TAB_BY_ACTION[primaryAction?.type];
  if (byAction) return byAction;
  const s = stateKey(state);
  if (/revision|review|dispute|damaged/.test(s)) return 'deliverables';
  if (/paid|approved|payment/.test(s)) return 'payments';
  return 'overview';
}

// Reference stepper. "Shipped" is an EARLY step (the product goes to the creator
// BEFORE they produce content), so it sits right after Accepted — not near the end.
// It only appears for deals that actually ship a product; digital-only deals skip it.
const DEAL_STEPS_SHIP = ['Accepted', 'Shipped', 'In Progress', 'Submitted', 'In Review', 'Approved', 'Paid'];
const DEAL_STEPS_NOSHIP = ['Accepted', 'In Progress', 'Submitted', 'In Review', 'Approved', 'Paid'];
const STEP_SUBS_SHIP = ['Deal accepted', 'Product on the way', 'Working on it', 'Waiting for you', 'Waiting for review', 'Waiting for approval', 'Waiting for payout'];
const STEP_SUBS_NOSHIP = ['Deal accepted', 'Working on it', 'Waiting for you', 'Waiting for review', 'Waiting for approval', 'Waiting for payout'];
const dealSteps = (hasShipping) => (hasShipping ? DEAL_STEPS_SHIP : DEAL_STEPS_NOSHIP);
const dealSubs = (hasShipping) => (hasShipping ? STEP_SUBS_SHIP : STEP_SUBS_NOSHIP);

function getDealStepIndex(state, hasShipping) {
  const s = stateKey(state);
  const steps = dealSteps(hasShipping);
  const at = (label) => Math.max(0, steps.indexOf(label));
  if (s.includes('paid')) return at('Paid');
  if (s.includes('approved')) return at('Approved');
  if (s.includes('await') && s.includes('review')) return at('In Review');
  if (s.includes('content submitted')) return at('Submitted');
  // Revision / received / delivered / in-progress all mean "creator is working".
  if (s.includes('revision') || s.includes('content in progress') || s.includes('received') || s.includes('delivered')) return at('In Progress');
  // In transit to the creator — only a step when the deal ships.
  if (hasShipping && (s.includes('shipped') || s.includes('transit'))) return at('Shipped');
  return at('Accepted');   // accepted / awaiting-shipment / anything earlier
}

// Build a display-only deliverables summary from the deal's content submission.
function buildDeliverables(deal) {
  const content = deal?.content_submission || {};
  const required = content.required_assets || {};
  const versions = content.versions || [];
  const latest = versions.length ? versions[versions.length - 1] : null;
  const videoMeta = latest ? versionStatusMeta(latest.status) : { label: 'Pending', tone: 'warn' };
  const rows = [{ name: 'Final Video', meta: 'Format: MP4 · Platform: Reels', status: videoMeta, done: latest?.status === 'approved' }];
  if (required.caption_script) rows.push({ name: 'Caption / Script', meta: '.txt / .docx', status: { label: 'Pending', tone: 'warn' }, done: false });
  if (required.thumbnail) rows.push({ name: 'Thumbnail', meta: 'JPG / PNG', status: { label: 'Pending', tone: 'warn' }, done: false });
  if (required.raw_footage) rows.push({ name: 'Raw Footage', meta: 'MP4 / MOV', status: { label: 'Pending', tone: 'warn' }, done: false });
  return rows;
}

export default function MyDealsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [deals, setDeals] = useState([]);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [brandReviewFor, setBrandReviewFor] = useState(null); // completed deal awaiting a brand rating
  const reviewPromptedRef = useRef({});                       // campaignId -> already asked this session
  const [loading, setLoading] = useState(true);
  const [briefOpen, setBriefOpen] = useState(false);
  const [fullBrief, setFullBrief] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);
  // Open on the tab named by ?tab= (deep-linkable, survives refresh/back), else Overview.
  const [leftTab, setLeftTab] = useState(() => {
    const t = searchParams.get('tab');
    return TAB_KEYS.includes(t) ? t : 'overview';
  });
  const mainRef = useRef(null);   // tabbed <main> — scroll target when jumping to a task
  const [chatOpen, setChatOpen] = useState(false);
  // Bumped when the chat is marked seen, to re-read the per-deal seen count from
  // localStorage so the unread badge clears. (Declared here — above the early
  // returns — to satisfy the rules of hooks.)
  const [, setChatSeenTick] = useState(0);
  const [message, setMessage] = useState('');
  const [messageAttachments, setMessageAttachments] = useState([]);
  const [finalVideoUrl, setFinalVideoUrl] = useState(null);
  const [captionUrl, setCaptionUrl] = useState(null);
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [rawFootageUrl, setRawFootageUrl] = useState(null);
  const [unboxingVideoUrl, setUnboxingVideoUrl] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(null);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mobileSection, setMobileSection] = useState('workspace');
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [stepsExpanded, setStepsExpanded] = useState(false);
  const stepsRef = useRef(null);
  const evidenceInputRef = useRef(null);
  const shipAddressRef = useRef(null);   // "Confirm Delivery Address" scrolls here

  const toggleStepsWithoutJump = () => {
    const stepper = stepsRef.current;
    if (!stepper) {
      setStepsExpanded((expanded) => !expanded);
      return;
    }

    const topBefore = stepper.getBoundingClientRect().top;
    let scrollParent = stepper.parentElement;
    while (scrollParent && scrollParent !== document.body) {
      const style = window.getComputedStyle(scrollParent);
      if (/(auto|scroll)/.test(style.overflowY)) break;
      scrollParent = scrollParent.parentElement;
    }

    setStepsExpanded((expanded) => !expanded);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const current = stepsRef.current;
        if (!current) return;
        const delta = current.getBoundingClientRect().top - topBefore;
        if (Math.abs(delta) < 1) return;
        if (scrollParent && scrollParent !== document.body) scrollParent.scrollTop += delta;
        else window.scrollBy({ top: delta, left: 0, behavior: 'auto' });
      });
    });
  };

  useEffect(() => {
    if (!user?.id) return undefined;
    fetchDeals();
    // Poll so brand-side updates (e.g. courier marked "shipped") reflect here
    // without a manual refresh — the Deal Room previously never refetched.
    const interval = setInterval(fetchDeals, 10000);
    return () => clearInterval(interval);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset the inline full-brief expansion when switching to a different deal.
  useEffect(() => {
    setBriefOpen(false);
    setFullBrief(null);
    setStepsExpanded(false);
  }, [selectedDeal?.deal_id]);

  // Once a deal is paid + complete, ask the creator to rate the brand. Creators could
  // already review a brand from its profile card in Messages, but were never prompted,
  // so completed deals went un-reviewed. Asks ONCE per deal: promptedRef stops the
  // 10s poll from re-opening it, and the /reviews check stops it returning on revisit.
  useEffect(() => {
    const campaignId = selectedDeal?.campaign?.id;
    const businessId = selectedDeal?.campaign?.business_id;
    if (!isState(selectedDeal, 'Paid - Complete') || !campaignId || !businessId || !user?.id) return;
    if (reviewPromptedRef.current[campaignId]) return;
    reviewPromptedRef.current[campaignId] = true;

    let alive = true;
    axios.get(`${API}/reviews/business/${businessId}`)
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : [];
        const done = list.some((rv) => rv.campaign_id === campaignId && rv.reviewer_id === user.id);
        // Only prompt if they haven't already rated this brand for this campaign.
        if (alive && !done) setBrandReviewFor({ campaignId, businessId });
      })
      // Endpoint unavailable → stay silent rather than risk a duplicate-review error.
      .catch(() => {});
    return () => { alive = false; };
  }, [selectedDeal, user?.id]);

  const submitBrandReview = async ({ rating, review }) => {
    try {
      await axios.post(`${API}/reviews`, {
        campaign_id: brandReviewFor.campaignId, business_id: brandReviewFor.businessId, rating, review,
      });
      toast.success('Review submitted — thanks for the feedback!');
      setBrandReviewFor(null);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not submit your review'));
    }
  };

  const fetchDeals = async () => {
    try {
      const res = await axios.get(`${API}/deals/my`);
      const list = res.data || [];
      setDeals(list);
      const campaignParam = searchParams.get('campaign');
      const dealParam = searchParams.get('deal');
      setSelectedDeal((current) => {
        if (!list.length) return null;
        // Deep-link from My Bids / My Active Work: preselect the matching deal.
        if (!current) {
          if (dealParam) {
            const byDeal = list.find((d) => getDealId(d) === dealParam);
            if (byDeal) return byDeal;
          }
          if (campaignParam) {
            const byCampaign = list.find((d) => String(d.campaign?.id) === String(campaignParam));
            if (byCampaign) return byCampaign;
          }
        }
        return list.find((item) => getDealId(item) === getDealId(current)) || list[0];
      });
    } catch (error) {
      toast.error('Failed to load deals');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (file, setUrlFn, fileType) => {
    if (!file) return;
    // Guard before the request so an oversized clip fails instantly instead of
    // after a full upload — labels advertise 100MB and the backend rejects past it.
    if (file.type?.startsWith('video/') && file.size > 100 * 1024 * 1024) {
      toast.error('Video is too large. Maximum 100MB.');
      return;
    }
    setUploadingFile(fileType);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(`${API}/upload/file`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUrlFn(res.data.file_url);
      toast.success('File uploaded');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Upload failed'));
    } finally {
      setUploadingFile(null);
    }
  };

  const handleSubmitReceipt = async () => {
    if (!selectedDeal?.deal_id) return;
    if (!selectedDeal?.can_mark_received) {
      toast.error('You can mark the product received only after the brand ships it.');
      return;
    }
    if (!unboxingVideoUrl && !selectedDeal?.receipt?.unboxing_video_url) {
      toast.error('Upload an unboxing video before marking received');
      return;
    }
    try {
      await axios.post(`${API}/deals/${selectedDeal.deal_id}/receipt`, {
        received_at: new Date().toISOString(),
        unboxing_video_url: unboxingVideoUrl || selectedDeal?.receipt?.unboxing_video_url,
        items_damaged: false,
        damage_report: null
      });
      toast.success('Receipt submitted');
      setUnboxingVideoUrl(null);
      fetchDeals();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Receipt submission failed'));
    }
  };

  const handleSubmitContent = async () => {
    if (!selectedDeal?.deal_id) return;
    if (uploadingFile) { toast.error('Please wait — a file is still uploading.'); return; }
    const required = getRequiredAssets(selectedDeal);
    const missing = [];
    if (!finalVideoUrl) missing.push('final video');
    if (required.caption_script && !captionUrl) missing.push('caption/script');
    if (required.thumbnail && !thumbnailUrl) missing.push('thumbnail');
    if (required.raw_footage && !rawFootageUrl) missing.push('raw footage');
    if (missing.length) {
      toast.error(`Missing required asset: ${missing.join(', ')}`);
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`${API}/deals/${selectedDeal.deal_id}/content`, {
        video_url: finalVideoUrl,
        caption_url: captionUrl,
        thumbnail_url: thumbnailUrl,
        raw_footage_url: rawFootageUrl,
        creator_note: 'Submitted from creator deal room'
      });
      toast.success('Content submitted for brand review');
      setFinalVideoUrl(null);
      setCaptionUrl(null);
      setThumbnailUrl(null);
      setRawFootageUrl(null);
      fetchDeals();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Submission failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedDeal?.deal_id || (!message.trim() && !messageAttachments.length)) return;
    try {
      await axios.post(`${API}/deals/${selectedDeal.deal_id}/chat`, {
        message: message.trim() || 'Attachment sent',
        attachment_urls: messageAttachments
      });
      setMessage('');
      setMessageAttachments([]);
      fetchDeals();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Message failed'));
    }
  };

  const handleCreateActionCard = async (label, attachmentUrls = []) => {
    if (!selectedDeal?.deal_id) return;
    try {
      const type = ACTION_CARD_TYPES[label];
      const attachments = attachmentUrls.length
        ? attachmentUrls
        : [unboxingVideoUrl || selectedDeal?.receipt?.unboxing_video_url].filter(Boolean);
      if (type === 'raise_dispute') {
        await axios.post(`${API}/deals/${selectedDeal.deal_id}/dispute`, {
          message: label,
          attachment_urls: attachments
        });
      } else if (type === 'escalate_to_admin') {
        await axios.post(`${API}/deals/${selectedDeal.deal_id}/escalate`, {
          message: label,
          attachment_urls: attachments
        });
      } else if (label === 'Damage Report') {
        await axios.post(`${API}/deals/${selectedDeal.deal_id}/damage-report`, {
          message: 'Damaged or wrong product reported by creator',
          attachment_urls: attachments
        });
      } else {
        await axios.post(`${API}/deals/${selectedDeal.deal_id}/action-card`, {
          type,
          message: label,
          attachment_urls: attachments
        });
      }
      const SUCCESS_MSG = {
        'Raise Dispute': 'Dispute raised',
        'Escalate to Admin': 'Escalated to admin',
        'Damage Report': 'Damage reported',
      };
      toast.success(SUCCESS_MSG[label] || `${label} created`);
      fetchDeals();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Action failed'));
    }
  };

  const handleAddEvidenceClick = () => {
    if (uploadingEvidence) return;
    evidenceInputRef.current?.click();
  };

  const handleEvidenceUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length || !selectedDeal?.deal_id) return;

    setUploadingEvidence(true);
    try {
      const uploadedUrls = await Promise.all(files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const res = await axios.post(`${API}/upload/file`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        return res.data.file_url;
      }));
      await handleCreateActionCard('Add Evidence', uploadedUrls);
      toast.success(`${uploadedUrls.length} evidence file${uploadedUrls.length > 1 ? 's' : ''} uploaded`);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Evidence upload failed'));
    } finally {
      setUploadingEvidence(false);
      event.target.value = '';
    }
  };

  const handleActionCardRequest = (label) => {
    if (label === 'Add Evidence') return handleAddEvidenceClick();
    return handleCreateActionCard(label);
  };

  // The backend upserts the response record but appends the system message on EVERY
  // POST, so a second click posts a duplicate "Creator flagged…" line into the deal
  // chat. The button stays live until fetchDeals() lands, so guard the click here.
  const [revisionSubmitting, setRevisionSubmitting] = useState(false);
  const handleRevisionResponse = async (response, acceptedChanges = null) => {
    if (!selectedDeal?.deal_id || revisionSubmitting) return;
    setRevisionSubmitting(true);
    try {
      await axios.post(`${API}/deals/${selectedDeal.deal_id}/revision-response`, {
        response,
        accepted_changes: acceptedChanges || undefined,
        note: response === 'accepted'
          ? (acceptedChanges?.length
              ? `Creator accepted these changes: ${acceptedChanges.join('; ')}.`
              : 'Creator accepted the revision request.')
          : 'Creator flagged the revision request from Deal Room.'
      });
      toast.success('Revision response submitted');
      fetchDeals();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Revision response failed'));
    } finally {
      setRevisionSubmitting(false);
    }
  };

  // Instead of jumping straight to a dispute, let the creator talk it out with the
  // brand first — open the deal chat with a ready-to-send question about exactly how
  // many changes the revision covers, so scope is agreed before any work starts.
  const handleDiscussRevision = () => {
    setChatOpen(true);
    markChatSeen();
    setMessage((prev) => prev || 'Hi! Before I start on these revisions, could we confirm exactly how many changes are included in this request so we\'re on the same page?');
  };

  const handleArchiveDeal = async () => {
    if (!selectedDeal) return;
    if (!isState(selectedDeal, 'Paid - Complete')) {
      toast.error('Only completed deals can be archived');
      return;
    }
    const dealId = getDealId(selectedDeal);
    // Persist the archive on the server — otherwise the 10s poll re-fetches the deal
    // and it comes straight back. Only drop it locally once the server confirms.
    try {
      await axios.post(`${API}/deals/${dealId}/archive`);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not archive this deal'));
      return;
    }
    const nextDeals = deals.filter((deal) => getDealId(deal) !== dealId);
    setDeals(nextDeals);
    setSelectedDeal(nextDeals[0] || null);
    toast.success('Deal archived');
  };

  const primaryAction = getPrimaryActionConfig(
    selectedDeal,
    { finalVideoUrl, captionUrl, thumbnailUrl, rawFootageUrl, unboxingVideoUrl: unboxingVideoUrl || selectedDeal?.receipt?.unboxing_video_url },
    submitting
  );

  const handlePrimaryAction = () => {
    if (primaryAction.disabled) return;
    if (primaryAction.type === 'receipt') return handleSubmitReceipt();
    if (primaryAction.type === 'content') return handleSubmitContent();
    if (primaryAction.type === 'add_evidence') return handleAddEvidenceClick();
    if (primaryAction.type === 'archive') return handleArchiveDeal();
    // Open + focus the delivery-address form. Scrolling alone did nothing visible,
    // because the card already sits just below the button — it read as a dead click.
    if (primaryAction.type === 'ship_address') {
      shipAddressRef.current?.open();
      return;
    }
    // Open the courier's tracking page in a new tab.
    if (primaryAction.type === 'track_shipment') {
      const url = selectedDeal?.shipment?.courier_tracking_url;
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    return null;
  };

  // Overview-tab version of the primary action. The upload inputs only exist on the
  // Deliverables tab, so a "content" submission can never be armed from Overview — the
  // guard needs an already-uploaded video. Instead of a permanently-disabled dead button,
  // route the creator to Deliverables to actually attach files; submit inline only if a
  // video is already uploaded (e.g. they came back from the Deliverables tab).
  const handleOverviewPrimary = () => {
    if (primaryAction.type === 'content') {
      if (submitting) return;
      if (!primaryAction.disabled) return handleSubmitContent();
      return openTab('deliverables');
    }
    return handlePrimaryAction();
  };

  const selectedState = getState(selectedDeal);

  // Switch tab AND reflect it in the URL (?tab=…) so a refresh/back keeps the tab.
  const openTab = (key) => {
    setLeftTab(key);
    const next = new URLSearchParams(searchParams);
    if (key === 'overview') next.delete('tab'); else next.set('tab', key);
    setSearchParams(next, { replace: true });
  };

  // Clicking the status pill jumps to the tab that holds this status's task and
  // scrolls it into view — so "Revision requested" lands on the RevisionTracker.
  const goToTask = () => {
    openTab(taskTabFor(primaryAction, selectedState));
    requestAnimationFrame(() => mainRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };

  const activeDeals = deals.filter((item) => (
    !['paid - complete', 'disputed', 'damaged/wrong product reported'].includes(stateKey(item.current_state))
  ));
  const awaitingAction = deals.filter((item) => item.active_party === 'creator' && !isDamageState(item));
  const pastDeals = deals.filter((item) => stateKey(item.current_state) === 'paid - complete');
  const disputedDeals = deals.filter((item) => EXCEPTION_STATES.some((state) => stateKey(state) === stateKey(item.current_state)));
  const escrowAmount = getEscrowAmount(selectedDeal);
  const activity = useMemo(() => selectedDeal?.activity_feed || [], [selectedDeal]);
  const visibleActivity = showAllActivity ? activity : activity.slice(0, 5);
  const hiddenActivityCount = Math.max(0, activity.length - visibleActivity.length);

  if (loading) {
    return (
      <CreatorTopNavLayout notifications={0}>
        <div className="deal-page">
          <div className="deal-skel" aria-busy="true" aria-label="Loading deal room">
            {/* header: title + status pill */}
            <div className="deal-skel-head">
              <div>
                <Skeleton width={220} height={22} radius={7} />
                <Skeleton width={140} height={13} radius={6} style={{ marginTop: 10 }} />
              </div>
              <Skeleton width={96} height={30} radius={999} />
            </div>
            {/* stat tiles */}
            <div className="deal-skel-tiles">
              {[0, 1, 2].map((i) => (
                <div className="deal-skel-tile" key={i}>
                  <Skeleton width={70} height={11} radius={5} />
                  <Skeleton width={110} height={20} radius={6} style={{ marginTop: 10 }} />
                </div>
              ))}
            </div>
            {/* content cards */}
            {[0, 1].map((i) => (
              <div className="deal-skel-card" key={i}>
                <Skeleton width={160} height={16} radius={6} />
                <Skeleton width="100%" height={12} radius={6} style={{ marginTop: 16 }} />
                <Skeleton width="92%" height={12} radius={6} style={{ marginTop: 10 }} />
                <Skeleton width="70%" height={12} radius={6} style={{ marginTop: 10 }} />
              </div>
            ))}
          </div>
          <style>{`
            .deal-skel { display: flex; flex-direction: column; gap: 16px; }
            .deal-skel-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
              background: #fff; border: 1px solid #eef0f6; border-radius: 16px; padding: 22px 24px; }
            .deal-skel-tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
            .deal-skel-tile { background: #fff; border: 1px solid #eef0f6; border-radius: 14px; padding: 18px 20px; }
            .deal-skel-card { background: #fff; border: 1px solid #eef0f6; border-radius: 16px; padding: 22px 24px; }
            @media (max-width: 640px) { .deal-skel-tiles { grid-template-columns: 1fr; } }
          `}</style>
        </div>
      </CreatorTopNavLayout>
    );
  }

  if (!deals.length) {
    return (
      <CreatorTopNavLayout notifications={0}>
        <div className="deal-page"><EmptyPanel text="No active deals yet. Browse briefs and submit bids to get started." /></div>
      </CreatorTopNavLayout>
    );
  }

  const deal = selectedDeal;

  // "View full brief" expands inline (fetches the full campaign once) instead of
  // navigating away — the deal only carries 2 short brief_sections.
  const toggleFullBrief = async () => {
    const next = !briefOpen;
    setBriefOpen(next);
    if (next && !fullBrief && deal?.campaign?.id) {
      setBriefLoading(true);
      try {
        const res = await axios.get(`${API}/campaigns/${deal.campaign.id}`);
        setFullBrief(res.data);
      } catch (e) {
        // Fall back to the short brief_sections already shown.
      } finally {
        setBriefLoading(false);
      }
    }
  };

  const fb = fullBrief || {};
  const fullBriefRows = [
    ['Product', fb.product_name],
    ['Product description', fb.product_description],
    ['Campaign hook', fb.campaign_hook],
    ['Key message', fb.key_message],
    ['Objectives', Array.isArray(fb.objectives) ? fb.objectives.join(', ') : fb.objectives],
    ['Format', [fb.video_format, fb.duration_seconds ? `${fb.duration_seconds} sec` : null, fb.aspect_ratio].filter(Boolean).join(' · ')],
    ['Tone', Array.isArray(fb.tone_tags) ? fb.tone_tags.join(', ') : (fb.tone_reference || fb.tone_tags)],
    ['What not to do', Array.isArray(fb.what_not_to_do) ? fb.what_not_to_do.join('; ') : fb.what_not_to_do],
    ['Additional deliverables', Array.isArray(fb.additional_deliverables) ? fb.additional_deliverables.join(', ') : fb.additional_deliverables],
    ['Revisions included', fb.revision_limit ?? fb.free_revisions],
    ['Creator level', fb.creator_level],
    ['Quality tier', fb.content_quality_tier],
    ['Niche', Array.isArray(fb.creator_niche_tags) ? fb.creator_niche_tags.join(', ') : fb.creator_niche_tags],
    ['Budget', (fb.budget_min || fb.budget_max) ? formatMoney(fb.budget_max || fb.budget_min) : null],
  ].filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '').map(([label, value]) => ({ label, value: String(value) }));

  // A deal only shows the Shipped step if a physical product is being sent.
  const hasShipping = Boolean(deal?.shipment?.required || deal?.campaign?.requires_shipment || deal?.requires_shipment);
  const dealStepList = dealSteps(hasShipping);
  const dealSubList = dealSubs(hasShipping);
  const stepIndex = getDealStepIndex(selectedState, hasShipping);
  const brandName = deal?.brand?.name || getBrandHandle(deal);
  const creatorName = user?.nickname || user?.full_name || (user?.username ? String(user.username).replace(/^@/, '') : 'You');
  const dealTags = (Array.isArray(deal?.campaign?.objectives) && deal.campaign.objectives.length
    ? deal.campaign.objectives.slice(0, 2)
    : [deal?.campaign?.industry_type || 'UGC']).concat('UGC Video');
  const shipmentRequired = deal?.shipment?.required || deal?.campaign?.requires_shipment;
  const shipment = deal?.shipment || {};
  const chatMessages = deal?.chat_summary?.messages || [];
  // Unread badge = inbound messages (from the brand / system, not the creator's
  // own) that haven't been seen. The badge used to show the TOTAL message count
  // and never cleared; now opening the chat marks everything seen (persisted per
  // deal in localStorage) so it drops to zero.
  const chatDealId = getDealId(deal);
  const inboundMsgCount = chatMessages.filter((m) => m.sender_type && m.sender_type !== 'creator').length;
  const chatSeenKey = chatDealId ? `dealChatSeen:${chatDealId}` : null;
  let chatSeenCount = 0;
  try { chatSeenCount = chatSeenKey ? Number(localStorage.getItem(chatSeenKey) || 0) : 0; } catch { chatSeenCount = 0; }
  const unreadChatCount = Math.max(0, inboundMsgCount - chatSeenCount);
  const markChatSeen = () => {
    if (!chatSeenKey) return;
    try { localStorage.setItem(chatSeenKey, String(inboundMsgCount)); } catch { /* private mode */ }
    setChatSeenTick((t) => t + 1);
  };
  const escrow = deal?.escrow || {};
  const deliverables = buildDeliverables(deal);
  const deliverablesDone = deliverables.filter((d) => d.done).length;
  const uploadLabel = uploadingEvidence && primaryAction.type === 'add_evidence' ? 'Uploading...' : primaryAction.label;
  const escStage = stepIndex >= 4 ? 2 : 1; // 0 funded → 1 in escrow → 2 release

  return (
    <CreatorTopNavLayout notifications={0}>
      <input ref={evidenceInputRef} type="file" hidden multiple accept="image/*,video/*,.pdf" onChange={handleEvidenceUpload} />
      <div className="cmk-dr">
        <div className="cmk-dr-back">
          <button type="button" aria-label="Back to My Deals" title="Back to My Deals" onClick={() => navigate('/my-deals')}><ArrowLeft size={20} /></button>
          {deals.length > 1 && (
            <select value={String(getDealId(selectedDeal))} onChange={(e) => setSelectedDeal(deals.find((d) => String(getDealId(d)) === e.target.value) || selectedDeal)}>
              {deals.map((d) => <option key={getDealId(d)} value={String(getDealId(d))}>{getDealTitle(d)}</option>)}
            </select>
          )}
        </div>

        {/* header */}
        <section className="cmk-dr-head">
          {/* Top line: who + what + the one thing to do next. */}
          <div className="cmk-dr-top">
            <div className="cmk-dr-logo">
              {deal?.brand?.logo_url ? <img src={getAssetUrl(deal.brand.logo_url)} alt={brandName} /> : getInitial(brandName)}
            </div>
            <div className="cmk-dr-title">
              <h1>{getDealTitle(deal)}</h1>
              <div className="cmk-dr-id">Deal ID: {getDealId(deal)}{' '}
                <button
                  type="button"
                  className="cmk-pill info is-link"
                  onClick={goToTask}
                  title="Go to the task for this status"
                >● {selectedState}</button>
              </div>
              <div className="cmk-dr-tags">{dealTags.map((t, i) => <span key={i}>{t}</span>)}</div>
            </div>
            {/* A paid + completed deal has nothing left to do, so it shows its STATUS
                rather than a "Next Action" (archiving is housekeeping, not an action —
                it stays available in the ... menu and on the Deliverables strip). */}
            {primaryAction.type === 'archive' ? (
              <div className="cmk-dr-next is-complete">
                <CheckCircle size={20} />
                <div><small>Status</small><strong>Completed &amp; Paid</strong></div>
              </div>
            ) : (
              <button type="button" className="cmk-dr-next" onClick={goToTask} title={`Go to ${primaryAction.label}`}><Clock size={20} /><span><small>Next Action</small><strong>{primaryAction.label}</strong></span></button>
            )}
          </div>

          {/* Facts sit on their own quiet strip instead of crowding the title row. */}
          <div className="cmk-dr-meta">
            <div className="cmk-dr-metacol"><small>Brand</small><b>{brandName}</b></div>
            <div className="cmk-dr-metacol"><small>Creator</small><b>{creatorName}</b></div>
            <div className="cmk-dr-metacol"><small>Budget</small><b>{formatMoney(escrowAmount)}</b></div>
            <div className="cmk-dr-metacol"><small>Deadline</small><b>{formatDate(getDealDeadline(deal))}</b></div>
          </div>
        </section>

        {/* stepper */}
        <section
          ref={stepsRef}
          className={`cmk-dr-steps ${stepsExpanded ? 'is-expanded' : 'is-collapsed'}`}
          role="button"
          tabIndex={0}
          aria-expanded={stepsExpanded}
          aria-label={stepsExpanded ? 'Collapse work progress' : 'Show all work progress stages'}
          onClick={toggleStepsWithoutJump}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              toggleStepsWithoutJump();
            }
          }}
        >
          {dealStepList.map((label, i) => {
            const state = i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'todo';
            return (
              <div key={label} className={`cmk-dr-step ${state}`}>
                <span className="dot">{state === 'done' ? <Check size={15} /> : i + 1}</span>
                {i < dealStepList.length - 1 && <i className={`line ${i < stepIndex ? 'on' : ''}`} />}
                <span className="lbl">{label}</span>
                <span className="sub">{dealSubList[i]}</span>
              </div>
            );
          })}
        </section>

        {/* body */}
        <div className="cmk-dr-body">
          <main ref={mainRef}>
            {/* A direct booking isn't real work until the creator accepts it. */}
            <BookingCard deal={deal} role="creator" onDone={fetchDeals} />

            <div className="cmk-dr-tabs">
              {TAB_KEYS.map((t) => (
                <button key={t} type="button" className={leftTab === t ? 'on' : ''} onClick={() => openTab(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {leftTab === 'overview' && (
              <>
                <section className="cmk-card cmk-dr-sec">
                  <div className="cmk-dr-sec-h">
                    <div><h2>Deliverables</h2><span className="meta">{deliverablesDone} of {deliverables.length} completed</span></div>
                    {primaryAction.type !== 'track_shipment' && primaryAction.type !== 'passive' && (
                      <button type="button" className="cmk-dr-upload" disabled={primaryAction.type === 'content' ? submitting : primaryAction.disabled} onClick={handleOverviewPrimary}>
                        {primaryAction.type === 'archive' ? <Archive size={16} /> : <Upload size={16} />}
                        {' '}{primaryAction.type === 'content' ? 'Upload / Submit Work' : uploadLabel}
                      </button>
                    )}
                  </div>
                  {deliverables.map((d, i) => (
                    <div key={i} className="cmk-dr-del">
                      <span className={`n ${d.done ? 'ok' : 'pend'}`}>{d.done ? <Check size={14} /> : i + 1}</span>
                      <div className="info"><strong>{d.name}</strong><p>{d.meta}</p></div>
                      <span className={`cmk-pill ${d.status.tone}`}>{d.status.label}</span>
                    </div>
                  ))}
                  {shipmentRequired && (
                    <>
                      {/* Creator confirms the delivery address before the team dispatches.
                          The ref lets the "Confirm Delivery Address" button open + focus it. */}
                      <div style={{ marginTop: 14 }}>
                        {/* The REAL campaign id, not deal.deal_id. "DEAL-4466" is derived
                            from the campaign uuid for display and is stored nowhere, so
                            looking a campaign up by it 404s — which made this card render
                            nothing and the button a dead click. */}
                        <ShippingDetailsCard
                          ref={shipAddressRef}
                          campaignId={deal.campaign?.id || deal.campaign_id || deal.deal_id}
                          onReady={() => fetchDeals()}
                        />
                      </div>
                      <div className="cmk-dr-ship">
                        <div className="cmk-dr-ship-h"><Package size={17} /> Shipment Tracking</div>
                        <div className="cmk-dr-ship-grid">
                          <div><small>Courier Partner</small><p>{shipment.courier_partner || shipment.courier_name || 'Not assigned'}</p></div>
                          <div><small>Tracking ID</small><p>{shipment.tracking_id || 'Pending'}</p>{shipment.courier_tracking_url && <a href={shipment.courier_tracking_url} target="_blank" rel="noreferrer" className="lnk">Track Package ↗</a>}</div>
                          <div><small>Status</small><p className="stat">● {shipment.courier_status || 'Pending'}</p></div>
                          <div><small>Expected Delivery</small><p>{formatDate(shipment.expected_delivery_at)}</p></div>
                        </div>
                      </div>
                    </>
                  )}
                </section>

                <section className="cmk-card cmk-dr-sec">
                  <div className="cmk-dr-sec-h"><h2>Activity Timeline</h2></div>
                  {activity.length ? activity.slice(0, 6).map((ev) => (
                    <div key={ev.id} className="cmk-dr-tl">
                      <span className="ic"><CheckCheck size={16} /></span>
                      <div className="c"><strong>{ev.actor_name || ev.actor_type}</strong><p>{ev.message}</p></div>
                      <span className="t">{formatDateTime(ev.timestamp)}</span>
                    </div>
                  )) : <EmptyPanel text="No activity yet." />}
                </section>
              </>
            )}

            {leftTab === 'brief' && (
              <section className="cmk-card cmk-dr-sec">
                <div className="cmk-dr-sec-h"><h2>Campaign Brief</h2></div>
                {(deal?.brief_sections || []).length ? deal.brief_sections.map((s) => (
                  <div key={s.title} className="cmk-dr-brief"><h3>{s.title}</h3><BriefContent content={s.content} /></div>
                )) : <EmptyPanel text="Brief details not available." />}

                {briefOpen && (
                  <div className="cmk-dr-brief-full">
                    {briefLoading ? (
                      <p className="cmk-dr-empty-msg">Loading full brief…</p>
                    ) : fullBriefRows.length ? (
                      fullBriefRows.map((r) => (
                        <div key={r.label} className="cmk-dr-brief"><h3>{r.label}</h3><p>{r.value}</p></div>
                      ))
                    ) : (
                      <p className="cmk-dr-empty-msg">No additional brief details available.</p>
                    )}
                  </div>
                )}

                {deal?.campaign?.id && (
                  <button type="button" className="cmk-link-btn" onClick={toggleFullBrief}>
                    {briefOpen ? 'Show less ↑' : 'View full brief ↓'}
                  </button>
                )}
              </section>
            )}

            {leftTab === 'deliverables' && (
              <div className="cmk-dr-legacy">
                {shipmentRequired && (
                  <ShippingBlock deal={deal} unboxingVideoUrl={unboxingVideoUrl} onUpload={(file) => handleFileUpload(file, setUnboxingVideoUrl, 'unboxing')} onSubmitReceipt={handleSubmitReceipt} uploading={uploadingFile === 'unboxing'} onActionCard={handleActionCardRequest} />
                )}
                {isDamageState(deal) && <DamageReportCard deal={deal} onActionCard={handleActionCardRequest} />}
                <ContentSubmission deal={deal} finalVideoUrl={finalVideoUrl} captionUrl={captionUrl} thumbnailUrl={thumbnailUrl} rawFootageUrl={rawFootageUrl} onUpload={handleFileUpload} setFinalVideoUrl={setFinalVideoUrl} setCaptionUrl={setCaptionUrl} setThumbnailUrl={setThumbnailUrl} setRawFootageUrl={setRawFootageUrl} uploadingFile={uploadingFile} onSubmit={handleSubmitContent} submitting={submitting} />
                <RevisionTracker deal={deal} submitting={revisionSubmitting} onRevisionResponse={handleRevisionResponse} onDiscussWithBrand={handleDiscussRevision} onEscalate={() => handleActionCardRequest('Escalate to Admin')} />
              </div>
            )}

            {leftTab === 'timeline' && (
              <section className="cmk-card cmk-dr-sec">
                <div className="cmk-dr-sec-h"><h2>Full Activity Timeline</h2></div>
                {activity.length ? activity.map((ev) => (
                  <div key={ev.id} className="cmk-dr-tl">
                    <span className="ic"><CheckCheck size={16} /></span>
                    <div className="c"><strong>{ev.actor_name || ev.actor_type}</strong><p>{ev.message}</p></div>
                    <span className="t">{formatDateTime(ev.timestamp)}</span>
                  </div>
                )) : <EmptyPanel text="No activity yet." />}
              </section>
            )}

            {leftTab === 'payments' && (
              <section className="cmk-card cmk-dr-sec">
                <div className="cmk-dr-sec-h"><h2>Payment Details</h2></div>
                <div className="cmk-dr-pay">
                  <p><span>Escrow Held</span><strong>{formatMoney(escrow.held_amount || escrowAmount)}</strong></p>
                  <p><span>Net Payable</span><strong>{formatMoney(escrow.net_payable || escrowAmount)}</strong></p>
                  <p><span>Estimated Payout</span><strong>{formatDateTime(escrow.estimated_payout_at)}</strong></p>
                </div>
                <div className="cmk-dr-support">
                  {/* Payment questions go to support, not to the dispute flow — this opens
                      the same "Need help?" dialog as the sidebar (email / call / WhatsApp).
                      Escalate-to-Admin still lives on the Deliverables tab's RevisionTracker,
                      which is the right place for work disputes. */}
                  <button type="button" onClick={openHelpDialog}><Headphones size={15} /> Get Help</button>
                </div>
              </section>
            )}
          </main>

          {/* right column */}
          <aside className="cmk-dr-aside">
            <section className="cmk-card cmk-dr-details-card">
              <div className="cmk-dr-chat-head">
                <span className="b">{deal?.brand?.logo_url ? <img src={getAssetUrl(deal.brand.logo_url)} alt="" /> : getInitial(brandName)}</span>
                <div><strong>{getDealTitle(deal)}</strong><small>{getDealId(deal)}</small></div>
              </div>
              <div className="cmk-dr-details">
                <p><span>Brand</span><strong>{brandName}</strong></p>
                <p><span>Deal ID</span><strong>{getDealId(deal)}</strong></p>
                <p><span>Status</span><button type="button" className="cmk-dr-status-link" onClick={goToTask} title="Go to the task for this status">{selectedState}</button></p>
                <p><span>Deadline</span><strong>{formatDate(getDealDeadline(deal))}</strong></p>
                <p><span>Budget</span><strong>{formatMoney(escrowAmount)}</strong></p>
              </div>
            </section>

            <section className="cmk-card cmk-dr-esc">
              <div className="h"><strong>Payment / Escrow</strong><span className="sec"><ShieldAlert size={14} /> Secured</span></div>
              <div className="amt">{formatMoney(escrow.held_amount || escrowAmount)}</div>
              <p className="note">Funds are held securely in escrow</p>
              <div className="bar">
                <span className="pt on" />
                <span className={`seg ${escStage >= 1 ? 'on' : ''}`} />
                <span className={`pt ${escStage >= 2 ? 'on' : 'cur'}`} />
                <span className={`seg ${escStage >= 2 ? 'on' : ''}`} />
                <span className={`pt ${escStage >= 2 ? 'on' : ''}`} />
              </div>
              <div className="lbls"><span>Funded</span><span className={escStage < 2 ? 'c' : ''}>In Escrow</span><span>Release</span></div>
              <button type="button" className="esc-btn" onClick={() => openTab('payments')}>View Payment Details</button>
            </section>
          </aside>
        </div>
      </div>

      {/* Floating chat: the message section opens over the deal page on demand. */}
      {chatOpen && (
        <div className="cmk-dr-chat-pop" role="dialog" aria-label="Deal chat">
          <div className="cmk-dr-chat-pop-head">
            <span className="b">{deal?.brand?.logo_url ? <img src={getAssetUrl(deal.brand.logo_url)} alt="" /> : getInitial(brandName)}</span>
            <div><strong>{getDealTitle(deal)}</strong><small>{getDealId(deal)}</small></div>
            <button type="button" className="x" aria-label="Close chat" onClick={() => { markChatSeen(); setChatOpen(false); }}><X size={18} /></button>
          </div>
          <div className="cmk-dr-msgs">
            {chatMessages.length ? chatMessages.map((m) => {
              // System notes render as one clean centered line (matching the brand's
              // chat) — no "System" sender label stacked above every message.
              if (m.sender_type === 'system') {
                return <div key={m.id} className="cmk-dr-m sys"><div className="bub">{m.message}</div></div>;
              }
              return (
                <div key={m.id} className={`cmk-dr-m ${m.sender_type === 'creator' ? 'me' : 'them'}`}>
                  <div className="who">{m.sender_name}</div>
                  <div className="bub">{m.message}</div>
                </div>
              );
            }) : <p className="cmk-dr-empty-msg">No messages yet.</p>}
          </div>
          <div className="cmk-dr-chat-in">
            <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type a message..." onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }} />
            <button type="button" className="send" onClick={handleSendMessage}><Send size={17} /></button>
          </div>
        </div>
      )}

      <button
        type="button"
        className={`cmk-dr-chat-fab ${chatOpen ? 'is-open' : ''}`}
        onClick={() => { const opening = !chatOpen; setChatOpen(opening); if (opening) markChatSeen(); }}
        aria-label={chatOpen ? 'Close chat' : 'Open chat'}
      >
        {chatOpen ? <X size={22} /> : <MessageSquare size={22} />}
        {!chatOpen && unreadChatCount > 0 && <i className="cmk-dr-fab-badge">{unreadChatCount}</i>}
      </button>

      {brandReviewFor && (
        <ReviewModal
          title={`Rate ${brandName}`}
          subtitle={`How did working on “${getDealTitle(deal)}” go?`}
          onClose={() => setBrandReviewFor(null)}
          onSubmit={submitBrandReview}
        />
      )}
    </CreatorTopNavLayout>
  );
}

function StatusHeader({ deal, currentState, escrowAmount, primaryAction, onPrimaryAction, onActionCard, onArchive }) {
  const deadline = getDealDeadline(deal);
  const damaged = isDamageState(currentState);
  const reviewTimer = isState(currentState, 'Content Submitted - Awaiting Review') ? `Auto-approval ${getCountdownLabel(deal)}` : null;
  const creatorIsActive = deal?.active_party === 'creator' && !damaged;
  return (
    <section className={`deal-status-header ${damaged ? 'is-passive' : ''}`}>
      <div className="deal-brand-logo">
        {deal?.brand?.logo_url ? <img src={getAssetUrl(deal.brand.logo_url)} alt={deal.brand.name || 'Brand'} /> : getInitial(deal?.brand?.name || 'B')}
      </div>
      <div className="deal-status-copy">
        <p>{getBrandHandle(deal)}</p>
        <h2>{getDealTitle(deal)}</h2>
        <span>{getDealId(deal)}</span>
      </div>
      <div className="deal-header-metrics">
        <div className="deal-header-pill is-state"><small>Current State</small><strong>{currentState}</strong></div>
        <div className="deal-header-pill"><small>{damaged ? 'Waiting on' : 'Active Party'}</small><strong>{damaged ? 'Admin + Brand' : deal?.active_party || 'Not assigned'}</strong></div>
        <div className="deal-header-pill"><small>Creator Status</small><strong>{damaged ? 'Work paused' : creatorIsActive ? 'Action needed' : 'Waiting'}</strong></div>
        <div className={`deal-header-pill ${damaged ? 'is-paused' : creatorIsActive ? 'is-urgent' : ''}`}><small>{damaged ? 'Timeline' : 'Deadline'}</small><strong>{damaged ? 'Creator timeline paused' : getCountdownLabel(deal)}</strong></div>
        <div className="deal-header-pill"><small>Escrow</small><strong>{formatMoney(escrowAmount)} held</strong></div>
      </div>
      <div className="deal-header-pill is-next-step">
        <div className="deal-next-step-copy">
          <small>{damaged ? 'Next Step' : 'Due'}</small>
          <strong>{damaged ? 'Admin and brand will review your uploaded evidence. You may add more evidence or contact support if needed.' : reviewTimer || formatDateTime(deadline)}</strong>
        </div>
        <div className="deal-header-actions">
          <button type="button" className="deal-primary-action" disabled={primaryAction.disabled} onClick={onPrimaryAction}>
            <Upload size={17} /> {primaryAction.label}
          </button>
          <div className="deal-more">
            <button type="button" aria-label="More deal actions"><MoreHorizontal size={18} /></button>
            <div>
              {/* No direct "Raise Dispute" for creators — escalate to admin instead. */}
              <button type="button" onClick={() => onActionCard('Message Support')}>Get Help</button>
              <button type="button" onClick={onArchive}><Archive size={14} /> Archive if completed</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DealNavigation({ groups, selectedDeal, onSelect }) {
  const [openGroups, setOpenGroups] = useState(() => ({
    'Active Deals': true,
    'Awaiting My Action': false,
    'Past Deals': false,
    'Disputed Deals': false
  }));

  const toggleGroup = (label) => {
    setOpenGroups((current) => ({ ...current, [label]: !current[label] }));
  };

  return (
    <aside className="deal-nav-panel">
      {groups.map(([label, groupDeals]) => (
        <section key={label}>
          <button type="button" className="deal-nav-heading" onClick={() => toggleGroup(label)} aria-expanded={Boolean(openGroups[label])}>
            <span>{label}</span>
            <em>{groupDeals.length}</em>
            <ChevronDown size={16} className={openGroups[label] ? 'is-open' : ''} />
          </button>
          {openGroups[label] && (groupDeals.length ? groupDeals.map((deal) => (
            <button
              key={`${label}-${getDealId(deal)}`}
              type="button"
              className={getDealId(selectedDeal) === getDealId(deal) ? 'is-active' : ''}
              onClick={() => onSelect(deal)}
            >
              <strong>{getDealTitle(deal)}</strong>
              <small>{getBrandHandle(deal)} - {getState(deal)}</small>
              <em>{isDamageState(deal) ? 'Work paused - resolution pending' : `${deal.primary_next_action || 'No action pending'} - ${getCountdownLabel(deal)}`}</em>
            </button>
          )) : <p>No deals</p>)}
        </section>
      ))}
    </aside>
  );
}

function ShippingBlock({ deal, unboxingVideoUrl, onUpload, onSubmitReceipt, uploading, onActionCard }) {
  const shipment = deal?.shipment || {};
  const receipt = deal?.receipt || {};
  const damaged = isDamageState(deal);
  const received = Boolean(receipt.received_at);
  const isShipped = ['shipped', 'in_transit', 'delivered'].includes(shipment.courier_status);
  const hasVideo = Boolean(unboxingVideoUrl || receipt.unboxing_video_url);
  const hasCourierDetails = shipment.tracking_id || shipment.courier_status || shipment.expected_delivery_at || receipt.received_at;
  const canSubmitReceipt = Boolean(deal?.can_mark_received && hasVideo);
  const submittedVideoUrl = receipt.unboxing_video_url
    ? (String(receipt.unboxing_video_url).startsWith('http') ? receipt.unboxing_video_url : `${BACKEND_URL}${receipt.unboxing_video_url}`)
    : null;
  return (
    <DealCard className="deal-shipping-card">
      <div className="deal-section-title">
        <span><Package size={18} /></span>
        <div><h2>Shipping / Receipt</h2><p>{damaged ? 'Product issue has been reported' : 'Confirm package condition before producing content'}</p></div>
      </div>
      {hasCourierDetails ? (
        <div className="deal-receipt-grid">
          <p><small>Tracking ID</small>{shipment.courier_tracking_url ? <a href={shipment.courier_tracking_url} target="_blank" rel="noreferrer">{shipment.tracking_id || 'Tracking link'}</a> : <strong>{shipment.tracking_id || 'Not available'}</strong>}</p>
          <p><small>Courier Status</small><strong>{shipment.courier_status || 'Not available'}</strong></p>
          <p><small>Expected Delivery</small><strong>{formatDate(shipment.expected_delivery_at)}</strong></p>
          <p><small>Date Received</small><strong>{formatDate(receipt.received_at)}</strong></p>
        </div>
      ) : damaged ? (
        <div className="deal-pause-note">Product issue has been reported. Shipping/content workflow is paused until admin resolution.</div>
      ) : null}
      {/* The old "Waiting for brand shipment details." note is gone: the delivery-address
          card above already shows the real status (You confirmed / Brand pending), so this
          was just duplicate noise on the creator's screen. */}
      {damaged ? (
        <div className="deal-revision-actions">
          <button type="button" onClick={() => onActionCard('Add Evidence')}>Add Evidence</button>
          <button type="button" onClick={() => onActionCard('Message Support')}>Message Support</button>
        </div>
      ) : received ? (
        <div className="deal-receipt-confirmed">
          <p className="deal-receipt-done"><CheckCircle size={18} /> Product received on {formatDate(receipt.received_at)} — receipt confirmed.</p>
          {submittedVideoUrl && (
            <a className="deal-receipt-video-link" href={submittedVideoUrl} target="_blank" rel="noreferrer">View submitted unboxing video</a>
          )}
        </div>
      ) : (
        <>
          <button type="button" className="deal-secondary-action" disabled={!canSubmitReceipt} onClick={onSubmitReceipt}>Mark Received</button>
          {!canSubmitReceipt && (
            <p className="deal-helper-text">
              {!hasCourierDetails
                ? 'Available once the brand adds shipment tracking.'
                : !isShipped
                  ? 'Waiting for the brand to mark the package shipped.'
                  : !hasVideo
                    ? 'Upload your unboxing video to enable “Mark Received”.'
                    : !deal?.can_mark_received
                      ? 'Waiting for the brand to confirm delivery. This updates automatically once the package is marked delivered.'
                      : 'Ready — tap “Mark Received” to confirm.'}
            </p>
          )}
          <label>Upload Unboxing Video</label>
          <p className="deal-helper-text">Upload a short unboxing video showing package condition, opening, and product received.</p>
          <input type="file" id="unboxing-upload" accept="video/mp4,video/quicktime" onChange={(event) => onUpload(event.target.files?.[0])} />
          <UploadZone icon={Paperclip} label="Upload Unboxing Video" accept="MP4/MOV - Max 100MB - Max 2 minutes" uploaded={hasVideo} previewUrl={unboxingVideoUrl || receipt.unboxing_video_url} previewType="video" onClick={() => document.getElementById('unboxing-upload').click()} disabled={uploading} />
        </>
      )}
    </DealCard>
  );
}

function ContentSubmission({
  deal,
  finalVideoUrl,
  captionUrl,
  thumbnailUrl,
  rawFootageUrl,
  onUpload,
  setFinalVideoUrl,
  setCaptionUrl,
  setThumbnailUrl,
  setRawFootageUrl,
  uploadingFile,
  onSubmit,
  submitting
}) {
  const content = deal?.content_submission || {};
  const required = getRequiredAssets(deal);
  const versions = content.versions || [];
  const needsCaption = Boolean(required.caption_script);
  const needsThumbnail = Boolean(required.thumbnail);
  const needsRaw = Boolean(required.raw_footage);
  const canSubmit = canSubmitUploadedAssets(deal, { finalVideoUrl, captionUrl, thumbnailUrl, rawFootageUrl });
  // Content production only begins once the deal reaches the content stage
  // (for shipment deals that means the product must be received first).
  const contentUnlocked = Boolean(deal?.can_submit_content);
  const awaitingReceipt = Boolean(deal?.shipment?.required && !deal?.receipt?.received_at);
  const currentState = deal?.current_state || '';
  const latestVersion = versions.length ? versions[versions.length - 1] : null;
  let lockReason;
  if (isCancelledDeal(deal)) {
    lockReason = 'This deal was cancelled by the brand — no content can be submitted.';
  } else if (awaitingReceipt) {
    lockReason = 'Confirm you’ve received the product (in Shipping / Receipt above) before uploading your content.';
  } else if (currentState.includes('Awaiting Review') || latestVersion?.status === 'submitted') {
    lockReason = `You’ve submitted${latestVersion ? ` v${latestVersion.version}` : ''} — waiting for the brand to review your content.`;
  } else if (currentState.includes('Paid') || currentState.includes('Complete') || latestVersion?.status === 'approved') {
    lockReason = 'This deal is complete — your content was approved.';
  } else if (deal?.primary_next_action) {
    lockReason = `Next: ${deal.primary_next_action}.`;
  } else {
    lockReason = 'Content upload unlocks when it’s your turn to submit.';
  }

  return (
    <DealCard className="deal-delivery-card">
      <div className="deal-section-title">
        <span><Upload size={18} /></span>
        <div><h2>Content Submission</h2><p>{content.watermark_required_until_approval ? 'Watermarked preview until brand approval' : 'Brand approval rules loaded'}</p></div>
      </div>
      {content.watermark_required_until_approval && <div className="deal-watermark">Watermarked preview until brand approval</div>}
      {!contentUnlocked && <div className="deal-locked-note"><ShieldAlert size={16} /> {lockReason}</div>}
      <UploadZone icon={Play} label="Final Video Upload" accept="MP4/MOV - Max 100MB" uploaded={Boolean(finalVideoUrl)} previewUrl={finalVideoUrl} previewType="video" watermark={content.watermark_required_until_approval} onClick={() => document.getElementById('video-file-real').click()} disabled={!contentUnlocked || uploadingFile === 'video'} />
      <input type="file" id="video-file-real" accept="video/*" onChange={(event) => onUpload(event.target.files?.[0], setFinalVideoUrl, 'video')} hidden />
      <div className="deal-asset-grid">
        {needsCaption && (
          <div>
            <label>Caption / Script Upload</label>
            <UploadZone icon={FileText} label="Caption / Script" accept=".txt - .docx" uploaded={Boolean(captionUrl)} onClick={() => document.getElementById('caption-file-real').click()} disabled={!contentUnlocked || uploadingFile === 'caption'} />
            <input type="file" id="caption-file-real" onChange={(event) => onUpload(event.target.files?.[0], setCaptionUrl, 'caption')} hidden />
          </div>
        )}
        {needsThumbnail && (
          <div>
            <label>Thumbnail Upload</label>
            <UploadZone icon={Image} label="Thumbnail" accept="JPG - PNG" uploaded={Boolean(thumbnailUrl)} previewUrl={thumbnailUrl} previewType="image" watermark={content.watermark_required_until_approval} onClick={() => document.getElementById('thumb-file-real').click()} disabled={!contentUnlocked || uploadingFile === 'thumb'} />
            <input type="file" id="thumb-file-real" accept="image/*" onChange={(event) => onUpload(event.target.files?.[0], setThumbnailUrl, 'thumb')} hidden />
          </div>
        )}
        {needsRaw && (
          <div>
            <label>Raw Footage Upload</label>
            <UploadZone icon={Paperclip} label="Raw Footage" accept="MP4/MOV - Max 100MB" uploaded={Boolean(rawFootageUrl)} previewUrl={rawFootageUrl} previewType="video" onClick={() => document.getElementById('raw-file-real').click()} disabled={!contentUnlocked || uploadingFile === 'raw'} />
            <input type="file" id="raw-file-real" accept="video/*" onChange={(event) => onUpload(event.target.files?.[0], setRawFootageUrl, 'raw')} hidden />
          </div>
        )}
      </div>
      <div className="deal-version-row">
        {versions.length ? versions.map((version) => {
          const { label: statusLabel, tone: statusTone } = versionStatusMeta(version.status);
          return (
            <article key={version.version}>
              <div className="deal-preview-tile">
                {version.thumbnail_url ? (
                  <img src={getAssetUrl(version.thumbnail_url)} alt={`v${version.version} thumbnail`} />
                ) : version.video_url ? (
                  <video src={getAssetUrl(version.video_url)} />
                ) : (
                  <Play size={24} />
                )}
                {content.watermark_required_until_approval && version.status !== 'approved' && (version.thumbnail_url || version.video_url) && (
                  <span
                    className="deal-preview-watermark"
                    aria-hidden="true"
                    style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/ugcad-logo_-_Edited-removebg-preview.png)` }}
                  />
                )}
                {version.video_url && (
                  <a href={getAssetUrl(version.video_url)} target="_blank" rel="noreferrer" aria-label={`Open v${version.version} preview`}>
                    <Play size={16} />
                  </a>
                )}
              </div>
              <div className="deal-version-meta">
                <strong>v{version.version}</strong>
                <small>{formatDateTime(version.submitted_at)}</small>
                <span className={`deal-version-status is-${statusTone}`}>{statusLabel}</span>
              </div>
            </article>
          );
        }) : (
          <article className="is-empty">
            <div className="deal-preview-tile"><Play size={24} /></div>
            <div className="deal-version-meta">
              <strong>v1</strong>
              <small>No upload yet</small>
              <span className="deal-version-status is-warn">Awaiting submission</span>
            </div>
          </article>
        )}
      </div>
      <button type="button" className="deal-submit" disabled={!canSubmit || submitting} onClick={onSubmit}>
        <Upload size={17} /> {submitting ? 'Submitting...' : 'Submit Delivery'}
      </button>
    </DealCard>
  );
}

function DamageReportCard({ deal, onActionCard }) {
  const report = getDamageReport(deal);
  const evidenceParts = [];
  if (report.evidenceCount) evidenceParts.push(`${report.evidenceCount} uploaded file${report.evidenceCount > 1 ? 's' : ''}`);
  if (report.hasUnboxing) evidenceParts.push('1 unboxing video');

  return (
    <DealCard className="deal-damage-card">
      <div className="deal-section-title">
        <span className="warn"><ShieldAlert size={18} /></span>
        <div><h2>Damage Report Submitted</h2><p>Damage report under review</p></div>
      </div>
      <div className="deal-revision-box">
        <p><small>Report Type</small><strong>Damaged / Wrong Product Reported</strong></p>
        <p><small>Submitted By</small><strong>Creator</strong></p>
        <p><small>Submitted On</small><strong>{formatDateTime(report.submittedOn)}</strong></p>
        <p><small>Reason</small><strong>{report.reason}</strong></p>
        <p className="is-wide"><small>Description</small><strong>{report.description}</strong></p>
        <p className="is-wide"><small>Evidence Uploaded</small><strong>{evidenceParts.length ? evidenceParts.join(' + ') : 'No evidence count available'}</strong></p>
        <p><small>Status</small><strong>{report.status}</strong></p>
        <p><small>Creator Timeline</small><strong>Paused</strong></p>
        <p><small>Escrow Status</small><strong>Held until resolution</strong></p>
      </div>
      <div className="deal-revision-actions">
        <button type="button" disabled={!report.evidenceUrls.length} onClick={() => window.open(getAssetUrl(report.evidenceUrls[0]), '_blank', 'noopener,noreferrer')}>View Uploaded Evidence</button>
      </div>
      {report.evidenceUrls.length ? (
        <div className="deal-evidence-list">
          {report.evidenceUrls.map((url, index) => {
            const assetUrl = getAssetUrl(url);
            const isVideo = /\.(mp4|webm|mov)$/i.test(String(url).split('?')[0]);
            return (
              <a key={`${url}-${index}`} href={assetUrl} target="_blank" rel="noreferrer">
                {isVideo ? <Play size={18} /> : <FileText size={18} />}
                <span>Evidence {index + 1}</span>
              </a>
            );
          })}
        </div>
      ) : null}
    </DealCard>
  );
}

const REVISION_RESPONSE_LABEL = {
  accepted: 'You accepted this revision — submit your revised content below.',
  scope_creep: 'You told the brand these changes go beyond the brief. Work it out together in chat — if you can’t agree, use “Escalate to admin” below.',
  partial_dispute: 'You accepted some changes and pushed back on the rest. Sort the rest out with the brand in chat — if you can’t agree, use “Escalate to admin” below.',
};

// Turn the brand's requested changes into a clean, de-duplicated checklist. The
// backend sometimes derives requested_changes from the feedback text (so both can
// arrive as one comma-run the creator can't parse) — split any multi-line / multi-
// sentence entries and drop blanks so each change becomes its own tickable line.
function toChangeItems(revision) {
  const raw = revision.requested_changes?.length
    ? revision.requested_changes
    : (revision.latest_feedback ? [revision.latest_feedback] : []);
  const seen = new Set();
  const items = [];
  raw.forEach((entry) => {
    String(entry || '')
      .split(/\r?\n|(?<=\.)\s+(?=[A-Z0-9])/) // split on new lines and sentence breaks
      .map((line) => line.replace(/^\s*[-•*\d.)\]]+\s*/, '').trim()) // strip bullet/number prefixes
      .filter(Boolean)
      .forEach((line) => {
        // Dedup ignoring a leading severity tag: older revisions stored the same
        // change twice — once tagged ("[must-fix] new look") and once raw ("new
        // look") — which showed up as two identical-looking rows.
        const key = line.replace(/^\s*\[[^\]]*\]\s*/, '').toLowerCase();
        if (!seen.has(key)) { seen.add(key); items.push(line); }
      });
  });
  return items;
}

// A change can arrive tagged as "[must-fix @ 0:04] Re-shoot the intro" when the
// brand reviewed on the video. Render the severity + the pinned moment as chips
// instead of leaving the raw bracket text in the creator's checklist.
const CHANGE_TAG_RE = /^\s*\[([^\]@]+?)(?:\s*@\s*(\d+:\d{2}))?\]\s*/;
function renderChangeText(line) {
  const m = String(line).match(CHANGE_TAG_RE);
  if (!m) return line;
  const [, severity, timestamp] = m;
  const rest = String(line).slice(m[0].length);
  const sev = (severity || '').trim().toLowerCase();
  return (
    <>
      {timestamp && <span className="deal-chg-ts" title="Moment in your video">{timestamp}</span>}
      {sev && <span className={`deal-chg-sev ${sev === 'must-fix' ? 'must' : 'pref'}`}>{sev === 'must-fix' ? 'Must-fix' : 'Preference'}</span>}
      {rest}
    </>
  );
}

// Parse "0:13" -> seconds. Returns null when there's no timestamp.
function tsToSeconds(ts) {
  if (!ts) return null;
  const [m, s] = String(ts).split(':').map(Number);
  if (Number.isNaN(m) || Number.isNaN(s)) return null;
  return m * 60 + s;
}

// Turn the change lines into VideoReviewModal comments: strip the "[…]" tag, keep
// the clean text, and lift the pinned moment out to `timestamp_seconds`.
function changeItemsToComments(items) {
  return items.map((line, i) => {
    const m = String(line).match(CHANGE_TAG_RE);
    const timestamp = m ? m[2] : null;
    const text = m ? String(line).slice(m[0].length).trim() : String(line).trim();
    return { id: `chg-${i}`, text, timestamp_seconds: tsToSeconds(timestamp) };
  });
}

function RevisionTracker({ deal, submitting, onRevisionResponse, onDiscussWithBrand, onEscalate }) {
  const revision = deal?.revision_tracker || {};
  const changeItems = toChangeItems(revision);
  const [videoOpen, setVideoOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);

  // The video the brand reviewed = the creator's most recent submitted version.
  const versions = deal?.content_submission?.versions || [];
  const reviewedVideo = [...versions].reverse().find((v) => v.video_url)?.video_url
    || deal?.content_submission?.video_url
    || '';
  const reviewedVideoUrl = reviewedVideo ? getAssetUrl(reviewedVideo) : '';
  const reviewComments = changeItemsToComments(changeItems);
  const hasTimestamps = reviewComments.some((c) => c.timestamp_seconds != null);
  const canReviewOnVideo = Boolean(reviewedVideoUrl) && reviewComments.length > 0;
  const hasRevision = Boolean(revision.latest_feedback || revision.requested_changes?.length);
  // Once the creator has responded, show what they chose instead of leaving the
  // buttons live (clicking them again looked like nothing was happening).
  const responded = revision.creator_response;
  const acceptedAlready = revision.accepted_changes || [];

  // The requested changes are shown READ-ONLY. There used to be a per-item tick list
  // plus a Select all button, but the tick state was seeded by a useState initializer
  // that only ran on first mount — so it went stale whenever the deal polled or the
  // creator switched deals, leaving the boxes rendered ticked while the count said 0.
  // Accepting is now all-or-nothing: "Accept & revise" agrees to the whole list, and
  // partial disagreement goes through "Chat with brand" / "beyond the brief".
  const total = changeItems.length;

  return (
    <DealCard className="deal-revisions">
      <div className="deal-section-title">
        <span className="warn"><RotateCcw size={18} /></span>
        <div><h2>Revision Tracker</h2><p>Revision {revision.revision_count_used || 0} of {revision.revision_limit || 0} used</p></div>
      </div>

      <div className="deal-revision-meta">
        {/* Brand feedback isn't shown raw here — it repeated the tagged string
            ("[must-fix @ 0:31] asd …") that the parsed checklist below already
            lists cleanly. Notes the brand added (if any) still surface there. */}
        <p><small>New Deadline</small><strong>{formatDateTime(revision.new_deadline_at)}</strong></p>
      </div>

      <div className="deal-revision-checklist">
        <div className="deal-revision-checklist-head">
          <small>Requested Changes {total ? `· ${total}` : ''}</small>
          {canReviewOnVideo && (
            <button type="button" className="deal-review-video-btn" onClick={() => setVideoOpen(true)}>
              <Play size={14} /> {hasTimestamps ? 'See changes on video' : 'View submitted video'}
            </button>
          )}
        </div>

        {total ? (
          <ul className="is-readonly">
            {changeItems.map((item, idx) => {
              // After responding, tick the ones the brand recorded as accepted so the
              // creator can still see what they agreed to.
              const isDone = responded
                && acceptedAlready.some((a) => String(a).toLowerCase() === item.toLowerCase());
              return (
                <li key={`${item}-${idx}`} className={isDone ? 'is-checked' : ''}>
                  {isDone ? <Check size={15} /> : null}
                  <span>{renderChangeText(item)}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="deal-revision-empty">No requested changes yet.</p>
        )}
      </div>

      {responded ? (
        <>
          <p className="deal-revision-responded">
            <Check size={15} /> {REVISION_RESPONSE_LABEL[responded] || `Response recorded: ${responded}`}
          </p>
          {/* Pushback is a disagreement to settle with the brand first — only offer the
              admin escalation here, once talking it out is on the table. */}
          {(responded === 'scope_creep' || responded === 'partial_dispute') && (
            <div className="deal-revision-actions">
              <button type="button" onClick={() => onDiscussWithBrand?.()}>Chat with brand</button>
              <button type="button" className="is-danger" onClick={() => onEscalate?.()}>Escalate to admin</button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="deal-revision-hint">Review the requested changes, then choose how to respond.</p>
          <div className="deal-revision-options">
            <button type="button" className="deal-revision-options-trigger" disabled={!hasRevision || submitting} aria-expanded={optionsOpen} onClick={() => setOptionsOpen((open) => !open)}>
              Options <ChevronDown size={16} />
            </button>
            {optionsOpen && (
              <div className="deal-revision-options-menu">
                <button type="button" onClick={() => { setOptionsOpen(false); onRevisionResponse('accepted', total ? changeItems : null); }}>Accept &amp; revise</button>
                <button type="button" onClick={() => { setOptionsOpen(false); onDiscussWithBrand?.(); }}>Chat with brand about changes</button>
                <button type="button" onClick={() => { setOptionsOpen(false); onRevisionResponse('scope_creep', []); }}>These changes go beyond the brief</button>
              </div>
            )}
          </div>
        </>
      )}

      {videoOpen && (
        <VideoReviewModal
          readOnly
          src={reviewedVideoUrl}
          title="Requested changes on your video"
          watermark={false}
          initialComments={reviewComments}
          onClose={() => setVideoOpen(false)}
        />
      )}
    </DealCard>
  );
}

function RightPanel({ tab, setTab, deal, currentState, message, setMessage, messageAttachments, setMessageAttachments, onSendMessage, onActionCard }) {
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [uploadingMessageFile, setUploadingMessageFile] = useState(false);
  const messageFileInputRef = useRef(null);
  const chat = deal?.chat_summary || {};
  const messages = chat.messages || [];
  const escrow = deal?.escrow || {};
  const deductions = escrow.deductions || [];
  const damaged = isDamageState(currentState);
  // Creators can't raise a dispute directly anymore. "Escalate to Admin" is the only
  // path to admin, and it's only offered once the creator has already flagged an issue
  // with the brand (a revision pushback or a damage report) so they've tried to resolve
  // it together first. Everything else stays a normal, non-dispute support action.
  const revisionResponse = deal?.revision_tracker?.creator_response;
  const canEscalate = damaged || revisionResponse === 'scope_creep' || revisionResponse === 'partial_dispute';
  const baseActions = damaged ? ['Add Evidence', 'Message Support'] : ['Milestone Update', 'Damage Report'];
  const creatorActions = canEscalate ? [...baseActions, 'Escalate to Admin'] : baseActions;

  const handleMessageFileUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setUploadingMessageFile(true);
    try {
      const uploadedUrls = await Promise.all(files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        const res = await axios.post(`${API}/upload/file`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        return res.data.file_url;
      }));
      setMessageAttachments((current) => [...current, ...uploadedUrls]);
      toast.success(`${uploadedUrls.length} file${uploadedUrls.length > 1 ? 's' : ''} attached`);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'File attachment failed'));
    } finally {
      setUploadingMessageFile(false);
      event.target.value = '';
    }
  };

  return (
    <aside className="deal-right-column">
      <div className="deal-right-panel">
        <div className="deal-right-tabs">
          {['chat', 'progress'].map((name) => (
            <button key={name} type="button" className={tab === name ? 'is-active' : ''} onClick={() => setTab(name)}>{name}</button>
          ))}
        </div>
        {tab === 'chat' && (
          <div className="deal-chat">
            <div className="deal-pinned"><AlertTriangle size={16} /><strong>{currentState}</strong><span>{damaged ? 'Creator work paused. Admin and brand are reviewing the evidence.' : `${deal?.primary_next_action || 'No action pending'} - ${getCountdownLabel(deal)}`}</span></div>
            <div className="deal-message-list">
              {messages.length ? messages.map((item) => (
                <p key={item.id} className={item.sender_type === 'creator' ? 'creator' : item.sender_type === 'system' ? 'system' : 'brand'}>
                  {item.sender_type === 'system' ? item.message : `${item.sender_name}: ${item.message}`}
                </p>
              )) : <p className="system">No messages yet.</p>}
            </div>
            <div className="deal-support-actions">
              <div className="deal-action-section-title">
                <h3>Support Actions</h3>
              </div>
              <div className="deal-action-menu">
                {creatorActions.map((item) => <button key={item} type="button" onClick={() => onActionCard(item)}>{item}</button>)}
              </div>
            </div>
            <div className="deal-chat-input">
              <input
                ref={messageFileInputRef}
                type="file"
                hidden
                multiple
                accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                onChange={handleMessageFileUpload}
              />
              <div className="deal-emoji-wrap">
                <button type="button" aria-label="Choose emoji" onClick={() => setEmojiPickerOpen((value) => !value)}><Smile size={17} /></button>
                {emojiPickerOpen && (
                  <div className="deal-emoji-picker">
                    {['😊', '👍', '🙏', '🔥', '✨', '✅', '👀', '💬', '📦', '🎥', '⚠️', '❤️'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => {
                          setMessage(`${message}${emoji}`);
                          setEmojiPickerOpen(false);
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" aria-label="Attach file" disabled={uploadingMessageFile} onClick={() => messageFileInputRef.current?.click()}><Paperclip size={17} /></button>
              <input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Message this deal thread" />
              <button type="button" onClick={onSendMessage}><Send size={17} /></button>
            </div>
            {messageAttachments.length ? (
              <div className="deal-message-attachments">
                {messageAttachments.map((url, index) => (
                  <span key={`${url}-${index}`}>Attachment {index + 1}</span>
                ))}
              </div>
            ) : null}
          </div>
        )}
        {tab === 'progress' && (
          <div className="deal-progress-tab">
            {[...DEAL_STATES, ...EXCEPTION_STATES].map((state) => {
              const currentIndex = DEAL_STATES.findIndex((item) => stateKey(item) === stateKey(currentState));
              const itemIndex = DEAL_STATES.findIndex((item) => stateKey(item) === stateKey(state));
              const isCurrent = stateKey(state) === stateKey(currentState);
              const isDone = itemIndex !== -1 && currentIndex !== -1 && itemIndex < currentIndex;
              return (
                <div key={state} className={isCurrent ? 'is-current' : isDone ? 'is-done' : ''}>
                  <span>{isCurrent ? <Clock size={15} /> : <CheckCheck size={15} />}</span>
                  <strong>{state}</strong>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {tab === 'chat' && (
        <>
          <div className="deal-payout-section">
            <div className="deal-action-section-title">
              <h3>Payout Summary</h3>
            </div>
            <div className="deal-payout-tab">
              <p><span>Escrow Held</span><strong>{formatMoney(escrow.held_amount || 0)}</strong></p>
              <p><span>Net Payable</span><strong>{formatMoney(escrow.net_payable || 0)}</strong></p>
              <p><span>Deductions</span><strong>{deductions.length ? deductions.map((item) => `${item.label}: ${formatMoney(item.amount)}`).join(', ') : 'No deductions'}</strong></p>
              <p><span>Estimated Payout</span><strong>{formatDateTime(escrow.estimated_payout_at)}</strong></p>
              <em>Disputed deals remain on hold until resolved.</em>
            </div>
          </div>

          <div className="deal-deadline-section">
            <div className="deal-action-section-title">
              <h3>{damaged ? 'Resolution Status' : 'Deadline Alert'}</h3>
            </div>
            <div className="deal-deadline">
              <div><span><AlertTriangle size={21} /></span><div><strong>{damaged ? 'Resolution pending' : getCountdownLabel(deal)}</strong><h2>{damaged ? 'Work paused' : deal?.primary_next_action || 'Next action pending'}</h2><p>{damaged ? 'Work is paused until resolution' : `Due: ${formatDateTime(getDealDeadline(deal))}`}</p><p>{damaged ? 'Waiting on: Admin + Brand' : `Active party: ${deal?.active_party || 'Not assigned'}`}</p><p>{damaged ? 'No late penalty will apply while this issue is under review' : `Required action: ${deal?.primary_next_action || 'No action pending'}`}</p></div></div>
            </div>
          </div>

          <div className="deal-help-list">
            {[
              // Creators escalate to admin (who decides on a dispute) — they can't raise one directly.
              [Headphones, 'Escalate to Admin'],
              [ShieldAlert, 'Report Damaged / Wrong Product']
            ].map(([Icon, label]) => (
              <button key={label} type="button" onClick={() => onActionCard(label === 'Report Damaged / Wrong Product' ? 'Damage Report' : label)}>
                <span><Icon size={18} /></span>
                <div><strong>{label}</strong><small>Deal support action</small></div>
              </button>
            ))}
          </div>
        </>
      )}
    </aside>
  );
}
