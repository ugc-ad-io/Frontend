import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { SlidersHorizontal, Megaphone, Plus, X, Trash2, FileText } from 'lucide-react';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import PostABrief from './PostABrief';
import { Skeleton } from '../components/Skeleton';
import { summarizeDeliverables } from '../utils/normalizeBrief';
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
  { key: 'pending', label: 'Pending', match: (s) => s === 'pending_approval' },
  { key: 'live', label: 'Live', match: (s) => ['active', 'in_progress'].includes(s) },
  { key: 'review', label: 'In Review', match: (s) => s === 'work_submitted' },
  { key: 'completed', label: 'Completed', match: (s) => s === 'completed' },
  { key: 'rejected', label: 'Rejected', match: (s) => s === 'rejected' },
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
  const [filterOpen, setFilterOpen] = useState(false); // mobile status-filter menu
  const [filterExpanded, setFilterExpanded] = useState(false); // desktop: click PINS the options open
  const [filterHover, setFilterHover] = useState(false);       // desktop: hover opens transiently
  const filterRef = useRef(null);
  const cfRef = useRef(null);
  const [briefOpen, setBriefOpen] = useState(false);
  // Id of the draft being edited in the modal — null when writing a fresh brief.
  const [editingDraftId, setEditingDraftId] = useState(null);
  // Id of the draft currently being deleted, so its card can show a busy state
  // and ignore repeat clicks while the request is in flight.
  const [deletingId, setDeletingId] = useState(null);
  // The draft awaiting a delete confirmation — an in-app card instead of the
  // browser's native confirm(), to match the rest of the app's styling.
  const [confirmDelete, setConfirmDelete] = useState(null);

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
  // Asking is a separate step from doing: this just opens the confirm card.
  const askDeleteDraft = (e, c) => {
    e.stopPropagation(); // don't also open/edit the card
    if (deletingId) return;
    setConfirmDelete(c);
  };

  const confirmDeleteDraft = async () => {
    const c = confirmDelete;
    if (!c) return;
    const cid = c.id || c._id;
    setConfirmDelete(null);
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

  // Close the mobile filter menu on any outside click.
  useEffect(() => {
    if (!filterOpen) return undefined;
    const onDoc = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [filterOpen]);

  // Desktop: a click PINS the filter open — close it again on an outside click.
  useEffect(() => {
    if (!filterExpanded) return undefined;
    const onDoc = (e) => { if (cfRef.current && !cfRef.current.contains(e.target)) setFilterExpanded(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [filterExpanded]);

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
      <div className="cmk-page-head cmk-page-head--filter">
        <div>
          <h1>Campaigns</h1>
          <p>Manage all your campaigns in one place.</p>
        </div>
        {/* Mobile only: sits on the title row (right side) and replaces the tab
            strip, so the status filter is one tap in every tab. */}
        <div className="wr-filter-wrap" ref={filterRef}>
          <button type="button" className="wr-filter-btn" onClick={() => setFilterOpen((v) => !v)} aria-haspopup="menu" aria-expanded={filterOpen}>
            <SlidersHorizontal size={16} /> Filter
          </button>
          {filterOpen && (
            <div className="wr-filter-menu" role="menu">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={tab === t.key}
                  className={tab === t.key ? 'is-active' : ''}
                  onClick={() => { setTab(t.key); setFilterOpen(false); }}
                >
                  {t.label} <em>({counts[t.key] || 0})</em>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Desktop: a collapsed "Filter" that expands its status options left→right
          on hover or click. Hidden on mobile (the page-head Filter is used there). */}
      <div
        ref={cfRef}
        className={`cf-filter-row${(filterExpanded || filterHover) ? ' is-open' : ''}`}
        onMouseEnter={() => setFilterHover(true)}
        onMouseLeave={() => setFilterHover(false)}
      >
        <button type="button" className="cf-filter-btn" onClick={() => setFilterExpanded((v) => !v)} aria-expanded={filterExpanded || filterHover}>
          <SlidersHorizontal size={16} /> Filter
        </button>
        <div className="cf-options">
          <div className="cf-options-inner">
            {TABS.map((t) => (
              <button key={t.key} type="button" className={tab === t.key ? 'is-active' : ''} onClick={() => setTab(t.key)}>
                {t.label} <em>({counts[t.key] || 0})</em>
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bcam-grid">
          {Array.from({ length: 6 }).map((_, i) => (
            <article className="bcam-card" key={i} aria-hidden="true">
              <div className="bcam-top">
                <Skeleton width={46} height={46} radius={13} />
                <Skeleton width={60} height={22} radius={20} />
              </div>
              <div className="bcam-head-txt">
                <Skeleton width="75%" height={16} />
                <Skeleton width="45%" height={12} style={{ marginTop: 6 }} />
              </div>
              <div className="bcam-divider" />
              <div className="bcam-foot">
                <Skeleton width={90} height={20} />
                <Skeleton width={72} height={38} radius={11} />
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
            const deliv = summarizeDeliverables(c);
            return (
              <article key={c.id || c._id} className="bcam-card" onClick={() => openCampaign(c)}>
                <div className="bcam-top">
                  {/* Campaign/brand logo (from image_url, falling back to the brand profile logo) */}
                  <span className="bcam-logo">
                    {cover ? <img src={cover} alt="" /> : (c.title || 'C').charAt(0).toUpperCase()}
                  </span>
                  <div className="bcam-top-actions">
                    <span className={`bcam-badge ${s.cls}`}>{s.badge}</span>
                    {['draft', 'rejected'].includes(c.status) && (
                      <button
                        type="button"
                        className="bcam-del"
                        aria-label="Delete draft"
                        title="Delete draft"
                        disabled={deletingId === (c.id || c._id)}
                        onClick={(e) => askDeleteDraft(e, c)}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="bcam-head-txt">
                  <h3 className="bcam-title">{c.title || 'Untitled campaign'}</h3>
                  <div className="bcam-meta">{subLine(c)}</div>
                </div>
                {deliv && (
                  <div className="bcam-deliv"><FileText size={13} /> <span>{deliv}</span></div>
                )}
                <div className="bcam-divider" />
                <div className="bcam-foot">
                  <span className="bcam-budget">{inr(spent)} <small>/ {inr(total)}</small></span>
                  <button type="button" className="bcam-view" onClick={(e) => { e.stopPropagation(); openCampaign(c); }}>
                    {c.status === 'draft' ? 'Edit' : 'View'}
                  </button>
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

      {confirmDelete && (
        <div className="bcam-confirm-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="bcam-confirm-card" onClick={(e) => e.stopPropagation()}>
            <div className="bcam-confirm-icon"><Trash2 size={20} /></div>
            <h3 className="bcam-confirm-title">Delete this draft?</h3>
            <p className="bcam-confirm-body">
              “{confirmDelete.title || 'Untitled campaign'}” will be deleted permanently. This can't be undone.
            </p>
            <div className="bcam-confirm-actions">
              <button type="button" className="bcam-confirm-cancel" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button type="button" className="bcam-confirm-ok" onClick={confirmDeleteDraft}>Delete draft</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .bcam-confirm-overlay{position:fixed;inset:0;background:rgba(11,12,32,.5);backdrop-filter:blur(2px);
          display:flex;align-items:center;justify-content:center;z-index:2000;padding:20px}
        .bcam-confirm-card{width:100%;max-width:400px;background:#fff;border-radius:16px;padding:24px;
          box-shadow:0 24px 60px rgba(11,12,32,.28);text-align:left}
        .bcam-confirm-icon{width:40px;height:40px;border-radius:10px;background:#fef2f2;color:#dc2626;
          display:flex;align-items:center;justify-content:center;margin-bottom:14px}
        .bcam-confirm-title{margin:0 0 8px;font-size:17px;font-weight:700;color:#15163a}
        .bcam-confirm-body{margin:0 0 20px;font-size:13.5px;line-height:1.55;color:#5c608a;word-break:break-word}
        .bcam-confirm-actions{display:flex;gap:10px;justify-content:flex-end}
        .bcam-confirm-cancel{padding:9px 16px;border:1px solid #e8ecff;background:#fff;color:#5c608a;
          font-size:13px;font-weight:600;border-radius:10px;cursor:pointer;font-family:inherit}
        .bcam-confirm-cancel:hover{background:#f7f8ff}
        .bcam-confirm-ok{padding:9px 16px;border:1px solid #dc2626;background:#dc2626;color:#fff;
          font-size:13px;font-weight:700;border-radius:10px;cursor:pointer;font-family:inherit}
        .bcam-confirm-ok:hover{background:#c11f1f}
      `}</style>
    </BrandTopNavLayout>
  );
}
