import { mediaUrl } from '../utils/mediaUrl';
import { useState, useRef } from 'react';
import { X, Trash2, RefreshCw, AlertTriangle, Send, MessageSquare, Play, Pause, Maximize2 } from 'lucide-react';
import { findContactInfo } from './RevisionRequestModal';
import { MAX_REVISION_ITEMS, revisionItemCount, buildRevisionPayload, revisionFeeNotice } from '../utils/revisionPayload';

/**
 * Frame.io-style video review. The brand scrubs the submitted video and pins each
 * note to the exact moment it refers to ("at 0:04, change this"). Produces the
 * SAME payload as RevisionRequestModal — onSubmit({ items, notes, deadline_at }) —
 * with each item carrying `timestamp_seconds`, so the backend/creator flow is shared.
 *
 * At most 5 items per request (request_revision() rejects more), and a typed note
 * is also sent as the last item, so it takes one of the five slots. The payload is
 * built by buildRevisionPayload() and posted to /work/{id}/request-revision.
 */

export const fmtTs = (s) => {
  const n = Math.max(0, Math.floor(Number(s) || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
};

export default function VideoReviewModal({
  src, title, onClose, onSubmit, submitting = false, freeRemaining, nextFee, paidFee, watermark = true,
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
  const [videoError, setVideoError] = useState(false);

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

  // The note counts as an item, so the visible counter and every cap use this.
  const itemCount = revisionItemCount(comments.length, notes);
  const atCap = itemCount >= MAX_REVISION_ITEMS;

  const addComment = () => {
    const text = draft.trim();
    if (!text || atCap) return;
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

  const feeNotice = revisionFeeNotice({ freeRemaining, nextFee, paidFee });

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
  const canSubmit = comments.length > 0 && itemCount <= MAX_REVISION_ITEMS && !contactHit && !submitting && deadlineValid;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit(buildRevisionPayload(
      ordered.map((c) => ({ description: c.text, timestamp_seconds: c.timestamp_seconds })),
      notes,
      deadlineAt,
    ));
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
              src={mediaUrl(src)}
              playsInline
              disablePictureInPicture={watermark}
              onContextMenu={watermark ? (e) => e.preventDefault() : undefined}
              onClick={togglePlay}
              onTimeUpdate={(e) => setNow(e.target.currentTime)}
              onLoadedMetadata={(e) => setDuration(e.target.duration || 0)}
              onError={() => { setVideoError(true); setPlaying(false); }}
              onCanPlay={() => setVideoError(false)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={() => setPlaying(false)}
            />
            {watermark && <span className="vrm-wm" aria-hidden="true" />}
            {videoError && <button type="button" style={{ position: 'absolute', zIndex: 3, inset: '40% 20%', background: '#fff', color: '#07074e', border: 0, fontWeight: 600, borderRadius: 12 }} onClick={() => { setVideoError(false); videoRef.current?.load(); }}>Video could not load. Tap to retry</button>}
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
                    title={`${fmtTs(c.timestamp_seconds)} - ${c.text}`}
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
            <span>{readOnly ? 'Requested changes' : 'Comments'}{comments.length > 0 && <b>{readOnly ? comments.length : `${comments.length}/${MAX_REVISION_ITEMS}`}</b>}</span>
            <button type="button" className="vrm-x" onClick={onClose} aria-label="Close"><X size={18} /></button>
          </div>

          {readOnly && (
            <div className="vrm-free">Tap a timestamp to jump to the exact moment the brand marked for a change.</div>
          )}
          {!readOnly && feeNotice && (
            <div className={feeNotice.kind === 'free' ? 'vrm-free' : 'vrm-fee'}>{feeNotice.text}</div>
          )}
          {!readOnly && contactHit && (
            <div className="vrm-warn">
              <AlertTriangle size={15} />
              <span>Remove phone numbers and email addresses - keep communication on-platform.</span>
            </div>
          )}

          <div className="vrm-list">
            {ordered.length === 0 ? (
              <div className="vrm-empty">
                <p><MessageSquare size={17} /> No comments yet</p>
                <small>{readOnly
                  ? 'The brand left no timestamped notes on this video.'
                  : 'Play the video, pause where you want a change, and type below - your note is pinned to that moment.'}</small>
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
            <div className="vrm-cap" data-testid="vrm-counter" style={itemCount > MAX_REVISION_ITEMS ? { color: '#b42318' } : undefined}>
              {itemCount}/{MAX_REVISION_ITEMS} changes{notes.trim() ? ' (your note counts as one)' : ''}
              {itemCount > MAX_REVISION_ITEMS ? ' - remove one to send' : atCap ? ' - limit reached' : ''}
            </div>
            <div className="vrm-input">
              <span className="vrm-at">{fmtTs(pinnedAt)}</span>
              <textarea
                rows={2}
                value={draft}
                placeholder="At this point I want…"
                onChange={(e) => onDraftChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addComment(); } }}
              />
              <button type="button" className="vrm-send" onClick={addComment} disabled={!draft.trim() || atCap} aria-label="Add comment">
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
          .vrm-ov{position:fixed;inset:0;background:rgba(7,7,78,.45);backdrop-filter:blur(3px);z-index:1600;display:flex;align-items:center;justify-content:center;padding:20px;overscroll-behavior:contain}
          .vrm{display:flex;width:min(1120px,100%);height:min(720px,92vh);height:min(720px,92dvh);background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 40px 80px -30px rgba(7,7,78,.6);font-family:'Inter',system-ui,sans-serif;color:#07074e}
          .vrm-left{flex:1;min-width:0;display:flex;flex-direction:column;background:#f6f6fd;padding:0 20px 18px}
          .vrm-lhead{display:flex;align-items:center;gap:9px;padding:18px 0 14px;color:#07074e;font-family:'Readex Pro','Plus Jakarta Sans',sans-serif;font-size:16px}
          .vrm-lhead svg{color:#4e60e6;flex:none}
          .vrm-lhead strong{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
          .vrm-stage{position:relative;flex:1;min-height:0;display:flex;align-items:center;justify-content:center;background:#07074e;border-radius:18px;overflow:hidden}
          /* Fill the stage and letterbox with object-fit:contain so the WHOLE frame
             is always visible (a portrait clip no longer overflows and gets its
             bottom cropped) - no fullscreen needed. */
          .vrm-stage video{width:100%;height:100%;object-fit:contain;display:block}
          /* Hard-guarantee a single timeline: even if the browser (or a stray
             \`controls\` attribute) tries to draw native controls, keep them hidden -
             the custom track below is the only scrub bar. */
          .vrm-stage video::-webkit-media-controls,
          .vrm-stage video::-webkit-media-controls-enclosure,
          .vrm-stage video::-webkit-media-controls-panel{display:none !important;-webkit-appearance:none !important}
          .vrm-wm{position:absolute;inset:0;pointer-events:none;background-image:var(--ugc-wm);background-size:240px 150px}
          .vrm-track{padding:16px 2px 0}
          .vrm-track-bar{position:relative;height:6px;border-radius:999px;background:#e4e4f2;margin-bottom:12px;cursor:pointer}
          .vrm-track-bar::before{content:'';position:absolute;inset:-9px 0;}/* bigger click target */
          .vrm-track-played{position:absolute;left:0;top:0;bottom:0;border-radius:999px;background:#7387ff;pointer-events:none}
          .vrm-marker{position:absolute;top:50%;transform:translate(-50%,-50%);width:18px;height:18px;border-radius:50%;border:0;box-shadow:0 0 0 3px #f6f6fd;background:#07074e;color:#fff;font-size:10px;font-weight:700;cursor:pointer;display:grid;place-items:center;padding:0;z-index:1}
          .vrm-ctrls{display:flex;align-items:center;gap:12px}
          .vrm-play,.vrm-full{border:none;background:#fff;box-shadow:inset 0 0 0 1px #e2e2f0;color:#07074e;width:32px;height:32px;border-radius:50%;cursor:pointer;display:grid;place-items:center;flex:none}
          .vrm-play:hover,.vrm-full:hover{background:#eef0ff}
          .vrm-full{margin-left:auto;border-radius:9px}
          .vrm-track-time{color:#5a5a8c;font-size:12.5px;font-variant-numeric:tabular-nums}
          .vrm-right{width:380px;flex:none;display:flex;flex-direction:column;background:#fff;border-left:1px solid #e2e2f0}
          .vrm-rhead{display:flex;align-items:center;justify-content:space-between;padding:16px 16px 14px 18px;color:#07074e;font-family:'Readex Pro','Plus Jakarta Sans',sans-serif;font-weight:500;font-size:17px;border-bottom:1px solid #edeef6}
          .vrm-rhead b{color:#6e6e96;font-family:'Inter',system-ui,sans-serif;font-size:13px;font-weight:600;margin-left:8px}
          .vrm-x{width:32px;height:32px;border-radius:9px;border:none;background:#f6f6fd;color:#07074e;cursor:pointer;display:grid;place-items:center}
          .vrm-x:hover{background:#eef0ff}
          .vrm-fee,.vrm-free,.vrm-warn{margin:12px 16px 0;padding:9px 12px;border-radius:12px;font-size:12.5px;font-weight:600;line-height:1.4}
          .vrm-fee{background:#fff2dc;color:#8a4b00}
          .vrm-free{background:#e4f5ec;color:#13774f}
          .vrm-warn{display:flex;gap:8px;align-items:flex-start;background:#fde8e8;color:#b42318}
          .vrm-warn svg{flex:none;margin-top:1px}
          .vrm-cap{margin:0 0 8px;color:#6e6e96;font-size:12px;font-weight:600}
          .vrm-list{flex:1;min-height:0;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:8px}
          .vrm-empty{margin:auto;text-align:center;color:#6e6e96;padding:20px}
          .vrm-empty p{display:flex;align-items:center;justify-content:center;gap:8px;margin:0 0 6px;color:#07074e;font-weight:600;font-size:14.5px}
          .vrm-empty small{font-size:13px;line-height:1.5;display:block}
          .vrm-c{display:flex;gap:10px;align-items:flex-start;background:#fff;box-shadow:inset 0 0 0 1px #e2e2f0;border-radius:12px;padding:11px 12px}
          .vrm-c-ts{flex:none;border:none;background:#07074e;color:#fff;font-size:12px;font-weight:700;height:24px;padding:0 9px;border-radius:6px;cursor:pointer;font-variant-numeric:tabular-nums;display:inline-flex;align-items:center}
          .vrm-c-ts:hover{background:#12124f}
          .vrm-c-ts--general{background:#ecedfa;color:#5a5a8c;cursor:default}
          .vrm-c-body{flex:1;min-width:0}
          .vrm-c-body p{margin:0;color:#07074e;font-size:14px;line-height:1.5;word-break:break-word}
          .vrm-c-del{flex:none;border:none;background:none;color:#9f9fd1;cursor:pointer;padding:2px}
          .vrm-c-del:hover{color:#e5484d}
          .vrm-compose{border-top:1px solid #edeef6;padding:14px 16px 16px}
          .vrm-time button{border:1px solid #c9cbea;background:#fff;color:#07074e;border-radius:999px;padding:6px 13px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit}
          .vrm-time button:hover{background:#f3f3ff}
          .vrm-time button.on{background:#07074e;border-color:#07074e;color:#fff}
          .vrm-input{display:flex;align-items:flex-start;gap:8px;background:#f6f6fd;border:1.5px dashed #9f9fd1;border-radius:12px;padding:8px}
          .vrm-input:focus-within{background:#fff;border-style:solid;border-color:#7387ff;box-shadow:0 0 0 3px rgba(115,135,255,.2)}
          .vrm-at{flex:none;background:#07074e;color:#fff;font-size:12px;font-weight:700;height:24px;display:inline-flex;align-items:center;padding:0 8px;border-radius:6px;font-variant-numeric:tabular-nums;margin-top:1px}
          .vrm-input textarea{flex:1;min-width:0;border:none;background:none;color:#07074e;font-family:inherit;font-size:14px;resize:none;outline:none;padding:3px 0}
          .vrm-input textarea::placeholder{color:#9f9fd1}
          .vrm-send{flex:none;border:none;background:#07074e;color:#fff;width:32px;height:32px;border-radius:50%;cursor:pointer;display:grid;place-items:center}
          .vrm-send:disabled{opacity:.4;cursor:not-allowed}
          .vrm-more{margin:10px 0}
          .vrm-more summary{color:#4e60e6;font-size:13px;font-weight:600;cursor:pointer;user-select:none}
          .vrm-notes{width:100%;box-sizing:border-box;margin-top:8px;border:1.5px solid transparent;background:#f6f6fd;color:#07074e;border-radius:12px;padding:9px 12px;font-family:inherit;font-size:13.5px;resize:none;outline:none}
          .vrm-notes:focus{background:#fff;border-color:#7387ff;box-shadow:0 0 0 3px rgba(115,135,255,.2)}
          .vrm-time{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
          .vrm-deadline{margin-top:2px}
          .vrm-deadline > label{display:block;color:#07074e;font-size:13px;font-weight:700}
          .vrm-deadline-input{margin-top:8px;width:100%;box-sizing:border-box;border:1.5px solid transparent;background:#f6f6fd;color:#07074e;border-radius:12px;padding:9px 12px;font-family:inherit;font-size:13.5px;outline:none}
          .vrm-deadline-input:focus{background:#fff;border-color:#7387ff;box-shadow:0 0 0 3px rgba(115,135,255,.2)}
          .vrm-submit{width:100%;margin-top:10px;border:none;background:#07074e;color:#fff;border-radius:999px;height:48px;padding:0 20px;font-family:inherit;font-size:14.5px;font-weight:700;cursor:pointer}
          .vrm-submit:hover:not(:disabled){background:#12124f}
          .vrm-submit:disabled{opacity:.55;cursor:not-allowed}
          @media (max-width:900px){
            .vrm{flex-direction:column;height:94vh;height:94dvh}
            /* The right panel is a scroll container on small screens, otherwise the compose form
               (deadline + Send Changes) was clipped under the video on short phones. */
            .vrm-right{width:auto;border-left:none;border-top:1px solid #e2e2f0;max-height:58%;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch}
            .vrm-list{flex:0 0 auto;max-height:150px;min-height:60px}
            .vrm-compose{flex:none}
            .vrm-left{max-height:42%;flex:1 1 0;padding:0 14px 12px}
            .vrm-lhead{padding:12px 0 10px}
            .vrm-track{padding-top:12px}
          }
          @media (max-width:768px){
            .vrm-ov{padding:max(10px,env(safe-area-inset-top,0px)) 10px max(10px,env(safe-area-inset-bottom,0px))}
            .vrm-input textarea,.vrm-notes,.vrm-deadline-input{font-size:16px}
            .vrm-x,.vrm-play,.vrm-full,.vrm-send{width:44px;height:44px}
            .vrm-time button{min-height:44px;padding:0 14px}
            .vrm-more summary{padding:10px 0}
            .vrm-marker{width:26px;height:26px;font-size:11px}
            button.vrm-c-ts{min-width:56px;min-height:44px}
            .vrm-c-del{min-width:44px;min-height:44px;display:grid;place-items:center;padding:0}
          }
        `}</style>
      </div>
    </div>
  );
}
