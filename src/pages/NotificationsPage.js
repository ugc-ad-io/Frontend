import { resolveNotifLink } from '../utils/notificationLinks';
import { useLiveEffect, publishLiveUpdate } from '../lib/liveUpdates';
import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Bell, Check, Settings } from 'lucide-react';
import { useAuth } from '../App';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import BrandPageHead from '../components/BrandPageHead';
import CreatorPageHead from '../components/CreatorPageHead';
import { NOTIFICATION_TABS, matchesNotificationTab, notificationAction } from '../utils/notificationCategory';
import '../styles/creator-marketplace.css';
import '../styles/brand-ui-pages.css';
import '../styles/brand-ui-notifs.css';
import '../styles/brand-ui-mobile-b.css';
import '../styles/creator-ui-notifs.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const ICON = { success: '✓', warning: '⚠', error: '✕', info: 'ℹ' };

// Today / Yesterday / Earlier bucket for the brand list, from the notification's own timestamp.
const dayGroup = (iso) => {
  if (!iso) return 'Earlier';
  const d = new Date(iso);
  const day0 = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day0(new Date()) - day0(d)) / 86400000);
  return diff <= 0 ? 'Today' : diff === 1 ? 'Yesterday' : 'Earlier';
};

// Creator tab names (the helper's keys are brand-flavoured: campaign / payment / message).
const CREATOR_TAB_LABEL = { campaign: 'Briefs & orders', payment: 'Money' };

