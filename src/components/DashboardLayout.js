import { useAuth } from '../App';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import axios from 'axios';
import { Bell, ChevronDown, LogOut, Search } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const getInitial = (name) => (name || 'U').trim().charAt(0).toUpperCase();

export default function DashboardLayout({
  navItems,
  title,
  description,
  children,
  topbarExtra,
  sidebarExtra
}) {
  const { user, setUser, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.id) {
      axios.get(`${API}/auth/me`)
        .then(res => setUser(res.data))
        .catch(() => {});
    }
  }, []);

  const displayName = user?.nickname || user?.full_name || user?.email || 'Creator';

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="pcd-shell">
      <aside className="pcd-sidebar">
        <div>
          <div className="pcd-brand">
            <div className="pcd-brand-mark">U</div>
            <span>UGCad.io</span>
          </div>
          <nav className="pcd-nav" aria-label="Creator dashboard">
            <span className="pcd-nav-label">Menu</span>
            {navItems.map((item) => (
              <button
                key={item.name}
                type="button"
                className={`pcd-nav-item ${item.active ? 'is-active' : ''}`}
                onClick={item.action}
              >
                <item.icon size={20} />
                {item.name}
              </button>
            ))}
          </nav>
        </div>
        <div className="pcd-sidebar-profile">
          <div className="pcd-avatar">
            {user?.profile_photo ? (
              <img src={`${BACKEND_URL}${user.profile_photo}`} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            ) : (
              getInitial(displayName)
            )}
          </div>
          <div>
            <strong>{displayName}</strong>
            <span>Top Creator</span>
          </div>
        </div>
        {sidebarExtra}
      </aside>

      <div className="pcd-main">
        <header className="pcd-topbar">
          <div>
            <h1>{title}</h1>
            {description && <p>{description}</p>}
          </div>
          <div className="pcd-top-actions">
            <button type="button" className="pcd-icon-btn" aria-label="Search">
              <Search size={18} />
            </button>
            <div className="pcd-role-switch">
              <button type="button" className="is-active">Creator</button>
              <button type="button" onClick={() => navigate('/dashboard/business')}>Brand</button>
            </div>
            <button type="button" className="pcd-icon-btn pcd-bell" aria-label="Notifications">
              <Bell size={18} />
              <span />
            </button>
            <button type="button" className="pcd-profile-chip" onClick={() => navigate('/settings')}>
              <span className="pcd-avatar small">
                {user?.profile_photo ? (
                  <img src={`${BACKEND_URL}${user.profile_photo}`} alt={displayName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                ) : (
                  <span title={user?.profile_photo || 'no photo'}>{getInitial(displayName)}</span>
                )}
              </span>
              <ChevronDown size={16} />
            </button>
            <button type="button" className="pcd-logout" onClick={handleLogout}>
              <LogOut size={18} />
              Logout
            </button>
            {topbarExtra}
          </div>
        </header>

        <main className="pcd-content">
          {children}
        </main>
      </div>
    </div>
  );
}
