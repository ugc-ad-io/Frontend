import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useTheme } from '../App';
import {
  ArrowRight,
  Sparkles,
  Play,
  Plus,
  Minus,
  LogIn,
  Menu,
  X,
  Linkedin,
  Instagram,
  ChevronDown,
  Clock,
} from 'lucide-react';
import { motion } from 'framer-motion';

// ── Static content (edit freely) ──────────────────────────────────────────

const BRANDS = ['perfora', 'GABIT', 'P·TAL', 'Mudrex', 'Glossier', 'Diabexy'];

const WHY = [
  {
    emoji: '💼',
    title: (
      <>
        Get <span className="cl-hi">discovered</span> by top tier brands
      </>
    ),
    body:
      'From fast-growing D2C startups to category-leading apps, on UGCad, brands actively search for creators like you.',
  },
  {
    emoji: '💰',
    title: (
      <>
        <span className="cl-hi">Paid</span> Projects
      </>
    ),
    body:
      "Forget the back-and-forth. You'll receive clear briefs, deadlines, and guaranteed payouts for every project. You just focus on creating.",
  },
  {
    emoji: '👍',
    title: (
      <>
        Work that <span className="cl-hi">fits your style</span>
      </>
    ),
    body:
      'Whether you excel at unboxing, storytelling, or product demos, we match you with brands looking for exactly your kind of content.',
  },
  {
    emoji: '📈',
    title: (
      <>
        Build your <span className="cl-hi">portfolio</span> as you earn
      </>
    ),
    body:
      'Every project adds to your creator profile, helping you land higher-paying gigs over time.',
  },
];

const COMMUNITY = [
  { name: 'Astha', av: ['#a78bfa', '#5b21b6'] },
  { name: 'Ishita', av: ['#f0abfc', '#7c3aed'] },
  { name: 'Chirag', av: ['#818cf8', '#4338ca'] },
  { name: 'Aishwarya', av: ['#c4b5fd', '#6d28d9'] },
  { name: 'Jaspreet', av: ['#a78bfa', '#4c1d95'] },
  { name: 'Aishwarya', av: ['#ddd6fe', '#7c3aed'] },
];

const FAQS = [
  {
    q: 'Do I need a big following to get brand deals?',
    a: 'No. Brands here care about content quality and audience fit, not vanity metrics. Micro and nano creators win projects every day.',
  },
  {
    q: 'What kinds of videos will I be creating?',
    a: 'Short-form UGC — unboxings, product demos, reviews, and storytelling reels — across beauty, tech, food, fashion, fitness and dozens of other niches.',
  },
  {
    q: 'Is there a fee to join UGCad?',
    a: 'Joining is completely free. A small service fee applies only on completed, paid collaborations — we succeed when you do.',
  },
  {
    q: 'Do I need professional equipment?',
    a: 'No. A good smartphone camera and natural light are enough to start. Brands value authentic content over studio production.',
  },
];

// Each footer column can stack multiple sections (e.g. Product + Legal).
const FOOTER_COLS = [
  [
    { title: 'Product', links: ['Login', 'Intelligence', 'Sign up'] },
    { title: 'Legal', links: ['Privacy Policy', 'Terms of Service'] },
  ],
  [
    {
      title: 'Alternatives',
      links: [
        'UGCad vs. Billo',
        'UGCad vs. ContentBeta',
        'UGCad vs. Icons.com',
        'UGCad vs. Testimonial Hero',
      ],
    },
    { title: 'Blog', links: ['All Posts', 'Case Studies'] },
  ],
  [{ title: 'US', links: ['Austin', 'Chicago', 'Francisco', 'La', 'Miami', 'NYC'] }],
  [
    {
      title: 'India',
      links: [
        'Bangalore', 'Delhi', 'Mumbai', 'Hyderabad', 'Jaipur',
        'Chennai', 'Gurugram', 'Noida', 'Ahmedabad', 'Indore',
      ],
    },
  ],
];

