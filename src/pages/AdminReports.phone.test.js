import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import AdminReports from './AdminReports';
import AdminAnalytics from './AdminAnalytics';
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../App', () => ({ useAuth: () => ({ user: { id: 'admin', role: 'admin' } }) }));
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('../components/AdminLayout', () => ({ children }) => <div>{children}</div>);
jest.mock('../lib/useIsPhone', () => () => true);
jest.mock('../lib/liveUpdates', () => ({ useLiveEffect: (...args) => require('react').useEffect(...args) }));

const click = (el) => act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));

async function mount(ui) {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(ui));
  return { container, done: async () => { await act(async () => root.unmount()); container.remove(); } };
}

beforeEach(() => {
  axios.get.mockReset();
  window.URL.createObjectURL = jest.fn(() => 'blob:x');
  window.URL.revokeObjectURL = jest.fn();
  jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
});

test('phone reports: period sheet applies, export shows success and failure', async () => {
  const { container, done } = await mount(<AdminReports />);
  try {
    await click(container.querySelector('[data-testid="rep-period-btn"]'));
    const select = container.querySelector('#amf-rep-period');
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'week');
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await click([...container.querySelectorAll('button')].find((b) => b.textContent === 'Apply'));
    expect(container.querySelector('[data-testid="rep-period-sheet"]')).toBeNull();
    expect(container.textContent).toContain('This week');

    axios.get.mockResolvedValueOnce({ data: 'csv' });
    await click(container.querySelector('[data-testid="rep-export-digest"]'));
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/admin/reports/digest'), { params: { period: 'week' }, responseType: 'blob' });
    expect(container.textContent).toContain('Downloaded');

    axios.get.mockRejectedValueOnce(new Error('boom'));
    await click(container.querySelector('[data-testid="rep-export-reconciliation"]'));
    expect(container.textContent).toContain('Export failed');
  } finally { await done(); }
});

test('phone analytics: same metrics as tiles and label/value rows', async () => {
  axios.get.mockResolvedValue({ data: { total_creators: 42, new_creators: 5, total_businesses: 7, platform_commission: 2000, creator_earnings: 10000, total_users: 49, success_rate: 81.25, monthly_growth: 3 } });
  const { container, done } = await mount(<AdminAnalytics />);
  try {
    expect(container.textContent).toContain('Total Creators42');
    expect(container.textContent).toContain('+5 this month');
    expect(container.textContent).toContain('20% of ₹10,000');
    expect(container.textContent).toContain('Success Rate81.3%');
    expect(container.textContent).toContain('Monthly Growth3.0%');
    expect(container.querySelector('[data-testid="analytics-export"]')).not.toBeNull();
  } finally { await done(); }
});
