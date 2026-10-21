import { useLiveEffect } from '../lib/liveUpdates';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Search } from 'lucide-react';
import { getInitial } from './CreatorComponents';
import { displayName, creatorFirstName } from '../utils/displayName';
import { useAuth } from '../App';
import ChatPopup from './ChatPopup';
import { Skeleton } from './Skeleton';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const ATTACHMENT_MESSAGE_PREFIX = '__UGCAD_ATTACHMENT__:';

// Build a full URL for a stored photo path (absolute URLs pass through).
const assetUrl = (u) => (!u ? '' : (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}/${String(u).replace(/^\//, '')}`));
// The conversations API returns the avatar as `profile_picture` (brands may only
// have a profile.logo). Cover every shape so the photo actually resolves.
const photoOf = (c) => c?.profile_picture || c?.profile_photo || c?.photo
  || (c?.profile && (c.profile.logo || c.profile.profile_photo)) || '';

const avatarColor = (name) => {
  const s = String(name || 'U');
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = s.charCodeAt(i) + ((h << 5) - h);
  return `hsl(${Math.abs(h) % 360} 62% 52%)`;
};

const timeAgo = (ts) => {
  if (!ts) return '';
  const then = new Date(ts).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

const previewText = (conv) => {
  const raw = conv?.last_message?.message || '';
  if (!raw) return conv?.last_message ? 'Attachment' : '';
  if (raw.startsWith(ATTACHMENT_MESSAGE_PREFIX)) return 'File attachment';
  return raw.length > 42 ? `${raw.slice(0, 42)}…` : raw;
};

/**
 * Floating Messages launcher card — shows the conversation list at the same
 * bottom-right size as ChatPopup. Selecting a conversation opens that chat in
 * the same card (via ChatPopup); its close button returns to the list.
 */
export default function MessagesPopup({ onClose }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false); // the list could not be loaded (offline / server down)
  const [retryTick, setRetryTick] = useState(0);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(null); // { id, name, photo, dealId?, title? }
  const [deals, setDeals] = useState([]);        // one chat per campaign/deal
  // A brand sees a creator by FIRST NAME only; a creator keeps the brand's full name.
  const nameOf = (c) => (user?.role === 'business' ? creatorFirstName(c) : displayName(c, 'User'));

  // Close on Escape — pairs with the tap-outside backdrop below.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useLiveEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await axios.get(`${API}/chat/conversations`);
        if (alive) { setConversations(Array.isArray(r.data) ? r.data : []); setFailed(false); }
      } catch { if (alive) setFailed(true); }
      finally { if (alive) setLoading(false); }
    };
    // Each campaign gets its own chat; the 1:1 thread merged every campaign together.
    const loadDeals = async () => {
      try {
        const r = await axios.get(`${API}/deals/${user?.role === 'business' ? 'business' : 'my'}`);
        if (alive) setDeals(Array.isArray(r.data) ? r.data : []);
      } catch { /* deals are optional here — the people list still works */ }
    };
    load();
    loadDeals();
    const t = setInterval(load, 5000);
    // Deals are heavier to build server-side, so they refresh far less often.
    const td = setInterval(loadDeals, 20000);
    return () => { alive = false; clearInterval(t); clearInterval(td); };
  }, [user?.role, retryTick]);

  // When a conversation is picked, reuse ChatPopup for the thread view. Its
  // close returns to the list rather than closing the whole launcher.
  if (active) {
    return <ChatPopup user={active} dealId={active.dealId} title={active.title} onClose={() => setActive(null)} />;
  }

  const needle = q.trim().toLowerCase();
  const isBrand = user?.role === 'business';
  const campaignRows = deals.map((d) => {
    const msgs = d.chat_summary?.messages || [];
    const last = [...msgs].reverse().find((m) => m.sender_type !== 'system') || msgs[msgs.length - 1] || null;
    const partner = isBrand ? d.creator : d.brand;
    const partnerName = isBrand
      ? (String(partner?.name || 'Creator').replace(/^@/, '').trim().split(/\s+/)[0] || 'Creator')
      : String(partner?.name || 'Brand').replace(/^@/, '').trim();
    return {
      key: d.deal_id,
      dealId: d.deal_id,
      title: d.campaign?.title || 'Campaign',
      partnerId: partner?.id,
      partnerName,
      photo: isBrand ? (partner?.profile_photo || '') : (partner?.logo_url || ''),
      last,
      ts: last?.created_at || '',
      unread: Number(d.unread_count || 0),
    };
  }).filter((r) => r.partnerId
    && `${r.title} ${r.partnerName}`.toLowerCase().includes(needle))
    .sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
  // People you already have a campaign chat with are shown under that campaign, not again.
  const dealPartners = new Set(deals.map((d) => String((isBrand ? d.creator : d.brand)?.id || '')));
  const filtered = conversations.filter((c) =>
    !dealPartners.has(String(c.user_id)) && nameOf(c).toLowerCase().includes(needle));

  return (
    <>
      {/* Tap anywhere outside the card to dismiss. Transparent on desktop (just a
          click-catcher); dimmed on phones so it reads as a modal layer. */}
      <div className="mpop-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="mpop">
      <div className="mpop-head">
        <strong>Messages</strong>
        <button type="button" className="mpop-x" aria-label="Close" onClick={onClose}><X size={18} /></button>
      </div>

      <div className="mpop-search">
        <Search size={15} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search conversations…"
          aria-label="Search conversations"
        />
      </div>

      <div className="mpop-list">
        {loading && conversations.length === 0 ? (
          // Skeleton rows while the first load is in flight — avoids a brief
          // "No conversations yet" flash before the threads arrive.
          Array.from({ length: 4 }).map((_, i) => (
            <div className="mpop-item" key={`sk-${i}`} aria-hidden="true" style={{ cursor: 'default' }}>
              <Skeleton width={40} height={40} radius="50%" />
              <span className="mpop-body">
                <Skeleton width="55%" height={13} />
                <Skeleton width="80%" height={11} style={{ marginTop: 7 }} />
              </span>
            </div>
          ))
        ) : failed && conversations.length === 0 && deals.length === 0 ? (
          <div className="mpop-empty" role="alert">
            {typeof navigator !== 'undefined' && navigator.onLine === false ? "You're offline. Check your connection." : 'Could not load your messages.'}
            <br />
            <button type="button" className="mpop-retry" onClick={() => { setLoading(true); setRetryTick((t) => t + 1); }}>Retry</button>
          </div>
        ) : filtered.length === 0 && campaignRows.length === 0 ? (
          <div className="mpop-empty">{conversations.length || deals.length ? 'No matches' : 'No conversations yet'}</div>
        ) : (
          <>
          {campaignRows.length > 0 && <div className="mpop-sec">Campaigns</div>}
          {campaignRows.map((r) => (
            <button
              key={r.key}
              type="button"
              className="mpop-item"
              onClick={() => setActive({ id: r.partnerId, name: r.partnerName, photo: r.photo, dealId: r.dealId, title: r.title })}
            >
              <span className="mpop-ava" style={{ background: avatarColor(r.title) }}>
                {getInitial(r.title)}
                {assetUrl(r.photo) && (
                  <img src={assetUrl(r.photo)} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                )}
              </span>
              <span className="mpop-body">
                <span className="mpop-top">
                  <strong>{r.title}</strong>
                  <small>{timeAgo(r.ts)}</small>
                </span>
                <span className="mpop-prev">
                  {r.partnerName}{r.last?.message ? ` · ${String(r.last.message).startsWith(ATTACHMENT_MESSAGE_PREFIX) ? 'File attachment' : String(r.last.message).slice(0, 36)}` : ''}
                </span>
              </span>
              {r.unread > 0 && <span className="mpop-badge">{r.unread}</span>}
            </button>
          ))}
          {filtered.length > 0 && campaignRows.length > 0 && <div className="mpop-sec">Direct messages</div>}
          {filtered.map((c) => (
            <button
              key={c.user_id}
              type="button"
              className="mpop-item"
              onClick={() => setActive({ id: c.user_id, name: nameOf(c), photo: photoOf(c) })}
            >
              <span className="mpop-ava" style={{ background: avatarColor(nameOf(c)) }}>
                {getInitial(nameOf(c))}
                {assetUrl(photoOf(c)) && (
                  <img src={assetUrl(photoOf(c))} alt="" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                )}
              </span>
              <span className="mpop-body">
                <span className="mpop-top">
                  <strong>{nameOf(c)}</strong>
                  <small>{timeAgo(c.timestamp || c.last_message?.timestamp)}</small>
                </span>
                <span className="mpop-prev">{previewText(c)}</span>
              </span>
              {c.unread_count > 0 && <span className="mpop-badge">{c.unread_count}</span>}
            </button>
          ))}
          </>
        )}
      </div>

      <style>{`
        .mpop-backdrop{position:fixed;inset:0;z-index:1199;background:transparent}
        @media (max-width:640px){ .mpop-backdrop{background:rgba(15,22,58,.35)} }
        .mpop{position:fixed;right:calc(24px + env(safe-area-inset-right,0px));bottom:calc(24px + env(safe-area-inset-bottom,0px));width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 48px);max-height:calc(100dvh - 48px);
          background:#fff;border:1px solid #e9ebf4;border-radius:18px;box-shadow:0 28px 64px rgba(15,22,58,.32);
          display:flex;flex-direction:column;overflow:hidden;z-index:1200;animation:mpop-in .22s cubic-bezier(.2,.7,.2,1)}
        @keyframes mpop-in{from{transform:translateY(20px);opacity:.5}to{transform:none;opacity:1}}
        @media (max-width:640px){
          .mpop{left:max(8px,env(safe-area-inset-left));right:max(8px,env(safe-area-inset-right));bottom:max(8px,env(safe-area-inset-bottom));width:auto;max-width:none;
            max-height:calc(100dvh - 16px - env(safe-area-inset-top,0px))}
        }
        .mpop-retry{margin-top:10px;min-height:44px;padding:0 18px;border:1px solid #e9ebf4;border-radius:10px;background:#fff;color:#4452f0;font:inherit;font-weight:700;cursor:pointer}
        .mpop-head{display:flex;align-items:center;padding:14px 16px;border-bottom:1px solid #eef0f6}
        .mpop-head strong{font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:16px;color:#15163a}
        .mpop-x{margin-left:auto;border:none;background:#f1f3fa;color:#15163a;width:40px;height:40px;border-radius:9px;cursor:pointer;display:grid;place-items:center}
        .mpop-x:hover{background:#e7eaf5}
        .mpop-search{display:flex;align-items:center;gap:8px;margin:12px;padding:0 12px;height:40px;flex:none;
          background:#f5f6fc;border:1px solid #eef0f6;border-radius:12px;color:#9296ba}
        .mpop-search input{flex:1;border:none;background:none;outline:none;font-family:inherit;font-size:13.5px;color:#15163a}
        .mpop-list{flex:1;overflow-y:auto;padding:4px 8px 10px}
        .mpop-sec{padding:8px 10px 4px;font-size:11px;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#9296ba}
        .mpop-empty{margin:40px 0;text-align:center;color:#9296ba;font-size:13.5px}
        .mpop-item{display:flex;align-items:center;gap:11px;width:100%;padding:10px;border:none;background:none;cursor:pointer;
          border-radius:12px;text-align:left;font-family:inherit;transition:background .15s}
        .mpop-item:hover{background:#f5f6fc}
        .mpop-ava{position:relative;width:40px;height:40px;flex:none;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:800;font-size:15px;overflow:hidden}
        .mpop-ava img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%}
        .mpop-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
        .mpop-top{display:flex;align-items:baseline;gap:8px}
        .mpop-top strong{flex:1;min-width:0;font-size:14px;color:#15163a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .mpop-top small{flex:none;font-size:11.5px;color:#9296ba}
        .mpop-prev{font-size:12.5px;color:#7a7fa6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .mpop-badge{flex:none;min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:#5b6bff;color:#fff;
          font-size:11.5px;font-weight:700;display:grid;place-items:center}
      `}</style>
      </div>
    </>
  );
}
