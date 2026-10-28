import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import Auth from './Auth';
import Settings from './Settings';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() }));
const mockLogin = jest.fn();
const mockLogout = jest.fn();
let mockUser = null;
jest.mock('../../../App', () => ({ useAuth: () => ({ user: mockUser, login: mockLogin, logout: mockLogout, setUser: jest.fn() }) }));

const mockNavigate = jest.fn();
let mockSearch = '';
// react-router resolves a second React copy under jest, so the few hooks the screens use are stubbed.
jest.mock('react-router-dom', () => {
  const R = require('react');
  return {
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/x' }),
    useSearchParams: () => { const [s, set] = R.useState(() => new URLSearchParams(mockSearch)); return [s, (v) => set(new URLSearchParams(v))]; },
  };
});
const setVal = (el, v) => {
  const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
};
const click = (el) => act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const btn = (c, text) => [...c.querySelectorAll('button')].find((b) => b.textContent.includes(text));
async function mount(ui, search = '') {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  mockSearch = search;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(ui));
  return { container, unmount: () => act(async () => { root.unmount(); container.remove(); }) };
}

beforeEach(() => { jest.clearAllMocks(); mockUser = null; localStorage.clear(); });

test('log in: validates, posts /auth/login, then routes a creator to the dashboard', async () => {
  axios.post.mockResolvedValue({ data: { token: 't', role: 'creator', profile_completed: true, user_id: 'c1' } });
  const { container, unmount } = await mount(<Auth />, '?view=auth');
  expect(container.textContent).toContain('Real creators');
  await click(container.querySelector('[data-testid="submit-btn"]'));
  expect(axios.post).not.toHaveBeenCalled();
  expect(container.textContent).toContain('Enter your email.');
  await act(async () => { setVal(container.querySelector('#email'), 'a@b.co'); setVal(container.querySelector('#password'), 'mock-pw'); });
  await click(container.querySelector('[data-testid="submit-btn"]'));
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/auth/login'), { email: 'a@b.co', password: 'mock-pw' });
  expect(mockLogin).toHaveBeenCalledWith('t', expect.objectContaining({ role: 'creator' }));
  expect(mockNavigate).toHaveBeenCalledWith('/dashboard/creator');
  await unmount();
});

test('sign up as brand: needs a valid mobile, posts role + phone, goes to brand setup', async () => {
  axios.post.mockResolvedValue({ data: { token: 't', role: 'business', profile_completed: false } });
  const { container, unmount } = await mount(<Auth />, '?mode=signup');
  await click(container.querySelector('[data-testid="role-business-btn"]'));
  await act(async () => { setVal(container.querySelector('#email'), 'b@c.co'); setVal(container.querySelector('#phone'), '123'); setVal(container.querySelector('#password'), 'abcdef'); });
  await click(container.querySelector('[data-testid="submit-btn"]'));
  expect(axios.post).not.toHaveBeenCalled();
  expect(container.textContent).toContain('Enter a valid 10-digit mobile number.');
  await act(async () => { setVal(container.querySelector('#phone'), '9876543210'); });
  await click(container.querySelector('[data-testid="submit-btn"]'));
  expect(axios.post).not.toHaveBeenCalled(); // the Terms/Privacy tick is mandatory
  await click(container.querySelector('[data-testid="terms-checkbox"]'));
  await click(container.querySelector('[data-testid="submit-btn"]'));
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/auth/signup'), { email: 'b@c.co', password: 'abcdef', role: 'business', phone: '9876543210', dial_code: '+91', terms_accepted: true });
  expect(mockNavigate).toHaveBeenCalledWith('/profile-setup/business');
  await unmount();
});

test('forgot password: sends the code request and moves to code entry', async () => {
  axios.post.mockResolvedValue({ data: {} });
  const { container, unmount } = await mount(<Auth />, '?view=auth');
  await act(async () => { setVal(container.querySelector('#email'), 'a@b.co'); });
  await click(container.querySelector('[data-testid="forgot-password-btn"]'));
  await act(async () => { setVal(container.querySelector('#forgot-email'), 'a@b.co'); });
  await click(container.querySelector('[data-testid="forgot-submit-btn"]'));
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/auth/forgot-password'), { email: 'a@b.co' });
  expect(container.querySelector('#reset-code')).not.toBeNull();
  await unmount();
});

test('settings (creator): loads prefs, opens notifications, saves toggles via /profile/preferences', async () => {
  mockUser = { id: 'c1', role: 'creator', email: 'p@x.co', nickname: 'Priya' };
  axios.get.mockImplementation((u) => (u.includes('/auth/me') ? Promise.resolve({ data: { notification_prefs: { weekly_digest: false } } }) : Promise.resolve({ data: {} })));
  axios.put.mockResolvedValue({ data: {} });
  const { container, unmount } = await mount(<Settings />, '');
  expect(container.textContent).toContain('Priya');
  await click(btn(container, 'Notification preferences'));
  await click(container.querySelector('[aria-label="Toggle Weekly digest"]'));
  await click(btn(container, 'Save preferences'));
  expect(axios.put).toHaveBeenCalledWith(expect.stringContaining('/profile/preferences'), { notification_prefs: expect.objectContaining({ weekly_digest: true }) });
  await unmount();
});

