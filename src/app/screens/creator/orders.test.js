import { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { uploadMedia } from '../../../utils/upload';
import Orders from './Orders';
import { roomProgress, groupDeals, getPrimaryActionConfig, toChangeItems, parseChange } from './orderLogic';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockSearch = '';
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useLocation: () => ({ pathname: '/my-deals', search: '' }),
  useSearchParams: () => [new URLSearchParams(mockSearch), jest.fn()],
}));

jest.mock('../../../App', () => ({
  useAuth: () => ({ user: { id: 'cr-1', role: 'creator', approval_status: 'approved', full_name: 'Priya Das' }, logout: () => {} }),
}));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('../../../utils/upload', () => ({
  MAX_UPLOAD_MB: 400,
  uploadMedia: jest.fn(() => Promise.resolve({ file_url: '/uploads/clip.mp4' })),
}));
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() }));

const deal = (id, state, extra = {}) => ({
  deal_id: id, current_state: state, active_party: 'creator', deadline_countdown_hours: 40, primary_next_action: 'Upload your video',
  brand: { id: 'br-1', name: 'Glow Labs' }, campaign: { id: `c-${id}`, title: `Title ${id}`, business_id: 'br-1' },
  escrow: { held_amount: 10500, net_payable: 10500 }, ...extra,
});
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

let host; let root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  jest.clearAllMocks();
});
afterEach(() => { act(() => root.unmount()); host.remove(); document.body.innerHTML = ''; });
const show = (url) => { mockSearch = url.split('?')[1] || ''; return act(() => root.render(<Orders />)); };
const buttons = (text) => [...document.querySelectorAll('button')].filter((b) => b.textContent.includes(text));
const button = (text) => buttons(text)[0];

test('logic: progress, grouping and the primary action follow the website rules', () => {
  expect(roomProgress(deal('a', 'Received - Content in Progress'), false).labels[roomProgress(deal('a', 'Received - Content in Progress'), false).cur]).toBe('Film');
  expect(roomProgress(deal('a', 'Paid - Complete')).done).toBe(true);
  const g = groupDeals([deal('1', 'Received - Content in Progress'), deal('2', 'Content Submitted - Awaiting Review'), deal('3', 'Paid - Complete'), deal('4', 'Cancelled')]);
  expect([g.active.length, g.delivered.length, g.completed.length, g.cancelled.length]).toEqual([1, 1, 1, 1]);
  const d = deal('5', 'Received - Content in Progress', { can_submit_content: true });
  expect(getPrimaryActionConfig(d, {}, false).disabled).toBe(true);
  expect(getPrimaryActionConfig(d, { finalVideoUrl: '/v.mp4' }, false).disabled).toBe(false);
  expect(toChangeItems({ requested_changes: ['[must-fix @ 0:04] Start with the bite'] })).toHaveLength(1);
  expect(parseChange('[must-fix @ 0:04] Start with the bite')).toMatchObject({ severity: 'must-fix', timestamp: '0:04', text: 'Start with the bite' });
});

test('list: groups orders into tabs, shows next action, and an error offers Retry', async () => {
  axios.get.mockResolvedValue({ data: [deal('UG-1', 'Received - Content in Progress'), deal('UG-2', 'Paid - Complete')] });
  show('/my-deals');
  await flush();
  expect(host.textContent).toContain('Title UG-1');
  expect(host.textContent).toContain('Recently completed'); // the paid order sits under Completed, not Active
  expect(button('Deliver')).toBeTruthy();

  act(() => root.unmount());
  root = createRoot(host);
  axios.get.mockRejectedValue(new Error('Network Error'));
  show('/my-deals');
  await flush();
  expect(host.textContent).toContain("You're offline");
  expect(button('Retry')).toBeTruthy();
});

test('room: pick a video, review and send posts the delivery to /deals/:id/content', async () => {
  const detail = deal('UG-1', 'Received - Content in Progress', {
    can_submit_content: true, content_submission: { required_assets: {}, versions: [] }, brief_sections: [], activity_feed: [],
    chat_summary: { messages: [] }, shipment: {}, receipt: {},
  });
  axios.get.mockImplementation((url) => Promise.resolve({ data: url.includes('/detail') ? detail : [detail] }));
  axios.post.mockResolvedValue({ data: { ok: true } });
  uploadMedia.mockResolvedValue({ file_url: '/uploads/clip.mp4' });
  show('/my-deals?campaign=c-UG-1');
  await flush();
  expect(host.textContent).toContain('Deliver your video');

  act(() => { button('Upload video').click(); });
  const input = document.querySelector('[data-testid=pick-video]');
  const file = new File(['x'], 'clip.mp4', { type: 'video/mp4' });
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })); });
  await flush();
  expect(document.body.textContent).toContain('clip.mp4');

  act(() => { buttons('Review & send').pop().click(); }); // the sheet's button is the last one
  expect(document.body.textContent).toContain('Ready to send?');
  await act(async () => { button('Send to Glow Labs').click(); });
  await flush();
  expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/deals/UG-1/content'), expect.objectContaining({ video_url: '/uploads/clip.mp4' }));
});
