import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import AdminSidebar from './AdminSidebar';

function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const currentPath = window.location.pathname;
  const pathToTab = {
    '/dashboard/admin/applications': 'applications',
    '/dashboard/admin/profiles': 'profiles',
    '/dashboard/admin/campaigns': 'campaigns',
    '/dashboard/admin/gig-management': 'gigs',
    '/dashboard/admin/withdrawals': 'withdrawals',
    '/dashboard/admin/all-campaigns': 'allcampaigns',
    '/dashboard/admin/users': 'users',
    '/dashboard/admin/assignments': 'assignments',
    '/dashboard/admin/flagged': 'flagged',
    '/dashboard/admin/analytics': 'analytics',
  };

  const activeTab = pathToTab[currentPath] || 'stats';

  const handleTabClick = (tab) => {
    if (tab.id === 'applications') {
      navigate('/dashboard/admin/applications');
    } else if (tab.id === 'gigs') {
      navigate('/dashboard/admin/gig-management');
    } else if (tab.id === 'stats') {
      navigate('/dashboard/admin');
    } else if (tab.id === 'allcampaigns') {
      navigate('/dashboard/admin/all-campaigns');
    } else {
      navigate(`/dashboard/admin/${tab.slug}`);
    }
  };

  return (
    <div className="admin-dashboard">
      <AdminSidebar activeTab={activeTab} onTabClick={handleTabClick} user={user} />

      <main className="admin-main">
        <div className="dashboard-header">
          <div className="header-content">
            <div>
              {(() => {
                const titles = {
                  applications: ['Applications Management', 'Manage creator and brand applications'],
                  profiles: ['Profile Approvals', 'Review and approve newly submitted profiles'],
                  campaigns: ['Campaign Approvals', 'Review and approve brand campaigns'],
                  gigs: ['Gig Management', 'Review and approve creator gigs'],
                  withdrawals: ['Withdrawal Requests', 'Review pending withdrawals'],
                  allcampaigns: ['All Campaigns', 'View every campaign on the platform'],
                  users: ['User Management', 'Search, edit, and ban users'],
                  assignments: ['Campaign Assignments', 'Assign campaigns to managers'],
                  flagged: ['Flagged Messages', 'Review reported chat messages'],
                  analytics: ['Platform Analytics', 'Revenue, growth, and performance metrics'],
                };
                const [title, subtitle] = titles[activeTab] || ['Admin Dashboard', `Welcome, ${user?.nickname || ''} - ${user?.role || ''}`];
                return (<>
                  <h1>{title}</h1>
                  <p>{subtitle}</p>
                </>);
              })()}
            </div>
            <button className="btn-secondary" onClick={handleLogout}>
              <LogOut size={20} /> Logout
            </button>
          </div>
        </div>

        <div className="dashboard-content">
          <div className="tab-content">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

export default AdminLayout;
