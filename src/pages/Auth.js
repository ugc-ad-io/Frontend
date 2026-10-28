import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { ArrowLeft, Eye, EyeOff, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/brand-ui.css';
import '../styles/brand-ui-auth.css';
import '../styles/brand-ui-mobile-b.css';
import '../styles/creator-ui-onboarding.css';
import AuthReels from '../components/AuthReels';
import NativeSocialButtons from '../components/NativeSocialButtons';
import { isShell } from '../utils/nativeBridge';
import { nativeGoogleCredential, nativeAppleBody } from '../utils/shellAuth';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

// Mobile number at signup — collected and stored, NOT OTP-verified. `iso` drives
// the flag image (flagcdn.com); emoji flags don't render on Windows.
const DIAL_CODES = [
  { code: '+91', iso: 'in' },
  { code: '+1', iso: 'us' },
  { code: '+44', iso: 'gb' },
  { code: '+61', iso: 'au' },
];
// Expected national-number length per dial code — caps the input AND validates it.
// Same table the creator profile-setup form uses, so a number accepted here is
// still valid when it prefills that step.
const PHONE_LEN = { '+91': 10, '+1': 10, '+44': 10, '+61': 9 };
const onlyDigits = (v) => String(v ?? '').replace(/\D/g, '');
const phoneMax = (dial) => PHONE_LEN[dial] || 15;
const phoneValid = (v, dial) => onlyDigits(v).length === phoneMax(dial);
// Pasting a full international number ("+91 9406879532") would otherwise merge the
// country code into the national part. Drop a leading dial code, but ONLY when the
// result is too long — so a legitimate 10-digit number starting with "91" survives.
const normalisePhone = (raw, dial) => {
  const digits = onlyDigits(raw);
  const cc = onlyDigits(dial);
  const max = phoneMax(dial);
  const national = digits.length > max && cc && digits.startsWith(cc) ? digits.slice(cc.length) : digits;
  return national.slice(0, max);
};

// Load the Google Identity Services script once, shared across renders/mounts.
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

// Route a freshly-authenticated user by role + onboarding state.
// `?next=/some/page` (set by ProtectedRoute) returns the user to the page they were opening.
// Only an in-app absolute path is honoured, so it can never be used as an open redirect.
const safeNext = (raw) => (typeof raw === 'string' && /^\/(?![/\\])/.test(raw) && !raw.startsWith('/auth') ? raw : null);

function routeForUser(navigate, role, profileCompleted, next) {
  if (!profileCompleted) {
    if (role === 'creator') return navigate('/profile-setup/creator');
    if (role === 'business') return navigate('/profile-setup/business');
  }
  if (next) return navigate(next, { replace: true });
  if (role === 'creator') return navigate('/dashboard/creator');
  if (role === 'business') return navigate('/brand-home');
  // campaign managers and support staff use the admin dashboard too (same list as homeForUser in App.js)
  if (['admin', 'campaign_manager', 'support_staff'].includes(role)) return navigate('/dashboard/admin');
  return navigate('/');
}

// Left story panel copy. Creators (board C11) get the creator wording; brands keep theirs.
const PROMO = {
  creator: {
    title: 'Make videos for brands. Get paid.',
    text: 'Brands post real projects. You apply, create and get paid - no outreach needed.',
    list: ['Brands post real briefs you can apply to', 'Payment is held safely while you create', 'Withdraw your earnings to UPI or bank'],
  },
  business: {
    title: 'Real creators. Real videos. Ready in days.',
    text: 'Vetted creators make UGC videos for D2C brands. Post a campaign, get matched with the right talent, and turn real content into results.',
    list: ['Every creator checked by our team', 'Money held in escrow until you approve', 'Fast turnaround on first videos'],
  },
};

// A request that never got an answer (offline, server down) says so, instead of axios' bare "Network Error".
const authError = (error, fallback) => (error?.response
  ? apiErrorMessage(error, fallback)
  : "You're offline or the server is not responding. Check your connection and try again.");

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'signup');
  const [role, setRole] = useState(searchParams.get('role') === 'business' ? 'business' : 'creator');
  // Deep-link straight into code entry: the reset-code email links here as
  // ?view=reset&email=…, so a team member lands on "enter code + new password"
  // instead of the sign-in box (where their old password still works).
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [password, setPassword] = useState('');
  // Signup-only: mobile number + its dial code. Required, never OTP-verified.
  const [phone, setPhone] = useState('');
  const [dialCode, setDialCode] = useState('+91');
  const [loading, setLoading] = useState(false);
  // Sign-up needs an explicit tick for the Terms + Privacy Policy (sent to the backend as terms_accepted).
  const [agree, setAgree] = useState(false);
  const navigate = useNavigate();
  const { login, user } = useAuth();
  const nextPath = safeNext(searchParams.get('next'));
  // Creator look: arrived via a creator link (?role=creator) or picked Creator while signing up.
  const creatorMode = role === 'creator' && (searchParams.get('role') === 'creator' || !isLogin);
  const promo = PROMO[creatorMode ? 'creator' : 'business'];

  // Opening /auth while a valid session already exists (installed app, bookmarked sign-in
  // link) goes straight to the user's home. Only when a token was present on arrival, so it
  // never races the sign-in/sign-up submit below, which routes by itself.
  const hadTokenOnArrival = useRef(!!localStorage.getItem('token'));
  useEffect(() => {
    if (hadTokenOnArrival.current && user && !searchParams.get('view')) {
      routeForUser(navigate, user.role, user.profile_completed, nextPath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Password-reset flow: 'auth' (sign in / sign up) → 'forgot' (request a code)
  // → 'reset' (enter the emailed code + a new password). ?view=reset (from the
  // reset-code email) jumps straight to the code-entry step.
  const [view, setView] = useState(searchParams.get('view') === 'reset' ? 'reset' : 'auth');
  const [resetCode, setResetCode] = useState('');
  const [totpCode, setTotpCode] = useState('');   // 2FA code at login
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Per-field password visibility (show/hide eye toggle).
  const [showPass, setShowPass] = useState({});
  const togglePass = (key) => setShowPass((s) => ({ ...s, [key]: !s[key] }));

  // Google button target + a ref mirroring the selected role, so the GIS
  // callback (created once) always reads the latest signup role choice.
  const googleBtnRef = useRef(null);
  const roleRef = useRef(role);
  useEffect(() => { roleRef.current = role; }, [role]);
  // Google/Apple request held while the 2FA step is open: they prove identity, not the second factor, so the
  // backend answers {requires_2fa} and we retry the same body with ?totp_token=.  { provider, body }
  const socialRef = useRef(null);

  // Exchange the Google credential for our own JWT via the backend.
  const socialLogin = async (provider, body, label) => {
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/auth/${provider}`, body);
      if (data.requires_2fa) {
        socialRef.current = { provider, body };
        setTotpCode('');
        setView('2fa');
        return;
      }
      const { token, ...userData } = data;
      login(token, userData);
      toast.success(`Signed in with ${label}`);
      routeForUser(navigate, userData.role, userData.profile_completed, nextPath);
    } catch (error) {
      toast.error(authError(error, `${label} sign-in failed`));
    } finally {
      setLoading(false);
    }
  };
  const handleGoogleCredential = (response) => socialLogin('google', { credential: response.credential, role: roleRef.current }, 'Google');

  // Sign-up: every social button first needs the Terms/Privacy tick.
  const consentOk = () => {
    if (isLogin || agree) return true;
    toast.error('Please tick "I agree to the Terms and Privacy Policy" first');
    return false;
  };
  // Mobile shell: Google/Apple run natively (Google blocks its web button inside WebViews). Apple: iOS only.
  const handleNativeGoogle = async () => {
    if (loading || !consentOk()) return;
    const r = await nativeGoogleCredential();
    if (r.cancelled) return;
    if (r.error) { toast.error(r.error); return; }
    await handleGoogleCredential({ credential: r.credential });
  };
  const handleNativeApple = async () => {
    if (loading || !consentOk()) return;
    const r = await nativeAppleBody(roleRef.current);
    if (r.cancelled) return;
    if (r.error) { toast.error(r.error); return; }
    await socialLogin('apple', r.body, 'Apple');
  };
  const inShell = isShell();

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || inShell) return; // not configured (or the shell's native button is used) — web button won't render
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !googleBtnRef.current) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredential
        });
        googleBtnRef.current.innerHTML = '';
        // Google renders a FIXED-PIXEL button — it does not respond to CSS width, so a
        // hardcoded 320 overflowed the card on small phones (a 360px viewport leaves the
        // form column only ~304px) and got clipped by .ap-shell's overflow:hidden.
        // Measure what the container actually offers instead. Google clamps this to
        // 200..400 internally, so match that range rather than passing something it will
        // silently ignore.
        const avail = googleBtnRef.current.offsetWidth || 320;
        const btnWidth = Math.round(Math.max(200, Math.min(400, avail)));
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          width: btnWidth,
          text: 'continue_with',
          logo_alignment: 'center'
        });
      })
      .catch(() => { /* offline / blocked — email login still works */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    // Signup requires a valid mobile number. `required` on the input only catches
    // an empty field — a half-typed number would still submit without this.
    if (!isLogin && !phoneValid(phone, dialCode)) {
      toast.error(`Enter a valid ${phoneMax(dialCode)}-digit mobile number`);
      return;
    }

    if (!isLogin && password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (!isLogin && !agree) {
      toast.error('Please tick "I agree to the Terms and Privacy Policy" to create your account');
      return;
    }

    setLoading(true);

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/signup';
      const payload = isLogin
        ? { email, password }
        : { email, password, role, phone: onlyDigits(phone), dial_code: dialCode, terms_accepted: true };

      const { data } = await axios.post(`${API}${endpoint}`, payload);

      // Login may require a second factor — Python returns {requires_2fa:true} with no token.
      if (isLogin && data.requires_2fa) {
        socialRef.current = null;
        setTotpCode('');
        setView('2fa');
        return;
      }

      const { token, ...userData } = data;

      login(token, userData);
      toast.success(isLogin ? 'Welcome back!' : 'Account created successfully!');

      if (!isLogin) {
        // New signups always go straight to onboarding for their role.
        navigate(role === 'creator' ? '/profile-setup/creator' : '/profile-setup/business');
      } else {
        routeForUser(navigate, userData.role, userData.profile_completed, nextPath);
      }
    } catch (error) {
      toast.error(authError(error, 'Authentication failed'));
    } finally {
      setLoading(false);
    }
  };

  // Second-factor step: resend the login with the TOTP code (backend reads it as a query param).
  const handle2FASubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (totpCode.length !== 6) { toast.error('Enter the 6-digit code'); return; }
    setLoading(true);
    try {
      const q = `?totp_token=${encodeURIComponent(totpCode)}`;
      const { data } = socialRef.current
        ? await axios.post(`${API}/auth/${socialRef.current.provider}${q}`, socialRef.current.body)
        : await axios.post(`${API}/auth/login${q}`, { email, password });
      const { token, ...userData } = data;
      socialRef.current = null;
      login(token, userData);
      toast.success('Welcome back!');
      routeForUser(navigate, userData.role, userData.profile_completed, nextPath);
    } catch (error) {
      toast.error(authError(error, 'Invalid 2FA code'));
    } finally {
      setLoading(false);
    }
  };

  // Open the reset flow, carrying over whatever email was already typed.
  const goToForgot = () => {
    setResetCode('');
    setNewPassword('');
    setConfirmPassword('');
    setView('forgot');
  };

  // Back to sign in from the reset flow.
  const backToLogin = () => {
    setIsLogin(true);
    setView('auth');
  };

  // Step 1 — request a reset code for the entered email.
  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    try {
      await axios.post(`${API}/auth/forgot-password`, { email });
      toast.success('Code sent');
      setView('reset');
    } catch (error) {
      toast.error(authError(error, 'Could not send reset code'));
    } finally {
      setLoading(false);
    }
  };

  // Step 2 — verify the emailed code before revealing the new-password fields.
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (resetCode.length !== 6) {
      toast.error('Enter the 6-digit code');
      return;
    }
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

  // Step 3 — set the new password. The user is NOT auto-signed in: they are sent
  // back to the sign-in screen to log in with the new password.
  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API}/auth/reset-password`, {
        email,
        code: resetCode,
        password: newPassword
      });
      // Clear the reset state and drop back to sign-in with the email prefilled.
      setResetCode('');
      setNewPassword('');
      setConfirmPassword('');
      setPassword('');
      setIsLogin(true);
      setView('auth');
      toast.success('Password reset - please sign in with your new password.');
    } catch (error) {
      toast.error(authError(error, 'Could not reset password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bui-app ap-root">
      <div className={`ap-shell ${isLogin ? 'is-signin' : 'is-signup'} ${view !== 'auth' ? 'is-compact' : ''}${creatorMode ? ' ap-creator' : ''}`}>

      {/* ── LEFT: story panel (hidden under 900px) ── */}
      <aside className="ap-promo">
        <button type="button" className="ap-promo-logo" onClick={() => navigate('/')} aria-label="UGCad.io home">
          <span className="bui-logo-mark" aria-hidden="true" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/ugcad-logo.png)` }} />
          <span className="bui-logo-word"><b>UGC</b>ad.io</span>
          {creatorMode && <span className="ap-promo-tag">FOR CREATORS</span>}
        </button>
        <div className="ap-promo-body">
          <h2 className="ap-promo-title">{promo.title}</h2>
          <p className="ap-promo-text">{promo.text}</p>
          <ul className="ap-promo-list">
            {promo.list.map((t) => <li key={t}><i><Check size={15} /></i>{t}</li>)}
          </ul>
        </div>
        <AuthReels play />
      </aside>

      {/* ── RIGHT: the sign-in / sign-up / reset form ── */}
      <main className="ap-left">

      {/* Back button — arrow only, top-left */}
      <button className="ap-back" onClick={() => navigate('/')} aria-label="Back to home">
        <ArrowLeft size={18} />
      </button>

      <motion.div
        className="ap-card"
        initial={false}
      >
        {/* Logo (shown only when the story panel is hidden) */}
        <div className="ap-logo-wrap">
          <span className="bui-logo">
            <span className="bui-logo-mark" aria-hidden="true" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/ugcad-logo.png)` }} />
            <span className="bui-logo-word"><b>UGC</b>ad.io</span>
          </span>
        </div>

        {view === 'auth' && (
          <div className="ap-tabs" role="tablist">
            <button type="button" role="tab" aria-selected={isLogin} className={`ap-tab${isLogin ? ' is-on' : ''}`} onClick={() => setIsLogin(true)}>Log in</button>
            <button type="button" role="tab" aria-selected={!isLogin} className={`ap-tab${!isLogin ? ' is-on' : ''}`} onClick={() => setIsLogin(false)}>Sign up</button>
          </div>
        )}

        {/* Header */}
        <AnimatePresence mode="wait">
          <motion.div
            key={`${view}-${isLogin ? 'login' : 'signup'}-header`}
            className="ap-header"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <h1 className="ap-title">
              {view === 'forgot'
                ? 'Reset your password'
                : view === 'reset'
                ? 'Enter your code'
                : view === 'newpass'
                ? 'New password'
                : view === '2fa'
                ? 'Two-step login'
                : isLogin
                ? 'Welcome back'
                : 'Create your account'}
            </h1>
            <p className="ap-subtitle">
              {view === 'forgot'
                ? "Enter your email and we'll send you a 6-digit reset code."
                : view === 'reset'
                ? (email ? `Enter the 6-digit code we emailed to ${email}` : 'Enter the 6-digit code we emailed you')
                : view === 'newpass'
                ? 'Choose a new password for your account.'
                : view === '2fa'
                ? 'Enter the 6-digit code from your authenticator app.'
                : isLogin
                ? (creatorMode ? 'Log in to see your briefs, orders and money.' : 'Log in to your UGCad.io account.')
                : 'Free to join. Takes 2 minutes.'}
            </p>
          </motion.div>
        </AnimatePresence>

        {view === 'auth' && (
        <>
        {/* Google sign-in — only when a client id is configured; in the mobile shell: native Google (+ Apple on iOS) */}
        {(GOOGLE_CLIENT_ID || inShell) && (
          <motion.div
            className="ap-oauth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <div className={!isLogin && !agree ? 'ugc-consent-lock' : undefined}>
              {inShell
                ? <NativeSocialButtons onGoogle={handleNativeGoogle} onApple={handleNativeApple} busy={loading} />
                : <div ref={googleBtnRef} className="ap-google" />}
              {!isLogin && !agree && <div className="ugc-consent-cover" onClick={consentOk} role="presentation" />}
            </div>
            <div className="ap-divider"><span>or</span></div>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="ap-form">
          {/* Role selector — only on signup */}
          <AnimatePresence>
            {!isLogin && (
              <motion.div
                className="ap-role-wrap"
                data-testid="role-selector"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <span className="ap-label">I am a:</span>
                <div className="ap-role-options">
                  <button
                    type="button"
                    className={`ap-role-btn${role === 'business' ? ' active' : ''}`}
                    onClick={() => setRole('business')}
                    data-testid="role-business-btn"
                  >
                    <strong>Business</strong>
                    <small>I want videos</small>
                  </button>
                  <button
                    type="button"
                    className={`ap-role-btn${role === 'creator' ? ' active' : ''}`}
                    onClick={() => setRole('creator')}
                    data-testid="role-creator-btn"
                  >
                    <strong>Creator</strong>
                    <small>I make videos</small>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email */}
          <motion.div
            className="ap-field"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
          >
            <label className="ap-label" htmlFor="email">
              {isLogin ? 'Email' : 'Work email'}
            </label>
            <input
              id="email"
              autoComplete="email"
              autoCapitalize="none"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="ap-input"
              placeholder="your@email.com"
              required
              data-testid="email-input"
            />
          </motion.div>

          {/* Mobile number — signup only, required, no OTP */}
          <AnimatePresence>
            {!isLogin && (
              <motion.div
                className="ap-field"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
              >
                <label className="ap-label" htmlFor="phone">
                  Mobile number
                </label>
                <div className="ap-phone-row">
                  <select
                    className="ap-dial"
                    value={dialCode}
                    onChange={(e) => {
                      const next = e.target.value;
                      setDialCode(next);
                      setPhone((cur) => normalisePhone(cur, next));
                    }}
                    aria-label="Country dial code"
                    data-testid="dial-code-select"
                  >
                    {DIAL_CODES.map((d) => (
                      <option key={d.code} value={d.code}>{d.code}</option>
                    ))}
                  </select>
                  <input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    maxLength={phoneMax(dialCode)}
                    value={phone}
                    onChange={(e) => setPhone(normalisePhone(e.target.value, dialCode))}
                    className="ap-input"
                    placeholder={`${phoneMax(dialCode)}-digit number`}
                    required
                    data-testid="phone-input"
                  />
                </div>
                {phone && !phoneValid(phone, dialCode) && (
                  <span className="ap-field-error">Enter a valid {phoneMax(dialCode)}-digit mobile number.</span>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Password */}
          <motion.div
            className="ap-field"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
          >
            <label className="ap-label" htmlFor="password">
              Password
            </label>
            <div className="ap-input-wrap">
              <input
                id="password"
                autoComplete={isLogin ? "current-password" : "new-password"}
                type={showPass.login ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="ap-input"
                placeholder="••••••••"
                required
                data-testid="password-input"
              />
              <button type="button" className="ap-eye" onClick={() => togglePass('login')} aria-label={showPass.login ? 'Hide password' : 'Show password'} tabIndex={-1}>
                {showPass.login ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {isLogin && (
              <button
                type="button"
                className="ap-forgot-link"
                onClick={goToForgot}
                data-testid="forgot-password-btn"
              >
                Forgot password?
              </button>
            )}
          </motion.div>

          {/* Submit */}
          <motion.button
            type="submit"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42, duration: 0.4 }}
            className="ap-submit"
            disabled={loading}
            data-testid="submit-btn"
          >
            {loading ? (
              <span className="ap-spinner" />
            ) : (
              isLogin ? 'Log in' : 'Create account'
            )}
          </motion.button>
        </form>

        {/* Footer toggle */}
        <motion.div
          className="ap-footer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.52, duration: 0.4 }}
        >
          {isLogin ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            type="button"
            className="ap-toggle"
            onClick={() => setIsLogin(!isLogin)}
            data-testid="toggle-auth-btn"
          >
            {isLogin ? 'Sign up' : 'Log in'}
          </button>
        </motion.div>
        {!isLogin && (
          <label className="ap-legal ugc-consent" data-testid="terms-consent">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} data-testid="terms-checkbox" />
            <span>
              I agree to the{' '}
              <a href="/terms" target="_blank" rel="noreferrer">Terms</a> and{' '}
              <a href="/privacy-policy" target="_blank" rel="noreferrer">Privacy Policy</a>, and the{' '}
              <a href="/community-guidelines" target="_blank" rel="noreferrer">Community Guidelines</a>.
            </span>
          </label>
        )}
        </>
        )}

        {/* ── Forgot password — request a reset code ─────────────────── */}
        {view === 'forgot' && (
          <motion.form
            onSubmit={handleForgotSubmit}
            className="ap-form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="ap-field">
              <label className="ap-label" htmlFor="forgot-email">
                Email
              </label>
              <input
                id="forgot-email"
                autoComplete="email"
                autoCapitalize="none"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="ap-input"
                placeholder="your@email.com"
                required
                autoFocus
                data-testid="forgot-email-input"
              />
            </div>

            <button
              type="submit"
              className="ap-submit"
              disabled={loading}
              data-testid="forgot-submit-btn"
            >
              {loading ? <span className="ap-spinner" /> : 'Send reset code'}
            </button>

            <div className="ap-footer">
              <button type="button" className="ap-toggle" onClick={backToLogin}>
                ← Back to log in
              </button>
            </div>
          </motion.form>
        )}

        {/* ── Reset step 1 — verify the emailed code ─────────────────── */}
        {view === 'reset' && (
          <motion.form
            onSubmit={handleVerifyCode}
            className="ap-form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="ap-field">
              <label className="ap-label" htmlFor="reset-code">
                Code from your email
              </label>
              <input
                id="reset-code"
                autoComplete="one-time-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                className="ap-input"
                placeholder="Enter your code"
                required
                autoFocus
                data-testid="reset-code-input"
              />
            </div>

            <button
              type="submit"
              className="ap-submit"
              disabled={loading}
              data-testid="verify-code-btn"
            >
              {loading ? <span className="ap-spinner" /> : 'Verify code'}
            </button>

            <div className="ap-footer">
              <button type="button" className="ap-toggle" onClick={goToForgot}>
                Resend code
              </button>
              {'  ·  '}
              <button type="button" className="ap-toggle" onClick={backToLogin}>
                ← Back to log in
              </button>
            </div>
          </motion.form>
        )}

        {/* ── Two-factor step — 6-digit TOTP from the authenticator app ──── */}
        {view === '2fa' && (
          <motion.form
            onSubmit={handle2FASubmit}
            className="ap-form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="ap-field">
              <label className="ap-label" htmlFor="totp-code">Two-factor code</label>
              <input
                id="totp-code"
                autoComplete="one-time-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                className="ap-input"
                placeholder="6-digit code from your app"
                required
                autoFocus
              />
            </div>
            <button type="submit" className="ap-submit" disabled={loading}>
              {loading ? <span className="ap-spinner" /> : 'Verify & sign in'}
            </button>
            <div className="ap-footer">
              <button type="button" className="ap-toggle" onClick={() => { setView('auth'); setTotpCode(''); socialRef.current = null; }}>
                ← Back to log in
              </button>
            </div>
          </motion.form>
        )}

        {/* ── Reset step 2 — set a new password (after code verified) ──── */}
        {view === 'newpass' && (
          <motion.form
            onSubmit={handleResetSubmit}
            className="ap-form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="ap-field">
              <label className="ap-label" htmlFor="new-password">
                New password
              </label>
              <div className="ap-input-wrap">
                <input
                  id="new-password"
                  autoComplete="new-password"
                  type={showPass.newPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="ap-input"
                  placeholder="At least 6 characters"
                  required
                  autoFocus
                  data-testid="new-password-input"
                />
                <button type="button" className="ap-eye" onClick={() => togglePass('newPass')} aria-label={showPass.newPass ? 'Hide password' : 'Show password'} tabIndex={-1}>
                  {showPass.newPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="ap-field">
              <label className="ap-label" htmlFor="confirm-password">
                Confirm password
              </label>
              <div className="ap-input-wrap">
                <input
                  id="confirm-password"
                  autoComplete="new-password"
                  type={showPass.confirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="ap-input"
                  placeholder="Re-enter new password"
                  required
                  data-testid="confirm-password-input"
                />
                <button type="button" className="ap-eye" onClick={() => togglePass('confirm')} aria-label={showPass.confirm ? 'Hide password' : 'Show password'} tabIndex={-1}>
                  {showPass.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="ap-submit"
              disabled={loading}
              data-testid="reset-submit-btn"
            >
              {loading ? <span className="ap-spinner" /> : 'Save new password'}
            </button>

            <div className="ap-footer">
              <button type="button" className="ap-toggle" onClick={() => setView('reset')}>
                Back to code
              </button>
              {'  ·  '}
              <button type="button" className="ap-toggle" onClick={backToLogin}>
                ← Back to log in
              </button>
            </div>
          </motion.form>
        )}
      </motion.div>
      </main>
      </div>
    </div>
  );
}
