import { useLiveEffect } from '../lib/liveUpdates';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { createPortal } from 'react-dom';
import { Play, X, Star, VideoOff, BadgeCheck, Bookmark, MessageSquare, Heart, ChevronDown, Check, TrendingUp, Crown } from 'lucide-react';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import ChatPopup from '../components/ChatPopup';
import { matchesCreatorSearch } from '../utils/creatorSearch';
import '../styles/creator-marketplace.css';
import '../styles/brand-mobile.css';
import '../styles/brand-ui.css';
import EmptyState from '../components/EmptyState';
import BrandNoResults from './BrandNoResults';
import { Skeleton } from '../components/Skeleton';
import { creatorFirstName } from '../utils/displayName';
import { toggleSavedCreator, useSavedCreatorIds } from '../utils/savedCreators';
import { toast } from 'sonner';
import { s3Preview } from '../utils/mediaPreview';
import PhotoOrInitial from '../components/PhotoOrInitial';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const assetUrl = (u) => (!u ? '' : (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}/${String(u).replace(/^\//, '')}`));
// The directory has shipped with a few response envelopes across backend versions.
// Treat each supported envelope as the same creator list so a valid response never
// becomes the misleading "No creators found" state.
const creatorListFrom = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  for (const key of ['creators', 'items', 'results', 'data']) {
    if (Array.isArray(payload[key])) return payload[key];
    if (payload[key] && typeof payload[key] === 'object') {
      const nested = creatorListFrom(payload[key]);
      if (nested.length) return nested;
    }
  }
  return [];
};
const isVideo = (u) => {
  const value = String(u || '');
  const path = value.split(/[?#]/, 1)[0];
  if (/\.(jpe?g|png|gif|webp|avif|svg|bmp|heic)$/i.test(path)) return false;
  return /\.(mp4|webm|mov|m4v|avi|mkv|3gp)$/i.test(path) || /\/video\/upload\//i.test(path);
};
// Portfolio items may be plain URL strings or rich objects ({ urls, videoUrl, ... }).
const pfUrl = (it) => {
  if (!it) return '';
  if (typeof it === 'string') return it;
  return it.video_url || it.videoUrl || it.link || it.original_url ||
    (Array.isArray(it.urls) && it.urls.find(isVideo)) ||
    it.url || (typeof it.video === 'string' && /^(https?:\/\/|\/)/i.test(it.video) ? it.video : '') || '';
};
const creatorVideoUrl = (creator) => {
  if (creator?.portfolio_video && playable(creator.portfolio_video)) return creator.portfolio_video;
  const clips = (Array.isArray(creator?.portfolio) ? creator.portfolio : [])
    .map(pfUrl)
    .filter((url) => url && (isVideo(url) || playable(url)));
  if (clips.length) return clips[0];
  const preview = creator?.portfolio_preview;
  return preview && isVideo(preview) ? preview : '';
};
const videoPoster = (url) => s3Preview(url, 'jpg') || cloudinaryPoster(url);
const cloudinaryPoster = (url) => {
  const match = String(url || '').match(
    /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/video\/upload\/)(.*)$/i,
  );
  if (!match) return '';
  const rest = match[2].replace(
    /\.(mp4|mov|webm|m4v|avi|mkv|3gp)(\?.*)?$/i,
    '.jpg',
  );
  return `${match[1]}so_0/${rest}`;
};
// The small clip for hover/inline play; full-size playback keeps the original.
const previewVideoUrl = (url) => s3Preview(url, 'mp4') || browserCompatibleVideoUrl(url);
const browserCompatibleVideoUrl = (url) => {
  const media = assetUrl(url);
  if (!/^https?:\/\/res\.cloudinary\.com\//i.test(media) ||
      !/\/video\/upload\//i.test(media) ||
      /\/video\/upload\/f_mp4,vc_h264,/i.test(media)) return media;
  return media.replace(
    '/video/upload/',
    '/video/upload/f_mp4,vc_h264,q_auto:good,h_480,c_scale,ac_none,du_2/',
  );
};
// Anything we can hand to a <video>: a known clip extension, or an extensionless /
// CDN URL (signed links often carry no suffix). Images and blob: URLs are out.
const playable = (u) => {
  const s = String(u || '');
  if (!s || s.startsWith('blob:')) return false;
  const path = s.split('?')[0];
  if (/\.(jpe?g|png|gif|webp|avif|svg|bmp|heic)$/i.test(path)) return false;
  return true;
};
// Brands never see a creator's real name/username — show the brand-facing handle
// (nickname), falling back to the public creator ID rather than a bare "Creator".
const nameOf = (c) => creatorFirstName(c);
const initialOf = (c) => (nameOf(c).replace('@', '').charAt(0) || 'C').toUpperCase();
const catOf = (c) => (c.primary_category || c.category || c.niche || 'UGC').replace(/_/g, ' ');
// Every category the creator picked (the API's `categories`), lowercased, so a
// multi-category creator shows under each tab instead of only their first.
const catsOf = (c) => (c.categories?.length ? c.categories : [c.primary_category])
  .map((v) => String(v || '').trim().toLowerCase()).filter(Boolean);
const catClass = (cat) => {
  const s = String(cat || '').toLowerCase();
  if (/beauty|skin|makeup|cosmet/.test(s)) return 'c-beauty';
  if (/tech|gadget|electronic/.test(s)) return 'c-tech';
  if (/fashion|apparel|cloth|style|jewel/.test(s)) return 'c-fashion';
  if (/life ?style|home|decor/.test(s)) return 'c-lifestyle';
  if (/food|snack|beverage|drink|cook/.test(s)) return 'c-food';
  if (/fit|gym|health|wellness|yoga/.test(s)) return 'c-fitness';
  if (/travel|trip|tour/.test(s)) return 'c-travel';
  return 'c-default';
};

// Per-creator rate: their set rate (formatted) or a stable level-based price.
const priceTextOf = (c) => {
  const raw = String(c.budget_range || c.price || c.rate || c.expected_payout || (c.rate_card || {}).expected_payout || '').trim();
  if (raw) {
    if (/[a-zA-Z₹]/.test(raw) || raw.includes('-')) return raw;
    const num = raw.replace(/[^0-9]/g, '');
    if (num) return `Rs. ${Number(num).toLocaleString('en-IN')} / video`;
  }
  // No real rate set by the creator — don't fabricate a price.
  return 'Rate on request';
};

// All of a creator's categories in the space one chip used to take: swipe it by
// hand, and it steps to the next chip on its own while they don't all fit.
const CAT_STEP_MS = 2500;
function CategoryChips({ c, chipClass, railClass }) {
  const ref = useRef(null);
  const paused = useRef(false);
  const cats = catsOf(c).map((v) => v.replace(/_/g, ' '));
  const list = cats.length ? cats : [catOf(c)];
  useEffect(() => {
    const el = ref.current;
    if (!el || list.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const id = setInterval(() => {
      if (paused.current || el.scrollWidth <= el.clientWidth + 1) return;
      const chips = Array.from(el.children);
      const next = chips.find((chip) => chip.offsetLeft > el.scrollLeft + 1);
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1;
      el.scrollTo({ left: atEnd || !next ? 0 : next.offsetLeft, behavior: 'smooth' });
    }, CAT_STEP_MS);
    return () => clearInterval(id);
  }, [list.length]);
  const hold = () => { paused.current = true; };
  const release = () => { setTimeout(() => { paused.current = false; }, CAT_STEP_MS); };
  return (
    <span
      ref={ref}
      className={`cat-rail ${railClass || ''}`}
      onMouseEnter={hold} onMouseLeave={release}
      onTouchStart={hold} onTouchEnd={release}
      aria-label={`Categories: ${list.join(', ')}`}
    >
      {list.map((cat) => <span key={cat} className={`${chipClass} ${catClass(cat)}`}>{cat}</span>)}
    </span>
  );
}

// Quick-preview card: a peek at a creator (big video + a few details). Hovering a
// "Recent work" thumbnail plays that clip on the big left screen.
function QuickPreview({ c, onClose, onMessage, onFull, onExpand }) {
  const name = nameOf(c).replace('@', '');
  const category = catOf(c);
  const media = previewVideoUrl(creatorVideoUrl(c));
  // Real uploaded clips only — never stock fallbacks. Portfolio items arrive as
  // plain URLs or as rich objects, so unwrap both before rendering.
  const realClips = (Array.isArray(c.portfolio) ? c.portfolio : [])
    .map(pfUrl)
    .filter((u) => u && (isVideo(u) || playable(u)));
  const previewClip = (media && playable(media))
    ? media
    : (realClips[0] ? previewVideoUrl(realClips[0]) : '');
  const hasVideo = !!previewClip;
  const baseVid = hasVideo ? `${previewClip}#t=0.5` : '';
  const clips = realClips.length ? realClips : (previewClip ? [creatorVideoUrl(c)] : []);
  const thumbs = Array.from(new Set(clips)).slice(0, 6);
  const rating = c.avg_rating || c.rating;
  const [bigVid, setBigVid] = useState(baseVid);
  const [bigPlaying, setBigPlaying] = useState(false);
  const bigRef = useRef(null);
  const thumbsRef = useRef(null); // Recent-work row (mobile auto-scroll)
  const saved = useSavedCreatorIds().has(String(c.id));
  // Keep the large preview idle until hover; on phones, tap a recent-work thumb.
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 560px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 560px)');
    const on = () => setIsMobile(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  // Mobile: two Recent-work thumbs per row; more than two gently auto-scrolls the
  // strip so the rest are discoverable. Pauses whenever the user touches/scrolls it.
  useEffect(() => {
    const el = thumbsRef.current;
    if (!el) return;
    if (!window.matchMedia('(max-width: 560px)').matches || thumbs.length <= 2) return;
    let raf, dir = 1, paused = false, resumeTimer, pos = el.scrollLeft;
    const step = () => {
      const max = el.scrollWidth - el.clientWidth;
      if (!paused && max > 0) {
        pos += dir * 0.4; // ~24px/sec — "a bit slow"
        if (pos >= max) { pos = max; dir = -1; }
        else if (pos <= 0) { pos = 0; dir = 1; }
        el.scrollLeft = pos;
      }
      raf = requestAnimationFrame(step);
    };
    const pause = () => {
      paused = true;
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => { pos = el.scrollLeft; paused = false; }, 2500);
    };
    raf = requestAnimationFrame(step);
    el.addEventListener('pointerdown', pause);
    el.addEventListener('touchstart', pause, { passive: true });
    el.addEventListener('wheel', pause, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(resumeTimer);
      el.removeEventListener('pointerdown', pause);
      el.removeEventListener('touchstart', pause);
      el.removeEventListener('wheel', pause);
    };
  }, [thumbs.length, isMobile]);

  const toggleSave = async () => {
    const was = saved;
    const now = await toggleSavedCreator({ id: c.id });
    if (now !== was) toast.success(now ? 'Creator saved to your list' : 'Removed from saved');
  };

  useEffect(() => {
    const video = bigRef.current;
    if (!video) return;
    if (bigPlaying) video.play().catch(() => setBigPlaying(false));
    else video.pause();
  }, [bigVid, bigPlaying]);

  const previewBigVideo = (src) => {
    setBigVid(src);
    setBigPlaying(true);
  };
  const stopBigVideo = () => {
    setBigPlaying(false);
    setBigVid(baseVid);
  };
  const bigVideoOriginal = [...realClips, creatorVideoUrl(c)].find(
    (clip) => clip && [previewVideoUrl(clip), browserCompatibleVideoUrl(clip)].includes(bigVid.split('#')[0]),
  ) || creatorVideoUrl(c) || realClips[0] || '';
  const bigPoster = videoPoster(bigVideoOriginal);
  // No small clip yet (just uploaded): play the original instead of a black box.
  const bigFallback = () => {
    const original = `${browserCompatibleVideoUrl(bigVideoOriginal)}#t=0.5`;
    if (bigVideoOriginal && original !== bigVid) setBigVid(original);
  };

  return createPortal(
    <div className="bcq-overlay" onClick={onClose}>
      <div className="bcq-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="bcq-close" aria-label="Close" onClick={onClose}><X size={18} /></button>
        {!isMobile && (
          <div className="bcq-video" onMouseEnter={() => setBigPlaying(true)} onMouseLeave={stopBigVideo}>
            {hasVideo ? (
              <video
                key={bigVid}
                ref={bigRef}
                src={`${bigVid.split('#')[0]}#t=0.1`}
                poster={bigPoster || undefined}
                onError={bigFallback}
                muted
                loop
                playsInline
                preload="none"
              />
            ) : (
              <div className="bc-novideo"><VideoOff size={30} /><span>No video yet</span></div>
            )}
          </div>
        )}
        <div className="bcq-body">
          <div className="bcq-head">
            <span className="bcq-ava"><PhotoOrInitial src={assetUrl(c.profile_photo)} initial={initialOf(c)} /></span>
            <div className="bcq-id">
              <div className="bcq-name-row">
                <strong>{name}</strong>
                <button type="button" className={`bcq-save ${saved ? 'is-saved' : ''}`} onClick={toggleSave} aria-label={saved ? 'Saved' : 'Save creator'} title={saved ? 'Saved' : 'Save creator'}>
                  <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} />
                </button>
              </div>
              <CategoryChips c={c} chipClass="bcq-cat" railClass="cat-rail-quick" />
            </div>
          </div>
          <p className="bcq-bio">{c.bio || c.description || `${category} creator crafting scroll-stopping UGC for brands. Authentic, on-brief, and delivered fast.`}</p>
          <div className="bcq-facts">
            <div><label>Price</label><strong>{priceTextOf(c)}</strong></div>
            <div><label>Rating</label><strong>{rating ? `★ ${Number(rating).toFixed(1)}` : 'New'}</strong></div>
            <div><label>Deliverables</label><strong>{c.deliverables_completed || 0}</strong></div>
            <div><label>Location</label><strong>{c.city_tier || c.location_region || 'India'}</strong></div>
          </div>
          {thumbs.length > 0 && (
            <div className="bcq-work">
              <label>Recent work {!isMobile && <small>· hover to preview</small>}</label>
              <div className="bcq-thumbs" ref={thumbsRef}>
                {thumbs.map((tv, k) => {
                  const src = `${previewVideoUrl(tv)}#t=0.5`;
                  const poster = videoPoster(tv);
                  return (
                    <button
                      type="button"
                      key={k}
                      className={`bcq-thumb ${bigVid === src ? 'on' : ''}`}
                      onMouseEnter={isMobile ? undefined : () => previewBigVideo(src)}
                      onMouseLeave={isMobile ? undefined : stopBigVideo}
                      onClick={() => onExpand({ src: browserCompatibleVideoUrl(tv), name })}
                    >
                      {poster ? (
                        <img src={poster} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
                      ) : (
                        <span className="bcq-thumb-empty">
                          <Play size={18} fill="currentColor" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="bcq-actions">
            <button type="button" className="bcq-ghost" onClick={onMessage}>Message</button>
            <button type="button" className="bcq-primary" onClick={onFull}>View full details</button>
          </div>
        </div>
      </div>
    </div>, document.body,
  );
}

// ───────────────────────── GigCard (design board 03) ─────────────────────────
const CATEGORY_ALIASES = {
  'food & drinks': ['food', 'drink', 'beverage'],
  'tech & gadgets': ['tech', 'gadget', 'electronic'],
  skincare: ['skin', 'beauty'],
  apps: ['app'],
  pets: ['pet'],
};
const matchesCategory = (cats, label) => {
  const key = String(label || '').toLowerCase();
  const tokens = CATEGORY_ALIASES[key] || [key];
  return cats.some((cat) => tokens.some((t) => cat.includes(t)));
};
const titleCase = (v) => String(v || '').replace(/_/g, ' ').replace(/^./, (m) => m.toUpperCase());
const budgetOf = (c) => {
  const raw = c.budget_range || c.price || c.rate || c.expected_payout || (c.rate_card || {}).expected_payout || '';
  const n = parseInt(String(raw).replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const LEVEL_BADGE = { new: 'New', verified: 'Verified', l1: 'Level 1', l2: 'Level 2', elite: 'Elite' };
const LEVEL_RANK = { new: 0, verified: 0, l1: 1, l2: 2, elite: 3 };
// Delivery time in days. The directory does not return it yet (backend creator_directory_public_view
// needs a `delivery_days` field); this reads it as soon as it appears and is null (nothing shown) until then.
export const deliveryDaysOf = (c) => {
  const n = Math.round(Number(c.delivery_days ?? c.turnaround_days ?? c.profile?.delivery_days ?? c.profile?.rate_card?.delivery_days));
  return n > 0 ? n : null;
};
const fmtDuration = (s) => (Number.isFinite(s) && s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '');

const BUDGET_OPTIONS = [
  { key: 'any', label: 'Any', test: () => true },
  { key: 'u3', label: 'Under ₹3,000', test: (n) => n > 0 && n < 3000 },
  { key: '3-6', label: '₹3,000–6,000', test: (n) => n >= 3000 && n < 6000 },
  { key: '6-10', label: '₹6,000–10,000', test: (n) => n >= 6000 && n < 10000 },
  { key: '10+', label: '₹10,000+', test: (n) => n >= 10000 },
];
const DETAIL_OPTIONS = [
  { key: 'any', label: 'Any', test: () => true },
  { key: 'verified', label: 'Verified', test: (c) => !!c.kyc_verified },
  { key: 'l1', label: 'Level 1+', test: (c) => (LEVEL_RANK[String(c.level).toLowerCase()] || 0) >= 1 },
  { key: 'l2', label: 'Level 2+', test: (c) => (LEVEL_RANK[String(c.level).toLowerCase()] || 0) >= 2 },
  { key: 'elite', label: 'Elite', test: (c) => String(c.level).toLowerCase() === 'elite' },
  { key: 'choice', label: 'UGCAD.IO Choice', test: (c) => !!c.ugcad_approved },
];

// Shared by the creator cards: first-frame buffering, hover-to-play, duration, expand.
function useCardVideo(c, onExpand, name) {
  const vref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState('');
  const [clipFailed, setClipFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const originalVideo = creatorVideoUrl(c);
  const media = clipFailed ? browserCompatibleVideoUrl(originalVideo) : previewVideoUrl(originalVideo);
  const hasVideo = !!(media && isVideo(media));
  const poster = posterFailed ? '' : videoPoster(originalVideo);
  useEffect(() => { setPosterFailed(false); setClipFailed(false); }, [originalVideo]);

  // Buffer the first frame once the card scrolls near the viewport (no autoplay).
  useEffect(() => {
    const video = vref.current;
    if (!video || !hasVideo) return undefined;
    const load = () => { video.preload = 'auto'; video.load(); };
    if (typeof IntersectionObserver === 'undefined') { load(); return undefined; }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      load();
      observer.disconnect();
    }, { rootMargin: '150px' });
    observer.observe(video);
    return () => observer.disconnect();
  }, [media, hasVideo]);

  const hoverPlay = () => {
    const video = vref.current;
    if (!video || !window.matchMedia('(hover: hover)').matches) return;
    document.querySelectorAll('.bui-vid').forEach((o) => { if (o !== video) o.pause(); });
    video.muted = true;
    video.play().then(() => setPlaying(true)).catch(() => {});
  };
  const hoverPause = () => {
    const video = vref.current;
    if (!video || !window.matchMedia('(hover: hover)').matches) return;
    video.pause();
    setPlaying(false);
  };
  const togglePlay = () => {
    const video = vref.current;
    if (!video) return;
    if (video.paused) video.play().then(() => setPlaying(true)).catch(() => {});
    else { video.pause(); setPlaying(false); }
  };
  const expand = (e) => {
    e.stopPropagation();
    if (vref.current) { vref.current.pause(); setPlaying(false); }
    onExpand?.({ src: browserCompatibleVideoUrl(originalVideo), name });
  };
  const videoEl = hasVideo ? (
    <>
      <video
        ref={vref}
        className="bui-vid"
        src={`${media}#t=0.5`}
        poster={poster || undefined}
        onError={() => setClipFailed(true)}
        muted
        loop
        playsInline
        preload="none"
        onLoadedMetadata={(e) => setDuration(fmtDuration(e.currentTarget.duration))}
        onPlaying={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onClick={togglePlay}
      />
      {!playing && poster && <img src={poster} alt="" aria-hidden="true" onError={() => setPosterFailed(true)} />}
    </>
  ) : (
    <div className="bui-gig-novideo"><VideoOff size={24} /><span>No video yet</span></div>
  );
  return { hasVideo, videoEl, duration, hoverPlay, hoverPause, expand };
}

// Level → badge (design board 01). UGCAD.IO Choice outranks the creator's level.
const REEL_BADGE = {
  choice: 'UGCAD.IO Choice', elite: 'Elite', l2: 'Level 2', l1: 'Level 1', verified: 'Verified', new: 'New',
};
const reelBadgeKey = (c) => {
  if (c.ugcad_approved) return 'choice';
  const k = String(c.level || '').toLowerCase();
  return REEL_BADGE[k] ? k : 'new';
};
const BadgeIcon = ({ kind }) => {
  if (kind === 'verified') return <Check size={11} strokeWidth={3} color="#4E60E6" />;
  if (kind === 'l1') return <TrendingUp size={11} color="#4E60E6" />;
  if (kind === 'l2') return <Star size={11} fill="#07074E" />;
  if (kind === 'elite') return <Crown size={11} fill="#7387FF" color="#7387FF" />;
  if (kind === 'choice') return <span className="bui-badge-mark" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/ugcad-logo.png)` }} aria-hidden="true" />;
  return null;
};

// 9:16 creator card used on Home, Saved creators and No-results (design boards 01 / 12 / 30).
// `cloneStart` is kept for the callers that still pass it.
export function ReelCard({ c, onView, onMessage, onExpand, cloneStart }) {
  const navigate = useNavigate();
  const name = nameOf(c).replace('@', '');
  const { hasVideo, videoEl, duration, hoverPlay, hoverPause, expand } = useCardVideo(c, onExpand, name);
  const saved = useSavedCreatorIds().has(String(c.id));
  const badge = reelBadgeKey(c);
  const rating = Number(c.avg_rating || c.rating || 0);
  const reviews = Number(c.review_count || 0);
  const price = budgetOf(c);
  const days = deliveryDaysOf(c);

  return (
    <article className="bui-reel"data-clone-start={cloneStart ? 'true' : undefined}>
      <div className="bui-reel-media" onMouseEnter={hasVideo ? hoverPlay : undefined} onMouseLeave={hasVideo ? hoverPause : undefined}>
        {videoEl}
        <div className="bui-reel-bars" aria-hidden="true"><span className="on" /><span /><span /></div>
        <div className="bui-reel-top">
          <span className={`bui-badge bui-badge--${badge}`}>
            <BadgeIcon kind={badge} />
            <span>{REEL_BADGE[badge]}</span>
          </span>
          <button
            type="button"
            className="bui-reel-save"
            aria-label={saved ? `Remove ${name} from saved` : `Save ${name}`}
            onClick={async (e) => {
              e.stopPropagation();
              const now = await toggleSavedCreator({ id: c.id });
              toast.success(now ? 'Saved to your creators' : 'Removed from saved');
            }}
          >
            <Heart size={15} fill={saved ? 'currentColor' : 'none'} />
          </button>
        </div>
        {hasVideo && duration && (
          <button type="button" className="bui-reel-dur" aria-label="Expand video" onClick={expand}>
            <Play size={9} fill="currentColor" />{duration}
          </button>
        )}
        <button type="button" className="bui-reel-glass" onClick={() => onView(c)}>
          <span className="bui-reel-ava"><PhotoOrInitial src={assetUrl(c.profile_photo)} initial={initialOf(c)} /></span>
          <span className="bui-reel-who">
            <span className="bui-reel-name">{name}{c.kyc_verified && <BadgeCheck size={14} color="#4E60E6" aria-label="Identity verified" />}</span>
            <span className="bui-reel-meta">
              {rating > 0 && reviews > 0 ? (<><Star size={12} fill="#07074E" color="#07074E" /><strong>{rating.toFixed(1)}</strong><span>({reviews})</span></>) : null}
              {!(rating > 0 && reviews > 0) && <span>New on UGCad</span>}
              {days && <span className="bui-reel-deliv">· {days}-day delivery</span>}
            </span>
          </span>
        </button>
      </div>
      <div className="bui-reel-foot">
        <div className="bui-reel-price">
          <small>From</small>
          <b>{price ? inr(price) : 'On request'}{price ? <span> / video</span> : null}</b>
        </div>
        <button
          type="button"
          className="bui-reel-msg"
          aria-label={`Message ${name}`}
          onClick={() => (onMessage ? onMessage(c) : navigate('/messages'))}
        >
          <MessageSquare size={16} />
        </button>
        <button type="button" className="bui-reel-invite" onClick={() => navigate(`/dashboard/business/creator/${c.id}`)}>Invite</button>
      </div>
    </article>
  );
}

// One creator as a "gig" card: sample video, creator line, headline, rating, price + Invite (board 03).
export function GigCard({ c, onView, onExpand }) {
  const navigate = useNavigate();
  const name = nameOf(c).replace('@', '');
  const { hasVideo, videoEl, duration, hoverPlay, hoverPause, expand } = useCardVideo(c, onExpand, name);
  const saved = useSavedCreatorIds().has(String(c.id));
  const levelKey = LEVEL_BADGE[String(c.level || '').toLowerCase()] ? String(c.level).toLowerCase() : 'new';
  const rating = Number(c.avg_rating || c.rating || 0);
  const reviews = Number(c.review_count || 0);
  const price = budgetOf(c);
  const days = deliveryDaysOf(c);
  const headline =c.gig_title || c.headline || [titleCase(c.content_style), titleCase(catOf(c))].filter(Boolean).join(' · ');

  return (
    <article className="bui-gig">
      <div className="bui-gig-media" onMouseEnter={hasVideo ? hoverPlay : undefined} onMouseLeave={hasVideo ? hoverPause : undefined}>
        {videoEl}
        <button
          type="button"
          className="bui-gig-save"
          aria-label={saved ? `Remove ${name} from saved` : `Save ${name}`}
          onClick={async (e) => {
            e.stopPropagation();
            const now = await toggleSavedCreator({ id: c.id });
            toast.success(now ? 'Saved to your creators' : 'Removed from saved');
          }}
        >
          <Heart size={16} fill={saved ? 'currentColor' : 'none'} />
        </button>
        {hasVideo && (
          <button type="button" className="bui-gig-dur" aria-label="Expand video" onClick={expand}>
            <Play size={10} fill="currentColor" />
            {duration}
          </button>
        )}
      </div>

      <button type="button" className="bui-gig-who" onClick={() => onView(c)}>
        <span className="bui-gig-ava"><PhotoOrInitial src={assetUrl(c.profile_photo)} initial={initialOf(c)} /></span>
        <span className="bui-gig-name">{name}</span>
        {c.kyc_verified && <BadgeCheck size={14} className="bui-gig-kyc" aria-label="Identity verified" />}
        <span className={`bui-lvl bui-lvl--${levelKey}`}>{LEVEL_BADGE[levelKey]}</span>
      </button>

      <button type="button" className="bui-gig-title" onClick={() => onView(c)}>{headline}</button>

      <div className="bui-gig-rate">
        {rating > 0 && reviews > 0 ? (
          <>
            <Star size={14} fill="currentColor" />
            <strong>{rating.toFixed(1)}</strong>
            <span>({reviews})</span>
          </>
        ) : (
          <span>No reviews yet</span>
        )}
        {days && <span className="bui-gig-deliv">· {days}-day delivery</span>}
      </div>

      <div className="bui-gig-foot">
        <span className="bui-gig-price">{price ? `From ${inr(price)}` : 'Rate on request'}</span>
        <button type="button" className="bui-gig-invite" onClick={() => navigate(`/dashboard/business/creator/${c.id}`)}>Invite</button>
      </div>
    </article>
  );
}

// ───────────────────────── Filter pop-up (design board 03) ─────────────────────────
function FilterModal({ title, options, value, onPick, onClear, onClose }) {
  return createPortal(
    <div className="bui-modal-ov" onClick={onClose}>
      <div className="bui-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="bui-modal-x" aria-label="Close" onClick={onClose}><X size={15} /></button>
        <h2 className="bui-modal-h">{title}</h2>
        <div className="bui-modal-body">
          <div className="bui-chips">
            {options.map((o) => (
              <button key={o.key} type="button" className={`bui-chip${value === o.key ? ' is-on' : ''}`} onClick={() => onPick(o.key)}>{o.label}</button>
            ))}
          </div>
          <div className="bui-modal-foot">
            <button type="button" className="bui-btn bui-btn--ghost" onClick={onClear}>Clear</button>
            <button type="button" className="bui-btn" onClick={onClose}>Show creators</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function BrandCreators() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // The team's hand picked shortlist (admin: Users > creator > Mark UGCAD Approved).
  const approvedMode = searchParams.get('collection') === 'ugcad-approved';
  const collectionSearch = (on) => {
    const p = new URLSearchParams(searchParams);
    if (on) p.set('collection', 'ugcad-approved'); else p.delete('collection');
    const s = p.toString();
    return s ? `?${s}` : '';
  };
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [chatWith, setChatWith] = useState(null);
  const [videoCard, setVideoCard] = useState(null);
  const [preview, setPreview] = useState(null);   // quick-preview card
  const viewProfile = (c) => setPreview(c);

  useLiveEffect(() => {
    let active = true;
    (async () => {
      if (active) {
        setLoading(true);
        setLoadError('');
      }
      try {
        // `discovery_only` identifies this as the read/message discovery surface.
        // Pending-review brands may use it; publishing and paid actions remain gated.
        const res = await axios.get(`${API}/business/creator-directory`, {
          params: { discovery_only: true },
        });
        const list = creatorListFrom(res.data);
        if (active) setCreators(list);
      } catch (err) {
        if (active) {
          setCreators([]);
          setLoadError(
            err?.response?.data?.detail
            || err?.response?.data?.message
            || 'Creator profiles could not be loaded. Please try again.'
          );
        }
      }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [reloadKey]);

  // Sync the search box when the nav-bar search updates the ?q= param.
  useEffect(() => {
    const p = searchParams.get('q');
    setQ(p || '');
  }, [searchParams]);

  // ── Filters (design board 03). All client-side over the loaded directory. ──
  const categoryLabel = searchParams.get('category') || '';
  const [fStyle, setFStyle] = useState('any');
  const [fDetails, setFDetails] = useState('any');
  const [fBudget, setFBudget] = useState('any');
  const [fLang, setFLang] = useState('any');
  const [fElite, setFElite] = useState(false);
  const [fVerified, setFVerified] = useState(false);
  const [fFast, setFFast] = useState(false);
  // The "Delivers in 3 days" switch only exists once the directory reports delivery times; until then
  // the bar keeps "ID verified" (also available under Creator details).
  const hasDelivery = useMemo(() => creators.some((c) => deliveryDaysOf(c)), [creators]);
  const [openFilter, setOpenFilter] = useState(null); // 'style' | 'details' | 'budget' | 'language'

  const styleOptions = useMemo(() => [
    { key: 'any', label: 'Any' },
    ...Array.from(new Set(creators.map((c) => c.content_style).filter(Boolean))).map((s) => ({ key: s, label: titleCase(s) })),
  ], [creators]);
  const langOptions = useMemo(() => [
    { key: 'any', label: 'Any' },
    ...Array.from(new Set(creators.flatMap((c) => c.languages || []).filter(Boolean))).map((l) => ({ key: l, label: titleCase(l) })),
  ], [creators]);

  const filtered = useMemo(() => creators.filter((c) => {
    if (approvedMode && !c.ugcad_approved) return false;
    const cats = catsOf(c);
    if (!approvedMode && categoryLabel && !matchesCategory(cats, categoryLabel)) return false;
    if (!matchesCreatorSearch(c, q, cats)) return false;
    if (fStyle !== 'any' && c.content_style !== fStyle) return false;
    if (fLang !== 'any' && !(c.languages || []).includes(fLang)) return false;
    if (!BUDGET_OPTIONS.find((o) => o.key === fBudget).test(budgetOf(c))) return false;
    if (!DETAIL_OPTIONS.find((o) => o.key === fDetails).test(c)) return false;
    if (fElite && String(c.level).toLowerCase() !== 'elite') return false;
    if (fVerified && !c.kyc_verified) return false;
    if (fFast && !(deliveryDaysOf(c) > 0 && deliveryDaysOf(c) <= 3)) return false;
    return true;
  }), [creators, categoryLabel, q, approvedMode, fStyle, fLang, fBudget, fDetails, fElite, fVerified, fFast]);

  // No-results helpers (board 30): the most common real categories + a few popular creators.
  const noResultCats = useMemo(() => {
    const m = new Map();
    creators.forEach((c) => new Set(catsOf(c)).forEach((k) => m.set(k, (m.get(k) || 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => titleCase(k));
  }, [creators]);
  const noResultSimilar = useMemo(() => [...creators]
    .sort((a, b) => (Number(!!b.ugcad_approved) - Number(!!a.ugcad_approved)) || (Number(b.avg_rating || 0) - Number(a.avg_rating || 0)))
    .slice(0, 5), [creators]);

  const openChat = (c) => { setChatWith({ id: c.id, name: nameOf(c).replace('@', ''), photo: c.profile_photo }); };

  const FILTERS = [
    { id: 'style', label: 'Content style', options: styleOptions, value: fStyle, set: setFStyle },
    { id: 'details', label: 'Creator details', options: DETAIL_OPTIONS, value: fDetails, set: setFDetails },
    { id: 'budget', label: 'Budget', options: BUDGET_OPTIONS, value: fBudget, set: setFBudget },
    { id: 'language', label: 'Language', options: langOptions, value: fLang, set: setFLang },
  ];
  const activeFilter = FILTERS.find((f) => f.id === openFilter);
  const pageTitle = approvedMode ? 'Preferred Creators by the UGCAD Team' : (categoryLabel ? `${categoryLabel} creators` : 'All creators');
  const pageSub = approvedMode
    ? 'Hand-picked by the UGCad team for your next campaign.'
    : 'Videos from creators vetted by the UGCad team.';

  return (
    <BrandTopNavLayout>
      <div className="bui-main bui-main--tight">
        <nav className="bui-crumb" aria-label="Breadcrumb">
          <Link to="/brand-home">Home</Link>
          <span aria-hidden="true">/</span>
          <Link to="/dashboard/business/browse-creator">Creators</Link>
          {(categoryLabel || approvedMode) && (
            <>
              <span aria-hidden="true">/</span>
              <strong>{approvedMode ? 'Preferred' : categoryLabel}</strong>
            </>
          )}
        </nav>

        <div>
          <h1 className="bui-h1">{pageTitle}</h1>
          <p className="bui-sub">{pageSub}</p>
        </div>

        <div className="bui-filterbar">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" className={`bui-fbtn${f.value !== 'any' ? ' is-on' : ''}`} onClick={() => setOpenFilter(f.id)}>
              {f.label}
              <ChevronDown size={14} strokeWidth={2.4} />
            </button>
          ))}
          <span className="bui-grow" />
          <button type="button" role="switch" aria-checked={fElite} className="bui-toggle" onClick={() => setFElite((v) => !v)}>
            <span className={`bui-track${fElite ? ' is-on' : ''}`}><span /></span>Elite creators
          </button>
          {hasDelivery ? (
            <button type="button" role="switch" aria-checked={fFast} className="bui-toggle" onClick={() => setFFast((v) => !v)}>
              <span className={`bui-track${fFast ? ' is-on' : ''}`}><span /></span>Delivers in 3 days
            </button>
          ) : (
            <button type="button" role="switch" aria-checked={fVerified} className="bui-toggle" onClick={() => setFVerified((v) => !v)}>
              <span className={`bui-track${fVerified ? ' is-on' : ''}`}><span /></span>ID verified
            </button>
          )}
        </div>

        <div className="bui-countrow">
          <span><strong>{filtered.length}</strong> creators available</span>
          {approvedMode ? (
            <Link className="bui-link" to={{ search: collectionSearch(false) }}>Back to All Creators</Link>
          ) : (
            <Link className="bui-link bc-approved-link" to={{ search: collectionSearch(true) }}>Meet Our Preferred Creators</Link>
          )}
          <span>Sort by: <strong>Best match</strong></span>
        </div>

        {loading ? (
          <div className="bui-gig-grid">
            {Array.from({ length: 10 }).map((_, i) => (
              <div className="bui-gig" key={i} aria-hidden="true">
                <Skeleton height="100%" radius={10} style={{ aspectRatio: '4 / 5', display: 'block' }} />
                <Skeleton width="60%" height={14} />
                <Skeleton width="90%" height={14} />
                <Skeleton width="40%" height={12} />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <EmptyState
            title="Could not load creators"
            message={loadError}
            action={{ label: 'Try again', onClick: () => setReloadKey((v) => v + 1) }}
          />
        ) : filtered.length === 0 && approvedMode ? (
          <EmptyState
            title="No preferred creators to show"
            message={q ? 'None of the preferred creators match your search.' : 'The UGCAD team has not picked any preferred creators yet. Check back soon.'}
            action={{ label: 'Back to All Creators', onClick: () => navigate({ search: collectionSearch(false) }) }}
          />
        ) : filtered.length === 0 ? (
          <BrandNoResults query={q} categories={noResultCats}>
            {noResultSimilar.map((c) => <ReelCard key={c.id} c={c} onView={viewProfile} onExpand={setVideoCard} />)}
          </BrandNoResults>
        ) : (
          <div className="bui-gig-grid">
            {filtered.map((c) => <GigCard key={c.id} c={c} onView={viewProfile} onExpand={setVideoCard} />)}
          </div>
        )}
      </div>

      {activeFilter && (
        <FilterModal
          title={activeFilter.label === 'Budget' ? 'Budget per video' : activeFilter.label}
          options={activeFilter.options}
          value={activeFilter.value}
          onPick={activeFilter.set}
          onClear={() => activeFilter.set('any')}
          onClose={() => setOpenFilter(null)}
        />
      )}

      {/* Portaled to <body> so the expanded video always sits above the quick-preview
          card (.bc-modal-ov), the nav and every other fixed layer. */}
      {videoCard && createPortal(
        <div className="bc-vid-overlay" onClick={() => setVideoCard(null)}>
          <div className="bc-vid-card" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="bc-vid-close" aria-label="Close" onClick={() => setVideoCard(null)}><X size={20} /></button>
            <video src={videoCard.src} controls autoPlay playsInline className="bc-vid-el" />
            {videoCard.name && <div className="bc-vid-name">{videoCard.name}</div>}
          </div>
        </div>,
        document.body
      )}

      {preview && (
        <QuickPreview
          c={preview}
          onClose={() => setPreview(null)}
          onMessage={() => { setPreview(null); openChat(preview); }}
          onFull={() => navigate(`/dashboard/business/creator/${preview.id}`)}
          onExpand={setVideoCard}
        />
      )}

      {chatWith && <ChatPopup user={chatWith} onClose={() => setChatWith(null)} />}
    </BrandTopNavLayout>
  );
}
