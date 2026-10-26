import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import Briefs from './Briefs';
import SavedBriefs from './SavedBriefs';
import Bids from './Bids';
import Home from './Home';

const mockNav = jest.fn();
jest.mock('react-router-dom', () => {
  const React = require('react');
  return {
    useNavigate: () => mockNav,
    useLocation: () => ({ pathname: '/browse-briefs' }),
    useSearchParams: () => {
      const [p, setP] = React.useState(() => new URLSearchParams(global.__qs || ''));
      return [p, (n) => setP(new URLSearchParams(n))];
    },
  };
});
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), delete: jest.fn() }));
jest.mock('../../../App', () => ({
  useAuth: () => ({ user: global.__user, setUser: jest.fn(), logout: jest.fn() }),
}));

const iso = (d) => new Date(Date.now() + d * 86400000).toISOString();
const camp = (id, over = {}) => ({
  id, status: 'active', visibility: 'public', title: `Brief ${id}`, brand_name: 'Glow Labs', budget_min: 5000, budget_max: 12000,
  creators_wanted: 1, selected_creators: [], bids: [], created_at: iso(-1), final_delivery_by: iso(3),
  deliverable_items: [{ type: 'Reel', quantity: 1, duration: '30s' }], ...over,
});
const ME = { id: 'u1', role: 'creator', approval_status: 'approved', kyc: { status: 'verified' } };
const route = (map) => axios.get.mockImplementation((url) => {
  const hit = Object.entries(map).find(([k]) => url.includes(k));
  return hit ? Promise.resolve({ data: typeof hit[1] === 'function' ? hit[1](url) : hit[1] }) : Promise.reject(new Error('unmocked ' + url));
});

const setVal = (el, v) => {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};
const click = (el) => act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const mount = async (ui) => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(ui));
  await flush();
  return { container, unmount: () => act(async () => { root.unmount(); container.remove(); }) };
};
const byText = (root, sel, text) => [...root.querySelectorAll(sel)].find((e) => e.textContent.trim() === text);

beforeEach(() => {
  jest.clearAllMocks();
  axios.delete.mockResolvedValue({ data: {} });
  global.__user = ME;
  global.__qs = '';
  localStorage.clear();
});

test('Find briefs: lists open briefs, applies through KYC-checked flow with the website bid payload', async () => {
  route({
    '/campaigns': [camp('c1'), camp('c2', { status: 'completed' })],
    '/deals/my': [],
    '/saved-briefs': { campaign_ids: [] },
    '/creator/bid-readiness': { can_bid: true, missing: [], commission_percent: 20 },
  });
  axios.post.mockResolvedValue({ data: {} });
  const { container, unmount } = await mount(<Briefs />);
  expect(container.textContent).toContain('Brief c1');
  expect(container.textContent).not.toContain('Brief c2'); // closed briefs are not listed
  await click(container.querySelector('.ap-bf-card'));
  await click(byText(document.body, '.ap-bf-dfoot .ap-btn', 'Apply with a bid'));
  await flush();
  expect(document.body.textContent).toContain('Platform fee: 20%');
  await click(byText(document.body, '.ap-sheet button', 'Continue to bid'));
  const form = document.getElementById('ap-apply-form');
  await act(async () => {
    const f = form.querySelectorAll('input,textarea');
    setVal(f[0], '9000'); setVal(f[1], '4'); setVal(f[2], 'I film morning routines');
  });
  await act(async () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/campaigns/c1/bid'), {
    campaign_id: 'c1', amount: 9000, proposal: 'I film morning routines', estimated_delivery_days: 4,
  });
  await unmount();
});

test('Find briefs: unverified KYC sends the creator to /kyc instead of the bid form; load failure shows Retry', async () => {
  global.__user = { ...ME, kyc: { status: 'pending' } };
  route({ '/campaigns': [camp('c1')], '/deals/my': [], '/saved-briefs': { campaign_ids: [] }, '/creator/bid-readiness': { can_bid: true, missing: [] } });
  const a = await mount(<Briefs />);
  await click(a.container.querySelector('.ap-bf-card'));
  await click(byText(document.body, '.ap-bf-dfoot .ap-btn', 'Apply with a bid'));
  await flush();
  expect(mockNav).toHaveBeenCalledWith('/kyc');
  expect(document.getElementById('ap-apply-form')).toBeNull();
  await a.unmount();

  axios.get.mockRejectedValue(new Error('network'));
  const b = await mount(<Briefs />);
  expect(b.container.textContent).toContain("You're offline");
  expect(byText(b.container, 'button', 'Retry')).toBeTruthy();
  await b.unmount();
});

test('Saved briefs: empty state offers Find briefs; a saved brief renders and can be removed', async () => {
  route({ '/saved-briefs': { campaign_ids: [] } });
  const a = await mount(<SavedBriefs />);
  expect(a.container.textContent).toContain('No saved briefs yet');
  await click(byText(a.container, 'button', 'Find briefs'));
  expect(mockNav).toHaveBeenCalledWith('/browse-briefs');
  await a.unmount();

  localStorage.setItem('ugc_saved_briefs', JSON.stringify([{ id: 's1', title: 'Saved one', brand: 'Kesar', tags: [], budget: 'Rs. 5,000', budgetMax: 5000, createdAt: 0 }]));
  route({ '/saved-briefs': { campaign_ids: ['s1'] } });
  const b = await mount(<SavedBriefs />);
  expect(b.container.textContent).toContain('Saved one');
  await click(b.container.querySelector('.ap-bf-save'));
  expect(axios.delete).toHaveBeenCalledWith(expect.stringContaining('/saved-briefs/s1'));
  expect(JSON.parse(localStorage.getItem('ugc_saved_briefs'))).toHaveLength(0);
  await b.unmount();
});

