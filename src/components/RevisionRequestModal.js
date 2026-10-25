import { useState } from 'react';
import { X, Plus, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import { MAX_REVISION_ITEMS, revisionItemCount, buildRevisionPayload, revisionFeeNotice } from '../utils/revisionPayload';

/**
 * Keep the deal on-platform: brands must not pass the creator phone numbers or
 * email addresses through a revision request. Returns 'email' | 'phone' | null.
 * Mirrors the server-side guard in request_deal_revision (server.py).
 */
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /\+?\d[\d\s().-]{5,}\d/g;
export function findContactInfo(text) {
  const s = String(text || '');
  if (EMAIL_RE.test(s)) return 'email';
  const matches = s.match(PHONE_RE) || [];
  for (const m of matches) {
    if (m.replace(/\D/g, '').length >= 7) return 'phone';
  }
  return null;
}

/**
 * Structured revision-request form (PRD 8.5). Brand adds 1–5 items, each with a
 * severity + optional brief reference, optional notes, and a required timeline.
 * onSubmit({ items, notes, deadline_at }) — parent handles the API call.
 */
export default function RevisionRequestModal({ onClose, onSubmit, submitting = false, freeRemaining, nextFee, paidFee }) {
  // `severity` and `brief_reference` are no longer chosen by the brand (the
  // toggle + reference input were removed) but stay on each item as fixed
  // defaults so the submitted payload — and the "[must-fix] …" text the creator's
  // checklist parses — keeps the same shape.
  const [items, setItems] = useState([{ description: '', severity: 'must-fix', brief_reference: '' }]);
  const [notes, setNotes] = useState('');
  const [timeline, setTimeline] = useState('48h');   // '24h' | '48h'

  const setItem = (i, patch) => setItems((arr) => arr.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  // A typed note is sent as an item too, so it takes one of the five slots.
  const used = revisionItemCount(items.length, notes);
  const addItem = () => setItems((arr) => (revisionItemCount(arr.length, notes) >= MAX_REVISION_ITEMS ? arr : [...arr, { description: '', severity: 'must-fix', brief_reference: '' }]));
  const removeItem = (i) => setItems((arr) => (arr.length <= 1 ? arr : arr.filter((_, idx) => idx !== i)));

  // Scan every free-text field the brand can type into for phone/email.
  const contactHit = items.some((it) => findContactInfo(it.description)) || !!findContactInfo(notes);

  const submit = () => {
    const clean = items.map((it) => ({ ...it, description: it.description.trim() })).filter((it) => it.description);
    if (!clean.length) return;
    if (contactHit) return; // hard block — server rejects it too
    const hours = timeline === '24h' ? 24 : 48;
    const deadline_at = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    if (revisionItemCount(clean.length, notes) > MAX_REVISION_ITEMS) return;
    onSubmit(buildRevisionPayload(clean.map((it) => ({ description: it.description })), notes, deadline_at));
  };

  const filled = items.filter((it) => it.description.trim()).length;
  const canSubmit = filled > 0 && revisionItemCount(filled, notes) <= MAX_REVISION_ITEMS && !contactHit;
  const feeNotice = revisionFeeNotice({ freeRemaining, nextFee, paidFee });

  return (
    <div className="rrm-ov" onClick={onClose}>
      <div className="rrm" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="rrm-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <div className="rrm-head">
          <span className="rrm-ic"><RefreshCw size={18} /></span>
          <div>
            <h3>Request a Revision</h3>
            <p>Be specific - add 1–5 changes you'd like the creator to make.</p>
          </div>
        </div>

        {feeNotice && (
          <div className={feeNotice.kind === 'free' ? 'rrm-free' : 'rrm-fee'}>{feeNotice.text}</div>
        )}
        {contactHit && (
          <div className="rrm-warn">
            <AlertTriangle size={15} />
            <span>Please remove phone numbers and email addresses. Keep all communication on-platform - sharing contact details isn't allowed.</span>
          </div>
        )}

        <div className="rrm-body">
          <label className="rrm-label">Revision items <span>({used}/{MAX_REVISION_ITEMS}{notes.trim() ? ', your note counts as one' : ''})</span></label>
          {items.map((it, i) => (
            <div className="rrm-item" key={i}>
              <div className="rrm-item-top">
                <strong>Item {i + 1}</strong>
                {items.length > 1 && <button type="button" className="rrm-del" onClick={() => removeItem(i)} aria-label="Remove item"><Trash2 size={14} /></button>}
              </div>
              <textarea
                rows={2}
                placeholder="What should change? (e.g. 'Re-shoot the intro - lighting is too dark')"
                value={it.description}
                onChange={(e) => setItem(i, { description: e.target.value })}
              />
            </div>
          ))}
          {used < MAX_REVISION_ITEMS && <button type="button" className="rrm-add" onClick={addItem}><Plus size={15} /> Add another item</button>}

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
            <button type="button" className={timeline === '24h' ? 'on' : ''} onClick={() => setTimeline('24h')}>24 hours from now</button>
            <button type="button" className={timeline === '48h' ? 'on' : ''} onClick={() => setTimeline('48h')}>48 hours from now</button>
          </div>
        </div>

        <div className="rrm-foot">
          <button type="button" className="rrm-cancel" onClick={onClose}>Cancel</button>
          <button type="button" className="rrm-submit" onClick={submit} disabled={!canSubmit || submitting}>
            {submitting ? 'Sending…' : 'Send Revision Request'}
          </button>
        </div>

        <style>{`
          .rrm-ov{position:fixed;inset:0;background:rgba(7,7,78,.45);backdrop-filter:blur(3px);z-index:1500;display:flex;align-items:flex-start;justify-content:center;padding:24px;overflow:auto;height:100vh;height:100dvh;overscroll-behavior:contain}
          .rrm{position:relative;width:min(560px,100%);background:#fff;border-radius:20px;box-shadow:0 40px 80px -30px rgba(7,7,78,.6);overflow:hidden;font-family:'Inter',system-ui,sans-serif;color:#07074e;margin:auto}
          .rrm-x{position:absolute;top:14px;right:14px;width:32px;height:32px;border-radius:9px;border:none;background:#f6f6fd;color:#07074e;cursor:pointer;display:grid;place-items:center}
          .rrm-x:hover{background:#eef0ff}
          .rrm-head{display:flex;gap:12px;align-items:center;padding:22px 64px 14px 24px;border-bottom:1px solid #edeef6}
          .rrm-ic{flex:none;width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:#eef0ff;color:#4e60e6}
          .rrm-head h3{margin:0;font-family:'Readex Pro','Plus Jakarta Sans',sans-serif;font-weight:500;font-size:20px;color:#07074e}
          .rrm-head p{margin:2px 0 0;color:#6e6e96;font-size:13.5px}
          .rrm-fee,.rrm-free,.rrm-warn{margin:14px 24px 0;padding:10px 14px;border-radius:12px;font-size:13px;font-weight:600;line-height:1.4}
          .rrm-fee{background:#fff2dc;color:#8a4b00}
          .rrm-free{background:#e4f5ec;color:#13774f}
          .rrm-warn{display:flex;gap:8px;align-items:flex-start;background:#fde8e8;color:#b42318}
          .rrm-warn svg{flex:none;margin-top:1px}
          .rrm-body{padding:18px 24px;max-height:60vh;overflow:auto}
          .rrm-label{display:block;font-size:13px;font-weight:700;color:#07074e;margin:10px 0 8px}
          .rrm-label span{color:#6e6e96;font-weight:500}
          .rrm-item{border-radius:16px;padding:12px;margin-bottom:10px;background:#f6f6fd}
          .rrm-item-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
          .rrm-item-top strong{font-size:13px;color:#5a5a8c;font-weight:600}
          .rrm-del{border:none;background:none;color:#9f9fd1;cursor:pointer;padding:2px}
          .rrm-del:hover{color:#e5484d}
          .rrm-item textarea,.rrm-notes,.rrm-time input{width:100%;border:1.5px solid transparent;border-radius:12px;padding:10px 12px;font-size:14px;font-family:inherit;color:#07074e;background:#fff;outline:none;box-sizing:border-box;resize:vertical}
          .rrm-notes{background:#f6f6fd;border-radius:16px}
          .rrm-item textarea:focus,.rrm-notes:focus{background:#fff;border-color:#7387ff;box-shadow:0 0 0 3px rgba(115,135,255,.2)}
          .rrm-time button{border:1px solid #c9cbea;background:#fff;color:#07074e;border-radius:999px;padding:7px 14px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}
          .rrm-time button:hover{background:#f3f3ff}
          .rrm-time button.on{background:#07074e;border-color:#07074e;color:#fff}
          .rrm-add{display:inline-flex;align-items:center;gap:6px;border:1.5px dashed #9f9fd1;background:#fff;color:#4e60e6;border-radius:12px;padding:9px 14px;font-size:13.5px;font-weight:600;cursor:pointer;font-family:inherit}
          .rrm-add:hover{background:#f6f6fd}
          .rrm-count{text-align:right;color:#6e6e96;font-size:12px;margin-top:4px}
          .rrm-time{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
          .rrm-foot{display:flex;justify-content:flex-end;gap:10px;padding:16px 24px;border-top:1px solid #edeef6}
          .rrm-cancel,.rrm-submit{height:48px;border-radius:999px;padding:0 24px;font-weight:700;font-size:14.5px;cursor:pointer;font-family:inherit;border:1px solid transparent}
          .rrm-cancel{background:#fff;border-color:#c9cbea;color:#07074e}
          .rrm-cancel:hover{background:#f3f3ff}
          .rrm-submit{background:#07074e;color:#fff}
          .rrm-submit:hover:not(:disabled){background:#12124f}
          .rrm-submit:disabled{opacity:.55;cursor:not-allowed}
          @media (max-width:768px){
            .rrm-ov{padding:max(12px,env(safe-area-inset-top,0px)) 12px max(12px,env(safe-area-inset-bottom,0px))}
            .rrm{display:flex;flex-direction:column;max-height:calc(100vh - 24px);max-height:calc(100dvh - 24px - env(safe-area-inset-top,0px) - env(safe-area-inset-bottom,0px))}
            .rrm-body{flex:1;min-height:0;max-height:none;overflow:auto;padding:16px}
            .rrm-head,.rrm-fee,.rrm-free,.rrm-warn,.rrm-foot{flex:none}
            .rrm-head{padding:18px 64px 12px 16px}
            .rrm-fee,.rrm-free,.rrm-warn{margin-left:16px;margin-right:16px}
            .rrm-foot{padding:12px 16px;flex-wrap:wrap}
            .rrm-foot button{flex:1 1 140px}
            .rrm-x{width:44px;height:44px;top:10px;right:10px}
            .rrm-del{min-width:44px;min-height:44px;display:grid;place-items:center;padding:0}
            .rrm-add,.rrm-time button{min-height:44px}
            .rrm-time button{padding:0 16px}
            .rrm-item textarea,.rrm-notes{font-size:16px}
          }
        `}</style>
      </div>
    </div>
  );
}
