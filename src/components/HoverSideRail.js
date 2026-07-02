import { useState } from 'react';
import { LogOut, Bell, X } from 'lucide-react';

const LOGO_SRC = '/ugcad-logo_-_Edited-removebg-preview.png';

// Persist the open/closed state across route changes — navigating remounts the
// layout, and without this the rail would snap back to collapsed every click.
let RAIL_OPEN = false;

/**
 * Collapsed icon rail on the left that expands on CLICK (toggle) to reveal
 * labels — a menu button opens/closes it (no hover). The rail styles and the
 * `.cmk-app.has-rail` content offset all live in this component's <style>. When
 * open, the page content shifts right so the expanded rail never overlaps it.
 * Includes a Notifications entry + the account block (avatar + name + role) at
 * the foot. On mobile the rail hides and nav falls back to the top-nav hamburger.
 */
export default function HoverSideRail({ brandMark = 'U', onLogoClick, primary = [], secondary = [], isActive, onNavigate, onLogout }) {
  const [open, setOpenState] = useState(RAIL_OPEN);
  const setOpen = (v) => {
    const next = typeof v === 'function' ? v(RAIL_OPEN) : v;
    RAIL_OPEN = next;
    setOpenState(next);
  };

  const Item = (l) => (
    <button key={l.name} type="button" className={`hsr-item ${isActive(l.to) ? 'is-active' : ''}`} onClick={() => { if (open) onNavigate(l.to); }}>
      <span className="hsr-ic"><l.icon size={20} />{l.dot && <i className="hsr-dot" />}</span>
      <span className="hsr-label">{l.name}</span>
    </button>
  );

  return (
    // collapsed: a click anywhere on the rail opens it (icons navigate only once
    // open); open: clicks fall through to the individual buttons.
    <aside
      className={`hsr ${open ? 'is-open' : ''}`}
      aria-label="Sidebar"
      onClick={open ? undefined : () => setOpen(true)}
    >
      {open && (
        <button type="button" className="hsr-close" onClick={() => setOpen(false)} aria-label="Collapse sidebar">
          <X size={18} />
        </button>
      )}
      <div className="hsr-top">
        {/* the logo shows when collapsed (click to open); when open it also shows
            the "UGCad.io" wordmark and a click navigates home */}
        <button type="button" className="hsr-brand" onClick={() => (open ? onLogoClick() : setOpen(true))} aria-label="UGCad.io">
          <span className="hsr-mark"><img src={LOGO_SRC} alt="UGCad.io" /></span>
          <span className="hsr-label hsr-brand-txt">UGC<span className="hsr-brand-ad">ad.io</span></span>
        </button>
      </div>

      <div className="hsr-sep hsr-sep-logo" />

      <nav className="hsr-nav">
        {primary.map(Item)}
        {secondary.length > 0 && <div className="hsr-sep" />}
        {secondary.map(Item)}
      </nav>

      <button type="button" className="hsr-item hsr-notif" onClick={() => { if (open) onNavigate('/messages'); }}>
        <span className="hsr-ic"><Bell size={20} /></span>
        <span className="hsr-label">Notifications</span>
      </button>

      <button type="button" className="hsr-item hsr-logout" onClick={() => { if (open) onLogout(); }}>
        <span className="hsr-ic"><LogOut size={20} /></span>
        <span className="hsr-label">Log out</span>
      </button>

      <style>{`
        .hsr{position:fixed;left:0;top:0;bottom:0;width:76px;z-index:120;display:flex;flex-direction:column;
          background:#fff;color:#15163a;padding:14px;border-right:1px solid #eef0f6;
          overflow:hidden;transition:width .22s cubic-bezier(.2,.7,.2,1);box-shadow:6px 0 34px -18px rgba(15,22,58,.3)}
        .hsr.is-open{width:240px}
        /* collapsed rail is one big click target — hint it's clickable to open */
        .hsr:not(.is-open){cursor:pointer}
        /* height set so the divider below lines up with the top nav's bottom
           border (rail padding-top 14 + this 58 = 72 = the header height) */
        .hsr-top{display:flex;align-items:center;gap:6px;height:58px;padding-bottom:0;box-sizing:border-box}
        /* close (collapse) button in the top-right corner, only when open */
        .hsr-close{position:absolute;top:3px;right:3px;z-index:3;width:34px;height:34px;border:none;background:none;
          cursor:pointer;color:#585c7e;border-radius:10px;display:grid;place-items:center;transition:background .15s,color .15s}
        .hsr-close:hover{background:#f2f3fb;color:#15163a}
        .hsr-brand{display:flex;align-items:center;gap:12px;background:none;border:none;cursor:pointer;color:#15163a;
          padding:0 0 0 8px;white-space:nowrap;min-width:0}
        .hsr-mark{width:44px;height:44px;flex:none;display:grid;place-items:center}
        .hsr-mark img{width:100%;height:100%;object-fit:contain;display:block}
        /* wordmark colours match the official logo: "UGC" periwinkle, "ad.io" navy */
        .hsr-brand-txt{font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-weight:800;font-size:19px;color:#5b6bff;letter-spacing:-.2px}
        .hsr-brand-ad{color:#07074e}
        .hsr-nav{flex:1;display:flex;flex-direction:column;gap:4px;overflow-y:auto;overflow-x:hidden;scrollbar-width:none}
        .hsr-nav::-webkit-scrollbar{display:none}
        .hsr-item{display:flex;align-items:center;gap:12px;width:100%;height:48px;padding:0 6px;border:none;background:none;
          color:#585c7e;font-family:inherit;font-weight:600;font-size:14.5px;cursor:pointer;border-radius:14px;
          white-space:nowrap;transition:background .15s,color .15s}
        .hsr-item:hover{background:#f2f3fb;color:#15163a}
        .hsr-item.is-active{background:linear-gradient(100deg,#23236a,#12124f);color:#fff;font-weight:700}
        .hsr-item.is-active .hsr-ic svg{color:#fff}
        .hsr-ic{position:relative;width:44px;flex:none;display:grid;place-items:center}
        .hsr-dot{position:absolute;top:9px;right:11px;width:7px;height:7px;border-radius:50%;background:#5b6bff}
        .hsr-item.is-active .hsr-dot{background:#fff}
        .hsr-label{opacity:0;transform:translateX(-6px);transition:opacity .18s,transform .18s;
          flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;text-align:left}
        .hsr.is-open .hsr-label{opacity:1;transform:none}
        .hsr-sep{height:1px;background:#eef0f6;margin:9px 10px}
        /* divider spans the full rail width (negative margins cancel the rail's
           14px padding) so it meets the top nav's bottom border in one line */
        .hsr-sep-logo{margin:0 -14px 10px}
        .hsr-notif{margin-top:4px}
        .hsr-logout{margin-top:6px;color:#585c7e}

        /* Collapsed rail = 76px offset, so content sits right next to the rail
           (no big empty gap). When toggled OPEN the left padding animates to
           240px: the content smoothly shifts right AND its width adjusts to the
           remaining space — so it never runs off-screen, and the transition
           makes the resize look seamless. */
        .cmk-app.has-rail{padding-left:76px;transition:padding-left .22s cubic-bezier(.2,.7,.2,1)}
        .cmk-app.has-rail:has(.hsr.is-open){padding-left:240px}
        .cmk-app.has-rail .cmk-links{display:none}
        .cmk-app.has-rail .cmk-brand{display:none}
        /* the rail is the nav on desktop/tablet — drop the click hamburger */
        .cmk-app.has-rail .cmk-hamburger,
        .cmk-app.has-rail .cmk-mobile-menu{display:none}
        /* left-align content beside the rail (fills the space, keeps big layout) */
        .cmk-app.has-rail .cmk-wrap{margin-left:0;margin-right:auto}
        /* the top bar spans the full width so the actions (Post a Campaign,
           bell, avatar) sit flush against the right edge, not the wrap's cap */
        .cmk-app.has-rail .cmk-nav-inner{max-width:none}
        /* shift ONLY the main body content right for breathing room from the
           rail — the header keeps its own (smaller) offset and is unaffected */
        .cmk-app.has-rail .cmk-page{padding-left:60px;transition:padding-left .22s cubic-bezier(.2,.7,.2,1)}
        /* when the rail is open it already takes the space — drop the extra body
           padding so the content shifts back left and hugs the open rail */
        .cmk-app.has-rail:has(.hsr.is-open) .cmk-page{padding-left:12px}

        @media (max-width:760px){
          .hsr{display:none}
          .cmk-app.has-rail,
          .cmk-app.has-rail:has(.hsr.is-open){padding-left:0}
          .cmk-app.has-rail .cmk-brand{display:flex}
          .cmk-app.has-rail .cmk-hamburger{display:inline-flex}
          .cmk-app.has-rail .cmk-wrap{margin-left:auto}
        }
      `}</style>
    </aside>
  );
}
