import { useNavigate } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';

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

  return (
    <div className="mig">
      <section className="mig-card">
        <MessageSquare size={60} />
        <p className="mig-eyebrow">{isBrand ? 'Business verification' : 'Creator verification'}</p>
        <h1>More information needed</h1>
        <p className="mig-lede">
          Our team needs a few more details before approving your
          {isBrand ? ' business ' : ' creator '}profile. Update it with the information below and
          we&apos;ll review it again.
        </p>

        {message && (
          <div className="mig-msg">
            <span className="mig-msg-lbl">Message from our team</span>
            <p>{message}</p>
          </div>
        )}

        {items.length > 0 && (
          <ul className="mig-items">
            {items.map((it, i) => <li key={i}>{it}</li>)}
          </ul>
        )}

        {/* If the admin sent neither a message nor a checklist, say so plainly rather
            than showing an empty box that looks broken. */}
        {!message && items.length === 0 && (
          <p className="mig-lede">Our team will be in touch by email with what&apos;s needed.</p>
        )}

        <div className="mig-actions">
          <button type="button" className="mig-primary" onClick={() => navigate(setupPath)}>
            Update my profile
          </button>
          {onLogout && (
            <button type="button" className="mig-ghost" onClick={onLogout}>Log out</button>
          )}
        </div>
      </section>

      <style>{`
        .mig { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: linear-gradient(160deg,#05050f 0%,#0d0b26 100%); }
        .mig-card { width: min(620px,100%); padding: 48px 40px; border-radius: 24px; background: #141420; color: #f4f4f8; text-align: center; border: 1px solid rgba(255,255,255,.08); box-shadow: 0 24px 60px rgba(0,0,0,.5); }
        .mig-card svg { color: #5b6bff; }
        .mig-eyebrow { margin: 16px 0 4px; color: #8b8fb5; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; }
        .mig-card h1 { margin: 0 0 12px; font-family: var(--font-head,'Plus Jakarta Sans',sans-serif); font-size: 26px; color: #fff; }
        .mig-lede { margin: 0 auto; max-width: 460px; color: rgba(255,255,255,.62); font-size: 14.5px; line-height: 1.65; }
        .mig-msg { margin: 24px 0 0; padding: 16px 18px; border-radius: 12px; background: rgba(91,107,255,.1); border: 1px solid rgba(91,107,255,.25); text-align: left; }
        .mig-msg-lbl { display: block; margin-bottom: 6px; color: #8b8fb5; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; }
        .mig-msg p { margin: 0; color: #e7e7f2; font-size: 14.5px; line-height: 1.6; }
        .mig-items { margin: 16px 0 0; padding: 0; list-style: none; text-align: left; display: grid; gap: 8px; }
        .mig-items li { padding: 11px 14px 11px 34px; position: relative; border-radius: 10px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.07); color: #e7e7f2; font-size: 14px; line-height: 1.5; }
        .mig-items li::before { content: '•'; position: absolute; left: 15px; top: 10px; color: #5b6bff; font-size: 18px; }
        .mig-actions { margin-top: 28px; display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
        .mig-primary { padding: 12px 26px; border-radius: 12px; border: none; cursor: pointer; font: inherit; font-weight: 700; font-size: 14px; background: #5b6bff; color: #fff; }
        .mig-primary:hover { background: #4452f0; }
        .mig-ghost { padding: 12px 22px; border-radius: 12px; cursor: pointer; font: inherit; font-weight: 700; font-size: 14px; background: transparent; color: rgba(255,255,255,.7); border: 1px solid rgba(255,255,255,.15); }
        .mig-ghost:hover { color: #fff; border-color: rgba(255,255,255,.3); }
      `}</style>
    </div>
  );
}
