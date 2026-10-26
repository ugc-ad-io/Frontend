import { useLiveEffect } from '../lib/liveUpdates';
import { useState, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { Clock } from 'lucide-react';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import CreatorPageHead from '../components/CreatorPageHead';
import { inr, brandTile, orderStatus, dueLabel, isPaidDeal, isInReview, shortDate } from '../utils/orderUi';
import EmptyState from '../components/EmptyState';
import { MyBidsContent } from './MyBidsPage';
import { Skeleton } from '../components/Skeleton';
import '../styles/creator-marketplace.css';
import '../styles/creator-ui-orders.css';
import '../styles/creator-ui-mobile-orders.css';

// Row skeleton matching a .cui-o-row: tile + lead lines + pill.
function DealsSkeleton() {
  return (
    <div aria-hidden="true">
      {Array.from({ length: 3 }).map((_, i) => (
        <div className="cui-o-skel" key={i}>
          <Skeleton width={54} height={54} radius={12} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Skeleton width={110} height={12} />
            <Skeleton width="55%" height={16} style={{ marginTop: 8 }} />
          </div>
          <Skeleton width={80} height={24} radius={999} />
        </div>
      ))}
    </div>
  );
}

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const getInitial = (name) => (name || 'B').trim().charAt(0).toUpperCase();
const formatMoney = (v) => `Rs. ${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const assetUrl = (u) => (!u ? '' : (u.startsWith('http') ? u : `${BACKEND_URL}${u}`));

// A raw Mongo ObjectId is never a real name — never show one as the brand.
const isObjectId = (s) => /^[0-9a-f]{24}$/i.test(String(s || ''));

// --- deal helpers -----------------------------------------------------------
// Prefer the brand's REAL business name over an auto-generated @handle, strip "@",
// and fall back to "Brand" for empty/ObjectId values (mirrors BusinessDashboard).
const dealBrand = (d) => {
  const raw = String(
    d?.brand?.name || d?.campaign?.brand_name || d?.campaign?.business_name || d?.campaign?.business_nickname || ''
  ).replace(/^@+/, '').trim();
  return raw && !isObjectId(raw) ? raw : 'Brand';
};
const dealLogo = (d) => d?.brand?.logo_url || d?.campaign?.brand_logo_url || '';
const dealTitle = (d) => d?.campaign?.title || 'Untitled campaign';
const dealId = (d) => d?.deal_id || d?.campaign?.id;
const dealAmount = (d) =>
  Number(d?.escrow?.held_amount ?? d?.campaign?.budget_max ?? d?.campaign?.budget_min ?? d?.my_bid?.amount ?? 0);
const bookingStatus = (d) => d?.campaign?.booking_status;

// A booking the creator still has to answer (private/direct or custom-priced).
const isRequested = (d) =>
  ['pending_creator', 'price_revision'].includes(bookingStatus(d)) && !d?.campaign?.brief_sent;
// Terminal / dead — don't surface under Active.
const isDead = (d) =>
  bookingStatus(d) === 'declined' || String(d?.current_state || '').toLowerCase().includes('cancelled');

const TABS = [
  { key: 'active', label: 'Active' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'completed', label: 'Completed' },
  { key: 'requested', label: 'Requested' },
  { key: 'bids', label: 'My bids' },
  { key: 'cancelled', label: 'Cancelled' },
];

const stateText = (d) => String(d?.current_state || '').replace(/\s*(?:—|–|-)\s*/g, ' - ').toLowerCase();

// The one button on each row: what the creator does next.
function rowAction(d) {
  const s = stateText(d);
  if (s.includes('revision')) return { label: 'See changes', soft: true };
  if (s.includes('content in progress') || s.includes('edited video due')) return { label: 'Deliver' };
  if (s.includes('delivered')) return { label: 'Mark received' };
  if (s.includes('shipped')) return { label: 'Track', soft: true };
  return { label: 'View', soft: true };
}

function BrandTile({ deal, size }) {
  const name = dealBrand(deal);
  const { bg, fg } = brandTile(name);
  const logo = dealLogo(deal);
  return (
    <span className="cui-o-tile" style={{ width: size, height: size, background: logo ? '#fff' : bg, color: fg, fontSize: size * 0.4 }}>
      {logo ? <img src={assetUrl(logo)} alt="" loading="lazy" /> : getInitial(name)}
    </span>
  );
}

function BrandBy({ deal }) {
  const name = dealBrand(deal);
  const { fg } = brandTile(name);
  return (
    <div className="cui-o-by">
      <span className="cui-o-mini" style={{ background: fg }}>{getInitial(name)}</span>
      <span>{name}</span>
    </div>
  );
}

export default function MyDealsHubPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Deep-link a tab via ?tab=requested (booking-request notifications land here).
  const tabParam = searchParams.get('tab');
  const [tab, setTab] = useState(TABS.some((t) => t.key === tabParam) ? tabParam : 'active');

  const openTab = (key) => {
    setTab(key);
    const next = new URLSearchParams(searchParams);
    if (key === 'active') next.delete('tab'); else next.set('tab', key);
    setSearchParams(next, { replace: true });
  };

  useLiveEffect(() => {
    if (user?.approval_status && user.approval_status !== 'approved') { setLoading(false); return undefined; }
    fetchDeals();
    const interval = setInterval(fetchDeals, 10000);
    return () => clearInterval(interval);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchingDeals = useRef(false);
  const fetchDeals = async () => {
    if (fetchingDeals.current) return;
    fetchingDeals.current = true;
    try {
      const res = await axios.get(`${API}/deals/my?summary=true`);
      setDeals(res.data || []);
      setLoadError('');
    } catch (err) {
      // Polled every 10s: keep the last list on screen; only show the error when nothing loaded yet.
      setLoadError(err?.response ? 'Could not load your deals.' : "You're offline. Check your connection and try again.");
    } finally {
      fetchingDeals.current = false;
      setLoading(false);
    }
  };

  const requested = useMemo(() => deals.filter(isRequested), [deals]);
  const live = useMemo(() => deals.filter((d) => !isRequested(d) && !isDead(d)), [deals]);
  const cancelled = useMemo(() => deals.filter((d) => !isRequested(d) && isDead(d)), [deals]);
  const completed = useMemo(() => live.filter(isPaidDeal), [live]);
  const delivered = useMemo(() => live.filter((d) => !isPaidDeal(d) && isInReview(d)), [live]);
  const active = useMemo(() => live.filter((d) => !isPaidDeal(d) && !isInReview(d)), [live]);

  const inEscrow = active.concat(delivered).reduce((sum, d) => sum + dealAmount(d), 0);
  const paidOut = completed.reduce((sum, d) => sum + dealAmount(d), 0);
  const needYou = active.filter((d) => d.active_party === 'creator').length;
  const soonest = delivered.map((d) => d.deadline_countdown_hours).filter((h) => typeof h === 'number' && h >= 0).sort((a, b) => a - b)[0];
  const deliverNext = active.find((d) => rowAction(d).label === 'Deliver');

  const openDeal = (d) => navigate(`/my-deals?campaign=${d?.campaign?.id || dealId(d)}`);
  // Rows are role="button": Enter/Space must open them too (only when the row itself has focus).
  const rowKey = (d) => (e) => {
    if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openDeal(d); }
  };
  const errorBlock = (
    <EmptyState title="Could not load deals" message={loadError} action={{ label: 'Retry', onClick: () => { setLoading(true); fetchDeals(); } }} />
  );
  const counts = { active: active.length, delivered: delivered.length, completed: completed.length, requested: requested.length };

  const orderCell = (d, size = 54) => (
    <div className="cui-o-order">
      <BrandTile deal={d} size={size} />
      <div>
        <BrandBy deal={d} />
        <div className="cui-o-ttl" title={dealTitle(d)}>{dealTitle(d)}</div>
      </div>
    </div>
  );
  const goBtn = (d, a) => (
    <div className="cui-o-go">
      <button type="button" className={`cui-o-btn sm ${a.soft ? 'soft' : ''}`} onClick={(e) => { e.stopPropagation(); openDeal(d); }}>{a.label}</button>
    </div>
  );

  const orderRows = (list) => (
    <>
      <div className="cui-o-thead" aria-hidden="true"><span>ORDER</span><span>DUE</span><span>STATUS</span><span>PRICE</span><span /></div>
      {list.map((d) => {
        const st = orderStatus(d);
        const due = dueLabel(d);
        const a = rowAction(d);
        const priv = d?.campaign?.direct_booking;
        return (
          <div key={dealId(d)} className="cui-o-row" onClick={() => openDeal(d)} onKeyDown={rowKey(d)} role="button" tabIndex={0} title={d?.current_state}>
            {orderCell(d)}
            <div className="cui-o-due">{due ? <span className={`cui-o-pill ${due.tone}`}><Clock size={12} />{due.text}</span> : <span className="cui-o-dim">-</span>}</div>
            <div className="cui-o-st"><span className={`cui-o-pill ${st.tone}`}>{st.label}</span>{priv ? <span className="cui-o-dim"> Private</span> : null}</div>
            <div className="cui-o-price">{inr(dealAmount(d))}</div>
            <div className="cui-o-next">{d.primary_next_action ? `Next: ${d.primary_next_action}` : ''}</div>
            {goBtn(d, a)}
          </div>
        );
      })}
    </>
  );

  const doneRows = (list) => list.map((d) => (
    <div key={dealId(d)} className="cui-o-row cui-o-done" onClick={() => openDeal(d)} onKeyDown={rowKey(d)} role="button" tabIndex={0}>
      {orderCell(d, 46)}
      <span className="cui-o-dim cui-o-due">{d?.escrow?.estimated_payout_at ? `Paid ${shortDate(d.escrow.estimated_payout_at)}` : 'Paid'}</span>
      <strong className="cui-o-price">{inr(dealAmount(d))}</strong>
      <div className="cui-o-go"><button type="button" className="cui-o-link" onClick={(e) => { e.stopPropagation(); openDeal(d); }}>View</button></div>
    </div>
  ));

  const emptyBox = (text) => <div className="cui-o-empty">{text}</div>;
  const listFor = (list, empty, rows = orderRows) => (
    loading ? <DealsSkeleton /> : loadError && !deals.length ? errorBlock : list.length ? rows(list) : emptyBox(empty)
  );

  const nOpen = active.length + delivered.length;
  const subtitle = `${nOpen} active order${nOpen === 1 ? '' : 's'} worth ${inr(inEscrow)} · ${completed.length} completed.`;

  return (
    <CreatorTopNavLayout notifications={0}>
      <div className="cui-o-page">
        <CreatorPageHead
          title="Orders"
          subtitle={loading ? 'Your deals, deliveries and payments in one place.' : subtitle}
          action={deliverNext ? <button type="button" className="cui-btn" onClick={() => openDeal(deliverNext)}>Deliver work</button> : null}
        />

        {loadError && deals.length > 0 && <div className="cui-o-err" role="alert">{loadError} Showing the last loaded list.</div>}

        <div className="cui-o-kpis">
          <div className="cui-o-kpi"><small>Active</small><b>{active.length}</b><em className={needYou ? 'warn' : ''}>{needYou ? `${needYou} need${needYou === 1 ? 's' : ''} you` : 'Nothing waiting on you'}</em></div>
          <div className="cui-o-kpi"><small>In review</small><b>{delivered.length}</b><em>{soonest != null ? `Auto-approves in ${soonest < 24 ? `${Math.max(1, Math.round(soonest))}h` : `${Math.ceil(soonest / 24)} days`}` : 'Waiting on brands'}</em></div>
          <div className="cui-o-kpi"><small>Completed</small><b>{completed.length}</b><em className="ok">{paidOut ? `${inr(paidOut)} paid out` : 'No payouts yet'}</em></div>
          <div className="cui-o-kpi"><small>In escrow</small><b>{inr(inEscrow)}</b><em>Held safely until approval</em></div>
        </div>

        <div className="cui-o-card" style={{ paddingBottom: 6 }}>
          <div className="cui-o-tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`cui-o-tab ${tab === t.key ? 'is-on' : ''}`} onClick={() => openTab(t.key)}>
                {t.label}
                {counts[t.key] != null && <span className="cui-o-count">{counts[t.key]}</span>}
              </button>
            ))}
          </div>

          {tab === 'active' && (!active.length && !loading && !loadError
            ? <EmptyState title="No active deals yet" message="Once you accept a booking or a brand picks your bid, your live deals show up here." action={{ label: 'Browse Campaigns', onClick: () => navigate('/browse-briefs') }} />
            : listFor(active, ''))}
          {tab === 'delivered' && listFor(delivered, 'Nothing is waiting on a brand right now. Work you deliver shows up here until it is approved.')}
          {tab === 'completed' && listFor(completed, 'Paid orders will show up here.', doneRows)}
          {tab === 'cancelled' && listFor(cancelled, 'No cancelled or declined orders.')}

          {tab === 'requested' && (
            loading ? <DealsSkeleton /> : loadError && !deals.length ? errorBlock : requested.length ? (
              <>
                <div className="cui-o-thead" aria-hidden="true"><span>ORDER</span><span>REQUEST</span><span>TYPE</span><span>PRICE</span><span /></div>
                {requested.map((d) => {
                  const price = bookingStatus(d) === 'price_revision';
                  return (
                    <div key={dealId(d)} className="cui-o-row" onClick={() => openDeal(d)} onKeyDown={rowKey(d)} role="button" tabIndex={0}>
                      {orderCell(d)}
                      <div className="cui-o-due"><span className={`cui-o-pill ${price ? 'warn' : ''}`}><Clock size={12} />{price ? 'Awaiting brand' : 'Awaiting your reply'}</span></div>
                      <div className="cui-o-st"><span className="cui-o-pill muted">{price ? 'Custom price' : 'Private invite'}</span></div>
                      <div className="cui-o-price" title={price ? 'You countered' : "You'll get"}>{inr(price ? d?.campaign?.proposed_amount : dealAmount(d))}</div>
                      <div className="cui-o-next">{price ? 'You countered - waiting for the brand' : `${d?.campaign?.video_count || 1} video(s) · accept, decline or counter`}</div>
                      {goBtn(d, { label: price ? 'View counter' : 'Respond', soft: price })}
                    </div>
                  );
                })}
              </>
            ) : emptyBox('No requests right now. When a brand books you directly or proposes a custom deal, the invite lands here to accept, decline, or counter.')
          )}

          {tab === 'bids' && <div style={{ marginTop: 14 }}><MyBidsContent /></div>}
        </div>

        {tab === 'active' && completed.length > 0 && !loading && (
          <div className="cui-o-card">
            <div className="cui-o-h"><span>Recently completed</span><button type="button" className="cui-o-link" onClick={() => openTab('completed')}>See all {completed.length}</button></div>
            <div style={{ marginTop: 12 }}>{doneRows(completed.slice(0, 3))}</div>
          </div>
        )}
      </div>
    </CreatorTopNavLayout>
  );
}
