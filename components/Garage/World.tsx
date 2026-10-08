"use client";

import { RigidBody } from "@react-three/rapier";
import { Cave, Collectibles, Splash } from "./Effects";
import { LogBridge, Ramp, RockCrawl, RopeBridge, Scatter, Stream, TyreObstacles } from "./Obstacles";
import { ROPE_BRIDGE } from "./progress";
import { Terrain } from "./Terrain";
import { heightAt, PLACES } from "./heightfield";

/**
 * An RC crawler park, not a circuit.
 *
 * The ground does the work: it climbs from a graded trailhead in the
 * south-east, through a rock field and a stream, up a canyon, to a summit
 * about seventy centimetres above where you started — four and a half truck
 * lengths of climb at 1/30. Everything built on top of it is placed by
 * sampling the terrain, so nothing floats and nothing is buried.
 *
 * There is no single route. From the trailhead you can take the stream
 * stones or the plank bridge, the rock field or the graded track around it,
 * the log bridge or the long way, and the canyon or the rope crossing above
 * it.
 */
export function World({ found, onFind }: { found: Set<string>; onFind: (id: string) => void }) {
  return (
    <>
      <Terrain />

      <Pit />
      <RockCrawl centre={[PLACES.rockCrawl.x, PLACES.rockCrawl.z]} />
      <Stream
        from={[PLACES.stream.from.x, PLACES.stream.from.z]}
        to={[PLACES.stream.to.x, PLACES.stream.to.z]}
      />

      {/* Two ways over the water in the west, and a way across the canyon. */}
      <LogBridge at={[-26, 19]} span={10} />
      <RopeBridge from={ROPE_BRIDGE.from} to={ROPE_BRIDGE.to} />

      {/* Timber, graded small to large as you work north. */}
      <Ramp at={[9, 30]} size="s" rotation={0.1} />
      <Ramp at={[-6, 26]} size="m" rotation={Math.PI} />
      <Ramp at={[-13, 30]} size="l" rotation={-0.35} />

      <TyreObstacles at={[14, 31]} />
      <Cave />
      <TrailMarkers />
      <Scatter />
      <Collectibles found={found} onFind={onFind} />
      <Splash />
    </>
  );
}

/**
 * The pit: where the truck lives when it is not out. Graded flat by the
 * terrain function, so the shed sits level without being propped up.
 */
function Pit() {
  const { x, z } = PLACES.pit;
  const y = heightAt(x, z);

  return (
    <group position={[x, y, z]} rotation={[0, -0.6, 0]}>
      <Shed />
      <Bench />
      <pointLight position={[0, 3.4, 2]} intensity={26} distance={16} color="#ffd9b0" />
    </group>
  );
}

/** Three walls and a roof, open on the approach side. */
function Shed() {
  const wall = <meshStandardMaterial color="#232323" roughness={0.82} metalness={0.08} />;
  return (
    <group position={[0, 0, -4]}>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh castShadow receiveShadow position={[0, 2.4, -4]}>
          <boxGeometry args={[16, 4.8, 0.4]} />
          {wall}
        </mesh>
        {[-7.8, 7.8].map((wx) => (
          <mesh key={wx} castShadow receiveShadow position={[wx, 2.4, -1.8]}>
            <boxGeometry args={[0.4, 4.8, 4.8]} />
            {wall}
          </mesh>
        ))}
        <mesh castShadow receiveShadow position={[0, 4.9, -1.8]}>
          <boxGeometry args={[16, 0.3, 5]} />
          <meshStandardMaterial color="#2c2c2c" roughness={0.72} metalness={0.18} />
        </mesh>
      </RigidBody>
    </group>
  );
}

/** The bench, which is most of what tells you how big the truck is. */
function Bench() {
  const top = <meshStandardMaterial color="#332e27" roughness={0.86} />;
  return (
    <group position={[7.5, 0, 4]} rotation={[0, -0.5, 0]}>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh castShadow receiveShadow position={[0, 1.1, 0]}>
          <boxGeometry args={[4.4, 0.12, 1.8]} />
          {top}
        </mesh>
      </RigidBody>
      {[
        [-2, -0.75],
        [2, -0.75],
        [-2, 0.75],
        [2, 0.75],
      ].map(([lx, lz], i) => (
        <mesh key={i} castShadow position={[lx, 0.55, lz]}>
          <boxGeometry args={[0.1, 1.1, 0.1]} />
          <meshStandardMaterial color="#1d1b19" roughness={0.8} metalness={0.3} />
        </mesh>
      ))}

      {/* Transmitter, packs, charger, drivers — the scale cues. */}
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
      {[0, 1, 2].map((i) => (
        <mesh key={i} castShadow position={[-0.2 + i * 0.3, 1.24, -0.45]} rotation={[0, 0.2 * i, 0]}>
          <boxGeometry args={[0.26, 0.14, 0.5]} />
          <meshStandardMaterial color={i === 1 ? "#1f3a6b" : "#20201f"} roughness={0.4} />
        </mesh>
      ))}
      <group position={[1.1, 1.3, 0.2]}>
        <mesh castShadow>
          <boxGeometry args={[0.6, 0.26, 0.5]} />
          <meshStandardMaterial color="#232326" roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.02, 0.255]}>
          <planeGeometry args={[0.34, 0.14]} />
          <meshStandardMaterial color="#2bd08a" emissive="#2bd08a" emissiveIntensity={1.3} toneMapped={false} />
        </mesh>
      </group>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[1.72 + i * 0.18, 1.27, -0.3]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.02, 0.02, 0.44, 8]} />
          <meshStandardMaterial color={i % 2 ? "#f43c00" : "#9a9aa0"} roughness={0.4} metalness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Course markers: a stake and a strip of tape, the way a real course is
 * flagged. They mark the lines without fencing anything in.
 */
function TrailMarkers() {
  const spots: [number, number][] = [
    [6, 30], [0, 27], [-7, 22], [-15, 16], [-22, 12],
    [-18, -2], [-8, -8], [2, -14], [10, -20], [4, -27],
    [18, 12], [19, 2], [17, -10],
  ];
  return (
    <>
      {spots.map(([x, z], i) => {
        const y = heightAt(x, z);
        return (
          <group key={i} position={[x, y, z]} rotation={[0, i * 1.7, 0]}>
            <mesh castShadow position={[0, 0.42, 0]}>
              <cylinderGeometry args={[0.035, 0.035, 0.85, 6]} />
              <meshStandardMaterial color="#6d5637" roughness={0.9} />
            </mesh>
            <mesh position={[0.11, 0.74, 0]} rotation={[0, 0, -0.25]}>
              <planeGeometry args={[0.26, 0.17]} />
              <meshStandardMaterial
                color={i % 3 === 0 ? "#f43c00" : "#d8d2c6"}
                roughness={0.8}
                side={2}
              />
            </mesh>
          </group>
        );
      })}
    </>
  );
}
