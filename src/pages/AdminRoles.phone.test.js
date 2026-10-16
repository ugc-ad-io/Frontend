import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import AdminRoles from './AdminRoles';
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), delete: jest.fn() }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../App', () => ({ useAuth: () => ({ user: { id: 'f1', admin_role: 'founder' } }) }));
jest.mock('../components/AdminLayout', () => ({ children }) => <div>{children}</div>);
jest.mock('../lib/useIsPhone', () => () => true);
jest.mock('../lib/liveUpdates', () => ({ useLiveEffect: (...args) => require('react').useEffect(...args) }));

const staff = [
  { id: 'f1', email: 'boss@ugcad.io', full_name: 'Boss', admin_role: 'founder' },
  { id: 'u2', email: 'chandan@gmail.com', full_name: 'Chandan', admin_role: 'ops_regular' },
];
const click = (el) => act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const setValue = (el, value) => act(async () => {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, value);
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
});

let container; let root;
const mountUi = (ui) => root.render(ui); // createRoot, not Testing Library
async function mountRoles() {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  axios.get.mockReset(); axios.post.mockReset();
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.endsWith('/admin/staff') ? staff : { categories: [] } }));
  axios.post.mockResolvedValue({ data: { created: true } });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => mountUi(<AdminRoles />));
}
beforeEach(() => mountRoles());
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const $ = (id) => container.querySelector(`[data-testid="${id}"]`);

test('phone team list shows masked cards; founder row explains its lock', async () => {
  const card = $('staff-card-u2');
  expect(card.textContent).toContain('Chandan');
  expect(card.textContent).toContain('chand***@gmail.com');
  expect(card.textContent).not.toContain('chandan@gmail.com');
  expect(card.textContent).toContain('Operations Team');
  expect(card.textContent).toContain('Active');

  await click($('staff-card-f1'));
  expect($('staff-detail').textContent).toContain('Founder role is locked');
  expect($('staff-detail-role')).toBeNull();
  expect($('staff-revoke')).toBeNull();
  await click($('staff-detail-back'));
  expect($('staff-detail')).toBeNull();
});

test('choosing Custom opens the per-capability editor and Save posts once', async () => {
  await click($('staff-card-u2'));
  await setValue($('staff-detail-role'), 'custom');
  expect(axios.post).not.toHaveBeenCalled();
  expect($('access-editor')).not.toBeNull();

  await click($('cap-review_applications-view'));   // view only
  await click($('cap-manage_deals-view'));
  await click($('cap-manage_deals-edit'));          // view + edit = both
  await click($('cap-manage_deals-view'));          // edit only
  expect($('cap-manage_deals-edit').getAttribute('aria-pressed')).toBe('true');
  expect($('cap-manage_deals-view').getAttribute('aria-pressed')).toBe('false');

  await click($('access-save'));
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/admin/staff/role'), {
    user_id: 'u2', admin_role: 'custom', admin_scope: 'all',
    admin_caps: ['review_applications', 'manage_deals'],
    admin_cap_modes: { review_applications: 'view', manage_deals: 'edit' },
  });
  expect($('access-editor')).toBeNull();
});

test('add-admin sheet validates inline and grants access once', async () => {
  await click($('roles-invite'));
  await setValue($('invite-email'), 'new@ugcad.io');
  await setValue($('invite-password'), 'abc');
  expect($('invite-sheet').textContent).toContain('at least 6 characters');
  await setValue($('invite-password'), 'secret12');
  await setValue($('invite-role'), 'finance');
  await click($('invite-submit'));
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/admin/staff/role'), { email: 'new@ugcad.io', admin_role: 'finance', password: 'secret12' });
  expect($('invite-sheet')).toBeNull();
});

test('delete needs DELETE typed in the sheet', async () => {
  axios.delete.mockResolvedValue({ data: {} });
  await click($('staff-card-u2'));
  await click($('staff-delete'));
  expect($('delete-confirm').disabled).toBe(true);
  await setValue($('delete-input'), 'delete');
  await click($('delete-confirm'));
  expect(axios.delete).toHaveBeenCalledWith(expect.stringContaining('/admin/user/u2'));
});
