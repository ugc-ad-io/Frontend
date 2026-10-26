import { useEffect, useRef } from 'react';

// Android's back button / gesture and the browser Back close the top open overlay instead of leaving the page.
//   useAppBack(open, onClose)   call in any bottom sheet or full-screen overlay (BottomSheet already does)
//   afterSheetClosed(fn)        close the open sheet through history, then run fn (use before navigate() from a sheet)
// An open overlay adds ONE history entry for the same URL (state.ugcSheet = depth); Back pops it and closes the
// overlay. Closing from the UI pops the entry again. A leftover entry (the page navigated while a sheet was open)
// is skipped on the next Back, so the user is never stuck pressing Back on the same screen.
const stack = []; // open overlays, top = last
const depthOf = () => (window.history.state && window.history.state.ugcSheet) || 0;

let selfPop = false; // we called history.back() ourselves to drop an entry (not the user's Back)
let wired = false;
function wire() {
  if (wired) return;
  wired = true;
  window.addEventListener('popstate', () => {
    if (selfPop) {
      // Our own pop landed. If another overlay opened meanwhile (it reused the entry we just removed), restore it.
      selfPop = false;
      if (stack.length && !depthOf()) window.history.pushState({ ...window.history.state, ugcSheet: stack.length }, '');
      return;
    }
    const d = depthOf();
    while (stack.length > d) { const top = stack.pop(); top.close(); }
    if (d > stack.length) window.history.back(); // landed on a leftover marker entry: skip it
  });
}

export function useAppBack(open, onClose) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open || typeof window === 'undefined') return undefined;
    wire();
    const entry = { close: () => closeRef.current && closeRef.current() };
    const depth = stack.length + 1;
    if (depthOf() !== depth) window.history.pushState({ ...window.history.state, ugcSheet: depth }, '');
    stack.push(entry);
    return () => {
      const i = stack.indexOf(entry);
      if (i === -1) return; // closed by Back: the entry is already gone
      stack.splice(i, 1);
      // Closed from the UI: drop our entry, unless the page navigated meanwhile (then Back would pop the new page).
      setTimeout(() => { if (depthOf() > stack.length) { selfPop = true; window.history.back(); } }, 0);
    };
  }, [open]);
}

export function afterSheetClosed(fn) {
  if (typeof window !== 'undefined' && depthOf() > 0) {
    window.addEventListener('popstate', () => fn(), { once: true });
    window.history.back();
  } else fn();
}
