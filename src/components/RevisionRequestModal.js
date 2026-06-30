import { useState } from 'react';
import { X, Plus, Trash2, RefreshCw } from 'lucide-react';

/**
 * Structured revision-request form (PRD 8.5). Brand adds 1–5 items, each with a
 * severity + optional brief reference, optional notes, and a required timeline.
 * onSubmit({ items, notes, deadline_at }) — parent handles the API call.
 */
export default function RevisionRequestModal({ onClose, onSubmit, submitting = false, freeRemaining, nextFee }) {
  const [items, setItems] = useState([{ description: '', severity: 'must-fix', brief_reference: '' }]);
  const [notes, setNotes] = useState('');
  const [timeline, setTimeline] = useState('48h');   // '48h' | 'custom'
  const [customAt, setCustomAt] = useState('');

  const setItem = (i, patch) => setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const addItem = () => setItems((arr) => (arr.length >= 5 ? arr : [...arr, { description: '', severity: 'must-fix', brief_reference: '' }]));
  const removeItem = (i) => setItems((arr) => (arr.length <= 1 ? arr : arr.filter((_, idx) => idx !== i)));

  const submit = () => {
    const clean = items.map((it) => ({ ...it, description: it.description.trim() })).filter((it) => it.description);
    if (!clean.length) return;
    let deadline_at = null;
    if (timeline === '48h') deadline_at = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
    else if (customAt) deadline_at = new Date(customAt).toISOString();
    onSubmit({ items: clean, notes: notes.trim().slice(0, 500), deadline_at });
  };

  const canSubmit = items.some((it) => it.description.trim()) && (timeline === '48h' || customAt);

  return (
    <div className="rrm-ov" onClick={onClose}>
      <div className="rrm" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="rrm-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className="rrm-head">
          <span className="rrm-ic"><RefreshCw size={18} /></span>
          <div>
            <h3>Request a Revision</h3>
            <p>Be specific — add 1–5 changes you'd like the creator to make.</p>
          </div>
        </div>

        {typeof nextFee === 'number' && nextFee > 0 && (
          <div className="rrm-fee">This is a paid revision — ₹{nextFee} will be charged from your wallet.</div>
        )}
        {typeof freeRemaining === 'number' && freeRemaining > 0 && (
          <div className="rrm-free">{freeRemaining} free revision{freeRemaining > 1 ? 's' : ''} remaining.</div>
        )}

        <div className="rrm-body">
          <label className="rrm-label">Revision items <span>({items.length}/5)</span></label>
          {items.map((it, i) => (
            <div className="rrm-item" key={i}>
              <div className="rrm-item-top">
                <strong>Item {i + 1}</strong>
                {items.length > 1 && <button type="button" className="rrm-del" onClick={() => removeItem(i)} aria-label="Remove item"><Trash2 size={14} /></button>}
              </div>
              <textarea
                rows={2}
                placeholder="What should change? (e.g. 'Re-shoot the intro — lighting is too dark')"
                value={it.description}
                onChange={(e) => setItem(i, { description: e.target.value })}
              />
              <div className="rrm-item-row">
                <div className="rrm-sev">
                  <button type="button" className={it.severity === 'must-fix' ? 'on' : ''} onClick={() => setItem(i, { severity: 'must-fix' })}>Must-fix</button>
                  <button type="button" className={it.severity === 'preference' ? 'on' : ''} onClick={() => setItem(i, { severity: 'preference' })}>Preference</button>
                </div>
                <input
                  className="rrm-ref"
                  placeholder="Brief reference (optional)"
                  value={it.brief_reference}
                  onChange={(e) => setItem(i, { brief_reference: e.target.value })}
                />
              </div>
            </div>
          ))}
          {items.length < 5 && <button type="button" className="rrm-add" onClick={addItem}><Plus size={15} /> Add another item</button>}

          <label className="rrm-label">Additional notes <span>(optional)</span></label>
          <textarea
            className="rrm-notes"
            rows={2}
            maxLength={500}
            placeholder="Any extra context (max 500 chars)…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div className="rrm-count">{notes.length}/500</div>

          <label className="rrm-label">Timeline for revision</label>
          <div className="rrm-time">
            <button type="button" className={timeline === '48h' ? 'on' : ''} onClick={() => setTimeline('48h')}>48 hours from now</button>
            <button type="button" className={timeline === 'custom' ? 'on' : ''} onClick={() => setTimeline('custom')}>Pick a time</button>
            {timeline === 'custom' && (
              <input type="datetime-local" value={customAt} onChange={(e) => setCustomAt(e.target.value)} />
            )}
          </div>
        </div>

        <div className="rrm-foot">
          <button type="button" className="rrm-cancel" onClick={onClose}>Cancel</button>
          <button type="button" className="rrm-submit" onClick={submit} disabled={!canSubmit || submitting}>
            {submitting ? 'Sending…' : 'Send Revision Request'}
          </button>
        </div>

        <style>{`
          .rrm-ov{position:fixed;inset:0;background:rgba(15,22,58,.5);backdrop-filter:blur(3px);z-index:1500;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow:auto}
          .rrm{position:relative;width:min(620px,100%);background:#fff;border-radius:20px;box-shadow:0 30px 70px rgba(15,22,58,.4);overflow:hidden}
          .rrm-x{position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:50%;border:none;background:#f1f3fa;color:#15163a;cursor:pointer;display:grid;place-items:center}
          .rrm-head{display:flex;gap:12px;align-items:center;padding:22px 24px 14px;border-bottom:1px solid #eef0f6}
          .rrm-ic{flex:none;width:40px;height:40px;border-radius:11px;display:grid;place-items:center;background:#fff3e6;color:#e08a1e}
          .rrm-head h3{margin:0;font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:18px;color:#15163a}
          .rrm-head p{margin:2px 0 0;color:#9296ba;font-size:13px}
          .rrm-fee{margin:14px 24px 0;padding:10px 14px;background:#fff3e6;border:1px solid #ffd9a8;color:#9a5b00;border-radius:10px;font-size:13px;font-weight:600}
          .rrm-free{margin:14px 24px 0;padding:10px 14px;background:#eafaf0;border:1px solid #b6e6c7;color:#15a35b;border-radius:10px;font-size:13px;font-weight:600}
          .rrm-body{padding:18px 24px;max-height:60vh;overflow:auto}
          .rrm-label{display:block;font-size:12px;font-weight:800;color:#15163a;text-transform:uppercase;letter-spacing:.4px;margin:10px 0 8px}
          .rrm-label span{color:#9296ba;font-weight:600;text-transform:none;letter-spacing:0}
          .rrm-item{border:1px solid #eef0f6;border-radius:12px;padding:12px;margin-bottom:10px;background:#fbfbfe}
          .rrm-item-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
          .rrm-item-top strong{font-size:12.5px;color:#585c7e}
          .rrm-del{border:none;background:none;color:#9296ba;cursor:pointer;padding:2px}
          .rrm-del:hover{color:#e5484d}
          .rrm-item textarea,.rrm-notes,.rrm-ref,.rrm-time input{width:100%;border:1px solid #e6e8f3;border-radius:9px;padding:9px 11px;font-size:13.5px;font-family:inherit;color:#15163a;outline:none;box-sizing:border-box}
          .rrm-item textarea:focus,.rrm-notes:focus,.rrm-ref:focus{border-color:#5b6bff}
          .rrm-item-row{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
          .rrm-sev{display:inline-flex;gap:6px;flex:none}
          .rrm-sev button,.rrm-time button{border:1px solid #e6e8f3;background:#fff;color:#585c7e;border-radius:20px;padding:7px 13px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit}
          .rrm-sev button.on{background:#eef0ff;border-color:#5b6bff;color:#4452f0}
          .rrm-time button.on{background:#eef0ff;border-color:#5b6bff;color:#4452f0}
          .rrm-ref{flex:1;min-width:160px}
          .rrm-add{display:inline-flex;align-items:center;gap:6px;border:1px dashed #cdd4ff;background:#f6f7ff;color:#5b6bff;border-radius:10px;padding:9px 14px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit}
          .rrm-count{text-align:right;color:#9296ba;font-size:11.5px;margin-top:4px}
          .rrm-time{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
          .rrm-foot{display:flex;justify-content:flex-end;gap:10px;padding:16px 24px;border-top:1px solid #eef0f6}
          .rrm-cancel{border:1px solid #e6e8f3;background:#fff;color:#15163a;border-radius:30px;padding:11px 20px;font-weight:700;font-size:13.5px;cursor:pointer;font-family:inherit}
          .rrm-submit{border:none;background:linear-gradient(100deg,#5b6bff,#4452f0);color:#fff;border-radius:30px;padding:11px 22px;font-weight:800;font-size:13.5px;cursor:pointer;font-family:inherit}
          .rrm-submit:disabled{opacity:.5;cursor:not-allowed}
        `}</style>
      </div>
    </div>
  );
}
