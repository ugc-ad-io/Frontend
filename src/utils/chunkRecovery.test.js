import { shouldRecoverChunk } from './chunkRecovery';
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
