import { useState, useEffect, useMemo, useCallback } from 'react';
import { CheckCircle, Search, Users, Briefcase, FileText, Clock, Eye, PlayCircle, X, ShieldCheck, Globe, AlertTriangle, MessageSquarePlus, XCircle, Link2 } from 'lucide-react';

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
import axios from 'axios';
import { toast } from 'sonner';
import { useAuth } from '../App';
import '../styles/ApplicationsPage.css';

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
  if (typeof v === 'string') push(v);
  else if (Array.isArray(v)) v.forEach((item) => {
    if (typeof item === 'string') push(item);
    else if (item && typeof item === 'object') push(item.url || item.file_url || item.src || item.video || item.video_url || item.image || item.image_url);
  });
  else if (v && typeof v === 'object') push(v.url || v.file_url || v.src);
  return out;
};

const prettifyKey = (k) => String(k).replace(/_/g, ' ').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/\b\w/g, (c) => c.toUpperCase());
const isEmptyVal = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0);
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
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
};

// SLA — target turnaround for review (48h). Oldest applications go urgent/overdue.
const SLA_TARGET_HOURS = 48;
const slaInfo = (submitted, nowMs) => {
  if (!submitted) return { label: '—', urgent: false };
  const t = new Date(submitted).getTime();
  if (Number.isNaN(t)) return { label: '—', urgent: false };
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
  creators: ['Add 3–5 clear portfolio samples', 'Upload valid KYC (PAN / Aadhaar / selfie)', 'Verify social handles', 'Re-record a higher-quality intro video', 'Confirm category / niche', 'Confirm location'],
  brands: ['Provide valid GST details', 'Verify business website', 'Use a work-domain business email', 'Clarify product category', 'Verify social media links'],
};

