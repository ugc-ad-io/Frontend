import { Link } from 'react-router-dom';
import { LEGAL_DOCS } from './ProfileSettings';
import LegalSections from '../components/LegalSections';
import '../styles/web1-misc.css';

// Where each document lives (same ids App.js passes as docId).
const LEGAL_ROUTES = {
  terms: '/terms',
  privacy: '/privacy-policy',
  cookies: '/cookie-policy',
  guidelines: '/community-guidelines',
  agreement: '/creator-brand-agreement',
};

// Public (no login) page for one legal document. Reuses the text shown in
// Settings > Privacy & Security so the website and the app link to the same words.
export default function LegalPage({ docId }) {
  const doc = LEGAL_DOCS.find((d) => d.id === docId);
  if (!doc) return null;
  return (
    <div className="w1 lg">
      <header className="lg-head">
        <div className="lg-head-in">
          <Link to="/" className="lg-logo" aria-label="UGCad.io home">
            <span className="lg-logo-mark" aria-hidden="true" style={{ backgroundImage: `url(${process.env.PUBLIC_URL || ''}/ugcad-logo.png)` }} />
            <span className="lg-logo-word"><b>UGC</b>ad.io</span>
          </Link>
        </div>
      </header>
      <div className="lg-main" role="main">
        <nav className="lg-nav" aria-label="Legal documents">
          <span className="lg-nav-h">Legal</span>
          {LEGAL_DOCS.filter((d) => LEGAL_ROUTES[d.id]).map((d) => (
            <Link key={d.id} to={LEGAL_ROUTES[d.id]} className={d.id === docId ? 'is-on' : undefined} aria-current={d.id === docId ? 'page' : undefined}>{d.name}</Link>
          ))}
        </nav>
        <article className="lg-doc">
          <h1>{doc.name}</h1>
          <p className="lg-updated">Last updated: {doc.updated}</p>
          <LegalSections doc={doc} wrap="section" wrapProps={{ className: 'lg-sec' }} headingTag="h2" />
        </article>
      </div>
    </div>
  );
}
