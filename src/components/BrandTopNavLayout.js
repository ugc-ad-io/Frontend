import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import axios from 'axios';
import { Wallet, Package, LogOut, Search, UserRoundSearch, X, Menu, Users, Megaphone, ClipboardCheck, MessageSquare, Bookmark, Send, Star, Settings, Bell, LifeBuoy, Heart } from 'lucide-react';
import NotificationBell from './NotificationBell';
import { openHelpDialog } from './HoverSideRail';
import MessagesPopup from './MessagesPopup';
import RejectedGate from './RejectedGate';
import MoreInfoGate from './MoreInfoGate';
import BrandPendingGate from './BrandPendingGate';
import { brandName } from '../utils/displayName';
import PostABrief from '../pages/PostABrief';
import { creatorSearchUrl } from '../utils/creatorSearch';
import BriefOverlay from './BriefOverlay';
import useNavHeightVar from '../utils/useNavHeightVar';
import '../styles/creator-marketplace.css';
import '../styles/brand-ui.css';
import '../styles/brand-ui-home.css';
import '../styles/brand-ui-pages.css';
import '../styles/brand-ui-detail.css';
import '../styles/brand-ui-bids.css';
import '../styles/brand-ui-work.css';
import '../styles/brand-ui-wallet.css';
import '../styles/brand-ui-mobile-a.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const getInitial = (name) => (name || 'B').trim().charAt(0).toUpperCase();

