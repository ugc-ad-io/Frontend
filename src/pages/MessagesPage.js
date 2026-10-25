import { useLiveEffect } from '../lib/liveUpdates';
import { Fragment, useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { uploadMedia } from '../utils/upload';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { AlertTriangle, BellOff, CheckCheck, ChevronLeft, ClipboardList, Eye, FileText, Flag, LayoutGrid, MoreHorizontal, Paperclip, Search, Send, ShieldAlert, ShieldCheck, Smile, SquarePen, Upload, User, UserRoundSearch, Wallet, X, Zap, FileCheck, IndianRupee, LayoutDashboard, MessageSquare, Settings, Star, Briefcase, Package, Lock, Plus } from 'lucide-react';
import { getInitial } from '../components/CreatorComponents';
import { displayName, creatorFirstName } from '../utils/displayName';
import DashboardLayout from '../components/DashboardLayout';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import CreatorPageHead from '../components/CreatorPageHead';
import PlanBrief from './PlanBrief';
import { findContactInfo } from '../components/RevisionRequestModal';
import CreatorProfileModal from '../components/CreatorProfileModal';
import BrandProfileCard from '../components/BrandProfileCard';
import { SkeletonList } from '../components/Skeleton';
import './CreatorDashboard.css';
import './MessagesPage.css';
import '../styles/brand-ui-messages.css';
import '../styles/brand-ui-mobile-b.css';
import '../styles/creator-ui-inbox.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const ATTACHMENT_MESSAGE_PREFIX = '__UGCAD_ATTACHMENT__:';
const MAX_ATTACHMENTS = 5;

// Always show the person's real NAME (never the "@handle"). Reuses the app-wide
// resolver, which prefers full_name and strips any leading "@" off the nickname.
const nameOf = (conv) => displayName(conv, 'User');
const CHAT_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Active Deals', value: 'active_deal' },
  { label: 'New Chat', value: 'no_deal' },
  { label: 'Archived', value: 'archived' }
];
// Creator view (design C09): same filters, creator wording, plus an Unread filter (unread_count > 0).
const CREATOR_CHAT_FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Orders', value: 'active_deal' },
  { label: 'New', value: 'no_deal' },
  { label: 'Unread', value: 'unread' },
  { label: 'Archived', value: 'archived' }
];
const ACTION_CARD_LABELS = {
  custom_offer: 'Custom Offer',
  private_invitation: 'Private Invitation',
  counter_offer: 'Counter Offer',
  revision_request: 'Revision Request',
  milestone_update: 'Milestone Update',
  damage_report: 'Damage Report',
  escalate_to_admin: 'Escalate to Admin',
  raise_dispute: 'Raise Dispute'
};
const ACTION_CARD_TYPES = Object.keys(ACTION_CARD_LABELS);
// Card fields that hold the money amount; the brand view lifts it into the card's hero strip.
const ACTION_CARD_PRICE_KEYS = ['price', 'budget', 'modified_price'];

// Friendly labels for the accept/reject/counter buttons the backend attaches to
// received offer cards (available_actions), instead of showing raw lowercase verbs.
const OFFER_RESPONSE_LABELS = { accept: 'Accept', reject: 'Decline', counter: 'Counter' };

// Offer cards whose rejection the backend requires a structured decline_reason for.
// Must stay in sync with OFFER_CARD_TYPES / DECLINE_REASONS in Backend/server.py.
const OFFER_CARD_TYPES = ['custom_offer', 'private_invitation', 'counter_offer'];
const DECLINE_REASONS = [
  { value: 'not_my_niche', label: 'Not my niche' },
  { value: 'budget', label: "Budget doesn't fit" },
  { value: 'timeline', label: 'Timeline too short' },
  { value: 'unavailable', label: 'Currently unavailable' },
  { value: 'other', label: 'Other' }
];

// Define which action cards are available for each role
const ACTION_CARDS_BY_ROLE = {
  // Creators respond to revision requests in the deal room — they don't send them,
  // so revision_request is not in their list.
  // Creators can't raise a dispute directly — they resolve with the brand first and
  // use "Escalate to Admin" only if that fails. So raise_dispute is not in their list.
  creator: ['custom_offer', 'counter_offer', 'milestone_update', 'damage_report', 'escalate_to_admin'],
  business: ['private_invitation', 'counter_offer', 'revision_request', 'escalate_to_admin', 'raise_dispute']
};

// A revision can only be asked for while the brand is reviewing submitted work.
// The backend enforces this too — this just hides a button that would 409.
const REVISION_STATES = ['Content Submitted - Awaiting Review', 'Revision Requested'];

const getAvailableActionCards = (userRole, selectedConversation) => {
  let cards = ACTION_CARDS_BY_ROLE[userRole] || ACTION_CARD_TYPES;
  const dealState = selectedConversation?.associated_deal_status || '';

  // Revision Request (brand only) makes sense only while content is under review;
  // on a finished/in-progress deal it's meaningless, so hide it there.
  if (!REVISION_STATES.includes(dealState)) {
    cards = cards.filter((card) => card !== 'revision_request');
  }

  return cards;
};

const ACTION_CARD_FORM_FIELDS = {
  custom_offer: [
    ['deliverable_type', 'Deliverable type', 'text', 'Video'],
    ['quantity', 'Quantity', 'number', '1'],
    ['duration', 'Duration', 'text', '30 seconds'],
    ['price', 'Price', 'number', '5000'],
    ['timeline', 'Timeline', 'text', '7 days'],
    ['usage_rights', 'Usage rights', 'text', 'Organic social']
  ],
  private_invitation: [
    ['campaign_name', 'Campaign name', 'text', 'Private campaign'],
    ['deliverable_summary', 'Deliverable summary', 'text', 'UGC video'],
    ['budget', 'Budget', 'number', '5000'],
    ['timeline', 'Timeline', 'text', '7 days'],
    ['usage_rights', 'Usage rights', 'text', 'Organic social'],
    // The brand writes the brief inline ("Send a brief") instead of pasting a link.
    // Required by the backend (require_fields → private_invitation) — without it the
    // send fails with "private_invitation requires: brief_details".
    ['brief_details', 'Brief', 'textarea', "What should the creator make? Add the hook, key points to cover, do's & don'ts, and any references."]
  ],
  counter_offer: [
    ['modified_price', 'Modified price', 'number', '5000'],
    ['revisions', 'Revisions', 'text', '1'],
    ['timeline', 'Delivery date', 'date', ''],
    ['usage_rights', 'Usage rights', 'text', 'Organic social'],
    ['diff_vs_original', 'Reason', 'textarea', 'Why are you countering? e.g. budget is too low for 3 videos']
  ],
  revision_request: [
    ['revision_text', 'Revision item', 'textarea', 'Please revise the submitted content.']
  ],
  milestone_update: [
    ['status', 'Current status', 'select', 'editing', ['In planning', 'Filming', 'Editing', 'Ready to submit']],
    ['notes', 'Notes', 'textarea', '']
  ],
  damage_report: [
    ['reason', 'Reason', 'text', 'Damaged product'],
    ['description', 'Description', 'textarea', 'Damage reported by creator.'],
    ['severity', 'Severity', 'select', 'medium', ['low', 'medium', 'high']]
  ],
  escalate_to_admin: [
    ['summary', 'Summary', 'textarea', 'Please review this chat thread and help resolve the ongoing communication issue between both parties. Kindly go through the messages above and advise on the best way forward.'],
    ['category', 'Category', 'select', 'communication', ['communication', 'timeline', 'clarity', 'other']]
  ],
  raise_dispute: [
    ['summary', 'Dispute summary', 'textarea', 'I want to raise a dispute for this chat/deal.'],
    ['category', 'Category', 'select', 'communication', ['communication', 'timeline', 'clarity', 'other']]
  ]
};

