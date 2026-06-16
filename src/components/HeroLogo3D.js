import { Suspense, useRef, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Environment, Center, Bounds, Html } from '@react-three/drei';
import * as THREE from 'three';

// ── Phase boundaries, in JOURNEY progress (0 = top of hero, 1 = end of leaderboard) ──
// PHASE 1 (hero):     0 → HERO_END        — ONE 360° turntable spin + colour journey + grow.
// PHASE 2 (cross): TIP_START → TIP_FINISH — logo tilts to LANDSCAPE + travels right→left.
// PHASE 3 (board): LB_SPIN_START → LB_SPIN_END — barrel-rolls while the leaderboard scrolls.
const HERO_END = 0.3;
// The single 360° spin completes by 0.3; the tilt then begins immediately and leans over
// SLOWLY together with the cross, arriving landscape at the board spot by ~0.67 — which is
// when the 3D section pins and the first leaderboard row scrolls up to meet the logo.
const TIP_START = 0.3;
const TIP_FINISH = 0.67;
// Once landscape, keep it ALIVE: barrel-roll about its (now horizontal) axis while the
// leaderboard rows scroll past, instead of sitting straight and static.
const LB_SPIN_START = 0.67;
const LB_SPIN_END = 0.86;
const SPIN_TURNS = 1;
// Mobile "verticalSpin" mode: the logo stays UPRIGHT (no landscape tilt / barrel) and simply
// spins about its vertical (Y) axis, tied straight to scroll. This many full turns across the
// section's scroll range.
const VS_TURNS = 3;
// The moment the 11th (last) row hits the 50% focus (~0.86) the logo crosses to centre and
// UN-TILTS back to STRAIGHT over DISSOLVE_START→END, arriving upright at the middle to dissolve.
const DISSOLVE_START = 0.86;
const DISSOLVE_END = 0.96;

// Continuous decorative auto-spin while the logo sits at the hero (top of page). One full
// turn every ~10s. It's faded out as you scroll into the choreographed journey so it never
// fights the scroll-driven spin/tip/barrel below.
const AUTO_SPIN_SPEED = (Math.PI * 2) / 40; // rad per second (one turn / 40s — calmer idle)

// ── Desktop spin ────────────────────────────────────────────────────────────────
// HERO (jp 0→HERO_END): the mark turns LEFT↔RIGHT (about the vertical Y axis) for one full
//   turn, plus a slow idle so it's alive at rest. It then tips to landscape + barrel-rolls
//   (see the TIP / BOARD / DISSOLVE phases in useFrame).
const CALM_SPIN_SPEED = (Math.PI * 2) / 16; // rad/s idle left↔right — one gentle turn every 16s
const HERO_TURNS = 1;     // left↔right (Y) turns driven across the hero scroll

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(Math.max(t, 0), 1);

// CONSTANT-speed barrel-roll. The logo is landscape EXACTLY during the spin window
// (0.67 → 0.86); the spin is tied to that state, so it must run at FULL speed the instant
// the logo becomes landscape at BOTH ends — no ease-in/out delay in either scroll direction
// (down: lands landscape at 0.67 and spins immediately; up: re-tilts to landscape at 0.86
// and spins immediately). A linear profile = constant angular velocity = instant at both
// edges. The hard rotation change at each edge is hidden by the cross (0.67) / dissolve
// (0.86) motion happening there.
const spinProfile = (t) => clamp01(t);

// Face-on correction so the mark faces the camera at progress 0.
const FACE_ROT = { x: 0, y: -0.61, z: 0 };

// Colour journey (exact spec hex): Frosted Lilac → Periwinkle Pulse → Velvet Mist.
// The start colour is theme-aware: white reads on the dark theme, but is invisible on the
// light (lavender) background, so light theme starts at the brand purple instead.
const COL_START_DARK = new THREE.Color('#FFFFFF');  // 0.0 white (dark theme)
const COL_START_LIGHT = new THREE.Color('#9b7df5'); // 0.0 brand purple, lightened (light theme)
const COL_MID = new THREE.Color('#7367FF');   // 0.5 light periwinkle (brand)
const COL_END = new THREE.Color('#2C2C92');   // 1.0 royal-blue / indigo (final stop)
const _col = new THREE.Color();

