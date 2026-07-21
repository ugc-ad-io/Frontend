import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import { ChevronDown, Plus, Wallet, Package, LogOut, Search, UserRoundSearch, X, Menu, Users, Megaphone, ClipboardCheck, MessageSquare, Bookmark, Send, Star, Settings, Bell, LifeBuoy } from 'lucide-react';
import NotificationBell from './NotificationBell';
import HoverSideRail, { openHelpDialog } from './HoverSideRail';
import MessagesPopup from './MessagesPopup';
import RejectedGate from './RejectedGate';
import MoreInfoGate from './MoreInfoGate';
import { brandName } from '../utils/displayName';
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
  { name: 'Saved Creators', to: '/dashboard/business/saved-creators', icon: Bookmark },
  { name: 'Creator Bids', to: '/dashboard/business/pending-bids', icon: UserRoundSearch },
  // Outgoing counterpart to "Creator Bids" (which is incoming). The page and its route
  // already existed but nothing linked to it, so the tab was unreachable in the UI.
  { name: 'Sent Briefs', to: '/dashboard/business/sent-briefs', icon: Send },
  { name: 'Manage Shipment', to: '/dashboard/business/shipments', icon: Package },
  { name: 'Wallet', to: '/dashboard/business/wallet', icon: Wallet },
];

