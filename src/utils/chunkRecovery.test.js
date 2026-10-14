import { shouldRecoverChunk, freshPageUrl } from './chunkRecovery';
test('a failed page chunk can reload once without a reload loop', () => {
  const data = new Map();
  const storage = { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value) };
  const error = { name: 'ChunkLoadError', message: 'Loading chunk 12 failed' };
  expect(shouldRecoverChunk(error, storage, 100000)).toBe(true);
  expect(shouldRecoverChunk(error, storage, 100001)).toBe(false);
});
test('runtime errors never trigger automatic reload', () => {
  expect(shouldRecoverChunk(new TypeError('Cannot read properties of null'), sessionStorage)).toBe(false);
});
test('recovery requests a fresh document while retaining the route and deal selection', () => {
  const url = new URL(freshPageUrl('https://ugcad.io/my-deals?deal=deal-1#brief', 123));
  expect(url.pathname).toBe('/my-deals');
  expect(url.searchParams.get('deal')).toBe('deal-1');
  expect(url.searchParams.get('_ugcad_reload')).toBe('123');
  expect(url.hash).toBe('#brief');
});
