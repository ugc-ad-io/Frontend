import { useLiveEffect } from '../lib/liveUpdates';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
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
  const [searchParams] = useSearchParams();
  const [term, setTerm] = useState(searchParams.get('q') || '');
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

  // briefs synced from the server arrive as raw campaigns: normalize them for the card
  const savedNorm = saved.map((b) => (b.brand ? b : normalizeBrief(b)));
  const q = term.trim().toLowerCase();
  const savedShown = q
    ? savedNorm.filter((b) => `${b.title || ''} ${b.brand || ''} ${b.description || ''} ${b.industryType || ''} ${(b.tags || []).join(' ')}`.toLowerCase().includes(q))
    : savedNorm;

  return (
    <CreatorTopNavLayout notifications={0}>
      <CreatorPageHead title="Saved briefs" subtitle="Briefs you bookmarked to review or apply to later." hideSearch />

      <div className="cui-b-filters">
        <form className="cui-b-searchrow" role="search" onSubmit={(e) => e.preventDefault()}>
          <label className="cui-b-search">
            <Search size={18} />
            <input type="search" aria-label="Search briefs" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search saved briefs by product, brand or idea" />
          </label>
          <button type="submit" className="cui-b-searchbtn">Search</button>
        </form>
      </div>

      {saved.length && !savedShown.length ? (
        <EmptyState
          title="No saved briefs match your search"
          message={`Nothing you saved matches “${term.trim()}”.`}
          action={{ label: 'Clear search', onClick: () => setTerm('') }}
        />
      ) : saved.length ? (
        <div className="cui-b-grid">
          {savedShown.map((b) => (
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
