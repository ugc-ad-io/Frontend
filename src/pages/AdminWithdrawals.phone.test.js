import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import AdminWithdrawals from './AdminWithdrawals';
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('../components/AdminLayout', () => ({ children }) => <div>{children}</div>);
jest.mock('../lib/useIsPhone', () => () => true);
jest.mock('../lib/liveUpdates', () => ({ useLiveEffect: (...args) => require('react').useEffect(...args) }));

const click = (el) => act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const type = (el, value) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});
const byText = (root, text) => [...root.querySelectorAll('button')].find((b) => b.textContent.includes(text));

const rows = [{
  id: 'w1', user_id: 'u1', user_nickname: 'Arushi', user_email: 'arushi@example.com', amount: 3000,
  payment_method: 'upi', account_details: { upi_id: 'arushi@okaxis' }, status: 'pending', requested_at: '2026-10-10T10:00:00Z',
}];

async function mount() {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<AdminWithdrawals />));
  return { container, done: async () => { await act(async () => root.unmount()); container.remove(); } };
}

beforeEach(() => { axios.get.mockReset(); axios.post.mockReset(); axios.get.mockResolvedValue({ data: rows }); });

test('phone withdrawals: masked card, detail opens/closes, reject needs a reason', async () => {
  axios.post.mockResolvedValue({ data: {} });
  const { container, done } = await mount();
  try {
    const card = container.querySelector('[data-testid="withdrawal-card-w1"]');
    expect(card.textContent).toContain('Arushi');
    expect(card.textContent).toContain('₹3,000');
    expect(card.textContent).toContain('UPI ••••axis');
    expect(container.textContent).not.toContain('arushi@okaxis');

    await click(card);
    expect(container.querySelector('[data-testid="withdrawal-detail"]').textContent).toContain('u1');
    await click(container.querySelector('[aria-label="Back to withdrawals"]'));
    expect(container.querySelector('[data-testid="withdrawal-detail"]')).toBeNull();
    expect(container.textContent).toContain('Arushi');

    await click(container.querySelector('[data-testid="withdrawal-card-w1"]'));
    await click(container.querySelector('[data-testid="withdrawal-reject"]'));
    const confirm = container.querySelector('[data-testid="withdrawal-reject-sheet-confirm"]');
    expect(confirm.disabled).toBe(true);
    await type(container.querySelector('#amf-reason'), 'Wrong UPI');
    expect(confirm.disabled).toBe(false);
    await click(confirm);
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/admin/withdrawals/w1/reject?reason=Wrong%20UPI'));
    expect(container.querySelector('[data-testid="withdrawal-detail"]')).toBeNull();
  } finally { await done(); }
});

test('phone withdrawals: approve is confirmed in a sheet and posts once even on a double tap', async () => {
  let resolvePost;
  axios.post.mockImplementation(() => new Promise((r) => { resolvePost = r; }));
  const { container, done } = await mount();
  try {
    await click(container.querySelector('[data-testid="withdrawal-card-w1"]'));
    await click(container.querySelector('[data-testid="withdrawal-approve"]'));
    const confirm = container.querySelector('[data-testid="withdrawal-approve-sheet-confirm"]');
    expect(confirm.textContent).toContain('Approve ₹3,000');
    await click(confirm);
    expect(confirm.disabled).toBe(true);
    expect(confirm.textContent).toBe('Approving…');
    await click(byText(container, 'Approving'));
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/admin/withdrawals/w1/approve'));
    await act(async () => resolvePost({ data: {} }));
    expect(container.querySelector('[data-testid="withdrawal-detail"]')).toBeNull();
  } finally { await done(); }
});
