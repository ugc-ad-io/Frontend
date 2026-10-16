import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import AdminAuditLog from './AdminAuditLog';
jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('../App', () => ({ useAuth: () => ({ user: { id: 'admin', role: 'admin' } }) }));
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('../components/AdminLayout', () => ({ children }) => <div>{children}</div>);
jest.mock('../lib/useIsPhone', () => () => true);
jest.mock('../lib/liveUpdates', () => ({ useLiveEffect: (...args) => require('react').useEffect(...args) }));

const click = (el) => act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const logs = [{
  id: 'e1', action: 'wallet.adjust', module: 'financials', admin_nickname: 'ops_meet', admin_role: 'admin', admin_id: 'a1',
  target_type: 'user', target_id: 'abcdef123456', reason: 'Refund goodwill', ip: '10.0.0.1',
  created_at: '2026-10-01T10:00:00Z', before: { balance: 100 }, after: { balance: 150 },
}];

test('phone audit log: card opens full record, filter sheet applies action filter with one fetch', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  axios.get.mockResolvedValue({ data: { logs } });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<AdminAuditLog />));
    const card = container.querySelector('[data-testid="audit-row-e1"]');
    expect(card.textContent).toContain('wallet.adjust');
    expect(card.textContent).toContain('user:abcdef12');
    expect(card.textContent).toContain('Sensitive');

    await click(card);
    const detail = container.querySelector('[data-testid="audit-detail"]');
    expect(detail.textContent).toContain('user:abcdef123456');
    expect(detail.textContent).toContain('"balance": 150');
    expect(detail.textContent).toContain('Founder notified');
    await click(container.querySelector('[data-testid="audit-detail-back"]'));
    expect(container.querySelector('[data-testid="audit-detail"]')).toBeNull();

    axios.get.mockClear();
    await click(container.querySelector('[data-testid="audit-filter-btn"]'));
    const select = container.querySelector('#amo-f-action');
    await act(async () => {
      select.value = 'dispute.ruling';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await click(container.querySelector('[data-testid="audit-filters-apply"]'));
    expect(container.querySelector('[data-testid="audit-filters"]')).toBeNull();
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/admin/audit-logs'), { params: { action: 'dispute.ruling' } });
    expect(container.querySelector('[aria-label="Filters, 1 active"]')).not.toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
