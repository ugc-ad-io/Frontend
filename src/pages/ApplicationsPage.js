import { useLiveEffect } from '../lib/liveUpdates';
import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { CheckCircle, Search, Users, Briefcase, FileText, Clock, Eye, PlayCircle, X, ShieldCheck, Globe, AlertTriangle, MessageSquarePlus, XCircle, Link2, Phone, SlidersHorizontal, ArrowLeft, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../App';
import useIsPhone from '../lib/useIsPhone';
import '../styles/ApplicationsPage.css';
import '../styles/admin-mobile-applications.css';

// Map a social-handle key/platform to its real brand logo (simpleicons slug + brand
// colour). Falls back to a globe for unknown / custom links.
const SOCIAL_LOGOS = [
  [/instagram|insta|ig\b/i, 'instagram', 'E4405F'],
  [/youtube|yt\b/i, 'youtube', 'FF0000'],
  [/tiktok|tik\s?tok/i, 'tiktok', '000000'],
  [/twitter|x\.com|^x$|\bx\b/i, 'x', '000000'],
  [/facebook|fb\b/i, 'facebook', '1877F2'],
  [/linkedin/i, 'linkedin', '0A66C2'],
];
const SocialLogo = ({ platform }) => {
  const hit = SOCIAL_LOGOS.find(([re]) => re.test(String(platform || '')));
  if (!hit) return <Globe size={14} className="apps-social-ic" />;
  return <img src={`https://cdn.simpleicons.org/${hit[1]}/${hit[2]}`} alt="" width={14} height={14} className="apps-social-ic" />;
};

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const isCreatorRole = (role) => String(role || '').toLowerCase() === 'creator';
const isBrandRole = (role) => ['business', 'brand'].includes(String(role || '').toLowerCase());

const avatarColor = (name) => {
  const palette = ['#6366f1', '#3b82f6', '#0ea5e9', '#14b8a6', '#10b981', '#f59e0b', '#ef4444', '#23236a', '#ec4899'];
  let hash = 0;
  for (let i = 0; i < (name || '').length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
};

const resolveUrl = (u) => {
  if (!u || typeof u !== 'string') return '';
  const s = u.trim();
  return /^https?:\/\//i.test(s) ? s : `${BACKEND_URL}${s.startsWith('/') ? '' : '/'}${s}`;
};

// The backend gates deliverable videos under /uploads and reads the JWT from an
// Authorization header OR a ?token= query param. <video>/<img> tags can't send
// headers, so sign backend URLs with the token — without this a gated clip 403s
// and renders as an empty 0:00 player.
const signedUrl = (u) => {
  const base = resolveUrl(u);
  if (!base || !base.startsWith(BACKEND_URL)) return base;
  const token = localStorage.getItem('token');
  if (!token) return base;
  return `${base}${base.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
};

const VIDEO_EXT = /\.(mp4|mov|webm|m4v|avi|mkv)(\?|#|$)/i;
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|svg|avif)(\?|#|$)/i;
const KEY_IS_VIDEO = /video|reel|intro/i;
const KEY_IS_IMAGE = /photo|picture|avatar|image|logo|banner|thumb/i;
const KEY_IS_KYC = /pan|aadhaar|aadhar|selfie|kyc|id_proof|id_card|govt|passport|document|verification/i;
const KEY_IS_SOCIAL = /social|links|instagram|youtube|tiktok|facebook|twitter|linkedin|handle/i;
const KEY_IS_MEDIA = /photo|picture|avatar|image|logo|banner|thumb|video|reel|intro|portfolio/i;

const collectUrls = (v) => {
  const out = [];
  const push = (x) => { if (typeof x === 'string' && x.trim()) out.push(x.trim()); };
  // A portfolio item can be a rich object ({ videoUrl, urls:[...], original_url }).
  // The old extractor only checked url/file_url/src/video/video_url, so a creator's
  // clips (stored as { videoUrl, urls }) yielded nothing and never played.
  const fromObj = (o) => {
    if (Array.isArray(o.urls)) o.urls.forEach(push);
    push(o.url || o.file_url || o.src || o.video || o.video_url || o.videoUrl
      || o.original_url || o.image || o.image_url || o.link);
  };
  if (typeof v === 'string') push(v);
  else if (Array.isArray(v)) v.forEach((item) => {
    if (typeof item === 'string') push(item);
    else if (item && typeof item === 'object') fromObj(item);
  });
  else if (v && typeof v === 'object') fromObj(v);
  return out;
};

// The mobile number reaches us from two places: signup (top-level `phone_full`,
// or `dial_code` + `phone`) and the profile-setup form (`profile.phone` +
// `profile.dialCode`). Signup wins — it's the number ops verified the account with.
const phoneOf = (u) => {
  const pr = (u && u.profile) || {};
  const full = String(u?.phone_full || '').trim();
  if (full) return full;
  const own = String(u?.phone || '').trim();
  const num = own || String(pr.phone || pr.mobile || '').trim();
  if (!num) return '';
  const dial = String((own ? u?.dial_code : (pr.dialCode || pr.dial_code)) || '').trim();
  return dial ? `${dial} ${num}` : num;
};

// A few keys read better with an explicit label than the auto-prettified key.
const KEY_LABELS = { updated_at: 'Submitted At' };
const prettifyKey = (k) => KEY_LABELS[k] || String(k).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/\b\w/g, (c) => c.toUpperCase());

// Preferred display order for "All Submitted Details". First match (by label
// substring) wins; anything unmatched sorts to the end but keeps its original
// relative order. Ordered: identity → contact → persona → commercials.
const FIELD_ORDER = [
  'full name', 'first name', 'last name', 'nickname', 'name',
  'gender', 'date of birth', 'dob', 'age',
  'bio', 'about', 'headline',
  'country', 'city', 'state', 'address', 'pincode', 'pin code', 'dial code', 'phone', 'contact',
  'content style', 'content categor', 'primary categor', 'categor', 'tags', 'niche', 'language',
  'rate card', 'expected payout', 'payout period', 'delivery days',
  'availability', 'flexible', 'receive brief',
];
const fieldRank = (k) => {
  const lbl = prettifyKey(k).toLowerCase();
  const i = FIELD_ORDER.findIndex((kw) => lbl.includes(kw));
  return i === -1 ? FIELD_ORDER.length : i;
};
// Empty = null/undefined/blank, an empty (or all-empty) array, or an object whose
// every value is itself empty — so e.g. Followers: {instagram:'', youtube:''}
// counts as empty and doesn't render a blank full-width box.
const isEmptyVal = (v) => {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.every(isEmptyVal);
  if (typeof v === 'object') return Object.values(v).every(isEmptyVal);
  return false;
};
const isUrl = (v) => typeof v === 'string' && /^https?:\/\//i.test(v.trim());

function DetailValue({ value }) {
  if (typeof value === 'boolean') return <span>{value ? 'Yes' : 'No'}</span>;
  if (isUrl(value)) return <a href={value.trim()} target="_blank" rel="noopener noreferrer">{value}</a>;
  if (Array.isArray(value)) {
    const allPrimitive = value.every((v) => v === null || typeof v !== 'object');
    if (allPrimitive) return <span>{value.filter((v) => !isEmptyVal(v)).join(', ')}</span>;
    return <div className="ad-nested">{value.map((v, i) => <DetailObject key={i} title={`#${i + 1}`} obj={v} />)}</div>;
  }
  if (value && typeof value === 'object') return <DetailObject obj={value} />;
  return <span>{String(value)}</span>;
}

function DetailObject({ title, obj }) {
  const entries = Object.entries(obj || {}).filter(([, v]) => !isEmptyVal(v));
  if (!entries.length) return null;
  return (
    <div className="ad-nested-group">
      {title && <p className="ad-nested-title">{title}</p>}
      {entries.map(([k, v]) => (
        <div className="ad-row" key={k}>
          <span className="ad-k">{prettifyKey(k)}</span>
          <span className="ad-v"><DetailValue value={v} /></span>
        </div>
      ))}
    </div>
  );
}

const formatDateSafe = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString();
};

