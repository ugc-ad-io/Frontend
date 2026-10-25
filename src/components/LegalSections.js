// Renders a legal document's sections. Full documents (src/data/legalContent.js) use `blocks`
// (paragraphs, bullet lists, sub-headings, tables); older short copy only has `p`.
// `wrap` is the element each section renders as, so the modal keeps its <div> markup and the public page
// keeps its <section> markup.
const cellStyle = { border: '1px solid #e2e2f0', padding: '8px 10px', textAlign: 'left', verticalAlign: 'top' };

function Blocks({ blocks, pStyle }) {
  return blocks.map((b, i) => {
    if (b.t === 'ul') {
      return <ul key={i} style={{ margin: '0 0 10px', paddingLeft: 20, color: 'inherit', lineHeight: 1.65 }}>{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>;
    }
    if (b.t === 'h') return <h5 key={i} style={{ margin: '14px 0 4px', fontSize: 15, fontWeight: 600, color: '#07074e' }}>{b.text}</h5>;
    if (b.t === 'table') {
      return (
        <div key={i} style={{ overflowX: 'auto', margin: '0 0 12px' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14, lineHeight: 1.5 }}>
            <thead><tr>{b.head.map((h) => <th key={h} style={{ ...cellStyle, background: '#f6f6fd', color: '#07074e', fontWeight: 600 }}>{h}</th>)}</tr></thead>
            <tbody>{b.rows.map((r, j) => <tr key={j}>{r.map((c, k) => <td key={k} style={cellStyle}>{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    }
    return <p key={i} style={pStyle}>{b.text}</p>;
  });
}

export default function LegalSections({ doc, wrap: Wrap = 'div', wrapProps = {}, headingTag: H = 'h4', headingStyle, pStyle, introStyle }) {
  return (
    <>
      {(doc.intro || []).map((t, i) => <p key={`intro-${i}`} style={introStyle || pStyle}>{t}</p>)}
      {doc.sections.map((sec, i) => (
        <Wrap key={i} {...wrapProps}>
          <H style={headingStyle}>{sec.h}</H>
          <Blocks blocks={sec.blocks || [{ t: 'p', text: sec.p }]} pStyle={pStyle} />
        </Wrap>
      ))}
    </>
  );
}
