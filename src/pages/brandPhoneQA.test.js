import { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { budgetLabel } from '../utils/budgetLabel';
import { pageWindow } from '../utils/pageWindow';
import { walletStatementCsv } from '../utils/walletStatement';

// Phone QA for the brand pages: the logic fixed in this pass (budget text, pager, statement export)
// plus the pages rendering their real data with the shared layout and App context mocked.
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() }));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn(), message: jest.fn(), info: jest.fn(), warning: jest.fn() } }));
jest.mock('../components/BrandTopNavLayout', () => ({ children }) => <div>{children}</div>);
// The page head renders the real bell, which polls its own endpoints: keep these call-count assertions about the page.
jest.mock('../components/NotificationBell', () => () => null);
jest.mock('../components/ChatPopup', () => () => null);
jest.mock('../components/PageModal', () => ({ children }) => <div>{children}</div>);
jest.mock('../components/ReviewModal', () => () => null);
jest.mock('../components/CreatorProfileModal', () => () => null);
jest.mock('../components/BookingCard', () => () => null);
jest.mock('../components/RejectedGate', () => () => null);
jest.mock('../components/MoreInfoGate', () => () => null);
jest.mock('../components/VideoReviewModal', () => ({ __esModule: true, default: () => <div data-testid="video-review" />, fmtTs: () => '' }));
jest.mock('../components/RevisionRequestModal', () => ({ __esModule: true, default: () => <div data-testid="text-revision" />, findContactInfo: () => null }));
jest.mock('./PostABrief', () => () => null);
jest.mock('./CampaignDetails', () => () => null);
jest.mock('./WorkReview', () => () => null);
jest.mock('./ShipmentTracking', () => () => null);
jest.mock('./BrandCreators', () => ({ ReelCard: () => <div data-testid="reel" /> }));
jest.mock('../utils/razorpay', () => ({ payWithRazorpay: jest.fn(), isPaymentCancelled: () => false }));
const mockUser = { id: 'b1', role: 'business', approval_status: 'approved' };
jest.mock('../App', () => ({ useAuth: () => ({ user: mockUser, setUser: jest.fn(), logout: jest.fn() }) }));
const mockNavigate = jest.fn();
let mockParams = { id: 'camp1' };
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
  useSearchParams: () => [new URLSearchParams(''), jest.fn()],
}));
jest.mock('../lib/liveUpdates', () => ({ useLiveEffect: require('react').useEffect }));
const mockSaved = { ids: new Set(['cr1']), loaded: true };
jest.mock('../utils/savedCreators', () => ({
  useSavedCreatorIds: () => mockSaved.ids,
  loadSavedCreators: jest.fn(() => Promise.resolve()),
  isSavedCreatorsLoaded: () => mockSaved.loaded,
  removeSavedCreator: jest.fn(() => Promise.resolve(false)),
}));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function mount(element) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  return { host, done: async () => { await act(async () => root.unmount()); host.remove(); } };
}
const click = async (el) => { await act(async () => { el.click(); }); };
const buttonByText = (host, text) => [...host.querySelectorAll('button')].find((b) => b.textContent.includes(text));

beforeAll(() => {
  // jsdom has no matchMedia; the reel pages ask for the phone breakpoint.
  window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} }));
});
beforeEach(() => { jest.clearAllMocks(); mockParams = { id: 'camp1' }; mockSaved.loaded = true; });

describe('budgetLabel', () => {
  test('one amount when fixed, a range otherwise, never a made-up "spent" figure', () => {
    expect(budgetLabel(5000, 5000)).toBe('Rs. 5,000');
    expect(budgetLabel(3000, 5000)).toBe('Rs. 3,000 - Rs. 5,000');
    expect(budgetLabel(0, 8000)).toBe('Rs. 8,000');
    expect(budgetLabel(2500, 0)).toBe('Rs. 2,500');
    expect(budgetLabel(undefined, undefined)).toBe('Rs. 0');
  });
});

