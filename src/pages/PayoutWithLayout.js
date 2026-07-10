import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Search, Wallet, Clock, TrendingUp, IndianRupee, ChevronDown, ArrowUpRight, X, Send } from 'lucide-react';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import '../styles/creator-marketplace.css';
import EmptyState from '../components/EmptyState';
import { apiErrorMessage } from '../utils/apiError';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const MIN_WITHDRAWAL = 500; // must match the backend minimum

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

  // Withdrawal request modal
  const [showRequest, setShowRequest] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('upi'); // 'upi' | 'bank'
  const [upiId, setUpiId] = useState('');
  const [bank, setBank] = useState({ account_holder_name: '', account_number: '', ifsc_code: '' });

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

  const submitWithdrawal = async () => {
    const amt = Number(amount);
    const balance = Number(overview.balance || 0);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (amt < MIN_WITHDRAWAL) { toast.error(`Minimum withdrawal is ${inr(MIN_WITHDRAWAL)}`); return; }
    if (amt > balance) { toast.error('Amount exceeds your available balance'); return; }

    let account_details;
    if (method === 'upi') {
      if (!upiId.trim()) { toast.error('Enter your UPI ID'); return; }
      account_details = { upi_id: upiId.trim() };
    } else {
      if (!bank.account_number.trim() || !bank.ifsc_code.trim()) { toast.error('Enter account number and IFSC'); return; }
      account_details = {
        account_holder_name: bank.account_holder_name.trim(),
        account_number: bank.account_number.trim(),
        ifsc_code: bank.ifsc_code.trim(),
      };
    }

    setSubmitting(true);
    try {
      await axios.post(`${API}/withdrawal/request`, { amount: amt, payment_method: method, account_details });
      toast.success('Withdrawal requested — processing in ~7 business days');
      setShowRequest(false);
      setAmount(''); setUpiId('');
      setBank({ account_holder_name: '', account_number: '', ifsc_code: '' });
      fetchData();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Withdrawal request failed'));
    } finally {
      setSubmitting(false);
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
      <div className="cmk-page-head cmk-rise" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1>Earnings</h1>
          <p>Track your balance, payouts in escrow, and withdrawal history.</p>
        </div>
        <button type="button" className="pwl-req-btn" onClick={() => setShowRequest(true)}>
          <ArrowUpRight size={17} /> Request Withdrawal
        </button>
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

      {showRequest && (
        <div className="pwl-modal-ov" onClick={() => !submitting && setShowRequest(false)}>
          <div className="pwl-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pwl-modal-head">
              <h2>Request Withdrawal</h2>
              <button type="button" onClick={() => setShowRequest(false)} aria-label="Close"><X size={18} /></button>
            </div>
            <p className="pwl-avail">Available balance: <strong>{inr(overview.balance)}</strong></p>

            <label className="pwl-field">
              <span>Amount (₹)</span>
              <input type="number" min={MIN_WITHDRAWAL} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Minimum ${inr(MIN_WITHDRAWAL)}`} />
            </label>

            <div className="pwl-field">
              <span>Payment method</span>
              <div className="pwl-methods">
                {['upi', 'bank'].map((m) => (
                  <button key={m} type="button" className={method === m ? 'on' : ''} onClick={() => setMethod(m)}>
                    {m === 'upi' ? 'UPI' : 'Bank Transfer'}
                  </button>
                ))}
              </div>
            </div>

            {method === 'upi' ? (
              <label className="pwl-field">
                <span>UPI ID</span>
                <input type="text" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="name@bank" />
              </label>
            ) : (
              <>
                <label className="pwl-field">
                  <span>Account holder name</span>
                  <input type="text" value={bank.account_holder_name} onChange={(e) => setBank({ ...bank, account_holder_name: e.target.value })} placeholder="Full name" />
                </label>
                <label className="pwl-field">
                  <span>Account number</span>
                  <input type="text" value={bank.account_number} onChange={(e) => setBank({ ...bank, account_number: e.target.value })} placeholder="Account number" />
                </label>
                <label className="pwl-field">
                  <span>IFSC code</span>
                  <input type="text" value={bank.ifsc_code} onChange={(e) => setBank({ ...bank, ifsc_code: e.target.value.toUpperCase() })} placeholder="e.g. HDFC0001234" />
                </label>
              </>
            )}

            <div className="pwl-modal-actions">
              <button type="button" className="pwl-cancel" onClick={() => setShowRequest(false)} disabled={submitting}>Cancel</button>
              <button type="button" className="pwl-submit" onClick={submitWithdrawal} disabled={submitting}>
                <Send size={16} /> {submitting ? 'Requesting…' : 'Request Withdrawal'}
              </button>
            </div>
            <p className="pwl-note">Payouts are processed in ~7 business days. Wallet credits are non-refundable.</p>
          </div>
        </div>
      )}

      <style>{`
        .pwl-req-btn { display: inline-flex; align-items: center; gap: 8px; background: #07074e; color: #fff; border: none; border-radius: 11px; padding: 11px 18px; font-weight: 600; font-size: 0.9rem; cursor: pointer; box-shadow: 0 10px 22px -12px rgba(7,7,78,0.5); }
        .pwl-req-btn:hover { background: #12124f; }
        .pwl-modal-ov { position: fixed; inset: 0; background: rgba(15,18,40,0.5); backdrop-filter: blur(3px); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 20px; }
        .pwl-modal { background: #fff; width: 100%; max-width: 460px; border-radius: 18px; padding: 24px; box-shadow: 0 30px 70px rgba(7,7,78,0.3); max-height: 90vh; overflow-y: auto; }
        .pwl-modal-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px; }
        .pwl-modal-head h2 { margin: 0; font-size: 1.25rem; color: #07074e; }
        .pwl-modal-head button { border: none; background: #f3f4f8; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: grid; place-items: center; color: #5b6573; }
        .pwl-avail { color: #7777b7; font-size: 0.86rem; margin: 0 0 16px; }
        .pwl-avail strong { color: #07074e; }
        .pwl-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
        .pwl-field > span { font-size: 0.8rem; font-weight: 600; color: #4a4f74; }
        .pwl-field input { border: 1.5px solid #e2e4f0; border-radius: 10px; padding: 11px 13px; font-size: 0.92rem; color: #0f172a; outline: none; }
        .pwl-field input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
        .pwl-methods { display: flex; gap: 10px; }
        .pwl-methods button { flex: 1; border: 1.5px solid #e2e4f0; background: #fff; border-radius: 10px; padding: 10px; font-weight: 600; font-size: 0.88rem; color: #7777b7; cursor: pointer; }
        .pwl-methods button.on { border-color: #6366f1; background: #eef0ff; color: #3730a3; }
        .pwl-modal-actions { display: flex; gap: 10px; margin-top: 6px; }
        .pwl-cancel { flex: 1; border: 1px solid #e2e4f0; background: #fff; color: #7777b7; border-radius: 11px; padding: 12px; font-weight: 600; cursor: pointer; }
        .pwl-submit { flex: 2; display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: none; background: #07074e; color: #fff; border-radius: 11px; padding: 12px; font-weight: 600; cursor: pointer; }
        .pwl-submit:disabled, .pwl-cancel:disabled { opacity: 0.6; cursor: default; }
        .pwl-note { font-size: 0.74rem; color: #9296ba; text-align: center; margin: 14px 0 0; }
      `}</style>
    </CreatorTopNavLayout>
  );
}
