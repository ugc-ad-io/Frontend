import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { Zap, AlertTriangle, Hourglass, CheckCircle2, XCircle, ArrowRight, RefreshCw } from 'lucide-react';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import '../styles/creator-marketplace.css';
import EmptyState from '../components/EmptyState';
import { isSelectedCreator } from '../utils/campaignCreators';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const getInitial = (name) => (name || 'B').trim().charAt(0).toUpperCase();

// Deal lifecycle stages, rendered as a segmented progress bar on each row.
const STAGES = ['Accepted', 'Shipment', 'Video Submission', 'Review', 'Payout'];
// A distinct colour per stage; the final stage (Payout) is green.
const STAGE_COLORS = ['#3b82f6', '#6366f1', '#6d7bff', '#f59e0b', '#22c55e'];
function stageIndex(c) {
  const s = c.status;
  if (s === 'completed') return 4;          // Payout
  if (s === 'under_review') return 3;        // Review
  if (s === 'work_submitted') return 2;      // Video Submission
  if (s === 'cancelled') return 0;
  return 1; // accepted / active / in_progress → Shipment stage
}

// Has the brand sent this piece of work back for changes?
const needsRevision = (c) => (c.work_submission || {}).status === 'revision_requested';

// Reference-style status badge: label + accent colour + icon.
function statusMeta(c) {
  const s = c.status;
  const due = c.due_date ? Math.ceil((new Date(c.due_date) - Date.now()) / 86400000) : null;
  const startFuture = (c.start_date || c.scheduled_at) && new Date(c.start_date || c.scheduled_at) > Date.now();
  // A revision request drops the campaign back to in_progress, which used to read
  // as a plain "Active" — the creator had no signal the brand wanted changes.
  if (needsRevision(c)) return { label: 'Revision Requested', color: '#f97316', Icon: RefreshCw };
  if (s === 'completed') return { label: 'Completed', color: '#22c55e', Icon: CheckCircle2 };
  if (s === 'cancelled') return { label: 'Cancelled', color: '#ef4444', Icon: XCircle };
  if (s === 'work_submitted' || s === 'under_review') return { label: 'In Review', color: '#f59e0b', Icon: Hourglass };
  if (due !== null && due < 0) return { label: 'Over Time', color: '#ef4444', Icon: AlertTriangle };
  if (startFuture) return { label: 'Upcoming', color: '#f97316', Icon: Hourglass };
  return { label: 'Active', color: '#16a34a', Icon: Zap };
}

const TABS = [
  // Pending-review deals (work_submitted / under_review) live under Active now.
  { key: 'active', label: 'Active', match: (c) => ['in_progress', 'active', 'work_submitted', 'under_review'].includes(c.status) },
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
      setCampaigns(res.data.filter((c) => isSelectedCreator(c, user.id)));
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
            const brand = String(c.brand_name || c.business_name || c.company_name || c.business_nickname || c.brand_handle || '').replace(/^@+/, '').trim() || 'Brand';
            const channel = (Array.isArray(c.objectives) && c.objectives[0]) || c.industry_type || 'UGC Video';
            const shortId = `#${String(c.id).slice(-4).toUpperCase()}`;
            const cur = stageIndex(c);
            return (
              <article
                key={c.id}
                className="cmk-awc cmk-rise"
                style={{ '--awc': meta.color }}
                onClick={() => navigate(`/my-deals?campaign=${c.id}`)}
                role="button"
                tabIndex={0}
              >
                <span className="cmk-awc-ava">
                  {c.brand_logo ? <img src={c.brand_logo.startsWith('http') ? c.brand_logo : `${BACKEND_URL}${c.brand_logo}`} alt="" /> : getInitial(brand)}
                </span>

                <div className="cmk-awc-lead">
                  <div className="cmk-awc-top">
                    <span className="cmk-awc-id">{shortId}</span>
                    <span className="cmk-awc-div" />
                    <span className="cmk-awc-badge"><meta.Icon size={14} /> {meta.label}</span>
                  </div>
                  <h3 className="cmk-awc-title">{c.title || 'Campaign'}</h3>
                  <small className="cmk-awc-sub">{brand} · Via {channel}</small>

                  {/* The one place the creator can actually read the brand's notes
                      and re-upload. Without it, "Revision Requested" is a dead end. */}
                  {needsRevision(c) && (
                    <button
                      type="button"
                      className="cmk-awc-revision"
                      onClick={(e) => { e.stopPropagation(); navigate(`/work/submit?campaign=${c.id}`); }}
                      data-testid={`see-revision-${c.id}`}
                    >
                      <RefreshCw size={13} /> See what they asked for
                    </button>
                  )}
                </div>

                <div className="cmk-awc-steps">
                  {STAGES.map((label, i) => (
                    <div
                      key={label}
                      className={`awc-step ${i < cur ? 'done' : ''} ${i === cur ? 'current' : ''}`}
                      style={{ '--s': STAGE_COLORS[i] }}
                    >
                      <span className="awc-step-lbl">{label}</span>
                      <i className="awc-step-bar" />
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="cmk-awc-go"
                  aria-label="Open campaign"
                  onClick={(e) => { e.stopPropagation(); navigate(`/my-deals?campaign=${c.id}`); }}
                >
                  <ArrowRight size={18} />
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState title={`No work in “${TABS.find((t) => t.key === tab).label}”`} message="Once a brand selects your bid, your active deals will appear here to manage." action={{ label: 'Browse Campaigns', onClick: () => navigate('/browse-briefs') }} />
      )}
    </CreatorTopNavLayout>
  );
}
