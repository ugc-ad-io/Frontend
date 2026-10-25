import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Shield, Landmark, Smartphone, ChevronDown, WifiOff, AlertCircle, RefreshCw, CheckCircle2, Wallet } from 'lucide-react';
import AppShell from '../../shell/AppShell';
import BottomSheet from '../../shell/BottomSheet';
import { useLiveEffect } from '../../../lib/liveUpdates';
import { apiErrorMessage } from '../../../utils/apiError';
import './earnings.css';

const API = `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api`;
// Must match the backend (server.py MIN_WITHDRAWAL_AMOUNT = 2500); the server publishes its own on /payout/overview.
const DEFAULT_MIN_WITHDRAWAL = 2500;

const STATUS_MAP = { completed: 'Paid', processing: 'Processing', pending: 'Pending', rejected: 'Disputed' };
const STATUS_PILL = { Paid: 'ap-pill--ok', Processing: '', Pending: 'ap-pill--warn', Disputed: 'ap-pill--bad' };
const FILTERS = ['All', 'Paid', 'Processing', 'Pending', 'Disputed'];
const AVA = ['#0F766E', '#2A3AB8', '#9D174D', '#7C3AED', '#B45309', '#0369A1'];

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
const inrShort = (n) => (n >= 100000 ? `₹${(n / 100000).toFixed(1).replace(/\.0$/, '')}L` : n >= 1000 ? `₹${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : inr(n));
const dShort = (v) => (v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '-');
const dFull = (v) => (v ? new Date(v).toLocaleDateString('en-IN') : '-');
const avaColor = (name) => AVA[(String(name || 'B').toUpperCase().charCodeAt(0) || 0) % AVA.length];
const EMPTY_BANK = { account_holder_name: '', account_number: '', ifsc_code: '' };

export default function CreatorEarnings() {
  const navigate = useNavigate();
  const loadedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [overview, setOverview] = useState({});
  const [withdrawals, setWithdrawals] = useState([]);
  const [earnings, setEarnings] = useState([]);
  const [tab, setTab] = useState('earnings'); // 'earnings' | 'withdrawals'
  const [statusFilter, setStatusFilter] = useState('All');
  const [open, setOpen] = useState(null);

  // Withdraw sheet
  const [sheet, setSheet] = useState(false);
  const [step, setStep] = useState('form'); // form | confirm | done
  const [submitting, setSubmitting] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('upi');
  const [upiId, setUpiId] = useState('');
  const [bank, setBank] = useState(EMPTY_BANK);
  const [changeBank, setChangeBank] = useState(false);
  const [sent, setSent] = useState(0);

  const minWithdrawal = Number(overview.min_withdrawal) > 0 ? Number(overview.min_withdrawal) : DEFAULT_MIN_WITHDRAWAL;
  const balance = Number(overview.balance || 0);

  const fetchData = async () => {
    try {
      // A failed call must never read as "Rs 0 / no payments": show an error with Retry instead.
      const [hist, ov, rec] = await Promise.all([
        axios.get(`${API}/withdrawal/history`),
        axios.get(`${API}/payout/overview`),
        axios.get(`${API}/payouts/receipts`),
      ]);
      setWithdrawals(Array.isArray(hist.data) ? hist.data : []);
      setOverview(ov.data || {});
      setEarnings((Array.isArray(rec.data) ? rec.data : []).filter((r) => r.type === 'earning'));
      setLoadError('');
      loadedRef.current = true;
      // Prefill the saved payout account (same source the website uses).
      setUpiId((cur) => cur || ov.data?.upi_id || '');
      const bd = ov.data?.bank_details || {};
      setBank((cur) => (cur.account_number || cur.ifsc_code ? cur : {
        account_holder_name: bd.account_holder_name || '',
        account_number: bd.account_number || '',
        ifsc_code: bd.ifsc_code || '',
      }));
    } catch (error) {
      // Background refreshes keep the numbers on screen; only a first load shows the error.
      if (!loadedRef.current) {
        setLoadError(error?.response
          ? apiErrorMessage(error, 'Could not load your earnings.')
          : "You're offline. Check your connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  };
  useLiveEffect(() => { fetchData(); }, []);

  const retry = () => { setLoading(true); setLoadError(''); fetchData(); };

  // Withdrawing needs verified KYC (the server answers 403 otherwise): send them to /kyc instead of a dead sheet.
  const kycStatus = overview.kyc_status || 'not_submitted';
  const kycBlocked = !loading && !loadError && kycStatus !== 'verified';
  const openWithdraw = () => {
    if (kycBlocked) { toast.error('Verify your KYC before withdrawing.'); navigate('/kyc'); return; }
    setStep('form');
    setSheet(true);
  };
  const closeSheet = () => { if (!submitting) setSheet(false); };

  const bd = overview.bank_details || {};
  const savedAcct = String(bd.account_number || '');
  const savedUpi = overview.upi_id || '';
  const bankSaved = Boolean(savedAcct) && !changeBank && bank.account_number === savedAcct;
  const maskedBank = `Bank ••${(bank.account_number || '').slice(-4)}`;

  // Same checks and messages as the website; returns the account_details to send, or null after a toast.
  const validate = () => {
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error('Enter a valid amount'); return null; }
    if (amt < minWithdrawal) { toast.error(`Minimum withdrawal is ${inr(minWithdrawal)}`); return null; }
    if (amt > balance) { toast.error('Amount exceeds your available balance'); return null; }
    if (method === 'upi') {
      if (!upiId.trim()) { toast.error('Enter your UPI ID'); return null; }
      return { upi_id: upiId.trim() };
    }
    if (!bank.account_number.trim() || !bank.ifsc_code.trim()) { toast.error('Enter account number and IFSC'); return null; }
    return {
      account_holder_name: bank.account_holder_name.trim(),
      account_number: bank.account_number.trim(),
      ifsc_code: bank.ifsc_code.trim(),
    };
  };

  const review = () => { if (validate()) setStep('confirm'); };

  const submit = async () => {
    if (submitting) return;
    const details = validate();
    if (!details) { setStep('form'); return; }
    const amt = Number(amount);
    setSubmitting(true);
    try {
      await axios.post(`${API}/withdrawal/request`, { amount: amt, payment_method: method, account_details: details });
      toast.success('Withdrawal requested - processing in ~7 business days');
      setSent(amt);
      setStep('done');
      setAmount('');
      setChangeBank(false);
      fetchData();
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Withdrawal request failed'));
      setStep('form');
    } finally {
      setSubmitting(false);
    }
  };

  // "Earned per month": what brands paid out (net) over the last 8 months, from the receipts.
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

  const filtered = withdrawals.filter((row) => statusFilter === 'All' || (STATUS_MAP[row.status] || row.status) === statusFilter);

  const kycCopy = kycStatus === 'pending'
    ? ['KYC under review', 'We are checking your documents, usually within 24-48 hours. Withdrawals unlock once it is verified.', 'View status']
    : kycStatus === 'rejected'
      ? ['KYC not approved', overview.kyc_rejection_reason || 'Your documents could not be verified. Please submit them again.', 'Fix and resubmit']
      : ['Verify your identity to withdraw', 'We need your Aadhaar and PAN before we can pay out your earnings.', 'Start verification'];

  return (
    <AppShell title="Earnings" subtitle="Money you've earned and withdrawals" back="/dashboard/creator">
      {loading && (
        <div className="ap-earn-skel" aria-busy="true" aria-label="Loading earnings">
          <div className="ap-skel" style={{ height: 150, borderRadius: 22 }} />
          <div className="ap-earn-stats"><div className="ap-skel" style={{ height: 78, borderRadius: 16 }} /><div className="ap-skel" style={{ height: 78, borderRadius: 16 }} /></div>
          <div className="ap-skel" style={{ height: 180, borderRadius: 20 }} />
          <div className="ap-skel" style={{ height: 240, borderRadius: 20 }} />
        </div>
      )}

      {!loading && loadError && (
        <div className="ap-card ap-empty" role="alert">
          {loadError.startsWith("You're offline") ? <WifiOff size={30} color="#6e6e96" /> : <AlertCircle size={30} color="#e5484d" />}
          <h3>{loadError.startsWith("You're offline") ? "You're offline" : 'Could not load earnings'}</h3>
          <p>{loadError}</p>
          <button type="button" className="ap-btn" onClick={retry}><RefreshCw size={16} /> Retry</button>
        </div>
      )}

      {!loading && !loadError && (
        <>
          {kycBlocked && (
            <div className="ap-earn-kyc" data-testid="kyc-banner">
              <Shield size={20} />
              <div>
                <b>{kycCopy[0]}</b>
                <p>{kycCopy[1]}</p>
                <button type="button" className="ap-btn ap-btn--sm" onClick={() => navigate('/kyc')}>{kycCopy[2]}</button>
              </div>
            </div>
          )}

          <section className="ap-earn-hero">
            <span className="ap-earn-glow" aria-hidden="true" />
            <small>Available to withdraw</small>
            <b>{inr(balance)}</b>
            <em>Minimum withdrawal {inr(minWithdrawal)} · ~7 business days</em>
            <button type="button" className="ap-btn ap-btn--light ap-btn--block" onClick={openWithdraw} data-testid="withdraw-btn">Withdraw</button>
          </section>

          <div className="ap-earn-stats">
            <div className="ap-earn-stat">
              <small>Clearing</small>
              <b>{inr(overview.pending_release)}</b>
              <em>In escrow · paid on approval</em>
            </div>
            <div className="ap-earn-stat">
              <small>All-time earnings</small>
              <b>{inr(overview.all_time_earnings)}</b>
              <em>{inr(overview.paid_this_month)} this month · {overview.deals_paid_this_month ?? 0} deals paid</em>
            </div>
          </div>

          {earnings.length > 0 && (
            <section className="ap-card">
              <div className="ap-earn-h"><b>Earned per month</b><span>Last 8 months · <strong>{inr(monthsSum)}</strong></span></div>
              <div className="ap-earn-bars">
                {months.map((m, i) => (
                  <div key={m.key} className="ap-earn-bar">
                    <span className="ap-earn-bar-v">{m.total > 0 ? inrShort(m.total) : ''}</span>
                    <span className={`ap-earn-bar-b${i === months.length - 1 ? ' is-now' : ''}`} style={{ height: `${m.total > 0 && maxMonth ? Math.max(8, (m.total / maxMonth) * 100) : 3}%` }} />
                    <span className={`ap-earn-bar-l${i === months.length - 1 ? ' is-now' : ''}`}>{m.label}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="ap-card ap-earn-tx">
            <div className="ap-earn-h"><b>Transactions</b></div>
            <div className="ap-earn-seg" role="tablist">
              <button type="button" role="tab" aria-selected={tab === 'earnings'} className={tab === 'earnings' ? 'on' : ''} onClick={() => setTab('earnings')}>Money in{earnings.length > 0 ? ` (${earnings.length})` : ''}</button>
              <button type="button" role="tab" aria-selected={tab === 'withdrawals'} className={tab === 'withdrawals' ? 'on' : ''} onClick={() => setTab('withdrawals')}>Withdrawals{withdrawals.length > 0 ? ` (${withdrawals.length})` : ''}</button>
            </div>

            {tab === 'withdrawals' && withdrawals.length > 0 && (
              <div className="ap-chips ap-earn-chips" role="group" aria-label="Filter by status">
                {FILTERS.map((s) => (
                  <button key={s} type="button" className={`ap-chip${statusFilter === s ? ' is-on' : ''}`} aria-pressed={statusFilter === s} onClick={() => setStatusFilter(s)}>{s === 'All' ? 'All status' : s}</button>
                ))}
              </div>
            )}

            {tab === 'earnings' ? (
              earnings.length === 0 ? (
                <div className="ap-empty">
                  <Wallet size={28} color="#7387ff" />
                  <h3>No payments yet</h3>
                  <p>When a brand's payment for a completed deal is released, it shows up here with who paid and how much.</p>
                  <button type="button" className="ap-btn ap-btn--sm" onClick={() => navigate('/browse-briefs')}>Find briefs</button>
                </div>
              ) : (
                <div>
                  {earnings.map((row) => {
                    const who = row.brand_name || 'Brand';
                    const isOpen = open === row.id;
                    const fees = Number(row.commission_amount || 0) + Number(row.tds_amount || 0) + Number(row.penalty_amount || 0);
                    return (
                      <div key={row.id} className="ap-earn-item">
                        <button type="button" className="ap-earn-row" onClick={() => setOpen(isOpen ? null : row.id)} aria-expanded={isOpen}>
                          <span className="ap-earn-ava" style={{ background: avaColor(who) }}>{who.charAt(0).toUpperCase()}</span>
                          <span className="ap-earn-t"><b>{row.campaign_title || 'Campaign'}</b><small>{who} · {dShort(row.created_at)} <span className="ap-pill ap-pill--ok">Paid</span></small></span>
                          <strong className="ap-earn-in">+{inr(row.net_amount)}</strong>
                          <ChevronDown size={16} className={`ap-earn-chev${isOpen ? ' is-open' : ''}`} />
                        </button>
                        {isOpen && (
                          <div className="ap-earn-det">
                            <p><span>Deal amount</span><strong>{inr(row.gross_amount)}</strong></p>
                            <p><span>Platform fee</span><strong>{Number(row.commission_amount) ? `− ${inr(row.commission_amount)}` : '-'}</strong></p>
                            {Number(row.tds_amount) > 0 && <p><span>TDS</span><strong>{inr(row.tds_amount)}</strong></p>}
                            {Number(row.penalty_amount) > 0 && <p><span>Late delivery penalty</span><strong>{inr(row.penalty_amount)}</strong></p>}
                            {Number(row.revision_credit) > 0 && <p><span>Revision credit</span><strong>{inr(row.revision_credit)}</strong></p>}
                            <p><span>Total deductions</span><strong>{inr(fees)}</strong></p>
                            <p className="is-total"><span>You received</span><strong>{inr(row.net_amount)}</strong></p>
                            <p><span>Date</span><strong>{dFull(row.created_at)}</strong></p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ) : filtered.length === 0 ? (
              <div className="ap-empty">
                <Wallet size={28} color="#7387ff" />
                <h3>{withdrawals.length ? 'Nothing with this status' : 'No withdrawals yet'}</h3>
                <p>{withdrawals.length ? 'Try another status filter.' : 'Money you move to your bank or UPI will appear here.'}</p>
                {!withdrawals.length && <button type="button" className="ap-btn ap-btn--sm" onClick={openWithdraw}>Withdraw</button>}
              </div>
            ) : (
              <div>
                {filtered.map((row) => {
                  const status = STATUS_MAP[row.status] || row.status;
                  const isUpi = row.payment_method === 'upi';
                  return (
                    <div key={row.id} className="ap-earn-item">
                      <div className="ap-earn-row">
                        <span className="ap-earn-ava ap-earn-ava--ic">{isUpi ? <Smartphone size={16} /> : <Landmark size={16} />}</span>
                        <span className="ap-earn-t"><b>Withdrawal to {isUpi ? 'UPI' : 'bank'}</b><small>{dShort(row.requested_at)} · TXN-{String(row.id || '').slice(-4).toUpperCase()} <span className={`ap-pill ${STATUS_PILL[status] ?? 'ap-pill--warn'}`}>{status}</span></small></span>
                        <strong>−{inr(row.amount)}</strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="ap-card ap-earn-pay">
            <div className="ap-earn-h"><b>Payout methods</b></div>
            {savedUpi || savedAcct ? (
              <ul>
                {savedUpi && <li><Smartphone size={17} /><span><b>UPI · {savedUpi}</b><small>Saved account</small></span></li>}
                {savedAcct && <li><Landmark size={17} /><span><b>Bank ••{savedAcct.slice(-4)}</b><small>{bd.ifsc_code || 'Saved account'}</small></span></li>}
              </ul>
            ) : (
              <p className="ap-earn-muted">No payout account saved yet. You add one when you request a withdrawal.</p>
            )}
            <p className="ap-earn-fee">UGC.ad charges a <strong>20% platform fee</strong> on every campaign/brief. It and any TDS are already deducted from each payment.</p>
          </section>
        </>
      )}

      <BottomSheet
        open={sheet}
        onClose={closeSheet}
        title={step === 'done' ? 'Withdrawal requested' : step === 'confirm' ? 'Confirm withdrawal' : 'Withdraw money'}
        subtitle={step === 'form' ? `${inr(balance)} available` : undefined}
        footer={step === 'form' ? (
          <button type="button" className="ap-btn ap-btn--block ap-earn-cta" onClick={review} disabled={submitting}>
            {Number(amount) > 0 ? `Review ${inr(Number(amount))}` : 'Review withdrawal'}
          </button>
        ) : step === 'confirm' ? (
          <>
            <button type="button" className="ap-btn ap-btn--ghost" onClick={() => setStep('form')} disabled={submitting}>Back</button>
            <button type="button" className="ap-btn ap-btn--block ap-earn-cta" onClick={submit} disabled={submitting}>{submitting ? 'Requesting…' : `Withdraw ${inr(Number(amount))}`}</button>
          </>
        ) : (
          <button type="button" className="ap-btn ap-btn--block ap-earn-cta" onClick={() => setSheet(false)}>Done</button>
        )}
      >
        {step === 'form' && (
          <div className="ap-earn-form">
            <label className="ap-label">Amount (₹)
              <span className="ap-earn-amt">
                <span>₹</span>
                <input type="number" inputMode="decimal" min={minWithdrawal} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Min ${minWithdrawal.toLocaleString('en-IN')}`} aria-label="Amount" />
                <button type="button" onClick={() => setAmount(String(Math.floor(balance)))}>Max</button>
              </span>
            </label>

            <div className="ap-label" id="ap-earn-send">Send to</div>
            <div className="ap-earn-methods" role="radiogroup" aria-labelledby="ap-earn-send">
              {['upi', 'bank'].map((m) => (
                <button key={m} type="button" role="radio" aria-checked={method === m} className={method === m ? 'on' : ''} onClick={() => setMethod(m)}>
                  <i aria-hidden="true" />
                  <span>{m === 'upi' ? <Smartphone size={16} /> : <Landmark size={16} />} {m === 'upi' ? 'UPI' : 'Bank transfer'}</span>
                </button>
              ))}
            </div>

            {method === 'upi' ? (
              <label className="ap-label">UPI ID
                <input className="ap-input" type="text" autoCapitalize="none" autoCorrect="off" value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="name@bank" />
              </label>
            ) : bankSaved ? (
              <div className="ap-earn-saved">
                <Landmark size={18} />
                <span><b>{maskedBank}</b><small>{bank.ifsc_code || 'Saved account'}{bank.account_holder_name ? ` · ${bank.account_holder_name}` : ''}</small></span>
                <button type="button" className="ap-link" onClick={() => setChangeBank(true)}>Change</button>
              </div>
            ) : (
              <>
                <label className="ap-label">Account holder name
                  <input className="ap-input" type="text" value={bank.account_holder_name} onChange={(e) => setBank({ ...bank, account_holder_name: e.target.value })} placeholder="Full name" />
                </label>
                <label className="ap-label">Account number
                  <input className="ap-input" type="text" inputMode="numeric" autoComplete="off" value={bank.account_number} onChange={(e) => setBank({ ...bank, account_number: e.target.value })} placeholder="Account number" />
                </label>
                <label className="ap-label">IFSC code
                  <input className="ap-input" type="text" autoCapitalize="characters" value={bank.ifsc_code} onChange={(e) => setBank({ ...bank, ifsc_code: e.target.value.toUpperCase() })} placeholder="e.g. HDFC0001234" />
                </label>
              </>
            )}
            <p className="ap-earn-note">Payouts are processed in ~7 business days. The platform fee and any TDS are already deducted from each payment, so you receive the full amount you request. Wallet credits are non-refundable.</p>
          </div>
        )}

        {step === 'confirm' && (
          <div className="ap-earn-confirm">
            <div className="ap-earn-sum">
              <p><span>Amount</span><strong>{inr(Number(amount))}</strong></p>
              <p><span>To</span><strong>{method === 'upi' ? `UPI · ${upiId.trim()}` : maskedBank}</strong></p>
              <p><span>Processing time</span><strong>~7 business days</strong></p>
              <p className="is-total"><span>You receive</span><strong>{inr(Number(amount))}</strong></p>
            </div>
            <p className="ap-earn-note">Platform fee and any TDS were already taken from each payment. Check the account above is in your name.</p>
          </div>
        )}

        {step === 'done' && (
          <div className="ap-earn-done">
            <CheckCircle2 size={44} color="#1da06a" />
            <h3>{inr(sent)} is on its way</h3>
            <p>Your request is in. It is processed in ~7 business days and shows under Withdrawals.</p>
          </div>
        )}
      </BottomSheet>
    </AppShell>
  );
}
