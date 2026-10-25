// Creator app: order room (deal room). Ported from src/pages/MyDealsPage.js (+ the quick form in WorkSubmission.js).
// Route: /my-deals?campaign=<id> (or ?deal=<id>); the legacy /work/submit?campaign=<id> opens the same room.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Archive, Check, CheckCircle, Clock, FileWarning, Package, Play, Send, Upload, WifiOff,
} from 'lucide-react';
import { useAuth } from '../../../App';
import { useLiveEffect } from '../../../lib/liveUpdates';
import { loadCreatorDeal } from '../../../utils/creatorDeals';
import { apiErrorMessage } from '../../../utils/apiError';
import { uploadMedia, MAX_UPLOAD_MB } from '../../../utils/upload';
import { getDealMessages } from '../../../utils/dealMessages';
import { inr, brandTile, orderStatus, dueLabel, shortDate } from '../../../utils/orderUi';
import AppShell from '../../shell/AppShell';
import { BookingPanel, DeliverSheet, ReceiptSheet, AddressSheet, ChangesVideoSheet, ProblemSheet } from './OrderSheets';
import {
  API, assetUrl, initial, dealBrand, dealTitle, escrowAmount, getState, isState, isDamageState, isCancelledDeal,
  getPrimaryActionConfig, roomProgress, hoursText, uploadStage, getRequiredAssets, missingAssets, toChangeItems, parseChange,
  revisionVideoInfo, versionStatusMeta, formatDateTime, formatDate, pillClass, loadErrorText,
} from './orderLogic';
import './orders.css';

const REVISION_RESPONSE_LABEL = {
  accepted: 'You accepted this revision. Upload your revised video when ready.',
  scope_creep: 'You told the brand these changes go beyond the brief. Work it out together in chat. If you cannot agree, ask UGCad to step in.',
  partial_dispute: 'You accepted some changes and pushed back on the rest. Sort the rest out with the brand in chat. If you cannot agree, ask UGCad to step in.',
};
const MORE_TIME_MSG = 'Hi! Could we move the deadline by a day or two? I want to make sure the video is right. Happy to agree a new date here.';
const REVISION_Q_MSG = "Hi! Before I start on these revisions, could we confirm exactly how many changes are included in this request so we're on the same page?";

// Render a brief blob nicely: every "Label: value" line gets a bold label. Budget visibility is brand-only.
function BriefContent({ content }) {
  if (!content) return <p>Not specified</p>;
  return String(content).split(/\r?\n/).map((line, i) => {
    const t = line.trim();
    if (!t) return null;
    if (/^budget visibility\s*:/i.test(t)) return null;
    const m = t.match(/^([A-Z][^:]{0,40}):\s*(.*)$/);
    if (m && m[2]) return <p key={i}><strong>{m[1]}:</strong> {m[2]}</p>;
    if (m) return <p key={i}><strong>{m[1]}:</strong></p>;
    return <p key={i}>{t}</p>;
  });
}

function RoomSkeleton() {
  return (
    <div className="ap-or-wrap" aria-busy="true" aria-label="Loading order">
      <div className="ap-or-c"><div className="ap-skel" style={{ height: 56 }} /><div className="ap-skel" style={{ height: 8, marginTop: 20 }} /></div>
      <div className="ap-skel" style={{ height: 150, borderRadius: 22 }} />
      {[0, 1].map((i) => (
        <div className="ap-or-c" key={i}>
          <div className="ap-skel" style={{ height: 16, width: '45%' }} />
          <div className="ap-skel" style={{ height: 12, marginTop: 14 }} />
          <div className="ap-skel" style={{ height: 12, marginTop: 10, width: '80%' }} />
        </div>
      ))}
    </div>
  );
}

