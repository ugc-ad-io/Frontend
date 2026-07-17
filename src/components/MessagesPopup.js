import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Search } from 'lucide-react';
import { getInitial } from './CreatorComponents';
import { displayName } from '../utils/displayName';
import ChatPopup from './ChatPopup';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const ATTACHMENT_MESSAGE_PREFIX = '__UGCAD_ATTACHMENT__:';

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
  const [conversations, setConversations] = useState([]);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(null); // { id, name, photo }

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await axios.get(`${API}/chat/conversations`);
        if (alive) setConversations(Array.isArray(r.data) ? r.data : []);
      } catch { /* thread list may be empty / offline */ }
    };
    load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // When a conversation is picked, reuse ChatPopup for the thread view. Its
  // close returns to the list rather than closing the whole launcher.
  if (active) {
    return <ChatPopup user={active} onClose={() => setActive(null)} />;
  }

  // Show the real NAME (never the "@handle") — same resolver used app-wide.
  const nameOf = (c) => displayName(c, 'User');

  const filtered = conversations.filter((c) =>
    nameOf(c).toLowerCase().includes(q.trim().toLowerCase()));

  return (
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
        {filtered.length === 0 ? (
          <div className="mpop-empty">{conversations.length ? 'No matches' : 'No conversations yet'}</div>
        ) : (
          filtered.map((c) => (
            <button
              key={c.user_id}
              type="button"
              className="mpop-item"
              onClick={() => setActive({ id: c.user_id, name: nameOf(c), photo: c.profile_photo || c.photo })}
            >
              <span className="mpop-ava" style={{ background: avatarColor(nameOf(c)) }}>{getInitial(nameOf(c))}</span>
              <span className="mpop-body">
                <span className="mpop-top">
                  <strong>{nameOf(c)}</strong>
                  <small>{timeAgo(c.timestamp || c.last_message?.timestamp)}</small>
                </span>
                <span className="mpop-prev">{previewText(c)}</span>
              </span>
              {c.unread_count > 0 && <span className="mpop-badge">{c.unread_count}</span>}
            </button>
          ))
        )}
      </div>

      <style>{`
        .mpop{position:fixed;right:24px;bottom:24px;width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 48px);
          background:#fff;border:1px solid #e9ebf4;border-radius:18px;box-shadow:0 28px 64px rgba(15,22,58,.32);
          display:flex;flex-direction:column;overflow:hidden;z-index:1200;animation:mpop-in .22s cubic-bezier(.2,.7,.2,1)}
        @keyframes mpop-in{from{transform:translateY(20px);opacity:.5}to{transform:none;opacity:1}}
        .mpop-head{display:flex;align-items:center;padding:14px 16px;border-bottom:1px solid #eef0f6}
        .mpop-head strong{font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:16px;color:#15163a}
        .mpop-x{margin-left:auto;border:none;background:#f1f3fa;color:#15163a;width:32px;height:32px;border-radius:9px;cursor:pointer;display:grid;place-items:center}
        .mpop-x:hover{background:#e7eaf5}
        .mpop-search{display:flex;align-items:center;gap:8px;margin:12px;padding:0 12px;height:40px;flex:none;
          background:#f5f6fc;border:1px solid #eef0f6;border-radius:12px;color:#9296ba}
        .mpop-search input{flex:1;border:none;background:none;outline:none;font-family:inherit;font-size:13.5px;color:#15163a}
        .mpop-list{flex:1;overflow-y:auto;padding:4px 8px 10px}
        .mpop-empty{margin:40px 0;text-align:center;color:#9296ba;font-size:13.5px}
        .mpop-item{display:flex;align-items:center;gap:11px;width:100%;padding:10px;border:none;background:none;cursor:pointer;
          border-radius:12px;text-align:left;font-family:inherit;transition:background .15s}
        .mpop-item:hover{background:#f5f6fc}
        .mpop-ava{width:40px;height:40px;flex:none;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:800;font-size:15px}
        .mpop-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
        .mpop-top{display:flex;align-items:baseline;gap:8px}
        .mpop-top strong{flex:1;min-width:0;font-size:14px;color:#15163a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .mpop-top small{flex:none;font-size:11.5px;color:#9296ba}
        .mpop-prev{font-size:12.5px;color:#7a7fa6;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .mpop-badge{flex:none;min-width:20px;height:20px;padding:0 6px;border-radius:10px;background:#5b6bff;color:#fff;
          font-size:11.5px;font-weight:700;display:grid;place-items:center}
      `}</style>
    </div>
  );
}
