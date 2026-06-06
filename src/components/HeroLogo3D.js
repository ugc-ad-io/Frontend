import { Suspense, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Environment, Center, Bounds, OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';

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
// face the camera at progress 0.
const FACE_ROT = { x: -0.2, y: -0.61, z: 0 };

// Bright silver-white so the mark reads clearly on the dark stage.
const LOGO_COLOR = new THREE.Color('#EDEDF4');
// Self-illumination colour — keeps the mark glowing bright at every angle.
const LOGO_EMISSIVE = new THREE.Color('#E6E6F2');

// Tip → landscape, then barrel-roll (unchanged choreography). The GLASS material is
// replaced with a BRIGHT opaque metallic one: it's clearly visible on the dark bg and
// far cheaper to render (no per-frame transmission pass → no lag).
function LogoModel({ progress }) {
  const { scene } = useGLTF('/model-compressed.glb');
  const tipRef = useRef();
  const spinRef = useRef();
  const matsRef = useRef([]);

  // Swap the (dark, laggy) glass material for an opaque one and keep a handle on the
  // materials so we can keep their look enforced every frame (HMR-robust).
  useMemo(() => {
    const mats = [];
    scene.traverse((o) => {
      if (o.isMesh) {
        o.material = new THREE.MeshStandardMaterial({
          color: LOGO_COLOR.clone(),
          metalness: 0.1,
          roughness: 0.6,
          envMapIntensity: 1.0,
          emissive: LOGO_EMISSIVE.clone(),
        });
        mats.push(o.material);
      }
    });
    matsRef.current = mats;
  }, [scene]);

  useFrame(() => {
    const p = progress ? progress.get() : 0;

    const tip = ease(Math.min(p / TIP_END, 1));
    if (tipRef.current) tipRef.current.rotation.z = -tip * (Math.PI / 2);

    const spin = Math.min(Math.max((p - TIP_END) / (1 - TIP_END), 0), 1);
    if (spinRef.current) spinRef.current.rotation.y = spin * Math.PI * 2 * SPIN_TURNS;

    // STRONG self-illumination enforced every frame: the mark glows its own bright
    // silver so it stays fully visible at EVERY angle/position — independent of lights,
    // reflections or how it's turned. This is what kills the scroll-up dimming, and
    // setting it here (not just at creation) means hot-reload picks it up live.
    for (let i = 0; i < matsRef.current.length; i++) {
      matsRef.current[i].emissiveIntensity = 0.9;
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
