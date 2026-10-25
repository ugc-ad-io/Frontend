import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import BrandTopNavLayout from '../components/BrandTopNavLayout';
import '../styles/brand-ui.css';
import '../styles/brand-ui-home.css';
import '../styles/brand-ui-plans.css';
import '../styles/brand-ui-mobile-b.css';

const API = `${process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000'}/api`;
const inr = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

// Plan facts below are marketing copy from the design board (board 31). The app has no plan
// or subscription endpoint yet, so the upgrade buttons only say "Coming soon".
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

  const soon = () => toast('Coming soon');
  const current = PLANS.find((p) => p.fee === fee)?.key;

  return (
    <BrandTopNavLayout>
      <div className="bui-main bui-main--tight">
        <nav className="bui-crumb" aria-label="Breadcrumb"><Link to="/settings">Settings</Link><span>/</span><strong>Plans</strong></nav>
        <div className="bui-titlerow">
          <div>
            <h1 className="bui-h1">Plans for growing brands</h1>
            <p className="bui-sub">Lower fees, an expert at every step, and edited videos included. Cancel any time.</p>
          </div>
          <div className="bui-pl-seg" role="tablist">
            {[[false, 'Monthly'], [true, 'Yearly · save 17%']].map(([id, label]) => (
              <button key={label} type="button" role="tab" aria-selected={yearly === id} className={yearly === id ? 'is-on' : ''} onClick={() => setYearly(id)}>{label}</button>
            ))}
          </div>
        </div>

        <div className="bui-pl-grid">
          {PLANS.map((p) => {
            const amt = p.price[yearly ? 1 : 0];
            const isCur = current === p.key;
            return (
              <article key={p.key} className={`bui-pl-card${p.popular ? ' is-pop' : ''}`}>
                {p.popular && <span className="bui-hero-glow bui-pl-glow" aria-hidden="true" />}
                {isCur ? <span className="bui-pl-badge">Current plan</span> : p.popular ? <span className="bui-pl-badge bui-pl-badge--w">Most popular</span> : <span className="bui-pl-badge-gap" />}
                <div><div className="bui-pl-name">{p.name}</div><div className="bui-pl-tag">{p.tag}</div></div>
                <div className="bui-pl-price">
                  <b>{amt === 0 ? 'Free' : inr(amt)}</b>
                  <span>{amt === 0 ? 'no monthly cost' : yearly ? '/ year · 2 months free' : '/ month'}</span>
                </div>
                <div className="bui-pl-fee"><b>{p.fee}%</b><span>platform fee on every video</span></div>
                <ul className="bui-pl-list">
                  {p.features.map((f) => <li key={f}><span><Check size={12} strokeWidth={3} /></span>{f}</li>)}
                </ul>
                {isCur
                  ? <button type="button" className="bui-btn bui-btn--ghost bui-pl-cta" onClick={() => toast(`You’re on ${p.name}`)}>Your plan</button>
                  : <button type="button" className={`bui-btn bui-pl-cta${p.popular ? ' bui-btn--light' : ''}`} onClick={soon}>Upgrade to {p.name}</button>}
              </article>
            );
          })}
        </div>

        <section className="bui-panel bui-pl-calc">
          <div>
            <h2 className="bui-panel-t">Will it pay for itself?</h2>
            <p className="bui-pl-calc-s">Pick roughly how much you spend on creator videos each month.</p>
            <div className="bui-chips">
              {SPENDS.map((s) => <button key={s} type="button" className={`bui-chip${spend === s ? ' is-on' : ''}`} onClick={() => setSpend(s)}>{inr(s)} / month</button>)}
            </div>
          </div>
          <div className="bui-pl-saves">
            {[['Growth', 0.05, 4999], ['Scale', 0.1, 14999]].map(([name, cut, cost]) => {
              const saved = Math.round(spend * cut); const net = saved - cost; const good = net > 0;
              return (
                <div key={name} className={`bui-pl-save${good ? ' is-good' : ''}`}>
                  <span><strong>{name}</strong><small>Saves {inr(saved)} in fees − {inr(cost)} plan</small></span>
                  <b>{good ? '+' : '−'}{inr(Math.abs(net))} / month</b>
                </div>
              );
            })}
          </div>
        </section>

        <div className="bui-pl-faq">
          {FAQ.map(([q, a]) => <div key={q}><strong>{q}</strong><span>{a}</span></div>)}
        </div>
      </div>
    </BrandTopNavLayout>
  );
}
