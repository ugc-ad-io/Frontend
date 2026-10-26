import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../App';
import {
  LayoutGrid, Compass, Package, MessageSquare, Wallet, User, Star, Settings, Bookmark,
  BadgeCheck, LogOut, Menu, X, ChevronRight,
} from 'lucide-react';
import { creatorFirstName } from '../utils/displayName';
import '../styles/creator-marketplace.css';
import '../styles/creator-ui.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const getInitial = (name) => (name || 'U').trim().charAt(0).toUpperCase();
const LEVEL_LABEL = { new: 'New', verified: 'Verified', l1: 'Level 1', l2: 'Level 2', elite: 'Elite' };

// Sidebar destinations (design board C01). `count` keys are filled from the deals list below.
const NAV = [
  { key: 'dash', name: 'Dashboard', to: '/dashboard/creator', icon: LayoutGrid, match: ['/dashboard/creator'] },
  { key: 'briefs', name: 'Find briefs', to: '/browse-briefs', icon: Compass, match: ['/browse-briefs', '/my-bids'] },
  { key: 'saved', name: 'Saved briefs', to: '/saved', icon: Bookmark, match: ['/saved'] },
  { key: 'orders', name: 'Orders', to: '/my-deals', icon: Package, count: 'orders', match: ['/my-deals', '/my-active-work'] },
  { key: 'inbox', name: 'Inbox', to: '/messages', icon: MessageSquare, count: 'unread', match: ['/messages'] },
  { key: 'earn', name: 'Earnings', to: '/withdrawal', icon: Wallet, match: ['/withdrawal'] },
  { key: 'profile', name: 'My profile', to: '/profile', icon: User, match: ['/profile', '/portfolio'] },
  { key: 'reviews', name: 'Reviews', to: '/reviews', icon: Star, match: ['/reviews'] },
  { key: 'settings', name: 'Settings', to: '/settings', icon: Settings, match: ['/settings', '/kyc'] },
];
// Bottom tab bar on phones.
const TABS = ['dash', 'briefs', 'orders', 'inbox'];

/**
 * Creator shell: dark sidebar on desktop, top bar + drawer + bottom tabs on phones.
 * Pages render their own title row with <CreatorPageHead />.
 */
