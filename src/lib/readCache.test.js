import { createReadCache } from './readCache';
const response = value => ({ status: 200, data: value });
test('concurrent identical reads send one network request and fresh cache hits send none', async () => {
  const adapter = jest.fn().mockResolvedValue(response('data'));
  const cache = createReadCache(adapter);
  await Promise.all(Array.from({ length: 20 }, () => cache.read('user:url', {})));
  expect(adapter).toHaveBeenCalledTimes(1);
  await Promise.all(Array.from({ length: 20 }, () => cache.read('user:url', {})));
  expect(adapter).toHaveBeenCalledTimes(1);
});
test('stale cache returns immediately while sharing one background refresh', async () => {
  let time = 0, finish;
  const adapter = jest.fn().mockResolvedValueOnce(response('old')).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const cache = createReadCache(adapter, { now: () => time });
  await cache.read('key', {});
  time = 16000;
  const values = await Promise.all(Array.from({ length: 10 }, () => cache.read('key', {})));
  expect(values.every(v => v.data === 'old')).toBe(true);
  expect(adapter).toHaveBeenCalledTimes(2);
  finish(response('new'));
});
test('a write invalidates pending responses so old data cannot repopulate the cache', async () => {
  let finish;
  const adapter = jest.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(response('new'));
  const cache = createReadCache(adapter);
  const beforeWrite = cache.read('key', {});
  await Promise.resolve();
  cache.clear();
  finish(response('old'));
  await beforeWrite;
  expect((await cache.read('key', {})).data).toBe('new');
  expect(adapter).toHaveBeenCalledTimes(2);
});
test('failed requests can retry and separate account keys never share responses', async () => {
  const adapter = jest.fn().mockRejectedValueOnce(new Error('temporary')).mockResolvedValue(response('ok'));
  const cache = createReadCache(adapter);
  await expect(cache.read('user1:url', {})).rejects.toThrow('temporary');
  await cache.read('user1:url', {});
  await cache.read('user2:url', {});
  expect(adapter).toHaveBeenCalledTimes(3);
});
