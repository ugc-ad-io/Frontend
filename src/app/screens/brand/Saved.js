import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Heart, Users, WifiOff, AlertCircle } from 'lucide-react';
import AppShell from '../../shell/AppShell';
import withBrandGate from '../../brandkit/withBrandGate';
import { useLiveEffect } from '../../../lib/liveUpdates';
import { useSavedCreatorIds, loadSavedCreators, isSavedCreatorsLoaded } from '../../../utils/savedCreators';
import ReelCard from '../../brandkit/ReelCard';
import VideoViewer from '../../brandkit/VideoViewer';
import { API, titleCase } from '../../brandkit/kit';
import './saved.css';

const catKeys = (c) => (c.categories?.length ? c.categories : [c.primary_category])
  .map((v) => String(v || '').trim().toLowerCase()).filter(Boolean);

// Saved creators (board M0 "Saved creators"). Same data as src/pages/SavedCreators.js.
function BrandAppSaved() {
  const navigate = useNavigate();
  // The server stores only creator ids (shared by the brand team); the hook keeps them live and optimistic.
  const savedIds = useSavedCreatorIds();
  const saved = useMemo(() => [...savedIds].reverse(), [savedIds]);
  const [dir, setDir] = useState({});
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [dirFailed, setDirFailed] = useState(false);
  const [offline, setOffline] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [viewer, setViewer] = useState(null);
  const [cat, setCat] = useState('all');

  // The same directory Browse Creators uses, so a saved creator renders with their real reel.
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
        setOffline(false);
      } catch (e) {
        // Bare cards still let a creator be opened or removed, but say so.
        if (alive) { setDirFailed(true); setOffline(!e?.response); }
      }
      await loadSavedCreators();
      if (!alive) return;
      setLoadFailed(!isSavedCreatorsLoaded());
      setReady(true);
    })();
    return () => { alive = false; };
  }, [attempt]);

  const cards = useMemo(() => saved.map((id) => dir[id] || { id, nickname: 'Creator', name: 'Creator' }), [saved, dir]);
  const catCounts = useMemo(() => {
    const m = new Map();
    cards.forEach((c) => new Set(catKeys(c)).forEach((k) => m.set(k, (m.get(k) || 0) + 1)));
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [cards]);
  const shown = cat === 'all' ? cards : cards.filter((c) => catKeys(c).includes(cat));

  const view = (c) => {
    if (c.id) navigate(`/dashboard/business/creator/${c.id}`);
    else toast.error('This creator is unavailable');
  };
  const retry = () => { setReady(false); setAttempt((n) => n + 1); };

  return (
    <AppShell title="Saved creators" back="/dashboard/business/browse-creator">
      <p className="ap-sv-sub">
        {ready && !loadFailed && cards.length
          ? `${cards.length} creator${cards.length === 1 ? '' : 's'} you bookmarked. Open a profile to send a brief.`
          : 'Creators you bookmarked to revisit or invite to a campaign.'}
      </p>

      {!ready ? (
        <div aria-busy="true">
          <div className="ap-sv-grid">{[0, 1, 2, 3].map((i) => <div key={i} className="ap-skel ap-sv-sk" />)}</div>
        </div>
      ) : loadFailed ? (
        <div className="ap-empty" role="alert">
          {offline ? <WifiOff size={30} color="#6e6e96" /> : <AlertCircle size={30} color="#e5484d" />}
          <h3>Could not load saved creators</h3>
          <p>{offline ? "You're offline or the server can't be reached. Check your connection and try again." : 'Check your connection and try again.'}</p>
          <button type="button" className="ap-btn" onClick={retry}>Retry</button>
        </div>
      ) : cards.length ? (
        <>
          <button type="button" className="ap-btn ap-btn--ghost ap-btn--block" onClick={() => navigate('/dashboard/business/multi-brief')}>
            <Users size={18} /> Brief several at once
          </button>
          {dirFailed && (
            <div className="ap-card ap-sv-note" role="status">
              <span>Creator details could not be loaded, so some cards may look blank.</span>
              <button type="button" className="ap-btn ap-btn--sm" onClick={retry}>Retry</button>
            </div>
          )}
          {catCounts.length > 0 && (
            <div className="ap-chips" role="group" aria-label="Filter by category">
              <button type="button" className={`ap-chip${cat === 'all' ? ' is-on' : ''}`} aria-pressed={cat === 'all'} onClick={() => setCat('all')}>All {cards.length}</button>
              {catCounts.map(([k, n]) => (
                <button key={k} type="button" className={`ap-chip${cat === k ? ' is-on' : ''}`} aria-pressed={cat === k} onClick={() => setCat(k)}>{titleCase(k)} {n}</button>
              ))}
            </div>
          )}
          <div className="ap-sv-grid">
            {shown.map((c) => <ReelCard key={c.id} c={c} onView={view} onInvite={view} onPlay={setViewer} />)}
          </div>
        </>
      ) : (
        <div className="ap-empty">
          <Heart size={32} color="#7387ff" />
          <h3>No saved creators yet</h3>
          <p>Tap the heart on any creator card or profile to save them here for later.</p>
          <button type="button" className="ap-btn" onClick={() => navigate('/dashboard/business/browse-creator')}>Browse creators</button>
        </div>
      )}

      {viewer && <VideoViewer items={[viewer]} onClose={() => setViewer(null)} />}
    </AppShell>
  );
}

export default withBrandGate(BrandAppSaved);
