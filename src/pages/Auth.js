import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { User, Building2, Lock, Mail, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;
const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';

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
function routeForUser(navigate, role, profileCompleted) {
  if (!profileCompleted) {
    if (role === 'creator') return navigate('/profile-setup/creator');
    if (role === 'business') return navigate('/profile-setup/business');
  }
  if (role === 'creator') return navigate('/dashboard/creator');
  if (role === 'business') return navigate('/dashboard/business/browse-creator');
  if (role === 'admin') return navigate('/dashboard/admin');
  return navigate('/');
}

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'signup');
  const [role, setRole] = useState(searchParams.get('role') === 'business' ? 'business' : 'creator');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  // Password-reset flow: 'auth' (sign in / sign up) → 'forgot' (request a code)
  // → 'reset' (enter the emailed code + a new password).
  const [view, setView] = useState('auth');
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

  // Exchange the Google credential for our own JWT via the backend.
  const handleGoogleCredential = async (response) => {
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/auth/google`, {
        credential: response.credential,
        role: roleRef.current
      });
      const { token, ...userData } = data;
      login(token, userData);
      toast.success('Signed in with Google');
      routeForUser(navigate, userData.role, userData.profile_completed);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Google sign-in failed'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return; // not configured — button simply won't render
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !googleBtnRef.current) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCredential
        });
        googleBtnRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
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
    setLoading(true);

    try {
      const endpoint = isLogin ? '/auth/login' : '/auth/signup';
      const payload = isLogin ? { email, password } : { email, password, role };

      const { data } = await axios.post(`${API}${endpoint}`, payload);

      // Login may require a second factor — Python returns {requires_2fa:true} with no token.
      if (isLogin && data.requires_2fa) {
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
        routeForUser(navigate, userData.role, userData.profile_completed);
      }
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Authentication failed'));
    } finally {
      setLoading(false);
    }
  };

  // Second-factor step: resend the login with the TOTP code (backend reads it as a query param).
  const handle2FASubmit = async (e) => {
    e.preventDefault();
    if (totpCode.length !== 6) { toast.error('Enter the 6-digit code'); return; }
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/auth/login?totp_token=${encodeURIComponent(totpCode)}`, { email, password });
      const { token, ...userData } = data;
      login(token, userData);
      toast.success('Welcome back!');
      routeForUser(navigate, userData.role, userData.profile_completed);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Invalid 2FA code'));
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
    setLoading(true);
    try {
      await axios.post(`${API}/auth/forgot-password`, { email });
      toast.success('Code sent');
      setView('reset');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not send reset code'));
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
      toast.error(apiErrorMessage(error, 'Invalid or expired reset code'));
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
      toast.success('Password reset — please sign in with your new password.');
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Could not reset password'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ap-root">
      {/* Background orbs */}
      <div className="ap-orb ap-orb--1" aria-hidden="true" />
      <div className="ap-orb ap-orb--2" aria-hidden="true" />
      <div className="ap-orb ap-orb--3" aria-hidden="true" />
      <div className="ap-grid" aria-hidden="true" />

      {/* Brand logo — top-left corner of the page */}
      <img src="/newlogo-tight.png" alt="UGCad.io" className="ap-page-logo" />

      {/* ── the auth card (form + promo, one floating shell) ── */}
      {/* Sign In → form on the right; Sign Up → form on the left. */}
      <div className={`ap-shell ${isLogin ? 'is-signin' : 'is-signup'} ${view !== 'auth' ? 'is-compact' : ''}`}>

      {/* ── LEFT: the sign-in / sign-up form ── */}
      <div className="ap-left">

      {/* Back button — arrow only, top-left */}
      <button className="ap-back" onClick={() => navigate('/')} aria-label="Back to home">
        <ArrowLeft size={18} />
      </button>

      <motion.div
        className="ap-card"
        initial={false}
      >
        {/* Logo */}
        <motion.div
          className="ap-logo-wrap"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
        >
          <img src="/ugcad-logo.png" alt="UGCad.io" className="ap-logo" />
        </motion.div>

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
                ? 'Reset password'
                : view === 'reset'
                ? 'Enter your code'
                : view === 'newpass'
                ? 'New password'
                : isLogin
                ? 'Welcome back'
                : 'Create account'}
            </h1>
            <p className="ap-subtitle">
              {view === 'forgot'
                ? "Enter your email and we'll send you a reset code"
                : view === 'reset'
                ? 'Enter the 6-digit code we emailed you'
                : view === 'newpass'
                ? 'Choose a new password for your account'
                : isLogin
                ? 'Sign in to continue your journey on UGCad.io'
                : 'Join thousands of creators and brands on UGCad.io'}
            </p>
          </motion.div>
        </AnimatePresence>

        {view === 'auth' && (
        <>
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
                <label className="ap-label">I am a:</label>
                <div className="ap-role-options">
                  <button
                    type="button"
                    className={`ap-role-btn${role === 'creator' ? ' active' : ''}`}
                    onClick={() => setRole('creator')}
                    data-testid="role-creator-btn"
                  >
                    <div className="ap-role-icon">
                      <User size={20} />
                    </div>
                    <span>Creator</span>
                  </button>
                  <button
                    type="button"
                    className={`ap-role-btn${role === 'business' ? ' active' : ''}`}
                    onClick={() => setRole('business')}
                    data-testid="role-business-btn"
                  >
                    <div className="ap-role-icon">
                      <Building2 size={20} />
                    </div>
                    <span>Business</span>
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
              <Mail size={15} /> Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="ap-input input-field"
              placeholder="your@email.com"
              required
              data-testid="email-input"
            />
          </motion.div>

          {/* Password */}
          <motion.div
            className="ap-field"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35, duration: 0.4 }}
          >
            <label className="ap-label" htmlFor="password">
              <Lock size={15} /> Password
            </label>
            <div className="ap-input-wrap">
              <input
                id="password"
                type={showPass.login ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="ap-input input-field"
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
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="ap-submit btn-primary"
            disabled={loading}
            data-testid="submit-btn"
          >
            {loading ? (
              <span className="ap-spinner" />
            ) : (
              isLogin ? 'Sign In' : 'Create Account'
            )}
          </motion.button>
        </form>

        {/* Google sign-in — only when a client id is configured */}
        {GOOGLE_CLIENT_ID && (
          <motion.div
            className="ap-oauth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.48, duration: 0.4 }}
          >
            <div className="ap-divider"><span>or</span></div>
            <div ref={googleBtnRef} className="ap-google" />
          </motion.div>
        )}

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
            {isLogin ? 'Sign Up' : 'Sign In'}
          </button>
        </motion.div>
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
                <Mail size={15} /> Email
              </label>
              <input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="ap-input input-field"
                placeholder="your@email.com"
                required
                autoFocus
                data-testid="forgot-email-input"
              />
            </div>

            <button
              type="submit"
              className="ap-submit btn-primary"
              disabled={loading}
              data-testid="forgot-submit-btn"
            >
              {loading ? <span className="ap-spinner" /> : 'Send reset code'}
            </button>

            <div className="ap-footer">
              Remembered it?{' '}
              <button type="button" className="ap-toggle" onClick={backToLogin}>
                Back to sign in
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
                Code
              </label>
              <input
                id="reset-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={resetCode}
                onChange={(e) => setResetCode(e.target.value.replace(/\D/g, ''))}
                className="ap-input input-field"
                placeholder="Enter your code"
                required
                autoFocus
                data-testid="reset-code-input"
              />
            </div>

            <button
              type="submit"
              className="ap-submit btn-primary"
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
                Back to sign in
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
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                className="ap-input input-field"
                placeholder="6-digit code from your app"
                required
                autoFocus
              />
            </div>
            <button type="submit" className="ap-submit btn-primary" disabled={loading}>
              {loading ? <span className="ap-spinner" /> : 'Verify & sign in'}
            </button>
            <div className="ap-footer">
              <button type="button" className="ap-toggle" onClick={() => { setView('auth'); setTotpCode(''); }}>
                Back to sign in
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
                <Lock size={15} /> New password
              </label>
              <div className="ap-input-wrap">
                <input
                  id="new-password"
                  type={showPass.newPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="ap-input input-field"
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
                <Lock size={15} /> Confirm password
              </label>
              <div className="ap-input-wrap">
                <input
                  id="confirm-password"
                  type={showPass.confirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="ap-input input-field"
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
              className="ap-submit btn-primary"
              disabled={loading}
              data-testid="reset-submit-btn"
            >
              {loading ? <span className="ap-spinner" /> : 'Reset password'}
            </button>

            <div className="ap-footer">
              <button type="button" className="ap-toggle" onClick={() => setView('reset')}>
                Back to code
              </button>
              {'  ·  '}
              <button type="button" className="ap-toggle" onClick={backToLogin}>
                Back to sign in
              </button>
            </div>
          </motion.form>
        )}
      </motion.div>
      </div>

      {/* ── RIGHT: UGC promo panel ── */}
      <aside className="ap-promo">
        <span className="ap-promo-logobg" aria-hidden="true" />
        <span className="ap-promo-shine" aria-hidden="true" />
        <div className="ap-promo-inner">
          <div>
            <h2 className="ap-promo-title">Where brands meet<br />real creators.</h2>
            <p className="ap-promo-text">
              UGCad connects brands with authentic UGC creators — post a campaign,
              get matched with the right talent, and turn real content into results,
              all in one place.
            </p>
          </div>
          <p className="ap-promo-stat">More than 17k creators &amp; brands joined — it&apos;s your turn.</p>
        </div>
      </aside>
      </div>

      <style>{`
        /* ── Root ────────────────────────────────────────────────── */
        .ap-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          background: linear-gradient(160deg, #050510 0%, #0D0B26 100%);
          position: relative;
          overflow: hidden;
          font-family: var(--font-body);
        }

        /* ── Orbs ────────────────────────────────────────────────── */
        .ap-orb {
          position: absolute;
          border-radius: 50%;
          animation: orbDrift 8s ease-in-out infinite;
          pointer-events: none;
        }
        .ap-orb--1 {
          width: 500px; height: 500px;
          background: rgba(99, 102, 241, 0.18);
          filter: blur(90px);
          top: -150px; left: -100px;
        }
        .ap-orb--2 {
          width: 400px; height: 400px;
          background: rgba(139, 92, 246, 0.14);
          filter: blur(80px);
          bottom: -100px; right: -80px;
          animation-delay: -4s;
        }
        .ap-orb--3 {
          width: 280px; height: 280px;
          background: rgba(34, 211, 238, 0.08);
          filter: blur(70px);
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          animation-delay: -2s;
        }

        /* Dot-grid */
        .ap-grid {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background-image:
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px);
          background-size: 60px 60px;
        }

        /* ── Back button ─────────────────────────────────────────── */
        .ap-back {
          position: fixed;
          top: 24px;
          left: 28px;
          display: flex;
          align-items: center;
          gap: 7px;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: #94A3B8;
          font-size: 0.85rem;
          font-weight: 500;
          padding: 8px 16px;
          border-radius: 100px;
          cursor: pointer;
          transition: all 0.25s ease;
          z-index: 10;
          font-family: var(--font-body);
          backdrop-filter: blur(8px);
        }
        .ap-back:hover {
          background: rgba(255,255,255,0.1);
          color: #F1F5F9;
          border-color: rgba(255,255,255,0.2);
        }

        /* ── Card ────────────────────────────────────────────────── */
        .ap-card {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 440px;
          background: #ffffff;
          border-radius: 24px;
          padding: 44px 40px;
          box-shadow: 0 32px 80px rgba(0, 0, 0, 0.4);
        }


        /* ── Logo ────────────────────────────────────────────────── */
        .ap-logo-wrap {
          display: flex;
          justify-content: center;
          margin-bottom: 24px;
        }
        .ap-logo {
          height: 64px;   /* stacked lockup (monogram + UGCad.io) needs more height than the wordmark */
          width: auto;
          display: block;
        }

        /* ── Header ──────────────────────────────────────────────── */
        .ap-header {
          text-align: center;
          margin-bottom: 32px;
        }
        .ap-title {
          font-family: var(--font-head);
          font-size: var(--fs-h2);
          font-weight: var(--fw-head);
          color: #0F172A;
          margin-bottom: 8px;
        }
        .ap-subtitle {
          color: #6366F1;
          font-size: 0.9rem;
          line-height: 1.55;
        }

        /* ── Form ────────────────────────────────────────────────── */
        .ap-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* Role selector */
        .ap-role-wrap {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .ap-role-options {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .ap-role-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 18px;
          border-radius: 12px;
          border: 1.5px solid #E2E8F0;
          background: #F8FAFC;
          color: #64748B;
          font-family: var(--font-body);
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s ease;
        }
        .ap-role-btn:hover {
          border-color: #6366F1;
          color: #6366F1;
          background: rgba(99, 102, 241, 0.04);
        }
        .ap-role-btn.active {
          border-color: #6366F1;
          background: rgba(99, 102, 241, 0.08);
          color: #6366F1;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);
        }
        .ap-role-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #EEF2FF;
          transition: background 0.25s ease;
          flex-shrink: 0;
        }
        .ap-role-btn.active .ap-role-icon {
          background: rgba(99, 102, 241, 0.15);
        }

        /* Label */
        .ap-label {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 0.82rem;
          font-weight: 600;
          color: #475569;
          letter-spacing: 0.02em;
          text-transform: uppercase;
          margin-bottom: 2px;
        }

        /* Field wrapper */
        .ap-field {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        /* Input override for white card */
        .ap-input.input-field {
          background: #F8FAFC !important;
          border: 1.5px solid #E2E8F0 !important;
          border-radius: 12px !important;
          color: #0F172A !important;
          font-family: var(--font-body);
          font-size: 0.95rem;
          padding: 13px 16px;
          transition: border-color 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
        }
        .ap-input.input-field::placeholder {
          color: #94A3B8;
        }
        .ap-input.input-field:focus {
          outline: none;
          border-color: #6366F1 !important;
          background: #ffffff !important;
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12) !important;
        }

        /* Password field show/hide toggle */
        .ap-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .ap-input-wrap .ap-input.input-field {
          width: 100%;
          padding-right: 44px;
        }
        .ap-eye {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          border: none;
          background: transparent;
          color: #94A3B8;
          cursor: pointer;
          border-radius: 8px;
          transition: color 0.2s ease, background 0.2s ease;
        }
        .ap-eye:hover {
          color: #475569;
          background: #F1F5F9;
        }

        /* Submit button override */
        .ap-submit.btn-primary {
          width: 100%;
          padding: 14px;
          border-radius: 12px !important;
          font-size: 0.97rem;
          font-weight: 600;
          margin-top: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          background: #0F172A !important;
          box-shadow: 0 8px 24px rgba(15, 23, 42, 0.25) !important;
          transition: box-shadow 0.25s ease !important;
          border: none !important;
        }
        .ap-submit.btn-primary:hover:not(:disabled) {
          box-shadow: 0 12px 32px rgba(15, 23, 42, 0.35) !important;
        }
        .ap-submit.btn-primary:disabled {
          opacity: 0.65;
        }

        /* Spinner */
        .ap-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
          display: inline-block;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        /* ── OAuth / Google ──────────────────────────────────────── */
        .ap-oauth {
          margin-top: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .ap-divider {
          width: 100%;
          display: flex;
          align-items: center;
          text-align: center;
          color: #94A3B8;
          font-size: 0.8rem;
        }
        .ap-divider::before,
        .ap-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #E2E8F0;
        }
        .ap-divider span {
          padding: 0 12px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .ap-google {
          display: flex;
          justify-content: center;
          min-height: 40px;
        }

        /* Forgot-password link (login only) */
        .ap-forgot-link {
          align-self: flex-end;
          margin-top: 2px;
          background: none;
          border: none;
          padding: 0;
          color: #6366F1;
          font-family: var(--font-body);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: color 0.2s ease;
        }
        .ap-forgot-link:hover {
          color: #4F46E5;
          text-decoration: underline;
          text-underline-offset: 3px;
        }


        /* ── Footer ──────────────────────────────────────────────── */
        .ap-footer {
          margin-top: 24px;
          text-align: center;
          color: #334155;
          font-size: 0.88rem;
        }
        .ap-toggle {
          background: none;
          border: none;
          color: #0F172A;
          font-weight: 700;
          cursor: pointer;
          margin-left: 4px;
          font-size: 0.88rem;
          font-family: var(--font-body);
          transition: color 0.2s ease;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .ap-toggle:hover {
          color: #6366F1;
        }

        /* ── Responsive ──────────────────────────────────────────── */
        @media (max-width: 480px) {
          .ap-card {
            padding: 36px 24px;
          }
          .ap-back {
            top: 16px;
            left: 16px;
          }
        }

        /* ══════════════════════════════════════════════════════════════
           Split auth layout — form on the left, UGC promo panel on the right
           ══════════════════════════════════════════════════════════════ */
        .ap-root {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 26px;
          background: linear-gradient(160deg, #050510 0%, #0D0B26 100%);
          overflow: hidden;
        }
        .ap-grid { display: none; }

        .ap-shell {
          display: grid;
          grid-template-columns: 1fr 1fr;
          width: 100%;
          max-width: 980px;
          max-height: calc(100vh - 52px);
          background: #f2f3f7;
          border-radius: 26px;
          overflow: hidden;
          box-shadow: 0 40px 90px -34px rgba(15,18,45,0.4);
        }
        /* Sign-up only: wider shell so the promo panel gets more room. Login and
           the form card (max-width 336px) are unchanged. */
        .ap-shell.is-signup { max-width: 1120px; }

        .ap-left {
          position: relative;
          z-index: 2;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 34px 48px 34px 74px;
          background: #f2f3f7;
          overflow-y: auto;
        }
        /* Sign-up form sits a bit further right (wider shell). */
        .ap-shell.is-signup .ap-left { padding-left: 106px; }
        .ap-card {
          background: transparent;
          box-shadow: none;
          max-width: 336px;
          margin: 0;
          padding: 0;
        }
        /* In-card logo hidden — the brand mark now lives at the page's top-left. */
        .ap-logo-wrap { display: none; }
        .ap-page-logo {
          position: absolute;
          top: 24px;
          left: 34px;
          height: 32px !important;
          width: auto !important;
          max-height: none !important;
          z-index: 6;
          pointer-events: none;
        }
        .ap-header { text-align: left; margin-bottom: 18px; }
        .ap-title { font-size: 25px; }
        .ap-subtitle { font-size: 12.5px; }
        .ap-input { padding: 10px 13px; font-size: 13.5px; }
        .ap-submit { padding: 12px; font-size: 14px; }
        .ap-back {
          position: relative;
          top: auto;
          left: auto;
          align-self: flex-start;
          margin-bottom: 14px;
          margin-left: -34px;
          width: 38px;
          height: 38px;
          padding: 0;
          gap: 0;
          display: grid;
          place-items: center;
          background: rgba(15,18,45,0.06);
          border-color: rgba(15,18,45,0.12);
          color: #4b4f6b;
          backdrop-filter: none;
        }
        .ap-back:hover { background: rgba(15,18,45,0.1); color: #15163a; border-color: rgba(15,18,45,0.22); }
        /* Sign-up form is shifted right — pull just the back arrow back left. */
        .ap-shell.is-signup .ap-back { margin-left: -66px; }

        /* Promo panel (right) */
        /* Animated swap — Sign Up: form left · Sign In: form right.
           Panels slide with transform (grid order can't animate). Form (z-index 2)
           slides over the promo. On sign-in the form shifts one column right and
           the promo one column left; sign-up is the resting (no-transform) state. */
        .ap-left, .ap-promo { transition: transform .55s cubic-bezier(.76, 0, .24, 1); }
        .ap-shell.is-signin .ap-left { transform: translateX(100%); }
        .ap-shell.is-signin .ap-promo { transform: translateX(-100%); }

        .ap-promo {
          position: relative;
          overflow: hidden;
          display: flex;
          color: #fff;
          border-radius: 0;
          margin: 0;
          /* Brand hero image on the left panel — shown as-is (no dark overlay).
             Optimized WebP (~33KB) with JPG fallback; the original PNG was 1.3MB and slow.
             Longhand so image-set-unaware engines fall back to the JPG and the colour stays. */
          background-color: #0b0b16;
          background-position: center;
          background-size: cover;
          background-repeat: no-repeat;
          background-image: url('/login.jpg');
          background-image: image-set(url('/login.webp') type('image/webp'), url('/login.jpg') type('image/jpeg'));
        }
        /* Old faint watermark replaced by the login hero above. */
        .ap-promo-logobg { display: none; }
        .ap-promo-shine {
          position: absolute; top: -12%; right: -22%;
          width: 58%; height: 130%;
          background: linear-gradient(120deg, transparent, rgba(130,150,190,0.14), transparent);
          transform: rotate(18deg); pointer-events: none;
        }
        .ap-promo-inner {
          position: relative; z-index: 1; width: 100%;
          display: flex; flex-direction: column; justify-content: flex-start;
          gap: 24px; padding: 64px 34px 14px 62px;
        }
        .ap-promo-brand { font-weight: 700; font-size: 13.5px; color: #cfd2e6; letter-spacing: .2px; }
        /* Positioned to sit inside the dark-blue card in the hero image (upper area). */
        .ap-promo-title {
          position: absolute; left: 8%; top: 2%; width: 40%; z-index: 2; white-space: nowrap;
          font-family: var(--font-head, inherit);
          font-size: 16px; font-weight: 600; line-height: 1.2; margin: 0; color: #fff;
        }
        /* Sign-in only: nudge the heading a touch left. */
        .ap-shell.is-signin .ap-promo-title { left: 7%; }
        /* Positioned over the light card baked into the hero image (lower area). */
        .ap-promo-text { position: absolute; left: 53%; top: 73%; width: 40%; color: #26386e;
          font-size: 13px; font-weight: 500; line-height: 1.6; margin: 0; z-index: 2; }
        /* Sign-up panel is wider, so the image crops a bit differently — nudge the
           description down on sign-up only. */
        .ap-shell.is-signup .ap-promo-text { top: 75%; left: 55%; }
        /* Reset / forgot / new-password / 2FA views make the shell much shorter, so the
           description (pinned at top:73%) spilled out of the panel and collided with the
           stat line. Those views don't need the paragraph — drop it and keep the title. */
        .ap-shell.is-compact .ap-promo-text { display: none; }
        /* Cap the width so it wraps onto 2–3 lines instead of running one long line
           straight off the edge of the panel. */
        /* Bottom-right of the panel, nudged a bit further right (negative right margin
           eats into the 34px padding). Brand dark blue to match the theme. */
        .ap-promo-stat { color: #07074e; font-size: 14px; font-weight: 700;
          margin: auto -32px 0 auto; max-width: 240px; white-space: normal; line-height: 1.5; }
        .ap-promo-card {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 18px; padding: 20px 22px;
          -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
        }
        .ap-promo-card h3 { margin: 0 0 8px; font-size: 17px; font-weight: 800; color: #fff; }
        .ap-promo-card p { margin: 0 0 14px; color: rgba(255,255,255,0.58); font-size: 13px; line-height: 1.55; max-width: 320px; }
        .ap-promo-people { display: flex; align-items: center; }
        .ap-promo-ava {
          width: 32px; height: 32px; border-radius: 50%; border: 2px solid #14141f;
          margin-left: -9px; display: inline-flex; flex: none;
        }
        .ap-promo-ava:first-child { margin-left: 0; }
        .ap-promo-ava--more {
          background: #23233a !important; color: #cfd2e6;
          font-size: 12px; font-weight: 700; align-items: center; justify-content: center;
        }

        @media (max-width: 860px) {
          .ap-shell { grid-template-columns: 1fr; max-width: 420px; max-height: none; }
          .ap-promo { display: none; }
          /* single column — never slide the form off-screen */
          .ap-shell.is-signin .ap-left, .ap-shell.is-signin .ap-promo { transform: none !important; }
          .ap-left { padding: 40px 28px; align-items: center; }
          .ap-card { margin: 0 auto; }
          .ap-header { text-align: center; }
          .ap-logo-wrap { justify-content: center; }
        }
      `}</style>
    </div>
  );
}
