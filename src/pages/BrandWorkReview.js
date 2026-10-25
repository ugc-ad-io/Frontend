import { mediaUrl } from '../utils/mediaUrl';
import { useLiveEffect } from '../lib/liveUpdates';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { downloadDeliverable } from '../utils/downloadDeliverable';
import { apiErrorMessage } from '../utils/apiError';
import {
  MessageSquare, FileText, Download, Play, FileVideo, ChevronLeft, ChevronRight,
} from 'lucide-react';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import ChatPopup from '../components/ChatPopup';
import RevisionRequestModal from '../components/RevisionRequestModal';
import VideoReviewModal from '../components/VideoReviewModal';
import ReviewModal from '../components/ReviewModal';
import '../styles/creator-marketplace.css';
import '../styles/brand-mobile.css';
import '../styles/brand-ui.css';
import '../styles/brand-ui-pages.css';
import '../styles/brand-ui-work.css';
import { pageWindow } from '../utils/pageWindow';
import EmptyState from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';
import PhotoOrInitial from '../components/PhotoOrInitial';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const assetUrl = mediaUrl;
// Row ids are deal ids ("<campaignId>~<creatorId>" on a multi-creator brief); the campaign page needs the real campaign id.
const campaignOf = (it) => it.campaignId || String(it.id || '').split('~')[0];
const isVideo = (u) => /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(String(u || '').split('?')[0]);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const fmtDur = (s) => { if (!s || !isFinite(s)) return ''; const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${String(sec).padStart(2, '0')}`; };
const fileExt = (f) => (f ? (String(f).split('?')[0].split('.').pop() || '').toUpperCase() : '');

function Thumb({ file, onOpen, onDuration, watermark, cls = 'bwr-thumb', locked = false }) {
  const [d, setD] = useState('');
  // A submission stored before Cloudinary was in place can point at a file
  // that no longer exists (Render's disk is wiped on deploy) — show a clear
  // "unavailable" tile instead of a silent black box.
  const [broken, setBroken] = useState(false);
  const url = assetUrl(file);
  const vid = isVideo(url);
  useEffect(() => { setBroken(false); setD(''); }, [url]);
  return (
    <div className={cls} onClick={onOpen}>
      {url && !broken ? (vid
        ? <video src={`${url}#t=0.5`} muted playsInline preload="metadata" onError={() => setBroken(true)} onLoadedMetadata={(e) => { const v = fmtDur(e.target.duration); setD(v); onDuration?.(v); }} />
        : <img src={url} alt="" onError={() => setBroken(true)} />)
        : <div className="bwr-thumb-fb"><FileText size={26} />{broken && <small style={{ display: 'block', marginTop: 6, opacity: 0.75 }}>File unavailable</small>}</div>}
      {watermark && <span className="bwr-wm" aria-hidden="true" />}
      {locked && <span className="bui-wr-lock" aria-hidden="true">UGCAD.IO PREVIEW</span>}
      <span className={cls === 'bwr-thumb' ? 'bwr-play' : 'bui-wr-play'}><Play size={20} fill="currentColor" /></span>
      {d && <span className={cls === 'bwr-thumb' ? 'bwr-dur' : 'bui-wr-dur'}>{d}</span>}
    </div>
  );
}

const TABS = [
  { key: 'all', label: 'All submissions' },
  { key: 'pending_review', label: 'Pending review' },
  { key: 'revision_requested', label: 'Revision' },
  { key: 'approved', label: 'Approved' },
];

const STATUS = {
  approved: { tone: 'ok', label: 'Approved' },
  pending_review: { tone: 'warn', label: 'Pending review' },
  // Raw footage with UGC.ad's editing team — not reviewable until the cut lands.
  awaiting_edit: { tone: 'muted', label: 'With UGC.ad editors' },
  // Raw video approved — the creator is editing it (raw → edited flow).
  awaiting_edited: { tone: 'muted', label: 'Creator editing' },
  revision_requested: { tone: 'bad', label: 'Revision requested' },
};

// "2h ago" / "3d ago" / a date once it's older than a week.
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

const PER_PAGE_OPTIONS = [10, 20, 50];

