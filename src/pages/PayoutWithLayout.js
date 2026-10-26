import { useLiveEffect } from '../lib/liveUpdates';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Search, ChevronDown, X, Shield, Landmark, Smartphone, Check } from 'lucide-react';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import CreatorPageHead from '../components/CreatorPageHead';
import EmptyState from '../components/EmptyState';
import { SkeletonTable } from '../components/Skeleton';
import { apiErrorMessage } from '../utils/apiError';
import '../styles/creator-ui-earnings.css';
import '../styles/creator-ui-mobile-money.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
// Must match the backend: server.py MIN_WITHDRAWAL_AMOUNT = 2500. The server answers
// "Minimum withdrawal amount is INR 2,500" below it, so a lower value here only
// let people submit amounts that were guaranteed to fail.
const DEFAULT_MIN_WITHDRAWAL = 2500;

const STATUS_MAP = { completed: 'Paid', processing: 'Processing', pending: 'Pending', rejected: 'Disputed' };
const STATUS_TONE = { Paid: 'ok', Processing: 'info', Pending: 'warn', Disputed: 'bad' };
const AVA = ['#0F766E', '#2A3AB8', '#9D174D', '#7C3AED', '#B45309', '#0369A1'];

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const inrShort = (n) => (n >= 100000 ? `₹${(n / 100000).toFixed(1).replace(/\.0$/, '')}L` : n >= 1000 ? `₹${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : inr(n));
const dShort = (v) => (v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-');
const dFull = (v) => (v ? new Date(v).toLocaleDateString('en-IN') : '-');
const avaColor = (name) => AVA[(String(name || 'B').toUpperCase().charCodeAt(0) || 0) % AVA.length];

export default function PayoutWithLayout() {
  const navigate = useNavigate();
  const [loadError, setLoadError] = useState('');
  const [withdrawals, setWithdrawals] = useState([]);
  // Money IN — what brands actually paid this creator. The page used to show only
  // withdrawals (money OUT), so a creator who had been paid but never withdrawn saw
  // an empty table and no way to tell who paid them or how much.
  const [earnings, setEarnings] = useState([]);
  const [tab, setTab] = useState('earnings'); // 'earnings' | 'withdrawals'
  const [overview, setOverview] = useState({});
  // The server publishes its own minimum; the constant is only the fallback if the overview did not load.
  const minWithdrawal = Number(overview.min_withdrawal) > 0 ? Number(overview.min_withdrawal) : DEFAULT_MIN_WITHDRAWAL;
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

  useLiveEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      // A failed call must not show as "Rs 0 / no payments": show an error with Retry instead.
      const [hist, ov, rec] = await Promise.all([
        axios.get(`${API}/withdrawal/history`),
        axios.get(`${API}/payout/overview`),
        axios.get(`${API}/payouts/receipts`),
      ]);
      setWithdrawals(hist.data || []);
      setOverview(ov.data || {});
      // Receipts cover both directions; the earnings table only wants money in.
      setEarnings((rec.data || []).filter((r) => r.type === 'earning'));
      setLoadError('');
      // Prefill the saved payout account (same source the backend publishes on /payout/overview).
      setUpiId((cur) => cur || ov.data?.upi_id || '');
      const bd = ov.data?.bank_details || {};
      setBank((cur) => (cur.account_number || cur.ifsc_code ? cur : {
        account_holder_name: bd.account_holder_name || '',
        account_number: bd.account_number || '',
        ifsc_code: bd.ifsc_code || '',
      }));
    } catch (error) {
      setLoadError(error?.response
        ? apiErrorMessage(error, 'Could not load your earnings.')
        : "You're offline. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  // Withdrawing needs verified KYC (backend: 403 otherwise). Send the creator to /kyc instead of a dead modal.
  const kycStatus = overview.kyc_status || 'not_submitted';
  const kycBlocked = !loading && !loadError && kycStatus !== 'verified';
  const openRequest = () => {
    if (kycBlocked) { toast.error('Verify your KYC before withdrawing.'); navigate('/kyc'); return; }
    setShowRequest(true);
  };

  const submitWithdrawal = async () => {
    if (submitting) return;
    const amt = Number(amount);
    const balance = Number(overview.balance || 0);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return; }
    if (amt < minWithdrawal) { toast.error(`Minimum withdrawal is ${inr(minWithdrawal)}`); return; }
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
      toast.success('Withdrawal requested - processing in ~7 business days');
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

  // "Earned per month": what brands paid out (net) over the last 8 months, from the receipts above.
  const today = new Date();
  const months = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (7 - i), 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString('en-US', { month: 'short' }), total: 0 };
  });
  earnings.forEach((r) => {
    if (!r.created_at) return;
    const d = new Date(r.created_at);
    const m = months.find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`);
    if (m) m.total += Number(r.net_amount || 0);
  });
  const maxMonth = Math.max(...months.map((m) => m.total), 0);
  const monthsSum = months.reduce((s, m) => s + m.total, 0);

  const bd = overview.bank_details || {};
  const acct = String(bd.account_number || '');
  const savedUpi = overview.upi_id || '';

  return (
    <CreatorTopNavLayout>
      <CreatorPageHead title="Earnings" subtitle="Money you've earned, what's on the way, and withdrawals." hideSearch />

      {loadError && (
        <div className="cui-e-card">
          <EmptyState title="Could not load earnings" message={loadError} action={{ label: 'Retry', onClick: () => { setLoading(true); setLoadError(''); fetchData(); } }} />
        </div>
      )}

      {kycBlocked && (
        <div className="cui-e-kyc" data-testid="kyc-banner">
          <Shield strokeWidth={1.8} size={20} />
          <div>
            <strong>{kycStatus === 'pending' ? 'KYC under review' : kycStatus === 'rejected' ? 'KYC not approved' : 'Verify your identity to withdraw'}</strong>
            <p>{kycStatus === 'pending'
              ? 'We are checking your documents, usually within 24-48 hours. Withdrawals unlock once it is verified.'
              : kycStatus === 'rejected'
                ? (overview.kyc_rejection_reason || 'Your documents could not be verified. Please submit them again.')
                : 'We need your Aadhaar and PAN before we can pay out your earnings.'}</p>
          </div>
          <button type="button" onClick={() => navigate('/kyc')}>
            {kycStatus === 'pending' ? 'View status' : kycStatus === 'rejected' ? 'Fix and resubmit' : 'Start verification'}
          </button>
        </div>
      )}

      {!loadError && (
        <div className="cui-e-stats">
          <div className="cui-e-hero">
            <span className="cui-e-hero-glow" aria-hidden="true" />
            <small>Available to withdraw</small>
            <b>{inr(overview.balance)}</b>
            <em>Minimum withdrawal {inr(minWithdrawal)}</em>
            <button type="button" className="cui-e-hero-btn" onClick={openRequest} disabled={loading} data-testid="withdraw-btn">
              Withdraw
            </button>
          </div>
          <div className="cui-e-stat">
            <small>Clearing</small>
            <b>{inr(overview.pending_release)}</b>
            <em>In escrow · paid on approval</em>
          </div>
          <div className="cui-e-stat">
            <small>All-time earnings</small>
            <b>{inr(overview.all_time_earnings)}</b>
            <em>{inr(overview.paid_this_month)} this month · {overview.deals_paid_this_month ?? 0} deals paid</em>
          </div>
        </div>
      )}

      {!loadError && (
        <div className="cui-e-grid">
          <div className="cui-e-col">
            {!loading && earnings.length > 0 && (
              <section className="cui-e-card cui-e-chart">
                <div className="cui-e-card-h">
                  <h2>Earned per month</h2>
                  <span>Last 8 months · <strong>{inr(monthsSum)}</strong></span>
                </div>
                <div className="cui-e-bars">
                  {months.map((m, i) => (
                    <div key={m.key} className="cui-e-bar">
                      <span className="cui-e-bar-v">{m.total > 0 ? inrShort(m.total) : ''}</span>
                      <span className={`cui-e-bar-b${i === months.length - 1 ? ' is-now' : ''}`} style={{ height: `${m.total > 0 && maxMonth ? Math.max(8, (m.total / maxMonth) * 100) : 3}%` }} />
                      <span className="cui-e-bar-l">{m.label}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Money in vs money out. They answer different questions — "who paid me?" and
                "where did my withdrawals get to?" — and lumping them together is what left
                a paid creator staring at an empty table. */}
            <section className="cui-e-card cui-e-tx">
              <div className="cui-e-card-h">
                <h2>Transactions</h2>
                <div className="cui-e-seg" role="tablist">
                  <button type="button" role="tab" aria-selected={tab === 'earnings'} className={tab === 'earnings' ? 'on' : ''} onClick={() => setTab('earnings')}>
                    Money in {earnings.length > 0 && <i>{earnings.length}</i>}
                  </button>
                  <button type="button" role="tab" aria-selected={tab === 'withdrawals'} className={tab === 'withdrawals' ? 'on' : ''} onClick={() => setTab('withdrawals')}>
                    Withdrawals {withdrawals.length > 0 && <i>{withdrawals.length}</i>}
                  </button>
                </div>
              </div>

              {tab === 'withdrawals' && (
                <div className="cui-e-tools">
                  <label className="cui-e-search">
                    <Search size={16} />
                    <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search withdrawal ID…" aria-label="Search withdrawal ID" />
                  </label>
                  <div className="cui-e-filter">
                    <button type="button" onClick={() => setShowDrop((v) => !v)} aria-expanded={showDrop}>
                      {statusFilter === 'All' ? 'All status' : statusFilter} <ChevronDown size={16} />
                    </button>
                    {showDrop && (
                      <div className="cui-e-menu">
                        {['All', 'Paid', 'Processing', 'Pending', 'Disputed'].map((s) => (
                          <button key={s} type="button" onClick={() => { setStatusFilter(s); setShowDrop(false); }}>
                            {s === 'All' ? 'All status' : s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {loading ? (
                <SkeletonTable rows={6} cols={4} />
              ) : tab === 'earnings' ? (
                earnings.length === 0 ? (
                  <EmptyState
                    title="No payments yet"
                    message="When a brand's payment for a completed deal is released, it shows up here with who paid and how much."
                  />
                ) : (
                  <div className="cui-e-rows">
                    <div className="cui-e-row cui-e-row--head" aria-hidden="true">
                      <span>DATE</span><span>DETAILS</span><span>STATUS</span><span>AMOUNT</span>
                    </div>
                    {earnings.map((row) => {
                      // Deductions the creator is entitled to see itemised, rather than
                      // wondering why the amount is smaller than the deal.
                      const fees = Number(row.commission_amount || 0)
                        + Number(row.tds_amount || 0)
                        + Number(row.penalty_amount || 0);
                      const open = expandedEarning === row.id;
                      const who = row.brand_name || 'Brand';
                      return (
                        <article key={row.id} className={`cui-e-item${open ? ' is-open' : ''}`}>
                          <button type="button" className="cui-e-row cui-e-summary" onClick={() => setExpandedEarning(open ? null : row.id)} aria-expanded={open}>
                            <span className="cui-e-date">{dShort(row.created_at)}</span>
                            <span className="cui-e-who">
                              <i style={{ background: avaColor(who) }}>{who.charAt(0).toUpperCase()}</i>
                              <span><strong>{who}</strong><small>{row.campaign_title || 'Campaign'}</small></span>
                            </span>
                            <span className="cui-e-st"><span className="cui-e-chip ok">Paid</span></span>
                            <span className="cui-e-amt cui-e-amt--in">+{inr(row.net_amount)}<ChevronDown size={16} className="cui-e-chev" /></span>
                          </button>
                          {open && (
                            <div className="cui-e-details">
                              <p><span>Deal amount</span><strong>{inr(row.gross_amount)}</strong></p>
                              <p><span>Platform fee</span><strong>{Number(row.commission_amount) ? `− ${inr(row.commission_amount)}` : '-'}</strong></p>
                              {Number(row.tds_amount) > 0 && <p><span>TDS</span><strong>{inr(row.tds_amount)}</strong></p>}
                              {Number(row.penalty_amount) > 0 && <p><span>Late delivery penalty</span><strong>{inr(row.penalty_amount)}</strong></p>}
                              {Number(row.revision_credit) > 0 && <p><span>Revision credit</span><strong>{inr(row.revision_credit)}</strong></p>}
                              <p><span>You received</span><strong>{inr(row.net_amount)}</strong></p>
                              <p><span>Total deductions</span><strong>{inr(fees)}</strong></p>
                              <p><span>Date</span><strong>{dFull(row.created_at)}</strong></p>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )
              ) : filtered.length === 0 ? (
                <EmptyState title="No withdrawals yet" message="Money you move to your bank or UPI will appear here." />
              ) : (
                <div className="cui-e-rows">
                  <div className="cui-e-row cui-e-row--head" aria-hidden="true">
                    <span>DATE</span><span>DETAILS</span><span>STATUS</span><span>AMOUNT</span>
                  </div>
                  {filtered.map((row) => {
                    const status = STATUS_MAP[row.status] || row.status;
                    const isUpi = row.payment_method === 'upi';
                    return (
                      <article key={row.id} className="cui-e-item">
                        <div className="cui-e-row">
                          <span className="cui-e-date">{dShort(row.requested_at)}</span>
                          <span className="cui-e-who">
                            <i className="cui-e-ico">{isUpi ? <Smartphone size={14} /> : <Landmark size={14} />}</i>
                            <span><strong>Withdrawal to {isUpi ? 'UPI' : 'bank'}</strong><small>TXN-{String(row.id || '').slice(-4).toUpperCase()}</small></span>
                          </span>
                          <span className="cui-e-st"><span className={`cui-e-chip ${STATUS_TONE[status] || 'warn'}`}>{status}</span></span>
                          <span className="cui-e-amt">−{inr(row.amount)}</span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          <aside className="cui-e-card cui-e-side">
            <h2>Withdraw money</h2>
            <dl>
              <div><dt>Available</dt><dd>{inr(overview.balance)}</dd></div>
              <div><dt>Minimum</dt><dd>{inr(minWithdrawal)}</dd></div>
              <div><dt>Processing time</dt><dd>~7 business days</dd></div>
            </dl>
            <h3>Send to</h3>
            <ul className="cui-e-accts">
              {savedUpi && <li><Smartphone size={17} /><span><b>UPI · {savedUpi}</b><small>Saved account</small></span></li>}
              {acct && <li><Landmark size={17} /><span><b>Bank ••{acct.slice(-4)}</b><small>{bd.ifsc_code || 'Saved account'}</small></span></li>}
              {!savedUpi && !acct && <li className="is-empty">No payout account saved yet. You add one when you request a withdrawal.</li>}
            </ul>
            <p className="cui-e-fee">UGC.ad charges a <strong>20% platform fee</strong> on every campaign/brief. It and any TDS are already deducted from each payment.</p>
            <button type="button" className="cui-e-go" onClick={openRequest} disabled={loading}>Request withdrawal</button>
          </aside>
        </div>
      )}

      {showRequest && (
        <div className="cui-e-ov" onClick={() => !submitting && setShowRequest(false)}>
          <div className="cui-e-modal" role="dialog" aria-modal="true" aria-label="Request withdrawal" onClick={(e) => e.stopPropagation()}>
            <span className="cui-e-grab" aria-hidden="true" />
            <div className="cui-e-modal-h">
              <h2>Request withdrawal</h2>
              <button type="button" onClick={() => !submitting && setShowRequest(false)} aria-label="Close"><X size={18} /></button>
            </div>
            <p className="cui-e-avail">Available balance: <strong>{inr(overview.balance)}</strong></p>

            <label className="cui-e-field">
              <span>Amount (₹)</span>
              <span className="cui-e-amtbox">
                <input type="number" inputMode="decimal" min={minWithdrawal} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Minimum ${inr(minWithdrawal)}`} />
                <button type="button" onClick={() => setAmount(String(Math.floor(Number(overview.balance || 0))))}>Max</button>
              </span>
            </label>

            <div className="cui-e-field">
              <span>Send to</span>
              <div className="cui-e-methods" role="radiogroup" aria-label="Payment method">
                {['upi', 'bank'].map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={method === m} className={method === m ? 'on' : ''} onClick={() => setMethod(m)}>
                    <i>{method === m && <Check size={12} strokeWidth={3} />}</i>
                    <span><b>{m === 'upi' ? 'UPI' : 'Bank transfer'}</b></span>
                  </button>
                ))}
              </div>
            </div>

            {method === 'upi' ? (
              <label className="cui-e-field">
                <span>UPI ID</span>
                <input type="text" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="name@bank" />
              </label>
            ) : (
              <>
                <label className="cui-e-field">
                  <span>Account holder name</span>
                  <input type="text" value={bank.account_holder_name} onChange={(e) => setBank({ ...bank, account_holder_name: e.target.value })} placeholder="Full name" />
                </label>
                <label className="cui-e-field">
                  <span>Account number</span>
                  <input type="text" value={bank.account_number} onChange={(e) => setBank({ ...bank, account_number: e.target.value })} placeholder="Account number" />
                </label>
                <label className="cui-e-field">
                  <span>IFSC code</span>
                  <input type="text" value={bank.ifsc_code} onChange={(e) => setBank({ ...bank, ifsc_code: e.target.value.toUpperCase() })} placeholder="e.g. HDFC0001234" />
                </label>
              </>
            )}

            <div className="cui-e-modal-a">
              <button type="button" className="cui-e-cancel" onClick={() => setShowRequest(false)} disabled={submitting}>Cancel</button>
              <button type="button" className="cui-e-submit" onClick={submitWithdrawal} disabled={submitting}>
                {submitting ? 'Requesting…' : 'Request withdrawal'}
              </button>
            </div>
            <p className="cui-e-note">Payouts are processed in ~7 business days. The platform fee and any TDS are already deducted from each payment, so you receive the full amount you request. Wallet credits are non-refundable.</p>
          </div>
        </div>
      )}
    </CreatorTopNavLayout>
  );
}
