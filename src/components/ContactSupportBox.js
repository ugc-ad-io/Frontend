import { Mail, MessageCircle, Phone } from 'lucide-react';
import '../styles/web1-misc.css';

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
  const subject = `Application review appeal${account ? ` - ${account}` : ''}`;
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
    <div className="w1 csb">
      <p className="csb-title">{title}</p>
      <p className="csb-sub">Our team can re-check your application - reach out any way you like.</p>

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
    </div>
  );
}
