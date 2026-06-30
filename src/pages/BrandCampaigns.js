import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { SlidersHorizontal } from 'lucide-react';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import '../styles/creator-marketplace.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const inr = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

const STATUS = {
  active: { badge: 'Live', cls: 'live', pct: 40 },
  in_progress: { badge: 'Live', cls: 'live', pct: 60 },
  work_submitted: { badge: 'In Review', cls: 'review', pct: 78 },
  completed: { badge: 'Completed', cls: 'done', pct: 100 },
  draft: { badge: 'Draft', cls: 'draft', pct: 0 },
  pending_approval: { badge: 'Pending', cls: 'pending', pct: 15 },
  rejected: { badge: 'Rejected', cls: 'draft', pct: 0 },
};

const TABS = [
  { key: 'all', label: 'All Campaigns', match: () => true },
  { key: 'live', label: 'Live', match: (s) => ['active', 'in_progress'].includes(s) },
  { key: 'review', label: 'In Review', match: (s) => s === 'work_submitted' },
  { key: 'completed', label: 'Completed', match: (s) => s === 'completed' },
  { key: 'drafts', label: 'Drafts', match: (s) => s === 'draft' },
];

function subLine(c) {
  const creators = (c.bids || []).length || (c.selected_creator ? 1 : 0);
  if (c.status === 'draft') return `Draft · Created ${fmtDate(c.createdAt || c.created_at)}`;
  if (c.status === 'completed') return `${creators} creators · Completed`;
  if (c.status === 'work_submitted') return `${creators} creators · Submitted`;
  if (c.status === 'pending_approval') return 'Awaiting approval';
  return `${creators} ${creators === 1 ? 'creator' : 'creators'} · ${creators ? `${creators} bids` : 'No bids yet'}`;
}

export default function BrandCampaigns() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await axios.get(`${API}/campaigns?t=${Date.now()}`);
        const mine = (res.data || []).filter((c) => String(c.business_id) === String(user?.id));
        if (active) setCampaigns(mine);
      } catch { /* ignore */ }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [user?.id]);

  const counts = useMemo(() => {
    const o = {};
    TABS.forEach((t) => { o[t.key] = campaigns.filter((c) => t.match(c.status)).length; });
    return o;
  }, [campaigns]);

  const rows = useMemo(() => {
    const t = TABS.find((x) => x.key === tab);
    return campaigns.filter((c) => t.match(c.status))
      .sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));
  }, [campaigns, tab]);

  return (
    <BrandTopNavLayout>
      <div className="cmk-page-head">
        <h1>Campaigns</h1>
        <p>Manage all your campaigns in one place.</p>
      </div>

      <div className="wr-tabs-row">
        <div className="wr-tabs">
          {TABS.map((t) => (
            <button key={t.key} type="button" className={tab === t.key ? 'is-active' : ''} onClick={() => setTab(t.key)}>
              {t.label} <em>({counts[t.key] || 0})</em>
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="cmk-empty">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="cmk-empty">No campaigns in “{TABS.find((t) => t.key === tab).label}”.</div>
      ) : (
        <div className="bcam-grid">
          {rows.map((c) => {
            const s = STATUS[c.status] || STATUS.active;
            const cover = c.cover_image ? (c.cover_image.startsWith('http') ? c.cover_image : `${BACKEND_URL}${c.cover_image}`) : '';
            const spent = c.escrow_amount || c.budget_min || 0;
            const total = c.budget_max || c.budget_min || 0;
            return (
              <article key={c.id || c._id} className="bcam-card" onClick={() => navigate(`/dashboard/business/campaign/${c.id || c._id}`)}>
                <div className="bcam-img">
                  {cover ? <img src={cover} alt="" /> : (c.title || 'C').charAt(0).toUpperCase()}
                  <span className={`bcam-badge ${s.cls}`}>{s.badge}</span>
                </div>
                <div className="bcam-body">
                  <h3>{c.title || 'Untitled campaign'}</h3>
                  <div className="bcam-meta">{subLine(c)}</div>
                  <div className="bcam-foot">
                    <span className="bcam-budget">{inr(spent)} <small>/ {inr(total)}</small></span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </BrandTopNavLayout>
  );
}
