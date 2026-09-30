import { useEffect, useRef, useState } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

/**
 * One-time consent gate for the Creator & Brand Agreement.
 *
 * Shown when the logged-in creator/brand has not accepted the CURRENT agreement
 * version (user.agreement_accepted === false). Acceptance is stored server-side,
 * so agreeing here also clears the gate in the app (and vice-versa).
 *
 * Flow the product asked for: a card shows the first couple of sections; "View
 * full agreement" reveals the rest; "Agree" stays disabled until the reader has
 * scrolled to the very end.
 */
export default function AgreementGate({ onAccepted }) {
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [atBottom, setAtBottom] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const bodyRef = useRef(null);

  useEffect(() => {
    let live = true;
    axios
      .get(`${API}/agreement`)
      .then((res) => {
        if (!live) return;
        if (res.data?.accepted) onAccepted();
        else setData(res.data);
      })
      .catch(() => live && setError('Could not load the agreement. Check your connection and try again.'));
    return () => {
      live = false;
    };
  }, [onAccepted]);

  const onScroll = () => {
    const el = bodyRef.current;
    if (!el) return;
    // 24px slack so it fires even if the last line is a pixel short.
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) setAtBottom(true);
  };

  const viewAll = () => {
    setExpanded(true);
    // A tall doc needs a scroll to reach the end; a short one is already fully
    // visible, so enable Agree immediately after the layout settles.
    requestAnimationFrame(() => {
      const el = bodyRef.current;
      if (el && el.scrollHeight <= el.clientHeight + 24) setAtBottom(true);
    });
  };

  const agree = async () => {
    setSubmitting(true);
    setError('');
    try {
      await axios.post(`${API}/agreement/accept`);
      onAccepted();
    } catch (e) {
      setError('Could not record your acceptance. Please try again.');
      setSubmitting(false);
    }
  };

  if (!data) {
    return (
      <div style={S.overlay}>
        <div style={S.card}>
          <p style={{ ...S.muted, padding: 40, textAlign: 'center' }}>
            {error || 'Loading agreement…'}
          </p>
        </div>
      </div>
    );
  }

  const shown = expanded ? data.sections : data.sections.slice(0, data.preview_sections || 2);
  const canAgree = expanded && atBottom && !submitting;

  return (
    <div style={S.overlay}>
      <div style={S.card}>
        <div style={S.head}>
          <h2 style={S.title}>{data.title}</h2>
          <p style={S.sub}>Last updated {data.last_updated} · Please read and accept to continue.</p>
        </div>

        <div ref={bodyRef} onScroll={onScroll} style={S.body}>
          <p style={S.intro}>{data.intro}</p>
          {shown.map((sec) => (
            <div key={sec.n} style={S.section}>
              <h3 style={S.secHead}>
                {sec.n}. {sec.heading}
              </h3>
              <p style={S.secBody}>{sec.body}</p>
            </div>
          ))}

          {!expanded && (
            <button type="button" style={S.viewAll} onClick={viewAll}>
              View full agreement ↓
            </button>
          )}
          {expanded && !atBottom && <p style={S.scrollHint}>Scroll to the end to enable “Agree”.</p>}
        </div>

        {error && <p style={S.err}>{error}</p>}

        <div style={S.footer}>
          <button
            type="button"
            style={{ ...S.agree, ...(canAgree ? {} : S.agreeOff) }}
            disabled={!canAgree}
            onClick={agree}
          >
            {submitting ? 'Saving…' : expanded ? (atBottom ? 'Agree & Continue' : 'Scroll to the end') : 'View full agreement first'}
          </button>
        </div>
      </div>
    </div>
  );
}

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 2000,
    background: 'rgba(10, 12, 30, 0.62)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '82vh',
    margin: 'auto',
    display: 'flex',
    flexDirection: 'column',
    background: '#ffffff',
    borderRadius: 20,
    boxShadow: '0 24px 70px rgba(0,0,0,0.35)',
    overflow: 'hidden',
  },
  head: { padding: '22px 24px 14px', borderBottom: '1px solid #eef0f5' },
  title: { margin: 0, fontSize: 19, fontWeight: 800, color: '#12142e' },
  sub: { margin: '6px 0 0', fontSize: 13, color: '#6b7280' },
  body: { padding: '18px 24px', overflowY: 'auto', flex: 1 },
  intro: { margin: '0 0 16px', fontSize: 13.5, lineHeight: 1.6, color: '#374151', whiteSpace: 'pre-line' },
  section: { marginBottom: 16 },
  secHead: { margin: '0 0 6px', fontSize: 14.5, fontWeight: 800, color: '#1f2340' },
  secBody: { margin: 0, fontSize: 13.5, lineHeight: 1.6, color: '#374151', whiteSpace: 'pre-line' },
  viewAll: {
    marginTop: 8,
    padding: '11px 16px',
    width: '100%',
    border: '1px solid #d7daf0',
    background: '#eef0ff',
    color: '#3b41a8',
    fontWeight: 700,
    fontSize: 14,
    borderRadius: 11,
    cursor: 'pointer',
  },
  scrollHint: { marginTop: 14, textAlign: 'center', fontSize: 12.5, color: '#9aa0b4' },
  muted: { color: '#6b7280', fontSize: 14 },
  err: { margin: '0 24px', color: '#c0392b', fontSize: 13 },
  footer: { padding: '14px 24px', borderTop: '1px solid #eef0f5' },
  agree: {
    width: '100%',
    height: 46,
    border: 'none',
    borderRadius: 12,
    background: '#4C5BF3',
    color: '#fff',
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
  },
  agreeOff: { background: '#c3c7dd', cursor: 'not-allowed' },
};
