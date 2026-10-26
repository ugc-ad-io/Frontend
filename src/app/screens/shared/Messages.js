import { useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Search, Send, Paperclip, MoreHorizontal, Plus, X, FileText, CheckCheck, BellOff, Flag, User as UserIcon, Wallet,
  WifiOff, MessageSquare, Image as ImageIcon, FilePlus2, ChevronDown, AlertTriangle, ShieldCheck,
} from 'lucide-react';
import AppShell from '../../shell/AppShell';
import BottomSheet from '../../shell/BottomSheet';
import { useAuth } from '../../../App';
import { useLiveEffect } from '../../../lib/liveUpdates';
import { uploadMedia } from '../../../utils/upload';
import { apiErrorMessage } from '../../../utils/apiError';
import { displayName, creatorFirstName } from '../../../utils/displayName';
import { findContactInfo } from '../../../components/RevisionRequestModal';
import './messages.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const ATTACHMENT_MESSAGE_PREFIX = '__UGCAD_ATTACHMENT__:';
const MAX_ATTACHMENTS = 5;
const MUTE_KEY = 'ugcad-muted-convs';

// ---- Constants ported 1:1 from src/pages/MessagesPage.js (same backend contracts) ----
const CHAT_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Active Deals', value: 'active_deal' },
  { label: 'New Chat', value: 'no_deal' },
  { label: 'Archived', value: 'archived' },
];
const CREATOR_CHAT_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Orders', value: 'active_deal' },
  { label: 'New', value: 'no_deal' },
  { label: 'Unread', value: 'unread' },
  { label: 'Archived', value: 'archived' },
];
const ACTION_CARD_LABELS = {
  custom_offer: 'Custom Offer',
  private_invitation: 'Private Invitation',
  counter_offer: 'Counter Offer',
  revision_request: 'Revision Request',
  milestone_update: 'Milestone Update',
  damage_report: 'Damage Report',
  escalate_to_admin: 'Escalate to Admin',
  raise_dispute: 'Raise Dispute',
};
const ACTION_CARD_TYPES = Object.keys(ACTION_CARD_LABELS);
const ACTION_CARD_PRICE_KEYS = ['price', 'budget', 'modified_price'];
const OFFER_RESPONSE_LABELS = { accept: 'Accept', reject: 'Decline', counter: 'Counter' };
const OFFER_CARD_TYPES = ['custom_offer', 'private_invitation', 'counter_offer'];
const DECLINE_REASONS = [
  { value: 'not_my_niche', label: 'Not my niche' },
  { value: 'budget', label: "Budget doesn't fit" },
  { value: 'timeline', label: 'Timeline too short' },
  { value: 'unavailable', label: 'Currently unavailable' },
  { value: 'other', label: 'Other' },
];
const ACTION_CARDS_BY_ROLE = {
  creator: ['custom_offer', 'counter_offer', 'milestone_update', 'damage_report', 'escalate_to_admin'],
  business: ['private_invitation', 'counter_offer', 'revision_request', 'escalate_to_admin', 'raise_dispute'],
};
const REVISION_STATES = ['Content Submitted - Awaiting Review', 'Revision Requested'];
export const getAvailableActionCards = (userRole, conv) => {
  let cards = ACTION_CARDS_BY_ROLE[userRole] || ACTION_CARD_TYPES;
  if (!REVISION_STATES.includes(conv?.associated_deal_status || '')) cards = cards.filter((c) => c !== 'revision_request');
  return cards;
};
const ACTION_CARD_FORM_FIELDS = {
  custom_offer: [
    ['deliverable_type', 'Deliverable type', 'text', 'Video'],
    ['quantity', 'Quantity', 'number', '1'],
    ['duration', 'Duration', 'text', '30 seconds'],
    ['price', 'Price', 'number', '5000'],
    ['timeline', 'Timeline', 'text', '7 days'],
    ['usage_rights', 'Usage rights', 'text', 'Organic social'],
  ],
  counter_offer: [
    ['modified_price', 'Modified price', 'number', '5000'],
    ['revisions', 'Revisions', 'text', '1'],
    ['timeline', 'Delivery date', 'date', ''],
    ['usage_rights', 'Usage rights', 'text', 'Organic social'],
    ['diff_vs_original', 'Reason', 'textarea', 'Why are you countering? e.g. budget is too low for 3 videos'],
  ],
  revision_request: [['revision_text', 'Revision item', 'textarea', 'Please revise the submitted content.']],
  milestone_update: [
    ['status', 'Current status', 'select', 'editing', ['In planning', 'Filming', 'Editing', 'Ready to submit']],
    ['notes', 'Notes', 'textarea', ''],
  ],
  damage_report: [
    ['reason', 'Reason', 'text', 'Damaged product'],
    ['description', 'Description', 'textarea', 'Damage reported by creator.'],
    ['severity', 'Severity', 'select', 'medium', ['low', 'medium', 'high']],
  ],
  escalate_to_admin: [
    ['summary', 'Summary', 'textarea', 'Please review this chat thread and help resolve the ongoing communication issue between both parties. Kindly go through the messages above and advise on the best way forward.'],
    ['category', 'Category', 'select', 'communication', ['communication', 'timeline', 'clarity', 'other']],
  ],
  raise_dispute: [
    ['summary', 'Dispute summary', 'textarea', 'I want to raise a dispute for this chat/deal.'],
    ['category', 'Category', 'select', 'communication', ['communication', 'timeline', 'clarity', 'other']],
  ],
};
const ACTION_CARD_REQUIRED = {
  custom_offer: ['deliverable_type', 'quantity', 'duration', 'price', 'timeline', 'usage_rights'],
  counter_offer: ['modified_price', 'revisions', 'timeline', 'usage_rights', 'diff_vs_original'],
  revision_request: ['revision_text'],
  milestone_update: ['status'],
  damage_report: ['reason', 'description', 'severity'],
  escalate_to_admin: ['summary', 'category'],
  raise_dispute: ['summary', 'category'],
};
const ACTION_CARD_FIELD_LIMITS = { escalate_to_admin: { summary: { min: 100, max: 500 } } };
const REPORT_REASONS = [
  ['spam', 'Spam or scam'], ['harassment', 'Harassment or abuse'], ['off_platform', 'Trying to move off-platform'],
  ['payment_issue', 'Payment or fraud issue'], ['inappropriate', 'Inappropriate content'], ['other', 'Other'],
];
const CARD_STATUS_LABELS = { open: 'Awaiting reply', accept: 'Accepted', accepted: 'Accepted', reject: 'Declined', rejected: 'Declined', counter: 'Countered', countered: 'Countered', expired: 'Expired' };
const IMAGE_URL_RE = /\.(jpe?g|png|gif|webp)(\?|$)/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const avatarColors = ['#07074e', '#ff7043', '#26a69a', '#ab47bc', '#ef5350', '#42a5f5', '#ffa726', '#29b6f6'];
const avatarColor = (name) => avatarColors[name?.charCodeAt ? (name.charCodeAt(0) % avatarColors.length) : 0];
const initialOf = (name) => (String(name || '?').trim().charAt(0) || '?').toUpperCase();

