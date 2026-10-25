// Creator app: Orders list (replaces /my-deals hub and /my-active-work).
// /my-deals?campaign=<id> | ?deal=<id> is the order room, exactly like the website route.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { Clock, Package, RefreshCw, WifiOff } from 'lucide-react';
import { useAuth } from '../../../App';
import { useLiveEffect } from '../../../lib/liveUpdates';
import { inr, brandTile, orderStatus, dueLabel, shortDate } from '../../../utils/orderUi';
import AppShell from '../../shell/AppShell';
import OrderRoom from './OrderRoom';
import {
  API, assetUrl, initial, dealBrand, dealLogo, dealTitle, dealKey, dealAmount, bookingStatus,
  groupDeals, rowAction, roomProgress, pillClass, loadErrorText,
} from './orderLogic';
import './orders.css';

const TABS = [
  { key: 'active', label: 'Active' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'completed', label: 'Completed' },
  { key: 'requested', label: 'Requests' },
  { key: 'cancelled', label: 'Cancelled' },
];

function BrandTile({ deal, size }) {
  const name = dealBrand(deal);
  const { bg, fg } = brandTile(name);
  const logo = dealLogo(deal);
  return (
    <span className="ap-or-tile" style={{ width: size, height: size, background: logo ? '#fff' : bg, color: fg, fontSize: size * 0.42 }}>
      {logo ? <img src={assetUrl(logo)} alt="" /> : initial(name)}
    </span>
  );
}

function BrandLine({ deal, right }) {
  const name = dealBrand(deal);
  const { fg } = brandTile(name);
  return (
    <div className="ap-or-by">
      <span className="ap-or-mini" style={{ background: fg }}>{initial(name)}</span>
      <span className="n">{name}</span>
      {right}
    </div>
  );
}

function Segs({ progress }) {
  return (
    <div className="ap-or-segs" aria-hidden="true">
      {progress.fill.map((f, i) => <i key={i} className={f === 1 ? 'on' : f === 0.5 ? 'half' : ''} />)}
    </div>
  );
}

function DuePill({ due }) {
  if (!due) return null;
  return <span className={pillClass(due.tone)}><Clock size={12} />{due.text}</span>;
}

function OrderCard({ deal, kind, onOpen }) {
  const st = orderStatus(deal);
  const due = dueLabel(deal);
  const act = rowAction(deal);
  const progress = roomProgress(deal);
  const priv = deal?.campaign?.direct_booking;
  const price = bookingStatus(deal) === 'price_revision';
  const open = (extra) => onOpen(deal, extra);

  if (kind === 'requested') {
    return (
      <article className="ap-or-card">
        <button type="button" className="ap-or-main" onClick={() => open()}>
          <div className="ap-or-top">
            <BrandTile deal={deal} size={44} />
            <div className="ap-or-grow">
              <BrandLine deal={deal} right={<strong>{inr(price ? deal?.campaign?.proposed_amount : dealAmount(deal))}</strong>} />
              <div className="ap-or-ttl">{dealTitle(deal)}</div>
            </div>
          </div>
        </button>
        <div className="ap-or-foot">
          <div className="ap-or-grow">
            <span className={pillClass(price ? 'warn' : 'info')}><Clock size={12} />{price ? 'Awaiting brand' : 'Awaiting your reply'}</span>
            <div className="nx">{price ? 'You countered - waiting for the brand' : `${deal?.campaign?.video_count || 1} video(s) · accept, decline or counter`}</div>
          </div>
          <button type="button" className={`ap-or-btn${price ? ' ap-or-btn--soft' : ''}`} onClick={() => open()}>{price ? 'View counter' : 'Respond'}</button>
        </div>
      </article>
    );
  }

  return (
    <article className={`ap-or-card${kind === 'cancelled' ? ' ap-or-card--dim' : ''}`}>
      <button type="button" className="ap-or-main" onClick={() => open()} aria-label={`Open order: ${dealTitle(deal)}`}>
        <div className="ap-or-top">
          <BrandTile deal={deal} size={44} />
          <div className="ap-or-grow">
            <BrandLine deal={deal} right={<strong>{inr(dealAmount(deal))}</strong>} />
            <div className="ap-or-ttl">{dealTitle(deal)}</div>
          </div>
        </div>
        <div className="ap-or-step">
          <span><strong>{progress.labels[progress.cur]}</strong> <em>· step {progress.step} of {progress.total}</em></span>
          <span className={pillClass(st.tone)}>{st.label}</span>
        </div>
        <Segs progress={progress} />
      </button>
      <div className="ap-or-foot">
        <div className="ap-or-grow">
          {due ? <DuePill due={due} /> : priv ? <span className="ap-pill ap-pill--muted">Private</span> : null}
          <div className="nx">{deal.primary_next_action ? `Next: ${deal.primary_next_action}` : (deal.current_state || '')}</div>
        </div>
        {kind !== 'cancelled' && (
          <button type="button" className={`ap-or-btn${act.soft ? ' ap-or-btn--soft' : ''}`} onClick={() => open(act.deliver ? { tab: 'deliverables' } : undefined)}>{act.label}</button>
        )}
      </div>
    </article>
  );
}

