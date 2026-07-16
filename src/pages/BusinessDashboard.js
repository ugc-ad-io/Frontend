import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { digitsOnly, blockNonDigitKey } from '../utils/inputValidators';
import { Plus, Briefcase, LogOut, MessageSquare, CheckCircle, Eye, Package, FileCheck, TrendingUp, Users, Search, Wallet, Lock, Activity, LayoutGrid, SquarePen, UserRoundSearch, ClipboardList, Settings, Bell, Clock3, FileText, ExternalLink, Download, AlertCircle, UserCheck, Filter, MapPin, Languages, Image as ImageIcon, Send, IndianRupee, Zap, Copy } from 'lucide-react';
import PostABrief from './PostABrief';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import RejectedGate from '../components/RejectedGate';
import MoreInfoGate from '../components/MoreInfoGate';
import ChatPopup from '../components/ChatPopup';
import PageModal from '../components/PageModal';
import CampaignDetails from './CampaignDetails';
import WorkReview from './WorkReview';
import ShipmentTracking from './ShipmentTracking';
import CreatorProfileModal from '../components/CreatorProfileModal';
import { payWithRazorpay, isPaymentCancelled } from '../utils/razorpay';
import '../styles/creator-marketplace.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const budgetColors = ['#5b6bff', '#9296ba', '#07074E', '#27AE60', '#F59E0B'];
const campaignPerformanceSample = [
  { month: 'Jan', deals_closed: 15, approved_deliveries: 12, applications_received: 40, spend_k: 30 },
  { month: 'Feb', deals_closed: 25, approved_deliveries: 20, applications_received: 60, spend_k: 45 },
  { month: 'Mar', deals_closed: 40, approved_deliveries: 35, applications_received: 85, spend_k: 65 },
  { month: 'Apr', deals_closed: 35, approved_deliveries: 30, applications_received: 75, spend_k: 55 },
  { month: 'May', deals_closed: 50, approved_deliveries: 45, applications_received: 110, spend_k: 80 }
];
const performancePeriods = ['Weekly', 'Monthly', 'Quarterly'];

const normalizePerformancePoint = (item = {}) => ({
  month: item.month || item.name || item.label,
  deals_closed: Number(item.deals_closed ?? item.deals ?? 0),
  approved_deliveries: Number(item.approved_deliveries ?? item.approved ?? 0),
  applications_received: Number(item.applications_received ?? item.apps ?? 0),
  spend_k: Number(item.spend_k ?? item.spend ?? 0)
});

const compactPerformanceByPeriod = (data, period) => {
  const points = data.map(normalizePerformancePoint);
  if (period === 'Weekly') {
    return points.slice(-5).map((item, index) => ({
      ...item,
      month: item.week || `Week ${index + 1}`
    }));
  }

  if (period === 'Quarterly') {
    const quarters = points.reduce((acc, item, index) => {
      const quarterIndex = Math.floor(index / 3);
      const key = `Q${quarterIndex + 1}`;
      const existing = acc[quarterIndex] || {
        month: key,
        deals_closed: 0,
        approved_deliveries: 0,
        applications_received: 0,
        spend_k: 0
      };
      existing.deals_closed += item.deals_closed;
      existing.approved_deliveries += item.approved_deliveries;
      existing.applications_received += item.applications_received;
      existing.spend_k = Number((existing.spend_k + item.spend_k).toFixed(2));
      acc[quarterIndex] = existing;
      return acc;
    }, []);

    return quarters.slice(-5);
  }

  return points.slice(-5);
};

const monthKey = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('en-US', { month: 'short' });
};

const campaignFundsAmount = (campaign = {}) => {
  const selectedBid = (campaign.bids || []).find((bid) => bid.creator_id === campaign.selected_creator);
  return Number(campaign.escrow_amount || campaign.held_amount || selectedBid?.amount || campaign.budget_max || campaign.budget_min || 0);
};

const campaignActivityDate = (campaign = {}) => (
  campaign.completed_at ||
  campaign.updated_at ||
  campaign.created_at
);

const buildCampaignPerformance = (campaign, baseData) => {
  if (!campaign) return baseData;

  const points = baseData.map(normalizePerformancePoint);
  const bids = campaign.bids || [];
  const activityMonth = monthKey(campaignActivityDate(campaign));
  const amountK = Number((campaignFundsAmount(campaign) / 1000).toFixed(2));
  const isCompleted = campaign.status === 'completed';
  const hasDelivery = ['completed', 'work_submitted', 'delivered'].includes(campaign.status);

  return points.map((point) => {
    const label = point.month;
    return {
      month: label,
      deals_closed: isCompleted && activityMonth === label ? 1 : 0,
      approved_deliveries: hasDelivery && activityMonth === label ? 1 : 0,
      applications_received: bids.filter((bid) => monthKey(bid.submitted_at || bid.created_at) === label).length,
      spend_k: amountK && activityMonth === label ? amountK : 0
    };
  });
};

