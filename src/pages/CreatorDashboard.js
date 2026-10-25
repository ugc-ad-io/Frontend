import { useLiveEffect } from '../lib/liveUpdates';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { uploadMedia } from '../utils/upload';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { maxCampaignBid, bidOverBudgetMessage } from '../utils/bidBudget';
import { digitsOnly, blockNonDigitKey } from '../utils/inputValidators';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import CreatorPageHead from '../components/CreatorPageHead';
import { creatorFirstName } from '../utils/displayName';
import { getProfilePct, getProfileNudge } from '../utils/creatorProfileCompletion';
import RejectedGate from '../components/RejectedGate';
import MoreInfoGate from '../components/MoreInfoGate';
import CreatorPendingGate from '../components/CreatorPendingGate';
import { CONTENT_CATEGORIES } from '../constants/contentCategories';
import { toggleSavedBrief, isBriefSaved } from '../utils/savedBriefs';
import normalizeBrief, { timeAgo } from '../utils/normalizeBrief';
import { mediaUrl } from '../utils/mediaUrl';
import {
  ArrowRight,
  Bookmark,
  CalendarClock,
  Check,
  CheckCircle,
  MessageSquare,
  Plus,
  Send,
} from 'lucide-react';
import './CreatorDashboard.css';
import '../styles/creator-ui-dashboard.css';
import { isSelectedCreator, isOpenForBids, needsEditSplit } from '../utils/campaignCreators';
import SplitBidFields, { EMPTY_SPLIT, splitPayload } from '../components/SplitBidFields';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const inr = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const budgetRange = (campaign) => {
  const min = Number(campaign?.budget_min ?? campaign?.budget ?? 0);
  const max = Number(campaign?.budget_max ?? min);
  return !min || min === max ? inr(max || min) : `${inr(min)}–${inr(max).replace('₹', '')}`;
};

// What the creator earns on a hired campaign: their own bid, else the brief's budget.
const orderPrice = (campaign, userId) => {
  const mine = (campaign?.bids || []).find((bid) => bid.creator_id === userId);
  return Number(mine?.amount ?? campaign?.budget_max ?? campaign?.budget ?? campaign?.budget_min ?? 0);
};

const dueDate = (campaign) => {
  const raw = campaign?.final_delivery_by || campaign?.draft_delivery_by || campaign?.due_date || campaign?.deadline;
  const ms = raw ? new Date(raw).getTime() : NaN;
  return Number.isFinite(ms) ? new Date(ms) : null;
};

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysUntil = (d) => Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000);

function duePill(campaign) {
  const d = dueDate(campaign);
  if (!d) return null;
  const n = daysUntil(d);
  if (n < 0) return { text: 'Overdue', tone: 'bad' };
  if (n === 0) return { text: 'Due today', tone: 'warn' };
  if (n <= 3) return { text: `Due in ${n} day${n === 1 ? '' : 's'}`, tone: 'warn' };
  return { text: `Due ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`, tone: 'info' };
}

const BADGE_COLORS = ['#07074E', '#B45309', '#6D28D9', '#0F766E', '#9D174D', '#1D4ED8'];
const badgeColor = (name) => BADGE_COLORS[String(name || '?').split('').reduce((s, ch) => s + ch.charCodeAt(0), 0) % BADGE_COLORS.length];
const getInitial = (name) => (String(name || 'U').trim().charAt(0) || 'U').toUpperCase();

// Company name from the form — never the "@nickname" handle. Strips any leading "@".
const brandLabel = (c, fallback = 'Brand') =>
  String(c?.brand_name || c?.business_name || c?.company_name || c?.business_nickname || c?.brand_handle || '')
    .replace(/^@+/, '').trim() || fallback;

