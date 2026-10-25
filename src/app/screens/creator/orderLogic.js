// Pure order/deal helpers shared by the phone Orders list and Order room.
// Ported 1:1 from src/pages/MyDealsPage.js + MyDealsHubPage.js so both layers follow the same rules.
import { orderStatus, isPaidDeal, isInReview } from '../../../utils/orderUi';

export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
export const API = `${BACKEND_URL}/api`;

export const assetUrl = (u) => (!u ? '' : (String(u).startsWith('http') ? u : `${BACKEND_URL}${u}`));
export const initial = (name) => (name || 'B').trim().charAt(0).toUpperCase();
const isObjectId = (s) => /^[0-9a-f]{24}$/i.test(String(s || ''));

export const normalizeDash = (v) => String(v || '').replace(/\s*(?:—|–|-)\s*/g, ' - ');
export const stateKey = (v) => normalizeDash(v).toLowerCase();
export const getState = (deal) => normalizeDash(deal?.current_state || deal?.campaign_status || deal?.campaign?.status || 'Status unavailable');
export const isState = (dealOrState, state) => stateKey(typeof dealOrState === 'string' ? dealOrState : getState(dealOrState)) === stateKey(state);
export const isDamageState = (d) => isState(d, 'Damaged/Wrong Product Reported');
export const isCancelledDeal = (deal) => {
  const status = stateKey(deal?.status || deal?.campaign_status || deal?.campaign?.status || '');
  return status === 'cancelled' || isState(deal, 'Cancelled');
};

// ---- names, ids, money ------------------------------------------------------
// Real business name, never an @handle or a raw ObjectId.
export function dealBrand(d) {
  const raw = String(
    d?.brand?.name || d?.campaign?.brand_name || d?.campaign?.business_name
    || d?.brand?.handle || d?.campaign?.brand_handle || d?.campaign?.business_nickname || ''
  ).replace(/^@+/, '').trim();
  return raw && !isObjectId(raw) ? raw : 'Brand';
}
export const dealLogo = (d) => d?.brand?.logo_url || d?.campaign?.brand_logo_url || '';
export const dealTitle = (d) => d?.campaign?.title || 'Untitled campaign';
export const dealKey = (d) => d?.deal_id || d?.campaign?.id;
export const dealAmount = (d) => Number(d?.escrow?.held_amount ?? d?.campaign?.budget_max ?? d?.campaign?.budget_min ?? d?.my_bid?.amount ?? 0);
export const escrowAmount = (d) => Number(d?.escrow?.held_amount ?? d?.escrow?.amount ?? d?.my_bid?.amount ?? 0);

// ---- list grouping (hub tabs) -----------------------------------------------
export const bookingStatus = (d) => d?.campaign?.booking_status;
export const isRequested = (d) => ['pending_creator', 'price_revision'].includes(bookingStatus(d)) && !d?.campaign?.brief_sent;
export const isDead = (d) => bookingStatus(d) === 'declined' || String(d?.current_state || '').toLowerCase().includes('cancelled');

export function groupDeals(deals) {
  const requested = deals.filter(isRequested);
  const live = deals.filter((d) => !isRequested(d) && !isDead(d));
  const cancelled = deals.filter((d) => !isRequested(d) && isDead(d));
  const completed = live.filter(isPaidDeal);
  const delivered = live.filter((d) => !isPaidDeal(d) && isInReview(d));
  const active = live.filter((d) => !isPaidDeal(d) && !isInReview(d));
  return { requested, cancelled, completed, delivered, active };
}

// The one button on each order card: what the creator does next.
export function rowAction(d) {
  const s = stateKey(d?.current_state);
  if (s.includes('revision')) return { label: 'See changes', soft: true, deliver: true };
  if (s.includes('content in progress') || s.includes('edited video due')) return { label: 'Deliver', deliver: true };
  if (s.includes('delivered')) return { label: 'Mark received' };
  if (s.includes('shipped')) return { label: 'Track', soft: true };
  return { label: 'View', soft: true };
}

export const hasShipping = (deal) => Boolean(deal?.shipment?.required || deal?.campaign?.requires_shipment || deal?.requires_shipment);

