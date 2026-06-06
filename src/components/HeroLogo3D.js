import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Environment, Center, Bounds, OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';

// ── Phase boundaries, in JOURNEY progress (0 = top of hero, 1 = end of leaderboard) ──
// PHASE 1 (hero):        0 → HERO_END   — 360° turntable spin + colour journey + grow.
// PHASE 2 (cross):  HERO_END → LB_START — logo travels right→left (handled in Landing).
// PHASE 3 (board): LB_START → LB_END    — tip to LANDSCAPE, then barrel-roll spin.
const HERO_END = 0.2;
const LB_START = 0.3;
const LB_END = 0.86;
const TIP_END = 0.12;   // fraction of phase-3 spent tipping to landscape
const SPIN_TURNS = 2;   // barrel-roll revolutions in phase 3

const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(Math.max(t, 0), 1);

// Face-on correction so the mark faces the camera at progress 0.
const FACE_ROT = { x: -0.2, y: -0.61, z: 0 };

// Colour journey (exact spec hex): Frosted Lilac → Periwinkle Pulse → Velvet Mist.
const COL_START = new THREE.Color('#F3F3F9'); // 0.0 silver-white
const COL_MID = new THREE.Color('#7367FF');   // 0.5 brand purple
const COL_END = new THREE.Color('#9191D1');   // 1.0 muted lavender
const _col = new THREE.Color();

// `progress` is the JOURNEY scroll value (journeyP). The component splits it into the
// hero phase (360° spin + colour) and the leaderboard phase (landscape tip + barrel-roll).
function LogoModel({ progress }) {
  const { scene } = useGLTF('/model-compressed.glb');
  const tipRef = useRef();
  const spinRef = useRef();

  useFrame(() => {
    const jp = progress ? clamp01(progress.get()) : 0;

    // PHASE 1 — hero: one full 360° turntable spin, eased.
    const heroP = clamp01(jp / HERO_END);
    const heroSpin = easeInOut(heroP) * Math.PI * 2;

    // PHASE 3 — leaderboard: tip upright→landscape (Z), then barrel-roll (Y).
    const lbP = clamp01((jp - LB_START) / (LB_END - LB_START));
    const tip = ease(Math.min(lbP / TIP_END, 1));
    const barrel = clamp01((lbP - TIP_END) / (1 - TIP_END)) * Math.PI * 2 * SPIN_TURNS;

    if (tipRef.current) tipRef.current.rotation.z = -tip * (Math.PI / 2);
    // The hero 360° ends face-on (whole turn), so the barrel-roll continues from there.
    if (spinRef.current) spinRef.current.rotation.y = heroSpin + barrel;

    // Colour journey runs over the HERO phase, then HOLDS lavender for the cross + board.
    if (heroP < 0.5) _col.lerpColors(COL_START, COL_MID, heroP * 2);
    else _col.lerpColors(COL_MID, COL_END, (heroP - 0.5) * 2);

    // Bright self-lit material (replaces the dark/laggy glass), recoloured every frame.
    scene.traverse((o) => {
      if (o.isMesh) {
        if (!o.userData._logoLit) {
          o.material = new THREE.MeshStandardMaterial({
            metalness: 0.1,
            roughness: 0.6,
            envMapIntensity: 1.0,
          });
          o.userData._logoLit = true;
        }
        const m = o.material;
        if (m.color) m.color.copy(_col);
        m.emissive.copy(_col);
        m.emissiveIntensity = 0.55;
      }
    });
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
      dpr={[1, 1.25]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 6], fov: 15 }}
      frameloop="always"
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
      <OrbitControls enableZoom={false} enablePan={false} />
    </Canvas>
  );
}
