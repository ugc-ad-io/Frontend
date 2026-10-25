import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import AppShell from '../../shell/AppShell';
import './plans.css';

const API = `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api`;
const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

// Plan facts below are marketing copy from the design board. The app has no plan or subscription endpoint yet,
// so the upgrade buttons only say "Coming soon" (same as the website).
const PLANS = [
  { key: 'starter', name: 'Starter', tag: 'Pay as you go', fee: 20, price: [0, 0], features: ['Pay only for videos you approve', 'Standard chat support', '2 free revisions per video', 'Raw footage always included'] },
  { key: 'growth', name: 'Growth', tag: 'For brands posting every month', fee: 15, price: [4999, 49990], popular: true, features: ['Lower 15% platform fee', 'A UGC expert checks every brief & script', 'Priority creator matching', '1 expert-edited video every month', '+2 extra free revisions', 'Priority support'] },
  { key: 'scale', name: 'Scale', tag: 'For brands running ads at scale', fee: 10, price: [14999, 149990], features: ['Lowest 10% platform fee', 'Personal campaign manager at every step', 'Unlimited script writing', '4 expert-edited videos every month', 'Ad-ready cuts in 9:16, 1:1 and 16:9', 'Monthly performance report', 'First pick of UGCAD.IO Choice creators'] },
];
const SPENDS = [25000, 50000, 100000, 300000];
const FAQ = [
  ['When does the lower fee start?', 'On every campaign and booking you start after upgrading.'],
  ['Can I cancel?', 'Yes, any time. You keep the plan until the end of the period you paid for.'],
  ['How do I pay?', 'From your UGCad wallet or by card / UPI. You get a GST invoice every month.'],
];

export default function BrandPlans() {
  const [yearly, setYearly] = useState(false);
  const [spend, setSpend] = useState(300000);
  const [fee, setFee] = useState(null); // the brand's real platform fee %, used to mark the current plan

  useEffect(() => {
    let live = true;
    axios.get(`${API}/business/settings/billing`)
      .then((r) => { if (live) setFee(Number(r.data?.commission_rate)); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const current = PLANS.find((p) => p.fee === fee)?.key;

  return (
    <AppShell back="/settings" title="Plans" subtitle="Lower fees, an expert at every step">
      <div className="ap-pl-seg" role="tablist" aria-label="Billing period">
        {[[false, 'Monthly'], [true, 'Yearly · save 17%']].map(([id, label]) => (
          <button key={label} type="button" role="tab" aria-selected={yearly === id} className={yearly === id ? 'is-on' : ''} onClick={() => setYearly(id)}>{label}</button>
        ))}
      </div>

      {PLANS.map((p) => {
        const amt = p.price[yearly ? 1 : 0];
        const isCur = current === p.key;
        return (
          <article key={p.key} className={`ap-card ap-pl-card${p.popular ? ' is-pop' : ''}`}>
            <div className="ap-pl-head">
              <div><h2>{p.name}</h2><small>{p.tag}</small></div>
              {isCur ? <span className="ap-pill">Current plan</span> : p.popular ? <span className="ap-pill ap-pl-pop">Most popular</span> : null}
            </div>
            <div className="ap-pl-price">
              <b>{amt === 0 ? 'Free' : inr(amt)}</b>
              <span>{amt === 0 ? 'no monthly cost' : yearly ? '/ year · 2 months free' : '/ month'}</span>
            </div>
            <div className="ap-pl-fee"><b>{p.fee}%</b><span>platform fee on every video</span></div>
            <ul className="ap-pl-list">
              {p.features.map((f) => <li key={f}><i><Check size={12} strokeWidth={3} /></i><span>{f}</span></li>)}
            </ul>
            {isCur
              ? <button type="button" className="ap-btn ap-btn--ghost ap-btn--block" onClick={() => toast(`You’re on ${p.name}`)}>Your plan</button>
              : <button type="button" className={`ap-btn ap-btn--block${p.popular ? ' ap-btn--light' : ''}`} onClick={() => toast('Coming soon')}>Upgrade to {p.name}</button>}
          </article>
        );
      })}

      <div className="ap-sec-h"><h2>Will it pay for itself?</h2></div>
      <section className="ap-card ap-pl-calc">
        <p>Pick roughly how much you spend on creator videos each month.</p>
        <div className="ap-chips" role="group" aria-label="Monthly spend">
          {SPENDS.map((s) => <button key={s} type="button" aria-pressed={spend === s} className={`ap-chip${spend === s ? ' is-on' : ''}`} onClick={() => setSpend(s)}>{inr(s)}</button>)}
        </div>
        {[['Growth', 0.05, 4999], ['Scale', 0.1, 14999]].map(([name, cut, cost]) => {
          const saved = Math.round(spend * cut); const net = saved - cost; const good = net > 0;
          return (
            <div key={name} className={`ap-pl-save${good ? ' is-good' : ''}`}>
              <span><strong>{name}</strong><small>Saves {inr(saved)} in fees − {inr(cost)} plan</small></span>
              <b>{good ? '+' : '−'}{inr(Math.abs(net))} / month</b>
            </div>
          );
        })}
      </section>

      <section className="ap-card ap-pl-faq">
        {FAQ.map(([q, a]) => <div key={q}><strong>{q}</strong><span>{a}</span></div>)}
      </section>
    </AppShell>
  );
}
