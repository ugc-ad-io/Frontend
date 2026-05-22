import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import {
  ArrowRight,
  Users,
  Briefcase,
  Shield,
  Zap,
  Award,
  Sparkles,
  Smartphone,
  Activity,
  Home as HomeIcon,
  Instagram,
  ShoppingBag,
  Music2,
  AlertTriangle,
  HelpCircle,
  MessageCircle,
  Hash,
  Play,
  User,
  Heart,
  Coffee,
  Dumbbell,
  PawPrint,
  Gamepad2,
  DollarSign,
  Plane,
  HandHeart,
} from 'lucide-react';
import { motion, useInView } from 'framer-motion';

// ─── Static data ────────────────────────────────────────────────────────────

const featureData = [
  {
    Icon: Users,
    title: 'Verified Creators',
    desc: 'All creators are manually verified to ensure quality and authenticity on every campaign.',
    gradient: 'linear-gradient(135deg, #A855F7 0%, #C4B5FD 100%)',
    glow: 'rgba(168, 85, 247, 0.28)',
    accent: '#A855F7',
    num: '01',
  },
  {
    Icon: Briefcase,
    title: 'Campaign Management',
    desc: 'Full-featured campaign tools with tracking, real-time chat, and collaboration features.',
    gradient: 'linear-gradient(135deg, #7C3AED 0%, #A855F7 100%)',
    glow: 'rgba(124, 58, 237, 0.28)',
    accent: '#7C3AED',
    num: '02',
  },
  {
    Icon: Shield,
    title: 'Escrow Protection',
    desc: 'Secure payment system that holds funds safely and releases them only when work is approved.',
    gradient: 'linear-gradient(135deg, #9333EA 0%, #C4B5FD 100%)',
    glow: 'rgba(147, 51, 234, 0.28)',
    accent: '#9333EA',
    num: '03',
  },
  {
    Icon: Zap,
    title: 'Fast & Easy',
    desc: 'Simple onboarding with a dedicated support team guiding you every step of the way.',
    gradient: 'linear-gradient(135deg, #581C87 0%, #A855F7 100%)',
    glow: 'rgba(88, 28, 135, 0.28)',
    accent: '#581C87',
    num: '04',
  },
];

const stats = [
  { value: '10K+', label: 'Creators' },
  { value: '500+', label: 'Brands' },
  { value: '$2M+', label: 'Paid Out' },
];

const proofBadges = [
  { Icon: Award, label: 'Top UGC Platform 2026' },
  { Icon: Users, label: '500+ Brands' },
  { Icon: Sparkles, label: '10K+ Creators' },
];

const categoryChips = [
  { Icon: Sparkles, label: 'Beauty' },
  { Icon: Smartphone, label: 'Apps' },
  { Icon: Activity, label: 'Health' },
  { Icon: HomeIcon, label: 'Home' },
];

const industries = [
  { id: 'health',    Icon: Heart,        label: 'Health/Wellness' },
  { id: 'beauty',    Icon: Sparkles,     label: 'Beauty/Cosmetics' },
  { id: 'food',      Icon: Coffee,       label: 'Food/Beverage' },
  { id: 'fitness',   Icon: Dumbbell,     label: 'Fitness/Supplements' },
  { id: 'services',  Icon: Briefcase,    label: 'Consumer Services' },
  { id: 'family',    Icon: Users,        label: 'Family/Kids' },
  { id: 'pets',      Icon: PawPrint,     label: 'Pets' },
  { id: 'gaming',    Icon: Gamepad2,     label: 'Gaming' },
  { id: 'apps',      Icon: Smartphone,   label: 'Apps/Software' },
  { id: 'finance',   Icon: DollarSign,   label: 'Finance/Insurance' },
  { id: 'travel',    Icon: Plane,        label: 'Travel' },
  { id: 'home',      Icon: HomeIcon,     label: 'Home/Household' },
  { id: 'charity',   Icon: HandHeart,    label: 'Charity' },
];

// Six showcase video slots — extras gracefully fall back to the existing
// file if the user hasn't downloaded the additional Pexels videos.
const showcaseVideos = [
  { id: 1, industryId: 'apps',    label: 'Apps/Software',    src: '/9384669-uhd_2160_3840_24fps.mp4' },
  { id: 2, industryId: 'apps',    label: 'Apps/Software',    src: '/showcase-2.mp4' },
  { id: 3, industryId: 'family',  label: 'Family/Kids',      src: '/showcase-3.mp4' },
  { id: 4, industryId: 'beauty',  label: 'Beauty/Cosmetics', src: '/showcase-4.mp4' },
  { id: 5, industryId: 'beauty',  label: 'Beauty/Cosmetics', src: '/showcase-5.mp4' },
  { id: 6, industryId: 'beauty',  label: 'Beauty/Cosmetics', src: '/showcase-6.mp4' },
];

// ─── Framer Motion variants ──────────────────────────────────────────────────

const heroItemVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.1,
      duration: 0.65,
      ease: [0.25, 0.46, 0.45, 0.94],
    },
  }),
};

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};

const cardVariants = {
  hidden: { opacity: 0, y: 36 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.55, ease: 'easeOut' },
  }),
};

const fadeUpVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.55, ease: 'easeOut' } },
};

