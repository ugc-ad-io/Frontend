import { Link } from 'react-router-dom';
import { LEGAL_DOCS } from './ProfileSettings';

// Public (no login) page for one legal document. Reuses the text already shown in
// Settings > Privacy & Security so the website and the app link to the same words.
export default function LegalPage({ docId }) {
  const doc = LEGAL_DOCS.find((d) => d.id === docId);
  if (!doc) return null;
  return (
    <main style={{ maxWidth: 760, margin: '0 auto', padding: '40px 20px 64px', fontFamily: 'inherit', color: '#15163a' }}>
      <Link to="/" style={{ color: '#5b6bff', fontWeight: 700, textDecoration: 'none' }}>&larr; Home</Link>
      <h1 style={{ margin: '18px 0 4px', fontSize: 30 }}>{doc.name}</h1>
      <p style={{ margin: '0 0 24px', color: '#9296ba' }}>Last updated: {doc.updated}</p>
      {doc.sections.map((sec) => (
        <section key={sec.h} style={{ marginBottom: 20 }}>
          <h2 style={{ margin: '0 0 6px', fontSize: 18 }}>{sec.h}</h2>
          <p style={{ margin: 0, color: '#585c7e', lineHeight: 1.65 }}>{sec.p}</p>
        </section>
      ))}
    </main>
  );
}