// "10m ago" / "2h ago" / "3d ago", then a short date.
const timeAgo = (iso) => {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days < 7 ? `${days}d ago` : new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  // Set when the list could not be loaded, so a failed request is never shown as "No notifications yet".
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all'); // brand view: all | unread | campaign | payment | message

  const load = async () => {
    try {
      const r = await axios.get(`${API}/notifications/my-notifications`);
      setItems(Array.isArray(r.data) ? r.data : []);
      setError('');
    } catch (e) {
      setError(e?.response ? 'Could not load your notifications.' : "You're offline. Check your connection and try again.");
    } finally { setLoading(false); }
  };

  useLiveEffect(() => { load(); }, []);

  // The top-bar bell polls every 15 s on its own; publishLiveUpdate makes it (and this
  // list) refetch now so the badge drops as soon as something is read.
  const failMsg = (e) => (e?.response ? 'Could not update your notifications.' : "You're offline. Check your connection and try again.");
  const markRead = async (id) => {
    try { await axios.patch(`${API}/notifications/${id}/read`); load(); publishLiveUpdate(); } catch (e) { toast.error(failMsg(e)); }
  };
  const markAll = async () => {
    try { await axios.post(`${API}/notifications/mark-all-read`); load(); publishLiveUpdate(); } catch (e) { toast.error(failMsg(e)); }
  };
  const open = (n) => { if (!n.read) markRead(n.id); if (n.link) navigate(resolveNotifLink(n.link)); };

  const unread = items.filter((n) => !n.read).length;
  const isBrand = user?.role === 'business';
  const Layout = isBrand ? BrandTopNavLayout : CreatorTopNavLayout;

  if (isBrand) {
    const shown = items.filter((n) => matchesNotificationTab(n, tab));
    const groups = ['Today', 'Yesterday', 'Earlier']
      .map((label) => ({ label, rows: shown.filter((n) => dayGroup(n.created_at) === label) }))
      .filter((g) => g.rows.length);
    return (
      <Layout>
        <div className="bui-main">
          <BrandPageHead
            title="Notifications"
            subtitle="Everything that needs you, newest first."
            hideSearch
            action={unread > 0 ? (
              <button type="button" className="bui-btn bui-btn--ghost" onClick={markAll}><Check size={16} /> Mark all as read</button>
            ) : null}
          />

          <div className="bui-tabs bui-nf-tabs" role="tablist" aria-label="Filter notifications">
            {NOTIFICATION_TABS.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} className={`bui-tab${tab === id ? ' is-on' : ''}`} onClick={() => setTab(id)}>
                {label} <span>{items.filter((n) => matchesNotificationTab(n, id)).length}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <div className="bui-nf-groups" aria-hidden="true">
              {Array.from({ length: 5 }).map((_, i) => <div className="bui-nf-sk" key={i} />)}
            </div>
          ) : error && items.length === 0 ? (
            <div className="bui-empty" role="alert">
              <h3>{error}</h3>
              <button type="button" className="bui-btn" onClick={() => { setLoading(true); load(); }}>Retry</button>
            </div>
          ) : shown.length === 0 ? (
            <div className="bui-empty">
              <h3>{items.length === 0 ? 'No notifications yet' : tab === 'unread' ? 'You’re all caught up' : 'Nothing here yet'}</h3>
              <p>{items.length === 0 ? 'Updates about your campaigns, deals and messages will show up here.' : tab === 'unread' ? 'Nothing unread right now.' : 'No notifications in this category.'}</p>
            </div>
          ) : (
            <div className="bui-nf-groups">
              {groups.map((g) => (
                <section key={g.label}>
                  <h2 className="bui-nf-gh">{g.label}</h2>
                  <div className="bui-nf-card">
                    {g.rows.map((n) => (
                      <button key={n.id} type="button" className={`bui-nf-row${!n.read ? ' is-unread' : ''}`} onClick={() => open(n)}>
                        <span className={`bui-nf-ic ${n.type || 'info'}`}>{ICON[n.type] || 'ℹ'}</span>
                        <span className="bui-nf-body">
                          <span className="bui-nf-title">
                            {n.title}
                            {n.source === 'admin' && <span className="bui-nf-chip">{n.sender_label || 'Admin'}</span>}
                          </span>
                          <span className="bui-nf-text" style={{ display: 'block' }}>{n.message}</span>
                          <span className="bui-nf-when" style={{ display: 'block' }}>{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</span>
                        </span>
                        {n.link && <span className="bui-nf-cta">{notificationAction(n)}</span>}
                        <span className="bui-nf-dot" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </Layout>
    );
  }

  // Creator view (design board C19): filter pills, day groups, then a card that points to alert settings.
  const shown = items.filter((n) => matchesNotificationTab(n, tab));
  const groups = ['Today', 'Yesterday', 'Earlier']
    .map((label) => ({ label, rows: shown.filter((n) => dayGroup(n.created_at) === label) }))
    .filter((g) => g.rows.length);
  return (
    <Layout>
      <div className="cui-n-page">
        <CreatorPageHead title="Notifications" subtitle={unread > 0 ? `${unread} new` : 'All your updates in one place.'} hideSearch />

        <div className="cui-n-grid">
          <div className="cui-n-card">
            <div className="cui-n-tabs" role="tablist" aria-label="Filter notifications">
              {NOTIFICATION_TABS.map(([id, label]) => (
                <button key={id} type="button" role="tab" aria-selected={tab === id} className={`cui-n-tab${tab === id ? ' is-on' : ''}`} onClick={() => setTab(id)}>
                  {CREATOR_TAB_LABEL[id] || label}
                  <span>{items.filter((n) => matchesNotificationTab(n, id)).length}</span>
                </button>
              ))}
            </div>

            {loading ? (
              <div aria-hidden="true">
                {Array.from({ length: 5 }).map((_, i) => <div className="cui-n-sk" key={i} />)}
              </div>
            ) : error && items.length === 0 ? (
              <div className="cui-n-empty" role="alert">
                <Bell size={36} />
                <p>{error}</p>
                <button type="button" className="cui-btn" onClick={() => { setLoading(true); load(); }}>Retry</button>
              </div>
            ) : shown.length === 0 ? (
              <div className="cui-n-empty">
                <Bell size={36} />
                <p>{items.length === 0 ? 'No notifications yet' : tab === 'unread' ? 'You’re all caught up' : 'Nothing here yet'}</p>
                <small>{items.length === 0 ? 'Updates about your briefs, orders and messages will show up here.' : 'No notifications in this category.'}</small>
              </div>
            ) : (
              groups.map((g, gi) => (
                <section key={g.label} className="cui-n-group">
                  <div className="cui-n-gh">
                    <h2>{g.label}</h2>
                    {gi === 0 && unread > 0 && <button type="button" className="cui-n-markall" onClick={markAll}>Mark all read</button>}
                  </div>
                  {g.rows.map((n) => (
                    <button key={n.id} type="button" className={`cui-n-row${!n.read ? ' is-unread' : ''}`} onClick={() => open(n)}>
                      <span className={`cui-n-ic ${n.type || 'info'}`}>{ICON[n.type] || 'ℹ'}</span>
                      <span className="cui-n-body">
                        <span className="cui-n-title">
                          {n.title}
                          {n.source === 'admin' && <span className="cui-n-chip">{n.sender_label || 'Admin'}</span>}
                        </span>
                        {n.message ? <span className="cui-n-text">{n.message}</span> : null}
                        <span className="cui-n-when">{n.created_at ? timeAgo(n.created_at) : ''}</span>
                        {n.link && <span className="cui-n-cta">{notificationAction(n)}</span>}
                      </span>
                      <span className="cui-n-dot" aria-hidden="true" />
                    </button>
                  ))}
                </section>
              ))
            )}
          </div>

          <aside className="cui-n-card cui-n-side">
            <h2>Alert settings</h2>
            <p>Choose which updates reach you: new brief matches, bid updates, messages, payout alerts and your weekly digest.</p>
            <button type="button" className="cui-btn cui-btn--ghost" onClick={() => navigate('/settings')}><Settings size={16} /> Manage alerts</button>
          </aside>
        </div>
      </div>
    </Layout>
  );
}
