import fs from 'fs';
import path from 'path';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import BrandCreators from './BrandCreators';

// Browse Creators: card shows the FULL name + price, and the "preferred" collection wording.
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() }));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('../components/BrandTopNavLayout', () => ({ children }) => <div>{children}</div>);
jest.mock('../components/ChatPopup', () => () => null);
let mockSearch = '';
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useSearchParams: () => [new URLSearchParams(mockSearch), jest.fn()],
  Link: ({ children, to, ...rest }) => <a href={typeof to === 'string' ? to : (to.search || '')} {...rest}>{children}</a>,
}));
jest.mock('../lib/liveUpdates', () => ({ useLiveEffect: require('react').useEffect }));
jest.mock('../utils/savedCreators', () => ({
  useSavedCreatorIds: () => new Set(),
  toggleSavedCreator: jest.fn(() => Promise.resolve(true)),
}));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const creators = [
  { id: 'c1', first_name: 'Devanshika', categories: ['fashion', 'beauty', 'home'], budget_range: '2000', ugcad_approved: true, deliverables_completed: 7 },
  { id: 'c2', first_name: 'Asha', categories: ['food'], ugcad_approved: false, deliverables_completed: 3 },
];

async function mount() {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<BrandCreators />));
  return { host, done: async () => { await act(async () => root.unmount()); host.remove(); } };
}

beforeAll(() => {
  window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
  window.IntersectionObserver = window.IntersectionObserver || class { observe() {} disconnect() {} };
});
beforeEach(() => { jest.clearAllMocks(); mockSearch = ''; axios.get.mockResolvedValue({ data: creators }); });

test('creator card shows the whole name and the price per video, never a delivered count', async () => {
  const { host, done } = await mount();
  const names = [...host.querySelectorAll('.bui-gig-name')].map((n) => n.textContent);
  expect(names).toEqual(['Devanshika', 'Asha']);
  const prices = [...host.querySelectorAll('.bui-gig-price')].map((n) => n.textContent);
  expect(prices).toEqual(['From \u20b92,000', 'Rate on request']);
  expect(host.textContent).not.toMatch(/delivered/i);
  await done();
});

test('no delivery data: no delivery text and the bar keeps the ID verified switch', async () => {
  const { host, done } = await mount();
  expect(host.querySelectorAll('.bui-gig-deliv')).toHaveLength(0);
  expect(host.textContent).toContain('ID verified');
  expect(host.textContent).not.toContain('Delivers in 3 days');
  await done();
});

test('delivery_days on the card shows "N-day delivery" and the Delivers in 3 days switch filters', async () => {
  axios.get.mockResolvedValue({ data: [{ ...creators[0], delivery_days: 2 }, { ...creators[1], delivery_days: 5 }] });
  const { host, done } = await mount();
  expect([...host.querySelectorAll('.bui-gig-deliv')].map((n) => n.textContent)).toEqual(['· 2-day delivery', '· 5-day delivery']);
  expect(host.textContent).not.toContain('ID verified');
  const sw = [...host.querySelectorAll('button[role="switch"]')].find((b) => b.textContent.includes('Delivers in 3 days'));
  await act(async () => sw.click());
  expect([...host.querySelectorAll('.bui-gig-name')].map((n) => n.textContent)).toEqual(['Devanshika']);
  await done();
});

test('Browse page links to the preferred collection with the agreed wording', async () => {
  const { host, done } = await mount();
  expect(host.querySelector('.bc-approved-link').textContent).toContain('Meet Our Preferred Creators');
  expect(host.textContent).not.toContain('Approved by Our UGCAD Team');
  await done();
});

test('preferred collection page heading, subtitle and only the flagged creators', async () => {
  mockSearch = 'collection=ugcad-approved';
  const { host, done } = await mount();
  expect(host.querySelector('h1').textContent).toBe('Preferred Creators by the UGCAD Team');
  expect(host.querySelectorAll('.bui-gig-name')).toHaveLength(1);
  expect(host.textContent).toContain('Devanshika');
  await done();
});

// Names collapsed to "D..." when category chips sat beside them: the name row holds only
// the name, the KYC tick and the level badge.
test('the name row carries no category chips', async () => {
  const { host, done } = await mount();
  expect(host.querySelectorAll('.bui-gig-who .cat-rail')).toHaveLength(0);
  expect(host.querySelectorAll('.bui-gig-who .bui-lvl').length).toBeGreaterThan(0);
  await done();
});
