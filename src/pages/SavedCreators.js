import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Bookmark, MapPin } from 'lucide-react';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import '../styles/creator-marketplace.css';
import EmptyState from '../components/EmptyState';
import { getSavedCreators, toggleSavedCreator } from '../utils/savedCreators';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const getInitial = (name) => (name || 'C').replace('@', '').trim().charAt(0).toUpperCase();
const resolvePhoto = (p) => (p ? (p.startsWith('http') ? p : `${BACKEND_URL}${p}`) : '');

export default function SavedCreators() {
  const navigate = useNavigate();
  const [saved, setSaved] = useState(() => getSavedCreators());
  // Live photo/banner per creator id. The saved record is a one-time snapshot, so
  // creators bookmarked before they had a photo/banner (or who changed theirs
  // since) rendered the gradient + initial forever. Re-fetch the real profile and
  // let it win over the stored copy.
  const [live, setLive] = useState({});

  useEffect(() => {
    const sync = () => setSaved(getSavedCreators());
    window.addEventListener('ugc-saved-creators-changed', sync);
    return () => window.removeEventListener('ugc-saved-creators-changed', sync);
  }, []);

  useEffect(() => {
    let alive = true;
    const ids = saved.map((c) => c.id).filter(Boolean);
    if (!ids.length) return undefined;
    Promise.all(
      ids.map((id) =>
        axios.get(`${API}/profile/${id}`)
          .then((r) => [id, r.data])
          .catch(() => [id, null])
      )
    ).then((pairs) => {
      if (!alive) return;
      const next = {};
      pairs.forEach(([id, d]) => {
        if (!d) return;
        const p = d.profile || {};
        next[id] = {
          photo: d.profile_photo || p.profile_photo || '',
          banner: d.banner || p.banner || '',
        };
      });
      setLive((cur) => ({ ...cur, ...next }));
    });
    return () => { alive = false; };
  }, [saved]);

  const unsave = (e, c) => {
    e.stopPropagation();
    toggleSavedCreator(c);
    toast.success('Removed from saved');
  };

  return (
    <BrandTopNavLayout>
      <div className="cmk-page-head">
        <h1>Saved Creators</h1>
        <p>Creators you bookmarked to revisit or invite to a campaign.</p>
      </div>

      {saved.length ? (
        <div className="scr-grid">
          {saved.map((c) => (
            <article
              key={c.id}
              className="scr-card cmk-rise"
              onClick={() => c.id ? navigate(`/dashboard/business/creator/${c.id}`) : toast.error('This creator is unavailable')}
              role="button"
              tabIndex={0}
            >
              <button type="button" className="scr-save" onClick={(e) => unsave(e, c)} aria-label="Remove from saved" title="Saved">
                <Bookmark size={16} fill="currentColor" />
              </button>
              {/* Prefer the LIVE profile image over the saved snapshot, so a
                  creator who added/changed a photo or banner after being saved
                  still renders. Falls back to the brand gradient + initial. */}
              {(() => {
                const banner = live[c.id]?.banner || c.banner;
                const photo = live[c.id]?.photo || c.photo;
                return (
                  <>
                    <span className="scr-banner">
                      {banner ? <img src={resolvePhoto(banner)} alt="" /> : null}
                    </span>
                    <span className="scr-ava">
                      {photo ? <img src={resolvePhoto(photo)} alt="" /> : getInitial(c.name)}
                    </span>
                  </>
                );
              })()}
              <strong className="scr-name">{String(c.name || 'Creator').replace('@', '')}</strong>
              {c.public_creator_id && <span className="scr-id">ID: {c.public_creator_id}</span>}
              {c.location && <span className="scr-loc"><MapPin size={13} /> {c.location}</span>}
              <div className="scr-meta">
                {c.category && <span className="scr-tag">{c.category}</span>}
                {c.price && <span className="scr-price">{c.price}</span>}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No saved creators yet"
          message="Tap the bookmark on any creator's profile to save them here for later."
          action={{ label: 'Browse Creators', onClick: () => navigate('/dashboard/business/browse-creator') }}
        />
      )}

      <style>{`
        .scr-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 18px; }
        .scr-card { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 6px;
          padding: 0 20px 22px; border-radius: 18px; background: #fff; border: 1px solid #eceefb; overflow: hidden;
          box-shadow: 0 14px 34px -20px rgba(15,22,58,.28); cursor: pointer; transition: .18s; }
        .scr-card:hover { transform: translateY(-3px); border-color: #d6dbff; box-shadow: 0 22px 44px -22px rgba(15,22,58,.4); }
        .scr-save { position: absolute; top: 14px; right: 14px; width: 34px; height: 34px; border-radius: 50%; z-index: 2;
          border: 1px solid rgba(255,255,255,.75); background: rgba(255,255,255,.92); color: #4452f0; cursor: pointer; display: grid; place-items: center; }
        .scr-save:hover { background: #fff; }
        .scr-banner { display: block; width: calc(100% + 40px); margin: 0 -20px; height: 78px; overflow: hidden;
          background: linear-gradient(120deg,#5b6bff,#23236a); }
        .scr-banner img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .scr-ava { width: 62px; height: 62px; border-radius: 50%; overflow: hidden; display: grid; place-items: center;
          background: linear-gradient(135deg,#5b6bff,#4452f0); color: #fff; font-weight: 800; font-size: 22px;
          margin: -32px 0 8px; border: 3px solid #fff; box-sizing: border-box; }
        .scr-ava img { width: 100%; height: 100%; object-fit: cover; }
        .scr-name { font-family: var(--font-head,'Plus Jakarta Sans',sans-serif); font-size: 17px; color: #15163a; }
        .scr-id { font-size: 11.5px; color: #9296ba; font-weight: 600; }
        .scr-loc { display: inline-flex; align-items: center; gap: 4px; font-size: 12.5px; color: #6b6f9c; }
        .scr-meta { display: flex; align-items: center; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
        .scr-tag { background: #eef0ff; color: #4452f0; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 20px; }
        .scr-price { font-size: 13px; font-weight: 800; color: #15163a; }
      `}</style>
    </BrandTopNavLayout>
  );
}
