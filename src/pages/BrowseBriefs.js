import { useLiveEffect } from '../lib/liveUpdates';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { Search, ChevronDown, X, CheckCircle2 } from 'lucide-react';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import CreatorPageHead from '../components/CreatorPageHead';
import EmptyState from '../components/EmptyState';
import BriefDetailDrawer from '../components/BriefDetailDrawer';
import BriefCard, { BriefCardSkeleton } from '../components/BriefCard';
import BriefApplyForm from '../components/BriefApplyForm';
import BriefInvites, { isInviteDeal } from '../components/BriefInvites';
import { BriefLogo, inr } from '../components/briefUi';
import { MyBidsContent } from './MyBidsPage';
import normalizeBrief from '../utils/normalizeBrief';
import { isOpenForBids, isSelectedCreator, needsEditSplit } from '../utils/campaignCreators';
import { EMPTY_SPLIT, splitPayload } from '../components/SplitBidFields';
import { useBidGate } from '../components/BidGate';
import { toggleSavedBrief, getSavedIds, hydrateSavedFromServer } from '../utils/savedBriefs';
import { maxCampaignBid, bidOverBudgetMessage } from '../utils/bidBudget';
import { apiErrorMessage } from '../utils/apiError';
import '../styles/creator-ui-briefs.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const CATEGORIES = ['All Categories', 'Beauty', 'Fashion', 'Tech', 'Fitness', 'Food', 'Lifestyle', 'Travel', 'Home', 'Gaming', 'Kids'];
const PAGE = 8;

// A filter shown as a pill: "Label  Value ▾" (a native <select> underneath, so it works on touch).
function Chip({ label, value, display, active, onChange, children }) {
  return (
    <label className={`cui-b-chip${active ? ' is-on' : ''}`}>
      <span>{label}</span>
      <strong>{display}</strong>
      <select aria-label={label} value={value} onChange={onChange}>{children}</select>
      <ChevronDown size={14} />
    </label>
  );
}

