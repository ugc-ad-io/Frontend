import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Environment, Center, Bounds, OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';

// ease-in-out so the 360° spin / colour accelerate in then settle out.
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// Resting/face-on correction for the GLB so it faces the camera at progress 0; the
// 360° Y spin is applied on top of this base orientation.
const FACE_ROT = { x: -0.2, y: -0.61, z: 0 };

// Colour journey (exact spec hex): Frosted Lilac → Periwinkle Pulse → Velvet Mist.
const COL_START = new THREE.Color('#F3F3F9'); // 0.0 silver-white
const COL_MID = new THREE.Color('#7367FF');   // 0.5 brand purple
const COL_END = new THREE.Color('#9191D1');   // 1.0 muted lavender
const _col = new THREE.Color();

// Single scroll gesture: a 360° Y-rotation and the colour transition update together
// from the same eased progress (the logo also GROWS via CSS scale on the overlay).
function LogoModel({ progress }) {
  const { scene } = useGLTF('/model-compressed.glb');
  const spinRef = useRef();

  useFrame(() => {
    const p = progress ? Math.min(Math.max(progress.get(), 0), 1) : 0;
    const e = easeInOut(p);

    // ONE full 360° turntable spin (not a tip / vertical motion).
    if (spinRef.current) spinRef.current.rotation.y = e * Math.PI * 2;

    // Colour: silver-white → purple → lavender across the two halves.
    if (e < 0.5) _col.lerpColors(COL_START, COL_MID, e * 2);
    else _col.lerpColors(COL_MID, COL_END, (e - 0.5) * 2);

    // Replace the cached GLTF's dark/laggy GLASS material with a bright self-lit one
    // (guarded per mesh — useGLTF caches the scene, so a one-time swap wouldn't re-apply
    // after hot-reload). Then drive colour + emissive every frame so the mark stays
    // clearly visible at every angle AND shifts through the colour journey.
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
    <group ref={spinRef}>
      <group rotation={[FACE_ROT.x, FACE_ROT.y, FACE_ROT.z]}>
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
