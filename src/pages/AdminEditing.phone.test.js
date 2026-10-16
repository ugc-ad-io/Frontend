import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import { uploadMedia } from '../utils/upload';
import AdminEditing from './AdminEditing';
jest.mock('axios', () => ({ get: jest.fn(), post: jest.fn() }));
jest.mock('../utils/upload', () => ({ uploadMedia: jest.fn() }));
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('../components/AdminLayout', () => ({ children }) => <div>{children}</div>);
jest.mock('../lib/useIsPhone', () => () => true);
jest.mock('../lib/liveUpdates', () => ({ useLiveEffect: (...args) => require('react').useEffect(...args) }));

const click = (el) => act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const pickFile = (input, file) => act(async () => {
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
});

test('phone editing queue: card, attach sheet shows failure then posts once on success', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  axios.get.mockResolvedValue({ data: [{
    work_id: 'w1', campaign_title: 'Summer Serum', brand_name: 'Glow Labs', creator_name: 'Arushi',
    raw_files: ['/uploads/raw1.mp4'], description: 'Two takes', submitted_at: '2026-10-14T10:00:00Z',
  }] });
  axios.post.mockResolvedValue({ data: {} });
  uploadMedia.mockRejectedValueOnce(new Error('Network down')).mockResolvedValueOnce({ file_url: '/uploads/final.mp4' });
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<AdminEditing />));
    const card = container.querySelector('[data-testid="edit-card-w1"]');
    for (const t of ['Summer Serum', 'Glow Labs', 'Arushi', 'Awaiting edit', 'Two takes', 'Raw file 1']) expect(card.textContent).toContain(t);

    await click(container.querySelector('[data-testid="edit-upload-w1"]'));
    const submit = () => container.querySelector('[data-testid="edit-submit"]');
    expect(submit().disabled).toBe(true); // no file chosen yet
    await pickFile(container.querySelector('#amo-edit-file'), new File(['x'], 'final.mp4', { type: 'video/mp4' }));
    expect(container.textContent).toContain('final.mp4');

    await click(submit());
    expect(container.querySelector('[data-testid="edit-sheet"] [role="alert"]').textContent).toContain('Network down');
    expect(axios.post).not.toHaveBeenCalled();

    await click(submit());
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/admin/editing-queue/w1/complete'), { edited_file_url: '/uploads/final.mp4', note: undefined });
    expect(container.querySelector('[data-testid="edit-sheet"]')).toBeNull();
  } finally { await act(async () => root.unmount()); container.remove(); }
});
