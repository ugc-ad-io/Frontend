import { useLiveEffect } from '../lib/liveUpdates';
import { useState } from 'react';
import axios from 'axios';
import { uploadMedia } from '../utils/upload';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { Clapperboard, Upload, CheckCircle, Play, X, User, Clock } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import useIsPhone from '../lib/useIsPhone';
import '../styles/admin-mobile-ops.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const assetUrl = (u) => (!u ? '' : (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}${String(u).startsWith('/') ? '' : '/'}${u}`));
const fmtDate = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-');

/**
 * Editing Queue — deliverables the brand marked "Edited by UGC.ad".
 * The creator's raw footage parks here (work status: awaiting_edit); attaching
 * the edited cut is what hands the submission to the brand for review and
 * starts the auto-approval clock.
 */
export default function AdminEditing() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState(null);   // work_id with the upload form open
  const [file, setFile] = useState(null);
  const [note, setNote] = useState('');
  const [working, setWorking] = useState(false);
  const [uploadError, setUploadError] = useState(''); // phone: last attach failure, shown in the sheet
  const isPhone = useIsPhone();

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/editing-queue`);
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not load the editing queue'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  };
  useLiveEffect(() => { load(); }, []);

  const complete = async (workId) => {
    if (!file) { toast.error('Choose the edited video file first.'); return; }
    setWorking(true);
    setUploadError('');
    try {
      const up = { data: await uploadMedia(file, API) };
      const url = up.data?.file_url || up.data?.url;
      if (!url) throw new Error('Upload did not return a file URL');
      await axios.post(`${API}/admin/editing-queue/${workId}/complete`, {
        edited_file_url: url, note: note.trim() || undefined,
      });
      toast.success('Edited cut attached - the brand can now review.');
      setActiveId(null); setFile(null); setNote('');
      load();
    } catch (e) {
      const msg = apiErrorMessage(e, 'Could not attach the edited file');
      setUploadError(msg);
      toast.error(msg);
    } finally {
      setWorking(false);
    }
  };

  // ===================== Phone (PWA) layout =====================
  if (isPhone) {
    const active = rows.find((r) => r.work_id === activeId);
    const openSheet = (id) => { setActiveId(id); setFile(null); setNote(''); setUploadError(''); };
    const closeSheet = () => { if (!working) { setActiveId(null); setFile(null); setNote(''); setUploadError(''); } };
    return (
      <AdminLayout>
        <div className="am" data-testid="editing-phone">
          {!loading && rows.length > 0 && <p className="am-muted">{rows.length} {rows.length === 1 ? 'submission' : 'submissions'} waiting on an edit</p>}

          {loading && !rows.length ? (
            <div className="am-empty">Loading…</div>
          ) : !rows.length ? (
            <div className="am-empty">No submissions waiting on an edit. Raw footage from "Edited by UGC.ad" deals lands here.</div>
          ) : (
            <div className="am-list">
              {rows.map((r) => (
                <article key={r.work_id} className="am-card" data-testid={`edit-card-${r.work_id}`}>
                  <div className="am-card-head">
                    <span className="am-thumb amo-thumb" aria-hidden="true"><Clapperboard size={24} /></span>
                    <div className="am-card-main">
                      <span className="am-card-title">{r.campaign_title}</span>
                      <span className="am-card-sub">Brand: {r.brand_name || '-'}</span>
                      <span className="am-badges"><span className="am-badge am-badge--wait">Awaiting edit</span></span>
                    </div>
                  </div>
                  <div className="amo-meta">
                    <span><User size={15} /> Creator: {r.creator_name}</span>
                    <span><Clock size={15} /> Raw received {fmtDate(r.submitted_at)}</span>
                  </div>
                  {r.description ? <p className="amo-clamp">Creator's note: {r.description}</p> : null}
                  {(r.raw_files || []).length > 0 && (
                    <div className="amo-files">
                      {r.raw_files.map((f, i) => (
                        <a key={i} className="am-btn am-btn--secondary am-btn--sm" href={assetUrl(f)} target="_blank" rel="noopener noreferrer">
                          <Play size={16} /> Raw file {i + 1}
                        </a>
                      ))}
                    </div>
                  )}
                  <div className="am-card-foot">
                    <button type="button" className="am-btn am-btn--primary amo-fill" onClick={() => openSheet(r.work_id)} data-testid={`edit-upload-${r.work_id}`}>
                      <Upload size={18} /> Upload edited cut
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {active && (
            <>
              <div className="am-sheet-backdrop" onClick={closeSheet} />
              <section className="am-sheet" role="dialog" aria-modal="true" aria-labelledby="amo-edit-title" data-testid="edit-sheet">
                <div className="am-sheet-head">
                  <h2 id="amo-edit-title">Attach the edited cut</h2>
                  <button type="button" className="am-icon-btn" onClick={closeSheet} disabled={working} aria-label="Close"><X size={20} /></button>
                </div>
                <div className="am-sheet-body">
                  <p className="am-muted">{active.campaign_title} · {active.creator_name}. Attaching sends it to the brand for review and starts the auto-approval clock.</p>
                  <div className="am-field">
                    <label htmlFor="amo-edit-file">Edited video file</label>
                    <input id="amo-edit-file" type="file" accept="video/*" disabled={working} onChange={(e) => { setFile(e.target.files?.[0] || null); setUploadError(''); }} />
                    {file && <span className="amo-file-name">{file.name}</span>}
                  </div>
                  <div className="am-field">
                    <label htmlFor="amo-edit-note">Editor's note (optional)</label>
                    <textarea id="amo-edit-note" rows={3} value={note} disabled={working} onChange={(e) => setNote(e.target.value)} />
                    <span className="am-field-hint">Visible in the audit log.</span>
                  </div>
                  {working && <div className="amo-callout amo-callout--info" role="status">Uploading the edited cut… keep this screen open.</div>}
                  {uploadError && !working && <div className="amo-callout amo-callout--bad" role="alert">{uploadError}</div>}
                </div>
                <div className="am-sheet-foot">
                  <button type="button" className="am-btn am-btn--secondary" onClick={closeSheet} disabled={working}>Cancel</button>
                  <button type="button" className="am-btn am-btn--primary" disabled={working || !file} onClick={() => complete(active.work_id)} data-testid="edit-submit">
                    <CheckCircle size={18} /> {working ? 'Uploading…' : 'Attach & send'}
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {loading ? (
        <div className="ash-empty">Loading…</div>
      ) : rows.length === 0 ? (
        <div className="ash-empty">
          <Clapperboard size={28} />
          <p>No submissions waiting on an edit. Raw footage from "Edited by UGC.ad" deals lands here.</p>
        </div>
      ) : rows.map((r) => (
        <div key={r.work_id} style={{ background: '#fff', border: '1px solid #e3e5f0', borderRadius: 12, padding: '16px 18px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <strong style={{ fontSize: 15 }}>{r.campaign_title}</strong>
              <div style={{ fontSize: 13, color: '#6b7093', marginTop: 2 }}>
                Brand: {r.brand_name || '-'} · Creator: {r.creator_name} · Raw received {fmtDate(r.submitted_at)}
              </div>
            </div>
            <span style={{ alignSelf: 'flex-start', fontSize: 11, fontWeight: 700, letterSpacing: '.05em', background: '#fbf1da', color: '#9a6a00', padding: '4px 10px', borderRadius: 6 }}>AWAITING EDIT</span>
          </div>

          {r.description ? <p style={{ fontSize: 13.5, margin: '10px 0 0', color: '#3a3e5c' }}>Creator's note: {r.description}</p> : null}

          <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
            {(r.raw_files || []).map((f, i) => (
              <a key={i} href={assetUrl(f)} target="_blank" rel="noopener noreferrer"
                 style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#34379b', textDecoration: 'none', border: '1px solid #d9dbf0', borderRadius: 8, padding: '7px 12px' }}>
                <Play size={14} /> Raw file {i + 1}
              </a>
            ))}
          </div>

          {activeId === r.work_id ? (
            <div style={{ marginTop: 14, borderTop: '1px solid #eef0f8', paddingTop: 14 }}>
              <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              <textarea
                value={note} onChange={(e) => setNote(e.target.value)} rows={2}
                placeholder="Editor's note (optional - visible in the audit log)"
                style={{ display: 'block', width: '100%', marginTop: 10, borderRadius: 8, border: '1px solid #ddd', padding: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <button className="ash-primary" disabled={working} onClick={() => complete(r.work_id)}>
                  <CheckCircle size={15} /> {working ? 'Uploading…' : 'Attach & send to brand'}
                </button>
                <button className="ash-ghost" disabled={working} onClick={() => { setActiveId(null); setFile(null); setNote(''); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="ash-primary" style={{ marginTop: 14 }} onClick={() => { setActiveId(r.work_id); setFile(null); setNote(''); }}>
              <Upload size={15} /> Upload edited cut
            </button>
          )}
        </div>
      ))}
      <style>{`
        .ash-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 70px 24px; color: #5b6573; text-align: center; }
        .ash-primary { display: inline-flex; align-items: center; gap: 7px; background: #14163a; color: #fff; border: none; border-radius: 8px; padding: 9px 16px; font-size: 13.5px; font-weight: 600; cursor: pointer; }
        .ash-primary:disabled { opacity: .6; cursor: default; }
        .ash-ghost { display: inline-flex; align-items: center; gap: 7px; background: #fff; color: #3a3e5c; border: 1px solid #d9dbf0; border-radius: 8px; padding: 9px 16px; font-size: 13.5px; font-weight: 600; cursor: pointer; }
      `}</style>
    </AdminLayout>
  );
}