// Mirrors the backend's require_fields() per card type (server.py
// validate_action_card_payload). Kept in sync so a blank field is caught here with
// a useful message instead of coming back as a bare 400.
const ACTION_CARD_REQUIRED = {
  custom_offer: ['deliverable_type', 'quantity', 'duration', 'price', 'timeline', 'usage_rights'],
  private_invitation: ['campaign_name', 'deliverable_summary', 'budget', 'timeline', 'usage_rights', 'brief_details'],
  counter_offer: ['modified_price', 'revisions', 'timeline', 'usage_rights', 'diff_vs_original'],
  revision_request: ['revision_text'],
  milestone_update: ['status'],           // notes are optional
  damage_report: ['reason', 'description', 'severity'],
  escalate_to_admin: ['summary', 'category'],
  raise_dispute: ['summary', 'category'],
};

// Character limits the backend enforces (server.py validate_action_card_payload).
// Surfaced in the form — with a live counter — so the user sees the requirement
// up front instead of hitting Send and getting a 400 back.
const ACTION_CARD_FIELD_LIMITS = {
  escalate_to_admin: { summary: { min: 100, max: 500 } },
};

const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;
const CARD_STATUS_LABELS = { open: 'Awaiting reply', accept: 'Accepted', accepted: 'Accepted', reject: 'Declined', rejected: 'Declined', counter: 'Countered', countered: 'Countered', expired: 'Expired' };
const IMAGE_URL_RE = /\.(jpe?g|png|gif|webp)(\?|$)/i;

