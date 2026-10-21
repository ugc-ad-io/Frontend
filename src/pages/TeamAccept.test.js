import { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useSearchParams: () => [new URLSearchParams('token=abc')],
}));
jest.mock('../App', () => ({ useAuth: () => ({ login: jest.fn() }) }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const TeamAccept = require('./TeamAccept').default;

async function mount() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<TeamAccept />));
  await act(async () => { await Promise.resolve(); });
  return { host, root };
}

test('a 404 from the server says the invitation is not valid', async () => {
  axios.get.mockRejectedValueOnce({ response: { status: 404 } });
  const { host, root } = await mount();
  expect(host.textContent).toContain('Invitation not valid');
  await act(async () => root.unmount());
});

test('no response at all (offline) offers Try again instead of calling the link invalid', async () => {
  axios.get.mockRejectedValueOnce(new Error('Network Error'));
  const { host, root } = await mount();
  expect(host.textContent).not.toContain('Invitation not valid');
  expect(host.textContent).toContain('Try again');

  axios.get.mockResolvedValueOnce({ data: { brand_name: 'Acme', role: 'member', email: 'a@b.co' } });
  await act(async () => { host.querySelector('button.ta-btn').click(); });
  await act(async () => { await Promise.resolve(); });
  expect(host.textContent).toContain('Join Acme');
  expect(axios.get).toHaveBeenCalledTimes(2);
  await act(async () => root.unmount());
});
