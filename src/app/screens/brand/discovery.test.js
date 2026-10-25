import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import Creators from './Creators';
import Saved from './Saved';
import Home from './Home';
import { __resetSavedCreators } from '../../../utils/savedCreators';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), delete: jest.fn() }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
let mockUser;
let mockSearch = '';
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/x', search: mockSearch }),
  useParams: () => ({ id: 'c1' }),
  matchPath: () => null,
  useSearchParams: () => [new URLSearchParams(mockSearch), jest.fn()],
}));
jest.mock('../../../App', () => ({ useAuth: () => ({ user: mockUser, logout: jest.fn() }) }));

const CREATORS = [
  { id: 'c1', nickname: 'Priya Das', categories: ['beauty'], rate_card: { expected_payout: '4000' }, ugcad_approved: true, level: 'l2' },
  { id: 'c2', nickname: 'Kabir Singh', categories: ['fitness'], rate_card: { expected_payout: '2500' }, level: 'l1' },
];
const mount = async (ui) => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(ui));
  await act(async () => { await new Promise((r) => setTimeout(r, 30)); });
  return { container, unmount: () => act(async () => { root.unmount(); container.remove(); }) };
};
const setVal = (el, v) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};
const click = (el) => act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })); await new Promise((r) => setTimeout(r, 30)); });

beforeEach(() => {
  jest.clearAllMocks();
  __resetSavedCreators();
  mockUser = { role: 'business', approval_status: 'approved', profile: { business_name: 'Glow Labs' } };
  axios.get.mockImplementation((url) => {
    if (/creator-directory/.test(url)) return Promise.resolve({ data: CREATORS });
    if (/saved-creators$/.test(url)) return Promise.resolve({ data: { creator_ids: ['c1'] } });
    if (/business\/wallet/.test(url)) return Promise.resolve({ data: { available_balance: 5000 } });
    return Promise.resolve({ data: [] });
  });
  axios.post.mockResolvedValue({ data: {} });
  axios.delete.mockResolvedValue({ data: {} });
});

test('Creators lists the directory and shows the no-results state for an unknown search', async () => {
  const { container, unmount } = await mount(<Creators />);
  expect(container.textContent).toContain('Priya');
  expect(container.textContent).toContain('Kabir');
  expect(axios.get).toHaveBeenCalledWith(expect.stringMatching(/\/business\/creator-directory$/), { params: { discovery_only: true } });
  await act(async () => setVal(container.querySelector('input[type="search"]'), 'zzz'));
  expect(container.textContent).toContain('No creators for “zzz” yet');
  expect(container.textContent).toContain('Post a campaign');
  await unmount();
});

test('Creators shows an error with Try again when the directory fails', async () => {
  axios.get.mockImplementation((url) => (/creator-directory/.test(url)
    ? Promise.reject({ response: { status: 500, data: { detail: 'Boom' } } })
    : Promise.resolve({ data: [] })));
  const { container, unmount } = await mount(<Creators />);
  expect(container.textContent).toContain('Could not load creators');
  expect(container.textContent).toContain('Boom');
  axios.get.mockImplementation(() => Promise.resolve({ data: CREATORS }));
  await click([...container.querySelectorAll('button')].find((b) => b.textContent === 'Try again'));
  expect(container.textContent).toContain('Priya');
  await unmount();
});

test('Saved shows only saved creators and unsaves through the API', async () => {
  const { container, unmount } = await mount(<Saved />);
  expect(container.textContent).toContain('Priya');
  expect(container.textContent).not.toContain('Kabir');
  await click(container.querySelector('[aria-label="Remove Priya from saved"]'));
  expect(axios.delete).toHaveBeenCalledWith(expect.stringMatching(/saved-creators\/c1$/));
  await unmount();
});

test('Home for a brand with no campaigns shows the first-video checklist', async () => {
  const { container, unmount } = await mount(<Home />);
  expect(container.textContent).toContain('Get your first video');
  expect(container.textContent).toContain('Welcome to UGCad, Glow Labs');
  expect(container.textContent).toContain('NEXT STEP');
  await unmount();
});

test('A brand that is still pending review sees the approval screen instead of the page', async () => {
  mockUser = { role: 'business', approval_status: 'pending', profile: { business_name: 'Glow Labs' } };
  const { container, unmount } = await mount(<Creators />);
  expect(container.querySelector('[data-testid^="gate"]')).toBeTruthy();
  expect(container.querySelector('input[type="search"]')).toBeNull();
  await unmount();
});