const formatMoney = (value) => {
  const amount = Number(value || 0);
  return `Rs. ${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

// Show a single value when the budget is fixed (min === max), otherwise a range.
const formatBudget = (min, max) => {
  const lo = Number(min || 0);
  const hi = Number(max || 0);
  if (!hi || lo === hi) return formatMoney(lo || hi);
  if (!lo) return formatMoney(hi);
  return `${formatMoney(lo)} - ${formatMoney(hi)}`;
};

// Creator Bids review block for a single campaign — header + filter tabs + bid rows.
function BidsCampaignCard({ campaign, onAccept, onViewCampaign, onViewProfile }) {
  const bids = campaign.bids || [];
  const [tab, setTab] = useState('all');
  const [shortlist, setShortlist] = useState(() => new Set());
  // Seed from the persisted bid status so a decline survives a page refresh —
  // it used to be UI-only state that reset on reload, making declines "come back".
  const [declined, setDeclined] = useState(
    () => new Set(bids.filter((b) => b.status === 'declined').map((b) => b.id ?? b.creator_id))
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState('match'); // match | price-low | price-high | delivery-fast

  const idOf = (b) => b.id ?? b.creator_id;
  const hasResponded = (b) => !!(b.proposal && b.proposal.trim());

  const counts = {
    all: bids.filter(b => !declined.has(idOf(b))).length,
    shortlisted: bids.filter(b => shortlist.has(idOf(b))).length,
    responded: bids.filter(b => hasResponded(b) && !declined.has(idOf(b))).length,
    declined: bids.filter(b => declined.has(idOf(b))).length,
  };

  const TABS = [
    { id: 'all', label: 'All Bids' },
    { id: 'shortlisted', label: 'Shortlisted' },
    { id: 'responded', label: 'Responded' },
    { id: 'declined', label: 'Declined' },
  ];

  const visible = bids.filter(b => {
    const id = idOf(b);
    if (tab === 'shortlisted') return shortlist.has(id);
    if (tab === 'responded') return hasResponded(b) && !declined.has(id);
    if (tab === 'declined') return declined.has(id);
    return !declined.has(id);
  });

  const num = (v) => (v == null || v === '' ? null : Number(v));
  if (sort !== 'match') {
    visible.sort((a, b) => {
      if (sort === 'price-low' || sort === 'price-high') {
        const av = num(a.amount), bv = num(b.amount);
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return sort === 'price-low' ? av - bv : bv - av;
      }
      if (sort === 'delivery-fast') {
        const av = num(a.estimated_delivery_days), bv = num(b.estimated_delivery_days);
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        return av - bv;
      }
      return 0;
    });
  }

  const SORTS = [
    { id: 'match', label: 'Best match' },
    { id: 'price-low', label: 'Price: Low to High' },
    { id: 'price-high', label: 'Price: High to Low' },
    { id: 'delivery-fast', label: 'Fastest delivery' },
  ];

  const declineBid = async (id) => {
    // Optimistic: hide it immediately, then persist. Revert if the call fails so
    // the row doesn't silently reappear on the next refresh.
    setDeclined(prev => new Set(prev).add(id));
    try {
      await axios.post(`${API}/campaigns/${campaign.id}/bids/${encodeURIComponent(id)}/decline`);
      toast.success('Bid declined — the creator has been notified.');
    } catch (e) {
      setDeclined(prev => { const next = new Set(prev); next.delete(id); return next; });
      toast.error(apiErrorMessage(e, 'Could not decline this bid'));
    }
  };
  const toggleShortlist = (id) => setShortlist(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  // A raw 24-char hex string is a Mongo ObjectId, not a real handle — never show it.
  const isObjectId = (s) => /^[0-9a-f]{24}$/i.test(String(s || ''));
  const realName = (b) => {
    const n = b.creator_nickname || b.creator_name || b.public_creator_id || '';
    return isObjectId(n) ? '' : n;
  };
  const nameOf = (b) => realName(b) || 'Creator';
  const handleOf = (b) => { const n = String(realName(b)); return n ? (n.startsWith('@') ? n : `@${n}`) : 'Creator'; };
  const initialOf = (b) => (String(nameOf(b)).replace(/[^A-Za-z0-9]/g, '').charAt(0) || 'C').toUpperCase();

  return (
    <article className="cb-card">
      <div className="cb-campaign">
        <div className="cb-campaign-thumb">{(campaign.title || 'C').trim().charAt(0).toUpperCase()}</div>
        <div className="cb-campaign-info">
          <h3>{campaign.title || 'Untitled Campaign'}</h3>
          <p>Budget: {formatBudget(campaign.budget_min, campaign.budget_max)} • {bids.length} Application{bids.length === 1 ? '' : 's'}</p>
        </div>
        <button type="button" className="cb-view-campaign" onClick={() => onViewCampaign(campaign.id)}>View Campaign</button>
      </div>

      <div className="cb-tabs-row">
        <div className="cb-tabs">
          {TABS.map(t => (
            <button key={t.id} type="button" className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
              {t.label} ({counts[t.id]})
            </button>
          ))}
        </div>
        <div className="cb-filters-wrap">
          <button type="button" className={`cb-filters ${sort !== 'match' ? 'on' : ''}`} onClick={() => setFiltersOpen(o => !o)}>
            <Filter size={16} /> Filters{sort !== 'match' && <span className="cb-filters-dot" />}
          </button>
          {filtersOpen && (
            <>
              <div className="cb-filters-backdrop" onClick={() => setFiltersOpen(false)} />
              <div className="cb-filters-menu" role="menu">
                <span className="cb-filters-head">Sort bids by</span>
                {SORTS.map(s => (
                  <button
                    key={s.id}
                    type="button"
                    className={`cb-filters-opt ${sort === s.id ? 'sel' : ''}`}
                    onClick={() => { setSort(s.id); setFiltersOpen(false); }}
                  >
                    {s.label}
                    {sort === s.id && <CheckCircle size={15} />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="cb-bid-list">
        {visible.length === 0 ? (
          <div className="cb-empty">No bids in this view.</div>
        ) : visible.map((bid, idx) => {
          const id = idOf(bid);
          const isTop = idx === 0 && tab === 'all' && sort === 'match';
          const isShort = shortlist.has(id);
          return (
            <div key={id} className="cb-bid">
              <div className="cb-bid-avatar">{initialOf(bid)}</div>
              <div className="cb-bid-main">
                <div className="cb-bid-name">
                  <strong>{handleOf(bid)}</strong>
                  {isTop && <span className="cb-top-match">TOP MATCH</span>}
                </div>
                {(bid.category || campaign.category) && <span className="cb-bid-cat">{bid.category || campaign.category}</span>}
                <p className="cb-bid-pitch">{bid.proposal || 'No proposal message provided.'}</p>
              </div>
              <div className="cb-bid-stat">
                <strong>{formatMoney(bid.amount)}</strong>
                <span>Price / video</span>
              </div>
              <div className="cb-bid-stat">
                <strong>{bid.estimated_delivery_days ? `${bid.estimated_delivery_days} Days` : '—'}</strong>
                <span>Delivery</span>
              </div>
              <div className="cb-bid-actions">
                <button
                  type="button"
                  className={`cb-star ${isShort ? 'on' : ''}`}
                  aria-label={isShort ? 'Remove from shortlist' : 'Shortlist'}
                  title={isShort ? 'Shortlisted' : 'Add to shortlist'}
                  onClick={() => toggleShortlist(id)}
                >★</button>
                <button type="button" className="cb-view-profile" onClick={() => onViewProfile(campaign.id, bid)}>View Profile</button>
                {/* A declined bid can't be accepted/declined again — show its state. */}
                {declined.has(id) ? (
                  <span className="cb-declined-tag">Declined</span>
                ) : (<>
                  <button type="button" className="cb-accept" onClick={() => onAccept(campaign.id, bid.creator_id)}>Accept</button>
                  <button type="button" className="cb-decline" onClick={() => declineBid(id)}>Decline</button>
                </>)}
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
};

// Build the lifecycle steps for a campaign and mark which one it's currently on,
// so the brand can see at a glance what's been done and what's next.
function getCampaignStages(campaign) {
  const requiresShip = Boolean(campaign.requires_shipment || campaign.shipment_option === 'yes');
  const stages = [{ key: 'live', label: 'Live' }, { key: 'selected', label: 'Creator' }];
  if (requiresShip) stages.push({ key: 'shipped', label: 'Shipped' });
  stages.push({ key: 'submitted', label: 'Submitted' });
  stages.push({ key: 'completed', label: 'Done' });

  const status = campaign.status;
  let current = 0;
  if (status === 'active') current = 0;
  if (campaign.selected_creator) current = stages.findIndex((s) => s.key === 'selected');
  if (status === 'work_submitted') current = stages.findIndex((s) => s.key === 'submitted');
  if (status === 'completed') current = stages.length - 1;
  return { stages, current: Math.max(0, current) };
}

function getNextActionHint(campaign) {
  const status = campaign.status;
  if (status === 'draft') return 'Draft — finish and publish this brief.';
  if (status === 'pending_approval') return 'Awaiting admin approval.';
  if (status === 'completed') return 'Completed — creator payout processed.';
  if (status === 'work_submitted') return 'Action needed: review the submitted work.';
  if (campaign.selected_creator) {
    return (campaign.requires_shipment || campaign.shipment_option === 'yes')
      ? 'Creator selected — ship the product, then await delivery.'
      : 'Creator selected — awaiting content delivery.';
  }
  if (status === 'active') return `Live — ${campaign.bids?.length || 0} bid(s) received. Select a creator.`;
  return 'In progress.';
}

const stageTone = (stage) => {
  if (['awaiting_review', 'revision_requested'].includes(stage)) return 'warning';
  if (['completed', 'delivered'].includes(stage)) return 'success';
  return 'info';
};

const actionTarget = (url) => {
  if (!url) return null;
  if (url.startsWith('/campaigns/')) return url.replace('/campaigns/', '/campaign/');
  if (url.startsWith('/shipment/')) return `/shipment?campaign=${url.split('/').pop()}`;
  return url;
};

const emptyPerformanceMonths = () => {
  return campaignPerformanceSample;
};

const creatorDirectoryDefaults = {
  category: '',
  language: '',
  region: '',
  style: '',
  budget: '',
};

const creatorDirectoryOptions = {
  categories: ['Beauty', 'Fashion', 'Lifestyle', 'Tech', 'Food', 'Fitness', 'Home Decor'],
  languages: ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Marathi'],
  regions: ['Metro', 'Tier-2'],
  styles: ['Product demo', 'Unboxing', 'Testimonial', 'Storytelling', 'Lifestyle reel'],
  budgets: ['Under Rs. 5,000', 'Rs. 5,000 - Rs. 10,000', 'Rs. 10,000 - Rs. 25,000', 'Rs. 25,000+'],
};

const creatorDirectorySorts = [
  { value: 'recent', label: 'Recently joined' },
  { value: 'active', label: 'Most active' },
  { value: 'best_match', label: 'Best match for your brand' },
];

const emptyInviteForm = {
  campaign_id: '',
  campaign_name: '',
  deliverable_summary: '',
  budget: '',
  timeline: '',
  usage_rights: '30 days paid social usage',
  message: '',
};

const walletPresetAmounts = [10000, 25000, 50000];

function normalizeCreatorDirectoryItem(item = {}) {
  const profile = item.profile || {};
  const tags = item.tags || profile.tags || [];
  const portfolio = item.portfolio || profile.portfolio || [];
  const languages = item.languages || profile.languages || item.content_languages || [];
  const cityTier = item.city_tier || profile.city_tier || item.location_region || 'Curated';
  const publicCreatorId = item.public_creator_id || item.creator_public_id || '';
  const handle = item.handle || (item.nickname ? `@${String(item.nickname).replace(/^@/, '')}` : '@creator');

  return {
    id: item.id || item.creator_id,
    publicCreatorId,
    handle,
    displayId: publicCreatorId || handle,
    avatar: item.profile_photo || item.profile_picture || profile.profile_picture || profile.avatar_url || '',
    category: item.primary_category || profile.primary_category || tags[0] || 'Creator',
    languages: Array.isArray(languages) ? languages : [languages].filter(Boolean),
    cityTier,
    deliverablesCompleted: Number(item.deliverables_completed || item.completed_deliverables || item.completed_campaigns || 0),
    portfolioPreview: pickPreviewUrl(item.portfolio_preview, item.top_portfolio_sample, portfolio[0]),
    style: item.content_style || profile.content_style || '',
    budgetRange: item.budget_range || profile.budget_range || '',
  };
}

function getAssetUrl(url) {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  const baseUrl = BACKEND_URL || window.location.origin;
  return `${baseUrl.replace(/\/$/, '')}/${String(url).replace(/^\//, '')}`;
}

function isVideoAsset(url) {
  return /\.(mp4|webm|mov|m4v)$/i.test(String(url || '').split('?')[0]);
}

// A portfolio preview can arrive as a plain URL or a rich item ({urls:[...]}, {url}, ...).
// Pull out the first usable media URL; ignore dead blob:/filename refs.
function pickPreviewUrl(...candidates) {
  const usable = (u) => typeof u === 'string' && (/^https?:\/\//i.test(u) || u.startsWith('/'));
  for (const c of candidates) {
    if (usable(c)) return c;
    if (c && typeof c === 'object') {
      if (Array.isArray(c.urls)) {
        const hit = c.urls.find(usable);
        if (hit) return hit;
      }
      for (const k of ['thumbnail_url', 'url', 'video_url', 'videoUrl', 'link', 'image', 'video']) {
        if (usable(c[k])) return c[k];
      }
    }
  }
  return '';
}

function formatWalletDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
}

function normalizeWalletData(data = {}) {
  return {
    available_balance: Number(data.available_balance || 0),
    minimum_chat_balance: Number(data.minimum_chat_balance || 5000),
    chat_unlocked: Boolean(data.chat_unlocked),
    plan_name: data.plan_name || 'Brand Starter',
    recharge_bonus: data.recharge_bonus || {},
    bonus_tiers: data.bonus_tiers || [],
    transactions: data.transactions || [],
  };
}

export default function BusinessDashboard({ page = 'overview' }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [activeCampaigns, setActiveCampaigns] = useState([]);
  const [pendingCampaigns, setPendingCampaigns] = useState([]);
  const [completedCampaigns, setCompletedCampaigns] = useState([]);
  const [workSubmissions, setWorkSubmissions] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatorDirectory, setCreatorDirectory] = useState([]);
  const [creatorDirectoryLoading, setCreatorDirectoryLoading] = useState(false);
  const [creatorDirectoryError, setCreatorDirectoryError] = useState('');
  const [creatorFilters, setCreatorFilters] = useState(creatorDirectoryDefaults);
  const [creatorSort, setCreatorSort] = useState('best_match');
  const [selectedCreatorProfile, setSelectedCreatorProfile] = useState(null);
  const [chatWith, setChatWith] = useState(null); // opens the in-page chat popup
  const [modalView, setModalView] = useState(null); // { type: 'campaign'|'review'|'shipment', id } -> opens a page in a modal
  const [bidCampaignId, setBidCampaignId] = useState(null); // Creator Bids: which campaign's bids are shown
  const [profileView, setProfileView] = useState(null); // { id, name, photo } -> opens a creator profile modal
  const [shipmentsMap, setShipmentsMap] = useState({}); // campaignId -> shipment record (for the shipments table)
  const [shipTab, setShipTab] = useState('all'); // all | transit | delivered
  const [selectedCreatorInvite, setSelectedCreatorInvite] = useState(null);
  const [inviteForm, setInviteForm] = useState(emptyInviteForm);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [walletData, setWalletData] = useState(normalizeWalletData());
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState('');
  const walletLoadedRef = useRef(false); // true once the wallet has loaded at least once
  const [walletAmount, setWalletAmount] = useState('');
  const [walletFilter, setWalletFilter] = useState('all');
  const [rechargingWallet, setRechargingWallet] = useState(false);
  const [performancePeriod, setPerformancePeriod] = useState('Monthly');
  const [performanceCampaignId, setPerformanceCampaignId] = useState('all');
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState('');
  const [dashboardSearchOpen, setDashboardSearchOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    objectives: [],
    budget_min: '',
    budget_max: '',
    brief_text: '',
    requires_shipment: false,
    shipment_option: 'no',
    image_url: ''
  });
  const [campaignImgUploading, setCampaignImgUploading] = useState(false);

  const handleCampaignImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Image too large. Max 5MB.'); return; }
    setCampaignImgUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await axios.post(`${API}/upload/file`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      handleInputChange('image_url', data.file_url || data.url || '');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not upload image'));
    } finally {
      setCampaignImgUploading(false);
    }
  };
  const [objectiveInput, setObjectiveInput] = useState('');

  useEffect(() => {
    if (user?.approval_status === 'approved') {
      fetchCampaigns();
    }
  }, [user?.id]);

  // Preload the creator directory as soon as the dashboard mounts (not only when the
  // Browse Creators tab is open) and refetch only when filters/sort change — NOT on every
  // tab navigation. This keeps the already-loaded list in state so switching to the tab is
  // instant instead of firing a fresh (slow) request and flashing a spinner each time.
  useEffect(() => {
    if (user?.approval_status === 'approved') {
      fetchCreatorDirectory();
    }
  }, [user?.id, creatorFilters, creatorSort]);

  useEffect(() => {
    // Preload the wallet on mount so it's ready before the tab is opened, and refresh
    // it whenever the Wallet tab is entered (silently — no loading flash after first load).
    if (user?.approval_status === 'approved' && (page === 'wallet' || !walletLoadedRef.current)) {
      fetchWallet();
    }
  }, [user?.id, page]);

  const fetchCampaigns = async () => {
    try {
      const [response, dashboardRes, draftsRes] = await Promise.all([
        axios.get(`${API}/campaigns`),
        axios.get(`${API}/business/dashboard`),
        axios.get(`${API}/campaigns?status=draft`).catch(() => ({ data: [] }))
      ]);
      const allCampaigns = response.data;

      // Filter to only show this business's campaigns
      const realCampaigns = allCampaigns.filter(c => c.business_id === user.id);
      const myCampaigns = realCampaigns;
      setCampaigns(myCampaigns);

      setDashboardData(dashboardRes.data?.metrics ? dashboardRes.data : (dashboardRes.data || null));
      setDrafts((draftsRes.data || []).filter(c => c.business_id === user.id));

      // Get work submissions for campaigns with work_submitted status
      const workSubmittedCampaigns = myCampaigns.filter(c => c.status === 'work_submitted');
      if (workSubmittedCampaigns.length > 0) {
        const workRes = await axios.get(`${API}/work/pending-review`);
        setWorkSubmissions(workRes.data || []);
      } else {
        setWorkSubmissions([]);
      }

      // Categorize campaigns
      setActiveCampaigns(myCampaigns.filter(c => c.status === 'active' || c.status === 'in_progress'));
      setPendingCampaigns(myCampaigns.filter(c => c.status === 'pending_approval'));
      setCompletedCampaigns(myCampaigns.filter(c => c.status === 'completed'));
    } catch (error) {
      console.error('Failed to load campaigns:', error);
      setCampaigns([]);
      setDashboardData(null);
      setWorkSubmissions([]);
      setActiveCampaigns([]);
      setCompletedCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const addObjective = () => {
    if (objectiveInput.trim() && !formData.objectives.includes(objectiveInput.trim())) {
      setFormData(prev => ({
        ...prev,
        objectives: [...prev.objectives, objectiveInput.trim()]
      }));
      setObjectiveInput('');
    }
  };

  const removeObjective = (obj) => {
    setFormData(prev => ({
      ...prev,
      objectives: prev.objectives.filter(o => o !== obj)
    }));
  };

  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    
    if (formData.objectives.length === 0) {
      toast.error('Please add at least one objective');
      return;
    }

    try {
      await axios.post(`${API}/campaigns`, {
        ...formData,
        budget_min: parseFloat(formData.budget_min),
        budget_max: parseFloat(formData.budget_max),
        requires_shipment: formData.shipment_option === 'yes'
      });
      toast.success('Campaign published — creators can see it now!');
      setShowCreateModal(false);
      setFormData({
        title: '',
        objectives: [],
        budget_min: '',
        budget_max: '',
        brief_text: '',
        requires_shipment: false,
        shipment_option: 'no',
        image_url: ''
      });
      fetchCampaigns();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to create campaign'));
    }
  };

  // Duplicate a brief: pre-fill the create form with the source's details and
  // open it, so the brand can tweak anything before publishing the copy.
  const duplicateCampaign = (campaign) => {
    setFormData({
      title: `${campaign.title || 'Campaign'} (Copy)`,
      category: campaign.category || campaign.product_category || '',
      objectives: Array.isArray(campaign.objectives) ? [...campaign.objectives] : [],
      budget_min: campaign.budget_min != null ? String(campaign.budget_min) : '',
      budget_max: campaign.budget_max != null ? String(campaign.budget_max) : '',
      brief_text: campaign.brief_text || '',
      requires_shipment: Boolean(campaign.requires_shipment),
      shipment_option: campaign.requires_shipment ? 'yes' : 'no',
    });
    setShowCreateModal(true);
    toast.info('Editing a copy — review the details and publish when ready.');
  };

  const fetchCreatorDirectory = async () => {
    setCreatorDirectoryLoading(true);
    setCreatorDirectoryError('');
    try {
      const params = {
        sort: creatorSort,
        ...Object.fromEntries(
          Object.entries(creatorFilters).filter(([, value]) => Boolean(value))
        )
      };
      const response = await axios.get(`${API}/business/creator-directory`, { params });
      const items = Array.isArray(response.data) ? response.data : response.data?.creators || [];
      setCreatorDirectory(items.map(normalizeCreatorDirectoryItem));
    } catch (error) {
      setCreatorDirectory([]);
      setCreatorDirectoryError('');
    } finally {
      setCreatorDirectoryLoading(false);
    }
  };

  const handleCreatorFilterChange = (field, value) => {
    setCreatorFilters(prev => ({ ...prev, [field]: value }));
  };

  const handleInviteCreator = (creator) => {
    setSelectedCreatorInvite(creator);
    setInviteForm({
      ...emptyInviteForm,
      campaign_name: campaigns[0]?.title || '',
      budget: campaigns[0] ? formatMoney(campaigns[0].budget_max || campaigns[0].budget_min || 0) : creator.budgetRange || '',
      message: `Hi ${creator.displayId || creator.handle}, we think your content style could be a strong fit for our brand.`,
    });
  };

  const handleInviteCampaignChange = (campaignId) => {
    const campaign = campaigns.find(item => item.id === campaignId);
    setInviteForm(prev => ({
      ...prev,
      campaign_id: campaignId,
      campaign_name: campaign?.title || prev.campaign_name,
      budget: campaign ? formatMoney(campaign.budget_max || campaign.budget_min || 0) : prev.budget,
      deliverable_summary: campaign?.deliverables || campaign?.brief_text?.slice(0, 120) || prev.deliverable_summary,
    }));
  };

  const handleInviteFieldChange = (field, value) => {
    setInviteForm(prev => ({ ...prev, [field]: value }));
  };

  const closeInviteModal = () => {
    setSelectedCreatorInvite(null);
    setInviteForm(emptyInviteForm);
    setSendingInvite(false);
  };

  const handleSubmitCreatorInvite = async (event) => {
    event.preventDefault();
    if (!selectedCreatorInvite?.id) return;

    const payload = {
      campaign_id: inviteForm.campaign_id || null,
      campaign_name: inviteForm.campaign_name.trim(),
      deliverable_summary: inviteForm.deliverable_summary.trim(),
      budget: inviteForm.budget.trim(),
      timeline: inviteForm.timeline.trim(),
      usage_rights: inviteForm.usage_rights.trim(),
      message: inviteForm.message.trim(),
    };

    setSendingInvite(true);
    try {
      const creatorId = selectedCreatorInvite.id;
      await axios.post(`${API}/business/creator-directory/${creatorId}/invite`, payload);
      toast.success(`Invitation sent to ${selectedCreatorInvite.handle}`);
      closeInviteModal();
      setSelectedCreatorProfile(null);
      // Open the full Messages UI where the invitation card is rendered.
      navigate(`/messages?conv=${creatorId}`);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to send invitation'));
    } finally {
      setSendingInvite(false);
    }
  };

  const fetchWallet = async () => {
    // Only show the "Loading…" state on the very first load — later refreshes are
    // silent so switching to the Wallet tab is instant (shows the cached balance).
    if (!walletLoadedRef.current) setWalletLoading(true);
    setWalletError('');
    try {
      const response = await axios.get(`${API}/business/wallet`);
      setWalletData(normalizeWalletData(response.data || {}));
      walletLoadedRef.current = true;
    } catch (error) {
      if (!walletLoadedRef.current) setWalletData(normalizeWalletData({}));
      setWalletError('');
    } finally {
      setWalletLoading(false);
    }
  };

  const handleWalletRecharge = async (amountOverride) => {
    const amount = Number(amountOverride || walletAmount);
    const minRecharge = Number(walletData?.minimum_chat_balance) || 2500;
    if (!amount || amount < minRecharge) {
      toast.error(`Minimum recharge amount is ${formatMoney(minRecharge)}`);
      return;
    }
    setRechargingWallet(true);
    try {
      // 1) Backend creates the Razorpay order. 2) Open Razorpay checkout.
      // 3) On success the helper verifies server-side, which credits the wallet.
      const { data: order } = await axios.post(`${API}/business/wallet/recharge`, { amount, gateway: 'razorpay' });
      const result = await payWithRazorpay(order, {
        name: user?.nickname || user?.full_name,
        email: user?.email,
        contact: user?.phone,
        description: `Wallet recharge — ${formatMoney(order.amount)}`,
      });
      toast.success(result?.message || 'Payment successful — wallet credited.');
      setWalletAmount('');
      await fetchWallet();
    } catch (error) {
      if (isPaymentCancelled(error)) toast.message('Payment cancelled.');
      else toast.error(apiErrorMessage(error, 'Wallet recharge failed'));
    } finally {
      setRechargingWallet(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleViewCampaign = (campaignId) => {
    navigate(`/campaign/${campaignId}`);
  };

  // Accept a bid = select that creator for the campaign. This SPENDS the brand's
  // credits: the bid amount plus the platform fee leaves the wallet and is held in
  // the deal's escrow until the content is approved.
  const handleAcceptBid = async (campaignId, creatorId) => {
    if (!creatorId) { toast.error('Could not identify the creator for this bid.'); return; }
    try {
      const res = await axios.post(`${API}/campaigns/${campaignId}/select-creator?creator_id=${creatorId}`);
      const charged = Number(res.data?.amount_charged) || 0;
      toast.success(
        `🎉 ${res.data?.creator_nickname || 'Creator'} selected! ${charged ? `${formatMoney(charged)} held in escrow.` : 'Payment held in escrow.'}`
      );
      fetchCampaigns();
      fetchWallet();
    } catch (error) {
      // Short balance is a fixable problem, not a generic failure — say by how much.
      if (error?.response?.status === 402) {
        const d = error.response.data || {};
        toast.error(d.detail || 'Not enough credits to select this creator.');
        fetchWallet();
        return;
      }
      toast.error(apiErrorMessage(error, 'Failed to accept bid'));
    }
  };

  // Calculate stats
  const totalSpent = completedCampaigns.reduce((sum, c) => sum + (c.budget_max || 0), 0);
  const totalBidsReceived = campaigns.reduce((sum, c) => sum + (c.bids?.length || 0), 0);
  const businessTabs = [
    { id: 'overview', label: 'Brand Dashboard', icon: LayoutGrid, path: '/dashboard/business' },
    { id: 'post-brief', label: 'Post a Campaign', icon: SquarePen, path: '/dashboard/business/post-brief' },
    { id: 'pending-bids', label: 'Creator Bids', icon: UserRoundSearch, path: '/dashboard/business/pending-bids', badge: totalBidsReceived || 3, badgeTone: 'orange' },
    { id: 'browse-creator', label: 'Browse Creator', icon: Search, path: '/dashboard/business/browse-creator' },
    { id: 'all-campaigns', label: `All Campaigns (${campaigns.length})`, icon: ClipboardList, path: '/dashboard/business/all-campaigns' },
    { id: 'work-review', label: 'Work Review', icon: FileCheck, path: '/dashboard/business/work-review' },
    { id: 'messages', label: 'Messages', icon: MessageSquare, path: '/messages' },
    { id: 'shipments', label: 'Manage Shipment', icon: Package, path: '/dashboard/business/shipments' },
    { id: 'wallet', label: 'Wallet', icon: Wallet, path: '/dashboard/business/wallet' },
    { id: 'settings', label: 'Settings', icon: Settings, path: '/settings' }
  ];
  const activeTab = businessTabs.some(tab => tab.id === page) ? page : 'overview';

  // Preload each shipment record (courier / tracking / status / ETA) as soon as the
  // campaigns are known — NOT on every tab switch — so opening the Shipments tab is instant.
  useEffect(() => {
    const shipCampaigns = campaigns.filter((c) => c.requires_shipment || c.shipment_option === 'yes');
    if (shipCampaigns.length === 0) return undefined;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(shipCampaigns.map(async (c) => {
        try { const r = await axios.get(`${API}/shipment/${c.id}`); return [c.id, r.data]; }
        catch { return [c.id, null]; }
      }));
      if (!cancelled) setShipmentsMap(Object.fromEntries(entries));
    })();
    return () => { cancelled = true; };
  }, [campaigns]);
  const pageTitle = businessTabs.find(tab => tab.id === activeTab)?.label.replace(/\s\(\d+\)$/, '') || 'Business Dashboard';
  const pageDescription = {
    overview: `Welcome back, ${user?.nickname}!`,
    'post-brief': 'Create a new campaign and attract top creators',
    'pending-bids': 'Review creator proposals and select the best fit for each campaign',
    'browse-creator': 'Discover vetted creators and send private invitations',
    'all-campaigns': 'Track every brief from draft to delivery',
    'work-review': 'Review submitted creator work and approve deliverables',
    shipments: 'Manage product shipments and creator selection for delivery campaigns',
    wallet: 'Track balance, add funds, and review wallet activity',
    settings: 'Manage brand preferences, profile, billing, and notifications'
  }[activeTab] || `Welcome back, ${user?.nickname}!`;
  const dashboardMetrics = dashboardData?.metrics || {};
  const dashboardPerformanceRaw = (dashboardData?.campaign_performance || []).length
    ? dashboardData.campaign_performance
    : emptyPerformanceMonths();
  const dashboardPerformanceBase = dashboardPerformanceRaw
    .map(normalizePerformancePoint)
    .some(item => item.deals_closed || item.approved_deliveries || item.applications_received || item.spend_k)
    ? dashboardPerformanceRaw
    : campaignPerformanceSample;
  const selectedPerformanceCampaign = campaigns.find(campaign => campaign.id === performanceCampaignId);
  const campaignPerformanceFromApi = performanceCampaignId !== 'all'
    ? dashboardData?.campaign_performance_by_campaign?.[performanceCampaignId]
    : null;
  const performanceBase = performanceCampaignId === 'all'
    ? dashboardPerformanceBase
    : (campaignPerformanceFromApi?.length ? campaignPerformanceFromApi : buildCampaignPerformance(selectedPerformanceCampaign, dashboardPerformanceBase));
  const dashboardPerformance = compactPerformanceByPeriod(performanceBase, performancePeriod);
  const dashboardFunnel = dashboardData?.creator_funnel || {};
  const liveCampaignsCount = Number(dashboardMetrics.live_campaigns ?? dashboardData?.live_campaigns ?? dashboardFunnel.live ?? activeCampaigns.length ?? 0);
  const funnelStages = [
    { key: 'viewed_brief', label: 'Viewed', className: 'applied' },
    { key: 'applied', label: 'Applied', className: 'shortlisted' },
    { key: 'accepted', label: 'Accepted', className: 'accepted' },
    { key: 'live', label: 'Live', className: 'live' }
  ];
  const dashboardTopCampaigns = dashboardData?.top_campaigns || [];
  const dashboardActiveDeals = dashboardData?.active_deals || [];
  const dashboardPendingActions = dashboardData?.pending_actions || [];
  const dashboardBudget = dashboardData?.budget_usage || { used: 0, total: 0, categories: [] };
  const dashboardSearchTerm = dashboardSearchQuery.trim().toLowerCase();
  const dashboardItemMatches = (...values) => {
    if (!dashboardSearchTerm) return true;
    return values
      .filter(value => value !== null && value !== undefined)
      .join(' ')
      .toLowerCase()
      .includes(dashboardSearchTerm);
  };
  const dashboardSearchResults = useMemo(() => {
    if (!dashboardSearchTerm) return [];

    const matches = (...values) => values
      .filter(value => value !== null && value !== undefined)
      .join(' ')
      .toLowerCase()
      .includes(dashboardSearchTerm);
    const results = [];
    const campaignEntries = new Map();

    campaigns.forEach(campaign => {
      campaignEntries.set(campaign.id || campaign.title, campaign);
    });
    dashboardTopCampaigns.forEach(campaign => {
      const key = campaign.id || campaign.title;
      if (!campaignEntries.has(key)) campaignEntries.set(key, campaign);
    });

    campaignEntries.forEach(campaign => {
      if (matches(campaign.title, campaign.brief_text, campaign.status, campaign.deliverables, campaign.category)) {
        results.push({
          key: `campaign-${campaign.id || campaign.title}`,
          type: 'Campaign',
          title: campaign.title || 'Untitled Campaign',
          meta: `${String(campaign.status || 'draft').replace(/_/g, ' ')} • ${(campaign.bids || []).length || campaign.applications || 0} bids`,
          target: campaign.id ? `/campaign/${campaign.id}` : '/dashboard/business/all-campaigns'
        });
      }
    });

    const creatorEntries = new Map();
    campaigns.forEach(campaign => {
      (campaign.bids || []).forEach(bid => {
        const creatorName = bid.creator_nickname || bid.creator_name || bid.creator_id;
        if (creatorName) {
          creatorEntries.set(bid.creator_id || creatorName, {
            id: bid.creator_id,
            name: creatorName,
            meta: `Bid on ${campaign.title || 'campaign'}`,
            target: bid.creator_id ? `/chat/${bid.creator_id}` : '/dashboard/business/pending-bids'
          });
        }
      });
    });
    dashboardActiveDeals.forEach(deal => {
      const creatorName = deal.creator_nickname || deal.creator_name || deal.creator_id;
      if (creatorName) {
        creatorEntries.set(deal.creator_id || creatorName, {
          id: deal.creator_id,
          name: creatorName,
          meta: `Active deal: ${deal.campaign_title || 'campaign'}`,
          target: deal.creator_id ? `/chat/${deal.creator_id}` : '/dashboard/business'
        });
      }
    });
    workSubmissions.forEach(work => {
      const creatorName = work.creator_nickname || work.creator_name || work.creator_id;
      if (creatorName) {
        creatorEntries.set(work.creator_id || creatorName, {
          id: work.creator_id,
          name: creatorName,
          meta: `Work review: ${work.campaign_title || 'campaign'}`,
          target: '/dashboard/business/work-review'
        });
      }
    });
    creatorEntries.forEach(creator => {
      if (matches(creator.name, creator.id, creator.meta)) {
        results.push({
          key: `creator-local-${creator.id || creator.name}`,
          type: 'Creator',
          title: String(creator.name).replace(/^@/, '@'),
          meta: creator.meta,
          target: creator.target
        });
      }
    });

    dashboardActiveDeals.forEach(deal => {
      if (matches(deal.campaign_title, deal.creator_nickname, deal.creator_name, deal.stage, deal.stage_label, deal.next_action_label)) {
        results.push({
          key: `deal-${deal.campaign_id || deal.campaign_title}`,
          type: 'Deal',
          title: deal.campaign_title || 'Untitled deal',
          meta: `${deal.creator_nickname ? `@${String(deal.creator_nickname).replace(/^@/, '')}` : 'Creator pending'} • ${deal.stage_label || deal.stage || 'Active'}`,
          target: deal.campaign_id ? `/campaign/${deal.campaign_id}` : '/dashboard/business'
        });
      }
    });

    dashboardPendingActions.forEach(action => {
      const target = actionTarget(action.target_url) || '/dashboard/business';
      if (matches(action.label, action.type, action.count)) {
        results.push({
          key: `action-${action.type || action.label}`,
          type: 'Action',
          title: action.label || 'Pending action',
          meta: Number(action.count || 0) > 0 ? `${action.count} waiting` : 'Open action',
          target
        });
      }
    });

    workSubmissions.forEach(work => {
      if (matches(work.campaign_title, work.creator_nickname, work.creator_name, work.creator_id, work.status)) {
        results.push({
          key: `work-${work.id || work.campaign_id || work.creator_id}`,
          type: 'Work Review',
          title: work.campaign_title || 'Submitted work',
          meta: work.creator_nickname || work.creator_name || work.creator_id || 'Creator',
          target: '/dashboard/business/work-review'
        });
      }
    });

    creatorDirectory.forEach(creator => {
      if (matches(creator.displayId, creator.publicCreatorId, creator.handle, creator.category, creator.style, creator.budgetRange, creator.cityTier, ...(creator.languages || []))) {
        results.push({
          key: `creator-${creator.id || creator.displayId}`,
          type: 'Creator',
          title: creator.displayId || creator.handle || 'Creator',
          meta: [creator.category, creator.cityTier].filter(Boolean).join(' • '),
          target: '/dashboard/business/browse-creator'
        });
      }
    });

    return results.slice(0, 8);
  }, [dashboardSearchTerm, campaigns, dashboardTopCampaigns, dashboardActiveDeals, dashboardPendingActions, workSubmissions, creatorDirectory]);
  const filteredDashboardTopCampaigns = dashboardTopCampaigns.filter(campaign => (
    dashboardItemMatches(campaign.title, campaign.status, campaign.applications, campaign.spend)
  ));
  const filteredDashboardActiveDeals = dashboardActiveDeals.filter(deal => (
    dashboardItemMatches(deal.campaign_title, deal.creator_nickname, deal.creator_name, deal.stage, deal.stage_label, deal.next_action_label)
  ));
  const filteredDashboardPendingActions = dashboardPendingActions.filter(action => (
    dashboardItemMatches(action.label, action.type, action.count)
  ));
  const filteredCampaigns = campaigns.filter(campaign => {
    return dashboardItemMatches(campaign.title, campaign.brief_text, campaign.category, campaign.status, campaign.deliverables);
  });
  const walletTransactions = walletData.transactions.filter((transaction) => {
    if (walletFilter === 'credits') return transaction.direction === 'credit';
    if (walletFilter === 'debits') return transaction.direction === 'debit';
    return true;
  });
  const walletBonusTiers = walletData.bonus_tiers || [];
  const walletBonus = walletData.recharge_bonus || {};
  const performanceLeftMax = 120;
  const performanceRightMax = 80;
  const chartTop = 28;
  const chartBottom = 252;
  const chartHeight = chartBottom - chartTop;
  const chartXs = dashboardPerformance.map((_, index) => 70 + (index * 500) / Math.max(1, dashboardPerformance.length - 1));
  const chartYLeft = (value) => chartBottom - (Math.min(Number(value || 0), performanceLeftMax) / performanceLeftMax) * chartHeight;
  const chartYRight = (value) => chartBottom - (Math.min(Number(value || 0), performanceRightMax) / performanceRightMax) * chartHeight;
  const maxFunnelValue = Math.max(
    1,
    Number(dashboardFunnel.viewed_brief || 0),
    Number(dashboardFunnel.applied || 0),
    Number(dashboardFunnel.accepted || 0),
    Number(dashboardFunnel.live || 0)
  );
  const funnelHeight = (value) => Math.max(14, (Number(value || 0) / maxFunnelValue) * 205);
  const hasDashboardSearchQuery = dashboardSearchQuery.trim().length > 0;

  const handleDashboardSearchSelect = (target) => {
    if (!target) return;
    setDashboardSearchOpen(false);
    setDashboardSearchQuery('');
    navigate(target);
  };

  const handleDashboardSearchSubmit = (event) => {
    event.preventDefault();
    if (dashboardSearchResults[0]) {
      handleDashboardSearchSelect(dashboardSearchResults[0].target);
    }
  };

  if (user?.approval_status === 'pending') {
    return (
      <div className="bd-status-page">
        <section className="bd-status-card">
          <CheckCircle size={68} />
          <p className="bd-eyebrow">Business verification</p>
          <h1>Profile Under Review</h1>
          <p>Your business profile is being verified by our team. Most accounts are approved within 24-48 hours, and we'll notify you via email once you're cleared to launch campaigns.</p>
          <button type="button" onClick={handleLogout} data-testid="home-btn">Back to Home</button>
        </section>

        <style>{`
          .bd-status-page {
            min-height: 100vh;
            display: grid;
            place-items: center;
            padding: 24px;
            background: #0a0a0f;
          }

          .bd-status-card {
            width: min(680px, 100%);
            padding: 52px;
            border-radius: 24px;
            background: #141420;
            color: #f4f4f8;
            text-align: center;
            border: 1px solid rgba(255, 255, 255, 0.06);
            box-shadow: 0 16px 54px rgba(0, 0, 0, 0.55);
          }

          .bd-status-card :global(svg) {
            color: #f4f4f8;
          }

          .bd-eyebrow {
            margin: 18px 0 8px;
            color: #9a9ad6;
            font-size: 12px;
            font-weight: 400;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          .bd-status-card h1 {
            margin: 0 0 12px;
            font-size: var(--fs-h1);
            color: #f4f4f8;
          }

          .bd-status-card p:not(.bd-eyebrow) {
            margin: 0 auto 28px;
            max-width: 460px;
            color: #9b9bb0;
            line-height: 1.6;
          }

          .bd-status-card button {
            border: 0;
            border-radius: 12px;
            padding: 13px 22px;
            background: #f4f4f8;
            color: #0a0a0f;
            font-weight: 600;
            cursor: pointer;
          }

          @media (max-width: 600px) {
            .bd-status-card {
              padding: 24px;
              border-radius: 18px;
            }
          }
        `}</style>
      </div>
    );
  }

  if (user?.approval_status === 'rejected') {
    return <RejectedGate user={user} onHome={handleLogout} kind="business" />;
  }

  // An admin asking for more info used to fall through every gate here and render
  // the normal dashboard — with all its data fetches skipped (they require
  // 'approved'), so the brand saw an empty dashboard and no explanation.
  if (user?.approval_status === 'more_info') {
    return <MoreInfoGate user={user} kind="business" onLogout={handleLogout} />;
  }

  return (
    <BrandTopNavLayout>
      <main className="business-main bd-topnav-main">
        {activeTab !== 'overview' && (
          <div className="brand-page-title bd-topnav-title">
            <h1>{pageTitle}</h1>
            <p>{pageDescription}</p>
          </div>
        )}

        <div className={`dashboard-content ${activeTab !== 'overview' ? 'dashboard-content-page' : ''} ${activeTab === 'post-brief' ? 'post-brief-shell' : ''} ${['all-campaigns', 'browse-creator', 'pending-bids', 'shipments', 'work-review', 'wallet'].includes(activeTab) ? 'transparent-tab-shell' : ''}`}>
        {activeTab === 'overview' && (
          <>
            <div className="brand-metrics-grid">
              <div className="brand-metric-card" data-testid="active-deals-card">
                <div className="metric-head">
                  <span className="metric-icon pulse"><Activity size={20} /></span>
                  <span className="metric-trend">UP</span>
                </div>
                <p>Active Deals</p>
                <strong>{dashboardMetrics.active_deals || 0}</strong>
                <small>{Number(dashboardMetrics.active_deals_change_this_week || 0) >= 0 ? '+' : ''}{dashboardMetrics.active_deals_change_this_week || 0} this week</small>
              </div>
              <div className="brand-metric-card" data-testid="live-campaigns-card">
                <div className="metric-head">
                  <span className="metric-icon live"><Briefcase size={20} /></span>
                  <span className="metric-trend">LIVE</span>
                </div>
                <p>Live Campaigns</p>
                <strong>{liveCampaignsCount}</strong>
                <small>Running right now</small>
              </div>
              <div className="brand-metric-card" data-testid="escrow-card">
                <div className="metric-head">
                  <span className="metric-icon lock"><Lock size={20} /></span>
                </div>
                <p>Funds On Hold</p>
                <strong>{formatMoney(dashboardMetrics.in_escrow)}</strong>
                <small>Held for live deals</small>
              </div>
              <div className="brand-metric-card" data-testid="delivered-card">
                <div className="metric-head">
                  <span className="metric-icon success"><CheckCircle size={20} /></span>
                  <span className="metric-trend">UP</span>
                </div>
                <p>Delivered This Month</p>
                <strong>{dashboardMetrics.delivered_this_month || 0}</strong>
                <small>{Number(dashboardMetrics.delivered_monthly_change_percent || 0) >= 0 ? '+' : ''}{dashboardMetrics.delivered_monthly_change_percent || 0}% vs last month</small>
              </div>
              <div className="brand-metric-card" data-testid="wallet-card">
                <div className="metric-head">
                  <span className="metric-icon wallet"><Wallet size={20} /></span>
                </div>
                <p>Wallet Balance</p>
                <strong>{formatMoney(dashboardMetrics.wallet_balance)}</strong>
                <small>Available to spend</small>
              </div>
            </div>
          </>
        )}

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'overview' && (
            <div className="brand-lower-grid">
              <div className="brand-main-col">
                <section className="brand-panel top-campaigns-panel">
                  <div className="top-campaigns-head">
                    <div>
                      <h2>Top Campaigns</h2>
                      <p>Ranked by creator interest</p>
                    </div>
                    <span>{dashboardSearchTerm ? filteredDashboardTopCampaigns.length : dashboardTopCampaigns.length}</span>
                  </div>
                  {filteredDashboardTopCampaigns.length ? (
                    <div className="top-campaigns-list">
                      {filteredDashboardTopCampaigns.map((campaign, index) => (
                        <button
                          key={campaign.id || campaign.title}
                          type="button"
                          className="top-campaign-row"
                          onClick={() => campaign.id && handleViewCampaign(campaign.id)}
                        >
                          <span className={`top-rank ${index < 3 ? 'featured' : ''}`}>{index + 1}</span>
                          <span className="top-campaign-copy">
                            <strong>{campaign.title || 'Untitled Campaign'}</strong>
                            <small>
                              {campaign.applications || 0} bids
                              <i />
                              {campaign.spend ? formatMoney(campaign.spend) : 'No spend yet'}
                            </small>
                          </span>
                          <span className="top-campaign-status">{String(campaign.status || 'draft').replace(/_/g, ' ')}</span>
                          <ExternalLink size={15} />
                        </button>
                      ))}
                    </div>
                  ) : <p className="empty-inline">{dashboardSearchTerm ? 'No matching campaigns' : 'No campaigns yet'}</p>}
                </section>
                <section className="brand-panel active-deals-panel">
                <div className="panel-title-row">
                  <h2>Active Deals</h2>
                  <button type="button" onClick={() => navigate('/dashboard/business/all-campaigns')}>View All</button>
                </div>
                <div className="deals-table">
                  <div className="deals-row deals-head">
                    <span>Campaign</span>
                    <span>Creator</span>
                    <span>Stage</span>
                    <span>Due Date</span>
                    <span>Funds Hold</span>
                    <span>Action</span>
                  </div>
                  {filteredDashboardActiveDeals.length ? filteredDashboardActiveDeals.map((deal) => {
                    const tone = stageTone(deal.stage);
                    return (
                    <div className="deals-row" key={deal.campaign_id}>
                      <strong className="deal-title" data-label="Campaign">{deal.campaign_title || 'Untitled Campaign'}</strong>
                      <span className="creator-handle" data-label="Creator">{deal.public_creator_id || (deal.creator_nickname ? `@${deal.creator_nickname.replace(/^@/, '')}` : '-')}</span>
                      <span className={`deal-stage ${tone}`} data-label="Stage">{deal.stage_label || deal.stage || '-'}</span>
                      <span className="deal-date" data-label="Due Date">{formatDate(deal.due_date)}</span>
                      <strong className="deal-funds" data-label="Funds Hold">{formatMoney(deal.escrow_amount)}</strong>
                      {tone === 'success' ? (
                        <span className="approved-action" data-label="Action"><CheckCircle size={16} /> Approved</span>
                      ) : (
                        <button
                          type="button"
                          className={tone === 'warning' ? 'review-btn' : 'view-btn'}
                          onClick={() => deal.next_action === 'review' ? navigate(`/campaign/${deal.campaign_id}`) : handleViewCampaign(deal.campaign_id)}
                          data-label="Action"
                        >
                          {deal.next_action_label || 'View'}
                        </button>
                      )}
                    </div>
                    );
                  }) : (
                    <div className="deals-empty">{dashboardSearchTerm ? 'No matching active deals' : 'No active deals yet'}</div>
                  )}
                </div>
              </section>
              </div>

              <aside className="brand-right-rail">
                <div className="mini-kpi-grid">
                  <section className="brand-panel mini-kpi">
                    <p>Approval Rate</p>
                    <strong>{dashboardMetrics.approval_rate || 0}%</strong>
                  </section>
                  <section className="brand-panel mini-kpi">
                    <p>Avg Rating</p>
                    <strong>{dashboardMetrics.avg_rating || 0}</strong>
                  </section>
                </div>
                <section className="brand-panel pending-actions-panel">
                  <h2>Pending Actions</h2>
                  {filteredDashboardPendingActions.length ? filteredDashboardPendingActions.map((action) => {
                    const Icon = action.type?.includes('shipment') ? Package : action.type?.includes('message') ? MessageSquare : action.type?.includes('delivery') ? CheckCircle : Eye;
                    const tone = action.type?.includes('shipment') ? 'info' : action.type?.includes('message') ? 'chat' : action.type?.includes('delivery') ? 'success' : 'warning';
                    const target = actionTarget(action.target_url);
                    return (
                    <button key={action.type || action.label} type="button" className={`pending-action ${tone}`} onClick={() => target && navigate(target)} disabled={!target}>
                      <span><Icon size={17} /></span>
                      {action.label} {Number(action.count || 0) > 0 ? `(${action.count})` : ''}
                    </button>
                    );
                  }) : <p className="empty-inline">{dashboardSearchTerm ? 'No matching pending actions' : 'No pending actions'}</p>}
                </section>

                <section className="brand-panel quick-actions-panel">
                  <h2>Quick Actions</h2>
                  <div className="quick-action-grid">
                    <button type="button" onClick={() => navigate('/dashboard/business/post-brief')}><FileCheck size={20} />Post a Brief</button>
                    <button type="button" onClick={() => navigate('/dashboard/business/pending-bids')}><Users size={20} />Creator Bids</button>
                    <button type="button" onClick={() => navigate('/dashboard/business/wallet')}><Wallet size={20} />Top Up Wallet</button>
                    <button type="button"><IndianRupee size={20} />Download Report</button>
                  </div>
                </section>

                <section className="brand-panel budget-panel">
                  <h2>Budget Usage</h2>
                  <p>{formatMoney(dashboardBudget.used)} / {formatMoney(dashboardBudget.total)} used</p>
                  {(dashboardBudget.categories || []).length ? (
                    <div className="budget-lines-list">
                      {dashboardBudget.categories.map((category, index) => {
                        const value = `${Math.round(Number(category.percent || 0))}%`;
                        const color = budgetColors[index % budgetColors.length];
                        return (
                        <div className="budget-line" key={category.label || index}>
                          <div><strong>{category.label || 'Other'}</strong><span>{value}</span></div>
                          <i><b style={{ width: value, background: color }} /></i>
                        </div>
                        );
                      })}
                    </div>
                  ) : <p className="empty-inline">No budget usage yet</p>}
                </section>
              </aside>
            </div>
          )}

          {activeTab === 'post-brief' && <PostABrief />}

          {activeTab === 'all-campaigns' && (
            <div className="all-campaigns-section">
              <div className="all-campaigns-hero">
                <div>
                  <span className="all-campaigns-kicker"><ClipboardList size={16} /> Campaign Workspace</span>
                  <h2>All Campaigns</h2>
                  <p>Track every brief from draft to delivery, review bids, and jump into active campaign workflows.</p>
                </div>
              </div>

              <div className="all-campaigns-stats">
                <div>
                  <span><Briefcase size={20} /></span>
                  <p>Total Campaigns</p>
                  <strong>{campaigns.length}</strong>
                </div>
                <div>
                  <span><Activity size={20} /></span>
                  <p>Active</p>
                  <strong>{campaigns.filter(c => c.status === 'active' || c.status === 'in_progress').length}</strong>
                </div>
                <div>
                  <span><Users size={20} /></span>
                  <p>Total Bids</p>
                  <strong>{totalBidsReceived}</strong>
                </div>
                <div>
                  <span><CheckCircle size={20} /></span>
                  <p>Completed</p>
                  <strong>{completedCampaigns.length}</strong>
                </div>
              </div>
              {drafts.length > 0 && (
                <div className="drafts-panel">
                  <div className="drafts-panel-head">
                    <h3><FileText size={18} /> Drafts ({drafts.length})</h3>
                    <p>Unfinished briefs saved to your account. Pick up where you left off.</p>
                  </div>
                  <div className="drafts-list">
                    {drafts.map(draft => (
                      <div key={draft.id} className="draft-row" data-testid={`draft-${draft.id}`}>
                        <div className="draft-row-main">
                          <strong>{draft.title || 'Untitled brief'}</strong>
                          <span className="draft-meta">
                            {typeof draft.completion_percentage === 'number' ? `${draft.completion_percentage}% complete` : 'Draft'}
                            {draft.product_category ? ` • ${draft.product_category}` : ''}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="btn-primary draft-continue-btn"
                          onClick={() => navigate(`/dashboard/business/post-brief?draft=${draft.id}`)}
                        >
                          <SquarePen size={16} /> Continue editing
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {loading ? (
                <div className="all-campaigns-loading">Loading campaigns...</div>
              ) : campaigns.length === 0 ? (
                <div className="all-campaigns-empty">
                  <span><Briefcase size={48} /></span>
                  <h3>No campaigns yet</h3>
                  <p>Create your first campaign to start receiving creator bids.</p>
                  <button className="btn-primary" onClick={() => setShowCreateModal(true)}>Create Campaign</button>
                </div>
              ) : filteredCampaigns.length === 0 ? (
                <div className="all-campaigns-empty">
                  <span><Search size={48} /></span>
                  <h3>No matching campaigns</h3>
                  <p>Try another campaign, creator, status, or brief keyword.</p>
                </div>
              ) : (
                <div className="campaigns-grid">
                  {filteredCampaigns.map(campaign => (
                    <div key={campaign.id} className="campaign-card-detailed" data-testid={`campaign-${campaign.id}`}>
                      <div className="campaign-header">
                        <div>
                          <span className="campaign-type-label">{campaign.category || 'Campaign'}</span>
                          <h3>{campaign.title}</h3>
                        </div>
                        <span className={`badge badge-${(campaign.status || 'draft').replace('_', '-')}`}>{(campaign.status || 'draft').replace('_', ' ')}</span>
                      </div>
                      <p className="campaign-description">{(campaign.brief_text || 'No brief description added yet.').substring(0, 140)}{(campaign.brief_text || '').length > 140 ? '...' : ''}</p>
                      <div className="campaign-stats">
                        <div className="stat">
                          <span className="stat-label">Budget</span>
                          <span className="stat-value">{formatBudget(campaign.budget_min, campaign.budget_max)}</span>
                        </div>
                        <div className="stat">
                          <span className="stat-label">Bids</span>
                          <span className="stat-value">{campaign.bids?.length || 0}</span>
                        </div>
                        <div className="stat">
                          <span className="stat-label">Posted</span>
                          <span className="stat-value">{formatDate(campaign.created_at)}</span>
                        </div>
                      </div>
                      {(() => {
                        const { stages, current } = getCampaignStages(campaign);
                        return (
                          <div className="campaign-progress">
                            <div className="campaign-progress-track">
                              {stages.map((stage, i) => (
                                <div key={stage.key} className={`cp-step ${i < current ? 'done' : ''} ${i === current ? 'current' : ''}`}>
                                  <span className="cp-dot" />
                                  <span className="cp-label">{stage.label}</span>
                                </div>
                              ))}
                            </div>
                            <p className="campaign-progress-next">{getNextActionHint(campaign)}</p>
                          </div>
                        );
                      })()}
                      <div className="campaign-actions-row">
                        <button
                          className="campaign-primary-action"
                          onClick={() => setModalView({ type: 'campaign', id: campaign.id })}
                          data-testid={`view-campaign-${campaign.id}`}
                        >
                          <Eye size={18} /> View Details
                        </button>
                        <button
                          className="btn-secondary"
                          onClick={() => duplicateCampaign(campaign)}
                          data-testid={`duplicate-campaign-${campaign.id}`}
                        >
                          <Copy size={18} /> Duplicate
                        </button>
                        {campaign.status === 'work_submitted' && (() => {
                          const work = workSubmissions.find(w => w.campaign_id === campaign.id);
                          return (
                            <button
                              className="btn-secondary campaign-review-action"
                              onClick={() => work ? setModalView({ type: 'review', id: work.id }) : navigate('/dashboard/business/work-review')}
                              data-testid={`review-work-${campaign.id}`}
                            >
                              <FileCheck size={18} /> Review Work
                            </button>
                          );
                        })()}
                        {campaign.status === 'completed' && (
                          <button
                            className="btn-secondary campaign-review-action"
                            onClick={() => setModalView({ type: 'review', id: campaign.id })}
                            data-testid={`download-work-${campaign.id}`}
                          >
                            <Download size={18} /> View / Download
                          </button>
                        )}
                        {campaign.selected_creator && (
                          <button
                            className="btn-secondary"
                            onClick={() => setChatWith({
                              id: campaign.selected_creator,
                              name: campaign.selected_creator_nickname || campaign.selected_creator_name || 'Creator',
                              photo: campaign.selected_creator_photo,
                            })}
                            data-testid={`chat-creator-${campaign.id}`}
                          >
                            <MessageSquare size={18} /> Chat
                          </button>
                        )}
                        {campaign.requires_shipment && campaign.selected_creator && (
                          <button
                            className="btn-secondary"
                            onClick={() => setModalView({ type: 'shipment', id: campaign.id })}
                            data-testid={`shipment-${campaign.id}`}
                          >
                            <Package size={18} /> Shipment
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'pending-bids' && (() => {
            const bidCampaigns = campaigns.filter(c => c.bids && c.bids.length > 0 && !c.selected_creator);
            const current = bidCampaigns.find(c => c.id === bidCampaignId) || bidCampaigns[0];
            return (
            <div className="cb-section">
              {bidCampaigns.length === 0 ? (
                <div className="empty-state">
                  <Users size={64} />
                  <p>No pending bids at the moment</p>
                </div>
              ) : (
                <>
                {bidCampaigns.length > 1 && (
                  <div className="cb-campaign-filter">
                    <span>Campaign</span>
                    <select value={current.id} onChange={(e) => setBidCampaignId(e.target.value)}>
                      {bidCampaigns.map(c => (
                        <option key={c.id} value={c.id}>{c.title} · {(c.bids || []).length} bid{(c.bids || []).length === 1 ? '' : 's'}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="cb-list">
                  {current && (
                    <BidsCampaignCard
                      key={current.id}
                      campaign={current}
                      onAccept={handleAcceptBid}
                      onViewCampaign={(id) => setModalView({ type: 'campaign', id })}
                      onViewProfile={(id, bid) => {
                        const creatorId = bid?.creator_id || bid?.public_creator_id || bid?.id;
                        if (!creatorId) { toast.error('Creator profile unavailable for this bid.'); return; }
                        setProfileView({ id: creatorId, name: bid?.creator_nickname || bid?.public_creator_id, photo: bid?.creator_photo || bid?.profile_photo });
                      }}
                    />
                  )}
                </div>
                </>
              )}
            </div>
            );
          })()}

          {activeTab === 'browse-creator' && (
            <div className="creator-directory-section">
              <div className="creator-directory-head">
                <div>
                  <span className="creator-directory-kicker"><UserRoundSearch size={16} /> Curated creator pool</span>
                  <h2>Creator Browse / Directory</h2>
                  <p>Browse creators admitted by ops for private invitations. This view is scoped to the curated pool, not the full platform roster.</p>
                </div>
                <div className="creator-directory-sort">
                  <label htmlFor="creator-sort">Sort</label>
                  <select id="creator-sort" value={creatorSort} onChange={(event) => setCreatorSort(event.target.value)}>
                    {creatorDirectorySorts.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="creator-filter-bar" aria-label="Creator directory filters">
                <span><Filter size={17} /> Filters</span>
                <select value={creatorFilters.category} onChange={(event) => handleCreatorFilterChange('category', event.target.value)} aria-label="Category">
                  <option value="">Category</option>
                  {creatorDirectoryOptions.categories.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
                <select value={creatorFilters.language} onChange={(event) => handleCreatorFilterChange('language', event.target.value)} aria-label="Language">
                  <option value="">Language</option>
                  {creatorDirectoryOptions.languages.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
                <select value={creatorFilters.region} onChange={(event) => handleCreatorFilterChange('region', event.target.value)} aria-label="Location region">
                  <option value="">Location region</option>
                  {creatorDirectoryOptions.regions.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
                <select value={creatorFilters.style} onChange={(event) => handleCreatorFilterChange('style', event.target.value)} aria-label="Content style">
                  <option value="">Content style</option>
                  {creatorDirectoryOptions.styles.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
                <select value={creatorFilters.budget} onChange={(event) => handleCreatorFilterChange('budget', event.target.value)} aria-label="Budget range">
                  <option value="">Budget range</option>
                  {creatorDirectoryOptions.budgets.map(option => <option key={option} value={option}>{option}</option>)}
                </select>
                <button type="button" onClick={() => setCreatorFilters(creatorDirectoryDefaults)}>Clear</button>
              </div>

              {creatorDirectoryLoading ? (
                <div className="loading">Loading creator directory...</div>
              ) : creatorDirectory.length === 0 ? (
                <div className="creator-directory-empty">
                  <Users size={54} />
                  <h3>No creators to show yet</h3>
                  <p>{creatorDirectoryError || 'Creators admitted to your curated view will appear here.'}</p>
                  {creatorDirectoryError && (
                    <small>Backend needed: GET /api/business/creator-directory with filters, sorting, creator card fields, and private invite support.</small>
                  )}
                </div>
              ) : (
                <div className="creator-directory-grid">
                  {creatorDirectory.map(creator => {
                    const avatarInitial = (creator.publicCreatorId
                      ? creator.publicCreatorId.replace(/[^A-Za-z0-9]/g, '').charAt(0)
                      : creator.handle.replace('@', '').charAt(0)).toUpperCase() || 'C';
                    return (
                    <article key={creator.id || creator.displayId} className="creator-directory-card">
                      <div className="creator-card-top">
                        <div className="creator-card-avatar">
                          {creator.avatar ? (
                            <img src={getAssetUrl(creator.avatar)} alt={creator.displayId} onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                          ) : (
                            <span>{avatarInitial}</span>
                          )}
                          <b>{avatarInitial}</b>
                        </div>
                        <div>
                          <h3>{creator.displayId}</h3>
                          <span>{creator.category}</span>
                        </div>
                      </div>

                      <div className="creator-portfolio-preview">
                        {creator.portfolioPreview ? (
                          isVideoAsset(creator.portfolioPreview) ? (
                            <video src={getAssetUrl(creator.portfolioPreview)} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                          ) : (
                            <img src={getAssetUrl(creator.portfolioPreview)} alt={`${creator.displayId} portfolio preview`} onError={(event) => { event.currentTarget.style.display = 'none'; }} />
                          )
                        ) : (
                          <div><ImageIcon size={26} /> Portfolio preview</div>
                        )}
                      </div>

                      <div className="creator-quick-stats">
                        <span><Languages size={15} /> {creator.languages.length ? creator.languages.join(', ') : 'Languages pending'}</span>
                        <span><MapPin size={15} /> {creator.cityTier}</span>
                        <span><CheckCircle size={15} /> {creator.deliverablesCompleted} delivered</span>
                      </div>

                      <div className="creator-card-actions">
                        <button type="button" className="btn-secondary" onClick={() => setSelectedCreatorProfile(creator)}>
                          <Eye size={15} /> <span>View Profile</span>
                        </button>
                        <button type="button" className="btn-primary" onClick={() => handleInviteCreator(creator)}>
                          <Send size={15} /> <span>Invite</span>
                        </button>
                      </div>
                    </article>
                  );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'work-review' && (
            <div className="work-review-section">
              <div className="work-review-hero">
                <div>
                  <span className="work-review-kicker"><FileCheck size={16} /> Creator Deliverables</span>
                  <h2>Work Review Queue</h2>
                  <p>Review submitted content, open files, and release approvals from one focused workspace.</p>
                </div>
                <button type="button" className="work-review-refresh" onClick={fetchCampaigns}>
                  <Activity size={18} /> Refresh Queue
                </button>
              </div>

              <div className="work-review-stats">
                <div>
                  <span><Clock3 size={20} /></span>
                  <p>Pending Review</p>
                  <strong>{workSubmissions.length}</strong>
                </div>
                <div>
                  <span><FileText size={20} /></span>
                  <p>Submitted Files</p>
                  <strong>{workSubmissions.reduce((sum, work) => sum + (work.work_files?.length || 0), 0)}</strong>
                </div>
                <div>
                  <span><UserCheck size={20} /></span>
                  <p>Creators Waiting</p>
                  <strong>{new Set(workSubmissions.map(work => work.creator_id)).size}</strong>
                </div>
              </div>

              {workSubmissions.length === 0 ? (
                <div className="work-review-empty">
                  <span><CheckCircle size={44} /></span>
                  <h3>All caught up</h3>
                  <p>No creator work is pending review right now. New submissions will appear here automatically.</p>
                </div>
              ) : (
                <div className="work-review-list">
                  {workSubmissions.map(work => {
                    const campaign = campaigns.find(c => c.id === work.campaign_id);
                    const files = work.work_files || [];
                    const submittedAt = work.submitted_at || work.created_at;
                    return (
                      <article key={work.id} className="work-review-card" data-testid={`work-${work.id}`}>
                        <div className="work-review-card-main">
                          <div className="work-review-card-top">
                            <div className="work-campaign-mark">
                              {(campaign?.title || 'C').trim().charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h3>{campaign?.title || work.campaign_title || 'Untitled Campaign'}</h3>
                              <p>
                                <span>Creator</span>
                                <strong>{work.public_creator_id || work.creator_id || 'Creator'}</strong>
                                <span>Submitted</span>
                                <strong>{formatDate(submittedAt)}</strong>
                              </p>
                            </div>
                            <span className="work-review-status"><AlertCircle size={15} /> Pending Review</span>
                          </div>

                          <p className="work-review-description">
                            {work.description || 'Creator submitted deliverables for review. Open the files and approve or request revisions.'}
                          </p>

                          <div className="work-review-files">
                            {files.length ? files.slice(0, 4).map((file, idx) => {
                              const fileUrl = file.startsWith('http') ? file : `${BACKEND_URL}${file}`;
                              const fileName = decodeURIComponent(String(file).split('/').pop() || `File ${idx + 1}`);
                              return (
                                <a key={`${file}-${idx}`} href={fileUrl} target="_blank" rel="noopener noreferrer">
                                  <FileText size={16} />
                                  <span>{fileName}</span>
                                  <Download size={15} />
                                </a>
                              );
                            }) : (
                              <span className="work-review-no-files">No files attached</span>
                            )}
                            {files.length > 4 && <span className="work-review-more">+{files.length - 4} more</span>}
                          </div>
                        </div>

                        <div className="work-review-card-side">
                          <div>
                            <small>Campaign Budget</small>
                            <strong>{formatMoney(campaign?.budget_max || campaign?.budget_min || 0)}</strong>
                          </div>
                          <div>
                            <small>Files</small>
                            <strong>{files.length}</strong>
                          </div>
                          <button className="work-review-primary" onClick={() => setModalView({ type: 'review', id: work.id })}>
                            Review Work <ExternalLink size={17} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'wallet' && (
            <div className="wallet-section">
              <div className="wallet-main-column">
                <section className="wallet-hero-card">
                  <div>
                    <span className="wallet-kicker"><Wallet size={18} /> Brand Wallet • UGCad</span>
                    <p>Available Balance</p>
                    <h2>{walletLoading ? 'Loading...' : formatMoney(walletData.available_balance)}</h2>
                    <small>{walletData.chat_unlocked ? 'Platform chat unlocked' : `${formatMoney(walletData.minimum_chat_balance)} minimum balance required to unlock platform chat`}</small>
                  </div>
                  <div className="wallet-hero-side">
                    <div className="whs-panel">
                      <div className="whs-row"><span>Plan</span><strong>{walletData.plan_name}</strong></div>
                      <div className="whs-row"><span>Platform chat</span><b className={walletData.chat_unlocked ? 'ok' : 'warn'} style={walletData.chat_unlocked ? undefined : { color: '#ff4d6d' }}>{walletData.chat_unlocked ? 'Unlocked' : 'Locked'}</b></div>
                      {(walletBonus.current_tier_percent || 0) > 0 && (
                        <div className="whs-row"><span>Recharge bonus</span><b className="ok">+{walletBonus.current_tier_percent}%</b></div>
                      )}
                    </div>
                  </div>
                </section>

                {!walletData.chat_unlocked && (
                  <section className="wallet-warning">
                    <AlertCircle size={18} />
                    <div>
                      <strong>{formatMoney(walletData.minimum_chat_balance)} minimum recharge required to unlock platform chat.</strong>
                      <p>Wallet credits are non-refundable. Add funds to activate messaging with creators.</p>
                    </div>
                    <button type="button" onClick={() => setWalletAmount(String(walletData.minimum_chat_balance))}>Add Funds</button>
                  </section>
                )}

                <section className="wallet-panel wallet-bonus-tiers">
                  <div>
                    <h2>Recharge Bonus Tiers</h2>
                    <p>Get more with bigger recharges. Bonus credited instantly after payment confirmation.</p>
                  </div>
                  <span>Active: +{walletBonus.current_tier_percent || 0}%</span>
                  <div className="wallet-tier-grid">
                    {walletBonusTiers.map((tier) => (
                      <button key={tier.amount} type="button" onClick={() => setWalletAmount(String(tier.amount))}>
                        <strong>{tier.label || formatMoney(tier.amount)}</strong>
                        <small>+{tier.bonus_percent}% bonus</small>
                      </button>
                    ))}
                  </div>
                </section>

              </div>

              <aside className="wallet-side-column">
                <section className="wallet-panel wallet-recharge-card">
                  <div className="wallet-side-title">
                    <h2>Quick Recharge</h2>
                  </div>
                  <label htmlFor="wallet-amount">Enter Amount</label>
                  <div className="wallet-amount-input">
                    <IndianRupee size={18} />
                    <input
                      id="wallet-amount"
                      type="number"
                      min={walletData.minimum_chat_balance || 2500}
                      value={walletAmount}
                      onChange={(event) => setWalletAmount(event.target.value)}
                      placeholder="Enter amount"
                    />
                  </div>
                  <div className="wallet-presets">
                    {walletPresetAmounts.map((amount) => (
                      <button key={amount} type="button" onClick={() => setWalletAmount(String(amount))}>{formatMoney(amount).replace(',000', 'K')}</button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="wallet-add-funds"
                    onClick={() => handleWalletRecharge()}
                    disabled={rechargingWallet}
                  >
                    <Zap size={18} /> {rechargingWallet ? 'Creating Order...' : 'Add Funds'}
                  </button>
                  <small>Minimum {formatMoney(walletData.minimum_chat_balance || 2500)} • Instant credit after payment verification</small>
                </section>
              </aside>

              <section className="wallet-panel wallet-history wallet-history-full">
                <div className="wallet-history-head">
                  <div>
                    <h2>Transaction History</h2>
                    <p>All wallet activity across recharges, escrow, and fees.</p>
                  </div>
                  <div className="wallet-filter-tabs">
                    {['all', 'credits', 'debits'].map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        className={walletFilter === filter ? 'active' : ''}
                        onClick={() => setWalletFilter(filter)}
                      >
                        {filter.charAt(0).toUpperCase() + filter.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {walletError ? (
                  <div className="wallet-empty">{walletError}</div>
                ) : walletLoading ? (
                  <div className="wallet-empty">Loading wallet activity...</div>
                ) : walletTransactions.length === 0 ? (
                  <div className="wallet-empty">No wallet transactions yet.</div>
                ) : (
                  <div className="wallet-table">
                    <div className="wallet-row wallet-head">
                      <span>Date</span>
                      <span>Type</span>
                      <span>Reference</span>
                      <span>Amount</span>
                      <span>Status</span>
                    </div>
                    {walletTransactions.slice(0, 8).map((transaction) => (
                      <div className="wallet-row" key={transaction.id}>
                        <span>{formatWalletDate(transaction.date)}</span>
                        <strong>{transaction.type}</strong>
                        <span>{transaction.reference || '-'}</span>
                        <strong className={transaction.direction === 'debit' ? 'wallet-debit' : 'wallet-credit'}>
                          {transaction.direction === 'debit' ? '-' : '+'}{formatMoney(transaction.amount)}
                        </strong>
                        <span className={`wallet-status ${transaction.status}`}>{transaction.status || 'success'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === 'shipments' && (
            <div className="shipments-section">
              {(() => {
                const ship = campaigns.filter((c) => c.requires_shipment || c.shipment_option === 'yes');
                const statusOf = (c) => {
                  const raw = (shipmentsMap[c.id]?.status || '').toLowerCase();
                  if (['delivered', 'received'].includes(raw)) return 'delivered';
                  if (['in_transit', 'shipped'].includes(raw)) return 'transit';
                  return 'pending';
                };
                const counts = {
                  all: ship.length,
                  transit: ship.filter((c) => statusOf(c) === 'transit').length,
                  delivered: ship.filter((c) => statusOf(c) === 'delivered').length,
                };
                const TABS = [['all', 'All Shipments'], ['transit', 'In Transit'], ['delivered', 'Delivered']];
                const rows = ship.filter((c) => (shipTab === 'all' ? true : statusOf(c) === shipTab));
                const cr = (id) => creatorDirectory.find((x) => x.id === id) || {};
                const cname = (c) => { const u = cr(c.selected_creator); return u.username ? `@${u.username}` : (u.nickname || u.full_name || (c.selected_creator ? 'Creator' : 'Not selected')); };
                const cinit = (c) => (cname(c).replace('@', '')[0] || 'C').toUpperCase();
                const cphoto = (c) => cr(c.selected_creator).profile_photo;

                if (ship.length === 0) {
                  return (
                    <div className="empty-state">
                      <Package size={64} />
                      <p>No campaigns requiring shipment</p>
                      <p className="hint">Campaigns with shipment requirements will appear here</p>
                    </div>
                  );
                }

                return (
                  <>
                    <div className="ship-toolbar">
                      <div className="ship-tabs">
                        {TABS.map(([k, l]) => (
                          <button key={k} type="button" className={shipTab === k ? 'on' : ''} onClick={() => setShipTab(k)}>
                            {l} <em>({counts[k]})</em>
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="ship-table-card">
                      <table className="ship-table">
                        <thead>
                          <tr><th>Creator</th><th>Campaign</th><th>Courier</th><th>Tracking ID</th><th>Status</th><th>Est. Delivery</th><th>Action</th></tr>
                        </thead>
                        <tbody>
                          {rows.map((c) => {
                            const s = shipmentsMap[c.id];
                            const st = statusOf(c);
                            const photo = cphoto(c);
                            return (
                              <tr key={c.id} data-testid={`shipment-${c.id}`}>
                                <td>
                                  <span className="ship-cr">
                                    <span className="ship-ava">{photo ? <img src={photo.startsWith('http') ? photo : `${BACKEND_URL}${photo}`} alt="" /> : cinit(c)}</span>
                                    {cname(c)}
                                  </span>
                                </td>
                                <td className="ship-strong">{c.title}</td>
                                <td>{s?.courier || s?.courier_name || '—'}</td>
                                <td>{s?.tracking_number || '—'}</td>
                                <td><span className={`ship-status ${st === 'delivered' || st === 'transit' ? st : (c.selected_creator ? 'ready' : 'awaiting')}`}>{st === 'delivered' ? 'Delivered' : st === 'transit' ? 'In Transit' : (c.selected_creator ? 'Ready to Ship' : 'Awaiting Creator')}</span></td>
                                <td className="ship-muted">{s?.expected_delivery ? formatDate(s.expected_delivery) : '—'}</td>
                                <td className="ship-action">
                                  {c.selected_creator
                                    ? <button type="button" onClick={() => setModalView({ type: 'shipment', id: c.id, ship: st !== 'delivered' && st !== 'transit' })}>{st === 'delivered' ? 'View' : st === 'transit' ? 'Track' : 'Ship'}</button>
                                    : <button type="button" onClick={() => setModalView({ type: 'campaign', id: c.id })}>Select</button>}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Create New Campaign</h2>
            <form onSubmit={handleCreateCampaign} className="campaign-form">
              <div className="form-group">
                <label htmlFor="title">Campaign Title</label>
                <input
                  id="title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  className="input-field"
                  placeholder="e.g., T-Shirt UGC Campaign"
                  required
                  data-testid="campaign-title-input"
                />
              </div>

              <div className="form-group">
                <label>Campaign Banner / Image</label>
                <label className="campaign-img-drop">
                  {formData.image_url ? (
                    <>
                      <img src={formData.image_url.startsWith('http') ? formData.image_url : `${BACKEND_URL}${formData.image_url}`} alt="" className="campaign-img-preview" />
                      <span className="campaign-img-change">{campaignImgUploading ? 'Uploading…' : 'Change image'}</span>
                    </>
                  ) : (
                    <span className="campaign-img-empty">
                      <ImageIcon size={22} />
                      <strong>{campaignImgUploading ? 'Uploading…' : 'Add a banner or image for your campaign'}</strong>
                      <small>Make it look more exciting for creators · JPG/PNG, up to 5MB (optional)</small>
                    </span>
                  )}
                  <input type="file" accept="image/*" hidden onChange={handleCampaignImage} />
                </label>
              </div>

              <div className="form-group">
                <label htmlFor="objectives">Campaign Objectives</label>
                <div className="objective-input-wrapper">
                  <input
                    id="objectives"
                    type="text"
                    value={objectiveInput}
                    onChange={(e) => setObjectiveInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addObjective())}
                    className="input-field"
                    placeholder="e.g., Increase brand awareness"
                    data-testid="objective-input"
                  />
                  <button type="button" onClick={addObjective} className="btn-secondary" data-testid="add-objective-btn">
                    Add
                  </button>
                </div>
                <div className="objectives-list">
                  {formData.objectives.map((obj, idx) => (
                    <span key={idx} className="objective-tag" data-testid={`objective-${idx}`}>
                      {obj}
                      <button type="button" onClick={() => removeObjective(obj)} data-testid={`remove-objective-${idx}`}>×</button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="budget-row">
                <div className="form-group">
                  <label htmlFor="budget_min">Min Budget (₹)</label>
                  <input
                    id="budget_min"
                    type="text"
                    inputMode="numeric"
                    value={formData.budget_min}
                    onKeyDown={blockNonDigitKey}
                    onChange={(e) => handleInputChange('budget_min', digitsOnly(e.target.value))}
                    className="input-field"
                    placeholder="100"
                    required
                    data-testid="budget-min-input"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="budget_max">Max Budget (₹)</label>
                  <input
                    id="budget_max"
                    type="text"
                    inputMode="numeric"
                    value={formData.budget_max}
                    onKeyDown={blockNonDigitKey}
                    onChange={(e) => handleInputChange('budget_max', digitsOnly(e.target.value))}
                    className="input-field"
                    placeholder="500"
                    required
                    data-testid="budget-max-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="brief_text">Campaign Brief</label>
                <textarea
                  id="brief_text"
                  value={formData.brief_text}
                  onChange={(e) => handleInputChange('brief_text', e.target.value)}
                  className="textarea-field"
                  placeholder="Describe your campaign requirements, target audience, content style, etc."
                  required
                  data-testid="brief-text-input"
                />
              </div>

              <div className="form-group">
                <label htmlFor="shipment_option">Will you ship your product to creator for the video?</label>
                <select
                  id="shipment_option"
                  value={formData.shipment_option}
                  onChange={(e) => handleInputChange('shipment_option', e.target.value)}
                  className="input-field"
                  data-testid="shipment-option-select"
                >
                  <option value="no">No - Creator uses their own</option>
                  <option value="yes">Yes - I will ship the product</option>
                  <option value="not_sure">Not Sure - Discuss with creator</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" data-testid="submit-campaign-btn">
                  Create Campaign
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedCreatorProfile && (
        <div className="modal-overlay" onClick={() => setSelectedCreatorProfile(null)}>
          <div className="modal-content creator-profile-modal" onClick={(event) => event.stopPropagation()}>
            <div className="creator-profile-modal-head">
              <div className="creator-card-avatar large">
                {selectedCreatorProfile.avatar ? (
                  <img src={getAssetUrl(selectedCreatorProfile.avatar)} alt={selectedCreatorProfile.handle} />
                ) : (
                  <span>{selectedCreatorProfile.handle.replace('@', '').charAt(0).toUpperCase()}</span>
                )}
              </div>
              <div>
                <h2>{selectedCreatorProfile.handle}</h2>
                <p>{selectedCreatorProfile.category}</p>
              </div>
            </div>
            <div className="creator-profile-modal-grid">
              <div><small>Languages</small><strong>{selectedCreatorProfile.languages.length ? selectedCreatorProfile.languages.join(', ') : 'Pending'}</strong></div>
              <div><small>City Tier</small><strong>{selectedCreatorProfile.cityTier}</strong></div>
              <div><small>Delivered</small><strong>{selectedCreatorProfile.deliverablesCompleted}</strong></div>
              <div><small>Budget</small><strong>{selectedCreatorProfile.budgetRange || 'Not set'}</strong></div>
            </div>
            <div className="creator-profile-modal-preview">
              {selectedCreatorProfile.portfolioPreview ? (
                isVideoAsset(selectedCreatorProfile.portfolioPreview) ? (
                  <video src={getAssetUrl(selectedCreatorProfile.portfolioPreview)} controls muted playsInline preload="metadata" />
                ) : (
                  <img src={getAssetUrl(selectedCreatorProfile.portfolioPreview)} alt={`${selectedCreatorProfile.handle} portfolio preview`} />
                )
              ) : (
                <span><ImageIcon size={24} /> Portfolio preview pending</span>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={() => setSelectedCreatorProfile(null)}>Close</button>
              <button type="button" className="btn-primary" onClick={() => handleInviteCreator(selectedCreatorProfile)}>
                <Send size={16} /> Invite
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedCreatorInvite && (
        <div className="modal-overlay" onClick={closeInviteModal}>
          <div className="modal-content creator-invite-modal" onClick={(event) => event.stopPropagation()}>
            <div className="creator-invite-head">
              <div>
                <span className="creator-directory-kicker"><Send size={16} /> Private invitation</span>
                <h2>Invite {selectedCreatorInvite.handle}</h2>
                <p>Send a structured invitation card. The creator can accept, reject, or counter from chat.</p>
              </div>
            </div>

            <form onSubmit={handleSubmitCreatorInvite} className="creator-invite-form">
              <div className="form-group">
                <label htmlFor="invite-campaign">Existing campaign (optional)</label>
                <select
                  id="invite-campaign"
                  className="input-field"
                  value={inviteForm.campaign_id}
                  onChange={(event) => handleInviteCampaignChange(event.target.value)}
                >
                  <option value="">No linked campaign</option>
                  {campaigns.map(campaign => (
                    <option key={campaign.id} value={campaign.id}>{campaign.title}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="invite-campaign-name">Campaign name</label>
                <input
                  id="invite-campaign-name"
                  className="input-field"
                  value={inviteForm.campaign_name}
                  onChange={(event) => handleInviteFieldChange('campaign_name', event.target.value)}
                  placeholder="Summer Skincare Reel"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="invite-deliverables">Deliverable summary</label>
                <textarea
                  id="invite-deliverables"
                  className="textarea-field"
                  value={inviteForm.deliverable_summary}
                  onChange={(event) => handleInviteFieldChange('deliverable_summary', event.target.value)}
                  placeholder="1 Instagram reel + 3 raw clips"
                  required
                  rows={3}
                />
              </div>

              <div className="budget-row">
                <div className="form-group">
                  <label htmlFor="invite-budget">Budget</label>
                  <input
                    id="invite-budget"
                    className="input-field"
                    value={inviteForm.budget}
                    onChange={(event) => handleInviteFieldChange('budget', event.target.value)}
                    placeholder="Rs. 10,000"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="invite-timeline">Timeline</label>
                  <input
                    id="invite-timeline"
                    className="input-field"
                    value={inviteForm.timeline}
                    onChange={(event) => handleInviteFieldChange('timeline', event.target.value)}
                    placeholder="7 days"
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="invite-rights">Usage rights</label>
                <input
                  id="invite-rights"
                  className="input-field"
                  value={inviteForm.usage_rights}
                  onChange={(event) => handleInviteFieldChange('usage_rights', event.target.value)}
                  placeholder="30 days paid social usage"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="invite-message">Message</label>
                <textarea
                  id="invite-message"
                  className="textarea-field"
                  value={inviteForm.message}
                  onChange={(event) => handleInviteFieldChange('message', event.target.value)}
                  placeholder="Add a short note for the creator"
                  rows={3}
                />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn-secondary" onClick={closeInviteModal} disabled={sendingInvite}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={sendingInvite}>
                  <Send size={16} /> {sendingInvite ? 'Sending...' : 'Send Invite'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      </main>

      <style>{`
        .dashboard-page {
          min-height: 100vh;
          display: flex;
          background: #f6f7fc;

          /* Compact, SaaS-grade type scale — overrides the oversized global clamp()
             sizes just inside this dashboard (matches the creator dashboard). */
          --fs-h1: 22px;   /* page title */
          --fs-h2: 16px;   /* section / card titles */
          --fs-h3: 13.5px; /* component titles */
          --fw-head: 600;  /* real semibold weight for hierarchy */
        }

        .business-sidebar {
          width: 260px;
          min-height: 100vh;
          position: sticky;
          top: 0;
          align-self: flex-start;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 28px 24px;
          background: #07074E;
          color: white;
          border-top-right-radius: 32px;
          border-bottom-right-radius: 32px;
        }

        .business-sidebar-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 28px;
          font-size: 18px;
          font-weight: 600;
        }

        .business-sidebar-mark,
        .business-avatar {
          display: grid;
          place-items: center;
          flex: 0 0 auto;
          background: #5b6bff;
          color: white;
          font-weight: 400;
        }

        .business-sidebar-mark {
          width: 32px;
          height: 32px;
          border-radius: 8px;
        }

        .business-sidebar-nav {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .business-nav-label {
          padding: 0 16px 6px;
          color: #b7b7e6;
          font-size: 11px;
          font-weight: 400;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .business-nav-item {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 12px 16px;
          border: 0;
          border-radius: 999px;
          background: transparent;
          color: rgba(255, 255, 255, 0.74);
          cursor: pointer;
          text-align: left;
          transition: 180ms ease;
        }

        .business-nav-badge {
          display: grid;
          place-items: center;
          min-width: 22px;
          height: 22px;
          margin-left: auto;
          border-radius: 999px;
          background: #5b6bff;
          color: white;
          font-size: 12px;
          line-height: 1;
        }

        .business-nav-badge.orange {
          background: #F59E0B;
        }

        .business-nav-badge.green {
          background: #27AE60;
        }

        .business-nav-item:hover {
          color: white;
          background: rgba(255, 255, 255, 0.1);
        }

        .business-nav-item.active {
          color: #07074E;
          background: white;
          font-weight: 400;
        }

        .business-nav-item span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .business-sidebar-profile {
          display: flex;
          align-items: center;
          gap: 14px;
          padding-top: 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.12);
        }

        .business-avatar {
          width: 42px;
          height: 42px;
          border-radius: 50%;
        }

        .business-sidebar-profile strong,
        .business-sidebar-profile span {
          display: block;
        }

        .business-sidebar-profile span {
          margin-top: 2px;
          color: #b7b7e6;
          font-size: 12px;
          font-weight: 400;
        }

        .business-main {
          flex: 1;
          min-width: 0;
          background: #f6f7fc;
        }

        .dashboard-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
        }

        .approval-pending {
          text-align: center;
          background: white;
          padding: 60px 40px;
          border-radius: 24px;
          max-width: 600px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
        }

        .approval-pending h2 {
          font-size: var(--fs-h2);
          margin-bottom: 16px;
          color: #1a202c;
        }

        .approval-pending p {
          color: #718096;
          margin-bottom: 12px;
          line-height: 1.6;
        }

        .approval-pending button {
          margin-top: 24px;
        }

        .dashboard-header {
          background: transparent;
          border-bottom: 0;
          padding: 24px 40px 8px;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 24px;
          max-width: 1480px;
          margin: 0 auto;
        }

        .dashboard-header h1 {
          font-size: var(--fs-h1);
          font-weight: var(--fw-head);
          color: #07074E;
          margin-bottom: 4px;
        }

        .dashboard-header p {
          color: #9296ba;
          font-weight: 400;
          max-width: 440px;
        }

        .brand-page-title {
          min-width: 320px;
        }

        .brand-breadcrumb {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-bottom: 8px;
          color: #B7B7E6;
          font-size: 13px;
          font-weight: 400;
        }

        .brand-breadcrumb strong {
          color: #5b6bff;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .header-actions button {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .brand-round-action,
        .brand-profile-photo {
          position: relative;
          width: 48px;
          height: 48px;
          display: grid !important;
          place-items: center;
          border: 1px solid #E5E7FF;
          border-radius: 50%;
          background: white;
          color: #07074E;
          box-shadow: 0 10px 25px rgba(7, 7, 78, 0.06);
          cursor: pointer;
        }

        .brand-round-action i {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #F59E0B;
          border: 2px solid white;
        }

        .brand-profile-photo {
          background: #5b6bff;
          color: white;
          font-weight: 400;
        }

        .dashboard-content {
          padding: 20px 40px 40px;
          max-width: 1480px;
          margin: 0 auto;
        }

        .post-brief-shell {
          padding-top: 8px;
        }

        .drafts-panel {
          background: #fff;
          border: 1px solid #ececf1;
          border-radius: 16px;
          padding: 20px 22px;
          margin-bottom: 22px;
        }
        .drafts-panel-head h3 {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 0 0 4px;
          font-size: 17px;
        }
        .drafts-panel-head p {
          margin: 0 0 14px;
          color: #6b6b76;
          font-size: 13px;
        }
        .drafts-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .draft-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 12px 14px;
          border: 1px solid #eee;
          border-radius: 12px;
          background: #fafafb;
        }
        .draft-row-main {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }
        .draft-row-main strong {
          font-size: 14px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .draft-meta {
          font-size: 12px;
          color: #8a8a93;
        }
        .draft-continue-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          flex-shrink: 0;
        }

        .brand-search {
          position: relative;
          flex: 1;
          max-width: 520px;
          min-width: 240px;
          height: 52px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 20px;
          border: 2px solid #8EA0FF;
          border-radius: 999px;
          background: white;
          color: #9296ba;
          box-shadow: 0 8px 24px rgba(7, 7, 78, 0.14);
          z-index: 20;
        }

        .brand-search input {
          width: 100%;
          border: 0;
          outline: 0;
          color: #07074E;
          font-weight: 400;
        }

        .brand-search input::placeholder {
          color: #B7B7E6;
        }

        .brand-search-results {
          position: absolute;
          top: calc(100% + 10px);
          left: 0;
          right: 0;
          display: grid;
          gap: 8px;
          max-height: 380px;
          overflow-y: auto;
          padding: 10px;
          border: 1px solid #E5E7FF;
          border-radius: 18px;
          background: white;
          box-shadow: 0 18px 42px rgba(7, 7, 78, 0.14);
        }

        .brand-search-result {
          display: grid;
          gap: 3px;
          width: 100%;
          padding: 11px 12px;
          border: 1px solid transparent;
          border-radius: 12px;
          background: #FBFBFF;
          color: #07074E;
          cursor: pointer;
          text-align: left;
        }

        .brand-search-result:hover,
        .brand-search-result:focus-visible {
          border-color: #E5E7FF;
          background: #F7F7FF;
          outline: 0;
        }

        .brand-search-result span {
          color: #5b6bff;
          font-size: 11px;
          font-weight: 400;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .brand-search-result strong {
          color: #07074E;
          font-size: 14px;
          line-height: 1.3;
          overflow-wrap: anywhere;
        }

        .brand-search-result small,
        .brand-search-empty small {
          color: #9296ba;
          font-size: 12px;
          font-weight: 400;
        }

        .brand-search-empty {
          display: grid;
          gap: 4px;
          padding: 14px;
          color: #07074E;
        }

        .role-switch {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px;
          border-radius: 999px;
          background: white;
          box-shadow: 0 8px 24px rgba(7, 7, 78, 0.08);
          color: #9296ba;
          font-weight: 400;
        }

        .role-switch span,
        .role-switch strong {
          padding: 10px 20px;
          border-radius: 999px;
        }

        .role-switch strong {
          background: #07074E;
          color: white;
        }

        .brand-metrics-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(180px, 1fr));
          gap: 20px;
          margin-bottom: 24px;
        }

        .brand-metric-card,
        .brand-panel {
          background: white;
          border: 1px solid #F0F1FF;
          border-radius: 18px;
          box-shadow: 0 12px 28px rgba(7, 7, 78, 0.045);
        }

        .brand-metric-card {
          min-height: 148px;
          padding: 16px 18px 14px;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          gap: 10px;
          transition: transform 160ms ease, box-shadow 160ms ease;
        }

        .brand-metric-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 18px 38px rgba(7, 7, 78, 0.07);
        }

        .metric-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
        }

        .metric-icon {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          color: #5b6bff;
          background: #EEF0FF;
          box-shadow: 0 6px 14px rgba(7, 7, 78, 0.16);
          flex-shrink: 0;
        }
        .metric-icon svg { width: 18px; height: 18px; }

        .metric-icon.success {
          color: #27AE60;
          background: #DDF7E9;
        }

        .metric-icon.wallet {
          color: #F59E0B;
          background: #FFF1D8;
        }

        .metric-icon.lock {
          color: #5b6bff;
        }

        .metric-icon.live {
          color: #07074E;
          background: #EDEEFF;
        }

        .metric-trend {
          padding: 5px 9px;
          border-radius: 999px;
          background: #DDF7E9;
          color: #27AE60;
          font-size: 11px;
          font-weight: 400;
          line-height: 1;
          white-space: nowrap;
        }

        .brand-metric-card p {
          min-height: 0;
          margin: 0;
          color: #9296ba;
          font-size: 12px;
          font-weight: 400;
          line-height: 1.3;
          letter-spacing: 0.01em;
        }

        .brand-metric-card strong {
          color: #07074E;
          font-size: clamp(22px, 1.6vw, 27px);
          font-weight: 600;
          line-height: 1.1;
          letter-spacing: -0.01em;
          overflow-wrap: anywhere;
          margin-top: 2px;
        }

        .brand-metric-card small {
          display: block;
          margin-top: auto;
          padding-top: 10px;
          border-top: 1px solid #EEF0FF;
          color: #9296ba;
          font-size: 11px;
          font-weight: 400;
          line-height: 1.35;
        }

        .dashboard-content:not(.dashboard-content-page) .tab-content {
          background: transparent;
          padding: 0;
          border-radius: 0;
          box-shadow: none;
          min-height: 0;
        }

        .post-brief-shell .tab-content {
          background: transparent;
          padding: 0;
          border-radius: 0;
          box-shadow: none;
          min-height: 0;
        }

        .transparent-tab-shell .tab-content {
          background: transparent;
          padding: 0;
          border-radius: 0;
          box-shadow: none;
          min-height: 0;
        }

        .post-brief-page {
          max-width: 980px;
        }

        .post-brief-card {
          background: white;
          border-radius: 22px;
          padding: 32px;
          box-shadow: 0 16px 34px rgba(7, 7, 78, 0.06);
        }

        .post-brief-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          padding-bottom: 24px;
          margin-bottom: 24px;
          border-bottom: 1px solid #EEF0FF;
        }

        .post-brief-head h2 {
          margin: 0 0 8px;
          color: #07074E;
          font-size: var(--fs-h2);
          font-weight: var(--fw-head);
        }

        .post-brief-head p {
          margin: 0;
          color: #9296ba;
          font-weight: 400;
        }

        .post-brief-head span {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          padding: 10px 14px;
          border-radius: 999px;
          background: #EEF0FF;
          color: #5b6bff;
          font-weight: 400;
          font-size: 14px;
        }

        .post-brief-form {
          max-width: 760px;
        }

        .post-brief-actions {
          display: flex;
          gap: 14px;
          justify-content: flex-end;
          padding-top: 8px;
        }

        .post-brief-actions button {
          min-width: 160px;
        }

        .brand-overview-grid {
          display: grid;
          grid-template-columns: minmax(460px, 2fr) minmax(270px, 0.95fr) minmax(320px, 0.95fr);
          gap: 24px;
          align-items: start;
        }

        .brand-panel {
          padding: 24px;
        }

        .brand-panel h2 {
          margin: 0;
          color: #07074E;
          font-size: var(--fs-h2);
          font-weight: var(--fw-head);
        }

        .performance-panel {
          min-height: 408px;
        }

        .panel-title-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          margin-bottom: 18px;
        }

        .period-switch {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 5px;
          border-radius: 12px;
          background: #F0F1FF;
          color: #9296ba;
          font-weight: 400;
        }

        .performance-controls {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 12px;
          flex-wrap: wrap;
        }

        .campaign-filter {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 0;
          padding: 5px 5px 5px 12px;
          border: 1px solid #E5E7FF;
          border-radius: 12px;
          background: #FBFBFF;
          color: #9296ba;
          font-size: 12px;
          font-weight: 400;
          text-transform: uppercase;
        }

        .campaign-filter select {
          width: 190px;
          min-width: 0;
          border: 0;
          border-radius: 9px;
          background: white;
          color: #07074E;
          cursor: pointer;
          font-size: 14px;
          font-weight: 400;
          outline: 0;
          padding: 9px 30px 9px 11px;
        }

        .campaign-filter select:focus-visible {
          outline: 2px solid #5b6bff;
          outline-offset: 2px;
        }

        .period-switch button {
          padding: 9px 14px;
          border: 0;
          border-radius: 10px;
          background: transparent;
          color: inherit;
          cursor: pointer;
          font-size: 14px;
          font-weight: 400;
        }

        .period-switch button.active {
          color: #07074E;
          background: white;
          box-shadow: 0 4px 10px rgba(7, 7, 78, 0.12);
        }

        .period-switch button:focus-visible {
          outline: 2px solid #5b6bff;
          outline-offset: 2px;
        }

        .performance-chart {
          position: relative;
          height: 246px;
          padding: 0 44px 0 48px;
        }

        .performance-chart svg {
          position: absolute;
          inset: 0 44px 28px 48px;
          width: calc(100% - 92px);
          height: calc(100% - 28px);
          overflow: visible;
        }

        .chart-grid-lines {
          position: absolute;
          inset: 0 44px 28px 0;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          color: #9296ba;
          font-size: 13px;
          font-weight: 400;
        }

        .chart-grid-lines span::after {
          content: "";
          position: absolute;
          left: 48px;
          right: 0;
          height: 1px;
          margin-top: 8px;
          border-top: 1px dashed #E5E7FF;
        }

        .chart-axis-right {
          position: absolute;
          inset: 0 0 28px auto;
          width: 34px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          color: #9296ba;
          font-size: 13px;
          font-weight: 400;
          text-align: right;
        }

        .bar.deals {
          fill: #07074E;
        }

        .bar.deliveries {
          fill: #5b6bff;
        }

        .line {
          fill: none;
          stroke-width: 5;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .line.spend,
        .dot.spend {
          stroke: #F59E0B;
          fill: white;
        }

        .line.applications,
        .dot.applications {
          stroke: #27AE60;
          fill: white;
        }

        .dot {
          stroke-width: 4;
        }

        .chart-hit-zones {
          position: absolute;
          inset: 0 44px 28px 48px;
          pointer-events: none;
        }

        .chart-hit-zone {
          position: absolute;
          top: 0;
          bottom: 0;
          left: var(--month-x);
          width: 78px;
          padding: 0;
          border: 0;
          background: transparent;
          cursor: pointer;
          transform: translateX(-50%);
          pointer-events: auto;
        }

        .chart-hover-guide {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 50%;
          border-left: 1px solid #E1E3F8;
          opacity: 0;
          transform: translateX(-50%);
          transition: opacity 160ms ease;
        }

        .campaign-tooltip {
          position: absolute;
          left: 50%;
          top: 18px;
          width: 224px;
          padding: 15px 14px;
          border: 1px solid #F0F0F8;
          border-radius: 14px;
          background: white;
          box-shadow: 0 16px 34px rgba(7, 7, 78, 0.14);
          color: #07074E;
          opacity: 0;
          pointer-events: none;
          transform: translate(-50%, 8px);
          transition: opacity 160ms ease, transform 160ms ease;
          z-index: 3;
        }

        .chart-hit-zone:first-child .campaign-tooltip {
          left: 0;
          transform: translate(0, 8px);
        }

        .chart-hit-zone:last-child .campaign-tooltip {
          left: auto;
          right: 0;
          transform: translate(0, 8px);
        }

        .campaign-tooltip strong {
          display: block;
          margin-bottom: 10px;
          font-size: 16px;
          text-align: left;
        }

        .campaign-tooltip span {
          display: grid;
          grid-template-columns: 12px 1fr auto;
          align-items: center;
          gap: 6px;
          margin-top: 8px;
          color: #9296ba;
          font-size: 13px;
          font-weight: 400;
          text-align: left;
        }

        .campaign-tooltip i {
          width: 9px;
          height: 9px;
          border-radius: 50%;
        }

        .campaign-tooltip b {
          color: #07074E;
          font-size: 14px;
        }

        .chart-hit-zone:hover .chart-hover-guide,
        .chart-hit-zone:focus-visible .chart-hover-guide,
        .chart-hit-zone:hover .campaign-tooltip,
        .chart-hit-zone:focus-visible .campaign-tooltip {
          opacity: 1;
        }

        .chart-hit-zone:hover .campaign-tooltip,
        .chart-hit-zone:focus-visible .campaign-tooltip {
          transform: translate(-50%, 0);
        }

        .chart-hit-zone:first-child:hover .campaign-tooltip,
        .chart-hit-zone:first-child:focus-visible .campaign-tooltip,
        .chart-hit-zone:last-child:hover .campaign-tooltip,
        .chart-hit-zone:last-child:focus-visible .campaign-tooltip {
          transform: translate(0, 0);
        }

        .chart-months,
        .chart-legend {
          display: flex;
          align-items: center;
          color: #9296ba;
          font-weight: 400;
        }

        .chart-months {
          position: absolute;
          left: 78px;
          right: 62px;
          bottom: 0;
          justify-content: space-between;
        }

        .chart-legend {
          justify-content: center;
          gap: 14px 18px;
          flex-wrap: wrap;
          margin-top: 16px;
          font-size: 13px;
          color: #07074E;
        }

        .chart-legend i {
          width: 10px;
          height: 10px;
          display: inline-block;
          border-radius: 50%;
          margin-right: 6px;
        }

        .legend-deals { background: #07074E; }
        .legend-deliveries { background: #5b6bff; }
        .legend-applications { background: #27AE60; }
        .legend-spend { background: #F59E0B; }

        .funnel-panel {
          height: 408px;
          display: flex;
          flex-direction: column;
        }

        .funnel-chart {
          position: relative;
          height: 268px;
          flex: 0 0 auto;
          display: flex;
          padding-left: 42px;
          margin-top: 18px;
        }

        .funnel-axis {
          position: absolute;
          left: 0;
          top: 46px;
          bottom: 0;
          width: 36px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          color: #9296ba;
          font-size: 13px;
          font-weight: 400;
          line-height: 1;
          text-align: right;
        }

        .funnel-axis span::after {
          content: "";
          position: absolute;
          left: 46px;
          right: 0;
          height: 1px;
          margin-top: 6px;
          border-top: 1px dashed #EEF0FF;
        }

        .funnel-bars {
          flex: 1;
          display: grid;
          grid-template-columns: 1.1fr 0.8fr 0.65fr 0.65fr;
          gap: 16px;
          align-items: end;
          padding-top: 46px;
        }

        .funnel-bar {
          position: relative;
          border-radius: 8px 8px 0 0;
          background: #07074E;
        }

        .funnel-bar.applied {
          height: 235px;
          background: linear-gradient(180deg, #EEF0FF 0%, #9296ba 100%);
        }

        .funnel-bar.shortlisted {
          height: 112px;
          background: #5b6bff;
        }

        .funnel-bar.accepted {
          height: 44px;
          background: #3347B9;
        }

        .funnel-bar.live {
          height: 42px;
        }

        .funnel-tooltip {
          position: absolute;
          left: 50%;
          bottom: calc(100% + 12px);
          transform: translateX(-50%);
          width: max-content;
          min-width: 82px;
          padding: 10px 12px;
          border-radius: 14px;
          background: white;
          color: #07074E;
          box-shadow: 0 14px 28px rgba(7, 7, 78, 0.12);
          font-weight: 400;
          line-height: 1.35;
          text-align: center;
          opacity: 0;
          pointer-events: none;
          transition: opacity 160ms ease, transform 160ms ease;
        }

        .funnel-bar:hover .funnel-tooltip,
        .funnel-bar:focus-visible .funnel-tooltip {
          opacity: 1;
          transform: translateX(-50%) translateY(-4px);
        }

        .funnel-tooltip strong {
          color: #5b6bff;
        }

        .funnel-labels {
          display: flex;
          justify-content: space-around;
          color: #9296ba;
          font-weight: 400;
          font-size: 12px;
          margin-top: 12px;
        }

        .brand-side-stack {
          display: flex;
          flex-direction: column;
          gap: 18px;
          align-self: start;
          min-height: 408px;
        }

        .top-campaigns-panel {
          min-height: 390px;
          display: flex;
          flex-direction: column;
          flex: 1 1 auto;
          overflow: hidden;
        }

        .top-campaigns-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 16px;
        }

        .top-campaigns-head p {
          margin: 6px 0 0;
          color: #9296ba;
          font-size: 13px;
          font-weight: 400;
        }

        .top-campaigns-head > span {
          min-width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          border-radius: 999px;
          background: #EEF0FF;
          color: #5b6bff;
          font-weight: 400;
        }

        .top-campaigns-list {
          display: grid;
          gap: 10px;
          max-height: 326px;
          overflow-y: auto;
          padding-right: 4px;
        }

        .top-campaigns-panel .top-campaign-row {
          width: 100%;
          display: grid;
          grid-template-columns: 26px minmax(0, 1fr) auto;
          align-items: start;
          gap: 10px;
          padding: 10px 11px;
          border: 1px solid transparent;
          border-radius: 14px;
          background: #FBFBFF;
          color: #07074E;
          cursor: pointer;
          text-align: left;
          transition: background 160ms ease, border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
        }

        .top-campaigns-panel .top-campaign-row:hover {
          background: white;
          border-color: #E5E7FF;
          box-shadow: 0 12px 24px rgba(7, 7, 78, 0.08);
          transform: translateY(-1px);
        }

        .top-campaigns-panel .top-campaign-row:focus-visible {
          outline: 2px solid #5b6bff;
          outline-offset: 2px;
        }

        .top-rank {
          width: 26px;
          height: 26px;
          grid-row: 1 / span 2;
          margin-top: 2px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background: #EEF0FF;
          color: #5b6bff;
          font-size: 11px;
          font-weight: 400;
        }

        .top-rank.featured {
          background: #07074E;
          color: white;
        }

        .top-campaign-copy {
          min-width: 0;
          grid-column: 2 / -1;
        }

        .top-campaign-copy strong {
          display: block;
          color: #07074E;
          font-size: 15px;
          font-weight: 400;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }

        .top-campaign-copy small {
          display: flex;
          align-items: center;
          gap: 7px;
          margin-top: 5px;
          color: #9296ba;
          font-size: 12px;
          font-weight: 400;
        }

        .top-campaign-copy small i {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #DADCF8;
        }

        .top-campaign-status {
          grid-column: 2;
          width: max-content;
          max-width: 100%;
          padding: 6px 9px;
          border-radius: 999px;
          background: #F0F1FF;
          color: #5b6bff;
          font-size: 11px;
          font-weight: 400;
          text-transform: capitalize;
        }

        .top-campaign-row svg {
          grid-column: 3;
          align-self: center;
          color: #9296ba;
        }

        .empty-inline,
        .deals-empty {
          margin: 16px 0 0;
          color: #9296ba;
          font-weight: 400;
        }

        .deals-empty {
          padding: 28px;
          border-top: 1px solid #EEF0FF;
        }

        .mini-kpi-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          flex: 0 0 auto;
        }

        .mini-kpi {
          min-height: 96px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }

        .mini-kpi p {
          margin: 0 0 12px;
          color: #9296ba;
          font-weight: 400;
        }

        .mini-kpi strong {
          color: #07074E;
          font-size: 26px;
        }

        .mini-kpi:first-child strong {
          color: #27AE60;
        }

        .brand-lower-grid {
          display: grid;
          grid-template-columns: minmax(0, 2.25fr) minmax(320px, 0.95fr);
          gap: 24px;
          margin-top: 12px;
          align-items: start;
        }

        .brand-main-col {
          display: flex;
          flex-direction: column;
          gap: 24px;
          min-width: 0;
        }

        .active-deals-panel {
          padding: 0;
          overflow: hidden;
        }

        .active-deals-panel .panel-title-row {
          padding: 28px 28px 22px;
          margin: 0;
        }

        .active-deals-panel .panel-title-row button {
          border: 0;
          background: transparent;
          color: #5b6bff;
          cursor: pointer;
          font-weight: 400;
        }

        .deals-table {
          width: 100%;
          overflow: hidden;
        }

        .deals-row {
          display: grid;
          grid-template-columns: minmax(150px, 1.45fr) minmax(120px, 1fr) minmax(132px, 1fr) minmax(86px, 0.7fr) minmax(96px, 0.82fr) minmax(96px, 0.72fr);
          align-items: center;
          gap: 14px;
          padding: 20px 28px;
          border-top: 1px solid #EEF0FF;
          color: #07074E;
          font-weight: 400;
        }

        .deals-row > * {
          min-width: 0;
        }

        .deals-head {
          padding-top: 18px;
          padding-bottom: 18px;
          background: #F7F7FF;
          color: #9296ba;
          font-size: 13px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .deal-title,
        .creator-handle,
        .deal-date,
        .deal-funds {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .creator-handle {
          color: #5b6bff;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 14px;
        }

        .deal-stage {
          width: max-content;
          max-width: 100%;
          overflow: hidden;
          padding: 8px 14px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 400;
          text-overflow: ellipsis;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .deal-stage.warning {
          background: #FFF1D8;
          color: #F59E0B;
        }

        .deal-stage.info {
          background: #EEF0FF;
          color: #5b6bff;
        }

        .deal-stage.success {
          background: #DDF7E9;
          color: #27AE60;
        }

        .review-btn,
        .view-btn {
          width: 100%;
          max-width: 112px;
          border: 0;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 400;
          padding: 10px 12px;
        }

        .review-btn {
          background: #F59E0B;
          color: white;
          box-shadow: 0 8px 18px rgba(245, 158, 11, 0.28);
        }

        .view-btn {
          background: #F0F1FF;
          color: #07074E;
        }

        .approved-action {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #27AE60;
          font-weight: 400;
        }

        .brand-right-rail {
          display: flex;
          flex-direction: column;
          gap: 28px;
          min-width: 0;
        }

        .pending-actions-panel,
        .budget-panel,
        .quick-actions-panel {
          padding: 24px;
        }

        .pending-actions-panel h2,
        .budget-panel h2,
        .quick-actions-panel h2 {
          margin-bottom: 18px;
        }

        .pending-action {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 12px;
          border: 1px solid transparent;
          border-radius: 14px;
          background: #FBFBFF;
          color: #07074E;
          cursor: pointer;
          font-weight: 400;
          text-align: left;
          transition: background 160ms ease, border-color 160ms ease, transform 160ms ease;
        }

        .pending-action + .pending-action {
          margin-top: 10px;
        }

        .pending-action:hover:not(:disabled) {
          background: white;
          border-color: #E5E7FF;
          transform: translateY(-1px);
        }

        .pending-action:focus-visible {
          outline: 2px solid #5b6bff;
          outline-offset: 2px;
        }

        .pending-action:disabled {
          cursor: default;
          opacity: 0.72;
        }

        .pending-action span {
          width: 36px;
          height: 36px;
          flex: 0 0 36px;
          display: grid;
          place-items: center;
          border-radius: 10px;
        }

        .pending-action.warning span {
          color: #F59E0B;
          background: #FFF1D8;
        }

        .pending-action.success span {
          color: #27AE60;
          background: #DDF7E9;
        }

        .pending-action.info span,
        .pending-action.chat span {
          color: #5b6bff;
          background: #EEF0FF;
        }

        .budget-panel p {
          margin: -8px 0 24px;
          color: #9296ba;
          font-weight: 400;
        }

        .budget-lines-list {
          display: grid;
          gap: 16px;
          max-height: 132px;
          overflow-y: auto;
          padding-right: 4px;
        }

        .budget-line {
          min-height: 21px;
        }

        .budget-line div {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
          color: #07074E;
          font-weight: 400;
        }

        .budget-line i {
          display: block;
          height: 7px;
          border-radius: 999px;
          background: #F0F1FF;
          overflow: hidden;
        }

        .budget-line b {
          display: block;
          height: 100%;
          border-radius: inherit;
        }

        .quick-action-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        .quick-action-grid button {
          min-height: 80px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border: 1px solid #E5E7FF;
          border-radius: 12px;
          background: #F7F7FF;
          color: #07074E;
          cursor: pointer;
          font-weight: 400;
        }

        .quick-action-grid svg {
          color: #5b6bff;
        }

        @media (max-width: 1280px) {
          .brand-metrics-grid,
          .brand-overview-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .all-campaigns-stats {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .creator-directory-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .performance-panel {
            grid-column: 1 / -1;
          }

          .brand-side-stack {
            grid-column: 1 / -1;
            display: grid;
            grid-template-columns: 1fr 1fr;
          }

          .brand-lower-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 980px) {
          .header-content {
            flex-wrap: wrap;
          }

          .all-campaigns-hero {
            align-items: stretch;
            flex-direction: column;
          }

          .all-campaigns-create {
            width: 100%;
          }

          .all-campaigns-section .campaigns-grid {
            grid-template-columns: 1fr;
          }

          .brand-search {
            order: 3;
            max-width: none;
            flex-basis: 100%;
          }

          .brand-metrics-grid,
          .brand-overview-grid,
          .brand-side-stack,
          .mini-kpi-grid {
            grid-template-columns: 1fr;
          }

          .performance-controls {
            width: 100%;
            justify-content: flex-start;
          }

          .campaign-filter,
          .campaign-filter select {
            width: 100%;
          }

          .brand-side-stack {
            display: flex;
          }

          .quick-action-grid {
            grid-template-columns: 1fr;
          }

          .active-deals-panel {
            padding: 24px;
          }

          .active-deals-panel .panel-title-row {
            padding: 0 0 18px;
          }

          .deals-table {
            display: grid;
            gap: 14px;
          }

          .deals-head {
            display: none;
          }

          .deals-row {
            grid-template-columns: 1fr 1fr;
            gap: 14px 18px;
            padding: 18px;
            border: 1px solid #EEF0FF;
            border-radius: 16px;
            background: #FBFBFF;
          }

          .deals-row > *::before {
            content: attr(data-label);
            display: block;
            margin-bottom: 5px;
            color: #9296ba;
            font-size: 11px;
            font-weight: 400;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }

          .deal-title {
            grid-column: 1 / -1;
            white-space: normal;
          }

          .review-btn,
          .view-btn {
            max-width: none;
          }

          .creator-directory-head {
            align-items: stretch;
            flex-direction: column;
          }

          .creator-directory-sort {
            min-width: 0;
          }

          .creator-filter-bar {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .creator-filter-bar > span,
          .creator-filter-bar button {
            grid-column: 1 / -1;
          }

          .wallet-section {
            grid-template-columns: 1fr;
          }

          .wallet-side-column {
            display: grid;
            grid-template-columns: 1fr 1fr;
          }
        }

        @media (max-width: 640px) {
          .all-campaigns-stats,
          .all-campaigns-section .campaign-stats {
            grid-template-columns: 1fr;
          }

          .all-campaigns-hero,
          .all-campaigns-section .campaign-card-detailed {
            padding: 18px;
          }

          .active-deals-panel,
          .pending-actions-panel,
          .budget-panel,
          .quick-actions-panel {
            padding: 18px;
          }

          .active-deals-panel .panel-title-row {
            align-items: flex-start;
          }

          .deals-row {
            grid-template-columns: 1fr;
          }

          .period-switch {
            width: 100%;
          }

          .period-switch button {
            flex: 1;
          }

          .top-campaign-status {
            display: none;
          }
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 24px;
          margin-bottom: 32px;
        }

        .stat-card {
          background: white;
          padding: 24px;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          display: flex;
          align-items: center;
          gap: 20px;
          transition: all 0.3s ease;
        }

        .stat-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
        }

        .stat-icon {
          width: 64px;
          height: 64px;
          background: linear-gradient(135deg, #5b6bff 0%, #764ba2 100%);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }

        .stat-icon.active {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        }

        .stat-icon.bids {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        }

        .stat-icon.spent {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        }

        .stat-label {
          font-size: 0.875rem;
          color: #718096;
          margin-bottom: 4px;
        }

        .stat-value {
          font-size: 1.75rem;
          font-weight: 400;
          color: #1a202c;
        }

        .quick-actions {
          background: white;
          padding: 32px;
          border-radius: 24px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          margin-bottom: 32px;
        }

        .quick-actions h3 {
          font-size: var(--fs-h3);
          font-weight: var(--fw-head);
          color: #1a202c;
          margin-bottom: 24px;
        }

        .actions-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        .action-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          padding: 24px;
          background: linear-gradient(135deg, #f8f9ff 0%, #e8ecff 100%);
          border: 2px solid #e2e8f0;
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.3s ease;
          font-weight: 400;
          color: #4a5568;
        }

        .action-btn:hover {
          border-color: #5b6bff;
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(102, 126, 234, 0.2);
        }

        .tabs-container {
          background: white;
          padding: 0;
          border-radius: 24px 24px 0 0;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          margin-bottom: -1px;
        }

        .tabs {
          display: flex;
          gap: 8px;
          padding: 16px 24px 0;
          overflow-x: auto;
          border-bottom: 2px solid #e2e8f0;
        }

        .tab {
          padding: 12px 24px;
          background: none;
          border: none;
          border-bottom: 3px solid transparent;
          color: #718096;
          font-weight: 400;
          cursor: pointer;
          transition: all 0.3s ease;
          white-space: nowrap;
          margin-bottom: -2px;
        }

        .tab:hover {
          color: #5b6bff;
        }

        .tab.active {
          color: #5b6bff;
          border-bottom-color: #5b6bff;
        }

        .tab-content {
          background: white;
          padding: 32px;
          border-radius: 0 0 24px 24px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          min-height: 400px;
        }

        .section-group {
          margin-bottom: 48px;
        }

        .section-group:last-child {
          margin-bottom: 0;
        }

        .section-group h2 {
          font-size: var(--fs-h2);
          font-weight: var(--fw-head);
          color: #1a202c;
          margin-bottom: 24px;
        }

        .loading,
        .empty-state {
          text-align: center;
          padding: 60px 20px;
          color: #718096;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .empty-state-small {
          text-align: center;
          padding: 30px;
          color: #718096;
        }

        .hint {
          font-size: 0.9rem;
          color: #a0aec0;
          font-style: italic;
        }

        .campaigns-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 24px;
        }

        .campaign-card,
        .campaign-card-detailed {
          background: #f8f9ff;
          padding: 24px;
          border-radius: 16px;
          border: 2px solid #e2e8f0;
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
          height: 100%;
        }

        .campaign-card:hover,
        .campaign-card-detailed:hover {
          border-color: #5b6bff;
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(102, 126, 234, 0.2);
        }

        .campaign-header {
          display: flex;
          justify-content: space-between;
          align-items: start;
          margin-bottom: 12px;
        }

        .campaign-header h3 {
          font-size: var(--fs-h3);
          font-weight: var(--fw-head);
          color: #1a202c;
          flex: 1;
        }

        .campaign-brief,
        .campaign-description {
          color: #4a5568;
          line-height: 1.6;
          margin-bottom: 16px;
        }

        .campaign-stats {
          display: flex;
          gap: 24px;
          margin-bottom: 20px;
        }

        .stat {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .stat-label {
          font-size: 0.875rem;
          color: #718096;
        }

        .stat-value {
          font-weight: 400;
          color: #1a202c;
        }

        .campaign-progress {
          margin: 4px 0 16px;
        }

        .campaign-progress-track {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          position: relative;
        }

        .campaign-progress-track::before {
          content: '';
          position: absolute;
          top: 6px;
          left: 6px;
          right: 6px;
          height: 2px;
          background: #e7e8f2;
          z-index: 0;
        }

        .cp-step {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          flex: 1;
          text-align: center;
        }

        .cp-dot {
          width: 13px;
          height: 13px;
          border-radius: 50%;
          background: #e7e8f2;
          border: 2px solid #e7e8f2;
        }

        .cp-step.done .cp-dot {
          background: #6d5efc;
          border-color: #6d5efc;
        }

        .cp-step.current .cp-dot {
          background: #fff;
          border-color: #6d5efc;
          box-shadow: 0 0 0 3px rgba(109, 94, 252, 0.2);
        }

        .cp-label {
          font-size: 10.5px;
          color: #9a9ab0;
          font-weight: 500;
        }

        .cp-step.done .cp-label,
        .cp-step.current .cp-label {
          color: #4b4b66;
        }

        .cp-step.current .cp-label {
          font-weight: 700;
          color: #6d5efc;
        }

        .campaign-progress-next {
          margin: 12px 0 0;
          font-size: 12.5px;
          color: #6b6b80;
        }

        .campaign-review-action {
          border-color: #6d5efc !important;
          color: #6d5efc !important;
        }

        .campaign-actions-row {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: auto;
        }

        .campaign-actions-row button {
          flex: 1;
          min-width: 140px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        /* Rejected / single-button cards: don't stretch the lone button full width */
        .campaign-actions-row > button:only-child {
          flex: 0 0 auto;
          width: auto;
          max-width: 220px;
          padding-left: 28px;
          padding-right: 28px;
        }

        .all-campaigns-section {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .all-campaigns-hero {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 28px;
          border: 1px solid #E5E7FF;
          border-radius: 22px;
          background: linear-gradient(135deg, #FFFFFF 0%, #F7F8FF 100%);
          box-shadow: 0 18px 44px rgba(7, 7, 78, 0.06);
        }

        .all-campaigns-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          color: #5b6bff;
          font-size: 13px;
          font-weight: 400;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .all-campaigns-hero h2 {
          margin: 0 0 8px;
          color: #07074E;
          font-size: var(--fs-h2);
          letter-spacing: 0;
        }

        .all-campaigns-hero p {
          max-width: 680px;
          margin: 0;
          color: #6F72A8;
          font-weight: 400;
          line-height: 1.6;
        }

        .all-campaigns-create {
          min-height: 46px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 0 20px;
          border: 0;
          border-radius: 12px;
          background: #07074E;
          color: #FFFFFF;
          font-weight: 400;
          cursor: pointer;
          box-shadow: 0 12px 26px rgba(7, 7, 78, 0.18);
          white-space: nowrap;
        }

        .all-campaigns-stats {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 18px;
        }

        .all-campaigns-stats > div {
          display: grid;
          grid-template-columns: 44px 1fr;
          align-items: center;
          gap: 14px;
          padding: 18px;
          border: 1px solid #E5E7FF;
          border-radius: 18px;
          background: #FFFFFF;
          box-shadow: 0 14px 34px rgba(7, 7, 78, 0.05);
        }

        .all-campaigns-stats span {
          grid-row: span 2;
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          border-radius: 13px;
          background: #EEF0FF;
          color: #5b6bff;
        }

        .all-campaigns-stats p {
          margin: 0;
          color: #8A8DBD;
          font-size: 13px;
          font-weight: 400;
        }

        .all-campaigns-stats strong {
          color: #07074E;
          font-size: 24px;
          line-height: 1;
        }

        .all-campaigns-loading,
        .all-campaigns-empty {
          display: grid;
          place-items: center;
          min-height: 300px;
          padding: 48px 20px;
          border: 1px dashed #C8CEFF;
          border-radius: 22px;
          background: #FFFFFF;
          color: #6F72A8;
          text-align: center;
          font-weight: 400;
        }

        .all-campaigns-empty {
          gap: 12px;
        }

        .all-campaigns-empty span {
          width: 78px;
          height: 78px;
          display: grid;
          place-items: center;
          border-radius: 22px;
          background: #EEF0FF;
          color: #5b6bff;
        }

        .all-campaigns-empty h3 {
          margin: 8px 0 0;
          color: #07074E;
          font-size: var(--fs-h3);
        }

        .all-campaigns-empty p {
          margin: 0 0 8px;
          color: #8A8DBD;
        }

        .all-campaigns-section .campaigns-grid {
          grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
          gap: 20px;
        }

        .all-campaigns-section .campaign-card-detailed {
          display: flex;
          flex-direction: column;
          gap: 18px;
          min-height: 300px;
          padding: 22px;
          border: 1px solid #E5E7FF;
          border-radius: 20px;
          background: #FFFFFF;
          box-shadow: 0 16px 38px rgba(7, 7, 78, 0.055);
        }

        .all-campaigns-section .campaign-card-detailed:hover {
          border-color: #BCC5FF;
          transform: translateY(-3px);
          box-shadow: 0 22px 46px rgba(7, 7, 78, 0.09);
        }

        .all-campaigns-section .campaign-header {
          gap: 18px;
          margin: 0;
        }

        .campaign-type-label {
          display: inline-block;
          margin-bottom: 8px;
          color: #5b6bff;
          font-size: 12px;
          font-weight: 400;
          text-transform: uppercase;
        }

        .all-campaigns-section .campaign-header h3 {
          margin: 0;
          color: #07074E;
          font-size: var(--fs-h3);
          font-weight: var(--fw-head);
          line-height: 1.3;
        }

        .all-campaigns-section .badge {
          flex: 0 0 auto;
          padding: 8px 12px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 400;
          text-transform: capitalize;
          white-space: nowrap;
        }

        .all-campaigns-section .campaign-description {
          min-height: 48px;
          margin: 0;
          color: #65699B;
          font-weight: 400;
          line-height: 1.55;
        }

        .all-campaigns-section .campaign-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
          margin: auto 0 0;
        }

        .all-campaigns-section .stat {
          padding: 12px;
          border-radius: 14px;
          background: #F7F8FF;
          border: 1px solid #ECEEFF;
        }

        .all-campaigns-section .stat-label {
          color: #8A8DBD;
          font-size: 12px;
          font-weight: 400;
          text-transform: uppercase;
        }

        .all-campaigns-section .stat-value {
          display: block;
          min-width: 0;
          margin-top: 4px;
          color: #07074E;
          font-size: 14px;
          font-weight: 400;
          line-height: 1.35;
          white-space: normal;
          overflow-wrap: anywhere;
        }

        .all-campaigns-section .campaign-actions-row {
          padding-top: 2px;
        }

        .campaign-primary-action {
          border: 0;
          border-radius: 12px;
          background: #07074E;
          color: #FFFFFF;
          cursor: pointer;
          font-weight: 400;
          box-shadow: 0 10px 22px rgba(7, 7, 78, 0.14);
        }

        .all-campaigns-section .btn-secondary {
          border-color: #E5E7FF;
          background: #F7F8FF;
        }

        /* ── modern refresh: align All Campaigns cards with the new marketplace look ── */
        .all-campaigns-section .campaign-card-detailed {
          border-radius: 18px;
          box-shadow: 0 12px 30px -16px rgba(28, 30, 80, 0.16);
        }
        .all-campaigns-section .campaign-card-detailed:hover {
          border-color: #cdd4ff;
          box-shadow: 0 18px 40px -18px rgba(28, 30, 80, 0.30);
        }
        .all-campaigns-section .campaign-type-label {
          font-weight: 700;
          letter-spacing: 0.5px;
          font-size: 11.5px;
        }
        .all-campaigns-section .campaign-header h3 { font-weight: 800; letter-spacing: -0.3px; }
        .all-campaigns-section .stat {
          background: #f6f7fc;
          border-color: #eceeff;
          border-radius: 12px;
        }
        .all-campaigns-section .stat-value { font-weight: 700; }
        /* stepper → indigo→violet, matching the deal room */
        .all-campaigns-section .cp-step.done .cp-dot { background: #5b6bff; border-color: #5b6bff; }
        .all-campaigns-section .cp-step.current .cp-dot { border-color: #5b6bff; box-shadow: 0 0 0 4px rgba(91, 107, 255, 0.2); }
        .all-campaigns-section .cp-step.current .cp-label { color: #5b6bff; font-weight: 700; }
        .all-campaigns-section .campaign-progress-next { color: #8a8dbd; font-size: 12.5px; }
        /* primary action → indigo gradient like the rest of the app */
        .all-campaigns-section .campaign-primary-action {
          background: linear-gradient(100deg,#12124f,#07074e);
          color: #fff;
          border-radius: 13px;
          font-weight: 700;
          box-shadow: 0 12px 26px -12px rgba(7,7,78,.7);
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .all-campaigns-section .campaign-primary-action:hover { transform: translateY(-1px); box-shadow: 0 18px 34px -12px rgba(68, 82, 240, 0.7); }
        .all-campaigns-section .btn-secondary {
          border: 1px solid #e9ebf4;
          background: #fff;
          border-radius: 13px;
          font-weight: 700;
          transition: border-color 0.18s ease, transform 0.18s ease;
        }
        .all-campaigns-section .btn-secondary:hover { border-color: #cdd4ff; transform: translateY(-1px); }
        .all-campaigns-section .badge { font-weight: 700; }

        .pending-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .pending-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px;
          background: #f8f9ff;
          border-radius: 12px;
          border: 2px solid #e2e8f0;
        }

        .pending-info h4 {
          font-size: var(--fs-h3);
          font-weight: var(--fw-head);
          color: #1a202c;
          margin-bottom: 8px;
        }

        .bids-section {
          display: flex;
          flex-direction: column;
          gap: 22px;
        }

        /* Creator Bids — campaign picker (one campaign's bids at a time) */
        .cb-campaign-filter { display: flex; align-items: center; gap: 12px; margin-bottom: 18px; }
        .cb-campaign-filter span { color: #8a8fc0; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; }
        .cb-campaign-filter select {
          flex: 1; max-width: 460px; border: 1px solid #e6e8f3; border-radius: 12px;
          padding: 11px 14px; font-family: inherit; font-size: 14px; font-weight: 600;
          color: #15163a; background: #fff; cursor: pointer; outline: none;
        }
        .cb-campaign-filter select:focus { border-color: #5b6bff; }

        /* ---- Creator Bids (redesigned) ---- */
        .cb-section { display: flex; flex-direction: column; gap: 20px; }
        .cb-head h2 { margin: 0; font-size: 26px; font-weight: 800; color: #15163a; letter-spacing: -0.4px; }
        .cb-head p { margin: 6px 0 0; color: #767aa0; font-size: 14.5px; }

        .cb-list { display: flex; flex-direction: column; gap: 22px; }

        .cb-card {
          background: #fff;
          border: 1px solid #ecedf7;
          border-radius: 20px;
          box-shadow: 0 18px 44px rgba(7, 7, 78, 0.05);
          overflow: visible;
        }

        /* campaign header strip */
        .cb-campaign {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 18px 22px;
          border-bottom: 1px solid #f0f1f9;
        }
        .cb-campaign-thumb {
          flex-shrink: 0;
          width: 52px; height: 52px;
          display: grid; place-items: center;
          border-radius: 13px;
          background: linear-gradient(135deg, #5b6bff, #7b5bff);
          color: #fff; font-weight: 800; font-size: 20px;
        }
        .cb-campaign-info { flex: 1; min-width: 0; }
        .cb-campaign-info h3 { margin: 0; font-size: 17px; font-weight: 700; color: #15163a; }
        .cb-campaign-info p { margin: 4px 0 0; color: #868ab0; font-size: 13.5px; }
        .cb-view-campaign {
          flex-shrink: 0;
          min-height: 42px; padding: 0 20px;
          border: 1px solid #e0e2f0; border-radius: 12px;
          background: #fff; color: #2a2d63; font-weight: 600; font-size: 14px;
          cursor: pointer; transition: .18s;
        }
        .cb-view-campaign:hover { border-color: #c7ccf0; background: #f7f8ff; }

        /* tabs row */
        .cb-tabs-row {
          display: flex; align-items: center; justify-content: space-between;
          gap: 14px; padding: 14px 22px; border-bottom: 1px solid #f0f1f9;
        }
        .cb-tabs { display: flex; flex-wrap: wrap; gap: 22px; }
        .cb-tabs button {
          position: relative;
          background: none; border: none; cursor: pointer;
          padding: 6px 0; color: #868ab0; font-weight: 600; font-size: 14px;
          font-family: inherit; transition: color .15s;
        }
        .cb-tabs button:hover { color: #4a4e86; }
        .cb-tabs button.active { color: #5b6bff; }
        .cb-tabs button.active::after {
          content: ''; position: absolute; left: 0; right: 0; bottom: -15px;
          height: 2px; background: #5b6bff; border-radius: 2px;
        }
        .cb-filters {
          display: inline-flex; align-items: center; gap: 8px;
          min-height: 38px; padding: 0 16px;
          border: 1px solid #e0e2f0; border-radius: 11px;
          background: #fff; color: #2a2d63; font-weight: 600; font-size: 13.5px;
          cursor: pointer; transition: .18s;
        }
        .cb-filters:hover { border-color: #c7ccf0; background: #f7f8ff; }
        .cb-filters.on { border-color: #5b6bff; color: #5b6bff; background: #f3f4ff; }
        .cb-filters-dot { width: 6px; height: 6px; border-radius: 50%; background: #5b6bff; }
        .cb-filters-wrap { position: relative; }
        .cb-filters-backdrop { position: fixed; inset: 0; z-index: 40; }
        .cb-filters-menu {
          position: absolute; top: calc(100% + 8px); right: 0; z-index: 50;
          min-width: 210px; padding: 8px; background: #fff;
          border: 1px solid #e9ebf4; border-radius: 13px;
          box-shadow: 0 18px 44px rgba(15,22,58,.16);
          display: flex; flex-direction: column; gap: 2px;
        }
        .cb-filters-head {
          padding: 6px 10px 8px; font-size: 11px; font-weight: 700;
          letter-spacing: .4px; text-transform: uppercase; color: #9296ba;
        }
        .cb-filters-opt {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          padding: 9px 11px; border: none; background: none; cursor: pointer;
          border-radius: 9px; font-family: inherit; font-size: 13.5px; font-weight: 600;
          color: #2a2d63; text-align: left; transition: background .15s;
        }
        .cb-filters-opt:hover { background: #f4f5fc; }
        .cb-filters-opt.sel { color: #5b6bff; background: #f3f4ff; }
        .cb-filters-opt.sel svg { color: #5b6bff; }

        /* bid rows */
        .cb-bid-list { display: flex; flex-direction: column; overflow: hidden; border-radius: 0 0 20px 20px; }
        .cb-bid {
          display: grid;
          grid-template-columns: 64px minmax(0, 1fr) 110px 96px auto;
          align-items: center;
          gap: 18px;
          padding: 20px 22px;
          border-bottom: 1px solid #f3f4fb;
          transition: background .15s;
        }
        .cb-bid:last-child { border-bottom: none; }
        .cb-bid:hover { background: #fafbff; }
        .cb-bid-avatar {
          width: 64px; height: 64px; border-radius: 14px;
          display: grid; place-items: center;
          background: linear-gradient(135deg, #eef1ff, #e7e9ff);
          color: #5b6bff; font-weight: 800; font-size: 24px;
        }
        .cb-bid-main { min-width: 0; }
        .cb-bid-name { display: flex; align-items: center; gap: 10px; }
        .cb-bid-name strong { font-size: 15.5px; font-weight: 700; color: #15163a; }
        .cb-top-match {
          display: inline-flex; align-items: center;
          padding: 3px 10px; border-radius: 999px;
          background: #e3f9ee; color: #1aa260;
          font-size: 10.5px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase;
        }
        .cb-bid-cat { display: block; margin: 3px 0 6px; color: #9296ba; font-size: 12.5px; font-weight: 500; }
        .cb-bid-pitch { margin: 0; color: #686c95; font-size: 13.5px; line-height: 1.5;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .cb-bid-stat { text-align: left; }
        .cb-bid-stat strong { display: block; color: #15163a; font-size: 15px; font-weight: 700; }
        .cb-bid-stat span { color: #a3a6c6; font-size: 12px; }
        .cb-bid-actions { display: flex; align-items: center; gap: 10px; }
        .cb-star {
          width: 38px; height: 38px; border-radius: 10px; flex-shrink: 0;
          border: 1px solid #e6e8f4; background: #fff; color: #c5c8de;
          font-size: 17px; line-height: 1; cursor: pointer; transition: .15s;
        }
        .cb-star:hover { border-color: #ffd24a; color: #ffb800; }
        .cb-star.on { border-color: #ffd24a; background: #fff8e6; color: #ffb800; }
        .cb-view-profile {
          min-height: 40px; padding: 0 18px;
          border: 1px solid #e0e2f0; border-radius: 11px;
          background: #fff; color: #2a2d63; font-weight: 600; font-size: 14px;
          cursor: pointer; transition: .18s; white-space: nowrap;
        }
        .cb-view-profile:hover { border-color: #c7ccf0; background: #f7f8ff; }
        .cb-accept {
          min-height: 40px; padding: 0 22px;
          border: none; border-radius: 11px;
          background: linear-gradient(100deg,#12124f,#07074e); color: #fff;
          font-weight: 700; font-size: 14px; cursor: pointer;
          box-shadow: 0 12px 26px -12px rgba(7,7,78,.7); transition: .18s;
        }
        .cb-accept:hover { transform: translateY(-1px); }
        .cb-decline {
          background: none; border: none; cursor: pointer;
          color: #b0496a; font-weight: 600; font-size: 13px; font-family: inherit; padding: 4px;
        }
        .cb-decline:hover { text-decoration: underline; }
        .cb-declined-tag { display:inline-flex; align-items:center; padding:7px 14px; border-radius:999px; background:#fee2e2; color:#b42318; font-weight:700; font-size:13px; }
        .cb-empty { padding: 40px; text-align: center; color: #9296ba; font-size: 14px; }

        @media (max-width: 860px) {
          .cb-bid {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
          }
          .cb-bid-avatar { width: 56px; height: 56px; }
          .cb-bid-main { flex: 1 1 200px; }
          .cb-bid-stat { flex: 0 0 auto; margin-right: 22px; }
          .cb-bid-actions { flex: 1 1 100%; justify-content: flex-start; flex-wrap: wrap; }
          .cb-tabs-row { flex-wrap: wrap; }
        }

        .shipments-section {
          display: flex;
          flex-direction: column;
          gap: 22px;
        }

        .bids-section-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 28px;
          border: 1px solid #E9EBFF;
          border-radius: 24px;
          background: white;
          box-shadow: 0 18px 42px rgba(7, 7, 78, 0.05);
        }

        .shipments-section-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 28px;
          border: 1px solid #E9EBFF;
          border-radius: 24px;
          background: white;
          box-shadow: 0 18px 42px rgba(7, 7, 78, 0.05);
        }

        .bids-section-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          padding: 8px 12px;
          border-radius: 999px;
          background: #EEF0FF;
          color: #5b6bff;
          font-size: 12px;
          font-weight: 400;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .shipments-section-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          padding: 8px 12px;
          border-radius: 999px;
          background: #EEF0FF;
          color: #5b6bff;
          font-size: 12px;
          font-weight: 400;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .bids-section-head h2 {
          margin: 0;
          color: #07074E;
          font-size: var(--fs-h2);
          line-height: 1.1;
        }

        .shipments-section-head h2 {
          margin: 0;
          color: #07074E;
          font-size: var(--fs-h2);
          line-height: 1.1;
        }

        .bids-section-head p {
          max-width: 560px;
          margin: 10px 0 0;
          color: #9296ba;
          font-weight: 400;
          line-height: 1.5;
        }

        .shipments-section-head p {
          max-width: 560px;
          margin: 10px 0 0;
          color: #9296ba;
          font-weight: 400;
          line-height: 1.5;
        }

        .bids-section-head > span {
          flex: 0 0 auto;
          padding: 10px 14px;
          border-radius: 999px;
          background: #EEF0FF;
          color: #5b6bff;
          font-size: 13px;
          font-weight: 400;
        }

        .shipments-section-head > span {
          flex: 0 0 auto;
          padding: 10px 14px;
          border-radius: 999px;
          background: #EEF0FF;
          color: #5b6bff;
          font-size: 13px;
          font-weight: 400;
        }

        .bids-grid,
        .shipments-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
          gap: 18px;
          align-items: start;
        }

        .bid-campaign-card {
          display: flex;
          flex-direction: column;
          gap: 18px;
          padding: 26px;
          border: 1px solid #E5E7FF;
          border-radius: 24px;
          background: white;
          box-shadow: 0 16px 34px rgba(7, 7, 78, 0.06);
        }

        .shipment-card {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 18px;
          border: 1px solid #E5E7FF;
          border-radius: 16px;
          background: white;
          box-shadow: 0 12px 26px rgba(7, 7, 78, 0.05);
        }

        .bid-campaign-header,
        .shipment-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
          margin-bottom: 0;
        }

        .bid-campaign-header h3,
        .shipment-header h3 {
          margin: 0;
          font-size: var(--fs-h3);
          line-height: 1.25;
          font-weight: var(--fw-head);
          color: #1a202c;
          flex: 1;
          overflow-wrap: anywhere;
        }

        .bid-count {
          background: linear-gradient(135deg, #5b6bff 0%, #764ba2 100%);
          color: white;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 0.875rem;
          font-weight: 400;
        }

        .campaign-budget,
        .shipment-info {
          color: #4a5568;
          margin: 0;
        }

        .shipment-details {
          display: grid;
          gap: 8px;
          padding: 12px;
          border: 1px solid #EEF0FF;
          border-radius: 16px;
          background: #FBFBFF;
        }

        .shipment-info {
          display: flex;
          gap: 8px;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }

        .shipment-info strong {
          flex: 0 0 auto;
          color: #07074E;
        }

        .campaign-budget {
          color: #9296ba;
          font-size: 16px;
          font-weight: 400;
        }

        .bids-preview {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin: 0;
          padding: 14px;
          border: 1px solid #EEF0FF;
          border-radius: 16px;
          background: #f8f9ff;
        }

        .bid-preview-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          padding: 10px 12px;
          border-radius: 12px;
          background: white;
        }

        .bid-preview-item .creator-name {
          min-width: 0;
          overflow: hidden;
          color: #5b6bff;
          font-weight: 400;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .bid-preview-item .bid-amount {
          color: #07074E;
          font-weight: 400;
        }

        .bid-campaign-card .btn-primary {
          align-self: flex-start;
          min-width: 190px;
          justify-content: center;
        }

        .shipment-card .btn-primary,
        .shipment-card .btn-secondary {
          width: 100%;
          min-height: 42px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: auto;
          padding: 10px 16px;
          border-radius: 12px;
          font-size: 14px;
          text-align: center;
          line-height: 1.2;
        }

        .shipment-card .btn-primary svg,
        .shipment-card .btn-secondary svg {
          flex: 0 0 auto;
        }

        /* ── Manage Shipment table ── */
        .ship-toolbar{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid #e9ebf4;margin-bottom:18px;flex-wrap:wrap}
        .ship-add{display:inline-flex;align-items:center;gap:8px;background:linear-gradient(100deg,#12124f,#07074e);color:#fff;border:none;border-radius:12px;padding:10px 18px;margin-bottom:8px;font-weight:700;font-size:14px;cursor:pointer;box-shadow:0 12px 26px -12px rgba(7,7,78,.7)}
        .ship-add:hover{transform:translateY(-1px)}
        .ship-tabs{display:flex;gap:24px}
        .ship-tabs button{background:none;border:none;cursor:pointer;font-family:inherit;font-weight:600;font-size:14.5px;color:#65699b;padding:0 0 12px;position:relative}
        .ship-tabs button em{color:#9296ba;font-style:normal}
        .ship-tabs button.on{color:#5b6bff}
        .ship-tabs button.on em{color:#5b6bff}
        .ship-tabs button.on::after{content:"";position:absolute;left:0;right:0;bottom:-1px;height:3px;border-radius:3px 3px 0 0;background:linear-gradient(90deg,#5b6bff,#23236a)}
        .ship-table-card{background:#fff;border:1px solid #e9ebf4;border-radius:16px;overflow:hidden;box-shadow:0 12px 30px -16px rgba(28,30,80,.12)}
        .ship-table{width:100%;border-collapse:collapse}
        .ship-table thead th{text-align:left;font-size:11.5px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:#9296ba;padding:15px 20px;border-bottom:1px solid #eef0f7;background:#fbfbfe}
        .ship-table tbody td{padding:15px 20px;border-bottom:1px solid #f3f4fa;font-size:14px;color:#585c7e;vertical-align:middle}
        .ship-table tbody tr:last-child td{border-bottom:none}
        .ship-table tbody tr:hover{background:#fafbff}
        .ship-strong{font-weight:600;color:#15163a}
        .ship-muted{color:#9296ba}
        .ship-cr{display:inline-flex;align-items:center;gap:10px;font-weight:600;color:#15163a}
        .ship-ava{width:30px;height:30px;border-radius:50%;flex:none;overflow:hidden;display:grid;place-items:center;background:linear-gradient(135deg,#56b8ff,#5b6bff);color:#fff;font-weight:800;font-size:12px}
        .ship-ava img{width:100%;height:100%;object-fit:cover}
        .ship-status{font-weight:700;font-size:13px}
        .ship-status.delivered{color:#15a35b}
        .ship-status.transit{color:#2f8de0}
        .ship-status.ready{color:#e0851b}
        .ship-status.awaiting{color:#8a8fc0}
        .ship-status.pending{color:#d98314}
        .ship-action button{background:#fff;border:1px solid #e5e7ff;border-radius:9px;padding:7px 16px;font-weight:700;font-size:13px;color:#5b6bff;cursor:pointer;font-family:inherit}
        .ship-action button:hover{background:#eef0ff}
        @media (max-width:760px){.ship-table-card{overflow-x:auto}.ship-table{min-width:680px}}

        .creator-directory-section {
          display: flex;
          flex-direction: column;
          gap: 20px;
          max-width: 1240px;
          margin: 0 auto;
        }

        .creator-directory-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 24px 26px;
          border: 1px solid #E9EBFF;
          border-radius: 20px;
          background: white;
          box-shadow: 0 18px 42px rgba(7, 7, 78, 0.05);
        }

        .creator-directory-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          padding: 8px 12px;
          border-radius: 999px;
          background: #EEF0FF;
          color: #5b6bff;
          font-size: 12px;
          font-weight: 400;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .creator-directory-head h2 {
          margin: 0;
          color: #07074E;
          font-size: var(--fs-h2);
          line-height: 1.1;
        }

        .creator-directory-head p {
          max-width: 680px;
          margin: 10px 0 0;
          color: #6B6B9E;
          font-weight: 400;
          line-height: 1.55;
        }

        .creator-directory-sort {
          min-width: 280px;
        }

        .creator-directory-sort label {
          display: block;
          margin-bottom: 8px;
          color: #6B6B9E;
          font-size: 12px;
          font-weight: 400;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .creator-directory-sort select,
        .creator-filter-bar select {
          width: 100%;
          height: 44px;
          border: 1px solid #DDE2FF;
          border-radius: 10px;
          background: white;
          color: #07074E;
          font-weight: 400;
          outline: 0;
        }

        .creator-directory-sort select {
          padding: 0 12px;
        }

        .creator-filter-bar {
          display: grid;
          grid-template-columns: auto repeat(5, minmax(132px, 1fr)) auto;
          gap: 10px;
          align-items: center;
          padding: 14px;
          border: 1px solid #E9EBFF;
          border-radius: 16px;
          background: white;
          box-shadow: 0 12px 30px rgba(7, 7, 78, 0.04);
        }

        .creator-filter-bar > span {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: #07074E;
          font-weight: 400;
        }

        .creator-filter-bar select {
          padding: 0 10px;
        }

        .creator-filter-bar button {
          height: 44px;
          padding: 0 16px;
          border: 1px solid #DDE2FF;
          border-radius: 10px;
          background: #F8F9FF;
          color: #07074E;
          font-weight: 400;
          cursor: pointer;
        }

        .creator-directory-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 20px;
        }

        .creator-directory-card {
          display: flex;
          flex-direction: column;
          gap: 14px;
          min-height: 420px;
          padding: 18px;
          border: 1px solid #E9EBFF;
          border-radius: 20px;
          background: white;
          box-shadow: 0 16px 34px rgba(7, 7, 78, 0.06);
          transition: transform 180ms ease, box-shadow 180ms ease, border-color 180ms ease;
        }

        .creator-directory-card:hover {
          border-color: #C8CEFF;
          transform: translateY(-3px);
          box-shadow: 0 22px 44px rgba(7, 7, 78, 0.09);
        }

        .creator-card-top {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .creator-card-avatar {
          position: relative;
          width: 54px;
          height: 54px;
          overflow: hidden;
          border-radius: 16px;
          background: #EEF0FF;
          color: #5b6bff;
          font-weight: 400;
          display: grid;
          place-items: center;
        }

        .creator-card-avatar b {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          z-index: 0;
        }

        .creator-card-avatar.large {
          width: 72px;
          height: 72px;
          border-radius: 20px;
          font-size: 24px;
        }

        .creator-card-avatar img,
        .creator-portfolio-preview img {
          position: relative;
          z-index: 1;
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .creator-card-top h3 {
          margin: 0 0 8px;
          color: #07074E;
          font-size: var(--fs-h3);
          line-height: 1.25;
          word-break: break-word;
        }

        .creator-card-top span {
          display: inline-flex;
          padding: 6px 10px;
          border-radius: 999px;
          background: #EEF0FF;
          color: #5b6bff;
          font-size: 12px;
          font-weight: 400;
        }

        .creator-portfolio-preview {
          position: relative;
          height: 150px;
          overflow: hidden;
          border-radius: 14px;
          background: #F8F9FF;
          border: 1px solid #EEF0FF;
        }

        .creator-portfolio-preview > div {
          position: absolute;
          inset: 0;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          gap: 8px;
          color: #9296ba;
          font-weight: 400;
          text-align: center;
        }

        .creator-quick-stats {
          display: grid;
          gap: 8px;
          color: #4A4A77;
          font-size: 13px;
          font-weight: 400;
        }

        .creator-quick-stats span {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          line-height: 1.35;
        }

        .creator-quick-stats svg {
          flex: 0 0 auto;
          color: #5b6bff;
        }

        .creator-card-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: auto;
        }

        .creator-card-actions button {
          min-width: 0;
          height: 40px;
          padding: 0 12px;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          justify-content: center;
          border-radius: 11px;
          font-size: 13px;
          font-weight: 400;
          box-shadow: none;
          line-height: 1;
          white-space: nowrap;
        }

        .creator-card-actions button svg {
          flex: 0 0 auto;
        }

        .creator-card-actions button span {
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .creator-card-actions .btn-secondary {
          border: 1px solid #5b6bff;
          background: white;
          color: #5b6bff;
        }

        .creator-card-actions .btn-primary {
          border: 1px solid #07074e;
          background: linear-gradient(100deg,#12124f,#07074e);
          color: #fff;
          box-shadow: 0 12px 26px -12px rgba(7,7,78,.7);
        }

        .creator-directory-empty {
          display: grid;
          justify-items: center;
          gap: 10px;
          padding: 58px 24px;
          border: 1px dashed #B7B7E6;
          border-radius: 22px;
          background: white;
          color: #6B6B9E;
          text-align: center;
        }

        .creator-directory-empty h3 {
          margin: 0;
          color: #07074E;
        }

        .creator-directory-empty p {
          max-width: 520px;
          margin: 0;
          font-weight: 400;
        }

        .creator-directory-empty small {
          max-width: 640px;
          color: #9296ba;
          font-weight: 400;
        }

        .creator-profile-modal {
          max-width: 640px;
        }

        .creator-invite-modal {
          max-width: 680px;
        }

        .creator-invite-head {
          margin-bottom: 20px;
        }

        .creator-invite-head h2 {
          margin: 0 0 8px;
          color: #07074E;
        }

        .creator-invite-head p {
          margin: 0;
          color: #6B6B9E;
          font-weight: 400;
          line-height: 1.5;
        }

        .creator-invite-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .creator-profile-modal-head {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 20px;
        }

        .creator-profile-modal-head h2 {
          margin: 0 0 6px;
          color: #07074E;
        }

        .creator-profile-modal-head p {
          margin: 0;
          color: #5b6bff;
          font-weight: 400;
        }

        .creator-profile-modal-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
          margin-bottom: 18px;
        }

        .creator-profile-modal-grid div {
          padding: 14px;
          border-radius: 14px;
          background: #F8F9FF;
          border: 1px solid #E9EBFF;
        }

        .creator-profile-modal-grid small,
        .creator-profile-modal-grid strong {
          display: block;
        }

        .creator-profile-modal-grid small {
          margin-bottom: 6px;
          color: #9296ba;
          font-weight: 400;
        }

        .creator-profile-modal-grid strong {
          color: #07074E;
        }

        .creator-profile-modal-preview {
          height: 220px;
          overflow: hidden;
          display: grid;
          place-items: center;
          margin-bottom: 18px;
          border-radius: 16px;
          background: #F8F9FF;
          color: #9296ba;
          font-weight: 400;
        }

        .creator-profile-modal-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .wallet-section {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 400px;
          gap: 28px;
          align-items: start;
        }

        .wallet-main-column,
        .wallet-side-column {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        /* Transaction History spans the full width below the two columns */
        .wallet-history-full { grid-column: 1 / -1; }

        .wallet-hero-card {
          display: flex;
          justify-content: space-between;
          gap: 24px;
          padding: 24px;
          border-radius: 20px;
          color: white;
          background: linear-gradient(135deg, #080866 0%, #171184 48%, #3938b8 100%);
          box-shadow: 0 16px 40px rgba(7, 7, 78, 0.16);
        }

        .wallet-kicker {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: rgba(255, 255, 255, 0.7);
          font-weight: 400;
          letter-spacing: 0.02em;
          text-transform: uppercase;
        }

        .wallet-hero-card p {
          margin: 18px 0 6px;
          color: rgba(255, 255, 255, 0.66);
          font-weight: 400;
        }

        .wallet-hero-card h2 {
          margin: 0;
          font-size: 36px;
          font-weight: 600;
          line-height: 1;
          color: white;
        }

        .wallet-hero-card small {
          display: block;
          margin-top: 14px;
          color: rgba(255, 255, 255, 0.72);
          font-weight: 400;
        }

        .wallet-hero-side {
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-width: 234px;
          align-self: center;
        }

        .whs-panel {
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          overflow: hidden;
        }

        .whs-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 10px 15px;
        }
        .whs-row + .whs-row {
          border-top: 1px solid rgba(255, 255, 255, 0.09);
        }
        .whs-row span {
          color: rgba(255, 255, 255, 0.58);
          font-size: 12.5px;
        }
        .whs-row strong {
          color: #fff;
          font-size: 13.5px;
          font-weight: 600;
        }
        .whs-row b {
          font-size: 13px;
          font-weight: 700;
        }
        .whs-row b.ok { color: #4ade80; }
        .whs-row b.warn { color: #fbbf24; }

        .wallet-hero-cta {
          width: 100%;
          padding: 12px 22px;
          border-radius: 13px;
          border: 0;
          background: #fff;
          color: #171184;
          font-weight: 700;
          font-size: 14px;
          cursor: pointer;
          font-family: inherit;
          transition: transform 160ms ease, box-shadow 160ms ease;
        }
        .wallet-hero-cta:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 26px -10px rgba(0, 0, 0, 0.55);
        }

        .wallet-warning {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px 24px;
          border: 1px solid #F59E0B;
          border-radius: 18px;
          background: #FFF8E8;
          color: #B86B00;
        }

        .wallet-warning div {
          flex: 1;
        }

        .wallet-warning p {
          margin: 4px 0 0;
          font-weight: 400;
        }

        .wallet-warning button {
          border: 0;
          border-radius: 14px;
          padding: 12px 18px;
          background: #F59E0B;
          color: white;
          font-weight: 400;
          cursor: pointer;
        }

        .wallet-panel {
          padding: 28px 32px;
          border-radius: 24px;
          background: white;
          box-shadow: 0 16px 34px rgba(7, 7, 78, 0.06);
        }

        .wallet-panel h2 {
          margin: 0;
          color: #07074E;
          font-size: var(--fs-h2);
        }

        .wallet-panel p {
          color: #9296ba;
          font-weight: 400;
        }

        .wallet-bonus-tiers {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 22px;
          align-items: start;
        }

        .wallet-bonus-tiers > span {
          padding: 9px 14px;
          border-radius: 999px;
          background: #EEF0FF;
          color: #5b6bff;
          font-weight: 400;
        }

        .wallet-tier-grid {
          grid-column: 1 / -1;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px;
        }

        .wallet-tier-grid button,
        .wallet-presets button {
          border: 0;
          border-radius: 14px;
          background: #f6f7fc;
          color: #5b6bff;
          font-weight: 400;
          cursor: pointer;
        }

        .wallet-tier-grid button {
          padding: 14px 12px;
          text-align: left;
        }

        .wallet-tier-grid strong,
        .wallet-tier-grid small {
          display: block;
          white-space: nowrap;
        }

        .wallet-tier-grid small {
          margin-top: 6px;
          color: #15a35b;
          font-size: 14px;
          font-weight: 700;
        }

        .wallet-history {
          padding: 0;
          overflow: hidden;
        }

        .wallet-history-head {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding: 28px 32px;
          border-bottom: 1px solid #EEF0FF;
        }

        .wallet-filter-tabs {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .wallet-filter-tabs button {
          border: 0;
          border-radius: 999px;
          padding: 10px 18px;
          background: #f6f7fc;
          color: #9296ba;
          font-weight: 400;
          cursor: pointer;
        }

        .wallet-filter-tabs button.active {
          background: #07074E;
          color: white;
        }

        .wallet-table {
          padding: 0 32px 24px;
        }

        .wallet-row {
          display: grid;
          grid-template-columns: 1fr 1.2fr 1.5fr 1fr 0.9fr;
          gap: 18px;
          align-items: center;
          padding: 16px 0;
          border-bottom: 1px solid #EEF0FF;
          color: #6B6B9E;
          font-weight: 400;
        }

        .wallet-head {
          color: #9296ba;
          text-transform: uppercase;
          font-size: 12px;
          letter-spacing: 0.04em;
        }

        .wallet-credit {
          color: #27AE60;
          white-space: nowrap;
        }

        .wallet-debit {
          color: #E11D48;
          white-space: nowrap;
        }

        .wallet-status {
          justify-self: start;
          padding: 7px 11px;
          border-radius: 999px;
          background: #EEF0FF;
          color: #5b6bff;
          font-size: 12px;
          font-weight: 400;
          text-transform: capitalize;
        }

        .wallet-status.success {
          background: #E8F8EE;
          color: #27AE60;
        }

        .wallet-status.failed {
          background: #FEE2E2;
          color: #DC2626;
        }

        .wallet-empty {
          padding: 36px;
          color: #9296ba;
          font-weight: 400;
          text-align: center;
        }

        .wallet-side-title {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          margin-bottom: 28px;
        }

        .wallet-side-title button,
        .wallet-side-title span {
          width: 36px;
          height: 36px;
          display: grid;
          place-items: center;
          border: 0;
          border-radius: 50%;
          background: #EEF0FF;
          color: #5b6bff;
        }

        .wallet-recharge-card label {
          display: block;
          margin-bottom: 12px;
          color: #9296ba;
          font-weight: 400;
          text-transform: uppercase;
          font-size: 12px;
          letter-spacing: 0.05em;
        }

        .wallet-amount-input {
          height: 54px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 0 18px;
          border: 1px solid #DDE2FF;
          border-radius: 16px;
          background: #F8F9FF;
          color: #07074E;
        }

        .wallet-amount-input input {
          width: 100%;
          border: 0;
          outline: 0;
          background: transparent;
          color: #07074E;
          font-weight: 400;
        }

        .wallet-presets {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin: 18px 0 22px;
        }

        .wallet-presets button {
          height: 42px;
        }

        .wallet-add-funds {
          width: 100%;
          height: 50px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border: 0;
          border-radius: 15px;
          background: linear-gradient(100deg, #12124f, #07074e);
          color: white;
          font-weight: 400;
          cursor: pointer;
          box-shadow: 0 16px 30px rgba(7, 7, 78, 0.28);
        }

        .wallet-add-funds:disabled {
          opacity: 0.65;
          cursor: wait;
        }

        .wallet-recharge-card > small {
          display: block;
          margin-top: 14px;
          color: #B7B7E6;
          text-align: center;
          font-weight: 400;
        }

        .wallet-progress-body {
          display: grid;
          grid-template-columns: 112px 1fr;
          gap: 20px;
          align-items: center;
        }

        .wallet-progress-ring {
          width: 110px;
          height: 110px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          background:
            radial-gradient(circle at center, white 58%, transparent 60%),
            conic-gradient(#6677FF var(--wallet-progress), #EEF0FF 0);
          color: #07074E;
        }

        .wallet-progress-ring strong {
          font-size: 20px;
        }

        .wallet-progress-body h3 {
          margin: 6px 0;
          color: #5b6bff;
          font-size: 28px;
        }

        .wallet-progress-body span,
        .wallet-progress-track small {
          color: #9296ba;
          font-weight: 400;
        }

        .wallet-progress-track {
          margin-top: 22px;
        }

        .wallet-progress-track div {
          display: flex;
          justify-content: space-between;
          color: #B7B7E6;
          font-weight: 400;
          font-size: 12px;
        }

        .wallet-progress-track i {
          display: block;
          height: 10px;
          margin: 12px 0;
          overflow: hidden;
          border-radius: 999px;
          background: #EEF0FF;
        }

        .wallet-progress-track b {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: #9296ba;
        }

        .work-review-section {
          display: flex;
          flex-direction: column;
          gap: 22px;
        }

        .work-review-hero {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          padding: 34px 32px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 26px;
          overflow: hidden;
          background:
            radial-gradient(circle at 88% -10%, rgba(123, 145, 255, 0.55), transparent 42%),
            radial-gradient(circle at 0% 120%, rgba(48, 213, 200, 0.28), transparent 45%),
            linear-gradient(120deg, #1b1d52 0%, #2b2f86 55%, #4350c7 100%);
          box-shadow: 0 26px 60px -24px rgba(33, 38, 120, 0.7);
        }

        .work-review-hero::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image: radial-gradient(rgba(255, 255, 255, 0.12) 1px, transparent 1px);
          background-size: 22px 22px;
          opacity: 0.4;
          pointer-events: none;
        }

        .work-review-hero > div { position: relative; z-index: 1; }

        .work-review-kicker {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 14px;
          padding: 8px 14px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.14);
          border: 1px solid rgba(255, 255, 255, 0.18);
          color: #dfe3ff;
          font-size: 12px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          backdrop-filter: blur(6px);
        }

        .work-review-hero h2 {
          margin: 0;
          color: #ffffff;
          font-size: var(--fs-h2);
          line-height: 1.05;
        }

        .work-review-hero p {
          margin: 12px 0 0;
          color: rgba(225, 228, 255, 0.78);
          font-weight: 400;
          max-width: 560px;
          line-height: 1.55;
        }

        .work-review-refresh {
          position: relative;
          z-index: 1;
          min-height: 46px;
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 0 20px;
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.95);
          color: #1b1d52;
          font-weight: 600;
          cursor: pointer;
          box-shadow: 0 12px 26px -10px rgba(7, 7, 78, 0.5);
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }

        .work-review-refresh:hover {
          transform: translateY(-1px);
          box-shadow: 0 16px 30px -10px rgba(7, 7, 78, 0.55);
        }

        .work-review-refresh:hover svg { animation: wr-spin 0.9s linear infinite; }

        @keyframes wr-spin { to { transform: rotate(360deg); } }

        .work-review-stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }

        .work-review-stats > div {
          position: relative;
          display: grid;
          grid-template-columns: 50px 1fr auto;
          align-items: center;
          gap: 14px;
          padding: 20px;
          border: 1px solid #E9EBFF;
          border-radius: 20px;
          background: white;
          box-shadow: 0 14px 30px rgba(7, 7, 78, 0.04);
          overflow: hidden;
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
        }

        .work-review-stats > div::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 4px;
          background: var(--wr-accent, #5b6bff);
        }

        .work-review-stats > div:hover {
          transform: translateY(-3px);
          border-color: #d3d9ff;
          box-shadow: 0 22px 40px -16px rgba(7, 7, 78, 0.18);
        }

        .work-review-stats > div:nth-child(1) { --wr-accent: #5b6bff; }
        .work-review-stats > div:nth-child(2) { --wr-accent: #f0a020; }
        .work-review-stats > div:nth-child(3) { --wr-accent: #27AE60; }

        .work-review-stats span {
          display: grid;
          place-items: center;
          width: 50px;
          height: 50px;
          border-radius: 15px;
          background: color-mix(in srgb, var(--wr-accent, #5b6bff) 14%, white);
          color: var(--wr-accent, #5b6bff);
        }

        .work-review-stats p {
          margin: 0;
          color: #9296ba;
          font-weight: 500;
        }

        .work-review-stats strong {
          color: #07074E;
          font-size: 28px;
          font-weight: 700;
        }

        .work-review-empty {
          min-height: 320px;
          display: grid;
          place-items: center;
          align-content: center;
          gap: 12px;
          padding: 48px 40px;
          border: 1px solid #E9EBFF;
          border-radius: 24px;
          background:
            radial-gradient(circle at 50% 0%, rgba(39, 174, 96, 0.07), transparent 55%),
            white;
          text-align: center;
          box-shadow: 0 18px 42px rgba(7, 7, 78, 0.05);
        }

        .work-review-empty > span {
          display: grid;
          place-items: center;
          width: 92px;
          height: 92px;
          border-radius: 26px;
          background: #E8F8EE;
          color: #27AE60;
          box-shadow: 0 0 0 10px rgba(39, 174, 96, 0.06);
        }

        .work-review-empty h3 {
          margin: 8px 0 0;
          color: #07074E;
          font-size: var(--fs-h3);
        }

        .work-review-empty p {
          max-width: 430px;
          color: #9296ba;
          font-weight: 400;
          line-height: 1.55;
        }

        .work-review-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .work-review-card {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 210px;
          gap: 22px;
          padding: 22px;
          border: 1px solid #E9EBFF;
          border-radius: 22px;
          background: white;
          box-shadow: 0 16px 34px rgba(7, 7, 78, 0.05);
        }

        .work-review-card-top {
          display: flex;
          align-items: flex-start;
          gap: 14px;
        }

        .work-campaign-mark {
          display: grid;
          place-items: center;
          width: 52px;
          height: 52px;
          flex: 0 0 auto;
          border-radius: 16px;
          background: #07074E;
          color: white;
          font-weight: 400;
          font-size: 20px;
        }

        .work-review-card h3 {
          margin: 0;
          color: #07074E;
          font-size: var(--fs-h3);
        }

        .work-review-card-top p {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px 12px;
          margin: 8px 0 0;
          color: #9296ba;
          font-weight: 400;
        }

        .work-review-card-top p strong {
          color: #07074E;
        }

        .work-review-status {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          margin-left: auto;
          padding: 8px 12px;
          border-radius: 999px;
          background: #FFF8E8;
          color: #F59E0B;
          font-size: 12px;
          font-weight: 400;
          white-space: nowrap;
        }

        .work-review-description {
          margin: 18px 0;
          padding: 16px;
          border-radius: 16px;
          background: #F8F9FF;
          color: #4B4B87;
          line-height: 1.6;
          font-weight: 400;
        }

        .work-review-files {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }

        .work-review-files a,
        .work-review-more,
        .work-review-no-files {
          min-height: 38px;
          display: inline-flex;
          align-items: center;
          gap: 9px;
          max-width: 260px;
          padding: 0 12px;
          border: 1px solid #E2E4F0;
          border-radius: 12px;
          background: white;
          color: #07074E;
          text-decoration: none;
          font-size: 13px;
          font-weight: 400;
        }

        .work-review-files a span {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .work-review-more,
        .work-review-no-files {
          color: #9296ba;
          background: #F8F9FF;
        }

        .work-review-card-side {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding-left: 20px;
          border-left: 1px solid #EEF0FF;
        }

        .work-review-card-side div {
          padding: 12px;
          border-radius: 14px;
          background: #F8F9FF;
        }

        .work-review-card-side small,
        .work-review-card-side strong {
          display: block;
        }

        .work-review-card-side small {
          color: #9296ba;
          font-weight: 400;
          text-transform: uppercase;
          font-size: 11px;
        }

        .work-review-card-side strong {
          margin-top: 4px;
          color: #07074E;
          font-size: 18px;
        }

        .work-review-primary {
          min-height: 46px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          margin-top: auto;
          border: 0;
          border-radius: 13px;
          background: linear-gradient(100deg,#12124f,#07074e);
          color: #fff;
          font-weight: 400;
          cursor: pointer;
          box-shadow: 0 12px 26px -12px rgba(7,7,78,.7);
        }

        .creator-name {
          color: #5b6bff;
          font-weight: 400;
        }

        .bid-amount {
          font-weight: 400;
          color: #1a202c;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-content {
          background: white;
          padding: 40px;
          border-radius: 24px;
          max-width: 700px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
        }

        .modal-content h2 {
          font-size: var(--fs-h2);
          font-weight: var(--fw-head);
          color: #1a202c;
          margin-bottom: 32px;
        }

        .campaign-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        /* campaign banner / image upload */
        .campaign-img-drop {
          display: block; position: relative; cursor: pointer; border-radius: 14px; overflow: hidden;
          border: 1.5px dashed #cdd2f3; background: linear-gradient(140deg, #f7f8ff, #f2f3ff); transition: border-color .15s, background .15s;
        }
        .campaign-img-drop:hover { border-color: #5b6bff; background: #eef0ff; }
        .campaign-img-empty { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; padding: 26px 18px; color: #5b6bff; }
        .campaign-img-empty strong { color: #07074e; font-size: 14.5px; }
        .campaign-img-empty small { color: #8a8fc0; font-weight: 500; font-size: 12.5px; }
        .campaign-img-preview { display: block; width: 100%; height: 150px; object-fit: cover; }
        .campaign-img-change { position: absolute; bottom: 10px; right: 12px; background: rgba(7,7,78,.72); color: #fff;
          font-size: 12px; font-weight: 600; padding: 6px 12px; border-radius: 20px; backdrop-filter: blur(4px); }

        .objective-input-wrapper {
          display: flex;
          gap: 12px;
        }

        .objective-input-wrapper .input-field {
          flex: 1;
        }

        .objectives-list {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 12px;
        }

        .objective-tag {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: linear-gradient(135deg, #5b6bff 0%, #764ba2 100%);
          color: white;
          border-radius: 20px;
          font-size: 0.875rem;
          font-weight: 400;
        }

        .objective-tag button {
          background: none;
          border: none;
          color: white;
          font-size: 1.25rem;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }

        .budget-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .checkbox-label {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 0.95rem;
          color: #2d3748;
          cursor: pointer;
        }

        .checkbox-label input[type="checkbox"] {
          width: 20px;
          height: 20px;
          cursor: pointer;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          margin-top: 8px;
        }

        .modal-actions button {
          flex: 1;
        }

        /* Approval Page Styles */
        .approval-page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          background: linear-gradient(135deg, #f8f9ff 0%, #e8ecff 100%);
        }

        .approval-header {
          background: white;
          border-bottom: 2px solid #e2e8f0;
          padding: 20px 8%;
          position: sticky;
          top: 0;
          z-index: 100;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }

        .header-container {
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .logo-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logo-icon {
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, #5b6bff 0%, #764ba2 100%);
          color: white;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 400;
          font-size: 1rem;
        }

        .logo-text {
          font-size: 1.25rem;
          font-weight: 400;
          color: #1a202c;
        }

        .header-logout-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: white;
          border: 2px solid #e2e8f0;
          border-radius: 8px;
          color: #4a5568;
          font-weight: 400;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .header-logout-btn:hover {
          border-color: #5b6bff;
          color: #5b6bff;
        }

        .approval-content {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
        }

        .approval-card {
          background: white;
          padding: 60px 48px;
          border-radius: 24px;
          max-width: 800px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
          text-align: center;
        }

        .icon-wrapper {
          margin-bottom: 24px;
        }

        .pending-icon {
          color: #5b6bff;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }

        .approval-card h1 {
          font-size: 2.5rem;
          font-weight: 400;
          color: #1a202c;
          margin-bottom: 12px;
        }

        .subtitle {
          font-size: 1.125rem;
          color: #718096;
          margin-bottom: 40px;
        }

        .info-box {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 24px;
          margin-bottom: 40px;
          padding: 32px;
          background: #f8f9ff;
          border-radius: 16px;
        }

        .info-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          text-align: center;
        }

        .info-icon {
          width: 56px;
          height: 56px;
          background: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.75rem;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        .info-item h3 {
          font-size: 1rem;
          font-weight: 400;
          color: #2d3748;
          margin-bottom: 4px;
        }

        .info-item p {
          font-size: 0.875rem;
          color: #718096;
        }

        .status-message {
          padding: 24px;
          background: #e0e7ff;
          border-radius: 12px;
          margin-bottom: 32px;
          border-left: 4px solid #5b6bff;
        }

        .status-message p {
          color: #3730a3;
          line-height: 1.6;
          margin: 0;
        }

        .approval-footer {
          background: white;
          border-top: 2px solid #e2e8f0;
          padding: 48px 8% 24px;
          margin-top: auto;
        }

        .footer-container {
          max-width: 1400px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 40px;
          margin-bottom: 32px;
        }

        .footer-section h4 {
          font-size: 1.125rem;
          font-weight: 400;
          color: #1a202c;
          margin-bottom: 16px;
        }

        .footer-section p {
          color: #718096;
          line-height: 1.8;
          margin-bottom: 8px;
        }

        .footer-bottom {
          max-width: 1400px;
          margin: 0 auto;
          padding-top: 24px;
          border-top: 1px solid #e2e8f0;
          text-align: center;
          color: #a0aec0;
          font-size: 0.875rem;
        }

        @media (max-width: 768px) {
          .dashboard-page {
            flex-direction: column;
          }

          .business-sidebar {
            width: 100%;
            min-height: auto;
            position: static;
            border-radius: 0;
            padding: 20px;
            gap: 20px;
          }

          .business-sidebar-brand {
            margin-bottom: 20px;
          }

          .business-sidebar-nav {
            flex-direction: row;
            overflow-x: auto;
            padding-bottom: 4px;
          }

          .business-nav-label,
          .business-sidebar-profile {
            display: none;
          }

          .business-nav-item {
            width: auto;
            flex: 0 0 auto;
          }

          .header-content {
            flex-direction: column;
            gap: 20px;
            align-items: flex-start;
          }

          .header-actions {
            width: 100%;
            flex-wrap: wrap;
          }

          .header-actions button {
            flex: 1;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .campaigns-grid {
            grid-template-columns: 1fr;
          }

          .creator-directory-grid,
          .creator-filter-bar,
          .creator-card-actions {
            grid-template-columns: 1fr;
          }

          .creator-directory-head h2 {
            font-size: 26px;
          }

          .wallet-hero-card,
          .wallet-history-head,
          .wallet-warning {
            flex-direction: column;
            align-items: stretch;
          }

          .wallet-hero-side {
            min-width: 0;
            align-self: stretch;
          }

          .wallet-hero-card h2 {
            font-size: 42px;
          }

          .wallet-hero-badges {
            align-items: flex-start;
          }

          .wallet-side-column,
          .wallet-tier-grid,
          .wallet-presets,
          .wallet-progress-body {
            grid-template-columns: 1fr;
          }

          .wallet-row {
            grid-template-columns: 1fr;
            gap: 6px;
          }

          .actions-grid {
            grid-template-columns: 1fr 1fr;
          }

          .budget-row {
            grid-template-columns: 1fr;
          }

          .tabs {
            gap: 4px;
            padding: 16px 16px 0;
          }

          .tab {
            padding: 10px 16px;
            font-size: 0.9rem;
          }

          .tab-content {
            padding: 24px 16px;
          }
        }

        /* =========================================================
           BRAND UI — polished compact redesign overlay
           Scoped to .dashboard-page; matches the Creator workspace.
           ========================================================= */
        .dashboard-page {
          --bz-navy: #0c0c38;
          --bz-ink: #15163a;
          --bz-ink-2: #585c7e;
          --bz-muted: #9296ba;
          --bz-brand: #5b6bff;
          --bz-brand-strong: #4452f0;
          --bz-brand-soft: #eef0ff;
          --bz-ring: rgba(91, 107, 255, 0.16);
          --bz-surface: #ffffff;
          --bz-canvas: #f6f7fc;
          --bz-line: #e9ebf4;
          --bz-sh-xs: 0 1px 2px rgba(18, 22, 60, .05);
          --bz-sh-sm: 0 1px 2px rgba(18, 22, 60, .05), 0 2px 6px rgba(18, 22, 60, .04);
          --bz-sh-md: 0 8px 24px -14px rgba(18, 22, 60, .22);
          --bz-sh-lg: 0 18px 48px -22px rgba(18, 22, 60, .28);
          background: var(--bz-canvas);
          font-size: 13.5px;
        }
        .dashboard-page .business-main { background: var(--bz-canvas); }

        /* Sidebar */
        .dashboard-page .business-sidebar {
          width: 248px;
          padding: 22px 16px;
          border-radius: 0;
          background: linear-gradient(190deg, #101046 0%, #0a0a30 100%);
        }
        .dashboard-page .business-sidebar-brand { font-size: 17px; font-weight: 700; margin-bottom: 26px; }
        .dashboard-page .business-sidebar-mark {
          width: 34px; height: 34px; border-radius: 10px; font-weight: 700;
          background: linear-gradient(140deg, var(--bz-brand), var(--bz-brand-strong));
          box-shadow: 0 6px 16px -6px rgba(91, 107, 255, .7);
        }
        .dashboard-page .business-sidebar-nav { gap: 3px; }
        .dashboard-page .business-nav-label {
          color: rgba(255, 255, 255, .42); font-size: 10.5px; font-weight: 600;
          letter-spacing: .12em; padding: 0 12px 8px;
        }
        .dashboard-page .business-nav-item {
          gap: 12px; padding: 10px 12px; border-radius: 10px;
          color: rgba(255, 255, 255, .66); font-size: 13.5px; font-weight: 500;
          transition: background-color 160ms ease, color 160ms ease;
        }
        .dashboard-page .business-nav-item:hover { background: rgba(255, 255, 255, .07); color: #fff; }
        .dashboard-page .business-nav-item.active {
          color: #fff; font-weight: 600;
          background: linear-gradient(100deg, rgba(91, 107, 255, .92), rgba(68, 82, 240, .85));
          box-shadow: 0 8px 20px -10px rgba(91, 107, 255, .9);
        }
        .dashboard-page .business-nav-badge {
          min-width: 18px; height: 18px; font-size: 11px; font-weight: 600; background: var(--bz-brand);
        }
        .dashboard-page .business-sidebar-profile {
          margin-top: 16px; padding: 12px; border-top: 0; border-radius: 13px;
          background: rgba(255, 255, 255, .05); border: 1px solid rgba(255, 255, 255, .07);
        }
        .dashboard-page .business-sidebar-profile span { color: rgba(255, 255, 255, .5); }
        .dashboard-page .business-avatar,
        .dashboard-page .brand-profile-photo {
          background: linear-gradient(140deg, var(--bz-brand), var(--bz-brand-strong));
        }

        /* Header / topbar */
        .dashboard-page .dashboard-header h1 { color: var(--bz-ink); }
        .dashboard-page .dashboard-header p { color: var(--bz-ink-2); }
        .dashboard-page .brand-breadcrumb { color: var(--bz-muted); }
        .dashboard-page .brand-round-action,
        .dashboard-page .brand-profile-photo {
          width: 40px; height: 40px; border-color: var(--bz-line); box-shadow: var(--bz-sh-xs);
        }
        .dashboard-page .brand-round-action:hover {
          border-color: var(--bz-ring); background: var(--bz-brand-soft); color: var(--bz-brand-strong);
        }

        /* Unified card / panel surfaces */
        .dashboard-page .brand-metric-card,
        .dashboard-page .brand-panel,
        .dashboard-page .performance-panel,
        .dashboard-page .funnel-panel,
        .dashboard-page .top-campaigns-panel,
        .dashboard-page .active-deals-panel,
        .dashboard-page .pending-actions-panel,
        .dashboard-page .budget-panel,
        .dashboard-page .quick-actions-panel,
        .dashboard-page .post-brief-card,
        .dashboard-page .drafts-panel,
        .dashboard-page .stat-card,
        .dashboard-page .quick-actions,
        .dashboard-page .campaign-card,
        .dashboard-page .campaign-card-detailed,
        .dashboard-page .bid-campaign-card,
        .dashboard-page .shipment-card,
        .dashboard-page .creator-directory-card,
        .dashboard-page .wallet-panel,
        .dashboard-page .work-review-card {
          border: 1px solid var(--bz-line);
          border-radius: 16px;
          box-shadow: var(--bz-sh-sm);
        }
        .dashboard-page .stat-card:hover,
        .dashboard-page .brand-metric-card:hover,
        .dashboard-page .campaign-card-detailed:hover,
        .dashboard-page .creator-directory-card:hover {
          transform: translateY(-2px);
          border-color: var(--bz-ring);
          box-shadow: var(--bz-sh-md);
        }

        /* KPI stat cards — compact. Scoped to .stat-card so it does NOT hit the
           campaign-card stat tiles, which reuse .stat-value (caused giant budget text). */
        .dashboard-page .stat-card { padding: 18px; gap: 16px; }
        .dashboard-page .stat-card .stat-icon { width: 50px; height: 50px; border-radius: 13px; }
        .dashboard-page .stat-card .stat-value { font-size: 1.5rem; font-weight: 700; }

        /* Campaign stat tiles (Budget / Bids / Posted) — keep compact, no balloon/wrap */
        .dashboard-page .all-campaigns-section .campaign-stats { gap: 10px; }
        .dashboard-page .all-campaigns-section .stat {
          padding: 11px 12px; border-radius: 12px;
          background: #f6f7fc; border: 1px solid var(--bz-line);
        }
        .dashboard-page .all-campaigns-section .stat-label {
          font-size: 10.5px; font-weight: 600; letter-spacing: .04em; color: var(--bz-muted);
        }
        .dashboard-page .all-campaigns-section .stat-value {
          font-size: 13.5px; font-weight: 600; line-height: 1.3; margin-top: 3px;
          color: var(--bz-ink); white-space: normal; overflow-wrap: anywhere;
        }
        .dashboard-page .all-campaigns-section .campaign-card-detailed { min-height: 0; }

        /* Status chip — previously had no color classes, so it rendered as plain text */
        .dashboard-page .badge {
          display: inline-flex; align-items: center;
          padding: 5px 11px; border-radius: 999px;
          font-size: 11.5px; font-weight: 600; line-height: 1;
          text-transform: capitalize; white-space: nowrap;
          background: var(--bz-brand-soft); color: var(--bz-brand-strong);
          border: 1px solid var(--bz-ring);
        }
        .dashboard-page .badge-active,
        .dashboard-page .badge-completed,
        .dashboard-page .badge-approved,
        .dashboard-page .badge-paid {
          background: #e7f6ee; color: #15a35b; border-color: rgba(21, 163, 91, .2);
        }
        .dashboard-page .badge-in-progress,
        .dashboard-page .badge-work-submitted,
        .dashboard-page .badge-live {
          background: var(--bz-brand-soft); color: var(--bz-brand-strong); border-color: var(--bz-ring);
        }
        .dashboard-page .badge-pending,
        .dashboard-page .badge-draft,
        .dashboard-page .badge-paused,
        .dashboard-page .badge-revision {
          background: #fdf2e0; color: #d98314; border-color: rgba(217, 131, 20, .2);
        }
        .dashboard-page .badge-rejected,
        .dashboard-page .badge-cancelled,
        .dashboard-page .badge-disputed {
          background: #fdeaef; color: #e11d48; border-color: rgba(225, 29, 72, .2);
        }

        /* Buttons */
        .dashboard-page .action-btn {
          padding: 18px; border-width: 1px; border-color: var(--bz-line); border-radius: 13px;
          background: var(--bz-surface); color: var(--bz-ink); font-weight: 600;
        }
        .dashboard-page .action-btn:hover {
          border-color: var(--bz-ring); background: var(--bz-brand-soft);
          color: var(--bz-brand-strong); box-shadow: var(--bz-sh-md); transform: translateY(-2px);
        }
        .dashboard-page .review-btn {
          background: linear-gradient(135deg, var(--bz-brand), var(--bz-brand-strong));
          border-color: transparent; color: #fff; box-shadow: 0 8px 18px -8px rgba(91, 107, 255, .7);
        }

        /* Inputs */
        .dashboard-page input:not([type="checkbox"]):not([type="radio"]),
        .dashboard-page select,
        .dashboard-page textarea { border-radius: 10px; }
        .dashboard-page input:focus,
        .dashboard-page select:focus,
        .dashboard-page textarea:focus {
          border-color: var(--bz-brand);
          box-shadow: 0 0 0 3px var(--bz-ring);
          outline: none;
        }

        /* Modal */
        .dashboard-page .modal-content { border-radius: 16px; box-shadow: var(--bz-sh-lg); }

        /* Brand top-nav compat: neutralize the old sidebar-layout widths */
        .cmk-app .business-main.bd-topnav-main{width:auto;max-width:none;min-height:auto;padding:0;margin:0;background:transparent}
        .cmk-app .bd-topnav-title{margin:0 0 18px}
        .cmk-app .bd-topnav-title h1{font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:32px;font-weight:800;letter-spacing:-.6px;color:#15163a}
        .cmk-app .bd-topnav-title p{color:#585c7e;font-size:15px;margin-top:6px}
        .cmk-app .dashboard-content{padding:0;width:auto;max-width:none}
      `}</style>

      {chatWith && <ChatPopup user={chatWith} onClose={() => setChatWith(null)} />}

      {modalView && (
        <PageModal onClose={() => setModalView(null)} bare={modalView.type === 'campaign'} drawer={modalView.type === 'shipment'} maxWidth={modalView.type === 'campaign' ? 900 : modalView.type === 'shipment' ? 560 : 1100}>
          {modalView.type === 'campaign' && <CampaignDetails embedId={modalView.id} onClose={() => setModalView(null)} />}
          {modalView.type === 'review' && <WorkReview embedId={modalView.id} onClose={() => setModalView(null)} />}
          {modalView.type === 'shipment' && <ShipmentTracking embedCampaignId={modalView.id} autoShip={modalView.ship} onClose={() => setModalView(null)} />}
        </PageModal>
      )}

      {profileView && (
        <CreatorProfileModal
          id={profileView.id}
          fallbackName={profileView.name}
          photo={profileView.photo}
          onClose={() => setProfileView(null)}
          onMessage={() => { const cid = profileView.id; setProfileView(null); navigate(`/messages?conv=${cid}`); }}
        />
      )}
    </BrandTopNavLayout>
  );
}
