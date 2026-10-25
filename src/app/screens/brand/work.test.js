import { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { toast } from 'sonner';
import SentBriefs from './SentBriefs';
import Reviews from './Reviews';
import Shipments from './Shipments';
import WorkReview from './WorkReview';
import MultiBrief, { buildPrivateBrief, missingBriefFields } from './MultiBrief';
import { buildPrivateBrief as webBuild, missingBriefFields as webMissing } from '../../../pages/BrandMultiBrief';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn(), message: jest.fn() } }));
jest.mock('../../shell/AppShell', () => ({ children }) => <div>{children}</div>);
jest.mock('../../../App', () => ({ useAuth: () => ({ user: { id: 'b1', role: 'business', approval_status: 'approved' } }) }));
jest.mock('../../../lib/liveUpdates', () => ({ useLiveEffect: require('react').useEffect }));
jest.mock('../../../pages/PlanBrief', () => () => null);
jest.mock('../../../components/BrandTopNavLayout', () => ({ children }) => <div>{children}</div>);
jest.mock('../../../utils/downloadDeliverable', () => ({ downloadDeliverable: jest.fn(() => Promise.resolve()) }));
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('../../../utils/savedCreators', () => ({
  useSavedCreatorIds: () => new Set(['c1', 'c2']),
  loadSavedCreators: () => Promise.resolve(['c1', 'c2']),
  isSavedCreatorsLoaded: () => true,
}));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
async function mount(El) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<El />); });
  await flush();
  return { host, unmount: () => act(() => { root.unmount(); host.remove(); }) };
}
const byText = (re, scope = document) => [...scope.querySelectorAll('button')].find((b) => re.test(b.textContent));
const route = (map) => axios.get.mockImplementation((url) => {
  const hit = Object.keys(map).find((k) => url.includes(k));
  return hit ? (map[hit] instanceof Error ? Promise.reject(map[hit]) : Promise.resolve({ data: map[hit] })) : Promise.resolve({ data: [] });
});

beforeEach(() => { jest.clearAllMocks(); });
HTMLMediaElement.prototype.pause = jest.fn();
HTMLMediaElement.prototype.play = jest.fn(() => Promise.resolve());
HTMLMediaElement.prototype.load = jest.fn();

const BRIEFS = [
  { id: 'b1', creator_id: 'c1', creator_name: 'Zoya Khan', campaign_name: 'Diwali reel', status_bucket: 'countered', amount: '10000', creator_photo: 'x' },
  { id: 'b2', creator_id: 'c2', creator_name: 'Priya Das', campaign_name: 'Glow', status_bucket: 'accepted', deal_campaign_id: 'camp9', amount: '4000', creator_photo: 'x' },
];

test('sent briefs: lists with status, filters, and "View deal" opens the campaign', async () => {
  route({ '/business/briefs': BRIEFS });
  const { host, unmount } = await mount(SentBriefs);
  expect(host.textContent).toContain('Zoya');
  expect(host.textContent).toContain('₹10,000');
  await act(async () => { byText(/^Accepted/, host).click(); });
  expect(host.textContent).not.toContain('Zoya');
  await act(async () => { byText(/View deal/, host).click(); });
  expect(mockNavigate).toHaveBeenCalledWith('/dashboard/business/campaign/camp9');
  await unmount();
});

test('sent briefs: a failed load shows an error with Retry, not an empty list', async () => {
  route({ '/business/briefs': new Error('Network Error') });
  const { host, unmount } = await mount(SentBriefs);
  expect(host.textContent).toContain("Couldn't load sent briefs");
  expect(host.textContent).toContain('offline');
  expect(byText(/Try again/, host)).toBeTruthy();
  await unmount();
});

test('reviews: shows average, breakdown and the creator reviews', async () => {
  route({
    '/reviews/business/b1': [{ id: 'r1', reviewer_id: 'c1', campaign_id: 'k1', rating: 5, review: 'Great brand' }, { id: 'r2', reviewer_id: 'c1', campaign_id: 'k1', rating: 4 }],
    '/campaigns/k1': { id: 'k1', title: 'Protein Bar' },
    '/profile/c1': { id: 'c1', full_name: 'Rohan Mehta' },
  });
  const { host, unmount } = await mount(Reviews);
  expect(host.textContent).toContain('4.5');
  expect(host.textContent).toContain('Great brand');
  expect(host.textContent).toContain('Rohan');
  await unmount();
});

test('shipments: a hired creator with no shipment can be shipped to; the request posts the website payload', async () => {
  route({
    '/campaigns': [{ id: 'camp1', business_id: 'b1', title: 'Kurta', requires_shipment: true, selected_creator: 'c1', selected_creators: ['c1'], bids: [{ creator_id: 'c1', creator_name: 'Ishita Rao' }] }],
    '/shipment/camp1': {},
    '/shipping/account-address': { address: { full_name: 'Glow', phone: '9820012345', line1: 'MIDC', city: 'Mumbai', state: 'MH', pincode: '400069' } },
  });
  axios.post.mockResolvedValue({ data: { ok: true } });
  const { host, unmount } = await mount(Shipments);
  expect(host.textContent).toContain('Ishita');
  await act(async () => { byText(/^Ship$/, host).click(); });
  await flush();
  const set = (el, v) => act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  const form = document.getElementById('ap-ship-form');
  await set(form.querySelector('input[placeholder="e.g. Skincare gift box"]'), 'Kurta set');
  await set(form.querySelector('input[placeholder="0.5"]'), '1.2');
  await act(async () => { form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); });
  await flush();
  const [url, body] = axios.post.mock.calls[0];
  expect(url).toMatch(/\/deals\/camp1\/request-shipment$/);
  expect(body).toMatchObject({ description: 'Kurta set', weight: 1.2, pickup_address: { pincode: '400069', country: 'India' } });
  expect(toast.success).toHaveBeenCalled();
  await unmount();
});

