import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { X, Play, MessageSquare } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const assetUrl = (u) => (!u ? '' : (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}/${String(u).replace(/^\//, '')}`));
const isVideo = (u) => /\.(mp4|webm|mov|m4v)$/i.test(String(u || '').split('?')[0]);
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const FALLBACK_VIDEOS = [
  '/creator/video_01.mp4', '/creator/video_08.mp4', '/creator/video_27.mp4', '/creator/video_28.mp4',
  '/creator/video_29.mp4', '/creator/video_30.mp4', '/creator/video_32.mp4', '/creator/video_33.mp4',
];

function VideoTile({ url }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);
  const src = assetUrl(url);
  const toggle = () => {
    if (!ref.current) return;
    if (ref.current.paused) { ref.current.play().then(() => setPlaying(true)).catch(() => {}); }
    else { ref.current.pause(); setPlaying(false); }
  };
  return (
    <div className="cpm-vid" onClick={toggle}>
      {isVideo(src) ? <video ref={ref} src={`${src}#t=0.5`} playsInline loop /> : <img src={src} alt="" />}
      {!playing && <span className="cpm-play"><Play size={18} fill="currentColor" /></span>}
    </div>
  );
}

/**
 * Rich creator profile card — header details + portfolio videos + CTA footer.
 * Fetches /profile/:id. onMessage / onBegin are optional actions.
 */
export default function CreatorProfileModal({ id, fallbackName, photo, onClose, onMessage, onBegin }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let a = true;
    axios.get(`${API}/profile/${id}`).then((r) => { if (a) setData(r.data); }).catch(() => {}).finally(() => { if (a) setLoading(false); });
    return () => { a = false; };
  }, [id]);

  const p = data?.profile || {};
  // Show the website username/handle the admin assigns — never the creator's real name.
  const name = (data?.nickname || '').trim()
    || (data?.username ? `@${data.username}` : '')
    || (data?.public_creator_id || '').trim()
    || (fallbackName || '').trim()
    || 'Creator';
  const age = p.age;
  const gender = p.gender ? String(p.gender).charAt(0).toUpperCase() : '';
  const ageGender = [age, gender].filter(Boolean).join('');
  const city = p.city || p.location || '';
  const country = p.country || 'India';
  const cc = /india/i.test(country) ? 'IN' : country.slice(0, 2).toUpperCase();
  const languages = Array.isArray(p.languages) ? p.languages : (p.languages ? [p.languages] : []);
  const price = String(p.rate_card?.expected_payout || p.expectedPayout || '').replace(/[^0-9]/g, '');
  const avatar = assetUrl(data?.profile_photo || photo);
  const realVids = (data?.portfolio || [])
    .map((it) => (typeof it === 'string' ? it : ((Array.isArray(it.urls) && it.urls[0]) || it.original_url || it.url || it.video || '')))
    .filter((u) => u && !String(u).startsWith('blob:'));
  const vids = realVids.length ? realVids : FALLBACK_VIDEOS.slice(0, 6);

  return (
    <div className="cpm-ov" onClick={onClose}>
      <div className="cpm" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="cpm-x" onClick={onClose}><X size={18} /></button>

        <div className="cpm-head">
          <div className="cpm-id">
            <span className="cpm-ava">{avatar ? <img src={avatar} alt="" /> : name.charAt(0).toUpperCase()}</span>
            <div><strong>{name.replace('@', '')}</strong><small>{ageGender || 'Creator'}</small></div>
          </div>
          <div className="cpm-col"><span className="cpm-cc">{cc}</span><span className="cpm-loc">{[city, country].filter(Boolean).join(', ')}</span></div>
          <div className="cpm-col"><label>Languages</label><div className="cpm-langs">{languages.length ? languages.slice(0, 3).map((l, i) => <span key={i}>{l}</span>) : <span>—</span>}</div></div>
          <div className="cpm-col"><label>Price</label><strong className="cpm-price">{price ? `${inr(price)}/video` : 'On request'}</strong></div>
          <div className="cpm-col"><label>Avg Response</label><span className="cpm-resp">N/A</span></div>
        </div>

        <div className="cpm-body">
          {loading ? <div className="cpm-empty">Loading…</div>
            : <div className="cpm-vids">{vids.slice(0, 8).map((v, i) => <VideoTile key={i} url={v} />)}</div>}
        </div>

        <div className="cpm-foot">
          <div className="cpm-foot-text"><span>🧑‍🎤</span><div><strong>Ready to Get Started?</strong><p>Place your order on the platform to start work instantly and stay on track.</p></div></div>
          {onMessage && <button type="button" className="cpm-msg" onClick={onMessage}><MessageSquare size={15} /> Message</button>}
          {onBegin && <button type="button" className="cpm-begin" onClick={onBegin}>Send a Brief</button>}
        </div>
      </div>

      <style>{`
        .cpm-ov{position:fixed;inset:0;background:rgba(15,22,58,.5);backdrop-filter:blur(3px);z-index:1400;display:flex;align-items:center;justify-content:center;padding:20px}
        .cpm{position:relative;width:min(880px,100%);max-height:92vh;overflow:auto;background:#fff;border-radius:22px;box-shadow:0 30px 70px rgba(15,22,58,.4)}
        .cpm-x{position:absolute;top:16px;right:16px;width:36px;height:36px;border-radius:50%;border:none;background:#f1f3fa;color:#15163a;cursor:pointer;display:grid;place-items:center;z-index:2}
        .cpm-head{display:flex;align-items:center;gap:28px;flex-wrap:wrap;padding:24px 28px 18px;border-bottom:1px solid #eef0f6}
        .cpm-id{display:flex;align-items:center;gap:12px}
        .cpm-ava{width:46px;height:46px;border-radius:50%;flex:none;overflow:hidden;display:grid;place-items:center;background:linear-gradient(135deg,#5b6bff,#8b5cf6);color:#fff;font-weight:800;font-size:18px}
        .cpm-ava img{width:100%;height:100%;object-fit:cover}
        .cpm-id strong{display:block;font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:18px;color:#15163a}
        .cpm-id small{color:#9296ba;font-size:13px}
        .cpm-col{display:flex;flex-direction:column;gap:4px}
        .cpm-col label{font-size:11px;font-weight:700;color:#9296ba;text-transform:uppercase;letter-spacing:.4px}
        .cpm-cc{font-weight:800;color:#15163a;font-size:15px}
        .cpm-loc{color:#585c7e;font-size:12.5px;background:#f4f5fb;border-radius:14px;padding:3px 10px;width:fit-content}
        .cpm-langs{display:flex;gap:6px;flex-wrap:wrap}
        .cpm-langs span{background:#eef0ff;color:#5b6bff;font-size:12px;font-weight:600;padding:3px 10px;border-radius:14px}
        .cpm-price{color:#15163a;font-size:15px}
        .cpm-resp{color:#585c7e;font-size:13px;background:#f4f5fb;border-radius:14px;padding:3px 10px;width:fit-content}
        .cpm-body{padding:22px 28px}
        .cpm-vids{display:flex;flex-wrap:wrap;justify-content:center;gap:16px}
        .cpm-vid{position:relative;flex:0 0 auto;width:172px;aspect-ratio:3/4;border-radius:14px;overflow:hidden;background:#0b1020;cursor:pointer;box-shadow:0 8px 22px -12px rgba(15,22,58,.4)}
        .cpm-vid video,.cpm-vid img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
        .cpm-play{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.85);display:grid;place-items:center;color:#5b6bff;pointer-events:none}
        .cpm-empty{text-align:center;color:#9296ba;padding:30px 0;font-size:14px}
        .cpm-foot{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin:0 22px 22px;padding:16px 18px;background:#eef0ff;border:1px solid #dfe2ff;border-radius:16px}
        .cpm-foot-text{display:flex;align-items:center;gap:10px;flex:1;min-width:200px}
        .cpm-foot-text span{font-size:22px}
        .cpm-foot-text strong{display:block;color:#15163a;font-size:15px}
        .cpm-foot-text p{margin:2px 0 0;color:#585c7e;font-size:12.5px}
        .cpm-msg{display:inline-flex;align-items:center;gap:7px;background:#15163a;color:#fff;border:none;border-radius:30px;padding:11px 20px;font-weight:700;font-size:13.5px;cursor:pointer;font-family:inherit}
        .cpm-begin{background:linear-gradient(100deg,#5b6bff,#4452f0);color:#fff;border:none;border-radius:30px;padding:11px 22px;font-weight:800;font-size:13.5px;cursor:pointer;font-family:inherit}
        .cpm-begin:hover{filter:brightness(1.06)}
      `}</style>
    </div>
  );
}