describe('pageWindow', () => {
  test('keeps first, last and the neighbours of the current page, with gaps marked', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(1, 4)).toEqual([1, 2, 3, 4]);
    expect(pageWindow(1, 10)).toEqual([1, 2, '…', 10]);
    expect(pageWindow(5, 10)).toEqual([1, '…', 4, 5, 6, '…', 10]);
    expect(pageWindow(10, 10)).toEqual([1, '…', 9, 10]);
  });
  test('a 60-page list is a handful of buttons, not 60', () => {
    expect(pageWindow(30, 60).length).toBeLessThanOrEqual(7);
  });
});

describe('walletStatementCsv', () => {
  test('has a header, signs by direction and keeps free text from becoming a formula', () => {
    const csv = walletStatementCsv([
      { id: 't1', date: '2026-10-01T10:00:00Z', type: 'Wallet Recharge', reference: 'pay_1', amount: 10000, direction: 'credit', status: 'success' },
      { id: 't2', date: '2026-10-02', type: 'Escrow', reference: '=HYPERLINK("x")', amount: 2500.5, direction: 'debit' },
    ]).split('\r\n');
    expect(csv[0]).toBe('Date,Type,Reference,Direction,Amount (INR),Status,Transaction ID');
    expect(csv[1]).toBe('2026-10-01,Wallet Recharge,pay_1,Credit,10000.00,success,t1');
    expect(csv[2]).toContain(',Debit,2500.50,success,t2');
    expect(csv[2]).toContain('\'=HYPERLINK');
    expect(walletStatementCsv([]).split('\r\n')).toHaveLength(1);
  });
});

describe('Campaigns list', () => {
  const camps = [
    { id: 'a', business_id: 'b1', title: 'Hired brief', status: 'active', budget_min: 3000, budget_max: 5000, selected_creator: 'c1', bids: [{ creator_id: 'c1' }] },
    { id: 'b', business_id: 'b1', title: 'Two bids', status: 'active', budget_min: 4000, budget_max: 4000, bids: [{ creator_id: 'x' }, { creator_id: 'y' }] },
  ];
  test('shows the budget (not a fake "spent / total") and counts bids on their own', async () => {
    axios.get.mockResolvedValue({ data: camps });
    const BrandCampaigns = require('./BrandCampaigns').default;
    const { host, done } = await mount(<BrandCampaigns />);
    try {
      const text = host.textContent;
      expect(text).toContain('₹3k–5k');
      expect(text).toContain('₹4,000');
      expect(text).not.toContain('₹3k / ₹5k');
      expect(text).toContain('2 bids waiting');
    } finally { await done(); }
  });

  test('a failed load says so and offers Try again', async () => {
    axios.get.mockRejectedValue(new Error('Network Error'));
    const BrandCampaigns = require('./BrandCampaigns').default;
    const { host, done } = await mount(<BrandCampaigns />);
    try {
      expect(host.textContent).toContain("Couldn't load your campaigns");
      expect(buttonByText(host, 'Try again')).toBeTruthy();
    } finally { await done(); }
  });
});

describe('Work review pager', () => {
  test('100 submissions page as 10 per page without printing 10 page buttons', async () => {
    const rows = Array.from({ length: 100 }, (_, i) => ({ id: `c${i}`, campaignId: `c${i}`, title: `Reel ${i}`, creator: 'Creator', files: ['a.mp4'], status: 'pending_review' }));
    axios.get.mockResolvedValue({ data: rows });
    const BrandWorkReview = require('./BrandWorkReview').default;
    const { host, done } = await mount(<BrandWorkReview />);
    try {
      const pager = host.querySelector('.bwr-pager');
      expect(pager.textContent).toContain('…');
      const pages = [...pager.querySelectorAll('button')].filter((b) => /^\d+$/.test(b.textContent));
      expect(pages.map((b) => b.textContent)).toEqual(['1', '2', '10']);
      await click(pages[1]);
      expect(host.textContent).toContain('Showing 11–20 of 100 results');
    } finally { await done(); }
  });
});

