import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { Search, Send, Phone, FileText, MoreHorizontal, Smile, Paperclip, Zap, Bookmark, FileCheck, IndianRupee, LayoutDashboard, MessageSquare, Settings, Star, User, Briefcase } from 'lucide-react';
import { getInitial } from '../components/CreatorComponents';
import DashboardLayout from '../components/DashboardLayout';
import './CreatorDashboard.css';
import './MessagesPage.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const avatarColors = ['#7387ff', '#ff7043', '#26a69a', '#ab47bc', '#ef5350', '#42a5f5', '#ffa726', '#29b6f6'];
const avatarColor = (name) => avatarColors[name?.charCodeAt ? (name.charCodeAt(0) % avatarColors.length) : 0];

const timeAgo = (timestamp) => {
  if (!timestamp) return '';
  const diff = Date.now() - new Date(timestamp);
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d`;
};

export default function MessagesPage() {
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [mobileView, setMobileView] = useState('list');

  const displayName = user?.nickname || user?.full_name || user?.email || 'Creator';

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, action: () => navigate('/dashboard/creator') },
    { name: 'My Active Work', icon: Zap, action: () => navigate('/my-active-work') },
    { name: 'My Bids', icon: Bookmark, action: () => navigate('/my-bids') },
    { name: 'Reviews', icon: Star, action: () => navigate('/reviews') },
    { name: 'Portfolio', icon: User, action: () => navigate('/portfolio') },
    { name: 'Browse Briefs', icon: Briefcase, action: () => navigate('/browse-briefs') },
    { name: 'My Deals', icon: FileCheck, action: () => navigate('/my-deals') },
    { name: 'Messages', icon: MessageSquare, action: () => navigate('/messages'), active: true },
    { name: 'Payout', icon: IndianRupee, action: () => navigate('/withdrawal') },
    { name: 'Settings', icon: Settings, action: () => navigate('/settings') }
  ];

  // Refresh user data on mount
  useEffect(() => {
    const refreshUserData = async () => {
      try {
        const response = await axios.get(`${API}/auth/me`);
        setUser(response.data);
      } catch (error) {
        console.error('Failed to refresh user data');
      }
    };
    refreshUserData();
  }, [setUser]);

  // Fetch conversations on mount and every 5s
  useEffect(() => {
    if (user?.id) {
      fetchConversations();
      const interval = setInterval(fetchConversations, 5000);
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  // Auto-select conversation from URL param
  useEffect(() => {
    const convId = searchParams.get('conv');
    if (convId) setSelectedId(convId);
  }, [searchParams]);

  // Fetch messages when conversation selected
  useEffect(() => {
    if (!selectedId) return;
    fetchMessages(selectedId);
    const interval = setInterval(() => fetchMessages(selectedId), 3000);
    return () => clearInterval(interval);
  }, [selectedId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    try {
      const res = await axios.get(`${API}/chat/conversations`);
      setConversations(res.data);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load conversations');
      setLoading(false);
    }
  };

  const fetchMessages = async (otherId) => {
    try {
      const res = await axios.get(`${API}/chat/${otherId}`);
      setMessages(res.data);
    } catch (err) {
      console.error('Failed to load messages');
    }
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if ((!newMessage.trim() && !selectedFiles.length) || !selectedId) return;

    setSending(true);
    try {
      const res = await axios.post(`${API}/chat/send`, {
        recipient_id: selectedId,
        message: newMessage.trim(),
        attachment_urls: selectedFiles.map((file) => file.url)
      });

      if (res.data.filtered) {
        toast.warning(`Message filtered for policy violations. Warning ${res.data.warning_count}/3`);
      }

      setNewMessage('');
      setSelectedFiles([]);
      setEmojiPickerOpen(false);
      await fetchMessages(selectedId);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) {
      event.target.value = '';
      return;
    }

    setUploadingFiles(true);
    Promise.all(files.map(async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(`${API}/upload/file`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      return { name: file.name, url: res.data.file_url };
    }))
      .then((uploadedFiles) => {
        setSelectedFiles((current) => [...current, ...uploadedFiles]);
        toast.success(`${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''} attached`);
      })
      .catch((err) => {
        toast.error(err.response?.data?.detail || 'File attachment failed');
      })
      .finally(() => {
        setUploadingFiles(false);
      });

    event.target.value = '';
  };

  const removeSelectedFile = (url) => {
    setSelectedFiles((current) => current.filter((file) => file.url !== url));
  };

  const getAttachmentUrl = (url) => {
    if (!url) return '';
    return url.startsWith('http') ? url : `${BACKEND_URL}${url}`;
  };

  const getAttachmentName = (url, index) => {
    if (!url) return `Attachment ${index + 1}`;
    return decodeURIComponent(String(url).split('/').pop() || `Attachment ${index + 1}`);
  };

  const renderAttachments = (attachmentUrls = []) => {
    if (!attachmentUrls.length) return null;
    return (
      <div className="msg-bubble-attachments">
        {attachmentUrls.map((url, index) => (
          <a key={`${url}-${index}`} href={getAttachmentUrl(url)} target="_blank" rel="noreferrer">
            <FileText size={14} />
            <span>{getAttachmentName(url, index)}</span>
          </a>
        ))}
      </div>
    );
  };

  const handleEmojiSelect = (emoji) => {
    setNewMessage((current) => `${current}${emoji}`);
    setEmojiPickerOpen(false);
  };

  // Filter conversations
  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch = conv.nickname.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === 'all' ||
      (filter === 'unread' && conv.unread_count > 0) ||
      (filter === 'deals' && conv.role === 'business') ||
      (filter === 'support' && conv.user_id === 'support');
    return matchesSearch && matchesFilter;
  });

  const selectedConv = conversations.find((c) => c.user_id === selectedId);

  return (
    <DashboardLayout
      navItems={navItems}
      title="Messages"
      description="Connect with brands and manage conversations"
      topbarExtra={null}
      sidebarExtra={null}
    >
      <div className="msg-layout">
        {/* Left Panel: Conversations List */}
        <div className="msg-list-panel">
          <div className="msg-list-header">
            <h2>Messages</h2>
            <p>Manage your campaign conversations</p>
          </div>

          <div className="msg-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search messages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="msg-filters">
            {['All', 'Unread', 'Deals', 'Support'].map((f) => (
              <button
                key={f}
                className={filter === f.toLowerCase() ? 'is-active' : ''}
                onClick={() => setFilter(f.toLowerCase())}
              >
                {f}
              </button>
            ))}
          </div>

          <div className="msg-conv-list">
            {loading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>Loading...</div>
            ) : filteredConversations.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>No conversations</div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.user_id}
                  className={`msg-conv-item ${selectedId === conv.user_id ? 'is-active' : ''}`}
                  onClick={() => setSelectedId(conv.user_id)}
                >
                  <div className="msg-avatar-wrap">
                    <div className="msg-avatar" style={{ background: avatarColor(conv.nickname) }}>
                      {getInitial(conv.nickname)}
                    </div>
                    <span className="msg-online-dot" />
                  </div>
                  <div className="msg-conv-body">
                    <div className="msg-conv-top">
                      <strong>{conv.nickname}</strong>
                      <span className="msg-time-ago">{timeAgo(conv.last_message?.timestamp)}</span>
                    </div>
                    <p className="msg-preview">
                      {conv.last_message?.message
                        ? `${conv.last_message.message.slice(0, 50)}...`
                        : conv.last_message?.attachment_urls?.length
                          ? 'File attachment'
                          : ''}
                    </p>
                  </div>
                  {conv.unread_count > 0 && <span className="msg-badge">{conv.unread_count}</span>}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Center Panel: Chat Area */}
        {selectedId ? (
          <div className="msg-chat-panel">
            {/* Header */}
            <div className="msg-chat-header">
              <div className="msg-avatar-wrap" style={{ width: '48px', height: '48px' }}>
                <div className="msg-avatar" style={{ background: avatarColor(selectedConv?.nickname) }}>
                  {getInitial(selectedConv?.nickname)}
                </div>
                <span className="msg-online-dot"></span>
              </div>
              <div className="msg-header-info">
                <div>
                  <strong>{selectedConv?.nickname}</strong>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ width: '8px', height: '8px', background: '#48bb78', borderRadius: '50%', display: 'inline-block' }}></span>
                  <small className="msg-online">Online</small>
                </div>
              </div>
              <div className="msg-chat-actions">
                <button><Phone size={18} /></button>
                <button><Search size={18} /></button>
                <button><FileText size={18} /></button>
                <button><MoreHorizontal size={18} /></button>
              </div>
            </div>

            {/* Messages */}
            <div className="msg-messages">
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#999', marginTop: '40px' }}>No messages yet</div>
              ) : (
                messages.map((msg, idx) => {
                  const isOwn = msg.sender_id === user.id;
                  const isSystem = msg.system_message || msg.sender_id === 'system';

                  if (isSystem) {
                    return (
                      <div key={msg.id || idx} className="msg-system-pill">
                        {msg.message}
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id || idx} className={`msg-bubble-row ${isOwn ? 'is-own' : ''}`}>
                      {!isOwn && (
                        <div className="msg-avatar sm" style={{ background: avatarColor(selectedConv?.nickname) }}>
                          {getInitial(selectedConv?.nickname)}
                        </div>
                      )}
                      <div className="msg-bubble">
                        {msg.message ? <p>{msg.message}</p> : null}
                        {renderAttachments(msg.attachment_urls)}
                        <span className="msg-time">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions */}
            <div className="msg-quick-chips">
              {['Custom Offer', 'Revision Request', 'Milestone Update', 'Damage Report', 'Escalate', 'Dispute'].map((action) => (
                <button
                  key={action}
                  onClick={() => toast.info(`${action} — coming soon`)}
                >
                  {action}
                </button>
              ))}
            </div>

            {/* Input */}
            {selectedFiles.length > 0 && (
              <div className="msg-attachment-preview">
                {selectedFiles.map((file) => (
                  <span key={file.url}>
                    {file.name}
                    <button type="button" aria-label={`Remove ${file.name}`} onClick={() => removeSelectedFile(file.url)}>x</button>
                  </span>
                ))}
              </div>
            )}
            <form className="msg-input-row" onSubmit={handleSendMessage}>
              <input
                ref={fileInputRef}
                type="file"
                hidden
                multiple
                onChange={handleFileSelect}
              />
              <div className="msg-emoji-wrap">
                <button
                  type="button"
                  className="msg-input-icon"
                  aria-label="Choose emoji"
                  onClick={() => setEmojiPickerOpen((open) => !open)}
                >
                  <Smile size={18} />
                </button>
                {emojiPickerOpen && (
                  <div className="msg-emoji-picker">
                    {['😊', '👍', '🙏', '🔥', '✨', '✅', '👀', '💬', '📦', '🎥', '⚠️', '❤️'].map((emoji) => (
                      <button key={emoji} type="button" onClick={() => handleEmojiSelect(emoji)}>
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="msg-input-icon"
                aria-label="Attach file"
                disabled={uploadingFiles || sending}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip size={18} />
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="msg-input"
              />
              <button type="submit" className="msg-send" disabled={sending || uploadingFiles || (!newMessage.trim() && !selectedFiles.length)}>
                <Send size={18} />
              </button>
            </form>
          </div>
        ) : (
          <div className="msg-chat-panel msg-empty">
            <div style={{ textAlign: 'center', color: '#999' }}>
              <MessageSquare size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
              <p>Select a conversation to start messaging</p>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
