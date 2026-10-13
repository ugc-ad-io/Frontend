import { act } from 'react';
import { createRoot } from 'react-dom/client';
import PhotoOrInitial from './PhotoOrInitial';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let host;
let root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

const show = (props) => act(() => root.render(<span><PhotoOrInitial {...props} /></span>));
const failImage = () => act(() => { host.querySelector('img').dispatchEvent(new Event('error')); });

test('shows the photo while it loads fine', () => {
  show({ src: 'https://x/p.jpg', initial: 'S' });
  expect(host.querySelector('img').getAttribute('src')).toBe('https://x/p.jpg');
  expect(host.textContent).toBe('');
});

test('falls back to the initial when the photo fails to load', () => {
  show({ src: 'https://dead/p.jpg', initial: 'S' });
  failImage();
  expect(host.querySelector('img')).toBeNull();
  expect(host.textContent).toBe('S');
});

test('no photo shows the initial straight away; a new src gets a fresh try', () => {
  show({ src: '', initial: 'R' });
  expect(host.textContent).toBe('R');

  show({ src: 'https://dead/a.jpg', initial: 'R' });
  failImage();
  expect(host.textContent).toBe('R');

  show({ src: 'https://ok/b.jpg', initial: 'R' });
  expect(host.querySelector('img').getAttribute('src')).toBe('https://ok/b.jpg');
});
