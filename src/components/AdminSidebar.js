import { TrendingUp, FileText, Users, Briefcase, IndianRupee, MessageSquare, BarChart, Scale, Package, Settings, ScrollText, ShieldCheck, UserCheck, ClipboardCheck, BadgeCheck, ReceiptText, Star, Clapperboard, Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Inbox, MoreHorizontal, ChevronRight, LogOut, X } from 'lucide-react';
import { useAuth } from '../App';
import { can, isFounder, ROLE_LABELS, normalizeRole } from '../utils/adminRoles';
import useIsPhone from '../lib/useIsPhone';

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

const REVIEW_PATHS = ['/dashboard/admin/applications', '/dashboard/admin/campaigns', '/dashboard/admin/kyc', '/dashboard/admin/profiles'];
const HOME_PATHS = ['/dashboard/admin', '/dashboard/admin/overview', '/dashboard/admin/stats'];

// Phone-only bottom bar: Home | Reviews | Deals | More. Desktop keeps the sidebar.
// More opens the same module menu as the desktop sidebar, full screen.
export function AdminMobileNav({ onMore, moreOpen = false }) {
  const { pathname } = useLocation();
  const path = pathname.replace(/\/$/, '');
  const links = [
    { to: '/dashboard/admin', label: 'Home', icon: Home, active: HOME_PATHS.includes(path) },
    { to: '/dashboard/admin/applications', label: 'Reviews', icon: Inbox, active: REVIEW_PATHS.includes(path) },
    { to: '/dashboard/admin/deals', label: 'Deals', icon: Briefcase, active: path.startsWith('/dashboard/admin/deals') },
  ];
  const onMain = links.some((link) => link.active);
  return (
    <nav className="admin-mobile-nav" aria-label="Admin">
      {links.map(({ to, label, icon: Icon, active }) => {
        const on = active && !moreOpen;
        return (
          <NavLink key={label} to={to} end className={`admin-mobile-nav-item${on ? ' is-active' : ''}`} aria-current={on ? 'page' : undefined}>
            <Icon size={22} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        );
      })}
      <button type="button" className={`admin-mobile-nav-item${moreOpen || !onMain ? ' is-active' : ''}`} onClick={onMore} aria-expanded={moreOpen}>
        <MoreHorizontal size={22} aria-hidden="true" />
        <span>More</span>
      </button>
    </nav>
  );
}

// "More" on phones: every module not on the bottom bar, grouped, plus the account and Sign out.
const MORE_GROUPS = [
  ['People', ['users', 'assigned', 'kyc', 'gst']],
  ['Operations', ['briefs', 'disputes', 'shipping', 'editing']],
  ['Management', ['financials', 'reports', 'chat', 'audit']],
  ['Platform', ['roles', 'showcase', 'notifications', 'settings']],
];

function AdminMoreMenu({ user, activeTab, onTabClick, onClose }) {
  const { logout } = useAuth();
  const byId = Object.fromEntries(visibleAdminTabs(user).map((tab) => [tab.id, tab]));
  const name = user?.nickname || user?.full_name || 'Admin';
  return (
    <div className="am am-detail admin-more" role="dialog" aria-modal="true" aria-label="More">
      <header className="am-detail-head">
        <h1 style={{ paddingLeft: 8 }}>More</h1>
        <button type="button" className="am-icon-btn" aria-label="Close" onClick={onClose}><X size={22} /></button>
      </header>
      <div className="am-detail-body" style={{ paddingBottom: 'calc(88px + env(safe-area-inset-bottom))' }}>
        <div className="am-section am-identity" style={{ flexDirection: 'row' }}>
          <span className="am-avatar" aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>
          <span className="am-card-main">
            <strong className="am-card-title">{name}</strong>
            <span className="am-card-sub">{ROLE_LABELS[normalizeRole(user?.admin_role)] || 'Administrator'}</span>
          </span>
        </div>
        {MORE_GROUPS.map(([title, ids]) => {
          const tabs = ids.map((id) => byId[id]).filter(Boolean);
          if (!tabs.length) return null;
          return (
            <section key={title} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h2 className="am-muted" style={{ margin: 0, fontWeight: 600 }}>{title}</h2>
              <ul className="am-rows">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <li key={tab.id}>
                      <button type="button" className="am-row" aria-current={activeTab === tab.id ? 'page' : undefined}
                        onClick={() => { onClose(); onTabClick(tab); }} data-testid={`more-${tab.testId}`}>
                        <Icon size={20} aria-hidden="true" />
                        <span className="am-row-label">{tab.label}</span>
                        <ChevronRight size={18} className="am-row-chevron" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        <ul className="am-rows">
          <li>
            <button type="button" className="am-row" style={{ color: 'var(--am-bad-fg)' }} onClick={logout} data-testid="more-logout">
              <LogOut size={20} aria-hidden="true" style={{ color: 'var(--am-bad-fg)' }} />
              <span className="am-row-label">Sign out</span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
}

function AdminSidebar({ activeTab, onTabClick, user, mobileOpen = false, onClose }) {
  const isPhone = useIsPhone();
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => { setMoreOpen(false); }, [pathname]);

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
    {isPhone && moreOpen && <AdminMoreMenu user={user} activeTab={activeTab} onTabClick={onTabClick} onClose={() => setMoreOpen(false)} />}
    <AdminMobileNav moreOpen={moreOpen} onMore={() => setMoreOpen((open) => !open)} />
    </>
  );
}

export default AdminSidebar;
