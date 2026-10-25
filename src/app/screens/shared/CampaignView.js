import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate, matchPath } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { WifiOff, FileQuestion, RefreshCw } from 'lucide-react';
import AppShell from '../../shell/AppShell';
import { useAuth } from '../../../App';
import { useLiveEffect } from '../../../lib/liveUpdates';
import { ownsCampaign } from '../../../utils/brandWorkspace';
import normalizeBrief from '../../../utils/normalizeBrief';
import { toggleSavedBrief, getSavedIds } from '../../../utils/savedBriefs';
import { apiErrorMessage } from '../../../utils/apiError';
import { BriefDetail, useApply, API, OFFLINE } from '../creator/briefsShared';
import './campaignView.css';

// /campaign/:id - the brief page opened from notifications, shares and links. Creators read the brief and apply
// (same gates + bid form as Find briefs); the brand that owns the campaign is sent to its campaign screen (bids,
// shortlist, hiring); any other signed-in user gets the brief read-only. Logged-out visitors are sent to sign in
// by the route guard, same as the website. Screens render outside <Route>, so the id is read from the path.
export default function CampaignView() {
  const { pathname } = useLocation();
  const id = matchPath('/campaign/:id', pathname)?.params?.id;
  const navigate = useNavigate();
  const { user } = useAuth();
  const isCreator = user?.role === 'creator';

  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  const [savedIds, setSavedIds] = useState(() => getSavedIds());

  const fetchCampaign = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/campaigns/${id}?t=${Date.now()}`);
      setCampaign(res.data);
      setError('');
      setMissing(false);
    } catch (e) {
      if (e?.response?.status === 404) setMissing(true);
      else setError(e?.response ? apiErrorMessage(e, 'Failed to load campaign') : OFFLINE);
    } finally {
      setLoading(false);
    }
  }, [id]);
  useLiveEffect(() => { fetchCampaign(); }, [fetchCampaign]);

  const apply = useApply(user, () => { fetchCampaign(); });

  const hasBid = !!campaign?.bids?.some((b) => String(b.creator_id) === String(user?.id));
  const brief = useMemo(() => (campaign ? normalizeBrief(campaign, 0, hasBid ? [campaign] : []) : null), [campaign, hasBid]);
  const canApply = isCreator && (hasBid || campaign?.status === 'active');

  // BriefDetail always draws Save + Apply; hide what this viewer can't use (a brand can't bid or save, a closed brief takes no bids).
  useEffect(() => {
    const cls = document.body.classList;
    cls.toggle('ap-cv-noapply', !canApply);
    cls.toggle('ap-cv-nosave', !isCreator);
    return () => { cls.remove('ap-cv-noapply', 'ap-cv-nosave'); };
  }, [canApply, isCreator]);

  const close = useCallback(() => {
    if (window.history.length > 1) navigate(-1);
    else navigate(user?.role === 'business' ? '/brand-home' : '/browse-briefs', { replace: true });
  }, [navigate, user?.role]);
  const toggleSave = (b) => { const s = toggleSavedBrief(b); setSavedIds(getSavedIds()); toast.success(s ? 'Saved to your list' : 'Removed from saved'); };

  if (campaign && user?.role === 'business' && ownsCampaign(user, campaign)) {
    return <Navigate to={`/dashboard/business/campaign/${encodeURIComponent(id)}`} replace />;
  }

  if (brief) {
    return (
      <>
        <AppShell back title="Brief" tabs={false}><span /></AppShell>
        <BriefDetail
          brief={brief}
          saved={savedIds.has(String(brief.id))}
          onToggleSave={toggleSave}
          onClose={close}
          onApply={apply.start}
          applying={apply.checking}
        />
        {apply.ui}
      </>
    );
  }

  return (
    <AppShell back title="Brief" tabs={false}>
      {loading ? (
        <div className="ap-cv-sk" aria-hidden="true">
          <div className="ap-skel" style={{ height: 190, borderRadius: 20 }} />
          <div className="ap-skel" style={{ height: 64, borderRadius: 20 }} />
          <div className="ap-skel" style={{ height: 140, borderRadius: 20 }} />
        </div>
      ) : (
        <div className="ap-card ap-empty" role="alert">
          {error === OFFLINE ? <WifiOff size={34} /> : <FileQuestion size={34} />}
          <h3>{missing || !error ? 'Campaign not found' : 'Could not load this brief'}</h3>
          <p>{missing || !error ? 'This brief may have been removed, or the link is incorrect.' : error}</p>
          {error ? <button type="button" className="ap-btn" onClick={() => { setLoading(true); fetchCampaign(); }}><RefreshCw size={16} /> Retry</button> : (
            <button type="button" className="ap-btn" onClick={close}>Go back</button>
          )}
        </div>
      )}
    </AppShell>
  );
}