// Account-menu only — these were taken off the side rail, so they live in the
// avatar dropdown (and the mobile menu) instead. "Need help?" opens the support
// dialog rather than navigating.
const ACCOUNT_LINKS = [
  { name: 'Reviews', to: '/dashboard/business/reviews', icon: Star },
  { name: 'Notifications', to: '/notifications', icon: Bell },
  { name: 'Settings', to: '/settings', icon: Settings },
  { name: 'Need help?', icon: LifeBuoy, action: 'help' },
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
  const [msgOpen, setMsgOpen] = useState(false);
  const menuRef = useRef(null);

  // Closing the brief modal (backdrop click or X) saves what's been typed as a
  // draft first, so an accidental click doesn't throw the work away.
  const briefRef = useRef(null);
  const closeBrief = async () => {
    await briefRef.current?.saveDraftNow();
    setBriefOpen(false);
  };

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
    // The floating message popup / per-creator chat would otherwise sit on top of the
    // full-screen brief modal — close them when Post a Campaign opens. ChatPopup lives
    // in other components, so reach it via a broadcast event.
    setMsgOpen(false);
    window.dispatchEvent(new Event('ugcad:brief-opened'));
    const html = document.documentElement;
    const prevHtml = html.style.overflow;
    const prevBody = document.body.style.overflow;
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    return () => { html.style.overflow = prevHtml; document.body.style.overflow = prevBody; };
  }, [briefOpen]);

  const displayName = user?.profile?.business_name || brandName(user);
  const photo = user?.profile_photo || user?.brand_logo;
  const isActive = (to) => (to === '/dashboard/business' ? pathname === to : pathname === to || pathname.startsWith(`${to}/`));
  const handleLogout = () => { logout(); navigate('/'); };

  // Approval gate — a brand whose profile is still pending review (or was
  // rejected) must not reach ANY feature page. BusinessDashboard already gates
  // its own pages; this makes the standalone brand pages (Campaigns, etc.)
  // behave identically, so it's never "some tabs work, others say under review".
  const approval = user?.approval_status;
  const isBrand = ['business', 'brand'].includes(String(user?.role || '').toLowerCase());
  if (isBrand && approval === 'rejected') {
    return <RejectedGate user={user} onHome={handleLogout} kind="business" />;
  }
  // 'more_info' was missing from this gate entirely, so an admin could ask a brand
  // for more details and the brand would just land on the dashboard as normal —
  // never told what was wanted, with no way to resubmit.
  if (isBrand && approval === 'more_info') {
    return <MoreInfoGate user={user} kind="business" onLogout={handleLogout} />;
  }
  if (isBrand && approval === 'pending') {
    return (
      <div className="brl-gate">
        <div className="brl-gate-card">
          <span className="brl-gate-ic">🕓</span>
          <p className="brl-gate-eyebrow">Business verification</p>
          <h1>Profile Under Review</h1>
          <p>
            Your business profile is being verified by our team. Most accounts are approved within 24–48 hours,
            and we’ll email you once you’re cleared to launch campaigns.
          </p>
          <button type="button" className="brl-gate-btn" onClick={handleLogout}>Back to Home</button>
        </div>
        <style>{`
          .brl-gate{min-height:100vh;display:grid;place-items:center;padding:24px;background:linear-gradient(160deg,#05050f 0%,#0d0b26 100%)}
          .brl-gate-card{width:min(560px,100%);padding:48px 40px;border-radius:24px;background:#141420;color:#f4f4f8;text-align:center;border:1px solid rgba(255,255,255,.08);box-shadow:0 24px 60px rgba(0,0,0,.5)}
          .brl-gate-ic{font-size:44px;line-height:1}
          .brl-gate-eyebrow{margin:16px 0 4px;color:#8b8fb5;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.4px}
          .brl-gate-card h1{margin:0 0 12px;font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:26px;color:#fff}
          .brl-gate-card p{margin:0 auto;max-width:420px;color:rgba(255,255,255,.62);font-size:14.5px;line-height:1.65}
          .brl-gate-btn{margin-top:26px;padding:12px 26px;border-radius:12px;border:none;cursor:pointer;font:inherit;font-weight:700;font-size:14px;background:#5b6bff;color:#fff}
          .brl-gate-btn:hover{background:#4452f0}
        `}</style>
      </div>
    );
  }

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
        account={{ name: displayName, role: 'Brand Account', photo }}
      />
      <header className="cmk-nav">
        <div className="cmk-wrap cmk-nav-inner">
          <button type="button" className="cmk-hamburger" aria-label="Menu" onClick={() => setMobileOpen((v) => !v)}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
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
            <button type="button" className="cmk-btn-primary-sm cmk-nav-post-full" onClick={() => setBriefOpen(true)} title="Post a Campaign" aria-label="Post a Campaign">
              <Plus size={18} /><span className="cmk-btn-label">Post a Campaign</span>
            </button>

            <NotificationBell />

            <button type="button" className="cmk-avatar-btn" onClick={() => setMenuOpen((v) => !v)} aria-label="Account menu">
              <span className="cmk-avatar">
                {photo ? <img src={photo.startsWith('http') ? photo : `${BACKEND_URL}${photo}`} alt={displayName} /> : getInitial(displayName)}
              </span>
              <span className="cmk-avatar-id">
                <strong>{displayName}</strong>
                <small>Brand Account</small>
              </span>
            </button>

            {menuOpen && (
              <div className="cmk-menu">
                {/* Only account-level entries here — the rail already lists Saved
                    Creators / Creator Bids / Sent Briefs / Shipments / Wallet. */}
                {ACCOUNT_LINKS.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      if (item.action === 'help') openHelpDialog();
                      else navigate(item.to);
                    }}
                  >
                    <item.icon size={18} /> {item.name}
                  </button>
                ))}
                <button type="button" onClick={handleLogout}><LogOut size={18} /> Log out</button>
              </div>
            )}
          </div>
        </div>
        {mobileOpen && (
          <div className="cmk-mobile-backdrop" onClick={() => setMobileOpen(false)} aria-hidden="true" />
        )}
        {mobileOpen && (
          <div className="cmk-mobile-menu">
            {/* These carry an `icon` just like the other two groups, but the mobile
                menu was rendering the bare name — so the top four entries sat
                icon-less and misaligned against everything below them. */}
            {PRIMARY_LINKS.map((link) => (
              <button key={link.name} type="button" className={isActive(link.to) ? 'is-active' : ''} onClick={() => { setMobileOpen(false); navigate(link.to); }}>
                <link.icon size={18} /> {link.name}
              </button>
            ))}
            <div className="cmk-sep" />
            {MENU_LINKS.filter((i) => !i.sep).map((item) => (
              <button key={item.name} type="button" className={isActive(item.to) ? 'is-active' : ''} onClick={() => { setMobileOpen(false); navigate(item.to); }}>
                <item.icon size={18} /> {item.name}
              </button>
            ))}
            <div className="cmk-sep" />
            {ACCOUNT_LINKS.map((item) => (
              <button
                key={item.name}
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  if (item.action === 'help') openHelpDialog();
                  else navigate(item.to);
                }}
              >
                <item.icon size={18} /> {item.name}
              </button>
            ))}
            <div className="cmk-mobile-foot">
              <div className="cmk-sep" />
              <button type="button" onClick={handleLogout}><LogOut size={18} /> Log out</button>
            </div>
          </div>
        )}
      </header>

      <main className="cmk-wrap cmk-page">
        {children}
      </main>

      {/* Floating Message button — hidden on the Messages page itself (redundant there). */}
      {!(pathname === '/messages' || pathname.startsWith('/messages/')) && (
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

      {briefOpen && (
        // Save the half-written brief as a draft on the way out — clicking the
        // backdrop by accident shouldn't bin it.
        <div className="cmk-brief-overlay" onClick={closeBrief}>
          <div className="cmk-brief-modal" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="cmk-brief-close"
              aria-label="Close"
              onClick={closeBrief}
            >
              <X size={20} />
            </button>
            <PostABrief
              ref={briefRef}
              onClose={closeBrief}
              onPublished={() => setBriefOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
