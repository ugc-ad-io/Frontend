import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../App';
import {
  LayoutGrid, Users, Megaphone, UserRoundSearch, ClipboardCheck, MessageSquare, Wallet, Package, Send,
  Bookmark, Star, Settings, LogOut, Menu, X, Plus, LifeBuoy,
} from 'lucide-react';
import { openHelpDialog } from './HoverSideRail';
import RejectedGate from './RejectedGate';
import MoreInfoGate from './MoreInfoGate';
import BrandPendingGate from './BrandPendingGate';
import BrandPageHead, { BrandHeadContext } from './BrandPageHead';
import { brandName } from '../utils/displayName';
import '../styles/creator-marketplace.css';
import '../styles/brand-ui.css';
import '../styles/brand-ui-home.css';
import '../styles/brand-ui-pages.css';
import '../styles/brand-ui-detail.css';
import '../styles/brand-ui-bids.css';
import '../styles/brand-ui-work.css';
import '../styles/brand-ui-wallet.css';
import '../styles/brand-ui-mobile-a.css';
import '../styles/brand-ui-shell.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const getInitial = (name) => (name || 'B').trim().charAt(0).toUpperCase();
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const BIZ = '/dashboard/business';

// Sidebar destinations (same shape as the creator shell). `count` keys are filled from the layout's own fetches.
const NAV = [
  { key: 'home', name: 'Home', to: '/brand-home', icon: LayoutGrid, match: ['/brand-home', BIZ], exact: [BIZ] },
  { key: 'creators', name: 'Creators', to: `${BIZ}/browse-creator`, icon: Users, match: [`${BIZ}/browse-creator`, `${BIZ}/creator`, `${BIZ}/multi-brief`] },
  { key: 'campaigns', name: 'Campaigns', to: `${BIZ}/all-campaigns`, icon: Megaphone, match: [`${BIZ}/all-campaigns`, `${BIZ}/campaign`, '/campaign'] },
  { key: 'bids', name: 'Bids', to: `${BIZ}/pending-bids`, icon: UserRoundSearch, match: [`${BIZ}/pending-bids`] },
  { key: 'work', name: 'Work review', to: `${BIZ}/work-review`, icon: ClipboardCheck, match: [`${BIZ}/work-review`] },
  { key: 'inbox', name: 'Messages', to: '/messages', icon: MessageSquare, count: 'unread', match: ['/messages'] },
  { key: 'wallet', name: 'Wallet', to: `${BIZ}/wallet`, icon: Wallet, match: [`${BIZ}/wallet`, `${BIZ}/invoice`, `${BIZ}/plans`, `${BIZ}/edit-addon`] },
  { key: 'ship', name: 'Shipments', to: `${BIZ}/shipments`, icon: Package, match: [`${BIZ}/shipments`] },
  { key: 'sent', name: 'Sent briefs', to: `${BIZ}/sent-briefs`, icon: Send, match: [`${BIZ}/sent-briefs`] },
  { key: 'saved', name: 'Saved creators', to: `${BIZ}/saved-creators`, icon: Bookmark, match: [`${BIZ}/saved-creators`] },
  { key: 'reviews', name: 'Reviews', to: `${BIZ}/reviews`, icon: Star, match: [`${BIZ}/reviews`] },
  { key: 'settings', name: 'Settings', to: '/settings', icon: Settings, match: ['/settings', '/disputes'] },
];
// Bottom tab bar on phones.
const TABS = ['home', 'creators', 'campaigns', 'inbox', 'wallet'];
const TAB_LABEL = { home: 'Home', creators: 'Creators', campaigns: 'Campaigns', inbox: 'Messages', wallet: 'Wallet' };

/**
 * Brand shell: dark sidebar on desktop, top bar + drawer + bottom tabs on phones (mirrors CreatorTopNavLayout).
 * Pages render their own title row with <BrandPageHead />; pages that do not get a search + bell row.
 */
