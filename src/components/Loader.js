import React from 'react';
import '../styles/brand-ui-states.css';
import '../styles/brand-ui-mobile-b.css';

/**
 * App-wide loading indicator: the four interlocking clips of the UGCad mark light up in turn.
 *
 *  <Loader />                         full-screen navy app loader (route / app loads)
 *  <Loader fullscreen={false} />      light inline loader, centred in its container (panels, cards)
 *  <Loader size={64} label="…" />     custom mark size (inline) + optional caption
 */
export default function Loader({ fullscreen = true, size = 120, label }) {
  const clips = (h, white) => (
    <div className={`bui-clips${white ? ' bui-clips--white' : ''}`} style={{ '--h': `${h}px` }} aria-hidden="true">
      {[0, 1, 2, 3].map((i) => <span key={i} className="bui-clip" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/ugcad-logo.png)` }} />)}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="bui-load-app" role="status" aria-live="polite" aria-label={label || 'Loading'}>
        {clips(54, true)}
        <div className="bui-load-word"><b>UGC</b>ad.io</div>
        <div className="bui-load-label">{label || 'Getting your dashboard ready…'}</div>
      </div>
    );
  }

  return (
    <div className="bui-load-page" role="status" aria-live="polite" aria-label={label || 'Loading'}>
      {clips(Math.max(24, Math.round(size * 0.37)), false)}
      <div className="bui-load-label">{label || 'Loading…'}</div>
      <div className="bui-load-bar" aria-hidden="true"><span /></div>
    </div>
  );
}
