import { useState, useEffect, useRef } from 'react';
import { Mail, MessageCircle, Phone, LifeBuoy, X } from 'lucide-react';
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
    <div className="csf" ref={wrapRef}>
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

      <style>{`
        .csf{position:fixed;right:24px;bottom:24px;z-index:1200;display:flex;flex-direction:column;align-items:flex-end;gap:12px}
        .csf-btn{display:inline-flex;align-items:center;gap:9px;padding:13px 20px;border:none;border-radius:999px;cursor:pointer;
          font:inherit;font-weight:700;font-size:14px;color:#fff;background:#5b6bff;
          box-shadow:0 12px 30px -8px rgba(91,107,255,.7);transition:transform .15s,background .15s}
        .csf-btn:hover{background:#4452f0;transform:translateY(-1px)}
        .csf-btn.is-open{background:#3a3a55}
        .csf-panel{width:300px;padding:16px;border-radius:16px;background:#141420;border:1px solid rgba(255,255,255,.1);
          box-shadow:0 24px 60px rgba(0,0,0,.55);animation:csf-pop .18s ease}
        @keyframes csf-pop{from{transform:translateY(8px);opacity:0}to{transform:none;opacity:1}}
        .csf-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:2px}
        .csf-head strong{color:#f4f4f8;font-size:15px}
        .csf-x{width:26px;height:26px;display:grid;place-items:center;border:none;border-radius:8px;cursor:pointer;
          background:rgba(255,255,255,.06);color:#9b9bb0}
        .csf-x:hover{background:rgba(255,255,255,.12);color:#f4f4f8}
        .csf-sub{margin:0 0 12px;color:#9b9bb0;font-size:12.5px;line-height:1.5}
        .csf-row{display:flex;align-items:center;gap:10px;padding:10px 12px;margin-top:8px;border-radius:11px;text-decoration:none;
          background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);transition:background .15s,border-color .15s}
        .csf-row:hover{background:rgba(255,255,255,.09);border-color:rgba(139,151,255,.45)}
        .csf-row--primary{background:rgba(91,107,255,.14);border-color:rgba(91,107,255,.45)}
        .csf-row--primary:hover{background:rgba(91,107,255,.24)}
        .csf-ic{display:grid;place-items:center;width:32px;height:32px;flex:0 0 32px;border-radius:9px;background:rgba(255,255,255,.06);color:#a8b0ff}
        .csf-txt{display:flex;flex-direction:column;line-height:1.3;min-width:0}
        .csf-txt strong{color:#f4f4f8;font-size:13.5px;font-weight:600}
        .csf-txt small{color:#9b9bb0;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        @media (max-width:600px){
          .csf{right:16px;bottom:16px}
          .csf-panel{width:min(300px,calc(100vw - 32px))}
          .csf-btn span{display:none}
          .csf-btn{padding:14px;border-radius:50%}
        }
      `}</style>
    </div>
  );
}
