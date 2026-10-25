import { useRef, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Bell, CheckCheck, CheckCircle2, AlertTriangle, XCircle, Info, MessageCircle, WifiOff } from 'lucide-react';
import AppShell from '../../shell/AppShell';
import { useAuth } from '../../../App';
import { useLiveEffect, publishLiveUpdate } from '../../../lib/liveUpdates';
import { resolveNotifLink } from '../../../utils/notificationLinks';
import { NOTIFICATION_TABS, matchesNotificationTab, notificationAction } from '../../../utils/notificationCategory';
import './notifications.css';

const API = `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api`;
const TONE = { success: CheckCircle2, warning: AlertTriangle, error: XCircle, message: MessageCircle, info: Info };
// Creator wording for the helper's brand-flavoured tab keys.
const CREATOR_LABEL = { campaign: 'Briefs & orders', payment: 'Money', message: 'Messages' };
const BRAND_LABEL = { payment: 'Money' };

export const dayGroup = (iso) => {
  if (!iso) return 'Earlier';
  const d = new Date(iso);
  const day0 = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day0(new Date()) - day0(d)) / 86400000);
  return diff <= 0 ? 'Today' : diff === 1 ? 'Yesterday' : 'Earlier';
};

export const timeAgo = (iso) => {
  const t = new Date(iso).getTime();
  if (!iso || Number.isNaN(t)) return '';
  const mins = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days < 7 ? `${days}d ago` : new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export default function AppNotifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');
  const [busy, setBusy] = useState(false);
  const loadedRef = useRef(false);
  const isBrand = user?.role === 'business';
  const labels = isBrand ? BRAND_LABEL : CREATOR_LABEL;

  const load = async () => {
    try {
      const r = await axios.get(`${API}/notifications/my-notifications`);
      setItems(Array.isArray(r.data) ? r.data : []);
      setError('');
      loadedRef.current = true;
    } catch (e) {
      setError(e?.response ? 'Could not load your notifications.' : "You're offline. Check your connection and try again.");
    } finally { setLoading(false); }
  };
  useLiveEffect(() => { load(); }, []);

  const failMsg = (e) => (e?.response ? 'Could not update your notifications.' : "You're offline. Check your connection and try again.");
  const markRead = async (id) => {
    setItems((list) => list.map((n) => (n.id === id ? { ...n, read: true } : n)));
    try { await axios.patch(`${API}/notifications/${id}/read`); publishLiveUpdate(); } catch (e) { toast.error(failMsg(e)); load(); }
  };
  const markAll = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await axios.post(`${API}/notifications/mark-all-read`);
      setItems((list) => list.map((n) => ({ ...n, read: true })));
      toast.success('All caught up');
      publishLiveUpdate();
    } catch (e) { toast.error(failMsg(e)); } finally { setBusy(false); }
  };
  const open = (n) => {
    if (!n.read) markRead(n.id);
    const to = n.link ? resolveNotifLink(n.link) : null;
    if (to) navigate(to);
  };

  const unread = items.filter((n) => !n.read).length;
  const shown = items.filter((n) => matchesNotificationTab(n, tab));
  const groups = ['Today', 'Yesterday', 'Earlier']
    .map((label) => ({ label, rows: shown.filter((n) => dayGroup(n.created_at) === label) }))
    .filter((g) => g.rows.length);

  return (
    <AppShell back title="Notifications" subtitle={unread > 0 ? `${unread} new` : 'All your updates in one place'}>
      <div className="ap-chips" role="tablist" aria-label="Filter notifications">
        {NOTIFICATION_TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} className={`ap-chip${tab === id ? ' is-on' : ''}`} onClick={() => setTab(id)}>
            {labels[id] || label}
            <span className="ap-nf-cnt">{items.filter((n) => matchesNotificationTab(n, id)).length}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="ap-card" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((i) => <div key={i} className="ap-skel ap-nf-sk" />)}
        </div>
      ) : error && items.length === 0 ? (
        <div className="ap-card ap-empty" role="alert">
          {error.startsWith("You're offline") ? <WifiOff size={34} /> : <Bell size={34} />}
          <h3>{error}</h3>
          <button type="button" className="ap-btn" onClick={() => { setLoading(true); load(); }}>Retry</button>
        </div>
      ) : shown.length === 0 ? (
        <div className="ap-card ap-empty">
          <Bell size={34} />
          <h3>{items.length === 0 ? 'No notifications yet' : tab === 'unread' ? 'You’re all caught up' : 'Nothing here yet'}</h3>
          <p>{items.length === 0
            ? (isBrand ? 'Updates about your campaigns, deals and messages will show up here.' : 'Updates about your briefs, orders and messages will show up here.')
            : tab === 'unread' ? 'Nothing unread right now.' : 'No notifications in this category.'}</p>
          {items.length > 0 && tab !== 'all' && <button type="button" className="ap-btn ap-btn--ghost" onClick={() => setTab('all')}>Show all</button>}
        </div>
      ) : (
        <>
          {error && <div className="ap-card ap-nf-warn" role="alert">{error} Showing what we loaded earlier. <button type="button" className="ap-link" onClick={load}>Retry</button></div>}
          {groups.map((g, gi) => (
            <section key={g.label} className="ap-nf-group">
              <div className="ap-nf-gh">
                <h2>{g.label}</h2>
                {gi === 0 && unread > 0 && (
                  <button type="button" className="ap-link ap-nf-markall" onClick={markAll} disabled={busy}><CheckCheck size={15} /> Mark all read</button>
                )}
              </div>
              <div className="ap-card ap-nf-card">
                {g.rows.map((n) => {
                  const Ic = TONE[n.type] || Info;
                  return (
                    <button key={n.id} type="button" className={`ap-nf-row${!n.read ? ' is-unread' : ''}`} onClick={() => open(n)}>
                      <span className={`ap-nf-ic ap-nf-ic--${TONE[n.type] ? n.type : 'info'}`}><Ic size={19} /></span>
                      <span className="ap-nf-body">
                        <span className="ap-nf-title">
                          {n.title}
                          {n.source === 'admin' && <span className="ap-pill ap-nf-chip">{n.sender_label || 'Admin'}</span>}
                        </span>
                        {n.message ? <span className="ap-nf-text">{n.message}</span> : null}
                        <span className="ap-nf-when">{timeAgo(n.created_at)}</span>
                        {n.link ? <span className={`ap-nf-cta${!n.read ? ' is-primary' : ''}`}>{notificationAction(n)}</span> : null}
                      </span>
                      {!n.read && <span className="ap-nf-dot" aria-label="Unread" />}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      )}
    </AppShell>
  );
}
