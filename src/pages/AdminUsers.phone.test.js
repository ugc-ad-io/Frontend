import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import AdminUsers from './AdminUsers';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), delete: jest.fn() }));
jest.mock('../App', () => ({ useAuth: () => ({ user: { admin_role: 'founder' } }) }));
jest.mock('../components/AdminLayout', () => ({ children }) => <div>{children}</div>);
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
let mockPhone = true;
jest.mock('../lib/useIsPhone', () => () => mockPhone);
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('../lib/liveUpdates', () => ({ useLiveEffect: (...args) => require('react').useEffect(...args) }));

const USERS = [
  {
    id: 'u1', role: 'creator', email: 'arushi@gmail.com', full_name: 'Arushi Khare', username: 'arushi',
    phone: '+91 98765 43210', balance: 1500, ugcad_approved: true, profile_completed: true,
    kyc: { status: 'verified', pan_number: 'ABCDE1234F', aadhaar_number: '123412341234' },
  },
  { id: 'b1', role: 'business', email: 'team@glow.co', profile: { business_name: 'Glow Co' }, balance: 0, banned: true, active: false },
];

const flush = () => act(() => new Promise((r) => setTimeout(r, 0)));
const click = (el) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const typeText = async (el, value) => {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set;
  await act(async () => { setter.call(el, value); el.dispatchEvent(new Event('input', { bubbles: true })); });
};
const $ = (id) => document.querySelector(`[data-testid="${id}"]`);

let container, root;
async function mount() {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.endsWith('/admin/users') ? USERS : (url.endsWith('/admin/disputes') ? { disputes: [] } : []) }));
  axios.post.mockReset();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<AdminUsers />));
  await flush();
}
afterEach(async () => { mockPhone = true; await act(async () => root.unmount()); container.remove(); });

test('phone user cards show identity, masked email, badges and wallet', async () => {
  await mount();
  const card = $('user-card-u1');
  expect(card.textContent).toContain('Arushi Khare');
  expect(card.textContent).toContain('ar•••@gmail.com');
  expect(card.textContent).not.toContain('arushi@gmail.com');
  expect(card.textContent).toContain('Creator');
  expect(card.textContent).toContain('UGCAD approved');
  expect(card.querySelector('.amu-verified')).not.toBeNull();
  expect(card.textContent).toContain('Active');
  expect(card.textContent).toContain('₹1,500.00');
  expect($('user-card-b1').textContent).toContain('Banned');
  expect($('user-card-b1').textContent).toContain('Glow Co');
});

test('detail opens with masked identifiers, Show reveals, Back returns to the list', async () => {
  await mount();
  await click($('user-card-u1'));
  await flush();
  const detail = $('user-detail');
  expect(detail.textContent).toContain('•••• 3210');
  expect(detail.textContent).not.toContain('ABCDE1234F');
  expect(detail.textContent).toContain('•••• 234F');
  await click(detail.querySelector('[aria-label="Show PAN, Aadhaar and account number"]'));
  expect($('user-detail').textContent).toContain('ABCDE1234F');
  await click($('user-detail-back'));
  expect($('user-detail')).toBeNull();
  expect($('user-card-u1')).not.toBeNull();
});

test('warn from the overflow sheet requires a message and posts once', async () => {
  await mount();
  await click($('user-card-u1'));
  await click($('user-more-btn'));
  await click($('user-action-warn'));
  expect($('user-action-sheet-warn')).not.toBeNull();
  await click($('user-action-submit'));
  expect(axios.post).not.toHaveBeenCalled(); // empty message is rejected

  let resolvePost;
  axios.post.mockImplementation(() => new Promise((r) => { resolvePost = r; }));
  await typeText($('user-action-sheet-warn').querySelector('textarea'), 'Please stop sharing phone numbers');
  await click($('user-action-submit'));
  await click($('user-action-submit'));
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(axios.post.mock.calls[0][1]).toEqual({ user_id: 'u1', message: 'Please stop sharing phone numbers' });
  await act(async () => resolvePost({ data: {} }));
  await flush();
  expect($('user-action-sheet-warn')).toBeNull();
});

test('select mode shows checkboxes and a bulk bar with the count', async () => {
  await mount();
  expect($('users-bulkbar')).toBeNull();
  await click($('users-select-btn'));
  const box = $('user-card-u1').querySelector('input[type="checkbox"]');
  await click(box);
  expect($('users-bulkbar').textContent).toContain('1 selected');
  await click($('users-announce-btn'));
  expect($('user-action-sheet-announce').textContent).toContain('1 user(s)');
});

test('desktop still renders the table when not on a phone', async () => {
  mockPhone = false;
  await mount();
  expect($('user-row-u1')).not.toBeNull();
  expect($('users-phone')).toBeNull();
});
