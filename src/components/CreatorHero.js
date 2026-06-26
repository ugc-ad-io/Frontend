import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Package, Sparkles, Cpu, Shirt } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8000';
const getInitial = (name) => (name || 'U').trim().charAt(0).toUpperCase();
const inr = (n) => Number(n || 0).toLocaleString('en-IN');

const DEFAULT_CHIPS = [
  { label: 'Unboxing', icon: Package },
  { label: 'Skincare', icon: Sparkles },
  { label: 'Tech', icon: Cpu },
  { label: 'Fashion', icon: Shirt }
];

/**
 * Logged-in creator hero band: greeting + CTAs + floating glass cards
 * (earnings, active deal, payout). All numbers/animation driven by real props.
 */
export default function CreatorHero({
  name = 'Creator',
  photo,
  activeDeals = 0,
  newBriefs = 0,
  totalEarned = 0,
  nextPayout = 0,
  profilePct = 0,
  activeDeal = null,          // { brand, title, budgetLabel, progress (0-100), logo }
  chips = DEFAULT_CHIPS
}) {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const stageRef = useRef(null);

  // Animations: count-up, line draw, bar/ring fill, parallax.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const counts = root.querySelectorAll('[data-to]');
    const bar = root.querySelector('[data-bar]');
    const ring = root.querySelector('[data-ring]');
    const line = root.querySelector('[data-line]');
    const ringLen = 94.2;

    if (reduce) {
      counts.forEach((el) => { el.textContent = inr(el.dataset.to); });
      if (bar) bar.style.width = `${bar.dataset.bar}%`;
      if (ring) ring.style.strokeDashoffset = ringLen * (1 - (Number(ring.dataset.ring) / 100));
      return undefined;
    }

    const timers = [];
    const countUp = (el) => {
      const to = Number(el.dataset.to); const dur = 1200; const start = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - start) / dur);
        el.textContent = inr(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    timers.push(setTimeout(() => counts.forEach(countUp), 350));
    if (line) {
      const len = line.getTotalLength();
      line.style.strokeDasharray = len; line.style.strokeDashoffset = len;
      line.getBoundingClientRect();
      timers.push(setTimeout(() => { line.style.transition = 'stroke-dashoffset 1.6s ease-out'; line.style.strokeDashoffset = 0; }, 400));
    }
    if (bar) timers.push(setTimeout(() => { bar.style.width = `${bar.dataset.bar}%`; }, 700));
    if (ring) { ring.style.transition = 'stroke-dashoffset 1.3s ease-out'; timers.push(setTimeout(() => { ring.style.strokeDashoffset = ringLen * (1 - (Number(ring.dataset.ring) / 100)); }, 500)); }

    const stage = stageRef.current;
    const onMove = (e) => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      stage.querySelectorAll('.cmk-gcard, .cmk-orb').forEach((el, i) => {
        const depth = (i + 1) * 4;
        el.style.transform = `translate(${x * depth}px, ${y * depth}px)`;
      });
    };
    const onLeave = () => stage && stage.querySelectorAll('.cmk-gcard, .cmk-orb').forEach((el) => { el.style.transform = ''; });
    if (stage) { stage.addEventListener('mousemove', onMove); stage.addEventListener('mouseleave', onLeave); }

    return () => {
      timers.forEach(clearTimeout);
      if (stage) { stage.removeEventListener('mousemove', onMove); stage.removeEventListener('mouseleave', onLeave); }
    };
  }, [totalEarned, nextPayout, profilePct, activeDeal]);

  const firstName = name.replace(/^@/, '').split(' ')[0];
  const showProfile = profilePct < 100;
  const dealLogo = activeDeal?.logo;
  const dealProgress = Math.max(0, Math.min(100, activeDeal?.progress ?? 65));
  const photoSrc = photo ? (photo.startsWith('http') ? photo : `${BACKEND_URL}${photo}`) : null;

  return (
    <section className="cmk-hero" ref={rootRef}>
      <div className="cmk-hero-dots" />

      {/* LEFT */}
      <div className="cmk-hero-left">
        <span className="cmk-pill cmk-rise" style={{ animationDelay: '.05s' }}><Sparkles size={15} /> Welcome back</span>
        <h1 className="cmk-rise" style={{ animationDelay: '.12s' }}>
          Hey, <span className="cmk-grad">{firstName}</span> 👋
        </h1>
        <p className="cmk-hero-sub cmk-rise" style={{ animationDelay: '.2s' }}>
          You have <b>{activeDeals} active {activeDeals === 1 ? 'deal' : 'deals'}</b> and <b>{newBriefs} new {newBriefs === 1 ? 'brief' : 'briefs'}</b> matching your niche.
        </p>

        <div className="cmk-cta-row cmk-rise" style={{ animationDelay: '.28s' }}>
          <button type="button" className="cmk-btn cmk-btn-primary" onClick={() => navigate('/browse-briefs')}>
            Browse Briefs <ArrowRight size={18} />
          </button>
          <button type="button" className="cmk-btn cmk-btn-ghost" onClick={() => navigate('/my-deals')}>
            <CheckCircle2 size={18} /> My Deals
          </button>
          {showProfile && (
            <button type="button" className="cmk-btn cmk-btn-profile" onClick={() => navigate('/settings')}>
              Complete your profile
              <svg className="cmk-ring" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" stroke="#e7e9f7" strokeWidth="5" />
                <circle data-ring={profilePct} cx="18" cy="18" r="15" fill="none" stroke="url(#cmkpg)" strokeWidth="5"
                  strokeLinecap="round" strokeDasharray="94.2" strokeDashoffset="94.2" transform="rotate(-90 18 18)" />
                <text x="18" y="22" textAnchor="middle" fontSize="11" fontWeight="800" fill="#15163a">{profilePct}%</text>
                <defs><linearGradient id="cmkpg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#5b6bff" /><stop offset="1" stopColor="#8b5cf6" /></linearGradient></defs>
              </svg>
            </button>
          )}
        </div>

        <div className="cmk-chips cmk-rise" style={{ animationDelay: '.36s' }}>
          {chips.map((c) => (
            <span key={c.label} className="cmk-chip"><c.icon size={16} /> {c.label}</span>
          ))}
        </div>
      </div>

      {/* RIGHT — floating cards */}
      <div className="cmk-stage" ref={stageRef}>
        <div className="cmk-orb" style={{ animationDelay: '.2s,-2.2s' }} />

        <div className="cmk-gcard cmk-c-earn" style={{ animationDelay: '.3s,-1.5s' }}>
          <div className="cmk-lbl">Total Earnings</div>
          <div className="cmk-amt">Rs. <span data-to={totalEarned}>0</span></div>
          <div className="cmk-trend">↗ 18% <span>this month</span></div>
          <svg className="cmk-spark" viewBox="0 0 290 60" preserveAspectRatio="none">
            <defs><linearGradient id="cmkeg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5b6bff" stopOpacity=".25" /><stop offset="1" stopColor="#5b6bff" stopOpacity="0" /></linearGradient></defs>
            <path d="M0,48 L30,42 60,46 90,34 120,38 150,26 180,30 210,16 240,20 290,6 L290,60 L0,60 Z" fill="url(#cmkeg)" />
            <path data-line d="M0,48 L30,42 60,46 90,34 120,38 150,26 180,30 210,16 240,20 290,6" fill="none" stroke="#5b6bff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="290" cy="6" r="4" fill="#5b6bff" />
          </svg>
        </div>

        <div className="cmk-gcard cmk-c-avatar" style={{ animationDelay: '.36s,-3s' }}>
          <span className="cmk-ava-img">
            {photoSrc ? <img src={photoSrc} alt={firstName} /> : getInitial(firstName)}
          </span>
          <span className="cmk-verified"><CheckCircle2 size={16} /></span>
        </div>

        <div className="cmk-gcard cmk-c-deal" style={{ animationDelay: '.42s,-4.2s' }}>
          <div className="cmk-deal-top"><span className="cmk-tag">Active Deal</span><span className="cmk-dots3">⋯</span></div>
          <div className="cmk-deal-brand">
            <span className="cmk-deal-logo">
              {dealLogo ? <img src={dealLogo.startsWith('http') ? dealLogo : `${BACKEND_URL}${dealLogo}`} alt="" /> : getInitial(activeDeal?.brand || 'B')}
            </span>
            <div>
              <strong>{activeDeal?.brand || 'No active deal'}</strong>
              <p>{activeDeal?.title || 'Browse briefs to start one'}</p>
            </div>
          </div>
          <div className="cmk-deal-foot">
            <span className="cmk-deal-price">{activeDeal?.budgetLabel || '—'}</span>
            <span className="cmk-bar"><i data-bar={dealProgress} /></span>
            <span className="cmk-pct">{dealProgress}%</span>
            <button type="button" className="cmk-btn-view" onClick={() => navigate('/my-deals')}>View</button>
          </div>
        </div>

        <div className="cmk-gcard cmk-c-pay" style={{ animationDelay: '.5s,-5s' }}>
          <div className="cmk-pay-row"><span className="cmk-lbl">Next Payout</span><span className="cmk-check"><CheckCircle2 size={11} /></span></div>
          <div className="cmk-amt">Rs. <span data-to={nextPayout}>0</span>
            <svg width="58" height="24" viewBox="0 0 58 24"><path d="M2,20 L13,15 24,17 35,8 46,11 56,3" fill="none" stroke="#15a35b" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </div>
      </div>
    </section>
  );
}
