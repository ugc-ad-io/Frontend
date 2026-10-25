import { useState, useRef } from 'react';
import { Star, X } from 'lucide-react';

/**
 * Small star-rating + comment modal for leaving a review after a deal completes.
 * The caller owns the POST (so it can supply campaign_id / creator_id / business_id
 * and update its own "already reviewed" state) — this only collects rating + text.
 */
export default function ReviewModal({ title = 'Rate this creator', subtitle, onSubmit, onClose }) {
  const [rating, setRating] = useState(5);
  const [hover, setHover] = useState(0);
  const [review, setReview] = useState('');
  const [busy, setBusy] = useState(false);
  const submitLock = useRef(false);

  const submit = async () => {
    if (submitLock.current) return;
    submitLock.current = true;
    setBusy(true);
    try {
      await onSubmit({ rating, review: review.trim() });
    } finally {
      submitLock.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="rvm-overlay" onClick={() => !busy && onClose()}>
      <div className="rvm-card" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="rvm-x" aria-label="Close" onClick={onClose}><X size={18} /></button>
        <h3>{title}</h3>
        {subtitle && <p className="rvm-sub">{subtitle}</p>}

        <div className="rvm-stars" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              className="rvm-star"
              aria-label={`${n} star${n > 1 ? 's' : ''}`}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
            >
              <Star size={30} fill={(hover || rating) >= n ? '#f5b301' : 'none'} color={(hover || rating) >= n ? '#f5b301' : '#c7cbe0'} />
            </button>
          ))}
        </div>

        <textarea
          className="rvm-text"
          rows={4}
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="Share how the collaboration went (optional)…"
        />

        <div className="rvm-actions">
          <button type="button" className="rvm-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="rvm-submit" onClick={submit} disabled={busy}>
            {busy ? 'Submitting…' : 'Submit review'}
          </button>
        </div>
      </div>

      <style>{`
        .rvm-overlay{position:fixed;inset:0;z-index:1200;background:rgba(7,7,78,.45);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:24px;overflow-y:auto;overscroll-behavior:contain}
        .rvm-card{position:relative;width:min(440px,100%);background:#fff;border-radius:20px;padding:26px 24px 22px;max-height:calc(100dvh - 48px);overflow-y:auto;box-shadow:0 40px 80px -30px rgba(7,7,78,.6);font-family:'Inter',system-ui,sans-serif;color:#07074e;animation:rvm-pop .2s ease}
        @keyframes rvm-pop{from{transform:translateY(12px) scale(.98);opacity:0}to{transform:none;opacity:1}}
        .rvm-x{position:absolute;top:14px;right:14px;width:32px;height:32px;border:none;border-radius:9px;background:#f6f6fd;color:#07074e;cursor:pointer;display:grid;place-items:center}
        .rvm-x:hover{background:#eef0ff}
        .rvm-card h3{margin:0 0 4px;font-family:'Readex Pro','Plus Jakarta Sans',sans-serif;font-weight:500;font-size:20px;color:#07074e}
        .rvm-sub{margin:0 0 16px;color:#6e6e96;font-size:13.5px}
        .rvm-stars{display:flex;gap:6px;justify-content:center;margin:8px 0 18px}
        .rvm-star{background:none;border:none;cursor:pointer;padding:2px;line-height:0}
        .rvm-text{width:100%;border:1.5px solid transparent;background:#f6f6fd;border-radius:16px;padding:12px 14px;font:inherit;font-size:14px;color:#07074e;resize:vertical;outline:none}
        .rvm-text:focus{background:#fff;border-color:#7387ff;box-shadow:0 0 0 3px rgba(115,135,255,.2)}
        .rvm-actions{display:flex;gap:10px;margin-top:16px}
        .rvm-ghost,.rvm-submit{flex:1;height:48px;border-radius:999px;font:inherit;font-weight:700;font-size:14.5px;cursor:pointer;border:1px solid transparent}
        .rvm-ghost{background:#fff;border-color:#c9cbea;color:#07074e}
        .rvm-ghost:hover{background:#f3f3ff}
        .rvm-submit{background:#07074e;color:#fff}
        .rvm-submit:hover:not(:disabled){background:#12124f}
        .rvm-submit:disabled,.rvm-ghost:disabled{opacity:.55;cursor:not-allowed}
        @media (max-width:768px){
          .rvm-overlay{padding:max(12px,env(safe-area-inset-top,0px)) 12px max(12px,env(safe-area-inset-bottom,0px))}
          .rvm-card{padding:22px 18px 18px;max-height:calc(100vh - 24px);max-height:calc(100dvh - 24px)}
          .rvm-card h3{padding-right:48px}
          .rvm-x{width:44px;height:44px;top:8px;right:8px}
          .rvm-stars{gap:0}
          .rvm-star{padding:7px}
          .rvm-text{font-size:16px}
        }
      `}</style>
    </div>
  );
}