test('Applied: groups bids by status and opens the order for a picked bid', async () => {
  route({
    '/bids/my': [
      { campaign: camp('w1', { title: 'Won brief' }), my_bid: { id: 'b1', amount: 5000, status: 'approved' }, bid_status: 'approved' },
      { campaign: camp('p1', { title: 'Waiting brief' }), my_bid: { id: 'b2', amount: 4000, status: 'pending' }, bid_status: 'pending' },
      { campaign: camp('r1', { title: 'Lost brief' }), my_bid: { id: 'b3', amount: 3000, status: 'rejected' }, bid_status: 'rejected' },
    ],
  });
  const { container, unmount } = await mount(<Bids />);
  expect(container.textContent).toContain('Needs you');
  expect(container.textContent).toContain('Waiting on brand');
  expect(container.textContent).toContain('Closed');
  await click(byText(container, 'button', 'Open order'));
  expect(mockNav).toHaveBeenCalledWith('/my-deals?campaign=w1');
  await click(byText(container, '.ap-chip', 'Rejected (1)'));
  expect(container.textContent).toContain('Lost brief');
  expect(container.textContent).not.toContain('Waiting brief');
  await unmount();
});

test('Home: shows earnings and active orders; pending approval renders the same gate as the website', async () => {
  route({
    '/campaigns?status=completed': [],
    '/campaigns': [camp('a1', { status: 'in_progress', selected_creators: ['u1'], title: 'Yoga mat order', bids: [{ creator_id: 'u1', amount: 6000 }] }), camp('c9', { title: 'Open brief' })],
    '/reviews/creator': [],
    '/payout/overview': { balance: 18400, pending_release: 21000, pending_deals_count: 2, paid_this_month: 0 },
    '/deals/my': [],
    '/auth/me': ME,
    '/saved-briefs': { campaign_ids: [] },
  });
  const a = await mount(<Home />);
  expect(a.container.textContent).toContain('₹18,400');
  expect(a.container.textContent).toContain('Yoga mat order');
  await click(byText(a.container, 'button', 'Open'));
  expect(mockNav).toHaveBeenCalledWith('/my-deals?campaign=a1');
  await a.unmount();

  global.__user = { ...ME, approval_status: 'pending' };
  const b = await mount(<Home />);
  expect(b.container.textContent).toContain('We’re checking your profile');
  expect(b.container.textContent).not.toContain('Yoga mat order');
  await b.unmount();
});

describe('search on every tab filters as you type (no Enter)', () => {
  const type = async (c, v) => {
    await act(async () => setVal(c.querySelector('.ap-bf-search input'), v));
    await act(async () => { await new Promise((r) => setTimeout(r, 350)); }); // past the 300ms auto-search pause
  };
  const deal = (id, title, brand) => ({ deal_id: id, brand: { name: brand }, campaign: { id, title, booking_status: 'pending_creator', budget_max: 3000 } });

  test('For you + Invites', async () => {
    route({ '/campaigns': [camp('c1', { title: 'Serum launch' }), camp('c2', { title: 'Yoga mat', brand_name: 'Zen' })], '/deals/my': [deal('d1', 'Lipstick reel', 'Kesar'), deal('d2', 'Sneaker haul', 'Stride')], '/saved-briefs': { campaign_ids: [] } });
    const a = await mount(<Briefs />);
    await type(a.container, 'zen');
    expect(a.container.textContent).toContain('Yoga mat');
    expect(a.container.textContent).not.toContain('Serum launch');
    await a.unmount();

    global.__qs = 'tab=invites';
    const b = await mount(<Briefs />);
    expect(b.container.textContent).toContain('Sneaker haul');
    await type(b.container, 'kesar');
    expect(b.container.textContent).toContain('Lipstick reel');
    expect(b.container.textContent).not.toContain('Sneaker haul');
    await type(b.container, 'nothing');
    expect(b.container.textContent).toContain('No matches for “nothing”');
    await click(byText(b.container, 'button', 'Clear search'));
    expect(b.container.textContent).toContain('Sneaker haul');
    await b.unmount();
  });

  test('Applied tab + Saved screen', async () => {
    global.__qs = 'tab=applied';
    route({
      '/campaigns': [], '/deals/my': [], '/saved-briefs': { campaign_ids: [] },
      '/bids/my': [
        { campaign: camp('p1', { title: 'Waiting brief' }), my_bid: { id: 'b2', amount: 4000, status: 'pending' }, bid_status: 'pending' },
        { campaign: camp('r1', { title: 'Lost brief', brand_name: 'Orbit' }), my_bid: { id: 'b3', amount: 3000, status: 'rejected' }, bid_status: 'rejected' },
      ],
    });
    const a = await mount(<Briefs />);
    await type(a.container, 'orbit');
    expect(a.container.textContent).toContain('Lost brief');
    expect(a.container.textContent).not.toContain('Waiting brief');
    await type(a.container, 'zzz');
    expect(a.container.textContent).toContain('No matches for “zzz”');
    await a.unmount();

    global.__qs = '';
    localStorage.setItem('ugc_saved_briefs', JSON.stringify([
      { id: 's1', title: 'Saved one', brand: 'Kesar', tags: [], budget: 'Rs. 5,000', budgetMax: 5000, createdAt: 0 },
      { id: 's2', title: 'Saved two', brand: 'Orbit', tags: [], budget: 'Rs. 5,000', budgetMax: 5000, createdAt: 0 },
    ]));
    route({ '/saved-briefs': { campaign_ids: ['s1', 's2'] } });
    const b = await mount(<SavedBriefs />);
    await type(b.container, 'orbit');
    expect(b.container.textContent).toContain('Saved two');
    expect(b.container.textContent).not.toContain('Saved one');
    await b.unmount();
  });
});
