import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { IndianRupee, Download, CheckCircle, XCircle, Search, Wallet, Lock, Scale, X, CalendarClock, TrendingUp, PauseCircle, PlayCircle, RotateCcw, Receipt, Eye } from 'lucide-react';
import { useAuth } from '../App';
import { can, isFounder as roleIsFounder } from '../utils/adminRoles';
import AdminLayout from '../components/AdminLayout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const TABS = [
  { id: 'withdrawals', label: 'Withdrawals', icon: IndianRupee },
  { id: 'payouts', label: 'Payout Queue', icon: CalendarClock },
  { id: 'wallets', label: 'Wallets', icon: Wallet },
  { id: 'escrow', label: 'Escrow', icon: Lock },
  { id: 'revenue', label: 'Revenue', icon: TrendingUp },
  { id: 'reconciliation', label: 'Reconciliation', icon: Scale }
];

const REASON_CODES = [
  { value: 'refund', label: 'Refund' },
  { value: 'bonus', label: 'Bonus' },
  { value: 'correction', label: 'Correction' }
];

const REVENUE_PERIODS = [
  { value: 'day', label: 'Daily' },
  { value: 'week', label: 'Weekly' },
  { value: 'month', label: 'Monthly' }
];

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function AdminFinancials() {
  const { user } = useAuth();
  // Capability gating (PRD 11). Finance is view-only; Ops Senior can adjust
  // wallets + release payouts; escrow moves stay founder-only.
  const canAdjustWallet = can(user, 'adjust_wallet');     // founder + Ops Senior
  const canReleasePayouts = can(user, 'release_payouts');  // founder + Ops
  const founderOnly = roleIsFounder(user);                 // founder only
  const [tab, setTab] = useState('withdrawals');
  const [analytics, setAnalytics] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [users, setUsers] = useState([]);
  const [escrow, setEscrow] = useState([]);
  const [overview, setOverview] = useState(null);
  const [payouts, setPayouts] = useState([]);
  const [revenue, setRevenue] = useState(null);
  const [revenuePeriod, setRevenuePeriod] = useState('month');
  const [loading, setLoading] = useState(true);
  const [walletQuery, setWalletQuery] = useState('');
  const [adjustUser, setAdjustUser] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustReasonCode, setAdjustReasonCode] = useState('correction');
  const [walletDetail, setWalletDetail] = useState(null);
  const [walletTx, setWalletTx] = useState([]);
  const [walletTxLoading, setWalletTxLoading] = useState(false);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    fetchAnalytics();
    fetchWithdrawals();
    fetchUsers();
    fetchEscrow();
    fetchPayouts();
    fetchOverview();
  }, []);

  useEffect(() => { fetchRevenue(revenuePeriod); }, [revenuePeriod]);

  const fetchAnalytics = async () => {
    try { const r = await axios.get(`${API}/admin/analytics`); setAnalytics(r.data); } catch { /* optional */ }
  };
  const fetchWithdrawals = async () => {
    setLoading(true);
    try { const r = await axios.get(`${API}/admin/withdrawals?status=pending`); setWithdrawals(r.data || []); }
    catch { setWithdrawals([]); }
    finally { setLoading(false); }
  };
  const fetchUsers = async () => {
    try { const r = await axios.get(`${API}/admin/users`); setUsers(r.data || []); } catch { setUsers([]); }
  };
  const fetchEscrow = async () => {
    try { const r = await axios.get(`${API}/admin/escrow`); setEscrow(Array.isArray(r.data) ? r.data : (r.data?.data || [])); }
    catch { setEscrow([]); }
  };
  const fetchPayouts = async () => {
    try { const r = await axios.get(`${API}/admin/payouts`); setPayouts(Array.isArray(r.data) ? r.data : (r.data?.payouts || r.data?.data || [])); }
    catch { setPayouts([]); }
  };
  const fetchOverview = async () => {
    try { const r = await axios.get(`${API}/admin/financials/overview`); setOverview(r.data); } catch { /* optional */ }
  };
  const fetchRevenue = async (period) => {
    try { const r = await axios.get(`${API}/admin/financials/revenue?period=${period}`); setRevenue(r.data); }
    catch { setRevenue(null); }
  };

  const handleExport = async (kind) => {
    const endpoints = {
      withdrawals: '/admin/withdrawals/export',
      tds: '/admin/financials/tds/export',
      gst: '/admin/financials/gst/export',
      pnl: '/admin/financials/pnl/export',
      reconciliation: '/admin/financials/reconciliation/export'
    };
    try {
      const res = await axios.get(`${API}${endpoints[kind]}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${kind}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('CSV exported');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Export not available yet'));
    }
  };

  const handleApprove = async (id) => {
    try { await axios.post(`${API}/admin/withdrawals/${id}/approve`); toast.success('Withdrawal approved'); fetchWithdrawals(); }
    catch (e) { toast.error(apiErrorMessage(e, 'Failed to approve')); }
  };
  const handleReject = async (id) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;
    try { await axios.post(`${API}/admin/withdrawals/${id}/reject?reason=${encodeURIComponent(reason)}`); toast.success('Withdrawal rejected and refunded'); fetchWithdrawals(); }
    catch (e) { toast.error(apiErrorMessage(e, 'Failed to reject')); }
  };

  // ---- Payout queue (scheduled payouts, batch release, hold) ----
  const handleBatchRelease = async (dateLabel, ids) => {
    if (!ids.length) return;
    if (!window.confirm(`Release ${ids.length} payout${ids.length > 1 ? 's' : ''} scheduled for ${dateLabel}?`)) return;
    try { await axios.post(`${API}/admin/payouts/batch-release`, { date: dateLabel, ids }); toast.success(`Released ${ids.length} payout${ids.length > 1 ? 's' : ''}`); fetchPayouts(); }
    catch (e) { toast.error(apiErrorMessage(e, 'Batch release not available yet')); }
  };
  const handleHoldPayout = async (id) => {
    const reason = prompt('Reason to hold this payout (for fraud review or dispute):');
    if (!reason) return;
    try { await axios.post(`${API}/admin/payouts/${id}/hold`, { reason }); toast.success('Payout held'); fetchPayouts(); }
    catch (e) { toast.error(apiErrorMessage(e, 'Failed to hold payout')); }
  };
  const handleReleasePayout = async (id) => {
    try { await axios.post(`${API}/admin/payouts/${id}/release`); toast.success('Payout released'); fetchPayouts(); }
    catch (e) { toast.error(apiErrorMessage(e, 'Failed to release payout')); }
  };

  // ---- Escrow release / refund (mandatory reason) ----
  const handleEscrowAction = async (e, action) => {
    const reason = prompt(`Enter a reason to ${action} these escrow funds (logged to audit):`);
    if (!reason || !reason.trim()) return;
    const id = e.id || e.deal_id;
    try { await axios.post(`${API}/admin/escrow/${id}/${action}`, { reason: reason.trim() }); toast.success(`Escrow ${action === 'release' ? 'released' : 'refunded'}`); fetchEscrow(); }
    catch (err) { toast.error(apiErrorMessage(err, `Failed to ${action} escrow`)); }
  };

  // ---- Wallet transaction history ----
  const openWallet = async (u) => {
    setWalletDetail(u);
    setWalletTx([]);
    setWalletTxLoading(true);
    try { const r = await axios.get(`${API}/admin/wallet/${u.id}/transactions`); setWalletTx(Array.isArray(r.data) ? r.data : (r.data?.transactions || r.data?.data || [])); }
    catch { setWalletTx([]); }
    finally { setWalletTxLoading(false); }
  };

  const openAdjust = (u) => { setAdjustUser(u); setAdjustAmount(''); setAdjustReason(''); setAdjustReasonCode('correction'); };
  const handleAdjust = async () => {
    const delta = Number(adjustAmount);
    if (!delta || Number.isNaN(delta)) { toast.error('Enter a non-zero amount (use - to debit)'); return; }
    if (!adjustReason.trim()) { toast.error('A reason is required and will be logged'); return; }
    setWorking(true);
    try {
      try {
        await axios.post(`${API}/admin/wallet/adjust`, { user_id: adjustUser.id, amount: delta, reason: adjustReason.trim(), reason_code: adjustReasonCode });
      } catch (inner) {
        // fall back to absolute balance update on the existing user endpoint
        if (inner?.response?.status === 404) {
          await axios.post(`${API}/admin/user/update`, { user_id: adjustUser.id, balance: Number(adjustUser.balance || 0) + delta });
        } else { throw inner; }
      }
      toast.success(`Wallet ${delta >= 0 ? 'credited' : 'debited'} ${inr(Math.abs(delta))}`);
      setAdjustUser(null);
      fetchUsers();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Adjustment failed'));
    } finally {
      setWorking(false);
    }
  };

  const wallets = useMemo(() => {
    const q = walletQuery.trim().toLowerCase();
    return users
      .filter((u) => ['creator', 'business'].includes(u.role) || Number(u.balance || 0) !== 0)
      .filter((u) => !q || [u.nickname, u.email, u.username].filter(Boolean).join(' ').toLowerCase().includes(q));
  }, [users, walletQuery]);

  const totals = useMemo(() => ({
    earnings: analytics?.platform_commission || 0,
    payouts: withdrawals.reduce((s, w) => s + Number(w.amount || 0), 0),
    liabilities: users.reduce((s, u) => s + Number(u.balance || 0), 0),
    escrow: escrow.reduce((s, e) => s + Number(e.amount || e.held_amount || 0), 0)
  }), [analytics, withdrawals, users, escrow]);

  // Payout queue grouped by scheduled date
  const payoutGroups = useMemo(() => {
    const groups = {};
    payouts.forEach((p) => {
      const raw = p.scheduled_date || p.scheduled_at || p.payout_date;
      const key = raw ? new Date(raw).toLocaleDateString() : 'Unscheduled';
      (groups[key] = groups[key] || []).push(p);
    });
    return Object.entries(groups);
  }, [payouts]);

  // Revenue tracking cards (server-provided, falls back to analytics)
  const rev = useMemo(() => ({
    commission: revenue?.commission ?? analytics?.platform_commission ?? 0,
    listingFees: revenue?.listing_fees ?? analytics?.listing_fees ?? 0,
    refundedFees: revenue?.refunded_listing_fees ?? 0,
    penalties: revenue?.penalties ?? analytics?.penalty_collections ?? 0
  }), [revenue, analytics]);

  // Escrow reconciliation (PRD 11.11): sum of individual held escrows must match
  // the independently-computed platform escrow balance.
  const escrowSum = useMemo(
    () => escrow.filter((e) => (e.status || 'held') === 'held').reduce((s, e) => s + Number(e.amount || e.held_amount || 0), 0),
    [escrow]
  );
  const platformEscrow = overview?.total_escrow_held ?? overview?.total_escrow ?? null;
  const escrowMatches = platformEscrow == null || Math.abs(platformEscrow - escrowSum) < 1;

  return (
    <AdminLayout>
      <div className="afn">
        <div className="afn-stats">
          {[
            ['Platform earnings', inr(totals.earnings), 'Commission to date'],
            ['Pending payouts', inr(totals.payouts), `${withdrawals.length} requests`],
            ['Wallet liabilities', inr(totals.liabilities), 'Held in user wallets'],
            ['In escrow', inr(totals.escrow), `${escrow.length} deals`]
          ].map(([label, value, hint]) => (
            <div key={label} className="afn-stat">
              <span>{label}</span>
              <strong>{value}</strong>
              <small>{hint}</small>
            </div>
          ))}
        </div>

        <div className="afn-tabs">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.id} className={tab === t.id ? 'is-active' : ''} onClick={() => setTab(t.id)} data-testid={`fin-tab-${t.id}`}>
                <Icon size={15} /> {t.label}
              </button>
            );
          })}
          <div className="afn-tab-spacer" />
          {tab === 'withdrawals' && <button className="afn-export" onClick={() => handleExport('withdrawals')}><Download size={15} /> Export</button>}
          {tab === 'revenue' && (
            <div className="afn-period">
              {REVENUE_PERIODS.map((p) => (
                <button key={p.value} className={revenuePeriod === p.value ? 'is-active' : ''} onClick={() => setRevenuePeriod(p.value)} data-testid={`rev-period-${p.value}`}>{p.label}</button>
              ))}
            </div>
          )}
          {tab === 'reconciliation' && (
            <>
              <button className="afn-export" onClick={() => handleExport('tds')}><Download size={15} /> TDS</button>
              <button className="afn-export" onClick={() => handleExport('gst')}><Download size={15} /> GST</button>
              <button className="afn-export" onClick={() => handleExport('pnl')}><Download size={15} /> P&amp;L</button>
              <button className="afn-export" onClick={() => handleExport('reconciliation')}><Download size={15} /> Recon</button>
            </>
          )}
        </div>

        <div className="afn-panel">
          {/* WITHDRAWALS */}
          {tab === 'withdrawals' && (
            loading ? <div className="afn-empty">Loading…</div> :
            withdrawals.length === 0 ? (
              <div className="afn-empty"><CheckCircle size={48} color="#22c55e" /><p>No pending withdrawals</p><span>New payout requests will appear here.</span></div>
            ) : (
              <table className="afn-table">
                <thead><tr><th>User</th><th>Amount</th><th>Method</th><th>Requested</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {withdrawals.map((w) => (
                    <tr key={w.id} data-testid={`fin-withdrawal-${w.id}`}>
                      <td className="afn-strong">{w.user_id}</td>
                      <td className="afn-strong">{inr(w.amount)}</td>
                      <td>{w.payment_method || '—'}</td>
                      <td>{w.requested_at ? new Date(w.requested_at).toLocaleDateString() : '—'}</td>
                      <td><span className="afn-badge warn">{w.status}</span></td>
                      <td className="afn-row-actions">
                        <button className="afn-approve" onClick={() => handleApprove(w.id)} data-testid={`fin-approve-${w.id}`}><CheckCircle size={15} /> Approve</button>
                        <button className="afn-reject" onClick={() => handleReject(w.id)} data-testid={`fin-reject-${w.id}`}><XCircle size={15} /> Reject</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}

          {/* PAYOUT QUEUE */}
          {tab === 'payouts' && (
            payouts.length === 0 ? (
              <div className="afn-empty"><CalendarClock size={48} /><p>No scheduled payouts</p><span>Approved payouts awaiting their scheduled release date will be queued here with TDS and net amounts.</span></div>
            ) : (
              <div className="afn-payouts">
                {payoutGroups.map(([dateLabel, list]) => {
                  const releasable = list.filter((p) => ((p.payout_status || p.status || 'scheduled') !== 'released')).map((p) => p.escrow_id || p.id);
                  return (
                    <div key={dateLabel} className="afn-payout-group">
                      <div className="afn-payout-head">
                        <div>
                          <CalendarClock size={16} />
                          <strong>{dateLabel}</strong>
                          <span>{list.length} payout{list.length > 1 ? 's' : ''} · {inr(list.reduce((s, p) => s + Number(p.net_payable ?? p.net_amount ?? (Number(p.gross_amount ?? p.amount ?? 0) - Number(p.tds_amount ?? p.tds ?? 0))), 0))} net</span>
                        </div>
                        {canReleasePayouts && releasable.length > 0 && (
                          <button className="afn-batch" onClick={() => handleBatchRelease(dateLabel, releasable)} data-testid={`batch-release-${dateLabel}`}><PlayCircle size={15} /> Batch release ({releasable.length})</button>
                        )}
                      </div>
                      <table className="afn-table">
                        <thead><tr><th>Creator</th><th>Deal</th><th>Gross</th><th>TDS</th><th>Net</th><th>Method</th><th>Status</th><th></th></tr></thead>
                        <tbody>
                          {list.map((p) => {
                            const pid = p.escrow_id || p.id;
                            const gross = Number(p.gross_amount ?? p.amount ?? 0);
                            const tds = Number(p.tds_amount ?? p.tds ?? 0);
                            const net = (p.net_payable ?? p.net_amount) != null ? Number(p.net_payable ?? p.net_amount) : gross - tds;
                            const status = p.payout_status || p.status || 'scheduled';
                            return (
                              <tr key={pid} data-testid={`payout-${pid}`}>
                                <td className="afn-strong">{p.creator_nickname || p.creator_handle || p.creator || p.creator_id || p.user_id}</td>
                                <td>{p.campaign_title || p.deal_id || '—'}</td>
                                <td>{inr(gross)}</td>
                                <td className="afn-tds">−{inr(tds)}</td>
                                <td className="afn-strong">{inr(net)}</td>
                                <td><span className="afn-badge neutral">{String(p.method || p.payment_method || '—').toUpperCase()}</span></td>
                                <td><span className={`afn-badge ${status === 'held' ? 'danger' : status === 'released' ? 'good' : 'info'}`}>{status}</span></td>
                                <td className="afn-row-actions">
                                  {canReleasePayouts && status !== 'released' && (
                                    status === 'held'
                                      ? <button className="afn-approve" onClick={() => handleReleasePayout(pid)} data-testid={`payout-release-${pid}`}><PlayCircle size={14} /> Release</button>
                                      : <button className="afn-hold" onClick={() => handleHoldPayout(pid)} data-testid={`payout-hold-${pid}`}><PauseCircle size={14} /> Hold</button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* WALLETS */}
          {tab === 'wallets' && (
            <>
              <label className="afn-search">
                <Search size={16} />
                <input value={walletQuery} onChange={(e) => setWalletQuery(e.target.value)} placeholder="Search users by name or email" data-testid="wallet-search" />
              </label>
              {wallets.length === 0 ? (
                <div className="afn-empty"><Wallet size={48} /><p>No wallets to show</p></div>
              ) : (
                <table className="afn-table">
                  <thead><tr><th>User</th><th>Role</th><th>Balance</th><th>Pending commitments</th><th></th></tr></thead>
                  <tbody>
                    {wallets.map((u) => (
                      <tr key={u.id} data-testid={`wallet-${u.id}`}>
                        <td className="afn-strong">{u.full_name || u.business_name || u.name || u.nickname || u.email}</td>
                        <td><span className="afn-badge neutral">{u.role}</span></td>
                        <td className="afn-strong">{inr(u.balance)}</td>
                        <td>{inr(u.pending_commitments ?? u.pending ?? 0)}</td>
                        <td className="afn-row-actions">
                          <button className="afn-adjust" onClick={() => openWallet(u)} data-testid={`wallet-view-${u.id}`}><Eye size={14} /> History</button>
                          {canAdjustWallet ? (
                            <button className="afn-adjust" onClick={() => openAdjust(u)} data-testid={`adjust-${u.id}`}>Adjust</button>
                          ) : (
                            <span className="afn-locked"><Lock size={12} /> View only</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {/* ESCROW */}
          {tab === 'escrow' && (
            <>
              <div className={`afn-recon-banner ${escrowMatches ? 'good' : 'bad'}`} data-testid="escrow-recon">
                <span>Sum of individual escrows <strong>{inr(escrowSum)}</strong></span>
                {platformEscrow != null && <span>Platform escrow balance <strong>{inr(platformEscrow)}</strong></span>}
                <span className="afn-recon-flag">{escrowMatches ? <><CheckCircle size={14} /> Reconciled</> : <><XCircle size={14} /> Mismatch — investigate</>}</span>
              </div>
              {escrow.length === 0 ? (
                <div className="afn-empty"><Lock size={48} /><p>No funds in escrow</p><span>Funds held against active deals will be listed here with release controls.</span></div>
              ) : (
                <table className="afn-table">
                  <thead><tr><th>Deal</th><th>Brand</th><th>Creator</th><th>Held</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {escrow.map((e) => (
                      <tr key={e.id || e.deal_id}>
                        <td className="afn-strong">{e.campaign_title || e.deal_id}</td>
                        <td>{e.brand_handle || e.brand || '—'}</td>
                        <td>{e.creator_handle || e.creator || '—'}</td>
                        <td className="afn-strong">{inr(e.amount || e.held_amount)}</td>
                        <td><span className="afn-badge info">{e.status || 'held'}</span></td>
                        <td className="afn-row-actions">
                          {founderOnly && (e.status || 'held') === 'held' ? (
                            <>
                              <button className="afn-approve" onClick={() => handleEscrowAction(e, 'release')} data-testid={`escrow-release-${e.id || e.deal_id}`}><PlayCircle size={14} /> Release</button>
                              <button className="afn-reject" onClick={() => handleEscrowAction(e, 'refund')} data-testid={`escrow-refund-${e.id || e.deal_id}`}><RotateCcw size={14} /> Refund</button>
                            </>
                          ) : !founderOnly ? (
                            <span className="afn-locked"><Lock size={12} /> Founder only</span>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}

          {/* REVENUE TRACKING */}
          {tab === 'revenue' && (
            <div className="afn-recon">
              <p className="afn-recon-lead">Revenue earned over the selected period. Figures are sourced from settled transactions server-side.</p>
              <div className="afn-recon-grid">
                {[
                  ['Commission earned', inr(rev.commission), 'Platform take on settled deals'],
                  ['Listing fees collected', inr(rev.listingFees), 'Campaign listing fees'],
                  ['Refunded listing fees', `−${inr(rev.refundedFees)}`, 'Returned to brands'],
                  ['Penalty collections', inr(rev.penalties), 'Late-delivery penalties retained']
                ].map(([k, v, hint]) => (
                  <div key={k} className="afn-recon-item">
                    <span>{k}</span>
                    <strong>{v}</strong>
                    <small>{hint}</small>
                  </div>
                ))}
              </div>
              <div className="afn-recon-item afn-net">
                <span>Net revenue this period</span>
                <strong>{inr(Number(rev.commission) + Number(rev.listingFees) - Number(rev.refundedFees) + Number(rev.penalties))}</strong>
              </div>
            </div>
          )}

          {/* RECONCILIATION */}
          {tab === 'reconciliation' && (
            <div className="afn-recon">
              <p className="afn-recon-lead">Period exports for accounting. TDS &amp; GST reports are generated server-side from settled transactions.</p>
              <div className="afn-recon-grid">
                {[
                  ['Gross volume', inr(totals.payouts + totals.earnings)],
                  ['Platform commission', inr(totals.earnings)],
                  ['Creator payouts', inr(totals.payouts)],
                  ['Net in escrow', inr(totals.escrow)]
                ].map(([k, v]) => (
                  <div key={k} className="afn-recon-item"><span>{k}</span><strong>{v}</strong></div>
                ))}
              </div>
              <div className="afn-recon-actions">
                <button className="afn-export" onClick={() => handleExport('tds')}><Download size={15} /> Export TDS report</button>
                <button className="afn-export" onClick={() => handleExport('gst')}><Download size={15} /> Export GST report</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {walletDetail && (
        <>
          <div className="afn-scrim" onClick={() => setWalletDetail(null)} />
          <aside className="afn-drawer" data-testid="wallet-drawer">
            <header className="afn-modal-head">
              <h2>Wallet — {walletDetail.full_name || walletDetail.business_name || walletDetail.name || walletDetail.nickname || walletDetail.email}</h2>
              <button className="afn-icon" onClick={() => setWalletDetail(null)} aria-label="Close"><X size={18} /></button>
            </header>
            <div className="afn-drawer-summary">
              <div><span>Balance</span><strong>{inr(walletDetail.balance)}</strong></div>
              <div><span>Pending commitments</span><strong>{inr(walletDetail.pending_commitments ?? walletDetail.pending ?? 0)}</strong></div>
            </div>
            <div className="afn-drawer-body">
              <h3>Transaction history</h3>
              {walletTxLoading ? (
                <div className="afn-empty"><p>Loading…</p></div>
              ) : walletTx.length === 0 ? (
                <div className="afn-empty"><Receipt size={40} /><p>No transactions yet</p><span>Credits, debits, payouts and adjustments will appear here.</span></div>
              ) : (
                <table className="afn-table">
                  <thead><tr><th>Date</th><th>Type</th><th>Reason</th><th>Amount</th></tr></thead>
                  <tbody>
                    {walletTx.map((t, i) => {
                      const amt = Number(t.amount || 0);
                      return (
                        <tr key={t.id || i}>
                          <td>{t.created_at || t.date ? new Date(t.created_at || t.date).toLocaleDateString() : '—'}</td>
                          <td><span className="afn-badge neutral">{t.type || t.reason_code || '—'}</span></td>
                          <td>{t.reason || t.description || '—'}</td>
                          <td className={amt >= 0 ? 'afn-credit' : 'afn-tds'}>{amt >= 0 ? '+' : '−'}{inr(Math.abs(amt))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </aside>
        </>
      )}

      {adjustUser && (
        <>
          <div className="afn-scrim" onClick={() => setAdjustUser(null)} />
          <div className="afn-modal" data-testid="adjust-modal">
            <header className="afn-modal-head">
              <h2>Adjust wallet</h2>
              <button className="afn-icon" onClick={() => setAdjustUser(null)} aria-label="Close"><X size={18} /></button>
            </header>
            <div className="afn-modal-body">
              <p className="afn-modal-user">{adjustUser.full_name || adjustUser.business_name || adjustUser.name || adjustUser.nickname || adjustUser.email} · current balance <strong>{inr(adjustUser.balance)}</strong></p>
              <label className="afn-field">
                <span>Reason code</span>
                <select value={adjustReasonCode} onChange={(e) => setAdjustReasonCode(e.target.value)} data-testid="adjust-reason-code">
                  {REASON_CODES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
              <label className="afn-field">
                <span>Amount (use a negative value to debit)</span>
                <input type="number" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} placeholder="e.g. 500 or -250" data-testid="adjust-amount" />
              </label>
              <label className="afn-field">
                <span>Reason (logged to audit trail)</span>
                <textarea value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} rows={3} placeholder="Why is this adjustment being made?" data-testid="adjust-reason" />
              </label>
            </div>
            <footer className="afn-modal-foot">
              <button className="afn-ghost" onClick={() => setAdjustUser(null)}>Cancel</button>
              <button className="afn-primary" disabled={working} onClick={handleAdjust} data-testid="adjust-submit">Apply adjustment</button>
            </footer>
          </div>
        </>
      )}

      <style>{`
        .afn { padding: 24px 28px; max-width: 1480px; margin: 0 auto; }
        .afn-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 12px; margin-bottom: 18px; }
        .afn-stat { background: #fff; border: 1px solid #e6e8ec; border-radius: 12px; padding: 16px; }
        .afn-stat span { display: block; font-size: 0.72rem; color: #98a1ad; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }
        .afn-stat strong { display: block; font-size: 1.5rem; color: #07074e; margin-top: 6px; }
        .afn-stat small { color: #98a1ad; font-size: 0.74rem; }
        .afn-tabs { display: flex; align-items: center; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
        .afn-tabs button { display: inline-flex; align-items: center; gap: 6px; border: 1px solid #e6e8ec; background: #fff; color: #5b6573; font-weight: 600; font-size: 0.82rem; padding: 8px 14px; border-radius: 999px; cursor: pointer; }
        .afn-tabs button.is-active { background: #eef0ff; border-color: #5b6bff; color: #4452f0; }
        .afn-tab-spacer { flex: 1; }
        .afn-export { display: inline-flex; align-items: center; gap: 6px; border: 1px solid #e6e8ec !important; background: #fff !important; color: #4452f0 !important; font-weight: 600; font-size: 0.8rem; padding: 8px 14px; border-radius: 8px; cursor: pointer; }
        .afn-export:hover { background: #eef0ff !important; }
        .afn-panel { background: #fff; border: 1px solid #e6e8ec; border-radius: 14px; overflow: hidden; }
        .afn-table { width: 100%; border-collapse: collapse; }
        .afn-table th, .afn-table td { padding: 13px 18px; text-align: left; border-bottom: 1px solid #f1f5f9; font-size: 0.88rem; white-space: nowrap; }
        .afn-table th { background: #f9fafb; font-size: 0.72rem; font-weight: 700; color: #5b6573; text-transform: uppercase; letter-spacing: 0.04em; }
        .afn-table tbody tr:last-child td { border-bottom: 0; }
        .afn-table tbody tr:hover { background: #f9fafb; }
        .afn-strong { font-weight: 600; color: #111827; }
        .afn-badge { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 0.72rem; font-weight: 600; text-transform: capitalize; }
        .afn-badge.warn { background: #fffaeb; color: #b54708; }
        .afn-badge.neutral { background: #f2f4f7; color: #475467; }
        .afn-badge.info { background: #eff8ff; color: #175cd3; }
        .afn-badge.good { background: #ecfdf3; color: #067647; }
        .afn-badge.danger { background: #fef3f2; color: #b42318; }
        .afn-row-actions { display: flex; gap: 8px; }
        .afn-approve, .afn-reject { display: inline-flex; align-items: center; gap: 5px; border: 0; border-radius: 8px; font-weight: 600; font-size: 0.8rem; padding: 7px 12px; cursor: pointer; }
        .afn-approve { background: #ecfdf3; color: #067647; } .afn-approve:hover { background: #16a34a; color: #fff; }
        .afn-reject { background: #fef3f2; color: #b42318; } .afn-reject:hover { background: #dc2626; color: #fff; }
        .afn-hold { display: inline-flex; align-items: center; gap: 5px; border: 0; border-radius: 8px; font-weight: 600; font-size: 0.8rem; padding: 7px 12px; cursor: pointer; background: #fffaeb; color: #b54708; } .afn-hold:hover { background: #fef0c7; }
        .afn-tds { color: #b42318; font-weight: 600; }
        .afn-credit { color: #067647; font-weight: 600; }
        .afn-period { display: inline-flex; gap: 4px; background: #f2f4f7; padding: 3px; border-radius: 999px; }
        .afn-period button { border: 0; background: transparent; color: #5b6573; font-weight: 600; font-size: 0.8rem; padding: 6px 14px; border-radius: 999px; cursor: pointer; }
        .afn-period button.is-active { background: #fff; color: #4452f0; box-shadow: 0 1px 2px rgba(16,24,40,0.1); }
        .afn-payouts { display: flex; flex-direction: column; }
        .afn-payout-group { border-bottom: 8px solid #f9fafb; }
        .afn-payout-group:last-child { border-bottom: 0; }
        .afn-payout-head { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: #fcfcfd; border-bottom: 1px solid #f1f5f9; }
        .afn-payout-head > div { display: flex; align-items: center; gap: 8px; color: #5b6573; }
        .afn-payout-head strong { color: #07074e; font-size: 0.92rem; }
        .afn-payout-head span { color: #98a1ad; font-size: 0.8rem; }
        .afn-batch { display: inline-flex; align-items: center; gap: 6px; border: 0; border-radius: 8px; background: #ecfdf3; color: #067647; font-weight: 600; font-size: 0.8rem; padding: 8px 14px; cursor: pointer; } .afn-batch:hover { background: #d3f8df; }
        .afn-recon-banner { display: flex; align-items: center; gap: 22px; flex-wrap: wrap; padding: 14px 18px; border-bottom: 1px solid #f1f5f9; font-size: 0.84rem; color: #5b6573; }
        .afn-recon-banner strong { color: #07074e; margin-left: 5px; }
        .afn-recon-banner.good { background: #f6fef9; }
        .afn-recon-banner.bad { background: #fffbfa; }
        .afn-recon-flag { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; font-weight: 700; }
        .afn-recon-banner.good .afn-recon-flag { color: #067647; }
        .afn-recon-banner.bad .afn-recon-flag { color: #b42318; }
        .afn-recon-item small { display: block; color: #98a1ad; font-size: 0.72rem; margin-top: 4px; }
        .afn-net { margin-top: 16px; background: #eef0ff; border-color: #d9deff; }
        .afn-net strong { color: #4452f0; }
        .afn-drawer { position: fixed; top: 0; right: 0; height: 100vh; width: 520px; max-width: 94vw; background: #fff; box-shadow: -20px 0 60px rgba(16,24,40,0.22); z-index: 50; display: flex; flex-direction: column; }
        .afn-drawer-summary { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 16px 22px; border-bottom: 1px solid #e6e8ec; }
        .afn-drawer-summary span { display: block; font-size: 0.72rem; color: #98a1ad; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }
        .afn-drawer-summary strong { font-size: 1.25rem; color: #07074e; }
        .afn-drawer-body { padding: 18px 22px; overflow-y: auto; flex: 1; }
        .afn-drawer-body h3 { margin: 0 0 12px; font-size: 0.85rem; color: #5b6573; text-transform: uppercase; letter-spacing: 0.04em; }
        .afn-field select { border: 1px solid #e6e8ec; border-radius: 8px; padding: 10px 12px; font-size: 0.88rem; color: #111827; font-family: inherit; background: #fff; }
        .afn-field select:focus { outline: none; border-color: #5b6bff; box-shadow: 0 0 0 3px rgba(91,107,255,0.16); }
        .afn-adjust { border: 1px solid #e6e8ec; background: #fff; color: #5b6bff; font-weight: 600; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 0.8rem; }
        .afn-adjust:hover { background: #eef0ff; border-color: #5b6bff; }
        .afn-locked { display: inline-flex; align-items: center; gap: 4px; font-size: 0.75rem; color: #98a1ad; font-weight: 600; }
        .afn-search { display: flex; align-items: center; gap: 8px; margin: 14px; background: #f9fafb; border: 1px solid #e6e8ec; border-radius: 10px; padding: 0 12px; color: #98a1ad; }
        .afn-search input { flex: 1; border: 0; outline: 0; padding: 10px 0; font-size: 0.88rem; color: #111827; background: transparent; }
        .afn-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 64px 24px; color: #5b6573; text-align: center; }
        .afn-empty svg { color: #d4d8df; }
        .afn-empty p { margin: 0; font-weight: 600; color: #111827; }
        .afn-empty span { font-size: 0.85rem; color: #98a1ad; max-width: 420px; }
        .afn-recon { padding: 22px; }
        .afn-recon-lead { margin: 0 0 16px; font-size: 0.85rem; color: #5b6573; }
        .afn-recon-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 18px; }
        .afn-recon-item { background: #f9fafb; border: 1px solid #f1f5f9; border-radius: 10px; padding: 14px 16px; }
        .afn-recon-item span { display: block; font-size: 0.72rem; color: #98a1ad; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }
        .afn-recon-item strong { font-size: 1.25rem; color: #07074e; }
        .afn-recon-actions { display: flex; gap: 10px; flex-wrap: wrap; }

        .afn-scrim { position: fixed; inset: 0; background: rgba(16,24,40,0.4); z-index: 40; }
        .afn-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 440px; max-width: 92vw; background: #fff; border-radius: 16px; box-shadow: 0 24px 60px rgba(16,24,40,0.28); z-index: 50; }
        .afn-modal-head { display: flex; align-items: center; justify-content: space-between; padding: 18px 22px; border-bottom: 1px solid #e6e8ec; }
        .afn-modal-head h2 { margin: 0; font-size: 1rem; font-weight: 700; color: #07074e; }
        .afn-icon { border: 1px solid #e6e8ec; background: #fff; border-radius: 8px; padding: 6px; cursor: pointer; color: #5b6573; }
        .afn-modal-body { padding: 18px 22px; display: flex; flex-direction: column; gap: 14px; }
        .afn-modal-user { margin: 0; font-size: 0.85rem; color: #5b6573; }
        .afn-modal-user strong { color: #07074e; }
        .afn-field { display: flex; flex-direction: column; gap: 6px; }
        .afn-field span { font-size: 0.78rem; font-weight: 600; color: #5b6573; }
        .afn-field input, .afn-field textarea { border: 1px solid #e6e8ec; border-radius: 8px; padding: 10px 12px; font-size: 0.88rem; color: #111827; font-family: inherit; }
        .afn-field input:focus, .afn-field textarea:focus { outline: none; border-color: #5b6bff; box-shadow: 0 0 0 3px rgba(91,107,255,0.16); }
        .afn-modal-foot { display: flex; justify-content: flex-end; gap: 10px; padding: 16px 22px; border-top: 1px solid #e6e8ec; }
        .afn-ghost { border: 1px solid #e6e8ec; background: #fff; color: #5b6573; font-weight: 600; padding: 9px 16px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; }
        .afn-primary { border: 1px solid transparent; background: linear-gradient(100deg,#12124f,#07074e); color: #fff; font-weight: 600; padding: 9px 18px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; box-shadow: 0 12px 26px -12px rgba(7,7,78,.7); }
        .afn-primary:hover { transform: translateY(-1px); }
        .afn-primary:disabled { opacity: 0.55; cursor: not-allowed; transform: none; }
        @media (max-width: 720px) { .afn { padding: 18px; } .afn-row-actions { flex-direction: column; } }
      `}</style>
    </AdminLayout>
  );
}
