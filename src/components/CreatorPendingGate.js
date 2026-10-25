import { Clock } from 'lucide-react';
import CreatorGate, { GateCheck } from './CreatorGate';
import { SUPPORT_EMAIL } from './ContactSupportBox';

/**
 * "We're checking your profile" screen for a creator whose approval_status is 'pending'
 * (board C16, state 1). Props: user, onLogout.
 */
export default function CreatorPendingGate({ user, onLogout }) {
  const email = user?.email;
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Question about my creator profile review')}`;
  return (
    <CreatorGate
      icon={Clock}
      chip="In review"
      title="We’re checking your profile"
      lead={`Most creator approvals are completed within 24-48 hours. We’ll email you${email ? ` at ${email}` : ''} the moment you’re live.`}
      stage={1}
      actions={(
        <>
          <a className="cui-s-btn cui-s-btn--ink" href={mailto}>Contact support</a>
          {onLogout && <button type="button" className="cui-s-btn" onClick={onLogout} data-testid="home-btn">Log out</button>}
        </>
      )}
    >
      <div className="cui-s-checks">
        <GateCheck>Your profile and videos are with our review team</GateCheck>
        <GateCheck>You don’t need to do anything else right now</GateCheck>
      </div>
    </CreatorGate>
  );
}
