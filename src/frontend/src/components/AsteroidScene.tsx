import { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sphere, Line } from '@react-three/drei';
import * as THREE from 'three';

interface Asteroid {
  id: string;
  name: string;
  position: [number, number, number];
  size: number;
  orbit: Array<[number, number, number]>;
}

interface AsteroidSceneProps {
  data: { asteroids: Asteroid[] };
  highlightId?: string | null;
  onSelect?: (id: string) => void;
  resetSignal?: number;
  controlsRef?: React.RefObject<any>;
}

const AsteroidScene = ({ data, highlightId, onSelect, resetSignal, controlsRef }: AsteroidSceneProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const state = useThree();
  const { camera } = state;
  const controls = controlsRef?.current ?? (state as any).controls;
  const targetRef = useRef<THREE.Vector3 | null>(null);

  // compute a visual scale so the scene fits comfortably in view
  const scale = useMemo(() => {
    const pts = data.asteroids.map((a) => new THREE.Vector3(...a.position));
    const maxDist = pts.reduce((m, p) => Math.max(m, p.length()), 0) || 1;
    const desiredMax = 30; // target scene radius in world units
    const s = maxDist > 0 ? desiredMax / maxDist : 1;
    // clamp to avoid extreme scaling
    return Math.max(0.02, Math.min(s, 5));
  }, [data.asteroids]);

  // slow rotation for the whole group
  useFrame(() => {
    if (groupRef.current) groupRef.current.rotation.y += 0.001;

    // animate camera towards target if set
    if (targetRef.current) {
      const t = 0.08; // lerp factor
      // compute desired camera position: offset a bit from target (zoomed out)
      const desired = new THREE.Vector3()
        .copy(targetRef.current)
        .add(new THREE.Vector3(0, 12 * scale, 24 * scale));
      camera.position.lerp(desired, t);
      // smoothly move controls target if available, otherwise lookAt
      if (controls) {
        if (!controls.target) controls.target = new THREE.Vector3();
        controls.target.lerp(targetRef.current, t);
        controls.update();
      } else {
        camera.lookAt(targetRef.current);
      }
    }
  });

  // when highlightId changes, update camera target
  useEffect(() => {
    if (!highlightId) {
      targetRef.current = null;
      return;
    }
    const found = data.asteroids.find((a) => a.id === highlightId);
    if (found) {
      targetRef.current = new THREE.Vector3(...found.position).multiplyScalar(scale);
    }
  }, [highlightId, data.asteroids]);

  // when resetSignal changes, center camera on the Sun (0,0,0)
  useEffect(() => {
    if (typeof resetSignal === 'number') {
      // set immediate camera position farther back so user can click asteroids
      const origin = new THREE.Vector3(0, 0, 0);
      // set a short-lived target for the auto-centering animation (scaled)
      targetRef.current = origin.clone().multiplyScalar(1); // origin unaffected by scale
      const desired = new THREE.Vector3(0, 20 * Math.max(1, scale), 40 * Math.max(1, scale));
      camera.position.copy(desired);
      if (controls) {
        if (!controls.target) controls.target = new THREE.Vector3();
        controls.target.copy(origin);
        try {
          // ensure rotation is allowed on controls
          // @ts-ignore
          if (typeof controls.enableRotate !== 'undefined') controls.enableRotate = true;
          // @ts-ignore
          if (typeof controls.enabled !== 'undefined') controls.enabled = true;
        } catch (e) {
          // ignore if controls shape differs
        }
        controls.update();
      } else {
        camera.lookAt(origin);
      }

      // stop the automatic camera lerp after a short duration so the user can rotate
      const timeout = setTimeout(() => {
        targetRef.current = null;
      }, 600);

      return () => clearTimeout(timeout);
    }
  }, [resetSignal, camera, controls]);



  return (
    <group ref={groupRef}>
      {/* Sun representation */}
      <Sphere args={[2 * Math.max(1, scale), 48, 48]} position={[0, 0, 0]}>
        <meshPhysicalMaterial color="#FFDD33" emissive="#FFAA00" emissiveIntensity={1.0} roughness={0.3} metalness={0.1} />
      </Sphere>
      {/* subtle glow */}
      <Sphere args={[3 * Math.max(1, scale), 32, 32]} position={[0, 0, 0]}>
        <meshBasicMaterial color="#FFEE88" transparent opacity={0.12} depthWrite={false} />
      </Sphere>

      {/* Sun light */}
      <pointLight position={[0, 0, 0]} intensity={4 * Math.max(1, scale)} distance={200 * Math.max(1, scale)} decay={2} />
      <ambientLight intensity={0.12} />

      {/* Asteroids and their orbits */}
      {data.asteroids.map((asteroid) => {
        const isHighlighted = highlightId === asteroid.id;
        const color = isHighlighted ? '#FFA042' : '#909090';
        const scaledPos = (asteroid.position as [number, number, number]).map((v) => v * scale) as [number, number, number];
        return (
          <group key={asteroid.id}>
            {/* Asteroid */}
            <Sphere
              args={[Math.max(asteroid.size * Math.max(0.5, scale), 0.05), 16, 16]}
              position={scaledPos}
              onClick={() => onSelect && onSelect(asteroid.id)}
              onPointerOver={(e) => {
                // show pointer
                // eslint-disable-next-line no-param-reassign
                (e.event as any).stopPropagation();
                document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                document.body.style.cursor = '';
              }}
            >
              <meshPhysicalMaterial
                color={color}
                roughness={0.7}
                metalness={0.05}
                clearcoat={0.1}
                emissive={isHighlighted ? '#FFB070' : '#000000'}
                emissiveIntensity={isHighlighted ? 0.35 : 0}
              />
            </Sphere>

            {/* Orbit path (scaled) */}
            <Line
              points={asteroid.orbit.map((pt) => [(pt[0] * scale) as number, (pt[1] * scale) as number, (pt[2] * scale) as number])}
              color={isHighlighted ? '#FFA042' : '#FFFFFF'}
              lineWidth={0.8}
              opacity={isHighlighted ? 0.6 : 0.18}
              transparent
            />
          </group>
        );
      })}
    </group>
  );
};

export default AsteroidScene;
