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
  LogIn,
  Menu,
  Sun,
  Moon,
  Search,
  Lock,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { motion, AnimatePresence, useInView, animate, useMotionValue, useTransform, useScroll, useMotionValueEvent, useSpring, easeInOut } from 'framer-motion';

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
    if (p && p.catch) p.catch(() => {});
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

// Showcase-grid clip: autoplays muted + looping while scrolled into view, with a
// SINGLE mute/unmute control — no play/scrub/fullscreen/menu chrome. Visibility-gated
// so we never run all 8 decodes at once off-screen.
function ShowcaseVideo({ src, className }) {
  const ref = useRef(null);
  const [muted, setMuted] = useState(true);
  useEffect(() => {
    const v = ref.current;
    if (!v) return undefined;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { v.play?.().catch(() => {}); } else { v.pause?.(); } },
      { threshold: 0.25 }
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);
  const toggleMute = (e) => {
    e.stopPropagation();
    const v = ref.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
    if (!v.muted) v.play?.().catch(() => {});
  };
  return (
    <div className="lp-vcard__videowrap">
      <video
        ref={ref}
        className={className}
        src={src}
        muted
        loop
        autoPlay
        playsInline
        preload="metadata"
      />
      <button
        type="button"
        className="lp-vcard__mute"
        onClick={toggleMute}
        aria-label={muted ? 'Unmute' : 'Mute'}
      >
        {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
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

// "US vs Others" — two-column comparison (us vs marketplaces).
// Each side is a bold title + a supporting line (comparison-table style).
const vsRows = [
  {
    label: 'Creator Vetting',
    us:   { title: 'Manually reviewed', desc: 'Every creator is vetted before they touch a brief' },
    them: { title: 'Open sign-up', desc: 'Anyone can apply — no real vetting' },
  },
  {
    label: 'Payment Safety',
    us:   { title: 'Held in escrow', desc: 'Funds are held by the platform until you approve the work' },
    them: { title: 'Pay upfront', desc: 'Pay in advance or chase refunds if it goes wrong' },
  },
  {
    label: 'Contact Protection',
    us:   { title: 'On-platform only', desc: 'Names and contacts stay protected inside UGCad.io' },
    them: { title: 'Easily poached', desc: 'Creators taken off-platform after the first deal' },
  },
  {
    label: 'Delivery Speed',
    us:   { title: 'Under 10 days', desc: 'Tracked delivery, milestone by milestone' },
    them: { title: '4–6 weeks', desc: 'Long agency timelines and endless back-and-forth' },
  },
  {
    label: 'Cost',
    us:   { title: 'Commission only', desc: 'No retainers, no hidden markups' },
    them: { title: '3–5× markup', desc: 'Agency markup plus a monthly retainer' },
  },
  {
    label: 'Content Rights',
    us:   { title: 'Full usage rights', desc: 'You own the content you pay for' },
    them: { title: 'Limited / unclear', desc: 'Rights often restricted or cost extra' },
  },
  {
    label: 'Support',
    us:   { title: 'Managed disputes', desc: 'The platform mediates if anything goes wrong' },
    them: { title: 'On your own', desc: 'No mediation when a deal falls apart' },
  },
];

// "What you can achieve" — cards scroll over a big sticky headline (alternating sides).
// Copy is easy to swap; edit titles/descs here.
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

// Sixteen showcase video slots — local UGC clips from /public/home.
const showcaseVideos = [
  { id: 1, industryId: 'apps',    label: 'Apps/Software',    isVideo: true,
    src: '/ma/video_03.mp4',
    brand: 'Color By Number', creator: 'Abigail', logoBg: 'linear-gradient(135deg, #3A3A66, #fb923c)', logoText: 'CN', tier: 'RISING', rating: 4.8 },
  { id: 2, industryId: 'apps',    label: 'Apps/Software',    isVideo: true,
    src: '/ma/video_04.mp4',
    brand: 'Gener8',          creator: 'Chelsea', logoBg: 'linear-gradient(135deg, #1F1F4E, #07074e)', logoText: '8', tier: 'PRO', rating: 4.9 },
  { id: 3, industryId: 'family',  label: 'Family/Kids',      isVideo: true,
    src: '/ma/video_05.mp4',
    brand: 'Gatorade',        creator: 'Becki',   logoBg: 'linear-gradient(135deg, #fb923c, #f59e0b)', logoText: 'G', tier: 'ELITE', rating: 5.0 },
  { id: 4, industryId: 'beauty',  label: 'Beauty/Cosmetics', isVideo: true,
    src: '/home/video_06.mp4',
    brand: 'Glowly',          creator: 'Maya',    logoBg: 'linear-gradient(135deg, #fb7185, #f43f5e)', logoText: 'Gl', tier: 'PRO', rating: 4.7 },
  { id: 5, industryId: 'beauty',  label: 'Beauty/Cosmetics', isVideo: true,
    src: '/home/video_07.mp4',
    brand: 'Thix Hair',       creator: 'Lara',    logoBg: 'linear-gradient(135deg, #34d399, #14b8a6)', logoText: 'T', tier: 'ELITE', rating: 4.9 },
  { id: 6, industryId: 'beauty',  label: 'Beauty/Cosmetics', isVideo: true,
    src: '/home/video_10.mp4',
    brand: 'AirShine',        creator: 'Priya',   logoBg: 'linear-gradient(135deg, #1F1F4E, #1F1F4E)', logoText: 'A', tier: 'RISING', rating: 4.8 },
  { id: 7, industryId: 'pets',    label: 'Pets',             isVideo: true,
    src: '/home/video_13.mp4',
    brand: 'Pawfect',         creator: 'Riya',    logoBg: 'linear-gradient(135deg, #1F1F4E, #a855f7)', logoText: 'Pf', tier: 'ELITE', rating: 4.9 },
  { id: 8, industryId: 'food',    label: 'Food/Beverage',    isVideo: true,
    src: '/home/video_15.mp4',
    brand: 'BrewHaus',        creator: 'Sofia',   logoBg: 'linear-gradient(135deg, #78350f, #f59e0b)', logoText: 'BH', tier: 'PRO', rating: 4.8 },
  { id: 9, industryId: 'fitness', label: 'Fitness/Supplements', isVideo: true,
    src: '/home/video_16.mp4',
    brand: 'FitFuel',         creator: 'Noah',    logoBg: 'linear-gradient(135deg, #14532d, #22c55e)', logoText: 'FF', tier: 'RISING', rating: 4.7 },
  { id: 10, industryId: 'health', label: 'Health/Wellness',  isVideo: true,
    src: '/home/video_19.mp4',
    brand: 'VitaGlow',        creator: 'Emma',    logoBg: 'linear-gradient(135deg, #0e7490, #06b6d4)', logoText: 'VG', tier: 'ELITE', rating: 5.0 },
  { id: 11, industryId: 'travel', label: 'Travel',           isVideo: true,
    src: '/home/video_21.mp4',
    brand: 'NomadPack',       creator: 'Liam',    logoBg: 'linear-gradient(135deg, #1e3a8a, #3b82f6)', logoText: 'NP', tier: 'PRO', rating: 4.8 },
  { id: 12, industryId: 'finance', label: 'Finance/Insurance', isVideo: true,
    src: '/home/video_22.mp4',
    brand: 'CoinKeep',        creator: 'Ava',     logoBg: 'linear-gradient(135deg, #3A3A66, #fbbf24)', logoText: 'CK', tier: 'RISING', rating: 4.7 },
  { id: 13, industryId: 'home',   label: 'Home/Household',   isVideo: true,
    src: '/home/video_23.mp4',
    brand: 'NestHome',        creator: 'Olivia',  logoBg: 'linear-gradient(135deg, #7c2d12, #fb7185)', logoText: 'NH', tier: 'PRO', rating: 4.9 },
  { id: 14, industryId: 'gaming', label: 'Gaming',           isVideo: true,
    src: '/home/video_24.mp4',
    brand: 'PlayVerse',       creator: 'Ethan',   logoBg: 'linear-gradient(135deg, #4c1d95, #8b5cf6)', logoText: 'PV', tier: 'ELITE', rating: 4.8 },
  { id: 15, industryId: 'charity', label: 'Charity',         isVideo: true,
    src: '/home/video_25.mp4',
    brand: 'CareCircle',      creator: 'Mia',     logoBg: 'linear-gradient(135deg, #831843, #ec4899)', logoText: 'CC', tier: 'RISING', rating: 4.9 },
  { id: 16, industryId: 'services', label: 'Consumer Services', isVideo: true,
    src: '/home/video_26.mp4',
    brand: 'SwiftServe',      creator: 'Lucas',   logoBg: 'linear-gradient(135deg, #1F1F4E, #0ea5e9)', logoText: 'SS', tier: 'PRO', rating: 4.7 },
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

// Audit deck entrance — cards stagger in one by one AFTER the heading/subtitle.
// Only opacity/scale animate here; x/y/rotate stay driven by the scroll-linked
// peel motion values in `style`, so the two systems don't fight over the same prop.
const auditCardVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: 0.35 + i * 0.18, duration: 0.5, ease: 'easeOut' },
  }),
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
// Desktop: fanned, side-by-side cards with hover lift.
function AchieveFan({ items }) {
  // Editorial vertical list (no cards): big serif number + kicker, divider, heading,
  // description, footer tag. Rows alternate left/right like the reference.
  const shown = items.slice(0, 4); // 4 items, staircased into a slant
  return (
    <div className="lp-achieve__list">
      {shown.map((item, i) => (
        <motion.div
          key={item.title}
          className="lp-achieve__row"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="lp-achieve__col" style={{ marginLeft: `${(i / (shown.length - 1)) * 70}%` }}>
            <div className="lp-achieve__num">
              <span className="lp-achieve__num-i">{`0${i + 1}`}</span> {item.kicker}
            </div>
            <div className="lp-achieve__rule" />
            <h3 className="lp-achieve__h">{String(item.title).replace(/\n/g, ' ')}</h3>
            <p className="lp-achieve__p">{item.desc}</p>
            {item.tag && <div className="lp-achieve__tag">{item.tag}</div>}
          </div>
        </motion.div>
      ))}
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
  const [scrolled, setScrolled] = useState(false);
  const [navHidden, setNavHidden] = useState(false);   // hide nav on scroll-down, reveal on scroll-up
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedIndustry, setSelectedIndustry] = useState(null);
  const [faqOpen, setFaqOpen] = useState(-1);
  // Proof stat carousel (MOBILE): the section pins while you scroll, and page-scroll progress
  // slides the stats 01 → 02 → 03 (track translateX) and moves the active dot. Then the pin
  // releases and the page continues. Desktop ignores this (it shows the static grid).
  const proofSectionRef = useRef(null);
  const proofDotsRef = useRef(null);
  const [proofActive, setProofActive] = useState(0); // which stat the big-number card shows
  const proofIdxRef = useRef(0);
  const { scrollYProgress: proofScroll } = useScroll({
    target: proofSectionRef,
    offset: ['start start', 'end end'],
  });
  // Slide one full item-width per stat across the pinned runway (with small dead-zones at the
  // ends so the first/last stat sits still briefly before/after the cycle).
  const proofTrackX = useTransform(
    proofScroll,
    [0.08, 0.92],
    ['0%', `-${(stats.length - 1) * 100}%`]
  );
  // Move the active dot via DIRECT DOM (no setState) so the 1→2→3 slide never triggers a React
  // re-render of this huge component mid-transition — that re-render was the lag/hitch.
  useMotionValueEvent(proofScroll, 'change', (v) => {
    const idx = Math.round(Math.min(1, Math.max(0, v)) * (stats.length - 1));
    if (idx === proofIdxRef.current) return;
    proofIdxRef.current = idx;
    const dots = proofDotsRef.current && proofDotsRef.current.children;
    if (dots) {
      for (let i = 0; i < dots.length; i++) {
        dots[i].classList.toggle('lp-proof__dot--active', i === idx);
      }
    }
  });

  // Testimonial "spotlight" carousel — one active card centered in the viewport, its
  // neighbours dimmed and clipped at the viewport edges. An avatar (or an arrow) jumps
  // straight to any testimonial by index — no infinite window/looping to manage.
  const T_LEN = testimonials.length;
  const T_GAP = 24; // must match the flex gap in .lp-testimonial__grid CSS
  const tViewportRef = useRef(null);
  const [tViewportW, setTViewportW] = useState(0);
  const [tActive, setTActive] = useState(0);

  useLayoutEffect(() => {
    const el = tViewportRef.current;
    if (!el) return;
    const measure = () => setTViewportW(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The active card shrinks as a share of the viewport on narrower screens, so its
  // dimmed neighbours keep peeking in at the edges instead of vanishing entirely.
  const tCardW = tViewportW
    ? tViewportW * (tViewportW <= 640 ? 0.86 : tViewportW <= 900 ? 0.74 : 0.56)
    : 0;
  const tPitch = tCardW + T_GAP;
  const tOffset = tViewportW ? (tViewportW - tCardW) / 2 - tActive * tPitch : 0;

  const goToTestimonial = (i) => setTActive(((i % T_LEN) + T_LEN) % T_LEN);

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

  // Audit cards — scroll-linked peel-away animation
  const auditRef = useRef(null);
  // One-shot entrance: heading/subtitle fade up first, then the Q1/Q2/Q3 cards stagger in
  // one by one (opacity/scale only — x/y/rotate stay driven by the peel scroll values below).
  const auditInView = useInView(auditRef, { once: true, margin: '-100px' });
  const { scrollYProgress: auditProgress } = useScroll({
    target: auditRef,
    offset: ['start start', 'end end'],
  });
  // "Find & Hire" achieve section scroll — used (mobile) to lift the pinned heading UP in sync
  // with the card deck as it scrolls off, so the heading leaves WITH the cards instead of staying
  // pinned until the whole deck is gone. y holds at 0 while the deck stacks (heading pinned via
  // CSS sticky), then ramps up over the exit window so heading + cards clear the screen together.
  const achieveRef = useRef(null);
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
  // These desktop glide-springs run a per-frame rAF physics loop while their source moves.
  // On mobile the cards use the raw mAudit* transforms below instead, so freeze the spring
  // sources to a constant (output [0,0]) when heroStatic — otherwise three idle springs
  // would still animate during the exact scroll window the deck assembles, stealing frames
  // and stuttering Q2/Q3 as they rise.
  const card2Y = useSpring(useTransform(auditProgress, heroStatic ? [0, 1] : [0.04, 0.33], heroStatic ? [0, 0] : [0, -800], { ease: easeInOut }), PEEL_SPRING);
  const card3Y = useSpring(useTransform(auditProgress, heroStatic ? [0, 1] : [0.36, 0.65], heroStatic ? [0, 0] : [35, -800], { ease: easeInOut }), PEEL_SPRING);
  const card1Y = useSpring(useTransform(auditProgress, heroStatic ? [0, 1] : [0.68, 0.99], heroStatic ? [0, 0] : [-35, -800], { ease: easeInOut }), PEEL_SPRING);
  // Mobile assemble — bound DIRECTLY to scroll (NO spring). On a phone the soft PEEL_SPRING
  // made the cards trail the finger and keep drifting/settling after the scroll stopped; that
  // overshoot + trailing is what read as "lag", and the spring also runs an extra rAF loop on
  // the main thread every frame you scroll. A raw useTransform is a pure function of scroll
  // position (still eased across each range), so the cards move exactly in step with the scroll
  // — responsive, smooth, and they never drift or stutter. Desktop keeps its glide springs.
  // Mobile PEEL (web-like): all three cards start STACKED together (y = 0) and then fly UP off the
  // top one-by-one as you scroll — Q1 first, Q2, then Q3 last — mirroring the desktop peel. Raw
  // useTransform (no spring) so they track the finger exactly without drift/lag on phones.
  // Peel spans the FULL runway (last card finishes at ~0.99, right as the section unpins) so a card
  // is always moving — no dead stretch where you scroll but nothing happens before the next section.
  const mAuditQ1Y = useTransform(auditProgress, [0.05, 0.36], [0, -760], { ease: easeInOut });
  const mAuditQ2Y = useTransform(auditProgress, [0.36, 0.67], [0, -760], { ease: easeInOut });
  const mAuditQ3Y = useTransform(auditProgress, [0.67, 0.99], [0, -760], { ease: easeInOut });
  // The next section (Find & Hire) is pulled UP in lockstep with the last card's peel:
  // while Q3 rises [0.68 → 0.99], the section slides up from below (700px → 0) so it's
  // "stuck" to the card — as the card goes above, the section is dragged up into view
  // behind it. easeInOut + a spring smooth the motion so it glides in, not snaps to scroll.
  // (Desktop only — on mobile this drag is disabled in CSS, and the JSX below drops the
  // motion value entirely so framer isn't writing transforms to a big subtree every frame.)
  const achieveRiseRaw = useTransform(auditProgress, [0.66, 1.0], [700, 0], { ease: easeInOut });
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
  const brandRise = -260;                 // mobile lift; 0 on desktop (no structural shift)
  const brandRiseRaw = useTransform(
    logo3dProgress,
    heroStatic ? [0.45, 0.7] : [0.62, 0.72],
    heroStatic ? [0, brandRise] : [380, 0],
    heroStatic ? undefined : { ease: easeInOut }
  );
  const brandRiseY = useSpring(
    brandRiseRaw,
    heroStatic ? { stiffness: 240, damping: 32, mass: 0.35 } : { stiffness: 120, damping: 22, mass: 0.6 }
  );
  // On MOBILE drive the board + brand strip DIRECTLY off scroll (the *Raw values), not the
  // spring outputs. A spring trails the finger and keeps drifting/settling after the scroll
  // stops — that's the "lag" on a phone — and each spring also runs its own rAF loop every
  // scroll frame on top of the WebGL logo + 11 leaderboard rows. The raw useTransform tracks
  // scroll 1:1 (still eased) → these big containers move exactly with the scroll, buttery and
  // lag-free. Desktop keeps the springs (it has the GPU headroom and the glide is intentional).
  const boardRiseYUsed = heroStatic ? boardRiseRaw : boardRiseY;
  const brandRiseYUsed = heroStatic ? brandRiseRaw : brandRiseY;
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
    <div className={`lp-root${IS_LOW_END ? ' lp-perf-lite' : ''}`} data-theme="light">

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
            <span className="lp-navbar__brand-a">UGC</span><span className="lp-navbar__brand-b">ad.io</span>
          </button>

          <nav className="lp-navbar__links">
            <a className="lp-navlink" href="#" onClick={(e) => { e.preventDefault(); navigate('/auth?mode=signup&role=business'); }}>
              Explore Creators
            </a>
            <a className="lp-navlink" href="/creator" onClick={(e) => { e.preventDefault(); navigate('/creator'); }}>
              Join as Creator
            </a>
          </nav>

          <div className="lp-navbar__actions">
            <button className="lp-btn-signup" onClick={() => navigate('/auth?mode=signup&role=business')}>
              Sign Up
            </button>
            <button className="lp-btn-login" onClick={() => navigate('/auth?role=business')}>
              <LogIn size={16} /> Log in
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
          Join over 100,000 happy creators
        </motion.span>

        <motion.h1
          className="nlp-title"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.05 }}
        >
          Engage Audiences
          <br />
          with <span className="nlp-title-accent">Stunning Videos</span>
        </motion.h1>

        <motion.p
          className="nlp-sub"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.12 }}
        >
          Boost your brand with high-impact short videos from our expert content
          creators. Our team is ready to propel your business forward.
        </motion.p>

        {/* handwritten annotations (desktop only) */}
        <span className="nlp-note nlp-note--elevate" aria-hidden="true">
          Elevate<br />your brand
          <svg viewBox="0 0 80 60" className="nlp-note-arrow"><path d="M6,6 C50,0 74,20 66,52" fill="none" stroke="#3a3a3a" strokeWidth="2.4" strokeLinecap="round"/><path d="M56,44 L66,54 L74,42" fill="none" stroke="#3a3a3a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </span>

        <div className="nlp-gallery">
          {showcaseVideos.slice(0, 7).map((v, i) => (
            <figure
              className="nlp-card"
              key={v.id}
              style={{ transform: `translateY(${Math.abs(i - 3) * 22}px) rotate(${(i - 3) * 1.4}deg)` }}
            >
              <img src={cldPoster(v.src)} alt="" loading="lazy" />
            </figure>
          ))}
        </div>

        <div className="nlp-cta-wrap">
          <span className="nlp-note nlp-note--free" aria-hidden="true">
            It's free
            <svg viewBox="0 0 70 40" className="nlp-note-arrow2"><path d="M4,10 C24,34 44,34 60,18" fill="none" stroke="#3a3a3a" strokeWidth="2.4" strokeLinecap="round"/><path d="M50,22 L61,17 L58,29" fill="none" stroke="#3a3a3a" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </span>
          <button
            className="nlp-cta"
            onClick={() => navigate('/auth?mode=signup&role=business')}
            data-testid="get-started-btn"
          >
            Get Started
          </button>
        </div>
      </section>

      {/* ── 3D glass logo (left) + center copy — scroll-driven ──────────────── */}
      <section className={`lp-logo3d${logo3dInView ? ' is-in' : ''}`} ref={logo3dRef}>
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
          <motion.div className="lp-logo3d__board" style={{ opacity: logoBoardOpacity, y: boardRiseYUsed }}>
            <div className="lp-logo3d__boardTrack">
              {TOP_CREATORS.map((c, i) => (
                <LeaderboardRow
                  key={c}
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

      {/* ── Brand strip — stuck to the leaderboard's last row: rises UP in lockstep
          (brandRiseY) as the final rows fade, instead of waiting below. ── */}
      <motion.div style={{ y: brandRiseYUsed, marginBottom: heroStatic ? brandRise : 0, position: 'relative', zIndex: 3 }}>
      <section className="lp-brandstrip" ref={brandStripRef}>
        <div className="lp-hero__strip">
          <span className="lp-brandstrip__label">Trusted by leading brands</span>
          <div className="lp-brands__viewport">
            <div className="lp-brands__track lp-brands__track--single">
              {(() => {
                // Full brand set from /public/brand (encodeURI handles the spaces in filenames).
                const brands = [
                  'Rapido-logo.png',
                  'amazon-icon-logo-png_seeklogo-405254.png',
                  'images (1).png',
                  'images (2).png',
                  'images (3).png',
                  'images (4).png',
                  'images (5).png',
                  'images (6).png',
                  'logo-1-scaled.jpg',
                  'images (7).png',
                  'images (8).png',
                  'images (1).jpg',
                  'images (2).jpg',
                  'images (3).jpg',
                  'images (4).jpg',
                  'images.png',
                ];
                // One duplicate of the whole set → a seamless -50% loop.
                return [...brands, ...brands];
              })().map((file, i) => (
                <div key={`B-${i}`} className="lp-brand-item">
                  <div className="lp-brand-item__icon">
                    <img
                      src={encodeURI(`/brand/${file}`)}
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
            We create the{' '}
            <span className="lp-showcase__heading--accent">best UGC</span>{' '}
            on the internet
          </h2>
          <p className="lp-showcase__subtitle">Choose your industry to see examples!</p>

          {/* Industry filter pills — clicking one narrows the grid to that industry.
              A second click (or Reset) clears the filter back to all.
              Only the first 9 industries are shown, laid out as two rows: 5 on the
              first, then 4 + Reset on the second. The full-width spacer forces the
              wrap after the 5th pill regardless of each pill's text width. */}
          <div className="lp-showcase__filters">
            {industries.slice(0, 9).map((ind, i) => {
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

          {/* Responsive grid of example clips. Each is a native <video> with controls so a
              visitor can play/mute/fullscreen it right there, exactly like the reference.
              preload="metadata" + the #t=0.1 hash seek to the first frame as a poster, so
              nothing downloads the full clip until the visitor actually presses play. */}
          <div className="lp-showcase__grid">
            {/* Only ever show 2 rows of 4 (8 clips). "Load more" doesn't paginate —
                it sends the visitor to the sign-up form to see the rest. */}
            {(visibleShowcase.length ? visibleShowcase : showcaseVideos).slice(0, 8).map((v) => (
              <article key={v.id} className="lp-vcard">
                <div className="lp-vcard__media">
                  <span className="lp-vcard__tag">{v.label}</span>
                  {v.isVideo ? (
                    <ShowcaseVideo className="lp-vcard__video" src={v.src} />
                  ) : (
                    <img className="lp-vcard__video" src={v.src} alt={v.brand} loading="lazy" />
                  )}
                </div>
                <div className="lp-vcard__meta">
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
                  <span className={`lp-vcard__tier lp-vcard__tier--${v.tier.toLowerCase()}`}>
                    {v.tier.charAt(0) + v.tier.slice(1).toLowerCase()}
                  </span>
                </div>
              </article>
            ))}
          </div>

          {visibleShowcase.length === 0 && (
            <p className="lp-showcase__empty">No examples in this industry yet — try another.</p>
          )}

          {/* Load more: not real pagination — it routes to the sign-up form so a visitor
              creates an account to browse the full library. */}
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
          <motion.span
            className="lp-audit__pill"
            variants={fadeUpVariants}
            initial="hidden"
            animate={auditInView ? 'visible' : 'hidden'}
          >
            <HelpCircle size={14} />
            Quick reality check
          </motion.span>

          <motion.h2
            className="lp-audit__heading"
            variants={fadeUpVariants}
            initial="hidden"
            animate={auditInView ? 'visible' : 'hidden'}
            transition={{ delay: 0.1 }}
          >
            Answer This{' '}
            <span className="lp-audit__heading--accent">Honestly</span>.
          </motion.h2>
          <motion.p
            className="lp-audit__subtitle"
            variants={fadeUpVariants}
            initial="hidden"
            animate={auditInView ? 'visible' : 'hidden'}
            transition={{ delay: 0.2 }}
          >
            Three questions most brands avoid. The answers usually explain everything.
          </motion.p>

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
                  variants={auditCardVariants}
                  custom={i}
                  initial="hidden"
                  animate={auditInView ? 'visible' : 'hidden'}
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

      {/* ── Find & Hire Creators — fanned cards. Dragged UP by achieveRiseY in lockstep
          with Q3's peel, so it rises into view "stuck" to the last audit card. (No
          opacity gate — the rise alone gives the effect and can't hide the section.)
          On mobile the drag is disabled (CSS sets transform:none !important), so we drop
          the motion value here too — otherwise framer would still write a transform to this
          large subtree on every scroll frame for no visual effect, hurting scroll perf. ── */}
      <motion.div
        className="lp-achieve-rise"
        style={
          heroStatic
            ? // Mobile: NO transform here — the section contains position:sticky cards (and a
              // sticky heading), and a transformed ancestor breaks sticky (cards mispositioned /
              // overlapping the heading). Instead a LARGE STATIC negative margin parks the section
              // just below the fold while the audit cards are stacked, so as they peel up it rides
              // up into view WITH them via natural scroll — no transform, sticky stays intact.
              { marginTop: -250, position: 'relative', zIndex: 4 }
            : { y: achieveRiseY, marginTop: -300, position: 'relative', zIndex: 4 }
        }
      >
        <section className="lp-achieve" ref={achieveRef}>
          <motion.h2 className="lp-achieve__title">
            <em className="lp-achieve__hl">Find</em> &amp; Hire <em className="lp-achieve__hl lp-achieve__word lp-achieve__word--creators">Creators</em> <em className="lp-achieve__word lp-achieve__word--instantly">Instantly</em>
          </motion.h2>
          <AchieveFan items={achieveItems} />
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
      {/* Comparison table — editorial "Evolve"-style: cream bg, serif heading, a
          highlighted centre column for UGCad.io vs a plain "traditional" column. */}
      <section className="lpv">
        <div className="lpv-inner">
          <p className="lpv-kicker">Why UGCad.io?</p>
          <h2 className="lpv-heading">Vetted creators. Protected payments.</h2>

          <div className="lpv-grid">
            {/* header row */}
            <div className="lpv-header">
              <div className="lpv-h lpv-h--label" />
              <div className="lpv-h lpv-h--us"><span className="lpv-brand">UGC<span className="lpv-brand-ad">ad.io</span></span></div>
              <div className="lpv-h lpv-h--them">Traditional Agencies &amp; Marketplaces</div>
            </div>

            {vsRows.map((r) => (
              <div className="lpv-rowgroup" key={r.label}>
                <div className="lpv-label">{r.label}</div>
                <div className="lpv-cell lpv-cell--us">
                  <em className="lpv-tag">UGCad.io</em>
                  <strong>{r.us.title}</strong>
                  <span>{r.us.desc}</span>
                </div>
                <div className="lpv-cell lpv-cell--them">
                  <em className="lpv-tag">Traditional</em>
                  <strong>{r.them.title}</strong>
                  <span>{r.them.desc}</span>
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
      <section className="lp-proof" ref={proofSectionRef}>
        <div className="lp-proof__inner lpr">
          {/* Editorial pull-quote */}
          <p className="lpr-kicker">Don&apos;t take our word for it</p>
          <blockquote className="lpr-quote">
            &ldquo;We stopped guessing which creators actually convert. UGCad.io made
            it <em>obvious.</em>&rdquo;
          </blockquote>

          {/* The receipts — big numbers with a thin rule above each */}
          <p className="lpr-kicker lpr-kicker--receipts">The receipts</p>
          <div className="lpr-stats">
            {stats.map((s) => (
              <div className="lpr-stat" key={s.label}>
                <span className="lpr-stat__value"><CountUp value={s.value} /></span>
                <span className="lpr-stat__label">{s.label}</span>
              </div>
            ))}
          </div>
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

          {/* Avatar picker — click a face to jump the spotlight card below straight to their story. */}
          <div className="lp-testimonial__trustbar">
            <span className="lp-testimonial__trustbar-label">Trusted by:</span>
            <div className="lp-testimonial__avatars">
              {testimonials.map((t, i) => (
                <button
                  type="button"
                  key={t.name}
                  className={`lp-testimonial__avatar${i === tActive ? ' is-active' : ''}`}
                  onClick={() => goToTestimonial(i)}
                  aria-label={`Show ${t.name}'s story`}
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
                  {i === tActive && (
                    <span className="lp-testimonial__avatar-tip">{t.name}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="lp-testimonial__carousel">
            <button
              type="button"
              className="lp-testimonial__arrow lp-testimonial__arrow--left"
              onClick={() => goToTestimonial(tActive - 1)}
              aria-label="Previous testimonial"
            >
              <ChevronLeft size={22} />
            </button>

            <div className="lp-testimonial__viewport" ref={tViewportRef}>
              <div
                className="lp-testimonial__grid"
                style={{ transform: `translateX(${tOffset}px)` }}
              >
                {testimonials.map((t, i) => {
                  const [before, after] = t.accent && t.quote.includes(t.accent)
                    ? [t.quote.split(t.accent)[0], t.quote.split(t.accent)[1]]
                    : [t.quote, ''];
                  const isActive = i === tActive;
                  return (
                    <article
                      key={t.name}
                      style={{ flex: `0 0 ${tCardW}px` }}
                      className={`lp-tcard lp-tcard--spot${isActive ? ' is-active' : ''}`}
                      onClick={() => !isActive && goToTestimonial(i)}
                    >
                      {isActive && (
                        <>
                          <span className="lp-tcard__corner lp-tcard__corner--tl" aria-hidden="true" />
                          <span className="lp-tcard__corner lp-tcard__corner--tr" aria-hidden="true" />
                          <span className="lp-tcard__corner lp-tcard__corner--bl" aria-hidden="true" />
                          <span className="lp-tcard__corner lp-tcard__corner--br" aria-hidden="true" />
                        </>
                      )}
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
            </div>

            <button
              type="button"
              className="lp-testimonial__arrow lp-testimonial__arrow--right"
              onClick={() => goToTestimonial(tActive + 1)}
              aria-label="Next testimonial"
            >
              <ChevronRight size={22} />
            </button>
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
          --lp-purple-50:  rgba(var(--lp-fg),0.06);
          --lp-purple-100: rgba(var(--lp-fg),0.08);
          --lp-purple-200: #BBBBC8;
          --lp-purple-300: #8888A0;
          --lp-purple-500: #3A3A66;
          --lp-purple-600: #1F1F4E;
          --lp-purple-700: #7387FF;
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
          /* ── ONE content container width for every section, so content edges
                line up vertically down the whole page (equal L/R gutters). ──── */
          --lp-maxw: 1200px;
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
          --lp-page-bg: #f6f1e6;        /* cream (matches the hero) */
          --lp-text: #1c1b4b;
          --lp-bg: #f6f1e6;
          --lp-bg-soft: #fbf8f0;
          --lp-text-muted: rgba(28,27,75,0.66);
          --lp-text-soft: #5b5a7e;
          --lp-section: #fbf8f0;        /* off-white/cream card surface, matches --lp-bg-soft */
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
          padding: 0 8%;
          transition: top 0.3s ease;
        }
        /* Slides fully off the top when scrolling down; returns on scroll-up. */
        .lp-navbar--hidden { top: -110px; }
        /* Top mask: a page-bg gradient that sits BEHIND the nav links but ABOVE the
           scrolling page content, so hero copy (and anything else) fades out and
           disappears at the navbar line instead of showing through / overlapping it. */
        .lp-navbar::before {
          content: '';
          position: absolute;
          top: -20px;            /* navbar sits at top:20px → reach the viewport top */
          left: 0;
          right: 0;
          height: 124px;
          background: linear-gradient(180deg,
            var(--lp-page-bg) 0%,
            var(--lp-page-bg) 68%,
            transparent 100%);
          z-index: -1;           /* behind the links, in front of page content */
          pointer-events: none;
        }

        .lp-navbar__inner {
          display: flex;
          align-items: center;
          gap: 0;                        /* no parent gap — the right group owns all spacing */
          max-width: var(--lp-maxw);
          margin: 0 auto;
          background: transparent;       /* no white container */
          height: 60px;
          padding: 0 4px;
        }

        /* Text wordmark logo (icon removed) — small, left-aligned, brand colours. */
        .lp-navbar__brand {
          flex: none;
          display: inline-flex;
          align-items: baseline;
          padding: 0;
          border: none;
          background: transparent;
          cursor: pointer;
          font-family: var(--font-head), 'Readex Pro', sans-serif;
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

        /* Nav links — grouped on the RIGHT (shifted over from the left). */
        .lp-navbar__links {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 30px;
        }
        .lp-root .lp-navlink {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-body);
          font-size: 0.95rem;
          font-weight: 500;
          color: rgba(var(--lp-fg), 0.88);
          text-decoration: none;
          cursor: pointer;
          transition: color 0.2s ease, opacity 0.2s ease;
        }
        .lp-root .lp-navlink:hover { color: #ffffff; }
        .lp-navlink svg { color: rgba(var(--lp-fg), 0.6); }
        /* On the cream bar, white-on-hover is invisible — dim via opacity instead. */
        .lp-root .lp-navbar__links .lp-navlink:hover { color: inherit; opacity: 0.55; }

        .lp-navbar__actions {
          margin-left: 30px;   /* = inter-link gap; parent gap is 0, so every gap is 30px */
          display: flex;
          gap: 30px;
          align-items: center;
        }

        /* Log in — the single solid pill CTA in the bar. */
        .lp-root .lp-btn-login {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 10px 22px;
          border-radius: 999px;
          border: 1px solid #7387FF;
          background: #7387FF;
          color: #fff;
          font-family: var(--font-body);
          font-weight: 600;
          font-size: 0.92rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .lp-root .lp-btn-login:hover { background: #5c6cff; border-color: #5c6cff; }

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

        /* Sign Up — plain text link now (button removed; only Log in is a button). */
        .lp-root .lp-btn-signup {
          padding: 8px 4px;
          border: none;
          background: transparent;
          color: rgba(var(--lp-fg), 0.88);
          font-family: var(--font-body);
          font-weight: 500;
          font-size: 0.95rem;
          cursor: pointer;
          border-radius: 999px;
          transition: opacity 0.2s ease;
        }
        .lp-root .lp-btn-signup:hover { opacity: 0.55; background: transparent; }

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
        .lp-logo-fly { display: none !important; }
        .nlp-hero {
          position: relative; z-index: 3; isolation: isolate;
          background: #f6f1e6;
          padding: 132px 24px 96px;
          text-align: center; overflow: hidden;
        }
        .nlp-badge {
          display: inline-block; background: #f7d49b; color: #7a4711;
          font-weight: 700; font-size: 13.5px; letter-spacing: .1px;
          padding: 8px 22px; border-radius: 999px; margin: 0 auto 26px;
          font-family: var(--font-body, 'Inter', sans-serif);
        }
        .nlp-title {
          margin: 0 auto; max-width: 980px;
          font-family: var(--font-head, 'Plus Jakarta Sans', sans-serif);
          font-weight: 800; letter-spacing: -2px; line-height: 1.02; color: #171717;
          font-size: clamp(40px, 7.2vw, 84px);
        }
        .nlp-title-accent { color: #171717; }
        .nlp-sub {
          max-width: 560px; margin: 22px auto 0; color: #5a5a5a;
          font-size: 17px; line-height: 1.6;
          font-family: var(--font-body, 'Inter', sans-serif);
        }
        .nlp-gallery {
          display: flex; justify-content: center; align-items: flex-start;
          gap: 16px; margin: 46px auto 0; max-width: 1180px;
        }
        .nlp-card {
          flex: 0 0 148px; margin: 0; border-radius: 22px; overflow: hidden;
          aspect-ratio: 9 / 14; background: #e7e0d2;
          box-shadow: 0 26px 50px -22px rgba(30, 22, 8, .45);
        }
        .nlp-card img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .nlp-cta-wrap { position: relative; display: inline-flex; margin-top: 40px; }
        .nlp-cta {
          background: #ef6a4c; color: #fff; border: none; border-radius: 999px;
          padding: 15px 42px; font-weight: 700; font-size: 16px; cursor: pointer;
          font-family: var(--font-body, 'Inter', sans-serif);
          box-shadow: 0 18px 34px -14px rgba(239, 106, 76, .75);
          transition: transform .18s ease, box-shadow .18s ease;
        }
        .nlp-cta:hover { transform: translateY(-2px); box-shadow: 0 22px 40px -14px rgba(239, 106, 76, .8); }
        /* Handwritten annotations */
        .nlp-note {
          position: absolute; font-family: 'Bradley Hand', 'Segoe Script', 'Comic Sans MS', cursive;
          color: #3a3a3a; font-size: 21px; line-height: 1.15; font-weight: 600; pointer-events: none;
        }
        .nlp-note--elevate { top: 210px; right: max(40px, calc(50vw - 560px)); text-align: left; transform: rotate(6deg); }
        .nlp-note--elevate .nlp-note-arrow { position: absolute; left: -6px; top: 46px; width: 66px; height: 52px; }
        .nlp-note--free { position: absolute; right: calc(100% + 6px); bottom: 2px; white-space: nowrap; transform: rotate(-8deg); }
        .nlp-note--free .nlp-note-arrow2 { position: absolute; right: -58px; top: 6px; width: 56px; height: 34px; }
        @media (max-width: 900px) {
          .nlp-hero { padding: 108px 16px 72px; }
          .nlp-gallery { overflow-x: auto; justify-content: flex-start; gap: 12px; padding: 6px 4px 10px; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
          .nlp-gallery::-webkit-scrollbar { display: none; }
          .nlp-card { flex: 0 0 118px; transform: none !important; }
          .nlp-note { display: none; }
        }

        /* Cream page + no animated blobs. Sections are NOT hidden — they render
           light via the forced [data-theme="light"] theme. 3D logo mark removed. */
        .lp-root { background: #f6f1e6 !important; }
        .lp-bg-animations { display: none !important; }
        .lp-logo-fly,
        .lp-logo3d__stage,
        .lp-logo3d__placeholder { display: none !important; }

        /* Light header to match the cream hero (was a black mask + white text). */
        .lp-navbar::before {
          background: linear-gradient(180deg, #f6f1e6 0%, #f6f1e6 70%, transparent 100%) !important;
        }
        .lp-root .lp-navlink { color: #2b2b2b !important; }
        .lp-root .lp-navlink:hover { color: #000 !important; }
        .lp-root .lp-nav-join { color: #4452f0 !important; }
        .lp-btn-login { color: #171717 !important; border-color: rgba(0,0,0,0.22) !important; }
        .lp-btn-login:hover { border-color: rgba(0,0,0,0.45) !important; }

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
          padding: 132px 8% 72px;
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
        .lp-hero__title-accent {
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
          /* Pulled up far enough that the strip is already on-screen (just below the
             centred leaderboard text) while the last rows fade — so the scroll-linked
             brandRiseY lift is actually visible as the text rises out. */
          margin-top: -55vh;
          padding: 60px 0;
          /* Match the "Most Ads Fail…" (.lp-hook) section — transparent, so it shows the
             shared animated page background instead of its own radial glow. */
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        /* In the standalone section the strip flows normally (not pinned absolute).
           Single-line marquee: a small label above one continuously-scrolling row. */
        .lp-brandstrip .lp-hero__strip {
          position: relative;
          left: auto;
          bottom: auto;
          padding: 0;
          flex-direction: column;
          align-items: center;
          gap: 26px;
          width: 100%;
        }
        .lp-brandstrip__label {
          font-family: var(--font-body);
          font-size: 0.8rem;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(var(--lp-fg), 0.5);
        }
        /* Single full-bleed viewport with a soft fade on BOTH edges. */
        .lp-brands__viewport {
          width: 100vw;
          max-width: 100vw;
          overflow: hidden;
          -webkit-mask-image: linear-gradient(90deg, transparent 0%, #000 8%, #000 92%, transparent 100%);
                  mask-image: linear-gradient(90deg, transparent 0%, #000 8%, #000 92%, transparent 100%);
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
        .lp-brand-item__icon {
          position: relative;
          width: 64px;
          height: 64px;
          border-radius: 16px;
          overflow: hidden;
          background: transparent;   /* no chip — logo sits flat on the page bg */
          border: none;
          box-shadow: none;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.25s ease;
        }
        .lp-brand-item__icon img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: inherit;
          /* Baked-in white backgrounds blend into the cream page bg so logos float. */
          mix-blend-mode: multiply;
        }
        .lp-brand-item:hover .lp-brand-item__icon {
          transform: translateY(-3px);
        }

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
        /* Light mode: melt the lavender hero into the lavender section, not black. */
        .lp-root[data-theme="light"] .lp-logo3d::before {
          background: linear-gradient(180deg, var(--lp-page-bg) 0%, rgba(236,235,248,0.55) 38%, transparent 100%);
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
          .lp-logo3d { height: 175vh; }
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
          font-family: var(--font-body);
          font-size: 0.82rem;
          font-weight: 500;
          margin-bottom: 18px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.04);
        }
        .lp-problem__pill svg { color: var(--lp-purple-600); }

        .lp-problem__heading {
          font-family: var(--font-head);
          font-size: var(--fs-h1);
          font-weight: var(--fw-head);
          color: var(--lp-ink);
          line-height: 1.15;
          letter-spacing: -0.04em;
          margin: 0 0 16px 0;
          max-width: 900px;
          margin-left: auto;
          margin-right: auto;
        }
        .lp-problem__heading--accent {
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
          font-family: var(--font-head);
          /* vw-scaled so the whole sentence stays on ONE line across widths */
          font-size: var(--fs-h1);
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
        /* "best UGC" reads green on both themes (matches the reference). */
        .lp-showcase__heading--accent {
          color: #22c55e;
          background: none;
          -webkit-text-fill-color: #22c55e;
        }
        /* Light theme: white would vanish on the lavender bg, so keep it readable. */
        .lp-root[data-theme="light"] .lp-showcase__heading { color: var(--lp-ink); }
        .lp-root[data-theme="light"] .lp-showcase__heading--accent {
          color: #16a34a;
          -webkit-text-fill-color: #16a34a;
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
          max-width: 1240px;
          margin-left: auto;
          margin-right: auto;
        }
        /* Full-width flex item: forces a line break so row 1 = 5 pills, row 2 = the rest. */
        .lp-showcase__filters-break {
          flex-basis: 100%;
          height: 0;
        }
        /* On narrow screens the forced 5-up break looks cramped, so let pills wrap naturally. */
        @media (max-width: 720px) {
          .lp-showcase__filters-break { display: none; }
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
          background: var(--lp-ink);
          color: #fff;
          border-color: var(--lp-ink);
          font-weight: 700;
        }
        .lp-filter--reset svg { color: #fff; }
        .lp-filter--reset:hover {
          background: var(--lp-purple-700);
          color: #fff;
          border-color: var(--lp-purple-700);
        }

        /* ── Filterable example grid (replaces the old auto-scroll marquee) ── */
        .lp-showcase__grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 18px;
          max-width: 960px;
          margin: 0 auto;
          text-align: left;
        }
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
        .lp-showcase__more-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 14px 34px;
          border-radius: 100px;
          border: 1px solid var(--lp-border);
          background: var(--lp-ink);
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
          background: var(--lp-purple-700);
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
        .lp-vcard__video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          background: #111;
        }
        /* Autoplay clip wrapper + single mute control (replaces native video chrome). */
        .lp-vcard__videowrap { position: absolute; inset: 0; }
        .lp-vcard__mute {
          position: absolute;
          bottom: 12px;
          right: 12px;
          z-index: 3;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          background: rgba(15, 15, 25, 0.55);
          color: #fff;
          display: grid;
          place-items: center;
          cursor: pointer;
          -webkit-backdrop-filter: blur(4px);
          backdrop-filter: blur(4px);
          transition: background 0.2s ease;
        }
        .lp-vcard__mute:hover { background: rgba(15, 15, 25, 0.82); }
        .lp-vcard__mute svg { color: #fff; }
        /* Category tag, top-right of the clip */
        .lp-vcard__tag {
          position: absolute;
          top: 12px;
          right: 12px;
          z-index: 2;
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
        /* Footer under each clip: now just the star rating (category shows on the clip). */
        .lp-vcard__meta {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 8px;
          padding: 0 2px;
        }
        .lp-vcard__brand {
          font-family: var(--font-head);
          font-size: 1rem;
          font-weight: 700;
          color: var(--lp-ink);
          letter-spacing: -0.02em;
          line-height: 1.2;
        }
        .lp-vcard__by {
          font-family: var(--font-body);
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--lp-text-muted);
          margin-top: 2px;
        }
        /* Rating: outline stars with a gold fill layer clipped to the rating %. */
        .lp-vcard__stars {
          position: relative;
          display: inline-block;
          line-height: 0;
          flex-shrink: 0;
        }
        .lp-vcard__stars-row { display: flex; gap: 1px; }
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
          font-family: var(--font-body);
          font-weight: 700;
          font-size: 0.66rem;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          padding: 3px 9px;
          border-radius: 100px;
          white-space: nowrap;
        }
        .lp-vcard__tier--rising { background: rgba(34, 197, 94, 0.14); color: #15803d; }
        .lp-vcard__tier--pro    { background: rgba(115, 135, 255, 0.16); color: #4452f0; }
        .lp-vcard__tier--elite  { background: rgba(168, 85, 247, 0.16); color: #7c3aed; }
        .lp-vcard__logo {
          flex-shrink: 0;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          color: #fff;
          font-family: var(--font-head);
          font-size: 0.82rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          box-shadow: 0 6px 16px rgba(0,0,0,0.14);
        }
        @media (max-width: 1024px) {
          .lp-showcase__grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 760px) {
          .lp-showcase__grid { grid-template-columns: repeat(2, 1fr); gap: 16px; }
        }
        @media (max-width: 460px) {
          .lp-showcase__grid { grid-template-columns: 1fr; max-width: 320px; }
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
          border: 1px solid rgba(var(--lp-fg),0.14);
          color: var(--lp-text);
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
          color: var(--lp-text);
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
          max-width: none;
          white-space: nowrap;
          text-align: center;
          font-family: var(--font-head);
          font-weight: var(--fw-head);
          font-size: var(--fs-h1);
          line-height: 1.05;
          letter-spacing: -0.02em;
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
          /* Sticky DECK — each card pins one-by-one as you scroll, the next sliding up over it.
             The heading is NON-sticky (see below), so cards never scroll up through a pinned
             heading — that split-the-card bug only happened when the heading was pinned. */
          position: sticky;
          top: calc(var(--stk-top) + var(--i) * var(--stk-step));
          left: auto;
          width: 100%;
          height: auto;
          min-height: 360px;
          margin-left: 0;
          transform: none;
          /* Lighter surface + a clear top edge & shadow so each peeking card reads
             distinctly when stacked, instead of blending into dark bars. */
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
          /* Pull the section up (STATIC margin, NOT a transform) so it follows close behind the
             peeled audit cards. A transform here would break the sticky heading + sticky card
             stack inside (they'd detach and overlap), so the lift must be a plain margin. */
          .lp-achieve-rise { margin-top: -250px; transform: none; }
          /* Heading is STATIC so it rises WITH the section as one unit (a sticky child would break
             under the transformed ancestor and detach from the rise). Opaque bg keeps a peeling
             card hidden behind it instead of splitting it. */
          .lp-achieve { padding-top: 132px; }
          .lp-achieve__title {
            /* STICKY (not static): pin the heading below the navbar so it stays on
               screen while the whole card deck scrolls past, instead of scrolling off
               the top early while the sticky cards are still pinned. Sticks relative to
               the transformed .lp-achieve-rise (same as the cards), so it unpins only
               once the entire section has scrolled past — i.e. it leaves WITH the cards.
               Opaque bg + high z-index keep peeling cards hidden behind it (no split). */
            position: sticky;
            top: 88px;
            z-index: 20;
            max-width: 100%;
            margin: 0;
            padding: 14px 0 18px;
            background: var(--lp-page-bg);
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
        .lp-achieve__list {
          display: flex; flex-direction: column; gap: 6px;
          max-width: 1120px; margin: 44px auto 0; padding: 0 24px;
        }
        .lp-achieve__row { display: flex; justify-content: flex-start; }
        .lp-achieve__col { width: min(330px, 100%); text-align: left; }
        .lp-achieve__num {
          font-family: Georgia, 'Times New Roman', serif; font-style: italic; font-weight: 500;
          font-size: clamp(26px, 3.2vw, 42px); line-height: 1; color: #ef6a4c; letter-spacing: -0.5px;
        }
        .lp-achieve__rule { height: 1px; background: var(--lp-border); margin: 12px 0 12px; }
        .lp-achieve__h {
          margin: 0 0 8px; font-family: var(--font-head, 'Plus Jakarta Sans', sans-serif);
          font-size: clamp(16px, 1.9vw, 20px); font-weight: 800; color: var(--lp-text); line-height: 1.22;
        }
        .lp-achieve__p {
          margin: 0; font-family: var(--font-body, 'Inter', sans-serif);
          font-size: 14.5px; line-height: 1.55; color: var(--lp-text-muted);
        }
        .lp-achieve__tag {
          margin-top: 20px; font-family: var(--font-head, 'Plus Jakarta Sans', sans-serif);
          font-size: 14px; font-weight: 700; color: var(--lp-text);
        }
        @media (max-width: 700px) {
          .lp-achieve__col { margin-left: 0 !important; width: 100%; }
          .lp-achieve__list { gap: 48px; margin-top: 36px; }
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

        /* Mobile: drop the fan, stack the cards vertically (neutralise inline transforms).
           Scoped to .lp-achieve__fan so it never touches the mobile sticky deck, which
           reuses .lp-achieve-card but needs position:sticky. */
        @media (max-width: 900px) {
          /* Match the audit heading ("Answer This Honestly.") exactly — same --fs-h1 token. */
          .lp-achieve__title { font-size: var(--fs-h1); white-space: normal; }
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
        .lpv { padding: 100px 6% 110px; background: #f3ecdd; color: #2a2118; }
        .lpv-inner { max-width: 1120px; margin: 0 auto; }
        .lpv-kicker { margin: 0; text-align: center; color: #8a7f6b; font-weight: 600; font-size: 14px; }
        .lpv-heading { margin: 14px 0 56px; text-align: center; font-family: Georgia, 'Times New Roman', serif;
          font-weight: 500; font-size: clamp(30px, 5vw, 54px); line-height: 1.08; color: #2a2118; letter-spacing: -0.5px; }
        .lpv-grid { display: flex; flex-direction: column; }
        .lpv-header, .lpv-rowgroup { display: grid; grid-template-columns: 1.5fr 1fr 1fr; align-items: center; }
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
        .lpv-header {
          align-items: stretch;
          position: sticky;
          top: 88px;
          z-index: 5;
          background: #f3ecdd;
          min-height: 150px;
        }
        .lpv-h--us, .lpv-cell--us { background: rgba(78, 58, 30, 0.05); }
        .lpv-h--us { border-radius: 16px 16px 0 0; }
        /* Keep the header's UGCad.io cell shaded like the rows below (continuous column),
           but flatten its corners so it doesn't read as a rounded "card" when pinned. */
        .lpv-header .lpv-h--us { border-radius: 0; }
        .lpv-header .lpv-h { padding: 26px 20px; }
        .lpv-h--us { display: flex; align-items: center; justify-content: center; }
        .lpv-brand { font-family: Georgia, serif; font-weight: 800; font-size: 30px; letter-spacing: -1px; color: #2a2118; }
        .lpv-brand-ad { color: #6d7bff; }
        .lpv-h--them { display: flex; align-items: center; justify-content: center; text-align: center; color: #8a7f6b; font-weight: 600; font-size: 15px; }
        /* Stretch cells to fill the full row height so the shaded UGCad.io column reads as
           one continuous block instead of separate cards with unshaded gaps between rows. */
        .lpv-rowgroup { border-top: 1px solid rgba(42, 33, 24, 0.12); align-items: stretch; }
        .lpv-label { font-family: Georgia, serif; font-weight: 500; font-size: clamp(20px, 2.4vw, 30px); color: #2a2118; padding: 26px 8px 26px 0; display: flex; align-items: center; }
        .lpv-cell { padding: 24px 20px; text-align: center; display: flex; flex-direction: column; justify-content: center; gap: 6px; }
        .lpv-cell strong { font-weight: 700; font-size: 15.5px; color: #2a2118; }
        .lpv-cell span { font-size: 14px; line-height: 1.5; color: #7c7362; }
        .lpv-cell--them strong { color: #5b5346; }
        .lpv-tag { display: none; }
        @media (max-width: 760px) {
          .lpv { padding: 60px 22px 70px; }
          .lpv-heading { margin-bottom: 34px; }
          .lpv-header { display: none; }
          .lpv-rowgroup { grid-template-columns: 1fr 1fr; grid-template-areas: 'label label' 'us them'; gap: 0 12px; padding-top: 18px; }
          .lpv-label { grid-area: label; padding: 0 0 12px; font-size: 22px; }
          .lpv-cell { text-align: left; padding: 14px; border-radius: 12px; }
          .lpv-cell--us { grid-area: us; background: rgba(78, 58, 30, 0.06); }
          .lpv-cell--them { grid-area: them; background: transparent; }
          .lpv-tag { display: block; font-style: normal; font-size: 10.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.4px; color: #8a7f6b; margin-bottom: 2px; }
          .lpv-cell--us .lpv-tag { color: #6d7bff; }
        }
        .lp-vs {
          padding: 90px 8% 100px;
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
          font-size: var(--fs-h1);
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
          font-family: var(--font-head);
          font-size: var(--fs-h1);
          font-weight: var(--fw-head);
          color: var(--lp-ink);
          line-height: 1.2;
          letter-spacing: -0.04em;
          margin: 0 0 60px 0;
          max-width: 900px;
          margin-left: auto;
          margin-right: auto;
        }
        .lp-compare__heading--accent {
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
          font-size: var(--fs-h1);
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

        .lp-cta__heading {
          font-family: var(--font-head);
          font-size: var(--fs-h1);
          font-weight: var(--fw-head);
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
          background: rgba(115, 135, 255, 0.15);
          transform: rotate(-3deg);
          border-radius: 4px;
        }
        .lp-cta__heading--accent {
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

        .lp-cta__subtext {
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

        .lp-cta__subtext {
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

        .lp-btn-join {
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

        .lp-cta__proof {
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
          padding: 100px 6% 48px;
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
          .lp-brand-item__icon { width: 72px; height: 72px; }
          .lp-brand-item__icon img { width: 36px; height: 36px; }
          .lp-hero__brand-center { width: 104px; height: 104px; }
          .lp-hero__brand-center img { width: 78px; height: 78px; }
          .lp-navbar__inner { height: 48px; padding: 0 5%; gap: 16px; }
          .lp-navbar__links { display: none; }
          .lp-nav-join { display: none; }
          .lp-navbar__actions { display: none; }
          .lp-navbar__burger { display: inline-flex; }
          .lp-navbar__mobile--open { display: flex; }
          .lp-navbar__logo { height: 184px; margin-left: -37px; }
          .lp-btn-login, .lp-btn-signup { padding: 7px 14px; font-size: 0.85rem; }
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
          .lp-brand-item__icon { width: 58px; height: 58px; border-radius: 16px; }
          .lp-brand-item__icon img { width: 30px; height: 30px; }
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
          /* Extra top padding so "We created…" clears the brand strip above it (the strip is
             pulled up over the showcase via brandRise, so a small top pad left them overlapping). */
          .lp-showcase { padding: 140px 4% 56px; }
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
          max-width: var(--lp-maxw);
          margin: 0 auto;
        }
        .lp-faq__heading {
          font-family: var(--font-head);
          font-size: var(--fs-h1);
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
        .lp-footer__statement-accent {
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
        .lp-footer__link-accent {
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
          .lp-footer { padding: 70px 6% 24px; }
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
          font-size: var(--fs-h1);
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
        .lp-hook__heading--accent {
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
          font-size: var(--fs-h1);
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
        .lp-audit {
          position: relative;
          padding: 120px 8%;
          background: transparent;
          color: var(--lp-text);
          overflow: visible;
          /* Taller runway = the peel is spread over more scroll = slower, calmer. */
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
          background: radial-gradient(circle, rgba(154, 154, 191, 0.30) 0%, transparent 68%);
          top: -190px; right: -190px;
        }
        .lp-audit__bg-orb--2 {
          width: 460px; height: 460px;
          background: radial-gradient(circle, rgba(7, 7, 78, 0.20) 0%, transparent 68%);
          bottom: -170px; left: -150px;
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
          font-family: var(--font-body);
          font-size: 0.82rem;
          font-weight: 600;
          color: #7387FF;
          margin-bottom: 22px;
          box-shadow: 0 4px 14px rgba(7, 7, 78, 0.08);
        }
        .lp-audit__pill svg { color: #7387FF; }

        .lp-audit__heading {
          font-family: var(--font-head);
          font-size: var(--fs-h1);
          font-weight: var(--fw-head);
          color: var(--lp-ink);
          letter-spacing: -0.04em;
          line-height: 1.15;
          margin: 0 0 14px 0;
        }
        .lp-audit__heading--accent {
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
          max-width: 290px;
          background: #7387FF;
          border: 1px solid rgba(var(--lp-fg), 0.2);
          border-radius: 22px;
          padding: 36px 30px 26px;
          min-height: 0;
          display: flex;
          flex-direction: column;
          box-shadow: 0 10px 28px rgba(7, 7, 78, 0.4);
          overflow: hidden;
          transform-origin: center center;
          /* Keep each card on its own GPU layer for the whole peel so it composites
             instead of repainting the shadow each scroll frame (and so framer isn't
             promoting/de-promoting it on every spring start/settle). */
          will-change: transform;
          backface-visibility: hidden;
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
          font-family: var(--font-body);
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--lp-text);
          letter-spacing: 0.1em;
          padding: 5px 12px;
          background: #7387FF;
          border: 1px solid rgba(var(--lp-fg), 0.6);
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
          font-family: var(--font-body);
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

        /* ── Editorial proof (reference layout: pull-quote + "The receipts" numbers) ── */
        .lpr-kicker {
          font-family: var(--font-body);
          font-size: 0.78rem;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(var(--lp-fg), 0.45);
          margin: 0 0 30px;
        }
        .lpr-quote {
          font-family: var(--font-head), 'Readex Pro', sans-serif;
          font-weight: 800;
          text-transform: uppercase;
          font-size: clamp(2rem, 5vw, 4.4rem);
          line-height: 1.03;
          letter-spacing: -0.02em;
          color: var(--lp-text);
          margin: 0;
          max-width: 20ch;
        }
        .lpr-quote em {
          font-style: italic;
          text-transform: none;
          font-weight: 500;
          color: #ec4899;      /* pink accent, like the reference */
        }
        .lpr-cite {
          font-family: var(--font-body);
          font-size: 0.82rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(var(--lp-fg), 0.5);
          margin: 38px 0 0;
        }
        .lpr-kicker--receipts { margin-top: 104px; margin-bottom: 0; }
        .lpr-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 44px;
        }
        .lpr-stat {
          border-top: 1px solid rgba(var(--lp-fg), 0.22);
          padding-top: 24px;
          display: flex;
          flex-direction: column;
        }
        .lpr-stat__value {
          font-family: var(--font-head), 'Readex Pro', sans-serif;
          font-weight: 800;
          font-size: clamp(2.6rem, 5vw, 4.4rem);
          line-height: 1;
          letter-spacing: -0.02em;
          color: var(--lp-text);
        }
        .lpr-stat__label {
          font-family: var(--font-body);
          font-size: 0.98rem;
          color: rgba(var(--lp-fg), 0.6);
          margin-top: 16px;
        }
        @media (max-width: 760px) {
          .lpr-quote { font-size: clamp(1.7rem, 8vw, 2.8rem); max-width: none; }
          .lpr-kicker--receipts { margin-top: 68px; }
          .lpr-stats { grid-template-columns: repeat(2, 1fr); gap: 28px; }
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
          font-size: var(--fs-h1);
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
          font-family: var(--font-head, 'Plus Jakarta Sans', sans-serif); font-weight: 800;
          letter-spacing: -2px; font-size: clamp(64px, 9vw, 132px); line-height: 1; color: var(--lp-text);
        }
        .lp-proof__big-label {
          margin-top: 18px; font-family: var(--font-body, 'Inter', sans-serif);
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
          font-family: var(--font-head, 'Plus Jakarta Sans', sans-serif); font-weight: 800;
          letter-spacing: -1.5px; font-size: clamp(42px, 5.2vw, 68px); line-height: 1; color: var(--lp-text);
        }
        .lp-proof__card.is-active .lp-proof__card-value { color: #4452f0; }
        .lp-proof__card-label {
          font-family: var(--font-body, 'Inter', sans-serif);
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
          font-size: var(--fs-h1);
          font-weight: var(--fw-head);
          color: var(--lp-ink);
          letter-spacing: -0.04em;
          line-height: 1.15;
          margin: 0 0 56px 0;
        }
        .lp-testimonial__heading--accent {
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
          transition: border-color 0.2s ease, transform 0.2s ease, opacity 0.2s ease;
          opacity: 0.55;
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
          transform: translateY(-2px);
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
          margin-bottom: 56px;
        }
        /* Clips the horizontal slide so the off-screen row never spills out, while
           leaving vertical room for card hover-lift + drop shadows. */
        .lp-testimonial__viewport {
          overflow: hidden;
          padding: 10px 4px 34px;
          margin: -10px -4px -34px;
        }
        /* One flexible track holding every card; JS centers the active card by
           translating the whole track, so the slide is one smooth CSS transition. */
        .lp-testimonial__grid {
          position: relative;
          display: flex;
          flex-wrap: nowrap;
          gap: 24px;
          text-align: left;
          will-change: transform;
          transition: transform 0.5s cubic-bezier(0.16, 1, 0.3, 1);
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
          background: #7387FF;
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

        /* Spotlight carousel — the active card is full-size and opaque; its neighbours
           sit dimmed and shrunk so they read as background, peeking in from the edges
           of the clipped viewport. Corner brackets call out the active card only. */
        .lp-tcard--spot {
          cursor: pointer;
          opacity: 0.4;
          transform: scale(0.92);
          filter: saturate(0.7);
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.3s ease,
            opacity 0.4s ease, filter 0.4s ease;
        }
        .lp-tcard--spot:not(.is-active)::before { display: none; }
        .lp-tcard--spot:hover:not(.is-active) {
          opacity: 0.65;
          transform: scale(0.94);
        }
        .lp-tcard--spot.is-active {
          cursor: default;
          opacity: 1;
          transform: scale(1);
          filter: none;
          z-index: 2;
          box-shadow: 0 24px 56px rgba(7, 7, 78, 0.16);
        }
        .lp-tcard__corner {
          position: absolute;
          width: 18px;
          height: 18px;
          border: 0 solid #7387FF;
          pointer-events: none;
          z-index: 3;
        }
        .lp-tcard__corner--tl { top: 10px; left: 10px; border-top-width: 2px; border-left-width: 2px; border-top-left-radius: 6px; }
        .lp-tcard__corner--tr { top: 10px; right: 10px; border-top-width: 2px; border-right-width: 2px; border-top-right-radius: 6px; }
        .lp-tcard__corner--bl { bottom: 10px; left: 10px; border-bottom-width: 2px; border-left-width: 2px; border-bottom-left-radius: 6px; }
        .lp-tcard__corner--br { bottom: 10px; right: 10px; border-bottom-width: 2px; border-right-width: 2px; border-bottom-right-radius: 6px; }

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
          font-family: var(--font-body);
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
        }
        /* Audit cards on MOBILE (≤768px): keep the absolute FAN (centred via flex
           static-position), sized for a phone, and give the section a TALL sticky runway so the
           cards assemble by SCROLL (Q1 present, then Q2, then Q3 rise in — heroStatic branch in
           the JSX). No position:static / transform:none here (kills the fan). */
        @media (max-width: 768px) {
          /* Shorter runway (was 190vh): enough pinned scroll for a smooth peel, but trimmed so the
             section unpins right as the last card leaves — no tall empty pinned tail. Combined with
             the achieve section's -300px overlap, the Find & Hire block rises into view as the final
             cards peel instead of after a gap. */
          .lp-audit { min-height: 185vh; padding: 0 6%; }
          /* Promote the sticky inner to its own GPU layer so the cards rising over it
             composite independently instead of repainting this whole pinned area each
             scroll frame (that repaint was the Q2 stutter). */
          .lp-audit__inner {
            position: sticky; top: 60px; padding-top: 22px;
            transform: translateZ(0);
          }
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
            box-shadow: 0 6px 16px rgba(7, 7, 78, 0.30);
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
          /* Scroll-pinned proof carousel: a tall runway + sticky inner. As you scroll the
             runway, proofScroll progress (JS) slides the track and moves the dots, then the
             pin releases and the page flows to the testimonials. */
          .lp-proof {
            padding: 0 5%;
            /* Shorter pinned runway (was 200vh): the carousel still scrubs over [0.08,0.92] of
               the section scroll, but the leftover dead-scroll tail after the last stat — the big
               empty gap below "Not louder ads…" — is trimmed, so the testimonial comes up sooner. */
            min-height: 150vh;
          }
          .lp-proof__inner {
            position: sticky;
            top: 0;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            /* Sit a bit above centre (was centered). */
            justify-content: flex-start;
            padding: 16vh 0 80px;
          }
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
          /* Pull the testimonial block up on mobile (the tall connector + padding left a big
             empty gap above "Founder stories" — it only appeared after the proof animation fully
             finished). A larger negative margin lifts it into the tail of the proof section so it
             rises during the animation instead of after it. Web is untouched. */
          .lp-testimonial { margin-top: -190px; padding-top: 0; }
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
          /* Cheaper shadows on the cards that SCROLL/animate (big blur radii repaint every frame). */
          .lp-showcase-card, .lp-audit-card, .lp-achieve-card, .lp-tcard, .lp-brand-item__icon {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.32) !important;
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
        .lp-perf-lite .lp-showcase-card,
        .lp-perf-lite .lp-audit-card,
        .lp-perf-lite .lp-achieve-card,
        .lp-perf-lite .lp-tcard,
        .lp-perf-lite .lp-brand-item__icon {
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.32) !important;
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
