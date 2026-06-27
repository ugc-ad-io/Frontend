import { useState, useEffect, useMemo, useRef } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  SlidersHorizontal, MessageSquare, FileText, Download, Play, Clock, Calendar,
  FileVideo, CheckCircle2, Hourglass, RefreshCw, ListChecks, MoreHorizontal,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import ChatPopup from '../components/ChatPopup';
import { DEMO_WORK_REVIEW } from '../data/brandDemo';
import '../styles/creator-marketplace.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const assetUrl = (u) => (!u ? '' : (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}${String(u).startsWith('/') ? '' : '/'}${u}`));
const isVideo = (u) => /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(String(u || '').split('?')[0]);
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const fmtDur = (s) => { if (!s || !isFinite(s)) return ''; const m = Math.floor(s / 60); const sec = Math.floor(s % 60); return `${m}:${String(sec).padStart(2, '0')}`; };
const fileExt = (f) => (f ? (String(f).split('?')[0].split('.').pop() || '').toUpperCase() : '');

function Thumb({ file, onOpen, onDuration }) {
  const [d, setD] = useState('');
  const url = assetUrl(file);
  const vid = isVideo(url);
  return (
    <div className="bwr-thumb" onClick={onOpen}>
      {url ? (vid
        ? <video src={`${url}#t=0.5`} muted playsInline preload="metadata" onLoadedMetadata={(e) => { const v = fmtDur(e.target.duration); setD(v); onDuration?.(v); }} />
        : <img src={url} alt="" />)
        : <div className="bwr-thumb-fb"><FileText size={26} /></div>}
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
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [chatWith, setChatWith] = useState(null);
  const [durations, setDurations] = useState({});
  const [menuId, setMenuId] = useState(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const busy = useRef(false);

  const load = async () => {
    try {
      const [camps, dir] = await Promise.all([
        axios.get(`${API}/campaigns?t=${Date.now()}`),
        axios.get(`${API}/business/creator-directory`).catch(() => ({ data: [] })),
      ]);
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
      // Demo fallback: only when this brand has no real submissions yet.
      setItems(list.length ? list : DEMO_WORK_REVIEW);
    } catch (e) {
      setItems(DEMO_WORK_REVIEW);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);
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

  const approve = async (id) => {
    if (busy.current) return; busy.current = true;
    try { await axios.post(`${API}/work/${id}/approve`); toast.success('Approved — payment released to the creator'); await load(); }
    catch { toast.error('Failed to approve'); }
    finally { busy.current = false; }
  };
  const requestRevision = async (id) => {
    const fb = window.prompt('What changes would you like? (revision feedback)');
    if (fb === null) return;
    try { await axios.post(`${API}/work/${id}/request-revision?feedback=${encodeURIComponent(fb)}`); toast.success('Revision requested'); await load(); }
    catch { toast.error('Failed to request revision'); }
  };
  const download = async (id, title) => {
    try {
      const res = await axios.get(`${API}/work/${id}/download`, { responseType: 'blob' });
      const u = window.URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = u; a.download = `${title || 'deliverable'}.mp4`;
      document.body.appendChild(a); a.click(); a.remove(); window.URL.revokeObjectURL(u);
    } catch { toast.error('Download unlocks after approval'); }
  };
  const openFile = (it) => { const f = it.files.find((x) => isVideo(x)) || it.files[0]; if (f) window.open(assetUrl(f), '_blank'); };
  const message = (it) => setChatWith({ id: it.creatorId, name: String(it.creator).replace('@', ''), photo: it.photo });

  return (
    <BrandTopNavLayout>
      <div className="cmk-page-head" style={{ marginBottom: 6 }}>
        <h1>Work Review</h1>
        <p>Review submitted content and provide feedback.</p>
      </div>

      <div className="bwr-tabs-row">
        <div className="bwr-tabs">
          {TABS.map((t) => (
            <button key={t.key} type="button" className={`bwr-chip ${tab === t.key ? 'is-active' : ''}`} onClick={() => setTab(t.key)}>
              <t.icon size={16} /> {t.label} ({counts[t.key] || 0})
            </button>
          ))}
        </div>
        <button type="button" className="bwr-filter"><SlidersHorizontal size={16} /> Filters</button>
      </div>

      {loading ? (
        <div className="cmk-empty">Loading…</div>
      ) : total === 0 ? (
        <div className="cmk-empty">Nothing in “{TABS.find((t) => t.key === tab).label}”.</div>
      ) : (
        <>
          <div className="bwr-list">
            {pageRows.map((it) => {
              const st = STATUS[it.status] || STATUS.pending_review;
              const duration = durations[it.id] || '';
              const ftype = fileExt(it.files[0]) || '—';
              return (
                <article key={it.id} className="bwr-card">
                  <Thumb file={it.files[0]} onOpen={() => openFile(it)} onDuration={(v) => setDurations((p) => (p[it.id] === v ? p : { ...p, [it.id]: v }))} />

                  <div className="bwr-body">
                    <h3 className="bwr-title">{it.title}</h3>
                    <div className="bwr-by">
                      <span className="bwr-by-ava">{it.photo ? <img src={assetUrl(it.photo)} alt="" /> : '@'}</span>
                      by <b>{handleLabelSafe(it.creator)}</b>
                      <i className="bwr-by-dot" />
                      <Calendar size={14} /> Submitted on {fmtDate(it.submittedAt)}
                    </div>

                    <div className="bwr-cbox">
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
                              {it.status !== 'approved' && <button type="button" onClick={() => { setMenuId(null); requestRevision(it.id); }}><RefreshCw size={15} /> Request revision</button>}
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
                        <button type="button" className="bwr-btn" onClick={() => requestRevision(it.id)}><RefreshCw size={16} /> Request Revision</button>
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
    </BrandTopNavLayout>
  );
}

function handleLabelSafe(c) {
  const s = String(c || 'Creator');
  return s.startsWith('@') ? s : `@${s}`;
}
