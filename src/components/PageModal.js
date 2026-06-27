import { useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * Full-screen overlay that renders a page component in-place (no route change).
 * Pass the page as children; closing returns to whatever was behind it.
 */
export default function PageModal({ onClose, children, maxWidth = 1100 }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div className="pm-overlay" onClick={onClose}>
      <div className="pm-modal" style={{ maxWidth }} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="pm-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
        <div className="pm-body">{children}</div>
      </div>
    </div>
  );
}
