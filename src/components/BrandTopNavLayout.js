import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import { ChevronDown, Plus, Wallet, Package, Settings, LogOut, Search, UserRoundSearch, X, Menu, Users, Megaphone, ClipboardCheck, MessageSquare } from 'lucide-react';
import NotificationBell from './NotificationBell';
import HoverSideRail from './HoverSideRail';
import PostABrief from '../pages/PostABrief';
import '../styles/creator-marketplace.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const getInitial = (name) => (name || 'B').trim().charAt(0).toUpperCase();

const PRIMARY_LINKS = [
  { name: 'Creators', to: '/dashboard/business/browse-creator', icon: Users },
  { name: 'Campaigns', to: '/dashboard/business/all-campaigns', icon: Megaphone },
  { name: 'Work Review', to: '/dashboard/business/work-review', icon: ClipboardCheck },
  { name: 'Messages', to: '/messages', dot: true, icon: MessageSquare },
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const close = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  // Lock background page scroll while the Post-a-Campaign modal is open so only
  // the modal's own scrollbar shows. `html` has an always-on `overflow-y: scroll`
  // (reserved gutter), so we must hide the documentElement's track too — locking
  // `body` alone leaves that second scrollbar visible.
  useEffect(() => {
    if (!briefOpen) return undefined;
    const html = document.documentElement;
    const prevHtml = html.style.overflow;
    const prevBody = document.body.style.overflow;
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => { html.style.overflow = prevHtml; document.body.style.overflow = prevBody; };
  }, [briefOpen]);

  const displayName = user?.profile?.business_name || user?.nickname || user?.full_name || (user?.username ? `@${user.username}` : user?.email) || 'Brand';
  const photo = user?.profile_photo || user?.brand_logo;
  const isActive = (to) => (to === '/dashboard/business' ? pathname === to : pathname === to || pathname.startsWith(`${to}/`));
  const handleLogout = () => { logout(); navigate('/'); };

  return (
    <div className="cmk-app has-rail">
      <HoverSideRail
        brandMark="U"
        onLogoClick={() => navigate('/dashboard/business/browse-creator')}
        primary={PRIMARY_LINKS}
        secondary={MENU_LINKS.filter((i) => !i.sep)}
        isActive={isActive}
        onNavigate={navigate}
        onLogout={handleLogout}
      />
      <header className="cmk-nav">
        <div className="cmk-wrap cmk-nav-inner">
          <button type="button" className="cmk-brand" onClick={() => navigate('/dashboard/business/browse-creator')} aria-label="Go to Creators">
            <img src="/ugcad-logo.png" alt="UGCad.io" className="cmk-brand-logo" />
          </button>

          <div className="cmk-nav-search" role="search">
            <Search size={18} />
            <input
              type="search"
              placeholder="Search creators by name, niche..."
              aria-label="Search creators"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = e.target.value.trim();
                  navigate(`/dashboard/business/browse-creator${v ? `?q=${encodeURIComponent(v)}` : ''}`);
                }
              }}
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
            <NotificationBell />

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

      <button
        type="button"
        className="cmk-btn-primary-sm cmk-post-fab"
        onClick={() => setBriefOpen(true)}
      >
        <Plus size={18} /> Post a Campaign
      </button>

      {briefOpen && (
        <div className="cmk-brief-overlay" onClick={() => setBriefOpen(false)}>
          <div className="cmk-brief-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="cmk-brief-close"
              aria-label="Close"
              onClick={() => setBriefOpen(false)}
            >
              <X size={20} />
            </button>
            <PostABrief
              onClose={() => setBriefOpen(false)}
              onPublished={() => setBriefOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
