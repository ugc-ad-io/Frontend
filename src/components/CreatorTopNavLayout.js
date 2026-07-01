import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import {
  ChevronDown, Star, User, Wallet, Settings, LogOut, Search, Menu, X,
  Zap, Compass, FileText, MessageSquare
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import HoverSideRail from './HoverSideRail';
import '../styles/creator-marketplace.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const getInitial = (name) => (name || 'U').trim().charAt(0).toUpperCase();

// Primary links live in the top bar; account/secondary links live in the avatar menu.
const PRIMARY_LINKS = [
  { name: 'Active Work', to: '/my-active-work', icon: Zap },
  { name: 'Browse Campaigns', to: '/browse-briefs', icon: Compass },
  { name: 'My Bids', to: '/my-bids', icon: FileText },
  { name: 'Messages', to: '/messages', dot: true, icon: MessageSquare }
];

const MENU_LINKS = [
  { name: 'Reviews', to: '/reviews', icon: Star },
  { name: 'Profile', to: '/profile', icon: User },
  { name: 'Earnings', to: '/withdrawal', icon: Wallet },
  { sep: true },
  { name: 'Settings', to: '/settings', icon: Settings }
];

/**
 * Top-navigation marketplace shell for the creator side (replaces the sidebar
 * DashboardLayout). Renders the sticky nav + avatar menu and wraps page content
 * full-width. Pass `notifications` to show a bell badge.
 */
export default function CreatorTopNavLayout({ children, notifications = 0 }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const menuRef = useRef(null);

  const runSearch = () => {
    const q = searchTerm.trim();
    navigate(q ? `/browse-briefs?q=${encodeURIComponent(q)}` : '/browse-briefs');
  };

  useEffect(() => {
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const displayName = user?.nickname || user?.full_name || (user?.username ? `@${user.username}` : user?.email) || 'Creator';
  const photo = user?.profile_photo || user?.profile_picture || user?.avatar;
  const isActive = (to) => pathname === to || pathname.startsWith(`${to}/`);

  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <div className="cmk-app has-rail">
      <HoverSideRail
        brandMark="U"
        onLogoClick={() => navigate('/dashboard/creator')}
        primary={PRIMARY_LINKS}
        secondary={MENU_LINKS.filter((i) => !i.sep)}
        isActive={isActive}
        onNavigate={navigate}
        onLogout={handleLogout}
      />
      <header className="cmk-nav">
        <div className="cmk-wrap cmk-nav-inner">
          <button type="button" className="cmk-brand" onClick={() => navigate('/dashboard/creator')} aria-label="Go to Dashboard">
            <img src="/ugcad-logo.png" alt="UGCad.io" className="cmk-brand-logo" />
          </button>

          <div className="cmk-nav-search" role="search">
            <button type="button" className="cmk-nav-search-btn" aria-label="Search" onClick={runSearch}>
              <Search size={18} />
            </button>
            <input
              type="search"
              placeholder="Search briefs, brands, categories..."
              aria-label="Search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
            />
          </div>

          <nav className="cmk-links" aria-label="Creator">
            {PRIMARY_LINKS.map((link) => (
              <button
                key={link.name}
                type="button"
                className={isActive(link.to) ? 'is-active' : ''}
                onClick={() => navigate(link.to)}
              >
                {link.name}
                {link.dot && <span className="cmk-link-dot" />}
              </button>
            ))}
          </nav>

          <div className="cmk-nav-right" ref={menuRef}>
            <NotificationBell />

            <button type="button" className="cmk-avatar-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="Account menu">
              <span className="cmk-avatar">
                {photo ? <img src={photo.startsWith('http') ? photo : `${BACKEND_URL}${photo}`} alt={displayName} /> : getInitial(displayName)}
              </span>
              <span className="cmk-avatar-id">
                <strong>{displayName}</strong>
                <small>Creator</small>
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
            <button type="button" className="cmk-hamburger" aria-label="Menu" onClick={() => setMobileOpen((v) => !v)}>
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <div className="cmk-mobile-menu">
            {PRIMARY_LINKS.map((link) => (
              <button key={link.name} type="button" className={isActive(link.to) ? 'is-active' : ''} onClick={() => { setMobileOpen(false); navigate(link.to); }}>
                {link.name}
              </button>
            ))}
            <div className="cmk-sep" />
            {MENU_LINKS.filter((i) => !i.sep).map((item) => (
              <button key={item.name} type="button" onClick={() => { setMobileOpen(false); navigate(item.to); }}>
                <item.icon size={18} /> {item.name}
              </button>
            ))}
            <button type="button" onClick={handleLogout}><LogOut size={18} /> Log out</button>
          </div>
        )}
      </header>

      <main className="cmk-wrap cmk-page">
        {children}
      </main>
    </div>
  );
}