describe('Saved creators', () => {
  test('says so when the creator details did not load instead of silently drawing blank cards', async () => {
    axios.get.mockRejectedValue(new Error('Network Error'));
    const SavedCreators = require('./SavedCreators').default;
    const { host, done } = await mount(<SavedCreators />);
    try {
      expect(host.textContent).toContain('Creator details could not be loaded');
      expect(host.querySelectorAll('[data-testid="reel"]').length).toBe(1);
    } finally { await done(); }
  });

  test('no warning when the directory loads', async () => {
    axios.get.mockResolvedValue({ data: [{ id: 'cr1', nickname: 'Asha' }] });
    const SavedCreators = require('./SavedCreators').default;
    const { host, done } = await mount(<SavedCreators />);
    try {
      expect(host.textContent).not.toContain('could not be loaded');
    } finally { await done(); }
  });
});

describe('Campaign detail: requesting a revision', () => {
  const campaign = (files) => ({
    id: 'camp1', business_id: 'b1', title: 'Launch reel', status: 'work_submitted', budget_min: 2000, budget_max: 2000,
    selected_creator: 'cr1', bids: [],
    work_submission: { status: 'pending_review', work_files: files, submitted_at: '2026-10-01T00:00:00Z' },
  });
  const wire = (files) => axios.get.mockImplementation((url) => {
    if (url.includes('/campaigns/camp1')) return Promise.resolve({ data: campaign(files) });
    if (url.includes('/deals/business')) return Promise.resolve({ data: [] });
    if (url.includes('/profile/cr1')) return Promise.resolve({ data: { nickname: 'Asha' } });
    return Promise.resolve({ data: [] });
  });

  test('a video deliverable opens the timestamped video review', async () => {
    wire(['/uploads/cut.mp4']);
    const Detail = require('./BrandCampaignDetail').default;
    const { host, done } = await mount(<Detail />);
    try {
      await click(buttonByText(host, 'Work review'));
      await click([...host.querySelectorAll('.bwr-btn')].find((b) => b.textContent.includes('Request Revision')));
      expect(host.querySelector('[data-testid="video-review"]')).toBeTruthy();
      expect(host.querySelector('[data-testid="text-revision"]')).toBeNull();
    } finally { await done(); }
  });

  test('a photo deliverable gets the plain text revision form, not a video player that cannot load', async () => {
    wire(['/uploads/look.jpg']);
    const Detail = require('./BrandCampaignDetail').default;
    const { host, done } = await mount(<Detail />);
    try {
      await click(buttonByText(host, 'Work review'));
      await click([...host.querySelectorAll('.bwr-btn')].find((b) => b.textContent.includes('Request Revision')));
      expect(host.querySelector('[data-testid="text-revision"]')).toBeTruthy();
      expect(host.querySelector('[data-testid="video-review"]')).toBeNull();
    } finally { await done(); }
  });

  test('the header shows the budget, not "spent / total"', async () => {
    wire(['/uploads/cut.mp4']);
    const Detail = require('./BrandCampaignDetail').default;
    const { host, done } = await mount(<Detail />);
    try {
      expect(host.querySelector('.bui-budget').textContent).toContain('₹2,000');
      expect(host.querySelector('.bui-budget').textContent).not.toContain(' / ');
    } finally { await done(); }
  });
});

