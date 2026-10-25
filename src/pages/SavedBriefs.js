import { useLiveEffect } from '../lib/liveUpdates';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import CreatorPageHead from '../components/CreatorPageHead';
import BriefCard, { BriefCardSkeleton } from '../components/BriefCard';
import EmptyState from '../components/EmptyState';
import BriefDetailDrawer from '../components/BriefDetailDrawer';
import normalizeBrief from '../utils/normalizeBrief';
import { getSavedBriefs, toggleSavedBrief, hydrateSavedFromServer } from '../utils/savedBriefs';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

export default function SavedBriefs() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [saved, setSaved] = useState(() => getSavedBriefs());
  const [openBrief, setOpenBrief] = useState(null); // brief shown in the detail drawer
  const [opening, setOpening] = useState(null);     // id currently being fetched
  // True until the first server sync finishes. Only used to show a skeleton when
  // the local cache is empty (e.g. a fresh device) — a populated cache renders
  // instantly and never sees it.
  const [hydrating, setHydrating] = useState(true);

  // Reflect saves/removes made here or on the Browse page.
  useLiveEffect(() => {
    const sync = () => setSaved(getSavedBriefs());
    window.addEventListener('ugc-saved-changed', sync);
    // Pull the durable saved set from the backend (syncs across devices).
    hydrateSavedFromServer().then(setSaved).catch(() => {}).finally(() => setHydrating(false));
    return () => window.removeEventListener('ugc-saved-changed', sync);
  }, []);

  // Open the full brief right here rather than bouncing to Browse Campaigns.
  // The saved snapshot drops the heavy raw campaign, so re-fetch it — that also
  // means the drawer always shows the brand's current brief, not a stale copy.
  const openDetail = async (b) => {
    if (!b.id) { toast.error('This brief is unavailable'); return; }
    setOpening(b.id);
    try {
      const { data: campaign } = await axios.get(`${API}/campaigns/${b.id}`);
      // hasBid is derived from the campaign's own bids list (same rule as Browse).
      const iBid = campaign.bids?.some((bid) => bid.creator_id === user?.id);
      setOpenBrief(normalizeBrief(campaign, 0, iBid ? [campaign] : []));
    } catch {
      toast.error('Could not load this campaign - it may have been removed.');
    } finally {
      setOpening(null);
    }
  };

  return (
    <CreatorTopNavLayout notifications={0}>
      <CreatorPageHead title="Saved briefs" subtitle="Briefs you bookmarked to review or apply to later." />

      {saved.length ? (
        <div className="cui-b-grid">
          {/* briefs synced from the server arrive as raw campaigns: normalize them for the card */}
          {saved.map((b) => (b.brand ? b : normalizeBrief(b))).map((b) => (
            <BriefCard
              key={b.id}
              brief={b}
              saved
              busy={opening === b.id}
              cta="View"
              onOpen={openDetail}
              onToggleSave={(brief) => { toggleSavedBrief(brief); toast.success('Removed from saved'); }}
            />
          ))}
        </div>
      ) : hydrating ? (
        <div className="cui-b-grid">
          {Array.from({ length: 6 }).map((_, i) => <BriefCardSkeleton key={i} />)}
        </div>
      ) : (
        <EmptyState
          title="No saved briefs yet"
          message="Tap the bookmark on any brief in Find briefs to save it here for later."
          action={{ label: 'Find briefs', onClick: () => navigate('/browse-briefs') }}
        />
      )}

      <BriefDetailDrawer
        brief={openBrief}
        onClose={() => setOpenBrief(null)}
        onBid={(b) => navigate(`/campaign/${b.id}`)}
      />
    </CreatorTopNavLayout>
  );
}
