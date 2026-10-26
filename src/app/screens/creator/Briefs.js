import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { SlidersHorizontal, X, ChevronDown, WifiOff, Compass } from 'lucide-react';
import AppShell from '../../shell/AppShell';
import BottomSheet from '../../shell/BottomSheet';
import { useAuth } from '../../../App';
import { useLiveEffect } from '../../../lib/liveUpdates';
import normalizeBrief from '../../../utils/normalizeBrief';
import { isOpenForBids, isSelectedCreator } from '../../../utils/campaignCreators';
import { toggleSavedBrief, getSavedIds, hydrateSavedFromServer } from '../../../utils/savedBriefs';
import { inr } from '../../../components/briefUi';
import { BidsContent } from './Bids';
import { API, OFFLINE, failText, Logo, BriefTabs, BriefCard, BriefCardSkeleton, BriefDetail, ErrorBanner, useApply, isInviteDeal, SearchRow, NoMatches, matchesQuery } from './briefsShared';

const CATEGORIES = ['All Categories', 'Beauty', 'Fashion', 'Tech', 'Fitness', 'Food', 'Lifestyle', 'Travel', 'Home', 'Gaming', 'Kids'];
const PAY = [['any', 'Any'], ['0-2000', 'Under ₹2k'], ['2000-5000', '₹2k–5k'], ['5000-10000', '₹5k–10k'], ['10000+', '₹10k+']];
const DEADLINE = [['any', 'Any'], ['3', '≤ 3 days'], ['5', '≤ 5 days'], ['7', '≤ 7 days'], ['7+', '7+ days']];
const SORTS = [['newest', 'Newest'], ['recommended', 'Best match'], ['highest', 'Highest pay']];
const PAGE = 8;

const isObjectId = (s) => /^[0-9a-f]{24}$/i.test(String(s || ''));
const inviteBrand = (d) => {
  const raw = String(d?.brand?.name || d?.campaign?.brand_name || d?.campaign?.business_name || d?.campaign?.business_nickname || '').replace(/^@+/, '').trim();
  return raw && !isObjectId(raw) ? raw : 'Brand';
};
const labelOf = (list, v) => (list.find(([k]) => k === v) || [])[1];

