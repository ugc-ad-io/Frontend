// Share identical reads and avoid starting another refresh for every cache hit.
export function createReadCache(adapter, { staleMs = 60000, refreshMs = 15000, now = Date.now } = {}) {
  const entries = new Map();
  const pending = new Map();
  let generation = 0;
  const clear = () => { generation += 1; entries.clear(); pending.clear(); };
  const read = (key, config) => {
    const start = () => {
      if (pending.has(key)) return pending.get(key);
      const version = generation;
      const request = Promise.resolve().then(() => adapter(config)).then(response => {
        if (version === generation && response?.status >= 200 && response.status < 300) {
          entries.set(key, { response, at: now() });
        }
        return response;
      }).finally(() => { if (pending.get(key) === request) pending.delete(key); });
      pending.set(key, request);
      return request;
    };
    const hit = entries.get(key);
    if (hit && now() - hit.at < staleMs) {
      if (now() - hit.at >= refreshMs) start().catch(() => {});
      return Promise.resolve(hit.response);
    }
    return start();
  };
  return { clear, read };
}
