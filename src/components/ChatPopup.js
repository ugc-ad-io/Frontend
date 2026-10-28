import { useLiveEffect } from '../lib/liveUpdates';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Send, FileText, User } from 'lucide-react';
import { useAuth } from '../App';
import { apiErrorMessage } from '../utils/apiError';
import PlanBrief from '../pages/PlanBrief';
import CreatorProfileModal from './CreatorProfileModal';
import { findContactInfo } from './RevisionRequestModal';
import PhotoOrInitial from './PhotoOrInitial';
import SafetyMenu from './SafetyMenu';

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
export default function ChatPopup({ user, onClose, dealId = null, title = '' }) {
  const { user: me } = useAuth();
  // The opener sometimes passes a bare { id } (e.g. from a deal/conversation row)
  // with no name/photo — fetch the peer's profile to fill both in.
  const [peer, setPeer] = useState(null);
  useLiveEffect(() => {
    const needName = !user.name || user.name === 'Creator';
    const needPhoto = !user.photo;
    if (!user.id || !(needName || needPhoto)) return undefined;
    let alive = true;
    axios.get(`${API}/profile/${user.id}`).then((r) => {
      if (!alive) return;
      const d = r.data || {};
      const prof = d.profile || {};
      setPeer({
        name: d.nickname || d.name || prof.full_name || prof.fullName || '',
        photo: d.profile_photo || d.profile_picture || prof.profile_photo || prof.profile_picture || '',
      });
    }).catch(() => {});
    return () => { alive = false; };
  }, [user.id, user.name, user.photo]);

  // Mark the body while the chat is open so the creator profile's fixed bottom
  // "Send Message" bar (if the profile is still mounted behind) can be hidden.
  useEffect(() => {
    document.body.classList.add('cpop-open');
    return () => document.body.classList.remove('cpop-open');
  }, []);

  const resolvedName = (user.name && user.name !== 'Creator') ? user.name : (peer?.name || 'Creator');
  // A brand sees the creator by FIRST NAME only (never full name / @username).
  const peerName = me?.role === 'business'
    ? (String(resolvedName || 'Creator').replace(/^@/, '').trim().split(/\s+/)[0] || 'Creator')
    : (resolvedName || 'Creator');
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [profOpen, setProfOpen] = useState(false);
  const endRef = useRef(null);

  // Close this floating chat when the full-screen Post-a-Campaign brief opens — it
  // shouldn't sit on top of the wizard. (Broadcast from BrandTopNavLayout.)
  useEffect(() => {
    const close = () => onClose?.();
    window.addEventListener('ugcad:brief-opened', close);
    return () => window.removeEventListener('ugcad:brief-opened', close);
  }, [onClose]);

  useLiveEffect(() => {
    let active = true;
    const load = async () => {
      try {
        // Per-campaign mode reads that deal's own chat; otherwise the 1:1 thread.
        const r = dealId ? await axios.get(`${API}/deals/${dealId}/chat`) : await axios.get(`${API}/chat/${user.id}`);
        if (active) setMessages(dealId ? (r.data?.messages || []) : (r.data || []));
      } catch { /* thread may not exist yet */ }
    };
    load();
    const t = setInterval(load, 4000);
    return () => { active = false; clearInterval(t); };
  }, [user.id, dealId]);

  // The thread is re-fetched every 4s; only scroll when the newest message changed, so a user
  // reading older messages is not pulled back down on every poll.
  const lastKeyRef = useRef('');
  useEffect(() => {
    const last = messages[messages.length - 1];
    const key = last ? `${messages.length}:${last.id || last.created_at || last.timestamp || ''}` : '';
    if (key === lastKeyRef.current) return;
    const first = lastKeyRef.current === '';
    lastKeyRef.current = key;
    endRef.current?.scrollIntoView({ behavior: first ? 'auto' : 'smooth' });
  }, [messages]);

  const send = async (e) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    // Keep everything on-platform: block phone numbers / email addresses before they
    // ever reach the server (this popup previously sent them through unchecked). Uses
    // the app's shared detector so the rule matches revision requests + video reviews.
    const contact = findContactInfo(text);
    if (contact) {
      toast.error(contact === 'email'
        ? 'Email addresses aren’t allowed - keep all communication on-platform.'
        : 'Phone numbers aren’t allowed - keep all communication on-platform.');
      return;
    }
    setSending(true);
    try {
      if (dealId) {
        await axios.post(`${API}/deals/${dealId}/chat`, { message: text.trim(), attachment_urls: [] });
        setText('');
        const r = await axios.get(`${API}/deals/${dealId}/chat`);
        setMessages(r.data?.messages || []);
      } else {
        const res = await axios.post(`${API}/chat/send`, { recipient_id: user.id, message: text.trim() });
        // Backend may still flag/redact; surface it instead of silently "sending".
        if (res.data?.filtered) {
          toast.warning(`Message filtered for sharing contact details${res.data.warning_count ? ` - warning ${res.data.warning_count}/3` : ''}.`);
        }
        setText('');
        const r = await axios.get(`${API}/chat/${user.id}`);
        setMessages(r.data || []);
      }
    } catch (err) {
      // 400 with a contact-info reason from the server → show its message, not a generic one.
      toast.error(apiErrorMessage(err, 'Failed to send message'));
    } finally { setSending(false); }
  };

  const photo = assetUrl(user.photo || peer?.photo || '');

  return (
    <>
    <div className={`cpop ${briefOpen ? 'is-behind' : ''}`}>
      <div className="cpop-head">
        <span className="cpop-ava"><PhotoOrInitial src={photo} initial={initial(peerName)} /></span>
        <div className="cpop-head-id">
          <strong>{title || peerName}</strong>
          {title
            ? <small>with {peerName}</small>
            : <small>Direct message</small>}
        </div>
        <SafetyMenu userId={user.id} name={peerName} dealId={dealId} />
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
        <div className="cpop-note">To protect both parties, avoid sharing contact details until the brief is shared.</div>
        {messages.length === 0 ? (
          <div className="cpop-empty">Say hello to start the conversation</div>
        ) : (
          messages.map((m, i) => {
            // Show offer / invitation / counter cards too — the brand's popup used to
            // filter these out, so it never saw the booking request, price proposal or
            // acceptance that the creator's chat showed.
            if (m.item_type === 'action_card') return <ActionCardMini key={m.id || i} card={m} />;
            const sys = m.system_message || m.sender_type === 'system' || m.sender_id === 'system';
            if (sys) return <div key={m.id || i} className="cpop-sys">{m.message}</div>;
            // Deal messages carry sender_type (creator/brand), not the sender's user id.
            const own = dealId
              ? m.sender_type === (me?.role === 'business' ? 'brand' : 'creator')
              : String(m.sender_id) === String(me?.id);
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
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a message..." />
        <button type="submit" disabled={sending || !text.trim()} aria-label="Send"><Send size={17} /></button>
      </form>
    </div>

      {briefOpen && (
        <PlanBrief
          creatorId={user.id}
          creatorName={peerName}
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
        .cpop-tools{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px 14px;border-bottom:1px solid #EDEDF6}
        .cpop-tools:has(> :only-child){grid-template-columns:1fr}
        .cpop-tool{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:38px;border:1.5px solid #9f9fd1;background:#fff;color:#07074E;border-radius:999px;padding:0 14px;font-weight:600;font-size:13.5px;cursor:pointer;font-family:'Inter',system-ui,sans-serif;transition:background .15s}
        .cpop-tool.primary{background:#07074E;border-color:#07074E;color:#fff}
        .cpop-tool:hover{background:#F3F3FF}
        .cpop-tool.primary:hover{background:#12124f}
        .cpop-tool:focus-visible,.cpop-x:focus-visible,.cpop-input button:focus-visible{outline:2px solid #7387FF;outline-offset:2px}

        .cpop{position:fixed;right:calc(24px + env(safe-area-inset-right,0px));bottom:calc(24px + env(safe-area-inset-bottom,0px));width:400px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 48px);max-height:calc(100dvh - 48px);
          background:#fff;border:1px solid #E2E2F0;border-radius:20px;box-shadow:0 1px 2px rgba(7,7,78,.05),0 18px 40px -14px rgba(7,7,78,.32);
          display:flex;flex-direction:column;overflow:hidden;z-index:1200;font-family:'Inter',system-ui,sans-serif;color:#07074E;animation:cpop-in .2s ease-out}
        .cpop.is-behind{z-index:900}
        /* Phones: a full-width sheet pinned to the bottom (above the home bar), never wider than the screen. */
        @media (max-width:640px){
          .cpop{left:max(8px,env(safe-area-inset-left));right:max(8px,env(safe-area-inset-right));bottom:max(8px,env(safe-area-inset-bottom));width:auto;max-width:none;
            max-height:calc(100dvh - 16px - env(safe-area-inset-top,0px))}
        }
        @media (prefers-reduced-motion:reduce){.cpop{animation:none}}
        @keyframes cpop-in{from{transform:translateY(12px);opacity:.6}to{transform:none;opacity:1}}
        .cpop-head{display:flex;align-items:center;gap:12px;padding:14px 16px;border-bottom:1px solid #EDEDF6}
        .cpop-ava{width:40px;height:40px;border-radius:50%;flex:none;overflow:hidden;display:grid;place-items:center;background:#ECEDFA;color:#4E60E6;font-weight:700}
        .cpop-ava img{width:100%;height:100%;object-fit:cover}
        .cpop-head-id{min-width:0}
        .cpop-head-id strong{display:block;font-family:'Readex Pro','Plus Jakarta Sans',sans-serif;font-weight:500;font-size:16px;color:#07074E;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .cpop-head-id small{color:#6E6E96;font-size:12.5px;display:flex;align-items:center;gap:5px}
        .cpop-note{background:#F3F3FF;color:#6E6E96;font-size:12px;line-height:1.45;padding:9px 12px;border-radius:12px}
        .cpop-x{margin-left:auto;border:0;background:transparent;color:#6E6E96;width:40px;height:40px;border-radius:50%;cursor:pointer;display:grid;place-items:center}
        .cpop-x:hover{background:#F3F3FF;color:#07074E}
        .cpop-body{flex:1;min-width:0;overflow-y:auto;overflow-x:hidden;padding:16px;display:flex;flex-direction:column;gap:10px;background:#FAFAFF}
        .cpop-empty{margin:auto;color:#6E6E96;font-size:14px;text-align:center}
        /* System notices can carry a whole campaign brief: flat rectangle, pre-wrap, never wider than the column. */
        .cpop-sys{align-self:stretch;width:100%;min-width:0;max-width:100%;box-sizing:border-box;
          text-align:left;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word;
          background:#EEF0FF;border-radius:14px;color:#2A3AB8;font-size:12.5px;line-height:1.6;padding:12px 14px;margin:2px 0}
        .cpop-card{align-self:stretch;background:#fff;border:1px solid #E2E2F0;border-radius:16px;padding:12px 14px;margin:2px 0}
        .cpop-card-h{display:flex;align-items:center;justify-content:space-between;gap:8px;font-weight:700;color:#07074E;font-size:12px;letter-spacing:.04em;text-transform:uppercase;margin-bottom:8px}
        .cpop-card-badge{text-transform:capitalize;letter-spacing:0;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;background:#ECEDFA;color:#4E60E6}
        .cpop-card-badge.accepted{background:#E3F6EE;color:#14774F}
        .cpop-card-badge.open,.cpop-card-badge.pending{background:#FFF1DE;color:#A8590B}
        .cpop-card-badge.rejected,.cpop-card-badge.declined{background:#FDE8E9;color:#B8272C}
        .cpop-card-row{display:flex;justify-content:space-between;gap:12px;font-size:13px;padding:3px 0}
        .cpop-card-row label{color:#6E6E96;text-transform:capitalize}
        .cpop-card-row span{color:#07074E;font-weight:600;text-align:right;word-break:break-word}
        .cpop-row{display:flex}
        .cpop-row.own{justify-content:flex-end}
        .cpop-bub{max-width:78%;min-width:0;overflow-wrap:anywhere;white-space:pre-wrap;padding:9px 14px;border-radius:18px 18px 18px 6px;font-size:14px;line-height:1.5;background:#fff;box-shadow:inset 0 0 0 1px #E2E2F0;color:#07074E}
        .cpop-row.own .cpop-bub{background:#07074E;color:#fff;box-shadow:none;border-radius:18px 18px 6px 18px}
        .cpop-input{display:flex;gap:8px;padding:12px 12px max(12px,env(safe-area-inset-bottom));border-top:1px solid #EDEDF6}
        .cpop-input input{flex:1;min-width:0;height:44px;border:1px solid #c3c3de;border-radius:999px;padding:0 16px;font-family:inherit;font-size:14px;outline:none;color:#07074E;background:#fff}
        .cpop-input input::placeholder{color:#8484b0}
        .cpop-input input:focus{border-color:#7387FF;box-shadow:0 0 0 3px rgba(115,135,255,.18)}
        .cpop-input button{width:44px;height:44px;flex:none;border:0;border-radius:50%;background:#07074E;color:#fff;cursor:pointer;display:grid;place-items:center}
        .cpop-input button:hover:not(:disabled){background:#12124f}
        .cpop-input button:disabled{opacity:.45;cursor:not-allowed}
      `}</style>
    </>
  );
}
