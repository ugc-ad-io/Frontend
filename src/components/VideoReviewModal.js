import { useState, useRef } from 'react';
import { X, Trash2, RefreshCw, AlertTriangle, Send, MessageSquare, Play, Pause, Maximize2 } from 'lucide-react';
import { findContactInfo } from './RevisionRequestModal';

/**
 * Frame.io-style video review. The brand scrubs the submitted video and pins each
 * note to the exact moment it refers to ("at 0:04, change this"). Produces the
 * SAME payload as RevisionRequestModal — onSubmit({ items, notes, deadline_at }) —
 * with each item carrying `timestamp_seconds`, so the backend/creator flow is shared.
 *
 * No comment limit: one revision round can carry as many notes as the brand needs.
 * (The 1–5 item cap in request_revision() only guards the structured
 * /work/{id}/request-revision path; this flow posts a flat `feedback` string via
 * the deal endpoint, which has no such limit.)
 */

export const fmtTs = (s) => {
  const n = Math.max(0, Math.floor(Number(s) || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
};

export default function VideoReviewModal({
  src, title, onClose, onSubmit, submitting = false, freeRemaining, nextFee, watermark = true,
  // Read-only mode: the CREATOR opens the brand's review to see exactly where each
  // change is pinned. Comments are pre-loaded; compose/submit are hidden.
  readOnly = false, initialComments = [],
}) {
  const videoRef = useRef(null);
  const [now, setNow] = useState(0);
  const [duration, setDuration] = useState(0);
  const [comments, setComments] = useState(initialComments);
  const [draft, setDraft] = useState('');
  // Every video note is a required change — the brand no longer picks a severity,
  // but we still tag it so the "[must-fix @ 0:04]" format the creator's checklist
  // parses stays consistent with the text revision form.
  const severity = 'must-fix';
  // The moment is captured when typing STARTS, so the note stays pinned to what
  // the brand was looking at even if the video keeps playing while they type.
  const [pinned, setPinned] = useState(null);
  const [notes, setNotes] = useState('');
  const [timeline, setTimeline] = useState('48h');   // '24h' | '48h' | 'custom'
  const [customDeadline, setCustomDeadline] = useState('');
  const [playing, setPlaying] = useState(false);

  // datetime-local min = now (can't set a deadline in the past). Local time, no seconds.
  const minDeadline = (() => {
    const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
    return d.toISOString().slice(0, 16);
  })();

  const pinnedAt = pinned ?? now;

  const onDraftChange = (value) => {
    if (!draft && value) setPinned(videoRef.current?.currentTime ?? 0);
    setDraft(value);
  };

  const addComment = () => {
    const text = draft.trim();
    if (!text) return;
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

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
  };

  // Click anywhere on the track to jump there.
  const scrub = (e) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    v.currentTime = ratio * duration;
    setNow(v.currentTime);
  };

  const goFullscreen = () => {
    const v = videoRef.current;
    if (!v) return;
    (v.requestFullscreen || v.webkitRequestFullscreen || v.webkitEnterFullscreen)?.call(v);
  };

  const ordered = [...comments].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds);

  // Resolve the chosen deadline to an ISO timestamp. Custom must be a valid future date.
  const deadlineAt = (() => {
    if (timeline === 'custom') {
      const t = customDeadline ? new Date(customDeadline).getTime() : NaN;
      return Number.isNaN(t) ? null : new Date(t).toISOString();
    }
    const hours = timeline === '24h' ? 24 : 48;
    return new Date(Date.now() + hours * 3600 * 1000).toISOString();
  })();

  // Same on-platform guard as the text form — server rejects contact info too.
  const contactHit = comments.some((c) => findContactInfo(c.text)) || !!findContactInfo(notes) || !!findContactInfo(draft);
  // A custom deadline must be set and in the future before the brand can send.
  const deadlineValid = deadlineAt != null && (timeline !== 'custom' || new Date(deadlineAt).getTime() > Date.now());
  const canSubmit = comments.length > 0 && !contactHit && !submitting && deadlineValid;

  const submit = () => {
    if (!canSubmit) return;
    const items = ordered.map((c) => ({
      description: c.text,
      severity: c.severity,
      brief_reference: '',
      timestamp_seconds: c.timestamp_seconds,
    }));
    onSubmit({
      items,
      notes: notes.trim().slice(0, 500),
      deadline_at: deadlineAt,
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
            {/* No native `controls` — they render their own scrub bar, which sat
                right above ours and looked like two timelines. The custom track
                below is the single source of truth (and carries the markers). */}
            <video
              ref={videoRef}
              src={src}
              playsInline
              disablePictureInPicture={watermark}
              onContextMenu={watermark ? (e) => e.preventDefault() : undefined}
              onClick={togglePlay}
              onTimeUpdate={(e) => setNow(e.target.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.target.duration || 0)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
            />
            {watermark && <span className="vrm-wm" aria-hidden="true" />}
          </div>

          {/* The one and only scrub bar: click anywhere to seek, dots are comments. */}
          <div className="vrm-track">
            <div className="vrm-track-bar" onClick={scrub} role="slider" tabIndex={0}
                 aria-label="Seek" aria-valuemin={0} aria-valuemax={Math.floor(duration)} aria-valuenow={Math.floor(now)}>
              <span className="vrm-track-played" style={{ width: duration ? `${(now / duration) * 100}%` : 0 }} />
              {duration > 0 && ordered.map((c, i) => (
                c.timestamp_seconds == null ? null : (
                  <button
                    key={c.id}
                    type="button"
                    className="vrm-marker"
                    style={{ left: `${Math.min(100, (c.timestamp_seconds / duration) * 100)}%` }}
                    onClick={(e) => { e.stopPropagation(); seek(c.timestamp_seconds); }}
                    title={`${fmtTs(c.timestamp_seconds)} — ${c.text}`}
                  >
                    {i + 1}
                  </button>
                )
              ))}
            </div>
            <div className="vrm-ctrls">
              <button type="button" className="vrm-play" onClick={togglePlay} aria-label={playing ? 'Pause' : 'Play'}>
                {playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
              </button>
              <span className="vrm-track-time">{fmtTs(now)} / {fmtTs(duration)}</span>
              <button type="button" className="vrm-full" onClick={goFullscreen} aria-label="Fullscreen">
                <Maximize2 size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: comments ──────────────────────────────────────────── */}
        <div className="vrm-right">
          <div className="vrm-rhead">
            <span>{readOnly ? 'Requested changes' : 'Comments'}{comments.length > 0 && <b>{comments.length}</b>}</span>
            <button type="button" className="vrm-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
          </div>

          {readOnly && (
            <div className="vrm-free">Tap a timestamp to jump to the exact moment the brand marked for a change.</div>
          )}
          {!readOnly && typeof nextFee === 'number' && nextFee > 0 && (
            <div className="vrm-fee">Paid revision — ₹{nextFee} will be charged from your wallet.</div>
          )}
          {!readOnly && typeof freeRemaining === 'number' && freeRemaining > 0 && (
            <div className="vrm-free">{freeRemaining} free revision{freeRemaining > 1 ? 's' : ''} remaining.</div>
          )}
          {!readOnly && contactHit && (
            <div className="vrm-warn">
              <AlertTriangle size={15} />
              <span>Remove phone numbers and email addresses — keep communication on-platform.</span>
            </div>
          )}

          <div className="vrm-list">
            {ordered.length === 0 ? (
              <div className="vrm-empty">
                <p><MessageSquare size={17} /> No comments yet</p>
                <small>{readOnly
                  ? 'The brand left no timestamped notes on this video.'
                  : 'Play the video, pause where you want a change, and type below — your note is pinned to that moment.'}</small>
              </div>
            ) : ordered.map((c) => (
              <div className="vrm-c" key={c.id}>
                {c.timestamp_seconds != null ? (
                  <button type="button" className="vrm-c-ts" onClick={() => seek(c.timestamp_seconds)}>
                    {fmtTs(c.timestamp_seconds)}
                  </button>
                ) : (
                  <span className="vrm-c-ts vrm-c-ts--general" title="General note (no timestamp)">general</span>
                )}
                <div className="vrm-c-body">
                  <p>{c.text}</p>
                </div>
                {!readOnly && (
                  <button type="button" className="vrm-c-del" onClick={() => removeComment(c.id)} aria-label="Remove comment">
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {readOnly ? (
            <div className="vrm-compose">
              <button type="button" className="vrm-submit" onClick={onClose}>Got it</button>
            </div>
          ) : (
          <div className="vrm-compose">
            <div className="vrm-input">
              <span className="vrm-at">{fmtTs(pinnedAt)}</span>
              <textarea
                rows={2}
                value={draft}
                placeholder="At this point I want…"
                onChange={(e) => onDraftChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment(); } }}
              />
              <button type="button" className="vrm-send" onClick={addComment} disabled={!draft.trim()} aria-label="Add comment">
                <Send size={16} />
              </button>
            </div>

            {/* Revision deadline — how long the creator has to resubmit. */}
            <div className="vrm-deadline">
              <label>Revision deadline</label>
              <div className="vrm-time">
                <button type="button" className={timeline === '24h' ? 'on' : ''} onClick={() => setTimeline('24h')}>24 hours</button>
                <button type="button" className={timeline === '48h' ? 'on' : ''} onClick={() => setTimeline('48h')}>48 hours</button>
                <button type="button" className={timeline === 'custom' ? 'on' : ''} onClick={() => setTimeline('custom')}>Pick a date</button>
              </div>
              {timeline === 'custom' && (
                <input
                  type="datetime-local"
                  className="vrm-deadline-input"
                  value={customDeadline}
                  min={minDeadline}
                  onChange={(e) => setCustomDeadline(e.target.value)}
                />
              )}
            </div>

            <details className="vrm-more">
              <summary>Add a note (optional)</summary>
              <textarea
                className="vrm-notes"
                rows={2}
                maxLength={500}
                placeholder="Any extra context (max 500 chars)…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </details>

            <button type="button" className="vrm-submit" onClick={submit} disabled={!canSubmit}>
              {submitting ? 'Sending…' : 'Send Changes'}
            </button>
          </div>
          )}
        </div>

        <style>{`
          .vrm-ov{position:fixed;inset:0;background:rgba(8,10,26,.72);backdrop-filter:blur(4px);z-index:1600;display:flex;align-items:center;justify-content:center;padding:20px}
          .vrm{display:flex;width:min(1180px,100%);height:min(760px,92vh);background:#0f1120;border-radius:18px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.55)}
          .vrm-left{flex:1;min-width:0;display:flex;flex-direction:column;background:#0b0d18}
          .vrm-lhead{display:flex;align-items:center;gap:9px;padding:14px 18px;color:#e8eaf6;font-size:13.5px;border-bottom:1px solid rgba(255,255,255,.07)}
          .vrm-lhead strong{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
          .vrm-stage{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;background:#000;overflow:hidden}
          /* Fill the stage and letterbox with object-fit:contain so the WHOLE frame
             is always visible (a portrait clip no longer overflows and gets its
             bottom cropped) — no fullscreen needed. */
          .vrm-stage video{width:100%;height:100%;object-fit:contain;display:block}
          /* Hard-guarantee a single timeline: even if the browser (or a stray
             \`controls\` attribute) tries to draw native controls, keep them hidden —
             the custom track below is the only scrub bar. */
          .vrm-stage video::-webkit-media-controls,
          .vrm-stage video::-webkit-media-controls-enclosure,
          .vrm-stage video::-webkit-media-controls-panel{display:none !important;-webkit-appearance:none !important}
          .vrm-wm{position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(-30deg,rgba(255,255,255,.09) 0 2px,transparent 2px 190px)}
          .vrm-track{padding:12px 18px 16px;border-top:1px solid rgba(255,255,255,.07)}
          .vrm-track-bar{position:relative;height:6px;border-radius:6px;background:rgba(255,255,255,.14);margin-bottom:10px;cursor:pointer}
          .vrm-track-bar::before{content:'';position:absolute;inset:-9px 0;}/* bigger click target */
          .vrm-track-played{position:absolute;left:0;top:0;bottom:0;border-radius:6px;background:#5b6bff;pointer-events:none}
          .vrm-marker{position:absolute;top:50%;transform:translate(-50%,-50%);width:19px;height:19px;border-radius:50%;border:2px solid #0b0d18;background:#e5484d;color:#fff;font-size:10px;font-weight:800;cursor:pointer;display:grid;place-items:center;padding:0;z-index:1}
          .vrm-ctrls{display:flex;align-items:center;gap:12px}
          .vrm-play,.vrm-full{border:none;background:rgba(255,255,255,.09);color:#e8eaf6;width:32px;height:32px;border-radius:9px;cursor:pointer;display:grid;place-items:center;flex:none}
          .vrm-play:hover,.vrm-full:hover{background:rgba(255,255,255,.18)}
          .vrm-full{margin-left:auto}
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
          .vrm-empty p{display:flex;align-items:center;justify-content:center;gap:8px;margin:0 0 6px;color:#9ba0c9;font-weight:600;font-size:14px}
          .vrm-empty small{font-size:12px;line-height:1.5;display:block}
          .vrm-c{display:flex;gap:9px;align-items:flex-start;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:11px;padding:10px}
          .vrm-c-ts{flex:none;border:none;background:rgba(91,107,255,.2);color:#a5b0ff;font-size:11.5px;font-weight:800;padding:3px 8px;border-radius:6px;cursor:pointer;font-variant-numeric:tabular-nums}
          .vrm-c-ts:hover{background:rgba(91,107,255,.34);color:#fff}
          .vrm-c-ts--general{background:rgba(255,255,255,.08);color:#9ba0c9;cursor:default}
          .vrm-c-body{flex:1;min-width:0}
          .vrm-c-body p{margin:0;color:#dfe2f5;font-size:13px;line-height:1.45;word-break:break-word}
          .vrm-c-del{flex:none;border:none;background:none;color:#6f74a0;cursor:pointer;padding:2px}
          .vrm-c-del:hover{color:#e5484d}
          .vrm-compose{border-top:1px solid rgba(255,255,255,.07);padding:12px 16px 14px}
          .vrm-time button{border:1px solid rgba(255,255,255,.12);background:transparent;color:#9ba0c9;border-radius:20px;padding:5px 12px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit}
          .vrm-time button.on{background:rgba(91,107,255,.22);border-color:#5b6bff;color:#c3caff}
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
          .vrm-time{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
          .vrm-deadline{margin-top:2px}
          .vrm-deadline > label{display:block;color:#9ba0c9;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.4px}
          .vrm-deadline-input{margin-top:8px;width:100%;box-sizing:border-box;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#e8eaf6;border-radius:9px;padding:8px 10px;font-family:inherit;font-size:12.5px;outline:none;color-scheme:dark}
          .vrm-deadline-input:focus{border-color:#5b6bff}
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
