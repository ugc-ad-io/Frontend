import { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { toast } from 'sonner';
import { payWithRazorpay } from '../../../utils/razorpay';
import BrandWallet from './Wallet';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn(), message: jest.fn() } }));
jest.mock('../../shell/AppShell', () => ({ children }) => <div>{children}</div>);
jest.mock('../../../utils/razorpay', () => ({ payWithRazorpay: jest.fn(() => Promise.resolve({ message: 'ok' })), isPaymentCancelled: () => false }));
jest.mock('../../../App', () => ({ useAuth: () => ({ user: { id: 'b1', role: 'business', email: 'a@b.c' } }) }));
jest.mock('../../../lib/liveUpdates', () => ({ useLiveEffect: require('react').useEffect }));
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn(), useSearchParams: () => [new URLSearchParams('')] }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const WALLET = {
  available_balance: 32500, minimum_chat_balance: 2500, chat_unlocked: true,
  bonus_tiers: [{ amount: 25000, label: '₹25K', bonus_percent: 3 }],
  transactions: [{ id: 't2', date: '2026-10-19', type: 'Wallet Recharge', reference: 'Razorpay', amount: 50000, direction: 'credit', status: 'success' }],
};

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
async function mount() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<BrandWallet />); });
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

beforeEach(() => { jest.clearAllMocks(); });

test('shows the balance and a transaction; tapping it opens the detail sheet', async () => {
  axios.get.mockResolvedValue({ data: WALLET });
  const { host, unmount } = await mount();
  expect(host.textContent).toContain('₹32,500');
  expect(host.textContent).toContain('Wallet Recharge');
  await act(async () => { host.querySelector('.ap-wl-trow').click(); });
  expect(document.body.textContent).toContain('Transaction ID');
  await unmount();
});

test('a failed load shows an error with Retry, never a silent zero', async () => {
  axios.get.mockRejectedValue({ response: { data: { detail: 'Server down' } } });
  const { host, unmount } = await mount();
  expect(host.textContent).toContain('Server down');
  expect(byText(/Retry/, host)).toBeTruthy();
  await unmount();
});

test('add funds: below the minimum is rejected, a valid amount starts the Razorpay flow', async () => {
  axios.get.mockResolvedValue({ data: WALLET });
  axios.post.mockResolvedValue({ data: { order_id: 'o1', key_id: 'k', amount: 5000 } });
  const { host, unmount } = await mount();
  await act(async () => { byText(/^\s*Add funds/, host.querySelector('.ap-wl-hero')).click(); });
  const input = document.getElementById('ap-wl-amount');
  await setValue(input, '1000');
  await act(async () => { byText(/Pay/, document.querySelector('.ap-sheet-f')).click(); });
  expect(toast.error).toHaveBeenCalledWith('Minimum recharge amount is ₹2,500');
  expect(axios.post).not.toHaveBeenCalled();

  await setValue(document.getElementById('ap-wl-amount'), '5000');
  await act(async () => { byText(/Pay/, document.querySelector('.ap-sheet-f')).click(); });
  await flush();
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/business/wallet/recharge'), { amount: 5000, gateway: 'razorpay' });
  expect(payWithRazorpay).toHaveBeenCalledTimes(1);
  expect(toast.success).toHaveBeenCalled();
  await unmount();
});