// ── Mini UI mockups for the "How this works?" steps ────────────────────────
function Bar({ pct }) {
  return (
    <div className="cl-mock__bar">
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

const STEPS = [
  {
    n: 1,
    title: 'Sign Up',
    sub: 'Create your free UGCad creator account.',
    mock: (
      <div className="cl-mock">
        <div className="cl-mock__steps">
          {['Create Account', 'Verify account', 'Fill the details'].map((s, i) => (
            <div key={s} className="cl-mock__step">
              <span className={`cl-mock__dot${i === 0 ? ' cl-mock__dot--on' : ''}`}>{i + 1}</span>
              <span className="cl-mock__steptxt">{s}</span>
            </div>
          ))}
        </div>
        <div className="cl-mock__panel cl-mock__panel--center">
          <div className="cl-mock__h">Create an account as a freelancer</div>
          <div className="cl-mock__muted">Get Started for free</div>
          <div className="cl-mock__field" />
        </div>
      </div>
    ),
  },
  {
    n: 2,
    title: 'Get Verified ✅',
    sub: 'We review your profile.',
    mock: (
      <div className="cl-mock">
        <div className="cl-mock__label">Dashboard</div>
        <div className="cl-mock__panel">
          <div className="cl-mock__h">Complete the Profile</div>
          <div className="cl-mock__muted">Build the Profile to access more opportunities</div>
          <Bar pct={98} />
          <div className="cl-mock__rowend cl-mock__pct">98%</div>
          <div className="cl-mock__btn">Complete Profile</div>
        </div>
      </div>
    ),
  },
  {
    n: 3,
    title: 'Build Your Profile 📊',
    sub: 'Add your skills, sample videos, and niche.',
    mock: (
      <div className="cl-mock">
        <span className="cl-mock__pill">● INCOMPLETE</span>
        <div className="cl-mock__panel">
          <div className="cl-mock__h">Complete Profile to Launch Portfolio</div>
          <Bar pct={98} />
          <div className="cl-mock__rowend cl-mock__pct">98%</div>
          <div className="cl-mock__kv">
            <span>Personal Details</span><span className="cl-mock__pct">88%</span>
          </div>
          <div className="cl-mock__kv">
            <span>Professional Details</span><span className="cl-mock__pct cl-mock__pct--ok">100%</span>
          </div>
        </div>
      </div>
    ),
  },
  {
    n: 4,
    title: 'Apply to Jobs 🚀',
    sub: 'We review your profile.',
    mock: (
      <div className="cl-mock">
        <div className="cl-mock__h">21 Jobs</div>
        <div className="cl-mock__muted">Available Jobs for you</div>
        <span className="cl-mock__chip">Available Projects</span>
        <div className="cl-mock__card">
          <div className="cl-mock__cardtop">
            <span className="cl-mock__chip cl-mock__chip--accent">Creator Canvas</span>
            <span className="cl-mock__muted cl-mock__muted--sm"><Clock size={11} /> Posted 3 hours ago</span>
          </div>
          <div className="cl-mock__h2">Smartwatch Promo AD</div>
          <div className="cl-mock__muted cl-mock__muted--sm">Technology &nbsp;|&nbsp; Villgro</div>
        </div>
      </div>
    ),
  },
  {
    n: 5,
    title: 'Start Creating 🌟',
    sub: 'Receive briefs, create content, and get paid',
    mock: (
      <div className="cl-mock">
        <div className="cl-mock__line"><Play size={11} /> Raw Edited video - 1</div>
        <div className="cl-mock__muted cl-mock__muted--sm">✓ Color Grade : Enhance the colors</div>
        <div className="cl-mock__card">
          <div className="cl-mock__cardtop">
            <span className="cl-mock__h2">Final Edited Video</span>
            <span className="cl-mock__approved">Approved</span>
          </div>
          <div className="cl-mock__thumb"><Play size={20} /></div>
        </div>
      </div>
    ),
  },
];

export default function CreatorLanding() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(0);
  // Theme is global now (controlled from the home page); this page just follows it.
  const { theme } = useTheme();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleJoin = () => {
    if (user) {
      if (user.role === 'creator') navigate('/dashboard/creator');
      else navigate('/');
    } else {
      navigate('/auth?mode=signup&role=creator');
    }
  };

  const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    visible: (i = 0) => ({
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, delay: i * 0.08, ease: 'easeOut' },
    }),
  };

  const NAV_LINKS = ['Explore Creators', 'Pricing', 'Intelligence', 'Others'];

  return (
    <div className="cl-root" data-theme={theme}>
      {/* ── Animated background blobs ──────────────────────────────────── */}
      <div className="cl-bg" aria-hidden="true">
        <div className="cl-blob cl-blob--1" />
        <div className="cl-blob cl-blob--2" />
        <div className="cl-blob cl-blob--3" />
      </div>

      {/* ── Navbar ─────────────────────────────────────────────────────── */}
      <motion.header
        className={`cl-nav${scrolled ? ' cl-nav--scrolled' : ''}`}
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="cl-nav__inner">
          <button className="cl-brand" onClick={() => navigate('/')}>
            <img src="/ugcad-logo.png" alt="UGCad.io" className="cl-brand__logo" />
          </button>
          <nav className="cl-nav__links">
            {NAV_LINKS.map((l) => (
              <a key={l} className="cl-navlink" href="#why">
                {l}{l === 'Others' && <ChevronDown size={14} />}
              </a>
            ))}
          </nav>
          <div className="cl-nav__actions">
            <button className="cl-navlink cl-navlink--accent" onClick={handleJoin}>Join as <em>Creator</em></button>
            <button className="cl-btn-login" onClick={() => navigate('/auth?role=creator')}>
              <LogIn size={16} /> Log in
            </button>
            <button className="cl-btn-signup" onClick={handleJoin}>Sign Up</button>
          </div>
          <button
            className="cl-nav__burger"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        <div className={`cl-nav__mobile${menuOpen ? ' cl-nav__mobile--open' : ''}`}>
          {NAV_LINKS.map((l) => (
            <a key={l} className="cl-navlink" href="#why" onClick={() => setMenuOpen(false)}>{l}</a>
          ))}
          <div className="cl-nav__mobile-actions">
            <button className="cl-btn-login" onClick={() => { setMenuOpen(false); navigate('/auth?role=creator'); }}>
              <LogIn size={16} /> Log in
            </button>
            <button className="cl-btn-signup" onClick={() => { setMenuOpen(false); handleJoin(); }}>
              Sign Up
            </button>
          </div>
        </div>
      </motion.header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="cl-hero">
        <div className="cl-hero__main">
          <motion.h1
            className="cl-hero__title"
            variants={fadeUp} initial="hidden" animate="visible" custom={0}
          >
            Become a Paid <span className="cl-hi">UGC Creator</span>
          </motion.h1>

          <motion.p
            className="cl-hero__sub"
            variants={fadeUp} initial="hidden" animate="visible" custom={1}
          >
            Turn your content skills into income. Create videos for brands, get
            paid, and grow your personal brand.
          </motion.p>

          <motion.div
            className="cl-hero__ctas"
            variants={fadeUp} initial="hidden" animate="visible" custom={2}
          >
            <button className="cl-btn-primary cl-btn-primary--lg" onClick={handleJoin}>
              Get Started <ArrowRight size={18} />
            </button>
          </motion.div>

          <motion.p
            className="cl-hero__login"
            variants={fadeUp} initial="hidden" animate="visible" custom={3}
          >
            Already signed up?{' '}
            <button className="cl-hero__login-link" onClick={() => navigate('/auth?role=creator')}>Login</button>
          </motion.p>
        </div>

        {/* ── Brand strip — pinned to the bottom of the hero ──────────────── */}
        <motion.div
          className="cl-brands"
          variants={fadeUp} initial="hidden" animate="visible" custom={4}
        >
          <div className="cl-brands__row">
            {BRANDS.slice(0, 3).map((b) => <span key={b} className="cl-brands__logo">{b}</span>)}
            <span className="cl-brands__trust">Trusted by <strong>100+</strong><br />growing brands</span>
            {BRANDS.slice(3).map((b) => <span key={b} className="cl-brands__logo">{b}</span>)}
          </div>
        </motion.div>
      </section>

      {/* ── Why Join UGCad ───────────────────────────────────────── */}
      <section id="why" className="cl-section">
        <motion.div
          className="cl-section__head"
          variants={fadeUp} initial="hidden" animate="visible"
        >
          <span className="cl-joinpill">Join us</span>
          <h2 className="cl-section__title">Why Join UGCad?</h2>
          <p className="cl-section__sub">
            Forget cold DMs, endless pitching, and waiting months for a reply. At UGCad, brands
            come to you, ready with briefs, budgets, and timelines. You focus on creating, we handle the rest.
          </p>
        </motion.div>

        <div className="cl-why">
          {WHY.map(({ emoji, title, body }, i) => (
            <motion.div
              key={i}
              className="cl-whycard"
              variants={fadeUp} initial="hidden" animate="visible" custom={i % 2}
            >
              <div className="cl-whycard__icon">
                <span className="cl-whycard__emoji">{emoji}</span>
                <Sparkles className="cl-whycard__spark" size={18} />
              </div>
              <div className="cl-whycard__text">
                <h3 className="cl-whycard__title">{title}</h3>
                <p className="cl-whycard__body">{body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Connect with a Global Community ────────────────────────────── */}
      <section className="cl-section">
        <motion.div
          className="cl-section__head"
          variants={fadeUp} initial="hidden" animate="visible"
        >
          <span className="cl-joinpill">Community</span>
          <h2 className="cl-section__title">Connect with a <span className="cl-hi">Global</span> Community</h2>
        </motion.div>

        <div className="cl-community">
          {COMMUNITY.map(({ name, av }, i) => (
            <motion.div
              key={i}
              className="cl-vid"
              variants={fadeUp} initial="hidden" animate="visible" custom={i % 6}
            >
              <div className="cl-vid__thumb" style={{ background: `linear-gradient(160deg, ${av[0]}, ${av[1]})` }}>
                <span className="cl-vid__play"><Play size={20} fill="#fff" /></span>
              </div>
              <div className="cl-vid__meta">
                <span className="cl-vid__avatar" style={{ background: `linear-gradient(135deg, ${av[0]}, ${av[1]})` }} />
                <span className="cl-vid__name">{name}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── How this works ─────────────────────────────────────────────── */}
      <section id="how" className="cl-section">
        <motion.div
          className="cl-section__head"
          variants={fadeUp} initial="hidden" animate="visible"
        >
          <span className="cl-joinpill">Community</span>
          <h2 className="cl-section__title">How this <span className="cl-hi">works?</span></h2>
        </motion.div>

        <div className="cl-steps2">
          {STEPS.map(({ n, title, sub, mock }, i) => (
            <motion.div
              key={n}
              className="cl-step2"
              variants={fadeUp} initial="hidden" animate="visible" custom={i % 3}
            >
              <span className="cl-step2__num">{n}</span>
              <h3 className="cl-step2__title">{title}</h3>
              <p className="cl-step2__sub">{sub}</p>
              {mock}
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────────────────── */}
      <section id="faq" className="cl-section cl-section--narrow">
        <motion.div
          className="cl-section__head"
          variants={fadeUp} initial="hidden" animate="visible"
        >
          <h2 className="cl-section__title">Frequently Asked Questions</h2>
        </motion.div>

        <div className="cl-faq">
          {FAQS.map(({ q, a }, i) => {
            const open = openFaq === i;
            return (
              <div key={q} className={`cl-faq__item${open ? ' cl-faq__item--open' : ''}`}>
                <button className="cl-faq__q" onClick={() => setOpenFaq(open ? -1 : i)}>
                  <span>{q}</span>
                  {open ? <Minus size={18} /> : <Plus size={18} />}
                </button>
                {open && <p className="cl-faq__a">{a}</p>}
              </div>
            );
          })}
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="cl-footer">
        <div className="cl-footer__inner">
          <div className="cl-footer__brandcol">
            <button className="cl-brand" onClick={() => navigate('/')}>
              <img src="/ugcad-logo.png" alt="UGCad.io" className="cl-brand__logo" />
            </button>
            <p className="cl-footer__tag">One Marketplace for All Video Production Needs</p>
            <div className="cl-footer__social">
              <a href="#why" aria-label="LinkedIn"><Linkedin size={18} /></a>
              <a href="#why" aria-label="Instagram"><Instagram size={18} /></a>
            </div>
            <button className="cl-btn-primary cl-footer__cta" onClick={handleJoin}>
              Sign up Now <ArrowRight size={16} />
            </button>
            <p className="cl-footer__copy">UGCad © {new Date().getFullYear()}. All rights reserved.</p>
          </div>

          <div className="cl-footer__cols">
            {FOOTER_COLS.map((sections, ci) => (
              <div key={ci} className="cl-footer__col">
                {sections.map(({ title, links }) => (
                  <div key={title} className="cl-footer__group">
                    <div className="cl-footer__coltitle">{title}</div>
                    {links.map((l) => (
                      <a key={l} className="cl-footer__link" href="#why">{l}</a>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </footer>

      {/* ── Styles ─────────────────────────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap');

        .cl-root {
          /* ── LIGHT theme (default) ── */
          --cl-purple: #6d4af0;          /* accent — deepened so it reads on light */
          --cl-purple-deep: #5b37e0;
          --cl-fg: 28, 27, 75;           /* foreground RGB (navy) for text/borders/surfaces */
          --cl-bg: #ecebf8;              /* page background (light lavender) */
          --cl-text: #1c1b4b;            /* solid headings/body text */
          --cl-nav-bg: rgba(255,255,255,0.82);
          --cl-panel: rgba(255,255,255,0.7);   /* darker mockup panels */
          --cl-blob: linear-gradient(135deg, #d8d0ff 0%, #c3b8ff 100%);
          --cl-blob-op: 0.5;
          min-height: 100vh;
          background: var(--cl-bg);
          color: var(--cl-text);
          font-family: 'Instrument Sans', 'Inter', sans-serif;
          position: relative;
          overflow-x: hidden;
          transition: background 0.3s ease, color 0.3s ease;
        }
        /* ── DARK theme ── */
        .cl-root[data-theme="dark"] {
          --cl-purple: #A78BFA;
          --cl-purple-deep: #9170f0;
          --cl-fg: 255, 255, 255;
          --cl-bg: #0a0a0a;
          --cl-text: #ffffff;
          --cl-nav-bg: rgba(10,10,10,0.72);
          --cl-panel: rgba(10,10,14,0.6);
          --cl-blob: linear-gradient(135deg, #07074e 0%, #1a1466 100%);
          --cl-blob-op: 0.55;
        }
        .cl-root *, .cl-root *::before, .cl-root *::after { box-sizing: border-box; }
        .cl-root h1, .cl-root h2, .cl-root h3, .cl-root p, .cl-root span,
        .cl-root a, .cl-root button, .cl-root div { color: var(--cl-text); }
        .cl-hi { background: linear-gradient(120deg, var(--cl-purple), var(--cl-purple-deep));
          -webkit-background-clip: text; background-clip: text;
          -webkit-text-fill-color: transparent; color: transparent !important; }
        /* Text that always sits on a purple fill stays white in both themes. */
        .cl-btn-primary, .cl-btn-signup, .cl-joinpill, .cl-step2__num,
        .cl-mock__btn, .cl-mock__dot--on, .cl-vid__play { color: #fff !important; }

        /* Background blobs */
        .cl-bg { position: fixed; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
        .cl-blob { position: absolute; border-radius: 50%;
          background: var(--cl-blob);
          filter: blur(90px); opacity: var(--cl-blob-op); will-change: transform; }
        .cl-blob--1 { width: 520px; height: 520px; top: -8%; left: 8%; animation: clFloat1 22s ease-in-out infinite; }
        .cl-blob--2 { width: 480px; height: 480px; top: 30%; right: 5%; animation: clFloat2 26s ease-in-out infinite; }
        .cl-blob--3 { width: 440px; height: 440px; bottom: 2%; left: 35%; animation: clFloat1 24s ease-in-out infinite 2s; }
        @keyframes clFloat1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(60px,-50px) scale(1.12); } }
        @keyframes clFloat2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-80px,40px) scale(1.1); } }
        @media (prefers-reduced-motion: reduce) { .cl-blob { animation: none !important; } }

        /* Brand mark */
        .cl-brand { display: inline-flex; align-items: center; gap: 9px; background: none;
          border: none; cursor: pointer; padding: 0; }
        .cl-brand__logo { height: 34px; width: auto; display: block; }
        .cl-brand__mark { width: 22px; height: 22px; border-radius: 6px;
          background: linear-gradient(135deg, #A78BFA, #7c3aed);
          box-shadow: 0 4px 14px rgba(167,139,250,0.5); }
        .cl-brand__name { font-size: 1.25rem; font-weight: 700; letter-spacing: -0.01em; }
        .cl-brand__name-2 { font-weight: 500; color: rgba(var(--cl-fg),0.7) !important; }

        /* Navbar */
        .cl-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; padding: 18px 6%; transition: all 0.3s ease; }
        .cl-nav--scrolled { padding: 12px 6%; background: var(--cl-nav-bg);
          backdrop-filter: blur(14px); border-bottom: 1px solid rgba(var(--cl-fg),0.07); }
        .cl-nav__inner { display: flex; align-items: center; gap: 30px; max-width: 1320px; margin: 0 auto; }
        .cl-nav__links { display: flex; align-items: center; gap: 26px; }
        .cl-navlink { display: inline-flex; align-items: center; gap: 4px; font-size: 0.94rem; font-weight: 500;
          color: rgba(var(--cl-fg),0.82) !important; text-decoration: none; background: none; border: none;
          cursor: pointer; transition: color 0.2s; }
        .cl-navlink:hover { color: #fff !important; }
        .cl-nav__actions { margin-left: auto; display: flex; gap: 14px; align-items: center; }
        .cl-navlink--accent { color: var(--cl-purple) !important; }
        .cl-navlink--accent em { font-style: italic; }
        .cl-btn-login { display: inline-flex; align-items: center; gap: 7px; padding: 9px 18px; border-radius: 10px;
          border: 1px solid rgba(var(--cl-fg),0.25); background: transparent; font-weight: 500; font-size: 0.92rem;
          cursor: pointer; transition: all 0.2s; }
        .cl-btn-login:hover { border-color: rgba(var(--cl-fg),0.55); }
        .cl-btn-signup { padding: 9px 22px; border-radius: 10px; border: 1px solid var(--cl-purple);
          background: var(--cl-purple); font-weight: 600; font-size: 0.92rem; cursor: pointer; transition: all 0.2s; }
        .cl-btn-signup:hover { background: var(--cl-purple-deep); border-color: var(--cl-purple-deep); }
        /* Theme toggle (sun/moon pill switch) */
        .cl-theme { position: relative; width: 64px; height: 30px; border-radius: 999px; cursor: pointer;
          border: 1px solid rgba(var(--cl-fg),0.18); background: rgba(var(--cl-fg),0.08); padding: 0;
          flex-shrink: 0; transition: background 0.25s ease; }
        .cl-theme__knob { position: absolute; top: 2px; left: 2px; width: 24px; height: 24px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; color: #fff;
          background: linear-gradient(135deg, #4f7cff, #2f5be6); box-shadow: 0 2px 8px rgba(47,91,230,0.5);
          transition: transform 0.28s cubic-bezier(0.4,0,0.2,1); z-index: 2; }
        .cl-theme--dark .cl-theme__knob { transform: translateX(34px);
          background: linear-gradient(135deg, #3a3a55, #20202f); box-shadow: 0 2px 8px rgba(0,0,0,0.5); }
        .cl-theme__icon { position: absolute; top: 50%; transform: translateY(-50%); display: flex;
          align-items: center; justify-content: center; color: rgba(var(--cl-fg),0.5); z-index: 1; }
        .cl-theme__icon--sun { left: 8px; }
        .cl-theme__icon--moon { right: 8px; }
        .cl-nav__burger { display: none; margin-left: auto; width: 42px; height: 42px; align-items: center;
          justify-content: center; border-radius: 12px; border: 1px solid rgba(var(--cl-fg),0.2);
          background: rgba(var(--cl-fg),0.06); cursor: pointer; }
        .cl-nav__mobile { display: none; flex-direction: column; gap: 4px; margin: 12px 4px 0; padding: 14px;
          border-radius: 16px; background: rgba(18,18,22,0.97); border: 1px solid rgba(var(--cl-fg),0.12);
          box-shadow: 0 24px 60px rgba(0,0,0,0.5); }
        .cl-nav__mobile--open { display: flex; }
        .cl-nav__mobile .cl-navlink { padding: 12px; border-radius: 10px; }
        .cl-nav__mobile-actions { display: flex; gap: 10px; margin-top: 8px; padding-top: 12px;
          border-top: 1px solid rgba(var(--cl-fg),0.1); }
        .cl-nav__mobile-actions .cl-btn-login, .cl-nav__mobile-actions .cl-btn-signup { flex: 1; justify-content: center; }

        /* Layout helpers */
        .cl-section { position: relative; z-index: 1; max-width: 1180px; margin: 0 auto; padding: 80px 6%; }
        .cl-section--narrow { max-width: 920px; }
        .cl-section__head { text-align: center; max-width: 760px; margin: 0 auto 52px; }
        .cl-joinpill { display: inline-block; padding: 7px 18px; border-radius: 999px; font-size: 0.84rem;
          font-weight: 600; margin-bottom: 18px; background: var(--cl-purple);
          box-shadow: 0 8px 22px rgba(167,139,250,0.4); }
        .cl-section__title { font-size: clamp(1.9rem, 4vw, 2.7rem); font-weight: 700; line-height: 1.12; margin: 0 0 16px; }
        .cl-section__sub { font-size: 1.05rem; line-height: 1.65; color: rgba(var(--cl-fg),0.62) !important; margin: 0; }

        /* Hero */
        .cl-hero { position: relative; z-index: 1; max-width: 1100px; margin: 0 auto;
          min-height: 100vh; display: flex; flex-direction: column; padding: 120px 6% 36px; }
        .cl-hero__main { flex: 1; display: flex; flex-direction: column; justify-content: center;
          align-items: center; text-align: center; }
        .cl-hero__title { font-size: clamp(2.4rem, 6vw, 4.4rem); font-weight: 700; line-height: 1.06;
          letter-spacing: -0.02em; margin: 0 0 22px; }
        .cl-hero__sub { font-size: clamp(1.05rem, 2vw, 1.25rem); line-height: 1.6;
          color: rgba(var(--cl-fg),0.68) !important; max-width: 600px; margin: 0 auto 34px; }
        .cl-hero__ctas { display: flex; justify-content: center; }
        .cl-hero__login { margin: 18px 0 0; font-size: 0.98rem; color: rgba(var(--cl-fg),0.6) !important; }
        .cl-hero__login-link { background: none; border: none; padding: 0; cursor: pointer; font-size: inherit;
          font-weight: 600; color: var(--cl-purple) !important; }
        .cl-hero__login-link:hover { color: #c4b3ff !important; }
        .cl-btn-primary { display: inline-flex; align-items: center; gap: 9px; padding: 14px 28px; border-radius: 12px;
          border: none; background: linear-gradient(120deg, #A78BFA, #8f6ff0); font-size: 1rem; font-weight: 600;
          cursor: pointer; box-shadow: 0 12px 34px rgba(167,139,250,0.35); transition: all 0.2s; }
        .cl-btn-primary:hover { transform: translateY(-2px); box-shadow: 0 16px 42px rgba(167,139,250,0.5); }
        .cl-btn-primary--lg { padding: 16px 40px; font-size: 1.08rem; }

        /* Brand strip — sits at the bottom of the full-height hero */
        .cl-brands { position: relative; z-index: 1; margin-top: auto; padding: 20px 0 4px; }
        .cl-brands__row { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 14px 44px; }
        .cl-brands__logo { font-size: 1.35rem; font-weight: 700; letter-spacing: 0.02em;
          color: rgba(var(--cl-fg),0.5) !important; font-family: Georgia, 'Times New Roman', serif; }
        .cl-brands__trust { font-size: 0.92rem; line-height: 1.3; text-align: center;
          color: rgba(var(--cl-fg),0.65) !important; }
        .cl-brands__trust strong { color: var(--cl-purple) !important; }

        /* Why join — horizontal feature cards */
        .cl-why { display: flex; flex-direction: column; gap: 22px; }
        .cl-whycard { display: flex; align-items: center; gap: 36px; padding: 30px 38px; border-radius: 22px;
          border: 1px solid rgba(var(--cl-fg),0.08); background: rgba(var(--cl-fg),0.025); transition: all 0.25s; }
        .cl-whycard:hover { border-color: rgba(167,139,250,0.4); background: rgba(167,139,250,0.06); transform: translateY(-3px); }
        .cl-whycard__icon { position: relative; flex-shrink: 0; width: 150px; height: 150px; border-radius: 18px;
          display: flex; align-items: center; justify-content: center; border: 1px solid rgba(167,139,250,0.3);
          background: rgba(167,139,250,0.08); }
        .cl-whycard__emoji { font-size: 3.4rem; line-height: 1; }
        .cl-whycard__spark { position: absolute; top: 16px; right: 18px; color: var(--cl-purple) !important; }
        .cl-whycard__text { flex: 1; text-align: center; }
        .cl-whycard__title { font-size: clamp(1.4rem, 2.5vw, 1.9rem); font-weight: 700; margin: 0 0 12px; }
        .cl-whycard__body { font-size: 1.02rem; line-height: 1.6; color: rgba(var(--cl-fg),0.62) !important;
          margin: 0 auto; max-width: 560px; }

        /* Community videos */
        .cl-community { display: grid; grid-template-columns: repeat(6, 1fr); gap: 18px; }
        .cl-vid { display: flex; flex-direction: column; gap: 12px; }
        .cl-vid__thumb { position: relative; aspect-ratio: 9 / 16; border-radius: 16px; overflow: hidden;
          display: flex; align-items: center; justify-content: center; box-shadow: 0 14px 36px rgba(7,7,78,0.4); }
        .cl-vid__play { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center;
          justify-content: center; background: rgba(0,0,0,0.4); backdrop-filter: blur(3px);
          border: 1px solid rgba(var(--cl-fg),0.35); }
        .cl-vid__meta { display: flex; align-items: center; gap: 9px; }
        .cl-vid__avatar { width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0; }
        .cl-vid__name { font-size: 0.95rem; font-weight: 500; }

        /* How this works — step cards */
        .cl-steps2 { display: flex; flex-wrap: wrap; justify-content: center; gap: 24px; }
        .cl-step2 { position: relative; flex: 0 1 330px; padding: 24px; border-radius: 20px;
          border: 1px solid rgba(var(--cl-fg),0.08); background: rgba(var(--cl-fg),0.025); text-align: center; }
        .cl-step2__num { width: 30px; height: 30px; border-radius: 50%; display: inline-flex; align-items: center;
          justify-content: center; font-weight: 700; font-size: 0.9rem; background: var(--cl-purple);
          box-shadow: 0 6px 16px rgba(167,139,250,0.4); }
        .cl-step2__title { font-size: 1.2rem; font-weight: 700; margin: 12px 0 6px; }
        .cl-step2__sub { font-size: 0.95rem; line-height: 1.5; color: rgba(var(--cl-fg),0.6) !important; margin: 0 0 20px; }

        /* Step mockups */
        .cl-mock { text-align: left; border-radius: 14px; border: 1px solid rgba(var(--cl-fg),0.1);
          background: var(--cl-panel); padding: 16px; display: flex; flex-direction: column; gap: 10px; min-height: 190px; }
        .cl-mock__steps { display: flex; align-items: center; justify-content: space-between; gap: 6px;
          padding-bottom: 10px; border-bottom: 1px solid rgba(var(--cl-fg),0.08); }
        .cl-mock__step { display: flex; flex-direction: column; align-items: center; gap: 5px; flex: 1; }
        .cl-mock__dot { width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center;
          justify-content: center; font-size: 0.72rem; font-weight: 700; background: rgba(var(--cl-fg),0.1);
          color: rgba(var(--cl-fg),0.6) !important; }
        .cl-mock__dot--on { background: var(--cl-purple); color: #fff !important; }
        .cl-mock__steptxt { font-size: 0.62rem; color: rgba(var(--cl-fg),0.55) !important; text-align: center; }
        .cl-mock__panel { border-radius: 10px; border: 1px solid rgba(var(--cl-fg),0.08);
          background: rgba(var(--cl-fg),0.03); padding: 14px; display: flex; flex-direction: column; gap: 8px; }
        .cl-mock__panel--center { align-items: center; text-align: center; }
        .cl-mock__label { font-size: 0.7rem; font-weight: 600; color: rgba(var(--cl-fg),0.55) !important; }
        .cl-mock__h { font-size: 0.92rem; font-weight: 600; }
        .cl-mock__h2 { font-size: 0.85rem; font-weight: 600; }
        .cl-mock__muted { font-size: 0.72rem; color: rgba(var(--cl-fg),0.5) !important; }
        .cl-mock__muted--sm { display: inline-flex; align-items: center; gap: 4px; font-size: 0.68rem; }
        .cl-mock__field { width: 100%; height: 26px; border-radius: 7px; background: rgba(var(--cl-fg),0.06);
          border: 1px solid rgba(var(--cl-fg),0.08); }
        .cl-mock__bar { width: 100%; height: 6px; border-radius: 999px; background: rgba(var(--cl-fg),0.1); overflow: hidden; }
        .cl-mock__bar span { display: block; height: 100%; border-radius: 999px;
          background: linear-gradient(90deg, #A78BFA, #7c3aed); }
        .cl-mock__rowend { text-align: right; }
        .cl-mock__pct { font-size: 0.72rem; font-weight: 700; color: var(--cl-purple) !important; }
        .cl-mock__pct--ok { color: #4ade80 !important; }
        .cl-mock__kv { display: flex; align-items: center; justify-content: space-between; font-size: 0.74rem;
          color: rgba(var(--cl-fg),0.7) !important; }
        .cl-mock__btn { align-self: flex-start; padding: 7px 14px; border-radius: 8px; font-size: 0.74rem;
          font-weight: 600; background: var(--cl-purple); }
        .cl-mock__pill { align-self: flex-start; padding: 4px 11px; border-radius: 999px; font-size: 0.62rem;
          font-weight: 700; letter-spacing: 0.04em; background: rgba(167,139,250,0.18); color: #d6c8ff !important; }
        .cl-mock__chip { align-self: flex-start; padding: 5px 12px; border-radius: 999px; font-size: 0.7rem;
          font-weight: 600; background: rgba(var(--cl-fg),0.08); color: rgba(var(--cl-fg),0.75) !important; }
        .cl-mock__chip--accent { background: rgba(167,139,250,0.18); color: #d6c8ff !important; }
        .cl-mock__card { border-radius: 10px; border: 1px solid rgba(var(--cl-fg),0.08);
          background: rgba(var(--cl-fg),0.03); padding: 12px; display: flex; flex-direction: column; gap: 7px; }
        .cl-mock__cardtop { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
        .cl-mock__line { display: inline-flex; align-items: center; gap: 5px; font-size: 0.78rem; font-weight: 600; }
        .cl-mock__approved { padding: 3px 9px; border-radius: 6px; font-size: 0.62rem; font-weight: 700;
          background: rgba(74,222,128,0.18); color: #4ade80 !important; }
        .cl-mock__thumb { width: 100%; height: 64px; border-radius: 8px; display: flex; align-items: center;
          justify-content: center; background: linear-gradient(135deg, #2d1b69, #4c1d95); }

        /* FAQ */
        .cl-faq { display: flex; flex-direction: column; gap: 12px; }
        .cl-faq__item { border-radius: 14px; border: 1px solid rgba(var(--cl-fg),0.1);
          background: rgba(var(--cl-fg),0.025); overflow: hidden; transition: all 0.2s; }
        .cl-faq__item--open { border-color: rgba(167,139,250,0.4); background: rgba(167,139,250,0.05); }
        .cl-faq__q { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 16px;
          padding: 20px 24px; background: transparent; border: none; cursor: pointer; font-size: 1.02rem;
          font-weight: 600; text-align: left; }
        .cl-faq__q svg { color: var(--cl-purple); flex-shrink: 0; }
        .cl-faq__a { padding: 0 24px 22px; margin: 0; font-size: 0.97rem; line-height: 1.65;
          color: rgba(var(--cl-fg),0.66) !important; }

        /* Footer */
        .cl-footer { position: relative; z-index: 1; border-top: 1px solid rgba(var(--cl-fg),0.08); padding: 56px 6% 48px; }
        .cl-footer__inner { max-width: 1280px; margin: 0 auto; display: grid; grid-template-columns: 1.5fr 3fr; gap: 50px; }
        .cl-footer__tag { font-size: 0.95rem; line-height: 1.5; color: rgba(var(--cl-fg),0.6) !important;
          margin: 16px 0 18px; max-width: 240px; }
        .cl-footer__social { display: flex; gap: 12px; margin-bottom: 22px; }
        .cl-footer__social a { width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center;
          justify-content: center; border: 1px solid rgba(var(--cl-fg),0.14); background: rgba(var(--cl-fg),0.04);
          color: rgba(var(--cl-fg),0.8) !important; transition: all 0.2s; }
        .cl-footer__social a:hover { border-color: var(--cl-purple); color: #fff !important; }
        .cl-footer__cta { padding: 12px 22px; font-size: 0.95rem; }
        .cl-footer__copy { font-size: 0.8rem; color: rgba(var(--cl-fg),0.4) !important; margin: 22px 0 0; }
        .cl-footer__cols { display: grid; grid-template-columns: repeat(4, 1fr); gap: 28px; align-items: start; }
        .cl-footer__col { display: flex; flex-direction: column; gap: 28px; }
        .cl-footer__coltitle { font-size: 0.98rem; font-weight: 700; margin-bottom: 16px; }
        .cl-footer__link { display: block; font-size: 0.9rem; margin-bottom: 11px; text-decoration: none;
          color: rgba(var(--cl-fg),0.55) !important; transition: color 0.2s; }
        .cl-footer__link:hover { color: var(--cl-purple) !important; }

        /* Responsive */
        @media (max-width: 1080px) {
          .cl-community { grid-template-columns: repeat(3, 1fr); }
          .cl-footer__cols { grid-template-columns: repeat(2, 1fr); gap: 28px 40px; }
          .cl-footer__inner { grid-template-columns: 1fr; gap: 36px; }
        }
        @media (max-width: 768px) {
          .cl-nav__links, .cl-nav__actions { display: none; }
          .cl-nav__burger { display: inline-flex; }
          .cl-blob { width: 300px !important; height: 300px !important; filter: blur(70px); }
          .cl-section { padding: 60px 6%; }
          .cl-whycard { flex-direction: column; gap: 18px; padding: 26px 22px; text-align: center; }
          .cl-whycard__icon { width: 110px; height: 110px; }
          .cl-whycard__emoji { font-size: 2.6rem; }
          .cl-community { grid-template-columns: repeat(2, 1fr); }
          .cl-footer__cols { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  );
}
