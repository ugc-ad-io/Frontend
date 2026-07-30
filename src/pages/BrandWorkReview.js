import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import {
  SlidersHorizontal, MessageSquare, FileText, Download, Play, Clock, Calendar,
  FileVideo, CheckCircle2, Hourglass, RefreshCw, ListChecks, MoreHorizontal,
  ChevronLeft, ChevronRight, MessageSquarePlus,
} from 'lucide-react';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import ChatPopup from '../components/ChatPopup';
import RevisionRequestModal from '../components/RevisionRequestModal';
import VideoReviewModal, { fmtTs } from '../components/VideoReviewModal';
import ReviewModal from '../components/ReviewModal';
import '../styles/creator-marketplace.css';
import EmptyState from '../components/EmptyState';
import { Skeleton } from '../components/Skeleton';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const assetUrl = (u) => (!u ? '' : (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}${String(u).startsWith('/') ? '' : '/'}${u}`));
const isVideo = (u) => /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(String(u || '').split('?')[0]);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const fmtDur = (s) => { if (!s || !isFinite(s)) return ''; const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${String(sec).padStart(2, '0')}`; };
const fileExt = (f) => (f ? (String(f).split('?')[0].split('.').pop() || '').toUpperCase() : '');

function Thumb({ file, onOpen, onDuration, watermark }) {
  const [d, setD] = useState('');
  const url = assetUrl(file);
  const vid = isVideo(url);
  return (
    <div className="bwr-thumb" onClick={onOpen}>
      {url ? (vid
        ? <video src={`${url}#t=0.5`} muted playsInline preload="metadata" onLoadedMetadata={(e) => { const v = fmtDur(e.target.duration); setD(v); onDuration?.(v); }} />
        : <img src={url} alt="" />)
        : <div className="bwr-thumb-fb"><FileText size={26} /></div>}
      {watermark && <span className="bwr-wm" aria-hidden="true" />}
      <span className="bwr-play"><Play size={20} fill="currentColor" /></span>
      {d && <span className="bwr-dur">{d}</span>}
    </div>
  );
}

const TABS = [
  { key: 'approved', label: 'Approved', icon: CheckCircle2 },
  { key: 'pending_review', label: 'Pending Review', icon: Hourglass },
  { key: 'revision_requested', label: 'Revision', icon: RefreshCw },
  { key: 'all', label: 'All Submissions', icon: ListChecks },
];

const STATUS = {
  approved: { cls: 'ok', label: 'Approved', icon: CheckCircle2 },
  pending_review: { cls: 'pending', label: 'Pending Review', icon: Hourglass },
  revision_requested: { cls: 'warn', label: 'Revision', icon: RefreshCw },
};

const PER_PAGE_OPTIONS = [10, 20, 50];

