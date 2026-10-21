import { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';

jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('../App', () => ({ useAuth: () => ({ user: { id: 'u1', role: 'creator' } }) }));
jest.mock('./ChatPopup', () => () => null);
jest.mock('./CreatorComponents', () => ({ getInitial: (n) => String(n || 'U').charAt(0).toUpperCase() }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const MessagesPopup = require('./MessagesPopup').default;

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

test('a failed conversation load shows a message and Retry, not "No conversations yet"', async () => {
  axios.get.mockImplementation((url) => (url.includes('/chat/conversations')
    ? Promise.reject(new Error('Network Error'))
    : Promise.resolve({ data: [] })));
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<MessagesPopup onClose={() => {}} />));
  await flush();

  expect(host.textContent).not.toContain('No conversations yet');
  const retry = host.querySelector('.mpop-retry');
  expect(retry).not.toBeNull();

  axios.get.mockImplementation((url) => Promise.resolve({
    data: url.includes('/chat/conversations')
      ? [{ user_id: 'p1', nickname: 'Priya', last_message: { message: 'hello there' }, timestamp: new Date().toISOString() }]
      : [],
  }));
  await act(async () => { retry.click(); });
  await flush();
  expect(host.querySelector('.mpop-retry')).toBeNull();
  expect(host.textContent).toContain('hello there');
  await act(async () => root.unmount());
});
