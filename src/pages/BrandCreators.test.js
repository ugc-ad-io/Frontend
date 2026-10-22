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
  const names = [...host.querySelectorAll('.bc-name-top strong')].map((n) => n.textContent);
  expect(names).toEqual(['Devanshika', 'Asha']);
  const prices = [...host.querySelectorAll('.bc-price-txt')].map((n) => n.textContent);
  expect(prices).toEqual(['Rs. 2,000 / video', 'Rate on request']);
  expect(host.textContent).not.toMatch(/delivered/i);
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
  expect(host.querySelectorAll('.bc-name-top strong')).toHaveLength(1);
  expect(host.textContent).toContain('Devanshika');
  await done();
});

// jsdom does no layout, so guard the CSS rule that stopped names collapsing to "D...":
// the card's chip rail must take its own line instead of sitting beside the name.
test('category chips wrap under the name instead of squeezing it', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'styles', 'creator-marketplace.css'), 'utf8');
  expect(css).toMatch(/\.bc-name-top\{flex-wrap:wrap\}/);
  expect(css).toMatch(/\.cat-rail-card\{flex:1 1 100%;margin-left:0;max-width:100%\}/);
});
