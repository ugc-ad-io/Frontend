import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { toast } from 'sonner';
import Campaigns from './Campaigns';
import Bids from './Bids';
import CampaignDetail from './CampaignDetail';
import PostCampaign from './PostCampaign';

const mockNavigate = jest.fn();
let mockPath = '/dashboard/business/all-campaigns';
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPath, search: '' }),
  useParams: () => ({}),
  useSearchParams: () => [new URLSearchParams(), jest.fn()],
  matchPath: (pattern, path) => {
    const re = new RegExp(`^${pattern.replace(/:[^/]+/g, '([^/]+)')}$`);
    const m = re.exec(path);
    return m ? { params: { id: m[1] } } : null;
  },
}));
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } }));
jest.mock('../../../App', () => ({ useAuth: () => ({ user: { id: 'b1', role: 'business', profile: { business_name: 'Glow Labs' } }, logout: jest.fn() }) }));

const camp = (o = {}) => ({ id: 'c1', business_id: 'b1', title: 'Glow Serum', status: 'active', creators_wanted: 1, budget_min: 5000, budget_max: 9500, bids: [], ...o });
const bid = { id: 'bid1', creator_id: 'cr1', creator_name: 'Priya Das', amount: 9500, estimated_delivery_days: 3, proposal: 'Morning routine reel', status: 'pending' };

const mount = async (ui) => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(ui));
  return { container, unmount: () => act(async () => { root.unmount(); container.remove(); }) };
};
const click = (el) => act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const byText = (txt, sel = 'button') => [...document.querySelectorAll(sel)].find((e) => e.textContent.trim() === txt || e.textContent.includes(txt));
const route = (map) => axios.get.mockImplementation((url) => {
  const hit = Object.entries(map).find(([k]) => url.includes(k));
  return hit ? (hit[1] instanceof Error ? Promise.reject(hit[1]) : Promise.resolve({ data: hit[1] })) : Promise.resolve({ data: [] });
});

beforeEach(() => { jest.clearAllMocks(); localStorage.clear(); });

test('campaigns list: shows campaigns, then deletes a draft after the confirm sheet', async () => {
  route({ '/campaigns': [camp(), camp({ id: 'c2', title: 'Diwali Reel', status: 'draft' })] });
  axios.delete.mockResolvedValue({ data: {} });
  const { container, unmount } = await mount(<Campaigns />);
  expect(container.textContent).toContain('Glow Serum');
  expect(container.textContent).toContain('Diwali Reel');
  await click(container.querySelector('button[aria-label="Delete Diwali Reel"]'));
  expect(document.body.textContent).toContain('Delete this draft?');
  await click(byText('Delete draft'));
  expect(axios.delete).toHaveBeenCalledWith(expect.stringContaining('/campaigns/c2'));
  expect(toast.success).toHaveBeenCalledWith('Draft deleted');
  await unmount();
});

test('campaigns list: a failed load shows an error with Retry, never an empty account', async () => {
  route({ '/campaigns': new Error('boom') });
  const { container, unmount } = await mount(<Campaigns />);
  expect(container.textContent).toContain('load your campaigns');
  expect(container.textContent).not.toContain('No campaigns yet');
  const calls = axios.get.mock.calls.length;
  await click(byText('Retry'));
  expect(axios.get.mock.calls.length).toBeGreaterThan(calls);
  await unmount();
});

test('compare bids: Hire shows the escrow breakdown and confirms with select-creator', async () => {
  route({ '/business/wallet': { available_balance: 32500 }, '/campaigns': [camp({ bids: [bid] })] });
  axios.post.mockResolvedValue({ data: { slots_left: 0, amount_charged: 11400, funded: true } });
  const { container, unmount } = await mount(<Bids />);
  expect(container.textContent).toContain('Priya');
  await click(byText('Hire'));
  expect(document.body.textContent).toContain('Hire Priya?');
  expect(document.body.textContent).toContain('₹11,400');
  await click(byText('Confirm & hire'));
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/campaigns/c1/select-creator?creator_id=cr1'));
  expect(document.body.textContent).toContain('Priya is on it');
  await unmount();
});

test('campaign detail: loads the campaign by URL id and finishes hiring from the open-slots card', async () => {
  mockPath = '/dashboard/business/campaign/c1';
  route({
    '/campaigns/c1': camp({ creators_wanted: 2, selected_creators: ['cr9'], bids: [bid, { ...bid, id: 'bid9', creator_id: 'cr9', creator_name: 'Ishita Rao' }] }),
    '/profile/cr9': { full_name: 'Ishita Rao' },
  });
  axios.post.mockResolvedValue({ data: { creators_hired: 1, refunded: 16800 } });
  const { container, unmount } = await mount(<CampaignDetail />);
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/campaigns/c1'));
  expect(container.textContent).toContain('Glow Serum');
  expect(container.textContent).toContain('1 SLOT LEFT');
  await click(container.querySelector('[data-testid="finish-hiring-btn"]'));
  expect(document.body.textContent).toContain('Finish hiring now?');
  await click(byText('Finish & refund'));
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/campaigns/c1/finish-hiring'));
  mockPath = '/dashboard/business/all-campaigns';
  await unmount();
});

test('post a campaign: incomplete form is blocked with a message; Save draft posts the draft', async () => {
  axios.get.mockResolvedValue({ data: {} });
  axios.post.mockResolvedValue({ data: { campaign_id: 'd1' } });
  const { container, unmount } = await mount(<PostCampaign />);
  await click(byText('Review & publish'));
  expect(toast.error).toHaveBeenCalledWith(expect.stringContaining('Complete to continue'));
  expect(axios.post).not.toHaveBeenCalledWith(expect.stringMatching(/\/campaigns$/), expect.anything());
  const name = container.querySelector('input[placeholder="Summer Launch - Unboxing 2"]');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(name, 'Glow Serum Reel');
    name.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await click(container.querySelector('button[aria-label="Save draft"]'));
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/campaigns/draft'), expect.objectContaining({ title: 'Glow Serum Reel' }));
  await unmount();
});