// ===========================================================================
// Row — one application in the list (role-aware columns)
// ===========================================================================
function ApplicationRow({ profile, nowMs, onOpen, onApprove, onReject }) {
  const p = profile.profile || {};
  const brand = isBrandRole(profile.role);
  // Show the applicant's REAL name for review (not their @username/id) — the
  // reviewer verifies a real person/business; the public id comes after approval.
  const realName = brand ? (p.business_name || p.businessName) : (p.fullName || p.full_name);
  const displayName = (realName && String(realName).trim()) || profile.nickname || (profile.username ? `@${profile.username}` : '—');
  const email = profile.email || p.business_email || '—';
  const category = profile.category || p.category || p.niche || p.industry || p.industry_category || p.business_type || '—';
  const submitted = profile.submitted_at || profile.created_at || profile.createdAt || p.created_at;
  const sla = slaInfo(submitted, nowMs);
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
        ['Category', category],
        ['GST', gstStatus(p).label],
        ['Submitted', formatDateSafe(submitted)],
      ]
    : [
        ['Category', category],
        ['Languages', [].concat(p.languages || p.language || []).filter(Boolean).join(', ') || '—'],
        ['Location', p.location || p.country || p.city || '—'],
        ['Submitted', formatDateSafe(submitted)],
      ];

  return (
    <div className="apps-row apps-row--request" onClick={() => onOpen(profile)}>
      <div className="apps-row-identity">
        <div className="apps-avatar" style={{ background: avatarColor(displayName) }}>
          {displayName.replace(/^@/, '').slice(0, 2).toUpperCase()}
        </div>
        <div className="apps-name-block">
          <h4 title={flagName ? 'Handle looks like a real name — verify' : undefined}>
            {displayName}
            {flagName && <AlertTriangle size={13} className="apps-name-flag" />}
          </h4>
          <div className="apps-chip-row">
            <span className="apps-role-pill">{brand ? 'Brand' : 'Creator'}</span>
            <span className={`apps-state apps-state-${state.cls}`}>{state.label}</span>
          </div>
        </div>
      </div>

      <div className="apps-row-meta">
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
function ProfileDetail({ profile, onBack, onDecide }) {
  const [full, setFull] = useState(profile);
  const [loadingFull, setLoadingFull] = useState(true);
  const [mode, setMode] = useState(null);             // null | 'more_info' | 'reject'
  // Auto-scroll the reveal panel into view when Request More Info / Reject is clicked.
  const scrollToBuilder = useCallback((el) => {
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);
  const [reasonCode, setReasonCode] = useState('');
  const [reasonDetails, setReasonDetails] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [infoItems, setInfoItems] = useState([]);

  useEffect(() => {
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
  Object.entries(flat).forEach(([k, v]) => {
    collectUrls(v).forEach((u) => {
      if (KEY_IS_KYC.test(k)) kyc.push({ k, u });
      else if (KEY_IS_VIDEO.test(k) || VIDEO_EXT.test(u)) videos.push(u);
      else if (KEY_IS_IMAGE.test(k) || IMAGE_EXT.test(u) || /portfolio/i.test(k)) (VIDEO_EXT.test(u) ? videos : photos).push(u);
    });
  });
  const uniq = (a) => [...new Set(a)];
  const photoList = uniq(photos);
  const videoList = uniq(videos);
  const mainPhoto = photoList[0];
  const portfolioPhotos = photoList.slice(1);

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
  const displayName = (realName && String(realName).trim()) || full.nickname || profile.nickname || (uname ? `@${uname}` : '—');
  const headerEmail = full.email || p.business_email || profile.email;
  const flagName = !brand && looksLikeRealName(uname || '');
  const gst = gstStatus(p);
  const flags = brand ? brandFlags(p, headerEmail) : [];
  const website = brand ? (p.website || p.website_url) : null;
  const review = full.review || {};

  // text fields excluding media/kyc/social
  const entries = Object.entries(flat).filter(([k, v]) => !MEDIA_OR_META(k) && !isEmptyVal(v));
  function MEDIA_OR_META(k) {
    return ['id', '_id', 'user_id', 'userId', 'password', '__v', 'token', 'approval_status', 'role', 'email', 'username', 'nickname', 'profile_completed', 'terms_agreed', 'review', 'submitted_at', 'created_at', 'updatedAt', 'createdAt', 'show_followers', 'showFollowers'].includes(k)
      || KEY_IS_MEDIA.test(k) || KEY_IS_KYC.test(k) || KEY_IS_SOCIAL.test(k);
  }

  const decide = (action, payload) => { onDecide(profile.id, action, payload); onBack(); };
  const decided = ['approved', 'rejected'].includes(full?.approval_status);
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
          </div>
        </div>

        <div className="apps-modal-body">
          {review && (review.reason_code || review.more_info_message) && (
            <div className="apps-review-note">
              {review.reason_code && <p><strong>Rejection:</strong> {review.reason_code}{review.reason_details ? ` — ${review.reason_details}` : ''}</p>}
              {review.more_info_message && <p><strong>Info requested:</strong> {review.more_info_message}</p>}
            </div>
          )}

          {/* Portfolio + video (creator) */}
          {(videoList.length > 0 || portfolioPhotos.length > 0) && (
            <section className="detail-section full-width">
              <h3><PlayCircle size={16} className="apps-h3-ic" />{brand ? 'Media' : 'Portfolio & Video'} <span className="apps-h3-note">full resolution · no watermark</span></h3>
              <div className="apps-modal-media">
                {videoList.map((u, i) => (
                  <video key={`v${i}`} src={resolveUrl(u)} controls preload="metadata" style={{ width: '100%', borderRadius: 10, background: '#000', aspectRatio: '16 / 9' }} />
                ))}
                {portfolioPhotos.map((u, i) => (
                  <a key={`p${i}`} href={resolveUrl(u)} target="_blank" rel="noopener noreferrer" style={{ display: 'block' }}><img src={resolveUrl(u)} alt="" style={{ width: '100%', height: 'auto', borderRadius: 10, objectFit: 'contain', background: '#f2f4f7', display: 'block' }} /></a>
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
              <h3><XCircle size={16} className="apps-h3-ic" />Reject — reason</h3>
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
                This profile is already {(STATE_META[full.approval_status] || {}).label || full.approval_status} — no further action needed.
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
  const nowMs = useMemo(() => Date.now(), [applications]);

  useEffect(() => { fetchApplications(); }, []);

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
    } catch {
      toast.error('Action failed');
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
        if (!name.includes(q) && !email.includes(q)) return false;
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
  const matchesState = (a) => stateFilter === 'all' || a.approval_status === stateFilter;
  const creatorCount = useMemo(() => applications.filter((a) => isCreatorRole(a.role) && matchesState(a)).length, [applications, stateFilter]);
  const brandCount = useMemo(() => applications.filter((a) => isBrandRole(a.role) && matchesState(a)).length, [applications, stateFilter]);
  const isBrands = applicationType === 'brands';

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
            <input type="text" placeholder={`Search ${isBrands ? 'brands' : 'creators'}…`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
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
