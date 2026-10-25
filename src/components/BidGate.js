import { useCallback, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Percent, UserRoundCheck } from 'lucide-react';
import { getProfileMissing } from '../utils/creatorProfileCompletion';
import { DEFAULT_COMMISSION_PERCENT, feeBreakdown, inr, pctLabel } from '../utils/bidFee';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

/**
 * Everything that happens BEFORE a creator sees the bid form:
 *   1. ensureProfile() — asks the server whether the profile is complete enough to bid. If
 *      not, shows a "complete your profile" pop-up listing what's missing and returns false.
 *   2. showFee(open)   — shows the platform-fee pop-up; "Continue to bid" calls open().
 * Render `ui` once in the page. `percent` is the live fee for the in-form notice.
 *
 * The server enforces the profile rule too (POST /campaigns/{id}/bid → 403); this is the
 * friendly front door, not the lock.
 */
export function useBidGate(user) {
  const navigate = useNavigate();
  const [percent, setPercent] = useState(DEFAULT_COMMISSION_PERCENT);
  const [missing, setMissing] = useState(null);   // array → "complete your profile" pop-up
  const [pendingOpen, setPendingOpen] = useState(null); // fn → platform-fee pop-up

  const ensureProfile = useCallback(async () => {
    let answer;
    try {
      answer = (await axios.get(`${API}/creator/bid-readiness`)).data;
    } catch {
      // Server unreachable / older backend: fall back to the website's own checklist.
      const local = getProfileMissing(user);
      answer = { can_bid: local.length === 0, missing: local, commission_percent: DEFAULT_COMMISSION_PERCENT };
    }
    if (answer.commission_percent != null) setPercent(Number(answer.commission_percent));
    if (!answer.can_bid) {
      setMissing(answer.missing || []);
      return false;
    }
    return true;
  }, [user]);

  const showFee = useCallback((open) => setPendingOpen(() => open), []);

  const ui = (
    <>
      {missing && (
        <div className="bgate-overlay" role="dialog" aria-modal="true" aria-labelledby="bgate-incomplete-title" onClick={() => setMissing(null)}>
          <div className="bgate-modal" onClick={(e) => e.stopPropagation()}>
            <span className="bgate-ic warn"><UserRoundCheck size={22} /></span>
            <h2 id="bgate-incomplete-title">Complete your profile to bid</h2>
            <p>Brands choose creators from their profile, so you can bid once these are filled in:</p>
            <ul data-testid="bgate-missing">
              {missing.map((m) => <li key={m}>{m}</li>)}
            </ul>
            <div className="bgate-actions">
              <button type="button" className="bgate-ghost" onClick={() => setMissing(null)}>Not now</button>
              <button type="button" className="bgate-primary" autoFocus onClick={() => { setMissing(null); navigate('/settings?tab=profile'); }}>
                Complete profile
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingOpen && (
        <div className="bgate-overlay" role="dialog" aria-modal="true" aria-labelledby="bgate-fee-title" onClick={() => setPendingOpen(null)}>
          <div className="bgate-modal" onClick={(e) => e.stopPropagation()}>
            <span className="bgate-ic"><Percent size={22} /></span>
            <h2 id="bgate-fee-title">Platform fee: {pctLabel(percent)}%</h2>
            <p>
              UGC.ad keeps <strong>{pctLabel(percent)}%</strong> of your bid as its platform fee. It is deducted
              from your payout when the brand approves your work.
            </p>
            <p className="bgate-example">
              Example: bid {inr(1000)} → fee {inr(feeBreakdown(1000, percent)?.fee ?? 0)} → you receive {inr(feeBreakdown(1000, percent)?.net ?? 1000)}.
            </p>
            <div className="bgate-actions">
              <button type="button" className="bgate-ghost" onClick={() => setPendingOpen(null)}>Cancel</button>
              <button
                type="button"
                className="bgate-primary"
                autoFocus
                onClick={() => { const open = pendingOpen; setPendingOpen(null); open(); }}
              >
                Continue to bid
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .bgate-overlay{position:fixed;inset:0;z-index:10050;background:rgba(7,7,78,.45);display:flex;align-items:center;justify-content:center;padding:20px}
        .bgate-modal{width:100%;max-width:420px;max-height:100%;overflow-y:auto;background:#fff;border-radius:16px;box-shadow:0 24px 60px rgba(7,7,78,.28);padding:24px;box-sizing:border-box;font-family:'Inter',system-ui,sans-serif;color:#07074e}
        .bgate-ic{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:#eef0ff;color:#4e60e6;margin-bottom:12px}
        .bgate-ic.warn{background:#fff4e5;color:#a35b00}
        .bgate-modal h2{margin:0 0 8px;font-family:'Readex Pro','Plus Jakarta Sans',sans-serif;font-weight:500;font-size:1.25rem;color:#07074e}
        .bgate-modal p{margin:0 0 10px;font-size:.92rem;line-height:1.55;color:#3a3a6a}
        .bgate-modal ul{margin:0 0 14px;padding-left:20px;font-size:.92rem;color:#07074e;line-height:1.7}
        .bgate-example{background:#f6f6fd;border-radius:12px;padding:10px 12px;font-weight:600;color:#07074e!important}
        .bgate-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:6px}
        @media(max-width:480px){.bgate-actions{flex-direction:column-reverse}.bgate-actions button{width:100%}}
        .bgate-primary{border:0;background:#07074e;color:#fff;font-weight:700;font-size:.9rem;min-height:44px;padding:0 18px;border-radius:12px;cursor:pointer}
        .bgate-ghost{border:0;box-shadow:inset 0 0 0 1.5px #c9cbea;background:#fff;color:#07074e;font-weight:600;font-size:.9rem;min-height:44px;padding:0 16px;border-radius:12px;cursor:pointer}
      `}</style>
    </>
  );

  return { ensureProfile, showFee, percent, ui };
}

/** The fee rate, stated inside the bid form. Deliberately no per-bid maths. */
export function BidFeeNotice({ percent = DEFAULT_COMMISSION_PERCENT }) {
  return (
    <div className="bfee" data-testid="bid-fee-notice">
      <strong>UGC.ad platform fee: {pctLabel(percent)}%</strong>
      <span>Deducted from your payout when the brand approves your work.</span>
      <style>{`
        .bfee{display:flex;flex-direction:column;gap:4px;background:#f6f6fd;border:0;border-radius:12px;padding:11px 13px;font-size:.82rem;color:#6e6e96;font-weight:500}
        .bfee strong{color:#07074e;font-size:.88rem}
      `}</style>
    </div>
  );
}
