import axios from 'axios';
import { downloadDeliverable } from './downloadDeliverable';

jest.mock('axios', () => ({ get: jest.fn() }));

let clicked;
beforeEach(() => {
  jest.clearAllMocks();
  clicked = [];
  window.open = jest.fn();
  window.URL.createObjectURL = jest.fn(() => 'blob:saved');
  window.URL.revokeObjectURL = jest.fn();
  // jsdom would try to navigate on a.click(); record it instead.
  jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function click() {
    clicked.push({ href: this.href, download: this.download, target: this.target });
  });
});
afterEach(() => { jest.restoreAllMocks(); delete global.fetch; });

test('a forced-attachment link downloads in place: anchor click, no new tab', async () => {
  axios.get.mockResolvedValue({ data: { url: 'https://bucket.s3.amazonaws.com/x.mp4?sig=1', forced: true, filename: 'x.mp4' } });
  await downloadDeliverable('http://api', 'w1', 'Video');
  expect(clicked).toEqual([{ href: 'https://bucket.s3.amazonaws.com/x.mp4?sig=1', download: 'x.mp4', target: '' }]);
  expect(window.open).not.toHaveBeenCalled();
});

test('a non-forcing external host is saved as a blob in the page, not opened in a tab', async () => {
  axios.get.mockResolvedValue({ data: { url: 'https://cdn.example.com/x.mp4', forced: false, filename: 'x.mp4' } });
  global.fetch = jest.fn(() => Promise.resolve({ ok: true, blob: () => Promise.resolve(new Blob(['v'])) }));
  await downloadDeliverable('http://api', 'w1', 'Video');
  expect(global.fetch).toHaveBeenCalledWith('https://cdn.example.com/x.mp4');
  expect(clicked).toEqual([{ href: 'blob:saved', download: 'x.mp4', target: '' }]);
});

test('if the host blocks the blob fetch, the file still opens instead of failing silently', async () => {
  axios.get.mockResolvedValue({ data: { url: 'https://cdn.example.com/x.mp4', forced: false, filename: 'x.mp4' } });
  global.fetch = jest.fn(() => Promise.reject(new TypeError('CORS')));
  await downloadDeliverable('http://api', 'w1', 'Video');
  expect(clicked).toEqual([{ href: 'https://cdn.example.com/x.mp4', download: '', target: '_blank' }]);
});