// Category strip under the header (design board 01). Each entry filters the creator directory.
const CATEGORIES = ['Beauty', 'Skincare', 'Fashion', 'Fitness', 'Food & Drinks', 'Tech & Gadgets', 'Lifestyle', 'Travel', 'Home', 'Pets', 'Apps'];
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

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
  const { pathname, search } = useLocation();
  const [searchText, setSearchText] = useState(() => new URLSearchParams(search).get('q') || '');
  useEffect(() => { setSearchText(new URLSearchParams(search).get('q') || ''); }, [pathname, search]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  // Any navigation (menu item, category chip, logo, browser back) closes the phone menu.
  useEffect(() => { setMobileOpen(false); }, [pathname, search]);
  const [briefOpen, setBriefOpen] = useState(false);
  const [msgOpen, setMsgOpen] = useState(false);
  const [balance, setBalance] = useState(null);
  const menuRef = useRef(null);
  const headerRef = useRef(null);
  useNavHeightVar(headerRef);

  // Closing the brief modal (backdrop click or X) saves what's been typed as a
  // draft first, so an accidental click doesn't throw the work away.
  const briefRef = useRef(null);
  const closeBrief = async () => {
    await briefRef.current?.saveDraftNow();
    setBriefOpen(false);
  };

  // Wallet pill in the header. A failed/gated load just hides the pill; the Wallet page owns the error UI.
  useEffect(() => {
    let live = true;
    axios.get(`${BACKEND_URL}/api/business/wallet`)
      .then((r) => { if (live) setBalance(Number(r.data?.available_balance || 0)); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

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
  const handleLogout = () => { logout(); };
  const isMessages = pathname === '/messages' || pathname.startsWith('/messages/');

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
  if (isBrand && approval === 'pending') return <BrandPendingGate user={user} onLogout={handleLogout} />;

  return (
    <div className="cmk-app bui-app">
      <header ref={headerRef} className="bui-header">
        <div className="bui-header-in">
          <button type="button" className="bui-hamburger" aria-label="Menu" aria-expanded={mobileOpen} onClick={() => setMobileOpen((v) => !v)}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <button type="button" className="bui-logo" onClick={() => navigate('/brand-home')} aria-label="UGCad.io home">
            <span className="bui-logo-mark" aria-hidden="true" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/ugcad-logo.png)` }} />
            <span className="bui-logo-word"><b>UGC</b>ad.io</span>
          </button>

          <form
            className="bui-search"
            role="search"
            onSubmit={(e) => { e.preventDefault(); navigate(creatorSearchUrl(pathname.includes('browse-creator') ? search : '', searchText)); }}
          >
            <label>
              <input
                type="search"
                aria-label="Search creators"
                placeholder="What kind of creator are you looking for?"
                value={searchText}
                onChange={(event) => {
                  const value = event.target.value;
                  setSearchText(value);
                  if (pathname.includes('browse-creator')) navigate(creatorSearchUrl(search, value), { replace: true });
                }}
              />
            </label>
            <button type="submit" aria-label="Search"><Search size={18} strokeWidth={2.4} /></button>
          </form>

          <nav className="bui-nav" aria-label="Account" ref={menuRef}>
            <NotificationBell />
            <button type="button" className="bui-iconbtn" aria-label="Messages" onClick={() => setMsgOpen((v) => !v)}>
              <MessageSquare size={20} />
            </button>
            <button type="button" className="bui-iconbtn" aria-label="Saved creators" onClick={() => navigate('/dashboard/business/saved-creators')}>
              <Heart size={20} />
            </button>
            <button type="button" className={`bui-navlink${isActive('/dashboard/business/all-campaigns') ? ' is-active' : ''}`} onClick={() => navigate('/dashboard/business/all-campaigns')}>
              Campaigns
            </button>
            {balance !== null && (
              <button type="button" className="bui-wallet" onClick={() => navigate('/dashboard/business/wallet')} aria-label="Wallet balance">{inr(balance)}</button>
            )}
            <div className="bui-acct">
              <button type="button" className="bui-avatar" onClick={() => setMenuOpen((v) => !v)} aria-label="Account menu" aria-expanded={menuOpen}>
                {photo ? <img src={photo.startsWith('http') ? photo : `${BACKEND_URL}${photo}`} alt={displayName} /> : getInitial(displayName)}
                <i aria-hidden="true" />
              </button>
              {menuOpen && (
                <div className="bui-menu">
                  <div className="bui-menu-head"><strong>{displayName}</strong><small>Brand Account</small></div>
                  {[...MENU_LINKS, ...ACCOUNT_LINKS].map((item) => (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        if (item.action === 'help') openHelpDialog();
                        else navigate(item.to);
                      }}
                    >
                      <item.icon size={17} /> {item.name}
                    </button>
                  ))}
                  <button type="button" onClick={handleLogout}><LogOut size={17} /> Log out</button>
                </div>
              )}
            </div>
            <button type="button" className="bui-post" onClick={() => setBriefOpen(true)}>Post a campaign</button>
          </nav>
        </div>

        <div className="bui-cats">
          <nav className="bui-cats-in" aria-label="Categories">
            {CATEGORIES.map((c) => {
              const on = pathname.includes('browse-creator') && (new URLSearchParams(search).get('category') || '').toLowerCase() === c.toLowerCase();
              return (
                <button key={c} type="button" className={on ? 'is-active' : ''} onClick={() => navigate(`/dashboard/business/browse-creator?category=${encodeURIComponent(c)}`)}>{c}</button>
              );
            })}
          </nav>
        </div>

        {mobileOpen && (
          <div className="bui-mobile">
            <button type="button" className="bui-mobile-post" onClick={() => { setMobileOpen(false); setBriefOpen(true); }}><Megaphone size={18} /> Post a campaign</button>
            {[...PRIMARY_LINKS, ...MENU_LINKS, ...ACCOUNT_LINKS].map((link) => (
              <button
                key={link.name}
                type="button"
                className={link.to && isActive(link.to) ? 'is-active' : ''}
                onClick={() => { setMobileOpen(false); if (link.action === 'help') openHelpDialog(); else navigate(link.to); }}
              >
                <link.icon size={18} /> {link.name}
                {link.name === 'Wallet' && balance !== null && <em className="bui-mobile-bal">{inr(balance)}</em>}
              </button>
            ))}
            <button type="button" onClick={handleLogout}><LogOut size={18} /> Log out</button>
          </div>
        )}
      </header>

      {/* Messages is a full-height app pane: the normal page padding (18px top + ~96px bottom on a
          phone) added ~114px of blank scroll under it and pushed the composer off screen. Same
          flush rule CreatorTopNavLayout already applies. */}
      <main className={`cmk-wrap cmk-page${isMessages ? ' cmk-page--flush' : ''}`}>
        {children}
      </main>

      {/* Floating Message button — hidden on the Messages page itself (redundant there). */}
      {!isMessages && (
        <>
          {/* Hidden while the popup is open so the FAB doesn't peek out behind it. */}
          {!msgOpen && (
            <button
              type="button"
              className="cmk-btn-primary-sm cmk-post-fab"
              onClick={() => setMsgOpen((v) => !v)}
              title="Messages"
            >
              <MessageSquare size={18} /><span className="cmk-btn-label">Message</span>
            </button>
          )}

          {msgOpen && <MessagesPopup onClose={() => setMsgOpen(false)} />}
        </>
      )}

      {briefOpen && (
        // Save the half-written brief as a draft on the way out — clicking the
        // backdrop by accident shouldn't bin it.
        <BriefOverlay className="cmk-brief-overlay" onClick={closeBrief}>
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
        </BriefOverlay>
      )}
    </div>
  );
}
