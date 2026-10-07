"use client";

import { RigidBody } from "@react-three/rapier";
import * as THREE from "three";

/**
 * A compact, art-directed miniature rather than an open world: a concrete
 * pad with a dirt infield, the garage block, a run of ramps, and the kind of
 * clutter an RC track actually has — barriers, tyre stacks, cones, markers.
 *
 * Everything is a primitive with a PBR material. Scale is deliberate: the car
 * is 1.5 units long, so a 60-unit pad reads as a yard, not a motorway.
 */
export function World() {
  return (
    <>
      {/* Ground. A slab rather than a plane: a zero-thickness collider is
          precisely what a fast body tunnels through, and this one did. The top
          face sits at y = 0 so everything else can be placed from zero. */}
      <RigidBody type="fixed" friction={1.4} colliders="cuboid">
        <mesh position={[0, -1, 0]} receiveShadow>
          <boxGeometry args={[120, 2, 120]} />
          <meshStandardMaterial color="#2a2825" roughness={0.95} />
        </mesh>
      </RigidBody>

      {/* Dirt infield — visual only, the pad underneath carries the collision */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, -4]} receiveShadow>
        <circleGeometry args={[16, 48]} />
        <meshStandardMaterial color="#3d3228" roughness={1} />
      </mesh>

      <Garage />
      <Ramp position={[-9, 0, -2]} rotation={-0.25} />
      <Ramp position={[10, 0, -8]} rotation={2.6} />
      <Barriers />
      <TyreStacks />
      <Cones />
      <Perimeter />
    </>
  );
}

/** The garage block: three walls and a roof, open on the approach side. */
function Garage() {
  const wall = <meshStandardMaterial color="#1d1d1d" roughness={0.8} metalness={0.1} />;
  return (
    <group position={[0, 0, -22]}>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh castShadow receiveShadow position={[0, 2.4, -4]}>
          <boxGeometry args={[16, 4.8, 0.4]} />
          {wall}
        </mesh>
        <mesh castShadow receiveShadow position={[-7.8, 2.4, -1.8]}>
          <boxGeometry args={[0.4, 4.8, 4.8]} />
          {wall}
        </mesh>
        <mesh castShadow receiveShadow position={[7.8, 2.4, -1.8]}>
          <boxGeometry args={[0.4, 4.8, 4.8]} />
          {wall}
        </mesh>
        <mesh castShadow receiveShadow position={[0, 4.9, -1.8]}>
          <boxGeometry args={[16, 0.3, 5]} />
          <meshStandardMaterial color="#2a2a2a" roughness={0.7} metalness={0.2} />
        </mesh>
      </RigidBody>

      {/* Display shelf — the collection stands here once there is one */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh castShadow receiveShadow position={[0, 0.9, -3.4]}>
          <boxGeometry args={[13, 0.25, 1]} />
          <meshStandardMaterial color="#3a3027" roughness={0.85} />
        </mesh>
      </RigidBody>

      {/* A warm wash inside, so the building reads as occupied */}
      <pointLight position={[0, 3.4, -2]} intensity={28} distance={16} color="#ffd9b0" />
    </group>
  );
}

function Ramp({ position, rotation }: { position: [number, number, number]; rotation: number }) {
  return (
    <RigidBody type="fixed" colliders="trimesh" position={position} rotation={[0, rotation, 0]}>
      <mesh castShadow receiveShadow rotation={[-0.3, 0, 0]} position={[0, 0.5, 0]}>
        <boxGeometry args={[4, 0.25, 4]} />
        <meshStandardMaterial color="#4a3a2a" roughness={0.9} />
      </mesh>
    </RigidBody>
  );
}

function Barriers() {
  const spots: [number, number, number][] = [
    [-14, 0.4, -14],
    [14, 0.4, -14],
    [-18, 0.4, 4],
    [18, 0.4, 4],
  ];
  return (
    <>
      {spots.map((p, i) => (
        <RigidBody key={i} type="fixed" colliders="cuboid" position={p}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[5, 0.8, 0.5]} />
            <meshStandardMaterial color="#6b6b6b" roughness={0.9} />
          </mesh>
        </RigidBody>
      ))}
    </>
  );
}

/** Loose tyres: dynamic, so clipping a stack scatters it. */
function TyreStacks() {
  const stacks: [number, number][] = [
    [-6, 10],
    [7, 11],
    [-16, -6],
    [16, -4],
  ];
  return (
    <>
      {stacks.flatMap(([x, z], s) =>
        [0, 1, 2].map((tier) => (
          <RigidBody
            key={`${s}-${tier}`}
            colliders="hull"
            position={[x, 0.22 + tier * 0.34, z]}
            mass={0.35}
            restitution={0.3}
          >
            <mesh castShadow receiveShadow rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.34, 0.15, 10, 20]} />
              <meshStandardMaterial color="#17171a" roughness={0.95} />
            </mesh>
          </RigidBody>
        )),
      )}
    </>
  );
}

/** Cones mark the line; they are knockable, which is most of the fun. */
function Cones() {
  const line: [number, number][] = [
    [-4, 2], [-2, 4], [0, 5], [2, 4], [4, 2],
    [-10, -10], [-6, -13], [0, -14], [6, -13], [10, -10],
  ];
  return (
    <>
      {line.map(([x, z], i) => (
        <RigidBody key={i} colliders="hull" position={[x, 0.3, z]} mass={0.12} restitution={0.2}>
          <mesh castShadow>
            <coneGeometry args={[0.22, 0.56, 14]} />
            <meshStandardMaterial color="#f43c00" roughness={0.6} />
          </mesh>
        </RigidBody>
      ))}
    </>
  );
}

/** A low kerb so the car stays in the art-directed area. */
function Perimeter() {
  const r = 34;
  const segments = 28;
  return (
    <>
      {Array.from({ length: segments }).map((_, i) => {
        const a = (i / segments) * Math.PI * 2;
        return (
          <RigidBody
            key={i}
            type="fixed"
            colliders="cuboid"
            position={[Math.cos(a) * r, 0.3, Math.sin(a) * r]}
            rotation={[0, -a, 0]}
          >
            <mesh receiveShadow castShadow>
              <boxGeometry args={[0.6, 0.6, (2 * Math.PI * r) / segments + 0.4]} />
              <meshStandardMaterial color="#232323" roughness={0.9} />
            </mesh>
          </RigidBody>
        );
      })}
    </>
  );
}