export const timeAgo = (timestamp) => {
  if (!timestamp) return '';
  const mins = Math.max(0, Math.floor((Date.now() - new Date(timestamp)) / 60000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return days === 1 ? 'Yesterday' : `${days}d`;
};
const getItemTime = (item) => item.created_at || item.timestamp;
const clock = (item) => { const d = new Date(getItemTime(item)); return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };
const dayLabel = (item) => {
  const d = new Date(getItemTime(item));
  if (Number.isNaN(d.getTime())) return '';
  const day0 = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day0(new Date()) - day0(d)) / 86400000);
  return diff <= 0 ? 'Today' : diff === 1 ? 'Yesterday' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const getAttachmentUrl = (url) => (!url ? '' : String(url).startsWith('http') ? url : `${BACKEND_URL}${url}`);
const getAttachmentName = (url, i) => { try { return decodeURIComponent(String(url || '').split('/').pop() || `Attachment ${i + 1}`); } catch { return `Attachment ${i + 1}`; } };
const getMessageAttachments = (msg = {}) => {
  if (msg.attachment_urls?.length) return msg.attachment_urls;
  if (typeof msg.message === 'string' && msg.message.startsWith(ATTACHMENT_MESSAGE_PREFIX)) return msg.message.slice(ATTACHMENT_MESSAGE_PREFIX.length).split('|').filter(Boolean);
  return [];
};
const getDisplayMessage = (msg = {}) => (typeof msg.message === 'string' && msg.message.startsWith(ATTACHMENT_MESSAGE_PREFIX) ? '' : msg.message);
const formatActionValue = (value) => {
  if (Array.isArray(value)) return value.map((item) => (typeof item === 'object' ? Object.values(item).filter(Boolean).join(' - ') : item)).join(', ');
  if (typeof value === 'object' && value !== null) return Object.values(value).filter(Boolean).join(' - ');
  return String(value ?? '');
};
const fieldLabel = (item, k, v) => (item?.type === 'counter_offer' && k === 'timeline' && DATE_RE.test(String(v)) ? 'Delivery date' : k === 'diff_vs_original' ? 'reason' : k.replaceAll('_', ' '));
const fieldValue = (k, v) => (ACTION_CARD_PRICE_KEYS.includes(k) && v !== '' && Number.isFinite(Number(v)) ? money(Number(v)) : DATE_RE.test(String(v)) ? niceDate(v) : formatActionValue(v));
const niceDate = (v) => new Date(`${v}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

// Deal summary built only from what the open thread already loaded (same as the website's buildDealInfo).
export const buildDealInfo = (messages, conv, forCreator = false) => {
  const offers = messages.filter((m) => m.item_type === 'action_card' && OFFER_CARD_TYPES.includes(m.type));
  const last = offers[offers.length - 1];
  const dealStatus = conv?.associated_deal_status;
  if (!last && !dealStatus) return null;
  const f = last?.fields || {};
  const title = [...offers].reverse().map((o) => o.fields?.campaign_name).find(Boolean) || f.deliverable_summary || f.deliverable_type || '';
  const priceKey = ACTION_CARD_PRICE_KEYS.find((k) => f[k] !== undefined && f[k] !== '');
  const priceNum = priceKey ? Number(f[priceKey]) : NaN;
  const timeline = DATE_RE.test(String(f.timeline || '')) ? niceDate(f.timeline) : f.timeline;
  const sub = last ? [ACTION_CARD_LABELS[last.type], f.deliverable_summary && f.deliverable_summary !== title ? f.deliverable_summary : ''].filter(Boolean).join(' · ') : '';
  const rows = [
    [forCreator ? 'Pay' : 'Budget', Number.isFinite(priceNum) ? money(priceNum) : ''],
    ['Timeline', timeline || ''],
    ['Offer status', last ? (CARD_STATUS_LABELS[last.status] || last.status || '') : ''],
    ['Deal stage', dealStatus ? dealStatus.charAt(0).toUpperCase() + dealStatus.slice(1) : ''],
  ].filter(([, v]) => v);
  if (!title && !sub && !rows.length) return null;
  return { title, sub, rows };
};

const offline = (err, ok) => (err?.response ? ok : "You're offline. Check your connection and try again.");

// =====================================================================================
export default function AppMessages() {
  const { user, setUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('conv') || null;
  const openedHere = useRef(false);

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [mutedIds, setMutedIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(MUTE_KEY) || '[]')); } catch { return new Set(); }
  });

  const fetchConversations = async () => {
    try {
      const res = await axios.get(`${API}/chat/conversations`);
      setConversations(Array.isArray(res.data) ? res.data : []);
      setListError('');
    } catch (err) {
      setListError(offline(err, 'Could not load your conversations.'));
    } finally { setLoading(false); }
  };

  useLiveEffect(() => {
    axios.get(`${API}/auth/me`).then((r) => setUser?.(r.data)).catch(() => {});
  }, [setUser]);

  useLiveEffect(() => {
    if (!user?.id) return undefined;
    fetchConversations();
    const t = setInterval(fetchConversations, 5000);
    return () => clearInterval(t);
  }, [user?.id]);

  const toggleMute = (id) => {
    setMutedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem(MUTE_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      toast.success(next.has(id) ? 'Chat muted on this device' : 'Chat unmuted');
      return next;
    });
  };

  const open = (id) => { openedHere.current = true; setSearchParams({ conv: id }); };

  if (selectedId) {
    return (
      <Chat
        key={selectedId}
        selectedId={selectedId}
        conv={conversations.find((c) => c.user_id === selectedId)}
        user={user}
        muted={mutedIds.has(selectedId)}
        onToggleMute={() => toggleMute(selectedId)}
        // arrived by tapping a row: pop back to the list; deep link (notification): go to the list itself
        back={openedHere.current ? true : '/messages'}
        onChanged={fetchConversations}
      />
    );
  }
  return <Inbox user={user} conversations={conversations} loading={loading} error={listError} muted={mutedIds} onOpen={open} onRetry={() => { setLoading(true); fetchConversations(); }} />;
}

// ---------------------------------------------------------------- conversation list
function Inbox({ user, conversations, loading, error, muted, onOpen, onRetry }) {
  const navigate = useNavigate();
  const isBusiness = user?.role === 'business';
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const peerLabel = (c) => (isBusiness ? creatorFirstName(c) : displayName(c, 'User'));
  const matches = (c, f) => f === 'all' || (f === 'unread' ? c.unread_count > 0 : c.thread_classification === f);
  const filters = isBusiness ? CHAT_FILTERS : CREATOR_CHAT_FILTERS;
  const list = conversations.filter((c) => displayName(c, 'User').toLowerCase().includes(search.toLowerCase()) && matches(c, filter));
  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count || 0), 0);

  return (
    <AppShell title={isBusiness ? 'Messages' : 'Inbox'} subtitle={totalUnread > 0 ? `${totalUnread} unread` : isBusiness ? 'Your campaign conversations' : 'Your conversations with brands'}>
      <label className="ap-mc-search">
        <Search size={18} />
        <input type="search" aria-label="Search messages" placeholder={isBusiness ? 'Search creators or campaigns' : 'Search brands or orders'} value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      <div className="ap-chips" role="tablist" aria-label="Filter conversations">
        {filters.map((f) => (
          <button key={f.value} type="button" role="tab" aria-selected={filter === f.value} className={`ap-chip${filter === f.value ? ' is-on' : ''}`} onClick={() => setFilter(f.value)}>
            {f.label}
            <span className="ap-mc-cnt">{conversations.filter((c) => matches(c, f.value)).length}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="ap-card" aria-hidden="true">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="ap-skel ap-mc-sk" />)}</div>
      ) : error && conversations.length === 0 ? (
        <div className="ap-card ap-empty" role="alert">
          {error.startsWith("You're offline") ? <WifiOff size={34} /> : <MessageSquare size={34} />}
          <h3>{error}</h3>
          <button type="button" className="ap-btn" onClick={onRetry}>Retry</button>
        </div>
      ) : list.length === 0 ? (
        <div className="ap-card ap-empty">
          <MessageSquare size={34} />
          <h3>{conversations.length === 0 ? 'No conversations yet' : 'No conversations match'}</h3>
          <p>{conversations.length === 0
            ? (isBusiness ? 'Message a creator from their profile, or hire one, and your chats will appear here.' : 'Messages from brands you work with will appear here.')
            : 'Try a different search or filter.'}</p>
          {conversations.length === 0 && (
            <button type="button" className="ap-btn" onClick={() => navigate(isBusiness ? '/dashboard/business/browse-creator' : '/browse-briefs')}>
              {isBusiness ? 'Browse creators' : 'Find briefs'}
            </button>
          )}
        </div>
      ) : (
        <>
          {error && <div className="ap-card ap-mc-warn" role="alert">{error} <button type="button" className="ap-link" onClick={onRetry}>Retry</button></div>}
          <div className="ap-card ap-mc-list">
            {list.map((c) => {
              const name = peerLabel(c);
              const isMuted = muted.has(c.user_id);
              const unread = c.unread_count > 0 && !isMuted;
              const last = c.last_message || {};
              const text = getDisplayMessage(last);
              const preview = text || (getMessageAttachments(last).length ? 'File attachment' : '');
              return (
                <button key={c.user_id} type="button" className={`ap-mc-conv${unread ? ' is-unread' : ''}`} onClick={() => onOpen(c.user_id)}>
                  <span className="ap-mc-av" style={{ background: avatarColor(name) }}>{initialOf(name)}</span>
                  <span className="ap-mc-cb">
                    <span className="ap-mc-top">
                      <strong>{name}</strong>
                      {isMuted && <BellOff size={13} aria-label="Muted" />}
                      <em className={unread ? 'is-new' : ''}>{timeAgo(c.timestamp || last.timestamp)}</em>
                    </span>
                    <span className="ap-mc-prev">
                      <span className="ap-mc-txt">{preview}</span>
                      {unread && <span className="ap-mc-badge">{c.unread_count}</span>}
                    </span>
                    {c.associated_deal_status ? <span className="ap-pill ap-mc-dealpill">{c.associated_deal_status}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </AppShell>
  );
}

// ---------------------------------------------------------------- one open chat
function Chat({ selectedId, conv, user, muted, onToggleMute, back, onChanged }) {
  const navigate = useNavigate();
  const isBusiness = user?.role === 'business';
  const peer = isBusiness ? creatorFirstName(conv) : displayName(conv, 'User');
  const peerName = conv ? peer : 'Chat';

  const [messages, setMessages] = useState([]);
  const [msgError, setMsgError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [warnings, setWarnings] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [dealOpen, setDealOpen] = useState(false);
  const [sheet, setSheet] = useState(null); // 'options' | 'pick' | 'files' | 'report'
  const [composer, setComposer] = useState(null); // { type, counterFrom }
  const [form, setForm] = useState({});
  const [creatingCard, setCreatingCard] = useState(false);
  const [decline, setDecline] = useState(null); // { id, reason, note }
  const [accept, setAccept] = useState(null); // offer card awaiting confirm
  const [responding, setResponding] = useState(null);
  const [report, setReport] = useState({ reason: '', details: '' });
  const [reporting, setReporting] = useState(false);
  const [requestingBrief, setRequestingBrief] = useState(false);

  const boxRef = useRef(null);
  const endRef = useRef(null);
  const fileRef = useRef(null);
  const typingSentAt = useRef(0);
  const justOpened = useRef(true);
  const scrolledUp = useRef(false);
  const prevCount = useRef(0); // messages shown last time: a single new message glides, a whole chat jumps
  const sendingRef = useRef(false);

  const fetchMessages = async () => {
    try {
      const res = await axios.get(`${API}/chat/${selectedId}`);
      setMessages(Array.isArray(res.data) ? res.data : []);
      setMsgError('');
    } catch (err) {
      setMsgError(offline(err, 'Could not load this conversation.'));
    } finally { setLoaded(true); }
  };
  const fetchTyping = async () => {
    try { const r = await axios.get(`${API}/chat/${selectedId}/typing`); setTyping(Boolean(r.data?.typing)); } catch { setTyping(false); }
  };

  useLiveEffect(() => {
    fetchMessages();
    fetchTyping();
    const a = setInterval(fetchMessages, 3000);
    const b = setInterval(fetchTyping, 3000);
    return () => { clearInterval(a); clearInterval(b); };
  }, [selectedId]);

  useLiveEffect(() => {
    axios.get(`${API}/chat/warnings`).then((r) => setWarnings(r.data)).catch(() => {});
  }, []);

  // Brand only: the wallet decides whether the "Add funds" bar replaces the typing box. The server still enforces the minimum.
  useLiveEffect(() => {
    if (!isBusiness) return;
    axios.get(`${API}/business/wallet`).then((r) => setWallet(r.data || null)).catch(() => { /* no bar if the wallet can't be read */ });
  }, [isBusiness, selectedId]);

  // Land on the newest message when opened; afterwards follow new messages only while the user is at the bottom.
  useLayoutEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    if (justOpened.current && messages.length) {
      justOpened.current = false;
      prevCount.current = messages.length;
      el.scrollTop = el.scrollHeight;
      requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
      return;
    }
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    const added = messages.length - prevCount.current;
    prevCount.current = messages.length;
    if (atBottom && !scrolledUp.current) endRef.current?.scrollIntoView?.({ behavior: Math.abs(added) > 2 ? 'auto' : 'smooth' });
  }, [messages, typing]);
  const onScroll = () => {
    const el = boxRef.current;
    if (el) scrolledUp.current = !(el.scrollHeight - el.scrollTop - el.clientHeight < 100);
  };

  const actionCardsOnly = warnings?.action_cards_only_until && new Date(warnings.action_cards_only_until) > new Date();
  const walletLow = isBusiness && wallet != null && (wallet.chat_unlocked === false || Number(wallet.available_balance) < Number(wallet.minimum_chat_balance));
  const dealInfo = buildDealInfo(messages, conv, !isBusiness);
  const sharedFiles = messages.flatMap((m) => getMessageAttachments(m)).reverse().slice(0, 9);

  // ---- send
  const sendTypingSignal = async () => {
    const now = Date.now();
    if (now - typingSentAt.current < 2500) return;
    typingSentAt.current = now;
    try { await axios.post(`${API}/chat/${selectedId}/typing`); } catch { /* best-effort */ }
  };

  const handleSend = async (e) => {
    e?.preventDefault();
    if (sendingRef.current) return;
    const urls = files.map((f) => f.url).filter(Boolean);
    if (!newMessage.trim() && !urls.length) return;
    if (files.length && !urls.length) { toast.error('File upload did not complete. Please attach the file again.'); return; }
    const contact = findContactInfo(newMessage);
    if (contact) {
      toast.error(contact === 'email' ? 'Email addresses aren’t allowed - keep all communication on-platform.' : 'Phone numbers aren’t allowed - keep all communication on-platform.');
      return;
    }
    sendingRef.current = true;
    setSending(true);
    try {
      const res = await axios.post(`${API}/chat/send`, {
        recipient_id: selectedId,
        message: newMessage.trim() || `${ATTACHMENT_MESSAGE_PREFIX}${urls.join('|')}`,
        attachment_urls: urls,
      });
      if (res.data?.filtered) toast.warning(`Message filtered for policy violations. Warning ${res.data.warning_count}/3`);
      setNewMessage('');
      setFiles([]);
      scrolledUp.current = false;
      await fetchMessages();
      onChanged?.();
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.detail?.includes?.('contact information')) {
        toast.error(apiErrorMessage(err));
        axios.get(`${API}/chat/warnings`).then((r) => setWarnings(r.data)).catch(() => {});
      } else {
        toast.error(apiErrorMessage(err, 'Failed to send message'));
      }
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const validateFiles = (picked) => {
    if (files.length + picked.length > MAX_ATTACHMENTS) return 'A message can include at most 5 attachments.';
    for (const f of picked) {
      const isImage = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'].includes(f.type);
      const isPdf = f.type === 'application/pdf';
      const isVideo = f.type?.startsWith('video/');
      if (!isImage && !isPdf && !isVideo) return 'Upload jpg, png, gif, pdf, or video files only.';
      if (isImage && f.size > 10 * 1024 * 1024) return 'Images must be 10 MB or smaller.';
      if (isPdf && f.size > 25 * 1024 * 1024) return 'PDFs must be 25 MB or smaller.';
      if (isVideo && f.size > 100 * 1024 * 1024) return 'Videos must be 100 MB or smaller.';
    }
    return '';
  };

  const handleFiles = (e) => {
    const picked = Array.from(e.target.files || []);
    e.target.value = '';
    if (!picked.length) return;
    const bad = validateFiles(picked);
    if (bad) { toast.error(bad); return; }
    setUploading(true);
    Promise.all(picked.map(async (file) => {
      const data = await uploadMedia(file, API);
      const url = data.file_url || data.url || data.path;
      if (!url) throw new Error(`${file.name} uploaded but no file URL was returned`);
      return { name: file.name, url };
    }))
      .then((up) => { setFiles((cur) => [...cur, ...up]); toast.success(`${up.length} file${up.length > 1 ? 's' : ''} attached`); })
      .catch((err) => toast.error(apiErrorMessage(err, 'File attachment failed')))
      .finally(() => setUploading(false));
  };

  const requestBrief = async () => {
    if (requestingBrief) return;
    setRequestingBrief(true);
    try {
      await axios.post(`${API}/chat/send`, { recipient_id: selectedId, message: "I've accepted the invitation - please share the full brief so I can get started.", attachment_urls: [] });
      toast.success('Brief requested - the brand has been notified.');
      await fetchMessages();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not send the request'));
    } finally { setRequestingBrief(false); }
  };

  // ---- offer / action cards
  const respond = async (cardId, action, extra = {}) => {
    if (responding) return false;
    setResponding(cardId);
    try {
      await axios.post(`${API}/chat/action-cards/${cardId}/respond`, { action, ...extra });
      toast.success('Action card updated');
      fetchMessages();
      onChanged?.();
      return true;
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Action failed'));
      return false;
    } finally { setResponding(null); }
  };

  const submitDecline = async () => {
    if (!decline?.reason) { toast.error('Please select a reason for declining'); return; }
    const ok = await respond(decline.id, 'reject', { decline_reason: decline.reason, note: decline.note || '' });
    if (ok) setDecline(null);
  };
  const confirmAccept = async () => {
    const ok = await respond(accept.id, 'accept');
    if (ok) setAccept(null);
  };

  const defaultForm = (type) => Object.fromEntries((ACTION_CARD_FORM_FIELDS[type] || []).map(([k, , , fb]) => [k, fb]));
  const openComposer = (type) => {
    if (type === 'private_invitation') { goBrief(); return; }
    setSheet(null);
    setComposer({ type, counterFrom: null });
    setForm(defaultForm(type));
  };
  const openCounter = (item) => {
    const f = item.fields || {};
    const price = f.modified_price ?? f.price ?? f.budget;
    setComposer({ type: 'counter_offer', counterFrom: item.id });
    setForm({
      modified_price: price != null && String(price).trim() !== '' ? String(price) : '5000',
      revisions: f.revisions != null ? String(f.revisions) : '1',
      timeline: DATE_RE.test(f.timeline || '') ? f.timeline : '',
      usage_rights: f.usage_rights || 'Organic social',
      diff_vs_original: '',
    });
  };
  const closeComposer = () => { setComposer(null); setForm({}); };
  // The brief wizard (PlanBrief) lives on the creator profile; the phone app sends the brand there instead of nesting a second flow in the chat.
  const goBrief = () => { setSheet(null); toast.message('Open the creator’s profile and tap “Send a brief”.'); navigate(`/dashboard/business/creator/${selectedId}`); };

  const payloadFields = () => {
    const fields = { ...form };
    if (composer.type === 'revision_request') return { revision_items: [{ description: fields.revision_text, severity: 'medium' }] };
    ['quantity', 'price', 'budget', 'modified_price'].forEach((k) => {
      const v = fields[k];
      if (v === undefined || v === null || String(v).trim() === '') return;
      const n = Number(v);
      if (Number.isFinite(n)) fields[k] = n;
    });
    return fields;
  };

  const submitCard = async () => {
    if (creatingCard || !composer) return;
    const type = composer.type;
    const labelOf = (key) => (ACTION_CARD_FORM_FIELDS[type] || []).find(([k]) => k === key)?.[1] || key;
    const required = ACTION_CARD_REQUIRED[type] || [];
    const missing = required.filter((k) => form[k] === undefined || form[k] === null || String(form[k]).trim() === '');
    if (missing.length) { toast.error(`Please fill in: ${missing.map(labelOf).join(', ')}`); return; }
    for (const key of ['budget', 'price', 'modified_price']) {
      if (required.includes(key) && Number(form[key]) <= 0) { toast.error(`${labelOf(key)} must be greater than zero`); return; }
    }
    for (const [key, { min, max }] of Object.entries(ACTION_CARD_FIELD_LIMITS[type] || {})) {
      const len = String(form[key] ?? '').trim().length;
      if (len < min || len > max) { toast.error(`${labelOf(key)} must be ${min} to ${max} characters (currently ${len}).`); return; }
    }
    setCreatingCard(true);
    try {
      await axios.post(`${API}/chat/action-cards`, {
        recipient_id: selectedId,
        type,
        deal_id: composer.counterFrom ? messages.find((m) => m.id === composer.counterFrom)?.deal_id : undefined,
        fields: payloadFields(),
      });
      if (composer.counterFrom) {
        try { await axios.post(`${API}/chat/action-cards/${composer.counterFrom}/respond`, { action: 'counter' }); } catch { /* original offer no longer respondable; the counter still stands */ }
      }
      toast.success(`${ACTION_CARD_LABELS[type]} sent`);
      closeComposer();
      fetchMessages();
      onChanged?.();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Action card failed'));
    } finally { setCreatingCard(false); }
  };

  const submitReport = async () => {
    if (reporting) return;
    if (!report.reason) { toast.error('Please choose a reason'); return; }
    setReporting(true);
    try {
      const res = await axios.post(`${API}/report-user`, {
        reported_user_id: selectedId,
        deal_id: conv?.associated_deal_id || null,
        reason: report.reason,
        details: report.details || '',
      });
      toast.success(res.data?.message || 'Report submitted');
      setSheet(null);
      setReport({ reason: '', details: '' });
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to submit report'));
    } finally { setReporting(false); }
  };

  // ---- renderers
  const renderCard = (item, key) => {
    const fields = item.fields || {};
    const isOwn = item.sender_id === user.id;
    const priceKey = ACTION_CARD_PRICE_KEYS.find((k) => fields[k] !== undefined && fields[k] !== '');
    const priceNum = priceKey ? Number(fields[priceKey]) : NaN;
    const titleKey = isBusiness ? '' : ['campaign_name', 'deliverable_summary', 'deliverable_type'].find((k) => fields[k]);
    const busy = responding === item.id;
    const status = item.status || 'open';
    return (
      <div key={key} className={`ap-mc-offer${isOwn ? ' is-own' : ''}`}>
        <div className="ap-mc-offer-h">
          <div className="ap-mc-offer-k">{(ACTION_CARD_LABELS[item.type] || item.type).toUpperCase()}</div>
          {priceKey ? <div className="ap-mc-offer-p">{Number.isFinite(priceNum) ? money(priceNum) : String(fields[priceKey])}</div> : null}
          {titleKey ? <div className="ap-mc-offer-t">{fields[titleKey]}</div> : null}
          <span className="ap-mc-offer-s">{CARD_STATUS_LABELS[status] || status}</span>
        </div>
        <div className="ap-mc-offer-rows">
          {Object.entries(fields).filter(([k]) => k !== titleKey).slice(0, 6).map(([k, v]) => (
            <div key={k} data-field={k}>
              <span>{fieldLabel(item, k, v)}</span>
              <b>{fieldValue(k, v)}</b>
            </div>
          ))}
        </div>
        {!isOwn && status === 'open' && item.available_actions?.length ? (
          <div className="ap-mc-offer-a">
            {item.available_actions.map((action) => {
              const isOffer = OFFER_CARD_TYPES.includes(item.type);
              const onClick = action === 'counter' ? () => openCounter(item)
                : action === 'reject' && isOffer ? () => setDecline({ id: item.id, reason: '', note: '' })
                  : action === 'accept' && isOffer ? () => setAccept(item)
                    : () => respond(item.id, action);
              return (
                <button key={action} type="button" disabled={busy} className={`ap-mc-btn is-${action}`} onClick={onClick}>
                  {OFFER_RESPONSE_LABELS[action] || action}
                </button>
              );
            })}
          </div>
        ) : null}
        {isOwn && item.type === 'private_invitation' && status === 'accepted' ? (
          <div className="ap-mc-offer-a"><button type="button" className="ap-mc-btn is-accept" onClick={goBrief}>Post a brief</button></div>
        ) : null}
        {!isOwn && item.type === 'private_invitation' && status === 'accepted' ? (
          <>
            <p className="ap-mc-offer-note">Accepted - waiting for the brand to post the brief.</p>
            <div className="ap-mc-offer-a"><button type="button" className="ap-mc-btn" onClick={requestBrief} disabled={requestingBrief}>{requestingBrief ? 'Sending…' : 'Need brief'}</button></div>
          </>
        ) : null}
        <small className="ap-mc-offer-time">{clock(item)}</small>
      </div>
    );
  };

  const renderField = ([key, label, type, , options]) => {
    const value = form[key] ?? '';
    const set = (v) => setForm((cur) => ({ ...cur, [key]: v }));
    if (type === 'textarea') {
      const limit = (ACTION_CARD_FIELD_LIMITS[composer.type] || {})[key];
      const len = String(value).length;
      return (
        <label key={key} className="ap-label ap-mc-f ap-mc-f--wide">
          <span className="ap-mc-fl">{label}{limit && <em className={len < limit.min || len > limit.max ? 'bad' : 'ok'}>{len}/{limit.max}{len < limit.min ? ` · min ${limit.min}` : ''}</em>}</span>
          <textarea className="ap-input" value={value} maxLength={limit ? limit.max : undefined} placeholder={limit ? `Write ${limit.min}–${limit.max} characters` : undefined} onChange={(e) => set(e.target.value)} />
        </label>
      );
    }
    if (type === 'select') {
      return (
        <label key={key} className="ap-label ap-mc-f">
          {label}
          <select className="ap-input" value={value} onChange={(e) => set(e.target.value)}>
            {(options || []).map((o) => <option key={o} value={String(o).toLowerCase().replaceAll(' ', '_')}>{o}</option>)}
          </select>
        </label>
      );
    }
    return (
      <label key={key} className="ap-label ap-mc-f">
        {label}
        <input className="ap-input" type={type} inputMode={type === 'number' ? 'decimal' : undefined} value={value} onChange={(e) => set(e.target.value)} />
      </label>
    );
  };

  let lastDay = '';
  const status = conv?.associated_deal_status;
  const subtitle = [status, muted ? 'Muted' : ''].filter(Boolean).join(' · ') || undefined;
  const cards = getAvailableActionCards(user?.role, conv);

  return (
    <AppShell
      className="ap-mc-shell"
      bare
      tabs={false}
      back={back}
      title={peerName}
      subtitle={subtitle}
      right={<button type="button" className="ap-bar-btn" aria-label="Chat options" onClick={() => setSheet('options')}><MoreHorizontal size={22} /></button>}
    >
      <div className="ap-mc-chat">
        {dealInfo ? (
          <div className="ap-mc-deal">
            <button type="button" className="ap-mc-deal-h" aria-expanded={dealOpen} onClick={() => setDealOpen((o) => !o)}>
              <span><b>Deal</b><em>{dealInfo.title || dealInfo.sub || status}</em></span>
              <ChevronDown size={18} className={dealOpen ? 'is-open' : ''} />
            </button>
            {dealOpen && (
              <div className="ap-mc-deal-b">
                {dealInfo.sub ? <small>{dealInfo.sub}</small> : null}
                {dealInfo.rows.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}
              </div>
            )}
          </div>
        ) : null}

        <div className="ap-mc-msgs" ref={boxRef} onScroll={onScroll}>
          {!loaded ? (
            <div aria-hidden="true" className="ap-mc-msk">
              <div className="ap-skel" style={{ width: '58%', height: 44, borderRadius: 20 }} />
              <div className="ap-skel" style={{ width: '46%', height: 44, borderRadius: 20, alignSelf: 'flex-end' }} />
              <div className="ap-skel" style={{ width: '64%', height: 44, borderRadius: 20 }} />
            </div>
          ) : msgError && messages.length === 0 ? (
            <div className="ap-empty" role="alert">
              {msgError.startsWith("You're offline") ? <WifiOff size={34} /> : <MessageSquare size={34} />}
              <h3>{msgError}</h3>
              <button type="button" className="ap-btn" onClick={fetchMessages}>Retry</button>
            </div>
          ) : messages.length === 0 ? (
            <div className="ap-empty"><MessageSquare size={34} /><h3>No messages yet</h3><p>Say hello to {peerName}. Keep chats on UGCad so you stay protected.</p></div>
          ) : messages.map((msg, idx) => {
            const k = msg.id || idx;
            const dl = dayLabel(msg);
            const sep = dl && dl !== lastDay ? <div key={`d-${k}`} className="ap-mc-day"><span>{dl}</span></div> : null;
            if (dl) lastDay = dl;
            if (msg.item_type === 'action_card') return [sep, renderCard(msg, k)];
            if (msg.system_message || msg.sender_id === 'system') return [sep, <div key={k} className="ap-mc-sys">{msg.message}</div>];
            const own = msg.sender_id === user.id;
            const atts = getMessageAttachments(msg);
            const text = getDisplayMessage(msg);
            const read = !own ? '' : (msg.status === 'read' || msg.read_at || (msg.read_by || []).includes(selectedId)) ? 'Read' : 'Delivered';
            return [sep, (
              <div key={k} className={`ap-mc-row${own ? ' is-own' : ''}`}>
                <span className="ap-mc-bub">
                  {text ? <span className="ap-mc-bt">{text}</span> : null}
                  {atts.length ? (
                    <span className="ap-mc-atts">
                      {atts.map((u, i) => (
                        IMAGE_URL_RE.test(u)
                          ? <a key={`${u}-${i}`} href={getAttachmentUrl(u)} target="_blank" rel="noreferrer" className="ap-mc-img"><img src={getAttachmentUrl(u)} alt={getAttachmentName(u, i)} loading="lazy" /></a>
                          : <a key={`${u}-${i}`} href={getAttachmentUrl(u)} target="_blank" rel="noreferrer" className="ap-mc-file"><FileText size={16} /><span>{getAttachmentName(u, i)}</span></a>
                      ))}
                    </span>
                  ) : null}
                </span>
                <span className="ap-mc-time">{clock(msg)}{read ? <em><CheckCheck size={13} /> {read}</em> : null}</span>
              </div>
            )];
          })}
          {typing ? <div className="ap-mc-typing">{peerName} is typing…</div> : null}
          <div ref={endRef} />
        </div>

        {actionCardsOnly ? (
          <div className="ap-mc-policy"><AlertTriangle size={16} /> <span>Free-form chat is temporarily disabled. Action cards are still available.</span></div>
        ) : null}

        {walletLow ? (
          <div className="ap-mc-wbar" role="status">
            <span className="ap-mc-wic"><Wallet size={20} /></span>
            <div>
              <b>Add {money(wallet.minimum_chat_balance)} to reply</b>
              <small>Wallet {money(wallet.available_balance || 0)} · you can still read and respond to offers</small>
            </div>
            <button type="button" onClick={() => navigate('/dashboard/business/wallet?view=recharge')}>Add</button>
          </div>
        ) : (
          <>
            {files.length > 0 && (
              <div className="ap-mc-prev-files">
                {files.map((f) => (
                  <span key={f.url}>{f.name}<button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles((cur) => cur.filter((x) => x.url !== f.url))}><X size={14} /></button></span>
                ))}
              </div>
            )}
            <form className="ap-mc-comp" onSubmit={handleSend}>
              <input ref={fileRef} type="file" hidden multiple accept="image/jpeg,image/png,image/gif,application/pdf,video/*" onChange={handleFiles} />
              <button type="button" className="ap-mc-ic" aria-label="Send action card" onClick={() => setSheet('pick')}><Plus size={22} /></button>
              <button type="button" className="ap-mc-ic" aria-label="Attach file" disabled={uploading || sending} onClick={() => fileRef.current?.click()}><Paperclip size={20} /></button>
              <input
                type="text"
                className="ap-mc-in"
                value={newMessage}
                disabled={!!actionCardsOnly}
                placeholder={actionCardsOnly ? 'Use an action card to continue' : uploading ? 'Uploading…' : 'Write a message…'}
                onChange={(e) => { setNewMessage(e.target.value); sendTypingSignal(); }}
                enterKeyHint="send"
              />
              <button type="submit" className="ap-mc-send" aria-label="Send" disabled={!!actionCardsOnly || sending || uploading || (!newMessage.trim() && !files.length)}><Send size={19} /></button>
            </form>
          </>
        )}
      </div>

      {/* chat options */}
      <BottomSheet open={sheet === 'options'} onClose={() => setSheet(null)} title={peerName}>
        <div className="ap-more">
          {isBusiness && <button type="button" className="ap-more-row" onClick={() => { setSheet(null); navigate(`/dashboard/business/creator/${selectedId}`); }}><UserIcon size={20} /> <span>View profile</span></button>}
          {isBusiness && <button type="button" className="ap-more-row" onClick={goBrief}><FilePlus2 size={20} /> <span>Send a brief</span></button>}
          <button type="button" className="ap-more-row" onClick={() => setSheet('files')}><ImageIcon size={20} /> <span>Shared files{sharedFiles.length ? ` (${sharedFiles.length})` : ''}</span></button>
          <button type="button" className="ap-more-row" onClick={() => { setSheet(null); onToggleMute(); }}><BellOff size={20} /> <span>{muted ? 'Unmute this chat' : 'Mute this chat'}</span></button>
          <button type="button" className="ap-more-row ap-more-row--out" onClick={() => setSheet('report')}><Flag size={20} /> <span>Report {isBusiness ? 'creator' : 'brand'}</span></button>
        </div>
        <p className="ap-mc-safe"><ShieldCheck size={16} /> Keep chats and payments on UGCad. You are only protected here.</p>
      </BottomSheet>

      {/* pick an action card */}
      <BottomSheet open={sheet === 'pick'} onClose={() => setSheet(null)} title="Send an action card" subtitle="Structured offers keep the deal on UGCad.">
        <div className="ap-more">
          {cards.map((c) => (
            <button key={c} type="button" className="ap-more-row" disabled={creatingCard} onClick={() => openComposer(c)}><FileText size={20} /> <span>{ACTION_CARD_LABELS[c]}</span></button>
          ))}
        </div>
      </BottomSheet>

      {/* shared files */}
      <BottomSheet open={sheet === 'files'} onClose={() => setSheet(null)} title="Shared in chat">
        {sharedFiles.length === 0 ? <div className="ap-empty"><p>No files shared yet.</p></div> : (
          <>
            <div className="ap-mc-shared">
              {sharedFiles.filter((u) => IMAGE_URL_RE.test(u)).map((u, i) => (
                <a key={`${u}-${i}`} href={getAttachmentUrl(u)} target="_blank" rel="noreferrer" aria-label={getAttachmentName(u, i)}><img src={getAttachmentUrl(u)} alt="" loading="lazy" /></a>
              ))}
            </div>
            {sharedFiles.filter((u) => !IMAGE_URL_RE.test(u)).map((u, i) => (
              <a key={`${u}-${i}`} className="ap-mc-file ap-mc-file--list" href={getAttachmentUrl(u)} target="_blank" rel="noreferrer"><FileText size={16} /><span>{getAttachmentName(u, i)}</span></a>
            ))}
          </>
        )}
      </BottomSheet>

      {/* report */}
      <BottomSheet
        open={sheet === 'report'}
        onClose={() => !reporting && setSheet(null)}
        title={`Report ${peerName}`}
        subtitle="Reviewed by our team within 5 business days. Don't include phone numbers or emails."
        footer={<button type="button" className="ap-btn ap-btn--block" disabled={reporting || !report.reason} onClick={submitReport}>{reporting ? 'Submitting…' : 'Submit report'}</button>}
      >
        <div className="ap-mc-reasons">
          {REPORT_REASONS.map(([v, l]) => (
            <button key={v} type="button" className={`ap-chip${report.reason === v ? ' is-on' : ''}`} onClick={() => setReport((r) => ({ ...r, reason: v }))}>{l}</button>
          ))}
        </div>
        <label className="ap-label" style={{ marginTop: 14 }}>Details (optional)
          <textarea className="ap-input" rows={4} placeholder="Add any context that will help our team…" value={report.details} onChange={(e) => setReport((r) => ({ ...r, details: e.target.value }))} />
        </label>
      </BottomSheet>

      {/* decline an offer */}
      <BottomSheet
        open={!!decline}
        onClose={() => !responding && setDecline(null)}
        title="Decline this offer?"
        subtitle={`Tell ${peerName} why - it helps them send a better one.`}
        footer={(
          <>
            <button type="button" className="ap-btn ap-btn--ghost" style={{ flex: 1 }} onClick={() => setDecline(null)} disabled={!!responding}>Cancel</button>
            <button type="button" className="ap-btn ap-btn--danger" style={{ flex: 1 }} onClick={submitDecline} disabled={!!responding}>{responding ? 'Sending…' : 'Decline offer'}</button>
          </>
        )}
      >
        {decline && (
          <>
            <div className="ap-mc-reasons">
              {DECLINE_REASONS.map((r) => (
                <button key={r.value} type="button" className={`ap-chip${decline.reason === r.value ? ' is-on' : ''}`} onClick={() => setDecline((d) => ({ ...d, reason: r.value }))}>{r.label}</button>
              ))}
            </div>
            <label className="ap-label" style={{ marginTop: 14 }}>Note (optional)
              <input className="ap-input" type="text" placeholder="Optional comment (no contact info)" value={decline.note} onChange={(e) => setDecline((d) => ({ ...d, note: e.target.value }))} />
            </label>
          </>
        )}
      </BottomSheet>

      {/* accept an offer */}
      <BottomSheet
        open={!!accept}
        onClose={() => !responding && setAccept(null)}
        title={`Accept this ${accept ? (ACTION_CARD_LABELS[accept.type] || 'offer').toLowerCase() : 'offer'}?`}
        subtitle={`${peerName} is notified straight away.`}
        footer={(
          <>
            <button type="button" className="ap-btn ap-btn--ghost" style={{ flex: 1 }} onClick={() => setAccept(null)} disabled={!!responding}>Cancel</button>
            <button type="button" className="ap-btn" style={{ flex: 1 }} onClick={confirmAccept} disabled={!!responding}>
              {responding ? 'Accepting…' : (() => { const f = accept?.fields || {}; const k = ACTION_CARD_PRICE_KEYS.find((x) => f[x] !== undefined && f[x] !== ''); return k && Number.isFinite(Number(f[k])) ? `Accept ${money(Number(f[k]))}` : 'Accept'; })()}
            </button>
          </>
        )}
      >
        {accept && (
          <div className="ap-mc-offer-rows ap-mc-offer-rows--sheet">
            {Object.entries(accept.fields || {}).slice(0, 6).map(([k, v]) => (
              <div key={k}><span>{fieldLabel(accept, k, v)}</span><b>{fieldValue(k, v)}</b></div>
            ))}
          </div>
        )}
      </BottomSheet>

      {/* new card / counter form */}
      <BottomSheet
        open={!!composer}
        onClose={() => !creatingCard && closeComposer()}
        tall
        title={composer ? (composer.counterFrom ? 'Send a counter offer' : ACTION_CARD_LABELS[composer.type]) : ''}
        subtitle={composer?.type === 'counter_offer' ? `${peerName} can accept, decline or counter again.` : 'Fill the details and send a structured action card.'}
        footer={(
          <>
            <button type="button" className="ap-btn ap-btn--ghost" style={{ flex: 1 }} onClick={closeComposer} disabled={creatingCard}>Cancel</button>
            <button type="button" className="ap-btn" style={{ flex: 1 }} onClick={submitCard} disabled={creatingCard}>{creatingCard ? 'Sending…' : 'Send card'}</button>
          </>
        )}
      >
        {composer && <div className="ap-mc-form">{(ACTION_CARD_FORM_FIELDS[composer.type] || []).map(renderField)}</div>}
      </BottomSheet>
    </AppShell>
  );
}
