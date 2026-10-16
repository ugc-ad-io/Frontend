import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import AdminSidebar from './AdminSidebar';
import AdminTopbar from './AdminTopbar';
import useIsPhone from '../lib/useIsPhone';
import { can } from '../utils/adminRoles';

// Phone: the review queues share one "Reviews" destination with these tabs.
const REVIEW_TABS = [
  { tab: 'applications', label: 'Applications', to: '/dashboard/admin/applications', cap: 'review_applications' },
  { tab: 'briefs', label: 'Briefs', to: '/dashboard/admin/campaigns', cap: 'manage_briefs' },
  { tab: 'kyc', label: 'KYC', to: '/dashboard/admin/kyc', cap: 'manage_kyc' },
];

function AdminLayout({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  const isPhone = useIsPhone();

  const currentPath = window.location.pathname;
  const pathToTab = {
    '/dashboard/admin/applications':  'applications',
    '/dashboard/admin/campaigns':     'briefs',
    '/dashboard/admin/my-creators':   'assigned',
    '/dashboard/admin/deals':         'deals',
    '/dashboard/admin/disputes':      'disputes',
    '/dashboard/admin/shipping':      'shipping',
    '/dashboard/admin/editing':       'editing',
    '/dashboard/admin/users':         'users',
    '/dashboard/admin/kyc':           'kyc',
    '/dashboard/admin/home-showcase': 'showcase',
    '/dashboard/admin/gst':           'gst',
    '/dashboard/admin/financials':    'financials',
    '/dashboard/admin/chat-oversight':'chat',
    '/dashboard/admin/reports':       'reports',
    '/dashboard/admin/audit-log':     'audit',
    '/dashboard/admin/settings':      'settings',
    '/dashboard/admin/notification-templates': 'notifications',
    '/dashboard/admin/roles':         'roles',
  };

  const activeTab = pathToTab[currentPath] || 'stats';

  const titles = {
    applications: ['Applications',   'Creator, brand applications and profile approvals'],
    briefs:       ['Briefs',         'Review and approve new brand briefs before they go live'],
    assigned:     ['My Users',       'Creators & brands in the categories assigned to you'],
    deals:        ['Deals',          'All active and past deals on the platform'],
    disputes:     ['Disputes',       'Review evidence and rule on creator/brand disputes'],
    shipping:     ['Shipping Queue', 'Manual label requests - target SLA 4 hours'],
    editing:      ['Editing Queue',  'Raw footage from "Edited by UGC.ad" deals - attach the final cut'],
    users:        ['Users',          'Search, edit, warn, suspend or ban users'],
    kyc:          ['Creator KYC',    'Verify Aadhaar + PAN - a creator cannot withdraw until this passes'],
    showcase:     ['Home Showcase',  'Curate the "Top Earner" cards shown on the creator home hero'],
    gst:          ['Brand GST',      'Review and verify brand GST / business details'],
    financials:   ['Financials',     'Wallets, escrow, payouts and withdrawals'],
    chat:         ['Chat Oversight', 'Flagged messages and contact-info filter log'],
    reports:      ['Reports',        'Exports, metrics and platform summaries'],
    audit:        ['Audit Log',      'Immutable record of every admin action - retained 7 years'],
    notifications: ['Notifications', 'Edit the wording of every automatic notification and email'],
    settings:     ['Settings',       'Platform config - founder access only'],
    roles:        ['Team & Roles',   'Admin role structure and staff access - founder manages'],
  };
  const [title, subtitle] = titles[activeTab] || ['Admin Dashboard', 'Manage the platform'];
  const phoneTitle = REVIEW_TABS.some((r) => r.tab === activeTab) ? 'Reviews' : title;

  const handleTabClick = (tab) => {
    setNavOpen(false);
    if (tab.id === 'applications') {
      navigate('/dashboard/admin/applications');
    } else if (tab.id === 'stats') {
      navigate('/dashboard/admin');
    } else {
      navigate(`/dashboard/admin/${tab.slug}`);
    }
  };

  return (
    <div className="admin-dashboard">
      <AdminSidebar activeTab={activeTab} onTabClick={handleTabClick} user={user} mobileOpen={navOpen} onClose={() => setNavOpen(false)} />

      <main className="admin-main">
        <AdminTopbar onMenuToggle={() => setNavOpen((v) => !v)} showDashboardBack title={phoneTitle} />

        <div className="dashboard-content">
          <div className="page-head">
            <div>
              <h1>{title}</h1>
              <p>{subtitle}</p>
            </div>
          </div>
          {isPhone && REVIEW_TABS.some((r) => r.tab === activeTab) && (
            <nav className="am-segmented admin-review-tabs" aria-label="Review queues">
              {REVIEW_TABS.filter((r) => can(user, r.cap)).map((r) => (
                <NavLink key={r.tab} to={r.to} className={activeTab === r.tab ? 'is-active' : ''} aria-current={activeTab === r.tab ? 'page' : undefined}>{r.label}</NavLink>
              ))}
            </nav>
          )}
          <div className="tab-content">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

export default AdminLayout;
