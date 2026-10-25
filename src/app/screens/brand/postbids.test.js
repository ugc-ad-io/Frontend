import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { toast } from 'sonner';
import Bids from './Bids';
import PostCampaign from './PostCampaign';

const mockNavigate = jest.fn();
let mockStep = '';
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/dashboard/business/pending-bids', search: '' }),
  useParams: () => ({}),
  useSearchParams: () => [new URLSearchParams(mockStep ? `step=${mockStep}` : ''), jest.fn()],
  matchPath: () => null,
}));
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() } }));
jest.mock('../../../App', () => ({ useAuth: () => ({ user: { id: 'b1', role: 'business', profile: { business_name: 'Glow Labs' } }, logout: jest.fn() }) }));

const mk = (id, name, amount, days) => ({ id, creator_id: `cr-${id}`, creator_name: name, amount, estimated_delivery_days: days, proposal: `hi ${name}`, status: 'pending' });
const camp = { id: 'c1', business_id: 'b1', title: 'Glow Serum', status: 'active', creators_wanted: 2, budget_min: 5000, budget_max: 12000, bids: [mk('a', 'Rohan', 12000, 2), mk('b', 'Arjun', 7000, 4), mk('c', 'Priya', 9500, 3)] };

const mount = async (ui) => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(ui));
  return { container, unmount: () => act(async () => { root.unmount(); container.remove(); }) };
};
const click = (el) => act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const byText = (txt, sel = 'button') => [...document.querySelectorAll(sel)].find((e) => e.textContent.trim() === txt);

beforeEach(() => {
  jest.clearAllMocks(); localStorage.clear(); mockStep = '';
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.endsWith('/campaigns') ? [camp] : url.includes('/business/wallet') ? { available_balance: 32500 } : {} }));
});

test('compare bids: sort by price, shortlist tab, decline posts to the decline endpoint', async () => {
  axios.post.mockResolvedValue({ data: {} });
  const { container, unmount } = await mount(<Bids />);
  const names = () => [...container.querySelectorAll('.ap-cp-bid-who .ap-cp-namebtn')].map((n) => n.textContent);
  expect(names()).toEqual(['Rohan', 'Arjun', 'Priya']);
  const sel = container.querySelector('select[aria-label="Sort bids"]');
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, 'price-low');
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(names()).toEqual(['Arjun', 'Priya', 'Rohan']);
  await click(container.querySelectorAll('button[aria-label="Shortlist"]')[1]);
  await click([...container.querySelectorAll('[role=tab]')].find((t) => t.textContent.startsWith('Shortlisted')));
  expect(names()).toEqual(['Priya']);
  await click(byText('Decline'));
  expect(document.body.textContent).toContain('Decline Priya');
  await click(byText('Decline bid'));
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/campaigns/c1/bids/c/decline'));
  expect(toast.success).toHaveBeenCalled();
  await unmount();
});

test('post a campaign: a complete draft reviews with the escrow total and publishes for approval', async () => {
  const day = (n) => { const t = new Date(); t.setDate(t.getDate() + n); return t.toISOString().slice(0, 10); };
  localStorage.setItem('ugcad-brand-brief-draft-v2', JSON.stringify({
    campaignName: 'Glow Serum Launch', productType: 'physical', productName: 'Glow Serum 30ml', campaignHook: 'Start with a morning routine moment',
    category: 'Skincare', productDescription: 'A lightweight vitamin C serum for daily use.', keyMessage: 'Visible glow in two weeks', objectives: ['Awareness'],
    targetAudience: 'Urban women aged 25-35 who care about clean skincare and follow beauty creators on Instagram daily.',
    deliverables: [{ id: 'd1', type: 'Reel (9:16, under 30s)', quantity: 2, duration: '15-20 seconds', aspectRatios: ['9:16'], editedRequired: false, editedBy: 'creator' }],
    visibilitySeconds: '5 sec', productNames: 'Glow Serum', callToAction: 'Visit website', ctaLink: 'https://glowlabs.in', tones: ['Casual'], pacing: 'Medium',
    platforms: ["Brand's own Instagram"], rightsDuration: '3 months', exclusivity: 'None', modificationRights: 'No (use as-is)', creatorLevel: 'Any', qualityTier: 'A',
    productShippingBy: day(2), draftDeliveryBy: day(9), creatorsWanted: 2, budgetMode: 'fixed', fixedBudget: '5000',
  }));
  mockStep = 'review';
  axios.post.mockResolvedValue({ data: {} });
  const { container, unmount } = await mount(<PostCampaign />);
  // 2 creators x 2 videos x 5000 = 20000 + 20% fee 4000 + listing fee 1500
  expect(container.textContent).toContain('₹25,500');
  expect(container.textContent).toContain('Your wallet');
  await click(byText('Publish brief'));
  expect(axios.post).toHaveBeenCalledWith(expect.stringMatching(/\/campaigns$/), expect.objectContaining({ title: 'Glow Serum Launch', status: 'pending_approval', match_requested: true, total_budget: 20000 }));
  expect(localStorage.getItem('ugcad-brand-brief-draft-v2')).toBeNull();
  await unmount();
});
