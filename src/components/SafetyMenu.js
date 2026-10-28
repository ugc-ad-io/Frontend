import { useState } from 'react';
import { createPortal } from 'react-dom';
import { toast } from 'sonner';
import { Flag, X } from 'lucide-react';
import { useAuth } from '../App';
import { apiErrorMessage } from '../utils/apiError';
import { REPORT_REASONS, reportUser, blockUser, unblockUser, useBlocked } from '../utils/safety';
import './SafetyMenu.css';

// "Report / Block" for a person (chat, profiles, briefs). Needed for App Store guideline 1.2.
// SafetyDialog is controlled by its parent (a menu item opens it); SafetyMenu below is a ready-made flag button.
// messageId: report one specific message (opens straight on the reason list). initial: 'menu' | 'report' | 'block'.
export function SafetyDialog({ userId, name, dealId, messageId, initial = 'menu', onClose }) {
  const { user } = useAuth();
  const me = user && (user.id || user.user_id);
  const blockedSet = useBlocked(me);
  const isBlockedNow = blockedSet.has(userId);
  const [step, setStep] = useState(messageId ? 'report' : initial);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const who = name || 'this user';

  const submitReport = async () => {
    if (busy) return;
    if (!reason) { toast.error('Please choose a reason'); return; }
    setBusy(true);
    try {
      const data = await reportUser({ userId, dealId, reason, details, messageId });
      toast.success(data?.message || 'Thanks, we will review your report.');
      onClose();
    } catch (err) {
      toast.error(err?.response ? apiErrorMessage(err, 'Could not send the report') : "You're offline. Check your connection and try again.");
    } finally { setBusy(false); }
  };
  const doBlock = async () => {
    setBusy(true);
    const r = await blockUser(userId);
    setBusy(false);
    toast.success(r.synced ? `${who} is blocked` : `${who} is blocked on this device`);
    onClose();
  };
  const doUnblock = async () => { setBusy(true); await unblockUser(userId); setBusy(false); toast.success(`${who} is unblocked`); onClose(); };

  return createPortal(
    <div className="ugc-safe-overlay" onClick={() => !busy && onClose()} role="presentation">
      <div className="ugc-safe-sheet" role="dialog" aria-modal="true" aria-label={`Report or block ${who}`} onClick={(e) => e.stopPropagation()}>
        <div className="ugc-safe-head">
          <b>{step === 'report' ? `Report ${who}` : step === 'block' ? `Block ${who}?` : who}</b>
          <button type="button" aria-label="Close" onClick={onClose} disabled={busy}><X size={18} /></button>
        </div>
        {step === 'menu' && (
          <div className="ugc-safe-list">
            <button type="button" className="danger" onClick={() => setStep('report')} data-testid="safety-report"><Flag size={18} /> Report {who}</button>
            {isBlockedNow
              ? <button type="button" onClick={doUnblock} disabled={busy} data-testid="safety-unblock">Unblock {who}</button>
              : <button type="button" className="danger" onClick={() => setStep('block')} data-testid="safety-block">Block {who}</button>}
          </div>
        )}
        {step === 'report' && (
          <>
            <p className="ugc-safe-sub">Our team reviews every report within 5 business days. Don&apos;t include phone numbers or emails.</p>
            <div className="ugc-safe-reasons" role="radiogroup" aria-label="Reason">
              {REPORT_REASONS.map(([v, l]) => (
                <button key={v} type="button" role="radio" aria-checked={reason === v} className={reason === v ? 'is-on' : ''} onClick={() => setReason(v)}>{l}</button>
              ))}
            </div>
            <label className="ugc-safe-label">Details (optional)
              <textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Add any context that will help our team" />
            </label>
            <div className="ugc-safe-actions">
              <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="button" className="primary" onClick={submitReport} disabled={busy || !reason} data-testid="safety-submit-report">{busy ? 'Sending…' : 'Submit report'}</button>
            </div>
          </>
        )}
        {step === 'block' && (
          <>
            <p className="ugc-safe-sub">{who} won&apos;t be able to message you and the conversation is hidden. You can unblock later from the same menu.</p>
            <div className="ugc-safe-actions">
              <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
              <button type="button" className="primary danger" onClick={doBlock} disabled={busy} data-testid="safety-confirm-block">{busy ? 'Blocking…' : 'Block'}</button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** A flag button that opens the dialog. Hidden for yourself. */
export default function SafetyMenu({ userId, name, dealId, className = '', label = false }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  if (!userId || (user && (user.id === userId || user.user_id === userId))) return null;
  return (
    <>
      <button type="button" className={`ugc-safe-btn ${className}`} aria-label="Report or block" title="Report or block" onClick={() => setOpen(true)} data-testid="safety-menu-btn">
        <Flag size={16} />{label ? <span>Report / Block</span> : null}
      </button>
      {open && <SafetyDialog userId={userId} name={name} dealId={dealId} onClose={() => setOpen(false)} />}
    </>
  );
}
