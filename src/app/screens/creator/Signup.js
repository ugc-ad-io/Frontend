import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Eye, EyeOff, ChevronLeft, Mail, Phone, Lock } from 'lucide-react';
import { useAuth } from '../../../App';
import { apiErrorMessage } from '../../../utils/apiError';
import '../../shell/app-shell.css';
import './onboarding.css';

const API = `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api`;

// Mobile number is compulsory at signup: collected and stored, never OTP-verified (same rules as /auth and the website).
const DIAL_CODES = ['+91', '+1', '+44', '+61'];
const PHONE_LEN = { '+91': 10, '+1': 10, '+44': 10, '+61': 9 };
const onlyDigits = (v) => String(v ?? '').replace(/\D/g, '');
const phoneMax = (dial) => PHONE_LEN[dial] || 15;
const phoneValid = (v, dial) => onlyDigits(v).length === phoneMax(dial);
// Drop a pasted country code, but only when the number is otherwise too long.
const normalisePhone = (raw, dial) => {
  const digits = onlyDigits(raw);
  const cc = onlyDigits(dial);
  const max = phoneMax(dial);
  const national = digits.length > max && cc && digits.startsWith(cc) ? digits.slice(cc.length) : digits;
  return national.slice(0, max);
};

/**
 * Public screen (no logged-in user), so it does NOT use <AppShell>: the shell's bell, avatar and
 * "Log out" menu make no sense before an account exists. It reuses the shell's page background instead.
 */
export default function CreatorSignup() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [dialCode, setDialCode] = useState('+91');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    // `required` only catches an empty field: a half-typed number needs this.
    if (!phoneValid(phone, dialCode)) { toast.error(`Enter a valid ${phoneMax(dialCode)}-digit mobile number`); return; }
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
      toast.error(error?.response ? apiErrorMessage(error, 'Signup failed') : "You're offline. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const badPhone = phone && !phoneValid(phone, dialCode);

  return (
    <div className="ap-shell ap-shell--light ap-ob-pub">
      <header className="ap-ob-pubbar">
        <button type="button" className="ap-bar-btn" aria-label="Back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/auth'))}><ChevronLeft size={24} /></button>
        <div className="ap-ob-brand">
          <span className="ap-logo-mark" aria-hidden="true" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/ugcad-logo.png)` }} />
          <span><b>UGC</b>ad.io</span>
          <small>FOR CREATORS</small>
        </div>
      </header>

      <form className="ap-ob-pubbody" onSubmit={handleSubmit}>
        <h1>Create your creator account</h1>
        <p className="ap-ob-lead">Free to join. Takes a few minutes.</p>

        <div className="ap-ob-roles" role="group" aria-label="Account type">
          <button type="button" className="ap-ob-role" onClick={() => navigate('/auth?mode=signup&role=business')}><b>I’m a brand</b><small>I want videos</small></button>
          <button type="button" className="ap-ob-role on" aria-pressed="true"><b>I’m a creator</b><small>I make videos</small></button>
        </div>

        <div className="ap-card ap-ob-card">
          <div className="ap-ob-f">
            <label htmlFor="cs-email">Email</label>
            <div className="ap-ob-ico">
              <Mail size={18} />
              <input id="cs-email" className="ap-ob-in" type="email" autoComplete="email" autoCapitalize="none" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>

          <div className="ap-ob-f">
            <label htmlFor="cs-phone">Mobile number</label>
            <div className="ap-ob-phone">
              <select
                className="ap-ob-in"
                value={dialCode}
                aria-label="Country dial code"
                onChange={(e) => { const next = e.target.value; setDialCode(next); setPhone((cur) => normalisePhone(cur, next)); }}
              >
                {DIAL_CODES.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
              <div className="ap-ob-ico">
                <Phone size={18} />
                <input id="cs-phone" className={`ap-ob-in${badPhone ? ' is-error' : ''}`} type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={phoneMax(dialCode)} placeholder={`${phoneMax(dialCode)}-digit number`} value={phone} onChange={(e) => setPhone(normalisePhone(e.target.value, dialCode))} required />
              </div>
            </div>
            {badPhone ? <span className="ap-ob-err">Enter a valid {phoneMax(dialCode)}-digit mobile number.</span> : <span className="ap-ob-hint">Brands never see your number.</span>}
          </div>

          <div className="ap-ob-f">
            <label htmlFor="cs-password">Password</label>
            <div className="ap-ob-ico" style={{ position: 'relative' }}>
              <Lock size={18} />
              <input id="cs-password" className="ap-ob-in" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
              <button type="button" className="ap-ob-eye" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <span className="ap-ob-hint">Must be at least 8 characters</span>
          </div>
        </div>

        <button type="submit" className="ap-btn ap-btn--block" style={{ height: 52, fontSize: 16 }} disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>

        <p className="ap-ob-foot-l">
          Already on UGCad?{' '}
          <button type="button" onClick={() => navigate('/auth?role=creator')}>Log in</button>
        </p>
      </form>
    </div>
  );
}
