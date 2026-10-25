import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import { useLiveEffect } from '../lib/liveUpdates';
import '../styles/brand-ui.css';
import '../styles/brand-ui-home.css';
import '../styles/brand-ui-addon.css';
import '../styles/brand-ui-mobile-b.css';

const API = `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api`;
const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

// Price and inclusions are marketing copy from the design board (board 32); the app has no
// expert-editing endpoint yet, so "Add expert editing" only says "Coming soon".
const PRICE = 1500;
const GST = 0.18;
const INCLUDED = [
  'Scroll-stopping first 3 seconds', 'Captions in your brand font', 'Trending music, licensed',
  'Colour grade & clean audio', 'Your logo, CTA and promo code', '9:16 + 1:1 + 4:5 cuts',
];

const fmtDay = (v) => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
};

export default function BrandEditAddon() {
  const [campaigns, setCampaigns] = useState(null);
  const [error, setError] = useState('');
  const [sel, setSel] = useState([]);

  // Videos you can have edited = campaigns whose work you already approved (status "completed").
  useLiveEffect(() => {
    let live = true;
    axios.get(`${API}/campaigns`)
      .then((r) => {
        if (!live) return;
        const list = Array.isArray(r.data) ? r.data : (r.data?.campaigns || []);
        setCampaigns(list.filter((c) => c.status === 'completed'));
        setError('');
      })
      .catch(() => { if (live) { setCampaigns((c) => c || []); setError('Could not load your approved videos.'); } });
    return () => { live = false; };
  }, []);

  const toggle = (id) => setSel((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const count = sel.length;
  const sub = count * PRICE;
  const gst = Math.round(sub * GST);
  const ready = fmtDay(Date.now() + 2 * 86400000);

  return (
    <BrandTopNavLayout>
      <div className="bui-main bui-main--tight">
        <nav className="bui-crumb" aria-label="Breadcrumb"><Link to="/dashboard/business/work-review">Work review</Link><span>/</span><strong>Expert editing</strong></nav>

        <section className="bui-hero bui-ad-hero">
          <span className="bui-hero-glow" aria-hidden="true" />
          <div className="bui-ad-hero-in">
            <div>
              <span className="bui-ad-pill">Add-on</span>
              <h1>Turn raw videos into ready-to-run ads</h1>
              <p>UGCad.io’s in-house editors cut, caption and polish your approved videos — back in 48 hours.</p>
              <div className="bui-ad-hero-price"><span><strong>{inr(PRICE)}</strong> / video</span><span>48-hour delivery · 1 free re-edit</span></div>
            </div>
            <div className="bui-ad-demo" aria-hidden="true">
              <div><div className="bui-ad-phone bui-ad-phone--raw" /><span>Raw</span></div>
              <div><div className="bui-ad-phone bui-ad-phone--edit"><em>Captions in your brand font</em></div><span className="is-on">Edited by UGCad.io</span></div>
            </div>
          </div>
        </section>

        <div className="bui-ad-cols">
          <div className="bui-ad-main">
            <section className="bui-panel">
              <h2 className="bui-ad-h">What’s included</h2>
              <div className="bui-ad-inc">
                {INCLUDED.map((t) => <div key={t}><span><Check size={12} strokeWidth={3} /></span>{t}</div>)}
              </div>
            </section>

            <section className="bui-panel bui-ad-pick">
              <div className="bui-ad-pick-h"><h2 className="bui-ad-h">Pick videos to edit</h2><span>Only approved videos</span></div>
              {campaigns === null ? (
                <p className="bui-ad-note">Loading your approved videos…</p>
              ) : error && campaigns.length === 0 ? (
                <p className="bui-ad-note" role="alert">{error}</p>
              ) : campaigns.length === 0 ? (
                <p className="bui-ad-note">No approved videos yet. Once you approve a creator’s work it shows up here.</p>
              ) : campaigns.map((c) => {
                const on = sel.includes(c.id);
                return (
                  <button key={c.id} type="button" className={`bui-ad-row${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => toggle(c.id)}>
                    <span className="bui-ad-box">{on && <Check size={14} strokeWidth={3} />}</span>
                    <span className="bui-ad-thumb">{String(c.title || 'V').charAt(0).toUpperCase()}</span>
                    <span className="bui-ad-row-t"><b>{c.title || 'Untitled campaign'}</b><small>Approved{fmtDay(c.completed_at || c.updated_at) ? ` ${fmtDay(c.completed_at || c.updated_at)}` : ''}</small></span>
                    <b>{inr(PRICE)}</b>
                  </button>
                );
              })}
            </section>
          </div>

          <aside className="bui-ad-sum">
            <div className="bui-ad-sum-h">
              <span className="bui-hero-glow bui-hero-glow--intro" aria-hidden="true" />
              <small>{count} video{count === 1 ? '' : 's'} · ready by {ready}</small>
              <b>{inr(sub + gst)}</b>
            </div>
            <div className="bui-ad-sum-b">
              <div className="bui-ad-sum-r"><span>Editing</span><strong>{inr(sub)}</strong></div>
              <div className="bui-ad-sum-r"><span>GST 18%</span><strong>{inr(gst)}</strong></div>
              <div className="bui-ad-sum-tip">On Growth, 1 edited video a month is included. <Link to="/dashboard/business/plans">See plans →</Link></div>
              <button type="button" className="bui-btn bui-btn--tall bui-btn--block" disabled={!count} onClick={() => toast('Coming soon')}>Add expert editing</button>
              <span className="bui-ad-sum-f">Paid from your wallet. You review the edit like any other video.</span>
            </div>
          </aside>
        </div>
      </div>
    </BrandTopNavLayout>
  );
}
