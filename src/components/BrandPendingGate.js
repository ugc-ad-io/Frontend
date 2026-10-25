import { Clock, Info } from 'lucide-react';
import BrandGateShell from './BrandGateShell';
import { SUPPORT_EMAIL } from './ContactSupportBox';

/**
 * "We're checking your brand" screen for a brand whose approval_status is 'pending'.
 * Props: user, onLogout
 */
export default function BrandPendingGate({ user, onLogout }) {
  const email = user?.email;
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Question about my brand review')}`;
  return (
    <BrandGateShell
      icon={Clock}
      chip="Under review"
      title="We’re checking your brand"
      lead={`Most brands are approved within 24–48 hours. We’ll email you${email ? ` at ${email}` : ''} the moment you’re in.`}
      actions={(
        <>
          <a className="bui-btn" href={mailto}>Contact support</a>
          {onLogout && <button type="button" className="bui-btn bui-btn--ghost" onClick={onLogout} data-testid="home-btn">Log out</button>}
        </>
      )}
    >
      <div className="gt-steps" role="list">
        <div className="gt-step is-done" role="listitem"><i aria-hidden="true" /><span>Signed up</span></div>
        <div className="gt-step is-now" role="listitem"><i aria-hidden="true" /><span>Under review</span></div>
        <div className="gt-step is-todo" role="listitem"><i aria-hidden="true" /><span>Approved</span></div>
      </div>
      <div className="gt-tip">
        <Info size={18} />
        <span>Posting campaigns and chat open once you’re approved. You don’t need to do anything else right now.</span>
      </div>
    </BrandGateShell>
  );
}
