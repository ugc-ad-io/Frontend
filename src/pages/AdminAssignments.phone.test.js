import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import AdminAssignments from './AdminAssignments';
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('../components/AdminLayout', () => ({ children }) => <div>{children}</div>);
jest.mock('../lib/useIsPhone', () => () => true);
jest.mock('../lib/liveUpdates', () => ({ useLiveEffect: (...args) => require('react').useEffect(...args) }));

const click = (el) => act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const assignments = [{ manager_id: 'm1', manager_nickname: 'Riya', manager_email: 'riya@x.com', campaign_count: 1,
  campaigns: [{ id: 'c1', title: 'Summer serum', status: 'active' }] }];
const campaigns = [{ id: 'c2', title: 'Winter boots', status: 'active', assigned_manager: null }];

test('phone assignments: manager cards, unassigned tab, assign sheet posts once', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.includes('campaign-assignments') ? assignments : campaigns }));
  axios.post.mockResolvedValue({ data: { message: 'Assigned' } });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<AdminAssignments />));
    const card = container.querySelector('[data-testid="manager-card-m1"]');
    expect(card.textContent).toContain('Riya');
    expect(card.textContent).toContain('Summer serum');

    await click(container.querySelector('[data-testid="tab-unassigned"]'));
    await click(container.querySelector('[data-testid="assign-c2"]'));
    const sheet = container.querySelector('[data-testid="assign-sheet"]');
    expect(sheet.textContent).toContain('Winter boots');
    const select = sheet.querySelector('#amo-manager');
    await act(async () => {
      select.value = 'm1';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await click(container.querySelector('[data-testid="assign-confirm"]'));
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/admin/assign-campaign?campaign_id=c2&manager_id=m1'));
    expect(container.querySelector('[data-testid="assign-sheet"]')).toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
