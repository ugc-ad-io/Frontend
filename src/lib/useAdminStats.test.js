import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import useAdminStats from './useAdminStats';
jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('./liveUpdates', () => ({ useLiveEffect: (...args) => require('react').useEffect(...args) }));
let root, container, result;
function Harness() { result = useAdminStats('/api', 'admin'); return <div>{result.status}</div>; }
beforeEach(() => { global.IS_REACT_ACT_ENVIRONMENT = true; axios.get.mockReset(); container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
test('temporary initial failure retries and recovers without navigation', async () => {
  axios.get.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ data: { pending_kyc: 2 } });
  await act(async () => root.render(<Harness />));
  expect(result.status).toBe('ready');
  expect(result.stats.pending_kyc).toBe(2);
  expect(axios.get).toHaveBeenCalledTimes(2);
});
test('persistent failure exposes retry and retry recovers', async () => {
  axios.get.mockRejectedValue(new Error('network'));
  await act(async () => root.render(<Harness />));
  expect(result.status).toBe('error');
  expect(axios.get).toHaveBeenCalledTimes(3);
  axios.get.mockResolvedValue({ data: { active_campaigns: 4 } });
  await act(async () => result.reload());
  expect(result.status).toBe('ready');
  expect(result.stats.active_campaigns).toBe(4);
});
