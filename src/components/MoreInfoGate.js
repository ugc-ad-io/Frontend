import { useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import BrandGateShell from './BrandGateShell';
import CreatorGate from './CreatorGate';
import { SUPPORT_EMAIL } from './ContactSupportBox';

/**
 * Shown when an admin has clicked "Request more info" on a profile
 * (approval_status === 'more_info').
 *
 * This existed for creators (inline in CreatorDashboard) but NOT for brands — the
 * brand gates only covered 'pending' and 'rejected', so a brand asked for more info
 * fell through every check and landed on the normal dashboard, never seeing what the
 * admin had asked for. One component now, used by both, so they can't drift again.
 *
 * Props: user, kind ('business' | 'creator'), onLogout
 */
export default function MoreInfoGate({ user, kind = 'business', onLogout }) {
  const navigate = useNavigate();
  const review = user?.review || {};
  const items = Array.isArray(review.more_info_items) ? review.more_info_items : [];
  const message = review.more_info_message || '';
  const isBrand = kind === 'business';
  const setupPath = isBrand ? '/profile-setup/business' : '/profile-setup/creator';
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Question about my brand review')}`;

  // Creators get the creator-styled gate (board C16 "needs a fix"); brands keep the brand shell below.
  if (!isBrand) {
    const n = items.length;
    return (
      <CreatorGate
        icon={MessageSquare}
        tone="warn"
        chip={n > 0 ? `Needs ${n} fix${n === 1 ? '' : 'es'}` : 'Action needed'}
        title="Almost there - we need a little more"
        lead="Fix the items below and send your profile again."
        actions={(
          <>
            <button type="button" className="cui-s-btn cui-s-btn--pri" onClick={() => navigate(setupPath)}>Fix and send again</button>
            <a className="cui-s-btn" href={mailto}>Contact support</a>
            {onLogout && <button type="button" className="cui-s-btn" onClick={onLogout}>Log out</button>}
          </>
        )}
      >
        {message && <div className="cui-s-note">{message}</div>}
        {n > 0 && (
          <div className="cui-s-fixes">
            {items.map((it, i) => (
              <div className="cui-s-fix" key={i}><i>{i + 1}</i><div><b>{it}</b></div></div>
            ))}
          </div>
        )}
        {!message && n === 0 && <p className="cui-s-alt">Our team will be in touch by email with what’s needed.</p>}
      </CreatorGate>
    );
  }

  return (
    <BrandGateShell
      icon={MessageSquare}
      tone="warn"
      chip="Action needed"
      chipClass="bui-status--warn"
      title="We need a little more info"
      lead={`Fix the items below and we’ll review your ${isBrand ? 'brand' : 'profile'} again.`}
      actions={(
        <>
          <button type="button" className="bui-btn" onClick={() => navigate(setupPath)}>
            {isBrand ? 'Update my details' : 'Update my profile'}
          </button>
          <a className="bui-btn bui-btn--ghost" href={mailto}>Contact support</a>
          {onLogout && (
            <button type="button" className="bui-btn bui-btn--ghost" onClick={onLogout}>Log out</button>
          )}
        </>
      )}
    >
      {(message || items.length > 0) && (
        <div className="gt-box gt-box--warn">
          <div className="gt-box-h">Message from our team</div>
          {message && <p>{message}</p>}
          {items.map((it, i) => <div className="gt-todo" key={i}>{it}</div>)}
        </div>
      )}
      {/* If the admin sent neither a message nor a checklist, say so plainly rather
          than showing an empty box that looks broken. */}
      {!message && items.length === 0 && (
        <p className="gt-lead">Our team will be in touch by email with what&apos;s needed.</p>
      )}
    </BrandGateShell>
  );
}
