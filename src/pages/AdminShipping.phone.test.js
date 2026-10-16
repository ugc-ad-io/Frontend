import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import AdminShipping from './AdminShipping';
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../App', () => ({ useAuth: () => ({ user: { id: 'admin', role: 'admin' } }) }));
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('../components/AdminLayout', () => ({ children }) => <div>{children}</div>);
jest.mock('../lib/useIsPhone', () => () => true);
jest.mock('../lib/liveUpdates', () => ({ useLiveEffect: (...args) => require('react').useEffect(...args) }));

const hoursAgo = (h) => new Date(Date.now() - h * 36e5).toISOString();
const rows = [
  { id: 'a91a7705-1111', creator_id: 'c1', campaign_title: 'Summer serum', brand: 'Glow', creator: 'Arushi', product: 'Serum', weight: '0.5 kg', ship_city: 'Pune', status: 'pending', requested_at: hoursAgo(23) },
  { id: 'b22b8806-2222', creator_id: 'c2', campaign_title: 'Winter boots', brand: 'Trek', creator: 'Kabir', status: 'shipped', requested_at: hoursAgo(30), shipped_at: hoursAgo(10), label_url: '/files/label.pdf', courier: 'Delhivery', tracking_number: 'AWB1' },
];

test('phone shipping queue shows cards, filters by chip, and opens/closes the process detail', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  axios.get.mockResolvedValue({ data: rows });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const click = (el) => act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  try {
    await act(async () => root.render(<AdminShipping />));
    expect(container.textContent).toContain('24-hour processing target');
    expect(container.textContent).toContain('Summer serum');
    expect(container.textContent).toContain('#a91a7705');
    expect(container.textContent).toContain('1h left');
    expect(container.textContent).not.toContain('Winter boots'); // pending chip is the default

    await click([...container.querySelectorAll('.am-chip')].find((b) => b.textContent === 'Shipped'));
    expect(container.textContent).toContain('Winter boots');
    expect(container.textContent).toContain('View label');

    await click([...container.querySelectorAll('.am-chip')].find((b) => b.textContent === 'Pending'));
    await click(container.querySelector('[data-testid="action-shipping-a91a7705-1111"]'));
    expect(container.querySelector('[data-testid="shipping-modal"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="ship-submit"]').disabled).toBe(true); // no courier/tracking yet

    await click(container.querySelector('[aria-label="Back to shipping queue"]'));
    expect(container.querySelector('[data-testid="shipping-modal"]')).toBeNull();
    expect(container.textContent).toContain('Summer serum');
  } finally { await act(async () => root.unmount()); container.remove(); }
});
