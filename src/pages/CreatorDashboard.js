import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { digitsOnly, blockNonDigitKey } from '../utils/inputValidators';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import CreatorHero from '../components/CreatorHero';
import RejectedGate from '../components/RejectedGate';
import { CONTENT_CATEGORIES } from '../constants/contentCategories';
import { toggleSavedBrief, isBriefSaved } from '../utils/savedBriefs';
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Bookmark,
  Briefcase,
  CalendarClock,
  CheckCircle,
  ClipboardList,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  Filter,
  FileCheck,
  Image as ImageIcon,
  IndianRupee,
  LayoutDashboard,
  LayoutGrid,
  List,
  LogOut,
  MapPin,
  MessageCircle,
  MessageSquare,
  Package,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Trophy,
  Upload,
  User,
  Video,
  Wallet,
  Zap
} from 'lucide-react';
import './CreatorDashboard.css';
import { isSelectedCreator, isOpenForBids } from '../utils/campaignCreators';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const browseCovers = [
  'https://images.unsplash.com/photo-1581182800629-7d90925ad072?auto=format&fit=crop&q=80&w=800&h=520',
  'https://images.unsplash.com/photo-1558002038-1055907df827?auto=format&fit=crop&q=80&w=800&h=520',
  'https://images.unsplash.com/photo-1645318801217-143533cb559f?auto=format&fit=crop&q=80&w=800&h=520',
  'https://images.unsplash.com/photo-1663958749441-926bbef7cd0c?auto=format&fit=crop&q=80&w=800&h=520',
  'https://images.unsplash.com/photo-1491637639811-60e2756cc1c7?auto=format&fit=crop&q=80&w=800&h=520',
  'https://images.unsplash.com/photo-1580635766551-5e3a8ca8b21d?auto=format&fit=crop&q=80&w=800&h=520'
];

const browseLogos = [
  'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?auto=format&fit=crop&q=80&w=128&h=128',
  'https://images.unsplash.com/photo-1546868871-7041f2a55e12?auto=format&fit=crop&q=80&w=128&h=128',
  'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&q=80&w=128&h=128',
  'https://images.unsplash.com/photo-1559525839-b184a4d698c7?auto=format&fit=crop&q=80&w=128&h=128'
];