export default function Briefs() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab = tabParam === 'applied' || tabParam === 'invites' ? tabParam : 'all';
  const q = searchParams.get('q') || '';
  const openId = searchParams.get('open');

  const [campaigns, setCampaigns] = useState([]);
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [dealsError, setDealsError] = useState('');
  const [appliedCount, setAppliedCount] = useState(null);
  const [category, setCategory] = useState('All Categories');
  const [sortBy, setSortBy] = useState('newest');
  const [budgetFilter, setBudgetFilter] = useState('any');
  const [deliveryFilter, setDeliveryFilter] = useState('any');
  const [visible, setVisible] = useState(PAGE);
  const [filterOpen, setFilterOpen] = useState(false);
  const [draft, setDraft] = useState({});
  const [savedIds, setSavedIds] = useState(() => getSavedIds());

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/campaigns?t=${Date.now()}`);
      setCampaigns(res.data || []);
      setLoadError('');
    } catch (err) {
      // Polled every 60s: keep the last good list, only surface the error when there is nothing to show.
      setLoadError(failText(err, 'Could not load campaigns.'));
    } finally {
      setLoading(false);
    }
    // Invites (direct bookings / custom prices) come from the same deals list the Orders hub uses.
    try {
      const r = await axios.get(`${API}/deals/my?summary=true`);
      setDeals(Array.isArray(r.data) ? r.data : (r.data?.deals || []));
      setDealsError('');
    } catch (err) {
      setDealsError(failText(err, 'Could not load your invites.'));
    }
  };

  useLiveEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); // live updates push changes; this is only a safety net
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep bookmarks in sync; reconcile the local saved list with this creator's server list once.
  useLiveEffect(() => {
    const sync = () => setSavedIds(getSavedIds());
    window.addEventListener('ugc-saved-changed', sync);
    hydrateSavedFromServer().then(sync).catch(() => {});
    return () => window.removeEventListener('ugc-saved-changed', sync);
  }, []);

  useEffect(() => { setVisible(PAGE); }, [q]);

  const available = useMemo(() => campaigns.filter((c) => isOpenForBids(c) && !isSelectedCreator(c, user?.id)), [campaigns, user?.id]);
  const myBids = useMemo(() => campaigns.filter((c) => c.bids?.some((b) => b.creator_id === user?.id)), [campaigns, user?.id]);
  const briefs = useMemo(() => available.map((c, i) => normalizeBrief(c, i, myBids)), [available, myBids]);
  const invites = useMemo(() => deals.filter(isInviteDeal), [deals]);
  const shownInvites = useMemo(() => invites.filter((d) => matchesQuery(q, inviteBrand(d), d.campaign?.title, d.campaign?.product_description, d.campaign?.category)), [invites, q]);
  const openBrief = useMemo(() => (openId ? briefs.find((x) => String(x.id) === String(openId)) || null : null), [briefs, openId]);

  const patchParams = (fn, replace = true) => {
    const next = new URLSearchParams(searchParams);
    fn(next);
    setSearchParams(next, { replace });
  };
  // Deep link (?open=<id>): once the list has loaded, drop an id that is no longer open.
  useEffect(() => {
    if (openId && !loading && !openBrief) {
      toast.error('This brief is unavailable');
      patchParams((n) => n.delete('open'));
    }
  }, [openId, loading, openBrief]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = useApply(user, () => { patchParams((n) => n.delete('open')); fetchData(); });

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
      if (d == null) return true; // brief states no deadline - don't hide it behind a filter
      switch (deliveryFilter) {
        case '3': return d <= 3;
        case '5': return d <= 5;
        case '7': return d <= 7;
        case '7+': return d > 7;
        default: return true;
      }
    };
    const s = q.trim().toLowerCase();
    return briefs
      .filter((b) => {
        if (category !== 'All Categories' && !`${b.industryType} ${b.tags.join(' ')} ${b.title}`.toLowerCase().includes(cat)) return false;
        if (s && !`${b.title} ${b.brand} ${b.description} ${b.industryType} ${b.tags.join(' ')}`.toLowerCase().includes(s)) return false;
        return inBudget(b.budgetMax) && inDelivery(b.deliveryDays);
      })
      .sort((a, b) => {
        if (sortBy === 'highest') return b.budgetMax - a.budgetMax;
        if (sortBy === 'newest') return b.createdAt - a.createdAt;
        return b.matchScore - a.matchScore;
      });
  }, [briefs, q, category, sortBy, budgetFilter, deliveryFilter]);

  const shown = filtered.slice(0, visible);
  const activeFilters = [
    category !== 'All Categories' && ['Category', category, () => setCategory('All Categories')],
    budgetFilter !== 'any' && ['Pay', labelOf(PAY, budgetFilter), () => setBudgetFilter('any')],
    deliveryFilter !== 'any' && ['Deadline', labelOf(DEADLINE, deliveryFilter), () => setDeliveryFilter('any')],
  ].filter(Boolean);
  const clearSearch = () => patchParams((n) => n.delete('q'));
  const clearAll = () => { setCategory('All Categories'); setBudgetFilter('any'); setDeliveryFilter('any'); if (q) clearSearch(); setVisible(PAGE); };

  const commitSearch = (v) => patchParams((n) => { if (v) n.set('q', v); else n.delete('q'); });
  const openFilters = () => { setDraft({ category, budgetFilter, deliveryFilter }); setFilterOpen(true); };
  const applyFilters = () => {
    setCategory(draft.category); setBudgetFilter(draft.budgetFilter); setDeliveryFilter(draft.deliveryFilter);
    setVisible(PAGE); setFilterOpen(false);
  };

  const toggleSave = (b) => { const s = toggleSavedBrief(b); setSavedIds(getSavedIds()); toast.success(s ? 'Saved to your list' : 'Removed from saved'); };
  const openCard = (b) => (b.id ? patchParams((n) => n.set('open', b.id), false) : toast.error('This brief is unavailable'));
  const closeDetail = () => patchParams((n) => n.delete('open'));

  const counts = { all: loading ? null : available.length, invites: invites.length, saved: savedIds.size, applied: appliedCount ?? myBids.length };
  const subtitle = tab === 'all'
    ? (loading ? '' : `${available.length} open ${available.length === 1 ? 'brief' : 'briefs'}`)
    : tab === 'invites'
      ? (invites.length ? `${invites.length} ${invites.length === 1 ? 'brand' : 'brands'} invited you directly` : 'Direct invites from brands show up here.')
      : 'Track every application here.';

  return (
    <AppShell title="Find briefs" subtitle={subtitle}>
      <SearchRow q={q} onCommit={commitSearch}>
        {tab === 'all' && (
          <button type="button" className="ap-bf-filterbtn" aria-label={`Filters${activeFilters.length ? ` (${activeFilters.length} on)` : ''}`} onClick={openFilters}>
            <SlidersHorizontal size={20} />
            {activeFilters.length > 0 && <b>{activeFilters.length}</b>}
          </button>
        )}
      </SearchRow>
      {tab === 'all' && (
        <>
          {(activeFilters.length > 0 || q) && (
            <div className="ap-bf-fchips">
              {q && <button type="button" className="ap-bf-fchip" onClick={clearSearch}><span>Search</span><strong>“{q}”</strong><X size={14} /></button>}
              {activeFilters.map(([k, v, clear]) => (
                <button key={k} type="button" className="ap-bf-fchip" onClick={clear} aria-label={`Clear ${k} filter`}><span>{k}</span><strong>{v}</strong><X size={14} /></button>
              ))}
              <button type="button" className="ap-bf-fchip ap-bf-fchip--clear" onClick={clearAll}>Clear all</button>
            </div>
          )}
        </>
      )}

      <BriefTabs active={tab} counts={counts} />

      {tab === 'applied' && <BidsContent onCount={setAppliedCount} query={q} onClearQuery={clearSearch} />}

      {tab === 'invites' && (
        loading && !deals.length && !dealsError ? (
          <div className="ap-bf-list" aria-hidden="true"><BriefCardSkeleton /><BriefCardSkeleton /></div>
        ) : dealsError && !invites.length ? (
          <div className="ap-empty ap-card">
            {dealsError.startsWith("You're offline") ? <WifiOff size={34} /> : <Compass size={34} />}
            <h3>Could not load invites</h3><p>{dealsError}</p>
            <button type="button" className="ap-btn" onClick={fetchData}>Retry</button>
          </div>
        ) : !invites.length ? (
          <div className="ap-empty ap-card">
            <h3>No invites right now</h3>
            <p>When a brand books you directly or proposes a custom price, the invite lands here for you to accept, decline or counter.</p>
            <button type="button" className="ap-btn" onClick={() => navigate('/browse-briefs', { replace: true })}>Browse open briefs</button>
          </div>
        ) : !shownInvites.length ? (
          <NoMatches q={q} onClear={clearSearch} />
        ) : (
          <>
            <p className="ap-bf-tip">Brands that invite you set the price up front. Open an invite to accept, decline or counter.</p>
            <div className="ap-bf-list">
              {shownInvites.map((d) => {
                const c = d.campaign || {};
                const brand = inviteBrand(d);
                const countered = c.booking_status === 'price_revision';
                const amount = countered ? c.proposed_amount : (d?.escrow?.held_amount ?? c.budget_max ?? c.budget_min ?? d?.my_bid?.amount);
                const videos = Number(c.video_count) || 1;
                return (
                  <article className="ap-bf-inv" key={d.deal_id || c.id}>
                    <div className="ap-bf-inv-h">
                      <Logo name={brand} src={d?.brand?.logo_url || c.brand_logo_url} />
                      <div>
                        <small>{brand} {countered ? 'is reviewing your counter' : 'invited you'} · no bidding</small>
                        <b>{c.title || 'Untitled brief'}</b>
                      </div>
                      <span className="ap-bf-inv-amt">{inr(amount)}</span>
                    </div>
                    {c.product_description ? <p>{c.product_description}</p> : null}
                    <div className="ap-bf-inv-f">
                      <span>{videos} {videos === 1 ? 'video' : 'videos'} · <strong>{countered ? 'Counter sent, awaiting brand' : 'Awaiting your response'}</strong></span>
                      <button type="button" className="ap-bf-cta" onClick={() => navigate(`/my-deals?campaign=${c.id || d.deal_id}`)}>{countered ? 'View counter' : 'Review invite'}</button>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )
      )}

      {tab === 'all' && (
        <>
          {loadError && shown.length > 0 && <ErrorBanner text={loadError} onRetry={fetchData} />}
          {q.trim() && (
            <div className="ap-bf-note">Showing results for <strong>“{q.trim()}”</strong> · {filtered.length} match{filtered.length === 1 ? '' : 'es'}</div>
          )}
          {shown.length > 0 && (
            <div className="ap-bf-meta">
              <span><strong>{filtered.length} {filtered.length === 1 ? 'brief' : 'briefs'}</strong> {activeFilters.length || q ? 'match' : 'open'}</span>
              <label className="ap-bf-sort">Sort: <strong>{labelOf(SORTS, sortBy)} <ChevronDown size={13} style={{ verticalAlign: -2 }} /></strong>
                <select aria-label="Sort briefs" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </label>
            </div>
          )}
          {shown.length ? (
            <div className="ap-bf-list">
              {shown.map((b) => <BriefCard key={b.id} brief={b} saved={savedIds.has(String(b.id))} onOpen={openCard} onToggleSave={toggleSave} />)}
            </div>
          ) : loading ? (
            <div className="ap-bf-list" aria-hidden="true">{[0, 1, 2].map((i) => <BriefCardSkeleton key={i} />)}</div>
          ) : loadError ? (
            <div className="ap-empty ap-card">
              {loadError === OFFLINE ? <WifiOff size={34} /> : <Compass size={34} />}
              <h3>Could not load briefs</h3><p>{loadError}</p>
              <button type="button" className="ap-btn" onClick={() => { setLoading(true); fetchData(); }}>Retry</button>
            </div>
          ) : (
            <div className="ap-empty ap-card">
              <Compass size={34} />
              <h3>{activeFilters.length || q ? 'No briefs match' : 'No open briefs right now'}</h3>
              <p>{activeFilters.length || q ? 'Try fewer filters or a different search.' : 'New briefs show up here as brands post them. Check back soon.'}</p>
              {(activeFilters.length > 0 || q) && <button type="button" className="ap-btn" onClick={clearAll}>Clear filters</button>}
            </div>
          )}
          {visible < filtered.length && (
            <div className="ap-bf-more">
              <button type="button" className="ap-btn ap-btn--ghost" onClick={() => setVisible((v) => v + PAGE)}>Show {Math.min(PAGE, filtered.length - visible)} more briefs</button>
            </div>
          )}
        </>
      )}

      <BottomSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        title="Filters"
        footer={(
          <>
            <button type="button" className="ap-btn ap-btn--ghost" style={{ flex: 1 }} onClick={() => setDraft({ category: 'All Categories', budgetFilter: 'any', deliveryFilter: 'any' })}>Reset</button>
            <button type="button" className="ap-btn" style={{ flex: 2 }} onClick={applyFilters}>Show results</button>
          </>
        )}
      >
        {[['Category', 'category', CATEGORIES.map((c) => [c, c === 'All Categories' ? 'All' : c])],
          ['Pay', 'budgetFilter', PAY],
          ['Deadline', 'deliveryFilter', DEADLINE]].map(([label, key, opts]) => (
          <div className="ap-bf-fgroup" key={key}>
            <b>{label}</b>
            <div className="ap-bf-opts">
              {opts.map(([v, l]) => (
                <button key={v} type="button" className={`ap-chip${draft[key] === v ? ' is-on' : ''}`} aria-pressed={draft[key] === v} onClick={() => setDraft((d) => ({ ...d, [key]: v }))}>{l}</button>
              ))}
            </div>
          </div>
        ))}
      </BottomSheet>

      {openBrief && (
        <BriefDetail
          brief={openBrief}
          saved={savedIds.has(String(openBrief.id))}
          onToggleSave={toggleSave}
          onClose={closeDetail}
          onApply={apply.start}
          applying={apply.checking}
        />
      )}
      {apply.ui}
    </AppShell>
  );
}
