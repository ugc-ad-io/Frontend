import { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import BrandWorkReview from './BrandWorkReview';
jest.mock('axios', () => ({ get: jest.fn() }));
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('../components/BrandTopNavLayout', () => ({ children }) => <div>{children}</div>);
jest.mock('../components/ChatPopup', () => () => null);
jest.mock('../components/RevisionRequestModal', () => () => null);
jest.mock('../components/ReviewModal', () => () => null);
jest.mock('../components/VideoReviewModal', () => ({ __esModule: true,
  default: ({ freeRemaining, nextFee, paidFee }) => <div data-testid="revision-fees">{freeRemaining}/{nextFee}/{paidFee}</div>, fmtTs: () => '' }));
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
    const revision = [...host.querySelectorAll('button')].find(b => b.textContent.trim() === 'Request Revision');
    await act(async () => revision.click());
    expect(host.querySelector('[data-testid="revision-fees"]').textContent).toBe('0/700/700');
  } finally { await act(async () => root.unmount()); host.remove(); }
});
