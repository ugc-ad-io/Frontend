import { Suspense, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Environment, Center, Bounds, OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';

// Resting/face-on correction for the GLB so it faces the camera at progress 0; the
// scroll-driven Y spin is applied on top of this base orientation.
const FACE_ROT = { x: -0.2, y: -0.61, z: 0 };

// ease-in-out — spin / scale / colour accelerate in then settle out (per spec).
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

// Logo colour journey (exact spec hex): Frosted Lilac → Periwinkle Pulse → Velvet Mist.
const COL_START = new THREE.Color('#F3F3F9'); // 0.0 silver-white
const COL_MID = new THREE.Color('#7367FF');   // 0.5 brand purple
const COL_END = new THREE.Color('#9191D1');   // 1.0 muted lavender
const COL_RIM_BASE = new THREE.Color('#ffffff');
const _logoCol = new THREE.Color();
const _rimCol = new THREE.Color();

// Single scroll gesture: Y-rotation (0→720°), colour (silver→purple→lavender) and the
// rim-light tint all update together every frame from the same eased progress.
function LogoModel({ progress }) {
  const { scene } = useGLTF('/model-compressed.glb');
  const spinRef = useRef();
  const rimRef = useRef();

  // Replace the authored GLASS material (transmission = an expensive extra render pass
  // EVERY frame → the lag, and it washes out the colour) with an opaque metallic
  // MeshStandardMaterial: cheap to render, reflects the env map, takes colour vividly.
  const materials = useMemo(() => {
    const mats = [];
    scene.traverse((o) => {
      if (o.isMesh) {
        o.material = new THREE.MeshStandardMaterial({
          color: COL_START.clone(),
          metalness: 0.65,
          roughness: 0.28,
          envMapIntensity: 1.1,
        });
        mats.push(o.material);
      }
    });
    return mats;
  }, [scene]);

  useFrame(() => {
    const p = progress ? Math.min(Math.max(progress.get(), 0), 1) : 0;
    const e = easeInOut(p);

    // Y-axis rotation: 0° → 720° (two full spins), eased.
    if (spinRef.current) spinRef.current.rotation.y = e * Math.PI * 4;

    // Colour: lerp through the two halves of the journey.
    if (e < 0.5) _logoCol.lerpColors(COL_START, COL_MID, e * 2);
    else _logoCol.lerpColors(COL_MID, COL_END, (e - 0.5) * 2);
    for (let i = 0; i < materials.length; i++) {
      if (materials[i].color) materials[i].color.copy(_logoCol);
    }

    // Rim light eases toward the logo colour at 55% strength.
    if (rimRef.current) {
      _rimCol.copy(COL_RIM_BASE).lerp(_logoCol, 0.55);
      rimRef.current.color.copy(_rimCol);
    }
  });

  return (
    <>
      {/* Rim light (static — NOT inside the spin group) tints toward the logo colour. */}
      <directionalLight ref={rimRef} position={[-5, 3, -4]} intensity={1.1} />
      <group ref={spinRef}>
        <group rotation={[FACE_ROT.x, FACE_ROT.y, FACE_ROT.z]}>
          <Center>
            <primitive object={scene} />
          </Center>
        </group>
      </group>
    </>
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
