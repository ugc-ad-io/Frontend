import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { Zap, AlertTriangle, Hourglass, CheckCircle2, XCircle, ArrowRight } from 'lucide-react';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import '../styles/creator-marketplace.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const getInitial = (name) => (name || 'B').trim().charAt(0).toUpperCase();

// "3 Nov, 2:00pm" — date + short time (time omitted if the source has none meaningful).
const fmtDT = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  const day = dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const time = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(/\s/g, '');
  return `${day}, ${time}`;
};

// Fallback % when a status has no time window; used by the timeline bar.
function baseProgress(c) {
  const s = c.status;
  if (s === 'completed') return 100;
  if (s === 'cancelled') return 0;
  if (s === 'work_submitted' || s === 'under_review') return 100;
  return 65;
}

// Elapsed fraction of the start→due window, else the status fallback.
function timeProgress(c) {
  const start = c.start_date || c.created_at;
  const end = c.due_date || c.end_date;
  if (start && end) {
    const s = new Date(start).getTime(), e = new Date(end).getTime(), n = Date.now();
    if (e > s) return Math.min(100, Math.max(0, Math.round(((n - s) / (e - s)) * 100)));
  }
  return baseProgress(c);
}

// Reference-style status badge: label + accent colour + icon.
function statusMeta(c) {
  const s = c.status;
  const due = c.due_date ? Math.ceil((new Date(c.due_date) - Date.now()) / 86400000) : null;
  const startFuture = (c.start_date || c.scheduled_at) && new Date(c.start_date || c.scheduled_at) > Date.now();
  if (s === 'completed') return { label: 'Completed', color: '#22c55e', Icon: CheckCircle2 };
  if (s === 'cancelled') return { label: 'Cancelled', color: '#ef4444', Icon: XCircle };
  if (s === 'work_submitted' || s === 'under_review') return { label: 'In Review', color: '#f59e0b', Icon: Hourglass };
  if (due !== null && due < 0) return { label: 'Over Time', color: '#ef4444', Icon: AlertTriangle };
  if (startFuture) return { label: 'Upcoming', color: '#f97316', Icon: Hourglass };
  return { label: 'Active', color: '#3b82f6', Icon: Zap };
}

const TABS = [
  { key: 'active', label: 'Active', match: (c) => ['in_progress', 'active'].includes(c.status) },
  { key: 'review', label: 'Pending Review', match: (c) => ['work_submitted', 'under_review'].includes(c.status) },
  { key: 'completed', label: 'Completed', match: (c) => c.status === 'completed' },
  { key: 'cancelled', label: 'Cancelled', match: (c) => c.status === 'cancelled' },
];

export default function MyActiveWorkPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('active');

  useEffect(() => {
    if (user?.approval_status && user.approval_status !== 'approved') return undefined;
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API}/campaigns?t=${Date.now()}`);
      setCampaigns(res.data.filter((c) => c.selected_creator === user.id));
    } catch {
      toast.error('Failed to load active work');
    } finally {
      setLoading(false);
    }
  };

  const counts = useMemo(() => {
    const o = {};
    TABS.forEach((t) => { o[t.key] = campaigns.filter(t.match).length; });
    return o;
  }, [campaigns]);

  const rows = useMemo(() => {
    const t = TABS.find((x) => x.key === tab);
    return campaigns.filter(t.match);
  }, [campaigns, tab]);

  return (
    <CreatorTopNavLayout notifications={0}>
      <div className="cmk-page-head">
        <h1>My Active Work</h1>
        <p>Manage and track all your ongoing campaigns.</p>
      </div>

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
        <div className="cmk-empty">Loading…</div>
      ) : rows.length ? (
        <div className="cmk-awc-grid">
          {rows.map((c) => {
            const meta = statusMeta(c);
            const pct = timeProgress(c);
            const brand = c.business_nickname || c.brand_handle || 'Brand';
            const channel = (Array.isArray(c.objectives) && c.objectives[0]) || c.industry_type || 'UGC Video';
            const shortId = `#${String(c.id).slice(-4).toUpperCase()}`;
            const start = c.start_date || c.created_at;
            const end = c.due_date || c.end_date;
            return (
              <article
                key={c.id}
                className="cmk-awc cmk-rise"
                style={{ '--awc': meta.color }}
                onClick={() => navigate(`/my-deals?campaign=${c.id}`)}
                role="button"
                tabIndex={0}
              >
                <div className="cmk-awc-top">
                  <span className="cmk-awc-id">{shortId}</span>
                  <span className="cmk-awc-div" />
                  <span className="cmk-awc-badge"><meta.Icon size={14} /> {meta.label}</span>
                </div>

                <h3 className="cmk-awc-title">{c.title || 'Campaign'}</h3>

                <div className="cmk-awc-dates">
                  <span>{fmtDT(start)}</span>
                  <span>{fmtDT(end)}</span>
                </div>
                <div className="cmk-awc-track">
                  <i className="cmk-awc-fill" style={{ width: `${pct}%` }} />
                  <span className="cmk-awc-dot start" />
                  <span className="cmk-awc-dot end" />
                </div>

                <div className="cmk-awc-foot">
                  <span className="cmk-awc-ava">
                    {c.brand_logo ? <img src={c.brand_logo.startsWith('http') ? c.brand_logo : `${BACKEND_URL}${c.brand_logo}`} alt="" /> : getInitial(brand)}
                  </span>
                  <div className="cmk-awc-who">
                    <strong>{brand}</strong>
                    <small>Via {channel}</small>
                  </div>
                  <button
                    type="button"
                    className="cmk-awc-go"
                    aria-label="Open campaign"
                    onClick={(e) => { e.stopPropagation(); navigate(`/my-deals?campaign=${c.id}`); }}
                  >
                    <ArrowRight size={18} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="cmk-empty">No campaigns in “{TABS.find((t) => t.key === tab).label}”.</div>
      )}
    </CreatorTopNavLayout>
  );
}
