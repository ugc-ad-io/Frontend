import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * Back closes the admin phone overlays (full-screen details, bottom sheets, the More menu)
 * before it leaves the page, in the browser, the installed PWA and the native app's WebView.
 *
 * Opening an overlay adds one history entry for the SAME url; Back (popstate) then closes
 * the top overlay by pressing its own Back/Close control, so the page keeps its list,
 * filters and scroll. Closing an overlay on screen removes that entry again. If the page
 * itself changes while an overlay is open, nothing is popped (that would undo the navigation).
 * Inside the native app the current depth is posted so the app's Back closes overlays first.
 */
const OVERLAY = '.am-detail, .am-sheet';

function closeTopOverlay() {
  const all = document.querySelectorAll(OVERLAY);
  const top = all[all.length - 1];
  if (!top) return;
  if (top.classList.contains('am-sheet')) {
    const close = top.querySelector('.am-sheet-head button[aria-label^="Close"], .am-sheet-head button[aria-label^="Cancel"]');
    if (close) { close.click(); return; }
    const backdrops = document.querySelectorAll('.am-sheet-backdrop');
    backdrops[backdrops.length - 1]?.click();
    return;
  }
  const head = top.querySelector('.am-detail-head');
  const control = head?.querySelector('button[aria-label^="Back"], button[aria-label^="Close"], button[aria-label^="Cancel"]') || head?.querySelector('button');
  control?.click();
}

const tellApp = (depth) => {
  try { window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'ugcad-overlay', depth })); } catch { /* not in the app */ }
};

export default function OverlayBack() {
  const navigate = useNavigate();
  const location = useLocation();
  const locRef = useRef(location);
  locRef.current = location;
  const depth = useRef(0);          // overlays open that have a history entry
  const openPath = useRef(null);    // page the overlays belong to
  const closingByBack = useRef(0);  // overlays being closed because history went back
  const poppingForUi = useRef(false); // we are removing entries because the UI closed an overlay

  useEffect(() => {
    let frame = 0;
    const sync = () => {
      frame = 0;
      const open = document.querySelectorAll(OVERLAY).length;
      const here = locRef.current;
      if (open === depth.current) return;
      if (openPath.current !== null && openPath.current !== here.pathname) {
        // The page changed under the overlays: start fresh, never pop a real navigation.
        depth.current = open; closingByBack.current = 0;
        openPath.current = open ? here.pathname : null;
        tellApp(open);
        return;
      }
      if (open > depth.current) {
        openPath.current = here.pathname;
        while (depth.current < open) {
          depth.current += 1;
          navigate({ pathname: here.pathname, search: here.search, hash: here.hash },
            { state: { ...(here.state || {}), amOverlay: depth.current } });
        }
      } else {
        const closed = depth.current - open;
        depth.current = open;
        if (closingByBack.current > 0) {
          closingByBack.current = Math.max(0, closingByBack.current - closed);
        } else if ((here.state?.amOverlay || 0) > open) {
          poppingForUi.current = true;
          navigate(-closed);
        }
        if (!open) openPath.current = null;
      }
      tellApp(depth.current);
    };
    const observer = new MutationObserver(() => { if (!frame) frame = requestAnimationFrame(sync); });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, [navigate]);

  useEffect(() => {
    if (poppingForUi.current) { poppingForUi.current = false; return; }
    const entryDepth = location.state?.amOverlay || 0;
    if (entryDepth < depth.current && openPath.current === location.pathname) {
      closingByBack.current += 1;
      closeTopOverlay();
    }
  }, [location]);

  return null;
}
