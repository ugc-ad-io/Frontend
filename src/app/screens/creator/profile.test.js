import { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { toast } from 'sonner';
import Profile from './Profile';
import Reviews from './Reviews';

jest.mock('axios', () => ({ get: jest.fn(), put: jest.fn(), patch: jest.fn(), post: jest.fn() }));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn(), message: jest.fn() } }));
jest.mock('../../shell/AppShell', () => ({ children }) => <div>{children}</div>);
jest.mock('../../../App', () => {
  const value = { user: { id: 'cr-1', role: 'creator', approval_status: 'approved', level: 'l1' }, setUser: () => {} };
  return { useAuth: () => value };
});
jest.mock('../../../lib/liveUpdates', () => ({ useLiveEffect: require('react').useEffect }));
jest.mock('react-router-dom', () => ({ useNavigate: () => () => {}, useLocation: () => ({ pathname: '/profile' }) }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const PROFILE = { id: 'cr-1', full_name: 'Priya Das', public_creator_id: 'UGC-1', kyc_verified: true, portfolio: [], profile: { fullName: 'Priya Das', rate_card: { raw_payout: '4000', delivery_days: 2 }, delivery_days: 2, languages: ['Hindi'] } };
const REVIEWS = [
  { id: 'v1', rating: 5, review: 'Great hooks', reviewer_id: 'b1', campaign_id: 'c1', created_at: new Date().toISOString() },
  { id: 'v2', rating: 4, reviewer_id: 'b1', campaign_id: 'c1', created_at: new Date().toISOString() },
];
const route = (url) => {
  if (url.includes('/reviews/creator')) return Promise.resolve({ data: REVIEWS });
  if (url.includes('/profile/cr-1')) return Promise.resolve({ data: PROFILE });
  if (url.includes('/profile/b1')) return Promise.resolve({ data: { nickname: 'Glow Labs' } });
  if (url.includes('/campaigns/')) return Promise.resolve({ data: { title: 'Skincare reel' } });
  return Promise.resolve({ data: [] });
};

const flush = () => act(async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); });
async function mount(El) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<El />); });
  await flush();
  return { host, unmount: () => act(() => root.unmount()) };
}
const btn = (re, scope = document) => [...scope.querySelectorAll('button')].find((b) => re.test(b.textContent));
const setValue = (input, value) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});

beforeEach(() => { jest.clearAllMocks(); document.body.innerHTML = ''; axios.get.mockImplementation(route); });

test('profile renders and the rates sheet saves the same payload shape to PUT /profile/creator', async () => {
  axios.put.mockResolvedValue({ data: { message: 'Profile updated' } });
  const { host, unmount } = await mount(Profile);
  expect(host.textContent).toContain('Priya');
  expect(host.textContent).toContain('No work yet');
  const rates = [...host.querySelectorAll('section')].find((s) => s.querySelector('h2')?.textContent === 'Rates');
  await act(async () => { btn(/^Edit$/, rates).click(); });
  expect(document.body.textContent).toContain('Rates & delivery');
  const [raw] = document.querySelectorAll('.ap-sheet input[type="number"]');
  await setValue(raw, '4500');
  await act(async () => { btn(/^Save$/, document.querySelector('.ap-sheet-f')).click(); });
  await flush();
  expect(axios.put).toHaveBeenCalledWith(expect.stringContaining('/profile/creator'), expect.objectContaining({ expectedPayout: '4500', delivery_days: 2, rate_card: expect.objectContaining({ raw_payout: '4500' }) }));
  expect(toast.success).toHaveBeenCalledWith('Profile updated');
  await unmount();
});

test('profile: a failed load shows an error with Retry', async () => {
  axios.get.mockRejectedValue({ response: { data: { detail: 'Server down' } } });
  const { host, unmount } = await mount(Profile);
  expect(host.textContent).toContain('Server down');
  expect(btn(/Retry/, host)).toBeTruthy();
  await unmount();
});

test('reviews shows the level, the average and a review with campaign and brand', async () => {
  const { host, unmount } = await mount(Reviews);
  expect(host.textContent).toContain('Level 1');
  expect(host.textContent).toContain('4.5');
  expect(host.textContent).toContain('Great hooks');
  expect(host.textContent).toContain('Glow Labs');
  await unmount();
});
