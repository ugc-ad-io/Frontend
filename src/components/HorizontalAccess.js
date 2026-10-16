import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

// Keep horizontal scrolling reachable while the bottom of a long table is offscreen.
export default function HorizontalAccess() {
  const { pathname } = useLocation();
  const [target, setTarget] = useState(null);
  const [position, setPosition] = useState(0);
  const [maximum, setMaximum] = useState(0);
  useEffect(() => {
    if (!pathname.startsWith('/dashboard/admin')) return;
    let active;
    const candidates = () => {
      const found = new Set();
      document.querySelectorAll('table, [class*="filter"], [class*="scroll"], .bc-cats, .bc-grid').forEach(node => {
        for (let element = node; element && element !== document.body; element = element.parentElement) {
          const box = element.getBoundingClientRect();
          if (box.bottom <= 0 || box.top >= window.innerHeight || box.width <= 0) continue;
          if (element.scrollWidth > element.clientWidth + 4 && /auto|scroll/.test(getComputedStyle(element).overflowX)) found.add(element);
        }
      });
      return [...found];
    };
    const scan = () => {
      // A background table must not expose its floating controls over an open panel.
      const panelOpen = [...document.querySelectorAll(
        '[role="dialog"], [aria-modal="true"], [class*="overlay"], [class*="backdrop"], [class*="scrim"], [class*="drawer"], [class*="popup"], .admin-sidebar.is-open, .hsr.is-open'
      )].some(element => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return !element.closest('[hidden], [aria-hidden="true"][data-state="closed"]')
          && style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0
          && box.width > 0 && box.height > 0
          && box.bottom > 0 && box.top < window.innerHeight && box.right > 0 && box.left < window.innerWidth
          && (style.position === 'fixed' || element.matches('[role="dialog"], [aria-modal="true"]'));
      });
      const available = panelOpen ? [] : candidates();
      if (!available.includes(active)) active = available[0];
      setTarget(active || null);
      setPosition(active?.scrollLeft || 0);
      setMaximum(active ? active.scrollWidth - active.clientWidth : 0);
    };
    const choose = event => {
      const match = candidates().find(element => element.contains(event.target));
      if (match) active = match;
      scan();
    };
    scan();
    // Respond immediately to panels mounting, closing, or toggling visibility.
    let frame;
    const observer = new MutationObserver(records => {
      if (records.every(record => record.target instanceof Element && record.target.closest('.horizontal-access'))) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(scan);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true,
      attributeFilter: ['class', 'style', 'hidden', 'open', 'aria-hidden', 'data-state'] });
    const timer = setInterval(scan, 1000);
    window.addEventListener('resize', scan);
    document.addEventListener('scroll', scan, true);
    document.addEventListener('pointerover', choose);
    return () => {
      clearInterval(timer);
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', scan);
      document.removeEventListener('scroll', scan, true);
      document.removeEventListener('pointerover', choose);
    };
  }, [pathname]);
  if (!pathname.startsWith('/dashboard/admin') || !target || !maximum) return null;
  const move = value => { target.scrollLeft = value; setPosition(target.scrollLeft); };
  return <div className="horizontal-access" aria-label="Horizontal scrolling" style={{ position: 'fixed', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 1200, display: 'flex', alignItems: 'center', gap: 12, maxWidth: 'calc(100vw - 32px)', padding: '10px 14px', borderRadius: 12, background: '#fff', border: '1px solid #dfe3ee', boxShadow: '0 4px 20px #0002' }}>
    <button type="button" aria-label="Scroll left" onClick={() => move(position - 240)}>←</button>
    <input aria-label="Scroll table or filters horizontally" type="range" min="0" max={maximum} value={position} onChange={event => move(Number(event.target.value))} style={{ width: 'min(260px, 50vw)' }} />
    <button type="button" aria-label="Scroll right" onClick={() => move(position + 240)}>→</button>
  </div>;
}
