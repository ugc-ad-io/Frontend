import { loadCreatorDeal } from '../utils/creatorDeals';
import { useLiveEffect } from '../lib/liveUpdates';
import briefDeliveryLabel from '../utils/briefDeliveryLabel';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { uploadMedia, MAX_UPLOAD_MB } from '../utils/upload';
import UploadProgress from '../components/UploadProgress';
import { getDealMessages } from '../utils/dealMessages';
import BookingCard from '../components/BookingCard';
import {
  Archive,
  Check,
  CheckCircle,
  Clock,
  FileText,
  Image,
  Package,
  Paperclip,
  Play,
  Send,
  ShieldAlert,
  Upload,
} from 'lucide-react';
import { EmptyPanel, getInitial } from '../components/CreatorComponents';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import { openHelpDialog } from '../components/HoverSideRail';
import VideoReviewModal from '../components/VideoReviewModal';
import ShippingDetailsCard from '../components/ShippingDetailsCard';
import { Skeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import { inr, brandTile, orderStatus, dueLabel, shortDate } from '../utils/orderUi';
import './CreatorDashboard.css';
import './MyDealsPage.css';
import '../styles/creator-ui-orders.css';
import '../styles/creator-ui-room.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

// Which file this upload is for: 'raw' or 'edited' (raw → edited flow), else null.
function uploadStage(deal) {
  const stage = deal?.edit_flow?.stage;
  return stage === 'raw' || stage === 'edited' ? stage : null;
}

const ACTION_CARD_TYPES = {
  'Milestone Update': 'milestone_update',
  'Add Evidence': 'damage_report',
  'Damage Report': 'damage_report',
  'Escalate to Admin': 'escalate_to_admin',
  'Raise Dispute': 'raise_dispute',
  'Message Support': 'escalate_to_admin'
};

// A drop-style upload button. Clicking opens the file chooser; a file dropped on it is passed to onFile.
function UploadZone({ icon: Icon, label, accept, uploaded, onClick, onFile, disabled, previewUrl, previewType, watermark, progress = null }) {
  const [over, setOver] = useState(false);
  const showPreview = uploaded && previewUrl;
  return (
    <button
      type="button"
      className={`cui-r-drop ${uploaded ? 'is-uploaded' : ''} ${showPreview ? 'has-preview' : ''} ${over ? 'is-over' : ''}`}
      onClick={onClick}
      disabled={disabled}
      onDragOver={onFile ? (e) => { e.preventDefault(); setOver(true); } : undefined}
      onDragLeave={onFile ? () => setOver(false) : undefined}
      onDrop={onFile ? (e) => { e.preventDefault(); setOver(false); if (!disabled) onFile(e.dataTransfer.files?.[0]); } : undefined}
    >
      {showPreview ? (
        <div className="cui-r-prev">
          {previewType === 'video' ? (
            // #t=0.5 nudges the browser to render a real frame instead of a black poster
            <video src={`${getAssetUrl(previewUrl)}#t=0.5`} muted playsInline preload="metadata" />
          ) : (
            <img src={getAssetUrl(previewUrl)} alt="Uploaded preview" />
          )}
          {watermark && <span className="cui-r-wm" aria-hidden="true" />}
          <UploadProgress percent={progress} />
        </div>
      ) : (
        <>
          <span className="ic">{uploaded ? <Check size={22} /> : <Icon size={22} strokeWidth={1.8} />}</span>
          <strong>{uploaded ? 'File uploaded successfully' : label}</strong>
          <small>{uploaded ? 'Ready for submission' : accept}</small>
          <UploadProgress percent={progress} />
        </>
      )}
    </button>
  );
}

// Render a brief blob nicely: every "Label: value" line gets a consistent bold
// label, so the dense brief text becomes scannable instead of one flat paragraph.
function BriefContent({ content }) {
  if (!content) return <p>Not specified</p>;
  const lines = String(content).split(/\r?\n/);
  return (
    <>
      {lines.map((line, i) => {
        const t = line.trim();
        if (!t) return <div key={i} className="gap" />;
        // Budget visibility is a brand-only setting — never surface it to creators.
        if (/^budget visibility\s*:/i.test(t)) return null;
        const m = t.match(/^([A-Z][^:]{0,40}):\s*(.*)$/);
        if (m && m[2]) return <p key={i}><strong>{m[1]}:</strong> {m[2]}</p>;
        if (m) return <p key={i}><strong>{m[1]}:</strong></p>;
        return <p key={i}>{t}</p>;
      })}
    </>
  );
}

function normalizeDash(value) {
  return String(value || '').replace(/\s*(?:—|–|-)\s*/g, ' - ');
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
  if (required.raw_footage && !uploads.rawFootageUrl && !uploadStage(deal)) return false;
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
  if (isState(deal, 'Received - Content in Progress') || isState(deal, 'Revision Requested') || isState(deal, 'Raw Approved - Edited Video Due')) {
    const stage = uploadStage(deal);
    return {
      label: submitting ? 'Submitting...' : isState(deal, 'Revision Requested') ? 'Submit Revision' : stage === 'raw' || getRequiredAssets(deal).raw_only ? 'Submit Raw Video' : stage === 'edited' ? 'Submit Edited Video' : 'Submit Content',
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

// Six-step progress bar (Won / Product / Film / Deliver / Review / Paid). The Product step only
// exists for deals that actually ship something. `fill` is 1 (done), 0.5 (current) or 0 per step.
function roomProgress(deal, hasShipping) {
  const labels = hasShipping ? ['Won', 'Product', 'Film', 'Deliver', 'Review', 'Paid'] : ['Won', 'Film', 'Deliver', 'Review', 'Paid'];
  const at = (l) => Math.max(0, labels.indexOf(l));
  const s = stateKey(getState(deal));
  let cur = 0;
  let done = false;
  if (s.includes('cancel')) cur = 0;
  else if (s.includes('paid')) { cur = at('Paid'); done = true; }
  else if (s.includes('raw approved') && s.includes('editing')) cur = at('Deliver');
  else if (s.includes('raw approved')) cur = at('Film');
  else if (s.includes('approved')) cur = at('Paid');
  else if (s.includes('revision') || s.includes('content submitted') || (s.includes('await') && s.includes('review'))) cur = at('Review');
  else if (s.includes('content in progress') || s.includes('received')) cur = at('Film');
  else if (s.includes('delivered') || s.includes('shipped') || s.includes('transit') || (hasShipping && s.includes('accepted'))) cur = at('Product');
  const fill = labels.map((_, i) => (done || i < cur ? 1 : i === cur ? 0.5 : 0));
  return { labels, fill, cur: done ? -1 : cur };
}

// "4d 21h" style countdown from a number of hours.
function hoursText(h) {
  if (typeof h !== 'number' || h < 0) return null;
  const d = Math.floor(h / 24);
  const hh = Math.floor(h % 24);
  return d ? `${d}d ${hh}h` : `${hh}h`;
}

export default function MyDealsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [deals, setDeals] = useState([]);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [brandReviewFor, setBrandReviewFor] = useState(null); // completed deal awaiting a brand rating
  const reviewPromptedRef = useRef({});                       // campaignId -> already asked this session
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null); // { message, notFound } when the deal list/detail could not load
  const [briefOpen, setBriefOpen] = useState(false);
  const [fullBrief, setFullBrief] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);
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
  const [uploadPercent, setUploadPercent] = useState(null);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [revVideoOpen, setRevVideoOpen] = useState(false);
  const evidenceInputRef = useRef(null);
  const shipAddressRef = useRef(null);   // "Confirm Delivery Address" opens this form
  const composerRef = useRef(null);      // chat input (focused by "Ask a question")

  useLiveEffect(() => {
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
    setMessage('');
    setMessageAttachments([]);
  }, [selectedDeal?.deal_id]);

  // ?tab=deliverables (from "See what they asked for" / the quick work form) lands on the upload card.
  const wantsDeliver = searchParams.get('tab') === 'deliverables';
  useEffect(() => {
    if (!wantsDeliver || !selectedDeal?.deal_id) return;
    const t = setTimeout(() => document.getElementById('cui-r-deliver')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    return () => clearTimeout(t);
  }, [wantsDeliver, selectedDeal?.deal_id]);

  // Once a deal is paid + complete, ask the creator to rate the brand. Creators could
  // already review a brand from its profile card in Messages, but were never prompted,
  // so completed deals went un-reviewed. Asks ONCE per deal: promptedRef stops the
  // 10s poll from re-opening it, and the /reviews check stops it returning on revisit.
  useLiveEffect(() => {
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
      toast.success('Review submitted - thanks for the feedback!');
      setBrandReviewFor(null);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not submit your review'));
    }
  };

  const selectedDealIdRef = useRef(null);
  selectedDealIdRef.current = selectedDeal?.campaign?.id || searchParams.get('campaign') || searchParams.get('deal');
  const dealFetchSequence = useRef(0);
  const fetchingDeals = useRef(false);
  const fetchDeals = async (requestedId) => {
    if (fetchingDeals.current && !requestedId) return;
    const sequence = ++dealFetchSequence.current;
    fetchingDeals.current = true;
    try {
      const { list, detail } = await loadCreatorDeal(API, requestedId || selectedDealIdRef.current);
      if (sequence !== dealFetchSequence.current) return;
      setDeals(list);
      setSelectedDeal(detail);
      setLoadError(null);
    } catch (error) {
      if (sequence === dealFetchSequence.current) {
        const status = error?.response?.status;
        // The 10s poll stays silent (the last good deal keeps showing); a failed first load or
        // a deal the user picked is explained on screen, with Retry / a way back.
        setLoadError({
          notFound: status === 404 || status === 403,
          message: !error?.response
            ? "You're offline. Check your connection and try again."
            : (status === 404 || status === 403) ? 'This deal could not be found, or it is no longer available to you.' : 'Could not load your deals.',
        });
        if (requestedId) toast.error('Failed to load that deal');
      }
    } finally {
      if (sequence === dealFetchSequence.current) {
        fetchingDeals.current = false;
        setLoading(false);
      }
    }
  };

  const handleFileUpload = async (file, setUrlFn, fileType) => {
    if (!file) return;
    setUploadingFile(fileType);
    setUploadPercent(0);
    try {
      // uploadMedia refuses an oversized video up front with a readable message
      // and reports progress; a dropped connection no longer reads "Network Error".
      const data = await uploadMedia(file, API, { onProgress: setUploadPercent });
      setUrlFn(data.file_url);
      toast.success('File uploaded');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Upload failed'));
    } finally {
      setUploadingFile(null);
      setUploadPercent(null);
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
    if (submitLock.current) return;
    submitLock.current = true;
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
    } finally { submitLock.current = false; }
  };

  const handleSubmitContent = async () => {
    if (!selectedDeal?.deal_id) return;
    if (uploadingFile) { toast.error('Please wait - a file is still uploading.'); return; }
    const required = getRequiredAssets(selectedDeal);
    const missing = [];
    const stage = uploadStage(selectedDeal);
    if (!finalVideoUrl) missing.push(stage === 'raw' || required.raw_only ? 'raw video' : stage === 'edited' ? 'edited video' : 'final video');
    if (required.caption_script && !captionUrl) missing.push('caption/script');
    if (required.thumbnail && !thumbnailUrl) missing.push('thumbnail');
    if (required.raw_footage && !rawFootageUrl && !stage) missing.push('raw footage');
    if (missing.length) {
      toast.error(`Missing required asset: ${missing.join(', ')}`);
      return;
    }

    if (submitLock.current) return;
    submitLock.current = true;
    setSubmitting(true);
    try {
      await axios.post(`${API}/deals/${selectedDeal.deal_id}/content`, {
        video_url: finalVideoUrl,
        caption_url: captionUrl,
        thumbnail_url: thumbnailUrl,
        raw_footage_url: stage ? null : rawFootageUrl,
        creator_note: 'Submitted from creator deal room'
      });
      toast.success(stage === 'raw' ? 'Raw video submitted for brand review' : stage === 'edited' ? 'Edited video submitted for brand review' : 'Content submitted for brand review');
      setFinalVideoUrl(null);
      setCaptionUrl(null);
      setThumbnailUrl(null);
      setRawFootageUrl(null);
      fetchDeals();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Submission failed'));
    } finally {
      submitLock.current = false;
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
      const uploadedUrls = await Promise.all(files.map(async (file) => (await uploadMedia(file, API)).file_url));
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
    if (label === 'Damage Report' && !window.confirm('Report this product as damaged or wrong? Your work on this order pauses until UGCad reviews it.')) return null;
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
  // brand first — focus the deal chat with a ready-to-send question about exactly how
  // many changes the revision covers, so scope is agreed before any work starts.
  const handleDiscussRevision = () => {
    markChatSeen();
    setMessage((prev) => prev || 'Hi! Before I start on these revisions, could we confirm exactly how many changes are included in this request so we\'re on the same page?');
    setTimeout(() => {
      composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      composerRef.current?.focus({ preventScroll: true });
    }, 60);
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
    if (nextDeals.length) fetchDeals(getDealId(nextDeals[0]));
    else navigate('/my-deals');
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

  // The upload inputs live in the deliver card, so a "content" submission can never be armed
  // from the hero: pick a video there, and submit inline once everything required is attached.
  const pickVideo = () => document.getElementById('video-file-real')?.click();
  const handleHeroPrimary = () => {
    if (primaryAction.type === 'content') {
      if (submitting) return;
      if (!primaryAction.disabled) return handleSubmitContent();
      return pickVideo();
    }
    return handlePrimaryAction();
  };

  const selectedState = getState(selectedDeal);

  const markChatSeenRef = useRef(null);
  const markChatSeen = () => markChatSeenRef.current?.();

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
        </div>
      </CreatorTopNavLayout>
    );
  }

  if (!deals.length) {
    return (
      <CreatorTopNavLayout notifications={0}>
        <div className="deal-page">
          {loadError ? (
            <EmptyState
              title={loadError.notFound ? 'Deal not found' : 'Could not load deals'}
              message={loadError.message}
              action={loadError.notFound
                ? { label: 'Back to My Deals', onClick: () => navigate('/my-deals') }
                : { label: 'Retry', onClick: () => { setLoading(true); fetchDeals(); } }}
            />
          ) : <EmptyPanel text="No active deals yet. Browse briefs and submit bids to get started." />}
        </div>
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
    ['Product type', [fb.product_type, fb.product_type_detail].filter(Boolean).join(' - ')],
    ['Delivery type', (fb.deliverable_items || []).map(briefDeliveryLabel).join('; ')],
    ['Script provider', fb.script_provider === 'ugc' ? 'UGC.ad' : fb.script_provider === 'brand' ? 'Brand' : ''],
    ['Script', fb.script_text || (fb.script_provider === 'ugc' ? 'UGC.ad is preparing the script.' : '')],
    ['Product description', fb.product_description],
    ['Campaign hook', fb.campaign_hook],
    ['Key message', fb.key_message],
    ['Video language', fb.language],
    ['Objectives', Array.isArray(fb.objectives) ? fb.objectives.join(', ') : fb.objectives],
    ['Format', [fb.video_format, fb.duration_seconds ? `${fb.duration_seconds} sec` : null, fb.aspect_ratio].filter(Boolean).join(' · ')],
    ['Tone', Array.isArray(fb.tone_tags) ? fb.tone_tags.join(', ') : (fb.tone_reference || fb.tone_tags)],
    ['What not to do', Array.isArray(fb.what_not_to_do) ? fb.what_not_to_do.join('; ') : fb.what_not_to_do],
    ['Additional deliverables', Array.isArray(fb.additional_deliverables) ? fb.additional_deliverables.join(', ') : fb.additional_deliverables],
    ['Revisions included', fb.revision_limit ?? fb.free_revisions],
    ['Creator level', fb.creator_level],
    ['Quality tier', fb.content_quality_tier],
    ['Gender preference', fb.gender_preference],
    ['Creator location', fb.city_filter || 'Any location'],
    ['Niche', Array.isArray(fb.creator_niche_tags) ? fb.creator_niche_tags.join(', ') : fb.creator_niche_tags],
    ['Budget', (fb.budget_min || fb.budget_max) ? inr(fb.budget_max || fb.budget_min) : null],
  ].filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '').map(([label, value]) => ({ label, value: String(value) }));

  // A deal only shows the Product step if a physical product is being sent.
  const hasShipping = Boolean(deal?.shipment?.required || deal?.campaign?.requires_shipment || deal?.requires_shipment);
  const progress = roomProgress(deal, hasShipping);
  const brandName = deal?.brand?.name || getBrandHandle(deal);
  const shipmentRequired = deal?.shipment?.required || deal?.campaign?.requires_shipment;
  const chatMessages = getDealMessages(deal, 'creator', user?.id);
  // Unread chip = inbound messages (from the brand / system, not the creator's own) that
  // haven't been seen. Focusing the composer marks everything seen (persisted per deal in
  // localStorage) so it drops to zero.
  const chatDealId = getDealId(deal);
  const inboundMsgCount = chatMessages.filter((m) => m.sender_type && m.sender_type !== 'creator').length;
  const chatSeenKey = chatDealId ? `dealChatSeen:${user?.id}:${chatDealId}` : null;
  let chatSeenCount = 0;
  try { chatSeenCount = chatSeenKey ? Number(localStorage.getItem(chatSeenKey) || 0) : 0; } catch { chatSeenCount = 0; }
  const unreadChatCount = Math.max(0, inboundMsgCount - chatSeenCount);
  markChatSeenRef.current = () => {
    if (!chatSeenKey) return;
    try { localStorage.setItem(chatSeenKey, String(inboundMsgCount)); } catch { /* private mode */ }
    setChatSeenTick((t) => t + 1);
  };
  const escrow = deal?.escrow || {};
  const versions = deal?.content_submission?.versions || [];
  const status = orderStatus(deal);
  const due = dueLabel(deal);
  const revision = deal?.revision_tracker || {};
  const inRevision = isState(deal, 'Revision Requested');
  const isPaid = isState(deal, 'Paid - Complete');
  const isApproved = isState(deal, 'Approved - Payment Processing');
  const inReview = isState(deal, 'Content Submitted - Awaiting Review');
  const cancelled = isCancelledDeal(deal);
  const damaged = isDamageState(deal);
  const contentUnlocked = Boolean(deal?.can_submit_content);
  const stage = uploadStage(deal);
  const countdown = hoursText(deal?.deadline_countdown_hours);
  const lastVersion = versions.length ? versions[versions.length - 1] : null;
  const revVideo = revisionVideoInfo(deal);
  const payoutDate = escrow.estimated_payout_at ? shortDate(escrow.estimated_payout_at) : '';

  // The big top card: what is going on and the one thing to do next.
  let hero = { eyebrow: 'In progress', title: primaryAction.label, sub: '', action: null };
  if (cancelled) hero = { eyebrow: 'Cancelled', title: 'This order was cancelled', sub: 'The brand ended this deal. There is nothing more to do here.', grey: true };
  else if (damaged) hero = { eyebrow: 'On hold', title: 'Issue under review', sub: 'Admin and the brand are reviewing your evidence. Your timeline is paused. You can add more evidence if needed.', action: { label: uploadingEvidence ? 'Uploading...' : 'Add evidence', onClick: handleAddEvidenceClick, disabled: uploadingEvidence, icon: Upload } };
  else if (isPaid) hero = { eyebrow: `Approved by ${brandName}`, title: `+${inr(escrow.net_payable ?? escrowAmount)} paid to your wallet`, sub: payoutDate ? `Paid ${payoutDate}` : 'Payment complete', tick: true, action: { label: 'Withdraw', onClick: () => navigate('/withdrawal') } };
  else if (isApproved) hero = { eyebrow: `Approved by ${brandName}`, title: 'Payment is on its way', sub: `${inr(escrow.net_payable ?? escrowAmount)} will reach your wallet shortly.`, tick: true };
  else if (isState(deal, 'Raw Approved - UGC.ad Editing')) hero = { eyebrow: 'Raw approved', title: 'UGC.ad is editing your video', sub: 'Your raw video was approved. Nothing more to upload.' };
  else if (inReview) hero = { eyebrow: `Delivered${lastVersion?.submitted_at ? ` · ${shortDate(lastVersion.submitted_at)}` : ''}`, title: `Waiting for ${brandName}`, sub: 'They can approve or ask for changes. If they do not reply, it is approved automatically and you get paid.', count: countdown };
  else if (primaryAction.type === 'content' && !inRevision) hero = {
    eyebrow: `Your turn${due ? ` · ${due.text}` : ''}`,
    title: stage === 'raw' || getRequiredAssets(deal).raw_only ? 'Deliver your raw video' : stage === 'edited' ? 'Deliver your edited video' : 'Deliver your video',
    sub: contentUnlocked ? 'Upload your video below, then send it for review.' : 'Content upload unlocks when it is your turn.',
    action: { label: primaryAction.disabled ? 'Upload video' : primaryAction.label, onClick: handleHeroPrimary, disabled: submitting, icon: Upload },
  };
  else if (primaryAction.type === 'receipt') hero = { eyebrow: 'Product arrived', title: 'Confirm you received it', sub: 'Upload a short unboxing video, then tap Mark received.', action: { label: 'Mark received', onClick: handlePrimaryAction, disabled: primaryAction.disabled } };
  else if (primaryAction.type === 'track_shipment') hero = { eyebrow: 'On its way', title: 'Your product is in transit', sub: deal?.shipment?.expected_delivery_at ? `Expected ${formatDate(deal.shipment.expected_delivery_at)}.` : 'The courier has picked it up.', action: { label: 'Track shipment', onClick: handlePrimaryAction, disabled: primaryAction.disabled } };
  else if (primaryAction.type === 'ship_address') hero = { eyebrow: 'Your turn', title: 'Confirm your delivery address', sub: 'The brand ships your product as soon as you confirm where it should go.', action: { label: 'Confirm delivery address', onClick: handlePrimaryAction } };
  else if (primaryAction.type === 'ship_address_done') hero = { eyebrow: 'Waiting on brand', title: 'Address submitted', sub: 'The brand will ship your product soon. We will update this page.' };
  else if (inRevision) hero = null;
  else if (primaryAction.type === 'passive') hero = { eyebrow: 'In progress', title: primaryAction.label, sub: deal?.active_party === 'brand' ? `Waiting for ${brandName}.` : '' };

  // Phone: the one action stays pinned above the tab bar.
  const barLabel = primaryAction.type === 'content' && primaryAction.disabled && !submitting ? 'Upload video' : primaryAction.label;
  const showBar = !cancelled && ['content', 'receipt', 'ship_address', 'track_shipment', 'add_evidence'].includes(primaryAction.type);
  const onBar = () => (primaryAction.type === 'content' ? handleHeroPrimary() : primaryAction.type === 'add_evidence' ? handleAddEvidenceClick() : handlePrimaryAction());
  const barDisabled = primaryAction.type === 'content' ? submitting : primaryAction.disabled;

  const payNote = isPaid ? (payoutDate ? `Paid ${payoutDate}.` : 'Payment complete.')
    : isApproved ? 'Approved. Your payout is being processed.'
    : inRevision ? `Paid after ${brandName} approves the new version.`
    : inReview ? `Paid when ${brandName} approves, or automatically if they do not reply.`
    : `Paid when ${brandName} approves your work.`;
  const deductions = (escrow.deductions || []).filter((x) => Number(x.amount) > 0);

  return (
    <CreatorTopNavLayout notifications={0}>
      <input ref={evidenceInputRef} type="file" hidden multiple accept="image/*,video/*,.pdf" onChange={handleEvidenceUpload} />
      <div className="cui-o-page cui-r">
        <nav className="cui-r-crumb" aria-label="Breadcrumb">
          <button type="button" onClick={() => navigate('/my-deals')}>Orders</button>
          <span>&rsaquo;</span>
          <strong>{getDealId(deal)} &middot; {getDealTitle(deal)}</strong>
        </nav>

        {/* A direct booking isn't real work until the creator accepts it. */}
        <BookingCard deal={deal} role="creator" onDone={fetchDeals} />

        {/* header */}
        <section className="cui-o-card cui-r-head">
          <BrandLogo deal={deal} name={brandName} />
          <div className="cui-r-ht">
            <small>{brandName} &middot; order {getDealId(deal)}</small>
            <h1>{getDealTitle(deal)}</h1>
          </div>
          <span className={`cui-o-pill ${status.tone}`} title={selectedState}>
            {inRevision ? `Revision ${revision.revision_count_used || 1} of ${revision.revision_limit || 0}` : status.label}
          </span>
          <div className="cui-r-prog" role="img" aria-label={`Progress: ${selectedState}`}>
            <div className="cui-r-segs" style={{ '--n': progress.labels.length }}>
              {progress.fill.map((f, i) => <i key={i} className={f === 1 ? 'on' : f === 0.5 ? 'half' : ''} />)}
            </div>
            <div className="cui-r-lbls" style={{ '--n': progress.labels.length }}>
              {progress.labels.map((l, i) => <span key={l} className={i === progress.cur ? 'cur' : ''}>{l}</span>)}
            </div>
          </div>
        </section>

        <div className="cui-r-grid">
          <div className="cui-r-main">
            {hero && (
              <section className={`cui-r-hero ${hero.grey ? 'grey' : ''}`}>
                <div className="cui-r-hero-in">
                  {hero.tick && <span className="cui-r-tick"><Check size={28} strokeWidth={3} /></span>}
                  <div className="cui-r-hero-t">
                    <div className="cui-r-eye">{hero.eyebrow}</div>
                    <h2>{hero.title}</h2>
                    {hero.sub ? <p>{hero.sub}</p> : null}
                  </div>
                  {hero.count && <div className="cui-r-count"><b>{hero.count}</b><small>until auto-approve</small></div>}
                  {hero.action && (
                    <button type="button" className="cui-o-btn light" disabled={hero.action.disabled} onClick={hero.action.onClick}>
                      {hero.action.icon ? <hero.action.icon size={17} /> : null}{hero.action.label}
                    </button>
                  )}
                </div>
              </section>
            )}

            {inRevision && (
              <RevisionCard
                deal={deal}
                submitting={revisionSubmitting}
                onRevisionResponse={handleRevisionResponse}
                onDiscussWithBrand={handleDiscussRevision}
                onEscalate={() => handleActionCardRequest('Escalate to Admin')}
                onOpenVideo={() => setRevVideoOpen(true)}
                canOpenVideo={revVideo.canOpen}
                hasTimestamps={revVideo.hasTimestamps}
              />
            )}

            {(contentUnlocked || (!versions.length && primaryAction.type === 'content')) && !cancelled && !damaged && (
              <ContentSubmission
                deal={deal}
                finalVideoUrl={finalVideoUrl}
                captionUrl={captionUrl}
                thumbnailUrl={thumbnailUrl}
                rawFootageUrl={rawFootageUrl}
                onUpload={handleFileUpload}
                setFinalVideoUrl={setFinalVideoUrl}
                setCaptionUrl={setCaptionUrl}
                setThumbnailUrl={setThumbnailUrl}
                setRawFootageUrl={setRawFootageUrl}
                uploadingFile={uploadingFile}
                uploadPercent={uploadPercent}
                onSubmit={handleSubmitContent}
                submitting={submitting}
                heading={inRevision ? 'Upload new version' : 'Your delivery'}
              />
            )}

            {isPaid && brandReviewFor && <BrandRating brandName={brandName} onSubmit={submitBrandReview} />}

            {versions.length > 0 && !inRevision && <VersionsCard deal={deal} versions={versions} />}

            {damaged && <DamageReportCard deal={deal} onActionCard={handleActionCardRequest} />}

            {shipmentRequired && (
              <ShippingBlock
                deal={deal}
                addressRef={shipAddressRef}
                unboxingVideoUrl={unboxingVideoUrl}
                onUpload={(file) => handleFileUpload(file, setUnboxingVideoUrl, 'unboxing')}
                onSubmitReceipt={handleSubmitReceipt}
                uploading={uploadingFile === 'unboxing'}
                uploadPercent={uploadingFile === 'unboxing' ? uploadPercent : null}
                onActionCard={handleActionCardRequest}
                onRefresh={() => fetchDeals()}
              />
            )}

            <section className="cui-o-card cui-r-late">
              <div className="cui-o-h"><span>Brief</span></div>
              <div className="cui-r-brief">
                {(deal?.brief_sections || []).length ? deal.brief_sections.map((s) => (
                  <div key={s.title}><h3>{s.title}</h3><BriefContent content={s.content} /></div>
                )) : <EmptyPanel text="Brief details not available." />}
                {briefOpen && (
                  briefLoading ? (
                    <p>Loading full brief…</p>
                  ) : fullBriefRows.length ? (
                    fullBriefRows.map((r) => <div key={r.label}><h3>{r.label}</h3><p>{r.value}</p></div>)
                  ) : (
                    <p>No additional brief details available.</p>
                  )
                )}
              </div>
              {deal?.campaign?.id && (
                <button type="button" className="cui-o-link" style={{ marginTop: 12, minHeight: 44 }} onClick={toggleFullBrief}>
                  {briefOpen ? 'Show less ↑' : 'View full brief ↓'}
                </button>
              )}
            </section>

            <section className="cui-o-card cui-r-late">
              <div className="cui-o-h"><span>Activity</span></div>
              <div className="cui-r-list">
                {activity.length ? visibleActivity.map((ev) => (
                  <div key={ev.id} className="cui-r-item">
                    <CheckCircle size={16} color="#13774f" />
                    <span><strong>{ev.actor_name || ev.actor_type}</strong> &middot; {ev.message}</span>
                    <em>{formatDateTime(ev.timestamp)}</em>
                  </div>
                )) : <EmptyPanel text="No activity yet." />}
              </div>
              {hiddenActivityCount > 0 && (
                <button type="button" className="cui-o-link" style={{ marginTop: 10, minHeight: 44 }} onClick={() => setShowAllActivity(true)}>Show {hiddenActivityCount} more</button>
              )}
            </section>
          </div>

          <aside className="cui-r-side">
            {inRevision && revVideo.canOpen && (
              <section className="cui-o-card">
                <div className="cui-r-eyebrow">Version {lastVersion?.version || 1} &middot; with notes</div>
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'center' }}>
                  <div className="cui-r-poster" style={{ width: 150, height: 232 }}>
                    {lastVersion?.thumbnail_url ? <img src={getAssetUrl(lastVersion.thumbnail_url)} alt="" /> : <video src={`${revVideo.url}#t=0.5`} muted playsInline preload="metadata" />}
                    <a href={revVideo.url} target="_blank" rel="noreferrer" aria-label="Open your submitted video"><Play size={15} /></a>
                    <span className="wm" aria-hidden="true">UGCAD PREVIEW</span>
                  </div>
                </div>
                <button type="button" className="cui-o-btn soft sm" style={{ width: '100%', marginTop: 12 }} onClick={() => setRevVideoOpen(true)}>
                  <Play size={14} /> {revVideo.hasTimestamps ? 'See changes on video' : 'View submitted video'}
                </button>
              </section>
            )}

            <OrderChat
              brandName={brandName}
              messages={chatMessages}
              message={message}
              setMessage={setMessage}
              onSend={handleSendMessage}
              composerRef={composerRef}
              unread={unreadChatCount}
              onSeen={markChatSeen}
            />

            <section className="cui-o-card cui-r-pcard">
              <div className="cui-o-h"><span>Payment</span></div>
              <div className="cui-r-pay">
                <div><span>Order price</span><span>{inr(escrow.held_amount || escrowAmount)}</span></div>
                {deductions.map((x) => <div key={x.label}><span>{x.label}</span><span>-{inr(x.amount)}</span></div>)}
                <div><span>Status</span><span>{escrow.status === 'released' ? 'Released' : escrow.status === 'on_hold' ? 'On hold' : 'Held safely'}</span></div>
                <div className="tot"><span>{isPaid ? 'You got' : 'You get'}</span><span>{inr(escrow.net_payable ?? escrowAmount)}</span></div>
              </div>
              <div className="cui-r-pnote">{payNote}</div>
              {isPaid && (
                <button type="button" className="cui-o-btn ghost sm" style={{ marginTop: 12 }} onClick={handleArchiveDeal}><Archive size={15} /> Archive order</button>
              )}
            </section>

            <section className="cui-o-card cui-r-help" style={{ padding: '16px 20px' }}>
              <strong>Need help?</strong>
              <div>
                <button type="button" onClick={openHelpDialog}>Contact UGCad</button>
                {(damaged || ['scope_creep', 'partial_dispute'].includes(revision.creator_response)) && (
                  <>
                    <span>&middot;</span>
                    <button type="button" onClick={() => handleActionCardRequest('Escalate to Admin')}>Escalate to admin</button>
                  </>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>

      {showBar && (
        <div className="cui-r-bar">
          <button type="button" className="cui-o-btn" disabled={barDisabled} onClick={onBar}>{barLabel}</button>
        </div>
      )}

      {revVideoOpen && revVideo.url && (
        <VideoReviewModal
          readOnly
          src={revVideo.url}
          title="Requested changes on your video"
          watermark={false}
          initialComments={revVideo.comments}
          onClose={() => setRevVideoOpen(false)}
        />
      )}

    </CreatorTopNavLayout>
  );
}

function BrandLogo({ deal, name }) {
  const { bg, fg } = brandTile(name);
  const logo = deal?.brand?.logo_url;
  return (
    <span className="cui-o-tile" style={{ background: logo ? '#fff' : bg, color: fg }}>
      {logo ? <img src={getAssetUrl(logo)} alt={name} /> : getInitial(name)}
    </span>
  );
}

function OrderChat({ brandName, messages, message, setMessage, onSend, composerRef, unread, onSeen }) {
  const listRef = useRef(null);
  const count = messages.length;
  // Newest message in view whenever the thread grows.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [count]);
  return (
    <section className="cui-o-card cui-r-chat">
      <div className="cui-o-h"><span>Chat with {brandName}</span>{unread > 0 && <span className="cui-r-new">{unread} new</span>}</div>
      <div className="cui-r-msgs" ref={listRef}>
        {count ? messages.map((m) => {
          // System notes render as one clean centered line — no "System" sender label.
          if (m.sender_type === 'system') {
            return <div key={m.id} className="cui-r-m sys"><div className="bub">{m.message}</div></div>;
          }
          const mine = m.sender_type === 'creator';
          return (
            <div key={m.id} className={`cui-r-m ${mine ? 'me' : 'them'}`}>
              <div className="bub">{m.message}</div>
              <small>{mine ? 'You' : m.sender_name}{m.created_at ? ` · ${shortDate(m.created_at)}` : ''}</small>
            </div>
          );
        }) : <p className="cui-r-hint">No messages yet. Say hello to {brandName}.</p>}
      </div>
      <div className="cui-r-comp">
        <input
          ref={composerRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onFocus={onSeen}
          placeholder="Write a message…"
          aria-label="Write a message"
          onKeyDown={(e) => { if (e.key === 'Enter') onSend(); }}
        />
        <button type="button" aria-label="Send message" onClick={onSend}><Send size={17} /></button>
      </div>
    </section>
  );
}

// Inline "rate the brand" card shown on a completed order (replaces the old pop-up).
function BrandRating({ brandName, onSubmit }) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const send = async () => {
    if (!rating || lock.current) return;
    lock.current = true;
    setBusy(true);
    try { await onSubmit({ rating, review: text.trim() }); } finally { lock.current = false; setBusy(false); }
  };
  return (
    <section className="cui-o-card">
      <div className="cui-o-h"><span>How was working with {brandName}?</span></div>
      <div className="cui-r-stars" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} className={n <= rating ? 'on' : ''} onClick={() => setRating(n)}>★</button>
        ))}
      </div>
      <textarea className="cui-r-ta" value={text} onChange={(e) => setText(e.target.value)} placeholder="Anything other creators should know? (optional)" maxLength={1000} />
      <div className="cui-r-submit">
        <button type="button" className="cui-o-btn" disabled={!rating || busy} onClick={send}>{busy ? 'Sending...' : 'Send rating'}</button>
        <span className="cui-r-hint">Your rating helps other creators decide.</span>
      </div>
    </section>
  );
}

