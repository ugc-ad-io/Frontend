import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useAppBack } from './useAppBack';
import './app-shell.css';
import './app-platform.css';

/**
 * Bottom sheet used for every phone pop-up (design board M8 / CM5): backdrop, grabber, title, scrolling body.
 *   <BottomSheet open onClose title footer={<button/>}>...</BottomSheet>
 * `footer` is pinned under the scrolling body (primary action). Esc / backdrop tap close it.
 */
export default function BottomSheet({ open, onClose, title, subtitle, footer, children, tall = false }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  useAppBack(open, onClose); // Android/browser Back closes the sheet instead of leaving the page
  if (!open) return null;
  return createPortal(
    <div className="ap-sheet-ov" onClick={onClose}>
      <div className={`ap-sheet${tall ? ' ap-sheet--tall' : ''}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <span className="ap-sheet-grab" aria-hidden="true" />
        {(title || subtitle) && (
          <div className="ap-sheet-h">
            <div>
              {title ? <h2>{title}</h2> : null}
              {subtitle ? <p>{subtitle}</p> : null}
            </div>
            <button type="button" className="ap-bar-btn" aria-label="Close" onClick={onClose}><X size={20} /></button>
          </div>
        )}
        <div className="ap-sheet-b">{children}</div>
        {footer ? <div className="ap-sheet-f">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