export default function OrderRoom() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const target = sp.get('campaign') || sp.get('deal');
  const targetRef = useRef(target);
  targetRef.current = target;

  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null); // { message, notFound }
  const fetchSeq = useRef(0);
  const fetching = useRef(false);

  const [uploads, setUploads] = useState({});
  const [names, setNames] = useState({});
  const [uploading, setUploading] = useState(null); // { key, percent }
  const [submitting, setSubmitting] = useState(false);
  const [receiptBusy, setReceiptBusy] = useState(false);
  const [problemBusy, setProblemBusy] = useState(false);
  const [revBusy, setRevBusy] = useState(false);
  const lock = useRef(false);

  const [sheet, setSheet] = useState(null); // 'deliver' | 'receipt-ok' | 'receipt-bad' | 'address' | 'video' | 'problem'
  const [briefOpen, setBriefOpen] = useState(false);
  const [fullBrief, setFullBrief] = useState(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [showAllActivity, setShowAllActivity] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [, setSeenTick] = useState(0);
  const [dur, setDur] = useState(0);
  const [reviewFor, setReviewFor] = useState(null);
  const reviewAsked = useRef({});
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [reviewBusy, setReviewBusy] = useState(false);
  const evidenceRef = useRef(null);
  const composerRef = useRef(null);
  const [evidenceBusy, setEvidenceBusy] = useState(false);

  const fetchDeal = async (explicit) => {
    if (fetching.current && !explicit) return;
    const seq = ++fetchSeq.current;
    fetching.current = true;
    try {
      const { detail } = await loadCreatorDeal(API, explicit || targetRef.current);
      if (seq !== fetchSeq.current) return;
      setDeal(detail);
      setLoadError(null);
    } catch (error) {
      if (seq === fetchSeq.current) {
        const status = error?.response?.status;
        // The 10s poll keeps the last good deal on screen; only a first load (no deal yet) shows the error.
        setLoadError({
          notFound: status === 404 || status === 403,
          message: !error?.response
            ? loadErrorText(error)
            : (status === 404 || status === 403) ? 'This order could not be found, or it is no longer available to you.' : 'Could not load this order.',
        });
      }
    } finally {
      if (seq === fetchSeq.current) { fetching.current = false; setLoading(false); }
    }
  };

  useLiveEffect(() => {
    if (!user?.id) return undefined;
    fetchDeal();
    const interval = setInterval(fetchDeal, 10000);
    return () => clearInterval(interval);
  }, [user?.id, target]); // eslint-disable-line react-hooks/exhaustive-deps

  // A different order: forget the previous order's drafts.
  const dealId = deal?.deal_id;
  useEffect(() => {
    setBriefOpen(false); setFullBrief(null); setMessage(''); setUploads({}); setNames({}); setSheet(null); setShowAllActivity(false);
  }, [dealId]);

  // Once paid, ask (once) to rate the brand, unless this creator already did.
  const isPaid = isState(deal, 'Paid - Complete');
  useEffect(() => {
    const campaignId = deal?.campaign?.id;
    const businessId = deal?.campaign?.business_id;
    if (!isPaid || !campaignId || !businessId || !user?.id || reviewAsked.current[campaignId]) return undefined;
    reviewAsked.current[campaignId] = true;
    let alive = true;
    axios.get(`${API}/reviews/business/${businessId}`)
      .then((r) => {
        const list = Array.isArray(r.data) ? r.data : [];
        const done = list.some((rv) => rv.campaign_id === campaignId && rv.reviewer_id === user.id);
        if (alive && !done) setReviewFor({ campaignId, businessId });
      })
      .catch(() => {}); // endpoint unavailable: stay silent rather than risk a duplicate review
    return () => { alive = false; };
  }, [isPaid, deal?.campaign?.id, deal?.campaign?.business_id, user?.id]);

  // ---- actions ---------------------------------------------------------------
  const pickFile = async (key, file) => {
    if (!file || uploading) return;
    setUploading({ key, percent: 0 });
    try {
      // uploadMedia refuses an oversized video up front, reports progress, and sends big files straight to S3.
      const data = await uploadMedia(file, API, { onProgress: (percent) => setUploading({ key, percent }) });
      setUploads((u) => ({ ...u, [key]: data.file_url }));
      setNames((n) => ({ ...n, [key]: file.name }));
      toast.success('File uploaded');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Upload failed'));
    } finally {
      setUploading(null);
    }
  };
  const clearFile = (key) => { setUploads((u) => ({ ...u, [key]: null })); setNames((n) => ({ ...n, [key]: null })); };

  const submitContent = async () => {
    if (!deal?.deal_id) return false;
    if (uploading) { toast.error('Please wait - a file is still uploading.'); return false; }
    const missing = missingAssets(deal, uploads);
    if (missing.length) { toast.error(`Missing required asset: ${missing.join(', ')}`); return false; }
    if (lock.current) return false;
    lock.current = true;
    setSubmitting(true);
    const stage = uploadStage(deal);
    try {
      await axios.post(`${API}/deals/${deal.deal_id}/content`, {
        video_url: uploads.finalVideoUrl,
        caption_url: uploads.captionUrl,
        thumbnail_url: uploads.thumbnailUrl,
        raw_footage_url: stage ? null : uploads.rawFootageUrl,
        creator_note: 'Submitted from creator deal room',
      });
      toast.success(stage === 'raw' ? 'Raw video submitted for brand review' : stage === 'edited' ? 'Edited video submitted for brand review' : 'Content submitted for brand review');
      setUploads((u) => ({ ...u, finalVideoUrl: null, captionUrl: null, thumbnailUrl: null, rawFootageUrl: null }));
      setNames({});
      fetchDeal();
      return true;
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Submission failed'));
      return false;
    } finally {
      lock.current = false;
      setSubmitting(false);
    }
  };

  const submitReceipt = async () => {
    if (!deal?.deal_id) return;
    if (!deal?.can_mark_received) { toast.error('You can mark the product received only after the brand ships it.'); return; }
    const video = uploads.unboxingVideoUrl || deal?.receipt?.unboxing_video_url;
    if (!video) { toast.error('Upload an unboxing video before marking received'); return; }
    if (lock.current) return;
    lock.current = true;
    setReceiptBusy(true);
    try {
      await axios.post(`${API}/deals/${deal.deal_id}/receipt`, { received_at: new Date().toISOString(), unboxing_video_url: video, items_damaged: false, damage_report: null });
      toast.success('Receipt submitted');
      setUploads((u) => ({ ...u, unboxingVideoUrl: null }));
      setSheet(null);
      fetchDeal();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Receipt submission failed'));
    } finally { lock.current = false; setReceiptBusy(false); }
  };

  const unboxing = () => [uploads.unboxingVideoUrl || deal?.receipt?.unboxing_video_url].filter(Boolean);

  const reportDamage = async (text) => {
    if (!deal?.deal_id || receiptBusy) return;
    setReceiptBusy(true);
    try {
      await axios.post(`${API}/deals/${deal.deal_id}/damage-report`, { message: text || 'Damaged or wrong product reported by creator', attachment_urls: unboxing() });
      toast.success('Damage reported');
      setSheet(null);
      fetchDeal();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Action failed'));
    } finally { setReceiptBusy(false); }
  };

  const escalate = async (text) => {
    if (!deal?.deal_id) return false;
    setProblemBusy(true);
    try {
      await axios.post(`${API}/deals/${deal.deal_id}/escalate`, { message: text, attachment_urls: unboxing() });
      toast.success('Escalated to admin');
      fetchDeal();
      return true;
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Action failed'));
      return false;
    } finally { setProblemBusy(false); }
  };

  const addEvidence = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length || !deal?.deal_id || evidenceBusy) return;
    setEvidenceBusy(true);
    try {
      const urls = await Promise.all(files.map(async (f) => (await uploadMedia(f, API)).file_url));
      await axios.post(`${API}/deals/${deal.deal_id}/action-card`, { type: 'damage_report', message: 'Add Evidence', attachment_urls: urls });
      toast.success(`${urls.length} evidence file${urls.length > 1 ? 's' : ''} uploaded`);
      fetchDeal();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Evidence upload failed'));
    } finally { setEvidenceBusy(false); }
  };

  const respondRevision = async (response, accepted = null) => {
    if (!deal?.deal_id || revBusy) return;
    setRevBusy(true);
    try {
      await axios.post(`${API}/deals/${deal.deal_id}/revision-response`, {
        response,
        accepted_changes: accepted || undefined,
        note: response === 'accepted'
          ? (accepted?.length ? `Creator accepted these changes: ${accepted.join('; ')}.` : 'Creator accepted the revision request.')
          : 'Creator flagged the revision request from Deal Room.',
      });
      toast.success('Revision response submitted');
      fetchDeal();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Revision response failed'));
    } finally { setRevBusy(false); }
  };

  const archive = async () => {
    if (!deal) return;
    if (!isState(deal, 'Paid - Complete')) { toast.error('Only completed deals can be archived'); return; }
    const id = deal?.deal_id || deal?.campaign?.deal_id || deal?.campaign?.id;
    try {
      await axios.post(`${API}/deals/${id}/archive`);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not archive this deal'));
      return;
    }
    toast.success('Deal archived');
    navigate('/my-deals');
  };

  const sendMessage = async () => {
    if (!deal?.deal_id || !message.trim() || sending) return;
    setSending(true);
    try {
      await axios.post(`${API}/deals/${deal.deal_id}/chat`, { message: message.trim(), attachment_urls: [] });
      setMessage('');
      fetchDeal();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Message failed'));
    } finally { setSending(false); }
  };

  const submitReview = async () => {
    if (!rating || reviewBusy || !reviewFor) return;
    setReviewBusy(true);
    try {
      await axios.post(`${API}/reviews`, { campaign_id: reviewFor.campaignId, business_id: reviewFor.businessId, rating, review: reviewText.trim() });
      toast.success('Review submitted - thanks for the feedback!');
      setReviewFor(null);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not submit your review'));
    } finally { setReviewBusy(false); }
  };

  const toggleBrief = async () => {
    const next = !briefOpen;
    setBriefOpen(next);
    if (next && !fullBrief && deal?.campaign?.id) {
      setBriefLoading(true);
      try {
        const res = await axios.get(`${API}/campaigns/${deal.campaign.id}`);
        setFullBrief(res.data);
      } catch (e) { /* fall back to the short brief sections already shown */ } finally { setBriefLoading(false); }
    }
  };

  // ---- derived -------------------------------------------------------------------
  const messages = useMemo(() => getDealMessages(deal, 'creator', user?.id), [deal, user?.id]);
  const chatKey = deal ? `dealChatSeen:${user?.id}:${deal?.deal_id || deal?.campaign?.id}` : null;
  const inbound = messages.filter((m) => m.sender_type && m.sender_type !== 'creator').length;
  let seen = 0;
  try { seen = chatKey ? Number(localStorage.getItem(chatKey) || 0) : 0; } catch { seen = 0; }
  const unread = Math.max(0, inbound - seen);
  const markSeen = () => {
    if (!chatKey) return;
    try { localStorage.setItem(chatKey, String(inbound)); } catch { /* private mode */ }
    setSeenTick((t) => t + 1);
  };
  const askBrand = (text) => {
    markSeen();
    setMessage((prev) => prev || text);
    setTimeout(() => {
      composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      composerRef.current?.focus({ preventScroll: true });
    }, 60);
  };

  useEffect(() => {
    const el = document.getElementById('ap-or-msgs');
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // ---- render -----------------------------------------------------------------------
  const wrapCls = 'ap-or-wrap';
  if (loading) return <AppShell title="Order" back="/my-deals" tabs={false}><RoomSkeleton /></AppShell>;
  if (!deal) {
    const offline = loadError?.message?.startsWith("You're offline");
    return (
      <AppShell title="Order" back="/my-deals" tabs={false}>
        <div className="ap-empty">
          {offline ? <WifiOff size={36} color="#6e6e96" /> : <Package size={36} color="#6e6e96" />}
          <h3>{loadError?.notFound ? 'Order not found' : loadError ? 'Could not load this order' : 'No orders yet'}</h3>
          <p>{loadError?.message || 'When a brand picks you or you accept an invite, the order shows up here.'}</p>
          {loadError && !loadError.notFound
            ? <button type="button" className="ap-btn" onClick={() => { setLoading(true); fetchDeal(); }}>Retry</button>
            : <button type="button" className="ap-btn" onClick={() => navigate('/my-deals')}>Back to orders</button>}
        </div>
      </AppShell>
    );
  }

  const brandName = dealBrand(deal);
  const { bg, fg } = brandTile(brandName);
  const logo = deal?.brand?.logo_url;
  const status = orderStatus(deal);
  const due = dueLabel(deal);
  const ships = Boolean(deal?.shipment?.required || deal?.campaign?.requires_shipment || deal?.requires_shipment);
  const progress = roomProgress(deal, ships);
  const escrow = deal.escrow || {};
  const net = escrow.net_payable ?? escrowAmount(deal);
  const versions = deal?.content_submission?.versions || [];
  const lastVersion = versions.length ? versions[versions.length - 1] : null;
  const revision = deal?.revision_tracker || {};
  const inRevision = isState(deal, 'Revision Requested');
  const isApproved = isState(deal, 'Approved - Payment Processing');
  const inReview = isState(deal, 'Content Submitted - Awaiting Review');
  const cancelled = isCancelledDeal(deal);
  const damaged = isDamageState(deal);
  const stage = uploadStage(deal);
  const receipt = deal?.receipt || {};
  const shipment = deal?.shipment || {};
  const received = Boolean(receipt.received_at);
  const countdownH = deal?.deadline_countdown_hours;
  const revVideo = revisionVideoInfo(deal);
  const payoutDate = escrow.estimated_payout_at ? shortDate(escrow.estimated_payout_at) : '';
  const mergedUploads = { ...uploads, unboxingVideoUrl: uploads.unboxingVideoUrl || receipt.unboxing_video_url };
  const primary = getPrimaryActionConfig(deal, mergedUploads, submitting);
  const canDeliver = primary.type === 'content';
  const canEscalate = damaged || ['scope_creep', 'partial_dispute'].includes(revision.creator_response);
  const deductions = (escrow.deductions || []).filter((x) => Number(x.amount) > 0);
  const activity = deal?.activity_feed || [];
  const visibleActivity = showAllActivity ? activity : activity.slice(0, 5);
  const brandId = deal?.brand?.id || deal?.campaign?.business_id;
  const openChat = () => (brandId ? navigate(`/messages?conv=${encodeURIComponent(brandId)}`) : askBrand(''));
  const idText = String(deal?.deal_id || deal?.campaign?.id || '');
  const title = idText && idText.length <= 14 ? `Order ${idText}` : 'Order';

  // The big top card: what is going on and the one thing to do next.
  const allAttached = canDeliver && !primary.disabled;
  let hero = { eyebrow: 'In progress', title: primary.label, sub: '' };
  if (cancelled) hero = { eyebrow: 'Cancelled', title: 'This order was cancelled', sub: 'The brand ended this deal. There is nothing more to do here.', grey: true };
  else if (damaged) hero = { eyebrow: 'On hold', title: 'Issue under review', sub: 'Admin and the brand are reviewing your evidence. Your timeline is paused. You can add more evidence if needed.', action: { label: evidenceBusy ? 'Uploading…' : 'Add evidence', onClick: () => evidenceRef.current?.click(), disabled: evidenceBusy, icon: Upload } };
  else if (isPaid) hero = { eyebrow: `Approved by ${brandName}`, title: `+${inr(net)} paid to your wallet`, sub: payoutDate ? `Paid ${payoutDate}` : 'Payment complete', tick: true, action: { label: 'Withdraw', onClick: () => navigate('/withdrawal') } };
  else if (isApproved) hero = { eyebrow: `Approved by ${brandName}`, title: 'Payment is on its way', sub: `${inr(net)} will reach your wallet shortly.`, tick: true };
  else if (isState(deal, 'Raw Approved - UGC.ad Editing')) hero = { eyebrow: 'Raw approved', title: 'UGC.ad is editing your video', sub: 'Your raw video was approved. Nothing more to upload.' };
  else if (inReview) hero = { eyebrow: `Delivered${lastVersion?.submitted_at ? ` · ${shortDate(lastVersion.submitted_at)}` : ''} · waiting for ${brandName}`, title: 'Waiting for the brand', sub: 'They can approve or ask for changes. If they do not reply, it is approved automatically and you get paid.', count: typeof countdownH === 'number' && countdownH >= 0 ? countdownH : null };
  else if (canDeliver && !inRevision) hero = {
    eyebrow: `Your turn${due ? ` · ${due.text}` : ''}`,
    title: stage === 'raw' || getRequiredAssets(deal).raw_only ? 'Deliver your raw video' : stage === 'edited' ? 'Deliver your edited video' : 'Deliver your video',
    sub: deal?.can_submit_content ? 'Upload your video, then send it for review.' : 'Content upload unlocks when it is your turn.',
    fine: deal?.can_submit_content && deal?.content_submission?.watermark_required_until_approval ? `MP4 or MOV · up to ${MAX_UPLOAD_MB} MB · we watermark it until the brand approves` : (deal?.can_submit_content ? `MP4 or MOV · up to ${MAX_UPLOAD_MB} MB` : ''),
    action: { label: allAttached ? 'Review & send' : 'Upload video', onClick: () => setSheet('deliver'), disabled: !deal?.can_submit_content, icon: Upload },
  };
  else if (primary.type === 'receipt') hero = { eyebrow: 'Product arrived', title: 'Confirm you received it', sub: 'Upload a short unboxing video, then confirm.', action: { label: 'Mark received', onClick: () => setSheet('receipt-ok'), disabled: !deal?.can_mark_received } };
  else if (primary.type === 'track_shipment') hero = { eyebrow: 'On its way', title: 'Your product is in transit', sub: shipment.expected_delivery_at ? `Expected ${formatDate(shipment.expected_delivery_at)}.` : 'The courier has picked it up.', action: { label: 'Track shipment', onClick: () => window.open(shipment.courier_tracking_url, '_blank', 'noopener,noreferrer'), disabled: primary.disabled } };
  else if (primary.type === 'ship_address') hero = { eyebrow: 'Your turn', title: 'Confirm your delivery address', sub: 'The brand ships your product as soon as you confirm where it should go.', action: { label: 'Confirm delivery address', onClick: () => setSheet('address') } };
  else if (primary.type === 'ship_address_done') hero = { eyebrow: 'Waiting on brand', title: 'Address submitted', sub: 'The brand will ship your product soon. We will update this page.' };
  else if (inRevision) hero = null;
  else if (primary.type === 'passive') hero = { eyebrow: 'In progress', title: primary.label, sub: deal?.active_party === 'brand' ? `Waiting for ${brandName}.` : '' };

  const payNote = isPaid ? (payoutDate ? `Paid ${payoutDate}.` : 'Payment complete.')
    : isApproved ? 'Approved. Your payout is being processed.'
    : inRevision ? `Paid after ${brandName} approves the new version.`
    : inReview ? `Paid when ${brandName} approves, or automatically if they do not reply.`
    : `Paid when ${brandName} approves your work.`;

  // revision
  const changeItems = toChangeItems(revision);
  const responded = revision.creator_response;
  const acceptedAlready = revision.accepted_changes || [];
  const quote = String(revision.notes || '').trim();
  const hrsLeft = revision.new_deadline_at ? Math.round((new Date(revision.new_deadline_at) - Date.now()) / 3600000) : null;
  const pins = revVideo.changes.filter((c) => c.seconds != null && dur > 0 && c.seconds <= dur);

  const fb = fullBrief || {};
  const fullRows = [
    ['Product', fb.product_name], ['Product description', fb.product_description], ['Campaign hook', fb.campaign_hook], ['Key message', fb.key_message],
    ['Video language', fb.language], ['Objectives', Array.isArray(fb.objectives) ? fb.objectives.join(', ') : fb.objectives],
    ['Format', [fb.video_format, fb.duration_seconds ? `${fb.duration_seconds} sec` : null, fb.aspect_ratio].filter(Boolean).join(' · ')],
    ['Tone', Array.isArray(fb.tone_tags) ? fb.tone_tags.join(', ') : (fb.tone_reference || fb.tone_tags)],
    ['What not to do', Array.isArray(fb.what_not_to_do) ? fb.what_not_to_do.join('; ') : fb.what_not_to_do],
    ['Script', fb.script_text || (fb.script_provider === 'ugc' ? 'UGC.ad is preparing the script.' : '')],
    ['Revisions included', fb.revision_limit ?? fb.free_revisions],
  ].filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '');

  const showBar = inRevision && !cancelled && !damaged;
  const barRevisionDone = responded === 'accepted';

  return (
    <AppShell title={title} subtitle={brandName} back="/my-deals" tabs={false}>
      <input ref={evidenceRef} type="file" hidden multiple accept="image/*,video/*,.pdf" onChange={addEvidence} data-testid="evidence-input" />
      <div className={`${wrapCls}${showBar ? ' ap-or-pad' : ' ap-or-body--tight'}`}>
        {loadError && (
          <div className="ap-or-err" role="alert"><span>{loadError.message} Showing the last loaded order.</span><button type="button" onClick={() => fetchDeal()}>Retry</button></div>
        )}

        <BookingPanel deal={deal} onDone={() => fetchDeal()} />

        <section className="ap-or-c">
          <div className="ap-or-head">
            <span className="ap-or-tile" style={{ width: 56, height: 56, borderRadius: 15, background: logo ? '#fff' : bg, color: fg, fontSize: 22 }}>
              {logo ? <img src={assetUrl(logo)} alt={brandName} /> : initial(brandName)}
            </span>
            <div className="ap-or-grow">
              <div className="ap-or-by"><span className="ap-or-mini" style={{ background: fg }}>{initial(brandName)}</span><span className="n">{brandName}</span></div>
              <div className="ttl">{dealTitle(deal)}</div>
              <div className="sub">{inr(escrow.held_amount || escrowAmount(deal))}</div>
            </div>
            <span className={pillClass(inRevision ? 'warn' : status.tone)} title={getState(deal)}>
              {inRevision ? `Revision ${revision.revision_count_used || 1} of ${revision.revision_limit || 0}` : status.label}
            </span>
          </div>
          <div className="ap-or-prog" role="img" aria-label={`Progress: ${getState(deal)}`}>
            <div className="ap-or-prog-t"><strong>Step {progress.step} of {progress.total} · {progress.labels[progress.cur]}</strong>{due && !isPaid ? <span>{due.text}</span> : null}</div>
            <div className="ap-or-psegs" style={{ gridTemplateColumns: `repeat(${progress.labels.length},1fr)` }}>
              {progress.fill.map((f, i) => <i key={i} className={f === 1 ? 'on' : f === 0.5 ? 'half' : ''} />)}
            </div>
            <div className="ap-or-plbl" style={{ gridTemplateColumns: `repeat(${progress.labels.length},1fr)` }}>
              {progress.labels.map((l, i) => <span key={l} className={i === progress.cur && !progress.done ? 'cur' : ''}>{l}</span>)}
            </div>
          </div>
        </section>

        {hero && (
          <section className={`ap-or-hero${hero.grey ? ' ap-or-hero--grey' : ''}`}>
            {hero.tick && <span className="ap-or-tick"><Check size={26} strokeWidth={3} color="#fff" /></span>}
            <div className="ap-or-eye">{hero.eyebrow}</div>
            <h2>{hero.title}</h2>
            {hero.sub ? <p>{hero.sub}</p> : null}
            {hero.count != null && (
              <div className="ap-or-cd" aria-label="Time until auto-approve">
                <div><b>{Math.floor(hero.count / 24)}</b><small>days</small></div>
                <div><b>{Math.floor(hero.count % 24)}</b><small>hours</small></div>
                <div><b>{String(Math.floor((hero.count * 60) % 60)).padStart(2, '0')}</b><small>min</small></div>
              </div>
            )}
            {hero.action && (
              <button type="button" className="ap-or-btn ap-or-btn--light" disabled={hero.action.disabled} onClick={hero.action.onClick}>
                {hero.action.icon ? <hero.action.icon size={17} /> : null}{hero.action.label}
              </button>
            )}
            {hero.fine ? <div className="ap-or-fine">{hero.fine}</div> : null}
          </section>
        )}

        {inRevision && (
          <>
            {(revVideo.canOpen || quote) && (
              <section className="ap-or-c">
                <div className="ap-or-rev">
                  {revVideo.canOpen && (
                    <div className="ap-or-poster" style={{ width: 96, height: 150 }}>
                      {lastVersion?.thumbnail_url
                        ? <img src={assetUrl(lastVersion.thumbnail_url)} alt="" />
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        : <video src={`${revVideo.url}#t=0.5`} muted playsInline preload="metadata" onLoadedMetadata={(e) => setDur(e.currentTarget.duration || 0)} />}
                      <button type="button" aria-label={revVideo.hasTimestamps ? 'See changes on video' : 'View submitted video'} onClick={() => setSheet('video')}><Play size={15} /></button>
                      <span className="wm" aria-hidden="true">UGCAD PREVIEW</span>
                    </div>
                  )}
                  <div className="col">
                    {quote ? <div className="ap-or-bub">“{quote}”<small>{brandName}</small></div> : <div className="ap-or-bub">{brandName} asked for changes to version {lastVersion?.version || 1}.</div>}
                    {revVideo.canOpen && (
                      <div>
                        {pins.length > 0 && <div className="ap-or-tl">{pins.map((c) => <i key={c.id} style={{ left: `${(c.seconds / dur) * 100}%` }}>{c.id + 1}</i>)}</div>}
                        <button type="button" className="ap-or-link" style={{ marginTop: pins.length ? 4 : 0 }} onClick={() => setSheet('video')}>{revVideo.hasTimestamps ? 'See changes on video' : 'View submitted video'}</button>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            <section className="ap-or-c">
              <div className="ap-or-c-h"><b>{changeItems.length ? `${changeItems.length} change${changeItems.length > 1 ? 's' : ''} asked` : 'Changes asked'}</b><small>Revision {revision.revision_count_used || 0} of {revision.revision_limit || 0} used</small></div>
              <div style={{ marginTop: 4 }}>
                {changeItems.length ? changeItems.map((item, idx) => {
                  const c = parseChange(item);
                  const isDone = responded && acceptedAlready.some((a) => String(a).toLowerCase() === item.toLowerCase());
                  return (
                    <div key={`${item}-${idx}`} className="ap-or-chg">
                      <span className="n">{idx + 1}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="t">{c.timestamp ? `At ${c.timestamp}` : 'Change'}</div>
                        <div className="x">
                          {c.severity && <span className={`ap-or-sev${c.severity === 'must-fix' ? ' must' : ''}`}>{c.severity === 'must-fix' ? 'Must-fix' : 'Preference'}</span>}
                          {c.text}
                        </div>
                      </div>
                      <span className={`b${isDone ? ' on' : ''}`}>{isDone ? <Check size={13} /> : null}</span>
                    </div>
                  );
                }) : <p className="ap-or-note">No requested changes yet.</p>}
              </div>
              {responded && <p className="ap-or-ok"><Check size={16} /><span>{REVISION_RESPONSE_LABEL[responded] || `Response recorded: ${responded}`}</span></p>}
            </section>

            <div className="ap-or-due">
              <Clock size={22} />
              <span>
                <b>{revision.new_deadline_at ? (hrsLeft != null && hrsLeft >= 0 ? `Send it in ${hrsLeft} hrs` : `Send the new version by ${formatDateTime(revision.new_deadline_at)}`) : 'Send the new version when ready'}</b>
                {revision.new_deadline_at ? ` · need longer?` : ' · the brand has not set a new deadline'}
              </span>
              <button type="button" onClick={() => askBrand(MORE_TIME_MSG)}>Ask</button>
            </div>

            {!responded && (
              <p className="ap-or-center">
                Change not in the brief?{' '}
                <button type="button" className="ap-or-link" disabled={revBusy} onClick={() => respondRevision('scope_creep', [])}>Tell the brand these go beyond the brief</button>
                {' '}- you can then ask UGCad to check, and your payment stays held.
              </p>
            )}
          </>
        )}

        {isPaid && reviewFor && (
          <section className="ap-or-c">
            <div className="ap-or-c-h"><b>How was working with {brandName}?</b></div>
            <div className="ap-or-stars" role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} className={n <= rating ? 'on' : ''} onClick={() => setRating(n)}>★</button>
              ))}
            </div>
            <textarea className="ap-input" rows={3} maxLength={1000} value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="Anything other creators should know? (optional)" style={{ marginTop: 8 }} />
            <button type="button" className="ap-or-btn ap-or-btn--block" style={{ marginTop: 12 }} disabled={!rating || reviewBusy} onClick={submitReview}>{reviewBusy ? 'Sending…' : 'Send rating'}</button>
          </section>
        )}

        {versions.length > 0 && !inRevision && (
          <section className="ap-or-c">
            <div className="ap-or-c-h"><b>What you sent</b><small>{versions.length} version{versions.length > 1 ? 's' : ''}</small></div>
            <div className="ap-or-vers">
              {versions.map((v) => {
                const m = versionStatusMeta(v.status);
                const wm = deal?.content_submission?.watermark_required_until_approval && v.status !== 'approved';
                return (
                  <article key={`${v.stage || ''}${v.version}`} className="ap-or-ver">
                    <div className="ap-or-poster" style={{ width: 70, height: 104 }}>
                      {v.thumbnail_url ? <img src={assetUrl(v.thumbnail_url)} alt={`v${v.version} thumbnail`} />
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        : v.video_url ? <video src={`${assetUrl(v.video_url)}#t=0.5`} muted playsInline preload="metadata" /> : <Play size={22} />}
                      {v.video_url && <a href={assetUrl(v.video_url)} target="_blank" rel="noreferrer" aria-label={`Open v${v.version} preview`}><Play size={14} /></a>}
                      {wm && (v.thumbnail_url || v.video_url) && <span className="wm" aria-hidden="true">UGCAD PREVIEW</span>}
                    </div>
                    <div className="ap-or-vmeta">
                      <strong>{v.stage === 'raw' ? 'Raw ' : v.stage === 'edited' ? 'Edited ' : ''}v{v.version}</strong>
                      <small>{formatDateTime(v.submitted_at)}</small>
                      <span className={pillClass(m.tone)}>{m.label}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        {damaged && <DamageCard deal={deal} onEvidence={() => evidenceRef.current?.click()} onSupport={() => escalate('Message Support')} busy={evidenceBusy} />}

        {ships && (
          <section className="ap-or-c">
            <div className="ap-or-c-h">
              <b>Product</b>
              {received ? <span className="ap-pill ap-pill--ok">✓ Received {shortDate(receipt.received_at)}</span>
                : damaged ? <span className="ap-pill ap-pill--bad">Issue reported</span>
                : <span className="ap-pill ap-pill--muted">{shipment.courier_status ? String(shipment.courier_status).replace(/_/g, ' ') : 'Not shipped yet'}</span>}
            </div>
            {!received && !damaged && !isPaid && !cancelled && (
              <div className="ap-or-prod">
                <span className="ico"><Package size={20} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="t">{shipment.creator_address_confirmed ? 'Delivery address confirmed' : 'Delivery address needed'}</div>
                  <div className="s">{shipment.creator_address_confirmed ? 'The team ships it once the brand is ready.' : 'The brand ships as soon as you confirm.'}</div>
                </div>
                <button type="button" className={`ap-or-btn ap-or-btn--sm${shipment.creator_address_confirmed ? ' ap-or-btn--soft' : ''}`} style={{ height: 40, padding: '0 14px' }} onClick={() => setSheet('address')}>{shipment.creator_address_confirmed ? 'View' : 'Confirm'}</button>
              </div>
            )}
            {(shipment.tracking_id || shipment.courier_status || shipment.expected_delivery_at || receipt.received_at) ? (
              <div className="ap-or-kv">
                <div><span>Courier</span><span>{shipment.courier_partner || shipment.courier_name || 'Not assigned'}</span></div>
                <div><span>Tracking ID</span><span>{shipment.courier_tracking_url ? <a href={shipment.courier_tracking_url} target="_blank" rel="noreferrer" style={{ color: 'var(--ap-link)' }}>{shipment.tracking_id || 'Tracking link'} ↗</a> : (shipment.tracking_id || 'Pending')}</span></div>
                <div><span>Status</span><span>{shipment.courier_status ? String(shipment.courier_status).replace(/_/g, ' ') : 'Pending'}</span></div>
                <div><span>Expected delivery</span><span>{shipment.expected_delivery_at ? formatDate(shipment.expected_delivery_at) : received ? 'Delivered' : 'Awaiting courier update'}</span></div>
              </div>
            ) : null}
            <div className="ap-or-stack">
              {damaged ? (
                <>
                  <div className="ap-or-sheet-note ap-or-sheet-note--warn" style={{ margin: 0 }}>A product issue has been reported. Shipping and content work is paused until admin resolution.</div>
                  <button type="button" className="ap-or-btn ap-or-btn--soft" disabled={evidenceBusy} onClick={() => evidenceRef.current?.click()}>Add evidence</button>
                </>
              ) : received ? (
                <div className="ap-or-ok" style={{ margin: 0 }}><CheckCircle size={18} /><span>Product received on {formatDate(receipt.received_at)}. Receipt confirmed.{receipt.unboxing_video_url && <> <a href={assetUrl(receipt.unboxing_video_url)} target="_blank" rel="noreferrer" style={{ color: 'var(--ap-link)', fontWeight: 600 }}>View unboxing video</a></>}</span></div>
              ) : (shipment.tracking_id || shipment.courier_status || shipment.expected_delivery_at) ? (
                <>
                  <button type="button" className="ap-or-btn" disabled={!deal.can_mark_received} onClick={() => setSheet('receipt-ok')}>Mark received</button>
                  {!deal.can_mark_received && <p className="ap-or-note" style={{ margin: 0 }}>{['shipped', 'in_transit', 'delivered'].includes(shipment.courier_status) ? 'Waiting for the brand to confirm delivery. This updates automatically.' : 'Waiting for the brand to mark the package shipped.'}</p>}
                </>
              ) : <p className="ap-or-note" style={{ margin: 0 }}>Tracking appears here once the brand ships your product.</p>}
              {deal?.can_report_damage && !damaged && !received && (
                <button type="button" className="ap-or-link" style={{ alignSelf: 'flex-start' }} onClick={() => setSheet('receipt-bad')}>Report a problem with the product</button>
              )}
            </div>
          </section>
        )}

        <section className="ap-or-c">
          <div className="ap-or-c-h">
            <b>Chat with {brandName}</b>
            {unread > 0 ? <span className="ap-or-new">{unread} new</span> : (brandId ? <button type="button" className="ap-link" onClick={openChat}>Open chat</button> : null)}
          </div>
          <div className="ap-or-msgs" id="ap-or-msgs">
            {messages.length ? messages.slice(-12).map((m) => {
              if (m.sender_type === 'system') return <div key={m.id} className="ap-or-m sys"><div className="bub">{m.message}</div></div>;
              const mine = m.sender_type === 'creator';
              return (
                <div key={m.id} className={`ap-or-m ${mine ? 'me' : 'them'}`}>
                  <div className="bub">{m.message}</div>
                  <small>{mine ? 'You' : m.sender_name}{m.created_at ? ` · ${shortDate(m.created_at)}` : ''}</small>
                </div>
              );
            }) : <p className="ap-or-note" style={{ margin: 0 }}>No messages yet. Say hello to {brandName}.</p>}
          </div>
          <div className="ap-or-comp">
            <input ref={composerRef} value={message} onChange={(e) => setMessage(e.target.value)} onFocus={markSeen} placeholder="Write a message…" aria-label="Write a message" onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }} />
            <button type="button" aria-label="Send message" disabled={sending || !message.trim()} onClick={sendMessage}><Send size={17} /></button>
          </div>
        </section>

        <section className="ap-or-c ap-or-brief">
          <div className="ap-or-c-h"><b>Brief</b></div>
          {(deal?.brief_sections || []).length ? deal.brief_sections.map((s) => <div key={s.title}><h3>{s.title}</h3><BriefContent content={s.content} /></div>) : <p className="ap-or-note">Brief details not available.</p>}
          {briefOpen && (briefLoading ? <p className="ap-or-note">Loading full brief…</p> : fullRows.length ? fullRows.map(([k, v]) => <div key={k}><h3>{k}</h3><p>{String(v)}</p></div>) : <p className="ap-or-note">No additional brief details available.</p>)}
          {deal?.campaign?.id && <button type="button" className="ap-or-link" onClick={toggleBrief}>{briefOpen ? 'Show less ↑' : 'View full brief ↓'}</button>}
        </section>

        <section className="ap-or-c">
          <div className="ap-or-c-h"><b>Payment</b></div>
          <div className="ap-or-kv">
            <div><span>Order price</span><span>{inr(escrow.held_amount || escrowAmount(deal))}</span></div>
            {deductions.map((x) => <div key={x.label}><span>{x.label}</span><span>-{inr(x.amount)}</span></div>)}
            <div><span>Status</span><span>{escrow.status === 'released' ? 'Released' : escrow.status === 'on_hold' ? 'On hold' : 'Held safely'}</span></div>
            <div className="tot"><span>{isPaid ? 'You got' : 'You get'}</span><span>{inr(net)}</span></div>
          </div>
          <div className="ap-or-note">{payNote}</div>
          {isPaid && <button type="button" className="ap-or-btn ap-or-btn--ghost ap-or-btn--block" style={{ marginTop: 12 }} onClick={archive}><Archive size={16} /> Archive order</button>}
        </section>

        <section className="ap-or-c">
          <div className="ap-or-c-h"><b>Activity</b></div>
          <div className="ap-or-acts">
            {activity.length ? visibleActivity.map((ev, i) => (
              <div key={ev.id || i} className="ap-or-act">
                <CheckCircle size={16} />
                <span><strong>{ev.actor_name || ev.actor_type}</strong> · {ev.message}</span>
                <em>{formatDateTime(ev.timestamp)}</em>
              </div>
            )) : <p className="ap-or-note" style={{ margin: 0 }}>No activity yet.</p>}
          </div>
          {activity.length > visibleActivity.length && <button type="button" className="ap-or-link" onClick={() => setShowAllActivity(true)}>Show {activity.length - visibleActivity.length} more</button>}
        </section>

        <div style={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: '0 18px' }}>
          {!cancelled && !isPaid && !inReview && !inRevision && deal?.active_party === 'creator' && (
            <button type="button" className="ap-or-link" onClick={() => askBrand(MORE_TIME_MSG)}>Ask for more time</button>
          )}
          {!cancelled && <button type="button" className="ap-or-link" onClick={() => setSheet('problem')}>Raise a problem</button>}
          <a className="ap-or-link" href="mailto:support@ugcad.io" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>Contact UGCad</a>
        </div>
      </div>

      {showBar && (
        <div className="ap-or-bar">
          {!responded && <button type="button" className="ap-or-btn ap-or-btn--ghost ap-or-btn--lg" onClick={() => askBrand(REVISION_Q_MSG)}>Ask a question</button>}
          {!responded && <button type="button" className="ap-or-btn ap-or-btn--lg" disabled={revBusy || !(revision.latest_feedback || revision.requested_changes?.length)} onClick={() => respondRevision('accepted', changeItems.length ? changeItems : null)}>{revBusy ? 'Saving…' : 'Accept & revise'}</button>}
          {barRevisionDone && <button type="button" className="ap-or-btn ap-or-btn--lg" disabled={!deal.can_submit_content} onClick={() => setSheet('deliver')}><Upload size={17} />Upload new version</button>}
          {responded && !barRevisionDone && (
            <>
              <button type="button" className="ap-or-btn ap-or-btn--soft ap-or-btn--lg" onClick={() => askBrand(REVISION_Q_MSG)}>Chat with brand</button>
              <button type="button" className="ap-or-btn ap-or-btn--danger ap-or-btn--lg" onClick={() => setSheet('problem')}>Ask UGCad</button>
            </>
          )}
        </div>
      )}

      <DeliverSheet
        open={sheet === 'deliver'}
        onClose={() => setSheet(null)}
        deal={deal}
        brandName={brandName}
        uploads={uploads}
        names={names}
        uploading={uploading}
        onPick={pickFile}
        onClear={clearFile}
        onSubmit={submitContent}
        submitting={submitting}
        revision={inRevision}
        net={net}
      />
      <ReceiptSheet
        open={sheet === 'receipt-ok' || sheet === 'receipt-bad'}
        initial={sheet === 'receipt-bad' ? 'bad' : 'ok'}
        onClose={() => setSheet(null)}
        deal={deal}
        brandName={brandName}
        videoUrl={mergedUploads.unboxingVideoUrl}
        videoName={names.unboxingVideoUrl}
        uploadPct={uploading?.key === 'unboxingVideoUrl' ? uploading.percent : null}
        onPick={(f) => pickFile('unboxingVideoUrl', f)}
        onClear={() => clearFile('unboxingVideoUrl')}
        onConfirm={submitReceipt}
        onReport={reportDamage}
        busy={receiptBusy}
      />
      <AddressSheet open={sheet === 'address'} onClose={() => setSheet(null)} campaignId={deal.campaign?.id || deal.campaign_id || deal.deal_id} onSaved={() => fetchDeal()} />
      <ChangesVideoSheet open={sheet === 'video'} onClose={() => setSheet(null)} info={revVideo} />
      <ProblemSheet
        open={sheet === 'problem'}
        onClose={() => setSheet(null)}
        deal={deal}
        brandName={brandName}
        canEscalate={canEscalate}
        onSubmit={escalate}
        onChat={() => { setSheet(null); openChat(); }}
        busy={problemBusy}
      />
    </AppShell>
  );
}

function DamageCard({ deal, onEvidence, onSupport, busy }) {
  const receipt = deal?.receipt || {};
  const cards = (deal?.action_cards || []).filter((c) => c.type === 'damage_report');
  const card = cards[cards.length - 1];
  const event = (deal?.activity_feed || []).find((e) => e.event_type === 'dispute_raised' || e.event_type === 'damage_report');
  const evidence = [...cards.flatMap((c) => c.attachment_urls || []), receipt.unboxing_video_url].filter(Boolean);
  const statusText = card?.status === 'resolved' ? 'Resolved' : 'Under admin review';
  const rows = [
    ['Submitted on', formatDateTime(card?.created_at || event?.timestamp || receipt.received_at)],
    ['Reason', card?.title || 'Damaged / Wrong Product Reported'],
    ['Description', card?.message || receipt.damage_report || 'Damage report submitted by creator.'],
    ['Evidence', evidence.length ? `${evidence.length} file${evidence.length > 1 ? 's' : ''}` : 'None yet'],
    ['Your timeline', 'Paused'],
    ['Payment', 'Held until resolution'],
  ];
  return (
    <section className="ap-or-c">
      <div className="ap-or-c-h"><b><FileWarning size={16} style={{ verticalAlign: -3 }} /> Damage report</b><span className="ap-pill ap-pill--bad">{statusText}</span></div>
      <div className="ap-or-kv">{rows.map(([k, v]) => <div key={k}><span>{k}</span><span>{v}</span></div>)}</div>
      <div className="ap-or-stack">
        <button type="button" className="ap-or-btn ap-or-btn--soft" disabled={busy} onClick={onEvidence}>Add evidence</button>
        <button type="button" className="ap-or-btn ap-or-btn--ghost" onClick={onSupport}>Message support</button>
      </div>
      {evidence.map((u, i) => <a key={`${u}-${i}`} className="ap-or-act" href={assetUrl(u)} target="_blank" rel="noreferrer"><Play size={16} /><span>Evidence {i + 1}</span></a>)}
    </section>
  );
}
