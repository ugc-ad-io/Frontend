import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import AdminHomeShowcase from './AdminHomeShowcase';
jest.mock('axios', () => ({ get: jest.fn(), put: jest.fn() }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn(), message: jest.fn() } }));
jest.mock('../components/AdminLayout', () => ({ children }) => <div>{children}</div>);
jest.mock('../lib/useIsPhone', () => () => true);
jest.mock('../lib/liveUpdates', () => ({ useLiveEffect: (...args) => require('react').useEffect(...args) }));

const click = (el) => act(async () => el.dispatchEvent(new MouseEvent('click', { bubbles: true })));
const setValue = (el, value) => act(async () => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});

test('phone showcase: cards, full-screen editor, add + remove, Save puts once', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  axios.get.mockImplementation((url) => Promise.resolve({
    data: { items: url.endsWith('/creators') ? [] : [{ name: 'Priya', category: 'Beauty', earned: 420000, deals: 12, rating: 4.9, level: 'Elite', video_url: '' }] },
  }));
  axios.put.mockImplementation((url, body) => Promise.resolve({ data: body }));
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  const $ = (id) => container.querySelector(`[data-testid="${id}"]`);
  try {
    const mountUi = (ui) => root.render(ui); // createRoot, not Testing Library
    await act(async () => mountUi(<AdminHomeShowcase />));
    const card = $('showcase-card-0');
    expect(card.textContent).toContain('Priya');
    expect(card.textContent).toContain('₹4,20,000');
    expect(card.textContent).toContain('No video');

    await click(card);
    await setValue(container.querySelector('#ahs-ph-earned'), '5000x00');
    expect(container.querySelector('#ahs-ph-earned').value).toBe('500000');
    await click($('showcase-back'));

    await click($('showcase-add'));               // adds a card and opens it
    expect($('showcase-editor').textContent).toContain('A name is required');
    await click($('showcase-remove'));
    expect($('showcase-card-1')).toBeNull();

    await click($('showcase-save'));
    expect(axios.put).toHaveBeenCalledTimes(1);
    expect(axios.put.mock.calls[0][1].items).toEqual([
      { name: 'Priya', category: 'Beauty', earned: 500000, deals: 12, rating: 4.9, level: 'Elite', video_url: '' },
    ]);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});
