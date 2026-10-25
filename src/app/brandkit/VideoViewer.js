import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import './reel.css';

/**
 * Full-size player with next / previous.
 *   items: [{ src, name, sub, image?, watermark? }]  index / onIndex   onClose   onBrief (optional action pill)
 */
export default function VideoViewer({ items, index = 0, onIndex, onClose, onBrief, briefLabel = 'Send a brief' }) {
  const n = items.length;
  const it = items[Math.min(index, n - 1)];
  useEffect(() => {
    const key = (e) => {
      if (e.key === 'Escape') onClose();
      if (n > 1 && e.key === 'ArrowLeft') onIndex?.((index - 1 + n) % n);
      if (n > 1 && e.key === 'ArrowRight') onIndex?.((index + 1) % n);
    };
    document.addEventListener('keydown', key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = prev; };
  }, [index, n, onClose, onIndex]);
  if (!it) return null;
  return createPortal(
    <div className="ap-vv" role="dialog" aria-modal="true" aria-label={`${it.name || 'Creator'} video`}>
      <div className="ap-vv-top">
        <div>
          <b>{it.name}</b>
          <small>{[n > 1 ? `${index + 1} of ${n}` : '', it.sub].filter(Boolean).join(' · ')}</small>
        </div>
        <button type="button" className="ap-vv-btn" aria-label="Close" onClick={onClose}><X size={22} /></button>
      </div>
      <div className="ap-vv-stage">
        {it.image
          ? <img src={it.src} alt="" />
          : <video key={it.src} src={it.src} controls autoPlay playsInline />}
        {it.watermark && (
          <div className="ap-vv-wm" aria-hidden="true"><img src={`${process.env.PUBLIC_URL || ''}/watermark.jpeg`} alt="" /><span>UGCAD.io</span></div>
        )}
        {n > 1 && (
          <>
            <button type="button" className="ap-vv-btn ap-vv-nav ap-vv-nav--l" aria-label="Previous video" onClick={() => onIndex?.((index - 1 + n) % n)}><ChevronLeft size={22} /></button>
            <button type="button" className="ap-vv-btn ap-vv-nav ap-vv-nav--r" aria-label="Next video" onClick={() => onIndex?.((index + 1) % n)}><ChevronRight size={22} /></button>
          </>
        )}
      </div>
      {onBrief && (
        <div className="ap-vv-bot"><button type="button" className="ap-btn ap-btn--light" onClick={onBrief}>{briefLabel}</button></div>
      )}
    </div>,
    document.body,
  );
}
