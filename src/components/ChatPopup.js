import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Send, FileText, User } from 'lucide-react';
import { useAuth } from '../App';
import { apiErrorMessage } from '../utils/apiError';
import CreatorInviteModal from './CreatorInviteModal';
import CreatorProfileModal from './CreatorProfileModal';
import { findContactInfo } from './RevisionRequestModal';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const initial = (n) => (n || 'U').replace('@', '').charAt(0).toUpperCase();
const assetUrl = (u) => (!u ? '' : (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}/${String(u).replace(/^\//, '')}`));
const isVideo = (u) => /\.(mp4|webm|mov|m4v)$/i.test(String(u || '').split('?')[0]);
function pickMedia(arr) {
  for (const it of (arr || [])) {
    if (!it) continue;
    if (typeof it === 'string') return it;
    const u = it.url || it.video || it.videoUrl || it.link || (Array.isArray(it.urls) && it.urls[0]);
    if (u) return u;
  }
  return '';
}

const CARD_LABELS = {
  private_invitation: 'Private Invitation', custom_offer: 'Custom Offer',
  counter_offer: 'Counter Offer', revision_request: 'Revision Request', milestone_update: 'Milestone Update',
};
const CARD_HIDE = new Set(['response_deadline', 'expires_at', 'round', 'notify_admin', 'diff_vs_original']);

// Compact, read-only summary of a structured offer/invitation card so BOTH parties
// see the same deal context in the popup. Full accept/decline lives in the deal room.
function ActionCardMini({ card }) {
  const f = card.fields || {};
  const status = card.status || card.card_status;
  const rows = Object.entries(f).filter(([k, v]) => v != null && v !== '' && !CARD_HIDE.has(k)).slice(0, 6);
  return (
    <div className="cpop-card">
      <div className="cpop-card-h">
        <span>{CARD_LABELS[card.type] || String(card.type || 'Card').replace(/_/g, ' ')}</span>
        {status && <span className={`cpop-card-badge ${status}`}>{status}</span>}
      </div>
      {rows.map(([k, v]) => (
        <div key={k} className="cpop-card-row"><label>{k.replace(/_/g, ' ')}</label><span>{String(v)}</span></div>
      ))}
    </div>
  );
}

/**
 * Floating in-page chat popup. Opens a conversation with `user` (the creator)
 * without leaving the current page. `user` = { id, name, photo }.
 */
export default function ChatPopup({ user, onClose }) {
  const { user: me } = useAuth();
  // A brand sees the creator by FIRST NAME only (never full name / @username).
  const peerName = me?.role === 'business'
    ? (String(user.name || 'Creator').replace(/^@/, '').trim().split(/\s+/)[0] || 'Creator')
    : (user.name || 'Creator');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [profOpen, setProfOpen] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try { const r = await axios.get(`${API}/chat/${user.id}`); if (active) setMessages(r.data || []); }
      catch { /* thread may not exist yet */ }
    };
    load();
    const t = setInterval(load, 4000);
    return () => { active = false; clearInterval(t); };
  }, [user.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    // Keep everything on-platform: block phone numbers / email addresses before they
    // ever reach the server (this popup previously sent them through unchecked). Uses
    // the app's shared detector so the rule matches revision requests + video reviews.
    const contact = findContactInfo(text);
    if (contact) {
      toast.error(contact === 'email'
        ? 'Email addresses aren’t allowed — keep all communication on-platform.'
        : 'Phone numbers aren’t allowed — keep all communication on-platform.');
      return;
    }
    setSending(true);
    try {
      const res = await axios.post(`${API}/chat/send`, { recipient_id: user.id, message: text.trim() });
      // Backend may still flag/redact; surface it instead of silently "sending".
      if (res.data?.filtered) {
        toast.warning(`Message filtered for sharing contact details${res.data.warning_count ? ` — warning ${res.data.warning_count}/3` : ''}.`);
      }
      setText('');
      const r = await axios.get(`${API}/chat/${user.id}`);
      setMessages(r.data || []);
    } catch (err) {
      // 400 with a contact-info reason from the server → show its message, not a generic one.
      toast.error(apiErrorMessage(err, 'Failed to send message'));
    } finally { setSending(false); }
  };

  const photo = user.photo ? (user.photo.startsWith('http') ? user.photo : `${BACKEND_URL}${user.photo}`) : '';

  return (
    <>
    <div className={`cpop ${briefOpen ? 'is-behind' : ''}`}>
      <div className="cpop-head">
        <span className="cpop-ava">{photo ? <img src={photo} alt="" /> : initial(peerName)}</span>
        <div className="cpop-head-id"><strong>{peerName}</strong><small><i className="cpop-dot" /> Responds in ~30 min</small></div>
        <button type="button" className="cpop-x" aria-label="Close" onClick={onClose}><X size={18} /></button>
      </div>

      <div className="cpop-tools">
        {/* Only brands send briefs to creators — a creator never briefs anyone,
            so this button is brand-only. */}
        {me?.role === 'business' && (
          <button type="button" className="cpop-tool primary" onClick={() => setBriefOpen(true)}><FileText size={15} /> Send a Brief</button>
        )}
        <button type="button" className="cpop-tool" onClick={() => setProfOpen(true)}><User size={15} /> Profile</button>
      </div>

      <div className="cpop-body">
        <div className="cpop-note">🔒 To protect both parties, avoid sharing contact details until the brief is shared.</div>
        {messages.length === 0 ? (
          <div className="cpop-empty">Say hello to start the conversation 👋</div>
        ) : (
          messages.map((m, i) => {
            // Show offer / invitation / counter cards too — the brand's popup used to
            // filter these out, so it never saw the booking request, price proposal or
            // acceptance that the creator's chat showed.
            if (m.item_type === 'action_card') return <ActionCardMini key={m.id || i} card={m} />;
            const sys = m.system_message || m.sender_type === 'system' || m.sender_id === 'system';
            if (sys) return <div key={m.id || i} className="cpop-sys">{m.message}</div>;
            const own = String(m.sender_id) === String(me?.id);
            return (
              <div key={m.id || i} className={`cpop-row ${own ? 'own' : ''}`}>
                <div className="cpop-bub">{m.message}</div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form className="cpop-input" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message…" />
        <button type="submit" disabled={sending || !text.trim()} aria-label="Send"><Send size={17} /></button>
      </form>
    </div>

      {briefOpen && (
        <CreatorInviteModal
          creatorId={user.id}
          onClose={() => setBriefOpen(false)}
          onPublished={() => setBriefOpen(false)}
        />
      )}

      {profOpen && (
        <CreatorProfileModal
          id={user.id}
          fallbackName={user.name}
          photo={user.photo}
          onClose={() => setProfOpen(false)}
          onMessage={() => setProfOpen(false)}
          // Brand-only — a creator shouldn't get a "Send a Brief" action here either.
          onBegin={me?.role === 'business' ? () => { setProfOpen(false); setBriefOpen(true); } : undefined}
        />
      )}

      <style>{`
        .cpop-tools{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px 14px;border-bottom:1px solid #eef0f6}
        .cpop-tool{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid #e9ebf4;background:#fff;color:#15163a;border-radius:10px;padding:9px;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;transition:.15s}
        .cpop-tool.primary{background:linear-gradient(100deg,#12124f,#07074e);border-color:transparent;color:#fff;box-shadow:0 12px 26px -12px rgba(7,7,78,.7)}
        .cpop-tool:hover{border-color:#cdd2f3}
        .cpop-tool.primary:hover{filter:brightness(1.06)}
        .cpop-prof-ov{position:fixed;inset:0;background:rgba(15,22,58,.55);z-index:1300;display:flex;align-items:center;justify-content:center;padding:20px}
        .cpop-prof{width:min(340px,100%);background:#fff;border-radius:18px;overflow:hidden;box-shadow:0 24px 60px rgba(15,22,58,.4)}
        .cpop-prof-media{position:relative;aspect-ratio:3/4;background:#0b1020}
        .cpop-prof-media video,.cpop-prof-media img,.cpop-prof-fb{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
        .cpop-prof-fb{display:grid;place-items:center;color:#fff;font-size:46px;font-weight:800;background:linear-gradient(135deg,#5b6bff,#23236a)}
        .cpop-prof-x{position:absolute;top:10px;right:10px;width:32px;height:32px;border-radius:50%;border:none;background:rgba(0,0,0,.5);color:#fff;cursor:pointer;display:grid;place-items:center;z-index:2}
        .cpop-prof-body{padding:16px 18px}
        .cpop-prof-body h3{margin:0 0 4px;font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:18px;color:#15163a}
        .cpop-prof-body p{margin:0;color:#585c7e;font-size:13.5px;text-transform:capitalize}
        .cpop-prof-bio{display:block;margin-top:10px;color:#585c7e;font-size:13px;line-height:1.5}

        .cpop{position:fixed;right:24px;bottom:24px;width:360px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 48px);
          background:#fff;border:1px solid #e9ebf4;border-radius:18px;box-shadow:0 28px 64px rgba(15,22,58,.32);
          display:flex;flex-direction:column;overflow:hidden;z-index:1200;animation:cpop-in .22s cubic-bezier(.2,.7,.2,1)}
        .cpop.is-behind{z-index:900}
        @keyframes cpop-in{from{transform:translateY(20px);opacity:.5}to{transform:none;opacity:1}}
        .cpop-head{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid #eef0f6}
        .cpop-ava{width:38px;height:38px;border-radius:50%;flex:none;overflow:hidden;display:grid;place-items:center;
          background:linear-gradient(135deg,#5b6bff,#23236a);color:#fff;font-weight:800}
        .cpop-ava img{width:100%;height:100%;object-fit:cover}
        .cpop-head-id strong{display:block;font-size:14.5px;color:#15163a;line-height:1.2}
        .cpop-head-id small{color:#9296ba;font-size:12px;display:flex;align-items:center;gap:5px}
        .cpop-dot{width:7px;height:7px;border-radius:50%;background:#22c55e;display:inline-block}
        .cpop-note{background:#eef0ff;border:1px solid #dfe2ff;color:#4452f0;font-size:11.5px;line-height:1.4;padding:8px 11px;border-radius:10px}
        .cpop-x{margin-left:auto;border:none;background:#f1f3fa;color:#15163a;width:32px;height:32px;border-radius:9px;cursor:pointer;display:grid;place-items:center}
        .cpop-body{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px;background:#fafbff}
        .cpop-empty{margin:auto;color:#9296ba;font-size:13.5px;text-align:center}
        .cpop-sys{align-self:center;background:#eef0f6;color:#585c7e;font-size:11.5px;padding:5px 12px;border-radius:14px}
        .cpop-card{align-self:stretch;background:#f7f8ff;border:1px solid #e5e8fb;border-radius:12px;padding:12px 14px;margin:2px 0}
        .cpop-card-h{display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:800;color:#15163a;font-size:12.5px;margin-bottom:8px}
        .cpop-card-badge{text-transform:capitalize;font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;background:#eef0f6;color:#585c7e}
        .cpop-card-badge.accepted{background:#ecfdf3;color:#067647}
        .cpop-card-badge.open,.cpop-card-badge.pending{background:#fff8ed;color:#b45309}
        .cpop-card-badge.rejected,.cpop-card-badge.declined{background:#fef3f2;color:#b42318}
        .cpop-card-row{display:flex;justify-content:space-between;gap:12px;font-size:12px;padding:3px 0}
        .cpop-card-row label{color:#8a90a6;text-transform:capitalize}
        .cpop-card-row span{color:#1a202c;font-weight:600;text-align:right;word-break:break-word}
        .cpop-row{display:flex}
        .cpop-row.own{justify-content:flex-end}
        .cpop-bub{max-width:78%;padding:9px 13px;border-radius:14px;font-size:13.5px;line-height:1.45;background:#fff;border:1px solid #eef0f6;color:#15163a}
        .cpop-row.own .cpop-bub{background:linear-gradient(100deg,#5b6bff,#4452f0);color:#fff;border-color:transparent}
        .cpop-input{display:flex;gap:8px;padding:12px;border-top:1px solid #eef0f6}
        .cpop-input input{flex:1;border:1px solid #e9ebf4;border-radius:30px;padding:10px 16px;font-family:inherit;font-size:14px;outline:none;color:#15163a}
        .cpop-input input:focus{border-color:#c3cbff}
        .cpop-input button{width:42px;height:42px;flex:none;border:none;border-radius:50%;background:linear-gradient(100deg,#12124f,#07074e);color:#fff;cursor:pointer;display:grid;place-items:center}
        .cpop-input button:disabled{opacity:.5;cursor:not-allowed}
      `}</style>
    </>
  );
}
