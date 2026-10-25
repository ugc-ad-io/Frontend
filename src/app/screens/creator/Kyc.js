import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ShieldCheck, Upload, FileCheck2, Hourglass, XCircle, CheckCircle2, ArrowLeft, ArrowRight, WifiOff, RefreshCw } from 'lucide-react';
import AppShell from '../../shell/AppShell';
import { useLiveEffect } from '../../../lib/liveUpdates';
import { apiErrorMessage } from '../../../utils/apiError';
import './onboarding.css';

const API = `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api`;

const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const UPI_RE = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;

const lookupPincode = async (pin) => {
  try {
    const response = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    const data = await response.json();
    const office = data?.[0]?.PostOffice?.[0];
    if (!office) return null;
    return { city: office.District || '', state: office.State || '' };
  } catch {
    return null;
  }
};

// Whole years from a YYYY-MM-DD date to today (18+ gate).
const ageFrom = (dob) => {
  if (!dob) return 0;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return 0;
  const t = new Date();
  let a = t.getFullYear() - d.getFullYear();
  if (t.getMonth() < d.getMonth() || (t.getMonth() === d.getMonth() && t.getDate() < d.getDate())) a -= 1;
  return a;
};
const maxDob = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 18); return d.toISOString().slice(0, 10); })();

// Same Verhoeff check the backend runs, so a typo is caught before the upload round-trip.
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
    <div className="ap-ob-doc">
      <span className="ap-ob-lbl">{label}</span>
      <button type="button" className={`ap-ob-drop ap-ob-drop--doc${value ? ' has' : ''}`} onClick={() => ref.current?.click()} disabled={busy}>
        {value ? <><FileCheck2 size={18} /> Uploaded - tap to replace</> : <><Upload size={18} /> {busy ? 'Uploading…' : 'Upload image or PDF'}</>}
      </button>
      <input ref={ref} type="file" accept="image/*,application/pdf" hidden onChange={pick} />
      <span className="ap-ob-hint">{hint}</span>
    </div>
  );
}

const STEPS = ['Personal details', 'PAN & Aadhaar', 'Address', 'Get paid'];
const EMPTY = {
  full_legal_name: '', date_of_birth: '', gender: '',
  pan_number: '', aadhaar_number: '',
  address_line: '', city: '', state: '', pincode: '',
  payout_method: 'upi', upi_id: '',
  account_holder_name: '', bank_name: '', account_number: '', ifsc_code: '',
  pan_doc_url: '', aadhaar_front_url: '', aadhaar_back_url: '',
};

