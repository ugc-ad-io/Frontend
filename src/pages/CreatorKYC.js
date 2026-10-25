import { useLiveEffect } from '../lib/liveUpdates';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { ShieldCheck, Upload, FileCheck2, Hourglass, XCircle, CheckCircle2, ArrowLeft } from 'lucide-react';
import CreatorTopNavLayout from '../components/CreatorTopNavLayout';
import CreatorPageHead from '../components/CreatorPageHead';
import '../styles/creator-ui-kyc.css';
import { Skeleton } from '../components/Skeleton';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

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
    <div className="cui-s-k-doc">
      <label className="cui-s-k-label">{label}</label>
      <button type="button" className={`cui-s-k-drop ${value ? 'has' : ''}`} onClick={() => ref.current?.click()} disabled={busy}>
        {value ? <><FileCheck2 size={18} /> Uploaded - click to replace</> : <><Upload size={18} /> {busy ? 'Uploading…' : 'Upload image or PDF'}</>}
      </button>
      <input ref={ref} type="file" accept="image/*,application/pdf" hidden onChange={pick} />
      <small className="cui-s-k-hint">{hint}</small>
    </div>
  );
}

export default function CreatorKYC() {
  const navigate = useNavigate();
  const [kyc, setKyc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pinLookup, setPinLookup] = useState('');
  const [form, setForm] = useState({
    full_legal_name: '', date_of_birth: '', gender: '',
    pan_number: '', aadhaar_number: '',
    address_line: '', city: '', state: '', pincode: '',
    payout_method: 'upi', upi_id: '',
    account_holder_name: '', bank_name: '', account_number: '', ifsc_code: '',
    pan_doc_url: '', aadhaar_front_url: '', aadhaar_back_url: '',
  });

  const loadKyc = () => {
    setLoadError(false);
    axios.get(`${API}/kyc/me`)
      .then((r) => setKyc(r.data))
      // A failed load must not look like "not submitted": that would show an empty form over a real submission.
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  };
  useLiveEffect(loadKyc, []);

  useEffect(() => {
    const pin = form.pincode;
    if (!/^\d{6}$/.test(pin)) {
      setPinLookup('');
      return undefined;
    }

    let active = true;
    setPinLookup('loading');
    lookupPincode(pin).then((location) => {
      if (!active) return;
      if (!location) {
        setPinLookup('not-found');
        return;
      }
      setForm((current) => ({
        ...current,
        city: location.city,
        state: location.state,
      }));
      setPinLookup('found');
    });
    return () => { active = false; };
  }, [form.pincode]);

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
    if (!PAN_RE.test(pan)) return toast.error('That PAN does not look right - 10 characters, like ABCDE1234F.');
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
        ? { upi_id: upi }
        : { bank_details: { account_holder_name: form.account_holder_name.trim(), bank_name: form.bank_name.trim(), account_number: acct, ifsc_code: ifsc } }),
    };

    setSaving(true);
    try {
      const r = await axios.post(`${API}/kyc/submit`, payload);
      setKyc(r.data);
      toast.success('KYC submitted - our team will verify it shortly.');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not submit your KYC'));
    } finally { setSaving(false); }
  };

  const status = kyc?.status || 'not_submitted';
  const canEdit = status === 'not_submitted' || status === 'rejected';

  const stage = status === 'verified' ? 2 : status === 'pending' ? 1 : 0;
  const STAGES = ['Submit', 'In review', 'Verified'];

  const field = (label, control, hint) => (
    <div className="cui-s-k-f">
      <label className="cui-s-k-label">{label}</label>
      {control}
      {hint}
    </div>
  );

  return (
    <CreatorTopNavLayout>
      <div className="cui-s-kyc">
        <button type="button" className="cui-s-k-back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/settings'))}>
          <ArrowLeft size={18} /> Back
        </button>
        <CreatorPageHead
          title="Get paid"
          subtitle="Verify your identity once, then withdraw your earnings to UPI or bank."
          hideSearch
        />

        {loading ? (
          <div className="cui-s-k-card" aria-hidden="true">
            <Skeleton width={180} height={20} style={{ marginBottom: 20 }} />
            <div className="cui-s-k-row">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Skeleton width="45%" height={12} />
                  <Skeleton width="100%" height={46} radius={16} />
                </div>
              ))}
            </div>
            <Skeleton width={150} height={20} style={{ margin: '24px 0 16px' }} />
            <div className="cui-s-k-row">
              <Skeleton width="100%" height={90} radius={14} />
              <Skeleton width="100%" height={90} radius={14} />
            </div>
          </div>
        ) : loadError ? (
          <div className="cui-s-k-state bad" role="alert">
            <XCircle size={20} />
            <div>
              <strong>Could not load your verification status</strong>
              <p>Check your connection and try again.</p>
              <button type="button" className="cui-s-k-btn" onClick={() => { setLoading(true); loadKyc(); }}>Retry</button>
            </div>
          </div>
        ) : (
          <>
            {status === 'verified' && (
              <div className="cui-s-k-state ok">
                <CheckCircle2 size={20} />
                <div>
                  <strong>Verified</strong>
                  <p>Your identity is confirmed. You can withdraw your earnings.</p>
                </div>
                <button type="button" className="cui-s-k-btn cui-s-k-btn--ink" onClick={() => navigate('/withdrawal')}>Go to payouts</button>
              </div>
            )}

            {status === 'pending' && (
              <div className="cui-s-k-state wait">
                <Hourglass size={20} />
                <div>
                  <strong>Under review</strong>
                  <p>We’re checking your documents. This usually takes 24–48 hours, and we’ll notify you once it’s done.</p>
                </div>
              </div>
            )}

            {status === 'rejected' && (
              <div className="cui-s-k-state bad">
                <XCircle size={20} />
                <div>
                  <strong>Not approved</strong>
                  <p>{kyc.rejection_reason || 'Your documents could not be verified.'} Fix the issue and submit again below.</p>
                </div>
              </div>
            )}

            <div className="cui-s-k-grid">
              <div className="cui-s-k-main">
                {canEdit ? (
                  <form id="kyc-form" className="cui-s-k-form" onSubmit={submit}>
                    <section className="cui-s-k-card">
                      <h2>Personal details</h2>
                      <p className="cui-s-k-sub">Exactly as printed on your PAN card.</p>
                      <div className="cui-s-k-row">
                        {field('Full legal name', (
                          <input
                            className="cui-s-k-in"
                            value={form.full_legal_name}
                            onChange={(e) => set('full_legal_name')(e.target.value)}
                            placeholder="As printed on your PAN"
                          />
                        ))}
                        {field('Date of birth', (
                          <input
                            className="cui-s-k-in"
                            type="date"
                            max={maxDob}
                            value={form.date_of_birth}
                            onChange={(e) => set('date_of_birth')(e.target.value)}
                          />
                        ))}
                        {field('Gender', (
                          <select className="cui-s-k-in" value={form.gender} onChange={(e) => set('gender')(e.target.value)}>
                            <option value="">Select…</option>
                            <option value="male">Male</option>
                            <option value="female">Female</option>
                            <option value="other">Other</option>
                            <option value="prefer_not_to_say">Prefer not to say</option>
                          </select>
                        ))}
                      </div>
                    </section>

                    <section className="cui-s-k-card">
                      <h2>PAN card</h2>
                      <p className="cui-s-k-sub">Needed to pay you and for tax. Brands never see it.</p>
                      <div className="cui-s-k-row">
                        {field('PAN number', (
                          <input
                            className="cui-s-k-in mono"
                            value={form.pan_number}
                            maxLength={10}
                            onChange={(e) => set('pan_number')(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                            placeholder="ABCDE1234F"
                          />
                        ))}
                        <DocUpload
                          label="PAN card photo"
                          hint="A clear photo or scan. All four corners visible, no glare."
                          value={form.pan_doc_url}
                          onChange={set('pan_doc_url')}
                        />
                      </div>
                    </section>

                    <section className="cui-s-k-card">
                      <h2>Aadhaar card <span className="cui-s-k-opt">(optional)</span></h2>
                      <div className="cui-s-k-row">
                        {field('Aadhaar number', (
                          <input
                            className="cui-s-k-in mono"
                            inputMode="numeric"
                            value={groupAadhaar(form.aadhaar_number)}
                            onChange={(e) => set('aadhaar_number')(e.target.value.replace(/\D/g, '').slice(0, 12))}
                            placeholder="1234 5678 9012"
                          />
                        ))}
                      </div>
                      <div className="cui-s-k-row">
                        <DocUpload
                          label="Aadhaar - front"
                          hint="The side with your photo."
                          value={form.aadhaar_front_url}
                          onChange={set('aadhaar_front_url')}
                        />
                        <DocUpload
                          label="Aadhaar - back"
                          hint="The side with your address."
                          value={form.aadhaar_back_url}
                          onChange={set('aadhaar_back_url')}
                        />
                      </div>
                    </section>

                    <section className="cui-s-k-card">
                      <h2>Residential address</h2>
                      <div className="cui-s-k-row">
                        <div className="cui-s-k-span">
                          {field('Address', <input className="cui-s-k-in" value={form.address_line} onChange={(e) => set('address_line')(e.target.value)} placeholder="House / flat, street, area" />)}
                        </div>
                        {field('Pincode', (
                          <input className="cui-s-k-in mono" inputMode="numeric" maxLength={6} value={form.pincode}
                            onChange={(e) => set('pincode')(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="6 digits" />
                        ), (
                          <>
                            {pinLookup === 'loading' && <small className="cui-s-k-hint">Finding city and state…</small>}
                            {pinLookup === 'found' && <small className="cui-s-k-hint">City and state filled automatically.</small>}
                            {pinLookup === 'not-found' && <small className="cui-s-k-hint">Pincode not found. Enter city and state manually.</small>}
                          </>
                        ))}
                        <span />
                        {field('City', <input className="cui-s-k-in" value={form.city} onChange={(e) => set('city')(e.target.value)} />)}
                        {field('State', <input className="cui-s-k-in" value={form.state} onChange={(e) => set('state')(e.target.value)} />)}
                      </div>
                    </section>

                    <section className="cui-s-k-card">
                      <h2>Where should we pay you?</h2>
                      <p className="cui-s-k-sub">Where we send your earnings after a deal completes. Choose one, in your own name.</p>
                      <div className="cui-s-k-toggle" role="group" aria-label="Payout method">
                        <button type="button" className={form.payout_method === 'upi' ? 'on' : ''} aria-pressed={form.payout_method === 'upi'} onClick={() => set('payout_method')('upi')}>UPI ID</button>
                        <button type="button" className={form.payout_method === 'bank' ? 'on' : ''} aria-pressed={form.payout_method === 'bank'} onClick={() => set('payout_method')('bank')}>Bank account</button>
                      </div>
                      {form.payout_method === 'upi' ? (
                        <div className="cui-s-k-row">
                          {field('UPI ID', <input className="cui-s-k-in mono" value={form.upi_id} onChange={(e) => set('upi_id')(e.target.value.trim())} placeholder="name@bank" />)}
                        </div>
                      ) : (
                        <div className="cui-s-k-row">
                          {field('Account holder name', <input className="cui-s-k-in" value={form.account_holder_name} onChange={(e) => set('account_holder_name')(e.target.value)} />)}
                          {field('Bank name', <input className="cui-s-k-in" value={form.bank_name} onChange={(e) => set('bank_name')(e.target.value)} />)}
                          {field('Account number', (
                            <input className="cui-s-k-in mono" inputMode="numeric" value={form.account_number}
                              onChange={(e) => set('account_number')(e.target.value.replace(/\D/g, '').slice(0, 18))} />
                          ))}
                          {field('IFSC code', (
                            <input className="cui-s-k-in mono" maxLength={11} value={form.ifsc_code}
                              onChange={(e) => set('ifsc_code')(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} placeholder="HDFC0001234" />
                          ))}
                        </div>
                      )}
                    </section>

                    <div className="cui-s-k-foot">
                      <button type="button" className="cui-s-k-btn" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/dashboard/creator'))}><ArrowLeft size={16} /> Back</button>
                      <button type="submit" className="cui-s-k-btn cui-s-k-btn--pri" disabled={saving}>
                        {saving ? 'Submitting…' : 'Submit for verification'}
                      </button>
                    </div>
                    <p className="cui-s-k-fine">By submitting you confirm these documents are yours. A PAN can only be linked to one account. Your ID and payout details are visible only to you and our review team - never to brands.</p>
                  </form>
                ) : (
                  <div className="cui-s-k-card cui-s-k-onfile">
                    <h2>On file</h2>
                    <div className="cui-s-k-kv"><span>Legal name</span><strong>{kyc.full_legal_name || kyc.name_on_pan || '-'}</strong></div>
                    <div className="cui-s-k-kv"><span>PAN</span><strong className="mono">{kyc.pan_number || '-'}</strong></div>
                    {kyc.aadhaar_number ? <div className="cui-s-k-kv"><span>Aadhaar</span><strong className="mono">{/* masked on screen: only the last 4 digits */}XXXX XXXX {String(kyc.aadhaar_number).replace(/\D/g, '').slice(-4)}</strong></div> : null}
                    <div className="cui-s-k-kv"><span>Payout</span><strong>{kyc.payout_method === 'bank' ? 'Bank account' : kyc.payout_method === 'upi' ? 'UPI' : '-'}</strong></div>
                    <div className="cui-s-k-kv"><span>Submitted</span><strong>{kyc.submitted_at ? new Date(kyc.submitted_at).toLocaleDateString() : '-'}</strong></div>
                  </div>
                )}
              </div>

              <aside className="cui-s-k-aside">
                <div className="cui-s-k-card">
                  <h2>What happens next</h2>
                  <div className="cui-s-k-prog">
                    <div className="cui-s-k-bars" aria-hidden="true">
                      {STAGES.map((n, i) => <span key={n} className={i <= stage ? 'on' : ''} />)}
                    </div>
                    <div className="cui-s-k-lbls">
                      {STAGES.map((n, i) => <span key={n} className={i === stage ? 'now' : ''}>{n}</span>)}
                    </div>
                  </div>
                  <div className="cui-s-k-steps">
                    <div><i><FileCheck2 size={12} /></i>We check your documents within 24–48 hours</div>
                    <div><i><FileCheck2 size={12} /></i>We notify you once it’s done</div>
                    <div><i><FileCheck2 size={12} /></i>Then you can withdraw your earnings</div>
                  </div>
                </div>
                <div className="cui-s-k-tip"><ShieldCheck size={18} /><span>Your Aadhaar and PAN are visible only to you and our review team - never to brands.</span></div>
              </aside>
            </div>
          </>
        )}
      </div>
    </CreatorTopNavLayout>
  );
}
