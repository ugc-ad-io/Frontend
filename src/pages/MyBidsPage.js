import { useLiveEffect } from '../lib/liveUpdates';
import { useState, useMemo } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { X } from 'lucide-react';
import EmptyState from '../components/EmptyState';
import { SkeletonTable } from '../components/Skeleton';
import { BriefLogo, inr } from '../components/briefUi';
import { timeAgo } from '../utils/normalizeBrief';
import '../styles/creator-ui-briefs.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent');
const getBidStatus = (item) => (item?.bid_status || item?.my_bid?.status || item?.bid?.status || 'pending').toLowerCase();
const brandOf = (c) => String(c?.brand_name || c?.business_name || c?.company_name || c?.business_nickname || c?.brand_handle || '').replace(/^@+/, '').trim() || 'Brand';

// Render a brief string with distinct colors for the field labels vs. their values
const renderBrief = (text) => {
  const lines = String(text || '').split('\n');
  return lines.map((line, i) => {
    if (!line.trim()) return <span key={i} className="cui-b-brief-gap" />;
    const idx = line.indexOf(':');
    // Budget visibility is a brand-only setting — never surface it to creators.
    if (idx > 0 && /^budget visibility$/i.test(line.slice(0, idx).trim())) return null;
    if (idx === -1) return <span key={i} className="cui-b-brief-line"><span className="cui-b-brief-val">{line}</span></span>;
    return (
      <span key={i} className="cui-b-brief-line">
        <span className="cui-b-brief-label">{line.slice(0, idx + 1)}</span>
        <span className="cui-b-brief-val">{line.slice(idx + 1)}</span>
      </span>
    );
  });
};

// "Won" bids (brand picked this creator) — green pill + a Deal Room shortcut.
const WON_STATUSES = ['selected', 'accepted', 'approved'];
const isWaiting = (s) => !WON_STATUSES.includes(s) && s !== 'rejected';
const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
// Board C20 wording for each status.
const statusMeta = (s) => {
  if (WON_STATUSES.includes(s)) return { label: 'Picked you!', tone: 'ok' };
  if (s === 'rejected') return { label: 'Not picked', tone: 'info' };
  if (['pending', 'submitted', 'bid_submitted'].includes(s)) return { label: 'Waiting', tone: 'warn' };
  return { label: titleCase(s), tone: 'warn' };
};

const TABS = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'waiting', label: 'Waiting', match: isWaiting },
  // No "Shortlisted" tab: the backend (/bids/my) only ever returns pending / approved / rejected, so it could never show a bid.
  { key: 'accepted', label: 'Accepted', match: (s) => WON_STATUSES.includes(s) },
  { key: 'rejected', label: 'Rejected', match: (s) => s === 'rejected' },
];

// The old standalone page now lives as the "Applied" tab of Find briefs.
export default function MyBidsPage() {
  return <Navigate to="/browse-briefs?tab=applied" replace />;
}

