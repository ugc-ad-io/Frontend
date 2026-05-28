import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import {
  ArrowRight,
  ChevronRight,
  Star,
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
  Music2,
  Video,
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
  Check,
  X,
  Linkedin,
  Youtube,
  Twitter,
  SkipForward,
  BellOff,
  Repeat,
} from 'lucide-react';
import { motion, useInView, animate, useMotionValue, useTransform, useScroll } from 'framer-motion';

// ─── Static data ────────────────────────────────────────────────────────────

const featureData = [
  {
    Icon: Users,
    title: 'Creator Matchmaking',
    desc: 'Private, vetted, brand-safe storytellers.',
    gradient: 'linear-gradient(135deg, #07074e 0%, #8888A0 100%)',
    glow: 'rgba(7, 7, 78, 0.28)',
    accent: '#07074e',
    num: '01',
  },
  {
    Icon: MessageCircle,
    title: 'Direct Collaboration',
    desc: 'No agencies. No lag. No dilution.',
    gradient: 'linear-gradient(135deg, #07074e 0%, #07074e 100%)',
    glow: 'rgba(7, 7, 78, 0.28)',
    accent: '#07074e',
    num: '02',
  },
  {
    Icon: Activity,
    title: 'Performance Clarity',
    desc: 'See what converts. Double down with confidence.',
    gradient: 'linear-gradient(135deg, #1F1F4E 0%, #8888A0 100%)',
    glow: 'rgba(31, 31, 102, 0.28)',
    accent: '#1F1F4E',
    num: '03',
  },
  {
    Icon: Zap,
    title: 'AI UGC',
    desc: 'Speed, without losing the signal.',
    gradient: 'linear-gradient(135deg, #050538 0%, #07074e 100%)',
    glow: 'rgba(5, 5, 56, 0.28)',
    accent: '#050538',
    num: '04',
  },
];

const stats = [
  { value: '50,000+', label: 'UGC Videos Produced' },
  { value: '$100M+', label: 'Attributed Revenue' },
  { value: '300+', label: 'D2C Brands Scaled' },
];

const howItWorksSteps = [
  {
    num: '01',
    Icon: Users,
    title: 'Match With Belief, Not Reach',
    desc: "We don't optimize for followers. We optimize for overlap — tone, values, visual instinct.",
    tag: 'Matching',
  },
  {
    num: '02',
    Icon: Zap,
    title: 'Work Without Middlemen',
    desc: 'Talk directly. Edit quickly. Launch while the moment still matters.',
    tag: 'Collaboration',
  },
  {
    num: '03',
    Icon: Activity,
    title: 'Scale What Earned Attention',
    desc: "When something works, we don't replace it. We multiply it — carefully.",
    tag: 'Growth',
  },
];

const testimonials = [
  {
    quote: 'Our ads stopped feeling like ads. That\'s when ROAS stabilized.',
    accent: 'ROAS stabilized',
    name: 'Rohan Kapoor',
    role: 'Founder, Glowly · D2C Beauty',
    photo: 'https://images.unsplash.com/photo-1600896997793-b8ed3459a17f?w=400&h=400&fit=crop&crop=faces',
    initials: 'RK',
    metric: '+2.3×',
    metricLabel: 'ROAS in 60 days',
  },
  {
    quote: 'Finally, content that doesn\'t scream "I was paid for this."',
    accent: 'doesn\'t scream',
    name: 'Ananya Verma',
    role: 'CMO, Thix Hair',
    photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=faces',
    initials: 'AV',
    metric: '4.1×',
    metricLabel: 'Hook-rate lift',
  },
  {
    quote: 'We went from 12 mediocre creatives a month to 3 great ones. Sales doubled.',
    accent: 'Sales doubled',
    name: 'Marcus Lee',
    role: 'Founder, Gener8',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=faces',
    initials: 'ML',
    metric: '2×',
    metricLabel: 'Revenue growth',
  },
];

const auditQuestions = [
  {
    title: 'Do People Watch Your Ads —',
    sub: 'Or Tolerate Them Until They Can Skip?',
    Icon: SkipForward,
  },
  {
    title: 'If Your Brand Went Silent for a Week,',
    sub: 'Would Anyone Notice?',
    Icon: BellOff,
  },
  {
    title: 'Is Your Content Building Familiarity —',
    sub: 'Or Just Filling Space?',
    Icon: Repeat,
  },
];

const proofBadges = [
  { Icon: Award, label: 'Top UGC Platform 2026' },
  { Icon: Users, label: '500+ Brands' },
  { Icon: Sparkles, label: '10K+ Creators' },
];

// Icon positions in SVG viewBox 1190×330 — extracted from reference Lottie SVG.
const HERO_ICONS = [
  { Icon: Users,     label: 'Creator',   x: 174.6,  y: 52.7,  bg: 'linear-gradient(135deg, #3B82F6, #1D4ED8)', iconColor: '#fff' },
  { Icon: Video,     label: 'Content',   x: 63,     y: 164.5, bg: 'linear-gradient(135deg, #F97316, #FBBF24)', iconColor: '#fff' },
  { Icon: Instagram, label: 'Instagram', x: 286.6,  y: 276.8, bg: 'linear-gradient(135deg, #EF4444, #DC2626)', iconColor: '#fff' },
  { Icon: Music2,    label: 'TikTok',    x: 1126.6, y: 52.5,  bg: '#ffffff', iconColor: '#38A1D6' },
  { Icon: Briefcase, label: 'Gig',       x: 1014.6, y: 276.5, bg: 'linear-gradient(135deg, #334155, #1E293B)', iconColor: '#fff' },
];

// Exact path data from the reference Lottie SVG (viewBox 1190×330).
// Path is relative to center (567.618, 148) — wrapped in <g transform> at render.
const CONNECTOR_PATH_D = "M-354.98,112 C-354.98,112 -524,112 -524,112 C-528.42,112 -532,108.42 -532,104 C-532,104 -532,48.71 -532,48.71 M-532,-47.65 C-532,-47.65 -532,-104 -532,-104 C-532,-108.42 -528.42,-112 -524,-112 C-524,-112 -468,-112 -468,-112 M-374,-112 C-374,-112 -288,-112 -288,-112 C-283.58,-112 -280,-108.42 -280,-104 C-280,-104 -280,-60.19 -280,-60.19 C-280,-55.78 -276.42,-52.19 -272,-52.19 C-272,-52.19 -228.2,-52.19 -228.2,-52.19 M-485.14,0 C-485.14,0 -316.2,0 -316.2,0 C-311.78,0 -308.2,3.58 -308.2,8 C-308.2,8 -308.2,51.24 -308.2,51.24 M-308.2,51.24 C-308.2,51.24 -308.2,63.94 -308.2,63.94 M-308.2,51.24 C-308.2,51.24 -236.2,51.24 -236.2,51.24 C-231.78,51.24 -228.2,54.82 -228.2,59.24 C-228.2,59.24 -228.2,69.82 -228.2,69.82 C-228.2,74.24 -224.62,77.82 -220.2,77.82 C-220.2,77.82 -201.2,77.82 -201.2,77.82 M233.84,-52.3 C233.84,-52.3 306.08,-52.3 306.08,-52.3 M479.51,-112 C479.51,-112 400.01,-112 400.01,-112 C395.59,-112 392,-108.42 392,-104 C392,-104 392,-60.3 392,-60.3 C392,-55.88 388.42,-52.3 384,-52.3 C384,-52.3 306.08,-52.3 306.08,-52.3 M420,65.18 C420,65.18 420,59.24 420,59.24 C420,54.82 416.42,51.24 412,51.24 C412,51.24 306.08,51.24 306.08,51.24 M467.59,112 C467.59,112 524,112 524,112 C528.42,112 532,108.42 532,104 C532,104 532,-65.13 532,-65.13 M306.08,-52.3 C306.08,-52.3 306.08,51.24 306.08,51.24 M306.08,51.24 C306.08,51.24 241.84,51.24 241.84,51.24 C237.43,51.24 233.84,54.82 233.84,59.24 C233.84,59.24 233.84,69.84 233.84,69.84 C233.84,74.26 230.26,77.84 225.84,77.84 C225.84,77.84 201,77.84 201,77.84";

