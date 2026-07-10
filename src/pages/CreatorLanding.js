import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../App';
import {
  ArrowRight,
  Play,
  LogIn,
  Menu,
  X,
  Linkedin,
  Instagram,
  Twitter,
  Youtube,
  ChevronDown,
  Heart,
  Plus,
  MessageCircle,
  Wifi,
  SignalHigh,
  BatteryFull,
  Bell,
  Check,
} from 'lucide-react';
import { motion } from 'framer-motion';

// -- Static content (edit freely) ------------------------------------------

// Brand "logo wall" -- real client/brand logos shipped in /public/logo. Each renders inside a
// light tile (see .cl-brands__logo) so mixed-background logos (transparent, white-bg, dark) all
// read cleanly on the dark strip.
// `dark: true` marks logos whose artwork is black/dark — they'd vanish on the dark strip, so
// only those get flipped to white (see .cl-brands__logo--dark). Colored logos render untouched.
const BRANDS = [
  { name: 'Awfis', img: '/bg/Awfis-new-logo-removebg-preview.png', small: true },
  { name: 'Daisen', img: '/bg/DAISEN-LOGO-PNG-2-1024x1024-removebg-preview.png' },
  { name: 'Sephora', img: '/bg/Sephora-Logo.jpg-removebg-preview.png', dark: true },
  { name: 'Amazon', img: '/bg/amazon-logo-amazon-logo-white-background-vector-format-avaliable-124289859-removebg-preview.png' },
  { name: 'Paavi', img: '/bg/paavi-logo-1-removebg-preview.png' },
  { name: 'Brand', img: '/bg/6b496a50-a54f-4a93-8156-4e1a7a99abe0-removebg-preview.png', dark: true },
  { name: 'Brand', img: '/bg/6e758deba2689e4122853b0b5e079e8e.jpg-removebg-preview.png' },
  { name: 'Brand', img: '/bg/ANI-20241114083006.jpg-removebg-preview.png', dark: true },
  { name: 'Brand', img: '/bg/My-project-2024-04-08T145719.697-removebg-preview.png' },
  { name: 'Brand', img: '/bg/cropped-229x30-1-removebg-preview.png', small: true },
  { name: 'Brand', img: '/bg/cropped-og-1-removebg-preview.png', dark: true, large: true },
  { name: 'Brand', img: '/bg/images__1___1_-removebg-preview.png', dark: true, large: true },
  { name: 'Brand', img: '/bg/images__2___1_-removebg-preview.png', dark: true, large: true },
  { name: 'Brand', img: '/bg/images__3___1_-removebg-preview.png' },
  { name: 'Brand', img: '/bg/images__5_-removebg-preview.png' },
  { name: 'Brand', img: '/bg/logo__1_-removebg-preview.png' },
  { name: 'Brand', img: '/bg/unnamed-removebg-preview.png', dark: true },
];

// Portrait thumbs for the hero gallery row -- local UGC clips from /public/creator.
const GALLERY = [
  { name: 'Abigail', av: ['#7387FF', '#5b21b6'], src: '/creator/video_01.mp4' },
  { name: 'Chelsea', av: ['#818cf8', '#4338ca'], src: '/creator/video_08.mp4' },
  { name: 'Becki', av: ['#fca5a5', '#9d174d'], src: '/creator/video_27.mp4' },
  { name: 'Maya', av: ['#fb7185', '#f43f5e'], src: '/creator/video_28.mp4' },
  { name: 'Lara', av: ['#7dd3fc', '#1d4ed8'], src: '/creator/video_29.mp4' },
  { name: 'Priya', av: ['#a5b4fc', '#4c1d95'], src: '/creator/video_30.mp4' },
];

const CATEGORIES = [
  'Instagram Reels', 'YouTube Shorts', 'B-Rolls', 'Product Launches',
  'Shop Affiliates', 'Creators', 'Instagram Influencers',
  'Amazon Influencers', 'YouTube Influencers', 'Social Media Managers',
];

// Creator testimonial videos -- Cloudinary-hosted (click-to-play with sound). A larger
// width than the muted gallery thumbs since these go full phone-card when tapped.
const TESTIMONIALS = [
  { name: 'Abigail', handle: '@abigailcreates', likes: '328.7K', comments: '578', av: ['#7387FF', '#5b21b6'], src: '/creator/video_01.mp4' },
  { name: 'Chelsea', handle: '@chelsea.ugc',    likes: '124.2K', comments: '341', av: ['#818cf8', '#4338ca'], src: '/creator/video_08.mp4' },
  { name: 'Maya',    handle: '@maya.makes',     likes: '512.9K', comments: '1.2K', av: ['#fb7185', '#f43f5e'], src: '/creator/video_27.mp4' },
  { name: 'Priya',   handle: '@priya.shoots',   likes: '88.4K',  comments: '212', av: ['#a5b4fc', '#4c1d95'], src: '/creator/video_28.mp4' },
  { name: 'Lara',    handle: '@laralovesugc',   likes: '263.1K', comments: '904', av: ['#7dd3fc', '#1d4ed8'], src: '/creator/video_29.mp4' },
];

const FAQS = [
  {
    q: 'Who owns the content created through ugcad.io?',
    a: 'You retain full commercial rights to every piece of content delivered. Once a project is completed and paid, the brand is free to use it across all of its marketing channels.',
  },
  {
    q: 'How quickly will I receive my content?',
    a: 'Most projects are delivered within 5-7 days of the creator receiving the product. Turnaround times are agreed upfront in each brief so there are no surprises.',
  },
  {
    q: 'Can I communicate with creators?',
    a: 'Yes. Our built-in messaging lets you share briefs, give feedback, and align on direction with creators directly -- all in one place.',
  },
  {
    q: 'How do payments work?',
    a: 'Payments are held securely and released to the creator only once you approve the delivered content. Joining is free; a small service fee applies on completed collaborations.',
  },
  {
    q: 'Is my shipping address shared with creators?',
    a: 'Only when a campaign requires the product to be shipped. Your address is shared solely for fulfilment and is never used for any other purpose.',
  },
  {
    q: "What if I'm not happy with the content?",
    a: 'You can request revisions within the agreed scope of the project. If the content still does not meet the brief, our team steps in to make it right.',
  },
];

// ── Global play cap (imperative, NO React state) ────────────────────────────────
// The hero gallery renders the clips ×4 for a seamless loop (~24 <video> elements). Letting
// every on-screen copy decode at once is what made it lag. Cap concurrent playback: a card that
// scrolls in plays if a slot is free, else WAITS (paused, showing its gradient/first frame). When
// a playing card scrolls off it hands its slot to a waiting one. All imperative → no re-renders.
// Far fewer concurrent decodes on phones — 10 simultaneous video decodes is the main hero lag
// on mobile. Desktop keeps the higher cap for a livelier wall.
const MAX_PLAYING_GALLERY =
  (typeof window !== 'undefined' && window.matchMedia?.('(max-width: 768px)').matches) ? 3 : 10;
const _glPlaying = new Set();
const _glWaiting = new Set();
function playGalleryCapped(v) {
  if (_glPlaying.has(v)) return;
  if (_glPlaying.size < MAX_PLAYING_GALLERY) {
    _glWaiting.delete(v);
    _glPlaying.add(v);
    v.muted = true; // guarantee muted so the autoplay policy never rejects play()
    const p = v.play?.();
    if (p && p.catch) p.catch(() => { _glPlaying.delete(v); });
  } else {
    _glWaiting.add(v);
  }
}
function releaseGallery(v) {
  const wasPlaying = _glPlaying.delete(v);
  _glWaiting.delete(v);
  v.pause?.();
  if (wasPlaying) {
    for (const next of _glWaiting) {
      if (next.isConnected) { playGalleryCapped(next); break; }
      _glWaiting.delete(next);
    }
  }
}

// Hero marquee card -- muted autoplay clip. The src is attached only once the card nears the
// viewport (lazy), preload="none" so nothing fetches until it actually plays, and a global cap
// limits how many decode at once — so we never run all ~24 clips simultaneously (perf).
function GalleryCard({ av, src, hidden }) {
  const ref = useRef(null);
  // Attach the src eagerly: there are only 6 unique clips across all 24 cards, so the
  // browser caches them (≈6 downloads), each card buffers its first frame, and the
  // play-cap below still limits how many DECODE/play at once. This fills the wall with
  // real video frames instead of leaving most cards showing only their gradient.
  const [loaded] = useState(true);

  // React's `muted` JSX prop is unreliable at setting the DOM property, so the browser
  // can treat these as un-muted autoplay and BLOCK them (the card then shows only its
  // gradient). Force muted imperatively so muted autoplay is always permitted.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.muted = true;
    el.defaultMuted = true;
  }, []);

  // PLAY on screen / PAUSE off screen — capped + imperative (no setState).
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { if (v.src) playGalleryCapped(v); }
        else releaseGallery(v);
      },
      { rootMargin: '150px', threshold: 0.01 },
    );
    io.observe(v);
    return () => { io.disconnect(); releaseGallery(v); };
  }, [loaded]);

  return (
    <div
      className="cl-gallery__card"
      style={{ background: `linear-gradient(160deg, ${av[0]}, ${av[1]})` }}
      aria-hidden={hidden}
    >
      <video
        ref={ref}
        className="cl-gallery__media"
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        {...(loaded ? { src } : {})}
      />
    </div>
  );
}

