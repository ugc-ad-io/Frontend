import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { ChevronDown } from 'lucide-react';
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
  'Fashion & Apparel', 'Beauty & Cosmetics', 'Technology & Gadgets',
  'Food & Beverage', 'Health & Fitness', 'Home & Lifestyle',
  'Travel & Tourism', 'Education', 'Entertainment', 'Other',
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
        : { status: 'invalid', msg: "We couldn't reach this website — check the address." });
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

  // Small coloured status line rendered under the website / instagram fields.
  const CheckNote = ({ c }) => {
    if (!c) return null;
    const map = { valid: ['#34d399', '✓ '], invalid: ['#f87171', '✕ '], uncertain: ['#fbbf24', '⚠ '], checking: ['#94a3b8', ''] };
    const [color, icon] = map[c.status] || map.checking;
    return <span style={{ display: 'block', marginTop: 6, fontSize: 12.5, fontWeight: 600, color }}>{icon}{c.status === 'checking' ? 'Checking…' : c.msg}</span>;
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
      await axios.put(`${API}/profile/business`, payload);
      setUser({ ...user, profile_completed: true, approval_status: 'pending' });
      navigate('/dashboard/business', { replace: true });
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Failed to submit profile'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bp-page">
      <header className="bp-topbar">
        <button type="button" className="bp-brand" onClick={() => navigate('/')}>
          <img src="/newlogo-tight.png" alt="UGCad.io" className="bp-brand__logo" />
        </button>
        <span className="bp-topbar__tag">Brand onboarding</span>
      </header>

      <form className="bp-card" onSubmit={handleSubmit} noValidate>
        <h1 className="bp-title">Add your <span className="bp-accent">Brand</span> Details</h1>
        <p className="bp-sub">
          Provide your brand's online details so we can tailor insights and recommendations for you.
        </p>

        {/* Business name */}
        <div className="bp-field">
          <label className="bp-label" htmlFor="bp-name">Business name</label>
          <input
            id="bp-name"
            className={`bp-input${err('businessName') ? ' bp-input--error' : ''}`}
            placeholder="Enter business name.."
            value={form.businessName}
            onChange={(e) => set('businessName', e.target.value)}
          />
          {err('businessName') && <span className="bp-err">{err('businessName')}</span>}
        </div>

        {/* Optional Instagram username; verified on blur and stored as a profile URL. */}
        <div className="bp-field">
          <label className="bp-label" htmlFor="bp-ig">Instagram username</label>
          <input
            id="bp-ig"
            className={`bp-input${err('instagram') ? ' bp-input--error' : ''}`}
            placeholder="@yourbrand"
            value={form.instagram}
            onChange={(e) => { set('instagram', e.target.value); setIgCheck(null); }}
            onBlur={checkInstagramLive}
          />
          {err('instagram') && <span className="bp-err">{err('instagram')}</span>}
          <CheckNote c={igCheck} />
        </div>

        {/* Website URL */}
        <div className="bp-field">
          <label className="bp-label" htmlFor="bp-web">Business website URL</label>
          <input
            id="bp-web"
            className={`bp-input${err('website') ? ' bp-input--error' : ''}`}
            placeholder="www.business.com"
            value={form.website}
            onChange={(e) => { set('website', e.target.value); setWebCheck(null); }}
            onBlur={checkWebsiteLive}
          />
          {err('website') && <span className="bp-err">{err('website')}</span>}
          <CheckNote c={webCheck} />
        </div>

        {/* Phone */}
        <div className="bp-field">
          <label className="bp-label" htmlFor="bp-phone">Phone Number</label>
          <div className="bp-phone-wrap">
            <div className={`bp-input-group${err('phone') ? ' bp-input--error' : ''}`}>
              <button
                type="button"
                className="bp-dial-btn"
                onClick={() => setDialOpen((o) => !o)}
                aria-label="Country code"
              >
                <img className="bp-flag" src={flagSrc(dial.iso)} alt={dial.label} />
                <span className="bp-dial-code">{dial.code}</span>
                <ChevronDown size={15} className="bp-dial-caret" />
              </button>
              <input
                id="bp-phone"
                type="tel"
                className="bp-input bp-input--bare"
                value={form.phone}
                onChange={(e) => set('phone', e.target.value.replace(/[^\d\s-]/g, ''))}
              />
            </div>

            {dialOpen && (
              <>
                <div className="bp-dial-backdrop" onClick={() => setDialOpen(false)} />
                <ul className="bp-dial-menu" role="listbox">
                  {DIAL_CODES.map((d, i) => (
                    <li
                      key={i}
                      className={`bp-dial-opt${d.iso === dial.iso ? ' bp-dial-opt--active' : ''}`}
                      onClick={() => { setDial(d); setDialOpen(false); }}
                    >
                      <img className="bp-flag" src={flagSrc(d.iso)} alt={d.label} />
                      <span className="bp-dial-opt__label">{d.label}</span>
                      <span className="bp-dial-opt__code">{d.code}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          {err('phone') && <span className="bp-err">{err('phone')}</span>}
        </div>

        {/* Country */}
        <div className="bp-field">
          <label className="bp-label" htmlFor="bp-country">Country</label>
          <select
            id="bp-country"
            className={`bp-input bp-select${err('country') ? ' bp-input--error' : ''}${!form.country ? ' bp-select--placeholder' : ''}`}
            value={form.country}
            onChange={(e) => set('country', e.target.value)}
          >
            <option value="" disabled>Select country...</option>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {err('country') && <span className="bp-err">{err('country')}</span>}
        </div>

        {/* Industry */}
        <div className="bp-field">
          <label className="bp-label" htmlFor="bp-industry">Industry</label>
          <select
            id="bp-industry"
            className={`bp-input bp-select${!form.industry ? ' bp-select--placeholder' : ''}`}
            value={form.industry}
            onChange={(e) => set('industry', e.target.value)}
          >
            <option value="" disabled>Select industry...</option>
            {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
          {form.industry === 'Other' && (
            <input
              className="bp-input"
              style={{ marginTop: 10 }}
              placeholder="Enter your industry"
              value={form.customIndustry}
              onChange={(e) => set('customIndustry', e.target.value)}
            />
          )}
        </div>

        {/* GSTIN — optional */}
        <div className="bp-field">
          <label className="bp-label" htmlFor="bp-gstin">GSTIN Number</label>
          <input
            id="bp-gstin"
            className="bp-input"
            placeholder="Enter GSTIN"
            value={form.gstin}
            onChange={(e) => set('gstin', e.target.value.toUpperCase())}
            maxLength={15}
          />
        </div>

        <button type="submit" className="bp-next" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit'}
        </button>
      </form>

      <ThemeStyles />
    </div>
  );
}

function ThemeStyles() {
  return (
    <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

        .bp-page {
          position: relative;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          align-items: center;
          padding: 24px 20px 32px;
          background: linear-gradient(160deg, #050510 0%, #0b0a26 55%, #07074e 100%);
          font-family: var(--font-body);
          overflow: hidden;
        }

        /* Top bar — UGCad.io logo, matches the creator onboarding page */
        .bp-topbar {
          position: relative;
          z-index: 1;
          width: 100vw;
          max-width: 100vw;
          margin-left: calc(50% - 50vw);
          margin-right: calc(50% - 50vw);
          box-sizing: border-box;
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 28px;
          padding: 0 clamp(20px, 6vw, 90px) 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }
        .bp-brand {
          display: inline-flex;
          align-items: center;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
        }
        .bp-brand__logo { height: 30px; width: auto; display: block; }
        .bp-topbar__tag {
          margin-left: auto;
          font-size: 0.82rem;
          font-weight: 500;
          letter-spacing: 0.02em;
          color: rgba(255, 255, 255, 0.6);
          padding: 6px 14px;
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.18);
        }
        .bp-page::before,
        .bp-page::after {
          content: '';
          position: absolute;
          border-radius: 50%;
          filter: blur(90px);
          pointer-events: none;
          z-index: 0;
        }
        .bp-page::before {
          width: 520px; height: 520px;
          top: -12%; left: -6%;
          background: rgba(99, 102, 241, 0.20);
        }
        .bp-page::after {
          width: 460px; height: 460px;
          bottom: -10%; right: -4%;
          background: rgba(109,123,255, 0.16);
        }

        .bp-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 520px;
          background: rgba(18, 18, 26, 0.72);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 18px;
          padding: 28px 34px 30px;
          box-shadow: 0 30px 70px rgba(0, 0, 0, 0.55);
        }

        .bp-step {
          display: block;
          color: #07074e;
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: 6px;
        }
        .bp-title {
          margin: 0 0 6px;
          font-family: var(--font-head);
          font-size: var(--fs-h2);
          font-weight: var(--fw-head);
          color: #ffffff;
          letter-spacing: -0.01em;
        }
        .bp-accent { color: #6d7bff; }
        .bp-sub {
          margin: 0 0 22px;
          color: rgba(255, 255, 255, 0.62);
          font-size: 0.9rem;
          line-height: 1.5;
        }

        .bp-field { margin-bottom: 14px; }
        .bp-label {
          display: block;
          font-size: 0.88rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.85);
          margin-bottom: 7px;
        }

        .bp-input {
          width: 100%;
          background: rgba(255, 255, 255, 0.04);
          border: 1.5px solid rgba(255, 255, 255, 0.14);
          border-radius: 9px;
          padding: 11px 14px;
          font-size: 0.92rem;
          color: #ffffff;
          font-family: var(--font-body);
          transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
        }
        .bp-input::placeholder { color: rgba(255, 255, 255, 0.38); }
        .bp-input:focus {
          outline: none;
          border-color: #07074e;
          background: rgba(255, 255, 255, 0.06);
          box-shadow: 0 0 0 3px rgba(7, 7, 78, 0.18);
        }
        .bp-input--error { border-color: #f87171; }
        /* Dark dropdown lists for native selects */
        .bp-input option, .bp-select option {
          background-color: #14142a;
          color: #ffffff;
        }
        .bp-select option:disabled { color: rgba(255, 255, 255, 0.4); }

        /* Grouped inputs (prefix / dial code) */
        .bp-input-group {
          display: flex;
          align-items: stretch;
          background: rgba(255, 255, 255, 0.04);
          border: 1.5px solid rgba(255, 255, 255, 0.14);
          border-radius: 9px;
          overflow: hidden;
          transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
        }
        .bp-input-group:focus-within {
          border-color: #07074e;
          background: rgba(255, 255, 255, 0.06);
          box-shadow: 0 0 0 3px rgba(7, 7, 78, 0.18);
        }
        .bp-input-group.bp-input--error { border-color: #f87171; }
        .bp-prefix {
          display: flex;
          align-items: center;
          padding: 0 12px;
          color: rgba(255, 255, 255, 0.55);
          font-size: 0.95rem;
          border-right: 1.5px solid rgba(255, 255, 255, 0.14);
        }
        .bp-input--bare {
          border: none;
          border-radius: 0;
          background: transparent;
          flex: 1;
          min-width: 0;
        }
        .bp-input--bare:focus { box-shadow: none; background: transparent; }

        /* Custom phone country-code dropdown */
        .bp-phone-wrap { position: relative; }
        .bp-dial-btn {
          display: flex;
          align-items: center;
          gap: 7px;
          border: none;
          border-right: 1.5px solid rgba(255, 255, 255, 0.14);
          background: transparent;
          padding: 0 10px 0 12px;
          font-family: var(--font-body);
          cursor: pointer;
          outline: none;
          color: #ffffff;
        }
        .bp-flag {
          width: 22px;
          height: 16px;
          object-fit: cover;
          border-radius: 3px;
          flex-shrink: 0;
          box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12);
        }
        .bp-dial-code { font-size: 0.92rem; font-weight: 600; color: #ffffff; }
        .bp-dial-caret { color: rgba(255, 255, 255, 0.55); }

        .bp-dial-backdrop {
          position: fixed;
          inset: 0;
          z-index: 40;
        }
        .bp-dial-menu {
          position: absolute;
          z-index: 41;
          top: calc(100% + 6px);
          left: 0;
          width: 200px;
          max-height: 260px;
          overflow-y: auto;
          margin: 0;
          padding: 6px;
          list-style: none;
          background: #14142a;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 12px;
          box-shadow: 0 20px 44px rgba(0, 0, 0, 0.55);
        }
        .bp-dial-opt {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 10px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .bp-dial-opt:hover { background: rgba(255, 255, 255, 0.07); }
        .bp-dial-opt--active { background: rgba(7, 7, 78, 0.18); }
        .bp-dial-opt__label {
          font-size: 0.82rem;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.55);
          width: 24px;
        }
        .bp-dial-opt__code { font-size: 0.9rem; color: #ffffff; }

        /* Native selects */
        .bp-select {
          cursor: pointer;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' opacity='0.5'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
          padding-right: 40px;
        }
        .bp-select--placeholder { color: rgba(255, 255, 255, 0.4); }

        .bp-err {
          display: block;
          margin-top: 6px;
          color: #f87171;
          font-size: 0.82rem;
        }

        .bp-next {
          width: 100%;
          margin-top: 18px;
          padding: 14px;
          border: none;
          border-radius: 100px;
          background: linear-gradient(120deg, #07074e, #4f63e6);
          color: #ffffff;
          font-size: 1rem;
          font-weight: 700;
          font-family: var(--font-body);
          cursor: pointer;
          box-shadow: none;
          transition: transform 0.15s ease;
        }
        .bp-next:hover { transform: translateY(-1px); }
        .bp-next:active { transform: translateY(0); }

        /* Thank-you screen */
        .bp-card--thanks { text-align: center; }
        .bp-check {
          width: 88px;
          height: 88px;
          margin: 0 auto 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          color: #22c55e;
          background: rgba(34, 197, 94, 0.15);
          border: 1px solid rgba(34, 197, 94, 0.35);
          box-shadow: 0 0 0 10px rgba(34, 197, 94, 0.10), 0 16px 40px rgba(34, 197, 94, 0.22);
        }
        .bp-sub--center { margin-bottom: 26px; }
        .bp-card--thanks .bp-title { margin-bottom: 10px; }

        @media (max-width: 520px) {
          .bp-card { padding: 24px 20px 26px; }
        }
      `}</style>
  );
}
