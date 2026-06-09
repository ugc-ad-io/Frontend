import { useState, useEffect, useLayoutEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useTheme } from '../App';
import {
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Star,
  Sparkle,
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
  ChevronDown,
  LayoutGrid,
  LogIn,
  Menu,
  Sun,
  Moon,
  Search,
  Lock,
} from 'lucide-react';
import { motion, AnimatePresence, useAnimationControls, useInView, animate, useMotionValue, useTransform, useScroll, useMotionValueEvent, useSpring, easeInOut } from 'framer-motion';

// Lazy-loaded so three.js/R3F stay out of the main bundle (loaded only when the scene mounts).
const HeroLogo3D = lazy(() => import('../components/HeroLogo3D'));

// Only decode a showcase video while it's on (or near) screen. The showcase holds 6 vertical
// 4K clips rendered across two rows — decoding all of them at once exhausts the tab's memory
// ("Out of Memory"). This mounts the <source> only when in view and drops it when out, so at
// most a few clips ever decode simultaneously.
function LazyVideo({ src, className }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  // Observe visibility only — don't touch the element here (the <src> isn't applied yet
  // at this point, so calling play() now would no-op and leave the card black).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin: '300px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // Play/pause AFTER render, i.e. once the src has actually been attached.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (inView) v.play?.().catch(() => {});
    else v.pause?.();
  }, [inView]);
  return (
    <video
      ref={ref}
      className={className}
      muted
      loop
      playsInline
      autoPlay
      preload="metadata"
      {...(inView ? { src } : {})}
    />
  );
}

// Top-creator leaderboard shown under the hero — rows reveal one-by-one on scroll.
// Edit / add / remove freely; the reveal stagger recomputes from the item count.
const TOP_CREATORS = [
  { name: 'aanya.creates', metric: '1.2M views' },
  { name: 'marcus.lee', metric: '980K views' },
  { name: 'thefoodiekai', metric: '845K views' },
  { name: 'priya.shoots', metric: '712K views' },
  { name: 'devon.makes', metric: '690K views' },
  { name: 'lina.studio', metric: '604K views' },
  { name: 'oncamerawithzo', metric: '558K views' },
  { name: 'reelsbynoah', metric: '503K views' },
  { name: 'maya.unfiltered', metric: '477K views' },
  { name: 'thecartertwins', metric: '441K views' },
  { name: 'sana.skincare', metric: '398K views' },
];

// 1 -> "1st", 2 -> "2nd", 3 -> "3rd", 4 -> "4th" ...
const ordinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// Height of one leaderboard row, in vh (also used to compute the scroll range).
const LOGO3D_ITEM_VH = 10;
// Fraction of the section scroll over which all leaderboard rows pass the centre.
// Pushed right to the end (0.96) so the rows stay until the section unpins — almost no
// empty pinned navy after the fade, in EITHER scroll direction.
const LOGO3D_SCROLL_END = 0.62;

// Pre-scroll offset. Minimal — the leaderboard's first rows are essentially present as
// the section begins (no empty gap where the logo sits alone), rising into focus right
// as the logo glides in and lands.
const LB_PRE = 1;

// Tracks phone-width viewports so the leaderboard can shrink its type to fit — the
// desktop 60px focus size overflows a ~400px screen and the long names get clipped.
function useIsPhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 600px)');
    const update = () => setPhone(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return phone;
}

// One leaderboard row, animated measured.site-style. The whole list shares one
// scroll value; each row's `offset` = its index minus the (fractional) focused
// index, and every visual property is a pure function of that offset:
//   fontSize 60→10px · opacity 1→0.03 · translateY = offset×160 · 2D rotate
//   (entry below = +cw clamped 24°, exit above = −ccw clamped −24°) · white→grey
//   colour · weight 500/400/300 · hidden past ±3.
function LeaderboardRow({ progress, index, count }) {
  const phone = useIsPhone();
  const total = count - 1 + LB_PRE;                 // full focus travel
  // Spread the whole list across [0 → LOGO3D_SCROLL_END] of the section's scroll so
  // every row passes focus before the board fades out (~0.8).
  const off = useTransform(progress, (v) => index - ((v / LOGO3D_SCROLL_END) * total - LB_PRE));

  // Phone: smaller focus size + gentler falloff so rows fit a narrow screen.
  const peak = phone ? 24 : 60;
  const step = phone ? 6 : 14;
  const floor = phone ? 8 : 10;
  const fontSize = useTransform(off, (o) => `${Math.max(floor, peak - Math.abs(o) * step)}px`);
  const opacity = useTransform(off, (o) => Math.max(0.03, 1 - Math.abs(o) * 0.38));
  const fontWeight = useTransform(off, (o) => (Math.abs(o) < 0.22 ? 500 : Math.abs(o) < 1.3 ? 400 : 300));
  const display = useTransform(off, (o) => (Math.abs(o) > 3 ? 'none' : 'flex'));
  const pointerEvents = useTransform(off, (o) => (Math.abs(o) < 0.5 ? 'auto' : 'none'));
  // White at the focus, fading to grey as it moves away (dark-stage variant of the
  // measured.site black→light-grey ramp).
  const color = useTransform(off, (o) => {
    const a = Math.abs(o);
    if (a < 0.12) return '#ffffff';
    const lum = Math.round(Math.max(70, 235 - a * 60));
    return `rgb(${lum},${lum},${lum})`;
  });
  // translate(-50%,-50%) centres the row; +offset×160 spaces it; 2D rotate tilts it.
  const transform = useTransform(off, (o) => {
    const ty = o * 160;
    const rot = o > 0 ? Math.min(o * 8, 24) : Math.max(o * 8, -24);
    return `translate(-50%, -50%) translateY(${ty}px) rotate(${rot}deg)`;
  });

  return (
    <motion.a
      className="lp-logo3d__boardItem"
      href="#"
      onClick={(e) => e.preventDefault()}
      style={{ opacity, color, fontWeight, fontSize, display, pointerEvents, transform }}
    >
      <span className="lp-logo3d__rank">{ordinal(index + 1)}</span>
      <span className="lp-logo3d__creator">{TOP_CREATORS[index].name}</span>
      <span className="lp-logo3d__metric">{TOP_CREATORS[index].metric}</span>
    </motion.a>
  );
}

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
  { value: '10,000+', label: 'UGC Videos Produced' },
  { value: '100cr+', label: 'Attributed Revenue' },
  { value: '1000+', label: 'D2C Brands Scaled' },
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
    quote: 'We stopped guessing. Every creative now ships with a reason behind it.',
    accent: 'a reason behind it',
    name: 'Priya Nair',
    role: 'Head of Growth, Lumen Skincare',
    photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=faces',
    initials: 'PN',
    metric: '+38%',
    metricLabel: 'CTR uplift',
  },
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
    title: 'Would Your Current Ad —',
    sub: 'Convince You To Purchase?',
    Icon: SkipForward,
  },
  {
    title: 'If Your Brand Went Silent for a Week,',
    sub: 'Would Anyone Notice?',
    Icon: BellOff,
  },
  {
    title: 'Would You Click this —',
    sub: "the Ad Wasn't Yours?",
    Icon: Repeat,
  },
];

