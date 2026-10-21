// A saved login the server rejects (401 from the auth dependency) must send the user back to sign-in.
jest.mock('axios', () => {
  const rejectHandlers = [];
  const fn = jest.fn();
  fn.interceptors = { request: { use: jest.fn() }, response: { use: jest.fn((ok, rej) => rejectHandlers.push(rej)) } };
  fn.getAdapter = jest.fn(() => jest.fn());
  fn.defaults = { adapter: [] };
  fn.getUri = jest.fn(() => '');
  fn.rejectHandlers = rejectHandlers;
  return { __esModule: true, default: fn };
});
jest.mock('sonner', () => ({ Toaster: () => null, toast: { success: jest.fn(), error: jest.fn() } }));

const axios = require('axios').default;
require('./App');

const rejected = axios.rejectHandlers[axios.rejectHandlers.length - 1];
const err = (url, status, detail) => ({ config: { url, method: 'post' }, response: { status, data: { detail } } });

let replace;
beforeEach(() => {
  replace = jest.fn();
  delete window.location;
  window.location = { pathname: '/my-deals', search: '?tab=a', replace };
  delete window.__ugcadSessionEnded;
  localStorage.setItem('token', 't');
});

test('expired token on an app page clears the token and goes to /auth with ?next', async () => {
  await expect(rejected(err('http://x/api/bids', 401, 'Token expired'))).rejects.toBeDefined();
  expect(localStorage.getItem('token')).toBeNull();
  expect(replace).toHaveBeenCalledWith('/auth?next=%2Fmy-deals%3Ftab%3Da');
});

test('a wrong password (401 from /auth/login) is left to the form', async () => {
  await expect(rejected(err('http://x/api/auth/login', 401, 'Invalid credentials'))).rejects.toBeDefined();
  expect(localStorage.getItem('token')).toBe('t');
  expect(replace).not.toHaveBeenCalled();
});

test('on a public page the token is cleared but the page is not reloaded', async () => {
  window.location.pathname = '/terms';
  await expect(rejected(err('http://x/api/bids', 401, 'Invalid token'))).rejects.toBeDefined();
  expect(localStorage.getItem('token')).toBeNull();
  expect(replace).not.toHaveBeenCalled();
});

test('a 403 does not end the session', async () => {
  await expect(rejected(err('http://x/api/admin/x', 403, 'Forbidden'))).rejects.toBeDefined();
  expect(localStorage.getItem('token')).toBe('t');
});
