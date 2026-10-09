import { useState, useEffect } from 'react';
import axios from 'axios';
import { uploadMedia } from '../utils/upload';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { Clapperboard, Upload, CheckCircle, Play } from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const assetUrl = (u) => (!u ? '' : (/^https?:\/\//i.test(u) ? u : `${BACKEND_URL}${String(u).startsWith('/') ? '' : '/'}${u}`));
const fmtDate = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

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
  useEffect(() => { load(); }, []);

  const complete = async (workId) => {
    if (!file) { toast.error('Choose the edited video file first.'); return; }
    setWorking(true);
    try {
      const up = { data: await uploadMedia(file, API) };
      const url = up.data?.file_url || up.data?.url;
      if (!url) throw new Error('Upload did not return a file URL');
      await axios.post(`${API}/admin/editing-queue/${workId}/complete`, {
        edited_file_url: url, note: note.trim() || undefined,
      });
      toast.success('Edited cut attached — the brand can now review.');
      setActiveId(null); setFile(null); setNote('');
      load();
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not attach the edited file'));
    } finally {
      setWorking(false);
    }
  };

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
                Brand: {r.brand_name || '—'} · Creator: {r.creator_name} · Raw received {fmtDate(r.submitted_at)}
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
                placeholder="Editor's note (optional — visible in the audit log)"
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
