import { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { draftTotalBudget } from '../utils/budgetLabel';

// A draft was never sent to anyone: the detail page must offer Edit Draft (the same
// ?draft= resume the list and dashboard use), show no "Brief Sent" progress and the real budget.
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() }));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn(), message: jest.fn(), info: jest.fn(), warning: jest.fn() } }));
jest.mock('../components/BrandTopNavLayout', () => ({ children }) => <div>{children}</div>);
jest.mock('../components/ChatPopup', () => () => null);
jest.mock('../components/PageModal', () => ({ children }) => <div>{children}</div>);
jest.mock('../components/ReviewModal', () => () => null);
jest.mock('../components/CreatorProfileModal', () => () => null);
jest.mock('../components/BookingCard', () => () => null);
jest.mock('../components/VideoReviewModal', () => () => null);
jest.mock('../components/RevisionRequestModal', () => () => null);
jest.mock('./PostABrief', () => () => null);
jest.mock('./CampaignDetails', () => () => null);
jest.mock('./ShipmentTracking', () => () => null);
jest.mock('../App', () => ({ useAuth: () => ({ user: { id: 'b1', role: 'business' } }) }));
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: 'camp1' }),
  useSearchParams: () => [new URLSearchParams(''), jest.fn()],
}));
jest.mock('../lib/liveUpdates', () => ({ useLiveEffect: require('react').useEffect }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function mount(element) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  return { host, done: async () => { await act(async () => root.unmount()); host.remove(); } };
}
const wire = (campaign) => axios.get.mockImplementation((url) => {
  if (url.includes('/campaigns/camp1')) return Promise.resolve({ data: campaign });
  return Promise.resolve({ data: [] });
});
const base = { id: 'camp1', business_id: 'b1', title: 'Summer reel', bids: [], created_at: '2026-10-01T00:00:00Z' };

beforeEach(() => { jest.clearAllMocks(); });

test('draftTotalBudget: stored total wins, else per-video x deliverables x creators, else 0', () => {
  expect(draftTotalBudget({ budget: 9000, budget_max: 1 })).toBe(9000);
  expect(draftTotalBudget({ per_video_budget: 2000, creators_wanted: 2, deliverable_items: [{ quantity: 2 }, {}] })).toBe(12000);
  expect(draftTotalBudget({ budget_max: 1500 })).toBe(1500);
  expect(draftTotalBudget({})).toBe(0);
});

describe('Campaign detail for a draft', () => {
  test('Edit Draft reopens the brief wizard on this draft; no fake progress; derived budget', async () => {
    wire({ ...base, status: 'draft', per_video_budget: 2000, creators_wanted: 2, deliverable_items: [{ quantity: 3 }] });
    const Detail = require('./BrandCampaignDetail').default;
    const { host, done } = await mount(<Detail />);
    try {
      const edit = host.querySelector('[data-testid="edit-draft-btn"]');
      expect(edit.textContent).toContain('Edit Draft');
      await act(async () => { edit.click(); });
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard/business/post-brief?draft=camp1');
      expect(host.textContent).not.toContain('Campaign progress');
      expect(host.textContent).not.toContain('Brief Sent');
      expect(host.textContent).toContain('This campaign is a draft');
      expect(host.querySelector('.bui-budget').textContent).toContain('₹12,000');
      expect(host.textContent).toContain('Created ');
    } finally { await done(); }
  });

  test('a draft with no budget says "Not set yet", never Rs. 0', async () => {
    wire({ ...base, status: 'draft' });
    const Detail = require('./BrandCampaignDetail').default;
    const { host, done } = await mount(<Detail />);
    try {
      expect(host.querySelector('.bui-budget').textContent).toContain('Not set yet');
      expect(host.querySelector('.bui-budget').textContent).not.toContain('₹0');
    } finally { await done(); }
  });

  test('a live campaign keeps its progress timeline and has no Edit Draft', async () => {
    wire({ ...base, status: 'active', budget_min: 2000, budget_max: 2000 });
    const Detail = require('./BrandCampaignDetail').default;
    const { host, done } = await mount(<Detail />);
    try {
      expect(host.querySelector('[data-testid="edit-draft-btn"]')).toBeNull();
      expect(host.textContent).toContain('Campaign progress');
      expect(host.textContent).toContain('Launched ');
    } finally { await done(); }
  });
});