const statVariants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: 'easeOut' } },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState(null);

  const visibleShowcase = selectedIndustry
    ? showcaseVideos.filter((v) => v.industryId === selectedIndustry)
    : showcaseVideos;

  const featuresRef = useRef(null);
  const ctaRef = useRef(null);
  const featuresInView = useInView(featuresRef, { once: true, margin: '-80px' });
  const ctaInView = useInView(ctaRef, { once: true, margin: '-80px' });

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleGetStarted = () => {
    if (user) {
      if (user.role === 'creator') navigate('/dashboard/creator');
      else if (user.role === 'business') navigate('/brand-home');
      else if (user.role === 'admin') navigate('/dashboard/admin');
    } else {
      navigate('/auth');
    }
  };

  // Right phone falls back to existing video if the second one isn't downloaded yet
  const leftVideo = '/9384669-uhd_2160_3840_24fps.mp4';
  const rightVideo = '/ugc-creator-2.mp4';

  return (
    <div className="lp-root">

      {/* ── Navbar — white floating pill ──────────────────────────────────── */}
      <motion.header
        className={`lp-navbar${scrolled ? ' lp-navbar--scrolled' : ''}`}
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="lp-navbar__inner">
          <img
            src="/ugcad-logo.png"
            alt="UGCad.io"
            className="lp-navbar__logo"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          />
          <div className="lp-navbar__actions">
            <button className="lp-btn-signin" onClick={() => navigate('/auth')}>
              Sign In
            </button>
            <button className="lp-btn-dark" onClick={handleGetStarted}>
              Get Started
            </button>
          </div>
        </div>
      </motion.header>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="lp-hero">
        <div className="lp-orb lp-orb--1" aria-hidden="true" />
        <div className="lp-orb lp-orb--2" aria-hidden="true" />

        <div className="lp-hero__inner">
          {/* Left column */}
          <div className="lp-hero__text">
            <motion.div
              className="lp-badge"
              custom={0}
              variants={heroItemVariants}
              initial="hidden"
              animate="visible"
            >
              <Sparkles size={14} />
              <span>For Creators &amp; Brands</span>
              <Sparkles size={14} />
            </motion.div>

            <motion.h1
              className="lp-hero__title"
              custom={1}
              variants={heroItemVariants}
              initial="hidden"
              animate="visible"
            >
              Unlock serious growth with{' '}
              <span className="lp-hero__title--gradient">
                high-performing UGC ads
              </span>
            </motion.h1>

            <motion.p
              className="lp-hero__subtitle"
              custom={2}
              variants={heroItemVariants}
              initial="hidden"
              animate="visible"
            >
              UGCad is your one-stop solution for scaleable user-generated content
              (UGC) production. Backed by a network of 7,000+ content creators
              across the UK, US and Europe, we produce premium UGC video and image
              content for the world's best brands.
            </motion.p>

            <motion.div
              className="lp-hero__ctas"
              custom={3}
              variants={heroItemVariants}
              initial="hidden"
              animate="visible"
            >
              <button
                className="lp-btn-primary"
                onClick={handleGetStarted}
                data-testid="get-started-btn"
              >
                Get Started <ArrowRight size={18} />
              </button>
              <button
                className="lp-btn-ghost"
                onClick={() => navigate('/auth')}
                data-testid="learn-more-btn"
              >
                View examples
              </button>
            </motion.div>

            <motion.div
              className="lp-hero__badges"
              custom={4}
              variants={heroItemVariants}
              initial="hidden"
              animate="visible"
            >
              {proofBadges.map(({ Icon, label }) => (
                <div key={label} className="lp-proof-badge">
                  <span className="lp-proof-badge__icon">
                    <Icon size={14} />
                  </span>
                  <span>{label}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Right column — phones + floating widgets */}
          <motion.div
            className="lp-hero__media"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div className="lp-phones">
              <div className="lp-phone lp-phone--left">
                <video
                  src={leftVideo}
                  className="lp-phone__media"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              </div>
              <div className="lp-phone lp-phone--right">
                <video
                  src={rightVideo}
                  className="lp-phone__media"
                  autoPlay
                  muted
                  loop
                  playsInline
                  onError={(e) => {
                    // If ugc-creator-2.mp4 doesn't exist yet, fall back to the existing video
                    if (e.currentTarget.src.indexOf(leftVideo) === -1) {
                      e.currentTarget.src = leftVideo;
                    }
                  }}
                />
              </div>
            </div>

            {/* Floating widget — creators count */}
            <div className="lp-float lp-float--creators">
              <div className="lp-avatars">
                <span className="lp-avatar" style={{ background: 'linear-gradient(135deg, #f472b6, #c084fc)' }}>A</span>
                <span className="lp-avatar" style={{ background: 'linear-gradient(135deg, #818cf8, #a855f7)' }}>M</span>
                <span className="lp-avatar" style={{ background: 'linear-gradient(135deg, #fb923c, #f472b6)' }}>K</span>
              </div>
              <div className="lp-float__copy">
                <span className="lp-float__small">Get content from</span>
                <span className="lp-float__big">7000+</span>
                <span className="lp-float__small">high-quality creators</span>
              </div>
            </div>

            {/* Floating widget — platforms */}
            <div className="lp-float lp-float--platforms">
              <span className="lp-float__small lp-float__small--center">
                Authentic content for all your platforms
              </span>
              <div className="lp-platforms">
                <span className="lp-platform-icon" title="Instagram"><Instagram size={16} /></span>
                <span className="lp-platform-icon lp-platform-icon--meta" title="Meta">M</span>
                <span className="lp-platform-icon" title="Amazon"><ShoppingBag size={16} /></span>
                <span className="lp-platform-icon" title="TikTok"><Music2 size={16} /></span>
                <span className="lp-platform-icon lp-platform-icon--shop" title="Shopify">S</span>
              </div>
            </div>

            {/* Category chips */}
            <div className="lp-chips">
              {categoryChips.map(({ Icon, label }, i) => (
                <div key={label} className={`lp-chip lp-chip--${i}`}>
                  <span className="lp-chip__icon"><Icon size={10} /></span>
                  <span>{label}</span>
                </div>
              ))}
              <div className="lp-chip lp-chip--more">
                <span className="lp-chip__icon">+</span>
                <span>More...</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Brands Scroll ───────────────────────────────────────────────────── */}
      <section className="lp-brands">
        <div className="lp-brands__scroll">
          <div className="lp-brands__track">
            {['Amazon','Apple','Google','Netflix','Spotify','Tesla','Meta','Microsoft',
              'Amazon','Apple','Google','Netflix','Spotify','Tesla','Meta','Microsoft'].map((b, i) => (
              <div key={`${b}-${i}`} className="lp-brand-item">{b}</div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The Problem ────────────────────────────────────────────────────── */}
      <section className="lp-problem">
        <div className="lp-problem__inner">
          <span className="lp-problem__pill">
            <AlertTriangle size={14} />
            The problem
          </span>
          <h2 className="lp-problem__heading">
            Creating content that{' '}
            <span className="lp-problem__heading--accent">truly performs</span>{' '}
            isn't easy
          </h2>
          <p className="lp-problem__subtitle">
            We know firsthand how tough it is to consistently create content that performs.
          </p>

          <div className="lp-problem__grid">
            {/* Card 1 — Tedious price negotiations */}
            <article className="lp-pcard">
              <div className="lp-pcard__visual">
                <div className="lp-pmedia lp-pmedia--c1">
                  <div className="lp-stamp lp-stamp--fiverr">fiverr.</div>
                  <div className="lp-stamp lp-stamp--slack"><Hash size={20} /></div>
                  <div className="lp-stamp lp-stamp--wa"><MessageCircle size={20} /></div>
                  <div className="lp-stamp lp-stamp--check">✓✓</div>
                  <div className="lp-stamp lp-stamp--num">3</div>
                  <div className="lp-stamp lp-stamp--bell">🔔<span className="lp-stamp__badge">10</span></div>

                  <div className="lp-update-card">
                    <div className="lp-update-card__title">Content updates</div>
                    <div className="lp-update-card__body">You've been waiting for <strong>4 days</strong> without a response.</div>
                  </div>

                  <div className="lp-tag-pill lp-tag-pill--reject">
                    <span className="lp-tag-dot lp-tag-dot--reject"></span>
                    Contract Rejected
                  </div>

                  <div className="lp-contract-card">
                    <div className="lp-contract-card__title">Your contract</div>
                    <div className="lp-tag-pill lp-tag-pill--pending">
                      <AlertTriangle size={12} />
                      Signature pending
                    </div>
                  </div>

                  <div className="lp-vertical-tag">Signature pending</div>
                  <div className="lp-vertical-tag lp-vertical-tag--right">Endless Slack Channels</div>
                </div>
              </div>
              <h3 className="lp-pcard__title">Tedious price negotiations</h3>
            </article>

            {/* Card 2 — Limited UGC creator access */}
            <article className="lp-pcard">
              <div className="lp-pcard__visual">
                <div className="lp-pmedia lp-pmedia--c2">
                  <div className="lp-ring lp-ring--1"></div>
                  <div className="lp-ring lp-ring--2"></div>

                  <div className="lp-center-avatar">
                    <User size={36} />
                  </div>

                  <div className="lp-q lp-q--1"><HelpCircle size={20} /></div>
                  <div className="lp-q lp-q--2"><HelpCircle size={20} /></div>
                  <div className="lp-q lp-q--3"><HelpCircle size={20} /></div>
                  <div className="lp-q lp-q--4"><HelpCircle size={20} /></div>
                  <div className="lp-q lp-q--5"><HelpCircle size={20} /></div>

                  <div className="lp-tag-pill lp-tag-pill--reject lp-tag-pill--center">
                    <span className="lp-tag-dot lp-tag-dot--reject"></span>
                    Only one creator found
                  </div>
                </div>
              </div>
              <h3 className="lp-pcard__title">Limited UGC creator access</h3>
            </article>

            {/* Card 3 — Inconsistent quality */}
            <article className="lp-pcard">
              <div className="lp-pcard__visual">
                <div className="lp-pmedia lp-pmedia--c3">
                  <div className="lp-task-row">
                    <div className="lp-task-icon"><Music2 size={18} /></div>
                    <div className="lp-task-info">
                      <div className="lp-task-title">Tik tok</div>
                      <div className="lp-task-sub">follow-up assignments</div>
                    </div>
                    <div className="lp-tag-pill lp-tag-pill--reject">
                      <span className="lp-tag-dot lp-tag-dot--reject"></span>
                      Delayed tasks!
                    </div>
                  </div>

                  <div className="lp-progress-card">
                    <div className="lp-progress-card__label">Task Done: <strong>02 / 50</strong></div>
                    <div className="lp-progress-track"><div className="lp-progress-fill"></div></div>
                  </div>

                  <div className="lp-submission-row">
                    <div className="lp-submission-icon"><Play size={14} /></div>
                    <div className="lp-submission-info">
                      <div className="lp-submission-title">Raw content</div>
                      <div className="lp-submission-sub">Latest submission</div>
                    </div>
                    <div className="lp-tag-pill lp-tag-pill--reject lp-tag-pill--sm">
                      <span className="lp-tag-dot lp-tag-dot--reject"></span>
                      Rejected
                    </div>
                  </div>

                  <div className="lp-submission-row lp-submission-row--muted">
                    <div className="lp-submission-icon"><Play size={14} /></div>
                    <div className="lp-submission-info">
                      <div className="lp-submission-title">Edited content</div>
                      <div className="lp-submission-sub">Latest submission</div>
                    </div>
                    <div className="lp-tag-pill lp-tag-pill--pending lp-tag-pill--sm">
                      <span className="lp-tag-dot lp-tag-dot--pending"></span>
                      Pending
                    </div>
                  </div>
                </div>
              </div>
              <h3 className="lp-pcard__title">Inconsistent quality or no creator follow-up</h3>
            </article>
          </div>
        </div>
      </section>

      {/* ── Showcase — Best UGC on the internet ────────────────────────────── */}
      <section className="lp-showcase">
        <div className="lp-showcase__inner">
          <h2 className="lp-showcase__heading">
            We create the{' '}
            <span className="lp-showcase__heading--accent">best UGC</span>{' '}
            on the internet
          </h2>
          <p className="lp-showcase__subtitle">Choose your industry to see examples!</p>

          <div className="lp-showcase__filters">
            {industries.map(({ id, Icon, label }) => (
              <button
                key={id}
                type="button"
                className={`lp-filter${selectedIndustry === id ? ' is-active' : ''}`}
                onClick={() => setSelectedIndustry(selectedIndustry === id ? null : id)}
              >
                <Icon size={14} />
                <span>{label}</span>
              </button>
            ))}
            <button
              type="button"
              className="lp-filter lp-filter--reset"
              onClick={() => setSelectedIndustry(null)}
            >
              Reset
            </button>
          </div>

          <div className="lp-showcase__grid">
            {(visibleShowcase.length ? visibleShowcase : showcaseVideos).map((v) => (
              <div key={v.id} className="lp-showcase-card">
                <video
                  src={v.src}
                  className="lp-showcase-card__media"
                  autoPlay
                  muted
                  loop
                  playsInline
                  onError={(e) => {
                    // Fallback to the existing UGC video if user hasn't downloaded extra ones
                    if (!e.currentTarget.src.endsWith('/9384669-uhd_2160_3840_24fps.mp4')) {
                      e.currentTarget.src = '/9384669-uhd_2160_3840_24fps.mp4';
                    }
                  }}
                />
                <span className="lp-showcase-card__tag">{v.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section className="lp-features" ref={featuresRef}>
        <div className="lp-features__inner">
          <motion.span
            className="lp-eyebrow"
            variants={fadeUpVariants}
            initial="hidden"
            animate={featuresInView ? 'visible' : 'hidden'}
          >
            FEATURES
          </motion.span>

          <motion.h2
            className="lp-section-heading"
            variants={fadeUpVariants}
            initial="hidden"
            animate={featuresInView ? 'visible' : 'hidden'}
            transition={{ delay: 0.1 }}
          >
            Why Choose UGCad.io?
          </motion.h2>

          <motion.div
            className="lp-features__grid"
            variants={containerVariants}
            initial="hidden"
            animate={featuresInView ? 'visible' : 'hidden'}
          >
            {featureData.map((feat, i) => (
              <motion.div
                key={feat.title}
                className="lp-card"
                custom={i}
                variants={cardVariants}
                whileHover={{ y: -6, transition: { duration: 0.22 } }}
                style={{ '--card-accent': feat.accent, '--card-glow': feat.glow }}
              >
                <span className="lp-card__num">{feat.num}</span>
                <div
                  className="lp-card__icon"
                  style={{
                    background: feat.gradient,
                    boxShadow: `0 8px 24px ${feat.glow}`,
                  }}
                >
                  <feat.Icon size={24} />
                </div>
                <h3 className="lp-card__title">{feat.title}</h3>
                <p className="lp-card__body">{feat.desc}</p>
                <div
                  className="lp-card__bar"
                  style={{ background: feat.gradient }}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="lp-cta" ref={ctaRef}>
        <motion.div
          className="lp-cta__inner"
          variants={containerVariants}
          initial="hidden"
          animate={ctaInView ? 'visible' : 'hidden'}
        >
          <motion.h2 className="lp-cta__heading" variants={statVariants}>
            Ready to Start Your Journey?
          </motion.h2>

          <motion.p className="lp-cta__subtext" variants={statVariants}>
            Join thousands of creators and brands already building on our platform.
          </motion.p>

          <motion.div className="lp-cta__stats" variants={containerVariants}>
            {stats.map((s) => (
              <motion.div key={s.label} className="lp-stat" variants={statVariants}>
                <span className="lp-stat__value">{s.value}</span>
                <span className="lp-stat__label">{s.label}</span>
              </motion.div>
            ))}
          </motion.div>

          <motion.div className="lp-cta__btn-wrap" variants={statVariants}>
            <button
              className="lp-btn-join"
              onClick={handleGetStarted}
              data-testid="join-now-btn"
            >
              Join Now <ArrowRight size={18} />
            </button>
          </motion.div>

          <motion.p className="lp-cta__proof" variants={statVariants}>
            No credit card required &nbsp;·&nbsp; Free to get started
          </motion.p>
        </motion.div>
      </section>

      {/* ── Styles ─────────────────────────────────────────────────────────── */}
      <style>{`
        :root {
          --lp-purple-50:  #FAF5FF;
          --lp-purple-100: #F3E8FF;
          --lp-purple-200: #E9D5FF;
          --lp-purple-300: #C4B5FD;
          --lp-purple-500: #A855F7;
          --lp-purple-600: #9333EA;
          --lp-purple-700: #7C3AED;
          --lp-purple-900: #581C87;
          --lp-ink:        #0A0A0A;
          --lp-text:       #1F2937;
          --lp-text-muted: #6B7280;
          --lp-text-soft:  #9CA3AF;
          --lp-bg:         #FFFFFF;
          --lp-bg-soft:    #FAFAF9;
          --lp-border:     #E5E7EB;
        }

        /* ── Root ─────────────────────────────────────────────────────────── */
        .lp-root {
          min-height: 100vh;
          font-family: 'Instrument Sans', 'Inter', sans-serif;
          background: #ffffff;
          color: var(--lp-text);
        }

        /* ── Navbar (floating white pill) ─────────────────────────────────── */
        .lp-navbar {
          position: fixed;
          top: 20px;
          left: 0;
          right: 0;
          z-index: 1000;
          padding: 0 8%;
          transition: top 0.3s ease;
        }

        .lp-navbar--scrolled .lp-navbar__inner {
          box-shadow: 0 8px 32px rgba(0,0,0,0.10);
        }

        .lp-navbar__inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          max-width: 1240px;
          margin: 0 auto;
          background: #ffffff;
          padding: 12px 22px;
          border-radius: 100px;
          border: 1px solid var(--lp-border);
          box-shadow: 0 2px 12px rgba(0,0,0,0.05);
          transition: box-shadow 0.3s ease;
        }

        .lp-navbar__logo {
          height: 36px;
          width: auto;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .lp-navbar__logo:hover { opacity: 0.8; }

        .lp-navbar__actions {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        .lp-btn-signin {
          padding: 9px 22px;
          border-radius: 100px;
          border: 1px solid var(--lp-border);
          background: #ffffff;
          color: var(--lp-text);
          font-family: 'Instrument Sans', sans-serif;
          font-weight: 500;
          font-size: 0.92rem;
          cursor: pointer;
          transition: all 0.22s ease;
        }
        .lp-btn-signin:hover {
          border-color: var(--lp-purple-300);
          color: var(--lp-purple-700);
        }

        .lp-btn-dark {
          padding: 9px 22px;
          border-radius: 100px;
          background: var(--lp-ink);
          color: #ffffff;
          font-family: 'Instrument Sans', sans-serif;
          font-weight: 600;
          font-size: 0.92rem;
          border: none;
          cursor: pointer;
          transition: all 0.22s ease;
        }
        .lp-btn-dark:hover {
          background: var(--lp-purple-700);
          transform: translateY(-1px);
        }

        /* ── Hero ─────────────────────────────────────────────────────────── */
        .lp-hero {
          position: relative;
          min-height: 100vh;
          display: flex;
          align-items: center;
          padding: 140px 8% 80px;
          background: linear-gradient(160deg, #FAF5FF 0%, #F3E8FF 55%, #FFFFFF 100%);
          overflow: hidden;
        }

        .lp-orb {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }
        .lp-orb--1 {
          width: 520px; height: 520px;
          background: rgba(168, 85, 247, 0.22);
          filter: blur(110px);
          top: -120px; left: -120px;
        }
        .lp-orb--2 {
          width: 420px; height: 420px;
          background: rgba(196, 181, 253, 0.32);
          filter: blur(100px);
          bottom: -100px; right: -60px;
        }

        .lp-hero__inner {
          display: grid;
          grid-template-columns: 1fr 1.05fr;
          gap: 60px;
          align-items: center;
          max-width: 1300px;
          margin: 0 auto;
          width: 100%;
          position: relative;
          z-index: 2;
        }

        .lp-hero__text {
          display: flex;
          flex-direction: column;
        }

        .lp-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 16px;
          border-radius: 100px;
          background: linear-gradient(135deg, #DDD6FE 0%, #C4B5FD 100%);
          color: var(--lp-purple-900);
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: 24px;
          width: fit-content;
          box-shadow: inset 0 0 0 1px rgba(124, 58, 237, 0.18);
        }

        .lp-hero__title {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 2.8rem;
          font-weight: 500;
          line-height: 1.1;
          color: var(--lp-ink);
          margin: 0 0 20px 0;
          letter-spacing: -0.05em;
        }

        .lp-hero__title--gradient {
          background: linear-gradient(90deg, #7C3AED 0%, #A855F7 60%, #C084FC 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .lp-hero__subtitle {
          font-family: 'Instrument Sans', sans-serif;
          color: var(--lp-text-muted);
          font-size: 1rem;
          line-height: 1.5;
          letter-spacing: -0.015em;
          max-width: 540px;
          margin: 0 0 32px;
        }

        .lp-hero__ctas {
          display: flex;
          gap: 12px;
          align-items: center;
          flex-wrap: wrap;
          margin-bottom: 36px;
        }

        .lp-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 28px;
          border-radius: 100px;
          background: var(--lp-ink);
          color: #ffffff;
          font-family: 'Instrument Sans', sans-serif;
          font-weight: 600;
          font-size: 0.98rem;
          border: none;
          cursor: pointer;
          transition: all 0.25s ease;
          box-shadow: 0 4px 16px rgba(10,10,10,0.18);
        }
        .lp-btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 32px rgba(124, 58, 237, 0.32);
          background: var(--lp-purple-700);
        }

        .lp-btn-ghost {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 13px 24px;
          border-radius: 100px;
          background: #ffffff;
          color: var(--lp-text);
          font-family: 'Instrument Sans', sans-serif;
          font-weight: 500;
          font-size: 0.98rem;
          border: 1px solid var(--lp-border);
          cursor: pointer;
          transition: all 0.22s ease;
        }
        .lp-btn-ghost:hover {
          border-color: var(--lp-purple-500);
          color: var(--lp-purple-700);
        }

        .lp-hero__badges {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }

        .lp-proof-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          background: #ffffff;
          border: 1px solid var(--lp-border);
          border-radius: 100px;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.78rem;
          font-weight: 500;
          color: var(--lp-text-muted);
          box-shadow: 0 1px 4px rgba(0,0,0,0.04);
        }
        .lp-proof-badge__icon {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: linear-gradient(135deg, #DDD6FE, #C4B5FD);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--lp-purple-700);
        }

        /* ── Hero media (phones + floating widgets) ───────────────────────── */
        .lp-hero__media {
          position: relative;
          width: 88%;
          margin-left: auto;
          margin-right: auto;
          aspect-ratio: 1 / 0.92;
          display: block;
        }

        .lp-phones {
          position: relative;
          width: 100%;
          height: 100%;
        }

        .lp-phone {
          position: absolute;
          border-radius: 22px;
          overflow: hidden;
          background: #111;
        }

        .lp-phone__media {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        /* Main big card on the left — slightly smaller */
        .lp-phone--left {
          left: 0;
          top: 4%;
          width: 56%;
          height: 92%;
          z-index: 2;
          box-shadow: 0 24px 60px rgba(124, 58, 237, 0.20), 0 8px 24px rgba(0,0,0,0.12);
        }

        /* Secondary card — sits significantly BEHIND the main one, slightly lower */
        .lp-phone--right {
          right: 0;
          left: auto;
          top: 28%;
          width: 56%;
          height: 84%;
          z-index: 1;
          box-shadow: 0 22px 48px rgba(0,0,0,0.18);
        }

        /* Floating widget — creators count */
        .lp-float {
          position: absolute;
          background: #ffffff;
          border: 1px solid var(--lp-border);
          border-radius: 18px;
          box-shadow: 0 16px 40px rgba(0,0,0,0.12);
          padding: 14px 16px;
          font-family: 'Instrument Sans', sans-serif;
          z-index: 3;
        }

        .lp-float--creators {
          top: 14%;
          left: -6%;
          display: flex;
          align-items: center;
          gap: 12px;
          max-width: 240px;
          z-index: 4;
        }

        .lp-avatars {
          display: flex;
        }
        .lp-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          color: #fff;
          font-weight: 700;
          font-size: 13px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 2px solid #fff;
          margin-left: -8px;
        }
        .lp-avatar:first-child { margin-left: 0; }

        .lp-float__copy {
          display: flex;
          flex-direction: column;
          line-height: 1.2;
        }
        .lp-float__small {
          font-size: 0.72rem;
          color: var(--lp-text-muted);
          font-weight: 500;
        }
        .lp-float__small--center {
          text-align: center;
          margin-bottom: 8px;
        }
        .lp-float__big {
          font-size: 1.45rem;
          font-weight: 700;
          color: var(--lp-purple-700);
          line-height: 1;
        }

        .lp-float--platforms {
          bottom: 10%;
          left: 8%;
          padding: 12px 18px;
          min-width: 230px;
          z-index: 4;
        }

        .lp-platforms {
          display: flex;
          gap: 10px;
          align-items: center;
          justify-content: center;
        }
        .lp-platform-icon {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--lp-purple-50);
          color: var(--lp-purple-700);
          font-weight: 700;
          font-size: 13px;
        }
        .lp-platform-icon--meta {
          background: #1877F2; color: #fff;
        }
        .lp-platform-icon--shop {
          background: #95BF47; color: #fff;
        }

        /* Category chips — small square cards in a 2-column staggered grid */
        .lp-chips {
          position: absolute;
          right: 4%;
          top: 70%;
          display: grid;
          grid-template-columns: repeat(2, 46px);
          grid-auto-rows: 42px;
          gap: 10px;
          z-index: 5;
        }
        .lp-chip {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          padding: 4px;
          background: #ffffff;
          border: 1px solid var(--lp-border);
          border-radius: 10px;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.62rem;
          font-weight: 600;
          color: var(--lp-ink);
          box-shadow: 0 6px 14px rgba(0,0,0,0.10);
          text-align: center;
        }
        .lp-chip__icon {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: linear-gradient(135deg, #F3E8FF, #DDD6FE);
          color: var(--lp-purple-700);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          flex-shrink: 0;
          font-size: 0.6rem;
        }
        /* Staggered grid: Beauty alone in row 1, then 2x2 below */
        .lp-chip--0 { grid-column: 2; grid-row: 1; }  /* Beauty */
        .lp-chip--1 { grid-column: 1; grid-row: 2; }  /* Apps */
        .lp-chip--2 { grid-column: 2; grid-row: 2; }  /* Health */
        .lp-chip--3 { grid-column: 1; grid-row: 3; }  /* Home */
        .lp-chip--more {
          grid-column: 2; grid-row: 3;                 /* +More */
          color: var(--lp-text-muted);
        }

        /* ── Brands Scroll ────────────────────────────────────────────────── */
        .lp-brands {
          background: var(--lp-bg-soft);
          padding: 60px 0;
          overflow: hidden;
          border-top: 1px solid var(--lp-border);
          border-bottom: 1px solid var(--lp-border);
        }
        .lp-brands__scroll { width: 100%; overflow: hidden; }
        .lp-brands__track {
          display: flex;
          gap: 60px;
          animation: scrollBrands 30s linear infinite;
          width: max-content;
          padding: 0 8%;
        }
        .lp-brand-item {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--lp-text);
          white-space: nowrap;
          opacity: 0.45;
          transition: all 0.3s ease;
        }
        .lp-brand-item:hover {
          opacity: 1;
          color: var(--lp-purple-600);
        }
        @keyframes scrollBrands {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        /* ── The Problem section ──────────────────────────────────────────── */
        .lp-problem {
          padding: 100px 8% 60px;
          background: #ffffff;
        }
        .lp-problem__inner {
          max-width: 1200px;
          margin: 0 auto;
          text-align: center;
        }
        .lp-problem__pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 100px;
          background: #ffffff;
          border: 1px solid var(--lp-border);
          color: var(--lp-text-muted);
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.82rem;
          font-weight: 500;
          margin-bottom: 18px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .lp-problem__pill svg { color: var(--lp-purple-600); }

        .lp-problem__heading {
          font-family: 'Instrument Sans', sans-serif;
          font-size: clamp(2rem, 4.2vw, 3.4rem);
          font-weight: 500;
          color: var(--lp-ink);
          line-height: 1.15;
          letter-spacing: -0.04em;
          margin: 0 0 16px 0;
          max-width: 900px;
          margin-left: auto;
          margin-right: auto;
        }
        .lp-problem__heading--accent {
          background: linear-gradient(90deg, #7C3AED 0%, #A855F7 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .lp-problem__subtitle {
          font-family: 'Instrument Sans', sans-serif;
          color: var(--lp-text-muted);
          font-size: 1rem;
          line-height: 1.5;
          letter-spacing: -0.015em;
          margin: 0 auto 60px;
          max-width: 620px;
        }

        .lp-problem__grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 22px;
          text-align: left;
        }

        .lp-pcard {
          background: #ffffff;
          border: 1px solid var(--lp-border);
          border-radius: 24px;
          padding: 22px;
          display: flex;
          flex-direction: column;
          transition: box-shadow 0.3s ease, transform 0.3s ease;
        }
        .lp-pcard:hover {
          box-shadow: 0 18px 50px rgba(124, 58, 237, 0.10);
          transform: translateY(-4px);
        }

        .lp-pcard__visual {
          background: var(--lp-bg-soft);
          border-radius: 18px;
          padding: 22px;
          height: 320px;
          position: relative;
          overflow: hidden;
          margin-bottom: 18px;
        }

        .lp-pcard__title {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 1.35rem;
          font-weight: 500;
          color: var(--lp-ink);
          letter-spacing: -0.02em;
          margin: 0;
          line-height: 1.25;
        }

        /* Common pmedia container — content is absolutely positioned */
        .lp-pmedia {
          position: relative;
          width: 100%;
          height: 100%;
        }

        /* Card 1 — visual stamps */
        .lp-pmedia--c1 .lp-stamp {
          position: absolute;
          width: 50px;
          height: 50px;
          border-radius: 12px;
          background: #ffffff;
          border: 1px solid var(--lp-border);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          color: var(--lp-text);
          box-shadow: 0 4px 12px rgba(0,0,0,0.06);
        }
        .lp-stamp--fiverr {
          top: 56%;
          left: 0;
          font-size: 0.95rem;
          color: #1DBF73;
          font-style: italic;
          transform: rotate(-8deg);
        }
        .lp-stamp--slack {
          top: 32%;
          left: 36%;
          color: #611f69;
          transform: rotate(-4deg);
        }
        .lp-stamp--wa {
          bottom: 8%;
          left: 22%;
          background: #25D366;
          color: #fff;
          border-color: #25D366;
          border-radius: 50%;
        }
        .lp-stamp--check {
          top: 52%;
          left: 32%;
          width: 40px; height: 40px;
          color: #4A4A4A;
          font-size: 0.9rem;
          background: #FAFAFA;
          border-radius: 8px;
          transform: rotate(2deg);
        }
        .lp-stamp--num {
          top: 8%;
          right: 14%;
          width: 38px; height: 38px;
          font-size: 1rem;
          color: #6B7280;
          background: #FAFAFA;
          transform: rotate(8deg);
        }
        .lp-stamp--bell {
          top: -4%;
          left: 38%;
          width: 38px; height: 38px;
          background: #FAFAFA;
          font-size: 1rem;
          position: absolute;
        }
        .lp-stamp__badge {
          position: absolute;
          top: -6px;
          right: -6px;
          background: #ef4444;
          color: #fff;
          font-size: 0.6rem;
          padding: 1px 5px;
          border-radius: 8px;
          font-weight: 700;
        }

        .lp-update-card {
          position: absolute;
          top: 10%;
          left: 50%;
          width: 48%;
          background: #fff;
          border: 1px solid var(--lp-border);
          border-radius: 10px;
          padding: 8px 10px;
          box-shadow: 0 6px 14px rgba(0,0,0,0.06);
          transform: rotate(-90deg);
          transform-origin: left top;
        }
        .lp-update-card__title { font-size: 0.72rem; font-weight: 600; color: var(--lp-ink); }
        .lp-update-card__body { font-size: 0.62rem; color: var(--lp-text-muted); line-height: 1.3; margin-top: 2px; }

        .lp-vertical-tag {
          position: absolute;
          bottom: 14%;
          left: 6%;
          font-size: 0.62rem;
          color: var(--lp-text-muted);
          writing-mode: vertical-rl;
          transform: rotate(180deg);
          font-weight: 500;
        }
        .lp-vertical-tag--right {
          left: auto;
          right: 4%;
          bottom: 10%;
          color: var(--lp-text-soft);
        }

        .lp-tag-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 10px;
          border-radius: 100px;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.72rem;
          font-weight: 500;
          background: #FFFFFF;
          border: 1px solid #FCA5A5;
          color: #E11D48;
          box-shadow: 0 4px 12px rgba(0,0,0,0.06);
          white-space: nowrap;
        }
        .lp-tag-pill--sm { font-size: 0.65rem; padding: 4px 8px; }
        .lp-tag-pill--pending { border-color: #FCD34D; color: #B45309; }
        .lp-tag-pill--reject { border-color: #FCA5A5; color: #E11D48; }
        .lp-tag-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .lp-tag-dot--reject { background: #E11D48; }
        .lp-tag-dot--pending { background: #B45309; }

        .lp-pmedia--c1 .lp-tag-pill--reject {
          position: absolute;
          top: 38%;
          right: 6%;
        }
        .lp-contract-card {
          position: absolute;
          bottom: 6%;
          left: 22%;
          width: 60%;
          background: #fff;
          border: 1px solid var(--lp-border);
          border-radius: 12px;
          padding: 10px 12px;
          box-shadow: 0 8px 18px rgba(0,0,0,0.06);
        }
        .lp-contract-card__title {
          font-size: 0.72rem;
          color: var(--lp-text-muted);
          margin-bottom: 6px;
        }

        /* Card 2 — limited access */
        .lp-pmedia--c2 { display: flex; align-items: center; justify-content: center; }
        .lp-ring {
          position: absolute;
          border: 1.5px dashed #E5E7EB;
          border-radius: 50%;
        }
        .lp-ring--1 { width: 70%; height: 70%; top: 15%; left: 15%; }
        .lp-ring--2 { width: 95%; height: 95%; top: 2.5%; left: 2.5%; }

        .lp-center-avatar {
          position: relative;
          width: 90px;
          height: 90px;
          border-radius: 50%;
          background: linear-gradient(135deg, #E9D5FF, #C4B5FD);
          color: var(--lp-purple-700);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 22px rgba(124,58,237,0.18);
          z-index: 2;
        }

        .lp-q {
          position: absolute;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #fff;
          border: 1px solid var(--lp-border);
          color: var(--lp-text-soft);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        .lp-q--1 { top: 18%; left: 8%; }
        .lp-q--2 { top: 26%; right: 10%; }
        .lp-q--3 { bottom: 30%; left: 4%; }
        .lp-q--4 { bottom: 22%; right: 6%; }
        .lp-q--5 { top: 48%; right: 28%; }

        .lp-tag-pill--center {
          position: absolute;
          bottom: 10%;
          left: 50%;
          transform: translateX(-50%);
        }

        /* Card 3 — inconsistent quality */
        .lp-pmedia--c3 {
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding-top: 4px;
        }
        .lp-task-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          background: #fff;
          border: 1px solid var(--lp-border);
          border-radius: 12px;
        }
        .lp-task-icon {
          width: 32px; height: 32px;
          border-radius: 8px;
          background: #111;
          color: #fff;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .lp-task-info { flex: 1; min-width: 0; }
        .lp-task-title { font-size: 0.82rem; font-weight: 600; color: var(--lp-ink); }
        .lp-task-sub { font-size: 0.7rem; color: var(--lp-text-muted); }

        .lp-progress-card {
          background: #fff;
          border: 1px solid var(--lp-border);
          border-radius: 10px;
          padding: 10px 12px;
        }
        .lp-progress-card__label {
          font-size: 0.78rem;
          color: var(--lp-text);
          margin-bottom: 8px;
        }
        .lp-progress-card__label strong { color: var(--lp-ink); }
        .lp-progress-track {
          width: 100%;
          height: 4px;
          background: #F3F4F6;
          border-radius: 4px;
          overflow: hidden;
        }
        .lp-progress-fill {
          width: 4%;
          height: 100%;
          background: linear-gradient(90deg, #A855F7, #7C3AED);
          border-radius: 4px;
        }

        .lp-submission-row {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          background: #fff;
          border: 1px solid var(--lp-border);
          border-radius: 10px;
        }
        .lp-submission-row--muted { opacity: 0.85; }
        .lp-submission-icon {
          width: 26px; height: 26px;
          border-radius: 6px;
          background: #F3F4F6;
          color: var(--lp-text-soft);
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .lp-submission-info { flex: 1; min-width: 0; }
        .lp-submission-title { font-size: 0.78rem; font-weight: 600; color: var(--lp-ink); }
        .lp-submission-sub { font-size: 0.66rem; color: var(--lp-text-muted); }

        @media (max-width: 1024px) {
          .lp-problem__grid { grid-template-columns: 1fr; }
          .lp-pcard__visual { height: 280px; }
        }

        /* ── Showcase / Best UGC ──────────────────────────────────────────── */
        .lp-showcase {
          padding: 80px 8% 100px;
          background: linear-gradient(180deg, #FFFFFF 0%, #FAF5FF 100%);
        }
        .lp-showcase__inner {
          max-width: 1200px;
          margin: 0 auto;
          text-align: center;
        }
        .lp-showcase__heading {
          font-family: 'Instrument Sans', sans-serif;
          font-size: clamp(2rem, 4.2vw, 3.4rem);
          font-weight: 500;
          color: var(--lp-ink);
          line-height: 1.2;
          letter-spacing: -0.04em;
          margin: 0 0 14px 0;
        }
        .lp-showcase__heading--accent {
          background: linear-gradient(90deg, #7C3AED 0%, #A855F7 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .lp-showcase__subtitle {
          font-family: 'Instrument Sans', sans-serif;
          color: var(--lp-text-muted);
          font-size: 1rem;
          line-height: 1.5;
          letter-spacing: -0.015em;
          margin: 0 0 40px;
        }

        .lp-showcase__filters {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 10px;
          margin-bottom: 50px;
          max-width: 980px;
          margin-left: auto;
          margin-right: auto;
        }

        .lp-filter {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 100px;
          background: #ffffff;
          border: 1px solid var(--lp-border);
          color: var(--lp-text);
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.92rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 1px 3px rgba(0,0,0,0.03);
        }
        .lp-filter svg { color: var(--lp-text-muted); flex-shrink: 0; }
        .lp-filter:hover {
          border-color: var(--lp-purple-300);
          color: var(--lp-purple-700);
        }
        .lp-filter:hover svg { color: var(--lp-purple-600); }
        .lp-filter.is-active {
          background: var(--lp-purple-50);
          border-color: var(--lp-purple-500);
          color: var(--lp-purple-700);
        }
        .lp-filter.is-active svg { color: var(--lp-purple-600); }

        .lp-filter--reset {
          background: var(--lp-ink);
          color: #ffffff;
          border-color: var(--lp-ink);
        }
        .lp-filter--reset:hover {
          background: var(--lp-purple-700);
          color: #ffffff;
          border-color: var(--lp-purple-700);
        }

        .lp-showcase__grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
        }

        .lp-showcase-card {
          position: relative;
          aspect-ratio: 9 / 14;
          border-radius: 18px;
          overflow: hidden;
          background: #111;
          box-shadow: 0 18px 40px rgba(0,0,0,0.12);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .lp-showcase-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 24px 52px rgba(124, 58, 237, 0.18);
        }

        .lp-showcase-card__media {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .lp-showcase-card__tag {
          position: absolute;
          top: 12px;
          right: 12px;
          padding: 6px 14px;
          border-radius: 100px;
          background: rgba(255,255,255,0.95);
          backdrop-filter: blur(6px);
          color: var(--lp-text);
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.78rem;
          font-weight: 500;
          box-shadow: 0 4px 12px rgba(0,0,0,0.10);
          letter-spacing: -0.01em;
        }

        @media (max-width: 1024px) {
          .lp-showcase__grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 640px) {
          .lp-showcase { padding: 60px 5%; }
          .lp-showcase__grid { grid-template-columns: 1fr; }
          .lp-filter { padding: 8px 14px; font-size: 0.82rem; }
        }

        /* ── Features ─────────────────────────────────────────────────────── */
        .lp-features {
          padding: 120px 8%;
          background: #ffffff;
          position: relative;
        }
        .lp-features__inner {
          max-width: 1200px;
          margin: 0 auto;
          text-align: center;
        }

        .lp-eyebrow {
          display: inline-flex;
          align-items: center;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.18em;
          color: var(--lp-purple-700);
          text-transform: uppercase;
          margin-bottom: 18px;
          padding: 6px 14px;
          border-radius: 100px;
          background: var(--lp-purple-50);
          border: 1px solid var(--lp-purple-200);
        }

        .lp-section-heading {
          font-family: 'Instrument Sans', sans-serif;
          font-size: clamp(2rem, 3.5vw, 2.8rem);
          font-weight: 600;
          color: var(--lp-ink);
          margin-bottom: 60px;
          letter-spacing: -0.01em;
        }

        .lp-features__grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 20px;
          text-align: left;
        }

        .lp-card {
          background: #ffffff;
          padding: 32px 26px 26px;
          border-radius: 20px;
          border: 1.5px solid var(--lp-border);
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
          cursor: default;
          transition: border-color 0.3s ease, box-shadow 0.3s ease;
          position: relative;
          overflow: hidden;
        }
        .lp-card::after {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: var(--card-accent, var(--lp-purple-500));
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .lp-card:hover {
          border-color: var(--lp-purple-200);
          box-shadow: 0 16px 40px var(--card-glow, rgba(168,85,247,0.18));
        }
        .lp-card:hover::after { opacity: 1; }

        .lp-card__num {
          position: absolute;
          top: 20px;
          right: 22px;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: #E5E7EB;
        }

        .lp-card__icon {
          width: 54px;
          height: 54px;
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          margin-bottom: 22px;
          transition: transform 0.3s ease;
          flex-shrink: 0;
        }
        .lp-card:hover .lp-card__icon {
          transform: scale(1.08) rotate(-3deg);
        }

        .lp-card__title {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 1.12rem;
          font-weight: 600;
          color: var(--lp-ink);
          margin-bottom: 10px;
        }

        .lp-card__body {
          font-family: 'Instrument Sans', sans-serif;
          color: var(--lp-text-muted);
          font-size: 0.92rem;
          line-height: 1.7;
          margin-bottom: 20px;
        }

        .lp-card__bar {
          height: 2px;
          border-radius: 2px;
          opacity: 0.35;
          transition: opacity 0.3s ease, width 0.35s ease;
          width: 36px;
        }
        .lp-card:hover .lp-card__bar {
          opacity: 0.85;
          width: 100%;
        }

        /* ── CTA ──────────────────────────────────────────────────────────── */
        .lp-cta {
          position: relative;
          padding: 120px 8%;
          background: linear-gradient(135deg, #FAF5FF 0%, #E9D5FF 50%, #FAF5FF 100%);
          overflow: hidden;
          text-align: center;
        }

        .lp-cta__inner {
          position: relative;
          z-index: 1;
          max-width: 680px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .lp-cta__heading {
          font-family: 'Instrument Sans', sans-serif;
          font-size: clamp(2.2rem, 4vw, 3rem);
          font-weight: 600;
          color: var(--lp-ink);
          margin-bottom: 18px;
          line-height: 1.2;
          letter-spacing: -0.02em;
        }

        .lp-cta__subtext {
          font-family: 'Instrument Sans', sans-serif;
          color: var(--lp-text-muted);
          font-size: 1.05rem;
          line-height: 1.7;
          margin-bottom: 52px;
        }

        .lp-cta__stats {
          display: flex;
          justify-content: center;
          gap: 52px;
          margin-bottom: 52px;
          flex-wrap: wrap;
        }

        .lp-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
        }

        .lp-stat__value {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 2.2rem;
          font-weight: 700;
          background: linear-gradient(135deg, #7C3AED, #A855F7);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          line-height: 1;
        }
        .lp-stat__label {
          font-family: 'Instrument Sans', sans-serif;
          color: var(--lp-text-muted);
          font-size: 0.78rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .lp-cta__btn-wrap {
          display: inline-flex;
          margin-bottom: 28px;
        }

        .lp-btn-join {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 16px 42px;
          border-radius: 100px;
          background: var(--lp-ink);
          color: white;
          font-family: 'Instrument Sans', sans-serif;
          font-weight: 600;
          font-size: 1.05rem;
          border: none;
          cursor: pointer;
          transition: all 0.25s ease;
          box-shadow: 0 8px 28px rgba(10,10,10,0.25);
        }
        .lp-btn-join:hover {
          transform: translateY(-3px);
          background: var(--lp-purple-700);
          box-shadow: 0 16px 40px rgba(124, 58, 237, 0.42);
        }

        .lp-cta__proof {
          font-family: 'Instrument Sans', sans-serif;
          color: var(--lp-text-muted);
          font-size: 0.85rem;
        }

        /* ── Responsive ───────────────────────────────────────────────────── */
        @media (max-width: 1024px) {
          .lp-hero__inner {
            grid-template-columns: 1fr;
            text-align: center;
          }
          .lp-hero__text { align-items: center; }
          .lp-hero__subtitle { max-width: 100%; }
          .lp-hero__ctas, .lp-hero__badges { justify-content: center; }
          .lp-hero__media {
            order: -1;
            max-width: 520px;
            margin: 0 auto;
            aspect-ratio: 1 / 0.9;
          }
          .lp-float--creators { left: 2%; }
          .lp-chips { right: 2%; }
        }

        @media (max-width: 640px) {
          .lp-hero { padding: 120px 5% 60px; }
          .lp-features, .lp-cta { padding: 80px 5%; }
          .lp-navbar { padding: 0 4%; }
          .lp-navbar__inner { padding: 10px 14px; }
          .lp-btn-signin, .lp-btn-dark { padding: 8px 16px; font-size: 0.85rem; }
          .lp-hero__ctas { flex-direction: column; align-items: stretch; width: 100%; }
          .lp-btn-primary, .lp-btn-ghost { justify-content: center; }
          .lp-cta__stats { gap: 32px; }
          .lp-float { display: none; }
          .lp-chips { display: none; }
          .lp-phone--left, .lp-phone--right { transform: none; }
          .lp-hero__badges { gap: 6px; }
          .lp-proof-badge { font-size: 0.7rem; padding: 5px 10px; }
        }
      `}</style>
    </div>
  );
}