function VersionsCard({ deal, versions }) {
  const content = deal?.content_submission || {};
  return (
    <section className="cui-o-card">
      <div className="cui-o-h"><span>What you sent</span><small>{versions.length} version{versions.length > 1 ? 's' : ''}</small></div>
      <div className="cui-r-vers">
        {versions.map((version) => {
          const { label: statusLabel, tone: statusTone } = versionStatusMeta(version.status);
          const watermark = content.watermark_required_until_approval && version.status !== 'approved';
          return (
            <article key={`${version.stage || ''}${version.version}`} className="cui-r-ver">
              <div className="cui-r-poster">
                {version.thumbnail_url ? (
                  <img src={getAssetUrl(version.thumbnail_url)} alt={`v${version.version} thumbnail`} />
                ) : version.video_url ? (
                  <video src={`${getAssetUrl(version.video_url)}#t=0.5`} muted playsInline preload="metadata" />
                ) : (
                  <Play size={24} />
                )}
                {version.video_url && (
                  <a href={getAssetUrl(version.video_url)} target="_blank" rel="noreferrer" aria-label={`Open v${version.version} preview`}><Play size={15} /></a>
                )}
                {watermark && (version.thumbnail_url || version.video_url) && <span className="wm" aria-hidden="true">UGCAD PREVIEW</span>}
              </div>
              <div className="cui-r-vmeta">
                <strong>{version.stage === 'raw' ? 'Raw ' : version.stage === 'edited' ? 'Edited ' : ''}v{version.version}</strong>
                <small>{formatDateTime(version.submitted_at)}</small>
                <span className={`cui-o-pill ${statusTone}`}>{statusLabel}</span>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function ShippingBlock({ deal, addressRef, unboxingVideoUrl, onUpload, onSubmitReceipt, uploading, uploadPercent = null, onActionCard, onRefresh }) {
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
    <section className="cui-o-card">
      <div className="cui-o-h">
        <span>Product</span>
        {received ? <span className="cui-o-pill ok">✓ Received {shortDate(receipt.received_at)}</span>
          : damaged ? <span className="cui-o-pill bad">Issue reported</span>
          : <span className="cui-o-pill muted">{shipment.courier_status ? String(shipment.courier_status).replace(/_/g, ' ') : 'Not shipped yet'}</span>}
      </div>
      <div className="cui-r-prod">
        {/* Creator confirms the delivery address before the team dispatches. The ref lets the
            "Confirm Delivery Address" button open + focus it. Uses the REAL campaign id, not
            deal.deal_id (a display id stored nowhere, which 404s). */}
        <ShippingDetailsCard ref={addressRef} campaignId={deal.campaign?.id || deal.campaign_id || deal.deal_id} onReady={onRefresh} />

        {hasCourierDetails ? (
          <div className="cui-r-kv">
            <div><small>Courier</small><b>{shipment.courier_partner || shipment.courier_name || 'Not assigned'}</b></div>
            <div><small>Tracking ID</small>{shipment.courier_tracking_url ? <a href={shipment.courier_tracking_url} target="_blank" rel="noreferrer">{shipment.tracking_id || 'Tracking link'} ↗</a> : <b>{shipment.tracking_id || 'Pending'}</b>}</div>
            <div><small>Status</small><b>{shipment.courier_status ? String(shipment.courier_status).replace(/_/g, ' ') : 'Pending'}</b></div>
            {/* The courier date only exists once the team/courier records it, and "received"
                only after the creator taps Mark Received — say that, not a bare "Not available". */}
            <div><small>Expected delivery</small><b>{shipment.expected_delivery_at ? formatDate(shipment.expected_delivery_at) : received ? 'Delivered' : 'Awaiting courier update'}</b></div>
          </div>
        ) : damaged ? (
          <div className="cui-r-note warn">Product issue has been reported. Shipping and content work is paused until admin resolution.</div>
        ) : null}

        {damaged ? (
          <div className="cui-r-acts" style={{ marginTop: 0 }}>
            <button type="button" className="cui-o-btn soft sm" onClick={() => onActionCard('Add Evidence')}>Add evidence</button>
            <button type="button" className="cui-o-btn ghost sm" onClick={() => onActionCard('Message Support')}>Message support</button>
          </div>
        ) : received ? (
          <div className="cui-r-ok" style={{ marginTop: 0 }}>
            <CheckCircle size={18} />
            <span>Product received on {formatDate(receipt.received_at)} - receipt confirmed.{' '}
              {submittedVideoUrl && <a className="cui-r-file" href={submittedVideoUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--cui-link)', fontWeight: 600 }}>View submitted unboxing video</a>}
            </span>
          </div>
        ) : (
          <>
            {hasCourierDetails ? (
              <>
                <button type="button" className="cui-o-btn" style={{ alignSelf: 'flex-start' }} disabled={!canSubmitReceipt} onClick={onSubmitReceipt}>Mark received</button>
                {!canSubmitReceipt && (
                  <p className="cui-r-hint" style={{ margin: 0 }}>
                    {!hasCourierDetails
                      ? 'Available once the brand adds shipment tracking.'
                      : !isShipped
                        ? 'Waiting for the brand to mark the package shipped.'
                        : !hasVideo
                          ? 'Upload your unboxing video to enable “Mark received”.'
                          : !deal?.can_mark_received
                            ? 'Waiting for the brand to confirm delivery. This updates automatically once the package is marked delivered.'
                            : 'Ready - tap “Mark received” to confirm.'}
                  </p>
                )}
                <input type="file" id="unboxing-upload" hidden accept="video/mp4,video/quicktime" onChange={(event) => onUpload(event.target.files?.[0])} />
                <UploadZone icon={Paperclip} label="Upload unboxing video" accept={`Show the package, opening and product · MP4/MOV · max ${MAX_UPLOAD_MB}MB`} uploaded={hasVideo} previewUrl={unboxingVideoUrl || receipt.unboxing_video_url} previewType="video" onClick={() => document.getElementById('unboxing-upload').click()} onFile={onUpload} disabled={uploading} progress={uploading ? uploadPercent : null} />
              </>
            ) : (
              <p className="cui-r-hint" style={{ margin: 0 }}>Available once the brand adds shipment tracking.</p>
            )}
          </>
        )}

        {deal?.can_report_damage && !damaged && !received && (
          <button type="button" className="cui-o-link" style={{ alignSelf: 'flex-start', minHeight: 44 }} onClick={() => onActionCard('Damage Report')}>Report a problem with the product</button>
        )}
      </div>
    </section>
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
  uploadPercent = null,
  onSubmit,
  submitting,
  heading = 'Your delivery'
}) {
  const content = deal?.content_submission || {};
  const required = getRequiredAssets(deal);
  const needsCaption = Boolean(required.caption_script);
  const needsThumbnail = Boolean(required.thumbnail);
  const stage = uploadStage(deal);
  const needsRaw = Boolean(required.raw_footage) && !stage;
  const rawOnly = Boolean(required.raw_only) && !stage;
  const stageDue = stage === 'raw' ? deal?.edit_flow?.raw_due : stage === 'edited' ? deal?.edit_flow?.edited_due : null;
  const canSubmit = canSubmitUploadedAssets(deal, { finalVideoUrl, captionUrl, thumbnailUrl, rawFootageUrl });
  // Content production only begins once the deal reaches the content stage
  // (for shipment deals that means the product must be received first).
  const contentUnlocked = Boolean(deal?.can_submit_content);
  const up = (setter, type) => (file) => onUpload(file, setter, type);

  return (
    <section className="cui-o-card" id="cui-r-deliver">
      <div className="cui-o-h"><span>{heading}</span><small>{content.watermark_required_until_approval ? 'Watermarked until the brand approves' : ''}</small></div>
      {!contentUnlocked && <div className="cui-r-note warn"><ShieldAlert size={16} /> Content upload unlocks when it is your turn to submit.</div>}
      {stage && contentUnlocked && (
        <div className="cui-r-note">
          {stage === 'raw'
            ? `Step 1 of 2: upload the RAW video${stageDue ? ` by ${formatDateTime(stageDue)}` : ''}. ${deal?.edit_flow?.mode === 'ugc' ? 'Once the brand approves it you’re paid and UGC.ad edits it.' : 'Once the brand approves it you’ll upload the edited video.'}`
            : `Step 2 of 2: the brand approved your raw video - upload the EDITED video${stageDue ? ` by ${formatDateTime(stageDue)}` : ''}.`}
        </div>
      )}
      <div style={{ marginTop: 14 }}>
        <UploadZone icon={Upload} label="Drag your video here, or browse" accept={`MP4 or MOV · up to ${MAX_UPLOAD_MB} MB`} uploaded={Boolean(finalVideoUrl)} previewUrl={finalVideoUrl} previewType="video" watermark={content.watermark_required_until_approval} onClick={() => document.getElementById('video-file-real').click()} onFile={up(setFinalVideoUrl, 'video')} disabled={!contentUnlocked || uploadingFile === 'video'} progress={uploadingFile === 'video' ? uploadPercent : null} />
      </div>
      <input type="file" id="video-file-real" accept="video/*" onChange={(event) => { onUpload(event.target.files?.[0], setFinalVideoUrl, 'video'); event.target.value = ''; }} hidden />
      {rawOnly && contentUnlocked && (
        <div className="cui-r-note">The brand asked for the raw video only - upload it once and submit. Nothing else is needed.</div>
      )}
      <div className="cui-r-assets">
        {needsCaption && (
          <div>
            <label>Caption / script</label>
            <UploadZone icon={FileText} label="Caption / Script" accept=".txt - .docx" uploaded={Boolean(captionUrl)} onClick={() => document.getElementById('caption-file-real').click()} onFile={up(setCaptionUrl, 'caption')} disabled={!contentUnlocked || uploadingFile === 'caption'} />
            <input type="file" id="caption-file-real" onChange={(event) => onUpload(event.target.files?.[0], setCaptionUrl, 'caption')} hidden />
          </div>
        )}
        {needsThumbnail && (
          <div>
            <label>Thumbnail</label>
            <UploadZone icon={Image} label="Thumbnail" accept="JPG - PNG" uploaded={Boolean(thumbnailUrl)} previewUrl={thumbnailUrl} previewType="image" watermark={content.watermark_required_until_approval} onClick={() => document.getElementById('thumb-file-real').click()} onFile={up(setThumbnailUrl, 'thumb')} disabled={!contentUnlocked || uploadingFile === 'thumb'} />
            <input type="file" id="thumb-file-real" accept="image/*" onChange={(event) => onUpload(event.target.files?.[0], setThumbnailUrl, 'thumb')} hidden />
          </div>
        )}
        {needsRaw && (
          <div>
            <label>Raw footage</label>
            <UploadZone icon={Paperclip} label="Raw Footage" accept={`MP4/MOV - Max ${MAX_UPLOAD_MB}MB`} uploaded={Boolean(rawFootageUrl)} previewUrl={rawFootageUrl} previewType="video" watermark={content.watermark_required_until_approval} onClick={() => document.getElementById('raw-file-real').click()} onFile={up(setRawFootageUrl, 'raw')} disabled={!contentUnlocked || uploadingFile === 'raw'} progress={uploadingFile === 'raw' ? uploadPercent : null} />
            <input type="file" id="raw-file-real" accept="video/*" onChange={(event) => onUpload(event.target.files?.[0], setRawFootageUrl, 'raw')} hidden />
          </div>
        )}
      </div>
      <div className="cui-r-submit">
        <button type="button" className="cui-o-btn" disabled={!canSubmit || submitting} onClick={onSubmit}>
          <Upload size={17} /> {submitting ? 'Submitting...' : stage === 'raw' || rawOnly ? 'Submit raw video' : stage === 'edited' ? 'Submit edited video' : 'Submit delivery'}
        </button>
        {!canSubmit && contentUnlocked && <span className="cui-r-hint">Upload everything required to enable Submit.</span>}
      </div>
    </section>
  );
}

function DamageReportCard({ deal, onActionCard }) {
  const report = getDamageReport(deal);
  const evidenceParts = [];
  if (report.evidenceCount) evidenceParts.push(`${report.evidenceCount} uploaded file${report.evidenceCount > 1 ? 's' : ''}`);
  if (report.hasUnboxing) evidenceParts.push('1 unboxing video');
  const rows = [
    ['Report type', 'Damaged / Wrong Product Reported'],
    ['Submitted on', formatDateTime(report.submittedOn)],
    ['Reason', report.reason],
    ['Description', report.description],
    ['Evidence uploaded', evidenceParts.length ? evidenceParts.join(' + ') : 'No evidence count available'],
    ['Status', report.status],
    ['Your timeline', 'Paused'],
    ['Payment', 'Held until resolution'],
  ];
  return (
    <section className="cui-o-card">
      <div className="cui-o-h"><span>Damage report</span><span className="cui-o-pill bad">{report.status}</span></div>
      <div className="cui-r-pay">
        {rows.map(([k, v]) => <div key={k}><span>{k}</span><span>{v}</span></div>)}
      </div>
      <div className="cui-r-acts">
        <button type="button" className="cui-o-btn soft sm" disabled={!report.evidenceUrls.length} onClick={() => window.open(getAssetUrl(report.evidenceUrls[0]), '_blank', 'noopener,noreferrer')}>View uploaded evidence</button>
        <button type="button" className="cui-o-btn ghost sm" onClick={() => onActionCard('Add Evidence')}>Add evidence</button>
      </div>
      {report.evidenceUrls.length ? (
        <div className="cui-r-list">
          {report.evidenceUrls.map((url, index) => {
            const isVideo = /\.(mp4|webm|mov)$/i.test(String(url).split('?')[0]);
            return (
              <a key={`${url}-${index}`} className="cui-r-item" href={getAssetUrl(url)} target="_blank" rel="noreferrer">
                {isVideo ? <Play size={18} /> : <FileText size={18} />}
                <span>Evidence {index + 1}</span>
              </a>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

const REVISION_RESPONSE_LABEL = {
  accepted: 'You accepted this revision - upload your revised video below.',
  scope_creep: 'You told the brand these changes go beyond the brief. Work it out together in chat - if you can’t agree, use “Escalate to admin” below.',
  partial_dispute: 'You accepted some changes and pushed back on the rest. Sort the rest out with the brand in chat - if you can’t agree, use “Escalate to admin” below.',
};

// Turn the brand's requested changes into a clean, de-duplicated checklist. The
// backend sometimes derives requested_changes from the feedback text (so both can
// arrive as one comma-run the creator can't parse) — split any multi-line / multi-
// sentence entries and drop blanks so each change becomes its own line.
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
// brand reviewed on the video. Split it into severity + pinned moment + text.
const CHANGE_TAG_RE = /^\s*\[([^\]@]+?)(?:\s*@\s*(\d+:\d{2}))?\]\s*/;
function parseChange(line) {
  const m = String(line).match(CHANGE_TAG_RE);
  if (!m) return { text: String(line), severity: '', timestamp: null };
  return { text: String(line).slice(m[0].length), severity: (m[1] || '').trim().toLowerCase(), timestamp: m[2] || null };
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
    const c = parseChange(line);
    return { id: `chg-${i}`, text: c.text.trim(), timestamp_seconds: tsToSeconds(c.timestamp) };
  });
}

// The video the brand reviewed = the creator's most recent submitted version, plus the
// brand's notes pinned to it.
function revisionVideoInfo(deal) {
  const versions = deal?.content_submission?.versions || [];
  const raw = [...versions].reverse().find((v) => v.video_url)?.video_url || deal?.content_submission?.video_url || '';
  const url = raw ? getAssetUrl(raw) : '';
  const comments = changeItemsToComments(toChangeItems(deal?.revision_tracker || {}));
  return { url, comments, hasTimestamps: comments.some((c) => c.timestamp_seconds != null), canOpen: Boolean(url) && comments.length > 0 };
}

function RevisionCard({ deal, submitting, onRevisionResponse, onDiscussWithBrand, onEscalate, onOpenVideo, canOpenVideo, hasTimestamps }) {
  const revision = deal?.revision_tracker || {};
  const changeItems = toChangeItems(revision);
  const hasRevision = Boolean(revision.latest_feedback || revision.requested_changes?.length);
  // Once the creator has responded, show what they chose instead of leaving the
  // buttons live (clicking them again looked like nothing was happening).
  const responded = revision.creator_response;
  const acceptedAlready = revision.accepted_changes || [];
  const total = changeItems.length;
  const quote = String(revision.notes || '').trim();
  const hrsLeft = revision.new_deadline_at ? Math.round((new Date(revision.new_deadline_at) - Date.now()) / 3600000) : null;

  return (
    <>
      <section className="cui-o-card">
        <div className="cui-o-h">
          <span>{total ? `${total} change${total > 1 ? 's' : ''} asked` : 'Changes asked'}</span>
          <small>Revision {revision.revision_count_used || 0} of {revision.revision_limit || 0} used</small>
        </div>
        {/* Brand feedback isn't shown raw here — it repeated the tagged string that the parsed
            list below already shows cleanly. Notes the brand added (if any) still surface as the quote. */}
        {quote && <div className="cui-r-quote">“{quote}”</div>}
        <div>
          {total ? changeItems.map((item, idx) => {
            const c = parseChange(item);
            // After responding, tick the ones the brand recorded as accepted so the
            // creator can still see what they agreed to.
            const isDone = responded && acceptedAlready.some((a) => String(a).toLowerCase() === item.toLowerCase());
            return (
              <div key={`${item}-${idx}`} className="cui-r-chg">
                {c.timestamp && <span className="t" title="Moment in your video">{c.timestamp}</span>}
                <span className="x">
                  {c.severity && <span className={`cui-r-sev ${c.severity === 'must-fix' ? 'must' : ''}`}>{c.severity === 'must-fix' ? 'Must-fix' : 'Preference'}</span>}
                  {c.text}
                </span>
                <span className={`b ${isDone ? 'on' : ''}`}>{isDone ? <Check size={13} /> : null}</span>
              </div>
            );
          }) : <p className="cui-r-hint" style={{ marginTop: 12 }}>No requested changes yet.</p>}
        </div>

        {responded ? (
          <>
            <p className="cui-r-ok"><Check size={16} /> {REVISION_RESPONSE_LABEL[responded] || `Response recorded: ${responded}`}</p>
            {/* Pushback is a disagreement to settle with the brand first — only offer the
                admin escalation here, once talking it out is on the table. */}
            {(responded === 'scope_creep' || responded === 'partial_dispute') && (
              <div className="cui-r-acts">
                <button type="button" className="cui-o-btn soft" onClick={() => onDiscussWithBrand?.()}>Chat with brand</button>
                <button type="button" className="cui-o-btn danger" onClick={() => onEscalate?.()}>Escalate to admin</button>
              </div>
            )}
          </>
        ) : (
          <div className="cui-r-acts">
            <button type="button" className="cui-o-btn" disabled={!hasRevision || submitting} onClick={() => onRevisionResponse('accepted', total ? changeItems : null)}>Accept &amp; revise</button>
            <button type="button" className="cui-o-btn ghost" onClick={() => onDiscussWithBrand?.()}>Ask a question</button>
            {canOpenVideo && <button type="button" className="cui-o-btn soft" onClick={onOpenVideo}><Play size={14} /> {hasTimestamps ? 'See changes on video' : 'View submitted video'}</button>}
          </div>
        )}
        {responded && canOpenVideo && (
          <div className="cui-r-acts"><button type="button" className="cui-o-btn soft sm" onClick={onOpenVideo}><Play size={14} /> {hasTimestamps ? 'See changes on video' : 'View submitted video'}</button></div>
        )}
      </section>

      <section className="cui-o-card">
        <div className="cui-r-due">
          <Clock size={24} />
          <div style={{ flex: 1 }}>
            <b>{revision.new_deadline_at ? (hrsLeft != null && hrsLeft >= 0 ? `Send the new version in ${hrsLeft} hrs` : `Send the new version by ${formatDateTime(revision.new_deadline_at)}`) : 'Send the new version when ready'}</b>
            <small>{revision.new_deadline_at ? `New deadline: ${formatDateTime(revision.new_deadline_at)}` : 'The brand has not set a new deadline.'}</small>
          </div>
        </div>
      </section>

      {!responded && (
        <p className="cui-r-hint" style={{ margin: 0 }}>
          Not fair? If a change wasn’t in the brief,{' '}
          <button type="button" className="cui-o-link" disabled={submitting} style={{ minHeight: 32 }} onClick={() => onRevisionResponse('scope_creep', [])}>tell the brand these changes go beyond the brief</button>
          {' '}- you can then ask UGCad to check, and your payment stays held.
        </p>
      )}
    </>
  );
}
