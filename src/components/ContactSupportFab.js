import { useState, useEffect, useRef } from 'react';
import { Mail, MessageCircle, Phone, LifeBuoy, X } from 'lucide-react';
import '../styles/web1-misc.css';
import { buildSupportLinks, SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY } from './ContactSupportBox';

/**
 * Floating "Contact us" button, pinned bottom-right of the rejected-application
 * screen. A rejected applicant is locked out of every in-app surface (no side
 * rail, no help card), so this is a persistent route back to a human.
 *
 * Opens a small panel with the same three channels as ContactSupportBox — the
 * links come from buildSupportLinks() so they stay pre-filled and in sync.
 */
export default function ContactSupportFab({ user }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const { mailto, whatsapp, tel } = buildSupportLinks(user);

  // Close on outside-click and on Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="w1 csf" ref={wrapRef}>
      {open && (
        <div className="csf-panel" role="dialog" aria-label="Contact support">
          <div className="csf-head">
            <strong>Contact us</strong>
            <button type="button" className="csf-x" aria-label="Close" onClick={() => setOpen(false)}>
              <X size={15} />
            </button>
          </div>
          <p className="csf-sub">Our team can re-check your application.</p>

          <a className="csf-row csf-row--primary" href={mailto}>
            <span className="csf-ic"><Mail size={16} /></span>
            <span className="csf-txt"><strong>Email support</strong><small>{SUPPORT_EMAIL}</small></span>
          </a>
          <a className="csf-row" href={whatsapp} target="_blank" rel="noreferrer">
            <span className="csf-ic"><MessageCircle size={16} /></span>
            <span className="csf-txt"><strong>WhatsApp</strong><small>Chat with support</small></span>
          </a>
          <a className="csf-row" href={tel}>
            <span className="csf-ic"><Phone size={16} /></span>
            <span className="csf-txt"><strong>Call us</strong><small>{SUPPORT_PHONE_DISPLAY}</small></span>
          </a>
        </div>
      )}

      <button
        type="button"
        className={`csf-btn${open ? ' is-open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        {open ? <X size={18} /> : <LifeBuoy size={18} />}
        <span>Contact us</span>
      </button>
    </div>
  );
}