export default function BrandWorkReview() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false); // mobile status-filter menu
  const [filterExpanded, setFilterExpanded] = useState(false); // desktop: click PINS the options open
  const [filterHover, setFilterHover] = useState(false);       // desktop: hover opens transiently
  const cfRef = useRef(null);
  const filterRef = useRef(null);
  const [chatWith, setChatWith] = useState(null);
  const [durations, setDurations] = useState({});
  const [menuId, setMenuId] = useState(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [videoModal, setVideoModal] = useState(null);
  const [revisionFor, setRevisionFor] = useState(null);
  const [videoReviewFor, setVideoReviewFor] = useState(null);   // { src, title, watermark }
  const [reviewFor, setReviewFor] = useState(null);   // row awaiting a post-approval rating
  const [trackers, setTrackers] = useState({});   // campaignId -> revision_tracker
  const [revSubmitting, setRevSubmitting] = useState(false);
  const busy = useRef(false);

  const load = async () => {
    try {
      const [camps, dir, dealList] = await Promise.all([
        axios.get(`${API}/campaigns?t=${Date.now()}`),
        axios.get(`${API}/business/creator-directory`).catch(() => ({ data: [] })),
        // Carries revision_tracker (free left / next fee) — the campaigns list doesn't,
        // so without this the modal can't warn the brand before a ₹500 debit.
        axios.get(`${API}/deals/business`).catch(() => ({ data: [] })),
      ]);
      const trackerMap = {};
      (Array.isArray(dealList.data) ? dealList.data : []).forEach((d) => {
        const cid = d?.campaign?.id || d?.campaign_id;
        if (cid) trackerMap[String(cid)] = d.revision_tracker || {};
      });
      setTrackers(trackerMap);
      const nameMap = {};
      const photoMap = {};
      (Array.isArray(dir.data) ? dir.data : []).forEach((c) => { nameMap[String(c.id)] = c.name; photoMap[String(c.id)] = c.profile_photo; });
      const list = (camps.data || []).filter((c) => c.work_submission).map((c) => {
        const ws = c.work_submission;
        const status = ws.status || (c.status === 'completed' ? 'approved' : 'pending_review');
        return {
          id: c.id || c._id,
          title: c.title || 'Submitted content',
          campaign: c.title || (c.category ? c.category.replace(/_/g, ' ') : 'Campaign'),
          creatorId: ws.creator_id,
          creator: nameMap[String(ws.creator_id)] || 'Creator',
          photo: photoMap[String(ws.creator_id)] || '',
          files: ws.work_files || [],
          submittedAt: ws.submitted_at,
          status,
        };
      });
      setItems(list);
    } catch (e) {
      setItems([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { setPage(1); }, [tab, perPage]);

  // Close the mobile filter menu on any outside click.
  useEffect(() => {
    if (!filterOpen) return undefined;
    const onDoc = (e) => { if (filterRef.current && !filterRef.current.contains(e.target)) setFilterOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [filterOpen]);

  // Desktop: a click PINS the filter open — close it again on an outside click.
  useEffect(() => {
    if (!filterExpanded) return undefined;
    const onDoc = (e) => { if (cfRef.current && !cfRef.current.contains(e.target)) setFilterExpanded(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [filterExpanded]);

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

  // `id` here is the campaign/deal id (see load(): item.id = c.id). The deal
  // endpoints resolve the latest work submission internally, so we use those
  // instead of /work/{workId}/... (which expects a work_submission id and 404s).
  const approve = async (id) => {
    if (busy.current) return; busy.current = true;
    // Capture the row BEFORE load() replaces the list — we need creatorId/name for the
    // rating prompt, and after the reload this row's status has flipped to 'approved'.
    const it = items.find((i) => i.id === id);
    try {
      await axios.post(`${API}/deals/${id}/approve`);
      toast.success('Approved — payment released to the creator');
      await load();
      // Ask for a rating right after approval. This tab used to approve silently — only
      // the standalone /work-review/:id page prompted — so brands approving from here
      // were never asked to review the creator.
      if (it?.creatorId) setReviewFor(it);
    }
    catch { toast.error('Failed to approve'); }
    finally { busy.current = false; }
  };

  const submitReview = async ({ rating, review }) => {
    try {
      await axios.post(`${API}/reviews`, {
        campaign_id: reviewFor.id, creator_id: reviewFor.creatorId, rating, review,
      });
      toast.success('Review submitted — thanks for the feedback!');
      setReviewFor(null);
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Could not submit your review');
    }
  };
  const requestRevision = (id) => setRevisionFor(id);
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
      // The modal produces structured { items, notes, deadline_at }; the deal
      // endpoint takes { feedback, requested_changes }. Flatten the items into a
      // readable feedback string so nothing is lost.
      // This deal endpoint only accepts a flat `feedback` string (it never receives
      // the structured items), so a video comment's timestamp must be baked INTO
      // the line or it's lost. Format matches _fmt_video_ts() on the server:
      //   "[must-fix @ 0:04] Re-shoot the intro"
      const items = payload.items || [];
      const feedback = [
        ...items.map((it) => {
          const ts = Number.isFinite(it.timestamp_seconds) ? ` @ ${fmtTs(it.timestamp_seconds)}` : '';
          return `[${it.severity || 'must-fix'}${ts}] ${it.description}${it.brief_reference ? ` (ref: ${it.brief_reference})` : ''}`;
        }),
        payload.notes ? `\nNotes: ${payload.notes}` : '',
      ].filter(Boolean).join('\n');
      // Send ONLY `feedback`. `requested_changes` used to carry the same items again
      // (raw, without severity) and the backend appends both into one string — so the
      // creator saw every change twice: "[must-fix] new look" AND "new look".
      const { data } = await axios.post(`${API}/deals/${revisionFor}/request-revision`, {
        feedback,
      });
      // Say so when money actually moved — a bare "Revision requested" hid the debit.
      toast.success(data?.paid
        ? `Revision requested — ₹${data.fee_charged} charged. Wallet balance: ₹${Math.round(data.new_balance)}.`
        : 'Revision requested');
      setRevisionFor(null);
      setVideoReviewFor(null);
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || 'Failed to request revision');
    } finally { setRevSubmitting(false); }
  };
  const download = async (id, title) => {
    try {
      const res = await axios.get(`${API}/work/${id}/download`, { responseType: 'blob' });
      const u = window.URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = u; a.download = `${title || 'deliverable'}.mp4`;
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(u);
    } catch (err) {
      // The server sends the reason (not approved / no file / not authorized). With a
      // blob responseType, the error body is a Blob — read it so we stop showing the
      // misleading "unlocks after approval" for every failure.
      let msg = 'Download failed';
      try {
        const body = err?.response?.data;
        const text = body instanceof Blob ? await body.text() : JSON.stringify(body);
        msg = JSON.parse(text)?.detail || msg;
      } catch { /* keep fallback */ }
      toast.error(msg);
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
      <div className="cmk-page-head cmk-page-head--filter" style={{ marginBottom: 6 }}>
        <div>
          <h1>Work Review</h1>
          <p>Review submitted content and provide feedback.</p>
        </div>
        {/* Mobile only: sits on the title row and replaces the chip strip. */}
        <div className="wr-filter-wrap" ref={filterRef}>
          <button type="button" className="wr-filter-btn" onClick={() => setFilterOpen((v) => !v)} aria-haspopup="menu" aria-expanded={filterOpen}>
            <SlidersHorizontal size={16} /> Filter
          </button>
          {filterOpen && (
            <div className="wr-filter-menu" role="menu">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="menuitemradio"
                  aria-checked={tab === t.key}
                  className={tab === t.key ? 'is-active' : ''}
                  onClick={() => { setTab(t.key); setFilterOpen(false); }}
                >
                  {t.label} <em>({counts[t.key] || 0})</em>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Desktop: "Filter" expands its status options left→right on hover/click.
          Hidden on mobile (the page-head Filter is used there). */}
      <div
        ref={cfRef}
        className={`cf-filter-row${(filterExpanded || filterHover) ? ' is-open' : ''}`}
        onMouseEnter={() => setFilterHover(true)}
        onMouseLeave={() => setFilterHover(false)}
      >
        <button type="button" className="cf-filter-btn" onClick={() => setFilterExpanded((v) => !v)} aria-expanded={filterExpanded || filterHover}>
          <SlidersHorizontal size={16} /> Filter
        </button>
        <div className="cf-options">
          <div className="cf-options-inner">
            {TABS.map((t) => (
              <button key={t.key} type="button" className={tab === t.key ? 'is-active' : ''} onClick={() => setTab(t.key)}>
                <t.icon size={15} /> {t.label} <em>({counts[t.key] || 0})</em>
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="bwr-list">
          {Array.from({ length: 4 }).map((_, i) => (
            <article className="bwr-card" key={i} aria-hidden="true">
              {/* left: 16/9 thumb — matches <Thumb>. NOTE: don't reuse the .bwr-thumb class
                  here — its dark #0b1020 video background overrides the skeleton shimmer and
                  paints the placeholder solid black. Size it inline instead so it keeps the
                  light shimmer like the other bars. */}
              <Skeleton width={220} height="auto" radius={14} style={{ aspectRatio: '16 / 9', flexShrink: 0 }} />
              {/* middle: title, by-line, campaign box, meta row */}
              <div className="bwr-body" style={{ flex: 1, minWidth: 0 }}>
                <Skeleton width="45%" height={18} />
                <Skeleton width="30%" height={12} style={{ marginTop: 10 }} />
                <Skeleton width="100%" height={54} radius={12} style={{ marginTop: 14 }} />
                <div style={{ display: 'flex', gap: 24, marginTop: 14 }}>
                  <Skeleton width={70} height={30} />
                  <Skeleton width={70} height={30} />
                  <Skeleton width={90} height={30} />
                </div>
              </div>
              {/* right: status pill + action buttons */}
              <div className="bwr-side" style={{ display: 'flex', flexDirection: 'column', gap: 10, width: 200 }}>
                <Skeleton width={110} height={30} radius={16} style={{ alignSelf: 'flex-end' }} />
                <Skeleton width="100%" height={44} radius={12} style={{ marginTop: 'auto' }} />
                <Skeleton width="100%" height={44} radius={12} />
              </div>
            </article>
          ))}
        </div>
      ) : total === 0 ? (
        <EmptyState title={`Nothing in “${TABS.find((t) => t.key === tab).label}”`} message="Submitted creator content will show up here for you to review and approve." />
      ) : (
        <>
          <div className="bwr-list">
            {pageRows.map((it) => {
              const st = STATUS[it.status] || STATUS.pending_review;
              const duration = durations[it.id] || '';
              const ftype = fileExt(it.files[0]) || '—';
              return (
                <article key={it.id} className="bwr-card">
                  <Thumb file={it.files[0]} onOpen={() => openFile(it)} watermark={it.status !== 'approved'} onDuration={(v) => setDurations((p) => (p[it.id] === v ? p : { ...p, [it.id]: v }))} />

                  <div className="bwr-body">
                    <h3 className="bwr-title">{it.title}</h3>
                    <div className="bwr-by">
                      <span className="bwr-by-ava">{it.photo ? <img src={assetUrl(it.photo)} alt="" /> : '@'}</span>
                      by <b>{handleLabelSafe(it.creator)}</b>
                      <i className="bwr-by-dot" />
                      <Calendar size={14} /> Submitted on {fmtDate(it.submittedAt)}
                    </div>

                    <div
                      className="bwr-cbox bwr-cbox-link"
                      role="button"
                      tabIndex={0}
                      onClick={() => it.id && navigate(`/dashboard/business/campaign/${it.id}`)}
                      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && it.id) navigate(`/dashboard/business/campaign/${it.id}`); }}
                    >
                      <span className="bwr-cbox-ic"><FileText size={18} /></span>
                      <div><label>Campaign</label><strong>{it.campaign}</strong></div>
                    </div>

                    <div className="bwr-meta">
                      <div className="bwr-meta-item"><Clock size={16} /><div><label>Duration</label><span>{duration || '—'}</span></div></div>
                      <div className="bwr-meta-item"><FileVideo size={16} /><div><label>File Type</label><span>{ftype}</span></div></div>
                      <div className="bwr-meta-item"><Calendar size={16} /><div><label>Submitted</label><span>{fmtDate(it.submittedAt)}</span></div></div>
                    </div>
                  </div>

                  <div className="bwr-side">
                    <div className="bwr-side-top">
                      <span className={`bwr-pill ${st.cls}`}><st.icon size={14} /> {st.label}</span>
                      <div className="bwr-more-wrap">
                        <button type="button" className="bwr-more" aria-label="More actions" onClick={() => setMenuId(menuId === it.id ? null : it.id)}>
                          <MoreHorizontal size={18} />
                        </button>
                        {menuId === it.id && (
                          <>
                            <div className="bwr-menu-backdrop" onClick={() => setMenuId(null)} />
                            <div className="bwr-menu">
                              <button type="button" onClick={() => { setMenuId(null); openFile(it); }}><Play size={15} /> Open file</button>
                              {it.status !== 'approved' && <button type="button" onClick={() => { setMenuId(null); it.files.some((f) => isVideo(assetUrl(f))) ? openVideoReview(it) : requestRevision(it.id); }}><RefreshCw size={15} /> Request revision</button>}
                              {it.status === 'pending_review' && <button type="button" onClick={() => { setMenuId(null); approve(it.id); }}><CheckCircle2 size={15} /> Approve</button>}
                              <button type="button" onClick={() => { setMenuId(null); message(it); }}><MessageSquare size={15} /> Message creator</button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {it.status === 'approved' && (
                      <button type="button" className="bwr-btn primary" onClick={() => download(it.id, it.title)}><Download size={16} /> Download</button>
                    )}
                    {it.status === 'pending_review' && (
                      <>
                        <button type="button" className="bwr-btn approve" onClick={() => approve(it.id)}><CheckCircle2 size={16} /> Approve</button>
                        {/* Single revision path: the timestamped video-review flow, labelled
                            "Request Revision". Only shown when there's a video to scrub. */}
                        {it.files.some((f) => isVideo(assetUrl(f))) && (
                          <button type="button" className="bwr-btn" onClick={() => openVideoReview(it)}><MessageSquarePlus size={16} /> Request Revision</button>
                        )}
                      </>
                    )}
                    {it.status === 'revision_requested' && (
                      <button type="button" className="bwr-btn" disabled><RefreshCw size={16} /> Awaiting resubmit</button>
                    )}
                    <button type="button" className="bwr-btn" onClick={() => message(it)}><MessageSquare size={16} /> Message Creator</button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="bwr-foot">
            <span className="bwr-foot-count">Showing {total === 0 ? 0 : start + 1}–{Math.min(start + perPage, total)} of {total} results</span>
            <div className="bwr-pager">
              <button type="button" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} aria-label="Previous page"><ChevronLeft size={18} /></button>
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
                <button key={n} type="button" className={n === safePage ? 'on' : ''} onClick={() => setPage(n)}>{n}</button>
              ))}
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
          onClose={() => setRevisionFor(null)}
          onSubmit={submitRevision}
          submitting={revSubmitting}
          freeRemaining={trackers[String(revisionFor)]?.free_revisions_remaining}
          nextFee={trackers[String(revisionFor)]?.next_revision_fee}
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
        />
      )}

      {videoModal && (
        <div className="bwr-vid-overlay" onClick={() => setVideoModal(null)}>
          <div className="bwr-vid-card" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="bwr-vid-close" aria-label="Close" onClick={() => setVideoModal(null)}>✕</button>
            <div className="bwr-vid-frame">
              <video
                src={videoModal.src}
                controls
                autoPlay
                playsInline
                className="bwr-vid-el"
                // Until the deliverable is approved, strip the browser's native
                // Download menu item and block right-click "Save video as…" so the
                // brand can only preview (watermarked), not grab the raw file.
                controlsList={videoModal.watermark ? 'nodownload noremoteplayback' : undefined}
                disablePictureInPicture={videoModal.watermark}
                onContextMenu={videoModal.watermark ? (e) => e.preventDefault() : undefined}
              />
              {videoModal.watermark && <span className="bwr-wm" aria-hidden="true" />}
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
