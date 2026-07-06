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
              <div className="cmk-bb-top">
                <span className="cmk-bb-logo">
                  {b.logo ? <img src={b.logo.startsWith('http') ? b.logo : `${BACKEND_URL}${b.logo}`} alt="" /> : getInitial(b.brand)}
                </span>
                <strong className="cmk-bb-brand">{b.brand}</strong>
                <button
                  type="button"
                  className={`cmk-bb-save${savedIds.has(String(b.id)) ? ' is-saved' : ''}`}
                  style={savedIds.has(String(b.id)) ? { color: '#5b6bff' } : undefined}
                  onClick={(e) => { e.stopPropagation(); const s = toggleSavedBrief(b); toast.success(s ? 'Saved to your list' : 'Removed from saved'); }}
                  aria-label={savedIds.has(String(b.id)) ? 'Remove from saved' : 'Save brief'}
                >
                  <Bookmark size={16} fill={savedIds.has(String(b.id)) ? 'currentColor' : 'none'} />
                </button>
              </div>
              <h3 className="cmk-bb-title">{b.title}</h3>
              <div className="cmk-bb-tags">
                {b.tags.map((t) => <span key={t} className={catClass(t)}>{t}</span>)}
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
        loading ? <div className="cmk-empty">Loading briefs…</div> : <EmptyState title="No campaigns found" message="No campaigns match your search or filters right now. Try a different category or check back soon." />
      )}

      {visible < filtered.length && (
        <div className="cmk-loadmore">
          <button type="button" onClick={() => setVisible((v) => v + 8)}>Load more briefs</button>
        </div>
      )}

      {openBrief && (() => {
        const b = openBrief;
        const objectives = Array.isArray(b.campaign?.objectives) ? b.campaign.objectives.filter(Boolean) : [];
        return (
          <div className="bb-drawer-overlay" onClick={() => setOpenBrief(null)}>
            <aside className="bb-drawer" onClick={(e) => e.stopPropagation()}>
              <div className="bb-d-head">
                <span className="bb-d-logo">
                  {b.logo ? <img src={b.logo.startsWith('http') ? b.logo : `${BACKEND_URL}${b.logo}`} alt="" /> : getInitial(b.brand)}
                </span>
                <div className="bb-d-id">
                  <strong>{b.title}</strong>
                  <small>{b.brand}</small>
                </div>
                <button type="button" className="bb-drawer-close" aria-label="Close" onClick={() => setOpenBrief(null)}><X size={18} /></button>
              </div>

              <div className="bb-d-body">
                <div className="bb-d-stats">
                  <div><span className="bb-d-ic"><Wallet size={16} /></span><div><label>Budget</label><strong>{b.budget}</strong></div></div>
                  <div><span className="bb-d-ic"><Clock size={16} /></span><div><label>Delivery</label><strong>{b.deliveryLabel}</strong></div></div>
                  <div><span className="bb-d-ic"><Star size={16} /></span><div><label>Match</label><strong>{b.matchScore}%</strong></div></div>
                </div>

                {b.tags?.length > 0 && (
                  <div className="bb-d-tags">{b.tags.map((t) => <span key={t} className={catClass(t)}>{t}</span>)}</div>
                )}

                <div className="bb-d-sec">
                  <h4>Campaign Brief</h4>
                  <div className="bb-d-brief">{renderBrief(b.description)}</div>
                </div>

                {objectives.length > 0 && (
                  <div className="bb-d-sec">
                    <h4><Target size={15} /> Objectives</h4>
                    <div className="bb-d-chips">{objectives.map((o, i) => <span key={i}>{o}</span>)}</div>
                  </div>
                )}
              </div>

              <div className="bb-d-foot">
                <button type="button" className="bb-d-ghost" onClick={() => setOpenBrief(null)}>Close</button>
                <button type="button" className="bb-d-primary" onClick={() => navigate(`/campaign/${b.id}`)}>
                  <Send size={16} /> {b.hasBid ? 'View Your Bid' : 'Submit Your Bid'}
                </button>
              </div>
            </aside>

            <style>{`
              .bb-drawer-overlay{position:fixed;inset:0;z-index:1000;background:rgba(15,22,58,.45);backdrop-filter:blur(2px);display:flex;justify-content:flex-end}
              .bb-drawer{position:relative;width:min(460px,100%);height:100%;background:#fff;display:flex;flex-direction:column;box-shadow:-20px 0 50px rgba(15,22,58,.25);animation:bb-slide .28s cubic-bezier(.2,.7,.2,1)}
              @keyframes bb-slide{from{transform:translateX(44px);opacity:.5}to{transform:none;opacity:1}}
              .bb-d-head{display:flex;align-items:center;gap:12px;padding:20px 22px;border-bottom:1px solid #e9ebf4}
              .bb-d-logo{width:44px;height:44px;flex:none;border-radius:12px;overflow:hidden;display:grid;place-items:center;background:linear-gradient(135deg,#5b6bff,#23236a);color:#fff;font-weight:800;font-size:17px}
              .bb-d-logo img{width:100%;height:100%;object-fit:cover}
              .bb-d-id{flex:1;min-width:0}
              .bb-d-id strong{display:block;font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:17px;color:#15163a;line-height:1.25}
              .bb-d-id small{color:#9296ba;font-size:13px}
              .bb-drawer-close{flex:none;width:34px;height:34px;border-radius:10px;border:none;background:#f1f3fa;color:#15163a;cursor:pointer;display:grid;place-items:center}
              .bb-drawer-close:hover{background:#e7eaf5}
              .bb-d-body{flex:1;overflow:auto;padding:20px 22px;display:flex;flex-direction:column;gap:20px}
              .bb-d-stats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
              .bb-d-stats>div{display:flex;align-items:center;gap:9px;background:#f6f7fc;border:1px solid #e9ebf4;border-radius:12px;padding:11px 12px}
              .bb-d-ic{flex:none;width:30px;height:30px;border-radius:9px;display:grid;place-items:center;background:#eef0ff;color:#5b6bff}
              .bb-d-stats label{display:block;color:#9296ba;font-size:11px;font-weight:600}
              .bb-d-stats strong{color:#15163a;font-size:14px;font-family:var(--font-head,'Plus Jakarta Sans',sans-serif)}
              .bb-d-tags{display:flex;flex-wrap:wrap;gap:7px}
              .bb-d-tags span{font-size:12px;font-weight:700;padding:4px 11px;border-radius:20px;background:#eef0ff;color:#5b6bff;text-transform:capitalize}
              .bb-d-sec h4{margin:0 0 9px;font-size:13px;font-weight:800;color:#5b6bff;text-transform:uppercase;letter-spacing:.4px;display:flex;align-items:center;gap:6px}
              .bb-d-brief{display:flex;flex-direction:column;gap:7px}
              .bb-bl{margin:0;color:#585c7e;font-size:14px;line-height:1.6}
              .bb-blab{color:#15163a;font-weight:700}
              .bb-d-chips{display:flex;flex-wrap:wrap;gap:7px}
              .bb-d-chips span{background:#f1f3fa;color:#585c7e;font-size:12.5px;font-weight:600;padding:5px 12px;border-radius:20px}
              .bb-d-foot{display:flex;gap:10px;padding:16px 22px;border-top:1px solid #e9ebf4}
              .bb-d-ghost,.bb-d-primary{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;height:46px;border-radius:14px;font-family:inherit;font-weight:700;font-size:14.5px;cursor:pointer;border:1px solid transparent}
              .bb-d-ghost{background:#fff;border-color:#e9ebf4;color:#15163a}
              .bb-d-ghost:hover{border-color:#d3d7f0}
              .bb-d-primary{background:linear-gradient(100deg,#12124f,#07074e);color:#fff;box-shadow:0 12px 26px -12px rgba(7,7,78,.7)}
              .bb-d-primary:hover{transform:translateY(-1px)}
              @media (max-width:520px){.bb-d-stats{grid-template-columns:1fr}}
            `}</style>
          </div>
        );
      })()}
    </CreatorTopNavLayout>
  );
}
