import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import ChatPopup from '../components/ChatPopup';
import '../styles/creator-marketplace.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const assetUrl = (u) => (!u ? '' : (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}/${String(u).replace(/^\//, '')}`));
const isVideo = (u) => /\.(mp4|webm|mov|m4v)$/i.test(String(u || '').split('?')[0]);
// Portrait sample reels (served from public/) used when a creator has no portfolio video.
const FALLBACK_VIDEOS = [
  '/creator/video_01.mp4', '/creator/video_08.mp4', '/creator/video_27.mp4', '/creator/video_28.mp4',
  '/creator/video_29.mp4', '/creator/video_30.mp4', '/creator/video_32.mp4', '/creator/video_33.mp4',
  '/creator/video_34.mp4', '/creator/video_35.mp4',
];
const creatorName = (c) => (c.name || '').trim() || (c.full_name || '').trim() || (c.nickname || '').trim() || (c.username ? `@${c.username}` : '') || 'Creator';
const initial = (c) => (creatorName(c).replace('@', '').charAt(0) || 'C').toUpperCase();

function CreatorCard({ c, onMessage, fallback }) {
  const ref = useRef(null);
  const media = assetUrl(c.portfolio_preview);
  const photo = assetUrl(c.profile_photo);
  const videoSrc = (media && isVideo(media)) ? `${media}#t=0.4` : fallback;

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
      } catch { /* ignore */ }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  const messageCreator = (c) => setChatWith({ id: c.id, name: creatorName(c).replace('@', ''), photo: c.profile_photo });
  // Two rows of six. If fewer than 12 creators exist, repeat them to fill both rows.
  const TARGET = 12;
  const shown = creators.length
    ? (creators.length >= TARGET ? creators.slice(0, TARGET) : Array.from({ length: TARGET }, (_, i) => creators[i % creators.length]))
    : [];

  return (
    <BrandTopNavLayout>
      {loading ? (
        <div className="cmk-empty">Loading creators…</div>
      ) : shown.length === 0 ? (
        <div className="cmk-empty">No creators available yet.</div>
      ) : (
        <div className="bo-cre-grid">
          {shown.map((c, i) => <CreatorCard key={i} c={c} onMessage={messageCreator} fallback={FALLBACK_VIDEOS[i % FALLBACK_VIDEOS.length]} />)}
        </div>
      )}

      {chatWith && <ChatPopup user={chatWith} onClose={() => setChatWith(null)} />}
    </BrandTopNavLayout>
  );
}
