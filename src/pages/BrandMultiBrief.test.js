import { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { toast } from 'sonner';

jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn() } }));
jest.mock('../components/BrandTopNavLayout', () => ({ children }) => <div>{children}</div>);
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
const mockSaved = new Set(['cr3', 'cr2', 'cr1']);   // the page lists newest save first, so rows read cr1, cr2, cr3
jest.mock('../utils/savedCreators', () => ({
  useSavedCreatorIds: () => mockSaved,
  loadSavedCreators: jest.fn(() => Promise.resolve()),
}));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const campaign = {
  id: 'camp1', status: 'active', title: 'Glow serum', product_name: 'Glow Serum',
  product_description: 'A vitamin C serum for daily use', campaign_hook: 'I tried this for 7 days', key_message: 'Visible glow',
  aspect_ratio: '9:16', deliverable_items: [{ type: 'Reel', quantity: 2, duration: '30 Sec', raw_required: true, edited_required: true, edited_by: 'creator' }],
};
const profile = (price, editing) => ({ data: { profile: { rate_card: { raw_payout: price, editing_payout: editing } } } });

const wire = () => axios.get.mockImplementation((url) => {
  if (url.endsWith('/business/creator-directory')) return Promise.resolve({ data: { creators: [
    { id: 'cr1', nickname: 'Asha', level: 'l1' }, { id: 'cr2', nickname: 'Ben', level: 'elite' }, { id: 'cr3', nickname: 'Cleo' }] } });
  if (url.endsWith('/campaigns')) return Promise.resolve({ data: [campaign, { ...campaign, id: 'priv', visibility: 'private' }, { ...campaign, id: 'draft', status: 'draft' }] });
  if (url.endsWith('/business/settings/billing')) return Promise.resolve({ data: { commission_rate: 20 } });
  if (url.endsWith('/business/wallet')) return Promise.resolve({ data: { available_balance: 100000 } });
  if (url.endsWith('/profile/cr1')) return Promise.resolve(profile(4000, 500));
  if (url.endsWith('/profile/cr2')) return Promise.resolve(profile(3000, 0));
  if (url.endsWith('/profile/cr3')) return Promise.resolve(profile(0, 0));   // no published rate
  return Promise.reject(new Error(`unexpected GET ${url}`));
});

async function mount(element) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  return { host, done: async () => { await act(async () => root.unmount()); host.remove(); } };
}
const click = async (el) => { await act(async () => { el.click(); }); };
const setValue = async (el, value) => {
  const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  });
};

beforeEach(() => { jest.clearAllMocks(); wire(); });

describe('BrandMultiBrief', () => {
  const setup = async () => {
    const BrandMultiBrief = require('./BrandMultiBrief').default;
    const m = await mount(<BrandMultiBrief />);
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });   // let the profile/rate requests settle
    const rows = [...m.host.querySelectorAll('.bui-mb-row')];
    return { ...m, rows, send: () => [...m.host.querySelectorAll('button')].find((b) => /^Send brief to/.test(b.textContent)) };
  };

  test('lists only open public campaigns and blocks creators with no rate', async () => {
    const { host, rows, done } = await setup();
    try {
      expect([...host.querySelectorAll('.bui-mb-sel option')].map((o) => o.textContent)).toEqual(['Choose a campaign', 'Glow serum']);
      expect(rows).toHaveLength(3);
      expect(rows[2].disabled).toBe(true);
      expect(rows[2].textContent).toContain('Rate on request');
    } finally { await done(); }
  });

  test('sends one private-brief request per selected creator, priced from each creator and never twice', async () => {
    axios.post.mockResolvedValueOnce({ data: {} }).mockRejectedValueOnce({ response: { status: 400, data: { detail: 'Creator unavailable' } } });
    const { host, rows, send, done } = await setup();
    try {
      await click(rows[0]);
      await click(rows[1]);
      expect(send().disabled).toBe(true);   // no campaign / date yet
      await setValue(host.querySelector('.bui-mb-sel select'), 'camp1');
      await setValue(host.querySelector('input[type="date"]'), '2099-01-02');
      // cr1: (4000 + 500 editing) x 2 videos = 9,000; cr2: 3,000 x 2 = 6,000; plus the 20% fee on each
      expect(host.querySelector('.bui-mb-line strong').textContent).toBe('₹18,000');
      expect(send().textContent).toBe('Send brief to 2');
      const btn = send();
      await act(async () => { btn.click(); btn.click(); });   // a double press must not start a second round
      expect(axios.post).toHaveBeenCalledTimes(2);
      const [url1, body1] = axios.post.mock.calls[0];
      expect(url1).toMatch(/\/api\/campaigns$/);
      expect(body1).toEqual(expect.objectContaining({
        selected_creator: 'cr1', visibility: 'private', status: 'pending_approval', title: 'Glow serum',
        product_name: 'Glow Serum', campaign_hook: 'I tried this for 7 days', key_message: 'Visible glow',
        per_video_budget: 4500, editing_fee_per_video: 500, raw_payout_per_video: 4000, due_date: '2099-01-02',
      }));
      expect(body1.deliverable_items[0]).toEqual(expect.objectContaining({ quantity: 2, edited_required: true, edited_by: 'creator' }));
      expect(axios.post.mock.calls[1][1]).toEqual(expect.objectContaining({ selected_creator: 'cr2', per_video_budget: 3000, editing_fee_per_video: 0 }));
      // one success, one failure: summary toast names the failed creator, the sent one cannot be sent again
      expect(toast.error.mock.calls[0][0]).toContain('Sent to 1 of 2');
      expect(toast.error.mock.calls[0][0]).toContain('Ben');
      expect(toast.error.mock.calls[0][0]).toContain('Creator unavailable');
      expect(rows[0].disabled).toBe(true);
      expect(rows[0].textContent).toContain('Sent');
      expect(send().textContent).toBe('Send brief to 1');   // the failed one stays ticked for a retry
      await click(send());
      expect(axios.post).toHaveBeenCalledTimes(3);   // retry sends only Ben again, never Asha
      expect(axios.post.mock.calls[2][1].selected_creator).toBe('cr2');
    } finally { await done(); }
  });
});
