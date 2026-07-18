import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import {
  ChevronDown, Star, User, Wallet, Settings, LogOut, Search, Menu, X,
  Zap, Compass, FileText, MessageSquare, Bookmark, BadgeCheck
} from 'lucide-react';
import NotificationBell from './NotificationBell';
import HoverSideRail from './HoverSideRail';
import MessagesPopup from './MessagesPopup';
import { creatorFirstName } from '../utils/displayName';
import '../styles/creator-marketplace.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const getInitial = (name) => (name || 'U').trim().charAt(0).toUpperCase();

// Primary links live in the top bar; account/secondary links live in the avatar menu.
const PRIMARY_LINKS = [
  { name: 'Active Work', to: '/my-active-work', icon: Zap },
  { name: 'Browse Campaigns', to: '/browse-briefs', icon: Compass },
  { name: 'Saved', to: '/saved', icon: Bookmark },
  { name: 'My Deals', to: '/my-deals', icon: FileText },
  { name: 'Messages', to: '/messages', dot: true, icon: MessageSquare }
];

const MENU_LINKS = [
  { name: 'Reviews', to: '/reviews', icon: Star },
  { name: 'Earnings', to: '/withdrawal', icon: Wallet },
  // Withdrawals are gated on this, so it needs a way in that isn't only the
  // banner on the payouts page.
  { name: 'Verify KYC', to: '/kyc', icon: BadgeCheck },
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
  const { pathname, search } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [msgOpen, setMsgOpen] = useState(false);
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

  const displayName = creatorFirstName(user);
  const photo = user?.profile_photo || user?.profile_picture || user?.avatar;
  const isActive = (to) => pathname === to || pathname.startsWith(`${to}/`);

  // Pages that own the bottom-right corner with their own chat launcher — the
  // global FAB would land on top of it. `/my-deals` is the hub (a list, no chat)
  // UNLESS it's opened as the Deal Room detail (?campaign / ?deal), which renders
  // its own deal-scoped chat FAB there.
  const dealParams = new URLSearchParams(search);
  const isDealRoom = pathname === '/my-deals' && (dealParams.get('campaign') || dealParams.get('deal'));
  const hideMsgFab = pathname === '/messages' || pathname.startsWith('/messages/') || isDealRoom;

  const handleLogout = () => { logout(); navigate('/'); };

  // KYC nudge: creators who haven't verified see a banner across every page
  // (except the KYC page itself) prompting them to finish verification.
  const kycStatus = user?.kyc?.status || 'not_submitted';
  const showKycBanner = user?.role === 'creator' && kycStatus !== 'verified' && !isActive('/kyc');
  const KYC_BANNER = {
    not_submitted: { tone: 'warn', text: 'Verify your identity (KYC) to submit bids, unlock withdrawals, and get prioritised for campaigns.', cta: 'Verify KYC' },
    pending: { tone: 'info', text: "Your KYC is under review — we'll let you know once it's verified.", cta: 'View status' },
    rejected: { tone: 'warn', text: 'Your KYC needs attention. Please review and resubmit your documents.', cta: 'Fix KYC' },
  };
  const kb = KYC_BANNER[kycStatus] || KYC_BANNER.not_submitted;

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
        account={{ name: displayName, role: 'Creator', photo }}
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
        {showKycBanner && (
          <button type="button" className={`cmk-kyc-banner ${kb.tone}`} onClick={() => navigate('/kyc')}>
            <span className="cmk-kyc-ic"><BadgeCheck size={18} /></span>
            <span className="cmk-kyc-text">{kb.text}</span>
            <span className="cmk-kyc-cta">{kb.cta} <ChevronDown size={14} style={{ transform: 'rotate(-90deg)' }} /></span>
          </button>
        )}
        {children}
      </main>

      <style>{`
        .cmk-kyc-banner { width: 100%; display: flex; align-items: center; gap: 12px; text-align: left; border: 1px solid; border-radius: 14px; padding: 12px 16px; margin: 0 0 18px; cursor: pointer; font-family: inherit; font-size: 13.5px; }
        .cmk-kyc-banner.warn { background: #fff8e8; border-color: #fbe3b4; color: #92600a; }
        .cmk-kyc-banner.info { background: #eef0ff; border-color: #d7dbff; color: #3730a3; }
        .cmk-kyc-ic { display: grid; place-items: center; flex-shrink: 0; }
        .cmk-kyc-text { flex: 1; font-weight: 600; line-height: 1.4; }
        .cmk-kyc-cta { display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; font-weight: 700; white-space: nowrap; }
        .cmk-kyc-banner:hover { filter: brightness(0.98); }
        @media (max-width: 640px) { .cmk-kyc-cta span { display: none; } }
      `}</style>

      {/* Floating Message button — hidden where the page already owns the bottom-right
          corner: the Messages page itself, and the Deal Room, which renders its own
          deal-scoped chat FAB there. Both were drawing on top of each other. */}
      {!hideMsgFab && (
        <>
          <button
            type="button"
            className="cmk-btn-primary-sm cmk-post-fab"
            onClick={() => setMsgOpen((v) => !v)}
            title="Messages"
          >
            <MessageSquare size={18} /><span className="cmk-btn-label">Message</span>
          </button>

          {msgOpen && <MessagesPopup onClose={() => setMsgOpen(false)} />}
        </>
      )}
    </div>
  );
}
