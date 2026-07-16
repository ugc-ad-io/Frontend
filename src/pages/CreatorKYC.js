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
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UPI_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

// Whole years from a YYYY-MM-DD date to today (for the 18+ gate).
const ageFrom = (dob) => {
  if (!dob) return 0;
  const d = new Date(dob);
  if (isNaN(d)) return 0;
  const t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a -= 1;
  return a;
};
// Latest DOB that still makes someone 18 today — caps the date picker.
const maxDob = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 18); return d.toISOString().slice(0, 10); })();

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
    full_legal_name: '', date_of_birth: '', gender: '',
    pan_number: '', aadhaar_number: '',
    address_line: '', city: '', state: '', pincode: '',
    payout_method: 'upi', upi_id: '',
    account_holder_name: '', bank_name: '', account_number: '', ifsc_code: '',
    pan_doc_url: '', aadhaar_front_url: '', aadhaar_back_url: '', selfie_url: '',
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
    const upi = form.upi_id.trim();
    const ifsc = form.ifsc_code.toUpperCase().trim();
    const acct = form.account_number.trim();

    // Identity
    if (!form.full_legal_name.trim()) return toast.error('Enter your full legal name.');
    if (!form.date_of_birth) return toast.error('Enter your date of birth.');
    if (ageFrom(form.date_of_birth) < 18) return toast.error('You must be at least 18 to receive payouts.');
    if (!form.gender) return toast.error('Select your gender.');
    if (!PAN_RE.test(pan)) return toast.error('That PAN does not look right — 10 characters, like ABCDE1234F.');
    // Aadhaar is optional; validate only if entered.
    if (aadhaar && !aadhaarValid(aadhaar)) return toast.error('That Aadhaar number is not valid. Check the 12 digits.');

    // Address
    if (!form.address_line.trim() || !form.city.trim() || !form.state.trim()) return toast.error('Enter your full residential address.');
    if (!/^\d{6}$/.test(form.pincode)) return toast.error('Enter a valid 6-digit pincode.');

    // Payout — one method is enough
    if (form.payout_method === 'upi') {
      if (!UPI_RE.test(upi)) return toast.error('Enter a valid UPI ID (e.g. name@bank).');
    } else {
      if (!form.account_holder_name.trim()) return toast.error("Enter the account holder's name.");
      if (!/^\d{9,18}$/.test(acct)) return toast.error('Enter a valid bank account number.');
      if (!IFSC_RE.test(ifsc)) return toast.error('Enter a valid IFSC code (e.g. HDFC0001234).');
    }

    // Documents
    if (!form.pan_doc_url) return toast.error('Upload a photo of your PAN card.');
    if (!form.selfie_url) return toast.error('Upload a selfie holding your ID.');

    const payload = {
      full_legal_name: form.full_legal_name.trim(),
      date_of_birth: form.date_of_birth,
      gender: form.gender,
      pan_number: pan,
      aadhaar_number: aadhaar,
      address: { line: form.address_line.trim(), city: form.city.trim(), state: form.state.trim(), pincode: form.pincode },
      pan_doc_url: form.pan_doc_url,
      aadhaar_front_url: form.aadhaar_front_url,
      aadhaar_back_url: form.aadhaar_back_url,
      selfie_url: form.selfie_url,
      ...(form.payout_method === 'upi'
        ? { upi_id: upi }
        : { bank_details: { account_holder_name: form.account_holder_name.trim(), bank_name: form.bank_name.trim(), account_number: acct, ifsc_code: ifsc } }),
    };

    setSaving(true);
    try {
      const r = await axios.post(`${API}/kyc/submit`, payload);
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
                <h2>Personal details</h2>
                <div className="kyc-grid">
                  <div>
                    <label className="kyc-label">Full legal name</label>
                    <input
                      className="kyc-input"
                      value={form.full_legal_name}
                      onChange={(e) => set('full_legal_name')(e.target.value)}
                      placeholder="As printed on your PAN"
                    />
                  </div>
                  <div>
                    <label className="kyc-label">Date of birth</label>
                    <input
                      className="kyc-input"
                      type="date"
                      max={maxDob}
                      value={form.date_of_birth}
                      onChange={(e) => set('date_of_birth')(e.target.value)}
                    />
                  </div>
                </div>
                <div className="kyc-grid">
                  <div>
                    <label className="kyc-label">Gender</label>
                    <select className="kyc-input" value={form.gender} onChange={(e) => set('gender')(e.target.value)}>
                      <option value="">Select…</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer_not_to_say">Prefer not to say</option>
                    </select>
                  </div>
                </div>

                <div className="kyc-sep" />

                <h2>PAN card</h2>
                <div className="kyc-grid">
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

                <h2>Aadhaar card <span className="kyc-optional">(optional)</span></h2>
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

                <div className="kyc-sep" />

                <h2>Residential address</h2>
                <div className="kyc-grid">
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className="kyc-label">Address</label>
                    <input className="kyc-input" value={form.address_line} onChange={(e) => set('address_line')(e.target.value)} placeholder="House / flat, street, area" />
                  </div>
                </div>
                <div className="kyc-grid">
                  <div>
                    <label className="kyc-label">City</label>
                    <input className="kyc-input" value={form.city} onChange={(e) => set('city')(e.target.value)} />
                  </div>
                  <div>
                    <label className="kyc-label">State</label>
                    <input className="kyc-input" value={form.state} onChange={(e) => set('state')(e.target.value)} />
                  </div>
                </div>
                <div className="kyc-grid">
                  <div>
                    <label className="kyc-label">Pincode</label>
                    <input className="kyc-input mono" inputMode="numeric" maxLength={6} value={form.pincode}
                      onChange={(e) => set('pincode')(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6 digits" />
                  </div>
                </div>

                <div className="kyc-sep" />

                <h2>Payout details</h2>
                <p className="kyc-subnote">Where we send your earnings after a deal completes. Choose one.</p>
                <div className="kyc-toggle">
                  <button type="button" className={form.payout_method === 'upi' ? 'on' : ''} onClick={() => set('payout_method')('upi')}>UPI ID</button>
                  <button type="button" className={form.payout_method === 'bank' ? 'on' : ''} onClick={() => set('payout_method')('bank')}>Bank account</button>
                </div>
                {form.payout_method === 'upi' ? (
                  <div className="kyc-grid">
                    <div>
                      <label className="kyc-label">UPI ID</label>
                      <input className="kyc-input mono" value={form.upi_id} onChange={(e) => set('upi_id')(e.target.value.trim())} placeholder="name@bank" />
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="kyc-grid">
                      <div>
                        <label className="kyc-label">Account holder name</label>
                        <input className="kyc-input" value={form.account_holder_name} onChange={(e) => set('account_holder_name')(e.target.value)} />
                      </div>
                      <div>
                        <label className="kyc-label">Bank name</label>
                        <input className="kyc-input" value={form.bank_name} onChange={(e) => set('bank_name')(e.target.value)} />
                      </div>
                    </div>
                    <div className="kyc-grid">
                      <div>
                        <label className="kyc-label">Account number</label>
                        <input className="kyc-input mono" inputMode="numeric" value={form.account_number}
                          onChange={(e) => set('account_number')(e.target.value.replace(/\D/g, '').slice(0, 18))} />
                      </div>
                      <div>
                        <label className="kyc-label">IFSC code</label>
                        <input className="kyc-input mono" maxLength={11} value={form.ifsc_code}
                          onChange={(e) => set('ifsc_code')(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="HDFC0001234" />
                      </div>
                    </div>
                  </>
                )}

                <div className="kyc-sep" />

                <h2>Selfie with ID</h2>
                <DocUpload
                  label="Selfie holding your ID"
                  hint="A clear photo of you holding your PAN or Aadhaar next to your face."
                  value={form.selfie_url}
                  onChange={set('selfie_url')}
                />

                <button type="submit" className="kyc-submit" disabled={saving}>
                  {saving ? 'Submitting…' : 'Submit for verification'}
                </button>
                <p className="kyc-foot">By submitting you confirm these documents are yours. A PAN can only be linked to one account. Your ID and payout details are visible only to you and our review team — never to brands.</p>
              </form>
            ) : (
              <div className="kyc-card kyc-onfile">
                <h2>On file</h2>
                <div className="kyc-kv"><span>Legal name</span><strong>{kyc.full_legal_name || kyc.name_on_pan || '—'}</strong></div>
                <div className="kyc-kv"><span>PAN</span><strong className="mono">{kyc.pan_number || '—'}</strong></div>
                {kyc.aadhaar_number ? <div className="kyc-kv"><span>Aadhaar</span><strong className="mono">{kyc.aadhaar_number}</strong></div> : null}
                <div className="kyc-kv"><span>Payout</span><strong>{kyc.payout_method === 'bank' ? 'Bank account' : kyc.payout_method === 'upi' ? 'UPI' : '—'}</strong></div>
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
        select.kyc-input{appearance:none;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%236a6f8a' stroke-width='2'><path d='M6 9l6 6 6-6'/></svg>");background-repeat:no-repeat;background-position:right 12px center;padding-right:34px;cursor:pointer}
        .kyc-optional{font-size:12px;font-weight:600;color:#9296ba;text-transform:none;letter-spacing:0}
        .kyc-subnote{margin:-6px 0 12px;font-size:12.5px;color:#8a8fab;line-height:1.5}
        .kyc-toggle{display:inline-flex;gap:0;border:1px solid #dfe2ee;border-radius:10px;overflow:hidden;margin-bottom:16px}
        .kyc-toggle button{border:0;background:#fff;color:#5b6073;font:inherit;font-size:13px;font-weight:700;padding:9px 18px;cursor:pointer}
        .kyc-toggle button.on{background:#07074e;color:#fff}

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
