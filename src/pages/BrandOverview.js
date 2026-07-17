import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import ChatPopup from '../components/ChatPopup';
import '../styles/creator-marketplace.css';
import EmptyState from '../components/EmptyState';
import { firstName } from '../utils/displayName';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const assetUrl = (u) => (!u ? '' : (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}/${String(u).replace(/^\//, '')}`));
const isVideo = (u) => /\.(mp4|webm|mov|m4v)$/i.test(String(u || '').split('?')[0]);
const creatorName = (c) => firstName(c, 'Creator');
const initial = (c) => (creatorName(c).replace('@', '').charAt(0) || 'C').toUpperCase();

function CreatorCard({ c, onMessage }) {
  const ref = useRef(null);
  const media = assetUrl(c.portfolio_preview);
  const photo = assetUrl(c.profile_photo);
  // Only the creator's own uploaded reel (the showcase is pre-filtered to those who have one).
  const videoSrc = `${media}#t=0.4`;

  return (
    <div className="bo-cre-item">
      <article
        className="bo-cre-card"
        onMouseEnter={() => { if (ref.current) ref.current.play?.().catch(() => {}); }}
        onMouseLeave={() => { if (ref.current) { ref.current.pause?.(); ref.current.currentTime = 0; } }}
        onClick={() => onMessage(c)}
      >
        <div className="bo-cre-media">
          <video ref={ref} src={videoSrc} muted loop playsInline preload="metadata" />
        </div>
        <div className="bo-cre-shade" />
        {c.premium && <span className="bo-cre-premium">Premium</span>}
      </article>
      <button type="button" className="bo-cre-send" onClick={() => onMessage(c)}>
        <span className="bo-cre-msg-ava">
          {photo ? <img src={photo} alt="" /> : initial(c)}
          <i />
        </span>
        <span>Message {creatorName(c).replace('@', '')}</span>
      </button>
    </div>
  );
}

export default function BrandOverview() {
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chatWith, setChatWith] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await axios.get(`${API}/business/creator-directory`);
        const list = Array.isArray(res.data) ? res.data : (res.data?.creators || []);
        if (active) setCreators(list);
      } catch { if (active) setCreators([]); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  const messageCreator = (c) => setChatWith({ id: c.id, name: creatorName(c).replace('@', ''), photo: c.profile_photo });
  // Showcase only creators who have their OWN uploaded reel — no stock/sample videos.
  const withVideo = creators.filter((c) => { const m = assetUrl(c.portfolio_preview); return m && isVideo(m); });
  // A single showcase row. If fewer than 6 such creators exist, repeat them to fill the row.
  const TARGET = 6;
  const shown = withVideo.length
    ? (withVideo.length >= TARGET ? withVideo.slice(0, TARGET) : Array.from({ length: TARGET }, (_, i) => withVideo[i % withVideo.length]))
    : [];

  return (
    <BrandTopNavLayout>
      {loading ? (
        <div className="cmk-empty">Loading creators…</div>
      ) : shown.length === 0 ? (
        <EmptyState title="No creators yet" message="Approved creators will appear here. Check back soon to start collaborating." />
      ) : (
        <div className="bo-cre-grid bov-reels">
          {shown.map((c, i) => <CreatorCard key={i} c={c} onMessage={messageCreator} />)}
        </div>
      )}

      {chatWith && <ChatPopup user={chatWith} onClose={() => setChatWith(null)} />}
    </BrandTopNavLayout>
  );
}
