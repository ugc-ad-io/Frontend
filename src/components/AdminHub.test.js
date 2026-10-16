import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import AdminHub from './AdminHub';
import { AdminMobileNav } from './AdminSidebar';

let mockPath = '/';
jest.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: mockPath }),
  useNavigate: () => jest.fn(),
  NavLink: ({ to, className, children, end, ...rest }) => <a href={to} className={className} {...rest}>{children}</a>,
}));
const mockLogout = jest.fn();
let mockUser = { id: 'a1', role: 'admin', admin_role: 'founder', nickname: 'Admin Master' };
jest.mock('../App', () => ({ useAuth: () => ({ user: mockUser, logout: mockLogout }) }));
jest.mock('../lib/useAdminStats', () => () => ({ stats: { pending_profiles: 6, pending_kyc: 5, pending_gst: 1, pending_shipments: 14, pending_campaigns: 0 } }));

async function render(ui, path = '/dashboard/admin/more') {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  mockPath = path;
  await act(async () => root.render(ui));
  return { container, done: async () => { await act(async () => root.unmount()); container.remove(); } };
}

test('Reviews hub lists the approval queues with their real pending counts', async () => {
  const { container, done } = await render(<AdminHub kind="reviews" />, '/dashboard/admin/reviews');
  const text = container.textContent;
  ['Applications', 'Brief approvals', 'KYC verification', 'GST verification'].forEach((label) => expect(text).toContain(label));
  expect(container.querySelector('[aria-label="6 pending"]')).not.toBeNull();
  expect(container.querySelector('[aria-label="0 pending"]')).toBeNull(); // zero counts are not shown
  await done();
});

test('More hub reaches every module and signs out', async () => {
  const { container, done } = await render(<AdminHub kind="more" />);
  ['Users', 'Creator KYC', 'Brand GST', 'Briefs', 'Disputes', 'Shipping Queue', 'Editing Queue', 'Financials', 'Reports',
    'Chat Oversight', 'Audit Log', 'Team & Roles', 'Home Showcase', 'Notifications', 'Settings', 'Sign out']
    .forEach((label) => expect(container.textContent).toContain(label));
  await act(async () => container.querySelector('[data-testid="admin-more-logout"]').click());
  expect(mockLogout).toHaveBeenCalled();
  await done();
});

test('bottom bar marks the section the admin is in', async () => {
  const active = async (path) => {
    const { container, done } = await render(<AdminMobileNav />, path);
    const label = container.querySelector('.is-active')?.textContent;
    await done();
    return label;
  };
  expect(await active('/dashboard/admin')).toBe('Home');
  expect(await active('/dashboard/admin/kyc')).toBe('Reviews');
  expect(await active('/dashboard/admin/deals')).toBe('Deals');
  expect(await active('/dashboard/admin/audit-log')).toBe('More');
});