const formatMoney = (value) => {
  const amount = Number(value || 0);
  return `Rs. ${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
};

const getCampaignBudget = (campaign) => {
  if (!campaign) return 'Rs. 0';
  const min = campaign.budget_min ?? campaign.budget ?? campaign.myBid?.amount ?? 0;
  const max = campaign.budget_max ?? min;
  return min === max ? formatMoney(min) : `${formatMoney(min)} - ${formatMoney(max)}`;
};

const getInitial = (name) => (name || 'U').trim().charAt(0).toUpperCase();

const getLevelInfo = (completedWorks) => {
  if (completedWorks >= 20) {
    return {
      badge: 'L2 (Pro)',
      level: 'L2 Professional',
      color: '#07074e',
      subtitle: 'Promo Eligible',
      nextLevel: null,
      currentWorks: completedWorks,
      nextWorks: null,
      benefits: '10% Higher Base Rates & Premium Support'
    };
  }
  if (completedWorks >= 10) {
    return {
      badge: 'L1 (Rising)',
      level: 'L1 Rising Star',
      color: '#27ae60',
      subtitle: 'Verified',
      nextLevel: 'L2 Professional',
      currentWorks: completedWorks,
      nextWorks: 20,
      benefits: 'Verified badge & Priority support'
    };
  }
  return {
    badge: 'New Creator',
    level: 'New Creator',
    color: '#999',
    subtitle: 'Not Verified',
    nextLevel: 'L1 Rising Star',
    currentWorks: completedWorks,
    nextWorks: 10,
    benefits: 'Complete 10 works to reach L1 Rising Star'
  };
};

export default function CreatorDashboard() {
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const [activeCampaigns, setActiveCampaigns] = useState([]);
  const [availableCampaigns, setAvailableCampaigns] = useState([]);
  const [myBids, setMyBids] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [proposal, setProposal] = useState('');
  const [deliveryDays, setDeliveryDays] = useState('');
  const [portfolio, setPortfolio] = useState([]);
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);
  const [completedWorks, setCompletedWorks] = useState(0);

  useEffect(() => {
    // Only skip if approval_status is explicitly set and not 'approved'
    if (user && user.approval_status && user.approval_status !== 'approved') {
      return;
    }

    if (user?.id) {
      fetchAllData();
      const interval = setInterval(fetchAllData, 10000);
      return () => clearInterval(interval);
    }
  }, [user?.approval_status, user?.id]);

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

  const fetchAllData = async () => {
    try {
      const [campaignsRes, reviewsRes, worksRes] = await Promise.all([
        axios.get(`${API}/campaigns?t=${Date.now()}`),
        axios.get(`${API}/reviews/creator/${user.id}`),
        axios.get(`${API}/campaigns?status=completed&creator_id=${user.id}`)
      ]);

      const allCampaigns = campaignsRes.data;
      // Only count campaigns this creator was actually selected for — some backends
      // ignore the creator_id query param and return every completed campaign.
      const completedCampaigns = (worksRes.data || []).filter(
        (c) => isSelectedCreator(c, user.id)
      );

      setActiveCampaigns(allCampaigns.filter((campaign) =>
        isSelectedCreator(campaign, user.id) &&
        (campaign.status === 'in_progress' || campaign.status === 'active')
      ));
      // Still browsable while the brief has slots left, but not if I'm already on it.
      setAvailableCampaigns(allCampaigns.filter(
        (campaign) => isOpenForBids(campaign) && !isSelectedCreator(campaign, user.id)
      ));
      setMyBids(
        allCampaigns
          .filter((campaign) => campaign.bids?.some((bid) => bid.creator_id === user.id))
          .map((campaign) => ({
            ...campaign,
            myBid: campaign.bids.find((bid) => bid.creator_id === user.id)
          }))
      );
      setReviews(reviewsRes.data);
      setPortfolio(user?.portfolio || []);
      setCompletedWorks(completedCampaigns.length);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleBidSubmit = async (event) => {
    event.preventDefault();
    try {
      await axios.post(`${API}/campaigns/${selectedCampaign.id}/bid`, {
        campaign_id: selectedCampaign.id,
        amount: parseFloat(bidAmount),
        proposal,
        estimated_delivery_days: parseInt(deliveryDays, 10)
      });
      toast.success('Bid submitted successfully');
      setSelectedCampaign(null);
      setBidAmount('');
      setProposal('');
      setDeliveryDays('');
      fetchAllData();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to submit bid'));
    }
  };

  const handlePortfolioUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setUploadingPortfolio(true);
    try {
      const uploadedUrls = await Promise.all(files.map(async (file) => {
        if (file.size > 10 * 1024 * 1024) {
          throw new Error(`${file.name} is too large. Maximum 10MB per file.`);
        }
        const formDataUpload = new FormData();
        formDataUpload.append('file', file);
        const response = await axios.post(`${API}/upload/file`, formDataUpload, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        return response.data.file_url;
      }));

      const nextPortfolio = [...portfolio, ...uploadedUrls];
      setPortfolio(nextPortfolio);
      await axios.patch(`${API}/profile/portfolio`, nextPortfolio);
      toast.success(`${uploadedUrls.length} file(s) added to portfolio`);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to upload portfolio items'));
    } finally {
      setUploadingPortfolio(false);
      event.target.value = '';
    }
  };

  const handleRemovePortfolioItem = async (url) => {
    try {
      const nextPortfolio = portfolio.filter((item) => item !== url);
      setPortfolio(nextPortfolio);
      await axios.patch(`${API}/profile/portfolio`, nextPortfolio);
      toast.success('Portfolio item removed');
    } catch (error) {
      toast.error('Failed to remove portfolio item');
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const displayName = user?.username ? `@${user.username}` : (user?.nickname || user?.full_name || user?.email || 'Creator');
  const rating = Number(user?.average_rating || 0);
  const totalEarned = useMemo(() => {
    const bidsTotal = myBids.reduce((sum, campaign) => sum + Number(campaign.myBid?.amount || 0), 0);
    return Math.max(Number(user?.balance || 0), bidsTotal);
  }, [myBids, user?.balance]);

  const levelInfo = getLevelInfo(completedWorks);
  const progressPercentage = levelInfo.nextWorks
    ? Math.min(100, Math.max(0, (levelInfo.currentWorks / levelInfo.nextWorks) * 100))
    : 100;
  const worksRemaining = levelInfo.nextWorks ? Math.max(0, levelInfo.nextWorks - levelInfo.currentWorks) : 0;

  // First-view onboarding: a brand-new creator who has no briefs/bids/completed work yet.
  const hasReceivedBriefs = activeCampaigns.length > 0 || myBids.length > 0;
  const isNewCreator = !loading && !hasReceivedBriefs && completedWorks === 0;

  // Optional-but-encouraged profile completion nudges.
  const profileChecklist = [
    { key: 'avatar', label: 'Add a profile picture', hint: 'Optional — a default avatar is used otherwise', done: Boolean(user?.profile_picture || user?.avatar), icon: User, to: '/settings' },
    { key: 'banner', label: 'Add a banner image', hint: 'Optional', done: Boolean(user?.banner || user?.banner_image), icon: ImageIcon, to: '/settings' },
    { key: 'intro', label: 'Record a 30–60 second intro video', hint: 'Face + voice — builds brand trust', done: Boolean(user?.intro_video), icon: Video, to: '/settings' },
    { key: 'availability', label: 'Review and adjust availability', hint: 'Set vacation mode if needed', done: Boolean(user?.availability_calendar || user?.weekly_availability), icon: CalendarClock, to: '/settings' }
  ];
  const profileDone = profileChecklist.filter((item) => item.done).length;

  const quickLinks = [
    { label: 'Profile', value: 'Edit details', icon: User, to: '/settings' },
    { label: 'Portfolio', value: `${portfolio.length} item${portfolio.length === 1 ? '' : 's'}`, icon: Briefcase, to: '/portfolio' },
    { label: 'Earnings', value: formatMoney(user?.balance), icon: IndianRupee, to: '/withdrawal' },
    { label: 'Settings', value: 'Preferences', icon: Settings, to: '/settings' }
  ];

  if (user?.approval_status === 'pending') {
    return (
      <div className="pcd-status-page">
        <section className="pcd-status-card">
          <CheckCircle size={68} />
          <p className="pcd-eyebrow">Creator verification</p>
          <h1>Profile Under Review</h1>
          <p>Your profile is being reviewed. Most creator approvals are completed within 24-48 hours.</p>
          <button type="button" onClick={handleLogout}>Back to Home</button>
        </section>
      </div>
    );
  }

  if (user?.approval_status === 'rejected') {
    return <RejectedGate user={user} onHome={handleLogout} kind="creator" />;
  }

  // Admin requested more info — show the request + let the creator update & resubmit.
  if (user?.approval_status === 'more_info') {
    const review = user.review || {};
    const items = Array.isArray(review.more_info_items) ? review.more_info_items : [];
    return (
      <div className="pcd-status-page">
        <section className="pcd-status-card">
          <MessageSquare size={68} />
          <p className="pcd-eyebrow">Creator verification</p>
          <h1>More information needed</h1>
          <p>Our team needs a few more details before approving your creator profile. Please update your profile with the info below.</p>
          {review.more_info_message && (
            <div style={{ textAlign: 'left', background: 'rgba(139,151,255,0.08)', border: '1px solid rgba(139,151,255,0.25)', borderRadius: '14px', padding: '16px 18px', margin: '8px auto 4px', maxWidth: '460px', width: '100%' }}>
              <strong style={{ color: '#6d7bff', display: 'block', marginBottom: '6px', fontSize: '13px', letterSpacing: '0.3px' }}>What we need</strong>
              <span style={{ color: '#d6d7ec', fontSize: '14.5px', lineHeight: 1.55 }}>{review.more_info_message}</span>
            </div>
          )}
          {items.length > 0 && (
            <ul style={{ textAlign: 'left', margin: '4px auto 6px', paddingLeft: '20px', color: '#b6b6cc', fontSize: '14px', lineHeight: 1.8, maxWidth: '460px' }}>
              {items.map((it, i) => <li key={i}><strong style={{ color: '#6d7bff' }}>Note:</strong> {typeof it === 'string' ? it : (it.label || it.name || it.field || '')}</li>)}
            </ul>
          )}
          <button type="button" onClick={() => navigate('/profile-setup/creator')}>Update my profile</button>
        </section>
      </div>
    );
  }

  // Show pending message if user is not approved (but only if approval_status is explicitly set to something other than 'approved')
  if (user && user.approval_status && user.approval_status !== 'approved') {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#f5f5f5',
        flexDirection: 'column',
        gap: '16px',
        textAlign: 'center',
        padding: '20px'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
        <h1 style={{ color: '#07074e', margin: 0, fontSize: '28px' }}>Profile Pending Review</h1>
        <p style={{ color: '#666', margin: '8px 0 0 0', fontSize: '16px' }}>
          Your creator profile is being reviewed by our team.
        </p>
        <p style={{ color: '#999', margin: '8px 0 0 0', fontSize: '14px' }}>
          You'll be able to access all features once approved.
        </p>
      </div>
    );
  }

  const profilePct = Math.round((profileDone / profileChecklist.length) * 100);
  const heroName = user?.nickname || user?.full_name || (user?.username ? `@${user.username}` : 'Creator');
  // The primary content category the creator picked on the signup form (stored as
  // a value key like "product_demo"); resolve it to its human label for display.
  const rawCategory = user?.category || user?.profile?.category
    || user?.niche || user?.primary_category || user?.content_category || '';
  const heroCategory = (CONTENT_CATEGORIES.find((c) => c.value === rawCategory)?.label
    || String(rawCategory).replace(/_/g, ' ')).trim();
  const heroDeal = activeCampaigns[0];
  const heroActiveDeal = heroDeal ? {
    brand: heroDeal.business_nickname ? `@${heroDeal.business_nickname}` : (heroDeal.brand_handle ? `@${heroDeal.brand_handle}` : 'Brand'),
    title: heroDeal.title || 'Active campaign',
    budgetLabel: getCampaignBudget(heroDeal),
    progress: heroDeal.status === 'in_progress' ? 65 : 40,
    logo: heroDeal.brand_logo || heroDeal.business_logo
  } : null;

  return (
    <CreatorTopNavLayout notifications={0}>
          <CreatorHero
            name={heroName}
            photo={user?.profile_photo}
            category={heroCategory}
            rating={rating}
            completedDeals={completedWorks}
            level={levelInfo.title}
            activeDeals={activeCampaigns.length}
            newBriefs={availableCampaigns.length}
            totalEarned={Number(totalEarned || 0)}
            nextPayout={Number(user?.balance || 0)}
            profilePct={profilePct}
            activeDeal={heroActiveDeal}
          />

      {selectedCampaign && (
        <div className="pcd-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="bid-modal-title">
          <form className="pcd-modal" onSubmit={handleBidSubmit}>
            <h2 id="bid-modal-title">Submit Bid</h2>
            <p>{selectedCampaign.title}</p>
            <label>
              Bid Amount
              <input type="text" inputMode="numeric" value={bidAmount} onKeyDown={blockNonDigitKey} onChange={(event) => setBidAmount(digitsOnly(event.target.value))} required />
            </label>
            <label>
              Delivery Days
              <input type="text" inputMode="numeric" value={deliveryDays} onKeyDown={blockNonDigitKey} onChange={(event) => setDeliveryDays(digitsOnly(event.target.value))} required />
            </label>
            <label>
              Proposal
              <textarea value={proposal} onChange={(event) => setProposal(event.target.value)} required rows="5" />
            </label>
            <div>
              <button type="button" onClick={() => setSelectedCampaign(null)}>Cancel</button>
              <button type="submit" className="pcd-primary">Submit Bid</button>
            </div>
          </form>
        </div>
      )}
    </CreatorTopNavLayout>
  );
}

function EmptyPanel({ text }) {
  return <div className="pcd-empty-panel">{text}</div>;
}

function CompactList({ title, empty, items, render }) {
  return (
    <section>
      <h2>{title}</h2>
      {items.length ? <div className="pcd-mini-list">{items.map(render)}</div> : <EmptyPanel text={empty} />}
    </section>
  );
}

function CampaignMiniCard({ campaign, actionLabel, onAction }) {
  return (
    <article className="pcd-mini-card">
      <div>
        <h3>{campaign.title}</h3>
        <p>{campaign.business_nickname || 'Brand campaign'} - {getCampaignBudget(campaign)}</p>
      </div>
      <button type="button" onClick={onAction}>{actionLabel}</button>
    </article>
  );
}

function CampaignGrid({ items, empty, renderActions }) {
  if (!items.length) return <EmptyPanel text={empty} />;

  return (
    <div className="pcd-campaign-grid">
      {items.map((campaign) => (
        <article key={campaign.id} className="pcd-campaign-card">
          <div>
            <h3>{campaign.title}</h3>
            <span className={`pcd-status ${campaign.status}`}>{(campaign.status || 'active').replace('_', ' ')}</span>
          </div>
          <p>{campaign.brief_text ? `${campaign.brief_text.substring(0, 150)}${campaign.brief_text.length > 150 ? '...' : ''}` : 'Creator campaign brief'}</p>
          <dl>
            <div><dt>Budget</dt><dd>{getCampaignBudget(campaign)}</dd></div>
            <div><dt>Brand</dt><dd>{campaign.business_nickname || campaign.brand_handle || 'Brand'}</dd></div>
            <div><dt>Objectives</dt><dd>{campaign.objectives?.length || 0}</dd></div>
          </dl>
          <div className="pcd-card-actions">{renderActions(campaign)}</div>
        </article>
      ))}
    </div>
  );
}

function BrowseFilterSection({ title, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="pcd-brief-filter-section">
      <button type="button" onClick={() => setOpen((value) => !value)}>
        <span>{title}</span>
        <ChevronDown size={16} className={open ? 'is-open' : ''} />
      </button>
      {open && <div>{children}</div>}
    </section>
  );
}

function BrowseCheck({ label, count, checked, onChange }) {
  return (
    <button type="button" className={`pcd-brief-check ${checked ? 'is-checked' : ''}`} onClick={onChange}>
      <span><i />{label}</span>
      {count ? <em>{count}</em> : null}
    </button>
  );
}

function BrowseRadio({ label, checked, onChange }) {
  return (
    <button type="button" className={`pcd-brief-radio ${checked ? 'is-checked' : ''}`} onClick={onChange}>
      <span><i />{label}</span>
    </button>
  );
}

function normalizeBrief(campaign, index, myBids) {
  const objectives = Array.isArray(campaign.objectives) ? campaign.objectives.filter(Boolean) : [];
  const hasBid = myBids.some((bidCampaign) => bidCampaign.id === campaign.id);
  const budgetMax = Number(campaign.budget_max ?? campaign.budget ?? campaign.myBid?.amount ?? 0);
  const matchScore = Math.min(98, 76 + (objectives.length * 4) + (campaign.requires_shipment ? 3 : 0) + (index % 3) * 2);
  const fallbackBrand = ['Glow & Co', 'TechNova', 'FitLife Apparel', 'BeanRoast Coffee', 'Wanderlust Gear', 'PurePlant'][index % 6];

  return {
    campaign,
    id: campaign.id,
    title: campaign.title || 'Creator Campaign Brief',
    description: campaign.brief_text || 'Review the brand brief, pitch your concept, and manage the collaboration from your creator workspace.',
    brand: campaign.business_nickname || campaign.brand_handle || fallbackBrand,
    cover: campaign.cover_image || campaign.image_url || campaign.thumbnail_url || browseCovers[index % browseCovers.length],
    logo: campaign.brand_logo || campaign.business_logo || browseLogos[index % browseLogos.length],
    tags: objectives.length ? objectives.slice(0, 3) : ['UGC', campaign.requires_shipment ? 'Product' : 'Remote', 'Creator'],
    budget: getCampaignBudget(campaign),
    budgetMax,
    location: campaign.requires_shipment ? 'Product shipment' : 'Remote',
    deadline: campaign.due_date ? `Closes ${new Date(campaign.due_date).toLocaleDateString()}` : 'Open brief',
    matchScore,
    verified: Boolean(campaign.business_nickname || index % 2 === 0),
    fastPayment: budgetMax <= 1000 || index % 2 === 0,
    repeatHirer: index % 3 !== 1,
    featured: index === 0 || matchScore >= 94,
    hasBid,
    createdAt: campaign.created_at ? new Date(campaign.created_at).getTime() : 0
  };
}

function BrowseBriefsPanel({ campaigns, myBids, loading, onView, onPitch }) {
  const [viewMode, setViewMode] = useState('grid');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('recommended');
  const [category, setCategory] = useState('all');
  const [budgetRange, setBudgetRange] = useState('any');
  const [minMatch, setMinMatch] = useState(0);
  const [brandFlags, setBrandFlags] = useState({
    verified: true,
    repeatHirer: false,
    fastPayment: false,
    shipment: false
  });

  const briefs = useMemo(() => campaigns.map((campaign, index) => normalizeBrief(campaign, index, myBids)), [campaigns, myBids]);
  const categories = useMemo(() => {
    const counts = briefs.reduce((acc, brief) => {
      brief.tags.forEach((tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
      });
      return acc;
    }, {});
    return Object.entries(counts).slice(0, 5);
  }, [briefs]);

  const filteredBriefs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return briefs
      .filter((brief) => {
        if (normalizedQuery) {
          const haystack = `${brief.title} ${brief.brand} ${brief.description} ${brief.tags.join(' ')}`.toLowerCase();
          if (!haystack.includes(normalizedQuery)) return false;
        }
        if (category !== 'all' && !brief.tags.includes(category)) return false;
        if (budgetRange === 'under1000' && brief.budgetMax > 1000) return false;
        if (budgetRange === '1000plus' && brief.budgetMax < 1000) return false;
        if (minMatch && brief.matchScore < minMatch) return false;
        if (brandFlags.verified && !brief.verified) return false;
        if (brandFlags.repeatHirer && !brief.repeatHirer) return false;
        if (brandFlags.fastPayment && !brief.fastPayment) return false;
        if (brandFlags.shipment && !brief.campaign.requires_shipment) return false;
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'highest') return b.budgetMax - a.budgetMax;
        if (sortBy === 'newest') return b.createdAt - a.createdAt;
        if (sortBy === 'closing') return Number(Boolean(b.campaign.due_date)) - Number(Boolean(a.campaign.due_date));
        return b.matchScore - a.matchScore;
      });
  }, [briefs, query, category, budgetRange, minMatch, brandFlags, sortBy]);

  const toggleFlag = (key) => {
    setBrandFlags((current) => ({ ...current, [key]: !current[key] }));
  };

  const clearFilters = () => {
    setQuery('');
    setCategory('all');
    setBudgetRange('any');
    setMinMatch(0);
    setBrandFlags({ verified: false, repeatHirer: false, fastPayment: false, shipment: false });
  };

  return (
    <div className="pcd-briefs-panel">
      <aside className="pcd-brief-filters">
        <div className="pcd-brief-filter-head">
          <div>
            <Filter size={16} />
            <h2>Filters</h2>
          </div>
          <button type="button" onClick={clearFilters}>Clear all</button>
          <label>
            <Search size={16} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search opportunities..." />
          </label>
        </div>

        <div className="pcd-brief-filter-body">
          <BrowseFilterSection title="Category" defaultOpen>
            <BrowseCheck label="All Briefs" count={briefs.length} checked={category === 'all'} onChange={() => setCategory('all')} />
            {categories.map(([tag, count]) => (
              <BrowseCheck key={tag} label={tag} count={count} checked={category === tag} onChange={() => setCategory(tag)} />
            ))}
          </BrowseFilterSection>

          <BrowseFilterSection title="Payout Range" defaultOpen>
            <BrowseRadio label="Any Budget" checked={budgetRange === 'any'} onChange={() => setBudgetRange('any')} />
            <BrowseRadio label="Under Rs. 1,000" checked={budgetRange === 'under1000'} onChange={() => setBudgetRange('under1000')} />
            <BrowseRadio label="Rs. 1,000+" checked={budgetRange === '1000plus'} onChange={() => setBudgetRange('1000plus')} />
          </BrowseFilterSection>

          <BrowseFilterSection title="Match Score">
            <BrowseRadio label="Any match score" checked={minMatch === 0} onChange={() => setMinMatch(0)} />
            <BrowseRadio label="80% and above" checked={minMatch === 80} onChange={() => setMinMatch(80)} />
            <BrowseRadio label="90% and above" checked={minMatch === 90} onChange={() => setMinMatch(90)} />
          </BrowseFilterSection>

          <BrowseFilterSection title="Brand Type" defaultOpen>
            <BrowseCheck label="Verified Brands" checked={brandFlags.verified} onChange={() => toggleFlag('verified')} />
            <BrowseCheck label="Repeat Hirer" checked={brandFlags.repeatHirer} onChange={() => toggleFlag('repeatHirer')} />
            <BrowseCheck label="Fast Payment" checked={brandFlags.fastPayment} onChange={() => toggleFlag('fastPayment')} />
            <BrowseCheck label="Product Shipment" checked={brandFlags.shipment} onChange={() => toggleFlag('shipment')} />
          </BrowseFilterSection>
        </div>
      </aside>

      <section className="pcd-brief-results">
        <div className="pcd-brief-toolbar">
          <span>Showing <strong>{filteredBriefs.length}</strong> matching opportunities</span>
          <div>
            <label>
              Sort by:
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="recommended">Recommended</option>
                <option value="highest">Highest Payout</option>
                <option value="closing">Closing Soon</option>
                <option value="newest">Newest</option>
              </select>
            </label>
            <i />
            <div className="pcd-view-toggle" aria-label="View mode">
              <button type="button" className={viewMode === 'grid' ? 'is-active' : ''} onClick={() => setViewMode('grid')} aria-label="Grid view">
                <LayoutGrid size={16} />
              </button>
              <button type="button" className={viewMode === 'list' ? 'is-active' : ''} onClick={() => setViewMode('list')} aria-label="List view">
                <List size={16} />
              </button>
            </div>
          </div>
        </div>

        {filteredBriefs.length ? (
          <div className={`pcd-brief-grid ${viewMode === 'list' ? 'is-list' : ''}`}>
            {filteredBriefs.map((brief) => (
              <BriefOpportunityCard key={brief.id} brief={brief} viewMode={viewMode} onView={onView} onPitch={onPitch} />
            ))}
          </div>
        ) : (
          <EmptyPanel text={loading ? 'Loading campaigns...' : 'No matching briefs found. Try clearing filters.'} />
        )}
      </section>
    </div>
  );
}

function BriefOpportunityCard({ brief, viewMode, onView, onPitch }) {
  const [saved, setSaved] = useState(() => isBriefSaved(brief.id));
  const handlePitch = () => {
    if (brief.hasBid) {
      onView(brief.campaign);
      return;
    }
    onPitch(brief.campaign);
  };
  const handleSave = (e) => {
    e.stopPropagation();
    const now = toggleSavedBrief({
      id: brief.id, title: brief.title, description: brief.description,
      brand: brief.brand, logo: brief.logo, tags: brief.tags, budget: brief.budget,
      deliveryLabel: brief.deliveryLabel || brief.deadline || '3 - 5 Days', matchScore: brief.matchScore,
    });
    setSaved(now);
    toast.success(now ? 'Saved to your list' : 'Removed from saved');
  };

  return (
    <article className={`pcd-brief-card ${brief.featured ? 'is-featured' : ''} ${viewMode === 'list' ? 'is-list' : ''}`}>
      {brief.featured && <div className="pcd-feature-line" />}
      <div className="pcd-brief-media">
        <img src={brief.cover} alt={brief.title} />
        <div className="pcd-brief-media-shade" />
        <button type="button" aria-label={saved ? 'Remove from saved' : 'Save brief'} onClick={handleSave} style={saved ? { color: '#5b6bff' } : undefined}><Bookmark size={15} fill={saved ? 'currentColor' : 'none'} /></button>
        {brief.featured && (
          <span className="pcd-best-match"><Sparkles size={12} /> Best Match</span>
        )}
        <div className="pcd-brief-brand">
          <img src={brief.logo} alt="" />
          <div>
            <strong>{brief.brand}</strong>
            {brief.verified && <CheckCircle2 size={15} />}
          </div>
        </div>
      </div>

      <div className="pcd-brief-content">
        <button type="button" className="pcd-brief-title" onClick={() => onView(brief.campaign)}>
          {brief.title}
        </button>
        <p>{brief.description}</p>
        <div className="pcd-brief-tags">
          <span className="match"><Star size={12} /> {brief.matchScore}%</span>
          {brief.tags.slice(0, 2).map((tag) => <span key={tag}>{tag}</span>)}
          {brief.fastPayment && <span className="fast"><Zap size={12} /> Fast</span>}
        </div>
        <div className="pcd-brief-footer">
          <div>
            <strong>{brief.budget}</strong>
            <span><MapPin size={12} /> {brief.location}</span>
          </div>
          <div>
            <small><Clock size={12} /> {brief.deadline}</small>
            <button type="button" onClick={handlePitch}>
              {brief.hasBid ? 'View Bid' : 'Pitch Now'}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
