import { LogOut } from 'lucide-react';

/**
 * Collapsed icon rail on the left that expands on hover to reveal labels.
 * Self-contained: the rail styles and the `.cmk-app.has-rail` content offset all
 * live in this component's <style>, so adding/removing it is a one-line change.
 * On mobile the rail hides and navigation falls back to the top-nav hamburger.
 */
export default function HoverSideRail({ brandMark = 'U', onLogoClick, primary = [], secondary = [], isActive, onNavigate, onLogout }) {
  const Item = (l) => (
    <button key={l.name} type="button" className={`hsr-item ${isActive(l.to) ? 'is-active' : ''}`} onClick={() => onNavigate(l.to)}>
      <span className="hsr-ic"><l.icon size={20} />{l.dot && <i className="hsr-dot" />}</span>
      <span className="hsr-label">{l.name}</span>
    </button>
  );

  return (
    <aside className="hsr" aria-label="Sidebar">
      <button type="button" className="hsr-brand" onClick={onLogoClick} aria-label="Home">
        <span className="hsr-mark">{brandMark}</span>
        <span className="hsr-label hsr-brand-txt">UGCad.io</span>
      </button>

      <nav className="hsr-nav">
        {primary.map(Item)}
        {secondary.length > 0 && <div className="hsr-sep" />}
        {secondary.map(Item)}
      </nav>

      <button type="button" className="hsr-item hsr-logout" onClick={onLogout}>
        <span className="hsr-ic"><LogOut size={20} /></span>
        <span className="hsr-label">Log out</span>
      </button>

      <style>{`
        .hsr{position:fixed;left:0;top:0;bottom:0;width:76px;z-index:120;display:flex;flex-direction:column;
          background:linear-gradient(180deg,#0c0c2e,#12124f 60%,#07074e);color:#fff;padding:14px;
          overflow:hidden;transition:width .22s cubic-bezier(.2,.7,.2,1);box-shadow:6px 0 40px -14px rgba(7,7,78,.55)}
        .hsr:hover{width:240px}
        .hsr-brand{display:flex;align-items:center;gap:12px;background:none;border:none;cursor:pointer;color:#fff;
          padding:4px 4px 16px;white-space:nowrap}
        .hsr-mark{width:40px;height:40px;flex:none;border-radius:12px;display:grid;place-items:center;
          background:linear-gradient(135deg,#5b6bff,#8b5cf6);color:#fff;font-weight:800;font-size:18px}
        .hsr-brand-txt{font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-weight:800;font-size:18px}
        .hsr-nav{flex:1;display:flex;flex-direction:column;gap:4px;overflow-y:auto;overflow-x:hidden;scrollbar-width:none}
        .hsr-nav::-webkit-scrollbar{display:none}
        .hsr-item{display:flex;align-items:center;gap:12px;width:100%;height:48px;padding:0 6px;border:none;background:none;
          color:rgba(255,255,255,.72);font-family:inherit;font-weight:600;font-size:14.5px;cursor:pointer;border-radius:14px;
          white-space:nowrap;transition:background .15s,color .15s}
        .hsr-item:hover{background:rgba(255,255,255,.09);color:#fff}
        .hsr-item.is-active{background:#fff;color:#12124f;font-weight:700}
        .hsr-item.is-active .hsr-ic svg{color:#5b6bff}
        .hsr-ic{position:relative;width:44px;flex:none;display:grid;place-items:center}
        .hsr-dot{position:absolute;top:9px;right:11px;width:7px;height:7px;border-radius:50%;background:#5b6bff}
        .hsr-label{opacity:0;transform:translateX(-6px);transition:opacity .18s,transform .18s;
          flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;text-align:left}
        .hsr:hover .hsr-label{opacity:1;transform:none}
        .hsr-sep{height:1px;background:rgba(255,255,255,.1);margin:9px 10px}
        .hsr-logout{margin-top:6px;color:rgba(255,255,255,.82)}

        /* offset app content for the collapsed rail; hide the now-duplicated
           top-nav primary links + brand (nav lives in the rail on desktop) */
        .cmk-app.has-rail{padding-left:76px}
        .cmk-app.has-rail .cmk-links{display:none}
        .cmk-app.has-rail .cmk-brand{display:none}

        @media (max-width:760px){
          .hsr{display:none}
          .cmk-app.has-rail{padding-left:0}
          .cmk-app.has-rail .cmk-brand{display:flex}
        }
      `}</style>
    </aside>
  );
}
