import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Search, Wallet, Clock, TrendingUp, IndianRupee, ChevronDown } from 'lucide-react';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import '../styles/creator-marketplace.css';
import EmptyState from '../components/EmptyState';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const STATUS_MAP = { completed: 'Paid', processing: 'Processing', pending: 'Pending', rejected: 'Disputed' };
const STATUS_TONE = { Paid: 'ok', Processing: 'info', Pending: 'warn', Disputed: 'bad' };

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function PayoutWithLayout() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [overview, setOverview] = useState({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showDrop, setShowDrop] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [hist, ov] = await Promise.all([
        axios.get(`${API}/withdrawal/history`).catch(() => ({ data: [] })),
        axios.get(`${API}/payout/overview`).catch(() => ({ data: {} })),
      ]);
      setWithdrawals(hist.data || []);
      setOverview(ov.data || {});
    } catch (error) {
      toast.error('Failed to load earnings');
    } finally {
      setLoading(false);
    }
  };

  const filtered = withdrawals.filter((row) => {
    const status = STATUS_MAP[row.status] || row.status;
    const matchStatus = statusFilter === 'All' || status === statusFilter;
    const matchSearch = !search || String(row.id || '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const stats = [
    { lbl: 'Available Balance', val: inr(overview.balance), ic: 'cmk-ic-green', Icon: Wallet, meta: 'Ready to withdraw' },
    { lbl: 'Pending Release', val: inr(overview.pending_release), ic: 'cmk-ic-orange', Icon: Clock, meta: 'In escrow' },
    { lbl: 'Paid This Month', val: inr(overview.paid_this_month), ic: 'cmk-ic-indigo', Icon: IndianRupee, meta: `${overview.deals_paid || 0} deals paid` },
    { lbl: 'All-Time Earnings', val: inr(overview.all_time_earnings), ic: 'cmk-ic-violet', Icon: TrendingUp, meta: 'Lifetime' },
  ];

  return (
    <CreatorTopNavLayout>
      <div className="cmk-page-head cmk-rise">
        <h1>Earnings</h1>
        <p>Track your balance, payouts in escrow, and withdrawal history.</p>
      </div>

      <div className="cmk-stats cmk-stats-2l" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        {stats.map((s) => (
          <div key={s.lbl} className="cmk-stat cmk-rise">
            <div className="cmk-stat-head">
              <div className={`cmk-ic ${s.ic}`}><s.Icon size={20} /></div>
              <div className="cmk-stat-lbl">{s.lbl}</div>
            </div>
            <div className="cmk-stat-row">
              <div className="cmk-stat-val">{s.val}</div>
              <div className="cmk-stat-meta"><span>{s.meta}</span></div>
            </div>
          </div>
        ))}
      </div>

      <div className="cmk-toolbar">
        <div className="cmk-search-inp">
          <Search size={16} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search withdrawal ID…" />
        </div>
        <div style={{ position: 'relative' }}>
          <button type="button" className="cmk-select" onClick={() => setShowDrop((v) => !v)}>
            {statusFilter === 'All' ? 'All Status' : statusFilter} <ChevronDown size={16} />
          </button>
          {showDrop && (
            <div className="cmk-menu" style={{ top: 50, minWidth: 160 }}>
              {['All', 'Paid', 'Processing', 'Pending', 'Disputed'].map((s) => (
                <button key={s} type="button" onClick={() => { setStatusFilter(s); setShowDrop(false); }}>
                  {s === 'All' ? 'All Status' : s}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="cmk-table-card cmk-rise">
        {loading ? (
          <div className="cmk-empty">Loading earnings…</div>
        ) : filtered.length === 0 ? (
          <EmptyState title="No withdrawals yet" message="Your payouts will appear here once your completed deals are paid out." />
        ) : (
          <table className="cmk-table">
            <thead>
              <tr>
                <th>TXN ID</th><th>Amount</th><th>Status</th><th>Date</th><th>Method</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const status = STATUS_MAP[row.status] || row.status;
                return (
                  <tr key={row.id}>
                    <td><span className="cmk-pill info">TXN-{String(row.id || '').slice(-4).toUpperCase()}</span></td>
                    <td className="cmk-td-strong">{inr(row.amount)}</td>
                    <td><span className={`cmk-pill ${STATUS_TONE[status] || 'warn'}`}>{status}</span></td>
                    <td className="cmk-td-muted">{row.requested_at ? new Date(row.requested_at).toLocaleDateString('en-IN') : '—'}</td>
                    <td>{row.payment_method === 'upi' ? 'UPI' : 'Bank Transfer'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </CreatorTopNavLayout>
  );
}
