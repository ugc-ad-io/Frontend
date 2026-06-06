import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Environment, Center, Bounds, OrbitControls, Html } from '@react-three/drei';

// How far through the spin-progress the "tip to landscape" lasts: it lays the logo
// on its side (long axis horizontal → pointing at the leaderboard text) quickly, then
// barrel-rolls for the rest. Kept small so the landscape spin starts early.
const TIP_END = 0.05;
// Number of full barrel-roll revolutions. WHOLE number → ends settled face-flat.
const SPIN_TURNS = 2;
// smoothstep ease so the tip eases in and lands softly instead of being linear.
const ease = (t) => t * t * (3 - 2 * t);

// Resting/face-on correction for the GLB. The authored model is turned + pitched
// (we see its top and left side faces), so we counter-rotate it to sit flat and
// face the camera at progress 0. Tune if still off:
//   y = turn left/right (more negative = turn its face toward us / hide left side)
//   x = pitch up/down   (more negative = drop the top back so we stop seeing the top)
//   z = roll (lean)
const FACE_ROT = { x: -0.2, y: -0.61, z: 0 };

// Two phases, both driven by scroll progress (0..1):
//   Phase 1 (0 → TIP_END): tip upright → LANDSCAPE (-90° about Z), long axis pointing
//                          right toward the leaderboard text.
//   Phase 2 (TIP_END → 1): barrel-roll around that long axis for the WHOLE remaining
//                          scroll, so it spins continuously and never freezes early.
// Outer group = tip, inner group = spin (nested so the roll tracks the long axis).
function LogoModel({ progress }) {
  const { scene } = useGLTF('/model-compressed.glb'); // keeps the authored glass material
  const tipRef = useRef();
  const spinRef = useRef();

  useFrame(() => {
    const p = progress ? progress.get() : 0;          // scroll progress through the section

    const tip = ease(Math.min(p / TIP_END, 1));
    if (tipRef.current) tipRef.current.rotation.z = -tip * (Math.PI / 2);

    const spin = Math.min(Math.max((p - TIP_END) / (1 - TIP_END), 0), 1);
    if (spinRef.current) spinRef.current.rotation.y = spin * Math.PI * 2 * SPIN_TURNS;
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
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 5, 5]} intensity={1.2} />
      <directionalLight position={[-5, -3, -5]} intensity={0.5} />
      <Suspense
        fallback={
          <Html center>
            <div className="lp-logo3d__loading">Loading…</div>
          </Html>
        }
      >
        {/* fit ONCE on mount — no `observe`, so the camera does NOT re-fit as the
            logo spins (re-fitting made it drift/resize). `clip` dropped too so the
            extruded depth isn't clipped when it rotates toward the camera. */}
        <Bounds fit margin={1.2}>
          <LogoModel progress={progress} />
        </Bounds>
        {/* Self-hosted from /public to avoid the cross-origin HDR fetch drei's
            `preset` does (raw.githack.com), which the deployed site blocks via CORS.
            potsdamer_platz_1k.hdr is exactly what preset="city" resolves to. */}
        <Environment files="/hdri/potsdamer_platz_1k.hdr" />
      </Suspense>
      <OrbitControls enableZoom={false} enablePan={false} />
    </Canvas>
  );
}
