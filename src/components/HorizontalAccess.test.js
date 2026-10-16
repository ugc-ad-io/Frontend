import { act } from 'react';
import { createRoot } from 'react-dom/client';
import HorizontalAccess from './HorizontalAccess';

jest.mock('react-router-dom', () => ({ useLocation: () => ({ pathname: '/dashboard/admin/users' }) }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

test('background scroll helper disappears for drawers and sidebars and returns on close', async () => {
  jest.useFakeTimers();
  const bounds = jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    top: 0, left: 0, bottom: 500, right: 800, width: 800, height: 500,
  });
  const table = document.createElement('div');
  table.style.overflowX = 'auto'; table.innerHTML = '<table><tbody /></table>';
  Object.defineProperties(table, { scrollWidth: { value: 1600 }, clientWidth: { value: 800 } });
  const host = document.createElement('div'); document.body.append(table, host);
  const root = createRoot(host);
  const flush = async () => {
    await act(async () => {});
    await act(async () => { jest.advanceTimersByTime(20); });
  };
  try {
    await act(async () => root.render(<HorizontalAccess />));
    expect(host.querySelector('.horizontal-access')).not.toBeNull();
    for (const className of ['aud-overlay', 'pm-overlay', 'admin-sidebar is-open']) {
      const panel = document.createElement('div'); panel.className = className;
      panel.style.cssText = 'position:fixed;opacity:1';
      document.body.append(panel); await flush();
      expect(host.querySelector('.horizontal-access')).toBeNull();
      panel.remove(); await flush();
      expect(host.querySelector('.horizontal-access')).not.toBeNull();
    }
  } finally {
    await act(async () => root.unmount()); table.remove(); host.remove();
    bounds.mockRestore(); jest.useRealTimers();
  }
});
