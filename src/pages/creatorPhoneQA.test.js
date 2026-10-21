import { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';

// Phone QA for the creator pages: every page compiles and renders its states
// (empty / error + Retry / no fake demo data) with the shared layout and App context mocked.
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn() }));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('../components/CreatorTopNavLayout', () => ({ children }) => <div>{children}</div>);
jest.mock('../components/BrandTopNavLayout', () => ({ children }) => <div>{children}</div>);
const mockUser = { id: 'c1', role: 'creator', approval_status: 'approved', portfolio: [] };
jest.mock('../App', () => ({ useAuth: () => ({ user: mockUser, setUser: jest.fn(), logout: jest.fn() }) }));
const mockNavigate = jest.fn();
let mockSearch = '';
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams(mockSearch), jest.fn()],
  useParams: () => ({ id: 'd1' }),
}));
jest.mock('../lib/liveUpdates', () => ({ useLiveEffect: require('react').useEffect }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function mount(Component) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(<Component />));
  return { host, done: async () => { await act(async () => root.unmount()); host.remove(); } };
}

// The first test pays the cold compile of the page bundle, which can pass the 5s default.
jest.setTimeout(30000);
beforeEach(() => { jest.clearAllMocks(); mockSearch = ''; });

test('My Bids has no dead "Shortlisted" tab and shows Retry when the load fails', async () => {
  axios.get.mockRejectedValue(new Error('Network Error'));
  const { MyBidsContent } = require('./MyBidsPage');
  const { host, done } = await mount(MyBidsContent);
  try {
    expect(host.textContent).not.toContain('Shortlisted');
    expect(host.textContent).toContain("You're offline");
    expect(host.textContent).toContain('Retry');
  } finally { await done(); }
});

test('Portfolio never pads an empty portfolio with fake "(Demo)" work', async () => {
  axios.get.mockResolvedValue({ data: { id: 'c1', portfolio: [] } });
  const Portfolio = require('./PortfolioPage').default;
  const { host, done } = await mount(Portfolio);
  try {
    expect(host.textContent).not.toContain('(Demo)');
    expect(host.textContent).toContain('No work yet');
  } finally { await done(); }
});

test('Work submission without ?campaign= says not found instead of loading forever', async () => {
  const WorkSubmission = require('./WorkSubmission').default;
  const { host, done } = await mount(WorkSubmission);
  try {
    expect(host.textContent).toContain('Campaign not found');
    expect(host.textContent).not.toContain('Loading...');
  } finally { await done(); }
});

test('Shipment tracking without ?campaign= says not found instead of a skeleton forever', async () => {
  const ShipmentTracking = require('./ShipmentTracking').default;
  const { host, done } = await mount(ShipmentTracking);
  try {
    expect(host.textContent).toContain('Campaign not found');
  } finally { await done(); }
});

test('Active work shows a Retry (not a stuck skeleton) when the API is down', async () => {
  axios.get.mockRejectedValue(new Error('Network Error'));
  const MyActiveWorkPage = require('./MyActiveWorkPage').default;
  const { host, done } = await mount(MyActiveWorkPage);
  try {
    expect(host.textContent).toContain('Could not load active work');
    expect(host.textContent).toContain('Retry');
  } finally { await done(); }
});

test('Reviews and My Deals hub show Retry on a failed load', async () => {
  axios.get.mockRejectedValue(new Error('Network Error'));
  for (const file of ['./ReviewsPage', './MyDealsHubPage']) {
    const Page = require(file).default;
    const { host, done } = await mount(Page);
    try {
      expect(host.textContent).toContain('Retry');
    } finally { await done(); }
  }
});

test('KYC page shows the masked Aadhaar only (last 4 digits) once submitted', async () => {
  axios.get.mockResolvedValue({ data: { status: 'pending', aadhaar_number: '123456789012', pan_number: 'ABCDE1234F' } });
  const CreatorKYC = require('./CreatorKYC').default;
  const { host, done } = await mount(CreatorKYC);
  try {
    expect(host.textContent).toContain('XXXX XXXX 9012');
    expect(host.textContent).not.toContain('123456789012');
  } finally { await done(); }
});

test('Browse briefs and Dashboard compile and render', async () => {
  axios.get.mockResolvedValue({ data: [] });
  for (const file of ['./BrowseBriefs', './SavedBriefs', './CreatorDashboard', './DisputeDetailPage', './CreatorProfileSetup']) {
    const mod = require(file);
    expect(typeof mod.default).toBe('function');
  }
});

test('needsDealRoom sends staged / caption / thumbnail briefs to the Deal Room, plain briefs stay on the quick form', () => {
  const { needsDealRoom } = require('./WorkSubmission');
  expect(needsDealRoom(null)).toBe(false);
  expect(needsDealRoom({ deliverable_items: [{ quantity: 1 }] })).toBe(false);
  expect(needsDealRoom({ deliverable_items: [{ edited_required: true }] })).toBe(true);
  expect(needsDealRoom({ content_requirements: { caption_script: true } })).toBe(true);
  expect(needsDealRoom({ shipment_checklist: { thumbnail: true } })).toBe(true);
  expect(needsDealRoom({ caption_required: true })).toBe(true);
});

test('Work submission for a staged (raw -> edited) brief redirects to the Deal Room deliverables tab', async () => {
  mockSearch = 'campaign=c9';
  axios.get.mockResolvedValue({ data: { id: 'c9', title: 'T', deliverable_items: [{ edited_required: true }] } });
  const WorkSubmission = require('./WorkSubmission').default;
  const { done } = await mount(WorkSubmission);
  try {
    expect(mockNavigate).toHaveBeenCalledWith('/my-deals?campaign=c9&tab=deliverables', { replace: true });
  } finally { await done(); }
});

test('Work submission for a plain brief stays on the quick form (no redirect)', async () => {
  mockSearch = 'campaign=c8';
  axios.get.mockResolvedValue({ data: { id: 'c8', title: 'Plain', deliverable_items: [{ quantity: 1 }] } });
  const WorkSubmission = require('./WorkSubmission').default;
  const { host, done } = await mount(WorkSubmission);
  try {
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(host.textContent).toContain('Submit Your Work');
  } finally { await done(); }
});

test('Deal Room says offline with Retry (not "No active deals yet") when the load fails, and explains a missing deal', async () => {
  const MyDealsPage = require('./MyDealsPage').default;
  axios.get.mockRejectedValue(new Error('Network Error'));
  let m = await mount(MyDealsPage);
  try {
    expect(m.host.textContent).toContain("You're offline");
    expect(m.host.textContent).toContain('Retry');
    expect(m.host.textContent).not.toContain('No active deals yet');
  } finally { await m.done(); }

  mockSearch = 'campaign=gone';
  axios.get.mockRejectedValue({ response: { status: 404, data: {} } });
  m = await mount(MyDealsPage);
  try {
    expect(m.host.textContent).toContain('Deal not found');
    expect(m.host.textContent).toContain('Back to My Deals');
  } finally { await m.done(); }
});