describe('Brand dashboard pages', () => {
  const campaigns = [{
    id: 'ship1', business_id: 'b1', title: 'Serum launch', status: 'in_progress', requires_shipment: true,
    selected_creator: 'cr1', bids: [{ creator_id: 'cr1', creator_name: 'Meera Shah', creator_photo: '/uploads/meera.jpg' }],
  }];
  const wire = (extra = {}) => axios.get.mockImplementation((url) => {
    if (url.endsWith('/campaigns') || url.includes('/campaigns?')) return Promise.resolve({ data: campaigns });
    if (url.includes('/business/dashboard')) return Promise.resolve({ data: {} });
    if (url.includes('/business/creator-directory')) return Promise.resolve({ data: [] });
    if (url.includes('/shipment/')) return Promise.resolve({ data: { status: 'in_transit', courier: 'Delhivery', tracking_number: 'T123' } });
    if (url.includes('/business/wallet')) return Promise.resolve({ data: extra.wallet || { available_balance: 5000, transactions: [] } });
    return Promise.resolve({ data: [] });
  });

  test('Manage Shipment names the hired creator from their bid when the directory does not list them', async () => {
    wire();
    const BusinessDashboard = require('./BusinessDashboard').default;
    const { host, done } = await mount(<BusinessDashboard page="shipments" />);
    try {
      const row = host.querySelector('[data-testid="shipment-ship1"]');
      expect(row).toBeTruthy();
      expect(row.textContent).toContain('Meera');
      expect(row.textContent).not.toContain('Creator Serum');
      expect(row.textContent).toContain('T123');
    } finally { await done(); }
  });

  test('Wallet offers a statement download once there are transactions, and not before', async () => {
    wire({ wallet: { available_balance: 5000, transactions: [{ id: 't1', date: '2026-10-01', type: 'Wallet Recharge', amount: 5000, direction: 'credit', status: 'success' }] } });
    const BusinessDashboard = require('./BusinessDashboard').default;
    let ui = await mount(<BusinessDashboard page="wallet" />);
    try {
      expect(buttonByText(ui.host, 'Download statement (CSV)')).toBeTruthy();
    } finally { await ui.done(); }
    wire();
    ui = await mount(<BusinessDashboard page="wallet" />);
    try {
      expect(buttonByText(ui.host, 'Download statement (CSV)')).toBeFalsy();
    } finally { await ui.done(); }
  });

  test('Wallet statement is not offered inside the mobile app WebView (it cannot save a blob)', async () => {
    window.ReactNativeWebView = { postMessage: jest.fn() };
    wire({ wallet: { available_balance: 5000, transactions: [{ id: 't1', date: '2026-10-01', type: 'Wallet Recharge', amount: 5000, direction: 'credit' }] } });
    const BusinessDashboard = require('./BusinessDashboard').default;
    const { host, done } = await mount(<BusinessDashboard page="wallet" />);
    try {
      expect(buttonByText(host, 'Download statement (CSV)')).toBeFalsy();
    } finally { delete window.ReactNativeWebView; await done(); }
  });
});

describe('Reviews page polling', () => {
  test('re-polls the reviews list but does not re-fetch every campaign and reviewer each time', async () => {
    jest.useFakeTimers();
    const reviews = [{ id: 'r1', campaign_id: 'camp1', reviewer_id: 'cr1', rating: 5, review: 'Great brand', created_at: new Date().toISOString() }];
    axios.get.mockImplementation((url) => {
      if (url.includes('/reviews/business/')) return Promise.resolve({ data: reviews });
      if (url.includes('/campaigns/camp1')) return Promise.resolve({ data: { title: 'Launch reel' } });
      if (url.includes('/profile/cr1')) return Promise.resolve({ data: { nickname: 'Asha' } });
      return Promise.resolve({ data: [] });
    });
    const BrandReviewsPage = require('./BrandReviewsPage').default;
    const { host, done } = await mount(<BrandReviewsPage />);
    try {
      expect(host.textContent).toContain('Great brand');
      expect(axios.get).toHaveBeenCalledTimes(3);
      await act(async () => { jest.advanceTimersByTime(15000); });
      expect(axios.get).toHaveBeenCalledTimes(4);
      expect(axios.get.mock.calls[3][0]).toContain('/reviews/business/');
    } finally { await done(); jest.useRealTimers(); }
  });
});

describe('Edited modules still load', () => {
  test.each([
    ['./PlanBrief'], ['./PostABrief'], ['./BrandCreators'], ['./BrandHome'], ['./CreatorProfilePage'],
    ['../components/ReviewModal'], ['../components/RevisionRequestModal'], ['../components/BookingCard'],
  ])('%s exports a component', (path) => {
    if (!globalThis.crypto) globalThis.crypto = require('crypto').webcrypto; // jsdom has none; PostABrief builds ids at import
    const mod = jest.requireActual(path);
    expect(['function', 'object']).toContain(typeof mod.default);
  });
});
