import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { ShieldCheck, Upload, FileCheck2, Hourglass, XCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

// Same Verhoeff check the backend runs, so a typo is caught before the upload
// round-trip instead of coming back as a 400.
const D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5], [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7], [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3], [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];
const P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4], [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7], [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];
const aadhaarValid = (n) => {
  if (!/^[2-9][0-9]{11}$/.test(n)) return false;
  let c = 0;
  n.split('').reverse().forEach((d, i) => { c = D[c][P[i % 8][Number(d)]]; });
  return c === 0;
};

const groupAadhaar = (v) => v.replace(/\D/g, '').slice(0, 12).replace(/(\d{4})(?=\d)/g, '$1 ').trim();

function DocUpload({ label, hint, value, onChange }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('File too large. Maximum 5MB.'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await axios.post(`${API}/upload/file`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      onChange(r.data.file_url);
      toast.success(`${label} uploaded`);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Upload failed'));
    } finally { setBusy(false); }
  };

  return (
    <div className="kyc-doc">
      <label className="kyc-label">{label}</label>
      <button type="button" className={`kyc-drop ${value ? 'has' : ''}`} onClick={() => ref.current?.click()} disabled={busy}>
        {value ? <><FileCheck2 size={18} /> Uploaded — click to replace</> : <><Upload size={18} /> {busy ? 'Uploading…' : 'Upload image or PDF'}</>}
      </button>
      <input ref={ref} type="file" accept="image/*,application/pdf" hidden onChange={pick} />
      <small className="kyc-hint">{hint}</small>
    </div>
  );
}

