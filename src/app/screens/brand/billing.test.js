import { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { toast } from 'sonner';
import Plans from './Plans';
import EditAddon from './EditAddon';
import Invoice from './Invoice';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('sonner', () => ({ toast: Object.assign(jest.fn(), { error: jest.fn(), success: jest.fn() }) }));
jest.mock('../../shell/AppShell', () => ({ children }) => <div>{children}</div>);
jest.mock('../../../App', () => ({ useAuth: () => ({ user: { id: 'b1', role: 'business', email: 'a@b.c' } }) }));
jest.mock('../../../lib/liveUpdates', () => ({ useLiveEffect: require('react').useEffect }));
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/dashboard/business/invoice/t2' }),
  matchPath: jest.requireActual('react-router-dom').matchPath,
}));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
async function mount(El) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<El />); });
  await flush();
  return { host, unmount: () => act(() => root.unmount()) };
}
const byText = (re, scope = document) => [...scope.querySelectorAll('button')].find((b) => re.test(b.textContent));
beforeEach(() => jest.clearAllMocks());

test('Plans marks the plan matching the brand fee as current and upgrades say Coming soon', async () => {
  axios.get.mockResolvedValue({ data: { commission_rate: 15 } });
  const { host, unmount } = await mount(Plans);
  expect(host.textContent).toContain('Current plan');
  expect(host.querySelector('.ap-pill').closest('article').textContent).toContain('Growth');
  await act(async () => { byText(/Upgrade to Scale/, host).click(); });
  expect(toast).toHaveBeenCalledWith('Coming soon');
  await act(async () => { byText(/Yearly/, host).click(); });
  expect(host.textContent).toContain('₹49,990');
  await unmount();
});

test('EditAddon lists approved videos only and totals the selection with GST', async () => {
  axios.get.mockResolvedValue({ data: [{ id: 'a', title: 'Kurta haul', status: 'completed' }, { id: 'b', title: 'Live one', status: 'active' }] });
  const { host, unmount } = await mount(EditAddon);
  expect(host.textContent).toContain('Kurta haul');
  expect(host.textContent).not.toContain('Live one');
  expect(byText(/Add expert editing/, host).disabled).toBe(true);
  await act(async () => { host.querySelector('.ap-ad-row').click(); });
  expect(host.textContent).toContain('₹1,770');
  expect(byText(/Add expert editing/, host).disabled).toBe(false);
  await unmount();
});

test('Invoice finds the transaction from the path id and never invents tax numbers', async () => {
  axios.get.mockImplementation((url) => Promise.resolve({
    data: url.includes('/wallet') ? { transactions: [{ id: 't2', date: '2026-10-19', type: 'Wallet Recharge', amount: 50000, direction: 'credit', status: 'success' }] }
      : url.includes('/company') ? { gst_number: '27ABCDE1234F1Z5' } : { brand_name: 'Glow Labs' },
  }));
  const { host, unmount } = await mount(Invoice);
  expect(host.textContent).toContain('₹50,000.00');
  expect(host.textContent).toContain('Glow Labs');
  expect(host.textContent).toContain('27ABCDE1234F1Z5');
  expect(host.textContent).toContain('Not available');
  await unmount();
});

test('Invoice: an id that is not in the wallet history says so', async () => {
  axios.get.mockResolvedValue({ data: { transactions: [] } });
  const { host, unmount } = await mount(Invoice);
  expect(host.textContent).toContain('Invoice not found');
  await unmount();
});