test('settings: failed load shows an error with Retry; log out sheet calls logout', async () => {
  mockUser = { id: 'c1', role: 'creator', email: 'p@x.co' };
  axios.get.mockRejectedValueOnce({});
  const { container, unmount } = await mount(<Settings />, '');
  expect(container.textContent).toContain('Retry');
  axios.get.mockImplementation(() => Promise.resolve({ data: {} }));
  await click(btn(container, 'Retry'));
  await click(btn(container, 'Log out'));
  await click([...document.querySelectorAll('.ap-sheet button')].find((b) => b.textContent === 'Log out'));
  expect(mockLogout).toHaveBeenCalled();
  await unmount();
});

test('settings (brand): team list renders and Invite posts the email + role', async () => {
  mockUser = { id: 'b1', role: 'business', email: 'g@x.co' };
  const team = { seat_limit: 10, seats_used: 2, members: [
    { id: 'b1', name: 'Glow Labs', email: 'g@x.co', role: 'owner', status: 'active', is_owner: true },
    { id: 't2', name: 'Neha Rao', email: 'neha@x.co', role: 'member', status: 'invited' },
  ] };
  axios.get.mockImplementation((u) => Promise.resolve({ data: u.includes('/team') ? team : {} }));
  axios.post.mockResolvedValue({ data: team });
  const { container, unmount } = await mount(<Settings />, '');
  await click(btn(container, 'Team & roles'));
  expect(container.textContent).toContain('Neha Rao');
  expect(container.textContent).toContain('Invited');
  await click(btn(container, 'Invite a team member'));
  const sheet = document.querySelector('.ap-sheet');
  await act(async () => { setVal(sheet.querySelector('#inv-email'), 'new@x.co'); });
  await click([...sheet.querySelectorAll('[role="radio"]')].find((b) => b.textContent.includes('Viewer')));
  await click([...sheet.querySelectorAll('button')].find((b) => b.textContent === 'Send invitation'));
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/business/settings/team/invite'), { email: 'new@x.co', role: 'viewer' });
  await unmount();
});

describe('mobile shell sign-in', () => {
  const reply = (type, payload) => window.dispatchEvent(new CustomEvent('ugcad-native', { detail: { id: window.__posted[window.__posted.length - 1].id, type: type + ':result', payload } }));
  beforeEach(() => { window.__posted = []; window.ReactNativeWebView = { postMessage: (m) => window.__posted.push(JSON.parse(m)) }; window.__UGCAD_SHELL__ = true; });
  afterEach(() => { delete window.ReactNativeWebView; delete window.__UGCAD_SHELL__; delete window.__UGCAD_PLATFORM__; });

  test('Apple button only on iOS, above Google, and posts /auth/apple with identity_token + full_name', async () => {
    window.__UGCAD_PLATFORM__ = 'ios';
    axios.post.mockResolvedValue({ data: { token: 't', role: 'creator', profile_completed: true, user_id: 'c1' } });
    const { container, unmount } = await mount(<Auth />, '?view=auth&role=creator');
    const buttons = [...container.querySelectorAll('.ugc-social-btn')].map((b) => b.textContent);
    expect(buttons).toEqual(['Continue with Apple', 'Continue with Google']);
    await click(container.querySelector('[data-testid="apple-signin-btn"]'));
    expect(window.__posted[0].type).toBe('auth:apple');
    await act(async () => reply('auth:apple', { ok: true, identityToken: 'jwt', fullName: { givenName: 'Asha', familyName: 'Rao' } }));
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/auth/apple'), { identity_token: 'jwt', role: 'creator', full_name: 'Asha Rao' });
    expect(mockLogin).toHaveBeenCalledWith('t', expect.objectContaining({ role: 'creator' }));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard/creator');
    await unmount();
  });

  test('Android shell: Google only; cancelling Apple does nothing; Google posts the id token', async () => {
    window.__UGCAD_PLATFORM__ = 'android';
    axios.post.mockResolvedValue({ data: { token: 't', role: 'creator', profile_completed: true } });
    const { container, unmount } = await mount(<Auth />, '?view=auth');
    expect(container.querySelector('[data-testid="apple-signin-btn"]')).toBeNull();
    await click(container.querySelector('[data-testid="google-signin-btn"]'));
    await act(async () => reply('auth:google', { ok: true, idToken: 'g-id' }));
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/auth/google'), { credential: 'g-id', role: 'creator' });
    await unmount();
  });

  test('Apple cancel is silent (no request); sign-up social buttons need the Terms tick', async () => {
    window.__UGCAD_PLATFORM__ = 'ios';
    const { container, unmount } = await mount(<Auth />, '?mode=signup');
    await click(container.querySelector('.ugc-consent-cover'));
    expect(window.__posted).toHaveLength(0);
    await click(container.querySelector('[data-testid="terms-checkbox"]'));
    await click(container.querySelector('[data-testid="apple-signin-btn"]'));
    await act(async () => reply('auth:apple', { ok: false, error: 'cancelled' }));
    expect(axios.post).not.toHaveBeenCalled();
    await unmount();
  });
});
