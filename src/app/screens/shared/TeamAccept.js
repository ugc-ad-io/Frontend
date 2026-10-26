import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Users, Loader2, WifiOff, Link2Off } from 'lucide-react';
import { useAuth } from '../../../App';
import { useLiveEffect } from '../../../lib/liveUpdates';
import { apiErrorMessage } from '../../../utils/apiError';
import PubFrame from './pubKit';

const API = `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api`;

// Team invitation (public link from the invite email). Same API + rules as the website's /team/accept.
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
      // A 4xx means the link is bad or expired; no response at all means offline / server down, and the link may still be good.
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
    <PubFrame title="Team invitation">
      <div className="ap-pub-center">
        <div className="ap-card ap-pub-card">
          {state === 'loading' && (
            <>
              <span className="ap-pub-ic"><Loader2 size={28} className="ap-pub-spin" /></span>
              <p role="status">Checking your invitation…</p>
            </>
          )}

          {state === 'offline' && (
            <>
              <span className="ap-pub-ic"><WifiOff size={28} /></span>
              <h1>Can’t reach UGCad.io</h1>
              <p>You’re offline or our servers are not responding. Check your connection and try again. Your invitation link is still saved in this page’s address.</p>
              <button type="button" className="ap-btn ap-btn--block" onClick={() => { setState('loading'); setTick((t) => t + 1); }}>Try again</button>
            </>
          )}

          {state === 'invalid' && (
            <>
              <span className="ap-pub-ic"><Link2Off size={28} /></span>
              <h1>Invitation not valid</h1>
              <p>This invitation link is invalid or has expired. Ask your workspace admin to send a new one.</p>
              <button type="button" className="ap-btn ap-btn--block" onClick={() => navigate('/auth')}>Go to sign in</button>
            </>
          )}

          {state === 'ok' && invite && (
            <>
              <span className="ap-pub-ic"><Users size={28} /></span>
              <span className="ap-pub-eyebrow">Team invitation</span>
              <h1>Join {invite.brand_name}</h1>
              <p>You’re joining as a <strong>{invite.role}</strong>. Set a password for <strong>{invite.email}</strong> to access the workspace.</p>
              <form onSubmit={submit} className="ap-pub-form">
                <label className="ap-label">Your name
                  <input className="ap-input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Meet Rathod" />
                </label>
                <label className="ap-label">Password
                  <input className="ap-input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 6 characters" />
                </label>
                <label className="ap-label">Confirm password
                  <input className="ap-input" type="password" autoComplete="new-password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="Re-enter password" />
                </label>
                <button type="submit" className="ap-btn ap-btn--block" style={{ height: 50 }} disabled={busy}>{busy ? 'Setting up…' : 'Accept & continue'}</button>
              </form>
            </>
          )}
        </div>
      </div>
    </PubFrame>
  );
}
