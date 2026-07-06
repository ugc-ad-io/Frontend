import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Bookmark, Clock, Star } from 'lucide-react';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import '../styles/creator-marketplace.css';
import EmptyState from '../components/EmptyState';
import { getSavedBriefs, toggleSavedBrief } from '../utils/savedBriefs';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const getInitial = (name) => (name || 'B').trim().charAt(0).toUpperCase();

// Same niche→colour mapping the browse page uses, so tags read consistently.
const CAT_MAP = [
  [/beauty|skin|makeup|cosmet/i, 'c-beauty'],
  [/tech|gadget|electronic|app|software/i, 'c-tech'],
  [/fashion|apparel|cloth|style|jewel/i, 'c-fashion'],
  [/life ?style|home|decor|interior/i, 'c-lifestyle'],
  [/food|snack|beverage|drink|recipe|cook/i, 'c-food'],
  [/fit|gym|health|wellness|yoga|sport/i, 'c-fitness'],
  [/travel|trip|tour|hotel|destination/i, 'c-travel'],
  [/game|gaming|esport/i, 'c-gaming'],
  [/finance|fintech|bank|invest|money/i, 'c-finance'],
];
const catClass = (tag) => (CAT_MAP.find(([re]) => re.test(String(tag || '')))?.[1]) || 'c-default';

export default function SavedBriefs() {
  const navigate = useNavigate();
  const [saved, setSaved] = useState(() => getSavedBriefs());

  // Reflect saves/removes made here or on the Browse page.
  useEffect(() => {
    const sync = () => setSaved(getSavedBriefs());
    window.addEventListener('ugc-saved-changed', sync);
    return () => window.removeEventListener('ugc-saved-changed', sync);
  }, []);

  const unsave = (e, brief) => {
    e.stopPropagation();
    toggleSavedBrief(brief);
    toast.success('Removed from saved');
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
              className="cmk-bb-card cmk-rise"
              onClick={() => b.id ? navigate(`/browse-briefs?open=${b.id}`) : toast.error('This brief is unavailable')}
            >
              <div className="cmk-bb-top">
                <span className="cmk-bb-logo">
                  {b.logo ? <img src={b.logo.startsWith('http') ? b.logo : `${BACKEND_URL}${b.logo}`} alt="" /> : getInitial(b.brand)}
                </span>
                <strong className="cmk-bb-brand">{b.brand}</strong>
                <button
                  type="button"
                  className="cmk-bb-save is-saved"
                  style={{ color: '#5b6bff' }}
                  onClick={(e) => unsave(e, b)}
                  aria-label="Remove from saved"
                >
                  <Bookmark size={16} fill="currentColor" />
                </button>
              </div>
              <h3 className="cmk-bb-title">{b.title}</h3>
              <div className="cmk-bb-tags">
                {(b.tags || []).map((t) => <span key={t} className={catClass(t)}>{t}</span>)}
              </div>
              <p className="cmk-bb-desc">{b.description}</p>
              <div className="cmk-bb-meta">
                <strong>{b.budget}</strong>
                <span><Clock size={14} /> {b.deliveryLabel}</span>
              </div>
              <div className="cmk-bb-match"><Star size={13} /> {b.matchScore}% Match</div>
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
    </CreatorTopNavLayout>
  );
}
