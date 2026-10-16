import { useNavigate } from 'react-router-dom';
import { ChevronRight, LogOut } from 'lucide-react';
import { useAuth } from '../App';
import { visibleAdminTabs } from './AdminSidebar';
import useAdminStats from '../lib/useAdminStats';
import { ROLE_LABELS, normalizeRole } from '../utils/adminRoles';

const API = `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api`;

// Which stats counter belongs to which module (only real counters from /admin/stats).
const COUNT_KEY = {
  applications: 'pending_profiles',
  briefs: 'pending_campaigns',
  kyc: 'pending_kyc',
  gst: 'pending_gst',
  shipping: 'pending_shipments',
  financials: 'pending_withdrawals',
};

const REVIEW_LABELS = { applications: 'Applications', briefs: 'Brief approvals', kyc: 'KYC verification', gst: 'GST verification' };

const MORE_GROUPS = [
  ['People', ['users', 'assigned', 'kyc', 'gst']],
  ['Operations', ['briefs', 'disputes', 'shipping', 'editing']],
  ['Management', ['financials', 'reports', 'chat', 'audit']],
  ['Platform', ['roles', 'showcase', 'notifications', 'settings']],
];

const pathFor = (tab) => (tab.id === 'applications' ? '/dashboard/admin/applications' : `/dashboard/admin/${tab.slug}`);

/** Phone hubs behind the bottom bar: "reviews" (approval queues) and "more" (every other module). */
export default function AdminHub({ kind }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { stats } = useAdminStats(API, user?.id || user?.user_id);
  const tabs = visibleAdminTabs(user);
  const byId = Object.fromEntries(tabs.map((tab) => [tab.id, tab]));

  const row = (id, label) => {
    const tab = byId[id];
    if (!tab) return null;
    const Icon = tab.icon;
    const count = stats && COUNT_KEY[id] ? Number(stats[COUNT_KEY[id]] || 0) : 0;
    return (
      <li key={id}>
        <button type="button" className="admin-hub-row" onClick={() => navigate(pathFor(tab))}>
          <Icon size={20} aria-hidden="true" />
          <span className="admin-hub-label">{label || tab.label}</span>
          {count > 0 && <span className="admin-hub-count" aria-label={`${count} pending`}>{count}</span>}
          <ChevronRight size={18} aria-hidden="true" className="admin-hub-chevron" />
        </button>
      </li>
    );
  };

  if (kind === 'reviews') {
    const rows = Object.keys(REVIEW_LABELS).map((id) => row(id, REVIEW_LABELS[id])).filter(Boolean);
    return (
      <div className="admin-hub">
        {rows.length ? <ul className="admin-hub-card">{rows}</ul>
          : <p className="admin-hub-empty">You have no review queues with your current role.</p>}
      </div>
    );
  }

  const name = user?.nickname || user?.full_name || 'Admin';
  return (
    <div className="admin-hub">
      <div className="admin-hub-card admin-hub-account">
        <span className="admin-hub-avatar" aria-hidden="true">{name.trim().charAt(0).toUpperCase()}</span>
        <span>
          <strong>{name}</strong>
          <small>{ROLE_LABELS[normalizeRole(user?.admin_role)] || 'Administrator'}</small>
        </span>
      </div>
      {MORE_GROUPS.map(([title, ids]) => {
        const rows = ids.map((id) => row(id)).filter(Boolean);
        return rows.length ? (
          <section key={title}>
            <h2 className="admin-hub-title">{title}</h2>
            <ul className="admin-hub-card">{rows}</ul>
          </section>
        ) : null;
      })}
      <ul className="admin-hub-card">
        <li>
          <button type="button" className="admin-hub-row admin-hub-signout" onClick={logout} data-testid="admin-more-logout">
            <LogOut size={20} aria-hidden="true" />
            <span className="admin-hub-label">Sign out</span>
          </button>
        </li>
      </ul>
    </div>
  );
}
