import { Link } from 'react-router-dom';
import { LEGAL_DOCS } from './ProfileSettings';
import LegalSections from '../components/LegalSections';

// Public (no login) page for one legal document. Reuses the text shown in
// Settings > Privacy & Security so the website and the app link to the same words.
export default function LegalPage({ docId }) {
  const doc = LEGAL_DOCS.find((d) => d.id === docId);
  if (!doc) return null;
  const pStyle = { margin: '0 0 10px', color: '#585c7e', lineHeight: 1.65 };
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px 64px', fontFamily: 'inherit', color: '#15163a' }}>
      <Link to="/" style={{ color: '#5b6bff', fontWeight: 700, textDecoration: 'none' }}>&larr; Home</Link>
      <h1 style={{ margin: '18px 0 4px', fontSize: 30 }}>{doc.name}</h1>
      <p style={{ margin: '0 0 24px', color: '#9296ba' }}>Last updated: {doc.updated}</p>
      <LegalSections
        doc={doc}
        wrap="section"
        wrapProps={{ style: { marginBottom: 20 } }}
        headingTag="h2"
        headingStyle={{ margin: '0 0 6px', fontSize: 18 }}
        pStyle={pStyle}
      />
    </main>
  );
}
