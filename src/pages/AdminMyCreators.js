import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Users, Search, Eye } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const STATE_LABEL = { pending: 'Pending', more_info: 'More Info', approved: 'Approved', rejected: 'Rejected' };
const avatarColor = (name) => {
  const palette = ['#6366f1', '#3b82f6', '#0ea5e9', '#14b8a6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
  let h = 0; for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
};
const catOf = (u) => {
  const p = u.profile || {};
  return u.category || p.category || p.niche || p.industry || p.industry_category || p.business_type || '—';
};

export default function AdminMyCreators() {
  const [data, setData] = useState({ scoped: false, assigned_categories: [], users: [] });
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${API}/admin/my-assigned`);
        setData(res.data || { scoped: false, assigned_categories: [], users: [] });
      } catch {
        toast.error('Failed to load your assigned creators');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return data.users;
    return data.users.filter((u) => {
      const p = u.profile || {};
      const name = (u.username || u.nickname || p.fullName || p.business_name || '').toLowerCase();
      return name.includes(s) || (u.email || '').toLowerCase().includes(s) || String(catOf(u)).toLowerCase().includes(s);
    });
  }, [data.users, q]);

  return (
    <AdminLayout>
      <div className="amc">
        <div className="amc-bar">
          <div className="amc-cats">
            {data.scoped ? (
              data.assigned_categories.length ? (
                <>
                  <span className="amc-cats-label">Your categories:</span>
                  {data.assigned_categories.map((c) => <span key={c} className="amc-chip">{c}</span>)}
                </>
              ) : (
                <span className="amc-muted">No categories assigned to you yet — ask the founder to assign some on the Team &amp; Roles page.</span>
              )
            ) : (
              <span className="amc-cats-label">You see all creators &amp; brands (Founder / Senior).</span>
            )}
          </div>
          <div className="amc-search">
            <Search size={15} />
            <input placeholder="Search name, email, category…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <p className="amc-muted amc-pad">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="amc-empty">
            <Users size={48} />
            <h3>No creators or brands here yet</h3>
            <p>{data.scoped ? 'Applications in your categories will appear here.' : 'Completed signups will appear here.'}</p>
          </div>
        ) : (
          <div className="amc-table-wrap">
            <table className="amc-table">
              <thead>
                <tr><th>Name</th><th>Type</th><th>Category</th><th>Email</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const p = u.profile || {};
                  const name = u.username ? `@${u.username}` : (u.nickname || p.fullName || p.business_name || '—');
                  const brand = ['business', 'brand'].includes(String(u.role).toLowerCase());
                  return (
                    <tr key={u.id}>
                      <td>
                        <div className="amc-member">
                          <span className="amc-avatar" style={{ background: avatarColor(name) }}>{name.replace(/^@/, '').slice(0, 2).toUpperCase()}</span>
                          <strong>{name}</strong>
                        </div>
                      </td>
                      <td><span className="amc-type">{brand ? 'Brand' : 'Creator'}</span></td>
                      <td>{catOf(u)}</td>
                      <td className="amc-email">{u.email}</td>
                      <td><span className={`amc-state amc-state-${u.approval_status}`}>{STATE_LABEL[u.approval_status] || u.approval_status}</span></td>
                      <td className="amc-actions">
                        <a className="amc-view" href="/dashboard/admin/applications"><Eye size={14} /> Review</a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        .amc { padding: 22px 26px; display: flex; flex-direction: column; gap: 16px; }
        .amc-bar { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .amc-cats { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .amc-cats-label { font-size: 0.82rem; font-weight: 700; color: #5b6573; }
        .amc-chip { background: #eef0ff; color: #3730a3; border-radius: 999px; padding: 3px 10px; font-size: 0.74rem; font-weight: 600; }
        .amc-muted { color: #98a1ad; font-size: 0.86rem; }
        .amc-pad { padding: 14px 2px; }
        .amc-search { display: inline-flex; align-items: center; gap: 8px; border: 1px solid #e6e8ec; border-radius: 9px; padding: 8px 12px; background: #fff; min-width: 240px; }
        .amc-search input { border: 0; outline: 0; font-size: 0.86rem; flex: 1; }
        .amc-table-wrap { border: 1px solid #eef0f4; border-radius: 12px; overflow: hidden; background: #fff; }
        .amc-table { width: 100%; border-collapse: collapse; }
        .amc-table th, .amc-table td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #f1f5f9; font-size: 0.86rem; }
        .amc-table th { background: #f9fafb; font-size: 0.7rem; font-weight: 700; color: #5b6573; text-transform: uppercase; letter-spacing: 0.04em; }
        .amc-table tbody tr:last-child td { border-bottom: 0; }
        .amc-member { display: flex; align-items: center; gap: 10px; }
        .amc-avatar { width: 32px; height: 32px; flex: none; border-radius: 50%; color: #fff; font-weight: 700; display: grid; place-items: center; font-size: 0.78rem; }
        .amc-type { font-size: 0.74rem; font-weight: 700; color: #3730a3; background: #eef0ff; border-radius: 999px; padding: 2px 9px; }
        .amc-email { color: #5b6573; }
        .amc-state { font-size: 0.7rem; font-weight: 700; padding: 3px 9px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.3px; }
        .amc-state-pending { background: #fef3c7; color: #92400e; }
        .amc-state-more_info { background: #dbeafe; color: #1e40af; }
        .amc-state-approved { background: #dcfce7; color: #166534; }
        .amc-state-rejected { background: #fee2e2; color: #991b1b; }
        .amc-actions { text-align: right; }
        .amc-view { display: inline-flex; align-items: center; gap: 5px; border: 1px solid #d6dbff; color: #4452f0; background: #fff; padding: 6px 11px; border-radius: 8px; font-size: 0.78rem; font-weight: 600; text-decoration: none; }
        .amc-view:hover { background: #eef0ff; }
        .amc-empty { text-align: center; padding: 60px 20px; color: #98a1ad; display: flex; flex-direction: column; align-items: center; gap: 10px; background: #fff; border: 1px solid #eef0f4; border-radius: 12px; }
        .amc-empty h3 { margin: 0; color: #334155; font-size: 1rem; }
        .amc-empty p { margin: 0; font-size: 0.86rem; }
      `}</style>
    </AdminLayout>
  );
}
