import { useLiveEffect } from '../lib/liveUpdates';
import { useState, useEffect, useRef } from 'react';
import {  } from 'react-router-dom';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  X, Play, MessageSquare, Heart, ChevronLeft, ChevronRight, ShieldCheck, Check, BadgeCheck,
  User, MapPin, Sparkles, Clapperboard, Wallet, Camera, Star,
} from 'lucide-react';
import { useAuth } from '../App';
import { brandName, creatorFirstName } from '../utils/displayName';
import { toggleSavedCreator, useSavedCreatorIds } from '../utils/savedCreators';
import { s3Preview } from '../utils/mediaPreview';
import { Skeleton } from './Skeleton';
import PhotoOrInitial from './PhotoOrInitial';
import '../styles/brand-ui-profile.css';
import BackButton from './BackButton';
import SafetyMenu from './SafetyMenu';

/**
 * Brand-facing creator profile (design board 08) for /dashboard/business/creator/:id.
 * Same data as CreatorProfileModal (GET /profile/:id, /reviews/creator/:id) but read-only:
 * hero, Videos / Details / Reviews, a price card with Send a brief + Message + Save.
 */
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const assetUrl = (u) => (!u ? '' : (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}/${String(u).replace(/^\//, '')}`));
// Gated /uploads media can't send an Authorization header from <video>/<img>, so sign it with ?token=.
const mediaUrl = (u) => {
  const base = assetUrl(u);
  if (!base || !base.startsWith(BACKEND_URL)) return base;
  const token = localStorage.getItem('token');
  if (!token) return base;
  return `${base}${base.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}`;
};
const isVideo = (u) => /\.(mp4|webm|mov|m4v)(?:[?#]|$)|\/video\//i.test(String(u || ''));
const pfUrl = (it) => (typeof it === 'string' ? it : (it?.videoUrl || it?.link || it?.url || (Array.isArray(it?.urls) && it.urls[0]) || it?.original_url || ''));
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const vidDelivery = (delivery) => {
  const raw = String(delivery ?? '').trim();
  if (!raw) return '';
  return /^\d+$/.test(raw) ? `${raw} day${Number(raw) > 1 ? 's' : ''}` : raw;
};
const vidPrice = (price, fallback) => {
  const raw = String(price ?? '').trim();
  if (!raw) return fallback;
  const digits = raw.replace(/[₹,\s]/g, '');
  return /^\d+$/.test(digits) ? inr(digits) : raw;
};
const relTime = (ts) => {
  if (!ts) return '';
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
  if (d < 1) return 'today';
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
};
const titleCase = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
const Stars = ({ n = 0, className = '' }) => (
  <span className={`bui-pf-stars ${className}`} aria-label={`${Math.round(n)} out of 5`}>
    {'★★★★★'.split('').map((s, i) => <i key={i} className={i < Math.round(n) ? 'on' : ''}>{s}</i>)}
  </span>
);

// Watermarked full-size player used by the video lightbox and review clips.
const Watermark = () => (
  <div className="bui-pf-wm" aria-hidden="true"><img src="/watermark.jpeg" alt="" /><span>UGCAD.io</span></div>
);

function VideoTile({ v, onOpen }) {
  const ref = useRef(null);
  const [clipFailed, setClipFailed] = useState(false);
  const [failed, setFailed] = useState(false);
  const video = isVideo(v.url);
  const src = mediaUrl(v.url);
  const clip = video && !clipFailed ? s3Preview(v.url, 'mp4') : '';
  const poster = video ? s3Preview(v.url, 'jpg') : '';
  const canHover = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: hover)').matches;
  const hoverPlay = () => { const el = ref.current; if (canHover && el && video) { el.muted = true; el.play().catch(() => {}); } };
  const hoverStop = () => { const el = ref.current; if (canHover && el) { el.pause(); try { el.currentTime = 0.5; } catch { /* not seekable yet */ } } };
  return (
    <button type="button" className="bui-pf-vid" onClick={() => !failed && onOpen()} aria-label={`Play ${v.brand || 'video'}`} onMouseEnter={hoverPlay} onMouseLeave={hoverStop}>
      <span className="bui-pf-vid-media">
        {failed ? (
          <span className="bui-pf-vid-broken"><Camera size={20} /> Media unavailable</span>
        ) : video ? (
          <video ref={ref} src={clip || `${src}#t=0.5`} poster={poster || undefined} muted playsInline loop preload="metadata"
            onError={() => (clip ? setClipFailed(true) : setFailed(true))} />
        ) : (
          <img src={src} alt="" onError={() => setFailed(true)} />
        )}
        {!failed && <span className="bui-pf-vid-play"><Play size={16} fill="currentColor" /></span>}
      </span>
      <span className="bui-pf-vid-t">{v.brand || v.category}</span>
      <span className="bui-pf-vid-s">{[v.brand ? v.category : '', v.priceLabel].filter(Boolean).join(' · ')}</span>
    </button>
  );
}

function Lightbox({ vids, index, name, onIndex, onClose, onBrief }) {
  const v = vids[index];
  useEffect(() => {
    const key = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onIndex((index - 1 + vids.length) % vids.length);
      if (e.key === 'ArrowRight') onIndex((index + 1) % vids.length);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [index, vids.length, onClose, onIndex]);
  if (!v) return null;
  const src = mediaUrl(v.url);
  const multi = vids.length > 1;
  return createPortal(
    <div className="bui-pf-lb" onClick={onClose}>
      {multi && <button type="button" className="bui-pf-lb-nav" aria-label="Previous video" onClick={(e) => { e.stopPropagation(); onIndex((index - 1 + vids.length) % vids.length); }}><ChevronLeft size={22} /></button>}
      <div className="bui-pf-lb-in" role="dialog" aria-modal="true" aria-label={`${v.brand || name} video`} onClick={(e) => e.stopPropagation()}>
        <div className="bui-pf-lb-media">
          {isVideo(v.url)
            ? <video key={src} src={src} controls autoPlay playsInline />
            : <img src={src} alt="" />}
          <Watermark />
        </div>
        <div className="bui-pf-lb-side">
          <button type="button" className="bui-pf-lb-x" aria-label="Close" onClick={onClose}><X size={18} /></button>
          <div className="bui-pf-lb-pos">{index + 1} of {vids.length}</div>
          <div className="bui-pf-lb-t">{v.brand || `${name}’s video`}</div>
          <div className="bui-pf-lb-s">
            {[v.category, v.priceLabel].filter(Boolean).join(' · ')}
            {v.delivery ? ` · delivered in ${v.delivery}` : ''}
          </div>
          {onBrief && <button type="button" className="bui-btn bui-btn--light" onClick={() => { onClose(); onBrief(); }}>Send {name} a brief</button>}
        </div>
      </div>
      {multi && <button type="button" className="bui-pf-lb-nav" aria-label="Next video" onClick={(e) => { e.stopPropagation(); onIndex((index + 1) % vids.length); }}><ChevronRight size={22} /></button>}
    </div>,
    document.body
  );
}

function RevClip({ src: rawSrc }) {
  const [open, setOpen] = useState(false);
  const src = mediaUrl(rawSrc);
  return (
    <>
      <button type="button" className="bui-pf-rev-clip" onClick={() => setOpen(true)} aria-label="Play delivered clip">
        <video src={`${src}#t=0.5`} muted playsInline preload="metadata" />
        <span><Play size={12} fill="currentColor" /></span>
      </button>
      {open && createPortal(
        <div className="bui-pf-lb" onClick={() => setOpen(false)}>
          <div className="bui-pf-lb-in bui-pf-lb-in--solo" onClick={(e) => e.stopPropagation()}>
            <div className="bui-pf-lb-media">
              <video src={src} controls autoPlay playsInline />
              <Watermark />
            </div>
            <button type="button" className="bui-pf-lb-x bui-pf-lb-x--float" aria-label="Close" onClick={() => setOpen(false)}><X size={18} /></button>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

export default function BrandCreatorProfile({ id, onMessage, onBegin }) {
  const { user: viewer } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [reviews, setReviews] = useState([]);
  const [reviewers, setReviewers] = useState({});
  const [revCampaigns, setRevCampaigns] = useState({});
  const [lb, setLb] = useState(null);          // lightbox index
  const [allRev, setAllRev] = useState(false);
  const [tab, setTab] = useState('videos');
  const saved = useSavedCreatorIds(viewer?.role === 'business').has(String(id));
  const secs = { videos: useRef(null), details: useRef(null), reviews: useRef(null) };

  useLiveEffect(() => {
    let a = true;
    axios.get(`${API}/profile/${id}`).then((r) => { if (a) { setData(r.data); setLoadFailed(false); } }).catch(() => { if (a) setLoadFailed(true); }).finally(() => { if (a) setLoading(false); });
    axios.get(`${API}/reviews/creator/${id}`).then((r) => { if (a) setReviews(Array.isArray(r.data) ? r.data : []); }).catch(() => {});
    return () => { a = false; };
  }, [id, attempt]);

  // Resolve reviewer (brand) names + avatars.
  useLiveEffect(() => {
    const ids = [...new Set(reviews.map((r) => r.reviewer_id).filter(Boolean))];
    if (!ids.length) return undefined;
    let a = true;
    Promise.all(ids.map((rid) => axios.get(`${API}/profile/${rid}`).then((r) => [rid, r.data]).catch(() => [rid, null])))
      .then((pairs) => {
        if (!a) return;
        const m = {};
        pairs.forEach(([rid, d]) => {
          if (!d) return;
          m[rid] = { name: (d.profile && d.profile.business_name) || d.business_name || brandName(d), photo: assetUrl(d.profile_photo || d.logo || (d.profile && d.profile.logo)) };
        });
        setReviewers(m);
      });
    return () => { a = false; };
  }, [reviews]);

  // The campaign behind each review (price, delivery time, category, delivered video).
  useLiveEffect(() => {
    const ids = [...new Set(reviews.map((r) => r.campaign_id).filter(Boolean))];
    if (!ids.length) return undefined;
    let a = true;
    Promise.all(ids.map((cid) => axios.get(`${API}/campaigns/${cid}`).then((r) => [cid, r.data]).catch(() => [cid, null])))
      .then((pairs) => {
        if (!a) return;
        const m = {};
        pairs.forEach(([cid, d]) => { if (d) m[cid] = d; });
        setRevCampaigns(m);
      });
    return () => { a = false; };
  }, [reviews]);

  // Tabs double as anchors; scrolling updates the active one.
  useEffect(() => {
    if (loading) return undefined;
    const onScroll = () => {
      let active = 'videos';
      // Reviews sit in the sidebar on desktop, so they only join the scroll-spy when the layout is one column.
      const single = window.matchMedia('(max-width: 900px)').matches;
      Object.entries(secs).forEach(([k, r]) => { if ((single || k !== 'reviews') && r.current && r.current.getBoundingClientRect().top <= 190) active = k; });
      setTab(active);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);
  const goTab = (k) => { setTab(k); secs[k].current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  const reviewCount = reviews.length;
  const avgRating = reviewCount ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviewCount : 0;

  const p = { ...(data || {}), ...(data?.profile || {}) };
  const name = creatorFirstName(data);
  const publicId = data?.public_creator_id || String(id || '').slice(0, 12);
  const city = p.city || p.location || '';
  const country = p.country || 'India';
  const languages = Array.isArray(p.languages) ? p.languages : (p.languages ? [p.languages] : []);
  const rc = p.rate_card || {};
  const priceNum = String(rc.expected_payout || p.expectedPayout || '').replace(/[^0-9]/g, '');
  const editNum = Number(String(rc.editing_payout || '').replace(/[^0-9]/g, '')) || 0;
  const avatar = assetUrl(data?.profile_photo || data?.profile_picture || p.profile_photo || p.profile_picture);
  const deliverables = Number(data?.deliverables_completed ?? p.deliverables_completed ?? 0);
  const basePrice = priceNum ? inr(priceNum) : (data?.budget_range || p.budget_range || 'On request');
  const categoryTxt = p.customCategory || p.category || '';
  const skills = Array.isArray(p.skills) ? p.skills : (Array.isArray(data?.tags) ? data.tags : []);
  const picked = [...new Map(
    [...(Array.isArray(p.content_categories) ? p.content_categories : []), ...(Array.isArray(p.contentCategories) ? p.contentCategories : [])]
      .map((v) => String(v || '').replace(/_/g, ' ').trim()).filter(Boolean).map((v) => [v.toLowerCase(), titleCase(v)]),
  ).values()];
  const nicheTxt = p.niche || categoryTxt || p.primary_category || (Array.isArray(p.categories) ? p.categories[0] : '') || skills[0] || '';
  const hlCategory = titleCase(nicheTxt || 'General');
  const hlCategories = picked.length ? picked.join(', ') : hlCategory;
  const topCategory = picked[0] || (nicheTxt ? hlCategory : '');

  // Portfolio, same sources and URL rule as the old profile modal.
  const portfolio = [...(Array.isArray(p.portfolio_items) ? p.portfolio_items : []), ...(Array.isArray(data?.portfolio) ? data.portfolio : []), ...(Array.isArray(p.portfolio) ? p.portfolio : [])];
  if (!portfolio.length && p.intro_video) portfolio.push(p.intro_video);
  const vids = portfolio
    .map((it) => {
      const url = pfUrl(it);
      const meta = typeof it === 'string' ? {} : it;
      return { url, category: titleCase(meta.category) || hlCategory, priceLabel: vidPrice(meta.price, basePrice), delivery: vidDelivery(meta.delivery), brand: meta.brand || '' };
    })
    .filter((v, i, all) => v.url && !String(v.url).startsWith('blob:') && all.findIndex((o) => o.url === v.url) === i);

  const vidDays = vids.map((v) => Number(String(v.delivery).replace(/[^0-9]/g, ''))).filter((n) => n > 0);
  const setDays = Number(p.delivery_days || p.avg_delivery_days || rc.delivery_days || 0) || 0;
  const days = setDays || (vidDays.length ? Math.max(...vidDays) : 0);
  const hlDelivery = days ? `${days} day${days > 1 ? 's' : ''}` : '-';

  // Details tab: only sections that have something to show. Contact fields are never shown to a brand.
  const list = (v) => (Array.isArray(v) ? v.filter(Boolean) : (v ? [v] : []));
  const groups = [
    { title: 'About', Icon: User, rows: [['Age', p.age], ['Gender', p.gender], ['Body type', p.bodyType], ['Skin tone', p.skinTone], ['Primary category', categoryTxt && titleCase(categoryTxt)]] },
    { title: 'Location', Icon: MapPin, rows: [['Country', p.country], ['State', p.state], ['City', p.city]] },
    { title: 'Skills & languages', Icon: Sparkles, rows: [['Skills', skills], ['Languages', languages]] },
    { title: 'Recording setup', Icon: Clapperboard, rows: [['Core setup', p.coreSetup], ['Who appears', p.appearIn], ['Can bring', p.bring], ['Weekly availability', p.weekly || p.availability_calendar?.weekly], ['Flexible hours', p.flexible ? 'Yes' : ''], ['Topics avoided', p.topics]] },
    { title: 'Pricing', Icon: Wallet, rows: [['Expected payout', vidPrice(rc.expected_payout || p.expectedPayout, '')], ['Payout period', rc.payout_period || p.payoutPeriod], ['Budget range', data?.budget_range || p.budget_range]] },
  ].map((g) => ({ ...g, rows: g.rows.map(([k, v]) => [k, list(v)]).filter(([, v]) => v.length) })).filter((g) => g.rows.length);

  const facts = [
    [hlCategories.includes(',') ? 'Categories' : 'Category', hlCategories],
    ['Price per video', basePrice],
    ['Delivery', hlDelivery],
    ['Languages', languages.length ? languages.slice(0, 3).join(', ') : '-'],
  ];
  const perks = [
    data?.kyc_verified && 'Identity verified',
    days > 0 && `Delivers in ${hlDelivery}`,
    reviewCount > 0 && `Rated ${avgRating.toFixed(1)} by ${reviewCount} brand${reviewCount > 1 ? 's' : ''}`,
    languages.length > 0 && languages.slice(0, 3).join(' · '),
  ].filter(Boolean);

  const level = String(data?.level || p.level || '').toLowerCase();
  const levelLabel = { elite: 'Elite', l2: 'Level 2', l1: 'Level 1' }[level];
  const choice = !!(data?.ugcad_approved || p.ugcad_approved);

  const toggleSave = async () => {
    const now = await toggleSavedCreator({ id: id || data?.id });
    if (now !== saved) toast.success(now ? 'Creator saved to your list' : 'Removed from saved');
  };

  if (loadFailed && !data) {
    return (
      <div className="bui-main bui-main--tight">
        <div className="bui-empty" role="alert">
          <h3>Could not load this profile</h3>
          <p>Check your connection and try again.</p>
          <button type="button" className="bui-btn" onClick={() => { setLoading(true); setLoadFailed(false); setAttempt((n) => n + 1); }}>Retry</button>
        </div>
      </div>
    );
  }

  const shownReviews = allRev ? reviews : reviews.slice(0, 3);
  const stat = (n) => reviews.filter((r) => Math.round(r.rating || 0) === n).length;

  return (
    <div className="bui-main bui-main--tight bui-pf">
      <BackButton fallback="/dashboard/business/browse-creator" />

      <div className="bui-pf-grid">
        <div className="bui-pf-main">
          <section className="bui-card bui-pf-hero">
            <span className="bui-pf-ava">
              {loading ? <Skeleton width="100%" height="100%" radius="50%" /> : <PhotoOrInitial src={avatar} initial={name.charAt(0).toUpperCase()} />}
            </span>
            <div className="bui-pf-who">
              <div className="bui-pf-namerow">
                <h1 className="bui-h1">{loading ? <Skeleton width={170} height={30} /> : name}</h1>
                {data?.kyc_verified && <BadgeCheck size={22} color="#4E60E6" aria-label="Identity verified" />}
                {!loading && <SafetyMenu userId={id} name={name} label />}
                {choice ? (
                  <span className="bui-badge bui-badge--choice"><span className="bui-badge-mark" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/ugcad-logo.png)` }} aria-hidden="true" /><span>UGCAD.IO Choice</span></span>
                ) : levelLabel ? (
                  <span className={`bui-badge bui-badge--${level}`}><span>{levelLabel}</span></span>
                ) : null}
              </div>
              <div className="bui-pf-meta">
                {loading ? <Skeleton width={260} height={14} /> : (
                  <>
                    {reviewCount > 0 && <span><Star size={14} fill="#07074E" color="#07074E" /> <strong>{avgRating.toFixed(1)}</strong> ({reviewCount} review{reviewCount > 1 ? 's' : ''})</span>}
                    {deliverables > 0 && <span>{deliverables} deliverables</span>}
                    {(city || country) && <span>{[city, country].filter(Boolean).join(', ')}</span>}
                    {languages.length > 0 && <span>{languages.join(' · ')}</span>}
                    <span>ID {publicId}</span>
                  </>
                )}
              </div>
            </div>
          </section>

          <nav className="bui-pf-tabs" aria-label="Profile sections">
            <button type="button" className={tab === 'videos' ? 'is-on' : ''} onClick={() => goTab('videos')}>Videos</button>
            <button type="button" className={tab === 'details' ? 'is-on' : ''} onClick={() => goTab('details')}>Details</button>
            <button type="button" className={tab === 'reviews' ? 'is-on' : ''} onClick={() => goTab('reviews')}>Reviews{reviewCount > 0 && <span>{reviewCount}</span>}</button>
          </nav>

          <section ref={secs.videos} className="bui-pf-sec" aria-labelledby="pf-vh">
            <div className="bui-pf-sech"><h2 id="pf-vh" className="bui-h2">Videos</h2>{vids.length > 0 && <span>Tap a video to watch it full size</span>}</div>
            {loading ? (
              <div className="bui-pf-vids">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} width="100%" height="100%" radius={14} style={{ aspectRatio: '9 / 16', display: 'block' }} />)}</div>
            ) : vids.length === 0 ? (
              <div className="bui-empty"><h3>No videos uploaded yet</h3><p>{name} has not added any sample videos.</p></div>
            ) : (
              <div className="bui-pf-vids">{vids.map((v, i) => <VideoTile key={v.url} v={v} onOpen={() => setLb(i)} />)}</div>
            )}
          </section>

          <section ref={secs.details} className="bui-card bui-pf-sec bui-pf-details" aria-labelledby="pf-dh">
            <h2 id="pf-dh" className="bui-h2">About {loading ? 'this creator' : name}</h2>
            <div className="bui-pf-facts">
              {facts.map(([k, v]) => (
                <div key={k}>{loading ? <Skeleton width="70%" height={16} /> : (<><small>{k}</small><b>{v}</b></>)}</div>
              ))}
            </div>
            {!loading && groups.length === 0 && <p className="bui-sub">This creator hasn&apos;t shared more details yet.</p>}
            <div className="bui-pf-groups">
              {groups.map((g) => (
                <div className="bui-pf-group" key={g.title}>
                  <span className="bui-pf-gic"><g.Icon size={18} /></span>
                  <div>
                    <div className="bui-pf-gt">{g.title}</div>
                    {g.rows.map(([k, v]) => (
                      <div className="bui-pf-row" key={k}>
                        <small>{k}</small>
                        <div className="bui-pf-chipset">{v.map((x, i) => <span key={i}>{typeof x === 'string' ? x : (x?.label || x?.name || '')}</span>)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="bui-pf-aside">
          <section className="bui-card bui-pf-price">
            <div className="bui-pf-pricehead">
              <small>Price per video</small>
              <b>{loading ? '...' : basePrice}</b>
              {editNum > 0 && <small>+ {inr(editNum)} if {name} edits it</small>}
            </div>
            <div className="bui-pf-pricebody">
              {perks.map((t) => (<div className="bui-pf-perk" key={t}><span><Check size={13} strokeWidth={3} /></span>{t}</div>))}
              {onBegin && <button type="button" className="bui-btn bui-pf-brief" onClick={onBegin} disabled={loading}>Send a brief</button>}
              <div className="bui-pf-acts">
                {onMessage && <button type="button" className="bui-btn bui-btn--ghost" onClick={onMessage} disabled={loading}><MessageSquare size={16} /> Message</button>}
                {viewer?.role === 'business' && (
                  <button type="button" className={`bui-btn bui-btn--ghost bui-pf-save${saved ? ' is-saved' : ''}`} onClick={toggleSave} aria-label={saved ? `Remove ${name} from saved` : `Save ${name}`} title={saved ? 'Saved' : 'Save creator'}>
                    <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
                  </button>
                )}
              </div>
            </div>
          </section>

          <div className="bui-pf-safe"><ShieldCheck size={20} color="#4E60E6" /><span><strong>Your money is safe.</strong> Payment stays in escrow until you approve the final video.</span></div>

          <section ref={secs.reviews} className="bui-card bui-pf-rev" aria-labelledby="pf-rh">
            <div className="bui-pf-sech"><h2 id="pf-rh" className="bui-h2 bui-h2--sm">Reviews</h2><span>{reviewCount} review{reviewCount === 1 ? '' : 's'}</span></div>
            {reviewCount === 0 ? (
              <div className="bui-pf-revempty"><Star size={24} color="#c9c9e2" /><strong>No reviews yet</strong><span>Reviews from brands appear here once a deal is completed.</span></div>
            ) : (
              <>
                <div className="bui-pf-sum">
                  <div className="bui-pf-score"><b>{avgRating.toFixed(1)}</b><Stars n={avgRating} /></div>
                  <div className="bui-pf-bars">
                    {[5, 4, 3, 2, 1].map((n) => (
                      <div key={n}><span>{n}</span><i><em style={{ width: `${(stat(n) / reviewCount) * 100}%` }} /></i><span>{stat(n)}</span></div>
                    ))}
                  </div>
                </div>
                {shownReviews.map((rv, i) => {
                  const text = rv.review || rv.review_text || rv.comment || '';
                  const who = String(reviewers[rv.reviewer_id]?.name || rv.reviewer_name || 'Brand').replace('@', '');
                  const camp = revCampaigns[rv.campaign_id] || {};
                  const ws = camp.work_submission || {};
                  const selBid = (camp.bids || []).find((b) => b.creator_id === camp.selected_creator) || {};
                  const cat = titleCase(camp.category || camp.industry_type || '');
                  const price = (camp.budget_max || camp.budget_min) ? inr(camp.budget_max || camp.budget_min) : '';
                  const d = selBid.estimated_delivery_days || camp.estimated_delivery_days;
                  const vid = (ws.work_files || []).find((f) => isVideo(f)) || (ws.work_files || [])[0] || '';
                  const fallback = (vids[i % (vids.length || 1)] || {}).url || '';
                  const clip = vid ? assetUrl(vid) : (fallback ? assetUrl(fallback) : '');
                  return (
                    <article className="bui-pf-rv" key={rv.id || i}>
                      <div>
                        <div className="bui-pf-rvwho">
                          <span className="bui-pf-rvava">{reviewers[rv.reviewer_id]?.photo ? <img src={reviewers[rv.reviewer_id].photo} alt="" /> : (who[0] || 'B').toUpperCase()}</span>
                          <strong>{who}</strong>
                          <Stars n={rv.rating} className="bui-pf-stars--sm" />
                        </div>
                        {text && <p>{text}</p>}
                        <small>{[cat, price, d ? `${d} day${Number(d) > 1 ? 's' : ''}` : '', relTime(rv.created_at)].filter(Boolean).join(' · ')}</small>
                      </div>
                      {clip && isVideo(clip) && <RevClip src={clip} />}
                    </article>
                  );
                })}
                {reviewCount > 3 && (
                  <button type="button" className="bui-link bui-pf-more" onClick={() => setAllRev((v) => !v)}>{allRev ? 'Show fewer reviews' : `Show all ${reviewCount} reviews`}</button>
                )}
              </>
            )}
          </section>
        </aside>
      </div>

      {/* Phone: the price card sits far down the page, so keep the two actions reachable. */}
      {!loading && (onBegin || onMessage) && (
        <div className="bui-pf-mbar">
          {onMessage && <button type="button" className="bui-btn bui-btn--ghost" onClick={onMessage}><MessageSquare size={16} /> Message</button>}
          {onBegin && <button type="button" className="bui-btn" onClick={onBegin}>Send a brief</button>}
        </div>
      )}

      {lb != null && vids.length > 0 && (
        <Lightbox vids={vids} index={Math.min(lb, vids.length - 1)} name={name} onIndex={setLb} onClose={() => setLb(null)} onBrief={onBegin} />
      )}
    </div>
  );
}
