import { lazy } from 'react';

export async function loadRoute(importer) {
  try { return await importer(); }
  catch { return importer(); }
}

export default function retryLazy(importer) {
  return lazy(() => loadRoute(importer));
}