export default function CreatorKyc() {
  const navigate = useNavigate();
  const [kyc, setKyc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pinLookup, setPinLookup] = useState('');
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const topRef = useRef(null);
  const loadedRef = useRef(false);

  const loadKyc = () => {
    axios.get(`${API}/kyc/me`)
      .then((r) => { setKyc(r.data); setLoadError(''); loadedRef.current = true; })
      // A failed load must not look like "not submitted": that would show an empty form over a real submission.
      .catch((e) => { if (!loadedRef.current) setLoadError(e?.response ? 'Could not load your verification status.' : "You're offline. Check your connection and try again."); })
      .finally(() => setLoading(false));
  };
  useLiveEffect(loadKyc, []);

  useEffect(() => {
    const pin = form.pincode;
    if (!/^\d{6}$/.test(pin)) { setPinLookup(''); return undefined; }
    let active = true;
    setPinLookup('loading');
    lookupPincode(pin).then((location) => {
      if (!active) return;
      if (!location) { setPinLookup('not-found'); return; }
      setForm((cur) => ({ ...cur, city: location.city, state: location.state }));
      setPinLookup('found');
    });
    return () => { active = false; };
  }, [form.pincode]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));
  const toTop = () => setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);

  // Same checks and messages as the website, split across the steps. Returns true when the step is fine.
  const checkStep = (i) => {
    const pan = form.pan_number.toUpperCase().trim();
    const aadhaar = form.aadhaar_number.replace(/\D/g, '');
    const fail = (m) => { toast.error(m); return false; };
    if (i === 0) {
      if (!form.full_legal_name.trim()) return fail('Enter your full legal name.');
      if (!form.date_of_birth) return fail('Enter your date of birth.');
      if (ageFrom(form.date_of_birth) < 18) return fail('You must be at least 18 to receive payouts.');
      if (!form.gender) return fail('Select your gender.');
    }
    if (i === 1) {
      if (!PAN_RE.test(pan)) return fail('That PAN does not look right - 10 characters, like ABCDE1234F.');
      if (aadhaar && !aadhaarValid(aadhaar)) return fail('That Aadhaar number is not valid. Check the 12 digits.');
      if (!form.pan_doc_url) return fail('Upload a photo of your PAN card.');
    }
    if (i === 2) {
      if (!form.address_line.trim() || !form.city.trim() || !form.state.trim()) return fail('Enter your full residential address.');
      if (!/^\d{6}$/.test(form.pincode)) return fail('Enter a valid 6-digit pincode.');
    }
    if (i === 3) {
      if (form.payout_method === 'upi') {
        if (!UPI_RE.test(form.upi_id.trim())) return fail('Enter a valid UPI ID (e.g. name@bank).');
      } else {
        if (!form.account_holder_name.trim()) return fail("Enter the account holder's name.");
        if (!/^\d{9,18}$/.test(form.account_number.trim())) return fail('Enter a valid bank account number.');
        if (!IFSC_RE.test(form.ifsc_code.toUpperCase().trim())) return fail('Enter a valid IFSC code (e.g. HDFC0001234).');
      }
    }
    return true;
  };
  const next = () => { if (checkStep(step)) { setStep(step + 1); toTop(); } };
  const back = () => { setStep(step - 1); toTop(); };

  const submit = async () => {
    if (saving) return;
    for (let i = 0; i < STEPS.length; i += 1) {
      if (!checkStep(i)) { setStep(i); return; }
    }
    const pan = form.pan_number.toUpperCase().trim();
    const aadhaar = form.aadhaar_number.replace(/\D/g, '');
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
      ...(form.payout_method === 'upi'
        ? { upi_id: form.upi_id.trim() }
        : { bank_details: { account_holder_name: form.account_holder_name.trim(), bank_name: form.bank_name.trim(), account_number: form.account_number.trim(), ifsc_code: form.ifsc_code.toUpperCase().trim() } }),
    };
    setSaving(true);
    try {
      const r = await axios.post(`${API}/kyc/submit`, payload);
      setKyc(r.data);
      toast.success('KYC submitted - our team will verify it shortly.');
      toTop();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not submit your KYC'));
    } finally { setSaving(false); }
  };

  const status = kyc?.status || 'not_submitted';
  const canEdit = status === 'not_submitted' || status === 'rejected';
  const stage = status === 'verified' ? 2 : status === 'pending' ? 1 : 0;
  const offline = loadError.startsWith("You're offline");

  return (
    <AppShell title="Get paid" subtitle="Verify once, then withdraw" back tabs={false}>
      <div ref={topRef} />
      {loading ? (
        <div className="ap-prof-skel" aria-busy="true" aria-label="Loading verification">
          <div className="ap-skel" style={{ height: 24, borderRadius: 12 }} />
          <div className="ap-skel" style={{ height: 300, borderRadius: 20 }} />
        </div>
      ) : loadError ? (
        <div className="ap-card ap-empty" role="alert">
          {offline ? <WifiOff size={30} color="#6e6e96" /> : <XCircle size={30} color="#e5484d" />}
          <h3>{offline ? "You're offline" : 'Could not load your status'}</h3>
          <p>{loadError}</p>
          <button type="button" className="ap-btn" onClick={() => { setLoading(true); setLoadError(''); loadKyc(); }}><RefreshCw size={16} /> Retry</button>
        </div>
      ) : (
        <>
          {status === 'verified' && (
            <div className="ap-ob-state ok">
              <CheckCircle2 size={20} />
              <div><b>Verified</b><p>Your identity is confirmed. You can withdraw your earnings.</p>
                <button type="button" className="ap-btn ap-btn--sm" onClick={() => navigate('/withdrawal')}>Go to payouts</button></div>
            </div>
          )}
          {status === 'pending' && (
            <div className="ap-ob-state wait">
              <Hourglass size={20} />
              <div><b>Under review</b><p>We’re checking your documents. This usually takes 24-48 hours, and we’ll notify you once it’s done.</p></div>
            </div>
          )}
          {status === 'rejected' && (
            <div className="ap-ob-state bad" role="alert">
              <XCircle size={20} />
              <div><b>Not approved</b><p>{kyc.rejection_reason || 'Your documents could not be verified.'} Fix the issue and submit again below.</p></div>
            </div>
          )}

          {canEdit ? (
            <>
              <div>
                <div className="ap-ob-top"><span>Step {step + 1} of {STEPS.length} · {STEPS[step]}</span><span>about 3 min</span></div>
                <div className="ap-ob-seg" style={{ gridTemplateColumns: `repeat(${STEPS.length},1fr)` }} role="progressbar" aria-valuemin={1} aria-valuemax={STEPS.length} aria-valuenow={step + 1}>
                  {STEPS.map((n, i) => <i key={n} className={i <= step ? 'on' : ''} />)}
                </div>
              </div>

              {step === 0 && (
                <div className="ap-card ap-ob-card">
                  <h2>Personal details</h2>
                  <p className="ap-ob-sub">Exactly as printed on your PAN card.</p>
                  <div className="ap-ob-f"><label htmlFor="k-name">Full legal name</label>
                    <input id="k-name" className="ap-ob-in" autoComplete="name" value={form.full_legal_name} onChange={(e) => set('full_legal_name')(e.target.value)} placeholder="As printed on your PAN" /></div>
                  <div className="ap-ob-f"><label htmlFor="k-dob">Date of birth</label>
                    <input id="k-dob" className="ap-ob-in" type="date" max={maxDob} value={form.date_of_birth} onChange={(e) => set('date_of_birth')(e.target.value)} /></div>
                  <div className="ap-ob-f"><label htmlFor="k-gender">Gender</label>
                    <select id="k-gender" className="ap-ob-in" value={form.gender} onChange={(e) => set('gender')(e.target.value)}>
                      <option value="">Select…</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer_not_to_say">Prefer not to say</option>
                    </select></div>
                </div>
              )}

              {step === 1 && (
                <>
                  <div className="ap-card ap-ob-card">
                    <h2>PAN card</h2>
                    <p className="ap-ob-sub">Needed to pay you and for tax. Brands never see it.</p>
                    <div className="ap-ob-f"><label htmlFor="k-pan">PAN number</label>
                      <input id="k-pan" className="ap-ob-in mono" autoCapitalize="characters" autoComplete="off" value={form.pan_number} maxLength={10} onChange={(e) => set('pan_number')(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="ABCDE1234F" /></div>
                    <DocUpload label="PAN card photo" hint="A clear photo or scan. All four corners visible, no glare." value={form.pan_doc_url} onChange={set('pan_doc_url')} />
                  </div>
                  <div className="ap-card ap-ob-card">
                    <h2>Aadhaar card <span style={{ fontWeight: 500, color: '#9a9ac0' }}>(optional)</span></h2>
                    <div className="ap-ob-f"><label htmlFor="k-aad">Aadhaar number</label>
                      <input id="k-aad" className="ap-ob-in mono" inputMode="numeric" autoComplete="off" value={groupAadhaar(form.aadhaar_number)} onChange={(e) => set('aadhaar_number')(e.target.value.replace(/\D/g, '').slice(0, 12))} placeholder="1234 5678 9012" /></div>
                    <DocUpload label="Aadhaar - front" hint="The side with your photo." value={form.aadhaar_front_url} onChange={set('aadhaar_front_url')} />
                    <DocUpload label="Aadhaar - back" hint="The side with your address." value={form.aadhaar_back_url} onChange={set('aadhaar_back_url')} />
                  </div>
                </>
              )}

              {step === 2 && (
                <div className="ap-card ap-ob-card">
                  <h2>Residential address</h2>
                  <div className="ap-ob-f"><label htmlFor="k-addr">Address</label>
                    <input id="k-addr" className="ap-ob-in" autoComplete="street-address" value={form.address_line} onChange={(e) => set('address_line')(e.target.value)} placeholder="House / flat, street, area" /></div>
                  <div className="ap-ob-f"><label htmlFor="k-pin">Pincode</label>
                    <input id="k-pin" className="ap-ob-in mono" inputMode="numeric" autoComplete="postal-code" maxLength={6} value={form.pincode} onChange={(e) => set('pincode')(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6 digits" />
                    {pinLookup === 'loading' && <span className="ap-ob-hint">Finding city and state…</span>}
                    {pinLookup === 'found' && <span className="ap-ob-hint">City and state filled automatically.</span>}
                    {pinLookup === 'not-found' && <span className="ap-ob-hint">Pincode not found. Enter city and state manually.</span>}
                  </div>
                  <div className="ap-ob-row2">
                    <div className="ap-ob-f"><label htmlFor="k-city">City</label><input id="k-city" className="ap-ob-in" value={form.city} onChange={(e) => set('city')(e.target.value)} /></div>
                    <div className="ap-ob-f"><label htmlFor="k-state">State</label><input id="k-state" className="ap-ob-in" value={form.state} onChange={(e) => set('state')(e.target.value)} /></div>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="ap-card ap-ob-card">
                  <h2>Where should we pay you?</h2>
                  <p className="ap-ob-sub">Where we send your earnings after a deal completes. Choose one, in your own name.</p>
                  <div className="ap-ob-toggle" role="group" aria-label="Payout method">
                    <button type="button" className={form.payout_method === 'upi' ? 'on' : ''} aria-pressed={form.payout_method === 'upi'} onClick={() => set('payout_method')('upi')}>UPI ID</button>
                    <button type="button" className={form.payout_method === 'bank' ? 'on' : ''} aria-pressed={form.payout_method === 'bank'} onClick={() => set('payout_method')('bank')}>Bank account</button>
                  </div>
                  {form.payout_method === 'upi' ? (
                    <div className="ap-ob-f"><label htmlFor="k-upi">UPI ID</label>
                      <input id="k-upi" className="ap-ob-in mono" autoCapitalize="none" autoCorrect="off" value={form.upi_id} onChange={(e) => set('upi_id')(e.target.value.trim())} placeholder="name@bank" /></div>
                  ) : (
                    <>
                      <div className="ap-ob-f"><label htmlFor="k-ah">Account holder name</label><input id="k-ah" className="ap-ob-in" value={form.account_holder_name} onChange={(e) => set('account_holder_name')(e.target.value)} /></div>
                      <div className="ap-ob-f"><label htmlFor="k-bank">Bank name</label><input id="k-bank" className="ap-ob-in" value={form.bank_name} onChange={(e) => set('bank_name')(e.target.value)} /></div>
                      <div className="ap-ob-f"><label htmlFor="k-acct">Account number</label><input id="k-acct" className="ap-ob-in mono" inputMode="numeric" autoComplete="off" value={form.account_number} onChange={(e) => set('account_number')(e.target.value.replace(/\D/g, '').slice(0, 18))} /></div>
                      <div className="ap-ob-f"><label htmlFor="k-ifsc">IFSC code</label><input id="k-ifsc" className="ap-ob-in mono" autoCapitalize="characters" maxLength={11} value={form.ifsc_code} onChange={(e) => set('ifsc_code')(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="HDFC0001234" /></div>
                    </>
                  )}
                  <p className="ap-ob-fine">By submitting you confirm these documents are yours. A PAN can only be linked to one account. Your ID and payout details are visible only to you and our review team - never to brands.</p>
                </div>
              )}

              <div className="ap-ob-foot">
                {step > 0 && <button type="button" className="ap-btn ap-btn--ghost" onClick={back} disabled={saving}><ArrowLeft size={16} /> Back</button>}
                {step < STEPS.length - 1 ? (
                  <button type="button" className="ap-btn ap-ob-next" onClick={next}>Next <ArrowRight size={16} /></button>
                ) : (
                  <button type="button" className="ap-btn ap-ob-next" onClick={submit} disabled={saving}>{saving ? 'Submitting…' : 'Submit for verification'}</button>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="ap-card">
                <h2 className="ap-card-h">On file</h2>
                <div className="ap-ob-kv"><span>Legal name</span><strong>{kyc.full_legal_name || kyc.name_on_pan || '-'}</strong></div>
                <div className="ap-ob-kv"><span>PAN</span><strong className="mono">{kyc.pan_number || '-'}</strong></div>
                {kyc.aadhaar_number ? <div className="ap-ob-kv"><span>Aadhaar</span><strong>{/* masked on screen: only the last 4 digits */}XXXX XXXX {String(kyc.aadhaar_number).replace(/\D/g, '').slice(-4)}</strong></div> : null}
                <div className="ap-ob-kv"><span>Payout</span><strong>{kyc.payout_method === 'bank' ? 'Bank account' : kyc.payout_method === 'upi' ? 'UPI' : '-'}</strong></div>
                <div className="ap-ob-kv"><span>Submitted</span><strong>{kyc.submitted_at ? new Date(kyc.submitted_at).toLocaleDateString('en-IN') : '-'}</strong></div>
              </div>

              <div className="ap-card">
                <h2 className="ap-card-h">What happens next</h2>
                <div className="ap-ob-prog">
                  <div className="ap-ob-seg" aria-hidden="true">{['Submit', 'In review', 'Verified'].map((n, i) => <i key={n} className={i <= stage ? 'on' : ''} />)}</div>
                  <div className="ap-ob-prog-l">{['Submit', 'In review', 'Verified'].map((n, i) => <span key={n} className={i === stage ? 'now' : ''}>{n}</span>)}</div>
                </div>
                <div className="ap-ob-ticks" style={{ marginTop: 12 }}>
                  <div><i><FileCheck2 size={12} /></i>We check your documents within 24-48 hours</div>
                  <div><i><FileCheck2 size={12} /></i>We notify you once it’s done</div>
                  <div><i><FileCheck2 size={12} /></i>Then you can withdraw your earnings</div>
                </div>
              </div>
              <div className="ap-ob-state wait"><ShieldCheck size={18} /><div><p style={{ margin: 0 }}>Your Aadhaar and PAN are visible only to you and our review team - never to brands.</p></div></div>
            </>
          )}
        </>
      )}
    </AppShell>
  );
}