// The status filter + bids list + detail sheet, without the page shell — rendered as the
// "Applied" tab of Find briefs and as the "My Bids" tab of the My Deals hub.
export function MyBidsContent({ onCount, query = '' }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('all');
  const [selected, setSelected] = useState(null); // the bid item being viewed
  const [detail, setDetail] = useState(null); // full campaign fetched on open
  const [detailLoading, setDetailLoading] = useState(false);

  const openView = async (item) => {
    setSelected(item);
    setDetail(null);
    const cid = item.campaign?.id || item.campaign?._id;
    if (!cid) return;
    setDetailLoading(true);
    try {
      const res = await axios.get(`${API}/campaigns/${cid}`);
      setDetail(res.data);
    } catch { /* fall back to the row's campaign data */ }
    finally { setDetailLoading(false); }
  };

  useLiveEffect(() => {
    if (user?.approval_status && user.approval_status !== 'approved') return undefined;
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/bids/my?t=${Date.now()}`);
      setBids(res.data || []);
      if (onCount) onCount((res.data || []).length);
      setLoadError('');
    } catch (err) {
      // Polled every 10s: keep the last list, never toast-spam; show Retry when there is nothing to show.
      setLoadError(err?.response ? 'Could not load your bids.' : "You're offline. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const counts = useMemo(() => {
    const o = {};
    TABS.forEach((t) => { o[t.key] = bids.filter((b) => t.match(getBidStatus(b))).length; });
    return o;
  }, [bids]);

  const rows = useMemo(() => {
    const t = TABS.find((x) => x.key === tab);
    const q = String(query || '').trim().toLowerCase();
    return bids
      .filter((b) => t.match(getBidStatus(b)))
      .filter((b) => {
        if (!q) return true;
        const c = b.campaign || {};
        return `${brandOf(c)} ${c.title || ''} ${c.description || ''}`.toLowerCase().includes(q);
      });
  }, [bids, tab, query]);

  return (
    <>
      <div className="cui-b-seg" role="tablist" aria-label="Filter applications">
        {TABS.map((t) => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={tab === t.key ? 'is-on' : ''} onClick={() => setTab(t.key)}>
            {t.label} ({counts[t.key] || 0})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="cui-b-table"><SkeletonTable rows={5} cols={5} /></div>
      ) : loadError && !bids.length ? (
        <EmptyState title="Could not load bids" message={loadError} action={{ label: 'Retry', onClick: () => { setLoading(true); fetchData(); } }} />
      ) : rows.length ? (
        <div className="cui-b-table">
          <div className="cui-b-trow cui-b-thead" aria-hidden="true">
            <span>BRIEF</span><span>YOUR BID</span><span>STATUS</span><span>WHAT’S HAPPENING</span><span />
          </div>
          {rows.map((item) => {
            const c = item.campaign || {};
            const bid = item.my_bid || item.bid || {};
            const status = getBidStatus(item);
            const meta = statusMeta(status);
            const brand = brandOf(c);
            const sent = item.submitted_at || bid.submitted_at;
            const sentMs = sent ? new Date(sent).getTime() : 0;
            const what = WON_STATUSES.includes(status)
              ? `${brand} chose you.`
              : status === 'rejected' ? 'They chose another creator.'
                : sentMs ? `Sent ${timeAgo(sentMs)}.` : 'Waiting for the brand to decide.';
            return (
              <div key={bid.id || c.id} className="cui-b-trow is-row" onClick={() => openView(item)}>
                <div className="cui-b-t-brief">
                  <BriefLogo name={brand} src={c.brand_logo} />
                  <div><small>{brand}</small><b title={c.title}>{c.title || 'Campaign'}</b></div>
                </div>
                <strong className="cui-b-t-bid">{inr(bid.amount || c.budget_max || c.budget)}</strong>
                <span className="cui-b-t-status"><span className={`cui-b-badge ${meta.tone}`}>{meta.label}</span></span>
                <span className="cui-b-t-what">{what}</span>
                <span className="cui-b-t-act">
                  {WON_STATUSES.includes(status) && (
                    <button type="button" className="cui-b-pill-btn" onClick={(e) => { e.stopPropagation(); navigate(`/my-deals?campaign=${c.id}`); }}>Open order</button>
                  )}
                  <button type="button" className={`cui-b-pill-btn ${WON_STATUSES.includes(status) ? 'is-ghost' : 'is-soft'}`} onClick={(e) => { e.stopPropagation(); openView(item); }}>View</button>
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState title={String(query || '').trim() ? `No bids match “${String(query).trim()}”` : `No bids in “${TABS.find((t) => t.key === tab).label}”`} message="Browse open briefs and send an application to start winning brand deals." action={{ label: 'Browse briefs', onClick: () => navigate('/browse-briefs') }} />
      )}

      {selected && (() => {
        const c = detail || selected.campaign || {};
        const bid = selected.my_bid || selected.bid || {};
        const status = getBidStatus(selected);
        const meta = statusMeta(status);
        const brand = brandOf(c);
        const budget = (c.budget_min || c.budget_max)
          ? `${inr(c.budget_min || c.budget_max)}${c.budget_max && c.budget_max !== c.budget_min ? ` – ${inr(c.budget_max)}` : ''}`
          : inr(bid.amount);
        return (
          <div className="cui-b-sheet-bg" onClick={() => setSelected(null)}>
            <aside className="cui-b-sheet" role="dialog" aria-modal="true" aria-label="Your bid" onClick={(e) => e.stopPropagation()}>
              <div className="cui-b-sheet-head">
                <BriefLogo name={brand} src={c.brand_logo} />
                <div>
                  <strong>{c.title || 'Campaign'}</strong>
                  <small>{brand}</small>
                </div>
                <button type="button" className="cui-b-x" aria-label="Close" onClick={() => setSelected(null)}><X size={20} /></button>
              </div>

              <div className="cui-b-sheet-body">
                <div className="cui-b-metas">
                  <span className={`cui-b-badge ${meta.tone}`}>{meta.label}</span>
                  {c.category && <span className="cui-b-badge info">{c.category}</span>}
                </div>

                <div className="cui-b-stats">
                  <div><small>Brief budget</small><b>{budget}</b></div>
                  <div><small>Your bid</small><b>{inr(bid.amount)}</b></div>
                  <div><small>Delivery</small><b>{bid.estimated_delivery_days ? `${bid.estimated_delivery_days} days` : '-'}</b></div>
                  <div><small>Submitted</small><b>{fmtDate(selected.submitted_at || bid.submitted_at)}</b></div>
                </div>

                <div className="cui-b-sec">
                  <h4>Brief</h4>
                  {detailLoading && !detail ? <p className="cui-b-muted">Loading brief…</p> : (
                    <div className="cui-b-text cui-b-brief">{(c.brief_text || c.deliverables) ? renderBrief(c.brief_text || c.deliverables) : 'No brief details provided.'}</div>
                  )}
                </div>

                {Array.isArray(c.objectives) && c.objectives.length > 0 && (
                  <div className="cui-b-sec">
                    <h4>Objectives</h4>
                    <div className="cui-b-tags">{c.objectives.map((o, i) => <span key={i}>{o}</span>)}</div>
                  </div>
                )}

                {bid.proposal && (
                  <div className="cui-b-sec">
                    <h4>Your proposal</h4>
                    <p className="cui-b-text">{bid.proposal}</p>
                  </div>
                )}
              </div>

              <div className="cui-b-sheet-foot">
                <button type="button" className="cui-b-pill-btn is-ghost" onClick={() => setSelected(null)}>Close</button>
                <button type="button" className="cui-b-pill-btn" onClick={() => { const id = c.business_id || c.business?.id; if (id) navigate(`/messages?conv=${id}`); else navigate('/messages'); }}>Message brand</button>
              </div>
            </aside>
          </div>
        );
      })()}
    </>
  );
}
