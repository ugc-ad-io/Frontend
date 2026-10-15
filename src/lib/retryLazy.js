import { lazy } from 'react';

// Page downloads in flight. React keeps the previous page on screen while a new tab's
// code downloads, so the app listens here to show a skeleton straight away.
let inFlight = 0;
const listeners = new Set();
const notify = () => queueMicrotask(() => listeners.forEach(listener => listener(inFlight)));
export function onRouteLoading(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function loadRoute(importer) {
  inFlight += 1; notify();
  try {
    try { return await importer(); }
    catch { return await importer(); }
  } finally { inFlight -= 1; notify(); }
}

export default function retryLazy(importer) {
  return lazy(() => loadRoute(importer));
}