const proofBadges = [
  { Icon: Award, label: 'Top UGC Platform 2026' },
  { Icon: Users, label: '500+ Brands' },
  { Icon: Sparkles, label: '10K+ Creators' },
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

// "US vs Others" — two-column comparison (us vs marketplaces).
const vsRows = [
  { label: 'Creator vetting',     us: 'Every creator is manually reviewed before briefs', them: 'Open sign-up, anyone can apply' },
  { label: 'Payment safety',      us: 'The platform holds funds until you approve',       them: 'Pay upfront or chase refunds' },
  { label: 'Contact protection',  us: 'Names & contacts stay on-platform',                them: 'Creators poached after first deal' },
  { label: 'Delivery speed',      us: 'Under 10 days, tracked',                           them: 'Agencies: 4–6 weeks' },
  { label: 'Cost',                us: 'Commission only, no hidden cost',                  them: '3–5× agency markup + retainer' },
];

// "What you can achieve" — cards scroll over a big sticky headline (alternating sides).
// Copy is easy to swap; edit titles/descs here.
const achieveItems = [
  {
    icon: Search,
    title: 'Discover Creators in Every Niche',
    desc: 'Beauty, fitness, tech, food, home, fashion, parenting, and more. Each one is manually reviewed before they ever touch a brief.',
  },
  {
    icon: Users,
    title: 'You’re Never Matching Alone',
    desc: 'Get hands-on support from our team while you find your match, so you always have a guide through the process.',
  },
  {
    icon: Shield,
    title: 'Identity Protected, Quality Proven',
    desc: 'You see an anonymous handle and the real brands they’ve worked with — never their personal contact details. Quality, proven. Identity, protected.',
  },
  {
    icon: MessageCircle,
    title: 'Hire and Chat Securely',
    desc: 'Brief, message, revise, and approve — all in one thread, inside the platform. No scattered DMs, no lost context, no off-platform risk.',
  },
  {
    icon: DollarSign,
    title: 'Your Campaign, Your Budget',
    desc: 'Post your own brief and set your own budget. You decide the spend, the deliverables, and who you work with.',
  },
  {
    icon: Lock,
    title: 'Payments Held Safe in Escrow',
    desc: 'Your money is locked in escrow the moment you hire, and only released when you approve the final video. The creator knows they’ll be paid. You know you’ll get what you approved.',
  },
];

// Six showcase video slots — all unique local UGC videos from /public folder.
const showcaseVideos = [
  { id: 1, industryId: 'apps',    label: 'Apps/Software',    isVideo: true,
    src: '/17811912-uhd_2160_3840_24fps.mp4',
    brand: 'Color By Number', creator: 'Abigail', logoBg: 'linear-gradient(135deg, #3A3A66, #fb923c)', logoText: 'CN', tier: 'RISING', rating: 4.8 },
  { id: 2, industryId: 'apps',    label: 'Apps/Software',    isVideo: true,
    src: '/6944288-uhd_2160_3840_24fps.mp4',
    brand: 'Gener8',          creator: 'Chelsea', logoBg: 'linear-gradient(135deg, #1F1F4E, #07074e)', logoText: '8', tier: 'PRO', rating: 4.9 },
  { id: 3, industryId: 'family',  label: 'Family/Kids',      isVideo: true,
    src: '/6951180-uhd_2160_3840_24fps.mp4',
    brand: 'Gatorade',        creator: 'Becki',   logoBg: 'linear-gradient(135deg, #fb923c, #f59e0b)', logoText: 'G', tier: 'ELITE', rating: 5.0 },
  { id: 4, industryId: 'beauty',  label: 'Beauty/Cosmetics', isVideo: true,
    src: '/7690504-hd_1080_1920_30fps.mp4',
    brand: 'Glowly',          creator: 'Maya',    logoBg: 'linear-gradient(135deg, #fb7185, #f43f5e)', logoText: 'Gl', tier: 'PRO', rating: 4.7 },
  { id: 5, industryId: 'beauty',  label: 'Beauty/Cosmetics', isVideo: true,
    src: '/13929852-uhd_2160_3840_24fps.mp4',
    brand: 'Thix Hair',       creator: 'Lara',    logoBg: 'linear-gradient(135deg, #34d399, #14b8a6)', logoText: 'T', tier: 'ELITE', rating: 4.9 },
  { id: 6, industryId: 'beauty',  label: 'Beauty/Cosmetics', isVideo: true,
    src: '/6948556-uhd_2160_3840_24fps.mp4',
    brand: 'AirShine',        creator: 'Priya',   logoBg: 'linear-gradient(135deg, #1F1F4E, #1F1F4E)', logoText: 'A', tier: 'RISING', rating: 4.8 },
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

// Fanned, side-by-side cards. One card is "active" (raised, straightened, purple);
// the rest fan out with a slight tilt. Auto-cycles, and hovering a card activates it.
function AchieveFan({ items }) {
  // No card is lifted/highlighted by default — only while actually hovered.
  const [active, setActive] = useState(-1);
  const n = items.length;

  const SPACING = 196; // horizontal step between card centres
  const TILT = 4;      // degrees of fan tilt per step

  return (
    <div className="lp-achieve__fan" onMouseLeave={() => setActive(-1)}>
      {items.map((item, i) => {
        const offset = i - (n - 1) / 2;
        const isActive = i === active;
        // Active card only lifts (no zoom/scale) and sits straight; the rest fan out.
        const transform = isActive
          ? `translateX(${offset * SPACING}px) translateY(-26px) rotate(0deg)`
          : `translateX(${offset * SPACING}px) translateY(${Math.abs(offset) * 9}px) rotate(${offset * TILT}deg)`;
        const Icon = item.icon;
        return (
          <article
            key={item.title}
            className={`lp-achieve-card${isActive ? ' is-active' : ''}`}
            style={{ transform, zIndex: isActive ? 30 : 10 - Math.round(Math.abs(offset)) }}
            onMouseEnter={() => setActive(i)}
          >
            <div className="lp-achieve-card__top">
              {Icon ? <Icon className="lp-achieve-card__icon" strokeWidth={1.5} /> : null}
              <span className="lp-achieve-card__num">0{i + 1}</span>
            </div>
            <div className="lp-achieve-card__body">
              <h3 className="lp-achieve-card__title">{item.title}</h3>
              <p className="lp-achieve-card__desc">{item.desc}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

// FAQ — accordion below the testimonials, before the footer.
const FAQ_ITEMS = [
  {
    q: 'Who owns the content created through ugcad.io?',
    a: 'You do. Full usage rights transfer to your brand automatically once you approve and the deal completes — handled on-platform, no separate paperwork, no chasing creators for permissions.',
  },
  {
    q: 'How quickly will I receive my content?',
    a: 'Most campaigns go from brief to final delivery in under 14 days. You’ll see the exact due date in your deal room, and the creator is held to it — late delivery triggers automatic penalties.',
  },
  {
    q: 'Can I communicate with creators?',
    a: 'Yes — directly, inside the platform. Brief, chat, share feedback, and approve in one thread. Everything stays on-platform so payments, shipping, and revisions are all protected. Going off-platform means losing escrow and support.',
  },
  {
    q: 'How do payments work?',
    a: 'You load your wallet, and funds are held in escrow the moment you accept a creator. The creator is only paid after you approve the final video. Your money is protected at every stage.',
  },
  {
    q: 'Is my shipping address shared with creators?',
    a: 'Never. Products ship through masked Shiprocket delivery — your warehouse address, phone, and name stay private on every order.',
  },
  {
    q: 'What if I’m not happy with the content?',
    a: 'Every deal includes two free revisions. If something goes wrong, our built-in dispute resolution steps in — you’re never stuck with content you can’t use.',
  },
];

export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState(null);
  const [faqOpen, setFaqOpen] = useState(-1);

  // Testimonial carousel — ONE sliding track (not per-card animation), so motion is
  // perfectly smooth: the whole row of cards translates by exactly one card-width and
  // the data quietly re-centres at the end (infinite loop, no jump). `tOrder` is a
  // window of virtual indices with one off-screen buffer card on each side; sliding
  // reveals a buffer and pushes an edge card out, then we rebuild the window + reset
  // the track instantly so it's seamless.
  const T_LEN = testimonials.length;
  const T_GAP = 28; // must match the flex gap in .lp-testimonial__grid CSS
  const testimonialAt = (v) => testimonials[((v % T_LEN) + T_LEN) % T_LEN];

  const tViewportRef = useRef(null);
  const tControls = useAnimationControls();
  const tBusy = useRef(false);
  const [tMetrics, setTMetrics] = useState({ pitch: 0, cardW: 0, visible: T_LEN });
  // Window of virtual indices: [leftBuffer, ...visible, rightBuffer].
  const [tOrder, setTOrder] = useState(() =>
    Array.from({ length: T_LEN + 2 }, (_, i) => i - 1)
  );

  // Measure the viewport and derive card width + pitch for the current breakpoint.
  useLayoutEffect(() => {
    const measure = () => {
      const el = tViewportRef.current;
      if (!el) return;
      const vw = window.innerWidth;
      // Desktop shows all 4 cards across (wider, filling the full carousel width);
      // tablet shows 2; phones show 1.
      const visible = vw <= 768 ? 1 : vw <= 1024 ? 2 : T_LEN;
      const avail = el.clientWidth - 8; // minus the viewport's 4px side padding
      const cardW = (avail - (visible - 1) * T_GAP) / visible;
      setTMetrics((m) =>
        m.visible === visible && Math.abs(m.cardW - cardW) < 0.5
          ? m
          : { pitch: cardW + T_GAP, cardW, visible }
      );
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
    // T_LEN in deps so the card width recomputes if the number of testimonials
    // changes (e.g. via hot-reload), instead of staying sized for the old count.
  }, [T_LEN]);

  // Rebuild the window when the visible count changes, and park the track on its base
  // offset (one card to the left, so the left buffer sits just off-screen).
  useLayoutEffect(() => {
    setTOrder(Array.from({ length: tMetrics.visible + 2 }, (_, i) => i - 1));
    tControls.set({ x: -tMetrics.pitch });
  }, [tMetrics.visible, tMetrics.pitch, tControls]);

  const rotateTestimonials = async (dir) => {
    const { pitch } = tMetrics;
    if (tBusy.current || !pitch) return;
    tBusy.current = true;
    if (dir >= 0) {
      // Right arrow: slide the track right → a card appears from the LEFT, the
      // right-edge card slides off to the right.
      await tControls.start({ x: 0, transition: { duration: 0.5, ease: easeInOut } });
      setTOrder((o) => [o[0] - 1, ...o.slice(0, -1)]);
    } else {
      // Left arrow: slide left → a card appears from the right, left-edge card exits left.
      await tControls.start({ x: -2 * pitch, transition: { duration: 0.5, ease: easeInOut } });
      setTOrder((o) => [...o.slice(1), o[o.length - 1] + 1]);
    }
    tControls.set({ x: -pitch }); // instant re-centre — content is identical, so seamless
    tBusy.current = false;
  };

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
  // Three cards peel UP, evenly spread across the WHOLE scroll range so there's no dead
  // progress after the last card. The 3rd card (card1Y) is still exiting right up to ~0.99,
  // so the runway never sits idle/blank — the section ends the moment the last card clears,
  // and the next section (pulled up below) is already sliding in. No gap.
  const card2Y = useTransform(auditProgress, [0.04, 0.33], [0, -800]);
  const card2Opacity = useTransform(auditProgress, [0.04, 0.30], [1, 0]);
  const card3Y = useTransform(auditProgress, [0.36, 0.65], [35, -800]);
  const card3Opacity = useTransform(auditProgress, [0.36, 0.62], [1, 0]);
  const card1Y = useTransform(auditProgress, [0.68, 0.99], [-35, -800]);
  const card1Opacity = useTransform(auditProgress, [0.68, 0.95], [1, 0]);
  // The next section (proof) is pulled UP in lockstep with the last card's peel: while Q3
  // rises [0.68 → 0.99], the proof block slides up from below (700px → 0) so it's "stuck"
  // to the card — as the card goes above, the next section is dragged up into view behind it.
  // easeInOut + a spring smooth the motion so it glides in instead of snapping to raw scroll.
  const proofRiseRaw = useTransform(auditProgress, [0.66, 1.0], [700, 0], { ease: easeInOut });
  const proofRiseY = useSpring(proofRiseRaw, { stiffness: 90, damping: 22, mass: 0.6 });
  const proofOpacity = useTransform(auditProgress, [0.68, 0.9], [0, 1]);
  const ctaInView = useInView(ctaRef, { once: true, margin: '-80px' });

  // 3D glass logo — scroll-driven pinned scene under the hero
  const logo3dRef = useRef(null);
  const logo3dInView = useInView(logo3dRef, { once: true, margin: '200px' });
  // Once the brand strip is well into view we're PAST the leaderboard — used to
  // unmount the fixed fly logo so it can't bleed into later sections (the sections
  // overlap via negative margins, so logo3dProgress doesn't reliably hit 1.0 here).
  const brandStripRef = useRef(null);
  const pastBoard = useInView(brandStripRef, { amount: 0.6 });
  // NO spring here: the rows/fade track raw scroll EXACTLY, so the leaderboard looks
  // identical scrolling up or down (a spring lags by direction, which left an empty
  // navy gap when scrolling back UP from the brand strip before the rows re-appeared).
  const { scrollYProgress: logo3dProgress } = useScroll({
    target: logo3dRef,
    offset: ['start start', 'end end'],
  });
  // Leaderboard scrolls vertically: 1st row centered at the start, last row
  // centered at the end — each rank passes through the centre one-by-one.
  const logoBoardStart = 50 - LOGO3D_ITEM_VH / 2;
  const logoBoardEnd = 50 - (TOP_CREATORS.length - 0.5) * LOGO3D_ITEM_VH;
  // All leaderboard lines fully scroll through by LOGO3D_SCROLL_END, then fade out.
  const logoBoardY = useTransform(logo3dProgress, [0, LOGO3D_SCROLL_END], [`${logoBoardStart}vh`, `${logoBoardEnd}vh`]);
  // Lines finish scrolling (~0.78), then fully fade out (~0.86) BEFORE the logo moves —
  // so the logo never overlaps the still-visible text.
  // Rows finish centering by 0.8, THEN text + logo fade out together over 0.8→0.9
  // (fully gone before the brand strip appears) — so the fade is clearly visible.
  // Rows finish by LOGO3D_SCROLL_END (0.62); the 11th sits at the 50% focus, then fades over
  // 0.62→0.72 — melting away as the logo crosses (which starts from that same moment).
  const logoBoardOpacity = useTransform(logo3dProgress, [0.62, 0.72], [1, 0]);
  // Logo sits at the top-LEFT and STAYS there — it no longer glides to the centre
  // at the end of the section (it's base-centred in CSS, so x/y hold the left+up offset).
  const logoX = '-36vw';
  // Resting spot sits BELOW the hero content zone (copy/buttons/badges live in the
  // upper ~30%), so the logo can glide straight to it without ever crossing the text.
  const logoY = '12vh';

  // ── Hero — pinned marketing copy ────────────────────────────────────────────
  // The hero no longer owns a logo: the 3D mark is a single fixed overlay that
  // flies across BOTH the hero and the 3D section (see `journeyP` below). Here we
  // only track the hero's own scroll to fade the brand strip out mid-section.
  const heroRef = useRef(null);
  const { scrollYProgress: heroP } = useScroll({
    target: heroRef,
    offset: ['start start', 'end end'],
  });
  const [heroCollapsed, setHeroCollapsed] = useState(false);
  useMotionValueEvent(heroP, 'change', (v) => {
    // Keep the brand strip on screen for almost the whole hero so it gets its full
    // moment; it then scrolls away as the hero unpins, right before the logo travels.
    setHeroCollapsed(v > 0.9);
  });

  // ── 3D logo "fly" — one continuous journey across hero + 3D section ──────────
  // `journeyRef` wraps BOTH sections, so journeyP (0→1) spans the whole pinned
  // run: hero pins over P≈0→0.35, the 3D section over P≈0.35→1. A single fixed
  // overlay (.lp-logo-fly) is driven by it in three phases:
  //   GROW   (0   → 0.08): small → full size, parked on the right (old PNG spot).
  //   TRAVEL (0.20 → 0.42): glides left + up across the hero→section seam, landing
  //                         in the 3D section's resting spot (matches logoX/logoY).
  //   ROTATE (0.42 → 0.95): tips upright→landscape then spins in place (the GLB's
  //                         own internal animation, fed by `logoSpinP`).
  const journeyRef = useRef(null);
  const { scrollYProgress: journeyRaw } = useScroll({
    target: journeyRef,
    offset: ['start start', 'end end'],
  });
  // Unmount the heavy fixed full-screen WebGL canvas once the journey is well out
  // of view, so the rest of the page (showcase, pricing, FAQ, footer) doesn't pay
  // full-screen WebGL compositing on every scroll. GLB + HDRI stay cached by the
  // browser, so scrolling back up re-mounts it quickly.
  const journeyActive = useInView(journeyRef, { margin: '600px 0px 600px 0px' });
  // Smooth the raw scroll value through a spring so the fly + spin glide instead of
  // snapping to every scroll tick (kills the per-frame jank on the heavy 3D canvas).
  // NOTE: keep this near-CRITICALLY damped (ζ≈1.1), NOT over-damped. An over-damped
  // spring (the old 220/48/0.22, ζ≈3.5) lags badly on a fast flick-scroll: the logo's
  // flyX/flyY trail the page then slowly drift in to catch up — that read as the logo
  // swinging "side to side" and lagging. These values track scroll tightly (low lag,
  // no overshoot) while still filtering per-frame jitter.
  const journeyP = useSpring(journeyRaw, {
    // Snappier (ωn↑, still ζ≈1.1) so a FAST flick-scroll lags far less — the logo reaches
    // its centred dissolve spot in time instead of fading while still mid-cross (off to one side).
    stiffness: 550,
    damping: 22,
    mass: 0.18,
    restDelta: 0.0004,
  });
  // Starts already large (image-1 size), pops to full FAST so it doesn't eat scroll.
  // GROWS during the HERO phase (0→0.2) while it does its 360° spin + colour journey,
  // then holds that size through the cross + leaderboard. (Matches HERO_END in HeroLogo3D.)
  // Grows from small in the hero up to its MAX (0.8) right as it lands in the leaderboard
  // (journeyP 0.3), then holds — so the landscape leaderboard size is the largest it gets.
  // Grows during the hero spin and STOPS at its max (1.1) by the end of the hero phase
  // (journeyP 0.2, where the colour finishes), then holds — doesn't grow any bigger.
  // easeInOut on every segment so the grow (top) and the shrink (dissolve) ramp velocity
  // in/out smoothly instead of the hard, linear, "instant" size jumps at each keyframe.
  // Decrease size DURING the cross + landscape→vertical un-tilt (0.86→0.96), eased — so the
  // shrink is part of that motion, reaching small as it goes upright, not an instant pop.
  const flyScale = useTransform(journeyP, [0, 0.55, 0.86, 0.96], [0.85, 1.0, 1.0, 0.5], { ease: easeInOut });
  // Glide left through the middle as the hero clears — quick enough that there's no
  // long empty-black scroll, landing at the low-left spot (clear of the upper text)
  // just as the leaderboard's first rows rise into focus (see LB_PRE).
  // STRAIGHT, SLOW cross that starts only AFTER the colour finishes AND the hero copy
  // has cleared (~0.5) — so it glides through empty space, no dip (no bounce) and never
  // over the text. Wide range (0.52→0.72) = a slow, smooth glide.
  // The single 360° spin completes by 0.3; the logo then crosses left (together with the
  // landscape tilt) SLOWLY, landing at the board spot by ~0.67 — which is when the 3D
  // section pins and the first leaderboard row scrolls up to meet it (the section's own
  // scroll, and thus the rows, doesn't begin until ~journeyP 0.67). It then holds, and over
  // the dissolve (0.78→0.9, matching the fade + shrink) it drifts to the SCREEN CENTRE and
  // melts away there.
  // Cross starts the moment the 11th (last) row hits the 50% focus (~0.86): glide left→centre
  // over 0.86→0.96 while the row melts away, then dissolve.
  // Centre horizontally FIRST (by 0.92) — above the brand card — so the final move is a
  // straight DROP, not a diagonal swoop from the side.
  const flyX = useTransform(journeyP, [0.3, 0.67, 0.86, 0.92], ['30vw', logoX, logoX, '2.4vw']);
  // Hold the height until centred, THEN descend straight down to TOUCH the brand strip's
  // centre card logo (0.92→1.0) — landing on the elevated middle card, not the icon line.
  const flyY = useTransform(journeyP, [0.3, 0.67, 0.92, 1.0], ['2vh', logoY, logoY, '36vh']);
  // Fade the logo out exactly WITH the leaderboard rows (board fades 0.9→0.97), so it
  // exits cleanly with the text — no lingering dim logo over the empty section after.
  // Logo fades out TOGETHER with the leaderboard text (same range as logoBoardOpacity).
  // Fade driven by journeyP (the SAME reliable, symmetric scroll value that drives the
  // logo's position) rather than logo3dProgress — whose sticky/overlap measurement let
  // the logo linger into the brand strip and got "stuck" on scroll up. Full until the
  // last row (~journeyP 0.87), then fully gone by ~0.94, before the brand strip shows.
  // Stays full through ALL the rows (last one finishes ~journeyP 0.9), then fades only
  // at the very end (0.92→0.97) — just before the brand strip appears.
  // Fade out together WITH the leaderboard text (the rows fade ~0.93→0.97), so as the logo
  // drifts to centre it melts away exactly as the text vanishes — no bright logo on the rows.
  // Fade once it reaches the centre (0.96→1.0) — travels visible, then dissolves in the
  // middle, right after the text clears (no late trailing gap).
  // Fade right as it LANDS on the centre card logo (0.95→1.0) — visible until it touches,
  // then dissolves onto the middle card.
  const flyOpacity = useTransform(journeyP, [0.95, 1.0], [1, 0]);
  // Tip + spin are driven by the SECTION's own scroll (logo3dProgress), NOT the
  // journey scroll — so the logo rotates continuously and IN SYNC with the leaderboard
  // rows. Lands ~logo3dProgress 0.43 as row 1 focuses, so the spin starts right there
  // and runs to FULL by 0.9 — spinning across the whole row list, never freezing early.
  const logoSpinP = useTransform(logo3dProgress, [0.14, 0.8], [0, 1]);
  // On small screens, skip the pinned scroll choreography and fall back to a
  // clean stacked static hero (inline motion styles are dropped). Reduced-motion
  // is intentionally NOT a trigger — the scroll sequence is core to this hero.
  const [heroStatic, setHeroStatic] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setHeroStatic(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

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
      navigate('/auth?role=business');
    }
  };

  // Hero phone-mini video (currently commented out in JSX)
  // const leftVideo = '/9384669-uhd_2160_3840_24fps.mp4';

  return (
    <div className="lp-root" data-theme={theme}>

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

          <nav className="lp-navbar__links">
            <a className="lp-navlink" href="#" onClick={(e) => e.preventDefault()}>
              Explore Creators
            </a>
            <a className="lp-navlink" href="#" onClick={(e) => e.preventDefault()}>
              <DollarSign size={16} /> Pricing
            </a>
            <a className="lp-navlink" href="#" onClick={(e) => e.preventDefault()}>
              <Sparkles size={16} /> Intelligence
            </a>
            <a className="lp-navlink" href="#" onClick={(e) => e.preventDefault()}>
              <LayoutGrid size={16} /> Others <ChevronDown size={15} />
            </a>
          </nav>

          <div className="lp-navbar__actions">
            <button
              type="button"
              className={`lp-theme${theme === 'dark' ? ' lp-theme--dark' : ''}`}
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              <span className="lp-theme__knob">{theme === 'dark' ? <Moon size={14} /> : <Sun size={14} />}</span>
              <span className="lp-theme__ic lp-theme__ic--sun"><Sun size={13} /></span>
              <span className="lp-theme__ic lp-theme__ic--moon"><Moon size={13} /></span>
            </button>
            <a className="lp-nav-join" href="/creator" onClick={(e) => { e.preventDefault(); navigate('/creator'); }}>
              Join as <em>Creator</em>
            </a>
            <button className="lp-btn-login" onClick={() => navigate('/auth?role=business')}>
              <LogIn size={16} /> Log in
            </button>
            <button className="lp-btn-signup" onClick={() => navigate('/auth?mode=signup&role=business')}>
              Sign Up
            </button>
          </div>

          {/* Mobile hamburger — toggles the slide-down menu */}
          <button
            className="lp-navbar__burger"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>

        {/* Mobile menu panel */}
        <div className={`lp-navbar__mobile${menuOpen ? ' lp-navbar__mobile--open' : ''}`}>
          <a className="lp-navlink" href="#" onClick={(e) => { e.preventDefault(); setMenuOpen(false); }}>
            Explore Creators
          </a>
          <a className="lp-navlink" href="#" onClick={(e) => { e.preventDefault(); setMenuOpen(false); }}>
            <DollarSign size={16} /> Pricing
          </a>
          <a className="lp-navlink" href="#" onClick={(e) => { e.preventDefault(); setMenuOpen(false); }}>
            <Sparkles size={16} /> Intelligence
          </a>
          <a className="lp-navlink" href="#" onClick={(e) => { e.preventDefault(); setMenuOpen(false); }}>
            <LayoutGrid size={16} /> Others
          </a>
          <a className="lp-navlink" href="#" onClick={(e) => { e.preventDefault(); setMenuOpen(false); navigate('/auth?mode=signup&role=creator'); }}>
            Join as Creator
          </a>
          <div className="lp-navbar__mobile-actions">
            <button className="lp-btn-login" onClick={() => { setMenuOpen(false); navigate('/auth?role=business'); }}>
              <LogIn size={16} /> Log in
            </button>
            <button className="lp-btn-signup" onClick={() => { setMenuOpen(false); navigate('/auth?mode=signup&role=business'); }}>
              Sign Up
            </button>
          </div>
        </div>
      </motion.header>

      {/* ── Journey wrapper — drives the one continuous 3D-logo fly-through ──── */}
      <div className="lp-journey" ref={journeyRef}>

      {/* Fixed 3D mark that flies across the hero + 3D section (desktop only).
          On mobile we fall back to a static 3D inside the section (see below). */}
      {!heroStatic && journeyActive && (
        <motion.div
          className="lp-logo-fly"
          // Stay MOUNTED the whole time and drive visibility PURELY by scroll position
          // (flyOpacity). No state-based gate (pastBoard) — that got "stuck" after you
          // hit the bottom and never let the logo come back on the way up. flyOpacity is
          // symmetric, so scroll up behaves identically to scroll down.
          style={{ x: flyX, y: flyY, scale: flyScale, opacity: flyOpacity }}
          aria-hidden="true"
        >
          <Suspense fallback={<div className="lp-logo3d__loading">Loading…</div>}>
            {/* journeyP drives BOTH phases inside HeroLogo3D: hero 360°+colour, then
                the leaderboard landscape tip + barrel-roll. */}
            <HeroLogo3D progress={journeyP} />
          </Suspense>
        </motion.div>
      )}

      {/* ── Hero — pinned marketing copy (logo lives in the fly overlay) ─────── */}
      <section
        className={`lp-hero${heroStatic ? ' lp-hero--static' : ''}${!heroStatic && heroCollapsed ? ' lp-hero--collapsed' : ''}`}
        ref={heroRef}
      >
        <motion.div className="lp-hero__sticky">
          {/* Left: marketing copy — hides once the logo grows (2nd scroll) */}
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
            The{' '}
            <span className="lp-hero__title-accent">Performance System</span>{' '}
            Behind The{' '}
            <span className="lp-hero__title-accent">Top 1% D2C Brands</span>
          </motion.h1>

          <motion.p
            className="lp-hero__subtitle"
            custom={2}
            variants={heroItemVariants}
            initial="hidden"
            animate="visible"
          >
            Top-notch UGC video ads in just a few clicks.
            <br />
            Unlock serious growth with{' '}
            <span style={{ color: '#A78BFA', fontWeight: 600 }}>high-performing UGC ads</span>.
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
              onClick={() => navigate('/creator')}
              data-testid="get-started-btn"
            >
              Join as Creator <ArrowRight size={18} />
            </button>
            <button
              className="lp-btn-ghost"
              onClick={() => navigate('/auth?role=business&mode=signup')}
              data-testid="learn-more-btn"
            >
              Sign up as Brand
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

          {/* The logo mark now lives in the fixed .lp-logo-fly overlay above —
              it flies in from here and continues into the 3D section below. */}

          {/* Brand strip moved out — it's now its own persistent section AFTER the
              leaderboard (see .lp-brandstrip below). */}
        </motion.div>

        {/* curved divider into the next section */}
        <svg
          className="lp-hero__divider"
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0,0 C480,80 960,80 1440,0 L1440,80 L0,80 Z" fill="#0a0a0a" />
        </svg>
      </section>

      {/* ── 3D glass logo (left) + center copy — scroll-driven ──────────────── */}
      <section className={`lp-logo3d${logo3dInView ? ' is-in' : ''}`} ref={logo3dRef}>
        <div className="lp-logo3d__sticky">
          {/* 3D logo — top-left resting spot. On desktop the fixed .lp-logo-fly
              overlay flies in and occupies this position, so the stage here is a
              MOBILE-ONLY fallback (no fly-through on small screens). */}
          {heroStatic && (
            <motion.div className="lp-logo3d__stage" style={{ x: logoX, y: logoY }}>
              {logo3dInView ? (
                <Suspense fallback={<div className="lp-logo3d__loading">Loading…</div>}>
                  <HeroLogo3D progress={logo3dProgress} />
                </Suspense>
              ) : (
                <div className="lp-logo3d__placeholder" aria-hidden="true" />
              )}
            </motion.div>
          )}

          {/* leaderboard — scrolls vertically; each rank fades in one-by-one at centre */}
          <motion.div className="lp-logo3d__board" style={{ opacity: logoBoardOpacity }}>
            <div className="lp-logo3d__boardTrack">
              {TOP_CREATORS.map((c, i) => (
                <LeaderboardRow
                  key={c.name}
                  progress={logo3dProgress}
                  index={i}
                  count={TOP_CREATORS.length}
                />
              ))}
            </div>
          </motion.div>
        </div>
      </section>
      </div>{/* /lp-journey */}

      {/* ── Brand strip — moved here, AFTER the leaderboard; stays put (no fade) ── */}
      <section className="lp-brandstrip" ref={brandStripRef}>
        <div className="lp-hero__strip">
          <div className="lp-hero__brands-side lp-hero__brands-side--left">
            <div className="lp-brands__track lp-brands__track--left">
              {(() => {
                const base = [
                  { name: 'YouTube', slug: 'youtube' },
                  { name: 'Instagram', slug: 'instagram' },
                  { name: 'Spotify', slug: 'spotify' },
                  { name: 'Meta', slug: 'meta' },
                  { name: 'Pinterest', slug: 'pinterest' },
                  { name: 'Snapchat', slug: 'snapchat' },
                  { name: 'Twitch', slug: 'twitch' },
                  { name: 'Discord', slug: 'discord' },
                ];
                return [...base, ...base, ...base, ...base];
              })().map((b, i) => (
                <div key={`L-${b.name}-${i}`} className="lp-brand-item">
                  <div className="lp-brand-item__icon">
                    <img
                      src={`https://cdn.simpleicons.org/${b.slug}`}
                      alt={b.name}
                      loading="lazy"
                      onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                    />
                  </div>
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
                  { name: 'Figma', slug: 'figma' },
                  { name: 'Vimeo', slug: 'vimeo' },
                  { name: 'Reddit', slug: 'reddit' },
                  { name: 'Stripe', slug: 'stripe' },
                  { name: 'Shopify', slug: 'shopify' },
                  { name: 'Dribbble', slug: 'dribbble' },
                  { name: 'Patreon', slug: 'patreon' },
                  { name: 'Behance', slug: 'behance' },
                ];
                return [...base, ...base, ...base, ...base];
              })().map((b, i) => (
                <div key={`R-${b.name}-${i}`} className="lp-brand-item">
                  <div className="lp-brand-item__icon">
                    <img
                      src={`https://cdn.simpleicons.org/${b.slug}`}
                      alt={b.name}
                      loading="lazy"
                      onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
                    />
                  </div>
                  <div className="lp-brand-item__name">{b.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Showcase — Best UGC on the internet (moved here, right after the brand strip) ── */}
      <section className="lp-showcase">
        <div className="lp-showcase__inner">
          <h2 className="lp-showcase__heading">
            We created{' '}
            <span className="lp-showcase__heading--accent">7,000+</span>{' '}
            UGC ads that resulted in{' '}
            <span className="lp-showcase__heading--accent">100cr+</span>{' '}
            in sales
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
                    <LazyVideo
                      src={v.src}
                      className="lp-showcase-card__media"
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
                  <div className="lp-showcase-card__rating">
                    <Star size={12} fill="#FBBF24" stroke="#FBBF24" />
                    {v.rating.toFixed(1)}
                  </div>
                  <span className={`lp-showcase-card__tier lp-showcase-card__tier--${v.tier.toLowerCase()}`}>
                    {v.tier}
                  </span>
                </div>
              </div>
            );
            return (
              <>
                <div className="lp-showcase__row">
                  <div className="lp-showcase__track lp-showcase__track--left">
                    {Array.from({ length: 8 }).flatMap(() => row1).map((v, idx) => renderItem(v, idx, 'R1'))}
                  </div>
                </div>
                <div className="lp-showcase__row">
                  <div className="lp-showcase__track lp-showcase__track--right">
                    {Array.from({ length: 8 }).flatMap(() => row2).map((v, idx) => renderItem(v, idx, 'R2'))}
                  </div>
                </div>
              </>
            );
          })()}
          </div>
        </div>
      </section>

      {/* connector 1: hero → hook — joined U-bridge with center drop into badge.
          Negative marginTop pulls the dashed verticals up so they touch the
          showcase video-card row above (no black gap between cards and line). */}
      <div className="lp-connector" style={{ height: 380, marginTop: -24, marginBottom: -110 }}>
        <svg viewBox="0 0 1400 380" width="100%" height="100%" preserveAspectRatio="none">
          <path d="M 80 0 L 80 80 L 480 80 L 480 180" fill="none" stroke="rgb(152,161,172)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.5" />
          <path d="M 1320 0 L 1320 80 L 920 80 L 920 180" fill="none" stroke="rgb(152,161,172)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.5" />
          <path d="M 480 180 L 920 180" fill="none" stroke="rgb(152,161,172)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.5" />
          <path d="M 700 180 L 700 380" fill="none" stroke="rgb(152,161,172)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.5" />
        </svg>
      </div>

      {/* ── Scroll Hook (removed) ──────────────────────────────────────────── */}
      <section className="lp-hook" style={{ display: 'none' }}>
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

      {/* ── How It Works (3 Steps) (removed) ───────────────────────────────── */}
      <section className="lp-steps" style={{ display: 'none' }}>
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

      {/* connector: steps → audit — center straight line into the cards */}
      <div className="lp-connector" style={{ height: 270, marginTop: -100, marginBottom: -80 }}>
        <svg viewBox="0 0 1400 270" width="100%" height="100%" preserveAspectRatio="none">
          <path d="M 700 0 L 700 270" fill="none" stroke="rgb(152,161,172)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.5" />
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
              // Peel order: Q1 (front) first, Q2 (right) second, Q3 (back-left) last.
              // Q3 peels quickly and finishes at the section release so the page scrolls
              // to the next section the instant the last card goes up.
              const positions = [
                { x:   0, rotate:  -4, z: 3, y: card2Y },  // Q1 — front, peels first
                { x:  90, rotate:  12, z: 2, y: card3Y },  // Q2 — right, peels second
                { x: -90, rotate: -20, z: 1, y: card1Y },  // Q3 — left, peels last (quick)
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

          {/* footer pill removed */}
          <div className="lp-audit__footer-card" style={{ display: 'none' }}>
            <div className="lp-audit__footer-icon">
              <ArrowRight size={18} />
            </div>
            <p className="lp-audit__footer-text">
              This platform exists for brands who don't like their answers yet.
            </p>
          </div>
        </div>
      </section>

      {/* ── Find & Hire Creators — fanned, side-by-side cards (one active, auto-cycles) ── */}
      <section className="lp-achieve">
        <h2 className="lp-achieve__title">
          Find &amp; <em className="lp-achieve__hl">Hire</em> <em className="lp-achieve__hl">Creators</em> Instantly
        </h2>
        <AchieveFan items={achieveItems} />
      </section>

      {/* US vs Others now follows the "What you can achieve" section in normal flow,
          so it scrolls up into view right behind the last achieve card. */}
      <div style={{ position: 'relative', zIndex: 4 }}>
      <div className="lp-connector" style={{ height: 120, marginTop: 0, marginBottom: -40, position: 'relative', zIndex: 5, pointerEvents: 'none' }}>
        <svg viewBox="0 0 1400 120" width="100%" height="100%" preserveAspectRatio="none">
          <path d="M 700 0 L 700 120" fill="none" stroke="rgb(152,161,172)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.5" />
        </svg>
      </div>

      {/* ── US vs Others — two-column comparison table ─────────────────────── */}
      <section className="lp-vs">
        <div className="lp-vs__inner">
          <h2 className="lp-vs__heading">US <span className="lp-vs__heading-vs">VS</span> OTHERS</h2>
          <div className="lp-vs__table">
            {/* header — labels col, then "Others" (middle), then highlighted UGCad.io (right) */}
            <div className="lp-vs__row lp-vs__row--head">
              <div className="lp-vs__cell lp-vs__cell--label" />
              <div className="lp-vs__cell lp-vs__cell--them">
                <span className="lp-vs__them-label">Others (Marketplaces / Agencies)</span>
              </div>
              <div className="lp-vs__cell lp-vs__cell--us">
                <span className="lp-vs__brand">UGCad.io</span>
              </div>
            </div>

            {vsRows.map((r) => (
              <div className="lp-vs__row" key={r.label}>
                <div className="lp-vs__cell lp-vs__cell--label">{r.label}</div>

                <div className="lp-vs__cell lp-vs__cell--them">
                  <Sparkle size={18} className="lp-vs__star lp-vs__star--them" aria-hidden="true" />
                  <span className="lp-vs__pill lp-vs__pill--them">{r.them}</span>
                </div>

                <div className="lp-vs__cell lp-vs__cell--us">
                  <Sparkle size={18} className="lp-vs__star lp-vs__star--us" aria-hidden="true" />
                  <span className="lp-vs__pill lp-vs__pill--us">{r.us}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      </div>

      {/* ── Features (removed) ─────────────────────────────────────────────── */}
      <section className="lp-features" ref={featuresRef} style={{ display: 'none' }}>
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

      {/* connector 7: audit → proof — features section is hidden, so this is a short
          single center line. Big negative marginTop pulls the proof section up to fill the
          blank left by the (removed) cards/features so it appears right as the cards exit. */}
      {/* Proof now flows normally AFTER the US-vs-Others block (which is the section
          stuck to Q3's peel). */}
      <div style={{ position: 'relative', zIndex: 3 }}>
      <div className="lp-connector" style={{ height: 120, marginTop: 0, marginBottom: -60, position: 'relative', zIndex: 5 }}>
        <svg viewBox="0 0 1400 120" width="100%" height="100%" preserveAspectRatio="none">
          <path d="M 700 0 L 700 120" fill="none" stroke="rgb(152,161,172)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.5" />
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
              <motion.div
                key={s.label}
                className="lp-proof-num"
                initial={{ opacity: 0, y: 28 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.6, delay: i * 0.14, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="lp-proof-num__index">0{i + 1}</span>
                <span className="lp-proof-num__value">
                  <CountUp value={s.value} />
                </span>
                <span className="lp-proof-num__label">{s.label}</span>
              </motion.div>
            ))}
          </div>

          <p className="lp-proof__micro">— Not louder ads. Better ones. —</p>
        </div>
      </section>
      </div>

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

          <div className="lp-testimonial__carousel">
            <button
              type="button"
              className="lp-testimonial__arrow lp-testimonial__arrow--left"
              onClick={() => rotateTestimonials(-1)}
              aria-label="Previous testimonials"
            >
              <ChevronLeft size={22} />
            </button>

            <div className="lp-testimonial__viewport" ref={tViewportRef}>
            <motion.div className="lp-testimonial__grid" animate={tControls}>
              {tOrder.map((v, i) => {
                const t = testimonialAt(v);
                const [before, after] = t.accent && t.quote.includes(t.accent)
                  ? [t.quote.split(t.accent)[0], t.quote.split(t.accent)[1]]
                  : [t.quote, ''];
                return (
                  <article
                    key={v}
                    style={{ flex: `0 0 ${tMetrics.cardW}px` }}
                    className="lp-tcard"
                  >
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
            </motion.div>
            </div>

            <button
              type="button"
              className="lp-testimonial__arrow lp-testimonial__arrow--right"
              onClick={() => rotateTestimonials(1)}
              aria-label="Next testimonials"
            >
              <ChevronRight size={22} />
            </button>
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

      {/* ── CTA (removed) ──────────────────────────────────────────────────── */}
      <section className="lp-cta" ref={ctaRef} style={{ display: 'none' }}>
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
              onClick={() => navigate('/auth?role=business')}
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

      {/* ── FAQ ───────────────────────────────────────────────────────────── */}
      <section className="lp-faq">
        <div className="lp-faq__inner">
          <h2 className="lp-faq__heading">Frequently <em>Asked</em> Questions</h2>

          <div className="lp-faq__head">
            <p className="lp-faq__intro">
              Here are the answers to the most frequently asked questions we encounter
              with regards to our services. For further assistance, feel free to reach
              out directly to our team.
            </p>
            <button
              type="button"
              className="lp-faq__contact"
              onClick={() => navigate('/auth?role=business&mode=signup')}
            >
              Contact the team
            </button>
          </div>

          <div className="lp-faq__grid">
            {FAQ_ITEMS.map((item, i) => {
              const isOpen = faqOpen === i;
              return (
                <div
                  key={item.q}
                  className={`lp-faq__item${isOpen ? ' is-open' : ''}`}
                >
                  <button
                    type="button"
                    className="lp-faq__q"
                    aria-expanded={isOpen}
                    onClick={() => setFaqOpen(isOpen ? -1 : i)}
                  >
                    <span>{item.q}</span>
                    <ChevronDown size={20} className="lp-faq__chevron" aria-hidden="true" />
                  </button>
                  <div className="lp-faq__answer-wrap">
                    <p className="lp-faq__answer">{item.a}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
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
          --lp-purple-50:  rgba(var(--lp-fg),0.06);
          --lp-purple-100: rgba(var(--lp-fg),0.08);
          --lp-purple-200: #BBBBC8;
          --lp-purple-300: #8888A0;
          --lp-purple-500: #3A3A66;
          --lp-purple-600: #1F1F4E;
          --lp-purple-700: #A78BFA;
          --lp-purple-900: #050538;
          --lp-ink:        #0A0A0A;
          --lp-text:       #ffffff;
          --lp-text-muted: rgba(var(--lp-fg), 0.7);
          --lp-text-soft:  #9CA3AF;
          --lp-bg:         #0a0a0a;
          --lp-bg-soft:    #0a0a0a;
          --lp-border:     #E5E7EB;
        }

        /* ── Root ─────────────────────────────────────────────────────────── */
        .lp-root {
          /* Dark is the base; [data-theme="light"] overrides below. --lp-fg is an
             RGB triplet used as rgba(var(--lp-fg),a) for theme-flippable whites. */
          --lp-fg: 255, 255, 255;
          --lp-page-bg: #0a0a0a;
          --lp-text: #ffffff;
          min-height: 100vh;
          font-family: 'Instrument Sans', 'Inter', sans-serif;
          background: var(--lp-page-bg);
          color: var(--lp-text);
          position: relative;
          transition: background 0.3s ease, color 0.3s ease;
        }
        .lp-root[data-theme="light"] {
          --lp-fg: 28, 27, 75;          /* navy text/borders/surfaces */
          --lp-page-bg: #ecebf8;        /* light lavender */
          --lp-text: #1c1b4b;
          --lp-bg: #ecebf8;
          --lp-bg-soft: #f4f3fc;
          --lp-text-muted: rgba(28,27,75,0.66);
          --lp-text-soft: #5b5a7e;
          --lp-section: #ffffff;        /* light card/section surface */
        }
        /* Dark base also exposes a section-surface token so both themes share it. */
        .lp-root { --lp-section: #07074e; }

        /* ── Animated purple background blobs ──────────────────────────── */
        .lp-bg-animations {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          overflow: hidden;
        }
        /* Static soft glow via a radial-gradient instead of filter: blur(80px).
           A large blur filter makes the GPU rasterize a huge blurred texture; with
           these fixed + animated forever, that ran every frame and was a primary
           cause of the constant whole-page lag. A gradient paints once = ~free. */
        .lp-bg-blob {
          position: absolute;
          border-radius: 50%;
          /* Subtle ambient haze — soft centre + early fade so it reads like the old
             blurred blob, not a hard, bright blue disc behind the content. */
          background: radial-gradient(circle, rgba(7, 7, 78, 0.32) 0%, rgba(7, 7, 78, 0) 58%);
          opacity: 0.5;
        }
        .lp-root[data-theme="light"] .lp-bg-blob {
          background: radial-gradient(circle, rgba(183, 168, 255, 0.3) 0%, rgba(183, 168, 255, 0) 58%);
          opacity: 0.4;
        }
        .lp-bg-blob--1 { width: 480px; height: 480px; top: 10%; left: 15%; }
        .lp-bg-blob--2 { width: 520px; height: 520px; top: 60%; right: 12%; }
        .lp-bg-blob--3 { width: 380px; height: 380px; top: 40%; left: 50%; transform: translate(-50%, -50%); }
        .lp-bg-blob--4 { width: 440px; height: 440px; bottom: 5%; left: 25%; }
        @media (max-width: 768px) {
          .lp-bg-blob { width: 280px !important; height: 280px !important; }
        }
        .lp-root h1, .lp-root h2, .lp-root h3, .lp-root h4, .lp-root h5, .lp-root h6,
        .lp-root p, .lp-root span, .lp-root div, .lp-root li, .lp-root a,
        .lp-root label, .lp-root td, .lp-root th, .lp-root strong, .lp-root em,
        .lp-root blockquote, .lp-root figcaption, .lp-root input, .lp-root textarea,
        .lp-root select, .lp-root button {
          color: var(--lp-text);
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

        .lp-navbar__inner {
          display: flex;
          align-items: center;
          gap: 32px;
          max-width: 1320px;
          margin: 0 auto;
          background: transparent;       /* no white container */
          padding: 10px 4px;
        }

        .lp-navbar__logo {
          height: 44px;
          width: auto;
          cursor: pointer;
          transition: opacity 0.2s;
        }
        .lp-navbar__logo:hover { opacity: 0.8; }

        /* Center nav links */
        .lp-navbar__links {
          display: flex;
          align-items: center;
          gap: 26px;
        }
        .lp-root .lp-navlink {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.95rem;
          font-weight: 500;
          color: rgba(var(--lp-fg), 0.88);
          text-decoration: none;
          cursor: pointer;
          transition: color 0.2s ease;
        }
        .lp-root .lp-navlink:hover { color: #ffffff; }
        .lp-navlink svg { color: rgba(var(--lp-fg), 0.6); }

        .lp-navbar__actions {
          margin-left: auto;
          display: flex;
          gap: 12px;
          align-items: center;
        }

        /* Join as Creator — purple text link */
        .lp-root .lp-nav-join {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.95rem;
          font-weight: 600;
          color: #a78bfa;
          text-decoration: none;
          cursor: pointer;
          transition: opacity 0.2s ease;
        }
        .lp-root .lp-nav-join em { font-style: italic; }
        .lp-root .lp-nav-join:hover { opacity: 0.8; }

        /* Log in — outlined button */
        .lp-btn-login {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 8px 18px;
          border-radius: 10px;
          border: 1px solid rgba(var(--lp-fg), 0.25);
          background: transparent;
          color: var(--lp-text);
          font-family: 'Instrument Sans', sans-serif;
          font-weight: 500;
          font-size: 0.92rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .lp-btn-login:hover { border-color: rgba(var(--lp-fg), 0.55); }

        /* Theme toggle (sun/moon pill switch) */
        .lp-root .lp-theme { position: relative; width: 64px; height: 30px; border-radius: 999px; cursor: pointer;
          border: 1px solid rgba(var(--lp-fg,255,255,255),0.2); background: rgba(var(--lp-fg,255,255,255),0.08);
          padding: 0; flex-shrink: 0; transition: background 0.25s ease; }
        .lp-theme__knob { position: absolute; top: 2px; left: 2px; width: 24px; height: 24px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center; color: #fff;
          background: linear-gradient(135deg, #4f7cff, #2f5be6); box-shadow: 0 2px 8px rgba(47,91,230,0.5);
          transition: transform 0.28s cubic-bezier(0.4,0,0.2,1); z-index: 2; }
        .lp-theme--dark .lp-theme__knob { transform: translateX(34px);
          background: linear-gradient(135deg, #3a3a55, #20202f); box-shadow: 0 2px 8px rgba(0,0,0,0.5); }
        .lp-theme__ic { position: absolute; top: 50%; transform: translateY(-50%); display: flex; align-items: center;
          justify-content: center; color: rgba(var(--lp-fg,255,255,255),0.5); z-index: 1; }
        .lp-theme__ic--sun { left: 8px; }
        .lp-theme__ic--moon { right: 8px; }

        /* Sign Up — filled purple button */
        .lp-root .lp-btn-signup {
          padding: 8px 22px;
          border-radius: 10px;
          border: 1px solid #A78BFA;
          background: #A78BFA;
          color: #fff;
          font-family: 'Instrument Sans', sans-serif;
          font-weight: 600;
          font-size: 0.92rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .lp-root .lp-btn-signup:hover { background: #9170f0; border-color: #9170f0; }

        /* Mobile hamburger + slide-down menu (hidden on desktop) */
        .lp-navbar__burger {
          display: none;
          margin-left: auto;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          border-radius: 12px;
          border: 1px solid rgba(var(--lp-fg), 0.2);
          background: rgba(var(--lp-fg), 0.06);
          color: var(--lp-text);
          cursor: pointer;
        }
        .lp-navbar__mobile {
          display: none;
          flex-direction: column;
          gap: 4px;
          margin: 10px 4px 0;
          padding: 12px;
          border-radius: 16px;
          background: rgba(18, 18, 22, 0.96);
          border: 1px solid rgba(var(--lp-fg), 0.12);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(12px);
        }
        .lp-navbar__mobile .lp-navlink {
          padding: 12px 12px;
          border-radius: 10px;
          color: rgba(var(--lp-fg), 0.9);
        }
        .lp-navbar__mobile .lp-navlink:active { background: rgba(var(--lp-fg), 0.08); }
        .lp-navbar__mobile-actions {
          display: flex;
          gap: 10px;
          margin-top: 8px;
          padding-top: 12px;
          border-top: 1px solid rgba(var(--lp-fg), 0.1);
        }
        .lp-navbar__mobile-actions .lp-btn-login,
        .lp-navbar__mobile-actions .lp-btn-signup { flex: 1; justify-content: center; }

        /* ── Hero (dark constellation) ─────────────────────────────────────── */
        /* Tall scroll track that drives the pinned hero sequence */
        .lp-journey { position: relative; }

        .lp-hero {
          position: relative;
          height: 150vh;
          color: var(--lp-text);
          isolation: isolate;
          z-index: 3;
        }

        /* The single 3D mark that flies across the hero + 3D section. Fixed to the
           viewport (so it floats above the hero→section seam, never clipped), base-
           centred via negative margins; scroll-driven translate/scale do the rest.
           Sized to match the 3D section's resting stage so scale:1 == landed size. */
        .lp-logo-fly {
          position: fixed;
          top: 50%;
          left: 50%;
          width: clamp(170px, 22vw, 330px);
          height: clamp(170px, 33vh, 360px);
          margin-top: calc(clamp(170px, 33vh, 360px) * -0.5);
          margin-left: calc(clamp(170px, 22vw, 330px) * -0.5);
          transform-origin: center center;
          z-index: 4;
          pointer-events: none;
          will-change: transform, opacity;
        }

        /* Pinned stage — stays dark throughout. The copy is vertically centred now that
           the brand strip no longer reserves the bottom; the 3D mark balances it right. */
        .lp-hero__sticky {
          position: sticky;
          top: 0;
          height: 100vh;
          overflow: hidden;
          background: var(--lp-page-bg);
          padding: 300px 8% 56px;
          display: flex;
          align-items: stretch;
        }
        /* In light mode show the navy/blue logo mark (the white one would vanish on
           the light hero), regardless of the scroll-driven crossfade state. */
        .lp-root[data-theme="light"] .lp-hero__logo-img--white { opacity: 0 !important; }
        .lp-root[data-theme="light"] .lp-hero__logo-img--navy { opacity: 1 !important; }

        /* Left: marketing copy (left-aligned, upper zone) */
        .lp-hero__inner {
          position: relative;
          z-index: 3;
          max-width: 640px;
          width: 100%;
          text-align: left;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          /* Spread the copy over the full hero height so the lower band isn't empty.
             The badge sits up top, the trust pills sit near the bottom, and the
             title/subtitle/CTAs get even breathing room between. Caps keep the
             distribution from looking disconnected on very tall viewports. */
          justify-content: space-between;
          gap: clamp(16px, 3vh, 44px);
          min-height: 0;
          transition: opacity 0.45s ease;
        }

        /* Right: the UGC logo mark — anchored to the right; grows in place on the
           2nd scroll (transform-origin right so it never clips off the right edge) */
        .lp-hero__logo {
          position: absolute;
          top: 50%;
          right: 5vw;
          margin-top: calc(clamp(220px, 26vw, 420px) * -0.5);
          width: clamp(220px, 26vw, 420px);
          height: clamp(220px, 26vw, 420px);
          transform-origin: right center;
          z-index: 4;
          will-change: transform;
          pointer-events: none;
        }

        /* 2nd scroll onward — brand strip hides; the copy (text) stays visible */
        .lp-hero__strip { transition: opacity 0.45s ease; }
        .lp-hero--collapsed .lp-hero__strip {
          opacity: 0;
          pointer-events: none;
        }
        .lp-hero__logo-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
          transition: opacity 0.5s ease;
        }
        /* Start state — clean white mark with a soft glow (visible by default) */
        .lp-hero__logo-img--white {
          opacity: 1;
          filter: drop-shadow(0 0 40px rgba(var(--lp-fg), 0.28));
        }
        /* 3rd-scroll state — navy-blue mark; brightened + blue glow so it reads clearly
           on the dark stage. Hidden until the .lp-hero--navy class is applied. */
        .lp-hero__logo-img--navy {
          opacity: 0;
          filter: brightness(3.2) saturate(1.6) drop-shadow(0 0 34px rgba(80, 100, 255, 0.85));
        }
        /* 3rd scroll — crossfade white → navy blue */
        .lp-hero--navy .lp-hero__logo-img--white { opacity: 0; }
        .lp-hero--navy .lp-hero__logo-img--navy { opacity: 1; }

        .lp-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 100px;
          background: rgba(var(--lp-fg), 0.04);
          border: 1px solid rgba(var(--lp-fg), 0.12);
          color: #C8F23A;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.9rem;
          font-weight: 600;
          /* Guaranteed clearance below the fixed navbar — applies in every layout
             (works regardless of the section padding overrides per breakpoint). */
          margin: clamp(40px, 9vh, 96px) 0 0;
          backdrop-filter: blur(8px);
        }

        .lp-hero__title {
          font-family: 'Instrument Sans', sans-serif;
          font-size: clamp(2.4rem, 5.4vw, 4.4rem);
          font-weight: 500;
          line-height: 1.3;
          color: var(--lp-text);
          margin: 0;
          letter-spacing: -0.04em;
          max-width: 20ch;
        }

        .lp-hero__mark {
          display: inline-block;
          background: #A78BFA;
          color: var(--lp-text);
          padding: 0.04em 0.28em;
          border-radius: 10px;
          white-space: nowrap;
        }
        .lp-hero__title-accent {
          display: inline-block;
          background: #A78BFA;
          color: var(--lp-text);
          padding: 0.04em 0.28em;
          border-radius: 10px;
        }

        .lp-hero__subtitle {
          font-family: 'Instrument Sans', sans-serif;
          color: rgba(var(--lp-fg), 0.65);
          font-size: 1.4rem;
          line-height: 1.7;
          max-width: 560px;
          margin: 0;
          text-align: left;
        }

        .lp-hero__accent {
          color: #C8F23A;
          font-weight: 600;
        }

        .lp-hero__ctas {
          display: flex;
          gap: 12px;
          align-items: center;
          justify-content: flex-start;
          flex-wrap: wrap;
          margin-bottom: 0;
        }

        /* Scoped button overrides inside the dark hero only */
        .lp-hero .lp-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 16px 32px;
          border-radius: 100px;
          background: #A78BFA;
          color: var(--lp-text);
          font-family: 'Instrument Sans', sans-serif;
          font-weight: 700;
          font-size: 1.05rem;
          border: none;
          cursor: pointer;
          transition: transform 0.25s ease, filter 0.25s ease;
        }
        .lp-hero .lp-btn-primary:hover {
          transform: translateY(-2px);
          filter: brightness(1.08);
        }

        .lp-hero .lp-btn-ghost {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 15px 28px;
          border-radius: 100px;
          background: rgba(var(--lp-fg), 0.06);
          color: var(--lp-text);
          font-family: 'Instrument Sans', sans-serif;
          font-weight: 500;
          font-size: 1.05rem;
          border: 1px solid rgba(var(--lp-fg), 0.2);
          cursor: pointer;
          transition: background 0.22s ease, border-color 0.22s ease;
          backdrop-filter: blur(8px);
        }
        .lp-hero .lp-btn-ghost:hover {
          background: rgba(var(--lp-fg), 0.12);
          border-color: rgba(var(--lp-fg), 0.32);
        }

        .lp-hero__badges {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          justify-content: flex-start;
        }

        .lp-proof-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 16px;
          background: rgba(var(--lp-fg), 0.05);
          border: 1px solid rgba(var(--lp-fg), 0.1);
          border-radius: 100px;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.85rem;
          font-weight: 500;
          color: rgba(var(--lp-fg), 0.75);
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
          color: var(--lp-text);
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
          border: 2px solid rgba(var(--lp-fg), 0.1);
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

        /* Brand strip — its OWN persistent section, appearing AFTER the leaderboard has
           fully faded (margin-top:0 → it enters as the leaderboard sticky releases, so
           no overlap with the still-visible rows). No black block: a soft navy radial
           glow keeps it on-theme while the rest stays transparent. */
        .lp-brandstrip {
          position: relative;
          z-index: 3;
          /* Pulled up so the strip rises into view as the LAST leaderboard rows fade out,
             closing the empty navy tail after the board finishes (~logo3dProgress 0.8). */
          margin-top: -34vh;
          padding: 60px 0;
          /* Match the "Most Ads Fail…" (.lp-hook) section — transparent, so it shows the
             shared animated page background instead of its own radial glow. */
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        /* In the standalone section the strip flows normally (not pinned absolute). */
        .lp-brandstrip .lp-hero__strip {
          position: relative;
          left: auto;
          bottom: auto;
          padding: 0;
        }

        /* Bottom strip — scrolling brand logos */
        .lp-hero__strip {
          position: absolute;
          left: 0;
          bottom: 0;
          z-index: 3;
          display: flex;
          align-items: center;
          gap: 0;
          width: 100vw;
          max-width: 100vw;
          padding: 24px 0 14px;
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
          color: var(--lp-text);
          letter-spacing: -0.02em;
        }
        .lp-hero__strip-counter span {
          font-size: 0.85rem;
          color: rgba(var(--lp-fg), 0.55);
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
          position: relative;
          width: 96px;
          height: 96px;
          border-radius: 24px;
          background: #131316;
          border: 1px solid rgba(var(--lp-fg), 0.09);
          /* soft highlight from the top-left for a subtly raised tile (like the ref) */
          box-shadow: inset 1px 1px 0 rgba(var(--lp-fg), 0.10);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }
        .lp-brand-item__icon img {
          width: 46px;
          height: 46px;
          object-fit: contain;
        }
        .lp-brand-item__name {
          font-size: 0.78rem;
          font-weight: 500;
          color: rgba(var(--lp-fg), 0.55);
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
          width: 140px;
          height: 140px;
          border-radius: 28px;
          background: #1f1f1f;
          border: 1px solid rgba(var(--lp-fg), 0.1);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 0 2px rgba(167, 139, 250, 0.55),
                      0 0 28px rgba(167, 139, 250, 0.6),
                      0 0 120px rgba(167, 139, 250, 0.4);
          position: relative;
          z-index: 4;
        }
        .lp-hero__brand-center img {
          width: 108px;
          height: 108px;
          object-fit: contain;
          /* The PNG's mark sits a touch high within its transparent box — nudge it down to optically centre */
          transform: translateY(6px);
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

        /* ── 3D glass logo — scroll-driven scene (measured.site-style) ───────── */
        .lp-logo3d {
          position: relative;
          height: 175vh;                 /* scroll travel that drives the animation */
          background: transparent;       /* show the shared animated page background */
          z-index: 2;
        }
        /* Smooth the hard hero(black)→section(navy) seam: a tall gradient at the top
           of this section starts at the hero's #0a0a0a and melts into the navy bg. */
        .lp-logo3d::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 130vh;
          background: linear-gradient(180deg, #0a0a0a 0%, rgba(10,10,16,0.55) 38%, transparent 100%);
          z-index: 0;
          pointer-events: none;
        }
        /* Soft glow that eases in when the section enters view, so the transition
           feels intentional rather than an abrupt cut. */
        .lp-logo3d::after {
          content: '';
          position: absolute;
          top: 6vh; left: 50%;
          width: min(900px, 90vw); height: 70vh;
          transform: translateX(-50%);
          background: radial-gradient(50% 50% at 50% 50%, rgba(99,102,241,0.18), transparent 70%);
          opacity: 0;
          z-index: 0;
          pointer-events: none;
          transition: opacity 1.1s ease;
        }
        .lp-logo3d.is-in::after { opacity: 1; }
        .lp-logo3d__sticky {
          position: sticky;
          top: 0;
          height: 100vh;
          width: 100%;
          overflow: hidden;
          display: flex;
          align-items: center;
          /* Push the leaderboard into the right half so the landed logo (resting at the
             left, ~-36vw) never overlaps the centred rows. Reset to centre on mobile. */
          justify-content: flex-end;
          padding-right: 8%;
          /* transparent — shows the shared animated page background (.lp-bg-animations) */
          background: transparent;
        }
        /* small 3D logo pinned to the upper-left */
        .lp-logo3d__stage {
          position: absolute;
          top: 50%;
          left: 50%;
          margin-top: calc(clamp(200px, 40vh, 440px) * -0.5);   /* base-centre vertically */
          margin-left: calc(clamp(200px, 27vw, 400px) * -0.5);  /* base-centre horizontally */
          width: clamp(200px, 27vw, 400px);
          height: clamp(200px, 40vh, 440px);
          z-index: 3;                    /* above the leaderboard when they overlap */
        }
        .lp-logo3d__canvas {
          width: 100% !important;
          height: 100% !important;
          display: block;
        }

        /* leaderboard viewport — fixed 100vh window, fades at top + bottom edges */
        .lp-logo3d__board {
          position: relative;
          width: 64%;
          max-width: 760px;
          height: 100vh;
          z-index: 2;
          overflow: hidden;
          perspective: 600px;            /* 3D depth for the per-row X tilt (lower = more dramatic drum) */
          perspective-origin: center center;
          -webkit-mask-image: linear-gradient(to bottom, transparent 0%, #000 30%, #000 70%, transparent 100%);
                  mask-image: linear-gradient(to bottom, transparent 0%, #000 30%, #000 70%, transparent 100%);
        }
        .lp-logo3d__boardTrack {
          position: absolute;
          inset: 0;                      /* full stage; rows position themselves */
        }
        .lp-logo3d__boardItem {
          position: absolute;
          left: 50%; top: 44%;           /* shifted a bit up; JS transform adds offset + rotate */
          transform-origin: center center;
          display: flex;
          align-items: baseline;
          justify-content: center;
          gap: 0.4em;
          white-space: nowrap;
          text-decoration: none;
          font-family: 'Instrument Sans', 'Inter', sans-serif;
          letter-spacing: -0.03em;
          line-height: 1;
          will-change: transform, opacity, font-size;
        }
        /* colour is driven per-row (grey → white at the centre); spans inherit it */
        .lp-logo3d__rank { color: inherit; font-weight: 500; }
        .lp-logo3d__creator { color: inherit; }
        .lp-logo3d__metric { color: inherit; font-weight: 500; }
        .lp-logo3d__placeholder,
        .lp-logo3d__loading {
          width: 100%;
          height: 100%;
          display: grid;
          place-items: center;
          color: var(--lp-text-soft);
          font-family: 'Instrument Sans', 'Inter', sans-serif;
        }
        @media (max-width: 900px) {
          .lp-logo3d { height: 260vh; }
          .lp-logo3d__stage {
            width: clamp(120px, 34vw, 200px);
            height: clamp(120px, 22vh, 220px);
            margin-top: calc(clamp(120px, 22vh, 220px) * -0.5);
            margin-left: calc(clamp(120px, 34vw, 200px) * -0.5);
          }
          .lp-logo3d__board { width: 92%; }
          .lp-logo3d__boardItem { font-size: clamp(0.85rem, 4vw, 1.4rem); }
        }

        /* ── The Problem section ──────────────────────────────────────────── */
        .lp-problem {
          padding: 100px 8% 60px;
          background: rgba(var(--lp-fg), 0.06);
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
          background: rgba(var(--lp-fg), 0.06);
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
          background: rgba(var(--lp-fg), 0.06);
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
          background: rgba(var(--lp-fg), 0.06);
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
          color: var(--lp-text);
          border-color: #25D366;
          border-radius: 50%;
        }
        .lp-stamp--check {
          top: 52%;
          left: 32%;
          width: 40px; height: 40px;
          color: rgba(var(--lp-fg), 0.7);
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
          color: rgba(var(--lp-fg), 0.6);
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
          color: var(--lp-text);
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
          background: rgba(var(--lp-fg),0.06);
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
          background: linear-gradient(135deg, rgba(var(--lp-fg),0.1), rgba(var(--lp-fg),0.05));
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
          color: var(--lp-text);
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
          padding: 80px 8% 24px;
          background: transparent;
          color: var(--lp-text);
        }
        .lp-showcase__inner {
          max-width: 1200px;
          margin: 0 auto;
          text-align: center;
        }
        .lp-showcase__heading {
          font-family: 'Instrument Sans', sans-serif;
          /* vw-scaled so the whole sentence stays on ONE line across widths */
          font-size: clamp(1rem, 2.9vw, 2.6rem);
          font-weight: 500;
          color: #ffffff;
          line-height: 1.2;
          letter-spacing: -0.04em;
          margin: 0 0 14px 0;
          white-space: nowrap;
        }
        /* Whole heading white on the dark stage (accent included). */
        .lp-showcase__heading--accent {
          color: #ffffff;
          background: none;
          -webkit-text-fill-color: #ffffff;
        }
        /* Light theme: white would vanish on the lavender bg, so keep it readable. */
        .lp-root[data-theme="light"] .lp-showcase__heading { color: var(--lp-ink); }
        .lp-root[data-theme="light"] .lp-showcase__heading--accent {
          color: #A78BFA;
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
          background: rgba(var(--lp-fg), 0.06);
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
          color: var(--lp-text);
          border-color: var(--lp-ink);
        }
        .lp-filter--reset:hover {
          background: var(--lp-purple-700);
          color: var(--lp-text);
          border-color: var(--lp-purple-700);
        }

        .lp-showcase__viewport {
          display: flex;
          flex-direction: column;
          gap: 32px;
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
          gap: 20px;
          width: max-content;
          padding: 0 8%;
          will-change: transform;
        }
        .lp-showcase__track--left {
          animation: showcaseScrollLeft 55s linear infinite;
        }
        .lp-showcase__track--right {
          animation: showcaseScrollRight 55s linear infinite;
        }
        .lp-showcase__viewport:hover .lp-showcase__track {
          animation-play-state: paused;
        }
        @keyframes showcaseScrollLeft {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes showcaseScrollRight {
          0%   { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .lp-showcase__track { animation: none; }
        }

        .lp-showcase-item {
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: 172px;
          flex-shrink: 0;
        }

        .lp-showcase-card {
          position: relative;
          aspect-ratio: 9 / 15;
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

        /* Top-left numeric rating overlay */
        .lp-showcase-card__rating {
          position: absolute;
          top: 10px;
          left: 10px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 9px;
          border-radius: 100px;
          background: rgba(10, 10, 20, 0.78);
          border: 1px solid rgba(var(--lp-fg),0.14);
          color: var(--lp-text);
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: -0.01em;
          line-height: 1;
        }

        /* Top-right tier badge overlay */
        .lp-showcase-card__tier {
          position: absolute;
          top: 10px;
          right: 10px;
          padding: 4px 10px;
          border-radius: 100px;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.66rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          color: var(--lp-text);
          text-transform: uppercase;
          box-shadow: 0 4px 12px rgba(0,0,0,0.25);
        }
        .lp-showcase-card__tier--elite {
          background: linear-gradient(135deg, #7c3aed, #4338ca);
        }
        .lp-showcase-card__tier--pro {
          background: linear-gradient(135deg, #2563eb, #1e3a8a);
        }
        .lp-showcase-card__tier--rising {
          background: linear-gradient(135deg, #f59e0b, #d97706);
        }

        /* Meta footer below each card */
        .lp-showcase-meta {
          padding: 0 4px;
          text-align: center;
        }
        .lp-showcase-meta__brand {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 1rem;
          font-weight: 600;
          color: var(--lp-ink);
          letter-spacing: -0.02em;
          line-height: 1.2;
        }
        @media (max-width: 1024px) {
          .lp-showcase__grid { grid-auto-columns: minmax(240px, 280px); }
        }
        @media (max-width: 640px) {
          .lp-showcase { padding: 60px 5%; }
          .lp-showcase__grid { grid-template-columns: 1fr; }
          .lp-filter { padding: 8px 14px; font-size: 0.82rem; }
        }

        /* ── Find & Hire Creators — fanned, side-by-side cards ── */
        .lp-achieve {
          position: relative;
          padding: 90px 8% 36px;
          background: transparent;
          color: var(--lp-text);
          text-align: center;
        }
        .lp-achieve__title {
          margin: 0 auto;
          max-width: 16ch;
          text-align: center;
          font-family: 'Instrument Serif', Georgia, 'Times New Roman', serif;
          font-weight: 400;
          font-size: clamp(2.2rem, 6vw, 4.6rem);
          line-height: 1.05;
          letter-spacing: -0.02em;
          color: var(--lp-text);
        }
        .lp-achieve__title em { font-style: italic; }
        .lp-achieve__title .lp-achieve__hl { color: #A78BFA !important; }

        /* Fan container — cards are absolutely placed and fanned via inline transform. */
        .lp-achieve__fan {
          position: relative;
          height: 430px;
          margin-top: 48px;
        }
        .lp-achieve-card {
          position: absolute;
          top: 0;
          left: 50%;
          width: 332px;
          height: 400px;
          margin-left: -166px;
          display: flex;
          flex-direction: column;
          border-radius: 24px;
          overflow: hidden;
          background: rgba(22, 22, 28, 0.97);
          border: 1px solid rgba(var(--lp-fg), 0.08);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
          transform-origin: center bottom;
          transition: transform 0.55s cubic-bezier(.16,1,.3,1), box-shadow 0.4s ease;
          cursor: pointer;
        }
        .lp-achieve-card__top {
          position: relative;
          height: 110px;
          flex: none;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
        }
        .lp-achieve-card__icon {
          width: 60px;
          height: 60px;
          color: rgba(var(--lp-fg), 0.85);
          transition: color 0.4s ease;
        }
        .lp-achieve-card__num {
          position: absolute;
          top: 18px;
          left: 20px;
          font-family: 'Instrument Serif', Georgia, serif;
          font-size: 1.7rem;
          line-height: 1;
          color: rgba(var(--lp-fg), 0.4);
          transition: color 0.4s ease;
        }
        .lp-achieve-card__body {
          padding: 6px 30px 32px;
          text-align: left;
        }
        .lp-achieve-card .lp-achieve-card__title {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 1.28rem;
          font-weight: 700;
          color: var(--lp-text);
          margin: 0 0 18px;
          padding-bottom: 18px;
          letter-spacing: -0.01em;
          /* Divider line between the headline and the body copy. */
          border-bottom: 1px solid rgba(var(--lp-fg), 0.14);
          transition: color 0.4s ease, border-color 0.4s ease;
        }
        .lp-achieve-card__desc {
          font-family: 'Instrument Sans', sans-serif;
          font-size: 1.02rem;
          line-height: 1.55;
          color: rgba(var(--lp-fg), 0.62);
          margin: 0;
        }
        /* Active card — purple icon + title (no band, no zoom), stronger shadow. */
        .lp-achieve-card.is-active {
          box-shadow: 0 44px 100px rgba(0, 0, 0, 0.62);
        }
        .lp-achieve-card.is-active .lp-achieve-card__icon { color: #A78BFA; }
        .lp-achieve-card.is-active .lp-achieve-card__num { color: #A78BFA; }
        .lp-achieve-card.is-active .lp-achieve-card__title { color: #A78BFA; }
        .lp-achieve-card.is-active .lp-achieve-card__title { border-bottom-color: rgba(167, 139, 250, 0.4); }

        /* Light theme surfaces. */
        .lp-root[data-theme="light"] .lp-achieve-card {
          background: rgba(255, 255, 255, 0.96);
          border-color: rgba(0, 0, 0, 0.06);
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.12);
        }

        /* Mobile: drop the fan, stack the cards vertically (neutralise inline transforms). */
        @media (max-width: 900px) {
          .lp-achieve__title { font-size: clamp(2rem, 9vw, 3.2rem); }
          .lp-achieve__fan {
            height: auto;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
            margin-top: 40px;
          }
          .lp-achieve-card {
            position: relative !important;
            top: auto;
            left: auto;
            margin-left: 0;
            transform: none !important;
            z-index: auto !important;
            width: 100%;
            max-width: 360px;
            height: auto;
          }
          .lp-achieve-card__top { height: 120px; }
        }

        /* ── US vs Others — two-column comparison ─────────────────────────── */
        .lp-vs {
          padding: 90px 8% 100px;
          color: var(--lp-text);
        }
        .lp-vs__inner {
          max-width: 1080px;
          margin: 0 auto;
        }
        /* Borderless table — the only framed element is the highlighted UGCad.io panel. */
        .lp-vs__table {
          position: relative;
          background: transparent;
          border: none;
          padding: 0;
        }
        .lp-vs__row {
          display: grid;
          grid-template-columns: 0.82fr 1fr 1.04fr;
          align-items: stretch;
          column-gap: 0;
        }
        .lp-vs__cell {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 12px;
          text-align: left;
          padding: 18px 0;
        }
        .lp-vs__cell--label {
          padding-right: 26px;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.96rem;
          font-weight: 500;
          letter-spacing: 0.01em;
          color: rgba(var(--lp-fg), 0.6);
        }
        .lp-vs__cell--them {
          padding-left: 30px;
          padding-right: 24px;
        }
        /* Axis dividers: a full-height VERTICAL rule after the label column and a
           HORIZONTAL rule under the header that runs all the way across, including
           through the highlighted UGCad.io panel. */
        .lp-vs__cell--label {
          border-right: 1px solid rgba(var(--lp-fg), 0.12);
        }
        .lp-vs__row--head .lp-vs__cell--label,
        .lp-vs__row--head .lp-vs__cell--them {
          border-bottom: 1px solid rgba(var(--lp-fg), 0.12);
        }
        /* the line continues across the panel — a brighter purple so it reads on it */
        .lp-vs__row--head .lp-vs__cell--us {
          border-bottom: 1px solid rgba(167, 139, 250, 0.28);
        }

        /* ── Featured UGCad.io column — brand purple panel down the right side ──
           Flat, uniform fill so consecutive cells blend into ONE seamless panel;
           a per-cell gradient created a visible seam (line) at every row boundary. */
        .lp-vs__cell--us {
          position: relative;
          padding: 18px 28px;
          background: rgba(48, 41, 80, 0.55);
          border-left: 1px solid rgba(167, 139, 250, 0.22);
          border-right: 1px solid rgba(167, 139, 250, 0.22);
        }
        .lp-vs__row--head .lp-vs__cell--us {
          border-top: 1px solid rgba(167, 139, 250, 0.30);
          border-top-left-radius: 22px;
          border-top-right-radius: 22px;
          padding-top: 26px;
        }
        .lp-vs__row:last-child .lp-vs__cell--us {
          border-bottom: 1px solid rgba(167, 139, 250, 0.30);
          border-bottom-left-radius: 22px;
          border-bottom-right-radius: 22px;
          padding-bottom: 26px;
        }
        .lp-vs__brand {
          font-family: 'Instrument Sans', sans-serif;
          font-weight: 800;
          font-size: 1.25rem;
          color: #ffffff;
          letter-spacing: -0.01em;
        }
        .lp-vs__them-label {
          font-family: 'Instrument Sans', sans-serif;
          font-weight: 800;
          font-size: 1.25rem;
          letter-spacing: -0.01em;
          line-height: 1.3;
          color: #ffffff;
        }
        /* sparkle icon before each value */
        .lp-vs__star { flex-shrink: 0; }
        .lp-vs__star--them {
          color: rgba(var(--lp-fg), 0.42);
          fill: rgba(var(--lp-fg), 0.16);
        }
        .lp-vs__star--us {
          color: #A78BFA;
          fill: rgba(167, 139, 250, 0.9);
        }
        /* value text */
        .lp-vs__pill {
          flex: 1;
          min-width: 0;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.96rem;
          font-weight: 500;
          line-height: 1.4;
          text-align: left;
        }
        .lp-vs__pill--us { color: #ffffff; }
        .lp-vs__pill--them { color: rgba(var(--lp-fg), 0.55); }

        .lp-vs__heading {
          font-family: 'Instrument Serif', Georgia, serif;
          font-size: clamp(2.4rem, 5vw, 3.9rem);
          font-weight: 400;
          letter-spacing: 0.015em;
          word-spacing: 0.18em;
          margin: 0 0 36px;
          text-align: center;
          transform: translateX(48px);
          color: #ffffff;
        }
        /* VS in brand purple + italic. Selector is specific enough (0,2,1) to beat the
           global ".lp-root span { color }" rule that was overriding it. */
        .lp-vs__heading span.lp-vs__heading-vs {
          color: #A78BFA;
          font-style: italic;
        }
        @media (max-width: 768px) {
          .lp-vs { padding: 60px 5% 70px; }
          .lp-vs__heading { transform: none; }
          .lp-vs__row { grid-template-columns: 1fr; row-gap: 4px; }
          .lp-vs__cell { padding: 7px 0; }
          .lp-vs__cell--label {
            padding-right: 0;
            padding-top: 18px;
            font-weight: 700;
            color: rgba(var(--lp-fg), 0.78);
            border-right: none;
          }
          .lp-vs__cell--them { padding-left: 0; padding-right: 0; }
          .lp-vs__row--head .lp-vs__cell--label,
          .lp-vs__row--head .lp-vs__cell--them { border-bottom: none; }
          .lp-vs__cell--us {
            padding: 12px 16px;
            border: 1px solid rgba(167, 139, 250, 0.30) !important;
            border-radius: 14px !important;
          }
        }

        /* ── Comparison Table ─────────────────────────────────────────────── */
        .lp-compare {
          padding: 100px 8% 100px;
          background: transparent;
          color: var(--lp-text);
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
          background: rgba(var(--lp-fg), 0.06);
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
          color: var(--lp-text);
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
          color: var(--lp-text);
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
          /* Exactly 4 features → 4 even columns (no orphaned 4th card the way auto-fit
             left it). Collapses to 2×2 on tablet and a single column on phones. */
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          text-align: left;
        }
        @media (max-width: 1024px) {
          .lp-features__grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 600px) {
          .lp-features__grid { grid-template-columns: 1fr; }
        }

        .lp-card {
          background: rgba(var(--lp-fg), 0.06);
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

        /* Light mode polish: solid white cards (not faint translucent navy) with a clearer
           shadow/border so they pop on the lavender bg; soften the near-invisible numbers. */
        .lp-root[data-theme="light"] .lp-card {
          background: #ffffff;
          border-color: rgba(28,27,75,0.10);
          box-shadow: 0 12px 30px rgba(7,7,78,0.08);
        }
        .lp-root[data-theme="light"] .lp-card:hover {
          border-color: rgba(167,139,250,0.55);
          box-shadow: 0 18px 44px rgba(124,58,237,0.16);
        }
        .lp-root[data-theme="light"] .lp-card__num { color: rgba(28,27,75,0.22); }

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
        /* Light mode: keep the icon glyph crisp white on the blue/navy tile. */
        .lp-root[data-theme="light"] .lp-card__icon,
        .lp-root[data-theme="light"] .lp-card__icon svg { color: #ffffff; }

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
          color: var(--lp-text);
          overflow: hidden;
          text-align: center;
        }
        .lp-cta::before,
        .lp-cta::after {
          content: '';
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }
        .lp-cta::before {
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(7, 7, 78, 0.30) 0%, rgba(7, 7, 78, 0) 70%);
          top: -180px; left: -120px;
        }
        .lp-cta::after {
          width: 420px; height: 420px;
          background: radial-gradient(circle, rgba(7, 7, 78, 0.22) 0%, rgba(7, 7, 78, 0) 70%);
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
          background: rgba(var(--lp-fg),0.85);
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
        /* Beat the global .lp-root button rule (color: var(--lp-text)) so the label stays
           white on the dark button in BOTH themes (it was navy-on-navy in light mode). */
        .lp-root .lp-btn-join { color: #ffffff; }
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
          background: rgba(var(--lp-fg),0.8);
          backdrop-filter: blur(6px);
          color: #07074e;
          font-family: 'Instrument Sans', sans-serif;
          font-weight: 600;
          font-size: 1rem;
          border: 1px solid var(--lp-border);
          cursor: pointer;
          transition: all 0.22s ease;
        }
        /* Light mode only: these two sit on a dark (var(--lp-fg)-tinted) surface, so the
           dark default text would be navy-on-navy. White only here; dark mode keeps it dark. */
        .lp-root[data-theme="light"] .lp-cta__pill,
        .lp-root[data-theme="light"] .lp-btn-outline { color: #ffffff; }
        /* On hover both buttons turn to a LIGHT background in light mode, so flip the
           label back to dark for contrast. */
        .lp-root[data-theme="light"] .lp-btn-join:hover,
        .lp-root[data-theme="light"] .lp-btn-outline:hover { color: #07074e; }
        .lp-btn-outline:hover {
          background: rgba(var(--lp-fg), 0.06);
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
          background: rgba(var(--lp-fg),0.7);
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
        /* Light mode only: the signals bar background is dark (var(--lp-fg)-tinted),
           so flip the stats + labels to white for contrast. Dark mode keeps them navy. */
        .lp-root[data-theme="light"] .lp-cta__signal-num,
        .lp-root[data-theme="light"] .lp-cta__signal-label { color: #ffffff; }
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
          /* Keep a clear gap between the fixed navbar (logo) and the first hero
             element. Kept below the 300px desktop value since these viewports are
             shorter — enough to breathe without pushing the trust pills off-screen. */
          .lp-hero__sticky { padding: 210px 5% 72px; }
        }

        /* Static fallback — small screens & reduced-motion: no pinning, stacked layout.
           Driven by the .lp-hero--static class (set from a matchMedia check in JS). */
        .lp-hero--static { height: auto; }
        .lp-hero--static .lp-hero__sticky {
          position: relative;
          height: auto;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 32px;
          padding: 110px 6%;
        }
        .lp-hero--static .lp-hero__inner {
          min-height: 0;
          align-items: center;
          text-align: center;
          max-width: 640px;
        }
        .lp-hero--static .lp-hero__subtitle { margin-left: auto; margin-right: auto; text-align: center; }
        .lp-hero--static .lp-hero__ctas,
        .lp-hero--static .lp-hero__badges { justify-content: center; }
        .lp-hero--static .lp-hero__logo {
          position: relative;
          top: auto;
          left: auto;
          right: auto;
          margin: 0 auto;
          width: clamp(180px, 60vw, 300px);
          height: clamp(180px, 60vw, 300px);
        }
        .lp-hero--static .lp-hero__strip {
          position: relative;
          left: auto;
          bottom: auto;
        }

        @media (max-width: 768px) {
          .lp-hero__title { max-width: 100%; }
          .lp-navbar__inner { padding: 10px 5%; gap: 16px; }
          .lp-navbar__links { display: none; }
          .lp-nav-join { display: none; }
          .lp-navbar__actions { display: none; }
          .lp-navbar__burger { display: inline-flex; }
          .lp-navbar__mobile--open { display: flex; }
          .lp-navbar__logo { height: 38px; }
          .lp-btn-login, .lp-btn-signup { padding: 7px 14px; font-size: 0.85rem; }
          .lp-hero__ctas { flex-direction: column; align-items: stretch; width: 100%; }
          .lp-hero .lp-btn-primary, .lp-hero .lp-btn-ghost { justify-content: center; }
          .lp-hero__badges { gap: 6px; }
          .lp-proof-badge { font-size: 0.7rem; padding: 5px 10px; }
          /* The hero logo's 220px floor made it fill ~60% of a phone screen as a
             giant white→navy bar. Shrink it to a tasteful top-right accent. */
          .lp-hero__logo {
            width: clamp(110px, 30vw, 180px);
            height: clamp(110px, 30vw, 180px);
            margin-top: calc(clamp(110px, 30vw, 180px) * -0.5);
            right: 4vw;
          }
          .lp-hero__logo-img--white { filter: drop-shadow(0 0 22px rgba(var(--lp-fg),0.22)); }
          .lp-hero__logo-img--navy { filter: brightness(3.2) saturate(1.6) drop-shadow(0 0 20px rgba(80,100,255,0.7)); }
        }

        @media (max-width: 480px) {
          .lp-hero__divider { height: 50px; }
          /* Even smaller on phones, and nudged to the top so it clears the copy. */
          .lp-hero__logo {
            top: 26%;
            width: clamp(92px, 32vw, 130px);
            height: clamp(92px, 32vw, 130px);
            margin-top: calc(clamp(92px, 32vw, 130px) * -0.5);
          }
        }

        /* ── Whole-page mobile polish ─────────────────────────────────────── */
        @media (max-width: 600px) {
          /* Tighter horizontal gutters + trimmed vertical padding on phones */
          .lp-hook { padding: 72px 6% 60px; }
          .lp-steps { padding: 56px 6%; }
          .lp-showcase { padding: 48px 4% 56px; }
          .lp-compare { padding: 48px 5%; }
          .lp-features { padding: 56px 6% 72px; }
          .lp-proof { padding: 64px 6%; }
          .lp-testimonial { padding: 56px 6%; }
          .lp-cta { padding: 56px 6% 72px; }
          /* Keep big display headings from overflowing very small screens */
          .lp-section-heading,
          .lp-steps__heading,
          .lp-showcase__heading,
          .lp-compare__heading,
          .lp-testimonial__heading,
          .lp-proof__heading { font-size: clamp(1.5rem, 6vw, 2rem); }
        }

        /* Comparison table — keep the 5 columns legible on small phones */
        @media (max-width: 480px) {
          .lp-compare__cell { font-size: 0.62rem; padding: 9px 4px; }
          .lp-compare__cell--label { padding-left: 8px; }
          .lp-compare__check { width: 22px; height: 22px; }
          .lp-compare__logo { height: 16px; }
          .lp-compare__row--head .lp-compare__cell { font-size: 0.64rem; }
        }

        /* Short viewports (e.g. laptops ~700px tall) — scale the pinned hero down so
           copy, logo and the brand strip all fit without overlapping. */
        @media (min-width: 769px) and (max-height: 800px) {
          .lp-hero__sticky { padding: 100px 6% 170px; }
          .lp-hero__title { font-size: clamp(1.7rem, 3.6vw, 2.8rem); }
          .lp-hero__subtitle { font-size: 0.92rem; margin-bottom: 18px; }
          .lp-hero__logo {
            margin-top: calc(clamp(180px, 22vw, 320px) * -0.5);
            width: clamp(180px, 22vw, 320px);
            height: clamp(180px, 22vw, 320px);
          }
          .lp-hero__strip { padding: 16px 0 28px; }
          .lp-brand-item__icon { width: 72px; height: 72px; border-radius: 18px; }
          .lp-brand-item__icon img { width: 36px; height: 36px; }
          .lp-hero__brand-center { width: 108px; height: 108px; }
          .lp-hero__brand-center img { width: 82px; height: 82px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .lp-hero__brands-side .lp-brands__track { animation: none !important; }
        }

        /* ── FAQ ──────────────────────────────────────────────────────────── */
        .lp-faq {
          position: relative;
          padding: 110px 6% 90px;
          z-index: 2;
        }
        .lp-faq__inner {
          max-width: 1160px;
          margin: 0 auto;
        }
        .lp-faq__heading {
          font-family: 'Instrument Sans', sans-serif;
          font-size: clamp(2rem, 4.6vw, 3.4rem);
          font-weight: 600;
          letter-spacing: -0.02em;
          color: rgba(var(--lp-fg), 0.96);
          margin: 0 0 26px;
        }
        /* Elegant italic-serif accent word, mirroring the reference design. */
        .lp-faq__heading em {
          font-family: Georgia, 'Times New Roman', serif;
          font-style: italic;
          font-weight: 400;
        }
        /* Header row: intro copy on the left, contact button on the right. */
        .lp-faq__head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 40px;
          margin-bottom: 46px;
        }
        .lp-faq__intro {
          max-width: 560px;
          margin: 0;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.96rem;
          line-height: 1.7;
          color: var(--lp-text-muted);
        }
        .lp-faq__contact {
          flex-shrink: 0;
          padding: 14px 26px;
          border-radius: 4px;
          background: transparent;
          border: 1px solid rgba(var(--lp-fg), 0.30);
          color: rgba(var(--lp-fg), 0.90);
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.74rem;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.2s ease, border-color 0.2s ease;
        }
        .lp-faq__contact:hover {
          background: rgba(var(--lp-fg), 0.08);
          border-color: rgba(var(--lp-fg), 0.50);
        }
        /* Two-column card grid — each card expands independently. */
        .lp-faq__grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .lp-faq__item {
          align-self: start;
          background: rgba(var(--lp-fg), 0.04);
          border: 1px solid rgba(var(--lp-fg), 0.08);
          border-radius: 10px;
          overflow: hidden;
          transition: background 0.2s ease, border-color 0.2s ease;
        }
        .lp-faq__item:hover { background: rgba(var(--lp-fg), 0.06); }
        .lp-faq__item.is-open { border-color: rgba(167, 139, 250, 0.30); }
        .lp-faq__q {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 20px 22px;
          background: none;
          border: none;
          cursor: pointer;
          text-align: left;
          font-family: 'Instrument Sans', sans-serif;
          font-size: clamp(0.9rem, 1.3vw, 1rem);
          font-weight: 500;
          color: rgba(var(--lp-fg), 0.90);
          transition: color 0.2s ease;
        }
        .lp-faq__q:hover { color: rgba(var(--lp-fg), 1); }
        .lp-faq__chevron {
          flex-shrink: 0;
          color: rgba(var(--lp-fg), 0.55);
          transition: transform 0.3s ease, color 0.3s ease;
        }
        .lp-faq__item.is-open .lp-faq__chevron { transform: rotate(180deg); color: #A78BFA; }
        .lp-faq__answer-wrap {
          display: grid;
          grid-template-rows: 0fr;
          transition: grid-template-rows 0.38s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .lp-faq__item.is-open .lp-faq__answer-wrap {
          grid-template-rows: 1fr;
        }
        .lp-faq__answer {
          overflow: hidden;
          min-height: 0;
          margin: 0;
          padding: 0 22px 20px;
          font-family: 'Instrument Sans', sans-serif;
          font-size: 0.92rem;
          line-height: 1.7;
          color: var(--lp-text-muted);
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        .lp-faq__item.is-open .lp-faq__answer {
          opacity: 1;
        }
        @media (max-width: 760px) {
          .lp-faq { padding: 70px 5% 60px; }
          .lp-faq__head { flex-direction: column; gap: 20px; margin-bottom: 32px; }
          .lp-faq__grid { grid-template-columns: 1fr; }
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
          width: 520px;
          height: 520px;
          background: radial-gradient(circle, rgba(154, 154, 191, 0.32) 0%, rgba(154, 154, 191, 0) 70%);
          top: -200px;
          left: -120px;
        }
        .lp-footer__glow--2 {
          background: radial-gradient(circle, rgba(7, 7, 78, 0.18) 0%, rgba(7, 7, 78, 0) 70%);
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
          background: rgba(var(--lp-fg), 0.06);
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
          color: var(--lp-text);
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
          background: rgba(var(--lp-fg), 0.06);
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
          color: var(--lp-text);
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
          background: rgba(var(--lp-fg), 0.06);
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
          color: var(--lp-text);
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
          /* connectors removed site-wide (dashed lines + their spacer divs) */
          display: none;
          position: relative;
          width: 100%;
          pointer-events: none;
          overflow: visible;
          background: transparent;
        }
        /* Dashed connector lines removed site-wide — keep the wrapper divs so the section
           spacing (their height + negative margins) is preserved, just hide the SVG. */
        .lp-connector svg { display: none; }
        .lp-connector svg path {
          animation: connectorFlow 1.2s linear infinite;
        }
        /* Light mode: the dashed connector lines (stroke set inline to a light grey) are
           too faint on the lavender bg — CSS overrides the inline stroke with a dark navy. */
        .lp-root[data-theme="light"] .lp-connector svg path {
          stroke: #1c1b4b;
          stroke-opacity: 0.6;
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
          color: var(--lp-text);
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
          background: rgba(var(--lp-fg), 0.06);
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
          background: rgba(var(--lp-fg), 0.06);
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
        /* Light mode polish: solid white quote card (not faint translucent) with a clearer
           shadow, and a slightly deeper accent so the italic line reads well. */
        .lp-root[data-theme="light"] .lp-hook__quote-card {
          background: #ffffff;
          border-color: rgba(28,27,75,0.10);
          box-shadow: 0 18px 46px rgba(7,7,78,0.10);
        }
        .lp-root[data-theme="light"] .lp-hook__quote-text em { color: #7c3aed; }

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
          color: var(--lp-text);
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
          background: rgba(var(--lp-fg), 0.06);
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
          color: var(--lp-text);
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
        /* Light mode: the tile is dark navy but the glyph inherited navy text (invisible).
           Force it white for contrast. */
        .lp-root[data-theme="light"] .lp-step-card__icon,
        .lp-root[data-theme="light"] .lp-step-card__icon svg { color: #ffffff; }

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
          background: rgba(var(--lp-fg),0.06);
          color: #A78BFA;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: background 0.3s ease, transform 0.3s ease;
        }
        .lp-step-card:hover .lp-step-card__arrow {
          background: rgba(167, 139, 250, 0.15);
          color: var(--lp-text);
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
          background: rgba(var(--lp-fg), 0.06);
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
          color: var(--lp-text);
          overflow: visible;
          min-height: 130vh;
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
          background: rgba(var(--lp-fg), 0.06);
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
          /* Shorter than the viewport so the inner pins cleanly to the section end (no
             early-release blank) and there's no empty space below the centered card. */
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
          border: 1px solid rgba(var(--lp-fg), 0.2);
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
          color: var(--lp-text);
          letter-spacing: 0.1em;
          padding: 5px 12px;
          background: #A78BFA;
          border: 1px solid rgba(var(--lp-fg), 0.6);
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
          background: rgba(var(--lp-fg), 0.06);
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
          color: var(--lp-text);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        /* Light mode: dark navy circle but the arrow inherited navy text (invisible) — white it. */
        .lp-root[data-theme="light"] .lp-audit__footer-icon,
        .lp-root[data-theme="light"] .lp-audit__footer-icon svg { color: #ffffff; }
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
          color: var(--lp-text);
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
        /* Light mode: render the heading as a solid, strong navy (no muted/translucent
           look) so it reads clearly on the lavender bg. */
        .lp-root[data-theme="light"] .lp-proof__heading {
          color: #1c1b4b;
          -webkit-text-fill-color: #1c1b4b;
          font-weight: 600;
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
          color: var(--lp-text);
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
          max-width: 1320px;
          margin: 0 auto;
          text-align: center;
        }

        .lp-testimonial__pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 16px;
          background: rgba(var(--lp-fg), 0.06);
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

        /* Carousel wrapper: grid of cards flanked by rotate arrows. */
        .lp-testimonial__carousel {
          position: relative;
          margin-bottom: 56px;
        }
        /* Clips the horizontal slide so the off-screen row never spills out, while
           leaving vertical room for card hover-lift + drop shadows. */
        .lp-testimonial__viewport {
          overflow: hidden;
          padding: 10px 4px 34px;
          margin: -10px -4px -34px;
        }
        /* One flexible track that holds every card; JS sets each card's width and
           translates the whole track by exactly one card so the slide is seamless. */
        .lp-testimonial__grid {
          position: relative;
          display: flex;
          flex-wrap: nowrap;
          gap: 28px;
          text-align: left;
          will-change: transform;
        }
        .lp-testimonial__grid > .lp-tcard { box-sizing: border-box; }
        .lp-testimonial__arrow {
          position: absolute;
          top: 44%;
          transform: translateY(-50%);
          z-index: 6;
          width: 48px;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(var(--lp-fg), 0.08);
          border: 1px solid var(--lp-border);
          color: var(--lp-text);
          cursor: pointer;
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          box-shadow: 0 8px 24px rgba(7, 7, 78, 0.18);
          transition: background 0.2s ease, transform 0.2s ease, color 0.2s ease;
        }
        .lp-testimonial__arrow:hover {
          background: #A78BFA;
          color: #fff;
          transform: translateY(-50%) scale(1.08);
        }
        .lp-testimonial__arrow:active {
          transform: translateY(-50%) scale(0.96);
        }
        .lp-testimonial__arrow--left { left: -62px; }
        .lp-testimonial__arrow--right { right: -62px; }

        /* Sliding chevron — eases back to centre at rest, runs a gentle looping
           nudge in its pointing direction while hovered. */
        .lp-testimonial__arrow svg {
          transition: transform 0.25s ease;
        }
        .lp-testimonial__arrow--left:hover svg {
          animation: lp-arrow-slide-left 0.7s ease-in-out infinite;
        }
        .lp-testimonial__arrow--right:hover svg {
          animation: lp-arrow-slide-right 0.7s ease-in-out infinite;
        }
        @keyframes lp-arrow-slide-left {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(-5px); }
        }
        @keyframes lp-arrow-slide-right {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(5px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .lp-testimonial__arrow--left:hover svg,
          .lp-testimonial__arrow--right:hover svg { animation: none; }
        }

        .lp-tcard {
          position: relative;
          /* Opaque panel: same tint as before, but over a solid page-bg base so a
             card sliding over its neighbour cleanly covers it (no see-through bleed). */
          background: linear-gradient(rgba(var(--lp-fg), 0.06), rgba(var(--lp-fg), 0.06)), var(--lp-page-bg);
          border: 1px solid var(--lp-border);
          border-radius: 22px;
          padding: 40px 24px 36px;
          min-height: 300px;
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
          background: linear-gradient(180deg, rgba(7,7,78,0.2) 0%, rgba(7,7,78,0.1) 100%), var(--lp-page-bg);
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
          color: var(--lp-text);
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

        /* Light mode polish: the translucent navy-tinted cards looked washed out on the
           lavender bg. Give them solid white surfaces, a clearer shadow/border, and a
           slightly deeper purple accent so quotes + metrics read well. Dark mode unchanged. */
        .lp-root[data-theme="light"] .lp-tcard {
          background: #ffffff;
          border-color: rgba(28,27,75,0.10);
          box-shadow: 0 14px 36px rgba(7,7,78,0.10);
        }
        .lp-root[data-theme="light"] .lp-tcard--featured {
          background: linear-gradient(180deg, #ffffff 0%, #f3f1fe 100%);
          border-color: rgba(167,139,250,0.45);
          box-shadow: 0 22px 52px rgba(124,58,237,0.16);
        }
        .lp-root[data-theme="light"] .lp-tcard__quote em,
        .lp-root[data-theme="light"] .lp-tcard__metric-val { color: #7c3aed; }
        .lp-root[data-theme="light"] .lp-tcard__metric {
          background: #f1ecfe;
          border-color: rgba(167,139,250,0.5);
        }

        /* Mid-size screens: step the 5-up row down to 3 before it collapses to 1.
           The max-width lives on the carousel (not the grid) so the flanking arrows
           always sit just outside the cards instead of drifting into the gutter. */
        @media (max-width: 1280px) {
          .lp-testimonial__carousel { max-width: 860px; margin-left: auto; margin-right: auto; }
          .lp-testimonial__grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 1024px) {
          .lp-testimonial__carousel { max-width: 560px; }
          .lp-testimonial__grid { grid-template-columns: 1fr; }
        }
        /* Phones: shrink the arrows and pull them to the edges so they never run off
           the viewport in the tight side padding. */
        @media (max-width: 640px) {
          .lp-testimonial__arrow { width: 40px; height: 40px; }
          .lp-testimonial__arrow--left { left: -8px; }
          .lp-testimonial__arrow--right { right: -8px; }
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
          .lp-steps__grid { grid-template-columns: 1fr; }
          /* Leaderboard: widen the viewport so the (now smaller) rows fit without clipping,
             and re-centre it (the desktop right-shift isn't needed on a stacked mobile view). */
          .lp-logo3d__board { width: 92%; }
          .lp-logo3d__sticky { justify-content: center; padding-right: 0; }
          .lp-step-card__connector { display: none; }
          .lp-step-card { min-height: auto; }

          /* ── Audit section: the desktop scroll-peel deck (280vh tall, sticky inner,
             absolutely-stacked cards moved by scroll) collapses to a plain vertical
             stack on mobile so it doesn't render as a huge empty area with the cards
             pushed off-screen. !important overrides framer-motion's inline transforms. */
          .lp-audit { min-height: auto; padding: 80px 6%; }
          .lp-audit__inner { position: static; top: auto; }
          .lp-audit__grid {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
            min-height: auto;
            margin: 40px auto;
            max-width: 100%;
            perspective: none;
          }
          .lp-audit-card {
            position: static !important;
            transform: none !important;
            width: 100%;
            max-width: 420px;
            min-height: auto;
          }
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
