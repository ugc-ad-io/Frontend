import { useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Megaphone, Package, BadgeCheck, ReceiptText, IndianRupee, FileText, ClipboardCheck,
  BarChart3, Wallet, ChevronRight, MessageSquare, Briefcase,
} from 'lucide-react';
import { can } from '../utils/adminRoles';

const greeting = () => {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
};
/**
 * "Good afternoon, Admin Master" on one line when it fits. When it does not, a deliberate
 * fallback: the greeting, then the name as a smaller secondary line (truncated, full name in
 * the title) - never one oversized heading wrapped across two lines.
 */
function Greeting({ name }) {
  const lineRef = useRef(null);
  const [split, setSplit] = useState(false);
  const hello = greeting();
  useLayoutEffect(() => {
    const check = () => {
      setSplit(false);
      requestAnimationFrame(() => { const el = lineRef.current; if (el) setSplit(el.scrollWidth > el.clientWidth + 1); });
    };
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [name, hello]);
  return (
    <div className="am-greeting">
      {split ? (
        <>
          <h1>{hello}</h1>
          <p className="am-greeting-name" title={name}>{name}</p>
        </>
      ) : (
        <h1 ref={lineRef} title={`${hello}, ${name}`}>{hello}, {name}</h1>
      )}
      <p>Here’s what’s happening today.</p>
    </div>
  );
}

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

/**
 * Home (Overview) on phones. Same data and permission rules as the desktop overview:
 * a role only sees tiles and queues it can act on, and every tile opens its queue.
 */
export default function AdminHomePhone({ user, stats, pendingProfiles, pendingCampaigns, pendingWithdrawals, analytics }) {
  const navigate = useNavigate();
  const name = user?.nickname || user?.full_name || 'Admin';

  const tiles = [
    can(user, 'review_applications') && { label: 'Pending profiles', icon: Users, value: pendingProfiles, to: '/dashboard/admin/profiles' },
    can(user, 'manage_briefs') && { label: 'Campaigns', icon: Megaphone, value: pendingCampaigns, to: '/dashboard/admin/campaigns' },
    can(user, 'manage_shipping') && { label: 'Shipments', icon: Package, value: stats.pending_shipments || 0, to: '/dashboard/admin/shipping' },
    can(user, 'manage_kyc') && { label: 'KYC', icon: BadgeCheck, value: stats.pending_kyc || 0, to: '/dashboard/admin/kyc' },
  ].filter(Boolean);

  const queue = [
    can(user, 'review_applications') && { label: 'Applications', icon: FileText, count: pendingProfiles, to: '/dashboard/admin/applications' },
    can(user, 'manage_briefs') && { label: 'Brief approvals', icon: ClipboardCheck, count: pendingCampaigns, to: '/dashboard/admin/campaigns' },
    can(user, 'manage_kyc') && { label: 'KYC verification', icon: BadgeCheck, count: stats.pending_kyc || 0, to: '/dashboard/admin/kyc' },
    can(user, 'manage_gst') && { label: 'GST verification', icon: ReceiptText, count: stats.pending_gst || 0, to: '/dashboard/admin/gst' },
    can(user, 'manage_shipping') && { label: 'Shipment queue', icon: Package, count: stats.pending_shipments || 0, to: '/dashboard/admin/shipping' },
    can(user, 'release_payouts') && { label: 'Withdrawal requests', icon: IndianRupee, count: pendingWithdrawals, to: '/dashboard/admin/withdrawals' },
  ].filter(Boolean);

  const secondary = [
    can(user, 'manage_deals') && { label: 'Active campaigns', icon: BarChart3, value: analytics?.active_campaigns ?? stats.active_campaigns ?? 0, to: '/dashboard/admin/all-campaigns' },
    can(user, 'view_financials') && analytics && { label: 'Platform earnings', icon: Wallet, value: inr(analytics.platform_commission), to: '/dashboard/admin/financials' },
  ].filter(Boolean);

  const actions = [
    can(user, 'review_applications') && { icon: FileText, label: 'Review applications', to: '/dashboard/admin/applications' },
    can(user, 'manage_deals') && { icon: Briefcase, label: 'View all campaigns', to: '/dashboard/admin/all-campaigns' },
    (can(user, 'user_management') || can(user, 'adjust_wallet')) && { icon: IndianRupee, label: 'Manage users & wallets', to: '/dashboard/admin/users' },
    can(user, 'user_management') && { icon: MessageSquare, label: 'Send announcement', to: '/dashboard/admin/broadcast' },
  ].filter(Boolean);

  const tile = (t) => {
    const Icon = t.icon;
    return (
      <button type="button" key={t.label} className="am-tile" onClick={() => navigate(t.to)}>
        <span className="am-tile-top"><Icon size={18} aria-hidden="true" />{t.label}</span>
        <span className="am-tile-value">{t.value}<ChevronRight size={18} aria-hidden="true" /></span>
      </button>
    );
  };

  const rows = (items, withCount) => (
    <ul className="am-rows">
      {items.map((row) => {
        const Icon = row.icon;
        return (
          <li key={row.label}>
            <button type="button" className="am-row" onClick={() => navigate(row.to)}>
              <Icon size={20} aria-hidden="true" />
              <span className="am-row-label">{row.label}</span>
              {withCount && row.count > 0 && <span className="am-count" aria-label={`${row.count} pending`}>{row.count}</span>}
              <ChevronRight size={18} className="am-row-chevron" aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );

  const waiting = queue.reduce((sum, row) => sum + (Number(row.count) || 0), 0);

  return (
    <div className="am admin-home-phone">
      <Greeting name={name} />

      {tiles.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 className="am-section-title">Overview</h2>
          <div className="am-tiles">{tiles.map(tile)}</div>
        </section>
      )}

      {queue.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="am-section-head">
            <h2 className="am-section-title">Needs attention</h2>
            {waiting > 0 && <span className="am-badge am-badge--wait">{waiting} waiting</span>}
          </div>
          {rows(queue, true)}
        </section>
      )}

      {secondary.length > 0 && <div className="am-tiles">{secondary.map(tile)}</div>}

      {actions.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2 className="am-section-title">Quick actions</h2>
          {rows(actions, false)}
        </section>
      )}

      {!tiles.length && !queue.length && !secondary.length && !actions.length && (
        <p className="am-empty">Your role doesn’t have any overview widgets. Use More for the sections you can access.</p>
      )}
    </div>
  );
}
