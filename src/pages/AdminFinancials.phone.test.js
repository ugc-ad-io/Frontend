import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import AdminFinancials from './AdminFinancials';
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../App', () => ({ useAuth: () => ({ user: { id: 'admin', role: 'admin' } }) }));
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('../components/AdminLayout', () => ({ children }) => <div>{children}</div>);
jest.mock('../lib/useIsPhone', () => () => true);
jest.mock('../lib/liveUpdates', () => ({ useLiveEffect: (...args) => require('react').useEffect(...args) }));

const click = (el) => act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const type = (el, value) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});

const DATA = {
  '/admin/analytics': { platform_commission: 500 },
  '/admin/withdrawals?status=pending': [],
  '/admin/users': [{ id: 'c1', role: 'creator', full_name: 'Kabir Rao', balance: 1200 }],
  '/admin/escrow': [],
  '/admin/payouts': [{ id: 'p1', creator_nickname: 'Kabir', campaign_title: 'Winter boots', gross_amount: 1000, tds_amount: 100, method: 'upi', status: 'scheduled', scheduled_date: '2026-10-20' }],
  '/admin/financials/overview': {},
  '/admin/wallet/c1/transactions': [{ id: 't1', amount: -250, type: 'adjustment', reason: 'Duplicate credit', created_at: '2026-10-01' }],
};

test('phone financials: summary tiles, payout card -> detail -> hold with a required reason', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  axios.get.mockImplementation((url) => Promise.resolve({ data: DATA[url.replace(/^.*\/api/, '')] ?? null }));
  axios.post.mockResolvedValue({ data: {} });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<AdminFinancials />));
    expect(container.textContent).toContain('Platform earnings');
    expect(container.textContent).toContain('₹500');
    expect(container.textContent).toContain('Wallet liabilities₹1,200');

    await click(container.querySelector('[data-testid="fin-tab-payouts"]'));
    const card = container.querySelector('[data-testid="payout-card-p1"]');
    expect(card.textContent).toContain('Winter boots');
    expect(card.textContent).toContain('₹900');

    await click(card);
    const detail = container.querySelector('[data-testid="payout-detail"]');
    expect(detail.textContent).toContain('Net payable₹900');
    await click(container.querySelector('[data-testid="payout-hold"]'));
    const confirm = container.querySelector('[data-testid="hold-sheet-confirm"]');
    expect(confirm.disabled).toBe(true);
    await type(container.querySelector('#amf-reason'), 'Fraud review');
    await click(confirm);
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/admin/payouts/p1/hold'), { reason: 'Fraud review' });
    expect(container.querySelector('[data-testid="hold-sheet"]')).toBeNull();

    await click(container.querySelector('[aria-label="Back to payout queue"]'));
    expect(container.querySelector('[data-testid="payout-detail"]')).toBeNull();

    await click(container.querySelector('[data-testid="fin-tab-wallets"]'));
    await click(container.querySelector('[data-testid="wallet-card-c1"]'));
    const wallet = container.querySelector('[data-testid="wallet-drawer"]');
    expect(wallet.textContent).toContain('Duplicate credit');
    expect(wallet.textContent).toContain('−₹250');
  } finally { await act(async () => root.unmount()); container.remove(); }
});
