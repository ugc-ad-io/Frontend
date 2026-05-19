import { LogOut, TrendingUp, FileText, Users, Briefcase } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';

function AdminLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const adminTabs = [
    { id: 'stats', label: 'Admin Dashboard', icon: TrendingUp, slug: 'overview' },
    { id: 'applications', label: 'Applications', icon: FileText, slug: 'applications' },
    { id: 'profiles', label: 'Profiles', icon: Users, slug: 'profiles' },
    { id: 'campaigns', label: 'Campaigns', icon: Briefcase, slug: 'campaigns' },
  ];

  const currentPath = window.location.pathname;
  const isApplicationsPage = currentPath === '/dashboard/applications';

  const handleTabClick = (tab) => {
    if (tab.id === 'applications') {
      navigate('/dashboard/applications');
    } else if (tab.id === 'stats') {
      navigate('/dashboard/admin');
    } else {
      navigate(`/dashboard/admin/${tab.slug}`);
    }
  };

  return (
    <div className="admin-dashboard">
      <aside className="admin-sidebar">
        <div>
          <div className="admin-sidebar-brand">
            <div className="admin-sidebar-mark">A</div>
            <span>UGCad.io</span>
          </div>
          <nav className="admin-sidebar-nav">
            <span className="admin-nav-label">Admin</span>
            {adminTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive =
                (tab.id === 'applications' && isApplicationsPage) ||
                (tab.id !== 'applications' && !isApplicationsPage && tab.id === 'stats' && currentPath === '/dashboard/admin');

              return (
                <button
                  key={tab.id}
                  type="button"
                  className={`admin-nav-item ${isActive ? 'active' : ''}`}
                  onClick={() => handleTabClick(tab)}
                >
                  <Icon size={20} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
        <div className="admin-sidebar-profile">
          <div className="admin-avatar">
            {(user?.nickname || user?.full_name || 'A').trim().charAt(0).toUpperCase()}
          </div>
          <div>
            <strong>{user?.nickname || 'Admin'}</strong>
            <span>{user?.role}</span>
          </div>
        </div>
      </aside>

      <main className="admin-main">
        <div className="dashboard-header">
          <div className="header-content">
            <div>
              {isApplicationsPage ? (
                <>
                  <h1>Applications Management</h1>
                  <p>Manage creator and brand applications</p>
                </>
              ) : (
                <>
                  <h1>Admin Dashboard</h1>
                  <p>Welcome, {user?.nickname} - {user?.role}</p>
                </>
              )}
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
