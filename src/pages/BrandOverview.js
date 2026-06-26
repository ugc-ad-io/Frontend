import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { Plus, Search, Briefcase, Users, Eye, CheckCircle, TrendingUp } from 'lucide-react';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import '../styles/creator-marketplace.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const inr = (n) => `Rs. ${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

const STATUS_TAG = {
  active: 'Live', in_progress: 'Live', work_submitted: 'In Review',
  pending_approval: 'Pending', completed: 'Completed', draft: 'Draft', rejected: 'Rejected',
};

// Lightweight sparkline from a fixed silhouette (purely decorative).
function Spark() {
  const pts = [6, 10, 8, 14, 11, 18, 15, 22, 19, 26, 24, 30];
  const w = 280, h = 60, max = Math.max(...pts);
  const path = pts.map((v, i) => `${(i / (pts.length - 1)) * w},${h - (v / max) * h}`).join(' ');
  return (
    <svg className="bo-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
      <polyline points={path} fill="none" stroke="#5b6bff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function BrandOverview() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [spend, setSpend] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await axios.get(`${API}/campaigns?t=${Date.now()}`);
        if (active) setCampaigns((res.data || []).filter((c) => String(c.business_id) === String(user?.id)));
      } catch { /* ignore */ }
      try {
        const w = await axios.get(`${API}/business/wallet`);
        if (active) setSpend(w.data?.total_spent ?? w.data?.spent ?? 0);
      } catch { /* ignore */ }
    })();
    return () => { active = false; };
  }, [user?.id]);

  const activeCount = campaigns.filter((c) => ['active', 'in_progress'].includes(c.status)).length;
  const bidsCount = campaigns.reduce((s, c) => s + ((c.bids || []).length), 0);
  const inReview = campaigns.filter((c) => c.status === 'work_submitted').length;
  const completed = campaigns.filter((c) => c.status === 'completed').length;

  const stats = [
    { ic: 'cmk-ic-indigo', Icon: Briefcase, val: activeCount, lbl: 'Active Campaigns' },
    { ic: 'cmk-ic-violet', Icon: Users, val: bidsCount, lbl: 'Creator Bids' },
    { ic: 'cmk-ic-orange', Icon: Eye, val: inReview, lbl: 'In Review' },
    { ic: 'cmk-ic-green', Icon: CheckCircle, val: completed, lbl: 'Completed' },
  ];

  const recent = [...campaigns]
    .sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0))
    .slice(0, 4);

  const brandName = user?.profile?.business_name || user?.nickname || 'there';

  return (
    <BrandTopNavLayout>
      <section className="bo-hero cmk-rise">
        <div>
          <span className="bo-hello">Welcome back, {brandName} 👋</span>
          <h1>Let’s create something <em>amazing</em> together.</h1>
          <p className="bo-sub">Launch campaigns, collaborate with creators, and grow your brand with authentic UGC content.</p>
          <div className="bo-hero-cta">
            <button type="button" className="cmk-btn cmk-btn-primary" onClick={() => navigate('/dashboard/business/post-brief')}>
              <Plus size={18} /> Post a Campaign
            </button>
            <button type="button" className="cmk-btn cmk-btn-ghost" onClick={() => navigate('/dashboard/business/browse-creator')}>
              <Search size={18} /> Browse Creators
            </button>
          </div>
        </div>
        <div className="bo-spend">
          <div className="bo-spend-top"><span>Total Spend</span><span className="bo-spend-pill">This month</span></div>
          <div className="bo-spend-val">{inr(spend)}</div>
          <div className="bo-spend-trend"><TrendingUp size={14} /> Tracking your campaign spend</div>
          <Spark />
        </div>
      </section>

      <div className="cmk-stats" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        {stats.map((s) => (
          <div key={s.lbl} className="cmk-stat cmk-rise">
            <div className={`cmk-ic ${s.ic}`}><s.Icon size={22} /></div>
            <div className="cmk-stat-val">{s.val}</div>
            <div className="cmk-stat-lbl">{s.lbl}</div>
          </div>
        ))}
      </div>

      <div className="bo-sec-head">
        <h2>Recent Campaigns</h2>
        <button type="button" onClick={() => navigate('/dashboard/business/all-campaigns')}>View all campaigns</button>
      </div>

      {recent.length === 0 ? (
        <div className="cmk-empty">No campaigns yet. Post your first campaign to get started.</div>
      ) : (
        <div className="bo-camp-grid">
          {recent.map((c) => (
            <article key={c.id || c._id} className="bo-camp-card cmk-rise" onClick={() => navigate(`/campaign/${c.id || c._id}`)}>
              <div className="bo-camp-img">
                {c.cover_image ? <img src={c.cover_image.startsWith('http') ? c.cover_image : `${BACKEND_URL}${c.cover_image}`} alt="" /> : (c.title || 'C').charAt(0).toUpperCase()}
                <span className="bo-camp-tag">{STATUS_TAG[c.status] || c.status}</span>
              </div>
              <div className="bo-camp-body">
                <strong>{c.title || 'Untitled campaign'}</strong>
                <small>{c.category || 'UGC'} · {inr(c.budget_max || c.budget_min)}</small>
              </div>
            </article>
          ))}
        </div>
      )}
    </BrandTopNavLayout>
  );
}
