import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import ApplicationsPage from './ApplicationsPage';

jest.mock('../App', () => ({ useAuth: () => ({ user: { admin_scope: 'all' } }) }));
jest.mock('../lib/useIsPhone', () => () => true);
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));

const OLD = new Date(Date.now() - 5 * 86400000).toISOString();
const NEW = new Date().toISOString();
const APPS = [
  { id: 'c1', role: 'creator', approval_status: 'pending', submitted_at: OLD, email: 'chandan@gmail.com', profile: { fullName: 'Chandan Rao', category: 'dance', rate_card: { raw_payout: '1500', expected_payout: '1500', editing_payout: '500' } } },
  { id: 'c2', role: 'creator', approval_status: 'pending', submitted_at: NEW, email: 'asha@x.com', profile: { fullName: 'Asha Mehta', category: 'food' } },
  { id: 'b1', role: 'business', approval_status: 'pending', submitted_at: NEW, email: 'brand@shop.com', profile: { business_name: 'Shop Co', industry_category: 'Retail' } },
];

const flushPromises = () => new Promise((r) => setTimeout(r, 0));
const flush = () => act(flushPromises);
const click = (el) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const type = async (input, value) => {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  await act(async () => { setter.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
};
const byText = (root, sel, text) => [...root.querySelectorAll(sel)].find((el) => el.textContent.trim().startsWith(text));

let container, root;
async function mount() {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.includes('pending-profiles') ? APPS : (url.includes('/profile/') ? {} : []) }));
  axios.post.mockReset();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  const show = (el) => root.render(el); // plain React root; Testing Library is not installed
  await act(async () => show(<ApplicationsPage />));
  await flush();
}
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

test('renders creator cards with role line, status and an honest Overdue badge', async () => {
  await mount();
  const cards = container.querySelectorAll('.am-card');
  expect(cards).toHaveLength(2);
  expect(cards[0].textContent).toContain('Chandan Rao');
  expect(cards[0].textContent).toContain('Dance creator');
  expect(cards[0].textContent).toContain('Pending');
  expect(cards[0].textContent).toContain('Overdue');
  expect(cards[1].textContent).not.toContain('Overdue');
  expect(byText(container, '.am-chip', 'Creators').textContent).toContain('2');
  expect(byText(container, '.am-chip', 'Brands').textContent).toContain('1');
});

test('detail opens over the list and Back returns with search intact', async () => {
  await mount();
  await type(container.querySelector('input[type="search"]'), 'chandan');
  expect(container.querySelectorAll('.am-card')).toHaveLength(1);
  await click(byText(container, 'button', 'Review'));
  await flush();
  const detail = container.querySelector('.am-detail');
  expect(detail).not.toBeNull();
  expect(detail.textContent).toContain('chand***@gmail.com');
  expect(detail.textContent).not.toContain('chandan@gmail.com');
  expect(detail.textContent).toContain('₹1,500');
  await click(detail.querySelector('[aria-label="Back"]'));
  expect(container.querySelector('.am-detail')).toBeNull();
  expect(container.querySelector('input[type="search"]').value).toBe('chandan');
  expect(container.querySelectorAll('.am-card')).toHaveLength(1);
});

test('approve sends once, then closes the detail', async () => {
  await mount();
  let resolvePost;
  axios.post.mockImplementation(() => new Promise((r) => { resolvePost = r; }));
  await click(byText(container, 'button', 'Review'));
  const approve = byText(container.querySelector('.am-actionbar'), 'button', 'Approve');
  await click(approve);
  await click(approve);
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(axios.post.mock.calls[0][1]).toEqual({ item_id: 'c1', action: 'approve' });
  await act(async () => resolvePost({ data: {} }));
  await flush();
  expect(container.querySelector('.am-detail')).toBeNull();
});

test('reject needs a reason before it can be confirmed', async () => {
  await mount();
  await click(byText(container, 'button', 'Review'));
  await click(byText(container.querySelector('.am-actionbar'), 'button', 'Reject'));
  const confirm = byText(container, '.am-sheet button', 'Confirm reject');
  expect(confirm.disabled).toBe(true);
});
