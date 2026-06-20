import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const displayHandle = (obj, nicknameKey = 'nickname', usernameKey = 'username') => {
  if (!obj) return '—';
  const uname = obj[usernameKey];
  const nick = obj[nicknameKey];
  return uname ? `@${uname}` : (nick || '—');
};

export default function AdminFlaggedMessages() {
  const [allChats, setAllChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllChats();
  }, []);

  const fetchAllChats = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/chats`);
      setAllChats(response.data);
    } catch {
      toast.error('Failed to load chats');
    } finally {
      setLoading(false);
    }
  };

  const fetchChatMessages = async (user1Id, user2Id) => {
    try {
      const response = await axios.get(`${API}/admin/chat/${user1Id}/${user2Id}`);
      setChatMessages(response.data);
    } catch {
      toast.error('Failed to load chat messages');
    }
  };

  const flaggedChats = allChats.filter(c => c.has_violations);
  const totalFlagged = allChats.reduce((sum, c) => sum + (c.violation_count || 0), 0);

  return (
    <AdminLayout>
      <div className="afm-container">
        <div className="afm-header">
          <div>
            <h1><AlertTriangle size={26} /> Flagged Messages Report</h1>
            <p>
              Conversations where users tried to share personal contact info (phone, email, WhatsApp, "call me", etc.).
              These are auto-detected and the participants receive warnings.
            </p>
          </div>
          <div className="afm-stats">
            <div className="afm-stat">
              <span>Conversations</span>
              <strong>{flaggedChats.length}</strong>
            </div>
            <div className="afm-stat">
              <span>Total Flagged</span>
              <strong>{totalFlagged}</strong>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="afm-empty">Loading...</div>
        ) : selectedChat ? (
          <div className="afm-chat-view">
            <div className="afm-chat-head">
              <button className="afm-btn-back" onClick={() => setSelectedChat(null)} data-testid="back-to-flagged">
                ← Back to Flagged Report
              </button>
              <div className="afm-participants">
                <span>{displayHandle(selectedChat.user1)}</span>
                <span className="afm-sep">↔</span>
                <span>{displayHandle(selectedChat.user2)}</span>
              </div>
            </div>
            <div className="afm-messages">
              {chatMessages.filter(m => m.filtered).length === 0 ? (
                <p className="afm-no-messages">No flagged messages in this conversation</p>
              ) : (
                chatMessages.filter(m => m.filtered).map((msg, idx) => (
                  <div key={idx} className="afm-message" data-testid={`flagged-msg-${idx}`}>
                    <div className="afm-message-head">
                      <span className="afm-sender">{displayHandle(msg, 'sender_nickname', 'sender_username')}</span>
                      <span className="afm-time">{new Date(msg.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="afm-message-body">{msg.message}</div>
                    <div className="afm-message-flag">⚠️ Content Filtered — reported to admin</div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : flaggedChats.length === 0 ? (
          <div className="afm-empty">
            <CheckCircle size={64} color="#22c55e" />
            <p>No flagged conversations — platform looks clean!</p>
            <span>Violations will appear here when detected.</span>
          </div>
        ) : (
          <div className="afm-grid">
            {flaggedChats.map((chat, idx) => (
              <article
                key={idx}
                className="afm-card"
                data-testid={`flagged-chat-${idx}`}
                onClick={() => {
                  setSelectedChat(chat);
                  fetchChatMessages(chat.user1.id, chat.user2.id);
                }}
              >
                <div className="afm-card-head">
                  <div className="afm-card-participant">
                    <span className="afm-name">{displayHandle(chat.user1)}</span>
                    <span className="afm-role">{chat.user1.role}</span>
                  </div>
                  <div className="afm-arrow">↔</div>
                  <div className="afm-card-participant">
                    <span className="afm-name">{displayHandle(chat.user2)}</span>
                    <span className="afm-role">{chat.user2.role}</span>
                  </div>
                </div>
                <div className="afm-card-preview">
                  <p>{chat.last_message}</p>
                  <span>{new Date(chat.last_message_at).toLocaleString()}</span>
                </div>
                <div className="afm-card-flag">
                  <AlertTriangle size={14} /> {chat.violation_count} flagged message{chat.violation_count !== 1 ? 's' : ''} — view details
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .afm-container { padding: 32px 40px; max-width: 1480px; margin: 0 auto; }
        .afm-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 28px; flex-wrap: wrap; }
        .afm-header h1 { display: flex; align-items: center; gap: 12px; font-size: 1.75rem; font-weight: 700; color: #07074e; margin: 0 0 6px; }
        .afm-header h1 :global(svg) { color: #f59e0b; }
        .afm-header p { color: #718096; margin: 0; font-size: 0.92rem; max-width: 700px; line-height: 1.55; }
        .afm-stats { display: flex; gap: 12px; }
        .afm-stat { background: linear-gradient(135deg, #fff3cd 0%, #ffe69c 100%); border: 2px solid #f59e0b; padding: 14px 22px; border-radius: 14px; display: flex; flex-direction: column; align-items: center; min-width: 130px; }
        .afm-stat span { font-size: 0.72rem; color: #533f03; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700; }
        .afm-stat strong { font-size: 1.6rem; color: #92400e; margin-top: 4px; }
        .afm-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 80px 24px; background: white; border-radius: 16px; color: #4a5568; text-align: center; }
        .afm-empty p { margin: 0; font-size: 1.1rem; font-weight: 600; color: #1a202c; }
        .afm-empty span { color: #94a3b8; font-size: 0.9rem; }
        .afm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 18px; }
        .afm-card { background: white; border: 1.5px solid #e8ecff; border-left: 4px solid #ef4444; border-radius: 14px; padding: 20px; cursor: pointer; transition: all 0.2s ease; }
        .afm-card:hover { border-color: #ef4444; box-shadow: 0 6px 18px rgba(239,68,68,0.15); transform: translateY(-2px); }
        .afm-card-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid #f1f5f9; }
        .afm-card-participant { display: flex; flex-direction: column; gap: 4px; flex: 1; min-width: 0; }
        .afm-name { font-weight: 700; color: #07074e; font-size: 0.95rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .afm-role { font-size: 0.7rem; text-transform: uppercase; padding: 2px 8px; background: #eef2ff; color: #1e1e7e; border-radius: 999px; align-self: flex-start; font-weight: 600; letter-spacing: 0.04em; }
        .afm-arrow { color: #94a3b8; font-size: 1.2rem; }
        .afm-card-preview p { margin: 0 0 4px; color: #4a5568; font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .afm-card-preview span { color: #94a3b8; font-size: 0.78rem; }
        .afm-card-flag { display: flex; align-items: center; gap: 6px; margin-top: 12px; padding: 8px 12px; background: #fee2e2; color: #991b1b; border-radius: 8px; font-size: 0.82rem; font-weight: 600; }
        .afm-chat-view { background: white; border: 1.5px solid #e8ecff; border-radius: 14px; overflow: hidden; }
        .afm-chat-head { display: flex; align-items: center; gap: 20px; padding: 18px 22px; background: #f8f9ff; border-bottom: 1.5px solid #e8ecff; }
        .afm-btn-back { padding: 8px 14px; background: white; border: 1.5px solid #e2e8f0; border-radius: 8px; font-weight: 600; color: #4a5568; cursor: pointer; font-size: 0.85rem; }
        .afm-btn-back:hover { border-color: #07074e; color: #07074e; }
        .afm-participants { display: flex; align-items: center; gap: 10px; font-weight: 600; color: #1a202c; }
        .afm-sep { color: #94a3b8; }
        .afm-messages { padding: 24px; max-height: 600px; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
        .afm-no-messages { text-align: center; color: #94a3b8; padding: 40px; margin: 0; }
        .afm-message { background: #fffbeb; border: 1.5px solid #f59e0b; border-radius: 12px; padding: 14px 16px; }
        .afm-message-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .afm-sender { font-weight: 700; color: #07074e; font-size: 0.9rem; }
        .afm-time { color: #94a3b8; font-size: 0.78rem; }
        .afm-message-body { color: #1a202c; line-height: 1.5; word-wrap: break-word; }
        .afm-message-flag { display: inline-block; margin-top: 10px; padding: 4px 10px; background: #fef3c7; color: #92400e; border-radius: 6px; font-size: 0.72rem; font-weight: 700; }
        @media (max-width: 720px) {
          .afm-container { padding: 20px; }
          .afm-header { flex-direction: column; align-items: stretch; }
        }
      `}</style>
    </AdminLayout>
  );
}
