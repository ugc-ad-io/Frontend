import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import AdminSettings from './AdminSettings';
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn() }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../App', () => ({ useAuth: () => ({ user: { email: 'boss@ugcad.io', admin_role: 'founder' } }) }));
jest.mock('../components/AdminLayout', () => ({ children }) => <div>{children}</div>);
let mockPhone = true;
jest.mock('../lib/useIsPhone', () => () => mockPhone);

const settings = {
  commission_rate: 10, listing_fee: 99, listing_fee_multi_deliverable: 149, listing_fee_multi_creator: 299,
  listing_fee_large_campaign: 999, revision_price: 200, auto_approval_days: 3, late_ship_fee_per_day: 50, late_ship_fee_cap: 500,
  payout_delay_days: { new: 7 }, restricted_categories: ['tobacco'], feature_flags: { chat: true }, wallet_bonus_tiers: [],
};
const click = (el) => act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const setValue = (el, value) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});

async function mount() {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  axios.get.mockImplementation((url) => Promise.resolve({
    data: url.endsWith('/admin/settings') ? { settings } : url.endsWith('/admin/email/health') ? { configured: true, from: 'hi@ugcad.io' } : [],
  }));
  axios.put.mockResolvedValue({ data: { settings } });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const mountUi = (ui) => root.render(ui); // createRoot, not Testing Library
  await act(async () => mountUi(<AdminSettings />));
  return { container, done: async () => { await act(async () => root.unmount()); container.remove(); } };
}

test('phone settings: section list -> focused form; input survives switching; Save puts once', async () => {
  const { container, done } = await mount();
  const $ = (id) => container.querySelector(`[data-testid="${id}"]`);
  try {
    for (const id of ['email', 'gateways', 'fees', 'review', 'late', 'payout', 'restricted', 'flags', 'tiers']) {
      expect($(`settings-section-${id}`)).not.toBeNull();
    }
    expect($('settings-section-gateways').textContent).toContain('None configured');

    await click($('settings-section-fees'));
    const rate = container.querySelector('#as-ph-commission_rate');
    expect(rate.value).toBe('10');
    await setValue(rate, '12');
    await click($('settings-back'));
    await click($('settings-section-late'));
    expect(container.querySelector('#as-ph-late_ship_fee_cap').value).toBe('500');
    await click($('settings-back'));
    await click($('settings-section-fees'));
    expect(container.querySelector('#as-ph-commission_rate').value).toBe('12');

    await click($('settings-save'));
    expect(axios.put).toHaveBeenCalledTimes(1);
    expect(axios.put.mock.calls[0][1]).toMatchObject({ commission_rate: 12, late_ship_fee_cap: 500, restricted_categories: ['tobacco'], feature_flags: { chat: true } });
  } finally { await done(); }
});

test('desktop settings markup is unchanged when not on a phone', async () => {
  mockPhone = false;
  const { container, done } = await mount();
  try {
    expect(container.querySelector('[data-testid="settings-phone"]')).toBeNull();
    expect(container.querySelector('.as-save')).not.toBeNull();
  } finally { mockPhone = true; await done(); }
});
