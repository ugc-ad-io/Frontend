import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { Bookmark, Clock, SlidersHorizontal, Star, ChevronDown, X, Send, Wallet, Target } from 'lucide-react';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import '../styles/creator-marketplace.css';
import EmptyState from '../components/EmptyState';
import { toggleSavedBrief, getSavedIds } from '../utils/savedBriefs';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const getInitial = (name) => (name || 'B').trim().charAt(0).toUpperCase();
const formatMoney = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

// Cover banner gradient — deterministic per brand so each card reads distinctly
// (mirrors the brand-side campaign cards' thumbnail look).
const COVER_GRADIENTS = [
  'linear-gradient(135deg,#c7d2fe,#a5b4fc)',
  'linear-gradient(135deg,#fbcfe8,#f9a8d4)',
  'linear-gradient(135deg,#bfdbfe,#93c5fd)',
  'linear-gradient(135deg,#bbf7d0,#86efac)',
  'linear-gradient(135deg,#fde68a,#fcd34d)',
  'linear-gradient(135deg,#ddd6fe,#c4b5fd)',
];
const coverBg = (name) => {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return COVER_GRADIENTS[h % COVER_GRADIENTS.length];
};

// Map a niche/tag to a consistent colour class so each category reads distinctly.
const CAT_MAP = [
  [/beauty|skin|makeup|cosmet/i, 'c-beauty'],
  [/tech|gadget|electronic|app|software/i, 'c-tech'],
  [/fashion|apparel|cloth|style|jewel/i, 'c-fashion'],
  [/life ?style|home|decor|interior/i, 'c-lifestyle'],
  [/food|snack|beverage|drink|recipe|cook/i, 'c-food'],
  [/fit|gym|health|wellness|yoga|sport/i, 'c-fitness'],
  [/travel|trip|tour|hotel|destination/i, 'c-travel'],
  [/game|gaming|esport/i, 'c-gaming'],
  [/finance|fintech|bank|invest|money/i, 'c-finance'],
];
const catClass = (tag) => (CAT_MAP.find(([re]) => re.test(String(tag || '')))?.[1]) || 'c-default';

// Render the newline-separated brief into a readable definition list.
const renderBrief = (text) => {
  const lines = String(text || '').split('\n');
  const out = [];
  lines.forEach((line, i) => {
    const t = line.trim();
    if (!t) return;
    const idx = t.indexOf(':');
    if (idx > 0 && idx <= 28) {
      out.push(<p key={i} className="bb-bl"><span className="bb-blab">{t.slice(0, idx)}:</span> {t.slice(idx + 1).trim()}</p>);
    } else {
      out.push(<p key={i} className="bb-bl">{t}</p>);
    }
  });
  return out.length ? out : <p className="bb-bl">No brief details provided.</p>;
};

const getCampaignBudget = (c) => {
  if (!c) return 'Rs. 0';
  const min = c.budget_min ?? c.budget ?? 0;
  const max = c.budget_max ?? min;
  return min === max ? formatMoney(min) : `${formatMoney(min)} - ${formatMoney(max)}`;
};

const CATEGORIES = ['All Categories', 'Beauty', 'Fashion', 'Tech', 'Fitness', 'Food', 'Lifestyle', 'Travel', 'Home', 'Gaming', 'Kids'];

// The card preview should read like a sentence — not the raw "Label: value" brief
// dump. Prefer the product description, else pull the "Product description:" line
// out of the brief, else a generic line.
function cardDescription(c) {
  if (c.product_description && c.product_description.trim()) return c.product_description.trim();
  const text = String(c.brief_text || '');
  const m = text.match(/product description:\s*([^\n]+)/i)
    || text.match(/key message:\s*([^\n]+)/i)
    || text.match(/hook:\s*([^\n]+)/i);
  if (m) return m[1].trim();
  // If the brief isn't the structured label format, use its first real line.
  const firstLine = text.split('\n').map((l) => l.trim()).find(Boolean);
  if (firstLine && !/^[a-z ]{2,28}:/i.test(firstLine)) return firstLine;
  return 'Create engaging UGC content for this brand.';
}

