import { ShieldAlert } from 'lucide-react';
import BrandGateShell from './BrandGateShell';
import CreatorGate from './CreatorGate';
import { buildSupportLinks } from './ContactSupportBox';

const REASON_LABELS = {
  incomplete_profile: 'Incomplete profile',
  unverifiable_business: 'Business details could not be verified',
  unverifiable_socials: 'Social profiles could not be verified',
  low_quality_portfolio: 'Portfolio did not meet our bar',
  duplicate_account: 'Duplicate account',
  policy_violation: 'Policy violation',
  other: 'Other',
};

/**
 * Full-page screen shown to a user whose application was rejected.
 * Rendered by every surface that gates on `approval_status === 'rejected'`
 * (brand dashboard, brand welcome, brand top-nav shell, creator dashboard) so
 * the message — and the contact-us route out — is identical everywhere.
 */
export default function RejectedGate({ user, onHome, kind = 'business' }) {
  const review = user?.review || {};
  // 'other' carries no information beyond reason_details — don't show it as a label.
  const reasonLabel = review.reason_code && review.reason_code !== 'other'
    ? (REASON_LABELS[review.reason_code] || null)
    : null;
  const { mailto, whatsapp } = buildSupportLinks(user);
  const isCreator = kind === 'creator';

  // Creators get the creator-styled gate (board C16); brands keep the brand shell below.
  if (isCreator) {
    return (
      <CreatorGate
        icon={ShieldAlert}
        tone="bad"
        chip="Not approved"
        title="We couldn’t approve your profile yet"
        lead="You can’t access the dashboard right now. If you think this is a mistake, our team is happy to look again."
        actions={(
          <>
            <a className="cui-s-btn cui-s-btn--ink" href={mailto}>Contact support</a>
            {onHome && (
              <button type="button" className="cui-s-btn" onClick={onHome} data-testid="home-btn">Log out</button>
            )}
          </>
        )}
      >
        {(reasonLabel || review.reason_details) && (
          <div className="cui-s-note cui-s-note--bad">
            <strong>{reasonLabel || 'Reason from our review team'}</strong>
            {review.reason_details && <div>{review.reason_details}</div>}
          </div>
        )}
        <p className="cui-s-alt">Prefer chat? <a href={whatsapp} target="_blank" rel="noreferrer">Message us on WhatsApp</a></p>
      </CreatorGate>
    );
  }

  return (
    <BrandGateShell
      icon={ShieldAlert}
      tone="bad"
      chip="Not approved"
      chipClass="bui-status--bad"
      title={isCreator ? 'We couldn’t approve your profile yet' : 'We couldn’t approve your brand yet'}
      lead={isCreator
        ? 'You can’t access the dashboard right now. If you think this is a mistake, our team is happy to look again.'
        : 'You can’t post campaigns or chat with creators right now. If you think this is a mistake, our team is happy to look again.'}
      actions={(
        <>
          <a className="bui-btn" href={mailto}>Contact support</a>
          {onHome && (
            <button type="button" className="bui-btn bui-btn--ghost" onClick={onHome} data-testid="home-btn">
              Log out
            </button>
          )}
        </>
      )}
    >
      {(reasonLabel || review.reason_details) && (
        <div className="gt-box gt-box--bad">
          <div className="gt-box-h">Reason from our review team</div>
          {reasonLabel && <strong className="gt-code">{reasonLabel}</strong>}
          {review.reason_details && <p>{review.reason_details}</p>}
        </div>
      )}
      <p className="gt-alt">Prefer chat? <a href={whatsapp} target="_blank" rel="noreferrer">Message us on WhatsApp</a></p>
    </BrandGateShell>
  );
}
