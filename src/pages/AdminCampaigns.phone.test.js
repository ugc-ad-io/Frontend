import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import AdminCampaigns from './AdminCampaigns';
import AdminAllCampaigns from './AdminAllCampaigns';
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), delete: jest.fn() }));
jest.mock('../App', () => ({ useAuth: () => ({ user: { id: 'admin', role: 'admin', admin_role: 'founder' } }) }));
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('../components/AdminLayout', () => ({ children }) => <div>{children}</div>);
jest.mock('../lib/useIsPhone', () => () => true);
jest.mock('../lib/liveUpdates', () => ({ useLiveEffect: (...args) => require('react').useEffect(...args) }));

const click = (el) => act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const type = (el, value) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
const byText = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent.trim() === text);

async function mount(ui) {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(ui));
  return { container, done: async () => { await act(async () => root.unmount()); container.remove(); } };
}

beforeEach(() => { axios.get.mockReset(); axios.post.mockReset(); axios.delete.mockReset(); });

const brief = {
  id: 'c1', title: 'Summer Serum', brand_name: 'Glow Labs', budget_min: 2000, budget_max: 5000,
  product_category: 'Beauty', objectives: ['Awareness'], requires_shipment: true, status: 'pending_approval',
  script_provider: 'brand', script_text: 'Say hi', product_name: 'Serum', campaign_hook: 'Glow in 7 days',
  brief_text: 'Product: Serum\nUsage rights: platforms Instagram; duration 6 months\nDeliverables:\n1. 1 x Reel; ratios 9:16\nCommission: platform 20%',
};
const ugcBrief = { ...brief, id: 'c2', title: 'Winter Balm', script_provider: 'ugc', script_text: '' };

test('phone briefs: cards, full brief detail, back, approve posts once and closes', async () => {
  axios.get.mockResolvedValue({ data: [brief, ugcBrief] });
  axios.post.mockResolvedValue({ data: {} });
  const { container, done } = await mount(<AdminCampaigns />);
  try {
    const card = container.querySelector('[data-testid="brief-card-c1"]');
    for (const t of ['Summer Serum', 'Glow Labs', '₹2000 - ₹5000', 'Beauty', 'Awareness', 'Shipment required', 'pending approval']) expect(card.textContent).toContain(t);
    expect(container.querySelector('[data-testid="brief-card-c2"]').textContent).toContain('Needs script');

    await click(card);
    let detail = container.querySelector('[data-testid="brief-detail"]');
    expect(detail.textContent).toContain('Glow in 7 days');
    expect(detail.textContent).toContain('6 months');               // "a; b" values become list items
    expect(detail.textContent).toContain('1. 1 x Reel; ratios 9:16'); // numbered line joins Deliverables
    expect(detail.textContent).toContain('Commission');
    await click(container.querySelector('[aria-label="Back to briefs"]'));
    expect(container.querySelector('[data-testid="brief-detail"]')).toBeNull();

    // UGC.ad-script brief cannot be approved until the script is written
    await click(container.querySelector('[data-testid="brief-card-c2"]'));
    expect(container.querySelector('[data-testid="brief-approve"]').disabled).toBe(true);
    await type(container.querySelector('#amo-script'), 'Hook, demo, CTA');
    expect(container.querySelector('[data-testid="brief-approve"]').disabled).toBe(false);
    await click(container.querySelector('[data-testid="brief-approve"]'));
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/admin/approve-campaign'), { item_id: 'c2', action: 'approve', script_text: 'Hook, demo, CTA' });
    expect(container.querySelector('[data-testid="brief-detail"]')).toBeNull();

    // reject goes through a confirmation sheet and keeps the fixed reason
    await click(container.querySelector('[data-testid="brief-card-c1"]'));
    detail = container.querySelector('[data-testid="brief-detail"]');
    await click(byText(detail, 'Reject'));
    await click(container.querySelector('[data-testid="brief-reject-confirm"]'));
    expect(axios.post).toHaveBeenLastCalledWith(expect.stringContaining('/admin/approve-campaign'), { item_id: 'c1', action: 'reject', reason: 'Campaign does not meet guidelines' });
  } finally { await done(); }
});

test('phone all campaigns: status chips, detail, ban needs a reason and posts once', async () => {
  axios.get.mockResolvedValue({ data: [
    { id: 'k1', title: 'Summer Serum', brand_name: 'Glow Labs', status: 'active', budget_min: 1, budget_max: 2, created_at: '2026-10-01T10:00:00Z', brief_text: 'Full brief text here' },
    { id: 'k2', title: 'Old Promo', brand_name: 'Trek', status: 'paused', pause_reason: 'Checking claims', budget_min: 1, budget_max: 2, created_at: '2026-09-01T10:00:00Z' },
  ] });
  axios.post.mockResolvedValue({ data: { message: 'Banned' } });
  const { container, done } = await mount(<AdminAllCampaigns />);
  try {
    expect(container.textContent).toContain('Old Promo');
    await click([...container.querySelectorAll('.am-chip')].find((b) => b.textContent.startsWith('active')));
    expect(container.textContent).not.toContain('Old Promo');
    expect(container.textContent).toContain('Summer Serum');

    await click(container.querySelector('[data-testid="allcampaign-card-k1"]'));
    const detail = container.querySelector('[data-testid="allcampaign-detail"]');
    expect(detail.textContent).toContain('Full brief text here');
    expect(detail.querySelector('[data-testid="campaign-pause-k1"]')).not.toBeNull();

    await click(container.querySelector('[aria-label="More actions"]'));
    await click(container.querySelector('[data-testid="campaign-ban-k1"]'));
    const confirm = container.querySelector('[data-testid="confirm-moderation"]');
    expect(confirm.disabled).toBe(true);
    await type(container.querySelector('#amo-mod-reason'), 'Fake product claims');
    await click(confirm);
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/admin/campaigns/k1/ban'), { reason: 'Fake product claims' });
    expect(container.querySelector('[data-testid="moderation-sheet"]')).toBeNull();

    await click(container.querySelector('[aria-label="Back to campaigns"]'));
    expect(container.querySelector('[data-testid="allcampaign-detail"]')).toBeNull();
  } finally { await done(); }
});
