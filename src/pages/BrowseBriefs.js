import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { Bookmark, Clock, SlidersHorizontal, Star, ChevronDown } from 'lucide-react';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import '../styles/creator-marketplace.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const getInitial = (name) => (name || 'B').trim().charAt(0).toUpperCase();
const formatMoney = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const getCampaignBudget = (c) => {
  if (!c) return 'Rs. 0';
  const min = c.budget_min ?? c.budget ?? 0;
  const max = c.budget_max ?? min;
  return min === max ? formatMoney(min) : `${formatMoney(min)} - ${formatMoney(max)}`;
};

const CATEGORIES = ['All Categories', 'Beauty', 'Fashion', 'Tech', 'Fitness', 'Food', 'Lifestyle', 'Travel', 'Home', 'Gaming', 'Kids'];

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
    description: c.brief_text || 'Create engaging UGC content for this brand.',
    brand: c.business_nickname || c.brand_handle || 'Brand',
    logo: c.brand_logo,
    tags: objectives.length ? objectives.slice(0, 2) : [(c.industry_type || 'UGC'), 'UGC Video'],
    budget: getCampaignBudget(c),
    budgetMax,
    deliveryLabel: d ? `${d} Days` : '3 - 5 Days',
    matchScore,
    hasBid,
    createdAt: c.created_at ? new Date(c.created_at).getTime() : 0,
    industryType: (c.industry_type || '').toLowerCase(),
  };
}

export default function BrowseBriefs() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [availableCampaigns, setAvailableCampaigns] = useState([]);
  const [myBids, setMyBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All Categories');
  const [sortBy, setSortBy] = useState('recommended');
  const [visible, setVisible] = useState(8);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const filtered = useMemo(() => {
    const cat = category.toLowerCase();
    return briefs
      .filter((b) => {
        if (category === 'All Categories') return true;
        const hay = `${b.industryType} ${b.tags.join(' ')} ${b.title}`.toLowerCase();
        return hay.includes(cat);
      })
      .sort((a, b) => {
        if (sortBy === 'highest') return b.budgetMax - a.budgetMax;
        if (sortBy === 'newest') return b.createdAt - a.createdAt;
        return b.matchScore - a.matchScore;
      });
  }, [briefs, category, sortBy]);

  const shown = filtered.slice(0, visible);

  return (
    <CreatorTopNavLayout notifications={0}>
      {/* category bar */}
      <div className="cmk-cat-bar">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            className={category === cat ? 'is-active' : ''}
            onClick={() => { setCategory(cat); setVisible(8); }}
          >
            {cat}
          </button>
        ))}
        <button type="button" className="cmk-cat-more">More <ChevronDown size={14} /></button>
      </div>

      <div className="cmk-page-head">
        <h1>Explore Briefs</h1>
        <p>Find exciting brands to collaborate with and create content.</p>
      </div>

      {/* filter row */}
      <div className="cmk-filter-row">
        <div className="cmk-select"><span>Category</span><ChevronDown size={16} /></div>
        <div className="cmk-select"><span>Budget</span><ChevronDown size={16} /></div>
        <div className="cmk-select"><span>Delivery Time</span><ChevronDown size={16} /></div>
        <div className="cmk-select"><span>Platform</span><ChevronDown size={16} /></div>
        <div className="cmk-sort">
          <label>Sort by</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="recommended">Recommended</option>
            <option value="highest">Highest Payout</option>
            <option value="newest">Newest</option>
          </select>
        </div>
        <button type="button" className="cmk-filter-btn"><SlidersHorizontal size={16} /> Filter</button>
      </div>

      {/* grid */}
      {shown.length ? (
        <div className="cmk-bb-grid">
          {shown.map((b) => (
            <article key={b.id} className="cmk-bb-card cmk-rise" onClick={() => b.id ? navigate(`/campaign/${b.id}`) : toast.error('This brief is unavailable')}>
              <div className="cmk-bb-top">
                <span className="cmk-bb-logo">
                  {b.logo ? <img src={b.logo.startsWith('http') ? b.logo : `${BACKEND_URL}${b.logo}`} alt="" /> : getInitial(b.brand)}
                </span>
                <strong className="cmk-bb-brand">{b.brand}</strong>
                <button type="button" className="cmk-bb-save" onClick={(e) => { e.stopPropagation(); toast.success('Saved'); }} aria-label="Save brief">
                  <Bookmark size={16} />
                </button>
              </div>
              <h3 className="cmk-bb-title">{b.title}</h3>
              <div className="cmk-bb-tags">
                {b.tags.map((t) => <span key={t}>{t}</span>)}
              </div>
              <p className="cmk-bb-desc">{b.description}</p>
              <div className="cmk-bb-meta">
                <strong>{b.budget}</strong>
                <span><Clock size={14} /> {b.deliveryLabel}</span>
              </div>
              <div className="cmk-bb-match"><Star size={13} /> {b.matchScore}% Match</div>
            </article>
          ))}
        </div>
      ) : (
        <div className="cmk-empty">{loading ? 'Loading briefs…' : 'No briefs found in this category.'}</div>
      )}

      {visible < filtered.length && (
        <div className="cmk-loadmore">
          <button type="button" onClick={() => setVisible((v) => v + 8)}>Load more briefs</button>
        </div>
      )}
    </CreatorTopNavLayout>
  );
}
