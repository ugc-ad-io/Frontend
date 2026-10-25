import { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { toast } from 'sonner';

// The brief form is one page: three essential cards + four optional groups. "Review & publish"
// is the only gate before the confirm dialog, so these tests pin that gate (nothing is sent).
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn(), put: jest.fn(), patch: jest.fn(), delete: jest.fn() }));
jest.mock('sonner', () => ({ toast: { error: jest.fn(), success: jest.fn(), message: jest.fn(), info: jest.fn(), warning: jest.fn() } }));
jest.mock('../App', () => ({ useAuth: () => ({ user: { id: 'b1', role: 'business' } }) }));
jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
  useSearchParams: () => [new URLSearchParams(''), jest.fn()],
}));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = jest.fn(); // jsdom has no layout

async function mount(element) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(element));
  return { host, done: async () => { await act(async () => root.unmount()); host.remove(); } };
}

const setValue = async (el, value) => {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
  });
};
const click = async (el) => { await act(async () => { el.click(); }); };
const byPh = (host, ph) => host.querySelector(`[placeholder="${ph}"]`);
const chip = (host, text) => [...host.querySelectorAll('.bui-pb-chip')].find(b => b.textContent.trim() === text);
const review = (host) => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === 'Review & publish');
const iso = (offset) => { const d = new Date(); d.setDate(d.getDate() + offset); return d.toISOString().slice(0, 10); };

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  if (!globalThis.crypto) globalThis.crypto = require('crypto').webcrypto; // jsdom has none; the form builds ids
  axios.get.mockImplementation(() => Promise.resolve({ data: { brand_name: 'Glow Labs' } }));
  axios.post.mockResolvedValue({ data: { id: 'd1' } });
  axios.patch.mockResolvedValue({ data: {} });
});

describe('Post a campaign - single page', () => {
  test('Review & publish on an empty form lists what is missing, opens the groups and sends nothing', async () => {
    const PostABrief = require('./PostABrief').default;
    const { host, done } = await mount(<PostABrief />);
    try {
      expect(host.textContent).toContain('3 quick sections');
      expect(host.querySelectorAll('.bui-pb-sec')).toHaveLength(3);
      expect(host.querySelectorAll('.bui-pb-gbody')).toHaveLength(0);
      await click(review(host));
      const message = toast.error.mock.calls[0][0];
      expect(message).toContain('Campaign name');
      expect(message).toContain('Product description');
      expect(message).toContain('Platforms');
      expect(host.querySelectorAll('.bui-pb-gbody')).toHaveLength(4);   // details, include, style, rights
      expect(document.querySelector('.bui-pb-confirm')).toBeNull();
      expect(axios.post.mock.calls.filter(([url]) => !String(url).endsWith('/campaigns/draft'))).toHaveLength(0);
    } finally { await done(); }
  });

  test('a complete brief opens the confirm dialog with the escrow total (still not sent)', async () => {
    const PostABrief = require('./PostABrief').default;
    const { host, done } = await mount(<PostABrief />);
    try {
      await setValue(byPh(host, 'Summer Launch - Unboxing 2'), 'Glow Serum Morning Routine');
      await setValue(byPh(host, 'Glow Serum 30ml'), 'Glow Labs Vitamin C Serum');
      await setValue(byPh(host, 'Start with a morning routine problem-solution moment'), 'I tried this serum every morning for 7 days');
      await setValue(host.querySelector('select.bui-pb-select'), 'Beauty');
      await click(chip(host, 'Reel (9:16, under 30s)'));
      await setValue(byPh(host, '15-20 seconds'), '25 seconds');
      await setValue(byPh(host, '5000'), '5000');
      await setValue(host.querySelectorAll('input[type="date"]')[0], iso(2));
      await setValue(host.querySelectorAll('input[type="date"]')[1], iso(9));
      // optional groups that still hold required answers
      await click(review(host));
      await setValue(byPh(host, 'Describe the product, who it helps, and what creators should understand before filming.'), 'A lightweight vitamin C serum that brightens dull skin.');
      await setValue(byPh(host, 'The one message every video should communicate'), 'Visible glow in two weeks');
      await click(chip(host, 'Awareness'));
      await setValue(byPh(host, 'Urban women 25-35 interested in clean skincare.'), 'Women 22-35 in metro cities who are new to actives and want an easy daily routine');
      await setValue(byPh(host, '5 sec min'), '5');
      await setValue(byPh(host, 'Exact product name(s)'), 'Glow Labs');
      await setValue(byPh(host, 'https://yourbrand.com'), 'https://glowlabs.in');
      await click(chip(host, 'Authentic'));
      await click(chip(host, "Brand's own Instagram"));
      await click(chip(host, '6 months'));
      await click(chip(host, 'Limited (minor edits only)'));
      await click(chip(host, 'Verified'));
      await click(chip(host, 'A'));
      toast.error.mockClear();
      await click(review(host));
      expect(toast.error).not.toHaveBeenCalled();
      const dialog = document.querySelector('.bui-pb-confirm');
      expect(dialog).not.toBeNull();
      // 5000 x 1 video = 5000, + 20% = 1000, + 500 listing fee
      expect(dialog.textContent).toContain('₹6,500');
      expect(host.querySelector('.bui-pb-cost').textContent).toContain('₹6,500');
    } finally { await done(); }
  });
});