const isVideoUrl = (url) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(String(url || ''));

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

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
  const [split, setSplit] = useState(EMPTY_SPLIT);
  const [proposal, setProposal] = useState('');
  const [deliveryDays, setDeliveryDays] = useState('');
  const [portfolio, setPortfolio] = useState([]);
  const [uploadingPortfolio, setUploadingPortfolio] = useState(false);
  const [completedWorks, setCompletedWorks] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [bidSubmitting, setBidSubmitting] = useState(false);
  // Lifetime earnings released to this creator (backend /payout/overview), not a guess from bids.
  const [lifetimeEarned, setLifetimeEarned] = useState(null);
  // Whole payout summary (balance, pending_release, paid_this_month, pending_deals_count).
  const [payout, setPayout] = useState(null);
  const [briefTab, setBriefTab] = useState('match');
  // "Later" on the complete-your-profile pop-up hides it for this browser session only.
  const [nudgeLater, setNudgeLater] = useState(() => {
    try { return sessionStorage.getItem('profileNudgeLater') === '1'; } catch { return false; }
  });

  useLiveEffect(() => {
    // Only skip if approval_status is explicitly set and not 'approved'
    if (user && user.approval_status && user.approval_status !== 'approved') {
      return;
    }

    if (user?.id) {
      fetchAllData();
      const interval = setInterval(fetchAllData, 60000); // live updates push changes; this is only a safety net
      return () => clearInterval(interval);
    }
  }, [user?.approval_status, user?.id]);

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

  const fetchAllData = async () => {
    try {
      const [campaignsRes, reviewsRes, worksRes, payoutRes] = await Promise.all([
        axios.get(`${API}/campaigns?t=${Date.now()}`),
        axios.get(`${API}/reviews/creator/${user.id}`),
        axios.get(`${API}/campaigns?status=completed&creator_id=${user.id}`),
        axios.get(`${API}/payout/overview`).catch(() => null) // optional: hero falls back to the wallet balance
      ]);
      setLifetimeEarned(payoutRes?.data?.all_time_earnings ?? null);
      setPayout(payoutRes?.data || null);
      setLoadError('');

      const allCampaigns = campaignsRes.data;
      // "Deals closed" = only genuinely COMPLETED deals this creator was selected
      // for. The backend ignores the `status=completed` query param for creators
      // (it returns every campaign they're on, including cancelled and in-progress
      // ones), so a cancelled deal was being counted as closed — filter on status
      // here.
      const completedCampaigns = (worksRes.data || []).filter(
        (c) => isSelectedCreator(c, user.id) && String(c.status).toLowerCase() === 'completed'
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
      // Keep whatever is already on screen; show a banner with Retry instead of silent zeros.
      setLoadError(error?.response
        ? 'Some of your dashboard data could not be loaded.'
        : "You're offline. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleBidSubmit = async (event) => {
    event.preventDefault();
    if (bidSubmitting) return;
    const maximum = maxCampaignBid(selectedCampaign);
    if (maximum && Number(bidAmount) > maximum) {
      toast.error(bidOverBudgetMessage(maximum));
      return;
    }
    setBidSubmitting(true);
    try {
      await axios.post(`${API}/campaigns/${selectedCampaign.id}/bid`, {
        campaign_id: selectedCampaign.id,
        amount: parseFloat(bidAmount),
        ...(needsEditSplit(selectedCampaign) ? splitPayload(split) : {}),
        proposal,
        estimated_delivery_days: parseInt(deliveryDays, 10)
      });
      toast.success('Bid submitted successfully');
      setSelectedCampaign(null);
      setBidAmount('');
      setSplit(EMPTY_SPLIT);
      setProposal('');
      setDeliveryDays('');
      fetchAllData();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to submit bid'));
    } finally {
      setBidSubmitting(false);
    }
  };

  const handlePortfolioUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    setUploadingPortfolio(true);
    try {
      const uploadedUrls = await Promise.all(files.map(async (file) => {
        const data = await uploadMedia(file, API);
        return data.file_url;
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

  const handleLogout = () => {
    logout();
  };

  const displayName = creatorFirstName(user);
  const rating = Number(user?.average_rating || user?.avg_rating || 0);
  // Bids that were never accepted are not earnings: use the released total, else the wallet balance.
  const totalEarned = lifetimeEarned ?? Number(user?.balance || 0);

  const levelInfo = getLevelInfo(completedWorks);
  const progressPercentage = levelInfo.nextWorks
    ? Math.min(100, Math.max(0, (levelInfo.currentWorks / levelInfo.nextWorks) * 100))
    : 100;
  const worksRemaining = levelInfo.nextWorks ? Math.max(0, levelInfo.nextWorks - levelInfo.currentWorks) : 0;

  // First-view onboarding: a brand-new creator who has no briefs/bids/completed work yet.
  const hasReceivedBriefs = activeCampaigns.length > 0 || myBids.length > 0;
  const isNewCreator = !loading && !hasReceivedBriefs && completedWorks === 0;

  const briefs = useMemo(
    () => availableCampaigns.map((c, i) => normalizeBrief(c, i, myBids)),
    [availableCampaigns, myBids]
  );
  const shownBriefs = useMemo(() => {
    const list = briefTab === 'closing'
      ? [...briefs].sort((a, b) => (a.deliveryDays ?? 9999) - (b.deliveryDays ?? 9999))
      : [...briefs].sort((a, b) => b.matchScore - a.matchScore);
    return list.slice(0, isNewCreator ? 3 : 2);
  }, [briefs, briefTab, isNewCreator]);

  if (user?.approval_status === 'pending') {
    return <CreatorPendingGate user={user} onLogout={handleLogout} />;
  }

  if (user?.approval_status === 'rejected') {
    return <RejectedGate user={user} onHome={handleLogout} kind="creator" />;
  }

  // Admin requested more info: show the request and let the creator update and resubmit.
  if (user?.approval_status === 'more_info') {
    return <MoreInfoGate kind="creator" user={user} onLogout={handleLogout} />;
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

  const profilePct = getProfilePct(user);
  const nudge = getProfileNudge(user);
  // The primary content category the creator picked on the signup form (stored as
  // a value key like "product_demo"); resolve it to its human label for display.
  const rawCategory = user?.category || user?.profile?.category
    || user?.niche || user?.primary_category || user?.content_category
    || (Array.isArray(user?.categories) ? user.categories[0] : '') || '';
  const heroCategory = (CONTENT_CATEGORIES.find((c) => c.value === rawCategory)?.label
    || String(rawCategory).replace(/_/g, ' ')).trim();

  const photo = user?.profile_photo || user?.profile_picture || user?.avatar;
  const photoUrl = photo ? mediaUrl(photo) : '';
  const balance = Number(payout?.balance ?? user?.balance ?? 0);
  const clearing = Number(payout?.pending_release || 0);
  const clearingOrders = Number(payout?.pending_deals_count || 0);
  const activeValue = activeCampaigns.reduce((sum, c) => sum + orderPrice(c, user?.id), 0);
  const dueDates = activeCampaigns.map(dueDate).filter(Boolean).sort((a, b) => a - b);
  const nextDue = dueDates[0];
  const nextDueDays = nextDue ? daysUntil(nextDue) : null;
  const firstActive = activeCampaigns[0];
  const levelLabel = user?.level_label || levelInfo.level;

  // This-week strip (Mon-Sun) with the days that have a delivery due.
  const today = startOfDay(new Date());
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
  const weekDue = activeCampaigns
    .map((c) => ({ c, d: dueDate(c) }))
    .filter(({ d }) => d && weekDays.some((w) => w.getTime() === startOfDay(d).getTime()))
    .sort((a, b) => a.d - b.d);

  const openBrief = (brief) => navigate(`/browse-briefs?open=${brief.id}`);

  const headProps = isNewCreator
    ? { title: `Welcome, ${displayName}`, subtitle: "You're live. Here's how to win your first order." }
    : {
        title: `${greeting()}, ${displayName}`,
        subtitle: `You have ${activeCampaigns.length} active order${activeCampaigns.length === 1 ? '' : 's'} and ${availableCampaigns.length} open brief${availableCampaigns.length === 1 ? '' : 's'} waiting for you.`,
      };

  const briefCards = shownBriefs.map((brief) => (
    <BriefCard key={brief.id} brief={brief} onOpen={openBrief} />
  ));

  return (
    <CreatorTopNavLayout notifications={0}>
      <CreatorPageHead
        {...headProps}
        action={!isNewCreator && activeCampaigns.length > 0 ? (
          <button type="button" className="cui-btn" onClick={() => navigate(`/my-deals?campaign=${firstActive.id}`)}>
            <Send size={17} /> Deliver work
          </button>
        ) : null}
      />

      {loadError && (
        <div className="pcd-load-error" role="alert">
          <span>{loadError}</span>
          <button type="button" onClick={() => { setLoading(true); fetchAllData(); }}>Retry</button>
        </div>
      )}

      {loading && <div className="cui-d-card cui-d-empty" role="status">Loading your dashboard...</div>}

      {!loading && isNewCreator && (
        <>
          <section className="cui-d-welcome">
            <span className="cui-d-glow" aria-hidden="true" style={{ right: 160, top: -140, width: 380, height: 380 }} />
            <div className="cui-d-welcome-t">
              <div className="cui-d-soft">You're live · Level: {levelLabel}</div>
              <h2>{briefs.length ? `Next: apply to ${Math.min(3, briefs.length)} brief${Math.min(3, briefs.length) === 1 ? '' : 's'}` : 'Next: find your first brief'}</h2>
              <div className="cui-d-soft">{briefs.length} open brief{briefs.length === 1 ? '' : 's'} right now</div>
            </div>
            <ol className="cui-d-steps" aria-label="Your first order">
              {[['Account', 1], ['Approved', 2], ['Apply', 3], ['Deliver', 4], ['Get paid', 5]].map(([label, n]) => (
                <li key={label} className={n < 3 ? 'is-done' : n === 3 ? 'is-now' : ''}>
                  <span>{n < 3 ? <Check size={15} /> : n}</span>
                  <small>{label}</small>
                </li>
              ))}
            </ol>
            <button type="button" className="cui-d-white" onClick={() => navigate('/browse-briefs')}>Find briefs</button>
          </section>

          <section className="cui-d-sec">
            <div className="cui-d-sec-h">
              <h2>Briefs for you</h2>
              {briefs.length > 0 && <button type="button" className="cui-d-link" onClick={() => navigate('/browse-briefs')}>See all {briefs.length} →</button>}
            </div>
            {briefs.length ? <div className="cui-d-briefs cui-d-briefs--3">{briefCards}</div> : (
              <div className="cui-d-card cui-d-empty">No open briefs right now. New briefs show up here as brands post them.</div>
            )}
          </section>
        </>
      )}

      {!loading && !isNewCreator && (
        <>
          <div className="cui-d-grid">
            <aside className="cui-d-card cui-d-profile">
              <div className="cui-d-who">
                {photoUrl ? <img src={photoUrl} alt="" /> : <span className="cui-d-who-ph">{getInitial(displayName)}</span>}
                <h2>{user?.full_name || user?.profile?.fullName || displayName}</h2>
                {heroCategory && <div className="cui-d-muted">{heroCategory}</div>}
                {user?.ugcad_approved && <span className="cui-d-choice">UGCAD.IO Choice</span>}
              </div>
              <div className="cui-d-bars">
                <Bar label="Rating" value={rating ? `${rating.toFixed(1)} ★${reviews.length ? ` (${reviews.length})` : ''}` : 'No ratings yet'} pct={(rating / 5) * 100} />
                <Bar label="Profile complete" value={`${profilePct}%`} pct={profilePct} />
                <Bar
                  label={`Level · ${levelInfo.level}`}
                  value={levelInfo.nextWorks ? `${levelInfo.currentWorks}/${levelInfo.nextWorks} orders` : 'Top level'}
                  pct={progressPercentage}
                  hint={levelInfo.nextWorks ? `${worksRemaining} more completed order${worksRemaining === 1 ? '' : 's'} to reach ${levelInfo.nextLevel}` : levelInfo.benefits}
                />
              </div>
              <div className="cui-d-row cui-d-row--top"><span className="cui-d-muted">{payout ? 'Earned this month' : 'Earned so far'}</span><strong>{inr(payout ? payout.paid_this_month : totalEarned)}</strong></div>
              <div className="cui-d-row cui-d-row--line"><span className="cui-d-muted">Completed orders</span><strong>{completedWorks}</strong></div>
              <button type="button" className="cui-btn cui-btn--ghost cui-d-wide" onClick={() => navigate('/profile')}>View my profile</button>
            </aside>

            <div className="cui-d-col">
              <div className="cui-d-stats">
                <div className="cui-d-stat cui-d-stat--hero">
                  <span className="cui-d-glow" aria-hidden="true" style={{ right: -60, top: -80, width: 220, height: 220 }} />
                  <div className="cui-d-soft">Available to withdraw</div>
                  <div className="cui-d-big">{inr(balance)}</div>
                  <button type="button" className="cui-d-white cui-d-white--sm" onClick={() => navigate('/withdrawal')}>Withdraw</button>
                </div>
                <div className="cui-d-card cui-d-stat">
                  <div className="cui-d-muted">Clearing (paid on approval)</div>
                  <div className="cui-d-big">{inr(clearing)}</div>
                  <div className="cui-d-muted cui-d-stat-f">{clearingOrders ? `From ${clearingOrders} order${clearingOrders === 1 ? '' : 's'} in review` : (clearing > 0 ? 'Held until the brand approves' : 'Nothing waiting to clear')}</div>
                </div>
                <div className="cui-d-card cui-d-stat">
                  <div className="cui-d-muted">Active orders</div>
                  <div className="cui-d-big">{activeCampaigns.length}{activeCampaigns.length > 0 && activeValue > 0 ? ` · ${inr(activeValue)}` : ''}</div>
                  <div className="cui-d-muted cui-d-stat-f">
                    {nextDue
                      ? (nextDueDays < 0 ? 'Next one is overdue' : nextDueDays === 0 ? 'Next one is due today' : `Next one due in ${nextDueDays} day${nextDueDays === 1 ? '' : 's'}`)
                      : (activeCampaigns.length ? 'No deadline set' : 'No orders in progress')}
                  </div>
                </div>
              </div>

              <section className="cui-d-card cui-d-orders">
                <div className="cui-d-sec-h">
                  <h2>Active orders</h2>
                  <button type="button" className="cui-d-link" onClick={() => navigate('/my-deals')}>All orders →</button>
                </div>
                {activeCampaigns.length ? (
                  <>
                    <div className="cui-d-tr cui-d-th" aria-hidden="true"><span>ORDER</span><span>DUE</span><span>STATUS</span><span>PRICE</span><span /></div>
                    {activeCampaigns.map((c) => {
                      const pill = duePill(c);
                      const brand = brandLabel(c);
                      return (
                        <div className="cui-d-tr" key={c.id}>
                          <div className="cui-d-ord">
                            <span className="cui-d-ord-img" style={{ background: c.image_url || c.cover_image ? undefined : '#EEF0FF' }}>
                              {(c.image_url || c.cover_image) ? <img src={mediaUrl(c.image_url || c.cover_image)} alt="" /> : getInitial(brand)}
                            </span>
                            <div className="cui-d-ord-t">
                              <div className="cui-d-muted cui-d-ord-b"><i style={{ background: badgeColor(brand) }}>{getInitial(brand)}</i>{brand}</div>
                              <b>{c.title || 'Active campaign'}</b>
                            </div>
                          </div>
                          <div>{pill ? <span className={`cui-d-pill cui-d-pill--${pill.tone}`}>{pill.tone !== 'info' && <CalendarClock size={12} />}{pill.text}</span> : <span className="cui-d-muted">No deadline</span>}</div>
                          <div><span className="cui-d-pill cui-d-pill--info">{c.status === 'in_progress' ? 'In progress' : 'Active'}</span></div>
                          <div className="cui-d-price">{inr(orderPrice(c, user?.id))}</div>
                          <button type="button" className="cui-d-go" onClick={() => navigate(`/my-deals?campaign=${c.id}`)}>Open</button>
                        </div>
                      );
                    })}
                  </>
                ) : (
                  <div className="cui-d-empty cui-d-empty--in">No orders in progress. Apply to a brief below to get your next one.</div>
                )}
              </section>

              <div className="cui-d-two">
                <section className="cui-d-card cui-d-pad">
                  <h2>This week</h2>
                  <div className="cui-d-week">
                    {weekDays.map((d) => {
                      const has = weekDue.some(({ d: due }) => startOfDay(due).getTime() === d.getTime());
                      const isToday = d.getTime() === today.getTime();
                      return (
                        <div key={d.getTime()} className={isToday ? 'is-today' : has ? 'has' : ''}>
                          <small>{d.toLocaleDateString('en-US', { weekday: 'short' })}</small>
                          <b>{d.getDate()}</b>
                          <i style={{ background: has ? '#7387FF' : 'transparent' }} />
                        </div>
                      );
                    })}
                  </div>
                  <ul className="cui-d-wl">
                    {weekDue.length ? weekDue.map(({ c, d }) => (
                      <li key={c.id}><span /><strong>{d.getDate()}</strong>Deliver: {c.title || brandLabel(c)}</li>
                    )) : <li className="cui-d-muted">Nothing due this week.</li>}
                  </ul>
                </section>

                <section className="cui-d-card cui-d-pad">
                  <div className="cui-d-sec-h">
                    <h2>My videos</h2>
                    <span className="cui-d-muted cui-d-sm">{portfolio.length} in portfolio</span>
                  </div>
                  <div className="cui-d-vids">
                    {portfolio.slice(0, 3).map((url) => (
                      isVideoUrl(url)
                        ? <video key={url} src={mediaUrl(url)} muted playsInline preload="metadata" />
                        : <img key={url} src={mediaUrl(url)} alt="" />
                    ))}
                    <label className={`cui-d-vid-add${uploadingPortfolio ? ' is-busy' : ''}`} aria-label="Add portfolio video">
                      <Plus size={20} />
                      <input type="file" accept="video/*,image/*" multiple hidden onChange={handlePortfolioUpload} disabled={uploadingPortfolio} />
                    </label>
                  </div>
                  <div className="cui-d-muted cui-d-hint">
                    {portfolio.length >= 8 ? 'Nice portfolio.' : `Add ${8 - portfolio.length} more to reach 8 — fuller profiles stand out to brands.`}
                  </div>
                </section>
              </div>
            </div>
          </div>

          <section className="cui-d-sec">
            <div className="cui-d-sec-h cui-d-sec-h--wrap">
              <div className="cui-d-sec-t">
                <h2 className="cui-d-h22">New briefs for you</h2>
                <div className="cui-d-muted">{heroCategory ? `Matched to ${heroCategory} and your profile` : 'Open briefs you can apply to'}</div>
              </div>
              <span className="cui-d-tabs" role="tablist">
                <button type="button" role="tab" aria-selected={briefTab === 'match'} className={briefTab === 'match' ? 'is-on' : ''} onClick={() => setBriefTab('match')}>Best match</button>
                <button type="button" role="tab" aria-selected={briefTab === 'closing'} className={briefTab === 'closing' ? 'is-on' : ''} onClick={() => setBriefTab('closing')}>Closing soon</button>
              </span>
              {briefs.length > 0 && <button type="button" className="cui-d-link" onClick={() => navigate('/browse-briefs')}>See all {briefs.length} →</button>}
            </div>
            {briefs.length ? <div className="cui-d-briefs">{briefCards}</div> : (
              <div className="cui-d-card cui-d-empty">No open briefs right now. New briefs show up here as brands post them.</div>
            )}
          </section>
        </>
      )}

      {nudge.left.length > 0 && !nudgeLater && !selectedCampaign && (
        <div className="pcd-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="nudge-modal-title">
          <div className="pcd-modal">
            <h2 id="nudge-modal-title">Complete your profile</h2>
            <p>Add your {nudge.text} to finish setting up. Brands check these first before sending you deals.</p>
            <div>
              <button type="button" className="pcd-primary" autoFocus onClick={() => navigate(nudge.to)}>Complete now</button>
              <button
                type="button"
                onClick={() => {
                  try { sessionStorage.setItem('profileNudgeLater', '1'); } catch { /* private mode */ }
                  setNudgeLater(true);
                }}
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedCampaign && (
        <div className="pcd-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="bid-modal-title">
          <form className="pcd-modal" onSubmit={handleBidSubmit}>
            <h2 id="bid-modal-title">Submit Bid</h2>
            <p>{selectedCampaign.title}</p>
            {needsEditSplit(selectedCampaign) ? (
              <SplitBidFields value={split} max={maxCampaignBid(selectedCampaign)} onChange={(v, total) => { setSplit(v); setBidAmount(String(total)); }} />
            ) : (
            <label>
              Bid Amount
              <input type="number" inputMode="numeric" min="1" max={maxCampaignBid(selectedCampaign) || undefined} value={bidAmount} onKeyDown={blockNonDigitKey} onChange={(event) => setBidAmount(digitsOnly(event.target.value))} required />
            </label>
            )}
            <p>UGC.ad charges a 20% platform fee on this campaign.</p>
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
              <button type="submit" className="pcd-primary" disabled={bidSubmitting}>{bidSubmitting ? 'Submitting...' : 'Submit Bid'}</button>
            </div>
          </form>
        </div>
      )}
    </CreatorTopNavLayout>
  );
}

function Bar({ label, value, pct, hint }) {
  return (
    <div>
      <div className="cui-d-bar-h"><span className="cui-d-muted">{label}</span><strong>{value}</strong></div>
      <div className="cui-d-bar"><span style={{ width: `${Math.min(100, Math.max(0, pct || 0))}%` }} /></div>
      {hint ? <div className="cui-d-muted cui-d-bar-hint">{hint}</div> : null}
    </div>
  );
}

function BriefCard({ brief, onOpen }) {
  const [saved, setSaved] = useState(() => isBriefSaved(brief.id));
  const c = brief.campaign;
  const bids = (c.bids || []).length;
  const handleSave = () => {
    const now = toggleSavedBrief({
      id: brief.id, title: brief.title, description: brief.description,
      brand: brief.brand, logo: brief.logo, tags: brief.tags, budget: brief.budget,
      deliveryLabel: brief.deliveryLabel, matchScore: brief.matchScore,
    });
    setSaved(now);
    toast.success(now ? 'Saved to your list' : 'Removed from saved');
  };
  return (
    <article className="cui-d-card cui-d-brief">
      <div className="cui-d-brief-h">
        {brief.logo
          ? <img className="cui-d-brief-logo" src={mediaUrl(brief.logo)} alt="" />
          : <span className="cui-d-brief-logo" style={{ background: badgeColor(brief.brand) }}>{getInitial(brief.brand)}</span>}
        <div className="cui-d-brief-b">
          <b>{brief.brand}</b>
          <span className="cui-d-muted">{c.industry_type || 'UGC video'}{c.requires_shipment ? ' · Product shipped' : ''}</span>
        </div>
        <button type="button" className={`cui-d-save${saved ? ' is-on' : ''}`} aria-label={saved ? 'Remove from saved' : 'Save brief'} aria-pressed={saved} onClick={handleSave}>
          <Bookmark size={16} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>
      <button type="button" className="cui-d-brief-m" onClick={() => onOpen(brief)}>
        {brief.createdAt ? <span className="cui-d-muted cui-d-sm">Posted {timeAgo(brief.createdAt)}</span> : null}
        <strong>{brief.title}</strong>
        <p>{brief.description}</p>
      </button>
      <div className="cui-d-facts">
        <div><small>Format</small><b>{brief.deliverables || 'See brief'}</b></div>
        <div><small>Deliver in</small><b>{brief.deliveryLabel}</b></div>
        <div><small>Product</small><b>{c.requires_shipment ? 'Shipped' : 'Not needed'}</b></div>
      </div>
      <div className="cui-d-brief-f">
        <div>
          <b>{budgetRange(c)}</b>
          <span className="cui-d-muted">Bid your price{bids ? ` · ${bids} bid${bids === 1 ? '' : 's'}` : ''}</span>
        </div>
        <button type="button" className="cui-d-go" onClick={() => onOpen(brief)}>{brief.hasBid ? 'View bid' : 'Apply'}{!brief.hasBid && <ArrowRight size={15} />}</button>
      </div>
    </article>
  );
}
