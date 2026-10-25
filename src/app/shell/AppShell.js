import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home, Users, Plus, Megaphone, MessageCircle, Compass, Package, User, Bell, ChevronLeft,
  Wallet, Bookmark, Send, Truck, Star, Settings, LogOut, BadgeCheck, ClipboardCheck, Heart, IndianRupee,
} from 'lucide-react';
import { useAuth } from '../../App';
import { creatorFirstName, brandName } from '../../utils/displayName';
import BottomSheet from './BottomSheet';
import './app-shell.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';

// Bottom tabs (design boards M0 / CM1). The brand's centre button posts a campaign.
const BRAND_TABS = [
  { key: 'home', label: 'Home', to: '/brand-home', icon: Home, match: ['/brand-home'] },
  { key: 'creators', label: 'Creators', to: '/dashboard/business/browse-creator', icon: Users, match: ['/dashboard/business/browse-creator', '/dashboard/business/creator', '/dashboard/business/saved-creators'] },
  { key: 'post', label: 'Post', to: '/dashboard/business/post-brief', icon: Plus, center: true, match: ['/dashboard/business/post-brief', '/dashboard/business/multi-brief'] },
  { key: 'campaigns', label: 'Campaigns', to: '/dashboard/business/all-campaigns', icon: Megaphone, match: ['/dashboard/business/all-campaigns', '/dashboard/business/campaign', '/dashboard/business/pending-bids', '/dashboard/business/work-review', '/dashboard/business/shipments', '/dashboard/business/sent-briefs'] },
  { key: 'messages', label: 'Messages', to: '/messages', icon: MessageCircle, match: ['/messages'] },
];
const CREATOR_TABS = [
  { key: 'home', label: 'Home', to: '/dashboard/creator', icon: Home, match: ['/dashboard/creator'] },
  { key: 'briefs', label: 'Briefs', to: '/browse-briefs', icon: Compass, match: ['/browse-briefs', '/saved', '/my-bids'] },
  { key: 'orders', label: 'Orders', to: '/my-deals', icon: Package, match: ['/my-deals', '/my-active-work'] },
  { key: 'inbox', label: 'Inbox', to: '/messages', icon: MessageCircle, match: ['/messages'] },
  { key: 'profile', label: 'Profile', to: '/profile', icon: User, match: ['/profile', '/portfolio', '/reviews'] },
];

// "More" sheet (opened from the avatar): everything that has no tab.
const BRAND_MORE = [
  { label: 'Wallet', to: '/dashboard/business/wallet', icon: Wallet },
  { label: 'Saved creators', to: '/dashboard/business/saved-creators', icon: Heart },
  { label: 'Work review', to: '/dashboard/business/work-review', icon: ClipboardCheck },
  { label: 'Creator bids', to: '/dashboard/business/pending-bids', icon: Users },
  { label: 'Sent briefs', to: '/dashboard/business/sent-briefs', icon: Send },
  { label: 'Shipments', to: '/dashboard/business/shipments', icon: Truck },
  { label: 'Reviews', to: '/dashboard/business/reviews', icon: Star },
  { label: 'Notifications', to: '/notifications', icon: Bell },
  { label: 'Settings', to: '/settings', icon: Settings },
];
const CREATOR_MORE = [
  { label: 'Earnings', to: '/withdrawal', icon: IndianRupee },
  { label: 'Saved briefs', to: '/saved', icon: Bookmark },
  { label: 'Reviews & level', to: '/reviews', icon: Star },
  { label: 'Verify KYC', to: '/kyc', icon: BadgeCheck },
  { label: 'Notifications', to: '/notifications', icon: Bell },
  { label: 'Settings', to: '/settings', icon: Settings },
];

const isOn = (item, pathname) => item.match.some((m) => pathname === m || pathname.startsWith(`${m}/`));

/**
 * The phone app frame used by every screen in src/app/screens: top bar, scrolling body, bottom tabs.
 *   title / subtitle  top-bar heading            back   true = go back, or a path string
 *   right             extra nodes before the bell   tone   'dark' for a navy hero behind the bar
 *   tabs={false}      hide the bottom tabs (full-screen flows: chat, apply, forms)
 *   bare              no body padding (screen draws edge to edge)
 */
export default function AppShell({ title, subtitle, back, right, tone = 'light', tabs = true, bare = false, children, className = '' }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user, logout } = useAuth();
  const [more, setMore] = useState(false);
  const isBrand = user?.role === 'business';
  const TABS = isBrand ? BRAND_TABS : CREATOR_TABS;
  const MORE = isBrand ? BRAND_MORE : CREATOR_MORE;
  const photo = user?.profile_photo || user?.profile_picture || user?.brand_logo || user?.avatar;
  const photoUrl = photo ? (String(photo).startsWith('http') ? photo : `${BACKEND_URL}${photo}`) : '';
  const name = isBrand ? (user?.profile?.business_name || brandName(user)) : creatorFirstName(user);
  const goBack = () => (typeof back === 'string' ? navigate(back) : navigate(-1));

  return (
    <div className={`ap-shell ap-shell--${tone}${className ? ` ${className}` : ''}`}>
      <header className="ap-bar">
        {back ? (
          <button type="button" className="ap-bar-btn" aria-label="Back" onClick={goBack}><ChevronLeft size={24} /></button>
        ) : (
          <button type="button" className="ap-bar-logo" aria-label="UGCad home" onClick={() => navigate(TABS[0].to)}>
            <span className="ap-logo-mark" aria-hidden="true" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/ugcad-logo.png)` }} />
          </button>
        )}
        <div className="ap-bar-title">
          {title ? <h1>{title}</h1> : null}
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        <div className="ap-bar-right">
          {right}
          <button type="button" className="ap-bar-btn" aria-label="Notifications" onClick={() => navigate('/notifications')}><Bell size={22} /></button>
          <button type="button" className="ap-avatar" aria-label="Menu" onClick={() => setMore(true)}>
            {photoUrl ? <img src={photoUrl} alt="" /> : (name || 'U').trim().charAt(0).toUpperCase()}
          </button>
        </div>
      </header>

      <main className={`ap-body${bare ? ' ap-body--bare' : ''}${tabs ? ' ap-body--tabs' : ''}`}>{children}</main>

      {tabs && (
        <nav className="ap-tabs" aria-label="Main">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`ap-tab${isOn(t, pathname) ? ' is-on' : ''}${t.center ? ' ap-tab--center' : ''}`}
              onClick={() => navigate(t.to)}
            >
              <span className="ap-tab-ic"><t.icon size={t.center ? 26 : 22} strokeWidth={t.center ? 2.6 : 2} /></span>
              <small>{t.label}</small>
            </button>
          ))}
        </nav>
      )}

      <BottomSheet open={more} onClose={() => setMore(false)} title={name || 'Menu'}>
        <div className="ap-more">
          {MORE.map((m) => (
            <button key={m.label} type="button" className="ap-more-row" onClick={() => { setMore(false); navigate(m.to); }}>
              <m.icon size={20} /> <span>{m.label}</span>
            </button>
          ))}
          <button type="button" className="ap-more-row ap-more-row--out" onClick={() => { setMore(false); logout(); }}>
            <LogOut size={20} /> <span>Log out</span>
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
