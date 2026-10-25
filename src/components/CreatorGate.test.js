import { act } from 'react';
import { createRoot } from 'react-dom/client';
import RejectedGate from './RejectedGate';
import MoreInfoGate from './MoreInfoGate';
import CreatorPendingGate from './CreatorPendingGate';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));

const render = async (el) => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(el); });
  return { host, done: async () => { await act(async () => root.unmount()); host.remove(); } };
};

beforeAll(() => { global.IS_REACT_ACT_ENVIRONMENT = true; });

test('creator pending gate shows the in-review state with the user email', async () => {
  const { host, done } = await render(<CreatorPendingGate user={{ email: 'a@b.co' }} onLogout={() => {}} />);
  expect(host.textContent).toContain('We’re checking your profile');
  expect(host.textContent).toContain('a@b.co');
  expect(host.textContent).toContain('Log out');
  await done();
});

test('creator more-info gate lists each requested fix', async () => {
  const user = { review: { more_info_message: 'Please fix', more_info_items: ['Video 2 too dark', 'Name mismatch'] } };
  const { host, done } = await render(<MoreInfoGate user={user} kind="creator" onLogout={() => {}} />);
  expect(host.textContent).toContain('Needs 2 fixes');
  expect(host.textContent).toContain('Video 2 too dark');
  expect(host.textContent).toContain('Fix and send again');
  await done();
});

test('creator rejected gate shows the reason and keeps the log out button', async () => {
  const user = { review: { reason_code: 'low_quality_portfolio', reason_details: 'Too short' } };
  const { host, done } = await render(<RejectedGate user={user} kind="creator" onHome={() => {}} />);
  expect(host.textContent).toContain('We couldn’t approve your profile yet');
  expect(host.textContent).toContain('Too short');
  expect(host.querySelector('[data-testid="home-btn"]')).not.toBeNull();
  await done();
});
