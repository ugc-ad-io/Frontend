import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import AdminSidebar from './AdminSidebar';
import AdminTopbar from './AdminTopbar';

function AdminLayout({ children }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const currentPath = window.location.pathname;
  const pathToTab = {
    '/dashboard/admin/applications':  'applications',
    '/dashboard/admin/campaigns':     'briefs',
    '/dashboard/admin/my-creators':   'assigned',
    '/dashboard/admin/deals':         'deals',
    '/dashboard/admin/disputes':      'disputes',
    '/dashboard/admin/shipping':      'shipping',
    '/dashboard/admin/users':         'users',
    '/dashboard/admin/financials':    'financials',
    '/dashboard/admin/chat-oversight':'chat',
    '/dashboard/admin/reports':       'reports',
    '/dashboard/admin/audit-log':     'audit',
    '/dashboard/admin/settings':      'settings',
    '/dashboard/admin/roles':         'roles',
  };

  const activeTab = pathToTab[currentPath] || 'stats';

  const handleTabClick = (tab) => {
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
      <AdminSidebar activeTab={activeTab} onTabClick={handleTabClick} user={user} />

      <main className="admin-main">
        <AdminTopbar />

        <div className="dashboard-content">
          {(() => {
            const titles = {
              applications: ['Applications',   'Creator, brand applications and profile approvals'],
              briefs:       ['Briefs',         'Review and approve new brand briefs before they go live'],
              assigned:     ['My Users',       'Creators & brands in the categories assigned to you'],
              deals:        ['Deals',          'All active and past deals on the platform'],
              disputes:     ['Disputes',       'Review evidence and rule on creator/brand disputes'],
              shipping:     ['Shipping Queue', 'Manual label requests — target SLA 4 hours'],
              users:        ['Users',          'Search, edit, warn, suspend or ban users'],
              financials:   ['Financials',     'Wallets, escrow, payouts and withdrawals'],
              chat:         ['Chat Oversight', 'Flagged messages and contact-info filter log'],
              reports:      ['Reports',        'Exports, metrics and platform summaries'],
              audit:        ['Audit Log',      'Immutable record of every admin action — retained 7 years'],
              settings:     ['Settings',       'Platform config — founder access only'],
              roles:        ['Team & Roles',   'Admin role structure and staff access — founder manages'],
            };
            const [title, subtitle] = titles[activeTab] || ['Admin Dashboard', 'Manage the platform'];
            return (
              <div className="page-head">
                <div>
                  <h1>{title}</h1>
                  <p>{subtitle}</p>
                </div>
              </div>
            );
          })()}
          <div className="tab-content">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

export default AdminLayout;
