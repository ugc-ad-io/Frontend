import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import '../styles/web1-misc.css';

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
      <div className="w1 ag-ov">
        <div className="ag-card">
          <p className="ag-load">{error || 'Loading agreement…'}</p>
        </div>
      </div>
    );
  }

  const shown = expanded ? data.sections : data.sections.slice(0, data.preview_sections || 2);
  const canAgree = expanded && atBottom && !submitting;

  return (
    <div className="w1 ag-ov">
      <div className="ag-card" role="dialog" aria-modal="true" aria-label={data.title}>
        <div className="ag-head">
          <h2>{data.title}</h2>
          <p>Last updated {data.last_updated} · Please read and accept to continue.</p>
        </div>

        <div ref={bodyRef} onScroll={onScroll} className="ag-body">
          <p className="ag-intro">{data.intro}</p>
          {shown.map((sec) => (
            <div key={sec.n} className="ag-sec">
              <h3>
                {sec.n}. {sec.heading}
              </h3>
              <p>{sec.body}</p>
            </div>
          ))}

          {!expanded && (
            <button type="button" className="ag-viewall" onClick={viewAll}>
              View full agreement
            </button>
          )}
          {expanded && !atBottom && <p className="ag-hint">Scroll to the end to enable “Agree”.</p>}
        </div>

        {error && <p className="ag-err">{error}</p>}

        <div className="ag-foot">
          <button type="button" className="w1-btn" disabled={!canAgree} onClick={agree}>
            {submitting ? 'Saving…' : expanded ? (atBottom ? 'Agree & Continue' : 'Scroll to the end') : 'View full agreement first'}
          </button>
        </div>
      </div>
    </div>
  );
}
