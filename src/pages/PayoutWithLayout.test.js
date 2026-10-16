import { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import PayoutWithLayout from './PayoutWithLayout';
jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('../components/CreatorTopNavLayout', () => ({ children }) => <div>{children}</div>);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('mobile earnings separate the platform fee from the late penalty', async () => {
  axios.get.mockImplementation(url => Promise.resolve({ data: url.includes('/receipts') ? [{
    id: 'receipt', type: 'earning', brand_name: 'Brand', gross_amount: 1000,
    commission_amount: 200, penalty_amount: 100, tds_amount: 0, net_amount: 700,
  }] : url.includes('/history') ? [] : {} }));
  const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<PayoutWithLayout />));
    await act(async () => host.querySelector('.pwl-earning-summary').click());
    const lines = [...host.querySelectorAll('.pwl-earning-details p')];
    const platformFee = lines.find(p => p.querySelector('span')?.textContent === 'Platform fee');
    const penalty = lines.find(p => p.querySelector('span')?.textContent === 'Late delivery penalty');
    expect(platformFee.querySelector('strong').textContent).toContain('200');
    expect(penalty.querySelector('strong').textContent).toContain('100');
  } finally { await act(async () => root.unmount()); host.remove(); }
});
