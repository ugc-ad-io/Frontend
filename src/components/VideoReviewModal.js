import { useState, useRef } from 'react';
import { X, Trash2, RefreshCw, AlertTriangle, Send, MessageSquare } from 'lucide-react';
import { findContactInfo } from './RevisionRequestModal';

/**
 * Frame.io-style video review. The brand scrubs the submitted video and pins each
 * note to the exact moment it refers to ("at 0:04, change this"). Produces the
 * SAME payload as RevisionRequestModal — onSubmit({ items, notes, deadline_at }) —
 * with each item carrying `timestamp_seconds`, so the backend/creator flow is shared.
 *
 * Capped at 5 comments because request_revision() rejects more than 5 items.
 */

const MAX_ITEMS = 5;

export const fmtTs = (s) => {
  const n = Math.max(0, Math.floor(Number(s) || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
};

export default function VideoReviewModal({
  src, title, onClose, onSubmit, submitting = false, freeRemaining, nextFee, watermark = true,
}) {
  const videoRef = useRef(null);
  const [now, setNow] = useState(0);
  const [duration, setDuration] = useState(0);
  const [comments, setComments] = useState([]);
  const [draft, setDraft] = useState('');
  const [severity, setSeverity] = useState('must-fix');
  // The moment is captured when typing STARTS, so the note stays pinned to what
  // the brand was looking at even if the video keeps playing while they type.
  const [pinned, setPinned] = useState(null);
  const [notes, setNotes] = useState('');
  const [timeline, setTimeline] = useState('48h');

  const atFull = comments.length >= MAX_ITEMS;
  const pinnedAt = pinned ?? now;

  const onDraftChange = (value) => {
    if (!draft && value) setPinned(videoRef.current?.currentTime ?? 0);
    setDraft(value);
  };

  const addComment = () => {
    const text = draft.trim();
    if (!text || atFull) return;
    const ts = pinned ?? videoRef.current?.currentTime ?? 0;
    setComments((c) => [...c, {
      id: `${Date.now()}-${c.length}`,
      text,
      severity,
      timestamp_seconds: Math.round(ts * 10) / 10,
    }]);
    setDraft('');
    setPinned(null);
  };

  const removeComment = (id) => setComments((c) => c.filter((x) => x.id !== id));

  const seek = (ts) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = ts;
    v.pause();
    setNow(ts);
  };

  const ordered = [...comments].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds);

  // Same on-platform guard as the text form — server rejects contact info too.
  const contactHit = comments.some((c) => findContactInfo(c.text)) || !!findContactInfo(notes) || !!findContactInfo(draft);
  const canSubmit = comments.length > 0 && !contactHit && !submitting;

  const submit = () => {
    if (!canSubmit) return;
    const items = ordered.map((c) => ({
      description: c.text,
      severity: c.severity,
      brief_reference: '',
      timestamp_seconds: c.timestamp_seconds,
    }));
    const hours = timeline === '24h' ? 24 : 48;
    onSubmit({
      items,
      notes: notes.trim().slice(0, 500),
      deadline_at: new Date(Date.now() + hours * 3600 * 1000).toISOString(),
    });
  };

  return (
    <div className="vrm-ov" onClick={onClose}>
      <div className="vrm" onClick={(e) => e.stopPropagation()}>
        {/* ── Left: player ─────────────────────────────────────────────── */}
        <div className="vrm-left">
          <div className="vrm-lhead">
            <RefreshCw size={16} />
            <strong>{title || 'Review submission'}</strong>
          </div>

          <div className="vrm-stage">
            <video
              ref={videoRef}
              src={src}
              controls
              playsInline
              controlsList={watermark ? 'nodownload noremoteplayback' : undefined}
              disablePictureInPicture={watermark}
              onContextMenu={watermark ? (e) => e.preventDefault() : undefined}
              onTimeUpdate={(e) => setNow(e.target.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.target.duration || 0)}
            />
            {watermark && <span className="vrm-wm" aria-hidden="true" />}
          </div>

          {/* Marker track — a dot per pinned comment; click to jump back. */}
          <div className="vrm-track" aria-hidden={ordered.length === 0}>
            <div className="vrm-track-bar">
              <span className="vrm-track-played" style={{ width: duration ? `${(now / duration) * 100}%` : 0 }} />
              {duration > 0 && ordered.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  className={`vrm-marker ${c.severity === 'must-fix' ? 'must' : 'pref'}`}
                  style={{ left: `${Math.min(100, (c.timestamp_seconds / duration) * 100)}%` }}
                  onClick={() => seek(c.timestamp_seconds)}
                  title={`${fmtTs(c.timestamp_seconds)} — ${c.text}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <div className="vrm-track-time">{fmtTs(now)} / {fmtTs(duration)}</div>
          </div>
        </div>

        {/* ── Right: comments ──────────────────────────────────────────── */}
        <div className="vrm-right">
          <div className="vrm-rhead">
            <span>Comments <b>{comments.length}/{MAX_ITEMS}</b></span>
            <button type="button" className="vrm-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
          </div>

          {typeof nextFee === 'number' && nextFee > 0 && (
            <div className="vrm-fee">Paid revision — ₹{nextFee} will be charged from your wallet.</div>
          )}
          {typeof freeRemaining === 'number' && freeRemaining > 0 && (
            <div className="vrm-free">{freeRemaining} free revision{freeRemaining > 1 ? 's' : ''} remaining.</div>
          )}
          {contactHit && (
            <div className="vrm-warn">
              <AlertTriangle size={15} />
              <span>Remove phone numbers and email addresses — keep communication on-platform.</span>
            </div>
          )}

          <div className="vrm-list">
            {ordered.length === 0 ? (
              <div className="vrm-empty">
                <MessageSquare size={30} />
                <p>No comments yet</p>
                <small>Play the video, pause where you want a change, and type below — your note is pinned to that moment.</small>
              </div>
            ) : ordered.map((c) => (
              <div className="vrm-c" key={c.id}>
                <button type="button" className="vrm-c-ts" onClick={() => seek(c.timestamp_seconds)}>
                  {fmtTs(c.timestamp_seconds)}
                </button>
                <div className="vrm-c-body">
                  <span className={`vrm-c-sev ${c.severity === 'must-fix' ? 'must' : 'pref'}`}>
                    {c.severity === 'must-fix' ? 'Must-fix' : 'Preference'}
                  </span>
                  <p>{c.text}</p>
                </div>
                <button type="button" className="vrm-c-del" onClick={() => removeComment(c.id)} aria-label="Remove comment">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="vrm-compose">
            <div className="vrm-sev-row">
              <button type="button" className={severity === 'must-fix' ? 'on' : ''} onClick={() => setSeverity('must-fix')}>Must-fix</button>
              <button type="button" className={severity === 'preference' ? 'on' : ''} onClick={() => setSeverity('preference')}>Preference</button>
            </div>
            <div className="vrm-input">
              <span className="vrm-at">{fmtTs(pinnedAt)}</span>
              <textarea
                rows={2}
                value={draft}
                disabled={atFull}
                placeholder={atFull ? `Maximum ${MAX_ITEMS} comments reached` : 'At this point I want…'}
                onChange={(e) => onDraftChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment(); } }}
              />
              <button type="button" className="vrm-send" onClick={addComment} disabled={!draft.trim() || atFull} aria-label="Add comment">
                <Send size={16} />
              </button>
            </div>

            <details className="vrm-more">
              <summary>Notes &amp; timeline</summary>
              <textarea
                className="vrm-notes"
                rows={2}
                maxLength={500}
                placeholder="Any extra context (max 500 chars)…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="vrm-time">
                <button type="button" className={timeline === '24h' ? 'on' : ''} onClick={() => setTimeline('24h')}>24 hours</button>
                <button type="button" className={timeline === '48h' ? 'on' : ''} onClick={() => setTimeline('48h')}>48 hours</button>
              </div>
            </details>

            <button type="button" className="vrm-submit" onClick={submit} disabled={!canSubmit}>
              {submitting ? 'Sending…' : `Send ${comments.length || ''} Revision${comments.length === 1 ? '' : 's'}`.replace('  ', ' ')}
            </button>
          </div>
        </div>

        <style>{`
          .vrm-ov{position:fixed;inset:0;background:rgba(8,10,26,.72);backdrop-filter:blur(4px);z-index:1600;display:flex;align-items:center;justify-content:center;padding:20px}
          .vrm{display:flex;width:min(1180px,100%);height:min(760px,92vh);background:#0f1120;border-radius:18px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.55)}
          .vrm-left{flex:1;min-width:0;display:flex;flex-direction:column;background:#0b0d18}
          .vrm-lhead{display:flex;align-items:center;gap:9px;padding:14px 18px;color:#e8eaf6;font-size:13.5px;border-bottom:1px solid rgba(255,255,255,.07)}
          .vrm-lhead strong{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
          .vrm-stage{position:relative;flex:1;min-height:0;display:grid;place-items:center;background:#000;overflow:hidden}
          .vrm-stage video{max-width:100%;max-height:100%;display:block}
          .vrm-wm{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(-30deg,rgba(255,255,255,.09) 0 2px,transparent 2px 190px)}
          .vrm-track{padding:12px 18px 16px;border-top:1px solid rgba(255,255,255,.07)}
          .vrm-track-bar{position:relative;height:6px;border-radius:6px;background:rgba(255,255,255,.14);margin-bottom:8px}
          .vrm-track-played{position:absolute;left:0;top:0;bottom:0;border-radius:6px;background:#5b6bff}
          .vrm-marker{position:absolute;top:50%;transform:translate(-50%,-50%);width:19px;height:19px;border-radius:50%;border:2px solid #0b0d18;color:#fff;font-size:10px;font-weight:800;cursor:pointer;display:grid;place-items:center;padding:0}
          .vrm-marker.must{background:#e5484d}
          .vrm-marker.pref{background:#f5a524}
          .vrm-track-time{color:#8b90b5;font-size:12px;font-variant-numeric:tabular-nums}
          .vrm-right{width:370px;flex:none;display:flex;flex-direction:column;background:#141728;border-left:1px solid rgba(255,255,255,.07)}
          .vrm-rhead{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;color:#e8eaf6;font-size:14px;border-bottom:1px solid rgba(255,255,255,.07)}
          .vrm-rhead b{color:#8b90b5;font-weight:600;margin-left:4px}
          .vrm-x{width:32px;height:32px;border-radius:9px;border:none;background:rgba(255,255,255,.07);color:#e8eaf6;cursor:pointer;display:grid;place-items:center}
          .vrm-x:hover{background:rgba(255,255,255,.14)}
          .vrm-fee,.vrm-free,.vrm-warn{margin:12px 16px 0;padding:9px 12px;border-radius:9px;font-size:12.5px;font-weight:600;line-height:1.4}
          .vrm-fee{background:rgba(245,165,36,.14);color:#f5a524}
          .vrm-free{background:rgba(34,165,101,.15);color:#4ade80}
          .vrm-warn{display:flex;gap:8px;align-items:flex-start;background:rgba(229,72,77,.15);color:#ff8085}
          .vrm-warn svg{flex:none;margin-top:1px}
          .vrm-list{flex:1;min-height:0;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:10px}
          .vrm-empty{margin:auto;text-align:center;color:#6f74a0;padding:20px}
          .vrm-empty p{margin:10px 0 4px;color:#9ba0c9;font-weight:600;font-size:14px}
          .vrm-empty small{font-size:12px;line-height:1.5;display:block}
          .vrm-c{display:flex;gap:9px;align-items:flex-start;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:11px;padding:10px}
          .vrm-c-ts{flex:none;border:none;background:rgba(91,107,255,.2);color:#a5b0ff;font-size:11.5px;font-weight:800;padding:3px 8px;border-radius:6px;cursor:pointer;font-variant-numeric:tabular-nums}
          .vrm-c-ts:hover{background:rgba(91,107,255,.34);color:#fff}
          .vrm-c-body{flex:1;min-width:0}
          .vrm-c-sev{display:inline-block;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.4px;padding:2px 6px;border-radius:5px;margin-bottom:4px}
          .vrm-c-sev.must{background:rgba(229,72,77,.18);color:#ff8085}
          .vrm-c-sev.pref{background:rgba(245,165,36,.18);color:#f5a524}
          .vrm-c-body p{margin:0;color:#dfe2f5;font-size:13px;line-height:1.45;word-break:break-word}
          .vrm-c-del{flex:none;border:none;background:none;color:#6f74a0;cursor:pointer;padding:2px}
          .vrm-c-del:hover{color:#e5484d}
          .vrm-compose{border-top:1px solid rgba(255,255,255,.07);padding:12px 16px 14px}
          .vrm-sev-row{display:flex;gap:6px;margin-bottom:8px}
          .vrm-sev-row button,.vrm-time button{border:1px solid rgba(255,255,255,.12);background:transparent;color:#9ba0c9;border-radius:20px;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit}
          .vrm-sev-row button.on,.vrm-time button.on{background:rgba(91,107,255,.22);border-color:#5b6bff;color:#c3caff}
          .vrm-input{display:flex;align-items:flex-start;gap:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:11px;padding:8px}
          .vrm-input:focus-within{border-color:#5b6bff}
          .vrm-at{flex:none;background:rgba(245,165,36,.18);color:#f5a524;font-size:11.5px;font-weight:800;padding:3px 7px;border-radius:6px;font-variant-numeric:tabular-nums;margin-top:2px}
          .vrm-input textarea{flex:1;min-width:0;border:none;background:none;color:#e8eaf6;font-family:inherit;font-size:13px;resize:none;outline:none;padding:2px 0}
          .vrm-input textarea::placeholder{color:#6f74a0}
          .vrm-send{flex:none;border:none;background:#5b6bff;color:#fff;width:32px;height:32px;border-radius:9px;cursor:pointer;display:grid;place-items:center}
          .vrm-send:disabled{opacity:.4;cursor:not-allowed}
          .vrm-more{margin:10px 0}
          .vrm-more summary{color:#9ba0c9;font-size:12.5px;cursor:pointer;user-select:none}
          .vrm-notes{width:100%;box-sizing:border-box;margin-top:8px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#e8eaf6;border-radius:9px;padding:8px 10px;font-family:inherit;font-size:12.5px;resize:none;outline:none}
          .vrm-time{display:flex;gap:6px;margin-top:8px}
          .vrm-submit{width:100%;margin-top:10px;border:none;background:#5b6bff;color:#fff;border-radius:11px;padding:11px;font-family:inherit;font-size:13.5px;font-weight:800;cursor:pointer}
          .vrm-submit:hover:not(:disabled){background:#4452f0}
          .vrm-submit:disabled{opacity:.45;cursor:not-allowed}
          @media (max-width:900px){
            .vrm{flex-direction:column;height:94vh}
            .vrm-right{width:auto;border-left:none;border-top:1px solid rgba(255,255,255,.07);max-height:52%}
            .vrm-left{max-height:48%}
          }
        `}</style>
      </div>
    </div>
  );
}
