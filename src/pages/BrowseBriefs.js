import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { Bookmark, X, Send } from 'lucide-react';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import '../styles/creator-marketplace.css';
import EmptyState from '../components/EmptyState';
import BriefDetailDrawer from '../components/BriefDetailDrawer';
import { Skeleton } from '../components/Skeleton';
import normalizeBrief, { timeAgo } from '../utils/normalizeBrief';
import { isOpenForBids } from '../utils/campaignCreators';
import { toggleSavedBrief, getSavedIds } from '../utils/savedBriefs';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const getInitial = (name) => (name || 'B').trim().charAt(0).toUpperCase();

const CATEGORIES = ['All Categories', 'Beauty', 'Fashion', 'Tech', 'Fitness', 'Food', 'Lifestyle', 'Travel', 'Home', 'Gaming', 'Kids'];

export default function BrowseBriefs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [availableCampaigns, setAvailableCampaigns] = useState([]);
  const [myBids, setMyBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState('All Categories');
  const [sortBy, setSortBy] = useState('recommended');
  const [budgetFilter, setBudgetFilter] = useState('any');
  const [deliveryFilter, setDeliveryFilter] = useState('any');
  const [visible, setVisible] = useState(8);
  const [openBrief, setOpenBrief] = useState(null); // brief object shown in the side drawer
  const [savedIds, setSavedIds] = useState(() => getSavedIds()); // ids of saved briefs
  // Bid form — opened straight from the drawer so no redirect to the detail page.
  const [bidBrief, setBidBrief] = useState(null);   // brief being bid on
  const [bidAmount, setBidAmount] = useState('');
  const [deliveryDays, setDeliveryDays] = useState('');
  const [proposal, setProposal] = useState('');
  const [submittingBid, setSubmittingBid] = useState(false);

  const openBidForm = (b) => {
    setBidAmount(''); setDeliveryDays(''); setProposal('');
    setBidBrief(b);
  };

  const handleSubmitBid = async (e) => {
    e.preventDefault();
    setSubmittingBid(true);
    try {
      await axios.post(`${API}/campaigns/${bidBrief.id}/bid`, {
        campaign_id: bidBrief.id,
        amount: parseFloat(bidAmount),
        proposal,
        estimated_delivery_days: parseInt(deliveryDays, 10),
      });
      toast.success('Bid submitted successfully!');
      setBidBrief(null);
      setOpenBrief(null);
      fetchData();
    } catch (error) {
      const msg = error?.response?.data?.detail || 'Failed to submit bid';
      toast.error(typeof msg === 'string' ? msg : 'Failed to submit bid');
    } finally {
      setSubmittingBid(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the bookmark state in sync if saves change here or on the Saved page.
  useEffect(() => {
    const sync = () => setSavedIds(getSavedIds());
    window.addEventListener('ugc-saved-changed', sync);
    return () => window.removeEventListener('ugc-saved-changed', sync);
  }, []);

  // Keep the search box in sync when arriving from the top-nav search (?q=...)
  useEffect(() => {
    setSearch(searchParams.get('q') || '');
    setVisible(8);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/campaigns?t=${Date.now()}`);
      const all = res.data;
      // Stay listed while the brief still has creator slots open — hiding it on the
      // first hire meant a 5-creator brief could only ever fill one slot.
      setAvailableCampaigns(all.filter(isOpenForBids));
      setMyBids(all.filter((c) => c.bids?.some((b) => b.creator_id === user?.id)));
    } catch {
      toast.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  const briefs = useMemo(
    () => availableCampaigns.map((c, i) => normalizeBrief(c, i, myBids)),
    [availableCampaigns, myBids]
  );

  // Deep-link: open a specific brief's drawer from a shared URL (?open=<id>).
  useEffect(() => {
    const openId = searchParams.get('open');
    if (openId && briefs.length) {
      const b = briefs.find((x) => String(x.id) === String(openId));
      if (b) setOpenBrief(b);
    }
  }, [briefs, searchParams]);

  const filtered = useMemo(() => {
    const cat = category.toLowerCase();
    const inBudget = (v) => {
      switch (budgetFilter) {
        case '0-2000': return v < 2000;
        case '2000-5000': return v >= 2000 && v <= 5000;
        case '5000-10000': return v > 5000 && v <= 10000;
        case '10000+': return v > 10000;
        default: return true;
      }
    };
    const inDelivery = (d) => {
      switch (deliveryFilter) {
        case '3': return d <= 3;
        case '5': return d <= 5;
        case '7': return d <= 7;
        case '7+': return d > 7;
        default: return true;
      }
    };
    const q = search.trim().toLowerCase();
    return briefs
      .filter((b) => {
        if (category !== 'All Categories') {
          const hay = `${b.industryType} ${b.tags.join(' ')} ${b.title}`.toLowerCase();
          if (!hay.includes(cat)) return false;
        }
        if (q) {
          const hay = `${b.title} ${b.brand} ${b.description} ${b.industryType} ${b.tags.join(' ')}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return inBudget(b.budgetMax) && inDelivery(b.deliveryDays);
      })
      .sort((a, b) => {
        if (sortBy === 'highest') return b.budgetMax - a.budgetMax;
        if (sortBy === 'newest') return b.createdAt - a.createdAt;
        return b.matchScore - a.matchScore;
      });
  }, [briefs, search, category, sortBy, budgetFilter, deliveryFilter]);

  const shown = filtered.slice(0, visible);

  return (
    <CreatorTopNavLayout notifications={0}>
      <div className="cmk-page-head">
        <h1>Browse Campaigns</h1>
        <p>Find exciting brands to collaborate with and create content.</p>
      </div>
      {search.trim() && (
        <div className="cmk-search-note">
          Showing results for <strong>“{search.trim()}”</strong>
          <span className="cmk-search-count">· {filtered.length} match{filtered.length === 1 ? '' : 'es'}</span>
          <button
            type="button"
            className="cmk-search-clear"
            onClick={() => { setSearch(''); setSearchParams({}, { replace: true }); setVisible(8); }}
          >
            Clear search
          </button>
        </div>
      )}

      {/* filter row */}
      <div className="cmk-filter-row">
        <div className="cmk-sort">
          <label>Budget</label>
          <select value={budgetFilter} onChange={(e) => { setBudgetFilter(e.target.value); setVisible(8); }}>
            <option value="any">Any budget</option>
            <option value="0-2000">Under ₹2,000</option>
            <option value="2000-5000">₹2,000 – ₹5,000</option>
            <option value="5000-10000">₹5,000 – ₹10,000</option>
            <option value="10000+">₹10,000+</option>
          </select>
        </div>
        <div className="cmk-sort">
          <label>Delivery</label>
          <select value={deliveryFilter} onChange={(e) => { setDeliveryFilter(e.target.value); setVisible(8); }}>
            <option value="any">Any time</option>
            <option value="3">Within 3 days</option>
            <option value="5">Within 5 days</option>
            <option value="7">Within 7 days</option>
            <option value="7+">More than 7 days</option>
          </select>
        </div>
        <div className="cmk-sort">
          <label>Sort by</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="recommended">Recommended</option>
            <option value="highest">Highest Payout</option>
            <option value="newest">Newest</option>
          </select>
        </div>
        {(budgetFilter !== 'any' || deliveryFilter !== 'any') && (
          <button type="button" className="cmk-filter-clear" onClick={() => { setBudgetFilter('any'); setDeliveryFilter('any'); }}>Clear filters</button>
        )}
      </div>

      {/* grid */}
      {shown.length ? (
        <div className="cmk-bb-grid">
          {shown.map((b) => (
            <article key={b.id} className="cmk-bb-card cmk-rise" onClick={() => b.id ? setOpenBrief(b) : toast.error('This brief is unavailable')}>
              <div className="cmk-bb-top">
                {/* Brand logo pulled from the brand's profile (brand_logo) */}
                <span className="cmk-bb-logo">
                  {b.logo ? <img src={b.logo.startsWith('http') ? b.logo : `${BACKEND_URL}${b.logo}`} alt="" /> : getInitial(b.brand)}
                </span>
                <button
                  type="button"
                  className={`cmk-bb-save${savedIds.has(String(b.id)) ? ' is-saved' : ''}`}
                  onClick={(e) => { e.stopPropagation(); const s = toggleSavedBrief(b); toast.success(s ? 'Saved to your list' : 'Removed from saved'); }}
                  aria-label={savedIds.has(String(b.id)) ? 'Remove from saved' : 'Save brief'}
                >
                  <Bookmark size={16} fill={savedIds.has(String(b.id)) ? 'currentColor' : 'none'} />
                </button>
              </div>
              <div className="cmk-bb-head">
                <div className="cmk-bb-brandrow">
                  <strong className="cmk-bb-brand">{b.brand}</strong>
                  {b.createdAt ? <span className="cmk-bb-time">{timeAgo(b.createdAt)}</span> : null}
                </div>
                <h3 className="cmk-bb-title">{b.title}</h3>
              </div>
              <div className="cmk-bb-tags">
                {[...(b.tags || []).slice(0, 2), b.deliveryLabel].filter(Boolean).map((t, i) => (
                  <span className="cmk-bb-pill" key={i}>{t}</span>
                ))}
              </div>
              <div className="cmk-bb-divider" />
              <div className="cmk-bb-foot">
                <div className="cmk-bb-price">{b.budget}<small>{b.matchScore}% match</small></div>
                <button
                  type="button"
                  className="cmk-bb-apply"
                  onClick={(e) => { e.stopPropagation(); b.id ? setOpenBrief(b) : toast.error('This brief is unavailable'); }}
                >
                  Apply now
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : loading ? (
        <div className="cmk-bb-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <article className="cmk-bb-card" key={i} aria-hidden="true">
              <div className="cmk-bb-top">
                <Skeleton width={46} height={46} radius={13} />
                <Skeleton width={34} height={34} radius={10} />
              </div>
              <div className="cmk-bb-head">
                <Skeleton width="45%" height={12} />
                <Skeleton width="80%" height={16} style={{ marginTop: 6 }} />
              </div>
              <div className="cmk-bb-tags">
                <Skeleton width={64} height={24} radius={8} />
                <Skeleton width={74} height={24} radius={8} />
              </div>
              <div className="cmk-bb-divider" />
              <div className="cmk-bb-foot">
                <Skeleton width={84} height={22} />
                <Skeleton width={92} height={38} radius={11} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="No campaigns found" message="No campaigns match your search or filters right now. Try a different category or check back soon." />
      )}

      {visible < filtered.length && (
        <div className="cmk-loadmore">
          <button type="button" onClick={() => setVisible((v) => v + 8)}>Load more briefs</button>
        </div>
      )}

      <BriefDetailDrawer
        brief={openBrief}
        onClose={() => setOpenBrief(null)}
        onBid={(b) => {
          if (b.hasBid) return navigate(`/campaign/${b.id}`);
          // KYC gate: unverified creators can't bid — nudge them to verify first.
          if (user?.kyc?.status !== 'verified') {
            toast.error('Verify your KYC before submitting a bid.');
            return navigate('/kyc');
          }
          openBidForm(b);
        }}
      />

      {bidBrief && (
        <div className="bb-bid-overlay" onClick={() => !submittingBid && setBidBrief(null)}>
          <div className="bb-bid-modal" onClick={(e) => e.stopPropagation()}>
            <div className="bb-bid-head">
              <h2>Submit Your Bid</h2>
              <button type="button" className="bb-bid-x" aria-label="Close" onClick={() => setBidBrief(null)}><X size={18} /></button>
            </div>
            <p className="bb-bid-sub">{bidBrief.title || 'Campaign'} · {bidBrief.brand || 'Brand'}</p>
            <form onSubmit={handleSubmitBid} className="bb-bid-form">
              <label>Bid Amount (₹)
                <input type="number" min="1" required value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} placeholder="Enter your bid amount" />
              </label>
              <label>Estimated Delivery (days)
                <input type="number" min="1" required value={deliveryDays} onChange={(e) => setDeliveryDays(e.target.value)} placeholder="How many days to complete?" />
              </label>
              <label>Your Proposal
                <textarea rows={4} required value={proposal} onChange={(e) => setProposal(e.target.value)} placeholder="Describe your approach, experience, and why you're the right fit..." />
              </label>
              <div className="bb-bid-actions">
                <button type="button" className="bb-d-ghost" onClick={() => setBidBrief(null)} disabled={submittingBid}>Cancel</button>
                <button type="submit" className="bb-d-primary" disabled={submittingBid}>
                  <Send size={16} /> {submittingBid ? 'Submitting…' : 'Submit Bid'}
                </button>
              </div>
            </form>
          </div>
          <style>{`
            .bb-bid-overlay { position: fixed; inset: 0; background: rgba(15,18,40,.5); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; z-index: 1200; padding: 20px; }
            .bb-bid-modal { width: 100%; max-width: 460px; background: #fff; border-radius: 18px; box-shadow: 0 24px 60px rgba(7,7,78,.28); padding: 22px; }
            .bb-bid-head { display: flex; align-items: center; justify-content: space-between; }
            .bb-bid-head h2 { margin: 0; font-size: 1.15rem; color: #0f1132; }
            .bb-bid-x { border: 0; background: #f3f4f8; color: #5b6573; width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; cursor: pointer; }
            .bb-bid-x:hover { background: #e8eaf1; }
            .bb-bid-sub { margin: 4px 0 16px; font-size: .86rem; color: #8a8fb5; }
            .bb-bid-form { display: flex; flex-direction: column; gap: 14px; }
            .bb-bid-form label { display: flex; flex-direction: column; gap: 6px; font-size: .84rem; font-weight: 600; color: #3a3f63; }
            .bb-bid-form input, .bb-bid-form textarea { border: 1px solid #e6e8f2; border-radius: 11px; padding: 11px 13px; font-size: .92rem; font-family: inherit; color: #15163a; outline: 0; font-weight: 400; }
            .bb-bid-form input:focus, .bb-bid-form textarea:focus { border-color: #5b6bff; box-shadow: 0 0 0 3px rgba(91,107,255,.14); }
            .bb-bid-form textarea { resize: vertical; }
            .bb-bid-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 4px; }
          `}</style>
        </div>
      )}
    </CreatorTopNavLayout>
  );
}