function DoneRows({ list, onOpen }) {
  return list.map((d) => (
    <button key={dealKey(d)} type="button" className="ap-or-drow" onClick={() => onOpen(d)}>
      <BrandTile deal={d} size={34} />
      <div className="ap-or-grow">
        <div className="t">{dealTitle(d)}</div>
        <div className="s">{dealBrand(d)} · {d?.escrow?.estimated_payout_at ? `paid ${shortDate(d.escrow.estimated_payout_at)}` : 'paid'}</div>
      </div>
      <strong>{inr(dealAmount(d))}</strong>
    </button>
  ));
}

function ListSkeleton() {
  return (
    <div className="ap-or-wrap" aria-busy="true" aria-label="Loading orders">
      <div className="ap-skel" style={{ height: 118, borderRadius: 22 }} />
      <div className="ap-skel" style={{ height: 22, width: '70%' }} />
      {[0, 1, 2].map((i) => (
        <div className="ap-or-skel-card" key={i}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="ap-skel" style={{ width: 44, height: 44 }} />
            <div style={{ flex: 1 }}>
              <div className="ap-skel" style={{ height: 12, width: '40%' }} />
              <div className="ap-skel" style={{ height: 16, width: '75%', marginTop: 8 }} />
            </div>
          </div>
          <div className="ap-skel" style={{ height: 8, marginTop: 18 }} />
          <div className="ap-skel" style={{ height: 40, marginTop: 16, borderRadius: 999 }} />
        </div>
      ))}
    </div>
  );
}

