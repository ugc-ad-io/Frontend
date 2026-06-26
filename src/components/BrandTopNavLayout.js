import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import { Bell, ChevronDown, Plus, Wallet, Package, Settings, LogOut, Search, UserRoundSearch } from 'lucide-react';
import '../styles/creator-marketplace.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const getInitial = (name) => (name || 'B').trim().charAt(0).toUpperCase();

const PRIMARY_LINKS = [
  { name: 'Overview', to: '/dashboard/business' },
  { name: 'Campaigns', to: '/dashboard/business/all-campaigns' },
  { name: 'Creators', to: '/dashboard/business/browse-creator' },
  { name: 'Work Review', to: '/dashboard/business/work-review' },
  { name: 'Messages', to: '/messages', dot: true },
];

const MENU_LINKS = [
  { name: 'Creator Bids', to: '/dashboard/business/pending-bids', icon: UserRoundSearch },
  { name: 'Manage Shipment', to: '/dashboard/business/shipments', icon: Package },
  { name: 'Wallet', to: '/dashboard/business/wallet', icon: Wallet },
  { sep: true },
  { name: 'Settings', to: '/settings', icon: Settings },
];

/**
 * Top-navigation marketplace shell for the brand side (replaces the sidebar
 * dashboard). Each nav link routes to its own page.
 */
export default function BrandTopNavLayout({ children, notifications = 0 }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const displayName = user?.profile?.business_name || user?.nickname || user?.full_name || (user?.username ? `@${user.username}` : user?.email) || 'Brand';
  const photo = user?.profile_photo || user?.brand_logo;
  const isActive = (to) => (to === '/dashboard/business' ? pathname === to : pathname === to || pathname.startsWith(`${to}/`));
  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <div className="cmk-app">
      <header className="cmk-nav">
        <div className="cmk-wrap cmk-nav-inner">
          <button type="button" className="cmk-brand" onClick={() => navigate('/dashboard/business')}>
            <span className="cmk-brand-mark">U</span> UGCad.io
          </button>

          <div className="cmk-nav-search" role="search">
            <Search size={18} />
            <input
              type="search"
              placeholder="Search campaigns, creators, briefs..."
              aria-label="Search"
              onKeyDown={(e) => { if (e.key === 'Enter') navigate('/dashboard/business/browse-creator'); }}
            />
          </div>

          <nav className="cmk-links" aria-label="Brand">
            {PRIMARY_LINKS.map((link) => (
              <button key={link.name} type="button" className={isActive(link.to) ? 'is-active' : ''} onClick={() => navigate(link.to)}>
                {link.name}
                {link.dot && <span className="cmk-link-dot" />}
              </button>
            ))}
          </nav>

          <div className="cmk-nav-right" ref={menuRef}>
            <button type="button" className="cmk-btn-primary-sm" onClick={() => navigate('/dashboard/business/post-brief')} style={{ height: 42 }}>
              <Plus size={17} /> Post a Campaign
            </button>
            <button type="button" className="cmk-icon-btn" aria-label="Notifications" onClick={() => navigate('/messages')}>
              <Bell size={20} />
              {notifications > 0 && <i className="cmk-badge">{notifications > 9 ? '9+' : notifications}</i>}
            </button>

            <button type="button" className="cmk-avatar-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="Account menu">
              <span className="cmk-avatar">
                {photo ? <img src={photo.startsWith('http') ? photo : `${BACKEND_URL}${photo}`} alt={displayName} /> : getInitial(displayName)}
              </span>
              <span className="cmk-avatar-id">
                <strong>{displayName}</strong>
                <small>Brand Account</small>
              </span>
              <ChevronDown size={16} color="#9296ba" />
            </button>

            {menuOpen && (
              <div className="cmk-menu">
                {MENU_LINKS.map((item, i) => (
                  item.sep
                    ? <div key={`sep-${i}`} className="cmk-sep" />
                    : (
                      <button key={item.name} type="button" onClick={() => { setMenuOpen(false); navigate(item.to); }}>
                        <item.icon size={18} /> {item.name}
                      </button>
                    )
                ))}
                <button type="button" onClick={handleLogout}><LogOut size={18} /> Log out</button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="cmk-wrap cmk-page">
        {children}
      </main>
    </div>
  );
}
