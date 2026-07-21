import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Bookmark, X } from 'lucide-react';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import '../styles/creator-marketplace.css';
import EmptyState from '../components/EmptyState';
import { ReelCard } from './BrandCreators';
import { getSavedCreators, toggleSavedCreator } from '../utils/savedCreators';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

export default function SavedCreators() {
  const navigate = useNavigate();
  const [saved, setSaved] = useState(() => getSavedCreators());
  // Full creator directory keyed by id — gives the reel/video + all the fields the
  // shared ReelCard needs. The saved record is only a lightweight snapshot (name,
  // photo, category, price), so on its own it can't show a video; we look each
  // saved creator up in the live directory and fall back to the snapshot if absent.
  const [dir, setDir] = useState({});
  const [videoCard, setVideoCard] = useState(null);   // expanded reel modal

  useEffect(() => {
    const sync = () => setSaved(getSavedCreators());
    window.addEventListener('ugc-saved-creators-changed', sync);
    return () => window.removeEventListener('ugc-saved-creators-changed', sync);
  }, []);

  // Pull the same directory Browse Creators uses, so a saved creator renders with
  // their real reel and identical card. One call, cached in a { id: creator } map.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await axios.get(`${API}/business/creator-directory`);
        const list = Array.isArray(res.data) ? res.data : (res.data?.creators || []);
        if (!alive) return;
        const map = {};
        list.forEach((c) => { if (c?.id) map[c.id] = c; });
        setDir(map);
      } catch { /* directory unavailable — fall back to the saved snapshot below */ }
    })();
    return () => { alive = false; };
  }, []);

  // Merge each saved snapshot with its live directory entry. Directory wins (it has
  // the video + full data); the snapshot is the fallback so a creator who left the
  // directory still shows, just without a reel.
  const cards = useMemo(() => saved.map((s) => {
    const live = dir[s.id];
    if (live) return live;
    return {
      id: s.id,
      nickname: s.name,
      name: s.name,
      profile_photo: s.photo,
      category: s.category,
      price: s.price,
      location_region: s.location,
      public_creator_id: s.public_creator_id,
    };
  }), [saved, dir]);

  const unsave = (e, c) => {
    e.stopPropagation();
    // toggleSavedCreator matches on id, so pass the id even when we're holding the
    // merged/live object rather than the original snapshot.
    toggleSavedCreator({ id: c.id });
    toast.success('Removed from saved');
  };

  const viewProfile = (c) => {
    if (c.id) navigate(`/dashboard/business/creator/${c.id}`);
    else toast.error('This creator is unavailable');
  };

  return (
    <BrandTopNavLayout>
      <div className="cmk-page-head">
        <h1>Saved Creators</h1>
        <p>Creators you bookmarked to revisit or invite to a campaign.</p>
      </div>

      {cards.length ? (
        <div className="bc-grid">
          {cards.map((c) => (
            <div key={c.id} className="scr-reel">
              {/* Unsave sits top-right of the reel — the tier badge is top-left and
                  the mute/expand controls are along the bottom, so it never clashes. */}
              <button
                type="button"
                className="scr-unsave"
                onClick={(e) => unsave(e, c)}
                aria-label="Remove from saved"
                title="Saved — click to remove"
              >
                <Bookmark size={15} fill="currentColor" />
              </button>
              <ReelCard c={c} onView={viewProfile} onExpand={setVideoCard} />
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No saved creators yet"
          message="Tap the bookmark on any creator's profile to save them here for later."
          action={{ label: 'Browse Creators', onClick: () => navigate('/dashboard/business/browse-creator') }}
        />
      )}

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

      <style>{`
        /* Wrapper just hosts the unsave overlay; the card itself is the shared ReelCard. */
        .scr-reel { position: relative; width: 100%; min-width: 0; }
        .scr-unsave {
          position: absolute; top: 10px; right: 10px; z-index: 4;
          width: 32px; height: 32px; border-radius: 50%;
          border: 1px solid rgba(255,255,255,.75); background: rgba(255,255,255,.92);
          color: #4452f0; cursor: pointer; display: grid; place-items: center;
          box-shadow: 0 4px 12px -4px rgba(15,22,58,.4); transition: background .15s;
        }
        .scr-unsave:hover { background: #fff; }
      `}</style>
    </BrandTopNavLayout>
  );
}
