import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import AdminKYC from './AdminKYC';
import AdminGST from './AdminGST';
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../App', () => ({ useAuth: () => ({ user: { id: 'admin', role: 'admin' } }) }));
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('../components/AdminLayout', () => ({ children }) => <div>{children}</div>);
jest.mock('../lib/useIsPhone', () => () => true);
jest.mock('../lib/liveUpdates', () => ({ useLiveEffect: (...args) => require('react').useEffect(...args) }));

const click = (el) => act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const type = (el, value) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});

async function mount(ui) {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(ui));
  return { container, done: async () => { await act(async () => root.unmount()); container.remove(); } };
}

beforeEach(() => { axios.get.mockReset(); axios.post.mockReset(); });

test('phone KYC: card opens a masked review, Show reveals, reject needs a reason, back closes', async () => {
  axios.get.mockResolvedValue({ data: [{
    id: 'u1', email: 'arushi@example.com', upi_id: 'arushi@upi',
    kyc: { status: 'pending', full_legal_name: 'Arushi Mehta', aadhaar_number: '123456783702', pan_number: 'ABCDE1130B',
      date_of_birth: '2000-01-02', submitted_at: '2026-10-01T10:00:00Z', pan_doc_url: '/files/pan.jpg',
      address: { line: '1 MG Road', city: 'Pune', state: 'MH', pincode: '411001' } },
  }] });
  axios.post.mockResolvedValue({ data: { success: true } });
  const { container, done } = await mount(<AdminKYC />);
  try {
    expect(container.textContent).toContain('Arushi Mehta');
    await click(container.querySelector('[data-testid="kyc-row-u1"]'));
    const detail = container.querySelector('[data-testid="kyc-detail"]');
    expect(detail.textContent).toContain('KYC review');
    expect(detail.textContent).toContain('•••• •••• 3702');
    expect(detail.textContent).toContain('••••••130B');
    expect(detail.textContent).not.toContain('123456783702');

    await click([...detail.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Show'));
    expect(container.textContent).toContain('123456783702');

    await click([...detail.querySelectorAll('button')].find((b) => b.textContent === 'View'));
    expect(container.querySelector('[data-testid="kyc-doc-viewer"]')).not.toBeNull();
    await click(container.querySelector('[aria-label="Close document"]'));
    expect(container.querySelector('[data-testid="kyc-doc-viewer"]')).toBeNull();

    await click([...detail.querySelectorAll('button')].find((b) => b.textContent === 'Reject'));
    const confirm = container.querySelector('[data-testid="kyc-reject-confirm"]');
    expect(confirm.disabled).toBe(true);
    await type(container.querySelector('#amk-rejection-reason'), 'Blurry PAN');
    expect(confirm.disabled).toBe(false);
    await click(confirm);
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/admin/kyc/u1/review'), { action: 'reject', reason: 'Blurry PAN' });
    expect(container.querySelector('[data-testid="kyc-detail"]')).toBeNull(); // closes after success
  } finally { await done(); }
});

test('phone GST: card opens a masked review and back returns to the list', async () => {
  axios.get.mockResolvedValue({ data: [{ user_id: 'b1', brand_name: 'Glow Labs', email: 'g@x.com', gstin: '27AAPFU0939F1ZV', legal_name: 'Glow Labs LLP', status: 'pending', submitted_at: '2026-10-01T10:00:00Z' }] });
  const { container, done } = await mount(<AdminGST />);
  try {
    await click(container.querySelector('[data-testid="gst-row-b1"]'));
    const detail = container.querySelector('[data-testid="gst-detail"]');
    expect(detail.textContent).toContain('27•••••••••F1ZV');
    expect(detail.textContent).not.toContain('27AAPFU0939F1ZV');
    await click(container.querySelector('[aria-label="Back to GST queue"]'));
    expect(container.querySelector('[data-testid="gst-detail"]')).toBeNull();
    expect(container.textContent).toContain('Glow Labs');
  } finally { await done(); }
});