// `progress` is the JOURNEY scroll value (journeyP). The component splits it into the
// hero phase (360° spin + colour) and the leaderboard phase (landscape tip + barrel-roll).
function LogoModel({ progress, theme, idleSpin = true, verticalSpin = false }) {
  const { scene } = useGLTF('/model-compressed.glb');
  const tipRef = useRef();
  const spinRef = useRef();
  const meshesRef = useRef(null);   // lit meshes, cached once (no per-frame scene.traverse)
  const colourKeyRef = useRef(-1);  // last applied colour step — skips redundant recolours
  const frozenIdleRef = useRef(0);  // idle-spin angle frozen at the moment scroll begins
  const colStart = theme === 'light' ? COL_START_LIGHT : COL_START_DARK;

  // On-demand rendering: only render a frame when the scroll value actually changes (i.e.
  // while scrolling), instead of burning a WebGL render every frame forever.
  const invalidate = useThree((s) => s.invalidate);

  // Re-apply the colour whenever the theme (and thus start colour) changes. Because the
  // canvas is frameloop="demand", we must also invalidate() to force a render — otherwise
  // the recolour never runs until the next scroll (theme switch while idle showed no change).
  useEffect(() => {
    colourKeyRef.current = -1;
    invalidate();
  }, [theme, invalidate]);
  useEffect(() => {
    if (!progress) return;
    // Throttle scroll-driven renders to ~40fps. The mark is small + decorative, so 40fps
    // is visually fine, but capping it leaves the GPU + main thread more headroom for the
    // leaderboard, which animates over the SAME scroll — the mid-scroll jank was the two
    // competing at 60fps. A trailing rAF guarantees the final resting frame still lands.
    const MIN_MS = 25; // ~40fps
    let lastT = 0;
    let trailing = 0;
    const onChange = () => {
      const now = performance.now();
      if (now - lastT >= MIN_MS) {
        lastT = now;
        if (trailing) { cancelAnimationFrame(trailing); trailing = 0; }
        invalidate();
      } else if (!trailing) {
        trailing = requestAnimationFrame(() => {
          trailing = 0;
          lastT = performance.now();
          invalidate();
        });
      }
    };
    const unsub = progress.on('change', onChange);
    invalidate(); // first paint
    return () => {
      unsub();
      if (trailing) cancelAnimationFrame(trailing);
    };
  }, [progress, invalidate]);

  // Drive the continuous auto-spin: while the logo is at/near the hero (jp < HERO_END) keep
  // requesting frames so the time-based rotation in useFrame animates even without scrolling.
  // Once scrolled past the hero we stop invalidating, so the GPU stays idle as before.
  useEffect(() => {
    if (!idleSpin) return; // mobile: no decorative idle spin, so no need to keep rendering at rest
    let raf;
    const tick = () => {
      // Keep rendering while mounted so the gentle sway animates continuously (even at rest).
      // The whole canvas is unmounted by the parent once the journey scrolls out of view, so
      // this never runs for an off-screen scene.
      invalidate();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [progress, invalidate, idleSpin]);

  useFrame((state) => {
    const jp = progress ? clamp01(progress.get()) : 0;

    // Colour-journey progress over the hero phase (used only for the recolour below).
    const heroP = clamp01(jp / HERO_END);

    if (verticalSpin) {
      // Mobile: UNCHANGED — upright, spins about the vertical (Y) axis tied straight to scroll.
      if (tipRef.current) tipRef.current.rotation.z = 0;
      if (spinRef.current) spinRef.current.rotation.y = jp * Math.PI * 2 * VS_TURNS;
    } else {
      // Desktop, choreographed phases — continuous at every seam (nothing snaps):
      //   HERO (0→0.3):           single 360° Y spin + idle sway; logo stays UPRIGHT (tip z = 0).
      //   TIP  (0.3→0.67):        rolls upright→LANDSCAPE (tip z: 0 → 90°) as it crosses to the
      //                           board, so it lies horizontal right as it reaches the leaderboard.
      //   BOARD(0.67→0.86):       HOLDS landscape and barrel-rolls about its now-horizontal axis.
      //   DISSOLVE(0.86→0.96):    un-rolls landscape→upright (90°→0) as it crosses to centre.
      const idle = state.clock.elapsedTime * CALM_SPIN_SPEED;
      const heroY = clamp01(jp / HERO_END) * Math.PI * 2 * HERO_TURNS;

      // Tip (roll in the screen plane): 0 = upright, -π/2 = landscape with the open/pointed
      // side facing the leaderboard text (rolled the OPPOSITE way to +π/2). Eased so the lean
      // is smooth, holds flat across the whole leaderboard window, then eases back upright.
      const LANDSCAPE = -Math.PI / 2;
      let tipZ;
      if (jp < TIP_START) {
        tipZ = 0;
      } else if (jp < TIP_FINISH) {
        tipZ = easeInOut(clamp01((jp - TIP_START) / (TIP_FINISH - TIP_START))) * LANDSCAPE;
      } else if (jp < DISSOLVE_START) {
        tipZ = LANDSCAPE;                            // landscape — held across the board
      } else {
        tipZ = (1 - easeInOut(clamp01((jp - DISSOLVE_START) / (DISSOLVE_END - DISSOLVE_START)))) * LANDSCAPE;
      }
      if (tipRef.current) tipRef.current.rotation.z = tipZ;

      // Barrel-roll only over the board window. spinRef sits INSIDE the tipped group, so once
      // the logo is landscape its local Y axis points horizontally on screen → spinning Y reads
      // as the flat mark rolling like a barrel. Constant angular velocity (spinProfile linear).
      const boardP = clamp01((jp - LB_SPIN_START) / (LB_SPIN_END - LB_SPIN_START));
      const barrel = spinProfile(boardP) * Math.PI * 2 * SPIN_TURNS;
      if (spinRef.current) {
        spinRef.current.rotation.y = idle + heroY + barrel;
        spinRef.current.rotation.x = 0;
      }
    }

    // Set up the bright self-lit material + cache the mesh list ONCE — no per-frame
    // scene.traverse (that ran on every scroll frame and was a big chunk of the jank).
    if (!meshesRef.current) {
      const list = [];
      scene.traverse((o) => {
        if (o.isMesh) {
          o.material = new THREE.MeshStandardMaterial({ metalness: 0.1, roughness: 0.6, envMapIntensity: 1.0 });
          o.material.emissiveIntensity = 0.55;
          list.push(o);
        }
      });
      meshesRef.current = list;
    }

    // Colour journey runs over the HERO phase, then HOLDS for the cross + board. Recolour
    // ONLY when the colour actually steps (and not at all once it holds) — avoids writing the
    // same colour to every mesh on every scroll frame.
    const colourKey = heroP >= 1 ? 1000 : Math.round(heroP * 120);
    if (colourKey !== colourKeyRef.current) {
      colourKeyRef.current = colourKey;
      if (heroP < 0.5) _col.lerpColors(colStart, COL_MID, heroP * 2);
      else _col.lerpColors(COL_MID, COL_END, (heroP - 0.5) * 2);
      for (let i = 0; i < meshesRef.current.length; i++) {
        const m = meshesRef.current[i].material;
        if (m.color) m.color.copy(_col);
        m.emissive.copy(_col);
      }
    }
  });

  return (
    <group ref={tipRef}>
      <group ref={spinRef}>
        <group rotation={[FACE_ROT.x, FACE_ROT.y, FACE_ROT.z]}>
          <Center>
            <primitive object={scene} />
          </Center>
        </group>
      </group>
    </group>
  );
}

useGLTF.preload('/model-compressed.glb');

export default function HeroLogo3D({ progress, theme, idleSpin = true, verticalSpin = false }) {
  return (
    <Canvas
      className="lp-logo3d__canvas"
      // Render at 1x (no retina super-sampling) and no MSAA. The logo is small and
      // decorative, so this is visually ~imperceptible but roughly halves the per-frame
      // GPU cost on retina/desktop — the difference between a 14ms and a 7ms frame, which
      // is what makes the scroll feel janky vs. buttery when the leaderboard animates too.
      dpr={1}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 6], fov: 15 }}
      frameloop="demand"
    >
      <ambientLight intensity={1.0} />
      <directionalLight position={[5, 5, 5]} intensity={1.4} />
      <directionalLight position={[-5, -3, -5]} intensity={0.6} />
      <Suspense fallback={null}>
        {/* fit ONCE on mount — no `observe`, so the camera doesn't re-fit as it spins. */}
        <Bounds fit margin={1.2}>
          <LogoModel progress={progress} theme={theme} idleSpin={idleSpin} verticalSpin={verticalSpin} />
        </Bounds>
        <Environment files="/hdri/potsdamer_platz_1k.hdr" />
      </Suspense>
    </Canvas>
  );
}
