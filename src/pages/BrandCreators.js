import { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Search, Play, VolumeX, Volume2, Maximize2, X, Star } from 'lucide-react';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import ChatPopup from '../components/ChatPopup';
import CreatorProfileModal from '../components/CreatorProfileModal';
import PlanBrief from './PlanBrief';
import '../styles/creator-marketplace.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const assetUrl = (u) => (!u ? '' : (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}/${String(u).replace(/^\//, '')}`));
const isVideo = (u) => /\.(mp4|webm|mov|m4v)$/i.test(String(u || '').split('?')[0]);
const FALLBACK_VIDEOS = [
  '/creator/video_01.mp4', '/creator/video_08.mp4', '/creator/video_27.mp4', '/creator/video_28.mp4',
  '/creator/video_29.mp4', '/creator/video_30.mp4', '/creator/video_32.mp4', '/creator/video_33.mp4',
  '/creator/video_34.mp4', '/creator/video_35.mp4',
];
const nameOf = (c) => (c.name || '').trim() || (c.full_name || '').trim() || (c.nickname || '').trim() || (c.username ? `@${c.username}` : '') || 'Creator';
const initialOf = (c) => (nameOf(c).replace('@', '').charAt(0) || 'C').toUpperCase();

function ReelCard({ c, onView, fallback }) {
  const vref = useRef(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const media = assetUrl(c.portfolio_preview);
  const videoSrc = (media && isVideo(media)) ? `${media}#t=0.5` : fallback;
  const rating = Number(c.average_rating ?? c.rating ?? c.avg_rating ?? 0);
  const grade = rating >= 4.8 ? 'A+' : rating >= 4.5 ? 'A' : rating >= 4 ? 'B+' : rating >= 3 ? 'B' : rating > 0 ? 'C' : 'New';

  const togglePlay = () => {
    if (!vref.current) return;
    if (vref.current.paused) { vref.current.play().then(() => setPlaying(true)).catch(() => {}); }
    else { vref.current.pause(); setPlaying(false); }
  };

  return (
    <div className="bc-card">
      <div className="bc-reel" onClick={togglePlay}>
        <video ref={vref} src={videoSrc} muted={muted} loop playsInline preload="metadata" />
        <div className="bc-rate">
          <span className="bc-grade">{grade}</span>
          <span className="bc-stars"><Star size={12} fill="currentColor" /> {rating ? rating.toFixed(1) : 'New'}</span>
        </div>
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
        <button type="button" className="bc-expand" aria-label="Expand" onClick={(e) => { e.stopPropagation(); onView(c); }}>
          <Maximize2 size={14} />
        </button>
      </div>

      <div className="bc-meta">
        <span className="bc-ava">{assetUrl(c.profile_photo) ? <img src={assetUrl(c.profile_photo)} alt="" /> : initialOf(c)}</span>
        <div className="bc-name"><strong>{nameOf(c).replace('@', '')}</strong><small>India</small></div>
        <button type="button" className="bc-view" onClick={() => onView(c)}>View Profile</button>
      </div>
    </div>
  );
}

export default function BrandCreators() {
  const [searchParams] = useSearchParams();
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState(searchParams.get('q') || '');
  const [cat, setCat] = useState('all');
  const [chatWith, setChatWith] = useState(null);
  const [profile, setProfile] = useState(null);
  const [briefFor, setBriefFor] = useState(null);

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

  const openChat = (c) => { setProfile(null); setChatWith({ id: c.id, name: nameOf(c).replace('@', ''), photo: c.profile_photo }); };

  return (
    <BrandTopNavLayout>
      <div className="cmk-page-head" style={{ marginBottom: 14 }}>
        <h1>Browse Creators</h1>
        <p>Find the perfect creators for your campaign.</p>
      </div>

      <div className="bc-filters">
        <div className="bc-search">
          <Search size={18} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, niche, location..." />
        </div>
        <select defaultValue=""><option value="">Select Language</option><option>Hinglish</option><option>Hindi</option><option>English</option></select>
        <select defaultValue=""><option value="">Select Country</option><option>India</option></select>
        <select defaultValue=""><option value="">Select Gender</option><option>Female</option><option>Male</option></select>
      </div>

      <div className="bc-cats">
        {categories.map((k) => (
          <button key={k} type="button" className={cat === k ? 'is-active' : ''} onClick={() => setCat(k)}>{k === 'all' ? 'All' : k.replace(/_/g, ' ')}</button>
        ))}
      </div>

      {loading ? (
        <div className="cmk-empty">Loading creators…</div>
      ) : filtered.length === 0 ? (
        <div className="cmk-empty">No creators match your filters.</div>
      ) : (
        <div className="bc-grid">
          {filtered.map((c, i) => <ReelCard key={c.id} c={c} onMessage={openChat} onView={setProfile} fallback={FALLBACK_VIDEOS[i % FALLBACK_VIDEOS.length]} />)}
        </div>
      )}

      {profile && (
        <CreatorProfileModal
          id={profile.id}
          fallbackName={nameOf(profile)}
          photo={profile.profile_photo}
          onClose={() => setProfile(null)}
          onMessage={() => { openChat(profile); }}
          onBegin={() => { const c = profile; setProfile(null); setBriefFor(c); }}
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