function OrdersList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const tabParam = searchParams.get('tab');
  const [tab, setTab] = useState(TABS.some((t) => t.key === tabParam) ? tabParam : 'active');
  const fetching = useRef(false);

  const fetchDeals = async () => {
    if (fetching.current) return;
    fetching.current = true;
    try {
      const res = await axios.get(`${API}/deals/my?summary=true`);
      setDeals(Array.isArray(res.data) ? res.data : []);
      setLoadError('');
    } catch (err) {
      // Polled every 10s: keep the last list on screen; the banner/empty error says what happened.
      setLoadError(loadErrorText(err, 'Could not load your orders.'));
    } finally {
      fetching.current = false;
      setLoading(false);
    }
  };

  useLiveEffect(() => {
    if (user?.approval_status && user.approval_status !== 'approved') { setLoading(false); return undefined; }
    fetchDeals();
    const interval = setInterval(fetchDeals, 10000);
    return () => clearInterval(interval);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => groupDeals(deals), [deals]);
  const { active, delivered, completed, requested, cancelled } = groups;
  const inEscrow = active.concat(delivered).reduce((s, d) => s + dealAmount(d), 0);
  const paidOut = completed.reduce((s, d) => s + dealAmount(d), 0);
  const needYou = active.filter((d) => d.active_party === 'creator').length;
  const nOpen = active.length + delivered.length;
  const awaitingReply = requested.filter((d) => bookingStatus(d) === 'pending_creator').length;

  const openTab = (key) => {
    setTab(key);
    const next = new URLSearchParams(searchParams);
    if (key === 'active') next.delete('tab'); else next.set('tab', key);
    setSearchParams(next, { replace: true });
  };
  const openDeal = (d, extra) => {
    const id = d?.campaign?.id || dealKey(d);
    navigate(`/my-deals?campaign=${encodeURIComponent(id)}${extra?.tab ? `&tab=${extra.tab}` : ''}`);
  };
  const retry = () => { setLoading(true); fetchDeals(); };
  const tabsRef = useRef(null);
  useEffect(() => { tabsRef.current?.querySelector('.is-on')?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' }); }, [tab, loading]);

  const counts = { active: active.length, delivered: delivered.length, completed: completed.length, requested: requested.length, cancelled: cancelled.length };
  const tabs = TABS.filter((t) => ['active', 'delivered', 'completed'].includes(t.key) || counts[t.key] > 0 || tab === t.key);
  const lists = { active, delivered, completed, requested, cancelled };
  const list = lists[tab] || [];
  const emptyCopy = {
    delivered: ['Nothing waiting on a brand', 'Work you deliver shows up here until the brand approves it.'],
    completed: ['No paid orders yet', 'Orders show here once the brand approves and you are paid.'],
    requested: ['No requests right now', 'When a brand books you directly or proposes a custom deal, it lands here to accept, decline or counter.'],
    cancelled: ['No cancelled orders', 'Cancelled or declined orders will show here.'],
  };

  let body;
  if (loading) body = <ListSkeleton />;
  else if (loadError && !deals.length) {
    body = (
      <div className="ap-empty">
        {loadError.startsWith("You're offline") ? <WifiOff size={36} color="#6e6e96" /> : <RefreshCw size={36} color="#6e6e96" />}
        <h3>Could not load orders</h3>
        <p>{loadError}</p>
        <button type="button" className="ap-btn" onClick={retry}>Retry</button>
      </div>
    );
  } else if (!list.length) {
    const [t, p] = emptyCopy[tab] || ['No orders yet', 'When a brand picks you or you accept an invite, the order shows up here.'];
    body = (
      <div className="ap-empty">
        <Package size={36} color="#6e6e96" />
        <h3>{tab === 'active' && !deals.length ? 'No orders yet' : (tab === 'active' ? 'No active orders' : t)}</h3>
        <p>{tab === 'active' ? 'When a brand picks you or you accept an invite, the order shows up here.' : p}</p>
        {tab === 'active' && <button type="button" className="ap-btn" onClick={() => navigate('/browse-briefs')}>Find briefs</button>}
        {tab !== 'active' && deals.length > 0 && <button type="button" className="ap-btn ap-btn--ghost" onClick={() => openTab('active')}>See active orders</button>}
      </div>
    );
  } else if (tab === 'completed') {
    body = <div className="ap-or-done"><DoneRows list={list} onOpen={openDeal} /></div>;
  } else {
    body = list.map((d) => <OrderCard key={dealKey(d)} deal={d} kind={tab} onOpen={openDeal} />);
  }

  return (
    <AppShell title="Orders">
      <div className="ap-or-wrap">
        {!loading && !(loadError && !deals.length) && (
          <div className="ap-or-sum">
            <div className="ap-or-sum-top">
              <div>
                <small>In progress · {nOpen} order{nOpen === 1 ? '' : 's'}</small>
                <div className="ap-or-sum-big">{inr(inEscrow)}</div>
              </div>
              <div className="ap-or-sum-r">
                <small>Paid out</small>
                <b>{inr(paidOut)}</b>
              </div>
            </div>
            <div className="ap-or-sum-grid">
              <div><strong>{needYou}</strong>need you</div>
              <div><strong>{delivered.length}</strong>in review</div>
              <div><strong>{completed.length}</strong>completed</div>
            </div>
          </div>
        )}

        {loadError && deals.length > 0 && (
          <div className="ap-or-err" role="alert"><span>{loadError} Showing the last loaded list.</span><button type="button" onClick={retry}>Retry</button></div>
        )}

        {awaitingReply > 0 && tab !== 'requested' && (
          <div className="ap-or-err" role="status">
            <span><b>{awaitingReply} booking request{awaitingReply === 1 ? '' : 's'}</b> waiting for your answer.</span>
            <button type="button" onClick={() => openTab('requested')}>Review</button>
          </div>
        )}

        <div className="ap-or-tabs" role="tablist" ref={tabsRef}>
          {tabs.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`ap-or-tab${tab === t.key ? ' is-on' : ''}`} onClick={() => openTab(t.key)}>
              {t.label}
              {!loading && <span className="ap-or-count">{counts[t.key]}</span>}
            </button>
          ))}
        </div>

        {body}

        {!loading && tab === 'active' && completed.length > 0 && (
          <div className="ap-or-done">
            <div className="ap-or-done-h"><b>Recently completed</b><button type="button" className="ap-link" onClick={() => openTab('completed')}>See all {completed.length}</button></div>
            <DoneRows list={completed.slice(0, 3)} onOpen={openDeal} />
          </div>
        )}

        {!loading && (
          <button type="button" className="ap-or-link" style={{ alignSelf: 'center' }} onClick={() => navigate('/my-bids')}>Waiting on a brand to pick you? See your bids</button>
        )}
      </div>
    </AppShell>
  );
}

export default function Orders() {
  const [sp] = useSearchParams();
  return sp.get('campaign') || sp.get('deal') ? <OrderRoom /> : <OrdersList />;
}
