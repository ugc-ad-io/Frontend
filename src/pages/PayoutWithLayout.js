import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Search, Wallet, Clock, TrendingUp, IndianRupee, ChevronDown, ArrowUpRight, X, Send } from 'lucide-react';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import '../styles/creator-marketplace.css';
import EmptyState from '../components/EmptyState';
import { SkeletonTable } from '../components/Skeleton';
import { apiErrorMessage } from '../utils/apiError';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const MIN_WITHDRAWAL = 500; // must match the backend minimum

const STATUS_MAP = { completed: 'Paid', processing: 'Processing', pending: 'Pending', rejected: 'Disputed' };
const STATUS_TONE = { Paid: 'ok', Processing: 'info', Pending: 'warn', Disputed: 'bad' };

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;

export default function PayoutWithLayout() {
  const [withdrawals, setWithdrawals] = useState([]);
  // Money IN — what brands actually paid this creator. The page used to show only
  // withdrawals (money OUT), so a creator who had been paid but never withdrawn saw
  // an empty table and no way to tell who paid them or how much.
  const [earnings, setEarnings] = useState([]);
  const [tab, setTab] = useState('earnings'); // 'earnings' | 'withdrawals'
  const [overview, setOverview] = useState({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showDrop, setShowDrop] = useState(false);
  const [expandedEarning, setExpandedEarning] = useState(null);

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
      const [hist, ov, rec] = await Promise.all([
        axios.get(`${API}/withdrawal/history`).catch(() => ({ data: [] })),
        axios.get(`${API}/payout/overview`).catch(() => ({ data: {} })),
        axios.get(`${API}/payouts/receipts`).catch(() => ({ data: [] })),
      ]);
      setWithdrawals(hist.data || []);
      setOverview(ov.data || {});
      // Receipts cover both directions; the earnings table only wants money in.
      setEarnings((rec.data || []).filter((r) => r.type === 'earning'));
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
      <div className="cmk-page-head cmk-rise pwl-page-head" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1>Earnings</h1>
          <p>See what each brand paid you, what's still in escrow, and your withdrawals.</p>
        </div>
        <button type="button" className="pwl-req-btn" onClick={() => setShowRequest(true)}>
          <ArrowUpRight size={17} />
          <span className="pwl-req-full">Request Withdrawal</span>
          <span className="pwl-req-short">Withdraw</span>
        </button>
      </div>

      {/* No inline gridTemplateColumns here: .cmk-stats-2l already defaults to 4 columns,
          and an inline style outranks stylesheet media queries — it silently defeated the
          1080px (→2 col) and 540px (→1 col) rules, so phones got four ~80px cards. */}
      <div className="cmk-stats cmk-stats-2l pwl-stats">
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

      {/* Money in vs money out. They answer different questions — "who paid me?" and
          "where did my withdrawals get to?" — and lumping them together is what left
          a paid creator staring at an empty table. */}
      <div className="pwl-tabs">
        <button type="button" className={tab === 'earnings' ? 'on' : ''} onClick={() => setTab('earnings')}>
          Money in {earnings.length > 0 && <span className="pwl-count">{earnings.length}</span>}
        </button>
        <button type="button" className={tab === 'withdrawals' ? 'on' : ''} onClick={() => setTab('withdrawals')}>
          Withdrawals {withdrawals.length > 0 && <span className="pwl-count">{withdrawals.length}</span>}
        </button>
      </div>

      {tab === 'withdrawals' && (
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
      )}

      <div className="cmk-table-card cmk-rise">
        {loading ? (
          <SkeletonTable rows={6} cols={tab === 'earnings' ? 6 : 5} />
        ) : tab === 'earnings' ? (
          earnings.length === 0 ? (
            <EmptyState
              title="No payments yet"
              message="When a brand's payment for a completed deal is released, it shows up here with who paid and how much."
            />
          ) : (
            <>
            <table className="cmk-table pwl-desktop-earnings">
              <thead>
                <tr>
                  <th>From</th><th>Campaign</th><th>Deal amount</th>
                  <th>Platform fee</th><th>You received</th><th>Date</th>
                </tr>
              </thead>
              <tbody>
                {earnings.map((row) => {
                  // Deductions the creator is entitled to see itemised, rather than
                  // wondering why the amount is smaller than the deal.
                  const fees = Number(row.commission_amount || 0)
                    + Number(row.tds_amount || 0)
                    + Number(row.penalty_amount || 0);
                  return (
                    <tr key={row.id}>
                      <td className="cmk-td-strong">{row.brand_name || 'Brand'}</td>
                      <td className="cmk-td-muted">{row.campaign_title || '—'}</td>
                      <td>{inr(row.gross_amount)}</td>
                      <td className="cmk-td-muted">{fees ? `− ${inr(fees)}` : '—'}</td>
                      <td className="cmk-td-strong">{inr(row.net_amount)}</td>
                      <td className="cmk-td-muted">
                        {row.created_at ? new Date(row.created_at).toLocaleDateString('en-IN') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="pwl-mobile-earnings">
              {earnings.map((row) => {
                const fees = Number(row.commission_amount || 0)
                  + Number(row.tds_amount || 0)
                  + Number(row.penalty_amount || 0);
                const open = expandedEarning === row.id;
                return (
                  <article key={row.id} className={`pwl-earning-card ${open ? 'is-open' : ''}`}>
                    <button type="button" className="pwl-earning-summary" onClick={() => setExpandedEarning(open ? null : row.id)} aria-expanded={open}>
                      <span className="pwl-earning-main">
                        <strong>{row.brand_name || 'Brand'}</strong>
                        <small>{row.campaign_title || 'Campaign'}</small>
                      </span>
                      <span className="pwl-earning-net">
                        <small>Received</small>
                        <strong>{inr(row.net_amount)}</strong>
                      </span>
                      <ChevronDown size={17} className="pwl-earning-chevron" />
                    </button>
                    {open && (
                      <div className="pwl-earning-details">
                        <p><span>Deal amount</span><strong>{inr(row.gross_amount)}</strong></p>
                        <p><span>Platform fee</span><strong>{fees ? `− ${inr(fees)}` : '—'}</strong></p>
                        <p><span>You received</span><strong>{inr(row.net_amount)}</strong></p>
                        <p><span>Date</span><strong>{row.created_at ? new Date(row.created_at).toLocaleDateString('en-IN') : '—'}</strong></p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
            </>
          )
        ) : filtered.length === 0 ? (
          <EmptyState title="No withdrawals yet" message="Money you move to your bank or UPI will appear here." />
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
        .pwl-req-short { display: none; }
        .pwl-req-btn:hover { background: #12124f; }
        .pwl-tabs { display: flex; gap: 6px; margin: 18px 0 12px; border-bottom: 1.5px solid #eef2f9; }
        .pwl-tabs button { display: inline-flex; align-items: center; gap: 7px; background: none; border: none; border-bottom: 2px solid transparent; margin-bottom: -1.5px; padding: 10px 14px; font-size: 0.9rem; font-weight: 700; color: #94a3b8; cursor: pointer; }
        .pwl-tabs button:hover { color: #475569; }
        .pwl-tabs button.on { color: #07074e; border-bottom-color: #07074e; }
        .pwl-count { background: #eef2ff; color: #4338ca; border-radius: 999px; padding: 1px 8px; font-size: 0.72rem; font-weight: 700; }
        .pwl-mobile-earnings { display: none; }
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
        @media (max-width: 540px) {
          .pwl-page-head { flex-wrap: nowrap !important; gap: 10px !important; }
          .pwl-page-head > div { flex: 1; min-width: 0; }
          .pwl-page-head .pwl-req-btn { flex: none; padding: 10px 13px; font-size: 0.8rem; }
          .pwl-req-full { display: none; }
          .pwl-req-short { display: inline; }
          .pwl-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
          .pwl-stats .cmk-stat { min-width: 0; padding: 14px; border-radius: 16px; }
          .pwl-stats .cmk-stat-head { align-items: center; gap: 8px; margin-bottom: 14px; }
          .pwl-stats .cmk-stat-head .cmk-ic { width: 38px; height: 38px; border-radius: 11px; }
          .pwl-stats .cmk-stat-head .cmk-ic svg { width: 17px; height: 17px; }
          .pwl-stats .cmk-stat-lbl { min-width: 0; font-size: 12px; line-height: 1.25; }
          .pwl-stats .cmk-stat-row { align-items: flex-start; flex-direction: column; gap: 5px; }
          .pwl-stats .cmk-stat-val { font-size: 21px; white-space: nowrap; }
          .pwl-stats .cmk-stat-meta { min-width: 0; font-size: 10.5px; line-height: 1.25; }
          .pwl-desktop-earnings { display: none; }
          .pwl-mobile-earnings { display: flex; flex-direction: column; }
          .pwl-earning-card + .pwl-earning-card { border-top: 1px solid #eef0f6; }
          .pwl-earning-summary { width: 100%; display: grid; grid-template-columns: minmax(0,1fr) auto 18px; align-items: center; gap: 10px; padding: 14px; border: 0; background: #fff; color: #15163a; text-align: left; cursor: pointer; font-family: inherit; }
          .pwl-earning-main, .pwl-earning-net { min-width: 0; display: flex; flex-direction: column; gap: 3px; }
          .pwl-earning-main strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13.5px; }
          .pwl-earning-main small, .pwl-earning-net small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #9296ba; font-size: 10.5px; }
          .pwl-earning-net { text-align: right; }
          .pwl-earning-net strong { white-space: nowrap; font-size: 14px; }
          .pwl-earning-chevron { color: #7777b7; transition: transform .18s; }
          .pwl-earning-card.is-open .pwl-earning-chevron { transform: rotate(180deg); }
          .pwl-earning-details { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 0 14px 14px; background: #fafaff; }
          .pwl-earning-details p { margin: 0; padding-top: 11px; border-top: 1px solid #eceef7; display: flex; flex-direction: column; gap: 4px; }
          .pwl-earning-details span { color: #9296ba; font-size: 10.5px; }
          .pwl-earning-details strong { color: #15163a; font-size: 12.5px; }
        }
      `}</style>
    </CreatorTopNavLayout>
  );
}
