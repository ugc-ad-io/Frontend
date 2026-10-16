// Phone (PWA) building blocks shared by AdminWithdrawals and AdminFinancials.
// Rendered only when useIsPhone() is true; desktop never mounts these.
import { useRef, useState } from 'react';
import { ArrowLeft, CheckCircle, ChevronRight, Download, X, XCircle } from 'lucide-react';

export const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export const fmtDay = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '-');
export const initials = (name) => String(name || '').split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
const methodLabel = (m) => (m === 'upi' ? 'UPI' : m === 'bank' ? 'Bank transfer' : (m || '-'));
// Payout account, last 4 only. The desktop never shows the full account, so neither do we.
export const maskedAccount = (w) => {
  const a = w?.account_details?.upi_id || w?.account_details?.account_number;
  return a ? `••••${String(a).replace(/\s/g, '').slice(-4)}` : '';
};
const withdrawalName = (w) => w.user_nickname || w.user_email || w.user_id || '-';

// Bottom sheet for a money decision. `reasonLabel` makes a reason mandatory.
// Confirm is disabled while the request runs, so a payout can't be sent twice.
export function ConfirmSheet({ title, children, reasonLabel, reasonHint, reasonPlaceholder, confirmLabel, busyLabel = 'Saving…', danger, onConfirm, onClose, testId }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const blocked = busy || (reasonLabel && !reason.trim());
  const submit = async () => {
    if (inFlight.current || blocked) return;
    inFlight.current = true;
    setBusy(true);
    try { await onConfirm(reason.trim()); } finally { inFlight.current = false; setBusy(false); }
  };
  return (
    <>
      <div className="am-sheet-backdrop" onClick={onClose} />
      <section className="am-sheet" role="dialog" aria-modal="true" aria-label={title} data-testid={testId}>
        <header className="am-sheet-head">
          <h2>{title}</h2>
          <button type="button" className="am-icon-btn" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>
        <div className="am-sheet-body">
          {children}
          {reasonLabel && (
            <div className="am-field">
              <label htmlFor="amf-reason">{reasonLabel}</label>
              <textarea id="amf-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={4} placeholder={reasonPlaceholder} />
              {reasonHint && <span className="am-field-hint">{reasonHint}</span>}
            </div>
          )}
        </div>
        <footer className="am-sheet-foot">
          <button type="button" className="am-btn am-btn--secondary" onClick={onClose}>Cancel</button>
          <button type="button" className={`am-btn ${danger ? 'am-btn--danger' : 'am-btn--primary'}`} disabled={!!blocked} onClick={submit} data-testid={testId && `${testId}-confirm`}>
            {busy ? busyLabel : confirmLabel}
          </button>
        </footer>
      </section>
    </>
  );
}

