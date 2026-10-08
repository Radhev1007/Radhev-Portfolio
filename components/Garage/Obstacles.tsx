"use client";

import { useFrame } from "@react-three/fiber";
import { RigidBody } from "@react-three/rapier";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { heightAt, normalAt } from "./heightfield";

/**
 * The things built on top of the ground: rock, water, timber.
 *
 * Everything here is placed by sampling the terrain rather than by eye, so a
 * change to the height function moves the obstacles with it instead of
 * leaving them buried or floating. Shapes are seeded and deterministic for
 * the same reason the terrain is.
 */

export const WATER_LEVEL = -0.78;

const ROCK_MAT = new THREE.MeshStandardMaterial({ color: "#5a554c", roughness: 0.98, flatShading: true });
const ROCK_DARK = new THREE.MeshStandardMaterial({ color: "#45403a", roughness: 0.98, flatShading: true });
const WOOD = new THREE.MeshStandardMaterial({ color: "#5c4529", roughness: 0.88 });
const WOOD_PALE = new THREE.MeshStandardMaterial({ color: "#6d5637", roughness: 0.9 });
const ROPE = new THREE.MeshStandardMaterial({ color: "#6b5d43", roughness: 1 });
const RUBBER = new THREE.MeshStandardMaterial({ color: "#17171a", roughness: 0.95 });
const MOSS_MAT = new THREE.MeshStandardMaterial({ color: "#44512c", roughness: 1 });

function rand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s ^ (s >>> 15), 2246822519) + 1) >>> 0;
    return ((s ^ (s >>> 13)) >>> 0) / 4294967295;
  };
}

/** A weathered boulder: an icosahedron pushed about by seeded noise. */
function rockGeometry(seed: number, detail = 1) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const r = rand(seed);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const offs = Array.from({ length: 12 }, () => r() * 2 - 1);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n =
      offs[0] * Math.sin(v.x * 2.1 + offs[1] * 3) +
      offs[2] * Math.sin(v.y * 1.7 + offs[3] * 3) +
      offs[4] * Math.sin(v.z * 2.4 + offs[5] * 3);
    v.multiplyScalar(1 + n * 0.13);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function Rock({
  at,
  scale,
  seed,
  sink = 0.35,
  dark = false,
}: {
  at: [number, number];
  scale: [number, number, number];
  seed: number;
  sink?: number;
  dark?: boolean;
}) {
  const geo = useMemo(() => rockGeometry(seed), [seed]);
  const r = useMemo(() => rand(seed + 7), [seed]);
  const [x, z] = at;
  const y = heightAt(x, z) + scale[1] * (1 - sink);
  return (
    <RigidBody type="fixed" colliders="hull" position={[x, y, z]} rotation={[r() * 0.5 - 0.25, r() * 6.28, r() * 0.5 - 0.25]}>
      <mesh geometry={geo} scale={scale} material={dark ? ROCK_DARK : ROCK_MAT} castShadow receiveShadow />
    </RigidBody>
  );
}

/** The technical field: pick a line or get cross-axled. */
export function RockCrawl({ centre }: { centre: [number, number] }) {
  const rocks = useMemo(() => {
    const r = rand(9281);
    const out: { at: [number, number]; scale: [number, number, number]; seed: number }[] = [];
    for (let i = 0; i < 26; i++) {
      const a = r() * Math.PI * 2;
      const d = 1.5 + r() * 11;
      const s = 0.5 + r() * 1.5;
      out.push({
        at: [centre[0] + Math.cos(a) * d, centre[1] + Math.sin(a) * d],
        scale: [s * (0.8 + r() * 0.5), s * (0.5 + r() * 0.45), s * (0.8 + r() * 0.5)],
        seed: 100 + i * 13,
      });
    }
    return out;
  }, [centre]);

  return (
    <>
      {rocks.map((rk, i) => (
        <Rock key={i} {...rk} dark={i % 3 === 0} />
      ))}
    </>
  );
}