function normalizeBrief(c, index, myBids) {
  const objectives = Array.isArray(c.objectives) ? c.objectives.filter(Boolean) : [];
  const hasBid = myBids.some((b) => b.id === c.id);
  const budgetMax = Number(c.budget_max ?? c.budget ?? 0);
  const matchScore = Math.min(98, 76 + objectives.length * 4 + (c.requires_shipment ? 3 : 0) + (index % 3) * 2);
  const d = c.estimated_delivery_days || c.delivery_days;
  return {
    campaign: c,
    id: c.id || c._id,
    title: c.title,
    description: cardDescription(c),
    brand: c.business_nickname || c.brand_handle || 'Brand',
    logo: c.brand_logo,
    image_url: c.image_url || c.cover_image || '',
    tags: objectives.length ? objectives.slice(0, 2) : [(c.industry_type || 'UGC'), 'UGC Video'],
    budget: getCampaignBudget(c),
    budgetMax,
    deliveryLabel: d ? `${d} Days` : '3 - 5 Days',
    deliveryDays: Number(d) || 5,
    matchScore,
    hasBid,
    createdAt: c.created_at ? new Date(c.created_at).getTime() : 0,
    industryType: (c.industry_type || '').toLowerCase(),
  };
}

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
      setAvailableCampaigns(all.filter((c) => c.status === 'active' && !c.selected_creator));
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

  // Deep-link: open a specific brief's drawer when arriving from Saved (?open=<id>).
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
              <div className="cmk-bb-cover" style={b.image_url ? undefined : { background: coverBg(b.brand) }}>
                {b.image_url && <img className="cmk-bb-cover-img" src={b.image_url.startsWith('http') ? b.image_url : `${BACKEND_URL}${b.image_url}`} alt="" />}
                <span className="cmk-bb-badge"><Star size={11} /> {b.matchScore}% Match</span>
                <button
                  type="button"
                  className={`cmk-bb-save${savedIds.has(String(b.id)) ? ' is-saved' : ''}`}
                  onClick={(e) => { e.stopPropagation(); const s = toggleSavedBrief(b); toast.success(s ? 'Saved to your list' : 'Removed from saved'); }}
                  aria-label={savedIds.has(String(b.id)) ? 'Remove from saved' : 'Save brief'}
                >
                  <Bookmark size={16} fill={savedIds.has(String(b.id)) ? 'currentColor' : 'none'} />
                </button>
              </div>
              <div className="cmk-bb-body">
                <div className="cmk-bb-brandrow">
                  <span className="cmk-bb-logo">
                    {b.logo ? <img src={b.logo.startsWith('http') ? b.logo : `${BACKEND_URL}${b.logo}`} alt="" /> : getInitial(b.brand)}
                  </span>
                  <strong className="cmk-bb-brand">{b.brand}</strong>
                </div>
                <h3 className="cmk-bb-title">{b.title}</h3>
                <p className="cmk-bb-sub">{[b.tags[0], b.deliveryLabel].filter(Boolean).join(' · ')}</p>
                <div className="cmk-bb-budget">{b.budget}</div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        loading ? <div className="cmk-empty">Loading briefs…</div> : <EmptyState title="No campaigns found" message="No campaigns match your search or filters right now. Try a different category or check back soon." />
      )}

      {visible < filtered.length && (
        <div className="cmk-loadmore">
          <button type="button" onClick={() => setVisible((v) => v + 8)}>Load more briefs</button>
        </div>
      )}

      <BriefDetailDrawer
        brief={openBrief}
        onClose={() => setOpenBrief(null)}
        onBid={(b) => (b.hasBid ? navigate(`/campaign/${b.id}`) : openBidForm(b))}
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
