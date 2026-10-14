export function shouldRecoverChunk(error, storage, now = Date.now()) {
  if (!/ChunkLoadError|Loading (?:CSS )?chunk .+ failed|Failed to fetch dynamically imported module/i.test(`${error?.name || ''} ${error?.message || ''}`)) return false;
  try {
    const previous = storage.getItem('ugcad:chunk-recovery');
    if (previous && now - Number(previous) < 60000) return false;
    storage.setItem('ugcad:chunk-recovery', String(now));
    return true;
  } catch { return false; }
}

export function freshPageUrl(href, now = Date.now()) {
  const url = new URL(href);
  url.searchParams.set('_ugcad_reload', String(now));
  return url.toString();
}
