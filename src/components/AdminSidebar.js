import { TrendingUp, FileText, Users, Briefcase, IndianRupee, MessageSquare, BarChart, Scale, Package, Settings, ScrollText, ShieldCheck, UserCheck, ClipboardCheck, BadgeCheck, ReceiptText, Star, Clapperboard, Bell } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Inbox, MoreHorizontal } from 'lucide-react';
import { can, isFounder } from '../utils/adminRoles';

export const ADMIN_TABS = [
  { id: 'stats',        label: 'Dashboard',      icon: TrendingUp,   testId: 'tab-stats',        slug: 'overview' },
  { id: 'applications', label: 'Applications',   icon: FileText,     testId: 'tab-applications', slug: 'applications', cap: 'review_applications' },
  { id: 'briefs',       label: 'Briefs',         icon: ClipboardCheck, testId: 'tab-briefs',     slug: 'campaigns',    cap: 'manage_briefs' },
  { id: 'assigned',     label: 'Users',          icon: UserCheck,    testId: 'tab-assigned',     slug: 'my-creators',  cap: 'my_users' },
  { id: 'users',        label: 'Users',          icon: Users,        testId: 'tab-users',        slug: 'users',        cap: 'user_management' },
  { id: 'kyc',          label: 'Creator KYC',    icon: BadgeCheck,   testId: 'tab-kyc',          slug: 'kyc',          cap: 'manage_kyc' },
  { id: 'gst',          label: 'Brand GST',      icon: ReceiptText,  testId: 'tab-gst',          slug: 'gst',          cap: 'manage_gst' },
  { id: 'deals',        label: 'Deals',          icon: Briefcase,    testId: 'tab-deals',        slug: 'deals',        cap: 'manage_deals' },
  { id: 'disputes',     label: 'Disputes',       icon: Scale,        testId: 'tab-disputes',     slug: 'disputes',     cap: 'rule_disputes' },
  { id: 'shipping',     label: 'Shipping Queue', icon: Package,      testId: 'tab-shipping',     slug: 'shipping',     cap: 'manage_shipping' },
  { id: 'editing',      label: 'Editing Queue',  icon: Clapperboard, testId: 'tab-editing',      slug: 'editing',      cap: 'manage_deals' },
  { id: 'financials',   label: 'Financials',     icon: IndianRupee,  testId: 'tab-financials',   slug: 'financials',   cap: 'view_financials' },
  { id: 'chat',         label: 'Chat Oversight', icon: MessageSquare,testId: 'tab-chat',         slug: 'chat-oversight', cap: 'content_moderation' },
  { id: 'reports',      label: 'Reports',        icon: BarChart,     testId: 'tab-reports',      slug: 'reports',      cap: 'generate_reports' },
  { id: 'audit',        label: 'Audit Log',      icon: ScrollText,   testId: 'tab-audit',        slug: 'audit-log',    cap: 'view_audit' },
  { id: 'roles',        label: 'Team & Roles',   icon: ShieldCheck,  testId: 'tab-roles',        slug: 'roles',        cap: 'manage_roles' },
  { id: 'showcase',     label: 'Home Showcase',  icon: Star,         testId: 'tab-showcase',     slug: 'home-showcase', cap: 'edit_settings' },
  { id: 'notifications', label: 'Notifications', icon: Bell,    testId: 'tab-notifications', slug: 'notification-templates', cap: 'edit_settings' },
  { id: 'settings',     label: 'Settings',       icon: Settings,     testId: 'tab-settings',     slug: 'settings',     cap: 'edit_settings' },
];

// The modules this admin may open (same rules as the sidebar).
export const visibleAdminTabs = (user) => ADMIN_TABS
  .filter((tab) => !tab.cap || can(user, tab.cap))
  // "My Users" is for role-limited admins with assigned categories; a
  // founder already has the full "Users" tab, so hide it for founders.
  .filter((tab) => !(tab.id === 'assigned' && isFounder(user)));

const REVIEW_PATHS = ['/dashboard/admin/reviews', '/dashboard/admin/applications', '/dashboard/admin/campaigns', '/dashboard/admin/kyc', '/dashboard/admin/gst'];
const HOME_PATHS = ['/dashboard/admin', '/dashboard/admin/overview', '/dashboard/admin/stats'];

// Phone-only bottom bar: Home | Reviews | Deals | More. Desktop keeps the sidebar.
export function AdminMobileNav() {
  const { pathname } = useLocation();
  const items = [
    { to: '/dashboard/admin', label: 'Home', icon: Home, match: (p) => HOME_PATHS.includes(p) },
    { to: '/dashboard/admin/reviews', label: 'Reviews', icon: Inbox, match: (p) => REVIEW_PATHS.includes(p) },
    { to: '/dashboard/admin/deals', label: 'Deals', icon: Briefcase, match: (p) => p.startsWith('/dashboard/admin/deals') },
    { to: '/dashboard/admin/more', label: 'More', icon: MoreHorizontal, match: () => false },
  ];
  const path = pathname.replace(/\/$/, '');
  const anyMain = items.slice(0, 3).some((item) => item.match(path));
  return (
    <nav className="admin-mobile-nav" aria-label="Admin">
      {items.map(({ to, label, icon: Icon, match }) => {
        const active = label === 'More' ? !anyMain : match(path);
        return (
          <NavLink key={label} to={to} end className={`admin-mobile-nav-item${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>
            <Icon size={22} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

function AdminSidebar({ activeTab, onTabClick, user, mobileOpen = false, onClose }) {

  return (
    <>
    <div className={`admin-nav-backdrop ${mobileOpen ? 'is-open' : ''}`} onClick={onClose} />
    <aside className={`admin-sidebar ${mobileOpen ? 'is-open' : ''}`}>
      <div>
        <div className="admin-sidebar-brand">
          <div className="admin-sidebar-mark">A</div>
          <span>UGCad.io</span>
          <span className="admin-sidebar-pill">Admin</span>
        </div>
        <nav className="admin-sidebar-nav" aria-label="Admin dashboard">
          <span className="admin-nav-label">Admin</span>
          {visibleAdminTabs(user)
            .map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                className={`admin-nav-item ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => onTabClick(tab)}
                data-testid={tab.testId}
              >
                <Icon size={20} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
      <div className="admin-sidebar-note">
        UGCad.io Admin Console
        <br />
        Internal - authorised staff only
      </div>
    </aside>
    <AdminMobileNav />
    </>
  );
}

export default AdminSidebar;
