import { useState, useEffect, useLayoutEffect, useRef, lazy, Suspense, Fragment } from 'react';
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
  MessageCircle,
  Heart,
  Coffee,
  Dumbbell,
  PawPrint,
  Gamepad2,
  IndianRupee,
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
  Menu,
  Sun,
  Moon,
  Search,
  Lock,
  UserCheck,
  ShieldCheck,
  Package,
  Tag,
  Headphones,
  CalendarDays,
  ReceiptText,
  HelpCircle,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { motion, useInView, useTransform, useScroll, useMotionValueEvent, useSpring, useReducedMotion, easeInOut } from 'framer-motion';

// Lazy-loaded so three.js/R3F stay out of the main bundle (loaded only when the scene mounts).
const HeroLogo3D = lazy(() => import('../components/HeroLogo3D'));

// Inject Cloudinary delivery transforms so the marquee fetches a tiny card-sized clip instead
// of the raw source. Measured against the actual files, dimension alone barely mattered — the
// originals are ~5–6MB and h_600,c_scale only shaved them to ~5MB. The real size drivers are
// QUALITY and DURATION (these are long ~20–30s portrait clips). So:
//   h_360,c_scale  → downscale the tall side to ~card size (172px → 344px @DPR2; 360 is ample)
//   q_auto:eco     → aggressive adaptive quality (fine for a small, moving thumbnail)
//   du_8           → trim to an 8-second loop (a marquee only ever shows a short loop anyway)
//   f_mp4,vc_h264  → real H.264 MP4 (not webm/vp9): serves byte-range requests correctly, which
//                    fixes the intermittent 416 "Range Not Satisfiable" errors under f_auto
// Net: every clip lands under ~450KB (verified across the set) vs the old 2–5MB.
function cldThumb(src) {
  if (typeof src !== 'string' || !src.includes('/video/upload/')) return src;
  // ac_none strips the audio track (clips are muted anyway) — smaller file + lighter decode.
  // h_480 (down from h_600): video DECODE runs continuously in the background, independent of
  // scroll, so it's the dominant cause of whole-page lag. With the mobile cap at 3, total decode is
  // 3×480² ≈ 0.69M — well under half the h_600 load and the original 14×360² ≈ 1.81M — while h_480
  // is still sharper than the original 360. du_2 keeps the file small so it starts fast.
  return src.replace('/video/upload/', '/video/upload/f_mp4,vc_h264,q_auto:good,h_480,c_scale,ac_none,du_2/');
}

// ── Global play cap (imperative, NO React state) ────────────────────────────────
// Mobile GPUs choke when a dozen <video> elements decode at once (the marquee can have many on
// screen). Cap concurrent playback: a card that scrolls in plays if a slot is free, otherwise it
// WAITS on its (real) poster thumbnail. When a playing card scrolls off, it hands its slot to a
// waiting one. All imperative — never calls setState — so the non-stop marquee causes no renders.
// Cap concurrent playback far LOWER on phones — a dozen H.264 decoders at once stutter on mobile
// GPUs (the "lag on play"). Desktop can handle many more. Evaluated once at module load.
// Mobile cap raised 4→5: with the per-card imperative play (no rAF thrash) the old GPU lag is
// gone, so the real bottleneck is STARVATION — an entering marquee card had to wait for a leaving
// card to free a slot, which is why a clip "popped" into motion mid-screen. 5 small clips (h_600,
// 2s, muted, downscaled) decode fine on modern phones. THIS is the knob to lower again if any
// device stutters; raising it trades smoothness-of-start for decode load.
// Desktop cap lowered 14→8: you can't watch 8 clips at once, so 8 concurrent H.264
// decoders look identical on screen but roughly halve the GPU/compositor decode load
// during the showcase scroll — smoother on laptops with zero visible difference.
// Mobile keeps a tight cap (decode load is the mobile bottleneck). Desktop is UNCAPPED so every
// card that's near the viewport plays — the per-card play observer (240px margin) already pauses
// anything off screen, so this only ever decodes the handful actually visible, not all 64.
// ── Device capability tier ──────────────────────────────────────────────────────
// Width alone can't tell a flagship Samsung from a budget Poco at the same ~400px — but the
// heavy bits (WebGL logo, live video decode, scroll-spring physics) are exactly what a weak
// GPU/CPU chokes on. Detect a LOW-END tier ONCE at load and degrade gracefully on it:
//   • honour explicit user/browser intent first — prefers-reduced-motion and Save-Data — so
//     it also covers laptops/desktops that ask for less motion or less data;
//   • otherwise flag SMALL screens whose hardware is genuinely weak (≤4 CPU threads or ≤4 GB
//     RAM). deviceMemory/saveData are Chrome/Android-only (undefined on iOS Safari), which is
//     fine — high-end iPhones aren't the device we need to throttle.
const IS_LOW_END = (() => {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const mm = window.matchMedia ? (q) => window.matchMedia(q).matches : () => false;
  // Gate the heavy hero (videos + WebGL logo) ONLY on explicit user signals — Reduce-Motion and
  // Save-Data. The old cores<=4/mem<=4 heuristic mis-flagged many capable mid-range Androids
  // (navigator.deviceMemory is coarse, capped low, and undefined in several browsers), so SOME
  // phones got videos + a spinning logo and others got neither — the inconsistency users hit.
  // Honouring only the explicit prefs gives every phone the same experience while still respecting
  // users who opted out of motion / are saving data.
  if (mm('(prefers-reduced-motion: reduce)')) return true;
  const conn = navigator.connection;
  if (conn && conn.saveData) return true;
  return false;
})();

// Mobile buffers FAR ahead (big load margin) but keeps the PLAY margin modest. Why not a huge
// play margin too: playback is capped (MAX_PLAYING_VIDEOS) with FIFO slot release, so if the play
// zone holds more cards than the cap, the cards entering from the edge queue behind clips already
// playing near centre — and only start once they reach ~half screen (the reported bug). A modest
// play zone keeps the on-screen cards within the cap so each plays AS it enters, while the large
// load-ahead means its src is already fully buffered by then (play() starts instantly, no pop).
const IS_MOBILE = typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
const VIDEO_LOAD_MARGIN = IS_MOBILE ? '1200px' : '450px';
const VIDEO_PLAY_MARGIN = IS_MOBILE ? '250px' : '360px';

// Concurrent <video> decode cap. Low-end devices play NONE — every card holds its real
// first-frame poster, so zero H.264 decoders run (the single biggest mobile lag source).
// Other phones cap at 5; desktop is uncapped (only near-viewport cards ever decode).
// Raised 3→5: with only 3 slots an entering marquee card had to WAIT for a leaving card to
// free a slot, so clips visibly "popped" into motion a beat after sliding on screen. 5 small
// (h_480, 2s, muted, downscaled) clips decode fine on modern phones, so the visible cards are
// already playing when they appear. THIS is the knob to lower again if a weak phone stutters.
const MAX_PLAYING_VIDEOS = IS_LOW_END
  ? 0
  : (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches ? 6 : Infinity);
const _playingVideos = new Set();
const _waitingVideos = new Set();
function playVideoCapped(v) {
  if (_playingVideos.has(v)) return;
  if (_playingVideos.size < MAX_PLAYING_VIDEOS) {
    _waitingVideos.delete(v);
    _playingVideos.add(v);
    const p = v.play();
    // A rejected play() used to be swallowed while the element STAYED in _playingVideos —
    // and the has() guard above then made every later attempt a no-op, so the card sat
    // frozen on its poster until it happened to leave and re-enter the play zone. That is
    // the marquee's "the cards at the left/right edge never start" bug: a card entering the
    // edge calls play() before its source has data, the promise rejects with AbortError, and
    // nothing ever retries. Dropping it from the set on failure makes it retryable — and
    // hands its slot to a waiting card so a capped device doesn't lose one to a dead entry.
    if (p && p.catch) {
      p.catch(() => {
        _playingVideos.delete(v);
        for (const next of _waitingVideos) {
          if (next.isConnected) { playVideoCapped(next); break; }
          _waitingVideos.delete(next);
        }
      });
    }
  } else {
    _waitingVideos.add(v);
  }
}
function releaseVideo(v) {
  const wasPlaying = _playingVideos.delete(v);
  _waitingVideos.delete(v);
  v.pause();
  // Free slot → start the next waiting clip (skip any that are no longer mounted/visible).
  if (wasPlaying) {
    for (const next of _waitingVideos) {
      if (next.isConnected) { playVideoCapped(next); break; }
      _waitingVideos.delete(next);
    }
  }
}

// First-frame still (so_0) at the same card size, delivered as an auto-format image. Used as
// the <video poster> so every card shows a real thumbnail the instant it mounts — nothing is
// ever black while the clip is lazy-loading (src is attached only once the section scrolls in).
function cldPoster(src) {
  if (typeof src !== 'string') return undefined;
  // Local files (e.g. /home/video_03.mp4) have a sibling first-frame JPG (/home/video_03.jpg),
  // so non-playing cards show a real still instead of a black box.
  if (!src.includes('/video/upload/')) return src.replace(/\.mp4$/i, '.jpg');
  // h_480 — MATCHED to the playing clip's resolution (cldThumb h_480) so the poster→video handoff
  // is seamless (no sharp→soft "shift" when playback starts).
  return src
    .replace('/video/upload/', '/video/upload/so_0,f_auto,q_auto:good,h_480,c_scale/')
    .replace(/\.mp4$/i, '.jpg');
}

// Showcase video. Two observers: a one-shot LOAD latch (attaches src once, single re-render)
// and a PLAY/PAUSE observer that calls play()/pause() IMPERATIVELY on the element. That second
// one is the fix: the old version routed every edge-crossing through setState → re-render → a
// global play-budget + rAF pump, which thrashed the main thread while the marquee animates
// non-stop (the real stutter) AND capped playback at 6 so most visible cards froze on a frame.
// Here, only cards actually near the viewport decode & play (so we never run 64 simultaneous
// decodes), each plays continuously the whole time it's on screen, the poster shows a real
// thumbnail so nothing is ever black, and scrolling causes no per-card re-renders.
// `eager` (used for the first few above-the-fold hero cards): attach the src at mount and start
// playback immediately, skipping BOTH IntersectionObserver round-trips (load-gate → re-render →
// play-gate) that otherwise delay the first frame by ~2-3s on mobile. preload="auto" then buffers
// the clip from page load instead of from whenever the load observer happens to fire.
function LazyVideoEl({ src, className, eager = false }) {
  const ref = useRef(null);
  // Whether the play observer currently considers this card on screen. A ref, not state:
  // it is written from the observer on every edge crossing and must not cause a render.
  const onScreen = useRef(eager);
  // Low-end / Save-Data devices never load the clip — `loaded` stays false so the real
  // first-frame poster shows with NO network fetch and NO decode (see preload below).
  const [loaded, setLoaded] = useState(eager && !IS_LOW_END);
  // LOAD latch — attach the real src the first time the card nears the viewport, then KEEP it.
  // Set once and never toggled, so it triggers exactly one re-render (no churn afterwards).
  // Eager cards already have their src (loaded starts true), so they skip this gate entirely.
  useEffect(() => {
    if (eager || IS_LOW_END) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setLoaded(true); io.disconnect(); } },
      // Load-ahead is MUCH larger than the play-ahead margin below on purpose: the src attaches —
      // and preload="auto" starts buffering — long before the card needs to play, so the clip is
      // ready when play() fires instead of stalling. On mobile this is pushed way out (1400px) so
      // the clip is fully buffered before the play line, fixing "starts only at ~half screen".
      // (Attaching src ≠ playing, so this costs bandwidth, not GPU/decode.)
      { rootMargin: VIDEO_LOAD_MARGIN }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [eager]);
  // PLAY on screen / PAUSE off screen — done imperatively (no setState) so the non-stop
  // marquee motion never causes a React render. The effect re-runs when `loaded` flips, so a
  // fresh observer fires with the current visibility right AFTER the src is attached — that's
  // what guarantees the first play() isn't called against an empty/unloaded source (the bug
  // that left every card stuck on its poster). preload="auto" means the src is buffered by
  // the time the card reaches the play margin, so play() starts/resumes instantly.
  useEffect(() => {
    if (IS_LOW_END) return undefined; // poster-only: no play/pause observer at all
    const v = ref.current;
    if (!v) return undefined;
    // Eager cards: start playback NOW (src is already attached) instead of waiting for the
    // observer's first async callback — that shaves the remaining start latency on the hero row.
    if (eager && v.src) playVideoCapped(v);
    const io = new IntersectionObserver(
      ([entry]) => {
        onScreen.current = entry.isIntersecting;
        if (entry.isIntersecting) {
          if (v.src) playVideoCapped(v);
        } else {
          releaseVideo(v);
        }
      },
      // Generous margin so a clip is already playing BEFORE it slides on screen (no pop at the
      // boundary). Smaller than the load margin above, so by the time a card hits this play line
      // its src has already been buffering. threshold ~0 so a sliver counts as visible.
      // Mobile 700px (desktop 360): a card starts playing well before it reaches the viewport, so
      // it's already in motion when it appears instead of popping in around half-screen.
      { root: null, rootMargin: VIDEO_PLAY_MARGIN, threshold: 0.01 }
    );
    io.observe(v);
    return () => { io.disconnect(); releaseVideo(v); };
  }, [loaded, eager]);
  return (
    <video
      ref={ref}
      className={className}
      poster={cldPoster(src)}
      muted
      loop
      playsInline
      preload={IS_LOW_END ? 'none' : 'auto'}
      webkit-playsinline="true"
      disablePictureInPicture
      // Safety net for the edge cards: play() can be called (and fail) before the clip has
      // data. By the time enough arrives the observer has long since fired and will not fire
      // again until the card crosses the boundary, so without this the card stays parked on
      // its poster. If it is still on screen when it becomes playable, start it.
      onCanPlay={(e) => {
        const v = e.currentTarget;
        if (onScreen.current && v.paused) playVideoCapped(v);
      }}
      {...(loaded ? { src: cldThumb(src) } : {})}
    />
  );
}

// Videos PLAY on both mobile and desktop. On mobile they're kept light via the play-cap (3
// concurrent), h_480 res, and only-when-visible playback (LazyVideoEl) — the rest of the mobile
// perf comes from content-visibility + no backdrop-blur + lighter shadows, not from killing video.
function LazyVideo(props) {
  return <LazyVideoEl {...props} />;
}

// Should this visitor get HOVER-driven playback, or scroll-into-view playback?
//
// `(hover: hover)` on its own is not a good enough test, and relying on it is what left the
// grid as a wall of black boxes on narrow screens: a desktop window dragged down to phone
// width still reports hover:hover, and so do plenty of Android and hybrid browsers. Those
// visitors took the hover path — which sets preload="none" and waits for a mouseenter that
// never comes — so nothing ever loaded or played.
//
// So it also has to be a fine pointer AND wide enough to actually be a desktop. 769px is the
// same boundary the showcase grid's own column rules use.
const HOVER_PLAY_MQ = '(hover: hover) and (pointer: fine) and (min-width: 769px)';
const matchesHoverPlay = () =>
  typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia(HOVER_PLAY_MQ).matches;

// Showcase-grid clip: a poster still at rest, plays muted + looping while the visitor
// hovers it, and rewinds to the poster on leave. NO player chrome at all — no play/pause,
// no scrub bar, no mute button, no menu dot.
// Touch devices have no hover, so there the clip plays whenever it is scrolled into view
// instead — otherwise the whole grid would sit there as static images on a phone.
function ShowcaseVideo({ src, poster, className }) {
  const ref = useRef(null);
  const [muted, setMuted] = useState(true);
  // State, not a module constant read once: resizing a desktop window down past 768px has to
  // hand playback over to the scroll-into-view path, otherwise the cards go black the moment
  // the layout becomes a phone layout.
  const [hoverPlay, setHoverPlay] = useState(matchesHoverPlay);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(HOVER_PLAY_MQ);
    const onChange = () => setHoverPlay(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Phone / narrow / touch: play on screen, pause off screen. No hover involved.
  useEffect(() => {
    if (hoverPlay) return undefined;
    const v = ref.current;
    if (!v) return undefined;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) { v.muted = true; v.play?.().catch(() => {}); }
        else v.pause?.();
      },
      { threshold: 0.25 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [hoverPlay]);

  // ONE audible clip at a time. Ten cards are on screen together, so unmuting a
  // second without silencing the first would just stack overlapping audio.
  // Every card listens for this event and re-mutes itself unless it is the sender.
  useEffect(() => {
    const onSolo = (e) => {
      const v = ref.current;
      if (!v || e.detail === v) return;
      if (!v.muted) { v.muted = true; setMuted(true); }
    };
    window.addEventListener('lp-video-solo', onSolo);
    return () => window.removeEventListener('lp-video-solo', onSolo);
  }, []);

  const toggleMute = (e) => {
    // The button sits inside the hover area that drives play/pause; without this the
    // click would also bubble to any future card-level handler.
    e.preventDefault();
    e.stopPropagation();
    const v = ref.current;
    if (!v) return;
    const next = !v.muted;
    v.muted = next;
    setMuted(next);
    if (!next) {
      // Unmuting: make sure it is actually rolling (on hover devices preload is
      // 'none', so a card the pointer never entered has nothing playing yet), and
      // silence every other card.
      v.play?.().catch(() => {});
      window.dispatchEvent(new CustomEvent('lp-video-solo', { detail: v }));
    }
  };

  const onEnter = () => {
    const v = ref.current;
    if (!v || !hoverPlay) return;
    // Only force-mute if the visitor hasn't deliberately turned sound ON for this card.
    // (Muting is what lets autoplay policy accept play() in the first place.)
    if (v.muted) v.muted = true;
    v.play?.().catch(() => {});
  };
  const onLeave = () => {
    const v = ref.current;
    if (!v || !hoverPlay) return;
    // If the visitor explicitly unmuted this card, leave it alone — pausing and
    // rewinding here would silently discard that choice. It also matters mechanically:
    // load() re-applies the `muted` attribute, so the element would go back to muted
    // while the button's state still said "unmuted", desyncing the icon.
    if (!v.muted) return;
    v.pause?.();
    // load() rewinds AND puts the poster back up; without it the card freezes on whatever
    // frame the pointer happened to leave on. The file stays in the HTTP cache, so the
    // next hover replays without re-downloading.
    v.load?.();
  };

  return (
    <div className="lp-vcard__videowrap" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <video
        ref={ref}
        className={className}
        src={src}
        poster={poster}
        muted
        loop
        playsInline
        // Hover devices fetch nothing until the visitor actually hovers — the grid loads
        // as 10 posters instead of 10 video streams. Everywhere else the clip plays on
        // scroll, so it needs at least metadata up front.
        preload={hoverPlay ? 'none' : 'metadata'}
        disablePictureInPicture
      />
      <button
        type="button"
        className="lp-vcard__mute"
        onClick={toggleMute}
        aria-label={muted ? 'Unmute video' : 'Mute video'}
        aria-pressed={!muted}
      >
        {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
      </button>
    </div>
  );
}

// Top-creator leaderboard shown under the hero — rows reveal one-by-one on scroll.
// Edit / add / remove freely; the reveal stagger recomputes from the item count.
const TOP_CREATORS = [
  'We only work with brands that want to lead',
  'Your budget, your brief, no agency',
  'Top UGC creators across every niche',
  'Fastest content, delivery from 24 hours',
  'Hands-on support from UGC experts',
  'No more lost DMs and screenshot threads',
  'No paying till you approve the video',
  'You own every video the moment you approve',
  'Vetted creators, not a open marketplace',
];

// The 4 stacked "promise" cards (title top-left, number top-right, description
// bottom-left, video bottom-right). Videos are pulled from the showcase set below.
// Two-color palette (white / light purple) — alternates card by card.
// `accent` is a saturated companion to each pastel `color`. It is used ONLY by the
// outside scroll furniture (PromiseChrome) — the pastels themselves are far too
// light to read as a 7px dot or a 1px line against the off-white page. Nothing
// inside the card uses it, so the cards look exactly as they did.
const PROMISE_CARDS = [
  { color: '#e9f4a1', accent: '#a3ba22', btnBg: '#16121f', btnText: '#fff', title: 'Your budget, your brief', sub: 'No agency retainer, no middleman.',
    desc: 'You set the budget and write the brief. The spend goes to the creator and the work, not a markup.' },
  { color: '#e5e2fb', accent: '#7d74dd', btnBg: '#16121f', btnText: '#fff', title: 'Creators for every niche', sub: 'Vetted talent, any category.',
    desc: 'Beauty, fitness, tech, food, fashion and more. Every creator is manually vetted before they touch a brief.' },
  { color: '#ffe1cf', accent: '#e08758', btnBg: '#16121f', btnText: '#fff', title: 'Delivery from 24 hours', sub: 'Your campaign never waits.',
    desc: 'Briefs move fast. Many creators turn around a first cut within a day, so production never holds you up.' },
  { color: '#d3f1e2', accent: '#4da882', btnBg: '#16121f', btnText: '#fff', title: 'Hands-on expert support', sub: 'A real team in your corner.',
    desc: 'We help you shape the brief, pick the right creators, and get to a video that actually performs.' },
];

// Lead-in: for the first slice of the pinned scroll the whole deck just SITS there (centred,
// stacked) — nothing moves — so it doesn't start flying apart the instant the section pins.
const PROMISE_EXIT_START = 0.12;
// Fraction of the pinned-section scroll by which the front cards have slid away. The LAST
// card doesn't move — after this point it rests on screen until the section un-pins.
const PROMISE_EXIT_END = 0.9;

// One card in the pinned "deck". The cards are a receding STACK — the front card is full size,
// the ones behind are progressively smaller and nudged DOWN so they peek out below (big · small ·
// small). On scroll each front card SLIDES UP and SLANTS away, and the card behind rises + grows
// into the front slot — one by one. Each card owns its own scroll-driven transforms, so it lives
// in its own component (hooks can't run in a .map()). `progress` is the section's 0→1 scroll value.
function PromiseCard({ card, i, total, vid, progress, navigate }) {
  const isLast = i === total - 1;
  const START = PROMISE_EXIT_START;
  const B = (PROMISE_EXIT_END - START) / (total - 1); // scroll length of one "card leaves" beat
  const frontAt = START + i * B;             // progress at which this card reaches the front slot
  const leaveEnd = frontAt + B;              // progress at which it's fully gone (non-last)
  const depth = i;                           // full depth behind the front — every card peeks
  const offVh = depth * 3.8;                 // starts this far DOWN (peek below), in vh
  const startScale = 1 - depth * 0.05;       // ...and this much smaller

  // y — holds stacked through the lead-in, RISES to the front (0), then (non-last) slides off top.
  const yIn = isLast ? [START, frontAt] : (i === 0 ? [START, leaveEnd] : [START, frontAt, leaveEnd]);
  const yOut = isLast ? [`${offVh}vh`, '0vh'] : (i === 0 ? ['0vh', '-130vh'] : [`${offVh}vh`, '0vh', '-130vh']);
  const y = useTransform(progress, yIn, yOut, { clamp: true });
  // scale — grows from its depth size up to full by the time it reaches the front.
  const scale = useTransform(progress, i > 0 ? [START, frontAt] : [0, 1], i > 0 ? [startScale, 1] : [1, 1], { clamp: true });
  // rotate — dead straight until it's the front, then SLANTS as it lifts away (non-last only).
  const rotate = useTransform(progress, isLast ? [0, 1] : [frontAt, leaveEnd], isLast ? [0, 0] : [0, -7], { clamp: true });

  return (
    <motion.div className="lp-promise__card" style={{ y, scale, rotate, zIndex: total - i, background: card.color }}>
      <span className="lp-promise__num">0{i + 1}</span>
      <div className="lp-promise__content">
        <h3 className="lp-promise__title">{card.title}</h3>
        <p className="lp-promise__sub">{card.sub}</p>
        <p className="lp-promise__desc">{card.desc}</p>
        <button
          type="button"
          className="lp-promise__btn"
          style={{ background: card.btnBg, color: card.btnText }}
          onClick={() => navigate('/auth?mode=signup&role=business')}
        >
          Discover our approach <ArrowRight size={16} />
        </button>
      </div>
      {vid && (
        <div className="lp-promise__video">
          <video src={vid.src} poster={cldPoster(vid.src)} muted loop playsInline autoPlay preload="none" />
        </div>
      )}
    </motion.div>
  );
}

// The curve that runs from the aside's marker down to the card. Shared by the ghost
// copy and the drawn copy so the two can never disagree. Ends at (270,168) in the
// 300×190 viewBox; the arrowhead below is built off that point's tangent.
const SVC_PATH_D = 'M 20 34 C 20 120, 82 146, 270 168';
const SVC_ARROW_D = 'M 257.8 160.5 L 270 168 L 256.4 172.5';

// ── The "Our Services" stage: left aside + the card deck + right 01–04 rail ─────
// Wraps the deck (passed in as `children`) so the three columns are one grid and the
// deck stays centred between them. Everything outside the deck reads the SAME
// `progress` value and the SAME PROMISE_EXIT_* beats the cards do, so the indicators
// cannot drift out of sync with the stack.
//
// The active index lives HERE, not in Landing, on purpose: holding it up there would
// re-render the entire page four times per scroll-through. `children` arrives as an
// already-built element, so React skips re-rendering the deck when this state changes.
// ── Services, MOBILE ────────────────────────────────────────────────────────────────
// An accordion, not the desktop scroll-deck: one card open, the rest collapsed to tappable
// coloured rows beneath it. The deck depends on a pinned 100vh runway and scroll-driven
// stacking, which on a phone meant the open card's lower half (description + CTA) fell past
// the fold into a silent internal scroll. Here height is content-driven and the user picks
// the card, so nothing is ever clipped and no scroll runway is needed.
//
// Copy, colours and videos come from the SAME PROMISE_CARDS / PROMISE_VIDEOS as desktop —
// this is a layout change only, so the two can never drift apart.
function PromiseMobile({ cards, videos, navigate, progress }) {
  const [active, setActive] = useState(0);
  const card = cards[active];

  // The index is driven by the SECTION's scroll progress, passed in — not by a useScroll on
  // this element. That distinction is the whole fix for "it jumps to the last card / the
  // section is gone before the cards finish":
  //
  //   * Measuring this element only ever spanned its own height. Split four ways that gave
  //     each card a fraction of a screen, so a normal flick blew through all four at once.
  //   * And once the deck is PINNED (see .lp-logo3d__sticky) the element stops moving relative
  //     to the viewport, so its own scroll progress freezes and the cards would never advance
  //     at all.
  //
  // The section itself is the tall runway that keeps scrolling behind the pin, so its progress
  // is the thing that maps cleanly onto "which card should be showing".
  const svcP = progress;
  // A slide-and-tilt is exactly the kind of motion that triggers discomfort, and the page's
  // CSS prefers-reduced-motion block only neutralises CSS animations/transitions — it cannot
  // touch framer's inline transforms. Fall back to a plain fade when the OS asks for less.
  const reduceMotion = useReducedMotion();
  useMotionValueEvent(svcP, 'change', (p) => {
    const i = Math.min(cards.length - 1, Math.max(0, Math.floor(p * cards.length)));
    setActive((cur) => (cur === i ? cur : i));   // no-op when unchanged, so no render churn
  });

  // ── Scroll-SCRUBBED entry (not a fired animation) ──────────────────────────────────
  // The swing is derived from scroll position every frame rather than played on a spring
  // when the index flips. Two reasons:
  //   * Stopping mid-scroll leaves the card genuinely halfway — tilted and part-way across —
  //     because its transform IS the scroll position. A spring ignores the scroll once
  //     triggered and always runs to the end, which is why it felt like it "went too fast".
  //   * Scrubbing makes it reversible: easing back up un-swings the card instead of
  //     re-triggering a fresh animation.
  // ENTRY_SPAN is the fraction of each card's slice of the runway that the swing occupies.
  // At 240vh / 4 cards = 60vh per card, 0.55 spends ~33vh settling the card — slow enough to
  // watch, while leaving ~27vh of still, readable time before the next card takes over.
  const ENTRY_SPAN = 0.55;
  const n = cards.length;
  // Where we are WITHIN the current card (0 = just arrived, 1 = about to hand over), and
  // which side that card enters from (alternating, so 01 left / 02 right / 03 left / 04 right).
  const swing = useTransform(svcP, (p) => {
    if (reduceMotion) return 0;
    const idx = Math.min(n - 1, Math.max(0, Math.floor(p * n)));
    const local = Math.min(1, Math.max(0, p * n - idx));
    const t = Math.min(1, local / ENTRY_SPAN);        // 0 -> 1 across the entry span
    const eased = 1 - Math.pow(1 - t, 3);             // ease-out cubic: fast start, soft landing
    const side = idx % 2 === 0 ? -1 : 1;
    return side * (1 - eased);                        // ±1 -> 0
  });
  const cardX = useTransform(swing, (s) => s * 52);
  const cardRotate = useTransform(swing, (s) => s * 4);
  const cardOpacity = useTransform(swing, (s) => 1 - Math.min(0.85, Math.abs(s)));

  return (
    <div className="lp-svcm">
      <span className="lp-svcm__eyebrow">Our Services</span>
      <h2 className="lp-svcm__title">
        We make content<br />
        <em style={{ color: card.accent }}>work harder.</em>
      </h2>
      <p className="lp-svcm__sub">
        No fluff. No middlemen. Just content that connects and drives real results.
      </p>

      {/* Stacked DECK, matching the desktop treatment: cards sit on top of one another and
          scroll brings the next forward, instead of a column of separate rows.

          The active card stays in NORMAL FLOW so it still defines the deck's height — that is
          what keeps this content-driven and avoids the clipping the fixed-height version had.
          The cards still to come are absolutely positioned boxes nudged down and scaled back,
          so only a colour strip of each shows below the front one. They carry no content on
          purpose: it would sit hidden behind the front card anyway, and rendering four card
          bodies (each with a <video>) just to hide three is wasted work. */}
      <div className="lp-svcm__deck">
        {cards.map((c, i) => {
          const depth = i - active;
          if (depth <= 0) return null;           // already passed — nothing left to peek
          return (
            <span
              key={`ghost-${c.title}`}
              className="lp-svcm__ghost"
              aria-hidden="true"
              style={{
                background: c.color,
                transform: `translateY(${depth * 13}px) scale(${1 - depth * 0.028})`,
                zIndex: cards.length - depth,
              }}
            />
          );
        })}
        {cards.map((c, i) => {
          // Only the front card is built. The rest are the colour strips above; cards already
          // scrolled past are gone entirely, exactly as they are on desktop once they slide
          // away. (This replaced a full list of tappable collapsed rows — keeping both meant
          // every upcoming card appeared twice: once as a strip behind, once as a row below.)
          if (i === active) {
            return (
              // x / rotate / opacity are MOTION VALUES driven by scroll (see the swing
              // transform above) — deliberately not initial/animate, which would fire a
              // fixed-length animation on mount and run to completion no matter where the
              // reader stopped. Passing them through `style` means the card's position is a
              // direct function of scroll: stop halfway and it stays halfway, tilted.
              // Side alternates by card (01 left, 02 right, 03 left, 04 right) — see `swing`.
              <motion.div
                key={c.title}
                className="lp-svcm__card"
                style={{
                  background: c.color,
                  x: cardX,
                  rotate: cardRotate,
                  opacity: cardOpacity,
                }}
              >
                <div className="lp-svcm__card-top">
                  <span className="lp-svcm__num">{String(active + 1).padStart(2, '0')}</span>
                  <div className="lp-svcm__meter">
                    <span className="lp-svcm__count">
                      {String(active + 1).padStart(2, '0')} / {String(cards.length).padStart(2, '0')}
                    </span>
                    <span className="lp-svcm__bar" aria-hidden="true">
                      <span
                        className="lp-svcm__bar-fill"
                        style={{ width: `${((active + 1) / cards.length) * 100}%`, background: c.accent }}
                      />
                    </span>
                  </div>
                </div>

                <h3 className="lp-svcm__card-title">{c.title}</h3>
                <p className="lp-svcm__card-sub">{c.sub}</p>

                {/* Same source + poster derivation the desktop card uses (vid is a showcaseVideos
                    entry, not a bare path). key on src so switching cards remounts the element and
                    the new clip actually starts, rather than the old one continuing under a new src. */}
                {videos[active] && (
                  <div className="lp-svcm__video">
                    <video
                      key={videos[active].src}
                      src={videos[active].src}
                      poster={cldPoster(videos[active].src)}
                      muted
                      loop
                      playsInline
                      autoPlay
                      preload="none"
                    />
                  </div>
                )}

                <p className="lp-svcm__card-desc">{c.desc}</p>
                <button
                  type="button"
                  className="lp-svcm__cta"
                  style={{ background: c.btnBg, color: c.btnText }}
                  onClick={() => navigate('/auth?mode=signup&role=business')}
                >
                  Discover our approach <ArrowRight size={16} />
                </button>
              </motion.div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

function PromiseChrome({ progress, cards, children }) {
  const total = cards.length;
  const beat = (PROMISE_EXIT_END - PROMISE_EXIT_START) / (total - 1);
  const [active, setActive] = useState(0);
  useMotionValueEvent(progress, 'change', (p) => {
    // Card i occupies the front slot from PROMISE_EXIT_START + i·beat onwards —
    // the exact same arithmetic PromiseCard uses for its own `frontAt`.
    const i = Math.floor((p - PROMISE_EXIT_START) / beat);
    const next = i < 0 ? 0 : i > total - 1 ? total - 1 : i;
    setActive((prev) => (prev === next ? prev : next));
  });
  // 0→1 across the deck, then softened by a light spring so the path draw and the
  // rail fill ease instead of tracking raw scroll 1:1. Stiff enough that it still
  // looks identical scrolling back up (a slack spring lags by direction).
  const deckP = useTransform(progress, [PROMISE_EXIT_START, PROMISE_EXIT_END], [0, 1], { clamp: true });
  const draw = useSpring(deckP, { stiffness: 150, damping: 28, mass: 0.35 });
  // The arrowhead only makes sense once the line has actually arrived, so it fades in
  // over the last stretch of the draw rather than sitting there from the start.
  const arrowIn = useTransform(draw, [0.84, 1], [0, 1], { clamp: true });
  const accent = cards[active].accent;

  return (
    <>
      {/* Short rule under the heading — takes the active card's accent. */}
      <span className="lp-promise-rule" style={{ background: accent }} aria-hidden="true" />

      <div className="lp-promise-stage">
        {/* ── Left column ──────────────────────────────────────────────────────
            A short statement plus the marker and the curve that travels from it
            down to the card. Desktop only — below 1280px the whole column drops
            out and the deck goes back to full width, centred. */}
        <div className="lp-svc-aside">
          <h3 className="lp-svc-aside__title">
            We make content<br />
            <em style={{ color: accent }}>work harder.</em>
          </h3>
          <p className="lp-svc-aside__sub">
            No fluff. No middlemen.<br />
            Just content that connects<br />
            and drives real results.
          </p>
          {/* The curve overflows the column to the right (see CSS) so its arrow lands
              just short of the card's left edge. A static ghost copy shows the whole
              route; the accent copy on top reveals along it via pathLength as you
              scroll. xMaxYMid meet keeps the scale UNIFORM — anchored at the arrow end
              — so the marker stays a circle and the arrowhead keeps its angle however
              the column is sized. */}
          <div className="lp-svc-path" aria-hidden="true">
            <svg viewBox="0 0 300 190" preserveAspectRatio="xMaxYMid meet" fill="none">
              <path d={SVC_PATH_D} stroke="rgba(23,19,52,.13)" strokeWidth="1.4"
                    strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <motion.path d={SVC_PATH_D} stroke={accent} strokeWidth="1.4"
                    strokeLinecap="round" vectorEffect="non-scaling-stroke"
                    style={{ pathLength: draw }} />
              <motion.path d={SVC_ARROW_D} stroke={accent} strokeWidth="1.4"
                    strokeLinecap="round" strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke" style={{ opacity: arrowIn }} />
              {/* Origin marker: an opaque disc so the curve reads as starting FROM it. */}
              <circle cx="20" cy="22" r="11.5" fill="var(--lp-page-bg, #faf7f2)"
                      stroke="rgba(23,19,52,.10)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
              <circle cx="20" cy="22" r="5.5" fill={accent} className="lp-svc-path__dot" />
            </svg>
          </div>
        </div>

        {/* ── Centre column: the untouched card deck ── */}
        {children}

        {/* ── Right column: the 01–04 rail. Numbers sit at the deck's own top and
            bottom edges, one per card, on a 1px track whose fill grows with the
            same scroll value — so the fill reaches dot n exactly as card n
            takes the front slot. ── */}
        <div className="lp-svc-rail" aria-hidden="true">
          <span className="lp-svc-rail__track">
            <motion.span className="lp-svc-rail__fill" style={{ scaleY: draw, background: accent }} />
          </span>
          <ul className="lp-svc-rail__list">
            {cards.map((c, i) => (
              <li key={c.title} className={`lp-svc-rail__item${i === active ? ' is-active' : ''}`}>
                <span
                  className="lp-svc-rail__dot"
                  style={i === active ? { background: c.accent, boxShadow: `0 0 0 4px ${c.accent}24` } : undefined}
                />
                <span className="lp-svc-rail__num" style={i === active ? { color: c.accent } : undefined}>
                  0{i + 1}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}

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

// Per-layout leaderboard tuning. PHONE packs the rows tighter (gap), keeps MORE of them on
// screen (range), and fades them out more slowly (cutoff/fade) so several statements are
// readable at once instead of just ~3 with a big empty gap below. Desktop keeps its originals.
//   peak/step/floor → size falloff · gap → row spacing px · range → ±rows shown ·
//   cutoff/fade → opacity falloff.
function lbTuning(phone) {
  return phone
    // PHONE → web's centre-scale falloff, but a SUBTLE tilt and roomier spacing so the lines
    // never overlap: top lines lean gently left, the middle stays straight, bottom lines lean
    // gently right (~6° per row, max ~9°). Fewer rows (range 2) + steeper fade keep it clean.
    ? { peak: 34, step: 8, floor: 6, gap: 92,  range: 2, cutoff: 2.2,  fade: 0.46, rotK: 6,  rotMax: 9 }
    : { peak: 34, step: 8, floor: 6, gap: 160, range: 3, cutoff: 2.55, fade: 0.38, rotK: 8, rotMax: 24 };
}

// Full visual state for a row at focus-offset `o` — a pure function used both for the
// first paint (inline style) and inside the imperative scroll updater below. Phone and
// desktop share the SAME animation (translateY stack + 2D rotate + scale falloff) — only
// the tuning differs (lbTuning packs the rows tighter on phones). Both: fontSize via scale
// · opacity falloff · white→grey colour (quantized) · weight 500/400/300 · hidden past ±range.
function rowVisualAt(v, index, total, phone) {
  const { peak, step, floor, gap, range, cutoff, fade, rotK, rotMax } = lbTuning(phone);
  const o = index - ((v / LOGO3D_SCROLL_END) * total - LB_PRE);
  const a = o < 0 ? -o : o;
  if (a > range) return { display: 'none' };
  const ty = o * gap;
  // PHONE flips the tilt sign so a line travels left-tilt (top) → straight (middle) →
  // right-tilt (bottom) → gone. Desktop keeps its original direction.
  const rotRaw = o > 0 ? Math.min(o * rotK, rotMax) : Math.max(o * rotK, -rotMax);
  const rot = phone ? -rotRaw : rotRaw;
  const sc = Math.max(floor, peak - a * step) / peak;
  // Quantize the grey to discrete steps so text re-rasters only when it crosses a step.
  const colorKey = a < 0.12 ? 1000 : Math.round(Math.max(70, 235 - a * 60) / 24);
  const lum = colorKey * 24;
  return {
    display: 'flex',
    transform: `translate(-50%, -50%) translateY(${ty}px) rotate(${rot}deg) scale(${sc})`,
    opacity: a < cutoff ? 1 - a * fade : 0.03,
    color: colorKey === 1000 ? '#ffffff' : `rgb(${lum},${lum},${lum})`,
    fontWeight: a < 0.22 ? 500 : a < 1.3 ? 400 : 300,
    pointerEvents: a < 0.5 ? 'auto' : 'none',
  };
}

// One leaderboard row, animated measured.site-style. The whole list shares one scroll
// value. Rather than 6 separate MotionValues per row (≈66 reactive chains for the list,
// each writing a style every scroll frame), we drive every property IMPERATIVELY from a
// SINGLE subscription and only touch the expensive ones — colour, font-weight, display,
// pointer-events — when their DISCRETE value actually changes. Most frames therefore
// write just transform + opacity (both GPU-composited), which is what removes the
// mid-scroll leaderboard jank.
function LeaderboardRow({ progress, index, count }) {
  const phone = useIsPhone();
  const ref = useRef(null);
  const total = count - 1 + LB_PRE;                 // full focus travel

  // First paint matches the current scroll position so rows never flash at centre.
  const initial = rowVisualAt(progress ? progress.get() : 0, index, total, phone);

  useEffect(() => {
    if (!progress) return;
    const el = ref.current;
    if (!el) return;
    // Per-layout tuning (phone packs more rows, fades slower) — shared with rowVisualAt.
    const { peak, step, floor, gap, range, cutoff, fade, rotK, rotMax } = lbTuning(phone);
    // Seed trackers to -1 so the first apply() writes every property once, then skips.
    let lastColor = -1;
    let lastWeight = -1;
    let lastShown = -1;
    let lastPe = -1;

    const apply = (v) => {
      const o = index - ((v / LOGO3D_SCROLL_END) * total - LB_PRE);
      const a = o < 0 ? -o : o;

      // show/hide past ±range — toggled only on change (avoids per-frame reflow)
      const shown = a > range ? 0 : 1;
      if (shown !== lastShown) {
        lastShown = shown;
        el.style.display = shown ? 'flex' : 'none';
      }
      if (!shown) return;                            // fully hidden — skip all paint work

      // transform + opacity — cheap, GPU-composited, every frame.
      // PHONE flips the tilt sign (top → left, bottom → right); desktop keeps its direction.
      const ty = o * gap;
      const rotRaw = o > 0 ? (o * rotK > rotMax ? rotMax : o * rotK) : (o * rotK < -rotMax ? -rotMax : o * rotK);
      const rot = phone ? -rotRaw : rotRaw;
      const sc = Math.max(floor, peak - a * step) / peak;
      el.style.transform = `translate(-50%, -50%) translateY(${ty}px) rotate(${rot}deg) scale(${sc})`;
      el.style.opacity = a < cutoff ? 1 - a * fade : 0.03;

      // pointer-events — only near focus, toggled on change
      const pe = a < 0.5 ? 1 : 0;
      if (pe !== lastPe) { lastPe = pe; el.style.pointerEvents = pe ? 'auto' : 'none'; }

      // colour — quantized; re-rasters only when it steps
      const colorKey = a < 0.12 ? 1000 : Math.round(Math.max(70, 235 - a * 60) / 24);
      if (colorKey !== lastColor) {
        lastColor = colorKey;
        if (colorKey === 1000) el.style.color = '#ffffff';
        else { const lum = colorKey * 24; el.style.color = `rgb(${lum},${lum},${lum})`; }
      }

      // weight — 3 discrete states; changes a handful of times per pass
      const weight = a < 0.22 ? 500 : a < 1.3 ? 400 : 300;
      if (weight !== lastWeight) { lastWeight = weight; el.style.fontWeight = weight; }
    };

    apply(progress.get());
    return progress.on('change', apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, index, total, phone]);

  return (
    <a
      ref={ref}
      className="lp-logo3d__boardItem"
      href="#"
      onClick={(e) => e.preventDefault()}
      style={initial}
    >
      <span className="lp-logo3d__creator">{TOP_CREATORS[index]}</span>
    </a>
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
  { value: '800+', label: 'D2C Brands Scaled' },
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
    quote: 'We stopped guessing. Every creative now ships with a reason behind it. The team actually looks forward to launch days, and our CTR has climbed every single month since we switched. It changed how we brief, shoot, and scale.',
    accent: 'a reason behind it',
    name: 'Priya Nair',
    role: 'Head of Growth, Lumen Skincare',
    photo: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&h=400&fit=crop&crop=faces',
    initials: 'PN',
    rating: 5,
    metric: '+38%',
    metricLabel: 'CTR uplift',
  },
  {
    quote: 'Our ads stopped feeling like ads, and that\'s when ROAS stabilized. We\'re finally spending with confidence instead of crossing our fingers on every campaign. The creators actually understand our brand before a single frame is shot.',
    accent: 'ROAS stabilized',
    name: 'Rohan Kapoor',
    role: 'Founder, Glowly · D2C Beauty',
    photo: 'https://images.unsplash.com/photo-1600896997793-b8ed3459a17f?w=400&h=400&fit=crop&crop=faces',
    initials: 'RK',
    rating: 5,
    metric: '+2.3×',
    metricLabel: 'ROAS in 60 days',
  },
  {
    quote: 'Finally, content that doesn\'t scream "I was paid for this." Our audience engages with it like a friend\'s recommendation, and the hook rates speak for themselves. We\'ve never had creative this authentic at this kind of volume.',
    accent: 'doesn\'t scream',
    name: 'Ananya Verma',
    role: 'CMO, Thix Hair',
    photo: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=faces',
    initials: 'AV',
    rating: 5,
    metric: '4.1×',
    metricLabel: 'Hook-rate lift',
  },
  {
    quote: 'We went from 12 mediocre creatives a month to 3 great ones, and sales doubled. Less noise, more trust — that trade turned out to be the best decision we made all year. Escrow meant we never once worried about the money.',
    accent: 'sales doubled',
    name: 'Marcus Lee',
    role: 'Founder, Gener8',
    photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=faces',
    initials: 'ML',
    rating: 5,
    metric: '2×',
    metricLabel: 'Revenue growth',
  },
  {
    quote: 'Creators vetted, money in escrow, one clean dashboard — we finally trust the numbers. That trust changed how aggressively we\'re willing to scale, because every rupee is now tied to a result we can actually see and approve.',
    accent: 'trust the numbers',
    name: 'Sara Malhotra',
    role: 'Marketing Lead, NestHome',
    photo: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&crop=faces',
    initials: 'SM',
    rating: 5,
    metric: '+61%',
    metricLabel: 'Conversion lift',
  },
];

const auditQuestions = [
  {
    title: 'Would Your Current Ad',
    sub: 'Convince You To Purchase?',
    Icon: SkipForward,
  },
  {
    title: 'If Your Brand Went Silent for a Week,',
    sub: 'Would Anyone Notice?',
    Icon: BellOff,
  },
  {
    title: 'Click the Ad',
    sub: "If It Wasn't Yours?",
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
  { id: 'finance',   Icon: IndianRupee,   label: 'Finance/Insurance' },
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
  { label: 'Costs',                            us: '₹₹',  inhouse: '₹₹₹\n(including salaries)', agencies: '₹₹₹₹', platforms: '₹' },
  { label: 'Creator quality',                  us: 'High', inhouse: 'Uncertain', agencies: 'Usually good', platforms: 'Low' },
  { label: 'Turnaround time',                  us: 'Within 14 days', inhouse: 'Unpredictable', agencies: '4-6 weeks', platforms: 'Days' },
  { label: 'Content quality',                  us: 'High', inhouse: 'Uncertain', agencies: 'Good', platforms: 'Low' },
  { label: 'Creative strategy support',        us: CHECK, inhouse: CROSS, agencies: CHECK, platforms: CROSS },
  { label: 'Control over content',             us: CHECK, inhouse: CHECK, agencies: CROSS, platforms: CHECK },
];

// "US vs Others" — three-column comparison (us vs traditional agencies vs marketplaces).
// Each side is a bold title + a supporting line (comparison-table style).
const vsRows = [
  {
    label: 'Creator Vetting',
    icon: UserCheck, themIcon: Users,
    us:        { title: 'Manually reviewed', desc: 'Every creator is vetted before they touch a brief' },
    agencies:  { title: 'Curated in-house', desc: 'Limited to the agency’s own small roster' },
    platforms: { title: 'Open sign-up', desc: 'Anyone can list themselves — no real vetting' },
  },
  {
    label: 'Payment Safety',
    icon: ShieldCheck, themIcon: ReceiptText,
    us:        { title: 'Held in escrow', desc: 'Funds are held by the platform until you approve the work' },
    agencies:  { title: 'Invoiced monthly', desc: 'Pay via retainer or invoice, little recourse' },
    platforms: { title: 'Pay upfront', desc: 'Pay in advance or chase refunds if it goes wrong' },
  },
  {
    label: 'Contact Protection',
    icon: Lock, themIcon: Users,
    us:        { title: 'On-platform only', desc: 'Names and contacts stay protected inside UGCad.io' },
    agencies:  { title: 'Held by the agency', desc: 'You never own the direct creator relationship' },
    platforms: { title: 'Easily poached', desc: 'Creators taken off-platform after the first deal' },
  },
  {
    label: 'Delivery Speed',
    icon: Package, themIcon: CalendarDays,
    us:        { title: 'Starts from 24 hours', desc: 'Tracked delivery, milestone by milestone' },
    agencies:  { title: '4–6 weeks', desc: 'Long agency timelines and endless back-and-forth' },
    platforms: { title: 'Unpredictable', desc: 'No guaranteed timeline, depends on the creator' },
  },
  {
    label: 'Cost',
    icon: Tag, themIcon: Tag,
    us:        { title: 'Commission only', desc: 'No retainers, no hidden markups' },
    agencies:  { title: '3–5× markup', desc: 'Agency markup plus a monthly retainer' },
    platforms: { title: 'Cheap but risky', desc: 'Lower cost, but quality and reliability vary a lot' },
  },
  {
    label: 'Support',
    icon: Headphones, themIcon: Headphones,
    us:        { title: 'Managed disputes', desc: 'The platform mediates if anything goes wrong' },
    agencies:  { title: 'Account manager', desc: 'Dedicated, but tied to a long-term contract' },
    platforms: { title: 'On your own', desc: 'No mediation when a deal falls apart' },
  },
];

// "What you can achieve" — cards scroll over a big sticky headline (alternating sides).
// Copy is easy to swap; edit titles/descs here.
// "Find & Hire Creators" showcase — 3 real clips (pulled from the same showcaseVideos
// pool used elsewhere) + a short vetting checklist, reference-style layout.
const FIND_HIRE_VIDEOS = [
  // All three pulled from /home (not /ma) — the /ma clips have no sibling poster .jpg,
  // so their card would show a blank black poster until playback starts.
  { id: 9, label: 'Fitness/Supplements', src: '/home/video_16.mp4', brand: 'FitFuel', creator: 'Noah' },
  { id: 4, label: 'Beauty/Cosmetics', src: '/home/video_06.mp4', brand: 'Glowly', creator: 'Maya' },
  { id: 7, label: 'Pets', src: '/home/video_13.mp4', brand: 'Pawfect', creator: 'Riya' },
];
const FIND_HIRE_FEATURES = [
  { icon: Shield, text: 'Tough vetting process: we only select the best creators.' },
  { icon: Users, text: 'The most talented creators across every niche and age group.' },
  { icon: Sparkles, text: 'Diverse niches: beauty, fitness, food, tech, pets & more.' },
  { icon: Zap, text: 'Fast turnaround: briefs matched and shot in days, not weeks.' },
];

const achieveItems = [
  {
    icon: Search, kicker: 'Discover', tag: 'Every niche · vetted',
    title: 'Discover Creators in Every Niche',
    desc: 'Beauty, fitness, tech, food, home, fashion, parenting, and more. Each one is manually reviewed before they ever touch a brief.',
  },
  {
    icon: Users, kicker: 'Support', tag: 'Guided matching',
    title: 'You’re Never Matching Alone',
    desc: 'Get hands-on support from our team while you find your match, so you always have a guide through the process.',
  },
  {
    icon: Shield, kicker: 'Protected', tag: 'Identity · quality',
    title: 'Identity Protected, Quality Proven',
    desc: 'You see an anonymous handle and the real brands they’ve worked with, never their personal contact details. Quality, proven. Identity, protected.',
  },
  {
    icon: MessageCircle, kicker: 'Collaborate', tag: 'One secure thread',
    title: 'Hire and Chat Securely',
    desc: 'Brief, message, revise, and approve, all in one thread, inside the platform. No scattered DMs, no lost context, no off-platform risk.',
  },
  {
    icon: IndianRupee, kicker: 'Control', tag: 'Your brief · your budget',
    title: 'Your Campaign, Your Budget',
    desc: 'Post your own brief and set your own budget. You decide the spend, the deliverables, and who you work with.',
  },
  {
    icon: Lock, kicker: 'Secure', tag: 'Escrow protected',
    title: 'Payments Held Safe in Escrow',
    desc: 'Your money is locked in escrow the moment you hire, and only released when you approve the final video. The creator knows they’ll be paid. You know you’ll get what you approved.',
  },
];

// Hero gallery poster stills — every /public/home/*.jpg exists (unlike the /ma clips,
// which have no sibling still), so no card ever shows a broken image.
const HERO_POSTERS = [
  '03', '04', '05', '06', '07', '10', '13', '15',
  '16', '19', '21', '22', '23', '24', '25', '26',
].map((n) => ({ poster: `/home/video_${n}.jpg`, video: `/home/video_${n}.mp4` }));

// Sixteen showcase video slots — local UGC clips from /public/home.
const showcaseVideos = [
  { id: 1, industryId: 'apps',    label: 'Apps/Software',    isVideo: true,
    src: '/ma/video_03.mp4',
    brand: 'Color By Number', creator: 'Abigail', logoBg: 'linear-gradient(135deg, #3A3A66, #fb923c)', logoText: 'CN', tier: 'RISING', rating: 4.8, avatar: '/avatars/a01.jpg', poster: '/posters/p01.jpg' },
  { id: 2, industryId: 'apps',    label: 'Apps/Software',    isVideo: true,
    src: '/ma/video_04.mp4',
    brand: 'Gener8',          creator: 'Chelsea', logoBg: 'linear-gradient(135deg, #1F1F4E, #07074e)', logoText: '8', tier: 'PRO', rating: 4.9, avatar: '/avatars/a02.jpg', poster: '/posters/p02.jpg' },
  { id: 3, industryId: 'family',  label: 'Family/Kids',      isVideo: true,
    src: '/ma/video_05.mp4',
    brand: 'Gatorade',        creator: 'Becki',   logoBg: 'linear-gradient(135deg, #fb923c, #f59e0b)', logoText: 'G', tier: 'ELITE', rating: 5.0, avatar: '/avatars/a03.jpg', poster: '/posters/p03.jpg' },
  { id: 4, industryId: 'beauty',  label: 'Beauty/Cosmetics', isVideo: true,
    src: '/home/video_06.mp4',
    brand: 'Glowly',          creator: 'Maya',    logoBg: 'linear-gradient(135deg, #fb7185, #f43f5e)', logoText: 'Gl', tier: 'PRO', rating: 4.7, avatar: '/avatars/a04.jpg', poster: '/posters/p04.jpg' },
  { id: 5, industryId: 'beauty',  label: 'Beauty/Cosmetics', isVideo: true,
    src: '/home/video_07.mp4',
    brand: 'Thix Hair',       creator: 'Lara',    logoBg: 'linear-gradient(135deg, #34d399, #14b8a6)', logoText: 'T', tier: 'ELITE', rating: 4.9, avatar: '/avatars/a05.jpg', poster: '/posters/p05.jpg' },
  { id: 6, industryId: 'beauty',  label: 'Beauty/Cosmetics', isVideo: true,
    src: '/home/video_10.mp4',
    brand: 'AirShine',        creator: 'Priya',   logoBg: 'linear-gradient(135deg, #1F1F4E, #1F1F4E)', logoText: 'A', tier: 'RISING', rating: 4.8, avatar: '/avatars/a06.jpg', poster: '/posters/p06.jpg' },
  { id: 7, industryId: 'pets',    label: 'Pets',             isVideo: true,
    src: '/home/video_13.mp4',
    brand: 'Pawfect',         creator: 'Riya',    logoBg: 'linear-gradient(135deg, #1F1F4E, #a855f7)', logoText: 'Pf', tier: 'ELITE', rating: 4.9, avatar: '/avatars/a07.jpg', poster: '/posters/p07.jpg' },
  { id: 8, industryId: 'food',    label: 'Food/Beverage',    isVideo: true,
    src: '/home/video_15.mp4',
    brand: 'BrewHaus',        creator: 'Sofia',   logoBg: 'linear-gradient(135deg, #78350f, #f59e0b)', logoText: 'BH', tier: 'PRO', rating: 4.8, avatar: '/avatars/a08.jpg', poster: '/posters/p08.jpg' },
  { id: 9, industryId: 'fitness', label: 'Fitness/Supplements', isVideo: true,
    src: '/home/video_16.mp4',
    brand: 'FitFuel',         creator: 'Noah',    logoBg: 'linear-gradient(135deg, #14532d, #22c55e)', logoText: 'FF', tier: 'RISING', rating: 4.7, avatar: '/avatars/a09.jpg', poster: '/posters/p09.jpg' },
  { id: 10, industryId: 'health', label: 'Health/Wellness',  isVideo: true,
    src: '/home/video_19.mp4',
    brand: 'VitaGlow',        creator: 'Emma',    logoBg: 'linear-gradient(135deg, #0e7490, #06b6d4)', logoText: 'VG', tier: 'ELITE', rating: 5.0, avatar: '/avatars/a10.jpg', poster: '/posters/p10.jpg' },
  { id: 11, industryId: 'travel', label: 'Travel',           isVideo: true,
    src: '/home/video_21.mp4',
    brand: 'NomadPack',       creator: 'Liam',    logoBg: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', logoText: 'NP', tier: 'PRO', rating: 4.8, avatar: '/avatars/a11.jpg', poster: '/posters/p11.jpg' },
  { id: 12, industryId: 'finance', label: 'Finance/Insurance', isVideo: true,
    src: '/home/video_22.mp4',
    brand: 'CoinKeep',        creator: 'Ava',     logoBg: 'linear-gradient(135deg, #3A3A66, #fbbf24)', logoText: 'CK', tier: 'RISING', rating: 4.7, avatar: '/avatars/a12.jpg', poster: '/posters/p12.jpg' },
  { id: 13, industryId: 'home',   label: 'Home/Household',   isVideo: true,
    src: '/home/video_23.mp4',
    brand: 'NestHome',        creator: 'Olivia',  logoBg: 'linear-gradient(135deg, #7c2d12, #fb7185)', logoText: 'NH', tier: 'PRO', rating: 4.9, avatar: '/avatars/a13.jpg', poster: '/posters/p13.jpg' },
  { id: 14, industryId: 'gaming', label: 'Gaming',           isVideo: true,
    src: '/home/video_24.mp4',
    brand: 'PlayVerse',       creator: 'Ethan',   logoBg: 'linear-gradient(135deg, #4c1d95, #8b5cf6)', logoText: 'PV', tier: 'ELITE', rating: 4.8, avatar: '/avatars/a14.jpg', poster: '/posters/p14.jpg' },
  { id: 15, industryId: 'charity', label: 'Charity',         isVideo: true,
    src: '/home/video_25.mp4',
    brand: 'CareCircle',      creator: 'Mia',     logoBg: 'linear-gradient(135deg, #831843, #ec4899)', logoText: 'CC', tier: 'RISING', rating: 4.9, avatar: '/avatars/a15.jpg', poster: '/posters/p15.jpg' },
  { id: 16, industryId: 'services', label: 'Consumer Services', isVideo: true,
    src: '/home/video_26.mp4',
    brand: 'SwiftServe',      creator: 'Lucas',   logoBg: 'linear-gradient(135deg, #1F1F4E, #0ea5e9)', logoText: 'SS', tier: 'PRO', rating: 4.7, avatar: '/avatars/a16.jpg', poster: '/posters/p16.jpg' },
];

// Curated pick for the "Our Services" promise cards (PromiseCard) — plain showcaseVideos[i]
// pulled whatever clip happened to sit at that index, which surfaced clips with burned-in
// captions unrelated (or actively off-brand, e.g. "scam kya hai?") to the card's own message.
// These 4 were chosen by eye for a clean, presenter-forward frame with no jarring product text.
const PROMISE_VIDEOS = [
  showcaseVideos.find((v) => v.id === 15), // "You can pay your gym" — closest thing to an
                                            // on-theme caption in the library, for the budget card
  showcaseVideos.find((v) => v.id === 16), // rooftop, no caption throughout
  showcaseVideos.find((v) => v.id === 4),  // "Let me share a little..." — clean opener line
  showcaseVideos.find((v) => v.id === 9),  // no caption throughout
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

// Proof panel — one wide mint card: big heading left, copy + CTAs middle, award-shield
// stat badges stacked down the right. The whole panel rises in once on scroll (the badges
// a beat later, staggered) instead of each stat animating forever.
//
// (This replaced a draggable fanned card-deck that cycled the three stats one at a time.
// The deck showed one stat at a time and needed a swipe/timer to reveal the rest; the
// shields show all three at once, which is what a proof section is actually for. The
// CountUp roll-up counter that predated the deck is gone for the same reason — the numbers
// are plain text now.)
const proofPanelVariants = {
  hidden: { opacity: 0, y: 34 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1], staggerChildren: 0.09, delayChildren: 0.18 },
  },
};
const proofBadgeVariants = {
  hidden: { opacity: 0, y: 18, scale: 0.94 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } },
};

// Nav-link hover text: each character gets its own clipped two-row slot (original label on
// top, a duplicate directly below it) with a small per-character transition-delay, so on
// hover the letters cascade up one after another left-to-right instead of the whole word
// moving as one block. Spaces render as   so they don't collapse inside the inline-block
// character spans.
const NAV_CHAR_SPACE = String.fromCharCode(160); // NBSP -- a plain space collapses inside inline-block spans
function NavHoverText({ text }) {
  const chars = text.split('');
  return (
    <span className="lp-navlink__text">
      {chars.map((ch, i) => {
        const glyph = ch === ' ' ? NAV_CHAR_SPACE : ch;
        return (
          <span className="lp-navlink__char" key={i} style={{ transitionDelay: `${i * 18}ms` }}>
            <span className="lp-navlink__char-row">{glyph}</span>
            <span className="lp-navlink__char-row" aria-hidden="true">{glyph}</span>
          </span>
        );
      })}
    </span>
  );
}

// Card grid. Four cards sit side by side on desktop and stack gracefully on smaller screens.
// Border-draw entrance for the achieve cards: two mirrored half-outlines, both starting
// at top-centre, tracing out to their respective top corner, down that side, and along
// the bottom back to bottom-centre — animated with the SAME timing so they visibly race
// out from the top and meet again at the bottom. Percentage coordinates (viewBox 0 0 100
// 100, preserveAspectRatio="none") so one path works for every card regardless of its
// actual pixel size; vector-effect keeps the stroke width from stretching with it.
const achieveCardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: i * 0.08 } }),
};

function AchieveFan({ items }) {
  const shown = items.slice(0, 4);
  return (
    <div className="lp-achieve__cards">
      {shown.map((item, i) => {
        const Icon = item.icon;
        return (
          <motion.article
            key={item.title}
            className="lp-achieve-card"
            custom={i}
            variants={achieveCardVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
          >
            {Icon ? <Icon className="lp-achieve-card__icon" strokeWidth={1.2} /> : null}
            <div className="lp-achieve-card__body">
              <h3 className="lp-achieve-card__title">{item.title}</h3>
              <p className="lp-achieve-card__desc">{item.desc}</p>
            </div>
          </motion.article>
        );
      })}
    </div>
  );
}

// Colour palette for the stacked deck — each card a distinct solid colour with a
// Mobile: the SAME card design as the desktop fan (.lp-achieve-card), but laid out as a
// sticky stacked deck — each card pins one-by-one as you scroll, the next sliding up over
// it. Pure CSS via position:sticky + a staggered top offset per card (.lp-achieve-stackcard).
function AchieveStack({ items }) {
  return (
    <div className="lp-achieve__stack">
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <article
            key={item.title}
            className="lp-achieve-card lp-achieve-stackcard"
            style={{ '--i': i, zIndex: i + 1 }}
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
  const { theme } = useTheme();
  // <html>/<body> have no background of their own, which leaves the scrollbar-gutter strip
  // reserved by `scrollbar-gutter: stable` in App.css showing the browser's plain white/grey
  // canvas instead of blending into the page — a visible seam down the right edge. Landing's
  // own data-theme is hardcoded to "light" (not the site theme context), so this has to
  // match that hardcoded value, not the global theme — otherwise the two can disagree (page
  // renders light, gutter renders whatever the visitor's site-wide theme happens to be) and
  // the seam is back. BOTH <html> and <body> need it: the gutter is reserved on <html>'s own
  // box, so body's background alone doesn't reach it.
  useEffect(() => {
    const bg = '#fefcf9';
    document.documentElement.style.background = bg;
    document.body.style.background = bg;
    return () => {
      document.documentElement.style.background = '';
      document.body.style.background = '';
    };
  }, []);
  const [scrolled, setScrolled] = useState(false);
  const [navHidden, setNavHidden] = useState(false);   // hide nav on scroll-down, reveal on scroll-up
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState(null);
  const [faqOpen, setFaqOpen] = useState(-1);
  // Proof panel: one entrance animation, fired the first time the section scrolls into
  // view. once:true — this is a static panel now (see proofPanelVariants), so re-running
  // the rise every time it scrolls back past would just be motion for its own sake.
  const proofSectionRef = useRef(null);
  const proofInView = useInView(proofSectionRef, { once: true, margin: '-120px' });

  // Testimonial carousel — infinite STEPPED spotlight. The centre card sits inside the
  // fixed corner-bracket frame at full strength; neighbours dim. It auto-advances one
  // card at a time, and the list is tripled so a card always fills both edges (no empty
  // gap) — when the index drifts out of the middle copy we snap back by N with the
  // transition off, so the loop is seamless.
  const T_LEN = testimonials.length;
  const T_LOOP = [...testimonials, ...testimonials, ...testimonials];
  const [tIndex, setTIndex] = useState(T_LEN);   // start inside the middle copy
  const [tAnim, setTAnim] = useState(true);
  // Card width + gap live in CSS (--tcard-w / --tcard-gap); the track is centred with a
  // 50% margin and stepped purely by translating whole "pitches" — no JS pixel math, so
  // it can never collapse from a mis-measured width.
  const tTrackTransform = `translateX(calc(-${tIndex} * (var(--tcard-w) + var(--tcard-gap))))`;

  // Auto-advance: schedule the NEXT step 3800ms after each card settles. Skipped on the
  // instant wrap-snap frame (tAnim false) so a snap never triggers an extra slide — this
  // is what caused the jump/shift when the loop wrapped.
  useEffect(() => {
    if (!tAnim) return undefined;
    const id = setTimeout(() => setTIndex((i) => i + 1), 3800);
    return () => clearTimeout(id);
  }, [tIndex, tAnim]);

  // Seamless wrap: once the index leaves the middle copy, snap it back by N with the
  // transition momentarily disabled (620ms > the CSS slide, so the snap is invisible).
  useEffect(() => {
    if (tIndex >= 2 * T_LEN || tIndex < T_LEN) {
      const id = setTimeout(() => {
        setTAnim(false);
        setTIndex((i) => (i >= 2 * T_LEN ? i - T_LEN : i + T_LEN));
      }, 620);
      return () => clearTimeout(id);
    }
    return undefined;
  }, [tIndex, T_LEN]);

  // Re-enable the slide transition on the next frame after an instant snap.
  useEffect(() => {
    if (!tAnim) {
      const r = requestAnimationFrame(() => requestAnimationFrame(() => setTAnim(true)));
      return () => cancelAnimationFrame(r);
    }
    return undefined;
  }, [tAnim]);

  // Corner-bracket frame alignment. .lp-tcard has min-height:300px but grows taller for
  // longer quotes (auto height) — the frame's old top/bottom offsets were fixed pixel
  // values calculated for ONE assumed card height, so they only lined up for whichever
  // testimonial happened to match that height; every other one showed a gap on one edge
  // and a snug fit on the other. Measuring the actual active card's box each time it
  // changes (and settles, mid-slide) fixes it for every quote length, not just one.
  const tFrameRef = useRef(null);
  useEffect(() => {
    const align = () => {
      const frame = tFrameRef.current;
      const viewport = frame?.closest('.lp-testimonial__viewport');
      const card = viewport?.querySelector('.lp-tcard.is-active');
      if (!frame || !viewport || !card) return;
      const vpRect = viewport.getBoundingClientRect();
      const cardRect = card.getBoundingClientRect();
      const OUTSET = 3; // matches the bracket's intended 3px-outside-the-card gap
      frame.style.top = `${cardRect.top - vpRect.top - OUTSET}px`;
      frame.style.bottom = `${vpRect.bottom - cardRect.bottom - OUTSET}px`;
    };
    const id = setTimeout(align, 350); // after the slide transition settles
    window.addEventListener('resize', align);
    return () => { clearTimeout(id); window.removeEventListener('resize', align); };
  }, [tIndex]);

  const visibleShowcase = selectedIndustry
    ? showcaseVideos.filter((v) => v.industryId === selectedIndustry)
    : showcaseVideos;

  // Showcase rows split once at component scope so the SAME row-1 data can be reused at the top
  // of the hero on mobile (a marquee row fills the empty space above the title). The showcase
  // section below then hides its own first row on mobile so the row isn't shown twice.
  const showcaseItemsAll = visibleShowcase.length ? visibleShowcase : showcaseVideos;
  const showcaseMid = Math.ceil(showcaseItemsAll.length / 2);
  const showcaseRow1 = showcaseItemsAll.slice(0, showcaseMid);
  const renderShowcaseCard = (v, idx, prefix) => (
    <div key={`${prefix}-${v.id}-${idx}`} className="lp-showcase-item">
      <div className="lp-showcase-card">
        {v.isVideo ? (
          // Eager-load only the first few HERO-row cards (the ones on screen at page load) so
          // they start instantly; the rest stay lazy to avoid many simultaneous downloads.
          <LazyVideo src={v.src} className="lp-showcase-card__media" eager={prefix === 'HERO' && idx < 5} />
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

  // Freeze the marquee scroll animation while the section is off-screen (videos pause
  // themselves via the per-card observer in LazyVideo). One observer on the section, not one
  // per track. '' (empty) when visible so the per-row :hover pause CSS still wins; hard
  // 'paused' when the section is gone, so no CPU burns on an animation nobody can see.
  const showcaseRef = useRef(null);
  useEffect(() => {
    const section = showcaseRef.current;
    if (!section) return;
    const tracks = section.querySelectorAll('.lp-showcase__track');
    const obs = new IntersectionObserver(
      ([entry]) => {
        tracks.forEach((t) => {
          t.style.animationPlayState = entry.isIntersecting ? '' : 'paused';
        });
      },
      { threshold: 0, rootMargin: '200px 0px' }
    );
    obs.observe(section);
    return () => obs.disconnect();
  }, [selectedIndustry]);

  // Pause every OTHER continuous CSS marquee while it's off-screen. The brand-logo strip
  // animates `infinite`, so without this it keeps the compositor running — and drains
  // battery — even when scrolled far away and nobody can see it. (The showcase marquee
  // has its own observer above.)
  useEffect(() => {
    const tracks = document.querySelectorAll('.lp-brands__track');
    if (!tracks.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          e.target.style.animationPlayState = e.isIntersecting ? '' : 'paused';
        });
      },
      { rootMargin: '120px 0px' }
    );
    tracks.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  const featuresRef = useRef(null);
  const ctaRef = useRef(null);
  const featuresInView = useInView(featuresRef, { once: true, margin: '-80px' });

  // Audit cards — scroll-linked peel. The three questions sit as a fanned DECK on a tall
  // pinned runway; as you scroll they fly UP off the top one at a time (Q1, Q2, Q3), so the
  // deck visibly empties. (This replaced the accordion row list + cursor-trailing preview
  // card — back to the original stacked-card treatment, restyled for the light page.)
  const auditRef = useRef(null);
  const { scrollYProgress: auditProgress } = useScroll({
    target: auditRef,
    offset: ['start start', 'end end'],
  });
  // Destination for the audit rows. #services is the "Our Services" section — the answer to
  // the questions the rows pose. scrollIntoView rather than a hash link so it animates and
  // doesn't push a history entry the back button then has to undo.
  const goToServices = () => {
    document.getElementById('services')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  // "Find & Hire" achieve section scroll — used (mobile) to lift the pinned heading UP in sync
  // with the card deck as it scrolls off, so the heading leaves WITH the cards instead of staying
  // pinned until the whole deck is gone. y holds at 0 while the deck stacks (heading pinned via
  // CSS sticky), then ramps up over the exit window so heading + cards clear the screen together.
  const achieveRef = useRef(null);
  // Drives the fade+slide-up stagger on the Find & Hire video cards (cardVariants below) —
  // separate from achieveProgress, which is the section's own scroll-linked pin/exit logic.
  const findHireCardsInView = useInView(achieveRef, { once: true, margin: '-100px' });
  // 'end start' so progress runs until the section has fully scrolled ABOVE the viewport — this
  // captures the card EXIT (cards scrolling off the top), which 'end end' cut off. No exit runway
  // padding needed, so there's no dead empty band below the stacked deck.
  const { scrollYProgress: achieveProgress } = useScroll({
    target: achieveRef,
    offset: ['start start', 'end start'],
  });
  // Heading holds pinned (y=0) while the deck stacks; once the cards are all together (~0.66) it
  // lifts up locked to them as they scroll off — so it starts going up exactly when the pile is
  // complete, not before and not after.
  const achieveHeadRise = useTransform(achieveProgress, [0.66, 0.82], [0, -520]);
  // Three cards peel UP, evenly spread across the WHOLE scroll range so there's no dead
  // progress after the last card. The 3rd card (card1Y) is still exiting right up to ~0.99,
  // so the runway never sits idle/blank — the section ends the moment the last card clears,
  // and the next section (pulled up below) is already sliding in. No gap.
  // Gentle spring + easeInOut so each card GLIDES off (accelerate → decelerate)
  // instead of tracking raw scroll 1:1. Paired with the taller section below, the
  // whole peel reads slow and smooth.
  // Declared here (moved up from below) so the peel-springs can be frozen on mobile.
  // Lazy-init so the first render already knows mobile vs desktop; a matchMedia listener
  // in an effect later keeps it in sync on resize.
  const [heroStatic, setHeroStatic] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches
  );
  const PEEL_SPRING = { stiffness: 64, damping: 26, mass: 0.9 };
  // Desktop glide-springs. These run a per-frame rAF physics loop while their source moves, so
  // on mobile — where the cards use the raw mAudit* transforms below instead — the spring
  // sources are frozen to a constant (output [0,0]); three idle springs animating during the
  // exact window the deck peels would steal frames and stutter Q2/Q3.
  const card2Y = useSpring(useTransform(auditProgress, heroStatic ? [0, 1] : [0.04, 0.33], heroStatic ? [0, 0] : [0, -800], { ease: easeInOut }), PEEL_SPRING);
  const card3Y = useSpring(useTransform(auditProgress, heroStatic ? [0, 1] : [0.36, 0.65], heroStatic ? [0, 0] : [35, -800], { ease: easeInOut }), PEEL_SPRING);
  const card1Y = useSpring(useTransform(auditProgress, heroStatic ? [0, 1] : [0.68, 0.99], heroStatic ? [0, 0] : [-35, -800], { ease: easeInOut }), PEEL_SPRING);
  // Mobile peel — bound DIRECTLY to scroll (NO spring). On a phone the soft PEEL_SPRING made the
  // cards trail the finger and keep drifting after the scroll stopped; a raw useTransform is a
  // pure function of scroll position (still eased across each range), so they track exactly.
  // The peel spans the FULL runway (last card finishes ~0.99, right as the section unpins) so a
  // card is always moving — no dead stretch where you scroll and nothing happens.
  const mAuditQ1Y = useTransform(auditProgress, [0.05, 0.36], [0, -760], { ease: easeInOut });
  const mAuditQ2Y = useTransform(auditProgress, [0.36, 0.67], [0, -760], { ease: easeInOut });
  const mAuditQ3Y = useTransform(auditProgress, [0.67, 0.99], [0, -760], { ease: easeInOut });
  // The next section (Find & Hire) is pulled UP in lockstep with the last card's peel: while Q3
  // rises [0.62 → 1.0] it slides up from below (620px → 0) so it's "stuck" to the card and is
  // already on screen the moment the deck empties.
  // The rise alone isn't enough — landing on y=0 still leaves it a full screen below, because the
  // deck's reserved box stays behind as dead space once the cards have flown off. So the section
  // ALSO carries a static negative margin (.lp-achieve-rise in CSS — it has to be CSS, not an
  // inline px value, because the size of that dead space is viewport-height dependent). It's a
  // permanent overlap by design: the space it eats is only ever empty (the cards are
  // position:absolute and have left by then), and .lp-achieve's own top padding still supplies
  // the real gap between the two sections.
  const achieveRiseRaw = useTransform(auditProgress, [0.62, 1.0], [620, 0], { ease: easeInOut });
  const achieveRiseY = useSpring(achieveRiseRaw, { stiffness: 90, damping: 22, mass: 0.6 });
  // Mobile: the Find & Hire section is pulled up via a STATIC negative margin (CSS) to follow the
  // peeled audit cards — NOT a scroll-driven transform, which would break the section's sticky
  // heading + sticky card stack (transformed ancestor detaches sticky descendants → overlap).
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
  // Mobile starts the leaderboard timeline as the section SCROLLS INTO VIEW — offset start
  // 'center' means progress begins the moment the section's top reaches mid-screen, so the
  // come-up + row flow run while it's entering instead of only after it pins at the very top
  // (which is why it used to look like nothing happened until you'd scrolled past it). Desktop
  // keeps start-at-pin. Read once at mount via matchMedia (the offset isn't reactive to resize).
  const lbStartInView = typeof window !== 'undefined'
    && window.matchMedia('(max-width: 768px)').matches;
  const { scrollYProgress: logo3dProgress } = useScroll({
    target: logo3dRef,
    offset: lbStartInView ? ['start center', 'end end'] : ['start start', 'end end'],
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
  // Mobile: a 3D logo fills the empty space BELOW the leaderboard text (text sits in the upper
  // third, this fills the lower gap). It's visible from the START of the leaderboard, then TRAVELS
  // DOWN and DISSOLVES onto the brand strip's centre logo as the strip rises (~0.45) — a hand-off.
  // Fade fully BEFORE the brand strip rises in (~0.45) so the 3D mark and the strip's own
  // centre logo never sit on screen together as an offset "duplicate". The descend + shrink
  // complete on the same beat, so it dissolves away just as the strip takes over.
  // Dissolve IN the brand-strip rise (the strip rises 0.45→0.7): the mark fades 0.54→0.66, so it
  // dissolves as the strip comes up and is gone just before it settles — synced to that animation,
  // neither early (gone before the strip) nor lingering after it.
  const mobileStageOpacity = useTransform(logo3dProgress, [0.0, 0.03, 0.54, 0.66], [0, 1, 1, 0]);
  // y descent that carries the mark down toward the rising brand-strip centre logo while it fades.
  const mobileStageDown = useTransform(logo3dProgress, [0.44, 0.62], [0, -120]);
  // Shrink as it dissolves [0.54→0.66] so the mark looks like it's merging INTO the small brand
  // logo — runs together with the spin + fade over the same window.
  const mobileStageScale = useTransform(logo3dProgress, [0.54, 0.66], [1, 0.4]);
  // Spin completes by 0.6 — the moment the shrink/fade/move (mobileStageScale/Down/Opacity) begins.
  // Holding the spin constant through the dissolve means NO WebGL re-render during that window, so
  // the shrink runs purely on cheap CSS-composited transforms (no lag). The dissolve still animates
  // (scale/opacity/y keep going) — only the expensive per-frame 3D redraw stops.
  const mobileStageSpin = useTransform(logo3dProgress, [0.0, 0.66], [0, 1]);
  // Brand strip is "stuck" to the leaderboard's LAST line — defined below, after heroStatic, so
  // the lift can be tuned per layout (mobile needs a big lift, desktop almost none). See brandRise.
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
  // SHRINK gradually from 1.1 down to 0.9 by the time the leaderboard spin starts (0.67),
  // then HOLD 0.9 CONSTANT through the whole leaderboard spin window (0.67→0.86) so the
  // spinning logo sits at a steady size (~215 × 235px on a ~1086px-wide viewport — 0.9 of
  // the 22vw × 33vh box), then shrink into the dissolve. The decrease is spread over 0→0.67
  // (not the fast 0→0.3 spin) so each frame's size delta is tiny = smooth, not a janky jump;
  // holding 0.9 across the spin keeps the leaderboard rotation perfectly steady. Start 1.1
  // stays under the ~1.2 clip threshold (the mark is fit with ~20% canvas padding via
  // <Bounds margin={1.2}>).
  // Linear (constant-rate) scaling so the size changes at a STEADY pace — easeInOut sped up
  // through the middle of each segment, which read as the logo "jumping" size at one point.
  // Keep the mark a CONSTANT size through the whole hero + leaderboard, then melt it down at the
  // dissolve. The shrink window is small in scroll terms, so a raw transform jumped 1→0.5 in a
  // couple of frames on a flick (read as an INSTANT size pop). A MODERATE spring (stiffness 120 —
  // NOT the old laggy 55) eases the size change over ~200ms so it visibly, smoothly decreases,
  // while tracking tightly enough it never trails the scroll. Window widened slightly (0.82→0.97).
  const flyScaleRaw = useTransform(journeyP, [0, 0.82, 0.97], [1.0, 1.0, 0.42]);
  const flyScale = useSpring(flyScaleRaw, { stiffness: 120, damping: 24, mass: 0.45 });
  // Leaderboard is "stuck" to the hero buttons (Join as Creator / Sign up as Brand): as they
  // scroll up and off when the hero un-pins (journeyP ~0.22→0.66), the board is PULLED UP from
  // below the fold to meet them, so it rises into the buttons' place instead of waiting for the
  // section to naturally reach the top at 0.66 (which left a long dead black gap = the buttons
  // gone, no rows yet).
  // KEY: the pull is NEGATIVE y (translate UP). The board naturally enters from the bottom and
  // its first row only reaches centre at section-pin (0.66). To stick it to the buttons we lift
  // it early: y ramps 0 → -300px from 0.30→0.55 (board flies up from the bottom edge into the
  // centre right as the buttons clear the top), then eases back -300 → 0 by 0.66 — and because
  // the page is itself scrolling the board up over that same window, the net effect is the first
  // row PARKS near centre, reading as the leaderboard riding up locked to the departing buttons.
  // Stops are tuned per layout from the measured scroll→position map (the geometries differ:
  // desktop hero is a pinned 150vh, mobile hero is auto-height and just scrolls). MOBILE: the
  // button clears the top at journeyP≈0.29 while row 1 is still far below the fold, so we PULL
  // the board up (y→-360) to land row 1 at screen-centre right as the button leaves, then settle
  // to its -190 rest as the section pins (≈0.46). DESKTOP keeps its ORIGINAL behaviour untouched
  // ([0.35,0.67]→[220,0] + easeInOut) — the mobile tuning is gated behind heroStatic so it never
  // changes the web/desktop scroll.
  const boardRiseRaw = useTransform(
    // Mobile drives the come-up off logo3dProgress (the SECTION's own scroll, 0 = section
    // reaches the top), NOT journeyP — journeyP spans the whole hero+section, so on mobile the
    // rise kicked in only after a lot of scroll, out of sync with the section appearing. Now it
    // starts AS the leaderboard arrives. Desktop keeps journeyP.
    heroStatic ? logo3dProgress : journeyP,
    heroStatic ? [0, 0.24] : [0.35, 0.67],
    // Mobile: the board lifts -100 over a slightly longer window so it visibly "comes up with"
    // the hero as the heading scrolls off (closes the dead gap), settling into the upper-centre.
    // Monotonic ease to rest (no overshoot bounce), and the logo's offset below keeps it placed.
    heroStatic ? [0, -100] : [220, 0],
    { ease: easeInOut }
  );
  const boardRiseY = useSpring(
    boardRiseRaw,
    heroStatic ? { stiffness: 300, damping: 34, mass: 0.35 } : { stiffness: 120, damping: 22, mass: 0.6 }
  );
  // Mobile no longer renders a 3D logo in this section — the leaderboard carries the
  // moment on its own (spotlight pill on the centred line + a climax ping on the last).
  // Brand strip "stick" — MOBILE ONLY. On mobile the transform lifts the strip up to meet the
  // leaderboard's fading last line and HOLDS (never releases → never sinks back), and a matching
  // marginBottom:brandRise on the wrapper shifts the showcase + everything below up the same amount
  // so they stay flush. DESKTOP keeps its ORIGINAL behaviour untouched ([0.62,0.72]→[380,0] +
  // easeInOut, no margin) — gated behind heroStatic so the web scroll never changes.
  // Mobile lift: the brand strip rises up to stick behind the last leaderboard rows as they
  // fade, and a matching marginBottom drags the showcase + rest up to stay flush. Keep this
  // MODEST — the shorter 175vh section already closes most of the gap, so too large a value
  // over-pulls the showcase up UNDER the strip (it then overlaps / paints on top). -260 sits
  // them flush; raise toward 0 if they still overlap, more negative if a gap reopens.
  // brandRise chain removed — the brand strip no longer rises on scroll (it was overlapping
  // the showcase). It now sits statically in normal flow.
  // On MOBILE drive the board + brand strip DIRECTLY off scroll (the *Raw values), not the
  // spring outputs. A spring trails the finger and keeps drifting/settling after the scroll
  // stops — that's the "lag" on a phone — and each spring also runs its own rAF loop every
  // scroll frame on top of the WebGL logo + 11 leaderboard rows. The raw useTransform tracks
  // scroll 1:1 (still eased) → these big containers move exactly with the scroll, buttery and
  // lag-free. Desktop keeps the springs (it has the GPU headroom and the glide is intentional).
  const boardRiseYUsed = heroStatic ? boardRiseRaw : boardRiseY;
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
  // Centre horizontally (by 0.92) so the mark dissolves onto the brand strip's centre logo.
  const flyX = useTransform(journeyP, [0.3, 0.67, 0.86, 0.92], ['30vw', logoX, logoX, '2.4vw']);
  // Drift down toward the brand strip's centre logo (0.92→1.0) — but the fade below now
  // completes by ~0.95, so the mark dissolves around the CENTRE-logo level and is gone long
  // before it would reach the showcase heading (that low, lingering drop was the bleed).
  const flyY = useTransform(journeyP, [0.3, 0.67, 0.92, 1.0], ['2vh', logoY, logoY, '36vh']);
  // Fade out as it reaches the CENTRE logo (0.89→0.95), driven by journeyP (symmetric on
  // scroll up/down). It travels to centre and starts its downward drift, but is fully gone
  // by ~0.95 — dissolving at the centre-logo level, before the drop would carry a still-
  // visible logo down into the showcase heading (that lingering low drop was the bleed).
  const flyOpacity = useTransform(journeyP, [0.89, 0.95], [1, 0]);
  // Tip + spin are driven by the SECTION's own scroll (logo3dProgress), NOT the
  // journey scroll — so the logo rotates continuously and IN SYNC with the leaderboard
  // rows. Lands ~logo3dProgress 0.43 as row 1 focuses, so the spin starts right there
  // and runs to FULL by 0.9 — spinning across the whole row list, never freezing early.
  const logoSpinP = useTransform(logo3dProgress, [0.14, 0.8], [0, 1]);
  // On small screens, skip the pinned scroll choreography and fall back to a
  // clean stacked static hero (inline motion styles are dropped). Reduced-motion
  // is intentionally NOT a trigger — the scroll sequence is core to this hero.
  // Lazy-init from matchMedia so the FIRST render already knows mobile vs desktop — otherwise
  // mobile mounts the desktop branch, then flips after mount, and framer-motion's `initial`
  // (which only runs on mount) never plays the audit cards' scroll-in animation.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const update = () => setHeroStatic(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);


  useEffect(() => {
    let lastY = window.scrollY;
    const handleScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 40);
      // "Our Services" pins the navbar open. Its stacked cards are read by scrolling
      // DOWN through them, which is exactly the gesture that normally hides the bar —
      // so the nav would be missing for the whole section. Overrides the direction
      // logic below (and returns early) for as long as the section is on screen.
      const svc = logo3dRef.current;
      if (svc) {
        const r = svc.getBoundingClientRect();
        if (r.top < window.innerHeight && r.bottom > 0) {
          setNavHidden(false);
          lastY = y;
          return;
        }
      }
      // Direction-aware: scrolling DOWN past the hero hides the bar; any upward
      // scroll brings it back. Near the very top it always stays visible.
      if (y <= 80) setNavHidden(false);
      else if (y > lastY + 4) setNavHidden(true);
      else if (y < lastY - 4) setNavHidden(false);
      lastY = y;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Hero gallery — the poster cards auto-scroll as one infinite row while riding a fixed
  // 3D curve: each card's DEPTH (translateZ) is the primary effect — the centre bulges
  // forward toward the viewer, both sides recede back into the screen — plus a subtle
  // rotateY (cards angle to face the centre, never past ~10°), a small residual vertical
  // arc, and a gentle scale/shadow falloff so distant cards read as smaller and softer.
  // All of it is computed every frame from each card's own live distance from the
  // viewport's horizontal centre, so the curve is pinned in space (not to any one card)
  // and works the same at any screen width without hardcoding per-breakpoint values.
  const nlpGalleryRef = useRef(null);
  // ── Make the HERO SECTION itself edge-to-edge ───────────────────────────────
  // Widening only .nlp-gallery-vp could never work: .nlp-hero has overflow:hidden, so
  // anything the gallery does to escape is immediately clipped back to the hero's own
  // (inset) box. And the hero is inset by paddings it can't see — index.css applies
  // `padding: 0 var(--site-h-pad) !important` to BOTH #root and .lp-root, so the
  // accumulated gutter is 2×12px before .nlp-hero's own 24px even starts.
  //
  // So pull the SECTION flush with the viewport instead. Its overflow:hidden then clips
  // at the real screen edge (which is what we want — it's the horizontal-scroll guard),
  // and the gallery's existing `width: calc(100% + 48px); margin: 0 -24px` cancels the
  // hero's own 24px padding to land exactly on the viewport edges.
  //
  // Measured live rather than hardcoded: --site-h-pad is a variable, the !important
  // rules apply at two levels, and each can change independently.
  useLayoutEffect(() => {
    const el = heroRef.current;
    if (!el) return undefined;
    const align = () => {
      // Reset FIRST so every run measures the natural, un-corrected position —
      // otherwise each resize compounds the previous run's own correction.
      el.style.marginLeft = '';
      el.style.width = '';
      const rect = el.getBoundingClientRect();
      // documentElement.clientWidth, NOT window.innerWidth: innerWidth includes the
      // scrollbar gutter (html{scrollbar-gutter:stable} always reserves one), so using
      // it overshoots by the scrollbar width and re-introduces horizontal overflow.
      // clientWidth is the true layout viewport — this is the exact mismatch that made
      // earlier vw-based attempts at this land a few px off.
      const vw = document.documentElement.clientWidth;
      const deltaLeft = rect.left;              // >0 → inset from the left edge
      const deltaRight = vw - rect.right;       // >0 → short of the right edge
      if (Math.abs(deltaLeft) > 0.5 || Math.abs(deltaRight) > 0.5) {
        // marginLeft pulls it flush left; width grows by BOTH deltas so the right edge
        // closes in the same pass (shifting alone would just move the gap to the right).
        el.style.marginLeft = `${-deltaLeft}px`;
        el.style.width = `${rect.width + deltaLeft + deltaRight}px`;
      }
    };
    align();
    window.addEventListener('resize', align);
    return () => window.removeEventListener('resize', align);
  }, []);
  useEffect(() => {
    const track = nlpGalleryRef.current;
    const vp = track?.parentElement;
    if (!track || !vp) return undefined;
    // The cylinder now runs at EVERY width — mobile included. It used to be gated behind
    // matchMedia('(min-width: 901px)'), which left phones with a flat, manually-swiped row.
    // The geometry is already viewport-relative (geomAt divides dx by halfViewport), so the
    // curve maps itself onto a 390px screen without retuning; only the card size and gap
    // change, in the ≤900px CSS below. Genuinely weak devices are still excluded via
    // IS_LOW_END — that's the right axis for "can this afford a per-frame transform loop",
    // not screen width, and it's the same flag that already gates video decode above.
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    let raf = 0;
    let offset = 0;
    let last = 0;
    let halfW = 0;
    // Card stride (width + gap), measured once instead of read per-frame — see step().
    let cardW = 0;
    let gapPx = 0;
    // ── Cylinder geometry ──────────────────────────────────────────────────────
    // The row is the wall of a cylinder with the VIEWER INSIDE it: screen-centre is
    // the far wall (cards small + pushed back), and both edges curve toward the
    // viewer (cards big, rushing out past the screen edge). Depth alone drives the
    // size difference — the browser's own perspective divide does the scaling, which
    // is what makes it read as real 3D rather than a flat scale() animation.
    // Depths are expressed as a FRACTION of the focal length, not absolute px. The
    // projected size of a card at depth z is P/(P−z), so a fixed z with a shorter lens
    // means a far more violent near/far split: the original absolute -260/+170 against
    // mobile's 520px perspective gave a 0.67x centre and a 1.49x edge — a 2.2x ratio that
    // made the two edge cards balloon over the whole screen and crush the middle ones.
    // Tying them to P keeps the ratio identical at every breakpoint (0.81x → 1.18x, a
    // 1.46x spread), so the phone shows the same cylinder shape the desktop does.
    // Values chosen so a 1100px lens reproduces the original -260 / +170 exactly.
    const Z_CENTRE_RATIO = -0.2364;  // far wall — smallest
    const Z_EDGE_RATIO = 0.1545;     // nearest the viewer — "coming out of the screen"
    // Mobile only shows 3 cards (vs desktop's 7), so each edge card is a much bigger share
    // of the row and the same proportional bump read as oversized against the middle 3.
    // Gentler edge-only ratio at ≤900px — centre depth (and therefore the shrink toward
    // the middle) is untouched, only how much the two edge cards balloon is reduced.
    //
    // 0.078 -> -0.03, a second pass on the same complaint. Measured at 390px, the old value
    // rendered the corner cards 216px and 191px tall against 162-169px in the middle: a
    // 1.34x spread, which is what reads as "the corner ones are too big".
    // The maths, since the number looks arbitrary otherwise: perspective scale is
    // P/(P-z), so centre (z = -0.2364P) sits at 0.809 and the edge at 0.078P sat at 1.085
    // -> 1.085/0.809 = 1.34. A NEGATIVE edge ratio puts the edge card just behind the lens
    // plane instead of in front of it: -0.03P gives 0.971, so the spread drops to ~1.20 and
    // the corner cards come down roughly 10%. The cylinder still reads as curved (the edges
    // are still the largest cards); they just stop dominating the row.
    // Push this further toward -0.075 for a ~1.15 spread if they still feel heavy.
    const Z_EDGE_RATIO_MOBILE = -0.03;
    let Z_CENTRE = -260;
    let Z_EDGE = 170;
    const MAX_TILT = 38;    // deg each card turns to stay tangent to the cylinder
    // Read from `perspective` on .nlp-gallery-vp rather than duplicated as a constant.
    // The gap correction below inverts this exact value, so the two MUST agree — and they
    // can't be kept in sync by hand any more now that the ≤900px rule sets its own,
    // shorter focal length (1100px is far too long a lens for a ~390px-wide screen and
    // flattens the curve to nothing). measure() refreshes it, so crossing the breakpoint
    // on resize/rotate picks up the new value automatically. 1100 is only the fallback
    // for the first frame, before measure() has run.
    let PERSPECTIVE_PX = 1100;

    // Projected geometry of a card whose CENTRE lands at screen offset `dx` from the
    // vanishing point: its depth, its tilt, and — the whole point of this helper —
    // the width it actually covers on screen once perspective has had its way with it.
    const geomAt = (dx, halfViewport, halfCard) => {
      // -1 at the left viewport edge, 0 at screen centre, +1 at the right edge.
      // Clamped: cos() below would invert past ±1 and flip the whole effect.
      let c = dx / halfViewport;
      c = c < -1 ? -1 : c > 1 ? 1 : c;
      // Cosine profile: 1 at screen centre, 0 at both edges. Finite, gentle slope
      // everywhere (unlike a circular sqrt curve, which goes vertical at |c|=1 and
      // made the last card lurch), so the wrap stays even right out to the edge.
      const curve = Math.cos((Math.PI / 2) * c);
      // Depth on the cylinder wall. The perspective divide on .nlp-gallery-vp turns
      // this into the size falloff by itself: centre sits at Z_CENTRE (far → small),
      // both edges reach Z_EDGE (near → big). No scale() term, so nothing fights the
      // perspective.
      const z = Z_EDGE + (Z_CENTRE - Z_EDGE) * curve;
      // Turn each card to stay tangent to the cylinder — negative on the right half
      // so its outer edge swings toward the viewer, positive on the left half.
      const rot = -c * MAX_TILT;
      const th = (rot * Math.PI) / 180;
      const cx = halfCard * Math.cos(th);
      const sx = halfCard * Math.sin(th);
      // Pre-projection x that lands the card's centre back on dx:
      //   originX + xc·P/(P−z) = originX + dx  →  xc = dx·(P−z)/P
      const xc = (dx * (PERSPECTIVE_PX - z)) / PERSPECTIVE_PX;
      // rotateY throws the card's two side edges to DIFFERENT depths (z ∓ halfCard·sinθ),
      // so each edge gets its own perspective divide. That asymmetry is why a tilted card
      // near the row's end projects far WIDER than cardW × scale would suggest.
      const pr = ((xc + cx) * PERSPECTIVE_PX) / (PERSPECTIVE_PX - (z - sx));
      const pl = ((xc - cx) * PERSPECTIVE_PX) / (PERSPECTIVE_PX - (z + sx));
      return { z, rot, w: Math.abs(pr - pl) };
    };

    // ── Even VISUAL gaps ───────────────────────────────────────────────────────
    // Evenly spaced card CENTRES are not evenly spaced card GAPS. By the time a card
    // reaches the end of the row it is both nearer (z→Z_EDGE) and turned (±38°), and
    // per geomAt above that made its projected width outrun the 224px layout stride —
    // so the outer cards touched/overlapped while the small centre ones sat ~80px apart.
    //
    // So lay the row out along a "visual gap" axis instead: card n's projected centre is
    //   q(n) = ∫₀ⁿ (W(q) + gap) dn
    // which puts consecutive centres one average card-width plus a CONSTANT gap apart at
    // every depth. W depends on q, so this is an ODE — forward-integrated once here (and
    // on resize), never per frame. The gap used is the CSS `gap` on .nlp-gallery, so that
    // value now literally means "space between two cards" in the 3D row too.
    const MAP_DN = 0.125;      // integration step, in cards
    let spacingMap = null;     // spacingMap[k] = projected offset at n = k × MAP_DN
    let mapSlope = 0;          // px per card past the table's end (straight tail)
    const buildSpacingMap = (halfViewport) => {
      spacingMap = null;
      const halfCard = cardW / 2;
      if (!halfCard || !halfViewport) return;
      // W is even in q (mirror-symmetric row), so only the positive half is stored.
      const map = [0];
      let q = 0;
      const limit = halfViewport * 2.2;   // integrate well past the clip edge
      for (let k = 0; k < 4000 && q < limit; k++) {
        q += MAP_DN * (geomAt(q, halfViewport, halfCard).w + gapPx);
        map.push(q);
      }
      if (map.length < 2) return;
      mapSlope = (map[map.length - 1] - map[map.length - 2]) / MAP_DN;
      spacingMap = map;
    };
    // Signed card index from screen centre → projected screen offset from the
    // vanishing point. Pure lookup, so it can't drift or break the seamless wrap:
    // when the marquee wraps, a card inherits its predecessor's index and therefore
    // its exact transform.
    const projectedX = (n) => {
      const a = Math.abs(n) / MAP_DN;
      const k = Math.floor(a);
      const end = spacingMap.length - 1;
      // Past the table the cards are far off-screen and clipped anyway; a straight
      // linear tail keeps them out there without the integral running away (W keeps
      // growing with |q|, so continuing it would blow up exponentially).
      const q = k >= end
        ? spacingMap[end] + (a - end) * MAP_DN * mapSlope
        : spacingMap[k] + (a - k) * (spacingMap[k + 1] - spacingMap[k]);
      return n < 0 ? -q : q;
    };

    const measure = () => {
      halfW = track.scrollWidth / 2;
      const first = track.children[0];
      cardW = first ? first.offsetWidth : 0;
      const cs = getComputedStyle(track);
      gapPx = parseFloat(cs.columnGap || cs.gap) || 0;
      // Pull the focal length straight off the element the browser projects through, so
      // the desktop and ≤900px values in the CSS are the only place it's defined. `none`
      // (or an unparseable value) falls back to the desktop number rather than NaN, which
      // would poison every division in geomAt.
      PERSPECTIVE_PX = parseFloat(getComputedStyle(vp).perspective) || 1100;
      // Re-derive the depths from it, so the near/far size ratio is the same on a phone
      // as on a desktop even though the two use different focal lengths — except the edge
      // ratio, which swaps to a gentler mobile-only value (see Z_EDGE_RATIO_MOBILE above).
      const isMobileWidth = (document.documentElement.clientWidth || 0) <= 900;
      Z_CENTRE = Z_CENTRE_RATIO * PERSPECTIVE_PX;
      Z_EDGE = (isMobileWidth ? Z_EDGE_RATIO_MOBILE : Z_EDGE_RATIO) * PERSPECTIVE_PX;
      // After PERSPECTIVE_PX / the depths — the map integrates geomAt, which uses all three.
      buildSpacingMap((document.documentElement.clientWidth || 2) / 2);
    };

    const step = (ts) => {
      if (!last) last = ts;
      const dt = Math.min(64, ts - last);
      last = ts;
      offset += dt * 0.045;                 // scroll speed (px/ms)
      if (halfW && offset >= halfW) offset -= halfW;   // seamless wrap at the mid-point

      // ── ALL layout reads happen here, up front, BEFORE any style write ────────
      // Card positions are computed ARITHMETICALLY (stride × index − scroll offset)
      // rather than read back with getBoundingClientRect per card. Transforms never
      // affect layout, so the untransformed position of card i is exactly
      // trackLeft + i×stride — no measuring needed. That turns 32 forced-layout reads
      // per frame into one, which is what makes the marquee actually smooth.
      const vpRect = vp.getBoundingClientRect();
      const vpLeft = vpRect.left;
      // The vanishing point CSS projects through: perspective-origin defaults to 50% 50%,
      // i.e. the viewport box's own centre. The gap correction below measures from here.
      const originX = vpLeft + vpRect.width / 2;
      // clientWidth (not innerWidth) — innerWidth counts the scrollbar gutter, which
      // would put the cylinder's "centre" a few px right of the visual centre.
      const viewportCenter = document.documentElement.clientWidth / 2;
      const halfViewport = viewportCenter || 1;
      const stride = cardW + gapPx;

      // ── writes ────────────────────────────────────────────────────────────────
      track.style.transform = `translateX(${-offset}px)`;
      const cards = track.children;
      const halfCard = cardW / 2;
      if (spacingMap && stride > 0) {
        for (let i = 0; i < cards.length; i++) {
          // Untransformed (layout) centre of card i — pure arithmetic, no readback.
          const cardCentre = vpLeft + i * stride + halfCard - offset;
          // Its position on the even-gap axis, as a fractional card index either side
          // of the vanishing point, then the screen offset that index maps to.
          const q = projectedX((cardCentre - originX) / stride);
          const g = geomAt(q, halfViewport, halfCard);
          // Nudge the card so that AFTER the perspective divide its centre lands on q.
          const tx = originX + (q * (PERSPECTIVE_PX - g.z)) / PERSPECTIVE_PX - cardCentre;
          cards[i].style.transform = `translateX(${tx}px) translateZ(${g.z}px) rotateY(${g.rot}deg)`;
        }
      }
      raf = requestAnimationFrame(step);
    };
    // Whether the gallery is actually on screen right now — without this, the rAF loop
    // below (32 getBoundingClientRect + style writes, every frame) kept running for as
    // long as the page stayed open, even after the user scrolled miles past this section,
    // permanently stealing frame budget from everything else on the page.
    let inView = false;
    let hasStartedOnce = false;
    const start = () => {
      if (raf || IS_LOW_END || reduce.matches || !inView) return;
      const beginPlayback = () => {
        if (raf || !inView) return; // state may have changed while this was deferred
        last = 0;
        measure();
        raf = requestAnimationFrame(step);
      };
      if (!hasStartedOnce) {
        hasStartedOnce = true;
        // Defer only the very FIRST start past the page's initial mount burst — this huge
        // page mounts ~20 other scroll-tracking hooks (useScroll/useInView) across its many
        // sections in the same React commit, and their own initial layout measurements all
        // land in that same tick. Measured: a real ~1.4s main-thread block right at mount.
        // Starting the hero's own animation (its own measure() + rAF loop) a beat later, once
        // the browser is actually idle, means it doesn't compete inside that burst — which is
        // what read as the row visibly "stopping for a second" right as the page loads. Later
        // start/stop cycles (scrolling the gallery in/out of view) stay immediate as before.
        if (typeof requestIdleCallback === 'function') {
          requestIdleCallback(beginPlayback, { timeout: 300 });
        } else {
          setTimeout(beginPlayback, 120);
        }
      } else {
        beginPlayback();
      }
    };
    const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; };
    const clear = () => {
      track.style.transform = '';
      for (const el of track.children) {
        el.style.transform = '';
      }
    };
    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        if (inView) start(); else { stop(); }
      },
      { rootMargin: '200px' }
    );
    io.observe(vp);
    const onResize = () => { measure(); };
    // Was keyed to the width media query; now only "reduce motion" can turn the cylinder
    // off mid-session, so that's what's listened to. Rotating a phone still re-measures
    // through onResize, which rebuilds the spacing map for the new viewport half-width.
    const onReduce = () => { stop(); if (!IS_LOW_END && !reduce.matches && inView) start(); else clear(); };
    window.addEventListener('resize', onResize);
    reduce.addEventListener('change', onReduce);
    return () => {
      stop();
      io.disconnect();
      window.removeEventListener('resize', onResize);
      reduce.removeEventListener('change', onReduce);
    };
  }, []);

  // Play/pause each hero-arch clip based on real visibility (not just "on screen" — the
  // IntersectionObserver algorithm clips through .nlp-gallery-vp's overflow-x:clip, so a
  // card cropped off by the arch's edge correctly counts as not-intersecting).
  //
  // This used to call v.play()/v.pause() directly, which — unlike every other video section
  // on the page — never routed through the shared playVideoCapped()/releaseVideo() budget.
  // The comment here claimed it kept "a handful" of the 32 clips decoding at once, but that
  // was just an assumption, not an enforced cap: MAX_PLAYING_VIDEOS is Infinity on desktop
  // (fine for sections where only 1-2 cards are ever near-viewport), and this full-width arch
  // is the exception — being the HERO, it's wide enough that many cards cross the 40%
  // visibility threshold at once on first load. Measured: ~4.2MB of MP4 fetched around first
  // paint before any scrolling. A local FIFO cap (mirroring the shared one, but scoped to just
  // this arch so it doesn't change behavior anywhere else on the page) fixes that.
  useEffect(() => {
    const track = nlpGalleryRef.current;
    if (!track) return undefined;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return undefined;
    const videos = track.querySelectorAll('video');
    // Must be >= the number of cards visible AT ONCE, or the cap itself becomes the bug.
    // Desktop was 6 while the cylinder shows ~7 cards across plus a partial at each edge —
    // so a card entering from the right found every slot taken, went into `waiting`, and
    // only started once a card exited on the LEFT, i.e. roughly when it reached centre.
    // That is exactly the "queue behind clips already playing near centre" failure the
    // VIDEO_PLAY_MARGIN comment at the top of this file describes for the other marquees.
    // 10 covers the widest desktop case; mobile shows 3 across + 2 partials, hence 5 (the
    // shared MAX_PLAYING_VIDEOS already treats 6 as safe on phones).
    const HERO_ARCH_MAX_PLAYING = IS_MOBILE ? 5 : 10;
    const playing = new Set();
    const waiting = new Set();
    const play = (v) => {
      if (playing.has(v)) return;
      if (playing.size < HERO_ARCH_MAX_PLAYING) {
        waiting.delete(v);
        playing.add(v);
        v.play().catch(() => {});
      } else {
        waiting.add(v);
      }
    };
    const pause = (v) => {
      const wasPlaying = playing.delete(v);
      waiting.delete(v);
      v.pause();
      if (wasPlaying) {
        for (const next of waiting) {
          if (next.isConnected) { play(next); break; }
          waiting.delete(next);
        }
      }
    };
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) play(entry.target); else pause(entry.target);
        }
      },
      // 0.4 -> 0.15 -> 0.01. Same bug, twice under-corrected: a card cropped by the screen
      // edge is only a few percent visible BY AREA, so it sat under the threshold and never
      // started — the "cards at the left/right edge don't play" report. Measured: the card
      // parked at the right edge had ratio 0.069, i.e. still under 0.15.
      // 0.01 is safe here. A card scrolled past the viewport, or clipped away entirely by
      // .nlp-gallery-vp's overflow, has ratio exactly 0 and is still treated as gone; only
      // genuinely-visible slivers now count. Concurrency stays bounded by
      // HERO_ARCH_MAX_PLAYING above (10 desktop / 5 mobile) — the threshold was never what
      // was limiting decode count, it was only ever deciding WHEN a visible card starts.
      { threshold: 0.01 }
    );
    videos.forEach((v) => io.observe(v));

    // Third piece: buffer the clip BEFORE it reaches the edge. These <video>s are
    // preload="none" (there are 32 of them — preloading all at first paint is what that
    // attribute is there to avoid), so calling play() as a card slid in kicked off a
    // network fetch at that moment and nothing actually moved until the data landed. Even
    // with a slot free and the threshold met, the card still looked frozen on its way in.
    // A wide-rootMargin observer flips it to preload="auto" roughly a screen-width early,
    // so by the time the play observer fires the data is already there.
    const primer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const v = entry.target;
          primer.unobserve(v);          // one-shot: once primed it stays primed
          v.preload = 'auto';
          // load() restarts playback, so never call it on a clip already running. It can't
          // be one here in practice (this fires while the card is still off-screen), but
          // the marquee wraps and re-enters, so the guard is worth having.
          if (!playing.has(v)) v.load();
        }
      },
      { rootMargin: '200px 900px' }
    );
    videos.forEach((v) => primer.observe(v));

    return () => { io.disconnect(); primer.disconnect(); };
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

  // `lp-nav-hidden` mirrors the navbar's own hide/show state onto the root, so sticky
  // elements further down the page (the comparison table's pinned header) can react to it
  // in CSS — see .lpv-header, which pins flush to the top only while the navbar is away
  // and steps down below it when the navbar comes back.
  return (
    <div className={`lp-root${IS_LOW_END ? ' lp-perf-lite' : ''}${navHidden ? ' lp-nav-hidden' : ''}`} data-theme="light">

      {/* ── Animated background blobs ───────────────────────────────────── */}
      <div className="lp-bg-animations" aria-hidden="true">
        <div className="lp-bg-blob lp-bg-blob--1" />
        <div className="lp-bg-blob lp-bg-blob--2" />
        <div className="lp-bg-blob lp-bg-blob--3" />
        <div className="lp-bg-blob lp-bg-blob--4" />
      </div>

      {/* ── Navbar — white floating pill ──────────────────────────────────── */}
      <motion.header
        className={`lp-navbar${scrolled ? ' lp-navbar--scrolled' : ''}${navHidden ? ' lp-navbar--hidden' : ''}`}
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <div className="lp-navbar__inner">
          <button
            type="button"
            className="lp-navbar__brand"
            aria-label="UGCad.io — back to top"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <img src="/ugcad-logo.png" alt="UGCad.io" className="lp-navbar__logo" />
          </button>

          <nav className="lp-navbar__links">
            <a className="lp-navlink" href="#" onClick={(e) => { e.preventDefault(); navigate('/auth?mode=signup&role=business'); }}>
              <NavHoverText text="Explore Creators" />
            </a>
            <a className="lp-navlink" href="/creator" onClick={(e) => { e.preventDefault(); navigate('/creator'); }}>
              <NavHoverText text="Join as Creator" />
            </a>
            <a className="lp-navlink" href="#proof" onClick={(e) => { e.preventDefault(); document.getElementById('proof')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
              <NavHoverText text="Proof" />
            </a>
            <a className="lp-navlink" href="#services" onClick={(e) => { e.preventDefault(); document.getElementById('services')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
              <NavHoverText text="Services" />
            </a>
          </nav>

          <div className="lp-navbar__actions">
            <button className="lp-btn-login" onClick={() => navigate('/auth?role=business')}>
              Log in
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
          <a className="lp-navlink" href="#" onClick={(e) => { e.preventDefault(); setMenuOpen(false); navigate('/auth?mode=signup&role=business'); }}>
            Explore Creators
          </a>
          <a className="lp-navlink" href="#" onClick={(e) => { e.preventDefault(); setMenuOpen(false); navigate('/creator'); }}>
            Join as Creator
          </a>
          <a className="lp-navlink" href="#proof" onClick={(e) => { e.preventDefault(); setMenuOpen(false); document.getElementById('proof')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
            Proof
          </a>
          <a className="lp-navlink" href="#services" onClick={(e) => { e.preventDefault(); setMenuOpen(false); document.getElementById('services')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>
            Services
          </a>
          <div className="lp-navbar__mobile-actions">
            <button className="lp-btn-login" onClick={() => { setMenuOpen(false); navigate('/auth?role=business'); }}>
              Log in
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
      {!heroStatic && journeyActive && !IS_LOW_END && (
        <motion.div
          className="lp-logo-fly"
          // Stay MOUNTED the whole time and drive visibility PURELY by scroll position
          // (flyOpacity). No state-based gate (pastBoard) — that got "stuck" after you
          // hit the bottom and never let the logo come back on the way up. flyOpacity is
          // symmetric, so scroll up behaves identically to scroll down.
          style={{ x: flyX, y: flyY, scale: flyScale, opacity: flyOpacity }}
          aria-hidden="true"
        >
          <Suspense fallback={null}>
            {/* journeyP drives BOTH phases inside HeroLogo3D: hero 360°+colour, then
                the leaderboard landscape tip + barrel-roll. */}
            <HeroLogo3D progress={journeyP} theme={theme} />
          </Suspense>
        </motion.div>
      )}

      {/* ── Hero — light "stunning videos" redesign ────────────────────────── */}
      <section className="nlp-hero" ref={heroRef}>
        <motion.span
          className="nlp-badge"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          Trusted by 800+ D2C brands
        </motion.span>

        <motion.h1
          className="nlp-title"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05 }}
        >
          {/* No hard <br>: at the top of the display clamp "Behind The Top 1% D2C Brands"
              is wider than .nlp-title's 980px box, so a forced break would overflow it.
              Left to wrap on its own, exactly as the old landing page did.

              "The Performance" is held together with a nowrap span though — otherwise the
              line breaks straight after "The", stranding a two-letter word on its own line
              above the fold. Only that pair is pinned; the rest still wraps freely, so this
              can't overflow the way a hard <br> would. Splitting the accent across two spans
              is purely structural — they sit adjacent, so the colour reads as one phrase. */}
          <span className="nlp-title-nb">The <span className="nlp-title-accent">Performance</span></span>{' '}
          <span className="nlp-title-accent">System</span>{' '}
          Behind The Top <span className="nlp-title-accent">1% D2C Brands</span>
        </motion.h1>

        <motion.p
          className="nlp-sub"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.12 }}
        >
          Top-notch UGC video ads in just a few clicks.
          <br className="nlp-sub-break" />
          {' '}Unlock serious growth with <span className="nlp-sub-accent">high-performing UGC ads</span>.
        </motion.p>

        <div className="nlp-gallery-vp">
          <div className="nlp-gallery" ref={nlpGalleryRef}>
            {/* Autoplay muted/looped, but only while actually on screen — an
                IntersectionObserver (below) play()/pause()s each clip as the arch
                scrolls it in and out, so all 32 instances are never decoding at once. */}
            {[...HERO_POSTERS, ...HERO_POSTERS].map((p, i) => (
              <figure className="nlp-card" key={i}>
                <video
                  src={p.video}
                  poster={p.poster}
                  muted
                  loop
                  playsInline
                  preload="none"
                />
              </figure>
            ))}
          </div>
        </div>

        <div className="nlp-cta-wrap">
          <span className="nlp-note nlp-note--free" aria-hidden="true">
            It's free
            <svg viewBox="0 0 70 40" className="nlp-note-arrow2"><path d="M4,10 C24,34 44,34 60,18" fill="none" stroke="#3a3a3a" strokeWidth="2.4" strokeLinecap="round"/><path d="M50,22 L61,17 L58,29" fill="none" stroke="#3a3a3a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </span>
          {/* Both hero CTAs, same split (and same test ids) the page has always had:
              creators go to the creator landing, brands go straight to signup.
              EMPHASIS IS ON "Sign up as Brand": it carries the filled .nlp-cta and the
              creator route takes the outline --ghost. Only the styling swapped — each
              button keeps its own destination and data-testid, so nothing that targets
              them by id changes meaning. */}
          <button
            className="nlp-cta nlp-cta--ghost"
            onClick={() => navigate('/creator')}
            data-testid="get-started-btn"
          >
            Join as Creator
          </button>
          <button
            className="nlp-cta"
            onClick={() => navigate('/auth?mode=signup&role=business')}
            data-testid="learn-more-btn"
          >
            Sign up as Brand
          </button>
        </div>
      </section>

      {/* ── 3D glass logo (left) + center copy — scroll-driven ──────────────── */}
      <section id="services" className={`lp-logo3d${logo3dInView ? ' is-in' : ''}`} ref={logo3dRef}>
        <div className="lp-logo3d__sticky">
          {/* Desktop: the fixed .lp-logo-fly overlay flies the 3D mark into this section.
              Mobile: no 3D logo here — the leaderboard carries the moment on its own. */}

          {/* Mobile: the 3D WebGL logo fills the space below the leaderboard text. The wrapper
              applies the descend (y) + shrink (scale) + dissolve (opacity) and the canvas spins
              about its vertical axis (mobileStageSpin), handing off into the brand strip below.
              Desktop keeps the full 3D fly/spin via .lp-logo-fly above. */}
          {heroStatic && logo3dInView && !IS_LOW_END && (
            <motion.div className="lp-logo3d__stage" style={{ opacity: mobileStageOpacity, y: mobileStageDown, scale: mobileStageScale }}>
              <Suspense fallback={<div className="lp-logo3d__placeholder" aria-hidden="true" />}>
                <HeroLogo3D progress={mobileStageSpin} theme={theme} verticalSpin idleSpin={false} />
              </Suspense>
            </motion.div>
          )}

          {/* leaderboard — scrolls vertically; each rank fades in one-by-one at centre */}
          {/* 4 colored cards, stacked one behind another (hover to bring forward). */}
          <div className="lp-promise-wrap">
            {/* Mobile gets an accordion instead of the pinned scroll-deck — see PromiseMobile.
                Rendering one OR the other (not both hidden by CSS) means the phone never
                mounts the deck's four scroll-driven cards or its 100vh runway at all. */}
            {heroStatic ? (
              <PromiseMobile cards={PROMISE_CARDS} videos={PROMISE_VIDEOS} navigate={navigate} progress={logo3dProgress} />
            ) : (
            <>
            <h2 className="lp-promise-heading">Our Services</h2>
            {/* PromiseChrome lays out the three-column stage — left aside + this deck +
                right 01–04 rail — and drives everything outside the cards off the same
                scroll value. The deck itself is passed straight through untouched. */}
            <PromiseChrome progress={logo3dProgress} cards={PROMISE_CARDS}>
              <div className="lp-promise">
                {PROMISE_CARDS.map((card, i) => (
                  <PromiseCard
                    key={card.title}
                    card={card}
                    i={i}
                    total={PROMISE_CARDS.length}
                    vid={PROMISE_VIDEOS[i]}
                    progress={logo3dProgress}
                    navigate={navigate}
                  />
                ))}
              </div>
            </PromiseChrome>
            </>
            )}
          </div>
        </div>
      </section>
      </div>{/* /lp-journey */}

      {/* ── Brand strip — stuck to the leaderboard's last row: rises UP in lockstep
          (brandRiseY) as the final rows fade, instead of waiting below. ── */}
      {/* Static wrapper: the scroll-linked rise (y) + the negative marginBottom pull were
          lifting the strip up and dragging the showcase under it (they overlapped). Removed
          so the strip stays at its own position and the showcase flows cleanly below it. */}
      <motion.div style={{ position: 'relative', zIndex: 3 }}>
      <section className="lp-brandstrip" ref={brandStripRef}>
        <div className="lp-hero__strip">
          {/* Two labels, one per breakpoint — the wording differs, not just the styling,
              so CSS alone can't switch between them. Exactly one is ever displayed (see
              .lp-brandstrip__label--web / --mob). */}
          <span className="lp-brandstrip__label lp-brandstrip__label--web">Trusted by leading<br /><span className="lp-brandstrip__label--accent">brands</span></span>
          <span className="lp-brandstrip__label lp-brandstrip__label--mob">Supporting today's <span className="lp-brandstrip__label--accent">top brands</span></span>
          <div className="lp-brands__viewport">
            <div className="lp-brands__track lp-brands__track--single">
              {(() => {
                // Full brand set from /public/brand (encodeURI handles the spaces and
                // parentheses in the filenames). The names are export junk and say nothing
                // about which brand they are, so each is labelled — otherwise reordering or
                // pruning this list means opening all 16 files to find out what they show.
                // Ordered to spread the recognisable marks through the loop rather than
                // clustering them. Keep in sync with the folder: an entry with no matching
                // file is hidden by the onError below, so a stale list fails SILENTLY —
                // which is exactly how this list came to reference 13 files that no longer
                // existed, leaving the strip running on 3 logos.
                // `s` = optical scale, the fraction of the strip's logo height this mark
                // renders at. It exists because a single height CANNOT size these evenly:
                // every file has a different amount of transparent padding baked in, and a
                // square icon at full height reads far heavier than a wordmark at the same
                // height (Rapido and Amazon were dwarfing Myntra and Seltyca). Square/round
                // marks therefore sit ~0.5-0.65 and wordmarks ~0.26-0.34, tuned by eye so
                // every logo carries the same visual weight rather than the same box size.
                // `faint` darkens artwork that is drawn in near-white grey and would
                // otherwise disappear against the cream strip.
                const brands = [
                  { f: 'Rapido-logo-removebg-preview.png', s: 0.52 },                        // Rapido — square icon
                  { f: 'images__5_-removebg-preview.png', s: 0.85 },                         // Myntra — wordmark
                  { f: 'images-removebg-preview (1).png', s: 0.85, faint: true },            // Seltyca — pale wordmark
                  { f: 'amazon-icon-logo-png_seeklogo-405254-removebg-preview.png', s: 0.68 }, // Amazon
                  { f: 'images__2_-removebg-preview (1).png', s: 0.85 },                     // Cristello — wordmark
                  { f: 'images (6).png', s: 0.52 },                                          // Swiggy — solid block
                  { f: 'images__4_-removebg-preview (1).png', s: 0.7 },                     // Euler
                  { f: 'images__1_-removebg-preview.png', s: 0.85 },                         // moder/ate — wordmark
                  { f: 'images__7_-removebg-preview.png', s: 0.9, faint: true },            // Sephora — pale mark
                  { f: 'images__3_-removebg-preview.png', s: 0.95 },                         // Paavi — circular
                  { f: 'logo-1-scaled.jpg', s: 0.52 },                                       // Kuku FM — solid block
                  { f: 'images__1_-removebg-preview (1).png', s: 0.62 },                     // red "a" mark
                  { f: 'images__2_-removebg-preview.png', s: 0.8 },                         // ornate monogram
                  { f: 'images-removebg-preview.png', s: 0.58 },                             // paper-plane mark
                  { f: 'images (8).png', s: 0.52 },                                          // spaid. — solid block
                  { f: 'images__4_-removebg-preview.png', s: 0.95 },                         // wreath/food mark
                ];
                // One duplicate of the whole set → a seamless -50% loop.
                return [...brands, ...brands];
              })().map((b, i) => (
                <div key={`B-${i}`} className="lp-brand-item">
                  <div
                    className={`lp-brand-item__icon${b.faint ? ' lp-brand-item__icon--faint' : ''}`}
                    style={{ '--logo-s': b.s }}
                  >
                    <img
                      src={encodeURI(`/brand/${b.f}`)}
                      alt=""
                      loading="lazy"
                      onError={(e) => { const it = e.currentTarget.closest('.lp-brand-item'); if (it) it.style.display = 'none'; }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      </motion.div>

      {/* ── Showcase — Best UGC on the internet (moved here, right after the brand strip) ── */}
      <section className="lp-showcase" ref={showcaseRef}>
        <div className="lp-showcase__inner">
          <h2 className="lp-showcase__heading">
            We created{' '}
            <span className="lp-showcase__heading--accent">10,000+</span>{' '}
            UGC ads<br className="lp-showcase__brk" /> that resulted in{' '}
            <span className="lp-showcase__heading--accent">100cr+</span>{' '}
            in sales
          </h2>
          <p className="lp-showcase__subtitle">Choose your industry to see examples!</p>

          {/* Industry filter pills — clicking one narrows the grid to that industry.
              A second click (or Reset) clears the filter back to all. All 13 industries
              show (used to cap at 9, silently dropping Finance/Travel/Home/Charity); the
              full-width spacer after the 5th just forces the desktop row to break 5/rest —
              it's already disabled below 1024px so mobile just wraps naturally. */}
          <div className="lp-showcase__filters">
            {industries.map((ind, i) => {
              const Ic = ind.Icon;
              const active = selectedIndustry === ind.id;
              return (
                <Fragment key={ind.id}>
                  <button
                    type="button"
                    className={`lp-filter${active ? ' is-active' : ''}`}
                    onClick={() => setSelectedIndustry(active ? null : ind.id)}
                    aria-pressed={active}
                  >
                    <Ic size={16} /> {ind.label}
                  </button>
                  {i === 4 && <span className="lp-showcase__filters-break" aria-hidden="true" />}
                </Fragment>
              );
            })}
            <button
              type="button"
              className="lp-filter lp-filter--reset"
              onClick={() => setSelectedIndustry(null)}
            >
              Reset
            </button>
          </div>

          {/* Responsive grid of example clips. Each shows its poster still and plays on
              hover (see ShowcaseVideo) — no native controls, so no play/mute/fullscreen
              chrome over the footage. preload="none" on hover devices means nothing
              downloads until the visitor actually hovers a card. */}
          <div className="lp-showcase__grid">
            {/* Desktop: 2 rows of 5 (10 clips) — matches the grid's actual 5-column track
                (repeat(5, 1fr) at this width); 8 was written for a 4-column assumption that
                doesn't match, leaving the second row short by 2.
                Phone: the grid drops to 2 columns at 768px, so those same 10 clips became FIVE
                stacked rows — a very long scroll before "Load more". Cut to 6 there, i.e. 3
                rows of 2. Sliced in JS rather than hidden with a CSS :nth-child rule so the
                four extra <video> elements are never mounted at all on mobile.
                heroStatic is the same ≤768px matchMedia flag the grid breakpoint uses, and an
                effect keeps it in sync on resize, so rotating the phone re-slices correctly.
                "Load more" doesn't paginate — it sends the visitor to sign-up for the rest. */}
            {(visibleShowcase.length ? visibleShowcase : showcaseVideos).slice(0, heroStatic ? 6 : 10).map((v) => (
              <article key={v.id} className="lp-vcard">
                <div className="lp-vcard__media">
                  <span className={`lp-vcard__tier lp-vcard__tier--${v.tier.toLowerCase()}`}>
                    {v.tier.charAt(0) + v.tier.slice(1).toLowerCase()}
                  </span>
                  {/* Industry chip lives ON the clip (top-right) now, not in the meta row
                      below — matches the reference card. .lp-vcard__media is the positioned
                      ancestor here, so absolute actually resolves against the clip itself
                      (see the .lp-vcard__tag comment below for the bug this used to be). */}
                  <span className="lp-vcard__tag lp-vcard__tag--onmedia">{v.label}</span>
                  {v.isVideo ? (
                    <ShowcaseVideo className="lp-vcard__video" src={v.src} poster={v.poster} />
                  ) : (
                    <img className="lp-vcard__video" src={v.src} alt={v.brand} loading="lazy" />
                  )}
                </div>
                <div className="lp-vcard__meta">
                  {/* The whole top row — brand name, "By <creator>", and the creator
                      profile-photo chip — has been removed; only the star rating is left under
                      each clip. v.brand is still used for the <img> alt text above, and
                      v.avatar / v.logoBg / v.logoText stay in the data (logoBg is still the
                      fallback background for the showcase marquee cards). */}
                  <div className="lp-vcard__meta-bottom">
                    <div className="lp-vcard__stars" aria-label={`${v.rating} out of 5`}>
                      <div className="lp-vcard__stars-row lp-vcard__stars-row--empty">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={15} fill="none" stroke="#FBBF24" />
                        ))}
                      </div>
                      <div
                        className="lp-vcard__stars-row lp-vcard__stars-row--full"
                        style={{ width: `${(v.rating / 5) * 100}%` }}
                      >
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} size={15} fill="#FBBF24" stroke="#FBBF24" />
                        ))}
                      </div>
                    </div>
                    <span className="lp-vcard__rating-num">{v.rating.toFixed(1)}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {visibleShowcase.length === 0 && (
            <p className="lp-showcase__empty">No examples in this industry yet — try another.</p>
          )}

          {/* Load more → sign up (full library unlocks after signup). */}
          <div className="lp-showcase__more">
            <button
              type="button"
              className="lp-showcase__more-btn"
              onClick={() => navigate('/auth?mode=signup&role=business')}
            >
              Load more
            </button>
          </div>
        </div>
      </section>

      {/* connector 1: hero → hook — joined U-bridge with center drop into badge.
          Negative marginTop pulls the dashed verticals up so they touch the
          showcase video-card row above (no black gap between cards and line). */}
      <div className="lp-connector" style={{ height: 380, marginTop: 0, marginBottom: 0 }}>
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
      <div className="lp-connector" style={{ height: 320, marginTop: 0, marginBottom: 0 }}>
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

      {/* connector: steps → audit — center straight line into the cards */}
      <div className="lp-connector" style={{ height: 270, marginTop: 0, marginBottom: 0 }}>
        <svg viewBox="0 0 1400 270" width="100%" height="100%" preserveAspectRatio="none">
          <path d="M 700 0 L 700 270" fill="none" stroke="rgb(152,161,172)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.5" />
        </svg>
      </div>

      {/* ── Psychological Audit ───────────────────────────────────────────── */}
      <section className="lp-audit" ref={auditRef} style={{ marginTop: 0 }}>
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
              // Mobile: a tighter fan, all three present together from the start, then PEELED UP
              // by scroll (same as desktop). Q1 is frontmost and peels first, revealing Q2, then
              // Q3 last — so the deck visibly empties upward as you scroll.
              const mobilePositions = [
                { x:   0, rotate:  -4, z: 3, y: mAuditQ1Y },  // Q1 — front & centre, peels first
                { x:  50, rotate:  11, z: 2, y: mAuditQ2Y },  // Q2 — right, peels second
                { x: -50, rotate: -18, z: 1, y: mAuditQ3Y },  // Q3 — back-left, peels last
              ];
              const p = (heroStatic ? mobilePositions : positions)[i] || positions[0];
              return (
                <motion.article
                  key={i}
                  className="lp-audit-card"
                  style={{ x: p.x, y: p.y, rotate: p.rotate, zIndex: p.z }}
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
        </div>
      </section>

      {/* ── Find & Hire Creators ── */}
      {/* Rides UP with the last audit card: a static ACHIEVE_OVERLAP margin parks it over the
          deck's (soon-to-be-empty) box, and achieveRiseY slides it in from below in lockstep with
          Q3's peel, so it arrives as the card leaves instead of after a blank screen.
          Mobile gets the margin only — the section is transform-free there because a transformed
          ancestor breaks position:sticky descendants, and writing a transform to this large
          subtree every scroll frame would cost frames for no visual gain. */}
      <motion.div
        className="lp-achieve-rise"
        style={
          heroStatic
            ? { position: 'relative', zIndex: 4 }
            : { y: achieveRiseY, position: 'relative', zIndex: 4 }
        }
      >
        <section className="lp-achieve" ref={achieveRef}>
          <motion.h2 className="lp-achieve__title">
            <em className="lp-achieve__hl">Find</em> &amp; Hire <em className="lp-achieve__hl lp-achieve__word lp-achieve__word--creators">Creators</em> <em className="lp-achieve__word lp-achieve__word--instantly">Instantly</em>
          </motion.h2>
          <p className="lp-fh__subtitle">
            From health to beauty to food, we&rsquo;ll match you with the perfect creator for
            your campaign. We only select the best through a rigorous vetting process, ensuring
            you work with top-tier UGC creators.
          </p>
          <div className="lp-fh">
            {/* The set is rendered TWICE. The second copy exists only to feed the mobile
                marquee (a -50% translate loops seamlessly when the track holds exactly two
                identical halves) and is display:none above 720px, where the layout is a
                static grid — see .lp-fh__card--dup. */}
            <div className="lp-fh__videos">
              {[...FIND_HIRE_VIDEOS, ...FIND_HIRE_VIDEOS].map((v, i) => (
                <motion.div
                  className={`lp-fh__card${i >= FIND_HIRE_VIDEOS.length ? ' lp-fh__card--dup' : ''}`}
                  key={`${v.id}-${i}`}
                  aria-hidden={i >= FIND_HIRE_VIDEOS.length}
                  custom={i % FIND_HIRE_VIDEOS.length}
                  variants={cardVariants}
                  initial="hidden"
                  animate={findHireCardsInView ? 'visible' : 'hidden'}
                >
                  <div className="lp-fh__video-wrap">
                    <span className="lp-fh__badge">{v.label}</span>
                    {/* Was a native <video controls>, which draws the browser's own bar —
                        play, MUTE, the kebab menu and a progress track, none of which can be
                        removed individually (controlsList has no "nomute"). Reuses the
                        showcase grid's component instead: poster at rest, plays on hover,
                        plays in view on touch, and no chrome whatsoever. */}
                    <ShowcaseVideo
                      className="lp-fh__video"
                      src={v.src}
                      poster={cldPoster(v.src)}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
            <div className="lp-fh__side">
              {FIND_HIRE_FEATURES.map((f, i) => {
                const Icon = f.icon;
                return (
                  <div className="lp-fh__feature" key={i}>
                    <span className="lp-fh__feature-icon"><Icon size={18} /></span>
                    <p>{f.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </motion.div>

      {/* US vs Others now follows the "What you can achieve" section in normal flow,
          so it scrolls up into view right behind the last achieve card. */}
      <div style={{ position: 'relative', zIndex: 4 }}>
      <div className="lp-connector" style={{ height: 120, marginTop: 0, marginBottom: -40, position: 'relative', zIndex: 5, pointerEvents: 'none' }}>
        <svg viewBox="0 0 1400 120" width="100%" height="100%" preserveAspectRatio="none">
          <path d="M 700 0 L 700 120" fill="none" stroke="rgb(152,161,172)" strokeWidth="1.5" strokeDasharray="6 6" strokeOpacity="0.5" />
        </svg>
      </div>

      {/* US vs Others — comparison table */}
      {/* Comparison table — editorial "Evolve"-style: cream bg, serif heading,
          three plain columns (UGCad.io / Traditional Agencies / Marketplaces), no highlight fill. */}
      <section className="lpv">
        <div className="lpv-inner">
          <p className="lpv-kicker">UGCad.io vs Others (Marketplaces / Agencies)</p>
          <h2 className="lpv-heading">WHY CHOOSE <em>US</em></h2>

          <div className="lpv-grid">
            {/* header row */}
            <div className="lpv-header">
              <div className="lpv-h lpv-h--label" />
              <div className="lpv-h lpv-h--us"><span className="lpv-brand">UGC<span className="lpv-brand-ad">ad.io</span></span></div>
              <div className="lpv-h lpv-h--them">Traditional Agencies</div>
              <div className="lpv-h lpv-h--them">Marketplaces</div>
            </div>

            {/* Mobile-only header. The desktop .lpv-header is sticky and carries four
                columns plus its own pseudo-element rules, so re-showing it at two columns
                would drag all of that along — a plain second header is far less fragile. */}
            <div className="lpv-mhead" aria-hidden="true">
              <span className="lpv-mhead__us">UGC<span className="lpv-brand-ad">ad.io</span></span>
              <span className="lpv-mhead__them">Agencies / Others</span>
            </div>

            {vsRows.map((r) => {
              const UsIcon = r.icon;
              const ThemIcon = r.themIcon;
              return (
              <div className="lpv-rowgroup" key={r.label}>
                <div className="lpv-label">{r.label}</div>
                <div className="lpv-cell lpv-cell--us">
                  {/* Icon + repeated row label are MOBILE ONLY (display:none above 1024px).
                      On a phone the row becomes a side-by-side us/them card, so the label
                      has to live inside the left cell instead of being its own column. */}
                  <span className="lpv-ico lpv-ico--us" aria-hidden="true"><UsIcon size={18} /></span>
                  <em className="lpv-tag">UGCad.io</em>
                  <b className="lpv-mlabel">{r.label}</b>
                  <strong>{r.us.title}</strong>
                  <span>{r.us.desc}</span>
                </div>
                {/* Mobile-only divider badge between the two cells. */}
                <span className="lpv-vs" aria-hidden="true">VS</span>
                <div className="lpv-cell lpv-cell--them">
                  <span className="lpv-ico lpv-ico--them" aria-hidden="true"><ThemIcon size={18} /></span>
                  <em className="lpv-tag">Agencies</em>
                  <strong>{r.agencies.title}</strong>
                  <span>{r.agencies.desc}</span>
                </div>
                <div className="lpv-cell lpv-cell--them">
                  <em className="lpv-tag">Marketplaces</em>
                  <strong>{r.platforms.title}</strong>
                  <span>{r.platforms.desc}</span>
                </div>
              </div>
              );
            })}
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

      {/* ── Value Proof — one wide mint panel: oversized heading on the left, the
          pitch + both CTAs in the middle, and the three stats as award-shield
          badges down the right edge. ─────────────────────────────────────── */}
      <section id="proof" className="lp-proof" ref={proofSectionRef}>
        <motion.div
          className="lp-proof__inner lpz"
          variants={proofPanelVariants}
          initial="hidden"
          animate={proofInView ? 'visible' : 'hidden'}
        >
          <div className="lpz-col lpz-col--text">
            <span className="lpz-eyebrow">— proof, not promises</span>
            <h2 className="lpz-heading">Trust Changes<br />the Math.</h2>
          </div>

          <div className="lpz-col lpz-col--body">
            <p className="lpz-desc">
              UGCAD.IO is your go-to partner for UGC. Whether you&rsquo;re a brand, agency or a
              UGC creator, we bring together 7000+ talented creators to produce authentic,
              scroll-stopping content for ads, websites, emails, and social channels.
            </p>
            <div className="lpz-actions">
              <button
                type="button"
                className="lpz-cta lpz-cta--dark"
                onClick={() => navigate('/auth?mode=signup&role=business')}
              >
                Sign up as Brand
                <ArrowRight size={18} />
              </button>
              <button
                type="button"
                className="lpz-cta lpz-cta--light"
                onClick={() => navigate('/creator')}
              >
                Join as Creator
              </button>
            </div>
          </div>

          {/* The three proof stats, shaped as award shields (see .lpz-badge). They replace
              the old one-at-a-time card deck: all three are readable at a glance, which is
              the only job this section has. */}
          <div className="lpz-col lpz-col--badges">
            {stats.map((s) => (
              <motion.div className="lpz-badge" key={s.label} variants={proofBadgeVariants}>
                <span className="lpz-badge__brand">UGCad<em>.io</em></span>
                <span className="lpz-badge__value">{s.value}</span>
                <span className="lpz-badge__label">{s.label}</span>
                <span className="lpz-badge__stars" aria-hidden="true">★★★</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Closing micro-line the proof section has always signed off with. Outside the
            panel, so it reads as the section's sign-off rather than panel copy. */}
        <p className="lp-proof__micro">— Not louder ads. Better ones. —</p>
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

          {/* Trust bar — the active face brightens as its review reaches the centre. */}
          <div className="lp-testimonial__trustbar">
            <span className="lp-testimonial__trustbar-label">Trusted by:</span>
            <div className="lp-testimonial__avatars">
              {testimonials.map((t, i) => (
                <span
                  className={`lp-testimonial__avatar${i === (((tIndex % T_LEN) + T_LEN) % T_LEN) ? ' is-active' : ''}`}
                  key={t.name}
                >
                  <img
                    src={t.photo}
                    alt=""
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentNode.classList.add('lp-tcard__photo--fallback');
                    }}
                  />
                  <span className="lp-tcard__initials">{t.initials}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="lp-testimonial__carousel">
            <button
              type="button"
              className="lp-testimonial__arrow lp-testimonial__arrow--prev"
              aria-label="Previous testimonial"
              onClick={() => setTIndex((i) => i - 1)}
            >
              <ChevronLeft size={22} />
            </button>
            <button
              type="button"
              className="lp-testimonial__arrow lp-testimonial__arrow--next"
              aria-label="Next testimonial"
              onClick={() => setTIndex((i) => i + 1)}
            >
              <ChevronRight size={22} />
            </button>
            <div className="lp-testimonial__viewport">
              <div
                className="lp-testimonial__grid"
                style={{
                  transform: tTrackTransform,
                  transition: tAnim ? undefined : 'none',
                }}
              >
                {T_LOOP.map((t, i) => {
                  const [before, after] = t.accent && t.quote.includes(t.accent)
                    ? [t.quote.split(t.accent)[0], t.quote.split(t.accent)[1]]
                    : [t.quote, ''];
                  const isActive = i === tIndex;
                  return (
                    <article
                      key={i}
                      className={`lp-tcard lp-tcard--marq${isActive ? ' is-active' : ''}`}
                    >
                      <div className="lp-tcard__rating">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} size={15} fill="#FBBF24" stroke="#FBBF24" />
                        ))}
                      </div>

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
                    </article>
                  );
                })}
              </div>
              {/* Fixed corner-bracket frame marking the centre spotlight card. Anchored
                  to the viewport (not the carousel) and inset by its exact padding
                  values, so it hugs the active card's real box instead of guessing a
                  size off the carousel's height (which floated the brackets well clear
                  of the card on some viewports). */}
              <div className="lp-testimonial__frame" ref={tFrameRef} aria-hidden="true">
                <span className="lp-tframe-c lp-tframe-c--tl" />
                <span className="lp-tframe-c lp-tframe-c--tr" />
                <span className="lp-tframe-c lp-tframe-c--bl" />
                <span className="lp-tframe-c lp-tframe-c--br" />
              </div>
            </div>
          </div>

          <div className="lp-testimonial__more">
            <span className="lp-testimonial__more-line" aria-hidden="true" />
            <span className="lp-testimonial__more-text">100+ founders. Same story, different brand.</span>
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
          </div>

          {/* Two INDEPENDENT columns, not one 2-column grid. In a grid the two cards
              in a row share a row height, so opening one left a dead gap under its
              collapsed neighbour. Splitting even/odd indexes into their own flex
              columns keeps every card at its natural height and packs each column
              tight — and because the old grid was row-major, even→left / odd→right
              lands every card in exactly the position it had before.
              `order: i` restores true 0,1,2… sequence on mobile, where the columns
              collapse to display:contents and all six cards re-flow into one list. */}
          <div className="lp-faq__grid">
            {[0, 1].map((col) => (
              <div className="lp-faq__col" key={col}>
                {FAQ_ITEMS.map((item, i) => {
                  if (i % 2 !== col) return null;
                  const isOpen = faqOpen === i;
                  return (
                    <div
                      key={item.q}
                      className={`lp-faq__item${isOpen ? ' is-open' : ''}`}
                      style={{ order: i }}
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
            ))}
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

      {/* ── Styles ─────────────────────────────────────────────────────────── */}
      <style>{`
        :root {
          --lp-purple-50:  rgba(115, 135, 255, 0.08);
          --lp-purple-100: rgba(115, 135, 255, 0.14);
          --lp-purple-200: #d2d7ff;
          --lp-purple-300: #8888A0;
          --lp-purple-500: #3A3A66;
          --lp-purple-600: #1F1F4E;
          --lp-purple-700: #7387FF;   /* "Periwinkle Pulse" — primary */
          --lp-purple-900: #050538;
          /* Brand palette: Periwinkle Pulse (--lp-purple-700 above) is primary; Midnight
             Indigo is the existing #07074E navy used throughout (audit/testimonial glows,
             card text); these two round it out for surfaces/accents. */
          --lp-lilac: #F3F3FF;        /* "Frosted Lilac" — neutral/background */
          --lp-mist:  #9F9FD1;        /* "Velvet Mist" — accent */
          --lp-ink:        #0A0A0A;
          --lp-text:       #ffffff;
          --lp-text-muted: rgba(var(--lp-fg), 0.7);
          --lp-text-soft:  #9CA3AF;
          --lp-bg:         #0a0a0a;
          --lp-bg-soft:    #0a0a0a;
          --lp-border:     #E5E7EB;
        }

        /* Hides the native page scrollbar while this page is mounted — this <style> tag
           isn't styled-jsx-scoped (no "jsx" attribute), so html/body rules here reach
           outside .lp-root and apply for real, but only for as long as Landing stays
           mounted (unmounting removes the tag, restoring the scrollbar elsewhere). Scroll
           itself still works; only the visible track/thumb is hidden. */
        html, body { scrollbar-width: none; -ms-overflow-style: none; }
        html::-webkit-scrollbar, body::-webkit-scrollbar { width: 0; height: 0; display: none; }

        /* ── Root ─────────────────────────────────────────────────────────── */
        .lp-root {
          /* Dark is the base; [data-theme="light"] overrides below. --lp-fg is an
             RGB triplet used as rgba(var(--lp-fg),a) for theme-flippable whites. */
          --lp-fg: 255, 255, 255;
          --lp-page-bg: #0a0a0a;
          --lp-text: #ffffff;
          /* ══════════════════════════════════════════════════════════════════════
             ONE RESPONSIVE SYSTEM. Reference viewport 1536px — every token below
             resolves to the page's reference value at exactly 1536 and scales in a
             single controlled band around it:  ~-9% at 1024, ~+18% at 2560.

             Every token is the same two-point clamp, so the whole page scales at ONE
             rate. There are deliberately no per-component formulas: a section that
             needs a different size picks a different TOKEN, it does not invent its
             own curve. That is what stops one resolution improving while another
             regresses.

             Scaling is bounded on purpose. A 2560 monitor gets ~18% larger type and
             spacing than 1536 — noticeably more generous, but not the 66% that a
             naive vw-proportional scale would give.
             ══════════════════════════════════════════════════════════════════════ */

          /* Type scale. Values at 1536: 64 / 54 / 40 / 31 / 16 / 14. */
          /* Steeper slope than the other tokens, and deliberately so. The original fit
             (46.7px + 1.125vw) was derived from the desktop band only, so its 34px floor
             never actually engaged — the linear term stayed above it at every width, and a
             360px phone got a 51px hero headline. That is what forced "Performance" onto a
             line of its own. This fit passes through the SAME 64px at the 1536 reference but
             reaches ~34px on a phone, so the headline wraps into sensible phrases.
             Capped at 76px, which it now reaches around 2000px rather than 2560. */
          --lp-fs-display: clamp(30px, 23.4px + 2.64vw, 76px);   /* hero + biggest headings */
          --lp-fs-h1:      clamp(30px, 39.4px + 0.949vw, 64px);   /* major section headings   */
          --lp-fs-h2:      clamp(24px, 29.2px + 0.703vw, 47px);   /* section headings         */
          --lp-fs-h3:      clamp(20px, 22.6px + 0.545vw, 37px);   /* card / row titles        */
          --lp-fs-body:    clamp(15px, 11.7px + 0.281vw, 19px);
          --lp-fs-small:   clamp(13px, 10.2px + 0.246vw, 17px);
          --lp-fs-stat:    clamp(44px, 58.4px + 1.406vw, 94px);   /* big numerals only        */

          /* Spacing scale. Values at 1536: 16 / 24 / 40 / 64 / 96, section 120. */
          --lp-space-sm:      clamp(12px, 11.7px + 0.281vw, 19px);
          --lp-space-md:      clamp(16px, 17.5px + 0.422vw, 28px);
          --lp-space-lg:      clamp(24px, 29.2px + 0.703vw, 47px);
          --lp-space-xl:      clamp(32px, 46.7px + 1.125vw, 76px);
          --lp-space-2xl:     clamp(48px, 70.1px + 1.688vw, 113px);
          --lp-space-section: clamp(56px, 87.6px + 2.11vw, 142px); /* vertical rhythm between sections */
          /* Hero top offset. Steeper than the other tokens on purpose: the hero is the only
             block sitting directly under the fixed navbar, so on a wide screen it read as
             crowded against the bar while space went unused lower down. 104px at the 1536
             reference (unchanged), rising to 170px at 2560. The min holds it at 104 below the
             reference so nothing on a laptop or smaller moves. */
          --lp-space-hero-top: clamp(104px, 5px + 6.45vw, 170px);
          /* Brand-strip logo height. Same scale shape as the rest: 104px at the 1536
             reference, ~123px at 2560, floors at 64px on small screens. */
          --lp-logo-h: clamp(64px, 75.9px + 1.829vw, 123px);

          /* ONE container width for the whole page — navbar, hero, sections, footer.
             At 1536 this resolves to 1320px (the tuned reference). It stays 1320 up to
             ~1535, grows with the screen past that, and stops at 1560 so line lengths
             stay readable on a 2560 display. Sections consume it via .lp-container
             semantics: width: min(92vw, var(--lp-maxw)). */
          --lp-maxw: clamp(1320px, 86vw, 1720px);
          min-height: 100vh;
          font-family: var(--font-body);
          background: var(--lp-page-bg);
          color: var(--lp-text);
          position: relative;
          overflow-x: clip; /* clip full-bleed (100vw) marquees so phones don't scroll sideways.
                               'clip' (not 'hidden') so it doesn't become a scroll container and
                               break position:sticky descendants (leaderboard + achieve stack). */
          transition: background 0.3s ease, color 0.3s ease;
        }
        .lp-root[data-theme="light"] {
          --lp-fg: 28, 27, 75;          /* navy text/borders/surfaces */
          --lp-page-bg: #fefcf9;        /* Warm cream page background */
          --lp-text: #1c1b4b;
          --lp-bg: #fefcf9;
          --lp-bg-soft: #fefcf9;
          --lp-text-muted: rgba(28,27,75,0.66);
          --lp-text-soft: #5b5a7e;
          --lp-section: #ffffff;       /* white card surface — stays white so cards
                                           still pop off the lilac page background */
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
          background: radial-gradient(circle, rgba(115, 135, 255, 0.3) 0%, rgba(115, 135, 255, 0) 58%);
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
          /* THE fix for "lines up on my laptop, drifts everywhere else".
             Every content section resolves its edge to max(4%, (100% - 1320px)/2) — a 4%
             gutter until the 1320px cap takes over. This bar used a bare 4%, so the two only
             produced the same edge where 0.08W = W - 1320, i.e. W = 1435px. At 1440 they
             matched (2px apart) and looked deliberate; at 1920 the logo sat 223px outside the
             content column, at 2560 it was 517px out — the bar visibly detached from the page.
             Expressed as the same relationship, they now track each other at every width. */
          padding-inline: max(4%, calc((100% - var(--lp-maxw)) / 2));
          transition: top 0.3s ease;
        }
        /* Slides fully off the top when scrolling down; returns on scroll-up. */
        .lp-navbar--hidden { top: -110px; }
        /* Fade mask removed — it was washing out the hero heading with a soft gradient
           ("shadow") as it scrolled up behind the nav. */
        .lp-navbar::before { display: none; }

        .lp-navbar__inner {
          position: relative;
          /* GRID, not flex+absolute. The links pill used to be position:absolute/left:50%,
             which takes it out of flow — so this bar reserved ZERO width for it and the
             logo/actions happily expanded underneath. Its ~500px of content then overlapped
             "Log in" below ~1045px (at 1024 they overlapped by 9px), and no breakpoint
             covered 769–1045px. Three real columns make the overlap structurally impossible:
             the centre track always claims its width and the side tracks share what's left. */
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 12px;
          /* Plain/transparent, full width — logo and actions sit unboxed at the true
             edges of the bar. Only the centered nav-links group (below) gets its own
             pill background now, not the whole bar. */
          width: 100%;
          background: transparent;
          /* Real header-bar height; the logo is sized to sit INSIDE it, centered. */
          height: 64px;
          padding: 0 4px;
        }

        .lp-navbar__logo {
          /* Contained within the bar. Vertically centered by the flex row — no
             overflow, no negative margin. */
          height: 46px;
          width: auto;
          flex: none;
          object-fit: contain;
          cursor: pointer;
          font-family: var(--font-head);
          font-weight: 700;
          font-size: 1.4rem;
          letter-spacing: -0.02em;
          line-height: 1;
          transition: opacity 0.2s ease;
        }
        .lp-navbar__brand:hover { opacity: 0.8; }
        .lp-navbar__brand-a { color: #7387FF; }   /* "UGC" — periwinkle */
        .lp-navbar__brand-b { color: #07074e; }   /* "ad.io" — navy */
        .lp-root[data-theme="dark"] .lp-navbar__brand-b { color: #EDE7DA; }

        /* Nav links — centred in the bar (logo stays left, actions stay right via
           .lp-navbar__inner's justify-content:space-between). Taken out of flex flow
           and centred absolutely so its own width never pushes the logo or actions.
           This is the ONLY part of the bar with a background — a floating glass pill,
           while the logo and Log in/Sign up sit unboxed at the true edges. */
        .lp-navbar__links {
          /* In-flow centre column of .lp-navbar__inner's grid (was absolute + left:50%). */
          justify-self: center;
          display: flex;
          align-items: center;
          gap: 30px;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          border: 1px solid rgba(28, 27, 75, 0.08);
          border-radius: 999px;
          box-shadow: 0 12px 32px rgba(28, 27, 75, 0.12);
          padding: 14px 30px;
        }
        .lp-root .lp-navlink {
          position: relative;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-body);
          font-size: 0.95rem;
          font-weight: 500;
          color: rgba(var(--lp-fg), 0.88);
          text-decoration: none;
          cursor: pointer;
          transition: color 0.2s ease;
          outline: none;
          -webkit-tap-highlight-color: transparent;
        }
        .lp-root .lp-navlink:focus-visible {
          outline: 2px solid #7387FF;
          outline-offset: 4px;
          border-radius: 4px;
        }
        .lp-root .lp-navlink:hover { color: #ffffff; }
        .lp-navlink svg { color: rgba(var(--lp-fg), 0.6); }
        /* Was opacity:0.55 on hover — faded/lightened the whole link against the frosted
           glass bar, which read as the link "going light". Solid brand colour instead, so
           hover stays fully opaque. */
        .lp-root .lp-navbar__links .lp-navlink:hover { color: #7387FF; }
        /* Text swap on hover, per character: each letter is its own clipped two-row slot
           (original on top, a duplicate directly below at top:100%). Hovering slides every
           letter's rows up by one line so the duplicate enters from the bottom — but each
           character's transition-delay (set inline, staggered by index in NavHoverText)
           makes them fire left-to-right in sequence instead of all moving at once. */
        .lp-navlink__text { position: relative; display: inline-flex; overflow: hidden; height: 1.3em; line-height: 1.3em; }
        .lp-navlink__char { position: relative; display: inline-block; overflow: hidden; height: 1.3em; }
        .lp-navlink__char-row {
          display: block;
          transition: transform 0.32s cubic-bezier(0.65, 0, 0.35, 1);
        }
        .lp-navlink__char-row:last-child {
          position: absolute;
          top: 100%;
          left: 0;
        }
        .lp-navlink:hover .lp-navlink__char-row { transform: translateY(-100%); }
        /* Hover underline — grows in left-to-right beneath the centred nav links. */
        .lp-navbar__links .lp-navlink::after {
          content: '';
          position: absolute;
          left: 0;
          bottom: -6px;
          width: 0%;
          height: 2px;
          background: #7387FF;
          transition: width 0.28s ease;
        }
        .lp-navbar__links .lp-navlink:hover::after { width: 100%; }

        .lp-navbar__actions {
          /* Right grid column — pinned to its end so the centre pill stays truly centred. */
          justify-self: end;
          display: flex;
          gap: 30px;
          align-items: center;
        }
        /* Left grid column. Both side tracks are 1fr, so the pill sits on the bar's real
           centre regardless of how wide the logo or the buttons happen to be. */
        .lp-navbar__brand { justify-self: start; }
        /* Tighten the pill just before it would crowd the buttons, instead of letting it
           collide — covers the old 769–1045px dead zone. */
        @media (max-width: 1024px) {
          .lp-navbar__links { gap: 18px; padding: 12px 20px; font-size: 0.88rem; }
          .lp-navbar__actions { gap: 14px; }
        }

        /* Log in — outlined (secondary) pill, Sign Up below carries the solid emphasis. */
        .lp-root .lp-btn-login {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 10px 22px;
          border-radius: 999px;
          border: 1px solid rgba(var(--lp-fg), 0.25);
          background: transparent;
          color: var(--lp-text);
          font-family: var(--font-body);
          font-weight: 600;
          font-size: 0.92rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .lp-root .lp-btn-login:hover { border-color: rgba(var(--lp-fg), 0.45); background: rgba(var(--lp-fg), 0.04); }

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

        /* Sign Up — the single solid pill CTA in the bar (was a plain text link). */
        .lp-root .lp-btn-signup {
          padding: 10px 24px;
          border: 1px solid #7387FF;
          background: #7387FF;
          color: #fff;
          font-family: var(--font-body);
          font-weight: 600;
          font-size: 0.92rem;
          cursor: pointer;
          border-radius: 999px;
          transition: all 0.2s ease;
        }
        .lp-root .lp-btn-signup:hover { background: #5c6cff; border-color: #5c6cff; }

        /* Mobile hamburger + slide-down menu (hidden on desktop) */
        .lp-navbar__burger {
          display: none;
          margin-left: auto;
          margin-right: -14px;
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
        /* Light theme: white menu surface to match the page (instead of the dark panel). */
        .lp-root[data-theme="light"] .lp-navbar__mobile {
          background: rgba(255, 255, 255, 0.97);
          box-shadow: 0 24px 60px rgba(28, 27, 75, 0.18);
        }
        .lp-navbar__mobile .lp-navlink {
          padding: 12px 12px;
          border-radius: 10px;
          color: rgba(var(--lp-fg), 0.9);
        }
        .lp-navbar__mobile .lp-navlink:active { background: rgba(var(--lp-fg), 0.08); }
        .lp-navbar__mobile-theme {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px 12px;
          color: rgba(var(--lp-fg), 0.9);
          font-size: 0.94rem;
          font-weight: 500;
        }
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

        /* ── NEW light hero ("Stunning Videos") ───────────────────────────── */
        /* Hide the old dark 3D-logo fly overlay so it doesn't float over the cream hero. */
        .nlp-hero {
          position: relative; z-index: 3; isolation: isolate;
          /* Follows the theme variable (was hardcoded #fefcf9 cream) so it matches
             whichever theme is active instead of always being light — it was hardcoded
             back when the whole page was always cream; now the rest of the page follows
             data-theme, so this has to as well or it's the one visibly mismatched section
             (and its dark-theme text color reads as near-invisible against a light bg). */
          background: var(--lp-page-bg);
          /* Compacted (was 132px/96px) so the whole hero — heading, subtitle, card row,
             and CTA — fits in a single view without scrolling on a typical desktop
             viewport, instead of running well past the fold. Top padding must stay
             ABOVE the fixed .lp-navbar's own footprint (top:20px + 64px tall = 84px) —
             going lower hides the badge/heading behind it, since the navbar is
             position:fixed and doesn't push page content down on its own. */
          padding: var(--lp-space-hero-top) 24px 32px;
          text-align: center; overflow: hidden;
        }
        /* Shiny pill: glossy gradient fill + a specular sweep that glints across every few
           seconds + a four-point sparkle at each end.
           Palette is the site accent (Periwinkle Pulse, --lp-purple-700) — the amber this
           used to be belonged to no palette on the page, the same one-off the .nlp-cta
           comment below describes shedding. Run DARK: a deep periwinkle→indigo fill with a
           white label, which makes the sparkles and gloss read far harder than they did on
           a light tint.
           Every stop is chosen to clear WCAG AA against white at this 13.5px size — the
           lightest, #5566e8, is 4.7:1. Do NOT lighten them toward the plain #7387FF accent:
           that is only 3.2:1 and the label stops being compliant. */
        .nlp-badge {
          position: relative;
          display: inline-block;
          /* Was a flat #f7d49b. The gradient alone already reads as a lit surface, so the
             pill still looks shiny in the frames between sweeps. */
          background: linear-gradient(100deg, #3a49cf 0%, #5566e8 40%, #4452f0 62%, #2e3ab0 100%);
          font-weight: 700; font-size: 13.5px; letter-spacing: .1px;
          padding: 8px 22px; border-radius: 999px; margin: 0 auto 16px;
          font-family: var(--font-body);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.34),
                      inset 0 -1px 0 rgba(4, 4, 40, 0.35),
                      0 6px 20px rgba(68, 82, 240, 0.42);
          /* Creates a stacking context so ::before's z-index:-1 stays scoped to the badge:
             it then paints ABOVE this element's own background but BELOW the label. */
          isolation: isolate;
        }
        /* Scoped under .lp-root deliberately, same as .nlp-cta / .nlp-title-accent below.
           The blanket rule near the top (".lp-root h1, .lp-root span, … { color: var(--lp-text) }")
           is specificity 0,1,1 and this badge IS a span, so a plain ".nlp-badge { color }" at
           0,1,0 loses to it and the label rendered in navy --lp-text on the dark fill. */
        .lp-root .nlp-badge { color: #ffffff; }
        /* Specular sweep. On ::before with border-radius: inherit so the pill's own shape
           clips it — overflow:hidden would have worked too, but it would equally have cut
           off the sparkles on ::after, which are meant to overhang the edge. */
        .nlp-badge::before {
          content: '';
          position: absolute; inset: 0; border-radius: inherit; z-index: -1;
          /* Sized BELOW 100% on purpose: for a background smaller than its box, percentage
             positioning is the intuitive kind (0% = flush left, 100% = flush right), so the
             sweep travels predictably. At >100% the percentages resolve against negative
             free space and the band barely moves — which is what a 220% size did here. */
          /* Held well below opaque. The label is white now, and the sweep passes UNDER it —
             a near-white band would erase the text where the two cross. 0.38 still reads as
             a bright gloss against the dark fill while the label stays legible throughout. */
          background: linear-gradient(100deg,
            transparent 0%, rgba(255,255,255,0.38) 50%, transparent 100%);
          background-size: 45% 100%;
          background-repeat: no-repeat;
          animation: nlpBadgeSheen 4.2s ease-in-out infinite;
        }
        /* Sweeps across, then HOLDS off-pill for the rest of the cycle, so it reads as an
           occasional glint rather than a continuously scrolling stripe. */
        @keyframes nlpBadgeSheen {
          0%        { background-position: -60% 0; }
          45%, 100% { background-position: 160% 0; }
        }
        /* The two four-point sparkles. Drawn as an inline SVG star rather than crossed
           gradients: multi-layer gradients position by each layer's top-left corner, so the
           horizontal and vertical arms cannot be centred on each other without hand-computed
           per-layer offsets — they rendered as an offset bar instead of a star. One square,
           symmetric SVG sidesteps that entirely. Insets are negative so the stars can sit
           over the pill's edge like the reference. */
        .nlp-badge::after {
          content: '';
          position: absolute; inset: -8px; pointer-events: none;
          background-repeat: no-repeat;
          background-image:
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 0C13 8 16 11 24 12 16 13 13 16 12 24 11 16 8 13 0 12 8 11 11 8 12 0Z' fill='%23ffffff'/%3E%3C/svg%3E"),
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 0C13 8 16 11 24 12 16 13 13 16 12 24 11 16 8 13 0 12 8 11 11 8 12 0Z' fill='%23ffffff'/%3E%3C/svg%3E");
          background-size: 26px 26px, 17px 17px;
          background-position: 4px 50%, calc(100% - 8px) 30%;
          filter: drop-shadow(0 0 5px rgba(255,255,255,0.95));
          animation: nlpBadgeTwinkle 3.6s ease-in-out infinite;
        }
        @keyframes nlpBadgeTwinkle {
          0%, 100% { opacity: 0.5; }
          50%      { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .nlp-badge::before, .nlp-badge::after { animation: none; }
        }
        .nlp-title {
          margin: 0 auto; max-width: 980px;
          font-family: var(--font-head);
          /* Was hardcoded #171717 (near-black) — fine against the old always-cream hero,
             illegible now that the hero follows the dark theme by default. */
          /* 700 -> 600. Readex Pro is loaded at 200-700 (see the @import in App.css), so 600 is
             a real cut rather than a browser-synthesized in-between. */
          font-weight: 600; letter-spacing: -2px; line-height: 1.02; color: var(--lp-text);
          /* Max size trimmed (was 84px) as part of the overall compacting pass. */
          /* Two-point form: the old 5.6vw slope hit its 60px cap at 1071px, so every screen
             from a small laptop to a 2560 monitor rendered the hero headline at exactly the
             same size. Same 36px floor for phones; now keeps growing to 76px at ~2400. */
          font-size: var(--lp-fs-display);
        }
        /* Scoped under .lp-root deliberately. The blanket rule above
           (".lp-root h1, .lp-root span, …  { color: var(--lp-text) }") is specificity 0,1,1;
           a bare .nlp-title-accent is 0,1,0 and LOSES, so the accent phrases were being
           repainted in the body colour and the whole headline rendered flat navy.
           Matching that rule's specificity — and coming later in the sheet — restores them
           without needing !important. */
        .lp-root .nlp-title-accent { color: var(--lp-purple-700); }
        /* Keeps "The Performance" on one line — see the h1. inline-block so the nowrap
           applies to the pair as a unit while the surrounding text still wraps normally. */
        .nlp-title-nb { white-space: nowrap; display: inline-block; }
        .nlp-sub {
          max-width: 560px; margin: 14px auto 0; color: var(--lp-text-muted);
          font-size: 16px; line-height: 1.5;
          font-family: var(--font-body);
        }
        /* Accent phrase inside the subline. nowrap so "high-performing UGC ads" can't be
           split across two lines — it's read as one term. */
        .lp-root .nlp-sub-accent { color: var(--lp-purple-700); font-weight: 600; white-space: nowrap; }
        /* Off by default (desktop reflows naturally). On mobile the sentence was wrapping
           to 3 lines, so a forced break right at the sentence boundary — "clicks." / "Unlock
           serious growth with high-performing UGC ads." — turns it into a clean 2. The
           smaller font-size is what keeps that second line from wrapping a 3rd time itself. */
        .nlp-sub-break { display: none; }
        @media (max-width: 640px) {
          .nlp-sub-break { display: block; }
          .nlp-sub { max-width: 340px; font-size: 12.5px; }
        }
        /* Clipping viewport: hides the horizontal overflow of the scrolling track but
           leaves vertical room for the arched cards (padding reserves space for the CTA). */
        .nlp-gallery-vp {
          position: relative;
          /* Full-bleed by cancelling the PARENT's own known padding (.nlp-hero: 24px each
             side) instead of a width:100vw + calc(50% - 50vw) breakout. The vw-based
             version undershot by a few px because html{scrollbar-gutter:stable} reserves
             gutter space that vw/% don't agree on — this version needs no measurement or
             JS correction at all: it's an exact, purely-CSS relationship to the direct
             parent, so it's correct at every breakpoint automatically. Must stay in sync
             with .nlp-hero's own horizontal padding (24px here, 16px in the ≤900px rule
             below — each has a matching override there). */
          width: calc(100% + 48px);
          margin: 20px -24px 0;
          overflow-x: clip;
          overflow-y: visible;
          /* Shared vanishing point for every card's translateZ/rotateY, so the whole row
             reads as one continuous curved surface rather than each card popping in its
             own isolated 3D space. Tighter than the old 1200px: a shorter focal length
             exaggerates the near/far size split, which is what sells the cylinder. */
          perspective: 1100px;
          /* SYMMETRIC vertical room. Cards now grow about the row's horizontal centreline
             (see align-items/transform-origin below), so they need equal headroom above
             and below — the old lopsided 24/50 was for a bottom-baselined arc that no
             longer exists. Horizontal padding stays 0 so cards run clean off both screen
             edges instead of stopping short of them. */
          padding: 40px 0 40px;
          /* No edge mask (was a 7% fade-to-transparent at both ends). Against the cream
             page background, video content fading to transparent reads as a discolored/
             shadowed smear right at the left and right edges instead of a clean dissolve —
             that's what was actually being seen there, not a shadow effect worth keeping. */
        }
        .nlp-gallery {
          /* Centre-aligned: every card grows/shrinks about ONE shared horizontal axis, so
             the row stays dead straight as the cylinder scales them. (Was flex-end, which
             pinned bottoms to a baseline and made the bigger edge cards visibly climb
             upward — the "cards moving up from right and left" problem.) */
          display: flex; align-items: center;
          gap: 44px; width: max-content; will-change: transform;
          transform-style: preserve-3d;
        }
        .nlp-card {
          /* Sized from viewport HEIGHT, not width. The card is 9/16 portrait, so its height is
             what decides whether the hero fits the screen — and the old width-based formula
             capped at 180px, meaning a 900px-tall laptop and a 1440px-tall monitor both got a
             320px-tall card with the extra height left as dead space below it. (The formula
             was also off by 120px on its own terms: 7 cards + 6x44px gaps is 100vw + 120, not
             100vw.) Deriving width from a vh-based height ties the row to the space actually
             available, so it fills a tall screen and shrinks on a short one. */
          flex: 0 0 clamp(150px, 11.5vw, 230px);
          margin: 0; border-radius: 26px; overflow: hidden;
          aspect-ratio: 9 / 16; background: #e7e0d2;
          /* "center center" — the cylinder scales cards about the row's shared centreline
             (see .nlp-gallery align-items above), so they expand evenly up AND down and
             the row reads as one straight horizontal band. */
          transform-origin: center center; will-change: transform;
        }
        .nlp-card img, .nlp-card video { width: 100%; height: 100%; object-fit: cover; display: block; background: #e7e0d2; }
        /* margin-top was -20px, pulling the pair UP into the card row above so the buttons sat
           tight against (and on small screens overlapping) the marquee. Positive now, so they
           clear it. The gallery's own bottom padding is already reserved for the 3D cards'
           overhang, so this adds separation rather than fighting it. */
        /* align-self: center is what actually centres these. On mobile .nlp-hero becomes a
           column flex container, and its default align-items:stretch widened this wrap to the
           full column — so the buttons sat at its flex-start (left) edge and the hero's
           text-align:center had no effect, because that centres inline content, not flex items.
           align-self only overrides it for THIS item: adding align-items:center to the hero
           instead would also shrink the full-bleed card marquee beside it.
           Staying inline-flex (hugging its buttons) matters too — the "It's free" note is
           absolutely positioned at right: calc(100% + 6px) of this box, so a full-width wrap
           would fling it off to the far left. */
        .nlp-cta-wrap {
          position: relative;
          display: inline-flex;
          align-self: center;
          justify-content: center;
          gap: 12px;
          /* Landed at 26px, between the -20px that had the buttons colliding with the card row
             and the 34px that read as too loose. The gallery's own bottom padding already
             reserves space for the 3D cards' overhang, so this is separation on top of that. */
          margin-top: 26px;
        }
        /* Primary hero CTA. Was a one-off orange (#ef6a4c) that belonged to no palette on this
           page — now the site accent, the same periwinkle every other primary fill uses (nav
           join pill, audit deck, proof cards). Flat: the coloured glow this used to cast has
           been removed, so the lift + darkening carry the hover on their own. */
        .lp-root .nlp-cta {
          background: #7387FF; color: #fff; border: none; border-radius: 999px;
          padding: 15px 42px; font-weight: 700; font-size: 16px; cursor: pointer;
          font-family: var(--font-body);
          box-shadow: none;
          transition: transform .18s ease, background .18s ease;
        }
        /* Deepens to the darker end of the same ramp on hover (#4452f0 — the tone already used
           for the PRO tier chip and the proof-card accents). */
        .nlp-cta:hover {
          background: #4452f0;
          transform: translateY(-2px);
        }
        /* Secondary hero CTA ("Sign up as Brand"). Outline, not a second filled pill —
           two solid buttons side by side would give the brand path equal visual weight
           to the primary creator one. */
        .lp-root .nlp-cta--ghost {
          background: transparent; color: var(--lp-text);
          border: 1px solid rgba(var(--lp-fg), 0.3); box-shadow: none;
        }
        .nlp-cta--ghost:hover {
          background: rgba(var(--lp-fg), 0.06); border-color: rgba(var(--lp-fg), 0.5);
          box-shadow: none;
        }
        /* Handwritten annotations */
        .nlp-note {
          position: absolute; font-family: 'Bradley Hand', 'Segoe Script', 'Comic Sans MS', cursive;
          color: #3a3a3a; font-size: 21px; line-height: 1.15; font-weight: 600; pointer-events: none;
          /* The "It's free" arrow's tip deliberately reaches into the CTA button's box to
             point at it. Without this, the button (later in the DOM, so painted on top by
             default) covers the arrow tip on :hover when its box-shadow grows/darkens —
             the arrow visibly vanishing right when you hover it. Keeping notes above the
             button always, in both states, fixes that. */
          z-index: 2;
        }
        /* top trimmed (was 210px) to track the heading, which now sits higher/smaller
           after the hero compacting pass above. */
        /* Tracks the HEADLINE'S TEXT edge, not the viewport edge and not the title's max-width
           box. Two earlier attempts both failed for the same underlying reason — they used a
           constant where a relationship was needed:
             - right: max(160px, calc(50vw - 680px)) measured from the screen edge, so as the
               window narrowed the note walked into "with Stunning Videos";
             - left: calc(50% + 500px) used .nlp-title's 980px max-width box, but the text only
               fills that box on very large screens, so on a ~1600px window the note sat far to
               the right of the visible headline (and was hidden outright below 1380px).
           The text's right edge is ~50% + 4.95·font, and font is var(--lp-fs-display)
           — so it expands as roughly 0.58W + 109. Matching that expression holds a constant
           ~20px gap from the words at EVERY width from 960 to 2560, which is why the hide-below
           rule is gone: there is no longer a width where it collides. */
        .nlp-note--free { position: absolute; right: calc(100% + 6px); bottom: 2px; white-space: nowrap; transform: rotate(-8deg); }
        .nlp-note--free .nlp-note-arrow2 { position: absolute; right: -58px; top: 6px; width: 56px; height: 34px; }
        @media (max-width: 900px) {
          /* Fill the full mobile viewport height so the next section ("Our Services")
             never peeks in until you actually scroll — it was falling short of the
             screen, leaving a dead empty band before the next section's heading bled
             into view. min-height (not height) so genuinely long content still pushes
             the section taller rather than clipping. 100dvh (not vh) accounts for
             mobile browser chrome (address bar) that vh ignores; 100vh sits right
             after as a fallback for older browsers without dvh support. flex +
             justify-content:center distributes the extra room evenly around the
             existing content instead of dumping it all as one gap below the CTAs. */
          .nlp-hero {
            padding: 60px 16px 72px;
            min-height: 100vh;
            min-height: 100dvh;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          /* Nudges just the badge up relative to the heading below it — a negative
             margin on a flex item shifts it independent of its siblings, unlike
             changing the container's padding (which moves the whole centered group). */
          .nlp-badge { margin-top: -14px; }
          /* .nlp-hero's horizontal padding drops to 16px here — match it so the
             full-bleed cancellation stays exact (was hardcoded to the desktop 24px). */
          /* Horizontal padding 0 (was 4px) — cards run edge-to-edge here too.
             overflow-x is CLIP, not auto: the row is driven by the same rAF cylinder loop
             as desktop now, so it must not also be a native swipe-scroller — a scrollable
             box would fight the JS translateX and let the user drag the row out of the
             geometry it's being positioned against. (The -webkit-overflow-scrolling /
             scrollbar-hiding rules that went with auto are gone for the same reason.)
             Vertical padding is bigger than the old 6/10: the near cards at the row's
             edges project up to ~1.2x, and they grow about the centreline in BOTH
             directions, so they need real headroom or they'd be sliced off. */
          /* NO perspective override here — it inherits the desktop 1100px on purpose.
             A shorter mobile lens was tried (520px) and is wrong now that the depths are
             derived from the focal length: it leaves the near/far SIZE ratio untouched
             (that's the point of the ratio) while still shortening the lens for the
             rotateY foreshortening, so the edge cards splayed harder than desktop's. The
             curve itself is already viewport-relative — geomAt divides dx by halfViewport
             — so one focal length genuinely serves every screen width. */
          .nlp-gallery-vp { width: calc(100% + 32px); margin-left: -16px; margin-right: -16px; overflow-x: clip; overflow-y: visible; padding: 22px 0 22px; }
          /* transform:none !important is GONE — that pair of rules is what pinned the row
             flat on phones; the JS writes per-card transforms and !important beat them. */
          .nlp-gallery { gap: 14px; }
          /* Divisor 3 -> 2.5: the whole row was reading small on a phone once the corner
             cards stopped ballooning, so every card grows ~20% (at 390px: 111px -> 134px
             wide, and 9/16 makes that 198px -> 238px tall). Fewer cards fit across as a
             result — nearer three than the original "exactly three plus two curving out",
             which is the trade for legible cards on a 390px screen.
             The subtracted 56px is still two 14px gaps plus a 14px bleed either side, so
             the outer pair stays visibly cut by the edge rather than sitting flush inside.
             The 168px CAP IS DELIBERATELY UNCHANGED: the card is aspect-ratio 9/16, so an
             uncapped card on the 900px-wide end of this breakpoint would be 500px tall and
             push the CTA below the fold. With the new divisor the cap takes over at ~476px
             viewport, so phones get the bigger cards and the 480-900px band renders exactly
             as it did before. Raising the cap is what would cost you the fold. */
          .nlp-card { flex: 0 0 clamp(110px, calc((100vw - 56px) / 2.5), 168px); }
          .nlp-note { display: none; }
          /* Hero CTAs on a phone. The desktop 15px/42px padding left the pair wider than the
             screen, so each label broke onto two lines and the pills grew to ~double height.
             nowrap forces one line; the trimmed padding + font are what make one line FIT —
             nowrap on its own would just have turned the wrap into horizontal overflow.
             "Sign up as Brand" is the long label and sets the floor: at 14px it needs roughly
             120px of text + 36px padding, so the pair plus the gap sits ~330px, inside a 360px
             viewport. Below that the ≤380px step trims again. */
          .nlp-cta-wrap { gap: 10px; }
          .lp-root .nlp-cta {
            padding: 12px 18px;
            font-size: 14px;
            white-space: nowrap;
          }
        }
        /* SHORT phones (iPhone SE class), gated on HEIGHT not width. The +20% card growth
           above is sized off viewport WIDTH, so a 390x667 screen got the same 239px-tall
           cards as a 390x860 one — measured, that put the CTA pair's bottom edge at 681px in
           a 667px viewport, i.e. just off the bottom of the screen. Falling back to the old
           /3 divisor and trimming the gallery's vertical padding pulls it back above the
           fold; tall phones are unaffected and keep the bigger cards. */
        @media (max-width: 900px) and (max-height: 700px) {
          .nlp-card { flex: 0 0 clamp(100px, calc((100vw - 56px) / 3), 150px); }
          .nlp-gallery-vp { padding: 14px 0 14px; }
        }
        @media (max-width: 380px) {
          /* 320-360px phones: one more step down so both pills still clear the screen edge. */
          .nlp-cta-wrap { gap: 8px; }
          .lp-root .nlp-cta { padding: 11px 13px; font-size: 13px; }
        }

        /* No animated blobs / 3D logo mark in this build (unrelated to page color — kept
           as-is). The background itself now follows data-theme (set dynamically from the
           site theme context) via .lp-root's own "background: var(--lp-page-bg)" — this
           used to force cream here regardless of theme, which is exactly what blocked the
           page from ever going dark. */
        .lp-bg-animations { display: none !important; }
        .lp-logo-fly,
        .lp-logo3d__stage,
        .lp-logo3d__placeholder { display: none !important; }
 
        .lp-root .lp-navlink { color: #2b2b2b !important; }
        .lp-root .lp-navlink:hover { color: #000 !important; }
        .lp-root .lp-nav-join { color: #4452f0 !important; }
        .lp-btn-login { color: #171717 !important; border-color: rgba(0,0,0,0.22) !important; }
        .lp-btn-login:hover { border-color: rgba(0,0,0,0.45) !important; }

        .lp-hero {
          position: relative;          height: 150vh;
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
          width: clamp(260px, 30vw, 480px);
          height: clamp(260px, 44vh, 520px);
          margin-top: calc(clamp(260px, 44vh, 520px) * -0.5);
          margin-left: calc(clamp(260px, 30vw, 480px) * -0.5);
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
          padding: calc(var(--lp-space-section) * 1.1) 4% calc(var(--lp-space-section) * 0.6);
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
          justify-content: center;
          gap: clamp(18px, 2.6vh, 30px);
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
          border: 1px solid rgba(115, 135, 255, 0.35);   /* brand-purple tint instead of plain white */
          color: #C8F23A;
          font-family: var(--font-body);
          font-size: 0.9rem;
          font-weight: 600;
          /* Guaranteed clearance below the fixed navbar — applies in every layout
             (works regardless of the section padding overrides per breakpoint). */
          margin: clamp(40px, 9vh, 96px) 0 0;
          backdrop-filter: blur(8px);
        }

        .lp-hero__title {
          font-family: var(--font-head);
          font-size: clamp(2.3rem, 4.4vw, 3.9rem);
          font-weight: var(--fw-head);
          line-height: 1.18;
          color: var(--lp-text);
          margin: 0;
          letter-spacing: -0.03em;
          max-width: 18ch;
        }
        /* Mobile hero title — custom line-by-line arrangement, centred + larger. Higher
           specificity (0,2,0) so it beats the various single-class .lp-hero__title mobile
           overrides regardless of source order. */
        .lp-hero--static .lp-hero__title--mobile {
          /* Each logical line ("The Performance System", "Behind The Top", "1% D2C Brands") stays
             on ONE line via nowrap + the <br>s. 7vw is the largest the longest line can be while
             still fitting the narrowest phones — above that it overflows/clips off the right edge. */
          font-size: clamp(1.5rem, 7vw, 3rem);
          font-weight: 600;
          line-height: 1.3;
          text-align: center;
          max-width: 100%;
          margin: 0 auto;
          white-space: nowrap;
          letter-spacing: -0.035em;
        }
        .lp-hero--static .lp-hero__title--mobile .lp-hero__title-accent {
          margin: 2px 0;
        }

        .lp-hero__mark {
          display: inline-block;
          background: #7387FF;
          color: var(--lp-text);
          padding: 0.04em 0.28em;
          border-radius: 10px;
          white-space: nowrap;
        }
        .lp-root .lp-hero__title-accent {
          /* inline (not inline-block) + clone so a highlight that wraps to a second
             line keeps the same purple padding/radius on every line. */
          display: inline;
          box-decoration-break: clone;
          -webkit-box-decoration-break: clone;
          background: transparent;
          color: #7387FF;
          -webkit-text-fill-color: #7387FF;
          padding: 0;
          border-radius: 0;
        }

        .lp-hero__subtitle {
          font-family: var(--font-body);
          color: rgba(var(--lp-fg), 0.65);
          font-size: 1.55rem;
          line-height: 1.55;
          max-width: 720px;
          margin: 0;
          text-align: left;
        }
        /* Mobile-only line break before "high-performing UGC ads" (own line). */
        /* Mid-sentence break — kept OFF everywhere now: on mobile each sentence stays on one
           line (shrunk + nowrap below) instead of wrapping into two. */
        .lp-hero__sub-mbr { display: none; }
        /* Hero subtitle second line ("Unlock serious growth…") shown on desktop, hidden on mobile. */
        @media (max-width: 768px) { .lp-hero__sub-line2 { display: none; } }

        .lp-root .lp-hero__accent {
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
          justify-content: center;
          gap: 10px;
          padding: 16px 32px;
          border-radius: 100px;
          background: #7387FF;
          color: var(--lp-text);
          font-family: var(--font-body);
          font-weight: 700;
          font-size: 1.05rem;
          border: none;
          cursor: pointer;
          /* subtle inner top highlight + a small soft dark shadow for a little depth */
          box-shadow: 0 6px 16px rgba(0, 0, 0, 0.28),
                      inset 0 1px 0 rgba(255, 255, 255, 0.4);
          transition: transform 0.25s ease, filter 0.25s ease, box-shadow 0.25s ease;
        }
        .lp-hero .lp-btn-primary:hover {
          transform: translateY(-2px);
          filter: brightness(1.08);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.45);
        }
        /* arrow rendered as a small circular badge inside the primary button */
        .lp-btn-arrow {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.28);
          flex-shrink: 0;
        }

        .lp-hero .lp-btn-ghost {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 15px 28px;
          border-radius: 100px;
          background: rgba(var(--lp-fg), 0.09);   /* lifted off pure black — less flat */
          color: var(--lp-text);
          font-family: var(--font-body);
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
          font-family: var(--font-body);
          font-size: 0.85rem;
          font-weight: 500;
          color: rgba(var(--lp-fg), 0.75);
          backdrop-filter: blur(8px);
        }
        .lp-proof-badge__icon {
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: linear-gradient(135deg, #7387FF, #7387FF);
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
            0 0 0 1px rgba(115, 135, 255, 0.15);
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
          /* The old -55vh pull-up was for the scroll-driven pinned leaderboard, which is now
             normal flow (.lp-logo3d is height:auto). At 0 the strip sits cleanly BELOW the
             stacked cards deck above it, so the order is: cards → brand strip → video grid. */
          margin-top: 0;
          /* Bottom trimmed 60px -> 16px. The showcase section directly below opens with its
             own generous top padding, so two full-size pads stacked back-to-back left a large
             dead band between the logo row and "We create the best UGC…". */
          padding: 60px 0 16px;
          /* Opaque page-colour, not transparent — this is the surface the logos' baked-in
             white backgrounds multiply away against.
             It has to live HERE, on the whole strip, rather than on each logo: putting it on
             the individual .lp-brand-item__icon boxes made every logo sit on its own cream
             tile, and those tiles read as visible rectangles wherever the surrounding page
             wasn't the exact same colour. One continuous surface has no edges to show.
             It cannot simply be left transparent and blended against the page either — this
             section sits inside a position:relative/z-index:3 wrapper (see the JSX), and a
             stacking context confines mix-blend-mode to itself, so the images would be
             multiplying against nothing.
             Trade-off: the shared animated background no longer shows through this band. */
          background: var(--lp-page-bg);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        /* In the standalone section the strip flows normally (not pinned absolute).
           Side-by-side row: the label sits fixed on the left, the continuously-scrolling
           logo track fills the remaining width to its right. */
        .lp-brandstrip .lp-hero__strip {
          position: relative;
          left: auto;
          bottom: auto;
          /* Same relational gutter as .lp-navbar / the content sections — see the note there.
             This row was the most visible victim: at 2560 its "TRUSTED BY LEADING brands"
             label started 517px left of the showcase heading directly beneath it. */
          padding-inline: max(4%, calc((100% - var(--lp-maxw)) / 2));
          flex-direction: row;
          align-items: center;
          gap: 40px;
          width: 100%;
        }
        .lp-brandstrip__label {
          flex-shrink: 0;
          font-family: var(--font-body);
          font-size: 1rem;
          font-weight: 900;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(var(--lp-fg), 0.5);
          line-height: 1.5;
        }
        /* Desktop shows the stacked two-line label; the mobile one-liner is off. Swapped
           in the ≤1024px block below. */
        .lp-brandstrip__label--mob { display: none; }
        /* Two classes (not one) to out-specificity the global ".lp-root span { color:
           var(--lp-text) }" base-text-color rule — a single-class selector here loses
           to that class+element-type selector regardless of source order. */
        .lp-brandstrip .lp-brandstrip__label--accent {
          color: var(--lp-purple-700);
        }
        /* Fills the remaining width next to the label (was 100vw full-bleed when the
           label sat above it); the mask fade still softens the right edge where the
           scrolling track runs out of room. */
        .lp-brands__viewport {
          flex: 1;
          min-width: 0;
          width: auto;
          max-width: 100%;
          overflow: hidden;
          -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 4%, #000 92%, transparent 100%);
                  mask-image: linear-gradient(90deg, transparent 0%, #000 4%, #000 92%, transparent 100%);
        }
        .lp-brands__track--single {
          display: flex;
          gap: 40px;
          width: max-content;
          align-items: center;
          padding: 0 20px;
          will-change: transform;
          backface-visibility: hidden;
          animation: scrollBrandsSingle 55s linear infinite;
        }
        @keyframes scrollBrandsSingle {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }   /* set is duplicated once → seamless */
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
          font-family: var(--font-body);
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
          will-change: transform;
          backface-visibility: hidden;
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
          font-family: var(--font-body);
        }
        /* Single-line marquee items: flat, evenly-spaced brand chips. */
        .lp-brand-item {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          font-family: var(--font-body);
        }
        /* Sized by HEIGHT with width free, the standard logo-strip pattern (and what
           CreatorLanding's brand row already does). It was a fixed SQUARE box, which is why
           these read as tiny: every one of these files is a "-removebg-preview" export with
           transparent padding baked in, so forcing a 4:1 wordmark into a square left its
           actual ink occupying a small patch in the middle. A common height instead makes
           every mark render at the same optical size whatever its aspect ratio, and wide
           wordmarks get the width they need (capped so one long mark can't dominate). */
        .lp-brand-item__icon {
          position: relative;
          height: var(--lp-logo-h);
          width: auto;
          min-width: var(--lp-logo-h);
          max-width: 210px;
          overflow: hidden;
          /* Transparent on purpose. The opaque surface the logos multiply against lives on
             .lp-brandstrip instead — painting it per-logo here gave each mark its own cream
             tile, and those tiles showed as rectangles against any slightly different
             backdrop. The strip provides one continuous surface with no edges. */
          background: transparent;
          border: none;
          box-shadow: none;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .lp-brand-item__icon img {
          /* --logo-s is the per-logo optical scale set inline from the brands list; see the
             comment there for why one flat height cannot size these evenly. Defaults to 1 so
             a logo added without a scale still renders. */
          height: calc(100% * var(--logo-s, 1));
          width: auto;
          max-width: 210px;
          /* contain, NOT cover. cover cropped a wide mark to a square centre slice — with
             these padded exports that meant showing mostly empty transparent canvas. */
          object-fit: contain;
          /* Baked-in white backgrounds blend into the cream page bg so logos float. */
          mix-blend-mode: multiply;
          /* Grayscale-by-default was removed. It flattened the pale marks (Seltyca, Sephora)
             into near-invisible grey on the cream strip, and it only ever applied on
             hover-capable devices — the (hover: none) rule below already showed phones full
             colour, so desktop and mobile disagreed. Now both show colour. */
          transition: filter 0.25s ease;
        }
        /* Artwork drawn in near-white grey needs darkening or it vanishes against the cream.
           Scoped to the flagged logos only: this would wreck a coloured mark. */
        .lp-brand-item__icon--faint img {
          filter: brightness(0.42) contrast(1.5);
        }
        /* The (hover: none) override that used to sit here is gone with the grayscale it was
           compensating for. Removing it matters: it set "filter" on the same
           ".lp-brand-item__icon img" selector at EQUAL specificity but LATER in the sheet, so
           it would have overridden the --faint darkening above — blanking the pale logos on
           exactly the touch devices where the problem was reported.
           (Backticks are deliberately avoided in these comments: this whole stylesheet is a
           JS template literal, so a backtick here terminates the string.) */

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
          box-shadow: 0 0 0 2px rgba(115, 135, 255, 0.55),
                      0 0 28px rgba(115, 135, 255, 0.6),
                      0 0 120px rgba(115, 135, 255, 0.4);
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
        /* The path is hardcoded fill="#0a0a0a" for the dark seam; in light mode the
           section below shows the lavender page bg, so the curve must match it. */
        .lp-root[data-theme="light"] .lp-hero__divider path { fill: var(--lp-page-bg); }

        /* ── 3D glass logo — scroll-driven scene (measured.site-style) ───────── */
        /* The rotating leaderboard became 4 static cards — collapse the tall pinned
           scroll and un-stick the inner wrapper so the cards sit in normal flow. */
        /* Tall scroll TRACK: gives the pinned deck room to run. As you scroll through these
           extra viewports, the sticky child below stays pinned and the cards exit one by one. */
        .lp-logo3d {
          position: relative;
          height: 380vh;
          background: transparent;
          z-index: 2;
          padding: 0;
        }
        /* Pinned viewport: fills the screen and stays put while the section scrolls past,
           centring the card deck. overflow visible so exiting cards can slide off the top. */
        /* z-index above the section's ::after glow (below): as a sibling stacking context
           generated LATER in the DOM, the glow would otherwise paint on top of the card
           deck by default (equal/auto z-index falls back to DOM order), tinting the
           promise cards purple instead of sitting behind them. */
        .lp-logo3d__sticky {
          position: sticky !important; top: 0 !important;
          height: 100vh !important; min-height: 0 !important;
          transform: none !important; overflow: visible !important;
          display: flex !important; align-items: center !important; justify-content: center !important;
          z-index: 1 !important;
        }
        /* Deck stage: fixed-size box; every card is absolutely stacked to fill it, so they all
           start on top of each other. Each card's scroll-driven translateY (PromiseCard) then
           slides the front one up and away, revealing the next — one by one. */
        /* "Our Services" heading sits above the deck, inside the pinned viewport so it stays
           put while the cards animate. */
        .lp-promise-wrap {
          /* --svc-deck-h is the single source of truth for the deck's height, so the
             side rail lines up with the cards without measuring anything. --svc-gap is
             the stage's column gap, reused by the left path (which has to overflow its
             own column by exactly that much to reach the card). */
          position: relative;
          /* Matches every other section's gutter exactly: they use max-width:1320px with 4%
             horizontal padding, which resolves to min(1320px, 92vw) — so this mirrors that
             rather than carrying its own one-off width. */
          width: min(1320px, 92%); margin: 0 auto;
          /* Sized from viewport HEIGHT — one of the few places that is legitimate, because
             this deck lives inside a 100vh sticky pin (the scroll-driven card stack). A fixed
             460px left ~200px of dead space above AND below it on a tall monitor while the
             pin itself still filled the screen. 54vh resolves to ~467px at the 864px-tall
             reference, so the laptop view is unchanged; it fills a tall screen and floors at
             400px so a short laptop never crushes the cards. */
          --svc-deck-h: clamp(400px, 54vh, 640px);
          --svc-gap: clamp(28px, 3vw, 60px);
        }
        .lp-promise-heading {
          /* 20px → 10px: the rule below now carries the separation, so the heading→deck
             stack lands at ~25px total instead of growing the section vertically. */
          margin: 0 0 10px; font-family: var(--font-head); font-weight: 500;
          font-size: var(--lp-fs-h2); color: #171334; letter-spacing: -0.5px;
          text-align: center;
        }
        /* Short rule under the heading — one of only two purely decorative marks in
           the section. Colour follows the active card. */
        .lp-promise-rule {
          display: block; width: 44px; height: 3px; border-radius: 999px;
          margin: 0 auto 12px; opacity: .85;
          transition: background .5s cubic-bezier(.22, 1, .36, 1);
        }
        .lp-promise {
          position: relative; width: 100%; height: var(--svc-deck-h);
        }

        /* ── The stage ───────────────────────────────────────────────────────────
           Below 1340px this is just the deck, full width and centred exactly as it
           was. From 1340px up it becomes a grid — aside | deck | rail — so the deck
           is centred BETWEEN its two neighbours rather than having them overlap it.
           The deck track is minmax(0, 1fr): it absorbs all the remaining width, which
           keeps it ~980-1160px across the desktop range instead of a fixed 1120px.
           1340 is the point below which paying for the aside would cost the deck more
           than 10% of its width. */
        .lp-promise-stage { display: block; }
        .lp-svc-aside, .lp-svc-rail { display: none; }
        @media (min-width: 1280px) {
          /* No width override here any more — the wrap used to widen to min(1560px, 95%)
             to make room for the two side columns, which is exactly what made this section
             run wider than every other one on the page. It now keeps the shared
             min(1320px, 92%) from the base rule and the side columns take their share of
             that instead (the deck still clears ~1000px after the aside + gap). */
          .lp-promise-stage {
            display: grid;
            grid-template-columns: clamp(190px, 16.5vw, 258px) minmax(0, 1fr);
            column-gap: var(--svc-gap);
            align-items: stretch;
          }
          /* Left column — the statement, then the curve down to the card. */
          .lp-svc-aside {
            display: flex; flex-direction: column;
            position: relative; padding-top: 18px;
          }
          .lp-svc-aside__title {
            margin: 0 0 16px; font-family: var(--font-head); font-weight: 700;
            font-size: clamp(26px, 2.2vw, 34px); line-height: 1.14;
            letter-spacing: -0.6px; color: #171334;
          }
          /* Serif italic is a deliberate one-off display treatment for this phrase
             (it is not part of the brand stack) — swap for var(--font-head) if that
             flourish isn't wanted. Colour follows the active card. */
          .lp-svc-aside__title em {
            font-family: Georgia, 'Times New Roman', serif;
            font-style: italic; font-weight: 400; letter-spacing: -0.2px;
            transition: color .5s cubic-bezier(.22, 1, .36, 1);
          }
          .lp-svc-aside__sub {
            margin: 0; font-family: var(--font-body);
            font-size: 14.5px; line-height: 1.65; color: rgba(23, 19, 52, .58);
          }
          /* Overflows its own column to the right by exactly one --svc-gap (less 14px)
             so the arrow lands just short of the card's left edge. z-index 0 keeps it
             behind the deck (cards carry z-index 4…1), so a card slanting away on
             scroll passes cleanly over the top. */
          .lp-svc-path {
            position: absolute; z-index: 0; pointer-events: none;
            left: 0; right: calc(-1 * var(--svc-gap) + 14px);
            /* Percentages resolve against the aside's height, which the grid stretches
               to the deck's — so the arrow lands ~80% down the card, level with the
               stacked cards peeking out below the front one. */
            top: 48%; bottom: 12%;
          }
          .lp-svc-path svg { width: 100%; height: 100%; display: block; overflow: visible; }
          .lp-svc-path__dot { transition: fill .5s cubic-bezier(.22, 1, .36, 1); }
          /* Right rail — deliberately thin: a 1px track, a 7px dot and a 12px number.
             Its own grid track, aligned exactly to the deck's top and bottom edges. */
          .lp-svc-rail {
            position: relative; align-self: end;
            height: var(--svc-deck-h); width: 38px; pointer-events: none;
          }
          .lp-svc-rail__track {
            position: absolute; left: 3px; top: 9px; bottom: 9px; width: 1px;
            background: rgba(23, 19, 52, .12);
          }
          .lp-svc-rail__fill {
            position: absolute; inset: 0; transform-origin: top center;
            transition: background .5s cubic-bezier(.22, 1, .36, 1);
          }
          .lp-svc-rail__list {
            position: absolute; inset: 0; margin: 0; padding: 0; list-style: none;
            display: flex; flex-direction: column; justify-content: space-between;
          }
          .lp-svc-rail__item { display: flex; align-items: center; gap: 11px; }
          .lp-svc-rail__dot {
            flex: 0 0 auto; width: 7px; height: 7px; border-radius: 50%;
            background: rgba(23, 19, 52, .18);
            transition: background .45s cubic-bezier(.22, 1, .36, 1),
                        box-shadow .45s cubic-bezier(.22, 1, .36, 1),
                        transform .45s cubic-bezier(.22, 1, .36, 1);
          }
          .lp-svc-rail__num {
            font-family: var(--font-head); font-size: 12px; font-weight: 700;
            letter-spacing: .14em; color: rgba(23, 19, 52, .3);
            transform-origin: left center;
            transition: color .45s cubic-bezier(.22, 1, .36, 1),
                        transform .45s cubic-bezier(.22, 1, .36, 1);
          }
          /* The only "state" change: a touch of scale plus the active card's accent. */
          .lp-svc-rail__item.is-active .lp-svc-rail__dot { transform: scale(1.15); }
          .lp-svc-rail__item.is-active .lp-svc-rail__num { transform: scale(1.18); }
        }
        /* The rail only earns its column once there's width to spare — under 1400px the
           aside plus the deck already use it all, and squeezing the deck further to fit
           a 38px rail would cost more than the rail is worth. */
        @media (min-width: 1280px) {
          .lp-promise-stage {
            grid-template-columns: clamp(190px, 16.5vw, 258px) minmax(0, 1fr) 38px;
          }
          .lp-svc-rail { display: block; }
        }
        @media (prefers-reduced-motion: reduce) {
          .lp-promise-rule, .lp-svc-aside__title em, .lp-svc-path__dot,
          .lp-svc-rail__fill, .lp-svc-rail__dot, .lp-svc-rail__num { transition: none; }
        }
        /* Three-column split: number, then content, then a rounded video panel — all
           sit inside the card as flex siblings (not absolutely positioned), so the
           content's natural height drives vertical centering instead of fixed offsets. */
        .lp-promise__card {
          position: absolute; inset: 0;
          display: flex; align-items: flex-start; gap: 24px;
          border-radius: 28px; padding: 44px 48px; overflow: hidden;
          border: 1px solid rgba(28,27,75,0.12);
          box-shadow: 0 30px 60px -34px rgba(28,27,75,.35);
          will-change: transform;
        }
        .lp-promise__num {
          flex-shrink: 0;
          font-family: var(--font-head); font-weight: 700;
          font-size: var(--lp-fs-h2); color: #171334; line-height: 1.05;
        }
        .lp-promise__content {
          flex: 1 1 auto; min-width: 0; align-self: center;
          display: flex; flex-direction: column; align-items: flex-start; gap: 12px;
        }
        .lp-promise__title {
          margin: 0; font-family: var(--font-head); font-weight: 500;
          font-size: var(--lp-fs-h2); color: #171334; line-height: 1.05; letter-spacing: -0.5px;
        }
        .lp-promise__sub {
          margin: 0; font-family: var(--font-body);
          font-size: 15.5px; color: rgba(23,19,52,.72);
        }
        .lp-promise__desc {
          margin: 6px 0 4px; font-family: var(--font-body);
          font-size: 15px; line-height: 1.6; color: rgba(23,19,52,.82);
        }
        .lp-promise__btn {
          display: inline-flex; align-items: center; gap: 10px; cursor: pointer;
          border: none; border-radius: 10px;
          padding: 12px 18px; font-family: var(--font-body);
          font-size: 14.5px; font-weight: 700; transition: transform .18s ease;
        }
        .lp-promise__btn:hover { transform: translateY(-2px); }
        .lp-promise__btn svg { color: currentColor; }
        /* Video — rounded panel, third column, fills the card's full height */
        .lp-promise__video {
          flex: 0 0 32%; align-self: stretch;
          display: flex; align-items: center; justify-content: center;
          border-radius: 20px;
          box-sizing: border-box; overflow: hidden;
          background: rgba(0,0,0,.12); box-shadow: 0 18px 36px -18px rgba(0,0,0,.45);
        }
        /* contain (not cover) — shows the whole video frame within the card instead of
           cropping it to fill the panel. */
        .lp-promise__video video { width: 100%; height: 100%; object-fit: contain; display: block; }

        /* ── Services, MOBILE accordion (see PromiseMobile) ───────────────────────────
           Content-driven height throughout — no vh, no pinning. That is the whole point:
           the desktop deck needs a 100vh runway and clipped its open card on a phone. */
        .lp-svcm { display: block; text-align: center; }
        .lp-svcm__eyebrow {
          display: inline-block; font-family: var(--font-body);
          font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase;
          color: #a3ba22; padding-top: 10px; border-top: 2px solid #a3ba22;
        }
        .lp-svcm__title {
          margin: 12px 0 0; font-family: var(--font-head); font-weight: var(--fw-head);
          font-size: 27px; line-height: 1.18; letter-spacing: -0.5px; color: #171334;
        }
        /* Serif italic matches the desktop aside's treatment of this same phrase. */
        .lp-svcm__title em {
          font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-weight: 400;
          transition: color .4s ease;
        }
        .lp-svcm__sub {
          margin: 10px auto 0; max-width: 34ch; font-family: var(--font-body);
          font-size: 13.5px; line-height: 1.6; color: rgba(23, 19, 52, .6);
        }
        /* Deck: the front card sits in normal flow and therefore SETS the height; the strips
           for upcoming cards are absolutely positioned to that same box and nudged down, so
           only their lower edge shows. Keeping the front card in flow is what makes the deck
           content-driven — an all-absolute stack would need a hardcoded height, which is what
           clipped the card's lower half before. */
        .lp-svcm__deck { position: relative; margin-top: 20px; }
        .lp-svcm__ghost {
          position: absolute;
          inset: 0;
          display: block;
          border-radius: 22px;
          /* Same origin as the scale() applied inline, so each strip shrinks toward the deck's
             top edge and its offset below stays even. */
          transform-origin: 50% 0;
          pointer-events: none;
          box-shadow: 0 10px 22px -14px rgba(23, 19, 52, 0.28);
          transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1), background 0.35s ease;
        }
        .lp-svcm__card {
          /* Above the strips. The card is static and they are absolute, so without an explicit
             z-index (and position) they would paint over it. */
          position: relative;
          z-index: 5;
          /* margin-top moved to .lp-svcm__deck — leaving it here would offset the card from
             the strips, which are positioned against the deck box, and break their alignment. */
          border-radius: 22px; padding: 20px 18px 22px;
          text-align: left; transition: background .35s ease;
        }
        .lp-svcm__card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .lp-svcm__num {
          font-family: var(--font-head); font-weight: 700; font-size: 30px;
          line-height: 1; letter-spacing: -1px; color: #171334;
        }
        .lp-svcm__meter { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; padding-top: 4px; }
        .lp-svcm__count {
          font-family: var(--font-body); font-size: 11px; font-weight: 700;
          letter-spacing: 0.08em; color: rgba(23, 19, 52, .55);
        }
        .lp-svcm__bar { display: block; width: 62px; height: 3px; border-radius: 99px; background: rgba(23,19,52,.14); overflow: hidden; }
        .lp-svcm__bar-fill { display: block; height: 100%; border-radius: 99px; transition: width .35s ease, background .35s ease; }
        .lp-svcm__card-title {
          margin: 14px 0 0; font-family: var(--font-head); font-weight: var(--fw-head);
          font-size: 23px; line-height: 1.2; letter-spacing: -0.4px; color: #171334;
        }
        .lp-svcm__card-sub {
          margin: 6px 0 0; font-family: var(--font-body);
          font-size: 13.5px; line-height: 1.5; color: rgba(23, 19, 52, .72);
        }
        /* FULL-BLEED across the card. contain was letterboxing these portrait clips into a
           landscape window, so most of the width showed card colour instead of video. cover
           fills the box edge-to-edge; the 4/3 window (rather than a wider 16/10) keeps the
           crop off a portrait source modest, and object-position biases upward so the crop
           takes it off the bottom of frame rather than off the subject's head. */
        .lp-svcm__video {
          margin-top: 14px; border-radius: 14px; overflow: hidden;
          aspect-ratio: 4 / 3; background: rgba(0,0,0,.10);
        }
        .lp-svcm__video video {
          width: 100%; height: 100%; display: block;
          object-fit: cover; object-position: center 30%;
        }
        .lp-svcm__card-desc {
          margin: 14px 0 0; font-family: var(--font-body);
          font-size: 13.5px; line-height: 1.6; color: rgba(23, 19, 52, .78);
        }
        .lp-svcm__cta {
          margin-top: 16px; display: inline-flex; align-items: center; gap: 8px;
          border: none; border-radius: 12px; padding: 13px 18px; cursor: pointer;
          font-family: var(--font-body); font-weight: 700; font-size: 13.5px;
        }
        @media (max-width: 760px) {
          /* RUNWAY + PIN restored. PromiseMobile's deck is scroll-driven, so it needs scroll
             distance to spend: 240vh gives each of the 4 cards ~60vh of travel, which is
             roughly a comfortable flick per card. Without it the deck only had its own height
             to work with — a single swipe blew through all four and left the reader at the last
             one with the section already gone, which is exactly the reported symptom.
             The pin is what makes those 240vh feel like one screen: the deck sticks at the top
             of the viewport and stays put while the runway scrolls behind it, so all four cards
             play out IN PLACE and only then does the page continue to the next section.
             height:auto on the sticky (not 100vh) so a tall card is never cut off — the element
             pins by its top edge and does not need a fixed height to do so. */
          /* Negative margin pulls the whole services section up over the hero's dead tail.
             Measured at 390x860: the hero is min-height:100vh but its content ends at 708px,
             so it carries 152px of slack, and the sticky then added 72px of its own padding —
             224px of blank between the hero CTA and "Our Services".
             Trimming the hero itself is the wrong lever: the slack is min-height slack, not
             padding, so shortening its padding would not move the section up at all (and a
             sub-100vh hero is a different design decision). Overlapping the empty tail is
             what actually closes the gap, and there is nothing painted there to collide with. */
          .lp-logo3d { height: 240vh !important; margin-top: -140px; }
          .lp-logo3d__sticky {
            position: sticky !important;
            top: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            display: block !important;
            /* DO NOT trim this to close the gap above the section — it is clearance, not
               padding. The navbar is position:fixed at top:20px and 48px tall, so it covers
               0-68px of the viewport; with the sticky pinned at top:0 anything under ~72px
               renders BEHIND it. Dropping this to 28px put "Our Services" level with the logo
               and hamburger. The gap is closed by the negative margin above instead, which
               moves the section without changing where the heading sits once pinned. */
            padding: 72px 0 24px !important;
          }
          /* Still hidden: the 3D mark was choreographed to sit in the middle of a 100vh pinned
             stage, and this pin is content-height, so it has nowhere to land. */
          .lp-logo3d__stage { display: none !important; }
          .lp-promise-wrap { width: 92%; }
          .lp-promise-heading { font-size: 24px; margin: 0 0 10px; text-align: center; }
          /* Side furniture is already off (its media query starts at 1280px); the rule
             is the only outside mark that survives down here, tightened to match. */
          .lp-promise-rule { width: 34px; height: 2px; margin: 0 auto 14px; }
          /* 74vh capped at 600px -> 78vh uncapped. With the deck now top-aligned there is
             real room below it, and the 600px cap was the other half of why the card clipped:
             on a 812px phone it held the deck to 600px while the card's own content (video +
             title + sub + description + button) needed more. */
          .lp-promise { width: 100%; height: 78vh; max-height: none; }
          /* Stays position:absolute;inset:0 (from the base rule) — the deck's scroll-driven
             y/scale/rotate transform depends on every card being absolutely stacked inside a
             fixed-height container. Only the internal arrangement changes here: video on top,
             number + content below, instead of the desktop three-column split. */
          .lp-promise__card { flex-direction: column; align-items: stretch; gap: 10px; padding: 22px; overflow-y: auto; }
          .lp-promise__video { order: -1; flex: none; width: 100%; height: 38%; align-self: auto; }
          .lp-promise__content { flex: none; width: 100%; gap: 8px; align-self: auto; }
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
        /* Light mode: both the hero above and this section already sit on the same
           flat Frosted Lilac page background, so no "melt into" gradient (or the
           glow blob below) is needed to hide a seam — removed both. */
        .lp-root[data-theme="light"] .lp-logo3d::before { display: none; }
        .lp-logo3d::after { display: none; }
        .lp-logo3d__sticky {
          position: sticky;
          top: 0;
          height: 100vh;
          width: 100%;
          overflow: hidden;
          display: flex;
          align-items: center;
          /* Centre the leaderboard rows in the viewport; the landed logo rests far
             enough left (~-36vw) that the centred rows clear it. */
          justify-content: center;
          padding-right: 0;
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
          /* Promote the canvas to its own GPU compositor layer so scroll-driven
             repaints don't thrash the main thread. */
          will-change: transform;
          transform: translateZ(0);
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
          align-items: center;
          justify-content: center;
          text-align: center;
          /* Statements stay on ONE line — the font scales with viewport width (clamp/vw) so the
             longest line always fits the board (≈64vw, max 760px) without wrapping or clipping. */
          white-space: nowrap;
          width: max-content;
          text-decoration: none;
          font-family: var(--font-head);
          letter-spacing: -0.03em;
          line-height: 1;
          /* Base size = JS peak; the per-row scale() does the size falloff so font-size never
             animates (no reflow per scroll frame). Responsive so a long line fits narrow desktops. */
          font-size: clamp(17px, 2.8vw, 34px);
          will-change: transform, opacity;
          /* Scope layout/paint recalcs to each row so one row re-rastering (colour /
             weight step) can't invalidate the whole board. */
          contain: layout paint;
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
          font-family: var(--font-body);
        }
        @media (max-width: 900px) {
          /* Shorter runway = less empty scroll AFTER the rows finish (the old 260vh left a long
             dead tail before the brand strip caught up). 175vh keeps a readable flow but the
             brand strip now rises in right behind the last rows. */
          .lp-logo3d { height: 320vh; }
          .lp-logo3d__stage {
            top: 80%;          /* sit lower — down in the empty space below the leaderboard text */
            width: clamp(170px, 46vw, 280px);
            height: clamp(170px, 30vh, 300px);
            margin-top: calc(clamp(170px, 30vh, 300px) * -0.5);
            /* centred, then nudged a bit RIGHT to line up with the brand-strip logo below */
            margin-left: calc(clamp(170px, 46vw, 280px) * -0.5 + 14px);
          }
          /* MOBILE perf: this board is transformed every scroll frame (the lockstep rise +
             rows). A mask-image forces the GPU to RE-RASTERISE a masked element each frame it
             moves instead of just translating a cached layer — that was the heavy leaderboard
             lag. Drop it on mobile: the per-row opacity already fades rows to ~0 away from the
             centre, so the edge fade is preserved visually. perspective is unused here too (the
             phone rows use a 2D rotate, not rotateX/Y), so drop it to skip the 3D render context. */
          .lp-logo3d__board {
            width: 96%;
            -webkit-mask-image: none;
                    mask-image: none;
            perspective: none;
          }
          /* One line on phones too: scale with vw so the longest sentence ("We only work with
             brands that want to lead") still fits the ~96vw board without wrapping/clipping.
             5.3vw is the largest that keeps that longest line on one line across phone widths.
             top: shift the whole row stack UP so the text comes up higher under the hero. */
          .lp-logo3d__boardItem { font-size: clamp(13px, 5.3vw, 23px); top: 36%; }
        }

        /* ── The Problem section ──────────────────────────────────────────── */
        .lp-problem {
          padding: calc(var(--lp-space-section) * 0.833) 4% calc(var(--lp-space-section) * 0.5);
          background: rgba(var(--lp-fg), 0.06);
        }
        .lp-problem__inner {
          max-width: var(--lp-maxw);
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
          font-family: var(--font-body);
          font-size: 0.82rem;
          font-weight: 500;
          margin-bottom: 18px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .lp-problem__pill svg { color: var(--lp-purple-600); }

        .lp-problem__heading {
          font-family: var(--font-head);
          font-size: var(--lp-fs-h2);
          font-weight: var(--fw-head);
          color: var(--lp-ink);
          line-height: 1.15;
          letter-spacing: -0.04em;
          margin: 0 0 16px 0;
          max-width: 900px;
          margin-left: auto;
          margin-right: auto;
        }
        .lp-root .lp-problem__heading--accent {
          color: #7387FF;
          background: none;
          -webkit-text-fill-color: #7387FF;
        }
        .lp-problem__subtitle {
          font-family: var(--font-body);
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
          font-family: var(--font-head);
          font-size: var(--fs-h2);
          font-weight: var(--fw-head);
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
          color: #7387FF;
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
          font-family: var(--font-body);
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
        /* Gutter lives on the SECTION and the cap on the inner — the same split every other
           section uses (cf. .lp-audit + .lp-audit__inner). It used to put the 4% on the inner
           INSTEAD, which silently ate the padding out of the 1320px cap: content came out
           1320 - 8% = 1214px, i.e. ~53px narrower per side than the sections above and below
           it, even though both were nominally "1320px wide with 4% padding". */
        .lp-showcase {
          padding: calc(var(--lp-space-section) * 0.667) 4% calc(var(--lp-space-section) * 0.2);
          background: transparent;
          color: var(--lp-text);
        }
        .lp-showcase__inner {
          max-width: var(--lp-maxw);
          margin: 0 auto;
          text-align: center;
        }
        .lp-showcase__heading {
          font-family: var(--font-head);
          /* vw-scaled so the whole sentence stays on ONE line across widths */
          font-size: var(--lp-fs-h2);
          font-weight: var(--fw-head);
          color: #ffffff;
          line-height: 1.2;
          letter-spacing: -0.04em;
          margin: 0 0 10px 0;
          white-space: normal;
        }
        /* Forced line break: hidden on desktop (heading stays one nowrap line),
           shown on mobile to split the sentence into exactly two lines. */
        .lp-showcase__brk { display: none; }
        @media (max-width: 768px) {
          .lp-showcase__brk { display: inline; }
        }
        /* "best UGC" reads purple on this theme for brand-aligned accent. */
        .lp-root .lp-showcase__heading--accent {
          color: var(--lp-purple-700);
          background: none;
          -webkit-text-fill-color: var(--lp-purple-700);
        }
        /* Light theme: white would vanish on the lavender bg, so keep it readable. */
        .lp-root[data-theme="light"] .lp-showcase__heading { color: var(--lp-ink); }
        .lp-root[data-theme="light"] .lp-showcase__heading--accent {
          color: #7387FF;
          -webkit-text-fill-color: #7387FF;
        }
        .lp-showcase__subtitle {
          font-family: var(--font-body);
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
          max-width: var(--lp-maxw);
          margin-left: auto;
          margin-right: auto;
        }
        /* Full-width flex item: forces a line break so row 1 = 5 pills, row 2 = the rest. */
        /* Forces a wrap after the 5th pill so the bar reads 5 / 4+Reset. That only works while
           5 pills actually FIT on one line — they need ~958px, and the container gives
           min(1320, 92vw), i.e. ~942px at 1024. Between ~720px and ~1040px the 5th pill
           wrapped on its own and this spacer then forced ANOTHER break, producing a ragged
           4 / 1 / 5 three-row bar. Disabled wherever the row can't hold five, so the pills
           just wrap naturally instead. */
        .lp-showcase__filters-break {
          flex-basis: 100%;
          height: 0;
        }
        @media (max-width: 1024px) {
          .lp-showcase__filters-break { display: none; }
        }
        /* (The old duplicate of this at 720px is gone — the 1080px rule above already covers
           every width where the forced break was a problem.) */

        .lp-filter {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          border-radius: 100px;
          background: rgba(var(--lp-fg), 0.06);
          border: 1px solid var(--lp-border);
          color: var(--lp-text);
          font-family: var(--font-body);
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
          background: var(--lp-purple-50);
          color: var(--lp-ink);
          border-color: var(--lp-purple-300);
          font-weight: 700;
        }
        .lp-filter--reset svg { color: var(--lp-ink); }
        .lp-filter--reset:hover {
          background: var(--lp-purple-100, var(--lp-purple-50));
          color: var(--lp-ink);
          border-color: var(--lp-purple-500);
        }

        /* ── Filterable example grid (replaces the old auto-scroll marquee) ── */
        .lp-showcase__grid {
          display: grid;
          /* FIVE columns on desktop — an explicit count, not auto-fill. auto-fill derives the
             count from available width, which on a wide screen produced SEVEN columns and left
             the 10 cards as a ragged 7 + 3. A fixed count keeps them as two clean rows of five
             at every desktop width, and the cards simply get wider on a bigger screen (which is
             what "premium desktop" should look like) instead of multiplying.
             Steps down on the standard ladder below; the count only ever changes at a
             breakpoint, so card width stays monotonic as the window resizes. */
          grid-template-columns: repeat(5, 1fr);
          gap: 20px;
          text-align: left;
        }
        @media (max-width: 1280px) { .lp-showcase__grid { grid-template-columns: repeat(4, 1fr); } }
        @media (max-width: 1024px) { .lp-showcase__grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 768px)  { .lp-showcase__grid { grid-template-columns: repeat(2, 1fr); gap: 16px; } }
        /* Load more → signup */
        .lp-showcase__more { display: flex; justify-content: center; margin-top: 34px; }
        .lp-root .lp-showcase__more-btn {
          border: 1px solid rgba(28,27,75,0.18); background: #fff; color: #1c1b4b;
          font-family: var(--font-body); font-weight: 700; font-size: 15px;
          padding: 13px 34px; border-radius: 999px; cursor: pointer;
          box-shadow: 0 10px 24px -12px rgba(28,27,75,0.28); transition: transform .18s ease, box-shadow .18s ease;
        }
        .lp-showcase__more-btn:hover { transform: translateY(-2px); box-shadow: 0 16px 30px -12px rgba(28,27,75,0.34); }
        .lp-showcase__empty {
          margin: 40px auto 0;
          color: var(--lp-text-muted);
          font-family: var(--font-body);
          font-size: 1rem;
        }

        /* Load more — routes to sign-up rather than paginating */
        .lp-showcase__more {
          display: flex;
          justify-content: center;
          margin-top: 44px;
        }
        .lp-root .lp-showcase__more-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 34px;
          border-radius: 100px;
          border: 1px solid #7387FF;
          background: #7387FF;
          color: #fff;
          font-family: var(--font-body);
          font-size: 1rem;
          font-weight: 700;
          letter-spacing: -0.01em;
          cursor: pointer;
          transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
          box-shadow: 0 12px 28px -12px rgba(7, 7, 78, 0.5);
        }
        .lp-showcase__more-btn:hover {
          background: #5c6cff;
          border-color: #5c6cff;
          transform: translateY(-2px);
          box-shadow: 0 18px 34px -12px rgba(7, 7, 78, 0.55);
        }

        .lp-vcard {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .lp-vcard__media {
          position: relative;
          aspect-ratio: 9 / 15;
          border-radius: 18px;
          overflow: hidden;
          background: #111;
          box-shadow: 0 18px 40px rgba(7, 7, 78, 0.10);
        }
        /* Fallback for browsers without aspect-ratio support (some older Chrome/Firefox/Safari
           builds, still out there on older laptops) — without this, .lp-vcard__media collapses
           to 0 height and each card falls back to its video/image's own intrinsic size, which
           is why cards in the same row ended up visibly different heights on some machines. */
        @supports not (aspect-ratio: 1 / 1) {
          .lp-vcard__media { height: 0; padding-top: 166.67%; }
        }
        .lp-vcard__video {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          background: #111;
        }
        /* Hover-to-play clip wrapper. The control bar (play/pause, mute, "more" dot, scrub)
           and the dark gradient that kept its icons legible are both gone — the card is now
           just the footage, with the poster still showing until the pointer arrives. */
        .lp-vcard__videowrap { position: absolute; inset: 0; }
        /* Mute / unmute toggle, bottom-right of the clip. Always visible rather than
           hover-only: on touch there is no hover, and it is the sole way to get audio.
           Dark translucent pill so it reads on any frame the video happens to be showing. */
        .lp-root .lp-vcard__mute {
          position: absolute;
          right: 8px;
          bottom: 8px;
          z-index: 3;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          border: none;
          border-radius: 50%;
          background: rgba(15, 15, 25, 0.62);
          color: #fff;
          cursor: pointer;
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          transition: background 0.18s ease, transform 0.18s ease;
        }
        .lp-root .lp-vcard__mute:hover { background: rgba(15, 15, 25, 0.82); transform: scale(1.06); }
        /* Keyboard focus has to stay visible — the button sits on video, so the default
           outline can vanish against a light frame. */
        .lp-root .lp-vcard__mute:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
        /* Bigger tap target on touch, where 32px is below a comfortable minimum. */
        @media (hover: none) {
          .lp-root .lp-vcard__mute { width: 40px; height: 40px; }
        }
        /* Category tag — sits ON the clip now (top-right), not in the meta row below.
           .lp-vcard__media (its actual parent, see JSX) is position:relative, so absolute
           resolves against the clip itself. It USED to render inside .lp-vcard__meta
           instead — static, same as .lp-vcard/the grid/the section — so with no positioned
           ancestor anywhere it resolved against .lp-root and every chip on the page piled
           up in the top-right corner behind the navbar. Fixed by moving it to the clip,
           the one place an absolute chip actually makes sense here. */
        .lp-vcard__tag {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          padding: 6px 14px;
          border-radius: 100px;
          background: rgba(255, 255, 255, 0.94);
          color: #15163a;
          font-family: var(--font-body);
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: -0.01em;
          box-shadow: 0 4px 12px rgba(0,0,0,0.14);
        }
        .lp-vcard__tag--onmedia {
          position: absolute;
          top: 10px;
          right: 10px;
          z-index: 2;
          max-width: calc(100% - 20px);
        }
        /* Footer under each clip: just the star rating now. The brand name, "By <creator>"
           and the avatar chip that used to sit in a row above it are gone, so the
           .lp-vcard__meta-top / __who / __brand / __by rules went with them. */
        .lp-vcard__meta {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 0 2px;
        }
        .lp-vcard__meta-bottom {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        /* Rating: outline stars with a gold fill layer clipped to the rating %. */
        .lp-vcard__stars {
          position: relative;
          display: inline-block;
          line-height: 0;
          flex-shrink: 0;
        }
        .lp-vcard__stars-row { display: flex; gap: 1px; }
        .lp-vcard__stars-row svg { flex-shrink: 0; }
        .lp-vcard__stars-row--full {
          position: absolute;
          top: 0;
          left: 0;
          overflow: hidden;
          white-space: nowrap;
        }
        .lp-vcard__rating-num {
          font-family: var(--font-body);
          font-weight: 700;
          font-size: 0.9rem;
          color: var(--lp-text);
        }
        /* Creator level chip next to the rating. */
        .lp-vcard__tier {
          /* Overlay badge on the clip. It had no position at all, so it sat in normal flow as
             the first child of .lp-vcard__media — a fixed 9/15 aspect-ratio box — where the
             absolutely-positioned video (inset:0) painted straight over it. Invisible, and its
             line box still consumed height inside a fixed-ratio container. */
          position: absolute;
          top: 10px;
          left: 10px;
          z-index: 2;
          font-family: var(--font-body);
          font-weight: 700;
          font-size: 0.66rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 3px 9px;
          border-radius: 100px;
          white-space: nowrap;
          /* White on a SOLID tier colour. These sit on top of arbitrary video frames, so the
             old treatment — a dark tint of the tier colour at 14–16% opacity — was effectively
             transparent: dark green/blue/purple text over whatever the clip happened to show,
             which on a dark or busy frame was unreadable. The fill now carries the colour
             coding and the text is always white; the drop shadow keeps the pill's edge visible
             against a light frame. */
          color: #ffffff;
          box-shadow: 0 2px 8px rgba(7, 7, 78, 0.30);
        }
        .lp-vcard__tier--rising { background: #16a34a; }
        .lp-vcard__tier--pro    { background: #4452f0; }
        .lp-vcard__tier--elite  { background: #7c3aed; }
        /* The .lp-vcard__logo / .lp-vcard__logo-img rules that were here are removed along with
           the creator profile-photo chip. */
        /* The 1280 / 1024 / 760 column-count overrides are gone — auto-fill above derives the
           count from the available width continuously, so there is nothing left to step. Only
           the phone rule below survives, and solely to force TWO columns where auto-fill's
           210px minimum would otherwise drop to one. */
        /* Phones keep TWO cards per row. The old rule dropped to a single 320px-wide column,
           which made one clip fill almost the whole screen — you could only ever see one
           example at a time and had to scroll a long way to compare any two. At 360px wide
           with the section's 6% gutter, 2 columns + a 10px gap gives ~150px cards: small,
           but a 9:16 clip is still perfectly readable at that size. */
        @media (max-width: 460px) {
          .lp-showcase__grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
          /* Card furniture is sized for a ~250px desktop card; scaled down so it doesn't
             swamp a 150px one. (The control-dot overrides that used to live here went with
             the control bar itself.) */
          .lp-vcard__tier { font-size: 0.58rem; padding: 2px 7px; }
          .lp-vcard__tag { padding: 4px 9px; font-size: 0.62rem; }
          .lp-vcard__tag--onmedia { top: 8px; right: 8px; }
          .lp-vcard__meta { gap: 5px; }
          .lp-vcard__rating-num { font-size: 0.78rem; }
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
          padding: 0 4%;
          will-change: transform;
        }
        .lp-showcase__track--left {
          animation: showcaseScrollLeft 55s linear infinite;
        }
        .lp-showcase__track--right {
          animation: showcaseScrollRight 55s linear infinite;
        }
        /* Pause only the row being hovered, not both rows. */
        .lp-showcase__row:hover .lp-showcase__track {
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
        /* Mobile: showcase row 1 is rendered at the TOP of the hero (.lp-hero__videorow) to fill
           the space above the title, so hide the showcase section's own first row here — only the
           hero's copy and row 2 show, no duplication. Scoped to .lp-showcase so it never hides the
           hero's row (which lives under .lp-hero). */
        @media (max-width: 768px) {
          .lp-showcase .lp-showcase__row:first-child { display: none; }
          /* Hero's own marquee row uses slightly larger cards than the showcase below. */
          .lp-hero__videorow .lp-showcase-item { width: 208px; }
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
          /* Deliberately NOT force-promoted (no translateZ here). The MOVING thing is the
             track, which is its own GPU layer (will-change: transform on .lp-showcase__track),
             so paused/poster-only cards just ride along inside that one cached layer. Forcing
             every one of the ~64 cards onto its own layer instead bloated GPU memory and the
             compositor's layer count — a stutter source of its own. Playing clips auto-promote
             while they decode and de-promote when paused, so only the few on screen cost a layer. */
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
          border: 1px solid rgba(255, 255, 255, 0.16);
          /* Hardcoded white, NOT var(--lp-text): this pill's own background is near-black, so it
             needs light text regardless of the page theme. On the light theme --lp-text resolves
             to #1c1b4b — navy on near-black, i.e. invisible. */
          color: #ffffff;
          font-family: var(--font-body);
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
          font-family: var(--font-body);
          font-size: 0.66rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          /* Same reason as .lp-showcase-card__rating above — all three tier fills below are
             saturated darks, so the label is always white rather than theme-dependent. */
          color: #ffffff;
          text-transform: uppercase;
          box-shadow: 0 4px 12px rgba(0,0,0,0.25);
        }
        .lp-showcase-card__tier--elite {
          background: linear-gradient(135deg, #7387FF, #4338ca);
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
          font-family: var(--font-body);
          font-size: 1rem;
          font-weight: 600;
          color: var(--lp-ink);
          letter-spacing: -0.02em;
          line-height: 1.2;
        }
        @media (max-width: 640px) {
          .lp-showcase { padding: 60px 5%; }
          /* 8px -> 12px vertical: these pills are the primary control of the showcase, and at
             8px they came out ~34px tall — under a comfortable tap target. */
          .lp-filter { padding: 12px 14px; font-size: 0.82rem; }
        }

        /* ── Find & Hire Creators — fanned, side-by-side cards ── */
        /* Overlap onto the audit section's emptied card box, so Find & Hire is already on screen
           when the last question card peels off instead of arriving after a blank screen. The
           amount MUST track viewport height: the pinned audit block is a fixed ~730px tall, so
           the dead space it leaves is (viewport height - 730) and grows on tall monitors. Hence
           the vh term — a fixed px overlap that looks right at 800px tall leaves a 600px hole at
           1080. Clamped at both ends so a very short or very tall window can't run away.
           Overridden to 0 on tablet (no peel there) and to a phone-specific value on mobile. */
        .lp-achieve-rise {
          margin-top: clamp(-760px, calc(430px - 107vh), -260px);
        }
        .lp-achieve {
          position: relative;
          /* Bottom trimmed 90px -> 40px -> 0: that 90px was tuned for the old, shorter
             4-icon-card grid. Stacked with the connector spacer + .lpv's own top padding
             right after it, it left a large dead gap once this section's own content
             (taller video cards + sidebar) already carries its own visual weight. Now 0 —
             the removal of the "View examples" CTA took the last thing that needed clearance
             below the sidebar, so the connector + next section supply all the gap needed. */
          padding: calc(var(--lp-space-section) * 0.625) 4% 0;
          background: transparent;
          color: var(--lp-text);
          text-align: center;
        }
        .lp-achieve__title {
          margin: 0 auto;
          max-width: none;
          white-space: nowrap;
          text-align: center;
          font-family: var(--font-head);
          font-weight: var(--fw-head);
          font-size: var(--lp-fs-h2);
          line-height: 1.05;
          letter-spacing: -0.01em;
          color: var(--lp-text);
        }
        .lp-achieve__title em { font-style: italic; }
        .lp-achieve__title .lp-achieve__hl { color: #7387FF !important; }
        /* Desktop: "Creators" is highlighted; "Instantly" stays upright/default. */
        .lp-achieve__title .lp-achieve__word--instantly {
          color: inherit !important;
          font-style: normal;
        }
        /* Mobile: swap the highlight to "Instantly", "Creators" goes plain. */
        @media (max-width: 900px) {
          .lp-achieve__title .lp-achieve__word--creators {
            color: inherit !important;
            font-style: normal;
          }
          .lp-achieve__title .lp-achieve__word--instantly {
            color: #7387FF !important;
            font-style: italic;
          }
        }

        /* ── Find & Hire showcase: 3 video cards + a vetting-checklist sidebar ── */
        .lp-fh__subtitle {
          max-width: 640px;
          margin: 18px auto 0;
          text-align: center;
          font-family: var(--font-body);
          font-size: 1rem;
          line-height: 1.6;
          color: var(--lp-text-muted);
        }
        .lp-fh {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr)) minmax(260px, 320px);
          gap: 20px;
          max-width: var(--lp-maxw);
          margin: 44px auto 0;
        }
        .lp-fh__videos {
          display: contents;
        }
        /* Duplicate marquee half — mobile-only (see the ≤720px block). */
        .lp-fh__card--dup { display: none; }
        .lp-fh__card {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .lp-fh__video-wrap {
          position: relative;
          border-radius: 18px;
          overflow: hidden;
          background: #111;
          aspect-ratio: 3 / 4.6;
          box-shadow: 0 18px 40px rgba(7, 7, 78, 0.12);
        }
        .lp-fh__video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .lp-fh__badge {
          position: absolute;
          top: 12px;
          left: 12px;
          z-index: 2;
          padding: 5px 12px;
          border-radius: 100px;
          background: rgba(255, 255, 255, 0.94);
          color: #15163a;
          font-family: var(--font-body);
          font-size: 0.76rem;
          font-weight: 600;
          letter-spacing: -0.01em;
        }
        .lp-fh__side {
          display: flex;
          flex-direction: column;
          /* Height comes from the features alone. As a grid item this defaults to
             align-self:stretch, so it was being pulled down to the height of the (much
             taller) video cards beside it — the removed "View examples" button used to
             occupy that slack, and without it the card ran on with dead space below the
             last feature. start lets it end where its content ends. */
          align-self: start;
          background: var(--lp-page-bg);
          border: 1px solid rgba(var(--lp-fg), 0.1);
          border-radius: 18px;
          padding: 26px 22px;
          box-shadow: 0 18px 40px rgba(7, 7, 78, 0.08);
        }
        .lp-fh__feature {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px 0;
          border-bottom: 1px solid rgba(var(--lp-fg), 0.1);
        }
        .lp-fh__feature:first-child { padding-top: 0; }
        .lp-fh__feature:last-of-type { border-bottom: none; }
        .lp-fh__feature-icon {
          flex-shrink: 0;
          width: 42px;
          height: 42px;
          border-radius: 12px;
          display: grid;
          place-items: center;
          background: rgba(115, 135, 255, 0.14);
          color: #7387FF;
        }
        .lp-fh__feature p {
          margin: 0;
          font-family: var(--font-body);
          font-size: 1.05rem;
          line-height: 1.5;
          color: var(--lp-text);
          /* .lp-achieve (the section ancestor) sets text-align:center for its own heading —
             that inherits straight down through nothing-else-overriding-it and left this
             centered next to a left-aligned icon, an odd mismatch. Left-align it back. */
          text-align: left;
        }
        @media (max-width: 1100px) {
          .lp-fh { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          .lp-fh__side { grid-column: 1 / -1; flex-direction: row; flex-wrap: wrap; gap: 20px 32px; }
          .lp-fh__feature { flex: 1 1 240px; border-bottom: none; padding: 0; }
        }
        @media (max-width: 720px) {
          /* Phone layout is NOT a narrowed grid — it's two stacked blocks: one auto-
             scrolling row of videos, then the full-width features card underneath.
             (It was a 2x2 grid: [video 1 | video 2] / [video 3 | features]. That put the
             copy in a ~170px column where every point wrapped to 3-4 lines, and the videos
             were too small to read.)
             .lp-fh becomes the marquee's clipping viewport — the track inside is
             width:max-content and simply overflows it. */
          .lp-fh {
            display: flex;
            flex-direction: column;
            gap: 18px;
            overflow: hidden;
          }
          /* display:contents on the base rule made the cards direct grid items; here the
             wrapper has to be a real box again, because it IS the moving track. */
          .lp-fh__videos {
            display: flex;
            flex-direction: row;
            width: max-content;
            gap: 12px;
            animation: fhMarquee 30s linear infinite;
            will-change: transform;
            backface-visibility: hidden;
          }
          /* The second half of the loop, hidden everywhere else. */
          .lp-fh__card--dup { display: flex; }
          /* Fixed width, so the track's total width is stable and the -50% loop lines up.
             ~66vw shows one card plus the edge of the next, which is what reads as "this
             row is moving" rather than a static hero clip. */
          .lp-fh__card { flex: 0 0 66vw; max-width: 280px; }
          /* Undoes the ≤1100px rules, which are still in force here (that block is a wider
             max-width, so it also matches at ≤720px). There, the card spanned the full grid
             row and laid its features out sideways; stacked it goes back to the base
             vertical list with its dividers, so each of those declarations needs an
             explicit counterpart. */
          .lp-fh__side {
            grid-column: auto;
            flex-direction: column;
            gap: 0;
            padding: 18px 16px;
            border-radius: 14px;
            /* MUST override the base align-self:start. There it meant "don't stretch to
               the height of the video row" because the parent was a grid (block axis).
               Here the parent is a flex COLUMN, so align-self is the horizontal axis —
               start collapsed this card to the width of its icons and squeezed the copy
               out entirely. stretch is what makes it a full-width block under the row. */
            align-self: stretch;
          }
          .lp-fh__feature { flex: 0 1 auto; padding: 12px 0; gap: 9px; border-bottom: 1px solid rgba(var(--lp-fg), 0.1); }
          .lp-fh__feature:first-child { padding-top: 0; }
          .lp-fh__feature:last-of-type { border-bottom: none; }
          /* Sized back up from the 32px/0.82rem the old half-width cell needed — the card
             is full-width now, so the copy has a proper measure to run on. */
          .lp-fh__feature-icon { width: 36px; height: 36px; border-radius: 10px; }
          .lp-fh__feature p { font-size: 0.9rem; line-height: 1.5; }
          /* Card overlays. The badge and meta line are still tuned smaller than desktop —
             a 66vw card is wider than the old grid cell but "Fitness/Supplements" at the
             desktop 0.76rem still crowds it — and flex-wrap lets the meta break instead of
             overflowing. */
          .lp-fh__video-wrap { border-radius: 14px; }
          .lp-fh__badge { top: 8px; left: 8px; padding: 4px 9px; font-size: 0.64rem; }
        }
        /* -50% is exactly one of the two identical halves, so the track lands back on a
           frame indistinguishable from where it started — no visible jump. */
        @keyframes fhMarquee {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        /* Reduced motion: stop the scroll rather than hide the section. Killing the
           animation alone would leave the track frozen inside an overflow:hidden box with
           the later cards permanently unreachable, so the viewport is switched to a real
           swipeable scroller at the same time. */
        @media (prefers-reduced-motion: reduce) {
          .lp-fh__videos { animation: none !important; }
          .lp-fh { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        }

        /* ── Stacked-card scroll deck (mobile only) ────────────────────────────
           Reuses the SAME .lp-achieve-card design as the desktop fan; only overrides
           the fan's absolute layout into a sticky stack. Each card pins at a staggered
           top (base + index*step), so they peek as a deck and reveal one-by-one. */
        .lp-achieve__stack {
          --stk-top: 96px;    /* where the first card pins (clears the fixed navbar) */
          --stk-step: 22px;   /* extra offset per card → the visible "peek" of each */
          max-width: 380px;
          margin: 40px auto 0;
          /* Minimal tail — no exit runway needed (the heading-lift now rides the 'end start'
             scroll range, so it doesn't depend on padding). Avoids a dead empty band below the
             stacked deck. */
          padding: 0 0 28px;
          display: none;      /* desktop keeps the fan; the deck is mobile-only */
          flex-direction: column;
          gap: 22px;
        }
        .lp-achieve__stack .lp-achieve-stackcard {
          position: static;
          top: auto;
          left: auto;
          width: 100%;
          height: auto;
          min-height: auto;
          margin-left: 0;
          transform: none;
          /* Lighter surface + a clear top edge & shadow so each card reads distinctly. */
          background: #23232c;
          border: 1px solid rgba(255, 255, 255, 0.16);
          box-shadow: 0 -6px 22px rgba(0, 0, 0, 0.55);
        }
        .lp-root[data-theme="light"] .lp-achieve__stack .lp-achieve-stackcard {
          background: #ffffff;
          border-color: rgba(0, 0, 0, 0.1);
          box-shadow: 0 -6px 22px rgba(0, 0, 0, 0.14);
        }
        /* Mobile: hide the desktop fan, show the stacked deck.
           !important on the fan: its own max-width:900px block (later in this stylesheet)
           re-sets display:flex, which would otherwise win over this and show BOTH stacks. */
        @media (max-width: 768px) {
          .lp-achieve__fan { display: none !important; }
          .lp-achieve__stack { display: flex; --stk-top: 226px; --stk-step: 52px; margin-top: 56px; }
          /* The lift here is a STATIC margin, NOT a transform: a transform would break the sticky
             heading + sticky card stack inside (they'd detach and overlap), so transform:none
             guarantees none survives. Its own value (not the desktop clamp) because the phone
             deck reserves a taller box — clamp(360px, 54vh, 460px) — and .lp-achieve carries a
             132px top pad here. */
          .lp-achieve-rise { transform: none; margin-top: clamp(-560px, -56vh, -380px); }
          /* Heading is STATIC so it rises WITH the section as one unit (a sticky child would break
             under the transformed ancestor and detach from the rise). Opaque bg keeps a peeling
             card hidden behind it instead of splitting it. */
          .lp-achieve { padding-top: 132px; }
          .lp-achieve__title {
            position: static;
            top: auto;
            z-index: auto;
            max-width: 100%;
            margin: 0;
            padding: 14px 0 18px;
            background: transparent;
          }
          /* Card titles on ONE line on mobile: collapse the manual "\n" break (white-space
             normal) and shrink to fit, so e.g. "Discover Creators in Every Niche" sits on a
             single line instead of wrapping. Extra class (.lp-achieve__stack) raises specificity
             so this beats the base .lp-achieve-card__title rule that appears later in the sheet.
             Web fan keeps its two-line \n layout. */
          .lp-achieve__stack .lp-achieve-card .lp-achieve-card__title {
            white-space: normal;
            font-size: clamp(0.85rem, 3.1vw, 1.02rem);
          }
        }
        @media (max-width: 600px) {
          .lp-achieve__stack { --stk-top: 216px; --stk-step: 46px; max-width: 100%; }
          .lp-achieve__stack .lp-achieve-stackcard { min-height: 320px; }
        }

        /* ── Editorial list (replaces the fanned cards) ─────────────────────── */
        /* Billo-style layout: plain columns (no card box), separated by a thin vertical
           divider — icon, then title, then description, stacked. */
        .lp-achieve__cards {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0;
          width: 100%;
          max-width: var(--lp-maxw);
          margin: 110px auto 0;
          margin-left: 0;
          padding: 0 32px;
        }
        .lp-achieve__cards .lp-achieve-card {
          position: relative !important;
          top: auto !important;
          left: auto !important;
          margin-left: 0 !important;
          width: 100% !important;
          height: auto;
          transform: none !important;
          background: transparent;
          border: none;
          box-shadow: none;
          border-radius: 0;
          padding: 0 60px;
          display: flex;
          flex-direction: column;
          gap: 32px;
        }
        .lp-achieve__cards .lp-achieve-card:first-child { padding-left: 0; }
        .lp-achieve__cards .lp-achieve-card:last-child { padding-right: 0; }
        /* .lp-root prefix bumps specificity above the light-theme card border-color
           rule below, which would otherwise win the cascade tie and fade this out. */
        .lp-root .lp-achieve__cards .lp-achieve-card:not(:last-child) {
          border-right: 1px solid rgba(var(--lp-fg), 0.18);
        }
        .lp-achieve__cards .lp-achieve-card__icon {
          width: 68px;
          height: 68px;
          color: rgba(var(--lp-fg), 0.5);
        }
        .lp-achieve__cards .lp-achieve-card__body {
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 18px;
          flex: 1;
        }
        /* No divider line under the title here (unlike the fan/stack card design) — the
           body's own 18px gap gives title-to-desc spacing on its own. */
        .lp-achieve__cards .lp-achieve-card .lp-achieve-card__title {
          font-size: clamp(1.2rem, 1.5vw, 1.45rem);
          margin: 0;
          padding-bottom: 0;
          border-bottom: none;
          line-height: 1.25;
        }
        .lp-achieve__cards .lp-achieve-card .lp-achieve-card__desc {
          font-size: 0.98rem;
          line-height: 1.55;
          margin: 0;
          max-height: 7.5em;
          overflow: hidden;
        }
        @media (max-width: var(--lp-maxw)) {
          .lp-achieve__cards { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        }
        @media (max-width: 1280px) {
          .lp-achieve__cards { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 900px) {
          .lp-achieve__cards { grid-template-columns: 1fr; }
        }

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
          box-shadow: 0 20px 44px rgba(0, 0, 0, 0.5);
          transform-origin: center bottom;
          transition: transform 0.55s cubic-bezier(.16,1,.3,1), box-shadow 0.4s ease;
          cursor: pointer;
          /* Promote each card to its own GPU layer so scrolling composites a cached
             bitmap instead of repainting the big blur shadow every frame. */
          will-change: transform;
          backface-visibility: hidden;
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
          color: rgba(var(--lp-fg), 0.6);
          transition: color 0.4s ease;
        }
        .lp-achieve-card__body {
          padding: 6px 30px 32px;
          text-align: left;
        }
        .lp-achieve-card .lp-achieve-card__title {
          font-family: var(--font-head);
          /* Sized so the longest titles ("Identity Protected,", "Discover Creators")
             fit on ONE line inside the 332px fan card, keeping cards 1 & 3 to two lines. */
          font-size: clamp(1.3rem, 1.7vw, 1.5rem);
          font-weight: var(--fw-head);
          color: var(--lp-text);
          margin: 0 0 18px;
          padding-bottom: 18px;
          letter-spacing: -0.01em;
          /* Honour the manual "\n" break point in select titles (e.g. cards 1 & 3),
             while still allowing normal wrapping elsewhere. */
          white-space: pre-line;
          /* Divider line between the headline and the body copy. */
          border-bottom: 1px solid rgba(var(--lp-fg), 0.14);
          transition: color 0.4s ease, border-color 0.4s ease;
        }
        .lp-achieve-card__desc {
          font-family: var(--font-body);
          font-size: 1.02rem;
          line-height: 1.55;
          color: rgba(var(--lp-fg), 0.62);
          margin: 0;
        }
        /* Active card — purple icon + title (no band, no zoom), stronger shadow. */
        .lp-achieve-card.is-active {
          box-shadow: 0 32px 70px rgba(0, 0, 0, 0.6);
        }
        .lp-achieve-card.is-active .lp-achieve-card__icon { color: #7387FF; }
        .lp-achieve-card.is-active .lp-achieve-card__num { color: #7387FF; }
        .lp-achieve-card.is-active .lp-achieve-card__title { color: #7387FF; }
        .lp-achieve-card.is-active .lp-achieve-card__title { border-bottom-color: rgba(115, 135, 255, 0.4); }

        /* Light theme surfaces. */
        .lp-root[data-theme="light"] .lp-achieve-card {
          background: #fbf8f0;
          border-color: rgba(0, 0, 0, 0.1);
          box-shadow: none;
        }
        .lp-root[data-theme="light"] .lp-achieve-card.is-active {
          box-shadow: none;
        }
        /* The editorial grid variant has no card surface at all (see .lp-achieve__cards
           .lp-achieve-card above) — override the light-theme card background back off for
           it specifically, without touching the fan/stack card, which still wants the
           cream surface. Deliberately does NOT touch border-color: that would also wipe
           out the border-right column divider set above. */
        .lp-root[data-theme="light"] .lp-achieve__cards .lp-achieve-card {
          background: transparent;
        }

        /* Mobile: drop the fan, stack the cards vertically (neutralise inline transforms).
           Scoped to .lp-achieve__fan so it never touches the mobile sticky deck, which
           reuses .lp-achieve-card but needs position:sticky. */
        @media (max-width: 900px) {
          /* Match the audit heading ("Answer This Honestly.") exactly — same --fs-h1 token. */
          .lp-achieve__title { font-size: var(--lp-fs-h2); white-space: normal; }
          .lp-achieve__fan {
            height: auto;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 20px;
            margin-top: 40px;
          }
          .lp-achieve__fan .lp-achieve-card {
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
          .lp-achieve__fan .lp-achieve-card__top { height: 120px; }
        }

        /* ── US vs Others — two-column comparison ─────────────────────────── */
        /* ── UGCad.io vs Traditional — editorial comparison table ── */
        .lpv { padding: calc(var(--lp-space-section) * 0.833) 4% calc(var(--lp-space-section) * 0.917); background: #fefcf9; color: #1c1b4b; }
        .lpv-inner { max-width: var(--lp-maxw); margin: 0 auto; }
        /* Kicker + heading sit ABOVE the header's upward mask (z 6 > header z 5) so the mask
           only ever swallows scrolling ROWS, never the section's own title on entrance. */
        .lpv-kicker { margin: 0; text-align: center; color: rgba(28,27,75,0.55); font-weight: 600; font-size: 14px; position: relative; z-index: 6; }
        .lpv-heading { margin: 14px 0 56px; text-align: center; font-family: var(--font-head);
          font-weight: 500; font-size: var(--lp-fs-h1); line-height: 1.08; color: #1c1b4b; letter-spacing: -0.5px;
          position: relative; z-index: 6; }
        /* "US" carries the accent — the whole point of the line is the contrast with the
           two "Others" columns underneath it. */
        .lpv-heading em { font-style: normal; color: var(--lp-purple-700); }
        .lpv-grid {
          display: flex;
          flex-direction: column;
          /* Frame + dividers in Velvet Mist (the palette's accent) instead of a flat
             navy tint — ties the table's structure into the brand palette. */
          border: 1px solid rgba(159, 159, 209, 0.4);
          border-radius: 24px;
          box-shadow: 0 4px 28px rgba(159, 159, 209, 0.18);
          /* Was 0 28px. The gutter moved onto the first and last CELLS instead, because the
             row stripes below have to reach the card's edges — with padding on the grid the
             stripes stopped 28px short and read as floating bands rather than table rows. */
          padding: 0;
        }
        /* Column dividers removed. Vertical hairlines between every column plus a hairline
           under every row made the table read as a spreadsheet; the structure now comes
           from row striping and the highlighted column alone, which is what separates the
           columns visually without drawing a line for it. */
        .lpv-header, .lpv-rowgroup { display: grid; grid-template-columns: 1.3fr 1fr 1fr 1fr; align-items: center; }
        /* Mobile-only pieces of the table (row icons, the label repeated inside the "us"
           cell, the VS badge, the 2-column header) — see the ≤1024px block for what they
           become. display:none (not visibility) matters for .lpv-vs and .lpv-mhead: they
           are children of a grid, and only display:none stops them claiming a cell in the
           desktop 4-column track. */
        .lpv-ico, .lpv-mlabel, .lpv-vs, .lpv-mhead { display: none; }
        /* Sticky header: the UGCad.io / Traditional column titles stay pinned just below
           the floating navbar while the comparison rows scroll underneath. The opaque
           section background keeps rows from showing through the transparent columns.
           min-height keeps the header's real box taller than the tallest two-line row
           (~120px) — otherwise, as a row scrolled past, its title poked out above/below
           the header's own shorter box for a few px each frame (a torn "ghost text"
           glitch). This has to be a real layout height (not a box-shadow paint trick):
           a shadow spread stays fixed to the header's box at ALL times, including while
           it's still in normal flow (not yet stuck) — which bled into row 1's title even
           before any scrolling happened. Growing the box itself only ever pushes content
           below it, so it's correct both stuck and unstuck. */
        /* A solid-color header can never fully hide every row: rows vary in height (one vs.
           two-line descriptions), so at some scroll position a row's title WILL straddle the
           header's bottom edge no matter how tall the header is — that's inherent to sticky
           positioning over continuously-scrolling variable-height content, not fixable by
           sizing alone. A hard edge there reads as torn/corrupted text. Fading the header's
           own bottom into transparent turns that same crossing into a soft dissolve instead —
           content emerges from behind the bar rather than getting sliced by it. */
        /* The pinned offset FOLLOWS THE NAVBAR, because the two compete for the same strip
           of screen and neither can win at a fixed value:
             • a constant 88px (clearing the navbar) leaves 88px of bare table interior above
               the titles whenever the navbar is hidden — the empty band;
             • a constant 0 removes that band, but the navbar then lands right on top of the
               titles the moment you scroll back up.
           .lp-nav-hidden is set on .lp-root from the same navHidden state that hides the
           navbar, so the header steps down to clear it and back up when it leaves, and the
           two are never on the same pixels. The transition duration matches the navbar's own
           slide so they move together rather than one lagging behind the other. */
        .lpv-header {
          align-items: stretch;
          position: sticky;
          top: 88px;                /* navbar on screen — sit below it */
          transition: top 0.3s ease;
          z-index: 5;
          background: #fefcf9;
          min-height: 90px;
        }
        /* Navbar gone (scroll-down — the direction this table is actually read in): pin
           flush to the viewport edge so there is no dead band above the titles. */
        .lp-nav-hidden .lpv-header { top: 0; }
        /* Opaque mask ABOVE the pinned header. The navbar hides on scroll-down, leaving an
           ~88px band above the header (top:88px) uncovered — rows scrolling up used to poke
           out INTO that band above the UGCad.io/Traditional titles. This band paints the same
           white as the section, so it seamlessly hides any row text the moment it rises above
           the header; the text simply disappears off the top edge while still masked.
           HEIGHT MUST BE >= the header's own top offset (88px) above. The mask hangs off the
           header's top edge (bottom:100%), so when the header is pinned at y=88 a mask of
           height H only covers y=(88-H)..88. At the previous 44px that left y=0..44 wide
           open, and rows scrolling up were visible in it — the stray text appearing above
           the UGCad.io / Traditional Agencies titles. 96px covers the full band with a
           little slack (the excess simply sits above the viewport, costing nothing).
           Safe to over-size: .lpv-heading carries z-index 6 vs this stacking context's 5,
           so the mask always paints BEHIND the heading and can never hide it at rest. */
        .lpv-header::before {
          content: '';
          position: absolute;
          /* Overhangs the header sideways by the grid's own padding (28px) + its 1px frame
             border, so it also swallows the two short vertical segments of .lpv-grid's
             rounded frame that used to poke up past the pinned header into the navbar strip
             — the stray lines at the top corners. Cream-on-cream everywhere else, so the
             overhang costs nothing visually. */
          left: -30px; right: -30px; bottom: 100%;
          height: 96px;
          background: #fefcf9;
          pointer-events: none;
        }
        /* Closes the table off ABOVE the pinned titles. Once rows have scrolled up behind the
           header, the mask leaves plain cream above it and the table reads as open at the top;
           this draws the same divider the rows use, sitting exactly on the header's top edge.
           Its own element rather than a border on the mask, because the mask now overhangs
           sideways to eat the frame — a border there would run 60px wider than the table.
           Painted at bottom:100% (not border-top on .lpv-header) so it can't add to the
           header's own box height, which min-height above depends on staying exact. */
        .lpv-header::after {
          content: '';
          position: absolute;
          left: 0; right: 0; bottom: 100%;
          height: 1px;
          /* Transparent while the navbar is on screen: it returns to exactly this strip on
             scroll-up, so the divider read as a stray hairline running under the nav pill.
             The navbar is the table's top boundary in that state; the line only earns its
             place once the header is pinned flush to the viewport edge on its own. */
          background: transparent;
          transition: background-color 0.3s ease;
          pointer-events: none;
        }
        .lp-nav-hidden .lpv-header::after { background: rgba(159, 159, 209, 0.32); }
        /* The UGCad.io column reads as a single card standing proud of the table: a tint
           plus a continuous 1px side border running from the header down to the last row,
           closed off with a rounded top on the header cell and a rounded bottom on the last
           row's cell. Periwinkle Pulse (rgb(115,135,255) — exactly --lp-purple-700, not an
           approximation) is our stand-in for the reference's green. */
        .lpv-h--us, .lpv-cell--us {
          background: rgba(115, 135, 255, 0.10);
          border-left: 1px solid rgba(115, 135, 255, 0.38);
          border-right: 1px solid rgba(115, 135, 255, 0.38);
        }
        /* The header cell is the top of that card, so it gets the top border and rounding.
           (It was explicitly squared off before, back when the column was a flat tint with
           no outline and a rounded header corner had nothing to close.) */
        .lpv-header .lpv-h--us {
          border-top: 1px solid rgba(115, 135, 255, 0.38);
          border-radius: 16px 16px 0 0;
        }
        .lpv-rowgroup:last-child .lpv-cell--us {
          border-bottom: 1px solid rgba(115, 135, 255, 0.38);
          border-radius: 0 0 16px 16px;
        }
        .lpv-header .lpv-h { padding: 30px 22px; }
        /* Matches .lpv-cell:last-child below, so the last column's header title lines up
           with the values under it now that the gutter lives on the cells. */
        .lpv-header > .lpv-h:last-child { padding-right: 30px; }
        .lpv-h--us { display: flex; align-items: center; justify-content: center; }
        .lpv-brand { font-family: var(--font-head); font-weight: 700; font-size: 30px; letter-spacing: -1px; color: #1c1b4b; }
        .lpv-brand-ad { color: #7387FF; }
        .lpv-h--them { display: flex; align-items: center; justify-content: center; text-align: center; color: rgba(28,27,75,0.55); font-weight: 600; font-size: 15px; }
        /* Zebra striping replaces the per-row top border. ".lpv-grid"'s children are
           [header, row, row, …], so the rows are children 2,3,4… — :nth-child(odd) picks
           3,5,7, i.e. the 2nd, 4th, 6th ROW, which is the alternation the reference uses
           (first row unshaded). The tint is our navy at very low alpha rather than a neutral
           grey, so it sits in the same family as the rest of the section. */
        .lpv-rowgroup { align-items: stretch; }
        .lpv-rowgroup:nth-child(odd) { background: rgba(28, 27, 75, 0.035); }
        /* Stripes now run edge to edge, so the last one would square off the card's bottom
           corners without this. 23px = the grid's 24px radius less its 1px border. */
        .lpv-rowgroup:last-child { border-radius: 0 0 23px 23px; }
        /* align-items: flex-start (not center) matches .lpv-cell's top alignment: the label
           has to clear the sticky header at the same moment as the us/them titles beside it,
           or whichever one is vertically centered lower lingers behind after the others fade. */
        /* Row labels: body font at a calm reading size, not a heading. They were --lp-fs-h3
           in the head font, which made every label compete with the section's own title and
           left the actual comparison values looking like footnotes. The 30px left padding is
           the table's gutter — it lives here now that .lpv-grid has none. */
        .lpv-label { font-family: var(--font-body); font-weight: 500; font-size: 1.02rem; line-height: 1.4; color: #1c1b4b; padding: 30px 24px 30px 30px; display: flex; align-items: flex-start; }
        /* justify-content: flex-start (not center) is load-bearing: when the "us" and "them"
           descriptions wrap to a different number of lines, centering makes their titles land
           at different heights within the row. Since the row scrolls behind the sticky header
           above, whichever title sits lower clears the header a beat after the other — a torn
           "ghost text" leak in just that column. Top-aligning keeps titles at the same Y in
           every row, so both columns clear the header at the same moment. */
        .lpv-cell { padding: 30px 24px; text-align: center; display: flex; flex-direction: column; justify-content: flex-start; gap: 6px; }
        /* The last column carries the table's right-hand gutter, mirroring .lpv-label on
           the left, since .lpv-grid no longer has padding of its own. */
        .lpv-rowgroup > .lpv-cell:last-child { padding-right: 30px; }
        .lpv-cell strong { font-weight: 700; font-size: 16px; color: #1c1b4b; }
        .lpv-cell span { font-size: 14px; line-height: 1.5; color: rgba(28,27,75,0.6); }
        /* Contrast, not just tint, is what makes the comparison land: OUR column stays at
           full navy while the other two step back to a muted grey-navy. Previously both
           sides were nearly the same weight and the highlighted column was doing all the
           work on its own. */
        .lpv-cell--them strong { color: rgba(28,27,75,0.6); font-weight: 600; }
        .lpv-cell--them span { color: rgba(28,27,75,0.45); }
        .lpv-tag { display: none; }
        /* Stacking point raised 760px -> 1080px. Four columns share (min(1320, 92vw) - 56px),
           and each cell has 20px of side padding, so usable text width per comparison cell was
           only 166px at 1024 and 139px at 900. The descriptions wrapped to 4-6 lines and even
           the "Traditional Agencies" header wrapped — rows roughly doubled in height and the
           thing stopped reading as a comparison. It never clipped, so no breakpoint was ever
           added; it was just quietly unusable across that whole band. */
        /* ── Mobile / tablet: side-by-side "us VS them" rows ──────────────────
           The rows used to STACK (label, then a full-width us card, then a full-width
           agencies card). That reads as two separate claims you have to hold in your head,
           not a comparison — the whole point of the section. Below 1024 each row is now a
           single card split into two columns with a VS badge between them, so the contrast
           is left-to-right exactly like the desktop table.
           Both the Marketplaces column and the standalone label column are dropped; the
           label moves INSIDE the left cell (.lpv-mlabel) as that cell's heading. */
        @media (max-width: 1024px) {
          .lpv { padding: 60px 16px 70px; }
          .lpv-heading { margin-bottom: 26px; }
          .lpv-header { display: none; }
          /* The grid stops being a bordered card and becomes a plain stack of row cards,
             which is what gives the reference layout its separated-rows look. */
          .lpv-grid { padding: 0; border: none; box-shadow: none; border-radius: 0; gap: 10px; background: transparent; }

          /* Two-column header sitting above the rows: filled purple tab on the left
             (matching .lpv-cell--us below it), plain label on the right. The middle track
             is the empty VS gutter, kept the same width so the columns line up with the
             rows underneath. */
          .lpv-mhead {
            display: grid;
            /* minmax(0, 1fr), NOT 1fr: a bare 1fr track has an automatic minimum of the
               content's min-content width, so the longest unbreakable line in a cell pushes
               the track — and with it the whole section — wider than the phone. */
            grid-template-columns: minmax(0, 1fr) 34px minmax(0, 1fr);
            align-items: stretch;
            border-radius: 14px 14px 0 0;
            overflow: hidden;
            margin-bottom: -4px;
          }
          .lpv-mhead__us, .lpv-mhead__them {
            display: flex; align-items: center; justify-content: center;
            padding: 12px 8px; font-family: var(--font-head);
            font-size: 14px; font-weight: 700; letter-spacing: -0.2px;
          }
          .lpv-mhead__us { background: #7387FF; color: #fff; border-radius: 12px 12px 0 0; }
          /* The brand's purple "ad.io" half is unreadable on the purple fill. */
          .lpv-mhead__us .lpv-brand-ad { color: #fff; opacity: 0.86; }
          .lpv-mhead__them { grid-column: 3; color: rgba(28,27,75,0.55); font-weight: 600; }

          /* One row = one white card, split us | VS | them. */
          .lpv-rowgroup {
            grid-template-columns: minmax(0, 1fr) 34px minmax(0, 1fr);
            align-items: stretch;
            gap: 0;
            background: #fff;
            border: 1px solid rgba(159, 159, 209, 0.4);
            border-radius: 14px;
            overflow: hidden;
          }
          /* Striping is a DESKTOP device — it separates side-by-side columns across one
             wide row. Here every row is its own card, so the alternating tint would just
             look like half the cards were broken. */
          .lpv-rowgroup:nth-child(odd) { background: #fff; }
          .lpv-rowgroup:last-child { border-radius: 14px; }
          /* The label column is gone; .lpv-mlabel inside the us cell replaces it. */
          .lpv-label { display: none; }
          .lpv-rowgroup .lpv-cell--them:last-child { display: none; }
          .lpv-tag { display: none; }

          .lpv-cell {
            text-align: left; padding: 14px 12px; border-radius: 0;
            gap: 3px; justify-content: flex-start;
            min-width: 0;                 /* let the flex/grid child actually shrink */
            overflow-wrap: break-word;    /* "UGCad.io"-style long tokens break instead of pushing */
          }
          .lpv-rowgroup > .lpv-cell:last-child { padding-right: 12px; }
          /* Left cell stays white like the card; the RIGHT one gets the grey tint, which
             is what makes "ours vs theirs" readable at a glance without a divider line. */
          .lpv-cell--us { background: #fff; border: none; border-radius: 0; }
          /* .lpv-rowgroup:last-child .lpv-cell--us out-specifies the rule above, so without
             this the final row keeps the desktop column's rounded, bordered bottom — which
             shows up as a stray white notch inside the last card. */
          .lpv-rowgroup:last-child .lpv-cell--us { border: none; border-radius: 0; }
          .lpv-cell--them { background: rgba(28, 27, 75, 0.035); }

          /* Row icon: a soft lilac tile on our side, flat grey on theirs. On the right it
             sits at the END of the cell, mirroring the left — the reference pushes the two
             icons out to the card's outer edges. */
          .lpv-ico {
            display: flex; align-items: center; justify-content: center;
            width: 34px; height: 34px; border-radius: 10px; margin-bottom: 7px;
            background: rgba(115, 135, 255, 0.13); color: #5b6ef0;
          }
          .lpv-ico--them { background: rgba(28, 27, 75, 0.06); color: rgba(28,27,75,0.45); align-self: flex-end; }

          /* Row label, now the heading of the left cell. */
          .lpv-mlabel {
            display: block; font-family: var(--font-head); font-weight: 700;
            font-size: 13.5px; line-height: 1.3; color: #1c1b4b; letter-spacing: -0.2px;
          }
          .lpv-cell strong { font-size: 13px; line-height: 1.35; }
          .lpv-cell--us strong { color: #5b6ef0; }
          .lpv-cell span { font-size: 11.5px; line-height: 1.45; }
          /* Their column leads with the title (no label above it), so it needs the same
             weight as our .lpv-mlabel or the two sides sit at different heights. */
          .lpv-cell--them strong { color: rgba(28,27,75,0.75); font-weight: 700; font-size: 13.5px; }

          /* VS badge: centred in the middle track, straddling both cells. */
          .lpv-vs {
            display: flex; align-items: center; justify-content: center;
            align-self: center;
            width: 34px; height: 34px; border-radius: 50%;
            background: #fff; border: 1px solid rgba(115, 135, 255, 0.45);
            color: #5b6ef0; font-size: 9.5px; font-weight: 800; letter-spacing: 0.4px;
          }
        }
        /* Below ~400px the two cells get too narrow for a 34px gutter as well as the copy. */
        @media (max-width: 400px) {
          .lpv-mhead, .lpv-rowgroup { grid-template-columns: minmax(0, 1fr) 26px minmax(0, 1fr); }
          .lpv-vs { width: 26px; height: 26px; font-size: 8.5px; }
          .lpv-cell { padding: 12px 9px; }
          .lpv-ico { width: 30px; height: 30px; border-radius: 9px; }
        }
        .lp-vs {
          padding: calc(var(--lp-space-section) * 0.75) 4% calc(var(--lp-space-section) * 0.833);
          color: var(--lp-text);
        }
        .lp-vs__inner {
          max-width: var(--lp-maxw);
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
          grid-template-columns: 0.82fr 1.08fr 1fr;
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
          font-family: var(--font-body);
          font-size: 0.96rem;
          font-weight: 500;
          letter-spacing: 0.01em;
          color: rgba(var(--lp-fg), 0.6);
        }
        .lp-vs__cell--them {
          padding-left: 30px;
          padding-right: 24px;
        }
        /* Axis divider: a HORIZONTAL rule under the header that runs all the way
           across, including through the highlighted UGCad.io panel. */
        .lp-vs__row--head .lp-vs__cell--label,
        .lp-vs__row--head .lp-vs__cell--them {
          border-bottom: 1px solid rgba(var(--lp-fg), 0.12);
        }
        /* the line continues across the panel — a brighter purple so it reads on it */
        .lp-vs__row--head .lp-vs__cell--us {
          border-bottom: 1px solid rgba(115, 135, 255, 0.28);
        }

        /* ── Featured UGCad.io column — brand purple panel down the right side ──
           Flat, uniform fill so consecutive cells blend into ONE seamless panel;
           a per-cell gradient created a visible seam (line) at every row boundary. */
        .lp-vs__cell--us {
          position: relative;
          padding: 18px 28px;
          background: rgba(48, 41, 80, 0.55);
          border-left: 1px solid rgba(115, 135, 255, 0.22);
          border-right: 1px solid rgba(115, 135, 255, 0.22);
        }
        .lp-vs__row--head .lp-vs__cell--us {
          border-top: 1px solid rgba(115, 135, 255, 0.30);
          border-top-left-radius: 22px;
          border-top-right-radius: 22px;
          padding-top: 26px;
        }
        .lp-vs__row:last-child .lp-vs__cell--us {
          border-bottom: 1px solid rgba(115, 135, 255, 0.30);
          border-bottom-left-radius: 22px;
          border-bottom-right-radius: 22px;
          padding-bottom: 26px;
        }
        .lp-vs__brand {
          font-family: var(--font-body);
          font-weight: 800;
          font-size: 1.25rem;
          color: #ffffff;
          letter-spacing: -0.01em;
        }
        .lp-vs__them-label {
          font-family: var(--font-body);
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
          color: #7387FF;
          fill: rgba(115, 135, 255, 0.9);
        }
        /* value text */
        .lp-vs__pill {
          flex: 1;
          min-width: 0;
          font-family: var(--font-body);
          font-size: 0.96rem;
          font-weight: 500;
          line-height: 1.4;
          text-align: left;
        }
        .lp-vs__pill--us { color: #ffffff; }
        .lp-vs__pill--them { color: rgba(var(--lp-fg), 0.55); }

        .lp-vs__heading {
          font-family: var(--font-head);
          font-size: var(--lp-fs-h2);
          font-weight: var(--fw-head);
          letter-spacing: 0.015em;
          word-spacing: 0.18em;
          margin: 0 0 36px;
          text-align: center;
          transform: translateX(-20px);
          color: #ffffff;
        }
        /* VS in brand purple + italic. Selector is specific enough (0,2,1) to beat the
           global ".lp-root span { color }" rule that was overriding it. */
        .lp-vs__heading span.lp-vs__heading-vs {
          color: #7387FF;
          font-style: italic;
        }
        /* ── Comparison: mobile compare table (hidden on desktop) ──────────────
           Below 768px the side-by-side desktop table is replaced by a compact
           fixed two-column table. Desktop table is untouched. */
        .lp-vs__mobile { display: none; }

        /* ── Mobile — fixed two-column compare table (fits screen, no scroll) ─
           table-layout:fixed + percentage cols + wrapping cells means all three
           columns sit inside the viewport; long values wrap to 2+ lines instead
           of overflowing into a horizontal scroll. */
        .lp-vs__scrollwrap {
          position: relative;
          border-radius: 14px;
          border: 1px solid rgba(var(--lp-fg), 0.07);
          overflow: hidden;
        }
        .lp-vs__ctable {
          width: 100%;
          table-layout: fixed;
          border-collapse: collapse;
        }
        .lp-vs__col--feature { width: 27%; }
        .lp-vs__col--ugc { width: 40%; }
        .lp-vs__col--others { width: 33%; }
        .lp-vs__ctable .lp-vs__th,
        .lp-vs__ctable .lp-vs__td {
          font-family: var(--font-body);
          overflow-wrap: break-word;
          word-break: break-word;
          hyphens: auto;
        }
        .lp-vs__th {
          padding: 11px 9px;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          border-bottom: 1px solid rgba(var(--lp-fg), 0.08);
          text-align: left;
          vertical-align: middle;
          line-height: 1.25;
        }
        .lp-vs__th--feature { color: rgba(var(--lp-fg), 0.6); }
        .lp-vs__th--ugc {
          color: #7387FF;
          background: rgba(115, 135, 255, 0.1);
        }
        .lp-vs__th--ugc svg { vertical-align: -1px; margin-right: 2px; }
        .lp-vs__th--others { color: rgba(var(--lp-fg), 0.25); }
        .lp-vs__td {
          padding: 10px 9px;
          font-size: 11.5px;
          border-bottom: 1px solid rgba(var(--lp-fg), 0.05);
          vertical-align: top;
          line-height: 1.4;
        }
        .lp-vs__td--feature {
          color: rgba(var(--lp-fg), 0.45);
          font-weight: 500;
          font-size: 11px;
        }
        .lp-vs__td--ugc {
          color: rgba(var(--lp-fg), 0.85);
          background: rgba(115, 135, 255, 0.05);
        }
        .lp-vs__td--others { color: rgba(var(--lp-fg), 0.28); }
        .lp-vs__ctable tr:last-child .lp-vs__td { border-bottom: none; }

        @media (max-width: 767px) {
          .lp-vs { padding: 60px 5% 70px; }
          .lp-vs__heading { transform: none; }
          .lp-vs__table { display: none; }
          .lp-vs__mobile { display: block; }
          /* The global ".lp-root td/th { color: var(--lp-text) }" rule (0,1,1) beats the
             single-class colours above, so re-apply them at higher specificity here. */
          .lp-vs__mobile .lp-vs__th--feature { color: rgba(var(--lp-fg), 0.8); }
          .lp-vs__mobile .lp-vs__th--ugc { color: #7387FF; }
          .lp-vs__mobile .lp-vs__th--others { color: rgba(var(--lp-fg), 0.6); }
          .lp-vs__mobile .lp-vs__td--feature { color: rgba(var(--lp-fg), 0.72); }
          .lp-vs__mobile .lp-vs__td--ugc { color: rgba(var(--lp-fg), 0.85); }
          .lp-vs__mobile .lp-vs__td--others { color: rgba(var(--lp-fg), 0.62); }
        }

        /* ── Comparison Table ─────────────────────────────────────────────── */
        .lp-compare {
          padding: calc(var(--lp-space-section) * 0.833) 4% calc(var(--lp-space-section) * 0.833);
          background: transparent;
          color: var(--lp-text);
        }
        .lp-compare__inner {
          max-width: var(--lp-maxw);
          margin: 0 auto;
          text-align: center;
        }
        .lp-compare__heading {
          font-family: var(--font-head);
          font-size: var(--lp-fs-h2);
          font-weight: var(--fw-head);
          color: var(--lp-ink);
          line-height: 1.2;
          letter-spacing: -0.04em;
          margin: 0 0 60px 0;
          max-width: 900px;
          margin-left: auto;
          margin-right: auto;
        }
        .lp-root .lp-compare__heading--accent {
          color: #7387FF;
          background: none;
          -webkit-text-fill-color: #7387FF;
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
          font-family: var(--font-body);
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
          font-family: var(--font-body);
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
          padding: calc(var(--lp-space-section) * 0.5) 4% var(--lp-space-section);
          background: transparent;
          color: var(--lp-text);
          position: relative;
        }
        .lp-features__inner {
          max-width: var(--lp-maxw);
          margin: 0 auto;
          text-align: center;
        }

        .lp-eyebrow {
          display: inline-flex;
          align-items: center;
          font-family: var(--font-body);
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
          font-family: var(--font-head);
          font-size: var(--lp-fs-h2);
          font-weight: var(--fw-head);
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
          border-color: rgba(115,135,255,0.55);
          box-shadow: 0 18px 44px rgba(115,135,255,0.16);
        }
        .lp-root[data-theme="light"] .lp-card__num { color: rgba(28,27,75,0.22); }

        .lp-card__num {
          position: absolute;
          top: 20px;
          right: 22px;
          font-family: var(--font-body);
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
          font-family: var(--font-head);
          font-size: var(--fs-h3);
          font-weight: var(--fw-head);
          color: var(--lp-ink);
          margin-bottom: 10px;
        }

        .lp-card__body {
          font-family: var(--font-body);
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
        .lp-root .lp-cta {
          position: relative;
          padding: calc(var(--lp-space-section) * 0.583) 4% calc(var(--lp-space-section) * 0.833);
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
          font-family: var(--font-body);
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
          background: rgba(115, 135, 255, 0.15);
          box-shadow: 0 0 0 0 rgba(7, 7, 78, 0.55);
          animation: hookPulse 1.8s ease-out infinite;
          flex-shrink: 0;
        }

        .lp-root .lp-cta__heading {
          font-family: var(--font-head);
          font-size: var(--lp-fs-h2);
          font-weight: var(--fw-head);
          color: var(--lp-ink);
          margin: 0 0 18px 0;
          line-height: 1.05;
          letter-spacing: -0.05em;
        }
        .lp-root .lp-cta__heading--strike {
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
          background: rgba(115, 135, 255, 0.15);
          transform: rotate(-3deg);
          border-radius: 4px;
        }
        .lp-root .lp-cta__heading--accent {
          color: #7387FF;
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

        .lp-root .lp-cta__subtext {
          font-family: var(--font-body);
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
          font-family: var(--font-head);
          font-size: 2.2rem;
          font-weight: var(--fw-head);
          color: #7387FF;
          line-height: 1;
        }
        .lp-stat__label {
          font-family: var(--font-body);
          color: var(--lp-text-muted);
          font-size: 0.78rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .lp-root .lp-cta__subtext {
          font-family: var(--font-body);
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

        .lp-root .lp-btn-join {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          padding: 16px 38px;
          border-radius: 100px;
          background: var(--lp-ink);
          color: white;
          font-family: var(--font-body);
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
          background: rgba(115, 135, 255, 0.15);
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
          font-family: var(--font-body);
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
          border-color: #7387FF;
          color: #7387FF;
        }

        .lp-root .lp-cta__proof {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-body);
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
          font-family: var(--font-head);
          font-size: 1.4rem;
          font-weight: var(--fw-head);
          color: #07074e;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .lp-root .lp-cta__signal-label {
          font-family: var(--font-body);
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
          .lp-root .lp-cta { padding: 90px 5%; }
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
          /* Hug the content (was min-height:100vh) so there's no empty gap below the hero —
             the leaderboard section sits right beneath the title and rises with it on scroll. */
          min-height: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          /* Top-align (was center) so the tall stacked title can't push the pill up under
             the navbar; content starts below the navbar and flows down. */
          justify-content: flex-start;
          gap: 30px;
          /* Top padding clears the fixed navbar; the showcase marquee row then sits in the
             space above the title (previously empty). */
          padding: calc(var(--lp-space-section) * 0.833) 4% calc(var(--lp-space-section) * 0.4);
          /* subtle radial purple glow behind the hero copy */
          background: radial-gradient(circle at 50% 36%, rgba(115, 135, 255, 0.16),
                      rgba(115, 135, 255, 0) 60%), var(--lp-page-bg);
        }
        .lp-hero--static .lp-hero__inner {
          min-height: 0;
          align-items: center;
          text-align: center;
          max-width: 640px;
        }
        .lp-hero--static .lp-hero__subtitle { margin-left: auto; margin-right: auto; text-align: center; text-transform: uppercase; }
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
          .lp-hero__title { max-width: 100%; font-size: clamp(2.4rem, 8vw, 3.6rem); }
          /* Each sentence on ONE line (mobile only): nowrap + sized to fit the longest line. */
          .lp-hero__subtitle { font-size: clamp(0.72rem, 3.3vw, 0.95rem); line-height: 1.5; white-space: nowrap; }
          .lp-brand-item__icon { height: 65px; min-width: 46px; }
          /* height comes from the base rule (100% * --logo-s, the per-logo optical
             scale). Re-declaring height:100% here silently cancelled that scale —
             equal specificity, later in the sheet — so every mark rendered at the
             full box height again and the strip looked unsized at these widths. */
          .lp-brand-item__icon img { width: auto; }
          .lp-hero__brand-center { width: 104px; height: 104px; }
          .lp-hero__brand-center img { width: 78px; height: 78px; }
          /* Brand strip, mobile treatment — a different layout from desktop, not a
             squeezed version of it. Desktop is label-left / logos-right; at this width
             that leaves the track a sliver, so the label becomes a centred caption with
             the logo row full-bleed underneath. Desktop rules above are untouched. */
          .lp-brandstrip { padding: 44px 0 36px; }
          .lp-brandstrip .lp-hero__strip {
            flex-direction: column;
            align-items: center;
            gap: 26px;
            /* No side padding here — the logo row runs edge to edge. The label carries
               its own gutter instead (below). */
            padding: 0;
          }
          /* Swap which of the two labels is live (see the JSX): the stacked "TRUSTED BY
             LEADING / brands" off, the one-line sentence on. */
          .lp-brandstrip__label--web { display: none; }
          .lp-brandstrip__label--mob { display: block; }
          /* Sentence case rather than the desktop uppercase/letterspaced treatment — it
             reads as a spoken caption over the row, with the accent phrase carrying the
             emphasis. */
          .lp-brandstrip .lp-brandstrip__label--mob {
            font-size: 1.02rem;
            font-weight: 500;
            letter-spacing: -0.1px;
            text-transform: none;
            color: var(--lp-text);
            text-align: center;
            padding: 0 6%;
          }
          .lp-brandstrip .lp-brandstrip__label--mob .lp-brandstrip__label--accent { font-weight: 800; }
          /* Full-bleed logo row. flex:none because the parent stacks vertically here — a
             flex-grow of 1 would stretch this in HEIGHT; align-self:stretch + width:100%
             beat the base rule's shrink-to-fit width:auto under align-items:center. */
          .lp-brandstrip .lp-brands__viewport {
            flex: none;
            align-self: stretch;
            width: 100%;
            max-width: none;
          }
          .lp-navbar__inner { height: 48px; padding: 0 5%; gap: 16px; }
          .lp-navbar__links { display: none; }
          .lp-nav-join { display: none; }
          .lp-navbar__actions { display: none; }
          /* grid-column:3 is what actually pins it to the right corner, and it is not
             optional. .lp-navbar__inner is grid-template-columns: 1fr auto 1fr, and the
             two rules directly above set .lp-navbar__links and .lp-navbar__actions to
             display:none — which removes them as grid ITEMS, not just visually. That left
             only the brand and the burger to auto-place, so the burger landed in track 2,
             the centre auto track: the hamburger floating in the middle of the bar.
             Its base margin-left:auto couldn't help, because that track is only as wide
             as the button itself, so there is no free space for the auto margin to eat.
             Naming the track explicitly (the template still declares all three, whether or
             not anything occupies them) plus justify-self:end puts it at the true edge.
             margin-right is zeroed to match .lp-navbar__logo's margin-left:0 below, so the
             logo and the burger sit on the same 5% gutter instead of the burger hanging
             14px past it. */
          .lp-navbar__burger { display: inline-flex; grid-column: 3; justify-self: end; margin-right: 0; }
          .lp-navbar__mobile--open { display: flex; }
          .lp-navbar__logo { height: 34px; margin-left: 0; }
          /* Needs .lp-root to win: the base rules are .lp-root .lp-btn-login / .lp-btn-signup
             (specificity 0,2,0). A bare .lp-btn-login here is 0,1,0 and LOSES — media queries
             add no specificity — so this rule silently did nothing at all before. */
          .lp-root .lp-btn-login, .lp-root .lp-btn-signup { padding: 12px 14px; font-size: 0.9rem; }
          .lp-hero__ctas { flex-direction: column; align-items: stretch; width: 100%; }
          .lp-hero .lp-btn-primary, .lp-hero .lp-btn-ghost { justify-content: center; }
          .lp-hero__badges { gap: 6px; }
          .lp-proof-badge { font-size: 0.7rem; padding: 5px 10px; }
          /* Shift the "For Creators & Brands" pill up on mobile (negative pulls it higher
             within the vertically-centred hero content). */
          .lp-badge { margin-top: 0; }
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
          .lp-hero__title { font-size: clamp(2rem, 9vw, 2.8rem); }
          .lp-hero__subtitle { font-size: clamp(0.66rem, 3.4vw, 0.85rem); line-height: 1.5; white-space: nowrap; }
          .lp-brand-item__icon { height: 52px; min-width: 36px; }
          /* height comes from the base rule (100% * --logo-s, the per-logo optical
             scale). Re-declaring height:100% here silently cancelled that scale —
             equal specificity, later in the sheet — so every mark rendered at the
             full box height again and the strip looked unsized at these widths. */
          .lp-brand-item__icon img { width: auto; }
          .lp-hero__brand-center { width: 82px; height: 82px; border-radius: 20px; }
          .lp-hero__brand-center img { width: 60px; height: 60px; }
          /* Even smaller on phones, and nudged to the top so it clears the copy. */
          .lp-hero__logo {
            top: 26%;
            width: clamp(92px, 32vw, 130px);
            height: clamp(92px, 32vw, 130px);
            margin-top: calc(clamp(92px, 32vw, 130px) * -0.5);
          }
        }

        /* scroll-cue dots at the bottom of the hero (mobile) */
        .lp-hero__scrollcue {
          position: absolute;
          bottom: 16px;
          left: 50%;
          transform: translateX(-50%);
          display: none;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          z-index: 4;
          pointer-events: none;
        }
        .lp-hero__scrollcue span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(var(--lp-fg), 0.5);
          animation: lpScrollCue 1.4s ease-in-out infinite;
        }
        .lp-hero__scrollcue span:nth-child(2) { animation-delay: 0.18s; }
        .lp-hero__scrollcue span:nth-child(3) { animation-delay: 0.36s; }
        @keyframes lpScrollCue {
          0%, 100% { opacity: 0.25; transform: translateY(0); }
          50%      { opacity: 1;    transform: translateY(3px); }
        }

        /* ── Hero mobile polish — spacing, type & tap targets ──────────────── */
        @media (max-width: 768px) {
          .lp-hero__scrollcue { display: flex; }
          /* 22px side padding (thumb-reach zone) */
          .lp-hero--static .lp-hero__sticky { padding-left: 22px; padding-right: 22px; }
          /* badge↔headline (and even rhythm between copy blocks) = 22px */
          .lp-hero--static .lp-hero__inner { gap: 22px; }
          /* subtext↔buttons = 22 + 10 = 32px */
          .lp-hero--static .lp-hero__ctas { margin-top: 10px; }
          /* headline: 38px, tighter tracking. Generous line-height so the purple
             highlight blocks get clear vertical space between wrapped lines
             (instead of touching / overlapping). */
          .lp-hero__title {
            font-size: 38px;
            line-height: 1.5;
            letter-spacing: -0.02em;
          }
          /* taller, easier-to-tap buttons (54px) */
          .lp-hero .lp-btn-primary,
          .lp-hero .lp-btn-ghost {
            min-height: 54px;
            padding-top: 0;
            padding-bottom: 0;
          }
          /* stats: one clean wrapping row, centred (no awkward 2-row split) */
          .lp-hero__badges {
            flex-wrap: wrap;
            gap: 8px;
            justify-content: center;
          }
          .lp-proof-badge { font-size: 0.72rem; padding: 7px 12px; }
        }

        /* very small phones — keep the 38px headline from overflowing */
        @media (max-width: 360px) {
          .lp-hero__title { font-size: 32px; }
        }

        /* ── Whole-page mobile polish ─────────────────────────────────────── */
        @media (max-width: 600px) {
          /* Tighter horizontal gutters + trimmed vertical padding on phones */
          .lp-hook { padding: 72px 6% 60px; }
          .lp-steps { padding: 56px 6%; }
          /* 140px -> 60px, and 4% -> 6%. The 140px was clearance for the brand strip being
             pulled up over this section via brandRise — that pull-up was removed (see the JSX
             comment on .lp-brandstrip), so it had become ~84px of dead space above
             "We create the best UGC…" on every phone. The 4% was also the odd one out: every
             neighbouring section uses 6% here, so content edges visibly jogged in and out by
             ~7px as you scrolled past this one. */
          .lp-showcase { padding: 60px 6% 56px; }
          /* Same 4% -> 6% alignment as .lp-showcase above: its only other mobile rule sets
             padding-top and leaves the horizontal at the desktop 4%. */
          .lp-achieve { padding-left: 6%; padding-right: 6%; }
          .lp-compare { padding: 48px 5%; }
          .lp-features { padding: 56px 6% 72px; }
          .lp-proof { padding: 64px 6%; }
          .lp-testimonial { padding: 56px 6%; }
          .lp-root .lp-cta { padding: 56px 6% 72px; }
          /* Keep big display headings from overflowing very small screens */
          .lp-section-heading,
          .lp-steps__heading,
          .lp-showcase__heading,
          .lp-compare__heading,
          .lp-testimonial__heading,
          .lp-proof__heading { font-size: clamp(1.5rem, 6vw, 2rem); }
        }

        /* Showcase heading on phones: wrap (not the desktop nowrap, which clipped off the edge),
           centred + balanced. Sized to land on exactly TWO lines — the previous larger size spilled
           the long sentence onto three. clamp keeps two lines across phone widths (the min is low
           enough that even ~320px phones don't push to a third line). */
        @media (max-width: 768px) {
          .lp-showcase__heading {
            white-space: normal;
            text-align: center;
            /* Manual <br> controls the split into two lines, so no balance. */
            text-wrap: wrap;
            /* Sized to land on exactly TWO lines via the mobile-only <br>; slightly under
               the audit heading so the longer second line fits without a third wrap. */
            font-size: clamp(1.4rem, 5.6vw, 2.05rem);
            max-width: 100%;
            margin-left: auto;
            margin-right: auto;
          }
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
          .lp-hero__title { font-size: clamp(2.1rem, 4.3vw, 3.5rem); }
          .lp-hero__subtitle { font-size: 1.08rem; margin-bottom: 18px; }
          .lp-hero__logo {
            margin-top: calc(clamp(180px, 22vw, 320px) * -0.5);
            width: clamp(180px, 22vw, 320px);
            height: clamp(180px, 22vw, 320px);
          }
          .lp-hero__strip { padding: 16px 0 28px; }
          .lp-brand-item__icon { height: 65px; min-width: 46px; }
          /* height comes from the base rule (100% * --logo-s, the per-logo optical
             scale). Re-declaring height:100% here silently cancelled that scale —
             equal specificity, later in the sheet — so every mark rendered at the
             full box height again and the strip looked unsized at these widths. */
          .lp-brand-item__icon img { width: auto; }
          .lp-hero__brand-center { width: 108px; height: 108px; }
          .lp-hero__brand-center img { width: 82px; height: 82px; }
        }

        @media (prefers-reduced-motion: reduce) {
          .lp-hero__brands-side .lp-brands__track { animation: none !important; }
        }

        /* ── FAQ ──────────────────────────────────────────────────────────── */
        .lp-faq {
          position: relative;
          padding: calc(var(--lp-space-section) * 0.917) 4% calc(var(--lp-space-section) * 0.75);
          z-index: 2;
        }
        .lp-faq__inner {
          max-width: var(--lp-maxw);
          margin: 0 auto;
        }
        .lp-faq__heading {
          font-family: var(--font-head);
          font-size: var(--lp-fs-h2);
          font-weight: var(--fw-head);
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
          font-family: var(--font-body);
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
          font-family: var(--font-body);
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
        /* Two-column card grid — each card expands independently. The grid only lays
           out the two COLUMNS; the cards themselves stack inside a column, so an open
           card pushes the ones below it in its own column and never stretches a shared
           row (which is what left a gap under the collapsed card opposite it). */
        .lp-faq__grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          align-items: start;
        }
        .lp-faq__col {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .lp-faq__item {
          /* No align-self:start here — as a flex child that would shrink the card to
             its text width instead of filling the column. Height is content-driven
             anyway, which is the whole point. */
          background: rgba(var(--lp-fg), 0.04);
          border: 1px solid rgba(var(--lp-fg), 0.08);
          border-radius: 10px;
          overflow: hidden;
          transition: background 0.2s ease, border-color 0.2s ease;
        }
        .lp-faq__item:hover { background: rgba(var(--lp-fg), 0.06); }
        .lp-faq__item.is-open { border-color: rgba(115, 135, 255, 0.30); }
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
          font-family: var(--font-body);
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
        .lp-faq__item.is-open .lp-faq__chevron { transform: rotate(180deg); color: #7387FF; }
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
          font-family: var(--font-body);
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
          .lp-faq { padding: 70px 5% 10px; }
          .lp-faq__head { flex-direction: column; gap: 20px; margin-bottom: 32px; }
          .lp-faq__grid { grid-template-columns: 1fr; }
          /* One column on mobile: dissolve the two column wrappers so all six cards
             become direct grid children again, and let each card's order (its real
             index) put them back in 0,1,2… reading order — DOM order here is
             0,2,4,1,3,5 because of the even/odd split above. */
          .lp-faq__col { display: contents; }
          /* Desktop's 20px/22px padding was sized for a 2-column grid with real
             horizontal room to spare — stacked full-width on a phone it just reads as
             oversized empty space around short question text. Trimmed to match. */
          .lp-faq__q { padding: 10px 16px; gap: 12px; font-size: 0.88rem; }
          .lp-faq__answer { padding: 0 16px 15px; font-size: 0.86rem; }
        }

        /* ── Footer ─────────────────────────────────────────────────────────── */
        .lp-footer {
          position: relative;
          background: transparent;
          color: var(--lp-ink);
          padding: calc(var(--lp-space-section) * 0.75) 4% calc(var(--lp-space-section) * 0.25);
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
          max-width: var(--lp-maxw);
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
          font-family: var(--font-body);
          font-size: 0.78rem;
          font-weight: 500;
          color: var(--lp-text-muted);
          letter-spacing: 0.16em;
          text-transform: uppercase;
          font-style: italic;
          margin: 0 0 16px 0;
        }
        .lp-footer__statement-line {
          font-family: var(--font-head);
          font-size: var(--fs-h2);
          font-weight: var(--fw-head);
          color: var(--lp-ink);
          line-height: 1.3;
          letter-spacing: -0.03em;
          margin: 0 auto;
          max-width: 820px;
        }
        .lp-root .lp-footer__statement-accent {
          color: #7387FF;
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
          font-family: var(--font-body);
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
        .lp-root .lp-footer__social-btn {
          /* 44px, not 36px — these sit in a row with an 8px gap at the very bottom of a phone
             screen, where mis-taps are most likely. */
          width: 44px;
          height: 44px;
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
          background: rgba(115, 135, 255, 0.15);
          color: var(--lp-text);
          border-color: #7387FF;
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
          font-family: var(--font-body);
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
          font-family: var(--font-body);
          font-size: 0.85rem;
          color: var(--lp-text);
          font-weight: 500;
          margin-top: 4px;
        }
        .lp-footer__required { color: #7387FF; }

        .lp-footer__input {
          padding: 12px 14px;
          border: 1px solid var(--lp-border);
          border-radius: 10px;
          font-family: var(--font-body);
          font-size: 0.92rem;
          background: rgba(var(--lp-fg), 0.06);
          color: var(--lp-text);
          width: 100%;
        }
        .lp-footer__input:focus {
          outline: none;
          border-color: #7387FF;
          box-shadow: 0 0 0 3px rgba(7,7,78,0.12);
        }

        .lp-footer__subscribe {
          margin-top: 12px;
          padding: 14px 22px;
          background: var(--lp-ink);
          color: var(--lp-text);
          border: none;
          border-radius: 100px;
          font-family: var(--font-body);
          font-weight: 600;
          font-size: 0.95rem;
          cursor: pointer;
          transition: all 0.22s ease;
        }
        .lp-footer__subscribe:hover {
          background: rgba(115, 135, 255, 0.15);
          transform: translateY(-1px);
        }

        .lp-footer__privacy {
          font-family: var(--font-body);
          font-size: 0.78rem;
          color: var(--lp-text-muted);
          line-height: 1.5;
          margin: 14px 0 0 0;
          max-width: 340px;
        }
        .lp-root .lp-footer__link-accent {
          color: #7387FF;
          text-decoration: underline;
          font-weight: 500;
        }
        .lp-footer__link-accent:hover { opacity: 0.7; }

        .lp-footer__col { min-width: 0; }

        .lp-footer__heading {
          font-family: var(--font-head);
          font-size: var(--fs-h3);
          font-weight: var(--fw-head);
          color: var(--lp-text);
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
          font-family: var(--font-body);
          font-size: 0.92rem;
          line-height: 1.4;
        }
        .lp-footer__list a {
          color: rgba(var(--lp-fg), 0.5);
          text-decoration: none;
          transition: color 0.18s ease;
          letter-spacing: -0.01em;
          font-weight: 500;
        }
        .lp-footer__list a:hover { color: #7387FF; }

        .lp-footer__badge {
          display: inline-block;
          padding: 2px 10px;
          background: linear-gradient(135deg, #BBBBC8, #8888A0);
          color: #7387FF;
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
          font-family: var(--font-body);
          font-size: 0.9rem;
          font-weight: 500;
          transition: color 0.18s ease;
        }
        .lp-footer__social a:hover { color: #7387FF; }
        .lp-footer__social svg { color: var(--lp-text-muted); }

        .lp-footer__contact {
          font-family: var(--font-body);
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
          font-family: var(--font-body);
          font-size: 0.85rem;
          color: var(--lp-text-muted);
          letter-spacing: -0.01em;
        }
        .lp-footer__location {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-body);
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
          font-family: var(--font-body);
          font-size: 0.82rem;
          font-weight: 500;
          letter-spacing: -0.01em;
          text-decoration: none;
          transition: all 0.22s ease;
        }
        .lp-footer__top-link:hover {
          background: rgba(115, 135, 255, 0.15);
          color: var(--lp-text);
          border-color: #7387FF;
        }

        @media (max-width: 1100px) {
          .lp-footer__top { grid-template-columns: 1fr 1fr 1fr; gap: 32px; }
          .lp-footer__brand-col { grid-column: span 3; }
        }
        @media (max-width: 880px) {
          .lp-footer { padding: 16px 6% 24px; }
          .lp-footer__main { grid-template-columns: 1fr; gap: 40px; }
          .lp-footer__links { grid-template-columns: repeat(3, 1fr); gap: 20px; }
        }
        @media (max-width: 600px) {
          .lp-footer__statement { padding-bottom: 36px; margin-bottom: 36px; }
          .lp-footer__links { grid-template-columns: 1fr 1fr; gap: 24px; }
          .lp-footer__strip { justify-content: center; text-align: center; }
          /* Mobile: all footer columns left-aligned (2-column stacked layout). */
          .lp-footer__col { text-align: left; }
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
          padding: var(--lp-space-section) 4% calc(var(--lp-space-section) * 0.917);
          background: transparent;
          color: var(--lp-text);
          text-align: center;
          overflow: hidden;
        }
        /* .lp-hook itself is unused/removed from this page, so its orb stays hidden.
           .lp-audit__bg-orb / .lp-testimonial__bg-orb are re-enabled below as part of
           bringing the purple ambient-glow look (added to the hero) to the rest of the
           page's plain-white sections. */
        .lp-hook__bg-orb {
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
          max-width: var(--lp-maxw);
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
          font-family: var(--font-body);
          font-size: 0.82rem;
          font-weight: 600;
          color: #7387FF;
          letter-spacing: 0.01em;
          margin-bottom: 26px;
          box-shadow: 0 4px 14px rgba(7, 7, 78, 0.10);
        }
        .lp-hook__pulse {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: rgba(115, 135, 255, 0.15);
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
          font-family: var(--font-head);
          font-size: var(--lp-fs-h2);
          font-weight: var(--fw-head);
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
        .lp-root .lp-hook__heading--accent {
          color: #7387FF;
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
          font-family: var(--font-body);
          font-size: 4rem;
          line-height: 0.6;
          color: var(--lp-purple-300);
          display: block;
          margin-bottom: 4px;
        }
        .lp-hook__quote-text {
          font-family: var(--font-body);
          font-size: 1.15rem;
          color: var(--lp-text);
          line-height: 1.55;
          letter-spacing: -0.015em;
          margin: 0;
        }
        .lp-hook__quote-text em {
          color: #7387FF;
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
        .lp-root[data-theme="light"] .lp-hook__quote-text em { color: #7387FF; }

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
          font-family: var(--font-body);
          font-size: 1.05rem;
          font-weight: 600;
          color: #7387FF;
          margin: 0;
          letter-spacing: -0.02em;
          white-space: nowrap;
        }

        /* ── How It Works (3 Steps) ──────────────────────────────────────── */
        .lp-steps {
          padding: calc(var(--lp-space-section) * 0.833) 4% var(--lp-space-section);
          background: transparent;
          color: var(--lp-text);
          position: relative;
        }
        .lp-steps__inner {
          max-width: var(--lp-maxw);
          margin: 0 auto;
          text-align: center;
        }
        .lp-steps__eyebrow {
          display: inline-block;
          font-family: var(--font-body);
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.18em;
          color: #7387FF;
          text-transform: uppercase;
          padding: 6px 16px;
          background: var(--lp-purple-50);
          border: 1px solid var(--lp-purple-200);
          border-radius: 100px;
          margin-bottom: 20px;
        }
        .lp-steps__heading {
          font-family: var(--font-head);
          font-size: var(--lp-fs-h2);
          font-weight: var(--fw-head);
          color: var(--lp-ink);
          letter-spacing: -0.04em;
          line-height: 1.15;
          margin: 0 0 16px 0;
        }
        .lp-steps__subtitle {
          font-family: var(--font-body);
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
          font-family: var(--font-body);
          font-size: 0.82rem;
          font-weight: 700;
          color: #7387FF;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 5px 12px;
          background: var(--lp-purple-50);
          border-radius: 100px;
        }
        .lp-step-card__tag {
          font-family: var(--font-body);
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
          font-family: var(--font-head);
          font-size: var(--fs-h2);
          font-weight: var(--fw-head);
          color: var(--lp-ink);
          margin: 0 0 12px 0;
          letter-spacing: -0.02em;
          line-height: 1.25;
        }
        .lp-step-card__desc {
          font-family: var(--font-body);
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
          color: #7387FF;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: background 0.3s ease, transform 0.3s ease;
        }
        .lp-step-card:hover .lp-step-card__arrow {
          background: rgba(115, 135, 255, 0.15);
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
        /* Tall pinned runway: the inner block sticks while the three question cards peel
           UP off the top one by one (card1Y/card2Y/card3Y in the JSX). The runway height IS
           the peel duration — shorten it and the cards fly off faster. */
        .lp-audit {
          position: relative;
          /* No BOTTOM padding: once the last card has peeled, everything below the subtitle is
             the deck's own (now empty) reserved box — adding a full section pad under that
             stacked into a screen and a half of dead space before Find & Hire arrived. */
          padding: var(--lp-space-section) 4% 0;
          background: transparent;
          color: var(--lp-text);
          overflow: visible;
          min-height: 220vh;
        }
        /* Soft glow via radial-gradient instead of filter: blur(90px) — a blur filter
           forces the browser to re-rasterize a large layer as this (scroll-heavy)
           section moves; a gradient just paints, so scrolling stays smooth. */
        .lp-audit__bg-orb {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }
        .lp-audit__bg-orb--1 {
          width: 520px; height: 520px;
          background: radial-gradient(circle, rgba(115, 135, 255, 0.16) 0%, transparent 68%);
          top: -190px; right: -190px;
        }
        .lp-audit__bg-orb--2 {
          width: 460px; height: 460px;
          background: radial-gradient(circle, rgba(7, 7, 78, 0.10) 0%, transparent 68%);
          bottom: -170px; left: -150px;
        }
        .lp-audit__inner {
          position: sticky;
          top: 90px;
          z-index: 2;
          max-width: var(--lp-maxw);
          margin: 0 auto;
          text-align: center;
        }

        /* Light-theme eyebrow: white pill on the white page needs a hairline + a soft
           shadow to separate from the background (the old dark-section version relied on a
           translucent light fill over navy, which is invisible here). */
        .lp-audit__pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 16px;
          background: #ffffff;
          border: 1px solid rgba(28, 27, 75, 0.10);
          border-radius: 100px;
          font-family: var(--font-body);
          font-size: 0.82rem;
          font-weight: 600;
          color: var(--lp-ink);
          margin-bottom: 22px;
          box-shadow: 0 4px 14px rgba(28, 27, 75, 0.07);
        }
        .lp-audit__pill svg { color: #7387FF; }

        .lp-audit__heading {
          font-family: var(--font-head);
          font-size: var(--lp-fs-h2);
          font-weight: var(--fw-head);
          color: var(--lp-ink);
          letter-spacing: -0.04em;
          line-height: 1.15;
          margin: 0 0 14px 0;
        }
        .lp-root .lp-audit__heading--accent {
          color: #7387FF;
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
          font-family: var(--font-body);
          color: var(--lp-text-muted);
          font-size: 1.05rem;
          line-height: 1.5;
          letter-spacing: -0.015em;
          margin: 0 auto 36px;
          max-width: 580px;
        }

        /* The deck. All three cards are absolutely positioned on top of each other and fanned
           apart by the per-card x/rotate in the JSX; only y is scroll-driven. */
        .lp-audit__grid {
          position: relative;
          display: flex;
          justify-content: center;
          align-items: center;
          /* Shorter than the viewport so the inner pins cleanly to the section end (no
             early-release blank) and there's no empty space below the centered card.
             Sized (with the trimmed margins above) so the whole fan — including the corners
             of the -20deg/+12deg rotated back cards — clears a ~800px-tall laptop viewport
             once the block pins at top:90. Any taller and the bottom card gets clipped. */
          min-height: 380px;
          margin: 24px auto 0;
          max-width: 600px;
          text-align: left;
          perspective: 1200px;
        }
        .lp-audit-card {
          position: absolute;
          width: 100%;
          max-width: 290px;
          /* The card keeps its periwinkle fill — it's the one saturated block in this section
             and what makes the deck read as a deck. Only the frame/shadow/edge treatment is
             re-tuned for the light page (dark-navy hairline shadow instead of a heavy one
             tuned to sit on navy). */
          background: #7387FF;
          border: 1px solid rgba(255, 255, 255, 0.28);
          border-radius: 22px;
          padding: 36px 30px 26px;
          min-height: 0;
          display: flex;
          flex-direction: column;
          box-shadow: 0 18px 40px rgba(28, 27, 75, 0.22);
          overflow: hidden;
          transform-origin: center center;
          /* Keep each card on its own GPU layer for the whole peel so it composites
             instead of repainting the shadow each scroll frame (and so framer isn't
             promoting/de-promoting it on every spring start/settle). */
          will-change: transform;
          backface-visibility: hidden;
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
          font-family: var(--font-body);
          font-size: 0.78rem;
          font-weight: 700;
          color: #ffffff;
          letter-spacing: 0.1em;
          padding: 5px 12px;
          background: rgba(255, 255, 255, 0.16);
          border: 1px solid rgba(255, 255, 255, 0.55);
          border-radius: 100px;
        }
        .lp-root .lp-audit-card__qmark {
          font-family: var(--font-body);
          font-size: 3rem;
          font-weight: 700;
          color: #07074e;
          line-height: 0.5;
          font-style: italic;
        }

        .lp-audit-card__body {
          position: relative;
          z-index: 1;
          /* Don't grow to fill the card — sit tight under the heading so the divider +
             hint follow immediately (no dead space in the middle). */
          flex: 0 0 auto;
          margin-bottom: 30px;
        }
        .lp-root .lp-audit-card__title {
          font-family: var(--font-head);
          /* Sized so even the longest title (Q2 — "If Your Brand Went Silent for a Week,")
             fits on a SINGLE line within the card, matching Q3. Reads as an eyebrow lead-in
             above the larger punch line (.lp-audit-card__sub). */
          font-size: clamp(0.72rem, 1.4vw, 0.8rem);
          font-weight: var(--fw-head);
          color: #07074e;
          line-height: 1.4;
          letter-spacing: -0.015em;
          margin: 0 0 10px 0;
          white-space: nowrap;
        }
        .lp-root .lp-audit-card__sub {
          font-family: var(--font-body);
          /* Trimmed so the longest sub still fits one line in the narrower card. */
          font-size: 1.2rem;
          font-weight: 600;
          color: #07074e;
          letter-spacing: -0.025em;
          line-height: 1.3;
          margin: 0;
          white-space: nowrap;
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
          font-family: var(--font-body);
          font-size: 0.95rem;
          color: rgba(7, 7, 78, 0.75);
          font-style: italic;
          letter-spacing: 0.02em;
        }

        /* ── Value Proof — "We are zero"-style layout ─────────────────────── */
        /* Follows the site's light/dark toggle, like every other section (transparent
           lets .lp-root's own background show through). */
        .lp-proof {
          padding: var(--lp-space-section) 4% calc(var(--lp-space-section) * 1.167);
          background: transparent;
          color: var(--lp-text);
        }
        .lp-proof__inner {
          max-width: var(--lp-maxw);
          margin: 0 auto;
        }

        /* The panel itself. Painted in the site palette (periwinkle #7387FF wash, navy
           #1c1b4b ink) rather than the mint of the reference shot, and pinned to those
           literals in both themes — same call already made for the dark stat chips and the
           dark pill buttons that sit on light cards elsewhere on this page: it's a fixed
           piece of art, not themed chrome. That is also why each rule carries the .lp-proof
           prefix — the global reset (".lp-root h2, p, span, ... { color: var(--lp-text) }")
           outranks a single class and would repaint this whole panel white if the root ever
           went back to data-theme="dark". */
        .lpz {
          position: relative;
          display: grid;
          /* Two content columns on the top row; the badges now sit on their OWN row
             underneath, spanning the full panel (see .lpz-col--badges). Previously they
             were a third column beside the copy, which squeezed both. */
          grid-template-columns: minmax(0, 1.02fr) minmax(0, 1fr);
          align-items: center;
          gap: clamp(28px, 4.2vw, 76px);
          padding: clamp(38px, 4.4vw, 68px) clamp(30px, 3.6vw, 62px);
          border-radius: clamp(26px, 2.4vw, 42px);
          border: 1px solid rgba(255, 255, 255, 0.7);
          /* Site palette, not the mint of the reference shot: a periwinkle wash of the
             brand accent (#7387FF) deepening toward the navy end (#1c1b4b), plus a soft
             white bloom behind the heading so the corner doesn't read as flat paint. */
          background:
            radial-gradient(120% 150% at 8% 12%, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 48%),
            linear-gradient(104deg, #e7e9ff 0%, #d9deff 34%, #c7cfff 66%, #d8dcff 100%);
          box-shadow: 0 30px 70px -34px rgba(28, 27, 75, 0.45);
          overflow: hidden;
        }
        /* Section eyebrow above the heading — the em-dash lead-in the old proof section
           used ("— proof, not promises"), kept verbatim. */
        .lp-proof .lpz-eyebrow {
          display: block; margin: 0 0 14px;
          font-family: var(--font-body); font-size: 13px; font-weight: 600;
          font-style: italic; letter-spacing: 0.04em;
          color: rgba(28, 27, 75, 0.6);
        }
        .lp-proof .lpz-heading {
          margin: 0;
          font-family: var(--font-head); font-weight: 500;
          /* Three hand-broken lines carry this layout, so the type has to stay big without
             ever wrapping a fourth time — hence its own clamp rather than --lp-fs-display. */
          font-size: clamp(30px, 3.5vw, 62px);
          line-height: 1.06; letter-spacing: -1.2px;
          color: #1c1b4b;
        }
        .lp-proof .lpz-heading em { font-style: normal; color: #4452f0; }
        .lp-proof .lpz-desc {
          margin: 0 0 26px;
          font-family: var(--font-body);
          font-size: clamp(14px, 1.05vw, 17px);
          line-height: 1.6;
          color: rgba(28, 27, 75, 0.78);
          max-width: 46ch;
        }
        .lpz-actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
        /* Both pills are two classes deep for the same specificity reason as above — the
           sitewide ".lp-root button { color: var(--lp-text) }" base rule beats one class. */
        .lp-proof .lpz-cta {
          display: inline-flex; align-items: center; justify-content: center; gap: 10px;
          cursor: pointer; padding: 15px 28px; border-radius: 100px;
          font-family: var(--font-body); font-weight: 600; font-size: 15px;
          border: 1px solid transparent;
          transition: transform 0.2s ease, box-shadow 0.25s ease, background 0.25s ease;
        }
        /* Same navy-to-indigo pill the rest of the page uses for its primary action, so
           this CTA doesn't read as a different button family from the hero's. */
        .lp-proof .lpz-cta--dark {
          background: linear-gradient(180deg, #2b2a6d 0%, #07074e 100%);
          color: #fff;
          box-shadow: 0 12px 26px -12px rgba(7, 7, 78, 0.8);
        }
        .lp-proof .lpz-cta--dark:hover {
          transform: translateY(-2px);
          background: linear-gradient(180deg, #4452f0 0%, #1c1b4b 100%);
          box-shadow: 0 18px 34px -14px rgba(7, 7, 78, 0.85);
        }
        .lp-proof .lpz-cta--light {
          background: #fff; color: #1c1b4b;
          box-shadow: 0 10px 22px -14px rgba(28, 27, 75, 0.65);
        }
        .lp-proof .lpz-cta--light:hover { transform: translateY(-2px); background: #f4f5ff; }

        /* Award shields — one per stat, stacked down the right edge.
           Shape: the box is rounded normally and clip-path only removes the two bottom
           corners, leaving a downward point. The drop shadow is a filter, not box-shadow,
           because clip-path would cut a box-shadow off at the same outline; a filter is
           applied after the clip and so traces the shield. */
        /* Full-width row BELOW the copy, not a third column beside it. grid-column 1/-1
           makes it span every track, so the three shields sit centred under the heading,
           description and CTAs rather than competing with them for horizontal space. */
        /* Scoped under .lp-proof to match every other rule in this section — a bare
           .lpz-col--badges is only 0,1,0 and loses to anything more specific that also
           touches layout on these columns. */
        .lp-proof .lpz-col--badges {
          /* Column 2, not the full panel. Column 1 holds the "Trust Changes the Math."
             heading and column 2 holds the description + CTAs — so spanning 1/-1 centred the
             shields on the WHOLE panel, which reads as left-of-centre against the copy
             stacked above them. Sitting in the same track as that copy lines them up with it.
             Reset to a full span at <=1180px, where .lpz collapses to a single column and a
             track 2 no longer exists. */
          grid-column: 2 / -1;
          /* Then eased back left. Sitting fully inside track 2 aligned the shields with the
             copy but pushed them further right than wanted; this lands them between the
             panel's centre and the copy's. vw-based rather than a fixed px nudge so the
             offset keeps its proportion as the panel grows. Reset at <=1180px, where the
             grid is one column and there is nothing to offset from. */
          margin-left: calc(-1 * clamp(20px, 4vw, 75px));
          /* justify-self matters as much as justify-content here: as a GRID ITEM the box
             would otherwise stretch (or align to start) within its track, and centring the
             flex children inside a box that isn't itself full-width leaves the row sitting
             off to one side. width:100% + justify-self:stretch pins the box across the whole
             panel first, then justify-content centres the three shields inside it. */
          justify-self: stretch;
          width: 100%;
          display: flex;
          flex-direction: row;
          justify-content: center;
          align-items: flex-start;
          gap: clamp(14px, 2vw, 28px);
          margin-top: clamp(6px, 1.4vw, 18px);
        }
        .lpz-badge {
          width: clamp(96px, 8vw, 122px);
          padding: 10px 10px 26px;
          border-radius: 10px;
          background: linear-gradient(178deg, #ffffff 0%, #ffffff 62%, #eef0fb 100%);
          clip-path: polygon(0 0, 100% 0, 100% calc(100% - 18px), 50% 100%, 0 calc(100% - 18px));
          filter: drop-shadow(0 12px 20px rgba(28, 27, 75, 0.28));
          display: flex; flex-direction: column; align-items: center; gap: 5px;
          text-align: center;
        }
        .lp-proof .lpz-badge__brand {
          font-family: var(--font-body); font-weight: 700;
          font-size: 8px; letter-spacing: 0.2px; color: #1c1b4b;
        }
        .lp-proof .lpz-badge__brand em { font-style: normal; color: #7387FF; }
        .lp-proof .lpz-badge__value {
          font-family: var(--font-head); font-weight: 700;
          /* The stat strings vary a lot in length ("100cr+" vs "10,000+"), so this is sized
             for the longest one — the shield width is fixed and a wrap would break it. */
          font-size: clamp(15px, 1.35vw, 20px); line-height: 1; color: #07074e;
        }
        .lp-proof .lpz-badge__label {
          /* Inset, not full-bleed. It was width:calc(100% + 20px) with margin:0 -10px, which
             cancelled .lpz-badge's 10px side padding and ran the dark bar right out to the
             shield's edges. In the reference the bar floats inside the white card with a
             margin either side, and that white border is most of what makes it read as a
             printed award shield rather than a striped chip. width:100% inside the existing
             padding gives exactly that. */
          display: block; width: 100%; margin: 3px 0 0;
          padding: 5px 6px;
          background: #1c1b4b; color: #fff;
          font-family: var(--font-body); font-weight: 600;
          font-size: 7.5px; line-height: 1.25; letter-spacing: 0.3px; text-transform: uppercase;
        }
        /* (.lpz-badge__year removed along with the "2026" line in the JSX.) */
        .lp-proof .lpz-badge__stars { font-size: 8px; letter-spacing: 2px; color: #7387FF; }

        /* Below ~1180px the three columns can't all hold their measure, so the heading
           takes the full width and the copy + shields share the row under it. */
        @media (max-width: 1180px) {
          /* Single column: heading, copy, then the shield row underneath. The old
             "minmax(0,1fr) auto" existed to keep the badges as a side column, which they
             no longer are. */
          /* minmax(0, 1fr), NOT 1fr. A bare 1fr means minmax(AUTO, 1fr), and an auto minimum
             refuses to go below the track's min-content width — so the shield row (3 fixed
             shields + gaps) widened the track past the panel, and .lpz's overflow:hidden
             then sliced whatever hung off the RIGHT while the left padding stayed put. That
             also dragged the paragraph out with it, since it shares the same over-wide
             track, which is why its lines were cut mid-word. The base rule always used
             minmax(0, ...) for exactly this reason; these overrides had quietly dropped it. */
          .lpz { grid-template-columns: minmax(0, 1fr); gap: 26px clamp(24px, 3.5vw, 48px); }
          .lpz-col--text { grid-column: 1 / -1; }
          /* There is no track 2 in a single-column grid, so the base rule's grid-column: 2/-1
             would push the shields into an implicit column and out of the panel. The negative
             margin goes with it — with nothing to offset from it would just pull them off the
             left edge. */
          .lp-proof .lpz-col--badges { grid-column: 1 / -1; margin-left: 0; }
        }
        @media (max-width: 760px) {
          .lp-proof { padding: 90px 5% 100px; }
          /* Taller, roomier card (was 34px 24px 30px / gap 24px). On a phone this panel is
             the whole section — one tall rounded block holding heading, copy, both CTAs and
             the shields — so it needs real internal margin or the content reads as crammed
             against the gradient's edges. */
          /* minmax(0, 1fr) for the same reason as the 1180px rule above — see the note there.
             This is the breakpoint where it actually bit, because the panel is narrowest and
             the shield row is closest to outgrowing it. */
          .lpz { grid-template-columns: minmax(0, 1fr); padding: 40px 26px 34px; gap: 22px; }
          .lpz-col--text { grid-column: auto; }
          /* Second half of the same fix. Track sizing alone is not enough: each .lpz-col is
             itself a grid ITEM, and grid items also default to min-width:auto, so a column
             whose contents can't shrink will still push past a correctly-sized track. */
          .lpz-col { min-width: 0; }
          /* The heading's three hard-broken lines are what set the panel's minimum width,
             so its own floor drops below the desktop clamp's 30px — at 320px the line
             "to get great UGC" would otherwise be wider than the panel's content box. */
          .lp-proof .lpz-heading { font-size: clamp(25px, 7.2vw, 40px); letter-spacing: -0.6px; }
          .lp-proof .lpz-desc { max-width: none; margin-bottom: 22px; }
          /* Buttons STACK and hug their own labels, matching the reference card: one under
             the other, both starting on the panel's left edge rather than sharing a row.
             This also retires the squashing problem the old rule was working around — with
             flex: 1 1 140px both pills sat on one row, leaving each ~151px on a 360px screen
             against the ~185px "Sign up as Brand" plus its arrow needs, so the label broke in
             two. Given a row of its own each, nothing has to shrink at all. nowrap is kept as
             a belt-and-braces guard on that label. */
          .lpz-actions { flex-direction: column; align-items: flex-start; gap: 12px; }
          .lp-proof .lpz-cta { flex: 0 0 auto; width: auto; padding: 14px 24px; white-space: nowrap; }
          /* Left-aligned, not centred: everything else in the card starts at the same left
             edge, and a centred shield row was the one element breaking that line.
             Same .lp-proof scope as the base rule above, or this 0,1,0 selector would lose
             to it and the phone layout would silently keep the desktop gap. */
          .lp-proof .lpz-col--badges { justify-content: flex-start; gap: 10px; margin-top: 4px; }
          /* flex-grow 0 (was 1 1 0): growing to fill the row re-centred them visually and
             stretched each shield wider than its artwork wants. They sit at their natural
             size from the left instead.
             The width is stated as "a third of the row, minus the two 10px gaps, capped at
             112px" rather than a vw clamp. A vw value doesn't know about the panel's 26px
             padding, so the old clamp(86px, 27vw, 112px) resolved to 97px at 360px — 3 of
             those plus gaps is 312px against 308px of usable width, i.e. it overflowed again
             on exactly the screens this was meant to fix. This form can't: it is derived
             from the row's own width. */
          .lpz-badge { flex: 0 1 auto; width: min(112px, calc((100% - 20px) / 3)); }
        }

        .lp-proof__header {
          text-align: center;
          margin-bottom: 28px;
        }
        .lp-proof__eyebrow {
          display: block;
          font-family: var(--font-body);
          font-size: 0.78rem;
          font-weight: 500;
          color: var(--lp-text-muted);
          letter-spacing: 0.16em;
          text-transform: uppercase;
          font-style: italic;
          margin-bottom: 18px;
        }
        .lp-proof__heading {
          font-family: var(--font-head);
          font-size: var(--lp-fs-h2);
          font-weight: var(--fw-head);
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

        /* WEB: editorial stacked rows — big number on the LEFT, index + label on the
           RIGHT (each stat is a full-width row, divided by a horizontal rule). */
        /* Left big-number card + right 3 metric cards (reference-style). Full height:
           the split fills the viewport, left card + right cards stretch to match. */
        .lp-proof__split {
          display: grid;
          grid-template-columns: 1.05fr 1fr;
          gap: 24px;
          margin-bottom: 60px;
          align-items: stretch;
          min-height: min(88vh, 820px);
        }
        .lp-proof__big {
          display: flex; flex-direction: column; justify-content: center;
          background: var(--lp-section); border: 1px solid var(--lp-border);
          border-radius: 24px; padding: 48px 44px; min-height: 380px;
          box-shadow: none;
        }
        .lp-proof__big-value {
          font-family: var(--font-head); font-weight: 700;
          letter-spacing: -2px; font-size: clamp(64px, 9vw, 132px); line-height: 1; color: var(--lp-text);
        }
        .lp-proof__big-label {
          margin-top: 18px; font-family: var(--font-body);
          font-size: 17px; color: var(--lp-text-muted); font-weight: 600;
        }
        /* Cards hug their content and spread to match the left card's height. */
        /* Reference-style cards: big faded value watermark, index badge top-right,
           name pinned bottom-left. Cards fill the column height. */
        .lp-proof__cards { display: flex; flex-direction: column; gap: 16px; }
        .lp-proof__card {
          position: relative; text-align: left; cursor: pointer; flex: 1;
          background: var(--lp-section); border: 1px solid var(--lp-border);
          border-radius: 20px; padding: 26px 30px; font-family: inherit;
          display: flex; flex-direction: column; justify-content: center; gap: 6px;
          box-shadow: none;
          transition: border-color .2s ease, transform .2s ease;
        }
        .lp-proof__card:hover, .lp-proof__card.is-active {
          border-color: #4452f0; transform: translateY(-2px);
        }
        .lp-proof__card-index {
          position: absolute; top: 20px; right: 24px; font-size: 12px; font-weight: 700;
          letter-spacing: 2px; color: var(--lp-text-muted); z-index: 2;
        }
        /* Big readable value, label underneath — no overlap. */
        .lp-proof__card-value {
          font-family: var(--font-head); font-weight: 700;
          letter-spacing: -1.5px; font-size: clamp(42px, 5.2vw, 68px); line-height: 1; color: var(--lp-text);
        }
        .lp-proof__card.is-active .lp-proof__card-value { color: #4452f0; }
        .lp-proof__card-label {
          font-family: var(--font-body);
          font-size: 16px; color: var(--lp-text-muted); font-weight: 600;
        }
        @media (max-width: 900px) {
          .lp-proof__split { grid-template-columns: 1fr; gap: 16px; }
          .lp-proof__big { min-height: 200px; padding: 32px 24px; }
          .lp-proof__card { min-height: 130px; }
        }

        .lp-proof__row {
          display: flex;
          flex-direction: column;
          gap: 0;
          margin-bottom: 60px;
        }
        .lp-proof__row > .lp-proof-num {
          padding: 34px 4px;
        }
        .lp-proof__row > .lp-proof-num:not(:last-child) {
          border-bottom: 1px solid var(--lp-border);
        }
        .lp-proof-num {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: space-between;
          gap: 24px;
          text-align: left;
        }
        .lp-proof-num__details {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
          text-align: right;
        }
        .lp-proof-num__index {
          font-family: var(--font-body);
          font-size: 0.72rem;
          font-weight: 600;
          color: var(--lp-text-soft);
          letter-spacing: 0.24em;
        }
        .lp-proof-num__value {
          font-family: var(--font-head);
          font-size: clamp(3rem, 6vw, 5.6rem);
          font-weight: var(--fw-head);
          color: #7387FF;
          letter-spacing: -0.045em;
          line-height: 1;
          display: inline-block;
          min-width: 0;
        }
        .lp-proof-num__label {
          font-family: var(--font-body);
          font-size: 1.05rem;
          font-weight: 500;
          color: var(--lp-text);
          letter-spacing: -0.01em;
          line-height: 1.3;
        }

        /* MOBILE carousel — hidden on web (the grid above is shown instead). Revealed in the
           ≤900px media query. */
        .lp-proof__marquee {
          display: none;
          position: relative;
          width: 100%;
          margin-bottom: 28px;
        }
        .lp-proof__track {
          display: flex;
          flex-wrap: nowrap;
          align-items: flex-start;
          justify-content: center;
          gap: 40px;
          /* Room above so the lifted number circle (margin-top below) never clips. */
          padding-top: 16px;
        }

        .lp-proof-item {
          flex: 0 0 auto;
          display: flex;
          /* Icon sits at the top so it reads a touch ABOVE the number/label, not centred. */
          align-items: flex-start;
          gap: 18px;
          padding: 8px 0;
        }
        /* Index number, big, inside a dotted circle. Nudged up so it sits a touch above the
           value/label. */
        .lp-proof-item__icon {
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 64px;
          height: 64px;
          margin-top: -16px;
          border-radius: 50%;
          border: 2px solid rgba(115, 135, 255, 0.7);
          color: var(--lp-ink);
          font-family: var(--font-head);
          font-size: 1.5rem;
          font-weight: var(--fw-head);
          letter-spacing: -0.04em;
          line-height: 1;
        }
        .lp-proof-item__text {
          display: flex;
          flex-direction: column;
          gap: 4px;
          min-width: 0;
        }
        .lp-proof-item__value {
          font-family: var(--font-head);
          font-size: clamp(1.7rem, 2.6vw, 2.5rem);
          font-weight: var(--fw-head);
          color: var(--lp-ink);
          letter-spacing: -0.045em;
          line-height: 1;
          white-space: nowrap;
        }
        .lp-proof-item__label {
          font-family: var(--font-body);
          font-size: 0.98rem;
          font-weight: 500;
          color: var(--lp-text-muted);
          letter-spacing: -0.01em;
          line-height: 1.3;
          white-space: nowrap;
        }

        /* Scrubber indicator — MOBILE ONLY (the carousel only scrolls on small screens; on
           web all stats show at once, so no indicator). Shown via the mobile media query. */
        .lp-proof__dots {
          display: none;
          align-items: center;
          justify-content: center;
          gap: 9px;
          margin-bottom: 48px;
        }
        .lp-proof__dot {
          width: 9px;
          height: 9px;
          border-radius: 999px;
          background: rgba(28, 27, 75, 0.22);
        }
        .lp-root[data-theme="dark"] .lp-proof__dot {
          background: rgba(255, 255, 255, 0.22);
        }
        .lp-proof__dot--active {
          width: 34px;
          background: #0f3a44;
        }
        .lp-root[data-theme="dark"] .lp-proof__dot--active {
          background: #7387FF;
        }

        /* Vertical divider to the right of each stat — mobile only (revealed in the ≤900px block). */
        .lp-proof-item__sep { display: none; }

        .lp-proof__micro {
          font-family: var(--font-body);
          font-size: 1rem;
          color: var(--lp-text-muted);
          font-style: italic;
          /* Sits under the panel now (it used to be the last child inside it), so it needs
             its own breathing room instead of inheriting the panel's padding. */
          margin: 28px 0 0;
          text-align: center;
          letter-spacing: 0.02em;
        }

        /* ── Testimonial ─────────────────────────────────────────────────── */
        .lp-testimonial {
          position: relative;
          padding: calc(var(--lp-space-section) * 0.5) 4% calc(var(--lp-space-section) * 0.5);
          background: transparent;
          color: var(--lp-text);
          overflow: hidden;
        }
        /* radial-gradient glow instead of filter: blur(110px) — cheaper to composite. */
        .lp-testimonial__bg-orb {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }
        .lp-testimonial__bg-orb--1 {
          width: 560px; height: 560px;
          background: radial-gradient(circle, rgba(154, 154, 191, 0.30) 0%, transparent 68%);
          top: -200px; left: -180px;
        }
        .lp-testimonial__bg-orb--2 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(7, 7, 78, 0.20) 0%, transparent 68%);
          bottom: -180px; right: -160px;
        }

        .lp-testimonial__inner {
          position: relative;
          z-index: 2;
          max-width: var(--lp-maxw);
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
          font-family: var(--font-body);
          font-size: 0.82rem;
          font-weight: 600;
          color: #7387FF;
          margin-bottom: 22px;
          box-shadow: 0 4px 14px rgba(7, 7, 78, 0.08);
        }

        .lp-testimonial__heading {
          font-family: var(--font-head);
          font-size: var(--lp-fs-h2);
          font-weight: var(--fw-head);
          color: var(--lp-ink);
          letter-spacing: -0.04em;
          line-height: 1.15;
          margin: 0 0 56px 0;
        }
        .lp-root .lp-testimonial__heading--accent {
          color: #7387FF;
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
          font-family: var(--font-body);
          color: var(--lp-text-muted);
          font-size: 1.05rem;
          line-height: 1.5;
          letter-spacing: -0.015em;
          margin: -28px auto 40px;
          max-width: 600px;
        }

        /* Avatar picker — "Trusted by:" + a row of faces. Clicking one jumps the
           spotlight carousel below straight to that person; the active face gets a
           accent ring and a small name tag underneath. */
        .lp-testimonial__trustbar {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          margin-bottom: 40px;
        }
        .lp-testimonial__trustbar-label {
          font-family: var(--font-body);
          font-size: 0.82rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--lp-text-muted);
        }
        .lp-testimonial__avatars {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          flex-wrap: wrap;
        }
        .lp-testimonial__avatar {
          position: relative;
          width: 44px;
          height: 44px;
          padding: 0;
          border-radius: 50%;
          border: 2px solid transparent;
          background: linear-gradient(135deg, #07074e, #050538);
          cursor: pointer;
          overflow: visible;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: border-color 0.3s ease, transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease, box-shadow 0.3s ease;
          opacity: 0.45;
        }
        .lp-testimonial__avatar img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          object-fit: cover;
          z-index: 2;
        }
        .lp-testimonial__avatar .lp-tcard__initials { font-size: 0.75rem; }
        .lp-testimonial__avatar:hover { opacity: 0.85; transform: translateY(-2px); }
        .lp-testimonial__avatar.is-active {
          opacity: 1;
          border-color: #7387FF;
          /* Clearly larger + a periwinkle glow so the active face is obvious. */
          transform: scale(1.28) translateY(-2px);
          box-shadow: 0 0 0 3px rgba(115, 135, 255, 0.28), 0 8px 18px rgba(115, 135, 255, 0.35);
          z-index: 2;
        }
        .lp-testimonial__avatar-tip {
          position: absolute;
          top: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          white-space: nowrap;
          font-family: 'SF Mono', ui-monospace, Menlo, monospace;
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          color: var(--lp-ink);
          background: var(--lp-page-bg);
          border: 1px solid var(--lp-border);
          padding: 4px 10px;
          border-radius: 6px;
          z-index: 5;
        }

        /* Carousel wrapper: grid of cards flanked by rotate arrows. */
        .lp-testimonial__carousel {
          position: relative;
          /* 56px -> 112px: the arrows moved out of the card row and now hang BELOW it as
             an absolutely-positioned pair, so the carousel has to reserve the room they
             occupy (18px gap + 44px button) or they'd collide with .lp-testimonial__more. */
          margin-bottom: 112px;
          /* Card width + gap drive everything (centering, stepping, frame). */
          --tcard-w: clamp(300px, 299px + 10.4vw, 543px);
          --tcard-gap: 24px;
        }
        /* Manual prev/next — same setTIndex the auto-advance timer already uses, so a
           click just steps the carousel like a normal tick; the existing wrap-around
           effect (keyed off tIndex) handles looping either direction for free. */
        .lp-testimonial__arrow {
          position: absolute;
          /* Sit as a centred pair BELOW the spotlight card instead of flanking the row.
             top:100% is the carousel's bottom edge (the viewport's -34px bottom margin
             cancels its own padding, so that edge lands on the card), then a fixed 18px
             drop. Each button's own horizontal shift lives in --tarrow-shift so the
             :hover rule can re-declare the transform without hard-coding prev vs next. */
          top: 100%;
          left: 50%;
          --tarrow-shift: 0px;
          transform: translate(var(--tarrow-shift), 18px);
          z-index: 5;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 1px solid rgba(var(--lp-fg), 0.14);
          background: var(--lp-page-bg);
          color: var(--lp-text);
          display: grid;
          place-items: center;
          cursor: pointer;
          box-shadow: 0 8px 20px rgba(7, 7, 78, 0.12);
          transition: transform 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
        }
        .lp-testimonial__arrow:hover {
          background: #7387FF;
          color: #fff;
          box-shadow: 0 10px 26px rgba(115, 135, 255, 0.35);
          transform: translate(var(--tarrow-shift), 18px) scale(1.06);
        }
        /* -100% is the button's OWN width, so the pair stays symmetric about the centre
           line at any button size — the 900px breakpoint below only has to change width
           and height, not re-derive these offsets. 10px each side = 20px between them. */
        .lp-testimonial__arrow--prev { --tarrow-shift: calc(-100% - 10px); }
        .lp-testimonial__arrow--next { --tarrow-shift: 10px; }
        @media (max-width: 900px) {
          /* 38px -> 44px: minimum comfortable touch size. */
          .lp-testimonial__arrow { width: 44px; height: 44px; }
        }
        /* Clips the horizontal slide so the off-screen row never spills out, while
           leaving vertical room for card hover-lift + drop shadows. */
        .lp-testimonial__viewport {
          position: relative;
          overflow: hidden;
          padding: 10px 4px 34px;
          margin: -10px -4px -34px;
          /* Soft fade at both edges so the off-centre cards trail off. */
          -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 9%, #000 91%, transparent 100%);
                  mask-image: linear-gradient(90deg, transparent 0%, #000 9%, #000 91%, transparent 100%);
        }
        /* One flexible track holding every card; JS centers the active card by
           translating the whole track, so the slide is one smooth CSS transition. */
        .lp-testimonial__grid {
          position: relative;
          display: flex;
          flex-wrap: nowrap;
          gap: var(--tcard-gap);
          /* Centre the first card; JS then translates by whole pitches to step. */
          margin-left: calc(50% - var(--tcard-w) / 2);
          text-align: left;
          will-change: transform;
          transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .lp-testimonial__grid > .lp-tcard { box-sizing: border-box; }

        /* ── Infinite marquee variant (seamless, no empty edge, no spotlight) ── */
        /* Center-peaked mask: whichever card is under the middle stays full-strength;
           neighbours fade lighter toward the edges (the spotlight follows the scroll). */
        .lp-testimonial__viewport--marquee {
          overflow: hidden;
          -webkit-mask-image: linear-gradient(90deg,
            transparent 0%, rgba(0,0,0,0.28) 14%, rgba(0,0,0,0.42) 32%,
            #000 50%,
            rgba(0,0,0,0.42) 68%, rgba(0,0,0,0.28) 86%, transparent 100%);
                  mask-image: linear-gradient(90deg,
            transparent 0%, rgba(0,0,0,0.28) 14%, rgba(0,0,0,0.42) 32%,
            #000 50%,
            rgba(0,0,0,0.42) 68%, rgba(0,0,0,0.28) 86%, transparent 100%);
        }
        .lp-testimonial__grid--marquee {
          width: max-content;
          flex-wrap: nowrap;
          transition: none;                 /* driven by the keyframes, not JS transforms */
          animation: testimonialScroll 48s linear infinite;
        }
        .lp-testimonial__grid--marquee:hover { animation-play-state: paused; }
        .lp-tcard--marq {
          flex: 0 0 var(--tcard-w);
          cursor: default;
        }
        @keyframes testimonialScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }   /* set duplicated once → seamless loop */
        }
        /* Centre spotlight frame — fixed corner brackets over the middle card.
           Anchored to the viewport and inset by its exact padding values (10px
           top / 4px sides / 34px bottom, minus a 3px outset), so the frame's box
           always matches the active card's real box regardless of viewport size —
           no guessing off the carousel's auto height. */
        .lp-testimonial__carousel { position: relative; }
        .lp-testimonial__frame {
          position: absolute;
          top: 7px;
          bottom: 31px;
          left: 50%;
          width: calc(var(--tcard-w) + 6px);
          transform: translateX(-50%);
          pointer-events: none;
          z-index: 5;
        }
        /* The bracket radius has to match the CARD's curve, not a token 4px, or the
           mark cuts a square corner across the card's rounded one. Card radius is
           22px and the frame sits 3px outside it, so the bracket's outer arc is
           22 + 3 = 25px. Arms are 38px so ~13px of straight leg reads past the arc. */
        .lp-tframe-c {
          position: absolute;
          width: 38px;
          height: 38px;
          border: 2px solid #a33b2a;   /* terracotta corner marks */
        }
        .lp-tframe-c--tl { top: 0; left: 0; border-right: none; border-bottom: none; border-top-left-radius: 25px; }
        .lp-tframe-c--tr { top: 0; right: 0; border-left: none; border-bottom: none; border-top-right-radius: 25px; }
        .lp-tframe-c--bl { bottom: 0; left: 0; border-right: none; border-top: none; border-bottom-left-radius: 25px; }
        .lp-tframe-c--br { bottom: 0; right: 0; border-left: none; border-top: none; border-bottom-right-radius: 25px; }
        @media (max-width: 640px) {
          .lp-testimonial__carousel { --tcard-w: 84vw; }
        }
        @media (max-width: 640px) {
          .lp-testimonial__grid--marquee { animation-duration: 32s; }
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

        /* Spotlight carousel — every card keeps the exact same plain panel (no border
           or accent), whether active or not; the active one is just told apart by its
           content being full-strength while its neighbours are muted. */
        .lp-tcard--spot {
          cursor: pointer;
          transition: box-shadow 0.3s ease;
        }
        .lp-tcard--spot:not(.is-active)::before { display: none; }
        .lp-tcard--spot:not(.is-active) .lp-tcard__rating,
        .lp-tcard--spot:not(.is-active) .lp-tcard__mark,
        .lp-tcard--spot:not(.is-active) .lp-tcard__quote,
        .lp-tcard--spot:not(.is-active) .lp-tcard__author,
        .lp-tcard--spot:not(.is-active) .lp-tcard__metric {
          opacity: 0.45;
          transition: opacity 0.3s ease;
        }
        .lp-tcard--spot:hover:not(.is-active) .lp-tcard__rating,
        .lp-tcard--spot:hover:not(.is-active) .lp-tcard__mark,
        .lp-tcard--spot:hover:not(.is-active) .lp-tcard__quote,
        .lp-tcard--spot:hover:not(.is-active) .lp-tcard__author,
        .lp-tcard--spot:hover:not(.is-active) .lp-tcard__metric {
          opacity: 0.7;
        }
        .lp-tcard--spot.is-active {
          cursor: default;
          z-index: 2;
        }

        .lp-tcard__rating {
          display: flex;
          gap: 2px;
          margin-bottom: 14px;
        }
        .lp-tcard__mark {
          font-family: var(--font-body);
          font-size: 3.4rem;
          line-height: 0.5;
          color: var(--lp-purple-300);
          display: block;
          margin-bottom: 4px;
        }
        .lp-tcard__quote {
          font-family: var(--font-body);
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
          color: #7387FF;
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
          font-family: var(--font-body);
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--lp-text);
          letter-spacing: -0.01em;
          z-index: 1;
        }
        .lp-tcard__author-info { flex: 1; min-width: 0; }
        .lp-tcard__name {
          font-family: var(--font-body);
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--lp-ink);
          letter-spacing: -0.015em;
        }
        .lp-tcard__role {
          font-family: var(--font-body);
          font-size: 0.78rem;
          color: var(--lp-text-muted);
          margin-top: 2px;
          line-height: 1.3;
        }

        /* Review-box variant (reference): plain panel, review text, author pinned to the
           bottom, uppercase letter-spaced name/role, uniform dark text, no divider. */
        .lp-tcard--marq {
          padding: 34px 30px;
          justify-content: flex-start;
          /* Off-centre cards dim; the one in the frame is full-strength. */
          opacity: 0.34;
          transition: opacity 0.55s ease;
        }
        .lp-tcard--marq.is-active { opacity: 1; }
        /* No hover interaction on the carousel cards (no lift, no gradient top-bar). */
        .lp-tcard--marq:hover {
          transform: none;
          box-shadow: 0 12px 30px rgba(7, 7, 78, 0.06);
        }
        .lp-tcard--marq::before,
        .lp-tcard--marq:hover::before { opacity: 0; }
        .lp-tcard--marq .lp-tcard__rating { margin-bottom: 18px; }
        .lp-tcard--marq .lp-tcard__quote {
          font-size: 1.02rem;
          font-weight: 500;
          color: var(--lp-ink);
          line-height: 1.55;
          letter-spacing: -0.005em;
          margin: 0 0 24px;
        }
        .lp-tcard--marq .lp-tcard__quote em {
          color: inherit;
          font-style: normal;
          font-weight: 600;
        }
        .lp-tcard--marq .lp-tcard__author {
          margin-top: auto;
          padding-top: 0;
          border-top: none;
          margin-bottom: 0;
        }
        .lp-tcard--marq .lp-tcard__name {
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-weight: 700;
          font-size: 0.82rem;
        }
        .lp-tcard--marq .lp-tcard__role {
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-size: 0.72rem;
          margin-top: 4px;
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
          font-family: var(--font-head);
          font-size: 1.05rem;
          font-weight: var(--fw-head);
          color: #7387FF;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .lp-tcard__metric-label {
          font-family: var(--font-body);
          font-size: 0.68rem;
          color: var(--lp-text-muted);
          margin-top: 2px;
        }

        /* Light mode polish: the translucent navy-tinted cards looked washed out on the
           lavender bg. Give them solid white surfaces, a clearer shadow/border, and a
           slightly deeper purple accent so quotes + metrics read well. Dark mode unchanged. */
        .lp-root[data-theme="light"] .lp-tcard {
          background: #fbf8f1;
          border-color: rgba(28,27,75,0.12);
          box-shadow: none;
        }
        .lp-root[data-theme="light"] .lp-tcard:hover {
          box-shadow: none;
        }
        .lp-root[data-theme="light"] .lp-tcard--featured {
          background: #fbf8f1;
          border-color: rgba(115,135,255,0.35);
          box-shadow: none;
        }
        .lp-root[data-theme="light"] .lp-tcard__quote em,
        .lp-root[data-theme="light"] .lp-tcard__metric-val { color: #7387FF; }
        .lp-root[data-theme="light"] .lp-tcard__metric {
          background: #f1ecfe;
          border-color: rgba(115,135,255,0.5);
        }

        /* Mid-size screens: cap the carousel width so the flanking arrows sit just
           outside the cards instead of drifting into the gutter. */
        @media (max-width: 1280px) {
          .lp-testimonial__carousel { max-width: 860px; margin-left: auto; margin-right: auto; }
        }
        @media (max-width: 1024px) {
          .lp-testimonial__carousel { max-width: 560px; }
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
          font-family: var(--font-body);
          font-size: 0.9rem;
          color: var(--lp-text-muted);
          font-style: italic;
          white-space: nowrap;
        }
        /* Let it wrap on the narrowest phones. "100+ founders. Same story, different brand."
           needs ~290px plus the two 16px flex gaps; at 360px with 6% gutters only ~317px is
           available, so nowrap ran it past the edge where .lp-testimonial's overflow:hidden
           silently sliced it. Wrapping costs a line; clipping loses words. */
        @media (max-width: 480px) {
          .lp-testimonial__more-text { white-space: normal; }
        }

        @media (max-width: 640px) {
          .lp-testimonial__card { padding: 28px 24px; }
          .lp-testimonial__author { flex-wrap: wrap; }
          .lp-testimonial__metric { margin-left: auto; }
        }

        /* ── Footer extras ───────────────────────────────────────────────── */
        .lp-footer__main-heading {
          font-family: var(--font-head);
          font-size: var(--fs-h2);
          font-weight: var(--fw-head);
          color: var(--lp-ink);
          letter-spacing: -0.03em;
          margin: 0 0 50px 0;
          text-align: center;
        }
        .lp-footer__closing {
          padding: 40px 0 24px;
          text-align: center;
          font-family: var(--font-body);
          font-size: 1.05rem;
          color: var(--lp-text);
          line-height: 1.55;
          letter-spacing: -0.02em;
          font-weight: 500;
        }

        /* Audit cards on TABLET (769–900px): simple vertical stack (the desktop 220vh
           scroll-peel needs a tall pinned runway that's awkward at this width). */
        @media (min-width: 769px) and (max-width: 900px) {
          .lp-audit { min-height: auto; padding: 80px 6%; }
          .lp-audit__inner { position: static; top: auto; }
          .lp-audit__grid {
            display: flex; flex-direction: column; align-items: center; gap: 20px;
            min-height: auto; margin: 40px auto; max-width: 100%; perspective: none;
          }
          .lp-audit-card {
            position: static !important; transform: none !important;
            width: 100%; max-width: 420px; min-height: auto;
          }
          /* No peel at this width, so there is no emptied card box to reclaim — the desktop
             overlap would just drag Find & Hire up over three cards that are still there. */
          .lp-achieve-rise { margin-top: 0; }
        }
        /* Audit cards on MOBILE (≤768px): keep the absolute FAN (centred via flex
           static-position), sized for a phone, and give the section a TALL sticky runway so the
           cards peel by SCROLL (Q1 first, then Q2, then Q3 — heroStatic branch in the JSX).
           No position:static / transform:none here (that kills the fan). */
        @media (max-width: 768px) {
          /* Shorter runway than desktop: enough pinned scroll for a smooth peel, but trimmed so
             the section unpins right as the last card leaves — no tall empty pinned tail. */
          .lp-audit { min-height: 185vh; padding: 0 6%; }
          /* Promote the sticky inner to its own GPU layer so the cards rising over it
             composite independently instead of repainting this whole pinned area each
             scroll frame (that repaint was the Q2 stutter). */
          .lp-audit__inner {
            position: sticky; top: 60px; padding-top: 22px;
            transform: translateZ(0);
          }
          .lp-audit__subtitle { max-width: 100%; margin-bottom: 0; }
          .lp-audit__grid {
            position: relative;
            display: flex; justify-content: center; align-items: center;
            flex-direction: row; gap: 0;
            min-height: clamp(360px, 54vh, 460px); margin: 14px auto 0; max-width: 100%;
            /* No perspective on mobile: the cards only do a flat 2D translate + rotate, so
               perspective adds nothing visually but stops the rising cards from compositing
               cleanly on phone GPUs — which is what made Q2 lag. */
            perspective: none;
          }
          .lp-audit-card {
            width: 86%; max-width: 270px; min-height: 0; padding: 26px 24px 22px;
            box-shadow: 0 8px 20px rgba(28, 27, 75, 0.20);
          }
          /* On the narrow phone card BOTH lines wrap (the single-line treatment is desktop-only),
             so the card stays a proper portrait shape instead of being stretched wide to hold a
             long line. Bump the sizes back up since wrapping gives them the room. */
          .lp-root .lp-audit-card__title {
            white-space: normal;
            font-size: 1rem;
          }
          .lp-root .lp-audit-card__sub {
            white-space: normal;
            font-size: 1.5rem;
            line-height: 1.2;
          }
        }

        @media (max-width: 900px) {
          .lp-steps__grid { grid-template-columns: 1fr; }
          /* Leaderboard: widen the viewport so the (now smaller) rows fit without clipping,
             and re-centre it (the desktop right-shift isn't needed on a stacked mobile view). */
          .lp-logo3d__board { width: 92%; }
          .lp-logo3d__sticky { justify-content: center; padding-right: 0; }
          .lp-step-card__connector { display: none; }
          .lp-step-card { min-height: auto; }
          /* Audit section mobile/tablet handling is in dedicated blocks just above. */
          /* .lp-proof / .lp-proof__inner rules that used to live here (a scroll-pinned
             carousel: tall runway + sticky inner, JS-driven track/dots) were removed —
             they targeted a carousel structure that no longer exists in the JSX and
             collided with the current "We are zero"-style .lpz layout (forcing
             display:flex/sticky over its display:grid). The .lp-proof__top /
             __heading / __divider rules below still target dead carousel-only markup;
             left as-is since they no longer match anything and don't conflict. */
          .lp-proof__top { flex-direction: column; align-items: flex-start; }
          .lp-proof__heading { text-align: left; }
          /* Make the divider clearly visible on the dark mobile background. It's a flex item
             now, and its auto side-margins were cancelling stretch (0 width, invisible). Give
             it an explicit width so the line actually shows. */
          .lp-proof__divider {
            width: 100%;
            margin-bottom: 28px;
            background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
          }
          .lp-root[data-theme="light"] .lp-proof__divider {
            background: linear-gradient(90deg, transparent, rgba(28, 27, 75, 0.35), transparent);
          }
          /* Swap the web grid out for the carousel on mobile. */
          .lp-proof__row, .lp-proof__split { display: none; }
          /* Viewport window — one stat wide; the track slides inside it. */
          .lp-proof__marquee {
            display: block;
            overflow: hidden;
            width: 100%;
          }
          .lp-proof__track {
            width: 100%;
            flex-wrap: nowrap;
            justify-content: flex-start;
            gap: 0;
            padding: 16px 0;
            /* x is driven by framer (proofTrackX) — don't fight it with a CSS transform. */
          }
          /* Each stat fills the window, so a 100%-step translate shows exactly one at a time. */
          .lp-proof-item {
            flex: 0 0 100%;
            width: 100%;
            justify-content: center;
            gap: 16px;
          }
          /* Carousel indicator only appears on mobile. */
          .lp-proof__dots { display: flex; }
          .lp-proof-item__icon { width: 54px; height: 54px; font-size: 1.25rem; }
          .lp-proof-item__value { font-size: 1.9rem; }
          .lp-proof-item__label { font-size: 0.82rem; }
          /* The -190px pull-up here is GONE. It existed to close a big empty gap left by the
             tall .lp-connector above this section — but that connector is now display:none at
             <=1024px, so there is no gap left to close and the negative margin dragged the
             testimonial 90px INTO .lp-proof (whose mobile bottom padding is only 100px).
             That was a real content collision, not just crowding: .lp-proof is wrapped in a
             z-index:3 div while this section is z-index:auto, so the proof's solid fan card
             painted OVER the "Founder stories" pill and heading — hiding them outright. */
          .lp-testimonial { margin-top: 0; padding-top: 24px; }
          /* Vertical divider to the RIGHT of the stat content (mobile only). */
          .lp-proof-item__sep {
            display: block;
            flex: 0 0 auto;
            align-self: center;
            width: 2px;
            height: 64px;
            margin-left: 56px;
            background: linear-gradient(to bottom, transparent, rgba(255, 255, 255, 0.5), transparent);
          }
          .lp-root[data-theme="light"] .lp-proof-item__sep {
            background: linear-gradient(to bottom, transparent, rgba(28, 27, 75, 0.4), transparent);
          }
        }

        /* ── Mobile performance pass ─────────────────────────────────────────────
           Phones drop frames on fast scroll when every section repaints heavy effects.
           These cut paint cost only; layout/design are otherwise unchanged. */
        @media (max-width: 767px) {
          /* backdrop-filter blur is one of the most expensive things to repaint during scroll. */
          .lp-root * {
            -webkit-backdrop-filter: none !important;
            backdrop-filter: none !important;
          }
          /* Cheaper shadows on the cards that SCROLL/animate (big blur radii repaint every frame).
             .lp-brand-item__icon is deliberately NOT in this list: it is not a card, it is a
             transparent box holding a cut-out logo, and its base rule sets box-shadow:none on
             purpose (see the comment there). Shadowing it drew an edge around every mark, so
             each logo read as sitting on its own white tile — on mobile only, which is why the
             desktop strip looked right. There is nothing to optimise here either: the rule was
             REPLACING a shadow this element never had. */
          .lp-showcase-card, .lp-audit-card, .lp-achieve-card, .lp-tcard {
            box-shadow: 0 4px 12px rgba(28, 27, 75, 0.20) !important;
          }
          /* content-visibility:auto = the browser skips rendering off-screen sections entirely (the
             single biggest fast-scroll win). ONLY static sections here — the scroll-PINNED ones
             (hero, logo3d/leaderboard, audit, achieve, proof) need real measured heights for their
             sticky + useScroll math, so a content-visibility placeholder would break them. */
          .lp-testimonial, .lp-faq, .lp-cta, .lp-vs, .lp-community, .lp-steps, .lp-problem, .lp-footer {
            content-visibility: auto;
            contain-intrinsic-size: 1px 900px;
          }
        }

        /* ── Low-end / reduced-motion tier (.lp-perf-lite on the root) ────────────
           Budget phones + "reduce motion" / Save-Data users. The WebGL logo and live
           video decode are already skipped in JS for these devices; here we also stop
           every LOOPING css animation (brand & showcase marquees, hook pulse, scroll
           cue, connector flow, arrow slide) and drop the expensive blur repaints — at
           ANY width, so a weak small laptop is covered too. framer-motion's scroll
           transforms are JS-driven (not css animations) and keep working untouched. */
        .lp-perf-lite *,
        .lp-perf-lite *::before,
        .lp-perf-lite *::after {
          animation: none !important;
          -webkit-backdrop-filter: none !important;
          backdrop-filter: none !important;
        }
        /* .lp-brand-item__icon dropped here for the same reason as the mobile block above —
           it has no shadow to make cheaper, and adding one tiles every logo. */
        .lp-perf-lite .lp-showcase-card,
        .lp-perf-lite .lp-audit-card,
        .lp-perf-lite .lp-achieve-card,
        .lp-perf-lite .lp-tcard {
          box-shadow: 0 4px 12px rgba(28, 27, 75, 0.20) !important;
        }

        /* Respect the OS "reduce motion" preference for everyone — also halts the
           looping marquees on any device we didn't otherwise flag as low-end. */
        @media (prefers-reduced-motion: reduce) {
          .lp-root *,
          .lp-root *::before,
          .lp-root *::after {
            animation-duration: 0.001ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.001ms !important;
          }
        }

      `}</style>
    </div>
  );
}