// SLA — target turnaround for review (48h). Oldest applications go urgent/overdue.
const SLA_TARGET_HOURS = 48;
const slaInfo = (submitted, nowMs, status) => {
  // Once a decision is made the SLA clock is done — an approved/rejected application
  // must never read "Overdue" (the review already happened).
  if (['approved', 'rejected'].includes(status)) return { label: 'Reviewed', urgent: false };
  if (!submitted) return { label: '-', urgent: false };
  const t = new Date(submitted).getTime();
  if (Number.isNaN(t)) return { label: '-', urgent: false };
  const remainingH = SLA_TARGET_HOURS - (nowMs - t) / 3600000;
  if (remainingH <= 0) return { label: 'Overdue', urgent: true };
  if (remainingH < 24) return { label: `${Math.round(remainingH)}h left`, urgent: remainingH < 6 };
  return { label: `${Math.ceil(remainingH / 24)}d left`, urgent: false };
};

// Handle that looks like a real name (e.g. "Priya Sharma" / "priya.sharma") → flag.
const looksLikeRealName = (name) => {
  const s = String(name || '').replace(/^@/, '').trim();
  if (!s) return false;
  if (/^[A-Z][a-z]+ [A-Z][a-z]+/.test(s)) return true;            // Firstname Lastname
  if (/^[a-z]+[._][a-z]+\d{0,3}$/i.test(s) && !/\d{3,}/.test(s)) return true; // firstname.lastname
  return false;
};

// GST verification badge (we surface what was submitted; real verification is a backend job)
const gstStatus = (profile) => {
  const gstin = profile.gstin || profile.gst_number || profile.gst || (profile.gst_details && (profile.gst_details.gstin || profile.gst_details.number));
  if (!gstin) return { label: 'No GST provided', tone: 'red', value: '' };
  const v = String(gstin).trim();
  const valid = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(v);
  return valid ? { label: 'GST format valid', tone: 'green', value: v } : { label: 'GST unverified', tone: 'yellow', value: v };
};

const FREE_EMAIL = /@(gmail|yahoo|hotmail|outlook|icloud|proton|rediff)\./i;
const RESTRICTED_CATS = ['gambling', 'tobacco', 'alcohol', 'adult', 'crypto', 'weapons', 'cbd'];
const brandFlags = (profile, email) => {
  const flags = [];
  if (FREE_EMAIL.test(email || profile.business_email || '')) flags.push('Free-email domain (not a work email)');
  const cat = String(profile.industry || profile.industry_category || profile.category || profile.product_type || '').toLowerCase();
  if (RESTRICTED_CATS.some((c) => cat.includes(c))) flags.push('Restricted category');
  const blob = `${profile.business_name || ''} ${profile.business_description || profile.description || ''}`.toLowerCase();
  if (/\bagency\b|\bagencies\b|on behalf/.test(blob)) flags.push('Possible agency representative');
  return flags;
};

const STATE_META = {
  pending: { label: 'Pending', cls: 'pending' },
  more_info: { label: 'More Info', cls: 'more_info' },
  approved: { label: 'Approved', cls: 'approved' },
  rejected: { label: 'Rejected', cls: 'rejected' },
};

const REJECT_REASONS = {
  creators: ['Incomplete profile', 'Low-quality portfolio', 'Failed KYC verification', 'Handle looks like a real name', 'Policy violation', 'Duplicate account', 'Other'],
  brands: ['Incomplete profile', 'Invalid / missing GST', 'Restricted category', 'Low-trust (free-email) domain', 'Suspected agency misrepresentation', 'Policy violation', 'Other'],
};
const MORE_INFO_ITEMS = {
  creators: ['Add 3–5 clear portfolio samples', 'Verify social handles', 'Re-record a higher-quality intro video', 'Confirm category / niche', 'Confirm location'],
  brands: ['Provide valid GST details', 'Verify business website', 'Use a work-domain business email', 'Clarify product category', 'Verify social media links'],
};

// ===========================================================================
// Row — one application in the list (role-aware columns)
// ===========================================================================
// Show the applicant's REAL name for review (not their @username/id) — the
// reviewer verifies a real person/business; the public id comes after approval.
const appName = (a) => {
  const p = a.profile || {};
  const realName = isBrandRole(a.role) ? (p.business_name || p.businessName) : (p.fullName || p.full_name);
  return (realName && String(realName).trim()) || String(a.nickname || a.username || '-').replace(/^@+/, '');
};
const appCategory = (a) => {
  const p = a.profile || {};
  return a.category || p.category || p.niche || p.industry || p.industry_category || p.business_type || '';
};
const appSubmitted = (a) => a.submitted_at || a.created_at || a.createdAt || (a.profile || {}).created_at;

function ApplicationRow({ profile, nowMs, onOpen, onApprove, onReject }) {
  const p = profile.profile || {};
  const brand = isBrandRole(profile.role);
  const displayName = appName(profile);
  const email = profile.email || p.business_email || '-';
  const phone = phoneOf(profile) || '-';
  const category = appCategory(profile) || '-';
  const submitted = appSubmitted(profile);
  const sla = slaInfo(submitted, nowMs, profile.approval_status);
  const state = STATE_META[profile.approval_status] || STATE_META.pending;
  // Already-decided applications (approved / rejected) are read-only — only
  // "View" remains; Approve/Reject are hidden so a decision can't be re-made here.
  const decided = ['approved', 'rejected'].includes(profile.approval_status);
  const flagName = !brand && looksLikeRealName(profile.username || '');
  const stop = (e, fn) => { e.stopPropagation(); fn(); };

  // Role-specific middle columns
  const cols = brand
    ? [
        ['Email', email],
        ['Phone', phone],
        ['Category', category],
        ['GST', gstStatus(p).label],
        ['Submitted', formatDateSafe(submitted)],
      ]
    : [
        ['Phone', phone],
        ['Category', category],
        ['Location', p.location || p.country || p.city || '-'],
        ['Submitted', formatDateSafe(submitted)],
      ];

  return (
    <div className="apps-row apps-row--request" onClick={() => onOpen(profile)}>
      <div className="apps-row-identity">
        <div className="apps-avatar" style={{ background: avatarColor(displayName) }}>
          {displayName.replace(/^@/, '').slice(0, 2).toUpperCase()}
        </div>
        <div className="apps-name-block">
          <h4 title={flagName ? 'Handle looks like a real name - verify' : undefined}>
            {displayName}
            {flagName && <AlertTriangle size={13} className="apps-name-flag" />}
          </h4>
          <div className="apps-chip-row">
            <span className="apps-role-pill">{brand ? 'Brand' : 'Creator'}</span>
            <span className={`apps-state apps-state-${state.cls}`}>{state.label}</span>
          </div>
        </div>
      </div>

      <div className={`apps-row-meta${cols.length < 5 ? ' apps-row-meta--5' : ''}`}>
        {cols.map(([label, val]) => (
          <div className="apps-meta" key={label}>
            <span className="apps-meta-label">{label}</span>
            <span className="apps-meta-value" title={String(val)}>{val}</span>
          </div>
        ))}
        <div className="apps-meta">
          <span className="apps-meta-label">SLA</span>
          <span className={`apps-meta-value ${sla.urgent ? 'apps-sla-urgent' : ''}`}>{sla.label}</span>
        </div>
      </div>

      <div className="apps-action-group">
        {!decided && (
          <>
            <button className="btn-decision btn-approve" onClick={(e) => stop(e, () => onApprove(profile.id))}>✓ Approve</button>
            <button className="btn-decision btn-reject" onClick={(e) => stop(e, () => onReject(profile.id))}>✕ Reject</button>
          </>
        )}
        <button className="apps-row-action" onClick={(e) => stop(e, () => onOpen(profile))}><Eye size={14} /> View</button>
      </div>
    </div>
  );
}

// ===========================================================================
// Detail modal — organized sections + decision builder
// ===========================================================================
function MEDIA_OR_META(k) {
  return ['id', '_id', 'user_id', 'userId', 'password', '__v', 'token', 'approval_status', 'role', 'email', 'username', 'nickname', 'profile_completed', 'terms_agreed', 'review', 'submitted_at', 'created_at', 'updatedAt', 'createdAt', 'show_followers', 'showFollowers',
    // Shown as one combined number in the modal header — don't repeat the parts.
    'phone_full', 'dial_code', 'dialCode',
    // Internal / not useful when reviewing a profile.
    'availability_calendar', 'curated_brand_visible', 'creator_directory_visible', 'topics', 'balance', 'deliverables_completed'].includes(k)
    || KEY_IS_MEDIA.test(k) || KEY_IS_KYC.test(k) || KEY_IS_SOCIAL.test(k);
}

