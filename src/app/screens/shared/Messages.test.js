import { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { toast } from 'sonner';
import AppMessages, { getAvailableActionCards, buildDealInfo } from './Messages';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn(), warning: jest.fn(), message: jest.fn() } }));
jest.mock('../../shell/AppShell', () => ({ children }) => <div>{children}</div>);
jest.mock('../../../utils/upload', () => ({ uploadMedia: jest.fn() }));
jest.mock('../../../components/RevisionRequestModal', () => ({ findContactInfo: (t) => (/@/.test(t) ? 'email' : null) }));
const mockUser = { id: 'b1', role: 'business' };
jest.mock('../../../App', () => ({ useAuth: () => ({ user: mockUser, setUser: jest.fn() }) }));
jest.mock('../../../lib/liveUpdates', () => ({ useLiveEffect: require('react').useEffect }));
const mockSetParams = jest.fn();
let mockConv = '';
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useSearchParams: () => [new URLSearchParams(mockConv ? `conv=${mockConv}` : ''), mockSetParams],
}));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const CONVS = [{ user_id: 'c1', full_name: 'Zoya Khan', unread_count: 2, thread_classification: 'active_deal', associated_deal_status: 'negotiating', timestamp: new Date().toISOString(), last_message: { message: 'Sent a counter offer' } }];
const THREAD = [
  { id: 'm1', sender_id: 'c1', message: 'Hello there', created_at: new Date().toISOString() },
  { id: 'a1', item_type: 'action_card', type: 'counter_offer', status: 'open', sender_id: 'c1', created_at: new Date().toISOString(), available_actions: ['accept', 'reject', 'counter'], fields: { modified_price: 13000, revisions: '2' } },
];
function route(url) {
  if (/chat\/conversations/.test(url)) return { data: CONVS };
  if (/chat\/warnings/.test(url)) return { data: {} };
  if (/typing/.test(url)) return { data: { typing: false } };
  if (/business\/wallet/.test(url)) return { data: { available_balance: 9000, minimum_chat_balance: 2500, chat_unlocked: true } };
  if (/chat\/c1/.test(url)) return { data: THREAD };
  return { data: {} };
}
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
async function mount() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<AppMessages />); });
  await flush();
  return { host, unmount: () => act(() => root.unmount()) };
}
const byText = (re, scope = document) => [...scope.querySelectorAll('button')].find((b) => re.test(b.textContent));
async function setValue(input, value) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockConv = '';
  axios.get.mockImplementation((url) => Promise.resolve(route(url)));
  axios.post.mockResolvedValue({ data: {} });
});

test('inbox lists conversations with unread badge and opens one with ?conv=', async () => {
  const { host, unmount } = await mount();
  expect(host.textContent).toContain('Zoya');
  expect(host.querySelector('.ap-mc-badge').textContent).toBe('2');
  await act(async () => { host.querySelector('.ap-mc-conv').click(); });
  expect(mockSetParams).toHaveBeenCalledWith({ conv: 'c1' });
  await unmount();
});

test('inbox error shows Retry, not an empty list', async () => {
  axios.get.mockImplementation((url) => (/conversations/.test(url) ? Promise.reject({}) : Promise.resolve(route(url))));
  const { host, unmount } = await mount();
  expect(host.textContent).toContain("You're offline");
  expect(byText(/Retry/, host)).toBeTruthy();
  await unmount();
});

test('chat: sends a message, blocks an email, accepts an offer through the confirm sheet', async () => {
  mockConv = 'c1';
  const { host, unmount } = await mount();
  expect(host.textContent).toContain('Hello there');
  expect(host.textContent).toContain('₹13,000');

  const input = host.querySelector('.ap-mc-in');
  await setValue(input, 'mail me at a@b.com');
  await act(async () => { host.querySelector('.ap-mc-send').click(); });
  expect(toast.error).toHaveBeenCalled();
  expect(axios.post).not.toHaveBeenCalledWith(expect.stringContaining('/chat/send'), expect.anything());

  await setValue(host.querySelector('.ap-mc-in'), 'Hi Zoya');
  await act(async () => { host.querySelector('.ap-mc-send').click(); });
  await flush();
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/chat/send'), { recipient_id: 'c1', message: 'Hi Zoya', attachment_urls: [] });

  await act(async () => { byText(/^Accept$/, host).click(); });
  await act(async () => { byText(/Accept ₹13,000/, document.querySelector('.ap-sheet-f')).click(); });
  await flush();
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/chat/action-cards/a1/respond'), { action: 'accept' });
  await unmount();
});

test('decline needs a reason, then posts reject with it', async () => {
  mockConv = 'c1';
  const { host, unmount } = await mount();
  await act(async () => { byText(/^Decline$/, host).click(); });
  await act(async () => { byText(/Decline offer/, document.querySelector('.ap-sheet-f')).click(); });
  expect(toast.error).toHaveBeenCalledWith('Please select a reason for declining');
  await act(async () => { byText(/Timeline too short/, document.querySelector('.ap-sheet')).click(); });
  await act(async () => { byText(/Decline offer/, document.querySelector('.ap-sheet-f')).click(); });
  await flush();
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/chat/action-cards/a1/respond'), { action: 'reject', decline_reason: 'timeline', note: '' });
  await unmount();
});

test('helpers: role-specific action cards and deal summary', () => {
  expect(getAvailableActionCards('creator', {})).not.toContain('raise_dispute');
  expect(getAvailableActionCards('business', {})).not.toContain('revision_request');
  expect(getAvailableActionCards('business', { associated_deal_status: 'Revision Requested' })).toContain('revision_request');
  expect(buildDealInfo(THREAD, { associated_deal_status: 'negotiating' }).rows.map((r) => r[0])).toEqual(expect.arrayContaining(['Budget', 'Deal stage']));
});