export default function CreatorTopNavLayout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [counts, setCounts] = useState({ orders: 0, unread: 0 });

  useEffect(() => { setDrawer(false); }, [pathname]);
  // Open drawer: lock page scroll behind it and let Escape close it.
  useEffect(() => {
    if (!drawer) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => { if (e.key === 'Escape') setDrawer(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [drawer]);

  // Sidebar badges: active orders and unread chat messages come from the deals list.
  useEffect(() => {
    let live = true;
    axios.get(`${API}/deals/my?summary=true`)
      .then((r) => {
        if (!live) return;
        const list = Array.isArray(r.data) ? r.data : (r.data?.deals || []);
        const open = list.filter((d) => !/paid\s*[-—–]\s*complete|disputed|archived/i.test(String(d.current_state || '')));
        setCounts({ orders: open.length, unread: list.reduce((s, d) => s + Number(d.unread_count || 0), 0) });
      })
      .catch(() => {});
    return () => { live = false; };
  }, [pathname]);

  const displayName = creatorFirstName(user);
  const photo = user?.profile_photo || user?.profile_picture || user?.avatar;
  const photoUrl = photo ? (photo.startsWith('http') ? photo : `${BACKEND_URL}${photo}`) : '';
  const isActive = (item) => item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));
  const level = LEVEL_LABEL[String(user?.level || '').toLowerCase()] || user?.level_label || 'New';
  const choice = Boolean(user?.ugcad_approved);

  const isMessages = pathname === '/messages' || pathname.startsWith('/messages/');
  const handleLogout = () => { logout(); };

  // KYC nudge: creators who haven't verified see a banner across every page (except the KYC page itself).
  const kycStatus = user?.kyc?.status || 'not_submitted';
  const showKycBanner = user?.role === 'creator' && kycStatus !== 'verified' && !pathname.startsWith('/kyc');
  const KYC_BANNER = {
    not_submitted: { tone: 'warn', text: 'Verify your identity (KYC) to submit bids, unlock withdrawals, and get prioritised for campaigns.', cta: 'Verify KYC' },
    pending: { tone: 'info', text: "Your KYC is under review - we'll let you know once it's verified.", cta: 'View status' },
    rejected: { tone: 'warn', text: 'Your KYC needs attention. Please review and resubmit your documents.', cta: 'Fix KYC' },
  };
  const kb = KYC_BANNER[kycStatus] || KYC_BANNER.not_submitted;

  const items = useMemo(() => NAV, []);
  const sidebar = (
    <>
      <button type="button" className="cui-logo" onClick={() => navigate('/dashboard/creator')} aria-label="UGCad.io dashboard">
        <span className="cui-logo-mark" aria-hidden="true" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/ugcad-logo.png)` }} />
        <span className="cui-logo-word"><b>UGC</b>ad.io</span>
      </button>
      <span className="cui-tag">FOR CREATORS</span>
      <nav className="cui-nav" aria-label="Creator">
        {items.map((item) => {
          const n = item.count ? counts[item.count] : 0;
          return (
            <button key={item.key} type="button" className={`cui-nav-item${isActive(item) ? ' is-on' : ''}`} onClick={() => navigate(item.to)}>
              <item.icon size={19} />
              <span>{item.name}</span>
              {n > 0 && <i>{n > 99 ? '99+' : n}</i>}
            </button>
          );
        })}
      </nav>
      <div className="cui-level">
        <small>Your level</small>
        <b>{level}{choice ? ' · UGCAD.IO Choice' : ''}</b>
        <div className="cui-level-bar"><span style={{ width: level === 'Elite' ? '100%' : '55%' }} /></div>
        <small>{kycStatus === 'verified' ? 'Identity verified' : 'Verify your identity to level up'}</small>
      </div>
      <button type="button" className="cui-out" onClick={handleLogout}><LogOut size={16} /> Log out</button>
    </>
  );

  return (
    <div className="cmk-app cui-app">
      <aside className="cui-side">{sidebar}</aside>

      <header className="cui-top">
        <button type="button" className="cui-iconbtn" aria-label="Menu" aria-expanded={drawer} onClick={() => setDrawer((v) => !v)}>
          {drawer ? <X size={22} /> : <Menu size={22} />}
        </button>
        <button type="button" className="cui-top-logo" onClick={() => navigate('/dashboard/creator')} aria-label="UGCad.io dashboard">
          <span className="cui-logo-mark cui-logo-mark--dark" aria-hidden="true" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/ugcad-logo.png)` }} />
          <span className="cui-logo-word cui-logo-word--dark"><b>UGC</b>ad.io</span>
        </button>
        <button type="button" className="cui-avatar" aria-label="My profile" onClick={() => navigate('/profile')}>
          {photoUrl ? <img src={photoUrl} alt={displayName} /> : getInitial(displayName)}
        </button>
      </header>

      {drawer && (
        <>
          <div className="cui-backdrop" onClick={() => setDrawer(false)} aria-hidden="true" />
          <aside className="cui-drawer" aria-label="Menu">
            <button type="button" className="cui-drawer-x" aria-label="Close menu" onClick={() => setDrawer(false)}><X size={22} /></button>
            {sidebar}
          </aside>
        </>
      )}

      <main className={`cui-main${isMessages ? ' cui-main--flush' : ''}`}>
        {showKycBanner && (
          <button type="button" className={`cui-kyc ${kb.tone}`} onClick={() => navigate('/kyc')}>
            <BadgeCheck size={18} />
            <span>{kb.text}</span>
            <em>{kb.cta} <ChevronRight size={14} /></em>
          </button>
        )}
        {children}
      </main>

      <nav className="cui-tabs" aria-label="Creator quick links">
        {NAV.filter((i) => TABS.includes(i.key)).map((item) => {
          const n = item.count ? counts[item.count] : 0;
          return (
            <button key={item.key} type="button" className={isActive(item) ? 'is-on' : ''} onClick={() => navigate(item.to)}>
              <span className="cui-tab-ic"><item.icon size={21} />{n > 0 && <i>{n > 9 ? '9+' : n}</i>}</span>
              <small>{item.name === 'Dashboard' ? 'Home' : item.name === 'Find briefs' ? 'Briefs' : item.name}</small>
            </button>
          );
        })}
        <button type="button" className={isActive(NAV.find((i) => i.key === 'profile')) ? 'is-on' : ''} onClick={() => navigate('/profile')}>
          <span className="cui-tab-ic"><User size={21} /></span>
          <small>Profile</small>
        </button>
      </nav>
    </div>
  );
}
