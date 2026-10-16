import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import AdminSidebar, { AdminMobileNav } from './AdminSidebar';
import AdminHomePhone from './AdminHomePhone';

let mockPath = '/';
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: mockPath }),
  useNavigate: () => mockNavigate,
  NavLink: ({ to, className, children, end, ...rest }) => <a href={to} className={className} {...rest}>{children}</a>,
}));
const mockLogout = jest.fn();
const founder = { id: 'a1', role: 'admin', admin_role: 'founder', nickname: 'Admin Master' };
jest.mock('../App', () => ({ useAuth: () => ({ user: founder, logout: mockLogout }) }));
jest.mock('../lib/useIsPhone', () => () => true);

async function render(ui, path = '/dashboard/admin') {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  mockPath = path;
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(ui));
  return { container, done: async () => { await act(async () => root.unmount()); container.remove(); } };
}

test('bottom bar marks the section the admin is in', async () => {
  const active = async (path) => {
    const { container, done } = await render(<AdminMobileNav />, path);
    const label = container.querySelector('.is-active')?.textContent;
    await done();
    return label;
  };
  expect(await active('/dashboard/admin')).toBe('Home');
  expect(await active('/dashboard/admin/kyc')).toBe('Reviews');
  expect(await active('/dashboard/admin/campaigns')).toBe('Reviews');
  expect(await active('/dashboard/admin/deals')).toBe('Deals');
  expect(await active('/dashboard/admin/audit-log')).toBe('More');
});

test('More opens the existing module menu full screen, reaches every module and signs out', async () => {
  const onTabClick = jest.fn();
  const { container, done } = await render(<AdminSidebar activeTab="stats" onTabClick={onTabClick} user={founder} />);
  expect(container.querySelector('.admin-more')).toBeNull();
  const more = [...container.querySelectorAll('.admin-mobile-nav-item')].find((el) => el.textContent === 'More');
  await act(async () => more.click());
  const menu = container.querySelector('.admin-more');
  ['Users', 'Creator KYC', 'Brand GST', 'Briefs', 'Disputes', 'Shipping Queue', 'Editing Queue', 'Financials', 'Reports',
    'Chat Oversight', 'Audit Log', 'Team & Roles', 'Home Showcase', 'Notifications', 'Settings', 'Sign out']
    .forEach((label) => expect(menu.textContent).toContain(label));
  await act(async () => menu.querySelector('[data-testid="more-tab-audit"]').click());
  expect(onTabClick).toHaveBeenCalledWith(expect.objectContaining({ id: 'audit' }));
  expect(container.querySelector('.admin-more')).toBeNull(); // closes after choosing
  await act(async () => more.click());
  await act(async () => container.querySelector('[data-testid="more-logout"]').click());
  expect(mockLogout).toHaveBeenCalled();
  await done();
});

test('phone Home shows overview tiles, the queues that need attention and opens them', async () => {
  const stats = { pending_shipments: 14, pending_kyc: 5, pending_gst: 1, active_campaigns: 22 };
  const { container, done } = await render(
    <AdminHomePhone user={founder} stats={stats} analytics={{ platform_commission: 0, active_campaigns: 22 }}
      pendingProfiles={6} pendingCampaigns={2} pendingWithdrawals={0} />);
  const text = container.textContent;
  ['Overview', 'Pending profiles', 'Campaigns', 'Shipments', 'KYC', 'Needs attention', 'Applications', 'Brief approvals',
    'KYC verification', 'GST verification', 'Shipment queue', 'Active campaigns', 'Platform earnings', '₹0']
    .forEach((label) => expect(text).toContain(label));
  expect(container.querySelector('[aria-label="14 pending"]')).not.toBeNull();
  expect(container.querySelector('[aria-label="0 pending"]')).toBeNull(); // nothing waiting = no count
  expect(text).toContain('28 waiting');
  const shipments = [...container.querySelectorAll('button.am-tile')].find((el) => el.textContent.includes('Shipments'));
  await act(async () => shipments.click());
  expect(mockNavigate).toHaveBeenCalledWith('/dashboard/admin/shipping');
  await done();
});
