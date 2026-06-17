import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { CheckCircle, XCircle, DollarSign, Download } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminWithdrawals() {
  const [pendingWithdrawals, setPendingWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingWithdrawals();
  }, []);

  const fetchPendingWithdrawals = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/withdrawals?status=pending`);
      setPendingWithdrawals(response.data);
    } catch {
      toast.error('Failed to load withdrawals');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await axios.get(`${API}/admin/withdrawals/export`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `withdrawals_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('CSV exported successfully');
    } catch {
      toast.error('Failed to export CSV');
    }
  };

  const handleApprove = async (id) => {
    try {
      await axios.post(`${API}/admin/withdrawals/${id}/approve`);
      toast.success('Withdrawal approved successfully!');
      fetchPendingWithdrawals();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Failed to approve withdrawal'));
    }
  };

  const handleReject = async (id) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;
    try {
      await axios.post(`${API}/admin/withdrawals/${id}/reject?reason=${encodeURIComponent(reason)}`);
      toast.success('Withdrawal rejected and amount refunded to user');
      fetchPendingWithdrawals();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Failed to reject withdrawal'));
    }
  };

  return (
    <AdminLayout>
      <div className="aw-container">
        <div className="aw-header">
          <div>
            <h1><DollarSign size={26} /> Pending Withdrawals</h1>
            <p>Review withdrawal requests and approve or refund</p>
          </div>
          <div className="aw-header-actions">
            <div className="aw-stat">
              <span>Pending</span>
              <strong>{pendingWithdrawals.length}</strong>
            </div>
            <button className="aw-btn aw-btn-export" onClick={handleExport}>
              <Download size={18} /> Export CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="aw-empty">Loading withdrawals...</div>
        ) : pendingWithdrawals.length === 0 ? (
          <div className="aw-empty">
            <CheckCircle size={64} color="#22c55e" />
            <p>No pending withdrawals</p>
            <span>All caught up — new requests will appear here.</span>
          </div>
        ) : (
          <div className="aw-grid">
            {pendingWithdrawals.map(w => (
              <article key={w.id} className="aw-card" data-testid={`withdrawal-${w.id}`}>
                <div className="aw-card-head">
                  <h3>Withdrawal Request</h3>
                  <span className="aw-badge">{w.status}</span>
                </div>
                <div className="aw-card-body">
                  <p><strong>User ID:</strong> {w.user_id}</p>
                  <p><strong>Amount:</strong> ${w.amount?.toFixed(2)}</p>
                  <p><strong>Payment Method:</strong> {w.payment_method}</p>
                  <p><strong>Requested:</strong> {new Date(w.requested_at).toLocaleDateString()}</p>
                </div>
                <div className="aw-card-actions">
                  <button className="aw-btn aw-btn-approve" onClick={() => handleApprove(w.id)} data-testid={`approve-withdrawal-${w.id}`}>
                    <CheckCircle size={18} /> Approve
                  </button>
                  <button className="aw-btn aw-btn-reject" onClick={() => handleReject(w.id)} data-testid={`reject-withdrawal-${w.id}`}>
                    <XCircle size={18} /> Reject
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        .aw-container { padding: 32px 40px; max-width: 1480px; margin: 0 auto; }
        .aw-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 28px; flex-wrap: wrap; }
        .aw-header h1 { display: flex; align-items: center; gap: 12px; font-size: 1.75rem; font-weight: 700; color: #07074e; margin: 0 0 6px; }
        .aw-header h1 :global(svg) { color: #07074e; }
        .aw-header p { color: #718096; margin: 0; font-size: 0.95rem; }
        .aw-header-actions { display: flex; gap: 14px; align-items: center; }
        .aw-stat { background: white; border: 1.5px solid #e8ecff; padding: 14px 22px; border-radius: 14px; display: flex; flex-direction: column; align-items: center; min-width: 110px; }
        .aw-stat span { font-size: 0.75rem; color: #718096; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; }
        .aw-stat strong { font-size: 1.5rem; color: #07074e; margin-top: 4px; }
        .aw-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 80px 24px; background: white; border-radius: 16px; color: #4a5568; text-align: center; }
        .aw-empty p { margin: 0; font-size: 1.1rem; font-weight: 600; color: #1a202c; }
        .aw-empty span { color: #94a3b8; font-size: 0.9rem; }
        .aw-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px; }
        .aw-card { background: white; border: 1.5px solid #e8ecff; border-radius: 16px; padding: 22px; display: flex; flex-direction: column; gap: 16px; transition: all 0.2s ease; }
        .aw-card:hover { border-color: #c5c5e0; box-shadow: 0 4px 16px rgba(7,7,78,0.08); }
        .aw-card-head { display: flex; justify-content: space-between; align-items: center; }
        .aw-card-head h3 { font-size: 1.05rem; font-weight: 700; color: #07074e; margin: 0; }
        .aw-badge { font-size: 0.7rem; font-weight: 700; padding: 4px 10px; border-radius: 999px; background: #fef3c7; color: #92400e; text-transform: uppercase; letter-spacing: 0.04em; }
        .aw-card-body { font-size: 0.85rem; color: #4a5568; line-height: 1.6; }
        .aw-card-body p { margin: 0 0 6px; }
        .aw-card-body strong { color: #1a202c; font-weight: 600; }
        .aw-card-actions { display: flex; gap: 10px; margin-top: auto; }
        .aw-btn { display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 14px; border: none; border-radius: 10px; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: all 0.2s ease; }
        .aw-btn-approve { flex: 1; background: #dcfce7; color: #166534; }
        .aw-btn-approve:hover { background: #bbf7d0; }
        .aw-btn-reject { flex: 1; background: #fee2e2; color: #991b1b; }
        .aw-btn-reject:hover { background: #fecaca; }
        .aw-btn-export { background: #07074e; color: white; }
        .aw-btn-export:hover { background: #1e1e7e; }
        @media (max-width: 720px) {
          .aw-container { padding: 20px; }
          .aw-header { flex-direction: column; align-items: stretch; }
          .aw-header-actions { width: 100%; }
        }
      `}</style>
    </AdminLayout>
  );
}
