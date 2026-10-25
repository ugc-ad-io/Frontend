import { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { toast } from 'sonner';
import Dispute from './Dispute';
import Shipment from './Shipment';
import CampaignView from './CampaignView';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('../../shell/AppShell', () => ({ children }) => <div>{children}</div>);
jest.mock('../creator/briefsShared', () => ({
  API: 'http://x/api',
  OFFLINE: "You're offline. Check your connection and try again.",
  BriefDetail: ({ brief, onApply }) => <div data-testid="brief"><span>{brief.title}</span><button type="button" onClick={() => onApply(brief)}>Apply with a bid</button></div>,
  useApply: () => ({ start: mockStart, checking: false, ui: null }),
}));
jest.mock('../../../utils/savedBriefs', () => ({ toggleSavedBrief: jest.fn(), getSavedIds: () => new Set() }));
const mockStart = jest.fn();
const mockNavigate = jest.fn();
let mockUser = { id: 'b1', role: 'business' };
let mockPath = '/disputes/d1';
let mockSearch = '';
jest.mock('../../../App', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../../../lib/liveUpdates', () => ({ useLiveEffect: require('react').useEffect }));
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: mockPath }),
  useSearchParams: () => [new URLSearchParams(mockSearch)],
  matchPath: jest.requireActual('react-router-dom').matchPath,
  Navigate: ({ to }) => <div data-testid="navigate">{to}</div>,
}));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
async function mount(El) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(<El />); });
  await flush();
  return { host, unmount: () => act(() => root.unmount()) };
}
const byText = (re, scope = document) => [...scope.querySelectorAll('button')].find((b) => re.test(b.textContent));
async function typeInto(el, value) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
beforeEach(() => { jest.clearAllMocks(); mockUser = { id: 'b1', role: 'business' }; mockSearch = ''; });

const DISPUTE = {
  id: 'd1', campaign_title: 'Protein bar taste test', dispute_type: 'quality', status: 'info_requested', awaiting_my_response: true, my_party: 'brand',
  created_at: '2026-10-21T10:00:00Z', description: 'Label not visible.', info_request_message: 'Share the brief.',
  info_request_due_at: new Date(Date.now() + 50 * 3600000).toISOString(), info_responses: [],
};

test('Dispute reads the id from the path; an empty reply is blocked, a typed one is posted', async () => {
  mockPath = '/disputes/d1';
  axios.get.mockResolvedValue({ data: DISPUTE });
  axios.post.mockResolvedValue({ data: {} });
  const { host, unmount } = await mount(Dispute);
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/disputes/d1'));
  expect(host.textContent).toContain('Share the brief.');
  await act(async () => { byText(/Submit response/, host).click(); });
  expect(toast.error).toHaveBeenCalledWith('Please type your response before submitting.');
  expect(axios.post).not.toHaveBeenCalled();
  await typeInto(host.querySelector('textarea'), '  The label shows from 0:08.  ');
  await act(async () => { byText(/Submit response/, host).click(); });
  await flush();
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/disputes/d1/respond'), { message: 'The label shows from 0:08.', evidence_urls: [] });
  await unmount();
});

test('Dispute: a 404 says not found, a network failure offers Retry', async () => {
  mockPath = '/disputes/zz';
  axios.get.mockRejectedValueOnce({ response: { status: 404 } });
  let m = await mount(Dispute);
  expect(m.host.textContent).toContain('Dispute not found');
  await m.unmount();
  axios.get.mockRejectedValue({});
  m = await mount(Dispute);
  expect(m.host.textContent).toContain("You're offline");
  expect(byText(/Retry/, m.host)).toBeTruthy();
  await m.unmount();
});

const CAMPAIGN = { id: 'c1', title: 'Kurta haul', business_id: 'b1', selected_creators: ['cr1'], status: 'active' };
test('Shipment (brand, nothing shipped yet): Ship product opens the pickup form', async () => {
  mockPath = '/shipment'; mockSearch = 'campaign=c1';
  axios.get.mockImplementation((url) => (url.includes('/campaigns/') ? Promise.resolve({ data: CAMPAIGN }) : url.includes('/shipment/') ? Promise.reject({ response: { status: 404 } }) : Promise.resolve({ data: {} })));
  const { host, unmount } = await mount(Shipment);
  await act(async () => { byText(/Ship product/, host).click(); });
  expect(document.body.textContent).toContain('Pickup address');
  await unmount();
});

test('Shipment (creator, in transit): Mark as received needs the unboxing video', async () => {
  mockPath = '/shipment'; mockSearch = 'campaign=c1'; mockUser = { id: 'cr1', role: 'creator' };
  axios.get.mockImplementation((url) => (url.includes('/campaigns/') ? Promise.resolve({ data: CAMPAIGN }) : Promise.resolve({ data: { status: 'in_transit', tracking_number: 'T1' } })));
  const { host, unmount } = await mount(Shipment);
  expect(host.textContent).toContain('T1');
  await act(async () => { byText(/Mark as received/, host).click(); });
  await act(async () => { document.querySelector('#ap-sm-recv').requestSubmit(); });
  expect(toast.error).toHaveBeenCalledWith('Please attach your unboxing video.');
  expect(axios.post).not.toHaveBeenCalled();
  await unmount();
});

test('CampaignView: a creator sees the brief and Apply starts the apply flow; the owning brand is sent to its campaign screen', async () => {
  mockPath = '/campaign/c1'; mockUser = { id: 'cr1', role: 'creator' };
  axios.get.mockResolvedValue({ data: { ...CAMPAIGN, business_id: 'other', bids: [] } });
  let m = await mount(CampaignView);
  expect(axios.get).toHaveBeenCalledWith(expect.stringContaining('/campaigns/c1'));
  expect(m.host.textContent).toContain('Kurta haul');
  await act(async () => { byText(/Apply with a bid/, m.host).click(); });
  expect(mockStart).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }));
  await m.unmount();

  mockUser = { id: 'b1', role: 'business' };
  axios.get.mockResolvedValue({ data: { ...CAMPAIGN, bids: [] } });
  m = await mount(CampaignView);
  expect(m.host.querySelector('[data-testid="navigate"]').textContent).toBe('/dashboard/business/campaign/c1');
  await m.unmount();
});
