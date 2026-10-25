import { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import AppNotifications from './Notifications';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), patch: jest.fn() }));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('../../shell/AppShell', () => ({ children }) => <div>{children}</div>);
jest.mock('../../../App', () => ({ useAuth: () => ({ user: { id: 'b1', role: 'business' } }) }));
jest.mock('../../../lib/liveUpdates', () => ({ useLiveEffect: require('react').useEffect, publishLiveUpdate: jest.fn() }));
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const now = new Date().toISOString();
const LIST = [
  { id: 'n1', title: 'Rohan delivered', message: 'Review it', type: 'success', link: '/dashboard/business/work-review', read: false, created_at: now },
  { id: 'n2', title: 'Wallet topped up', message: '', type: 'info', link: '/dashboard/business/wallet', read: true, created_at: now, category: 'payments' },
];
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
async function mount() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<AppNotifications />); });
  await flush();
  return { host, unmount: () => act(() => root.unmount()) };
}
beforeEach(() => jest.clearAllMocks());

test('groups under Today, opens a notification (marks read + navigates) and marks all read', async () => {
  axios.get.mockResolvedValue({ data: LIST });
  axios.patch.mockResolvedValue({});
  axios.post.mockResolvedValue({});
  const { host, unmount } = await mount();
  expect(host.textContent).toContain('Today');
  expect(host.textContent).toContain('Rohan delivered');
  await act(async () => { host.querySelector('.ap-nf-row.is-unread').click(); });
  expect(axios.patch).toHaveBeenCalledWith(expect.stringContaining('/notifications/n1/read'));
  expect(mockNavigate).toHaveBeenCalledWith('/dashboard/business/work-review');
  await act(async () => { host.querySelector('.ap-nf-markall')?.click(); });
  await unmount();
});

test('mark all read posts to the endpoint', async () => {
  axios.get.mockResolvedValue({ data: LIST });
  axios.post.mockResolvedValue({});
  const { host, unmount } = await mount();
  await act(async () => { host.querySelector('.ap-nf-markall').click(); });
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/notifications/mark-all-read'));
  await unmount();
});

test('a failed load shows Retry instead of "No notifications"', async () => {
  axios.get.mockRejectedValue({});
  const { host, unmount } = await mount();
  expect(host.textContent).toContain("You're offline");
  expect(host.textContent).not.toContain('No notifications yet');
  expect([...host.querySelectorAll('button')].some((b) => /Retry/.test(b.textContent))).toBe(true);
  await unmount();
});
