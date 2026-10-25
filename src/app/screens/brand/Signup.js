import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Clock, MessageSquare, ShieldAlert, Info, Building2, Globe, Phone, Instagram, FileText, Tag, MapPin } from 'lucide-react';
import { useAuth } from '../../../App';
import { apiErrorMessage } from '../../../utils/apiError';
import { buildSupportLinks, SUPPORT_EMAIL } from '../../../components/ContactSupportBox';
import AppShell from '../../shell/AppShell';
import '../shared/auth.css';
import './signup.css';

// Phone version of src/pages/BusinessProfileSetup.js (route /profile-setup/business). Same endpoints,
// validation and payload; the approval-status screens come from src/components/{BrandPendingGate,MoreInfoGate,RejectedGate}.
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

const URL_RE = /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i;
const IG_HANDLE_RE = /^@?[a-z0-9._]{1,30}$/i;
const instagramHandle = (value) => String(value || '')
  .trim()
  .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
  .replace(/^@/, '')
  .replace(/[?#].*$/, '')
  .replace(/\/.*$/, '')
  .replace(/\/+$/, '');

const DIAL_CODES = [
  { iso: 'in', label: 'IN', code: '+91' }, { iso: 'us', label: 'US', code: '+1' }, { iso: 'gb', label: 'GB', code: '+44' },
  { iso: 'au', label: 'AU', code: '+61' }, { iso: 'ca', label: 'CA', code: '+1' }, { iso: 'de', label: 'DE', code: '+49' },
  { iso: 'fr', label: 'FR', code: '+33' }, { iso: 'ae', label: 'AE', code: '+971' }, { iso: 'sg', label: 'SG', code: '+65' },
];
const COUNTRIES = ['United States', 'United Kingdom', 'India', 'Canada', 'Australia', 'Germany', 'France', 'United Arab Emirates', 'Singapore', 'Netherlands', 'Spain', 'Italy', 'Japan', 'Brazil', 'Mexico', 'Other'];
const INDUSTRIES = [
  'Fashion & Apparel', 'Beauty & Personal Care', 'Health & Wellness', 'Food & Beverages', 'Home & Living', 'Jewellery & Accessories',
  'Electronics & Gadgets', 'Sports & Fitness', 'Baby, Kids & Family', 'Pets & Pet Care', 'Travel & Hospitality', 'Automotive & Accessories',
  'Education & Learning', 'Technology & Software', 'Finance & Fintech', 'Entertainment & Media', 'Gaming & Esports', 'Luxury & Lifestyle',
  'FMCG & Consumer Goods', 'Others',
];
const REASON_LABELS = {
  incomplete_profile: 'Incomplete profile',
  unverifiable_business: 'Business details could not be verified',
  unverifiable_socials: 'Social profiles could not be verified',
  low_quality_portfolio: 'Portfolio did not meet our bar',
  duplicate_account: 'Duplicate account',
  policy_violation: 'Policy violation',
  other: 'Other',
};

const offlineMsg = "You're offline or the server is not responding. Check your connection and try again.";
const submitError = (error, fallback) => (error?.response ? apiErrorMessage(error, fallback) : offlineMsg);

/**
 * Brand approval screens (same three states and copy as the website gates).
 *   status 'pending' | 'more_info' | 'rejected'
 * Exported so other brand screens can show them for a brand that is not approved yet.
 */
export function BrandApprovalGate({ status, user, onLogout }) {
  const navigate = useNavigate();
  const review = user?.review || {};
  const { mailto, whatsapp } = buildSupportLinks(user);
  const plainMailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Question about my brand review')}`;

  if (status === 'more_info') {
    const items = Array.isArray(review.more_info_items) ? review.more_info_items : [];
    const message = review.more_info_message || '';
    return (
      <div className="ap-gate" data-testid="gate-more-info">
        <div className="ap-gate-top">
          <span className="ap-gate-ic warn" aria-hidden="true"><MessageSquare size={32} /></span>
          <span className="ap-pill ap-pill--warn">Action needed</span>
          <h2>We need a little more info</h2>
          <p>Fix the items below and we&rsquo;ll review your brand again.</p>
        </div>
        {(message || items.length > 0) ? (
          <div className="ap-gate-box">
            <h3>Message from our team</h3>
            {message && <p>{message}</p>}
            {items.map((it, i) => <div className="ap-gate-todo" key={i}><b>{i + 1}</b><span>{it}</span></div>)}
          </div>
        ) : (
          <p className="ap-bsu-lead" style={{ textAlign: 'center' }}>Our team will be in touch by email with what&rsquo;s needed.</p>
        )}
        <div className="ap-gate-actions">
          <button type="button" className="pri" onClick={() => navigate('/profile-setup/business', { replace: true })}>Update my details</button>
          <a href={plainMailto}>Contact support</a>
          {onLogout && <button type="button" onClick={onLogout}>Log out</button>}
        </div>
      </div>
    );
  }

  if (status === 'rejected') {
    const reasonLabel = review.reason_code && review.reason_code !== 'other' ? (REASON_LABELS[review.reason_code] || null) : null;
    return (
      <div className="ap-gate" data-testid="gate-rejected">
        <div className="ap-gate-top">
          <span className="ap-gate-ic bad" aria-hidden="true"><ShieldAlert size={32} /></span>
          <span className="ap-pill ap-pill--bad">Not approved</span>
          <h2>We couldn&rsquo;t approve your brand yet</h2>
          <p>You can&rsquo;t post campaigns or chat with creators right now. If you think this is a mistake, our team is happy to look again.</p>
        </div>
        {(reasonLabel || review.reason_details) && (
          <div className="ap-gate-box bad">
            <h3>Reason from our review team</h3>
            {reasonLabel && <p><strong>{reasonLabel}</strong></p>}
            {review.reason_details && <p>{review.reason_details}</p>}
          </div>
        )}
        <div className="ap-gate-actions">
          <a className="pri" href={mailto}>Contact support</a>
          <a href={whatsapp} target="_blank" rel="noreferrer">Message us on WhatsApp</a>
          {onLogout && <button type="button" onClick={onLogout}>Log out</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="ap-gate" data-testid="gate-pending">
      <div className="ap-gate-top">
        <span className="ap-gate-ic" aria-hidden="true"><Clock size={32} /></span>
        <span className="ap-pill">Under review</span>
        <h2>We&rsquo;re checking your brand</h2>
        <p>Most brands are approved within 24&ndash;48 hours. We&rsquo;ll email you{user?.email ? ` at ${user.email}` : ''} the moment you&rsquo;re in.</p>
      </div>
      <div className="ap-gate-steps" role="list">
        <div className="done" role="listitem"><i />Signed up</div>
        <div className="now" role="listitem"><i />Under review</div>
        <div role="listitem"><i />Approved</div>
      </div>
      <div className="ap-auth-note">
        <Info size={18} />
        <span>Posting campaigns and chat open once you&rsquo;re approved. You don&rsquo;t need to do anything else right now.</span>
      </div>
      <div className="ap-gate-actions">
        <a className="pri" href={plainMailto}>Contact support</a>
        {onLogout && <button type="button" onClick={onLogout} data-testid="home-btn">Log out</button>}
      </div>
    </div>
  );
}

function Check({ c }) {
  if (!c) return null;
  if (c.status === 'checking') return <span className="ap-auth-hint">Checking&hellip;</span>;
  const cls = c.status === 'valid' ? 'ap-auth-ok' : c.status === 'invalid' ? 'ap-auth-err' : 'ap-auth-warn';
  return <span className={cls}>{c.msg}</span>;
}

export default function BrandSignup() {
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null); // approval status returned by the server after submit
  const [dial, setDial] = useState(DIAL_CODES[0]);
  const [form, setForm] = useState({ businessName: '', instagram: '', website: '', phone: '', country: '', industry: '', customIndustry: '', gstin: '' });
  const set = (field, value) => setForm((p) => ({ ...p, [field]: value }));
  const [prefill, setPrefill] = useState('loading'); // loading | ok | error
  const prefilledRef = useRef(false);
  const [webCheck, setWebCheck] = useState(null);
  const [igCheck, setIgCheck] = useState(null);

  // Prefill from the profile already on file (a brand asked for "more info" doesn't retype everything).
  // /auth/me is read (not the context user) because the login response carries no `profile`.
  const loadProfile = useCallback(async () => {
    setPrefill('loading');
    try {
      const { data } = await axios.get(`${API}/auth/me`);
      const pr = data?.profile;
      if (pr && typeof pr === 'object' && Object.keys(pr).length && !prefilledRef.current) {
        prefilledRef.current = true;
        const industry = pr.industry_category || '';
        const knownIndustry = INDUSTRIES.includes(industry);
        const storedPhone = String(pr.phone || '').trim();
        const matchedDial = DIAL_CODES.find((d) => storedPhone.startsWith(`${d.code} `)) || DIAL_CODES.find((d) => storedPhone.startsWith(d.code));
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
      }
      setPrefill('ok');
    } catch (error) {
      // Never block a first-time signup on this: an empty form is the correct fallback.
      setPrefill(error?.response?.status === 401 ? 'ok' : 'error');
    }
  }, []);
  useEffect(() => { loadProfile(); }, [loadProfile]);

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
    setIgCheck({ status: 'checking' });
    try {
      const { data } = await axios.post(`${API}/validate/instagram`, { username: instagramHandle(v) });
      if (data.valid) setIgCheck({ status: 'valid', msg: 'Instagram account found.' });
      else if (data.reason === 'not_found') setIgCheck({ status: 'invalid', msg: "This Instagram username doesn't exist." });
      else setIgCheck({ status: 'uncertain', msg: "Format looks fine, but Instagram blocks automated checks so we can't confirm it exists." });
    } catch { setIgCheck(null); }
  };

  const errors = {
    businessName: !form.businessName.trim() ? 'Business name is required.' : '',
    website: !form.website.trim() ? 'Website is required' : (!URL_RE.test(form.website.trim()) ? 'Enter a valid website URL.' : ''),
    instagram: form.instagram.trim() && !IG_HANDLE_RE.test(form.instagram.trim()) ? 'Enter a valid Instagram username, for example @yourbrand.' : '',
    phone: !form.phone.trim() ? 'Phone number is required' : '',
    country: !form.country ? 'Country is required.' : '',
  };
  const err = (field) => (submitted ? errors[field] : '');
  const filled = useMemo(() => ['businessName', 'website', 'phone', 'country'].filter((k) => !errors[k]).length, [errors.businessName, errors.website, errors.phone, errors.country]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) { toast.error('Please fill in the required fields'); return; }
    if (webCheck?.status === 'invalid') { toast.error("That website doesn't seem to be reachable. Please enter a valid business website."); return; }
    setSubmitting(true);
    const withScheme = (u) => { const v = (u || '').trim(); return !v || /^https?:\/\//i.test(v) ? v : `https://${v}`; };
    // business_description + product_type are required by the backend model but not collected here: send empty strings.
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
      const status = res.data?.approval_status || 'pending';
      setUser({ ...user, profile_completed: true, approval_status: status });
      if (status === 'approved') navigate('/brand-home', { replace: true });
      else setDone(status);
    } catch (error) {
      toast.error(submitError(error, 'Failed to submit profile'));
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <AppShell tabs={false} title="Your brand">
        <BrandApprovalGate status={done} user={user} onLogout={logout} />
      </AppShell>
    );
  }

  const box = (bad, grey = true) => `ap-auth-box${grey ? ' grey' : ''}${bad ? ' is-bad' : ''}`;

  return (
    <AppShell tabs={false} title="Brand details" subtitle="Tell us about your brand">
      <form className="ap-bsu" onSubmit={handleSubmit} noValidate>
        <div className="ap-bsu-steps">
          <div><span>Step 2 of 2 &middot; Brand details</span><span className="m">about 2 min</span></div>
          <div className="ap-bsu-bars" aria-hidden="true">
            <i />
            <i style={{ background: `linear-gradient(90deg,#7387FF ${(filled / 4) * 100}%,#E2E3F3 ${(filled / 4) * 100}%)` }} />
          </div>
        </div>
        <p className="ap-bsu-lead">We check every brand so creators know your briefs are real. Most brands are approved within 24&ndash;48 hours.</p>

        {prefill === 'error' && (
          <div className="ap-bsu-banner" role="alert">
            <span>Couldn&rsquo;t load your saved details. You can still fill this in.</span>
            <button type="button" onClick={loadProfile}>Retry</button>
          </div>
        )}

        {prefill === 'loading' ? (
          <div className="ap-bsu-skel" aria-busy="true" aria-label="Loading your details">
            <div className="ap-skel" style={{ height: 230, borderRadius: 20 }} />
            <div className="ap-skel" style={{ height: 300, borderRadius: 20 }} />
          </div>
        ) : (
          <>
            <section className="ap-bsu-card">
              <h2>Your brand</h2>
              <div className="ap-bsu-f">
                <label htmlFor="bp-name">Business name *</label>
                <span className={box(err('businessName'))}>
                  <Building2 size={18} color="#8e8eb2" />
                  <input id="bp-name" value={form.businessName} onChange={(e) => set('businessName', e.target.value)} placeholder="Enter business name.." autoComplete="organization" />
                </span>
                {err('businessName') && <span className="ap-auth-err" role="alert">{err('businessName')}</span>}
              </div>
              <div className="ap-bsu-f">
                <label htmlFor="bp-web">Website *</label>
                <span className={box(err('website'))}>
                  <Globe size={18} color="#8e8eb2" />
                  <input
                    id="bp-web" inputMode="url" autoCapitalize="none" autoComplete="url" value={form.website} placeholder="www.business.com"
                    onChange={(e) => { set('website', e.target.value); setWebCheck(null); }} onBlur={checkWebsiteLive}
                  />
                </span>
                {err('website') && <span className="ap-auth-err" role="alert">{err('website')}</span>}
                <Check c={webCheck} />
              </div>
              <div className="ap-bsu-f">
                <label htmlFor="bp-industry">Industry</label>
                <span className={box(false)}>
                  <Tag size={18} color="#8e8eb2" />
                  <select id="bp-industry" value={form.industry} onChange={(e) => set('industry', e.target.value)} style={{ color: form.industry ? undefined : '#8e8eb2' }}>
                    <option value="" disabled>Select industry...</option>
                    {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </span>
                {form.industry === 'Other' && (
                  <span className={box(false)}>
                    <input aria-label="Your industry" value={form.customIndustry} onChange={(e) => set('customIndustry', e.target.value)} placeholder="Enter your industry" />
                  </span>
                )}
              </div>
            </section>

            <section className="ap-bsu-card">
              <h2>Contact &amp; tax</h2>
              <div className="ap-bsu-f">
                <label htmlFor="bp-phone">Phone *</label>
                <div className="ap-bsu-phone">
                  <span className={box(false)}>
                    <select
                      aria-label="Country code" value={dial.iso}
                      onChange={(e) => setDial(DIAL_CODES.find((d) => d.iso === e.target.value) || DIAL_CODES[0])}
                    >
                      {DIAL_CODES.map((d) => <option key={d.iso} value={d.iso}>{d.label} {d.code}</option>)}
                    </select>
                  </span>
                  <span className={box(err('phone'))}>
                    <Phone size={18} color="#8e8eb2" />
                    <input
                      id="bp-phone" type="tel" inputMode="tel" autoComplete="tel-national" value={form.phone} placeholder="98765 43210"
                      onChange={(e) => set('phone', e.target.value.replace(/[^\d\s-]/g, ''))}
                    />
                  </span>
                </div>
                {err('phone') && <span className="ap-auth-err" role="alert">{err('phone')}</span>}
              </div>
              <div className="ap-bsu-f">
                <label htmlFor="bp-country">Country *</label>
                <span className={box(err('country'))}>
                  <MapPin size={18} color="#8e8eb2" />
                  <select id="bp-country" value={form.country} onChange={(e) => set('country', e.target.value)} style={{ color: form.country ? undefined : '#8e8eb2' }}>
                    <option value="" disabled>Select country...</option>
                    {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </span>
                {err('country') && <span className="ap-auth-err" role="alert">{err('country')}</span>}
              </div>
              <div className="ap-bsu-f">
                <label htmlFor="bp-ig">Instagram <em>optional &mdash; helps us approve you faster</em></label>
                <span className={box(err('instagram'))}>
                  <Instagram size={18} color="#8e8eb2" />
                  <input
                    id="bp-ig" autoCapitalize="none" value={form.instagram} placeholder="@yourbrand"
                    onChange={(e) => { set('instagram', e.target.value); setIgCheck(null); }} onBlur={checkInstagramLive}
                  />
                </span>
                {err('instagram') && <span className="ap-auth-err" role="alert">{err('instagram')}</span>}
                <Check c={igCheck} />
              </div>
              <div className="ap-bsu-f">
                <label htmlFor="bp-gstin">GSTIN <em>Optional</em></label>
                <span className={box(false)}>
                  <FileText size={18} color="#8e8eb2" />
                  <input id="bp-gstin" value={form.gstin} maxLength={15} autoCapitalize="characters" placeholder="Enter GSTIN" onChange={(e) => set('gstin', e.target.value.toUpperCase())} />
                </span>
                <span className="ap-auth-hint">Needed for GST invoices on every payment</span>
              </div>
            </section>

            <div className="ap-auth-note">
              <Info size={18} />
              <span><strong style={{ color: '#07074E' }}>Why we check:</strong> every brand is reviewed, so creators know they&rsquo;re working with a real business.</span>
            </div>
          </>
        )}

        <div className="ap-bsu-sticky">
          <button type="submit" className="ap-bsu-go" disabled={submitting || prefill === 'loading'} data-testid="submit-profile-btn">
            {submitting ? 'Submitting…' : 'Submit for review'}
          </button>
          <small>By continuing you agree to the Terms and Privacy Policy.</small>
        </div>
      </form>
    </AppShell>
  );
}
