import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Play, VolumeX, Volume2, Maximize2, X, Star, VideoOff } from 'lucide-react';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import ChatPopup from '../components/ChatPopup';
import PlanBrief from './PlanBrief';
import '../styles/creator-marketplace.css';
import EmptyState from '../components/EmptyState';
import { creatorName } from '../utils/displayName';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const assetUrl = (u) => (!u ? '' : (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}/${String(u).replace(/^\//, '')}`));
const isVideo = (u) => /\.(mp4|webm|mov|m4v)$/i.test(String(u || '').split('?')[0]);
// Portfolio items may be plain URL strings or rich objects ({ urls, videoUrl, ... }).
const pfUrl = (it) => {
  if (!it) return '';
  if (typeof it === 'string') return it;
  return (Array.isArray(it.urls) && it.urls[0]) || it.original_url || it.url || it.video || it.videoUrl || it.link || '';
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
const nameOf = (c) => creatorName(c);
const initialOf = (c) => (nameOf(c).replace('@', '').charAt(0) || 'C').toUpperCase();
const catOf = (c) => (c.primary_category || c.category || c.niche || 'UGC').replace(/_/g, ' ');
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
const LEVEL_KEYS = { new: 1, verified: 1, l1: 1, l2: 1, elite: 1 };
const levelKeyOf = (c) => (LEVEL_KEYS[String(c.level || '').toLowerCase()] ? String(c.level).toLowerCase() : 'new');
const hashOf = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
const LEVEL_BASE = { elite: 5000, l2: 3500, l1: 2500, verified: 2200, new: 1500 };
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

function ReelCard({ c, onView, onExpand }) {
  const vref = useRef(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const media = assetUrl(c.portfolio_preview);
  // Only ever show a creator's OWN uploaded video — never a stock/sample fallback.
  const hasVideo = !!(media && isVideo(media));
  const videoSrc = hasVideo ? `${media}#t=0.5` : '';
  // Creator level (admin-assigned): New / Verified / L1 / L2 / Elite.
  const LEVEL_LABEL = { new: 'New', verified: 'Verified', l1: 'L1', l2: 'L2', elite: 'Elite' };
  const levelKey = LEVEL_LABEL[String(c.level || '').toLowerCase()] ? String(c.level).toLowerCase() : 'new';
  const tier = LEVEL_LABEL[levelKey];
  const fullName = nameOf(c).replace('@', '');
  const location = c.city_tier || c.location_region || 'India';
  const priceText = priceTextOf(c);
  const category = catOf(c);

  const togglePlay = () => {
    if (!vref.current) return;
    if (vref.current.paused) { vref.current.play().then(() => setPlaying(true)).catch(() => {}); }
    else { vref.current.pause(); setPlaying(false); }
  };

  // Hover to preview: play the clip (which hides the play icon) on enter,
  // pause + reset on leave.
  const hoverPlay = () => {
    const v = vref.current; if (!v) return;
    v.play().then(() => setPlaying(true)).catch(() => {});
  };
  const hoverStop = () => {
    const v = vref.current; if (!v) return;
    v.pause(); setPlaying(false);
  };

  return (
    <div className="bc-card">
      <div className="bc-reel" onClick={hasVideo ? togglePlay : undefined} onMouseEnter={hasVideo ? hoverPlay : undefined} onMouseLeave={hasVideo ? hoverStop : undefined}>
        {hasVideo ? (
          <>
            <video ref={vref} src={videoSrc} muted={muted} loop playsInline preload="metadata" />
            {!playing && <span className="bc-play"><Play size={20} fill="currentColor" /></span>}
            <button type="button" className="bc-mute" aria-label={muted ? 'Unmute' : 'Mute'} onClick={(e) => {
              e.stopPropagation();
              const v = vref.current;
              const next = !muted;
              setMuted(next);
              if (v) {
                if (!next) {
                  // unmuting → silence every other reel so only this one is audible
                  document.querySelectorAll('.bc-reel video').forEach((el) => { if (el !== v) el.muted = true; });
                }
                v.muted = next;            // set DOM property directly (React's `muted` prop can be unreliable)
                v.volume = 1;
                if (!next) {               // unmuting → make sure it's actually playing so sound is heard
                  v.play().then(() => setPlaying(true)).catch(() => {});
                }
              }
            }}>
              {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <button type="button" className="bc-expand" aria-label="Expand video" onClick={(e) => {
              e.stopPropagation();
              if (vref.current) { vref.current.pause(); setPlaying(false); }
              onExpand?.({ src: videoSrc, name: fullName });
            }}>
              <Maximize2 size={14} />
            </button>
          </>
        ) : (
          <div className="bc-novideo">
            <VideoOff size={26} />
            <span>No video yet</span>
          </div>
        )}
        <div className="bc-rate">
          <span className={`bc-tier ${tier.toLowerCase()}`}>{tier}</span>
        </div>
      </div>

      <div className="bc-meta">
        <button type="button" className="bc-ava bc-ava-btn" onClick={() => onView(c)} aria-label="View profile">
          {assetUrl(c.profile_photo) ? <img src={assetUrl(c.profile_photo)} alt="" /> : initialOf(c)}
        </button>
        <button type="button" className="bc-name bc-name-btn" onClick={() => onView(c)}>
          <span className="bc-name-top">
            <strong>{fullName}</strong>
            <span className={`bc-cat ${catClass(category)}`}>{category}</span>
          </span>
          <small className="bc-price-txt">{priceText}</small>
        </button>
      </div>
    </div>
  );
}

// Quick-preview card: a peek at a creator (big video + a few details). Hovering a
// "Recent work" thumbnail plays that clip on the big left screen.
function QuickPreview({ c, onClose, onMessage, onFull, onExpand }) {
  const name = nameOf(c).replace('@', '');
  const category = catOf(c);
  const media = assetUrl(c.portfolio_preview);
  // Real uploaded clips only — never stock fallbacks. Portfolio items arrive as
  // plain URLs or as rich objects, so unwrap both before rendering.
  const realClips = (Array.isArray(c.portfolio) ? c.portfolio : [])
    .map(pfUrl)
    .map(assetUrl)
    .filter((u) => u && playable(u));
  const previewClip = (media && playable(media)) ? media : (realClips[0] || '');
  const hasVideo = !!previewClip;
  const baseVid = hasVideo ? `${previewClip}#t=0.5` : '';
  const clips = realClips.length ? realClips : (previewClip ? [previewClip] : []);
  const thumbs = Array.from(new Set(clips)).slice(0, 6);
  const rating = c.avg_rating || c.rating;
  const [bigVid, setBigVid] = useState(baseVid);
  const bigRef = useRef(null);

  useEffect(() => { const v = bigRef.current; if (v) { v.play().catch(() => {}); } }, [bigVid]);

  return (
    <div className="bcq-overlay" onClick={onClose}>
      <div className="bcq-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="bcq-close" aria-label="Close" onClick={onClose}><X size={18} /></button>
        <div className="bcq-video">
          {hasVideo ? (
            <video key={bigVid} ref={bigRef} src={`${bigVid.split('#')[0]}#t=0.1`} autoPlay muted loop playsInline />
          ) : (
            <div className="bc-novideo"><VideoOff size={30} /><span>No video yet</span></div>
          )}
        </div>
        <div className="bcq-body">
          <div className="bcq-head">
            <span className="bcq-ava">{assetUrl(c.profile_photo) ? <img src={assetUrl(c.profile_photo)} alt="" /> : initialOf(c)}</span>
            <div className="bcq-id">
              <strong>{name}</strong>
              <span className={`bcq-cat ${catClass(category)}`}>{category}</span>
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
              <label>Recent work <small>· hover to preview</small></label>
              <div className="bcq-thumbs">
                {thumbs.map((tv, k) => {
                  const src = `${tv}#t=0.5`;
                  return (
                    <button
                      type="button"
                      key={k}
                      className={`bcq-thumb ${bigVid === src ? 'on' : ''}`}
                      onMouseEnter={() => setBigVid(src)}
                      onMouseLeave={() => setBigVid(baseVid)}
                      onClick={() => onExpand({ src: tv, name })}
                    >
                      <video src={src} muted playsInline preload="metadata" />
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
    </div>
  );
}

export default function BrandCreators() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [cat, setCat] = useState('all');
  const [chatWith, setChatWith] = useState(null);
  const [briefFor, setBriefFor] = useState(null);
  const [videoCard, setVideoCard] = useState(null);
  const [preview, setPreview] = useState(null);   // quick-preview card
  const viewProfile = (c) => setPreview(c);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await axios.get(`${API}/business/creator-directory`);
        const list = Array.isArray(res.data) ? res.data : (res.data?.creators || []);
        if (active) setCreators(list);
      } catch { /* ignore */ }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  // Sync the search box when the nav-bar search updates the ?q= param.
  useEffect(() => {
    const p = searchParams.get('q');
    if (p !== null) setQ(p);
  }, [searchParams]);

  const categories = useMemo(() => {
    const set = new Set(creators.map((c) => (c.primary_category || '').trim().toLowerCase()).filter(Boolean));
    return ['all', ...Array.from(set)];
  }, [creators]);

  const filtered = useMemo(() => creators.filter((c) => {
    const catv = (c.primary_category || '').toLowerCase();
    if (cat !== 'all' && catv !== cat) return false;
    if (q) { const t = q.toLowerCase(); if (!nameOf(c).toLowerCase().includes(t) && !catv.includes(t)) return false; }
    return true;
  }), [creators, cat, q]);

  const openChat = (c) => { setChatWith({ id: c.id, name: nameOf(c).replace('@', ''), photo: c.profile_photo }); };

  return (
    <BrandTopNavLayout>
      <div className="bc-head-row">
        <div className="cmk-page-head">
          <h1>Browse Creators</h1>
          <p>Find the perfect creators for your campaign.</p>
        </div>

        <div className="bc-cats">
          {categories.map((k) => (
            <button key={k} type="button" className={cat === k ? 'is-active' : ''} onClick={() => setCat(k)}>{k === 'all' ? 'All' : k.replace(/_/g, ' ')}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="cmk-empty">Loading creators…</div>
      ) : filtered.length === 0 ? (
        <EmptyState title="No creators found" message="No creators match your current search or filters. Try clearing them to see everyone." />
      ) : (
        <div className="bc-grid">
          {filtered.map((c) => <ReelCard key={c.id} c={c} onMessage={openChat} onView={viewProfile} onExpand={setVideoCard} />)}
        </div>
      )}

      {videoCard && (
        <div className="bc-vid-overlay" onClick={() => setVideoCard(null)}>
          <div className="bc-vid-card" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="bc-vid-close" aria-label="Close" onClick={() => setVideoCard(null)}><X size={20} /></button>
            <video src={videoCard.src} controls autoPlay playsInline className="bc-vid-el" />
            {videoCard.name && <div className="bc-vid-name">{videoCard.name}</div>}
          </div>
        </div>
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

      {briefFor && (
        <PlanBrief
          creatorId={briefFor.id}
          creatorName={nameOf(briefFor).replace('@', '')}
          onClose={() => setBriefFor(null)}
          onPublished={() => setBriefFor(null)}
        />
      )}

      {chatWith && <ChatPopup user={chatWith} onClose={() => setChatWith(null)} />}
    </BrandTopNavLayout>
  );
}
