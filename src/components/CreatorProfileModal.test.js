import { act } from 'react';
import { createRoot } from 'react-dom/client';
import axios from 'axios';
import CreatorProfileModal from './CreatorProfileModal';
import { publishLiveUpdate } from '../lib/liveUpdates';

jest.mock('axios', () => ({ get: jest.fn(), put: jest.fn() }));
jest.mock('../App', () => ({ useAuth: () => ({ user: { id: 'creator', role: 'creator' } }) }));
jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));
jest.mock('../utils/upload', () => ({ uploadMedia: jest.fn() }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let host, root;
const stored = { id: 'creator', nickname: 'Creator', profile: { fullName: 'Old Name', address: 'Old Address', delivery_days: 7 }, portfolio: [] };
beforeEach(() => {
  window.matchMedia = jest.fn(() => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }));
  Element.prototype.scrollIntoView = jest.fn();
  axios.get.mockImplementation(url => Promise.resolve({ data: url.includes('/profile/') ? JSON.parse(JSON.stringify(stored)) : [] }));
  axios.put.mockResolvedValue({ data: { message: 'Profile updated' } });
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); jest.clearAllMocks(); });
const button = text => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text);
const field = text => [...host.querySelectorAll('label')].find(l => l.firstChild?.textContent.trim() === text)?.querySelector('input,textarea');
const type = async (label, value) => {
  const input = field(label);
  await act(async () => {
    const prototype = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

test('one save retains edits in multiple sections across a background profile refresh', async () => {
  await act(async () => root.render(<CreatorProfileModal id="creator" editable asPage />));
  await act(async () => button('Edit Profile').click());
  await type('Full Name', 'New Name');
  await act(async () => publishLiveUpdate());
  await type('Address', 'New Address');
  await act(async () => publishLiveUpdate());
  await act(async () => button('Save').click());
  expect(axios.put).toHaveBeenCalledWith(expect.stringContaining('/profile/creator'),
    expect.objectContaining({ fullName: 'New Name', address: 'New Address', delivery_days: 7 }));
});

test('cancel discards draft edits when the editor is reopened', async () => {
  await act(async () => root.render(<CreatorProfileModal id="creator" editable asPage />));
  await act(async () => button('Edit Profile').click());
  await type('Full Name', 'Unsaved Name');
  await act(async () => button('Cancel').click());
  await act(async () => button('Edit Profile').click());
  expect(field('Full Name').value).toBe('Old Name');
  expect(axios.put).not.toHaveBeenCalled();
});