// Everything the detail view derives from one application (full profile fetch,
// media / KYC / socials split, flags, ordered field list). Shared by the desktop
// modal and the phone detail so both show the same data.
function useApplicationDetail(profile) {
  const [full, setFull] = useState(profile);
  const [loadingFull, setLoadingFull] = useState(true);
  // Media URLs that failed to load — their tiles are hidden instead of showing an
  // empty player. Keyed on the resolved url.
  const [badMedia, setBadMedia] = useState(() => new Set());

  useLiveEffect(() => {
    let alive = true;
    setLoadingFull(true);
    setFull(profile);
    const id = profile?.id;
    const role = isBrandRole(profile.role) ? 'brands' : 'creators';
    Promise.allSettled([
      id ? axios.get(`${API}/profile/${id}`) : Promise.reject(new Error('no id')),
      axios.get(`${API}/admin/applications/${role}`),
    ]).then(([profR, appsR]) => {
      if (!alive) return;
      const prof = (profR.status === 'fulfilled' && profR.value?.data) ? profR.value.data : {};
      let appMatch = {};
      if (appsR.status === 'fulfilled') {
        const list = Array.isArray(appsR.value.data) ? appsR.value.data : (appsR.value.data?.data || []);
        appMatch = list.find((a) => a.id === id || (profile.email && a.email === profile.email)) || {};
      }
      setFull({
        ...appMatch, ...prof, ...profile,
        profile: { ...(appMatch.profile || appMatch || {}), ...(prof.profile || prof || {}), ...(profile.profile || {}) },
      });
    }).finally(() => { if (alive) setLoadingFull(false); });
    return () => { alive = false; };
  }, [profile]);

  const p = full.profile || {};
  const flat = { ...p };
  Object.entries(full).forEach(([k, v]) => { if (k !== 'profile' && !(k in flat)) flat[k] = v; });

  const brand = isBrandRole(full.role || profile.role);
  const roleKey = brand ? 'brands' : 'creators';

  // ---- media: photo, videos, kyc, social, generic fields ----
  const photos = [], videos = [], kyc = [];
  // Cloudinary delivers videos under /video/upload/ and may drop the .mp4 suffix,
  // so an extension check alone misclassifies them as images.
  const looksVideo = (u) => VIDEO_EXT.test(u) || /\/video\/upload\//i.test(u);
  Object.entries(flat).forEach(([k, v]) => {
    collectUrls(v).forEach((u) => {
      if (KEY_IS_KYC.test(k)) kyc.push({ k, u });
      else if (KEY_IS_VIDEO.test(k) || looksVideo(u)) videos.push(u);
      else if (KEY_IS_IMAGE.test(k) || IMAGE_EXT.test(u) || /portfolio/i.test(k)) (looksVideo(u) ? videos : photos).push(u);
    });
  });
  // Dedupe on the RESOLVED url (ignoring query/hash), not the raw string — the same
  // file is often stored under several keys in different forms ("/uploads/x.mp4" vs
  // "http://host/uploads/x.mp4"), which otherwise renders the same video twice.
  const mediaKey = (u) => resolveUrl(u).split(/[?#]/)[0].toLowerCase();
  const uniq = (a) => {
    const seen = new Set();
    return a.filter((u) => {
      const k = mediaKey(u);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };
  const photoList = uniq(photos);
  const videoList = uniq(videos);
  const mainPhoto = photoList[0];
  const portfolioPhotos = photoList.slice(1);
  // A stale/broken URL still renders an empty <video> player; drop those tiles.
  const playableVideos = videoList.filter((u) => !badMedia.has(mediaKey(u)));

  // social links
  const socialObj = p.social_links || p.social_media || p.links || {};
  const socials = [];
  if (socialObj && typeof socialObj === 'object') {
    Object.entries(socialObj).forEach(([k, v]) => { const u = (collectUrls(v)[0]) || (typeof v === 'string' ? v : ''); if (u) socials.push([k, u]); });
  }
  (p.extraLinks || []).forEach((l) => { if (l && l.url) socials.push([l.platform || 'link', l.url]); });

  const uname = full.username || profile.username;
  // Real name is the review identity; the @username/id is secondary (shown after approval).
  const realName = brand ? (p.business_name || p.businessName || full.business_name) : (p.fullName || p.full_name || full.full_name);
  const displayName = (realName && String(realName).trim()) || String(full.nickname || profile.nickname || uname || '-').replace(/^@+/, '');
  const headerEmail = full.email || p.business_email || profile.email;
  const headerPhone = phoneOf(full) || phoneOf(profile);
  const flagName = !brand && looksLikeRealName(uname || '');
  const gst = gstStatus(p);
  const flags = brand ? brandFlags(p, headerEmail) : [];
  const website = brand ? (p.website || p.website_url) : null;
  const review = full.review || {};

  // text fields excluding media/kyc/social. De-dupe by display label so a field
  // stored under two spellings (deliveryDays + delivery_days → "Delivery Days")
  // only shows once.
  const seenLabels = new Set();
  // The profile stores BOTH `content_styles` (the picked array) and a legacy
  // `content_style` (just the first item). They prettify to different labels
  // ("Content Styles" vs "Content Style"), so the label de-dupe below doesn't
  // catch them — drop the singular when the array is present so the same styles
  // aren't shown twice.
  const hasStyleArray = !isEmptyVal(flat.content_styles) || !isEmptyVal(flat.contentStyles);
  const entries = Object.entries(flat)
    .filter(([k, v]) => !MEDIA_OR_META(k) && !isEmptyVal(v))
    .filter(([k]) => !(hasStyleArray && (k === 'content_style' || k === 'contentStyle')))
    .filter(([k]) => {
      const lbl = prettifyKey(k).toLowerCase();
      if (seenLabels.has(lbl)) return false;
      seenLabels.add(lbl);
      return true;
    })
    // Show fields in a human order (identity → persona → commercials → rest)
    // instead of whatever arbitrary order the API returns them in.
    .sort((a, b) => fieldRank(a[0]) - fieldRank(b[0]));

  const decided = ['approved', 'rejected'].includes(full?.approval_status);
  return {
    full, loadingFull, p, brand, roleKey, mediaKey, setBadMedia, badMedia,
    mainPhoto, portfolioPhotos, videoList, playableVideos, kyc, socials,
    uname, displayName, headerEmail, headerPhone, flagName, gst, flags, website, review, entries, decided,
  };
}

function ProfileDetail({ profile, onBack, onDecide }) {
  const {
    full, loadingFull, brand, roleKey, mediaKey, setBadMedia, mainPhoto, portfolioPhotos, playableVideos,
    kyc, socials, displayName, headerEmail, headerPhone, flagName, gst, flags, website, review, entries, decided,
  } = useApplicationDetail(profile);
  const [mode, setMode] = useState(null);             // null | 'more_info' | 'reject'
  // Auto-scroll the reveal panel into view when Request More Info / Reject is clicked.
  const scrollToBuilder = useCallback((el) => {
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);
  const [reasonCode, setReasonCode] = useState('');
  const [reasonDetails, setReasonDetails] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [infoItems, setInfoItems] = useState([]);

  const decide = (action, payload) => { onDecide(profile.id, action, payload); onBack(); };
  const toggleItem = (it) => setInfoItems((cur) => cur.includes(it) ? cur.filter((x) => x !== it) : [...cur, it]);

  return (
    <div className="apps-modal-overlay" onClick={onBack} role="dialog" aria-modal="true">
      <div className="apps-modal" onClick={(e) => e.stopPropagation()}>
        <button className="apps-modal-close" onClick={onBack} aria-label="Close"><X size={18} /></button>

        <div className="apps-modal-head">
          {mainPhoto ? (
            <img src={resolveUrl(mainPhoto)} alt={displayName} className="apps-modal-photo" />
          ) : (
            <div className="apps-avatar apps-modal-photo" style={{ background: avatarColor(displayName) }}>
              {displayName.replace(/^@/, '').slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="apps-modal-head-info">
            <h2>{displayName}{flagName && <span className="apps-flag-pill"><AlertTriangle size={12} /> Looks like a real name</span>}</h2>
            <div className="apps-chip-row">
              <span className="apps-role-pill">{brand ? 'Brand' : 'Creator'}</span>
              <span className={`apps-state apps-state-${(STATE_META[full.approval_status] || STATE_META.pending).cls}`}>
                {(STATE_META[full.approval_status] || STATE_META.pending).label}
              </span>
            </div>
            <p>{headerEmail}</p>
            {headerPhone && <p className="apps-modal-phone"><Phone size={13} /> {headerPhone}</p>}
          </div>
        </div>

        <div className="apps-modal-body">
          {review && (review.reason_code || review.more_info_message) && (
            <div className="apps-review-note">
              {review.reason_code && <p><strong>Rejection:</strong> {review.reason_code}{review.reason_details ? ` - ${review.reason_details}` : ''}</p>}
              {review.more_info_message && <p><strong>Info requested:</strong> {review.more_info_message}</p>}
            </div>
          )}

          {/* Portfolio + video (creator) */}
          {(playableVideos.length > 0 || portfolioPhotos.length > 0) && (
            <section className="detail-section full-width">
              <h3><PlayCircle size={16} className="apps-h3-ic" />{brand ? 'Media' : 'Portfolio & Video'} <span className="apps-h3-note">full resolution · no watermark</span></h3>
              <div className="apps-modal-media">
                {playableVideos.map((u, i) => (
                  <video
                    key={`v${i}`}
                    src={signedUrl(u)}
                    controls
                    preload="metadata"
                    onError={() => setBadMedia((s) => new Set(s).add(mediaKey(u)))}
                    style={{ width: '100%', borderRadius: 10, background: '#000', aspectRatio: '16 / 9' }}
                  />
                ))}
                {portfolioPhotos.map((u, i) => (
                  <a key={`p${i}`} href={signedUrl(u)} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}><img src={signedUrl(u)} alt="" style={{ width: '100%', height: 'auto', borderRadius: 10, objectFit: 'contain', background: '#f2f4f7', display: 'block' }} /></a>
                ))}
              </div>
            </section>
          )}

          {/* KYC documents (creator) */}
          {!brand && kyc.length > 0 && (
            <section className="detail-section full-width">
              <h3><ShieldCheck size={16} className="apps-h3-ic" />KYC Documents</h3>
              <div className="apps-kyc-grid">
                {kyc.map(({ k, u }, i) => {
                  const url = resolveUrl(u);
                  const isImg = IMAGE_EXT.test(u) || KEY_IS_IMAGE.test(k);
                  return (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="apps-kyc-item">
                      {isImg ? <img src={url} alt={k} /> : <div className="apps-kyc-doc"><FileText size={26} /></div>}
                      <span>{prettifyKey(k)}</span>
                    </a>
                  );
                })}
              </div>
            </section>
          )}

          {/* GST verification (brand) */}
          {brand && (
            <section className="detail-section full-width">
              <h3><ShieldCheck size={16} className="apps-h3-ic" />GST Verification</h3>
              <div className="apps-gst-row">
                <span className={`apps-gst-badge apps-gst-${gst.tone}`}>{gst.label}</span>
                {gst.value && <code className="apps-gst-num">{gst.value}</code>}
              </div>
            </section>
          )}

          {/* Website preview (brand) */}
          {brand && website && (
            <section className="detail-section full-width">
              <h3><Globe size={16} className="apps-h3-ic" />Website Preview <a href={resolveUrl(website)} target="_blank" rel="noopener noreferrer" className="apps-h3-note">open ↗</a></h3>
              <div className="apps-web-frame">
                <iframe title="website preview" src={resolveUrl(website)} sandbox="allow-scripts allow-same-origin" loading="lazy" referrerPolicy="no-referrer" />
              </div>
            </section>
          )}

          {/* Social handles */}
          {socials.length > 0 && (
            <section className="detail-section full-width">
              <h3><Link2 size={16} className="apps-h3-ic" />{brand ? 'Social Media' : 'Social Handles'} <span className="apps-h3-note">for cross-verification</span></h3>
              <div className="apps-social-row">
                {socials.map(([k, u], i) => (
                  <a key={i} href={isUrl(u) ? u : `https://${u}`} target="_blank" rel="noopener noreferrer" className="apps-social-chip"><SocialLogo platform={k} />{prettifyKey(k)}</a>
                ))}
              </div>
            </section>
          )}

          {/* Flags (brand) */}
          {brand && flags.length > 0 && (
            <section className="detail-section full-width">
              <h3><AlertTriangle size={16} className="apps-h3-ic" />Flags</h3>
              <div className="apps-flags">{flags.map((f, i) => <span key={i} className="apps-flag-item"><AlertTriangle size={12} /> {f}</span>)}</div>
            </section>
          )}

          {/* Everything else */}
          <section className="detail-section full-width">
            <h3>All Submitted Details</h3>
            {entries.length > 0 ? (
              <div className="info-grid all-details-grid">
                {entries.map(([k, v]) => (
                  <div key={k} className={`info-item ${(v && typeof v === 'object') ? 'full-width' : ''}`}><label>{prettifyKey(k)}</label><div className="all-details-value"><DetailValue value={v} /></div></div>
                ))}
              </div>
            ) : (
              <p style={{ color: '#94a3b8' }}>{loadingFull ? 'Loading full profile…' : 'No additional details were submitted.'}</p>
            )}
          </section>

          {/* Decision builder panels */}
          {mode === 'more_info' && (
            <section ref={scrollToBuilder} className="detail-section full-width apps-builder">
              <h3><MessageSquarePlus size={16} className="apps-h3-ic" />Request More Information</h3>
              <div className="apps-builder-items">
                {MORE_INFO_ITEMS[roleKey].map((it) => (
                  <label key={it} className="apps-check"><input type="checkbox" checked={infoItems.includes(it)} onChange={() => toggleItem(it)} /> {it}</label>
                ))}
              </div>
              <textarea className="apps-textarea" placeholder="Add a message to the applicant…" value={infoMessage} onChange={(e) => setInfoMessage(e.target.value)} rows={3} />
            </section>
          )}
          {mode === 'reject' && (
            <section ref={scrollToBuilder} className="detail-section full-width apps-builder">
              <h3><XCircle size={16} className="apps-h3-ic" />Reject - reason</h3>
              <select className="apps-select" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
                <option value="">Select a reason code…</option>
                {REJECT_REASONS[roleKey].map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <textarea className="apps-textarea" placeholder="Optional details for the applicant…" value={reasonDetails} onChange={(e) => setReasonDetails(e.target.value)} rows={3} />
            </section>
          )}
        </div>

        <div className="apps-modal-foot">
          {mode === null && (
            decided ? (
              <span className="apps-decided-note" style={{ color: '#585c7e', fontSize: 13.5, fontWeight: 600, padding: '4px 2px' }}>
                This profile is already {(STATE_META[full.approval_status] || {}).label || full.approval_status} - no further action needed.
              </span>
            ) : (
              <>
                <button className="btn-decision btn-moreinfo" onClick={() => setMode('more_info')}><MessageSquarePlus size={15} /> Request More Info</button>
                <button className="btn-decision btn-reject" onClick={() => setMode('reject')}>✕ Reject</button>
                <button className="btn-decision btn-approve" onClick={() => decide('approve')}>✓ Approve</button>
              </>
            )
          )}
          {mode === 'more_info' && (
            <>
              <button className="btn-decision" onClick={() => setMode(null)}>Back</button>
              <button className="btn-decision btn-moreinfo" disabled={!infoMessage && infoItems.length === 0}
                onClick={() => decide('request_info', { message: infoMessage, items: infoItems })}>Send Request</button>
            </>
          )}
          {mode === 'reject' && (
            <>
              <button className="btn-decision" onClick={() => setMode(null)}>Back</button>
              <button className="btn-decision btn-reject" disabled={!reasonCode}
                onClick={() => decide('reject', { reason_code: reasonCode, reason_details: reasonDetails })}>Confirm Reject</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Phone (PWA) view — rendered only when useIsPhone() is true
// ===========================================================================
const PHONE_FILTER_DEFAULTS = { stateFilter: 'pending', categoryFilter: 'all', dateFrom: '', dateTo: '', gstFilter: 'all', flaggedOnly: false, sortOrder: 'oldest' };
const STATUS_TONE = { pending: 'wait', more_info: 'info', approved: 'ok', rejected: 'bad' };
const GST_TONE = { green: 'ok', yellow: 'wait', red: 'bad' };
const ABOUT_KEY = /^(bio|about|headline|business_description|description)$/;
const PAYMENT_KEY = /(^|_)rate|payout|payment|bank|upi|ifsc|account_?(no|number|holder)|beneficiary|billing|price/i;

const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const photoOf = (a) => {
  const p = a.profile || {};
  return collectUrls(a.profile_photo || p.profile_picture || p.profile_photo || p.logo || p.logo_url || p.avatar)[0] || '';
};
const roleLine = (a) => {
  const kind = isBrandRole(a.role) ? 'brand' : 'creator';
  const cat = appCategory(a);
  return cat ? `${capFirst(String(cat))} ${kind}` : capFirst(kind);
};
// chandan@gmail.com → chand***@gmail.com
const maskEmail = (e) => {
  const [local, domain] = String(e || '').split('@');
  if (!local || !domain) return '';
  return `${local.slice(0, Math.min(5, Math.max(1, local.length - 2)))}***@${domain}`;
};
// +91 9406879532 → +91 ******9532 (dial code kept, last 4 digits shown)
const maskPhone = (ph) => {
  const s = String(ph || '').trim();
  if (!s) return '';
  const m = s.match(/^(\+\d{1,4}\s+)(.*)$/);
  const [dial, num] = m ? [m[1], m[2]] : ['', s];
  return dial + num.replace(/\d(?=(?:\D*\d){4})/g, '*');
};
const rupees = (v) => (Number.isFinite(Number(v)) && String(v).trim() !== '' ? `₹${Number(v).toLocaleString('en-IN')}` : String(v));

function PhoneAvatar({ src, name, lg }) {
  const [broken, setBroken] = useState(false);
  const cls = `am-avatar${lg ? ' am-avatar--lg' : ''}`;
  if (src && !broken) return <img className={cls} src={resolveUrl(src)} alt="" onError={() => setBroken(true)} />;
  return <span className={cls} aria-hidden="true">{String(name || '?').replace(/^@/, '').charAt(0).toUpperCase()}</span>;
}

function Sheet({ title, onClose, children, foot }) {
  return (
    <>
      <div className="am-sheet-backdrop" onClick={onClose} />
      <div className="am-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="am-sheet-head">
          <h2>{title}</h2>
          <button type="button" className="am-icon-btn" aria-label="Close" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="am-sheet-body">{children}</div>
        <div className="am-sheet-foot">{foot}</div>
      </div>
    </>
  );
}

// Draft copy of the filters; only "Apply filters" commits them. Mounted per open,
// so it always starts from the currently applied selections.
function PhoneFilterSheet({ isBrands, categories, values, onApply, onClose }) {
  const [draft, setDraft] = useState(values);
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const chip = (k, v, label) => (
    <button type="button" key={v} className={`am-chip${draft[k] === v ? ' is-active' : ''}`} aria-pressed={draft[k] === v} onClick={() => set(k, v)}>{label}</button>
  );
  return (
    <Sheet title="Filter reviews" onClose={onClose} foot={(
      <>
        <button type="button" className="am-btn am-btn--secondary" onClick={() => setDraft(PHONE_FILTER_DEFAULTS)}>Reset</button>
        <button type="button" className="am-btn am-btn--primary" onClick={() => onApply(draft)}>Apply filters</button>
      </>
    )}>
      <div className="am-field">
        <span className="am-field-label">Status</span>
        <div className="am-chips">
          {chip('stateFilter', 'all', 'All')}
          {Object.entries(STATE_META).map(([k, m]) => chip('stateFilter', k, m.label))}
        </div>
      </div>
      <div className="am-field">
        <label htmlFor="ama-cat">Category</label>
        <select id="ama-cat" value={draft.categoryFilter} onChange={(e) => set('categoryFilter', e.target.value)}>
          <option value="all">All</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="am-field">
        <label htmlFor="ama-from">Submitted from</label>
        <input id="ama-from" type="date" value={draft.dateFrom} onChange={(e) => set('dateFrom', e.target.value)} />
      </div>
      <div className="am-field">
        <label htmlFor="ama-to">Submitted to</label>
        <input id="ama-to" type="date" value={draft.dateTo} onChange={(e) => set('dateTo', e.target.value)} />
      </div>
      {isBrands && (
        <>
          <div className="am-field">
            <label htmlFor="ama-gst">GST</label>
            <select id="ama-gst" value={draft.gstFilter} onChange={(e) => set('gstFilter', e.target.value)}>
              <option value="all">All</option>
              <option value="green">Valid</option>
              <option value="yellow">Unverified</option>
              <option value="red">Missing</option>
            </select>
          </div>
          <label className="ama-check"><input type="checkbox" checked={draft.flaggedOnly} onChange={(e) => set('flaggedOnly', e.target.checked)} /> Flagged only</label>
        </>
      )}
      <div className="am-field">
        <span className="am-field-label">Sort by</span>
        <div className="am-chips">
          {chip('sortOrder', 'oldest', 'Oldest first')}
          {chip('sortOrder', 'newest', 'Newest first')}
        </div>
      </div>
    </Sheet>
  );
}

function KvList({ items }) {
  return items.map(([k, v]) => ((v && typeof v === 'object')
    ? <div className="ama-kv-block" key={k}><span>{prettifyKey(k)}</span><DetailValue value={v} /></div>
    : <div className="am-kv" key={k}><span>{prettifyKey(k)}</span><span><DetailValue value={v} /></span></div>));
}

function DocRow({ label, url, isImg, failed, onFail }) {
  return (
    <div className="am-doc">
      {isImg && !failed
        ? <img className="am-thumb" src={url} alt="" onError={onFail} />
        : <span className="am-thumb ama-doc-ic"><FileText size={22} /></span>}
      <div className="am-doc-main">
        {label}
        <small>{failed ? 'Preview failed to load' : isImg ? 'Image' : 'File'}</small>
      </div>
      <a className="am-btn am-btn--secondary am-btn--sm" href={url} target="_blank" rel="noopener noreferrer">View</a>
    </div>
  );
}

function PhoneApplicationDetail({ profile, nowMs, onBack, onDecide }) {
  const {
    full, loadingFull, p, brand, roleKey, mediaKey, setBadMedia, badMedia, mainPhoto, portfolioPhotos, videoList,
    kyc, socials, uname, displayName, headerEmail, headerPhone, flagName, gst, flags, website, review, entries, decided,
  } = useApplicationDetail(profile);
  const [tab, setTab] = useState('overview');
  const [openRow, setOpenRow] = useState(null);         // 'payment' | 'account'
  const [sheet, setSheet] = useState(null);             // 'reject' | 'more_info'
  const [reasonCode, setReasonCode] = useState('');
  const [reasonDetails, setReasonDetails] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [infoItems, setInfoItems] = useState([]);
  const [submitting, setSubmitting] = useState(null);   // action being sent
  const busy = useRef(false);

  const submit = async (action, payload) => {
    if (busy.current) return;                           // no double submits
    busy.current = true;
    setSubmitting(action);
    const ok = await onDecide(profile.id, action, payload);
    if (ok) { onBack(); return; }                       // list refetches with the new status
    busy.current = false;
    setSubmitting(null);
  };
  const markBad = (u) => setBadMedia((s) => new Set(s).add(mediaKey(u)));
  const toggleItem = (it) => setInfoItems((cur) => (cur.includes(it) ? cur.filter((x) => x !== it) : [...cur, it]));
  const closeSheet = () => { if (!submitting) setSheet(null); };

  const status = full.approval_status;
  const state = STATE_META[status] || STATE_META.pending;
  const submitted = appSubmitted(full);
  const sla = slaInfo(submitted, nowMs, status);
  const category = appCategory(full);
  const about = entries.filter(([k]) => ABOUT_KEY.test(k));
  const rate = (p.rate_card && typeof p.rate_card === 'object' && !Array.isArray(p.rate_card))
    ? Object.entries(p.rate_card).filter(([k, v]) => !isEmptyVal(v) && !(k === 'expected_payout' && String(v) === String(p.rate_card.raw_payout)))
    : [];
  const rest = entries.filter(([k]) => !ABOUT_KEY.test(k) && !(k === 'rate_card' && rate.length));
  const payment = rest.filter(([k]) => PAYMENT_KEY.test(k));
  const seen = new Set();
  const account = [['email', headerEmail], ['phone', headerPhone], ['username', uname], ...rest.filter(([k]) => !PAYMENT_KEY.test(k))]
    .filter(([k, v]) => {
      const lbl = prettifyKey(k).toLowerCase();
      if (isEmptyVal(v) || seen.has(lbl)) return false;
      seen.add(lbl);
      return true;
    });
  const hasMedia = videoList.length > 0 || portfolioPhotos.length > 0;
  const tabs = [['overview', 'Overview'], ...((!brand || hasMedia) ? [['documents', 'Documents']] : []), ['activity', 'Activity']];
  let websiteHost = website;
  try { websiteHost = new URL(resolveUrl(website)).hostname; } catch { /* keep raw */ }

  const accordion = [['payment', 'Payment details', payment], ['account', 'Account details', account]].filter(([, , items]) => items.length);

  return (
    <div className="am-detail" role="dialog" aria-modal="true" aria-label="Application">
      <div className="am-detail-head">
        <button type="button" className="am-icon-btn" aria-label="Back" onClick={onBack}><ArrowLeft size={22} /></button>
        <h1>Application</h1>
      </div>

      <div className="am-detail-body">
        <div className="am-identity">
          <PhoneAvatar src={mainPhoto} name={displayName} lg />
          <div className="ama-identity-meta">
            <h2>{displayName}</h2>
            <div className="am-badges">
              <span className={`am-badge am-badge--${STATUS_TONE[status] || 'wait'}`}>{state.label}</span>
              {sla.label === 'Overdue' && <span className="am-badge am-badge--overdue">Overdue</span>}
              {flagName && <span className="am-badge am-badge--wait"><AlertTriangle size={12} /> Handle looks like a real name</span>}
            </div>
            <span className="am-card-sub">{roleLine(full)}</span>
            {headerEmail && <span className="am-card-sub">{maskEmail(headerEmail) || headerEmail}</span>}
            {headerPhone && <span className="am-card-sub">{maskPhone(headerPhone)}</span>}
          </div>
        </div>

        <div className="am-tabs" role="tablist">
          {tabs.map(([k, label]) => (
            <button type="button" role="tab" key={k} aria-selected={tab === k} className={tab === k ? 'is-active' : ''} onClick={() => setTab(k)}>{label}</button>
          ))}
        </div>

        {loadingFull && <p className="am-muted" role="status">Loading full profile…</p>}

        {tab === 'overview' && (
          <>
            <section className="am-section">
              <h3>About</h3>
              {about.length > 0
                ? about.map(([k, v]) => <p key={k}><DetailValue value={v} /></p>)
                : <p className="am-muted">No bio provided.</p>}
              <div className="am-kv"><span>Submitted on</span><span>{formatDateSafe(submitted)}</span></div>
              <div className="am-kv"><span>Category</span><span>{category || '-'}</span></div>
              <div className="am-kv"><span>Review SLA</span><span>{sla.label}</span></div>
            </section>

            {rate.length > 0 && (
              <section className="am-section">
                <h3>Rate card</h3>
                <div className="am-rate-grid">
                  {rate.map(([k, v]) => <div className="am-rate" key={k}>{prettifyKey(k)}<strong>{rupees(v)}</strong></div>)}
                </div>
              </section>
            )}

            {brand && (
              <section className="am-section">
                <h3>Business</h3>
                {(p.business_name || p.businessName) && <div className="am-kv"><span>Business name</span><span>{p.business_name || p.businessName}</span></div>}
                {p.country && <div className="am-kv"><span>Country</span><span>{String(p.country)}</span></div>}
                {website ? (
                  <div className="ama-web">
                    <Globe size={18} />
                    <span className="ama-web-host">{websiteHost}</span>
                    <a className="am-btn am-btn--secondary am-btn--sm" href={resolveUrl(website)} target="_blank" rel="noopener noreferrer">Open website <ExternalLink size={14} /></a>
                  </div>
                ) : <div className="am-kv"><span>Website</span><span>Not provided</span></div>}
                <div className="am-kv">
                  <span>GST</span>
                  <span className="am-badges"><span className={`am-badge am-badge--${GST_TONE[gst.tone]}`}>{gst.label}</span></span>
                </div>
                {gst.value && <code className="ama-code">{gst.value}</code>}
                {flags.length > 0 && (
                  <div className="am-badges" aria-label="Flags">
                    {flags.map((f) => <span key={f} className="am-badge am-badge--bad"><AlertTriangle size={12} /> {f}</span>)}
                  </div>
                )}
              </section>
            )}

            {socials.length > 0 && (
              <section className="am-section">
                <h3>{brand ? 'Social media' : 'Social handles'}</h3>
                <div className="am-chips">
                  {socials.map(([k, u], i) => (
                    <a key={i} className="am-chip" href={isUrl(u) ? u : `https://${u}`} target="_blank" rel="noopener noreferrer"><SocialLogo platform={k} />{prettifyKey(k)}</a>
                  ))}
                </div>
              </section>
            )}

            {accordion.length > 0 && (
              <ul className="am-rows">
                {accordion.map(([key, label, items]) => (
                  <li key={key}>
                    <button type="button" className="am-row" aria-expanded={openRow === key} onClick={() => setOpenRow(openRow === key ? null : key)}>
                      <span className="am-row-label">{label}</span>
                      {openRow === key ? <ChevronDown size={18} className="am-row-chevron" /> : <ChevronRight size={18} className="am-row-chevron" />}
                    </button>
                    {openRow === key && <div className="ama-panel"><KvList items={items} /></div>}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === 'documents' && (
          <>
            {!brand && (
              <section className="am-section">
                <h3>KYC documents</h3>
                {kyc.length > 0 ? kyc.map(({ k, u }, i) => (
                  <DocRow key={i} label={prettifyKey(k)} url={resolveUrl(u)} isImg={IMAGE_EXT.test(u) || KEY_IS_IMAGE.test(k)}
                    failed={badMedia.has(mediaKey(u))} onFail={() => markBad(u)} />
                )) : <p className="am-muted">No KYC documents submitted.</p>}
              </section>
            )}
            <section className="am-section">
              <h3>{brand ? 'Media' : 'Portfolio & video'}</h3>
              {!hasMedia && <p className="am-muted">No portfolio media submitted.</p>}
              {videoList.map((u, i) => (badMedia.has(mediaKey(u))
                ? <DocRow key={`v${i}`} label={`Video ${i + 1}`} url={signedUrl(u)} failed />
                : <video key={`v${i}`} className="ama-video" src={signedUrl(u)} controls preload="metadata" playsInline onError={() => markBad(u)} />))}
              {portfolioPhotos.length > 0 && (
                <div className="ama-photos">
                  {portfolioPhotos.map((u, i) => (badMedia.has(mediaKey(u))
                    ? <DocRow key={`p${i}`} label={`Photo ${i + 1}`} url={signedUrl(u)} failed />
                    : <a key={`p${i}`} href={signedUrl(u)} target="_blank" rel="noopener noreferrer" aria-label={`Open photo ${i + 1}`}><img src={signedUrl(u)} alt="" onError={() => markBad(u)} /></a>))}
                </div>
              )}
            </section>
          </>
        )}

        {tab === 'activity' && (
          <section className="am-section">
            <h3>Activity</h3>
            <ol className="am-timeline">
              <li className="am-step am-step--done">
                <span className="am-step-dot" />
                <span className="am-step-label">Application submitted</span>
                <span className="am-step-date">{formatDateSafe(submitted)}</span>
              </li>
              {(review.requested_at || review.more_info_message || (review.more_info_items || []).length > 0) && (
                <li className="am-step am-step--done">
                  <span className="am-step-dot" />
                  <div>
                    <span className="am-step-label">More info requested</span>
                    {review.more_info_message && <p className="ama-step-note">{review.more_info_message}</p>}
                    {(review.more_info_items || []).length > 0 && <ul className="ama-step-list">{review.more_info_items.map((it) => <li key={it}>{it}</li>)}</ul>}
                  </div>
                  <span className="am-step-date">{formatDateSafe(review.requested_at)}</span>
                </li>
              )}
              {review.reason_code && (
                <li className="am-step am-step--done">
                  <span className="am-step-dot" />
                  <div>
                    <span className="am-step-label">Rejected</span>
                    <p className="ama-step-note">{review.reason_code}{review.reason_details ? ` - ${review.reason_details}` : ''}</p>
                  </div>
                  <span className="am-step-date">{formatDateSafe(review.decided_at)}</span>
                </li>
              )}
              {status === 'approved' && (
                <li className="am-step am-step--done">
                  <span className="am-step-dot" />
                  <span className="am-step-label">Approved</span>
                  <span className="am-step-date">{formatDateSafe(review.decided_at || full.approved_at)}</span>
                </li>
              )}
            </ol>
            <p className="am-muted">Only the latest review decision is stored.</p>
          </section>
        )}
      </div>

      <div className="am-actionbar">
        {decided ? (
          <p className="ama-decided">This application is already {state.label.toLowerCase()}. No further action needed.</p>
        ) : (
          <>
            <div className="am-actionbar-row">
              <button type="button" className="am-btn am-btn--danger" disabled={!!submitting} onClick={() => setSheet('reject')}><XCircle size={18} /> Reject</button>
              <button type="button" className="am-btn am-btn--primary" disabled={!!submitting} onClick={() => submit('approve')}>
                <CheckCircle size={18} /> {submitting === 'approve' ? 'Approving…' : 'Approve'}
              </button>
            </div>
            <button type="button" className="am-btn am-btn--link" disabled={!!submitting} onClick={() => setSheet('more_info')}><MessageSquarePlus size={18} /> Request more info</button>
          </>
        )}
      </div>

      {sheet === 'reject' && (
        <Sheet title="Reject application" onClose={closeSheet} foot={(
          <>
            <button type="button" className="am-btn am-btn--secondary" disabled={!!submitting} onClick={closeSheet}>Cancel</button>
            <button type="button" className="am-btn am-btn--danger" disabled={!reasonCode || !!submitting}
              onClick={() => submit('reject', { reason_code: reasonCode, reason_details: reasonDetails })}>
              {submitting === 'reject' ? 'Rejecting…' : 'Confirm reject'}
            </button>
          </>
        )}>
          <div className="am-field">
            <label htmlFor="ama-reason">Reason</label>
            <select id="ama-reason" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
              <option value="">Select a reason code…</option>
              {REJECT_REASONS[roleKey].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {!reasonCode && <span className="am-field-hint">Choose a reason to continue.</span>}
          </div>
          <div className="am-field">
            <label htmlFor="ama-reason-details">Details for the applicant (optional)</label>
            <textarea id="ama-reason-details" rows={3} value={reasonDetails} onChange={(e) => setReasonDetails(e.target.value)} />
          </div>
        </Sheet>
      )}

      {sheet === 'more_info' && (
        <Sheet title="Request more info" onClose={closeSheet} foot={(
          <>
            <button type="button" className="am-btn am-btn--secondary" disabled={!!submitting} onClick={closeSheet}>Cancel</button>
            <button type="button" className="am-btn am-btn--primary" disabled={(!infoMessage && infoItems.length === 0) || !!submitting}
              onClick={() => submit('request_info', { message: infoMessage, items: infoItems })}>
              {submitting === 'request_info' ? 'Sending…' : 'Send request'}
            </button>
          </>
        )}>
          <div className="am-field">
            <span className="am-field-label">What's needed</span>
            {MORE_INFO_ITEMS[roleKey].map((it) => (
              <label key={it} className="ama-check"><input type="checkbox" checked={infoItems.includes(it)} onChange={() => toggleItem(it)} /> {it}</label>
            ))}
          </div>
          <div className="am-field">
            <label htmlFor="ama-info-msg">Message to the applicant</label>
            <textarea id="ama-info-msg" rows={3} value={infoMessage} onChange={(e) => setInfoMessage(e.target.value)} />
            {!infoMessage && infoItems.length === 0 && <span className="am-field-hint">Pick at least one item or write a message.</span>}
          </div>
        </Sheet>
      )}
    </div>
  );
}

// ===========================================================================
// Page
// ===========================================================================
function ApplicationsPage() {
  const { user } = useAuth();
  // Custom-admin data scope: 'all' | 'creator' | 'business'. Limits which
  // application tabs this admin may see (creators-only / brands-only).
  const scope = user?.admin_scope || 'all';
  const canSeeCreators = scope !== 'business';
  const canSeeBrands = scope !== 'creator';

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applicationType, setApplicationType] = useState(scope === 'business' ? 'brands' : 'creators');
  // If the admin's scope forbids the active tab (e.g. scope loaded after mount),
  // snap to the one they're allowed to see.
  useEffect(() => {
    if (!canSeeBrands && applicationType === 'brands') setApplicationType('creators');
    else if (!canSeeCreators && applicationType === 'creators') setApplicationType('brands');
  }, [canSeeBrands, canSeeCreators, applicationType]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProfile, setSelectedProfile] = useState(null);
  // filters
  const [stateFilter, setStateFilter] = useState('pending');   // default: pending (current view preserved)
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [gstFilter, setGstFilter] = useState('all');           // brand: all|green|yellow|red
  const [flaggedOnly, setFlaggedOnly] = useState(false);       // brand
  const [sortOrder, setSortOrder] = useState('oldest');        // oldest first by default
  const isPhone = useIsPhone();
  const [filterSheetOpen, setFilterSheetOpen] = useState(false); // phone only
  // Recompute "now" whenever the list reloads so SLA labels stay fresh.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nowMs = useMemo(() => Date.now(), [applications]);

  useLiveEffect(() => { fetchApplications(); }, []);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      // `status=all` returns every state (incl. rejected) so the State filter and
      // rejection details stay available after a decision is made.
      const res = await axios.get(`${API}/admin/pending-profiles?status=all`);
      setApplications(Array.isArray(res.data) ? res.data : (res.data?.data || []));
    } catch {
      toast.error('Failed to load applications');
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (userId, action, payload = {}) => {
    try {
      await axios.post(`${API}/admin/approve-profile`, { item_id: userId, action, ...payload });
      const msg = action === 'approve' ? 'Application approved' : action === 'request_info' ? 'More info requested' : 'Application rejected';
      toast.success(msg);
      fetchApplications();
      return true;
    } catch {
      toast.error('Action failed');
      return false;
    }
  };

  const roleList = useMemo(
    () => applications.filter((a) => (applicationType === 'creators' ? isCreatorRole(a.role) : isBrandRole(a.role))),
    [applications, applicationType]
  );

  const categories = useMemo(() => {
    const set = new Set();
    roleList.forEach((a) => {
      const p = a.profile || {};
      const c = a.category || p.category || p.niche || p.industry || p.industry_category || p.business_type;
      if (c) set.add(c);
    });
    return [...set];
  }, [roleList]);

  const counts = useMemo(() => {
    const c = { pending: 0, more_info: 0, approved: 0, rejected: 0 };
    roleList.forEach((a) => { c[a.approval_status] = (c[a.approval_status] || 0) + 1; });
    return c;
  }, [roleList]);

  const visible = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom).getTime() : null;
    const to = dateTo ? new Date(dateTo).getTime() + 86400000 : null;
    let rows = roleList.filter((a) => {
      const p = a.profile || {};
      if (stateFilter !== 'all' && a.approval_status !== stateFilter) return false;
      const cat = a.category || p.category || p.niche || p.industry || p.industry_category || p.business_type;
      if (categoryFilter !== 'all' && cat !== categoryFilter) return false;
      const subMs = new Date(a.submitted_at || a.created_at || a.createdAt || 0).getTime();
      if (from && subMs < from) return false;
      if (to && subMs > to) return false;
      if (applicationType === 'brands' && gstFilter !== 'all' && gstStatus(p).tone !== gstFilter) return false;
      if (applicationType === 'brands' && flaggedOnly && brandFlags(p, a.email).length === 0) return false;
      if (q) {
        const name = (a.username || a.nickname || p.fullName || p.business_name || '').toLowerCase();
        const email = (a.email || p.business_email || '').toLowerCase();
        // Digits-only so "9406879532" matches a stored "+91 9406879532".
        const phone = phoneOf(a).replace(/\D/g, '');
        const qDigits = q.replace(/\D/g, '');
        const phoneHit = qDigits.length >= 4 && phone.includes(qDigits);
        if (!name.includes(q) && !email.includes(q) && !phoneHit) return false;
      }
      return true;
    });
    rows = rows.sort((a, b) => {
      const am = new Date(a.submitted_at || a.created_at || a.createdAt || 0).getTime();
      const bm = new Date(b.submitted_at || b.created_at || b.createdAt || 0).getTime();
      return sortOrder === 'oldest' ? am - bm : bm - am;
    });
    return rows;
  }, [roleList, stateFilter, categoryFilter, dateFrom, dateTo, gstFilter, flaggedOnly, searchQuery, sortOrder, applicationType]);

  // Tab counts reflect the selected STATE filter (e.g. Approved → only approved profiles); hidden when 0.
  const creatorCount = useMemo(() => applications.filter((a) => isCreatorRole(a.role) && (stateFilter === 'all' || a.approval_status === stateFilter)).length, [applications, stateFilter]);
  const brandCount = useMemo(() => applications.filter((a) => isBrandRole(a.role) && (stateFilter === 'all' || a.approval_status === stateFilter)).length, [applications, stateFilter]);
  const isBrands = applicationType === 'brands';

  if (isPhone) {
    const filters = { stateFilter, categoryFilter, dateFrom, dateTo, gstFilter, flaggedOnly, sortOrder };
    const applyFilters = (f) => {
      setStateFilter(f.stateFilter); setCategoryFilter(f.categoryFilter); setDateFrom(f.dateFrom); setDateTo(f.dateTo);
      setGstFilter(f.gstFilter); setFlaggedOnly(f.flaggedOnly); setSortOrder(f.sortOrder);
    };
    // Advanced (sheet-only) filters that differ from their defaults. Status has its own chips.
    const activeFilters = [categoryFilter !== 'all', dateFrom, dateTo, isBrands && gstFilter !== 'all', isBrands && flaggedOnly, sortOrder !== 'oldest'].filter(Boolean).length;
    const narrowed = searchQuery.trim() || activeFilters > 0;
    const typeWord = isBrands ? 'brand' : 'creator';
    return (
      <div className="am ama-page">
        <div className="am-toolbar">
          <div className="am-search">
            <Search size={18} />
            <input type="search" aria-label="Search applications" placeholder="Search creators or brands..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            {searchQuery && <button type="button" className="am-search-clear" aria-label="Clear search" onClick={() => setSearchQuery('')}><X size={18} /></button>}
          </div>
          <button type="button" className="am-filter-btn" aria-label={`Filters${activeFilters ? ` (${activeFilters} active)` : ''}`} onClick={() => setFilterSheetOpen(true)}>
            <SlidersHorizontal size={20} />
            {activeFilters > 0 && <span className="am-dot">{activeFilters}</span>}
          </button>
        </div>

        {canSeeCreators && canSeeBrands && (
          <div className="am-chips" role="group" aria-label="Applicant type">
            <button type="button" className={`am-chip${!isBrands ? ' is-active' : ''}`} aria-pressed={!isBrands} onClick={() => setApplicationType('creators')}>
              Creators <span className="am-chip-count">{creatorCount}</span>
            </button>
            <button type="button" className={`am-chip${isBrands ? ' is-active' : ''}`} aria-pressed={isBrands} onClick={() => setApplicationType('brands')}>
              Brands <span className="am-chip-count">{brandCount}</span>
            </button>
          </div>
        )}

        <div className="am-chips" role="group" aria-label="Status">
          {Object.entries(STATE_META).map(([key, meta]) => (
            <button type="button" key={key} className={`am-chip${stateFilter === key ? ' is-active' : ''}`} aria-pressed={stateFilter === key}
              onClick={() => setStateFilter(stateFilter === key ? 'all' : key)}>
              {meta.label} <span className="am-chip-count">{counts[key] || 0}</span>
            </button>
          ))}
        </div>

        {loading && applications.length === 0 ? (
          <div className="am-empty" role="status">Loading applications…</div>
        ) : visible.length === 0 ? (
          <div className="am-empty">
            {narrowed ? (
              <>
                <p className="ama-empty-title">No applications match your search or filters.</p>
                <button type="button" className="am-btn am-btn--link" onClick={() => {
                  setSearchQuery('');
                  applyFilters({ ...PHONE_FILTER_DEFAULTS, stateFilter });
                }}>Clear search & filters</button>
              </>
            ) : (
              <p className="ama-empty-title">
                No {stateFilter === 'all' ? '' : `${STATE_META[stateFilter].label.toLowerCase()} `}{typeWord} applications right now.
              </p>
            )}
          </div>
        ) : (
          <div className="am-list">
            {visible.map((a) => {
              const status = STATE_META[a.approval_status] || STATE_META.pending;
              const overdue = slaInfo(appSubmitted(a), nowMs, a.approval_status).label === 'Overdue';
              const name = appName(a);
              return (
                <article className="am-card" key={a.id}>
                  <div className="am-card-head">
                    <PhoneAvatar src={photoOf(a)} name={name} />
                    <div className="am-card-main">
                      <span className="am-card-title">{name}</span>
                      <span className="am-card-sub">{roleLine(a)}</span>
                      <span className="am-card-sub">Submitted {formatDateSafe(appSubmitted(a))}</span>
                    </div>
                  </div>
                  <div className="am-card-foot">
                    <div className="am-badges">
                      <span className={`am-badge am-badge--${STATUS_TONE[a.approval_status] || 'wait'}`}>{status.label}</span>
                      {overdue && <span className="am-badge am-badge--overdue">Overdue</span>}
                    </div>
                    <button type="button" className="am-btn am-btn--primary am-btn--sm" onClick={() => setSelectedProfile(a)} aria-label={`Review ${name}`}>Review</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {filterSheetOpen && (
          <PhoneFilterSheet
            isBrands={isBrands}
            categories={categories}
            values={filters}
            onApply={(f) => { applyFilters(f); setFilterSheetOpen(false); }}
            onClose={() => setFilterSheetOpen(false)}
          />
        )}

        {selectedProfile && (
          <PhoneApplicationDetail
            profile={selectedProfile}
            nowMs={nowMs}
            onBack={() => setSelectedProfile(null)}
            onDecide={handleDecision}
          />
        )}
      </div>
    );
  }

  return (
    <div className="apps-page">
      {selectedProfile && (
        <ProfileDetail profile={selectedProfile} onBack={() => setSelectedProfile(null)} onDecide={handleDecision} />
      )}

      <div className="apps-stats">
        <div className="stat-card"><div className="stat-icon stat-icon-blue"><FileText size={20} /></div><div className="stat-body"><span className="stat-label">Total</span><span className="stat-value">{roleList.length}</span></div></div>
        <div className="stat-card"><div className="stat-icon stat-icon-amber"><Clock size={20} /></div><div className="stat-body"><span className="stat-label">Pending</span><span className="stat-value">{counts.pending}</span></div></div>
        <div className="stat-card"><div className="stat-icon stat-icon-blue"><MessageSquarePlus size={20} /></div><div className="stat-body"><span className="stat-label">More Info</span><span className="stat-value">{counts.more_info}</span></div></div>
        <div className="stat-card"><div className="stat-icon stat-icon-green"><CheckCircle size={20} /></div><div className="stat-body"><span className="stat-label">Approved</span><span className="stat-value">{counts.approved}</span></div></div>
      </div>

      <div className="apps-toolbar">
        <div className="apps-tabs">
          {canSeeCreators && (
            <button className={`apps-tab ${!isBrands ? 'active' : ''}`} onClick={() => setApplicationType('creators')}>
              <Users size={16} /> Creators {creatorCount > 0 && <span className="apps-tab-count">{creatorCount}</span>}
            </button>
          )}
          {canSeeBrands && (
            <button className={`apps-tab ${isBrands ? 'active' : ''}`} onClick={() => setApplicationType('brands')}>
              <Briefcase size={16} /> Brands {brandCount > 0 && <span className="apps-tab-count">{brandCount}</span>}
            </button>
          )}
        </div>
        <div className="apps-controls">
          <div className="apps-search">
            <Search size={16} />
            <input type="text" placeholder={`Search ${isBrands ? 'brands' : 'creators'} or phone…`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Filters bar */}
      <div className="apps-filters">
        <label>State
          <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="more_info">More Info</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
        <label>Category
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">All</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        {isBrands ? (
          <>
            <label>GST
              <select value={gstFilter} onChange={(e) => setGstFilter(e.target.value)}>
                <option value="all">All</option>
                <option value="green">Valid</option>
                <option value="yellow">Unverified</option>
                <option value="red">Missing</option>
              </select>
            </label>
            <label className="apps-check-inline"><input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} /> Flagged only</label>
          </>
        ) : (
          <>
            <label>From<input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></label>
            <label>To<input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></label>
          </>
        )}
        <label>Sort
          <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
            <option value="oldest">Oldest first</option>
            <option value="newest">Newest first</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div className="apps-skeleton-list">{[...Array(5)].map((_, i) => <div key={i} className="apps-skeleton-row" />)}</div>
      ) : visible.length === 0 ? (
        <div className="apps-empty">
          <CheckCircle size={56} />
          <h3>No {isBrands ? 'brand' : 'creator'} applications</h3>
          <p>Try a different State filter, or new submissions will appear here.</p>
        </div>
      ) : (
        <div className="apps-list">
          {visible.map((profile) => (
            <ApplicationRow key={profile.id} profile={profile} nowMs={nowMs}
              onOpen={setSelectedProfile}
              onApprove={(id) => handleDecision(id, 'approve')}
              onReject={(id) => setSelectedProfile(profile)} />
          ))}
        </div>
      )}
    </div>
  );
}

export default ApplicationsPage;
