import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { WifiOff, Send } from 'lucide-react';
import AppShell from '../../shell/AppShell';
import BottomSheet from '../../shell/BottomSheet';
import { useAuth } from '../../../App';
import { useLiveEffect } from '../../../lib/liveUpdates';
import { inr } from '../../../components/briefUi';
import { timeAgo } from '../../../utils/normalizeBrief';
import { API, OFFLINE, failText, Logo, BriefTabs, BriefCardSkeleton } from './briefsShared';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent');
const getBidStatus = (item) => (item?.bid_status || item?.my_bid?.status || item?.bid?.status || 'pending').toLowerCase();
const brandOf = (c) => String(c?.brand_name || c?.business_name || c?.company_name || c?.business_nickname || c?.brand_handle || '').replace(/^@+/, '').trim() || 'Brand';

// "Won" bids (the brand picked this creator) get the green card + an Open order shortcut.
const WON = ['selected', 'accepted', 'approved'];
const isWaiting = (s) => !WON.includes(s) && s !== 'rejected';
const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
const statusMeta = (s) => {
  if (WON.includes(s)) return { label: 'Picked you!', tone: 'ok' };
  if (s === 'rejected') return { label: 'Not picked', tone: 'muted' };
  if (['pending', 'submitted', 'bid_submitted'].includes(s)) return { label: 'Waiting', tone: 'warn' };
  return { label: titleCase(s), tone: 'warn' };
};
// No "Shortlisted" filter: /bids/my only ever returns pending / approved / rejected.
const FILTERS = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'waiting', label: 'Waiting', match: isWaiting },
  { key: 'accepted', label: 'Accepted', match: (s) => WON.includes(s) },
  { key: 'rejected', label: 'Rejected', match: (s) => s === 'rejected' },
];
const GROUPS = [
  { key: 'won', title: 'Needs you', match: (s) => WON.includes(s) },
  { key: 'wait', title: 'Waiting on brand', match: isWaiting },
  { key: 'closed', title: 'Closed', match: (s) => s === 'rejected' },
];

// Render a brief string as "Label: value" lines (budget visibility is brand-only, never shown).
const BriefText = ({ text }) => String(text || '').split('\n').map((line, i) => {
  const t = line.trim();
  if (!t) return null;
  const idx = t.indexOf(':');
  if (idx > 0 && /^budget visibility$/i.test(t.slice(0, idx).trim())) return null;
  return idx > 0 && idx <= 28
    ? <p className="ap-bf-line" key={i}><b>{t.slice(0, idx + 1)}</b> {t.slice(idx + 1).trim()}</p>
    : <p className="ap-bf-line" key={i}>{t}</p>;
});