// Pending withdrawal queue: cards -> full-screen detail -> approve / reject sheets.
// `approve(id)` and `reject(id, reason)` are the page's own handlers and resolve true on success.
export function WithdrawalQueuePhone({ withdrawals, loading, approve, reject, onExport }) {
  const [openId, setOpenId] = useState(null);
  const [sheet, setSheet] = useState(null); // 'approve' | 'reject'
  const [exporting, setExporting] = useState(false);
  const w = withdrawals.find((x) => x.id === openId);
  const close = () => { setSheet(null); setOpenId(null); };
  const runExport = async () => { setExporting(true); try { await onExport(); } finally { setExporting(false); } };

  return (
    <>
      <div className="am-section-head">
        <h2 className="am-section-title">Pending withdrawals <span className="am-count">{withdrawals.length}</span></h2>
        <button type="button" className="am-btn am-btn--secondary am-btn--sm" onClick={runExport} disabled={exporting}>
          <Download size={16} /> {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {loading && !withdrawals.length ? (
        <div className="am-empty">Loading withdrawals…</div>
      ) : !withdrawals.length ? (
        <div className="am-empty">No pending withdrawals. New requests will appear here.</div>
      ) : (
        <div className="am-list">
          {withdrawals.map((x) => (
            <button key={x.id} type="button" className="am-card" onClick={() => setOpenId(x.id)} data-testid={`withdrawal-card-${x.id}`}>
              <div className="am-card-head">
                <span className="am-avatar" aria-hidden="true">{initials(withdrawalName(x))}</span>
                <div className="am-card-main">
                  <span className="am-card-title">{withdrawalName(x)}</span>
                  <span className="am-card-sub">Requested {fmtDay(x.requested_at)}</span>
                  <span className="am-badges"><span className="am-badge am-badge--wait">{x.status}</span></span>
                </div>
                <ChevronRight size={20} className="am-row-chevron amf-center" />
              </div>
              <div className="am-card-foot">
                <span className="am-card-sub">{methodLabel(x.payment_method)} {maskedAccount(x)}</span>
                <span><span className="am-amount-label">Amount </span><span className="am-amount">{inr(x.amount)}</span></span>
              </div>
            </button>
          ))}
        </div>
      )}

      {w && (
        <div className="am-detail" role="dialog" aria-modal="true" aria-labelledby="amf-w-title" data-testid="withdrawal-detail">
          <header className="am-detail-head">
            <button type="button" className="am-icon-btn" onClick={close} aria-label="Back to withdrawals"><ArrowLeft size={22} /></button>
            <h1 id="amf-w-title">Withdrawal request</h1>
          </header>
          <div className="am-detail-body">
            <div className="am-identity">
              <span className="am-avatar am-avatar--lg" aria-hidden="true">{initials(withdrawalName(w))}</span>
              <div className="am-card-main">
                <h2>{inr(w.amount)}</h2>
                <span className="am-card-sub">{withdrawalName(w)}</span>
                <span className="am-badges"><span className="am-badge am-badge--wait">{w.status}</span></span>
              </div>
            </div>
            <section className="am-section">
              <h3>Request</h3>
              <div className="am-kv"><span>Amount</span><span>{inr(w.amount)}</span></div>
              <div className="am-kv"><span>Payment method</span><span>{methodLabel(w.payment_method)}</span></div>
              {maskedAccount(w) && <div className="am-kv"><span>Account</span><span>{maskedAccount(w)}</span></div>}
              <div className="am-kv"><span>Requested</span><span>{w.requested_at ? new Date(w.requested_at).toLocaleString() : '-'}</span></div>
              <div className="am-kv"><span>Status</span><span>{w.status}</span></div>
            </section>
            <section className="am-section">
              <h3>Creator</h3>
              {w.user_nickname && <div className="am-kv"><span>Name</span><span>{w.user_nickname}</span></div>}
              {w.user_email && <div className="am-kv"><span>Email</span><span>{w.user_email}</span></div>}
              <div className="am-kv"><span>User ID</span><span className="amf-mono">{w.user_id}</span></div>
            </section>
          </div>
          <div className="am-actionbar">
            <div className="am-actionbar-row">
              <button type="button" className="am-btn am-btn--danger" onClick={() => setSheet('reject')} data-testid="withdrawal-reject"><XCircle size={18} /> Reject</button>
              <button type="button" className="am-btn am-btn--primary" onClick={() => setSheet('approve')} data-testid="withdrawal-approve"><CheckCircle size={18} /> Approve</button>
            </div>
          </div>
        </div>
      )}

      {w && sheet === 'approve' && (
        <ConfirmSheet
          title="Approve withdrawal"
          confirmLabel={`Approve ${inr(w.amount)}`}
          busyLabel="Approving…"
          testId="withdrawal-approve-sheet"
          onClose={() => setSheet(null)}
          onConfirm={async () => { if (await approve(w.id)) close(); }}
        >
          <p className="am-muted amf-flat">Pay <strong>{inr(w.amount)}</strong> to <strong>{withdrawalName(w)}</strong> via {methodLabel(w.payment_method)} {maskedAccount(w)}. A payout receipt is issued and the creator is notified.</p>
        </ConfirmSheet>
      )}
      {w && sheet === 'reject' && (
        <ConfirmSheet
          title="Reject withdrawal"
          reasonLabel="Rejection reason"
          reasonHint="Required. The amount is refunded to the creator's balance and they see this reason."
          confirmLabel="Reject and refund"
          busyLabel="Rejecting…"
          danger
          testId="withdrawal-reject-sheet"
          onClose={() => setSheet(null)}
          onConfirm={async (reason) => { if (await reject(w.id, reason)) close(); }}
        >
          <p className="am-muted amf-flat">{inr(w.amount)} requested by <strong>{withdrawalName(w)}</strong>.</p>
        </ConfirmSheet>
      )}
    </>
  );
}
