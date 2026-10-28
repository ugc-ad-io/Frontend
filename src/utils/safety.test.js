import axios from 'axios';
import { blockUser, unblockUser, loadBlockedFor, isBlocked, reportUser, __resetForTests } from './safety';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), delete: jest.fn() }));

beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); __resetForTests(); });

test('block works on this device when the backend has no /blocks yet, and survives a reload', async () => {
  axios.get.mockRejectedValue({ response: { status: 404 } });
  await loadBlockedFor('me');
  axios.post.mockRejectedValue({ response: { status: 404 } });
  expect(await blockUser('u2')).toEqual({ ok: true, synced: false });
  expect(isBlocked('u2')).toBe(true);
  __resetForTests(); // simulate a reload: state comes back from localStorage
  await loadBlockedFor('me');
  expect(isBlocked('u2')).toBe(true);
  await loadBlockedFor('someone-else');
  expect(isBlocked('u2')).toBe(false); // per account
});

test('block / unblock call the contract endpoints and merge the server list', async () => {
  axios.get.mockResolvedValue({ data: [{ user_id: 'srv1' }, 'srv2'] });
  await loadBlockedFor('me');
  expect(isBlocked('srv1') && isBlocked('srv2')).toBe(true);
  axios.post.mockResolvedValue({});
  expect(await blockUser('u3')).toEqual({ ok: true, synced: true });
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/blocks'), { user_id: 'u3' });
  axios.delete.mockResolvedValue({});
  await unblockUser('u3');
  expect(axios.delete).toHaveBeenCalledWith(expect.stringContaining('/api/blocks/u3'));
  expect(isBlocked('u3')).toBe(false);
});

test('reportUser posts to the existing /report-user route', async () => {
  axios.post.mockResolvedValue({ data: { message: 'ok' } });
  await reportUser({ userId: 'u9', dealId: 'd1', reason: 'spam', details: 'rude', messageId: 'm1' });
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/api/report-user'), { reported_user_id: 'u9', deal_id: 'd1', reason: 'spam', details: '[message m1] rude' });
});
