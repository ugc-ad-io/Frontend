import { TrendingUp, FileText, Users, Briefcase, IndianRupee, MessageSquare, BarChart, Scale, Package, Settings, ScrollText, ShieldCheck, UserCheck, ClipboardCheck } from 'lucide-react';
import { can, isFounder } from '../utils/adminRoles';

function AdminSidebar({ activeTab, onTabClick, user, mobileOpen = false, onClose }) {
  const adminTabs = [
    { id: 'stats',        label: 'Dashboard',      icon: TrendingUp,   testId: 'tab-stats',        slug: 'overview' },
    { id: 'applications', label: 'Applications',   icon: FileText,     testId: 'tab-applications', slug: 'applications', cap: 'review_applications' },
    { id: 'briefs',       label: 'Briefs',         icon: ClipboardCheck, testId: 'tab-briefs',     slug: 'campaigns',    cap: 'review_applications' },
    { id: 'assigned',     label: 'Users',          icon: UserCheck,    testId: 'tab-assigned',     slug: 'my-creators',  cap: 'my_users' },
    { id: 'users',        label: 'Users',          icon: Users,        testId: 'tab-users',        slug: 'users',        cap: 'user_management' },
    { id: 'deals',        label: 'Deals',          icon: Briefcase,    testId: 'tab-deals',        slug: 'deals',        cap: 'manage_deals' },
    { id: 'disputes',     label: 'Disputes',       icon: Scale,        testId: 'tab-disputes',     slug: 'disputes',     cap: 'rule_disputes' },
    { id: 'shipping',     label: 'Shipping Queue', icon: Package,      testId: 'tab-shipping',     slug: 'shipping',     cap: 'manage_shipping' },
    { id: 'financials',   label: 'Financials',     icon: IndianRupee,  testId: 'tab-financials',   slug: 'financials',   cap: 'view_financials' },
    { id: 'chat',         label: 'Chat Oversight', icon: MessageSquare,testId: 'tab-chat',         slug: 'chat-oversight', cap: 'content_moderation' },
    { id: 'reports',      label: 'Reports',        icon: BarChart,     testId: 'tab-reports',      slug: 'reports',      cap: 'generate_reports' },
    { id: 'audit',        label: 'Audit Log',      icon: ScrollText,   testId: 'tab-audit',        slug: 'audit-log',    cap: 'view_audit' },
    { id: 'roles',        label: 'Team & Roles',   icon: ShieldCheck,  testId: 'tab-roles',        slug: 'roles',        cap: 'manage_roles' },
    { id: 'settings',     label: 'Settings',       icon: Settings,     testId: 'tab-settings',     slug: 'settings',     cap: 'edit_settings' },
  ];

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
          {adminTabs
            .filter((tab) => !tab.cap || can(user, tab.cap))
            // "My Users" is for role-limited admins with assigned categories; a
            // founder already has the full "Users" tab, so hide it for founders.
            .filter((tab) => !(tab.id === 'assigned' && isFounder(user)))
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
        Internal — authorised staff only
      </div>
    </aside>
    </>
  );
}

export default AdminSidebar;
