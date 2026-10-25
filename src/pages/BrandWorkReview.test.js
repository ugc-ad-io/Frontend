import { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import BrandWorkReview from './BrandWorkReview';
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('../components/BrandTopNavLayout', () => ({ children }) => <div>{children}</div>);
jest.mock('../components/ChatPopup', () => () => null);
jest.mock('../components/RevisionRequestModal', () => () => null);
jest.mock('../components/ReviewModal', () => () => <div data-testid="rating-prompt" />);
jest.mock('../components/VideoReviewModal', () => ({ __esModule: true,
  default: ({ freeRemaining, nextFee, paidFee, onSubmit }) => (<div>
    <div data-testid="revision-fees">{freeRemaining}/{nextFee}/{paidFee}</div>
    <button data-testid="send-revision" onClick={() => onSubmit({ items: [{ description: 'Fix intro', severity: 'must-fix', timestamp_seconds: 4 }], notes: '', deadline_at: 'DEADLINE' })} />
  </div>), fmtTs: () => '' }));
jest.mock('../utils/downloadDeliverable', () => ({ downloadDeliverable: jest.fn() }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('work review loads without building every deal and keeps creator-specific revision fees', async () => {
  axios.get.mockResolvedValue({ data: [{ id: 'campaign~creator2', campaignId: 'campaign',
    title: 'Second creator work', creator: 'Creator', files: ['sample.mp4'],
    status: 'pending_review', freeRevisionsRemaining: 0, nextRevisionFee: 700, paidRevisionFee: 700 }] });
  const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<BrandWorkReview />));
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get.mock.calls[0][0]).toContain('/business/work-review');
    const revision = [...host.querySelectorAll('button')].find(b => b.textContent.trim() === 'Request revision');
    await act(async () => revision.click());
    expect(host.querySelector('[data-testid="revision-fees"]').textContent).toBe('0/700/700');
  } finally { await act(async () => root.unmount()); host.remove(); }
});


test.each([['raw', 'awaiting_edited', false], ['raw', 'released', false], ['edited', 'released', true]])(
  'approval at %s / %s prompts for a review: %s', async (stage, payout, expected) => {
    axios.get.mockReset(); axios.post.mockReset();
    axios.get.mockResolvedValue({ data: [{ id: 'c', campaignId: 'c', creatorId: 'creator', title: 'Reel',
      creator: 'Creator', files: ['sample.mp4'], status: 'pending_review', stage }] });
    axios.post.mockResolvedValue({ data: { payout_status: payout } });
    const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host);
    try {
      await act(async () => root.render(<BrandWorkReview />));
      const approve = [...host.querySelectorAll('button')].find(b => b.classList.contains('approve'));
      await act(async () => approve.click());
      expect(Boolean(host.querySelector('[data-testid="rating-prompt"]'))).toBe(expected);
    } finally { await act(async () => root.unmount()); host.remove(); }
  }
);


test('a revision is posted to the work endpoint with items and deadline, resolved from the real campaign and creator', async () => {
  axios.get.mockReset(); axios.post.mockReset();
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.includes('/business/work-review')
    ? [{ id: 'campaign~creator2', campaignId: 'campaign', creatorId: 'creator2', title: 'Reel', creator: 'Creator',
      files: ['sample.mp4'], status: 'pending_review', freeRevisionsRemaining: 2 }]
    : { id: 'work-9' } }));
  axios.post.mockResolvedValue({ data: {} });
  const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<BrandWorkReview />));
    const revision = [...host.querySelectorAll('button')].find(b => b.textContent.trim() === 'Request revision');
    await act(async () => revision.click());
    await act(async () => host.querySelector('[data-testid="send-revision"]').click());
    expect(axios.get.mock.calls.some(([u]) => u.endsWith('/work/campaign/campaign?creator_id=creator2'))).toBe(true);
    expect(axios.post).toHaveBeenCalledTimes(1);
    const [url, body] = axios.post.mock.calls[0];
    expect(url).toMatch(/\/work\/work-9\/request-revision$/);
    expect(body).toEqual({ items: [{ description: 'Fix intro', severity: 'must-fix', timestamp_seconds: 4 }], notes: '', deadline_at: 'DEADLINE' });
  } finally { await act(async () => root.unmount()); host.remove(); }
});

test('the campaign link uses the real campaign id, not the "<campaign>~<creator>" deal id', async () => {
  axios.get.mockReset(); axios.post.mockReset(); mockNavigate.mockClear();
  axios.get.mockResolvedValue({ data: [{ id: 'campaign~creator2', campaignId: 'campaign', creatorId: 'creator2',
    title: 'Reel', campaign: 'Reel', creator: 'Creator', files: ['sample.mp4'], status: 'pending_review' }] });
  const host = document.createElement('div'); document.body.appendChild(host); const root = createRoot(host);
  try {
    await act(async () => root.render(<BrandWorkReview />));
    await act(async () => host.querySelector('.bui-wr-camp').click());
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard/business/campaign/campaign');
  } finally { await act(async () => root.unmount()); host.remove(); }
});
