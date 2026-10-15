import axios from 'axios';
import { loadCreatorDeal } from './creatorDeals';
jest.mock('axios', () => ({ get: jest.fn() }));
beforeEach(() => axios.get.mockReset());
test('opening a deal loads summaries and only the requested room', async () => {
  axios.get.mockImplementation(url => Promise.resolve({ data: url.includes('summary=true') ? [{ deal_id: 'A' }, { deal_id: 'B' }] : { deal_id: 'B', chat_summary: {} } }));
  const result = await loadCreatorDeal('/api', 'B');
  expect(axios.get.mock.calls.map(([url]) => url)).toEqual(['/api/deals/my?summary=true', '/api/deals/B/detail']);
  expect(result.detail.deal_id).toBe('B');
});
test('fallback loads just the first room and an empty list loads no room', async () => {
  axios.get.mockResolvedValueOnce({ data: [{ deal_id: 'A' }] }).mockResolvedValueOnce({ data: { deal_id: 'A' } });
  expect((await loadCreatorDeal('/api')).detail.deal_id).toBe('A');
  expect(axios.get).toHaveBeenCalledTimes(2);
  axios.get.mockReset().mockResolvedValue({ data: [] });
  expect((await loadCreatorDeal('/api')).detail).toBeNull();
  expect(axios.get).toHaveBeenCalledTimes(1);
});