// Six-step progress (Won / Product / Film / Deliver / Review / Paid). `fill`: 1 done, 0.5 current, 0 todo.
export function roomProgress(deal, ships = hasShipping(deal)) {
  const labels = ships ? ['Won', 'Product', 'Film', 'Deliver', 'Review', 'Paid'] : ['Won', 'Film', 'Deliver', 'Review', 'Paid'];
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
  else if (s.includes('delivered') || s.includes('shipped') || s.includes('transit') || (ships && s.includes('accepted'))) cur = at('Product');
  const fill = labels.map((_, i) => (done || i < cur ? 1 : i === cur ? 0.5 : 0));
  return { labels, fill, cur: done ? labels.length - 1 : cur, done, step: (done ? labels.length : cur + 1), total: labels.length };
}

export function hoursText(h) {
  if (typeof h !== 'number' || h < 0) return null;
  const d = Math.floor(h / 24);
  const hh = Math.floor(h % 24);
  return d ? `${d}d ${hh}h` : `${hh}h`;
}

// ---- delivery ---------------------------------------------------------------
// 'raw' | 'edited' (raw -> edited flow) | null
export function uploadStage(deal) {
  const stage = deal?.edit_flow?.stage;
  return stage === 'raw' || stage === 'edited' ? stage : null;
}
export const getRequiredAssets = (deal) => deal?.content_submission?.required_assets || {};

export function missingAssets(deal, uploads) {
  const required = getRequiredAssets(deal);
  const stage = uploadStage(deal);
  const missing = [];
  if (!uploads.finalVideoUrl) missing.push(stage === 'raw' || required.raw_only ? 'raw video' : stage === 'edited' ? 'edited video' : 'final video');
  if (required.caption_script && !uploads.captionUrl) missing.push('caption/script');
  if (required.thumbnail && !uploads.thumbnailUrl) missing.push('thumbnail');
  if (required.raw_footage && !uploads.rawFootageUrl && !stage) missing.push('raw footage');
  return missing;
}

export function canSubmitUploadedAssets(deal, uploads) {
  const required = getRequiredAssets(deal);
  if (!uploads.finalVideoUrl) return false;
  if (required.caption_script && !uploads.captionUrl) return false;
  if (required.thumbnail && !uploads.thumbnailUrl) return false;
  if (required.raw_footage && !uploads.rawFootageUrl && !uploadStage(deal)) return false;
  return Boolean(deal?.can_submit_content);
}

export function getPrimaryActionConfig(deal, uploads, submitting) {
  if (!deal) return { label: 'No deal selected', disabled: true, type: 'none' };
  if (isCancelledDeal(deal)) return { label: 'Deal Cancelled', disabled: true, type: 'passive' };
  if (isDamageState(deal)) return { label: 'Add Evidence', disabled: false, type: 'add_evidence' };
  if (isState(deal, 'Paid - Complete')) return { label: 'Archive Deal', disabled: false, type: 'archive' };
  if (isState(deal, 'Delivered - Awaiting Receipt Confirmation')) {
    return { label: 'Mark Received', disabled: !deal.can_mark_received || !uploads.unboxingVideoUrl, type: 'receipt' };
  }
  if (isState(deal, 'Received - Content in Progress') || isState(deal, 'Revision Requested') || isState(deal, 'Raw Approved - Edited Video Due')) {
    const stage = uploadStage(deal);
    return {
      label: submitting ? 'Submitting...' : isState(deal, 'Revision Requested') ? 'Submit Revision' : stage === 'raw' || getRequiredAssets(deal).raw_only ? 'Submit Raw Video' : stage === 'edited' ? 'Submit Edited Video' : 'Submit Content',
      disabled: submitting || !canSubmitUploadedAssets(deal, uploads),
      type: 'content',
    };
  }
  if (isState(deal, 'Accepted - Awaiting Shipment')) {
    const needsShipping = deal?.shipment?.required || deal?.campaign?.requires_shipment;
    if (needsShipping) {
      if (deal?.shipment?.creator_address_confirmed) return { label: 'Delivery Address Submitted', disabled: true, type: 'ship_address_done' };
      return { label: 'Confirm Delivery Address', disabled: false, type: 'ship_address' };
    }
  }
  if (stateKey(deal.primary_next_action || '').includes('track')) {
    return { label: deal.primary_next_action || 'Track shipment', disabled: !deal?.shipment?.courier_tracking_url, type: 'track_shipment' };
  }
  return { label: deal.primary_next_action || 'Waiting', disabled: true, type: 'passive' };
}

