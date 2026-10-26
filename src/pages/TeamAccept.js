import { useLiveEffect } from '../lib/liveUpdates';
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { apiErrorMessage } from '../utils/apiError';
import { useAuth } from '../App';
import { Users, Loader2 } from 'lucide-react';
import '../styles/web1-misc.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const API = `${BACKEND_URL}/api`;

export default function TeamAccept() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const { login } = useAuth();

  const [state, setState] = useState('loading'); // loading | ok | invalid | offline
  const [tick, setTick] = useState(0);
  const [invite, setInvite] = useState(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);

  useLiveEffect(() => {
    if (!token) { setState('invalid'); return; }
    axios.get(`${API}/team/invite/${token}`)
      .then((r) => { setInvite(r.data); setState('ok'); })
      // A 404 means the link is bad or expired; no response at all means we are offline / the
      // server is down, and the link may well still be good, so offer Retry instead of "invalid".
      .catch((err) => setState(err?.response && err.response.status < 500 ? 'invalid' : 'offline'));
  }, [token, tick]);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (password.length < 6) return toast.error('Password must be at least 6 characters.');
    if (password !== password2) return toast.error('Passwords do not match.');
    setBusy(true);
    try {
      const r = await axios.post(`${API}/team/accept`, { token, password, name });
      const { token: authToken, ...userData } = r.data;
      login(authToken, userData);
      toast.success(`Welcome to ${invite.brand_name}!`);
      navigate('/brand-home');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Could not accept the invitation'));
    } finally { setBusy(false); }
  };

  return (
    <div className="w1 ta-wrap">
      <div className="ta-card">
        <span className="ta-ic"><Users size={20} /></span>

        {state === 'loading' && <p className="ta-loading"><Loader2 size={18} className="ta-spin" /> Checking your invitation…</p>}

        {state === 'offline' && (
          <>
            <h1>Can&apos;t reach UGCad.io</h1>
            <p className="ta-sub">You&apos;re offline or our servers are not responding. Check your connection and try again. Your invitation link is still saved in this page&apos;s address.</p>
            <button type="button" className="ta-btn" onClick={() => { setState('loading'); setTick((t) => t + 1); }}>Try again</button>
          </>
        )}

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
              <label>Your name<input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Meet Rathod" /></label>
              <label>Password<input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" /></label>
              <label>Confirm password<input type="password" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="Re-enter password" /></label>
              <button type="submit" className="ta-btn" disabled={busy}>
                {busy ? 'Setting up…' : 'Accept & continue'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
