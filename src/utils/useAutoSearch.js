import { useEffect, useRef } from 'react';

/**
 * Search boxes should not need the Enter key: once the user pauses typing, call `commit(value)`
 * (trimmed). `committed` is whatever the page already searched for, so nothing runs when the
 * box already matches it (and a page reload from the URL cannot loop).
 */
export default function useAutoSearch(value, committed, commit, delay = 300) {
  const latest = useRef(commit);
  latest.current = commit;
  useEffect(() => {
    const v = String(value || '').trim();
    if (v === String(committed || '').trim()) return undefined;
    const t = setTimeout(() => latest.current(v), delay);
    return () => clearTimeout(t);
  }, [value, committed, delay]);
}

/**
 * Typing in a header search can navigate to the results page, which re-creates the input.
 * Mark that the user was typing so the new input gets focus back (and the caret at the end).
 */
const FLAG = 'ugcad_search_focus';
export function markSearchFocus() {
  try { sessionStorage.setItem(FLAG, '1'); } catch { /* storage blocked: focus is simply not restored */ }
}
export function takeSearchFocus(el) {
  try {
    if (sessionStorage.getItem(FLAG) !== '1') return;
    sessionStorage.removeItem(FLAG);
  } catch { return; }
  if (!el) return;
  el.focus();
  const n = (el.value || '').length;
  try { el.setSelectionRange(n, n); } catch { /* some input types refuse selection */ }
}