// ---- revisions --------------------------------------------------------------
// De-duplicated checklist of the brand's requested changes (split on lines / sentences, bullets stripped).
export function toChangeItems(revision) {
  const raw = revision?.requested_changes?.length
    ? revision.requested_changes
    : (revision?.latest_feedback ? [revision.latest_feedback] : []);
  const seen = new Set();
  const items = [];
  raw.forEach((entry) => {
    String(entry || '')
      .split(/\r?\n|(?<=\.)\s+(?=[A-Z0-9])/)
      .map((line) => line.replace(/^\s*[-•*\d.)\]]+\s*/, '').trim())
      .filter(Boolean)
      .forEach((line) => {
        const key = line.replace(/^\s*\[[^\]]*\]\s*/, '').toLowerCase();
        if (!seen.has(key)) { seen.add(key); items.push(line); }
      });
  });
  return items;
}

// "[must-fix @ 0:04] Re-shoot the intro" -> severity + pinned moment + text.
const CHANGE_TAG_RE = /^\s*\[([^\]@]+?)(?:\s*@\s*(\d+:\d{2}))?\]\s*/;
export function parseChange(line) {
  const m = String(line).match(CHANGE_TAG_RE);
  if (!m) return { text: String(line), severity: '', timestamp: null };
  return { text: String(line).slice(m[0].length), severity: (m[1] || '').trim().toLowerCase(), timestamp: m[2] || null };
}
export function tsToSeconds(ts) {
  if (!ts) return null;
  const [m, s] = String(ts).split(':').map(Number);
  if (Number.isNaN(m) || Number.isNaN(s)) return null;
  return m * 60 + s;
}
// The video the brand reviewed (the creator's latest submitted version) plus the brand's notes pinned to it.
export function revisionVideoInfo(deal) {
  const versions = deal?.content_submission?.versions || [];
  const raw = [...versions].reverse().find((v) => v.video_url)?.video_url || deal?.content_submission?.video_url || '';
  const url = raw ? assetUrl(raw) : '';
  const changes = toChangeItems(deal?.revision_tracker || {}).map((line, i) => {
    const c = parseChange(line);
    return { id: i, text: c.text.trim(), severity: c.severity, timestamp: c.timestamp, seconds: tsToSeconds(c.timestamp) };
  });
  return { url, changes, hasTimestamps: changes.some((c) => c.seconds != null), canOpen: Boolean(url) };
}

const VERSION_STATUS_LABELS = { submitted: 'Submitted', approved: 'Approved', revision_requested: 'Revision requested', superseded: 'Superseded' };
export function versionStatusMeta(status) {
  const raw = (status || '').toLowerCase();
  const label = VERSION_STATUS_LABELS[raw] || (status || 'Pending').replace(/_/g, ' ');
  if (raw === 'superseded') return { label, tone: 'muted' };
  let tone = 'warn';
  if (raw.includes('approv')) tone = 'ok';
  else if (raw.includes('reject') || raw.includes('revision') || raw.includes('declin')) tone = 'bad';
  return { label, tone };
}

// ---- dates -------------------------------------------------------------------
export const formatDateTime = (v) => (!v ? 'Not scheduled' : new Date(v).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }));
export const formatDate = (v) => (!v ? 'Not available' : new Date(v).toLocaleDateString('en-IN'));

// pill tone (orderUi: ok | muted | bad | warn | info) -> shared ap-pill modifier
export const pillClass = (tone) => `ap-pill${tone && tone !== 'info' ? ` ap-pill--${tone}` : ''}`;

export { orderStatus };

// Chat messages grouped the way the website room shows them is done by utils/dealMessages (getDealMessages).

export const offlineText = "You're offline. Check your connection and try again.";
export const loadErrorText = (err, fallback) => (err?.response ? fallback : offlineText);
