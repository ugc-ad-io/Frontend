import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Full-screen overlay that renders a page component in-place (no route change).
 * Pass the page as children; closing returns to whatever was behind it.
 */
export default function PageModal({ onClose, children, maxWidth = 1100, bare = false }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div className="pm-overlay" onClick={onClose}>
      {/* bare = transparent host: the embedded page already has its own card, so we
          don't wrap it in a second one (avoids the card-in-card look). */}
      <div className={`pm-modal ${bare ? 'pm-bare' : ''}`} style={{ maxWidth }} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="pm-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <div className="pm-body">{children}</div>
      </div>
    </div>
  );
}
