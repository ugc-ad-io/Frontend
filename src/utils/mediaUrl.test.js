import { mediaUrl } from './mediaUrl';
const base = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
afterEach(() => localStorage.clear());
test('native uploads carry authentication and retain query and fragment', () => {
  localStorage.setItem('token', 'test-token');
  const url = new URL(mediaUrl('/uploads/raw.mp4?preview=1#t=0.5'));
  expect(url.searchParams.get('token')).toBe('test-token');
  expect(url.searchParams.get('preview')).toBe('1');
  expect(url.hash).toBe('#t=0.5');
});
test('external storage and public backend routes never receive the login token', () => {
  localStorage.setItem('token', 'test-token');
  expect(mediaUrl('https://external.example.com/uploads/raw.mp4')).toBe('https://external.example.com/uploads/raw.mp4');
  expect(mediaUrl('/api/file')).toBe(`${base}/api/file`);
});
