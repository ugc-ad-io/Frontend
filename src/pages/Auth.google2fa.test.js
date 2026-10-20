import { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { toast } from 'sonner';

jest.mock('axios', () => ({ post: jest.fn(), get: jest.fn() }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
const mockNavigate = jest.fn();
const mockLogin = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams('')],
}));
jest.mock('../App', () => ({ useAuth: () => ({ login: mockLogin }) }));
jest.mock('framer-motion', () => {
  const React = require('react');
  const motion = new Proxy({}, { get: (_, tag) => ({ initial, animate, exit, transition, whileTap, whileHover, ...p }) => React.createElement(tag, p) });
  return { motion, AnimatePresence: ({ children }) => children };
});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('Google sign-in that returns requires_2fa opens the code step and retries with totp_token', async () => {
  process.env.REACT_APP_GOOGLE_CLIENT_ID = 'test-client';
  let onCredential;
  window.google = { accounts: { id: {
    initialize: ({ callback }) => { onCredential = callback; },
    renderButton: jest.fn(),
  } } };
  const Auth = require('./Auth').default;
  const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<Auth />));
    expect(onCredential).toBeDefined();

    axios.post.mockResolvedValueOnce({ data: { requires_2fa: true } });
    await act(async () => { await onCredential({ credential: 'g-token' }); });
    expect(mockLogin).not.toHaveBeenCalled();
    expect(toast.success).not.toHaveBeenCalled();
    const input = host.querySelector('#totp-code');
    expect(input).not.toBeNull();

    axios.post.mockResolvedValueOnce({ data: { token: 'jwt', role: 'creator', profile_completed: true } });
    await act(async () => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
      set.call(input, '123456');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { host.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });

    const [url, body] = axios.post.mock.calls[1];
    expect(url).toMatch(/\/auth\/google\?totp_token=123456$/);
    expect(body).toMatchObject({ credential: 'g-token' });
    expect(mockLogin).toHaveBeenCalledWith('jwt', expect.objectContaining({ role: 'creator' }));
  } finally { await act(async () => root.unmount()); host.remove(); delete window.google; }
});
