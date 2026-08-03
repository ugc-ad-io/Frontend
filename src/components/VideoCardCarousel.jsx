import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

// Mock data — reuses real clips already shipped under /public/home so this component
// renders something real immediately, not placeholder boxes. Swap `src`/`poster`/
// `caption` for real content wherever this gets used.
const CARDS = [
  { id: 1, src: '/home/video_03.mp4', poster: '/home/video_03.jpg', caption: 'Abigail' },
  { id: 2, src: '/home/video_05.mp4', poster: '/home/video_05.jpg', caption: 'Becki' },
  { id: 3, src: '/home/video_07.mp4', poster: '/home/video_07.jpg', caption: 'Lara' },
  { id: 4, src: '/home/video_13.mp4', poster: '/home/video_13.jpg', caption: 'Riya' },
  { id: 5, src: '/home/video_16.mp4', poster: '/home/video_16.jpg', caption: 'Noah' },
  { id: 6, src: '/home/video_21.mp4', poster: '/home/video_21.jpg', caption: 'Liam' },
  { id: 7, src: '/home/video_25.mp4', poster: '/home/video_25.jpg', caption: 'Mia' },
];

const SPRING = { type: 'spring', stiffness: 300, damping: 20 };

export default function VideoCardCarousel({ cards = CARDS }) {
  // Which card is "active" (hovered on desktop, tapped on mobile) — a single index
  // drives both interaction modes so the visual result is identical either way.
  const [activeIndex, setActiveIndex] = useState(null);
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 640
  );

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const centerIndex = (cards.length - 1) / 2;
  // Flatter, smaller-overlap fan on mobile — the row also becomes horizontally
  // scrollable there (see the wrapper below) so a flatter fan reads better in a strip
  // the user swipes through, rather than a deep hand-of-cards spread.
  const ROTATE_STEP = isMobile ? 4 : 8;      // deg per card away from centre
  const LIFT_STEP = isMobile ? 12 : 20;      // px pushed down per card away from centre
  const OVERLAP_PX = isMobile ? 34 : 48;     // ~30-40% of the card width (112px / 144px)

  return (
    <div
      className={[
        'relative w-full py-16 video-card-carousel-scroller',
        // Mobile: horizontally scrollable with snap, so the (flatter) fan can still be
        // browsed even though not all cards fit a phone's width at once.
        isMobile ? 'overflow-x-auto snap-x snap-mandatory' : 'overflow-visible',
      ].join(' ')}
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', perspective: '1200px' }}
    >
      {/* Firefox/IE scrollbar hiding is inline style above; WebKit (Chrome/Safari) needs
          this pseudo-element, which inline styles can't reach. */}
      <style>{`.video-card-carousel-scroller::-webkit-scrollbar { display: none; }`}</style>
      <div
        className={[
          'flex items-start',
          isMobile ? 'w-max px-10' : 'justify-center',
        ].join(' ')}
        // preserve-3d (guaranteed inline, same reasoning as transformOrigin below): every
        // card's translateZ needs to compose within one shared 3D space relative to the
        // perspective set on the wrapper above, or depth collapses to a flat 2D scale.
        style={{ transformStyle: 'preserve-3d' }}
      >
        {cards.map((card, i) => {
          // Distance from the centre index — negative = left, positive = right, 0 = centre.
          const offset = i - centerIndex;
          const isActive = activeIndex === i;
          const isNeighbour = activeIndex !== null && Math.abs(activeIndex - i) === 1;

          // Resting (non-active) transform — the fan itself: flat/high at the centre,
          // rotating + dropping further outward the further a card is from centerIndex.
          const rotation = offset * ROTATE_STEP;
          const translateY = Math.abs(offset) * LIFT_STEP;
          // Depth: 1 at the centre, 0 at the outermost cards (guarded against
          // centerIndex=0 for a single-card row). Drives translateZ so the centre
          // visibly pops OUT toward the viewer while both edges recede back into
          // the screen — the actual 3D "come toward you" effect, not just a flat fan.
          const depth = centerIndex ? 1 - Math.abs(offset) / centerIndex : 1;
          const translateZ = depth * 130 - 20; // centre ≈ +110px, edges ≈ -20px

          // Active card: straighten, lift up, scale up, pop further forward, jump to front.
          // Immediate neighbours nudge slightly further away to give it room.
          const rotate = isActive ? 0 : rotation;
          const y = isActive ? -24 : translateY;
          const z = isActive ? 140 : translateZ;
          const scale = isActive ? 1.08 : 1;
          const x = isNeighbour ? Math.sign(i - activeIndex) * 14 : 0;
          const zIndex = isActive ? cards.length + 1 : cards.length - Math.abs(offset);

          return (
            <motion.div
              key={card.id}
              className={[
                'relative shrink-0 cursor-pointer',
                'aspect-[9/16] rounded-2xl overflow-hidden',
                'shadow-lg shadow-black/30 border border-white/10',
                isMobile ? 'w-28 snap-center' : 'w-36',
              ].join(' ')}
              style={{
                marginLeft: i === 0 ? 0 : -OVERLAP_PX,
                zIndex,
                // Guaranteed inline style, NOT a Tailwind class (e.g. origin-bottom) —
                // this way the pivot point can never silently go missing because Tailwind's
                // JIT scanner hadn't picked up this file yet. Critical: without this the
                // rotation pivots from the card's centre instead of its bottom edge, and
                // the "fanned out of a deck" look is lost.
                transformOrigin: 'bottom center',
              }}
              // Framer Motion's rotate/y/z/x/scale shorthand IS the transform — it owns
              // `element.style.transform` from here on, so this must be the only place
              // transform is set (a separate manual style.transform string would just get
              // silently overwritten by Framer Motion's own animation controller).
              animate={{ rotate, y, z, x, scale }}
              transition={SPRING}
              onMouseEnter={() => !isMobile && setActiveIndex(i)}
              onMouseLeave={() => !isMobile && setActiveIndex((cur) => (cur === i ? null : cur))}
              onClick={() => isMobile && setActiveIndex((cur) => (cur === i ? null : i))}
            >
              <video
                src={card.src}
                poster={card.poster}
                className="h-full w-full object-cover"
                muted
                loop
                playsInline
                autoPlay
                preload="none"
              />
              {/* Bottom caption overlay — Reels-tray style gradient + name */}
              {card.caption && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end bg-gradient-to-t from-black/70 via-black/10 to-transparent p-3">
                  <span className="text-sm font-semibold text-white drop-shadow">
                    {card.caption}
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
