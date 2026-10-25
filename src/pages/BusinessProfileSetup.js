import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { ChevronDown, Users, ShieldCheck, Clock } from 'lucide-react';
import BrandGateHeader from '../components/BrandGateHeader';
import { apiErrorMessage } from '../utils/apiError';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

// Only accept genuine platform links / handles — no random URLs.
const URL_RE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i;                       // any valid website
const IG_HANDLE_RE = /^@?[a-z0-9._]{1,30}$/i;

const instagramHandle = (value) => String(value || '')
  .trim()
  .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
  .replace(/^@/, '')
  // A link copied from the app carries ?igsh=/&utm_source= tracking params; drop
  // them (and any /reel/... path) or the leftovers fail IG_HANDLE_RE.
  .replace(/[?#].*$/, '')
  .replace(/\/.*$/, '')
  .replace(/\/+$/, '');

// iso = flagcdn country code (flags are image-based so they render on Windows too).
const DIAL_CODES = [
  { iso: 'in', label: 'IN', code: '+91' },
  { iso: 'us', label: 'US', code: '+1' },
  { iso: 'gb', label: 'GB', code: '+44' },
  { iso: 'au', label: 'AU', code: '+61' },
  { iso: 'ca', label: 'CA', code: '+1' },
  { iso: 'de', label: 'DE', code: '+49' },
  { iso: 'fr', label: 'FR', code: '+33' },
  { iso: 'ae', label: 'AE', code: '+971' },
  { iso: 'sg', label: 'SG', code: '+65' },
];

const flagSrc = (iso) => `https://flagcdn.com/w40/${iso}.png`;

const COUNTRIES = [
  'United States', 'United Kingdom', 'India', 'Canada', 'Australia',
  'Germany', 'France', 'United Arab Emirates', 'Singapore', 'Netherlands',
  'Spain', 'Italy', 'Japan', 'Brazil', 'Mexico', 'Other',
];

const INDUSTRIES = [
  'Fashion & Apparel', 'Beauty & Personal Care', 'Health & Wellness',
  'Food & Beverages', 'Home & Living', 'Jewellery & Accessories',
  'Electronics & Gadgets', 'Sports & Fitness', 'Baby, Kids & Family',
  'Pets & Pet Care', 'Travel & Hospitality', 'Automotive & Accessories',
  'Education & Learning', 'Technology & Software', 'Finance & Fintech',
  'Entertainment & Media', 'Gaming & Esports', 'Luxury & Lifestyle',
  'FMCG & Consumer Goods', 'Others',
];

export default function BusinessProfileSetup() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dial, setDial] = useState(DIAL_CODES[0]);   // default India
  const [dialOpen, setDialOpen] = useState(false);
  const [form, setForm] = useState({
    businessName: '',
    instagram: '',
    website: '',
    phone: '',
    country: '',
    industry: '',
    customIndustry: '',    // free-text industry when "Other" is selected
    gstin: '',
  });

  const set = (field, value) => setForm((p) => ({ ...p, [field]: value }));

  const prefilledRef = useRef(false);

  // Prefill with the profile already on file, so a brand asked for "more info"
  // (or just re-editing) doesn't retype everything — the creator form does this
  // and the business one never did.
  //
  // We read /auth/me rather than the auth-context user: the login response carries
  // no `profile`, so relying on it would only work after a page refresh.
  useEffect(() => {
    let alive = true;
    (async () => {
      if (prefilledRef.current) return;
      try {
        const { data } = await axios.get(`${API}/auth/me`);
        const pr = data?.profile;
        if (!alive || !pr || typeof pr !== 'object' || !Object.keys(pr).length) return;
        prefilledRef.current = true;

        // The stored shape differs from the form's, so map it back explicitly —
        // spreading would silently drop every field.
        const industry = pr.industry_category || '';
        const knownIndustry = INDUSTRIES.includes(industry);

        // Phone is stored with the dial code baked in ("+91 98765 43210").
        const storedPhone = String(pr.phone || '').trim();
        const matchedDial = DIAL_CODES.find((d) => storedPhone.startsWith(`${d.code} `))
          || DIAL_CODES.find((d) => storedPhone.startsWith(d.code));
        const barePhone = matchedDial ? storedPhone.slice(matchedDial.code.length).trim() : storedPhone;
        if (matchedDial) setDial(matchedDial);

        setForm((f) => ({
          ...f,
          businessName: pr.business_name || f.businessName,
          website: pr.website || f.website,
          instagram: instagramHandle((pr.social_links || {}).instagram) || f.instagram,
          phone: barePhone || f.phone,
          country: pr.country || f.country,
          industry: industry ? (knownIndustry ? industry : 'Other') : f.industry,
          customIndustry: industry && !knownIndustry ? industry : f.customIndustry,
          gstin: pr.gstin || f.gstin,
        }));
      } catch {
        // Never block a first-time signup on this — an empty form is the correct
        // fallback.
      }
    })();
    return () => { alive = false; };
  }, []);

  // Live "is this real?" checks — the backend actually resolves the website and
  // looks up the Instagram handle. {status:'checking'|'valid'|'invalid'|'uncertain', msg}
  const [webCheck, setWebCheck] = useState(null);
  const [igCheck, setIgCheck] = useState(null);

  const checkWebsiteLive = async () => {
    const v = form.website.trim();
    if (!v || !URL_RE.test(v)) { setWebCheck(null); return; }
    setWebCheck({ status: 'checking' });
    try {
      const { data } = await axios.post(`${API}/validate/website`, { url: v });
      setWebCheck(data.valid
        ? { status: 'valid', msg: 'Website is live and reachable.' }
        : { status: 'invalid', msg: "We couldn't reach this website - check the address." });
    } catch { setWebCheck(null); }
  };

  const checkInstagramLive = async () => {
    const v = form.instagram.trim();
    if (!v || !IG_HANDLE_RE.test(v)) { setIgCheck(null); return; }
    const handle = instagramHandle(v);
    setIgCheck({ status: 'checking' });
    try {
      const { data } = await axios.post(`${API}/validate/instagram`, { username: handle });
      if (data.valid) setIgCheck({ status: 'valid', msg: 'Instagram account found.' });
      else if (data.reason === 'not_found') setIgCheck({ status: 'invalid', msg: "This Instagram username doesn't exist." });
      else setIgCheck({ status: 'uncertain', msg: "Format looks fine, but Instagram blocks automated checks so we can't confirm it exists." });
    } catch { setIgCheck(null); }
  };

  // Small status line rendered under the website / instagram fields.
  const CheckNote = ({ c }) => {
    if (!c) return null;
    const icon = { valid: '\u2713 ', invalid: '\u2715 ', uncertain: '\u26A0 ' }[c.status] || '';
    return <span className={`su-check su-check--${c.status}`}>{icon}{c.status === 'checking' ? 'Checking\u2026' : c.msg}</span>;
  };

  const errors = {
    businessName: !form.businessName.trim() ? 'Business name is required.' : '',
    website: !form.website.trim()
      ? 'Website is required'
      : (!URL_RE.test(form.website.trim()) ? 'Enter a valid website URL.' : ''),
    instagram: form.instagram.trim() && !IG_HANDLE_RE.test(form.instagram.trim())
      ? 'Enter a valid Instagram username, for example @yourbrand.'
      : '',
    phone: !form.phone.trim() ? 'Phone number is required' : '',
    country: !form.country ? 'Country is required.' : '',
  };
  const err = (field) => (submitted ? errors[field] : '');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) {
      toast.error('Please fill in the required fields');
      return;
    }
    // Block on a website the reachability check already confirmed is dead (runs on blur).
    if (webCheck?.status === 'invalid') {
      toast.error("That website doesn't seem to be reachable. Please enter a valid business website.");
      return;
    }
    setSubmitting(true);
    // Backend validates website/instagram as URLs — a bare "www.business.com" (no scheme) fails
    // with a 422, so prepend https:// when the user omitted it.
    const withScheme = (u) => {
      const v = (u || '').trim();
      if (!v) return v;
      return /^https?:\/\//i.test(v) ? v : `https://${v}`;
    };
    // Persist the business profile to the backend, then show the thank-you screen.
    // business_description + product_type are REQUIRED by the backend model (BusinessProfileUpdate)
    // but this onboarding form doesn't collect them yet — send empty strings so validation passes.
    const payload = {
      business_name: form.businessName,
      website: withScheme(form.website),
      social_links: {
        ...(form.instagram.trim() ? { instagram: `https://instagram.com/${instagramHandle(form.instagram)}` } : {}),
        linkedin: '',
      },
      industry_category: form.industry === 'Other' ? (form.customIndustry.trim() || 'Other') : form.industry,
      business_description: '',
      product_type: '',
      country: form.country,
      phone: `${dial.code} ${form.phone}`.trim(),
      gstin: form.gstin,
    };
    try {
      const res = await axios.put(`${API}/profile/business`, payload);
      // Trust the server: an already-approved brand stays approved, a new one goes to review.
      setUser({ ...user, profile_completed: true, approval_status: res.data?.approval_status || 'pending' });
      navigate('/dashboard/business', { replace: true });
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to submit profile'));
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls = (field, extra = '') => `su-input${err(field) ? ' su-input--error' : ''}${extra}`;
  const Err = ({ f }) => (err(f) ? <span className="su-err">{err(f)}</span> : null);

  return (
    <div className="bui-app bg-page">
      <BrandGateHeader />

      <main className="su-main">
        <form className="su-card" onSubmit={handleSubmit} noValidate>
          <div>
            <span className="su-badge">Step 1 of 1 · takes 2 minutes</span>
            <h1 className="bui-h1">Tell us about your brand</h1>
            <p className="su-lead">We check every brand so creators know your briefs are real. Most brands are approved within 24–48 hours.</p>
          </div>

          <div className="su-row">
            {/* Business name */}
            <div className="su-field">
              <label htmlFor="bp-name">Business name *</label>
              <input
                id="bp-name"
                className={inputCls('businessName')}
                placeholder="Enter business name.."
                value={form.businessName}
                onChange={(e) => set('businessName', e.target.value)}
              />
              <Err f="businessName" />
            </div>

            {/* Industry */}
            <div className="su-field">
              <label htmlFor="bp-industry">Industry</label>
              <select
                id="bp-industry"
                className={`su-input${!form.industry ? ' is-empty' : ''}`}
                value={form.industry}
                onChange={(e) => set('industry', e.target.value)}
              >
                <option value="" disabled>Select industry...</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          </div>
          {form.industry === 'Other' && (
            <input
              className="su-input"
              placeholder="Enter your industry"
              aria-label="Your industry"
              value={form.customIndustry}
              onChange={(e) => set('customIndustry', e.target.value)}
            />
          )}

          {/* Website URL */}
          <div className="su-field">
            <label htmlFor="bp-web">Website *</label>
            <input
              id="bp-web"
              className={inputCls('website', webCheck?.status === 'valid' ? ' su-input--ok' : '')}
              placeholder="www.business.com"
              value={form.website}
              onChange={(e) => { set('website', e.target.value); setWebCheck(null); }}
              onBlur={checkWebsiteLive}
            />
            <Err f="website" />
            <CheckNote c={webCheck} />
          </div>

          {/* Optional Instagram username; verified on blur and stored as a profile URL. */}
          <div className="su-field">
            <label htmlFor="bp-ig">Instagram <span className="su-opt">optional — helps us approve you faster</span></label>
            <input
              id="bp-ig"
              className={inputCls('instagram', igCheck?.status === 'valid' ? ' su-input--ok' : '')}
              placeholder="@yourbrand"
              value={form.instagram}
              onChange={(e) => { set('instagram', e.target.value); setIgCheck(null); }}
              onBlur={checkInstagramLive}
            />
            <Err f="instagram" />
            <CheckNote c={igCheck} />
          </div>

          <div className="su-row su-row--3">
            {/* Phone: dial-code picker + number */}
            <div className="su-field">
              <label htmlFor="bp-dial">Code</label>
              <div className="su-input su-group">
                <button
                  id="bp-dial"
                  type="button"
                  className="su-dial"
                  onClick={() => setDialOpen((o) => !o)}
                  aria-label="Country code"
                >
                  <img className="su-flag" src={flagSrc(dial.iso)} alt={dial.label} />
                  <span>{dial.code}</span>
                  <ChevronDown size={15} style={{ marginLeft: 'auto', color: '#5a5a8c' }} />
                </button>
              </div>
              {dialOpen && (
                <>
                  <div className="su-backdrop" onClick={() => setDialOpen(false)} />
                  <ul className="su-menu" role="listbox">
                    {DIAL_CODES.map((d, i) => (
                      <li
                        key={i}
                        role="option"
                        aria-selected={d.iso === dial.iso}
                        className={`su-opt-li${d.iso === dial.iso ? ' is-on' : ''}`}
                        onClick={() => { setDial(d); setDialOpen(false); }}
                      >
                        <img className="su-flag" src={flagSrc(d.iso)} alt="" />
                        <span>{d.label}</span>
                        <small>{d.code}</small>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            <div className="su-field">
              <label htmlFor="bp-phone">Phone *</label>
              <input
                id="bp-phone"
                type="tel"
                className={inputCls('phone')}
                placeholder="98765 43210"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value.replace(/[^\d\s-]/g, ''))}
              />
              <Err f="phone" />
            </div>

            {/* Country */}
            <div className="su-field">
              <label htmlFor="bp-country">Country *</label>
              <select
                id="bp-country"
                className={inputCls('country', !form.country ? ' is-empty' : '')}
                value={form.country}
                onChange={(e) => set('country', e.target.value)}
              >
                <option value="" disabled>Select country...</option>
                {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <Err f="country" />
            </div>
          </div>

          {/* GSTIN — optional */}
          <div className="su-field">
            <label htmlFor="bp-gstin">GSTIN</label>
            <input
              id="bp-gstin"
              className="su-input"
              placeholder="Enter GSTIN"
              value={form.gstin}
              onChange={(e) => set('gstin', e.target.value.toUpperCase())}
              maxLength={15}
            />
            <span className="su-note">Optional · needed for GST invoices</span>
          </div>

          <button type="submit" className="bui-btn su-submit" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit for review'}
          </button>
          <p className="su-fine">By continuing you agree to the Terms and Privacy Policy.</p>
        </form>

        <aside className="su-aside">
          <section className="su-hero">
            <h2>What happens next</h2>
            <ol>
              <li><b>1</b><span><strong>We review your brand</strong><span>Usually within 24–48 hours</span></span></li>
              <li><b>2</b><span><strong>Add funds to your wallet</strong><span>Needed to chat with creators</span></span></li>
              <li><b>3</b><span><strong>Post your first campaign</strong><span>Or invite a creator directly</span></span></li>
            </ol>
          </section>
          <div className="su-trust">
            <div><i><Users size={16} /></i>Vetted creators taking briefs</div>
            <div><i><ShieldCheck size={16} /></i>Money held in escrow until you approve</div>
            <div><i><Clock size={16} /></i>Fast turnaround on first videos</div>
          </div>
        </aside>
      </main>
    </div>
  );
}
