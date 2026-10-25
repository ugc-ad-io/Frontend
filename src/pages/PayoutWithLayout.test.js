import { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { toast } from 'sonner';
import PayoutWithLayout from './PayoutWithLayout';
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('../components/CreatorTopNavLayout', () => ({ children }) => <div>{children}</div>);
jest.mock('../components/CreatorPageHead', () => () => null);
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('mobile earnings separate the platform fee from the late penalty', async () => {
  axios.get.mockImplementation(url => Promise.resolve({ data: url.includes('/receipts') ? [{
    id: 'receipt', type: 'earning', brand_name: 'Brand', gross_amount: 1000,
    commission_amount: 200, penalty_amount: 100, tds_amount: 0, net_amount: 700,
  }] : url.includes('/history') ? [] : {} }));
  const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<PayoutWithLayout />));
    await act(async () => host.querySelector('.cui-e-summary').click());
    const lines = [...host.querySelectorAll('.cui-e-details p')];
    const platformFee = lines.find(p => p.querySelector('span')?.textContent === 'Platform fee');
    const penalty = lines.find(p => p.querySelector('span')?.textContent === 'Late delivery penalty');
    expect(platformFee.querySelector('strong').textContent).toContain('200');
    expect(penalty.querySelector('strong').textContent).toContain('100');
  } finally { await act(async () => root.unmount()); host.remove(); }
});

// The backend rejects anything under 2,500 (server.py MIN_WITHDRAWAL_AMOUNT), so the
// form must stop it first with the same figure instead of letting 500 through.
async function openForm(host, root) {
  axios.get.mockImplementation(url => Promise.resolve({ data: url.includes('/overview') ? { balance: 10000, kyc_status: 'verified' } : [] }));
  await act(async () => root.render(<PayoutWithLayout />));
  await act(async () => host.querySelector('.cui-e-hero-btn').click());
}
async function fill(input, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  await act(async () => { setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
}

test.each([['500'], ['2499']])('withdrawing %s is stopped below the 2,500 minimum', async (amount) => {
  jest.clearAllMocks();
  const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host);
  try {
    await openForm(host, root);
    await fill(host.querySelector('.cui-e-field input[type="number"]'), amount);
    await act(async () => host.querySelector('.cui-e-submit').click());
    expect(toast.error).toHaveBeenCalledWith('Minimum withdrawal is ₹2,500');
    expect(axios.post).not.toHaveBeenCalled();
  } finally { await act(async () => root.unmount()); host.remove(); }
});

test('2,500 is accepted and sent with the chosen method', async () => {
  jest.clearAllMocks();
  axios.post.mockResolvedValue({ data: {} });
  const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host);
  try {
    await openForm(host, root);
    await fill(host.querySelector('.cui-e-field input[type="number"]'), '2500');
    await fill(host.querySelector('input[placeholder="name@bank"]'), 'me@upi');
    await act(async () => host.querySelector('.cui-e-submit').click());
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/withdrawal/request'),
      { amount: 2500, payment_method: 'upi', account_details: { upi_id: 'me@upi' } });
  } finally { await act(async () => root.unmount()); host.remove(); }
});

test('unverified KYC shows the banner and Withdraw sends the creator to /kyc instead of the modal', async () => {
  jest.clearAllMocks();
  axios.get.mockImplementation(url => Promise.resolve({ data: url.includes('/overview') ? { balance: 10000, kyc_status: 'not_submitted' } : [] }));
  const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<PayoutWithLayout />));
    expect(host.querySelector('[data-testid="kyc-banner"]')).not.toBeNull();
    await act(async () => host.querySelector('.cui-e-hero-btn').click());
    expect(mockNavigate).toHaveBeenCalledWith('/kyc');
    expect(host.querySelector('.cui-e-modal')).toBeNull();
  } finally { await act(async () => root.unmount()); host.remove(); }
});

test('a failed load shows an offline message with Retry, not zeros', async () => {
  jest.clearAllMocks();
  axios.get.mockRejectedValue(new Error('Network Error'));
  const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<PayoutWithLayout />));
    expect(host.textContent).toContain("You're offline");
    expect(host.querySelector('.cmk-emptystate-btn').textContent).toContain('Retry');
    expect(host.querySelector('.cui-e-stats')).toBeNull();
  } finally { await act(async () => root.unmount()); host.remove(); }
});
