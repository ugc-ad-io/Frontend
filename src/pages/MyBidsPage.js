import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import '../styles/creator-marketplace.css';
import EmptyState from '../components/EmptyState';
import { SkeletonTable } from '../components/Skeleton';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const getInitial = (name) => (name || 'B').trim().charAt(0).toUpperCase();
const formatMoney = (v) => `Rs. ${Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent');

const getBidStatus = (item) => (item?.bid_status || item?.my_bid?.status || item?.bid?.status || 'pending').toLowerCase();

// Render a brief string with distinct colors for the field labels vs. their values
const renderBrief = (text) => {
  const lines = String(text || '').split('\n');
  return lines.map((line, i) => {
    if (!line.trim()) return <span key={i} className="mb-brief-gap" />;
    const idx = line.indexOf(':');
    // Budget visibility is a brand-only setting — never surface it to creators.
    if (idx > 0 && /^budget visibility$/i.test(line.slice(0, idx).trim())) return null;
    if (idx === -1) return <span key={i} className="mb-brief-line"><span className="mb-brief-val">{line}</span></span>;
    return (
      <span key={i} className="mb-brief-line">
        <span className="mb-brief-label">{line.slice(0, idx + 1)}</span>
        <span className="mb-brief-val">{line.slice(idx + 1)}</span>
      </span>
    );
  });
};

// "Won" bids (brand picked this creator) — green pill + a Deal Room shortcut.
const WON_STATUSES = ['selected', 'accepted', 'approved'];
const STATUS_TONE = { shortlisted: 'info', accepted: 'ok', approved: 'ok', selected: 'ok', rejected: 'bad', pending: 'warn', submitted: 'warn', bid_submitted: 'warn' };
const STATUS_LABEL = { bid_submitted: 'Pending', submitted: 'Pending' };

const TABS = [
  { key: 'all', label: 'All', match: () => true },
  { key: 'shortlisted', label: 'Shortlisted', match: (s) => s === 'shortlisted' },
  { key: 'accepted', label: 'Accepted', match: (s) => WON_STATUSES.includes(s) },
  { key: 'rejected', label: 'Rejected', match: (s) => s === 'rejected' },
];

export default function MyBidsPage() {
  return (
    <CreatorTopNavLayout notifications={0}>
      <div className="cmk-page-head">
        <h1>My Bids</h1>
        <p>Track all your submitted proposals.</p>
      </div>
      <MyBidsContent />
    </CreatorTopNavLayout>
  );
}

// The tabs + table + detail drawer, without the page shell — so the "My Deals"
// hub can render it as its "My Bids" tab and the standalone /my-bids route can
// wrap it with the top-nav layout and its own heading.
export function MyBidsContent() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    if (user?.approval_status && user.approval_status !== 'approved') return undefined;
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/bids/my?t=${Date.now()}`);
      setBids(res.data || []);
    } catch {
      toast.error('Failed to load bids');
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
    return bids.filter((b) => t.match(getBidStatus(b)));
  }, [bids, tab]);

  return (
    <>
      <div className="cmk-tabs-row">
        <div className="cmk-tabs">
          {TABS.map((t) => (
            <button key={t.key} type="button" className={tab === t.key ? 'is-active' : ''} onClick={() => setTab(t.key)}>
              {t.label} <em>({counts[t.key] || 0})</em>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="cmk-table-card"><SkeletonTable rows={6} cols={6} /></div>
      ) : rows.length ? (
        <div className="cmk-table-card">
          <table className="cmk-table">
            <thead>
              <tr><th>Brief</th><th>Brand</th><th>Budget</th><th>Status</th><th>Submitted On</th><th aria-label="action" /></tr>
            </thead>
            <tbody>
              {rows.map((item) => {
                const c = item.campaign || {};
                const bid = item.my_bid || item.bid || {};
                const status = getBidStatus(item);
                const brand = String(c.brand_name || c.business_name || c.company_name || c.business_nickname || c.brand_handle || '').replace(/^@+/, '').trim() || 'Brand';
                return (
                  <tr key={bid.id || c.id} className="cmk-row-clickable" onClick={() => openView(item)} title="View bid details">
                    <td className="cmk-td-strong">{c.title || 'Campaign'}</td>
                    <td>
                      <span className="cmk-td-brand">
                        <span className="cmk-td-logo">
                          {c.brand_logo ? <img src={c.brand_logo.startsWith('http') ? c.brand_logo : `${BACKEND_URL}${c.brand_logo}`} alt="" /> : getInitial(brand)}
                        </span>
                        {brand}
                      </span>
                    </td>
                    <td>{formatMoney(bid.amount || c.budget_max || c.budget)}</td>
                    <td><span className={`cmk-pill ${STATUS_TONE[status] || 'warn'}`}>{STATUS_LABEL[status] || (status.charAt(0).toUpperCase() + status.slice(1))}</span></td>
                    <td className="cmk-td-muted">{fmtDate(item.submitted_at || bid.submitted_at)}</td>
                    <td className="cmk-td-right" style={WON_STATUSES.includes(status) ? undefined : { textAlign: 'center' }}>
                      {WON_STATUSES.includes(status) && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); navigate(`/my-deals?campaign=${c.id}`); }}
                          style={{ marginRight: 16, background: 'linear-gradient(100deg,#12124f,#07074e)', color: '#fff', border: 0, borderRadius: 10, padding: '8px 16px', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 12px 26px -12px rgba(7,7,78,.7)' }}
                        >
                          Deal Room →
                        </button>
                      )}
                      <button type="button" className="cmk-link-btn" onClick={(e) => { e.stopPropagation(); openView(item); }}>View</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title={`No bids in “${TABS.find((t) => t.key === tab).label}”`} message="Browse open campaigns and submit a proposal to start winning brand deals." action={{ label: 'Browse Campaigns', onClick: () => navigate('/browse-briefs') }} />
      )}

      {selected && (() => {
        const c = detail || selected.campaign || {};
        const bid = selected.my_bid || selected.bid || {};
        const status = getBidStatus(selected);
        const brand = String(c.brand_name || c.business_name || c.company_name || c.business_nickname || c.brand_handle || '').replace(/^@+/, '').trim() || 'Brand';
        const budget = (c.budget_min || c.budget_max)
          ? `${formatMoney(c.budget_min || c.budget_max)}${c.budget_max && c.budget_max !== c.budget_min ? ` – ${formatMoney(c.budget_max)}` : ''}`
          : formatMoney(bid.amount);
        return (
          <div className="mb-overlay" onClick={() => setSelected(null)}>
            <aside className="mb-drawer" onClick={(e) => e.stopPropagation()}>
              <div className="mb-drawer-head">
                <div className="mb-drawer-brand">
                  <span className="cmk-td-logo">{getInitial(brand)}</span>
                  <div>
                    <strong>{c.title || 'Campaign'}</strong>
                    <small>{brand}</small>
                  </div>
                </div>
                <button type="button" className="mb-close" aria-label="Close" onClick={() => setSelected(null)}>✕</button>
              </div>

              <div className="mb-drawer-body">
                <div className="mb-meta-row">
                  <span className={`cmk-pill ${STATUS_TONE[status] || 'warn'}`}>{STATUS_LABEL[status] || (status.charAt(0).toUpperCase() + status.slice(1))}</span>
                  {c.category && <span className="cmk-pill info">{c.category}</span>}
                </div>

                <div className="mb-grid">
                  <div className="mb-stat"><small>Brief Budget</small><strong>{budget}</strong></div>
                  <div className="mb-stat"><small>Your Bid</small><strong>{formatMoney(bid.amount)}</strong></div>
                  <div className="mb-stat"><small>Delivery</small><strong>{bid.estimated_delivery_days ? `${bid.estimated_delivery_days} days` : '—'}</strong></div>
                  <div className="mb-stat"><small>Submitted</small><strong>{fmtDate(selected.submitted_at || bid.submitted_at)}</strong></div>
                </div>

                <div className="mb-sec">
                  <h4>Brief</h4>
                  {detailLoading && !detail ? <p className="mb-muted">Loading brief…</p> : (
                    <div className="mb-text mb-brief">{(c.brief_text || c.deliverables) ? renderBrief(c.brief_text || c.deliverables) : 'No brief details provided.'}</div>
                  )}
                </div>

                {Array.isArray(c.objectives) && c.objectives.length > 0 && (
                  <div className="mb-sec">
                    <h4>Objectives</h4>
                    <div className="mb-chips">{c.objectives.map((o, i) => <span key={i}>{o}</span>)}</div>
                  </div>
                )}

                {bid.proposal && (
                  <div className="mb-sec">
                    <h4>Your Proposal</h4>
                    <p className="mb-text">{bid.proposal}</p>
                  </div>
                )}
              </div>

              <div className="mb-drawer-foot">
                <button type="button" className="cmk-btn-ghost-sm" onClick={() => setSelected(null)}>Close</button>
                <button type="button" className="cmk-btn-primary-sm" onClick={() => { const id = c.business_id || c.business?.id; if (id) navigate(`/messages?conv=${id}`); else navigate('/messages'); }}>Message Brand</button>
              </div>
            </aside>

            <style>{`
              .mb-overlay{position:fixed;inset:0;background:rgba(15,22,58,.45);backdrop-filter:blur(2px);z-index:1000;display:flex;justify-content:flex-end}
              .mb-drawer{width:min(460px,100%);height:100%;background:#fff;display:flex;flex-direction:column;box-shadow:-20px 0 50px rgba(15,22,58,.25);animation:mb-slide .28s cubic-bezier(.2,.7,.2,1)}
              @keyframes mb-slide{from{transform:translateX(40px);opacity:.6}to{transform:none;opacity:1}}
              .mb-drawer-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:20px 22px;border-bottom:1px solid #e9ebf4}
              .mb-drawer-brand{display:flex;align-items:center;gap:12px;min-width:0}
              .mb-drawer-brand strong{display:block;font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:16px;color:#15163a;line-height:1.25}
              .mb-drawer-brand small{color:#9296ba;font-size:13px}
              .mb-close{border:0;background:#f1f3fa;color:#15163a;width:34px;height:34px;border-radius:10px;cursor:pointer;font-size:14px;flex:none}
              .mb-drawer-body{flex:1;overflow-y:auto;overflow-x:hidden;padding:20px 22px;display:flex;flex-direction:column;gap:20px}
              .mb-meta-row{display:flex;gap:8px;flex-wrap:wrap}
              .mb-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
              .mb-stat{background:#f6f7fc;border:1px solid #e9ebf4;border-radius:12px;padding:12px 14px}
              .mb-stat small{color:#9296ba;font-size:12px;font-weight:600;display:block}
              .mb-stat strong{color:#15163a;font-size:15px;font-family:var(--font-head,'Plus Jakarta Sans',sans-serif)}
              .mb-sec h4{margin:0 0 8px;font-size:13px;font-weight:800;color:#5b6bff;text-transform:uppercase;letter-spacing:.4px}
              .mb-text{margin:0;color:#585c7e;font-size:14px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word}
              .mb-brief{display:flex;flex-direction:column;min-width:0}
              .mb-brief-line{display:block;line-height:1.55;overflow-wrap:anywhere;word-break:break-word}
              .mb-brief-gap{display:block;height:10px}
              .mb-brief-label{color:#15163a;font-weight:700;margin-right:4px}
              .mb-brief-val{color:#585c7e;overflow-wrap:anywhere;word-break:break-word}
              .mb-muted{margin:0;color:#9296ba;font-size:14px}
              .mb-chips{display:flex;flex-wrap:wrap;gap:7px}
              .mb-chips span{background:#eef0ff;color:#5b6bff;font-size:12px;font-weight:600;padding:4px 11px;border-radius:20px}
              .mb-drawer-foot{display:flex;gap:10px;padding:16px 22px;border-top:1px solid #e9ebf4}
              .mb-drawer-foot button{flex:1;justify-content:center}
            `}</style>
          </div>
        );
      })()}
    </>
  );
}