export default function CreatorKYC() {
  const navigate = useNavigate();
  const [kyc, setKyc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name_on_pan: '', pan_number: '', aadhaar_number: '',
    pan_doc_url: '', aadhaar_front_url: '', aadhaar_back_url: '',
  });

  useEffect(() => {
    axios.get(`${API}/kyc/me`)
      .then((r) => setKyc(r.data))
      .catch(() => setKyc({ status: 'not_submitted' }))
      .finally(() => setLoading(false));
  }, []);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    const pan = form.pan_number.toUpperCase().trim();
    const aadhaar = form.aadhaar_number.replace(/\D/g, '');

    if (!form.name_on_pan.trim()) return toast.error('Enter your name exactly as printed on your PAN card.');
    if (!PAN_RE.test(pan)) return toast.error('That PAN does not look right — 10 characters, like ABCDE1234F.');
    if (!aadhaarValid(aadhaar)) return toast.error('That Aadhaar number is not valid. Check the 12 digits.');
    if (!form.pan_doc_url) return toast.error('Upload a photo of your PAN card.');
    if (!form.aadhaar_front_url || !form.aadhaar_back_url) return toast.error('Upload both sides of your Aadhaar card.');

    setSaving(true);
    try {
      const r = await axios.post(`${API}/kyc/submit`, { ...form, pan_number: pan, aadhaar_number: aadhaar });
      setKyc(r.data);
      toast.success('KYC submitted — our team will verify it shortly.');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not submit your KYC'));
    } finally { setSaving(false); }
  };

  const status = kyc?.status || 'not_submitted';
  const canEdit = status === 'not_submitted' || status === 'rejected';

  return (
    <CreatorTopNavLayout>
      <div className="kyc-page">
        <button type="button" className="kyc-back" onClick={() => navigate(-1)}><ArrowLeft size={16} /> Back</button>

        <header className="kyc-head">
          <span className="kyc-head-ic"><ShieldCheck size={22} /></span>
          <div>
            <h1>Identity verification (KYC)</h1>
            <p>We pay real money to a real person, so we verify who that is. Your Aadhaar and PAN are visible only to you and our review team — never to brands.</p>
          </div>
        </header>

        {loading ? (
          <div className="kyc-card">Loading…</div>
        ) : (
          <>
            {status === 'verified' && (
              <div className="kyc-state ok">
                <CheckCircle2 size={20} />
                <div>
                  <strong>Verified</strong>
                  <p>Your identity is confirmed. You can withdraw your earnings.</p>
                </div>
                <button type="button" onClick={() => navigate('/withdrawal')}>Go to payouts</button>
              </div>
            )}

            {status === 'pending' && (
              <div className="kyc-state wait">
                <Hourglass size={20} />
                <div>
                  <strong>Under review</strong>
                  <p>We’re checking your documents. This usually takes 24–48 hours, and we’ll notify you once it’s done.</p>
                </div>
              </div>
            )}

            {status === 'rejected' && (
              <div className="kyc-state bad">
                <XCircle size={20} />
                <div>
                  <strong>Not approved</strong>
                  <p>{kyc.rejection_reason || 'Your documents could not be verified.'} Fix the issue and submit again below.</p>
                </div>
              </div>
            )}

            {canEdit ? (
              <form className="kyc-card" onSubmit={submit}>
                <h2>PAN card</h2>
                <div className="kyc-grid">
                  <div>
                    <label className="kyc-label">Name as printed on PAN</label>
                    <input
                      className="kyc-input"
                      value={form.name_on_pan}
                      onChange={(e) => set('name_on_pan')(e.target.value)}
                      placeholder="e.g. Meet Rathod"
                    />
                  </div>
                  <div>
                    <label className="kyc-label">PAN number</label>
                    <input
                      className="kyc-input mono"
                      value={form.pan_number}
                      maxLength={10}
                      onChange={(e) => set('pan_number')(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                      placeholder="ABCDE1234F"
                    />
                  </div>
                </div>
                <DocUpload
                  label="PAN card photo"
                  hint="A clear photo or scan. All four corners visible, no glare."
                  value={form.pan_doc_url}
                  onChange={set('pan_doc_url')}
                />

                <div className="kyc-sep" />

                <h2>Aadhaar card</h2>
                <div className="kyc-grid">
                  <div>
                    <label className="kyc-label">Aadhaar number</label>
                    <input
                      className="kyc-input mono"
                      inputMode="numeric"
                      value={groupAadhaar(form.aadhaar_number)}
                      onChange={(e) => set('aadhaar_number')(e.target.value.replace(/\D/g, '').slice(0, 12))}
                      placeholder="1234 5678 9012"
                    />
                  </div>
                </div>
                <div className="kyc-grid">
                  <DocUpload
                    label="Aadhaar — front"
                    hint="The side with your photo."
                    value={form.aadhaar_front_url}
                    onChange={set('aadhaar_front_url')}
                  />
                  <DocUpload
                    label="Aadhaar — back"
                    hint="The side with your address."
                    value={form.aadhaar_back_url}
                    onChange={set('aadhaar_back_url')}
                  />
                </div>

                <button type="submit" className="kyc-submit" disabled={saving}>
                  {saving ? 'Submitting…' : 'Submit for verification'}
                </button>
                <p className="kyc-foot">By submitting you confirm these documents are yours. A PAN can only be linked to one account.</p>
              </form>
            ) : (
              <div className="kyc-card kyc-onfile">
                <h2>On file</h2>
                <div className="kyc-kv"><span>Name on PAN</span><strong>{kyc.name_on_pan || '—'}</strong></div>
                <div className="kyc-kv"><span>PAN</span><strong className="mono">{kyc.pan_number || '—'}</strong></div>
                <div className="kyc-kv"><span>Aadhaar</span><strong className="mono">{kyc.aadhaar_number || '—'}</strong></div>
                <div className="kyc-kv"><span>Submitted</span><strong>{kyc.submitted_at ? new Date(kyc.submitted_at).toLocaleDateString() : '—'}</strong></div>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .kyc-page{max-width:760px;margin:0 auto;padding:8px 0 60px}
        .kyc-back{display:inline-flex;align-items:center;gap:6px;border:1px solid #e6e8f5;background:#fff;color:#5b6073;font:inherit;font-size:13px;font-weight:600;padding:7px 13px;border-radius:9px;cursor:pointer;margin-bottom:18px}
        .kyc-back:hover{border-color:#c9cffb;color:#4452f0}
        .kyc-head{display:flex;gap:14px;align-items:flex-start;margin-bottom:20px}
        .kyc-head-ic{display:grid;place-items:center;width:44px;height:44px;flex:none;border-radius:12px;background:#eef0ff;color:#4452f0}
        .kyc-head h1{margin:0 0 4px;font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:24px;color:#15163a}
        .kyc-head p{margin:0;color:#6a6f8a;font-size:13.5px;line-height:1.6;max-width:620px}

        .kyc-state{display:flex;align-items:center;gap:14px;padding:16px 18px;border-radius:14px;margin-bottom:18px}
        .kyc-state strong{display:block;font-size:14.5px;margin-bottom:2px}
        .kyc-state p{margin:0;font-size:13px;line-height:1.55}
        .kyc-state button{margin-left:auto;border:0;border-radius:9px;padding:8px 14px;background:#0f8a4d;color:#fff;font:inherit;font-weight:700;font-size:13px;cursor:pointer;white-space:nowrap}
        .kyc-state.ok{background:#ecfdf3;border:1px solid #abefc6;color:#05603a}
        .kyc-state.wait{background:#fff8ed;border:1px solid #fcd9a4;color:#93370d}
        .kyc-state.bad{background:#fef3f2;border:1px solid #fecdca;color:#b42318}

        .kyc-card{background:#fff;border:1px solid #e9ebf5;border-radius:18px;padding:24px 26px;box-shadow:0 4px 24px rgba(7,7,78,.05)}
        .kyc-card h2{margin:0 0 14px;font-size:15px;color:#15163a}
        .kyc-sep{height:1px;background:#eef0f6;margin:26px 0 22px}
        .kyc-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:18px}
        @media (max-width:620px){.kyc-grid{grid-template-columns:1fr}}
        .kyc-label{display:block;margin-bottom:6px;font-size:12px;font-weight:700;color:#6a6f8a;text-transform:uppercase;letter-spacing:.04em}
        .kyc-input{width:100%;border:1px solid #dfe2ee;border-radius:10px;padding:11px 13px;font:inherit;font-size:14px;color:#15163a;background:#fff}
        .kyc-input:focus{outline:none;border-color:#5b6bff;box-shadow:0 0 0 3px rgba(91,107,255,.15)}
        .kyc-input.mono,.mono{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.06em}

        .kyc-doc{min-width:0}
        .kyc-drop{width:100%;display:flex;align-items:center;justify-content:center;gap:8px;border:1.5px dashed #cdd2f3;border-radius:12px;padding:16px;background:#f8f9ff;color:#4452f0;font:inherit;font-size:13.5px;font-weight:600;cursor:pointer}
        .kyc-drop:hover{border-color:#5b6bff;background:#eef0ff}
        .kyc-drop.has{border-style:solid;border-color:#abefc6;background:#ecfdf3;color:#05603a}
        .kyc-hint{display:block;margin-top:6px;color:#9296b5;font-size:11.5px}

        .kyc-submit{width:100%;margin-top:24px;border:0;border-radius:12px;padding:13px;background:#5b6bff;color:#fff;font:inherit;font-weight:700;font-size:14.5px;cursor:pointer}
        .kyc-submit:hover{background:#4452f0}
        .kyc-submit:disabled{opacity:.6;cursor:not-allowed}
        .kyc-foot{margin:12px 0 0;text-align:center;color:#9296b5;font-size:11.5px}

        .kyc-onfile .kyc-kv{display:flex;justify-content:space-between;gap:16px;padding:11px 0;border-bottom:1px solid #f1f3f9;font-size:14px}
        .kyc-onfile .kyc-kv:last-child{border-bottom:0}
        .kyc-onfile .kyc-kv span{color:#6a6f8a}
        .kyc-onfile .kyc-kv strong{color:#15163a}
      `}</style>
    </CreatorTopNavLayout>
  );
}
