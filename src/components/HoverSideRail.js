import { useState, useEffect } from 'react';
import { X, LifeBuoy, Mail, Phone, MessageCircle } from 'lucide-react';
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_IS_PLACEHOLDER } from './ContactSupportBox';

// Any page opens the "Need help?" dialog with openHelpDialog(). The dialog used to live
// inside the old side rail; when the rail was removed nothing listened any more, so
// "Talk to our team", "Need help?", "How it works" and "Contact UGCad" all did nothing.
// HelpDialogHost (below) is mounted once in App.js and owns the dialog now.
export const HELP_EVENT = 'ugcad:open-help';
export const openHelpDialog = () => window.dispatchEvent(new Event(HELP_EVENT));

export default function HelpDialogHost() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener(HELP_EVENT, onOpen);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener(HELP_EVENT, onOpen); window.removeEventListener('keydown', onKey); };
  }, []);
  if (!open) return null;
  const digits = SUPPORT_PHONE.replace(/[^0-9]/g, '');
  return (
    <div className="hsr-help-overlay" onClick={() => setOpen(false)}>
      <div className="hsr-help-card" role="dialog" aria-modal="true" aria-label="Need help?" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="hsr-help-x" onClick={() => setOpen(false)} aria-label="Close"><X size={18} /></button>
        <div className="hsr-help-head">
          <span className="hsr-help-badge"><LifeBuoy size={22} /></span>
          <div><strong>Need help?</strong><small>Our team is here for you.</small></div>
        </div>
        <a className="hsr-help-row" href={`mailto:${SUPPORT_EMAIL}`}>
          <span className="hsr-help-ic"><Mail size={18} /></span>
          <div><label>Email us</label><span>{SUPPORT_EMAIL}</span></div>
        </a>
        {/* Phone rows stay hidden until the team's real number replaces the placeholder in ContactSupportBox.js. */}
        {!SUPPORT_PHONE_IS_PLACEHOLDER && (
          <>
            <a className="hsr-help-row" href={`tel:${SUPPORT_PHONE}`}>
              <span className="hsr-help-ic"><Phone size={18} /></span>
              <div><label>Call us</label><span>{SUPPORT_PHONE_DISPLAY}</span></div>
            </a>
            <a className="hsr-help-row" href={`https://wa.me/${digits}`} target="_blank" rel="noreferrer">
              <span className="hsr-help-ic"><MessageCircle size={18} /></span>
              <div><label>WhatsApp</label><span>Chat with support</span></div>
            </a>
          </>
        )}
        <p className="hsr-help-note">Support hours: Mon–Fri, 10:00 AM – 7:00 PM IST</p>
      </div>
      <style>{`
        .hsr-help-overlay{position:fixed;inset:0;z-index:1400;background:rgba(15,22,58,.5);backdrop-filter:blur(4px);
          display:flex;align-items:center;justify-content:center;
          padding:max(20px,env(safe-area-inset-top)) max(20px,env(safe-area-inset-right)) max(20px,env(safe-area-inset-bottom)) max(20px,env(safe-area-inset-left))}
        .hsr-help-card{position:relative;width:min(420px,100%);max-height:100%;overflow-y:auto;background:#fff;border-radius:20px;padding:24px;
          box-shadow:0 30px 70px -20px rgba(15,22,58,.5);animation:hsrHelpIn .2s ease;font-family:'Inter',system-ui,sans-serif}
        @keyframes hsrHelpIn{from{transform:translateY(8px);opacity:.6}to{transform:none;opacity:1}}
        .hsr-help-x{position:absolute;top:10px;right:10px;width:44px;height:44px;border:none;background:#f1f3fa;color:#15163a;
          border-radius:10px;cursor:pointer;display:grid;place-items:center}
        .hsr-help-x:hover{background:#e7eaf5}
        .hsr-help-head{display:flex;align-items:center;gap:13px;margin-bottom:18px;padding-right:44px}
        .hsr-help-badge{width:46px;height:46px;flex:none;border-radius:14px;display:grid;place-items:center;color:#fff;
          background:linear-gradient(135deg,#5b6bff,#6d7bff)}
        .hsr-help-head strong{display:block;font-size:18px;color:#15163a}
        .hsr-help-head small{color:#6b6f96;font-size:13px}
        .hsr-help-row{display:flex;align-items:center;gap:12px;padding:12px;border:1px solid #eef0f6;border-radius:14px;
          margin-bottom:10px;text-decoration:none;transition:.15s}
        .hsr-help-row:hover{border-color:#cdd4ff;background:#f7f8ff}
        .hsr-help-ic{width:38px;height:38px;flex:none;border-radius:11px;display:grid;place-items:center;background:#eef0ff;color:#5b6bff}
        .hsr-help-row label{display:block;color:#6b6f96;font-size:12px;font-weight:600}
        .hsr-help-row span{color:#15163a;font-size:14.5px;font-weight:700;overflow-wrap:anywhere}
        .hsr-help-row div{min-width:0}
        .hsr-help-note{margin:14px 0 0;color:#6b6f96;font-size:12.5px;text-align:center}
      `}</style>
    </div>
  );
}
