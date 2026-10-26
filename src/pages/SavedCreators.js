import { useLiveEffect } from '../lib/liveUpdates';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { X } from 'lucide-react';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import BrandPageHead from '../components/BrandPageHead';
import '../styles/creator-marketplace.css';
import '../styles/brand-mobile.css';
import '../styles/brand-ui-saved.css';
import { ReelCard } from './BrandCreators';
import { useSavedCreatorIds, loadSavedCreators, isSavedCreatorsLoaded } from '../utils/savedCreators';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

export default function SavedCreators() {
  const navigate = useNavigate();
  // The server stores only creator ids (shared by the brand team); the hook keeps
  // them live and optimistic. Newest save first, matching the old localStorage order.
  const savedIds = useSavedCreatorIds();
  const saved = useMemo(() => [...savedIds].reverse(), [savedIds]);
  // Full creator directory keyed by id — gives the reel/video + all the fields the
  // shared ReelCard needs. We look each saved id up in the live directory and fall
  // back to a bare card if the creator is no longer listed (so it can still be removed).
  const [dir, setDir] = useState({});
  const [ready, setReady] = useState(false);   // saved ids + directory both answered
  const [loadFailed, setLoadFailed] = useState(false);
  const [dirFailed, setDirFailed] = useState(false);   // creator details (video, name) did not load
  const [attempt, setAttempt] = useState(0);
  const [videoCard, setVideoCard] = useState(null);   // expanded reel modal
  const [cat, setCat] = useState('all');   // category chip filter

  // Pull the same directory Browse Creators uses, so a saved creator renders with
  // their real reel and identical card. One call, cached in a { id: creator } map.
  useLiveEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await axios.get(`${API}/business/creator-directory`);
        const list = Array.isArray(res.data) ? res.data : (res.data?.creators || []);
        if (!alive) return;
        const map = {};
        list.forEach((c) => { if (c?.id) map[c.id] = c; });
        setDir(map);
        setDirFailed(false);
      } catch {
        // Directory unavailable: bare cards below still let a creator be opened or removed,
        // but say so, otherwise every card silently reads "Creator" with no video.
        if (alive) setDirFailed(true);
      }
      await loadSavedCreators();
      if (!alive) return;
      setLoadFailed(!isSavedCreatorsLoaded());
      setReady(true);
    })();
    return () => { alive = false; };
  }, [attempt]);

  const cards = useMemo(
    () => saved.map((id) => dir[id] || { id, nickname: 'Creator', name: 'Creator' }),
    [saved, dir]
  );

  // Category chips are built from the saved creators' own categories (no fixed list).
  const catKeys = (c) => (c.categories?.length ? c.categories : [c.primary_category])
    .map((v) => String(v || '').trim().toLowerCase()).filter(Boolean);
  const catCounts = useMemo(() => {
    const m = new Map();
    cards.forEach((c) => new Set(catKeys(c)).forEach((k) => m.set(k, (m.get(k) || 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [cards]);
  const shown = cat === 'all' ? cards : cards.filter((c) => catKeys(c).includes(cat));
  const label = (k) => k.replace(/_/g, ' ').replace(/^./, (m) => m.toUpperCase());

  const viewProfile = (c) => {
    if (c.id) navigate(`/dashboard/business/creator/${c.id}`);
    else toast.error('This creator is unavailable');
  };

  return (
    <BrandTopNavLayout>
      <div className="bui-main bui-main--tight">
        <BrandPageHead
          title="Saved creators"
          subtitle={ready && !loadFailed && cards.length
            ? `${cards.length} creator${cards.length === 1 ? '' : 's'} you bookmarked. Open a profile to send a brief.`
            : 'Creators you bookmarked to revisit or invite to a campaign.'}
          hideSearch
          action={(
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
              <button type="button" className="bui-btn bui-btn--ghost" onClick={() => navigate('/dashboard/business/multi-brief')}>Brief several at once</button>
              <button type="button" className="bui-btn bui-btn--ghost" onClick={() => navigate('/dashboard/business/browse-creator')}>Browse creators</button>
            </div>
          )}
        />

        {!ready ? (
          <p className="bui-note">Loading saved creators...</p>
        ) : loadFailed ? (
          <div className="bui-note" role="alert">
            Could not load your saved creators. Check your connection and try again.{' '}
            <button type="button" onClick={() => { setReady(false); setAttempt((n) => n + 1); }}>Retry</button>
          </div>
        ) : cards.length ? (
          <>
            {dirFailed && (
              <div className="bui-note" role="status">
                Creator details could not be loaded, so some cards may look blank.{' '}
                <button type="button" onClick={() => { setReady(false); setAttempt((n) => n + 1); }}>Retry</button>
              </div>
            )}
            {catCounts.length > 0 && (
              <div className="bui-chips" role="group" aria-label="Filter by category">
                <button type="button" className={`bui-pill${cat === 'all' ? ' is-on' : ''}`} onClick={() => setCat('all')}>All {cards.length}</button>
                {catCounts.map(([k, n]) => (
                  <button key={k} type="button" className={`bui-pill${cat === k ? ' is-on' : ''}`} onClick={() => setCat(k)}>{label(k)} {n}</button>
                ))}
              </div>
            )}
            <div className="bui-reel-grid bui-reel-grid--saved">
              {shown.map((c) => (
                <ReelCard key={c.id} c={c} onView={viewProfile} onExpand={setVideoCard} />
              ))}
            </div>
          </>
        ) : (
          <div className="bui-empty">
            <h3>No saved creators yet</h3>
            <p>Tap the heart on any creator card or profile to save them here for later.</p>
            <button type="button" className="bui-btn" onClick={() => navigate('/dashboard/business/browse-creator')}>Browse Creators</button>
          </div>
        )}
      </div>

      {/* Expanded reel — same overlay markup/styles as Browse Creators. */}
      {videoCard && (
        <div className="bc-vid-overlay" onClick={() => setVideoCard(null)}>
          <div className="bc-vid-card" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="bc-vid-close" onClick={() => setVideoCard(null)} aria-label="Close"><X size={18} /></button>
            {videoCard.name && <div className="bc-vid-name">{videoCard.name}</div>}
            <video src={videoCard.src} controls autoPlay playsInline className="bc-vid-el" />
          </div>
        </div>
      )}
    </BrandTopNavLayout>
  );
}
