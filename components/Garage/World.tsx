"use client";

import { RigidBody } from "@react-three/rapier";
import { useMemo } from "react";
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
      <RockGarden />
      <PitArea />
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

/**
 * A low rock garden. Nothing here is taller than the truck's belly, because
 * the fun of a crawler is picking a line over an obstacle rather than failing
 * to climb it — and because the suspension articulating across these is the
 * clearest signal that this is a crawler and not a buggy.
 */
function RockGarden() {
  const rocks = useMemo(
    () =>
      [
        [-13, 7, 0.32, 1.5, 0.3],
        [-11.4, 8.6, 0.24, 1.1, 1.9],
        [-14.6, 9.2, 0.28, 1.3, 0.8],
        [-12.2, 10.6, 0.2, 1.0, 2.6],
        [-15.4, 6.4, 0.22, 0.9, 1.2],
        [-9.8, 6.2, 0.18, 0.8, 0.4],
      ] as const,
    [],
  );

  return (
    <>
      {rocks.map(([x, z, h, r, spin], i) => (
        <RigidBody key={i} type="fixed" colliders="hull" position={[x, h * 0.45, z]} rotation={[0, spin, 0]}>
          <mesh castShadow receiveShadow scale={[r, h, r * 0.92]}>
            <icosahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#4a443c" roughness={0.98} flatShading />
          </mesh>
        </RigidBody>
      ))}
    </>
  );
}

/**
 * The pit bench, and the whole reason the scale reads correctly: a
 * transmitter, LiPo packs, a charger and a tool tray, all sized against a
 * truck a foot and a half long. Without props like these the yard could be
 * a full-size rally stage.
 */
function PitArea() {
  const bench = <meshStandardMaterial color="#2e2a25" roughness={0.85} />;

  return (
    <group position={[8.5, 0, -20]} rotation={[0, -0.5, 0]}>
      {/* Trestle table */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh castShadow receiveShadow position={[0, 1.1, 0]}>
          <boxGeometry args={[4.4, 0.12, 1.8]} />
          {bench}
        </mesh>
      </RigidBody>
      {[
        [-2, -0.75],
        [2, -0.75],
        [-2, 0.75],
        [2, 0.75],
      ].map(([x, z], i) => (
        <mesh key={i} castShadow position={[x, 0.55, z]}>
          <boxGeometry args={[0.1, 1.1, 0.1]} />
          <meshStandardMaterial color="#1d1b19" roughness={0.8} metalness={0.3} />
        </mesh>
      ))}

      {/* Transmitter, stood on its grip */}
      <group position={[-1.5, 1.32, 0.1]} rotation={[0, 0.4, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.44, 0.3, 0.3]} />
          <meshStandardMaterial color="#17171a" roughness={0.5} />
        </mesh>
        <mesh castShadow position={[0.16, 0.06, 0.18]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.07, 16]} />
          <meshStandardMaterial color="#f43c00" roughness={0.45} />
        </mesh>
        <mesh position={[-0.1, 0.3, 0]}>
          <boxGeometry args={[0.02, 0.32, 0.02]} />
          <meshStandardMaterial color="#8a8a8a" roughness={0.3} metalness={0.8} />
        </mesh>
      </group>

      {/* LiPo packs */}
      {[0, 1, 2].map((i) => (
        <mesh key={i} castShadow position={[-0.2 + i * 0.3, 1.24, -0.45]} rotation={[0, 0.2 * i, 0]}>
          <boxGeometry args={[0.26, 0.14, 0.5]} />
          <meshStandardMaterial color={i === 1 ? "#1f3a6b" : "#20201f"} roughness={0.4} />
        </mesh>
      ))}

      {/* Charger, with a lit display */}
      <group position={[1.1, 1.3, 0.2]}>
        <mesh castShadow>
          <boxGeometry args={[0.6, 0.26, 0.5]} />
          <meshStandardMaterial color="#232326" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.02, 0.255]}>
          <planeGeometry args={[0.34, 0.14]} />
          <meshStandardMaterial color="#2bd08a" emissive="#2bd08a" emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
      </group>

      {/* Tool tray and a few hex drivers */}
      <mesh castShadow position={[2, 1.2, -0.3]}>
        <boxGeometry args={[0.9, 0.08, 0.6]} />
        <meshStandardMaterial color="#3a3a3e" roughness={0.5} metalness={0.4} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[1.72 + i * 0.18, 1.27, -0.3]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.02, 0.02, 0.44, 8]} />
          <meshStandardMaterial color={i % 2 ? "#f43c00" : "#9a9aa0"} roughness={0.4} metalness={0.5} />
        </mesh>
      ))}

      {/* Spare tyres under the bench */}
      {[0, 1].map((i) => (
        <mesh key={i} castShadow position={[-1.6, 0.1 + i * 0.16, -0.4]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.2, 0.09, 8, 16]} />
          <meshStandardMaterial color="#17171a" roughness={0.95} />
        </mesh>
      ))}

      <pointLight position={[0, 2.4, 0.6]} intensity={14} distance={8} color="#ffe6c8" />
    </group>
  );
}
