import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { Eye, EyeOff, ArrowLeft, Mail, Phone, Lock, Check } from 'lucide-react';
import '../styles/creator-ui-onboarding.css';
import '../styles/public-mobile.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

// Mobile number is compulsory at signup — collected and stored, never OTP-verified.
// Same dial codes + length rules as /auth and the creator profile-setup form, so a
// number accepted here stays valid downstream.
const DIAL_CODES = ['+91', '+1', '+44', '+61'];
const PHONE_LEN = { '+91': 10, '+1': 10, '+44': 10, '+61': 9 };
const onlyDigits = (v) => String(v ?? '').replace(/\D/g, '');
const phoneMax = (dial) => PHONE_LEN[dial] || 15;
const phoneValid = (v, dial) => onlyDigits(v).length === phoneMax(dial);
// Drop a pasted country code, but only when the number is otherwise too long, so a
// legitimate 10-digit number that happens to start with "91" is left alone.
const normalisePhone = (raw, dial) => {
  const digits = onlyDigits(raw);
  const cc = onlyDigits(dial);
  const max = phoneMax(dial);
  const national = digits.length > max && cc && digits.startsWith(cc) ? digits.slice(cc.length) : digits;
  return national.slice(0, max);
};

// Multicolour Google "G" mark (inline so it matches the screenshot exactly).
function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function CreatorSignup() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [dialCode, setDialCode] = useState('+91');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Email + password → create the account, then collect the name in profile setup.
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    // `required` only catches an empty field — a half-typed number needs this.
    if (!phoneValid(phone, dialCode)) {
      toast.error(`Enter a valid ${phoneMax(dialCode)}-digit mobile number`);
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await axios.post(`${API}/auth/signup`, {
        email,
        password,
        role: 'creator',
        phone: onlyDigits(phone),
        dial_code: dialCode,
      });
      const { token, ...userData } = data;
      login(token, userData);
      toast.success('Account created!');
      navigate('/profile-setup/creator');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Signup failed'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = () => {
    toast.info('Google sign-up is coming soon');
  };

  return (
    <div className="cui-s">
      <div className="cui-s-split">
        {/* Story panel (hidden under 900px) */}
        <aside className="cui-s-promo">
          <div className="cui-s-brand" style={{ cursor: 'default' }}>
            <span className="cui-s-mark" aria-hidden="true" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/ugcad-logo.png)` }} />
            <span className="cui-s-word"><b>UGC</b>ad.io</span>
            <span className="cui-s-tag">FOR CREATORS</span>
          </div>
          <div>
            <div className="cui-s-promo-t">Make videos for brands.<br />Get paid.</div>
            <p className="cui-s-promo-p">Brands post real projects. You apply, create, and get paid - no outreach needed.</p>
          </div>
          <ul>
            <li><i><Check size={14} /></i>Brands post real briefs you can apply to</li>
            <li><i><Check size={14} /></i>Payment is held safely while you create</li>
            <li><i><Check size={14} /></i>Withdraw your earnings to UPI or bank</li>
          </ul>
        </aside>

        <main className="cui-s-formside">
          <button className="cui-s-back" type="button" onClick={() => navigate('/creator')} aria-label="Back">
            <ArrowLeft size={18} />
          </button>

          <form className="cui-s-form" onSubmit={handleSubmit}>
            <div className="cui-s-mlogo">
              <span className="cui-s-brand" style={{ cursor: 'default', color: '#07074e' }}>
                <span className="cui-s-mark" aria-hidden="true" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/ugcad-logo.png)` }} />
                <span className="cui-s-word"><b>UGC</b>ad.io</span>
              </span>
            </div>
            <h1>Create your creator account</h1>
            <p className="cui-s-lead">Free to join. Takes a few minutes.</p>

            <div className="cui-s-roles">
              <button type="button" className="cui-s-role" onClick={() => navigate('/auth?mode=signup&role=business')}>
                <b>I’m a brand</b><small>I want videos</small>
              </button>
              <button type="button" className="cui-s-role is-on" aria-pressed="true">
                <b>I’m a creator</b><small>I make videos</small>
              </button>
            </div>

            <button type="button" className="cui-s-google" onClick={handleGoogle}>
              <GoogleIcon /> Sign up with Google
            </button>
            <div className="cui-s-or">or</div>

            <div className="cui-s-field">
              <label className="cui-s-label" htmlFor="cs-email">Email</label>
              <div className="cui-s-inp">
                <Mail size={18} />
                <input
                  id="cs-email"
                  type="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Mobile number - required, no OTP */}
            <div className="cui-s-field">
              <label className="cui-s-label" htmlFor="cs-phone">Mobile number</label>
              <div className="cui-s-phone">
                <div className="cui-s-inp">
                  <select
                    value={dialCode}
                    onChange={(e) => {
                      const next = e.target.value;
                      setDialCode(next);
                      setPhone((cur) => normalisePhone(cur, next));
                    }}
                    aria-label="Country dial code"
                  >
                    {DIAL_CODES.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className={`cui-s-inp${phone && !phoneValid(phone, dialCode) ? ' is-error' : ''}`}>
                  <Phone size={18} />
                  <input
                    id="cs-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    maxLength={phoneMax(dialCode)}
                    placeholder={`${phoneMax(dialCode)}-digit number`}
                    value={phone}
                    onChange={(e) => setPhone(normalisePhone(e.target.value, dialCode))}
                    required
                  />
                </div>
              </div>
              {phone && !phoneValid(phone, dialCode) && (
                <p className="cui-s-err">Enter a valid {phoneMax(dialCode)}-digit mobile number.</p>
              )}
            </div>

            <div className="cui-s-field">
              <label className="cui-s-label" htmlFor="cs-password">Password</label>
              <div className="cui-s-inp">
                <Lock size={18} />
                <input
                  id="cs-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
                <button
                  type="button"
                  className="cui-s-eye"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="cui-s-hint">Must be at least 8 characters</p>
            </div>

            <button type="submit" className="cui-s-btn cui-s-btn--ink cui-s-btn--block" style={{ height: 52 }} disabled={submitting}>
              {submitting ? 'Creating account…' : 'Create account'}
            </button>

            <p className="cui-s-foot-l">
              Already on UGCad?{' '}
              <button type="button" onClick={() => navigate('/auth?role=creator')}>Log in</button>
            </p>
          </form>
        </main>
      </div>
    </div>
  );
}
