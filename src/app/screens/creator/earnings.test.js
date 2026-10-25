import { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { toast } from 'sonner';
import Earnings from './Earnings';

const mockNavigate = jest.fn();
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn(), message: jest.fn() } }));
jest.mock('../../shell/AppShell', () => ({ children }) => <div>{children}</div>);
jest.mock('../../../lib/liveUpdates', () => ({ useLiveEffect: require('react').useEffect }));
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const OVERVIEW = { balance: 18400, pending_release: 21000, all_time_earnings: 184200, paid_this_month: 12000, deals_paid_this_month: 2, min_withdrawal: 2500, kyc_status: 'verified', upi_id: 'priya@okaxis', bank_details: {} };
const reply = (overview = OVERVIEW) => axios.get.mockImplementation((url) => {
  if (url.includes('/payout/overview')) return Promise.resolve({ data: overview });
  if (url.includes('/payouts/receipts')) return Promise.resolve({ data: [{ id: 'r1', type: 'earning', brand_name: 'Glow Labs', campaign_title: 'Skincare reel', net_amount: 6000, gross_amount: 7500, commission_amount: 1500, created_at: new Date().toISOString() }] });
  return Promise.resolve({ data: [] });
});

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
async function mount() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<Earnings />); });
  await flush();
  return { host, unmount: () => act(() => root.unmount()) };
}
const btn = (re, scope = document) => [...scope.querySelectorAll('button')].find((b) => re.test(b.textContent));
const setValue = (input, value) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});

beforeEach(() => { jest.clearAllMocks(); document.body.innerHTML = ''; });

test('shows balance and money in; withdraw checks the minimum, then confirms and posts', async () => {
  reply();
  axios.post.mockResolvedValue({ data: {} });
  const { host, unmount } = await mount();
  expect(host.textContent).toContain('₹18,400');
  expect(host.textContent).toContain('Skincare reel');

  await act(async () => { btn(/^Withdraw$/, host).click(); });
  await setValue(document.querySelector('input[aria-label="Amount"]'), '1000');
  await act(async () => { btn(/Review/, document.querySelector('.ap-sheet-f')).click(); });
  expect(toast.error).toHaveBeenCalledWith('Minimum withdrawal is ₹2,500');
  expect(axios.post).not.toHaveBeenCalled();

  await setValue(document.querySelector('input[aria-label="Amount"]'), '5000');
  await act(async () => { btn(/Review/, document.querySelector('.ap-sheet-f')).click(); });
  expect(document.body.textContent).toContain('Confirm withdrawal');
  await act(async () => { btn(/^Withdraw ₹5,000/, document.querySelector('.ap-sheet-f')).click(); });
  await flush();
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/withdrawal/request'), { amount: 5000, payment_method: 'upi', account_details: { upi_id: 'priya@okaxis' } });
  expect(toast.success).toHaveBeenCalled();
  await unmount();
});

test('without verified KYC the Withdraw button sends the creator to /kyc', async () => {
  reply({ ...OVERVIEW, kyc_status: 'not_submitted' });
  const { host, unmount } = await mount();
  expect(host.querySelector('[data-testid="kyc-banner"]')).toBeTruthy();
  await act(async () => { btn(/^Withdraw$/, host).click(); });
  expect(mockNavigate).toHaveBeenCalledWith('/kyc');
  await unmount();
});

test('a failed load shows an error with Retry, never a silent zero', async () => {
  axios.get.mockRejectedValue({ response: { data: { detail: 'Server down' } } });
  const { host, unmount } = await mount();
  expect(host.textContent).toContain('Server down');
  expect(host.textContent).not.toContain('₹0');
  expect(btn(/Retry/, host)).toBeTruthy();
  await unmount();
});
