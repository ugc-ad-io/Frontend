import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowRight, Clock, Lock } from 'lucide-react';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import EmptyState from '../components/EmptyState';
import { MyBidsContent } from './MyBidsPage';
import { Skeleton } from '../components/Skeleton';
import '../styles/creator-marketplace.css';

// Row skeleton matching an .mdh-card: avatar + lead lines + amount + arrow.
function DealsSkeleton() {
  return (
    <div className="mdh-grid" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <article className="mdh-card" key={i}>
          <Skeleton width={46} height={46} radius={12} />
          <div className="mdh-lead" style={{ flex: 1, minWidth: 0 }}>
            <Skeleton width={130} height={14} />
            <Skeleton width="55%" height={16} style={{ marginTop: 8 }} />
            <Skeleton width="40%" height={12} style={{ marginTop: 6 }} />
          </div>
          <div className="mdh-amt" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton width={50} height={10} />
            <Skeleton width={80} height={16} />
          </div>
          <Skeleton width={38} height={38} radius="50%" />
        </article>
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

// Colour + a SHORT, single-line label for an active deal's current state — the
// full backend state (e.g. "Received — Content in Progress") is kept as a tooltip.
function activeMeta(d) {
  const full = d?.current_state || 'Active';
  const s = full.toLowerCase();
  if (s.includes('paid') || s.includes('complete')) return { label: 'Paid', color: '#22c55e', full };
  if (s.includes('approved')) return { label: 'Approved', color: '#22c55e', full };
  if (s.includes('revision')) return { label: 'Revision Requested', color: '#f97316', full };
  if (s.includes('submitted') || (s.includes('await') && s.includes('review'))) return { label: 'In Review', color: '#f59e0b', full };
  if (s.includes('dispute')) return { label: 'Disputed', color: '#ef4444', full };
  if (s.includes('damaged')) return { label: 'Issue Reported', color: '#ef4444', full };
  if (s.includes('content in progress') || s.includes('received')) return { label: 'Content in Progress', color: '#6366f1', full };
  if (s.includes('delivered')) return { label: 'Delivered', color: '#6366f1', full };
  if (s.includes('shipped') || s.includes('transit')) return { label: 'Shipped', color: '#3b82f6', full };
  if (s.includes('accepted') || s.includes('awaiting shipment')) return { label: 'Awaiting Shipment', color: '#3b82f6', full };
  return { label: full, color: '#16a34a', full };
}

const TABS = [
  { key: 'active', label: 'Active Deals' },
  { key: 'requested', label: 'Requested Deals' },
  { key: 'bids', label: 'My Bids' },
];

export default function MyDealsHubPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);

  // Deep-link a tab via ?tab=requested (booking-request notifications land here).
  const tabParam = searchParams.get('tab');
  const [tab, setTab] = useState(TABS.some((t) => t.key === tabParam) ? tabParam : 'active');

  const openTab = (key) => {
    setTab(key);
    const next = new URLSearchParams(searchParams);
    if (key === 'active') next.delete('tab'); else next.set('tab', key);
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    if (user?.approval_status && user.approval_status !== 'approved') { setLoading(false); return undefined; }
    fetchDeals();
    const interval = setInterval(fetchDeals, 10000);
    return () => clearInterval(interval);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchDeals = async () => {
    try {
      const res = await axios.get(`${API}/deals/my?t=${Date.now()}`);
      setDeals(res.data || []);
    } catch {
      toast.error('Failed to load deals');
    } finally {
      setLoading(false);
    }
  };

  const requested = useMemo(() => deals.filter(isRequested), [deals]);
  const active = useMemo(() => deals.filter((d) => !isRequested(d) && !isDead(d)), [deals]);

  const openDeal = (d) => navigate(`/my-deals?campaign=${d?.campaign?.id || dealId(d)}`);

  return (
    <CreatorTopNavLayout notifications={0}>
      <div className="cmk-page-head">
        <h1>My Deals</h1>
        <p>All your deals and invites in one place — active work, booking requests, and the campaigns you've bid on.</p>
      </div>

      <div className="cmk-tabs-row">
        <div className="cmk-tabs">
          {TABS.map((t) => (
            <button key={t.key} type="button" className={tab === t.key ? 'is-active' : ''} onClick={() => openTab(t.key)}>
              {t.label}
              {t.key === 'active' && <em>({active.length})</em>}
              {t.key === 'requested' && <em>({requested.length})</em>}
            </button>
          ))}
        </div>
      </div>

      {/* ---------------- Active Deals ---------------- */}
      {tab === 'active' && (
        loading ? (
          <DealsSkeleton />
        ) : active.length ? (
          <div className="mdh-grid">
            {active.map((d) => {
              const meta = activeMeta(d);
              const priv = d?.campaign?.direct_booking;
              return (
                <article key={dealId(d)} className="mdh-card cmk-rise" style={{ '--mdh': meta.color }} onClick={() => openDeal(d)} role="button" tabIndex={0}>
                  <span className="mdh-ava">
                    {dealLogo(d) ? <img src={assetUrl(dealLogo(d))} alt="" /> : getInitial(dealBrand(d))}
                  </span>
                  <div className="mdh-lead">
                    <div className="mdh-top">
                      <span className="mdh-badge" title={meta.full}><span className="mdh-dot" /> {meta.label}</span>
                      {priv && <span className="mdh-priv"><Lock size={11} /> Private</span>}
                    </div>
                    <h3>{dealTitle(d)}</h3>
                    <small>{dealBrand(d)}</small>
                  </div>
                  <div className="mdh-amt"><small>Escrow</small><strong>{formatMoney(dealAmount(d))}</strong></div>
                  <button type="button" className="mdh-go" aria-label="Open deal" onClick={(e) => { e.stopPropagation(); openDeal(d); }}>
                    <ArrowRight size={18} />
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No active deals yet"
            message="Once you accept a booking or a brand picks your bid, your live deals show up here."
            action={{ label: 'Browse Campaigns', onClick: () => navigate('/browse-briefs') }}
          />
        )
      )}

      {/* ---------------- Requested Deals ---------------- */}
      {tab === 'requested' && (
        loading ? (
          <div className="cmk-empty">Loading…</div>
        ) : requested.length ? (
          <div className="mdh-grid">
            {requested.map((d) => {
              const price = bookingStatus(d) === 'price_revision';
              return (
                <article key={dealId(d)} className="mdh-card cmk-rise is-req" onClick={() => openDeal(d)} role="button" tabIndex={0}>
                  <span className="mdh-ava">
                    {dealLogo(d) ? <img src={assetUrl(dealLogo(d))} alt="" /> : getInitial(dealBrand(d))}
                  </span>
                  <div className="mdh-lead">
                    <div className="mdh-top">
                      <span className={`mdh-badge ${price ? 'warn' : 'info'}`} title={price ? 'You proposed a custom price — waiting for the brand' : 'A brand booked you directly — accept, decline, or counter'}>
                        <Clock size={12} /> {price ? 'Counter sent — awaiting brand' : 'Awaiting your response'}
                      </span>
                      <span className="mdh-priv"><Lock size={11} /> {price ? 'Custom price' : 'Private invite'}</span>
                    </div>
                    <h3>{dealTitle(d)}</h3>
                    <small>{dealBrand(d)} · {d?.campaign?.video_count || 1} video(s)</small>
                  </div>
                  <div className="mdh-amt">
                    <small>{price ? 'You countered' : "You'll get"}</small>
                    <strong>{formatMoney(price ? d?.campaign?.proposed_amount : dealAmount(d))}</strong>
                  </div>
                  <button type="button" className="mdh-review" onClick={(e) => { e.stopPropagation(); openDeal(d); }}>
                    {price ? 'View counter' : 'Accept · decline · counter'} <ArrowRight size={15} />
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No requests right now"
            message="When a brand books you directly or proposes a custom deal, the invite lands here to accept, decline, or counter."
          />
        )
      )}

      {/* ---------------- My Bids ---------------- */}
      {tab === 'bids' && <MyBidsContent />}

      <style>{`
        /* auto-fit + 1fr: cards STRETCH to fill the full row width instead of
           being capped at 480px with empty tracks to the right. One deal spans
           the whole width; several deals fill the row with no dead space. */
        .mdh-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 16px; }
        .mdh-card { position: relative; display: grid; grid-template-columns: 48px minmax(0,1fr) auto; align-items: center;
          column-gap: 14px; row-gap: 12px;
          background: #fff; border: 1px solid #eef0f6; border-left: 4px solid var(--mdh, #4452f0); border-radius: 16px;
          padding: 16px 54px 16px 16px; cursor: pointer; transition: box-shadow .18s, transform .18s; }
        .mdh-card:hover { box-shadow: 0 18px 40px -26px rgba(15,23,42,.5); transform: translateY(-2px); }
        .mdh-card.is-req { border-left-color: #4452f0; }
        .mdh-ava { width: 48px; height: 48px; border-radius: 13px; display: grid; place-items: center; overflow: hidden;
          background: linear-gradient(135deg,#eef0ff,#e0e4ff); color: #4452f0; font-weight: 800; font-size: 19px; }
        .mdh-ava img { width: 100%; height: 100%; object-fit: cover; }
        .mdh-lead { min-width: 0; }
        .mdh-top { display: flex; align-items: center; gap: 7px; margin-bottom: 6px; min-width: 0; }
        .mdh-badge { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 700;
          color: #15803d; background: #e6f6ec; border-radius: 999px; padding: 3px 10px; max-width: 100%;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .mdh-badge.info { color: #3730a3; background: #eef0ff; }
        .mdh-badge.warn { color: #b45309; background: #fff7ed; }
        .mdh-dot { flex: none; width: 7px; height: 7px; border-radius: 50%; background: var(--mdh, #16a34a); }
        .mdh-priv { flex: none; display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 700;
          color: #64748b; background: #f1f3fa; border-radius: 999px; padding: 3px 9px; white-space: nowrap; }
        .mdh-lead h3 { margin: 0; font-size: 15px; font-weight: 700; color: #15163a; line-height: 1.3; overflow: hidden;
          text-overflow: ellipsis; white-space: nowrap; }
        .mdh-lead small { color: #9296ba; font-size: 12.5px; }
        .mdh-amt { text-align: right; white-space: nowrap; }
        .mdh-amt small { display: block; color: #9296ba; font-size: 11px; font-weight: 600; }
        .mdh-amt strong { color: #15163a; font-size: 15px; font-family: var(--font-head,'Plus Jakarta Sans',sans-serif); }
        .mdh-go { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); width: 34px; height: 34px;
          border: 0; border-radius: 10px; background: #f1f3fa; color: #4452f0; display: grid; place-items: center; cursor: pointer; }
        .mdh-go:hover { background: #e6e9ff; }
        .mdh-review { grid-column: 1 / -1; margin: 0; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          border: 0; border-radius: 10px; padding: 10px 16px; font-weight: 700; font-size: 13.5px; cursor: pointer; font-family: inherit;
          background: linear-gradient(100deg,#12124f,#07074e); color: #fff; box-shadow: 0 12px 26px -12px rgba(7,7,78,.7); }
        .mdh-card.is-req { padding-right: 16px; }
        @media (max-width: 560px) { .mdh-grid { grid-template-columns: 1fr; } }
      `}</style>
    </CreatorTopNavLayout>
  );
}
