import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { Check, SlidersHorizontal, ChevronDown } from 'lucide-react';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import '../styles/creator-marketplace.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const getInitial = (name) => (name || 'B').trim().charAt(0).toUpperCase();
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—');

const STAGES = ['Brief Received', 'Content Submitted', 'Under Review', 'Payment'];

// Map a campaign status to step progress + status chip + CTA.
function stageInfo(c) {
  const s = c.status;
  if (s === 'completed') return { done: 4, label: 'Completed', tone: 'ok', progress: 100, cta: 'View' };
  if (s === 'cancelled') return { done: 0, label: 'Cancelled', tone: 'bad', progress: 0, cta: 'View' };
  if (s === 'work_submitted' || s === 'under_review') return { done: 2, label: 'In Review', tone: 'warn', progress: 100, cta: 'View' };
  return { done: 1, label: 'In Progress', tone: 'warn', progress: 65, cta: 'Continue' }; // in_progress / active
}

function dueLabel(c) {
  if (!c.due_date) return null;
  const diff = Math.ceil((new Date(c.due_date) - Date.now()) / 86400000);
  if (diff < 0) return { text: 'Overdue', tone: 'bad' };
  return { text: `Due in ${diff} ${diff === 1 ? 'day' : 'days'}`, tone: 'warn' };
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
        <div className="cmk-aw-list">
          {rows.map((c) => {
            const st = stageInfo(c);
            const due = dueLabel(c);
            const brand = c.business_nickname || c.brand_handle || 'Brand';
            const tags = (Array.isArray(c.objectives) && c.objectives.length ? c.objectives.slice(0, 1) : [c.industry_type || 'Lifestyle']).concat('UGC Video');
            const stepDates = [c.created_at, c.work_submitted_at || c.submitted_at, c.reviewed_at, c.paid_at];
            return (
              <article key={c.id} className="cmk-aw-row cmk-rise cmk-aw-clickable" onClick={() => navigate(`/my-deals?campaign=${c.id}`)} role="button" tabIndex={0}>
                <div className="cmk-aw-brand">
                  <span className="cmk-aw-logo">
                    {c.brand_logo ? <img src={c.brand_logo.startsWith('http') ? c.brand_logo : `${BACKEND_URL}${c.brand_logo}`} alt="" /> : getInitial(brand)}
                  </span>
                  <div>
                    <strong>{c.title || 'Campaign'}</strong>
                    <div className="cmk-aw-tags">{tags.map((t, i) => <span key={i}>{t}</span>)}</div>
                  </div>
                </div>

                <div className="cmk-aw-steps">
                  {STAGES.map((label, i) => {
                    const state = i < st.done ? 'done' : i === st.done ? 'active' : 'todo';
                    return (
                      <div key={label} className={`cmk-step ${state}`}>
                        <span className="cmk-step-dot">{state === 'done' ? <Check size={12} /> : i + 1}</span>
                        <span className="cmk-step-label">{label}</span>
                        <span className="cmk-step-date">{i < st.done ? fmtDate(stepDates[i]) : '—'}</span>
                        {i < STAGES.length - 1 && <i className={`cmk-step-line ${i < st.done ? 'on' : ''}`} />}
                      </div>
                    );
                  })}
                </div>

                <div className="cmk-aw-right">
                  {due && st.tone !== 'ok' ? <span className={`cmk-aw-status ${due.tone}`}>{due.text}</span>
                    : <span className={`cmk-aw-status ${st.tone}`}>{st.label}</span>}
                  <div className="cmk-aw-prog"><span>Progress</span><b>{st.progress}%</b></div>
                  <div className="cmk-aw-bar"><i style={{ width: `${st.progress}%` }} /></div>
                  <button type="button" className={st.cta === 'Continue' ? 'cmk-btn-sm-primary' : 'cmk-btn-sm-ghost'} onClick={(e) => { e.stopPropagation(); navigate(`/my-deals?campaign=${c.id}`); }}>
                    {st.cta}
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