// Right-hand "Deal" card for a brand, built only from what the open thread already
// loaded: the latest offer card (campaign_name, price/budget, timeline, status) and the
// conversation's deal status. Rows with no data are left out.
const buildDealInfo = (messages, conv, forCreator = false) => {
  const offers = messages.filter((m) => m.item_type === 'action_card' && OFFER_CARD_TYPES.includes(m.type));
  const last = offers[offers.length - 1];
  const dealStatus = conv?.associated_deal_status;
  if (!last && !dealStatus) return null;
  const f = last?.fields || {};
  const title = [...offers].reverse().map((o) => o.fields?.campaign_name).find(Boolean) || f.deliverable_summary || f.deliverable_type || '';
  const priceKey = ACTION_CARD_PRICE_KEYS.find((k) => f[k] !== undefined && f[k] !== '');
  const priceNum = priceKey ? Number(f[priceKey]) : NaN;
  const timeline = /^\d{4}-\d{2}-\d{2}$/.test(String(f.timeline || ''))
    ? new Date(`${f.timeline}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : f.timeline;
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

const avatarColors = ['#07074e', '#ff7043', '#26a69a', '#ab47bc', '#ef5350', '#42a5f5', '#ffa726', '#29b6f6'];
const avatarColor = (name) => avatarColors[name?.charCodeAt ? (name.charCodeAt(0) % avatarColors.length) : 0];

const timeAgo = (timestamp) => {
  if (!timestamp) return '';
  const diff = Date.now() - new Date(timestamp);
  const mins = Math.max(0, Math.floor(diff / 60000));
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'Yesterday';
  return `${days}d`;
};

export default function MessagesPage() {
  const { user, setUser } = useAuth();
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
  const [warnings, setWarnings] = useState(null);
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [creatingCard, setCreatingCard] = useState(false);
  const [actionComposerType, setActionComposerType] = useState(null);
  const [actionChipsOpen, setActionChipsOpen] = useState(false); // "+ Send action card" toggles the chip row
  const [actionForm, setActionForm] = useState({});
  const [counteringCardId, setCounteringCardId] = useState(null); // original offer card this counter replies to
  const [declineCardId, setDeclineCardId] = useState(null); // offer card the decline picker is open for
  const [declineReason, setDeclineReason] = useState('');
  const [declineNote, setDeclineNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState(''); // conversations could not be loaded (never shown as "No conversations")
  const [msgError, setMsgError] = useState('');   // the open thread could not be loaded
  const [sending, setSending] = useState(false);
  const [briefTarget, setBriefTarget] = useState(null); // creatorId when the brief wizard is open
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mutedIds, setMutedIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('ugcad-muted-convs') || '[]')); }
    catch { return new Set(); }
  });
  const [report, setReport] = useState(null); // { reason, details } when the report modal is open
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [wallet, setWallet] = useState(null); // brand only: { available_balance, minimum_chat_balance, chat_unlocked }

  const typingSentAtRef = useRef(0);
  const messageContainerRef = useRef(null);
  const userScrolledUpRef = useRef(false);
  // Set when a conversation is opened, so the first message render jumps straight
  // to the latest message instead of leaving the view at the top of the thread.
  const justOpenedRef = useRef(false);

  const navItems = user?.role === 'business'
    ? [
      { name: 'Brand Dashboard', icon: LayoutGrid, action: () => navigate('/dashboard/business') },
      { name: 'Post a Campaign', icon: SquarePen, action: () => navigate('/dashboard/business/post-brief') },
      { name: 'Creator Bids', icon: UserRoundSearch, action: () => navigate('/dashboard/business/pending-bids') },
      { name: 'Browse Creator', icon: Search, action: () => navigate('/dashboard/business/browse-creator') },
      { name: 'All Campaigns', icon: ClipboardList, action: () => navigate('/dashboard/business/all-campaigns') },
      { name: 'Work Review', icon: FileCheck, action: () => navigate('/dashboard/business/work-review') },
      { name: 'Messages', icon: MessageSquare, action: () => navigate('/messages'), active: true },
      { name: 'Manage Shipment', icon: Package, action: () => navigate('/dashboard/business/shipments') },
      { name: 'Wallet', icon: Wallet, action: () => navigate('/dashboard/business/wallet') },
      { name: 'Settings', icon: Settings, action: () => navigate('/settings') }
    ]
    : [
      { name: 'Dashboard', icon: LayoutDashboard, action: () => navigate('/dashboard/creator') },
      { name: 'My Active Work', icon: Zap, action: () => navigate('/my-active-work') },
      { name: 'Reviews', icon: Star, action: () => navigate('/reviews') },
      { name: 'Portfolio', icon: User, action: () => navigate('/portfolio') },
      { name: 'Browse Campaigns', icon: Briefcase, action: () => navigate('/browse-briefs') },
      { name: 'My Deals', icon: FileCheck, action: () => navigate('/my-deals') },
      { name: 'Messages', icon: MessageSquare, action: () => navigate('/messages'), active: true },
      { name: 'Payout', icon: IndianRupee, action: () => navigate('/withdrawal') },
      { name: 'Settings', icon: Settings, action: () => navigate('/settings') }
    ];

  // Refresh user data on mount
  useLiveEffect(() => {
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
  useLiveEffect(() => {
    if (user?.id) {
      fetchConversations();
      fetchWarnings();
      const interval = setInterval(fetchConversations, 5000);
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  // Brand only: the wallet decides whether the "Add funds" bar shows above the composer.
  // The server is what actually blocks sending below the minimum; this is just the explanation.
  useLiveEffect(() => {
    if (user?.role !== 'business') return;
    axios.get(`${API}/business/wallet`)
      .then((res) => setWallet(res.data || null))
      .catch(() => { /* no bar if the wallet can't be read */ });
  }, [user?.role, selectedId]);

  // Auto-select conversation from URL param
  useEffect(() => {
    const convId = searchParams.get('conv');
    if (convId) setSelectedId(convId);
  }, [searchParams]);

  // Fetch messages when conversation selected
  useLiveEffect(() => {
    if (!selectedId) return;
    // Opening a (different) conversation: the next messages render should land at
    // the bottom, and any "user scrolled up" state from the previous chat resets.
    justOpenedRef.current = true;
    userScrolledUpRef.current = false;
    setMsgError('');
    fetchMessages(selectedId);
    fetchTyping(selectedId);
    const interval = setInterval(() => fetchMessages(selectedId), 3000);
    const typingInterval = setInterval(() => fetchTyping(selectedId), 3000);
    return () => {
      clearInterval(interval);
      clearInterval(typingInterval);
    };
  }, [selectedId]);

  // Smart auto-scroll: only scroll if user is at bottom
  // useLayoutEffect (not useEffect): the open-jump must happen BEFORE the browser
  // paints, so the first frame the user sees is already at the newest message.
  // With useEffect it painted the top first, then jumped — a visible flash.
  useLayoutEffect(() => {
    if (!messageContainerRef.current) return;
    const container = messageContainerRef.current;

    // First render after opening a conversation: land straight at the newest
    // message. An instant scrollTop set on the container — it starts at scrollTop
    // 0 (the top), so the "already at bottom" rule below never fires on open,
    // which is why mobile opened chats at the top.
    if (justOpenedRef.current && messages.length) {
      justOpenedRef.current = false;
      container.scrollTop = container.scrollHeight;
      // Re-pin next frame so late-laid-out content (attachments, cards) can't
      // leave us a screen short of the bottom.
      requestAnimationFrame(() => { container.scrollTop = container.scrollHeight; });
      return;
    }

    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;

    if (isAtBottom && !userScrolledUpRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleMessagesScroll = () => {
    if (!messageContainerRef.current) return;
    const container = messageContainerRef.current;
    const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    userScrolledUpRef.current = !isAtBottom;
  };

  const isMuted = selectedId ? mutedIds.has(selectedId) : false;

  const toggleMute = () => {
    if (!selectedId) return;
    setMutedIds((prev) => {
      const next = new Set(prev);
      if (next.has(selectedId)) next.delete(selectedId); else next.add(selectedId);
      try { localStorage.setItem('ugcad-muted-convs', JSON.stringify([...next])); } catch { /* ignore */ }
      toast.success(next.has(selectedId) ? 'Chat muted on this device' : 'Chat unmuted');
      return next;
    });
    setHeaderMenuOpen(false);
  };

  const submitReport = async (e) => {
    e.preventDefault();
    if (!report?.reason) { toast.error('Please choose a reason'); return; }
    setReportSubmitting(true);
    try {
      const res = await axios.post(`${API}/report-user`, {
        reported_user_id: selectedId,
        deal_id: selectedConv?.associated_deal_id || null,
        reason: report.reason,
        details: report.details || '',
      });
      toast.success(res.data?.message || 'Report submitted');
      setReport(null);
    } catch (err) {
      toast.error(apiErrorMessage(err) || 'Failed to submit report');
    } finally {
      setReportSubmitting(false);
    }
  };

  const fetchConversations = async () => {
    try {
      const res = await axios.get(`${API}/chat/conversations`);
      setConversations(Array.isArray(res.data) ? res.data : []);
      setListError('');
      setLoading(false);
    } catch (err) {
      setListError(err?.response ? 'Could not load your conversations.' : "You're offline. Check your connection and try again.");
      setLoading(false);
    }
  };

  const fetchMessages = async (otherId) => {
    try {
      const res = await axios.get(`${API}/chat/${otherId}`);
      setMessages(Array.isArray(res.data) ? res.data : []);
      setMsgError('');
    } catch (err) {
      setMsgError(err?.response ? 'Could not load this conversation.' : "You're offline. Check your connection and try again.");
    }
  };

  const fetchWarnings = async () => {
    try {
      const res = await axios.get(`${API}/chat/warnings`);
      setWarnings(res.data);
    } catch (err) {
      console.error('Failed to load chat warnings');
    }
  };

  const fetchTyping = async (otherId) => {
    try {
      const res = await axios.get(`${API}/chat/${otherId}/typing`);
      setIsOtherTyping(Boolean(res.data.typing));
    } catch (err) {
      setIsOtherTyping(false);
    }
  };

  const sendTypingSignal = async () => {
    if (!selectedId) return;
    const now = Date.now();
    if (now - typingSentAtRef.current < 2500) return;
    typingSentAtRef.current = now;
    try {
      await axios.post(`${API}/chat/${selectedId}/typing`);
    } catch (err) {
      // Typing indicators are best-effort.
    }
  };

  // After accepting a private invitation the creator can nudge the brand for the
  // full brief instead of just waiting.
  const [requestingBrief, setRequestingBrief] = useState(false);
  const requestBrief = async () => {
    if (!selectedId || requestingBrief) return;
    setRequestingBrief(true);
    try {
      await axios.post(`${API}/chat/send`, {
        recipient_id: selectedId,
        message: "I've accepted the invitation - please share the full brief so I can get started.",
        attachment_urls: [],
      });
      toast.success('Brief requested - the brand has been notified.');
      await fetchMessages(selectedId);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not send the request'));
    } finally {
      setRequestingBrief(false);
    }
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    const attachmentUrls = selectedFiles.map((file) => file.url).filter(Boolean);
    if ((!newMessage.trim() && !attachmentUrls.length) || !selectedId) return;

    if (selectedFiles.length && !attachmentUrls.length) {
      toast.error('File upload did not complete. Please attach the file again.');
      return;
    }

    // Block phone/email client-side too — don't wait for the server to reject, and don't
    // let a message that slips past the backend get sent silently. Shared detector.
    const contact = findContactInfo(newMessage);
    if (contact) {
      toast.error(contact === 'email'
        ? 'Email addresses aren’t allowed - keep all communication on-platform.'
        : 'Phone numbers aren’t allowed - keep all communication on-platform.');
      return;
    }

    setSending(true);
    try {
      const res = await axios.post(`${API}/chat/send`, {
        recipient_id: selectedId,
        message: newMessage.trim() || `${ATTACHMENT_MESSAGE_PREFIX}${attachmentUrls.join('|')}`,
        attachment_urls: attachmentUrls
      });

      if (res.data.filtered) {
        toast.warning(`Message filtered for policy violations. Warning ${res.data.warning_count}/3`);
      }

      setNewMessage('');
      setSelectedFiles([]);
      setEmojiPickerOpen(false);
      await fetchMessages(selectedId);
    } catch (err) {
      if (err.response?.status === 400 && err.response?.data?.detail?.includes('contact information')) {
        toast.error(apiErrorMessage(err));
        fetchWarnings();
        return;
      }
      toast.error(apiErrorMessage(err, 'Failed to send message'));
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

    const validationError = validateSelectedFiles(files);
    if (validationError) {
      toast.error(validationError);
      event.target.value = '';
      return;
    }

    setUploadingFiles(true);
    Promise.all(files.map(async (file) => {
      const res = { data: await uploadMedia(file, API) };
      const fileUrl = res.data.file_url || res.data.url || res.data.path;
      if (!fileUrl) throw new Error(`${file.name} uploaded but no file URL was returned`);
      return { name: file.name, url: fileUrl };
    }))
      .then((uploadedFiles) => {
        setSelectedFiles((current) => [...current, ...uploadedFiles]);
        toast.success(`${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''} attached`);
      })
      .catch((err) => {
        toast.error(apiErrorMessage(err, 'File attachment failed'));
      })
      .finally(() => {
        setUploadingFiles(false);
      });

    event.target.value = '';
  };

  const removeSelectedFile = (url) => {
    setSelectedFiles((current) => current.filter((file) => file.url !== url));
  };

  const validateSelectedFiles = (files) => {
    if (selectedFiles.length + files.length > MAX_ATTACHMENTS) return 'A message can include at most 5 attachments.';
    for (const file of files) {
      const isImage = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'].includes(file.type);
      const isPdf = file.type === 'application/pdf';
      const isVideo = file.type?.startsWith('video/');
      if (!isImage && !isPdf && !isVideo) return 'Upload jpg, png, gif, pdf, or video files only.';
      if (isImage && file.size > 10 * 1024 * 1024) return 'Images must be 10 MB or smaller.';
      if (isPdf && file.size > 25 * 1024 * 1024) return 'PDFs must be 25 MB or smaller.';
      if (isVideo && file.size > 100 * 1024 * 1024) return 'Videos must be 100 MB or smaller.';
    }
    return '';
  };

  const getAttachmentUrl = (url) => {
    if (!url) return '';
    return url.startsWith('http') ? url : `${BACKEND_URL}${url}`;
  };

  const getAttachmentName = (url, index) => {
    if (!url) return `Attachment ${index + 1}`;
    return decodeURIComponent(String(url).split('/').pop() || `Attachment ${index + 1}`);
  };

  const getMessageAttachments = (msg) => {
    if (msg.attachment_urls?.length) return msg.attachment_urls;
    if (typeof msg.message === 'string' && msg.message.startsWith(ATTACHMENT_MESSAGE_PREFIX)) {
      return msg.message.slice(ATTACHMENT_MESSAGE_PREFIX.length).split('|').filter(Boolean);
    }
    return [];
  };

  const getDisplayMessage = (msg) => {
    if (typeof msg.message === 'string' && msg.message.startsWith(ATTACHMENT_MESSAGE_PREFIX)) return '';
    return msg.message;
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

  const getItemTime = (item) => item.created_at || item.timestamp;

  const formatActionValue = (value) => {
    if (Array.isArray(value)) return value.map((item) => typeof item === 'object' ? Object.values(item).filter(Boolean).join(' - ') : item).join(', ');
    if (typeof value === 'object' && value !== null) return Object.values(value).filter(Boolean).join(' - ');
    return String(value ?? '');
  };

  const getReadLabel = (item) => {
    if (item.sender_id !== user.id) return '';
    if (item.status === 'read' || item.read_at || (item.read_by || []).includes(selectedId)) return 'Read';
    return 'Delivered';
  };

  const respondToActionCard = async (cardId, action, extra = {}) => {
    try {
      await axios.post(`${API}/chat/action-cards/${cardId}/respond`, { action, ...extra });
      toast.success('Action card updated');
      fetchMessages(selectedId);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Action failed'));
    }
  };

  // Declining an offer card requires a structured reason (backend rejects a bare
  // reject). Open an inline picker instead of firing the reject immediately.
  const startDecline = (cardId) => {
    setDeclineCardId(cardId);
    setDeclineReason('');
    setDeclineNote('');
  };

  const submitDecline = async () => {
    if (!declineReason) {
      toast.error('Please select a reason for declining');
      return;
    }
    await respondToActionCard(declineCardId, 'reject', { decline_reason: declineReason, note: declineNote });
    setDeclineCardId(null);
  };

  // Open the full multi-step brief wizard in a modal for the selected creator.
  const openBriefFromCard = () => setBriefTarget(selectedId);

  const renderActionCard = (item) => {
    const fields = item.fields || {};
    const isOwn = item.sender_id === user.id;
    const priceKey = ACTION_CARD_PRICE_KEYS.find((k) => fields[k] !== undefined && fields[k] !== '');
    const priceNum = priceKey ? Number(fields[priceKey]) : NaN;
    // Creator view: the offer's name becomes the card title, so it is not repeated in the field grid.
    const titleKey = isBusiness ? '' : ['campaign_name', 'deliverable_summary', 'deliverable_type'].find((k) => fields[k]);
    return (
      <div key={item.id} className={`msg-action-card ${isOwn ? 'is-own' : ''}`}>
        <div className="msg-action-card-top">
          <div className="msg-action-card-head">
            <span><ShieldAlert size={16} /></span>
            <div>
              <strong>{ACTION_CARD_LABELS[item.type] || item.type}</strong>
              {item.deal_id ? <small>{item.deal_id}</small> : null}
            </div>
            <em>{item.status || 'open'}</em>
          </div>
          {titleKey ? <div className="msg-action-card-title">{fields[titleKey]}</div> : null}
          {priceKey ? (
            <div className="msg-action-card-price">
              {Number.isFinite(priceNum) ? `₹${priceNum.toLocaleString('en-IN')}` : String(fields[priceKey])}
            </div>
          ) : null}
        </div>
        <div className="msg-action-card-fields">
          {Object.entries(fields).filter(([key]) => key !== titleKey).slice(0, 6).map(([key, value]) => (
            <p key={key} data-field={key}><span>{item.type === 'counter_offer' && key === 'timeline' && /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? 'Delivery date' : key.replaceAll('_', ' ')}</span><strong>{formatActionValue(value)}</strong></p>
          ))}
        </div>
        {!isOwn && item.status === 'open' && item.available_actions?.length ? (
          <div className="msg-action-card-actions">
            {item.available_actions.map((action) => {
              const isOfferDecline = action === 'reject' && OFFER_CARD_TYPES.includes(item.type);
              const onClick = action === 'counter'
                ? () => openCounterFromCard(item)
                : isOfferDecline
                  ? () => startDecline(item.id)
                  : () => respondToActionCard(item.id, action);
              return (
                <button key={action} type="button" className={`is-${action}`} onClick={onClick}>
                  {OFFER_RESPONSE_LABELS[action] || action}
                  {!isBusiness && action === 'accept' && Number.isFinite(priceNum) ? ` ${money(priceNum)}` : ''}
                </button>
              );
            })}
          </div>
        ) : null}
        {declineCardId === item.id ? (
          <div className="msg-action-card-decline" style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <select
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d0d5dd' }}
            >
              <option value="">Select a reason…</option>
              {DECLINE_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <input
              type="text"
              placeholder="Optional comment (no contact info)"
              value={declineNote}
              onChange={(e) => setDeclineNote(e.target.value)}
              style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d0d5dd' }}
            />
            <div className="msg-action-card-actions">
              <button type="button" onClick={submitDecline}>Send decline</button>
              <button type="button" onClick={() => setDeclineCardId(null)}>Cancel</button>
            </div>
          </div>
        ) : null}
        {isOwn && item.type === 'private_invitation' && item.status === 'accepted' ? (
          <div className="msg-action-card-actions">
            <button type="button" className="is-primary" onClick={() => openBriefFromCard(item)}>Post a Brief →</button>
          </div>
        ) : null}
        {!isOwn && item.type === 'private_invitation' && item.status === 'accepted' ? (
          <>
            <p className="msg-action-card-note">Accepted - waiting for the brand to post the brief.</p>
            <div className="msg-action-card-actions">
              <button type="button" onClick={requestBrief} disabled={requestingBrief}>
                {requestingBrief ? 'Sending…' : 'Need brief'}
              </button>
            </div>
          </>
        ) : null}
        <small className="msg-action-card-time">{new Date(getItemTime(item)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
      </div>
    );
  };

  const getDefaultActionForm = (type) => Object.fromEntries(
    (ACTION_CARD_FORM_FIELDS[type] || []).map(([key, , , fallback]) => [key, fallback])
  );

  const openActionComposer = (type) => {
    // Private Invitation is not an inline card - it opens the SAME brief wizard the
    // brand uses from a creator's profile (PlanBrief, below). The six-field composer
    // only ever posted a chat card: it created no campaign, so nothing reached the
    // admin approval queue and the creator had no brief to work from. The wizard
    // submits a real brief for review instead.
    if (type === 'private_invitation') {
      if (!selectedId) return;
      setBriefTarget(selectedId);
      return;
    }
    setCounteringCardId(null); // a fresh card from the chips isn't tied to any offer
    setActionComposerType(type);
    setActionForm(getDefaultActionForm(type));
  };

  // Countering a received offer: open the counter composer pre-filled with that
  // offer's terms (so the brand tweaks a number instead of retyping everything),
  // and remember which offer we're replying to so submit can close it out.
  const openCounterFromCard = (item) => {
    const f = item.fields || {};
    const price = f.modified_price ?? f.price ?? f.budget;
    setCounteringCardId(item.id);
    setActionComposerType('counter_offer');
    setActionForm({
      modified_price: price != null && String(price).trim() !== '' ? String(price) : '5000',
      revisions: f.revisions != null ? String(f.revisions) : '1',
      timeline: /^\d{4}-\d{2}-\d{2}$/.test(f.timeline || '') ? f.timeline : '',
      usage_rights: f.usage_rights || 'Organic social',
      diff_vs_original: '',
    });
  };

  const closeActionComposer = () => {
    setActionComposerType(null);
    setActionForm({});
    setCounteringCardId(null);
  };

  const getActionCardPayloadFields = () => {
    const fields = { ...actionForm };
    if (actionComposerType === 'revision_request') {
      return { revision_items: [{ description: fields.revision_text, severity: 'medium' }] };
    }
    // Only coerce numbers when there's actually a value — Number('') is 0, which
    // would silently send a ₹0 budget/price and pass the backend's "is it set?" check.
    ['quantity', 'price', 'budget', 'modified_price'].forEach((key) => {
      const v = fields[key];
      if (v === undefined || v === null || String(v).trim() === '') return;
      const n = Number(v);
      if (Number.isFinite(n)) fields[key] = n;
    });
    return fields;
  };

  const submitActionCard = async (event) => {
    event?.preventDefault();
    if (!selectedId || creatingCard || !actionComposerType) return;

    // Validate up front so a blank field doesn't come back as a bare 400 with no
    // indication of which field was missing.
    const required = ACTION_CARD_REQUIRED[actionComposerType] || [];
    const labelOf = (key) =>
      (ACTION_CARD_FORM_FIELDS[actionComposerType] || []).find(([k]) => k === key)?.[1] || key;
    const missing = required.filter((key) => {
      const v = actionForm[key];
      return v === undefined || v === null || String(v).trim() === '';
    });
    if (missing.length) {
      toast.error(`Please fill in: ${missing.map(labelOf).join(', ')}`);
      return;
    }
    // A zero/negative budget or price is never valid.
    for (const key of ['budget', 'price', 'modified_price']) {
      if (required.includes(key) && Number(actionForm[key]) <= 0) {
        toast.error(`${labelOf(key)} must be greater than zero`);
        return;
      }
    }
    // Enforce the same length rules the backend does, with a clear message.
    const limits = ACTION_CARD_FIELD_LIMITS[actionComposerType] || {};
    for (const [key, { min, max }] of Object.entries(limits)) {
      const len = String(actionForm[key] ?? '').trim().length;
      if (len < min || len > max) {
        toast.error(`${labelOf(key)} must be ${min} to ${max} characters (currently ${len}).`);
        return;
      }
    }

    setCreatingCard(true);
    try {
      await axios.post(`${API}/chat/action-cards`, {
        recipient_id: selectedId,
        type: actionComposerType,
        deal_id: counteringCardId ? messages.find(item => item.id === counteringCardId)?.deal_id : undefined,
        fields: getActionCardPayloadFields()
      });
      // If this counter replies to a specific offer, mark that offer as countered
      // so it leaves the "open" state. Best-effort: it may already be closed/expired,
      // in which case the counter card we just sent still stands on its own.
      if (counteringCardId) {
        try {
          await axios.post(`${API}/chat/action-cards/${counteringCardId}/respond`, { action: 'counter' });
        } catch (err) {
          // original offer no longer respondable — ignore, the counter was still sent
        }
      }
      toast.success(`${ACTION_CARD_LABELS[actionComposerType]} sent`);
      closeActionComposer();
      fetchMessages(selectedId);
      fetchConversations();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Action card failed'));
    } finally {
      setCreatingCard(false);
    }
  };

  const renderActionComposerField = ([key, label, type, , options]) => {
    const value = actionForm[key] ?? '';
    if (type === 'textarea') {
      // If this field has a length rule, show it next to the label and count live,
      // so the requirement is visible before Send — not a surprise 400 after.
      const limit = (ACTION_CARD_FIELD_LIMITS[actionComposerType] || {})[key];
      const len = String(value).length;
      const outOfRange = limit && (len < limit.min || len > limit.max);
      return (
        <label key={key}>
          <span className="msg-field-lbl">
            {label}
            {limit && (
              <em className={`msg-charhint${outOfRange ? ' bad' : ' ok'}`}>
                {len}/{limit.max}{len < limit.min ? ` · min ${limit.min}` : ''}
              </em>
            )}
          </span>
          <textarea
            value={value}
            maxLength={limit ? limit.max : undefined}
            placeholder={limit ? `Write ${limit.min}–${limit.max} characters` : undefined}
            onChange={(event) => setActionForm((current) => ({ ...current, [key]: event.target.value }))}
          />
        </label>
      );
    }
    if (type === 'select') {
      return (
        <label key={key}>
          <span>{label}</span>
          <select value={value} onChange={(event) => setActionForm((current) => ({ ...current, [key]: event.target.value }))}>
            {(options || []).map((option) => <option key={option} value={String(option).toLowerCase().replaceAll(' ', '_')}>{option}</option>)}
          </select>
        </label>
      );
    }
    return (
      <label key={key}>
        <span>{label}</span>
        <input type={type} value={value} onChange={(event) => setActionForm((current) => ({ ...current, [key]: event.target.value }))} />
      </label>
    );
  };

  const handleEmojiSelect = (emoji) => {
    setNewMessage((current) => `${current}${emoji}`);
    setEmojiPickerOpen(false);
  };

  // Filter conversations
  const filteredConversations = conversations.filter((conv) => {
    const matchesSearch = nameOf(conv).toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === 'all' ||
      (filter === 'unread' ? conv.unread_count > 0 : conv.thread_classification === filter);
    return matchesSearch && matchesFilter;
  });

  const selectedConv = conversations.find((c) => c.user_id === selectedId);
  const actionCardsOnly = warnings?.action_cards_only_until && new Date(warnings.action_cards_only_until) > new Date();

  // Creators use the top-nav marketplace shell (same as My Deals / Browse Briefs)
  // so opening Messages keeps you in the top-nav UI instead of redirecting to the
  // old sidebar dashboard. Business keeps its sidebar dashboard layout.
  const isBusiness = user?.role === 'business';
  // A brand sees a creator by FIRST NAME only (never full name or @username). A
  // creator keeps the brand's full business name.
  const peerLabel = (conv) => (isBusiness ? creatorFirstName(conv) : displayName(conv, 'User'));
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);
  const Shell = isBusiness ? BrandTopNavLayout : CreatorTopNavLayout;
  const shellProps = { notifications: totalUnread };
  // Creators get a padded page (title row + inbox card); brands render the layout directly as before.
  const Page = isBusiness ? Fragment : 'div';
  const pageProps = isBusiness ? {} : { className: `cui-m-page${selectedId ? ' has-chat' : ''}` };
  const walletLow = isBusiness && wallet != null
    && (wallet.chat_unlocked === false || Number(wallet.available_balance) < Number(wallet.minimum_chat_balance));
  const dealInfo = selectedId ? buildDealInfo(messages, selectedConv, !isBusiness) : null;
  // newest first, capped; shown in the right-hand "Shared in chat" column (brand and creator)
  const sharedFiles = selectedId ? messages.flatMap((m) => getMessageAttachments(m)).reverse().slice(0, 9) : [];

  const renderDealInfo = () => (dealInfo ? (
    <>
      {dealInfo.title ? <strong className="msg-deal-title">{dealInfo.title}</strong> : null}
      {dealInfo.sub ? <span className="msg-deal-sub">{dealInfo.sub}</span> : null}
      {dealInfo.rows.length ? (
        <dl className="msg-deal-rows">
          {dealInfo.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>
      ) : null}
    </>
  ) : null);

  return (
    <Shell {...shellProps}>
      <Page {...pageProps}>
      {!isBusiness && (
        <CreatorPageHead
          title="Inbox"
          subtitle={totalUnread > 0 ? `${totalUnread} unread` : 'Your conversations with brands.'}
          hideSearch
        />
      )}
      <div className={`msg-layout ${selectedId ? 'has-active-chat' : ''}`}>
        {/* Left Panel: Conversations List */}
        <div className="msg-list-panel">
          <div className="msg-list-header">
            <h2>Messages</h2>
            <p>Manage your campaign conversations</p>
          </div>

          <div className="msg-search">
            <Search size={16} />
            <input
              type="search"
              aria-label="Search messages"
              placeholder={isBusiness ? 'Search messages...' : 'Search brands'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="msg-filters">
            {(isBusiness ? CHAT_FILTERS : CREATOR_CHAT_FILTERS).map((f) => (
              <button
                key={f.value}
                type="button"
                className={filter === f.value ? 'is-active' : ''}
                onClick={() => setFilter(f.value)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="msg-conv-list">
            {loading ? (
              <SkeletonList rows={7} />
            ) : listError && conversations.length === 0 ? (
              <div role="alert" style={{ padding: '20px', textAlign: 'center', color: '#585c7e' }}>
                <p style={{ margin: '0 0 12px' }}>{listError}</p>
                <button type="button" className="msg-action-chip" onClick={() => { setLoading(true); fetchConversations(); }}>Retry</button>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: '#999' }}>
                {conversations.length === 0 ? 'No conversations yet. Messages from brands and creators you work with will appear here.' : 'No conversations match your search or filter.'}
              </div>
            ) : (
              filteredConversations.map((conv) => (
                <div
                  key={conv.user_id}
                  role="button"
                  tabIndex={0}
                  className={`msg-conv-item ${selectedId === conv.user_id ? 'is-active' : ''}${conv.unread_count > 0 && !mutedIds.has(conv.user_id) ? ' has-unread' : ''}`}
                  onClick={() => setSelectedId(conv.user_id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(conv.user_id); } }}
                >
                  <div className="msg-avatar-wrap">
                    <div className="msg-avatar" style={{ background: avatarColor(peerLabel(conv)) }}>
                      {getInitial(peerLabel(conv))}
                    </div>
                  </div>
                  <div className="msg-conv-body">
                    <div className="msg-conv-top">
                      <strong>{peerLabel(conv)}</strong>
                      {mutedIds.has(conv.user_id) && <BellOff size={13} aria-label="Muted" style={{ flex: 'none', color: '#9296ba' }} />}
                      <span className="msg-time-ago">{timeAgo(conv.timestamp || conv.last_message?.timestamp)}</span>
                    </div>
                    <p className="msg-preview">
                      {getDisplayMessage(conv.last_message || {})
                        ? (getDisplayMessage(conv.last_message).length > 50 ? `${getDisplayMessage(conv.last_message).slice(0, 50)}...` : getDisplayMessage(conv.last_message))
                        : getMessageAttachments(conv.last_message || {}).length
                          ? 'File attachment'
                          : ''}
                    </p>
                    {conv.associated_deal_status ? <small className="msg-deal-status" data-status={String(conv.associated_deal_status).toLowerCase()}>{conv.associated_deal_status}</small> : null}
                  </div>
                  {conv.unread_count > 0 && !mutedIds.has(conv.user_id) && <span className="msg-badge">{conv.unread_count}</span>}
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
              <button
                type="button"
                className="msg-back-btn"
                aria-label="Back to conversations"
                title="Back to conversations"
                onClick={() => setSelectedId(null)}
              >
                <ChevronLeft size={22} />
              </button>
              <div className="msg-avatar-wrap" style={{ width: '48px', height: '48px' }}>
                <div className="msg-avatar" style={{ background: avatarColor(peerLabel(selectedConv)) }}>
                  {getInitial(peerLabel(selectedConv))}
                </div>
              </div>
              <div className="msg-header-info">
                <div>
                  <strong>{peerLabel(selectedConv)}</strong>
                </div>
                {(selectedConv?.associated_deal_status || isMuted) ? (
                  <small className="msg-online" style={{ color: '#585c7e' }}>
                    {[selectedConv?.associated_deal_status, isMuted ? 'Muted' : ''].filter(Boolean).join(' · ')}
                  </small>
                ) : null}
              </div>
              <div className="msg-chat-actions">
                {/* Brand → creator: quick "Send a Brief" that opens the brief wizard for
                    this creator (same action as the "Send a Brief" chip in the chat popup).
                    Only a brand sends briefs, so it's hidden on the creator's side. */}
                {isBusiness && (
                  <button type="button" className="msg-send-brief" title="Send a brief to this creator" onClick={openBriefFromCard}>
                    <FileText size={15} /> <span>Send a Brief</span>
                  </button>
                )}
                <div className="msg-more-wrap">
                  <button type="button" title="More actions" className={headerMenuOpen ? 'is-on' : ''} onClick={() => setHeaderMenuOpen((o) => !o)}><MoreHorizontal size={18} /></button>
                  {headerMenuOpen && (
                    <>
                      <div className="msg-more-backdrop" onClick={() => setHeaderMenuOpen(false)} />
                      <div className="msg-more-menu" role="menu">
                        <button type="button" onClick={() => { setHeaderMenuOpen(false); setProfileOpen(true); }}><User size={15} /> View profile</button>
                        <button type="button" onClick={toggleMute}><BellOff size={15} /> {isMuted ? 'Unmute chat' : 'Mute chat'}</button>
                        <button type="button" className="danger" onClick={() => { setHeaderMenuOpen(false); setReport({ reason: '', details: '' }); }}><Flag size={15} /> Report user</button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {dealInfo ? (
              <details className="msg-deal-strip">
                <summary><span>Deal</span><em>{dealInfo.title || dealInfo.sub || selectedConv?.associated_deal_status}</em></summary>
                <div className="msg-deal-strip-body">{renderDealInfo()}</div>
              </details>
            ) : null}

            {/* Messages */}
            <div className="msg-messages" ref={messageContainerRef} onScroll={handleMessagesScroll}>
              {msgError && messages.length === 0 ? (
                <div role="alert" style={{ textAlign: 'center', color: '#585c7e', marginTop: '40px' }}>
                  <p style={{ margin: '0 0 12px' }}>{msgError}</p>
                  <button type="button" className="msg-action-chip" onClick={() => fetchMessages(selectedId)}>Retry</button>
                </div>
              ) : messages.length === 0 ? (
                <div style={{ textAlign: 'center', color: '#999', marginTop: '40px' }}>No messages yet</div>
              ) : (
                messages.map((msg, idx) => {
                  if (msg.item_type === 'action_card') return renderActionCard(msg);
                  const isOwn = msg.sender_id === user.id;
                  const isSystem = msg.system_message || msg.sender_id === 'system';

                  if (isSystem) {
                    return (
                      <div key={msg.id || idx} className="msg-system-wrap">
                        <div className="msg-system-pill msg-system-desktop">{msg.message}</div>
                        <details className="msg-system-mobile">
                          <summary><span>Campaign update</span><em>View details</em></summary>
                          <p>{msg.message}</p>
                        </details>
                      </div>
                    );
                  }

                  return (
                    <div key={msg.id || idx} className={`msg-bubble-row ${isOwn ? 'is-own' : ''}`}>
                      {!isOwn && (
                        <div className="msg-avatar sm" style={{ background: avatarColor(peerLabel(selectedConv)) }}>
                          {getInitial(peerLabel(selectedConv))}
                        </div>
                      )}
                      <div className="msg-bubble">
                        {getDisplayMessage(msg) ? <p>{getDisplayMessage(msg)}</p> : null}
                        {renderAttachments(getMessageAttachments(msg))}
                        <span className="msg-time">
                          {new Date(getItemTime(msg)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {getReadLabel(msg) ? <em><CheckCheck size={13} /> {getReadLabel(msg)}</em> : null}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              {isOtherTyping ? <div className="msg-typing">{peerLabel(selectedConv)} is typing...</div> : null}
              <div ref={messagesEndRef} />
            </div>

            {walletLow ? (
              <div className="msg-wallet-bar" role="status">
                <div className="msg-wallet-bar-text">
                  <strong>Add {money(wallet.minimum_chat_balance)} to start chatting</strong>
                  <span>Your wallet has {money(wallet.available_balance || 0)}. You can still read every message.</span>
                </div>
                <button type="button" onClick={() => navigate('/dashboard/business/wallet')}>Add funds</button>
              </div>
            ) : null}

            {/* Quick Actions — a single horizontal row. It scrolls sideways when the
                options don't fit, rather than opening a vertical dropdown. */}
            <div className="msg-quick-actions">
              <button
                type="button"
                className={`msg-quick-actions-lbl${actionChipsOpen ? ' is-open' : ''}`}
                aria-expanded={actionChipsOpen}
                onClick={() => setActionChipsOpen((o) => !o)}
              >
                <Plus size={14} /> Send action card
              </button>
              {actionChipsOpen && (
                <div className="msg-actions-row">
                  {getAvailableActionCards(user?.role, selectedConv).map((action) => (
                    <button
                      key={action}
                      type="button"
                      className="msg-action-chip"
                      disabled={creatingCard}
                      onClick={() => { openActionComposer(action); setActionChipsOpen(false); }}
                    >
                      {ACTION_CARD_LABELS[action]}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {actionCardsOnly ? (
              <div className="msg-policy-banner">
                <AlertTriangle size={16} />
                <span>Free-form chat is temporarily disabled. Action Cards are still available.</span>
              </div>
            ) : null}

            {actionComposerType ? (
              <form className="msg-action-composer" onSubmit={submitActionCard}>
                <div className="msg-action-composer-head">
                  <div>
                    <strong>{ACTION_CARD_LABELS[actionComposerType]}</strong>
                    <small>Fill the details and send a structured action card.</small>
                  </div>
                  <div className="msg-action-composer-head-actions">
                    <button type="button" className="msg-action-close" aria-label="Close action card form" onClick={closeActionComposer}><X size={16} /></button>
                  </div>
                </div>
                <div className="msg-action-composer-grid">
                  {(ACTION_CARD_FORM_FIELDS[actionComposerType] || []).map(renderActionComposerField)}
                </div>
                <div className="msg-action-composer-actions">
                  <button type="button" onClick={closeActionComposer}>Cancel</button>
                  <button type="submit" disabled={creatingCard}>{creatingCard ? 'Sending...' : 'Send Card'}</button>
                </div>
              </form>
            ) : null}

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
                accept="image/jpeg,image/png,image/gif,application/pdf,video/*"
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
                onChange={(e) => {
                  setNewMessage(e.target.value);
                  sendTypingSignal();
                }}
                placeholder={actionCardsOnly ? 'Use an Action Card to continue this thread' : 'Type a message...'}
                className="msg-input"
                disabled={actionCardsOnly}
              />
              <button type="submit" className="msg-send" disabled={actionCardsOnly || sending || uploadingFiles || (!newMessage.trim() && !selectedFiles.length)}>
                <Send size={18} />
              </button>
            </form>
          </div>
        ) : (
          <div className="msg-chat-panel msg-empty">
            <div className="msg-empty-inner">
              <div className="msg-empty-icon">
                <MessageSquare size={44} strokeWidth={1.6} />
              </div>
              <h3>Your Messages</h3>
              <p>{isBusiness ? 'Select a conversation to start messaging with brands and creators.' : 'Select a conversation to start messaging with brands.'}</p>
            </div>
            <div className="msg-empty-foot">
              <Lock size={13} /> <span>Your conversations are private and secured.</span>
            </div>
          </div>
        )}

        {selectedId && (dealInfo || sharedFiles.length || !isBusiness) ? (
          <aside className="msg-side" aria-label="Deal and shared files">
            {!isBusiness ? (
              <section className="msg-side-card cui-m-who">
                <h3>Brand</h3>
                <div className="cui-m-who-row">
                  <span className="cui-m-who-av" style={{ background: avatarColor(peerLabel(selectedConv)) }}>{getInitial(peerLabel(selectedConv))}</span>
                  <div>
                    <strong>{peerLabel(selectedConv)}</strong>
                    {selectedConv?.associated_deal_status ? <small>{selectedConv.associated_deal_status}</small> : null}
                  </div>
                </div>
              </section>
            ) : null}
            {dealInfo ? (
              <section className="msg-side-card">
                <h3>Deal</h3>
                {renderDealInfo()}
              </section>
            ) : null}
            {sharedFiles.length ? (
              <section className="msg-side-card">
                <h3>Shared in chat</h3>
                <div className="msg-shared-grid">
                  {sharedFiles.filter((u) => IMAGE_URL_RE.test(u)).map((u, i) => (
                    <a key={`${u}-${i}`} href={getAttachmentUrl(u)} target="_blank" rel="noreferrer" aria-label={getAttachmentName(u, i)}>
                      <img src={getAttachmentUrl(u)} alt="" loading="lazy" />
                    </a>
                  ))}
                </div>
                {sharedFiles.filter((u) => !IMAGE_URL_RE.test(u)).map((u, i) => (
                  <a key={`${u}-${i}`} className="msg-shared-file" href={getAttachmentUrl(u)} target="_blank" rel="noreferrer">
                    <FileText size={14} /><span>{getAttachmentName(u, i)}</span>
                  </a>
                ))}
              </section>
            ) : null}
            {!isBusiness ? (
              <p className="cui-m-safe"><ShieldCheck size={18} /> <span>Keep chats and payments on UGCad. You are only protected here.</span></p>
            ) : null}
          </aside>
        ) : null}

      </div>
      </Page>

      {briefTarget && (
        <PlanBrief
          creatorId={briefTarget}
          creatorName={creatorFirstName(selectedConv)}
          onClose={() => setBriefTarget(null)}
          onPublished={() => { setBriefTarget(null); fetchMessages(selectedId); }}
        />
      )}

      {/* The person on the other side of a creator↔brand thread is whichever role
          the viewer is NOT. When a creator opens "View profile" on a brand, show the
          brand card (rating, brand name, category) — not the creator layout. */}
      {profileOpen && selectedId && (
        selectedConv?.role === 'business' ? (
          <BrandProfileCard
            id={selectedId}
            fallbackName={nameOf(selectedConv)}
            onClose={() => setProfileOpen(false)}
            onMessage={() => setProfileOpen(false)}
            // A creator may review the brand only once the deal on this thread is
            // completed. The backend re-checks this; the flag just gates the button.
            canReview={user?.role === 'creator' && String(selectedConv?.associated_deal_status || '').toLowerCase() === 'completed'}
            reviewCampaignId={selectedConv?.associated_campaign_id}
            currentUserId={user?.id}
          />
        ) : (
          <CreatorProfileModal
            id={selectedId}
            fallbackName={nameOf(selectedConv)}
            onClose={() => setProfileOpen(false)}
            onMessage={() => setProfileOpen(false)}
          />
        )
      )}

      {report && (
        <div className="msg-report-overlay" onClick={() => !reportSubmitting && setReport(null)}>
          <form className="msg-report-modal" onClick={(e) => e.stopPropagation()} onSubmit={submitReport}>
            <div className="msg-report-head">
              <strong>Report {peerLabel(selectedConv)}</strong>
              <button type="button" aria-label="Close" onClick={() => setReport(null)}><X size={16} /></button>
            </div>
            <p className="msg-report-sub">Our team reviews every report within 5 business days. Don't include phone numbers or emails.</p>
            <label className="msg-report-label">Reason</label>
            <select
              className="msg-report-select"
              value={report.reason}
              onChange={(e) => setReport((r) => ({ ...r, reason: e.target.value }))}
            >
              <option value="">Select a reason…</option>
              <option value="spam">Spam or scam</option>
              <option value="harassment">Harassment or abuse</option>
              <option value="off_platform">Trying to move off-platform</option>
              <option value="payment_issue">Payment or fraud issue</option>
              <option value="inappropriate">Inappropriate content</option>
              <option value="other">Other</option>
            </select>
            <label className="msg-report-label">Details (optional)</label>
            <textarea
              className="msg-report-textarea"
              rows={4}
              placeholder="Add any context that will help our team…"
              value={report.details}
              onChange={(e) => setReport((r) => ({ ...r, details: e.target.value }))}
            />
            <div className="msg-report-actions">
              <button type="button" className="msg-report-cancel" onClick={() => setReport(null)} disabled={reportSubmitting}>Cancel</button>
              <button type="submit" className="msg-report-submit" disabled={reportSubmitting || !report.reason}>
                {reportSubmitting ? 'Submitting…' : 'Submit report'}
              </button>
            </div>
          </form>
        </div>
      )}
    </Shell>
  );
}