/** Shallow water, with ripples rather than a mirror. */
function Water({ from, to, width }: { from: [number, number]; to: [number, number]; width: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => {
    const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
    return new THREE.PlaneGeometry(len + 6, width, 48, 10);
  }, [from, to, width]);
  const base = useMemo(() => Float32Array.from((geo.attributes.position as THREE.BufferAttribute).array), [geo]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const pos = geo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3];
      const y = base[i * 3 + 1];
      pos.setZ(i, Math.sin(x * 1.6 + t * 1.9) * 0.022 + Math.sin(y * 2.4 - t * 1.3) * 0.016);
    }
    pos.needsUpdate = true;
    if (ref.current) ref.current.position.y = WATER_LEVEL;
  });

  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const mid: [number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];

  return (
    <mesh
      ref={ref}
      geometry={geo}
      position={[mid[0], WATER_LEVEL, mid[1]]}
      rotation={[-Math.PI / 2, 0, -angle]}
    >
      <meshStandardMaterial
        color="#20343a"
        roughness={0.08}
        metalness={0.5}
        transparent
        opacity={0.76}
      />
    </mesh>
  );
}

/**
 * The crossing. Two ways over: pick your way across the stones, or take the
 * plank bridge — which is easier, and therefore less interesting.
 */
export function Stream({ from, to }: { from: [number, number]; to: [number, number] }) {
  const stones = useMemo(() => {
    const r = rand(4471);
    return Array.from({ length: 7 }, (_, i) => {
      const t = 0.26 + i * 0.075;
      const x = from[0] + (to[0] - from[0]) * t + (r() - 0.5) * 1.2;
      const z = from[1] + (to[1] - from[1]) * t + (r() - 0.5) * 2.4;
      return { at: [x, z] as [number, number], s: 0.55 + r() * 0.35, seed: 400 + i * 17 };
    });
  }, [from, to]);

  return (
    <group>
      <Water from={from} to={to} width={7.5} />
      {stones.map((s, i) => (
        <Rock key={i} at={s.at} scale={[s.s * 1.4, s.s * 0.8, s.s * 1.4]} seed={s.seed} sink={0.72} />
      ))}
      <PlankBridge at={[12, 21.3]} length={9} width={3.1} rotation={0.08} />
    </group>
  );
}

