import { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { toast } from 'sonner';
import Legal from './Legal';
import NotFound from './NotFound';
import TeamAccept from './TeamAccept';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('../../shell/AppShell', () => ({ children }) => <div>{children}</div>);
const mockNavigate = jest.fn();
const mockLogin = jest.fn();
let mockUser = null;
let mockPath = '/terms';
let mockSearch = '';
jest.mock('../../../App', () => ({ useAuth: () => ({ user: mockUser, login: mockLogin }), homeForUser: () => '/dashboard/admin' }));
jest.mock('../../../lib/liveUpdates', () => ({ useLiveEffect: require('react').useEffect }));
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPath }),
  useSearchParams: () => [new URLSearchParams(mockSearch)],
  Link: ({ to, children, replace, ...p }) => <a href={to} {...p}>{children}</a>,
}));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
async function mount(El) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<El />); });
  await flush();
  return { host, unmount: () => act(() => root.unmount()) };
}
const byText = (re, scope = document) => [...scope.querySelectorAll('button')].find((b) => re.test(b.textContent));
async function setValue(input, value) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

beforeEach(() => { jest.clearAllMocks(); mockUser = null; mockSearch = ''; });

test('Legal renders the document for the path while logged out, with links to the other policies', async () => {
  mockPath = '/cookie-policy';
  const { host, unmount } = await mount(Legal);
  expect(host.textContent).toContain('Cookie Policy');
  expect(host.textContent).toContain('What are cookies');
  expect(host.textContent).toContain('Last updated: July 2026');
  expect(host.querySelector('a[href="/terms"]')).toBeTruthy();
  expect(host.querySelector('a[href="/cookie-policy"]')).toBeNull();
  await unmount();
});

test('Legal renders the full terms document', async () => {
  mockPath = '/terms';
  const { host, unmount } = await mount(Legal);
  expect(host.querySelector('.ap-pub-top h1').textContent).toBe('Terms and Conditions');
  expect(host.querySelectorAll('section.ap-pub-sec').length).toBeGreaterThan(3);
  await unmount();
});

test('NotFound: Home goes to the role landing screen (logged out: /)', async () => {
  let m = await mount(NotFound);
  expect(m.host.textContent).toContain('This page isn’t here');
  await act(async () => { byText(/Go to home/, m.host).click(); });
  expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  await m.unmount();
  mockUser = { role: 'business' };
  m = await mount(NotFound);
  await act(async () => { byText(/^Home$/, m.host).click(); });
  expect(mockNavigate).toHaveBeenLastCalledWith('/brand-home', { replace: true });
  await m.unmount();
});

test('TeamAccept: bad link says invalid; a good link validates the password rules then accepts and signs in', async () => {
  mockSearch = 'token=bad';
  axios.get.mockRejectedValueOnce({ response: { status: 404 } });
  let m = await mount(TeamAccept);
  expect(m.host.textContent).toContain('Invitation not valid');
  await m.unmount();

  mockSearch = 'token=good';
  axios.get.mockResolvedValue({ data: { brand_name: 'Glow Labs', role: 'manager', email: 'a@glow.in' } });
  axios.post.mockResolvedValue({ data: { token: 'jwt', id: 'u1', role: 'business' } });
  m = await mount(TeamAccept);
  expect(m.host.textContent).toContain('Join Glow Labs');
  const [name, pw, pw2] = m.host.querySelectorAll('input');
  await setValue(name, 'Ananya');
  await setValue(pw, '123');
  await act(async () => { byText(/Accept/, m.host).click(); });
  expect(toast.error).toHaveBeenCalledWith('Password must be at least 6 characters.');
  await setValue(pw, 'secret1');
  await setValue(pw2, 'secret2');
  await act(async () => { byText(/Accept/, m.host).click(); });
  expect(toast.error).toHaveBeenLastCalledWith('Passwords do not match.');
  expect(axios.post).not.toHaveBeenCalled();
  await setValue(pw2, 'secret1');
  await act(async () => { byText(/Accept/, m.host).click(); });
  await flush();
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/team/accept'), { token: 'good', password: 'secret1', name: 'Ananya' });
  expect(mockLogin).toHaveBeenCalledWith('jwt', { id: 'u1', role: 'business' });
  expect(mockNavigate).toHaveBeenCalledWith('/dashboard/business/browse-creator');
  await m.unmount();
});

test('TeamAccept: no response from the server offers Try again, not "invalid"', async () => {
  mockSearch = 'token=good';
  axios.get.mockRejectedValue({});
  const { host, unmount } = await mount(TeamAccept);
  expect(host.textContent).toContain('Can’t reach UGCad.io');
  expect(byText(/Try again/, host)).toBeTruthy();
  await unmount();
});
