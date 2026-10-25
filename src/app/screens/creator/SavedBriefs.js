import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Bookmark } from 'lucide-react';
import AppShell from '../../shell/AppShell';
import { useAuth } from '../../../App';
import { useLiveEffect } from '../../../lib/liveUpdates';
import normalizeBrief from '../../../utils/normalizeBrief';
import { getSavedBriefs, toggleSavedBrief, hydrateSavedFromServer } from '../../../utils/savedBriefs';
import { API, BriefTabs, BriefCard, BriefCardSkeleton, BriefDetail, useApply } from './briefsShared';

export default function SavedBriefs() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [saved, setSaved] = useState(() => getSavedBriefs());
  const [openBrief, setOpenBrief] = useState(null); // full brief shown in the detail view
  const [opening, setOpening] = useState(null);     // id currently being fetched
  // Skeleton only while the first server sync runs AND the local cache is empty (fresh device).
  const [hydrating, setHydrating] = useState(true);

  useLiveEffect(() => {
    const sync = () => setSaved(getSavedBriefs());
    window.addEventListener('ugc-saved-changed', sync);
    hydrateSavedFromServer().then(setSaved).catch(() => {}).finally(() => setHydrating(false));
    return () => window.removeEventListener('ugc-saved-changed', sync);
  }, []);

  // The saved snapshot drops the heavy raw campaign, so re-fetch it: the detail always shows the brand's current brief.
  const openDetail = async (b) => {
    if (!b.id) { toast.error('This brief is unavailable'); return; }
    if (opening) return;
    setOpening(b.id);
    try {
      const { data: campaign } = await axios.get(`${API}/campaigns/${b.id}`);
      const iBid = campaign.bids?.some((bid) => bid.creator_id === user?.id);
      setOpenBrief(normalizeBrief(campaign, 0, iBid ? [campaign] : []));
    } catch {
      toast.error('Could not load this campaign - it may have been removed.');
    } finally {
      setOpening(null);
    }
  };

  const apply = useApply(user, () => { setOpenBrief(null); });
  const unsave = (brief) => { toggleSavedBrief(brief); toast.success('Removed from saved'); };
  const list = saved.map((b) => (b.brand ? b : normalizeBrief(b)));
  const isSaved = (id) => saved.some((b) => String(b.id ?? b._id) === String(id));

  return (
    <AppShell title="Saved briefs" subtitle="Briefs you bookmarked to apply to later.">
      <BriefTabs active="saved" counts={{ saved: saved.length }} />
      {list.length ? (
        <div className="ap-bf-list">
          {list.map((b) => <BriefCard key={b.id} brief={b} saved busy={opening === b.id} cta="View" onOpen={openDetail} onToggleSave={unsave} />)}
        </div>
      ) : hydrating ? (
        <div className="ap-bf-list" aria-hidden="true">{[0, 1, 2].map((i) => <BriefCardSkeleton key={i} />)}</div>
      ) : (
        <div className="ap-empty ap-card">
          <Bookmark size={34} />
          <h3>No saved briefs yet</h3>
          <p>Tap the bookmark on any brief in Find briefs to save it here for later.</p>
          <button type="button" className="ap-btn" onClick={() => navigate('/browse-briefs')}>Find briefs</button>
        </div>
      )}

      {openBrief && (
        <BriefDetail
          brief={openBrief}
          saved={isSaved(openBrief.id)}
          onToggleSave={(brief) => { const s = toggleSavedBrief(brief); toast.success(s ? 'Saved to your list' : 'Removed from saved'); }}
          onClose={() => setOpenBrief(null)}
          onApply={apply.start}
          applying={apply.checking}
        />
      )}
      {apply.ui}
    </AppShell>
  );
}