export default function BrandWorkReview() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  // Set when the list request FAILED, so a broken request is not shown as "nothing to review".
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('all');
  const [chatWith, setChatWith] = useState(null);
  const [durations, setDurations] = useState({});
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [videoModal, setVideoModal] = useState(null);
  const [videoErr, setVideoErr] = useState(false);   // current modal video failed to load
  const [revisionFor, setRevisionFor] = useState(null);
  const [videoReviewFor, setVideoReviewFor] = useState(null);   // { src, title, watermark }
  const [reviewFor, setReviewFor] = useState(null);   // row awaiting a post-approval rating
  const [trackers, setTrackers] = useState({});   // deal id -> revision counters
  const [revSubmitting, setRevSubmitting] = useState(false);
  const busy = useRef(false);

  // A fresh video in the modal starts from a clean error state.
  useEffect(() => { setVideoErr(false); }, [videoModal?.src]);

  const load = async () => {
    try {
      // One row per (campaign, creator) — campaign.work_submission (the old source
      // here) is a single field overwritten on every submit, so a second hired
      // creator's work silently replaced the first's and never showed up.
      const review = await axios.get(`${API}/business/work-review?t=${Date.now()}`);
      const rows = Array.isArray(review.data) ? review.data : [];
      setLoadError('');
      setItems(rows);
      setTrackers(Object.fromEntries(rows.map(row => [String(row.id), {
        free_revisions_remaining: row.freeRevisionsRemaining,
        next_revision_fee: row.nextRevisionFee,
        paid_revision_fee: row.paidRevisionFee,
      }])));
    } catch (e) {
      // Keep the rows we already have on a failed live refresh; only a first load shows the error state.
      setLoadError(apiErrorMessage(e, 'Could not load submissions. Check your connection and try again.'));
    } finally { setLoading(false); }
  };

  useLiveEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { setPage(1); }, [tab, perPage]);

  const counts = useMemo(() => {
    const o = { all: items.length };
    ['approved', 'pending_review', 'revision_requested'].forEach((k) => { o[k] = items.filter((i) => i.status === k).length; });
    return o;
  }, [items]);

  const rows = useMemo(() => (tab === 'all' ? items : items.filter((i) => i.status === tab)), [items, tab]);

  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * perPage;
  const pageRows = rows.slice(start, start + perPage);

  // `id` here is the deal id — bare campaign id for the first/only creator, or
  // "<campaignId>~<creatorId>" on a multi-creator brief (see /business/work-review).
  // The deal endpoints resolve that suffix to the right creator's submission.
  const approve = async (id) => {
    if (busy.current) return; busy.current = true;
    // Capture the row BEFORE load() replaces the list — we need creatorId/name for the
    // rating prompt, and after the reload this row's status has flipped to 'approved'.
    const it = items.find((i) => i.id === id);
    try {
      const { data } = await axios.post(`${API}/deals/${id}/approve`);
      toast.success(data?.payout_status === 'awaiting_edited'
        ? 'Raw video approved - the creator will submit the edited video next'
        : it?.stage === 'raw' && it?.editMode === 'ugc'
          ? 'Raw video approved - creator paid, UGC.ad is editing it'
          : 'Approved - payment released to the creator');
      await load();
      // Ask for a rating right after approval. This tab used to approve silently — only
      // the standalone /work-review/:id page prompted — so brands approving from here
      // were never asked to review the creator.
      if (it?.creatorId && data?.payout_status === 'released' && it?.stage !== 'raw') setReviewFor(it);
    }
    catch (err) { toast.error(apiErrorMessage(err, 'Failed to approve')); }
    finally { busy.current = false; }
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
  const requestRevision = (id) => {
    setRevisionFor(id);
  };
  // Timestamped video review. Sets `revisionFor` too so submitRevision() (shared
  // with the text form) posts against the same work item.
  const openVideoReview = (it) => {
    const f = it.files.find((x) => isVideo(assetUrl(x)));
    if (!f) { toast.error('No video on this submission to review'); return; }
    setRevisionFor(it.id);
    setVideoReviewFor({ src: assetUrl(f), title: it.title, watermark: it.status !== 'approved' });
  };
  const submitRevision = async (payload) => {
    if (!revisionFor) return;
    setRevSubmitting(true);
    try {
      // Same endpoint and body as the app: the structured { items, notes, deadline_at }
      // goes to /work/{work_id}/request-revision (the deal endpoint only took a flat
      // `feedback` string and lost the deadline). A work-review row carries the deal id,
      // so resolve this creator's latest submission first.
      const row = items.find((i) => i.id === revisionFor);
      const wid = row?.workId || (row?.campaignId
        ? (await axios.get(`${API}/work/campaign/${row.campaignId}${row.creatorId ? `?creator_id=${encodeURIComponent(row.creatorId)}` : ''}`).catch(() => null))?.data?.id
        : null);
      if (!wid) { toast.error('Could not find the submitted work. Refresh and try again.'); return; }
      const { data } = await axios.post(`${API}/work/${wid}/request-revision`, payload);
      // Say so when money actually moved — a bare "Revision requested" hid the debit.
      toast.success(data?.paid
        ? `Revision requested - ₹${data.fee_charged} charged. Wallet balance: ₹${Math.round(data.new_balance)}.`
        : 'Revision requested');
      setRevisionFor(null);
      setVideoReviewFor(null);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to request revision');
    } finally { setRevSubmitting(false); }
  };
  const download = async (id, title, asset) => {
    try {
      await downloadDeliverable(API, id, title, asset);
    } catch (err) {
      // The server sends the reason (not approved / no file / not authorized).
      toast.error(apiErrorMessage(err, 'Download failed'));
    }
  };
  const openFile = (it) => {
    const f = it.files.find((x) => isVideo(x)) || it.files[0];
    if (!f) return;
    const url = assetUrl(f);
    // Videos play in a watermarked in-app modal until approved; other files just open.
    if (isVideo(url)) setVideoModal({ src: url, watermark: it.status !== 'approved', title: it.title });
    else window.open(url, '_blank');
  };
  const message = (it) => setChatWith({ id: it.creatorId, name: String(it.creator).replace('@', ''), photo: it.photo });

  return (
    <BrandTopNavLayout>
      <div className="bui-main bui-main--detail">
        <div className="bui-titlerow">
          <div>
            <h1 className="bui-h1">Work review</h1>
            <p className="bui-sub">Watch every delivery, approve to release payment, or ask for changes.</p>
          </div>
        </div>

        <div className="bui-tabs" role="tablist" aria-label="Filter submissions">
          {TABS.map((t) => (
            <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} className={`bui-tab${tab === t.key ? ' is-on' : ''}`} onClick={() => setTab(t.key)}>
              {t.label}<span>{counts[t.key] || 0}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bui-wr-grid">
            {Array.from({ length: 4 }).map((_, i) => (
              <article className="bui-wr" key={i} aria-hidden="true">
                <Skeleton width={168} height="auto" radius={14} style={{ aspectRatio: '9 / 16', flexShrink: 0 }} />
                <div className="bui-wr-body">
                  <Skeleton width="40%" height={22} />
                  <Skeleton width="80%" height={20} />
                  <Skeleton width="55%" height={14} />
                </div>
              </article>
            ))}
          </div>
        ) : loadError && items.length === 0 ? (
          <EmptyState title="Couldn't load submissions" message={loadError} action={{ label: 'Try again', onClick: () => { setLoading(true); load(); } }} />
        ) : total === 0 ? (
          <EmptyState title={`Nothing in “${TABS.find((t) => t.key === tab).label}”`} message="Submitted creator content will show up here for you to review and approve." />
        ) : (
          <>
            <div className="bui-wr-grid">
              {pageRows.map((it) => {
                const st = STATUS[it.status] || STATUS.pending_review;
                const duration = durations[it.id] || (it.duration ? fmtDur(Number(it.duration)) : '');
                const hasRaw = (it.labeledFiles || []).some((f) => f.kind === 'raw');
                const hasEdited = (it.labeledFiles || []).some((f) => f.kind === 'edited');
                const hasVideoFile = it.files.some((f) => isVideo(assetUrl(f)));
                const locked = it.status !== 'approved';
                const tracker = trackers[String(it.id)] || {};
                let note = '';
                if (it.status === 'pending_review') {
                  note = it.stage === 'raw'
                    ? 'Approving the raw cut sends it to editing next.'
                    : `${tracker.free_revisions_remaining ?? it.freeRevisionsRemaining ?? 0} free revision${(tracker.free_revisions_remaining ?? it.freeRevisionsRemaining) === 1 ? '' : 's'} left · payment held in escrow.`;
                } else if (it.status === 'revision_requested') {
                  note = `${it.revisionsUsed || 1} revision${(it.revisionsUsed || 1) === 1 ? '' : 's'} requested · new cut due from the creator.`;
                } else if (it.status === 'approved') {
                  note = 'Payment released to the creator.';
                }
                const version = `${it.stage === 'raw' ? 'Raw cut' : 'Edited cut'}${it.version ? ` · v${it.version}` : ''}${it.files[0] ? ` · ${fileExt(it.files[0])}` : ''}`;
                return (
                  <article key={it.id} className="bui-wr">
                    <Thumb file={it.files[0]} onOpen={() => openFile(it)} watermark={false} onDuration={(v) => setDurations((p) => (p[it.id] === v ? p : { ...p, [it.id]: v }))} cls="bui-wr-thumb" locked={locked} />
                    <div className="bui-wr-body">
                      <div className="bui-wr-top">
                        <span className={`bui-status bui-status--${st.tone}`}>{st.label}</span>
                        <span className="bui-wr-ver">{version}</span>
                      </div>
                      <h2 className="bui-wr-title">{it.title}</h2>
                      <div className="bui-wr-by">
                        <span className="bui-ava24"><PhotoOrInitial src={it.photo ? assetUrl(it.photo) : ''} initial="@" /></span>
                        by <strong>{handleLabelSafe(it.creator)}</strong> &middot; submitted {agoText(it.submittedAt)}
                      </div>
                      <button type="button" className="bui-wr-camp" onClick={() => it.id && navigate(`/dashboard/business/campaign/${campaignOf(it)}`)}>{it.campaign} &rarr;</button>
                      <div className="bui-wr-files">
                        {(it.labeledFiles || []).length > 1 ? it.labeledFiles.map((f) => (
                          <button key={`${f.kind}-${f.url}`} type="button" className="bui-fchip is-on" onClick={() => openFile({ ...it, files: [f.url] })}>{f.kind === 'raw' ? 'Raw file' : 'Edited file'}</button>
                        )) : (
                          <>
                            <span className={`bui-fchip${hasRaw || it.stage === 'raw' ? ' is-on' : ''}`}>Raw file</span>
                            <span className={`bui-fchip${hasEdited || (it.stage && it.stage !== 'raw') ? ' is-on' : ''}`}>Edited file</span>
                          </>
                        )}
                      </div>
                      {note && <div className="bui-wr-note">{note}</div>}
                      <div className="bui-wr-actions">
                        {it.status === 'pending_review' && (
                          <>
                            <button type="button" className="bui-btn bui-btn--sm40 approve" onClick={() => approve(it.id)}>
                              {it.stage === 'raw' ? (it.editMode === 'ugc' ? 'Approve raw · UGC.ad edits next' : 'Approve raw · creator edits next') : 'Approve & release payment'}
                            </button>
                            {hasVideoFile && (
                              <button type="button" className="bui-btn bui-btn--ghost bui-btn--sm40" onClick={() => openVideoReview(it)}>Request revision</button>
                            )}
                          </>
                        )}
                        {it.status === 'revision_requested' && <span className="bui-btn bui-btn--ghost bui-btn--sm40 is-disabled">Awaiting resubmit</span>}
                        {it.status === 'approved' && (
                          (it.labeledFiles || []).length > 1
                            ? it.labeledFiles.map((f) => (
                              <button key={f.kind} type="button" className="bui-btn bui-btn--sm40" onClick={() => download(it.id, `${it.title}-${f.kind}`, f.kind)}><Download size={15} /> Download {f.label}</button>
                            ))
                            : <button type="button" className="bui-btn bui-btn--sm40" onClick={() => download(it.id, it.title)}><Download size={15} /> Download</button>
                        )}
                        {it.status === 'approved' && it.creatorId && (
                          <button type="button" className="bui-btn bui-btn--ghost bui-btn--sm40" onClick={() => setReviewFor(it)}>Rate creator</button>
                        )}
                        <button type="button" className="bui-iconbtn-sq" aria-label={`Message ${handleLabelSafe(it.creator)}`} onClick={() => message(it)}><MessageSquare size={16} /></button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="bwr-foot">
              <span className="bwr-foot-count">Showing {total === 0 ? 0 : start + 1}&ndash;{Math.min(start + perPage, total)} of {total} results</span>
              <div className="bwr-pager">
                <button type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} aria-label="Previous page"><ChevronLeft size={18} /></button>
                {pageWindow(safePage, pageCount).map((n, i) => (n === '…'
                  ? <span key={`gap-${i}`} className="bwr-pager-gap" aria-hidden="true">&hellip;</span>
                  : <button key={n} type="button" className={n === safePage ? 'on' : ''} onClick={() => setPage(n)} aria-label={`Page ${n}`} aria-current={n === safePage ? 'page' : undefined}>{n}</button>))}
                <button type="button" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)} aria-label="Next page"><ChevronRight size={18} /></button>
              </div>
              <div className="bwr-perpage">
                <label htmlFor="bwr-pp">Show</label>
                <select id="bwr-pp" value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>
                  {PER_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n} per page</option>)}
                </select>
              </div>
            </div>
          </>
        )}
      </div>

      {chatWith && <ChatPopup user={chatWith} onClose={() => setChatWith(null)} />}
      {reviewFor && (
        <ReviewModal
          title={`Rate ${reviewFor.creator ? handleLabelSafe(reviewFor.creator) : 'this creator'}`}
          subtitle={reviewFor.campaign}
          onClose={() => setReviewFor(null)}
          onSubmit={submitReview}
        />
      )}
      {/* Both flows post via submitRevision and share `revisionFor`, so the text
          form must stand down while the video review is open. */}
      {revisionFor && !videoReviewFor && (
        <RevisionRequestModal
          onClose={() => { setRevisionFor(null); }}
          onSubmit={submitRevision}
          submitting={revSubmitting}
          freeRemaining={trackers[String(revisionFor)]?.free_revisions_remaining}
          nextFee={trackers[String(revisionFor)]?.next_revision_fee}
          paidFee={trackers[String(revisionFor)]?.paid_revision_fee}
        />
      )}

      {videoReviewFor && (
        <VideoReviewModal
          src={videoReviewFor.src}
          title={videoReviewFor.title}
          watermark={videoReviewFor.watermark}
          onClose={() => { setVideoReviewFor(null); setRevisionFor(null); }}
          onSubmit={submitRevision}
          submitting={revSubmitting}
          freeRemaining={trackers[String(revisionFor)]?.free_revisions_remaining}
          nextFee={trackers[String(revisionFor)]?.next_revision_fee}
          paidFee={trackers[String(revisionFor)]?.paid_revision_fee}
        />
      )}

      {videoModal && (
        <div className="bwr-vid-overlay" onClick={() => setVideoModal(null)}>
          <div className="bwr-vid-card" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="bwr-vid-close" aria-label="Close" onClick={() => setVideoModal(null)}>✕</button>
            <div className="bwr-vid-frame">
              {videoErr ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 260, padding: 24, color: '#fff', textAlign: 'center' }}>
                  <FileVideo size={40} style={{ opacity: 0.6 }} />
                  <strong>Video could not be loaded</strong>
                  <span style={{ fontSize: 13, opacity: 0.75 }}>Check your connection and retry loading the video.</span>
                  <button type="button" className="bwr-btn" onClick={() => setVideoErr(false)}>Retry video</button>
                </div>
              ) : (
                <video
                  src={videoModal.src}
                  controls
                  autoPlay
                  playsInline
                  className="bwr-vid-el"
                  onError={() => setVideoErr(true)}
                  // Until the deliverable is approved, strip the browser's native
                  // Download menu item and block right-click "Save video as…" so the
                  // brand can only preview (watermarked), not grab the raw file.
                  controlsList={videoModal.watermark ? 'nodownload noremoteplayback' : undefined}
                  disablePictureInPicture={videoModal.watermark}
                  onContextMenu={videoModal.watermark ? (e) => e.preventDefault() : undefined}
                />
              )}
              {videoModal.watermark && !videoErr && <span className="bwr-wm" aria-hidden="true" />}
            </div>
            {videoModal.title && <div className="bwr-vid-name">{videoModal.title}</div>}
          </div>
        </div>
      )}
    </BrandTopNavLayout>
  );
}

function handleLabelSafe(c) {
  // First name only — strip a leading "@" and drop any surname.
  return String(c || 'Creator').replace(/^@/, '').trim().split(/\s+/)[0] || 'Creator';
}
