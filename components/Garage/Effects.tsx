"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { RigidBody } from "@react-three/rapier";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { CAVE, PARTS, PART_RANGE, partPosition } from "./progress";
import { heightAt, STREAM_HALF_WIDTH, streamDist } from "./heightfield";
import { WATER_LEVEL } from "./Obstacles";

/** True when the truck is actually in the stream, not merely low. */
export function inWater(x: number, y: number, z: number) {
  return streamDist(x, z) < STREAM_HALF_WIDTH && y < WATER_LEVEL + 0.18;
}

/**
 * Splash.
 *
 * A fixed pool of droplets recycled as they die, simulated on the CPU and
 * drawn as one instanced mesh. A few hundred spheres is nothing to draw and
 * everything to the impression that the water is wet.
 */
const MAX_DROPS = 220;

export function Splash() {
  const { scene } = useThree();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geo = useMemo(() => new THREE.IcosahedronGeometry(0.05, 0), []);
  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#cfe6ef", roughness: 0.25, transparent: true, opacity: 0.85 }),
    [],
  );

  const drops = useMemo(
    () =>
      Array.from({ length: MAX_DROPS }, () => ({
        p: new THREE.Vector3(),
        v: new THREE.Vector3(),
        life: 0,
      })),
    [],
  );
  const cursor = useRef(0);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((_, delta) => {
    const d = Math.min(delta, 0.05);
    const car = scene.getObjectByName("rc-car");
    const im = mesh.current;
    if (!im) return;

    if (car) {
      const p = car.position;
      if (inWater(p.x, p.y, p.z)) {
        // Spawn rate follows how hard the wheels are working the water.
        const n = 3;
        for (let i = 0; i < n; i++) {
          const drop = drops[cursor.current];
          cursor.current = (cursor.current + 1) % MAX_DROPS;
          drop.p.set(p.x + (Math.random() - 0.5) * 0.7, WATER_LEVEL + 0.05, p.z + (Math.random() - 0.5) * 0.9);
          drop.v.set((Math.random() - 0.5) * 1.6, 0.9 + Math.random() * 1.5, (Math.random() - 0.5) * 1.6);
          drop.life = 0.5 + Math.random() * 0.4;
        }
      }
    }

    let n = 0;
    for (const drop of drops) {
      if (drop.life <= 0) continue;
      drop.life -= d;
      drop.v.y -= 9 * d;
      drop.p.addScaledVector(drop.v, d);
      if (drop.p.y < WATER_LEVEL) drop.life = 0;
      if (drop.life <= 0) continue;
      dummy.position.copy(drop.p);
      const s = 0.6 + drop.life;
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      im.setMatrixAt(n++, dummy.matrix);
    }
    im.count = n;
    im.instanceMatrix.needsUpdate = true;
  });

  return <instancedMesh ref={mesh} args={[geo, mat, MAX_DROPS]} frustumCulled={false} />;
}

/**
 * The parts, and picking them up.
 *
 * Detection lives here rather than in the driving loop because it is the
 * collectibles' own business, and because they need to know which of them
 * was taken anyway.
 */
export function Collectibles({
  found,
  onFind,
}: {
  found: Set<string>;
  onFind: (id: string) => void;
}) {
  const { scene } = useThree();
  const group = useRef<THREE.Group>(null);
  const spin = useRef(0);

  useFrame((_, delta) => {
    spin.current += delta * 1.4;
    const car = scene.getObjectByName("rc-car");
    if (group.current) {
      group.current.children.forEach((child) => {
        child.rotation.y = spin.current;
        child.position.y = (child.userData.baseY as number) + Math.sin(spin.current * 1.3 + (child.userData.phase as number)) * 0.08;
      });
    }
    if (!car) return;
    for (const part of PARTS) {
      if (found.has(part.id)) continue;
      const [px, , pz] = partPosition(part);
      const dx = car.position.x - px;
      const dz = car.position.z - pz;
      if (dx * dx + dz * dz < PART_RANGE * PART_RANGE) onFind(part.id);
    }
  });

  return (
    <group ref={group}>
      {PARTS.map((part, i) => {
        if (found.has(part.id)) return null;
        const [x, y, z] = partPosition(part);
        return (
          <group key={part.id} position={[x, y, z]} userData={{ baseY: y, phase: i * 1.1 }}>
            <mesh castShadow>
              <boxGeometry args={[0.3, 0.3, 0.3]} />
              <meshStandardMaterial color="#f43c00" emissive="#f43c00" emissiveIntensity={0.5} roughness={0.4} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.42, 0.018, 6, 24]} />
              <meshStandardMaterial color="#f43c00" emissive="#f43c00" emissiveIntensity={1.4} toneMapped={false} />
            </mesh>
            <pointLight distance={3.4} intensity={2.4} color="#ff7a3c" />
          </group>
        );
      })}
    </group>
  );
}

/**
 * The cave on the summit climb.
 *
 * A heightfield cannot have an overhang, so the passage is built on top of
 * the ground rather than carved into it: two rock walls and a slab across
 * them, which from the outside reads as a hole in the hillside and from the
 * inside is a tunnel you can drive.
 */
export function Cave() {
  const [cx, cz] = CAVE.at;
  const y = heightAt(cx, cz);
  const rock = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#453f38", roughness: 0.99, flatShading: true }),
    [],
  );

  return (
    <group position={[cx, y, cz]} rotation={[0, CAVE.rotation, 0]}>
      {[-1, 1].map((s) => (
        <RigidBody key={s} type="fixed" colliders="cuboid">
          <mesh castShadow receiveShadow position={[s * 2.1, 1.1, 0]} rotation={[0, 0, s * 0.06]} material={rock}>
            <boxGeometry args={[1.9, 2.4, 7.5]} />
          </mesh>
        </RigidBody>
      ))}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh castShadow receiveShadow position={[0, 2.35, 0]} material={rock}>
          <boxGeometry args={[6.2, 1.3, 7.5]} />
        </mesh>
      </RigidBody>
      {/* A mouth of broken rock, so it does not read as a doorway. */}
      {[-3.4, 3.4].map((oz) =>
        [-1, 1].map((s) => (
          <mesh
            key={`${oz}-${s}`}
            castShadow
            position={[s * 1.6, 2.1, oz]}
            rotation={[0.2 * s, 0, 0.3 * s]}
            material={rock}
          >
            <dodecahedronGeometry args={[0.95, 0]} />
          </mesh>
        )),
      )}
      <pointLight position={[0, 1.4, 0]} intensity={3} distance={7} color="#ffb765" />
    </group>
  );
}
