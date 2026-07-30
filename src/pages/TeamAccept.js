import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { useAuth } from '../App';
import { Users, Lock, Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

export default function TeamAccept() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const { login } = useAuth();

  const [state, setState] = useState('loading'); // loading | ok | invalid
  const [invite, setInvite] = useState(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) { setState('invalid'); return; }
    axios.get(`${API}/team/invite/${token}`)
      .then((r) => { setInvite(r.data); setState('ok'); })
      .catch(() => setState('invalid'));
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 6) return toast.error('Password must be at least 6 characters.');
    if (password !== password2) return toast.error('Passwords do not match.');
    setBusy(true);
    try {
      const r = await axios.post(`${API}/team/accept`, { token, password, name });
      const { token: authToken, ...userData } = r.data;
      login(authToken, userData);
      toast.success(`Welcome to ${invite.brand_name}!`);
      navigate('/dashboard/business/browse-creator');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not accept the invitation'));
    } finally { setBusy(false); }
  };

  return (
    <div className="ta-wrap">
      <div className="ta-card">
        <span className="ta-ic"><Users size={22} /></span>

        {state === 'loading' && <p className="ta-loading"><Loader2 size={18} className="ta-spin" /> Checking your invitation…</p>}

        {state === 'invalid' && (
          <>
            <h1>Invitation not valid</h1>
            <p className="ta-sub">This invitation link is invalid or has expired. Ask your workspace admin to send a new one.</p>
            <button type="button" className="ta-btn" onClick={() => navigate('/auth')}>Go to sign in</button>
          </>
        )}

        {state === 'ok' && invite && (
          <>
            <p className="ta-eyebrow">Team invitation</p>
            <h1>Join {invite.brand_name}</h1>
            <p className="ta-sub">You’re joining as a <strong>{invite.role}</strong>. Set a password for <strong>{invite.email}</strong> to access the workspace.</p>

            <form onSubmit={submit} className="ta-form">
              <label>Your name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Meet Rathod" /></label>
              <label>Password<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" /></label>
              <label>Confirm password<input type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="Re-enter password" /></label>
              <button type="submit" className="ta-btn" disabled={busy}>
                {busy ? 'Setting up…' : 'Accept & continue'}
              </button>
            </form>
          </>
        )}
      </div>

      <style>{`
        .ta-wrap{min-height:100vh;display:grid;place-items:center;padding:24px;background:linear-gradient(160deg,#05050f,#0d0b26)}
        .ta-card{width:min(440px,100%);background:#141420;border:1px solid rgba(255,255,255,.08);border-radius:22px;padding:36px 32px;color:#f4f4f8;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.5)}
        .ta-ic{display:inline-grid;place-items:center;width:48px;height:48px;border-radius:14px;background:rgba(91,107,255,.16);color:#a8b0ff;margin-bottom:16px}
        .ta-eyebrow{margin:0 0 4px;color:#8b8fb5;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.4px}
        .ta-card h1{margin:0 0 10px;font-family:var(--font-head,'Plus Jakarta Sans',sans-serif);font-size:24px;color:#fff}
        .ta-sub{margin:0 auto 22px;max-width:360px;color:rgba(255,255,255,.62);font-size:14px;line-height:1.6}
        .ta-loading{display:flex;align-items:center;justify-content:center;gap:9px;color:rgba(255,255,255,.7);font-size:14px}
        .ta-spin{animation:taspin 1s linear infinite}
        @keyframes taspin{to{transform:rotate(360deg)}}
        .ta-form{display:flex;flex-direction:column;gap:14px;text-align:left}
        .ta-form label{display:flex;flex-direction:column;gap:6px;font-size:12.5px;font-weight:600;color:#b8bcd8}
        .ta-form input{border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04);border-radius:10px;padding:11px 13px;font:inherit;font-size:14px;color:#fff}
        .ta-form input:focus{outline:none;border-color:#5b6bff}
        .ta-btn{margin-top:8px;border:0;border-radius:11px;padding:12px;background:#5b6bff;color:#fff;font:inherit;font-weight:700;font-size:14.5px;cursor:pointer}
        .ta-btn:hover{background:#4452f0}
        .ta-btn:disabled{opacity:.6;cursor:not-allowed}
      `}</style>
    </div>
  );
}
