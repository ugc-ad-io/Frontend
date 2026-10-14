import { loadRoute } from './retryLazy';

test('retries a temporarily failed page download', async () => {
  const page = { default: () => null };
  const importer = jest.fn().mockRejectedValueOnce(new Error('ChunkLoadError')).mockResolvedValueOnce(page);
  await expect(loadRoute(importer)).resolves.toBe(page);
  expect(importer).toHaveBeenCalledTimes(2);
});

test('persistent download failure stops retrying and reaches the error boundary', async () => {
  const importer = jest.fn().mockRejectedValue(new Error('ChunkLoadError'));
  await expect(loadRoute(importer)).rejects.toThrow('ChunkLoadError');
  expect(importer).toHaveBeenCalledTimes(2);
});