test('shipments: failed campaigns load shows Retry', async () => {
  route({ '/campaigns': { __: 1 } });
  axios.get.mockRejectedValue({ response: { data: { detail: 'Server down' } } });
  const { host, unmount } = await mount(Shipments);
  expect(host.textContent).toContain('Server down');
  expect(byText(/Try again/, host)).toBeTruthy();
  await unmount();
});

const ROW = {
  id: 'camp1', campaignId: 'camp1', title: 'Protein Bar', campaign: 'Protein Bar', creatorId: 'c1', creator: 'Rohan Mehta', photo: '',
  files: ['https://cdn.example.com/a.mp4'], labeledFiles: [], stage: 'edited', status: 'pending_review', submittedAt: new Date().toISOString(),
  freeRevisionsRemaining: 2, nextRevisionFee: 0, paidRevisionFee: 500,
};

test('work review: approve needs the confirmation tick, posts /deals/{id}/approve once, then offers payment-released actions', async () => {
  route({ '/business/work-review': [ROW] });
  axios.post.mockResolvedValue({ data: { payout_status: 'released' } });
  const { host, unmount } = await mount(WorkReview);
  expect(host.textContent).toContain('Protein Bar');
  await act(async () => { byText(/^Review$/, host).click(); });
  await act(async () => { byText(/Approve & pay/).click(); });
  const confirm = byText(/Yes, approve & pay/);
  expect(confirm.disabled).toBe(true);
  await act(async () => { document.querySelector('.ap-wk-check input').click(); });
  await act(async () => { byText(/Yes, approve & pay/).click(); byText(/Yes, approve & pay/)?.click(); });
  await flush();
  expect(axios.post.mock.calls.filter(([u]) => /\/deals\/camp1\/approve$/.test(u))).toHaveLength(1);
  expect(document.body.textContent).toContain('Payment released');
  expect(document.body.textContent).toContain('Rate Rohan');
  await unmount();
});

test('work review: a failed load shows Retry instead of "nothing to review"', async () => {
  axios.get.mockRejectedValue(new Error('Network Error'));
  const { host, unmount } = await mount(WorkReview);
  expect(host.textContent).toContain("Couldn't load submissions");
  expect(host.textContent).not.toContain('Nothing to review');
  await unmount();
});

test('multi brief: the private brief payload matches the website page exactly', () => {
  const campaign = {
    title: 'Glow', product_name: 'Serum', product_description: 'A brightening serum', campaign_hook: 'hook', key_message: 'msg', brief_text: 'Be natural',
    deliverable_items: [{ type: 'Reel', quantity: 2, duration: '30 Sec', edited_required: true, edited_by: 'creator' }], due_date: '2099-01-01',
  };
  const rate = { price: 4000, editing: 1500 };
  expect(buildPrivateBrief(campaign, 'c1', rate, '2099-01-05')).toEqual(webBuild(campaign, 'c1', rate, '2099-01-05'));
  expect(missingBriefFields({})).toEqual(webMissing({}));
});

test('multi brief: sends one POST /campaigns per picked creator and marks them sent', async () => {
  const camp = { id: 'k1', status: 'active', title: 'Glow', product_name: 'Serum', product_description: 'A brightening serum', campaign_hook: 'h', key_message: 'm', due_date: '2099-01-01', deliverable_items: [{ type: 'Reel', quantity: 1 }] };
  route({
    '/business/creator-directory': [{ id: 'c1', full_name: 'Priya Das' }, { id: 'c2', full_name: 'Ishita Rao' }],
    '/campaigns': [camp],
    '/business/settings/billing': { commission_rate: 20 },
    '/business/wallet': { available_balance: 50000 },
    '/profile/c1': { profile: { rate_card: { raw_payout: '4000' } } },
    '/profile/c2': { profile: { rate_card: { raw_payout: '5000' } } },
  });
  axios.post.mockResolvedValue({ data: { id: 'new' } });
  const { host, unmount } = await mount(MultiBrief);
  await flush();
  await act(async () => {
    const sel = host.querySelector('select');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, 'k1');
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await act(async () => { byText(/Select all/, host).click(); });
  expect(host.textContent).toContain('₹10,800');   // (4000 + 5000) + 20% fee
  const send = byText(/Send brief to 2/, host);
  expect(send.disabled).toBe(false);
  await act(async () => { send.click(); });
  await flush();
  expect(axios.post).toHaveBeenCalledTimes(2);
  expect(axios.post.mock.calls.map(([, b]) => b.selected_creator).sort()).toEqual(['c1', 'c2']);
  expect(axios.post.mock.calls[0][1]).toMatchObject({ visibility: 'private', status: 'pending_approval' });
  expect(toast.success).toHaveBeenCalled();
  await unmount();
});
