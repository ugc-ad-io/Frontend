import { Link, useLocation } from 'react-router-dom';
import { LEGAL_CONTENT } from '../../../data/legalContent';
import LegalSections from '../../../components/LegalSections';
import PubFrame from './pubKit';

// Same path -> document map as App.js (public legal routes).
const PATH_DOC = {
  '/privacy-policy': 'privacy',
  '/terms': 'terms',
  '/community-guidelines': 'guidelines',
  '/cookie-policy': 'cookies',
  '/creator-brand-agreement': 'agreement',
};
const PATH_OF = Object.fromEntries(Object.entries(PATH_DOC).map(([p, d]) => [d, p]));

// The cookie policy is not part of the legal Google Doc, so it keeps its own short copy (same text as the website).
const COOKIES = {
  id: 'cookies', name: 'Cookie Policy', updated: 'July 2026',
  sections: [
    { h: 'What are cookies', p: 'Cookies are small text files stored on your device that help websites work and remember your preferences.' },
    { h: 'Essential cookies', p: 'Required for the platform to function - keeping you signed in, securing your session and enabling core features. These cannot be turned off.' },
    { h: 'Preference cookies', p: 'Remember choices like your language and dashboard settings to personalise your experience.' },
    { h: 'Analytics cookies', p: 'Help us understand how the platform is used so we can improve performance and features. This data is aggregated.' },
    { h: 'Managing cookies', p: 'You can control or delete cookies through your browser settings. Blocking essential cookies may affect how UGCad.io works.' },
  ],
};
const DOCS = { privacy: LEGAL_CONTENT.privacy, terms: LEGAL_CONTENT.terms, agreement: LEGAL_CONTENT.agreement, guidelines: LEGAL_CONTENT.guidelines, cookies: COOKIES };
const P_STYLE = { margin: '0 0 10px' };

export default function Legal() {
  const { pathname } = useLocation();
  const docId = PATH_DOC[pathname.replace(/\/+$/, '')];
  const doc = DOCS[docId];
  if (!doc) return null;
  return (
    <PubFrame back title="Legal">
      <div className="ap-pub-top">
        <h1>{doc.name}</h1>
        <p>Last updated: {doc.updated}</p>
      </div>
      <article className="ap-card ap-pub-doc">
        <LegalSections
          doc={doc}
          wrap="section"
          wrapProps={{ className: 'ap-pub-sec' }}
          headingTag="h2"
          pStyle={P_STYLE}
        />
      </article>
      <nav className="ap-pub-others" aria-label="Other policies">
        <div className="ap-sec-h"><h2>Other policies</h2></div>
        <div className="ap-chips">
          {Object.keys(DOCS).filter((id) => id !== docId).map((id) => (
            <Link key={id} to={PATH_OF[id]} replace className="ap-chip">{DOCS[id].name}</Link>
          ))}
        </div>
      </nav>
    </PubFrame>
  );
}
