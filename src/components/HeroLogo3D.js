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
const SPIN_TURNS = 2;
// The moment the 11th (last) row hits the 50% focus (~0.86) the logo crosses to centre and
// UN-TILTS back to STRAIGHT over DISSOLVE_START→END, arriving upright at the middle to dissolve.
const DISSOLVE_START = 0.86;
const DISSOLVE_END = 0.96;

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
const COL_START = new THREE.Color('#FFFFFF'); // 0.0 white
const COL_MID = new THREE.Color('#7367FF');   // 0.5 light periwinkle (brand)
const COL_END = new THREE.Color('#2C2C92');   // 1.0 royal-blue / indigo (final stop)
const _col = new THREE.Color();

// `progress` is the JOURNEY scroll value (journeyP). The component splits it into the
// hero phase (360° spin + colour) and the leaderboard phase (landscape tip + barrel-roll).
function LogoModel({ progress }) {
  const { scene } = useGLTF('/model-compressed.glb');
  const tipRef = useRef();
  const spinRef = useRef();
  const meshesRef = useRef(null);   // lit meshes, cached once (no per-frame scene.traverse)
  const colourKeyRef = useRef(-1);  // last applied colour step — skips redundant recolours

  // On-demand rendering: only render a frame when the scroll value actually changes (i.e.
  // while scrolling), instead of burning a full-screen WebGL render every frame forever.
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    if (!progress) return;
    const unsub = progress.on('change', invalidate);
    invalidate(); // first paint
    return unsub;
  }, [progress, invalidate]);

  useFrame(() => {
    const jp = progress ? clamp01(progress.get()) : 0;

    // PHASE 1 — hero: one full 360° turntable spin, eased.
    const heroP = clamp01(jp / HERO_END);
    const heroSpin = easeInOut(heroP) * Math.PI * 2;

    // Tilt to landscape (Z) — leans over after the spin (TIP_START→TIP_FINISH), HOLDS
    // landscape across the board, then UN-TILTS back to straight during the dissolve so it
    // melts into the brand-strip card upright (portrait), not landscape.
    let tip = ease(clamp01((jp - TIP_START) / (TIP_FINISH - TIP_START)));
    if (jp >= DISSOLVE_START) tip = 1 - ease(clamp01((jp - DISSOLVE_START) / (DISSOLVE_END - DISSOLVE_START)));

    // PHASE 3 — barrel-roll while the leaderboard scrolls (keeps the landscape logo alive).
    // EASED (not linear): the hero 360° decelerates to a hold at 0.3, so the barrel must
    // also ramp its velocity up FROM zero at 0.67 and back DOWN to zero at 0.86 — otherwise
    // the spin kicks in (and stops) with a hard jolt. easeInOut gives C1 continuity at both
    // ends, so rotate → hold → spin → dissolve reads as one continuous, smooth motion.
    const barrel = spinProfile(clamp01((jp - LB_SPIN_START) / (LB_SPIN_END - LB_SPIN_START))) * Math.PI * 2 * SPIN_TURNS;

    // Tip exactly 90° (clean landscape), negative direction so the point faces the text.
    if (tipRef.current) tipRef.current.rotation.z = -tip * (Math.PI / 2);
    // The hero 360° caps at a full turn (face-on); the barrel-roll continues from there.
    if (spinRef.current) spinRef.current.rotation.y = heroSpin + barrel;

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
      if (heroP < 0.5) _col.lerpColors(COL_START, COL_MID, heroP * 2);
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

export default function HeroLogo3D({ progress }) {
  return (
    <Canvas
      className="lp-logo3d__canvas"
      dpr={1}
      gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 6], fov: 15 }}
      frameloop="demand"
    >
      <ambientLight intensity={1.0} />
      <directionalLight position={[5, 5, 5]} intensity={1.4} />
      <directionalLight position={[-5, -3, -5]} intensity={0.6} />
      <Suspense
        fallback={
          <Html center>
            <div className="lp-logo3d__loading">Loading…</div>
          </Html>
        }
      >
        {/* fit ONCE on mount — no `observe`, so the camera doesn't re-fit as it spins. */}
        <Bounds fit margin={1.2}>
          <LogoModel progress={progress} />
        </Bounds>
        <Environment files="/hdri/potsdamer_platz_1k.hdr" />
      </Suspense>
    </Canvas>
  );
}