// Testimonial card -- styled like a TikTok phone screen; click to play with sound.
// Rendered inside an auto-scrolling marquee, so no scroll-triggered fade (off-screen
// copies must stay visible).
function TestimonialCard({ name, handle, likes, comments, av, src, hidden }) {
  const ref = useRef(null);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      v.muted = false;
      v.play?.().then(() => setPlaying(true)).catch(() => {});
    } else {
      v.pause();
      setPlaying(false);
    }
  };

  // Stop playback (and audio) when the card scrolls out of view.
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && !v.paused) {
          v.pause();
          setPlaying(false);
        }
      },
      { threshold: 0 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);

  return (
    <button
      type="button"
      className={`cl-tcard${playing ? ' cl-tcard--playing' : ''}`}
      onClick={toggle}
      style={{ background: `linear-gradient(160deg, ${av[0]}, ${av[1]})` }}
      aria-label={`${playing ? 'Pause' : 'Play'} ${name}'s video`}
      aria-hidden={hidden}
    >
      <video
        ref={ref}
        className="cl-tcard__media"
        src={src}
        loop
        playsInline
        preload="none"
        onPause={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
      />

      {/* Phone status bar */}
      <div className="cl-tcard__status">
        <span className="cl-tcard__time">9:41</span>
        <span className="cl-tcard__statusicons">
          <SignalHigh size={13} /><Wifi size={13} /><BatteryFull size={17} />
        </span>
      </div>

      {/* TikTok-style feed tabs */}
      <div className="cl-tcard__tabs">
        <span>Following</span>
        <span className="cl-tcard__tab--active">For You</span>
      </div>

      {/* Center play button */}
      {!playing && (
        <span className="cl-tcard__play"><Play size={22} fill="#1f2937" stroke="none" /></span>
      )}

      {/* Right action rail */}
      <div className="cl-tcard__rail">
        <span className="cl-tcard__avatar" style={{ background: `linear-gradient(135deg, ${av[0]}, ${av[1]})` }}>
          <span className="cl-tcard__follow"><Plus size={11} /></span>
        </span>
        <span className="cl-tcard__action"><Heart size={26} fill="#fff" stroke="none" /><b>{likes}</b></span>
        <span className="cl-tcard__action"><MessageCircle size={26} fill="#fff" stroke="none" /><b>{comments}</b></span>
      </div>

      {/* Handle */}
      <span className="cl-tcard__handle">{handle}</span>
    </button>
  );
}

