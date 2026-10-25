import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, Eye, EyeOff, Check, Mail, KeyRound, ShieldCheck, WifiOff } from 'lucide-react';
import { useAuth } from '../../../App';
import { apiErrorMessage } from '../../../utils/apiError';
import AppShell from '../../shell/AppShell';
import './auth.css';

// Phone version of src/pages/Auth.js (route /auth). Same endpoints, validation and redirects.
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

const DIAL_CODES = ['+91', '+1', '+44', '+61'];
const PHONE_LEN = { '+91': 10, '+1': 10, '+44': 10, '+61': 9 };
const onlyDigits = (v) => String(v ?? '').replace(/\D/g, '');
const phoneMax = (dial) => PHONE_LEN[dial] || 15;
const phoneValid = (v, dial) => onlyDigits(v).length === phoneMax(dial);
// A pasted "+91 9406879532" must not merge the country code into the number (only dropped when too long).
const normalisePhone = (raw, dial) => {
  const digits = onlyDigits(raw);
  const cc = onlyDigits(dial);
  const max = phoneMax(dial);
  const national = digits.length > max && cc && digits.startsWith(cc) ? digits.slice(cc.length) : digits;
  return national.slice(0, max);
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

let gisScriptPromise = null;
function loadGoogleScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gisScriptPromise) return gisScriptPromise;
  gisScriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Failed to load Google Sign-In'));
    document.head.appendChild(s);
  });
  return gisScriptPromise;
}

// `?next=/page` (set by ProtectedRoute) returns the user to the page they were opening; in-app absolute paths only.
const safeNext = (raw) => (typeof raw === 'string' && /^\/(?![/\\])/.test(raw) && !raw.startsWith('/auth') ? raw : null);

function routeForUser(navigate, role, profileCompleted, next) {
  if (!profileCompleted) {
    if (role === 'creator') return navigate('/profile-setup/creator');
    if (role === 'business') return navigate('/profile-setup/business');
  }
  if (next) return navigate(next, { replace: true });
  if (role === 'creator') return navigate('/dashboard/creator');
  if (role === 'business') return navigate('/dashboard/business/browse-creator');
  if (['admin', 'campaign_manager', 'support_staff'].includes(role)) return navigate('/dashboard/admin');
  return navigate('/');
}

const PROMO = {
  creator: {
    title: 'Make videos for brands. Get paid.',
    text: 'Brands post real projects. You apply, create and get paid - no outreach needed.',
    list: ['Brands post real briefs you can apply to', 'Payment is held safely while you create', 'Withdraw your earnings to UPI or bank'],
  },
  business: {
    title: 'Real creators. Real videos. Ready in days.',
    text: 'Vetted creators make UGC videos for D2C brands. Post a campaign, get matched with the right talent.',
    list: ['Every creator checked by our team', 'Money held in escrow until you approve', 'Fast turnaround on first videos'],
  },
};

const authError = (error, fallback) => (error?.response
  ? apiErrorMessage(error, fallback)
  : "You're offline or the server is not responding. Check your connection and try again.");

function useOnline() {
  const [on, setOn] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  useEffect(() => {
    const up = () => setOn(true);
    const down = () => setOn(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => { window.removeEventListener('online', up); window.removeEventListener('offline', down); };
  }, []);
  return on;
}

function Field({ id, label, error, hint, children }) {
  return (
    <div className="ap-auth-field">
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? <span className="ap-auth-err" role="alert">{error}</span> : hint ? <span className="ap-auth-hint">{hint}</span> : null}
    </div>
  );
}

function PasswordBox({ id, value, onChange, show, onToggle, bad, placeholder, autoComplete, autoFocus }) {
  return (
    <span className={`ap-auth-box${bad ? ' is-bad' : ''}`}>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder || '••••••••'}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        data-testid={`${id}-input`}
      />
      <button type="button" className="eye" onClick={onToggle} aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </span>
  );
}

