import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  AlertTriangle, Check, ChevronLeft, Download, FileText, MessageSquare, Play, Star, Trash2, Info,
} from 'lucide-react';
import AppShell from '../../shell/AppShell';
import BottomSheet from '../../shell/BottomSheet';
import { useLiveEffect } from '../../../lib/liveUpdates';
import { mediaUrl as assetUrl } from '../../../utils/mediaUrl';
import { downloadDeliverable } from '../../../utils/downloadDeliverable';
import { apiErrorMessage } from '../../../utils/apiError';
import { findContactInfo } from '../../../components/RevisionRequestModal';
import { MAX_REVISION_ITEMS, revisionItemCount, buildRevisionPayload, revisionFeeNotice } from '../../../utils/revisionPayload';
import PlanBrief from '../../../pages/PlanBrief';
import { API, Avatar, LoadError, Skeletons, firstWord, loadErrorText } from './workShared';
import { useAppBack } from '../../shell/useAppBack';
import './work.css';

const isVideo = (u) => /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(String(u || '').split('?')[0]);
const fmtDur = (s) => { if (!s || !Number.isFinite(s)) return ''; const m = Math.floor(s / 60); return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };
const fmtTs = (s) => { const n = Math.max(0, Math.floor(Number(s) || 0)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const campaignOf = (it) => it.campaignId || String(it.id || '').split('~')[0];
const agoText = (d) => {
  if (!d) return '';
  const ms = Date.now() - new Date(d).getTime();
  if (!Number.isFinite(ms) || ms < 0) return fmtDate(d);
  const m = Math.floor(ms / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return days <= 7 ? `${days}d ago` : fmtDate(d);
};

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'pending_review', label: 'To review' },
  { key: 'revision_requested', label: 'Revision' },
  { key: 'approved', label: 'Approved' },
];
const STATUS = {
  approved: { tone: 'ap-pill--ok', label: 'Approved' },
  pending_review: { tone: 'ap-pill--warn', label: 'To review' },
  awaiting_edit: { tone: 'ap-pill--muted', label: 'With UGC.ad editors' },
  awaiting_edited: { tone: 'ap-pill--muted', label: 'Creator editing' },
  revision_requested: { tone: 'ap-pill--bad', label: 'Revision requested' },
};
const PAGE = 10;

function Thumb({ file, locked, duration, onOpen, onDuration }) {
  const [broken, setBroken] = useState(false);
  const url = assetUrl(file);
  const vid = isVideo(url);
  useEffect(() => { setBroken(false); }, [url]);
  return (
    <button type="button" className="ap-wk-thumb" onClick={onOpen} aria-label="Open submission">
      {url && !broken ? (vid
        ? <video src={`${url}#t=0.5`} muted playsInline preload="metadata" onError={() => setBroken(true)} onLoadedMetadata={(e) => onDuration?.(fmtDur(e.target.duration))} />
        : <img src={url} alt="" onError={() => setBroken(true)} />)
        : <span className="ap-wk-thumb-fb"><FileText size={22} />{broken ? 'File unavailable' : null}</span>}
      {locked && <span className="ap-wk-wm" aria-hidden="true" />}
      <span className="ap-wk-play"><Play size={14} fill="currentColor" /></span>
      {duration ? <span className="ap-wk-dur">{duration}</span> : null}
    </button>
  );
}

/**
 * Full-screen video review (design M3 frames 2/5, M10). `watch` = plain player with the actions;
 * `changes` = player on top + timestamped change list below. Produces the same payload as the website's
 * VideoReviewModal ({ items, notes, deadline_at } via buildRevisionPayload).
 */
function ReviewPlayer({ item, src, watermark, canAct, tracker, submitting, approving, onClose, onApprove, onSubmit }) {
  useAppBack(true, onClose);
  const videoRef = useRef(null);
  const [mode, setMode] = useState('watch');
  const [now, setNow] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [err, setErr] = useState(false);
  const [rate, setRate] = useState(1);
  const [comments, setComments] = useState([]);
  const [composing, setComposing] = useState(false);
  const [pinned, setPinned] = useState(0);
  const [draft, setDraft] = useState('');
  const [notes, setNotes] = useState('');
  const [timeline, setTimeline] = useState('48h');
  const [customDeadline, setCustomDeadline] = useState('');
  const creator = firstWord(item.creator);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {}); else v.pause();
  };
  const seek = (t, pause = false) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = t;
    setNow(t);
    if (pause) v.pause();
  };
  const scrub = (e) => {
    if (!duration) return;
    const r = e.currentTarget.getBoundingClientRect();
    seek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * duration);
  };
  const cycleRate = () => {
    const next = { 1: 1.5, 1.5: 2, 2: 0.5, 0.5: 1 }[rate] || 1;
    setRate(next);
    if (videoRef.current) videoRef.current.playbackRate = next;
  };
  const retry = () => { setErr(false); setTimeout(() => videoRef.current?.load(), 0); };

  const itemCount = revisionItemCount(comments.length, notes);
  const atCap = itemCount >= MAX_REVISION_ITEMS;
  const ordered = [...comments].sort((a, b) => a.timestamp_seconds - b.timestamp_seconds);
  const feeNotice = revisionFeeNotice({ freeRemaining: tracker.free_revisions_remaining, nextFee: tracker.next_revision_fee, paidFee: tracker.paid_revision_fee });
  const deadlineAt = (() => {
    if (timeline === 'custom') {
      const t = customDeadline ? new Date(customDeadline).getTime() : NaN;
      return Number.isNaN(t) ? null : new Date(t).toISOString();
    }
    return new Date(Date.now() + (timeline === '24h' ? 24 : 48) * 3600 * 1000).toISOString();
  })();
  const contactHit = comments.some((c) => findContactInfo(c.text)) || !!findContactInfo(notes) || !!findContactInfo(draft);
  const deadlineValid = deadlineAt != null && (timeline !== 'custom' || new Date(deadlineAt).getTime() > Date.now());
  const canSubmit = comments.length > 0 && itemCount <= MAX_REVISION_ITEMS && !contactHit && !submitting && deadlineValid;
  const minDeadline = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  const startComment = () => {
    if (atCap) { toast.error(`You can send up to ${MAX_REVISION_ITEMS} changes at a time`); return; }
    const t = videoRef.current?.currentTime ?? now;
    videoRef.current?.pause();
    setPinned(Math.round(t * 10) / 10);
    setDraft('');
    setComposing(true);
  };
  const addComment = () => {
    const text = draft.trim();
    if (!text || atCap || findContactInfo(text)) return;
    setComments((c) => [...c, { id: `${Date.now()}-${c.length}`, text, timestamp_seconds: pinned }]);
    setDraft('');
    setComposing(false);
  };
  const send = () => {
    if (!canSubmit) return;
    onSubmit(buildRevisionPayload(ordered.map((c) => ({ description: c.text, timestamp_seconds: c.timestamp_seconds })), notes, deadlineAt));
  };

  const pct = duration ? Math.min(100, (now / duration) * 100) : 0;
  const changes = mode === 'changes';
  const version = `${item.stage === 'raw' ? 'Raw cut' : 'Edited cut'}${item.version ? ` · v${item.version}` : ''}`;
  const draftHit = !!findContactInfo(draft);

  return createPortal(
    <div className={`ap-wk-pl${changes ? ' ap-wk-pl--changes' : ''}`} role="dialog" aria-modal="true" aria-label={`Review ${item.title}`}>
      <div className="ap-wk-pl-stage">
        {err ? (
          <div className="ap-wk-pl-fail">
            <AlertTriangle size={36} style={{ opacity: 0.7 }} />
            <strong>Video could not be loaded</strong>
            <span>Check your connection and try again.</span>
            <button type="button" className="ap-btn" onClick={retry}>Retry video</button>
          </div>
        ) : (
          <video
            ref={videoRef}
            className="ap-wk-pl-video"
            src={src}
            playsInline
            preload="metadata"
            onLoadedMetadata={(e) => { setDuration(e.target.duration || 0); e.target.playbackRate = rate; }}
            onTimeUpdate={(e) => setNow(e.target.currentTime)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={() => setErr(true)}
            disablePictureInPicture={watermark}
            controlsList={watermark ? 'nodownload noremoteplayback' : undefined}
            onContextMenu={watermark ? (e) => e.preventDefault() : undefined}
          />
        )}
        {watermark && !err && <span className="ap-wk-pl-wm" aria-hidden="true" />}
        <div className="ap-wk-pl-shade" />
        {!err && <button type="button" className="ap-wk-pl-tap" aria-label={playing ? 'Pause' : 'Play'} onClick={toggle} />}
        {!err && (
          <button type="button" className={`ap-wk-pl-center${playing ? ' is-hidden' : ''}`} aria-label="Play" onClick={toggle}>
            <Play size={30} fill="currentColor" />
          </button>
        )}

        <div className="ap-wk-pl-top">
          <button type="button" className="ap-wk-pl-circle" aria-label={changes ? 'Back to video' : 'Close'} onClick={() => (changes ? setMode('watch') : onClose())}>
            <ChevronLeft size={24} />
          </button>
          <div className="ap-wk-pl-who">
            <b>{changes ? 'Ask for changes' : item.creator ? firstWord(item.creator) : 'Creator'}</b>
            <small>{changes ? `${creator} · ${item.title}` : version}</small>
          </div>
          <button type="button" className="ap-wk-pl-speed" aria-label={`Playback speed ${rate}x`} onClick={cycleRate}>{rate}×</button>
        </div>

        <div className="ap-wk-pl-bot">
          {!changes && (
            <div>
              <div className="ap-wk-pl-title">{item.title}</div>
              <div className="ap-wk-pl-sub">Submitted {agoText(item.submittedAt) || 'recently'}</div>
            </div>
          )}
          <div>
            <div className="ap-wk-pl-times"><span>{fmtTs(now)}</span><span>{fmtTs(duration)}</span></div>
            <div
              className="ap-wk-pl-track"
              role="slider"
              aria-label="Seek"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(now)}
              onPointerDown={(e) => { e.currentTarget.setPointerCapture?.(e.pointerId); scrub(e); }}
              onPointerMove={(e) => { if (e.buttons) scrub(e); }}
            >
              <span className="ap-wk-pl-fill" style={{ width: `${pct}%` }} />
              {changes && duration > 0 && ordered.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  className="ap-wk-pl-pin"
                  style={{ left: `${Math.min(100, (c.timestamp_seconds / duration) * 100)}%` }}
                  aria-label={`Change ${i + 1} at ${fmtTs(c.timestamp_seconds)}`}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => seek(c.timestamp_seconds, true)}
                >{i + 1}</button>
              ))}
            </div>
          </div>
          {!changes && canAct && (
            <>
              <div className="ap-wk-pl-acts">
                <button type="button" className="ap-wk-pl-btn" onClick={() => { videoRef.current?.pause(); setMode('changes'); }}>Ask for changes</button>
                <button type="button" className="ap-wk-pl-btn ap-wk-pl-btn--main" disabled={approving} onClick={() => { videoRef.current?.pause(); onApprove(); }}>
                  <Check size={18} /> {item.stage === 'raw' ? 'Approve raw cut' : 'Approve & pay'}
                </button>
              </div>
              <div className="ap-wk-pl-note">
                {item.stage === 'raw'
                  ? 'Approving the raw cut sends it to editing next.'
                  : `${tracker.free_revisions_remaining ?? 0} free revision${tracker.free_revisions_remaining === 1 ? '' : 's'} left · payment held in escrow`}
              </div>
            </>
          )}
          {changes && !composing && (
            <button type="button" className="ap-wk-pl-chip" onClick={startComment} disabled={atCap}>
              <MessageSquare size={15} /> Comment at {fmtTs(now)}
            </button>
          )}
        </div>
      </div>

      {changes && (
        <>
          <div className="ap-wk-pl-panel">
            <div className="ap-wk-pl-ph">
              <b>Changes you want</b>
              <span>{itemCount}/{MAX_REVISION_ITEMS} used</span>
            </div>
            {feeNotice && <div className={`ap-wk-info${feeNotice.kind === 'free' ? ' ap-wk-info--ok' : ' ap-wk-warn'}`} style={{ marginTop: 0 }}><Info size={16} /><span>{feeNotice.text}</span></div>}
            {contactHit && (
              <div className="ap-wk-warn" role="alert" style={{ marginTop: 0 }}>
                <AlertTriangle size={16} />
                <span>Please remove phone numbers and email addresses. Keep all communication on-platform - sharing contact details isn't allowed.</span>
              </div>
            )}

            {composing && (
              <div className="ap-card ap-wk-pl-draft">
                <div className="ap-wk-pl-draft-h"><span>At {fmtTs(pinned)}</span></div>
                <textarea
                  className="ap-input"
                  autoFocus
                  rows={3}
                  maxLength={500}
                  placeholder="What should change here? (e.g. Re-shoot the intro - lighting is too dark)"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                />
                {draftHit && <small style={{ color: 'var(--ap-danger)' }}>Remove phone numbers and emails to continue.</small>}
                <div className="ap-wk-pl-draft-acts">
                  <button type="button" className="ap-btn ap-btn--ghost" onClick={() => { setComposing(false); setDraft(''); }}>Cancel</button>
                  <button type="button" className="ap-btn" disabled={!draft.trim() || draftHit} onClick={addComment}>Add change</button>
                </div>
              </div>
            )}

            {ordered.length === 0 && !composing && (
              <div className="ap-card" style={{ textAlign: 'center', color: 'var(--ap-muted)', fontSize: 14, lineHeight: 1.5 }}>
                Pause the video where something needs to change, then tap <b>Comment at {fmtTs(now)}</b>.
              </div>
            )}
            {ordered.map((c, i) => (
              <div key={c.id} className="ap-card ap-wk-pl-item">
                <span className="ap-wk-pl-num">{i + 1}</span>
                <div className="ap-wk-pl-it">
                  <button type="button" className="ap-wk-seek" onClick={() => seek(c.timestamp_seconds, true)}>At {fmtTs(c.timestamp_seconds)}</button>
                  <div>{c.text}</div>
                </div>
                <button type="button" className="ap-wk-pl-del" aria-label={`Remove change ${i + 1}`} onClick={() => setComments((all) => all.filter((x) => x.id !== c.id))}><Trash2 size={18} /></button>
              </div>
            ))}

            <label className="ap-label">
              Additional notes (optional)
              <textarea className="ap-input" rows={2} maxLength={500} placeholder="Any extra context (max 500 chars)…" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>
            <div className="ap-wk-pl-count">{notes.length}/500{notes.trim() ? ' · your note counts as one item' : ''}</div>

            <div>
              <div className="ap-label" style={{ marginBottom: 8 }}>Timeline for revision</div>
              <div className="ap-wk-pl-seg">
                {[['24h', '24 hours'], ['48h', '48 hours'], ['custom', 'Custom']].map(([k, l]) => (
                  <button key={k} type="button" className={`ap-chip${timeline === k ? ' is-on' : ''}`} onClick={() => setTimeline(k)}>{l}</button>
                ))}
              </div>
              {timeline === 'custom' && (
                <input type="datetime-local" className="ap-input" style={{ marginTop: 10 }} min={minDeadline} value={customDeadline} onChange={(e) => setCustomDeadline(e.target.value)} aria-label="Revision deadline" />
              )}
              {timeline === 'custom' && customDeadline && !deadlineValid && <small style={{ color: 'var(--ap-danger)' }}>Pick a time in the future.</small>}
            </div>
            <div className="ap-wk-info"><Info size={16} /><span>{creator} gets these with a {timeline === 'custom' ? 'custom' : <strong>{timeline === '24h' ? '24-hour' : '48-hour'}</strong>} deadline.</span></div>
          </div>
          <div className="ap-wk-pl-foot">
            <button type="button" className="ap-btn" disabled={!canSubmit} onClick={send}>
              {submitting ? 'Sending…' : comments.length ? `Send ${comments.length} change${comments.length === 1 ? '' : 's'}${timeline === 'custom' ? '' : ` · due in ${timeline}`}` : 'Add a change to send'}
            </button>
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}

function ApproveSheet({ item, busy, onClose, onConfirm }) {
  const [ok, setOk] = useState(false);
  useEffect(() => { setOk(false); }, [item]);
  if (!item) return null;
  const raw = item.stage === 'raw';
  const name = firstWord(item.creator);
  return (
    <BottomSheet
      open
      onClose={busy ? undefined : onClose}
      title={raw ? 'Approve the raw cut?' : `Approve & pay ${name}?`}
      subtitle={`${item.title} · ${raw ? 'raw cut' : 'edited cut'}`}
      footer={(
        <>
          <button type="button" className="ap-btn ap-btn--ghost" style={{ flex: 1, height: 52 }} disabled={busy} onClick={onClose}>Not yet</button>
          <button type="button" className="ap-btn" style={{ flex: 1.3, height: 52 }} disabled={!ok || busy} onClick={onConfirm}>
            {busy ? 'Approving…' : raw ? 'Yes, approve raw cut' : 'Yes, approve & pay'}
          </button>
        </>
      )}
    >
      <div className="ap-wk-sum">
        <div><span>Video</span><b>{item.title}</b></div>
        <div><span>Creator</span><b>{name}</b></div>
        <div><span>{raw ? 'Next step' : 'Payment'}</span><b>{raw ? (item.editMode === 'ugc' ? 'UGC.ad edits it' : 'Creator edits it') : `Held in escrow, released to ${name}`}</b></div>
      </div>
      <label className="ap-wk-check">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        <span className="ap-wk-box">{ok ? <Check size={15} strokeWidth={3} /> : null}</span>
        <span>I’ve watched the full video and it matches my brief</span>
      </label>
      <div className="ap-wk-warn">
        <AlertTriangle size={16} />
        <span>{raw
          ? 'This can’t be undone. The raw cut moves on to editing and you won’t be able to ask for free changes to it.'
          : 'This can’t be undone. You won’t be able to ask for free changes after paying. The download unlocks right away.'}</span>
      </div>
    </BottomSheet>
  );
}

function PaidSheet({ item, onClose, onDownload, onRate, onHire, downloading }) {
  if (!item) return null;
  const name = firstWord(item.creator);
  return (
    <BottomSheet open onClose={onClose}>
      <div className="ap-wk-done">
        <span className="ap-wk-done-ic"><Check size={32} strokeWidth={2.6} /></span>
        <h3>Payment released</h3>
        <p>{name} has been paid. Your clean video is ready to download.</p>
        <div className="ap-wk-done-acts">
          <button type="button" className="ap-btn ap-btn--block" disabled={downloading} onClick={onDownload}><Download size={18} /> {downloading ? 'Starting…' : 'Download video'}</button>
          <div className="ap-wk-done-row">
            {item.creatorId ? <button type="button" className="ap-btn" style={{ background: '#eef0ff', color: 'var(--ap-ink)' }} onClick={onRate}><Star size={16} /> Rate {name}</button> : null}
            {item.creatorId ? <button type="button" className="ap-btn ap-btn--ghost" onClick={onHire}>Hire again</button> : null}
          </div>
          <button type="button" className="ap-link" style={{ minHeight: 44 }} onClick={onClose}>Done</button>
        </div>
      </div>
    </BottomSheet>
  );
}

function RateSheet({ item, onClose, onSubmit }) {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  if (!item) return null;
  const submit = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try { await onSubmit({ rating, review: text.trim() }); } finally { lock.current = false; setBusy(false); }
  };
  return (
    <BottomSheet
      open
      onClose={busy ? undefined : onClose}
      title={`How was working with ${firstWord(item.creator)}?`}
      subtitle="Your review helps other brands pick great creators."
      footer={(
        <>
          <button type="button" className="ap-btn" style={{ flex: 1, height: 50, background: '#eef0ff', color: 'var(--ap-ink)' }} disabled={busy} onClick={onClose}>Cancel</button>
          <button type="button" className="ap-btn" style={{ flex: 1, height: 50 }} disabled={busy} onClick={submit}>{busy ? 'Submitting…' : 'Post review'}</button>
        </>
      )}
    >
      <div className="ap-wk-stars" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? 's' : ''}`} className={`ap-wk-star${n <= rating ? ' is-on' : ''}`} onClick={() => setRating(n)}>★</button>
        ))}
      </div>
      <label className="ap-wk-field">
        Your review
        <textarea className="ap-input" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Share how the collaboration went (optional)…" />
      </label>
    </BottomSheet>
  );
}

export default function BrandWorkReviewApp() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('all');
  const [shown, setShown] = useState(PAGE);
  const [durations, setDurations] = useState({});
  const [trackers, setTrackers] = useState({});
  const [player, setPlayer] = useState(null);       // { id, src, watermark }
  const [approveFor, setApproveFor] = useState(null);
  const [approving, setApproving] = useState(false);
  const [revSubmitting, setRevSubmitting] = useState(false);
  const [paidFor, setPaidFor] = useState(null);
  const [reviewFor, setReviewFor] = useState(null);
  const [hireFor, setHireFor] = useState(null);
  const [downloading, setDownloading] = useState('');
  const busy = useRef(false);
  const downloadLock = useRef(false);

  const load = async () => {
    try {
      const review = await axios.get(`${API}/business/work-review?t=${Date.now()}`);
      const rows = Array.isArray(review.data) ? review.data : [];
      setLoadError('');
      setItems(rows);
      setTrackers(Object.fromEntries(rows.map((row) => [String(row.id), {
        free_revisions_remaining: row.freeRevisionsRemaining,
        next_revision_fee: row.nextRevisionFee,
        paid_revision_fee: row.paidRevisionFee,
      }])));
    } catch (e) {
      // A failed live refresh keeps the rows we have; only a first load shows the error state.
      setLoadError(loadErrorText(e, 'Could not load submissions. Check your connection and try again.'));
    } finally { setLoading(false); }
  };
  useLiveEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { setShown(PAGE); }, [tab]);

  const counts = useMemo(() => {
    const o = { all: items.length };
    ['approved', 'pending_review', 'revision_requested'].forEach((k) => { o[k] = items.filter((i) => i.status === k).length; });
    return o;
  }, [items]);
  const rows = useMemo(() => (tab === 'all' ? items : items.filter((i) => i.status === tab)), [items, tab]);
  const pageRows = rows.slice(0, shown);
  const playerItem = player ? items.find((i) => i.id === player.id) : null;

  const openFile = (it) => {
    const f = (it.files || []).find((x) => isVideo(x)) || (it.files || [])[0];
    if (!f) { toast.error('No file on this submission yet'); return; }
    const url = assetUrl(f);
    if (isVideo(url)) setPlayer({ id: it.id, src: url, watermark: it.status !== 'approved' });
    else window.open(url, '_blank', 'noopener');
  };
  const openFileUrl = (it, file) => setPlayer({ id: it.id, src: assetUrl(file), watermark: it.status !== 'approved' });

  const approve = async (id) => {
    if (busy.current) return;
    busy.current = true;
    setApproving(true);
    // Capture the row BEFORE load() replaces the list: the rating prompt needs creatorId/name.
    const it = items.find((i) => i.id === id);
    try {
      const { data } = await axios.post(`${API}/deals/${id}/approve`);
      toast.success(data?.payout_status === 'awaiting_edited'
        ? 'Raw video approved - the creator will submit the edited video next'
        : it?.stage === 'raw' && it?.editMode === 'ugc'
          ? 'Raw video approved - creator paid, UGC.ad is editing it'
          : 'Approved - payment released to the creator');
      setApproveFor(null);
      setPlayer(null);
      await load();
      if (it?.creatorId && data?.payout_status === 'released' && it?.stage !== 'raw') setPaidFor(it);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to approve'));
    } finally { busy.current = false; setApproving(false); }
  };

  const submitReview = async ({ rating, review }) => {
    try {
      await axios.post(`${API}/reviews`, {
        campaign_id: reviewFor.campaignId || reviewFor.id, creator_id: reviewFor.creatorId, rating, review,
      });
      toast.success('Review submitted - thanks for the feedback!');
      setReviewFor(null);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not submit your review');
    }
  };

  const submitRevision = async (payload) => {
    if (!playerItem || revSubmitting) return;
    setRevSubmitting(true);
    try {
      // A work-review row carries the deal id; resolve this creator's latest submission first.
      const row = playerItem;
      const wid = row.workId || (row.campaignId
        ? (await axios.get(`${API}/work/campaign/${row.campaignId}${row.creatorId ? `?creator_id=${encodeURIComponent(row.creatorId)}` : ''}`).catch(() => null))?.data?.id
        : null);
      if (!wid) { toast.error('Could not find the submitted work. Refresh and try again.'); return; }
      const { data } = await axios.post(`${API}/work/${wid}/request-revision`, payload);
      toast.success(data?.paid
        ? `Revision requested - ₹${data.fee_charged} charged. Wallet balance: ₹${Math.round(data.new_balance)}.`
        : 'Revision requested');
      setPlayer(null);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to request revision');
    } finally { setRevSubmitting(false); }
  };

  const download = async (it, label, asset) => {
    if (downloadLock.current) return;
    downloadLock.current = true;
    setDownloading(`${it.id}${asset || ''}`);
    try {
      await downloadDeliverable(API, it.id, label || it.title, asset);
      toast.success('Download started');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Download failed'));
    } finally { downloadLock.current = false; setDownloading(''); }
  };

  const retry = () => { setLoading(true); load(); };

  return (
    <AppShell back title="Work review" subtitle="Approve to pay or ask for changes">
      <div className="ap-wk">
        <div className="ap-chips ap-wk-chips" role="tablist" aria-label="Filter submissions">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`ap-chip${tab === t.key ? ' is-on' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}<span className="ap-wk-cnt">{counts[t.key] || 0}</span>
            </button>
          ))}
        </div>

        {loadError && items.length > 0 && (
          <div className="ap-wk-err" role="alert"><span>{loadError}</span><button type="button" className="ap-btn ap-btn--sm" onClick={retry}>Retry</button></div>
        )}

        {loading ? <Skeletons n={3} h={152} />
          : loadError && items.length === 0 ? <LoadError title="Couldn't load submissions" message={loadError} onRetry={retry} />
          : rows.length === 0 ? (
            <div className="ap-card ap-empty">
              <h3>{tab === 'all' ? 'Nothing to review yet' : `Nothing in “${TABS.find((t) => t.key === tab).label}”`}</h3>
              <p>Submitted creator content will show up here for you to review and approve.</p>
              {tab === 'all'
                ? <button type="button" className="ap-btn" onClick={() => navigate('/dashboard/business/all-campaigns')}>View campaigns</button>
                : <button type="button" className="ap-btn" onClick={() => setTab('all')}>See all submissions</button>}
            </div>
          ) : (
            <div className="ap-wk-list">
              {pageRows.map((it) => {
                const st = STATUS[it.status] || STATUS.pending_review;
                const files = it.files || [];
                const labeled = it.labeledFiles || [];
                const hasVideo = files.some((f) => isVideo(assetUrl(f)));
                const tracker = trackers[String(it.id)] || {};
                const left = tracker.free_revisions_remaining ?? it.freeRevisionsRemaining ?? 0;
                const name = firstWord(it.creator);
                let note = '';
                if (it.status === 'pending_review') {
                  note = it.stage === 'raw' ? 'Approving the raw cut sends it to editing next.' : `${left} free revision${left === 1 ? '' : 's'} left · payment held in escrow`;
                } else if (it.status === 'revision_requested') {
                  note = `${it.revisionsUsed || 1} revision${(it.revisionsUsed || 1) === 1 ? '' : 's'} requested · new cut due from the creator`;
                } else if (it.status === 'approved') note = 'Payment released to the creator';
                return (
                  <article key={it.id} className="ap-card" data-testid={`work-${it.id}`}>
                    <div className="ap-wk-card">
                      <Thumb
                        file={files[0]}
                        locked={it.status !== 'approved'}
                        duration={durations[it.id] || (it.duration ? fmtDur(Number(it.duration)) : '')}
                        onOpen={() => openFile(it)}
                        onDuration={(v) => setDurations((p) => (p[it.id] === v ? p : { ...p, [it.id]: v }))}
                      />
                      <div className="ap-wk-body">
                        <div className="ap-wk-head">
                          <div className="ap-wk-title">{it.title}</div>
                          <span className={`ap-pill ${st.tone}`}><span>{st.label}{it.status === 'pending_review' ? ` · ${it.stage === 'raw' ? 'raw cut' : 'edited cut'}` : ''}</span></span>
                        </div>
                        <div className="ap-wk-by"><Avatar name={name} src={it.photo ? assetUrl(it.photo) : ''} size={20} />{name}</div>
                        <div className="ap-wk-meta">Submitted {agoText(it.submittedAt) || 'recently'}{it.version ? ` · v${it.version}` : ''}</div>
                        <button type="button" className="ap-wk-camp" onClick={() => navigate(`/dashboard/business/campaign/${campaignOf(it)}`)}>{it.campaign} →</button>
                        {note ? <div className="ap-wk-meta">{note}</div> : null}
                      </div>
                    </div>
                    <div className="ap-wk-acts" style={{ marginTop: 12 }}>
                      {it.status === 'pending_review' && (hasVideo
                        ? <button type="button" className="ap-btn" onClick={() => openFile(it)}>Review</button>
                        : <button type="button" className="ap-btn" onClick={() => setApproveFor(it)}>{it.stage === 'raw' ? 'Approve raw cut' : 'Approve & release payment'}</button>)}
                      {it.status === 'revision_requested' && <span className="ap-btn ap-btn--ghost" aria-disabled="true">Awaiting resubmit</span>}
                      {it.status === 'approved' && (labeled.length > 1
                        ? labeled.map((f) => (
                          <button key={f.kind} type="button" className="ap-btn ap-btn--soft" disabled={!!downloading} onClick={() => download(it, `${it.title}-${f.kind}`, f.kind)}>
                            <Download size={16} /> {f.label || f.kind}
                          </button>))
                        : <button type="button" className="ap-btn ap-btn--soft" disabled={!!downloading} onClick={() => download(it)}><Download size={16} /> {downloading === `${it.id}` ? 'Starting…' : 'Download'}</button>)}
                      {it.status === 'approved' && it.creatorId && <button type="button" className="ap-btn ap-btn--ghost" onClick={() => setReviewFor(it)}>Rate creator</button>}
                      {it.status === 'approved' && it.creatorId && <button type="button" className="ap-btn ap-btn--ghost" onClick={() => setHireFor({ creatorId: it.creatorId, name })}>Hire again</button>}
                      {it.creatorId ? <button type="button" className="ap-wk-ic" aria-label={`Message ${name}`} onClick={() => navigate(`/messages?conv=${it.creatorId}`)}><MessageSquare size={18} /></button> : null}
                    </div>
                    {labeled.length > 1 && it.status !== 'approved' ? (
                      <div className="ap-wk-acts" style={{ marginTop: 8 }}>
                        {labeled.map((f) => (
                          <button key={f.kind} type="button" className="ap-btn ap-btn--soft ap-btn--sm" onClick={() => openFileUrl(it, f.url)}>{f.kind === 'raw' ? 'Raw file' : 'Edited file'}</button>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}
              {rows.length > shown && (
                <button type="button" className="ap-btn ap-btn--ghost ap-wk-more" style={{ gridColumn: '1 / -1' }} onClick={() => setShown((n) => n + PAGE)}>
                  Show more ({rows.length - shown} left)
                </button>
              )}
            </div>
          )}
      </div>

      {playerItem && player && (
        <ReviewPlayer
          key={`${player.id}-${player.src}`}
          item={playerItem}
          src={player.src}
          watermark={player.watermark}
          canAct={playerItem.status === 'pending_review' && (playerItem.files || []).some((f) => isVideo(assetUrl(f)))}
          tracker={trackers[String(playerItem.id)] || {}}
          submitting={revSubmitting}
          approving={approving}
          onClose={() => setPlayer(null)}
          onApprove={() => setApproveFor(playerItem)}
          onSubmit={submitRevision}
        />
      )}
      <ApproveSheet item={approveFor} busy={approving} onClose={() => setApproveFor(null)} onConfirm={() => approve(approveFor.id)} />
      <PaidSheet
        item={paidFor}
        downloading={!!downloading}
        onClose={() => setPaidFor(null)}
        onDownload={() => download(paidFor)}
        onRate={() => { setReviewFor(paidFor); setPaidFor(null); }}
        onHire={() => { setHireFor({ creatorId: paidFor.creatorId, name: firstWord(paidFor.creator) }); setPaidFor(null); }}
      />
      <RateSheet item={reviewFor} onClose={() => setReviewFor(null)} onSubmit={submitReview} />
      {hireFor && <PlanBrief creatorId={hireFor.creatorId} creatorName={hireFor.name} onClose={() => setHireFor(null)} onPublished={() => setHireFor(null)} />}
    </AppShell>
  );
}
