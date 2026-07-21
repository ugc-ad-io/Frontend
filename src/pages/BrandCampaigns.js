import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { SlidersHorizontal, Megaphone, Plus, X, Trash2 } from 'lucide-react';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import PostABrief from './PostABrief';
import { Skeleton } from '../components/Skeleton';
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
  const [briefOpen, setBriefOpen] = useState(false);
  // Id of the draft being edited in the modal — null when writing a fresh brief.
  const [editingDraftId, setEditingDraftId] = useState(null);
  // Id of the draft currently being deleted, so its card can show a busy state
  // and ignore repeat clicks while the request is in flight.
  const [deletingId, setDeletingId] = useState(null);

  // A draft isn't a real campaign yet: the detail page renders it half-empty and
  // read-only. Reopen it in the wizard so it can actually be finished and edited.
  const openCampaign = (c) => {
    const cid = c.id || c._id;
    if (c.status === 'draft') {
      setEditingDraftId(cid);
      setBriefOpen(true);
      return;
    }
    navigate(`/dashboard/business/campaign/${cid}`);
  };

  // Delete a draft outright. Only offered on drafts/rejected briefs — nothing is
  // held in escrow and creators never saw them, so the backend allows a hard delete.
  const deleteDraft = async (e, c) => {
    e.stopPropagation(); // don't also open/edit the card
    const cid = c.id || c._id;
    if (deletingId) return;
    if (!window.confirm(`Delete draft “${c.title || 'Untitled campaign'}”? This can't be undone.`)) return;
    setDeletingId(cid);
    try {
      await axios.delete(`${API}/campaigns/${cid}`);
      // Drop it locally so the card disappears immediately, then resync.
      setCampaigns((prev) => prev.filter((x) => (x.id || x._id) !== cid));
      loadCampaigns();
    } catch {
      window.alert('Could not delete the draft. Please try again.');
    } finally {
      setDeletingId(null);
    }
  };

  const loadCampaigns = useCallback(async () => {
    try {
      // include_drafts: GET /campaigns hides drafts by default (status $ne 'draft').
      // Without it the "Drafts" tab filtered for status === 'draft' over a list that
      // could never contain one — so a saved draft was in the DB but nowhere on screen.
      const res = await axios.get(`${API}/campaigns?include_drafts=true&t=${Date.now()}`);
      const mine = (res.data || []).filter((c) => String(c.business_id) === String(user?.id));
      setCampaigns(mine);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [user?.id]);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  // Save whatever's been typed as a draft before the modal goes away, so an
  // accidental click outside doesn't throw the brief away.
  const briefRef = useRef(null);
  const closeBrief = async () => {
    await briefRef.current?.saveDraftNow();
    setBriefOpen(false);
    setEditingDraftId(null);
    loadCampaigns();
  };

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

      <div className="wr-tabs-row wr-tabs-row--select">
        <div className="wr-tabs">
          {TABS.map((t) => (
            <button key={t.key} type="button" className={tab === t.key ? 'is-active' : ''} onClick={() => setTab(t.key)}>
              {t.label} <em>({counts[t.key] || 0})</em>
            </button>
          ))}
        </div>
        {/* Mobile only: the tab strip is hidden and this right-aligned dropdown
            replaces it, so the same status filter is reachable in every tab. */}
        <select className="wr-tabs-select" value={tab} onChange={(e) => setTab(e.target.value)} aria-label="Filter campaigns">
          {TABS.map((t) => (
            <option key={t.key} value={t.key}>{t.label} ({counts[t.key] || 0})</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="bcam-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <article className="bcam-card" key={i} aria-hidden="true">
              {/* 150px cover — matches .bcam-img */}
              <Skeleton height={150} radius={0} style={{ display: 'block' }} />
              <div className="bcam-body">
                <Skeleton width="70%" height={16} />
                <Skeleton width="45%" height={12} style={{ marginTop: 10 }} />
                <Skeleton width={110} height={14} style={{ marginTop: 16 }} />
              </div>
            </article>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="bcam-empty">
          <span className="bcam-empty-ic"><Megaphone size={30} /></span>
          {tab === 'all' ? (
            <>
              <h3>No campaigns yet</h3>
              <p>Launch your first campaign to start collaborating with creators and getting authentic content.</p>
              <button type="button" className="bcam-empty-btn" onClick={() => { setEditingDraftId(null); setBriefOpen(true); }}>
                <Plus size={18} /> Post your first campaign
              </button>
            </>
          ) : (
            <>
              <h3>Nothing in “{TABS.find((t) => t.key === tab).label}”</h3>
              <p>Campaigns will appear here once they reach this stage.</p>
            </>
          )}
          <style>{`
            .bcam-empty{display:flex;flex-direction:column;align-items:center;text-align:center;padding:64px 20px 40px;max-width:440px;margin:0 auto}
            .bcam-empty-ic{width:72px;height:72px;border-radius:22px;display:grid;place-items:center;margin-bottom:20px;
              color:#5b6bff;background:linear-gradient(135deg,#eef0ff,#f4f0ff);border:1px solid #e6e9ff}
            .bcam-empty h3{margin:0;font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:22px;font-weight:800;color:#15163a}
            .bcam-empty p{margin:8px 0 0;color:#9296ba;font-size:14.5px;line-height:1.6}
            .bcam-empty-btn{margin-top:22px;display:inline-flex;align-items:center;gap:8px;border:none;cursor:pointer;font-family:inherit;
              font-weight:700;font-size:14.5px;color:#fff;padding:13px 24px;border-radius:14px;
              background:linear-gradient(100deg,#5b6bff,#4452f0);box-shadow:0 14px 30px -12px rgba(68,82,240,.7);transition:.18s}
            .bcam-empty-btn:hover{transform:translateY(-2px)}
          `}</style>
        </div>
      ) : (
        <div className="bcam-grid">
          {rows.map((c) => {
            const s = STATUS[c.status] || STATUS.active;
            // Campaign card shows the brand/campaign LOGO (image_url now holds the logo),
            // falling back to the brand's profile logo — no more banner cover.
            const coverRaw = c.image_url || c.brand_logo_url || c.logo || '';
            const cover = coverRaw ? (coverRaw.startsWith('http') ? coverRaw : `${BACKEND_URL}${coverRaw}`) : '';
            const spent = c.escrow_amount || c.budget_min || 0;
            const total = c.budget_max || c.budget_min || 0;
            return (
              <article key={c.id || c._id} className="bcam-card" onClick={() => openCampaign(c)}>
                <div className="bcam-img">
                  {cover ? <img src={cover} alt="" /> : (c.title || 'C').charAt(0).toUpperCase()}
                  <span className={`bcam-badge ${s.cls}`}>{s.badge}</span>
                  {['draft', 'rejected'].includes(c.status) && (
                    <button
                      type="button"
                      className="bcam-del"
                      aria-label="Delete draft"
                      title="Delete draft"
                      disabled={deletingId === (c.id || c._id)}
                      onClick={(e) => deleteDraft(e, c)}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
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

      {briefOpen && (
        // Clicking the backdrop (or the X) is the easiest way to lose a half-written
        // brief by accident, so save it as a draft on the way out rather than just
        // dropping the modal.
        <div className="cmk-brief-overlay" onClick={closeBrief}>
          <div className="cmk-brief-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="cmk-brief-close" aria-label="Close" onClick={closeBrief}>
              <X size={20} />
            </button>
            <PostABrief
              // Remount when switching between drafts / a fresh brief, so the
              // wizard reseeds its form instead of keeping the previous one.
              key={editingDraftId || 'new'}
              ref={briefRef}
              resumeDraftId={editingDraftId}
              onClose={closeBrief}
              onPublished={() => { setBriefOpen(false); setEditingDraftId(null); loadCampaigns(); }}
              // Refresh so a just-saved draft appears in the Drafts tab straight away,
              // rather than only after a remount.
              onDraftSaved={() => loadCampaigns()}
            />
          </div>
        </div>
      )}
    </BrandTopNavLayout>
  );
}
