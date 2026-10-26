import { useLiveEffect } from '../lib/liveUpdates';
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { displayName } from '../utils/displayName';
import { ArrowLeft, Send, AlertTriangle, Shield } from 'lucide-react';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import '../styles/web1-chat.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

export default function ChatPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [warnings, setWarnings] = useState({ warning_count: 0, banned: false });
  const [loadError, setLoadError] = useState(''); // first load failed: say so instead of "No messages yet"
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const isUserScrolledUp = useRef(false);

  const firstScroll = useRef(true);
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth === false ? 'auto' : 'smooth' });
  };

  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    isUserScrolledUp.current = !isAtBottom;
  };

  useLiveEffect(() => {
    if (userId) {
      fetchChatHistory();
      fetchOtherUser();
      fetchWarnings();

      // Poll for new messages every 3 seconds
      const interval = setInterval(fetchChatHistory, 3000);
      return () => clearInterval(interval);
    }
  }, [userId]);

  // Auto-scroll to bottom only when user is at bottom or new message is sent
  useEffect(() => {
    if (!isUserScrolledUp.current) {
      // Opening the chat lands on the newest message at once; only later messages glide in.
      const first = firstScroll.current && messages.length > 0;
      if (first) firstScroll.current = false;
      setTimeout(() => scrollToBottom(!first), first ? 0 : 100);
    }
  }, [messages]);

  const fetchWarnings = async () => {
    try {
      const response = await axios.get(`${API}/chat/warnings`);
      setWarnings(response.data);
    } catch (error) {
      console.error('Failed to load warnings');
    }
  };

  const fetchOtherUser = async () => {
    try {
      const response = await axios.get(`${API}/profile/${userId}`);
      setOtherUser(response.data);
    } catch (error) {
      toast.error('Failed to load user info');
    }
  };

  const fetchChatHistory = async () => {
    try {
      const response = await axios.get(`${API}/chat/${userId}`);
      const next = Array.isArray(response.data) ? response.data : [];
      setLoadError('');
      // This runs every 3s. Keep the old array when nothing changed so the list does not
      // re-render and re-scroll, and never reset the "user scrolled up" flag here: that
      // dragged a reader of older messages back to the bottom on every poll.
      setMessages((prev) => {
        const a = prev[prev.length - 1]; const b = next[next.length - 1];
        return prev.length === next.length && (a?.id || a?.timestamp) === (b?.id || b?.timestamp) ? prev : next;
      });
    } catch (error) {
      setLoadError(error?.response ? 'Could not load this conversation.' : "You're offline. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const response = await axios.post(`${API}/chat/send`, {
        recipient_id: userId,
        message: newMessage.trim()
      });

      if (response.data.filtered) {
        toast.error(`⚠️ Your message contained prohibited content and was filtered. Warning ${response.data.warning_count}/3`);
        fetchWarnings();
      }

      if (response.data.warning_issued && response.data.warning_count >= 3) {
        toast.error('Account banned for repeated violations!');
        setTimeout(() => navigate('/'), 2000);
        return;
      }

      setNewMessage('');
      isUserScrolledUp.current = false;
      fetchChatHistory();
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to send message'));
    } finally {
      setSending(false);
    }
  };

  const role = user?.role;
  const Shell = role === 'creator' ? CreatorTopNavLayout : role === 'business' ? BrandTopNavLayout : null;
  const page = (
    <div className={`chat-page wcc${role === 'business' ? ' bui-main bui-main--tight' : ''}${Shell ? '' : ' wcc--bare'}`}>
      <div className="chat-container">
        <div className="chat-header">
          <button type="button" className="back-btn" aria-label="Back" onClick={() => navigate(-1)} data-testid="back-btn">
            <ArrowLeft size={20} />
          </button>
          <span className="chat-ava" aria-hidden="true">{otherUser ? displayName(otherUser, 'User').trim().charAt(0).toUpperCase() : ''}</span>
          <div className="chat-user-info">
            <h2>{otherUser ? displayName(otherUser, 'User') : 'Loading...'}</h2>
            <span className="user-role">{otherUser?.role}</span>
          </div>
        </div>

        {/* Anti-Cheat Warning Banner */}
        <div className="warning-banner">
          <Shield size={20} />
          <div className="warning-content">
            <strong>Platform policy:</strong> Do not share personal contact information (email, phone, WhatsApp, Telegram, Discord, etc.) in chat. All communication must remain on the platform. Violations will result in warnings and potential account suspension.
            {warnings.warning_count > 0 && (
              <div className="warning-count">
                <AlertTriangle size={16} />
                <span>You have {warnings.warning_count} warning(s). 3 warnings = automatic ban.</span>
              </div>
            )}
          </div>
        </div>

        <div className="chat-messages" data-testid="chat-messages" ref={messagesContainerRef} onScroll={handleScroll}>
          {loading ? (
            <div className="loading">Loading messages...</div>
          ) : loadError && messages.length === 0 ? (
            <div className="empty-chat" role="alert" style={{ flexDirection: 'column', gap: 12, textAlign: 'center' }}>
              <p>{loadError}</p>
              <button type="button" className="send-btn" onClick={() => { setLoading(true); fetchChatHistory(); }}>Retry</button>
            </div>
          ) : messages.length === 0 ? (
            <div className="empty-chat">
              <p>No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isOwn = msg.sender_id === user.id;
              const isSystemMessage = msg.system_message || msg.sender_id === 'system';

              if (isSystemMessage) {
                return (
                  <div key={msg.id || idx} className="system-message" data-testid={`system-message-${idx}`}>
                    <div className="system-message-content">
                      <strong>Platform notification</strong>
                      <p>{msg.message}</p>
                      <span className="message-time">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={msg.id || idx}
                  className={`message ${isOwn ? 'own' : 'other'} ${msg.filtered ? 'filtered' : ''}`}
                  data-testid={`message-${idx}`}
                >
                  <div className="message-bubble">
                    {msg.filtered && isOwn && (
                      <div className="filtered-indicator">
                        <AlertTriangle size={14} /> Content filtered
                      </div>
                    )}
                    <p>{msg.message}</p>
                    <span className="message-time">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        <form className="chat-input-form" onSubmit={handleSendMessage}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            className="chat-input"
            placeholder="Type your message..."
            data-testid="message-input"
            aria-label="Message"
          />
          <button type="submit" className="send-btn" data-testid="send-btn" aria-label="Send" disabled={sending || !newMessage.trim()}>
            <Send size={20} />
          </button>
        </form>
      </div>

    </div>
  );
  return Shell ? <Shell>{page}</Shell> : page;
}