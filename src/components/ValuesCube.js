import { useEffect, useRef, useState, useCallback } from 'react';

// ── Values cube ──────────────────────────────────────────────────────────────
// Replaces the old scrolling "leaderboard" of taglines with an interactive 3D
// cube (dark-navy glass, matches the landing) + a heading list on the right.
//
//   • The cube idle-spins on its own (slow drift about Y with a gentle X tilt).
//   • Drag it with the cursor (pointer/touch) to rotate it freely.
//   • Hover OR click a heading on the right → the cube eases so THAT face turns
//     to the front (and the face + heading light up with the indigo accent).
//
// Each of the 6 faces carries a big heading word + its sub-line, taken from the
// old TOP_CREATORS taglines (best 6 picked). Edit VALUES below to change copy —
// order is [front, right, back, left, top, bottom]; keep exactly 6.
const VALUES = [
  { key: 'speed',      heading: 'SPEED',      line: 'Fastest content, delivery from 24 hours' },
  { key: 'talent',     heading: 'TALENT',     line: 'Top UGC creators across every niche' },
  { key: 'support',    heading: 'SUPPORT',    line: 'Hands-on support from UGC experts' },
  { key: 'ownership',  heading: 'OWNERSHIP',  line: 'You own every video the moment you approve' },
  { key: 'protection', heading: 'PROTECTION', line: 'No paying till you approve the video' },
  { key: 'vetted',     heading: 'VETTED',     line: 'Vetted creators, not an open marketplace' },
];

// Cube rotation (deg) that brings each face to the FRONT. The faces are placed
// front / right / back / left / top / bottom below; these are the inverse of
// each face's own transform, so applying one lands that face facing the viewer.
const FACE_TARGET = [
  { x: 0,   y: 0 },     // front
  { x: 0,   y: -90 },   // right
  { x: 0,   y: -180 },  // back
  { x: 0,   y: 90 },    // left
  { x: -90, y: 0 },     // top
  { x: 90,  y: 0 },     // bottom
];

// Per-face static placement on the cube (the box is `preserve-3d`; each face is
// pushed out by half the cube size via the --cube CSS var).
const FACE_PLACE = [
  'rotateY(0deg)   translateZ(calc(var(--cube) / 2))',   // front
  'rotateY(90deg)  translateZ(calc(var(--cube) / 2))',   // right
  'rotateY(180deg) translateZ(calc(var(--cube) / 2))',   // back
  'rotateY(-90deg) translateZ(calc(var(--cube) / 2))',   // left
  'rotateX(90deg)  translateZ(calc(var(--cube) / 2))',   // top
  'rotateX(-90deg) translateZ(calc(var(--cube) / 2))',   // bottom
];