export default function BrowseBriefs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  // Tabs of the Find briefs page: all briefs / invites / applied (Saved has its own page).
  const tabParam = searchParams.get('tab');
  const tab = tabParam === 'applied' || tabParam === 'invites' ? tabParam : 'all';

  const [availableCampaigns, setAvailableCampaigns] = useState([]);
  const [myBids, setMyBids] = useState([]);
  const [deals, setDeals] = useState([]);
  const [appliedCount, setAppliedCount] = useState(null); // from /bids/my once the Applied tab has loaded
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [dealsError, setDealsError] = useState('');
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [term, setTerm] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState('All Categories');
  const [sortBy, setSortBy] = useState('newest');
  const [budgetFilter, setBudgetFilter] = useState('any');
  const [deliveryFilter, setDeliveryFilter] = useState('any');
  const [visible, setVisible] = useState(PAGE);
  const [openBrief, setOpenBrief] = useState(null); // brief object shown in the detail view
  const [viewBid, setViewBid] = useState(null); // existing bid shown without leaving this page
  const [savedIds, setSavedIds] = useState(() => getSavedIds()); // ids of saved briefs
  // Bid form — opened straight from the detail so no redirect to another page.
  const [bidBrief, setBidBrief] = useState(null);   // brief being bid on
  const [bidAmount, setBidAmount] = useState('');
  const [split, setSplit] = useState(EMPTY_SPLIT);
  const [deliveryDays, setDeliveryDays] = useState('');
  const [proposal, setProposal] = useState('');
  const [submittingBid, setSubmittingBid] = useState(false);
  // Profile-complete check + the platform-fee pop-up, both before the bid form opens.
  const bidGate = useBidGate(user);

  const openBidForm = (b) => {
    setBidAmount(''); setSplit(EMPTY_SPLIT); setDeliveryDays(''); setProposal('');
    setBidBrief(b);
  };

  const handleSubmitBid = async (e) => {
    e.preventDefault();
    const maximum = maxCampaignBid(bidBrief);
    if (maximum && Number(bidAmount) > maximum) {
      toast.error(bidOverBudgetMessage(maximum));
      return;
    }
    setSubmittingBid(true);
    try {
      await axios.post(`${API}/campaigns/${bidBrief.id}/bid`, {
        campaign_id: bidBrief.id,
        amount: parseFloat(bidAmount),
        ...(needsEditSplit(bidBrief.campaign || bidBrief) ? splitPayload(split) : {}),
        proposal,
        estimated_delivery_days: parseInt(deliveryDays, 10),
      });
      toast.success('Bid submitted successfully!');
      setBidBrief(null);
      setOpenBrief(null);
      fetchData();
    } catch (error) {
      toast.error(error?.response ? apiErrorMessage(error, 'Failed to submit bid') : "You're offline. Check your connection and try again.");
    } finally {
      setSubmittingBid(false);
    }
  };

  useLiveEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // live updates push changes; this is only a safety net
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the bookmark state in sync if saves change here or on the Saved page.
  useLiveEffect(() => {
    const sync = () => setSavedIds(getSavedIds());
    window.addEventListener('ugc-saved-changed', sync);
    // The local saved list is not tied to a login: reconcile it with this creator's server list once,
    // so the "Saved" count never shows another account's leftovers.
    hydrateSavedFromServer().then(sync).catch(() => {});
    return () => window.removeEventListener('ugc-saved-changed', sync);
  }, []);

  // Keep the search box in sync when arriving from the top-nav search (?q=...)
  useEffect(() => {
    setSearch(searchParams.get('q') || '');
    setTerm(searchParams.get('q') || '');
    setVisible(PAGE);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/campaigns?t=${Date.now()}`);
      const all = res.data;
      // Stay listed while the brief still has creator slots open — hiding it on the
      // first hire meant a 5-creator brief could only ever fill one slot.
      // ...but not to a creator already hired on it (same rule as the creator dashboard).
      setAvailableCampaigns(all.filter((c) => isOpenForBids(c) && !isSelectedCreator(c, user?.id)));
      setMyBids(all.filter((c) => c.bids?.some((b) => b.creator_id === user?.id)));
      setLoadError('');
    } catch (err) {
      // Polled every 60s: keep the last good list, only show the error when there is nothing to show.
      setLoadError(err?.response ? 'Could not load campaigns.' : "You're offline. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
    // Invites (direct bookings / custom prices) come from the same deals list the My Deals hub uses.
    try {
      const r = await axios.get(`${API}/deals/my?summary=true`);
      setDeals(Array.isArray(r.data) ? r.data : (r.data?.deals || []));
      setDealsError('');
    } catch (err) {
      setDealsError(err?.response ? 'Could not load your invites.' : "You're offline. Check your connection and try again.");
    }
  };

  const briefs = useMemo(
    () => availableCampaigns.map((c, i) => normalizeBrief(c, i, myBids)),
    [availableCampaigns, myBids]
  );
  const invites = useMemo(() => deals.filter(isInviteDeal), [deals]);

  // Deep-link: open a specific brief's detail from a shared URL (?open=<id>).
  useEffect(() => {
    const openId = searchParams.get('open');
    if (openId && briefs.length) {
      const b = briefs.find((x) => String(x.id) === String(openId));
      if (b) setOpenBrief(b);
    }
  }, [briefs, searchParams]);

  const closeDetail = () => {
    setBidBrief(null);
    setOpenBrief(null);
    if (searchParams.get('open')) {
      const next = new URLSearchParams(searchParams);
      next.delete('open');
      setSearchParams(next, { replace: true });
    }
  };

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
      if (d == null) return true;   // brief states no deadline — don't hide it behind a filter
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
  const filtersOn = category !== 'All Categories' || budgetFilter !== 'any' || deliveryFilter !== 'any';

  const setTab = (key) => {
    if (key === 'saved') { navigate('/saved'); return; }
    const next = new URLSearchParams(searchParams);
    if (key === 'all') next.delete('tab'); else next.set('tab', key);
    setSearchParams(next, { replace: true });
  };
  const runSearch = (e) => {
    e.preventDefault();
    const next = new URLSearchParams(searchParams);
    if (term.trim()) next.set('q', term.trim()); else next.delete('q');
    setSearchParams(next, { replace: true });
  };
  const clearSearch = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('q');
    setSearchParams(next, { replace: true });
  };
  const clearAll = () => { setCategory('All Categories'); setBudgetFilter('any'); setDeliveryFilter('any'); if (search) clearSearch(); setVisible(PAGE); };
  const changeFilter = (setter) => (e) => { setter(e.target.value); setVisible(PAGE); };

  const subtitle = {
    all: loading ? '' : `${availableCampaigns.length} open ${availableCampaigns.length === 1 ? 'brief' : 'briefs'}${invites.length ? ` · ${invites.length} ${invites.length === 1 ? 'brand' : 'brands'} invited you directly` : ''}`,
    applied: `${appliedCount ?? myBids.length} applied · track every application here.`,
    invites: invites.length ? `${invites.length} ${invites.length === 1 ? 'brand' : 'brands'} invited you directly — price already set.` : 'Direct invites from brands show up here.',
  }[tab];

  const TABS = [
    { key: 'all', label: 'All briefs', count: loading ? null : availableCampaigns.length },
    { key: 'invites', label: 'Invites', count: invites.length },
    { key: 'saved', label: 'Saved', count: savedIds.size },
    { key: 'applied', label: 'Applied', count: appliedCount ?? myBids.length },
  ];

  const toggleSave = (b) => { const s = toggleSavedBrief(b); toast.success(s ? 'Saved to your list' : 'Removed from saved'); };
  const openCard = (b) => (b.id ? setOpenBrief(b) : toast.error('This brief is unavailable'));

  return (
    <CreatorTopNavLayout notifications={0}>
      <CreatorPageHead title="Find briefs" subtitle={subtitle} hideSearch />

      {tab === 'all' && (
        <div className="cui-b-filters">
          <form className="cui-b-searchrow" role="search" onSubmit={runSearch}>
            <label className="cui-b-search">
              <Search size={18} />
              <input type="search" aria-label="Search briefs" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search by product, brand or idea — e.g. “serum”, “unboxing”" />
            </label>
            <button type="submit" className="cui-b-searchbtn">Search</button>
          </form>
          <div className="cui-b-chips">
            <Chip label="Category" value={category} display={category === 'All Categories' ? 'All' : category} active={category !== 'All Categories'} onChange={changeFilter(setCategory)}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c === 'All Categories' ? 'All' : c}</option>)}
            </Chip>
            <Chip label="Pay" value={budgetFilter} display={{ any: 'Any', '0-2000': 'Under ₹2k', '2000-5000': '₹2k–5k', '5000-10000': '₹5k–10k', '10000+': '₹10k+' }[budgetFilter]} active={budgetFilter !== 'any'} onChange={changeFilter(setBudgetFilter)}>
              <option value="any">Any</option>
              <option value="0-2000">Under ₹2,000</option>
              <option value="2000-5000">₹2,000 – ₹5,000</option>
              <option value="5000-10000">₹5,000 – ₹10,000</option>
              <option value="10000+">₹10,000+</option>
            </Chip>
            <Chip label="Deadline" value={deliveryFilter} display={{ any: 'Any', 3: '≤ 3 days', 5: '≤ 5 days', 7: '≤ 7 days', '7+': '7+ days' }[deliveryFilter]} active={deliveryFilter !== 'any'} onChange={changeFilter(setDeliveryFilter)}>
              <option value="any">Any</option>
              <option value="3">Within 3 days</option>
              <option value="5">Within 5 days</option>
              <option value="7">Within 7 days</option>
              <option value="7+">More than 7 days</option>
            </Chip>
            {(filtersOn || search) && <button type="button" className="cui-b-clear" onClick={clearAll}>Clear all</button>}
          </div>
        </div>
      )}

      <div className="cui-b-tabrow">
        <div className="cui-b-tabs" role="tablist" aria-label="Find briefs">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`cui-b-tab${tab === t.key ? ' is-on' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}{t.count != null && <i>{t.count}</i>}
            </button>
          ))}
        </div>
        {tab === 'all' && (
          <label className="cui-b-sort">Sort:
            <select aria-label="Sort briefs" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="newest">Newest</option>
              <option value="recommended">Best match</option>
              <option value="highest">Highest pay</option>
            </select>
          </label>
        )}
      </div>

      {tab === 'applied' && <MyBidsContent onCount={setAppliedCount} />}
      {tab === 'invites' && (
        <BriefInvites invites={invites} loading={loading && !deals.length && !dealsError} error={dealsError} onRetry={fetchData} />
      )}

      {tab === 'all' && (
        <>
          {search.trim() && (
            <div className="cui-b-note">
              Showing results for <strong>“{search.trim()}”</strong>
              <span>· {filtered.length} match{filtered.length === 1 ? '' : 'es'}</span>
            </div>
          )}

          {shown.length ? (
            <div className="cui-b-grid">
              {shown.map((b) => (
                <BriefCard key={b.id} brief={b} saved={savedIds.has(String(b.id))} onOpen={openCard} onToggleSave={toggleSave} />
              ))}
            </div>
          ) : loading ? (
            <div className="cui-b-grid">
              {Array.from({ length: 6 }).map((_, i) => <BriefCardSkeleton key={i} />)}
            </div>
          ) : loadError ? (
            <EmptyState title="Could not load campaigns" message={loadError} action={{ label: 'Retry', onClick: () => { setLoading(true); fetchData(); } }} />
          ) : (
            <EmptyState title="No campaigns found" message="No campaigns match your search or filters right now. Try a different category or check back soon." />
          )}

          {visible < filtered.length && (
            <div className="cui-b-more">
              <button type="button" onClick={() => setVisible((v) => v + PAGE)}>Show {Math.min(PAGE, filtered.length - visible)} more briefs</button>
            </div>
          )}
        </>
      )}

      <BriefDetailDrawer
        brief={openBrief}
        onClose={closeDetail}
        applyPanel={bidBrief && openBrief && String(bidBrief.id) === String(openBrief.id) ? (
          <BriefApplyForm
            brief={bidBrief}
            split={split} setSplit={setSplit}
            bidAmount={bidAmount} setBidAmount={setBidAmount}
            deliveryDays={deliveryDays} setDeliveryDays={setDeliveryDays}
            proposal={proposal} setProposal={setProposal}
            submitting={submittingBid}
            onSubmit={handleSubmitBid}
            onCancel={() => setBidBrief(null)}
            percent={bidGate.percent}
          />
        ) : null}
        onBid={async (b) => {
          if (b.hasBid) {
            setOpenBrief(null);
            setViewBid(b);
            return;
          }
          // An incomplete profile can't bid: list what's missing instead of opening the form.
          if (!(await bidGate.ensureProfile())) return;
          // KYC gate: unverified creators can't bid — nudge them to verify first.
          if (user?.kyc?.status !== 'verified' && !user?.kyc_verified) {
            toast.error('Verify your KYC before submitting a bid.');
            return navigate('/kyc');
          }
          bidGate.showFee(() => openBidForm(b));
        }}
      />

      {viewBid && (() => {
        const campaign = viewBid.campaign || {};
        const bid = (campaign.bids || []).find((item) => String(item.creator_id) === String(user?.id)) || {};
        const status = String(bid.status || 'pending').replace(/_/g, ' ');
        return (
          <div className="cui-b-sheet-bg" onClick={() => setViewBid(null)}>
            <aside className="cui-b-sheet" role="dialog" aria-modal="true" aria-label="Your bid" onClick={(e) => e.stopPropagation()}>
              <div className="cui-b-sheet-head">
                <BriefLogo name={viewBid.brand} src={viewBid.logo} />
                <div>
                  <strong>{viewBid.title || 'Campaign'}</strong>
                  <small>{viewBid.brand || 'Brand'}</small>
                </div>
                <button type="button" className="cui-b-x" aria-label="Close" onClick={() => setViewBid(null)}><X size={20} /></button>
              </div>
              <div className="cui-b-sheet-body">
                <div className="cui-b-metas"><span className="cui-b-badge ok"><CheckCircle2 size={14} /> Bid already submitted</span></div>
                <div className="cui-b-stats">
                  <div><small>Your bid</small><b>{inr(bid.amount)}</b></div>
                  <div><small>Estimated delivery</small><b>{bid.estimated_delivery_days || '-'} days</b></div>
                  <div><small>Status</small><b style={{ textTransform: 'capitalize' }}>{status}</b></div>
                </div>
                <div className="cui-b-sec">
                  <h4>Your proposal</h4>
                  <p className="cui-b-text">{bid.proposal || 'No proposal added.'}</p>
                </div>
              </div>
              <div className="cui-b-sheet-foot">
                <button type="button" className="cui-b-pill-btn is-ghost" onClick={() => setViewBid(null)}>Close</button>
              </div>
            </aside>
          </div>
        );
      })()}
      {bidGate.ui}
    </CreatorTopNavLayout>
  );
}