export default function CreatorLanding() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState(-1);
  // Mobile flag — used to auto-play the product video (no hover on touch devices).
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  // Theme is global now (controlled from the home page); this page just follows it.
  const { theme } = useTheme();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Every CTA on this page drives the visitor to the main signup form (creator role).
  const handleJoin = () => {
    navigate('/auth?mode=signup&role=creator');
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
      {/* -- Animated background blobs ------------------------------------ */}
      <div className="cl-bg" aria-hidden="true">
        <div className="cl-blob cl-blob--1" />
        <div className="cl-blob cl-blob--2" />
        <div className="cl-blob cl-blob--3" />
      </div>

      {/* -- Top bar: brand logo ----------------------------------------- */}
      <header className={`cl-nav${scrolled ? ' cl-nav--scrolled' : ''}`}>
        <div className="cl-nav__inner">
          <button className="cl-brand" onClick={() => navigate('/')} aria-label="UGCad.io home">
            <img src="/newlogo.png" alt="UGCad.io" className="cl-brand__logo" />
          </button>
        </div>
      </header>

      {/* -- Hero --------------------------------------------------------- */}
      <section className="cl-hero">
        <div className="cl-hero__main">
          <motion.h1
            className="cl-hero__title"
            variants={fadeUp} initial="hidden" animate="visible" custom={0}
          >
            Love <span className="cl-hero__pill">creating</span> content?<br />
            Get paid for it
          </motion.h1>

          <motion.p
            className="cl-hero__sub"
            variants={fadeUp} initial="hidden" animate="visible" custom={1}
          >
            Earn for shooting authentic images and videos for brands looking for real people.
          </motion.p>

          <motion.div
            className="cl-hero__ctas"
            variants={fadeUp} initial="hidden" animate="visible" custom={2}
          >
            <button className="cl-btn-primary cl-btn-primary--lg" onClick={handleJoin}>
              Get started &mdash; <em>it&apos;s free</em>
            </button>
          </motion.div>
        </div>

        {/* -- Creator gallery row ------------------------------------------- */}
        <motion.div
          className="cl-gallery"
          variants={fadeUp} initial="hidden" animate="visible" custom={3}
        >
          <div className="cl-gallery__track">
            {/* Repeat the 6-card set 4x. The marquee animates translateX(-50%), so the
                first half (2 sets) must be wider than the viewport or a gap appears at
                the loop seam on wide screens. Second half is an aria-hidden duplicate. */}
            {[...GALLERY, ...GALLERY, ...GALLERY, ...GALLERY].map(({ av, src }, i) => (
              <GalleryCard key={i} av={av} src={src} hidden={i >= GALLERY.length * 2} />
            ))}
          </div>
        </motion.div>

      </section>

      {/* -- Categories + brands -- sit just below the hero fold ------------ */}
      <section className="cl-belowfold">
        {/* -- Category pills ------------------------------------------------ */}
        <motion.div
          className="cl-cats"
          variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.4 }} custom={0}
        >
          <div className="cl-cats__track">
            {[...CATEGORIES, ...CATEGORIES].map((c, i) => (
              <span key={i} className="cl-cat" aria-hidden={i >= CATEGORIES.length}>{c}</span>
            ))}
          </div>
        </motion.div>

        {/* -- Brand strip --------------------------------------------------- */}
        <motion.div
          className="cl-brands"
          variants={fadeUp} initial="hidden" whileInView="visible" viewport={{ once: true, amount: 0.4 }} custom={1}
        >
          <div className="cl-brands__row">
            {(() => { const mid = Math.ceil(BRANDS.length / 2); return [BRANDS.slice(0, mid), BRANDS.slice(mid)]; })().map((line, li) => (
              <div key={li} className={`cl-brands__line${li === 0 ? ' cl-brands__line--top' : ' cl-brands__line--bottom'}`}>
                {/* Items are duplicated so the mobile marquee loops seamlessly (translateX -50%).
                    The second set is hidden on desktop via .cl-brands__logo--dup. */}
                {[...line, ...line].map(({ name, img, dark, small, large }, i) => (
                  <span
                    key={`${name}-${i}`}
                    className={`cl-brands__logo${dark ? ' cl-brands__logo--dark' : ''}${small ? ' cl-brands__logo--small' : ''}${large ? ' cl-brands__logo--large' : ''}${i >= line.length ? ' cl-brands__logo--dup' : ''}`}
                    aria-hidden={i >= line.length}
                  >
                    <img
                      className="cl-brands__icon"
                      src={img}
                      alt={name}
                      loading="lazy"
                      onError={(e) => { const t = e.currentTarget.closest('.cl-brands__logo'); if (t) t.style.display = 'none'; }}
                    />
                  </span>
                ))}
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* -- How it works ------------------------------------------------- */}
      <section id="how" className="cl-section">
        <motion.div
          className="cl-section__head"
          variants={fadeUp} initial="hidden" animate="visible"
        >
          <span className="cl-joinpill">How it works</span>
          <h2 className="cl-section__title">Start earning in <span className="cl-hi">3 simple steps</span></h2>
        </motion.div>

        <div className="cl-hiw">
          {/* Step 01 -- Pick a job */}
          <motion.div
            className="cl-hiw__card cl-hiw__card--filled"
            variants={fadeUp} initial="hidden" animate="visible" custom={0}
          >
            <span className="cl-hiw__num">01</span>
            <h3 className="cl-hiw__title">Pick a job</h3>
            <p className="cl-hiw__text">
              Choose brands and products that really <em className="cl-hiw__hi">align</em> with
              your personality and preferences.
            </p>
            <div className="cl-hiw__visual cl-hiw__visual--phone">
              <div className="cl-hiw__phone">
                <div className="cl-hiw__phonebar">
                  <span className="cl-hiw__time">9:41</span>
                  <span className="cl-hiw__phoneicons">
                    <MessageCircle size={17} />
                    <Bell size={17} />
                    <span className="cl-hiw__avatar">W</span>
                  </span>
                </div>
                <div className="cl-hiw__phonepanel">
                  <div className="cl-hiw__choosehead">Choose brand</div>
                  <div className="cl-hiw__brandgrid">
                    <span className="cl-hiw__brandcard cl-hiw__brandcard--on cl-bc cl-bc--boat">boAt<Check size={11} /></span>
                    <span className="cl-hiw__brandcard cl-bc cl-bc--mivi">Mivi</span>
                    <span className="cl-hiw__brandcard cl-bc cl-bc--noise">noise</span>
                    <span className="cl-hiw__brandcard cl-bc cl-bc--ptron">pTron</span>
                  </div>
                </div>
              </div>
              {/* Card 2 â€” normal product card */}
              <div
                className="cl-hiw__prodfront"
                onMouseEnter={(e) => { const v = e.currentTarget.querySelector('video'); if (v) v.play(); }}
                onMouseLeave={(e) => { const v = e.currentTarget.querySelector('video'); if (v) { v.pause(); v.currentTime = 0; } }}
              >
                <div className="cl-hiw__prodfront-img">
                  <video
                    className="cl-hiw__prodfront-video"
                    src="/head.mp4"
                    muted
                    loop
                    playsInline
                    autoPlay={isMobile}
                    preload="metadata"
                  />
                </div>
                <span className="cl-hiw__prodfront-cap">Brand Name</span>
                <span className="cl-hiw__prodfront-brand">boAt</span>
              </div>
            </div>
          </motion.div>

          {/* Step 02 -- Create content */}
          <motion.div
            className="cl-hiw__card cl-hiw__card--light"
            variants={fadeUp} initial="hidden" animate="visible" custom={1}
          >
            <span className="cl-hiw__num">02</span>
            <h3 className="cl-hiw__title">Create content</h3>
            <p className="cl-hiw__text">
              Show off your <em className="cl-hiw__hi cl-hiw__hi--alt">creativity</em> while creating
              content. Feeling ambitious? Add extra photos or videos for higher potential earnings.
            </p>
            <div className="cl-hiw__visual cl-hiw__visual--create">
              <div className="cl-hiw__chip cl-hiw__chip--likes">
                <Heart size={13} fill="currentColor" /> 12.4K
              </div>
              <div className="cl-hiw__chip cl-hiw__chip--comments">
                <MessageCircle size={13} /> 578
              </div>
              <div className="cl-hiw__thumb" />
            </div>
          </motion.div>

          {/* Step 03 -- Get paid (wide) */}
          <motion.div
            className="cl-hiw__card cl-hiw__card--wide cl-hiw__card--light"
            variants={fadeUp} initial="hidden" animate="visible" custom={2}
          >
            <div className="cl-hiw__wideleft">
              <span className="cl-hiw__num">03</span>
              <h3 className="cl-hiw__title">Get paid</h3>
              <p className="cl-hiw__text">
                By adhering to strict timelines and minimizing revisions, you can efficiently{' '}
                <em className="cl-hiw__hi cl-hiw__hi--alt2">scale your growth</em> as a creator.
              </p>
              <button className="cl-btn-primary cl-hiw__cta" onClick={handleJoin}>
                Get started &mdash; it&apos;s free
              </button>
            </div>
            <div className="cl-hiw__visual cl-hiw__visual--paid">
              <div className="cl-hiw__paid">
                <div className="cl-hiw__check">&#10003;</div>
                <div className="cl-hiw__paidh">WooHoo! Job Completed</div>
                <div className="cl-hiw__paidrow cl-hiw__paidrow--prod">
                  <img className="cl-hiw__paidimg" src="/ear.webp" alt="Earbuds" />
                  <span>Noise Canceling<br />Earbuds</span>
                </div>
                <div className="cl-hiw__paidrow cl-hiw__paidrow--bold"><span>Product value</span><b>&#8377;2699</b></div>
                <div className="cl-hiw__paidline" />
                <div className="cl-hiw__paidrow"><span style={{ color: '#000000' }}>Earn on content</span><b>&#8377;1000</b></div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* -- Hear from Our Creators --------------------------------------- */}
      <section className="cl-section">
        <motion.div
          className="cl-section__head"
          variants={fadeUp} initial="hidden" animate="visible"
        >
          <h2 className="cl-section__title">Hear from Our <span className="cl-hi">Creators</span></h2>
          <p className="cl-section__sub">
            Discover how UGCad has transformed the journey of our creators, helping them
            achieve success and grow their influence.
          </p>
        </motion.div>

        <div className="cl-testimarq">
          <div className="cl-testimarq__track">
            {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
              <TestimonialCard key={i} {...t} hidden={i >= TESTIMONIALS.length} />
            ))}
          </div>
        </div>
      </section>

      {/* -- FAQ ---------------------------------------------------------- */}
      <section id="faq" className="cl-section">
        <motion.div
          className="cl-faq__head"
          variants={fadeUp} initial="hidden" animate="visible"
        >
          <h2 className="cl-faq__title">Frequently <em>Asked</em> Questions</h2>
          <p className="cl-faq__intro">
            Here are the answers to the most frequently asked questions we encounter with
            regards to our services. For further assistance, feel free to reach out directly to
            our team.
          </p>
        </motion.div>

        <div className="cl-faq">
          {FAQS.map(({ q, a }, i) => {
            const open = openFaq === i;
            return (
              <div key={q} className={`cl-faq__item${open ? ' cl-faq__item--open' : ''}`}>
                <button className="cl-faq__q" onClick={() => setOpenFaq(open ? -1 : i)}>
                  <span>{q}</span>
                  <ChevronDown size={18} className="cl-faq__chev" />
                </button>
                {open && <p className="cl-faq__a">{a}</p>}
              </div>
            );
          })}
        </div>

        <div className="cl-faq__cta">
          <button className="cl-btn-primary" onClick={handleJoin}>
            Get started &mdash; it&apos;s free <ArrowRight size={16} />
          </button>
        </div>
      </section>

      {/* -- Footer (matches home page) ----------------------------------- */}
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
                <img src="/newlogo.png" alt="UGCad" className="lp-footer__logo" />
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
            <a href="#top" className="lp-footer__top-link" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              Back to top <ArrowRight size={14} style={{ transform: 'rotate(-90deg)' }} />
            </a>
          </div>
        </div>
      </footer>

      {/* -- Styles ------------------------------------------------------- */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Readex+Pro:wght@400;500;600;700&display=swap');

        /* ── Footer (ported from home page; mapped onto this page's theme tokens) ── */
        .cl-root .lp-footer {
          /* map the home footer's --lp-* vars onto this page's --cl-* theme so it
             matches the home layout while blending with the creator page colours */
          --lp-fg: var(--cl-fg);
          --lp-ink: var(--cl-text);
          --lp-text: var(--cl-text);
          --lp-text-muted: rgba(var(--cl-fg), 0.6);
          --lp-border: rgba(var(--cl-fg), 0.1);
          --lp-maxw: 1280px;
          position: relative;
          background: transparent;
          color: var(--lp-ink);
          padding: 90px 8% 30px;
          overflow: hidden;
          border-top: 1px solid var(--lp-border);
        }
        .cl-root .lp-footer__glow {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
          width: 520px;
          height: 520px;
          background: radial-gradient(circle, rgba(154, 154, 191, 0.32) 0%, rgba(154, 154, 191, 0) 70%);
          top: -200px;
          left: -120px;
        }
        .cl-root .lp-footer__glow--2 {
          background: radial-gradient(circle, rgba(109, 74, 240, 0.18) 0%, rgba(109, 74, 240, 0) 70%);
          width: 420px;
          height: 420px;
          top: auto;
          left: auto;
          bottom: -180px;
          right: -80px;
        }
        .cl-root .lp-footer__inner {
          position: relative;
          z-index: 2;
          max-width: var(--lp-maxw);
          margin: 0 auto;
        }
        .cl-root .lp-footer__statement {
          padding-bottom: 56px;
          margin-bottom: 56px;
          border-bottom: 1px solid var(--lp-border);
          text-align: center;
        }
        .cl-root .lp-footer__statement-eyebrow {
          font-family: var(--font-body);
          font-size: 0.78rem;
          font-weight: 500;
          color: var(--lp-text-muted);
          letter-spacing: 0.16em;
          text-transform: uppercase;
          font-style: italic;
          margin: 0 0 16px 0;
        }
        .cl-root .lp-footer__statement-line {
          font-family: var(--font-head);
          font-size: var(--fs-h2);
          font-weight: var(--fw-head);
          color: var(--lp-ink);
          line-height: 1.3;
          letter-spacing: -0.03em;
          margin: 0 auto;
          max-width: 820px;
        }
        .cl-root .lp-footer__statement-accent {
          color: var(--cl-purple);
          font-style: italic;
          position: relative;
        }
        .cl-root .lp-footer__statement-accent::after {
          content: '';
          position: absolute;
          bottom: -2px;
          left: 0;
          width: 100%;
          height: 5px;
          background: linear-gradient(90deg, var(--cl-purple), var(--cl-purple-deep));
          border-radius: 4px;
          opacity: 0.55;
        }
        .cl-root .lp-footer__main {
          display: grid;
          grid-template-columns: 1.2fr 2fr;
          gap: 60px;
          padding-bottom: 50px;
          margin-bottom: 24px;
          border-bottom: 1px solid var(--lp-border);
        }
        .cl-root .lp-footer__brand { max-width: 340px; }
        .cl-root .lp-footer__logo-wrap { display: inline-flex; margin-bottom: 18px; }
        .cl-root .lp-footer__logo { height: 80px; width: auto; display: block; }
        .cl-root .lp-footer__tagline {
          font-family: var(--font-body);
          font-size: 0.95rem;
          color: var(--lp-text-muted);
          line-height: 1.5;
          letter-spacing: -0.015em;
          margin: 0 0 24px 0;
          max-width: 280px;
        }
        .cl-root .lp-footer__socials { display: flex; gap: 8px; }
        .cl-root .lp-footer__social-btn {
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
        .cl-root .lp-footer__social-btn:hover {
          background: rgba(109, 74, 240, 0.15);
          color: var(--lp-text);
          border-color: var(--cl-purple);
          transform: translateY(-2px);
        }
        .cl-root .lp-footer__links {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 40px;
        }
        .cl-root .lp-footer__col { min-width: 0; }
        .cl-root .lp-footer__heading {
          font-family: var(--font-head);
          font-size: var(--fs-h3);
          font-weight: var(--fw-head);
          color: var(--lp-text);
          margin: 0 0 16px 0;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .cl-root .lp-footer__list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .cl-root .lp-footer__list li {
          font-family: var(--font-body);
          font-size: 0.92rem;
          line-height: 1.4;
        }
        .cl-root .lp-footer__list a {
          color: rgba(var(--lp-fg), 0.5);
          text-decoration: none;
          transition: color 0.18s ease;
          letter-spacing: -0.01em;
          font-weight: 500;
        }
        .cl-root .lp-footer__list a:hover { color: var(--cl-purple); }
        .cl-root .lp-footer__strip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          flex-wrap: wrap;
          padding-top: 24px;
        }
        .cl-root .lp-footer__copyright {
          font-family: var(--font-body);
          font-size: 0.85rem;
          color: var(--lp-text-muted);
          letter-spacing: -0.01em;
        }
        .cl-root .lp-footer__top-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          background: rgba(var(--lp-fg), 0.06);
          border: 1px solid var(--lp-border);
          border-radius: 100px;
          color: var(--lp-text);
          font-family: var(--font-body);
          font-size: 0.82rem;
          font-weight: 500;
          letter-spacing: -0.01em;
          text-decoration: none;
          transition: all 0.22s ease;
        }
        .cl-root .lp-footer__top-link:hover {
          background: rgba(109, 74, 240, 0.15);
          color: var(--lp-text);
          border-color: var(--cl-purple);
        }
        @media (max-width: 880px) {
          .cl-root .lp-footer { padding: 70px 6% 24px; }
          .cl-root .lp-footer__main { grid-template-columns: 1fr; gap: 40px; }
          .cl-root .lp-footer__links { grid-template-columns: repeat(3, 1fr); gap: 20px; }
        }
        @media (max-width: 600px) {
          .cl-root .lp-footer__statement { padding-bottom: 36px; margin-bottom: 36px; }
          .cl-root .lp-footer__links { grid-template-columns: 1fr 1fr; gap: 24px; }
          .cl-root .lp-footer__strip { justify-content: center; text-align: center; }
          .cl-root .lp-footer__col { text-align: left; }
        }

        .cl-root {
          /* Brand type: Readex Pro (Medium/Bold) for headings, Just Sans for body.
             Just Sans is a licensed font â€” self-host it or load an Adobe Fonts kit and
             it takes over automatically; until then it falls back to Instrument Sans. */
          --cl-font-head: 'Readex Pro', 'Instrument Sans', system-ui, sans-serif;
          --cl-font-body: 'Just Sans', 'Instrument Sans', 'Inter', system-ui, sans-serif;
          /* -- LIGHT theme (default) -- */
          --cl-purple: #4f63e6;          /* accent -- deepened so it reads on light */
          --cl-purple-deep: #3d51d6;
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
          font-family: var(--cl-font-body);
          position: relative;
          overflow-x: hidden;
          transition: background 0.3s ease, color 0.3s ease;
        }
        /* Headings use the primary typeface (Readex Pro). */
        .cl-root h1, .cl-root h2, .cl-root h3, .cl-root h4,
        .cl-root .cl-hero__title, .cl-root .cl-section__title, .cl-root .cl-faq__title,
        .cl-root .cl-hiw__title {
          font-family: var(--cl-font-head);
        }
        /* -- DARK theme -- */
        .cl-root[data-theme="dark"] {
          --cl-purple: #7387FF;
          --cl-purple-deep: #7387FF;
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
        .cl-btn-primary, .cl-btn-signup, .cl-joinpill,
        .cl-hiw__hi, .cl-vid__play { color: #fff !important; }

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
        /* Match the Landing navbar logo size: a tall stacked lockup that overflows the fixed bar. */
        .cl-brand__logo { height: 184px; width: auto; flex: none; display: block;
          margin-left: -34px; transform: translateY(-4px); }
        /* Light theme: recolour the navy logo to the brand purple (dark theme unchanged). */
        .cl-root:not([data-theme="dark"]) .cl-brand__logo {
          filter: brightness(0) saturate(100%) invert(29%) sepia(95%) saturate(2462%)
            hue-rotate(249deg) brightness(97%) contrast(94%);
        }
        .cl-brand__mark { width: 22px; height: 22px; border-radius: 6px;
          background: linear-gradient(135deg, #7387FF, #7387FF);
          box-shadow: 0 4px 14px rgba(115,135,255,0.5); }
        .cl-brand__name { font-size: 1.25rem; font-weight: 700; letter-spacing: -0.01em; }
        .cl-brand__name-2 { font-weight: 500; color: rgba(var(--cl-fg),0.7) !important; }

        /* Navbar */
        .cl-nav { position: fixed; top: 0; left: 0; right: 0; z-index: 1000; padding: 18px 6%; transition: all 0.3s ease; }
        .cl-nav--scrolled { padding: 12px 6%; background: var(--cl-nav-bg);
          backdrop-filter: blur(14px); border-bottom: 1px solid rgba(var(--cl-fg),0.07); }
        /* FIXED bar height so the bigger logo overflows it instead of growing the bar (matches Landing). */
        .cl-nav__inner { display: flex; align-items: center; gap: 30px; max-width: 1320px; margin: 0 auto; height: 56px; }
        .cl-nav__links { display: flex; align-items: center; gap: 26px; }
        .cl-navlink { display: inline-flex; align-items: center; gap: 4px; font-size: 0.94rem; font-weight: 500;
          color: rgba(var(--cl-fg),0.82) !important; text-decoration: none; background: none; border: none;
          cursor: pointer; transition: color 0.2s; }
        .cl-navlink:hover { color: var(--cl-purple) !important; }
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
        /* "How it works" section runs wider so the two step cards are large like the reference. */
        #how.cl-section { max-width: 1440px; }
        .cl-section--narrow { max-width: 920px; }
        .cl-section__head { text-align: center; max-width: 760px; margin: 0 auto 52px; }
        .cl-joinpill { display: inline-block; padding: 12px 30px; border-radius: 999px; font-size: 1.2rem;
          font-weight: 600; margin-bottom: 18px; background: var(--cl-purple);
          box-shadow: none; }
        .cl-section__title { font-size: var(--fs-h1); font-weight: var(--fw-head); line-height: 1.12; margin: 0 0 16px; }
        .cl-section__sub { font-size: 1.05rem; line-height: 1.65; color: rgba(var(--cl-fg),0.62) !important; margin: 0; }

        /* Hero */
        .cl-hero { position: relative; z-index: 1; max-width: 1100px; margin: 0 auto;
          /* min-height (not a hard height) so on shorter web screens the hero grows to fit the
             tall video gallery instead of overflowing — which kept the below-fold category pills
             from overlapping the videos. Phones (≤480px) override this to height:auto below. */
          min-height: 100vh; display: flex; flex-direction: column; justify-content: flex-start;
          gap: clamp(10px, 2vh, 22px); padding: clamp(120px, 16vh, 180px) 6% 0; }
        .cl-hero__main { display: flex; flex-direction: column; justify-content: center;
          align-items: center; text-align: center; flex-shrink: 0; }
        .cl-hero__title { font-size: var(--fs-hero); font-weight: var(--fw-head); line-height: 1.06;
          letter-spacing: -0.02em; margin: 0 0 clamp(8px, 1.3vh, 16px); }
        /* Web only: smaller hero than the full --fs-hero display size. Phones (≤480px) keep
           the token size; everything above the phone breakpoint gets the reduced clamp. */
        @media (min-width: 481px) {
          .cl-hero__title { font-size: clamp(2.6rem, 4.5vw, 3.6rem); }
        }
        /* Phones (≤480px): keep the hero to exactly two lines by stopping the
           first line ("Love creating content?") from wrapping. */
        @media (max-width: 480px) {
          .cl-hero__title { font-size: clamp(1.4rem, 6.2vw, 2.3rem); white-space: nowrap;
            margin-bottom: clamp(16px, 3vh, 28px); }
        }
        .cl-hero__sub { font-size: clamp(0.98rem, 1.6vw, 1.16rem); line-height: 1.55;
          color: rgba(var(--cl-fg),0.68) !important; max-width: 560px; margin: 0 auto clamp(36px, 6vh, 64px); }
        .cl-hero__ctas { display: flex; justify-content: center; margin-bottom: clamp(20px, 4vh, 48px); }
        .cl-hero__login { margin: clamp(7px, 1.2vh, 14px) 0 0; font-size: 0.93rem; color: rgba(var(--cl-fg),0.6) !important; }
        .cl-hero__login-link { background: none; border: none; padding: 0; cursor: pointer; font-size: inherit;
          font-weight: 600; color: var(--cl-purple) !important; }
        .cl-hero__login-link:hover { color: #aeb9ff !important; }
        .cl-btn-primary { display: inline-flex; align-items: center; gap: 9px; padding: 14px 28px; border-radius: 20px;
          border: none; background: linear-gradient(120deg, #7387FF, #4f63e6); font-size: 1rem; font-weight: 600;
          cursor: pointer; box-shadow: none; transition: all 0.2s; }
        .cl-btn-primary:hover { transform: translateY(-2px); box-shadow: none; }
        .cl-btn-primary--lg { padding: 16px 40px; font-size: 1.08rem; border-radius: 999px; }

        /* Below-the-fold band -- categories + brand logos under the hero */
        .cl-belowfold { position: relative; z-index: 1; max-width: 1100px; margin: 0 auto;
          display: flex; flex-direction: column; gap: 30px; padding: 48px 6% 24px; }

        /* Brand strip -- full grid of brand names */
        .cl-brands { position: relative; z-index: 1; padding: 4px 0;
          width: 100vw; margin-left: calc(50% - 50vw); margin-right: calc(50% - 50vw); }
        .cl-brands__row { display: flex; flex-direction: column; align-items: center; gap: 28px;
          max-width: 1500px; margin: 0 auto; padding: 72px 3% 40px; }
        .cl-brands__line { display: flex; flex-wrap: nowrap; align-items: center; justify-content: space-evenly; gap: 20px; width: 100%; }
        .cl-brands__line--bottom { justify-content: center; gap: 36px; }
        /* Background-removed (transparent) client logos sit directly on the dark strip — no tile.
           Only black/dark artwork (tagged .cl-brands__logo--dark) is flipped to white so it reads;
           colored logos render as-is. */
        .cl-brands__logo { display: inline-flex; align-items: center; justify-content: center;
          flex-shrink: 0; height: 78px; padding: 0 12px; opacity: 0.9;
          transition: opacity 0.2s, transform 0.25s ease; }
        .cl-brands__icon { height: 62px; width: auto; max-width: 220px; object-fit: contain; flex-shrink: 0; }
        /* Oversized wordmarks (awfis, KUKU FM) scaled down to sit in line with the rest. */
        .cl-brands__logo--small .cl-brands__icon { height: 34px; }
        /* Undersized wordmarks (UBALANCE, Cristello, EULER) scaled up to match the rest. */
        .cl-brands__logo--large .cl-brands__icon { height: 82px; max-width: 260px; }
        .cl-brands__logo--dark .cl-brands__icon { filter: brightness(0) invert(1); }
        .cl-brands__logo:hover { opacity: 1; transform: translateY(-3px); }
        /* Duplicate logos exist only to feed the mobile marquee loop -- hidden on desktop. */
        .cl-brands__logo--dup { display: none; }
        @media (prefers-reduced-motion: reduce) { .cl-brands__line { animation: none !important; } }

        /* Hero -- highlighted word pill */
        .cl-hero__pill { display: inline-block; padding: 0.05em 0.4em; border-radius: 16px;
          background: linear-gradient(120deg, var(--cl-purple), var(--cl-purple-deep));
          color: #fff !important; transform: rotate(-1.5deg); box-shadow: 0 10px 28px rgba(115,135,255,0.4); }
        .cl-btn-primary em { font-style: italic; font-weight: 500; opacity: 0.92; }

        /* Hero -- auto-scrolling creator gallery (full-bleed to viewport edges) */
        .cl-gallery { position: relative; z-index: 1; overflow: hidden; align-self: stretch;
          flex: 0 0 auto; height: clamp(260px, 44vh, 440px); padding-bottom: clamp(16px, 3vh, 34px);
          width: 100vw; margin-left: calc(50% - 50vw); margin-right: calc(50% - 50vw);
          -webkit-mask-image: linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent);
          mask-image: linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent); }
        .cl-gallery__track { display: flex; align-items: stretch; gap: 14px; height: 100%; width: max-content;
          animation: clMarquee 38s linear infinite; will-change: transform; }
        .cl-gallery:hover .cl-gallery__track { animation-play-state: paused; }
        .cl-gallery__card { position: relative; flex-shrink: 0; height: 100%; width: auto;
          aspect-ratio: 10 / 16; border-radius: 18px; overflow: hidden; display: flex; align-items: flex-end;
          justify-content: center; padding: 16px; box-shadow: 0 14px 36px rgba(7,7,78,0.32); }
        .cl-gallery__media { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .cl-gallery__name { position: relative; font-size: 0.74rem; font-weight: 600; color: #fff !important;
          text-shadow: 0 1px 6px rgba(0,0,0,0.4); }
        @keyframes clMarquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @media (prefers-reduced-motion: reduce) { .cl-gallery__track { animation: none; } }

        /* Hero -- category pills (single-line marquee scrolling right, full-bleed) */
        .cl-cats { position: relative; z-index: 1; overflow: hidden; align-self: stretch;
          width: 100vw; margin-left: calc(50% - 50vw); margin-right: calc(50% - 50vw);
          -webkit-mask-image: linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent);
          mask-image: linear-gradient(90deg, transparent, #000 4%, #000 96%, transparent); }
        .cl-cats__track { display: flex; flex-wrap: nowrap; gap: 8px; width: max-content;
          animation: clMarqueeRight 34s linear infinite; will-change: transform; }
        .cl-cats:hover .cl-cats__track { animation-play-state: paused; }
        .cl-cat { flex-shrink: 0; white-space: nowrap; padding: 6px 14px; border-radius: 999px;
          font-size: 0.82rem; font-weight: 500; color: rgba(var(--cl-fg),0.72) !important;
          border: 1px solid rgba(var(--cl-fg),0.16); background: rgba(var(--cl-fg),0.04); transition: all 0.2s; }
        .cl-cat:hover { border-color: rgba(115,135,255,0.45); color: var(--cl-purple) !important;
          background: rgba(115,135,255,0.08); }
        @keyframes clMarqueeRight { from { transform: translateX(-50%); } to { transform: translateX(0); } }
        @media (prefers-reduced-motion: reduce) { .cl-cats__track { animation: none; } }


        /* Community videos */
        .cl-community { display: grid; grid-template-columns: repeat(6, 1fr); gap: 18px; }

        /* Testimonials -- slow auto-scrolling marquee of TikTok phone-screen cards */
        .cl-testimarq { position: relative; width: 100vw; left: 50%; margin-left: -50vw; overflow: hidden;
          -webkit-mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
          mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent); }
        .cl-testimarq__track { display: flex; width: max-content; gap: 26px; padding: 8px 13px;
          animation: clMarquee 80s linear infinite; will-change: transform; }
        .cl-testimarq:hover .cl-testimarq__track { animation-play-state: paused; }
        .cl-tcard { position: relative; flex-shrink: 0; height: clamp(480px, 64vh, 660px); width: auto;
          aspect-ratio: 9 / 19.5; border-radius: 26px; overflow: hidden;
          padding: 0; border: 1px solid rgba(255,255,255,0.12); cursor: pointer; display: block;
          box-shadow: 0 18px 44px rgba(7,7,78,0.45); color: #fff; }
        .cl-tcard__media { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        /* Top + bottom scrims so the white chrome stays legible over any frame */
        .cl-tcard::before, .cl-tcard::after { content: ''; position: absolute; left: 0; right: 0; z-index: 1;
          pointer-events: none; }
        .cl-tcard::before { top: 0; height: 30%; background: linear-gradient(180deg, rgba(0,0,0,0.45), transparent); }
        .cl-tcard::after { bottom: 0; height: 38%; background: linear-gradient(0deg, rgba(0,0,0,0.5), transparent); }

        .cl-tcard__status { position: absolute; top: 11px; left: 14px; right: 14px; z-index: 2;
          display: flex; align-items: center; justify-content: space-between; font-size: 0.72rem; font-weight: 700; }
        .cl-tcard__statusicons { display: flex; align-items: center; gap: 4px; }
        .cl-tcard__tabs { position: absolute; top: 34px; left: 0; right: 0; z-index: 2;
          display: flex; align-items: center; justify-content: center; gap: 16px; font-size: 0.8rem; font-weight: 600;
          color: rgba(255,255,255,0.6); }
        .cl-tcard__tab--active { color: #fff; position: relative; }
        .cl-tcard__tab--active::after { content: ''; position: absolute; left: 50%; bottom: -6px; transform: translateX(-50%);
          width: 18px; height: 2px; border-radius: 2px; background: #fff; }

        .cl-tcard__play { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); z-index: 2;
          width: 52px; height: 52px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
          background: rgba(255,255,255,0.92); box-shadow: 0 4px 14px rgba(0,0,0,0.25); padding-left: 3px;
          transition: transform 0.2s, opacity 0.2s; }
        .cl-tcard:hover .cl-tcard__play { transform: translate(-50%,-50%) scale(1.06); }

        .cl-tcard__rail { position: absolute; right: 9px; bottom: 16px; z-index: 2; display: flex;
          flex-direction: column; align-items: center; gap: 16px; }
        .cl-tcard__avatar { position: relative; width: 34px; height: 34px; border-radius: 50%;
          border: 1.5px solid #fff; margin-bottom: 4px; }
        .cl-tcard__follow { position: absolute; bottom: -7px; left: 50%; transform: translateX(-50%);
          width: 17px; height: 17px; border-radius: 50%; background: #fe2c55; color: #fff;
          display: flex; align-items: center; justify-content: center; }
        .cl-tcard__action { display: flex; flex-direction: column; align-items: center; gap: 3px;
          font-size: 0.68rem; font-weight: 700; color: #fff !important;
          filter: drop-shadow(0 1px 3px rgba(0,0,0,0.4)); }
        .cl-tcard__handle { position: absolute; left: 14px; bottom: 18px; z-index: 2; font-size: 0.78rem;
          font-weight: 700; text-shadow: 0 1px 4px rgba(0,0,0,0.5); }

        /* How it works -- bento steps */
        .cl-hiw { display: grid; grid-template-columns: 1fr 1fr; gap: 26px; max-width: 1640px; margin: 0 auto; }
        .cl-hiw__card { position: relative; overflow: hidden; border-radius: 24px; padding: 32px 32px 0;
          min-height: 500px; display: flex; flex-direction: column;
          border: 1px solid rgba(var(--cl-fg),0.1); background: rgba(var(--cl-fg),0.03); }
        /* Card 1 — solid brand-purple fill with white text. */
        .cl-hiw__card--filled { background: #9b83f6; border-color: transparent; }
        .cl-hiw__card--filled .cl-hiw__title { color: #fff !important; }
        .cl-hiw__card--filled .cl-hiw__num { color: #fff !important; opacity: 0.85; }
        .cl-hiw__card--filled .cl-hiw__text { color: rgba(255,255,255,0.85) !important; }
        .cl-hiw__card--filled .cl-hiw__hi { background: #fff; color: var(--cl-purple) !important; }
        /* Soften the heavy navy drop-shadows so they don't read as a dark patch on the purple fill. */
        .cl-hiw__card--filled .cl-hiw__prodfront { box-shadow: 0 20px 40px rgba(60,35,120,0.30); }
        .cl-hiw__card--filled .cl-hiw__phone { box-shadow: 0 -10px 34px rgba(60,35,120,0.16);
          background: #ffffff; border-color: rgba(0,0,0,0.06); }
        /* The card-1 phone is a light surface in EVERY theme, so keep its text/controls dark
           (otherwise dark theme flips --cl-fg to white → invisible white-on-white text). */
        .cl-hiw__card--filled .cl-hiw__phone,
        .cl-hiw__card--filled .cl-hiw__choosehead,
        .cl-hiw__card--filled .cl-hiw__time { color: #1c1b4b !important; }
        .cl-hiw__card--filled .cl-hiw__phoneicons { color: rgba(28,27,75,0.6) !important; }
        .cl-hiw__card--filled .cl-hiw__brandcard { color: rgba(28,27,75,0.82) !important;
          background: rgba(28,27,75,0.05); border-color: #ffffff; }
        .cl-hiw__card--filled .cl-hiw__brandcard--on { color: rgba(28,27,75,0.95) !important;
          background: rgba(133,104,243,0.14); border-color: #ffffff; }
        /* Cards 2 & 3 — clean white with dark text. */
        .cl-hiw__card--light { background: #ffffff; border-color: rgba(0,0,0,0.06); }
        .cl-hiw__card--light .cl-hiw__title { color: #15151c !important; }
        .cl-hiw__card--light .cl-hiw__text { color: #6a6a75 !important; }
        .cl-hiw__card--light .cl-hiw__num { color: var(--cl-purple) !important; }
        /* Dark theme: cards 2 & 3 use a dark surface instead of white. */
        .cl-root[data-theme="dark"] .cl-hiw__card--light { background: rgba(255,255,255,0.045);
          border-color: rgba(255,255,255,0.1); }
        .cl-root[data-theme="dark"] .cl-hiw__card--light .cl-hiw__title { color: #fff !important; }
        .cl-root[data-theme="dark"] .cl-hiw__card--light .cl-hiw__text { color: rgba(255,255,255,0.62) !important; }
        .cl-hiw__card--wide { grid-column: 1 / -1; flex-direction: row; align-items: center; gap: 32px;
          padding: 36px 40px; min-height: 410px; }

        .cl-hiw__num { position: absolute; top: 26px; right: 28px; font-size: 1.5rem; font-weight: 800;
          letter-spacing: 0.08em; color: var(--cl-purple) !important; opacity: 0.9; }
        .cl-hiw__num--static { position: static; display: inline-block; margin-bottom: 6px; }
        .cl-hiw__title { font-size: var(--fs-h2); font-weight: var(--fw-head); margin: 0 0 12px; }
        .cl-hiw__text { font-size: 1.1rem; line-height: 1.6; color: rgba(var(--cl-fg),0.62) !important;
          margin: 0; max-width: 440px; }
        .cl-hiw__hi { font-style: normal; font-weight: 600; padding: 1px 8px; border-radius: 7px;
          background: var(--cl-purple); color: #fff !important; white-space: nowrap; }
        .cl-hiw__hi--alt { background: var(--cl-purple); }
        .cl-hiw__hi--alt2 { background: var(--cl-purple); }

        /* visuals */
        .cl-hiw__visual { position: relative; flex: 1; margin-top: 54px; min-height: 150px;
          display: flex; align-items: flex-end; justify-content: center; }

        /* Pick a job â€” phone "Choose brand" mockup */
        .cl-hiw__visual--phone { flex-direction: column; align-items: center; justify-content: flex-end;
          gap: 14px; min-height: 240px; }
        .cl-hiw__phone { position: relative; z-index: 1; width: 50%; transform: translate(140px, 0);
          min-height: 360px; border-radius: 20px 20px 0 0;
          padding: 14px 16px 22px; border: 1px solid rgba(var(--cl-fg),0.12); border-bottom: none;
          background: var(--cl-panel); box-shadow: 0 -12px 46px rgba(7,7,78,0.24);
          display: flex; flex-direction: column; gap: 13px; }
        .cl-hiw__phonebar { display: flex; align-items: center; justify-content: space-between; }
        .cl-hiw__time { font-size: 1rem; font-weight: 700; margin-left: 8px; }
        .cl-hiw__phoneicons { display: inline-flex; align-items: center; gap: 11px;
          color: rgba(var(--cl-fg),0.6) !important; }
        .cl-hiw__avatar { width: 27px; height: 27px; border-radius: 50%; background: var(--cl-purple);
          color: #fff !important; font-size: 0.74rem; font-weight: 700; display: inline-flex;
          align-items: center; justify-content: center; }
        .cl-hiw__prodcard { border-radius: 14px; padding: 16px;
          border: 1px solid rgba(var(--cl-fg),0.08); display: flex; align-items: center; justify-content: center;
          background: linear-gradient(160deg, rgba(var(--cl-fg),0.09), rgba(var(--cl-fg),0.02)); }
        .cl-hiw__prodemoji { font-size: 3rem; line-height: 1; filter: drop-shadow(0 8px 16px rgba(0,0,0,0.35)); }
        .cl-hiw__choosehead { font-size: 1.6rem; font-weight: 700; }
        .cl-hiw__brandgrid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px;
          flex: 1; grid-auto-rows: 1fr; }
        .cl-hiw__brandcard { position: relative; display: flex; align-items: center; justify-content: center;
          gap: 6px; padding: 14px 10px; border-radius: 12px; font-size: 0.86rem; font-weight: 600; text-align: center;
          background: rgba(var(--cl-fg),0.05); border: 1px solid rgba(var(--cl-fg),0.08);
          color: rgba(var(--cl-fg),0.78) !important; }
        .cl-hiw__brandcard svg { flex-shrink: 0; color: var(--cl-purple); width: 15px; height: 15px; }
        .cl-hiw__brandcard--on { border-color: rgba(115,135,255,0.5); background: rgba(115,135,255,0.13);
          color: rgba(var(--cl-fg),0.95) !important; }
        /* Per-brand wordmark styling (approximating each brand's logo type). */
        .cl-bc { font-size: 1.02rem; }
        .cl-bc--boat { font-family: 'Poppins','Montserrat',sans-serif; font-weight: 800;
          letter-spacing: -0.01em; text-transform: none; }
        .cl-bc--mivi { font-family: 'Montserrat','Poppins',sans-serif; font-weight: 700;
          letter-spacing: 0.04em; }
        .cl-bc--noise { font-family: 'Poppins','Montserrat',sans-serif; font-weight: 700;
          letter-spacing: 0.16em; text-transform: lowercase; }
        .cl-bc--ptron { font-family: 'Montserrat','Poppins',sans-serif; font-weight: 800;
          letter-spacing: -0.01em; }
        /* Inner panel — lavender card holding the "Choose brand" content, from below the time bar to the bottom. */
        .cl-hiw__phonepanel { flex: 1; border-radius: 14px; padding: 13px; margin-top: 2px;
          display: flex; flex-direction: column; gap: 13px;
          background: rgba(149,131,246,0.16); border: 1px solid rgba(109,74,240,0.12); }

        /* Front "brand accessory" product card â€” large, white, tilted, layered over the phone
           (ref: two-card hero). White product shot so the headphone pops, like the mockup. */
        .cl-hiw__prodfront { position: absolute; left: 12%; bottom: 98px; z-index: 2; width: 58%; max-width: 256px;
          transform: rotate(-7deg); transform-origin: bottom left; border-radius: 24px; padding: 13px 13px 15px;
          background: #ffffff; border: 1px solid rgba(0,0,0,0.05);
          box-shadow: 0 28px 56px rgba(7,7,78,0.55); display: flex; flex-direction: column; gap: 9px; }
        .cl-hiw__prodfront-img { border-radius: 16px; aspect-ratio: 9 / 10; display: flex; align-items: center;
          justify-content: center; background: #f3f3f6; overflow: hidden; }
        .cl-hiw__prodfront-video { width: 100%; height: 100%; object-fit: cover; border-radius: 12px; display: block; }
        .cl-hiw__prodfront-emoji { font-size: 3.1rem; line-height: 1; filter: drop-shadow(0 10px 18px rgba(0,0,0,0.22)); }
        .cl-hiw__prodfront-cap { font-size: 0.72rem; font-weight: 600; letter-spacing: 0.02em;
          color: #8a8a93 !important; }
        .cl-hiw__prodfront-brand { font-size: 1.15rem; font-weight: 700; margin-top: -4px; line-height: 1.1;
          color: #15151c !important; }
        .cl-hiw__squiggle { position: absolute; left: 0; top: 14%; width: 66px; height: 38px; z-index: 1;
          opacity: 0.95; pointer-events: none; }

        .cl-hiw__thumb { position: relative; z-index: 1; width: 86%; aspect-ratio: 4 / 3.6;
          border-radius: 16px 16px 0 0; display: flex; align-items: center; justify-content: center;
          background: url(/card.jpeg) center top / cover no-repeat, linear-gradient(135deg, #2d1b69, #4c1d95);
          box-shadow: 0 -10px 40px rgba(7,7,78,0.2); overflow: hidden; }
        .cl-hiw__play { width: 46px; height: 46px; border-radius: 50%; display: flex; align-items: center;
          justify-content: center; background: rgba(0,0,0,0.4); backdrop-filter: blur(3px);
          border: 1px solid rgba(255,255,255,0.35); }

        .cl-hiw__sticker { position: absolute; z-index: 3; font-size: 1.8rem; line-height: 1;
          filter: drop-shadow(0 6px 12px rgba(0,0,0,0.25)); }
        .cl-hiw__sticker--gift { left: -5%; bottom: 14%; font-size: 2rem; }
        .cl-hiw__sticker--dyn { right: 4%; top: -6px; font-size: 1.7rem; }
        .cl-hiw__sticker--spark { right: 8%; top: 8px; font-size: 1.5rem; }

        /* Create content -- floating engagement chips over the clip */
        .cl-hiw__visual--create { min-height: 270px; }
        .cl-hiw__chip { position: absolute; z-index: 4; display: inline-flex; align-items: center; gap: 6px;
          padding: 7px 12px; border-radius: 999px; font-size: 0.76rem; font-weight: 600;
          background: var(--cl-panel); border: 1px solid rgba(var(--cl-fg),0.12);
          box-shadow: 0 12px 28px rgba(7,7,78,0.3); backdrop-filter: blur(8px); white-space: nowrap; }
        .cl-hiw__chip svg { flex-shrink: 0; }
        .cl-hiw__chip--likes { left: 2%; top: 2%; color: #fb5d7a !important; }
        .cl-hiw__chip--comments { right: 2%; top: 58%; }
        .cl-hiw__chip--user { left: 8%; top: 30%; }
        .cl-hiw__chipav { width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0; }
        .cl-hiw__rec { width: 8px; height: 8px; border-radius: 50%; background: #ff3b5c; flex-shrink: 0;
          box-shadow: 0 0 0 0 rgba(255,59,92,0.6); animation: clRec 1.4s ease-out infinite; }
        @keyframes clRec { 0% { box-shadow: 0 0 0 0 rgba(255,59,92,0.55); } 70%,100% { box-shadow: 0 0 0 7px rgba(255,59,92,0); } }
        @media (prefers-reduced-motion: reduce) { .cl-hiw__rec { animation: none; } }

        /* wide / get paid */
        .cl-hiw__card--wide .cl-hiw__title { font-size: var(--fs-h1); font-weight: var(--fw-head); }
        .cl-hiw__wideleft { flex: 1; align-self: stretch; display: flex; flex-direction: column; }
        .cl-hiw__cta { margin-top: auto; margin-bottom: 30px; align-self: flex-start; }
        .cl-hiw__visual--paid { flex: 1.05; margin-top: 0; align-items: center; min-height: auto; }
        .cl-hiw__paid { position: relative; z-index: 1; width: 100%; max-width: 430px; border-radius: 24px;
          padding: 34px 36px; border: 1px solid rgba(115,135,255,0.18); background: #e2ddf5; color: #1c1730 !important;
          box-shadow: 0 22px 60px rgba(7,7,78,0.24); display: flex; flex-direction: column; gap: 14px;
          transform: rotate(4deg) translate(-30px, 20px); }
        /* Lavender card: force dark text on all rows (overrides the theme's light fg vars). */
        .cl-hiw__paid .cl-hiw__paidh { color: #1c1730 !important; }
        .cl-hiw__paid .cl-hiw__paidrow { color: #000000 !important; }
        .cl-hiw__paid .cl-hiw__paidrow b,
        .cl-hiw__paid .cl-hiw__paidrow--bold span,
        .cl-hiw__paid .cl-hiw__paidrow--prod span { color: #1c1730 !important; }
        .cl-hiw__paid .cl-hiw__paidline { background: rgba(28,23,48,0.12); }
        .cl-hiw__check { width: 46px; height: 46px; border-radius: 50%; align-self: center; font-size: 1.2rem;
          display: flex; align-items: center; justify-content: center; font-weight: 800;
          color: #22c55e !important; border: 2.5px solid #22c55e; }
        .cl-hiw__paidh { text-align: center; font-size: 1.4rem; font-weight: 700; margin-bottom: 6px; }
        .cl-hiw__paidrow { display: flex; align-items: center; justify-content: space-between; gap: 14px;
          font-size: 1.05rem; color: rgba(var(--cl-fg),0.62) !important; }
        .cl-hiw__paidrow b { color: var(--cl-text) !important; font-weight: 700; }
        .cl-hiw__paidrow--bold span { font-weight: 700; color: rgba(var(--cl-fg),0.9) !important; }
        .cl-hiw__paidline { height: 1px; background: rgba(var(--cl-fg),0.12); margin: 4px 0; }
        .cl-hiw__paidrow--prod { font-weight: 600; font-size: 1.3rem; line-height: 1.25;
          justify-content: flex-start; gap: 56px; }
        .cl-hiw__paidrow--prod span { display: inline-block; text-align: center; }
        .cl-hiw__paidemoji { font-size: 1.4rem; }
        .cl-hiw__paidimg { width: 108px; height: 108px; object-fit: contain; border-radius: 12px; flex-shrink: 0; }
        .cl-hiw__bags { text-align: center; font-size: 2.2rem; letter-spacing: 4px; margin-top: 4px; }

        @media (max-width: 720px) {
          .cl-hiw { grid-template-columns: 1fr; }
          .cl-hiw__card { min-height: auto; padding-bottom: 0; }
          .cl-hiw__card--wide { flex-direction: column; align-items: stretch; padding: 30px 26px; }
          .cl-hiw__visual--paid { margin-top: 26px; }
        }

        /* FAQ */
        .cl-faq__head { max-width: 640px; margin: 0 0 44px; text-align: left; }
        .cl-faq__title { font-size: var(--fs-h1); font-weight: var(--fw-head); line-height: 1.08;
          letter-spacing: -0.02em; margin: 0 0 22px; }
        .cl-faq__title em { font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-weight: 500; }
        .cl-faq__intro { font-size: 1.05rem; line-height: 1.6; margin: 0; max-width: 540px;
          color: rgba(var(--cl-fg),0.62) !important; }
        .cl-faq { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; align-items: start; }
        .cl-faq__item { border-radius: 14px; border: 1px solid rgba(var(--cl-fg),0.1);
          background: rgba(var(--cl-fg),0.03); overflow: hidden; transition: border-color 0.2s, background 0.2s; }
        .cl-faq__item--open { border-color: rgba(115,135,255,0.4); background: rgba(115,135,255,0.06); }
        .cl-faq__q { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 16px;
          padding: 26px 28px; background: transparent; border: none; cursor: pointer; font-size: 1.08rem;
          font-weight: 600; text-align: left; color: inherit; }
        .cl-faq__chev { color: rgba(var(--cl-fg),0.55); flex-shrink: 0; transition: transform 0.25s; }
        .cl-faq__item--open .cl-faq__chev { transform: rotate(180deg); color: var(--cl-purple); }
        .cl-faq__a { padding: 0 28px 26px; margin: 0; font-size: 0.97rem; line-height: 1.65;
          color: rgba(var(--cl-fg),0.62) !important; }
        .cl-faq__cta { display: flex; justify-content: center; margin-top: 44px; }

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
          .cl-brands__line { flex-wrap: wrap; justify-content: center; gap: 28px 36px; }
          .cl-footer__cols { grid-template-columns: repeat(2, 1fr); gap: 28px 40px; }
          .cl-footer__inner { grid-template-columns: 1fr; gap: 36px; }
        }
        @media (max-width: 768px) {
          .cl-nav__links, .cl-nav__actions { display: none; }
          .cl-nav__burger { display: inline-flex; }
          /* Mobile: the wide-padding -34px offset drags the lockup off the left edge here
             (mobile padding is far smaller), clipping the logo. Smaller box + gentler pull
             keeps "UGCad.io" fully visible and inset from the edge. */
          .cl-brand__logo { height: 150px; margin-left: -16px; }
          /* Hide the "Get started — it's free" CTA inside the Get-paid step on mobile only. */
          .cl-hiw__cta { display: none; }
          /* PERF: a blurred blob that animates re-rasterizes the whole blur every frame — the
             single biggest jank source on phones. Freeze them (static, no animation) and shrink
             the blur radius so the one-time raster is cheap. Visual is unchanged at rest. */
          .cl-blob { width: 300px !important; height: 300px !important; filter: blur(60px);
            animation: none !important; will-change: auto; }
          /* PERF: a FIXED bar with backdrop-filter re-samples everything behind it on every
             scroll frame. Drop the blur on mobile and use a near-opaque bar instead. */
          .cl-nav--scrolled { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
          .cl-root[data-theme="dark"] .cl-nav--scrolled { background: rgba(10,10,10,0.96); }
          .cl-root:not([data-theme="dark"]) .cl-nav--scrolled { background: rgba(255,255,255,0.96); }
          .cl-section { padding: 60px 6%; }
          .cl-community { grid-template-columns: repeat(2, 1fr); }
          .cl-tcard { height: clamp(420px, 70vh, 560px); }
          /* Brand strip on mobile: two auto-scrolling marquee lines (top→left, bottom→right)
             instead of a wrapped grid. Duplicate logos become visible to fill the loop. */
          .cl-brands { overflow: hidden;
            -webkit-mask-image: linear-gradient(90deg, transparent, #000 7%, #000 93%, transparent);
            mask-image: linear-gradient(90deg, transparent, #000 7%, #000 93%, transparent); }
          .cl-brands__row { padding-left: 0; padding-right: 0; gap: 26px; overflow: hidden;
            align-items: flex-start; }
          .cl-brands__logo--dup { display: inline-flex; }
          /* align-self:flex-start is critical -- a centered track would expose a gap on the
             right when translated -50%; left-aligning keeps the loop seamless. */
          .cl-brands__line, .cl-brands__line--bottom {
            flex-wrap: nowrap; width: max-content; justify-content: flex-start; gap: 34px;
            align-self: flex-start; padding-right: 34px; will-change: transform; }
          .cl-brands__line--top { animation: clMarquee 24s linear infinite; }
          .cl-brands__line--bottom { animation: clMarqueeRight 24s linear infinite; }
          .cl-brands__logo { height: 46px; padding: 0 10px; }
          .cl-brands__icon { height: 32px; width: auto; max-width: 130px; }
          .cl-faq { grid-template-columns: 1fr; }
          .cl-footer__cols { grid-template-columns: repeat(2, 1fr); }
          /* PERF: drop the small decorative backdrop-blurs — cheap to lose, costly on mobile GPUs. */
          .cl-hiw__play, .cl-hiw__chip { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }
          /* PERF: skip rendering+layout for the static below-fold sections until they scroll near
             the viewport, so the long page scrolls smoothly. contain-intrinsic-size reserves space
             so the scrollbar doesn't jump. */
          .cl-faq, .cl-footer { content-visibility: auto; contain-intrinsic-size: auto 600px; }
        }
        /* Small phones — tighter padding, smaller type, single-column stacks. */
        @media (max-width: 480px) {
          .cl-nav { padding: 14px 5%; }
          /* Let the hero shrink to its content instead of a full 100vh — otherwise
             the leftover viewport space below the video cards pushes the category
             pills far down the screen. Collapsing it brings the pills up under the cards. */
          .cl-hero { padding: clamp(92px, 13vh, 130px) 5% 0; height: auto; min-height: 0; gap: 16px; }
          .cl-hero__title { line-height: 1.12; }
          .cl-hero__sub { font-size: 1.05rem; }
          .cl-hero__ctas { margin-top: 0px; }
          .cl-section { padding: 46px 5%; }
          .cl-belowfold { padding: 14px 5% 24px; }
          .cl-brands__row { padding-top: 36px; gap: 22px; }
          .cl-hiw__card { padding: 24px 20px 0; }
          .cl-hiw__card--wide { padding: 24px 20px; }
          .cl-hiw__paid { transform: rotate(4deg); }
          /* "Pick a job" phone mockup: the desktop fixed translate(140px) overflowed the
             phone off-screen — use a scaling % shift so the phone + product card fit. */
          /* Bottom-aligned content, so push the whole composition down with translateY. */
          .cl-hiw__visual--phone { min-height: 300px; transform: translateY(30px); }
          .cl-hiw__phone { width: 60%; transform: translateX(34%); min-height: 300px; }
          .cl-hiw__prodfront { left: 0; bottom: 60px; width: 56%; max-width: 200px; }
          .cl-hiw__text { font-size: 0.95rem; }
          .cl-hiw__chip { font-size: 0.7rem; padding: 6px 10px; }
          .cl-hiw__chip--likes { left: 4%; top: 5%; }
          .cl-hiw__chip--comments { right: 4%; top: 60%; }
          .cl-community { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .cl-tcard { height: clamp(360px, 62vh, 480px); }
          .cl-faq__q { padding: 20px; font-size: 1rem; }
          .cl-faq__a { padding: 0 20px 20px; }
          .cl-footer { padding: 40px 5% 32px; }
          /* Two columns on phones: Product/Legal/US stack on the left,
             Alternatives/Blog/India on the right (matches the reference). */
          .cl-footer__cols { grid-template-columns: repeat(2, 1fr); gap: 28px 24px; }
          .cl-footer__col { text-align: left; }
        }
      `}</style>
    </div>
  );
}
