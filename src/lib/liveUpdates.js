import { useEffect, useRef } from 'react';

const listeners = new Set();
const dirtyForms = new Set();
const hasDirtyForm = () => {
  for (const form of dirtyForms) if (!form.isConnected) dirtyForms.delete(form);
  return dirtyForms.size > 0;
};
export const publishLiveUpdate = () => listeners.forEach(listener => listener());

// Refresh data effects without remounting the page or clearing draft input.
export function useLiveEffect(effect, dependencies) {
  const latest = useRef(effect);
  latest.current = effect;
  useEffect(() => {
    let cleanup = latest.current();
    let deferred = false;
    let stopped = false, resumeTimer;
    const refresh = () => {
      if (stopped) return;
      if (document.hidden || hasDirtyForm() || document.activeElement?.matches('input, textarea, select, [contenteditable="true"]')) {
        deferred = true;
        return;
      }
      deferred = false;
      if (typeof cleanup === 'function') cleanup();
      cleanup = latest.current();
    };
    const resume = () => { if (deferred) { clearTimeout(resumeTimer); resumeTimer = setTimeout(refresh, 0); } };
    listeners.add(refresh);
    document.addEventListener('focusout', resume);
    document.addEventListener('visibilitychange', resume);
    return () => {
      stopped = true;
      clearTimeout(resumeTimer);
      listeners.delete(refresh);
      document.removeEventListener('focusout', resume);
      document.removeEventListener('visibilitychange', resume);
      if (typeof cleanup === 'function') cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
}

export function useLiveUpdates(token, invalidate) {
  const latest = useRef(invalidate);
  latest.current = invalidate;
  useEffect(() => {
    if (!token) return;
    let stopped = false, pending = false, version;
    const check = async (force = false) => {
      if (stopped || pending || document.hidden) return;
      pending = true;
      try {
        const backend = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
        const response = await fetch(`${backend}/api/live/revision`, { headers: { Authorization: `Bearer ${token}` } });
        if (!response.ok) return;
        const data = await response.json();
        if (stopped) return;
        const changed = version !== undefined && version !== data.version;
        version = data.version;
        if (changed || force) {
          latest.current();
          publishLiveUpdate();
        }
      } catch { /* Retry on the next tick; keep the current page available. */ }
      finally { pending = false; }
    };
    check();
    const timer = setInterval(check, 15000);
    // Coming back to the tab only refreshes if the cursor really moved. Forcing it wiped the
    // read cache on every focus, so the first clicks after switching windows were slow.
    const resume = () => { check(); };
    const changedInput = event => { const form = event.target.closest?.('form'); if (form) dirtyForms.add(form); };
    const savedInput = event => { dirtyForms.delete(event.target.closest?.('form')); };
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    document.addEventListener('input', changedInput);
    document.addEventListener('change', changedInput);
    document.addEventListener('submit', savedInput);
    document.addEventListener('reset', savedInput);
    return () => {
      stopped = true;
      clearInterval(timer);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
      document.removeEventListener('input', changedInput);
      document.removeEventListener('change', changedInput);
      document.removeEventListener('submit', savedInput);
      document.removeEventListener('reset', savedInput);
      dirtyForms.clear();
    };
  }, [token]);
}