export default function BrandTopNavLayout({ children, notifications = 0 }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [drawer, setDrawer] = useState(false);
  const [unread, setUnread] = useState(0);
  const [wallet, setWallet] = useState(null);
  const [heads, setHeads] = useState(0);
  const headCtx = useMemo(() => ({ add: () => setHeads((n) => n + 1), remove: () => setHeads((n) => n - 1) }), []);

  useEffect(() => { setDrawer(false); }, [pathname]);

  // Sidebar wallet card + Messages badge. A failed/gated load just hides the number; the Wallet page owns the error UI.
  useEffect(() => {
    let live = true;
    axios.get(`${API}/business/wallet`)
      .then((r) => { if (live) setWallet(r.data || {}); })
      .catch(() => {});
    axios.get(`${API}/chat/unread-count`)
      .then((r) => { if (live) setUnread(Number(r.data?.unread_count || 0)); })
      .catch(() => {});
    return () => { live = false; };
  }, [pathname]);

  const displayName = user?.profile?.business_name || brandName(user);
  const photo = user?.profile_photo || user?.brand_logo;
  const photoUrl = photo ? (photo.startsWith('http') ? photo : `${BACKEND_URL}${photo}`) : '';
  const isActive = (item) => item.match.some((m) => (item.exact?.includes(m) ? pathname === m : pathname === m || pathname.startsWith(`${m}/`)));
  const counts = { unread: Math.max(unread, Number(notifications) || 0) };
  const handleLogout = () => { logout(); };
  const isMessages = pathname === '/messages' || pathname.startsWith('/messages/');
  const balance = wallet ? Number(wallet.available_balance || 0) : null;
  const goPost = () => navigate(`${BIZ}/post-brief`);

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

  const sidebar = (
    <>
      <button type="button" className="bsh-logo" onClick={() => navigate('/brand-home')} aria-label="UGCad.io home">
        <span className="bsh-logo-mark" aria-hidden="true" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/ugcad-logo.png)` }} />
        <span className="bsh-logo-word"><b>UGC</b>ad.io</span>
      </button>
      <span className="bsh-tag">FOR BRANDS</span>
      <button type="button" className="bsh-post" onClick={goPost}><Plus size={18} strokeWidth={2.4} /> Post a campaign</button>
      <nav className="bsh-nav" aria-label="Brand">
        {NAV.map((item) => {
          const n = item.count ? counts[item.count] : 0;
          return (
            <button key={item.key} type="button" className={`bsh-nav-item${isActive(item) ? ' is-on' : ''}`} onClick={() => navigate(item.to)}>
              <item.icon size={19} />
              <span>{item.name}</span>
              {n > 0 && <i>{n > 99 ? '99+' : n}</i>}
            </button>
          );
        })}
      </nav>
      <div className="bsh-wallet">
        <small>Wallet balance</small>
        <b>{balance === null ? '—' : inr(balance)}</b>
        {wallet && (
          <small className={wallet.chat_unlocked ? 'bsh-wallet-ok' : ''}>
            {wallet.chat_unlocked
              ? 'Platform chat unlocked'
              : (wallet.minimum_chat_balance ? `${inr(wallet.minimum_chat_balance)} minimum to unlock chat` : 'Add funds to unlock chat')}
          </small>
        )}
        <button type="button" className="bsh-addfunds" onClick={() => navigate(`${BIZ}/wallet`)}>Add funds</button>
      </div>
      <div className="bsh-foot">
        <button type="button" className="bsh-out" onClick={openHelpDialog}><LifeBuoy size={16} /> Need help?</button>
        <button type="button" className="bsh-out" onClick={handleLogout}><LogOut size={16} /> Log out</button>
      </div>
    </>
  );

  return (
    <div className="cmk-app bui-app bsh-app">
      <aside className="bsh-side">{sidebar}</aside>

      <header className="bsh-top">
        <button type="button" className="bsh-iconbtn" aria-label="Menu" aria-expanded={drawer} onClick={() => setDrawer((v) => !v)}>
          {drawer ? <X size={22} /> : <Menu size={22} />}
        </button>
        <button type="button" className="bsh-top-logo" onClick={() => navigate('/brand-home')} aria-label="UGCad.io home">
          <span className="bsh-logo-mark bsh-logo-mark--dark" aria-hidden="true" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/ugcad-logo.png)` }} />
          <span className="bsh-logo-word bsh-logo-word--dark"><b>UGC</b>ad.io</span>
        </button>
        <button type="button" className="bsh-top-post" aria-label="Post a campaign" onClick={goPost}><Plus size={16} strokeWidth={2.6} /> Post</button>
        <button type="button" className="bsh-avatar" aria-label="Account settings" onClick={() => navigate('/settings')}>
          {photoUrl ? <img src={photoUrl} alt={displayName} /> : getInitial(displayName)}
        </button>
      </header>

      {drawer && (
        <>
          <div className="bsh-backdrop" onClick={() => setDrawer(false)} aria-hidden="true" />
          <aside className="bsh-drawer">{sidebar}</aside>
        </>
      )}

      {/* Messages is a full-height app pane: the normal page padding would add blank scroll under the
          composer. Same flush rule CreatorTopNavLayout applies (bsh-main--flush). */}
      <main className={`bsh-main${isMessages ? ' bsh-main--flush' : ''}`}>
        <BrandHeadContext.Provider value={headCtx}>
          {!isMessages && heads === 0 && <div className="bsh-util"><BrandPageHead util /></div>}
          {children}
        </BrandHeadContext.Provider>
      </main>

      <nav className="bsh-tabs" aria-label="Brand quick links">
        {NAV.filter((i) => TABS.includes(i.key)).map((item) => {
          const n = item.count ? counts[item.count] : 0;
          return (
            <button key={item.key} type="button" className={isActive(item) ? 'is-on' : ''} onClick={() => navigate(item.to)}>
              <span className="bsh-tab-ic"><item.icon size={21} />{n > 0 && <i>{n > 9 ? '9+' : n}</i>}</span>
              <small>{TAB_LABEL[item.key]}</small>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
