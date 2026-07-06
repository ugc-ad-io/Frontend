import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../App';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

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
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Email + password → create the real creator account, then go to profile setup.
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await axios.post(`${API}/auth/signup`, { email, password, role: 'creator' });
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
    <div className="cs-root">
      {/* Back button */}
      <button
        className="cs-back"
        type="button"
        onClick={() => navigate('/creator')}
      >
        <ArrowLeft size={16} />
        Back
      </button>

      <form className="cs-card" onSubmit={handleSubmit}>
        <img src="/newlogo-tight.png" alt="UGCad.io" className="cs-logo" />
        {/* Heading row */}
        <div className="cs-head">
          <span className="cs-step">Step 1</span>
          <h1 className="cs-title">
            Create. Get Discovered. Get <span className="cs-title-accent">Paid</span>.
          </h1>
        </div>
        <p className="cs-sub">
          Brands post real projects. You apply, create, and get paid—no outreach needed.
        </p>

        {/* Email */}
        <div className="cs-field">
          <label className="cs-label" htmlFor="cs-email">Email</label>
          <input
            id="cs-email"
            type="email"
            className="cs-input"
            placeholder="josephwilliams@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {/* Password */}
        <div className="cs-field">
          <label className="cs-label" htmlFor="cs-password">Password</label>
          <div className="cs-input-wrap">
            <input
              id="cs-password"
              type={showPassword ? 'text' : 'password'}
              className="cs-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
            <button
              type="button"
              className="cs-eye"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <p className="cs-hint">Must be at least 8 characters</p>
        </div>

        {/* Submit */}
        <button type="submit" className="cs-submit" disabled={submitting}>
          {submitting ? 'Creating account…' : 'Create Account'}
        </button>

        {/* Google */}
        <button type="button" className="cs-google" onClick={handleGoogle}>
          <GoogleIcon /> Sign Up with Google
        </button>

        {/* Login link */}
        <p className="cs-login">
          Already have an account?{' '}
          <button type="button" className="cs-login-link" onClick={() => navigate('/auth')}>
            Login
          </button>
        </p>
      </form>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap');

        .cs-root {
          --cs-purple: #07074e;
          --cs-purple-deep: #4f63e6;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          background: #0a0a0a;
          font-family: var(--font-body);
          position: relative;
          overflow: hidden;
        }
        /* Navy glow blobs to match the landing page */
        .cs-bg { position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
        .cs-blob {
          position: absolute; border-radius: 50%;
          background: linear-gradient(135deg, #07074e 0%, #1a1466 100%);
          filter: blur(90px); opacity: 0.55;
        }
        .cs-blob--1 { width: 520px; height: 520px; top: -10%; left: 0%; }
        .cs-blob--2 { width: 460px; height: 460px; bottom: -8%; right: 2%; }

        /* Back button */
        .cs-back {
          position: fixed;
          top: 24px;
          left: 28px;
          z-index: 10;
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 16px;
          border-radius: 100px;
          border: 1px solid rgba(255, 255, 255, 0.14);
          background: rgba(255, 255, 255, 0.06);
          backdrop-filter: blur(8px);
          color: rgba(255, 255, 255, 0.78);
          font-size: 0.85rem;
          font-weight: 500;
          font-family: var(--font-body);
          cursor: pointer;
          transition: all 0.22s ease;
        }
        .cs-back:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.28);
          color: #ffffff;
        }

        .cs-card {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 560px;
          background: rgba(18, 18, 24, 0.72);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 20px;
          padding: 36px 40px 40px;
          box-shadow: 0 28px 70px rgba(0, 0, 0, 0.55);
        }
        .cs-logo {
          height: 32px;
          width: auto;
          display: block;
          margin: 0 0 14px -4px;   /* slight left pull so the wordmark optically aligns with the text */
        }
        .cs-head {
          display: flex;
          align-items: baseline;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 12px;
        }
        .cs-step {
          flex-shrink: 0;
          background: linear-gradient(120deg, var(--cs-purple), var(--cs-purple-deep));
          color: #fff;
          font-size: 0.78rem;
          font-weight: 700;
          padding: 4px 13px;
          border-radius: 999px;
          letter-spacing: 0.01em;
          transform: translateY(-2px);
        }
        .cs-title {
          margin: 0;
          font-family: var(--font-head);
          font-size: var(--fs-h2);
          font-weight: var(--fw-head);
          color: #ffffff;
          line-height: 1.25;
          letter-spacing: -0.01em;
        }
        .cs-title-accent {
          background: linear-gradient(120deg, #07074e, #aeb9ff);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }
        .cs-sub {
          margin: 0 0 28px;
          color: rgba(255, 255, 255, 0.62);
          font-size: 0.95rem;
          line-height: 1.55;
        }
        .cs-field { margin-bottom: 20px; }
        .cs-label {
          display: block;
          font-size: 0.95rem;
          font-weight: 600;
          color: #ffffff;
          margin-bottom: 9px;
        }
        .cs-input-wrap { position: relative; }
        .cs-input {
          width: 100%;
          background: rgba(255, 255, 255, 0.04);
          border: 1.5px solid rgba(255, 255, 255, 0.14);
          border-radius: 12px;
          padding: 15px 16px;
          font-size: 1rem;
          color: #ffffff;
          font-family: var(--font-body);
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }
        .cs-input-wrap .cs-input { padding-right: 52px; }
        .cs-input::placeholder { color: rgba(255, 255, 255, 0.38); }
        .cs-input:focus {
          outline: none;
          border-color: var(--cs-purple);
          background: rgba(255, 255, 255, 0.06);
          box-shadow: 0 0 0 3px rgba(7, 7, 78, 0.18);
        }
        .cs-eye {
          position: absolute;
          top: 50%;
          right: 14px;
          transform: translateY(-50%);
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          color: rgba(255, 255, 255, 0.5);
          display: flex;
          transition: color 0.2s ease;
        }
        .cs-eye:hover { color: #ffffff; }
        .cs-hint {
          margin: 8px 0 0;
          font-size: 0.85rem;
          color: rgba(255, 255, 255, 0.45);
        }
        .cs-submit {
          width: 100%;
          margin-top: 8px;
          padding: 16px;
          border: none;
          border-radius: 999px;
          background: linear-gradient(120deg, var(--cs-purple), var(--cs-purple-deep));
          color: #fff;
          font-size: 1.05rem;
          font-weight: 700;
          font-family: var(--font-body);
          cursor: pointer;
          box-shadow: 0 12px 34px rgba(7, 7, 78, 0.35);
          transition: transform 0.15s ease, box-shadow 0.2s ease;
        }
        .cs-submit:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 16px 42px rgba(7, 7, 78, 0.5);
        }
        .cs-submit:active:not(:disabled) { transform: translateY(0); }
        .cs-submit:disabled { opacity: 0.6; cursor: default; }
        .cs-google {
          width: 100%;
          margin-top: 14px;
          padding: 15px;
          border: 1.5px solid rgba(255, 255, 255, 0.18);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.04);
          color: #ffffff;
          font-size: 1.02rem;
          font-weight: 600;
          font-family: var(--font-body);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          transition: background 0.2s ease, border-color 0.2s ease;
        }
        .cs-google:hover { background: rgba(255, 255, 255, 0.08); border-color: rgba(255, 255, 255, 0.32); }
        .cs-login {
          margin: 22px 0 0;
          text-align: center;
          color: rgba(255, 255, 255, 0.6);
          font-size: 0.95rem;
        }
        .cs-login-link {
          background: none;
          border: none;
          padding: 0;
          color: var(--cs-purple);
          font-weight: 700;
          font-size: 0.95rem;
          font-family: var(--font-body);
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 3px;
        }
        .cs-login-link:hover { color: #aeb9ff; }

        /* ── Email verification step ─────────────────────────────── */
        .cs-card--verify { text-align: center; }
        .cs-verify-title {
          font-size: 1.6rem;
          margin: 0 0 12px;
        }
        .cs-verify-sub {
          margin: 0 0 32px;
          line-height: 1.6;
        }
        .cs-verify-email { color: rgba(255, 255, 255, 0.85); font-weight: 600; }
        .cs-verify-change {
          background: none;
          border: none;
          padding: 0;
          color: var(--cs-purple);
          font-weight: 600;
          font-size: inherit;
          font-family: inherit;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .cs-verify-change:hover { color: #aeb9ff; }
        .cs-otp {
          display: flex;
          justify-content: center;
          gap: 12px;
          margin: 8px 0 18px;
        }
        .cs-otp-box {
          width: 58px;
          height: 64px;
          text-align: center;
          font-size: 1.6rem;
          font-weight: 700;
          color: #ffffff;
          background: rgba(255, 255, 255, 0.04);
          border: 1.5px solid rgba(255, 255, 255, 0.16);
          border-radius: 12px;
          font-family: var(--font-body);
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }
        .cs-otp-box:focus {
          outline: none;
          border-color: var(--cs-purple);
          background: rgba(255, 255, 255, 0.06);
          box-shadow: 0 0 0 3px rgba(7, 7, 78, 0.18);
        }
        .cs-resend {
          display: block;
          margin: 0 0 26px;
          background: none;
          border: none;
          padding: 4px 0;
          color: rgba(255, 255, 255, 0.78);
          font-size: 0.95rem;
          font-weight: 500;
          font-family: var(--font-body);
          cursor: pointer;
          text-align: left;
          transition: color 0.2s ease;
        }
        .cs-resend:hover { color: var(--cs-purple); }
        .cs-verify-submit { margin-top: 0; }

        @media (max-width: 560px) {
          .cs-card { padding: 28px 22px 32px; border-radius: 16px; }
          .cs-verify-title { font-size: 1.35rem; }
          .cs-back { top: 16px; left: 16px; }
          .cs-otp { gap: 8px; }
          .cs-otp-box { width: 46px; height: 54px; font-size: 1.3rem; }
        }
      `}</style>
    </div>
  );
}
