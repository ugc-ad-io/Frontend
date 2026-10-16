import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import AdminNotificationTemplates from './AdminNotificationTemplates';
jest.mock('axios', () => ({ get: jest.fn(), put: jest.fn(), delete: jest.fn() }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../components/AdminLayout', () => ({ children }) => <div>{children}</div>);
jest.mock('../lib/useIsPhone', () => () => true);

const data = {
  samples: { amount: '₹500' },
  events: [
    { key: 'deal_paid', label: 'Deal paid', to: 'Creator', title: 'Paid {amount}', message: 'You got {amount}', email: true, vars: ['amount'], override: null },
    { key: 'brief_live', label: 'Brief is live', to: 'Brand', title: 'Live', message: 'Your brief is live', email: false, vars: [], override: null },
  ],
};
const click = (el) => act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const setValue = (el, value) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});

test('phone templates: list with channel badges, audience filter, editor saves once', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  axios.get.mockResolvedValue({ data });
  axios.put.mockResolvedValue({ data: {} });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const $ = (id) => container.querySelector(`[data-testid="${id}"]`);
  try {
    const mountUi = (ui) => root.render(ui); // createRoot, not Testing Library
    await act(async () => mountUi(<AdminNotificationTemplates />));
    const card = $('template-deal_paid');
    expect(card.textContent).toContain('Deal paid');
    expect(card.textContent).toContain('To: Creator');
    expect(card.textContent).toContain('Email on');
    expect(card.textContent).toContain('Paid ₹500');
    expect($('template-brief_live').textContent).toContain('Email off');

    const brand = [...container.querySelectorAll('.am-chip')].find((b) => b.textContent === 'Brand');
    await click(brand);
    expect($('template-deal_paid')).toBeNull();
    await click([...container.querySelectorAll('.am-chip')].find((b) => b.textContent === 'All'));

    await click($('template-deal_paid'));
    const title = container.querySelector('#nt-deal_paid-title');
    await setValue(title, 'Payment sent');
    await act(async () => title.focus());
    await click(container.querySelector('.amp-ph'));   // inserts {amount} into the focused field
    expect(title.value).toBe('Payment sent{amount}');
    expect($('template-reset')).toBeNull();            // only shown for edited templates

    await click($('template-save'));
    expect(axios.put).toHaveBeenCalledTimes(1);
    expect(axios.put).toHaveBeenCalledWith(expect.stringContaining('/admin/notification-templates/deal_paid'), {
      title: 'Payment sent{amount}', message: '', email_enabled: true, email_subject: 'Paid {amount}', email_body: '',
    });
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
