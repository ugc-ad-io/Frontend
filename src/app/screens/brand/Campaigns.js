import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Search, Trash2, Megaphone, X } from 'lucide-react';
import { useAuth } from '../../../App';
import { useLiveEffect } from '../../../lib/liveUpdates';
import { ownsCampaign } from '../../../utils/brandWorkspace';
import { selectedCreators } from '../../../utils/campaignCreators';
import { apiErrorMessage } from '../../../utils/apiError';
import { campaignStage, campaignPill, campaignCta, budgetText } from '../../../utils/campaignStage';
import withBrandGate from '../../brandkit/withBrandGate';
import AppShell from '../../shell/AppShell';
import BottomSheet from '../../shell/BottomSheet';
import { API, ROUTES, fmtDay, campaignThumb, Thumb, Avatar, StageBar, SkelCards, ErrorState, OfflineStrip } from './campaignKit';

// Status tabs (same as the website). The first six always show; the rest only when something sits in them.
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
  return d ? fmtDay(d) : '';
}

function Campaigns() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  // Non-empty when the last load FAILED, so a broken request never masquerades as an empty account.
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const load = useCallback(async () => {
    try {
      // include_drafts: GET /campaigns hides drafts by default.
      const res = await axios.get(`${API}/campaigns?include_drafts=true&t=${Date.now()}`);
      // Match the brand WORKSPACE, not user.id: a team member's campaigns carry the owner's id.
      setCampaigns((Array.isArray(res.data) ? res.data : []).filter((c) => ownsCampaign(user, c)));
      setLoadError('');
    } catch (err) {
      setLoadError(apiErrorMessage(err, 'Could not load your campaigns.'));
    } finally { setLoading(false); }
  }, [user?.id, user?.team_of]); // eslint-disable-line react-hooks/exhaustive-deps

  useLiveEffect(() => { load(); }, [load]);

  const openCampaign = (c) => {
    const cid = c.id || c._id;
    if (c.status === 'draft') navigate(`${ROUTES.post}?draft=${encodeURIComponent(cid)}`);
    else navigate(ROUTES.campaign(cid));
  };

  const confirmDeleteDraft = async () => {
    const c = confirmDelete;
    if (!c || deletingId) return;
    const cid = c.id || c._id;
    setDeletingId(cid);
    try {
      await axios.delete(`${API}/campaigns/${cid}`);
      setCampaigns((prev) => prev.filter((x) => (x.id || x._id) !== cid));
      setConfirmDelete(null);
      toast.success('Draft deleted');
      load();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not delete the draft. Please try again.'));
    } finally { setDeletingId(null); }
  };

  const counts = useMemo(() => {
    const o = {};
    TABS.forEach((t) => { o[t.key] = campaigns.filter(t.match).length; });
    return o;
  }, [campaigns]);
  const visibleTabs = TABS.filter((t) => t.always || counts[t.key] > 0 || tab === t.key);

  const rows = useMemo(() => {
    const t = TABS.find((x) => x.key === tab) || TABS[0];
    const q = query.trim().toLowerCase();
    return campaigns
      .filter(t.match)
      .filter((c) => !q || String(c.title || c.product_name || '').toLowerCase().includes(q))
      .sort((a, b) => new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0));
  }, [campaigns, tab, query]);

  const retry = () => { setLoading(true); load(); };

  return (
    <AppShell title="Campaigns">
      <div className="ap-cp-page">
        <OfflineStrip />
        <label className="ap-cp-search">
          <Search size={18} aria-hidden="true" />
          <input type="search" placeholder="Search campaigns" aria-label="Search campaigns" value={query} onChange={(e) => setQuery(e.target.value)} />
          {query && <button type="button" aria-label="Clear search" onClick={() => setQuery('')}><X size={16} /></button>}
        </label>

        <div className="ap-chips" role="tablist" aria-label="Campaign status">
          {visibleTabs.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`ap-chip${tab === t.key ? ' is-on' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}<span className="ap-cp-count">{counts[t.key] || 0}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <SkelCards n={4} h={150} />
        ) : loadError ? (
          <ErrorState title={'Couldn’t load your campaigns'} message={loadError} onRetry={retry} />
        ) : rows.length === 0 ? (
          tab === 'all' && !query ? (
            <div className="ap-empty">
              <span className="ap-cp-emptyic"><Megaphone size={32} /></span>
              <h3>No campaigns yet</h3>
              <p>Post your first brief &mdash; creators usually start bidding within a day.</p>
              <button type="button" className="ap-btn ap-cp-lg ap-btn--block" onClick={() => navigate(ROUTES.post)}>Post a campaign</button>
            </div>
          ) : (
            <div className="ap-empty">
              <h3>Nothing here</h3>
              <p>{query ? 'No campaign matches your search.' : 'Campaigns will appear here once they reach this stage.'}</p>
              {(query || tab !== 'all') && <button type="button" className="ap-btn ap-btn--ghost" onClick={() => { setQuery(''); setTab('all'); }}>Show all campaigns</button>}
            </div>
          )
        ) : (
          <div className="ap-cp-list">
            {rows.map((c) => {
              const cid = c.id || c._id;
              const hired = hiredCreator(c);
              const bids = (c.bids || []).length;
              // The script gate is not a delivery: the shared stage helper maps it to "Review", so name it properly here.
              const script = c.status === 'awaiting_brand_confirmation';
              const st = script ? { idx: 0 } : campaignStage(c);
              const pill = script ? { text: 'Script ready', tone: 'warn' } : campaignPill(c);
              const cta = c.status === 'draft' ? { label: 'Edit' } : script ? { label: 'Review script', to: ROUTES.campaign(cid) } : campaignCta(c);
              const title = c.title || c.product_name || 'Untitled campaign';
              const meta = [c.product_category, c.video_format].filter(Boolean).join(' · ');
              const ghost = c.status === 'completed' || c.status === 'draft';
              const due = dueText(c);
              const budget = budgetText(c);
              return (
                <article key={cid} className="ap-card ap-cp-camp">
                  <button type="button" className="ap-cp-camp-main" onClick={() => openCampaign(c)} aria-label={`Open ${title}`}>
                    <Thumb src={campaignThumb(c)} name={title} />
                    <span className="ap-cp-camp-t">
                      <b>{title}</b>
                      <small>{meta || (due || ' ')}</small>
                    </span>
                    <span className={`ap-pill ap-cp-pill-abs${pill.tone && pill.tone !== 'info' ? ` ap-pill--${pill.tone}` : ''}`}>{pill.text}</span>
                  </button>

                  <div className="ap-cp-camp-meta">
                    {hired ? (
                      <span className="ap-cp-who"><Avatar src={hired.photo} name={hired.name} size={24} /><b>{hired.name}</b></span>
                    ) : (
                      <b className="ap-cp-accent">{bids ? `${bids} bid${bids === 1 ? '' : 's'} waiting` : 'No bids yet'}</b>
                    )}
                    {due && <span>{due}</span>}
                    {budget && <span className="ap-cp-strong">{budget}</span>}
                  </div>

                  <StageBar idx={st.shownIdx} stages={st.labels} completed={c.status === 'completed'} label={`Progress for ${title}`} />

                  <div className="ap-cp-camp-act">
                    {['draft', 'rejected'].includes(c.status) && (
                      <button type="button" className="ap-cp-iconbtn" aria-label={`Delete ${title}`} disabled={deletingId === cid} onClick={() => setConfirmDelete(c)}><Trash2 size={18} /></button>
                    )}
                    <button type="button" className={`ap-btn ap-btn--sm${ghost ? ' ap-btn--ghost' : ''}`} onClick={() => (cta.to && c.status !== 'draft' ? navigate(cta.to) : openCampaign(c))}>{cta.label}</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <BottomSheet
        open={!!confirmDelete}
        onClose={() => { if (!deletingId) setConfirmDelete(null); }}
        title="Delete this draft?"
        footer={(
          <>
            <button type="button" className="ap-btn ap-cp-soft ap-cp-lg" style={{ flex: 1 }} onClick={() => setConfirmDelete(null)} disabled={!!deletingId}>Cancel</button>
            <button type="button" className="ap-btn ap-btn--danger ap-cp-lg" style={{ flex: 1 }} onClick={confirmDeleteDraft} disabled={!!deletingId}>{deletingId ? 'Deleting…' : 'Delete draft'}</button>
          </>
        )}
      >
        <p className="ap-cp-p">&ldquo;{confirmDelete?.title || 'Untitled campaign'}&rdquo; will be deleted permanently. This can&rsquo;t be undone.</p>
      </BottomSheet>
    </AppShell>
  );
}

export default withBrandGate(Campaigns);
