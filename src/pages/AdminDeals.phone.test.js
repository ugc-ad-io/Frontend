import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import AdminDeals from './AdminDeals';
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../App', () => ({ useAuth: () => ({ startBrandSession: jest.fn() }) }));
jest.mock('../components/AdminLayout', () => ({ children }) => <div>{children}</div>);
jest.mock('../components/BrandProfileModal', () => () => null);
jest.mock('../components/CreatorProfileModal', () => () => null);
let mockPhone = true;
jest.mock('../lib/useIsPhone', () => () => mockPhone);
jest.mock('react-router-dom', () => ({ useSearchParams: () => [new URLSearchParams(), jest.fn()] }));
jest.mock('../lib/liveUpdates', () => ({ useLiveEffect: (...args) => require('react').useEffect(...args) }));

const deal = {
  id: 'a91a7705-1111', deal_id: 'a91a7705-1111', campaign_title: 'Summer Glow Serum',
  brand: 'Glow Co', creator: 'Arushi', current_state: 'Content Submitted — Awaiting Review',
  escrow: 12000, is_overdue: true, deadline_countdown_hours: -2,
};

test('phone deals list shows cards and the detail opens and closes', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  axios.get.mockImplementation((url) => Promise.resolve({
    data: url.endsWith('/admin/deals') ? [deal] : { ...deal, brand_id: 'b1', creator_id: 'c1', timeline: [] },
  }));
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const click = (el) => act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  try {
    await act(async () => root.render(<AdminDeals />));
    const card = container.querySelector('[data-testid="deal-card-a91a7705-1111"]');
    expect(card.textContent).toContain('Summer Glow Serum');
    expect(card.textContent).toContain('#a91a7705');
    expect(card.textContent).toContain('Glow Co × Arushi');
    expect(card.textContent).toContain('Awaiting Review');
    expect(card.textContent).toContain('Overdue');
    expect(card.textContent).toContain('₹12,000');

    await click(card);
    const detail = container.querySelector('[data-testid="deal-detail"]');
    expect(detail.textContent).toContain('Deal progress');
    expect(detail.textContent).toContain('Open workspace');
    expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/admin/deals/a91a7705-1111'));

    await click(container.querySelector('[data-testid="deal-detail-back"]'));
    expect(container.querySelector('[data-testid="deal-detail"]')).toBeNull();
    expect(container.querySelector('[data-testid="deal-card-a91a7705-1111"]')).not.toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

test('desktop still renders the table when not on a phone', async () => {
  mockPhone = false;
  axios.get.mockResolvedValue({ data: [deal] });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<AdminDeals />));
    expect(container.querySelector('[data-testid="deal-row-a91a7705-1111"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="deals-phone"]')).toBeNull();
  } finally {
    mockPhone = true;
    await act(async () => root.unmount());
    container.remove();
  }
});