export default function ValuesCube() {
  const cubeRef = useRef(null);
  // Live rotation, mutated imperatively each frame (no React re-render per frame).
  const rot = useRef({ x: -18, y: 24 });
  // Target the cube eases toward when a heading is focused; null = free idle spin.
  const target = useRef(null);
  // Drag bookkeeping.
  const drag = useRef({ active: false, px: 0, py: 0 });
  const raf = useRef(0);
  // Which face is currently "selected" (for accent highlight) — drives React UI only.
  const [active, setActive] = useState(-1);

  // Single rAF loop drives the whole thing: idle drift, ease-to-target, and the
  // final DOM write. Everything else just mutates the refs above.
  useEffect(() => {
    const el = cubeRef.current;
    if (!el) return;
    let mounted = true;

    const tick = () => {
      if (!mounted) return;
      const r = rot.current;
      const t = target.current;

      if (drag.current.active) {
        // While dragging the pointer handlers own the rotation — do nothing here.
      } else if (t) {
        // Ease toward the focused face. Take the SHORTEST way round on Y so it
        // never spins the long way to reach a face.
        let dy = ((t.y - r.y + 540) % 360) - 180;
        r.x += (t.x - r.x) * 0.12;
        r.y += dy * 0.12;
      } else {
        // Free idle drift.
        r.y += 0.25;
        // Settle the tilt gently back toward the resting angle.
        r.x += (-18 - r.x) * 0.02;
      }

      el.style.transform =
        `translateZ(calc(var(--cube) * -0.5)) rotateX(${r.x}deg) rotateY(${r.y}deg)`;
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      mounted = false;
      cancelAnimationFrame(raf.current);
    };
  }, []);

  // ── Pointer drag ────────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e) => {
    drag.current = { active: true, px: e.clientX, py: e.clientY };
    target.current = null;      // dragging cancels any face snap
    setActive(-1);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.px;
    const dy = e.clientY - drag.current.py;
    drag.current.px = e.clientX;
    drag.current.py = e.clientY;
    // Horizontal drag → spin about Y; vertical drag → tilt about X (clamped so it
    // never flips fully upside-down).
    rot.current.y += dx * 0.4;
    rot.current.x = Math.max(-80, Math.min(80, rot.current.x - dy * 0.4));
  }, []);

  const endDrag = useCallback((e) => {
    if (!drag.current.active) return;
    drag.current.active = false;
    e.currentTarget?.releasePointerCapture?.(e.pointerId);
  }, []);

  // ── Heading hover / click → turn that face to the front ───────────────────────
  const focusFace = useCallback((i) => {
    target.current = FACE_TARGET[i];
    setActive(i);
  }, []);
  const releaseFace = useCallback(() => {
    // Only drop the snap on mouse-leave if it wasn't "locked" by a click; here we
    // simply resume the idle drift — clicking then leaving still returns to spin.
    target.current = null;
    setActive(-1);
  }, []);

  return (
    <div className="vc">
      {/* Cube stage (left). The scene holds the perspective; the box is the
          preserve-3d cube we rotate. */}
      <div
        className="vc__stage"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
      >
        <div className="vc__scene">
          <div className="vc__cube" ref={cubeRef}>
            {VALUES.map((v, i) => (
              <div
                key={v.key}
                className={`vc__face${active === i ? ' is-active' : ''}`}
                style={{ transform: FACE_PLACE[i] }}
              >
                <span className="vc__face-heading">{v.heading}</span>
                <span className="vc__face-line">{v.line}</span>
              </div>
            ))}
          </div>
        </div>
        <span className="vc__hint">Drag to spin</span>
      </div>

      {/* Heading list (right). */}
      <ul className="vc__list" onMouseLeave={releaseFace}>
        {VALUES.map((v, i) => (
          <li key={v.key}>
            <button
              type="button"
              className={`vc__item${active === i ? ' is-active' : ''}`}
              onMouseEnter={() => focusFace(i)}
              onFocus={() => focusFace(i)}
              onClick={() => focusFace(i)}
            >
              {v.heading}
            </button>
          </li>
        ))}
      </ul>

      <style>{`
        .vc {
          --cube: clamp(210px, 24vw, 330px);
          --vc-accent: #6366f1;
          position: relative;
          z-index: 2;
          width: min(1080px, 92vw);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: clamp(24px, 6vw, 90px);
        }
        /* ── cube stage ── */
        .vc__stage {
          position: relative;
          flex: 0 0 auto;
          width: calc(var(--cube) * 1.5);
          height: calc(var(--cube) * 1.5);
          display: grid;
          place-items: center;
          cursor: grab;
          touch-action: none;   /* let us own vertical drag on touch */
        }
        .vc__stage:active { cursor: grabbing; }
        .vc__scene {
          width: var(--cube);
          height: var(--cube);
          perspective: 1100px;
        }
        .vc__cube {
          position: relative;
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          will-change: transform;
        }
        .vc__face {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 10px;
          padding: 18px;
          box-sizing: border-box;
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 14px;
          background:
            linear-gradient(150deg, rgba(30,33,58,0.72), rgba(14,15,28,0.72));
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.06),
                      0 20px 60px rgba(0,0,0,0.35);
          backface-visibility: hidden;
          transition: border-color 0.35s ease, box-shadow 0.35s ease;
        }
        .vc__face.is-active {
          border-color: rgba(99,102,241,0.85);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.08),
                      0 0 0 1px rgba(99,102,241,0.45),
                      0 24px 70px rgba(60,60,150,0.35);
        }
        .vc__face-heading {
          font-family: var(--font-head);
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1;
          font-size: clamp(22px, 3vw, 40px);
          color: #ffffff;
        }
        .vc__face-line {
          font-family: var(--font-body);
          font-weight: 400;
          line-height: 1.35;
          font-size: clamp(12px, 1.05vw, 15px);
          color: var(--lp-text-soft, rgba(226,228,245,0.7));
          max-width: 86%;
        }
        .vc__hint {
          position: absolute;
          bottom: 4px;
          left: 50%;
          transform: translateX(-50%);
          font-family: var(--font-body);
          font-size: 11px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: rgba(226,228,245,0.35);
          pointer-events: none;
        }
        /* ── heading list ── */
        .vc__list {
          list-style: none;
          margin: 0;
          padding: 0;
          flex: 0 1 340px;
          display: flex;
          flex-direction: column;
        }
        .vc__item {
          appearance: none;
          width: 100%;
          background: none;
          border: none;
          border-top: 1px solid rgba(255,255,255,0.12);
          padding: 18px 4px;
          text-align: left;
          cursor: pointer;
          font-family: var(--font-head);
          font-weight: 600;
          letter-spacing: 0.02em;
          font-size: clamp(15px, 1.5vw, 21px);
          color: rgba(226,228,245,0.72);
          transition: color 0.28s ease, padding-left 0.28s ease;
        }
        .vc__list li:last-child .vc__item {
          border-bottom: 1px solid rgba(255,255,255,0.12);
        }
        .vc__item:hover,
        .vc__item.is-active {
          color: #ffffff;
          padding-left: 14px;
        }
        .vc__item.is-active {
          color: var(--vc-accent);
        }
        /* ── responsive: stack on phones, cube on top ── */
        @media (max-width: 760px) {
          .vc {
            --cube: clamp(160px, 52vw, 240px);
            flex-direction: column;
            gap: 26px;
            width: 92vw;
          }
          .vc__list { flex: 1 1 auto; width: min(340px, 82vw); }
          .vc__item { padding: 13px 4px; }
        }
      `}</style>
    </div>
  );
}
