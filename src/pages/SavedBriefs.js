import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { toast } from 'sonner';
import { Bookmark, Star } from 'lucide-react';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import '../styles/creator-marketplace.css';
import EmptyState from '../components/EmptyState';
import BriefDetailDrawer from '../components/BriefDetailDrawer';
import { Skeleton } from '../components/Skeleton';
import normalizeBrief from '../utils/normalizeBrief';
import { getSavedBriefs, toggleSavedBrief, hydrateSavedFromServer } from '../utils/savedBriefs';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const getInitial = (name) => (name || 'B').trim().charAt(0).toUpperCase();

// Cover banner gradient — deterministic per brand, same as the Browse cards.
const COVER_GRADIENTS = [
  'linear-gradient(135deg,#c7d2fe,#a5b4fc)',
  'linear-gradient(135deg,#fbcfe8,#f9a8d4)',
  'linear-gradient(135deg,#bfdbfe,#93c5fd)',
  'linear-gradient(135deg,#bbf7d0,#86efac)',
  'linear-gradient(135deg,#fde68a,#fcd34d)',
  'linear-gradient(135deg,#ddd6fe,#c4b5fd)',
];
const coverBg = (name) => {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return COVER_GRADIENTS[h % COVER_GRADIENTS.length];
};

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
  useEffect(() => {
    const sync = () => setSaved(getSavedBriefs());
    window.addEventListener('ugc-saved-changed', sync);
    // Pull the durable saved set from the backend (syncs across devices).
    hydrateSavedFromServer().then(setSaved).catch(() => {}).finally(() => setHydrating(false));
    return () => window.removeEventListener('ugc-saved-changed', sync);
  }, []);

  const unsave = (e, brief) => {
    e.stopPropagation();
    toggleSavedBrief(brief);
    toast.success('Removed from saved');
  };

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
      toast.error('Could not load this campaign — it may have been removed.');
    } finally {
      setOpening(null);
    }
  };

  return (
    <CreatorTopNavLayout notifications={0}>
      <div className="cmk-page-head">
        <h1>Saved Campaigns</h1>
        <p>Campaigns you bookmarked to review or apply to later.</p>
      </div>

      {saved.length ? (
        <div className="cmk-bb-grid">
          {saved.map((b) => (
            <article
              key={b.id}
              className={`cmk-bb-card cmk-rise${opening === b.id ? ' is-loading' : ''}`}
              onClick={() => openDetail(b)}
            >
              <div className="cmk-bb-cover" style={b.image_url ? undefined : { background: coverBg(b.brand) }}>
                {b.image_url && (
                  <img
                    className="cmk-bb-cover-img"
                    src={b.image_url.startsWith('http') ? b.image_url : `${BACKEND_URL}${b.image_url}`}
                    alt=""
                  />
                )}
                <span className="cmk-bb-badge"><Star size={11} /> {b.matchScore}% Match</span>
                <button
                  type="button"
                  className="cmk-bb-save is-saved"
                  onClick={(e) => unsave(e, b)}
                  aria-label="Remove from saved"
                >
                  <Bookmark size={16} fill="currentColor" />
                </button>
              </div>
              <div className="cmk-bb-body">
                <div className="cmk-bb-brandrow">
                  <span className="cmk-bb-logo">
                    {b.logo ? <img src={b.logo.startsWith('http') ? b.logo : `${BACKEND_URL}${b.logo}`} alt="" /> : getInitial(b.brand)}
                  </span>
                  <strong className="cmk-bb-brand">{b.brand}</strong>
                </div>
                <h3 className="cmk-bb-title">{b.title}</h3>
                <p className="cmk-bb-sub">{[b.tags?.[0], b.deliveryLabel].filter(Boolean).join(' · ')}</p>
                <div className="cmk-bb-budget">{b.budget}</div>
              </div>
            </article>
          ))}
        </div>
      ) : hydrating ? (
        <div className="cmk-bb-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <article className="cmk-bb-card" key={i} aria-hidden="true">
              <Skeleton height={150} radius={0} style={{ display: 'block' }} />
              <div className="cmk-bb-body">
                <div className="cmk-bb-brandrow" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Skeleton width={26} height={26} radius="50%" />
                  <Skeleton width={90} height={12} />
                </div>
                <Skeleton width="80%" height={16} style={{ marginTop: 10 }} />
                <Skeleton width="55%" height={12} style={{ marginTop: 8 }} />
                <Skeleton width={90} height={16} style={{ marginTop: 12 }} />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No saved campaigns yet"
          message="Tap the bookmark on any campaign in Browse Campaigns to save it here for later."
          action={{ label: 'Browse Campaigns', onClick: () => navigate('/browse-briefs') }}
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
