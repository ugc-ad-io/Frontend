import React, { act, lazy, startTransition } from 'react';
import { createRoot } from 'react-dom/client';
import RouteLoadingBoundary from './RouteLoadingBoundary';
jest.mock('./Loader', () => ({ label }) => <div role="status">{label}</div>);
let mockPathname = '/overview';
jest.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: mockPathname }) }));

test('navigation replaces the previous page while the new admin page downloads', async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  let finishDownload;
  const Applications = lazy(() => new Promise(resolve => { finishDownload = resolve; }));
  function Pages({ applications = false }) {
    return <RouteLoadingBoundary>{applications ? <Applications /> : <div>Old overview</div>}</RouteLoadingBoundary>;
  }
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => root.render(<Pages />));
    expect(container.textContent).toContain('Old overview');
    mockPathname = '/applications';
    await act(async () => startTransition(() => root.render(<Pages applications />)));
    expect(container.textContent).not.toContain('Old overview');
    expect(container.textContent).toContain('Loading page...');
    await act(async () => finishDownload({ default: () => <div>Applications loaded</div> }));
    expect(container.textContent).toContain('Applications loaded');
  } finally { await act(async () => root.unmount()); container.remove(); }
});
