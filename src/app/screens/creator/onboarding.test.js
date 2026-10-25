import { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { toast } from 'sonner';
import Signup from './Signup';
import Kyc from './Kyc';
import Setup from './Setup';

const mockNavigate = jest.fn();
const mockLogin = jest.fn();
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn() }));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn(), message: jest.fn() } }));
jest.mock('../../shell/AppShell', () => ({ children }) => <div>{children}</div>);
jest.mock('../../../App', () => {
  const value = { user: { id: 'cr-1', role: 'creator' }, setUser: () => {}, login: (...a) => mockLogin(...a), logout: () => {} };
  return { useAuth: () => value };
});
jest.mock('../../../lib/liveUpdates', () => ({ useLiveEffect: require('react').useEffect }));
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const flush = () => act(async () => { for (let i = 0; i < 6; i += 1) await Promise.resolve(); });
async function mount(El) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<El />); });
  await flush();
  return { host, unmount: () => act(() => root.unmount()) };
}
const btn = (re, scope = document) => [...scope.querySelectorAll('button')].find((b) => re.test(b.textContent));
const setValue = (input, value) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
const submit = (form) => act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });

beforeEach(() => { jest.clearAllMocks(); document.body.innerHTML = ''; });

test('signup validates the phone, then creates the account and goes to profile setup', async () => {
  axios.post.mockResolvedValue({ data: { token: 't1', id: 'cr-9', role: 'creator' } });
  const { host, unmount } = await mount(Signup);
  await setValue(host.querySelector('#cs-email'), 'a@b.co');
  await setValue(host.querySelector('#cs-password'), 'password1');
  await setValue(host.querySelector('#cs-phone'), '12345');
  await submit(host.querySelector('form'));
  expect(toast.error).toHaveBeenCalledWith('Enter a valid 10-digit mobile number');
  expect(axios.post).not.toHaveBeenCalled();

  await setValue(host.querySelector('#cs-phone'), '9876543210');
  await submit(host.querySelector('form'));
  await flush();
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/auth/signup'), { email: 'a@b.co', password: 'password1', role: 'creator', phone: '9876543210', dial_code: '+91' });
  expect(mockLogin).toHaveBeenCalledWith('t1', { id: 'cr-9', role: 'creator' });
  expect(mockNavigate).toHaveBeenCalledWith('/profile-setup/creator');
  await unmount();
});

test('kyc: nothing submitted shows the step form and blocks an empty first step', async () => {
  axios.get.mockResolvedValue({ data: { status: 'not_submitted' } });
  const { host, unmount } = await mount(Kyc);
  expect(host.textContent).toContain('Step 1 of 4');
  await act(async () => { btn(/^Next/, host).click(); });
  expect(toast.error).toHaveBeenCalledWith('Enter your full legal name.');
  expect(host.textContent).toContain('Step 1 of 4');
  await unmount();
});

test('kyc: a failed status load shows Retry instead of an empty form', async () => {
  axios.get.mockRejectedValue({ response: { status: 500 } });
  const { host, unmount } = await mount(Kyc);
  expect(btn(/Retry/, host)).toBeTruthy();
  expect(host.querySelector('#k-name')).toBeNull();
  await unmount();
});

test('setup: the first step needs a photo, name and Instagram link before moving on', async () => {
  const { host, unmount } = await mount(Setup);
  expect(host.textContent).toContain('Step 1 of 3');
  await act(async () => { btn(/Next: your videos/, host).click(); });
  expect(host.textContent).toContain('A profile photo is required');
  expect(host.textContent).toContain('This field is required');
  expect(host.textContent).toContain('Step 1 of 3');
  await unmount();
});
