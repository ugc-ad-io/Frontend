import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { Download, ScrollText } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const EXPORTS = [
  { kind: 'withdrawals', label: 'Withdrawals CSV', url: '/admin/withdrawals/export' },
];

export default function AdminReports() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = actionFilter ? { action: actionFilter } : {};
      const res = await axios.get(`${API}/admin/audit-logs`, { params });
      setLogs(res.data.logs || []);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to load audit log'));
    } finally {
      setLoading(false);
    }
  }, [actionFilter]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = async (item) => {
    try {
      const res = await axios.get(`${API}${item.url}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${item.kind}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Exported');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Export failed'));
    }
  };

  return (
    <AdminLayout>
      <section className="rep-panel">
        <h3>Exports</h3>
        <div className="rep-exports">
          {EXPORTS.map((e) => (
            <button key={e.kind} onClick={() => exportCsv(e)}><Download size={15} /> {e.label}</button>
          ))}
        </div>
      </section>

      <section className="rep-panel">
        <div className="rep-head">
          <h3><ScrollText size={16} /> Audit Log <span className="rep-count">{logs.length}</span></h3>
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
            <option value="">All actions</option>
            <option value="wallet.adjust">Wallet adjust</option>
            <option value="dispute.ruling">Dispute ruling</option>
            <option value="deal.force_transition">Force transition</option>
            <option value="deal.note_added">Deal note</option>
            <option value="settings.update">Settings update</option>
            <option value="shipping.label_uploaded">Label upload</option>
            <option value="user.banned">User banned</option>
          </select>
        </div>
        {loading ? <p>Loading…</p> : (
          <div className="rep-table">
            <div className="rep-row rep-thead"><span>When</span><span>Admin</span><span>Action</span><span>Target</span><span>Reason</span><span>IP</span></div>
            {logs.map((l) => (
              <div className="rep-row" key={l.id}>
                <span>{(l.created_at || '').slice(0, 16).replace('T', ' ')}</span>
                <span>{l.admin_nickname || l.admin_id?.slice(0, 8)}</span>
                <span className="rep-action">{l.action}</span>
                <span>{l.target_type ? `${l.target_type}:${String(l.target_id || '').slice(0, 8)}` : '—'}</span>
                <span className="rep-reason">{l.reason || '—'}</span>
                <span>{l.ip || '—'}</span>
              </div>
            ))}
            {logs.length === 0 && <div className="rep-empty">No admin actions logged yet.</div>}
          </div>
        )}
      </section>

      <style>{`
        .rep-panel { background:#fff; border:1px solid #ececf1; border-radius:14px; padding:18px; margin-bottom:18px; }
        .rep-panel h3 { margin:0 0 12px; font-size:15px; color:#07074e; display:flex; align-items:center; gap:8px; }
        .rep-count { background:#eef0ff; color:#5b6bff; border-radius:999px; padding:1px 9px; font-size:12px; }
        .rep-exports { display:flex; gap:10px; flex-wrap:wrap; }
        .rep-exports button { display:inline-flex; align-items:center; gap:6px; padding:9px 16px; border:1px solid transparent; border-radius:9px; background:linear-gradient(100deg,#12124f,#07074e); color:#fff; font-weight:600; cursor:pointer; font-size:13px; box-shadow:0 12px 26px -12px rgba(7,7,78,.7); }
        .rep-exports button:hover { transform:translateY(-1px); }
        .rep-head select:focus { outline:none; border-color:#5b6bff; box-shadow:0 0 0 3px rgba(91,107,255,0.16); }
        .rep-head { display:flex; align-items:center; justify-content:space-between; }
        .rep-head select { padding:7px 10px; border:1px solid #e2e4f0; border-radius:8px; }
        .rep-table { display:flex; flex-direction:column; font-size:12.5px; margin-top:8px; }
        .rep-row { display:grid; grid-template-columns:1.1fr 1fr 1.2fr 1.1fr 1.6fr .9fr; gap:8px; padding:9px 6px; border-bottom:1px solid #f2f2f6; align-items:center; }
        .rep-thead { font-weight:700; color:#8a8a93; font-size:11px; text-transform:uppercase; }
        .rep-action { font-family:monospace; color:#5b6bff; }
        .rep-reason { color:#6b6b80; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
        .rep-empty { padding:24px; text-align:center; color:#9a9ab0; }
      `}</style>
    </AdminLayout>
  );
}