/** Rough sawn planks on two stringers. The easy way over the water. */
export function PlankBridge({
  at,
  length,
  width,
  rotation = 0,
}: {
  at: [number, number];
  length: number;
  width: number;
  rotation?: number;
}) {
  const [x, z] = at;
  const deck = Math.max(heightAt(x, z - length / 2), heightAt(x, z + length / 2)) + 0.55;
  const planks = Math.round(length / 0.62);
  const r = useMemo(() => rand(777), []);

  return (
    <group position={[x, deck, z]} rotation={[0, rotation, 0]}>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh castShadow receiveShadow position={[0, -0.1, 0]}>
          <boxGeometry args={[width, 0.16, length]} />
          <primitive object={WOOD} attach="material" />
        </mesh>
      </RigidBody>
      {Array.from({ length: planks }).map((_, i) => (
        <mesh
          key={i}
          castShadow
          position={[0, 0.01 + (r() - 0.5) * 0.02, -length / 2 + 0.31 + i * (length / planks)]}
          rotation={[0, (r() - 0.5) * 0.03, 0]}
          material={i % 3 === 0 ? WOOD_PALE : WOOD}
        >
          <boxGeometry args={[width - 0.1, 0.07, length / planks - 0.07]} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={s} castShadow position={[(s * width) / 2 - s * 0.1, -0.26, 0]} material={WOOD}>
          <boxGeometry args={[0.22, 0.36, length]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Round logs laid side by side across a dip, deliberately uneven. The gaps
 * between them are the obstacle — a wheel that drops in has to climb out.
 */
export function LogBridge({ at, span, rotation = 0 }: { at: [number, number]; span: number; rotation?: number }) {
  const [x, z] = at;
  const y = Math.max(heightAt(x, z - span / 2), heightAt(x, z + span / 2)) + 0.42;
  const r = useMemo(() => rand(5150), []);
  const logs = [-1.05, -0.36, 0.33, 1.02];

  return (
    <group position={[x, y, z]} rotation={[0, rotation, 0]}>
      {logs.map((ox, i) => {
        const rad = 0.3 + r() * 0.07;
        return (
          <RigidBody key={i} type="fixed" colliders="hull" position={[ox, (r() - 0.5) * 0.11, 0]}>
            <mesh castShadow receiveShadow rotation={[Math.PI / 2, 0, (r() - 0.5) * 0.05]} material={i % 2 ? WOOD : WOOD_PALE}>
              <cylinderGeometry args={[rad, rad * 0.94, span, 12]} />
            </mesh>
          </RigidBody>
        );
      })}
      {/* Cross beams the logs sit on, at each bank. */}
      {[-span / 2 + 0.5, span / 2 - 0.5].map((oz) => (
        <mesh key={oz} castShadow position={[0, -0.34, oz]} material={WOOD}>
          <boxGeometry args={[3.1, 0.3, 0.42]} />
        </mesh>
      ))}
      {/* Lashings. */}
      {[-span / 2 + 0.5, span / 2 - 0.5].map((oz) =>
        logs.map((ox, i) => (
          <mesh key={`${oz}-${i}`} position={[ox, -0.14, oz]} rotation={[0, 0, Math.PI / 2]} material={ROPE}>
            <torusGeometry args={[0.33, 0.035, 5, 10]} />
          </mesh>
        )),
      )}
    </group>
  );
}

/**
 * The canyon crossing: planks hung on a catenary between two posts.
 *
 * The deck is fixed geometry that follows the sag rather than a jointed
 * chain. A rope bridge simulated with joints is a pile of constraints that
 * goes unstable the first time a wheel catches a plank edge, and a bridge
 * that flings the truck into the canyon is worse than one that does not flex.
 */
export function RopeBridge({
  from,
  to,
  sag = 0.9,
}: {
  from: [number, number];
  to: [number, number];
  sag?: number;
}) {
  const len = Math.hypot(to[0] - from[0], to[1] - from[1]);
  const angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  const deck = Math.max(heightAt(...from), heightAt(...to)) + 1.15;
  const mid: [number, number] = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const n = Math.round(len / 0.52);
  const drop = (t: number) => -sag * (1 - Math.pow(2 * t - 1, 2));
  const r = useMemo(() => rand(3322), []);

  return (
    <group position={[mid[0], deck, mid[1]]} rotation={[0, -angle, 0]}>
      {Array.from({ length: n }).map((_, i) => {
        const t = (i + 0.5) / n;
        const px = -len / 2 + t * len;
        return (
          <RigidBody key={i} type="fixed" colliders="cuboid" position={[px, drop(t), 0]}>
            <mesh castShadow receiveShadow rotation={[0, 0, (r() - 0.5) * 0.04]} material={i % 4 === 0 ? WOOD_PALE : WOOD}>
              <boxGeometry args={[len / n - 0.08, 0.1, 2.5]} />
            </mesh>
          </RigidBody>
        );
      })}
      {/* Hand ropes and the cables the deck hangs from. */}
      {[-1, 1].map((s) =>
        [0, 1].map((tier) => {
          const pts = Array.from({ length: 24 }, (_, i) => {
            const t = i / 23;
            return new THREE.Vector3(-len / 2 + t * len, drop(t) + (tier ? 1.15 : 0.02), s * 1.25);
          });
          return (
            <mesh key={`${s}-${tier}`} material={ROPE}>
              <tubeGeometry args={[new THREE.CatmullRomCurve3(pts), 28, 0.035, 5, false]} />
            </mesh>
          );
        }),
      )}
      {[-1, 1].map((s) =>
        [-1, 1].map((e) => (
          <mesh key={`${s}-${e}`} castShadow position={[(e * len) / 2, 0.5, s * 1.25]} material={WOOD}>
            <boxGeometry args={[0.26, 1.9, 0.26]} />
          </mesh>
        )),
      )}
    </group>
  );
}

/** Handmade plank ramps. Jumping is not the point, so they stay modest. */
export function Ramp({ at, size, rotation = 0 }: { at: [number, number]; size: "s" | "m" | "l"; rotation?: number }) {
  const spec = { s: [2.6, 0.5], m: [3.8, 0.95], l: [5.2, 1.5] }[size];
  const [len, rise] = spec;
  const [x, z] = at;
  const y = heightAt(x, z);
  const pitch = Math.atan2(rise, len);

  return (
    <group position={[x, y, z]} rotation={[0, rotation, 0]}>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh castShadow receiveShadow position={[0, rise / 2, 0]} rotation={[-pitch, 0, 0]}>
          <boxGeometry args={[2.9, 0.14, Math.hypot(len, rise)]} />
          <primitive object={WOOD} attach="material" />
        </mesh>
      </RigidBody>
      {[-1, 0, 1].map((i) => (
        <mesh key={i} castShadow position={[i * 1.2, rise * 0.3, len * 0.18]} material={WOOD_PALE}>
          <boxGeometry args={[0.18, rise * 0.7, 0.18]} />
        </mesh>
      ))}
    </group>
  );
}

/** Obstacle tyres, stacked and half-buried, as every RC park has. */
export function TyreObstacles({ at }: { at: [number, number] }) {
  const items = useMemo(() => {
    const r = rand(8822);
    return Array.from({ length: 9 }, (_, i) => ({
      x: at[0] + (r() - 0.5) * 9,
      z: at[1] + (r() - 0.5) * 7,
      buried: r() > 0.45,
      spin: r() * 6.28,
      tilt: (r() - 0.5) * 0.5,
      i,
    }));
  }, [at]);

  return (
    <>
      {items.map((t) => {
        const ground = heightAt(t.x, t.z);
        return t.buried ? (
          <RigidBody key={t.i} type="fixed" colliders="hull" position={[t.x, ground + 0.08, t.z]} rotation={[Math.PI / 2 + t.tilt, 0, t.spin]}>
            <mesh castShadow receiveShadow material={RUBBER}>
              <torusGeometry args={[0.44, 0.17, 8, 16]} />
            </mesh>
          </RigidBody>
        ) : (
          <group key={t.i}>
            {[0, 1, 2].map((k) => (
              <RigidBody key={k} colliders="hull" position={[t.x, ground + 0.2 + k * 0.33, t.z]} mass={0.3} restitution={0.25}>
                <mesh castShadow receiveShadow rotation={[Math.PI / 2, 0, t.spin + k]} material={RUBBER}>
                  <torusGeometry args={[0.42, 0.16, 8, 16]} />
                </mesh>
              </RigidBody>
            ))}
          </group>
        );
      })}
    </>
  );
}

/**
 * Scatter: moss clumps, grass tufts and fallen branches, instanced so a few
 * thousand of them cost one draw call each. Kept off the driving lines by
 * slope — it gathers where the ground is steep or damp, which is also where
 * it would gather for real.
 */
export function Scatter({ count = 2600 }: { count?: number }) {
  const tuft = useMemo(() => new THREE.ConeGeometry(0.055, 0.2, 4, 1), []);
  const clump = useMemo(() => new THREE.IcosahedronGeometry(0.11, 0), []);

  const { grass, moss } = useMemo(() => {
    const r = rand(1337);
    const g: THREE.Matrix4[] = [];
    const m: THREE.Matrix4[] = [];
    const mat = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const nv = new THREE.Vector3();
    let tries = 0;
    while (g.length + m.length < count && tries < count * 14) {
      tries++;
      const x = (r() - 0.5) * 86;
      const z = (r() - 0.5) * 86;
      const h = heightAt(x, z);
      if (h > 13) continue;
      const n = normalAt(x, z);
      const slope = 1 - n[1];
      const damp = h < 0.6 && h > -1.1;
      if (!(slope > 0.1 || damp) || r() > 0.55) continue;
      nv.set(n[0], n[1], n[2]);
      q.setFromUnitVectors(up, nv);
      const s = 0.55 + r() * 0.8;
      if (slope > 0.22 || r() > 0.6) {
        mat.compose(new THREE.Vector3(x, h + 0.03 * s, z), q, new THREE.Vector3(s, s * 0.5, s));
        m.push(mat.clone());
      } else {
        mat.compose(new THREE.Vector3(x, h + 0.1 * s, z), q, new THREE.Vector3(s, s, s));
        g.push(mat.clone());
      }
    }
    return { grass: g, moss: m };
  }, [count]);

  return (
    <>
      <instancedMesh args={[tuft, MOSS_MAT, grass.length]} castShadow
        ref={(im) => {
          if (!im) return;
          grass.forEach((m, i) => im.setMatrixAt(i, m));
          im.instanceMatrix.needsUpdate = true;
        }}
      />
      <instancedMesh args={[clump, MOSS_MAT, moss.length]} receiveShadow
        ref={(im) => {
          if (!im) return;
          moss.forEach((m, i) => im.setMatrixAt(i, m));
          im.instanceMatrix.needsUpdate = true;
        }}
      />
    </>
  );
}
