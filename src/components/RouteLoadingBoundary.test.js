import React, { act, startTransition, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import RouteLoadingBoundary from './RouteLoadingBoundary';
import retryLazy from '../lib/retryLazy';
let mockPathname = '/overview';
jest.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: mockPathname }) }));

async function mount(render) {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(render));
  return { container, root, done: async () => { await act(async () => root.unmount()); container.remove(); } };
}

test('a tab whose code is still downloading shows a skeleton, never the dark loader, and then the page', async () => {
  let finishDownload;
  const Applications = retryLazy(() => new Promise(resolve => { finishDownload = resolve; }));
  const Pages = ({ applications = false }) => (
    <RouteLoadingBoundary>{applications ? <Applications /> : <div>Old overview</div>}</RouteLoadingBoundary>
  );
  const { container, root, done } = await mount(<Pages />);
  try {
    expect(container.textContent).toContain('Old overview');
    mockPathname = '/applications';
    await act(async () => startTransition(() => root.render(<Pages applications />)));
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 150)); });
    expect(container.querySelector('[role="status"] .sk')).not.toBeNull();
    expect(container.textContent).not.toContain('Loading page...');
    await act(async () => finishDownload({ default: () => <div>Applications loaded</div> }));
    expect(container.textContent).toContain('Applications loaded');
    expect(container.querySelector('[role="status"]')).toBeNull();
  } finally { await done(); }
});

test('moving between tabs of one page keeps it mounted instead of rebuilding it', async () => {
  let mounts = 0;
  function Dashboard({ tab }) { useEffect(() => { mounts += 1; }, []); return <div>{tab}</div>; }
  const Pages = ({ tab }) => <RouteLoadingBoundary><Dashboard tab={tab} /></RouteLoadingBoundary>;
  mockPathname = '/wallet';
  const { container, root, done } = await mount(<Pages tab="wallet" />);
  try {
    mockPathname = '/shipments';
    await act(async () => root.render(<Pages tab="shipments" />));
    expect(container.textContent).toBe('shipments');
    expect(mounts).toBe(1);
  } finally { await done(); }
});

test('a page that fails does not leave the error screen on the next tab', async () => {
  const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  function Broken() { throw new TypeError('Cannot read properties of undefined'); }
  const Pages = ({ broken }) => (
    <RouteLoadingBoundary>{broken ? <Broken /> : <div>Healthy tab</div>}</RouteLoadingBoundary>
  );
  mockPathname = '/broken';
  const { container, root, done } = await mount(<Pages broken />);
  try {
    expect(container.textContent).toContain('This page could not load');
    mockPathname = '/healthy';
    await act(async () => root.render(<Pages />));
    expect(container.textContent).toContain('Healthy tab');
    expect(container.textContent).not.toContain('This page could not load');
  } finally { spy.mockRestore(); await done(); }
});
