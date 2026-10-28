import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Check, RefreshCw, WifiOff } from 'lucide-react';
import AppShell from '../../shell/AppShell';
import { useLiveEffect } from '../../../lib/liveUpdates';
import { isShell } from '../../../utils/nativeBridge';
import './plans.css';

const API = `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api`;
const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

// Price and inclusions are marketing copy from the design board; the app has no expert-editing endpoint yet,
// so "Add expert editing" only says "Coming soon" (same as the website).
const PRICE = 1500;
const GST = 0.18;
const INCLUDED = [
  'Scroll-stopping first 3 seconds', 'Captions in your brand font', 'Trending music, licensed',
  'Colour grade & clean audio', 'Your logo, CTA and promo code', '9:16 + 1:1 + 4:5 cuts',
];
const OFFLINE = "You're offline. Check your connection and try again.";

const fmtDay = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

// "Add expert editing" only says "Coming soon": the mobile shell must not show a dead end.
export default function BrandEditAddon() {
  return isShell() ? <Navigate to="/brand-home" replace /> : <BrandEditAddonPage />;
}

function BrandEditAddonPage() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState(null);
  const [error, setError] = useState('');
  const [sel, setSel] = useState([]);

  // Videos you can have edited = campaigns whose work you already approved (status "completed").
  const load = () => {
    let live = true;
    axios.get(`${API}/campaigns`)
      .then((r) => {
        if (!live) return;
        const list = Array.isArray(r.data) ? r.data : (r.data?.campaigns || []);
        setCampaigns(list.filter((c) => c.status === 'completed'));
        setError('');
      })
      .catch((e) => { if (live) { setCampaigns((c) => c || []); setError(e?.response ? 'Could not load your approved videos.' : OFFLINE); } });
    return () => { live = false; };
  };
  useLiveEffect(load, []);

  const toggle = (id) => setSel((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const count = sel.length;
  const sub = count * PRICE;
  const gst = Math.round(sub * GST);
  const ready = fmtDay(Date.now() + 2 * 86400000);

  return (
    <AppShell back title="Expert editing" subtitle="Add-on for approved videos" tabs={false} className="ap-ad-shell">
      <section className="ap-card ap-ad-card">
        <h2>Turn raw videos into ready-to-run ads</h2>
        <p>UGCad.io’s in-house editors cut, caption and polish your approved videos, back in 48 hours.</p>
        <div className="ap-ad-price"><span><strong>{inr(PRICE)}</strong> / video</span><span>48-hour delivery · 1 free re-edit</span></div>
        <div className="ap-ad-inc">
          {INCLUDED.map((t) => <div key={t}><i><Check size={12} strokeWidth={3} /></i>{t}</div>)}
        </div>
      </section>

      <section className="ap-card">
        <div className="ap-ad-pick-h"><h3>Pick videos to edit</h3><small>Only approved videos</small></div>
        {campaigns === null ? (
          <div aria-hidden="true">{[0, 1, 2].map((i) => <div key={i} className="ap-skel" style={{ height: 56, margin: '10px 0' }} />)}</div>
        ) : error && campaigns.length === 0 ? (
          <div className="ap-ad-err" role="alert">
            {error === OFFLINE ? <WifiOff size={22} /> : null}
            <p>{error}</p>
            <button type="button" className="ap-btn ap-btn--sm" onClick={() => { setCampaigns(null); load(); }}><RefreshCw size={15} /> Retry</button>
          </div>
        ) : campaigns.length === 0 ? (
          <p className="ap-ad-note">No approved videos yet. Once you approve a creator’s work it shows up here.</p>
        ) : campaigns.map((c) => {
          const on = sel.includes(c.id);
          return (
            <button key={c.id} type="button" className={`ap-ad-row${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => toggle(c.id)}>
              <span className="ap-ad-box">{on && <Check size={14} strokeWidth={3} />}</span>
              <span className="ap-ad-thumb">{String(c.title || 'V').charAt(0).toUpperCase()}</span>
              <span className="ap-ad-row-t"><b>{c.title || 'Untitled campaign'}</b><small>Approved{fmtDay(c.completed_at || c.updated_at) ? ` ${fmtDay(c.completed_at || c.updated_at)}` : ''}</small></span>
              <b>{inr(PRICE)}</b>
            </button>
          );
        })}
      </section>

      <section className="ap-card">
        <div className="ap-ad-sum">
          <div><span>Editing · {count} video{count === 1 ? '' : 's'}</span><strong>{inr(sub)}</strong></div>
          <div><span>GST 18%</span><strong>{inr(gst)}</strong></div>
        </div>
        <p className="ap-ad-tip">On Growth, 1 edited video a month is included. <button type="button" onClick={() => navigate('/dashboard/business/plans')}>See plans</button></p>
        <p className="ap-ad-tip">Paid from your wallet. You review the edit like any other video.</p>
      </section>

      <div className="ap-ad-bar">
        <div><small>{count} video{count === 1 ? '' : 's'} · ready by {ready}</small><b>{inr(sub + gst)}</b></div>
        <button type="button" className="ap-btn" disabled={!count} onClick={() => toast('Coming soon')}>Add expert editing</button>
      </div>
    </AppShell>
  );
}
