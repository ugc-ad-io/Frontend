import { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, Environment, Center, Bounds, OrbitControls, Html } from '@react-three/drei';

// Loads the glass logo and rotates it from scroll progress (0..1) plus a gentle idle drift.
function LogoModel({ progress }) {
  const { scene } = useGLTF('/model-compressed.glb'); // keeps the authored glass material
  const ref = useRef();
  const idle = useRef(0);

  useFrame((_, delta) => {
    if (!ref.current) return;
    const p = progress ? progress.get() : 0;      // scroll progress through the section
    idle.current += delta * 0.12;                  // slow continuous drift so it never feels frozen
    ref.current.rotation.y = p * Math.PI * 2 + idle.current; // left-right spin (scroll + idle)
    ref.current.rotation.x = p * Math.PI * 2;                // top-to-bottom tumble across the scroll
  });

  return (
    <group ref={ref}>
      <Center>
        <primitive object={scene} />
      </Center>
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
        <Environment preset="city" />
      </Suspense>
      <OrbitControls enableZoom={false} enablePan={false} />
    </Canvas>
  );
}
