import ContactSupportBox from './ContactSupportBox';

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
  const eyebrow = kind === 'creator' ? 'Creator verification' : 'Business verification';

  return (
    <div className="rg-page">
      <section className="rg-card">
        <span className="rg-ic" aria-hidden="true">⚠️</span>
        <p className="rg-eyebrow">{eyebrow}</p>
        <h1>Application not approved</h1>
        <p className="rg-lead">
          Your {kind === 'creator' ? 'creator' : 'business'} profile was not approved, so you can’t access the
          dashboard right now. If you think this is a mistake, contact our team and we’ll take another look.
        </p>

        {(reasonLabel || review.reason_details) && (
          <div className="rg-reason">
            <strong>Reason from our review team</strong>
            {reasonLabel && <span className="rg-reason-code">{reasonLabel}</span>}
            {review.reason_details && <p>{review.reason_details}</p>}
          </div>
        )}

        <ContactSupportBox user={user} />

        {onHome && (
          <button type="button" className="rg-home" onClick={onHome} data-testid="home-btn">
            Back to Home
          </button>
        )}
      </section>

      <style>{`
        .rg-page{min-height:100vh;display:grid;place-items:center;padding:24px;background:linear-gradient(160deg,#05050f 0%,#0d0b26 100%)}
        .rg-card{width:min(560px,100%);padding:44px 40px 36px;border-radius:24px;background:#141420;color:#f4f4f8;text-align:center;border:1px solid rgba(255,255,255,.08);box-shadow:0 24px 60px rgba(0,0,0,.5)}
        .rg-ic{font-size:44px;line-height:1}
        .rg-eyebrow{margin:16px 0 4px;color:#8b8fb5;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.4px}
        .rg-card h1{margin:0 0 12px;font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:26px;color:#fff}
        .rg-lead{margin:0 auto;max-width:440px;color:rgba(255,255,255,.62);font-size:14.5px;line-height:1.65}
        .rg-reason{margin:20px auto 0;max-width:440px;text-align:left;padding:14px 16px;border-radius:14px;background:rgba(255,138,138,.08);border:1px solid rgba(255,138,138,.25)}
        .rg-reason strong{display:block;margin-bottom:6px;color:#ff9d9d;font-size:12.5px;letter-spacing:.3px;text-transform:uppercase}
        .rg-reason-code{display:inline-block;margin-bottom:6px;color:#f4f4f8;font-size:14px;font-weight:600}
        .rg-reason p{margin:0;color:#d6d7ec;font-size:14px;line-height:1.55}
        .rg-home{margin-top:24px;padding:12px 26px;border-radius:12px;border:none;cursor:pointer;font:inherit;font-weight:700;font-size:14px;background:#5b6bff;color:#fff}
        .rg-home:hover{background:#4452f0}
        @media (max-width:600px){.rg-card{padding:28px 20px}}
      `}</style>
    </div>
  );
}
