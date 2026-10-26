import { useLiveEffect } from '../lib/liveUpdates';
import { useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { Search, X, Trash2 } from 'lucide-react';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import BrandPageHead from '../components/BrandPageHead';
import BriefOverlay from '../components/BriefOverlay';
import PostABrief from './PostABrief';
import { Skeleton } from '../components/Skeleton';
import { ownsCampaign } from '../utils/brandWorkspace';
import { selectedCreators } from '../utils/campaignCreators';
import { apiErrorMessage } from '../utils/apiError';
import { campaignStage, campaignPill, campaignCta, budgetText } from '../utils/campaignStage';
import '../styles/creator-marketplace.css';
import '../styles/brand-mobile.css';
import '../styles/brand-ui.css';
import '../styles/brand-ui-pages.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const assetUrl = (u) => (!u ? '' : (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}${u.startsWith('/') ? '' : '/'}${u}`));
const fmtDay = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '');

// Status tabs. The first six are the design's; the rest only appear when something sits in them.
const TABS = [
  { key: 'all', label: 'All', match: () => true, always: true },
  { key: 'choosing', label: 'Choosing creator', match: (c) => c.status === 'active' && !selectedCreators(c).length, always: true },
  { key: 'progress', label: 'In progress', match: (c) => ['in_progress', 'awaiting_brand_confirmation'].includes(c.status) || (c.status === 'active' && selectedCreators(c).length > 0), always: true },
  { key: 'delivered', label: 'Delivered', match: (c) => c.status === 'work_submitted', always: true },
  { key: 'completed', label: 'Completed', match: (c) => c.status === 'completed', always: true },
  { key: 'drafts', label: 'Drafts', match: (c) => c.status === 'draft', always: true },
  { key: 'pending', label: 'Pending approval', match: (c) => c.status === 'pending_approval' },
  { key: 'hold', label: 'On hold', match: (c) => c.status === 'paused' },
  { key: 'rejected', label: 'Rejected', match: (c) => c.status === 'rejected' },
];

// The hired creator's name/photo ride on their bid.
function hiredCreator(c) {
  const ids = selectedCreators(c).map(String);
  if (!ids.length) return null;
  const bid = (c.bids || []).find((b) => ids.includes(String(b.creator_id))) || {};
  const first = String(bid.creator_nickname || bid.creator_name || 'Creator').replace(/^@+/, '');
  return { name: ids.length > 1 ? `${first} +${ids.length - 1}` : first, photo: bid.creator_photo || bid.profile_photo || bid.creator_profile_photo || '' };
}

function dueText(c) {
  if (c.status === 'completed') return `Completed ${fmtDay(c.completed_at || c.updated_at)}`;
  if (c.status === 'work_submitted') return `Delivered ${fmtDay(c.submitted_at || c.updated_at)}`;
  if (c.status === 'draft') return 'Not published';
  if (c.status === 'pending_approval') return 'Awaiting approval';
  const d = c.due_date || c.deadline || c.delivery_date;
  if (c.status === 'active' && !selectedCreators(c).length) return d ? `Pick by ${fmtDay(d)}` : 'Open for bids';
  return d ? fmtDay(d) : '—';
}

