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
  Flag,
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
          <span className="deal-upload-preview-label"><CheckCircle size={14} /> File uploaded successfully</span>
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
  return deal?.brand?.handle || deal?.campaign?.brand_handle || deal?.campaign?.business_nickname || 'Brand';
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

function getPrimaryActionConfig(deal, uploads, submitting) {
  if (!deal) return { label: 'No deal selected', disabled: true, type: 'none' };
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
  return {
    label: deal.primary_next_action || 'Waiting',
    disabled: true,
    type: 'passive'
  };
}

// 7-step reference stepper. Map the detailed deal state onto one of these steps.
const DEAL_STEPS = ['Accepted', 'In Progress', 'Submitted', 'In Review', 'Approved', 'Shipped', 'Paid'];
const STEP_SUBS = ['Deal accepted', 'Working on it', 'Waiting for you', 'Waiting for review', 'Waiting for approval', 'Waiting for delivery', 'Waiting for payout'];

function getDealStepIndex(state) {
  const s = stateKey(state);
  if (s.includes('paid')) return 6;
  if (s.includes('approved')) return 4;
  if (s.includes('await') && s.includes('review')) return 3;
  if (s.includes('content submitted')) return 2;
  if (s.includes('revision')) return 1;
  if (s.includes('content in progress') || s.includes('received')) return 1;
  if (s.includes('delivered')) return 1;
  if (s.includes('shipped') || s.includes('transit') || s.includes('accepted')) return 0;
  return 0;
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
  const [searchParams] = useSearchParams();
  const [deals, setDeals] = useState([]);
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [briefOpen, setBriefOpen] = useState(false);
  const [fullBrief, setFullBrief] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [leftTab, setLeftTab] = useState('overview');
  const [chatOpen, setChatOpen] = useState(false);
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
  const evidenceInputRef = useRef(null);
  const shipAddressRef = useRef(null);   // "Confirm Delivery Address" scrolls here

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
  }, [selectedDeal?.deal_id]);

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

  const handleRevisionResponse = async (response) => {
    if (!selectedDeal?.deal_id) return;
    try {
      await axios.post(`${API}/deals/${selectedDeal.deal_id}/revision-response`, {
        response,
        note: response === 'accepted' ? 'Creator accepted the revision request.' : 'Creator flagged the revision request from Deal Room.'
      });
      toast.success('Revision response submitted');
      fetchDeals();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Revision response failed'));
    }
  };

  const handleArchiveDeal = () => {
    if (!selectedDeal) return;
    if (!isState(selectedDeal, 'Paid - Complete')) {
      toast.error('Only completed deals can be archived');
      return;
    }
    const nextDeals = deals.filter((deal) => getDealId(deal) !== getDealId(selectedDeal));
    setDeals(nextDeals);
    setSelectedDeal(nextDeals[0] || null);
    toast.success('Deal archived from this view');
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
    return null;
  };

  const selectedState = getState(selectedDeal);
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

  const stepIndex = getDealStepIndex(selectedState);
  const brandName = deal?.brand?.name || getBrandHandle(deal);
  const creatorName = user?.nickname || user?.full_name || (user?.username ? `@${user.username}` : 'You');
  const dealTags = (Array.isArray(deal?.campaign?.objectives) && deal.campaign.objectives.length
    ? deal.campaign.objectives.slice(0, 2)
    : [deal?.campaign?.industry_type || 'UGC']).concat('UGC Video');
  const shipmentRequired = deal?.shipment?.required || deal?.campaign?.requires_shipment;
  const shipment = deal?.shipment || {};
  const chatMessages = deal?.chat_summary?.messages || [];
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
          <button type="button" onClick={() => navigate('/my-active-work')}><ArrowLeft size={16} /> Back to My Deals</button>
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
              <div className="cmk-dr-id">Deal ID: {getDealId(deal)} <span className="cmk-pill info">● {selectedState}</span></div>
              <div className="cmk-dr-tags">{dealTags.map((t, i) => <span key={i}>{t}</span>)}</div>
            </div>
            <div className="cmk-dr-next"><Clock size={20} /><div><small>Next Action</small><strong>{primaryAction.label}</strong></div></div>
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
        <section className="cmk-dr-steps">
          {DEAL_STEPS.map((label, i) => {
            const state = i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'todo';
            return (
              <div key={label} className={`cmk-dr-step ${state}`}>
                <span className="dot">{state === 'done' ? <Check size={15} /> : i + 1}</span>
                {i < DEAL_STEPS.length - 1 && <i className={`line ${i < stepIndex ? 'on' : ''}`} />}
                <span className="lbl">{label}</span>
                <span className="sub">{STEP_SUBS[i]}</span>
              </div>
            );
          })}
        </section>

        {/* body */}
        <div className="cmk-dr-body">
          <main>
            {/* A direct booking isn't real work until the creator accepts it. */}
            <BookingCard deal={deal} role="creator" onDone={fetchDeals} />

            <div className="cmk-dr-tabs">
              {['overview', 'brief', 'deliverables', 'timeline', 'payments'].map((t) => (
                <button key={t} type="button" className={leftTab === t ? 'on' : ''} onClick={() => setLeftTab(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {leftTab === 'overview' && (
              <>
                <section className="cmk-card cmk-dr-sec">
                  <div className="cmk-dr-sec-h">
                    <div><h2>Deliverables</h2><span className="meta">{deliverablesDone} of {deliverables.length} completed</span></div>
                    <button type="button" className="cmk-dr-upload" disabled={primaryAction.disabled} onClick={handlePrimaryAction}>
                      <Upload size={16} /> {primaryAction.type === 'content' ? 'Upload / Submit Work' : uploadLabel}
                    </button>
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
                <RevisionTracker deal={deal} onRevisionResponse={handleRevisionResponse} />
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
                  <button type="button" onClick={() => handleActionCardRequest('Raise Dispute')}><Flag size={15} /> Raise Dispute</button>
                  <button type="button" onClick={() => handleActionCardRequest('Escalate to Admin')}><Headphones size={15} /> Get Help</button>
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
                <p><span>Status</span><strong>{selectedState}</strong></p>
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
              <button type="button" className="esc-btn" onClick={() => setLeftTab('payments')}>View Payment Details</button>
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
            <button type="button" className="x" aria-label="Close chat" onClick={() => setChatOpen(false)}><X size={18} /></button>
          </div>
          <div className="cmk-dr-msgs">
            {chatMessages.length ? chatMessages.map((m) => (
              <div key={m.id} className={`cmk-dr-m ${m.sender_type === 'creator' ? 'me' : m.sender_type === 'system' ? 'sys' : 'them'}`}>
                <div className="who">{m.sender_name}</div>
                <div className="bub">{m.message}</div>
              </div>
            )) : <p className="cmk-dr-empty-msg">No messages yet.</p>}
          </div>
          <div className="cmk-dr-chat-in">
            <input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type your message..." onKeyDown={(e) => { if (e.key === 'Enter') handleSendMessage(); }} />
            <button type="button" className="send" onClick={handleSendMessage}><Send size={17} /></button>
          </div>
        </div>
      )}

      <button
        type="button"
        className={`cmk-dr-chat-fab ${chatOpen ? 'is-open' : ''}`}
        onClick={() => setChatOpen((v) => !v)}
        aria-label={chatOpen ? 'Close chat' : 'Open chat'}
      >
        {chatOpen ? <X size={22} /> : <MessageSquare size={22} />}
        {!chatOpen && chatMessages.length > 0 && <i className="cmk-dr-fab-badge">{chatMessages.length}</i>}
      </button>
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
              <button type="button" onClick={() => onActionCard('Raise Dispute')}>Raise Dispute</button>
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
          <UploadZone icon={Paperclip} label="Upload Unboxing Video" accept="MP4/MOV - Max 150MB - Max 2 minutes" uploaded={hasVideo} previewUrl={unboxingVideoUrl || receipt.unboxing_video_url} previewType="video" onClick={() => document.getElementById('unboxing-upload').click()} disabled={uploading} />
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
  if (awaitingReceipt) {
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
      <UploadZone icon={Play} label="Final Video Upload" accept="MP4 - MOV" uploaded={Boolean(finalVideoUrl)} previewUrl={finalVideoUrl} previewType="video" watermark={content.watermark_required_until_approval} onClick={() => document.getElementById('video-file-real').click()} disabled={!contentUnlocked || uploadingFile === 'video'} />
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
            <UploadZone icon={Paperclip} label="Raw Footage" accept="MP4 - MOV" uploaded={Boolean(rawFootageUrl)} previewUrl={rawFootageUrl} previewType="video" onClick={() => document.getElementById('raw-file-real').click()} disabled={!contentUnlocked || uploadingFile === 'raw'} />
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
                  <span className="deal-preview-watermark" aria-hidden="true" />
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
        <Upload size={17} /> {submitting ? 'Submitting...' : 'Submit Final Delivery'}
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
  scope_creep: 'You flagged this as scope creep — a dispute was raised and the platform team will review it.',
  partial_dispute: 'You partially accepted and disputed the rest — a dispute was raised for review.',
};

function RevisionTracker({ deal, onRevisionResponse }) {
  const revision = deal?.revision_tracker || {};
  const hasRevision = Boolean(revision.latest_feedback || revision.requested_changes?.length);
  // Once the creator has responded, show what they chose instead of leaving the
  // buttons live (clicking them again looked like nothing was happening).
  const responded = revision.creator_response;
  return (
    <DealCard className="deal-revisions">
      <div className="deal-section-title">
        <span className="warn"><RotateCcw size={18} /></span>
        <div><h2>Revision Tracker</h2><p>Revision {revision.revision_count_used || 0} of {revision.revision_limit || 0} used</p></div>
      </div>
      <div className="deal-revision-box">
        <p><small>Brand Feedback</small><strong>{revision.latest_feedback || 'No revision requested yet.'}</strong></p>
        <p><small>Requested Changes</small><strong>{revision.requested_changes?.length ? revision.requested_changes.join(', ') : 'No requested changes.'}</strong></p>
        <p><small>New Deadline</small><strong>{formatDateTime(revision.new_deadline_at)}</strong></p>
      </div>
      {responded ? (
        <p className="deal-revision-responded">
          <Check size={15} /> {REVISION_RESPONSE_LABEL[responded] || `Response recorded: ${responded}`}
        </p>
      ) : (
        <div className="deal-revision-actions">
          <button type="button" disabled={!hasRevision} onClick={() => onRevisionResponse('accepted')}>Accept and revise</button>
          <button type="button" disabled={!hasRevision} onClick={() => onRevisionResponse('scope_creep')}>Flag scope creep</button>
          <button type="button" disabled={!hasRevision} onClick={() => onRevisionResponse('partial_dispute')}>Partially accept and dispute remaining items</button>
        </div>
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
  const creatorActions = damaged ? ['Add Evidence', 'Escalate to Admin', 'Raise Dispute', 'Message Support'] : ['Milestone Update', 'Escalate to Admin', 'Raise Dispute', 'Damage Report'];

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
                  {item.sender_name}: {item.message}
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
              [Headphones, 'Escalate to Admin'],
              [Flag, 'Raise Dispute'],
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
