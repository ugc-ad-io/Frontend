import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import AdminProfiles from './AdminProfiles';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../components/AdminLayout', () => ({ children }) => <div>{children}</div>);
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../lib/useIsPhone', () => () => true);
jest.mock('../lib/liveUpdates', () => ({ useLiveEffect: (...args) => require('react').useEffect(...args) }));

const PROFILES = [
  { id: 'c1', role: 'creator', email: 'chandan@gmail.com', phone_full: '+91 98765 43210', profile: { fullName: 'Chandan Rao', category: 'dance' } },
];

const flush = () => act(() => new Promise((r) => setTimeout(r, 0)));
const click = (el) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const $ = (id) => document.querySelector(`[data-testid="${id}"]`);

let container, root;
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });

test('profile card opens a detail; reject confirms and posts once, then the detail closes', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  let queue = PROFILES;
  axios.get.mockImplementation(() => Promise.resolve({ data: queue }));
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<AdminProfiles />));
  await flush();

  const card = $('profile-card-c1');
  expect(card.textContent).toContain('Chandan Rao');
  expect(card.textContent).toContain('ch•••@gmail.com');
  expect(card.textContent).toContain('Creator');

  await click(card);
  expect($('profile-detail').textContent).toContain('•••• 3210');
  expect($('profile-detail').textContent).toContain('dance');
  await click($('profile-detail-back'));
  expect($('profile-detail')).toBeNull();

  await click($('profile-card-c1'));
  await click($('profile-reject'));
  expect(axios.post).not.toHaveBeenCalled();
  let resolvePost;
  axios.post.mockImplementation(() => new Promise((r) => { resolvePost = r; }));
  await click($('profile-reject-confirm'));
  await click($('profile-reject-confirm'));
  expect(axios.post).toHaveBeenCalledTimes(1);
  expect(axios.post.mock.calls[0][1]).toEqual({ item_id: 'c1', action: 'reject', reason: 'Profile does not meet requirements' });
  queue = [];
  await act(async () => resolvePost({ data: {} }));
  await flush();
  expect($('profile-detail')).toBeNull();
  expect(container.textContent).toContain('No pending profile approvals');
});
