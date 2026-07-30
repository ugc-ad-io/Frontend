import { Mail, MessageCircle, Phone } from 'lucide-react';

export const SUPPORT_EMAIL = 'support@ugcad.io';
export const SUPPORT_PHONE = '+919000000000';
export const SUPPORT_PHONE_DISPLAY = '+91 90000 00000';

/**
 * Contact-us panel shown on the "application rejected" screens (brand + creator).
 * A rejected applicant is locked out of every in-app surface — including the
 * side rail's help card — so this is their only route back to a human.
 * The mailto is pre-filled with the account details so support can look the
 * application up without a back-and-forth.
 */
/**
 * Build the three support deep-links, pre-filled with the account details so
 * support can look the application up without a back-and-forth. Shared with the
 * floating Contact-us button (ContactSupportFab) so both open the same channels.
 */
export function buildSupportLinks(user) {
  const account = user?.email || user?.username || '';
  const accountId = user?.id || user?._id || '';
  const subject = `Application review appeal${account ? ` — ${account}` : ''}`;
  const body = [
    'Hi UGCad team,',
    '',
    'My application was not approved and I would like it reviewed again.',
    '',
    `Account email: ${account || '(fill in)'}`,
    `Account type: ${user?.role || '(fill in)'}`,
    accountId ? `Account ID: ${accountId}` : '',
    '',
    'Why I think this should be reconsidered:',
    '',
  ].filter((l) => l !== null).join('\n');
  return {
    mailto: `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    whatsapp: `https://wa.me/${SUPPORT_PHONE.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
      `Hi, my UGCad application (${account || 'my account'}) was not approved. Can you review it again?`
    )}`,
    tel: `tel:${SUPPORT_PHONE}`,
  };
}

export default function ContactSupportBox({ user, title = 'Think this is a mistake?' }) {
  const { mailto, whatsapp } = buildSupportLinks(user);

  return (
    <div className="csb">
      <p className="csb-title">{title}</p>
      <p className="csb-sub">Our team can re-check your application — reach out any way you like.</p>

      <div className="csb-rows">
        <a className="csb-row csb-row--primary" href={mailto}>
          <span className="csb-ic"><Mail size={18} /></span>
          <span className="csb-txt"><strong>Email support</strong><small>{SUPPORT_EMAIL}</small></span>
        </a>
        <a className="csb-row" href={whatsapp} target="_blank" rel="noreferrer">
          <span className="csb-ic"><MessageCircle size={18} /></span>
          <span className="csb-txt"><strong>WhatsApp</strong><small>Chat with support</small></span>
        </a>
        <a className="csb-row" href={`tel:${SUPPORT_PHONE}`}>
          <span className="csb-ic"><Phone size={18} /></span>
          <span className="csb-txt"><strong>Call us</strong><small>{SUPPORT_PHONE_DISPLAY}</small></span>
        </a>
      </div>

      <style>{`
        .csb{width:min(460px,100%);margin:26px auto 0;padding-top:22px;border-top:1px solid rgba(255,255,255,.08);text-align:left}
        .csb-title{margin:0 0 4px!important;color:#f4f4f8!important;font-size:15px!important;font-weight:700;text-align:center}
        .csb-sub{margin:0 0 16px!important;color:#9b9bb0!important;font-size:13.5px!important;line-height:1.5;text-align:center}
        .csb-rows{display:grid;gap:10px}
        .csb-row{display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;text-decoration:none;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);transition:background .15s,border-color .15s}
        .csb-row:hover{background:rgba(255,255,255,.08);border-color:rgba(139,151,255,.45)}
        .csb-row--primary{background:rgba(91,107,255,.14);border-color:rgba(91,107,255,.45)}
        .csb-row--primary:hover{background:rgba(91,107,255,.24)}
        .csb-ic{display:grid;place-items:center;width:36px;height:36px;flex:0 0 36px;border-radius:10px;background:rgba(255,255,255,.06);color:#a8b0ff}
        .csb-txt{display:flex;flex-direction:column;line-height:1.35;min-width:0}
        .csb-txt strong{color:#f4f4f8;font-size:14px;font-weight:600}
        .csb-txt small{color:#9b9bb0;font-size:12.5px}
      `}</style>
    </div>
  );
}
