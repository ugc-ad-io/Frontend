import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Bell, Check } from 'lucide-react';
import { useAuth } from '../App';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import { Skeleton } from '../components/Skeleton';
import '../styles/creator-marketplace.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const ICON = { success: '✓', warning: '⚠', error: '✕', info: 'ℹ' };

export default function NotificationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const r = await axios.get(`${API}/notifications/my-notifications`);
      setItems(Array.isArray(r.data) ? r.data : []);
    } catch { /* ignore */ } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const markRead = async (id) => {
    try { await axios.patch(`${API}/notifications/${id}/read`); load(); } catch { /* ignore */ }
  };
  const markAll = async () => {
    try { await axios.post(`${API}/notifications/mark-all-read`); load(); } catch { /* ignore */ }
  };
  const open = (n) => { if (!n.read) markRead(n.id); if (n.link) navigate(n.link); };

  const unread = items.filter((n) => !n.read).length;
  const Layout = user?.role === 'business' ? BrandTopNavLayout : CreatorTopNavLayout;

  return (
    <Layout>
      <div className="cmk-page-head">
        <h1>Notifications</h1>
        <p>All your updates in one place.</p>
      </div>

      <div className="np-wrap">
        <div className="np-bar">
          <span>{unread} unread</span>
          {unread > 0 && (
            <button type="button" className="np-allread" onClick={markAll}><Check size={16} /> Mark all read</button>
          )}
        </div>

        {loading ? (
          <div className="np-list">
            {Array.from({ length: 6 }).map((_, i) => (
              <div className="np-item" key={i} aria-hidden="true">
                {/* 40px round icon + title / message / time — matches .np-item */}
                <Skeleton width={40} height={40} radius="50%" style={{ flex: 'none' }} />
                <span className="np-body">
                  <Skeleton width={`${40 + (i % 3) * 12}%`} height={14} />
                  <Skeleton width="85%" height={12} style={{ marginTop: 4 }} />
                  <Skeleton width={90} height={10} style={{ marginTop: 6 }} />
                </span>
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="cmk-empty"><Bell size={40} /><p>No notifications yet</p></div>
        ) : (
          <div className="np-list">
            {items.map((n) => (
              <button key={n.id} type="button" className={`np-item ${!n.read ? 'unread' : ''}`} onClick={() => open(n)}>
                <span className={`np-ic ${n.type || 'info'}`}>{ICON[n.type] || 'ℹ'}</span>
                <span className="np-body">
                  <strong>
                    {n.title}
                    {n.source === 'admin' && (
                      <span className="np-admin-chip">{n.sender_label || 'Admin'}</span>
                    )}
                  </strong>
                  <span className="np-msg">{n.message}</span>
                  <small>{n.created_at ? new Date(n.created_at).toLocaleString() : ''}</small>
                </span>
                {!n.read && <i className="np-dot" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <style>{`
        /* Widen ONLY the notifications page's content container (self-scoped via
           :has) past the app's default 1320px, so the cards use more of the
           screen and the empty right-hand gap shrinks. Other pages are untouched. */
        .cmk-wrap:has(.np-wrap){max-width:1600px}
        .np-wrap{max-width:none;width:100%;margin-top:6px}
        .np-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;color:var(--muted);font-size:14px;font-weight:600}
        .np-allread{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--line);background:#fff;color:var(--indigo);border-radius:10px;padding:8px 12px;font-weight:700;font-size:13.5px;cursor:pointer}
        .np-allread:hover{border-color:#cdd2f3}
        .np-list{display:flex;flex-direction:column;gap:10px}
        .np-item{display:flex;align-items:flex-start;gap:14px;width:100%;text-align:left;background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px 18px;cursor:pointer;transition:.15s;font-family:inherit;box-shadow:var(--shadow-soft)}
        .np-item:hover{box-shadow:var(--shadow-card);border-color:#dfe2f5}
        .np-item.unread{background:#f6f7ff;border-color:#e3e6ff}
        .np-ic{flex:none;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font-size:17px;background:#eaf1ff;color:#2563eb}
        .np-ic.success{background:#e3f7ec;color:#15a35b}
        .np-ic.warning{background:#fff4e0;color:#d98a16}
        .np-ic.error{background:#fdeaea;color:#e11d48}
        .np-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
        .np-body strong{font-size:15px;color:var(--ink);font-weight:700;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .np-admin-chip{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#4338ca;background:#eef2ff;border:1px solid #dfe4ff;border-radius:999px;padding:2px 8px}
        .np-msg{font-size:13.5px;color:var(--ink-2);line-height:1.45}
        .np-body small{font-size:12px;color:var(--muted);margin-top:2px}
        .np-dot{flex:none;width:9px;height:9px;border-radius:50%;background:#5b6bff;margin-top:6px}
      `}</style>
    </Layout>
  );
}