// The applications list + detail sheet without the screen frame (also the "Applied" tab of Find briefs).
export function BidsContent({ onCount }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const pendingApproval = Boolean(user?.approval_status && user.approval_status !== 'approved');

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/bids/my?t=${Date.now()}`);
      setBids(res.data || []);
      if (onCount) onCount((res.data || []).length);
      setLoadError('');
    } catch (err) {
      // Polled every 10s: keep the last list, never toast-spam; show Retry only when there is nothing to show.
      setLoadError(failText(err, 'Could not load your bids.'));
    } finally {
      setLoading(false);
    }
  };

  useLiveEffect(() => {
    if (pendingApproval) { setLoading(false); return undefined; }
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [user?.id, pendingApproval]); // eslint-disable-line react-hooks/exhaustive-deps

  const openView = async (item) => {
    setSelected(item);
    setDetail(null);
    const cid = item.campaign?.id || item.campaign?._id;
    if (!cid) return;
    setDetailLoading(true);
    try {
      setDetail((await axios.get(`${API}/campaigns/${cid}`)).data);
    } catch { /* fall back to the row's campaign data */ } finally { setDetailLoading(false); }
  };

  const counts = useMemo(() => {
    const o = {};
    FILTERS.forEach((f) => { o[f.key] = bids.filter((b) => f.match(getBidStatus(b))).length; });
    return o;
  }, [bids]);
  const rows = useMemo(() => {
    const f = FILTERS.find((x) => x.key === filter);
    return bids.filter((b) => f.match(getBidStatus(b)));
  }, [bids, filter]);

  if (pendingApproval) {
    return <div className="ap-empty ap-card"><h3>Applications unlock after approval</h3><p>Your profile is still being reviewed. You can send applications once you are live.</p></div>;
  }
  if (loading) return <div className="ap-bf-list" aria-hidden="true"><BriefCardSkeleton /><BriefCardSkeleton /></div>;
  if (loadError && !bids.length) {
    return (
      <div className="ap-empty ap-card">
        {loadError === OFFLINE ? <WifiOff size={34} /> : <Send size={34} />}
        <h3>Could not load bids</h3><p>{loadError}</p>
        <button type="button" className="ap-btn" onClick={() => { setLoading(true); fetchData(); }}>Retry</button>
      </div>
    );
  }
  if (!bids.length) {
    return (
      <div className="ap-empty ap-card">
        <Send size={34} />
        <h3>No applications yet</h3>
        <p>Browse open briefs and send an application to start winning brand deals.</p>
        <button type="button" className="ap-btn" onClick={() => navigate('/browse-briefs', { replace: true })}>Browse briefs</button>
      </div>
    );
  }

  const sheetC = selected ? (detail || selected.campaign || {}) : {};
  const sheetBid = selected ? (selected.my_bid || selected.bid || {}) : {};
  const sheetStatus = selected ? getBidStatus(selected) : 'pending';
  const sheetMeta = statusMeta(sheetStatus);
  const sheetBrand = brandOf(sheetC);
  const budget = (sheetC.budget_min || sheetC.budget_max)
    ? `${inr(sheetC.budget_min || sheetC.budget_max)}${sheetC.budget_max && sheetC.budget_max !== sheetC.budget_min ? ` – ${inr(sheetC.budget_max)}` : ''}`
    : inr(sheetBid.amount);

  return (
    <>
      <div className="ap-bf-sum" role="group" aria-label="Application summary">
        <button type="button" onClick={() => setFilter('accepted')}><b style={{ color: '#13774f' }}>{counts.accepted}</b>picked</button>
        <button type="button" onClick={() => setFilter('waiting')}><b>{counts.waiting}</b>waiting</button>
        <button type="button" onClick={() => setFilter('rejected')}><b style={{ color: 'var(--ap-muted)' }}>{counts.rejected}</b>not picked</button>
      </div>
      <div className="ap-chips" role="tablist" aria-label="Filter applications">
        {FILTERS.map((f) => (
          <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} className={`ap-chip${filter === f.key ? ' is-on' : ''}`} onClick={() => setFilter(f.key)}>
            {f.label} ({counts[f.key] || 0})
          </button>
        ))}
      </div>
      {loadError && <div className="ap-bf-err" role="alert"><span>{loadError}</span><button type="button" onClick={fetchData}>Retry</button></div>}

      {GROUPS.map((g) => {
        const list = rows.filter((item) => g.match(getBidStatus(item)));
        if (!list.length) return null;
        return (
          <section key={g.key} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="ap-bf-grp">{g.title}</div>
            {list.map((item) => {
              const c = item.campaign || {};
              const bid = item.my_bid || item.bid || {};
              const status = getBidStatus(item);
              const won = WON.includes(status);
              const lost = status === 'rejected';
              const brand = brandOf(c);
              const sent = item.submitted_at || bid.submitted_at;
              const sentMs = sent ? new Date(sent).getTime() : 0;
              const what = won ? `${brand} chose you.` : lost ? 'They chose another creator.' : sentMs ? `Sent ${timeAgo(sentMs)}.` : 'Waiting for the brand to decide.';
              return (
                <div role="button" tabIndex={0} key={bid.id || c.id} className={`ap-bf-bid${won ? ' is-won' : ''}${lost ? ' is-closed' : ''}`} onClick={() => openView(item)} onKeyDown={(e) => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openView(item); } }}>
                  <div className="ap-bf-bid-h">
                    <Logo name={brand} src={c.brand_logo} size="sm" />
                    <div><b title={c.title}>{c.title || 'Campaign'}</b><small>{brand}</small></div>
                    <div><small>Your bid</small><strong>{inr(bid.amount || c.budget_max || c.budget)}</strong></div>
                  </div>
                  <div className="ap-bf-seg" aria-hidden="true"><span className="on" style={won ? { background: '#13774f' } : undefined} /><span className={won ? 'won' : lost ? 'lost' : ''} /></div>
                  <div className="ap-bf-segl" aria-hidden="true"><span>Sent</span><span className={won || lost ? 'cur' : ''} style={won ? { color: '#13774f' } : undefined}>{won ? 'Picked' : lost ? 'Not picked' : 'Decision'}</span></div>
                  <div className="ap-bf-bid-f">
                    <span className={won ? 'ok' : ''}>{what}</span>
                    {won
                      ? <button type="button" className="ap-btn ap-btn--sm" style={{ height: 44 }} onClick={(e) => { e.stopPropagation(); navigate(`/my-deals?campaign=${c.id}`); }}>Open order</button>
                      : <span className="ap-bf-viewlink">View</span>}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
      {rows.length === 0 && (
        <div className="ap-empty ap-card">
          <h3>No bids in “{FILTERS.find((f) => f.key === filter).label}”</h3>
          <p>Try another filter to see your other applications.</p>
          <button type="button" className="ap-btn ap-btn--ghost" onClick={() => setFilter('all')}>Show all</button>
        </div>
      )}

      <BottomSheet
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        tall
        title={sheetC.title || 'Campaign'}
        subtitle={sheetBrand}
        footer={(
          <>
            <button type="button" className="ap-btn ap-btn--ghost" style={{ flex: 1 }} onClick={() => setSelected(null)}>Close</button>
            <button type="button" className="ap-btn" style={{ flex: 1 }} onClick={() => { const id = sheetC.business_id || sheetC.business?.id; navigate(id ? `/messages?conv=${id}` : '/messages'); }}>Message brand</button>
          </>
        )}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span className={`ap-pill ap-pill--${sheetMeta.tone}`}>{sheetMeta.label}</span>
          {sheetC.category && <span className="ap-pill">{sheetC.category}</span>}
        </div>
        <div className="ap-bf-stats">
          <div><small>Brief budget</small><b>{budget}</b></div>
          <div><small>Your bid</small><b>{inr(sheetBid.amount)}</b></div>
          <div><small>Delivery</small><b>{sheetBid.estimated_delivery_days ? `${sheetBid.estimated_delivery_days} days` : '-'}</b></div>
          <div><small>Submitted</small><b>{fmtDate(selected?.submitted_at || sheetBid.submitted_at)}</b></div>
        </div>
        <div className="ap-bf-sec">
          <h4>Brief</h4>
          {detailLoading && !detail
            ? <span className="ap-skel" style={{ display: 'block', height: 60 }} />
            : (sheetC.brief_text || sheetC.deliverables) ? <BriefText text={sheetC.brief_text || sheetC.deliverables} /> : <p>No brief details provided.</p>}
        </div>
        {Array.isArray(sheetC.objectives) && sheetC.objectives.length > 0 && (
          <div className="ap-bf-sec"><h4>Objectives</h4><div className="ap-bf-tags">{sheetC.objectives.map((o, i) => <span className="ap-pill" key={i}>{o}</span>)}</div></div>
        )}
        {sheetBid.proposal && <div className="ap-bf-sec"><h4>Your proposal</h4><p>{sheetBid.proposal}</p></div>}
      </BottomSheet>
    </>
  );
}

export default function Bids() {
  return (
    <AppShell title="Find briefs" subtitle="Track every application here.">
      <BriefTabs active="applied" />
      <BidsContent />
    </AppShell>
  );
}