export default function BrandCampaigns() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  // Non-empty when the last load FAILED, so a broken request can say so instead of
  // masquerading as an empty account.
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [briefOpen, setBriefOpen] = useState(false);
  // Id of the draft being edited in the modal, null when writing a fresh brief.
  const [editingDraftId, setEditingDraftId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  // The draft awaiting a delete confirmation.
  const [confirmDelete, setConfirmDelete] = useState(null);

  // A draft isn't a real campaign yet: reopen it in the wizard so it can be finished.
  const openCampaign = (c) => {
    const cid = c.id || c._id;
    if (c.status === 'draft') {
      setEditingDraftId(cid);
      setBriefOpen(true);
      return;
    }
    navigate(`/dashboard/business/campaign/${cid}`);
  };

  const askDeleteDraft = (e, c) => {
    e.stopPropagation();
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
      setCampaigns((prev) => prev.filter((x) => (x.id || x._id) !== cid));
      loadCampaigns();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not delete the draft. Please try again.'));
    } finally {
      setDeletingId(null);
    }
  };

  const loadCampaigns = useCallback(async () => {
    try {
      // include_drafts: GET /campaigns hides drafts by default.
      const res = await axios.get(`${API}/campaigns?include_drafts=true&t=${Date.now()}`);
      // Match the brand WORKSPACE, not user.id: a team member's campaigns carry the owner's id.
      const mine = (res.data || []).filter((c) => ownsCampaign(user, c));
      setCampaigns(mine);
      setLoadError('');
    } catch (err) {
      // Never swallow this: a failed request must not look like an empty account.
      setLoadError(apiErrorMessage(err, 'Could not load your campaigns.'));
    } finally { setLoading(false); }
  }, [user?.id, user?.team_of]);

  useLiveEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  // Save whatever's been typed as a draft before the modal goes away.
  const briefRef = useRef(null);
  const closeBrief = async () => {
    await briefRef.current?.saveDraftNow();
    setBriefOpen(false);
    setEditingDraftId(null);
    loadCampaigns();
  };

  const counts = useMemo(() => {
    const o = {};
    TABS.forEach((t) => { o[t.key] = campaigns.filter(t.match).length; });
    return o;
  }, [campaigns]);
  const visibleTabs = TABS.filter((t) => t.always || counts[t.key] > 0);

  const rows = useMemo(() => {
    const t = TABS.find((x) => x.key === tab) || TABS[0];
    const q = query.trim().toLowerCase();
    return campaigns
      .filter(t.match)
      .filter((c) => !q || String(c.title || c.product_name || '').toLowerCase().includes(q))
      .sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));
  }, [campaigns, tab, query]);

  return (
    <BrandTopNavLayout>
      <div className="bui-main bui-main--tight">
        <BrandPageHead title="Manage campaigns" subtitle="Every brief, its creator, and what you need to do next." hideSearch>
          <label className="bui-searchbox">
            <Search size={16} />
            <input type="search" placeholder="Search campaigns" aria-label="Search campaigns" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
        </BrandPageHead>

        <div className="bui-tabs" role="tablist" aria-label="Campaign status">
          {visibleTabs.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`bui-tab${tab === t.key ? ' is-on' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}
              <span>{counts[t.key] || 0}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bui-card bui-tablewrap">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ padding: '18px 20px', borderTop: i ? '1px solid var(--bui-line-soft)' : 0 }}><Skeleton width="100%" height={56} /></div>
            ))}
          </div>
        ) : loadError ? (
          <div className="bui-empty">
            <h3>{"Couldn't load your campaigns"}</h3>
            <p>{loadError}</p>
            <button type="button" className="bui-btn" onClick={() => { setLoading(true); loadCampaigns(); }}>Try again</button>
          </div>
        ) : rows.length === 0 ? (
          <div className="bui-empty">
            {tab === 'all' && !query ? (
              <>
                <h3>No campaigns yet</h3>
                <p>Launch your first campaign to start collaborating with creators and getting authentic content.</p>
                <button type="button" className="bui-btn" onClick={() => { setEditingDraftId(null); setBriefOpen(true); }}>Post your first campaign</button>
              </>
            ) : (
              <>
                <h3>Nothing here</h3>
                <p>{query ? 'No campaign matches your search.' : 'Campaigns will appear here once they reach this stage.'}</p>
              </>
            )}
          </div>
        ) : (
          <div className="bui-card bui-tablewrap">
            <table className="bui-table bui-table--camp">
              <thead>
                <tr>
                  <th scope="col">Campaign</th>
                  <th scope="col">Creator</th>
                  <th scope="col">Due</th>
                  <th scope="col">Total</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="bui-sr">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const cid = c.id || c._id;
                  const hired = hiredCreator(c);
                  const bids = (c.bids || []).length;
                  const st = campaignStage(c);
                  const pill = campaignPill(c);
                  const cta = c.status === 'draft' ? { label: 'Edit' } : campaignCta(c);
                  const thumb = c.image_url || c.product_image || (c.product_images || [])[0] || c.cover_image || c.brand_logo_url || c.logo;
                  const title = c.title || c.product_name || 'Untitled campaign';
                  const meta = [c.product_category, c.video_format].filter(Boolean).join(' · ');
                  const ghost = c.status === 'completed' || c.status === 'draft';
                  return [
                    <tr key={cid} className="bui-tr">
                      <td>
                        <div className="bui-cell">
                          <span className="bui-thumb bui-thumb--sm">{thumb ? <img src={assetUrl(thumb)} alt="" /> : <b>{title.charAt(0).toUpperCase()}</b>}</span>
                          <div>
                            <div className="bui-cell-t">{title}</div>
                            <div className="bui-cell-s">{meta || ' '}</div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Creator">
                        <div className="bui-cell bui-cell--sm">
                          {hired ? (
                            <>
                              <span className="bui-ava30">{hired.photo ? <img src={assetUrl(hired.photo)} alt="" /> : hired.name.charAt(0)}</span>
                              <b>{hired.name}</b>
                            </>
                          ) : (
                            <b className="bui-accent">{bids ? `${bids} bid${bids === 1 ? '' : 's'} waiting` : 'No bids yet'}</b>
                          )}
                        </div>
                      </td>
                      <td className="bui-nowrap" data-label="Due">{dueText(c)}</td>
                      <td className="bui-nowrap bui-strong" data-label="Total">{budgetText(c) || '—'}</td>
                      <td data-label="Status"><span className={`bui-status bui-status--${pill.tone}`}>{pill.text}</span></td>
                      <td className="bui-right">
                        {['draft', 'rejected'].includes(c.status) && (
                          <button type="button" className="bui-iconghost" aria-label="Delete draft" title="Delete draft" disabled={deletingId === cid} onClick={(e) => askDeleteDraft(e, c)}>
                            <Trash2 size={15} />
                          </button>
                        )}
                        <button type="button" className={`bui-cta${ghost ? ' bui-cta--ghost' : ''}`} onClick={() => (cta.to && c.status !== 'draft' ? navigate(cta.to) : openCampaign(c))}>{cta.label}</button>
                      </td>
                    </tr>,
                    <tr key={`${cid}-track`}>
                      <td colSpan={6} className="bui-trackcell">
                        <div className="bui-track6" style={{ '--n': st.labels.length }} role="list" aria-label={`Progress for ${title}`}>
                          {st.labels.map((name, i) => {
                            const done = i < st.shownIdx;
                            const now = i === st.shownIdx && c.status !== 'completed';
                            return (
                              <div key={name} role="listitem" className={done ? 'is-done' : now ? 'is-now' : ''}>
                                <span aria-hidden="true" />
                                <em>{name}</em>
                              </div>
                            );
                          })}
                        </div>
                      </td>
                    </tr>,
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {briefOpen && (
        // Clicking the backdrop (or the X) saves the half-written brief as a draft on the way out.
        <BriefOverlay className="cmk-brief-overlay" onClick={closeBrief}>
          <div className="cmk-brief-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="cmk-brief-close" aria-label="Close" onClick={closeBrief}>
              <X size={20} />
            </button>
            <PostABrief
              // Remount when switching between drafts / a fresh brief so the wizard reseeds.
              key={editingDraftId || 'new'}
              ref={briefRef}
              resumeDraftId={editingDraftId}
              onClose={closeBrief}
              onPublished={() => { setBriefOpen(false); setEditingDraftId(null); loadCampaigns(); }}
              onDraftSaved={() => loadCampaigns()}
            />
          </div>
        </BriefOverlay>
      )}

      {confirmDelete && (
        <div className="bui-modal-ov" onClick={() => setConfirmDelete(null)}>
          <div className="bui-modal bui-modal--sm" role="dialog" aria-modal="true" aria-label="Delete this draft?" onClick={(e) => e.stopPropagation()}>
            <h2 className="bui-modal-h">Delete this draft?</h2>
            <div className="bui-modal-body">
              <p className="bui-muted-p">&ldquo;{confirmDelete.title || 'Untitled campaign'}&rdquo; will be deleted permanently. This can&rsquo;t be undone.</p>
              <div className="bui-modal-foot">
                <button type="button" className="bui-btn bui-btn--ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
                <button type="button" className="bui-btn bui-btn--danger" onClick={confirmDeleteDraft}>Delete draft</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </BrandTopNavLayout>
  );
}
