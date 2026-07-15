import { useState } from 'react';
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

  const submit = async () => {
    setBusy(true);
    try {
      await onSubmit({ rating, review: review.trim() });
    } finally {
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
        .rvm-overlay{position:fixed;inset:0;z-index:1200;background:rgba(15,22,58,.5);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;padding:24px}
        .rvm-card{position:relative;width:min(440px,100%);background:#fff;border-radius:20px;padding:26px 24px 22px;box-shadow:0 30px 70px rgba(15,22,58,.42);animation:rvm-pop .2s ease}
        @keyframes rvm-pop{from{transform:translateY(12px) scale(.98);opacity:0}to{transform:none;opacity:1}}
        .rvm-x{position:absolute;top:14px;right:14px;width:32px;height:32px;border:none;border-radius:9px;background:#f1f3fa;color:#15163a;cursor:pointer;display:grid;place-items:center}
        .rvm-x:hover{background:#e7eaf5}
        .rvm-card h3{margin:0 0 4px;font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:19px;color:#15163a}
        .rvm-sub{margin:0 0 16px;color:#6b7094;font-size:13.5px}
        .rvm-stars{display:flex;gap:6px;justify-content:center;margin:8px 0 18px}
        .rvm-star{background:none;border:none;cursor:pointer;padding:2px;line-height:0}
        .rvm-text{width:100%;border:1px solid #e6e8f3;border-radius:12px;padding:12px 14px;font:inherit;font-size:14px;color:#15163a;resize:vertical;outline:none}
        .rvm-text:focus{border-color:#5b6bff;box-shadow:0 0 0 3px rgba(91,107,255,.14)}
        .rvm-actions{display:flex;gap:10px;margin-top:16px}
        .rvm-ghost,.rvm-submit{flex:1;height:46px;border-radius:12px;font:inherit;font-weight:700;font-size:14px;cursor:pointer;border:1px solid transparent}
        .rvm-ghost{background:#fff;border-color:#e9ebf4;color:#15163a}
        .rvm-ghost:hover{border-color:#d3d7f0}
        .rvm-submit{background:#12124f;color:#fff}
        .rvm-submit:hover:not(:disabled){background:#07074e}
        .rvm-submit:disabled,.rvm-ghost:disabled{opacity:.55;cursor:not-allowed}
      `}</style>
    </div>
  );
}
