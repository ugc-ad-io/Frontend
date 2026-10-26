import { useLayoutEffect } from 'react';
import { APP_UI } from '../../utils/appMode';

// Platform behaviour of the installed app, shared by every <AppShell>:
//  - html.ugc-shell   while a shell is mounted: the document never scrolls, .ap-body is the only scroller (app-platform.css)
//  - html.ugc-kb      a text field is focused or the on-screen keyboard is open: screens may collapse heroes (auth.css)
//  - html.ugc-kbd     the viewport really shrank (keyboard is covering part of the screen): tabs are hidden
//  - --ap-vh / --ap-vt  visible height / offset while the keyboard is open, so the shell tracks the area above the
//                       keyboard on iOS (where the keyboard overlays the layout viewport) instead of being panned away.
const TEXT_FIELD = 'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]):not([type=reset]):not([type=range]):not([type=file]):not([type=color]):not([type=image]):not([type=hidden]), textarea, [contenteditable=""], [contenteditable="true"]';
const KEYBOARD_MIN = 120; // px the viewport must shrink to count as "keyboard open" (iOS shortcut bars are ~50)

let shells = 0;
let installed = false;

function install() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const root = document.documentElement;
  const vv = window.visualViewport;
  let base = 0;
  let lastW = 0;
  let focused = false;
  let timer = 0;

  const measure = () => {
    const h = Math.round(vv ? vv.height : window.innerHeight);
    if (window.innerWidth !== lastW) { lastW = window.innerWidth; base = 0; } // rotation / window resize
    // With no field focused the current height IS the baseline, so a resized window never looks like a keyboard.
    base = focused ? Math.max(base, h) : Math.max(h, window.innerHeight);
    const shrunk = focused && base - h > KEYBOARD_MIN;
    root.classList.toggle('ugc-kb', focused || shrunk);
    root.classList.toggle('ugc-kbd', shrunk);
    if (shrunk) {
      root.style.setProperty('--ap-vh', `${h}px`);
      root.style.setProperty('--ap-vt', `${Math.round(vv ? vv.offsetTop : 0)}px`);
    } else {
      root.style.removeProperty('--ap-vh');
      root.style.removeProperty('--ap-vt');
    }
  };

  document.addEventListener('focusin', (e) => {
    if (e.target && e.target.matches && e.target.matches(TEXT_FIELD)) { focused = true; clearTimeout(timer); measure(); }
  });
  document.addEventListener('focusout', () => {
    clearTimeout(timer);
    // Moving from one field to the next fires focusout then focusin: wait so the hero does not flicker.
    timer = setTimeout(() => { const a = document.activeElement; focused = !!(a && a.matches && a.matches(TEXT_FIELD)); measure(); }, 80);
  });
  window.addEventListener('resize', measure);
  window.addEventListener('orientationchange', () => { base = 0; setTimeout(measure, 120); });
  if (vv) { vv.addEventListener('resize', measure); vv.addEventListener('scroll', measure); }
  // The document must never scroll (iOS/Android pan it to reveal a focused field): snap back, only .ap-body scrolls.
  window.addEventListener('scroll', () => { if (shells && (window.scrollX || window.scrollY)) window.scrollTo(0, 0); }, { passive: true });
  measure();
}

// Call once in <AppShell>. Marks the document as "app shell mode" while any shell is mounted.
export function useAppPlatform() {
  useLayoutEffect(() => {
    if (!APP_UI) return undefined;
    const root = document.documentElement;
    shells += 1;
    root.classList.add('ugc-shell');
    install();
    return () => {
      shells -= 1;
      if (!shells) root.classList.remove('ugc-shell', 'ugc-kb', 'ugc-kbd');
    };
  }, []);
}