// Arrow markers — positions in absolute 1190×330 viewBox coords.
const HERO_ARROWS = [
  { x: 246.9, y: 276.2, rot: 0, color: '#FF4D4D' },
  { x: 62.6, y: 204.2, rot: 90, color: '#FFB866' },
  { x: 62.6, y: 124.9, rot: 270, color: '#FFB866' },
  { x: 134.9, y: 52.5, rot: 0, color: '#316BFF' },
  { x: 214.3, y: 52.7, rot: 180, color: '#316BFF' },
  { x: 375.3, y: 112.2, rot: 0, color: '#213856' },
  { x: 816, y: 112.2, rot: 180, color: '#213856' },
  { x: 403, y: 242.4, rot: 0, color: '#213856' },
  { x: 784.4, y: 242.4, rot: 180, color: '#C8F23A' },
  { x: 286.6, y: 237.2, rot: 270, color: '#FF4D4D' },
  { x: 102.7, y: 164.5, rot: 0, color: '#FFB866' },
  { x: 1014.6, y: 236.9, rot: 270, color: '#fff' },
  { x: 1126.8, y: 92.2, rot: 90, color: '#38A1D6' },
  { x: 1054.6, y: 276.8, rot: 0, color: '#fff' },
  { x: 1086.8, y: 52.5, rot: 180, color: '#38A1D6' },
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

// Comparison table data: UGCad vs In-house vs UGC agencies vs UGC platforms
const CHECK = '__check__';
const CROSS = '__cross__';
const compareRows = [
  { label: 'Flexible plans or pay-per-video',  us: CHECK, inhouse: CHECK, agencies: CROSS, platforms: CHECK },
  { label: 'Dedicated support',                us: CHECK, inhouse: CROSS, agencies: CHECK, platforms: CROSS },
  { label: 'Costs',                            us: '$$',  inhouse: '$$$\n(including salaries)', agencies: '$$$$', platforms: '$' },
  { label: 'Creator quality',                  us: 'High', inhouse: 'Uncertain', agencies: 'Usually good', platforms: 'Low' },
  { label: 'Turnaround time',                  us: 'Within 14 days', inhouse: 'Unpredictable', agencies: '4-6 weeks', platforms: 'Days' },
  { label: 'Content quality',                  us: 'High', inhouse: 'Uncertain', agencies: 'Good', platforms: 'Low' },
  { label: 'Creative strategy support',        us: CHECK, inhouse: CROSS, agencies: CHECK, platforms: CROSS },
  { label: 'Control over content',             us: CHECK, inhouse: CHECK, agencies: CROSS, platforms: CHECK },
];

// Six showcase video slots — all unique local UGC videos from /public folder.
const showcaseVideos = [
  { id: 1, industryId: 'apps',    label: 'Apps/Software',    isVideo: true,
    src: '/17811912-uhd_2160_3840_24fps.mp4',
    brand: 'Color By Number', creator: 'Abigail', logoBg: 'linear-gradient(135deg, #3A3A66, #fb923c)', logoText: 'CN' },
  { id: 2, industryId: 'apps',    label: 'Apps/Software',    isVideo: true,
    src: '/6944288-uhd_2160_3840_24fps.mp4',
    brand: 'Gener8',          creator: 'Chelsea', logoBg: 'linear-gradient(135deg, #1F1F4E, #07074e)', logoText: '8' },
  { id: 3, industryId: 'family',  label: 'Family/Kids',      isVideo: true,
    src: '/6951180-uhd_2160_3840_24fps.mp4',
    brand: 'Gatorade',        creator: 'Becki',   logoBg: 'linear-gradient(135deg, #fb923c, #f59e0b)', logoText: 'G' },
  { id: 4, industryId: 'beauty',  label: 'Beauty/Cosmetics', isVideo: true,
    src: '/7690504-hd_1080_1920_30fps.mp4',
    brand: 'Glowly',          creator: 'Maya',    logoBg: 'linear-gradient(135deg, #fb7185, #f43f5e)', logoText: 'Gl' },
  { id: 5, industryId: 'beauty',  label: 'Beauty/Cosmetics', isVideo: true,
    src: '/13929852-uhd_2160_3840_24fps.mp4',
    brand: 'Thix Hair',       creator: 'Lara',    logoBg: 'linear-gradient(135deg, #34d399, #14b8a6)', logoText: 'T' },
  { id: 6, industryId: 'beauty',  label: 'Beauty/Cosmetics', isVideo: true,
    src: '/6948556-uhd_2160_3840_24fps.mp4',
    brand: 'AirShine',        creator: 'Priya',   logoBg: 'linear-gradient(135deg, #1F1F4E, #1F1F4E)', logoText: 'A' },
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

// Animated counter — counts up from 0 to `target` when scrolled into view.
// Preserves the original string's prefix ($) and suffix (+, K, M).
function CountUp({ value }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const motionVal = useMotionValue(0);

  // Parse the value string: extract prefix, number, and suffix
  const parsed = (() => {
    const str = String(value);
    const prefix = str.match(/^[^\d]*/)?.[0] || '';
    const suffix = str.match(/[^\d]*$/)?.[0] || '';
    const numericPart = str.replace(/[^\d.]/g, '');
    // Detect K / M shorthand
    let multiplier = 1;
    if (/M/i.test(suffix)) multiplier = 1;       // already a big number in display
    else if (/K/i.test(suffix)) multiplier = 1;
    const num = parseFloat(numericPart) || 0;
    return { prefix, suffix, num, multiplier };
  })();

  const display = useTransform(motionVal, (latest) => {
    const n = Math.floor(latest);
    // Format with commas for big numbers
    const formatted = n.toLocaleString('en-US');
    return `${parsed.prefix}${formatted}${parsed.suffix}`;
  });

  useEffect(() => {
    if (!inView) return;
    const controls = animate(motionVal, parsed.num, {
      duration: 2.2,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [inView, motionVal, parsed.num]);

  return <motion.span ref={ref}>{display}</motion.span>;
}

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

  // Audit cards — scroll-linked peel-away animation
  const auditRef = useRef(null);
  const { scrollYProgress: auditProgress } = useScroll({
    target: auditRef,
    offset: ['start start', 'end end'],
  });
  // Q1 (back-left, z=1) peels last; Q2 (front, z=3) peels first; Q3 (right, z=2) peels middle
  // Order of peeling: Q2 → Q3 → Q1 (in stack-front-to-back order)
  const card2Y = useTransform(auditProgress, [0.1, 0.35], [0, -800]);
  const card2Opacity = useTransform(auditProgress, [0.1, 0.32], [1, 0]);
  const card3Y = useTransform(auditProgress, [0.4, 0.65], [35, -800]);
  const card3Opacity = useTransform(auditProgress, [0.4, 0.62], [1, 0]);
  const card1Y = useTransform(auditProgress, [0.7, 0.95], [-35, -800]);
  const card1Opacity = useTransform(auditProgress, [0.7, 0.92], [1, 0]);
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

  // Hero phone-mini video (currently commented out in JSX)
  // const leftVideo = '/9384669-uhd_2160_3840_24fps.mp4';

  return (
    <div className="lp-root">

      {/* ── Animated background blobs ───────────────────────────────────── */}
      <div className="lp-bg-animations" aria-hidden="true">
        <div className="lp-bg-blob lp-bg-blob--1" />
        <div className="lp-bg-blob lp-bg-blob--2" />
        <div className="lp-bg-blob lp-bg-blob--3" />
        <div className="lp-bg-blob lp-bg-blob--4" />
      </div>

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
        {/* Layer 1: dashed connectors + icons + arrows — all in one SVG, one coordinate system */}
        <svg
          className="lp-hero__connectors"
          viewBox="0 0 1190 330"
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          {/* Dashed paths — exact reference geometry, offset to center */}
          <g transform="translate(594.618, 164.5)">
            <motion.path
              d={CONNECTOR_PATH_D}
              fill="none"
              stroke="rgb(152, 161, 172)"
              strokeOpacity="0.6"
              strokeWidth="1"
              strokeDasharray="4 4"
              strokeLinecap="round"
              strokeLinejoin="miter"
              strokeMiterlimit="4"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.4, ease: 'easeOut' }}
            />
          </g>

          {/* Single animated line — follows one continuous route across the circuit */}
          <line x1="0" y1="0" x2="16" y2="0" stroke="#C8F23A" strokeWidth="2" strokeLinecap="round" opacity="0.8">
            <animateMotion dur="20s" repeatCount="indefinite" rotate="auto"
              path="M 240 276 L 71 276 C 67 276 63 272 63 268 L 63 61 C 63 57 67 53 71 53 L 307 53 C 311 53 315 57 315 61 L 315 104 C 315 108 319 112 323 112 L 366 112 L 287 165 L 287 216 L 358 216 C 362 216 366 220 366 224 L 366 234 C 366 238 370 242 374 242 L 393 242 L 500 242 L 700 242 L 796 242 C 800 242 804 238 804 234 L 804 224 C 804 220 808 216 812 216 L 901 216 L 901 112 C 901 108 905 104 909 104 L 979 112 C 983 112 987 108 987 104 L 987 61 C 987 57 991 53 995 53 L 1074 53 L 1127 53 C 1127 57 1127 99 1127 99 L 1127 268 C 1127 272 1123 276 1119 276 L 1062 276"
            />
          </line>

          {/* Arrow markers at exact reference positions */}
          {HERO_ARROWS.map((a, i) => (
            <polygon
              key={i}
              points="-3.7,-4.2 3.7,0 -3.7,4.2"
              fill={a.color}
              transform={`translate(${a.x},${a.y}) rotate(${a.rot})`}
            />
          ))}

          {/* Icons inside SVG — exact reference positions */}
          {HERO_ICONS.map(({ Icon, label, x, y, bg, iconColor }, i) => (
            <motion.g
              key={label}
              initial={{ opacity: 0, scale: 0.5 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.7 + i * 0.1, type: 'spring', stiffness: 220 }}
              style={{ transformOrigin: `${x}px ${y}px` }}
            >
              <foreignObject x={x - 44} y={y - 44} width={88} height={88}>
                <div
                  className="lp-hero__icon"
                  style={{ background: bg }}
                  aria-label={label}
                >
                  <Icon size={22} color={iconColor || '#fff'} strokeWidth={2} />
                </div>
              </foreignObject>
            </motion.g>
          ))}
        </svg>

        {/* Layer 3: headline + CTAs */}
        <div className="lp-hero__inner">
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
            Your Ads Aren't Being Ignored.
            <br />
            <span className="lp-hero__mark">They're Being Doubted.</span>
          </motion.h1>

          <motion.p
            className="lp-hero__subtitle"
            custom={2}
            variants={heroItemVariants}
            initial="hidden"
            animate="visible"
          >
            People don't scroll because they're bored.
            <br />
            They scroll because they don't trust what they see.
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
              Find My Creator Match <ArrowRight size={18} />
            </button>
            <button
              className="lp-btn-ghost"
              onClick={() => navigate('/auth')}
              data-testid="learn-more-btn"
            >
              Join the Creator Network
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

        {/* Layer 4: shrunk phone tucked bottom-right — commented out */}
        {/*
        <motion.div
          className="lp-hero__phone-mini"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.9 }}
        >
          <video src={leftVideo} autoPlay muted loop playsInline />
        </motion.div>
        */}

        {/* Layer 5: bottom strip — counter + scrolling logos */}
        <div className="lp-hero__strip">
          <div className="lp-hero__brands-side lp-hero__brands-side--left">
            <div className="lp-brands__track lp-brands__track--left">
              {(() => {
                const base = [
                  { name: 'Amazon', letter: 'a' },
                  { name: 'Apple', letter: '' },
                  { name: 'Google', letter: 'G' },
                  { name: 'Netflix', letter: 'N' },
                  { name: 'Spotify', letter: '♫' },
                  { name: 'Tesla', letter: 'T' },
                  { name: 'Meta', letter: '∞' },
                  { name: 'Microsoft', letter: '⊞' },
                ];
                return [...base, ...base, ...base, ...base];
              })().map((b, i) => (
                <div key={`L-${b.name}-${i}`} className="lp-brand-item">
                  <div className="lp-brand-item__icon">{b.letter}</div>
                  <div className="lp-brand-item__name">{b.name}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="lp-hero__brand-center">
            <img src="/edited-image-preview_-_Edited-removebg-preview.png" alt="UGCad.io" />
          </div>

          <div className="lp-hero__brands-side lp-hero__brands-side--right">
            <div className="lp-brands__track lp-brands__track--right">
              {(() => {
                const base = [
                  { name: 'HubSpot', letter: 'H' },
                  { name: 'Notion', letter: 'N' },
                  { name: 'Slack', letter: '#' },
                  { name: 'Stripe', letter: 'S' },
                  { name: 'Figma', letter: 'F' },
                  { name: 'Canva', letter: 'C' },
                  { name: 'Airbnb', letter: 'A' },
                  { name: 'Uber', letter: 'U' },
                ];
                return [...base, ...base, ...base, ...base];
              })().map((b, i) => (
                <div key={`R-${b.name}-${i}`} className="lp-brand-item">
                  <div className="lp-brand-item__icon">{b.letter}</div>
                  <div className="lp-brand-item__name">{b.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Layer 6: curved divider into next light section */}
        <svg
          className="lp-hero__divider"
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0,0 C480,80 960,80 1440,0 L1440,80 L0,80 Z" fill="#0a0a0a" />
        </svg>
      </section>

      {/* connector 1: hero → hook — joined U-bridge with center drop into badge */}
      <div className="lp-connector" style={{ height: 380, marginBottom: -110 }}>
        <svg viewBox="0 0 1400 380" width="100%" height="100%" preserveAspectRatio="none">
          <path d="M 80 0 L 80 80 L 480 80 L 480 180" fill="none" stroke="rgb(152,161,172)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.5" />
          <path d="M 1320 0 L 1320 80 L 920 80 L 920 180" fill="none" stroke="rgb(152,161,172)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.5" />
          <path d="M 480 180 L 920 180" fill="none" stroke="rgb(152,161,172)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.5" />
          <path d="M 700 180 L 700 380" fill="none" stroke="rgb(152,161,172)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.5" />
        </svg>
      </div>

      {/* ── Scroll Hook ───────────────────────────────────────────────────── */}
      <section className="lp-hook">
        <div className="lp-hook__bg-orb lp-hook__bg-orb--1" aria-hidden="true" />
        <div className="lp-hook__bg-orb lp-hook__bg-orb--2" aria-hidden="true" />

        <div className="lp-hook__inner">
          <span className="lp-hook__pill">
            <span className="lp-hook__pulse" />
            Truth in 5 seconds
          </span>

          <h2 className="lp-hook__heading">
            Most Ads Fail Before the{' '}
            <span className="lp-hook__heading--accent">Sound Turns On.</span>
          </h2>

          <div className="lp-hook__quote-wrap">
            <div className="lp-hook__quote-card">
              <span className="lp-hook__quote-mark">"</span>
              <p className="lp-hook__quote-text">
                The brain decides in the first few seconds —{' '}
                <em>is this real, or is this trying to sell me something?</em>
              </p>
            </div>
          </div>

          <div className="lp-hook__cta-row">
            <span className="lp-hook__cta-line" aria-hidden="true" />
            <p className="lp-hook__tag">We design for that moment.</p>
            <span className="lp-hook__cta-line" aria-hidden="true" />
          </div>
        </div>
      </section>

      {/* connector 2: hook → steps — straight vertical line, overlaps into both sections */}
      <div className="lp-connector" style={{ height: 320, marginTop: -100, marginBottom: -100 }}>
        <svg viewBox="0 0 1400 320" width="100%" height="100%" preserveAspectRatio="none">
          <path d="M 700 0 L 700 320" fill="none" stroke="rgb(152,161,172)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.5" />
        </svg>
      </div>

      {/* ── How It Works (3 Steps) ────────────────────────────────────────── */}
      <section className="lp-steps">
        <div className="lp-steps__inner">
          <span className="lp-steps__eyebrow">How it works</span>
          <h2 className="lp-steps__heading">Less Noise. Better Voices.</h2>
          <p className="lp-steps__subtitle">
            Three deliberate steps. No marketplace chaos. No agency lag.
          </p>

          <div className="lp-steps__grid">
            {howItWorksSteps.map((s, i) => (
              <article key={s.num} className="lp-step-card">
                <div className="lp-step-card__header">
                  <span className="lp-step-card__num">Step {s.num}</span>
                  <span className="lp-step-card__tag">{s.tag}</span>
                </div>

                <div className="lp-step-card__icon">
                  <s.Icon size={24} />
                </div>

                <h3 className="lp-step-card__title">{s.title}</h3>
                <p className="lp-step-card__desc">{s.desc}</p>

                <div className="lp-step-card__footer">
                  <span className="lp-step-card__arrow">
                    <ArrowRight size={16} />
                  </span>
                </div>

                {i < howItWorksSteps.length - 1 && (
                  <div className="lp-step-card__connector" aria-hidden="true">
                    <ChevronRight size={20} />
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── The Problem ────────────────────────────────────────────────────── */}
      <section className="lp-problem" style={{ display: 'none' }}>
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

      {/* connector 3: steps → showcase — L-bends from outer cards + center straight line */}
      <div className="lp-connector" style={{ height: 270, marginTop: -100, marginBottom: -80 }}>
        <svg viewBox="0 0 1400 270" width="100%" height="100%" preserveAspectRatio="none">
          <path d="M 300 0 L 300 100 L 500 100 L 500 270" fill="none" stroke="rgb(152,161,172)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.5" />
          <path d="M 1100 0 L 1100 100 L 900 100 L 900 270" fill="none" stroke="rgb(152,161,172)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.5" />
          <path d="M 700 0 L 700 270" fill="none" stroke="rgb(152,161,172)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.5" />
        </svg>
      </div>

      {/* ── Showcase — Best UGC on the internet ────────────────────────────── */}
      <section className="lp-showcase">
        <div className="lp-showcase__inner">
          <h2 className="lp-showcase__heading">
            We create the{' '}
            <span className="lp-showcase__heading--accent">best UGC</span>{' '}
            on the internet
          </h2>


          <div className="lp-showcase__viewport">
          {(() => {
            const items = visibleShowcase.length ? visibleShowcase : showcaseVideos;
            const mid = Math.ceil(items.length / 2);
            const row1 = items.slice(0, mid);
            const row2 = items.slice(mid).length ? items.slice(mid) : items.slice(0, mid);
            const renderItem = (v, idx, prefix) => (
              <div key={`${prefix}-${v.id}-${idx}`} className="lp-showcase-item">
                <div className="lp-showcase-card">
                  {v.isVideo ? (
                    <video
                      src={v.src}
                      className="lp-showcase-card__media"
                      autoPlay
                      muted
                      loop
                      playsInline
                    />
                  ) : (
                    <img
                      src={v.src}
                      alt={v.brand}
                      className="lp-showcase-card__media"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.parentNode.style.background = v.logoBg;
                      }}
                    />
                  )}
                </div>
                <div className="lp-showcase-meta">
                  <div className="lp-showcase-meta__row">
                    <div className="lp-showcase-meta__info">
                      <div className="lp-showcase-meta__brand">{v.brand}</div>
                    </div>
                    <div className="lp-showcase-meta__logo" style={{ background: v.logoBg }}>
                      {v.logoText}
                    </div>
                  </div>
                  <div className="lp-showcase-meta__stars">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} size={14} fill="#FBBF24" stroke="#FBBF24" />
                    ))}
                  </div>
                </div>
              </div>
            );
            return (
              <>
                <div className="lp-showcase__row">
                  <div className="lp-showcase__track lp-showcase__track--left">
                    {[...row1, ...row1, ...row1].map((v, idx) => renderItem(v, idx, 'R1'))}
                  </div>
                </div>
                <div className="lp-showcase__row">
                  <div className="lp-showcase__track lp-showcase__track--right">
                    {[...row2, ...row2, ...row2].map((v, idx) => renderItem(v, idx, 'R2'))}
                  </div>
                </div>
              </>
            );
          })()}
          </div>
        </div>
      </section>

      {/* connector 4: showcase → audit — extends up into carousel, U-shape, drops to cards */}
      <div className="lp-connector" style={{ height: 720, marginTop: -120, marginBottom: -480, position: 'relative', zIndex: 5 }}>
        <svg viewBox="0 0 1400 720" width="100%" height="100%" preserveAspectRatio="none">
          <path d="M 200 0 L 200 160 L 1200 160 L 1200 600 L 900 600 L 900 720" fill="none" stroke="rgb(152,161,172)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.5" />
        </svg>
      </div>

      {/* ── Psychological Audit ───────────────────────────────────────────── */}
      <section className="lp-audit" ref={auditRef}>
        <div className="lp-audit__bg-orb lp-audit__bg-orb--1" aria-hidden="true" />
        <div className="lp-audit__bg-orb lp-audit__bg-orb--2" aria-hidden="true" />

        <div className="lp-audit__inner">
          <span className="lp-audit__pill">
            <HelpCircle size={14} />
            Quick reality check
          </span>

          <h2 className="lp-audit__heading">
            Answer This{' '}
            <span className="lp-audit__heading--accent">Honestly</span>.
          </h2>
          <p className="lp-audit__subtitle">
            Three questions most brands avoid. The answers usually explain everything.
          </p>

          <div className="lp-audit__grid">
            {auditQuestions.map((q, i) => {
              // i=0 → Q1 (back-left, peels last), i=1 → Q2 (front, peels first), i=2 → Q3 (right, peels middle)
              const positions = [
                { x: -90, rotate: -20, z: 1, y: card1Y },
                { x:   0, rotate:  -4, z: 3, y: card2Y },
                { x:  90, rotate:  12, z: 2, y: card3Y },
              ];
              const p = positions[i] || positions[0];
              return (
                <motion.article
                  key={i}
                  className="lp-audit-card"
                  style={{
                    x: p.x,
                    y: p.y,
                    rotate: p.rotate,
                    zIndex: p.z,
                  }}
                >
                  <div className="lp-audit-card__corner">
                    <span className="lp-audit-card__qnum">Q{i + 1}</span>
                    <span className="lp-audit-card__qmark">?</span>
                  </div>
                  <div className="lp-audit-card__body">
                    <p className="lp-audit-card__title">{q.title}</p>
                    <p className="lp-audit-card__sub">{q.sub}</p>
                  </div>
                  <div className="lp-audit-card__divider" />
                  <div className="lp-audit-card__hint">Pause. Be honest.</div>
                </motion.article>
              );
            })}
          </div>

          <div className="lp-audit__footer-card">
            <div className="lp-audit__footer-icon">
              <ArrowRight size={18} />
            </div>
            <p className="lp-audit__footer-text">
              This platform exists for brands who don't like their answers yet.
            </p>
          </div>
        </div>
      </section>

      {/* connector 5+6: audit footer pill → SERVICES badge — straight center line, reaches up to audit pill */}
      <div className="lp-connector" style={{ height: 360, marginTop: -120, marginBottom: -60, position: 'relative', zIndex: 5, pointerEvents: 'none' }}>
        <svg viewBox="0 0 1400 360" width="100%" height="100%" preserveAspectRatio="none">
          <path d="M 700 0 L 700 360" fill="none" stroke="rgb(152,161,172)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.5" />
        </svg>
      </div>

      {/* ── Features ───────────────────────────────────────────────────────── */}
      <section className="lp-features" ref={featuresRef}>
        <div className="lp-features__inner">
          <motion.span
            className="lp-eyebrow"
            variants={fadeUpVariants}
            initial="hidden"
            animate={featuresInView ? 'visible' : 'hidden'}
          >
            SERVICES
          </motion.span>

          <motion.h2
            className="lp-section-heading"
            variants={fadeUpVariants}
            initial="hidden"
            animate={featuresInView ? 'visible' : 'hidden'}
            transition={{ delay: 0.1 }}
          >
            Everything You Need to Sound Human at Scale.
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

      {/* connector 7: features → proof — 4 drops from service cards, merge to center drop into proof text */}
      <div className="lp-connector" style={{ height: 380, marginTop: -120, marginBottom: -120, position: 'relative', zIndex: 5 }}>
        <svg viewBox="0 0 1400 380" width="100%" height="100%" preserveAspectRatio="none">
          <path d="M 350 0 L 350 130" fill="none" stroke="rgb(152,161,172)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.5" />
          <path d="M 583 0 L 583 130" fill="none" stroke="rgb(152,161,172)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.5" />
          <path d="M 817 0 L 817 130" fill="none" stroke="rgb(152,161,172)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.5" />
          <path d="M 1050 0 L 1050 130" fill="none" stroke="rgb(152,161,172)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.5" />
          <path d="M 350 130 L 1050 130" fill="none" stroke="rgb(152,161,172)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.5" />
          <path d="M 700 130 L 700 380" fill="none" stroke="rgb(152,161,172)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.5" />
        </svg>
      </div>

      {/* ── Value Proof (Editorial Stats) ─────────────────────────────────── */}
      <section className="lp-proof">
        <div className="lp-proof__inner">
          <div className="lp-proof__header">
            <span className="lp-proof__eyebrow">— proof, not promises</span>
            <h2 className="lp-proof__heading">Trust Changes the Math.</h2>
          </div>

          <div className="lp-proof__divider" />

          <div className="lp-proof__row">
            {stats.map((s, i) => (
              <div key={s.label} className="lp-proof-num">
                <span className="lp-proof-num__index">0{i + 1}</span>
                <span className="lp-proof-num__value">
                  <CountUp value={s.value} />
                </span>
                <span className="lp-proof-num__label">{s.label}</span>
              </div>
            ))}
          </div>

          <p className="lp-proof__micro">— Not louder ads. Better ones. —</p>
        </div>
      </section>

      {/* connector 8: proof → testimonial — straight center line, reduced spacing */}
      <div className="lp-connector" style={{ height: 220, marginTop: -60, marginBottom: -60, position: 'relative', zIndex: 5 }}>
        <svg viewBox="0 0 1400 220" width="100%" height="100%" preserveAspectRatio="none">
          <path d="M 700 0 L 700 220" fill="none" stroke="rgb(152,161,172)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.5" />
        </svg>
      </div>

      {/* ── Testimonials ──────────────────────────────────────────────────── */}
      <section className="lp-testimonial">
        <div className="lp-testimonial__bg-orb lp-testimonial__bg-orb--1" aria-hidden="true" />
        <div className="lp-testimonial__bg-orb lp-testimonial__bg-orb--2" aria-hidden="true" />

        <div className="lp-testimonial__inner">
          <span className="lp-testimonial__pill">
            <Star size={14} fill="#FBBF24" stroke="#FBBF24" />
            Founder stories
          </span>

          <h2 className="lp-testimonial__heading">
            What Changes When{' '}
            <span className="lp-testimonial__heading--accent">Trust</span>{' '}
            Comes First
          </h2>
          <p className="lp-testimonial__subtitle">
            Real founders. Real numbers. Same shift in how their ads land.
          </p>

          <div className="lp-testimonial__grid">
            {testimonials.map((t, i) => {
              const [before, after] = t.accent && t.quote.includes(t.accent)
                ? [t.quote.split(t.accent)[0], t.quote.split(t.accent)[1]]
                : [t.quote, ''];
              return (
                <article key={i} className={`lp-tcard${i === 0 ? ' lp-tcard--featured' : ''}`}>
                  <div className="lp-tcard__rating">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star key={s} size={14} fill="#FBBF24" stroke="#FBBF24" />
                    ))}
                  </div>

                  <span className="lp-tcard__mark">"</span>

                  <blockquote className="lp-tcard__quote">
                    {before}
                    {t.accent && <em>{t.accent}</em>}
                    {after}
                  </blockquote>

                  <div className="lp-tcard__author">
                    <div className="lp-tcard__photo">
                      <img
                        src={t.photo}
                        alt={t.name}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.parentNode.classList.add('lp-tcard__photo--fallback');
                        }}
                      />
                      <span className="lp-tcard__initials">{t.initials}</span>
                    </div>
                    <div className="lp-tcard__author-info">
                      <div className="lp-tcard__name">{t.name}</div>
                      <div className="lp-tcard__role">{t.role}</div>
                    </div>
                  </div>

                  <div className="lp-tcard__metric">
                    <span className="lp-tcard__metric-val">{t.metric}</span>
                    <span className="lp-tcard__metric-label">{t.metricLabel}</span>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="lp-testimonial__more">
            <span className="lp-testimonial__more-line" aria-hidden="true" />
            <span className="lp-testimonial__more-text">300+ founders. Same story, different brand.</span>
            <span className="lp-testimonial__more-line" aria-hidden="true" />
          </div>
        </div>
      </section>

      {/* connector 9: testimonial → cta — touch card bottom border only (no overlap into cards), converge to center, drop to badge */}
      <div className="lp-connector" style={{ height: 330, marginTop: -100, marginBottom: -80, position: 'relative', zIndex: 5, pointerEvents: 'none' }}>
        <svg viewBox="0 0 1400 330" width="100%" height="100%" preserveAspectRatio="none">
          <path d="M 420 0 L 420 170 L 700 170" fill="none" stroke="rgb(152,161,172)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.5" />
          <path d="M 980 0 L 980 170 L 700 170" fill="none" stroke="rgb(152,161,172)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.5" />
          <path d="M 700 170 L 700 330" fill="none" stroke="rgb(152,161,172)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.5" />
        </svg>
      </div>

      {/* ── CTA ────────────────────────────────────────────────────────────── */}
      <section className="lp-cta" ref={ctaRef}>
        <motion.div
          className="lp-cta__inner"
          variants={containerVariants}
          initial="hidden"
          animate={ctaInView ? 'visible' : 'hidden'}
        >
          <motion.span className="lp-cta__pill" variants={statVariants}>
            <span className="lp-cta__pulse" aria-hidden="true" />
            Limited slots this week
          </motion.span>

          <motion.h2 className="lp-cta__heading" variants={statVariants}>
            Attention Is{' '}
            <span className="lp-cta__heading--strike">Rented</span>.
            <br />
            Trust Is{' '}
            <span className="lp-cta__heading--accent">Owned</span>.
          </motion.h2>

          <motion.p className="lp-cta__subtext" variants={statVariants}>
            Stop renting eyeballs. Start owning belief.
          </motion.p>

          <motion.div className="lp-cta__btn-row" variants={statVariants}>
            <button
              className="lp-btn-join"
              onClick={handleGetStarted}
              data-testid="join-now-btn"
            >
              Book a Strategy Call <ArrowRight size={18} />
            </button>
            <button
              className="lp-btn-outline"
              onClick={() => navigate('/auth')}
            >
              See How It Works
            </button>
          </motion.div>

          <motion.p className="lp-cta__proof" variants={statVariants}>
            <span className="lp-cta__dot" /> 15 minutes &nbsp;·&nbsp; No pitch &nbsp;·&nbsp; Just clarity
          </motion.p>

          <motion.div className="lp-cta__signals" variants={statVariants}>
            <div className="lp-cta__signal">
              <div className="lp-cta__signal-num">300+</div>
              <div className="lp-cta__signal-label">D2C brands trust us</div>
            </div>
            <div className="lp-cta__signal-divider" />
            <div className="lp-cta__signal">
              <div className="lp-cta__signal-num">5.0★</div>
              <div className="lp-cta__signal-label">Avg founder rating</div>
            </div>
            <div className="lp-cta__signal-divider" />
            <div className="lp-cta__signal">
              <div className="lp-cta__signal-num">48h</div>
              <div className="lp-cta__signal-label">Avg response time</div>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-footer__glow" aria-hidden="true" />
        <div className="lp-footer__glow lp-footer__glow--2" aria-hidden="true" />

        <div className="lp-footer__inner">
          {/* Brand statement at top */}
          <div className="lp-footer__statement">
            <p className="lp-footer__statement-eyebrow">— Manifesto</p>
            <h3 className="lp-footer__statement-line">
              We don't help brands chase attention.{' '}
              <span className="lp-footer__statement-accent">We help them earn familiarity.</span>
            </h3>
          </div>

          {/* Main row: Logo + Links */}
          <div className="lp-footer__main">
            <div className="lp-footer__brand">
              <div className="lp-footer__logo-wrap">
                <img src="/ugcad-logo.png" alt="UGCad" className="lp-footer__logo" />
              </div>
              <p className="lp-footer__tagline">
                Built for brands who think long-term.
              </p>
              <div className="lp-footer__socials">
                <a href="#" aria-label="Instagram" className="lp-footer__social-btn"><Instagram size={16} /></a>
                <a href="#" aria-label="LinkedIn" className="lp-footer__social-btn"><Linkedin size={16} /></a>
                <a href="#" aria-label="X" className="lp-footer__social-btn"><Twitter size={16} /></a>
                <a href="#" aria-label="YouTube" className="lp-footer__social-btn"><Youtube size={16} /></a>
              </div>
            </div>

            <div className="lp-footer__links">
              <div className="lp-footer__col">
                <h4 className="lp-footer__heading">Platform</h4>
                <ul className="lp-footer__list">
                  <li><a href="#">How It Works</a></li>
                  <li><a href="#">Creators</a></li>
                  <li><a href="#">Pricing</a></li>
                  <li><a href="#">Case Studies</a></li>
                </ul>
              </div>
              <div className="lp-footer__col">
                <h4 className="lp-footer__heading">Company</h4>
                <ul className="lp-footer__list">
                  <li><a href="#">About</a></li>
                  <li><a href="#">Manifesto</a></li>
                  <li><a href="#">Contact</a></li>
                </ul>
              </div>
              <div className="lp-footer__col">
                <h4 className="lp-footer__heading">Legal</h4>
                <ul className="lp-footer__list">
                  <li><a href="#">Terms</a></li>
                  <li><a href="#">Privacy</a></li>
                  <li><a href="#">Usage Rights</a></li>
                </ul>
              </div>
            </div>
          </div>

          {/* Bottom strip */}
          <div className="lp-footer__strip">
            <span className="lp-footer__copyright">
              © {new Date().getFullYear()} UGCad.io · All rights reserved.
            </span>
            <span className="lp-footer__location">
              <span className="lp-footer__loc-dot" /> Built quietly, deliberately.
            </span>
            <a href="#top" className="lp-footer__top-link" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              Back to top <ArrowRight size={14} style={{ transform: 'rotate(-90deg)' }} />
            </a>
          </div>
        </div>
      </footer>

      {/* ── Styles ─────────────────────────────────────────────────────────── */}
      <style>{`
        :root {
          --lp-purple-50:  rgba(255,255,255,0.06);
          --lp-purple-100: rgba(255,255,255,0.08);
          --lp-purple-200: #BBBBC8;
          --lp-purple-300: #8888A0;
          --lp-purple-500: #3A3A66;
          --lp-purple-600: #1F1F4E;
          --lp-purple-700: #A78BFA;
          --lp-purple-900: #050538;
          --lp-ink:        #0A0A0A;
          --lp-text:       #ffffff;
          --lp-text-muted: rgba(255, 255, 255, 0.7);
          --lp-text-soft:  #9CA3AF;
          --lp-bg:         #0a0a0a;
          --lp-bg-soft:    #0a0a0a;
          --lp-border:     #E5E7EB;
        }

        /* ── Root ─────────────────────────────────────────────────────────── */
        .lp-root {
          min-height: 100vh;
          font-family: 'Instrument Sans', 'Inter', sans-serif;
          background: #0a0a0a;
          color: #ffffff;
          position: relative;
        }

        /* ── Animated purple background blobs ──────────────────────────── */
        .lp-bg-animations {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          overflow: hidden;
        }
        .lp-bg-blob {
          position: absolute;
          border-radius: 50%;
          background: linear-gradient(135deg, #07074e 0%, #07074e 100%);
          filter: blur(80px);
          opacity: 0.5;
          will-change: transform, opacity;
        }
        .lp-bg-blob--1 {
          width: 480px; height: 480px;
          top: 10%; left: 15%;
          animation: blobFloat1 20s ease-in-out infinite, blobPulse 6s ease-in-out infinite;
        }
        .lp-bg-blob--2 {
          width: 520px; height: 520px;
          top: 60%; right: 12%;
          animation: blobFloat2 25s ease-in-out infinite, blobPulse 8s ease-in-out infinite 2s;
        }
        .lp-bg-blob--3 {
          width: 380px; height: 380px;
          top: 40%; left: 50%;
          animation: blobFloat3 18s ease-in-out infinite, blobPulse 7s ease-in-out infinite 3s;
        }
        .lp-bg-blob--4 {
          width: 440px; height: 440px;
          bottom: 5%; left: 25%;
          animation: blobFloat4 22s ease-in-out infinite, blobPulse 9s ease-in-out infinite 1s;
        }
        @keyframes blobFloat1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33%      { transform: translate(80px, -60px) scale(1.1); }
          66%      { transform: translate(-50px, 70px) scale(0.95); }
        }
        @keyframes blobFloat2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50%      { transform: translate(-100px, -40px) scale(1.15); }
        }
        @keyframes blobFloat3 {
          0%, 100% { transform: translate(-50%, -50%) scale(1); }
          50%      { transform: translate(-30%, -70%) scale(1.2); }
        }
        @keyframes blobFloat4 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          40%      { transform: translate(120px, -80px) scale(1.1); }
          70%      { transform: translate(-60px, 40px) scale(0.9); }
        }
        @keyframes blobPulse {
          0%, 100% { opacity: 0.35; }
          50%      { opacity: 0.65; }
        }
        @media (max-width: 768px) {
          .lp-bg-blob { width: 280px !important; height: 280px !important; filter: blur(60px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .lp-bg-blob { animation: none !important; }
        }
        .lp-root h1, .lp-root h2, .lp-root h3, .lp-root h4, .lp-root h5, .lp-root h6,
        .lp-root p, .lp-root span, .lp-root div, .lp-root li, .lp-root a,
        .lp-root label, .lp-root td, .lp-root th, .lp-root strong, .lp-root em,
        .lp-root blockquote, .lp-root figcaption, .lp-root input, .lp-root textarea,
        .lp-root select, .lp-root button {
          color: #ffffff;
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
          backdrop-filter: blur(12px);
          padding: 12px 22px;
          border-radius: 100px;
          border: 1px solid rgba(0, 0, 0, 0.08);
          box-shadow: 0 2px 12px rgba(0,0,0,0.08);
          transition: box-shadow 0.3s ease;
        }

        .lp-navbar__logo {
          height: 52px;
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

        .lp-root .lp-btn-signin {
          padding: 9px 22px;
          border-radius: 100px;
          border: 1px solid rgba(0, 0, 0, 0.18);
          background: transparent;
          color: #000000;
          font-family: 'Instrument Sans', sans-serif;
          font-weight: 500;
          font-size: 0.92rem;
          cursor: pointer;
          transition: all 0.22s ease;
        }
        .lp-root .lp-btn-signin:hover {
          border-color: rgba(0, 0, 0, 0.4);
          color: #000000;
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

        /* ── Hero (dark constellation) ─────────────────────────────────────── */
        .lp-hero {
          position: relative;
          background: #0a0a0a;
          color: #ffffff;
          min-height: auto;
          padding: 130px 6% 0;
          overflow: hidden;
          isolation: isolate;
        }

        /* Layer 1: dashed SVG connectors + icons + arrows */
        .lp-hero__connectors {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: calc(100vh - 140px);
          z-index: 1;
          pointer-events: none;
        }

        /* Layer 2: floating squircle icon nodes */
        .lp-hero__icon {
          width: 56px;
          height: 56px;
          border-radius: 20px;
          outline: 8px solid rgba(239, 239, 239, 0.15);
          outline-offset: 4px;
          display: grid;
          place-items: center;
          box-shadow:
            0 14px 32px rgba(0, 0, 0, 0.55),
            inset 0 1px 0 rgba(255, 255, 255, 0.18),
            0 0 0 1px rgba(255, 255, 255, 0.06);
          margin: 16px auto;
        }
        .lp-hero__icon-inner {
          display: grid;
          place-items: center;
          width: 100%;
          height: 100%;
        }

        /* Layer 3: centered headline + CTAs */
        .lp-hero__inner {
          position: relative;
          z-index: 3;
          max-width: 1080px;
          margin: 0 auto;
          width: 100%;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: calc(100vh - 280px);
        }

        .lp-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 100px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #C8F23A;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.8rem;
          font-weight: 600;
          margin-bottom: 18px;
          backdrop-filter: blur(8px);
        }

        .lp-hero__title {
          font-family: 'Instrument Sans', sans-serif;
          font-size: clamp(2rem, 4.5vw, 3.6rem);
          font-weight: 500;
          line-height: 1.1;
          color: #ffffff;
          margin: 0 0 24px 0;
          letter-spacing: -0.04em;
          max-width: 20ch;
        }

        .lp-hero__mark {
          display: inline-block;
          background: #A78BFA;
          color: #ffffff;
          padding: 0.04em 0.28em;
          border-radius: 10px;
          white-space: nowrap;
          box-shadow: 0 10px 36px rgba(200, 242, 58, 0.32);
        }

        .lp-hero__subtitle {
          font-family: 'Instrument Sans', sans-serif;
          color: rgba(255, 255, 255, 0.65);
          font-size: 1rem;
          line-height: 1.55;
          max-width: 520px;
          margin: 0 auto 28px;
          text-align: center;
        }

        .lp-hero__accent {
          color: #C8F23A;
          font-weight: 600;
        }

        .lp-hero__ctas {
          display: flex;
          gap: 12px;
          align-items: center;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 16px;
        }

        /* Scoped button overrides inside the dark hero only */
        .lp-hero .lp-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 28px;
          border-radius: 100px;
          background: #A78BFA;
          color: #ffffff;
          font-family: 'Instrument Sans', sans-serif;
          font-weight: 700;
          font-size: 0.98rem;
          border: none;
          cursor: pointer;
          transition: transform 0.25s ease, box-shadow 0.25s ease, filter 0.25s ease;
          box-shadow: 0 12px 32px rgba(200, 242, 58, 0.30);
        }
        .lp-hero .lp-btn-primary:hover {
          transform: translateY(-2px);
          filter: brightness(1.08);
          box-shadow: 0 16px 40px rgba(232, 255, 110, 0.45);
        }

        .lp-hero .lp-btn-ghost {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 13px 24px;
          border-radius: 100px;
          background: rgba(255, 255, 255, 0.06);
          color: #ffffff;
          font-family: 'Instrument Sans', sans-serif;
          font-weight: 500;
          font-size: 0.98rem;
          border: 1px solid rgba(255, 255, 255, 0.2);
          cursor: pointer;
          transition: background 0.22s ease, border-color 0.22s ease;
          backdrop-filter: blur(8px);
        }
        .lp-hero .lp-btn-ghost:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: rgba(255, 255, 255, 0.32);
        }

        .lp-hero__badges {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          justify-content: center;
        }

        .lp-proof-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 100px;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.78rem;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.75);
          backdrop-filter: blur(8px);
        }
        .lp-proof-badge__icon {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: linear-gradient(135deg, #8A85F2, #A78BFA);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
        }

        /* Layer 4: shrunk phone tucked bottom-right */
        .lp-hero__phone-mini {
          position: absolute;
          right: 5%;
          bottom: 200px;
          width: 200px;
          height: 360px;
          border-radius: 26px;
          overflow: hidden;
          border: 2px solid rgba(255, 255, 255, 0.1);
          box-shadow:
            0 30px 70px rgba(0, 0, 0, 0.55),
            0 0 0 1px rgba(167, 139, 250, 0.15);
          z-index: 2;
          background: #111;
        }
        .lp-hero__phone-mini video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        /* Layer 5: bottom strip — counter + scrolling logos */
        .lp-hero__strip {
          position: relative;
          z-index: 3;
          display: flex;
          align-items: center;
          gap: 0;
          width: 100vw;
          max-width: 100vw;
          margin: 60px 0 0;
          margin-left: calc(50% - 50vw);
          margin-right: calc(50% - 50vw);
          padding: 24px 0 80px;
        }

        .lp-hero__strip-counter {
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          line-height: 1.2;
          font-family: 'Instrument Sans', sans-serif;
        }
        .lp-hero__strip-counter strong {
          font-size: 1.7rem;
          font-weight: 600;
          color: #ffffff;
          letter-spacing: -0.02em;
        }
        .lp-hero__strip-counter span {
          font-size: 0.85rem;
          color: rgba(255, 255, 255, 0.55);
          font-weight: 500;
        }

        /* Two-sided scrolling brand strip with center logo */
        .lp-hero__brands-side {
          flex: 1;
          overflow: hidden;
        }
        .lp-hero__brands-side--left {
          -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 15%, #000 100%);
                  mask-image: linear-gradient(90deg, transparent 0%, #000 15%, #000 100%);
        }
        .lp-hero__brands-side--right {
          -webkit-mask-image: linear-gradient(90deg, #000 0%, #000 85%, transparent 100%);
                  mask-image: linear-gradient(90deg, #000 0%, #000 85%, transparent 100%);
        }
        .lp-hero__brands-side .lp-brands__track {
          display: flex;
          gap: 28px;
          width: max-content;
          padding: 0 20px;
          align-items: center;
        }
        .lp-brands__track--left {
          animation: scrollBrandsRight 30s linear infinite;
        }
        .lp-brands__track--right {
          animation: scrollBrandsLeft 30s linear infinite;
        }
        .lp-hero__brands-side .lp-brand-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          font-family: 'Instrument Sans', sans-serif;
        }
        .lp-brand-item__icon {
          width: 96px;
          height: 96px;
          border-radius: 22px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 2.6rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.85);
          transition: all 0.3s ease;
        }
        .lp-brand-item__name {
          font-size: 0.78rem;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.55);
          white-space: nowrap;
          transition: color 0.3s ease;
        }
        .lp-brand-item:hover .lp-brand-item__icon {
          background: rgba(167, 139, 250, 0.15);
          border-color: rgba(167, 139, 250, 0.35);
        }
        .lp-brand-item:hover .lp-brand-item__name { color: #ffffff; }

        /* Center main logo — highlighted with glow */
        .lp-hero__brand-center {
          flex-shrink: 0;
          width: 190px;
          height: 190px;
          border-radius: 36px;
          background: #1f1f1f;
          border: 1px solid rgba(255, 255, 255, 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 0 2px rgba(167, 139, 250, 0.55),
                      0 0 35px rgba(167, 139, 250, 0.6),
                      0 0 160px rgba(167, 139, 250, 0.4);
          position: relative;
          z-index: 4;
        }
        .lp-hero__brand-center img {
          width: 150px;
          height: 150px;
          object-fit: contain;
        }

        /* Left track moves right→left (brands flow toward center from right) */
        /* Right track moves left→right (brands flow toward center from left, i.e. exiting right) */
        @keyframes scrollBrandsLeft {
          0% { transform: translateX(0); }
          100% { transform: translateX(-25%); }
        }
        @keyframes scrollBrandsRight {
          0% { transform: translateX(-25%); }
          100% { transform: translateX(0); }
        }

        /* Layer 6: curved divider into next light section */
        .lp-hero__divider {
          position: absolute;
          bottom: -1px;
          left: 0;
          width: 100%;
          height: 80px;
          z-index: 4;
          display: block;
        }

        /* ── The Problem section ──────────────────────────────────────────── */
        .lp-problem {
          padding: 100px 8% 60px;
          background: rgba(255, 255, 255, 0.06);
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
          background: rgba(255, 255, 255, 0.06);
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
          color: #A78BFA;
          background: none;
          -webkit-text-fill-color: #A78BFA;
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
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid var(--lp-border);
          border-radius: 24px;
          padding: 22px;
          display: flex;
          flex-direction: column;
          transition: box-shadow 0.3s ease, transform 0.3s ease;
        }
        .lp-pcard:hover {
          box-shadow: 0 18px 50px rgba(7, 7, 78, 0.10);
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
          background: rgba(255, 255, 255, 0.06);
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
          color: #A78BFA;
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
          color: rgba(255, 255, 255, 0.7);
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
          color: rgba(255, 255, 255, 0.6);
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
          background: rgba(255,255,255,0.06);
          border: 1px solid #FCA5A5;
          color: #FCA5A5;
          box-shadow: 0 4px 12px rgba(0,0,0,0.06);
          white-space: nowrap;
        }
        .lp-tag-pill--sm { font-size: 0.65rem; padding: 4px 8px; }
        .lp-tag-pill--pending { border-color: #FCD34D; color: #FCD34D; }
        .lp-tag-pill--reject { border-color: #FCA5A5; color: #FCA5A5; }
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
          background: linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05));
          color: var(--lp-purple-700);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 22px rgba(7, 7, 78,0.18);
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
          background: linear-gradient(90deg, #07074e, #07074e);
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
          background: transparent;
          color: #ffffff;
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
          color: #A78BFA;
          background: none;
          -webkit-text-fill-color: #A78BFA;
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
          background: rgba(255, 255, 255, 0.06);
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

        .lp-showcase__viewport {
          display: flex;
          flex-direction: column;
          gap: 44px;
          padding: 8px 0;
          width: 100vw;
          max-width: 100vw;
          margin-left: calc(50% - 50vw);
          margin-right: calc(50% - 50vw);
          overflow: hidden;
          -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 3%, #000 97%, transparent 100%);
                  mask-image: linear-gradient(90deg, transparent 0%, #000 3%, #000 97%, transparent 100%);
        }
        .lp-showcase__row {
          overflow: hidden;
        }
        .lp-showcase__track {
          display: flex;
          gap: 26px;
          width: max-content;
          padding: 0 8%;
          will-change: transform;
        }
        .lp-showcase__track--left {
          animation: showcaseScrollLeft 60s linear infinite;
        }
        .lp-showcase__track--right {
          animation: showcaseScrollRight 60s linear infinite;
        }
        .lp-showcase__viewport:hover .lp-showcase__track {
          animation-play-state: paused;
        }
        @keyframes showcaseScrollLeft {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        @keyframes showcaseScrollRight {
          0%   { transform: translateX(-33.333%); }
          100% { transform: translateX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .lp-showcase__track { animation: none; }
        }

        .lp-showcase-item {
          display: flex;
          flex-direction: column;
          gap: 14px;
          width: 300px;
          flex-shrink: 0;
        }

        .lp-showcase-card {
          position: relative;
          aspect-ratio: 9 / 11;
          border-radius: 18px;
          overflow: hidden;
          background: #111;
          box-shadow: 0 18px 40px rgba(0,0,0,0.12);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .lp-showcase-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 24px 52px rgba(7, 7, 78, 0.18);
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

        /* Meta footer below each card */
        .lp-showcase-meta {
          padding: 0 4px;
          text-align: left;
        }
        .lp-showcase-meta__row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 6px;
        }
        .lp-showcase-meta__info {
          min-width: 0;
          flex: 1;
        }
        .lp-showcase-meta__brand {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 1rem;
          font-weight: 600;
          color: var(--lp-ink);
          letter-spacing: -0.02em;
          line-height: 1.2;
        }
        .lp-showcase-meta__creator {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.85rem;
          color: var(--lp-text-muted);
          margin-top: 2px;
        }
        .lp-showcase-meta__logo {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          color: #ffffff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-family: 'Instrument Sans', sans-serif;
          font-weight: 700;
          font-size: 1rem;
          flex-shrink: 0;
          box-shadow: 0 4px 10px rgba(0,0,0,0.10);
        }
        .lp-showcase-meta__stars {
          display: flex;
          align-items: center;
          gap: 2px;
        }

        @media (max-width: 1024px) {
          .lp-showcase__grid { grid-auto-columns: minmax(240px, 280px); }
        }
        @media (max-width: 640px) {
          .lp-showcase { padding: 60px 5%; }
          .lp-showcase__grid { grid-template-columns: 1fr; }
          .lp-filter { padding: 8px 14px; font-size: 0.82rem; }
        }

        /* ── Comparison Table ─────────────────────────────────────────────── */
        .lp-compare {
          padding: 100px 8% 100px;
          background: transparent;
          color: #ffffff;
        }
        .lp-compare__inner {
          max-width: 1200px;
          margin: 0 auto;
          text-align: center;
        }
        .lp-compare__heading {
          font-family: 'Instrument Sans', sans-serif;
          font-size: clamp(2rem, 4.2vw, 3.4rem);
          font-weight: 500;
          color: var(--lp-ink);
          line-height: 1.2;
          letter-spacing: -0.04em;
          margin: 0 0 60px 0;
          max-width: 900px;
          margin-left: auto;
          margin-right: auto;
        }
        .lp-compare__heading--accent {
          color: #A78BFA;
          background: none;
          -webkit-text-fill-color: #A78BFA;
        }

        .lp-compare__table {
          background: rgba(255, 255, 255, 0.06);
          border-radius: 24px;
          border: 1px solid var(--lp-border);
          overflow: hidden;
          box-shadow: 0 12px 32px rgba(0,0,0,0.05);
          position: relative;
        }

        .lp-compare__row {
          display: grid;
          grid-template-columns: 1.4fr 1fr 1fr 1fr 1fr;
          align-items: stretch;
          border-top: 1px solid var(--lp-border);
        }
        .lp-compare__row:first-child {
          border-top: none;
        }
        .lp-compare__row--head .lp-compare__cell {
          padding: 22px 16px;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--lp-ink);
          letter-spacing: -0.01em;
        }
        .lp-compare__row--alt {
          background: rgba(7, 7, 78, 0.15);
        }

        .lp-compare__cell {
          padding: 22px 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.95rem;
          color: var(--lp-text);
          text-align: center;
        }

        .lp-compare__cell--label {
          justify-content: flex-start;
          text-align: left;
          padding-left: 28px;
          font-weight: 500;
          color: var(--lp-ink);
        }

        /* Highlight "us" column with light purple background + bordered tab */
        .lp-compare__cell--us {
          background: var(--lp-purple-50);
          border-left: 1.5px solid var(--lp-purple-300);
          border-right: 1.5px solid var(--lp-purple-300);
        }
        .lp-compare__row--head .lp-compare__cell--us {
          border-top: 1.5px solid var(--lp-purple-300);
          border-top-left-radius: 16px;
          border-top-right-radius: 16px;
        }
        .lp-compare__row:last-child .lp-compare__cell--us {
          border-bottom: 1.5px solid var(--lp-purple-300);
          border-bottom-left-radius: 16px;
          border-bottom-right-radius: 16px;
        }

        .lp-compare__logo {
          height: 32px;
          width: auto;
        }

        /* Check icons */
        .lp-compare__check {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: var(--lp-text);
        }
        .lp-compare__check--filled {
          background: var(--lp-purple-600);
          color: #ffffff;
          box-shadow: 0 4px 12px rgba(7, 7, 78, 0.32);
        }

        .lp-compare__x {
          color: var(--lp-text-soft);
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .lp-compare__text {
          color: var(--lp-text);
          font-weight: 500;
          white-space: pre-line;
        }

        @media (max-width: 900px) {
          .lp-compare { padding: 60px 4%; }
          .lp-compare__row {
            grid-template-columns: 1.2fr 0.8fr 0.8fr 0.8fr 0.8fr;
          }
          .lp-compare__cell { padding: 14px 8px; font-size: 0.78rem; }
          .lp-compare__cell--label { padding-left: 14px; }
          .lp-compare__row--head .lp-compare__cell { font-size: 0.82rem; }
          .lp-compare__check { width: 28px; height: 28px; }
          .lp-compare__logo { height: 22px; }
        }
        @media (max-width: 640px) {
          .lp-compare__heading { font-size: 1.6rem; margin-bottom: 30px; }
          .lp-compare__cell { font-size: 0.7rem; padding: 10px 6px; }
        }

        /* ── Features ─────────────────────────────────────────────────────── */
        .lp-features {
          padding: 60px 8% 120px;
          background: transparent;
          color: #ffffff;
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
          background: rgba(255, 255, 255, 0.06);
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
          box-shadow: 0 16px 40px var(--card-glow, rgba(7, 7, 78,0.18));
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
          padding: 70px 8% 100px;
          background: transparent;
          color: #ffffff;
          overflow: hidden;
          text-align: center;
        }
        .lp-cta::before,
        .lp-cta::after {
          content: '';
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          filter: blur(110px);
        }
        .lp-cta::before {
          width: 500px; height: 500px;
          background: rgba(7, 7, 78, 0.30);
          top: -180px; left: -120px;
        }
        .lp-cta::after {
          width: 420px; height: 420px;
          background: rgba(7, 7, 78, 0.22);
          bottom: -160px; right: -120px;
        }

        .lp-cta__inner {
          position: relative;
          z-index: 1;
          max-width: 820px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .lp-root .lp-cta__pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 18px;
          background: rgba(255,255,255,0.85);
          backdrop-filter: blur(8px);
          border: 1px solid var(--lp-purple-200);
          border-radius: 100px;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.82rem;
          font-weight: 600;
          color: #07074e;
          margin-bottom: 28px;
          box-shadow: 0 4px 16px rgba(7, 7, 78,0.10);
        }
        .lp-cta__pulse {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(167, 139, 250, 0.15);
          box-shadow: 0 0 0 0 rgba(7, 7, 78, 0.55);
          animation: hookPulse 1.8s ease-out infinite;
          flex-shrink: 0;
        }

        .lp-cta__heading {
          font-family: 'Instrument Sans', sans-serif;
          font-size: clamp(2.6rem, 5.2vw, 4.4rem);
          font-weight: 500;
          color: var(--lp-ink);
          margin: 0 0 18px 0;
          line-height: 1.05;
          letter-spacing: -0.05em;
        }
        .lp-cta__heading--strike {
          position: relative;
          color: var(--lp-text-muted);
          font-style: italic;
        }
        .lp-cta__heading--strike::after {
          content: '';
          position: absolute;
          top: 55%;
          left: -4%;
          right: -4%;
          height: 4px;
          background: rgba(167, 139, 250, 0.15);
          transform: rotate(-3deg);
          border-radius: 4px;
        }
        .lp-cta__heading--accent {
          color: #A78BFA;
          font-style: italic;
          position: relative;
          padding: 0 4px;
        }
        .lp-cta__heading--accent::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          width: 100%;
          height: 8px;
          background: linear-gradient(90deg, #8888A0, #07074e);
          border-radius: 4px;
          opacity: 0.55;
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
          color: #A78BFA;
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

        .lp-cta__subtext {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 1.1rem;
          color: var(--lp-text);
          line-height: 1.5;
          letter-spacing: -0.015em;
          margin: 0 0 42px 0;
          max-width: 540px;
        }

        .lp-cta__btn-row {
          display: flex;
          gap: 14px;
          align-items: center;
          flex-wrap: wrap;
          justify-content: center;
          margin-bottom: 22px;
        }

        .lp-btn-join {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 16px 38px;
          border-radius: 100px;
          background: var(--lp-ink);
          color: white;
          font-family: 'Instrument Sans', sans-serif;
          font-weight: 600;
          font-size: 1.05rem;
          border: none;
          cursor: pointer;
          transition: all 0.25s ease;
          box-shadow: 0 12px 32px rgba(7, 7, 78, 0.32);
        }
        .lp-btn-join:hover {
          transform: translateY(-3px);
          background: rgba(167, 139, 250, 0.15);
          box-shadow: 0 18px 46px rgba(7, 7, 78, 0.48);
        }

        .lp-root .lp-btn-outline {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 15px 32px;
          border-radius: 100px;
          background: rgba(255,255,255,0.8);
          backdrop-filter: blur(6px);
          color: #07074e;
          font-family: 'Instrument Sans', sans-serif;
          font-weight: 600;
          font-size: 1rem;
          border: 1px solid var(--lp-border);
          cursor: pointer;
          transition: all 0.22s ease;
        }
        .lp-btn-outline:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: #A78BFA;
          color: #A78BFA;
        }

        .lp-cta__proof {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: 'Instrument Sans', sans-serif;
          color: var(--lp-text-muted);
          font-size: 0.9rem;
          margin: 0 0 56px 0;
        }
        .lp-cta__dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22C55E;
          box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.15);
          display: inline-block;
        }

        .lp-cta__signals {
          display: inline-flex;
          align-items: center;
          gap: 28px;
          padding: 20px 32px;
          background: rgba(255,255,255,0.7);
          backdrop-filter: blur(12px);
          border: 1px solid var(--lp-border);
          border-radius: 18px;
          box-shadow: 0 10px 30px rgba(7,7,78,0.08);
        }
        .lp-cta__signal {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .lp-root .lp-cta__signal-num {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 1.4rem;
          font-weight: 600;
          color: #07074e;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .lp-root .lp-cta__signal-label {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.78rem;
          color: #07074e;
          letter-spacing: -0.01em;
        }
        .lp-cta__signal-divider {
          width: 1px;
          height: 38px;
          background: var(--lp-border);
        }

        @media (max-width: 640px) {
          .lp-cta { padding: 90px 5%; }
          .lp-cta__signals { flex-direction: column; gap: 16px; padding: 20px 24px; }
          .lp-cta__signal-divider { width: 38px; height: 1px; }
          .lp-cta__btn-row { flex-direction: column; width: 100%; }
          .lp-btn-join, .lp-btn-outline { width: 100%; justify-content: center; }
        }

        /* ── Responsive ───────────────────────────────────────────────────── */
        @media (max-width: 1024px) {
          .lp-hero { padding: 130px 5% 0; }
          .lp-hero__icon { width: 52px; height: 52px; border-radius: 18px; }
          .lp-hero__icon-inner svg { width: 22px; height: 22px; }
          .lp-hero__phone-mini { display: none; }
          .lp-hero__strip {
            flex-direction: column;
            align-items: flex-start;
            gap: 20px;
            margin-top: 60px;
            padding-bottom: 110px;
          }
          .lp-hero__strip-logos { width: 100%; }
        }

        @media (max-width: 768px) {
          .lp-hero { padding: 120px 5% 0; min-height: auto; }
          .lp-hero__connectors { display: none; }
          .lp-hero__title { max-width: 100%; }
          .lp-navbar { padding: 0 4%; }
          .lp-navbar__inner { padding: 10px 14px; }
          .lp-btn-signin, .lp-btn-dark { padding: 8px 16px; font-size: 0.85rem; }
          .lp-hero__ctas { flex-direction: column; align-items: stretch; width: 100%; }
          .lp-hero .lp-btn-primary, .lp-hero .lp-btn-ghost { justify-content: center; }
          .lp-hero__badges { gap: 6px; }
          .lp-proof-badge { font-size: 0.7rem; padding: 5px 10px; }
          .lp-hero__strip-counter strong { font-size: 1.4rem; }
        }

        @media (max-width: 480px) {
          .lp-hero__divider { height: 50px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .lp-hero__connectors path { stroke-dasharray: 6 8 !important; opacity: 0.45; }
          .lp-hero__icon { animation: none !important; }
          .lp-hero__icon-inner { animation: none !important; }
          .lp-hero__strip-logos .lp-brands__track { animation: none !important; }
        }

        /* ── Footer ─────────────────────────────────────────────────────────── */
        .lp-footer {
          position: relative;
          background: transparent;
          color: var(--lp-ink);
          padding: 90px 8% 30px;
          overflow: hidden;
          border-top: 1px solid var(--lp-border);
        }
        .lp-footer__glow {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          filter: blur(140px);
          width: 520px;
          height: 520px;
          background: rgba(154, 154, 191, 0.32);
          top: -200px;
          left: -120px;
        }
        .lp-footer__glow--2 {
          background: rgba(7, 7, 78, 0.18);
          width: 420px;
          height: 420px;
          top: auto;
          left: auto;
          bottom: -180px;
          right: -80px;
        }
        .lp-footer__inner {
          position: relative;
          z-index: 2;
          max-width: 1300px;
          margin: 0 auto;
        }

        /* Manifesto statement at top */
        .lp-footer__statement {
          padding-bottom: 56px;
          margin-bottom: 56px;
          border-bottom: 1px solid var(--lp-border);
          text-align: center;
        }
        .lp-footer__statement-eyebrow {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.78rem;
          font-weight: 500;
          color: var(--lp-text-muted);
          letter-spacing: 0.16em;
          text-transform: uppercase;
          font-style: italic;
          margin: 0 0 16px 0;
        }
        .lp-footer__statement-line {
          font-family: 'Instrument Sans', sans-serif;
          font-size: clamp(1.4rem, 3vw, 2.2rem);
          font-weight: 500;
          color: var(--lp-ink);
          line-height: 1.3;
          letter-spacing: -0.03em;
          margin: 0 auto;
          max-width: 820px;
        }
        .lp-footer__statement-accent {
          color: #A78BFA;
          font-style: italic;
          position: relative;
        }
        .lp-footer__statement-accent::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          width: 100%;
          height: 5px;
          background: linear-gradient(90deg, #8888A0, #07074e);
          border-radius: 4px;
          opacity: 0.55;
        }

        .lp-footer__main {
          display: grid;
          grid-template-columns: 1.2fr 2fr;
          gap: 60px;
          padding-bottom: 50px;
          margin-bottom: 24px;
          border-bottom: 1px solid var(--lp-border);
        }

        .lp-footer__brand {
          max-width: 340px;
        }
        .lp-footer__logo-wrap {
          display: inline-flex;
          margin-bottom: 18px;
        }
        .lp-footer__logo {
          height: 80px;
          width: auto;
          display: block;
        }
        .lp-footer__tagline {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.95rem;
          color: var(--lp-text-muted);
          line-height: 1.5;
          letter-spacing: -0.015em;
          margin: 0 0 24px 0;
          max-width: 280px;
        }
        .lp-footer__socials {
          display: flex;
          gap: 8px;
        }
        .lp-footer__social-btn {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid var(--lp-border);
          color: var(--lp-text-muted);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all 0.22s ease;
          text-decoration: none;
        }
        .lp-footer__social-btn:hover {
          background: rgba(167, 139, 250, 0.15);
          color: #ffffff;
          border-color: #A78BFA;
          transform: translateY(-2px);
        }

        .lp-footer__links {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 40px;
        }

        .lp-footer__top {
          display: grid;
          grid-template-columns: 1.4fr 1fr 1fr 1.3fr 1fr;
          gap: 36px;
          padding-bottom: 50px;
          border-bottom: 1px solid var(--lp-border);
        }
        .lp-footer__bottom {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 36px;
          padding: 20px 0 40px;
          border-bottom: 1px solid var(--lp-border);
        }

        .lp-footer__brand-col {
          padding-right: 12px;
        }

        .lp-footer__tagline {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.92rem;
          color: var(--lp-text);
          line-height: 1.5;
          margin: 0 0 22px 0;
          max-width: 320px;
        }

        .lp-footer__form {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-width: 340px;
        }
        .lp-footer__label {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.85rem;
          color: var(--lp-text);
          font-weight: 500;
          margin-top: 4px;
        }
        .lp-footer__required { color: #A78BFA; }

        .lp-footer__input {
          padding: 12px 14px;
          border: 1px solid var(--lp-border);
          border-radius: 10px;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.92rem;
          background: rgba(255, 255, 255, 0.06);
          color: var(--lp-text);
          width: 100%;
        }
        .lp-footer__input:focus {
          outline: none;
          border-color: #A78BFA;
          box-shadow: 0 0 0 3px rgba(7,7,78,0.12);
        }

        .lp-footer__subscribe {
          margin-top: 12px;
          padding: 14px 22px;
          background: var(--lp-ink);
          color: #ffffff;
          border: none;
          border-radius: 100px;
          font-family: 'Instrument Sans', sans-serif;
          font-weight: 600;
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 0.22s ease;
        }
        .lp-footer__subscribe:hover {
          background: rgba(167, 139, 250, 0.15);
          transform: translateY(-1px);
        }

        .lp-footer__privacy {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.78rem;
          color: var(--lp-text-muted);
          line-height: 1.5;
          margin: 14px 0 0 0;
          max-width: 340px;
        }
        .lp-footer__link-accent {
          color: #A78BFA;
          text-decoration: underline;
          font-weight: 500;
        }
        .lp-footer__link-accent:hover { opacity: 0.7; }

        .lp-footer__col { min-width: 0; }

        .lp-footer__heading {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--lp-text-muted);
          margin: 0 0 16px 0;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .lp-footer__list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .lp-footer__list li {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.92rem;
          line-height: 1.4;
        }
        .lp-footer__list a {
          color: var(--lp-text);
          text-decoration: none;
          transition: color 0.18s ease;
          letter-spacing: -0.01em;
          font-weight: 500;
        }
        .lp-footer__list a:hover { color: #A78BFA; }

        .lp-footer__badge {
          display: inline-block;
          padding: 2px 10px;
          background: linear-gradient(135deg, #BBBBC8, #8888A0);
          color: #A78BFA;
          border-radius: 100px;
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.01em;
          vertical-align: middle;
          margin-left: 4px;
        }

        .lp-footer__social {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .lp-footer__social a {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          color: var(--lp-text);
          text-decoration: none;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.9rem;
          font-weight: 500;
          transition: color 0.18s ease;
        }
        .lp-footer__social a:hover { color: #A78BFA; }
        .lp-footer__social svg { color: var(--lp-text-muted); }

        .lp-footer__contact {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.85rem;
          color: var(--lp-text);
          line-height: 1.6;
          margin: 0 0 14px 0;
        }

        .lp-footer__strip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          flex-wrap: wrap;
          padding-top: 24px;
        }
        .lp-footer__copyright {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.85rem;
          color: var(--lp-text-muted);
          letter-spacing: -0.01em;
        }
        .lp-footer__location {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.85rem;
          color: var(--lp-text-muted);
          font-style: italic;
          letter-spacing: -0.01em;
        }
        .lp-footer__loc-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #22C55E;
          box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.15);
        }
        .lp-footer__top-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid var(--lp-border);
          border-radius: 100px;
          color: var(--lp-text);
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.82rem;
          font-weight: 500;
          letter-spacing: -0.01em;
          text-decoration: none;
          transition: all 0.22s ease;
        }
        .lp-footer__top-link:hover {
          background: rgba(167, 139, 250, 0.15);
          color: #ffffff;
          border-color: #A78BFA;
        }

        @media (max-width: 1100px) {
          .lp-footer__top { grid-template-columns: 1fr 1fr 1fr; gap: 32px; }
          .lp-footer__brand-col { grid-column: span 3; }
        }
        @media (max-width: 880px) {
          .lp-footer { padding: 70px 6% 24px; }
          .lp-footer__main { grid-template-columns: 1fr; gap: 40px; }
          .lp-footer__links { grid-template-columns: repeat(3, 1fr); gap: 20px; }
        }
        @media (max-width: 600px) {
          .lp-footer__statement { padding-bottom: 36px; margin-bottom: 36px; }
          .lp-footer__links { grid-template-columns: 1fr 1fr; gap: 24px; }
          .lp-footer__strip { justify-content: center; text-align: center; }
        }

        /* ── Section connectors ─────────────────────────────────────────── */
        .lp-connector {
          position: relative;
          width: 100%;
          pointer-events: none;
          overflow: visible;
          background: transparent;
        }
        .lp-connector svg { display: block; }
        .lp-connector svg path {
          animation: connectorFlow 1.2s linear infinite;
        }
        @keyframes connectorFlow {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: -12; }
        }
        @media (max-width: 1024px) {
          .lp-connector { display: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .lp-connector svg path { animation: none; }
        }

        /* ── Scroll Hook ─────────────────────────────────────────────────── */
        .lp-hook {
          position: relative;
          padding: 120px 8% 110px;
          background: transparent;
          color: #ffffff;
          text-align: center;
          overflow: hidden;
        }
        .lp-hook__bg-orb,
        .lp-audit__bg-orb,
        .lp-testimonial__bg-orb {
          display: none;
        }
        .lp-hook__bg-orb--legacy {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          filter: blur(80px);
        }
        .lp-hook__bg-orb--1 {
          width: 380px; height: 380px;
          background: rgba(154, 154, 191, 0.35);
          top: -120px; left: -100px;
        }
        .lp-hook__bg-orb--2 {
          width: 320px; height: 320px;
          background: rgba(7, 7, 78, 0.20);
          bottom: -100px; right: -80px;
        }
        .lp-hook__inner {
          position: relative;
          z-index: 2;
          max-width: 1100px;
          margin: 0 auto;
        }

        .lp-hook__pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 7px 16px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid var(--lp-purple-200);
          border-radius: 100px;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.82rem;
          font-weight: 600;
          color: #A78BFA;
          letter-spacing: 0.01em;
          margin-bottom: 26px;
          box-shadow: 0 4px 14px rgba(7, 7, 78, 0.10);
        }
        .lp-hook__pulse {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(167, 139, 250, 0.15);
          box-shadow: 0 0 0 0 rgba(7, 7, 78, 0.55);
          animation: hookPulse 1.8s ease-out infinite;
          flex-shrink: 0;
        }
        @keyframes hookPulse {
          0%   { box-shadow: 0 0 0 0 rgba(7, 7, 78, 0.55); }
          70%  { box-shadow: 0 0 0 10px rgba(7, 7, 78, 0); }
          100% { box-shadow: 0 0 0 0 rgba(7, 7, 78, 0); }
        }

        .lp-hook__heading {
          font-family: 'Instrument Sans', sans-serif;
          font-size: clamp(1.6rem, 3vw, 2.6rem);
          font-weight: 500;
          color: var(--lp-ink);
          line-height: 1.15;
          letter-spacing: -0.04em;
          margin: 0 0 40px 0;
          white-space: nowrap;
        }
        @media (max-width: 780px) {
          .lp-hook__heading {
            white-space: normal;
            font-size: clamp(1.4rem, 5vw, 2rem);
          }
        }
        .lp-hook__heading--accent {
          color: #A78BFA;
        }

        .lp-hook__quote-wrap {
          display: flex;
          justify-content: center;
          margin-bottom: 40px;
        }
        .lp-hook__quote-card {
          position: relative;
          max-width: 640px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid var(--lp-border);
          border-radius: 22px;
          padding: 38px 40px 32px;
          box-shadow: 0 22px 56px rgba(7, 7, 78, 0.08);
          text-align: left;
        }
        .lp-hook__quote-card::before {
          content: '';
          position: absolute;
          top: 0; bottom: 0; left: 0;
          width: 4px;
          background: linear-gradient(180deg, #07074e 0%, #07074e 100%);
          border-top-left-radius: 22px;
          border-bottom-left-radius: 22px;
        }
        .lp-hook__quote-mark {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 4rem;
          line-height: 0.6;
          color: var(--lp-purple-300);
          display: block;
          margin-bottom: 4px;
        }
        .lp-hook__quote-text {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 1.15rem;
          color: var(--lp-text);
          line-height: 1.55;
          letter-spacing: -0.015em;
          margin: 0;
        }
        .lp-hook__quote-text em {
          color: #A78BFA;
          font-weight: 600;
          font-style: italic;
        }

        .lp-hook__cta-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          max-width: 540px;
          margin: 0 auto;
        }
        .lp-hook__cta-line {
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--lp-border), transparent);
        }
        .lp-hook__tag {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 1.05rem;
          font-weight: 600;
          color: #A78BFA;
          margin: 0;
          letter-spacing: -0.02em;
          white-space: nowrap;
        }

        /* ── How It Works (3 Steps) ──────────────────────────────────────── */
        .lp-steps {
          padding: 100px 8% 120px;
          background: transparent;
          color: #ffffff;
          position: relative;
        }
        .lp-steps__inner {
          max-width: 1200px;
          margin: 0 auto;
          text-align: center;
        }
        .lp-steps__eyebrow {
          display: inline-block;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.18em;
          color: #A78BFA;
          text-transform: uppercase;
          padding: 6px 16px;
          background: var(--lp-purple-50);
          border: 1px solid var(--lp-purple-200);
          border-radius: 100px;
          margin-bottom: 20px;
        }
        .lp-steps__heading {
          font-family: 'Instrument Sans', sans-serif;
          font-size: clamp(2rem, 4.2vw, 3.4rem);
          font-weight: 500;
          color: var(--lp-ink);
          letter-spacing: -0.04em;
          line-height: 1.15;
          margin: 0 0 16px 0;
        }
        .lp-steps__subtitle {
          font-family: 'Instrument Sans', sans-serif;
          color: var(--lp-text-muted);
          font-size: 1.05rem;
          line-height: 1.5;
          letter-spacing: -0.015em;
          margin: 0 auto 64px;
          max-width: 580px;
        }
        .lp-steps__grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 22px;
          text-align: left;
        }

        .lp-step-card {
          position: relative;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid var(--lp-border);
          border-radius: 24px;
          padding: 32px 28px 28px;
          transition: box-shadow 0.3s ease, transform 0.3s ease, border-color 0.3s ease;
          overflow: visible;
          display: flex;
          flex-direction: column;
          min-height: 320px;
        }
        .lp-step-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, #8888A0, #07074e, #07074e);
          border-radius: 24px 24px 0 0;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .lp-step-card:hover {
          box-shadow: 0 22px 60px rgba(7, 7, 78, 0.12);
          transform: translateY(-6px);
          border-color: var(--lp-purple-200);
        }
        .lp-step-card:hover::before { opacity: 1; }

        .lp-step-card__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 22px;
        }
        .lp-step-card__num {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.82rem;
          font-weight: 700;
          color: #A78BFA;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 5px 12px;
          background: var(--lp-purple-50);
          border-radius: 100px;
        }
        .lp-step-card__tag {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--lp-text-muted);
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }

        .lp-step-card__icon {
          width: 54px;
          height: 54px;
          border-radius: 16px;
          background: linear-gradient(135deg, #07074e 0%, #050538 100%);
          color: #ffffff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 8px 22px rgba(7, 7, 78, 0.22);
          margin-bottom: 22px;
          transition: transform 0.3s ease;
        }
        .lp-step-card:hover .lp-step-card__icon {
          transform: scale(1.08) rotate(-3deg);
        }

        .lp-step-card__title {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 1.3rem;
          font-weight: 600;
          color: var(--lp-ink);
          margin: 0 0 12px 0;
          letter-spacing: -0.02em;
          line-height: 1.25;
        }
        .lp-step-card__desc {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.95rem;
          color: var(--lp-text-muted);
          line-height: 1.6;
          letter-spacing: -0.01em;
          margin: 0 0 24px 0;
          flex: 1;
        }

        .lp-step-card__footer {
          margin-top: auto;
          padding-top: 16px;
          border-top: 1px solid var(--lp-border);
          display: flex;
          align-items: center;
          justify-content: flex-end;
        }
        .lp-step-card__arrow {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255,255,255,0.06);
          color: #A78BFA;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: background 0.3s ease, transform 0.3s ease;
        }
        .lp-step-card:hover .lp-step-card__arrow {
          background: rgba(167, 139, 250, 0.15);
          color: #ffffff;
          transform: translateX(4px);
        }

        /* Connector chevron between cards (decorative, only visible at desktop) */
        .lp-step-card__connector {
          position: absolute;
          top: 50%;
          right: -22px;
          transform: translateY(-50%);
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.06);
          color: var(--lp-purple-300);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 14px rgba(0,0,0,0.06);
          z-index: 2;
        }

        /* ── Psychological Audit ─────────────────────────────────────────── */
        .lp-audit {
          position: relative;
          padding: 120px 8%;
          background: transparent;
          color: #ffffff;
          overflow: visible;
          min-height: 280vh;
        }
        .lp-audit__bg-orb {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          filter: blur(90px);
        }
        .lp-audit__bg-orb--1 {
          width: 340px; height: 340px;
          background: rgba(154, 154, 191, 0.30);
          top: -80px; right: -80px;
        }
        .lp-audit__bg-orb--2 {
          width: 280px; height: 280px;
          background: rgba(7, 7, 78, 0.18);
          bottom: -60px; left: -40px;
        }
        .lp-audit__inner {
          position: sticky;
          top: 80px;
          z-index: 2;
          max-width: 1200px;
          margin: 0 auto;
          text-align: center;
        }

        .lp-audit__pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 16px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid var(--lp-purple-200);
          border-radius: 100px;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.82rem;
          font-weight: 600;
          color: #A78BFA;
          margin-bottom: 22px;
          box-shadow: 0 4px 14px rgba(7, 7, 78, 0.08);
        }
        .lp-audit__pill svg { color: #A78BFA; }

        .lp-audit__heading {
          font-family: 'Instrument Sans', sans-serif;
          font-size: clamp(2rem, 4.2vw, 3.4rem);
          font-weight: 500;
          color: var(--lp-ink);
          letter-spacing: -0.04em;
          line-height: 1.15;
          margin: 0 0 14px 0;
        }
        .lp-audit__heading--accent {
          color: #A78BFA;
          font-style: italic;
          position: relative;
        }
        .lp-audit__heading--accent::after {
          content: '';
          position: absolute;
          bottom: -4px;
          left: 0;
          width: 100%;
          height: 6px;
          background: linear-gradient(90deg, #8888A0, #07074e);
          border-radius: 4px;
          opacity: 0.55;
        }
        .lp-audit__subtitle {
          font-family: 'Instrument Sans', sans-serif;
          color: var(--lp-text-muted);
          font-size: 1.05rem;
          line-height: 1.5;
          letter-spacing: -0.015em;
          margin: 0 auto 60px;
          max-width: 580px;
        }

        .lp-audit__grid {
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 440px;
          margin: 60px auto;
          max-width: 600px;
          text-align: left;
          perspective: 1200px;
        }
        .lp-audit-card {
          position: absolute;
          width: 100%;
          max-width: 380px;
          background: #A78BFA;
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 22px;
          padding: 36px 30px 26px;
          min-height: 280px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 12px 40px rgba(7, 7, 78, 0.4);
          overflow: hidden;
          transform-origin: center center;
        }
        .lp-audit-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, #8888A0, #07074e);
          opacity: 0;
          transition: opacity 0.3s ease;
          border-radius: 22px 22px 0 0;
        }
        .lp-audit-card__corner {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 22px;
        }
        .lp-root .lp-audit-card__qnum {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.78rem;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: 0.1em;
          padding: 5px 12px;
          background: #A78BFA;
          border: 1px solid rgba(255, 255, 255, 0.6);
          border-radius: 100px;
        }
        .lp-root .lp-audit-card__qmark {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 3rem;
          font-weight: 700;
          color: #07074e;
          line-height: 0.5;
          font-style: italic;
        }

        .lp-audit-card__body {
          position: relative;
          z-index: 1;
          flex: 1;
          margin-bottom: 20px;
        }
        .lp-root .lp-audit-card__title {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 1.35rem;
          font-weight: 500;
          color: #07074e;
          line-height: 1.4;
          letter-spacing: -0.015em;
          margin: 0 0 10px 0;
        }
        .lp-root .lp-audit-card__sub {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 1.65rem;
          font-weight: 600;
          color: #07074e;
          letter-spacing: -0.025em;
          line-height: 1.3;
          margin: 0;
        }

        .lp-audit-card__divider {
          position: relative;
          z-index: 1;
          height: 1px;
          background: rgba(7, 7, 78, 0.25);
          margin-bottom: 12px;
        }
        .lp-root .lp-audit-card__hint {
          position: relative;
          z-index: 1;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.95rem;
          color: rgba(7, 7, 78, 0.75);
          font-style: italic;
          letter-spacing: 0.02em;
        }

        .lp-audit__footer-card {
          display: inline-flex;
          align-items: center;
          gap: 16px;
          padding: 18px 28px 18px 18px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid var(--lp-purple-200);
          border-radius: 100px;
          box-shadow: 0 10px 30px rgba(7, 7, 78, 0.08);
          max-width: 100%;
        }
        .lp-audit__footer-icon {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #07074e, #050538);
          color: #ffffff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .lp-audit__footer-text {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 1rem;
          font-weight: 600;
          color: var(--lp-ink);
          letter-spacing: -0.015em;
          margin: 0;
          text-align: left;
        }

        /* ── Value Proof (Editorial Big Numbers) ─────────────────────────── */
        .lp-proof {
          padding: 120px 8% 60px;
          background: transparent;
          color: #ffffff;
        }
        .lp-proof__inner {
          max-width: 1200px;
          margin: 0 auto;
        }

        .lp-proof__header {
          text-align: center;
          margin-bottom: 28px;
        }
        .lp-proof__eyebrow {
          display: block;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.78rem;
          font-weight: 500;
          color: var(--lp-text-muted);
          letter-spacing: 0.16em;
          text-transform: uppercase;
          font-style: italic;
          margin-bottom: 18px;
        }
        .lp-proof__heading {
          font-family: 'Instrument Sans', sans-serif;
          font-size: clamp(2rem, 4.2vw, 3.4rem);
          font-weight: 500;
          color: var(--lp-ink);
          letter-spacing: -0.04em;
          line-height: 1.1;
          margin: 0;
          text-align: center;
        }

        .lp-proof__divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--lp-border), transparent);
          margin: 0 auto 70px;
          max-width: 600px;
        }

        .lp-proof__row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          align-items: center;
          gap: 0;
          margin-bottom: 60px;
        }
        .lp-proof__row > .lp-proof-num {
          padding: 8px 24px;
          position: relative;
        }
        .lp-proof__row > .lp-proof-num:not(:last-child)::after {
          content: '';
          position: absolute;
          top: 12%;
          right: 0;
          width: 1px;
          height: 76%;
          background: var(--lp-border);
        }

        .lp-proof-num {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 16px;
        }
        .lp-proof-num__index {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--lp-text-soft);
          letter-spacing: 0.24em;
        }
        .lp-proof-num__value {
          font-family: 'Instrument Sans', sans-serif;
          font-size: clamp(2.6rem, 5.2vw, 4.4rem);
          font-weight: 500;
          color: #A78BFA;
          letter-spacing: -0.045em;
          line-height: 1;
          display: inline-block;
          min-width: 0;
        }
        .lp-proof-num__label {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.95rem;
          font-weight: 500;
          color: var(--lp-text);
          letter-spacing: -0.01em;
          line-height: 1.3;
        }

        .lp-proof__micro {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 1rem;
          color: var(--lp-text-muted);
          font-style: italic;
          margin: 0;
          text-align: center;
          letter-spacing: 0.02em;
        }

        /* ── Testimonial ─────────────────────────────────────────────────── */
        .lp-testimonial {
          position: relative;
          padding: 60px 8% 60px;
          background: transparent;
          color: #ffffff;
          overflow: hidden;
        }
        .lp-testimonial__bg-orb {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          filter: blur(110px);
        }
        .lp-testimonial__bg-orb--1 {
          width: 360px; height: 360px;
          background: rgba(154, 154, 191, 0.30);
          top: -100px; left: -80px;
        }
        .lp-testimonial__bg-orb--2 {
          width: 300px; height: 300px;
          background: rgba(7, 7, 78, 0.18);
          bottom: -80px; right: -60px;
        }

        .lp-testimonial__inner {
          position: relative;
          z-index: 2;
          max-width: 900px;
          margin: 0 auto;
          text-align: center;
        }

        .lp-testimonial__pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 16px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid var(--lp-purple-200);
          border-radius: 100px;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.82rem;
          font-weight: 600;
          color: #A78BFA;
          margin-bottom: 22px;
          box-shadow: 0 4px 14px rgba(7, 7, 78, 0.08);
        }

        .lp-testimonial__heading {
          font-family: 'Instrument Sans', sans-serif;
          font-size: clamp(2rem, 4.2vw, 3.2rem);
          font-weight: 500;
          color: var(--lp-ink);
          letter-spacing: -0.04em;
          line-height: 1.15;
          margin: 0 0 56px 0;
        }
        .lp-testimonial__heading--accent {
          color: #A78BFA;
          font-style: italic;
          position: relative;
        }
        .lp-testimonial__heading--accent::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          width: 100%;
          height: 6px;
          background: linear-gradient(90deg, #8888A0, #07074e);
          border-radius: 4px;
          opacity: 0.55;
        }

        .lp-testimonial__subtitle {
          font-family: 'Instrument Sans', sans-serif;
          color: var(--lp-text-muted);
          font-size: 1.05rem;
          line-height: 1.5;
          letter-spacing: -0.015em;
          margin: -28px auto 56px;
          max-width: 600px;
        }

        .lp-testimonial__grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 22px;
          margin-bottom: 56px;
          text-align: left;
        }

        .lp-tcard {
          position: relative;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid var(--lp-border);
          border-radius: 22px;
          padding: 28px 26px 24px;
          box-shadow: 0 12px 30px rgba(7, 7, 78, 0.06);
          display: flex;
          flex-direction: column;
          transition: transform 0.3s ease, box-shadow 0.3s ease;
          overflow: hidden;
        }
        .lp-tcard::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, #8888A0, #07074e);
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .lp-tcard:hover {
          transform: translateY(-6px);
          box-shadow: 0 24px 56px rgba(7, 7, 78, 0.14);
        }
        .lp-tcard:hover::before { opacity: 1; }

        .lp-tcard--featured {
          background: linear-gradient(180deg, rgba(7,7,78,0.2) 0%, rgba(7,7,78,0.1) 100%);
          border-color: var(--lp-border);
          box-shadow: 0 20px 50px rgba(7, 7, 78, 0.12);
        }
        .lp-tcard--featured::before { opacity: 1; }

        .lp-tcard__rating {
          display: flex;
          gap: 2px;
          margin-bottom: 14px;
        }
        .lp-tcard__mark {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 3.4rem;
          line-height: 0.5;
          color: var(--lp-purple-300);
          display: block;
          margin-bottom: 4px;
        }
        .lp-tcard__quote {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 1.1rem;
          font-weight: 500;
          color: var(--lp-ink);
          line-height: 1.45;
          letter-spacing: -0.015em;
          margin: 0 0 22px 0;
          flex: 1;
        }
        .lp-tcard--featured .lp-tcard__quote {
          font-size: 1.18rem;
        }
        .lp-tcard__quote em {
          color: #A78BFA;
          font-weight: 600;
          font-style: italic;
        }

        .lp-tcard__author {
          display: flex;
          align-items: center;
          gap: 12px;
          padding-top: 18px;
          border-top: 1px solid var(--lp-border);
          margin-bottom: 14px;
        }
        .lp-tcard__photo {
          position: relative;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          overflow: hidden;
          flex-shrink: 0;
          background: linear-gradient(135deg, #07074e, #050538);
          box-shadow: 0 4px 14px rgba(7, 7, 78, 0.20);
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .lp-tcard__photo img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: 2;
        }
        .lp-tcard__initials {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.85rem;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: -0.01em;
          z-index: 1;
        }
        .lp-tcard__author-info { flex: 1; min-width: 0; }
        .lp-tcard__name {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--lp-ink);
          letter-spacing: -0.015em;
        }
        .lp-tcard__role {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.78rem;
          color: var(--lp-text-muted);
          margin-top: 2px;
          line-height: 1.3;
        }

        .lp-tcard__metric {
          display: inline-flex;
          flex-direction: column;
          padding: 8px 14px;
          background: var(--lp-purple-50);
          border: 1px solid var(--lp-purple-200);
          border-radius: 10px;
          align-self: flex-start;
        }
        .lp-tcard__metric-val {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 1.05rem;
          font-weight: 700;
          color: #A78BFA;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .lp-tcard__metric-label {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.68rem;
          color: var(--lp-text-muted);
          margin-top: 2px;
        }

        @media (max-width: 1024px) {
          .lp-testimonial__grid { grid-template-columns: 1fr; max-width: 560px; margin-left: auto; margin-right: auto; margin-bottom: 56px; }
        }

        .lp-testimonial__more {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          max-width: 600px;
          margin: 0 auto;
        }
        .lp-testimonial__more-line {
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--lp-border), transparent);
        }
        .lp-testimonial__more-text {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.9rem;
          color: var(--lp-text-muted);
          font-style: italic;
          white-space: nowrap;
        }

        @media (max-width: 640px) {
          .lp-testimonial__card { padding: 28px 24px; }
          .lp-testimonial__author { flex-wrap: wrap; }
          .lp-testimonial__metric { margin-left: auto; }
        }

        /* ── Footer extras ───────────────────────────────────────────────── */
        .lp-footer__main-heading {
          font-family: 'Instrument Sans', sans-serif;
          font-size: clamp(1.5rem, 2.4vw, 1.9rem);
          font-weight: 500;
          color: var(--lp-ink);
          letter-spacing: -0.03em;
          margin: 0 0 50px 0;
          text-align: center;
        }
        .lp-footer__closing {
          padding: 40px 0 24px;
          text-align: center;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 1.05rem;
          color: var(--lp-text);
          line-height: 1.55;
          letter-spacing: -0.02em;
          font-weight: 500;
        }

        @media (max-width: 900px) {
          .lp-steps__grid, .lp-audit__grid { grid-template-columns: 1fr; }
          .lp-step-card__connector { display: none; }
          .lp-step-card { min-height: auto; }
          .lp-proof { padding: 80px 5%; }
          .lp-proof__top { flex-direction: column; align-items: flex-start; }
          .lp-proof__heading { text-align: left; }
          .lp-proof__row {
            grid-template-columns: 1fr;
            gap: 28px;
            border-top: 1px solid var(--lp-border);
            padding-top: 28px;
          }
          .lp-proof__row::before, .lp-proof__row::after { display: none; }
          .lp-proof__row > .lp-proof-num {
            grid-column: 1 !important;
            padding: 0 0 28px 0;
            border-bottom: 1px solid var(--lp-border);
          }
          .lp-proof__row > .lp-proof-num:last-child { border-bottom: none; padding-bottom: 0; }
        }
      `}</style>
    </div>
  );
}
