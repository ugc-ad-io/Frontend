import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import AdminDisputes from './AdminDisputes';
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../App', () => ({ useAuth: () => ({ user: { id: 'admin', role: 'admin', admin_role: 'ops_regular' } }) }));
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('../components/AdminLayout', () => ({ children }) => <div>{children}</div>);
jest.mock('../lib/useIsPhone', () => () => true);
jest.mock('../lib/liveUpdates', () => ({ useLiveEffect: (...args) => require('react').useEffect(...args) }));

const click = (el) => act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const type = (el, value) => act(async () => {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});

const dispute = {
  id: 'd1a2b3c4-0000', deal_id: 'DL-77', business_id: 'b1b1b1b1-x', creator_id: 'c2c2c2c2-y', dispute_type: 'not_received',
  severity: 'high', status: 'open', description: 'Product never arrived', created_at: '2026-10-14T10:00:00Z', sla_hours_remaining: 30,
};
const detail = {
  dispute: { ...dispute, evidence_urls: ['/uploads/receipt.pdf'] },
  brief: { title: 'Summer Serum', brief_text: 'Show the serum', budget_max: 5000 },
  brand_name: 'Glow Labs', creator_name: 'Arushi',
  timeline: [{ timestamp: '2026-10-14T10:00:00Z', actor_name: 'Arushi', message: 'Raised a dispute' }],
  chat_history: [], content_versions: [], shipment: null, prior_disputes: [],
};

test('phone disputes: cards, evidence detail, ruling sheet guards, request info posts once', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  axios.get.mockImplementation((url) => Promise.resolve({
    data: url.endsWith('/admin/disputes') ? { disputes: [dispute], open_count: 1 }
      : url.endsWith('/appeals') ? { appeals: [] } : detail,
  }));
  axios.post.mockResolvedValue({ data: {} });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<AdminDisputes />));
    const card = container.querySelector('[data-testid="dispute-card-d1a2b3c4-0000"]');
    for (const t of ['not received', '#d1a2b3c4', 'Deal DL-77', 'Brand b1b1b1b1 ↔ Creator c2c2c2c2', 'Product never arrived', 'high', '30h SLA left', 'Assign me']) expect(card.textContent).toContain(t);
    expect(container.textContent).toContain('1 open');

    await click(card.querySelector('.amo-card-open'));
    const panel = container.querySelector('[data-testid="dispute-detail"]');
    expect(panel.textContent).toContain('Glow Labs');
    expect(panel.textContent).toContain('Arushi');
    expect(panel.textContent).toContain('Show the serum');
    await click([...panel.querySelectorAll('.am-chip')].find((b) => b.textContent.includes('Timeline')));
    expect(panel.textContent).toContain('Raised a dispute');
    await click([...panel.querySelectorAll('.am-chip')].find((b) => b.textContent.includes('Evidence')));
    expect(panel.querySelector('a[href$="/uploads/receipt.pdf"]')).not.toBeNull();

    // ruling over the ops_regular ₹25K cap cannot be recorded
    await click(container.querySelector('[data-testid="dispute-rule-open"]'));
    await type(container.querySelector('#amo-refund'), '30000');
    expect(container.querySelector('[data-testid="dispute-rule-submit"]').disabled).toBe(true);
    expect(container.querySelector('[data-testid="dispute-rule-sheet"]').textContent).toContain('exceeds your');
    await click(container.querySelector('[data-testid="dispute-rule-sheet"] [aria-label="Close"]'));

    await click(container.querySelector('[data-testid="dispute-info-open"]'));
    const submit = container.querySelector('[data-testid="dispute-info-submit"]');
    expect(submit.disabled).toBe(true);
    await type(container.querySelector('#amo-info-msg'), 'Share the courier receipt');
    await click(submit);
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/admin/disputes/d1a2b3c4-0000/request-info'), { party: 'creator', message: 'Share the courier receipt' });
    expect(container.querySelector('[data-testid="dispute-detail"]')).toBeNull(); // closes on success
    expect(container.querySelector('[data-testid="dispute-card-d1a2b3c4-0000"]')).not.toBeNull();
  } finally { await act(async () => root.unmount()); container.remove(); }
});