export default function Auth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const online = useOnline();
  const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'signup');
  const [role, setRole] = useState(searchParams.get('role') === 'business' ? 'business' : 'creator');
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [dialCode, setDialCode] = useState('+91');
  const [loading, setLoading] = useState(false);
  const [tried, setTried] = useState(false);
  const [view, setView] = useState(searchParams.get('view') === 'reset' ? 'reset' : 'auth'); // auth | forgot | reset | newpass | 2fa
  const [resetCode, setResetCode] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState({});
  const togglePass = (key) => setShowPass((s) => ({ ...s, [key]: !s[key] }));
  const nextPath = safeNext(searchParams.get('next'));
  const creatorMode = role === 'creator' && (searchParams.get('role') === 'creator' || !isLogin);
  const promo = PROMO[creatorMode ? 'creator' : 'business'];

  // Opening /auth with a valid session goes straight to the user's home (only if a token was there on arrival).
  const hadTokenOnArrival = useRef(!!localStorage.getItem('token'));
  useEffect(() => {
    if (hadTokenOnArrival.current && user && !searchParams.get('view')) {
      routeForUser(navigate, user.role, user.profile_completed, nextPath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const googleBtnRef = useRef(null);
  const roleRef = useRef(role);
  useEffect(() => { roleRef.current = role; }, [role]);
  const googleCredRef = useRef(null);

  const handleGoogleCredential = async (response) => {
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/auth/google`, { credential: response.credential, role: roleRef.current });
      if (data.requires_2fa) {
        googleCredRef.current = response.credential;
        setTotpCode('');
        setView('2fa');
        return;
      }
      const { token, ...userData } = data;
      login(token, userData);
      toast.success('Signed in with Google');
      routeForUser(navigate, userData.role, userData.profile_completed, nextPath);
    } catch (error) {
      toast.error(authError(error, 'Google sign-in failed'));
    } finally {
      setLoading(false);
    }
  };
  const googleCbRef = useRef(handleGoogleCredential);
  googleCbRef.current = handleGoogleCredential;

  // The Google button lives in the auth view only; (re)draw it whenever that view shows.
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || view !== 'auth') return undefined;
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !googleBtnRef.current) return;
        window.google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: (r) => googleCbRef.current(r) });
        googleBtnRef.current.innerHTML = '';
        const avail = googleBtnRef.current.offsetWidth || 320;
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline', size: 'large', width: Math.round(Math.max(200, Math.min(400, avail))), text: 'continue_with', logo_alignment: 'center',
        });
      })
      .catch(() => { /* offline / blocked: email login still works */ });
    return () => { cancelled = true; };
  }, [view, isLogin]);

  const errors = {
    email: !email.trim() ? 'Enter your email.' : !EMAIL_RE.test(email.trim()) ? 'Enter a valid email address.' : '',
    password: !password ? 'Enter your password.' : (!isLogin && password.length < 6 ? 'Password must be at least 6 characters.' : ''),
    phone: !isLogin && !phoneValid(phone, dialCode) ? `Enter a valid ${phoneMax(dialCode)}-digit mobile number.` : '',
  };
  const showErr = (k) => (tried ? errors[k] : (k === 'phone' && phone ? errors.phone : ''));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setTried(true);
    if (errors.email || errors.password || errors.phone) {
      toast.error(errors.phone || errors.email || errors.password);
      return;
    }
    setLoading(true);
    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/signup';
      const payload = isLogin
        ? { email, password }
        : { email, password, role, phone: onlyDigits(phone), dial_code: dialCode };
      const { data } = await axios.post(`${API}${endpoint}`, payload);
      if (isLogin && data.requires_2fa) {
        googleCredRef.current = null;
        setTotpCode('');
        setView('2fa');
        return;
      }
      const { token, ...userData } = data;
      login(token, userData);
      toast.success(isLogin ? 'Welcome back!' : 'Account created successfully!');
      if (!isLogin) navigate(role === 'creator' ? '/profile-setup/creator' : '/profile-setup/business');
      else routeForUser(navigate, userData.role, userData.profile_completed, nextPath);
    } catch (error) {
      toast.error(authError(error, 'Authentication failed'));
    } finally {
      setLoading(false);
    }
  };

  const handle2FASubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (totpCode.length !== 6) { toast.error('Enter the 6-digit code'); return; }
    setLoading(true);
    try {
      const q = `?totp_token=${encodeURIComponent(totpCode)}`;
      const { data } = googleCredRef.current
        ? await axios.post(`${API}/auth/google${q}`, { credential: googleCredRef.current, role: roleRef.current })
        : await axios.post(`${API}/auth/login${q}`, { email, password });
      const { token, ...userData } = data;
      googleCredRef.current = null;
      login(token, userData);
      toast.success('Welcome back!');
      routeForUser(navigate, userData.role, userData.profile_completed, nextPath);
    } catch (error) {
      toast.error(authError(error, 'Invalid 2FA code'));
    } finally {
      setLoading(false);
    }
  };

  const goToForgot = () => { setResetCode(''); setNewPassword(''); setConfirmPassword(''); setTried(false); setView('forgot'); };
  const backToLogin = () => { setIsLogin(true); setTried(false); setView('auth'); };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setTried(true);
    if (errors.email) { toast.error(errors.email); return; }
    setLoading(true);
    try {
      await axios.post(`${API}/auth/forgot-password`, { email });
      toast.success('Code sent');
      setTried(false);
      setView('reset');
    } catch (error) {
      toast.error(authError(error, 'Could not send reset code'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (resetCode.length !== 6) { toast.error('Enter the 6-digit code'); return; }
    setLoading(true);
    try {
      await axios.post(`${API}/auth/verify-reset-code`, { email, code: resetCode });
      setView('newpass');
    } catch (error) {
      toast.error(authError(error, 'Invalid or expired reset code'));
    } finally {
      setLoading(false);
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setTried(true);
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    if (newPassword !== confirmPassword) { toast.error('Passwords do not match'); return; }
    setLoading(true);
    try {
      await axios.post(`${API}/auth/reset-password`, { email, code: resetCode, password: newPassword });
      setResetCode(''); setNewPassword(''); setConfirmPassword(''); setPassword('');
      setIsLogin(true); setTried(false); setView('auth');
      toast.success('Password reset - please sign in with your new password.');
    } catch (error) {
      toast.error(authError(error, 'Could not reset password'));
    } finally {
      setLoading(false);
    }
  };

  const spin = <span className="ap-auth-spin" aria-label="Please wait" />;
  const emailErr = showErr('email');
  const passErr = showErr('password');

  const emailField = (id, label) => (
    <Field id={id} label={label} error={emailErr}>
      <span className={`ap-auth-box${emailErr ? ' is-bad' : ''}`}>
        <input
          id={id} type="email" inputMode="email" autoComplete="email" autoCapitalize="none"
          value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your@email.com" data-testid="email-input"
        />
      </span>
    </Field>
  );

  const SubTop = ({ title, onBack }) => (
    <div className="ap-auth-top">
      <button type="button" className="ap-auth-back" onClick={onBack} aria-label="Back"><ArrowLeft size={20} /></button>
      <h1>{title}</h1>
    </div>
  );
  const Head = ({ icon: Icon, title, text }) => (
    <div className="ap-auth-head">
      <span className="ic"><Icon size={28} /></span>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
  const BackLinks = ({ extra }) => (
    <div className="ap-auth-foot">
      {extra}
      <button type="button" onClick={backToLogin}>Back to log in</button>
    </div>
  );

  let body;
  if (view === 'forgot') {
    body = (
      <>
        <SubTop title="Forgot password" onBack={backToLogin} />
        <form className="ap-auth-main" onSubmit={handleForgotSubmit} noValidate>
          <Head icon={Mail} title="Reset your password" text="Enter your email and we'll send you a 6-digit reset code." />
          <div className="ap-auth-pad">
            {emailField('forgot-email', 'Email')}
            <button type="submit" className="ap-auth-cta" disabled={loading} data-testid="forgot-submit-btn">{loading ? spin : 'Send code'}</button>
          </div>
          <BackLinks />
        </form>
      </>
    );
  } else if (view === 'reset') {
    body = (
      <>
        <SubTop title="Enter your code" onBack={() => setView('forgot')} />
        <form className="ap-auth-main" onSubmit={handleVerifyCode} noValidate>
          <Head icon={KeyRound} title="Check your email" text={email ? `Enter the 6-digit code we emailed to ${email}` : 'Enter the 6-digit code we emailed you'} />
          <div className="ap-auth-pad">
            <Field id="reset-code" label="Code from your email">
              <span className="ap-auth-box">
                <input
                  id="reset-code" className="ap-auth-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                  value={resetCode} onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))} placeholder="------" autoFocus data-testid="reset-code-input"
                />
              </span>
            </Field>
            <button type="submit" className="ap-auth-cta" disabled={loading} data-testid="verify-code-btn">{loading ? spin : 'Verify code'}</button>
          </div>
          <BackLinks extra={<><button type="button" onClick={goToForgot}>Resend code</button>{' · '}</>} />
        </form>
      </>
    );
  } else if (view === 'newpass') {
    body = (
      <>
        <SubTop title="New password" onBack={() => setView('reset')} />
        <form className="ap-auth-main" onSubmit={handleResetSubmit} noValidate>
          <Head icon={ShieldCheck} title="New password" text="Choose a new password for your account." />
          <div className="ap-auth-pad">
            <Field id="new-password" label="New password" error={tried && newPassword.length < 6 ? 'Password must be at least 6 characters.' : ''}>
              <PasswordBox id="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} show={showPass.newPass} onToggle={() => togglePass('newPass')} placeholder="At least 6 characters" autoComplete="new-password" autoFocus />
            </Field>
            <Field id="confirm-password" label="Confirm password" error={tried && confirmPassword && newPassword !== confirmPassword ? 'Passwords do not match.' : ''}>
              <PasswordBox id="confirm-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} show={showPass.confirm} onToggle={() => togglePass('confirm')} placeholder="Re-enter new password" autoComplete="new-password" />
            </Field>
            <button type="submit" className="ap-auth-cta" disabled={loading} data-testid="reset-submit-btn">{loading ? spin : 'Save new password'}</button>
          </div>
          <BackLinks />
        </form>
      </>
    );
  } else if (view === '2fa') {
    body = (
      <>
        <SubTop title="Two-step login" onBack={() => { setView('auth'); setTotpCode(''); googleCredRef.current = null; }} />
        <form className="ap-auth-main" onSubmit={handle2FASubmit} noValidate>
          <Head icon={ShieldCheck} title="Two-step login" text="Enter the 6-digit code from your authenticator app." />
          <div className="ap-auth-pad">
            <Field id="totp-code" label="Two-factor code">
              <span className="ap-auth-box">
                <input
                  id="totp-code" className="ap-auth-code" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                  value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))} placeholder="------" autoFocus
                />
              </span>
            </Field>
            <button type="submit" className="ap-auth-cta" disabled={loading}>{loading ? spin : 'Verify & sign in'}</button>
          </div>
          <BackLinks />
        </form>
      </>
    );
  } else {
    const google = GOOGLE_CLIENT_ID ? (
      <>
        <div ref={googleBtnRef} className="ap-auth-google" />
        <div className="ap-auth-or">or</div>
      </>
    ) : null;
    const passwordField = (
      <Field id="password" label="Password" error={passErr}>
        <PasswordBox
          id="password" value={password} onChange={(e) => setPassword(e.target.value)} bad={!!passErr}
          show={showPass.login} onToggle={() => togglePass('login')} autoComplete={isLogin ? 'current-password' : 'new-password'}
        />
      </Field>
    );
    body = isLogin ? (
      <>
        <header className="ap-auth-hero">
          <div className="ap-auth-brand">
            <span className="ap-logo-mark ap-auth-logo" aria-hidden="true" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/ugcad-logo.png)` }} />
            <span><b>UGC</b>ad.io</span>
            {creatorMode && <span className="ap-auth-tag">FOR CREATORS</span>}
          </div>
          <h1 className="ap-auth-h1">{promo.title}</h1>
          <p className="ap-auth-sub">{creatorMode ? 'Log in to see your briefs, orders and money.' : promo.text}</p>
          <ul className="ap-auth-list">
            {promo.list.map((t) => <li key={t}><i><Check size={12} /></i>{t}</li>)}
          </ul>
        </header>
        <form className="ap-auth-main" onSubmit={handleSubmit} noValidate>
          <div className="ap-auth-seg" role="tablist">
            <button type="button" role="tab" aria-selected className="is-on">Log in</button>
            <button type="button" role="tab" aria-selected={false} onClick={() => { setIsLogin(false); setTried(false); }}>Sign up</button>
          </div>
          <div className="ap-auth-pad">
            {google}
            {emailField('email', 'Email')}
            {passwordField}
            <button type="button" className="ap-auth-link" onClick={goToForgot} data-testid="forgot-password-btn">Forgot password?</button>
            <button type="submit" className="ap-auth-cta" disabled={loading} data-testid="submit-btn">{loading ? spin : 'Log in'}</button>
          </div>
          <div className="ap-auth-foot">
            Don&apos;t have an account?{' '}
            <button type="button" onClick={() => { setIsLogin(false); setTried(false); }} data-testid="toggle-auth-btn">Sign up</button>
          </div>
        </form>
      </>
    ) : (
      <>
        <SubTop title="Create account" onBack={backToLogin} />
        <form className="ap-auth-main" onSubmit={handleSubmit} noValidate>
          <div className="ap-auth-roles" data-testid="role-selector">
            <button type="button" className={`ap-auth-role${role === 'business' ? ' is-on' : ''}`} onClick={() => setRole('business')} data-testid="role-business-btn">
              <strong>I&apos;m a brand</strong><small>I want videos</small>
            </button>
            <button type="button" className={`ap-auth-role${role === 'creator' ? ' is-on' : ''}`} onClick={() => setRole('creator')} data-testid="role-creator-btn">
              <strong>I&apos;m a creator</strong><small>I make videos</small>
            </button>
          </div>
          <div className="ap-auth-pad">
            {google}
            {emailField('email', 'Work email')}
            <div className="ap-auth-phone">
              <Field id="dial" label="Code">
                <span className="ap-auth-box">
                  <select
                    id="dial" value={dialCode} aria-label="Country dial code" data-testid="dial-code-select"
                    onChange={(e) => { const next = e.target.value; setDialCode(next); setPhone((cur) => normalisePhone(cur, next)); }}
                  >
                    {DIAL_CODES.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </span>
              </Field>
              <Field id="phone" label="Mobile" error={showErr('phone')}>
                <span className={`ap-auth-box${showErr('phone') ? ' is-bad' : ''}`}>
                  <input
                    id="phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={phoneMax(dialCode)}
                    value={phone} onChange={(e) => setPhone(normalisePhone(e.target.value, dialCode))}
                    placeholder={`${phoneMax(dialCode)}-digit number`} data-testid="phone-input"
                  />
                </span>
              </Field>
            </div>
            {passwordField}
          </div>
          <p className="ap-auth-legal">
            By creating an account you agree to our <a href="/terms" target="_blank" rel="noreferrer">Terms</a>,{' '}
            <a href="/privacy-policy" target="_blank" rel="noreferrer">Privacy Policy</a> and{' '}
            <a href="/community-guidelines" target="_blank" rel="noreferrer">Community Guidelines</a>.
          </p>
          <div className="ap-auth-foot">
            Already have an account? <button type="button" onClick={backToLogin} data-testid="toggle-auth-btn">Log in</button>
          </div>
          <div className="ap-auth-sticky">
            <button type="submit" className="ap-auth-cta" disabled={loading} data-testid="submit-btn">{loading ? spin : 'Create account'}</button>
            <small>Free to join. Takes 2 minutes.</small>
          </div>
        </form>
      </>
    );
  }

  return (
    <AppShell tabs={false} bare className="ap-auth">
      <div className="ap-auth-page">
        {!online && (
          <div className="ap-auth-offline" role="status"><WifiOff size={14} style={{ verticalAlign: -2 }} /> You&apos;re offline. Reconnect to continue.</div>
        )}
        {body}
      </div>
    </AppShell>
  );
}
