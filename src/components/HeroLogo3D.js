import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Environment, Center, Bounds, OrbitControls, Html } from '@react-three/drei';

// How far through the scroll the "tip to landscape" phase lasts. Up to here the
// logo tips from upright to flat; after here it spins in place.
const TIP_END = 0.18;
// Spin finishes here (a whole number of turns → face-on), then the logo HOLDS that
// flat, face-on pose to the end so it always rests settled, never mid-spin.
const SPIN_END = 0.85;
// smoothstep ease so the tip eases in and lands softly instead of being linear.
const ease = (t) => t * t * (3 - 2 * t);

// Drives the logo purely from scroll progress (0..1) in two deliberate phases:
//   Phase 1 (0 → TIP_END):  tip from upright (portrait) to landscape, laying it on
//                           its side so the long axis points toward the content (right).
//   Phase 2 (TIP_END → 1):  spin in place around its long axis, staying landscape.
// Outer group = tip, inner group = spin — nesting keeps the two motions independent
// (the spin always tracks the logo's own long axis, whatever the tip).
function LogoModel({ progress }) {
  const { scene } = useGLTF('/model-compressed.glb'); // keeps the authored glass material
  const tipRef = useRef();
  const spinRef = useRef();

  useFrame(() => {
    const p = progress ? progress.get() : 0;        // scroll progress through the section

    // Phase 1 — tip upright → landscape (-90° around Z sends the top to the right).
    const tip = ease(Math.min(p / TIP_END, 1));
    if (tipRef.current) tipRef.current.rotation.z = -tip * (Math.PI / 2);

    // Phase 2 — once flat, spin around the long axis: 2 full turns, completing by
    // SPIN_END and clamped to 1 so it lands (and holds) exactly face-on like the target.
    const spin = Math.min(Math.max((p - TIP_END) / (SPIN_END - TIP_END), 0), 1);
    if (spinRef.current) spinRef.current.rotation.y = spin * Math.PI * 4;
  });

  return (
    <group ref={tipRef}>
      <group ref={spinRef}>
        <Center>
          <primitive object={scene} />
        </Center>
      </group>
    </group>
  );
}

useGLTF.preload('/model-compressed.glb');

export default function HeroLogo3D({ progress }) {
  return (
    <Canvas
      className="lp-logo3d__canvas"
      dpr={[1, 1.5]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: [0, 0, 6], fov: 35 }}
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
        <Bounds fit clip observe margin={1.2}>
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
