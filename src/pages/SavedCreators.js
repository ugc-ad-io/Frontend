import { useState, useEffect, useMemo, useRef } from 'react';
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
  const [isPhone, setIsPhone] = useState(false);

  useEffect(() => {
    const sync = () => setSaved(getSavedCreators());
    window.addEventListener('ugc-saved-creators-changed', sync);
    return () => window.removeEventListener('ugc-saved-creators-changed', sync);
  }, []);

  // Track phone width so the cloned loop tail only mounts where the sideways track exists.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 620px)');
    const update = () => setIsPhone(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
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

  // Phone-only cloned tail so the two-row sideways track loops seamlessly — mirrors
  // Browse Creators. ≤2 cards fit one column with nothing to scroll, so skip it.
  const cloneTail = useMemo(
    () => (isPhone && cards.length > 2 ? cards.slice(0, Math.min(6, cards.length)) : []),
    [isPhone, cards]
  );

  // Auto-scroll drift for the phone two-row track (ported from BrandCreators). It
  // creeps left at ~27px/s, wraps invisibly at the clone seam, and pauses 3s on any
  // touch/wheel/drag so it never fights the user. `data-clone-start` sits on the
  // .scr-reel WRAPPER (a direct grid child) so its offsetLeft measures the loop width.
  const gridRef = useRef(null);
  useEffect(() => {
    const el = gridRef.current;
    if (!el || !cards.length) return undefined;
    const mq = window.matchMedia('(max-width: 620px)');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0; let paused = false; let resumeTimer;
    let pos = 0; let loopWidth = 0;

    const measure = () => {
      const clone = el.querySelector('[data-clone-start]');
      loopWidth = clone ? clone.offsetLeft : 0;
    };
    const step = () => {
      if (!paused) {
        pos += 0.45;
        if (loopWidth > 0) {
          if (pos >= loopWidth) pos -= loopWidth;
        } else {
          const max = el.scrollWidth - el.clientWidth;
          if (pos > max) pos = max;
        }
        el.scrollLeft = pos;   // assign from the float accumulator, never += (rounds to 0)
      }
      raf = requestAnimationFrame(step);
    };
    const pause = () => {
      paused = true;
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => { pos = el.scrollLeft; paused = false; }, 3000);
    };
    const opts = { passive: true };
    const start = () => {
      if (raf || !mq.matches || reduce.matches) return;
      measure();
      pos = el.scrollLeft;
      el.addEventListener('touchstart', pause, opts);
      el.addEventListener('wheel', pause, opts);
      el.addEventListener('pointerdown', pause);
      raf = requestAnimationFrame(step);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      clearTimeout(resumeTimer);
      el.removeEventListener('touchstart', pause, opts);
      el.removeEventListener('wheel', pause, opts);
      el.removeEventListener('pointerdown', pause);
    };
    const onChange = () => { stop(); start(); };
    const onResize = () => measure();
    start();
    mq.addEventListener('change', onChange);
    window.addEventListener('resize', onResize, opts);
    return () => {
      stop();
      mq.removeEventListener('change', onChange);
      window.removeEventListener('resize', onResize, opts);
    };
  }, [cards.length, cloneTail.length]);

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
        <div className="bc-grid" ref={gridRef}>
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
          {/* Phone-only cloned tail the loop wraps into (decorative duplicates, no
              unsave). The first one carries data-clone-start for the wrap measurement. */}
          {cloneTail.map((c, i) => (
            <div key={`loop-${c.id}-${i}`} className="scr-reel" data-clone-start={i === 0 ? 'true' : undefined} aria-hidden="true">
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
